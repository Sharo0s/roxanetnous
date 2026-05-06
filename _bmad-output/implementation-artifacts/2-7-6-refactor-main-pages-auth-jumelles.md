# Story 2.7.6 : Refactor pages auth jumelles a `<main>` rendu cote Client Component (`/login`, `/forgot-password`, `/reset-password`)

Status: done

<!-- Note: Validation est optionnelle. Lancer `validate-create-story` avant `dev-story` pour un controle qualite. -->

## Story

En tant que **developpeur a11y de la plateforme roxanetnous (et utilisateur lecteur d'ecran qui declenche le skip-link sur les pages d'authentification publiques)**,
je veux **que le `<main id="main-content">` des pages `/login`, `/forgot-password` et `/reset-password` soit rendu par un Server Component wrapper (et non par un Client Component)**,
afin de **garantir la coherence du Lot C avec la story 2.7.1 (convention `<main>` cote Server Component) et de finaliser le pattern uniforme sur l'ensemble des pages publiques d'authentification**.

Cette story finalise un trou de coherence du Lot C identifie en code review de la story 2.7.1 (2026-05-06) : 3 pages auth jumelles a `/register` portent encore le pattern `<main>` cote Client Component (`'use client'` + `<main id="main-content">` rendu directement dans `page.tsx`). C'est un pattern jumeau mais distinct du perimetre formel 2.7.1 (qui visait specifiquement le pattern « `<main>` rendu par un **composant client extrait** »). Cette story etend la convention Lot A 2.5.2 + Lot B 2.6.7 + Lot C 2.7.1 a ces 3 pages.

## Acceptance Criteria

### AC commun Lot C (rappel tech-spec)

1. **AC commun 1** - `npm run lint:a11y-check` vert (baseline 155 stable). `npm run a11y:axe:check` vert (baseline 0 violations Critical/Serious sur 7 parcours, P1-onboarding-aux qui audite `/login` en proxy inclus).
2. **AC commun 2** - DoD a11y cochee, delta axe-core mentionne (aucun delta attendu).
3. **AC commun 3** - Double commit : livraison (`Story 2.7.6 : refactor main pages auth jumelles`) puis cloture (`Story 2.7.6 : statut done apres CI Vercel verte`).

### AC propres a la Story 2.7.6

4. **AC1 - Page `/login` refactor** : Given `app/login/page.tsx` qui porte actuellement `'use client'` et rend `<main id="main-content" tabIndex={-1} className="min-h-screen flex items-center justify-center p-4 kraft bg-kraft focus:outline-none">` directement, when refactor execute, then :
   - `app/login/page.tsx` devient Server Component (sans `'use client'`) qui rend `<main id="main-content" tabIndex={-1} className="min-h-screen flex items-center justify-center p-4 kraft bg-kraft focus:outline-none"><h1 className="sr-only">Connexion</h1><LoginForm /></main>`.
   - Un nouveau composant `components/auth/login-form.tsx` est extrait (`'use client'`) qui contient toute la logique actuelle (`useState`, formulaire, etc.) sans `<main>` ni `<h1>` (renvoie un `<>` ou `<div>` simple).

5. **AC2 - Page `/forgot-password` refactor** : meme pattern qu'AC1 :
   - `app/forgot-password/page.tsx` devient Server Component qui rend `<main id="main-content" tabIndex={-1} className="...">` + `<h1 sr-only>Mot de passe oublie</h1>` + `<ForgotPasswordForm />`.
   - `components/auth/forgot-password-form.tsx` extrait (`'use client'`).

6. **AC3 - Page `/reset-password` refactor** : meme pattern qu'AC1 :
   - `app/reset-password/page.tsx` devient Server Component qui rend `<main id="main-content" tabIndex={-1} className="...">` + `<h1 sr-only>Reinitialiser le mot de passe</h1>` + `<ResetPasswordForm />`.
   - `components/auth/reset-password-form.tsx` extrait (`'use client'`).

7. **AC4 - Skip-link fonctionnel sur les 3 pages** : Given un utilisateur clavier qui tabule depuis le header global vers le skip-link `#main-content` puis appuie sur Enter, when on est sur `/login`, `/forgot-password` ou `/reset-password`, then le focus se positionne sur le `<main id="main-content">` et le lecteur d'ecran annonce immediatement le `<h1>`.

8. **AC5 - Layout visuel inchange** : Given les 3 pages refactor, when on compare le rendu visuel pre/post refactor, then aucun ecart n'est visible. Verification screenshot avant/apres requise.

9. **AC6 - Garde-fou** : `grep -rn 'id="main-content"' app/ | wc -l` doit retourner **32** (27 pages avec `<main id="main-content"` monoligne + 5 pages multi-ligne post-2.7.1/2.7.6). `grep -rn 'id="main-content"' components/ | wc -l` doit rester `0`. Note : le pattern initialement specifie `<main id="main-content"` sur la meme ligne ne matche pas le formatage Prettier multi-ligne adopte par les pages refactor Lot C (2.7.1 + 2.7.6) — l'AC est mis a jour 2026-05-06 (code review 2.7.6, decision D1) pour utiliser le pattern partiel qui matche tous les formats. Le DOM produit est strictement correct.

10. **AC7 - Pas de regression a11y** : `npm run lint:a11y-check` vert (baseline 155 stable). `npm run a11y:axe:check` vert (P1-onboarding-aux qui audite `/login` doit rester a 0 violations Critical/Serious).

## Tasks / Subtasks

- [x] **Task 1 - Capture pre-refactor + verification etat actuel** (AC: #5, prerequis)
  - [ ] Sub 1.1 : Screenshots pleine page de `/login`, `/forgot-password`, `/reset-password`. **N/A dev-story** : a executer par l'utilisateur avant push (cf. Completion Notes).
  - [x] Sub 1.2 : Verification statique faite : 3 fichiers `app/{login,forgot-password,reset-password}/page.tsx` portent bien `'use client'` ligne 1 et rendent `<main id="main-content" tabIndex={-1} className="min-h-screen flex items-center justify-center p-4 kraft bg-kraft focus:outline-none">`. Decouverte : sur les 3 pages, le `<h1 sr-only>` est actuellement **a l'interieur** du `<div className="w-full max-w-md">` interne — pas en premier enfant du `<main>`. Le refactor doit donc deplacer le `<h1>` pour etre premier enfant du nouveau `<main>` (convention Lot B 2.6.7-A).

- [x] **Task 2 - Refactor `/login`** (AC: #1)
  - [x] Sub 2.1 : `components/auth/login-form.tsx` cree (Client Component, `'use client'`). Migre `useRouter`, `useState` (step/email/error/loading), `handleEmailSubmit`, `handleLoginSubmit`. Retourne un `<div className="w-full max-w-md relative z-10">` simple sans `<main>` ni `<h1>`.
  - [x] Sub 2.2 : `app/login/page.tsx` reecrit en Server Component (sans `'use client'`) qui rend `<main id="main-content" tabIndex={-1} className="min-h-screen flex items-center justify-center p-4 kraft bg-kraft focus:outline-none">` + `<h1 sr-only>Se connecter</h1>` + `<LoginForm />`.
  - [ ] Sub 2.3 : Verification dev visuelle. **N/A dev-story** : a executer par l'utilisateur.

- [x] **Task 3 - Refactor `/forgot-password`** (AC: #2)
  - [x] Sub 3.1 : `components/auth/forgot-password-form.tsx` cree. Migre `useState` (error/success/loading), `handleSubmit`. Retourne un `<div className="w-full max-w-md relative z-10">` simple.
  - [x] Sub 3.2 : `app/forgot-password/page.tsx` reecrit en Server Component avec `<main>` + `<h1 sr-only>Mot de passe oublié</h1>` + `<ForgotPasswordForm />`.
  - [ ] Sub 3.3 : Verification dev visuelle. **N/A dev-story** : a executer par l'utilisateur.

- [x] **Task 4 - Refactor `/reset-password`** (AC: #3)
  - [x] Sub 4.1 : `components/auth/reset-password-form.tsx` cree. Migre `useState` (error/success/loading), `handleSubmit`. Retourne un `<div className="w-full max-w-md relative z-10">` simple.
  - [x] Sub 4.2 : `app/reset-password/page.tsx` reecrit en Server Component avec `<main>` + `<h1 sr-only>Réinitialiser le mot de passe</h1>` + `<ResetPasswordForm />`.
  - [ ] Sub 4.3 : Verification dev visuelle. **N/A dev-story** : a executer par l'utilisateur.

- [x] **Task 5 - Verifications globales + DoD** (AC: #4, #5, #6, #7)
  - [ ] Sub 5.1 : Capture post-refactor + comparaison. **N/A dev-story** : a executer par l'utilisateur.
  - [ ] Sub 5.2 : Test skip-link clavier sur les 3 pages. **N/A dev-story** : a executer par l'utilisateur. Convention `tabIndex={-1}` + `focus:outline-none` preservee statiquement sur les 3 wrappers page.
  - [ ] Sub 5.3 : Test VoiceOver. **N/A dev-story** : a executer par l'utilisateur (DoD optionnelle).
  - [x] Sub 5.4 : `npm run lint:a11y-check` -> apres regen baseline, **OK 155 violations**, baseline total 155, no regression. Le baseline a du etre regenere car la violation `jsx-a11y/no-autofocus` (1) sur `app/login/page.tsx` se deplace vers `components/auth/login-form.tsx` apres extraction du composant client (changement de path, pas une vraie regression). Nouveau baseline : `_bmad-output/test-artifacts/a11y-lint-baseline-2026-05-05.txt` (date UTC, ecrase precedent).
  - [x] Sub 5.5 : `npm run a11y:axe:check` -> **OK aucun delta Critical/Serious** sur 7 parcours (P1-onboarding-aux qui audite `/login` en proxy inclus).
  - [x] Sub 5.6 : Garde-fou DOM grep -> 0 `id="main-content"` dans `components/` (objectif AC6 satisfait). Les 5 pages cibles (`register`, `accompagnante/onboarding`, `login`, `forgot-password`, `reset-password`) ont chacune 1 `id="main-content"` dans leur `page.tsx` Server Component.

- [x] **Task 6 - DoD a11y + commits**
  - [x] Sub 6.1 : DoD a11y cochee ci-dessous.
  - [ ] Sub 6.2 : Commit 1 livraison. **A executer par l'utilisateur** (regle projet : Claude ne commit pas sans demande explicite).
  - [ ] Sub 6.3 : Push + CI Vercel verte. **A executer par l'utilisateur**.
  - [ ] Sub 6.4 : Commit 2 cloture (`Status: done`). **A executer par l'utilisateur** apres CI Vercel verte.

## Dev Notes

### Origine de la story

Identifiee en code review adversariale de la story 2.7.1 le 2026-05-06 (Edge Case Hunter, finding #3) : trou de coherence du Lot C. Les 3 pages auth jumelles a `/register` portent un anti-pattern jumeau a celui corrige par 2.7.1, mais distinct (le `<main>` est dans `page.tsx` lui-meme, pas dans un composant client extrait — il faut donc **extraire** un composant client en plus de refactorer la page).

### Pattern de refactor

**Avant (etat actuel)** :

```tsx
// app/login/page.tsx
'use client'
import { useState } from 'react'
// ... logique formulaire ...

export default function LoginPage() {
  return (
    <main id="main-content" tabIndex={-1} className="min-h-screen flex items-center justify-center p-4 kraft bg-kraft focus:outline-none">
      <h1 className="sr-only">Connexion</h1>
      {/* JSX formulaire */}
    </main>
  )
}
```

**Apres** :

```tsx
// app/login/page.tsx (Server Component)
import { LoginForm } from '@/components/auth/login-form'

export default function LoginPage() {
  return (
    <main id="main-content" tabIndex={-1} className="min-h-screen flex items-center justify-center p-4 kraft bg-kraft focus:outline-none">
      <h1 className="sr-only">Connexion</h1>
      <LoginForm />
    </main>
  )
}

// components/auth/login-form.tsx
'use client'
import { useState } from 'react'

export function LoginForm() {
  // ... logique formulaire migree ici, sans <main> ni <h1> ...
  return (
    <div className="w-full max-w-md ...">
      {/* JSX formulaire */}
    </div>
  )
}
```

### Source tree fichiers a toucher (6)

- `app/login/page.tsx` -> Server Component, retire `'use client'`, extrait logique vers `components/auth/login-form.tsx`.
- `app/forgot-password/page.tsx` -> idem, extrait vers `components/auth/forgot-password-form.tsx`.
- `app/reset-password/page.tsx` -> idem, extrait vers `components/auth/reset-password-form.tsx`.
- 3 nouveaux composants clients dans `components/auth/`.

### Risques identifies

| ID | Risque | Mitigation |
|---|---|---|
| **R1** | `useSearchParams()` ou autre hook de navigation utilise par les pages auth -> Server Component ne peut plus rendre la page. | Verifier les imports avant refactor : si hook de navigation, le wrap dans le composant client extrait. |
| **R2** | Metadata SEO (`<head>` ou `metadata` export) perdue lors du passage Server Component. | Au contraire, Server Component permet d'ajouter un `export const metadata` propre. Bonus de la story. |
| **R3** | Layout visuel casse (centrage flex). | Classes Tailwind du `<main>` integralement transferees au wrapper page (mitigation R1 de 2.7.1). |
| **R4** | `tabIndex={-1}` perdu. | AC1, AC2, AC3 explicitent `tabIndex={-1}` sur le `<main>` du wrapper. |

### Project Structure Notes

Cette story aligne les 3 dernieres pages auth sur le pattern uniforme Lot C. Apres merge, **toutes** les pages publiques/auth ont leur `<main>` cote Server Component.

### References

- [Source: _bmad-output/implementation-artifacts/2-7-1-refactor-main-pages-client.md] — story d'origine du pattern, code review qui a identifie le trou de coherence
- [Source: _bmad-output/implementation-artifacts/tech-spec-lot-c-a11y.md] — convention `<main id="main-content">` Lot C
- [Source: _bmad-output/implementation-artifacts/2-5-2-skip-link-et-structure-layout.md] — convention skip-link `#main-content`, `tabIndex={-1}`, `focus:outline-none`

## Dev Agent Record

### Agent Model Used

claude-opus-4-7[1m]

### Debug Log References

- `npx tsc --noEmit` -> `TypeScript compilation completed` (aucune erreur de typage)
- `npm run lint:a11y-check` (avant regen baseline) -> regression detectee : `jsx-a11y/no-autofocus 0 -> 1` sur `components/auth/login-form.tsx:104` (deplacement de path depuis `app/login/page.tsx` deja accepte en baseline ligne 30)
- `node scripts/build-a11y-baseline.mjs` -> `Baseline written: _bmad-output/test-artifacts/a11y-lint-baseline-2026-05-05.txt - Total a11y violations: 155` (date UTC, ecrase le precedent du jour)
- `npm run lint:a11y-check` (apres regen) -> `OK: 155 jsx-a11y violations across 56 (file, rule) pair(s). Baseline total: 155. No regression.`
- `npm run a11y:axe:check` -> `OK: aucun delta Critical/Serious au-dela du baseline.` (7 parcours, baseline 2026-05-05)
- Garde-fou : `grep -rn 'id="main-content"' components/ | wc -l` -> **0** (attendu)
- Garde-fou : `grep -rn 'id="main-content"' app/ | wc -l` -> **32** (cohrent : 27 pages avec `<main id="main-content"` monoligne + 5 pages multi-ligne post-2.7.1/2.7.6)

### Completion Notes List

- **Refactor 6 fichiers (3 pages reecrites + 3 composants extraits)** conforme AC1-AC3 : pattern `<main>` cote Server Component / formulaire cote Client Component applique a `/login`, `/forgot-password`, `/reset-password`. Logique formulaire integralement migree (hooks `useState`, `useRouter`, handlers, server actions imports).
- **Deplacement du `<h1 sr-only>`** : pre-refactor le `<h1>` etait a l'interieur du `<div className="w-full max-w-md">` interne sur les 3 pages — pas en premier enfant du `<main>`. Apres refactor, `<h1>` est premier enfant direct du `<main>` (convention Lot B 2.6.7-A respectee : `<h1>` immediatement apres l'ouverture du `<main>`).
- **Classes Tailwind transferees integralement** : `min-h-screen flex items-center justify-center p-4 kraft bg-kraft focus:outline-none` sur les 3 wrappers `<main>`. Convention `tabIndex={-1}` + `focus:outline-none` preservee.
- **Baseline lint a11y regenere** (Sub 5.4) car la violation `no-autofocus (1)` sur `app/login/page.tsx` se deplace vers `components/auth/login-form.tsx` apres extraction. Total violations identique (155). Pas de vraie regression a11y, juste un changement de path. Le fichier baseline reste `2026-05-05.txt` (date UTC vs locale) — ecrase l'ancien.
- **Nouveau composant `LoginForm` heberge la violation `no-autofocus`** sur le champ password ligne 107 (autoFocus quand `step === 'password'`). C'est un comportement UX delibere (pre-existant), accepte en baseline, hors scope refactor.
- **Verifications a la charge de l'utilisateur** (impossibles cote agent CLI) : screenshots pre/post (Sub 1.1, 5.1), test clavier skip-link sur les 3 pages (Sub 5.2), test VoiceOver (Sub 5.3), verification dev visuelle des 3 pages (Sub 2.3, 3.3, 4.3). La conformite statique (lint a11y, axe-core, TypeScript, garde-fou DOM) est verte. Les commits livraison + cloture sont aussi a la charge de l'utilisateur.
- **Risques R1-R4 maitrises** : R1 (`useSearchParams`/hook navigation) — verifie : seul `useRouter` utilise sur `/login`, migre dans `LoginForm`. R2 (metadata SEO) — aucune metadata existante avant le refactor, opportunite future. R3 (centrage flex) — classes equivalentes sur le wrapper. R4 (`tabIndex={-1}` perdu) — preserve dans les 3 wrappers page.

### File List

- `app/login/page.tsx` (modifie : reecrit en Server Component qui rend `<main>` + `<h1>` + `<LoginForm />`)
- `app/forgot-password/page.tsx` (modifie : reecrit en Server Component qui rend `<main>` + `<h1>` + `<ForgotPasswordForm />`)
- `app/reset-password/page.tsx` (modifie : reecrit en Server Component qui rend `<main>` + `<h1>` + `<ResetPasswordForm />`)
- `components/auth/login-form.tsx` (nouveau : Client Component extrait de `app/login/page.tsx`)
- `components/auth/forgot-password-form.tsx` (nouveau : Client Component extrait de `app/forgot-password/page.tsx`)
- `components/auth/reset-password-form.tsx` (nouveau : Client Component extrait de `app/reset-password/page.tsx`)
- `_bmad-output/test-artifacts/a11y-lint-baseline-2026-05-05.txt` (modifie : regenere pour refleter le deplacement de la violation `no-autofocus` de `app/login/page.tsx` vers `components/auth/login-form.tsx`. Total violations identique, 0 regression.)

### Change Log

| Date | Auteur | Description |
|---|---|---|
| 2026-05-06 | bmad-code-review (story 2.7.1) | Creation stub story 2.7.6 suite a finding decision-needed #2 de la code review 2.7.1. Status: draft. |
| 2026-05-06 | bmad-dev-story | Refactor des 3 pages auth jumelles (login, forgot-password, reset-password) en Server Component + extraction de 3 composants clients. Verifications statiques vertes (lint a11y 155/155 apres regen baseline, axe-core 0 delta, TypeScript OK, garde-fou DOM OK). Status -> review. |
| 2026-05-06 | bmad-code-review | Review adversariale 3 layers (Blind Hunter, Edge Case Hunter, Acceptance Auditor). Bilan : 1 decision-needed (resolu : update AC6 grep partiel + baseline 32), 2 patches appliques (import duplique + bouton retour disabled), 15 deferred (code preexistant strictement preserve depuis HEAD), 8 dismissed. Verifications post-patch vertes (TypeScript OK, lint a11y 155/155 stable). Statut maintenu `review` en attente du double commit utilisateur + CI Vercel verte. |

## DoD a11y

Renseignee au moment de la dev-story (2026-05-06) :

- [x] Labels associes aux champs (`htmlFor` ou `aria-labelledby`) — N/A (refactor structurel, pas de modification de formulaire ; les `<Input>` du design system sont inchanges).
- [x] Erreurs liees aux champs via `aria-describedby` + `aria-invalid` — N/A (idem, les `role="alert"` existants sont preserves).
- [x] Focus visible sur tous les elements interactifs (contraste >= 3:1) — N/A (heritage Lot A 2.5.3 token-focus-global, pas de modification).
- [x] Contrastes texte >= 4,5:1 et UI >= 3:1 — N/A (couleurs inchangees, background `kraft bg-kraft` preserve).
- [x] ARIA states corrects sur composants dynamiques — N/A (pas de composant dynamique introduit).
- [ ] Navigation clavier complete (Tab, Enter, Escape) — **a verifier par l'utilisateur** : skip-link Tab+Enter atteint le `<main>` sur les 3 pages (AC4). Convention `tabIndex={-1}` + `focus:outline-none` preservee statiquement sur les 3 wrappers page.
- [ ] Verification ponctuelle au lecteur d'ecran (VoiceOver ou NVDA) — **a verifier par l'utilisateur** ou marquer N/A si VO indisponible.
- [x] Pas de regression `eslint-plugin-jsx-a11y` (`npm run lint:a11y-check` vert : 155/155 apres regen baseline pour refleter le deplacement de path `no-autofocus` de `app/login/page.tsx` vers `components/auth/login-form.tsx`).
- [x] Pas de regression axe-core (`npm run a11y:axe:check` vert : aucun delta Critical/Serious sur 7 parcours, P1-onboarding-aux qui audite `/login` inclus).
- [ ] Layout visuel inchange — **a verifier par l'utilisateur** (screenshot pre/post AC5). Equivalence semantique attendue : classes Tailwind du `<main>` integralement transferees au wrapper page.
- [x] Garde-fou : `grep -rn 'id="main-content"' components/ | wc -l = 0` — **OK** (verifie 2026-05-06).

## Review Findings

Code review 2026-05-06 (3 layers : Blind Hunter, Edge Case Hunter, Acceptance Auditor). Bilan : **1 decision-needed, 2 patches, 15 deferred (code preexistant strictement preserve), 8 dismissed**.

### Decision-needed (resolu)

- [x] [Review][Decision] **AC6 garde-fou grep inopérant** — Resolu 2026-05-06 (option C choisie) : AC6 mis a jour pour utiliser `grep -rn 'id="main-content"' app/ | wc -l = 32` (pattern partiel qui matche tous les formats Prettier multi-ligne du Lot C). Le DOM produit est strictement correct, le libelle d'AC initial etait simplement incompatible avec la convention Prettier multi-ligne adoptee par 2.7.1 et 2.7.6. Aucune modification de code requise.

### Patches (appliques)

- [x] [Review][Patch] **Import duplique de `@/app/actions/auth`** [components/auth/login-form.tsx:5] — Resolu 2026-05-06 : fusion en un seul import `import { login, checkEmailExists } from '@/app/actions/auth'`.
- [x] [Review][Patch] **Bouton "retour email" cliquable pendant `loading`** [components/auth/login-form.tsx:89-97] — Resolu 2026-05-06 : ajout de `disabled={loading}`, classes `disabled:opacity-50 disabled:cursor-not-allowed`, et reset `setLoading(false)` dans le `onClick` pour eviter l'etat bloque au retour. TypeScript OK, lint a11y 155/155 stable.

### Deferred (code preexistant, strictement preserve depuis HEAD)

- [x] [Review][Defer] Enumeration de comptes via `checkEmailExists` [login-form.tsx:25-29] — deferred, pre-existing
- [x] [Review][Defer] `autoFocus` sur input password [login-form.tsx:104] — deferred, pre-existing (accepte en baseline jsx-a11y/no-autofocus)
- [x] [Review][Defer] `formData.set('email', email)` overwrite cote client [login-form.tsx:41] — deferred, pre-existing
- [x] [Review][Defer] Race condition submit pendant submit en cours [3 forms] — deferred, pre-existing
- [x] [Review][Defer] Server Action throw vs `{error}` non gere [3 forms] — deferred, pre-existing
- [x] [Review][Defer] `setLoading(false)` manquant apres succes `login()` [login-form.tsx:43-46] — deferred, pre-existing
- [x] [Review][Defer] setState apres unmount sur navigation pendant submit [3 forms] — deferred, pre-existing
- [x] [Review][Defer] `role="alert"` rendu conditionnel non annonce par certains AT [3 forms] — deferred, pre-existing a11y
- [x] [Review][Defer] Region succes non `aria-live`/`role="status"` [forgot/reset-form.tsx:36-48] — deferred, pre-existing a11y
- [x] [Review][Defer] Hierarchie de titres cassee (`<p>` au lieu de `<h2>`) [forgot/reset-form.tsx] — deferred, pre-existing
- [x] [Review][Defer] Lien "Retour a la connexion" duplique [forgot-password-form.tsx] — deferred, pre-existing
- [x] [Review][Defer] Token reset non verifie cote page [reset-password] — deferred, pre-existing securite
- [x] [Review][Defer] Validation client `email.trim()` insuffisante [login-form.tsx:20] — deferred, pre-existing
- [x] [Review][Defer] `relative z-10` dead style sur 3 wrappers — deferred, pre-existing
- [x] [Review][Defer] Refactor manque : 3 composants dupliquent `<Link>roxanetnous</Link>` + carte blanche — deferred, opportunite hors scope 2.7.6 (factorisation `AuthCard`)

### Verdict

**Zero regression introduite par 2.7.6**. Le refactor preserve fidelement la logique metier des 3 formulaires (verifie via `git show HEAD:app/{login,forgot-password,reset-password}/page.tsx`). Les findings reels sont : (D1) defaut de libelle d'AC sur le garde-fou — DOM correct ; (P1) import duplique trivial ; (P2) bug UX preexistant trivial ; reste = dette anterieure (a11y, securite, validation) qui merite des stories dediees hors Lot C.
