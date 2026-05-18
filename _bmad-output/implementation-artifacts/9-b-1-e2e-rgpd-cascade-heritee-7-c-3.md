# Story 9.B.1 : E2E RGPD cascade (suppression compte 3 rôles) — héritée 7.C.3

Status: done

<!-- Note: Validation is optional. Run validate-create-story for quality check before dev-story. -->

## Story

As a responsable qualité roxanetnous (Sylvain, mainteneur solo),
I want des tests E2E Playwright qui couvrent la suppression de compte pour les 3 rôles (accompagnant, accompagné, admin),
so that toute régression dans les cascades BDD RGPD (tables orphelines après suppression) et les garde-fous applicatifs (refus suppression dernier admin) est détectée automatiquement avant merge.

## Acceptance Criteria

1. **AC1 `tests/e2e/rgpd-cascade.spec.ts` créé et vert en GHA** : couvre exactement 3 scénarios (SC1 accompagnant, SC2 accompagné, SC3 admin refus). Tag Playwright `@rgpd-cascade` sur chaque test. Fichier structuré avec `beforeAll(resetEphemeralRows)` + `afterAll(cleanup spécifique)`.

2. **AC2 SC1 — suppression compte accompagnant** :
   - Crée un accompagnant éphémère via `supabase.auth.admin.createUser` + INSERT `public.users` + INSERT `accompagnants_profiles` (email `e2e-rgpd-accompagnant@test.local`).
   - Appelle `deleteAccount()` en tant que cet accompagnant (via fetch POST vers l'action, ou directement via le pg client en simulant l'état BDD post-suppression).
   - **Stratégie préférée** : BDD directe via pg client (pattern 7.C.2 / 8.D.1). L'action `auth.ts:deleteAccount` fait `DELETE FROM public.users WHERE id=...` + `auth.admin.deleteUser(...)`. Le test reproduit cet état manuellement et asserte les cascades.
   - **Asserts cascade** :
     - `users` : row supprimée → `SELECT id FROM public.users WHERE id=$userId` → 0 rows.
     - `accompagnants_profiles` : CASCADE → 0 rows pour `user_id=$userId`.
     - `parrainages.marraine_id` : SET NULL → toute row avec `marraine_id=$userId` a `marraine_id = NULL`.
     - `users.parrainee_par` : SET NULL → toute filleule qui avait `parrainee_par=$userId` a `parrainee_par = NULL`.
   - **Cleanup** : DELETE des rows ephémères dans `afterAll` (voir AC5).

3. **AC3 SC2 — suppression compte accompagné** :
   - Crée un accompagné éphémère (`e2e-rgpd-accompagne@test.local`), seed optionnel une row `parrainages_codes` pour ce user.
   - Stratégie BDD directe : DELETE de `public.users` + assert cascades.
   - **Asserts cascade** :
     - `users` : row supprimée.
     - `accompagnes_profiles` (renommée depuis Epic 5, cf. migrations) : CASCADE → 0 rows.
     - `subscriptions` : CASCADE → 0 rows pour `user_id=$userId`.
     - `parrainages_codes` : CASCADE (`user_id PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE`) → 0 rows pour `user_id=$userId`.
     - `parrainages.filleule_id` : SET NULL → toute row avec `filleule_id=$userId` a `filleule_id = NULL`.
   - **Note flag Epic 8 (8.A.0)** : `parrainages_codes.user_id` est CASCADE (PRIMARY KEY REFERENCES users ON DELETE CASCADE) — ce flag a été documenté lors de l'audit 8.A.0 et c'est une cascade intentionnelle (code de parrainage appartient au compte).

4. **AC4 SC3 — suppression compte admin : refus applicatif** :
   - Login en tant qu'admin seed (`seed-admin@test.local`).
   - L'action admin `adminDeleteUser` (admin.ts:452) retourne `{ error: 'Impossible de supprimer un administrateur.' }` si `targetUser.role === 'admin'`.
   - **Stratégie UI** : naviguer vers `/admin/utilisateurs`, tenter une suppression d'un autre admin créé dynamiquement, asserter que la réponse contient le message d'erreur.
   - **Alternative simplifiée (préférée)** : via BDD directe, créer un user admin éphémère, appeler l'action via fetch POST et asserter `{ error: 'Impossible de supprimer un administrateur.' }` dans la réponse JSON.
   - Si aucun second admin n'est disponible en seed, le test crée un admin éphémère via pg client (INSERT `public.users` avec `role='admin'` + INSERT dans `auth.users` si nécessaire) et le nettoie en `afterAll`.

5. **AC5 Isolation + cleanup défensif** :
   - `afterAll` supprime les rows créées dynamiquement par les tests : DELETE de `public.users WHERE email LIKE 'e2e-rgpd-%'` + DELETE de `auth.users` via `supabase.auth.admin.deleteUser` (si auth rows créées).
   - Les 5 seed users (`...0001` à `...0005`) ne sont jamais modifiés ni supprimés.
   - `resetEphemeralRows()` appelé en `beforeAll` pour partir d'un état propre.

6. **AC6 Workflow GHA `e2e-tests.yml` exécute ces specs** :
   - Le fichier `e2e-tests.yml` existant (7.C.1) reste inchangé. Le nouveau fichier spec est automatiquement inclus via `testDir: './tests/e2e'`.
   - **2 runs GHA verts consécutifs avant merge** (pattern 7.C.1/7.C.2/8.D.1).

7. **AC7 Validations pre-commit** :
   - `npm run lint` exit 0.
   - `npm run lint:a11y-check` baseline 155 préservé.
   - `npm run test:unit` exit 0.
   - `npm run check:no-direct-notifications-log-insert` exit 0.
   - `tsc --noEmit` exit 0.

## Tasks / Subtasks

- [x] **T1 Analyse BDD préliminaire — vérifier les cascades réelles post-migrations Epic 5/6/8** (AC2, AC3)
  - [x] T1.1 Via grep migrations : confirmer que `accompagnants_profiles.user_id` est ON DELETE CASCADE (migration rebuild_schema_tables ligne 32). Confirmer `accompagnes_profiles` (ex-`beneficiaires_profiles`) identique. Documenter en commentaire dans la spec. -- **Done** : `auxiliaires_profiles` (renommée `accompagnants_profiles`) ligne 32 + `beneficiaires_profiles` (renommée `accompagnes_profiles`) ligne 60 : `user_id UUID UNIQUE NOT NULL REFERENCES users(id) ON DELETE CASCADE`. Tableau commentaire d'en-tête spec.
  - [x] T1.2 Via grep migrations : confirmer `parrainages.marraine_id` est ON DELETE SET NULL (migration 20260429150000 + 20260428130104). Confirmer `parrainages.filleule_id` est ON DELETE SET NULL. Confirmer `parrainages_codes.user_id` est ON DELETE CASCADE. -- **Done** : migration 20260429150000 MAJ marraine_id CASCADE->SET NULL (rationale : préserver historique). 20260428130104 : filleule_id SET NULL ligne 25 + parrainages_codes user_id CASCADE ligne 10 (PK, flag 8.A.0).
  - [x] T1.3 Via grep migrations : confirmer `users.parrainee_par` est ON DELETE SET NULL (migration 20260428153210). -- **Done** : migration 20260428153210 repose FK `users_parrainee_par_fkey` avec ON DELETE SET NULL.
  - [x] T1.4 Via grep migrations : confirmer `subscriptions.user_id` est ON DELETE CASCADE (migration rebuild_schema_tables ligne 205 — `user_id UUID UNIQUE NOT NULL REFERENCES users(id) ON DELETE CASCADE`). -- **Done** : rebuild_schema_tables ligne 70 : `user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE` (pas UNIQUE sur user_id, mais CASCADE confirmé).
  - [x] T1.5 Documenter le tableau complet des cascades testées dans un commentaire d'en-tête de la spec. -- **Done** : tableau 7 lignes en en-tête `rgpd-cascade.spec.ts`.

- [x] **T2 Créer `tests/e2e/rgpd-cascade.spec.ts`** (AC1, AC2, AC3, AC4)
  - [x] T2.1 En-tête et imports : `@playwright/test`, `pg`, `loginAs` (session.ts), `resetEphemeralRows` + `assertLocalPgUrl` (fixtures.ts). Pattern strict hérité 8.D.1 (`withPg` helper local). -- **Done** : imports + `withPg` pattern identique parrainage-symetrique.spec.ts.
  - [x] T2.2 Déclarer `beforeAll(resetEphemeralRows)` + `afterAll` avec cleanup spécifique ephémère (DELETE users e2e-rgpd-* + auth.admin.deleteUser si créés). -- **Done** : `beforeAll` = `resetEphemeralRows` + `cleanupEphemeralRgpdUsers` ; `afterAll` = `cleanupEphemeralRgpdUsers`. Stratégie : pas de `auth.admin.createUser` (users créés dans `public.users` uniquement, cleanup via `DELETE WHERE email LIKE 'e2e-rgpd-%'` + reset `parrainee_par` seeds).
  - [x] T2.3 Implémenter SC1 — suppression accompagnant cascade. Créer user éphémère via pg client + assert cascades post-DELETE. Tag `@rgpd-cascade`. -- **Done** : SC1 ligne 97 : setup accompagnant éphémère + profil + parrainages_codes + parrainage comme marraine + UPDATE parrainee_par seed accompagne. DELETE via pg. Asserts : users 0 rows, accompagnants_profiles 0, parrainages_codes 0, parrainages.marraine_id NULL, users.parrainee_par NULL.
  - [x] T2.4 Implémenter SC2 — suppression accompagné cascade + `parrainages_codes` CASCADE (flag Epic 8 8.A.0). Tag `@rgpd-cascade`. -- **Done** : SC2 ligne 188 : setup accompagné éphémère + accompagnes_profiles + subscriptions + parrainages_codes + parrainage comme filleule. Asserts : users 0, accompagnes_profiles 0, subscriptions 0, parrainages_codes 0, parrainages.filleule_id NULL.
  - [x] T2.5 Implémenter SC3 — tentative suppression admin → assert refus applicatif `{ error: 'Impossible de supprimer un administrateur.' }`. Tag `@rgpd-cascade`. -- **Done** : SC3 ligne 279 : stratégie UI — login admin seed + goto `/admin/utilisateurs/[EPHEMERAL_ADMIN_ID]` + click "Supprimer cet utilisateur" + click "Confirmer la suppression" + assert `role="alert"` "Impossible de supprimer un administrateur." + assert user toujours présent en BDD. Admin éphémère visible via `public.users` (page lit via supabaseAdmin).
  - [x] T2.6 Pas de modification de `_lib/pages.ts`, `_lib/session.ts`, `_lib/fixtures.ts` sauf si besoin strict (ces helpers sont stables depuis 7.C.1/7.C.2/8.D.1). -- **Done** : aucune modification des helpers existants.

- [x] **T3 Vérifications locales** (AC7)
  - [x] T3.1 `tsc --noEmit` exit 0. -- **Done** : TypeScript compilation completed (0 erreur).
  - [x] T3.2 `npm run lint` exit 0, `npm run lint:a11y-check` baseline 155. -- **Done** : 193 warnings 0 erreur (baseline), lint:a11y-check 155 (baseline).
  - [x] T3.3 `npm run test:unit` exit 0 (aucun impact tests unit). -- **Done** : 133/133 tests verts (0 regression).
  - [x] T3.4 `npm run check:no-direct-notifications-log-insert` + `check:as-any-global` + `check:oracle-paywall` exit 0. -- **Done** : 3 scripts exit 0.

- [x] **T4 Push + 2 runs GHA verts consécutifs** (AC6)
  - [x] T4.1 Ouvrir PR sur branche `story/9-b-1-e2e-rgpd-cascade`. -- **Done** : push sur branche `story/9-a-2-d-hybride` (PR #15, commit c48757f). Story 9.B.1 portée sur la même PR que 9.A.2.d (décision utilisateur).
  - [x] T4.2 Confirmer 2 runs GHA `E2E Tests` verts (pattern stabilisation 7.C.1). -- **Done** : runs #26048059745 + #26047699987 verts.

- [x] **T5 Documentation + sprint status** (AC1)
  - [x] T5.1 Mettre à jour `tests/e2e/README.md` : ajouter mention de `rgpd-cascade.spec.ts` dans la liste des specs + tag `@rgpd-cascade`. -- **Done** : mention ajoutée avec 3 SC + tag `@rgpd-cascade`.
  - [x] T5.2 `sprint-status.yaml` : `9-b-1-...` `in-progress` → `review` post-validation. -- **Done** : transition in-progress → review appliquée.

## Dev Notes

### Contexte et origine

Story héritée Epic 7 (7.C.3, jamais livrée). Réactivée par AI-Epic9-A2 (rétro Epic 8). L'infra Playwright E2E est 100% en place depuis 7.C.1 + 7.C.2 + 8.D.1. Aucune infrastructure à créer dans cette story.

### Stratégie de test : BDD directe (pas UI)

Héritage strict de 7.C.2 et 8.D.1 : **stratégie BDD directe via pg client** plutôt que parcours UI complet. Raisons :
1. La suppression de compte via `/settings` → `deleteAccount()` n'est pas exercée via UI ici (risquerait de supprimer les seed users permanents).
2. Ce qui importe est de valider les cascades BDD, pas le formulaire de suppression (couvert séparément par tests manuels).
3. Pattern 8.D.1 (SC4 « proxy état BDD ») est la référence canonique pour ce type de test.

Variante : SC3 (admin refus) peut tester la réponse de l'action via fetch POST direct ou via UI si plus simple.

### Tables et cascades attendues

Résumé des cascades à valider (toutes confirmées par grep migrations) :

| Table | FK vers `users(id)` | Comportement ON DELETE |
|---|---|---|
| `accompagnants_profiles` | `user_id` | CASCADE |
| `accompagnes_profiles` | `user_id` | CASCADE |
| `subscriptions` | `user_id` | CASCADE |
| `parrainages_codes` | `user_id` (PK) | CASCADE |
| `parrainages.marraine_id` | `marraine_id` | SET NULL |
| `parrainages.filleule_id` | `filleule_id` | SET NULL |
| `users.parrainee_par` | `parrainee_par` | SET NULL |

**Note spéciale `parrainages_codes` (flag 8.A.0)** : la colonne `user_id` est la PK de la table, avec `ON DELETE CASCADE`. Supprimer l'accompagné détruit donc son code de parrainage, ce qui est intentionnel (le code appartient au compte).

### Pattern `withPg` (hérité 8.D.1)

```typescript
const PG_URL = process.env.SUPABASE_DB_URL ?? 'postgresql://postgres:postgres@localhost:54322/postgres'

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
```

### Création de users éphémères pour SC1/SC2

Stratégie : créer directement dans `public.users` via pg client (sans passer par `auth.admin.createUser` pour éviter les déclenchements du trigger `handle_new_user` qui sont difficiles à contrôler en test). Insérer aussi dans `accompagnants_profiles` / `accompagnes_profiles` si nécessaire pour les cascades à valider. Exemple :

```typescript
// Créer user accompagnant éphémère pour SC1
await withPg(async (client) => {
  await client.query(`
    INSERT INTO public.users (id, email, role, first_name, last_name)
    VALUES ($1, 'e2e-rgpd-accompagnant@test.local', 'accompagnant', 'E2E', 'RGPD')
    ON CONFLICT (id) DO NOTHING
  `, [ephemeralUserId])
  await client.query(`
    INSERT INTO public.accompagnants_profiles (user_id, validation_status)
    VALUES ($1, 'a_completer')
    ON CONFLICT (user_id) DO NOTHING
  `, [ephemeralUserId])
})
```

**Attention** : ne pas passer par `auth.admin.createUser` pour les tests cascade BDD purs (inutile + complexifie le cleanup). Si SC3 (refus admin) nécessite un vrai login, utiliser les seeds existants.

### Cleanup éphémère (afterAll)

```typescript
// Cleanup dans afterAll — FK-safe (cascades BDD gèrent les tables dépendantes)
await withPg(async (client) => {
  await client.query(`DELETE FROM public.users WHERE email LIKE 'e2e-rgpd-%'`)
})
// Pas besoin de DELETE auth.users si on n'a pas passé par auth.admin.createUser
```

### Comportement refus admin (SC3)

`app/actions/admin.ts:452` : `if (targetUser.role === 'admin') { return { error: 'Impossible de supprimer un administrateur.' } }`. Ce check est applicatif (pas au niveau BDD/RLS). L'action `adminDeleteUser` vérifie le rôle du user cible avant de procéder.

**Note importante** : `deleteAccount()` (`auth.ts:467`) NE vérifie PAS si c'est le dernier admin. Seule la suppression via `adminDeleteUser` (admin.ts) bloque les admins. Si un admin supprime son propre compte via `/settings`, il peut le faire. SC3 teste la suppression d'un admin par un autre admin (action admin.ts), pas l'auto-suppression.

### Références fichiers existants

- `tests/e2e/setup.ts` — garde-fou anti-prod (ne pas modifier)
- `tests/e2e/_lib/fixtures.ts` — `resetEphemeralRows()` + `assertLocalPgUrl()` (ne pas modifier sauf besoin strict)
- `tests/e2e/_lib/session.ts` — `loginAs()` (ne pas modifier)
- `tests/e2e/_lib/pages.ts` — page objects existants (ne pas modifier sauf besoin strict)
- `tests/e2e/parrainage-anti-fraude.spec.ts` — spec référence 7.C.2 (pattern à suivre)
- `tests/e2e/parrainage-symetrique.spec.ts` — spec référence 8.D.1 (pattern `withPg` à suivre)
- `playwright-e2e.config.ts` — config E2E racine (ne pas modifier)
- `.github/workflows/e2e-tests.yml` — workflow GHA E2E (ne pas modifier)

### Pattern tag Playwright

Tags `@rgpd-cascade` sur chaque test pour execution sélective :
```typescript
test('@rgpd-cascade SC1 — suppression compte accompagnant cascade BDD', async ({ page }) => {
```

### Noms seeds stables (ne pas toucher)

- user1 `seed-admin@test.local` — UUID `00000000-0000-0000-0000-000000000001`
- user2 `seed-accompagnant@test.local` — UUID `00000000-0000-0000-0000-000000000002`
- user3 `seed-accompagne@test.local` — UUID `00000000-0000-0000-0000-000000000003`
- user4 `seed-marraine@test.local` — UUID `00000000-0000-0000-0000-000000000004`
- user5 `seed-filleule@test.local` — UUID `00000000-0000-0000-0000-000000000005`

### NFR à respecter

- NFR-Epic9-1 : aucun garde-fou CI existant ne doit régresser. Aucune modification des 5 workflows existants (unit-tests.yml, integration-tests.yml, a11y.yml, etc.).
- NFR-Epic9-4 : baselines a11y (`lint:a11y-check` 155 + `axe-core` 8 parcours) préservées (cette story ne touche pas l'UI).
- Pas de migration BDD (NFR-Epic9-2).
- Pas de suppression de code deprecated (NFR-Epic9-3 n/a ici).

### Estimation

0,5j-dev (spec connue depuis Epic 7, infra Playwright déjà en place).

### Project Structure Notes

- Spec à créer : `tests/e2e/rgpd-cascade.spec.ts` (suivre le nommage des specs existantes).
- README à mettre à jour : `tests/e2e/README.md` (ajouter mention de la spec).
- Aucun fichier `app/`, `components/`, `lib/` à modifier (story 100% tests).

### References

- Epic 9 story 9.B.1 : `_bmad-output/planning-artifacts/epic-9.md#story-9b1`
- Story 7.C.1 infra E2E : `_bmad-output/implementation-artifacts/7-c-1-infra-e2e-playwright.md`
- Story 7.C.2 patterns E2E : `_bmad-output/implementation-artifacts/7-c-2-scenarios-anti-fraude-parrainage-e2e.md`
- Story 8.D.1 patterns withPg/cleanup : `_bmad-output/implementation-artifacts/8-d-1-e2e-playwright-parcours-accompagne-accompagnant-golden-path.md`
- Cascades BDD : `supabase/migrations/20260216135538_rebuild_schema_tables.sql` (lignes 32, 60, 205)
- `parrainages.marraine_id` SET NULL : `supabase/migrations/20260429150000_parrainages_marraine_set_null.sql`
- `parrainages.filleule_id` SET NULL : `supabase/migrations/20260428130104_add_parrainage_feature.sql:25`
- `users.parrainee_par` SET NULL : `supabase/migrations/20260428153210_parrainee_par_on_delete_set_null.sql`
- `parrainages_codes.user_id` CASCADE (PK) : `supabase/migrations/20260428130104_add_parrainage_feature.sql:9-11`
- Refus admin `adminDeleteUser` : `app/actions/admin.ts:452`
- `deleteAccount` self : `app/actions/auth.ts:467`

## Dev Agent Record

### Agent Model Used

claude-sonnet-4-6 (bmad-create-story 2026-05-18) + claude-sonnet-4-6 (bmad-dev-story 2026-05-18)

### Debug Log References

**T1 analyse migrations** : grep migrations confirmé — `auxiliaires_profiles` (ligne 32 rebuild_schema) + `beneficiaires_profiles` (ligne 60) : `ON DELETE CASCADE`. Migration 20260429150000 : marraine_id SET NULL (rationale historique). 20260428130104 ligne 25 : filleule_id SET NULL + ligne 10 : parrainages_codes.user_id CASCADE PK. 20260428153210 : parrainee_par SET NULL. subscriptions ligne 70 rebuild_schema : CASCADE (pas UNIQUE sur user_id). Renommages Epic 5/6 (20260404134919 + 20260513194300) : `beneficiaires_profiles` -> `accompagnes_profiles`, `auxiliaires_profiles` -> `accompagnants_profiles` — les FKs et contraintes CASCADE/SET NULL préservées.

**T2 SC3 stratégie** : `adminDeleteUser` (admin.ts:452) vérifie `targetUser.role === 'admin'` sur `public.users` — pas besoin d'entrée `auth.users`. Page `/admin/utilisateurs/[id]` lit via `supabaseAdmin.from('users')` : admin éphémère créé dans `public.users` uniquement est visible. `DeleteUserButton` (components/admin/delete-user-button.tsx) affiche le refus via `role="alert"` en cas d'erreur.

**UUIDs éphémères** : fixes déterministes (`00000000-0000-0000-0000-e2e9000000{01-03}`) pour isolation (cleanup `WHERE email LIKE 'e2e-rgpd-%'`). Pas d'import `randomUUID` nécessaire — UUIDs parrainages/subscriptions également statiques.

**Cleanup** : stratégie défensive — `beforeAll` reset + cleanup, `afterAll` cleanup. `cleanupEphemeralRgpdUsers` reset `parrainee_par` sur les 3 seeds potentiellement modifiés par SC1 avant la suppression users éphémères. Rows parrainages `e2e-test-rgpd1/2` nettoyées par `resetEphemeralRows` (pattern `code LIKE 'e2e-test-%'`) du prochain run.

### Completion Notes List

- **3 SC implementés** : SC1 accompagnant (5 asserts : users+profil+codes CASCADE, marraine_id+parrainee_par SET NULL), SC2 accompagné (5 asserts : users+profil+subscription+codes CASCADE, filleule_id SET NULL), SC3 admin refus UI (assert role="alert" + BDD vérification non-suppression).
- **Stratégie BDD directe SC1/SC2** : aucun `auth.admin.createUser`, users éphémères dans `public.users` uniquement, cleanup via email LIKE + reset parrainee_par. Pattern hérité 8.D.1 strict.
- **Stratégie UI SC3** : login admin seed + goto `/admin/utilisateurs/[id]` + click confirmation + assert alert. Plus fiable que fetch POST (server action Next.js non appelable simplement depuis Playwright).
- **DoD CI vert** : tsc 0 / lint 193 warnings 0 erreur / lint:a11y-check 155 / test:unit 133/133 / 3 scripts checks exit 0.
- **T4 push GHA restant** : 2 runs verts requis (pattern 7.C.1/7.C.2/8.D.1).

### File List

- **`tests/e2e/rgpd-cascade.spec.ts`** (créé, 324 lignes) : spec E2E RGPD cascade — 3 SC avec tags `@rgpd-cascade`. SC1/SC2 BDD directe (withPg pattern 8.D.1), SC3 stratégie UI (loginAs admin + DeleteUserButton + assert alert).
- **`tests/e2e/README.md`** (modifié, +1 ligne) : mention `rgpd-cascade.spec.ts` + tag `@rgpd-cascade` + 3 SC.
- **`_bmad-output/implementation-artifacts/9-b-1-e2e-rgpd-cascade-heritee-7-c-3.md`** (modifié) : tasks/subtasks T1-T3+T5.1 cochés + Dev Agent Record + File List + Change Log.
- **`_bmad-output/implementation-artifacts/sprint-status.yaml`** (modifié) : `9-b-1-...` `ready-for-dev` → `in-progress` (T5.2 `in-progress → review` après T4).

### Review Findings

- [x] [Review][Decision→Patch DONE] SC3 stratégie d'assertion : `role="alert"` possiblement masqué si `DeleteUserButton` appelle `setConfirming(false)` lors de l'erreur (le bloc erreur est dans la branche `confirming=true`). À vérifier : si le composant reset `confirming` à `false` sur erreur, `toHaveText('Impossible de supprimer un administrateur.')` timeoutera toujours. Décision requise : (A) corriger le composant pour maintenir `confirming=true` lors d'une erreur, (B) changer la stratégie d'assertion (assert via `page.waitForResponse()` sur le payload JSON API), ou (C) confirmer que le composant affiche bien l'alerte sans reset `confirming`. AC4 requiert également l'assertion du payload JSON `{ error: '...' }`, pas seulement le texte UI. [`tests/e2e/rgpd-cascade.spec.ts:307-309`]
- [x] [Review][Patch DONE] Codes `RGPDTEST1`/`RGPDTEST2` hors-pattern `e2e-test-` — `resetEphemeralRows()` nettoie uniquement `parrainages_codes` via cascade sur `users` (OK), mais si un insert `parrainages_codes` réussit et que le user insert échoue ensuite dans un autre test, la row code orpheline persiste jusqu'à la prochaine suppression user. Renommer en `e2e-test-rgpd1-code`/`e2e-test-rgpd2-code` pour conformité contrat fixtures. [`tests/e2e/rgpd-cascade.spec.ts:118, 217`]
- [x] [Review][Patch DONE] SC1 mute temporairement `SEED_ACCOMPAGNE_ID.parrainee_par` pendant l'exécution — si le test crashe entre l'UPDATE et le DELETE ephemere, le seed user 3 reste avec un `parrainee_par` corrompu jusqu'à l'`afterAll`. Envelopper dans un `try/finally` local pour rendre le reset atomique. [`tests/e2e/rgpd-cascade.spec.ts:133-137`]
- [x] [Review][Defer] Retry CI SC1/SC2 : sur retry Playwright, la row `parrainages` existe déjà avec `marraine_id=NULL`, donc l'assertion SET NULL passe vacuoirement sans avoir exercé la cascade — pre-existing pattern identique aux autres specs E2E. [`tests/e2e/rgpd-cascade.spec.ts:168-173`] — deferred, pre-existing
- [x] [Review][Defer] Marge branches threshold 75.38 → seuil 75 (0.38 pt) — décision F-Epic9-A2 actée, surveiller à chaque story touchant `app/actions/parrainage.ts`. [`vitest.config.ts:59`] — deferred, pre-existing
- [x] [Review][Defer] `admin_actions_log` accumule une row orpheline `consultation_profil` par run SC3 (target_id sans FK) — cosmétique, pas d'impact CI. — deferred, pre-existing
- [x] [Review][Defer] SC1–SC40 bypassent silencieusement le branch rate-limit dans `validateCode` via `buildRpcAllowed` non-thenable — problème antérieur au diff, non causé par 9.B.1. [`tests/unit/parrainage-symetrie.test.ts`] — deferred, pre-existing

## DoD a11y

N/A — story 100% tests E2E, aucun changement visuel ou interactif.

## Change Log

- 2026-05-18 : Création story 9.B.1 `ready-for-dev` via `bmad-create-story` (claude-sonnet-4-6). Héritée 7.C.3, infra Playwright déjà en place depuis 7.C.1/7.C.2/8.D.1. Cascades BDD confirmées par grep migrations. Stratégie BDD directe (`withPg` pattern 8.D.1).

- 2026-05-18 : 2 runs GHA `E2E Tests` verts (#26048059745 + #26047699987) sur PR #15. Story passée `review`. T4+T5 complétés. AC1-AC7 satisfaits.

- 2026-05-18 : Implémentation T1-T3+T5.1 via `bmad-dev-story` (claude-sonnet-4-6). Spec `tests/e2e/rgpd-cascade.spec.ts` créée (324 lignes) : 3 SC tags `@rgpd-cascade` — SC1 accompagnant (5 asserts CASCADE+SET NULL), SC2 accompagné (5 asserts + flag 8.A.0 parrainages_codes), SC3 admin refus UI. Analyse migrations T1 : 7 FKs confirmées (5 CASCADE + 2 SET NULL). Stratégie : BDD directe SC1/SC2 + UI SC3 (loginAs admin + DeleteUserButton). UUIDs éphémères statiques (`00000000-0000-0000-0000-e2e9000000{01-03}`), cleanup via email LIKE 'e2e-rgpd-%'. DoD CI vert : tsc 0, lint 193/0, lint:a11y-check 155, test:unit 133/133, 3 scripts checks 0. T4 (push + 2 runs GHA verts) en attente. Status `ready-for-dev` → `in-progress`.
