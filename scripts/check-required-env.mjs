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
]

const vercelEnv = process.env.VERCEL_ENV

const missing = REQUIRED_VARS.filter((v) => {
  const raw = process.env[v.name]
  return !raw || String(raw).trim() === ''
})

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
  if (missing.length > 0) {
    for (const v of missing) {
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
