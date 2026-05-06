# Rétrospective — Mini-épic 2.7 (Lot C accessibilité)

**Date** : 2026-05-06
**Project Lead** : Sylvain
**Format** : rétro courte, structure calquée sur `mini-epic-2-5-retro-2026-05-05.md` et `mini-epic-2-6-retro-2026-05-06.md`. Pas de party-mode.

## Résumé mini-épic

**Périmètre** : Lot C du chantier accessibilité (NFR WCAG 2.2 AA). Verrouillage public et CI des acquis Lot B : refactor des compromis pragmatiques `<main>` rendu côté composant client (2.7.1, 2.7.6), correction du saut hiérarchie h1 → h3 sur cards (2.7.2), page publique RGAA `/accessibilite` (2.7.3), durcissement de la règle CLAUDE.md `npm run a11y:axe:check` en obligation (2.7.4), rétrospective Lot B documentée (2.7.5). Aligné sur le tech-spec `tech-spec-lot-c-a11y.md` et l'inventaire `inventaire-points-usage-lot-c-2026-05-06.md`.

**Stories livrées (6/6)**

- **2.7.1** — Refactor pages à `<main>` rendu côté composant client (`/register`, `/accompagnante/onboarding`)
- **2.7.2** — Heading-order : cards `<h3>` → `<h2>` (48 transformations sur 10 pages + 8 bonus dans `profile-form` post-code-review)
- **2.7.6** — Refactor pages auth jumelles (`/login`, `/forgot-password`, `/reset-password`) à `<main>` Server Component (story ajoutée en cours de Lot C, identifiée comme trou de cohérence par Edge Case Hunter en code review 2.7.1)
- **2.7.3** — Page publique `/accessibilite` (Server Component, 5 sections RGAA, lien footer 4ème entrée nav légale, sitemap)
- **2.7.4** — Bascule `a11y:axe:check` bloquant CI — Option 1 retenue par Project Lead 2026-05-06 (audit local discipline). Modif unique `.claude/CLAUDE.md` ligne 6
- **2.7.5** — Rétrospective Lot B documentée (`mini-epic-2-6-retro-2026-05-06.md`, 6 sections + complémentaires)

**Branche / merge** : commits directs sur `main`, double commit `livraison` puis `statut done apres CI Vercel verte` tenu sur les 6 stories sans exception (`7b0e9d3` + `47e852e` ; `7aa1b13` + `08d5f01` ; `f7bea85` + `ec7bb6c` ; `857889c` + `acc7e70` ; `c6254a9` + `282a29c` ; `988cc07` + `9f41675`).

**Code reviews** : 3 stories (2.7.3, 2.7.4, 2.7.5) ont été rejouées en passes 2/3 dans une session enchaînée 2026-05-06 avec 3 layers indépendants (Blind Hunter / Edge Case Hunter / Acceptance Auditor) via `bmad-code-review`. Total 68 findings bruts triés sur ces 3 stories (28 + 18 + 22), 3 patches factuels appliqués sur la rétro Lot B + 1 patch léger ré-étiquetage NFR + 3 décisions tranchées en defer cohérent.

## Résultats quantitatifs

### Baseline a11y maintenue

| Métrique | Entrée Lot C | Sortie Lot C | Delta |
|---|---|---|---|
| `lint:a11y-check` | 155 | 155 | 0 |
| `a11y:axe:check` (Critical/Serious sur 7 parcours) | 0 | 0 | 0 |
| Garde-fou DOM `grep '<main id="main-content"' components/` | 0 | 0 | 0 |
| `grep 'id="main-content"' app/` | 30 | 33 | +3 (ajout `/accessibilite` + 2 wrappers refactor) |

**Aucune régression** sur la baseline acquise au Lot B. La règle de durcissement `a11y:axe:check` exit 0 obligatoire (2.7.4) est désormais auditée à chaque commit livraison.

### Verrouillage projet

- **Page publique RGAA** publiée sur `/accessibilite` (déclaration de conformité partielle AA, 5 sections, contact mailto fonctionnel) → engagement public formalisé.
- **Footer 4ème lien `<Link href="/accessibilite">`** ajouté au pattern nav légale (Mentions légales / Politique de confidentialité / **Accessibilité** / CGU).
- **Sitemap** : entrée `/accessibilite` ajoutée pour découvrabilité crawler.
- **Règle CLAUDE.md ligne 6 durcie** : passage de recommandation (« en complément, exécuter ») à obligation (« avant tout commit livraison story, exécuter et confirmer exit 0 »). Correction « 6 → 7 parcours ». Phrase de conséquence ajoutée (« rejeté au code review »).

### Critères NFR : statuts post-Lot C

Les 4 critères couverts partiellement Lot B sont consolidés Lot C, et le Lot C ajoute 1 critère opérationnel (process) :

| Critère | Couverture Lot C | Statut Lot B | Statut post-Lot C |
|---|---|---|---|
| **D1** (h1 unique + landmarks) | 2.7.1, 2.7.6 (refactor `<main>` côté Server Component) | PASS partiel (compromis sr-only) | **PASS strict** (h1 dans `<main>` sur toutes les pages publiques + auth) |
| **D1 hiérarchie** | 2.7.2 (h3 → h2 cards, 48 occurrences) | PASS partiel (saut h1→h3) | **PASS strict** (heading-order respectée) |
| **F1** (DoD a11y / déclaration publique) | 2.7.3 (page `/accessibilite`) | PASS DoD interne | **PASS + engagement public** |
| **E2** (test automatisé bloquant) | 2.7.4 (`a11y:axe:check` exit 0 obligatoire) | PASS local | **PASS bloquant code review** |
| **Process — qualité de la rétro** | 2.7.5 (rétro Lot B) | absent | **PASS** (rétro documentée + leçons capturées) |

## What worked / Successes

- **Décision pragmatique d'ajouter 2.7.6 en cours de Lot C** : le code review de 2.7.1 (Edge Case Hunter finding #3) a identifié que les pages auth jumelles (`/login`, `/forgot-password`, `/reset-password`) souffraient du même compromis que `/register` et `/accompagnante/onboarding`, mais hors scope explicite de 2.7.1. Décision Project Lead 2026-05-06 : créer 2.7.6 dédiée plutôt qu'étendre 2.7.1. **Discipline scope** confirmée comme leçon Lot C — application directe de la leçon Lot A « ne pas étendre une story en cours de revue ». La création d'une story dédiée a permis un cycle livraison + clôture complet et indépendant.
- **3 passes de code review en session enchaînée sans interruption** sur 2.7.3 / 2.7.4 / 2.7.5 (consigne utilisateur explicite « enchaîne sans t'arrêter aux checkpoints »). Les passes 2 et 3 ont révélé des findings significatifs absents des auto-reviews initiales : (a) defer R4 élargi de 1 à **5 fichiers projet** sur la divergence « 6 vs 7 parcours » (PRD, NFR assessment, inventaire Lot C, README, auto) ; (b) **3 patches factuels** appliqués sur la rétro Lot B (page counts 2.6.7-A/B/C 8/12/12 → 10/11/11, commit clôture `a0cdb8a` faux = 2.6.7-B en réalité, story 2.7.6 omise de Actions Lot C) ; (c) **patch léger ré-étiquetage NFR** (D3/C2 confondus, ajout C1 dette select-name → table 8 → 9 critères). Pattern à reproduire : multi-layer review avec triage structuré beat l'auto-review pour des stories de documentation.
- **Bascule `a11y:axe:check` bloquant via Option 1 (audit local)** plutôt qu'Option 2 (hook git) ou Option 3 (webhook Vercel) : décision Project Lead documentée, traçable, et **non-invasive cote outillage**. Coût marginal pour un projet solo dev (aucune friction technique, aucune dépendance externe). Re-évaluation Option 2/3 conditionnelle si autre contributeur ou fréquence accrue.
- **Pattern projet réel privilégié au pseudo-code du tech-spec** (story 2.7.3) : le tech-spec contenait un pseudo-code de page `/accessibilite` qui ne correspondait pas au pattern des pages legales jumelles (`mentions-legales`, `cgu`, `politique-de-confidentialite`). Décision dev-story : suivre le pattern réel des siblings, **pas le pseudo-code**. Résultat : code aligné avec le repository, pas de divergence visuelle, maintenance future homogène. Pattern à reproduire : « tech-spec donne l'intent, pas la lettre du code ».
- **0 % de dérive d'effort** sur les 6 stories Lot C (vs 0 % Lot B, +8 % Lot A). Le découpage en stories courtes (0,25 à 0,5 j-dev chacune) avec pas de dépendance inter-stories (sauf 2.7.4 en clôture) a tenu. Le scope creep évité explicitement (2.7.6 dédiée plutôt qu'extension 2.7.1) confirme la discipline.

## What didn't work / Imparfaits

- **Auto-review insuffisante sur stories doc-only** (2.7.4 et 2.7.5) : les auto-reviews intégrées en passe 1 ont validé les ACs strictement mais raté des incohérences inter-corpus (defer R4 limité à 1 fichier au lieu de 5 ; chiffres rétro Lot B propagés depuis le bilan source sans vérification commits). La passe 2 multi-layer a corrigé ces angles morts. **Leçon** : pour les stories de documentation pure, l'auto-review en dev-story doit être complétée par au moins un layer Edge Case Hunter cross-corpus avant le commit livraison.
- **Confusion d'étiquetage NFR (D3 / C2 / C1) dans la rétro Lot B** : la rétro initiale présentait « 4 critères FAIL bloquants (B3 messagerie, D2 onboarding aux progressbar, D3 erreurs inline, D4 + dette select-name) » alors que les intitulés NFR officiels (`nfr-assessment-a11y-2026-05-04.md:109-128`) sont **D3** régions live (= messagerie), **C2** erreurs annoncées (= erreurs inline), **C1** labels (= select-name), **D4** composants tiers (= Leaflet). La table FAIL → PASS reproduisait la même confusion. Patch léger appliqué passe 2 : ré-étiquetage complet, table passe de 8 à 9 critères. **Leçon** : ré-citer le NFR initial avec ses intitulés officiels au lieu de paraphraser de mémoire.
- **Page counts Lot B 2.6.7-A/B/C 8/12/12 propagés depuis tech-spec/bilan** alors que la livraison réelle est 10/11/11 (cf. titres commits `9992ee5`, `a0cdb8a`, `8aad621`). Le total 32 reste correct par coïncidence arithmétique, ce qui a masqué l'erreur en relecture rapide. **Leçon** : vérifier les page counts d'une rétro contre les titres de commits, pas contre le tech-spec source.
- **Commit clôture Lot B identifié à tort comme `a0cdb8a` dans le bilan + rétro Lot B** : `a0cdb8a` est en réalité la livraison 2.6.7-B (« h1 unique sur 11 pages dashboards + 2 bonus modifier »). Le baseline JSON axe-core a été figé à ce commit, ce qui a induit la confusion. Vrais commits 2.6.7-C : `8aad621` livraison, `91d1e5f` done. Patch appliqué passe 2. **Leçon** : distinguer « commit baseline JSON » (utilisé par `check-axe-baseline.mjs`) et « commit clôture mini-épic » dans les rétros.
- **Story 2.7.6 absente de la section Actions Lot C de la rétro Lot B** lors de sa première rédaction (5 stories listées au lieu de 6, AI-5 affirmant « refactor `<main>` couvert 2.7.1 statut done. Plus d'action requise »). Patch appliqué passe 2. **Leçon** : quand une story est ajoutée a posteriori en code review (ce qui est rare mais arrive), mettre à jour les rétros et inventaires en aval.

## Dérives effort

| Story | Estimé tech-spec | Réalisé | Delta |
|---|---|---|---|
| 2.7.5 retro Lot B | 0,25 j | 0,25 j (dont passes 2 review) | 0 % |
| 2.7.1 refactor `<main>` | 0,5 j | 0,5 j | 0 % |
| 2.7.2 heading-order cards | 0,5 j | 0,5 j (dont 8 transfo bonus profile-form) | 0 % |
| 2.7.6 refactor auth jumelles (ajoutée) | (n/a tech-spec) | ~0,5 j | n/a |
| 2.7.3 page `/accessibilite` | 0,5 j | 0,5 j (3 passes review incluses) | 0 % |
| 2.7.4 bascule axe-check | 0,25 j | 0,25 j | 0 % |
| **Total Lot C** | **2 j-dev** (5 stories) | **~2,5 j-dev** (6 stories) | **+25 % en absolu / 0 % par story** |

**Lecture** : la dérive +25 % en absolu est entièrement due à l'ajout de 2.7.6 en cours de mini-épic. Aucune story individuelle n'a dérivé. Les stories doc-only (2.7.4, 2.7.5) ont tenu malgré les passes 2 de code review enchaînées. Pattern de cadrage Lot B (« inventaire en amont ») confirmé : 0 % de dérive par story sur les 5 stories planifiées.

## Décisions prises pendant le mini-épic

- **D9 (2.7.1)** : ne pas étendre 2.7.1 aux pages auth jumelles malgré le finding Edge Case Hunter — créer 2.7.6 dédiée. Discipline scope priorisée sur l'opportunité d'élargissement.
- **D10 (2.7.3)** : suivre le pattern réel des pages legales jumelles (`mentions-legales`, `cgu`, `politique-de-confidentialite`) plutôt que le pseudo-code du tech-spec. Tech-spec = intent, pas lettre du code.
- **D11 (2.7.3)** : adresse mailto active `roxanetnous@outlook.com` au lieu d'un placeholder bracketed comme dans `mentions-legales`. Décision : engagement RGAA = canal de contact réel obligatoire, divergence intentionnelle avec siblings.
- **D12 (2.7.3 passe 2)** : clarifier le statut MVP « non assujetti aux obligations légales de déclaration RGAA » (article 47 loi 2005-102, décret 2019-768). Évite la dérive RGAA officielle (taux chiffré + dérogations) qui n'a pas de sens hors entité assujettie.
- **D13 (2.7.4)** : Option 1 retenue par Project Lead 2026-05-06 (audit local discipline) plutôt qu'Option 2 (hook git) ou Option 3 (webhook Vercel). Justification 4 points (contexte solo dev, coupures rares, écart Option 2/3, re-évaluation conditionnelle) tracée dans la story.
- **D14 (2.7.5 passe 2)** : ré-étiquetage NFR appliqué sur la rétro Lot B (D3/C2 distinctes, ajout C1 dette select-name) plutôt que defer. Rétro doit être lisible seule, sans renvoi NFR à chaque ambiguïté.
- **D15 (2.7.3 passe 3 + 2.7.4 passe 2)** : 2 decisions tranchées en defer cohérent — footer overflow <320px (cible hors DoD), précisions de portée règle CLAUDE.md (sens commun couvre, polish doc post-Lot C).

## Action items reportés

- **AI-12** : story polish doc post-Lot C (defer R4 élargi) — synchroniser PRD `prd.md:17,272,283,291`, NFR assessment `nfr-assessment-a11y-2026-05-04.md` (10 occurrences), inventaire Lot C `inventaire-points-usage-lot-c-2026-05-06.md:99`, et README `tests/a11y/README.md:3,115` de « 6 parcours » → « 7 parcours » avec **note de réconciliation explicite** (6 = parcours métier PRD ; 7 = entrées baseline JSON axe-core, P4 = 2 sous-entrées `p4-login` + `p4-register`). À cadrer en story 2.X.Y dédiée.
- **AI-13** : re-run NFR a11y post-Lot C — inputs principaux = `mini-epic-2-6-retro-2026-05-06.md` + `lot-b-bilan-axe-core-2026-05-06.md` + cette rétro. Document distinct, post-clôture Lot C.
- **AI-14** : footer overflow <320px (decision tranchée defer Lot C) — à reconsidérer si la couverture mobile <320px devient une exigence projet (zoom 200% systématique, audit cible tactile). Story polish footer transverse.
- **AI-15** : précisions de portée règle CLAUDE.md ligne 6 — clarifier explicitement les cas non triviaux (stories doc-only, commit `done` post-CI, suffixes lettres `2.6.7-A`). À couplage avec AI-12 si polish doc post-Lot C est lancée.
- **AI-11 (héritage Lot A/B)** : bascule `eslint-plugin-jsx-a11y` `warn` → `error` — toujours bloqué tant que baseline `lint:a11y-check` > 0 (155 actuellement). Reporté Lot D ou story dédiée de résorption baseline.
- **AI-9 (héritage Lot B)** : couverture VoiceOver/NVDA formelle systématique sur les 7 parcours — reporté Lot D si demande externe (audit RGAA, certification, levée).
- **AI-10 (héritage Lot B)** : cible tactile 44×44 px (audit + correction systématique) — reporté Lot D. Limite explicitement déclarée dans `/accessibilite` (Story 2.7.3 section Limites connues).

## Statut de clôture

- Mini-épic 2.7 (Lot C) : **complet**, 6/6 stories à `done` (CI Vercel verte sur `main`, 12 commits livraison + clôture).
- Baseline `a11y:axe:check` : **0 violations Critical/Serious sur 7 parcours** (stable Lot C, validée à chaque commit livraison).
- Baseline `lint:a11y-check` : **155** (stable Lot C).
- Garde-fou DOM : **0 occurrence** `<main id="main-content"` dans `components/`.
- Page publique `/accessibilite` : **publiée**, lien footer + sitemap intégrés.
- Règle CLAUDE.md ligne 6 : **durcie en obligation** (Option 1 audit local).
- Rétrospective Lot B : **documentée**, ré-étiquetée NFR, patches factuels appliqués.
- Pattern double commit `livraison` puis `statut done apres CI Vercel verte` : tenu sur les 6 stories sans exception.
- TypeScript : 0 erreur.
- 5 critères NFR transitionnent partiel/local → strict/bloquant : **D1** (h1 + landmarks strict), **D1 hiérarchie** (heading-order strict), **F1** (DoD + déclaration publique), **E2** (test automatisé bloquant code review), **Process** (rétro Lot B documentée).

## Actions Lot D / suite

Pas de Lot D cadré au 2026-05-06. Le **re-run NFR a11y post-Lot C** (AI-13) est la prochaine étape attendue, avec deux scénarios :

1. **Scenario interne (par défaut)** : re-run NFR documenté, mise à jour `prd.md` et `nfr-assessment-a11y-2026-05-04.md` pour refléter les transitions FAIL → PASS du Lot C (9 critères Lot B + 5 critères Lot C consolidés), polish doc cross-corpus (AI-12). Pas de nouveau scope a11y avant retour utilisateur.
2. **Scenario externe (si déclencheur)** : audit RGAA externe / certification / levée de fonds → cadrer Lot D (6-8 j-dev) sur les chantiers reportés AI-9, AI-10, AI-11 + audit admin + tests automatisés scénarios complets.

**Re-run NFR a11y post-Lot C** : prévu après stabilisation 24-48h des 6 stories Lot C en `done` sur `main`. Ce document de rétro, `mini-epic-2-6-retro-2026-05-06.md` (ré-étiquetée), `lot-b-bilan-axe-core-2026-05-06.md` et les 6 fichiers stories Lot C servent d'inputs principaux au re-run.

## Notes de session

- Rétro produite immédiatement après clôture des 6 stories Lot C en `done` (post-push commits clôture `acc7e70` + `282a29c` + `9f41675`, CI Vercel verte sur déploiement `q1bwkic87` en 41s).
- Format condensé volontaire (pas de party-mode, pas de dialogue multi-agent), aligné sur la rétro Lot A `mini-epic-2-5-retro-2026-05-05.md` et la rétro Lot B `mini-epic-2-6-retro-2026-05-06.md`.
- Points appuyés explicitement à la demande : **discipline scope ajout 2.7.6**, **3 passes de code review enchaînées sans interruption** (2.7.3 passe 3, 2.7.4 passe 2, 2.7.5 passe 2), **3 patches factuels + 1 patch léger** appliqués sur la rétro Lot B en cascade par les findings passe 2, **defer R4 élargi de 1 à 5 fichiers projet** comme découverte significative passe 2, **Option 1 audit local** retenue comme choix de Project Lead.
- Aucun `sprint-status.yaml` existant — la mise à jour automatique `epic-X-retrospective: done` du workflow ne s'applique pas. Ce fichier de rétro fait office de marqueur de clôture, comme `mini-epic-2-5-retro-2026-05-05.md` et `mini-epic-2-6-retro-2026-05-06.md`.
- Mémoire `project_a11y_lot_c.md` mise à jour 2026-05-06 (passage de 3/6 done à 6/6 done, ajout des enseignements passes 2/3 review, clôture mini-épic).

## Références

- `_bmad-output/implementation-artifacts/tech-spec-lot-c-a11y.md` — cadrage prévu Lot C (5 stories, 2 j-dev — splitées 6 stories au moment de la livraison via 2.7.6 ajoutée).
- `_bmad-output/planning-artifacts/inventaire-points-usage-lot-c-2026-05-06.md` — inventaire des points d'usage Lot C.
- `_bmad-output/implementation-artifacts/mini-epic-2-6-retro-2026-05-06.md` — rétrospective Lot B (livrée par 2.7.5, ré-étiquetée NFR passe 2).
- `_bmad-output/implementation-artifacts/lot-b-bilan-axe-core-2026-05-06.md` — bilan quantitatif Lot B (source).
- `_bmad-output/implementation-artifacts/mini-epic-2-5-retro-2026-05-05.md` — rétro Lot A (pattern de référence structurel).
- `_bmad-output/test-artifacts/nfr-assessment-a11y-2026-05-04.md` — NFR assessment initial (intitulés officiels D1-D4 / C1-C2 / E2 / F1).
- `_bmad-output/planning-artifacts/prd.md` — autorité produit (à synchroniser AI-12).
- `.claude/CLAUDE.md` ligne 6 — règle a11y durcie par 2.7.4.
- `_bmad-output/implementation-artifacts/2-7-1-refactor-main-pages-client.md` — story 2.7.1 (livrée).
- `_bmad-output/implementation-artifacts/2-7-2-heading-order-cards-h3-h2.md` — story 2.7.2 (livrée).
- `_bmad-output/implementation-artifacts/2-7-3-page-publique-accessibilite.md` — story 2.7.3 (livrée, 3 passes review).
- `_bmad-output/implementation-artifacts/2-7-4-bascule-axe-check-bloquant.md` — story 2.7.4 (livrée, 2 passes review).
- `_bmad-output/implementation-artifacts/2-7-5-retrospective-lot-b.md` — story 2.7.5 (livrée, 2 passes review + 3 patches appliqués).
- `_bmad-output/implementation-artifacts/2-7-6-refactor-main-pages-auth-jumelles.md` — story 2.7.6 (ajoutée en cours, livrée).
- `_bmad-output/implementation-artifacts/deferred-work.md` — defer cumulatif Lot C (sections passes 1/2/3 cf. lignes 109-151+).

## DoD a11y

**N/A** : story de documentation pure (création d'un seul fichier markdown dans `_bmad-output/implementation-artifacts/`). Aucun impact UI, aucun changement visuel ou interactif. La checklist DoD a11y ne s'applique pas (cf. template.md « ignorer si pas de changement visuel/interactif »).

Vérifications a11y de régression (no-op attendu) :

- [x] Pas de régression `eslint-plugin-jsx-a11y` (`npm run lint:a11y-check` vert) — baseline 155 stable.
- [x] Pas de régression axe-core (`npm run a11y:axe:check` vert) — 0 delta Critical/Serious sur 7 parcours.
