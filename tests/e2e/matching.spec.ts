// Story 9.B.2 : E2E matching (basique + notif email + soft paywall) -- heritee 7.C.4.
//
// Trois scenarios :
//   SC1 [@matching] matching basique apparition annonce dans /recherche.
//   SC2 [@matching] notification email matching + idempotence notifications_log.
//   SC3 [@matching] soft paywall : accompagne non-abonne redirige vers /accompagne/abonnement
//                   lorsqu il tente d acceder a une fiche /recherche/[id].
//
// --- Strategie SC1 ---
// On reutilise SEED_ACCOMPAGNANT (user2) comme proprietaire de l annonce. Il a deja
// accompagnants_profiles.validation_status = 'valide' + subscription active future
// (current_period_end now()+25d) seedees par scripts/seed-test-supabase.mjs +
// supabase/seeds/01_users.sql / 04_subscriptions.sql. On insere une annonce
// ephemere (titre `e2e-test-match-rennes-*`, ville=Rennes, code_postal=35000,
// status='publiee'). Resultat : l annonce doit apparaitre dans /recherche?ville=Rennes
// pour un user connecte (ici loginAs admin pour eviter le gate paywall de /recherche/[id]
// -- la page liste /recherche n a pas de gate paywall, mais charger le formulaire
// /login -> /recherche se passe mieux avec un user authentifie).
// Cleanup : resetEphemeralRows() supprime annonces titre LIKE 'e2e-test-%'.
//
// --- Strategie SC2 ---
// Pas de mock Resend (la cle Resend test bounce les *.local silencieusement).
// On cree un accompagne ephemere via supabase.auth.admin.createUser (necessaire pour
// que public.users existe via trigger handle_new_user) + accompagnes_profiles +
// annonces_accompagnes publiee Rennes 35000 spec 'Personnes agees'. Puis on loginAs
// SEED_ACCOMPAGNANT et on remplit le formulaire /accompagnant/annonces/nouvelle
// (parcours UI reel, qui declenche notifyMatchingUsers fire-and-forget app/actions/annonces.ts:95).
// On poll notifications_log (timeout 15s) pour user_id=EPHEMERAL_ACCOMPAGNE_TARGET_ID
// type='matching_nouveau_profil_accompagnant'.
//
// Idempotence : on creer une 2e annonce identique dans la meme heure UTC --
// l index partial UNIQUE `notifications_log_unique_sent_by_hour` (story 7.A.6) sur
// (COALESCE(user_id::text, email), type, subject, hour-bucket) declenche un 23505
// silence-skip dans logNotification. Resultat attendu : count rows reste = 1
// dans la fenetre horaire. Le matching helper filtre MINIMUM_SCORE=50 -- on aligne
// les criteres (memes specialites, meme ville, meme CP) pour score eleve.
//
// --- Strategie SC3 ---
// Le soft paywall reel actuel est implemente au niveau de la PAGE detail (gate
// app/recherche/[id]/page.tsx:50-53 : redirect /accompagne/abonnement si role=accompagne
// sans subscription active). Le composant ContactButton avec subscribed=false n est
// jamais exerce via ce parcours (subscribed=true est toujours passe -- defense en
// profondeur uniquement). L epic-9 evoquait "clic Contacter -> redirect paywall" --
// le contrat reel est "navigation vers la fiche -> redirect paywall".
// On adapte SC3 a la realite : loginAs SEED_ACCOMPAGNE (sub seedee active mais expiree
// current_period_end=now()-1d -> hasActiveSubscription=false), goto /recherche/[id],
// assert URL=/accompagne/abonnement.
//
// --- UUIDs ephemeres reserves 9.B.2 ---
// Prefixe e2e9000000{40-49} pour ne pas entrer en collision avec 9.B.1 ({01-03,11,21,22}).

import { test, expect } from '@playwright/test'
import pg from 'pg'
import { createClient } from '@supabase/supabase-js'
import { loginAs } from './_lib/session'
import { resetEphemeralRows, assertLocalPgUrl } from './_lib/fixtures'

const { Client } = pg

const PG_URL =
  process.env.SUPABASE_DB_URL ?? 'postgresql://postgres:postgres@localhost:54322/postgres'

const SUPABASE_URL = process.env.SUPABASE_URL ?? process.env.NEXT_PUBLIC_SUPABASE_URL ?? ''
const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY ?? ''

// Seeds permanents (ne jamais supprimer).
const SEED_ACCOMPAGNANT_ID = '00000000-0000-0000-0000-000000000002'
const SEED_ACCOMPAGNE_ID = '00000000-0000-0000-0000-000000000003'

// UUIDs ephemeres reserves 9.B.2 (prefix e2e90000004x).
const EPHEMERAL_ACCOMPAGNE_TARGET_ID = '00000000-0000-0000-0000-e2e900000040'
const EPHEMERAL_ANNONCE_BEN_ID = '00000000-0000-0000-0000-e2e900000043'
const EPHEMERAL_ANNONCE_AUX_SC1_ID = '00000000-0000-0000-0000-e2e900000044'

const EMAIL_ACCOMPAGNE_TARGET = 'e2e-match-target@test.local'

// Criteres SC1/SC2 alignes pour score matching >= MINIMUM_SCORE=50 (lib/matching-notifications.ts:20).
const VILLE = 'Rennes'
const CODE_POSTAL = '35000'
const SPECIALITES = ['Personnes agees'] // doit matcher seed accompagnants_profiles.specialites (01_users.sql:48).

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

// Cleanup ciblé : supprime les rows ephemeres SC1/SC2 + les rows notifications_log
// liees aux emails ephemeres. resetEphemeralRows() nettoie en parallele les annonces
// titre LIKE 'e2e-test-%'.
async function cleanupEphemeralMatchingUsers(): Promise<void> {
  await withPg(async (client) => {
    // notifications_log : nettoyage cible (email LIKE 'e2e-match-%' OU user_id ephemere).
    await client.query(
      `DELETE FROM public.notifications_log
       WHERE email LIKE 'e2e-match-%' OR user_id = $1`,
      [EPHEMERAL_ACCOMPAGNE_TARGET_ID],
    )
    // Annonces ephemeres (defensif, doublon avec resetEphemeralRows).
    await client.query(`DELETE FROM public.annonces_accompagnants WHERE titre LIKE 'e2e-test-match-%'`)
    await client.query(`DELETE FROM public.annonces_accompagnes WHERE titre LIKE 'e2e-test-match-%'`)
    // public.users ephemere -> cascade accompagnes_profiles + annonces_accompagnes restantes.
    await client.query(`DELETE FROM public.users WHERE email LIKE 'e2e-match-%'`)
  })

  // auth.users ephemere : retirer via Supabase Admin API (necessaire car createUser
  // a cree une row auth.users qui ne casse pas en cascade depuis public.users).
  if (SUPABASE_URL && SERVICE_ROLE_KEY) {
    const supa = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, {
      auth: { autoRefreshToken: false, persistSession: false },
    })
    try {
      await supa.auth.admin.deleteUser(EPHEMERAL_ACCOMPAGNE_TARGET_ID)
    } catch {
      // already deleted -- ignore
    }
  }
}

test.beforeAll(async () => {
  await resetEphemeralRows()
  await cleanupEphemeralMatchingUsers()
})

test.afterAll(async () => {
  await cleanupEphemeralMatchingUsers()
})

test('@matching SC1 -- annonce accompagnant apparait dans /recherche?ville=Rennes', async ({
  page,
}) => {
  // --- Setup : recuperer le profile_id du seed accompagnant (FK annonces_accompagnants).
  const accompagnantProfileId = await withPg(async (client) => {
    const res = await client.query(
      `SELECT id FROM public.accompagnants_profiles WHERE user_id = $1`,
      [SEED_ACCOMPAGNANT_ID],
    )
    if (res.rowCount === 0) {
      throw new Error(
        'SEED_ACCOMPAGNANT n a pas de accompagnants_profiles -- relancer npm run seed:test.',
      )
    }
    return res.rows[0].id as string
  })

  // --- Setup : INSERT annonce ephemere proprietaire = seed accompagnant.
  await withPg(async (client) => {
    await client.query(
      `INSERT INTO public.annonces_accompagnants
         (id, accompagnant_id, titre, description, ville, code_postal, rayon_km,
          status, published_at, created_at, updated_at)
       VALUES ($1, $2, $3, $4, $5, $6, 10, 'publiee', now(), now(), now())
       ON CONFLICT (id) DO UPDATE SET status='publiee', published_at=now(), updated_at=now()`,
      [
        EPHEMERAL_ANNONCE_AUX_SC1_ID,
        accompagnantProfileId,
        'e2e-test-match-rennes-sc1',
        'e2e-test-match-rennes-sc1 description',
        VILLE,
        CODE_POSTAL,
      ],
    )
  })

  // --- Action : loginAs admin (evite tout gate accompagne/abonnement) puis /recherche.
  // La page liste /recherche n a pas de gate paywall pour accompagne ; admin convient aussi.
  // Filtre `?ville=Rennes` declenche le SELECT cote serveur (hasFilters=true).
  await loginAs(page, 'admin')
  await page.goto(`/recherche?ville=${encodeURIComponent(VILLE)}`)

  // --- Assert : l annonce ephemere apparait dans la grille. Le selector le plus stable
  // d apres components/recherche/infinite-annonces-grid.tsx est la card englobante --
  // mais on n a pas de data-testid. On asserte la presence du seed-Accompagnant
  // (prenom Seed + initiale A) via le heading ou via une approximation textuelle :
  // chaque card affiche `${first_name} ${last_name?.[0]}.` -> "Seed A." pour l accompagnant.
  // On cible la presence du libelle ville (35000) qui est aussi rendu dans la card.
  // -- approche : compter les cards Rennes (35000) >= 1.
  await expect(page.getByText(`${VILLE} (${CODE_POSTAL})`).first()).toBeVisible({
    timeout: 15_000,
  })
})

test('@matching SC2 -- notification email matching + idempotence notifications_log', async ({
  page,
}) => {
  test.skip(
    !SUPABASE_URL || !SERVICE_ROLE_KEY,
    'SC2 requiert SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY (createUser ephemere).',
  )

  // --- Setup : creer accompagne ephemere cible (destinataire de la notif) via auth.admin.
  const supa = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, {
    auth: { autoRefreshToken: false, persistSession: false },
  })
  const { error: createErr } = await supa.auth.admin.createUser({
    id: EPHEMERAL_ACCOMPAGNE_TARGET_ID,
    email: EMAIL_ACCOMPAGNE_TARGET,
    password: 'e2e-match-target-pwd',
    email_confirm: true,
    user_metadata: { role: 'accompagne', first_name: 'E2E', last_name: 'MatchTarget' },
  })
  if (createErr && !createErr.message?.includes('already')) {
    throw new Error(`createUser ephemere echec : ${createErr.message}`)
  }

  // Enrichir public.users + accompagnes_profiles + annonce accompagne publiee.
  const accompagneProfileId = await withPg(async (client) => {
    // Le trigger handle_new_user a deja cree public.users + accompagnes_profiles.
    await client.query(
      `UPDATE public.users SET role='accompagne', first_name='E2E', last_name='MatchTarget'
       WHERE id = $1`,
      [EPHEMERAL_ACCOMPAGNE_TARGET_ID],
    )
    const prof = await client.query(
      `SELECT id FROM public.accompagnes_profiles WHERE user_id = $1`,
      [EPHEMERAL_ACCOMPAGNE_TARGET_ID],
    )
    if (prof.rowCount === 0) {
      // Fallback : trigger n'a pas cree le profil (cas edge), on insere manuellement.
      const ins = await client.query(
        `INSERT INTO public.accompagnes_profiles (user_id)
         VALUES ($1) RETURNING id`,
        [EPHEMERAL_ACCOMPAGNE_TARGET_ID],
      )
      return ins.rows[0].id as string
    }
    return prof.rows[0].id as string
  })

  // Annonce accompagne publiee Rennes 35000 spec 'Personnes agees' (cible matching).
  await withPg(async (client) => {
    await client.query(
      `INSERT INTO public.annonces_accompagnes
         (id, accompagne_id, titre, description, specialites_recherchees, ville,
          code_postal, status, published_at, created_at, updated_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7, 'publiee', now(), now(), now())
       ON CONFLICT (id) DO UPDATE SET status='publiee', published_at=now(), updated_at=now()`,
      [
        EPHEMERAL_ANNONCE_BEN_ID,
        accompagneProfileId,
        'e2e-test-match-target-rennes',
        'e2e-test-match-target-rennes description',
        SPECIALITES,
        VILLE,
        CODE_POSTAL,
      ],
    )
  })

  // --- Action : loginAs seed accompagnant + creer annonce accompagnant via UI reelle.
  // Le succes de createAnnonceAccompagnante (app/actions/annonces.ts) declenche
  // notifyMatchingUsers fire-and-forget -> logNotification matching_*.
  await loginAs(page, 'accompagnant')
  await page.goto('/accompagnant/annonces/nouvelle')

  // Description.
  await page
    .locator('textarea')
    .first()
    .fill('e2e-test-match-sc2 description annonce matching accompagnant Rennes Personnes agees')

  // CityAutocomplete : 2 inputs (ville + code postal). Les <label> n ont pas d
  // attribut htmlFor (dette a11y latente), donc page.getByLabel echoue. On cible
  // via les placeholders stables (components/ui/city-autocomplete.tsx:154,174).
  const villeInput = page.locator('input[placeholder="Paris"]')
  const cpInput = page.locator('input[placeholder="75001"]')
  await villeInput.fill(VILLE)
  await cpInput.fill(CODE_POSTAL)

  // Submit : bouton "Publier l'annonce".
  await page.getByRole('button', { name: /Publier l['']annonce/i }).click()

  // Apres submit reussi, redirect /accompagnant/annonces.
  await expect(page).toHaveURL(/\/accompagnant\/annonces($|\/)/, { timeout: 20_000 })

  // --- Polling notifications_log -- fire-and-forget peut prendre quelques secondes.
  const matchingType = 'matching_nouveau_profil_accompagnant'
  const deadline = Date.now() + 20_000
  let count = 0
  while (Date.now() < deadline) {
    count = await withPg(async (client) => {
      const res = await client.query(
        `SELECT count(*)::int AS c FROM public.notifications_log
         WHERE user_id = $1 AND type = $2 AND status = 'sent'`,
        [EPHEMERAL_ACCOMPAGNE_TARGET_ID, matchingType],
      )
      return Number(res.rows[0].c)
    })
    if (count >= 1) break
    await new Promise((r) => setTimeout(r, 500))
  }
  expect(count, 'notifications_log: row matching_nouveau_profil_accompagnant inseree').toBeGreaterThanOrEqual(1)

  // --- Idempotence : creer une 2e annonce identique dans la meme heure.
  // L index partial UNIQUE notifications_log_unique_sent_by_hour (story 7.A.6) sur
  // (COALESCE(user_id::text, email), type, subject, hour-bucket) capture 23505
  // silencieusement dans logNotification. Resultat attendu : count reste = 1
  // dans la fenetre horaire courante.
  await page.goto('/accompagnant/annonces/nouvelle')
  await page
    .locator('textarea')
    .first()
    .fill('e2e-test-match-sc2-bis description duplicate hour-bucket')
  await page.locator('input[placeholder="Paris"]').fill(VILLE)
  await page.locator('input[placeholder="75001"]').fill(CODE_POSTAL)
  await page.getByRole('button', { name: /Publier l['']annonce/i }).click()
  await expect(page).toHaveURL(/\/accompagnant\/annonces($|\/)/, { timeout: 20_000 })

  // Attendre que la 2e fire-and-forget se propage (ou soit deduppee).
  await new Promise((r) => setTimeout(r, 3_000))

  const countAfterDup = await withPg(async (client) => {
    const res = await client.query(
      `SELECT count(*)::int AS c FROM public.notifications_log
       WHERE user_id = $1 AND type = $2 AND status = 'sent'
         AND date_trunc('hour', COALESCE(sent_at, created_at) AT TIME ZONE 'UTC') =
             date_trunc('hour', now() AT TIME ZONE 'UTC')`,
      [EPHEMERAL_ACCOMPAGNE_TARGET_ID, matchingType],
    )
    return Number(res.rows[0].c)
  })
  expect(
    countAfterDup,
    'notifications_log: idempotence partial UNIQUE INDEX 7.A.6 capture 23505 -- count reste = 1 dans le bucket horaire',
  ).toBe(1)
})

test('@matching SC3 -- soft paywall : accompagne non-abonne redirige vers /accompagne/abonnement', async ({
  page,
}) => {
  // --- Setup : assurer une annonce SEED_ACCOMPAGNANT visible (reutilise SC1 ou recree).
  const accompagnantProfileId = await withPg(async (client) => {
    const res = await client.query(
      `SELECT id FROM public.accompagnants_profiles WHERE user_id = $1`,
      [SEED_ACCOMPAGNANT_ID],
    )
    if (res.rowCount === 0) {
      throw new Error(
        'SEED_ACCOMPAGNANT n a pas de accompagnants_profiles -- relancer npm run seed:test.',
      )
    }
    return res.rows[0].id as string
  })

  await withPg(async (client) => {
    await client.query(
      `INSERT INTO public.annonces_accompagnants
         (id, accompagnant_id, titre, description, ville, code_postal, rayon_km,
          status, published_at, created_at, updated_at)
       VALUES ($1, $2, $3, $4, $5, $6, 10, 'publiee', now(), now(), now())
       ON CONFLICT (id) DO UPDATE SET status='publiee', published_at=now(), updated_at=now()`,
      [
        EPHEMERAL_ANNONCE_AUX_SC1_ID,
        accompagnantProfileId,
        'e2e-test-match-rennes-sc3',
        'e2e-test-match-rennes-sc3 description',
        VILLE,
        CODE_POSTAL,
      ],
    )
  })

  // --- Pre-condition : SEED_ACCOMPAGNE doit etre non-abonne. Le seed
  // supabase/seeds/04_subscriptions.sql lui pose status='active' mais
  // current_period_end = now()-1d -> hasActiveSubscription() retourne false.
  // Defense en profondeur : forcer cette etat ici (idempotent).
  await withPg(async (client) => {
    await client.query(
      `UPDATE public.subscriptions
       SET current_period_end = now() - interval '1 day'
       WHERE user_id = $1`,
      [SEED_ACCOMPAGNE_ID],
    )
  })

  // --- Action : loginAs accompagne (non-abonne) + tenter d acceder a la fiche.
  await loginAs(page, 'accompagne')
  await page.goto(`/recherche/${EPHEMERAL_ANNONCE_AUX_SC1_ID}`)

  // --- Assert : redirect vers /accompagne/abonnement (gate paywall page-level).
  await expect(page).toHaveURL(/\/accompagne\/abonnement(\?.*)?$/, { timeout: 15_000 })
})
