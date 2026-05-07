// Story 4.1 : init Sentry serveur (Node.js runtime). Charge depuis
// instrumentation.ts au boot du runtime serveur Next.js.
//
// Decisions D3 / D5 (cf. story 4.1) : tracesSampleRate=0, enabled: !!DSN.
// sendDefaultPii: false explicite (review 2026-05-07) : le SDK v10 a deja
// false par defaut, on l'explicite pour se premunir d'une regression silencieuse
// sur upgrade SDK. Combine avec onRequestError = Sentry.captureRequestError dans
// instrumentation.ts, garantit qu'aucune URL/header de requete n'est attache.

import * as Sentry from '@sentry/nextjs'

const dsn = process.env.SENTRY_DSN || process.env.NEXT_PUBLIC_SENTRY_DSN

Sentry.init({
  dsn,
  enabled: !!dsn,
  environment: process.env.VERCEL_ENV || process.env.NODE_ENV,
  tracesSampleRate: 0,
  sendDefaultPii: false,
  debug: process.env.NODE_ENV === 'development',
})
