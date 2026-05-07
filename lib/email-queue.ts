// Story 4.3 : helper neutre d'enqueue email vers la queue durable Vercel
// Workflow DevKit. Encapsule l'appel `start(sendEmailWorkflow)` afin que :
//   (a) les call-sites (server actions, cron, etc.) n'importent pas le
//       workflow function directement (decouplage technologique),
//   (b) un eventuel changement de queue (BullMQ, Vercel Queues, etc.) ne
//       touche pas les call-sites,
//   (c) un fallback synchrone (AC8) puisse etre branche au call-site via
//       les fonctions enqueue* de lib/emails.ts.
//
// Code review 2026-05-08 P1 : log applicatif `pending` AVANT `start()` pour
// combler le trou observabilite (si le runtime crashe entre start() et le
// step `logEmailStatusStep('pending')` du workflow function, on a au moins
// une trace audit cote BDD).
// Code review 2026-05-08 P9 : pas de Sentry.captureException ici. L'incident
// queue est deja signale par le caller (enqueueWaitlist*Email) via le tag
// `signal:queue-fallback-sync`. Inutile de doubler.

import { start } from 'workflow/api'
import { logNotification } from '@/lib/notifications-log'
import { sendEmailWorkflow, type SendEmailPayload } from '@/lib/workflows/send-email-workflow'
import {
  buildWaitlistConfirmationSubject,
  buildWaitlistOpeningSubject,
} from '@/lib/email-templates'

function buildSubject(payload: SendEmailPayload): string {
  return payload.template === 'waitlist_confirmation'
    ? buildWaitlistConfirmationSubject(payload.variables.nomDepartement)
    : buildWaitlistOpeningSubject(payload.variables.nomDepartement)
}

export async function enqueueEmail(payload: SendEmailPayload): Promise<{ runId: string }> {
  // P1 : log `pending` cote call-site AVANT start(). Si le runtime crashe
  // ensuite, on a au moins la trace audit. Le step `pending` du workflow
  // function ajoutera une 2eme ligne en cas de double-emission acceptee
  // (deferred-work : helper deduplique). Trade-off : 1 ligne BDD
  // supplementaire vs trou observabilite.
  await logNotification({
    userId: payload.userId,
    email: payload.to,
    type: payload.template,
    subject: buildSubject(payload),
    status: 'pending',
  })
  const run = await start(sendEmailWorkflow, [payload])
  return { runId: run.runId }
}
