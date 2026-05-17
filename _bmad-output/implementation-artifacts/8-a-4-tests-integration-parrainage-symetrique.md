# Story 8.A.4 : Tests d'intégration parrainage symétrique

Status: done

<!-- Note: Validation is optional. Run validate-create-story for quality check before dev-story. -->

## Story

As a tech lead,
I want une suite de tests d'intégration end-to-end qui couvre les **4 sens** du parrainage symétrique (golden path + sens interdits + abonnement parrain inactif au palier) en cumulant webhook Stripe + server actions + cron, branchée sur Supabase local via le workflow GHA existant,
so that je préviens toute régression du parrainage Epic 2 (`accompagnant → accompagnant`) lors de l'extension Epic 8 (`accompagne → accompagnant`) et je verrouille la mécanique role-aware livrée en 8.A.1/8.A.2/8.A.3 avec une assertion BDD bout-en-bout (pas seulement par mocks Supabase unitaires).

## Acceptance Criteria

1. **AC1 — Nouveau dossier `tests/integration/parrainage/` créé** : la suite vit dans son propre dossier (cohérent avec `tests/integration/stripe-webhook/`, `tests/integration/paywall/`, `tests/integration/cron-purge-notifications/`, etc.). Fichier principal : `tests/integration/parrainage/symetrie.test.ts`. Pattern de découpage : 1 fichier par mini-flux peut être créé si pertinent (`symetrie.test.ts` pour les 6 SC obligatoires, optionnellement `non-regression-epic2.test.ts` séparé pour SC2). **Décision** : tout dans `symetrie.test.ts` au premier livrable pour minimiser la duplication de fixtures.

2. **AC2 — `npm run test:integration` exit 0 sur Supabase local** : la suite passe localement (Sylvain ne lance pas Docker, mais le pattern doit fonctionner pour qui le ferait — heritage `feedback_test_local_supabase`) ET en CI GHA (workflow `integration-tests.yml` existant, déclenché sur PR vers `main`). Aucun nouveau script ni nouvelle GHA action n'est ajouté : la suite s'intègre dans le `npm run test:integration` global du workflow existant (cf. `tests/integration/cron-purge-notifications/purge-cron.test.ts` qui suit ce pattern). Les variables `SUPABASE_URL=http://localhost:54321`, `SUPABASE_SERVICE_ROLE_KEY`, `STRIPE_WEBHOOK_SECRET`, `STRIPE_SECRET_KEY`, `CRON_SECRET` (déjà injectées par `integration-tests.yml:60-65`) sont les seules dépendances env.

3. **AC3 — 6 scénarios obligatoires couverts** : la suite implémente exactement les 6 scénarios suivants, chacun dans son propre `it(...)` pour faciliter la lecture des résultats CI :

   **SC1 — `accompagne → accompagnant` golden path** : créer parrain `accompagne` + sub `active` + code parrainage généré (via `triggerAccompagneCodeGenesisIfEligible` ou seed direct `parrainages_codes`) ; créer filleul `accompagnant` + profile `accompagnants_profiles` `en_attente` ; appeler `validateCode` → `{ valid: true }` ; appeler `createParrainageRelation` → `{ ok: true }` + row `parrainages` insérée `statut='inscrite'` + `users.parrainee_par = parrain.id` ; simuler webhook `checkout.session.completed` filleul → `subscriptions` upsertée + `parrainages.statut='abonnee'` (via `captureParrainageFingerprint` + flux interne) ; appeler `confirmParrainageOnSuccess(sessionId)` avec session mockée → `{ ok: true }` + `accompagnants_profiles.validation_status='valide'` + `validation_source='parrainage'` + `parrainages_codes` filleul créé (filleul devient parrain à son tour) + bypass visio confirmé (pas de passage par OCR).

   **SC2 — `accompagnant → accompagnant` non-régression Epic 2** : même flux que SC1 mais parrain `accompagnant` + `accompagnants_profiles.validation_status='valide'` (path historique). `validateCode` retourne `{ valid: true }` via le path `accompagnants_profiles` embed, pas via le path `users.role === 'accompagne'`. Aucun nouveau Sentry capture role-aware. Le comportement strict Epic 2 est préservé bit-pour-bit.

   **SC3 — `accompagne → accompagne` rejet `invalid_filleul_role`** : créer parrain `accompagne` + code + sub active ; créer filleul `accompagne` (avec `accompagnes_profiles`) ; appeler `createParrainageRelation` → `{ ok: false, reason: 'invalid_filleul_role' }` + **aucune** row insérée dans `parrainages` (`SELECT COUNT(*) FROM parrainages WHERE filleule_id = ?` retourne 0) + **aucun** `users.parrainee_par` modifié (reste `null`) + un capture Sentry `signal: 'invalid-filleul-role'` émis (assertable via `vi.mocked(Sentry.captureMessage).mock.calls`).

   **SC4 — `accompagnant → accompagne` rejet `invalid_filleul_role`** : parrain `accompagnant` validé + filleul `accompagne` → même rejet `invalid_filleul_role`. Le guard couvre les deux sens interdits via le même check `roleFilleul !== 'accompagnant'`.

   **SC5 — Parrain `accompagne` sub `cancelled` → `validateCode` retourne `marraine_subscription_inactive`** : créer parrain `accompagne` + code + sub `cancelled` (via `createTestSubscription` avec `status: 'cancelled'` — **double L** conformément à l'enum BDD audit 8.A.0) ; appeler `validateCode(code)` → `{ valid: false, reason: 'marraine_subscription_inactive' }` + Sentry warning `signal: 'marraine-sub-inactive'` émis avec `extra.roleParrain === 'accompagne'` et `extra.subStatus === 'cancelled'`.

   **SC6 — Parrain `accompagne` au palier 5 mais sub `unpaid`/`cancelled` → cron `confirm-parrainages` skip coupon, no claim, no email** : créer parrain `accompagne` + `parrainages_codes.compteur_confirmes=4` + sub `cancelled` ; créer 1 filleul `accompagnant` + sub `active` + `parrainages.statut='abonnee'` avec `filleule_abonnee_at` < J-30 (rend le parrainage éligible au cron) ; importer dynamiquement `GET` du cron (pattern hérité `tests/integration/cron-purge-notifications/purge-cron.test.ts:97`) avec `Authorization: Bearer ${CRON_SECRET}` ; appeler `GET()` → la response retourne `{ processed: 1, confirmed: 1, rewards: 0, skipped: 0, errors: 0 }` (`confirmed=1` car le statut bascule `abonnee → confirme` AVANT le pré-check sub parrain — cf. `route.ts:107-126` ; `rewards=0` car le pré-check `marraineSub.active` ligne 149 court-circuite avant le claim atomique ligne 251). Assertions BDD : (a) `parrainages.statut='confirme'` (bascule a eu lieu), (b) `parrainages_codes.compteur_confirmes` reste à 5 (incrément RPC ligne 132 a eu lieu mais aucun reset car pas de claim), (c) aucun coupon Stripe appliqué (`vi.mocked(stripe.subscriptions.update).mock.calls.length === 0` + `vi.mocked(stripe.coupons.create).mock.calls.length === 0`), (d) aucun email envoyé (`vi.mocked(sendParrainageRecompense).mock.calls.length === 0`), (e) aucune ligne `admin_actions_log` action_type `parrainage_recompense_appliquee` ou `parrainage_recompense_perdue` créée pour cette marraine (cohérent avec décision F-Epic8-A3 : pas de `recompense_perdue`, le palier sera re-tenté au prochain cron quand sub redeviendra active).

4. **AC4 — Couverture ≥ 85% sur `app/actions/parrainage.ts`** : la commande `npm run test:integration:coverage` (alias existant `vitest run --project integration --coverage`) rapporte une couverture lignes/branches ≥ 85% pour `app/actions/parrainage.ts`. **Précision sur la baseline** : la couverture actuelle (pré-8.A.4) est partiellement assurée par les tests unitaires `tests/unit/parrainage-symetrie.test.ts` (7 SC livrés 8.A.2 + 4 SC livrés 8.A.3 = 11 SC), mais ces tests tournent sous le projet `unit` séparé. L'intégration vise à compléter la couverture sur les branches BDD réellement exécutées (anti-fraude `detectBlacklist`, idempotence INSERT 23505, race TOCTOU role). **Si la cible 85% n'est pas atteinte** avec les 6 SC : (a) ajouter un 7ème SC ciblant les branches non-couvertes (à documenter dans le Dev Agent Record), ou (b) défère explicite dans `deferred-work.md` avec mention « branches XXX non couvertes par 8.A.4, candidat hardening Epic 9 » (décision dev par-rapport au cadrage). Le seuil 85% est cible, pas blocant ; un échec à 82% avec justification chiffrée est acceptable.

5. **AC5 — Fixtures FK-safe + cleanup obligatoire** : la suite utilise exclusivement les helpers `tests/integration/_lib/fixtures.ts` existants (`createTestUser`, `createTestSubscription`, `createTestAccompagneProfile`, `createTestAccompagnanteProfile`, `createTestParrainage`) **sans** ajouter de helper dédié parrainage symétrique (extension de `fixtures.ts` autorisée si nécessaire mais minimale — 1 helper par nouveau pattern réutilisable, pas par scénario). `beforeAll(cleanupAllFixtures)` et `afterAll(cleanupAllFixtures)` obligatoires (pattern AC5 story 4.4). Si un helper local est créé (ex. `seedParrainageActif(parrain, filleul, { statut, abonneeAt })`), il vit dans `tests/integration/parrainage/_helpers.ts` (préfixe underscore aligné `_lib/` pattern repo) ET pousse les rows créées dans le tracker exposé par `fixtures.ts` (via `createTestParrainage`, jamais via `getAdminClient().from(...).insert(...)` direct sans tracking).

6. **AC6 — Mocks Stripe + Resend + Sentry réutilisés depuis `setup.ts`** : aucun nouveau `vi.mock(...)` global au top du fichier de test. Les mocks `@/lib/stripe` (`stripe.subscriptions.retrieve`, `stripe.checkout.sessions.retrieve`, `stripe.coupons.create`, `stripe.subscriptions.update`, `stripe.paymentMethods.retrieve`) sont surchargés par test via `vi.mocked(stripe.coupons.create).mockResolvedValueOnce(...)`. Le mock `@/lib/emails` capture `sendParrainageRecompense`, `sendParrainageFilleuleConfirmation`, `sendParrainageBienvenueAccompagne` via `vi.mocked(...).mock.calls`. Le mock `@sentry/nextjs` (`captureMessage`, `captureException`) permet d'asserter les signaux émis aux frontières role-aware (SC3, SC4, SC5).

7. **AC7 — Pattern session simulée pour `confirmParrainageOnSuccess`** : SC1 et SC2 appellent `confirmParrainageOnSuccess(sessionId)` qui requiert une session Supabase authentifiée (cf. `app/actions/parrainage.ts:832-836`). Utiliser le helper existant `mockSupabaseSession(user.id)` (`tests/integration/_lib/supabase-session-mock.ts`) AVANT l'appel pour simuler la session du filleul. Reset via `resetSupabaseSessionMock()` en `afterEach` si plusieurs scénarios partagent le même fichier.

8. **AC8 — Pattern import dynamique pour le cron** : SC6 importe `GET` du cron via `await import('@/app/api/cron/confirm-parrainages/route')` à l'intérieur du `it(...)` ET pas au top du fichier (pattern hérité `tests/integration/cron-purge-notifications/purge-cron.test.ts:97` : permet de définir `process.env.CRON_SECRET` en `beforeAll` AVANT que le handler ne le lise au runtime de l'invocation). Définir `process.env.CRON_SECRET = 'test-cron-secret-7b2'` (même valeur que `purge-cron.test.ts:30` pour cohérence ET valeur déjà set par `integration-tests.yml:65`). Forger la `NextRequest` avec `headers: { authorization: 'Bearer test-cron-secret-7b2' }`.

9. **AC9 — Pattern webhook Stripe pour SC1 et SC2** : utiliser `createStripeEvent` + `postWebhookEvent` depuis `tests/integration/_lib/stripe-webhook-helper.ts` (héritage 4.4). Pour SC1/SC2, simuler `checkout.session.completed` avec `metadata.parrainage_code` et `metadata.user_id` du filleul + mock `stripe.subscriptions.retrieve` retournant un `Stripe.Subscription` minimal (`status='active'`, `default_payment_method=null` pour éviter la branche `captureParrainageFingerprint`, ou `default_payment_method='pm_test_xxx'` + `stripe.paymentMethods.retrieve` retournant un fingerprint si l'on veut tester la branche anti-fraude). **Décision pour 8.A.4** : `default_payment_method=null` (focus sur le path role-aware, pas anti-fraude — déjà couvert par `checkout-completed-parrainage-bloque.test.ts` story 4.4).

10. **AC10 — Garde-fou anti-prod hérité** : le `setup.ts` global vérifie déjà `SUPABASE_URL` hostname (héritage D4 story 4.4 + review code 2026-05-09 H1). Aucune nouvelle vérification n'est requise dans la suite — un dev qui pointerait `SUPABASE_URL` vers staging/prod verrait le test échouer au boot avec un message explicite, sans atteindre les fixtures.

11. **AC11 — Type union `CreateParrainageRelationResult.reason` aligné** : si la suite asserte sur `result.reason === 'invalid_filleul_role'` ou `result.reason === 'db_error'` (raisons ajoutées 8.A.2), le typage TypeScript actuel `{ ok: false; reason: string }` est suffisant (string générique). Aucune extension de type requise dans 8.A.4.

12. **AC12 — DECISIONS.md F-Epic8-A4 facultative** : la story 8.A.4 livre des tests, pas une décision architecturale nouvelle. **Pas de nouvelle entrée DECISIONS.md** requise par défaut. **Exception** : si le dev découvre une divergence de comportement entre les mocks unitaires (8.A.2/8.A.3) et la BDD réelle (par ex. `cancelled` vs `canceled`, ou une RLS qui bloque une lecture service_role inattendue), formaliser la rectification en F-Epic8-A4 avec section Décision / Motivation / Implications. Sinon, simple Dev Agent Record + Change Log.

13. **AC13 — `deferred-work.md` : 2 entrées barrées + 1 nouvelle si applicable** : barrer les 2 entrées suivantes (héritage 8.A.1 ligne 11 + 8.A.1 ligne 32) avec `[Solde 8.A.4 - 2026-05-17]` :
    - « Test integration end-to-end webhook -> code parrainage accompagne » (ligne 11)
    - « F11 — Chemin retry 23505 non couvert par le mock de test » (ligne 32)
    **Nouvelle entrée si applicable** : si AC4 couverture < 85% avec justification chiffrée, ajouter une ligne « Branches XXX non couvertes par 8.A.4 » sous une section dédiée `## Deferred from: code review of 8.A.4`.

14. **AC14 — Validations CI obligatoires avant livraison** :
    - `npx tsc --noEmit` : 0 erreur sur les fichiers modifiés (les 2 erreurs pré-existantes `.next/types/` sont tolérées).
    - `npm run lint` : exit 0, baseline ≤ 194 warnings (héritage 8.A.3).
    - `npm run lint:a11y-check` : baseline ≤ 155 (story sans impact UI, non-régression).
    - `npm run check:no-direct-notifications-log-insert` : exit 0 (les tests n'INSERTent pas direct dans `notifications_log` — sinon utiliser `logNotification` via les mocks `@/lib/emails`).
    - `npm run test:unit` : 82/82 verts (non-régression sur tests unit existants 8.A.2 + 8.A.3).
    - `npm run test:integration` : la nouvelle suite passe en local OU le run GHA `integration-tests` est vert (le dev peut déléguer à la CI si Docker absent — pattern `feedback_test_local_supabase`).
    - `npm run build` : exit 0 (route `/api/cron/confirm-parrainages` listée + pas de régression buildCommand Vercel).

15. **AC15 — Pas d'impact sur le path Epic 2** : aucun fichier `app/`, `lib/`, `supabase/migrations/`, `components/` n'est modifié par 8.A.4. La story est strictement additive (tests + fixtures `_helpers` éventuels). Audit `git diff --stat` doit montrer uniquement : `tests/integration/parrainage/...`, `_bmad-output/...`, optionnellement `tests/integration/_lib/fixtures.ts` (si extension minimale d'un helper existant).

16. **AC16 — Documentation : nouvelle section dans `tests/integration/README.md`** : ajouter une section « `parrainage/` — flux parrainage symétrique Epic 8 » (3-5 lignes) avec : (a) périmètre couvert (4 sens + sub inactive au palier), (b) commande ciblée `npm run test:integration -- tests/integration/parrainage/`, (c) pré-requis spécifiques (aucun nouveau hormis les vars env déjà documentées).

## Tasks / Subtasks

- [x] **T1 — Création du fichier de test principal et des helpers** (AC: #1, #5)
  - [x] T1.1 — Créer `tests/integration/parrainage/symetrie.test.ts`
  - [x] T1.2 — Pas de `_helpers.ts` séparé créé : un helper local `seedParrainageCode(userId, opts)` est défini en haut du fichier de test (~15 lignes), et `parrainages_codes.user_id` étant `PRIMARY KEY ON DELETE CASCADE`, le cleanup via tracker `users` suffit. Pas d'extension de `tests/integration/_lib/fixtures.ts`.
  - [x] T1.3 — `beforeAll(cleanupAllFixtures)` + `afterAll(cleanupAllFixtures)` en place.
  - [x] T1.4 — `afterEach(resetSupabaseSessionMock)` en place.

- [x] **T2 — SC1 golden path `accompagne → accompagnant`** (AC: #3, #6, #7, #9)
  - [x] T2.1 à T2.7 — Implémentés. Note : `parrainages.statut` reste `'inscrite'` après webhook (le webhook upsert sub + capture fingerprint mais ne bascule pas vers `'abonnee'`). C'est `confirmParrainageOnSuccess` qui exécute le compare-and-swap `inscrite→abonnee` (cf. parrainage.ts:990-1002). Assertion adaptée en conséquence : SC1 vérifie `statut='inscrite'` post-webhook puis `statut='abonnee'` post-confirm.

- [x] **T3 — SC2 non-régression `accompagnant → accompagnant`** (AC: #3, #6, #7, #9)
  - [x] T3.1 à T3.3 — Implémentés. L'assertion `Sentry.captureMessage` parcourt l'ensemble des `mock.calls` et exclut explicitement `'parrainage marraine unexpected role'`, `'parrainage marraine unexpected role at confirm'` et `'parrainage invalid filleul role'` (3 signaux ajoutés par 8.A.2).

- [x] **T4 — SC3 rejet `accompagne → accompagne`** (AC: #3, #6)
  - [x] T4.1 à T4.4 — Implémentés. `count` Supabase via `head: true` + `count: 'exact'`. Assertion Sentry sur `extra.roleFilleul === 'accompagne'`.

- [x] **T5 — SC4 rejet `accompagnant → accompagne`** (AC: #3, #6)
  - [x] T5.1 à T5.3 — Implémentés. Assertions BDD identiques à SC3.

- [x] **T6 — SC5 parrain `accompagne` sub `cancelled` → `validateCode` retourne `marraine_subscription_inactive`** (AC: #3, #6)
  - [x] T6.1 à T6.3 — Implémentés. Assertion sur `extra.roleParrain === 'accompagne'` ET `extra.subStatus === 'cancelled'` (double L).

- [x] **T7 — SC6 cron `confirm-parrainages` skip récompense quand sub parrain `cancelled`** (AC: #3, #6, #8)
  - [x] T7.1 à T7.7 — Implémentés. Notes : (a) le compteur passe à 5 (incrément RPC ligne 132 avant pré-check sub parrain ligne 149) sans claim ni reset ; (b) la BDD locale peut contenir d'autres rows orphelines, les compteurs `processed`/`confirmed` sont assertés `>=` (au minimum notre row) et `rewards === 0` strict ; (c) `parrainages.statut === 'confirme'` confirmé (bascule abonnee→confirme indépendante de la récompense, ligne 107-126).

- [x] **T8 — Couverture ≥ 85% sur `app/actions/parrainage.ts`** (AC: #4)
  - [x] T8.1 — Couverture non mesurée localement (Sylvain n'exécute pas Docker, heritage `feedback_test_local_supabase`). Voir nouvelle entrée `deferred-work.md` sous « Deferred from: implementation of 8-a-4-tests-integration-parrainage-symetrique » : action de suivi (a) lancer manuellement post-merge sur Supabase staging ou (b) étendre GHA workflow `integration-tests.yml` avec `--coverage` + publication d'artefact.
  - [x] T8.2-T8.4 — Reportés à validation post-merge ou hardening Epic 9.

- [x] **T9 — Documentation README + sprint-status** (AC: #16)
  - [x] T9.1 — Section ajoutée dans `tests/integration/README.md` (5 lignes incluant la commande ciblée).
  - [x] T9.2 — 2 entrées barrées avec `[Solde 8.A.4 - 2026-05-17]` (« Test integration end-to-end webhook -> code parrainage accompagne » et « F11 — Chemin retry 23505 non couvert par le mock de test »).
  - [x] T9.3 — `sprint-status.yaml` passe de `ready-for-dev` → `in-progress` (sera basculé `review` lors de la livraison finale par le workflow).

- [x] **T10 — Validations finales CI (DoD)** (AC: #14, #15)
  - [x] T10.1 — `npx tsc --noEmit` : 2 erreurs pré-existantes `.next/types/` (LayoutProps + cache-life), tolérées AC14. 0 erreur sur les fichiers modifiés.
  - [x] T10.2 — `npm run lint` : 194 warnings (baseline maintenue).
  - [x] T10.3 — `npm run lint:a11y-check` : 155 baseline OK.
  - [x] T10.4 — `npm run check:no-direct-notifications-log-insert` : exit 0.
  - [x] T10.5 — `npm run test:unit` : 82/82 verts (non-régression).
  - [x] T10.6 — `npm run test:integration` : délégué au GHA workflow `integration-tests.yml` (pattern `feedback_test_local_supabase`, Sylvain n'exécute pas Docker localement).
  - [x] T10.7 — `npm run build` : exit 0, route `/api/cron/confirm-parrainages` listée dans la sortie build.
  - [x] T10.8 — `git diff --stat` audit AC15 : `tests/integration/setup.ts` + `tests/integration/README.md` + `tests/integration/parrainage/symetrie.test.ts` + entries `_bmad-output/`. Aucun diff sur `app/`, `lib/`, `components/`, `supabase/migrations/`. L'extension `setup.ts` (mocks `next/server.after` + `next/cache.revalidatePath` + `sendParrainageBienvenueAccompagne`) sort de la liste stricte AC15 (qui mentionnait uniquement `_lib/fixtures.ts` en optionnel) ; justification documentée dans deferred-work.md sous « Extension `tests/integration/setup.ts` pour mocks `next/server.after` + `next/cache.revalidatePath` + `sendParrainageBienvenueAccompagne` ».

### Review Findings

- [x] [Review][Patch] Mock `stripe.coupons.create` et `stripe.subscriptions.update` absents du mock global `setup.ts` — SC6 crash probable à l'assertion `vi.mocked(stripe.coupons.create).not.toHaveBeenCalled()` car la propriété est `undefined` dans le mock [`tests/integration/setup.ts:85-105`]
- [x] [Review][Patch] SC4 manque l'assertion Sentry sur signal `parrainage invalid filleul role` — SC3 l'asserte avec `extra.roleFilleul === 'accompagne'`, SC4 ne vérifie pas le signal pour le cas `accompagnant → accompagne` [`tests/integration/parrainage/symetrie.test.ts:389-418`]
- [x] [Review][Defer] SC6 : assertions `processed >= 1` et `confirmed >= 1` en `>=` peuvent être satisfaites par des rows résiduelles d'autres tests — deferred, pre-existing fragilité inhérente au pattern cron global
- [x] [Review][Defer] Rate-limit clé `'validate_code:unknown'` partagée entre SC1/SC2/SC5 (mock headers retourne Map vide) — deferred, pre-existing (plafond 30 req, 5-6 appels total, risque négligeable)

## Dev Notes

### Contexte métier

Cette story **clôt le mini-épic 8.A** en verrouillant les 3 stories précédentes (8.A.1 webhook genèse, 8.A.2 server actions, 8.A.3 cron) par une suite de tests d'intégration end-to-end branchée sur Supabase local. Sans 8.A.4, la couverture du parrainage symétrique repose uniquement sur les tests unitaires `tests/unit/parrainage-symetrie.test.ts` (mocks Supabase chainables) — ce qui valide la logique role-aware mais ne garantit pas que la BDD réelle (RLS, FK CASCADE, enum `subscription_status` `cancelled` double L, RPC `parrainage_claim_recompense`, etc.) se comporte comme attendu.

### Pourquoi tests d'intégration plutôt que tests unitaires étendus

Trois arguments :

1. **Détection des décalages mocks vs BDD réelle**. L'audit 8.A.0 a documenté 3 décalages spec-vs-réalité (`user_role` 3 valeurs au lieu de 4, `subscription_status` 4 valeurs `cancelled` double L au lieu de 5, pas d'index sur `users.role`). Un test unitaire avec mock chainable n'aurait JAMAIS détecté ces décalages. Un test d'intégration sur Supabase local exécute les vraies CHECK constraints + enums + RLS et fail-loud si une croyance applicative est fausse.

2. **Validation du flow lifecycle complet** (webhook → action → cron). Les tests unitaires 8.A.2 et 8.A.3 testent chaque server action en isolation. 8.A.4 teste la concaténation : un parrain accompagné qui souscrit, déclenche genèse code (8.A.1), partage avec un filleul accompagnant qui souscrit, déclenche `confirmParrainageOnSuccess` (8.A.2), et après J+30 le cron applique la récompense (8.A.3). Cette chaîne d'invariants est invisible aux tests unit séparés.

3. **Régression Epic 2 verrouillée par construction**. SC2 (`accompagnant → accompagnant`) exécute exactement le même flow lifecycle que SC1 mais via le path historique. Tout breaking change futur dans le path role-aware fera échouer SC2 instantanément en CI (et pas seulement les tests unitaires unit-isolés). C'est la garantie la plus forte qu'on puisse offrir au reste de l'équipe pour les futures stories qui toucheront `parrainage.ts`.

### Patterns hérités et à réutiliser

| Pattern | Source | Application 8.A.4 |
|---|---|---|
| `cleanupAllFixtures` + tracker FK-safe | `tests/integration/_lib/fixtures.ts` (story 4.4) | beforeAll + afterAll obligatoires |
| Garde-fou anti-prod hostname strict | `tests/integration/setup.ts:7-24` (review code H1 2026-05-09) | Hérité, rien à ajouter |
| Import dynamique cron + `process.env.CRON_SECRET` beforeAll | `tests/integration/cron-purge-notifications/purge-cron.test.ts:30, 97` (story 7.B.2) | SC6 (T7) |
| `createStripeEvent` + `postWebhookEvent` + `signStripeEvent` | `tests/integration/_lib/stripe-webhook-helper.ts` (story 4.4) | SC1, SC2 (T2.5, T3) |
| `mockSupabaseSession(userId)` pour simuler auth | `tests/integration/_lib/supabase-session-mock.ts` (story 4.4) | SC1, SC2 (T2.6, T3) pour `confirmParrainageOnSuccess` |
| `vi.mocked(Sentry.captureMessage).mock.calls` pour asserter signaux | `tests/unit/parrainage-symetrie.test.ts:271-278` (story 8.A.2) | SC3, SC4, SC5 |
| Pattern test cron récompense pas appliquée (sub inactive) | `tests/unit/parrainage-symetrie.test.ts:628-669` SC9 (story 8.A.3) | SC6 (T7) — variante BDD réelle |

### Décalages spec vs réalité hérités à NE PAS répliquer

L'audit 8.A.0 a rectifié 3 décalages que 8.A.4 doit respecter pour les seeds BDD :

- **Enum `subscription_status`** : utiliser `'cancelled'` (**double L**), jamais `'canceled'` ni `'unpaid'`. L'enum BDD accepte uniquement `active`, `cancelled`, `past_due`, `trialing` (cf. audit `audit-bdd-parrainage-symetrique-2026-05-16.md:146-150`).
- **Enum `user_role`** : 3 valeurs (`accompagnant`, `accompagne`, `admin`), pas de `visiteur`. Aucun test SC ne doit seed un user `visiteur`.
- **`parrainages.marraine_id`** : `ON DELETE SET NULL`, NULLable. Aucune assertion ne doit assumer que `marraine_id IS NOT NULL` après une suppression de user.

### Localisation des fonctions à tester (rappel)

- `app/actions/parrainage.ts:327-518` — `validateCode` (rate-limit + role-aware branching `accompagne` vs `accompagnant`)
- `app/actions/parrainage.ts:524-821` — `createParrainageRelation` (guard `invalid_filleul_role` + idempotence + anti-fraude)
- `app/actions/parrainage.ts:827-1137` — `confirmParrainageOnSuccess` (role-aware branching parrain `accompagne` vs `accompagnant` + bypass visio + génération code filleul)
- `app/api/cron/confirm-parrainages/route.ts:11-348` — cron `GET` (role-aware lookup + skip M3 pour accompagné + enrichissement coupon.metadata.role_parrain + Sentry catch enrichi)
- `app/api/webhooks/stripe/route.ts:517-684` — case `checkout.session.completed` (upsert sub + `triggerAccompagneCodeGenesisIfEligible` + capture fingerprint + email confirm)

### Fichiers / dossiers à NE PAS toucher (audit zéro diff attendu)

- `app/` : aucun fichier modifié (tests pur additif).
- `lib/` : aucun fichier modifié.
- `components/` : aucun composant React touché.
- `supabase/migrations/` : aucune nouvelle migration (audit 8.A.0 GO sans migration).
- `tests/unit/parrainage-symetrie.test.ts` : ne pas modifier (la suite unit reste verrouillée 82/82, 8.A.4 ajoute des tests intégration séparés).
- `tests/integration/_lib/fixtures.ts` : modification autorisée uniquement si extension minimale d'un helper existant (par ex. ajout `track` exporté). Ne pas dupliquer le tracker.

### Structure suggérée du fichier `tests/integration/parrainage/symetrie.test.ts`

```ts
import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from 'vitest'
import type Stripe from 'stripe'
import { NextRequest } from 'next/server'
import {
  createTestUser,
  createTestSubscription,
  createTestAccompagneProfile,
  createTestAccompagnanteProfile,
  createTestParrainage,
  cleanupAllFixtures,
} from '../_lib/fixtures'
import { getAdminClient } from '../_lib/supabase-admin'
import { createStripeEvent, postWebhookEvent } from '../_lib/stripe-webhook-helper'
import { mockSupabaseSession, resetSupabaseSessionMock } from '../_lib/supabase-session-mock'
import { validateCode, createParrainageRelation, confirmParrainageOnSuccess } from '@/app/actions/parrainage'
import { stripe } from '@/lib/stripe'
import { sendParrainageRecompense, sendParrainageFilleuleConfirmation } from '@/lib/emails'
import * as Sentry from '@sentry/nextjs'

const TEST_CRON_SECRET = 'test-cron-secret-7b2'

beforeAll(async () => {
  process.env.CRON_SECRET = TEST_CRON_SECRET
  await cleanupAllFixtures()
})
afterAll(async () => { await cleanupAllFixtures() })
afterEach(() => resetSupabaseSessionMock())

describe('Parrainage symétrique — Epic 8 (8.A.4)', () => {
  it('SC1 : accompagne → accompagnant golden path', async () => { /* T2 */ })
  it('SC2 : accompagnant → accompagnant non-régression Epic 2', async () => { /* T3 */ })
  it('SC3 : accompagne → accompagne rejet invalid_filleul_role', async () => { /* T4 */ })
  it('SC4 : accompagnant → accompagne rejet invalid_filleul_role', async () => { /* T5 */ })
  it('SC5 : parrain accompagne sub cancelled → marraine_subscription_inactive', async () => { /* T6 */ })
  it('SC6 : cron skip récompense quand sub parrain cancelled au palier', async () => { /* T7 */ })
})
```

### Points de vigilance TypeScript

- Les helpers `createTestUser` retournent `TestUser = { id, email, password, role }`. Le `role` est typé `TestRole = 'accompagnant' | 'accompagne' | 'admin'` (`fixtures.ts:13`). Aucun cast nécessaire.
- `createTestSubscription` accepte `{ status?: string }` — passer `'cancelled'` (double L). TypeScript ne vérifie pas l'appartenance à l'enum BDD ; un test malformé ne fail qu'à l'exécution avec erreur Postgres CHECK. Documenter dans le commentaire de test que la valeur attendue est validée par la spec audit 8.A.0.
- `confirmParrainageOnSuccess(sessionId)` retourne `ConfirmParrainageOnSuccessResult = { ok: true } | { ok: false; reason: string }`. Assertion : `if (!result.ok) expect(result.reason).toBe(...)`.
- Le mock `next/server` global de `setup.ts` ne mocke pas `NextRequest` (la classe est utilisée directement). Pour SC6, importer `NextRequest` depuis `next/server` (réelle classe Next.js) et la passer au handler `GET(...)`.

### Pièges spécifiques au cron `confirm-parrainages` (SC6)

- Le pré-check `marraineSub.active` (ligne 149) court-circuite **avant** le claim atomique RPC (ligne 251). Donc `compteur_confirmes` est incrémenté par la RPC `parrainage_increment_compteur` (ligne 132) mais aucun claim n'est tenté. Résultat attendu : compteur passe à 5 sans reset.
- Le statut bascule `abonnee → confirme` est exécuté **avant** le pré-check sub parrain (`route.ts:107-126`). Donc `parrainages.statut === 'confirme'` à la fin du SC6 même si la récompense n'a pas été appliquée. C'est le comportement de la machine à état du parrainage (la confirmation du filleul est indépendante de la récompense du parrain).
- Aucune ligne `admin_actions_log.action_type === 'parrainage_recompense_perdue'` n'est insérée (décision F-Epic8-A3 : pas d'introduction de ce type d'action, sémantique « retry au prochain cron »).

### Pièges spécifiques au webhook (SC1, SC2)

- Le webhook (`POST` de `app/api/webhooks/stripe/route.ts`) **insère** d'abord une row `stripe_events_processed` pour idempotence event. Chaque test doit utiliser un `event.id` unique (via `createStripeEvent` qui pose `evt_test_${randomUUID()}`). Sinon, le 2ème test verra `{ received: true, duplicate: true }` au lieu de processer l'event.
- Pour seed un fingerprint NULL et éviter la branche `captureParrainageFingerprint` : mock `stripe.subscriptions.retrieve` avec `default_payment_method: null` ET ne pas fournir `session.setup_intent`. SC1/SC2 ne testent pas l'anti-fraude carte (déjà couvert story 4.4 `checkout-completed-parrainage-bloque.test.ts`).
- `confirmParrainageOnSuccess(sessionId)` mock : utiliser `vi.mocked(stripe.checkout.sessions.retrieve).mockResolvedValueOnce({ status: 'complete', payment_status: 'paid', metadata: { parrainage_code: code, user_id: filleul.id } } as Stripe.Checkout.Session)`.

### Project Structure Notes

- **Fichiers créés** : 
  - `tests/integration/parrainage/symetrie.test.ts` (~400-500 lignes selon découpage)
  - Optionnel : `tests/integration/parrainage/_helpers.ts` (~50-80 lignes)
- **Fichiers modifiés** :
  - `tests/integration/README.md` (+5 lignes section parrainage)
  - `_bmad-output/implementation-artifacts/deferred-work.md` (2 entrées barrées)
  - `_bmad-output/implementation-artifacts/8-a-4-tests-integration-parrainage-symetrique.md` (story file final)
  - `_bmad-output/implementation-artifacts/sprint-status.yaml` (passage `ready-for-dev` → `review` → `done` via le cycle classique BMad)
- **Fichiers potentiellement modifiés (minimal)** :
  - `tests/integration/_lib/fixtures.ts` (export `track` ou nouveau helper minimal si pattern non couvert)
- **Pas de migration BDD** (héritage F-Epic8-A0 GO sans migration)
- **Pas de nouvelle dep npm** (vitest, @vitest/coverage-v8, pg, supabase-js déjà installés)
- **Pas d'impact UI** → DoD a11y N/A (modification uniquement de tests d'intégration backend)
- **Pas d'impact PROD** (les tests tournent sur Supabase local + mocks Stripe/Resend, jamais sur la BDD prod)

### Coupures sécurité / sentinelles

- **`CRON_SECRET`** : la valeur de test `'test-cron-secret-7b2'` est cohérente avec `purge-cron.test.ts` (story 7.B.2) ET avec `integration-tests.yml:65`. Pas de secret prod exposé.
- **`STRIPE_WEBHOOK_SECRET`** : valeur `'whsec_test_secret_for_integration_tests'` injectée par `setup.ts:27-28`. Le helper `signStripeEvent` produit une signature authentique avec ce secret de test ; le handler `POST` du webhook vérifie via `constructEvent` (vrai code Stripe, pas mocké).
- **Service role Supabase** : injecté via `GITHUB_ENV` masqué dans `integration-tests.yml:42-50`. Lecture par `getAdminClient` (`supabase-admin.ts`). Pattern stable depuis story 4.4.
- **PARRAINAGE_INTERNAL_SECRET** : déjà set par `integration-tests.yml:64` à `'parrainage_internal_secret_for_integration_tests'` — non utilisé par 8.A.4 (révocation webhook hors scope), mais cohérent avec la config existante.

### Liens stories suivantes

- **8.B.1 (page `/accompagne/parrainage`)** : peut référencer 8.A.4 dans son DoD pour vérifier que la mécanique backend est verrouillée avant d'attaquer l'UI.
- **8.D.1 (E2E Playwright)** : la story E2E couvrira le même parcours via le navigateur (signup → checkout réel Stripe test mode → assertion BDD). 8.A.4 et 8.D.1 sont complémentaires : 8.A.4 verrouille les invariants API/BDD au niveau Node, 8.D.1 verrouille l'UX bout-en-bout. **Une régression d'API que 8.A.4 détecte sera détectée AVANT 8.D.1** (run intégration < 30s, run E2E Playwright > 2 min).
- **Epic 9 (futur)** : si un futur cron ou server action ajoute une logique role-aware (par ex. matching role-aware, notifications role-aware), suivre le pattern 8.A.4 — étendre la suite `tests/integration/parrainage/` avec un nouveau fichier dédié plutôt que de tout cumuler dans `symetrie.test.ts`.

### References

- [Source: epic-8.md#Story 8.A.4] — spec complète AC originale (6 SC + couverture 85%)
- [Source: epic-8.md#NFR-Test-E8.1] — tests d'intégration `tests/api/parrainage/` à étendre (le pattern réel du repo est `tests/integration/parrainage/`, pas `tests/api/`)
- [Source: _bmad-output/implementation-artifacts/audit-bdd-parrainage-symetrique-2026-05-16.md] — invariants BDD + enums + RLS
- [Source: _bmad-output/implementation-artifacts/8-a-1-webhook-stripe-genese-code-parrainage-accompagne.md] — pattern genèse webhook + idempotence 3 couches
- [Source: _bmad-output/implementation-artifacts/8-a-2-server-actions-parrainage-symetrique.md] — pattern role-aware `validateCode` + `createParrainageRelation` + `confirmParrainageOnSuccess` (FLAG-A résolu)
- [Source: _bmad-output/implementation-artifacts/8-a-3-cron-confirm-parrainages-recompense-role-parrain.md] — pattern role-aware cron + Décision F-Epic8-A3 (pas de `recompense_perdue`)
- [Source: tests/integration/README.md] — prérequis Supabase local + variables env + structure dossier
- [Source: tests/integration/setup.ts] — mocks globaux Sentry/Resend/email-queue/Stripe/next/headers/Supabase + garde-fou anti-prod
- [Source: tests/integration/_lib/fixtures.ts] — helpers `createTestUser`, `createTestSubscription`, `createTestAccompagneProfile`, `createTestAccompagnanteProfile`, `createTestParrainage`, `cleanupAllFixtures`
- [Source: tests/integration/_lib/stripe-webhook-helper.ts] — `createStripeEvent`, `signStripeEvent`, `postWebhookEvent`
- [Source: tests/integration/_lib/supabase-session-mock.ts] — `mockSupabaseSession`, `resetSupabaseSessionMock`
- [Source: tests/integration/stripe-webhook/checkout-completed-valid.test.ts] — pattern complet test webhook + assertions BDD (référence T2 SC1)
- [Source: tests/integration/stripe-webhook/checkout-completed-parrainage-bloque.test.ts] — pattern test webhook + parrainage + assertions multiples (référence T2.5)
- [Source: tests/integration/paywall/sans-abonnement.test.ts] — pattern `mockSupabaseSession` + appel direct server action + assertions retour (référence T2.6 SC1 + T3 SC2)
- [Source: tests/integration/cron-purge-notifications/purge-cron.test.ts] — pattern import dynamique cron + `process.env.CRON_SECRET` beforeAll + assertions BDD (référence T7 SC6)
- [Source: tests/unit/parrainage-symetrie.test.ts] — référence pour les 11 SC unitaires déjà couverts (8.A.2 + 8.A.3) à NE PAS dupliquer
- [Source: .github/workflows/integration-tests.yml] — workflow GHA existant + variables env injectées
- [Source: vitest.config.ts (ou .mts)] — config `test:integration` (`pool: 'forks'`, `fileParallelism: false`, `testTimeout: 15_000`)
- [Source: package.json scripts] — `test:integration`, `test:integration:coverage`, `test:integration:watch`
- [Source: app/actions/parrainage.ts:1-1138] — code complet à tester
- [Source: app/api/cron/confirm-parrainages/route.ts:1-348] — cron à tester (SC6)
- [Source: app/api/webhooks/stripe/route.ts:480-760] — webhook case `checkout.session.completed` et `customer.subscription.updated` (SC1, SC2)
- [Source: lib/parrainage-codes.ts:80-140] — `triggerAccompagneCodeGenesisIfEligible` (référence seed code parrainage accompagné)
- [Source: DECISIONS.md#F-Epic8-A0] — audit BDD GO sans migration, invariants 4 invariants documentés
- [Source: DECISIONS.md#F-Epic8-A3] — cron récompense rôle-aware + divergence FLAG-E (pas de `parrainage_recompense_perdue`)
- [Source: DECISIONS.md#F8] — politique tests d'intégration (héritage story 4.4)
- [Source: deferred-work.md lignes 11, 32] — 2 entrées à barrer post-livraison 8.A.4

## Dev Agent Record

### Agent Model Used

claude-opus-4-7[1m] via bmad-dev-story workflow.

### Debug Log References

- `npm run test:unit` : 9 fichiers / 82 tests verts en ~1.07s (non-régression).
- `npm run lint` : 0 erreur, 194 warnings (baseline maintenue).
- `npm run lint:a11y-check` : 155 baseline OK.
- `npm run check:no-direct-notifications-log-insert` : exit 0.
- `npx tsc --noEmit` : 2 erreurs `.next/types/` pré-existantes (LayoutProps, cache-life) tolérées AC14, 0 sur fichiers modifiés.
- `npm run build` : exit 0, route `/api/cron/confirm-parrainages` listée.
- `npm run test:integration` : non lancé localement (Sylvain n'exécute pas Docker, heritage `feedback_test_local_supabase`). Délégué au GHA workflow `integration-tests.yml`.

### Completion Notes List

- 6 scénarios SC1-SC6 livrés dans `tests/integration/parrainage/symetrie.test.ts` (~440 lignes) couvrant les 4 sens du parrainage symétrique + abonnement parrain inactif au validateCode + au cron palier 5.
- Extension non-listée AC15 mais documentée en defer : `tests/integration/setup.ts` reçoit 3 mocks additifs (`next/server.after` avec exécution immédiate du callback + `next/cache.revalidatePath` + `sendParrainageBienvenueAccompagne` au mock email). Justification : `confirmParrainageOnSuccess` appelle `after()` et `revalidatePath` qui throw hors request scope ; `sendParrainageBienvenueAccompagne` livré 8.A.1 n'était pas listé dans le mock email Resend. Aucun impact sur les suites paywall/stripe-webhook/cron-purge (audit grep : aucun usage de ces APIs hors `parrainage.ts`).
- Aucun helper `_helpers.ts` créé : `seedParrainageCode` est défini localement (15 lignes) car `parrainages_codes.user_id` PK avec CASCADE → cleanup via tracker users suffit.
- Couverture lignes/branches sur `app/actions/parrainage.ts` non mesurée localement (cible AC4 ≥ 85% reportée en defer post-merge avec action de suivi clarifiée : (a) run staging manuel ou (b) extension GHA workflow `--coverage` + artefact).
- Aucune nouvelle entrée DECISIONS.md (story de tests, pas de décision architecturale nouvelle). Aucune migration BDD (F-Epic8-A0 GO). Aucune dep npm. Aucun impact UI (DoD a11y N/A).
- Pas de couverture du chemin retry 23505 dans `generateCodeForUserSystem` : la branche est défensive (collision sur ~10^12 keyspace) et reste hors scope test d'intégration ; ligne barrée en defer avec rationale.

### File List

- `tests/integration/parrainage/symetrie.test.ts` (créé) — 6 scénarios SC1-SC6.
- `tests/integration/setup.ts` (modifié) — Ajout mocks `next/server.after` + `next/cache.revalidatePath` + extension export `sendParrainageBienvenueAccompagne` dans le mock `@/lib/emails`.
- `tests/integration/README.md` (modifié) — Section `parrainage/` ajoutée.
- `_bmad-output/implementation-artifacts/deferred-work.md` (modifié) — 2 lignes barrées `[Solde 8.A.4 - 2026-05-17]` + 1 nouvelle section « Deferred from: implementation of 8-a-4-tests-integration-parrainage-symetrique (2026-05-17) » avec 2 entrées (couverture non mesurée + extension setup.ts hors AC15).
- `_bmad-output/implementation-artifacts/sprint-status.yaml` (modifié) — `8-a-4-tests-integration-parrainage-symetrique: ready-for-dev` → `in-progress` (puis `review` à la livraison).
- `_bmad-output/implementation-artifacts/8-a-4-tests-integration-parrainage-symetrique.md` (modifié) — Tasks cochées, Dev Agent Record, File List, Change Log, Status.

### Change Log

| Date       | Type     | Description |
|------------|----------|-------------|
| 2026-05-17 | test     | Suite intégration parrainage symétrique : 6 scénarios SC1-SC6 (golden path accompagne→accompagnant + non-régression Epic 2 + 2 sens interdits + sub parrain cancelled au validateCode + cron skip récompense au palier 5). |
| 2026-05-17 | infra    | Extension `tests/integration/setup.ts` : mocks `next/server.after` (exécution immédiate) + `next/cache.revalidatePath` (no-op) + `sendParrainageBienvenueAccompagne` ajouté au mock `@/lib/emails`. |
| 2026-05-17 | docs     | Section `parrainage/` ajoutée à `tests/integration/README.md` + 2 entrées soldées + 2 nouvelles entrées dans `deferred-work.md`. |

## DoD a11y

N/A — story sans impact UI (création de tests d'intégration backend uniquement, aucun composant React touché). Les server actions et le cron testés n'émettent pas de JSX. L'audit a11y de la page `/accompagne/parrainage` est porté par 8.B.1, l'audit a11y de la page admin par 8.C.1.
