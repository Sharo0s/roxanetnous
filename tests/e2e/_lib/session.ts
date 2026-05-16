import { expect, type Page } from '@playwright/test'

// Strategie auth E2E : reutilisation des 5 users seed deja provisionnes par
// scripts/seed-test-supabase.mjs (UUID fixes 0000...0001 a 0000...0005).
// Aucun user provisionne au runtime test : idempotence + zero deletion cross-tests.
//
// Note : le seed Accompagnante a ete renomme `Accompagnant` en story 5.A.2
// (enum BDD migre accompagnante -> accompagnant), donc l'email genere par le
// script est `seed-accompagnant@test.local`, pas `seed-accompagnante@test.local`.

export type SeedRole = 'admin' | 'accompagnant' | 'accompagne' | 'marraine' | 'filleule'

const SEED_PASSWORD = 'seed-password-1234'

export const SEED_USERS_CREDENTIALS: Record<SeedRole, { email: string; password: string }> = {
  admin: { email: 'seed-admin@test.local', password: SEED_PASSWORD },
  accompagnant: { email: 'seed-accompagnant@test.local', password: SEED_PASSWORD },
  accompagne: { email: 'seed-accompagne@test.local', password: SEED_PASSWORD },
  marraine: { email: 'seed-marraine@test.local', password: SEED_PASSWORD },
  filleule: { email: 'seed-filleule@test.local', password: SEED_PASSWORD },
}

// Le formulaire /login est un wizard 2 etapes (composants/auth/login-form.tsx) :
// 1. step "email"    : champ email + bouton "Continuer" -> appel checkEmailExists
// 2. step "password" : champ password (autoFocus) + bouton "Se connecter" -> server action login
// Apres login reussi, la server action redirige vers /admin, /accompagnant/dashboard
// ou /accompagne/dashboard selon le role (app/actions/auth.ts:281-286).
const ROLE_REDIRECT: Record<SeedRole, RegExp> = {
  admin: /\/admin(\/.*)?$/,
  accompagnant: /\/accompagnant(\/.*)?$/,
  accompagne: /\/accompagne(\/.*)?$/,
  marraine: /\/accompagnant(\/.*)?$/,
  filleule: /\/accompagnant(\/.*)?$/,
}

export interface LoginAsOptions {
  email?: string
  password?: string
}

export async function loginAs(
  page: Page,
  role: SeedRole,
  options: LoginAsOptions = {},
): Promise<void> {
  const credentials = SEED_USERS_CREDENTIALS[role]
  const email = options.email ?? credentials.email
  const password = options.password ?? credentials.password

  await page.goto('/login')

  // Step 1 : email -> "Continuer".
  await page.fill('input[name="email"]', email)
  await page.click('button[type="submit"]')

  // Attente de la transition vers step password : le champ password apparait
  // (autoFocus). Timeout court car checkEmailExists est rapide en local.
  try {
    await page.waitForSelector('input[name="password"]', { timeout: 10_000 })
  } catch {
    const currentUrl = page.url()
    throw new Error(
      `[loginAs:${role}] Etape password non atteinte. ` +
        `Email='${email}' redirige peut-etre vers /register (email inconnu) ou la server action a echoue. ` +
        `URL courante : ${currentUrl}.`,
    )
  }

  // Step 2 : password -> "Se connecter".
  await page.fill('input[name="password"]', password)
  await page.click('button[type="submit"]')

  // Attente de la redirection role-aware.
  try {
    await expect(page).toHaveURL(ROLE_REDIRECT[role], { timeout: 15_000 })
  } catch (err) {
    const currentUrl = page.url()
    const message = err instanceof Error ? err.message : String(err)
    throw new Error(
      `[loginAs:${role}] Redirection attendue ${ROLE_REDIRECT[role]} non atteinte. ` +
        `URL courante : ${currentUrl}. Email tente : ${email}. Detail : ${message}`,
      { cause: err },
    )
  }
}
