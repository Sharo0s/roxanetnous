// Story 7.A.2 : tests subprocess pour scripts/check-required-env.mjs.
// Pattern AC12 : spawn `node scripts/check-required-env.mjs` avec env isole
// pour eviter la pollution par process.env du test runner. Le script termine
// par process.exit(0|1) au top-level, donc require/import direct n'est pas
// possible (cela killerait Vitest). Cf. tests/unit/get-client-ip.test.ts pour
// le pattern de tests unitaires purs (sans Docker).

import { describe, it, expect } from 'vitest'
import { execFile } from 'node:child_process'
import { promisify } from 'node:util'
import { resolve } from 'node:path'

const execFileAsync = promisify(execFile)

const SCRIPT_PATH = resolve(process.cwd(), 'scripts/check-required-env.mjs')

// Valeurs valides reutilisables (placeholders OK ici, jamais utilises en prod).
const VALID = {
  ADMIN_NOTIFICATIONS_EMAIL: 'admin@roxanetnous.fr',
  RESEND_API_KEY: 're_abcdefABCDEF_123456',
  RESEND_FROM_EMAIL: 'noreply@roxanetnous.fr',
  NEXT_PUBLIC_BASE_URL: 'https://roxanetnous.fr',
  NEXT_PUBLIC_SUPABASE_URL: 'https://abcxyz.supabase.co',
  NEXT_PUBLIC_SUPABASE_ANON_KEY: 'a'.repeat(40),
  STRIPE_SECRET_KEY: 'sk_test_abcDEF123',
  STRIPE_WEBHOOK_SECRET: 'whsec_abcDEF123',
  SUPABASE_SERVICE_ROLE_KEY: 'a'.repeat(40),
  CRON_SECRET: 'a'.repeat(32),
  PARRAINAGE_INTERNAL_SECRET: 'a'.repeat(32),
  ENCRYPTION_KEY: '0'.repeat(64),
  OPTOUT_TOKEN_SECRET: 'a'.repeat(32),
  SENTRY_AUTH_TOKEN: 'sntrys_' + 'a'.repeat(20),
  NEXT_PUBLIC_SENTRY_DSN: 'https://abc@sentry.io/123',
  SENTRY_DSN: 'https://abc@sentry.io/123',
  SENTRY_ORG: 'roxanetnous',
  SENTRY_PROJECT: 'roxanetnous-web',
  RATE_LIMIT_HASH_SALT: 'a'.repeat(32),
}

type EnvOverrides = Record<string, string | undefined>

interface RunResult {
  exitCode: number
  stdout: string
  stderr: string
}

// Isole l'env : on ne herite PAS de process.env pour eviter qu'une var locale
// (.env.local sourcee dans le shell) ne pollue le test. On reinjecte PATH et
// HOME pour que node puisse demarrer.
async function runCheck(env: EnvOverrides): Promise<RunResult> {
  const cleanEnv: NodeJS.ProcessEnv = {
    PATH: process.env.PATH ?? '',
    HOME: process.env.HOME ?? '',
    NODE_ENV: 'test',
  }
  for (const [k, v] of Object.entries(env)) {
    if (v === undefined) continue
    cleanEnv[k] = v
  }
  try {
    const { stdout, stderr } = await execFileAsync('node', [SCRIPT_PATH], {
      env: cleanEnv,
    })
    return { exitCode: 0, stdout, stderr }
  } catch (err) {
    const e = err as { code?: number; stdout?: string; stderr?: string }
    return {
      exitCode: typeof e.code === 'number' ? e.code : 1,
      stdout: e.stdout ?? '',
      stderr: e.stderr ?? '',
    }
  }
}

describe('check-required-env.mjs', () => {
  it('(a) toutes vars REQUIRED + shapes valides en prod => exit 0', async () => {
    const result = await runCheck({
      VERCEL_ENV: 'production',
      ...VALID,
    })
    expect(result.exitCode).toBe(0)
    expect(result.stdout).toContain('OK')
  })

  it('(b) STRIPE_SECRET_KEY=sk_test_123 en prod => exit 0 (test mode acceptable)', async () => {
    const result = await runCheck({
      VERCEL_ENV: 'production',
      ...VALID,
      STRIPE_SECRET_KEY: 'sk_test_123',
    })
    expect(result.exitCode).toBe(0)
  })

  it('(c) STRIPE_SECRET_KEY=invalid_format en prod => exit 1 + message shape', async () => {
    const result = await runCheck({
      VERCEL_ENV: 'production',
      ...VALID,
      STRIPE_SECRET_KEY: 'invalid_format',
    })
    expect(result.exitCode).toBe(1)
    expect(result.stderr).toMatch(/STRIPE_SECRET_KEY.*invalid shape/i)
  })

  it('(d) RESEND_FROM_EMAIL=your_email_here en prod => exit 1 + message placeholder', async () => {
    const result = await runCheck({
      VERCEL_ENV: 'production',
      ...VALID,
      RESEND_FROM_EMAIL: 'your_email_here',
    })
    expect(result.exitCode).toBe(1)
    expect(result.stderr).toMatch(/RESEND_FROM_EMAIL.*placeholder/i)
  })

  it('(e) RESEND_FROM_EMAIL absente en prod => exit 1 + message REQUIRED', async () => {
    const result = await runCheck({
      VERCEL_ENV: 'production',
      ...VALID,
      RESEND_FROM_EMAIL: '',
    })
    expect(result.exitCode).toBe(1)
    expect(result.stderr).toMatch(/RESEND_FROM_EMAIL.*not set/i)
  })

  it('(f) ENCRYPTION_KEY=abcd (4 char) en prod => exit 1 + message shape', async () => {
    const result = await runCheck({
      VERCEL_ENV: 'production',
      ...VALID,
      ENCRYPTION_KEY: 'abcd',
    })
    expect(result.exitCode).toBe(1)
    expect(result.stderr).toMatch(/ENCRYPTION_KEY.*invalid shape/i)
  })

  it('(g) preview avec les 2 NEXT_PUBLIC_SUPABASE_* presentes + shapes valides => exit 0', async () => {
    const result = await runCheck({
      VERCEL_ENV: 'preview',
      NEXT_PUBLIC_SUPABASE_URL: VALID.NEXT_PUBLIC_SUPABASE_URL,
      NEXT_PUBLIC_SUPABASE_ANON_KEY: VALID.NEXT_PUBLIC_SUPABASE_ANON_KEY,
    })
    expect(result.exitCode).toBe(0)
  })

  it('(h) prod avec RESEND_FROM_EMAIL absente => exit 1 (liste prod elargie)', async () => {
    const result = await runCheck({
      VERCEL_ENV: 'production',
      ...VALID,
      RESEND_FROM_EMAIL: '',
    })
    expect(result.exitCode).toBe(1)
    expect(result.stderr).toContain('RESEND_FROM_EMAIL')
  })

  it('(i) dev local (VERCEL_ENV undefined) + presence partielle => exit 0 silencieux', async () => {
    const result = await runCheck({
      VERCEL_ENV: undefined,
      RESEND_API_KEY: 'invalid_format',
      STRIPE_SECRET_KEY: 'your_placeholder',
    })
    expect(result.exitCode).toBe(0)
  })

  it('(j) preview avec NEXT_PUBLIC_SUPABASE_ANON_KEY=your_supabase_anon_key => exit 1 placeholder', async () => {
    const result = await runCheck({
      VERCEL_ENV: 'preview',
      NEXT_PUBLIC_SUPABASE_URL: VALID.NEXT_PUBLIC_SUPABASE_URL,
      NEXT_PUBLIC_SUPABASE_ANON_KEY: 'your_supabase_anon_key',
    })
    expect(result.exitCode).toBe(1)
    expect(result.stderr).toMatch(/NEXT_PUBLIC_SUPABASE_ANON_KEY.*placeholder/i)
  })

  // Cas limites de longueur : verifient l'absence d'off-by-one dans minLength.
  // Suffit de couvrir N-1 (refus) et N (accept) pour 3 vars de longueurs differentes.

  it('(k) CRON_SECRET 31 chars en prod => exit 1 shape (just under 32)', async () => {
    const result = await runCheck({
      VERCEL_ENV: 'production',
      ...VALID,
      CRON_SECRET: 'a'.repeat(31),
    })
    expect(result.exitCode).toBe(1)
    expect(result.stderr).toMatch(/CRON_SECRET.*invalid shape/i)
  })

  it('(l) CRON_SECRET 32 chars en prod => exit 0 (boundary min)', async () => {
    const result = await runCheck({
      VERCEL_ENV: 'production',
      ...VALID,
      CRON_SECRET: 'a'.repeat(32),
    })
    expect(result.exitCode).toBe(0)
  })

  it('(m) SENTRY_AUTH_TOKEN 19 chars en prod => exit 1 shape (just under 20)', async () => {
    const result = await runCheck({
      VERCEL_ENV: 'production',
      ...VALID,
      SENTRY_AUTH_TOKEN: 'a'.repeat(19),
    })
    expect(result.exitCode).toBe(1)
    expect(result.stderr).toMatch(/SENTRY_AUTH_TOKEN.*invalid shape/i)
  })

  it('(n) SUPABASE_SERVICE_ROLE_KEY 39 chars en prod => exit 1 shape (just under 40)', async () => {
    const result = await runCheck({
      VERCEL_ENV: 'production',
      ...VALID,
      SUPABASE_SERVICE_ROLE_KEY: 'a'.repeat(39),
    })
    expect(result.exitCode).toBe(1)
    expect(result.stderr).toMatch(/SUPABASE_SERVICE_ROLE_KEY.*invalid shape/i)
  })

  // Story 7.A.3 : garde-fou SKIP_E2E_TESTS=true interdit en VERCEL_ENV=production.
  // Le buildCommand vercel.json reconnait UNIQUEMENT la valeur literale `"true"`
  // via `test "$SKIP_E2E_TESTS" = "true"` ; l'assertion script attrape donc strictement
  // cette valeur (insensible a la casse), et tolere les variantes inactives `1` / `yes`.

  it('(o) prod + SKIP_E2E_TESTS=true => exit 1 + message forbidden (fail-fast)', async () => {
    const result = await runCheck({
      VERCEL_ENV: 'production',
      ...VALID,
      SKIP_E2E_TESTS: 'true',
    })
    expect(result.exitCode).toBe(1)
    expect(result.stderr).toMatch(
      /SKIP_E2E_TESTS=true is forbidden in production/,
    )
  })

  it('(p) prod + SKIP_E2E_TESTS non set + VALID => exit 0 (cas nominal prod)', async () => {
    const result = await runCheck({
      VERCEL_ENV: 'production',
      ...VALID,
    })
    expect(result.exitCode).toBe(0)
    expect(result.stdout).toContain('OK')
  })

  it('(q) preview + SKIP_E2E_TESTS=true => exit 0 (preview tolere le skip)', async () => {
    const result = await runCheck({
      VERCEL_ENV: 'preview',
      NEXT_PUBLIC_SUPABASE_URL: VALID.NEXT_PUBLIC_SUPABASE_URL,
      NEXT_PUBLIC_SUPABASE_ANON_KEY: VALID.NEXT_PUBLIC_SUPABASE_ANON_KEY,
      SKIP_E2E_TESTS: 'true',
    })
    expect(result.exitCode).toBe(0)
  })

  it('(r) dev local (VERCEL_ENV undefined) + SKIP_E2E_TESTS=true => exit 0 silencieux', async () => {
    const result = await runCheck({
      VERCEL_ENV: undefined,
      SKIP_E2E_TESTS: 'true',
    })
    expect(result.exitCode).toBe(0)
  })

  it('(s) prod + SKIP_E2E_TESTS=True (uppercase) => exit 1 (insensible casse)', async () => {
    const result = await runCheck({
      VERCEL_ENV: 'production',
      ...VALID,
      SKIP_E2E_TESTS: 'True',
    })
    expect(result.exitCode).toBe(1)
    expect(result.stderr).toMatch(
      /SKIP_E2E_TESTS=true is forbidden in production/,
    )
  })

  it('(t) prod + SKIP_E2E_TESTS=false => exit 0 (valeur neutre toleree)', async () => {
    const result = await runCheck({
      VERCEL_ENV: 'production',
      ...VALID,
      SKIP_E2E_TESTS: 'false',
    })
    expect(result.exitCode).toBe(0)
  })
})
