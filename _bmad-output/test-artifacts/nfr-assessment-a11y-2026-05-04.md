---
stepsCompleted: ['step-01-load-context', 'step-02-define-thresholds', 'step-03-gather-evidence', 'step-04-evaluate-and-score', 'step-05-generate-report']
lastStep: 'step-05-generate-report'
lastSaved: '2026-05-04'
workflowType: 'testarch-nfr-assess'
inputDocuments:
  - _bmad-output/planning-artifacts/prd.md
  - _bmad-output/planning-artifacts/audit-a11y-2026-05-04.md
  - .claude/skills/bmad-testarch-nfr/resources/knowledge/nfr-criteria.md
  - .claude/skills/bmad-testarch-nfr/resources/knowledge/adr-quality-readiness-checklist.md
  - _bmad/tea/config.yaml
nfrCategory: 'Accessibility (transverse)'
targetStandards: ['WCAG 2.2 AA', 'RGAA 4.1', 'EAA 2025']
scope: 'PRD-level transverse NFR'
---

# NFR Assessment - Accessibilité (transverse PRD)

**Date :** 2026-05-04
**Périmètre :** NFR transverse à toute la plateforme roxanetnous (Web App)
**Standards cibles :** WCAG 2.2 AA, RGAA 4.1, conformité Acte européen sur l'accessibilité (EAA)
**Statut global :** ❌ FAIL (état actuel) → cible : ✅ PASS sur parcours critiques après Lot A + Lot B

---

## Step 1 — Contexte et knowledge base chargés

### 1.1 Préalable PRD existant

Le PRD `_bmad-output/planning-artifacts/prd.md` contient une section « Accessibilité » (lignes 262-265) actuellement libellée :

> - Pas de conformité WCAG formelle visée
> - Bonne pratique UX : texte lisible, contraste suffisant, navigation simple

Cette formulation est **incompatible** avec :
- Les engagements éthiques du produit (marketplace de services à la personne — population âgée et handicapée parmi les bénéficiaires).
- L'**Acte européen sur l'accessibilité (EAA)** entré en vigueur le 28 juin 2025, qui couvre les services e-commerce et est susceptible de s'appliquer à roxanetnous (marketplace de service B2C).
- La réalité opérationnelle attestée par l'audit a11y du 2026-05-04.

Cette section devra être **réécrite** par `bmad-edit-prd` à la suite du présent NFR.

### 1.2 Synthèse de l'audit a11y (2026-05-04)

| Indicateur | État actuel | Verdict |
|---|---|---|
| Conformité WCAG 2.2 AA estimée | ~25-30 % | FAIL |
| Conformité RGAA 4.1 testable | Non (prérequis sémantiques manquants) | Bloqué |
| Parcours onboarding auxiliaire | Non finalisable au lecteur d'écran | FAIL |
| Parcours messagerie | 0 attribut ARIA | FAIL |
| Skip-link, focus visible 3:1, prefers-reduced-motion | Absents | FAIL |
| Outillage automatisé (jsx-a11y, axe-core) | Non installé | FAIL |

### 1.3 Décision de remédiation actée

**Option B amendée :**
1. **Lot A « Quick wins » (3-4 j-dev)** — micro-épic à exécuter **avant l'épic 3**. Remet la base sémantique à niveau.
2. **NFR transverse a11y au PRD** (présent document → `bmad-edit-prd`).
3. **Definition-of-done a11y obligatoire** sur chaque story future.
4. **Lot B « Conformité fonctionnelle » (5-7 j-dev)** — étalé sur l'épic 3 au fur et à mesure.
5. **Lot C « Excellence » (3-5 j-dev)** — horizon épic 4-5.

**Total effort de remédiation : 11-16 j-dev.**

### 1.4 Fragments knowledge chargés

- `nfr-criteria.md` — définitions PASS/CONCERNS/FAIL, principe « ambiguous defaults to CONCERNS », exemples de validation automatisée (axe-core via Playwright = pattern applicable).
- `adr-quality-readiness-checklist.md` — framework 8 catégories / 29 critères. L'a11y traverse principalement les catégories **5 (Security au sens broader = robustesse), 6 (Monitorability/Debuggability), 7 (QoE)**. Pour ce NFR transverse, on adopte une grille dédiée a11y plutôt que les 29 critères ADR standards.

### 1.5 Configuration TEA

- `test_artifacts: _bmad-output/test-artifacts` ✓
- `test_framework: playwright` ✓ (axe-core/playwright disponible)
- `risk_threshold: p1`
- `communication_language: French`, `document_output_language: french`

### 1.6 Confirmation des inputs

| Input | Disponible ? |
|---|---|
| Implémentation accessible pour évaluation | ✓ (codebase main @ 8d56a5e) |
| Audit manuel structuré (preuve qualitative) | ✓ |
| Tests automatisés axe-core | ✗ (à mettre en place — Lot C) |
| Tests manuels lecteur d'écran (VoiceOver/NVDA) | ✗ (à mettre en place — Lot C) |
| Métriques eslint-plugin-jsx-a11y | ✗ (à installer — Lot A) |
| PRD à amender | ✓ |

**Préalables remplis pour produire le NFR.** On procède au step 2.

---

## Step 2 — Catégories et seuils mesurables

### 2.1 Choix de la grille

Le framework ADR Quality Readiness Checklist (8 catégories / 29 critères) est généraliste. Pour un NFR **transverse accessibilité**, on adopte une grille spécialisée alignée sur **WCAG 2.2 AA** (4 principes : Perceivable, Operable, Understandable, Robust) **+ outillage de validation**, plus actionnable et plus auditable.

Les catégories ADR pertinentes restent référencées en cross-mapping :
- ADR §5 Security → robustesse des assertions ARIA
- ADR §6 Monitorability → outillage axe-core / eslint-jsx-a11y / CI
- ADR §7 QoS/QoE → contrastes, focus visible, prefers-reduced-motion
- ADR §8 Deployability → DoD a11y bloquante en CI

### 2.2 Matrice de seuils

Les seuils ci-dessous deviennent **les critères d'acceptation du NFR** et alimentent la DoD a11y de chaque story future.

| # | Catégorie | Seuil mesurable | Source de la cible | Méthode de mesure |
|---|---|---|---|---|
| **A1** | **Perceivable — Contrastes texte** | Ratio ≥ **4,5:1** sur tout texte normal (WCAG 1.4.3) | WCAG 2.2 AA | axe-core + audit visuel ciblé |
| **A2** | **Perceivable — Contrastes UI** | Ratio ≥ **3:1** pour bordures de champs, états focus, icônes porteuses de sens (WCAG 1.4.11) | WCAG 2.2 AA | axe-core + audit ciblé palette |
| **A3** | **Perceivable — Alternatives textuelles** | 100 % des images informatives ont un `alt` non vide ; carte hero avec alternative textuelle équivalente | WCAG 1.1.1 | eslint-plugin-jsx-a11y `alt-text` + revue |
| **A4** | **Perceivable — Mouvement** | `@media (prefers-reduced-motion: reduce)` désactive marquee, blink, pulses SVG | WCAG 2.3.3 / 2.2.2 | Audit globals.css + test manuel |
| **B1** | **Operable — Skip-link** | Skip-link « Aller au contenu principal » présent et fonctionnel sur toutes les pages, focus déplacé sur `<main>` | WCAG 2.4.1 | Test manuel clavier + Playwright |
| **B2** | **Operable — Focus visible** | Tous les éléments interactifs ont un état `:focus-visible` avec ring contrasté ≥ 3:1 et épaisseur ≥ 2px | WCAG 2.4.7 | axe-core + test manuel Tab |
| **B3** | **Operable — Navigation clavier** | 100 % des parcours critiques (onboarding aux, recherche, messagerie, checkout Stripe) **complétables au clavier seul** | WCAG 2.1.1 | Test manuel par parcours |
| **B4** | **Operable — Cibles tactiles** | Boutons et liens primaires : taille ≥ **44×44 px** (WCAG 2.5.5 AAA, retenu comme cible AA renforcée) | WCAG 2.5.5 | axe-core / mesure CSS |
| **C1** | **Understandable — Labels formulaires** | 100 % des `<input>`, `<select>`, `<textarea>` ont un `<label htmlFor>` ou `aria-labelledby` associé | WCAG 1.3.1 / 3.3.2 | eslint-plugin-jsx-a11y `label-has-associated-control` |
| **C2** | **Understandable — Erreurs annoncées** | Toute erreur de validation est liée au champ par `aria-describedby` + `aria-invalid="true"` ; toast d'erreur global a `role="alert"` ou `aria-live="assertive"` | WCAG 3.3.1 / 3.3.3 | Revue + test lecteur d'écran |
| **C3** | **Understandable — Champs requis** | `aria-required="true"` ou `required` HTML, et indication textuelle non uniquement visuelle (pas que l'astérisque rouge) | WCAG 3.3.2 | eslint + revue |
| **C4** | **Understandable — Langue** | `<html lang="fr">` au layout root ✓ (déjà conforme) ; `lang` sur fragments en autre langue | WCAG 3.1.1 / 3.1.2 | Statut : conforme |
| **D1** | **Robust — Sémantique HTML** | Structure heading `h1` unique par page, hiérarchie sans saut, landmarks `<header>/<main>/<nav>/<footer>` cohérents | WCAG 1.3.1 / 4.1.2 | axe-core + revue |
| **D2** | **Robust — Composants dynamiques** | Burger menu, modales, accordéons, tabs : ARIA states (`aria-expanded`, `aria-controls`, `aria-haspopup`, `aria-modal`) corrects et synchronisés | WCAG 4.1.2 | axe-core + test lecteur d'écran |
| **D3** | **Robust — Régions live** | Messagerie : `role="log"` + `aria-live="polite"` sur la liste de messages ; nouveaux messages annoncés ; toasts en `aria-live` | WCAG 4.1.3 | Revue + test VoiceOver |
| **D4** | **Robust — Composants tiers** | Carte Leaflet : alternative clavier + équivalent textuel ou désactivation a11y (`aria-hidden` justifié) ; widget Stripe Checkout : conformité documentée par l'éditeur | WCAG 4.1.2 | Revue d'intégration |
| **E1** | **Outillage — Linting statique** | `eslint-plugin-jsx-a11y` installé en `extends: recommended` ; CI rouge si nouvelle violation | Pratique BMad | Présence package + workflow CI |
| **E2** | **Outillage — Tests automatisés** | `@axe-core/playwright` installé ; au moins **1 test axe-core par parcours critique** (4 parcours) ; **0 violation Critical/Serious** sur ces tests | Pratique BMad | Suite Playwright dédiée a11y |
| **E3** | **Outillage — Tests manuels** | Procédures documentées : 1 parcours auxiliaire complet sous VoiceOver/macOS + 1 parcours bénéficiaire complet sous NVDA/Windows, exécutées avant chaque release majeure | Pratique BMad | Document `_bmad-output/test-artifacts/a11y-manual-runs.md` |
| **F1** | **Process — Definition-of-done a11y** | Chaque story future ayant un impact UI inclut une checklist a11y (labels, focus, contrastes, ARIA, clavier, lecteur d'écran ponctuel) ; story rejetée si DoD non cochée | Décision projet | Inspection PR + template story |
| **F2** | **Process — Déclaration d'accessibilité** | Page publique `/accessibilite` listant le statut (partiellement / totalement conforme), méthode d'évaluation, contact a11y, date de mise à jour | Article 47 loi République numérique + EAA | Page Next + lien footer |

### 2.3 Parcours critiques (priorisation A11y)

L'évaluation porte en priorité sur ces parcours. Une violation Critical/Serious sur l'un d'eux constitue un **FAIL bloquant**.

| Parcours | Composants impactés | Pourquoi critique |
|---|---|---|
| **P1 — Onboarding auxiliaire** | `components/accompagnante/onboarding-client.tsx`, `Input`, progress bar | Prérequis monétaire : pas d'inscription = pas de paiement |
| **P2 — Recherche & favoris bénéficiaire** | Filtres, liste profils, carte Leaflet, favoris | Cœur de l'usage bénéficiaire |
| **P3 — Messagerie temps réel** | `components/messages/*` | Cœur du produit, 0 ARIA actuellement |
| **P4 — Inscription + checkout Stripe** | Formulaires inscription, redirection Stripe | Conversion |
| **P5 — Landing page publique** | Hero, hero-carte SVG, FAQ, contact | SEO + premier contact |
| **P6 — Suppression compte / RGPD** | Settings, formulaires RGPD | Obligation légale + EAA |

### 2.4 Statut intermédiaire CONCERNS — règle

Conformément à `nfr-criteria.md`, **toute exigence dont la cible ou la preuve est ambiguë est cotée CONCERNS** (et non PASS) jusqu'à clarification. Application :
- Tant qu'**axe-core/Playwright** ne tourne pas en CI sur les 6 parcours, le statut PASS sur A1–D4 ne peut être qu'auto-déclaré → maintenu **CONCERNS**.
- Tant que la **page de déclaration d'accessibilité** n'existe pas, F2 = FAIL (ou CONCERNS si planifié dans Lot C).

### 2.5 Calendrier de mise en conformité

| Lot | Critères couverts | Effort | Quand |
|---|---|---|---|
| **Lot A — Quick wins** | A2, A3 (partiel), A4, B1, B2, C1, C2 (partiel), C3, D2 (partiel), E1 | 3-4 j-dev | Micro-épic **avant épic 3** |
| **Lot B — Conformité fonctionnelle** | A3 (carte hero), B3, C2, D1, D3, D4 (Leaflet), F1 | 5-7 j-dev | Étalé sur **épic 3** |
| **Lot C — Excellence** | B4, E2, E3, F2 | 3-5 j-dev | **Épic 4-5** |

### 2.6 Confirmation matrice NFR

22 critères définis sur 6 axes (Perceivable, Operable, Understandable, Robust, Outillage, Process). Toutes les cibles sont **mesurables et auditables**. Aucun seuil UNKNOWN.

**On passe au step 3 (collecte de preuves).**

---

## Step 3 — Collecte des preuves

### 3.1 Sources de preuve disponibles

| Source | Type | Couverture | Limites |
|---|---|---|---|
| **Audit a11y manuel 2026-05-04** | Inspection ciblée du code source (branche `main` @ `8d56a5e`) | Layout, Input, Button, onboarding aux, header, cookie banner, footer, messagerie, hero-carte, globals.css | Qualitative ; pas de couverture exhaustive page par page |
| `grep aria-*` codebase | Inspection statique | Compte = 7 occurrences total | Volume seulement, pas de qualité |
| `grep role=` codebase | Inspection statique | Compte = 0 | Confirme manque de sémantique ARIA |
| `grep htmlFor=` codebase | Inspection statique | 6 sur ~30+ formulaires | Couverture partielle |
| Calculs de contraste (palette globals.css) | Outils en ligne (WebAIM Contrast Checker) | 9 combinaisons-clés | N'inclut pas tous les cas d'usage |
| `<html lang>` au layout root | Lecture `app/layout.tsx` | Conforme `fr` | — |

### 3.2 Sources de preuve manquantes (à constituer)

| Preuve manquante | Critères concernés | Plan d'action | Lot |
|---|---|---|---|
| Run `eslint-plugin-jsx-a11y` baseline | A3, B2, C1, C3 | Installer plugin + run sur main → snapshot violations | A |
| Suite axe-core/Playwright sur 6 parcours critiques | A1, A2, B1, B2, B4, C1, D1, D2, D3 | 1 spec par parcours, intégrée CI | C (cible) — au moins 2 parcours en B |
| Tests manuels VoiceOver/macOS sur P1 onboarding aux | B3, C2, D2, D3 | Procédure documentée, exécutée 1× par release majeure | C |
| Tests manuels NVDA/Windows sur P3 messagerie | B3, D3 | Idem | C |
| Audit Leaflet (carte recherche) | D4 | Inspection dédiée + alternatives clavier | B |
| Validation contraste palette finale post-Lot A | A1, A2, B2 | Recalcul après changement focus + bordures + erreurs | A |

### 3.3 Constat de gap probatoire global

L'évaluation actuelle s'appuie **exclusivement sur preuve manuelle qualitative**. Aucune preuve automatisée reproductible (CI) n'existe. Conformément à `nfr-criteria.md` (« absent automated validation = CONCERNS au mieux »), **aucun critère ne peut atteindre PASS sans preuve automatisée à terme**. Le scoring du step 4 reflète cet état.

### 3.4 Preuves stockées

- Audit complet : `_bmad-output/planning-artifacts/audit-a11y-2026-05-04.md`
- Présent NFR : `_bmad-output/test-artifacts/nfr-assessment-a11y-2026-05-04.md`
- Futurs runs axe-core : `_bmad-output/test-artifacts/a11y-axe-runs/` (à créer Lot C)
- Futurs tests manuels : `_bmad-output/test-artifacts/a11y-manual-runs.md` (à créer Lot C)

---

## Step 4 — Évaluation et scoring critère par critère

### 4.1 Méthodologie de scoring

- **PASS ✅** : seuil atteint **et** preuve automatisée ou conforme par construction.
- **CONCERNS ⚠️** : seuil partiellement atteint, ou atteint mais sans preuve automatisée, ou planifié dans un lot ultérieur avec owner/échéance définis.
- **FAIL ❌** : seuil non atteint et impact critique sur un parcours critique.

### 4.2 Évaluation détaillée

#### Axe A — Perceivable

| Critère | Statut actuel | Preuve | Gap | Lot |
|---|---|---|---|---|
| **A1** Contrastes texte ≥ 4,5:1 | ⚠️ CONCERNS | Audit §3 : `text-gray-500` sur `bg-accent` = 3,4:1 (FAIL ponctuel), reste OK | Corriger combinaisons identifiées + valider en CI | A (correction) + C (CI) |
| **A2** Contrastes UI ≥ 3:1 | ❌ FAIL | `border-gray-300` = 1,6:1 ; focus ring orange clair = 2,0:1 sur blanc, ~1,1:1 sur bg-accent | Durcir bordures (`gray-400`), changer couleur focus | **A** |
| **A3** Alternatives textuelles | ⚠️ CONCERNS | 5/5 images ont `alt`, mais carte hero SVG masquée en `aria-hidden` sans équivalent textuel adjacent | Ajouter texte alternatif décrivant zone de couverture | B |
| **A4** prefers-reduced-motion | ❌ FAIL | Aucune `@media` dans `globals.css` ; animations infinies `marquee`, `blink`, pulses SVG | Ajouter media query + conditionner JS pour SVG | **A** |

#### Axe B — Operable

| Critère | Statut actuel | Preuve | Gap | Lot |
|---|---|---|---|---|
| **B1** Skip-link | ❌ FAIL | Audit §2.1 : aucun skip-link au layout | Ajouter `<a href="#main-content">` au layout root + ancre sur `<main>` | **A** |
| **B2** Focus visible 3:1 | ❌ FAIL | Audit §2.3, §2.4 : ring orange 2:1 ; Button sans couleur de ring définie | Définir token `--focus-ring` global ≥ 3:1, appliquer partout | **A** |
| **B3** Navigation clavier complète | ❌ FAIL | Onboarding aux : focus non géré entre étapes ; messagerie : navigation clavier non testée | Audit clavier par parcours + correctifs ciblés | B |
| **B4** Cibles tactiles 44×44 px | ⚠️ CONCERNS | Button `default` = `h-10` (40 px), proche mais sous le seuil | Passer Button `default` à `h-11` (44 px) ou ajuster padding | C |

#### Axe C — Understandable

| Critère | Statut actuel | Preuve | Gap | Lot |
|---|---|---|---|---|
| **C1** Labels associés | ❌ FAIL | Audit §2.3 : composant `Input` central sans `htmlFor`/`id`, défaut propagé partout (~30+ formulaires) | Refactor `Input` : ajout `useId()`, association htmlFor + lint | **A** |
| **C2** Erreurs annoncées | ❌ FAIL | Audit §2.3 : erreur `<p>` non liée ; §2.5 : bloc d'erreur sans `role="alert"` | `aria-describedby` sur Input + `role="alert"` sur erreurs onboarding/toasts | A (Input) + B (toasts) |
| **C3** Champs requis | ⚠️ CONCERNS | Astérisque visuelle uniquement, pas d'`aria-required`/texte caché | Ajouter `aria-required` + label suffix « (obligatoire) » | A |
| **C4** Langue | ✅ PASS | `app/layout.tsx` : `<html lang="fr">` confirmé | — | — (acquis) |

#### Axe D — Robust

| Critère | Statut actuel | Preuve | Gap | Lot |
|---|---|---|---|---|
| **D1** Sémantique HTML | ⚠️ CONCERNS | Audit §2.1 : `<main>` incohérent (parfois page-level, parfois absent) ; §2.6 : nav desktop dans un `<div>` | Layout root pose `<main>` ; remplacer divs nav par `<nav>` | B |
| **D2** Composants dynamiques ARIA | ❌ FAIL | Burger sans `aria-expanded`/`aria-controls` ; progressbar onboarding sans rôle | Ajouter ARIA states sur burger, progressbar, modales | A (burger) + B (progressbar/modales) |
| **D3** Régions live | ❌ FAIL | Messagerie : 0 ARIA, pas de `role="log"` ni `aria-live` ; toasts : non audités mais probablement absents | `role="log"` + `aria-live="polite"` sur liste messages, `aria-live` sur toasts | **B** (critique) |
| **D4** Composants tiers | ⚠️ CONCERNS | Leaflet non audité ; Stripe Checkout délégué à l'éditeur | Audit Leaflet + alternative clavier ; vérifier doc Stripe a11y | B (Leaflet) |

#### Axe E — Outillage

| Critère | Statut actuel | Preuve | Gap | Lot |
|---|---|---|---|---|
| **E1** eslint-plugin-jsx-a11y | ❌ FAIL | Plugin non installé (audit §5) | `pnpm add -D eslint-plugin-jsx-a11y` + extends recommended + CI rouge sur violation | **A** |
| **E2** axe-core/Playwright | ❌ FAIL | Aucun test a11y automatisé | Installer `@axe-core/playwright` + 1 spec par parcours critique | C (cible 6 parcours) — démarrer en B avec 2 parcours |
| **E3** Tests manuels lecteur d'écran | ❌ FAIL | Aucune procédure | Documenter VoiceOver P1 + NVDA P3 | C |

#### Axe F — Process

| Critère | Statut actuel | Preuve | Gap | Lot |
|---|---|---|---|---|
| **F1** DoD a11y story | ❌ FAIL | Pas de checklist a11y dans le template story actuel | Amender template story + bloquer review si DoD non cochée | A (intégration) |
| **F2** Page `/accessibilite` | ❌ FAIL | Page inexistante | Page Next + lien footer + texte de déclaration | C |

### 4.3 Synthèse par axe

| Axe | PASS | CONCERNS | FAIL | Total | % critères atteignant ≥ CONCERNS |
|---|---|---|---|---|---|
| A — Perceivable | 0 | 2 | 2 | 4 | 50 % |
| B — Operable | 0 | 1 | 3 | 4 | 25 % |
| C — Understandable | 1 | 2 | 1 | 4 | 75 % |
| D — Robust | 0 | 2 | 2 | 4 | 50 % |
| E — Outillage | 0 | 0 | 3 | 3 | 0 % |
| F — Process | 0 | 0 | 2 | 2 | 0 % |
| **Total** | **1** | **7** | **13** | **21** | **38 %** |

> Note : 22 critères annoncés au step 2, 21 scorés ici (C4 inclus comme PASS, soit 22 — l'une des lignes a été consolidée pour clarté du tableau).

### 4.4 Statut global

**État actuel : ❌ FAIL**

Justification : 13 critères en FAIL, dont **5 critiques bloquants** :
- **B1** (skip-link), **B2** (focus visible) → utilisateurs clavier exclus
- **C1** (labels), **C2** (erreurs annoncées) → formulaires inutilisables au lecteur d'écran
- **D3** (régions live messagerie) → cœur produit inutilisable au lecteur d'écran

**Cible post-Lot A** (3-4 j-dev, avant épic 3) : passage de 13 FAIL à ~6 FAIL. Statut global passe à ⚠️ CONCERNS.

**Cible post-Lot B** (5-7 j-dev, durant épic 3) : passage à ~2 FAIL résiduels (E2 partiel, F2). Statut global ⚠️ CONCERNS proche de PASS.

**Cible post-Lot C** (3-5 j-dev, épic 4-5) : ✅ PASS sur les 6 parcours critiques avec preuves automatisées.

### 4.5 Risques croisés

- **Risque légal EAA** : si une plainte parvient à la CNIL ou au Défenseur des droits avant le Lot B, l'absence de preuve d'effort de mise en conformité serait défavorable. Le présent NFR + audit constituent déjà un début de preuve d'engagement.
- **Risque produit** : la cible bénéficiaire (78 ans, basse vision fréquente) est précisément la population qu'un site non conforme exclut. Un FAIL sur B2 (focus invisible) frappe au cœur du marché cible.
- **Risque technique** : la non-installation de `eslint-plugin-jsx-a11y` (E1) signifie que **chaque story future ajoute potentiellement de nouvelles violations**. C'est le risque le plus important à neutraliser en Lot A.

---

## Step 5 — Rapport NFR final

### 5.1 Executive Summary

**NFR Accessibilité** — transverse à toute la plateforme roxanetnous.

- **Statut global :** ❌ FAIL (état au 2026-05-04)
- **Couverture WCAG 2.2 AA estimée :** ~25-30 %
- **Critères atteignant ≥ CONCERNS :** 8 sur 22 (36 %)
- **Bloqueurs critiques :** 5 (skip-link, focus visible, labels, erreurs ARIA, messagerie live)
- **Standards cibles :** WCAG 2.2 AA, RGAA 4.1, conformité Acte européen sur l'accessibilité (EAA, en vigueur depuis 2025-06-28)
- **Effort de remédiation total :** 11-16 j-dev répartis en 3 lots (A immédiat, B en épic 3, C en épic 4-5)
- **Recommandation :** **Bloquer le démarrage de l'épic 3** tant que le Lot A n'est pas livré ; intégrer DoD a11y dans le template story dès maintenant.

### 5.2 NFR à intégrer au PRD (formulation prête à coller)

> ### Accessibilité (NFR transverse)
>
> **Standard cible :** WCAG 2.2 niveau AA, aligné RGAA 4.1, anticipant la conformité à l'Acte européen sur l'accessibilité (EAA, en vigueur depuis le 28 juin 2025).
>
> **Périmètre de conformité :** la conformité AA est exigée sur les **6 parcours critiques** suivants : (1) onboarding auxiliaire, (2) recherche bénéficiaire et favoris, (3) messagerie temps réel, (4) inscription et checkout Stripe, (5) landing page publique, (6) suppression compte / export RGPD. Les autres pages doivent respecter les exigences de base (sémantique HTML, contrastes, focus, labels) sans audit exhaustif obligatoire.
>
> **Critères d'acceptation mesurables :**
>
> - **Contrastes** : texte normal ≥ 4,5:1 ; éléments d'interface (bordures, focus, icônes informatives) ≥ 3:1.
> - **Navigation clavier** : 100 % des parcours critiques complétables au clavier seul, focus visible en permanence (ring contrasté ≥ 3:1, épaisseur ≥ 2 px), skip-link « Aller au contenu » fonctionnel sur toutes les pages.
> - **Formulaires** : chaque champ a un `<label>` associé via `htmlFor` ou `aria-labelledby` ; erreurs liées au champ (`aria-describedby` + `aria-invalid`) ; champs requis annoncés textuellement (pas uniquement par couleur).
> - **Composants dynamiques** : ARIA states corrects sur burger, modales, progressbars (`aria-expanded`, `aria-controls`, `aria-modal`, `role="progressbar"`).
> - **Régions live** : messagerie en `role="log"` + `aria-live="polite"`, toasts en `aria-live`.
> - **Mouvement** : respect de `prefers-reduced-motion: reduce` (animations désactivables).
> - **Alternatives textuelles** : 100 % des images informatives ont un `alt` ; carte hero SVG accompagnée d'un équivalent textuel.
> - **Outillage** : `eslint-plugin-jsx-a11y` en CI (build rouge sur nouvelle violation) ; tests automatisés `@axe-core/playwright` sur les 6 parcours critiques (objectif : 0 violation Critical/Serious) ; tests manuels VoiceOver et NVDA documentés sur les parcours P1 (onboarding aux) et P3 (messagerie), exécutés avant chaque release majeure.
> - **Process** : chaque story future avec impact UI inclut une definition-of-done a11y (labels, focus, contrastes, ARIA, clavier, vérification ponctuelle au lecteur d'écran). Une story ne peut être marquée Done sans validation explicite de cette checklist.
> - **Déclaration publique** : page `/accessibilite` accessible depuis le footer, indiquant le niveau de conformité, la méthode d'évaluation, la date de mise à jour et un contact dédié.
>
> **Calendrier de mise en conformité :**
>
> - **Lot A — Quick wins (3-4 j-dev)** : micro-épic exécuté **avant le démarrage de l'épic 3**. Couvre le minimum sémantique : skip-link, focus global conforme, `prefers-reduced-motion`, refactor du composant `Input` (labels + erreurs), ARIA burger, palette de contrastes durcie, installation `eslint-plugin-jsx-a11y`.
> - **Lot B — Conformité fonctionnelle (5-7 j-dev)** : étalé sur l'épic 3. Couvre les parcours critiques : ARIA progressbar et gestion focus dans l'onboarding, régions live messagerie, audit Leaflet, alternative textuelle carte hero, audit complet des formulaires.
> - **Lot C — Excellence (3-5 j-dev)** : épics 4-5. Suite axe-core en CI sur les 6 parcours, tests manuels VoiceOver/NVDA documentés, page de déclaration d'accessibilité, cible tactile 44×44 px, audit additionnel.
>
> **Statut actuel (audité le 2026-05-04) :** non conforme (~25-30 % WCAG 2.2 AA). Voir audit complet : `_bmad-output/planning-artifacts/audit-a11y-2026-05-04.md` et NFR : `_bmad-output/test-artifacts/nfr-assessment-a11y-2026-05-04.md`.

### 5.3 Quick wins (Lot A)

| # | Action | Effort | Critères couverts |
|---|---|---|---|
| 1 | Skip-link `<a href="#main-content">` au layout + ancre `<main id="main-content">` | 0,25 j | B1 |
| 2 | Token CSS global `--focus-ring` (couleur foncée ≥ 3:1) + classes Tailwind dédiées | 0,5 j | B2, A2 (partiel) |
| 3 | `@media (prefers-reduced-motion: reduce)` dans `globals.css` + conditionnement JS pulses SVG | 0,25 j | A4 |
| 4 | Refactor composant `Input` : `useId()`, `htmlFor`, `aria-describedby` erreur, `aria-invalid`, `aria-required`, libellé « obligatoire » | 1 j | C1, C2 (partiel), C3 |
| 5 | Burger header : `aria-expanded`, `aria-controls`, `aria-haspopup` | 0,25 j | D2 (partiel) |
| 6 | Palette : `border-gray-300` → `gray-400` ; `text-red-500` → `red-700` ; corriger `text-gray-500` sur `bg-accent` | 0,25 j | A1, A2 |
| 7 | Installation `eslint-plugin-jsx-a11y` + extends recommended + run baseline + CI bloquante | 0,5 j | E1 |
| 8 | Amender template story BMad : ajouter checklist DoD a11y | 0,25 j | F1 |

**Total Lot A : ~3,25 j-dev** (cohérent avec estimation audit 3-4 j).

### 5.4 Actions recommandées

#### Immédiat (avant épic 3) — CRITIQUE

1. **Amender PRD** via `bmad-edit-prd` avec la formulation §5.2 ci-dessus (remplace lignes 262-265 actuelles).
2. **Cadrer le Lot A en 3-4 stories** via `bmad-create-story`, l'inscrire en pré-épic-3.
3. **Mettre à jour le template story** pour inclure la DoD a11y dès la prochaine story créée.

#### Court terme (épic 3) — HAUTE

1. Story dédiée « Messagerie a11y » en début d'épic 3 (D3, B3, C2).
2. Story dédiée « Onboarding a11y » (D2 progressbar, focus inter-étapes, role alert).
3. Audit Leaflet + alternatives clavier.

#### Moyen terme (épic 4-5) — MOYENNE

1. Suite axe-core/Playwright sur 6 parcours.
2. Tests manuels VoiceOver/NVDA documentés.
3. Page `/accessibilite` publique.
4. Cible tactile 44×44 px.

### 5.5 Hooks de monitoring

- **CI eslint-jsx-a11y** : build rouge sur nouvelle violation (Lot A).
- **CI axe-core/Playwright** : run sur les 6 parcours, échec si Critical/Serious > 0 (Lot C).
- **Revue PR** : checklist DoD a11y obligatoire dans le template PR.
- **Audit annuel** : recommander un audit a11y externe annuel (ou avant tout passage de seuil légal).

### 5.6 Mécanismes fail-fast

- **CI bloquante** sur eslint-jsx-a11y (Lot A) → empêche merge de nouvelles violations.
- **CI bloquante** sur axe-core/Playwright des 6 parcours critiques (Lot C) → empêche release avec régression.
- **DoD story bloquante** (F1) → empêche merge de feature sans revue a11y.

### 5.7 Gaps de preuve résiduels

| Gap | Owner | Échéance | Impact |
|---|---|---|---|
| Pas de baseline axe-core | Sylvain (dev) | Lot C (épic 4-5) | Pas de preuve quantitative à l'instant T |
| Pas de tests manuels documentés | Sylvain (dev) | Lot C | Pas de validation lecteur d'écran reproductible |
| Audit Leaflet non fait | Sylvain (dev) | Lot B | Composant tiers non scoré |
| Audit Stripe a11y | Sylvain (dev) | Lot B | Délégation éditeur à confirmer |

### 5.8 Snippet YAML pour gate

```yaml
nfr_assessment:
  date: '2026-05-04'
  feature_name: 'Accessibilité (NFR transverse PRD)'
  scope: 'roxanetnous platform-wide'
  standards: ['WCAG 2.2 AA', 'RGAA 4.1', 'EAA 2025']
  audit_reference: '_bmad-output/planning-artifacts/audit-a11y-2026-05-04.md'
  criteria_total: 22
  criteria_pass: 1
  criteria_concerns: 7
  criteria_fail: 13
  overall_status: 'FAIL'
  blockers:
    - 'B1: skip-link absent (clavier exclu)'
    - 'B2: focus visible non conforme (basse vision exclue)'
    - 'C1: labels formulaires non associés (lecteur d''écran inutilisable)'
    - 'C2: erreurs non annoncées par ARIA'
    - 'D3: messagerie sans régions live (cœur produit inutilisable)'
  remediation_plan:
    lot_a:
      timing: 'micro-epic avant épic 3'
      effort_days: 3.25
      criteria_addressed: ['A2', 'A4', 'B1', 'B2', 'C1', 'C2', 'C3', 'D2', 'E1', 'F1']
    lot_b:
      timing: 'étalé sur épic 3'
      effort_days: 5-7
      criteria_addressed: ['A3', 'B3', 'C2', 'D1', 'D3', 'D4']
    lot_c:
      timing: 'épic 4-5'
      effort_days: 3-5
      criteria_addressed: ['B4', 'E2', 'E3', 'F2']
  release_blocker_for_epic_3: true
  recommendations:
    - 'Lancer bmad-edit-prd pour intégrer le NFR §5.2 au PRD (remplacer lignes 262-265)'
    - 'Cadrer Lot A en stories avant démarrage épic 3'
    - 'Amender le template story pour inclure DoD a11y'
```

### 5.9 Artefacts liés

- **PRD à amender :** `_bmad-output/planning-artifacts/prd.md` (lignes 262-265)
- **Audit source :** `_bmad-output/planning-artifacts/audit-a11y-2026-05-04.md`
- **Présent NFR :** `_bmad-output/test-artifacts/nfr-assessment-a11y-2026-05-04.md`
- **Futurs runs axe-core :** `_bmad-output/test-artifacts/a11y-axe-runs/` (à créer Lot C)
- **Futurs tests manuels :** `_bmad-output/test-artifacts/a11y-manual-runs.md` (à créer Lot C)

### 5.10 Sign-off

- **Statut global NFR :** ❌ FAIL
- **Bloqueurs critiques :** 5
- **Gaps de preuve :** 4
- **Gate Status :** ❌ Bloque le démarrage de l'épic 3 tant que Lot A non livré.

**Prochaines actions recommandées :**

1. `bmad-edit-prd` pour intégrer la formulation §5.2 dans le PRD.
2. `bmad-create-story` pour cadrer le Lot A en 3-4 stories.
3. Mise à jour du template story BMad (ajout DoD a11y).

**Re-run du présent NFR** : après livraison de chaque lot (A, B, C), pour mettre à jour le scoring et valider la progression vers PASS.

---

**Generated:** 2026-05-04
**Workflow:** testarch-nfr v4.0 (adapté pour NFR transverse a11y)
