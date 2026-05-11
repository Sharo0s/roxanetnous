import * as Sentry from '@sentry/nextjs'
import { createClient } from '@/lib/supabase/server'
import { enqueueOuvertureNotificationEmail } from '@/lib/emails'

export type NotifyOuvertureResult = {
  processed: number
  sent: number
  skipped: number
  errors: number
}

// Cap defensif anti-runaway. Partage avec le cron retry pour eviter le drift
// (code review patch #17).
export const NOTIFY_OUVERTURE_BATCH_LIMIT = 200

// Notifie tous les inscrits en attente pour un code departement.
// Idempotent via compare-and-swap atomique sur notified_at.
// Le swap est applique AVANT l'envoi email (D5 story 3.5) : si Resend echoue,
// la ligne reste marquee notifiee (trade-off pour eviter le double-envoi en
// cas d'overlap admin trigger + cron retry). Code review 2026-05-07 a tranche
// le maintien de D5 (option c) avec ajout d'observabilite.
export async function notifyOuvertureForCode(code: string): Promise<NotifyOuvertureResult> {
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
      console.warn('[notify-ouverture] code dpt inconnu', code)
      return { processed: 0, sent: 0, skipped: 0, errors: 0 }
    }
    console.error('[notify-ouverture][dpt_query_error]', { code, err: dptErr })
    return { processed: 0, sent: 0, skipped: 0, errors: 1 }
  }

  if (!dpt || !dpt.nom) {
    console.error('[notify-ouverture][dpt_nom_invalide]', { code, dpt })
    return { processed: 0, sent: 0, skipped: 0, errors: 1 }
  }

  const { data: lignes, error: queryErr } = await supabase
    .from('notifications_ouverture')
    .select('id, email')
    .eq('code_departement', code)
    .is('notified_at', null)
    .limit(NOTIFY_OUVERTURE_BATCH_LIMIT)

  if (queryErr) {
    console.error('[notify-ouverture][query_error]', { code, err: queryErr })
    return { processed: 0, sent: 0, skipped: 0, errors: 1 }
  }

  // Code review patch #4 : avertir si BATCH_LIMIT atteint, le surplus
  // sera ramasse au prochain cron retry quotidien. Story 4.3 AC10 : bascule
  // du console.warn en Sentry.captureMessage pour observabilite (tag
  // signal:queue-batch-saturation alerte un afflux anormal — DoS, ouverture
  // massive non planifiee, etc.).
  if (lignes && lignes.length === NOTIFY_OUVERTURE_BATCH_LIMIT) {
    Sentry.captureMessage('Batch notifications ouverture sature', {
      level: 'warning',
      tags: { flow: 'email', signal: 'queue-batch-saturation', severity: 'warning' },
      extra: {
        code,
        limit: NOTIFY_OUVERTURE_BATCH_LIMIT,
        processed: lignes.length,
        info: 'surplus reporte au prochain cron retry',
      },
    })
  }

  let processed = 0
  let sent = 0
  let skipped = 0
  let errors = 0

  for (const row of lignes ?? []) {
    processed++

    const { data: swapped, error: swapErr } = await supabase
      .from('notifications_ouverture')
      .update({ notified_at: new Date().toISOString() })
      .eq('id', row.id)
      .is('notified_at', null)
      .select('id')

    if (swapErr) {
      console.error('[notify-ouverture][swap_error]', { id: row.id, err: swapErr })
      errors++
      continue
    }
    if (!swapped || swapped.length === 0) {
      skipped++
      continue
    }

    // Story 4.3 : enqueue durable Workflow DevKit (return immediat ~50-100 ms,
    // 3 retries automatiques). Le compare-and-swap notified_at au-dessus
    // s'execute AVANT enqueue (D5 story 3.5 maintenu) : si l'enqueue throw
    // a posteriori, la ligne reste swappee — acceptable et idempotent puisque
    // le job durable a deja ete persiste OU le fallback synchrone (AC8) a
    // tente l'envoi.
    try {
      await enqueueOuvertureNotificationEmail({
        email: row.email,
        codeDepartement: code,
        nomDepartement: dpt.nom,
      })
      sent++
    } catch (sendErr) {
      console.error('[notify-ouverture][send_error]', { id: row.id, code, err: sendErr })
      errors++
    }
  }

  console.info('[notify-ouverture] code=' + code + ' processed=' + processed + ' sent=' + sent + ' skipped=' + skipped + ' errors=' + errors)
  return { processed, sent, skipped, errors }
}
