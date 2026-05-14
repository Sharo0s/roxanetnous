#!/usr/bin/env node
// Verifie la presence (et la forme) des variables d'env critiques selon l'environnement Vercel.
//
// Deux categories :
//   - REQUIRED              : obligatoires en production (exit 1 si manquantes).
//                             Si flag `requiredOnPreview: true`, egalement obligatoires en preview.
//                             Sans elles, le code applicatif crash au runtime (ex: SUPABASE_*).
//   - OPTIONAL_ON_PREVIEW   : obligatoires en production uniquement (exit 1 prod / silence preview).
//                             Tolerees absentes en preview/dev (ex: Sentry sans projet preview cree).
//
// Validations appliquees en prod ET preview (sur les vars presentes uniquement) :
//   - shape : regex ou predicat applique a la valeur (exit 1 si non conforme).
//   - anti-placeholder : rejette les valeurs `your_*`, `XXX*`, `changeme*` etc. copiees-collees
//                        depuis .env.local.example.
//
// Branche dev local (VERCEL_ENV undefined) : silencieuse, aucun check shape ni placeholder.
//
// Integre au buildCommand Vercel via `npm run check:env` (vercel.json).
// Story 3.8 a installe le script en warn-only ; story 4.8 le durcit en exit 1 prod ;
// story 7.A.2 ajoute shape + anti-placeholder + 4 promotions REQUIRED prod.

const HEX_64 = /^[0-9a-f]{64}$/i
const STRIPE_SK = /^sk_(test|live)_[A-Za-z0-9]+$/
// Underscore tolere apres `whsec_` au cas ou Stripe ajoute un prefixe interne
// (`whsec_test_xxx`, `whsec_snap_xxx`) lors d'une rotation future.
const STRIPE_WHSEC = /^whsec_[A-Za-z0-9_]+$/
// Underscore + dash tolere : superset urlsafe-base64, robuste a un changement
// futur de format des cles Resend.
const RESEND_KEY = /^re_[A-Za-z0-9_-]+$/
const EMAIL_BASIC = /^[^@\s]+@[^@\s]+\.[^@\s]+$/
// Format Resend "Display Name <addr@dom>" (espace tolere, contenu ASCII commun).
const EMAIL_DISPLAY = /^[^<>]+<[^@\s<>]+@[^@\s<>]+\.[^@\s<>]+>$/
const SUPABASE_URL = /^https:\/\/[a-z0-9-]+\.supabase\.(co|com)\/?$/
const HTTP_URL = /^https?:\/\/[^\s]+$/

const minLength = (n) => (value) =>
  value.length >= n ? true : `must be at least ${n} chars (got ${value.length})`

const matchesAny = (...patterns) =>
  (value) =>
    patterns.some((re) => re.test(value))
      ? true
      : `must match one of: ${patterns.map((re) => re.source).join(' OR ')}`

const matches = (pattern, label) =>
  (value) =>
    pattern.test(value)
      ? true
      : `must match ${label || pattern.source}`

const REQUIRED = [
  { name: 'ADMIN_NOTIFICATIONS_EMAIL',  description: 'Destinataire alertes anti-fraude parrainage.',
    shape: matches(EMAIL_BASIC, 'a valid email') },
  { name: 'RESEND_API_KEY',             description: 'API Resend pour emails transactionnels.',
    shape: matches(RESEND_KEY, 're_<chars>') },
  { name: 'RESEND_FROM_EMAIL',          description: 'Adresse expediteur Resend production (sans : fallback sandbox onboarding@resend.dev -> bounces massifs).',
    shape: matchesAny(EMAIL_BASIC, EMAIL_DISPLAY) },
  { name: 'NEXT_PUBLIC_BASE_URL',       description: 'URL canonique production (liens emails).',
    shape: matches(HTTP_URL, 'http(s)://<host>') },
  { name: 'NEXT_PUBLIC_SUPABASE_URL',   description: 'URL projet Supabase (assertion ! runtime -> crash si absente).',
    requiredOnPreview: true,
    shape: matches(SUPABASE_URL, 'https://<project>.supabase.co') },
  { name: 'NEXT_PUBLIC_SUPABASE_ANON_KEY', description: 'Cle anon Supabase (assertion ! runtime -> crash si absente).',
    requiredOnPreview: true,
    shape: minLength(40) },
  { name: 'STRIPE_SECRET_KEY',          description: 'Stripe paywall.',
    shape: matches(STRIPE_SK, 'sk_(test|live)_<chars>') },
  { name: 'STRIPE_WEBHOOK_SECRET',      description: 'Stripe webhook signature.',
    shape: matches(STRIPE_WHSEC, 'whsec_<chars>') },
  { name: 'SUPABASE_SERVICE_ROLE_KEY',  description: 'Server actions admin.',
    shape: minLength(40) },
  { name: 'CRON_SECRET',                description: 'Auth /api/cron/* (>=32 chars).',
    shape: minLength(32) },
  { name: 'PARRAINAGE_INTERNAL_SECRET', description: 'Auth helper revoke filleule (story 2.3, >=32 chars).',
    shape: minLength(32) },
  { name: 'ENCRYPTION_KEY',             description: 'Chiffrement justificatifs accompagnants (32 bytes hex = 64 char).',
    shape: matches(HEX_64, '64 hex chars (32 bytes)') },
  { name: 'OPTOUT_TOKEN_SECRET',        description: 'HMAC liens opt-out emails de rappel (>=32 chars).',
    shape: minLength(32) },
  { name: 'SENTRY_AUTH_TOKEN',          description: 'Token upload sourcemaps Sentry build-time (sans : stack traces minifiees silencieuses en prod, >=20 chars).',
    shape: minLength(20) },
]

const OPTIONAL_ON_PREVIEW = [
  { name: 'NEXT_PUBLIC_SENTRY_DSN',     description: 'DSN Sentry expose au client (capture exceptions browser).',
    shape: matches(HTTP_URL, 'http(s)://<host>') },
  { name: 'SENTRY_DSN',                 description: 'DSN Sentry server-side (peut etre identique au public).',
    shape: matches(HTTP_URL, 'http(s)://<host>') },
  { name: 'SENTRY_ORG',                 description: 'Slug organisation Sentry (upload sourcemaps build-time).' },
  { name: 'SENTRY_PROJECT',             description: 'Slug projet Sentry (upload sourcemaps build-time).' },
  { name: 'RATE_LIMIT_HASH_SALT',       description: 'Sel HMAC hash rate-limit Sentry (irreversibilite IP, >=32 chars).',
    shape: minLength(32) },
]

// Anti-placeholder : valeurs copiees-collees depuis .env.local.example.
// `(?:_|$)` apres chaque token : bloque `xxx` seul ET `xxx_quelquechose`,
// sans bloquer `Example Company` (RESEND_FROM_EMAIL display name) ou
// `example-corp` (SENTRY_ORG) qui contiennent un espace ou un tiret apres.
const PLACEHOLDER_RE = /^(your_|xxx(?:_|$)|changeme(?:_|$)|placeholder(?:_|$)|exemple(?:_|$)|example(?:_|$))/i

// Story 7.A.3 : variables interdites en production si valeur literale `true`.
// `SKIP_E2E_TESTS=true` court-circuite `npm run test:integration` dans le
// buildCommand `vercel.json` via `(test "$SKIP_E2E_TESTS" = "true" || ...)`.
// On attrape strictement la valeur qui a effet runtime (pas `1` / `yes` / `on`
// que le test shell n'interprete pas comme truthy). Comparaison insensible a
// la casse pour robustesse defensive (cf. AC3 story 7.A.3).
const FORBIDDEN_IN_PROD_IF_TRUE = ['SKIP_E2E_TESTS']

const isTruthy = (rawValue) =>
  String(rawValue).trim().toLowerCase() === 'true'

const vercelEnv = process.env.VERCEL_ENV

const isMissing = (v) => {
  const raw = process.env[v.name]
  return !raw || String(raw).trim() === ''
}

// Tronque agressivement pour minimiser l'exposition en logs build Vercel : si
// un secret reel passait le check placeholder par accident, on ne veut pas
// reveler plus de quelques chars en clair. 8 chars suffisent a identifier un
// placeholder connu (`your_...`, `XXX_...`) sans liberer d'entropie utile.
const truncate = (s) => (s.length > 8 ? `${s.slice(0, 8)}...` : s)

// Retourne un tableau de messages d'erreur pour les checks "shape" + "placeholder"
// appliques aux vars presentes uniquement. Vide si tout est conforme.
//
// Ordre IMPORTANT : placeholder check AVANT shape check. Un placeholder
// `your_supabase_anon_key` (22 chars) violerait aussi le shape minLength(40),
// mais le message "looks like a placeholder" est plus informatif pour le dev
// que "invalid shape (min 40 chars)". Le test (j) de check-required-env.test.ts
// verrouille cet ordre.
function validatePresent(vars, envLabel) {
  const errors = []
  for (const v of vars) {
    const raw = process.env[v.name]
    if (!raw || String(raw).trim() === '') continue
    const value = String(raw).trim()
    // 1. Placeholder check (prefixe lexical insensible a la casse).
    if (PLACEHOLDER_RE.test(value)) {
      errors.push(
        `ERROR (${envLabel}): ${v.name} looks like a placeholder ('${truncate(value)}'). Use a real value.`,
      )
      continue
    }
    // 2. Shape check (si declare).
    if (typeof v.shape === 'function') {
      const result = v.shape(value)
      if (result !== true) {
        errors.push(
          `ERROR (${envLabel}): ${v.name} has invalid shape (${result}).`,
        )
      }
    } else if (v.shape instanceof RegExp) {
      if (!v.shape.test(value)) {
        errors.push(
          `ERROR (${envLabel}): ${v.name} has invalid shape (expected: ${v.shape.source}).`,
        )
      }
    }
  }
  return errors
}

const allRequired = REQUIRED
const previewRequired = REQUIRED.filter((v) => v.requiredOnPreview === true)
const allTracked = [...REQUIRED, ...OPTIONAL_ON_PREVIEW]

// Assertion top-level : empeche qu'un refactor declare la meme var dans
// REQUIRED ET OPTIONAL_ON_PREVIEW (validation 2x + 2 messages d'erreur identiques).
const trackedNames = allTracked.map((v) => v.name)
if (new Set(trackedNames).size !== trackedNames.length) {
  const dupes = trackedNames.filter((n, i) => trackedNames.indexOf(n) !== i)
  console.error(`ERROR (check-required-env config): duplicate var declaration(s): ${dupes.join(', ')}`)
  process.exit(2)
}

if (vercelEnv === 'production') {
  // Fail-fast story 7.A.3 : exit AVANT les checks REQUIRED/OPTIONAL/shape pour
  // que le message apparaisse en premier dans les logs build Vercel. Une var
  // interdite est un signal plus grave qu'une var manquante (regression scope).
  const forbidden = FORBIDDEN_IN_PROD_IF_TRUE.filter((name) => {
    const raw = process.env[name]
    return raw != null && isTruthy(raw)
  })
  if (forbidden.length > 0) {
    for (const name of forbidden) {
      console.error(
        `ERROR (production): ${name}=true is forbidden in production. Tests integration must always run on prod builds.`,
      )
    }
    process.exit(1)
  }

  const missing = allRequired.filter(isMissing)
  const missingOptional = OPTIONAL_ON_PREVIEW.filter(isMissing)
  const shapeErrors = validatePresent(allTracked, 'production')

  const hasError = missing.length > 0 || missingOptional.length > 0 || shapeErrors.length > 0

  if (hasError) {
    for (const v of [...missing, ...missingOptional]) {
      console.error(
        `ERROR (production): ${v.name} is not set. ${v.description}`,
      )
    }
    for (const msg of shapeErrors) console.error(msg)
    process.exit(1)
  }
  console.log(
    `OK: all required env vars present (VERCEL_ENV=production, ${REQUIRED.length} REQUIRED + ${OPTIONAL_ON_PREVIEW.length} OPTIONAL_ON_PREVIEW).`,
  )
  process.exit(0)
}

if (vercelEnv === 'preview') {
  const missing = previewRequired.filter(isMissing)
  const shapeErrors = validatePresent(allTracked, 'preview')

  if (missing.length > 0 || shapeErrors.length > 0) {
    for (const v of missing) {
      console.error(`ERROR (preview): ${v.name} is not set. ${v.description}`)
    }
    for (const msg of shapeErrors) console.error(msg)
    process.exit(1)
  }
  console.log(
    `OK: all preview-required env vars present (VERCEL_ENV=preview, ${previewRequired.length} required on preview).`,
  )
  process.exit(0)
}

// Dev local hors Vercel : silencieux. Aucun check shape ni placeholder
// (preserve l'experience locale avec .env.local incomplets).
const missingDev = REQUIRED.filter(isMissing)
const missingOptionalDev = OPTIONAL_ON_PREVIEW.filter(isMissing)
if (missingDev.length === 0 && missingOptionalDev.length === 0) {
  console.log('OK: all required env vars present.')
}
process.exit(0)
