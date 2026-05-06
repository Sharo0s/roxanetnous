import { createClient } from '@/lib/supabase/server'
import { sendWaitlistOpeningNotificationEmail } from '@/lib/emails'

export type NotifyWaitlistResult = {
  processed: number
  sent: number
  skipped: number
  errors: number
}

const BATCH_LIMIT = 200

// Notifie tous les inscrits waitlist en attente pour un code departement.
// Idempotent via compare-and-swap atomique sur notified_at.
// Le swap est applique AVANT l'envoi email (D5 story 3.5) : si Resend echoue,
// la ligne reste marquee notifiee (trade-off pour eviter le double-envoi en
// cas d'overlap admin trigger + cron retry).
export async function notifyWaitlistForCode(code: string): Promise<NotifyWaitlistResult> {
  const supabase = await createClient({ serviceRole: true })

  const { data: dpt } = await supabase
    .from('departements_ouverts')
    .select('nom')
    .eq('code', code)
    .single()

  if (!dpt) {
    console.warn('[notify-waitlist] code dpt inconnu', code)
    return { processed: 0, sent: 0, skipped: 0, errors: 0 }
  }

  const { data: lignes, error: queryErr } = await supabase
    .from('waitlist_departements')
    .select('id, email')
    .eq('code_departement', code)
    .is('notified_at', null)
    .limit(BATCH_LIMIT)

  if (queryErr) {
    console.error('[notify-waitlist][query_error]', { code, err: queryErr })
    return { processed: 0, sent: 0, skipped: 0, errors: 1 }
  }

  let processed = 0
  let sent = 0
  let skipped = 0
  let errors = 0

  for (const row of lignes ?? []) {
    processed++

    const { data: swapped, error: swapErr } = await supabase
      .from('waitlist_departements')
      .update({ notified_at: new Date().toISOString() })
      .eq('id', row.id)
      .is('notified_at', null)
      .select('id')

    if (swapErr) {
      console.error('[notify-waitlist][swap_error]', { id: row.id, err: swapErr })
      errors++
      continue
    }
    if (!swapped || swapped.length === 0) {
      skipped++
      continue
    }

    await sendWaitlistOpeningNotificationEmail({
      email: row.email,
      codeDepartement: code,
      nomDepartement: dpt.nom,
    })
    sent++
  }

  console.info('[notify-waitlist] code=' + code + ' processed=' + processed + ' sent=' + sent + ' skipped=' + skipped + ' errors=' + errors)
  return { processed, sent, skipped, errors }
}
