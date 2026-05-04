---
title: 'Accessibilite Lot A - Quick Wins'
slug: 'lot-a-a11y'
created: '2026-05-04'
updated: '2026-05-04'
status: 'planned'
stepsCompleted: []
package_manager: 'npm'
ci_provider: 'vercel-preview-deployments'
tech_stack: ['Next.js 16', 'React 19', 'TailwindCSS v4 (CSS-only)', 'TypeScript v6', 'ESLint v9 flat config', 'eslint-plugin-jsx-a11y']
files_to_modify: ['package.json', 'app/layout.tsx', 'app/globals.css', 'components/ui/input.tsx', 'components/ui/button.tsx', 'components/landing/hero-carte.tsx', 'components/layout/accompagne-header.tsx', 'components/layout/accompagnante-header.tsx', 'CLAUDE.md', '.claude/skills/bmad-create-story/template.md']
files_to_create: ['eslint.config.js', 'scripts/build-a11y-baseline.mjs', 'scripts/check-a11y-baseline.mjs', '_bmad-output/test-artifacts/a11y-lint-baseline-2026-05-04.txt']
code_patterns: ['ui-component-input-with-useId', 'layout-skip-link', 'focus-visible-global-token', 'prefers-reduced-motion-css-and-js', 'aria-expanded-disclosure', 'jsx-a11y-eslint-recommended']
test_patterns: ['axe-core-playwright']
---

> **CHANGELOG**
> - **2026-05-04** : amendement « Realites projet » apres creation Story 2.5.1. Corrections : npm (pas pnpm), CI Vercel preview (pas GitHub Actions), Tailwind v4 CSS-only (pas de `tailwind.config.ts`), `next lint` casse sur Next 16 -> ESLint direct, pas de `sprint-status.yaml`. Voir section « Realites projet (constat 2026-05-04) » ci-dessous.

## Realites projet (constat 2026-05-04)

**Avant d'appliquer les sections suivantes, tenir compte des ecarts entre le tech-spec d'origine et l'etat reel du repo verifie au moment de la creation de la Story 2.5.1.**

### Ecarts a appliquer dans toutes les stories Lot A (2.5.1 a 2.5.6)

| Sujet | Hypothese tech-spec d'origine | Realite verifiee 2026-05-04 | Action |
|-------|-------------------------------|------------------------------|--------|
| Gestionnaire de paquets | `pnpm add -D ...`, `pnpm install`, `pnpm lint` | **npm** : `package-lock.json` present, pas de `pnpm-lock.yaml` | Toutes les commandes : `npm install -D ...`, `npm install`, `npm run lint`. **Jamais** de `pnpm` dans les commits. |
| CI | `.github/workflows/ci.yml` | **Pas de GitHub Actions** : la CI = preview deployments Vercel | Les ACs CI portent sur le build Vercel. Ne pas creer `.github/workflows/`. Si check baseline necessaire, passer par `buildCommand` Vercel ou `next build` natif (qui execute ESLint si `eslint.config.js` present). |
| Config Tailwind | `tailwind.config.ts` a editer (`theme.extend.colors`, etc.) | **Tailwind v4 full CSS** : aucun `tailwind.config.ts` n'existe. Tokens dans `app/globals.css` via `@theme`. | Toute extension de theme se fait dans `app/globals.css` sous `@theme { ... }`. Ne jamais creer `tailwind.config.ts`. |
| Script `lint` | `next lint` fonctionnel, on l'augmente avec jsx-a11y | **`next lint` est casse sur Next 16** : `npm run lint` retourne `Invalid project directory: .../lint`. La commande est depreciee. | Story 2.5.1 migre `package.json` vers `"lint": "eslint . --ext .ts,.tsx,.js,.mjs"`. Toutes les stories suivantes utilisent `npm run lint`. |
| Config ESLint | « adapter syntaxe d'import du plugin si flat config / legacy » | **Aucune config ESLint** n'existe. Ni flat ni legacy. | Story 2.5.1 cree `eslint.config.js` from scratch en flat config v9 ESM. |
| Sprint tracking | `sprint-status.yaml` mis a jour apres chaque story | **Pas de `sprint-status.yaml`** dans `_bmad-output/implementation-artifacts/` | Le workflow `bmad-create-story` saute simplement l'etape de mise a jour du sprint status. Si tracking sprint juge necessaire plus tard, story dediee. |
| Tests unitaires | « Pas de tests automatises pour l'instant » (deja correct) | Confirme : aucun `*.test.ts` dans le repo. La retro epic 2 mentionne des tests disparus. | Lot A ne cree pas de tests automatises (cf. Lot C). |
| Versions | TypeScript non specifie | **TypeScript v6**, React 19, Next 16 | Verifier compat de `typescript-eslint` au moment de l'install Story 2.5.1. |
| Module system | ESM mentionne dans CLAUDE.md | Confirme : `"type": "module"` dans `package.json` | Tous les scripts crees (`scripts/*.mjs`) en ESM. |

### Consequence sur les fichiers cibles

Le tech-spec d'origine listait `tailwind.config.ts` et `.github/workflows/ci.yml` dans `files_to_modify`. **Ces deux fichiers sont retires** du frontmatter (voir section frontmatter ci-dessus). En remplacement :
- `eslint.config.js` (cree, pas modifie),
- `scripts/build-a11y-baseline.mjs` et `scripts/check-a11y-baseline.mjs` (crees),
- `CLAUDE.md` et `.claude/skills/bmad-create-story/template.md` (modifies pour la DoD a11y).

### Convention commits Lot A

D'apres l'historique recent (8d56a5e, 9ad219d, cae2acc) : commits sobres, en francais, sans emoji, prefixes par theme. Format : `Story 2.5.X : <description courte>`. Exemples valides :
- `Story 2.5.1 : outillage ESLint a11y et baseline`
- `Story 2.5.2 : skip-link et structure layout`

---

# Tech-Spec: Accessibilite Lot A - Quick Wins

**Created:** 2026-05-04

## Overview

### Problem Statement

L'audit accessibilite du 2026-05-04 (`_bmad-output/planning-artifacts/audit-a11y-2026-05-04.md`) etablit une conformite WCAG 2.2 AA estimee a 25-30 % seulement. Le rapport NFR (`_bmad-output/test-artifacts/nfr-assessment-a11y-2026-05-04.md`) classe le projet en statut global **FAIL** avec 13 criteres FAIL sur 22, dont 5 bloqueurs critiques :

- **B1** Skip-link absent : utilisateurs clavier exclus
- **B2** Focus visible non conforme (ratio 2,0:1 sur blanc, 1,1:1 sur bg-accent) : utilisateurs basse vision exclus
- **C1** Labels formulaires non associes : composant `Input` central sans `htmlFor`/`id`, defaut propage sur ~30+ formulaires
- **C2** Erreurs de validation non annoncees au lecteur d'ecran
- **D2** ARIA states manquants sur les composants dynamiques (burger header sans `aria-expanded`)

A cela s'ajoutent : aucun outillage de detection statique (`eslint-plugin-jsx-a11y` non installe), pas de respect de `prefers-reduced-motion`, palette de bordures sous-contrastee (`border-gray-300` = 1,6:1), pas de definition-of-done a11y dans le process story.

Le NFR transverse a ete formalise dans le PRD (`_bmad-output/planning-artifacts/prd.md`, sous-section `### Accessibilite (NFR transverse)`) et bloque le demarrage de l'epic 3 tant que le Lot A n'est pas livre.

### Solution

Lot A regroupe 6 stories courtes qui remettent la base semantique du site a niveau, sans toucher aux fonctionnalites metier. Chaque story est un PR atomique. Les stories sont organisees pour qu'A1 (lint) parte en premier (afin de bloquer toute nouvelle violation des stories suivantes), puis A2/A3/A4 en parallele (couches CSS et layout independantes), puis A5 (refactor du composant Input central), puis A6 (header).

| Story | Titre | Effort | Criteres NFR couverts |
| ----- | ----- | ------ | --------------------- |
| **2.5.1** | Outillage a11y et baseline lint | 0,5 j | E1, F1 |
| **2.5.2** | Skip-link et structure layout | 0,25 j | B1, D1 (partiel) |
| **2.5.3** | Token de focus global et palette de contrastes | 0,75 j | A1, A2, B2 |
| **2.5.4** | prefers-reduced-motion | 0,25 j | A4 |
| **2.5.5** | Composant Input accessible | 1 j | C1, C2 (partiel), C3 |
| **2.5.6** | Header accessible et burger | 0,5 j | D2 (partiel), D1 (partiel) |

**Total : 6 stories, 3,25 j-dev**, coherent avec l'estimation audit (3-4 j).

### Scope

**In Scope:**

- Installation et configuration `eslint-plugin-jsx-a11y` en mode `recommended`, integration CI bloquante sur nouvelles violations
- Snapshot baseline des violations existantes pour ne pas bloquer les PR en cours
- Amendement du template story BMad : ajout de la checklist DoD a11y (labels, focus, contrastes, ARIA, clavier, verification ponctuelle au lecteur d'ecran)
- Skip-link "Aller au contenu principal" au layout root + ancre `<main id="main-content">` coherente sur toutes les pages
- Token CSS global `--focus-ring` (couleur foncee >= 3:1) et application via classes Tailwind utilitaires sur tous les elements interactifs
- Durcissement palette : `border-gray-300` -> `border-gray-400` (>= 3:1), `text-red-500` (erreurs) -> `text-red-700` (>= 4,5:1), correction `text-gray-500` sur `bg-accent`
- Media query `@media (prefers-reduced-motion: reduce)` dans `globals.css` desactivant `marquee`, `marquee-reverse`, `blink`
- Conditionnement JS des animations SVG infinies (carte hero) via `window.matchMedia('(prefers-reduced-motion: reduce)')`
- Refactor composant `Input` central (`components/ui/input.tsx`) : `useId()` + `htmlFor`, association `aria-describedby` pour les erreurs, `aria-invalid` quand erreur, `aria-required` pour les champs requis, suffix textuel "(obligatoire)" pour ne pas reposer uniquement sur l'asterisque rouge
- Verification de la propagation : tous les formulaires utilisant `Input` heritent automatiquement du fix
- Burger header : `aria-expanded={menuOpen}`, `aria-controls="mobile-menu"`, `aria-haspopup="true"`
- Conversion des conteneurs `<div>` de navigation desktop en `<nav>` semantique avec `aria-label` distinctif

**Out of Scope:**

- Tests automatises axe-core/Playwright (Lot C)
- Tests manuels VoiceOver/NVDA documentes (Lot C)
- ARIA progressbar et gestion focus inter-etapes onboarding auxiliaire (Lot B)
- Regions live messagerie (`role="log"`, `aria-live`) (Lot B)
- Audit Leaflet et alternatives clavier sur la carte de recherche (Lot B)
- Alternative textuelle riche pour la carte hero SVG (Lot B)
- Page de declaration d'accessibilite `/accessibilite` (Lot C)
- Cible tactile 44x44 px (Lot C)

## Context for Development

### Codebase Patterns

- **Composant `Input` partage** : `components/ui/input.tsx` est le composant central utilise par tous les formulaires (~30+ usages : login, signup, onboarding aux, profil, signalement, contact, RGPD). Toute modification se propage automatiquement. Pattern actuel : `<label>{labelText}{required && <span>*</span>}</label><input .../>{error && <p>{error}</p>}`. Defauts : pas de `htmlFor`, pas d'`id`, erreur non liee, pas d'`aria-invalid`.
- **Composant `Button` partage** : `components/ui/button.tsx` utilise partout. Possede deja `focus-visible:ring-2 focus-visible:ring-offset-2` mais sans couleur de ring definie (utilise la couleur par defaut Tailwind, souvent `blue-500`, parfois invisible selon le fond).
- **Theme kraft / accent** : palette projet utilisee partout. Couleur primaire `#FFB06E` (accent peche) utilisee pour les fonds boutons et certains rings. Couleur kraft `#d3a387` pour les sections marquees. Texte noir sur ces fonds = ratio >= 9:1, OK. Mais ces couleurs **ne doivent PAS** etre utilisees comme couleur de focus visible (ratio insuffisant sur blanc).
- **Tailwind v4 CSS-only** : aucun `tailwind.config.ts`. Tous les tokens (couleurs, fontes, focus ring) sont definis dans `app/globals.css` via `@theme { ... }`. Classes utilitaires preferees aux styles inline.
- **Layout root** : `app/layout.tsx` definit `<html lang="fr">`, charge les polices (`display: 'swap'`), enveloppe les enfants. Pas de `<main>` au layout root actuellement (chaque page le declare ou non).
- **Headers** : 3 headers distincts (`accompagne-header.tsx`, `accompagnante-header.tsx`, header public dans la landing). Le burger menu mobile est present dans les deux headers authentifies.
- **Pas d'emojis** dans le code ni les interfaces (regle CLAUDE.md projet). Les emojis dans les frontmatters tech-spec ne sont pas autorises non plus.
- **ESM** : `"type": "module"` dans `package.json`. Tous les fichiers de configuration utilisent la syntaxe ESM.
- **CI** : Vercel preview deployments uniquement (pas de GitHub Actions). Le build Vercel execute `next build`, qui execute automatiquement ESLint si `eslint.config.js` est present a la racine. Pas de tests automatises pour l'instant.
- **Gestionnaire de paquets : npm** (pas pnpm). Le repo a `package-lock.json`, pas `pnpm-lock.yaml`. Toutes les commandes du tech-spec mentionnant `pnpm ...` doivent se lire `npm run ...` ou `npm install -D ...`.

### Files to Reference

| File | Purpose |
| ---- | ------- |
| `package.json` | Manifeste : ajouter `eslint`, `eslint-plugin-jsx-a11y`, `@eslint/js`, `typescript-eslint` en devDependencies. Migrer `"lint"` de `next lint` (casse sur Next 16) vers `eslint . --ext .ts,.tsx,.js,.mjs` |
| `eslint.config.js` | **A creer** (n'existe pas). Configuration ESLint v9 flat config ESM : importer et etendre `jsxA11y.flatConfigs.recommended`. Le projet n'a aucune config ESLint actuellement. |
| `app/layout.tsx` | Layout root : ajouter skip-link, encapsuler `{children}` dans `<main id="main-content">` ou s'assurer que chaque page le fait |
| `app/globals.css` | Tokens CSS et animations Tailwind v4 (CSS-only) : ajouter `--focus-ring` dans le bloc `@theme`, `@media (prefers-reduced-motion: reduce)`, ajuster classes utilitaires. **Tout le theme Tailwind se configure ici** — aucun `tailwind.config.ts` n'existe ni ne doit etre cree. |
| `components/ui/input.tsx` | Composant central a refondre : `useId()`, `htmlFor`, `aria-describedby`, `aria-invalid`, `aria-required` |
| `components/ui/button.tsx` | Boutons : definir explicitement la couleur de `focus-visible:ring` via le token global |
| `components/landing/hero-carte.tsx` | Carte SVG : conditionner les animations pulse `repeatCount="indefinite"` sur `prefers-reduced-motion` |
| `components/layout/accompagne-header.tsx` | Header accompagne : burger `aria-expanded`, `aria-controls`, `<nav>` desktop |
| `components/layout/accompagnante-header.tsx` | Header accompagnante : meme pattern qu'accompagne |
| `vercel.json` | A modifier **seulement si necessaire** : `buildCommand` custom pour wrapper baseline check. Le build Vercel par defaut (`next build`) lance deja ESLint si `eslint.config.js` est present. Pas de `.github/workflows/ci.yml` (CI = Vercel preview deployments uniquement). |
| `scripts/build-a11y-baseline.mjs` | **A creer** (Story 2.5.1) : script Node ESM qui parse la sortie JSON ESLint et genere le snapshot baseline texte. |
| `scripts/check-a11y-baseline.mjs` | **A creer** (Story 2.5.1) : wrapper CI qui compare le compteur jsx-a11y actuel au baseline et sort en code != 0 si regression. |
| `CLAUDE.md` | A modifier (Story 2.5.1) : ajouter regle DoD a11y obligatoire dans `## Regles strictes`. |
| `.claude/skills/bmad-create-story/template.md` | A modifier (Story 2.5.1) : ajouter section `## DoD a11y` en bas du template pour propagation automatique aux stories futures. |
| `_bmad-output/planning-artifacts/audit-a11y-2026-05-04.md` | Audit source : reference pour chaque correction |
| `_bmad-output/test-artifacts/nfr-assessment-a11y-2026-05-04.md` | NFR : matrice complete des criteres et seuils mesurables |

### Technical Decisions

- **`eslint-plugin-jsx-a11y` extends `recommended` (pas `strict`)** : `recommended` couvre les regles essentielles (label-has-associated-control, alt-text, aria-props, etc.) sans bloquer sur des points discutables (anchor-is-valid avec Next Link). On pourra durcir plus tard. Le snapshot baseline (Story 2.5.1) capture les violations existantes pour ne pas casser les PR en cours : ces violations seront resolues progressivement par les stories Lot A et Lot B. La CI bloque uniquement les **nouvelles** violations apparues apres le baseline (via `eslint --max-warnings=N` ou comparaison de delta).

- **Token `--focus-ring` dans `@theme` Tailwind v4** : centraliser la couleur de focus dans un unique token CSS evite la divergence entre composants. Choisir `oklch(0.4 0.15 30)` (un orange tres fonce, ratio >= 5:1 sur blanc et >= 3:1 sur bg-accent) plutot que `#FFB06E` (l'accent original, ratio 2:1, non conforme). On garde une coherence visuelle avec la palette tout en respectant WCAG. Application via `focus-visible:ring-2 focus-visible:ring-[var(--focus-ring)] focus-visible:ring-offset-2`.

- **`useId()` plutot qu'un id genere a la main** : React 18+ fournit `useId()` qui garantit l'unicite SSR-safe et evite les collisions sur les pages avec plusieurs Inputs. Le pattern `const id = useId()` puis `<label htmlFor={id}><input id={id} ...>` est l'idiome React standard. Ne pas utiliser `Math.random()` (instable SSR) ni `useState(generateId())` (overhead).

- **`aria-describedby` pour les erreurs, pas `aria-labelledby`** : le label nomme le champ, l'erreur le decrit. Pattern : `<label htmlFor={id}>...</label><input id={id} aria-describedby={errorId} aria-invalid={!!error}><p id={errorId} role="alert">{error}</p>`. Le `role="alert"` sur le `<p>` d'erreur garantit l'annonce immediate par le lecteur d'ecran lors de l'apparition (sans attendre le focus).

- **Suffix "(obligatoire)" plutot que `aria-label="obligatoire"` sur l'asterisque** : le texte visible "(obligatoire)" est lu par le lecteur d'ecran ET reste comprehensible pour les utilisateurs voyants qui ne discernent pas la couleur rouge de l'asterisque. Conforme WCAG 1.3.1 (information non transmise uniquement par la couleur). Alternative `<span aria-label="obligatoire">*</span>` est valide techniquement mais moins universelle.

- **`prefers-reduced-motion` en CSS pour les animations CSS, en JS pour les animations SVG** : les animations definies en CSS (`animate-marquee`, `animate-blink`) sont desactivees par une simple media query `@media (prefers-reduced-motion: reduce) { .animate-marquee { animation: none; } }`. Les animations SVG declaratives (`<animate repeatCount="indefinite">`) ne respectent pas la media query CSS, il faut donc lire `window.matchMedia('(prefers-reduced-motion: reduce)').matches` cote React et conditionner le rendu de la balise `<animate>` ou son attribut `repeatCount`.

- **`aria-expanded` sur le bouton burger, pas sur le panneau** : le pattern WAI-ARIA disclosure attache `aria-expanded` au declencheur (le bouton), pas au panneau revele. Pattern : `<button aria-expanded={menuOpen} aria-controls="mobile-menu" aria-haspopup="true">...</button><div id="mobile-menu">...</div>`. `aria-haspopup="true"` est correct pour un menu de navigation (vs `"menu"` qui implique un menu role ARIA strict).

- **`<nav aria-label="...">` distinct sur chaque navigation** : si plusieurs `<nav>` coexistent (header + footer), chacune doit avoir un `aria-label` distinct ("Navigation principale", "Liens legaux") pour que le lecteur d'ecran puisse les distinguer dans la liste des landmarks.

- **Skip-link visible au focus, masque hors focus** : pattern standard. Class Tailwind : `sr-only focus:not-sr-only focus:absolute focus:top-4 focus:left-4 focus:z-50 focus:bg-white focus:px-4 focus:py-2 focus:rounded focus:ring-2 focus:ring-[var(--focus-ring)]`. Cible `#main-content` qui est l'attribut `id` sur l'element `<main>`. Le focus doit visuellement se voir et le clic doit reellement deplacer le focus du navigateur sur `<main>` (verifier via test manuel Tab + Enter).

- **Snapshot baseline lint plutot que `--max-warnings=0`** : le projet a deja ~30+ violations existantes (estimation audit). Mettre `--max-warnings=0` immediatement bloquerait toute la branche main. Snapshot capture le nombre actuel + on bloque uniquement le delta. Apres livraison du Lot A et du Lot B (qui resolvent la majorite), on basculera sur `--max-warnings=0`.

- **Pas de migration BDD ni de changement metier** : le Lot A est purement frontend / outillage. Aucune modification de schema Supabase, aucun nouveau server action, aucun changement de webhook, aucun email. Cela rend le rollback trivial (revert PR) en cas de regression visuelle.

## Implementation Plan

### Tasks

#### Story 2.5.1 : Outillage a11y et baseline lint

> **Note 2026-05-04** : la decomposition operationnelle detaillee de la Story 2.5.1 (avec sous-taches, scripts a creer, et adaptations npm + Vercel + ESLint v9 from-scratch) se trouve dans `_bmad-output/implementation-artifacts/2-5-1-outillage-a11y-baseline-lint.md`. Les tasks ci-dessous sont la version de cadrage initiale du tech-spec ; en cas de divergence, **la story fait foi**.

- [ ] Task 1: Installer ESLint v9 et `eslint-plugin-jsx-a11y`
  - File: `package.json`
  - Action: `npm install -D eslint eslint-plugin-jsx-a11y @eslint/js typescript-eslint`. Verifier la compat avec Next 16, React 19, TypeScript v6 et `"type": "module"`.
  - Notes: Le projet n'a **aucune** config ESLint actuellement (ni flat ni legacy). On part directement sur la flat config ESLint v9 (la moderne).

- [ ] Task 2: Creer `eslint.config.js` (flat config ESM)
  - File: `eslint.config.js` (a creer)
  - Action: Importer `jsxA11y from 'eslint-plugin-jsx-a11y'` et integrer `jsxA11y.flatConfigs.recommended` dans le tableau exporte. Cibler `**/*.{ts,tsx}`. Ignorer `.next/`, `node_modules/`, `_bmad-output/`, `_bmad/`, `public/`, `.vercel/`, `supabase/migrations/`.
  - Notes: Si une regle est trop bruyante (ex. `jsx-a11y/anchor-is-valid` avec Next `<Link>`), la desactiver explicitement avec commentaire justificatif. Tester avec `npx eslint --print-config app/layout.tsx | grep jsx-a11y`.

- [ ] Task 2b: Migrer le script `lint` du `package.json`
  - File: `package.json`
  - Action: Remplacer `"lint": "next lint"` par `"lint": "eslint . --ext .ts,.tsx,.js,.mjs"` et ajouter `"lint:fix"` (avec `--fix`) et `"lint:a11y-check"` (`node scripts/check-a11y-baseline.mjs`).
  - Notes: `next lint` est **casse sur Next 16** (`Invalid project directory: .../lint`) et deprecie. Migration obligatoire.

- [ ] Task 3: Generer le snapshot baseline des violations
  - File: `_bmad-output/test-artifacts/a11y-lint-baseline-2026-05-04.txt` (nouveau) + `scripts/build-a11y-baseline.mjs` (nouveau)
  - Action: Creer `scripts/build-a11y-baseline.mjs` (Node ESM) qui execute `eslint . --format=json` programmatiquement, filtre `messages[].ruleId` qui matchent `^jsx-a11y/`, agrege par regle et par fichier, ecrit le resultat en texte lisible avec date + commit SHA + totaux. Sortie : `_bmad-output/test-artifacts/a11y-lint-baseline-2026-05-04.txt`.
  - Notes: Bash serait fragile sur le parsing JSON ; Node ESM est portable et coherent avec le `"type": "module"` projet.

- [ ] Task 4: Wrapper CI baseline + integration Vercel
  - File: `scripts/check-a11y-baseline.mjs` (nouveau), eventuellement `vercel.json`
  - Action: Creer `scripts/check-a11y-baseline.mjs` qui compare le compteur `jsx-a11y/*` actuel au baseline et sort en code != 0 si regression. Si `next build` natif Vercel suffit (il execute ESLint si `eslint.config.js` est present), ne pas modifier `vercel.json`. Sinon, definir `buildCommand` Vercel : `"npm run lint:a11y-check && npm run build"`.
  - Notes: **Pas** de `.github/workflows/ci.yml` (le projet n'a pas de GitHub Actions, la CI = Vercel preview deployments). Approche pragmatique : commencer en `warn` partout, basculer en `error` apres livraison du Lot B.

- [ ] Task 5: Amender le template story BMad avec la DoD a11y
  - File: `.claude/skills/bmad-create-story/template.md`
  - Action: Ajouter une section "## DoD a11y" en bas du template, contenant la checklist :
    - [ ] Labels associes aux champs (`htmlFor` ou `aria-labelledby`)
    - [ ] Erreurs liees aux champs via `aria-describedby` + `aria-invalid`
    - [ ] Focus visible sur tous les elements interactifs (>= 3:1)
    - [ ] Contrastes texte >= 4,5:1 et UI >= 3:1
    - [ ] ARIA states corrects sur composants dynamiques (`aria-expanded`, etc.)
    - [ ] Navigation clavier complete (Tab, Enter, Escape, fleches selon pattern)
    - [ ] Verification ponctuelle au lecteur d'ecran (VoiceOver ou NVDA) sur le composant touche
    - [ ] Pas de regression eslint-jsx-a11y (CI verte)
  - Notes: Le template story est versionne dans `.claude/skills/bmad-create-story/template.md`. Ajouter en parallele une regle dans `CLAUDE.md` projet (sous `## Regles strictes`) pour visibilite immediate.

#### Story 2.5.2 : Skip-link et structure layout

- [ ] Task 6: Ajouter le skip-link au layout root
  - File: `app/layout.tsx`
  - Action: Ajouter en premier enfant de `<body>` (avant tout autre contenu) un lien :
    ```tsx
    <a href="#main-content" className="sr-only focus:not-sr-only focus:absolute focus:top-4 focus:left-4 focus:z-50 focus:bg-white focus:text-black focus:px-4 focus:py-2 focus:rounded focus:ring-2 focus:ring-[var(--focus-ring)]">
      Aller au contenu principal
    </a>
    ```
  - Notes: Doit etre le tout premier element focusable. Verifier au Tab depuis l'URL bar que le lien apparait avant tout autre focus.

- [ ] Task 7: Encapsuler `{children}` dans `<main id="main-content">` au layout root
  - File: `app/layout.tsx`
  - Action: Si le layout root n'enveloppe pas deja `{children}` dans un element semantique, ajouter `<main id="main-content">{children}</main>`. Si certaines pages declarent leur propre `<main>` (incoherence detectee dans l'audit §2.1), grep le code pour `<main` et soit (a) retirer ces `<main>` page-level pour ne garder que celui du layout, soit (b) garder le layout sans `<main>` et ajouter `id="main-content"` aux `<main>` existants ainsi qu'un audit pour s'assurer que **toutes** les pages en ont un.
  - Notes: Approche (a) preferee si possible : un seul `<main>` au layout, plus simple a maintenir. Verifier que aucune page ne casse visuellement (le `<main>` n'a aucun style propre, c'est un wrapper semantique).

#### Story 2.5.3 : Token de focus global et palette de contrastes

- [ ] Task 8: Definir le token `--focus-ring` dans `globals.css`
  - File: `app/globals.css`
  - Action: Dans le bloc `@theme` (ou `:root` selon Tailwind v4 setup), ajouter :
    ```css
    --focus-ring: oklch(0.4 0.15 30);
    ```
    Verifier le ratio sur blanc (>= 4,5:1 attendu) et sur `bg-accent` (>= 3:1 attendu) via WebAIM Contrast Checker. Ajuster la luminance L si le ratio est insuffisant.
  - Notes: Choisir une couleur dans la famille orange/brun pour rester coherent avec la palette kraft/accent du projet. La conversion `oklch` -> `hex` peut etre faite via outils en ligne pour fallback navigateur ancien (mais Tailwind v4 cible deja les navigateurs modernes).

- [ ] Task 9: Exposer le token Tailwind v4 et appliquer aux composants
  - File: `app/globals.css`, `components/ui/button.tsx`, `components/ui/input.tsx`
  - Action: Dans `app/globals.css`, sous le bloc `@theme { ... }` existant, ajouter `--color-focus-ring: var(--focus-ring);` (Tailwind v4 expose automatiquement la classe utilitaire `ring-focus-ring`). Sur `Button` : remplacer `focus-visible:ring-2 focus-visible:ring-offset-2` par `focus-visible:ring-2 focus-visible:ring-focus-ring focus-visible:ring-offset-2`. Sur `Input` : remplacer `focus:ring-[#FFB06E]` par `focus:ring-focus-ring focus:ring-2`.
  - Notes: **Tailwind v4 est CSS-only** sur ce projet — aucun `tailwind.config.ts`. Toute extension de theme se fait dans `@theme { ... }` de `globals.css`. Verifier visuellement le rendu sur login, dashboard, formulaire signalement.

- [ ] Task 10: Durcir les bordures de champs
  - File: `components/ui/input.tsx`, autres composants utilisant `border-gray-300`
  - Action: Grep `border-gray-300` dans le projet, remplacer par `border-gray-400` partout ou il s'agit d'une bordure de champ ou d'une separation porteuse de sens. Conserver `border-gray-300` uniquement pour les separateurs purement decoratifs (ex. divider entre sections).
  - Notes: `border-gray-400` = `oklch(0.7~)` -> ratio ~3:1 sur blanc (limite AA UI). Si le rendu est trop visuellement lourd, evaluer `border-gray-500` (>= 4:1) sur les champs critiques.

- [ ] Task 11: Corriger les couleurs d'erreur
  - File: `components/ui/input.tsx`, autres composants utilisant `text-red-500`
  - Action: Grep `text-red-500` dans le projet, remplacer par `text-red-700` partout ou il s'agit d'un message d'erreur ou d'un avertissement textuel. `text-red-500` peut rester pour les icones decoratives non porteuses de sens.
  - Notes: `text-red-700` sur blanc = ratio ~6:1, conforme WCAG AA pour texte normal.

- [ ] Task 12: Corriger `text-gray-500` sur `bg-accent`
  - File: a determiner via grep `text-gray-500` + analyse de contexte
  - Action: Pour chaque occurrence de `text-gray-500` sur fond `bg-accent` (ratio 3,4:1, FAIL), remplacer par `text-gray-700` (ratio >= 4,5:1) ou `text-black` selon le rendu desire.
  - Notes: L'audit §3 identifie cette combinaison comme FAIL. Le grep doit cibler les composants ou les classes coexistent (header sur bg-accent, FAQ sur bg-accent, etc.).

#### Story 2.5.4 : prefers-reduced-motion

- [ ] Task 13: Ajouter la media query CSS
  - File: `app/globals.css`
  - Action: Ajouter en bas du fichier :
    ```css
    @media (prefers-reduced-motion: reduce) {
      .animate-marquee,
      .animate-marquee-reverse,
      .animate-blink {
        animation: none !important;
      }
      *,
      *::before,
      *::after {
        animation-duration: 0.01ms !important;
        animation-iteration-count: 1 !important;
        transition-duration: 0.01ms !important;
        scroll-behavior: auto !important;
      }
    }
    ```
  - Notes: La regle generique `*` est une ceinture-bretelles qui couvre les animations Tailwind utilitaires (`animate-pulse`, `animate-spin`) et les transitions, sans avoir a les lister. Le `!important` est ici justifie pour passer outre toute specificite locale.

- [ ] Task 14: Conditionner les animations SVG de la carte hero
  - File: `components/landing/hero-carte.tsx`
  - Action: Convertir le composant en client component (`'use client'`) si pas deja fait. Lire `prefers-reduced-motion` :
    ```tsx
    const [reducedMotion, setReducedMotion] = useState(false)
    useEffect(() => {
      const mq = window.matchMedia('(prefers-reduced-motion: reduce)')
      setReducedMotion(mq.matches)
      const handler = (e: MediaQueryListEvent) => setReducedMotion(e.matches)
      mq.addEventListener('change', handler)
      return () => mq.removeEventListener('change', handler)
    }, [])
    ```
    Conditionner le rendu : si `reducedMotion` est `true`, ne pas rendre les balises `<animate>` (les `<circle>` restent statiques).
  - Notes: Verifier que la carte reste presentable visuellement sans animation (les pulses sont decoratifs). Tester en activant "Reduce motion" dans macOS System Preferences > Accessibility > Display.

#### Story 2.5.5 : Composant Input accessible

- [ ] Task 15: Refondre `components/ui/input.tsx`
  - File: `components/ui/input.tsx`
  - Action: Refactor complet du composant :
    1. Importer `useId` de React.
    2. Generer un id : `const fieldId = useId()` et un id derive pour l'erreur `const errorId = ${fieldId}-error`.
    3. Recevoir une prop optionnelle `id` (override pour les cas avances) : `const finalId = id ?? fieldId`.
    4. Recevoir une prop `error: string | undefined` et `required: boolean`.
    5. Generer le label avec `<label htmlFor={finalId}>{label}{required && <span className="text-gray-700"> (obligatoire)</span>}</label>`. **Retirer** l'asterisque rouge si elle existait, ou la garder en complement uniquement decoratif (`aria-hidden="true"`).
    6. Generer l'input avec `<input id={finalId} aria-invalid={!!error} aria-describedby={error ? errorId : undefined} aria-required={required || undefined} ...>`.
    7. Generer l'erreur avec `{error && <p id={errorId} role="alert" className="text-red-700 text-sm mt-1">{error}</p>}`.
    8. Conserver les classes Tailwind existantes pour le style visuel.
  - Notes: Tester sur 3-4 formulaires representatifs apres le refactor (login, signup, profil, signalement) pour s'assurer que la propagation est OK et qu'aucune prop existante n'est cassee. Le composant est pur React, pas de dependance Supabase ou autre.

- [ ] Task 16: Verifier la propagation aux formulaires
  - File: tous les fichiers utilisant `<Input>`
  - Action: Grep `from '@/components/ui/input'` (ou chemin equivalent) pour lister les usages. Pour chaque usage : verifier que la prop `error` est passee si une logique de validation existe, que la prop `required` est passee si le champ est obligatoire, et que le formulaire ne customise pas le `id` d'une maniere qui briserait le pattern. Documenter dans le PR les eventuels points d'attention.
  - Notes: Pas de modification fonctionnelle attendue cote formulaires : c'est de la verification + ajustement marginal. Si un formulaire complexe (ex. onboarding multi-etapes) utilise `Input` dans un contexte particulier, faire un test manuel rapide.

- [ ] Task 17: Tester avec un lecteur d'ecran sur 1 formulaire critique
  - File: pas de fichier modifie
  - Action: Test manuel ponctuel : ouvrir le formulaire de signalement (ou login si plus simple) avec VoiceOver/macOS, naviguer au clavier (Tab), declencher une erreur de validation, verifier que :
    1. Chaque champ annonce son label correctement.
    2. Le statut "obligatoire" est annonce.
    3. L'erreur est annoncee immediatement quand elle apparait (grace a `role="alert"`).
    4. Au focus suivant sur le champ en erreur, l'erreur est lue (grace a `aria-describedby`).
  - Notes: 5 minutes max. Documenter le resultat dans le PR (capture ou note "VoiceOver OK"). Si une regression est detectee, retravailler le pattern. Cette verification anticipe les tests manuels formels du Lot C.

#### Story 2.5.6 : Header accessible et burger

- [ ] Task 18: Ajouter `aria-expanded`, `aria-controls`, `aria-haspopup` au burger
  - File: `components/layout/accompagne-header.tsx`, `components/layout/accompagnante-header.tsx`
  - Action: Sur le bouton burger (deja dote de `aria-label="Menu"`), ajouter :
    ```tsx
    <button
      aria-label="Menu"
      aria-expanded={menuOpen}
      aria-controls="mobile-menu"
      aria-haspopup="true"
      onClick={() => setMenuOpen(!menuOpen)}
    >
    ```
    Sur le panneau mobile revele, ajouter `id="mobile-menu"`.
  - Notes: Si le panneau mobile est conditionnellement rendu (`{menuOpen && <div>...</div>}`), garder le `id` sur l'element rendu. Si toujours rendu mais cache via CSS (`hidden` ou `translate`), garder le `id` sur le wrapper.

- [ ] Task 19: Convertir les conteneurs nav en `<nav>` semantiques
  - File: `components/layout/accompagne-header.tsx`, `components/layout/accompagnante-header.tsx`, header public
  - Action: Identifier les blocs de navigation desktop actuellement en `<div>` (audit §2.6 mentionne le bloc desktop accompagne-header). Remplacer par `<nav aria-label="Navigation principale">`. Si plusieurs `<nav>` coexistent dans la page (header + footer), verifier que chacune a un `aria-label` distinct.
  - Notes: Le footer a deja un `<nav>` (audit §2.8) sans `aria-label` distinctif. Profiter de cette story pour ajouter `aria-label="Liens legaux"` au footer pour eviter la collision de landmarks. C'est une petite extension utile.

- [ ] Task 20: Verifier le contraste `text-gray-600` sur blanc dans les headers
  - File: `components/layout/accompagne-header.tsx`, `components/layout/accompagnante-header.tsx`
  - Action: L'audit §2.6 note que `text-gray-600` sur blanc = ratio 4,7:1 (limite AA). Si le header utilise cette classe pour des liens importants, evaluer le passage a `text-gray-700` (ratio ~7:1) ou `text-black` selon le rendu. C'est une amelioration optionnelle dans le cadre de Story 2.5.6, peut etre reportee en Lot B si le rendu visuel pose probleme.
  - Notes: Story 2.5.3 (Task 12) traite deja `text-gray-500` sur `bg-accent` qui est plus critique. Le 4,7:1 reste conforme AA, c'est juste limite.

### Acceptance Criteria

#### DoD a11y commune (toutes les stories Lot A)

- [ ] AC commun 1: Given une PR de story Lot A, when la CI tourne, then le job `lint` passe (pas de nouvelle violation `jsx-a11y/*` au-dela du baseline capture en Story 2.5.1).
- [ ] AC commun 2: Given un composant modifie par une story Lot A, when un developpeur consulte le composant, then les attributs `htmlFor`/`id` (formulaires), `aria-expanded`/`aria-controls` (composants dynamiques), `aria-label` (landmarks ambigus) sont presents si le composant le necessite.
- [ ] AC commun 3: Given une story Lot A en revue, when le reviewer relit la PR, then la checklist DoD a11y est presente dans la description et chaque case applicable est cochee.

#### Story 2.5.1 - Outillage

- [ ] AC 1: Given la branche post-livraison Story 2.5.1, when un developpeur execute `npm install` puis `npm run lint`, then `eslint-plugin-jsx-a11y` est installe et la sortie de lint affiche les regles `jsx-a11y/*` parmi les regles actives.
- [ ] AC 2: Given le snapshot baseline, when un developpeur le consulte, then le fichier `_bmad-output/test-artifacts/a11y-lint-baseline-2026-05-04.txt` existe et liste les violations actuelles groupees par regle et par fichier, avec un compteur total.
- [ ] AC 3: Given une PR qui introduit une nouvelle violation `jsx-a11y/label-has-associated-control` (test manuel : creer un `<input>` orphelin), when la CI tourne, then le job lint echoue ou affiche un warning visible.
- [ ] AC 4: Given le template story BMad, when un developpeur cree une nouvelle story, then le template inclut une section "DoD a11y" avec la checklist documentee.

#### Story 2.5.2 - Skip-link

- [ ] AC 5: Given un visiteur sur n'importe quelle page, when il appuie sur Tab depuis la barre d'URL, then le premier element focusable est le lien "Aller au contenu principal", visuellement distinct (fond blanc, ring focus visible).
- [ ] AC 6: Given le skip-link focus, when le visiteur appuie sur Enter, then le focus est deplace sur l'element `<main>` (verifie via `document.activeElement` ou test manuel : Tab suivant doit aller au premier element focusable de `<main>`).
- [ ] AC 7: Given le DOM rendu, when un developpeur inspecte le HTML, then il existe **un seul** `<main id="main-content">` par page (pas de duplication, pas d'absence).

#### Story 2.5.3 - Focus et palette

- [ ] AC 8: Given un utilisateur clavier sur un bouton ou un lien, when il navigue au Tab, then il voit un ring de focus visible avec un ratio >= 3:1 sur le fond local (verifie via DevTools color picker sur 3 fonds : blanc, bg-accent, bg-kraft).
- [ ] AC 9: Given un champ de formulaire au repos, when un utilisateur consulte la bordure, then la bordure utilise `border-gray-400` (ratio >= 3:1) et non `border-gray-300`.
- [ ] AC 10: Given un message d'erreur de validation, when l'utilisateur le consulte, then le texte utilise `text-red-700` (ratio >= 4,5:1) et non `text-red-500`.
- [ ] AC 11: Given du texte sur fond `bg-accent`, when l'utilisateur le consulte, then le ratio est >= 4,5:1 (aucun usage residuel de `text-gray-500` sur ce fond).

#### Story 2.5.4 - Reduced motion

- [ ] AC 12: Given un utilisateur avec "Reduce motion" active dans son OS, when il visite la landing page, then les animations marquee, blink et autres animations infinies sont arretees (pas de scintillement, pas de defilement).
- [ ] AC 13: Given un utilisateur avec "Reduce motion" active, when il visite la page hero avec la carte SVG, then les pulses animees ne sont pas rendues (les `<animate>` ne sont pas dans le DOM ou leur `repeatCount` est `0`).

#### Story 2.5.5 - Input accessible

- [ ] AC 14: Given un formulaire utilisant `<Input>`, when un developpeur inspecte le DOM, then chaque `<input>` a un `id` unique et un `<label htmlFor={id}>` correspondant.
- [ ] AC 15: Given un champ avec une prop `error`, when le DOM est inspecte, then l'`<input>` a `aria-invalid="true"` et `aria-describedby` pointant vers le `<p>` d'erreur, qui a `role="alert"`.
- [ ] AC 16: Given un champ requis (prop `required`), when un utilisateur lit le label, then il voit le suffix textuel "(obligatoire)" en plus de tout indicateur visuel (asterisque eventuelle restant decorative avec `aria-hidden`).
- [ ] AC 17: Given un test manuel VoiceOver sur le formulaire de signalement (ou login), when un utilisateur navigue au clavier et declenche une erreur, then chaque champ annonce son label, son statut requis, et l'erreur est annoncee a l'apparition.

#### Story 2.5.6 - Header

- [ ] AC 18: Given le burger menu mobile au repos (ferme), when un developpeur inspecte le DOM, then le bouton burger a `aria-expanded="false"`, `aria-controls="mobile-menu"`, `aria-haspopup="true"`.
- [ ] AC 19: Given un utilisateur ouvre le burger menu, when le panneau s'affiche, then `aria-expanded` passe a `"true"` et le panneau a `id="mobile-menu"`.
- [ ] AC 20: Given un visiteur navigue au lecteur d'ecran et liste les landmarks, when il parcourt la page, then il voit "Navigation principale" pour le header et "Liens legaux" pour le footer (deux `<nav>` distinctes par `aria-label`).

## Additional Context

### Dependencies

- **ESLint v9 + `eslint-plugin-jsx-a11y` + `@eslint/js` + `typescript-eslint`** : nouvelles devDependencies installees en Story 2.5.1 via `npm install -D ...`. Le projet n'a aucune chaine de lint actuellement (`next lint` casse sur Next 16). Pas de breaking change attendu sur le pipeline Vercel si on commence en mode `warn`.
- **Ordre de livraison** : Story 2.5.1 doit etre livree en premier (elle outille les autres). Les stories 2.5.2, 2.5.3, 2.5.4 peuvent etre livrees en parallele (couches independantes : layout, CSS palette, CSS motion). Story 2.5.5 (Input) doit attendre 2.5.3 (le `--focus-ring` est un prerequis du nouveau Input). Story 2.5.6 peut etre livree en parallele de 2.5.5.
- **Pas de dependance Stripe, Supabase, Resend** : le Lot A est purement frontend.
- **Aucune migration BDD** : le Lot A n'introduit aucun changement de schema.
- **Pas de tracking sprint formel** : aucun `sprint-status.yaml` n'existe dans `_bmad-output/implementation-artifacts/`. Les stories Lot A sont tracees uniquement via leurs fichiers individuels et l'historique git.

### Testing Strategy

Pas de tests automatises a11y dans le cadre du Lot A (c'est l'objet du Lot C). Verification manuelle :

- **Story 2.5.1 (lint)** : `npm run lint` doit afficher la regle jsx-a11y dans la sortie. `npx eslint --print-config app/layout.tsx | grep jsx-a11y` doit lister les regles actives. Snapshot baseline genere et committe. Test de regression : ajouter un `<input>` orphelin temporaire et verifier que `npm run lint:a11y-check` retourne code != 0.
- **Story 2.5.2 (skip-link)** : test clavier manuel sur 3 pages (landing, dashboard accompagnante, profil). Tab depuis URL bar > skip-link visible > Enter > focus sur `<main>`.
- **Story 2.5.3 (focus + palette)** : test clavier sur tous les composants UI (Button, Input, Link). Verifier visuellement que le ring de focus est visible sur fond blanc, bg-accent, bg-kraft. Verifier les changements de palette via DevTools.
- **Story 2.5.4 (reduced motion)** : activer "Reduce motion" dans macOS Accessibility settings, recharger la landing page, verifier que les marquee et la carte SVG sont statiques. Desactiver, verifier que les animations reprennent.
- **Story 2.5.5 (Input)** : inspecter le DOM de 3-4 formulaires (login, signup, profil, signalement) pour verifier la presence de `htmlFor`, `aria-invalid`, `aria-describedby`. Test manuel VoiceOver sur 1 formulaire critique (Task 17).
- **Story 2.5.6 (header)** : ouvrir le burger menu, inspecter le DOM, verifier `aria-expanded` toggle. Tester au lecteur d'ecran que les landmarks "Navigation principale" et "Liens legaux" sont annonces distinctement.
- **Verification croisee anti-regression** : tester les 4 parcours majeurs (login, onboarding aux, recherche benef, messagerie) au clavier seul apres livraison du Lot A complet pour s'assurer qu'aucun regression visuelle ou interactive n'est introduite.

### Notes

- **Pas d'emojis** dans le code et les interfaces (regle CLAUDE.md projet). Les classes Tailwind utilisees ne contiennent pas de caracteres speciaux.
- **Tailwind v4 CSS-only et oklch** : le projet est sur Tailwind v4 sans `tailwind.config.ts`. Tous les tokens (couleurs, fontes, focus ring) sont definis dans `app/globals.css` via le bloc `@theme { ... }`. Tailwind v4 supporte nativement `oklch()` ; le token `--focus-ring` peut etre defini en `oklch` directement.
- **ESLint v9 flat config** : le projet **n'avait aucune** config ESLint avant la Story 2.5.1. Cette story cree `eslint.config.js` from scratch en flat config ESM. Pas de migration legacy a faire.
- **`next lint` casse sur Next 16** : la commande `npm run lint` (qui appelait `next lint`) etait deja non-fonctionnelle avant cette story. La Story 2.5.1 migre vers `eslint . --ext .ts,.tsx,.js,.mjs` direct.
- **Snapshot baseline** : le fichier baseline est versionne dans `_bmad-output/test-artifacts/`. Il sera mis a jour apres chaque livraison de story (ou apres le Lot A complet) pour refleter les progres. Quand le baseline atteint 0 violation, basculer la CI sur `--max-warnings=0`.
- **CI = Vercel preview deployments** : pas de GitHub Actions. Le check baseline tourne soit dans `next build` (qui execute ESLint si `eslint.config.js` est present), soit en `buildCommand` Vercel custom si on veut un check delta strict.
- **Gestionnaire de paquets : npm** : toutes les commandes `pnpm ...` du tech-spec d'origine se lisent `npm run ...` ou `npm install -D ...`. Voir section « Realites projet » en tete de doc.
- **Reference NFR** : ce tech-spec implemente les criteres E1, F1, B1, A1, A2, B2, A4, C1, C2 (partiel), C3, D1 (partiel), D2 (partiel) du NFR transverse a11y du PRD. Les criteres restants seront couverts par le Lot B (epic 3) et le Lot C (epics 4-5).
- **Bloqueur epic 3** : la livraison du Lot A est un prerequis au demarrage de l'epic 3 (decision actee dans le NFR §5.10). Le sprint planning de l'epic 3 doit attendre la merge des 6 PR de stories 2.5.1 a 2.5.6.
- **Effort total** : 3,25 j-dev. Repartition : 0,5 j (2.5.1) + 0,25 j (2.5.2) + 0,75 j (2.5.3) + 0,25 j (2.5.4) + 1 j (2.5.5) + 0,5 j (2.5.6).
- **Tech debt anticipee** : les violations baseline qui ne seront pas resolues par le Lot A (ex. carte hero alternative textuelle, regions live messagerie, ARIA progressbar onboarding) sont l'objet du Lot B. Ne pas bloquer le Lot A sur ces points.

## Review Notes

- (a remplir apres review adversarial du tech-spec)
