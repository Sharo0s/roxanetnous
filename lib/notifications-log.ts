// Helper neutre (non `'use server'`) d'INSERT dans `notifications_log`.
// Extrait de lib/emails.ts pour permettre la reutilisation depuis le step
// `'use step'` du workflow (lib/workflows/send-email-workflow.ts) sans
// conflit avec la directive `'use server'` de lib/emails.ts.
//
// Defense en profondeur : un INSERT qui throw (BDD down, RLS, valeur
// invalide) ne doit ni propager dans le try du caller (risque double-log
// sent + failed sur le meme envoi) ni provoquer d'unhandled rejection.
// Sentry capture l'incident, l'audit BDD est sacrifie au profit de la
// disponibilite applicative. Code review story 4.2 D1.
//
// Story 7.A.6 (2026-05-14) : capture du code Postgres 23505 (unique_violation)
// sur le partial UNIQUE INDEX `notifications_log_unique_sent_by_hour`
// (status='sent') -> succes idempotent silent-skip + breadcrumb info Sentry,
// pas de captureException critique. Heritage DECISIONS.md F5/F6/F7.
// Story 7.A.11 (2026-05-14 / decision F-Epic7-A11) : garde-fou CI
// `scripts/check-no-direct-notifications-log-insert.mjs` + validation runtime
// regex UUID sur `params.userId` (throw early avant le try si format invalide,
// propage au caller plutot que d'etre avalee par le catch Sentry du helper).

import * as Sentry from '@sentry/nextjs'
import { createClient } from '@/lib/supabase/server'

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

export type NotificationLogStatus =
  | 'pending'
  | 'sent'
  | 'failed'
  | 'error'
  | 'lost'
  | 'retry-scheduled'
  | 'retry-exhausted'

export async function logNotification(params: {
  userId?: string
  email: string
  type: string
  subject: string
  status: NotificationLogStatus
  error?: string
}) {
  // Story 7.A.11 : validation runtime UUID en amont du try -> propage au caller
  // si format invalide (ex: 'undefined' literal accidentel via String(undefined)).
  // Volontairement hors du try pour eviter d'etre avale par le catch Sentry.
  if (params.userId && !UUID_REGEX.test(params.userId)) {
    throw new Error(
      `logNotification: userId invalid format (expected UUID v4, got: "${params.userId}")`,
    )
  }
  try {
    const supabase = await createClient({ serviceRole: true })
    const { error: insertError } = await supabase.from('notifications_log').insert({
      user_id: params.userId || null,
      email: params.email,
      type: params.type,
      subject: params.subject,
      status: params.status,
      error: params.error || null,
      sent_at: params.status === 'sent' ? new Date().toISOString() : null,
    })
    if (insertError) {
      // Story 7.A.6 (F-Epic7-A6) : code Postgres 23505 (unique_violation) sur
      // le partial UNIQUE INDEX `notifications_log_unique_sent_by_hour` ->
      // succes idempotent (double-emission detectee meme tuple metier
      // user_id|email + type + subject + heure UTC). Silent-skip + breadcrumb
      // info Sentry pour observabilite, PAS de captureException critique.
      if ((insertError as { code?: string }).code === '23505') {
        Sentry.addBreadcrumb({
          category: 'notifications_log',
          level: 'info',
          message: 'duplicate-skip-idempotent',
          data: {
            type: params.type,
            status: params.status,
            hasUserId: Boolean(params.userId),
          },
        })
        return
      }
      // Autre erreur DB (CHECK status invalide, RLS, BDD down sous insert,
      // etc.) : propage en throw pour declencher le catch externe + Sentry
      // captureException severity warning.
      throw insertError
    }
  } catch (insertError) {
    Sentry.captureException(insertError, {
      tags: { flow: 'notifications_log', signal: 'insert_failed', severity: 'warning' },
      extra: {
        type: params.type,
        status: params.status,
        hasUserId: Boolean(params.userId),
      },
    })
  }
}
