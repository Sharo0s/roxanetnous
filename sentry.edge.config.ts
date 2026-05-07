// Story 4.1 : init Sentry edge runtime. Charge depuis instrumentation.ts au
// boot du runtime edge Next.js (middleware, route handlers avec
// `export const runtime = 'edge'`).
//
// roxanetnous n'utilise actuellement aucun runtime edge en production
// (verifie 2026-05-07 : aucun fichier `app/**/route.ts` ni `middleware.ts`
// n'exporte `runtime = 'edge'`). La config edge reste exigee par
// withSentryConfig pour valider la chaine d'init.
//
// Decisions D3 / D5 (cf. story 4.1) : tracesSampleRate=0, enabled: !!DSN.
// sendDefaultPii: false explicite (review 2026-05-07) : meme rationale que
// sentry.server.config.ts.

import * as Sentry from '@sentry/nextjs'

const dsn = process.env.SENTRY_DSN || process.env.NEXT_PUBLIC_SENTRY_DSN

Sentry.init({
  dsn,
  enabled: !!dsn,
  environment: process.env.VERCEL_ENV || process.env.NODE_ENV,
  tracesSampleRate: 0,
  sendDefaultPii: false,
})
