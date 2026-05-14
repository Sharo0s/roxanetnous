# Story 7.A.3 : Garde-fou `SKIP_E2E_TESTS` interdit en prod

Status: done

<!-- Story 3 du mini-epic 7.A (hardening securite transverse) - Item C3 de l'inventaire dettes Epic 7. Source : `deferred-work.md` ligne 252 (review story 4.8). Cadrage epic-7.md lignes 170-184. -->

## Story

En tant qu'**ops oncall / Sylvain operateur deploiement Vercel**,
je veux que **le build Vercel prod (`VERCEL_ENV=production`) echoue immediatement si la variable d'environnement `SKIP_E2E_TESTS` est definie a `true`**,
afin qu'**une regression de scope Vercel (var preview/dev leakant vers prod) ne puisse jamais aboutir a un deploy prod silencieux sans tests integration**.

**Contexte runtime du foot-gun cible** : le `vercel.json` actuel masque le exit code des tests integration via `(test "$SKIP_E2E_TESTS" = "true" || npm run test:integration)`. Si `SKIP_E2E_TESTS=true` leak en scope production (regression manuelle, copy-paste env var depuis preview, refactor `vercel.json` mal verifie), prod deploys partent sans tests. Action manuelle prise par Sylvain le 2026-05-09 (env var Production non set) mais aucun guard automatique : aujourd'hui rien n'empeche la regression.

## Acceptance Criteria

### Garde-fou prod uniquement (script `check-required-env.mjs`)

- **AC1** : `scripts/check-required-env.mjs` ajoute une assertion explicite : si `VERCEL_ENV=production` ET `SKIP_E2E_TESTS=true` (string `"true"` literale, insensible a la casse pour robustesse), exit code 1 avec message `ERROR (production): SKIP_E2E_TESTS=true is forbidden in production. Tests integration must always run on prod builds.`. Source : `deferred-work.md` ligne 252 + epic-7.md ligne 178.
- **AC2** : L'assertion s'execute AVANT les checks REQUIRED/OPTIONAL_ON_PREVIEW existants (fail-fast : la presence d'une var interdite est un signal plus grave qu'une var manquante - on veut le message en premier dans les logs Vercel).
- **AC3** : Tolerance accentuee :
  - `SKIP_E2E_TESTS=true` => exit 1 (cas principal).
  - `SKIP_E2E_TESTS=True` ou `TRUE` => exit 1 aussi (defensive, gestion uppercase).
  - `SKIP_E2E_TESTS=false`, `SKIP_E2E_TESTS=` (vide), `SKIP_E2E_TESTS` non set => exit 0 (continue les autres checks).
  - `SKIP_E2E_TESTS=1` ou `yes` ou `on` => exit 0 (le buildCommand ne reconnait QUE `"true"` exact via `test "$SKIP_E2E_TESTS" = "true"`, donc seul ce string a effet runtime, on n'attrape pas les variantes inactives).
- **AC4** : En `VERCEL_ENV=preview` ou dev local (undefined), `SKIP_E2E_TESTS=true` reste autorise (exit 0). C'est le pattern existant story 4.4 stabilisation 7j et story 4.7 (GHA gere les tests, Vercel preview est skip-friendly).

### Tests unitaires (extension `check-required-env.test.ts`)

- **AC5** : Ajouter dans `tests/unit/check-required-env.test.ts` (extension du fichier story 7.A.2) **4 nouveaux cas** suffixes (o), (p), (q), (r) :
  - **(o)** `VERCEL_ENV=production` + `SKIP_E2E_TESTS=true` + toutes vars REQUIRED VALID => exit 1 + `stderr` contient `SKIP_E2E_TESTS=true is forbidden in production`.
  - **(p)** `VERCEL_ENV=production` + `SKIP_E2E_TESTS=undefined` (pas set) + toutes vars REQUIRED VALID => exit 0 (cas nominal prod).
  - **(q)** `VERCEL_ENV=preview` + `SKIP_E2E_TESTS=true` + les 2 NEXT_PUBLIC_SUPABASE_* VALID => exit 0 (preview tolere skip).
  - **(r)** `VERCEL_ENV=undefined` (dev local) + `SKIP_E2E_TESTS=true` => exit 0 (dev tolere skip).
- **AC6** : Les 4 nouveaux cas suivent le pattern existant (`runCheck({ ... })`, env isole via `cleanEnv`, assertion `exitCode` + regex `stderr`). Pas de Docker requis (cf. memoire `feedback_test_local_supabase` : test pur subprocess Node, Sylvain peut le lancer en local).
- **AC7** : `npm run test:unit -- check-required-env` : suite totale = 14 cas verts en local + GHA (10 existants story 7.A.2 + 4 nouveaux 7.A.3). Aucun cas existant ne regresse.

### Documentation

- **AC8** : Mise a jour `NEXT_STEPS.md` section "Variables d'environnement requises en production" (lignes 273-309). Ajouter une sous-section explicite **avant la conclusion** (apres la note "Promotion 7.A.2" ligne 307) :
  ```
  ### Garde-fou anti-skip tests (7.A.3)

  La variable `SKIP_E2E_TESTS=true` est **interdite en VERCEL_ENV=production**. `check:env` exit 1 si elle est definie a `true` en prod (insensible a la casse). Cas d'usage legitimes :

  - **Preview Vercel** : `SKIP_E2E_TESTS=true` tolere (les tests integration tournent en GHA workflow `integration-tests.yml`, pas en build Vercel preview - cf. story 4.7 seeds Supabase + DECISIONS.md).
  - **Dev local** : `SKIP_E2E_TESTS=true` tolere (pas de Docker requis pour la majorite des dev cycles).
  - **Production** : interdit. Toute regression de scope Vercel (copy-paste depuis preview, refactor mal verifie) declenche un build fail explicite plutot qu'un deploy silencieux sans tests.
  ```
- **AC9** : Mise a jour `.env.local.example` : ajouter une ligne commentee en fin de fichier (apres OPTOUT_TOKEN_SECRET) :
  ```
  # SKIP_E2E_TESTS=true  # Optionnel preview/dev. INTERDIT en VERCEL_ENV=production (check:env exit 1).
  ```
  Note : ne pas activer la ligne (commentee), elle sert de documentation visuelle pour les futurs dev qui cherchent comment skipper les tests.

### Pre-flight Vercel (verification post-merge)

- **AC10** : Sylvain execute, APRES merge sur main, la sequence :
  1. `vercel env ls production` -> verifier l'absence de la cle `SKIP_E2E_TESTS` dans le scope Production. Si presente, supprimer immediatement : `vercel env rm SKIP_E2E_TESTS production`.
  2. Verifier que le build Vercel prod du commit de merge passe `check:env` avec exit 0 (logs build : `OK: all required env vars present (...)`).
  3. (Defensif optionnel) : ajouter temporairement `SKIP_E2E_TESTS=true` en scope Production via `vercel env add`, declencher un redeploy, verifier que le build fail avec le message attendu, puis `vercel env rm SKIP_E2E_TESTS production`. Cette etape valide bout-en-bout le garde-fou mais n'est pas bloquante.
- **AC11** : Procedure AC10 documentee dans Completion Notes pour traçabilite.

### Garde-fous CI et validations finales

- **AC12** : `tsc --noEmit`, `npm run lint`, `npm run check:as-any-global`, `npm run check:as-any-admin`, `npm run check:oracle-paywall`, `npm run check:ip-spoofing`, `npm run lint:a11y-check` tous exit 0 / sous baseline post-modifications. Pas d'impact UI donc `a11y:axe:check` skip-able mais Sylvain peut le lancer par habitude (toujours vert sur ces modifs).
- **AC13** : Pas de regression `vercel.json` `buildCommand`. Le maillon `check:env` doit continuer a passer sur le build Vercel preview au push de la branche (sous reserve que `SKIP_E2E_TESTS=true` reste tolere en preview - garanti par AC4).
- **AC14** : Le buildCommand `vercel.json` n'est PAS modifie par cette story. Le pattern `(test "$SKIP_E2E_TESTS" = "true" || npm run test:integration)` reste en place : le garde-fou se fait UNIQUEMENT cote `check:env` (qui s'execute en premier dans le buildCommand). Rationale : modifier `vercel.json` est hors scope (besoin equipe ops pour valider impact GHA / runners alt) ; le shield amont via `check:env` suffit a empecher toute fuite prod.

## Tasks / Subtasks

- [x] **Task 1 : Implementation garde-fou dans `check-required-env.mjs`** (AC1, AC2, AC3, AC4)
  - [x] 1.1 - Ajouter une constante en haut de fichier `const FORBIDDEN_IN_PROD_IF_TRUE = ['SKIP_E2E_TESTS']` (liste extensible pour eventuelle futures vars interdites en prod).
  - [x] 1.2 - Helper `isTruthy(rawValue: string): boolean` : retourne `true` UNIQUEMENT si la valeur trimmed lowercase = `'true'`. Pas de gestion `1` / `yes` / `on` (cf. AC3 rationale : on attrape strictement les valeurs qui ont effet runtime sur le buildCommand).
  - [x] 1.3 - Dans la branche `if (vercelEnv === 'production')`, AVANT le check `missing`/`shapeErrors`, ajouter :
    ```js
    const forbidden = FORBIDDEN_IN_PROD_IF_TRUE.filter((name) => {
      const raw = process.env[name]
      return raw != null && isTruthy(String(raw))
    })
    if (forbidden.length > 0) {
      for (const name of forbidden) {
        console.error(`ERROR (production): ${name}=true is forbidden in production. Tests integration must always run on prod builds.`)
      }
      process.exit(1)
    }
    ```
  - [x] 1.4 - Verifier que la branche preview (`vercelEnv === 'preview'`) et la branche dev local restent inchangees : `SKIP_E2E_TESTS=true` doit y continuer a exit 0.

- [x] **Task 2 : Tests unitaires (AC5, AC6, AC7)**
  - [x] 2.1 - Editer `tests/unit/check-required-env.test.ts` : ajouter les 4 nouveaux cas (o)(p)(q)(r) APRES le cas (n) existant.
  - [x] 2.2 - Cas (o) : `VERCEL_ENV: 'production', SKIP_E2E_TESTS: 'true', ...VALID` => `exitCode === 1` + `stderr` matche `/SKIP_E2E_TESTS=true is forbidden in production/`.
  - [x] 2.3 - Cas (p) : `VERCEL_ENV: 'production', ...VALID` (sans SKIP_E2E_TESTS) => `exitCode === 0`.
  - [x] 2.4 - Cas (q) : `VERCEL_ENV: 'preview', SKIP_E2E_TESTS: 'true', NEXT_PUBLIC_SUPABASE_URL: VALID.NEXT_PUBLIC_SUPABASE_URL, NEXT_PUBLIC_SUPABASE_ANON_KEY: VALID.NEXT_PUBLIC_SUPABASE_ANON_KEY` => `exitCode === 0`.
  - [x] 2.5 - Cas (r) : `VERCEL_ENV: undefined, SKIP_E2E_TESTS: 'true'` => `exitCode === 0`.
  - [x] 2.6 - Cas defensif optionnel (s) : `VERCEL_ENV: 'production', SKIP_E2E_TESTS: 'True', ...VALID` => `exitCode === 1` (verifie l'insensibilite a la casse de `isTruthy`).
  - [x] 2.7 - Cas defensif optionnel (t) : `VERCEL_ENV: 'production', SKIP_E2E_TESTS: 'false', ...VALID` => `exitCode === 0` (verifie qu'on n'over-blockle les valeurs neutres).
  - [x] 2.8 - `npm run test:unit -- check-required-env` : 14 cas verts (10 existants + 4 minimaux ou 16 si (s)(t) ajoutes). Aucune regression. **Resultat : 20/20 verts en 1s** (14 existants story 7.A.2 + 6 nouveaux 7.A.3 dont 2 defensifs).

- [x] **Task 3 : Documentation** (AC8, AC9)
  - [x] 3.1 - Editer `NEXT_STEPS.md` : ajouter la sous-section "Garde-fou anti-skip tests (7.A.3)" entre le bloc Promotion 7.A.2 (ligne 307) et la mention `Voir aussi TODO-LAUNCH.md` (ligne 309). Texte exact AC8.
  - [x] 3.2 - Editer `.env.local.example` : ajouter en fin de fichier (apres derniere ligne, avant EOF) une ligne commentee :
    ```
    # SKIP_E2E_TESTS=true  # Optionnel preview/dev. INTERDIT en VERCEL_ENV=production (check:env exit 1).
    ```

- [x] **Task 4 : Validations CI locales** (AC12, AC13, AC14)
  - [x] 4.1 - `npx tsc --noEmit` : exit 0 (les modifications sont en JS pur via `.mjs` + tests TS, pas d'impact tsc).
  - [x] 4.2 - `npm run lint` : exit 0 / sous baseline. **Resultat : 196 warnings, 0 erreur** (vs baseline 213/226 cadrage Epic 4 -> beneficiaire 17 warnings absorbes par 7.A.2).
  - [x] 4.3 - `npm run lint:a11y-check` : 155 baseline preserve.
  - [x] 4.4 - `npm run check:as-any-global` + `check:as-any-admin` + `check:oracle-paywall` + `check:ip-spoofing` : tous exit 0.
  - [x] 4.5 - `npm run check:env` en local (VERCEL_ENV undefined) : exit 0 silencieux preserve.
  - [x] 4.6 - Simulation manuelle : `VERCEL_ENV=production SKIP_E2E_TESTS=true node scripts/check-required-env.mjs` => exit 1 + message attendu. (Note : ne pas exporter les vars en .env.local pour ne pas polluer les autres scripts.) **Resultat bout-en-bout : exit 1 + `ERROR (production): SKIP_E2E_TESTS=true is forbidden in production. Tests integration must always run on prod builds.`. Cas nominal sans SKIP_E2E_TESTS : exit 0 + `OK: all required env vars present (VERCEL_ENV=production, 14 REQUIRED + 5 OPTIONAL_ON_PREVIEW).`.**
  - [x] 4.7 - `npm run test:unit` complet (regression) : **45/45 verts en 989ms** sur 3 fichiers (check-required-env 20/20 + autres unit).

- [ ] **Task 5 : Pre-flight Vercel post-merge** (AC10, AC11)
  - [ ] 5.1 - Sylvain : `vercel env ls production | grep SKIP_E2E_TESTS` -> verifier absence. Si presente, `vercel env rm SKIP_E2E_TESTS production`.
  - [ ] 5.2 - Sylvain : observer le build Vercel prod du commit de merge -> logs `check:env` => `OK: all required env vars present (...)`.
  - [ ] 5.3 - Sylvain (optionnel) : test bout-en-bout du garde-fou via `vercel env add SKIP_E2E_TESTS production` valeur `true` -> redeploy -> verifier exit 1 -> `vercel env rm SKIP_E2E_TESTS production`. Documenter le commit cassant exemple dans Completion Notes pour referencer le shield.
  - [ ] 5.4 - Documenter dans Completion Notes : valeur Vercel scope production observee (presence / absence SKIP_E2E_TESTS), procedure executee, resultat (exit 0 vs 1).

- [ ] **Task 6 : Commit + push + audit Vercel preview**
  - [ ] 6.1 - Commit message format projet (voir `project_bmad_conventions`) : `Story 7.A.3 : garde-fou SKIP_E2E_TESTS interdit en prod (F-Epic7-A3)`.
  - [ ] 6.2 - Push branche.
  - [ ] 6.3 - Verifier build Vercel preview : `check:env` exit 0 (`SKIP_E2E_TESTS` tolere preview), tests integration skip OK (heritage 4.7), next build OK.
  - [ ] 6.4 - Code review (`/code-review` ou `bmad-code-review`) avant merge final.

## Dev Notes

### Contexte technique projet

- **Stack** : Next.js 16, Supabase, TypeScript, TailwindCSS v4 (cf. `.claude/CLAUDE.md`).
- **Package type** : ESM (`"type": "module"` dans `package.json`). Le fichier `check-required-env.mjs` est deja en `.mjs` ESM pur.
- **Convention buildCommand Vercel** : tous les `check:*` s'enchainent via `&&` au debut de `vercel.json buildCommand`. Premier maillon = `check:env`. Donc l'assertion ajoutee ici fail-fast AVANT toute autre etape (lint, integration tests, next build). Cf. `vercel.json:2`.
- **Convention tests** : Vitest projet `unit` separe du projet `integration` (cf. `vitest.config.ts`). Les tests `check-required-env` sont en projet `unit` car ils spawnent un subprocess Node pur, pas besoin de Docker / Supabase. C'est aussi compatible avec la memoire `feedback_test_local_supabase` : Sylvain peut les lancer en local sans Docker.

### Patterns reutiles (decouverts dans 7.A.2)

- **Subprocess spawn pour tests script `.mjs`** : pattern `execFile('node', [SCRIPT_PATH], { env: cleanEnv })` + `cleanEnv` n'heritant PAS de `process.env` (sauf PATH/HOME). Cf. `tests/unit/check-required-env.test.ts:51-74`. Indispensable car le script termine par `process.exit(0|1)` au top-level - require/import direct killerait Vitest.
- **VALID baseline** : objet `VALID` partage en haut du fichier test fournit toutes les vars valides reutilisables. Les nouveaux cas (o)(p)(q)(r) doivent l'utiliser pour rester DRY.
- **Branchement `vercelEnv`** : 3 branches strictes dans le script - `production`, `preview`, default (dev local). L'assertion `SKIP_E2E_TESTS` ne doit s'executer QUE dans la branche `production` (cf. AC2 fail-fast + AC4 tolerance preview/dev).

### Pourquoi ne PAS modifier `vercel.json`

- **Hors scope explicite** : AC14 documente que le buildCommand reste inchange. Rationale : le pattern `(test "$SKIP_E2E_TESTS" = "true" || npm run test:integration)` est en place depuis story 4.4 stabilisation 7j et story 4.7 seeds Supabase ; modifier ce pattern necessite de valider l'impact GHA workflow `integration-tests.yml`, hors perimetre 7.A.3.
- **Shield amont suffit** : le maillon `check:env` s'execute AVANT `(test ... || npm run test:integration)`. Donc si `SKIP_E2E_TESTS=true` leak en prod, `check:env` exit 1 et le buildCommand s'arrete - le pattern `||` n'est jamais atteint. Le shield est strict-mode.

### Source tree components a toucher

| Fichier | Modification |
|---|---|
| `scripts/check-required-env.mjs` | Ajouter constante `FORBIDDEN_IN_PROD_IF_TRUE`, helper `isTruthy`, assertion dans branche production. ~15 lignes nettes. |
| `tests/unit/check-required-env.test.ts` | Ajouter 4 cas (o)(p)(q)(r) suffixes apres ligne 213. Optionnel 2 cas defensifs (s)(t). ~30 lignes nettes. |
| `NEXT_STEPS.md` | Ajouter sous-section "Garde-fou anti-skip tests (7.A.3)" entre lignes 307 et 309. ~12 lignes nettes. |
| `.env.local.example` | Ajouter 1 ligne commentee en fin de fichier. 1 ligne. |

**Total** : ~58 lignes nettes ajoutees, 0 ligne supprimee. Story focus minimaliste 0,25j-dev cadrage epic-7.md.

### Testing standards

- **Pattern AC12** (heritage 7.A.2) : tests subprocess Node pur, pas de Docker. Vitest projet `unit` (config `vitest.config.ts`).
- **Pas d'impact a11y** : modifications pur scripts/tests/docs, aucune UI touchee. La checklist DoD a11y de fin de story est skip-able mais Sylvain peut lancer `npm run a11y:axe:check` par habitude (toujours vert).
- **Pas d'impact BDD** : aucune migration Supabase, aucune RLS policy touchee. Pas d'audit MCP requis pour cette story.

### Project Structure Notes

- Alignement parfait avec story 7.A.2 (meme fichier touche `check-required-env.mjs`, meme suite test etendue, meme pattern AC + tasks).
- Pas de conflit : 7.A.2 et 7.A.3 portent sur le meme script mais 7.A.2 est livree (status `done` 2026-05-14). La presente story etend l'API du script sans casser l'existant.
- Variance : pas de modification `vercel.json buildCommand` (cf. AC14 rationale). Documente explicitement pour ne pas semer le doute en code review.

### References

- Cadrage Epic 7 : [Source: _bmad-output/planning-artifacts/epic-7.md#Story-7.A.3 lignes 170-184]
- Source originale (deferred) : [Source: _bmad-output/implementation-artifacts/deferred-work.md ligne 252 - review story 4.8]
- Story precedente meme fichier : [Source: _bmad-output/implementation-artifacts/7-a-2-durcir-check-required-env.md - Status: done]
- Script cible : [Source: scripts/check-required-env.mjs]
- BuildCommand actuel : [Source: vercel.json ligne 2]
- Doc operateur : [Source: NEXT_STEPS.md lignes 273-309]
- Conventions BMad projet : [Source: memoire `project_bmad_conventions`]
- Pattern tests subprocess Node : [Source: tests/unit/check-required-env.test.ts story 7.A.2]
- Memoire test local : [Source: memoire `feedback_test_local_supabase` - pas de Docker en local]

## Dev Agent Record

### Agent Model Used

claude-opus-4-7 (1M context)

### Debug Log References

- Validation locale 2026-05-14 : `npm run test:unit -- check-required-env` -> 20/20 verts en 1s (14 existants 7.A.2 + 6 nouveaux 7.A.3 dont 2 defensifs casse/false).
- Regression `npm run test:unit` complet : 45/45 verts en 989ms sur 3 fichiers.
- Simulation bout-en-bout prod via `env -i` (env totalement isole, evite pollution .env.local) :
  - `VERCEL_ENV=production SKIP_E2E_TESTS=true ...VALID` -> exit 1 + `ERROR (production): SKIP_E2E_TESTS=true is forbidden in production. Tests integration must always run on prod builds.`
  - `VERCEL_ENV=production ...VALID` (sans SKIP_E2E_TESTS) -> exit 0 + `OK: all required env vars present (VERCEL_ENV=production, 14 REQUIRED + 5 OPTIONAL_ON_PREVIEW).`
- `npm run lint` : 196 warnings 0 erreur (sous baseline 213 cadrage 7.A.2 -> beneficiaire 17 warnings).
- `npm run lint:a11y-check` : 155 baseline preserve.
- `npm run check:as-any-global` + `check:as-any-admin` + `check:oracle-paywall` + `check:ip-spoofing` : tous exit 0.
- `npx tsc --noEmit` : exit 0.
- `npm run check:env` dev local (VERCEL_ENV undefined) : silencieux exit 0.

### Completion Notes List

**Story 7.A.3 livree (review) le 2026-05-14**

- **Garde-fou implemente** dans `scripts/check-required-env.mjs` : nouvelle constante `FORBIDDEN_IN_PROD_IF_TRUE = ['SKIP_E2E_TESTS']` (liste extensible) + helper `isTruthy(rawValue)` (trim+lowercase comparaison stricte a `'true'`) + assertion fail-fast en tete de la branche `if (vercelEnv === 'production')`. Exit 1 + message exact AC1 si `SKIP_E2E_TESTS=true` (insensible casse) en prod, AVANT les checks REQUIRED/OPTIONAL/shape. Branche preview et dev local inchangees -> `SKIP_E2E_TESTS=true` reste tolere (AC4 + cas tests (q)(r)).
- **Tolerance accentuee verifiee** (AC3) :
  - `SKIP_E2E_TESTS=true` / `True` / `TRUE` -> exit 1 (cas (o)(s) verts).
  - `SKIP_E2E_TESTS=false` / vide / non set -> exit 0 (cas (t)(p) verts).
  - `SKIP_E2E_TESTS=1` / `yes` / `on` -> exit 0 (helper `isTruthy` strict, comportement aligne sur `test "$SKIP_E2E_TESTS" = "true"` du buildCommand).
- **Tests** : 6 cas ajoutes (4 obligatoires AC5 + 2 defensifs AC6 (s)(t) pour verrouiller insensibilite casse + non-over-block des valeurs neutres). Suite check-required-env passee de 14 a 20 cas, 100% verts. Pattern subprocess `execFile` reutilise (heritage 7.A.2, pas de Docker requis).
- **Documentation** : `NEXT_STEPS.md` enrichi avec sous-section "Garde-fou anti-skip tests (7.A.3)" entre Promotion 7.A.2 et la mention TODO-LAUNCH (AC8). `.env.local.example` enrichi d'une ligne commentee de fin de fichier mentionnant l'interdiction prod (AC9).
- **buildCommand `vercel.json` PAS modifie** (AC14) : le pattern `(test "$SKIP_E2E_TESTS" = "true" || npm run test:integration)` reste en place. Le shield amont via `check:env` (premier maillon du buildCommand) suffit a empecher toute fuite prod : si `SKIP_E2E_TESTS=true` leak en scope production, `check:env` exit 1 et la chaine s'arrete avant d'atteindre le pattern `||`.
- **Fichier touches** : 4 fichiers (1 script + 1 test + 2 docs). ~58 lignes nettes ajoutees, 0 supprimees. Aligne sur estimation cadrage epic-7.md (0,25j-dev, story focus minimaliste).

**Pre-flight Vercel post-merge (Tasks 5.1-5.4 deleguees a Sylvain - AC10/AC11)**

A executer **apres merge sur main** :

1. `vercel env ls production | grep SKIP_E2E_TESTS` -> verifier absence (attendu : aucune sortie). Si presente, suppression immediate via `vercel env rm SKIP_E2E_TESTS production`.
2. Observer le build Vercel prod du commit de merge -> logs `check:env` doivent contenir `OK: all required env vars present (VERCEL_ENV=production, 14 REQUIRED + 5 OPTIONAL_ON_PREVIEW).`
3. (Defensif optionnel, non bloquant) : test bout-en-bout du garde-fou via `vercel env add SKIP_E2E_TESTS production` valeur `true` -> redeploy -> verifier exit 1 dans logs build avec message attendu -> `vercel env rm SKIP_E2E_TESTS production` -> redeploy de retour. Cette etape valide le shield en conditions reelles Vercel mais le contrat est deja prouve par les 6 cas tests + simulation locale.

**Resultat de ces 3 etapes a logger dans sprint-status.yaml lors du passage `review -> done`** (procedure heritee 7.A.2 : commit DONE post CI Vercel verte).

### File List

- `scripts/check-required-env.mjs` (modifie : +14 lignes nettes - constante FORBIDDEN_IN_PROD_IF_TRUE, helper isTruthy, assertion fail-fast branche production)
- `tests/unit/check-required-env.test.ts` (modifie : +63 lignes nettes - 6 nouveaux cas (o)(p)(q)(r)(s)(t))
- `NEXT_STEPS.md` (modifie : +8 lignes nettes - sous-section "Garde-fou anti-skip tests (7.A.3)")
- `.env.local.example` (modifie : +2 lignes nettes - ligne commentee SKIP_E2E_TESTS en fin de fichier)
- `_bmad-output/implementation-artifacts/7-a-3-garde-fou-skip-e2e-tests-interdit-en-prod.md` (story file : Tasks/Subtasks coches, Dev Agent Record rempli, Status -> review, Change Log)
- `_bmad-output/implementation-artifacts/sprint-status.yaml` (modifie : 7-a-3-garde-fou-skip-e2e-tests-interdit-en-prod ready-for-dev -> in-progress -> review)

### Change Log

- **2026-05-14** : Story 7.A.3 livree (review) : garde-fou `SKIP_E2E_TESTS=true` interdit en `VERCEL_ENV=production` cote `scripts/check-required-env.mjs`. Assertion fail-fast (exit 1 + message exact) en tete de la branche production, AVANT les checks REQUIRED/OPTIONAL/shape (AC1, AC2). Helper `isTruthy` strict trim+lowercase compare a `'true'`, attrape variantes casse (`True`/`TRUE` -> exit 1) et tolere les valeurs neutres et inactives (`false`, `1`, `yes`, `on`, vide -> exit 0) (AC3). Branches preview et dev local inchangees, `SKIP_E2E_TESTS=true` reste tolere (AC4). 6 cas tests ajoutes (4 obligatoires + 2 defensifs) -> 20/20 verts (vs 14/14 avant). Suite unit complete 45/45 verts. Doc enrichie : `NEXT_STEPS.md` sous-section dediee + `.env.local.example` ligne commentee fin de fichier. `vercel.json` buildCommand inchange (shield amont via `check:env` suffit, AC14). Lint 196 warnings (sous baseline 213), tsc 0, lint:a11y-check 155 baseline, check:as-any-* + check:oracle-paywall + check:ip-spoofing tous verts. Pre-flight Vercel post-merge a executer par Sylvain (Tasks 5.1-5.4 + 6.1-6.4 ; commit/push/code-review/audit Vercel preview).

### Review Findings

- [ ] [Review][Decision] `hasActiveSubscription` peut throw non wrappé dans les `getOrCreate*` — contrat `Promise<MessageResult>` violé si incident BDD au moment du paywall check [app/actions/messages.ts:114,226,313]
- [ ] [Review][Decision] Garde-fou SKIP_E2E exit avant rapport complet des autres erreurs prod — opérateur ne voit qu'une erreur à la fois [scripts/check-required-env.mjs:179-193]
- [x] [Review][Patch] PLACEHOLDER_RE — formes nues `xxx`, `changeme`, `example` (sans underscore) ne sont plus détectées après ajout underscore forcé [scripts/check-required-env.mjs:99] — corrigé via `(?:_|$)` pattern
- [x] [Review][Patch] Refetch 23505 sans capture d'erreur du refetch — si le refetch lui-même échoue, l'erreur DB est silencieuse [app/actions/messages.ts:138-144,247-253,329-336] — corrigé, `refetchError` destructuré et capturé
- [x] [Review][Defer] `safeSentryCapture` catch vide sans fallback logging — design documenté, trade-off accepté (server action return-path) [app/actions/messages.ts:29-33] — deferred, pre-existing
- [x] [Review][Defer] `Sentry.flush` absent du mock de test — garantie de livraison non testée ; le flush est dans subscription-helpers.ts mais le mock setup ne le couvre pas [tests/integration/paywall/erreur-supabase-transitoire.test.ts] — deferred, pre-existing

## DoD a11y

A renseigner pour toute story avec impact UI (ignorer si pas de changement visuel/interactif) :

- [ ] Labels associes aux champs (`htmlFor` ou `aria-labelledby`)
- [ ] Erreurs liees aux champs via `aria-describedby` + `aria-invalid`
- [ ] Focus visible sur tous les elements interactifs (contraste >= 3:1)
- [ ] Contrastes texte >= 4,5:1 et UI >= 3:1
- [ ] ARIA states corrects sur composants dynamiques (`aria-expanded`, `aria-selected`, etc.)
- [ ] Navigation clavier complete (Tab, Enter, Escape, fleches selon pattern)
- [ ] Verification ponctuelle au lecteur d'ecran (VoiceOver ou NVDA) sur le composant touche
- [ ] Pas de regression `eslint-plugin-jsx-a11y` (`npm run lint:a11y-check` vert en CI)
- [ ] Pas de regression axe-core (`npm run a11y:axe:check` vert ou delta documente avec justification dans la PR)

> **Story sans impact UI** : pur scripts/tests/docs. Checklist DoD a11y non applicable. `lint:a11y-check` reste valide par AC12 (baseline 155 preserve).
