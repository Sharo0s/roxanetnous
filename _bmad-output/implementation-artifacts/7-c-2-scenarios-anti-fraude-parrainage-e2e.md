# Story 7.C.2 : Scenarios anti-fraude parrainage E2E

Status: done

<!-- Note: Validation is optional. Run validate-create-story for quality check before dev-story. -->

## Story

As a responsable qualite roxanetnous (Sylvain, mainteneur solo),
I want des tests E2E Playwright qui couvrent les 3 scenarios anti-fraude parrainage (blacklist `meme_email`, flag `meme_ip`, bypass visio filleule sur `/onboarding`),
so that toute regression dans la mecanique anti-fraude ou le bypass d'onboarding filleule est detectee automatiquement avant merge, et que le harness infra E2E pose par 7.C.1 est exerce sur un vrai parcours metier.

## Acceptance Criteria

1. **AC1 - Fichier `tests/e2e/parrainage-anti-fraude.spec.ts` cree et vert en GHA** : couvre exactement 3 scenarios decrits en AC2/AC3/AC4. Le fichier utilise les helpers `loginAs` (session.ts), `resetEphemeralRows` (fixtures.ts) et le pg client direct pour inserer les fixtures necessaires. Titre de spec dans le nom de chaque test avec prefix `[anti-fraude]`.

2. **AC2 - Scenario `blacklist auto-detect meme_email`** : 
   - La marraine seed (user 4, `seed-marraine@test.local`, uuid `00000000-0000-0000-0000-000000000004`) a deja un code parrainage (`TESTSEED1`) pose par `02_parrainages.sql`. Ce code est valide et actif.
   - Le test insere via pg client une row `parrainages` avec `code='TESTSEED1'`, `marraine_id=user4`, `filleule_id=null` (non encore resolue), `statut='inscrite'` — simulant une inscription en cours.
   - Le test appelle la server action `createParrainageRelation` via fetch POST sur l'API interne avec `filleuleEmail = seed-marraine@test.local` (email identique a la marraine) et verifie que la reponse retourne `{ ok: false, reason: 'blacklist_meme_email' }`.
   - **Alternative implementation** : si l'appel server action direct via fetch est trop complexe en E2E, utiliser la verification BDD directe post-flow : inserer la row avec statut `'bloque'` + `blocage_raison='meme_email'` et verifier via `SELECT` pg que l'etat est coherent. Dans ce cas, le test documente cette strategie dans un commentaire.
   - **Assert BDD** : la row `parrainages` insertee par le test (prefix `e2e-test-` dans le code) a `statut='bloque'` et `blocage_raison='meme_email'`.
   - **Assert admin_actions_log** : une row `admin_actions_log` avec `action_type='parrainage_bloque'` et `details->>'raison'='meme_email'` existe pour ce `target_id`.
   - **Nettoyage** : `resetEphemeralRows()` appele en `afterEach` ou `afterAll` pour supprimer les rows `parrainages` avec code LIKE `'e2e-test-%'`.

3. **AC3 - Scenario `flag meme_ip`** :
   - La marraine seed (user 4) a deja un parrainage `inscrite` (seed `00000000-0000-0000-0000-00000000aaa1`) avec `ip_inscription` positionne.
   - Le test insere une 2e row `parrainages` avec `code='e2e-test-meme-ip'`, `marraine_id=user4`, `filleule_id=user5` (ou null), `ip_inscription` = meme IP que la row aaa1, `statut='inscrite'`.
   - Le test verifie via SELECT pg que la detection `meme_ip` a pose `blacklist_suspicion` JSONB contenant `{flags: ['meme_ip']}` (via RPC `merge_parrainage_flag_suspicion`) OU que la row a ete marque de facon attendue selon l'implementation (voir `app/actions/parrainage.ts:700-720` pour le pattern exact).
   - **Strategie acceptable si RPC non trigerable en E2E** : inserer directement la row avec `blacklist_suspicion = '{"flags":["meme_ip"]}'::jsonb` et verifier via SELECT que la valeur est bien presente — le test valide alors l'etat attendu plutot que le declenchement de la logique.
   - **Assert** : la row insertee a `blacklist_suspicion` non null contenant le flag `'meme_ip'`.
   - **Nettoyage** : `resetEphemeralRows()`.

4. **AC4 - Scenario `bypass visio filleule : step visio skip sur /onboarding`** :
   - La filleule seed (user 5, `seed-filleule@test.local`, uuid `00000000-0000-0000-0000-000000000005`) a deja `parrainee_par = user4` positionne par le seed `02_parrainages.sql` (via la row `inscrite aaa1`).
   - **Pre-condition critique** : le seed `01_users.sql` ne pose PAS `parrainee_par` sur user5 explicitement. Verifier via SELECT si la colonne est nulle ou non. Si nulle, la positionner en setup du test via UPDATE pg direct : `UPDATE public.users SET parrainee_par = '...-000000000004' WHERE id = '...-000000000005'`.
   - Le test `loginAs(page, 'filleule')` puis navigue vers `/accompagnant/onboarding`.
   - **Assert UI** : la page affiche le message de bypass visio, c'est-a-dire le texte `"Pour finaliser votre inscription, complétez vos disponibilités et souscrivez votre abonnement — pas de pièces justificatives ni de visio à fournir."` (cf. `components/accompagnant/onboarding-client.tsx:187`).
   - **Assert UI** : le composant `OnboardingClient` est en mode `isFilleule=true`, ce qui signifie que le Step 0 (diplomes) n'exige PAS les uploads CV/justificatifs. Verifier via assertion sur le texte du paragraphe ou l'absence du champ upload diplome (selector `input[type="file"]` est absent ou non visible en step 0).
   - **Assert BDD** : `SELECT parrainee_par FROM public.users WHERE id='00000000-0000-0000-0000-000000000005'` retourne un UUID non null.
   - **Reset** : ne PAS reset `parrainee_par` (c'est un champ seed stable) — uniquement `resetEphemeralRows()` pour les rows de parrainage ephemeres crees par ce test.

5. **AC5 - Isolation stricte entre tests** :
   - Chaque test appelle `await resetEphemeralRows()` dans un `afterEach` ou `afterAll`.
   - Les 5 seed users (UUIDs `...0001` a `...0005`) ne sont JAMAIS deletes ni modifies sauf `parrainee_par` en setup AC4 (et seulement si la valeur etait deja nulle).
   - Toute row `parrainages` creee par les tests utilise `code LIKE 'e2e-test-%'` pour etre eligible au cleanup `resetEphemeralRows()`.

6. **AC6 - Workflow GHA `e2e-tests.yml` execute ces specs** :
   - Le fichier `e2e-tests.yml` cree par 7.C.1 est inchange (il execute `npm run test:e2e` qui cible `testDir: './tests/e2e'` via `playwright-e2e.config.ts`). Le nouveau fichier spec est automatiquement inclus sans configuration supplementaire.
   - Le run GHA doit passer avec les 3 nouveaux tests verts + le smoke test existant (4 tests totaux).
   - **2 runs GHA consecutifs verts avant merge** (heritage AC8 de 7.C.1, meme pattern).

7. **AC7 - Validation pre-commit** :
   - `npm run lint` exit 0.
   - `npm run lint:a11y-check` exit 0 (baseline ≤ 158, aucun changement UI).
   - `npm run a11y:axe:check` exit 0 (regle CLAUDE.md durcie, obligatoire meme sans impact UI).
   - `npm run test:unit` exit 0.
   - `npm run check:no-direct-notifications-log-insert` exit 0.
   - `npm run build` exit 0.

## Tasks / Subtasks

- [x] **T1 - Analyser l'etat BDD du seed filleule (user 5) pour AC4** (prerequis)
  - [x] T1.1 - Via SELECT pg (`psql` ou script) : verifier si `users.parrainee_par` de user5 (`00000000-0000-0000-0000-000000000005`) est non null apres application du seed `02_parrainages.sql`. **Resultat** : NULL (verifie statiquement via lecture du seed `02_parrainages.sql` + code `createParrainageRelation` app/actions/parrainage.ts:581-594 — le seed insere la row parrainages aaa1 mais ne fait pas UPDATE users.parrainee_par, seul le code serveur le fait).
  - [x] T1.2 - Si null : preparer un UPDATE pg dans le setup du test AC4 (`test.beforeEach` ou `test.beforeAll`). Pose en debut de test via `withPg + UPDATE`.
  - [x] T1.3 - Documenter dans un commentaire de la spec le resultat de cette verification. Documente en commentaire (cf. spec L18-24 + L196-204).

- [x] **T2 - Creer `tests/e2e/parrainage-anti-fraude.spec.ts`** (AC: #1, #2, #3, #4, #5)
  - [x] T2.1 - En-tete du fichier : importer `test, expect` de `@playwright/test`, `resetEphemeralRows` de `./_lib/fixtures`, `loginAs` de `./_lib/session`, `pg` (Client) pour assertions BDD directes.
  - [x] T2.2 - Declarer un `afterEach` ou `afterAll` appelant `resetEphemeralRows()` pour cleanup systématique. `test.afterAll` + cleanup specifique admin_actions_log via marker `e2e-test`.
  - [x] T2.3 - Implementer le test `[anti-fraude] blacklist meme_email` (AC2). Strategie BDD directe documentee en en-tete.
  - [x] T2.4 - Implementer le test `[anti-fraude] flag meme_ip` (AC3). Appel direct RPC `merge_parrainage_flag_suspicion` + assert `flag_suspicion` TEXT csv (le libelle AC3 d origine mentionnait `blacklist_suspicion` JSONB qui n existe pas en BDD ; aligne sur la verite du code).
  - [x] T2.5 - Implementer le test `[anti-fraude] bypass visio filleule sur /onboarding` (AC4).
  - [x] T2.6 - Tagger les 3 tests avec `@parrainage-anti-fraude` pour execution selective (`npx playwright test --grep @parrainage-anti-fraude`).

- [x] **T3 - Ajouter un Page Object `OnboardingPage` minimal dans `tests/e2e/_lib/pages.ts`** (AC: #4)
  - [x] T3.1 - Ajouter la classe `OnboardingPage` avec methode `goto()` (navigate `/accompagnant/onboarding`) et `expectBypassMessage()` (assert texte bypass visio visible).
  - [x] T3.2 - Ne pas ajouter de logique metier dans le PO. Seules les assertions UI de AC4 y passent.

- [x] **T4 - Verifier la strategie pour AC2 (server action vs BDD directe)** (AC: #2)
  - [x] T4.1 - Tenter un appel fetch POST vers l'endpoint interne de `createParrainageRelation` depuis Playwright (l'app Next.js tourne via `webServer: npm run dev` pointe sur `http://localhost:3000`). Resultat : `createParrainageRelation` est une server action Next.js sans route REST publique exposee — strategie BDD directe retenue.
  - [x] T4.2 - Documenter la strategie choisie dans un commentaire de la spec. Documente L7-31 du fichier.

- [x] **T5 - Validation pre-commit + push** (AC: #6, #7)
  - [x] T5.1 - `npm run lint` exit 0 (194 warnings, 0 errors).
  - [x] T5.2 - `npm run lint:a11y-check` exit 0 (baseline 155, no regression).
  - [x] T5.3 - `npm run a11y:axe:check` exit 0 (aucun delta Critical/Serious vs baseline 2026-05-05).
  - [x] T5.4 - `npm run test:unit` exit 0 (7 files, 65 tests).
  - [x] T5.5 - `npm run check:no-direct-notifications-log-insert` exit 0.
  - [x] T5.6 - `npm run build` exit 0.
  - [x] T5.7 - Push direct main (Option B, heritage 7.C.1/7.B.3) + `gh workflow run e2e-tests.yml` x2 pour AC6. Run-ids documentes en Completion Notes ci-dessous.

- [x] **T6 - Transitions sprint-status** (AC: #1)
  - [x] T6.1 - `sprint-status.yaml` : `7-c-2-scenarios-anti-fraude-parrainage-e2e` → `review` post-livraison, `done` post-merge.

## Dev Notes

### Infra E2E disponible (7.C.1, done)

La story 7.C.1 a livre l'infra complete. Ne RIEN reinventer :

- **Config** : `playwright-e2e.config.ts` (racine) — `testDir: './tests/e2e'`, `workers: 1`, `retries: CI ? 2 : 0`, `globalSetup: ./tests/e2e/setup.ts`.
- **Lancer** : `npm run test:e2e` (tous les specs dans `tests/e2e/`), `npm run test:e2e:debug` (mode pas-a-pas).
- **Setup anti-prod** : `tests/e2e/setup.ts` — throw/exit si `SUPABASE_URL` non-local. Deja en place, ne pas modifier.
- **Helpers disponibles** :
  - `tests/e2e/_lib/session.ts` : `loginAs(page, role)` — wizard 2 etapes email/password, redirect role-aware. Roles disponibles : `'admin' | 'accompagnant' | 'accompagne' | 'marraine' | 'filleule'`.
  - `tests/e2e/_lib/fixtures.ts` : `resetEphemeralRows()` — DELETE FK-safe sur tables `messages`, `annonces_accompagnants`, `annonces_accompagnes`, `parrainages` (WHERE code LIKE `'e2e-test-%'`). Connection pg sur `process.env.SUPABASE_DB_URL ?? 'postgresql://postgres:postgres@localhost:54322/postgres'`.
  - `tests/e2e/_lib/pages.ts` : `LandingPage`, `LoginPage` (POs minimaux). A **etendre** dans cette story avec `OnboardingPage`.
- **Workflow GHA** : `.github/workflows/e2e-tests.yml` — le fichier spec est automatiquement inclus par le glob `testDir: './tests/e2e'` sans aucune modification.

### Seed BDD disponible

| User | UUID suffix | Role | Email | Etat parrainage |
|---|---|---|---|---|
| Admin | `...0001` | admin | `seed-admin@test.local` | — |
| Accompagnant | `...0002` | accompagnant | `seed-accompagnant@test.local` | Sub active (ccc1) |
| Accompagne | `...0003` | accompagne | `seed-accompagne@test.local` | Sub expiree (ccc2) |
| Marraine | `...0004` | accompagnant | `seed-marraine@test.local` | Code `TESTSEED1`, parrainage `aaa1` (inscrit) |
| Filleule | `...0005` | accompagnant | `seed-filleule@test.local` | Dans parrainage `aaa1` |

**Seed `02_parrainages.sql` insere** :
- `parrainages_codes` : user4 → code `TESTSEED1`, `compteur_confirmes=0`.
- `parrainages aaa1` : `marraine_id=user4`, `filleule_id=user5`, `statut='inscrite'`.
- `parrainages aaa2` : `marraine_id=user4`, `filleule_id=null`, `statut='bloque'`, `blocage_raison='meme_carte'`.

**Important** : `TESTSEED1` est le code seed stable. Les codes crees par les tests E2E DOIVENT utiliser le prefix `e2e-test-` pour etre eligible a `resetEphemeralRows()`. Exemple : `code='e2e-test-blacklist-1'`.

### Logique metier anti-fraude a tester

**`detectBlacklist` (`app/actions/parrainage.ts:36-100`)** :
- Retourne `{ blocage: 'meme_email' }` si l'email de la filleule == email de la marraine (normalise via `normalizeEmail`).
- Retourne `{ blocage: 'meme_email' }` si l'email de la filleule == email d'une autre filleule de la meme marraine.
- Retourne `{ flag: 'meme_ip' }` si une autre row `parrainages` de la meme marraine a la meme `ip_inscription`.

**`createParrainageRelation` (`app/actions/parrainage.ts:454-727`)** :
- Appele `detectBlacklist` apres insertion de la row `parrainages` (avant d'ecrire `parrainee_par`).
- Si `blocage: 'meme_email'` → UPDATE row `statut='bloque'`, `blocage_raison='meme_email'`, INSERT `admin_actions_log`, email `sendAdminParrainageFlag({type:'meme_email'})`, retourne `{ ok: false, reason: 'blacklist_meme_email' }`.
- Si `flag: 'meme_ip'` → RPC `merge_parrainage_flag_suspicion` (atomique), email `sendAdminParrainageFlag({type:'meme_ip'})`, row garde `statut='inscrite'` mais `blacklist_suspicion` est enrichi.

**Strategie recommandee pour AC2 (meme_email)** :
La server action `createParrainageRelation` est une server action Next.js (pas un endpoint REST public). L'appeler via fetch depuis Playwright necessite de passer par `/api/parrainage/...` si une route existe, sinon il faut simuler l'etat BDD attendu directement. **Strategy recommandee** : inserer via pg client une row `parrainages` avec `code='e2e-test-meme-email'`, `marraine_id=user4`, `filleule_id=user5` (ou null), `statut='bloque'`, `blocage_raison='meme_email'` (reproduisant l'etat post-detection), puis asserter via SELECT que la row est bien dans cet etat. Ajouter egalement une row `admin_actions_log` avec `action_type='parrainage_bloque'`, `details->>'raison'='meme_email'`. Le test valide l'etat BDD attendu comme proxy pour la logique server-side. **Documenter cette strategie** dans un commentaire de test.

**Strategie recommandee pour AC4 (bypass onboarding)** :
C'est le scenario le plus fiable a tester en E2E car il s'agit d'une vraie navigation UI :
1. `UPDATE public.users SET parrainee_par = '00000000-0000-0000-0000-000000000004' WHERE id = '00000000-0000-0000-0000-000000000005'` si la valeur est null apres seed.
2. `loginAs(page, 'filleule')` puis `page.goto('/accompagnant/onboarding')`.
3. `await expect(page.getByText(/pas de pièces justificatives ni de visio/i)).toBeVisible()`.

### Pattern d'isolation des tests (heritage 7.C.1)

```typescript
import { test, afterAll } from '@playwright/test'
import { resetEphemeralRows } from './_lib/fixtures'

test.afterAll(async () => {
  await resetEphemeralRows()
})

test('[anti-fraude] ...', async ({ page }) => {
  // Toute row parrainages creee ici doit avoir code LIKE 'e2e-test-%'
})
```

### Connexion pg directe dans les specs

Pattern heritage de `fixtures.ts` et `scripts/seed-test-supabase.mjs` :

```typescript
import pg from 'pg'
const { Client } = pg

const pgUrl = process.env.SUPABASE_DB_URL ?? 'postgresql://postgres:postgres@localhost:54322/postgres'

// Dans un beforeAll ou setup de test :
const client = new Client({ connectionString: pgUrl })
await client.connect()
try {
  const { rows } = await client.query(
    `SELECT parrainee_par FROM public.users WHERE id = $1`,
    ['00000000-0000-0000-0000-000000000005']
  )
  // assert rows[0].parrainee_par !== null
} finally {
  await client.end()
}
```

Ne pas reutiliser `resetEphemeralRows` pour les assertions — creer un client pg distinct si necessaire pour les SELECT d'assertion.

### Page Object OnboardingPage a ajouter dans pages.ts

```typescript
export class OnboardingPage {
  constructor(private readonly page: Page) {}

  async goto(): Promise<void> {
    await this.page.goto('/accompagnant/onboarding')
  }

  async expectBypassMessage(): Promise<void> {
    await expect(
      this.page.getByText(/pas de pièces justificatives ni de visio/i)
    ).toBeVisible({ timeout: 10_000 })
  }
}
```

Source : `components/accompagnant/onboarding-client.tsx:187`.

### Pieges connus

- **`meme_adresse` n'existe pas** : l'epic-7.md mentionne `meme_adresse` dans l'AC1, mais le code `detectBlacklist` (`app/actions/parrainage.ts:36-100`) ne detecte que `meme_email` et `meme_ip`. L'AC du code epic est la spec officielle pour ce qui est detecte cote serveur. **Implementer `meme_email` + `meme_ip` uniquement**. Ne pas inventer de detection `meme_adresse` qui n'existe pas.
- **Server actions Next.js non appelables directement via fetch** : les server actions utilisent le protocole interne Next.js (POST avec headers specifiques). En E2E, privilegier la navigation UI ou les assertions BDD directes plutot qu'un appel fetch manuel.
- **`parrainee_par` sur user5** : a verifier apres `npm run seed:test` — le seed `02_parrainages.sql` insere le parrainage `aaa1` (marraine=user4, filleule=user5) mais ne fait PAS de UPDATE `users.parrainee_par` directement (c'est `createParrainageRelation` qui le fait). Si le champ est null, le mettre en setup du test AC4 via UPDATE pg.
- **Import pg dans les specs** : `pg` est une dependance existante dans le projet (heritee de `tests/e2e/_lib/fixtures.ts`). Utiliser le meme pattern d'import : `import pg from 'pg'; const { Client } = pg`.
- **Timeout network idle** : utiliser `await expect(...).toBeVisible({ timeout: 10_000 })` plutot que `page.waitForLoadState('networkidle')` (peut hang). Heritage pattern smoke.spec.ts.
- **Convention prefix `e2e-test-`** : toute row creee par les tests doit avoir le prefix dans le champ texte cle (`code`, `titre`, `content`). Le `resetEphemeralRows()` ne supprime que les rows matchant ce pattern sur la colonne `code` de `parrainages`.

### References

- [Source: tests/e2e/_lib/session.ts] — `loginAs` + `SEED_USERS_CREDENTIALS`.
- [Source: tests/e2e/_lib/fixtures.ts] — `resetEphemeralRows()` + pattern pg client.
- [Source: tests/e2e/_lib/pages.ts] — POs existants a etendre.
- [Source: tests/e2e/smoke.spec.ts] — exemple de spec minimale, pattern import + test.
- [Source: app/actions/parrainage.ts:36-100] — `detectBlacklist` : logique `meme_email` + `meme_ip`.
- [Source: app/actions/parrainage.ts:454-727] — `createParrainageRelation` : insertion + detection + blocage.
- [Source: components/accompagnant/onboarding-client.tsx:104-137] — logique bypass uploads filleule (`isFilleule=true`).
- [Source: components/accompagnant/onboarding-client.tsx:179-190] — texte bypass visio affiché.
- [Source: app/accompagnant/onboarding/page.tsx:17-22] — lecture `parrainee_par` depuis BDD.
- [Source: supabase/seeds/01_users.sql] — contenu detaille des 5 seed users + champs metier.
- [Source: supabase/seeds/02_parrainages.sql] — code `TESTSEED1`, parrainages `aaa1`/`aaa2` fixes.
- [Source: supabase/seeds/04_subscriptions.sql] — subscriptions seed (user2 active, user3 expiree).
- [Source: scripts/seed-test-supabase.mjs:50-75] — UUIDs fixes + SEED_USERS table de reference.
- [Source: _bmad-output/planning-artifacts/epic-7.md#Story-7.C.2] — AC originaux.
- [Source: _bmad-output/implementation-artifacts/7-c-1-infra-e2e-playwright.md] — Dev Notes infra, pieges GHA, strategie auth, pattern Option B push.

### Project Structure Notes

- **Un seul nouveau fichier** : `tests/e2e/parrainage-anti-fraude.spec.ts`.
- **Un fichier modifie** : `tests/e2e/_lib/pages.ts` (ajout classe `OnboardingPage`).
- **Aucune modification** : `playwright-e2e.config.ts`, `e2e-tests.yml`, `package.json`, `playwright.config.ts`, tables BDD.
- **Cohabitation** : le smoke test `smoke.spec.ts` reste inchange et continue de passer.

## Dev Agent Record

### Agent Model Used

claude-opus-4-7

### Debug Log References

- 2026-05-16 : verifie statiquement (seed `02_parrainages.sql` + `app/actions/parrainage.ts:581-594`) que `users.parrainee_par` de user5 reste NULL apres seed — le seed n insere que la row parrainages aaa1, et seul `createParrainageRelation` server-side ecrit `parrainee_par`. AC4 doit donc poser la valeur via UPDATE pg en debut de test (idempotent).
- 2026-05-16 : decouvert que la colonne BDD reelle est `flag_suspicion TEXT` (csv, migration `20260428130104_add_parrainage_feature.sql:34`), pas `blacklist_suspicion JSONB` comme indique dans l AC3 d origine. Le RPC `merge_parrainage_flag_suspicion` (migration `20260428162906`) gere un merge string -> array dedup -> string. Le test colle a la verite du code.
- 2026-05-16 : verifie que `<input type="file">` reste rendu (mais en `className="hidden"`) meme en mode `isFilleule=true` (cf. `components/accompagnant/step-diplome.tsx:104-110`). L assertion sur l absence de file inputs (proposee initialement) etait incorrecte ; remplacee par assertion sur le texte helper `"Optionnel grâce à votre parrainage"` qui n est rendu que quand `isFilleule=true` (`step-diplome.tsx:141-143`).

### Completion Notes List

- **Strategie AC2/AC3** : BDD directe (INSERT row reproduisant l etat post-detection) plutot qu appel server action. Raison : `createParrainageRelation` est une server action Next.js sans route REST publique, et son invocation via fetch en E2E exigerait de simuler le protocole RSC Next.js (POST + headers internes) qui est fragile et ne teste pas le flow reel — la valeur ajoutee versus tests Vitest existants serait nulle. Strategie BDD directe valide la SHAPE attendue de l etat persiste (statut, blocage_raison, flag_suspicion, admin_actions_log). Si un developpeur change la structure (rename colonne, drop CHECK), les tests echouent. AC3 va plus loin : appel direct de la RPC `merge_parrainage_flag_suspicion` qui valide l idempotence + le merge atomique cote BDD.
- **Strategie AC4** : vrai parcours UI avec `loginAs('filleule')` + navigation `/accompagnant/onboarding` + assertions sur le message bypass visio et le helper "Optionnel grâce à votre parrainage". Pre-condition : UPDATE pg posant `users.parrainee_par = MARRAINE_ID` (idempotent, ne pas reset en `afterAll` — la story le precise).
- **Schema correction** : l AC3 d origine ecrivait `blacklist_suspicion JSONB '{flags:["meme_ip"]}'`. La BDD utilise en realite `flag_suspicion TEXT csv` (migration `20260428130104` L34). Le test colle a la verite du code. Tracer dans une retro si le libelle AC3 doit etre amende dans `epic-7.md`.
- **Cleanup** : `afterAll` appelle `resetEphemeralRows()` (heritage 7.C.1) + DELETE specifique sur `admin_actions_log` via `details->>'marker' = 'e2e-test'` (table non geree par `resetEphemeralRows`). Marker pose explicitement dans le test AC2.
- **Validation pre-commit** : tous les checks AC7 verts en local (lint, lint:a11y-check, a11y:axe:check, test:unit, check:no-direct-notifications-log-insert, build). Voir transcript GHA pour les 2 runs e2e-tests.yml (AC6) — run-ids ajoutes apres push.
- **Run-ids GHA `e2e-tests.yml` (AC6 satisfait)** : Run1 [25959964819](https://github.com/Sharo0s/roxanetnous/actions/runs/25959964819) success 3m26s + Run2 [25959966527](https://github.com/Sharo0s/roxanetnous/actions/runs/25959966527) success 3m31s. Les 2 runs consecutifs verts post-merge (2026-05-16 ~10:50 UTC) valident l infra E2E + les 3 scenarios anti-fraude (smoke 7.C.1 + 3 tests 7.C.2 = 4 tests verts).

### File List

- `tests/e2e/parrainage-anti-fraude.spec.ts` (nouveau) — 3 tests Playwright tagges `@parrainage-anti-fraude`.
- `tests/e2e/_lib/pages.ts` (modifie) — ajout classe `OnboardingPage` (PO minimal).
- `_bmad-output/implementation-artifacts/7-c-2-scenarios-anti-fraude-parrainage-e2e.md` (modifie) — story file (status review, tasks/subtasks, Dev Agent Record, File List).
- `_bmad-output/implementation-artifacts/sprint-status.yaml` (modifie) — transition `7-c-2-scenarios-anti-fraude-parrainage-e2e` : `ready-for-dev` -> `review`.

### Review Findings

- [x] [Review][Decision] Tests AC2/AC3 auto-validants — Limitation acceptée (stratégie BDD directe consciente, documentée en en-tête spec). Server action non appelable en E2E sans reproduire le protocole RSC interne Next.js.
- [x] [Review][Decision] `UPDATE parrainee_par` sans `WHERE IS NULL` — Idempotence documentée dans commentaire inline. Le UPDATE pose toujours `MARRAINE_ID`, no-op si déjà la bonne valeur.
- [x] [Review][Patch] Pas de `beforeAll(resetEphemeralRows)` — non-idempotent sur retry CI et cross-run [`tests/e2e/parrainage-anti-fraude.spec.ts`]
- [x] [Review][Patch] `withPg` local sans `assertLocalPgUrl` — risque d'écriture accidentelle en base prod si `SUPABASE_DB_URL` pointe sur la prod [`tests/e2e/parrainage-anti-fraude.spec.ts:21-30`]
- [x] [Review][Patch] Assertions RPC/INSERT sans guard `toHaveLength(1)` avant `rows[0]` — erreur opaque en cas d'INSERT silencieux [`tests/e2e/parrainage-anti-fraude.spec.ts:80,107,118,126,188`]
- [x] [Review][Patch] Credentials fallback `postgres:postgres` — `assertLocalPgUrl` refuse avant connexion, risque éliminé [`tests/e2e/parrainage-anti-fraude.spec.ts:14-15`]
- [x] [Review][Patch] `resetEphemeralRows()` n'inclut pas le cleanup `admin_actions_log` — contrat incomplet si appelé seul depuis d'autres specs [`tests/e2e/_lib/fixtures.ts`]
- [x] [Review][Defer] Idempotence RPC (`was_added=false` sur double flag) non exercée — pré-existant, hors scope 7.C.2 — deferred, pre-existing
- [x] [Review][Defer] Permission `service_role` de la RPC non testée (test en superuser, bypass GRANT) — accepté comme limitation documentée — deferred, pre-existing
- [x] [Review][Defer] `OnboardingPage.goto()` ne vérifie pas l'URL finale après navigation — pattern hérité des autres POs — deferred, pre-existing

## Change Log

- **2026-05-16** : livraison story 7.C.2. Spec E2E `tests/e2e/parrainage-anti-fraude.spec.ts` ajoutee (3 tests anti-fraude parrainage). PO `OnboardingPage` ajoute dans `pages.ts`. Strategie BDD directe pour AC2/AC3 (justification en en-tete spec), vrai parcours UI pour AC4. Schema correction documentee (colonne `flag_suspicion TEXT csv`, pas `blacklist_suspicion JSONB`).

## DoD a11y

**Non applicable** : cette story est purement infrastructurelle (tests E2E, PO helper). Aucun changement UI, aucune copy nouvelle, aucun composant React modifie. La regle CLAUDE.md `npm run a11y:axe:check` reste obligatoire avant commit livraison (AC7) pour preserver le baseline 0 violations Critical/Serious.

- [x] **Non applicable** : story infrastructurelle, 0 changement UI.
- [x] Pas de regression `eslint-plugin-jsx-a11y` (`npm run lint:a11y-check` vert en CI) — baseline 155, no regression.
- [x] Pas de regression axe-core (`npm run a11y:axe:check` vert) — aucun delta Critical/Serious vs baseline 2026-05-05.
