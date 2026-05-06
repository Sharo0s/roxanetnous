import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { sendWaitlistOpeningNotificationEmail } from '@/lib/emails'
import { NOTIFY_WAITLIST_BATCH_LIMIT } from '@/lib/notify-waitlist'

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
    .limit(NOTIFY_WAITLIST_BATCH_LIMIT)

  if (queryErr) {
    console.error('[cron_notify_waitlist_retry][query_error]', queryErr)
    return NextResponse.json({ error: 'Query failed' }, { status: 500 })
  }

  // Code review patch #5 : avertir si batch plein, signal d'un backlog
  // persistant qui devra etre traite (raise BATCH_LIMIT, cron plus frequent,
  // ou intervention ops).
  if (lignes && lignes.length === NOTIFY_WAITLIST_BATCH_LIMIT) {
    console.warn('[cron_notify_waitlist_retry][batch_limit_reached]', {
      limit: NOTIFY_WAITLIST_BATCH_LIMIT,
      info: 'backlog persistant possible, surplus repris demain',
    })
  }

  let processed = 0
  let sent = 0
  let skipped = 0
  let errors = 0

  for (const row of (lignes ?? []) as LigneAvecDpt[]) {
    processed++

    // Code review patch #10 : re-verification JS du filtre ouvert=true.
    // PostgREST !inner avec .eq('embed.col', val) n'est pas garanti cote BDD
    // selon version Supabase JS. Defense en profondeur.
    const dpt = Array.isArray(row.departements_ouverts)
      ? row.departements_ouverts[0]
      : row.departements_ouverts
    if (!dpt || dpt.ouvert !== true) {
      skipped++
      continue
    }

    // Code review patch #21 : nom obligatoire (FK orpheline ou lignes
    // corrompues retomberaient sur "nom = code" UX degradee).
    if (!dpt.nom) {
      console.error('[cron_notify_waitlist_retry][dpt_nom_invalide]', { id: row.id, code: row.code_departement })
      errors++
      continue
    }

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

    // Code review patch #3 : try/catch defensif. sendWaitlistOpeningNotificationEmail
    // catche deja Resend en interne, mais on protege la boucle d'une exception
    // inattendue qui crasherait le batch entier.
    try {
      await sendWaitlistOpeningNotificationEmail({
        email: row.email,
        codeDepartement: row.code_departement,
        nomDepartement: dpt.nom,
      })
      sent++
    } catch (sendErr) {
      console.error('[cron_notify_waitlist_retry][send_error]', { id: row.id, code: row.code_departement, err: sendErr })
      errors++
    }
  }

  console.info('[cron_notify_waitlist_retry] processed=' + processed + ' sent=' + sent + ' skipped=' + skipped + ' errors=' + errors)
  return NextResponse.json({ processed, sent, skipped, errors })
}
