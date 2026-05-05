---
title: 'Accessibilite Lot C - Consolidation post-Lot B'
slug: 'lot-c-a11y'
created: '2026-05-06'
updated: '2026-05-06'
status: 'planned'
stepsCompleted: []
package_manager: 'npm'
ci_provider: 'vercel-preview-deployments'
tech_stack: ['Next.js 16', 'React 19', 'TailwindCSS v4 (CSS-only)', 'TypeScript v6', 'ESLint v9 flat config', 'eslint-plugin-jsx-a11y', '@axe-core/playwright']
files_to_modify_summary: 'Voir inventaire-points-usage-lot-c-2026-05-06.md (annexe contractuelle)'
code_patterns: ['main-element-in-page-wrapper', 'heading-order-h2-cards', 'public-a11y-statement-page', 'axe-check-blocking-decision', 'mini-epic-retro-document']
test_patterns: ['axe-core-playwright', 'manual-screen-reader-spot-check']
prerequisite_stories: ['Lot B 2.6 done (baseline axe-core a 0)']
inventory_reference: '_bmad-output/planning-artifacts/inventaire-points-usage-lot-c-2026-05-06.md'
---

# Tech-Spec : Accessibilite Lot C - Consolidation post-Lot B

**Created** : 2026-05-06

## Realites projet (rappel post-Lot A et Lot B)

Le Lot A (mini-epic 2.5, cloture 2026-05-05) et le Lot B (mini-epic 2.6, cloture 2026-05-06) ont entrine les ecarts suivants. Toutes les stories Lot C s'y plient :

| Sujet | Realite verifiee 2026-05-06 |
|---|---|
| Gestionnaire de paquets | **npm** uniquement. Lockfile `package-lock.json`. |
| CI | Vercel preview deployments. Pas de GitHub Actions a creer. |
| Tailwind | v4 CSS-only. Tokens dans `app/globals.css` via `@theme`. |
| Lint | `npm run lint` -> ESLint flat config. `npm run lint:a11y-check` bloque sur regression baseline 158. |
| ESLint a11y | `eslint-plugin-jsx-a11y` actif en mode `warn` global, baseline **155** post-Lot B (-3 vs initial). |
| axe-core | Playwright + axe-core via story 2.6.1. Baseline final Lot B = **0 violations Critical/Serious sur 7 parcours**. Mode `warn` (audit local pre-merge). |
| DoD a11y | Checklist obligatoire dans `.claude/skills/bmad-create-story/template.md`. |
| Module system | ESM (`"type": "module"`). Tous les scripts `.mjs`. |
| Sprint tracking | Pas de `sprint-status.yaml`. Le workflow `bmad-create-story` saute cette etape. |
| Convention commits | `Story 2.7.X : <description courte>` puis `Story 2.7.X : statut done apres CI Vercel verte`. Sobres, francais, sans emoji. |
| Garde-fou h1 | `find app -name 'page.tsx' \| xargs grep -L '<h1' \| wc -l = 0` sur l'ensemble de l'app post-Lot B. |

## Lecons heritees du Lot B (bilan 2026-05-06)

Le Lot B a tenu son perimetre **et son effort** (9/9 done, 6,25 j realises = 6,25 j prevus, **derive 0 %** vs +8 % Lot A). Trois facteurs cles :

1. **Inventaire `inventaire-points-usage-lot-b-2026-05-05.md` faisant foi** sur les decomptes (lecon 2.5.5 appliquee).
2. **Decoupage 2.6.7 en 3 sous-stories** par zone fonctionnelle (publique+auth, dashboards, admin) au lieu d'une story de 27 pages.
3. **Garde-fou grep cumulatif `wc -l = 0`** : detection automatique des pages oubliees.

**Compromis Lot B** explicitement reportes Lot C :
- **2.7.1** : 2 pages (`register`, `accompagnante/onboarding`) ont leur `<h1 sr-only>` hors du `<main>` parce que le `<main>` est rendu par un composant client.
- **2.7.2** : saut h1 -> h3 sur cards (regle `heading-order` axe-core, severity `moderate`, hors baseline Critical/Serious).

**Pre-requis Lot C** : pas de pre-requis structurel (tous les outils Lot B sont en place).

## Overview

### Problem Statement

Le Lot B a leve les 7 criteres FAIL bloquants du NFR a11y (D3 messagerie, D2 onboarding, B3 navigation, C2 erreurs, D1 hierarchie, D4 Leaflet, A3 carte hero) et la dette E2 (outillage axe-core). Le baseline axe-core est passe de 1 violation Critical a 0 sur 7 parcours.

Restent 3 categories d'items :

1. **Compromis pragmatiques** intentionnels du Lot B a finaliser : refactor des 2 pages a `<main>` rendu par composant client (2.7.1), correction du saut h1->h3 sur cards (2.7.2).
2. **Engagement public** : la conformite annoncee meriterait une page publique declarant le niveau atteint et les limites (recommandation RGAA, story 2.7.3).
3. **Verrouillage du gain Lot B** : bascule de `npm run a11y:axe:check` en mode bloquant (Option 1 = audit local pre-merge documente, story 2.7.4) + retro Lot B documentee (story 2.7.5).

Le Lot C est volontairement **minimaliste** (2 j-dev) : il consolide l'acquis sans engager les 6-8 j d'un Lot D « conformite externe avancee » (tests automatises scenarios complets, VoiceOver/NVDA formels, cible tactile 44×44 px, bascule jsx-a11y `error`, audit admin). Si une demande externe (audit RGAA, certification, levee de fonds) le motive, le Lot D sera cadre separement.

### Solution

Lot C regroupe **5 stories courtes** independantes (sauf 2.7.4 en cloture) :

1. **2.7.5** retro Lot B — documentation, parallelisable.
2. **2.7.1** refactor pages a `<main>` rendu par composant client — 2 fichiers + 2 wrappers.
3. **2.7.2** heading-order cards `<h3>` -> `<h2>` — multi-fichiers mecanique.
4. **2.7.3** page publique `/accessibilite` — story isolee.
5. **2.7.4** bascule `a11y:axe:check` bloquant — cloture, decision Project Lead requise.

| Story | Titre | Effort | Critere(s) NFR couvert(s) | Pattern de risque | Reference inventaire |
|---|---|---|---|---|---|
| **2.7.1** | Refactor pages a `<main>` rendu par composant client | 0,5 j | D1 (compromis Lot B 2.6.7-A/B) | Refonte structurelle limitee | §2.7.1 |
| **2.7.2** | Heading-order : cards `<h3>` -> `<h2>` | 0,5 j | D1 partiel (saut hierarchie) | Multi-fichiers mecanique | §2.7.2 |
| **2.7.3** | Page publique `/accessibilite` | 0,5 j | Engagement RGAA partial | Story isolee sure | §2.7.3 |
| **2.7.4** | Bascule `a11y:axe:check` bloquant CI | 0,25 j | E2 (verrouillage) | Configuration CI | §2.7.4 |
| **2.7.5** | Retrospective Lot B documentee | 0,25 j | Qualite processus | Documentation | §2.7.5 |

**Total : 5 stories, 2 j-dev** — coherent avec scope Option A retenu.

### Scope

**In Scope** :

- Refactor `app/register/page.tsx` + `components/auth/register-form.tsx` (extraction `<main>` du composant vers la page wrapper, conservation de `tabIndex={-1}` et `focus:outline-none` pour skip-link).
- Refactor `app/accompagnante/onboarding/page.tsx` + `components/accompagnante/onboarding-client.tsx` (idem).
- Transformation systematique des `<h3>` cards en `<h2>` sur ~10 pages porteuses (decompte exact via grep en debut de story 2.7.2).
- Creation `app/accessibilite/page.tsx` (Server Component statique) avec niveau de conformite, resultats, limites, contact, engagement.
- Ajout lien « Accessibilite » dans `components/footer.tsx` a cote de « Mentions legales ».
- Update `CLAUDE.md` (regle stricte : `npm run a11y:axe:check` doit etre vert avant tout commit livraison).
- Documentation `_bmad-output/implementation-artifacts/mini-epic-2-6-retro-2026-05-XX.md` (retro Lot B).

**Out of Scope** (reportable Lot D si demande) :

- Tests automatises axe-core sur **scenarios complets** (login + clic-par-clic).
- Tests manuels VoiceOver/NVDA documentes formellement.
- Cible tactile 44×44 px (audit + correction systematique).
- Bascule `eslint-plugin-jsx-a11y` `warn` -> `error` (baseline 155 stable, wrapper joue deja le gate).
- Spec axe-core dediee admin.
- Refactor menus deroulants admin (combobox WAI-ARIA).

### Architecture Alignment

- **Convention `<main id="main-content">`** (Lot A 2.5.2) : story 2.7.1 confirme que ce convention prime sur la modularite cote composant client. Le `<main>` doit etre rendu par la page wrapper, pas par le composant client.
- **Convention `<h1>` unique par page** (Lot B 2.6.7) : conservee. Story 2.7.2 ne touche pas aux `<h1>`, uniquement aux `<h3>` cards.
- **Pas de nouveau composant a11y central** : Lot B avait deja decide de ne pas creer un composant `<ErrorAlert>` central (story 2.6.4 Dev Notes). Lot C confirme : aucun nouveau composant transverse.

### Detailed Design

Voir l'inventaire pour les details fichier-par-fichier. Patterns de design figes ici :

#### Pattern « extraction `<main>` du composant client »

**Avant** (Lot B 2.6.7-A) :

```tsx
// app/register/page.tsx
export default function RegisterPage() {
  return (
    <>
      <h1 className="sr-only">Créer un compte</h1>
      <Suspense>
        <RegisterForm />
      </Suspense>
    </>
  )
}

// components/auth/register-form.tsx
export function RegisterForm() {
  // ...
  return (
    <main id="main-content" tabIndex={-1} className="min-h-screen flex ...">
      <div className="...">
        ...
      </div>
    </main>
  )
}
```

**Apres** (Lot C 2.7.1) :

```tsx
// app/register/page.tsx
export default function RegisterPage() {
  return (
    <main id="main-content" tabIndex={-1} className="min-h-screen flex items-center justify-center p-4 kraft bg-kraft focus:outline-none">
      <h1 className="sr-only">Créer un compte</h1>
      <Suspense>
        <RegisterForm />
      </Suspense>
    </main>
  )
}

// components/auth/register-form.tsx
export function RegisterForm() {
  // ...
  return (
    <div className="w-full max-w-md relative z-10">
      ...
    </div>
  )
}
```

**Verification** :
- `<main>` recu par la page wrapper, classes preservees.
- `<h1 sr-only>` immediatement apres le `<main>`, dans le flux du skip-link.
- Composant client perd son rendu `<main>` (devient un fragment ou un `<div>` simple).
- Layout visuel inchange (verification screenshot avant/apres).

Le branchement `if (emailSent)` du `RegisterForm` actuel (qui rend un `<main>` separe) doit aussi perdre son `<main>` — le wrapper page le fournit deja.

Idem pattern pour `OnboardingClient`.

#### Pattern « heading-order cards `<h3>` -> `<h2>` »

**Regle de decision** :

- **Cards-data** (favoris, recherche, demandes) ou **sections principales du contenu** (utilisateur/[id], recherche/[id], dashboard) : `<h3>` -> `<h2>`.
- **Sous-sections d'une section deja titree par un `<h2>` parent** : reste en `<h3>`.

**Exemple** (`app/admin/utilisateurs/[id]/page.tsx`) :

Avant : `<h1>Nom utilisateur</h1>` (h1 page) > `<h3>Informations personnelles</h3>` (saut h1->h3).

Apres : `<h1>Nom utilisateur</h1>` (h1 page) > `<h2>Informations personnelles</h2>` (h1->h2 OK).

**Verification** : `npm run a11y:axe:check` apres modif. La regle `heading-order` est `moderate` chez axe-core et n'est pas dans le baseline Critical/Serious actuel. Verifier qu'elle disparait quand meme des warnings axe (si elle y est) — alimente le re-run NFR.

#### Pattern « page publique `/accessibilite` »

Server Component statique (`'use client'` interdit). Pas de logique, juste du contenu.

```tsx
// app/accessibilite/page.tsx
import type { Metadata } from 'next'
import Link from 'next/link'
import { Footer } from '@/components/footer'

export const metadata: Metadata = {
  title: 'Accessibilité — roxanetnous',
  description: 'Engagement et limites d\'accessibilité de roxanetnous.',
}

export default function AccessibilitePage() {
  return (
    <>
      <main id="main-content" tabIndex={-1} className="min-h-screen ... focus:outline-none">
        <div className="max-w-3xl mx-auto px-4 py-8">
          <h1 className="text-3xl font-bold text-black mt-6 mb-8">Accessibilité</h1>
          <section className="space-y-6 text-base text-black">
            <h2>Niveau de conformité</h2>
            <p>roxanetnous est <strong>partiellement conforme</strong> au RGAA 4.1, niveau AA partiel.</p>
            ...
          </section>
        </div>
      </main>
      <Footer />
    </>
  )
}
```

#### Pattern « bascule axe-check bloquant »

**Option 1 retenue par defaut** (a confirmer Project Lead au demarrage) :

- Pas de modification `vercel.json`, `package.json` ou hook git.
- Modification de `CLAUDE.md` projet : ajout ligne « Avant tout commit livraison story (`Story 2.7.X : ...`), executer `npm run a11y:axe:check` localement et confirmer exit 0. Tout commit qui ne respecte pas cette regle est rejete au code review. »
- Documentation dans la story 2.7.4 : trace de la decision Project Lead.

Option 2 (hook git) ou Option 3 (webhook Vercel) : ouvertes si Project Lead les preferre, story 2.7.4 escalade alors a 0,5 j.

#### Pattern « retro Lot B »

Suit la structure de `mini-epic-2-5-retro-2026-05-05.md` (deja en repo). Sections :

1. Contexte
2. Resultats quantitatifs (baseline 1 -> 0, lint 158 -> 155, etc.)
3. What worked
4. What didn't work
5. Derives effort (0 % Lot B vs +8 % Lot A)
6. Actions Lot C

### Implementation Stack & Dependencies

**Aucune nouvelle dependance** Lot C. Tout est en place.

| Outil/Lib | Version | Statut |
|---|---|---|
| Next.js | 16.x | Lot A |
| React | 19.x | Lot A |
| TailwindCSS | v4 | Lot A |
| ESLint | v9 flat config | Lot A |
| eslint-plugin-jsx-a11y | latest | Lot A |
| @playwright/test | latest | Lot B 2.6.1 |
| @axe-core/playwright | latest | Lot B 2.6.1 |

### Data Models and Contracts

Aucun changement de modele de donnees (pas de migration Supabase).

### APIs and Interfaces

Aucun changement d'API.

### Workflows and Sequencing

```
Demarrage Lot C
       │
       ├─> 2.7.5 retro Lot B (parallelisable, 0,25 j)
       ├─> 2.7.1 refactor `<main>` (parallelisable, 0,5 j)
       ├─> 2.7.2 heading-order cards (parallelisable, 0,5 j)
       └─> 2.7.3 page /accessibilite (parallelisable, 0,5 j)
                                    │
                                    └─> 2.7.4 bascule axe-check bloquant (cloture, 0,25 j)
                                                       │
                                                       └─> Re-run NFR a11y post-Lot C
```

5 stories courtes, parallelisables sauf 2.7.4. Une session courte (1 j) suffit pour le bloc 2.7.5 + 2.7.1 + 2.7.4. Une seconde session (1 j) pour 2.7.2 + 2.7.3.

### Non-Functional Requirements

- **Performance** : aucune regression attendue (changements purement structurels HTML/ARIA).
- **Securite** : N/A (pas de changement d'auth, pas de changement de RLS).
- **A11y** : objectif principal du Lot. Cible : confirmer baseline axe-core a 0, eliminer le warning `heading-order`, declarer publiquement le niveau de conformite.
- **Maintenabilite** : story 2.7.5 documente le savoir-faire pour Lot D futur.

### Dependencies and Integrations

Aucune nouvelle integration externe.

### Acceptance Criteria (Authoritative)

#### AC commun Lot C (rappel)

1. **AC commun 1** - `npm run lint:a11y-check` et `npm run a11y:axe:check` verts (delta documente si baseline modifie).
2. **AC commun 2** - DoD a11y cochee sur chaque story.
3. **AC commun 3** - Double commit (livraison + cloture apres Vercel verte).

#### AC propres aux stories

Detailles dans chaque story redigee `_bmad-output/implementation-artifacts/2-7-X-<slug>.md` au moment de `bmad-create-story`. Synthese :

- **2.7.1** : `<h1 sr-only>` est immediatement apres `<main id="main-content">` dans le DOM rendu (verification statique du HTML produit). Composants `RegisterForm` et `OnboardingClient` ne rendent plus de `<main>`. Layout visuel inchange (verification screenshot).
- **2.7.2** : `grep -rn '<h3' app | wc -l` apres modif < (avant modif). Decision case-par-case documentee dans la PR description (~20 lignes : fichier, ancien `<h3>`, nouveau `<h2>` ou laisse `<h3>`).
- **2.7.3** : page `/accessibilite` accessible, lien dans footer, contenu valide les 5 sections (niveau, resultats, limites, contact, engagement).
- **2.7.4** : Option choisie documentee dans la story et appliquee. `CLAUDE.md` projet mis a jour.
- **2.7.5** : document `mini-epic-2-6-retro-2026-05-XX.md` cree, 6 sections completes, references croisees vers `lot-b-bilan-axe-core-2026-05-06.md` et `nfr-assessment-a11y-2026-05-04.md`.

### Traceability Mapping

| Critere NFR | Story Lot C couvrante | Reference NFR |
|---|---|---|
| D1 (compromis Lot B finalises) | 2.7.1 + 2.7.2 | nfr-assessment-a11y-2026-05-04.md §D1 |
| Engagement RGAA partial | 2.7.3 | RGAA 4.1, art. obligation declaration |
| E2 (axe-core bloquant) | 2.7.4 | nfr-assessment-a11y-2026-05-04.md §E2 |
| Qualite processus | 2.7.5 | retro Lot A pattern |

### Risks, Assumptions, Open Questions

**Risques** :

| ID | Risque | Mitigation |
|---|---|---|
| **R1** | Refactor `<main>` casse le layout visuel (centrage flex, background) | Verification screenshot pre/post commit. Si regression : revert immediat ou fix dans le meme commit. |
| **R2** | 2.7.2 derive sur le decompte (+30 % pattern 2.5.5) | Sub-task 1.0 obligatoire : grep + decompte exhaustif AVANT modification. |
| **R3** | Option 1 (audit local) trop laxiste car depend du discipline | Decision Project Lead tranche au demarrage 2.7.4. Option 2/3 ouvertes. |
| **R4** | Page `/accessibilite` formule des engagements non tenus en pratique | Limites declarees explicitement. Section « Limites connues » courte mais honnete. |

**Assumptions** :

- La baseline axe-core reste a 0 violations Critical/Serious tout au long du Lot C. Toute regression est traitee dans la story qui l'introduit.
- Aucune nouvelle page n'est ajoutee a l'app pendant le Lot C (sinon le garde-fou `wc -l = 0` serait casse).
- Le projet ne demarre pas un audit RGAA externe (sinon escalade a Lot D).

**Open Questions** :

- Story 2.7.4 : Option 1, 2 ou 3 ? Decision Project Lead requise.
- Story 2.7.3 : la page `/accessibilite` doit-elle etre liee depuis le footer principal ET la page d'accueil ? (suggestion : footer suffit, comme « Mentions legales »).

### Test Strategy Summary

- **Tests automatises** : `npm run a11y:axe:check` (baseline reste a 0). `npm run lint:a11y-check` (baseline 155).
- **Verifications visuelles** : 2.7.1 (screenshot avant/apres sur `/register` et `/accompagnante/onboarding`), 2.7.3 (rendu de la nouvelle page).
- **Verification manuelle ad-hoc** : 2.7.3 test rapide VoiceOver sur la nouvelle page.
- **Pas de tests unitaires** ni de specs Playwright dediees Lot C (pas de nouveau parcours critique).

### Stories detaillees

> Note : chaque story Lot C est creee sous `_bmad-output/implementation-artifacts/2-7-X-<slug>.md` au moment du `bmad-create-story`. La presente section donne le **contour AC** et le **decompte tasks** pour chaque story, aligne sur l'inventaire.

#### Story 2.7.1 — Refactor pages a `<main>` rendu par composant client

**Effort** : 0,5 j-dev
**Critere NFR couvert** : D1 (finalisation compromis Lot B 2.6.7-A/B).

**AC contour** :

1. **AC1** : `app/register/page.tsx` rend un `<main id="main-content" tabIndex={-1}>` qui contient `<h1 sr-only>Créer un compte</h1>` puis `<Suspense><RegisterForm /></Suspense>`. `RegisterForm` ne rend plus de `<main>` (devient un `<div>` ou fragment).
2. **AC2** : `app/accompagnante/onboarding/page.tsx` rend un `<main id="main-content" tabIndex={-1}>` qui contient `<h1 sr-only>Onboarding accompagnante</h1>` puis `<OnboardingClient ... />`. `OnboardingClient` ne rend plus de `<main>`.
3. **AC3** : layout visuel inchange (background `kraft bg-kraft`, centrage flex `min-h-screen flex items-center justify-center p-4` pour register, layout vertical pour onboarding). Verification screenshot pre/post.
4. **AC4** : `npm run lint:a11y-check` vert. `npm run a11y:axe:check` vert (P4-register doit rester a 0 violations).
5. **AC5** : skip-link `#main-content` saute correctement au `<main>` qui contient maintenant le `<h1>` immediatement (verifie au clavier).

**Tasks** : 4 tasks (refactor register, refactor onboarding, verification visuelle, validations + commits).

#### Story 2.7.2 — Heading-order : cards `<h3>` -> `<h2>`

**Effort** : 0,5 j-dev
**Critere NFR couvert** : D1 partiel (suppression saut h1->h3).

**AC contour** :

1. **AC1** : grep `grep -rn '<h3' app | wc -l` execute en debut de story et **decompte enregistre dans la PR description**. Decision case-par-case documentee.
2. **AC2** : transformation `<h3>` -> `<h2>` appliquee selon la regle :
   - Cards-data ou sections principales -> `<h2>`.
   - Sous-sections d'une section deja titree par un `<h2>` parent -> reste `<h3>`.
3. **AC3** : `npm run a11y:axe:check` vert (la regle `heading-order` est `moderate` mais peut apparaitre dans les warnings — verifier qu'elle disparait apres modif).
4. **AC4** : `npm run lint:a11y-check` vert (pas de regression baseline 155).
5. **AC5** : pas de regression visuelle (les `<h2>` cards conservent le styling original `font-semibold text-lg` ou equivalent — Tailwind classes inchangees).

**Tasks** : 4 tasks (grep + decision case-par-case, application h3->h2, verification, validations + commits).

#### Story 2.7.3 — Page publique `/accessibilite`

**Effort** : 0,5 j-dev
**Critere NFR couvert** : engagement RGAA partial.

**AC contour** :

1. **AC1** : fichier `app/accessibilite/page.tsx` cree (Server Component statique, pas `'use client'`).
2. **AC2** : 5 sections presentes (niveau de conformite, resultats des tests, limites connues, contact, engagement amelioration).
3. **AC3** : `<h1>Accessibilité</h1>` au sommet du `<main>`.
4. **AC4** : lien « Accessibilité » ajoute dans `components/footer.tsx` a cote de « Mentions legales ».
5. **AC5** : `metadata.title` = « Accessibilité — roxanetnous », `metadata.description` defini.
6. **AC6** : `npm run a11y:axe:check` vert (la nouvelle page n'introduit pas de nouvelle violation).
7. **AC7** : test rapide VoiceOver sur la page (lecture lineaire OK).

**Tasks** : 4 tasks (redaction page, ajout footer, verification VoiceOver + axe, validations + commits).

#### Story 2.7.4 — Bascule `a11y:axe:check` bloquant CI

**Effort** : 0,25 j (Option 1) ou 0,5 j (Option 2/3, escalade).

**AC contour** :

1. **AC1** : decision Project Lead documentee dans la story (Option 1, 2 ou 3).
2. **AC2** (Option 1) : `CLAUDE.md` projet mis a jour avec une regle stricte : « Avant tout commit livraison story, `npm run a11y:axe:check` doit etre vert localement (exit 0). »
3. **AC3** (Option 1) : pas de modification `vercel.json` ni de hook git.
4. **AC4** (Option 2/3 — escalade) : hook git `pre-commit` (Option 2) ou webhook Vercel post-deploiement (Option 3) implemente et documente.
5. **AC5** : `npm run a11y:axe:check` reste vert (no-op pour Option 1, validation pour Option 2/3).

**Tasks** : 3 tasks (decision Project Lead, application choix, validations + commits).

#### Story 2.7.5 — Retrospective Lot B documentee

**Effort** : 0,25 j-dev
**Critere NFR couvert** : qualite processus.

**AC contour** :

1. **AC1** : fichier `_bmad-output/implementation-artifacts/mini-epic-2-6-retro-2026-05-XX.md` cree.
2. **AC2** : 6 sections (contexte, resultats quantitatifs, what worked, what didn't, derives effort, actions Lot C).
3. **AC3** : references croisees explicites vers `lot-b-bilan-axe-core-2026-05-06.md`, `nfr-assessment-a11y-2026-05-04.md`, `tech-spec-lot-b-a11y.md`.
4. **AC4** : pas de DoD a11y (story documentation pure).
5. **AC5** : commit unique (pas de double commit done — c'est de la doc, valide par lecture).

**Tasks** : 2 tasks (redaction document, commit).
