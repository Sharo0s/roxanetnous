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

import * as Sentry from '@sentry/nextjs'
import { createClient } from '@/lib/supabase/server'

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
  try {
    const supabase = await createClient({ serviceRole: true })
    await supabase.from('notifications_log').insert({
      user_id: params.userId || null,
      email: params.email,
      type: params.type,
      subject: params.subject,
      status: params.status,
      error: params.error || null,
      sent_at: params.status === 'sent' ? new Date().toISOString() : null,
    })
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
