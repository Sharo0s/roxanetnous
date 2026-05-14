// Story 4.3 : queue email durable basee sur Vercel Workflow DevKit.
//
// Architecture :
// - sendEmailWorkflow ("use workflow") orchestre les steps. Tourne dans le
//   sandbox workflow (pas d'I/O direct, pas d'acces full Node).
// - sendEmailViaResend ("use step") envoie l'email via Resend, avec retries
//   geres par le runtime Workflow (3 retries default + backoff exponentiel)
//   et persiste les statuts notifications_log directement (pas de step
//   imbrique : le INSERT BDD est fait via le helper neutre `logNotification`
//   importe depuis lib/notifications-log.ts).
//
// Decision D2 (idempotency_key) : utilisation du `stepId` retourne par
// getStepMetadata() comme idempotency_key Resend. Stable across retries,
// unique par step. Cf. node_modules/workflow/docs/foundations/idempotency.mdx.
//
// Decision D3 (retry-scheduled) : `getStepMetadata().attempt > 1` dans le step
// detecte une tentative de retry et logue `retry-scheduled` avant l'appel
// Resend. Au-dela des 3 retries default, le runtime propage l'erreur au
// workflow function qui logue selon le type d'erreur (FatalError -> `failed`,
// RetryableError epuise -> `retry-exhausted`) et reproduit le signal via
// Sentry.
//
// Decision D5 (revisitee story 7.A.10 - 2026-05-14, cf. deferred-work.md:250) :
// le client Resend est desormais instancie au scope module (singleton fork-safe,
// Resend SDK = wrapper fetch stateless). Le surcout cumule (~5ms x batch x
// retries = ~4s CPU pire cas Ile-de-France) est supprime. La justification
// historique « isolation propre vs singleton lib/emails.ts » est conservee
// ci-dessous pour tracabilite mais ne s'applique plus.
//
// Code review 2026-05-08 P11/P7 : route le catch global selon `error
// instanceof FatalError` pour distinguer `failed` (validation/recipient,
// pas de retry) de `retry-exhausted` (Resend transient x4 attempts). Tags
// Sentry distincts : `queue-fatal-error` vs `queue-retry-exhausted`. Le tag
// `queue-fatal-error` est emis UNIQUEMENT cote step (signal:queue-invalid-nom
// ou la classification Resend) ou cote workflow function selon le statut, pas
// les deux.
//
// Code review 2026-05-08 P3 : pas de step imbrique pour le INSERT BDD. Le
// helper `logNotification` (lib/notifications-log.ts, neutre non `'use server'`)
// est appele directement depuis le step `sendEmailViaResend`. Evite une
// suspension + INSERT multiplie cote runtime Workflow.
//
// Code review 2026-05-08 P4 : pas de PII (email destinataire) dans les tags
// ni les `extra` Sentry — uniquement le domaine ou un hash 12 chars si besoin.

import * as Sentry from '@sentry/nextjs'
import { FatalError, RetryableError, getStepMetadata } from 'workflow'
import { Resend } from 'resend'
import { logNotification } from '@/lib/notifications-log'
import {
  buildOuvertureConfirmationSubject,
  buildOuvertureNotificationSubject,
  isValidNomDepartement,
  renderOuvertureConfirmationHtml,
  renderOuvertureNotificationHtml,
} from '@/lib/email-templates'

const FROM_EMAIL = process.env.RESEND_FROM_EMAIL || 'roxanetnous <onboarding@resend.dev>'
const resend = new Resend(process.env.RESEND_API_KEY)

export type SendEmailTemplate = 'ouverture_confirmation' | 'ouverture_notification'

export type SendEmailPayload = {
  template: SendEmailTemplate
  to: string
  userId?: string
  variables: {
    codeDepartement: string
    nomDepartement: string
  }
}

// Statuts persistes dans notifications_log (schema story 4.2).
// `failed` est emis pour les FatalError (validation, recipient invalide) qui
// n'ont pas declenche de retry. `retry-exhausted` est emis uniquement quand
// le runtime a effectivement epuise les 3 retries (RetryableError).
type EmailLogStatus = 'pending' | 'sent' | 'retry-scheduled' | 'retry-exhausted' | 'failed'

function emailDomain(to: string): string {
  const at = to.lastIndexOf('@')
  return at >= 0 ? to.slice(at + 1) : 'unknown'
}

function buildSubject(payload: SendEmailPayload): string {
  return payload.template === 'ouverture_confirmation'
    ? buildOuvertureConfirmationSubject(payload.variables.nomDepartement)
    : buildOuvertureNotificationSubject(payload.variables.nomDepartement)
}

async function persistStatus(params: {
  status: EmailLogStatus
  payload: SendEmailPayload
  errorMessage?: string
}) {
  await logNotification({
    userId: params.payload.userId,
    email: params.payload.to,
    type: params.payload.template,
    subject: buildSubject(params.payload),
    status: params.status,
    error: params.errorMessage,
  })
}

// Whitelist explicite des `name` Resend connus comme fatals (cf. Resend SDK
// types `ErrorResponse.name`). Toute autre erreur (transient, 5xx, rate-limit,
// erreur reseau) tombe en RetryableError. Code review 2026-05-08 P2 :
// abandon de la regex sur `message` (faux-positifs pour 5xx contenant
// "missing" ou "invalid", messages localises, etc.).
const FATAL_RESEND_NAMES = new Set([
  'validation_error',
  'invalid_from_address',
  'invalid_to_address',
  'invalid_attachment',
  'invalid_idempotency_key',
  'invalid_idempotent_request',
  'missing_api_key',
  'missing_required_field',
  'restricted_api_key',
])

function classifyResendError(name: string): 'fatal' | 'retryable' {
  if (FATAL_RESEND_NAMES.has(name)) return 'fatal'
  return 'retryable'
}

async function sendEmailViaResend(payload: SendEmailPayload) {
  'use step'
  const metadata = getStepMetadata()

  // Retry detecte : on logue retry-scheduled avant la nouvelle tentative.
  // metadata.attempt vaut 1 au premier essai, 2+ pour les retries.
  if (metadata.attempt > 1) {
    await persistStatus({ status: 'retry-scheduled', payload })
  }

  // Validation defensive nomDepartement (CRLF, longueur). Pattern story 3.5
  // patch #13/#14. FatalError -> pas de retry, le workflow function loguera
  // `failed` (P11). Le tag Sentry critique reste `queue-invalid-nom` ; le
  // catch global ne reemmettra PAS de tag retry-exhausted (P7).
  if (!isValidNomDepartement(payload.variables.nomDepartement)) {
    Sentry.captureMessage('queue invalid nom departement', {
      level: 'error',
      tags: { flow: 'email', signal: 'queue-invalid-nom', severity: 'critical' },
      extra: {
        template: payload.template,
        code: payload.variables.codeDepartement,
        nom_length: (payload.variables.nomDepartement || '').length,
      },
    })
    throw new FatalError('Invalid nom departement (empty / too long / CRLF)')
  }

  const subject = buildSubject(payload)
  const html = payload.template === 'ouverture_confirmation'
    ? renderOuvertureConfirmationHtml(payload.variables)
    : renderOuvertureNotificationHtml(payload.variables)

  // idempotencyKey : utilisation du stepId stable across retries (cf. doc
  // bundled idempotency.mdx). Resend deduplique cote serveur les requetes
  // partageant le meme Idempotency-Key.
  const result = await resend.emails.send(
    {
      from: FROM_EMAIL,
      to: payload.to,
      subject,
      html,
    },
    { idempotencyKey: metadata.stepId },
  )

  // Resend peut resoudre avec { error } sans throw (rate-limit, recipient
  // invalide). Pattern story 3.5 patch #1.
  const resendError = result.error
  if (resendError) {
    const message = typeof resendError === 'string'
      ? resendError
      : (resendError && typeof resendError === 'object' && 'message' in resendError && typeof resendError.message === 'string'
        ? resendError.message
        : JSON.stringify(resendError))
    const name = (resendError && typeof resendError === 'object' && 'name' in resendError && typeof resendError.name === 'string')
      ? resendError.name
      : ''
    if (classifyResendError(name) === 'fatal') {
      throw new FatalError(`Resend fatal error [${name || 'unknown'}]: ${message}`)
    }
    // Sinon : transitoire (rate-limit, 5xx, erreur reseau). RetryableError ->
    // runtime Workflow re-essaie selon retryAfter.
    throw new RetryableError(`Resend transient error: ${message}`, { retryAfter: '1m' })
  }

  await persistStatus({ status: 'sent', payload })
}

export async function sendEmailWorkflow(payload: SendEmailPayload) {
  'use workflow'
  // Pre-step : trace l'intention d'envoi des l'enqueue (status=pending).
  await persistStatus({ status: 'pending', payload })
  try {
    await sendEmailViaResend(payload)
  } catch (error) {
    // Le step a epuise ses retries (3 default) OU a throw FatalError.
    // P11 : on distingue FatalError (validation, recipient invalide -> pas
    // de retry) de RetryableError epuise (Resend transient x4) pour audit
    // BDD propre + dashboard ops. P7 : pour FatalError, on ne re-emit pas le
    // tag Sentry critique (le step a deja emis queue-invalid-nom ou la
    // classification Resend porte l'info).
    const message = error instanceof Error ? error.message : String(error)
    const isFatal = error instanceof FatalError
    const status: EmailLogStatus = isFatal ? 'failed' : 'retry-exhausted'
    await persistStatus({ status, payload, errorMessage: message })

    if (!isFatal) {
      Sentry.captureException(error instanceof Error ? error : new Error(message), {
        tags: { flow: 'email', signal: 'queue-retry-exhausted', severity: 'critical' },
        extra: {
          template: payload.template,
          emailDomain: emailDomain(payload.to),
          hasUserId: Boolean(payload.userId),
        },
      })
    }
    // Re-throw pour que le run soit marque "failed" cote Vercel Workflow.
    throw error
  }
}
