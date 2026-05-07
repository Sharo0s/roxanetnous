// Story 4.1 : registre Sentry serveur + edge. Charge la config adaptee au
// runtime Next.js detecte par process.env.NEXT_RUNTIME.
//
// Pattern @sentry/nextjs v10 + Next.js 16 : Next.js execute register() une
// seule fois au demarrage du runtime. La fonction onRequestError est branchee
// directement sur le hook error reporting de Next.

import * as Sentry from '@sentry/nextjs'

export async function register() {
  if (process.env.NEXT_RUNTIME === 'nodejs') {
    await import('./sentry.server.config')
  }

  if (process.env.NEXT_RUNTIME === 'edge') {
    await import('./sentry.edge.config')
  }
}

export const onRequestError = Sentry.captureRequestError
