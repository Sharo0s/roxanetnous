// Story 9.B.1 : E2E RGPD — cascade suppression compte 3 roles (heritee 7.C.3).
//
// Trois scenarios :
//   SC1 [@rgpd-cascade] suppression compte accompagnant -> cascades BDD.
//   SC2 [@rgpd-cascade] suppression compte accompagne  -> cascades BDD.
//   SC3 [@rgpd-cascade] suppression compte admin       -> refus applicatif.
//
// Strategie SC1/SC2 (BDD directe) :
//   Creer des users ephemeres (email e2e-rgpd-*) via pg client dans public.users
//   + tables profil associees. Executer DELETE public.users WHERE id=... via pg.
//   Asserter les cascades (CASCADE -> 0 rows) et SET NULL (marraine_id, filleule_id,
//   parrainee_par -> NULL) directement via SELECT pg.
//   La strategie BDD directe heritee de 7.C.2/8.D.1 evite de toucher les seed users
//   permanents et rend les assertions atomiques sans race UI.
//
// Strategie SC3 (UI) :
//   Creer un admin ephemere via pg client. Login en tant qu'admin seed.
//   Naviguer vers /admin/utilisateurs/[id-admin-ephemere]. Cliquer "Supprimer cet
//   utilisateur" -> "Confirmer la suppression". Asserter le message d'erreur
//   role="alert" "Impossible de supprimer un administrateur."
//
// Tableau cascades confirmees par grep migrations :
//   | Table                    | FK               | Comportement ON DELETE |
//   |--------------------------|------------------|------------------------|
//   | accompagnants_profiles   | user_id          | CASCADE                |
//   | accompagnes_profiles     | user_id          | CASCADE                |
//   | subscriptions            | user_id          | CASCADE                |
//   | parrainages_codes        | user_id (PK)     | CASCADE (flag 8.A.0)   |
//   | parrainages.marraine_id  | marraine_id      | SET NULL               |
//   | parrainages.filleule_id  | filleule_id      | SET NULL               |
//   | users.parrainee_par      | parrainee_par    | SET NULL               |
//
// Cleanup : afterAll supprime tous les users email LIKE 'e2e-rgpd-%' (cascades BDD
// gerent les tables dependantes). resetEphemeralRows beforeAll nettoie les residus
// d'un run precedent.

import { test, expect } from '@playwright/test'
import pg from 'pg'
import { createClient as createSupabaseClient } from '@supabase/supabase-js'
import { loginAs } from './_lib/session'
import { resetEphemeralRows, assertLocalPgUrl } from './_lib/fixtures'

const { Client } = pg

const PG_URL =
  process.env.SUPABASE_DB_URL ?? 'postgresql://postgres:postgres@localhost:54322/postgres'

const SUPABASE_URL = process.env.SUPABASE_URL ?? process.env.NEXT_PUBLIC_SUPABASE_URL ?? ''
const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY ?? ''

// Seeds permanents (ne jamais supprimer).
const SEED_ADMIN_ID = '00000000-0000-0000-0000-000000000001'
const SEED_ACCOMPAGNANT_ID = '00000000-0000-0000-0000-000000000002'
const SEED_ACCOMPAGNE_ID = '00000000-0000-0000-0000-000000000003'

// UUIDs ephemeres — fixes pour determinisme (pas de collision avec les 5 seeds 0000...0001-0005).
// Prefixe e2e90 pour differencier des seeds (format UUID valide, hex only).
const EPHEMERAL_ACCOMPAGNANT_ID = '00000000-0000-0000-0000-e2e900000001'
const EPHEMERAL_ACCOMPAGNE_ID = '00000000-0000-0000-0000-e2e900000002'
const EPHEMERAL_ADMIN_ID = '00000000-0000-0000-0000-e2e900000003'

// Emails ephemeres (prefix e2e-rgpd- pour le cleanup afterAll cible).
const EMAIL_ACCOMPAGNANT = 'e2e-rgpd-accompagnant@test.local'
const EMAIL_ACCOMPAGNE = 'e2e-rgpd-accompagne@test.local'
const EMAIL_ADMIN = 'e2e-rgpd-admin@test.local'

async function withPg<T>(fn: (client: pg.Client) => Promise<T>): Promise<T> {
  assertLocalPgUrl(PG_URL)
  const client = new Client({ connectionString: PG_URL, connectionTimeoutMillis: 5_000 })
  await client.connect()
  try {
    return await fn(client)
  } finally {
    await client.end()
  }
}

// Cleanup cible : supprime les users ephemeres (cascades BDD gerent les dependances)
// + reset des colonnes seed qui auraient pu etre posees par les tests (parrainee_par).
async function cleanupEphemeralRgpdUsers(): Promise<void> {
  await withPg(async (client) => {
    // Reset parrainee_par sur les seeds potentiellement modifies par SC1
    await client.query(
      `UPDATE public.users SET parrainee_par = NULL WHERE id IN ($1, $2, $3)`,
      [SEED_ADMIN_ID, SEED_ACCOMPAGNANT_ID, SEED_ACCOMPAGNE_ID],
    )
    // Suppression users ephemeres (cascades gerent les profils, subscriptions, codes)
    await client.query(`DELETE FROM public.users WHERE email LIKE 'e2e-rgpd-%'`)
  })

  // Defensif : supprimer aussi les rows auth.users ephemeres (la cascade
  // public.users -> auth.users ne se declenche pas dans ce sens ; et le contrat
  // FK `public.users.id REFERENCES auth.users(id)` peut nous bloquer au prochain
  // INSERT si auth.users a une row residuelle d un run precedent).
  if (SUPABASE_URL && SERVICE_ROLE_KEY) {
    const supa = createSupabaseClient(SUPABASE_URL, SERVICE_ROLE_KEY, {
      auth: { autoRefreshToken: false, persistSession: false },
    })
    for (const id of [EPHEMERAL_ACCOMPAGNANT_ID, EPHEMERAL_ACCOMPAGNE_ID, EPHEMERAL_ADMIN_ID]) {
      try {
        await supa.auth.admin.deleteUser(id)
      } catch {
        // already deleted -- ignore
      }
    }
  }
}

// Provisionne les 3 rows auth.users requises par les FK `public.users.id
// REFERENCES auth.users(id)` -- les INSERTs directs SC1/SC2/SC3 sur public.users
// echoueraient sinon avec users_id_fkey violation. Le trigger handle_new_user
// cree automatiquement la row public.users + accompagnants_profiles ou
// accompagnes_profiles selon le role -- ce qui est compatible avec les
// ON CONFLICT (id) DO NOTHING / UPDATE des SC.
async function provisionEphemeralAuthUsers(): Promise<void> {
  if (!SUPABASE_URL || !SERVICE_ROLE_KEY) return
  const supa = createSupabaseClient(SUPABASE_URL, SERVICE_ROLE_KEY, {
    auth: { autoRefreshToken: false, persistSession: false },
  })
  const provisions = [
    { id: EPHEMERAL_ACCOMPAGNANT_ID, email: EMAIL_ACCOMPAGNANT, role: 'accompagnant', last_name: 'RGPDAcc' },
    { id: EPHEMERAL_ACCOMPAGNE_ID, email: EMAIL_ACCOMPAGNE, role: 'accompagne', last_name: 'RGPDAcc2' },
    { id: EPHEMERAL_ADMIN_ID, email: EMAIL_ADMIN, role: 'admin', last_name: 'RGPDAdmin' },
  ] as const
  for (const p of provisions) {
    const { error } = await supa.auth.admin.createUser({
      id: p.id,
      email: p.email,
      password: 'e2e-rgpd-pwd-1234',
      email_confirm: true,
      user_metadata: { role: p.role, first_name: 'E2E', last_name: p.last_name },
    })
    if (error && !error.message?.includes('already') && !error.message?.includes('duplicate')) {
      throw new Error(`provisionEphemeralAuthUsers(${p.email}) echec : ${error.message}`)
    }
  }

  // Le trigger handle_new_user (supabase/migrations/20260513194300:259-263) ne
  // supporte que role IN ('accompagnant', 'accompagne') -- 'admin' fallback en
  // 'accompagne'. On force le bon role + nettoie les profils accompagnes crees
  // a tort par le trigger pour l admin (FK CASCADE prendra le relais).
  await withPg(async (client) => {
    await client.query(
      `UPDATE public.users SET role = 'accompagnant'::public.user_role,
         first_name = 'E2E', last_name = 'RGPDAcc' WHERE id = $1`,
      [EPHEMERAL_ACCOMPAGNANT_ID],
    )
    // Si trigger a cree accompagnes_profiles a tort (role='accompagnant' n est
    // pas dans la whitelist du trigger ancien runs Supabase --> safety).
    await client.query(
      `DELETE FROM public.accompagnes_profiles WHERE user_id = $1`,
      [EPHEMERAL_ACCOMPAGNANT_ID],
    )
    await client.query(
      `INSERT INTO public.accompagnants_profiles (user_id, validation_status)
       VALUES ($1, 'a_completer') ON CONFLICT (user_id) DO NOTHING`,
      [EPHEMERAL_ACCOMPAGNANT_ID],
    )
    // EPHEMERAL_ADMIN_ID : trigger a force accompagne -> reposer role + nettoyer.
    await client.query(
      `UPDATE public.users SET role = 'admin'::public.user_role,
         first_name = 'E2E', last_name = 'RGPDAdmin' WHERE id = $1`,
      [EPHEMERAL_ADMIN_ID],
    )
    await client.query(
      `DELETE FROM public.accompagnes_profiles WHERE user_id = $1`,
      [EPHEMERAL_ADMIN_ID],
    )
  })
}

test.beforeAll(async () => {
  await resetEphemeralRows()
  await cleanupEphemeralRgpdUsers()
  await provisionEphemeralAuthUsers()
})

test.afterAll(async () => {
  await cleanupEphemeralRgpdUsers()
})

test('@rgpd-cascade SC1 — suppression compte accompagnant : cascades BDD', async () => {
  // --- Setup : creer user ephemere accompagnant + profil + parrainage comme marraine ---
  await withPg(async (client) => {
    // User public.users
    await client.query(
      `INSERT INTO public.users (id, email, role, first_name, last_name)
       VALUES ($1, $2, 'accompagnant', 'E2E', 'RGPDAcc')
       ON CONFLICT (id) DO NOTHING`,
      [EPHEMERAL_ACCOMPAGNANT_ID, EMAIL_ACCOMPAGNANT],
    )

    // Profil accompagnant (accompagnants_profiles) -> CASCADE attendu
    await client.query(
      `INSERT INTO public.accompagnants_profiles (user_id, validation_status)
       VALUES ($1, 'a_completer')
       ON CONFLICT (user_id) DO NOTHING`,
      [EPHEMERAL_ACCOMPAGNANT_ID],
    )

    // Code parrainage (parrainages_codes) -> CASCADE attendu (flag 8.A.0)
    await client.query(
      `INSERT INTO public.parrainages_codes (user_id, code, compteur_confirmes, total_recompenses)
       VALUES ($1, 'e2e-test-rgpd1-code', 0, 0)
       ON CONFLICT (user_id) DO NOTHING`,
      [EPHEMERAL_ACCOMPAGNANT_ID],
    )

    // Row parrainage ou l'accompagnant ephemere est marraine (marraine_id) -> SET NULL attendu
    // On utilise le seed accompagne (user3) comme filleule pour ne pas creer un 2e ephemere.
    await client.query(
      `INSERT INTO public.parrainages (id, code, marraine_id, filleule_id, statut)
       VALUES ('00000000-0000-0000-0000-e2e900000011', 'e2e-test-rgpd1', $1, $2, 'en_attente')
       ON CONFLICT (id) DO NOTHING`,
      [EPHEMERAL_ACCOMPAGNANT_ID, SEED_ACCOMPAGNE_ID],
    )
  })

  // Poser parrainee_par sur le seed accompagne dans un try/finally pour garantir
  // le reset meme en cas de crash entre l'UPDATE et le DELETE ephemere.
  await withPg(async (client) => {
    await client.query(
      `UPDATE public.users SET parrainee_par = $1 WHERE id = $2`,
      [EPHEMERAL_ACCOMPAGNANT_ID, SEED_ACCOMPAGNE_ID],
    )
  })
  try {
    // --- Action : DELETE public.users WHERE id = accompagnant ephemere ---
    await withPg(async (client) => {
      await client.query(`DELETE FROM public.users WHERE id = $1`, [EPHEMERAL_ACCOMPAGNANT_ID])
    })

    // --- Asserts cascades ---
    await withPg(async (client) => {
      // users : row supprimee
      const usersResult = await client.query(
        `SELECT id FROM public.users WHERE id = $1`,
        [EPHEMERAL_ACCOMPAGNANT_ID],
      )
      expect(usersResult.rowCount, 'users : row accompagnant ephemere supprimee').toBe(0)

      // accompagnants_profiles : CASCADE -> 0 rows
      const profilesResult = await client.query(
        `SELECT user_id FROM public.accompagnants_profiles WHERE user_id = $1`,
        [EPHEMERAL_ACCOMPAGNANT_ID],
      )
      expect(profilesResult.rowCount, 'accompagnants_profiles : CASCADE -> 0 rows').toBe(0)

      // parrainages_codes : CASCADE (PK) -> 0 rows
      const codesResult = await client.query(
        `SELECT user_id FROM public.parrainages_codes WHERE user_id = $1`,
        [EPHEMERAL_ACCOMPAGNANT_ID],
      )
      expect(codesResult.rowCount, 'parrainages_codes : CASCADE -> 0 rows').toBe(0)

      // parrainages.marraine_id : SET NULL -> marraine_id = NULL sur la row e2e-test-rgpd1
      const parrainagesResult = await client.query(
        `SELECT marraine_id FROM public.parrainages WHERE code = 'e2e-test-rgpd1'`,
      )
      expect(parrainagesResult.rowCount, 'parrainages row e2e-test-rgpd1 existe encore').toBeGreaterThan(0)
      expect(parrainagesResult.rows[0].marraine_id, 'parrainages.marraine_id : SET NULL').toBeNull()

      // users.parrainee_par : SET NULL -> seed accompagne n'a plus parrainee_par
      const parraineeParResult = await client.query(
        `SELECT parrainee_par FROM public.users WHERE id = $1`,
        [SEED_ACCOMPAGNE_ID],
      )
      expect(parraineeParResult.rows[0]?.parrainee_par, 'users.parrainee_par : SET NULL').toBeNull()
    })
  } finally {
    // Reset defensif parrainee_par si le DELETE ou les asserts ont echoue.
    await withPg(async (client) => {
      await client.query(
        `UPDATE public.users SET parrainee_par = NULL WHERE id = $1`,
        [SEED_ACCOMPAGNE_ID],
      )
    })
  }

  // Note : la row parrainage e2e-test-rgpd1 est nettoyee par resetEphemeralRows() du
  // prochain beforeAll (code LIKE 'e2e-test-%'). parrainee_par est resetté par
  // cleanupEphemeralRgpdUsers() en afterAll (defense en profondeur).
})

test('@rgpd-cascade SC2 — suppression compte accompagne : cascades BDD', async () => {
  // --- Setup : creer user ephemere accompagne + profil + subscription + code parrainage ---
  await withPg(async (client) => {
    // User public.users
    await client.query(
      `INSERT INTO public.users (id, email, role, first_name, last_name)
       VALUES ($1, $2, 'accompagne', 'E2E', 'RGPDAcc2')
       ON CONFLICT (id) DO NOTHING`,
      [EPHEMERAL_ACCOMPAGNE_ID, EMAIL_ACCOMPAGNE],
    )

    // Profil accompagne (accompagnes_profiles) -> CASCADE attendu
    await client.query(
      `INSERT INTO public.accompagnes_profiles (user_id)
       VALUES ($1)
       ON CONFLICT (user_id) DO NOTHING`,
      [EPHEMERAL_ACCOMPAGNE_ID],
    )

    // Subscription -> CASCADE attendu
    await client.query(
      `INSERT INTO public.subscriptions (id, user_id, status, stripe_customer_id, stripe_subscription_id)
       VALUES ('00000000-0000-0000-0000-e2e900000021', $1, 'active', 'cus_e2ergpd2', 'sub_e2ergpd2')
       ON CONFLICT (id) DO NOTHING`,
      [EPHEMERAL_ACCOMPAGNE_ID],
    )

    // Code parrainage (accompagne peut en avoir un via parrainage symetrique flag 8.A.0) -> CASCADE attendu
    await client.query(
      `INSERT INTO public.parrainages_codes (user_id, code, compteur_confirmes, total_recompenses)
       VALUES ($1, 'e2e-test-rgpd2-code', 0, 0)
       ON CONFLICT (user_id) DO NOTHING`,
      [EPHEMERAL_ACCOMPAGNE_ID],
    )

    // Row parrainage ou l'accompagne ephemere est filleule (filleule_id) -> SET NULL attendu
    // On utilise le seed accompagnant (user2) comme marraine.
    await client.query(
      `INSERT INTO public.parrainages (id, code, marraine_id, filleule_id, statut)
       VALUES ('00000000-0000-0000-0000-e2e900000022', 'e2e-test-rgpd2', $1, $2, 'en_attente')
       ON CONFLICT (id) DO NOTHING`,
      [SEED_ACCOMPAGNANT_ID, EPHEMERAL_ACCOMPAGNE_ID],
    )
  })

  // --- Action : DELETE public.users WHERE id = accompagne ephemere ---
  await withPg(async (client) => {
    await client.query(`DELETE FROM public.users WHERE id = $1`, [EPHEMERAL_ACCOMPAGNE_ID])
  })

  // --- Asserts cascades ---
  await withPg(async (client) => {
    // users : row supprimee
    const usersResult = await client.query(
      `SELECT id FROM public.users WHERE id = $1`,
      [EPHEMERAL_ACCOMPAGNE_ID],
    )
    expect(usersResult.rowCount, 'users : row accompagne ephemere supprimee').toBe(0)

    // accompagnes_profiles : CASCADE -> 0 rows
    const profilesResult = await client.query(
      `SELECT user_id FROM public.accompagnes_profiles WHERE user_id = $1`,
      [EPHEMERAL_ACCOMPAGNE_ID],
    )
    expect(profilesResult.rowCount, 'accompagnes_profiles : CASCADE -> 0 rows').toBe(0)

    // subscriptions : CASCADE -> 0 rows
    const subsResult = await client.query(
      `SELECT user_id FROM public.subscriptions WHERE stripe_subscription_id = 'sub_e2ergpd2'`,
    )
    expect(subsResult.rowCount, 'subscriptions : CASCADE -> 0 rows').toBe(0)

    // parrainages_codes : CASCADE (PK) -> 0 rows
    const codesResult = await client.query(
      `SELECT user_id FROM public.parrainages_codes WHERE user_id = $1`,
      [EPHEMERAL_ACCOMPAGNE_ID],
    )
    expect(codesResult.rowCount, 'parrainages_codes : CASCADE -> 0 rows (flag 8.A.0)').toBe(0)

    // parrainages.filleule_id : SET NULL -> row parrainage e2e-test-rgpd2 a filleule_id=NULL
    const parrainagesResult = await client.query(
      `SELECT filleule_id FROM public.parrainages WHERE code = 'e2e-test-rgpd2'`,
    )
    expect(parrainagesResult.rowCount, 'parrainages row e2e-test-rgpd2 existe encore').toBeGreaterThan(0)
    expect(parrainagesResult.rows[0].filleule_id, 'parrainages.filleule_id : SET NULL').toBeNull()
  })

  // Note : la row parrainage e2e-test-rgpd2 est nettoyee par resetEphemeralRows() du
  // prochain beforeAll (code LIKE 'e2e-test-%').
})

test('@rgpd-cascade SC3 — suppression compte admin : refus applicatif', async ({ page }) => {
  // --- Setup : creer un admin ephemere via pg client ---
  await withPg(async (client) => {
    await client.query(
      `INSERT INTO public.users (id, email, role, first_name, last_name)
       VALUES ($1, $2, 'admin', 'E2E', 'RGPDAdmin')
       ON CONFLICT (id) DO NOTHING`,
      [EPHEMERAL_ADMIN_ID, EMAIL_ADMIN],
    )
  })

  // --- Naviguer vers la page de l'admin ephemere en etant logue admin seed ---
  await loginAs(page, 'admin')
  await page.goto(`/admin/utilisateurs/${EPHEMERAL_ADMIN_ID}`)

  // Attendre que la page soit chargee (le composant DeleteUserButton doit etre present)
  const deleteButton = page.getByRole('button', { name: 'Supprimer cet utilisateur' })
  await expect(deleteButton).toBeVisible({ timeout: 10_000 })

  // Cliquer "Supprimer cet utilisateur" -> passage en mode confirmation
  await deleteButton.click()

  // Cliquer "Confirmer la suppression"
  const confirmButton = page.getByRole('button', { name: 'Confirmer la suppression' })
  await expect(confirmButton).toBeVisible({ timeout: 5_000 })
  await confirmButton.click()

  // Asserter le message d erreur role="alert". Next.js injecte un announcer
  // <div role="alert" id="__next-route-announcer__"> dans le DOM, donc
  // getByRole('alert') matche 2 elements en strict mode. On filtre sur le
  // texte attendu pour cibler le <p role="alert"> applicatif.
  const errorAlert = page
    .getByRole('alert')
    .filter({ hasText: 'Impossible de supprimer un administrateur.' })
  await expect(errorAlert).toBeVisible({ timeout: 10_000 })
  await expect(errorAlert).toHaveText('Impossible de supprimer un administrateur.')

  // Verifier que l'admin ephemere est toujours present en BDD (non supprime)
  await withPg(async (client) => {
    const result = await client.query(
      `SELECT id, role FROM public.users WHERE id = $1`,
      [EPHEMERAL_ADMIN_ID],
    )
    expect(result.rowCount, 'admin ephemere toujours present en BDD (non supprime)').toBe(1)
    expect(result.rows[0].role).toBe('admin')
  })

  // L'afterAll cleanupEphemeralRgpdUsers supprimera EPHEMERAL_ADMIN_ID via
  // DELETE FROM public.users WHERE email LIKE 'e2e-rgpd-%'.
})
