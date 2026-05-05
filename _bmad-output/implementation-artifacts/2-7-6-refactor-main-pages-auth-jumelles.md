# Story 2.7.6 : Refactor pages auth jumelles a `<main>` rendu cote Client Component (`/login`, `/forgot-password`, `/reset-password`)

Status: draft

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

9. **AC6 - Garde-fou** : `grep -rn '<main id="main-content"' app/ | wc -l` doit augmenter de 3 (si etait `30` apres 2.7.1, devient `33`). `grep -rn '<main id="main-content"' components/ | wc -l` doit rester `0`.

10. **AC7 - Pas de regression a11y** : `npm run lint:a11y-check` vert (baseline 155 stable). `npm run a11y:axe:check` vert (P1-onboarding-aux qui audite `/login` doit rester a 0 violations Critical/Serious).

## Tasks / Subtasks

- [ ] **Task 1 - Capture pre-refactor + verification etat actuel** (AC: #5, prerequis)
  - [ ] Sub 1.1 : Screenshots pleine page de `/login`, `/forgot-password`, `/reset-password` (a executer par l'utilisateur en dev).
  - [ ] Sub 1.2 : Verification statique : 3 fichiers `app/{login,forgot-password,reset-password}/page.tsx` portent `'use client'` ligne 1 et rendent `<main id="main-content">`.

- [ ] **Task 2 - Refactor `/login`** (AC: #1)
  - [ ] Sub 2.1 : Extraire `components/auth/login-form.tsx` (Client Component).
  - [ ] Sub 2.2 : Reecrire `app/login/page.tsx` en Server Component qui rend `<main>` + `<h1 sr-only>` + `<LoginForm />`.
  - [ ] Sub 2.3 : Verification dev visuelle.

- [ ] **Task 3 - Refactor `/forgot-password`** (AC: #2)
  - [ ] Sub 3.1 : Extraire `components/auth/forgot-password-form.tsx`.
  - [ ] Sub 3.2 : Reecrire `app/forgot-password/page.tsx` en Server Component.
  - [ ] Sub 3.3 : Verification dev visuelle.

- [ ] **Task 4 - Refactor `/reset-password`** (AC: #3)
  - [ ] Sub 4.1 : Extraire `components/auth/reset-password-form.tsx`.
  - [ ] Sub 4.2 : Reecrire `app/reset-password/page.tsx` en Server Component.
  - [ ] Sub 4.3 : Verification dev visuelle.

- [ ] **Task 5 - Verifications globales + DoD** (AC: #4, #5, #6, #7)
  - [ ] Sub 5.1 : Capture post-refactor + comparaison.
  - [ ] Sub 5.2 : Test skip-link clavier sur les 3 pages.
  - [ ] Sub 5.3 : Test VoiceOver (DoD optionnelle).
  - [ ] Sub 5.4 : `npm run lint:a11y-check` vert.
  - [ ] Sub 5.5 : `npm run a11y:axe:check` vert (P1-onboarding-aux inclus).
  - [ ] Sub 5.6 : Garde-fou DOM grep (AC6).

- [ ] **Task 6 - DoD a11y + commits**
  - [ ] Sub 6.1 : DoD a11y cochee.
  - [ ] Sub 6.2 : Commit 1 livraison.
  - [ ] Sub 6.3 : Push + CI Vercel verte.
  - [ ] Sub 6.4 : Commit 2 cloture (`Status: done`).

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

_(a remplir lors de la dev-story)_

### Debug Log References

_(a remplir lors de la dev-story)_

### Completion Notes List

_(a remplir lors de la dev-story)_

### File List

_(a remplir lors de la dev-story)_

### Change Log

| Date | Auteur | Description |
|---|---|---|
| 2026-05-06 | bmad-code-review (story 2.7.1) | Creation stub story 2.7.6 suite a finding decision-needed #2 de la code review 2.7.1. Status: draft. |

## DoD a11y

_(a renseigner lors de la dev-story)_

- [ ] Labels associes aux champs (`htmlFor` ou `aria-labelledby`).
- [ ] Erreurs liees aux champs via `aria-describedby` + `aria-invalid`.
- [ ] Focus visible sur tous les elements interactifs (contraste >= 3:1).
- [ ] Contrastes texte >= 4,5:1 et UI >= 3:1.
- [ ] ARIA states corrects sur composants dynamiques.
- [ ] Navigation clavier complete (Tab, Enter, Escape) — skip-link AC4.
- [ ] Verification ponctuelle au lecteur d'ecran (VoiceOver ou NVDA).
- [ ] Pas de regression `eslint-plugin-jsx-a11y` (`npm run lint:a11y-check` vert).
- [ ] Pas de regression axe-core (`npm run a11y:axe:check` vert, P1-onboarding-aux inclus).
- [ ] Layout visuel inchange (screenshot pre/post).
- [ ] Garde-fou : `grep -rn '<main id="main-content"' components/ | wc -l = 0`.
