# Story 7.A.1 : Robustifier `hasActiveSubscription` + `getOrCreateConversation*`

Status: done

<!-- Story 1 du mini-epic 7.A (hardening securite transverse) - Item C1 de l'inventaire dettes Epic 7 -->

## Story

En tant qu'**utilisateur abonne payant** sur roxanetnous,
je veux que **l'helper `hasActiveSubscription` ne renvoie plus silencieusement `false` sur erreur Supabase transitoire** (timeout, RLS, double-row),
afin que **je ne sois jamais paywalle a tort lors d'une tentative d'envoi de message ou de creation de conversation alors que mon abonnement est actif**.

Et en tant que **dev/ops oncall**,
je veux que **les erreurs Supabase dans le check abonnement et le `getOrCreate*Conversation*` soient loggees explicitement dans Sentry au lieu d'etre swallowed**,
afin que **les degradations runtime soient visibles en alerting Sentry au lieu de se traduire en faux paywalls invisibles cote utilisateur**.

## Acceptance Criteria

### Comportement runtime

- **AC1** : `hasActiveSubscription` (lib/subscription-helpers.ts:39-57) remplace `.single()` par `.maybeSingle()`. La distinction `data === null` (pas d'abonnement) vs `error !== null` (incident Supabase) devient explicite et non destructuree.
- **AC2** : Toute branche `error !== null` dans `hasActiveSubscription` ET dans les 3 server actions `getOrCreateConversation*` (app/actions/messages.ts) appelle `Sentry.captureException(error, { tags: { flow: 'subscription_check', severity: 'critical' } })` avec tag explicite avant le retour. Aucune branche error swallowed sans Sentry call.
- **AC3** : `hasActiveSubscription` retour clarifie :
  - `data === null` (pas de row matchant `status IN ('active','trialing')`) => retour `false` (comportement actuel preserve, paywall legitime).
  - `error !== null` (incident Supabase) => **fail-loud** : `throw new Error('subscription check failed: ' + error.message)` apres Sentry capture. Les 29 appelants en amont (annonces, recherche, messages, cron confirm-parrainages, pages) ne re-attrapent pas - l'exception remonte au middleware Next.js qui renvoie un 500 explicite plutot qu'un paywall silencieux.
  - **Aucun fallback `return false` en cas d'erreur**. Le silence est l'incident a eliminer.
- **AC4** : Le meme pattern `.maybeSingle()` + Sentry capture est applique a `getOrCreateConversation` (messages.ts:30-67), `getOrCreateConversationAsAccompagnante` (messages.ts:135-196) et `getOrCreateAdminConversation` (messages.ts:228-260) pour les requetes `select id from users where id = ...` et `select id from accompagnants_profiles | accompagnes_profiles`. **Note** : les requetes `select id from conversations` utilisent **deja** `.maybeSingle()` post-story 5.B.2 - ne pas regresser.

### Schema BDD

- **AC5** : Constat MCP `pg_get_indexdef` confirme que `conversations_unique_aux_acc` (UNIQUE INDEX partiel sur `(accompagnant_id, accompagne_id) WHERE accompagne_id IS NOT NULL`) et `conversations_unique_aux_admin` (UNIQUE INDEX partiel sur `(accompagnant_id, admin_id) WHERE admin_id IS NOT NULL`) existent **deja** en prod (livres story 5.B.2). **Aucune migration BDD a executer dans cette story**. La story documente le constat dans Dev Notes et passe a la suite. Si l'audit MCP au demarrage de la story revele que ces index sont absents (regression depuis 5.B.2), creer une migration `CREATE UNIQUE INDEX CONCURRENTLY` avec snapshot pre-cutover, mais le scenario nominal est : rien a faire cote BDD.

### Tests

- **AC6** : Tests d'integration Vitest `tests/integration/paywall/*` couvrent les 4 scenarios (etendre les tests existants ou en ajouter) :
  - **(a)** abonne actif (status='active' OR 'trialing', current_period_end > now()) => paywall passe, conversation creee.
  - **(b)** abonne expire (status='canceled' OR current_period_end < now()) => paywall bloque (return `false`), erreur PAYWALL_GENERIC_ERROR retournee.
  - **(c)** erreur Supabase transitoire (mock la query subscriptions pour qu'elle renvoie `{ data: null, error: PostgrestError }`) => `hasActiveSubscription` **throw**, Sentry.captureException appele 1x avec tag `flow: 'subscription_check'`.
  - **(d)** double-call concurrent de `getOrCreateConversation` => 1 seule conversation creee (idempotence via UNIQUE INDEX partial + branche 23505 deja en place ligne 109).
- **AC7** : Audit MCP post-merge sur prod : `SELECT accompagnant_id, accompagne_id, COUNT(*) FROM conversations WHERE accompagne_id IS NOT NULL GROUP BY 1, 2 HAVING COUNT(*) > 1` retourne 0 row. **Audit deja execute le 2026-05-13 pendant cadrage Epic 7 : 0 doublon. Re-executer post-merge pour valider absence de regression.**

### Tests existants a aligner

- **AC8** : Le test `tests/integration/paywall/sans-abonnement.test.ts:34` attend l'ancien message `'Abonnement requis pour contacter une accompagnante.'` mais la story 5.B.1 a unifie le message a `'Abonnement requis pour contacter cet utilisateur.'` (cf. PAYWALL_GENERIC_ERROR app/actions/messages.ts:24). **Ce test est cassé en l'etat**. Mise a jour obligatoire dans cette story : remplacer la chaine attendue par `PAYWALL_GENERIC_ERROR` (importer le constant si export ajoute, sinon dupliquer le literal). Verifier que `npm run test:integration -- paywall` reste vert apres modification.

### Garde-fous CI et validations finales

- **AC9** : `npm run test:integration` exit 0 sur l'env local Sylvain (a defaut : GHA workflow vert apres push). Cf. memoire `feedback_test_local_supabase` (Sylvain ne lance pas Docker localement, validation via GHA).
- **AC10** : `npm run check:env`, `npm run check:as-any-admin`, `npm run check:as-any-global`, `npm run check:oracle-paywall`, `npm run lint:a11y-check`, `tsc --noEmit` tous exit 0 post-modifications.
- **AC11** : `npm run a11y:axe:check` exit 0 conserve (aucun impact UI attendu, mais CLAUDE.md exige verification avant commit livraison story).
- **AC12** : Pas d'augmentation du compteur `as any` global : `scripts/check-as-any-global.mjs` doit rester vert (les `as any` deja resorbes 5.C.1 ne reviennent pas).

## Tasks / Subtasks

- [x] **Task 1 : Audit MCP pre-cutover** (AC5, AC7)
  - [x] 1.1 - Verifie via MCP `pg_indexes` : `conversations_unique_aux_acc` et `conversations_unique_aux_admin` presents en prod (cf. Completion Notes). Aucune migration BDD requise (scenario nominal).
  - [x] 1.2 - Audit 0 doublon conversations en prod confirme (`SELECT ... GROUP BY ... HAVING COUNT(*) > 1` = 0 row).
  - [x] 1.3 - Resultat audit consigne dans Completion Notes List.

- [x] **Task 2 : Refactor `hasActiveSubscription` fail-loud** (AC1, AC2, AC3)
  - [x] 2.1 - `lib/subscription-helpers.ts` : `.single()` -> `.maybeSingle()` + destructure `{ data, error }`.
  - [x] 2.2 - `error !== null` : `Sentry.captureException` avec tags `flow: 'subscription_check', severity: 'critical'` puis `throw new Error('subscription check failed: ' + error.message)`.
  - [x] 2.3 - `data === null` : retour `false` (comportement preserve).
  - [x] 2.4 - `data !== null` : check `current_period_end > new Date()` preserve.
  - [x] 2.5 - `getSubscriptionStatus` non modifie (hors scope).
  - [x] 2.6 - Import Sentry ajoute en tete (`import * as Sentry from '@sentry/nextjs'`).

- [x] **Task 3 : Refactor `getOrCreateConversation*` Sentry-aware** (AC2, AC4)
  - [x] 3.1 - `getOrCreateConversation` : lookup `users.role` migre `.maybeSingle()` + Sentry capture + retour `{ error: 'Impossible de vérifier votre profil.' }` (pas de throw, server action cote client).
  - [x] 3.2 - `getOrCreateConversation` : lookup et insert `accompagnes_profiles` migrent `.maybeSingle()` + Sentry capture.
  - [x] 3.3 - `getOrCreateConversationAsAccompagnante` : queries `users.role` + `accompagnants_profiles.id` migrent `.maybeSingle()` + Sentry capture.
  - [x] 3.4 - `getOrCreateAdminConversation` : query `users.role` migre `.maybeSingle()` + Sentry capture.
  - [x] 3.5 - `.maybeSingle()` 5.B.2 sur `conversations` preservees. Tag `flow: 'messaging'` historique conserve. Lookup conversation admin alignee avec le pattern (capture `existingError` ajoutee, qui manquait).
  - [x] 3.6 - Tag unifie pour les nouveaux captures : `tags: { flow: 'messaging', signal: 'profile-lookup-error', severity: 'critical' }`.

- [x] **Task 4 : Tests d'integration Vitest** (AC6, AC8, AC9)
  - [x] 4.1 - `tests/integration/paywall/sans-abonnement.test.ts` aligne sur `PAYWALL_GENERIC_ERROR` (`'Abonnement requis pour contacter cet utilisateur.'`). Commentaire T7 mis a jour (mention 5.B.1 + 7.A.1).
  - [x] 4.2 - `tests/integration/paywall/erreur-supabase-transitoire.test.ts` cree (mock `createClient` avec chaine fluente `.from().select().eq().in().maybeSingle()` retournant `{ data: null, error: PostgrestError }`). Asserts : `hasActiveSubscription` throw `Error` matchant `/subscription check failed/i` + `Sentry.captureException` appele 1x avec tags `flow: 'subscription_check'`/`severity: 'critical'`. Test 1/1 vert en local sans Docker (mock pur).
  - [x] 4.3 - `abonne-actif.test.ts` et `abonnement-expire-mid-conversation.test.ts` non modifies, comportement nominal preserve (data non-null sur abonne actif, current_period_end<now() sur expire).
  - [x] 4.4 - Test idempotence concurrent SKIP : la branche 23505 est deja couverte par le code path; le scenario reel concurrence sur Vitest mono-thread ne reproduit pas fidelement la race, cf. Dev Notes "Pattern test idempotence". Idempotence reste validee par UNIQUE INDEX prod + audit MCP post (0 doublon).

- [x] **Task 5 : Validations CI complete** (AC9, AC10, AC11, AC12)
  - [x] 5.1 - `npm run test:integration -- paywall/erreur-supabase-transitoire` 1/1 vert local. Tests integration BDD (T7/T8/...) seront valides via GHA apres push (cf. memoire `feedback_test_local_supabase` : Sylvain ne lance pas Docker).
  - [x] 5.2 - `tsc --noEmit` 0 erreur (apres nettoyage `.next/types/{routes.d 2.ts, cache-life.d 2.ts, validator 2.ts}` polluts iCloud). `check:env`, `check:as-any-admin`, `check:as-any-global`, `check:oracle-paywall`, `check:ip-spoofing`, `lint:a11y-check` 155 baseline tous exit 0. `npm run lint` 0 erreur 194 warnings (sous baseline ~213).
  - [x] 5.3 - `npm run a11y:axe:check` 0 Critical/Serious vs baseline (7 parcours).
  - [x] 5.4 - Chaine `vercel.json buildCommand` (check:env + lint:a11y-check + check:ip-spoofing + check:as-any-admin + check:as-any-global + check:oracle-paywall) verte (chaque maillon valide individuellement). Build complet `next build` non re-execute (impact 0 sur le pipeline, validation GHA finale).

- [x] **Task 6 : Audit MCP post-merge + memoire** (AC7)
  - [x] 6.1 - Audit conversation doublons re-execute en fin de story : 0 row (cf. Completion Notes).
  - [x] 6.2 - Resultat audit consigne Completion Notes. Pas de breadcrumb DECISIONS.md (decision F-Epic7-A1 deja consignee Dev Notes, sera ajoutee a DECISIONS.md projet par le code-review en cas de validation).
  - [x] 6.3 - Memoire `project_epic_7_cadrage.md` mise a jour (story 7.A.1 livree `review`).

## Dev Notes

### Probleme racine

- `lib/subscription-helpers.ts:39-57` utilise `.single()` qui echoue sur 0 row (`PGRST116`) ET 2+ rows (`PGRST116` aussi). Le code destructure `const { data } = ...` **sans recuperer error** : sur incident Supabase (timeout reseau, RLS denied, double-row), `data === null` est traite comme "pas d'abonnement" et l'utilisateur abonne paywalle silencieusement. **Aucune trace Sentry. Aucune visibilite oncall.**
- Meme pattern dans `app/actions/messages.ts:34-38` (lookup `users.role`), `45-49` (`accompagnes_profiles`), `139-144` (idem), `149-154` (`accompagnants_profiles`), `229-234` (`users.role`).
- Les requetes `select id from conversations` ont deja ete corrigees par la story 5.B.2 (`.maybeSingle()` + Sentry.captureException). **Cette story 7.A.1 etend le meme pattern aux requetes "lookup profil" qui restent en `.single()`.**

### Choix architecturaux

- **Fail-loud vs silent fallback** : la decision retenue est `throw` cote helper `hasActiveSubscription` (AC3). Le silence est l'incident a eliminer pour 29 appelants en amont. Les server actions appelantes (`messages.ts`, `annonces.ts`, `cron/confirm-parrainages`) ne re-attrapent pas explicitement - l'exception remonte au framework Next.js (500 explicite) plutot qu'a un faux paywall (200 avec error message). Sentry capture explicite garantit que toute occurrence sera vue.
- **Pour les server actions `getOrCreateConversation*` (AC4)** : on garde une semantique `return { error: ... }` plutot que throw, car ces fonctions sont appelees depuis le client React via formulaires. Un throw cascadait en error boundary global - mauvaise UX. Le pattern actuel `Sentry.captureException + return { error: 'message generique' }` est preserve, on l'etend juste aux nouvelles requetes (`users.role`, profiles lookup).
- **Pourquoi ne pas tout passer en `.maybeSingle()` automatiquement** : `getSubscriptionStatus` (hors scope) renvoie un payload complet avec fallback `{ active: false, ... }`. Sa semantique est differente (information riche pour pages settings, pas check booleen paywall). Hors scope, dette future.

### Contexte 5.B.1 et 5.B.2 (deja livre)

- **Story 5.B.1** (2026-05-13) a unifie le message paywall `getOrCreateConversation*` a `PAYWALL_GENERIC_ERROR = 'Abonnement requis pour contacter cet utilisateur.'` pour empecher l'oracle d'enumeration du role compte cible. **Important** : le test `sans-abonnement.test.ts` attend encore l'ancien message - **bug de coherence a fixer dans cette story** (AC8).
- **Story 5.B.2** (2026-05-13) a livre `.maybeSingle()` + handle 23505 idempotent + UNIQUE INDEX partiels sur conversations. **AC5 deja satisfait au moment du cadrage 7.A.1** (audit MCP 2026-05-13 confirme indexes en place + 0 doublon).

### Architecture Compliance

- **Stack** : Next.js 16 App Router, Supabase JS v2 (avec types/supabase.ts generes via MCP), Sentry SDK Next.js v10 (configure story 4.1).
- **Pattern Sentry projet** (DECISIONS.md F8) : `Sentry.captureException(error, { tags: { flow: '...', signal: '...', severity: 'warning' | 'critical' } })`. Severite `critical` reservee aux erreurs bloquantes (BDD timeout, RLS denied). Severite `warning` aux degradations recuperables.
- **Pattern paywall projet** (DECISIONS.md 2026-05-06 + 2026-05-07) : soft paywall sur actions de mise en relation. Toute nouvelle action sensible doit appeler `hasActiveSubscription(user.id)` apres check existence/idempotence pour preserver le bypass admin/conversations existantes.
- **Pattern test integration projet** (DECISIONS.md 2026-05-08) : `tests/integration/*` parallele a `tests/a11y/*`, helpers `tests/integration/_lib/` (fixtures, supabase-admin, supabase-session-mock, stripe-webhook-helper). Configuration Vitest avec setup `tests/integration/setup.ts`.

### Library / framework requirements

- **Supabase JS** : `.maybeSingle()` est officiellement le replacement de `.single()` quand on tolere 0 row. Signature `Promise<PostgrestSingleResponse<T | null>>`. Source : https://supabase.com/docs/reference/javascript/maybesingle (verifier docs si breaking change recent, mais l'API est stable depuis v2.0+).
- **Sentry SDK v10** : `Sentry.captureException(err, { tags: { ... } })` pattern stable. Tags indexes pour filtrage dashboard. Story 4.1 a configure les 4 alert rules production (cf. memoire `project_epic_4_retro`).

### File Structure

Fichiers a modifier :

- `lib/subscription-helpers.ts` (refactor `hasActiveSubscription` AC1-AC3, +import Sentry si absent).
- `app/actions/messages.ts` (3 server actions, AC4).
- `tests/integration/paywall/sans-abonnement.test.ts` (AC8 - aligner message attendu).
- **Nouveau** `tests/integration/paywall/erreur-supabase-transitoire.test.ts` (AC6 (c)).

Fichiers a **NE PAS** modifier :

- `lib/subscription-helpers.ts::getSubscriptionStatus` (hors scope).
- 27+ appelants en aval de `hasActiveSubscription` (annonces, pages, cron) - le throw remonte naturellement, aucune adaptation locale necessaire.
- `tests/integration/paywall/abonne-actif.test.ts`, `admin-bypass.test.ts`, `abonnement-expire-mid-conversation.test.ts`, `visiteur-non-connecte.test.ts` (verifier qu'ils restent verts, pas de modification).

### Testing Requirements

- **Outil** : Vitest avec `tests/integration/setup.ts` (Supabase admin client real, pas de mock global BDD).
- **Pattern mock Supabase pour AC6 (c) erreur transitoire** : 2 options.
  - Option A : utiliser `vi.spyOn(supabaseAdmin, 'from')` + chainage `.mockReturnValue` retournant un objet qui mock `.select().eq().in().maybeSingle()` => Promise resolve avec `{ data: null, error: { code: 'PGRST301', message: 'JWT expired' } }`. **Preferer Option A pour ce test cible.**
  - Option B : injection de dependance dans le helper (refactor + invasif). **Hors scope cette story.**
- **Pattern test idempotence AC6 (d)** : `Promise.all([getOrCreateConversation(X), getOrCreateConversation(X)])` puis assert `result1.conversationId === result2.conversationId` et `COUNT(*) = 1`. Note : si vitest serialise les await (probable), le test ne reproduira pas la concurrence. **Optionnel** : si techniquement faisable rapidement, l'ajouter ; sinon documenter dans Completion Notes que la branche 23505 est couverte par le code path mais pas par test unitaire automatique (acceptable car 1 occurrence prod = 1 Sentry breadcrumb visible).
- **a11y** : aucun impact UI dans cette story (uniquement modifications server-side). **Skip checklist DoD a11y** mais executer `npm run a11y:axe:check` baseline 0 violations en pre-commit (regle CLAUDE.md).

### Previous Story Intelligence (5.B.1 + 5.B.2 + 4.1 + 4.2 + 4.4)

- **5.B.1 (2026-05-13)** : a cree le constant `PAYWALL_GENERIC_ERROR` et le script `scripts/check-oracle-paywall.mjs` (garde-fou CI). **Cette story 7.A.1 doit pas re-introduire de message differencie par role.** Le garde-fou doit rester vert apres modifications.
- **5.B.2 (2026-05-13)** : a livre `.maybeSingle()` + 23505 handler + UNIQUE INDEX partiels sur conversations. **Tirer le pattern** : utiliser exactement la meme forme `const { data, error } = await ... .maybeSingle(); if (error) { Sentry.captureException(error, { tags: { flow: 'messaging', signal: '...', severity: 'warning' } }); return { error: '...' } }`.
- **4.1 (2026-05-07)** : Sentry SDK v10 configure + 4 alert rules + tag `flow` + `severity`. **Reutiliser tags existants** (`flow: 'subscription_check'` est nouveau mais coherent avec `flow: 'messaging'`, `flow: 'webhook-stripe'`, etc.).
- **4.2 (2026-05-07)** : fix schema `notifications_log` (status='error' + user_id NOT NULL bug). **Pas de lien direct mais bon a savoir** : le pattern fail-loud + Sentry capture etait deja partiellement applique en 4.2 - 7.A.1 etend la philosophie au paywall check.
- **4.4 (2026-05-08)** : tests integration paywall livres en T7/T8 + helpers `tests/integration/_lib/*`. **Reutiliser** : `createTestUser`, `createTestSubscription`, `createTestAccompagneProfile`, `createTestAccompagnanteProfile`, `mockSupabaseSession`, `cleanupAllFixtures` (deja en place dans `_lib/fixtures.ts`).

### Git Intelligence Summary

- Derniers commits (2026-05-13) : `1894bb5` Epic 6 retro, `20c48fc` mini-epic 6.D cloture, `93979ca` 6.C.2 cloture conditionnelle Supabase domaine, `782e448` 6.C.4 rejet centralisation helpers email, `8e71247` 6.C.3 seed UTF-8 dpt/regions. **Tous Epic 6 cloture.** Story 7.A.1 est le 1er commit Epic 7.
- **Format commit attendu** (cf. memoire `project_bmad_conventions`) : `Story 7.A.1 : robustifier hasActiveSubscription fail-loud + Sentry-aware getOrCreateConversation (F-Epic7-A1)` ou similaire. **Trailer obligatoire** : `Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>`.

### Latest Tech Information

- **Supabase JS** : version actuelle projet (verifier `package.json` au demarrage story, normalement >= 2.45.x). `.maybeSingle()` retourne `{ data: T | null, error: PostgrestError | null }` - jamais throw, toujours destructurable.
- **Next.js 16** : aucun impact specifique. Server actions et server components compatibles avec throw qui remonte au framework error boundary (rendu `error.tsx`).
- **Sentry Next.js v10** : `Sentry.captureException` est asynchrone non-bloquant en runtime (envoi en arriere-plan). Le tag `flow` est indexe (filterable dans Sentry web). Pas de breaking change attendu sur ce pattern.

### Project Structure Notes

- Alignement avec structure projet : modifications limitees a `lib/` (helpers) + `app/actions/` (server actions) + `tests/integration/paywall/` (tests). Aucun nouveau module, pas de creation de dossier.
- Pas de variance avec convention projet. Tests d'integration suivent le pattern T7/T8 etabli en 4.4.

### Decisions a documenter dans DECISIONS.md (a la fin de la story)

- **F-Epic7-A1** : Adoption du pattern fail-loud sur `hasActiveSubscription` (throw + Sentry capture) plutot que silent fallback `return false`. Motivation : eliminer la fenetre de faux paywalls invisibles sur incident Supabase transitoire. Trade-off accepte : exception remonte au framework Next.js (500 user-facing) plutot qu'un paywall silencieux (200 avec erreur Supabase swallowed). Visibilite oncall preservee via Sentry alert rule existante story 4.1 sur tag `flow: 'subscription_check'` severity `critical`.

### References

- [Source: _bmad-output/planning-artifacts/epic-7.md#Story 7.A.1] - Definition de story, source `deferred-work.md` lignes 182-183.
- [Source: _bmad-output/implementation-artifacts/deferred-work.md#3.6] - Items 181-183 (oracle paywall + helpers fail-soft).
- [Source: DECISIONS.md#2026-05-06] - Soft paywall projet.
- [Source: DECISIONS.md#2026-05-07] - Extension soft paywall messaging granularite creation conv.
- [Source: lib/subscription-helpers.ts:39-57] - Code source `hasActiveSubscription`.
- [Source: app/actions/messages.ts:30-129] - `getOrCreateConversation`.
- [Source: app/actions/messages.ts:131-219] - `getOrCreateConversationAsAccompagnante`.
- [Source: app/actions/messages.ts:221-284] - `getOrCreateAdminConversation`.
- [Source: tests/integration/paywall/sans-abonnement.test.ts] - Test cassé a aligner (AC8).
- [Source: tests/integration/_lib/fixtures.ts] - Helpers reutilisables tests.
- [Source: scripts/check-oracle-paywall.mjs] - Garde-fou CI 5.B.1 a preserver.

## Dev Agent Record

### Agent Model Used

claude-opus-4-7 (1M context) -- skill `bmad-dev-story` 2026-05-13.

### Debug Log References

- Pollution iCloud Drive : suppression manuelle de `.next/types/routes.d 2.ts`, `cache-life.d 2.ts`, `validator 2.ts` (duplicates `* 2.ts` issus de la sync iCloud sur `~/Documents`) requise pour debloquer `tsc --noEmit` (TS2300 LayoutProps + TS6200 unstable_cache duplicate). Ce bruit reapparaitra a chaque rebuild local ; pas d'impact CI Vercel (build cloud propre). Si recurrent, candidat AI ajout `.next/types/* 2.ts` au `.gitignore` ou script `prebuild` qui purge le pattern.
- `npm run test:integration -- paywall/erreur-supabase-transitoire` : 1/1 vert sans Docker local (mock pur du client Supabase via `vi.mocked(createClient).mockResolvedValue(fakeClient)` + chaine fluente `.from().select().eq().in().maybeSingle()` retournant `{ data: null, error }`).

### Completion Notes List

- **AC1-AC3 hasActiveSubscription fail-loud** : `.single()` -> `.maybeSingle()` + destructure `{ data, error }` + `Sentry.captureException` (tags `flow: 'subscription_check', severity: 'critical'`) + `throw new Error('subscription check failed: ' + error.message)`. Import Sentry ajoute en tete de `lib/subscription-helpers.ts`. `getSubscriptionStatus` preserve (hors scope).
- **AC4 getOrCreateConversation\* Sentry-aware** : 3 server actions migrent leurs lookups `users.role` + `accompagnes_profiles` + `accompagnants_profiles` en `.maybeSingle()` avec capture Sentry (`flow: 'messaging', signal: 'profile-lookup-error', severity: 'critical'`). Pas de throw cote server action -> `return { error: 'Impossible de vérifier votre profil.' }` generique pour preserver UX (l'erreur reste visible en alerting Sentry). Bonus hygiene : capture `existingError` ajoutee a la lookup conversation admin (manquait par rapport au pattern 5.B.2 deja en place sur les 2 autres).
- **AC5 audit MCP pre-cutover (2026-05-13 ~23:18 UTC)** : `pg_indexes` confirme `conversations_unique_aux_acc` (UNIQUE btree accompagnant_id, accompagne_id WHERE accompagne_id IS NOT NULL) et `conversations_unique_aux_admin` (UNIQUE btree accompagnant_id, admin_id WHERE admin_id IS NOT NULL) presents en prod (livres story 5.B.2). **Aucune migration BDD requise**.
- **AC7 audit MCP doublons (pre + post)** : `SELECT accompagnant_id, accompagne_id, COUNT(*) FROM conversations WHERE accompagne_id IS NOT NULL GROUP BY 1,2 HAVING COUNT(*) > 1` = 0 row (snapshots pre-modif et post-modif identiques, 2026-05-13).
- **AC6 (a)+(b)+(c)+(d) tests** : (a) `abonne-actif.test.ts` et (b) `abonnement-expire-mid-conversation.test.ts` non modifies (logique business preservee). (c) test cible `erreur-supabase-transitoire.test.ts` cree (1/1 vert local). (d) test idempotence concurrent skip (cf. Task 4.4 - branche 23505 deja couverte par le code path + UNIQUE INDEX prod).
- **AC8 alignement test casse** : `sans-abonnement.test.ts` aligne sur le message generique `PAYWALL_GENERIC_ERROR = 'Abonnement requis pour contacter cet utilisateur.'` (5.B.1). Commentaire T7 enrichi.
- **AC9-AC12 validations CI** : `tsc` 0 erreur (apres purge `.next/types/* 2.ts`), `npm run lint` 0 erreur 194 warnings (sous baseline projet), `lint:a11y-check` 155 baseline, `a11y:axe:check` 0 Critical/Serious 7 parcours, `check:env`/`check:ip-spoofing`/`check:as-any-admin`/`check:as-any-global`/`check:oracle-paywall` tous OK. Tests integration BDD (T7/T8/admin-bypass/expire-mid-conversation) seront valides via GHA apres push (Sylvain ne lance pas Docker local).
- **Decisions documentees** : Aucun ajout DECISIONS.md cote dev-story (la decision F-Epic7-A1 detaillee dans Dev Notes sera consolidee dans DECISIONS.md par le code-review apres validation, conforme pattern Epic 5/6).
- **Comportement appelants en aval** : les 29 sites d'appel de `hasActiveSubscription` (pages serveur annonces/recherche/messages + crons + server actions) ne sont pas modifies. Sur erreur transitoire, le throw remonte au framework Next.js (`error.tsx` pour pages, catch existants pour crons). Visibilite oncall preservee via Sentry alert rule existante (story 4.1, tag `flow: 'subscription_check'` severity `critical`).

### File List

Modifies :
- `lib/subscription-helpers.ts` -- import Sentry + refactor `hasActiveSubscription` fail-loud.
- `app/actions/messages.ts` -- 3 server actions `getOrCreateConversation*` : lookups `users.role`/profile en `.maybeSingle()` + Sentry capture + capture `existingError` ajoutee a la lookup conversation admin.
- `tests/integration/paywall/sans-abonnement.test.ts` -- alignement message `PAYWALL_GENERIC_ERROR` + commentaire T7 enrichi.

Crees :
- `tests/integration/paywall/erreur-supabase-transitoire.test.ts` -- test integration AC6(c) (mock client Supabase + throw fail-loud + Sentry capture).

Touches collateraux (story file + memoire + sprint-status, hors scope code) :
- `_bmad-output/implementation-artifacts/7-a-1-robustifier-hasactivesubscription-et-getorcreateconversation.md` -- status review + Dev Agent Record + Tasks checkbox.
- `_bmad-output/implementation-artifacts/sprint-status.yaml` -- status story `ready-for-dev` -> `in-progress` -> `review`.
- `~/.claude/projects/-Users-sylvain-Documents-roxanetnous/memory/project_epic_7_cadrage.md` -- avancement sprint Epic 7.

### Change Log

| Date       | Author                                | Change                                                                                                                                            |
|------------|---------------------------------------|---------------------------------------------------------------------------------------------------------------------------------------------------|
| 2026-05-13 | Sylvain via claude-opus-4-7 (1M ctx)  | Story 7.A.1 livree : `hasActiveSubscription` fail-loud + Sentry capture, 3 server actions `getOrCreateConversation*` Sentry-aware sur lookups profil/role, alignement test `sans-abonnement.test.ts` sur `PAYWALL_GENERIC_ERROR`, ajout test `erreur-supabase-transitoire.test.ts` (AC6 c). Audit MCP pre+post : 0 doublon conversations, UNIQUE INDEX en place. |

### Review Findings

- [ ] [Review][Decision] throw hasActiveSubscription non attrapé dans appelants Server Actions/Pages — `hasActiveSubscription` throw désormais sur erreur Supabase transitoire, mais les 29 appelants (pages server, server actions `annonces.ts`, `sendMessage`) ne possèdent pas de try/catch. Un incident BDD transitoire se traduit en 500 Next.js pour l'utilisateur plutôt qu'en message d'erreur métier. Décision : (a) wrapper hasActiveSubscription dans les appelants sensibles, (b) accepter le 500 comme comportement intentionnel fail-loud (error.tsx par page), ou (c) convertir hasActiveSubscription en retour `{ ok: false, error }` à la place du throw. [lib/subscription-helpers.ts:54] [app/actions/messages.ts:107,215,385]
- [x] [Review][Patch] Message Supabase brut exposé dans le throw — remplacé par `throw new Error('subscription check failed')` générique. L'info complète reste dans Sentry. [lib/subscription-helpers.ts:58]
- [x] [Review][Patch] `insert().select().maybeSingle()` : cas `data===null && error===null` non loggué Sentry — Sentry capture désormais systématiquement `createError ?? new Error('insert accompagnes_profiles returned no row')`. [app/actions/messages.ts:74-80]
- [x] [Review][Patch] Test `erreur-supabase-transitoire` : mock Sentry vérifié dans `tests/integration/setup.ts:33-48` — mock global `vi.mock('@sentry/nextjs')` présent, dismissé (faux positif).
- [x] [Review][Defer] Cron `confirm-parrainages` : throw attrapé mais perd la distinction erreur-métier vs incident-BDD [app/api/cron/confirm-parrainages/route.ts:48] — deferred, pre-existing (le catch de boucle existant gère l'exception ; amélioration de sémantique hors scope 7.A.1)
- [x] [Review][Defer] Race condition `accompagnes_profiles` : pas de contrainte UNIQUE ni ON CONFLICT sur user_id [app/actions/messages.ts:67-82] — deferred, pre-existing (antérieur à 7.A.1)
- [x] [Review][Defer] `getSubscriptionStatus` encore en `.single()` sans guard error — divergence avec `hasActiveSubscription` [lib/subscription-helpers.ts:80] — deferred, hors scope story (Dev Notes l'exclut explicitement)

## DoD a11y

**Aucun impact UI dans cette story** (modifications uniquement server-side). Checklist DoD a11y SKIP avec justification : code path serveur sans rendu visuel modifie.

- [N/A] Labels associes aux champs - pas de modification UI.
- [N/A] Erreurs liees aux champs via `aria-describedby` + `aria-invalid` - pas de modification UI.
- [N/A] Focus visible sur tous les elements interactifs - pas de modification UI.
- [N/A] Contrastes texte / UI - pas de modification UI.
- [N/A] ARIA states - pas de modification UI.
- [N/A] Navigation clavier - pas de modification UI.
- [N/A] Verification lecteur d'ecran - pas de modification UI.
- [x] Pas de regression `eslint-plugin-jsx-a11y` (`npm run lint:a11y-check` vert en CI) - validation obligatoire CLAUDE.md.
- [x] Pas de regression axe-core (`npm run a11y:axe:check` vert) - validation obligatoire CLAUDE.md.
