// Global setup Playwright E2E.
// Garde-fou strict : refus categorique d'executer la suite E2E contre une URL
// Supabase non-locale (pattern aligne sur tests/integration/setup.ts:1-22 et
// scripts/seed-test-supabase.mjs:32-48). Les helpers tests/e2e/_lib/fixtures.ts
// font des DELETE directs en BDD : un dev qui exporterait par megarde
// SUPABASE_URL=https://...supabase.co ne doit JAMAIS pouvoir alterer la prod.
//
// Defense en profondeur : en CI (process.env.CI === 'true'), un hostname non-local
// declenche un process.exit(1) immediat (avant que Playwright ne demarre webServer).

const LOCAL_HOSTS = new Set(['localhost', '127.0.0.1', '[::1]', '::1'])

function assertLocalUrl(varName: string, value: string | undefined): void {
  if (!value) {
    const message = `[tests/e2e] ${varName} non defini — exporter la variable avant de lancer les tests E2E.`
    if (process.env.CI === 'true') {
      console.error(message)
      process.exit(1)
    }
    throw new Error(message)
  }
  let hostname: string
  try {
    hostname = new URL(value).hostname
  } catch {
    throw new Error(`[tests/e2e] ${varName}='${value}' n'est pas une URL valide.`)
  }
  if (!LOCAL_HOSTS.has(hostname)) {
    const message =
      `[tests/e2e] Refus d'executer : ${varName} hostname='${hostname}' n'est pas local. ` +
      'Lancer supabase start et exporter SUPABASE_URL=http://localhost:54321.'
    if (process.env.CI === 'true') {
      console.error(message)
      process.exit(1)
    }
    throw new Error(message)
  }
}

export default async function globalSetup(): Promise<void> {
  assertLocalUrl('SUPABASE_URL', process.env.SUPABASE_URL)
  assertLocalUrl('NEXT_PUBLIC_SUPABASE_URL', process.env.NEXT_PUBLIC_SUPABASE_URL)
}
