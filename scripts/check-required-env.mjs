#!/usr/bin/env node
// Verifie la presence des variables d'env critiques selon l'environnement Vercel.
//
// Deux categories :
//   - REQUIRED              : obligatoires en production ET en preview (exit 1 si manquantes).
//                             Sans elles, le code applicatif crash au runtime (ex: RESEND_API_KEY).
//   - OPTIONAL_ON_PREVIEW   : obligatoires en production uniquement (exit 1 prod / silence preview).
//                             Tolerees absentes en preview/dev (ex: Sentry sans projet preview cree).
//
// Integre au buildCommand Vercel via `npm run check:env` (vercel.json).
// Story 3.8 a installe le script en warn-only ; story 4.8 le durcit en exit 1 prod.

const REQUIRED = [
  { name: 'ADMIN_NOTIFICATIONS_EMAIL',  description: 'Destinataire alertes anti-fraude parrainage.' },
  { name: 'RESEND_API_KEY',             description: 'API Resend pour emails transactionnels.' },
  { name: 'NEXT_PUBLIC_BASE_URL',       description: 'URL canonique production (liens emails).' },
  { name: 'STRIPE_SECRET_KEY',          description: 'Stripe paywall.' },
  { name: 'STRIPE_WEBHOOK_SECRET',      description: 'Stripe webhook signature.' },
  { name: 'SUPABASE_SERVICE_ROLE_KEY',  description: 'Server actions admin.' },
  { name: 'CRON_SECRET',                description: 'Auth /api/cron/*.' },
  { name: 'PARRAINAGE_INTERNAL_SECRET', description: 'Auth helper revoke filleule (story 2.3).' },
  { name: 'ENCRYPTION_KEY',             description: 'Chiffrement justificatifs accompagnantes.' },
]

const OPTIONAL_ON_PREVIEW = [
  { name: 'NEXT_PUBLIC_SENTRY_DSN',     description: 'DSN Sentry expose au client (capture exceptions browser).' },
  { name: 'SENTRY_DSN',                 description: 'DSN Sentry server-side (peut etre identique au public).' },
  { name: 'SENTRY_ORG',                 description: 'Slug organisation Sentry (upload sourcemaps build-time).' },
  { name: 'SENTRY_PROJECT',             description: 'Slug projet Sentry (upload sourcemaps build-time).' },
  { name: 'RATE_LIMIT_HASH_SALT',       description: 'Sel HMAC hash rate-limit Sentry (irreversibilite IP).' },
]

const vercelEnv = process.env.VERCEL_ENV

const isMissing = (v) => {
  const raw = process.env[v.name]
  return !raw || String(raw).trim() === ''
}

const missingRequired = REQUIRED.filter(isMissing)
const missingOptionalOnPreview = OPTIONAL_ON_PREVIEW.filter(isMissing)

if (vercelEnv === 'production') {
  const allMissing = [...missingRequired, ...missingOptionalOnPreview]
  if (allMissing.length > 0) {
    for (const v of allMissing) {
      console.error(`ERROR: ${v.name} is not set in VERCEL_ENV=production. ${v.description}`)
    }
    process.exit(1)
  }
  console.log('OK: all required env vars present (VERCEL_ENV=production).')
  process.exit(0)
}

if (vercelEnv === 'preview') {
  if (missingRequired.length > 0) {
    for (const v of missingRequired) {
      console.error(`ERROR (preview): ${v.name} is not set. ${v.description}`)
    }
    process.exit(1)
  }
  if (missingOptionalOnPreview.length === 0) {
    console.log('OK: all required env vars present (VERCEL_ENV=preview).')
  }
  process.exit(0)
}

// Dev local hors vercel : silencieux sauf si toutes les vars sont presentes
// (cas npm run check:env localement avec .env.local complet charge dans process.env).
if (missingRequired.length === 0 && missingOptionalOnPreview.length === 0) {
  console.log('OK: all required env vars present.')
}
process.exit(0)
