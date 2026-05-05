# Story 2.6.1 : Outillage axe-core/Playwright et baseline parcours critiques

Status: review

<!-- Note: Validation est optionnelle. Lancer `validate-create-story` avant `dev-story` pour un controle qualite. -->

## Story

En tant que **developpeur du projet roxanetnous**,
je veux **une suite Playwright outillee avec `@axe-core/playwright` qui execute un test de base sur chacun des 6 parcours critiques (P1-P6) avec un snapshot baseline des violations Critical/Serious actuelles**,
afin de **disposer d'une preuve quantitative reproductible avant le demarrage des stories Lot B fonctionnelles, conformement a l'action item AI-1 de la retrospective Lot A et au critere E2 du NFR a11y transverse**.

Cette story est la premiere du Lot B. Elle est **prerequis bloquant** pour les stories 2.6.2 a 2.6.7 : elle outille la mesure axe-core qui rendra observables les corrections suivantes. Elle complete le couple `eslint-plugin-jsx-a11y` (Lot A, statique) avec une couche dynamique (runtime) sur les parcours critiques.

## Acceptance Criteria

### AC commun Lot B (rappel)

1. **AC commun 1** - Given une PR Lot B, when la CI Vercel tourne, then le job `npm run lint` passe sans nouvelle violation `jsx-a11y/*` au-dela du baseline (mecanisme `lint:a11y-check` herite Lot A) ET le job axe-core ne signale **aucune** Critical/Serious nouvelle au-dela du baseline `axe-core-baseline-2026-05-XX.json`.
2. **AC commun 2** - Given un composant modifie touchant un parcours critique, when un developpeur consulte la PR, then la checklist DoD a11y est cochee, **et** une mention explicite indique le delta axe-core (violations corrigees, baseline mise a jour si applicable).
3. **AC commun 3** - Given une story Lot B avec impact UI, when la story passe a `done`, then la convention de double commit (`livraison` puis `statut done apres CI Vercel verte`) est respectee, en herite Lot A (D4 retro mini-epic 2.5).

### AC propres a la Story 2.6.1

4. **AC1 - Playwright et axe-core installes** : Given la branche post-livraison, when un developpeur execute `npm install`, then `@playwright/test`, `@axe-core/playwright` et `axe-core` sont installes en `devDependencies`. `npx playwright --version` retourne >= 1.49. Aucun lockfile alternatif (pas de pnpm/yarn/bun) — convention `npm` heritee Lot A respectee.
5. **AC2 - Configuration Playwright minimale** : Given le repo, when un developpeur consulte la racine, then un fichier `playwright.config.ts` existe avec :
   - `testDir: './tests/a11y'`
   - `webServer: { command: 'npm run dev', url: 'http://localhost:3000', reuseExistingServer: !process.env.CI }`
   - `use: { baseURL: 'http://localhost:3000' }`
   - `projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'] } }]` (1 seul navigateur en Lot B, multi-navigateurs reporte au Lot C si pertinent)
   - Reporter `[['list'], ['html', { outputFolder: 'playwright-report', open: 'never' }]]`
   - Le fichier est ajoute a `.gitignore` pour `playwright-report/` et `test-results/`.
6. **AC3 - Helper axe partage** : Given le repo, when un developpeur consulte `tests/a11y/lib/run-axe.ts`, then ce module exporte une fonction `runAxe(page, { include?, exclude? })` qui :
   - Instancie `AxeBuilder` avec les tags `wcag2a`, `wcag2aa`, `wcag22aa`, `best-practice`,
   - Execute `analyze()` et retourne le rapport,
   - Filtre les violations par impact (`critical`, `serious`),
   - Permet `exclude` pour ignorer la zone de la carte hero SVG en attendant la story 2.6.5 (decision technique : la carte est testee separement, pas en smoke).
7. **AC4 - 6 specs smoke (1 par parcours critique)** : Given le repo, when un developpeur execute `npx playwright test`, then 6 specs s'executent avec succes (assertion = pas de violation Critical au-dela du baseline) :
   - `tests/a11y/p1-onboarding-aux.spec.ts` : ouvre `/accompagnante/onboarding` (ou redirige si non auth — voir Sub 4.4 strategie auth),
   - `tests/a11y/p2-recherche.spec.ts` : ouvre `/recherche`,
   - `tests/a11y/p3-messagerie.spec.ts` : ouvre `/messages`,
   - `tests/a11y/p4-inscription-checkout.spec.ts` : ouvre `/register?role=accompagnante` puis `/login`,
   - `tests/a11y/p5-landing.spec.ts` : ouvre `/`,
   - `tests/a11y/p6-suppression-rgpd.spec.ts` : ouvre `/accompagnante/profil` (zone bouton suppression compte) ou `/accompagne/profil`.
   - Chaque spec : navigation + `await runAxe(page)` + assertion delta vs baseline. Pas de scenarios metier complets (reportes aux stories fonctionnelles 2.6.2+).
8. **AC5 - Strategie d'authentification documentee** : Given les parcours P1, P3, P6 (necessitent un compte authentifie), when un developpeur consulte `tests/a11y/lib/auth-stub.md`, then une note technique decrit la strategie retenue :
   - **Decision** : pour le Lot B, les specs auth-only se contentent d'auditer la **page de login** comme point d'entree audit (couverture indirecte) **OU** la page non-auth equivalente accessible publiquement. Pas de creation de compte test en Supabase pour cette story (reporte Lot C avec la story tests manuels VoiceOver).
   - Justification : Eviter d'introduire un compte de test cree dans la prod Supabase (pas d'environnement local Supabase configure dans le repo) **et** ne pas ajouter de complexite d'auth bypass dans le runtime applicatif.
9. **AC6 - Snapshot baseline genere et stocke** : Given le repo, when un developpeur execute `npm run a11y:axe:baseline`, then :
   - Un fichier `_bmad-output/test-artifacts/axe-core-baseline-2026-05-XX.json` est genere (date du jour),
   - Format : `{ generatedAt, commitSha, parcours: [{ id, url, violations: [{ ruleId, impact, count, nodeSelectors }] }] }` (pas de HTML inline, pas de JSON brut Playwright — format compact),
   - Une ligne d'en-tete `commitSha` reproductible (lecture via `git rev-parse HEAD`),
   - Total des violations Critical+Serious sur les 6 parcours documente.
10. **AC7 - Wrapper `lint:axe-check` analogue au `lint:a11y-check`** : Given le repo, when un developpeur execute `npm run a11y:axe:check`, then un script `scripts/check-axe-baseline.mjs` :
    - Execute la suite Playwright,
    - Compare le rapport courant au baseline JSON le plus recent (tri lexicographique ISO, comme `findLatestBaseline()` cote ESLint),
    - Sort en code 0 si delta <= 0 sur Critical+Serious, code != 0 sinon,
    - Affiche un diff lisible (regles ajoutees / supprimees / inchangees).
11. **AC8 - CI Vercel : job axe-core en mode warn** : Given le pipeline build Vercel, when un push declenche un build, then la commande `npm run a11y:axe:check` est executee en mode **non bloquant** (`warn`) au demarrage du Lot B. La bascule en bloquant est planifiee a la fin du Lot B (story 2.6.7 ou story de cloture). Mecanisme : voir Task 7 — soit via `buildCommand` Vercel, soit via fonction `vercel.json`. Decision projet : aligner sur le pattern `lint:a11y-check` actuel (script local, CI ne bloque pas mais peut signaler).
12. **AC9 - DoD a11y mise a jour** : Given le template story, when un developpeur cree une nouvelle story Lot B, then la checklist DoD a11y dans `.claude/skills/bmad-create-story/template.md` inclut une **nouvelle ligne** :
    > - [ ] Pas de regression axe-core (`npm run a11y:axe:check` vert ou delta documente)
    Le `CLAUDE.md` projet est aussi mis a jour pour mentionner `lint:axe-check` aux cotes de `lint:a11y-check`.
13. **AC10 - Pas de regression typecheck/build** : Given la branche post-livraison, when on execute `npm run build`, then le build Next 16 reussit sans erreur TypeScript. Playwright est ignore par Next (extension `.spec.ts` hors `app/`).
14. **AC11 - Documentation operatoire** : Given le repo, when un nouveau contributeur consulte `tests/a11y/README.md`, then ce fichier decrit :
    - Comment lancer la suite (`npm run a11y:axe`),
    - Comment regenerer le baseline (`npm run a11y:axe:baseline` + commit du fichier),
    - Garde-fou social en en-tete du baseline JSON : « Ne pas regenerer pour faire passer la CI sans justification dans le PR » (calque Lot A 2.5.1 D2),
    - Strategie auth (renvoi a `auth-stub.md`).

## Tasks / Subtasks

- [x] **Task 1 - Installer Playwright et axe-core** (AC: #4)
  - [x] Sub 1.1 : `npm install -D @playwright/test @axe-core/playwright axe-core`
  - [x] Sub 1.2 : `npx playwright install chromium` (telechargement du navigateur, en local et en CI)
  - [x] Sub 1.3 : Verifier que `package-lock.json` est regenere et committe.
  - [x] Sub 1.4 : Aligner les versions sur Node 25 (verifier compat — Playwright 1.59.1 supporte Node 25).

- [x] **Task 2 - Creer `playwright.config.ts`** (AC: #5)
  - [x] Sub 2.1 : Fichier en TS, ESM (`"type": "module"` du projet).
  - [x] Sub 2.2 : `testDir: './tests/a11y'`, `webServer` qui demarre `npm run dev` et attend `http://localhost:3000`.
  - [x] Sub 2.3 : `use: { baseURL: 'http://localhost:3000', trace: 'retain-on-failure' }`. Trace retain pour debug local sans saturer CI.
  - [x] Sub 2.4 : Reporter list + html.
  - [x] Sub 2.5 : Mettre a jour `.gitignore` : `playwright-report/`, `test-results/`, `.playwright/`.
  - [x] Sub 2.6 : `npx playwright test --list` retourne 7 tests dans 6 specs detectees apres Task 4 (P4 contient 2 tests : register + login).

- [x] **Task 3 - Helper `runAxe()` et types** (AC: #6)
  - [x] Sub 3.1 : Creer `tests/a11y/lib/run-axe.ts` exportant `runAxe(page, options?)` qui retourne `{ raw, violations, criticalSerious, inapplicable, incomplete }`.
  - [x] Sub 3.2 : Filtrer par defaut sur impacts `critical` et `serious`. Garder `incomplete` pour audit visuel mais hors assertion.
  - [x] Sub 3.3 : Fournir `formatViolation(v)` et `summarizeCriticalSerious()` pour serialisation baseline JSON (rule id, impact, count, nodes targets).
  - [x] Sub 3.4 : Validation locale OK via `npx tsc --noEmit` (TypeScript compilation completed).

- [x] **Task 4 - 6 specs smoke parcours critiques** (AC: #4, #7, #8)
  - [x] Sub 4.1 : `p5-landing.spec.ts` — page la plus simple, sert de reference. Exclude `svg[aria-hidden="true"]` et `[data-a11y-deferred="hero-map"]` pour la carte SVG (story 2.6.5).
  - [x] Sub 4.2 : `p2-recherche.spec.ts` — `/recherche`, exclude `.leaflet-container`, `.leaflet-pane`, `[data-a11y-deferred="map"]` (story 2.6.6).
  - [x] Sub 4.3 : `p4-inscription-checkout.spec.ts` — `/register?role=accompagnante` + `/login`. 2 tests dans le meme fichier.
  - [x] Sub 4.4 : `p1-onboarding-aux.spec.ts`, `p3-messagerie.spec.ts`, `p6-suppression-rgpd.spec.ts` — auditent `/login` comme proxy (`proxy: true` dans le payload). Documente dans `auth-stub.md`.
  - [x] Sub 4.5 : **Decision technique** : assertion stricte `toEqual(baseline)` deplacee dans le wrapper `check-axe-baseline.mjs` (Task 7) plutot que dans chaque spec. Raison : eviter de coupler chaque spec a la lecture du baseline (1er run sans baseline aurait casse). Les specs attachent `axe-violations.json` via `testInfo.attach`, le wrapper compare structurellement parcours par parcours (regle ajoutee/supprimee/aggravation noeuds). Garantie equivalente a l'AC : « pas un compte total mais une comparaison structurelle pour eviter les compensations ».

- [x] **Task 5 - Auth strategy documentee** (AC: #5, #8)
  - [x] Sub 5.1 : `tests/a11y/lib/auth-stub.md` cree avec table de couverture par parcours, justification (pas de compte test en prod Supabase, pas de bypass runtime).
  - [x] Sub 5.2 : Re-evaluation Lot C explicitement mentionnee.

- [x] **Task 6 - Baseline generator** (AC: #6, #9)
  - [x] Sub 6.1 : `scripts/build-axe-baseline.mjs` cree (calque sur `build-a11y-baseline.mjs` Lot A 2.5.1).
  - [x] Sub 6.2 : Execute Playwright avec reporter JSON via `PLAYWRIGHT_JSON_OUTPUT_NAME`, agrege les attachments par parcours, ecrit `_bmad-output/test-artifacts/axe-core-baseline-2026-05-05.json`.
  - [x] Sub 6.3 : En-tete `_comment` (garde-fou social), `generatedAt`, `commitSha` (`git rev-parse HEAD`), `totals { violations, nodes }`.
  - [x] Sub 6.4 : `package.json` mis a jour avec `"a11y:axe"`, `"a11y:axe:baseline"`.

- [x] **Task 7 - Wrapper check baseline** (AC: #6, #7)
  - [x] Sub 7.1 : `scripts/check-axe-baseline.mjs` cree.
  - [x] Sub 7.2 : Logique conforme : findLatestBaseline (tri ISO), execution Playwright JSON, comparaison parcours par parcours, exit 1 si nouvelle violation OU aggravation noeuds, output diff lisible (regles resolues, parcours absents, regressions).
  - [x] Sub 7.3 : `package.json` : `"a11y:axe:check"` ajoute.
  - [x] Sub 7.4 : Decision documentee dans `tests/a11y/README.md` : Chromium + webServer dev incompatibles avec build Vercel (next build), donc audit local pre-merge.

- [x] **Task 8 - Integration CI Vercel mode warn** (AC: #8)
  - [x] Sub 8.1 : **Decision** : pas d'integration au `buildCommand` Vercel (3 raisons documentees dans `tests/a11y/README.md` : webServer dev incompatible build prod, Chromium 165 Mo, pattern statique vs dynamique). Mode "audit local pre-merge" retenu, AC8 partiellement realise comme prevu par la story.
  - [x] Sub 8.2 : Plan de bascule (worker GitHub Actions ou Vercel deploy hook post-Preview) consigne dans le README, story de cloture Lot B ou Lot C.

- [x] **Task 9 - Documentation et DoD a11y mise a jour** (AC: #9, #11)
  - [x] Sub 9.1 : `tests/a11y/README.md` cree (commandes, parcours, baseline + garde-fou + procedure regen, strategie auth, exclusions documentees, decision CI, architecture, references).
  - [x] Sub 9.2 : `.claude/skills/bmad-create-story/template.md` : ligne DoD axe-core ajoutee.
  - [x] Sub 9.3 : `.claude/CLAUDE.md` projet : mention `npm run a11y:axe:check` ajoutee aux cotes de `lint:a11y-check`.

- [x] **Task 10 - Snapshot initial et commit** (AC: #6, #10)
  - [x] Sub 10.1 : `npm run a11y:axe:baseline` execute avec succes.
  - [x] Sub 10.2 : Baseline contient 7 entrees (P4 = 2 entrees pour register + login + 5 autres parcours), total Critical/Serious = 1 (1 violation `select-name` sur `/recherche` documentee).
  - [x] Sub 10.3 : Fichier `_bmad-output/test-artifacts/axe-core-baseline-2026-05-05.json` cree, pret pour commit.
  - [x] Sub 10.4 : `npm run build` reussit (AC10), `npm run lint:a11y-check` vert (158 violations baseline preserve, no regression).

## Review Findings

Code review du 2026-05-05 (3 layers : Blind Hunter, Edge Case Hunter, Acceptance Auditor). Sonnet 4.6 sur les 3 layers, distinct du Opus 4.7 implementeur.

### Decision needed

- [x] [Review][Decision] Specs `expect(summary).toBeDefined()` toujours vert — **arbitrage : option (a)**, garder tel quel + warning README explicite. Applique : `tests/a11y/README.md` section "Commandes" comporte un encart « **Important** : `npm run a11y:axe` n'est pas un gate de regression... La regression est bloquee par `npm run a11y:axe:check` ». Sources : blind+edge.

### Patch

- [x] [Review][Patch] `build-axe-baseline.mjs` ignore exit code 1 Playwright et ecrit baseline meme si specs ont echoue [scripts/build-axe-baseline.mjs:39-42] — applique : exit 1 si Playwright code 1 ET attachments < tests, sinon warning explicite si code 1 mais tous les attachments sont presents.
- [x] [Review][Patch] `check-axe-baseline.mjs` ignore les escalades d'impact (serious → critical a count constant) [scripts/check-axe-baseline.mjs:140-155] — applique en mode **warn non bloquant** (decision : un bump axe-core qui reclassifie une regle ne doit pas casser la CI sans qu'une vraie regression UX soit introduite). Nouveau bloc `escalatedImpacts` avec rang d'impact (`minor < moderate < serious < critical`).
- [x] [Review][Patch] `check-axe-baseline.mjs` ne detecte pas les parcours supprimes du run courant mais presents dans le baseline [scripts/check-axe-baseline.mjs:79-104] — applique : nouveau `removedFromCurrent` calcule sur les keys du baseline, warning explicite (non bloquant).
- [x] [Review][Patch] `runAxe.toArray()` produit `string[][]` qui change la semantique iframe d'axe-core [tests/a11y/lib/run-axe.ts:37-41] — applique : helper renomme `toSelectorList` qui retourne `string[]`. Verification factuelle : aucun Stripe.js charge sur `/register` (Stripe est cantonne aux pages `/abonnement`), aucune iframe sur les 6 parcours actuels — pas de regression effective sur le baseline. Fix preventif pour les futurs ajouts d'exclude.
- [x] [Review][Patch] `waitForLoadState('networkidle')` peut ne jamais firer si Stripe.js charge sur `/register` [tests/a11y/p4-inscription-checkout.spec.ts:6] — applique en pattern defensif uniforme sur les 6 specs : `try { await page.waitForLoadState('networkidle', { timeout: 5000 }) } catch { /* fallback gracieux */ }`. Anticipe l'arrivee du WebSocket Supabase realtime en story 2.6.2 sur la messagerie.
- [x] [Review][Patch] `check-axe-baseline.mjs` Map dedupe silencieusement les ids baseline en doublon [scripts/check-axe-baseline.mjs:116-119] — applique : detection a la lecture + warning explicite.
- [x] [Review][Patch] README parcours table liste P4 comme entree unique alors que la suite produit 2 entrees `p4-register` et `p4-login` [tests/a11y/README.md] — applique : ligne P4 explicite les 2 sous-entrees.

### Defer (pre-existant ou hors scope immediat)

- [x] [Review][Defer] Nouveau parcours avec 0 violation passe silencieusement jusqu'a regen manuelle [scripts/check-axe-baseline.mjs:126-135] — comportement acceptable, warning explicite suffit, regen baseline = process documente.
- [x] [Review][Defer] Pas de garde explicite si port 3000 deja occupe en CI [playwright.config.ts:27-28] — message Playwright standard suffit, audit local pour l'instant.
- [x] [Review][Defer] Webserver timeout 120s peut etre court en CI cold cache [playwright.config.ts:27] — pas de CI Vercel actuellement, a revoir avec la bascule CI Lot C.
- [x] [Review][Defer] `PLAYWRIGHT_JSON_OUTPUT_NAME` et `reportFile` hardcodes en sync [scripts/build-axe-baseline.mjs:44-55] — pas un bug actuel, latent si refacto.

### Dismiss (4)

- 4 specs auditent `/login` → 4 entrees baseline meme page : intentionnel (1 entree par parcours, sémantique de couverture > dédoublonnage URL). Documente dans `auth-stub.md`.
- `totals` mal nomme (compte rules pas violations brutes) : cosmetique, semantique claire dans le contexte.
- File List story sans la spec elle-meme : convention BMad, le fichier story n'est pas un livrable de la story.
- AC commun 1 / job axe-core en CI : explicitement anticipe par AC8 Sub 8.1 (R1), pas un manquement.

## Dev Notes

### Patterns architecturaux

- **Convention `npm` strict** : aucun `pnpm`, `yarn`, `bun`. Lockfile `package-lock.json` uniquement. (Heritage Lot A.)
- **ESM partout** : `playwright.config.ts` en TS export ESM. Scripts `.mjs` sous `scripts/`. Aucun fichier `.cjs`.
- **Pas de tailwind config** : Tailwind v4 CSS-only, ne pas creer de `tailwind.config.ts`. (Hors scope ici, mais convention rappelee.)
- **CI = Vercel preview deployments** uniquement. Pas de GitHub Actions a creer.
- **Tri lexicographique ISO** : pattern `findLatestBaseline()` reutilise du Lot A (validation 2.5.1 D2 retro).

### Source tree components a toucher

- Creer : `playwright.config.ts`, `tests/a11y/lib/run-axe.ts`, `tests/a11y/lib/auth-stub.md`, 6 specs sous `tests/a11y/p*-*.spec.ts`, `tests/a11y/README.md`, `scripts/build-axe-baseline.mjs`, `scripts/check-axe-baseline.mjs`, `_bmad-output/test-artifacts/axe-core-baseline-2026-05-XX.json`.
- Editer : `package.json` (scripts + devDependencies), `.gitignore`, `.claude/skills/bmad-create-story/template.md`, `CLAUDE.md`.
- **Ne pas toucher** : `app/`, `components/` — la story est purement outillage.

### Testing standards

- Pas de tests unitaires ajoutes (pas dans le scope du projet, cf. retro Lot A).
- Les specs Playwright sont elles-memes les tests : 6 fichiers `*.spec.ts`.
- Verification manuelle : `npx playwright test --ui` pour explorer les violations en local.

### Risques identifies

- **R1 — Playwright en build Vercel** : si le navigateur Chromium n'est pas disponible sur la build image, l'AC8 partie integration CI doit tomber en repli (audit local pre-merge). Documenter clairement plutot que forcer une integration CI fragile.
- **R2 — Auth bypass** : la decision de ne pas creer de compte test est volontaire. Risque : couverture P1/P3/P6 partielle (page-login uniquement). Mitigation : le Lot C re-attaque cette limite avec compte test isole + axe-core scenario complet.
- **R3 — Faux positifs Leaflet/SVG** : les exclude sont documentes au Sub 4.1 et 4.2. Si un faux positif passe au travers, ouvrir une issue tracking et exclure ponctuellement avec justification.

### Project Structure Notes

- Repo monorepo non, projet single Next 16 App Router. Structure conforme avec creation de `tests/a11y/` racine. Conflit potentiel avec `tests/` futur autre type (unit, integration) — anticiper en nommant `tests/a11y/` explicitement.

### References

- [Source: _bmad-output/implementation-artifacts/mini-epic-2-5-retro-2026-05-05.md#Action items reportes] — AI-1 axe-core/playwright bloquant pour Lot B
- [Source: _bmad-output/test-artifacts/nfr-assessment-a11y-2026-05-04.md#5.4-actions-recommandees] — E2 axe-core 6 parcours
- [Source: _bmad-output/planning-artifacts/prd.md#Accessibilite-NFR-transverse] — outillage axe-core en CI cible
- [Source: _bmad-output/planning-artifacts/audit-a11y-2026-05-04.md#10-Annexes-B] — outils recommandes a installer
- [Source: _bmad-output/implementation-artifacts/tech-spec-lot-a-a11y.md#Realites-projet] — npm/Vercel/ESM/Tailwind v4 conventions
- [Source: _bmad-output/implementation-artifacts/2-5-1-outillage-a11y-baseline-lint.md] — pattern baseline + check wrapper a calquer

## Dev Agent Record

### Agent Model Used

claude-opus-4-7[1m]

### Debug Log References

- `npm install -D @playwright/test @axe-core/playwright axe-core` -> 4 paquets ajoutes (Playwright 1.59.1, axe-core 4.11.4, @axe-core/playwright 4.11.3).
- `npx playwright install chromium` -> Chrome for Testing 147.0.7727.15 telecharge en cache `~/Library/Caches/ms-playwright/chromium-1217`.
- `npx playwright test --list` -> 7 tests detectes dans 6 specs (P4 = 2 tests).
- `npm run a11y:axe:baseline` -> baseline 2026-05-05 ecrit, 1 violation Critical (`select-name` sur `/recherche`).
- `npm run a11y:axe:check` -> OK, aucun delta vs baseline.
- `npm run lint:a11y-check` -> OK, 158 violations (baseline Lot A preserve).
- `npm run build` -> OK, Next 16 build reussit, types valides.

### Completion Notes List

- **Decision technique majeure (Sub 4.5)** : assertion stricte deplacee de chaque spec vers le wrapper `check-axe-baseline.mjs`. Couplage spec ↔ baseline evite (1er run sans baseline aurait casse 6 specs). Les specs attachent `axe-violations.json` via `testInfo.attach`, le wrapper compare structurellement (regles ajoutees/supprimees/noeuds aggraves). Garantie equivalente a l'AC.
- **Decision technique CI (AC8/Task 8)** : pas d'integration au `buildCommand` Vercel. Trois raisons : webServer Playwright lance `npm run dev` (incompatible avec `next build` prod sur Vercel), Chromium 165 Mo a chaque build, pattern statique (lint) vs dynamique (Playwright). Mode "audit local pre-merge" retenu, plan de bascule (worker GH Actions ou Vercel deploy hook) documente dans `tests/a11y/README.md`. AC8 partiellement realise comme anticipe par Sub 8.1.
- **Etat baseline** : 1 seule violation Critical recensee a J0 (`select-name` sur le filtre `<select>` de `/recherche`). Toutes les autres pages sont propres. Bonne base de depart pour le Lot B.
- **Couverture auth-required** : limitee au proxy `/login` pour P1, P3, P6. Re-evaluation Lot C avec compte test isole.
- **Pas de regression Lot A** : `lint:a11y-check` toujours vert (158 violations baseline preserve), `build` toujours vert.

### File List

**Crees** :

- `playwright.config.ts`
- `tests/a11y/lib/run-axe.ts`
- `tests/a11y/lib/auth-stub.md`
- `tests/a11y/p1-onboarding-aux.spec.ts`
- `tests/a11y/p2-recherche.spec.ts`
- `tests/a11y/p3-messagerie.spec.ts`
- `tests/a11y/p4-inscription-checkout.spec.ts`
- `tests/a11y/p5-landing.spec.ts`
- `tests/a11y/p6-suppression-rgpd.spec.ts`
- `tests/a11y/README.md`
- `scripts/build-axe-baseline.mjs`
- `scripts/check-axe-baseline.mjs`
- `_bmad-output/test-artifacts/axe-core-baseline-2026-05-05.json`

**Modifies** :

- `package.json` (3 scripts + 3 devDependencies)
- `package-lock.json` (regenere par npm install)
- `.gitignore` (`/playwright-report/`, `/test-results/`, `/.playwright/`)
- `.claude/skills/bmad-create-story/template.md` (ligne DoD axe-core)
- `.claude/CLAUDE.md` (mention `npm run a11y:axe:check`)

## Change Log

| Date       | Auteur                | Resume                                                                                                                          |
| ---------- | --------------------- | ------------------------------------------------------------------------------------------------------------------------------- |
| 2026-05-05 | claude-opus-4-7[1m]   | Story 2.6.1 livree : suite Playwright + axe-core sur 6 parcours critiques, baseline 2026-05-05 (1 violation Critical), DoD a11y mise a jour. AC8 partiel (mode audit local pre-merge documente). |

## DoD a11y

A renseigner au moment de la PR :

- [ ] Labels associes aux champs (`htmlFor` ou `aria-labelledby`) — N/A (story d'outillage, pas d'UI)
- [ ] Erreurs liees aux champs via `aria-describedby` + `aria-invalid` — N/A
- [ ] Focus visible sur tous les elements interactifs (contraste >= 3:1) — N/A
- [ ] Contrastes texte >= 4,5:1 et UI >= 3:1 — N/A
- [ ] ARIA states corrects sur composants dynamiques — N/A
- [ ] Navigation clavier complete — N/A
- [ ] Verification ponctuelle au lecteur d'ecran — N/A
- [x] Pas de regression `eslint-plugin-jsx-a11y` (`npm run lint:a11y-check` vert — 158 violations, baseline Lot A preserve)
- [x] Snapshot baseline axe-core genere et commit (`axe-core-baseline-2026-05-05.json` present, 7 entrees, 1 violation Critical)
