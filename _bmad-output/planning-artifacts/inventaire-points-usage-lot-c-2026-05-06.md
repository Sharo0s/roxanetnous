# Inventaire points d'usage — Lot C accessibilite (consolidation)

**Date** : 2026-05-06
**Reference tech-spec** : `_bmad-output/implementation-artifacts/tech-spec-lot-c-a11y.md`
**Statut** : annexe contractuelle (fait foi sur les decomptes de fichiers et les efforts affines)

## 1. Vue d'ensemble Lot C

| Story | Sujet | Cible | Pattern de risque | Effort affine |
|---|---|---|---|---|
| **2.7.1** | Refactor pages a `<main>` rendu par composant client | 2 fichiers + 2 wrappers | Refonte structurelle limitee — sous-cadrage possible | 0,5 j |
| **2.7.2** | Heading-order : cards `<h3>` -> `<h2>` | ~10 pages porteuses, ~20 occurrences | Multi-fichiers mecanique — derive +30 % possible (pattern 2.5.5) | 0,5 j |
| **2.7.3** | Page publique `/accessibilite` (engagements + limites) | 1 nouveau fichier + lien footer | Story isolee sure | 0,5 j |
| **2.7.4** | Bascule `a11y:axe:check` bloquant en CI Vercel | `package.json`, `CLAUDE.md`, doc | Configuration CI — risque faux positif si flake Playwright | 0,25 j |
| **2.7.5** | Retrospective Lot B documente | 1 nouveau fichier `_bmad-output/implementation-artifacts/lot-b-retro-YYYY-MM-DD.md` | Documentation — pas de risque | 0,25 j |

**Total Lot C : 5 stories, 2 j-dev** — coherent avec l'option « minimaliste » retenue (consolidation sans investissement renforcement). Marge +0 % car stories courtes et pattern Lot B reproductible.

**Decisions Project Lead 2026-05-06 entrinees** :
- **Pas** de tests automatises axe-core sur scenarios complets (Lot D si conformite externe demandee).
- **Pas** de tests VoiceOver/NVDA documentes formellement (les narratifs Lot B suffisent en interne).
- **Pas** de bascule `eslint-plugin-jsx-a11y` `warn` -> `error` (baseline 155 stable, le wrapper `lint:a11y-check` joue deja le gate).
- **Pas** d'audit cible tactile 44x44 px (reportable Lot D si demande).
- **Pas** de spec axe-core dediee admin (les pages admin restent hors parcours critiques).

---

## 2. Detail story par story

### 2.7.1 — Refactor pages a `<main>` rendu par composant client

**Cible NFR** : D1 (semantique HTML), nettoyage compromis Lot B 2.6.7-A et 2.6.7-B.

**Contexte** : 2 pages ont un `<h1 sr-only>` **hors** du `<main>` parce que le `<main>` est rendu par un composant client (`RegisterForm`, `OnboardingClient`). Le skip-link `#main-content` saute donc apres le h1 — non-conformite mineure mais detectable par audit externe.

**Fichiers a refactor (2)** :

- `app/register/page.tsx` + `components/auth/register-form.tsx` :
  - **Avant** : `register/page.tsx` rend `<><h1 sr-only>...</h1><Suspense><RegisterForm /></Suspense></>`. `RegisterForm` rend `<main id="main-content">...</main>` (en 2 branches : default + emailSent).
  - **Apres** : `register/page.tsx` rend `<main id="main-content"><h1 sr-only>...</h1><Suspense><RegisterForm /></Suspense></main>`. `RegisterForm` rend `<div className="...">...</div>` (sans `<main>`).

- `app/accompagnante/onboarding/page.tsx` + `components/accompagnante/onboarding-client.tsx` :
  - **Avant** : `onboarding/page.tsx` rend `<><h1 sr-only>...</h1><OnboardingClient ... /></>`. `OnboardingClient` rend `<main id="main-content">...</main>`.
  - **Apres** : `onboarding/page.tsx` rend `<main id="main-content"><h1 sr-only>...</h1><OnboardingClient ... /></main>`. `OnboardingClient` rend `<div className="...">...</div>` (sans `<main>`).

**Pattern de risque** : refonte structurelle limitee mais touche 2 composants client a `<main>` integre. Risque secondaire : la classe `tabIndex={-1}` + `focus:outline-none` du `<main>` doit etre conservee sur le nouveau `<main>` cote page wrapper (skip-link Lot A 2.5.2). **Verification visuelle requise** : layout ne casse pas (background `kraft bg-kraft`, layout flex `min-h-screen flex items-center justify-center p-4`).

**Effort affine** : 0,5 j (pattern simple repete 2x, mais requiert verification visuelle + DoD a11y).

---

### 2.7.2 — Heading-order : cards `<h3>` -> `<h2>`

**Cible NFR** : D1 partiel (hierarchie heading), regle `heading-order` axe-core (severity `moderate`, hors baseline Critical/Serious actuel mais alimentation re-run NFR).

**Contexte** : Lot B 2.6.7 a ajoute des `<h1>` au sommet des pages, mais les cards des pages liste utilisent `<h3>` -> creation d'un saut h1 -> h3. Cible Lot C : transformer les `<h3>` cards en `<h2>` partout ou c'est cohérent semantiquement.

**Fichiers a editer (~10 pages, ~20 occurrences estimees)** :

Liste non-exhaustive a confirmer au demarrage de la story par grep :

```bash
grep -rn '<h3' app | grep -v 'Récapitulatif\|FAQ\|details' | wc -l
```

Pages porteuses identifiees (au 2026-05-06) :
- `app/admin/utilisateurs/[id]/page.tsx` (~7 h3 : Visio, Refus, Informations personnelles, Localisation, Profil pro, Specialites, Disponibilites, Description, Justificatifs, Abonnement).
- `app/admin/validation/[id]/page.tsx` (~4 h3 : Informations personnelles, Profil pro, Specialites, Description).
- `app/admin/page.tsx` (1 h3 : Accompagnantes en cours de validation).
- `app/recherche/[id]/page.tsx` (~6 h3 : Description, A propos, Specialites, Disponibilites, Informations, Contacter, Interesse).
- `app/accompagne/dashboard/page.tsx` (~3-5 h3 : Rechercher, Publier, Mes annonces, ...).
- `app/accompagnante/dashboard/page.tsx` (~4-6 h3 : Verification supplementaire, Messages, Mon profil, Mon abonnement, ...).
- `app/favoris/page.tsx` (h3 cards favoris).
- `app/recherche/demandes/page.tsx` (h3 cards demande).

**Pattern de risque** : multi-fichiers mecanique (derive +30 % possible si l'inventaire grep n'est pas execute en debut de story). **Mitigation** : sub-task 1.0 obligatoire qui execute le grep et construit le decompte exhaustif avant la modification.

**Effort affine** : 0,5 j (mecanique mais ~20 occurrences, marge integree).

**Decision a figer** :
- Cards-data (favoris, recherche, demandes) : `<h2>` car elles sont les sous-sections principales du contenu.
- Sections de detail (utilisateur/[id], recherche/[id]) : `<h2>` car elles structurent le contenu post-h1.
- **Pas** de transformation des `<h3>` qui sont a l'interieur d'une section deja titree par un `<h2>` (cas a distinguer : si une section a un `<h2>` parent, ses sous-sections restent en `<h3>`).

---

### 2.7.3 — Page publique `/accessibilite` (engagements + limites)

**Cible NFR** : conformite externe (engagement public sur l'accessibilite, recommandation RGAA niveau A pour les services en ligne).

**Fichier a creer (1)** : `app/accessibilite/page.tsx`.

**Fichiers a editer (1)** : `components/footer.tsx` (ajout lien « Accessibilite » a cote de « Mentions legales » et « Politique de confidentialite »).

**Contenu attendu** (1 page publique servant a la fois d'engagement RGAA partial et de transparence) :

- **Niveau de conformite declare** : « partiellement conforme » (RGAA 4.1, niveau AA partiel).
- **Resultats des tests** :
  - Tests automatises : `eslint-plugin-jsx-a11y` (155 violations baseline, 0 erreur), `axe-core/Playwright` sur 6 parcours critiques (0 violation Critical/Serious).
  - Tests manuels narratifs : VoiceOver macOS sur messagerie, onboarding, formulaires (3 echantillons documentes Lot B).
- **Limites connues** :
  - Carte Leaflet neutralisee (`aria-hidden`+`inert`) — alternative via champs ville/rayon adjacents.
  - Pages admin non auditees (back-office, audience interne).
  - Cible tactile 44×44 px non audite systematiquement (a verifier au cas par cas).
- **Contact** : `roxanetnous@outlook.com` pour signaler un defaut d'accessibilite.
- **Engagement amelioration** : prochaine revue automatique avec re-run NFR a11y semestriel.

**Pattern de risque** : story isolee, faible risque. La page est statique (Server Component, pas d'interactivite).

**Effort affine** : 0,5 j (redaction + integration footer + DoD a11y).

---

### 2.7.4 — Bascule `a11y:axe:check` bloquant en CI Vercel

**Cible NFR** : E2 (test automatise) — passage du mode `warn` (avertissement, ne bloque pas) au mode bloquant.

**Pre-requis atteints** (Lot B 2.6.7-C) :
- Baseline axe-core final = 0 violations Critical/Serious sur 7 parcours.
- `npm run a11y:axe:check` exit 0 sur tous les commits Lot B.

**Fichiers a editer (2-3)** :

- `package.json` : adapter le script `lint:a11y-check` pour qu'il n'echoue plus en cas de regression baseline (deja le cas), et confirmer que `a11y:axe:check` est appele dans la chaine de build.
- `CLAUDE.md` (projet) : documenter que `npm run a11y:axe:check` est maintenant **bloquant** en CI Vercel (mise a jour de la regle stricte « accessibilite »).
- (Eventuel) `vercel.json` ou `next.config.ts` si une etape CI custom doit etre ajoutee — verification au demarrage de la story. Vercel ne supporte pas natively un script `prebuild` qui appelle Playwright (Chromium 165 Mo en build), donc la decision Lot B etait : **audit local pre-merge**.

**Decision a confirmer au demarrage** :

Option 1 — **Audit local pre-merge bloquant** : ajout d'une regle dans `CLAUDE.md` interdisant tout commit livraison sans `npm run a11y:axe:check` vert localement. Pas de modification CI Vercel. Plus simple, depend du discipline.

Option 2 — **Hook git pre-commit** : ajouter un hook `.claude/settings.json` ou un `husky` pre-commit qui execute `npm run a11y:axe:check`. Plus robuste, mais necessite Playwright Chromium installe localement par tous les contributeurs.

Option 3 — **CI Vercel post-deploiement** : utiliser un webhook Vercel post-deploiement Preview qui execute `npm run a11y:axe:check` contre l'URL Preview. Plus robuste, mais complexite supplementaire (webhook a coder).

**Recommandation initiale** : Option 1 (pas d'investissement infrastructure, alignement convention existante). Story 2.7.4 documente la regle et met a jour `CLAUDE.md`. **Decision Project Lead requise au demarrage**.

**Pattern de risque** : faible si Option 1, modere si Option 2 ou 3. **Mitigation** : choix tranche en debut de story.

**Effort affine** : 0,25 j (Option 1) ou 0,5 j (Option 2/3 — escalade recommandee si Project Lead choisit).

---

### 2.7.5 — Retrospective Lot B documente

**Cible NFR** : qualite processus (alignement avec retro Lot A `mini-epic-2-5-retro-2026-05-05.md`).

**Fichier a creer (1)** : `_bmad-output/implementation-artifacts/mini-epic-2-6-retro-2026-05-XX.md`.

**Pattern reference** : `mini-epic-2-5-retro-2026-05-05.md` (structure : contexte, what worked, what didn't, derives effort, lessons learned, actions).

**Sections attendues** :
1. **Contexte** : 9 stories, 6,25 j-dev planifies, livraison sur 2 jours (2026-05-05 → 2026-05-06).
2. **Resultats quantitatifs** : baseline axe-core 1 → 0, lint:a11y-check 158 → 155, garde-fou h1 = 0 sur 32+ pages, 4 criteres NFR transitionnent FAIL → PASS (D3, D2, B3, D4 partiel).
3. **What worked** :
   - Decoupage 2.6.7 en 3 sous-stories.
   - Pattern h1 sr-only pour pages avec `<main>` rendu par composant client (compromis pragmatique).
   - Garde-fou grep cumulatif `wc -l = 0`.
   - Audit Leaflet en mode statique avec Strategie 2.
   - Inventaire `inventaire-points-usage-lot-b-2026-05-05.md` faisant foi sur les decomptes (lecon 2.5.5 appliquee).
4. **What didn't work** :
   - Compromis register + onboarding (h1 hors `<main>`) — refactor reporte Lot C 2.7.1.
   - Saut h1->h3 sur cards (`heading-order`) — non bloquant mais imparfait, refactor reporte Lot C 2.7.2.
   - Tests manuels VoiceOver narratifs (pas executes formellement, juste documentes).
5. **Derives effort** :
   - 2.6.4 : conforme (1 j prevus, 1 j realises).
   - 2.6.6 : conforme avec bonus Task 7 (1 j prevus, 1 j realises avec resorption select-name incluse).
   - 2.6.7-A/B/C : conformes (1,25 j cumule prevus, 1,25 j realises).
   - **Total Lot B = effort estime, pas de derive** (vs +8 % Lot A).
6. **Actions Lot C** : reference au tech-spec Lot C (5 stories, 2 j-dev).

**Pattern de risque** : documentation, pas de risque technique.

**Effort affine** : 0,25 j (redaction).

---

## 3. Garde-fous transverses Lot C

- **2.7.1** : verification visuelle obligatoire des 2 pages refactor (background `kraft`, layout flex centre, focus skip-link). DoD a11y.
- **2.7.2** : sub-task grep en debut de story OBLIGATOIRE (decompte avant modif). DoD a11y. `npm run a11y:axe:check` apres modif (si la regle `heading-order` rentre dans le baseline Critical/Serious — peu probable mais a verifier).
- **2.7.3** : `lint:a11y-check` vert. Test rapide VoiceOver sur la nouvelle page.
- **2.7.4** : decision Project Lead tranche AU DEMARRAGE entre Options 1/2/3.
- **2.7.5** : pas de garde-fou technique (documentation).

## 4. Sequencement recommande

```
2.7.5 (retro) ─┐
               │
2.7.1 ─────────┤  (en parallele, independants)
               │
2.7.2 ─────────┤
               │
2.7.3 ─────────┘
               │
2.7.4 ─────────  (cloture, depend de tous les autres pour confirmer baseline 0)
```

5 stories independantes (sauf 2.7.4 en cloture). Possibilite de paralleliser 2.7.1, 2.7.2, 2.7.3, 2.7.5 sur 2 sessions courtes, puis 2.7.4 en cloture.

## 5. Hors scope (reportable Lot D si demande)

- Tests automatises axe-core sur scenarios complets (auth + clic-par-clic).
- Tests manuels VoiceOver/NVDA documentes formellement (procedure ecrite).
- Cible tactile 44×44 px (audit + correction).
- Bascule `eslint-plugin-jsx-a11y` `warn` -> `error`.
- Spec axe-core dediee admin.
- Audit a11y des pages /admin (back-office hors parcours critiques).
- Refactor menus deroulants admin (`<select>` -> combobox WAI-ARIA si ergonomie demande).
