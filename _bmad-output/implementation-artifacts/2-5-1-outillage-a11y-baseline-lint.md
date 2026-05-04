# Story 2.5.1 : Outillage a11y et baseline lint

Status: done

<!-- Note: Validation est optionnelle. Lancer `validate-create-story` avant `dev-story` pour un controle qualite. -->

## Story

En tant que **developpeur du projet roxanetnous**,
je veux **un linter `eslint-plugin-jsx-a11y` actif sur tous les fichiers `.tsx` avec un snapshot baseline des violations existantes**,
afin de **detecter automatiquement toute nouvelle regression d'accessibilite et bloquer son merge, tout en debloquant la livraison progressive du Lot A sans bloquer les PR en cours sur les violations historiques**.

Cette story est la premiere du Lot A (accessibilite quick wins). Elle est prerequis aux stories 2.5.2 a 2.5.6 : elle outille la detection automatique pour que les corrections suivantes soient garanties non-regressives. Elle prepare aussi le futur basculement en CI bloquante apres livraison du Lot A complet.

## Acceptance Criteria

### AC commun Lot A (rappel)

1. **AC commun 1** - Given une PR Lot A, when la CI tourne, then le job lint passe sans nouvelle violation `jsx-a11y/*` au-dela du baseline capture par cette story.
2. **AC commun 2** - Given un composant modifie, when un developpeur consulte le composant, then les attributs ARIA pertinents sont presents si necessaires.
3. **AC commun 3** - Given une story Lot A en revue, when le reviewer relit la PR, then la checklist DoD a11y (voir Tasks) est presente dans la description et les cases applicables sont cochees.

### AC propres a la Story 2.5.1

4. **AC1 - Plugin installe et configure** : Given la branche post-livraison, when un developpeur execute `npm install` puis `npm run lint`, then `eslint-plugin-jsx-a11y` est installe en devDependency, ESLint v9 (flat config) est installe et configure, et la sortie de lint affiche les regles `jsx-a11y/*` parmi les regles actives (verifier avec `npx eslint --print-config app/page.tsx | grep jsx-a11y`).
5. **AC2 - Script `lint` migre vers ESLint direct** : Given le `package.json`, when on lit la commande `lint`, then elle invoque `eslint . --ext .ts,.tsx` (ou equivalent flat config) et **non** plus `next lint` (deprecie en Next 16). Le script `lint:fix` (`eslint . --ext .ts,.tsx --fix`) est ajoute pour les corrections automatiques.
6. **AC3 - Snapshot baseline genere** : Given le snapshot, when un developpeur consulte `_bmad-output/test-artifacts/a11y-lint-baseline-2026-05-04.txt`, then le fichier existe et contient :
   - Date de generation et commit SHA de reference,
   - Liste des violations `jsx-a11y/*` actuelles regroupees par regle (avec compteur) et par fichier,
   - Compteur total `errors` et `warnings` jsx-a11y,
   - Format texte lisible (pas de JSON brut), genere depuis la sortie ESLint.
7. **AC4 - CI Vercel : `npm run lint` passe** : Given le pipeline build Vercel, when on push sur main ou ouvre une PR preview, then le build Vercel echoue si une **nouvelle** violation `jsx-a11y/*` apparait au-dela du baseline. Mecanisme : config flat `recommended` en mode `warn` + flag ESLint `--max-warnings=N` ou wrapper `scripts/check-a11y-baseline.mjs` qui compare au snapshot baseline.
8. **AC5 - Detection nouvelle violation testee** : Given une PR de demonstration creee localement (commit jetable) qui ajoute un `<input>` orphelin sans label associe, when on execute `npm run lint`, then ESLint signale `jsx-a11y/label-has-associated-control` comme nouvelle violation au-dela du baseline et la commande sort en code != 0.
9. **AC6 - DoD a11y documentee** : Given la documentation projet, when un developpeur cree une nouvelle story, then la checklist DoD a11y est documentee dans `.claude/skills/bmad-create-story/template.md` (section ajoutee en bas) **ET** dans `CLAUDE.md` projet (regle visible). Contenu de la checklist :
   - Labels associes aux champs (`htmlFor` ou `aria-labelledby`)
   - Erreurs liees aux champs via `aria-describedby` + `aria-invalid`
   - Focus visible sur tous les elements interactifs (>= 3:1)
   - Contrastes texte >= 4,5:1 et UI >= 3:1
   - ARIA states corrects sur composants dynamiques (`aria-expanded`, etc.)
   - Navigation clavier complete (Tab, Enter, Escape, fleches selon pattern)
   - Verification ponctuelle au lecteur d'ecran (VoiceOver ou NVDA) sur le composant touche
   - Pas de regression `eslint-plugin-jsx-a11y` (CI verte)
10. **AC7 - Pas de regression typecheck/build** : Given la branche post-livraison, when on execute `npm run build`, then le build Next 16 reussit sans erreur TypeScript ni runtime.

## Tasks / Subtasks

- [x] **Task 1 - Installer ESLint v9 et `eslint-plugin-jsx-a11y`** (AC: #4)
  - [x] Sous 1.1 : `npm install -D eslint@^9 @eslint/js@^9 eslint-plugin-jsx-a11y typescript-eslint` (ESLint epingle a v9 car `eslint-plugin-jsx-a11y` n'accepte pas v10 ; ESM/Node 25 OK ; TypeScript v6 compatible avec `typescript-eslint@^8.59`).
  - [x] Sous 1.2 : `npx eslint --version` retourne `v9.39.4` ; les plugins resolvent en ESM.
  - [x] Sous 1.3 : `package-lock.json` regenere par `npm install`.

- [x] **Task 2 - Creer `eslint.config.js` (flat config ESM)** (AC: #4, #5)
  - [x] Sous 2.1 : Creer `eslint.config.js` a la racine en ESM. Squelette :
    ```js
    import js from '@eslint/js'
    import tseslint from 'typescript-eslint'
    import jsxA11y from 'eslint-plugin-jsx-a11y'

    export default [
      js.configs.recommended,
      ...tseslint.configs.recommended,
      {
        files: ['**/*.{ts,tsx}'],
        plugins: { 'jsx-a11y': jsxA11y },
        rules: {
          ...jsxA11y.flatConfigs.recommended.rules,
        },
      },
      {
        ignores: ['.next/', 'node_modules/', '_bmad-output/', '_bmad/', 'public/', '.vercel/', 'supabase/migrations/'],
      },
    ]
    ```
  - [x] Sous 2.2 : `jsxA11y.flatConfigs.recommended.rules` expose bien les regles ; fallback prevu mais non necessaire.
  - [x] Sous 2.3 : `npx eslint --print-config app/layout.tsx` confirme la presence des regles `jsx-a11y/*` (alt-text, anchor-*, aria-*, label-*, heading-has-content, etc.). Toutes downgrade en `warn` pour ne pas bloquer la CI sur le baseline existant (decision tech-spec).

- [x] **Task 3 - Migrer le script `lint` du `package.json`** (AC: #5)
  - [x] Sous 3.1 : `"lint"` migre vers `eslint . --ext .ts,.tsx,.js,.mjs`.
  - [x] Sous 3.2 : `"lint:fix"` ajoute.
  - [x] Sous 3.3 : `npm run lint` retourne exit 0 avec 230 warnings (0 erreur), ce qui est attendu (baseline existant).

- [x] **Task 4 - Generer le snapshot baseline** (AC: #6)
  - [x] Sous 4.1 : Le script `build-a11y-baseline.mjs` execute ESLint en JSON via `execSync` (pas de fichier `/tmp/` intermediaire necessaire, plus propre).
  - [x] Sous 4.2 : `scripts/build-a11y-baseline.mjs` cree : filtre `^jsx-a11y/`, agrege par regle (compteur trie desc) et par fichier (chaque regle + compteur), produit un texte structure :
    ```
    A11Y LINT BASELINE
    Generated: 2026-05-04
    Commit: <git rev-parse HEAD>
    Total errors: N
    Total warnings: M

    By rule:
      jsx-a11y/label-has-associated-control: 12
      jsx-a11y/click-events-have-key-events: 5
      ...

    By file:
      components/ui/input.tsx:
        jsx-a11y/label-has-associated-control (3)
      components/landing/hero-carte.tsx:
        ...
    ```
  - [x] Sous 4.3 : Sortie ecrite dans `_bmad-output/test-artifacts/a11y-lint-baseline-2026-05-04.txt` (160 violations totales).
  - [x] Sous 4.4 : Le baseline contient le commit SHA `8d56a5e18319f5c9e80446f9c1db970935162890`.
  - [x] Sous 4.5 : Le fichier baseline est cree (sera commite avec la story).

- [x] **Task 5 - Wrapper baseline pour CI** (AC: #7, #8)
  - [x] Sous 5.1 : `scripts/check-a11y-baseline.mjs` cree, decouvre automatiquement le baseline le plus recent dans `_bmad-output/test-artifacts/a11y-lint-baseline-*.txt`, compare le total actuel et sort en code 1 si regression (avec log file:line:col regle message).
  - [x] Sous 5.2 : `"lint:a11y-check"` ajoute dans `package.json`.
  - [x] Sous 5.3 : Test de regression effectue : ajout d'un fichier `app/_a11y-regression-test.tsx` avec `<label>` orphelin, `npm run lint:a11y-check` retourne exit code 1 et log la nouvelle violation `jsx-a11y/label-has-associated-control`. Fichier retire, exit code repasse a 0 (160 = 160).

- [x] **Task 6 - CI Vercel** (AC: #4)
  - [x] Sous 6.1 : `vercel.json` mis a jour avec `"buildCommand": "npm run lint:a11y-check && next build"`. Cela garantit que toute regression a11y echoue le build avant que Next 16 ne lance sa propre passe ESLint.
  - [x] Sous 6.2 : Verifie localement : `npm run lint:a11y-check && next build` reussit. Verification Vercel preview a faire au push de la PR (test de regression : ajouter une violation, push, observer le fail du build Vercel).
  - [x] Sous 6.3 : Pas de workflow GitHub Actions cree (hors scope, conforme tech-spec).

- [x] **Task 7 - Documenter la DoD a11y** (AC: #9)
  - [x] Sous 7.1 : Section `## DoD a11y` ajoutee en bas du `template.md` (8 cases a cocher : labels, erreurs aria, focus, contrastes, ARIA states, clavier, lecteur d'ecran, lint:a11y-check vert).
  - [x] Sous 7.2 : Regle a11y ajoutee dans `.claude/CLAUDE.md` sous `## Regles strictes`, mentionne explicitement le wrapper `npm run lint:a11y-check`.
  - [x] Sous 7.3 : Aucune story deja terminee modifiee.

- [x] **Task 8 - Verification globale** (AC: #10)
  - [x] Sous 8.1 : `npm install` reussi (tree resolu apres pinning ESLint v9).
  - [x] Sous 8.2 : `npm run lint` s'execute (exit 0, 230 warnings, 0 errors).
  - [x] Sous 8.3 : `npm run lint:a11y-check` retourne code 0 (160 = 160 baseline).
  - [x] Sous 8.4 : `npm run build` reussit (Next 16 + TypeScript v6, 46 pages prerendered).
  - [ ] Sous 8.5 : Push branche, ouvrir PR, verifier preview Vercel green. **A faire par l'utilisateur** apres review locale.

## Dev Notes

### Contexte projet (specifique - lire avant tout)

- **Etat actuel pre-story** : aucun ESLint config. `package.json` declare `"lint": "next lint"` mais cette commande **echoue actuellement** sur Next 16 (`Invalid project directory : .../lint`). `next lint` est deprecie depuis Next 13 et completement retire/casse en pratique sur Next 16. Cette story remet la chaine de lint en marche **et** ajoute jsx-a11y dessus en meme temps.
- **Pas de pnpm** : le projet utilise **npm** (`package-lock.json` present). Toutes les commandes du tech-spec qui mentionnent `pnpm add -D ...` doivent etre traduites en `npm install -D ...`.
- **Pas de `.github/workflows/`** : la CI est exclusivement via les preview deployments Vercel. Pas de GitHub Actions a ecrire dans cette story (le tech-spec mentionne `.github/workflows/ci.yml` mais ce fichier n'existe pas et ce n'est pas l'approche du projet).
- **Pas de `tailwind.config.ts`** : Tailwind v4 fonctionne en CSS-only via `@theme` dans `app/globals.css`. Aucune config TS Tailwind a creer/modifier dans cette story (et dans aucune story du Lot A).
- **TypeScript v6** : version recente. `typescript-eslint` doit etre compatible (verifier au moment de l'install).
- **ESM strict** : `"type": "module"` dans `package.json`. Tous les nouveaux scripts (`scripts/build-a11y-baseline.mjs`, `scripts/check-a11y-baseline.mjs`) doivent etre en ESM avec extension `.mjs` ou utiliser `import`/`export`.
- **Pas d'emojis** dans le code (regle `CLAUDE.md` projet). Les scripts et la doc DoD a11y ne doivent pas en contenir.

### Choix techniques (justifies)

- **Flat config ESLint v9 (pas legacy `.eslintrc`)** : ESLint 9+ utilise par defaut la flat config. Le projet n'a aucune config existante, autant partir directement sur la moderne. La syntaxe est plus simple et conforme aux defauts modernes Next 16.
- **`jsx-a11y/recommended` (pas `strict`)** : conforme decision tech-spec. `recommended` couvre les regles essentielles sans bloquer sur `anchor-is-valid` (faux positifs avec Next `<Link>`). Si `jsx-a11y/anchor-is-valid` se revele bruyant en pratique, le desactiver explicitement avec un commentaire justifiant le contexte Next.
- **Mode `warn` partout au demarrage** : eviter de bloquer la CI sur les ~30+ violations existantes. Le wrapper `check-a11y-baseline.mjs` controle les deltas par paire `(fichier, regle)`. Bascule en `error` apres livraison Lot A complet (toutes les stories 2.5.x livrees).
- **Snapshot baseline texte (pas JSON)** : lisibilite humaine. Le wrapper CI compare juste le compteur total. Si on a besoin du detail JSON plus tard, on peut le regenerer.
- **Wrapper Node ESM (pas bash)** : portabilite (tourne sur poste dev macOS et runner Vercel Linux), gestion d'erreur propre, parsing JSON natif. Bash serait plus fragile sur le parsing.
- **Pas de pre-commit hook (Husky) dans cette story** : hors scope. Si pertinent, story future. Le filet de securite reste la CI Vercel.
- **CI Vercel par defaut Next** : Next 16 lance `eslint` automatiquement pendant `next build` si une config flat `eslint.config.js` est presente. Ca couvre 80% du besoin sans config Vercel custom. Le wrapper baseline n'est necessaire que si on veut bloquer specifiquement les nouvelles violations jsx-a11y meme quand le total reste sous le seuil global du build.

### Codebase patterns

- **Composants UI cles** (cibles des stories suivantes du Lot A, **pas modifies dans 2.5.1**) :
  - `components/ui/input.tsx` (1.1K) : composant central, sans `htmlFor`, sans `aria-invalid`, focus orange peche non conforme. Modifie en Story 2.5.5.
  - `components/ui/button.tsx` : focus-visible sans couleur de ring definie. Modifie en Story 2.5.3.
  - `components/landing/hero-carte.tsx` : SVG avec `<animate repeatCount="indefinite">`. Modifie en Story 2.5.4.
  - `components/layout/accompagne-header.tsx`, `accompagnante-header.tsx` : burger sans `aria-expanded`. Modifies en Story 2.5.6.
- **Layout actuel** (`app/layout.tsx`) : `<html lang="fr">` OK, polices avec `display: 'swap'` OK. **Pas de `<main>` au layout root**, pas de skip-link. Modifie en Story 2.5.2.
- **Theme Tailwind v4** dans `app/globals.css` : tokens `--color-accent: #F4C8A3`, `--color-kraft: #d3a387`. Token `--focus-ring` ajoute en Story 2.5.3.
- **Pas de tests unitaires** dans le repo (la retro epic 2 mentionne « 18 tests PASS » disparus). Cette story ne cree pas de tests automatises (Lot C).

### Anti-patterns a eviter

- **Ne pas faire `pnpm add ...`** : le projet est sur npm. Toujours `npm install -D ...`.
- **Ne pas creer `.github/workflows/ci.yml`** : pas dans le scope de cette story (et pas l'approche projet). Si plus tard juge necessaire, story dediee.
- **Ne pas creer `tailwind.config.ts`** : Tailwind v4 est full CSS sur ce projet.
- **Ne pas migrer la story 2-1, 2-2, 2-3, 2-4 vers la DoD a11y** : ces stories sont marquees `done`. La DoD a11y s'applique aux stories futures (Lot A et au-dela).
- **Ne pas mettre `--max-warnings=0` immediatement** : casserait main avec ~30+ violations baseline. Approche progressive.
- **Ne pas committer `/tmp/a11y-raw.json`** : sortie intermediaire, doit aller dans `.gitignore` ou rester en `/tmp`.
- **Ne pas ajouter d'emoji** dans la doc DoD a11y, le baseline, les scripts, ou les commentaires de `eslint.config.js`. Regle stricte projet.
- **Ne pas modifier les fichiers cibles des stories 2.5.2 a 2.5.6** : cette story est purement outillage. Le linter peut signaler des violations dans ces fichiers, c'est attendu et c'est exactement le but du baseline.

### Source tree (fichiers crees ou modifies)

**Crees** :
- `eslint.config.js` (racine, ESM flat config)
- `scripts/build-a11y-baseline.mjs`
- `scripts/check-a11y-baseline.mjs`
- `_bmad-output/test-artifacts/a11y-lint-baseline-2026-05-04.txt`

**Modifies** :
- `package.json` (devDependencies + scripts `lint`, `lint:fix`, `lint:a11y-check`)
- `package-lock.json` (regenere par `npm install`)
- `.claude/skills/bmad-create-story/template.md` (ajout section DoD a11y)
- `CLAUDE.md` (regle a11y stricte sous `## Regles strictes`)
- `vercel.json` (uniquement si AC4 necessite un `buildCommand` custom — si Next gere nativement le lint pendant `next build`, ne pas modifier)

**Non modifies (mais cibles dans futures stories)** :
- `app/layout.tsx` (Story 2.5.2)
- `app/globals.css` (Stories 2.5.3, 2.5.4)
- `components/ui/input.tsx` (Story 2.5.5)
- `components/ui/button.tsx` (Story 2.5.3)
- `components/landing/hero-carte.tsx` (Story 2.5.4)
- `components/layout/accompagne-header.tsx`, `accompagnante-header.tsx` (Story 2.5.6)

### Testing standards summary

- **Pas de tests unitaires/e2e** crees par cette story (suivant convention projet, et hors scope Lot A).
- **Verification manuelle obligatoire** :
  1. `npm install` reussit sans erreur.
  2. `npm run lint` produit une sortie non-vide (warnings sur les violations existantes).
  3. `npm run lint:a11y-check` retourne code 0 immediatement apres generation du baseline.
  4. Test de regression : ajouter temporairement un `<input>` orphelin dans `app/page.tsx`, executer `npm run lint:a11y-check`, verifier code 1, retirer le test.
  5. `npm run build` reussit (Next 16 + TypeScript v6).
  6. Preview Vercel green sur la PR.
- **Test manuel skip-link / lecteur d'ecran** : non applicable a cette story (pas de changement UI).

### Project Structure Notes

- Aucun conflit avec la structure existante. Tous les nouveaux fichiers se placent dans des emplacements deja conventionnes :
  - `eslint.config.js` a la racine (standard ESLint).
  - `scripts/` existe deja (contient `test-supabase.ts`).
  - `_bmad-output/test-artifacts/` existe deja (contient le NFR a11y).
- Le `package.json` reste compact (le projet a un `package.json` 950B, on ajoute ~5 deps + 2 scripts = ~1.2K final).
- Pas de breaking change : aucune modification de code metier, aucune migration BDD, aucun nouveau server action, aucun changement Stripe/Supabase/Resend.

### Previous story intelligence (epic 2)

Patterns issus de la retro epic 2 (`_bmad-output/implementation-artifacts/epic-2-retro-2026-05-04.md`) applicables ici :

- **Reflexe "extraction hors `'use server'`"** : non applicable (pas de server actions touchees).
- **Tests purs** : la retro mentionne des tests disparus. Ne pas s'inquieter ici, hors scope.
- **Densite SCP** : pas de SCP en vue pour ce Lot A, le tech-spec est complet et le scope est figé.
- **Reviews multi-agent** : si une review est lancee post-livraison, elle pourra valider la chaine lint en parallele de la qualite du code.

Patterns issus des commits recents (8d56a5e, 9ad219d, cae2acc) : commit messages sobres en francais sans emoji, prefixe par theme ("Story 2.3 :", "Admin couverture :", "Admin nav :"). Suivre la meme convention pour le commit de cette story (ex: `Story 2.5.1 : outillage ESLint a11y et baseline`).

## DoD a11y

Pas applicable a cette story (purement outillage, aucun changement UI). La DoD a11y devient obligatoire sur les stories 2.5.2 et suivantes.

### References

- [Source: _bmad-output/implementation-artifacts/tech-spec-lot-a-a11y.md#Story-2.5.1] - tech-spec source de la story
- [Source: _bmad-output/planning-artifacts/audit-a11y-2026-05-04.md#1-Synthese-executive] - audit a11y, motivation et baseline
- [Source: _bmad-output/test-artifacts/nfr-assessment-a11y-2026-05-04.md] - NFR a11y, criteres E1 (outillage) et F1 (process DoD)
- [Source: _bmad-output/planning-artifacts/prd.md#Accessibilite-NFR-transverse] - PRD, NFR a11y, calendrier Lot A
- [Source: components/ui/input.tsx] - composant cible des stories suivantes (non modifie ici)
- [Source: app/layout.tsx] - layout actuel (cible Story 2.5.2)
- [Source: package.json] - manifest projet, npm + ESM, Next 16, TypeScript v6
- [Source: CLAUDE.md] - regles strictes projet (pas d'emojis, ESM)

## Dev Agent Record

### Agent Model Used

claude-opus-4-7 (1M context)

### Debug Log References

- `npx eslint --version` -> v9.39.4 (epingle car `eslint-plugin-jsx-a11y@6.10.2` peer eslint `^3..^9`, refusait `eslint@10`).
- `npm run lint` initialement 139 erreurs (jsx-a11y + tseslint en `error`). Decision : downgrade tous les `error` -> `warn` au demarrage (conforme tech-spec : « Mode warn partout au demarrage »). Apres downgrade : 0 erreur, 230 warnings, exit 0.
- 2 erreurs initiales `react-hooks/exhaustive-deps was not found` causees par des `// eslint-disable-next-line react-hooks/*` orphelins dans le code. Ajout `eslint-plugin-react-hooks` (regles en warn) pour resoudre les directives orphelines sans elargir le scope a11y.
- `npx eslint --print-config app/layout.tsx | grep jsx-a11y` confirme la presence des regles jsx-a11y dans la config merged.
- Test regression : ajout temporaire de `app/_a11y-regression-test.tsx` avec un `<label>` orphelin -> `npm run lint:a11y-check` exit 1, log `jsx-a11y/label-has-associated-control`. Fichier supprime apres test.

### Completion Notes List

- ESLint v9.39.4 + flat config ESM installe et operationnel sur tout le repo (.ts, .tsx, .js, .mjs).
- 160 violations jsx-a11y/* baseline capturees, dominees par `label-has-for` (77), `label-has-associated-control` (53), `control-has-associated-label` (16). Cible des stories 2.5.2 a 2.5.6.
- Wrapper `lint:a11y-check` decouvre dynamiquement le baseline le plus recent (pattern `a11y-lint-baseline-YYYY-MM-DD.txt`), ce qui simplifie la maintenance lorsque le baseline est regenere.
- `vercel.json` etend avec `buildCommand` qui execute le check baseline avant `next build` -> bloque toute regression a11y en preview Vercel.
- Decision technique : passer toutes les regles (jsx-a11y, tseslint, js recommended) en `warn` evite de casser la CI sur le legacy. Bascule en `error` planifiee post-Lot A complet (apres livraison de toutes les stories 2.5.x).
- Plugin `eslint-plugin-react` et `eslint-plugin-react-hooks` ajoutes (raison : directives `eslint-disable-next-line react-hooks/*` orphelines dans le codebase). Hors scope strict de la story mais necessaire pour qu'`npm run lint` retourne exit 0.
- DoD a11y publiee dans le template `bmad-create-story` (incluse automatiquement dans toutes les futures stories) et dans `CLAUDE.md` projet (regle stricte visible au top).
- Aucun emoji ajoute (regle stricte projet respectee).
- Aucun fichier UI legacy modifie (cibles des stories 2.5.2 a 2.5.6).

### File List

**Crees** :
- `eslint.config.js`
- `scripts/build-a11y-baseline.mjs`
- `scripts/check-a11y-baseline.mjs`
- `_bmad-output/test-artifacts/a11y-lint-baseline-2026-05-04.txt`

**Modifies** :
- `package.json` (ajout devDependencies eslint, @eslint/js, eslint-plugin-jsx-a11y, eslint-plugin-react, eslint-plugin-react-hooks, typescript-eslint ; scripts `lint` migre vers eslint direct, ajout `lint:fix` et `lint:a11y-check`)
- `package-lock.json` (regenere par npm install)
- `vercel.json` (ajout `buildCommand` enchainant `lint:a11y-check` puis `next build`)
- `.claude/CLAUDE.md` (regle stricte a11y ajoutee sous `## Regles strictes`)
- `.claude/skills/bmad-create-story/template.md` (section `## DoD a11y` ajoutee en bas)

### Change Log

- 2026-05-04 : Story 2.5.1 livree (review). Mise en place ESLint v9 flat config avec `eslint-plugin-jsx-a11y` (mode warn), baseline `a11y-lint-baseline-2026-05-04.txt` (160 violations), wrapper `lint:a11y-check` pour bloquer les regressions en CI Vercel via `buildCommand`. DoD a11y publiee dans le template story et `CLAUDE.md`. Pas de modification UI ni metier (outillage pur).

### Review Findings

- [x] [Review][Decision] Baseline non commite -- resolu : aucun `.gitignore`/`.vercelignore` n'exclut `_bmad-output/test-artifacts/`, baseline commite avec la story.
- [x] [Review][Decision] Total scalaire bypass-able -- resolu par patch : `scripts/check-a11y-baseline.mjs` reecrit pour comparer paire par paire `(fichier, regle)` parsee depuis la section "By file:" du baseline. Toute paire courante > paire baseline ou nouvelle paire absente du baseline = regression. Ferme le bypass "deplacer A->B" et "echanger regle X contre Y a total constant". Test fonctionnel : nouveau fichier avec 2 violations -> 2 paires detectees, exit 1.
- [x] [Review][Decision] Regeneration baseline non verrouillee -- accepte (echelle solo). Garde-fou social ajoute en tete du fichier baseline et dans `build-a11y-baseline.mjs` : "Ne pas regenerer pour faire passer la CI sans justification dans le PR." A reevaluer (option CODEOWNERS / comparaison vs `main`) si l'equipe grossit.
- [x] [Review][Patch] `--ext .ts,.tsx` retire de `package.json` (`lint`, `lint:fix`), `scripts/build-a11y-baseline.mjs:25`, `scripts/check-a11y-baseline.mjs` -- le scope est defini par `files:` dans `eslint.config.js`. Silencieusement ignore en flat config v9.
- [x] [Review][Patch] Fallback `?? {}` remplace par un `throw new Error(...)` explicite [`eslint.config.js:6-15`] -- fail-fast au prochain bump majeur du plugin si la forme d'export change.
- [x] [Review][Patch] `eslint-plugin-react` retire de devDependencies [`package.json`] -- importe nulle part, lockfile resync (-20 packages).
- [x] [Review][Patch] `path.relative(repoRoot, fileResult.filePath)` au lieu de `replace(repoRoot)` [`scripts/build-a11y-baseline.mjs`, `scripts/check-a11y-baseline.mjs`] -- correct semantiquement.
- [x] [Review][Defer] `npm run lint` exit 0 avec 231 warnings -- faux signal "tout clean" en local. Decision tech-spec assumee (mode warn au demarrage), bascule en `error` planifiee post-Lot A complet.
- [x] [Review][Defer] `downgradeErrorsToWarn` masque toutes les erreurs ESLint critiques (`no-undef`, `no-unused-vars`, etc.) -- intentionnel pour bootstrap, a reverser post-Lot A complet.
- [x] [Review][Defer] `lint:fix` peut modifier `scripts/build-a11y-baseline.mjs` lui-meme (`} catch {}` -> `/* empty */`) -- pollution diff potentielle, ajouter `scripts/` aux ignores ou corriger `} catch {}` plus tard.
- [x] [Review][Defer] Tri lexicographique baseline + clock skew futur peut masquer des regressions massives -- ajouter une validation `date <= today` dans `findLatestBaseline()`. Risque faible mais reel.
- [x] [Review][Defer] Position de la DoD a11y dans le template (post-Dev Agent Record) -- ergonomie, descend sous le fold sur stories volumineuses. Deplacer si besoin.
