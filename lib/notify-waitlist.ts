import { createClient } from '@/lib/supabase/server'
import { sendWaitlistOpeningNotificationEmail } from '@/lib/emails'

export type NotifyWaitlistResult = {
  processed: number
  sent: number
  skipped: number
  errors: number
}

// Cap defensif anti-runaway. Partage avec le cron retry pour eviter le drift
// (code review patch #17).
export const NOTIFY_WAITLIST_BATCH_LIMIT = 200

// Notifie tous les inscrits waitlist en attente pour un code departement.
// Idempotent via compare-and-swap atomique sur notified_at.
// Le swap est applique AVANT l'envoi email (D5 story 3.5) : si Resend echoue,
// la ligne reste marquee notifiee (trade-off pour eviter le double-envoi en
// cas d'overlap admin trigger + cron retry). Code review 2026-05-07 a tranche
// le maintien de D5 (option c) avec ajout d'observabilite.
export async function notifyWaitlistForCode(code: string): Promise<NotifyWaitlistResult> {
  const supabase = await createClient({ serviceRole: true })

  const { data: dpt, error: dptErr } = await supabase
    .from('departements_ouverts')
    .select('nom')
    .eq('code', code)
    .single()

  if (dptErr) {
    // Code review patch #20 : distinguer erreur reseau (errors=1) vs
    // dpt inexistant (errors=0, early return silencieux).
    // PGRST116 = "no rows" Supabase, code dpt vraiment inconnu.
    if ((dptErr as { code?: string }).code === 'PGRST116') {
      console.warn('[notify-waitlist] code dpt inconnu', code)
      return { processed: 0, sent: 0, skipped: 0, errors: 0 }
    }
    console.error('[notify-waitlist][dpt_query_error]', { code, err: dptErr })
    return { processed: 0, sent: 0, skipped: 0, errors: 1 }
  }

  if (!dpt || !dpt.nom) {
    console.error('[notify-waitlist][dpt_nom_invalide]', { code, dpt })
    return { processed: 0, sent: 0, skipped: 0, errors: 1 }
  }

  const { data: lignes, error: queryErr } = await supabase
    .from('waitlist_departements')
    .select('id, email')
    .eq('code_departement', code)
    .is('notified_at', null)
    .limit(NOTIFY_WAITLIST_BATCH_LIMIT)

  if (queryErr) {
    console.error('[notify-waitlist][query_error]', { code, err: queryErr })
    return { processed: 0, sent: 0, skipped: 0, errors: 1 }
  }

  // Code review patch #4 : avertir si BATCH_LIMIT atteint, le surplus
  // sera ramasse au prochain cron retry quotidien.
  if (lignes && lignes.length === NOTIFY_WAITLIST_BATCH_LIMIT) {
    console.warn('[notify-waitlist][batch_limit_reached]', {
      code,
      limit: NOTIFY_WAITLIST_BATCH_LIMIT,
      info: 'surplus reporte au prochain cron retry',
    })
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

    // Code review patch #2 : try/catch defensif. sendWaitlistOpeningNotificationEmail
    // catche deja Resend en interne, mais une exception inattendue (timeout
    // reseau hors try, programmation defensive) ne doit pas crasher la boucle.
    try {
      await sendWaitlistOpeningNotificationEmail({
        email: row.email,
        codeDepartement: code,
        nomDepartement: dpt.nom,
      })
      sent++
    } catch (sendErr) {
      console.error('[notify-waitlist][send_error]', { id: row.id, code, err: sendErr })
      errors++
    }
  }

  console.info('[notify-waitlist] code=' + code + ' processed=' + processed + ' sent=' + sent + ' skipped=' + skipped + ' errors=' + errors)
  return { processed, sent, skipped, errors }
}
