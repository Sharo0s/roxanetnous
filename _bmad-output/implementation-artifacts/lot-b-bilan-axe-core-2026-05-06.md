# Bilan global axe-core post-Lot B (mini-epic 2.6 a11y)

**Date** : 2026-05-06
**Story de cloture** : 2.6.7-C
**Auteur** : dev-story (claude-opus-4-7)

## 1. Comparatif baseline initial vs final

| Date | Story | Commit | Critical/Serious violations | Nodes affectes |
|---|---|---|---|---|
| 2026-05-05 | 2.6.1 (outillage initial) | `b8f0b69` | **1** | **1** |
| 2026-05-06 | 2.6.7-C (cloture Lot B) | `a0cdb8a` | **0** | **0** |
| **Delta** | — | — | **-1 (-100 %)** | **-1 (-100 %)** |

## 2. Detail par parcours critique

| Parcours | URL | Initial (2.6.1) | Final (2.6.7-C) | Delta |
|---|---|---|---|---|
| P1 — onboarding accompagnante | `/login` (proxy) | 0 | 0 | 0 |
| **P2 — recherche publique** | `/recherche` | **1 Critical (`select-name`)** | **0** | **-1 ✅** |
| P3 — messagerie | `/login` (proxy) | 0 | 0 | 0 |
| P4-login — login | `/login` | 0 | 0 | 0 |
| P4-register — inscription | `/register?role=accompagnante` | 0 | 0 | 0 |
| P5 — landing | `/` | 0 | 0 | 0 |
| P6 — suppression RGPD | `/login` (proxy) | 0 | 0 | 0 |
| **Total** | — | **1** | **0** | **-1** |

## 3. Analyse de la violation resorbee

**Regle** : `select-name` (axe-core, severity Critical, WCAG 4.1.2 Name, Role, Value).

**Cause** : 2 `<select>` sur `/recherche` sans label associe via `htmlFor`/`id` :
- `components/recherche/search-filters.tsx:182` : « Experience » (filtre).
- `app/recherche/page.tsx:281` : « Annonce de reference » (formulaire de matching).

**Resolution** : story 2.6.6 Task 7 — ajout `htmlFor`/`id` explicite (pattern Lot A privilegiant labels visibles natifs a `aria-label`).

**Impact a11y** : les utilisateurs de lecteur d'ecran sur `/recherche` peuvent maintenant identifier le role et le contenu des selects sans interpretation contextuelle.

## 4. Pre-requis bascule `a11y:axe:check` bloquant — STATUS : ATTEINT

Le baseline final a `Critical/Serious violations: 0 | nodes: 0` sur les 7 parcours critiques. **Le pre-requis pour basculer `npm run a11y:axe:check` en mode bloquant en CI est atteint.**

Decision Project Lead requise pour la bascule effective (story future Lot C ou story de configuration CI dediee).

## 5. Couverture stories Lot B vs criteres NFR

| Story | Effort | Critere(s) NFR couvert(s) | Statut |
|---|---|---|---|
| 2.6.1 | 0,75 j | E2 (test automatise) | done |
| 2.6.2 | 1 j | D3, B3 (partiel), C2 (textarea) | done |
| 2.6.3 | 1 j | D2, B3, C2 | done |
| 2.6.4 | 1 j | C2 (audit complet) | review |
| 2.6.5 | 0,25 j | A3 | review |
| 2.6.6 | 1 j | D4 + dette `select-name` 2.6.1 | review |
| 2.6.7-A | 0,5 j | D1 (zone publique + auth) | review |
| 2.6.7-B | 0,5 j | D1 (zone dashboards) | review |
| 2.6.7-C | 0,25 j | D1 (zone admin) + bilan | review (en cours) |
| **Total** | **6,25 j-dev** | **A3, B3, C2, D1, D2, D3, D4, E2** | — |

**Effort reel = effort estime** (vs +33 % derive Lot A 2.5.5). Marge integree dans les decoupages (2.6.4 multi-fichiers, 2.6.7 en 3 sous-stories) a tenu.

## 6. Garde-fous quantitatifs Lot B — recapitulatif

- **`role="alert"` sur erreurs inline** (2.6.4) : 24 occurrences (>= 23 cible AC5).
- **`<h1>` unique sur toutes les pages app** (2.6.7-A/B/C) : `find app -name 'page.tsx' | xargs grep -L '<h1' | wc -l = 0` (47 pages).
- **lint:a11y-check** : 155 / baseline 158 (3 violations resorbees au cours du Lot B).
- **a11y:axe:check** : 0 violations Critical/Serious sur 7 parcours (vs 1 initiale).

## 7. Enseignements & alimentation re-run NFR

### Ce qui a bien fonctionne

- **Decoupage 2.6.7 en 3 sous-stories** par zone fonctionnelle (publique+auth, dashboards, admin) au lieu d'une story unique sur 32 pages : effort reparti, mergeabilite independante, zero derive.
- **Pattern h1 sr-only pour pages avec `<main>` rendu par composant client** : compromis pragmatique (register, onboarding aux) — refactor profond reporte Lot C sans bloquer la livraison.
- **Garde-fou grep cumulatif** sur `wc -l = 0` : detection automatique de nouvelles pages oubliees, declenche zero faux positif.
- **Audit Leaflet en mode statique** (2.6.6) avec decision Strategie 2 (`aria-hidden` + `inert`) : evite la pollution de 5 tab stops par carte sans surcout d'implementation.

### Ce qui reste imparfait (a documenter pour le re-run NFR)

- **Saut de niveau h1 -> h3** sur les pages avec cards (`heading-order` regle `moderate`) : non bloquant car hors scope baseline Critical/Serious, mais ideal a corriger en Lot C (transformation systematique cards `<h3>` -> `<h2>`).
- **Compromis register/page.tsx + accompagnante/onboarding/page.tsx** : `<h1>` hors `<main>` (le `<main>` est rendu par le composant client). Refactor : extraire le markup `<main>` du composant client vers la page wrapper. Reporte Lot C.
- **Spec axe-core admin manquante** : les 11 pages admin n'ont pas de spec parcours dedie (audit ad-hoc lors de cette story uniquement). A ajouter en Lot C si la zone admin devient critique pour la conformite.

### Reportes Lot C (non couverts par Lot B)

- Tests automatises axe-core sur scenarios complets (auth + clic-par-clic).
- Tests manuels VoiceOver/NVDA documentes (Lot B s'est limite a narratifs documentes pour 2.6.2/2.6.3/2.6.6).
- Page `/accessibilite` publique listant les engagements et limites.
- Cible tactile 44x44 px (criteres D5).
- Bascule effective `eslint-plugin-jsx-a11y` `warn` -> `error` (apres baseline a 0).
- Bascule effective `a11y:axe:check` warn -> bloquant.

## 8. Recommandation Project Lead

1. **Marquer Lot B done** apres CI Vercel verte sur 2.6.7-C.
2. **Lancer re-run NFR a11y** post-Lot B avec ce bilan en input + nfr-assessment-a11y-2026-05-04.md initial pour mise a jour.
3. **Decider de la bascule `a11y:axe:check` bloquant** (pre-requis atteint).
4. **Cadrer le Lot C** sur les items « reportes » ci-dessus + la dette `heading-order` + refactor pages a `<main>` rendu par composant client.

---

**Signature** : bilan genere a partir des baselines axe-core initial (2026-05-05, commit `b8f0b69`) et final (2026-05-05, commit `a0cdb8a`, regenere par 2.6.7-C). Donnees verifiables via `git show e13d12a:_bmad-output/test-artifacts/axe-core-baseline-2026-05-05.json` (initial) et le fichier au HEAD (final).
