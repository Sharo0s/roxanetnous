#!/usr/bin/env node
// Verifie que les variables d'env critiques sont definies en VERCEL_ENV=production.
// Non bloquant : warn only (cf. story 3.8 D2). Integre au buildCommand Vercel via
// `npm run check:env` (vercel.json).

const REQUIRED_VARS = [
  {
    name: 'ADMIN_NOTIFICATIONS_EMAIL',
    description: 'Destinataire alertes anti-fraude parrainage.',
  },
  {
    name: 'RESEND_API_KEY',
    description: 'API Resend pour emails transactionnels.',
  },
  {
    name: 'NEXT_PUBLIC_BASE_URL',
    description: 'URL canonique production (liens emails).',
  },
  {
    name: 'STRIPE_SECRET_KEY',
    description: 'Stripe paywall.',
  },
  {
    name: 'STRIPE_WEBHOOK_SECRET',
    description: 'Stripe webhook signature.',
  },
  {
    name: 'SUPABASE_SERVICE_ROLE_KEY',
    description: 'Server actions admin.',
  },
  {
    name: 'CRON_SECRET',
    description: 'Auth /api/cron/*.',
  },
  {
    name: 'PARRAINAGE_INTERNAL_SECRET',
    description: 'Auth helper revoke filleule (story 2.3).',
  },
  {
    name: 'ENCRYPTION_KEY',
    description: 'Chiffrement justificatifs accompagnantes.',
  },
  // Story 4.1 : alerting Sentry runtime (capture exceptions critiques).
  // Sans ces vars, aucun signal Sentry, debug uniquement via Vercel logs.
  // productionOnly: true (review 2026-05-07) -> silencieux en preview/dev,
  // warn uniquement en VERCEL_ENV=production conformement spec AC2.
  {
    name: 'NEXT_PUBLIC_SENTRY_DSN',
    description: 'DSN Sentry expose au client (capture exceptions browser).',
    productionOnly: true,
  },
  {
    name: 'SENTRY_DSN',
    description: 'DSN Sentry server-side (peut etre identique au public).',
    productionOnly: true,
  },
  {
    name: 'SENTRY_ORG',
    description: 'Slug organisation Sentry (upload sourcemaps build-time).',
    productionOnly: true,
  },
  {
    name: 'SENTRY_PROJECT',
    description: 'Slug projet Sentry (upload sourcemaps build-time).',
    productionOnly: true,
  },
  // Story 4.1 review D3 : sel HMAC pour irreversibilite hash rate-limit.
  // productionOnly: sans sel en preview/dev, le helper degrade en SHA-256
  // non-sale (acceptable pour debug local).
  {
    name: 'RATE_LIMIT_HASH_SALT',
    description: 'Sel HMAC hash rate-limit Sentry (irreversibilite IP).',
    productionOnly: true,
  },
]

const vercelEnv = process.env.VERCEL_ENV

const isMissing = (v) => {
  const raw = process.env[v.name]
  return !raw || String(raw).trim() === ''
}

const missing = REQUIRED_VARS.filter(isMissing)

if (vercelEnv === 'production') {
  if (missing.length > 0) {
    for (const v of missing) {
      console.warn(`WARN: ${v.name} is not set in VERCEL_ENV=production. ${v.description}`)
    }
  } else {
    console.log('OK: all required env vars present (VERCEL_ENV=production).')
  }
  process.exit(0)
}

if (vercelEnv === 'preview') {
  // Variables productionOnly (ex: Sentry alerting) : silencieuses en preview
  // car leur absence est attendue tant que le projet externe n'est pas cree.
  const missingForPreview = missing.filter((v) => !v.productionOnly)
  if (missingForPreview.length > 0) {
    for (const v of missingForPreview) {
      console.warn(`WARN (preview): ${v.name} is not set. ${v.description}`)
    }
  } else {
    console.log('OK: all required env vars present (VERCEL_ENV=preview).')
  }
  process.exit(0)
}

// Dev local hors vercel : silencieux sauf si toutes les vars sont presentes
// (cas npm run check:env localement avec .env.local complet charge dans process.env).
if (missing.length === 0) {
  console.log('OK: all required env vars present.')
}
process.exit(0)
