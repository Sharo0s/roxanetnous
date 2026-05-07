// Story 4.1 : init Sentry browser. Pattern @sentry/nextjs v10 + Next.js 16 :
// instrumentation-client.ts est charge automatiquement avant la premiere
// hydratation React.
//
// Decisions D3 / D5 (cf. story 4.1) :
// - tracesSampleRate / replaysSampleRate a 0 : pas de performance monitoring
//   ni de session replays. Decision separee post-go-live (cost vs visibilite).
// - enabled: !!DSN : permet aux deploiements sans DSN configure (preview, dev)
//   de tourner silencieusement sans erreur. Le garde-fou check-required-env
//   warn explicitement en VERCEL_ENV=production.
// - sendDefaultPii: false explicite (review 2026-05-07) : evite que le SDK
//   attache automatiquement les URL/headers de requete au breadcrumb client.

import * as Sentry from '@sentry/nextjs'

const dsn = process.env.NEXT_PUBLIC_SENTRY_DSN

Sentry.init({
  dsn,
  enabled: !!dsn,
  environment: process.env.NEXT_PUBLIC_VERCEL_ENV || process.env.NODE_ENV,
  tracesSampleRate: 0,
  replaysOnErrorSampleRate: 0,
  replaysSessionSampleRate: 0,
  sendDefaultPii: false,
  debug: process.env.NODE_ENV === 'development',
})

export const onRouterTransitionStart = Sentry.captureRouterTransitionStart
