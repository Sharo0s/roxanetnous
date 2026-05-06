# Rétrospective — Mini-épic 2.6 (Lot B accessibilité)

**Date** : 2026-05-06
**Project Lead** : Sylvain
**Format** : rétro courte, structure calquée sur `mini-epic-2-5-retro-2026-05-05.md`. Pas de party-mode.

## Résumé mini-épic

**Périmètre** : Lot B du chantier accessibilité (NFR WCAG 2.2 AA). Mise en place de l'outillage axe-core/Playwright, résorption des 4 critères FAIL prioritaires retenus pour le Lot B (D3 régions live messagerie, D2 composants dynamiques onboarding aux progressbar, C2 erreurs annoncées inline `role="alert"`, D4 composants tiers Leaflet + dette C1 labels `select-name` recherche), garantie h1 unique sur l'ensemble des pages applicatives. Aligné sur le tech-spec `tech-spec-lot-b-a11y.md` et le NFR `nfr-assessment-a11y-2026-05-04.md`. Les bloqueurs critiques NFR initiaux B1 (skip-link), B2 (focus visible), C1 (labels) ont été couverts en amont par le Lot A (mini-épic 2.5).

**Stories livrées (9/9)**

- **2.6.1** — Outillage axe-core/Playwright et baseline (1 violation Critical initiale `select-name`)
- **2.6.2** — Messagerie a11y (`<article role="article">`, region live, libellés bouton envoyer)
- **2.6.3** — Onboarding accompagnante : progressbar + focus management
- **2.6.4** — Erreurs inline `role="alert"` (audit complet, 24 occurrences)
- **2.6.5** — Carte hero : alternative textuelle
- **2.6.6** — Audit Leaflet + alternative clavier (Stratégie 2 `aria-hidden`+`inert`, Task 7 bonus : résorption `select-name`)
- **2.6.7-A** — Landmarks et h1 unique : pages publiques + auth (10 pages)
- **2.6.7-B** — Landmarks et h1 unique : dashboards accompagnante/accompagné (11 pages + 2 bonus modifier)
- **2.6.7-C** — Landmarks et h1 unique : pages admin (11 pages) + bilan global

**Branche / merge** : chaque story sur une branche dédiée `story-2-6-X-*`, mergée sur `main` après CI Vercel verte. Pattern double commit `livraison` puis `statut done apres CI Vercel verte` (D4 Lot A) tenu sur les 9 stories.

**Code reviews** : intégrées au workflow `bmad-dev-story`, comme sur le Lot A. Pas de session multi-agent dédiée — le couple lint a11y + axe-core automatisé + audit grep cumulatif a couvert l'essentiel.

## Résultats quantitatifs

### Baseline axe-core (7 parcours critiques)

| Date | Story | Commit | Critical/Serious | Nodes affectés |
|---|---|---|---|---|
| 2026-05-05 | 2.6.1 (initial) | `b8f0b69` | **1** | **1** |
| 2026-05-06 | 2.6.7-C (clôture) | `8aad621` (livraison) / `91d1e5f` (done) | **0** | **0** |
| **Delta** | — | — | **-1 (-100 %)** | **-1 (-100 %)** |

Détail par parcours (cf. `lot-b-bilan-axe-core-2026-05-06.md` §2) :
- P1 onboarding accompagnante : 0 → 0
- **P2 recherche publique : 1 Critical (`select-name`) → 0** — résorbée par 2.6.6 Task 7 (ajout `htmlFor`/`id` sur 2 `<select>` non labellisés).
- P3 messagerie : 0 → 0
- P4-login : 0 → 0
- P4-register : 0 → 0
- P5 landing : 0 → 0
- P6 suppression RGPD : 0 → 0

### Baseline `lint:a11y-check`

- **158 → 155** (3 violations résorbées au cours du Lot B).
- Le wrapper `lint:a11y-check` reste vert sur l'ensemble des stories. Aucune nouvelle violation `jsx-a11y/*` introduite malgré la modification de 2 modules messagerie, 1 module onboarding, 4 formulaires d'erreur, 32 pages applicatives en 2.6.7-A/B/C.

### Garde-fou h1 unique

- `find app -name 'page.tsx' | xargs grep -L '<h1' | wc -l = 0` sur **47 pages applicatives** (zone publique + auth + dashboards + admin).
- Détection automatique de toute nouvelle page oubliant un `<h1>`. Zéro faux positif.

### Critères NFR : transitions FAIL → PASS

9 critères couverts par le Lot B avec re-étiquetage NFR officiel (cf. tableau `lot-b-bilan-axe-core-2026-05-06.md` §5 ; rétro initiale fusionnait C1+D4 sous « D4 select labellisé + Leaflet », distingués ici pour fidélité aux intitulés `nfr-assessment-a11y-2026-05-04.md:109-128`) :

| Critère | Couverture story | Statut Lot A | Statut post-Lot B |
|---|---|---|---|
| **A3** (alternatives textuelles non-text) | 2.6.5 carte hero | FAIL | **PASS** |
| **B3** (navigation clavier parcours critiques) | 2.6.2 + 2.6.3 + 2.6.6 (audit Leaflet) | FAIL | **PASS** |
| **C1** (labels formulaires — dette `select-name`) | 2.6.6 Task 7 | FAIL résiduel | **PASS** |
| **C2** (erreurs annoncées inline + textarea) | 2.6.2 + 2.6.3 + 2.6.4 | FAIL | **PASS** |
| **D1** (h1 unique) | 2.6.7-A/B/C | FAIL | **PASS** |
| **D2** (composants dynamiques — progressbar onboarding) | 2.6.3 | FAIL | **PASS** |
| **D3** (régions live — messagerie `role="log"` + `aria-live`) | 2.6.2 | FAIL | **PASS** |
| **D4** (composants tiers — Leaflet) | 2.6.6 | FAIL | **PASS** (partiel : Leaflet neutralisé via `aria-hidden`+`inert` plutôt que rendu accessible) |
| **E2** (test automatisé axe-core) | 2.6.1 | absent | **PASS** |

## What worked / Successes

- **Découpage 2.6.7 en 3 sous-stories par zone fonctionnelle** (publique+auth, dashboards, admin) plutôt qu'une story unique sur 32 pages : effort réparti, mergeabilité indépendante, zéro dérive constatée. Pattern à reproduire pour les futures stories de transformation multi-fichiers (anciennement piège 2.5.5).
- **Pattern `<h1 className="sr-only">` pour pages avec `<main>` rendu par composant client** : compromis pragmatique adopté en 2.6.7-A pour `register/page.tsx` et `accompagnante/onboarding/page.tsx`. Permet de respecter D1 (h1 unique) sans bloquer la livraison sur un refactor profond. Refactor planifié explicitement pour Lot C 2.7.1 (livré : statut `done`).
- **Garde-fou grep cumulatif `wc -l = 0`** : détection automatique de pages oubliées (`<h1>` manquant, `id="main-content"` ajouté hors `<main>`). Exécuté en début de chaque story 2.6.7 : zéro faux positif, zéro régression.
- **Audit Leaflet en mode statique avec Stratégie 2 (`aria-hidden` + `inert`)** : décision de neutraliser la carte interactive pour les technologies d'assistance plutôt que de la rendre accessible (la complexité d'une alternative clavier complète aurait dépassé la time-box). L'alternative non-visuelle est fournie par les champs « ville » et « rayon » adjacents, déjà présents. Documenté dans Story 2.7.3 page `/accessibilite` (limites connues).
- **Inventaire `inventaire-points-usage-lot-b-2026-05-05.md` faisant foi sur les décomptes** : application directe de la leçon AI-2 du Lot A (« ajouter une section Inventaire des points d'usage au tech-spec / story dès qu'une refonte multi-fichiers est en jeu »). L'inventaire a permis de cadrer 2.6.4 (24 occurrences erreurs inline), 2.6.6 (audit Leaflet) et 2.6.7 (32 pages applicatives) avec un décompte explicite en amont. **Aucune dérive d'effort** sur ces stories — c'est la principale différence avec Lot A 2.5.5.

## What didn't work / Imparfaits

- **Compromis register + onboarding (h1 hors `<main>`)** : la convention canonique veut `<h1>` à l'intérieur du `<main id="main-content">` pour que le skip-link conduise directement au titre principal. Sur ces 2 pages, le `<main>` est rendu par un composant client (extraction historique non-revisitée), donc `<h1>` posé en page wrapper avec `sr-only`. Refactor reporté Lot C **2.7.1 (statut done)** : extraction du `<main>` du composant client vers la page wrapper.
- **Saut h1 → h3 sur cards (`heading-order` règle `moderate`)** : la hiérarchie de titres saute h1 → h3 sur ~10 pages porteuses de cards (annonces, profils). Non bloquant pour le baseline Critical/Serious (la règle est `moderate` chez axe-core), mais imparfait pour la lecture linéaire d'un lecteur d'écran. Refactor reporté Lot C **2.7.2 (statut done)** : transformation systématique `<h3>` → `<h2>` sur les cards.
- **Tests manuels VoiceOver narratifs (3 échantillons)** : 2.6.2 (messagerie), 2.6.3 (onboarding aux), 2.6.6 (recherche post-Leaflet) ont fait l'objet d'un test manuel narratif documenté en Dev Notes. Ce n'est pas une exécution formelle systématique sur les 7 parcours. La couverture VoiceOver complète + NVDA reste un objectif Lot D. Acceptable à ce stade : la fondation automatisée (axe-core sur 7 parcours) est solide.

## Dérives effort

| Story | Estimé tech-spec | Réalisé | Delta |
|---|---|---|---|
| 2.6.1 | 0,75 j | 0,75 j | 0 % |
| 2.6.2 | 1,0 j | 1,0 j | 0 % |
| 2.6.3 | 1,0 j | 1,0 j | 0 % |
| 2.6.4 | 1,0 j | 1,0 j | 0 % |
| 2.6.5 | 0,25 j | 0,25 j | 0 % |
| 2.6.6 | 1,0 j | 1,0 j (Task 7 bonus `select-name` incluse) | 0 % |
| 2.6.7-A | 0,5 j | 0,5 j | 0 % |
| 2.6.7-B | 0,5 j | 0,5 j | 0 % |
| 2.6.7-C | 0,25 j | 0,25 j | 0 % |
| **Total Lot B** | **6,25 j-dev** | **6,25 j-dev** | **0 % (vs +8 % Lot A)** |

**Total Lot B = effort estimé, pas de dérive (vs +8 % Lot A).** La marge intégrée dans les découpages (2.6.4 multi-fichiers cadrée 1 j, 2.6.7 splitée en 3 sous-stories) a tenu. La leçon AI-2 du Lot A (« inventaire des points d'usage formalisé en amont ») a été appliquée et a démontré son ROI : **0 % de dérive sur 6,25 j-dev** vs +8 % sur 3,5 j-dev en Lot A.

À noter : 2.6.6 a absorbé une Task 7 bonus (résorption de la violation `select-name` initiale du baseline 2.6.1) sans dérive — ce qui valide aussi la marge native du cadrage.

## Décisions prises pendant le mini-épic

- **D5 (2.6.1)** : choix `@axe-core/playwright` plutôt que `@axe-core/cli` standalone, pour permettre la couverture des parcours authentifiés (proxy `/login`). Acté dans `tests/a11y/`.
- **D6 (2.6.4)** : pas de composant central `<ErrorAlert>` extrait. Les 24 occurrences de pattern `role="alert"` restent inline dans les formulaires existants. Décision pragmatique : un composant central aurait demandé un refactor de tous les formulaires sans gain a11y immédiat. Confirmé Lot C : pas de nouveau composant transverse.
- **D7 (2.6.6)** : Stratégie 2 retenue pour Leaflet (`aria-hidden`+`inert` + champs adjacents) plutôt que Stratégie 1 (rendre la carte clavier-accessible) ou Stratégie 3 (remplacer Leaflet). Coût Stratégie 1 estimé à 3-5 j-dev hors scope Lot B. Documenté dans `audit-a11y-2026-05-04.md` et page publique `/accessibilite` (Story 2.7.3 - section Limites connues).
- **D8 (Lot B global)** : confirmation du pattern double commit `livraison` puis `statut done apres CI Vercel verte` (D4 Lot A). Tenu sur les 9 stories du Lot B sans exception.

## Action items reportés

- **AI-5** : refactor pages à `<main>` rendu par composant client → couvert Lot C **2.7.1 (statut done)** pour register et onboarding accompagnante, complété par **2.7.6 (statut done)** pour les pages auth jumelles (login, forgot-password, reset-password, etc.). Plus d'action requise.
- **AI-6** : transformation systématique cards `<h3>` → `<h2>` → couvert Lot C **2.7.2 (statut done)**. Plus d'action requise.
- **AI-7** : page publique `/accessibilite` listant engagements et limites → couvert Lot C **2.7.3 (statut review au moment de la rédaction)**. Plus d'action requise.
- **AI-8** : bascule `a11y:axe:check` bloquant → couvert Lot C **2.7.4 (statut review au moment de la rédaction, Option 1 retenue par Project Lead 2026-05-06)**. Plus d'action requise.
- **AI-9** : couverture VoiceOver/NVDA formelle systématique sur les 7 parcours → **reporté Lot D** (hors scope Lot C minimaliste). À cadrer si demande externe (audit RGAA, certification, levée de fonds).
- **AI-10** : cible tactile 44×44 px (audit + correction systématique) → **reporté Lot D**. Limite explicitement déclarée dans la page `/accessibilite` (Story 2.7.3, section Limites connues).
- **AI-11** : bascule `eslint-plugin-jsx-a11y` `warn` → `error` → **après baseline à 0**. Aujourd'hui baseline = 155, donc bascule encore prématurée. Action héritée du Lot A (AI-3), repoussée d'un mini-épic supplémentaire (Lot D ou story dédiée).

## Statut de clôture

- Mini-épic 2.6 (Lot B) : **complet**, 9/9 stories à `done` (CI Vercel verte sur `main`).
- Baseline axe-core : **0 violations Critical/Serious sur 7 parcours** (vs 1 initiale, **-100 %**). Première mise au standard NFR.
- Baseline `lint:a11y-check` : **155** (vs 158 entrée Lot B, **-3**).
- Garde-fou h1 unique : **0 page sans h1 sur 47** (sécurité automatique).
- DoD a11y : opérationnelle et appliquée sur les 9 stories.
- Pattern `review` → `done` après CI Vercel verte : tenu sur les 9 stories.
- TypeScript : 0 erreur.
- 9 critères NFR FAIL → PASS (A3, B3, C1, C2, D1, D2, D3, D4 partiel, E2).

## Actions Lot C

Cadrage Lot C dans `tech-spec-lot-c-a11y.md` (2026-05-06). 6 stories courtes, ~2 j-dev, focus sur :

1. **2.7.5** — cette rétrospective Lot B documentée (statut : en cours de rédaction, sera `done` après lecture Project Lead).
2. **2.7.1** — refactor pages à `<main>` rendu par composant client (register, onboarding accompagnante) (statut : **done**).
3. **2.7.2** — heading-order : cards `<h3>` → `<h2>` (statut : **done**).
4. **2.7.3** — page publique `/accessibilite` (statut : **review** au moment de la rédaction, en attente CI Vercel verte).
5. **2.7.4** — bascule `a11y:axe:check` bloquant — Option 1 (audit local discipline) retenue par Project Lead 2026-05-06 (statut : **review** au moment de la rédaction, en attente CI Vercel verte).
6. **2.7.6** — refactor pages à `<main>` rendu par composant client (auth jumelles : login, forgot-password, reset-password, etc.) (statut : **done**) — complément de 2.7.1 sur le périmètre auth restant.

Le Lot C est volontairement minimaliste (2 j-dev) : il consolide l'acquis Lot B sans engager les 6-8 j d'un Lot D « conformité externe avancée » (tests automatisés scénarios complets, VoiceOver/NVDA formels, cible tactile 44×44 px, bascule jsx-a11y `error`, audit admin).

**Re-run NFR a11y post-Lot C** : prévu après bascule complète des 5 stories Lot C en `done`. Ce document de rétro et `lot-b-bilan-axe-core-2026-05-06.md` servent d'inputs principaux au re-run.

## Notes de session

- Rétro produite à la demande du Project Lead pendant la session de clôture du Lot C, après bascule de 2.7.1, 2.7.2, 2.7.6 en `done` et de 2.7.3, 2.7.4 en `review`.
- Format condensé volontaire (pas de party-mode, pas de dialogue multi-agent), aligné sur la rétro Epic 2 du 2026-05-04 et la rétro Lot A du 2026-05-05.
- Points appuyés explicitement à la demande : baseline axe-core 1 → 0 (première mise au standard), baseline lint 158 → 155, **0 % de dérive d'effort** (vs +8 % Lot A — validation directe de la leçon AI-2 « inventaire des points d'usage »), pattern h1 sr-only comme compromis pragmatique reportable, découpage 2.6.7 en 3 sous-stories.
- Aucun `sprint-status.yaml` existant — la mise à jour automatique `epic-X-retrospective: done` du workflow ne s'applique pas. Ce fichier de rétro fait office de marqueur de clôture, comme `mini-epic-2-5-retro-2026-05-05.md`.

## Références

- `_bmad-output/implementation-artifacts/lot-b-bilan-axe-core-2026-05-06.md` — source quantitative principale (baseline 1 → 0, détail par parcours, couverture stories vs NFR).
- `_bmad-output/test-artifacts/nfr-assessment-a11y-2026-05-04.md` — NFR assessment initial (baseline critères FAIL avant Lot B).
- `_bmad-output/implementation-artifacts/tech-spec-lot-b-a11y.md` — cadrage prévu (10 stories, 6,25 j-dev — splitées 9 stories au moment de la livraison via 2.6.7-A/B/C).
- `_bmad-output/planning-artifacts/inventaire-points-usage-lot-b-2026-05-05.md` — inventaire des points d'usage Lot B (leçon AI-2 du Lot A appliquée).
- `_bmad-output/implementation-artifacts/mini-epic-2-5-retro-2026-05-05.md` — rétro Lot A (pattern de référence structurel).
- `_bmad-output/implementation-artifacts/tech-spec-lot-c-a11y.md` — cadrage Lot C (5 stories, 2 j-dev).
- `_bmad-output/implementation-artifacts/audit-a11y-2026-05-04.md` — audit a11y initial (criteres FAIL recensés).
