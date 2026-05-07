---
stepsCompleted: ['index-only-rétroactif']
inputDocuments:
  - prd.md
  - ../../DECISIONS.md
  - ../../docs/mvp-coverage.md
  - epic-3.md
workflowType: 'epics-index'
note: 'Index minimaliste créé rétroactivement 2026-05-06 pour compatibilité avec bmad-sprint-planning. Les Epic 1 et Epic 2 sont reconstitués depuis l''historique BMad. Epic 3 cadré formellement dans epic-3.md.'
created: '2026-05-06'
---

# roxanetnous — Epic Breakdown (index)

## Vue d'ensemble

Cet index recense les épics du projet roxanetnous. Il a été créé rétroactivement après la livraison des Epic 1 et Epic 2, pour permettre aux workflows BMad downstream (`bmad-sprint-planning`, `bmad-create-story`) de fonctionner sur des références cohérentes.

**Source de vérité par épic :**
- Epic 1 : reconstitué depuis le code livré et les rétros — pas de fichier `epic-1.md` formel.
- Epic 2 : `_bmad-output/implementation-artifacts/epic-2-retro-2026-05-04.md` + tech-specs 2.1 à 2.4 + rétros Lots A/B/C (mini-épics 2.5/2.6/2.7).
- Epic 3 : `_bmad-output/planning-artifacts/epic-3.md` (cadré formellement 2026-05-06).

## Liste des épics

| # | Titre | Statut | Période | FR couverts | Document de référence |
|---|---|---|---|---|---|
| 1 | MVP Core (auth, vérification, abonnement, annonces, recherche, messagerie, dashboards, landing, modération, RGPD) | livré | jusqu'à 2026-04-23 | FR1–FR14, FR17–FR44 (sauf parrainage) | code livré + DECISIONS 2026-02-* |
| 2 | Programme parrainage + Accessibilité transverse (NFR a11y) | livré | 2026-04-18 → 2026-05-06 | parrainage (sans FR explicite, intégré aux annonces et abonnement) ; NFR a11y WCAG 2.2 AA | `epic-2-retro-2026-05-04.md` + tech-specs 2.1-2.4 + rétros 2.5/2.6/2.7 |
| 3 | Lancement Bretagne (déploiement progressif géographique + clarifications produit) | livré | 2026-05-06 → 2026-05-07 | FR16, FR45–FR48, FR6 (audit) | `epic-3.md` + `../implementation-artifacts/epic-3-retro-2026-05-07.md` |
| 4 | Hardening pré-go-live Bretagne (Sentry, schema logNotification, email queue, tests métier, debt résolution) | cadré 2026-05-07, en cours | démarrage 2026-05-07 | NFR fiabilité + NFR sécurité + NFR testabilité + dette technique Epic 2/3 | `epic-4.md` |

## Note de méthode

Les Epic 1 et 2 ne sont **pas re-décomposés en stories** dans ce fichier. Leurs stories sont déjà documentées dans les tech-specs et rétros référencés ci-dessus. Recréer une décomposition rétroactive en stories formatées Given/When/Then serait du bruit sans valeur ajoutée — le code livré et les rétros tiennent lieu de spec a posteriori.

L'Epic 3 est le premier épic du projet à bénéficier d'un cadrage BMad formel **avant** implémentation (cf. `epic-3.md`).

L'Epic 4 « Hardening pré-go-live Bretagne » a été cadré formellement le 2026-05-07 à la suite de la rétrospective Epic 3. Il regroupe **4 stories ordre 1 bloquantes go-live** (4.1 Sentry + rate-limit, 4.2 fix schema logNotification, 4.3 email queue durable, 4.4 tests métier critiques) et **7 stories ordre 2 différées** (4.5 à 4.11). Le toggle admin du premier département Bretagne en production est conditionné à la livraison des 4 stories ordre 1.

## Pointeurs croisés

- **Décisions produit** : `DECISIONS.md` (racine) — fait autorité.
- **PRD à jour** : `prd.md` (incluant FR45-48 ajoutés 2026-05-06).
- **Cartographie MVP livré vs PRD** : `../../docs/mvp-coverage.md`.
- **Trous identifiés (matière brute)** : `../../docs/epic-3-candidates.md`.
- **Architecture initiale** : `architecture-technique-roxanetnous-2026-02-09.md`.
- **NFR Accessibilité** : `../test-artifacts/nfr-assessment-a11y-2026-05-04.md` (re-run AI-13 2026-05-06 PASS avec réserves).
