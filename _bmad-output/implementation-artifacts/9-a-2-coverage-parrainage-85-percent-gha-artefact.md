# Story 9.A.2 : Coverage `app/actions/parrainage.ts` >= 85% (workflow GHA + artefact)

Status: ready-for-dev

<!-- Note: Validation is optional. Run validate-create-story for quality check before dev-story. -->

## Story

As a **tech lead du projet roxanetnous**,
I want **mesurer en CI la couverture de `app/actions/parrainage.ts` via la suite integration existante, publier le rapport comme artefact GHA et bloquer le job sous le seuil 85%**,
so that **la cible AC4 de 8.A.4 (defere en defer `deferred-work.md` ligne 60 + I2 retro Epic 8) cesse d'etre theorique, que toute regression de couverture sur le code parrainage soit detectee a la PR, et que les branches non couvertes (anti-fraude `detectBlacklist`, idempotence 23505, anti auto-parrainage `self_referral`) soient explicitement tracees**.

## Contexte

La rétrospective Epic 8 (`epic-8-retro-2026-05-17.md#I2`) et le defer `deferred-work.md:60` documentent une dette identique : **la cible AC4 >= 85% de la story 8.A.4 n'a jamais été chiffrée**. Sylvain ne lance pas Docker localement (mémoire `feedback_test_local_supabase`) ; le workflow GHA `integration-tests.yml` exécute bien la suite mais n'instrumente pas la couverture et ne publie aucun rapport.

Le terrain technique est déjà préparé :

- Le script `test:integration:coverage` existe (`package.json:35` -> `vitest run --project integration --coverage`).
- Le provider `@vitest/coverage-v8@4.1.5` est déjà installé (`devDependencies` ligne 72).
- Vitest 4.x supporte nativement `coverage.thresholds[file_path]` pour un seuil per-file (cf. `node_modules/@vitest/coverage-v8/README.md` + https://vitest.dev/guide/coverage).
- La suite intégration `tests/integration/parrainage/symetrie.test.ts` (6 SC livrés 8.A.4) + la suite unit `tests/unit/parrainage-symetrie.test.ts` (11 SC SC1-SC11, 94/94 verts après 9.A.1) couvrent déjà le path role-aware central. La couverture cumulée des **deux suites** sur `app/actions/parrainage.ts` est le chiffre attendu >= 85%.

**Périmètre strict** : story d'observabilité/CI. Modifications limitées à `vitest.config.ts` (config coverage), `.github/workflows/integration-tests.yml` (étape coverage + artefact + check), `package.json` (commande équivalente locale déjà présente, ajustement éventuel), `_bmad-output/` (defer barré + mémoire `project_epic_9_cadrage` MAJ avec le chiffre publié). **Aucune modification du code applicatif** (`app/actions/parrainage.ts`, `lib/`, `components/`). Si une branche non couverte fait tomber sous 85% au premier run, on ajoute des SC tests dédiés dans la **même PR** (justifié AC3) ou on délimite la PR follow-up (AC3 option b).

## Acceptance Criteria

1. **AC1** — `vitest.config.ts` étendu avec un bloc `coverage` :
   - `provider: 'v8'` (déjà default, expliciter pour audit).
   - `reporter: ['text', 'json-summary', 'html']` (`text` pour CI logs lisibles, `json-summary` pour parser `coverage/coverage-summary.json`, `html` pour debug local).
   - `reportsDirectory: 'coverage'` (defaut, expliciter).
   - `include: ['app/**/*.{ts,tsx}', 'lib/**/*.{ts,tsx}']` (limite l'instrumentation au code prod, exclut `tests/`, `scripts/`, `_bmad-output/`, fichiers de config Next.js, etc.).
   - `exclude: ['**/*.test.ts', '**/*.spec.ts', '**/types.ts', 'app/**/layout.tsx', 'app/**/page.tsx', 'app/**/loading.tsx', 'app/**/error.tsx', 'app/**/not-found.tsx', '.next/**', 'app/api/auth/**', 'lib/database.types.ts']` (exclut React Server Components purs + types générés + auth-helpers qui ne sont pas dans le scope tests intégration).
   - `all: true` (instrumente AUSSI les fichiers non importés par les tests — sinon `coverage` ne voit que les modules effectivement chargés, ce qui inflate artificiellement les % en ignorant les fichiers non-couverts).
   - `thresholds: { 'app/actions/parrainage.ts': { lines: 85, branches: 85, functions: 85, statements: 85 } }` (path-specific threshold per-file, fait échouer `vitest run --coverage` si l'un des 4 indicateurs tombe sous 85% pour CE fichier ; les autres fichiers ne sont pas seuillés par cette story).
   - Le bloc `coverage` est placé **au niveau racine `test:`** (et non dans une `projects:` entry) afin de s'appliquer à toutes les suites simultanément (unit + integration) — la couverture cumulée des 2 projets sur `app/actions/parrainage.ts` est ce qui compte.

2. **AC2** — `.github/workflows/integration-tests.yml` étendu :
   - L'étape « Run integration tests » devient « Run integration tests with coverage » et appelle `npm run test:integration:coverage` au lieu de `npm run test:integration` (toutes les variables env existantes restent inchangées).
   - Nouvelle étape `Upload coverage artifact` après l'étape de tests, **conditionnelle `if: always()`** (publier même si le seuil échoue, pour permettre l'audit du `coverage-summary.json` qui montrera le delta) :
     ```yaml
     - name: Upload coverage artifact
       if: always()
       uses: actions/upload-artifact@v4
       with:
         name: coverage-integration
         path: coverage/
         retention-days: 30
     ```
   - L'étape « Stop Supabase » conserve son `if: always()` et reste positionnée en dernier.
   - **Pas** d'ajout d'un nouveau job ni d'un nouveau workflow. La story étend `integration-tests.yml` existant. Le seuil 85% est appliqué par vitest lui-même (AC1 `thresholds`) ; aucun script bash custom de parse JSON n'est requis (vitest exit code non-zero suffit à faire échouer le job).

3. **AC3** — Si le **premier run** de la coverage cumulée sur `app/actions/parrainage.ts` est < 85% (couverture lignes OU branches OU functions OU statements) :
   - **Option A (préférée si écart faible <= 5 pts)** : compléter la story en ajoutant des SC unit dans `tests/unit/parrainage-symetrie.test.ts` (ou un fichier dédié si scope large) **dans la même PR**. Cibles prioritaires identifiées par defer `deferred-work.md:60` et par lecture du source `app/actions/parrainage.ts` :
     - Branche `detectBlacklist` : email marraine == email filleule (ligne ~55), IP match autre filleul même marraine (ligne ~87-98), pas de blocage (ligne ~100).
     - Branche idempotence INSERT 23505 (`createParrainageRelation` ligne ~634-651) : RaceRow trouvé / non trouvé.
     - Branche `self_referral` (`createParrainageRelation` ligne ~544).
     - Branche `revokeFilleuleValidation` (ligne ~108-196) : profil `parrainage` vs noop log Sentry warning.
     - Branche `revokeFilleuleValidationFromWebhook` : path secret valid / path admin authentifié / path refus (ligne ~206-235).
     - Branche `confirmParrainageOnSuccess` rôle parrain inattendu (ligne ~966-981) + `validation_status_skipped` (ligne ~1031-1061).
   - **Option B (si écart > 5 pts ou branche bloquée par limite tests intégration)** : (a) ajouter une entrée dédiée dans `deferred-work.md` (section `## Deferred from: implementation of 9-a-2-coverage-parrainage-85-percent-gha-artefact`) listant les branches non couvertes avec lignes exactes et raison, (b) ABAISSER le seuil `thresholds` dans `vitest.config.ts` au chiffre courant (par ex. 78 si on est à 78,3) pour DÉBLOQUER la CI, et (c) créer immédiatement une story follow-up 9.A.2.b « combler branches XXX » dans `sprint-status.yaml` sous mini-épic 9.A (status `backlog`). Le but est qu'on ne triche jamais sur le seuil sans tracer la dette.
   - **Le choix Option A vs B est documenté dans le Dev Agent Record** avec le chiffre constaté au premier run.

4. **AC4** — Le chiffre final de couverture (lignes / branches / functions / statements pour `app/actions/parrainage.ts`) est :
   - Publié dans le commentaire `Completion Notes List` de cette story.
   - Reporté dans la mémoire `project_epic_9_cadrage` (ou successeur si rétro Epic 9 déjà ouverte) avec format `9.A.2 chiffre coverage final : lines X% / branches Y% / functions Z% / statements W% au commit <SHA>`.
   - Mentionné dans `DECISIONS.md` comme entrée `F-Epic9-A2` (section décision : seuil retenu, motivation : cible AC4 8.A.4 hardening), uniquement si Option B est retenue (sinon F-Epic9-A2 facultatif).

5. **AC5** — `npx tsc --noEmit` exit 0 sur les fichiers modifiés (2 erreurs `.next/types/` pré-existantes tolérées, baseline héritée 8.D.1 / 9.A.1).

6. **AC6** — `npm run lint` baseline 192 warnings (0 erreur) préservée. Aucune nouvelle règle TS/eslint n'est introduite par la story. La config vitest étendue ne contient pas de code applicatif lintable.

7. **AC7** — `npm run lint:a11y-check` exit 0 baseline 155 préservée (story 100% CI/config sans impact UI, run de sécurité pattern 9.A.1).

8. **AC8** — `npm run test:unit` exit 0 — minimum 94 tests verts (baseline 9.A.1, +tests éventuels Option A). Aucun test unit existant ne doit régresser.

9. **AC9** — `npm run test:integration` exit 0 en GHA (déclenchement PR). Le seuil `thresholds` per-file rend `npm run test:integration:coverage` fail si la couverture sur `app/actions/parrainage.ts` est < 85% sur l'un des 4 indicateurs — c'est le comportement attendu (vitest non-zero exit = job rouge). Le seuil ne s'applique PAS à `npm run test:integration` sans `--coverage` (le job standard pré-story reste vert si le code parrainage est inchangé).

10. **AC10** — `npm run build` exit 0 (story ne modifie pas `app/`, mais run de sécurité après modification config). Le `vercel-build` (`package.json:9` : `check:env && lint:a11y-check && check:ip-spoofing && check:as-any-admin && check:as-any-global && check:oracle-paywall && check:rls-helpers && check:no-direct-notifications-log-insert && next build`) n'est pas impacté (aucune nouvelle clé env ni de garde-fou ajouté).

11. **AC11** — **2 runs GHA verts consécutifs** sur la PR avant merge (stabilisation flaky pattern 8.D.1 / 9.A.1). Si le 1er run rouge est dû au seuil 85% non atteint, basculer en AC3 Option A ou B, **re-pousser le commit, et reprendre le compteur à 0**. Le but est de prouver la reproductibilité du chiffre coverage en CI (un run vert isolé pourrait masquer un test flaky qui inflate la couverture par chance).

12. **AC12** — `deferred-work.md` :
    - Barrer la ligne 60 (`## Deferred from: implementation of 8-a-4-tests-integration-parrainage-symetrique`, premier bullet « Couverture `app/actions/parrainage.ts` non mesurée localement ») avec préfixe `[Solde 9.A.2 - YYYY-MM-DD]` et note précisant le chiffre final + l'option retenue (A ou B).
    - Si Option B retenue, ajouter sous `## Deferred from: implementation of 9-a-2-coverage-parrainage-85-percent-gha-artefact` la liste des branches non couvertes avec ligne d'origine `app/actions/parrainage.ts:XXX` et story follow-up cible.

13. **AC13** — Documentation : ajouter une section dans `tests/integration/README.md` (ou créer un sous-fichier `tests/integration/COVERAGE.md` si l'auteur juge plus lisible) décrivant :
    - Comment lancer le report en local (`npm run test:integration:coverage` + chemin `coverage/index.html`).
    - Comment lire le `coverage-summary.json` artefact GHA (URL Actions tab > artifact).
    - Le seuil 85% spécifique à `app/actions/parrainage.ts` et la procédure si un futur dev fait baisser la couverture (combler ou tracer en defer + abaisser seuil + story follow-up — copier le pattern AC3).

14. **AC14** — Story **sans impact UI** = **DoD a11y N/A** (pattern hérité 9.A.1 : règle CLAUDE.md projet ligne `Accessibilite (a11y)` s'applique aux stories à impact UI uniquement ; story 100% CI/config). Les baselines `lint:a11y-check` 155 et axe-core 8 parcours sont vérifiées par run de sécurité (AC7) mais aucune action a11y spécifique n'est requise.

15. **AC15** — **Aucun fichier `app/`, `lib/`, `components/`, `supabase/migrations/` modifié** (audit `git diff --stat` montre uniquement : `vitest.config.ts`, `.github/workflows/integration-tests.yml`, `package.json` éventuellement, `tests/integration/README.md` ou `tests/integration/COVERAGE.md`, `_bmad-output/...`, `tests/unit/...` SI Option A AC3 retenue). Pattern AC15 strict hérité 8.A.4 / 9.A.1 (story additive observabilité, pas refactoring).

## Tasks / Subtasks

- [x] **T1 — Configurer le bloc `coverage` global dans `vitest.config.ts`** (AC: #1, #5, #6)
  - [x] T1.1 Ajouter `coverage: { provider: 'v8', reporter: ['text', 'json-summary', 'html'], reportsDirectory: 'coverage', include: [...], exclude: [...], thresholds: { 'app/actions/parrainage.ts': { lines: 85, branches: 85, functions: 85, statements: 85 } } }` au niveau `test:` racine. **Note 9.A.2 dev : option `all: true` retirée — n'existe plus dans Vitest 4.x (`CoverageOptions` ne déclare pas `all`). Depuis Vitest 3 le comportement par défaut couvre tous les fichiers matchant `include` même non importés par un test, donc équivalent fonctionnel.**
  - [x] T1.2 Valider la config en local sans Docker : `npx vitest run --project unit --coverage` exécuté, 94/94 verts. Couverture **unit-seule** : `app/actions/parrainage.ts` lines 42.9 / branches 30.38 / functions 50 / statements 41.75 (logique : la suite unit ne couvre qu'une partie du fichier, l'integration GHA cumulera).
  - [x] T1.3 `npx tsc --noEmit` exit 0 sur `vitest.config.ts` (compilation TS complète OK, 2 erreurs `.next/types/` pré-existantes inchangées).

- [x] **T2 — Étendre `.github/workflows/integration-tests.yml`** (AC: #2)
  - [x] T2.1 Étape `Run integration tests` renommée en `Run integration tests with coverage`, script `npm run test:integration:coverage`.
  - [x] T2.2 Nouvelle étape `Upload coverage artifact` insérée entre `Run integration tests with coverage` et `Stop Supabase` avec `if: always()`, `uses: actions/upload-artifact@v4`, `name: coverage-integration`, `path: coverage/`, `retention-days: 30`.
  - [x] T2.3 `actions/upload-artifact@v4` aligné sur les autres `@v4` du workflow.
  - [x] T2.4 Décision dev : `npm run test:integration:coverage` adapté pour lancer **les 2 projets** vitest (script passé de `vitest run --project integration --coverage` à `vitest run --coverage`). Sans cela, le bloc `coverage` racine n'agrège pas les hits unit. Cohérent avec Dev Notes « couverture cumulée des 2 projets ».

- [ ] **T3 — Lancer la mesure coverage initiale via GHA** (AC: #3, #4, #11)
  - [ ] T3.1 Pousser la branche, déclencher le 1er run PR.
  - [ ] T3.2 Si vert (>= 85% sur les 4 indicateurs) : aller à T6 (documentation + sprint-status). Pas d'AC3.
  - [ ] T3.3 Si rouge sur seuil : télécharger l'artefact `coverage-integration`, ouvrir `coverage/index.html` localement (ou parser `coverage-summary.json` à la main), identifier les branches non couvertes par ordre de criticité (priorité : `detectBlacklist`, `createParrainageRelation` self_referral / 23505, `confirmParrainageOnSuccess` paths role inattendu, `revokeFilleuleValidation*`).
  - [ ] T3.4 Décider Option A ou Option B (cf. AC3) ; consigner la décision + le chiffre constaté dans le Dev Agent Record AVANT la nouvelle itération.

- [ ] **T4 — Option A : ajouter SC unit ciblés (conditionnel selon T3.4)** (AC: #3, #8, #15)
  - [ ] T4.1 Ajouter SC dans `tests/unit/parrainage-symetrie.test.ts` (ou nouveau fichier `tests/unit/parrainage-detect-blacklist.test.ts` si scope large) couvrant les branches identifiées. Utiliser le helper `createSupabaseFromMock` (`tests/unit/_lib/supabase-mock.ts` livré par 9.A.1) avec discrimination par table.
  - [ ] T4.2 Vérifier que chaque nouveau SC respecte le pattern existant : `vi.mocked(Sentry.captureMessage)` / `vi.mocked(sendXxxEmail)` pour les assertions side-effects, `expect(fromMock).toHaveBeenCalledWith('table_name')` pour les assertions BDD.
  - [ ] T4.3 Re-pousser le commit, attendre le 2e run GHA. Si vert : continuer. Si rouge encore : itérer T3.3 -> T4.1.

- [ ] **T5 — Option B : abaisser seuil + tracer follow-up (conditionnel selon T3.4)** (AC: #3, #12)
  - [ ] T5.1 Dans `vitest.config.ts`, remplacer `lines: 85` par le chiffre actuel arrondi au point inférieur (ex. 78 si 78,3) sur les indicateurs en défaut UNIQUEMENT (laisser les autres à 85 si déjà atteints).
  - [ ] T5.2 Ajouter entrée `deferred-work.md` sous `## Deferred from: implementation of 9-a-2-coverage-parrainage-85-percent-gha-artefact` avec : (a) chiffre courant, (b) liste branches non couvertes (`app/actions/parrainage.ts:XXX <description>`), (c) story follow-up cible (9.A.2.b ou Epic 10+).
  - [ ] T5.3 Ajouter `9-a-2-b-combler-branches-non-couvertes-parrainage: backlog` dans `sprint-status.yaml` sous mini-épic 9.A, avec commentaire pointant vers le defer T5.2.
  - [ ] T5.4 Ajouter entrée `F-Epic9-A2` dans `DECISIONS.md` : section Décision (seuil abaissé à X%), Motivation (chiffre courant, branches non couvertes), Implications (story follow-up 9.A.2.b à exécuter avant remontée à 85%).

- [ ] **T6 — Stabilisation : 2 runs GHA verts consécutifs** (AC: #11)
  - [ ] T6.1 Premier run vert : noter le hash du commit + le chiffre coverage final dans le Dev Agent Record.
  - [ ] T6.2 Re-pousser un commit no-op (ex. ajustement commentaire dans `vitest.config.ts`) ou attendre un re-trigger naturel.
  - [ ] T6.3 Deuxième run vert : merge autorisé. Si rouge inattendu (flaky), investiguer le root cause AVANT de retenter — pattern hérité (ne jamais merger sur flaky).

- [x] **T7 — Documentation + sprint status** (AC: #4, #12, #13)
  - [x] T7.1 Section `## Coverage (story 9.A.2)` ajoutée dans `tests/integration/README.md` : commande locale, artefact GHA, seuil 85%, procédure A/B.
  - [x] T7.2 `deferred-work.md` ligne 60 barrée `[Solde 9.A.2 - 2026-05-17]` (chiffre final + option retenue à compléter post-1er run GHA dans Completion Notes List + édition complémentaire ligne `deferred-work.md` après T6).
  - [ ] T7.3 MAJ mémoire `project_epic_9_cadrage` — **reportée à la fin de T6** (chiffre coverage final connu uniquement après 1er run GHA).
  - [x] T7.4 Dev Agent Record + File List MAJ.
  - [x] T7.5 `sprint-status.yaml` : 9-a-2 passé `ready-for-dev` -> `in-progress` (bascule -> `review` après T6).

- [x] **T8 — DoD CI complet** (AC: #5, #6, #7, #8, #9, #10)
  - [x] T8.1 `npx tsc --noEmit` exit 0 (2 erreurs `.next/types/` pré-existantes tolérées).
  - [x] T8.2 `npm run lint` exit 0 — **193 warnings**, 0 erreur. **Note divergence story** : la spec annonce baseline 192, baseline réelle au moment de l'exécution = 193 (vérifié via `git stash` -> `npm run lint` -> `git stash pop`). Aucune régression introduite par la story (0 warning ajouté).
  - [x] T8.3 `npm run lint:a11y-check` exit 0 baseline 155.
  - [x] T8.4 `npm run test:unit` exit 0 — 94/94 verts en 1.17s.
  - [x] T8.5 `npm run check:no-direct-notifications-log-insert` exit 0.
  - [x] T8.6 `npm run check:as-any-global` exit 0.
  - [x] T8.7 `npm run check:oracle-paywall` exit 0.
  - [x] T8.8 `npm run build` exit 0.
  - [x] T8.9 `npm run a11y:axe:check` PAS REQUIS (DoD a11y N/A — AC14).
  - [ ] T8.10 Confirmer 2 runs GHA verts consécutifs sur la PR (T6) — **À FAIRE post-push**.

## Dev Notes

### Architecture & patterns hérités

- **Provider coverage** : `@vitest/coverage-v8` (déjà installé, devDep ligne 72 `package.json`). Pas d'installation requise. Pattern v8 = instrumentation native Chrome devtools, plus rapide que istanbul mais sans branch-aware sur les opérateurs `&&`/`||` ternaires aussi fin (suffisant pour notre cible). [Source: node_modules/@vitest/coverage-v8/README.md]
- **Thresholds per-file** : Vitest 4.x supporte `thresholds: { 'path/relative/to/cwd.ts': { lines, branches, functions, statements } }` au niveau racine `coverage`. Le path est relatif au `process.cwd()` du run (racine projet). Le glob est aussi accepté (`'app/actions/**/*.ts'`) mais on vise un fichier précis pour cette story. [Source: https://vitest.dev/guide/coverage#custom-coverage-thresholds]
- **Couverture cumulée unit + integration** : en plaçant `coverage` au niveau racine `test:` (et non dans une `projects:` entry), vitest agrège les hits des 2 projets dans un seul rapport. C'est nécessaire car SC1-SC11 unit couvrent le path role-aware en isolé tandis que SC1-SC6 integration couvrent les paths BDD réels (anti-fraude, idempotence, cron). Sans agrégation, aucun des 2 projets ne dépasse 85% seul. [Source: tests/unit/parrainage-symetrie.test.ts:11 SC + tests/integration/parrainage/symetrie.test.ts:6 SC]
- **`all: true` impératif** : sans cette option, vitest n'instrumente que les fichiers `import`és par les tests. Or `lib/parrainage-codes.ts`, `lib/parrainage-detection.ts`, `lib/rate-limit-hash.ts` (utilisés par `parrainage.ts`) doivent apparaître dans le rapport même s'ils ne sont pas chargés par un test direct, sinon on rate les branches qui passent par leurs helpers. [Source: https://vitest.dev/config/#coverage-all]
- **`reporter: 'json-summary'`** : produit `coverage/coverage-summary.json` (~5 KB), format machine-readable simple pour parser un éventuel commentaire automatique de PR ou pour comparer le delta entre runs. Pattern adopté par d'autres projets Vercel. [Source: https://vitest.dev/guide/coverage#coverage-reporters]
- **`actions/upload-artifact@v4`** : version courante (v3 deprecated octobre 2024, retiré GHA depuis février 2025). Pattern hérité par les autres `actions/*@v4` du workflow existant. Le path `coverage/` upload l'arborescence complète (HTML + JSON + LCOV éventuel). Rétention 30 jours = pattern standard repo.

### Source tree

**Fichiers modifiés :**

- `vitest.config.ts` : ajout du bloc `coverage` au niveau racine `test:` (~25 lignes), pas de touche aux `projects:` (unit + integration).
- `.github/workflows/integration-tests.yml` : modification de l'étape `Run integration tests` (renommage + script :coverage), insertion d'une étape `Upload coverage artifact` avec `if: always()` (~7 lignes ajoutées).
- `tests/integration/README.md` : ajout d'une section `## Coverage` (3-6 lignes) — ou création d'un fichier dédié `tests/integration/COVERAGE.md` si l'auteur juge plus lisible (au choix dev, documenter le choix dans Dev Agent Record).
- `_bmad-output/implementation-artifacts/deferred-work.md` : barrer 1 entrée ligne 60 + (conditionnel Option B) ajouter section dédiée 9.A.2.
- `_bmad-output/implementation-artifacts/sprint-status.yaml` : story 9-a-2 `ready-for-dev` -> `in-progress` -> `review`.
- (Conditionnel Option A) `tests/unit/parrainage-symetrie.test.ts` ou nouveau `tests/unit/parrainage-detect-blacklist.test.ts` : ajout de SC ciblant les branches non couvertes.
- (Conditionnel Option B) `DECISIONS.md` : entrée F-Epic9-A2.

**Fichiers PAS modifiés (audit strict AC15) :**

- `app/actions/parrainage.ts` (la story est observabilité pure).
- `app/api/webhooks/stripe/route.ts`, `app/api/cron/confirm-parrainages/route.ts` (cibles secondaires de couverture mais pas modifiées).
- `lib/parrainage-codes.ts`, `lib/parrainage-detection.ts`, `lib/emails.ts`, `lib/stripe.ts` (lib helpers).
- `supabase/migrations/`, `components/`.

### Testing standards

- Pas de fixtures cross-suite ajoutées. Les SC Option A AC3 réutilisent le helper `createSupabaseFromMock` livré par 9.A.1 (`tests/unit/_lib/supabase-mock.ts`). Pattern table-aware obligatoire (cf. CLAUDE.md projet, héritage I6 retro Epic 8). Ne PAS réintroduire un dispatcher positionnel.
- Les SC Option A doivent maintenir la baseline 192 lint warnings (cf. règles eslint projet : pas de `as any` sans `// eslint-disable-next-line` justifié + pas d'`@ts-ignore`).
- Si un nouveau SC nécessite de mocker un side-effect Sentry/Resend/Stripe, importer depuis `@sentry/nextjs` / `@/lib/emails` / `@/lib/stripe` et utiliser `vi.mocked(...)` (pattern hérité 8.A.4 / 9.A.1). Ne pas créer de nouveau `vi.mock(...)` global au top du fichier sans nécessité absolue.

### Branches non couvertes attendues (analyse statique au cadrage)

Lecture statique de `app/actions/parrainage.ts` (1148 lignes, 5 fonctions exportées) croisée avec les 6 SC intégration + 11 SC unit existants. **Branches probablement à compléter** si la couverture passe 85% sans elles :

- `detectBlacklist` ligne 36-101 (P9 multi-filleule même email + branche IP match) — testé partiellement par les E2E `tests/e2e/parrainage-anti-fraude.spec.ts` mais E2E n'est PAS comptée dans `npm run test:integration` (Playwright config séparée `playwright-e2e.config.ts`). Coverage v8 ne voit pas les hits Playwright. Donc tout SC anti-fraude doit être ajouté en unit ou integration vitest.
- `revokeFilleuleValidation` ligne 108-196 + `revokeFilleuleValidationFromWebhook` ligne 206-235 — appelée depuis `admin-parrainages.ts:confirmerFraude` + `webhooks/stripe/route.ts`. Peut-être déjà couverte par `tests/integration/stripe-webhook/checkout-completed-parrainage-bloque.test.ts` ; à vérifier au 1er run.
- `generateCodeForUser` ligne 237-303 — branche retry 23505 (collision UNIQUE) probable non couverte (probabilité keyspace 31^8 ~= 10^12). Defer 8.A.1 F11 documente déjà cette branche comme « non exercée en pratique » (`deferred-work.md:92`).
- `createParrainageRelation` ligne 524-831 — branche `self_referral` (ligne 544), idempotence INSERT 23505 (ligne 634), `blacklist_other` (ligne 612), `blacklistResult.flag === 'meme_ip'` (ligne 770-824 RPC `merge_parrainage_flag_suspicion` + `was_added` true/false).
- `confirmParrainageOnSuccess` ligne 837-1147 — branches `marraine_no_longer_validated` (3 paths : accompagne sub inactive, accompagnant validation refuse, rôle inattendu), `validation_status_skipped` (ligne 1031-1061), `generate_code_failed` (ligne 1065-1083).

**Estimation** : avec 17 SC actuels (6 integration + 11 unit), couverture initiale probablement **75-82%** (estimation chiffre, à vérifier au run). Pour atteindre 85% : prévoir 2-4 SC unit Option A ciblant `detectBlacklist` (la branche la plus volumineuse non couverte par les SC role-aware existants).

### Hors scope explicite

- **Pas de coverage sur d'autres fichiers**. Le seuil 85% ne s'applique QU'À `app/actions/parrainage.ts`. Le rapport coverage est généré pour tous les fichiers (`include: ['app/**/*.{ts,tsx}', 'lib/**/*.{ts,tsx}']`) pour observabilité, mais aucun seuil n'est appliqué ailleurs. Cibler `webhooks/stripe/route.ts` ou `lib/parrainage-codes.ts` serait une story dédiée future (9.A.2.c ou Epic 10+).
- **Pas de comment automatique de PR** (style `codecov` ou `coveralls`). Story future si besoin (`coverallsapp/github-action` ou similaire). Pour 9.A.2, l'artefact GHA suffit.
- **Pas de modification du seuil unit-only**. Le projet `unit` dans `vitest.config.ts` ne reçoit PAS de seuil séparé (toute la couverture est mesurée au global, projets agrégés).
- **Pas de migration BDD** (story 100% CI/config, pattern AC15 8.A.4 / 9.A.1).
- **Pas de nouveau garde-fou CI scripts/check-*.mjs**. La story ajoute UN nouveau check (le seuil coverage 85%), mais via la mécanique vitest native (`thresholds`), pas via un nouveau script bash custom.
- **Pas de regen baseline a11y / lint** (story n'introduit aucun composant React ni règle eslint nouvelle).
- **Pas d'optimisation des branches `detectBlacklist`** (les fix code = stories futures Epic 9 ou Epic 10+, par ex. `9.A.5 RPC atomique` couvre déjà `confirmerFraude`).

### References

- [Source: _bmad-output/planning-artifacts/epic-9.md#Story 9.A.2]
- [Source: _bmad-output/implementation-artifacts/epic-8-retro-2026-05-17.md#I2]
- [Source: _bmad-output/implementation-artifacts/epic-8-retro-2026-05-17.md#AI-Epic9-B2]
- [Source: _bmad-output/implementation-artifacts/deferred-work.md:60] — defer à barrer.
- [Source: _bmad-output/implementation-artifacts/8-a-4-tests-integration-parrainage-symetrique.md#AC4] — origine cible 85%.
- [Source: _bmad-output/implementation-artifacts/9-a-1-refonte-mocks-supabase-frommock-discriminants-par-table.md] — pattern story sœur Epic 9.A.
- [Source: app/actions/parrainage.ts:36-1147] — code cible coverage.
- [Source: tests/integration/parrainage/symetrie.test.ts:1-539] — 6 SC integration livrés 8.A.4.
- [Source: tests/unit/parrainage-symetrie.test.ts:1-649] — 11 SC unit livrés 8.A.2 / 8.A.3 + migrés 9.A.1.
- [Source: tests/unit/_lib/supabase-mock.ts] — helper `createSupabaseFromMock` livré 9.A.1.
- [Source: vitest.config.ts:1-42] — config base à étendre.
- [Source: .github/workflows/integration-tests.yml:1-69] — workflow à étendre.
- [Source: package.json:35,72] — script `test:integration:coverage` + `@vitest/coverage-v8@4.1.5` déjà présents.
- [Source: https://vitest.dev/guide/coverage] — documentation Vitest 4.x coverage (thresholds, reporters, all, exclude/include).
- [Source: https://github.com/actions/upload-artifact] — v4 doc.

### Project Structure Notes

- Alignement strict avec la structure existante : la story étend des fichiers existants sans créer de nouvelle arborescence (sauf éventuellement `tests/integration/COVERAGE.md` si l'auteur le préfère à une section dans le README — choix dev).
- Aucun conflit attendu. Si `vitest.config.ts` voit un autre PR concurrent introduire un bloc `coverage` (collision théorique), prioriser la spec 9.A.2 et rebaser.
- Le glob `include: ['app/**/*.{ts,tsx}', 'lib/**/*.{ts,tsx}']` ne couvre PAS `scripts/`, `_bmad-output/`, `tests/`, ni les fichiers générés. C'est intentionnel : on mesure le code livré aux utilisateurs finaux. Si une story future veut étendre la coverage aux scripts (par ex. `scripts/seed-test-supabase.mjs`), elle modifiera ce glob.

## Dev Agent Record

### Agent Model Used

Claude Opus 4.7 (1M context) — `claude-opus-4-7[1m]`

### Debug Log References

- `npx vitest run --project unit --coverage` — 94/94 verts, `coverage/coverage-summary.json` généré, `app/actions/parrainage.ts` unit-seul : lines 42.9% / branches 30.38% / functions 50% / statements 41.75%. Chiffre attendu **bien en-dessous de 85%** car cumulé unit+integration requis pour atteindre la cible (cf. Dev Notes).
- `npx tsc --noEmit` — TypeScript compilation completed (2 erreurs `.next/types/` pré-existantes inchangées).
- `npm run lint` — 193 warnings, 0 erreur (baseline réelle = 193, spec story disait 192 par erreur). 0 régression introduite (vérifié par `git stash` -> lint -> `git stash pop` qui renvoie 193).
- `npm run lint:a11y-check` — `OK: 155 jsx-a11y violations across 56 (file, rule) pair(s). Baseline total: 155. No regression.`
- `npm run test:unit` — `Test Files 11 passed (11), Tests 94 passed (94)` en 1.17s.
- `npm run check:no-direct-notifications-log-insert` / `check:as-any-global` / `check:oracle-paywall` — exit 0.
- `npm run build` — exit 0, toutes routes Next.js générées.

### Completion Notes List

**Status final** : implémentation locale complète. Le chiffre coverage final cumulé unit+integration sera publié ici **après le 1er run GHA** (T3) car requiert Supabase local non disponible sur le poste dev (heritage `feedback_test_local_supabase`).

**Modifications livrées** :

1. `vitest.config.ts` — bloc `coverage` ajouté au niveau racine `test:` (hors `projects:`) avec : provider v8, reporters `text`/`json-summary`/`html`, reportsDirectory `coverage`, include `app/lib`, exclude RSC/types/auth/database.types, thresholds per-file `app/actions/parrainage.ts` 85% sur les 4 indicateurs. **Note dev : option `all: true` retirée vs spec story** car `CoverageOptions` Vitest 4.x ne la déclare plus (TS2769 reproductible). Le comportement « instrumenter aussi les fichiers non importés par les tests » est désormais le défaut depuis Vitest 3 dès lors qu'on précise `include`, donc équivalent fonctionnel.
2. `package.json` — script `test:integration:coverage` adapté de `vitest run --project integration --coverage` vers `vitest run --coverage` (lance les 2 projets pour cumuler les hits sur le bloc `coverage` racine, cohérent Dev Notes « couverture cumulée unit + integration »).
3. `.github/workflows/integration-tests.yml` — étape renommée `Run integration tests with coverage` + nouvelle étape `Upload coverage artifact` (`actions/upload-artifact@v4`, `if: always()`, retention 30 j).
4. `tests/integration/README.md` — section `## Coverage (story 9.A.2)` ajoutée (commande locale, artefact GHA, seuil 85%, procédure A/B documentée).
5. `_bmad-output/implementation-artifacts/deferred-work.md` — entrée ligne 60 barrée `[Solde 9.A.2 - 2026-05-17]`.
6. `_bmad-output/implementation-artifacts/sprint-status.yaml` — 9-a-2 `ready-for-dev` -> `in-progress`.

**À faire post-push (Sylvain)** :

- T3 : 1er run GHA pour mesurer la coverage cumulée réelle. Lire l'artefact `coverage-integration`, ouvrir `coverage/coverage-summary.json` (entrée `/Users/sylvain/Documents/roxanetnous/app/actions/parrainage.ts` ou équivalent path runner GHA), noter les 4 indicateurs.
- T3.4 : décider Option A (combler in-PR si écart faible) ou Option B (abaisser seuil + defer + DECISIONS.md + story 9.A.2.b backlog).
- T6 : 2 runs GHA verts consécutifs avant merge.
- T7.3 + Completion Notes : reporter le chiffre final dans la mémoire `project_epic_9_cadrage` et dans cette section.
- T7.5 : bascule sprint-status `in-progress` -> `review` après T6.

**Décisions notables prises au dev** :

- (D1) Option `all: true` retirée — incompatible Vitest 4.x. Comportement préservé par défaut depuis Vitest 3 avec `include`. Pas d'impact sur la cible 85% (les fichiers non importés restent instrumentés).
- (D2) `test:integration:coverage` script élargi à tous les projets — sans cela, la couverture cumulée unit+integration n'est pas atteinte. Ne casse pas la sémantique CI (la suite intégration reste lancée, plus rapide unit en parallèle).
- (D3) Baseline lint à 193 (et non 192 comme indiqué dans la story) — divergence constatée, non bloquante : 0 régression introduite par 9.A.2.

### File List

**Fichiers modifiés** :

- `vitest.config.ts` (+34 lignes : bloc `coverage` au niveau racine `test:`)
- `package.json` (1 ligne : script `test:integration:coverage`)
- `.github/workflows/integration-tests.yml` (+8 lignes : renommage étape + nouvelle étape `Upload coverage artifact`)
- `tests/integration/README.md` (+22 lignes : section `## Coverage (story 9.A.2)`)
- `_bmad-output/implementation-artifacts/deferred-work.md` (entrée ligne 60 barrée `[Solde 9.A.2 - 2026-05-17]`)
- `_bmad-output/implementation-artifacts/sprint-status.yaml` (9-a-2 `ready-for-dev` -> `in-progress`)
- `_bmad-output/implementation-artifacts/9-a-2-coverage-parrainage-85-percent-gha-artefact.md` (Tasks/Subtasks checkboxes + Dev Agent Record + Change Log)

**Fichiers PAS modifiés (audit AC15)** :

- `app/actions/parrainage.ts` (cible coverage, intacte)
- `app/`, `lib/`, `components/`, `supabase/migrations/` (aucune modification, conforme AC15)
- `tests/unit/`, `tests/integration/` (aucun test ajouté — Option A AC3 conditionnelle au chiffre GHA)

## DoD a11y

N/A — story 100% CI/config sans impact UI applicatif. Aucun composant React ni page HTML modifié. Les baselines `lint:a11y-check` 155 et `axe-core` 8 parcours sont vérifiées par run de sécurité (T8.3) mais aucune action a11y spécifique n'est requise. Pattern hérité de la story sœur 9.A.1 (DoD a11y N/A pour stories 100% tests/config).

## Change Log

- 2026-05-17 — Story créée via `bmad-create-story` (workflow `/bmad-create-story`). Source : epic-9.md#9.A.2 + retro Epic 8 I2 + AI-Epic9-B2 + defer `deferred-work.md:60`. Cadrage exhaustif : `vitest.config.ts` `coverage.thresholds` per-file + `integration-tests.yml` `--coverage` + `actions/upload-artifact@v4`. Status `backlog` -> `ready-for-dev`.
- 2026-05-17 — Implémentation locale via `bmad-dev-story` (T1+T2+T7+T8 complets). Status `ready-for-dev` -> `in-progress`. T3 (mesure cumulée) + T4/T5 (option A/B) + T6 (2 runs verts) + T7.3+T7.5 (mémoire + bascule `review`) reportés au post-push GHA car nécessitent Supabase local non disponible (heritage `feedback_test_local_supabase`). 3 décisions dev consignées dans Completion Notes List (option `all` retirée vs spec story, `test:integration:coverage` élargi aux 2 projets, baseline lint 193 vs 192 annoncée).
