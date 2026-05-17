# Story 9.A.1 : Refonte mocks Supabase `fromMock` discriminants par table

Status: done

## Story

As a **développeur tests unit du projet**,
I want **factoriser les `fromMock` Supabase de `tests/unit/parrainage-symetrie.test.ts` dans un helper partagé `tests/unit/_lib/supabase-mock.ts` qui discrimine par nom de table**,
so that **un refactor futur de l'ordre des appels `from('table_name')` dans `app/actions/parrainage.ts` ne fait plus passer les tests avec une mauvaise table (defer I6 rétro Epic 8)**.

## Contexte

La rétrospective Epic 8 (`epic-8-retro-2026-05-17.md#I6`) identifie une **dette qui grandit story par story** : les SC1–SC5 de `tests/unit/parrainage-symetrie.test.ts` reposent sur un **dispatcher séquentiel positionnel** (`callIdx++` sur un tableau `tables[]`) qui ignore complètement le nom de la table passée à `supabase.from(...)`. Si demain on inverse l'ordre `from('users')` et `from('subscriptions')` dans `validateCode`, les tests passent silencieusement avec la mauvaise donnée injectée dans la mauvaise branche.

Le `buildCronFromMock` interne (lignes 482–520 du même fichier, ajouté en story 8.A.3) **a déjà résolu** le problème côté SC8–SC11 en indexant les réponses par nom de table (`responses: { parrainages?: [], users?: [], ... }`). 9.A.1 généralise ce pattern : (a) extraction dans un helper partagé `tests/unit/_lib/supabase-mock.ts`, (b) migration de SC1–SC5 du dispatcher positionnel vers la version par-table, (c) couverture du helper par ses propres tests unit.

**Périmètre strict** : modification limitée à `tests/unit/` (et `tests/unit/_lib/` créé pour la story). Pas de modification du code applicatif (`app/`, `lib/`, `components/`). Pas d'impact CI hors nouveau fichier passant `npm run test:unit`.

## Acceptance Criteria

1. **AC1** — Helper partagé créé : `tests/unit/_lib/supabase-mock.ts` exposant une fonction `createSupabaseFromMock(responses)` où `responses` est un objet typé `Record<TableName, { data: unknown; error: null }[]>`. Le helper retourne `{ fromMock, calls, capturedInserts, capturedUpdates }` (au minimum `fromMock` et `calls`), pattern hérité de `buildCronFromMock`.

2. **AC2** — Le helper supporte au minimum les chaînes Supabase utilisées dans `app/actions/parrainage.ts` + `app/api/cron/confirm-parrainages/route.ts` : `.select()`, `.eq()`, `.neq()`, `.not()`, `.is()`, `.in()`, `.order()`, `.limit()`, `.lte()`, `.gte()`, `.single()`, `.maybeSingle()`, `.insert()`, `.update().eq()`, `.update().eq().select()`. L'absence d'une méthode dans la chaîne ne doit pas faire échouer le test (chainable par défaut).

3. **AC3** — Le helper retourne `data: null, error: null` par défaut si le pool de réponses pour une table est épuisé (préserve la sémantique actuelle de `buildCronFromMock:491` `pool[indices[table]++] ?? null`).

4. **AC4** — Le helper capture les payloads d'`insert` dans un tableau accessible (`capturedInserts: Record<TableName, unknown[]>`), pour permettre l'assertion `expect(adminLogInserts[0]).toMatchObject(...)` actuelle SC8/SC10.

5. **AC5** — Le helper capture les payloads d'`update` (au minimum la combinaison `payload + table`), pour permettre l'assertion AC4 actuelle SC5 (`updatePayloads.push({ table, ...payload })`).

6. **AC6** — `buildCronFromMock` (`tests/unit/parrainage-symetrie.test.ts:482-520`) supprimé en faveur du helper partagé. Les 4 SC8–SC11 utilisant `buildCronFromMock` migrent vers `createSupabaseFromMock` sans changement de comportement. Tous les `expect(fromMock).toHaveBeenCalledWith('table_name')` et `expect(...).not.toHaveBeenCalledWith(...)` actuels restent verts.

7. **AC7** — Les 5 SC1–SC5 (dispatcher positionnel actuel) migrent vers `createSupabaseFromMock` :
   - SC1 (validateCode parrain accompagné active) : 3 entrées `{ parrainages_codes: [...], users: [...], subscriptions: [...] }`.
   - SC2 (sub cancelled) : 3 entrées idem mais subscription cancelled.
   - SC3 (validateCode parrain accompagnant non-régression) : 4 entrées avec `users` à 2 réponses (role+fn puis embed accompagnants_profiles).
   - SC4 (guard invalid_filleul_role) : 3 entrées validateCode + 1 entrée `users` guard filleul role=accompagne.
   - SC5 (golden path createParrainageRelation) : 5+ entrées par table, conservation de l'assertion `updatePayloads` AC4.

8. **AC8** — Tests dédiés au helper créés : `tests/unit/supabase-mock.test.ts` couvrant :
   - (a) dispatch par table : 2 appels `.from('users')` retournent réponses 1 puis 2 du pool `users`, indépendamment d'un appel intercalé `.from('subscriptions')`.
   - (b) défaut `null` si pool épuisé.
   - (c) capture `insert` accumule dans `capturedInserts[tableName]`.
   - (d) capture `update` accumule `{ table, payload }`.
   - (e) chainable : `.from('x').select().eq().not().is().order().limit().maybeSingle()` ne throw pas.
   - (f) appel sans réponse seedée pour la table (table absente de `responses`) retourne `data: null, error: null`.

9. **AC9** — `npm run test:unit` exit 0 avec **strictement le même nombre de tests qu'avant** (87/87) **plus les nouveaux tests AC8** (88+ au total). Aucune régression sur les autres tests unit (notifications-log, parrainage-codes-genesis, parrainage-emails-subjects, escape-html, get-client-ip, check-required-env, check-no-direct-notifications-log-insert, cron-purge-ip-addresses, cron-purge-notifications).

10. **AC10** — `tsc --noEmit` exit 0 sur fichiers modifiés (2 erreurs `.next/types/` pré-existantes tolérées, baseline 8.D.1).

11. **AC11** — `npm run lint` baseline 192 warnings préservée (0 erreur).

12. **AC12** — `npm run lint:a11y-check` exit 0 baseline 155 préservée (story sans impact UI, mais run de sécurité).

13. **AC13** — `npm run build` exit 0 (la story ne modifie que `tests/`, mais run de sécurité après refactor).

14. **AC14** — Story sans impact UI = **DoD a11y N/A** (cf. CLAUDE.md projet, règle a11y obligatoire pour stories à impact UI uniquement).

15. **AC15** — `deferred-work.md` : ajouter une entrée `[Solde 9.A.1 - YYYY-MM-DD]` barrant le defer Epic 8 I6 « mocks Supabase chainables `fromMock` non discriminants par table » (rétro Epic 8 ligne ~110). Si une autre dette pré-existante mocks est résolue en passant, la barrer aussi.

16. **AC16** — Documentation : ajouter une section « Helpers » dans `tests/unit/README.md` (créer le fichier si absent — il n'existe peut-être pas) décrivant :
   - Importer : `import { createSupabaseFromMock } from './_lib/supabase-mock'`.
   - Usage minimal : exemple avec 2 tables (users + subscriptions).
   - Différence avec le pattern dispatcher positionnel ancien (résumé d'1 phrase).
   - Lien vers `tests/unit/parrainage-symetrie.test.ts` comme exemple de référence.

## Tasks / Subtasks

- [x] **T1 — Créer le helper `tests/unit/_lib/supabase-mock.ts`** (AC1, AC2, AC3, AC4, AC5)
  - [x] T1.1 Créer dossier `tests/unit/_lib/` (n'existe pas, pendant de `tests/integration/_lib/`).
  - [x] T1.2 Définir type `TableName = ... | string` (union typée + ouverture string via `string & {}`).
  - [x] T1.3 Définir signature `createSupabaseFromMock(responses)` retournant `{ fromMock, calls, capturedInserts, capturedUpdates }`.
  - [x] T1.4 Implémenter la chaîne héritée stricte de `buildCronFromMock:494-516`.
  - [x] T1.5 `insert(payload)` chainable supportant `.select().single()` ET Promise directe via `then(resolve)` (compat `admin_actions_log` et `parrainages`).

- [x] **T2 — Migrer SC1–SC5 du dispatcher positionnel vers le helper** (AC7)
  - [x] T2.1 SC1 migré (3 tables seedées).
  - [x] T2.2 SC2 migré (subscription cancelled).
  - [x] T2.3 SC3 migré (2 entrées `users` : role+fn puis embed accompagnants_profiles).
  - [x] T2.4 SC4 migré (pool `users` = 2 entrées validateCode + guard filleul).
  - [x] T2.5 SC5 migré : `updatePayloads` consommé via `capturedUpdates` du helper ; pool `parrainages` = `[null, {id:PARRAINAGE_ID}]` pour idempotence + insert.

- [x] **T3 — Migrer SC8–SC11 de `buildCronFromMock` vers le helper partagé** (AC6)
  - [x] T3.1 Suppression `buildCronFromMock` (lignes 482–520) + type `CronTableResponses`.
  - [x] T3.2 SC8 : `createSupabaseFromMock(responses)` + `adminLogInserts` calculé depuis `capturedInserts.admin_actions_log`.
  - [x] T3.3 SC9/SC10/SC11 idem ; assertions `toHaveBeenCalledWith`/`not.toHaveBeenCalledWith('accompagnants_profiles')` restent vertes.
  - [x] T3.4 `buildClaimRpc` + `buildCronRequest` conservés (hors scope).

- [x] **T4 — Tests du helper** (AC8)
  - [x] T4.1 `tests/unit/supabase-mock.test.ts` créé.
  - [x] T4.2 Test (a) dispatch par table indépendant des appels intercalés.
  - [x] T4.3 Test (b) défaut `{ data: null, error: null }` si pool épuisé.
  - [x] T4.4 Test (c) capture insert (admin_actions_log avec 2 inserts).
  - [x] T4.5 Test (d) capture update : `[{ table: 'users', payload }, { table: 'parrainages', payload }]`.
  - [x] T4.6 Test (e) chaîne complète sans throw.
  - [x] T4.7 Test (f) table absente du `responses` retourne null.
  - Bonus : test additionnel `insert().select().single()` (couvre le 2e mode).

- [x] **T5 — Solder defer `deferred-work.md`** (AC15)
  - [x] T5.1 Ligne 78 identifiée : « Mocks `fromMock` séquentiels non discriminants, `mockAfter` exécuté sync sans await, `mockNormalizeEmail` vide ».
  - [x] T5.2 Préfixée `[Solde 9.A.1 - 2026-05-17]` avec note explicite : sous-volets `mockAfter` sans await + `mockNormalizeEmail` vide non couverts par 9.A.1 (volets distincts du I6 strict mocks Supabase), restent ouverts pour future story hardening.
  - [x] T5.3 Aucun autre defer connexe à barrer (grep `fromMock`/`dispatcher séquentiel` retourne 1 seule occurrence).

- [x] **T6 — Documentation `tests/unit/README.md`** (AC16)
  - [x] T6.1 Fichier absent — créé.
  - [x] T6.2 Section « Helpers — Mocks Supabase » avec import, signature, exemple 2 tables, contraste avec le dispatcher positionnel, lien vers `parrainage-symetrie.test.ts`.

- [x] **T7 — DoD CI complet** (AC9, AC10, AC11, AC12, AC13)
  - [x] T7.1 `npx tsc --noEmit` exit 0 (aucune erreur sur fichiers nouveaux ; baseline préservée).
  - [x] T7.2 `npm run lint` 192 warnings (0 erreur).
  - [x] T7.3 `npm run lint:a11y-check` exit 0 — baseline 155 préservée.
  - [x] T7.4 `npm run test:unit` exit 0 — **94 tests verts** (87 baseline + 7 nouveaux helper, AC9 ≥88 satisfait).
  - [x] T7.5 `npm run check:no-direct-notifications-log-insert` exit 0.
  - [x] T7.6 `npm run check:as-any-global` exit 0.
  - [x] T7.7 `npm run check:oracle-paywall` exit 0.
  - [x] T7.8 `npm run build` exit 0.
  - [x] T7.9 Pas de `a11y:axe:check` requis (DoD a11y N/A — AC14).

- [x] **T8 — Validation runtime locale (sans Docker)** (AC9)
  - [x] T8.1 Validation via `npm run test:unit` local (pas de BDD requise).
  - [x] T8.2 Pas de GHA `integration-tests` requis (story 100% unit).

## Dev Notes

### Architecture & patterns hérités

- **Pattern source** : `buildCronFromMock` (lignes 482–520 de `tests/unit/parrainage-symetrie.test.ts`) déjà table-aware. Le helper 9.A.1 est l'extraction + généralisation de cet existant. Pas d'invention de pattern — copier-coller-adapter.
- **Convention `_lib/`** : `tests/integration/_lib/` existe déjà (fixtures.ts, stripe-webhook-helper.ts, supabase-admin.ts, supabase-session-mock.ts). 9.A.1 introduit le pendant unit `tests/unit/_lib/`. Aligné [Source: tests/integration/_lib/].
- **Pas de vi.mock global ajouté** : le helper retourne un objet `{ fromMock, ... }` que chaque test passe à `mockCreateClient.mockResolvedValue({ ...rpc, from: fromMock })`. Aucun changement aux `vi.mock` du haut du fichier `parrainage-symetrie.test.ts`. [Source: tests/unit/parrainage-symetrie.test.ts:1-95]
- **Mocks Supabase chainables** : la chaîne doit retourner `this` (`vi.fn().mockReturnThis()`) sur toutes les méthodes non-terminales (`select`, `eq`, `neq`, `not`, `is`, `in`, `order`, `limit`, `lte`, `gte`) et `mockResolvedValue` sur les terminales (`single`, `maybeSingle`, `then` implicite via Promise pour `insert`/`update`). [Source: tests/unit/parrainage-symetrie.test.ts:494-517 buildCronFromMock]

### Source tree

**Fichiers créés :**
- `tests/unit/_lib/supabase-mock.ts` (~80–120 lignes, copier-coller-adapter de `buildCronFromMock`).
- `tests/unit/supabase-mock.test.ts` (~80 lignes, 6 tests AC8 a–f).
- `tests/unit/README.md` si absent (~30 lignes minimal).

**Fichiers modifiés :**
- `tests/unit/parrainage-symetrie.test.ts` :
  - Suppression `buildCronFromMock` (lignes 482–520) + type `CronTableResponses`.
  - Migration 9 SC (SC1–SC5 + SC8–SC11) vers `createSupabaseFromMock`.
  - Ajout import `import { createSupabaseFromMock } from './_lib/supabase-mock'`.
- `_bmad-output/implementation-artifacts/deferred-work.md` : barrer 1 entrée I6.

### Testing standards

- `vitest` config : `vitest.config.ts` à la racine (pas de modif). Pas de fixtures cross-suite (paywall/stripe-webhook/cron-purge sont en `tests/integration/`).
- Pas de mock global ajouté. Pas de modification de `tests/integration/setup.ts` (cible integration, hors scope unit). [Source: tests/integration/setup.ts:1-200]
- Le helper est consommable par n'importe quel test unit futur (rétention pure, pas de side effect global).

### Hors scope explicite

- **Pas de refacto `notifications-log.test.ts`** : son pattern `from: vi.fn().mockReturnValue({ insert })` est simpliste et non séquentiel — pas le bug visé I6. À reconsidérer si un futur test multi-table le rejoint.
- **Pas de migration des helpers RPC `buildRpcAllowed` / `buildClaimRpc`** : ils ne touchent pas `from(table)`. Restent locaux au fichier.
- **Pas de modification de `app/`, `lib/`, `components/`** : story 100% tests.
- **Pas de migration BDD** (heritage F-Epic8-A0 GO).
- **Pas de nouveau garde-fou CI** : le helper ne remplace pas un garde-fou statique (ce serait l'objet d'une story future « lint AST détecte dispatcher positionnel »). Le bénéfice 9.A.1 est immédiat sur les SC migrés ; tout nouveau test qui réinventerait le dispatcher positionnel devra être attrapé en code review.

### References

- [Source: _bmad-output/planning-artifacts/epic-9.md#Story 9.A.1]
- [Source: _bmad-output/implementation-artifacts/epic-8-retro-2026-05-17.md#I6]
- [Source: tests/unit/parrainage-symetrie.test.ts:482-520] — pattern source `buildCronFromMock`.
- [Source: tests/unit/parrainage-symetrie.test.ts:141-263] — SC1–SC4 dispatcher positionnel à migrer.
- [Source: tests/unit/parrainage-symetrie.test.ts:286-460] — SC5 golden path + assertion `updatePayloads`.
- [Source: tests/integration/_lib/] — convention `_lib/` à imiter côté unit.
- [Source: _bmad-output/implementation-artifacts/deferred-work.md] — defer I6 à barrer.

### Project Structure Notes

- Alignement strict avec la structure existante : `tests/unit/_lib/` est le miroir attendu de `tests/integration/_lib/`. Aucun conflit.
- Pas de variance attendue. Si une convention contradictoire apparaît (par exemple un `tests/_lib/` partagé existant), choisir celle-ci et documenter dans la PR.

## Dev Agent Record

### Agent Model Used

Claude Opus 4.7 (1M context) via `/bmad-dev-story` workflow.

### Debug Log References

- SC5 golden path : premier run fail `blacklist_other`. Cause : helper retournait `{ data: { id: PARRAINAGE_ID } }` au check idempotence `parrainages` (1er from), faisant croire à une row existante avec statut indéfini → fallthrough `blacklist_other`. Fix : seed `parrainages: [null, {id:PARRAINAGE_ID}]` (idempotence puis insert). Pattern table-aware par construction → 2 réponses séquentielles dans le pool d'une même table.
- `tsc` initial fail : 12 erreurs TS2348 dans `supabase-mock.test.ts` (« Value of type `Mock<Procedure | Constructable>` is not callable »). Cause : `ReturnType<typeof vi.fn>` exposé sans signature → tsc ne peut pas distinguer call vs construct. Fix : typer `fromMock` avec `Mock<(table: string) => SupabaseChainable>` + interface `SupabaseChainable` listant les méthodes chainables.

### Completion Notes List

- Helper `tests/unit/_lib/supabase-mock.ts` créé (~95 lignes) hérité strict du pattern `buildCronFromMock` (lignes 482-520 supprimées du fichier source). Discrimine par nom de table : pool indépendant par clé `table_name`, curseur par table dans `indices: Record<string, number>`. Retourne `{ fromMock, calls, capturedInserts, capturedUpdates }`.
- 9 SC migrés (SC1-SC5 dispatcher positionnel + SC8-SC11 ancien `buildCronFromMock`). Aucun changement de comportement — toutes les assertions originales (Sentry, Stripe coupon metadata, admin_actions_log details, fromMock toHaveBeenCalledWith) restent vertes.
- `insert(payload)` chainable double-mode : (a) `.select().single()` pour `parrainages` (récupère l'id généré), (b) Promise directe via `then(resolve)` pour `admin_actions_log` (await sans chaîne).
- Tests dédiés `tests/unit/supabase-mock.test.ts` (7 tests, AC8 a-f + bonus insert chainable).
- DoD CI : tsc 0 erreur sur fichiers modifiés, lint 192 warnings (0 erreur) baseline préservée, lint:a11y-check 155 baseline préservée, test:unit 94/94 verts (87 baseline + 7 nouveaux), checks (no-direct-notifications-log-insert, as-any-global, oracle-paywall) OK, build OK.
- Defer I6 (`deferred-work.md` ligne 78) soldé `[Solde 9.A.1 - 2026-05-17]` avec réserve documentée : sous-volets `mockAfter` sans await + `mockNormalizeEmail` vide non couverts par 9.A.1.
- Pas d'impact UI (story 100% tests) → DoD a11y N/A (AC14). `a11y:axe:check` non exécuté conformément AC14.

### File List

**Créés :**

- `tests/unit/_lib/supabase-mock.ts` — helper partagé `createSupabaseFromMock`.
- `tests/unit/supabase-mock.test.ts` — tests du helper (7 tests AC8 a-f + bonus).
- `tests/unit/README.md` — documentation Helpers — Mocks Supabase.

**Modifiés :**

- `tests/unit/parrainage-symetrie.test.ts` — suppression `buildCronFromMock` (~40 lignes) + type `CronTableResponses`, ajout import helper, migration 9 SC (SC1-SC5 + SC8-SC11).
- `_bmad-output/implementation-artifacts/deferred-work.md` — defer I6 ligne 78 soldé `[Solde 9.A.1 - 2026-05-17]`.
- `_bmad-output/implementation-artifacts/sprint-status.yaml` — story 9.A.1 `ready-for-dev` → `in-progress` → `review`.
- `_bmad-output/implementation-artifacts/9-a-1-refonte-mocks-supabase-frommock-discriminants-par-table.md` — Status, Tasks/Subtasks cochés, Dev Agent Record, File List, Change Log.

### Review Findings

- [x] [Review][Decision] SC6/SC7 encore sur dispatcher positionnel (`adminCallIdx`) — migré vers `createSupabaseFromMock` [tests/unit/parrainage-symetrie.test.ts:~306–395]
- [x] [Review][Patch] `EMPTY_RESPONSE` singleton mutable partagé — remplacé par `emptyResponse()` factory (nouvel objet à chaque appel) [tests/unit/_lib/supabase-mock.ts:61]
- [x] [Review][Patch] Sous-objet `update()` incomplet — ajout `neq`, `not`, `in`, `lte`, `gte`, `order` avec `mockReturnThis()` [tests/unit/_lib/supabase-mock.ts:99–107]
- [x] [Review][Patch] Type `SupabaseMockResponse.error` trop large — resserré à `null` (conformité AC1) [tests/unit/_lib/supabase-mock.ts:29]
- [x] [Review][Defer] `insert().then()` non conforme Promise/A+ (pas de `onRejected`) [tests/unit/_lib/supabase-mock.ts:106] — deferred, pre-existing (pattern hérité buildCronFromMock, non utilisé dans le code applicatif)
- [x] [Review][Defer] SC5 : `.eq()` post-update non capturé (target_id potentiellement mauvais) [tests/unit/parrainage-symetrie.test.ts:292–298] — deferred, pre-existing (l'ancienne assertion `updatePayloads` ne capturait pas non plus le filtre `.eq()`)
- [x] [Review][Defer] SC9 : `users: []` vide — distinction ambiguë entre "user non trouvé" et "abonnement inactif" [tests/unit/parrainage-symetrie.test.ts SC9] — deferred, pre-existing, hors périmètre 9.A.1

## DoD a11y

N/A — story 100% tests unit sans impact UI applicatif. Aucun composant React ni page HTML modifié. Les baselines `lint:a11y-check` 155 et `axe-core` 8 parcours sont vérifiées par run de sécurité (T7.3) mais aucune action a11y spécifique n'est requise.

## Change Log

- 2026-05-17 — Story créée via `bmad-create-story` (workflow `/bmad-create-story`). Source rétro Epic 8 I6 + AI-Epic9-B1 + epic-9.md#9.A.1.
- 2026-05-17 — Implémentation via `bmad-dev-story` : helper `createSupabaseFromMock` créé + 9 SC migrés (SC1-SC5 + SC8-SC11) + suppression `buildCronFromMock` local + 7 tests dédiés helper + README + defer I6 soldé. DoD CI verte (tsc 0 / lint 192 warnings 0 erreur / test:unit 94/94 / lint:a11y-check 155 baseline / build OK). Status `ready-for-dev` → `review`.
