# Story 9.A.2.b : Combler branches `app/actions/parrainage.ts` -> palier 2 (~65%)

Status: review

<!-- Note: Validation is optional. Run validate-create-story for quality check before dev-story. -->

## Story

As a developer Epic 9.A hardening,
I want completer les SC unit ciblant les branches non couvertes de `detectBlacklist` + `confirmParrainageOnSuccess` dans `app/actions/parrainage.ts`,
so that la coverage cumulee unit+integration du fichier passe du palier 1 (~50%) au palier 2 (~65%), reduisant la dette d'observabilite trace par DECISIONS.md F-Epic9-A2 vers la cible originale 85%.

## Acceptance Criteria

1. **AC1** : 6 a 8 nouveaux SC unit ajoutes a `tests/unit/parrainage-symetrie.test.ts` (ou nouveau fichier dedie `tests/unit/parrainage-detect-blacklist.test.ts` + `tests/unit/parrainage-confirm-paths.test.ts` si lisibilite preferee). Ciblage exclusif : branches non couvertes priorisees par defer `deferred-work.md:13` :
   - `detectBlacklist` (lignes 36-101) : (a) blocage `meme_email` direct marraine↔filleule, (b) blocage `meme_email` via P9 multi-filleules historiques, (c) flag `meme_ip` match autre parrainage meme marraine, (d) branche sans match (return `{}`), (e) edge case `filleuleEmail` vide / `ipInscription` vide.
   - `confirmParrainageOnSuccess` paths (lignes 837-1147) : (f) `parrainRoleConfirm` inattendu (autre que 'accompagne' / 'accompagnant') -> `marraine_no_longer_validated` + Sentry signal `marraine-unexpected-role-at-confirm`, (g) `validation_status_skipped` (filleule deja `refuse`/`a_completer`) -> log warn + Sentry signal `validation-status-skipped` + admin_actions_log insert, (h) `generate_code_failed` (mock `generateCodeForUserSystem` retourne `{ error }`) -> Sentry signal `generate-code-failed` + admin_actions_log insert.
2. **AC2** : `npx vitest run --project unit --coverage` mesure ces 8 SC en local (Sylvain ne lance pas Supabase Docker, heritage `feedback_test_local_supabase`). Le 1er run GHA `integration-tests.yml` post-merge `release` mesure la couverture cumulee unit+integration **reelle** sur `app/actions/parrainage.ts`. Cible **≥ 65% sur tous les 4 indicateurs** (lines, branches, functions, statements). Si l'un ne franchit pas 65% au 1er run, decision Option B-bis : palier intermediaire = chiffres mesures arrondis au point inferieur (rule heritee F-Epic9-A2 : jamais regressser sous palier 1 = 49/41/64/48). DECISIONS.md mise a jour si palier 2 effectif < 65%.
3. **AC3** : `vitest.config.ts > coverage.thresholds['app/actions/parrainage.ts']` ajuste aux **nouveaux chiffres mesures arrondis au point inferieur** (pas avant le 1er run GHA). Commentaire inline maintient la roadmap 3 paliers + cite F-Epic9-A2. Jamais descendre sous palier 1 (49/41/64/48). Garde-fou CI palier 2 actif post-merge.
4. **AC4** : `tests/unit/_lib/supabase-mock.ts` REUTILISE tel quel (helper `createSupabaseFromMock` livre 9.A.1). **Interdit** : creer un nouveau helper, dispatcher positionnel, ou re-mocker globalement `@/lib/supabase/server`. Seedage table-aware obligatoire (pattern AC8 9.A.1). Si le helper manque une table (ex. `admin_actions_log` insert avec assertion sur payload), etendre le type `TableName` (string & {}) suffit -- pas de refonte.
5. **AC5** : `tsc --noEmit` exit 0 ; `npm run lint` baseline reelle 193 warnings preservee (cf. (D3) 9.A.2 Completion Notes) ; `npm run lint:a11y-check` baseline 155 preservee ; `npm run test:unit` exit 0 (94 SC existants + 6-8 nouveaux SC = 100-102 tests verts).
6. **AC6** : `npm run check:no-direct-notifications-log-insert` / `check:as-any-global` / `check:oracle-paywall` exit 0 (aucune regression linting custom).
7. **AC7** : 1 run GHA `integration-tests` vert post-merge (pattern relaxe F-Epic9-A2 : 1 run suffit pour ajustement seuil coverage, pas besoin de 2 runs verts consecutifs comme story applicative).
8. **AC8** : `deferred-work.md` entree `## Deferred from: implementation of 9-a-2-coverage-parrainage-85-percent-gha-artefact` : item **9.A.2.b** mis a jour avec chiffre final mesure + branches restantes a couvrir pour 9.A.2.c (palier 3 -> 85%). `DECISIONS.md F-Epic9-A2 > Implications > Stories follow-up` mis a jour avec palier 2 effectif + lien commit.
9. **AC9** : commit dedie format `Story 9.A.2.b : test(parrainage) SC unit detectBlacklist + confirm paths -> palier 2 (~65%)` + PR titre clair + entree dans Change Log de cette story (statut `ready-for-dev` -> `in-progress` -> `review` -> `done`).
10. **AC10** : aucune modification de `app/actions/parrainage.ts` (story 100% test). Si une branche n'est PAS exercable sans toucher le code source (ex. retry 23505 collision keyspace 31^8), elle est **explicitement listee** dans Completion Notes comme `[Defer 9.A.2.c]` ou `[Hors palier 2]` avec justification -- pas de force par mock artificiel qui n'a pas de valeur metier.

## Tasks / Subtasks

- [x] **T1 Lecture coverage rapport actuel** (AC1, AC10)
  - [x] T1.1 Telecharger artefact `coverage-integration` du dernier run GHA `integration-tests` sur main (run #26005309649 ou plus recent post-9.A.2 merge).
  - [x] T1.2 Ouvrir `coverage/index.html` ou parser `coverage/coverage-summary.json` ligne `"app/actions/parrainage.ts"` : noter les 4 indicateurs courants + identifier les ranges de lignes **rouges** dans `detectBlacklist` (36-101) et `confirmParrainageOnSuccess` (837-1147).
  - [x] T1.3 Cross-reference avec defer ligne 13 (`detectBlacklist` 36-101 + paths role inattendu / validation_status_skipped / generate_code_failed 1031-1083). Confirmer que les 6-8 SC vises sont effectivement non couverts.
  - [x] T1.4 Lister explicitement les branches `[Defer 9.A.2.c]` (ex. `createParrainageRelation` self_referral/23505/blacklist_other/meme_ip 524-831 + `revokeFilleuleValidation*` 108-235).

- [x] **T2 SC unit `detectBlacklist`** (AC1.a-e, AC4)
  - [x] T2.1 SC12 : `detectBlacklist` blocage `meme_email` direct (`marraineUser.email` normalize == `filleuleEmail` normalize). Mock `mockNormalizeEmail` retourne meme valeur pour les 2 inputs. Seed `users` table-aware : 1 reponse `{ data: { email: 'alice@ex.fr' } }` (lookup marraine). Assert return `{ blocage: 'meme_email' }`.
  - [x] T2.2 SC13 : `detectBlacklist` blocage `meme_email` via P9 multi-filleules historiques. Seed `users` 2 reponses (marraine sans match direct, lookup `in(filleuleIds)` retourne 1 row avec email matching). Seed `parrainages` 1 reponse `otherFilleulesIds` non vide. Assert return `{ blocage: 'meme_email' }`.
  - [x] T2.3 SC14 : `detectBlacklist` flag `meme_ip`. Seed `parrainages` 2e reponse (lookup IP matches) non vide. Filleule email != marraine email (pas de blocage). Assert return `{ flag: 'meme_ip' }`.
  - [x] T2.4 SC15 : `detectBlacklist` no match (return `{}`). Seed marraine email different, pas d'autres filleules, IP `null`. Assert return `{}` (objet vide).
  - [x] T2.5 SC16 : `detectBlacklist` edge cases : (a) `filleuleEmail = null` -> skip bloc email entier ; (b) `ipInscription = null/empty` -> skip bloc IP. Combiner les 2 dans un meme SC ou separer. Assert no Sentry capture, return `{}`.

  *Note dev* : `detectBlacklist` n'est PAS exporte (helper interne). Le tester directement requiert soit (a) `export` temporaire `// @internal-test-only` (anti-pattern, ne PAS faire), soit (b) tester via `createParrainageRelation` qui l'appelle apres l'INSERT initial (recommande). Choisir (b) : seeder `parrainages_codes` + `users` + `subscriptions` pour passer `validateCode`, puis le 1er INSERT `parrainages` reussit, puis `detectBlacklist` est invoque sur les donnees seedees. Verifier le `capturedInserts` ou un side-effect (Sentry signal `parrainage_flag` / blacklist update).

- [x] **T3 SC unit `confirmParrainageOnSuccess` paths edge** (AC1.f-h, AC4)
  - [x] T3.1 SC17 : `parrainRoleConfirm` inattendu. Seed `users` lookup role retourne `{ data: { role: 'admin' } }` (ou `null`, ou autre valeur). Assert return `{ ok: false, reason: 'marraine_no_longer_validated' }` + `mockCaptureMessage` invoque avec `'parrainage marraine unexpected role at confirm'` + tag `signal: 'marraine-unexpected-role-at-confirm'`.
  - [x] T3.2 SC18 : `validation_status_skipped`. Seed flow jusqu'a `lockedRows = [{id}]` reussi, puis `accompagnants_profiles.update` (.eq validation_status='en_attente').select retourne `[]` (validationUpdated vide = filleule pas `en_attente`). Seed lookup `currentProfile` retourne `{ validation_status: 'refuse' }` (pas `valide`). Assert `mockCaptureMessage` invoque avec `'parrainage validation status skipped'` + admin_actions_log insert capture avec `action_type: 'parrainage_validation_skipped'` + `current_status: 'refuse'`. Assert return `{ ok: true }` (flow continue malgre skip).
  - [x] T3.3 SC19 : `generate_code_failed`. Seed flow jusqu'au update validation reussi, puis `mockGenerateCodeForUserSystem` retourne `{ error: 'db_constraint_violation' }` (pas de `code` dans le resultat). Assert `mockCaptureMessage` invoque avec `'parrainage generate code failed'` + admin_actions_log insert capture avec `action_type: 'parrainage_code_generation_failed'`. Assert return `{ ok: true }` (flow continue : la filleule est validee, le code est rattrapable par admin).

- [x] **T4 Verifications locales** (AC5, AC6)
  - [x] T4.1 `npx vitest run --project unit` : **102 SC verts** (94 existants + 8 nouveaux).
  - [x] T4.2 `npx vitest run --project unit --coverage` : indicateurs locaux unit-only `app/actions/parrainage.ts` = **lines 59.86 / branches 48.07 / functions 78.57 / statements 58.24** (point de comparaison avant push GHA).
  - [x] T4.3 `npx tsc --noEmit` exit 0.
  - [x] T4.4 `npm run lint` : 193 warnings preserves (baseline reelle, cf. (D3) 9.A.2). 0 erreur.
  - [x] T4.5 `npm run lint:a11y-check` : baseline 155 preserve. `npm run a11y:axe:check` : N/A (story 100% tests, pas d'UI touchee — voir DoD a11y plus bas).
  - [x] T4.6 `npm run check:no-direct-notifications-log-insert` / `check:as-any-global` / `check:oracle-paywall` : exit 0.

- [x] **T5 Push + run GHA + ajustement seuil palier 2** (AC2, AC3, AC7)
  - [x] T5.1 Push branche `story/9-a-2-b-coverage-palier-65`. Workflow `integration-tests` declenche sur PR #13.
  - [x] T5.2 1er run GHA #26037648833 mesure coverage cumulee unit+integration : lines **67.47** / branches **59.61** / functions **92.85** / statements **65.65**. Palier 1 (49/41/64/48) franchi sur tous les indicateurs. Integration + E2E + Vercel Preview verts.
  - [x] T5.3 `vitest.config.ts > thresholds` MAJ : `lines: 67 / branches: 59 / functions: 92 / statements: 65` (chiffres mesures arrondis au point inferieur, plancher palier 1 maintenu).
  - [x] T5.4 **Option B-bis appliquee** : branches plafonne a 59.61 (< 65) -> palier 2 effectif sur branches = 59 (mesure reelle). 3/4 indicateurs franchissent 65%. DECISIONS.md F-Epic9-A2 enrichi.
  - [x] T5.5 2e push (ajustement thresholds + doc) sur la meme PR #13. 1 run vert suffit (pattern F-Epic9-A2 relaxe).

- [x] **T6 Documentation + handoff** (AC8, AC9)
  - [x] T6.1 `DECISIONS.md > F-Epic9-A2` : bloc "Palier 2 atteint le 2026-05-18 via 9.A.2.b" ajoute avec chiffres GHA + Option B-bis branches + ref PR #13 / run #26037648833.
  - [x] T6.2 `deferred-work.md > 9.A.2.b` solde `[Solde 9.A.2.b - 2026-05-18 - PR #13 / run GHA #26037648833]` + chiffres. `9.A.2.c` enrichi avec branches RESTANTES precises (createParrainageRelation self_referral/23505/blacklist_other/meme_ip, revokeFilleuleValidation*, retry generateCode 23505 documente non couvrable).
  - [x] T6.3 `_bmad-output/implementation-artifacts/sprint-status.yaml` : `9-a-2-b-...` `ready-for-dev` -> `in-progress` -> `review` (post-merge passera a `done`).
  - [x] T6.4 Memoire `project_epic_9_cadrage` MAJ : 9 stories done 2026-05-18 + chiffres palier 2 effectif + branches Option B-bis documente.
  - [x] T6.5 Change Log de cette story : 3 entrees (creation ready-for-dev, implementation in-progress->review, ajustement thresholds post-GHA).

## Dev Notes

### Source documents

- **Source primaire** : `_bmad-output/implementation-artifacts/deferred-work.md:13` (item 9.A.2.b : branches `detectBlacklist` 36-101 + `confirmParrainageOnSuccess` paths role inattendu / validation_status_skipped / generate_code_failed 1031-1083, estimation ~6-8 SC unit).
- **Source decision** : `DECISIONS.md > F-Epic9-A2` (Option B evolutive seuil palier 1 49/41/64/48, roadmap 3 paliers, palier 2 = 65% via 9.A.2.b ciblant les memes branches).
- **Source code cible** : `app/actions/parrainage.ts:36-101` (`detectBlacklist`) + `app/actions/parrainage.ts:837-1147` (`confirmParrainageOnSuccess`, branches 966-981 role inattendu, 1031-1061 validation_status_skipped, 1065-1083 generate_code_failed).
- **Source helper test** : `tests/unit/_lib/supabase-mock.ts` (livre 9.A.1, helper `createSupabaseFromMock` table-aware). Voir `tests/unit/supabase-mock.test.ts` pour garanties testees.
- **Source SC pattern** : `tests/unit/parrainage-symetrie.test.ts` (11 SC existants livres 8.A.2/8.A.3 + migres 9.A.1, structure decrite ligne 1-13 du fichier). SC6/SC7 (lignes 304-385) sont les references les plus proches pour les nouveaux SC `confirmParrainageOnSuccess`.

### Branches non couvertes priorisees (chiffres approximatifs au cadrage)

D'apres `_bmad-output/implementation-artifacts/9-a-2-coverage-parrainage-85-percent-gha-artefact.md > Dev Notes > Branches non couvertes attendues` + chiffre palier 1 GHA #26005309649 (49.48 lines / 41.92 branches / 64.28 functions / 48.14 statements) :

| Cible | Lignes source | SC vise | Justification (defer + DECISIONS.md) |
|---|---|---|---|
| `detectBlacklist` blocage meme_email direct | 47-57 | SC12 | Defer ligne 13 : "combler branches detectBlacklist (36-101)" |
| `detectBlacklist` P9 multi-filleules | 59-83 | SC13 | Idem |
| `detectBlacklist` flag meme_ip | 86-98 | SC14 | Idem |
| `detectBlacklist` no match return `{}` | 100 | SC15 | Branche par defaut, gratuit a couvrir |
| `detectBlacklist` skip email/IP vides | 47, 87 | SC16 | Edge case, gratuit a couvrir |
| `confirmParrainageOnSuccess` role inattendu | 966-981 | SC17 | Defer ligne 13 : "role inattendu" |
| `confirmParrainageOnSuccess` validation_status_skipped | 1031-1061 | SC18 | Defer ligne 13 : "validation_status_skipped" |
| `confirmParrainageOnSuccess` generate_code_failed | 1065-1083 | SC19 | Defer ligne 13 : "generate_code_failed" |

**Gain estime** : +14-18 branches couvertes sur ~80-100 branches du fichier = +15 a +20 pts de coverage branches. Sur les autres indicateurs (lines/statements) : +6-8 pts. Cible 65% atteignable si les SC sont propres.

**Hors palier 2 / [Defer 9.A.2.c]** :
- `createParrainageRelation` self_referral / 23505 / blacklist_other / meme_ip (524-831) -- volumineux, 5-7 SC dedies.
- `revokeFilleuleValidation*` (108-235) -- 2 fonctions internes, appellees par admin/webhook.
- `generateCodeForUser` retry 23505 (237-303) -- collision keyspace 31^8 ~10^12, mock artificiel hors valeur metier (defer 8.A.1 F11 documente deja "non exerce en pratique").

### Helper test : `createSupabaseFromMock` rappel d'usage

```ts
// tests/unit/_lib/supabase-mock.ts
const { fromMock, capturedInserts, capturedUpdates } = createSupabaseFromMock({
  users: [
    { data: { email: 'alice@ex.fr' }, error: null },     // 1er from('users')
    { data: { email: 'bob@ex.fr' }, error: null },       // 2e from('users')
  ],
  parrainages: [
    { data: [{ filleule_id: 'f1' }, { filleule_id: 'f2' }], error: null }, // .select('filleule_id').eq.neq.not -> array
  ],
})
mockCreateClient.mockResolvedValue({ from: fromMock })
```

**Discriminant par nom de table** : chaque appel `supabase.from('users')` consomme la prochaine reponse de la file `users[]`, independamment des appels intercalaires sur d'autres tables. Pattern hérite 9.A.1 AC8.

**`capturedInserts` / `capturedUpdates`** : tableaux qui collectent les `{ table, payload }` de chaque `.insert(...)` / `.update(...)`. Utiles pour asserter `admin_actions_log.insert` avec `action_type: 'parrainage_validation_skipped'` ou `'parrainage_code_generation_failed'`.

### Pattern SC `confirmParrainageOnSuccess` (basé SC6/SC7 lignes 304-385)

Sequence des `from()` calls dans `confirmParrainageOnSuccess` (rappel pour seedage table-aware) :
1. `parrainages.select(id,statut,marraine_id,filleule_id).eq.eq.order.limit.maybeSingle` -> parrainage row
2. `users.select(role).eq(marraine_id).maybeSingle` -> role parrain
3. **Branching role-aware** : `subscriptions.select.eq.maybeSingle` (si role='accompagne') OU `accompagnants_profiles.select(validation_status).eq.maybeSingle` (si role='accompagnant') OU **fail-fast Sentry warning** (sinon, branche SC17 a couvrir)
4. `accompagnants_profiles.select(id).eq(user_id).maybeSingle` -> filleule profile
5. `parrainages.update.eq.eq.select` -> lockedRows
6. `accompagnants_profiles.update.eq.eq.select` -> validationUpdated (`[]` declenche SC18)
7. (Si SC18) `accompagnants_profiles.select(validation_status).eq.single` -> currentProfile
8. (Si SC18) `admin_actions_log.insert({ action_type: 'parrainage_validation_skipped', ... })`
9. `generateCodeForUserSystem(user.id)` -- mock retourne `{ error }` declenche SC19
10. (Si SC19) `admin_actions_log.insert({ action_type: 'parrainage_code_generation_failed', ... })`
11. `users.select(email,fn).eq(marraine).single`
12. `users.select(email,fn).eq(filleule).single`
13. `admin_actions_log.insert({ action_type: 'validation_par_parrainage', ... })`

Pour SC17 (role inattendu), arreter le seedage a l'etape 2 (role = 'admin' ou null). Pour SC18, etendre seedage jusqu'a etape 7+8. Pour SC19, etendre jusqu'a etape 10 + mocker `generateCodeForUserSystem` avec `{ error }`.

### Mocks deja en place (a NE PAS dupliquer)

Voir lignes 18-96 de `tests/unit/parrainage-symetrie.test.ts` : tous les `vi.mock(...)` necessaires (`@/lib/supabase/server`, `@sentry/nextjs`, `next/server`, `next/cache`, `next/headers`, `@/lib/stripe`, `@/lib/parrainage-codes`, `@/lib/emails`, `@/lib/subscription-helpers`, `@/lib/rate-limit-hash`, `@/lib/get-client-ip`, `@/lib/parrainage-detection`) sont **deja hoisted** au top du fichier. Si nouveau SC dans **meme** fichier : reutiliser. Si nouveau fichier separe : copier le bloc hoisted (acceptable).

### Testing standards

- Pas de fixtures cross-suite ajoutees. Tous les nouveaux SC reutilisent `createSupabaseFromMock` (9.A.1) + mocks hoisted existants.
- Baseline lint 193 warnings preservee. Pas d'`as any` ni `@ts-ignore` sans justification commentaire. Pas de `console.log` dans les tests.
- `beforeEach(() => { vi.clearAllMocks() })` au top de chaque `describe` (pattern existant ligne 131 du fichier).
- Nommage SC : continuer la numerotation `SC12` -> `SC19` (SC11 etait le dernier en 9.A.1). Description format `it('SCXX : <ce qui est teste> -> <resultat attendu>', async () => { ... })`.
- Si nouveau fichier : suivre pattern `tests/unit/parrainage-codes-genesis.test.ts` (entete commentaire, mocks hoisted, describe groupes par fonction).

### Hors scope explicite

- **Pas de modification de `app/actions/parrainage.ts`**. Story 100% tests. Si une branche n'est pas testable sans toucher le code, defer 9.A.2.c ou hors-palier-2 documente.
- **Pas de coverage sur d'autres fichiers**. Seuil reste per-file `app/actions/parrainage.ts` (cf. F-Epic9-A2). Cibler `lib/parrainage-codes.ts` ou `webhooks/stripe/route.ts` = story future.
- **Pas de migration BDD**. Pas de nouveau script `check-*.mjs`. Pas de nouveau workflow GHA. La story etend uniquement `tests/unit/parrainage-symetrie.test.ts` (ou cree fichiers tests dedies) + ajuste `vitest.config.ts > thresholds`.
- **Pas de regen baseline a11y / lint** (story 100% tests, 0 composant React touche). DoD a11y N/A (pattern herite 9.A.1, 9.A.2).
- **Pas d'export `detectBlacklist`** pour le tester directement. Le tester via `createParrainageRelation` qui l'appelle (pattern recommande T2 Note dev).
- **Pas de SC ciblant `createParrainageRelation` branches volumineuses** (self_referral, idempotence 23505, blacklist_other, meme_ip RPC merge) -- explicitement reportes a 9.A.2.c.
- **Pas de SC ciblant `revokeFilleuleValidation*`** -- explicitement reportes a 9.A.2.c.
- **Pas de tentative de couvrir le retry 23505 de `generateCodeForUser`** -- defer 8.A.1 F11 documente non exerce.

### References

- [Source: _bmad-output/implementation-artifacts/deferred-work.md:13] -- 9.A.2.b cible defer.
- [Source: DECISIONS.md > F-Epic9-A2] -- Option B evolutive, roadmap 3 paliers, palier 2 cible 65%.
- [Source: _bmad-output/implementation-artifacts/9-a-2-coverage-parrainage-85-percent-gha-artefact.md > Dev Notes > Branches non couvertes attendues (lignes 186-196)] -- analyse statique branches non couvertes.
- [Source: _bmad-output/implementation-artifacts/9-a-2-coverage-parrainage-85-percent-gha-artefact.md > Dev Agent Record > Completion Notes (D4)] -- chiffre palier 1 mesure run GHA #26005309649.
- [Source: _bmad-output/planning-artifacts/epic-9.md#Story 9.A.2] -- story mere, contexte epic 9.A hardening Epic 8.
- [Source: app/actions/parrainage.ts:36-101] -- `detectBlacklist`, code source cible.
- [Source: app/actions/parrainage.ts:837-1147] -- `confirmParrainageOnSuccess`, code source cible (branches 966-981, 1031-1061, 1065-1083 prioritaires).
- [Source: tests/unit/parrainage-symetrie.test.ts:1-649] -- 11 SC existants + pattern hoisted mocks + helper `buildConfirmMocks` (l. 305-368) modele direct pour SC17/18/19.
- [Source: tests/unit/_lib/supabase-mock.ts] -- helper `createSupabaseFromMock`, livre 9.A.1, AC4 contraint a reutiliser.
- [Source: tests/unit/supabase-mock.test.ts] -- garanties testees du helper (AC8 a-f 9.A.1).
- [Source: vitest.config.ts:15-56] -- bloc `coverage` racine, seuil per-file palier 1 actuel.
- [Source: package.json scripts] -- `test:unit`, `test:integration:coverage`.
- [Source: https://vitest.dev/guide/coverage] -- doc Vitest 4.x coverage (`thresholds`, `reporter`, `include/exclude`).

### Project Structure Notes

- Alignement strict avec la structure existante. Aucun nouveau dossier. Modification surfacique :
  - `tests/unit/parrainage-symetrie.test.ts` (+150 a +250 lignes ajoutees pour 6-8 SC) OU 2 nouveaux fichiers `tests/unit/parrainage-detect-blacklist.test.ts` + `tests/unit/parrainage-confirm-paths.test.ts` (~100 lignes chacun, mocks hoisted dupliques).
  - `vitest.config.ts > coverage.thresholds['app/actions/parrainage.ts']` (4 valeurs numeriques + commentaire mis a jour).
  - `_bmad-output/implementation-artifacts/sprint-status.yaml` (3 changements status).
  - `_bmad-output/implementation-artifacts/deferred-work.md` (item 9.A.2.b soldé + 9.A.2.c precise).
  - `DECISIONS.md > F-Epic9-A2` (ajout ligne palier 2 atteint).
- **Decision dev** : preference pour ajouter dans le fichier existant `parrainage-symetrie.test.ts` (continuite SC12 a SC19) sauf si le fichier depasse 800-900 lignes apres ajout (gene readability). Si split necessaire : 2 fichiers thematiques avec mocks hoisted dupliques (acceptable, pas de refacto cross-fichiers).

## Dev Agent Record

### Agent Model Used

claude-opus-4-7 (1M context) -- bmad-dev-story workflow

### Debug Log References

- `npx vitest run --project unit tests/unit/parrainage-symetrie.test.ts` : 19 SC PASS (11 existants + 8 nouveaux SC12-SC19).
- `npx vitest run --project unit` (full unit suite) : 102 SC PASS / 0 FAIL.
- `npx vitest run --project unit --coverage` : `app/actions/parrainage.ts` unit-only = lines 59.86 / branches 48.07 / functions 78.57 / statements 58.24 (gain estime vs palier 1 49/41/64/48 = +10 lines, +7 branches, +14 functions, +10 statements).
- `npx tsc --noEmit` : exit 0.
- `npm run lint` : 193 warnings preserves (baseline F-Epic9-A2 9.A.2 D3), 0 erreur.
- `npm run lint:a11y-check` : OK baseline 155 preservee.
- `npm run check:no-direct-notifications-log-insert` / `check:as-any-global` / `check:oracle-paywall` : exit 0.

### Completion Notes List

**(D1) 8 SC ajoutes au fichier `tests/unit/parrainage-symetrie.test.ts`** (preference fichier unique pour continuite numerotation SC12 -> SC19, ligne ajoutee : +311). Reuse strict `createSupabaseFromMock` (9.A.1 AC8) + mocks hoisted existants (lignes 18-96). Aucun nouveau helper test cree.

**(D2) Decision pattern test indirect `detectBlacklist`** : helper non export -> teste via `createParrainageRelation` qui l'appelle apres l'INSERT initial (T2 Note dev). Confirmation par observable side-effect : return value (`reason: 'blacklist_meme_email'` ou `ok: true` + RPC `merge_parrainage_flag_suspicion` appele pour meme_ip).

**(D3) Coverage local unit-only mesure** : lines **59.86%** / branches **48.07%** / functions **78.57%** / statements **58.24%**.

**(D3-bis) Coverage cumulee unit+integration GHA #26037648833** : lines **67.47%** / branches **59.61%** / functions **92.85%** / statements **65.65%**. Gain mesure vs palier 1 (49.48/41.92/64.28/48.14) = **+17.99 lines / +17.69 branches / +28.57 functions / +17.51 statements**. Palier 2 (65%) **atteint sur 3/4 indicateurs** (lines, functions, statements). **Branches plafonne a 59.61** -> Option B-bis appliquee : palier 2 effectif branches = 59 (arrondi au point inferieur), gap residuel -5.39 pts vs cible 65% reporte sur 9.A.2.c.

**(D4) Hors palier 2 / [Defer 9.A.2.c]** explicitement non testes par cette story (justifies AC10 + Dev Notes Hors palier 2) :
- `createParrainageRelation` self_referral (l. 544) + idempotence 23505 retry (l. 634-650) + blacklist_other (l. 612) -- volumineux, defer 9.A.2.c (~5-7 SC dedies).
- `revokeFilleuleValidation*` (l. 108-235) -- 2 fonctions internes, appellees par admin/webhook, defer 9.A.2.c.
- `generateCodeForUser` retry 23505 (l. 237-303) -- collision keyspace 31^8 ~10^12, mock artificiel sans valeur metier (defer 8.A.1 F11 documente "non exerce en pratique"). Pas de SC propose.
- Branches `validateCode` accompagnant `accompagnants_profiles` lookup (l. ~460) : couvert partiellement par SC3 mais pas exhaustif. Defer 9.A.2.c.

**(D5) DoD a11y** : N/A par construction. Story 100% tests unitaires, 0 fichier `.tsx` touche. Baselines `lint:a11y-check` 155 + `axe-core` 0 violations Critical/Serious preservees (pattern herite stories soeurs 9.A.1 / 9.A.2).

**(D6) T5/T6 finalises** : 1er run GHA #26037648833 vert (integration + e2e + Vercel Preview). Coverage cumulee mesuree -> ajustement `vitest.config.ts > thresholds` palier 2 effectif `67/59/92/65` (Option B-bis branches). DECISIONS.md F-Epic9-A2 enrichi + deferred-work.md 9.A.2.b solde + 9.A.2.c precise (branches restantes ~7-10 SC). Memoire `project_epic_9_cadrage` MAJ (9 stories done 2026-05-18).

### File List

**Modifies** (2 fichiers, 1 source) :
- `tests/unit/parrainage-symetrie.test.ts` (+311 lignes : SC12-SC19, 8 SC ajoutes apres l. 648, total fichier ~960 lignes).
- `_bmad-output/implementation-artifacts/sprint-status.yaml` (status 9-a-2-b : ready-for-dev -> in-progress -> review).

**Inchanges (verifies)** :
- `app/actions/parrainage.ts` : aucune modification (AC10).
- `tests/unit/_lib/supabase-mock.ts` : reuse strict, aucune extension necessaire.

**Modifies post-1er-run-GHA (T5/T6)** :
- `vitest.config.ts > coverage.thresholds['app/actions/parrainage.ts']` : `lines: 67 / branches: 59 / functions: 92 / statements: 65` (Option B-bis branches).
- `DECISIONS.md > F-Epic9-A2` : bloc "Palier 2 atteint le 2026-05-18 via 9.A.2.b" ajoute.
- `_bmad-output/implementation-artifacts/deferred-work.md` : 9.A.2.b solde `[Solde 9.A.2.b - 2026-05-18 - PR #13 / run GHA #26037648833]`, 9.A.2.c precise branches restantes.
- Memoire `~/.claude/projects/.../memory/project_epic_9_cadrage.md` : 9 stories done 2026-05-18 + chiffres palier 2 effectif.

## DoD a11y

N/A -- story 100% tests unitaires sans impact UI applicatif. Aucun composant React, page HTML, label, focus, contraste ni navigation clavier modifies. Baselines `lint:a11y-check` 155 + `axe-core` 0 violations Critical/Serious sur 7 parcours sont preservees par construction (aucun fichier `.tsx` touche). Pattern herite des stories soeurs 9.A.1 (DoD a11y N/A) et 9.A.2 (DoD a11y N/A pour stories 100% tests/config).

## Change Log

- 2026-05-18 -- Story creee via `bmad-create-story` (workflow `/bmad-create-story`). Source : defer ligne 13 `_bmad-output/implementation-artifacts/deferred-work.md` + `DECISIONS.md > F-Epic9-A2` palier 2 cible 65% + analyse statique branches non couvertes 9.A.2 Dev Notes. 6-8 SC unit cibles : SC12-SC16 (`detectBlacklist`) + SC17-SC19 (`confirmParrainageOnSuccess` paths edge). Status `backlog` -> `ready-for-dev`.
- 2026-05-18 -- Implementation via `bmad-dev-story`. 8 SC ajoutes (`tests/unit/parrainage-symetrie.test.ts` +311 lignes, SC12-SC19). 102 SC verts (94+8). Coverage unit-only mesure : lines 59.86 / branches 48.07 / functions 78.57 / statements 58.24 (vs palier 1 49/41/64/48). `tsc --noEmit` OK, `npm run lint` 193 warnings (baseline), `lint:a11y-check` 155 (baseline), 3 checks custom exit 0. Status `ready-for-dev` -> `in-progress` -> `review`. PR #13 ouverte.
- 2026-05-18 -- Run GHA #26037648833 vert (integration + e2e + Vercel Preview). Cumul unit+integration mesure : lines **67.47** / branches **59.61** / functions **92.85** / statements **65.65**. Palier 2 (65%) atteint sur 3/4 indicateurs ; branches plafonne 59.61 -> **Option B-bis** appliquee (palier 2 effectif `lines: 67 / branches: 59 / functions: 92 / statements: 65`). `vitest.config.ts > thresholds` MAJ + DECISIONS.md F-Epic9-A2 enrichi + deferred-work.md 9.A.2.b solde + 9.A.2.c precise. Memoire `project_epic_9_cadrage` MAJ. Commit ajustements thresholds + doc.
