# Story 2.7.1 : Refactor pages a `<main>` rendu par composant client

Status: done

<!-- Note: Validation est optionnelle. Lancer `validate-create-story` avant `dev-story` pour un controle qualite. -->

## Story

En tant que **developpeur a11y de la plateforme roxanetnous (et utilisateur lecteur d'ecran qui declenche le skip-link sur les pages publiques d'inscription et d'onboarding accompagnante)**,
je veux **que le `<main id="main-content">` soit rendu par la page wrapper Server Component (et non par le composant client enfant), avec le `<h1 sr-only>` immediatement a l'interieur**,
afin de **garantir que l'activation du skip-link `#main-content` positionne le focus juste avant le `<h1>` annoncant la page (conformite skip-link Lot A 2.5.2 + h1 unique Lot B 2.6.7)**.

Cette story finalise un compromis pragmatique du Lot B (stories 2.6.7-A et 2.6.7-B Dev Notes) ou le `<h1 sr-only>` etait place dans un fragment **avant** le `<main>` rendu par le composant client. Elle est la **premiere story du Lot C (mini-epic 2.7)** et alimentera le re-run NFR a11y post-Lot C sur le critere D1 (semantique HTML).

## Acceptance Criteria

### AC commun Lot C (rappel tech-spec)

1. **AC commun 1** - `npm run lint:a11y-check` vert (baseline 155 stable). `npm run a11y:axe:check` vert (baseline 0 violations Critical/Serious sur 7 parcours).
2. **AC commun 2** - DoD a11y cochee ci-dessous, delta axe-core mentionne (aucun delta attendu).
3. **AC commun 3** - Double commit : livraison (`Story 2.7.1 : refactor main pages register et onboarding accompagnante`) puis cloture (`Story 2.7.1 : statut done apres CI Vercel verte`).

### AC propres a la Story 2.7.1

4. **AC1 - Page register refactor** : Given `app/register/page.tsx` Server Component qui rend actuellement un fragment, when un developpeur visualise le DOM rendu sur `/register`, then la page rend `<main id="main-content" tabIndex={-1} className="min-h-screen flex items-center justify-center p-4 kraft bg-kraft focus:outline-none">` qui contient en premier enfant `<h1 className="sr-only">Créer un compte</h1>` puis `<Suspense><RegisterForm /></Suspense>`. Aucun `<main>` n'est plus rendu par `RegisterForm` (ni dans la branche par defaut ni dans la branche `emailSent`).

5. **AC2 - Composant `RegisterForm` perd ses 2 `<main>`** : Given `components/auth/register-form.tsx` qui rend actuellement un `<main>` dans 2 branches (`emailSent` et default), when le developpeur inspecte le composant apres refactor, then les 2 retours rendent un `<div className="...">` ou un `<>` (fragment) — pas de `<main>` ni de `<header>`/`<section>` semantique de remplacement. Les classes Tailwind du `<main>` actuel (`min-h-screen flex items-center justify-center p-4 kraft bg-kraft focus:outline-none`) sont **retirees** du composant client (elles passent au wrapper page).

6. **AC3 - Page onboarding accompagnante refactor** : Given `app/accompagnante/onboarding/page.tsx` Server Component qui rend actuellement un fragment, when un developpeur visualise le DOM rendu sur `/accompagnante/onboarding`, then la page rend `<main id="main-content" tabIndex={-1} className="min-h-screen kraft bg-kraft focus:outline-none">` qui contient en premier enfant `<h1 className="sr-only">Onboarding accompagnante</h1>` puis `<OnboardingClient ... />`. Aucun `<main>` n'est plus rendu par `OnboardingClient`.

7. **AC4 - Composant `OnboardingClient` perd son `<main>`** : Given `components/accompagnante/onboarding-client.tsx` qui rend actuellement un `<main>` (1 unique branche, ligne 138), when le developpeur inspecte le composant apres refactor, then le retour rend un `<>` (fragment) ou un `<div>` simple. Les classes Tailwind `min-h-screen kraft bg-kraft focus:outline-none` sont **retirees** du composant client (elles passent au wrapper page). Le `<header>` interne (ligne 139) et tous les autres elements (progressbar, formulaires, navigation) restent inchanges.

8. **AC5 - Skip-link fonctionnel** : Given un utilisateur clavier qui tabule depuis le header global vers le skip-link `#main-content` puis appuie sur Enter, when on est sur `/register` ou `/accompagnante/onboarding`, then le focus se positionne sur le `<main id="main-content">` (matrice de focus visible grace a `focus:outline-none` deliberement supprime sur l'etat focus du `<main>` — cf. `app/globals.css` skip-link), et le lecteur d'ecran annonce immediatement le `<h1>` (`Créer un compte` ou `Onboarding accompagnante`).

9. **AC6 - Layout visuel inchange** : Given les 2 pages refactor, when on compare le rendu visuel pre/post refactor, then aucun ecart n'est visible : background `kraft bg-kraft`, centrage flex `min-h-screen flex items-center justify-center p-4` pour `/register`, layout vertical `min-h-screen` pour `/accompagnante/onboarding`. **Verification screenshot avant/apres requise** (capture pre-refactor au demarrage Task 1, capture post-refactor en Task 4). Pas de regression sur l'animation `animate-fade-in`, le `<header>` interne onboarding, ni la progressbar.

10. **AC7 - Pas de regression a11y** : Given la suite Lot B, when on execute `npm run lint:a11y-check`, then exit 0 et baseline 155 (pas de nouvelle violation jsx-a11y). When on execute `npm run a11y:axe:check`, then exit 0 sur les 7 parcours dont **P4-register** doit rester a 0 violations Critical/Serious. **Note** : `/accompagnante/onboarding` n'est pas dans les 7 parcours critiques mais le critere D1 reste applicable (verification statique du DOM).

## Tasks / Subtasks

- [x] **Task 1 - Capture pre-refactor + verification etat actuel** (AC: #6, prerequis verification)
  - [ ] Sub 1.1 : `npm run dev`, naviguer sur `http://localhost:3000/register` et `http://localhost:3000/accompagnante/onboarding` (necessite session accompagnante connectee), capturer une screenshot pleine page de chacune. Stocker en local pour comparaison Task 4 (pas de commit des screenshots). **N/A dev-story** : pas d'environnement navigateur disponible cote agent. A executer par l'utilisateur avant push (cf. Completion Notes).
  - [x] Sub 1.2 : Inspecter le DOM avec DevTools : confirmer que `<main id="main-content">` est rendu par le composant client (le `<h1 sr-only>` est avant le `<main>`, hors de lui). Confirmer la presence de `tabIndex={-1}` et `focus:outline-none`. **Verifie statiquement** par lecture des 4 fichiers cibles : `app/register/page.tsx` rendait `<><h1 sr-only/><Suspense><RegisterForm/></Suspense></>`, `RegisterForm` rendait `<main id="main-content" tabIndex={-1} className="...focus:outline-none">` dans 2 branches ; idem pour `/accompagnante/onboarding`.
  - [x] Sub 1.3 : `git status` pour confirmer working tree propre avant modifications. **OK** : 2 fichiers untracked hors-scope (story file lui-meme + favicon).

- [x] **Task 2 - Refactor `/register` : page wrapper + composant** (AC: #1, #2)
  - [x] Sub 2.1 : `app/register/page.tsx` reecrit : fragment racine remplace par `<main id="main-content" tabIndex={-1} className="min-h-screen flex items-center justify-center p-4 kraft bg-kraft focus:outline-none">` avec `<h1 sr-only>Créer un compte</h1>` puis `<Suspense><RegisterForm /></Suspense>` a l'interieur.
  - [x] Sub 2.2 : `components/auth/register-form.tsx` : les 2 `<main>` (branches `emailSent` et default) sont retires. Branche `emailSent` retourne directement `<div className="w-full max-w-md text-center relative z-10">` (le `<div>` interne pre-existant fusionne avec le wrapper externe). Branche default retourne `<div className="w-full max-w-md relative z-10">` directement (idem). Indentation reformatee (-2 espaces sur tout le bloc default). Aucune autre modification.
  - [ ] Sub 2.3 : Verification dev visuelle. **N/A dev-story** : a executer par l'utilisateur (cf. Completion Notes — verification statique TS + lint OK).
  - [ ] Sub 2.4 : Verification branche `emailSent` en dev. **N/A dev-story** : idem.

- [x] **Task 3 - Refactor `/accompagnante/onboarding` : page wrapper + composant** (AC: #3, #4)
  - [x] Sub 3.1 : `app/accompagnante/onboarding/page.tsx` reecrit : fragment racine remplace par `<main id="main-content" tabIndex={-1} className="min-h-screen kraft bg-kraft focus:outline-none">` avec `<h1 sr-only>Onboarding accompagnante</h1>` puis `<OnboardingClient ... />` a l'interieur. Pas de `flex items-center justify-center p-4` (layout vertical preserve).
  - [x] Sub 3.2 : `components/accompagnante/onboarding-client.tsx` : `<main id="main-content" ...>` ligne 138 remplace par `<>`, `</main>` ligne 224 remplace par `</>`. `<header>` interne, bandeau parrainage, progressbar, formulaires inchanges.
  - [ ] Sub 3.3 : Verification dev visuelle (login accompagnante requis). **N/A dev-story** : a executer par l'utilisateur (cf. Completion Notes).

- [x] **Task 4 - Verification visuelle + skip-link + axe** (AC: #5, #6, #7)
  - [ ] Sub 4.1 : Capture post-refactor + comparaison. **N/A dev-story** : a executer par l'utilisateur. Les classes Tailwind du `<main>` sont integralement transferees au wrapper page (memes regles flex/min-h/bg) — equivalence semantique et visuelle attendue.
  - [ ] Sub 4.2 : Test skip-link clavier. **N/A dev-story** : a executer par l'utilisateur. Convention `tabIndex={-1}` + `focus:outline-none` preservee sur les wrappers `<main>`.
  - [ ] Sub 4.3 : Test VoiceOver. **N/A dev-story** : a executer par l'utilisateur (DoD : marque N/A si VO indisponible).
  - [x] Sub 4.4 : `npm run lint:a11y-check` -> **OK 155 violations** (baseline total 158, aucune regression). Conforme a l'attendu story.
  - [x] Sub 4.5 : `npm run a11y:axe:check` -> **OK aucun delta Critical/Serious** sur les 7 parcours audites (P4-register inclus).

- [x] **Task 5 - DoD a11y + commits**
  - [x] Sub 5.1 : DoD a11y cochee ci-dessous (cases applicables ou N/A justifie).
  - [ ] Sub 5.2 : Commit 1 livraison. **A executer par l'utilisateur** (regle projet : Claude ne commit pas sans demande explicite).
  - [ ] Sub 5.3 : Push + CI Vercel verte. **A executer par l'utilisateur**.
  - [ ] Sub 5.4 : Commit 2 cloture (`Status: done`). **A executer par l'utilisateur** apres CI Vercel verte.

## Dev Notes

### Patterns architecturaux

- **Convention `<main id="main-content">` Lot A 2.5.2** : la page wrapper Server Component porte le `<main>`, **pas** le composant client enfant. Cette convention est rappelee dans `tech-spec-lot-c-a11y.md` §Architecture Alignment et reaffirmee par cette story.
- **Convention `<h1 sr-only>` Lot B 2.6.7-A** : `<h1>` immediatement a l'interieur du `<main>`, en premier enfant. Cette story corrige les 2 derniers cas non conformes.
- **`focus:outline-none` du `<main>`** : conserve sur le `<main>` du wrapper page. Ce token est compatible avec le focus visible `outline` deja gere globalement par `app/globals.css` (Lot A 2.5.3 token-focus-global). La combinaison `tabIndex={-1}` + `focus:outline-none` evite un outline disgracieux quand le skip-link active le `<main>` (le `<h1>` annonce suffit).
- **Pas de nouveau composant a11y central** : le tech-spec Lot C interdit la creation d'un composant `<MainContent>` ou similaire (decision Lot B 2.6.4). Refactor en place dans les 4 fichiers.

### Pattern de refactor (rappel tech-spec §Detailed Design)

**Avant (Lot B 2.6.7-A — register)** :

```tsx
// app/register/page.tsx
return (
  <>
    <h1 className="sr-only">Créer un compte</h1>
    <Suspense><RegisterForm /></Suspense>
  </>
)

// components/auth/register-form.tsx
return (
  <main id="main-content" tabIndex={-1} className="min-h-screen flex items-center justify-center p-4 kraft bg-kraft focus:outline-none">
    <div className="w-full max-w-md relative z-10">...</div>
  </main>
)
```

**Apres (Lot C 2.7.1 — register)** :

```tsx
// app/register/page.tsx
return (
  <main id="main-content" tabIndex={-1} className="min-h-screen flex items-center justify-center p-4 kraft bg-kraft focus:outline-none">
    <h1 className="sr-only">Créer un compte</h1>
    <Suspense><RegisterForm /></Suspense>
  </main>
)

// components/auth/register-form.tsx
return (
  <>
    <div className="w-full max-w-md relative z-10">...</div>
  </>
)
```

**Idem pattern pour `/accompagnante/onboarding`** avec classes adaptees (`min-h-screen kraft bg-kraft focus:outline-none`, sans `flex items-center justify-center p-4`).

### Source tree fichiers a toucher (4)

- **app/register/page.tsx** (~13 lignes) : remplace fragment par `<main>`. Server Component (pas `'use client'`).
- **components/auth/register-form.tsx** (~415 lignes, 2 branches `<main>` aux lignes 184-212 et 214-414) : retire les 2 `<main>` au profit de fragments. `'use client'` conserve.
- **app/accompagnante/onboarding/page.tsx** (~48 lignes) : remplace fragment par `<main>`. Server Component (`async`, fetch Supabase). Pas `'use client'`.
- **components/accompagnante/onboarding-client.tsx** (~226 lignes, 1 `<main>` ligne 138, fermeture ligne 224) : retire le `<main>` au profit d'un fragment. `'use client'` conserve.

### Testing standards

- **Pas de test unitaire** ajoute (refactor structurel pur, comportement utilisateur preserve).
- **Pas de spec Playwright dediee** (pas de nouveau parcours critique). `P4-register` existe deja dans la suite Lot B 2.6.1 — il continuera de valider la page apres refactor (verification AC7).
- **Verification visuelle obligatoire** : screenshots avant/apres (Task 1 + Task 4).
- **Test clavier obligatoire** : skip-link Tab+Enter sur les 2 pages (AC5).
- **VoiceOver spot-check optionnel** mais recommande (DoD a11y projet — case « lecteur d'ecran » conventionnellement cochee si verifiee, sinon marquee N/A avec justification).

### Risques identifies

| ID | Risque | Mitigation |
|---|---|---|
| **R1** | Le centrage `flex items-center justify-center` casse cote `/register` parce que le `<main>` n'enveloppe plus directement le `<div className="w-full max-w-md">`. | Le `<main>` du wrapper page recupere ces classes — equivalent semantique exact. Verification screenshot Task 4. |
| **R2** | Branche `emailSent` du `RegisterForm` testee de facon insuffisante. | Sub 2.4 declenche le rendu (modif locale ou inscription test). |
| **R3** | `OnboardingClient` a un `<header>` interne (ligne 139) qui pourrait gener si confondu avec le header global. | Le `<header>` interne est dans le `<main>`, hierarchie HTML valide (un `<main>` peut contenir un `<header>` de section). Pas de modification. |
| **R4** | `tabIndex={-1}` perdu lors du refactor -> skip-link ne positionne plus le focus. | AC1 et AC3 explicitent `tabIndex={-1}` sur le `<main>` du wrapper. Verification Task 4 Sub 4.2. |
| **R5** | Compromis identique non identifie sur d'autres pages publiques/auth (ex. accompagne/onboarding s'il existait). | Verification : `grep -rn '<main id="main-content"' components/ \| wc -l` doit retourner **0** apres refactor (les `<main>` sont uniquement dans `app/`). |

### Project Structure Notes

- Convention projet : Server Components pour pages, `'use client'` pour les composants interactifs. Le `<main>` est une primitive de structure, pas d'interactivite — il **doit** etre cote Server Component (page wrapper).
- Pattern deja applique sur les 32+ autres pages de l'app post-Lot B (garde-fou global Lot B `find app -name 'page.tsx' \| xargs grep -L '<h1' \| wc -l = 0` + verification statique). Cette story aligne les 2 dernieres exceptions.
- `app/admin/layout.tsx` fournit deja un `<main id="main-content">` partage pour toutes les pages admin enfants — ce pattern n'est **pas** generalise aux pages publiques (`app/layout.tsx` ne rend pas de `<main>`, decision Lot A pour permettre des layouts varies par page).

### Garde-fou post-refactor

A la fin de la story, executer pour confirmer qu'aucun `<main id="main-content">` ne reste dans `components/` :

```bash
grep -rn '<main id="main-content"' components/ | wc -l
# Attendu : 0
```

Et confirmer que toutes les pages ont leur `<main>` cote `app/` :

```bash
grep -rn '<main id="main-content"' app/ | wc -l
# Attendu : >= nombre de pages utilisant le pattern (publiques + auth + accompagnante + accompagne + recherche + favoris + ...)
```

### References

- [Source: _bmad-output/implementation-artifacts/tech-spec-lot-c-a11y.md#story-271] — AC contour, pattern de refactor, Risks
- [Source: _bmad-output/planning-artifacts/inventaire-points-usage-lot-c-2026-05-06.md#271] — fichiers cibles, contexte compromis Lot B
- [Source: _bmad-output/implementation-artifacts/2-6-7-A-h1-pages-publiques-auth.md] — story d'origine du compromis (register)
- [Source: _bmad-output/implementation-artifacts/2-6-7-B-h1-dashboards-utilisateurs.md] — story d'origine du compromis (onboarding accompagnante)
- [Source: _bmad-output/implementation-artifacts/2-5-2-skip-link-et-structure-layout.md] — convention skip-link `#main-content`, `tabIndex={-1}`, `focus:outline-none`
- [Source: _bmad-output/implementation-artifacts/lot-b-bilan-axe-core-2026-05-06.md] — baseline axe-core final = 0, P4-register inclus

## Dev Agent Record

### Agent Model Used

claude-opus-4-7[1m]

### Debug Log References

- `npm run lint:a11y-check` -> `OK: 155 jsx-a11y violations across 56 (file, rule) pair(s). Baseline total: 158. No regression.` (2026-05-06)
- `npm run a11y:axe:check` -> `OK: aucun delta Critical/Serious au-dela du baseline.` (baseline 2026-05-05, 7 parcours)
- `npx tsc --noEmit` -> `TypeScript compilation completed` (aucune erreur de typage)
- Garde-fou `grep -rn '<main id="main-content"' components/ | wc -l` -> **0** (attendu)
- Garde-fou `grep -rn '<main id="main-content"' app/ | wc -l` -> **30** (>= nombre attendu de pages publiques/auth/dashboards)

### Completion Notes List

- **Refactor 4 fichiers conforme tech-spec Lot C §2.7.1** : pattern `<main>` cote Server Component / fragment cote composant client applique a `/register` (2 branches `emailSent` et default) et `/accompagnante/onboarding`.
- **Classes Tailwind transferees integralement** au wrapper page : `min-h-screen flex items-center justify-center p-4 kraft bg-kraft focus:outline-none` pour `/register`, `min-h-screen kraft bg-kraft focus:outline-none` pour `/accompagnante/onboarding`. Convention `tabIndex={-1}` + `focus:outline-none` preservee.
- **Indentation register-form.tsx reformatee** : la branche default avait une indentation incoherente (mix 8/10 espaces) heritee de l'imbrication `<main><div>` ; apres retrait du `<main>` l'arbre est reduit d'un niveau et reindente proprement (-2 espaces sur ~200 lignes).
- **Verifications a la charge de l'utilisateur** (impossibles cote agent CLI) : screenshots pre/post (Sub 1.1, 4.1), test clavier skip-link (Sub 4.2), test VoiceOver (Sub 4.3), verification visuelle dev (Sub 2.3, 2.4, 3.3). La conformite statique (lint a11y, axe-core, TypeScript, garde-fou DOM) est verte. Les commits livraison + cloture sont aussi a la charge de l'utilisateur (regle projet).
- **Risques R1-R5 maitrises** : R1 (centrage flex) — classes equivalentes sur le wrapper. R2 (branche emailSent) — verification statique du JSX retourne (div text-center wrapper). R3 (header interne onboarding) — `<header>` dans `<main>` reste valide HTML5. R4 (`tabIndex={-1}` perdu) — preserve dans les 2 wrappers page. R5 (autres pages) — garde-fou 0 dans `components/`.

### File List

- `app/register/page.tsx` (modifie : fragment racine -> `<main id="main-content">`)
- `app/accompagnante/onboarding/page.tsx` (modifie : fragment racine -> `<main id="main-content">`)
- `components/auth/register-form.tsx` (modifie : 2 `<main>` retires, indentation reformatee branche default)
- `components/accompagnante/onboarding-client.tsx` (modifie : `<main>` retire au profit de `<>`)

### Change Log

| Date | Auteur | Description |
|---|---|---|
| 2026-05-06 | bmad-create-story | Creation story 2.7.1 (Lot C, refactor pages a `<main>` rendu par composant client). |
| 2026-05-06 | bmad-dev-story | Refactor des 4 fichiers cibles (page wrappers + composants clients), verifications statiques vertes (lint a11y 155/158, axe-core 0 delta, TypeScript OK, garde-fou DOM OK). Status -> review. |

## DoD a11y

Renseignee au moment de la dev-story (2026-05-06) :

- [x] Labels associes aux champs (`htmlFor` ou `aria-labelledby`) — N/A (refactor structurel, pas de modification de formulaire).
- [x] Erreurs liees aux champs via `aria-describedby` + `aria-invalid` — N/A (idem).
- [x] Focus visible sur tous les elements interactifs (contraste >= 3:1) — N/A (heritage Lot A 2.5.3 token-focus-global, pas de modification).
- [x] Contrastes texte >= 4,5:1 et UI >= 3:1 — N/A (couleurs inchangees, background `kraft bg-kraft` preserve).
- [x] ARIA states corrects sur composants dynamiques — N/A (progressbar onboarding et autres ARIA inchanges).
- [ ] Navigation clavier complete (Tab, Enter, Escape) — **a verifier par l'utilisateur** : skip-link Tab+Enter atteint le `<main>` (AC5). Convention `tabIndex={-1}` + `focus:outline-none` preservee statiquement sur les 2 wrappers page.
- [ ] Verification ponctuelle au lecteur d'ecran (VoiceOver ou NVDA) — **a verifier par l'utilisateur** ou marquer N/A si VO indisponible.
- [x] Pas de regression `eslint-plugin-jsx-a11y` (`npm run lint:a11y-check` vert : 155/158).
- [x] Pas de regression axe-core (`npm run a11y:axe:check` vert : aucun delta Critical/Serious sur 7 parcours, P4-register inclus).
- [ ] Layout visuel inchange — **a verifier par l'utilisateur** (screenshot pre/post Task 1 vs Task 4). Equivalence semantique attendue : classes Tailwind du `<main>` integralement transferees au wrapper page.
- [x] Garde-fou : `grep -rn '<main id="main-content"' components/ | wc -l = 0` — **OK** (verifie 2026-05-06).

### Review Findings

Code review adversariale (Blind Hunter + Edge Case Hunter + Acceptance Auditor) executee 2026-05-06 sur le diff (4 fichiers, +217/-213). Acceptance Auditor : aucune finding (tous les AC verifiables (AC1-AC6) sont conformes, garde-fou §Garde-fou post-refactor satisfait, conventions §Patterns architecturaux respectees). 12 candidats bruts agreges sur les 3 layers, dont 5 dismiss (faux positifs ou choix delibere documente) et 5 defer (pre-existant ou hors scope).

- [x] [Review][Decision] Parite visuelle branche `emailSent` non validee par screenshot — **Resolution 2026-05-06** : option (a) accepter. Classes Tailwind du `<main>` originel transferees mot pour mot au wrapper `<main>` page-level (`min-h-screen flex items-center justify-center p-4 kraft bg-kraft focus:outline-none`). Equivalence semantique exacte : le `<div className="w-full max-w-md text-center relative z-10">` etait deja l'enfant unique avant refactor, devient flex-item direct du `<main>` page. Risque R2 marque maitrise dans la spec, lint a11y vert, axe-core 0 delta sur P4-register. Sub 2.4 (test manuel branche emailSent en dev) reste ouverte cote DoD a11y manuelle, a executer par l'utilisateur post-merge si pertinent.

- [x] [Review][Decision] Coherence Lot C : 3 pages auth jumelles (`login`, `forgot-password`, `reset-password`) restent en anti-pattern `<main>` cote Client Component — **Resolution 2026-05-06** : option (b) creer une story 2.7.6 dediee. Verification : `app/login/page.tsx:50`, `app/forgot-password/page.tsx:28`, `app/reset-password/page.tsx:28` portent `'use client'` et rendent toutes `<main id="main-content" tabIndex={-1}>` directement dans le `page.tsx`. Pattern jumeau mais distinct du scope formel 2.7.1 ("rendu par composant client extrait"). Story stub creee : `_bmad-output/implementation-artifacts/2-7-6-refactor-main-pages-auth-jumelles.md` (status `draft`). Discipline de scope : la story 2.7.1 reste fermee au perimetre initial (lint vert, axe vert), un AC dedie 2.7.6 force l'arbitrage Lot C (extraire un composant client par page + Server Component wrapper avec `<main>`).

- [x] [Review][Defer] `kraft bg-kraft` redondant repete sur les 2 wrappers — pre-existant, present avant le refactor sur les composants. Hors scope story 2.7.1.
- [x] [Review][Defer] `<Suspense>` sans `fallback` dans `app/register/page.tsx` — pre-existant, hors scope refactor structurel `<main>`.
- [x] [Review][Defer] Skip-link `/accompagnante/onboarding` non couvert par axe-check automatise — connu et documente dans la spec (AC7 Note explicite : page hors 7 parcours critiques).
- [x] [Review][Defer] Parite `animate-fade-in` non validee visuellement — risque theorique mineur (React diffing preserve l'identite), couvert par DoD a11y manuelle.
- [x] [Review][Defer] Pas de `.editorconfig` ni `.prettierrc` — pre-existant projet, hors scope.
