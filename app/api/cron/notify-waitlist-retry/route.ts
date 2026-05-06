import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { sendWaitlistOpeningNotificationEmail } from '@/lib/emails'

const BATCH_LIMIT = 200

type LigneAvecDpt = {
  id: string
  email: string
  code_departement: string
  departements_ouverts: { nom: string; ouvert: boolean } | { nom: string; ouvert: boolean }[] | null
}

export async function GET(request: NextRequest) {
  const authHeader = request.headers.get('authorization')
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Non autorisé' }, { status: 401 })
  }

  const supabase = await createClient({ serviceRole: true })

  // SELECT lignes waitlist non notifiees pour des dpt deja ouverts.
  // Le JOIN garantit qu'on ne notifie pas un dpt qui n'a jamais ete ouvert.
  const { data: lignes, error: queryErr } = await supabase
    .from('waitlist_departements')
    .select('id, email, code_departement, departements_ouverts!inner(nom, ouvert)')
    .is('notified_at', null)
    .eq('departements_ouverts.ouvert', true)
    .limit(BATCH_LIMIT)

  if (queryErr) {
    console.error('[cron_notify_waitlist_retry][query_error]', queryErr)
    return NextResponse.json({ error: 'Query failed' }, { status: 500 })
  }

  let processed = 0
  let sent = 0
  let skipped = 0
  let errors = 0

  for (const row of (lignes ?? []) as LigneAvecDpt[]) {
    processed++

    const { data: swapped, error: swapErr } = await supabase
      .from('waitlist_departements')
      .update({ notified_at: new Date().toISOString() })
      .eq('id', row.id)
      .is('notified_at', null)
      .select('id')

    if (swapErr) {
      console.error('[cron_notify_waitlist_retry][swap_error]', { id: row.id, err: swapErr })
      errors++
      continue
    }
    if (!swapped || swapped.length === 0) {
      skipped++
      continue
    }

    // departements_ouverts est embed via PostgREST !inner. La cardinalite
    // (objet vs array) varie selon version Supabase JS, on couvre les deux.
    const dpt = Array.isArray(row.departements_ouverts)
      ? row.departements_ouverts[0]
      : row.departements_ouverts
    await sendWaitlistOpeningNotificationEmail({
      email: row.email,
      codeDepartement: row.code_departement,
      nomDepartement: dpt?.nom ?? row.code_departement,
    })
    sent++
  }

  console.info('[cron_notify_waitlist_retry] processed=' + processed + ' sent=' + sent + ' skipped=' + skipped + ' errors=' + errors)
  return NextResponse.json({ processed, sent, skipped, errors })
}
