// Story 8.D.1 : E2E Playwright -- parrainage symetrique golden path
// (accompagne -> accompagnant).
//
// 4 scenarios :
//   SC1. [golden-path] parrain accompagne affiche son code sur /accompagne/parrainage.
//   SC2. [golden-path] filleul accompagnant valide le code via /register?...code (deeplink).
//   SC3. [golden-path] filleul accompagnant onboarding bypass visio role-independant.
//   SC4. [golden-path] confirmParrainageOnSuccess proxy via etat BDD post-paiement.
//
// Strategie heritage 7.C.2 strict :
//   - withPg + assertLocalPgUrl pour tous les setups/asserts BDD.
//   - beforeAll(resetEphemeralRows) + afterAll(resetEphemeralRows + cleanup specifique).
//   - reuse loginAs (7.C.1) et OnboardingPage (7.C.2) sans extension.
//
// Strategie SC4 (proxy etat BDD) :
//   Le flux Stripe Checkout reel est hors-portee Playwright pur (UI Stripe non
//   automatisable cross-browser, timing GHA fragile). On reproduit donc l etat
//   BDD final attendu apres `confirmParrainageOnSuccess` reussi pour un parrain
//   accompagne + filleul accompagnant, et on asserte sur la SHAPE attendue
//   (FR51 bypass visio + AR-E8.5 code filleul + FR54 sens autorise). La
//   couverture comportementale de confirmParrainageOnSuccess est assuree par
//   8.A.4 SC1 integration. SC4 ici verrouille les invariants persistes
//   (contrat aval admin/cron/UI).
//
// Cleanup exception vs 7.C.2 :
//   7.C.2 AC4 documente "ne PAS reset users.parrainee_par en afterAll".
//   8.D.1 deroge a cette regle parce qu il modifie le parrain (user3 accompagne)
//   alors que 7.C.2 modifie user4 (accompagnant). 8.D.1 etant la derniere story
//   Epic 8, le retour a l etat seed (parrainee_par=NULL) est plus sain pour
//   les retros + audits future.

import { test, expect } from '@playwright/test'
import pg from 'pg'
import { loginAs } from './_lib/session'
import { resetEphemeralRows, assertLocalPgUrl } from './_lib/fixtures'
import { OnboardingPage } from './_lib/pages'

const { Client } = pg

const PG_URL =
  process.env.SUPABASE_DB_URL ?? 'postgresql://postgres:postgres@localhost:54322/postgres'

// UUIDs seed (cf. scripts/seed-test-supabase.mjs + 01_users.sql).
const ACCOMPAGNE_ID = '00000000-0000-0000-0000-000000000003' // user3, role 'accompagne'
const FILLEULE_ID = '00000000-0000-0000-0000-000000000005' // user5, role 'accompagnant' (seed Filleule)
const SUB_CCC2_ID = '00000000-0000-0000-0000-00000000ccc2' // subscription user3 (seed expiree)

// Code parrainage accompagne (SC1/SC2/SC3) :
// Doit respecter CODE_REGEX = /^[ABCDEFGHJKMNPQRSTUVWXYZ23456789]{8}$/ pour
// satisfaire `validateCode` (app/actions/parrainage.ts:24). Ne suit donc PAS
// le prefix `e2e-test-` -> cleanup specifique en afterAll.
const CODE_E2E = 'E2ETEST8'

// Code parrainage SC4 (parrainage cree pour simuler post-confirmParrainageOnSuccess) :
// La colonne parrainages.code est TEXT sans CHECK alphabet (validation est applicative).
// On utilise le prefix `e2e-test-` pour eligibilite resetEphemeralRows.
const PARRAINAGE_CODE_TEST = 'e2e-test-syme1'

// Code parrainage filleul (SC4 : code genere apres bypass).
// parrainages_codes.code est UNIQUE mais TEXT sans CHECK alphabet -> on garde
// le prefix `e2e-test-` pour traceabilite + cleanup specifique en afterAll.
const FILLEUL_CODE_GEN = 'e2e-test-syme2'

async function withPg<T>(fn: (client: pg.Client) => Promise<T>): Promise<T> {
  // Refuse toute connexion non-locale (heritage 7.C.2 strict).
  assertLocalPgUrl(PG_URL)
  const client = new Client({ connectionString: PG_URL, connectionTimeoutMillis: 5_000 })
  await client.connect()
  try {
    return await fn(client)
  } finally {
    await client.end()
  }
}

// Setup BDD partage SC1/SC2/SC3/SC4 : transforme subscriptions.ccc2 (user3
// accompagne, status='active' mais current_period_end expiree par seed) en
// abonnement actif futur, et seed/upsert parrainages_codes user3 code E2ETEST8.
// Idempotent (ON CONFLICT / UPDATE). Appele en debut de chaque SC pour permettre
// l execution selective (--grep) sans dependance d ordre.
async function ensureAccompagneParrainSetup(): Promise<void> {
  await withPg(async (client) => {
    await client.query(
      `UPDATE public.subscriptions
          SET status = 'active',
              current_period_start = now() - interval '7 days',
              current_period_end = now() + interval '30 days'
        WHERE id = $1`,
      [SUB_CCC2_ID],
    )

    // parrainages_codes : INSERT ON CONFLICT (user_id) DO UPDATE SET code.
    // PRIMARY KEY (user_id) + UNIQUE (code) -> upsert sur user_id ecrase le code.
    await client.query(
      `INSERT INTO public.parrainages_codes (user_id, code, compteur_confirmes, total_recompenses)
       VALUES ($1, $2, 0, 0)
       ON CONFLICT (user_id) DO UPDATE
         SET code = EXCLUDED.code,
             compteur_confirmes = 0,
             total_recompenses = 0`,
      [ACCOMPAGNE_ID, CODE_E2E],
    )
  })
}

test.beforeAll(async () => {
  // Nettoie les residus d un run precedent (crash avant afterAll, retry CI).
  await resetEphemeralRows()
})

test.afterAll(async () => {
  // 1. Cleanup ephemeral rows (codes e2e-test-* dans parrainages + admin_actions_log marker).
  await resetEphemeralRows()

  // 2. Cleanup specifique parrainages_codes (ne touche pas TESTSEED1 seed user4).
  await withPg(async (client) => {
    await client.query(
      `DELETE FROM public.parrainages_codes WHERE user_id IN ($1, $2) AND code IN ($3, $4)`,
      [ACCOMPAGNE_ID, FILLEULE_ID, CODE_E2E, FILLEUL_CODE_GEN],
    )
  })

  // 3. Reset users.parrainee_par sur filleule (eviter pollution 7.C.2 + retros).
  //    Exception documentee vs convention 7.C.2 (cf. header).
  await withPg(async (client) => {
    await client.query(
      `UPDATE public.users SET parrainee_par = NULL WHERE id = $1`,
      [FILLEULE_ID],
    )
  })

  // 4. Reset subscriptions.ccc2 vers etat seed expire (current_period_end = now() - 1 day).
  //    Sans ca, le seed reset suivant lirait un etat divergent.
  await withPg(async (client) => {
    await client.query(
      `UPDATE public.subscriptions
          SET status = 'active',
              current_period_start = now() - interval '40 days',
              current_period_end = now() - interval '1 day'
        WHERE id = $1`,
      [SUB_CCC2_ID],
    )
  })

  // 5. Cleanup subscriptions user5 inserees (SC4 simule filleul abonne post-Checkout).
  await withPg(async (client) => {
    await client.query(
      `DELETE FROM public.subscriptions WHERE user_id = $1 AND stripe_subscription_id LIKE 'sub_e2e_syme%'`,
      [FILLEULE_ID],
    )
  })

  // 6. Reset accompagnants_profiles.validation_source/status user5 vers seed
  //    (seed 01_users.sql force validation_status='valide' + validation_source defaut 'manuelle').
  //    No-op sur validation_status (deja 'valide'). Reset validation_source pour eviter
  //    pollution post-SC4 qui force 'parrainage'.
  await withPg(async (client) => {
    await client.query(
      `UPDATE public.accompagnants_profiles
          SET validation_source = 'manuelle'
        WHERE user_id = $1`,
      [FILLEULE_ID],
    )
  })
})

test('[golden-path] parrain accompagne affiche son code sur /accompagne/parrainage @parrainage-symetrique', async ({
  page,
}) => {
  // Photographie 2026-05-17 : structure DOM page /accompagne/parrainage
  // (app/accompagne/parrainage/page.tsx + components/accompagne/parrainage-view.tsx).
  // Toute refacto majeure de la page doit mettre a jour ces selecteurs.

  await ensureAccompagneParrainSetup()

  await loginAs(page, 'accompagne')

  await page.goto('/accompagne/parrainage')
  await expect(page).toHaveURL(/\/accompagne\/parrainage$/, { timeout: 15_000 })

  // Eyebrow + H1 editorial (cf. app/accompagne/parrainage/page.tsx:77-78).
  await expect(page.getByText('Mon espace', { exact: true })).toBeVisible()
  await expect(
    page.getByRole('heading', { level: 1, name: 'Mon parrainage' }),
  ).toBeVisible()

  // Code visible (cf. components/accompagne/parrainage-view.tsx:107-117).
  // Le code est rendu dans <div class="select-all"> avec letterSpacing 0.4rem ;
  // getByText matche le contenu textuel sans tenir compte de la spacing CSS.
  await expect(page.getByText(CODE_E2E, { exact: true })).toBeVisible()

  // Boutons copie (cf. parrainage-view.tsx:118-133).
  // Apostrophe rendue est U+2019 RIGHT SINGLE QUOTATION MARK -> regex permissive.
  await expect(page.getByRole('button', { name: 'Copier le code' })).toBeVisible()
  await expect(
    page.getByRole('button', { name: /Copier le lien d['’]invitation/ }),
  ).toBeVisible()

  // Compteur progression initial : "0 sur 5 filleuls validés"
  // (cf. parrainage-view.tsx:166-168). Accent toléré via regex.
  await expect(page.getByText(/0\s*sur\s*5\s*filleuls\s*valid/i)).toBeVisible()

  // Empty state filleuls (cf. parrainage-view.tsx:178-181).
  await expect(page.getByText(/Aucun filleul pour le moment/i)).toBeVisible()
})

test('[golden-path] filleul accompagnant valide le code sur /register @parrainage-symetrique', async ({
  page,
}) => {
  // Photographie 2026-05-17 : wizard signup register-form.tsx steps
  // role -> name -> localisation -> parrainage -> email -> password.
  // Toute refacto du wizard (rename steps, refactor RegisterForm) doit mettre
  // a jour T4.3/T4.4. Le test n effectue pas de submit final (evite pollution
  // BDD + envoi mail Resend + Supabase Auth signup).

  await ensureAccompagneParrainSetup()

  // Deeplink : pre-remplit role + parrainage_code via URL (cf. register-form.tsx:55-69).
  // role=accompagnant skip step 'role' -> step='name' au mount.
  await page.goto(`/register?role=accompagnant&parrainage_code=${CODE_E2E}`)

  // Step 'name' : firstName + lastName + Continuer (cf. register-form.tsx:288-316).
  // Le bouton "Continuer" n est rendu que pour la step courante
  // (register-form.tsx:310 `{isCurrent('name') && ...}`), donc unique a ce stade.
  await page.fill('input[name="firstName"]', 'E2E')
  await page.fill('input[name="lastName"]', 'Filleul')
  await page.getByRole('button', { name: 'Continuer' }).last().click()

  // Step 'localisation' : ville + codePostal + Continuer (cf. register-form.tsx:318-344).
  // CityAutocomplete (components/ui/city-autocomplete.tsx:143-178) rend 2 inputs
  // SANS attribut `name` -- on cible donc via placeholder (`Paris`, `75001`).
  await page.fill('input[placeholder="Paris"]', 'Rennes')
  await page.fill('input[placeholder="75001"]', '35000')
  // Le dropdown autocomplete (suggestions API geo) intercepte les pointer
  // events sur le bouton "Continuer" -- on le ferme via Escape (handler
  // city-autocomplete.tsx:127-128) avec fallback `force: true` au clic au
  // cas ou le dropdown se rouvre suite au re-render.
  await page.keyboard.press('Escape')
  // 2 boutons "Continuer" sont visibles (name + localisation) car les steps
  // precedentes restent affichees -- on prend le dernier (step courante).
  // `force: true` ignore les pointer events intercepts (dropdown residuel).
  await page.getByRole('button', { name: 'Continuer' }).last().click({ force: true })

  // Step 'parrainage' : le code doit etre pre-rempli (initialParrainageCode mount).
  // Le useEffect ligne 94-100 a lance checkParrainageCode au mount -> apres
  // l attente du tick async, parrainageState.status === 'valid' et le message
  // de confirmation est visible.
  // Selecteur input : id="parrainage_code" + name="parrainage_code" (ligne 354-355).
  await expect(page.locator('input[name="parrainage_code"]')).toHaveValue(CODE_E2E)

  // Message valid (cf. register-form.tsx:373-380) :
  // "Code valide (parrainage par Seed). Votre parrain se porte garant — vous publierez vos annonces dès la souscription."
  // Seed user3 first_name = 'Seed' (cf. 01_users.sql:11-13).
  await expect(
    page.getByText(/Code valide.*parrainage par Seed/i),
  ).toBeVisible({ timeout: 15_000 })

  // Pas de submit final : on s arrete a la step 'parrainage' pour eviter
  // pollution BDD users + Resend mail + Supabase signup.
})

test('[golden-path] filleul accompagnant bypass visio avec parrain accompagne @parrainage-symetrique', async ({
  page,
}) => {
  // Miroir 7.C.2 AC4 : 7.C.2 valide bypass visio avec parrain accompagnant
  // (user4). 8.D.1 valide bypass visio avec parrain accompagne (user3) pour
  // prouver que OnboardingClient.isFilleule est role-independant (lit
  // users.parrainee_par seul, pas le role du parrain). FR51 + AR-E8.5.

  await ensureAccompagneParrainSetup()

  // Setup BDD : pose parrainee_par sur user5 (filleule) vers user3 (accompagne).
  // 7.C.2 fait UPDATE vers user4 (accompagnant) -> 8.D.1 ecrase vers user3.
  // 8.D.1 reset en afterAll (cf. header exception).
  await withPg(async (client) => {
    await client.query(
      `UPDATE public.users SET parrainee_par = $1 WHERE id = $2`,
      [ACCOMPAGNE_ID, FILLEULE_ID],
    )
  })

  await loginAs(page, 'filleule')

  const onboarding = new OnboardingPage(page)
  await onboarding.goto()

  // Message bypass visio (cf. components/accompagnant/onboarding-client.tsx:179-190).
  await onboarding.expectBypassMessage()

  // Helper "Optionnel grâce à votre parrainage"
  // (cf. components/accompagnant/step-diplome.tsx:140-143).
  await expect(
    page.getByText(/Optionnel grâce à votre parrainage/i),
  ).toBeVisible({ timeout: 10_000 })

  // Smoke BDD : parrainee_par bien pose (verifie que le setup a pris).
  await withPg(async (client) => {
    const result = await client.query<{ parrainee_par: string | null }>(
      `SELECT parrainee_par FROM public.users WHERE id = $1`,
      [FILLEULE_ID],
    )
    expect(result.rows[0]?.parrainee_par).toBe(ACCOMPAGNE_ID)
  })
})

test('[golden-path] confirmParrainageOnSuccess proxy BDD post-paiement @parrainage-symetrique', async () => {
  // SC4 : reproduit l etat BDD final attendu apres confirmParrainageOnSuccess
  // reussi pour parrain accompagne + filleul accompagnant. Verrouille la
  // SHAPE des invariants persistes (FR51 + AR-E8.5 + FR54). Stripe Checkout
  // hors-portee Playwright pur (cf. header).

  await ensureAccompagneParrainSetup()

  await withPg(async (client) => {
    // 1. INSERT row parrainages (statut='abonnee', bascule simulee
    //    post-confirmParrainageOnSuccess ligne 1010).
    await client.query(
      `INSERT INTO public.parrainages
         (code, marraine_id, filleule_id, statut, filleule_inscrite_at, filleule_abonnee_at)
       VALUES ($1, $2, $3, 'abonnee', now() - interval '1 hour', now())`,
      [PARRAINAGE_CODE_TEST, ACCOMPAGNE_ID, FILLEULE_ID],
    )

    // 2. INSERT subscriptions filleule (simule paiement Stripe reussi).
    //    stripe_subscription_id prefix `sub_e2e_syme` pour eligibilite cleanup afterAll.
    await client.query(
      `INSERT INTO public.subscriptions (
         user_id, stripe_customer_id, stripe_subscription_id, stripe_price_id,
         status, plan_type, current_period_start, current_period_end, first_subscription_date
       )
       VALUES ($1, 'cus_e2e_syme', 'sub_e2e_syme_1', 'price_seed_dummy',
               'active', 'mensuel', now() - interval '1 day', now() + interval '29 days', now() - interval '1 day')`,
      [FILLEULE_ID],
    )

    // 3. UPDATE accompagnants_profiles : validation_status='valide',
    //    validation_source='parrainage' (FR51 bypass visio applique).
    //    Le seed force deja validation_status='valide' (no-op), validation_source='manuelle' par defaut.
    await client.query(
      `UPDATE public.accompagnants_profiles
          SET validation_status = 'valide',
              validation_source = 'parrainage',
              validation_date = now()
        WHERE user_id = $1`,
      [FILLEULE_ID],
    )

    // 4. INSERT parrainages_codes filleul (AR-E8.5 : filleul devient parrain).
    //    PRIMARY KEY (user_id) + UNIQUE (code).
    await client.query(
      `INSERT INTO public.parrainages_codes (user_id, code, compteur_confirmes, total_recompenses)
       VALUES ($1, $2, 0, 0)
       ON CONFLICT (user_id) DO UPDATE
         SET code = EXCLUDED.code,
             compteur_confirmes = 0,
             total_recompenses = 0`,
      [FILLEULE_ID, FILLEUL_CODE_GEN],
    )

    // 5. Asserts BDD : shape attendue post-confirm.
    // 5a. parrainages.statut = 'abonnee' (transition inscrite -> abonnee).
    const parrainage = await client.query<{
      statut: string
      marraine_id: string
      filleule_id: string | null
    }>(
      `SELECT statut, marraine_id, filleule_id FROM public.parrainages WHERE code = $1`,
      [PARRAINAGE_CODE_TEST],
    )
    expect(parrainage.rows).toHaveLength(1)
    expect(parrainage.rows[0]?.statut).toBe('abonnee')
    expect(parrainage.rows[0]?.marraine_id).toBe(ACCOMPAGNE_ID)
    expect(parrainage.rows[0]?.filleule_id).toBe(FILLEULE_ID)

    // 5b. accompagnants_profiles : validation_status='valide' +
    //     validation_source='parrainage' (FR51 bypass visio).
    const profile = await client.query<{
      validation_status: string
      validation_source: string
    }>(
      `SELECT validation_status, validation_source
         FROM public.accompagnants_profiles
        WHERE user_id = $1`,
      [FILLEULE_ID],
    )
    expect(profile.rows).toHaveLength(1)
    expect(profile.rows[0]?.validation_status).toBe('valide')
    expect(profile.rows[0]?.validation_source).toBe('parrainage')

    // 5c. parrainages_codes : code filleul genere (AR-E8.5 filleul devient parrain).
    const filleulCode = await client.query<{
      code: string
      compteur_confirmes: number
    }>(
      `SELECT code, compteur_confirmes
         FROM public.parrainages_codes
        WHERE user_id = $1`,
      [FILLEULE_ID],
    )
    expect(filleulCode.rows).toHaveLength(1)
    expect(filleulCode.rows[0]?.code).toBe(FILLEUL_CODE_GEN)
    expect(filleulCode.rows[0]?.compteur_confirmes).toBe(0)
  })
})
