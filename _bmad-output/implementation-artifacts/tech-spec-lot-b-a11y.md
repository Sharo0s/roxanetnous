---
title: 'Accessibilite Lot B - Conformite fonctionnelle'
slug: 'lot-b-a11y'
created: '2026-05-05'
updated: '2026-05-05'
status: 'planned'
stepsCompleted: []
package_manager: 'npm'
ci_provider: 'vercel-preview-deployments'
tech_stack: ['Next.js 16', 'React 19', 'TailwindCSS v4 (CSS-only)', 'TypeScript v6', 'ESLint v9 flat config', 'eslint-plugin-jsx-a11y', '@axe-core/playwright (a installer story 2.6.1)']
files_to_modify_summary: 'Voir inventaire-points-usage-lot-b-2026-05-05.md (annexe contractuelle)'
code_patterns: ['axe-core-playwright-baseline', 'aria-live-region-log', 'progressbar-aria-with-step-text', 'role-alert-on-error-block', 'focus-management-step-heading', 'leaflet-aria-strategy', 'h1-once-per-page']
test_patterns: ['axe-core-playwright', 'manual-screen-reader-spot-check']
prerequisite_stories: ['2.6.1 (outillage axe-core, bloquante)']
inventory_reference: '_bmad-output/planning-artifacts/inventaire-points-usage-lot-b-2026-05-05.md'
---

# Tech-Spec : Accessibilite Lot B - Conformite fonctionnelle

**Created** : 2026-05-05

## Realites projet (rappel post-Lot A)

Le Lot A (mini-epic 2.5, cloture 2026-05-05) a verifie et entrine les ecarts suivants. Toutes les stories Lot B s'y plient :

| Sujet | Realite verifiee 2026-05-05 |
|---|---|
| Gestionnaire de paquets | **npm** uniquement. Lockfile `package-lock.json`. **Jamais** `pnpm`/`yarn`/`bun`. |
| CI | Vercel preview deployments. Pas de GitHub Actions a creer. |
| Tailwind | v4 CSS-only. Tokens dans `app/globals.css` via `@theme`. Aucun `tailwind.config.ts`. |
| Lint | `npm run lint` -> ESLint flat config. `next lint` casse sur Next 16 (deprecie). |
| ESLint a11y | `eslint-plugin-jsx-a11y` actif en mode `warn` global, baseline 158, wrapper `lint:a11y-check` bloque la CI sur regression. |
| DoD a11y | Checklist obligatoire dans `.claude/skills/bmad-create-story/template.md`. |
| Module system | ESM (`"type": "module"`). Tous les scripts `.mjs`. |
| Sprint tracking | Pas de `sprint-status.yaml`. Le workflow `bmad-create-story` saute cette etape. |
| Convention commits | `Story 2.6.X : <description courte>` puis `Story 2.6.X : statut done apres CI Vercel verte`. Sobres, francais, sans emoji. |
| Tests automatises | **Aucun** au moment du Lot A. Lot B introduit Playwright/axe-core via story 2.6.1. |

## Lecons heritees du Lot A (retro 2026-05-05)

Le Lot A a tenu son perimetre (6/6 done) mais avec **+8 % d'effort** (3,5 j vs 3,25 j prevus). Deux derives :

- **Story 2.5.2 : +60 %** (skip-link / `<main>` page-level — multi-fichiers sous-cadre).
- **Story 2.5.5 : +33 %** (composant `Input` central — divergence interne tech-spec + propagation usagers).

**Pattern degage** : les stories de **modification structurelle multi-fichiers** ou de **refonte de composant primitif diffuse** sont systematiquement sous-cadrees si l'inventaire des points d'usage n'est pas fait avant figeage.

**Reponse appliquee a ce tech-spec** :

1. **Pre-requis** : un document d'inventaire `_bmad-output/planning-artifacts/inventaire-points-usage-lot-b-2026-05-05.md` precede ce tech-spec et **fait foi** sur les decomptes de fichiers, les patterns de risque et les efforts affines. Toute estimation ci-dessous reference ce document.
2. **Synthese tasks alignee** : la table « Solution / stories » et le detail des tasks de chaque story sont **alignes ligne a ligne** sur le compteur d'effort, pour eviter la divergence interne 2.5.5.
3. **Marge integree** : +10-15 % par rapport au volume naïf, conformement au paye Lot A.
4. **Story bloquante S0** (2.6.1, outillage axe-core) avant tout travail fonctionnel. Pas d'estimation Lot B sans baseline mesuree.

## Overview

### Problem Statement

Apres livraison du Lot A, le NFR a11y transverse (`_bmad-output/test-artifacts/nfr-assessment-a11y-2026-05-04.md`) reste en statut global **CONCERNS** : 5 bloqueurs critiques sont leves (skip-link, focus visible, labels Input, erreurs Input, ARIA burger), mais 7 criteres FAIL persistent et touchent les **parcours critiques cœur produit** :

- **D3** : messagerie temps reel sans aucune region live ARIA — coeur du produit non utilisable au lecteur d'ecran.
- **D2** : progressbar onboarding aux sans semantique ARIA — parcours premium non finalisable.
- **B3** : navigation clavier inter-etapes onboarding non geree — exclusion clavier.
- **C2** complet : 23 blocs erreur inline (hors composant Input deja traite) sans `role="alert"` — erreurs muettes au lecteur d'ecran.
- **D1** : hierarchie h1 absente sur ~27 pages sur ~36 — orientation impossible.
- **D4** : Leaflet non audite — composant tiers a integrer ou neutraliser proprement.
- **A3** : carte hero SVG sans equivalent textuel — info de couverture geographique masquee.

A cela s'ajoute **AI-1 retro Lot A** : pas d'outillage axe-core/Playwright. Sans cet outillage, aucune preuve quantitative ne peut etayer la conformite annoncee, et le critere E2 du NFR reste FAIL.

### Solution

Lot B regroupe **8 stories courtes** dont 1 bloquante d'outillage et 7 fonctionnelles. Sequencement :

1. **2.6.1** outillage axe-core/Playwright — **bloquante**, demarre seule.
2. **2.6.5** + **2.6.4** en parallele apres 2.6.1 (mecaniques, faible interference).
3. **2.6.2** messagerie — criticite cœur produit, attention dediee.
4. **2.6.3** onboarding aux — modif structurelle multi-fichiers.
5. **2.6.6** Leaflet — time-boxee.
6. **2.6.7** landmarks/h1 — cloture, beneficie du scaffolding axe-core h1-rules.

| Story | Titre | Effort | Criteres NFR couverts | Pattern de risque | Reference inventaire |
|---|---|---|---|---|---|
| **2.6.1** | Outillage axe-core/Playwright et baseline | 0,75 j | E2 (partiel, 6 parcours en mode warn) | Outillage — risque Vercel build a verifier | §2.6.1 |
| **2.6.2** | Messagerie a11y (`role="log"`, `aria-live`) | 1,0 j | D3, B3 (partiel), C2 (textarea) | Composant realtime, ARIA complexe | §2.6.2 |
| **2.6.3** | Onboarding aux : progressbar + focus + erreurs | 1,0 j | D2, B3, C2 | Modif structurelle multi-fichiers (5 fichiers) | §2.6.3 |
| **2.6.4** | Erreurs inline `role="alert"` (23 fichiers) | 1,0 j | C2 (audit complet) | Multi-fichiers massif (mecanique mais volume) | §2.6.4 |
| **2.6.5** | Carte hero : alternative textuelle | 0,25 j | A3 | Story isolee sure | §2.6.5 |
| **2.6.6** | Audit Leaflet et alternative clavier | 1,0 j | D4 | Composant tiers, time-box stricte | §2.6.6 |
| **2.6.7-A** | Landmarks et h1 — pages publiques + auth (8 pages) | 0,5 j | D1 (partiel) | Multi-fichiers — zone homogene | §2.6.7 |
| **2.6.7-B** | Landmarks et h1 — dashboards accompagnante/accompagne (12 pages) | 0,5 j | D1 (partiel) | Multi-fichiers — zone homogene | §2.6.7 |
| **2.6.7-C** | Landmarks et h1 — pages admin (12 pages) | 0,25 j | D1 (partiel) | Multi-fichiers — structure repetitive | §2.6.7 |

**Total : 10 stories, 6,25 j-dev** — coherent avec estimation NFR 5-7 j-dev (haut de fourchette, marge integree). Le decoupage 2.6.7 en 3 sous-stories (decision Project Lead 2026-05-05) repond au profil de derive 2.5.2/2.5.5 sur les modifications structurelles multi-fichiers : chaque sous-story reste testable et mergeable independamment, avec un volume de fichiers maitrisable (8/12/12 vs 27 d'un bloc).

### Scope

**In Scope** :

- Installation `@playwright/test`, `@axe-core/playwright`, `axe-core` ; configuration `playwright.config.ts` ESM ; helper `runAxe` partage ; 6 specs smoke (1 par parcours critique) ; baseline JSON + wrapper `check-axe-baseline.mjs` ; integration CI Vercel en mode `warn` (sous reserve faisabilite Vercel build, sinon repli local pre-merge documente).
- Refonte messagerie : `role="log"` + `aria-live="polite"` sur la liste de messages ; `aria-label` sur `<textarea>` et bouton envoyer ; coordination annonces avec optimistic update (eviter double-annonce).
- Refonte onboarding aux : progressbar avec `role="progressbar"`, `aria-valuenow`, `aria-valuemax`, `aria-valuetext` ; gestion focus inter-etapes (heading focusable au sommet de chaque sub-step) ; `role="alert"` sur le bloc erreur du conteneur.
- Audit blocs erreur inline (23 fichiers) : ajout `role="alert"` sur les conteneurs d'erreur (`bg-red-50` / `text-red-700`).
- Carte hero : alternative textuelle adjacente (decision design : visible ou `sr-only`).
- Audit Leaflet : strategie 2 niveaux (`aria-label` sur la carte + alternative clavier confirmee via les champs ville/rayon, ou neutralisation `aria-hidden` + alternative textuelle si l'audit revele des problemes structurels).
- Hierarchie h1 unique par page : ajout sur ~27 pages, validation des 9 deja conformes.
- Mise a jour DoD a11y : ajout ligne `npm run a11y:axe:check` dans le template story.
- `CLAUDE.md` mis a jour : mention `lint:axe-check` aux cotes de `lint:a11y-check`.

**Out of Scope** (reportes Lot C) :

- Tests automatises axe-core sur **scenarios complets** (auth + clic-par-clic). Lot B se contente de specs smoke par parcours.
- Tests manuels VoiceOver/NVDA documentes.
- Page `/accessibilite` publique.
- Cible tactile 44x44 px.
- Bascule `eslint-plugin-jsx-a11y` `warn` -> `error` (apres baseline a 0).
- Bascule axe-core CI mode `warn` -> bloquant (apres stabilisation Lot B).
- Refonte ergonomique Leaflet (composant tiers — Lot B se limite a une integration a11y minimale).
- Audit complet des 27 fichiers utilisant des champs natifs `<input>/<select>/<textarea>` (refactor vers composant `Input` ou ajout `htmlFor`) — couvert progressivement par les stories metier via DoD a11y, voire story dediee Lot C.

## Context for Development

### Codebase Patterns

- **Composant `Input` partage** (`components/ui/input.tsx`) : refonte 2.5.5 deja en place avec `useId()`, `htmlFor`, `aria-describedby`, `aria-invalid`, `aria-required`, `<p role="alert">` sur l'erreur. **Pas de nouveau changement** sur ce composant en Lot B.
- **Skip-link** (`app/layout.tsx`) : actif depuis 2.5.2, pointe `#main-content` qui est ancre sur les `<main>` page-level. **A respecter** sur les nouvelles pages eventuelles ; aucune nouvelle page creee dans Lot B.
- **Token focus global** : `--focus-ring` defini dans `app/globals.css` (Lot A 2.5.3), classe Tailwind `ring-focus-ring` disponible. A reutiliser sur tout nouvel element interactif touche dans le Lot B.
- **`prefers-reduced-motion`** : media query CSS en place (Lot A 2.5.4) + JS conditionnel sur la carte hero. A ne pas casser lors de la story 2.6.5 (alternative textuelle).
- **Header + burger** : `aria-expanded`, `aria-controls`, `aria-haspopup` actifs depuis 2.5.6. A ne pas regresser.
- **Baseline lint** : 158 violations `jsx-a11y/*` admises au moment du demarrage Lot B. Toute story Lot B **doit faire baisser ou laisser stable** ce compteur (`npm run lint:a11y-check`).

### Source tree components a toucher (vue agregee)

Voir le document d'inventaire `inventaire-points-usage-lot-b-2026-05-05.md` qui fait foi. Resume :

- **Stories d'outillage et tests** : `playwright.config.ts`, `tests/a11y/**`, `scripts/build-axe-baseline.mjs`, `scripts/check-axe-baseline.mjs`, `package.json`, `.gitignore`, `CLAUDE.md`, `.claude/skills/bmad-create-story/template.md` (story 2.6.1).
- **Stories metier composant** : `components/messages/chat-window.tsx` + 2 boutons contact (2.6.2) ; `components/accompagnante/onboarding-client.tsx` + 4 sub-steps (2.6.3).
- **Story multi-fichiers** : 23 fichiers de blocs erreur inline (2.6.4) ; ~27 pages sans h1 (2.6.7).
- **Stories isolees** : `components/landing/hero-carte.tsx` (2.6.5) ; `components/ui/map-radius-inner.tsx` + 5 usagers (2.6.6).

### Testing standards

- Pas de tests unitaires ajoutes (heritage Lot A).
- Specs Playwright sous `tests/a11y/` introduites par 2.6.1, etendues par stories suivantes si besoin de smoke regression-spec dedie.
- Verification manuelle : VoiceOver macOS sur les composants modifies (au moins sur 2.6.2 messagerie et 2.6.3 onboarding aux). Pas de procedure documentee Lot B (Lot C).

### Risques transverses

| ID | Risque | Mitigation |
|---|---|---|
| **R1** | Playwright Chromium indisponible en build Vercel — empeche l'integration CI axe-core | Repli documente : audit local pre-merge, mode warn meme local. Bascule en bloquant reportee. |
| **R2** | `aria-live` messagerie cree des doubles annonces avec optimistic update | Coordination explicite : annoncer **uniquement** apres confirmation server (rollback optimiste si erreur sans annonce). Test manuel VoiceOver obligatoire avant merge 2.6.2. |
| **R3** | Heading focusable inter-etapes onboarding casse le flux clavier si mal positionne | Pattern strict `<h2 tabIndex={-1}>` au sommet de chaque sub-step, focus geste par le parent uniquement. Test manuel VoiceOver + clavier 2.6.3. |
| **R4** | Audit Leaflet revele des problemes structurels qui depassent la time-box 1 j | Time-box stricte. Si depassement detecte au mid-time, retomber sur strategie `aria-hidden` + alternative textuelle (decision documentee). |
| **R5** | h1 ajoutes sur 27 pages declenchent regression SEO | Verifier que `metadata.title` Next reste distinct du `<h1>`. Le `<h1>` peut differer de la title sans probleme SEO. |
| **R6** | Derive d'effort a la 2.5.5 sur les stories multi-fichiers (2.6.4 et 2.6.7) | Inventaire exhaustif fait. Sub-tasks « decompte fichiers post-merge >= N » comme garde-fou. Marge +10-15 % deja integree. |

## Stories detaillees

> Note : chaque story Lot B est creee sous `_bmad-output/implementation-artifacts/2-6-X-<slug>.md` au moment du `bmad-create-story`. La presente section donne le **contour AC** et le **decompte tasks** pour chaque story, aligne sur l'inventaire.

### Story 2.6.1 — Outillage axe-core/Playwright et baseline parcours critiques

**Effort** : 0,75 j-dev
**Criteres NFR couverts** : E2 (partiel, 6 parcours en mode warn).

**AC principaux** : voir story redigee `2-6-1-outillage-axe-core-playwright.md`.

**Tasks** : 10 tasks (install, config Playwright, helper runAxe, 6 specs smoke, auth-stub doc, baseline generator, check wrapper, integration CI Vercel mode warn, doc + DoD update, snapshot initial + commit).

**Pre-requis** : aucun. Story bloquante des autres.

### Story 2.6.2 — Messagerie a11y

**Effort** : 1,0 j-dev
**Criteres NFR couverts** : D3, B3 (partiel), C2 (textarea sans label).

**AC contour** :

1. **AC1** : `components/messages/chat-window.tsx` : la liste de messages est wrappee dans un conteneur `role="log" aria-live="polite" aria-relevant="additions text"` avec `aria-label="Messages avec {otherUserName}"`. Vide d'argument quand `messages.length === 0`.
2. **AC2** : `<textarea>` recoit un label associe : soit `<label htmlFor>` masque (`sr-only`) « Ecrivez votre message a {otherUserName} », soit `aria-label` equivalent. Le placeholder reste visuel.
3. **AC3** : bouton « Envoyer » (`<button>` avec icone SVG) recoit `aria-label="Envoyer le message"`. L'icone SVG passe en `aria-hidden="true"`.
4. **AC4** : annonce des nouveaux messages : seule l'insertion **confirmee server** declenche l'annonce. L'optimistic update est ajoute en silence (option : marker `data-optimistic` ignore par `aria-live`, ou utiliser `aria-relevant="additions"` qui couvre les ajouts apres mount).
5. **AC5** : focus management : apres envoi reussi, le focus revient sur la `<textarea>` (deja partiellement implemente via `inputRef.current?.focus()` ligne ~85). Verifier le comportement apres erreur : focus reste sur le textarea, message d'erreur annoncee (a definir : `role="alert"` au-dessus du composer ?).
6. **AC6** : navigation clavier sur la liste de messages : la liste est scrollable au clavier (PageUp/PageDown via focus sur le conteneur — ajouter `tabIndex={0}` au conteneur log si necessaire).
7. **AC7** : `npm run lint:a11y-check` vert. `npm run a11y:axe:check` montre 0 nouvelle Critical/Serious sur `/messages`.
8. **AC8** : test manuel VoiceOver macOS sur `/messages/[id]` documente dans le PR description (avant merge).

**Tasks** (decompte aligne sur effort 1 j) :
- T1 : ajouter ARIA `role="log"` + `aria-live="polite"` + `aria-label` sur conteneur (0,15 j).
- T2 : refondre `<textarea>` : label `sr-only` + verification `htmlFor`/id (0,15 j).
- T3 : refondre bouton envoyer : `aria-label` + `aria-hidden` sur svg (0,1 j).
- T4 : coordination optimistic update / annonce live (0,2 j) — **task la plus risquee**.
- T5 : test manuel VoiceOver + iteration (0,2 j).
- T6 : verifier les 2 boutons `contact-button.tsx` et `contact-accompagne-button.tsx` (focus, ARIA, labels) (0,1 j).
- T7 : DoD a11y + commit (0,1 j).
**Total tasks** : 1,0 j (verifie aligne).

### Story 2.6.3 — Onboarding aux : progressbar + focus + erreurs

**Effort** : 1,0 j-dev
**Criteres NFR couverts** : D2 (progressbar), B3 (focus inter-etapes), C2 (bloc erreur global).

**AC contour** :

1. **AC1** : la progress bar (4 `<div>` actuellement, lignes 142-156 de `onboarding-client.tsx`) est wrappee dans un conteneur `role="progressbar" aria-valuenow={step+1} aria-valuemin={1} aria-valuemax={STEPS.length} aria-valuetext={STEPS[step]}` accessible aux lecteurs d'ecran.
2. **AC2** : le `<p className="text-sm text-gray-500">{STEPS[step]}</p>` ligne 157 reste visible mais n'est plus le seul porteur de l'info etape.
3. **AC3** : a chaque changement d'etape (clic « Suivant » ou « Precedent »), le focus se deplace vers l'`<h2>` de l'etape suivante (positionne dans chaque sub-step `step-diplome`, `step-specialites`, `step-localisation`, `step-disponibilites`).
4. **AC4** : pattern « heading focusable » : chaque sub-step recoit un `<h2 tabIndex={-1} ref={headingRef}>` au sommet, communique au parent via callback ref ou via `useImperativeHandle`. Decision : utiliser un **ref forwarde** depuis le parent (plus simple).
5. **AC5** : le bloc erreur ligne 168-170 (`<div ...bg-red-50...>{error}</div>`) recoit `role="alert"` pour annonce immediate au lecteur d'ecran.
6. **AC6** : navigation clavier complete sur le parcours : Tab traverse logiquement les champs ; Enter / Espace activent les boutons ; pas de focus piege.
7. **AC7** : `npm run lint:a11y-check` vert ; `npm run a11y:axe:check` montre 0 nouvelle Critical/Serious sur `/accompagnante/onboarding`.
8. **AC8** : test manuel VoiceOver macOS documente dans le PR (etapes 0 -> 3, retour 1, erreur de validation, valider profil).

**Tasks** (decompte aligne sur effort 1 j) :
- T1 : ajouter `role="progressbar"` + attributs ARIA sur conteneur barres (0,1 j).
- T2 : convention heading focusable : ajouter `<h2 tabIndex={-1} ref={headingRef}>` dans les 4 sub-steps (0,3 j — multi-fichiers) ; pattern documenté dans `step-diplome.tsx` en premier comme reference.
- T3 : focus management dans `onboarding-client.tsx` : ref forwarde + `headingRef.current?.focus()` apres chaque setStep (0,2 j).
- T4 : `role="alert"` sur bloc erreur (0,05 j).
- T5 : test manuel VoiceOver + iteration (0,2 j).
- T6 : DoD a11y + commit (0,15 j).
**Total tasks** : 1,0 j (verifie aligne).

### Story 2.6.4 — Erreurs inline `role="alert"` (23 fichiers)

**Effort** : 1,0 j-dev
**Criteres NFR couverts** : C2 (audit complet hors composant Input deja traite).

**AC contour** :

1. **AC1** : tous les 23 fichiers identifies dans l'inventaire (§2.6.4) ont leur conteneur d'erreur (typiquement `<div className="...bg-red-50 border-red-200 text-red-700...">`) annote `role="alert"` quand l'erreur est conditionnellement rendue (i.e. apparait/disparait du DOM).
2. **AC2** : pour les blocs d'erreur **toujours rendus** (rare — verifier), utiliser `aria-live="polite"` et activer/desactiver via attribut, pas via `display`.
3. **AC3** : aucun double-annonce : si un composant contient deja un `<Input>` avec sa propre erreur (deja traitee 2.5.5), **ne pas** wrapper en plus le bloc d'erreur global d'un `role="alert"` qui ferait redondance avec le Input. Cas typique : `register-form.tsx`. Inspection cas par cas.
4. **AC4** : `aria-live="polite"` (pas `assertive`) — cas des longues erreurs visibles. `assertive` reserve aux erreurs bloquantes critiques (typiquement aucun cas dans le projet actuellement).
5. **AC5** : `npm run lint:a11y-check` vert. Le baseline ne baisse pas (pas de violation `jsx-a11y/*` reduite, mais pas de regression non plus).
6. **AC6** : `npm run a11y:axe:check` : delta des 6 parcours documente. Cible : reduction des violations `error-message` axe-core sur les parcours touches (login, register, recherche, etc.).
7. **AC7** : verification manuelle au lecteur d'ecran sur 3 parcours echantillon : `register-form` (erreur email invalide), `delete-account-button` (erreur confirmation), `contact-form` (erreur envoi).

**Tasks** (decompte aligne sur effort 1 j, mecanique mais volume) :
- T1 : grep + revue cas-par-cas des 23 fichiers ; classification « apparition/disparition » vs « toujours rendu » (0,2 j).
- T2 : appliquer `role="alert"` sur les 23 fichiers (0,4 j — mecanique).
- T3 : verifier les cas a redondance potentielle (Input + bloc global) — typiquement register-form, login (0,15 j).
- T4 : test manuel VoiceOver sur 3 parcours echantillon (0,15 j).
- T5 : DoD a11y + commit (0,1 j).
**Total tasks** : 1,0 j (verifie aligne).

**Garde-fou anti-derive** : ajouter sub-task de validation `grep -rn 'role="alert"' components app | grep -v 'ui/input.tsx' | wc -l >= 23`. Si le compteur post-merge < 23, refuser le merge.

### Story 2.6.5 — Carte hero : alternative textuelle

**Effort** : 0,25 j-dev
**Criteres NFR couverts** : A3.

**AC contour** :

1. **AC1** : un equivalent textuel adjacent au SVG `hero-carte.tsx` decrit la zone de couverture. **Decision Project Lead 2026-05-05** : texte **visible** (pas `sr-only`). Justification : la carte est centrale a la landing page et l'information de couverture geographique a une valeur pour tous les utilisateurs, pas seulement pour les utilisateurs de lecteurs d'ecran. Format suggere : sous-titre court ou liste de villes principales adjacent au SVG.
2. **AC2** : le SVG conserve `aria-hidden="true"` (decoratif) car le texte adjacent porte le sens.
3. **AC3** : `npm run lint:a11y-check` + `npm run a11y:axe:check` verts.

**Tasks** :
- T1 : ajouter le texte adjacent visible dans `hero-carte.tsx` ou son parent landing page (0,15 j).
- T2 : test rapide VoiceOver page d'accueil (0,05 j).
- T3 : DoD a11y + commit (0,05 j).
**Total tasks** : 0,25 j.

### Story 2.6.6 — Audit Leaflet et alternative clavier

**Effort** : 1,0 j-dev (time-boxe)
**Criteres NFR couverts** : D4.

**AC contour** :

1. **AC1** : un audit ecrit (0,3 j) documente les problemes a11y de `components/ui/map-radius-inner.tsx` : focus piege ? annonces ARIA polluantes ? attributs natifs Leaflet ? Output : `_bmad-output/test-artifacts/leaflet-a11y-audit-2026-05-XX.md`.
2. **AC2** : decision documentee — strategie 1 (carte interactive avec `aria-label` + alternative clavier via champs ville/rayon) ou strategie 2 (`aria-hidden="true"` + alternative textuelle).
3. **AC3** : la decision est appliquee dans `map-radius-inner.tsx` ; les 5 usagers (`profile-form.tsx`, `nouvelle-annonce-form.tsx`, `step-localisation.tsx`, `modifier-annonce-form.tsx`, `accompagne/nouvelle-annonce-form.tsx`) heritent automatiquement.
4. **AC4** : `npm run a11y:axe:check` montre que le composant n'introduit plus de violation Critical/Serious sur `/recherche` et autres parcours qui l'utilisent.
5. **AC5** : test manuel VoiceOver + clavier sur 1 page utilisant la carte (`/accompagnante/onboarding` etape localisation, ou `/recherche`).

**Tasks** (time-box stricte 1 j) :
- T1 : audit Leaflet (0,3 j).
- T2 : decision strategique + redaction note technique (0,1 j).
- T3 : implementation strategie choisie (0,3 j).
- T4 : verification 5 usagers (0,1 j).
- T5 : test manuel VoiceOver + clavier (0,15 j).
- T6 : DoD a11y + commit (0,05 j).

**Repli si depassement** : si T3 depasse 0,4 j, basculer sur strategie 2 (`aria-hidden`) sans hesiter et documenter le report d'une refonte ergonomique a Lot C.

### Story 2.6.7 — Landmarks et hierarchie h1 (decoupee en 3 sous-stories)

**Decision Project Lead 2026-05-05** : decoupage en 3 sous-stories par zone fonctionnelle (publique/auth, dashboards utilisateurs, admin) au lieu d'une story unique sur 27 pages. Justification : 27 pages d'un bloc presente le profil de derive 2.5.2/2.5.5 (multi-fichiers structurel sous-cadre). Trois zones homogenes restent testables et mergeables independamment, avec verification axe-core par lot. Total effort inchange (1,25 j cumule).

**Convention commune aux 3 sous-stories** :

- Chaque page de la zone expose un et un seul `<h1>` au sommet de son contenu principal.
- Pour les pages dashboard, le h1 peut etre visuellement discret (`sr-only` ou taille reduite) mais structurellement present.
- Aucun saut de niveau (pas de h3 sans h2). Verification axe-core sur les pages de la zone.
- Le `<h1>` n'est pas necessairement identique au `metadata.title` Next. Convention : `<h1>` = description courte du contenu, `metadata.title` = SEO-friendly.
- `npm run lint:a11y-check` vert. `npm run a11y:axe:check` : violations `page-has-heading-one` et `heading-order` reduites a 0 sur les pages de la zone.
- Verification cumulative en fin de zone : `find app/<zone> -name 'page.tsx' | xargs grep -L '<h1' | wc -l == 0`.
- Garde-fou anti-derive : compteur de pages corrigees coche dans le PR (8/8, 12/12, 12/12).

#### Story 2.6.7-A — Pages publiques + auth (8 pages)

**Effort** : 0,5 j-dev

**Pages cibles** :
- `app/messages/page.tsx`, `app/messages/[id]/page.tsx` (2)
- `app/favoris/page.tsx` (1)
- `app/recherche/page.tsx`, `app/recherche/demandes/page.tsx`, `app/recherche/[id]/page.tsx` (3)
- `app/register/page.tsx`, `app/login/page.tsx` (2)
- `app/forgot-password/page.tsx`, `app/reset-password/page.tsx` (2)

Verifier : page d'accueil `app/page.tsx`, `app/not-found.tsx` et pages legales (`/cgu`, `/mentions-legales`, `/politique-de-confidentialite`) ont deja un h1 — pas de modification, juste validation. Les pages a corriger sont les 10 listees.

**Note** : la liste depasse legerement les « 8 pages » initiales annoncees dans l'inventaire (cf. inventaire §2.6.7) — recompte exhaustif effectue lors du decoupage. Effort 0,5 j tient compte de ce recompte.

**Tasks** :
- T1 : ajouter h1 sur les 10 pages publiques + auth (0,3 j).
- T2 : verification axe-core sur parcours P2 (recherche), P4 (inscription/login), P5 (landing — verif non-regression) (0,1 j).
- T3 : DoD a11y + commit (0,1 j).

#### Story 2.6.7-B — Pages dashboards accompagnante/accompagne (12 pages)

**Effort** : 0,5 j-dev

**Pages cibles** :
- Accompagnante : `profil`, `dashboard`, `annonces`, `annonces/nouvelle`, `abonnement`, `onboarding` (6)
- Accompagne : `profil`, `dashboard`, `annonces`, `annonces/nouvelle`, `abonnement` (5)
- Total : 11 pages a corriger. Les 2 pages `abonnement/success` (1 par role) ont deja un h1 (validees inventaire) — pas de modification.

**Tasks** :
- T1 : ajouter h1 sur les 11 pages dashboard utilisateurs (0,3 j).
- T2 : verification axe-core sur parcours P1 (onboarding aux), P3 (messagerie via dashboard), P6 (suppression compte) (0,1 j).
- T3 : DoD a11y + commit (0,1 j).

#### Story 2.6.7-C — Pages admin (12 pages, structure repetitive)

**Effort** : 0,25 j-dev

**Pages cibles** :
- `app/admin/page.tsx` (dashboard admin)
- `app/admin/historique/page.tsx`
- `app/admin/messages/page.tsx`, `app/admin/messages/[id]/page.tsx`
- `app/admin/parrainages/page.tsx`, `app/admin/parrainages/blacklist/page.tsx`
- `app/admin/annonces/page.tsx`
- `app/admin/signalements/page.tsx`
- `app/admin/utilisateurs/page.tsx`, `app/admin/utilisateurs/[id]/page.tsx`
- `app/admin/validation/[id]/page.tsx`
- Total : 11 pages a corriger. `app/admin/departements/page.tsx` a deja un h1 — pas de modification.

**Tasks** (effort reduit grace a la structure repetitive admin) :
- T1 : ajouter h1 sur les 11 pages admin (0,15 j — pattern uniforme attendu).
- T2 : verification axe-core ciblee admin (sans parcours critique formel — les pages admin ne sont pas dans les 6 parcours mais le critere D1 reste applicable) (0,05 j).
- T3 : DoD a11y + commit (0,05 j).

**Note de cloture Lot B** : la 2.6.7-C etant la derniere story du Lot B, elle inclut une etape supplementaire optionnelle de **bilan global** : re-run de `npm run a11y:axe:check` sur les 6 parcours critiques pour mesurer la baisse cumulee des violations Critical+Serious vs baseline initial du 2.6.1. Ce bilan alimente directement le re-run NFR post-Lot B.

**Garde-fou anti-derive global 2.6.7** : a la cloture de la 2.6.7-C, executer `find app -name 'page.tsx' | xargs grep -L '<h1' | wc -l` — doit retourner 0. Si > 0, identifier les pages oubliees et creer une story corrective avant marquage Lot B done.

## Sequencement et dependances

```
2.6.1 (S0 outillage) ────┐
                         ├─ bloque toutes les autres
2.6.5 (hero) ────────────┤
2.6.4 (role=alert) ──────┤
2.6.2 (messagerie) ──────┤   parallelisables apres 2.6.1
2.6.3 (onboarding) ──────┤
2.6.6 (Leaflet) ─────────┤
2.6.7-A (h1 publiques) ──┤
2.6.7-B (h1 dashboards) ─┤   beneficient du scaffolding axe-core
2.6.7-C (h1 admin) ──────┘
```

**Ordre conseille (sequential pour solo-dev, 10 stories)** :
1. 2.6.1 (S0 outillage)
2. 2.6.5 (rapide, sans interference, gain rapide axe-core)
3. 2.6.4 (mecanique, pose les bases C2)
4. 2.6.2 (criticite cœur produit)
5. 2.6.3 (modif structurelle)
6. 2.6.6 (time-boxee, ne demarre que si etape 5 finie pour eviter accumulation de risque)
7. 2.6.7-A (h1 publiques + auth, premiere des 3 sous-stories h1)
8. 2.6.7-B (h1 dashboards utilisateurs)
9. 2.6.7-C (h1 admin, cloture Lot B avec bilan global axe-core)

**Independance des 3 sous-stories 2.6.7-A/B/C** : les 3 zones ne se chevauchent pas (publique/auth, dashboards utilisateurs, admin). Elles peuvent etre faites dans n'importe quel ordre relatif et sont mergeables independamment, ce qui evite l'effet « big bang » d'une PR de 27 fichiers.

## Conventions par story

- 1 branche par story : `story-2-6-X-<slug-court>`.
- Double commit obligatoire (heritage Lot A D4 retro) :
  - `Story 2.6.X : <description courte>` (livraison),
  - `Story 2.6.X : statut done apres CI Vercel verte` (cloture).
- DoD a11y cochee dans le PR description.
- `npm run lint:a11y-check` et `npm run a11y:axe:check` verts (ou delta documente avec justification).

## Pre-requis avant demarrage Lot B

1. **Cloture Lot A** : verifie (mini-epic 2.5 done 2026-05-05).
2. **Inventaire des points d'usage** : verifie (`inventaire-points-usage-lot-b-2026-05-05.md` cree 2026-05-05).
3. **Tech-spec valide** : present document.
4. **Story 2.6.1 redigee** : verifie (`2-6-1-outillage-axe-core-playwright.md` cree 2026-05-05).
5. **Pas d'autre travail en parallele sur les fichiers cibles** (eviter les conflits de merge surtout sur 2.6.4 et 2.6.7 multi-fichiers).

## Evaluation post-Lot B

Apres livraison des 8 stories, **re-run `bmad-testarch-nfr`** pour mettre a jour le scoring du NFR. Cibles attendues :

| Critere | Avant Lot A | Avant Lot B (=apres Lot A) | Apres Lot B (cible) |
|---|---|---|---|
| Total criteres ≥ CONCERNS | 8/22 (36 %) | 14/22 (64 %) | 19/22 (86 %) |
| Bloqueurs critiques | 5 | 0 | 0 |
| FAIL residuels | 13 | 7 | 2 (E2 cible 6 parcours scenarios complets, F2 page declaration) |

**Statut global cible apres Lot B** : ⚠️ CONCERNS proche de PASS, prerequis Lot C pour PASS final.

## References

- [Source: _bmad-output/planning-artifacts/inventaire-points-usage-lot-b-2026-05-05.md] — annexe contractuelle (decompte fichiers, patterns de risque, efforts affines)
- [Source: _bmad-output/implementation-artifacts/2-6-1-outillage-axe-core-playwright.md] — story S0 redigee
- [Source: _bmad-output/implementation-artifacts/mini-epic-2-5-retro-2026-05-05.md] — retro Lot A, action items reportes
- [Source: _bmad-output/implementation-artifacts/tech-spec-lot-a-a11y.md#Realites-projet] — conventions projet (npm, Vercel, Tailwind v4, ESM, ESLint flat config)
- [Source: _bmad-output/test-artifacts/nfr-assessment-a11y-2026-05-04.md#5.4-actions-recommandees] — calendrier Lot A/B/C, criteres E2, D3, D2, B3, C2, D1, D4, A3
- [Source: _bmad-output/planning-artifacts/audit-a11y-2026-05-04.md] — audit source
- [Source: _bmad-output/planning-artifacts/prd.md#Accessibilite-NFR-transverse] — NFR formalise au PRD (commit 1ae75ac)
- [Source: .claude/CLAUDE.md] — DoD a11y obligatoire, baseline lint bloquante

---

**Sign-off** : tech-spec pret pour validation Project Lead. Une fois valide :
1. `bmad-create-story` pour les 7 stories restantes (2.6.2 a 2.6.7) avec le pattern « inventaire des points d'usage » applique.
2. Demarrage 2.6.1 (S0) seul, en branche dediee.
