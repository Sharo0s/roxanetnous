---
document: Sprint Change Proposal
project: roxanetnous
date: 2026-04-18
author: Sylvain (avec facilitation BMad Correct Course)
scope_classification: Moderate
status: Approuvé
approved_by: Sylvain
approved_at: 2026-04-18
decisions:
  renumerotation_fr: non (FR33-FR44 stables)
  landing_l368_remplacement: "Chaque auxiliaire rencontrée et validée"
  timing_migration_sql: après merge du code
---

# Sprint Change Proposal — Suppression de la fonctionnalité Avis

## Section 1 — Résumé du problème (Issue Summary)

### Problème

La fonctionnalité **Avis & Évaluations mutuels** (FR30, FR31, FR32 du PRD) expose la plateforme à un **risque juridique significatif** :

- **Diffamation** : un avis à charge (même sans intention malveillante) peut engager la responsabilité civile de l'auteur ET de l'hébergeur de la plateforme si celle-ci ne modère pas activement.
- **Obligation de modération** : en tant qu'hébergeur de contenus rédigés par des tiers sur des personnes identifiables, roxanetnous doit instaurer un dispositif de modération, de retrait rapide sur signalement, et de réponse aux mises en demeure — charge opérationnelle disproportionnée pour une plateforme gérée par une personne seule (Sylvain).
- **Cadre NF Z74-501 / AFNOR avis en ligne** : la diffusion publique d'avis sur des professionnels (auxiliaires de vie) impose un cadre de traçabilité, d'authenticité et de droit de réponse auquel l'implémentation actuelle ne répond pas.
- **Absence de preuve d'interaction** : l'implémentation actuelle permet à n'importe quel bénéficiaire abonné de laisser un avis sur n'importe quelle auxiliaire, sans lien avec une mission réelle — aggrave le risque d'avis factices ou malveillants.

### Contexte de la découverte

Décision prise le 2026-04-18 lors d'une session Correct Course. Le fondateur estime que :
1. Le risque juridique n'est pas compensé par la valeur utilisateur au stade MVP.
2. La charge de modération (signalements, droit de réponse, retraits) n'est pas tenable en solo.
3. La confiance sur roxanetnous repose déjà sur la **vérification manuelle des auxiliaires** — les avis apportent une couche redondante et risquée.

### Preuves

- Données en base : 7 lignes dans `public.avis`, toutes générées via seed de test (emails `@roxanetnous-test.local`). **Aucun avis réel produit par un utilisateur final.** Pas d'impact utilisateur de la suppression.
- État de l'implémentation : complet (code + UI + admin) mais non exposé à de vrais utilisateurs → moment idéal pour retrait sans régression utilisateur visible.
- Asymétrie existante : FR31 (auxiliaire évalue bénéficiaire) n'est déjà pas implémenté — la fonctionnalité n'est de toute façon pas conforme au PRD.

---

## Section 2 — Analyse d'impact (Impact Analysis)

### Impact Epic

La feature « Avis » correspond à la **Fonctionnalité 11 du MVP** (PRD §Périmètre Produit > MVP — 16 Fonctionnalités). Pas d'epic formel documenté (pas d'epics-stories.md produit à date). Le retrait ramène le MVP à **15 fonctionnalités**.

### Impact stories

Aucune story n'a été produite pour « Avis » (pas de `sprint-status.yaml` généré, pas de workflow `create-epics-and-stories` exécuté). **Aucune story à annuler ou rollback.**

### Impact artefacts de planification

| Artefact | Fichier | Sections impactées |
|----------|---------|-------------------|
| PRD | `_bmad-output/planning-artifacts/prd.md` | §Périmètre MVP L111, §Parcours 4 Sylvain L219, §Exigences Fonctionnelles > Avis & Évaluations L320-L324 (FR30, FR31, FR32) |
| Architecture | `_bmad-output/planning-artifacts/architecture-technique-roxanetnous-2026-02-09.md` | Schéma SQL table `avis` L406-L424, Contrainte signalements `cible_type` L467, RLS policies L858-L872, Fonction RGPD anonymisation L3992-L3994 |
| UX Design | `_bmad-output/planning-artifacts/ux-design-specification.md` | §Opportunités UX L39 (preuve sociale « avis ») |
| Product Brief | `_bmad-output/planning-artifacts/product-brief-roxanetnous-2026-02-09.md` | L693, §Avis & Évaluations L832-L838, L871, L889, L902, L940, L947, L962, L983 |

### Impact technique — code à supprimer

**Server actions (suppression totale) :**
- `app/actions/avis.ts` — `submitAvis`, `signalerAvis`
- `app/actions/admin-avis.ts` — `masquerAvis`, `demasquerAvis`

**Composants (suppression totale) :**
- `components/recherche/avis-section.tsx`
- `components/landing/avis-marquee.tsx`
- `components/admin/avis-actions.tsx`

**Pages (suppression totale) :**
- `app/admin/avis/page.tsx`

**Pages à modifier (retrait des références avis) :**
- `app/page.tsx` L5, L41-L68, L313-L324 (bloc marquee, même commenté) et L368 (texte FAQ « Avis vérifiés pour vous guider »)
- `app/recherche/[id]/page.tsx` L7, L79-L100, L102, L163, L239-L244 (fetch avis, moyenne, affichage note, section avis)
- `app/admin/layout.tsx` L48 (lien navigation admin)
- `app/admin/page.tsx` L209-L210 (carte « Avis déposés ce mois »)
- `app/admin/historique/page.tsx` L27 (mapping libellé action `avis_masque`)
- `app/actions/rgpd.ts` L20-L64 (requêtes `avis` pour export RGPD — à retirer)
- `app/actions/signalements.ts` L11 (type `cible_type`, retirer `'avis'`)
- `components/signalement-button.tsx` L8 (type `cibleType`, retirer `'avis'`)
- `lib/admin-stats.ts` L141-L178 (agrégation mensuelle `avis` — retirer la Promise, la clé de map, et la colonne)
- `components/admin/stats-tables.tsx` L189, L203, L208, L214 (colonne « Avis » du tableau admin)
- `app/politique-de-confidentialite/page.tsx` L30 (mention « avis » dans les données utilisateur)
- `scripts/test-supabase.ts` L54 (table `avis` dans la liste testée)

**Fichiers statuts / notes (à nettoyer) :**
- `README.md` L136 — ligne `avis - Avis/Notes`
- `STATUS.md` L100 — `⏸️ Avis/Notes`
- `NEXT_STEPS.md` L229 — `1. Système d'avis/notes`
- `TODO-LAUNCH.md` L26 — `Supprimer tous les avis` (deviendra sans objet après migration)

### Impact base de données (Supabase)

**Objet à supprimer :**
- `DROP TABLE public.avis CASCADE` — supprime aussi :
  - 2 FK : `avis_auteur_id_fkey`, `avis_cible_id_fkey`
  - 3 RLS policies : `avis_read_public`, `avis_insert_own`, `avis_admin_full`
  - 7 lignes de test

**Objet à modifier :**
- Contrainte CHECK `signalements.cible_type` : retirer `'avis'` de la liste d'enum textuels.
  - Avant : `CHECK (cible_type IN ('user', 'annonce_accompagnante', 'annonce_accompagne', 'avis', 'message'))`
  - Après : `CHECK (cible_type IN ('user', 'annonce_accompagnante', 'annonce_accompagne', 'message'))`
  - Vérification préalable : `SELECT COUNT(*) FROM signalements WHERE cible_type = 'avis'` — à faire avant migration (table `signalements` = 0 ligne actuellement, donc RAS).

**Types TypeScript générés :**
- Régénérer `lib/supabase/database.types.ts` (si présent) via `supabase gen types typescript` après migration.

### Impact non-fonctionnel

- **RGPD** : simplification. Plus besoin d'anonymiser les avis lors de la suppression de compte (fonction actuellement décrite L3992 de l'architecture). L'export RGPD devient plus léger.
- **Confiance utilisateur** : la confiance repose désormais **exclusivement** sur la vérification manuelle (FR7-FR12) et les badges (FR25-FR26). UX Design doit être ajusté (opportunité « preuves sociales » à reformuler).
- **Acquisition / landing page** : le marquee d'avis (déjà commenté dans `app/page.tsx` L313) disparaît définitivement. La promesse FAQ « Avis vérifiés pour vous guider » doit être remplacée.
- **Admin** : dashboard simplifié (carte avis retirée, lien nav retiré, section stats avis retirée).

---

## Section 3 — Chemin recommandé (Recommended Approach)

### Options évaluées

| Option | Viable ? | Effort | Risque | Commentaire |
|--------|----------|--------|--------|-------------|
| **1. Ajustement direct** (suppression comme tâche sprint classique) | ✅ | Bas | Bas | **Recommandé.** Pas d'epic à remanier, pas de story à rollback. |
| 2. Rollback | N/A | — | — | Pas de story à rollback (pas d'epics-stories produits). |
| 3. Revue MVP | ✅ partiel | — | — | On applique le retrait de la fonctionnalité 11 au PRD, mais pas de revue globale nécessaire — les 15 autres fonctionnalités restent valides et cohérentes. |

### Approche retenue : **Option 1 — Direct Adjustment (Hybride avec mise à jour PRD)**

**Rationale :**
- La feature n'a pas de story en cours → aucun effort de rollback.
- Les 7 lignes en base sont toutes des données de test → aucune complexité d'export ni de rétention légale.
- La suppression est **chirurgicale** : des fichiers entiers à supprimer, et une douzaine de fichiers à éditer pour retirer les références.
- La mise à jour du PRD / Architecture / UX Design / Brief est nécessaire pour que les artefacts de planification soient cohérents avant la génération des epics et stories (workflow `create-epics-and-stories` pas encore exécuté).

**Estimation d'effort global :** 2-3 heures (migration SQL + suppression code + mise à jour docs + smoke test).

**Impact timeline :** neutre — évite plutôt l'ajout futur d'un epic « Avis » dans la planif.

---

## Section 4 — Propositions d'édition détaillées (Detailed Change Proposals)

### 4.1 — PRD (`_bmad-output/planning-artifacts/prd.md`)

#### Édition 4.1.a — Périmètre MVP (L111)

**OLD** (L99-L116, extrait ciblé) :
```
### MVP — 16 Fonctionnalités (Phase 1)
...
10. Notifications email intelligentes (matching, validation, messages)
11. Avis & évaluations mutuels
12. Dashboards (auxiliaire, bénéficiaire, admin avec métriques)
...
16. Couverture : toutes les villes de France
```

**NEW :**
```
### MVP — 15 Fonctionnalités (Phase 1)
...
10. Notifications email intelligentes (matching, validation, messages)
11. Dashboards (auxiliaire, bénéficiaire, admin avec métriques)
...
15. Couverture : toutes les villes de France
```

**Rationale :** retrait de la ligne 11, renumérotation des suivantes, titre de section mis à jour « 16 → 15 ».

---

#### Édition 4.1.b — Parcours 4 Sylvain (L219)

**OLD :**
```
**Climax :**
- Sylvain voit la première collaboration démarrée via la plateforme. Les deux parties ont laissé un avis positif.
```

**NEW :**
```
**Climax :**
- Sylvain voit la première collaboration démarrée via la plateforme. Il reçoit un email de remerciement spontané du bénéficiaire et de l'auxiliaire — signal positif direct.
```

**Rationale :** préserver le moment de satisfaction sans référence aux avis publics.

---

#### Édition 4.1.c — Exigences Fonctionnelles (L320-L324)

**OLD :**
```
### Avis & Évaluations

- **FR30 :** Un bénéficiaire peut laisser un avis sur une auxiliaire
- **FR31 :** Une auxiliaire peut laisser un avis sur un bénéficiaire
- **FR32 :** Les avis sont visibles sur le profil de l'utilisateur évalué
```

**NEW :** (section entièrement retirée)

**Rationale :** les trois FR sont supprimés. Les FR33 à FR44 ne sont **pas** renumérotés (décision : garder les identifiants stables pour ne pas casser de futures références). Alternative à valider : renuméroter FR33→FR30, etc. — **préférence par défaut : pas de renumérotation**.

---

### 4.2 — Architecture (`_bmad-output/planning-artifacts/architecture-technique-roxanetnous-2026-02-09.md`)

#### Édition 4.2.a — Schéma SQL table avis (L406-L424)

**OLD :**
```sql
-- Table: avis
CREATE TABLE public.avis (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  auteur_id UUID NOT NULL REFERENCES public.users(id),
  cible_id UUID NOT NULL REFERENCES public.users(id),
  note INTEGER NOT NULL CHECK (note >= 1 AND note <= 5),
  commentaire TEXT,
  signale BOOLEAN DEFAULT FALSE,
  masque BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  -- Unique: un user ne peut laisser qu'un seul avis par cible
  UNIQUE (auteur_id, cible_id)
);
```

**NEW :** (bloc entièrement retiré)

---

#### Édition 4.2.b — Contrainte signalements.cible_type (L467)

**OLD :**
```sql
cible_type TEXT NOT NULL CHECK (cible_type IN ('user', 'annonce_auxiliaire', 'annonce_beneficiaire', 'avis', 'message')),
```

**NEW :**
```sql
cible_type TEXT NOT NULL CHECK (cible_type IN ('user', 'annonce_auxiliaire', 'annonce_beneficiaire', 'message')),
```

---

#### Édition 4.2.c — RLS Policies avis (L858-L872)

**OLD :** (bloc complet des 3 policies `avis_read_public`, `avis_insert_own`, `avis_admin_full`)

**NEW :** (bloc entièrement retiré)

---

#### Édition 4.2.d — Fonction RGPD (L3992-L3994)

**OLD :**
```
  // 3. Anonymiser les avis laissés par l'utilisateur
  await supabase
    .from('avis')
    ...
```

**NEW :** (étape retirée — renuméroter les étapes suivantes si nécessaire)

---

### 4.3 — UX Design Specification (`_bmad-output/planning-artifacts/ux-design-specification.md`)

#### Édition 4.3.a — Opportunités UX (L39)

**OLD :**
```
1. **Preuves sociales dynamiques** — Compteur "X auxiliaires vérifiés", badges visibles, avis → confiance visuelle dès la landing page.
```

**NEW :**
```
1. **Preuves sociales dynamiques** — Compteur "X auxiliaires vérifiés", badges visibles, témoignages éditoriaux (non publiés par les utilisateurs) → confiance visuelle dès la landing page, sans exposition au risque juridique des avis utilisateur.
```

**Rationale :** conserver la notion de preuve sociale mais en basculant vers un format éditorial contrôlé par l'éditeur, non soumis au cadre AFNOR avis en ligne.

---

### 4.4 — Product Brief (`_bmad-output/planning-artifacts/product-brief-roxanetnous-2026-02-09.md`)

Retrait intégral de la section **⭐ Avis & Évaluations** (L832-L838) et de toutes les mentions « avis » dans les listes de fonctionnalités (L693, L871, L889, L902, L940, L947, L962, L983). Cette passe nécessite une revue manuelle sur 10 occurrences — principe : **si la mention porte sur la feature avis, retirer ; si elle porte sur un autre concept (ex. « préavis ») dans un autre fichier, laisser**.

---

### 4.5 — Documents de suivi (README, STATUS, NEXT_STEPS, TODO-LAUNCH)

| Fichier | Ligne | Action |
|---------|-------|--------|
| `README.md` | L136 | Retirer la ligne `avis - Avis/Notes` de la liste des tables. |
| `STATUS.md` | L100 | Retirer la ligne `⏸️ Avis/Notes`. |
| `NEXT_STEPS.md` | L229 | Retirer la ligne `1. Système d'avis/notes` et renuméroter la liste si applicable. |
| `TODO-LAUNCH.md` | L26 | Retirer la ligne `Supprimer tous les avis` (la migration SQL la rend sans objet). |

---

### 4.6 — Migration Supabase (destructive, hors code applicatif)

**Migration à créer** : `supabase/migrations/<timestamp>_drop_avis_feature.sql`

```sql
-- Suppression de la fonctionnalité Avis
-- Motif : retrait pour raisons juridiques (diffamation, cadre AFNOR avis en ligne,
-- charge de modération non tenable). 7 lignes de test uniquement, aucune donnée utilisateur réelle.

BEGIN;

-- 1. Supprimer la contrainte CHECK et la recréer sans 'avis'
ALTER TABLE public.signalements DROP CONSTRAINT IF EXISTS signalements_cible_type_check;
ALTER TABLE public.signalements
  ADD CONSTRAINT signalements_cible_type_check
  CHECK (cible_type IN ('user', 'annonce_accompagnante', 'annonce_accompagne', 'message'));

-- 2. Supprimer les signalements qui ciblent des avis (par sécurité, même si 0 ligne actuellement)
DELETE FROM public.signalements WHERE cible_type = 'avis';

-- 3. Supprimer la table avis (CASCADE retire FK et policies associées)
DROP TABLE IF EXISTS public.avis CASCADE;

COMMIT;
```

**Précaution** : exécuter `SELECT COUNT(*) FROM signalements WHERE cible_type = 'avis'` et `SELECT COUNT(*) FROM avis` avant d'appliquer la migration pour confirmer l'absence de données réelles.

---

### 4.7 — Suppression et édition de code applicatif

**Fichiers supprimés (7) :**
- `app/actions/avis.ts`
- `app/actions/admin-avis.ts`
- `components/recherche/avis-section.tsx`
- `components/landing/avis-marquee.tsx`
- `components/admin/avis-actions.tsx`
- `app/admin/avis/page.tsx`
- (le dossier `app/admin/avis/` devient vide → à supprimer aussi)

**Fichiers édités (13) :** voir §2 Impact technique pour le détail ligne par ligne. Les principales éditions :

- `app/recherche/[id]/page.tsx` : retirer import `AvisSection`, bloc fetch `avis` + `avisFormatted` + `moyenneNote` + `canLeaveAvis`, la portion d'affichage `— ${moyenneNote.toFixed(1)}/5 (${avisFormatted.length} avis)` dans l'entête, et le composant `<AvisSection ... />` en fin de colonne.
- `app/page.tsx` : retirer import `AvisMarquee`, bloc de fetch `avisData`/`avisWithNames` (L41-L68), le bloc commenté `{/* ===== AVIS (masque) ===== */}` (L313-L324), et remplacer « Avis vérifiés pour vous guider » dans la liste FAQ (L368) par **« Chaque auxiliaire rencontrée et validée »**.
- `app/admin/layout.tsx` : retirer `{ href: '/admin/avis', label: 'Avis' }` de la navigation.
- `app/admin/page.tsx` : retirer la carte stats avis et sa donnée amont.
- `lib/admin-stats.ts` : retirer la Promise `supabase.from('avis')`, le champ `avis` de la Map mensuelle, l'appel `addToMonth(avis, 'avis')` et le type.
- `components/admin/stats-tables.tsx` : retirer la colonne `Avis` du tableau mensuel.
- `app/actions/rgpd.ts` : retirer les requêtes `avisAuteur` et `avisCible`, et les clés `avis_donnes` / `avis_recus` du payload RGPD.
- `app/actions/signalements.ts` + `components/signalement-button.tsx` : retirer `'avis'` du type union `cible_type`.
- `app/politique-de-confidentialite/page.tsx` : retirer « avis » de la liste des données d'utilisation.
- `scripts/test-supabase.ts` : retirer `'avis'` de la liste des tables testées.
- `app/admin/historique/page.tsx` : retirer l'entrée `avis_masque: 'Avis masqué'` du mapping (cohérent avec la suppression des actions admin correspondantes).

---

## Section 5 — Handoff d'implémentation

### Classification de portée : **Moderate**

Justification : pas de replanification produit majeure (MVP toujours cohérent à 15 fonctionnalités, pas de pivot), mais **plusieurs artefacts de planification** à mettre à jour (PRD, Architecture, UX, Brief) **+** une **migration de base de données destructive** **+** un balayage multi-fichiers côté code → dépasse un simple « ajustement dev direct ».

### Plan d'exécution recommandé (séquencé)

**Phase 1 — Mise à jour documentaire** (peut être faite en premier, sans risque)
- [ ] Éditer `prd.md` selon §4.1
- [ ] Éditer architecture selon §4.2
- [ ] Éditer ux-design selon §4.3
- [ ] Éditer product-brief selon §4.4
- [ ] Nettoyer README / STATUS / NEXT_STEPS / TODO-LAUNCH selon §4.5

**Phase 2 — Suppression applicative** (code)
- [ ] Supprimer les 7 fichiers listés en §4.7
- [ ] Éditer les 13 fichiers impactés
- [ ] `npm run build` + `npm run lint` + `tsc --noEmit` pour vérifier l'absence de référence résiduelle
- [ ] Smoke test local : `/`, `/recherche/[id]`, `/admin`, `/admin/historique`, suppression de compte (RGPD)

**Phase 3 — Migration base de données** (destructive, en dernier)
- [ ] Créer le fichier `supabase/migrations/<timestamp>_drop_avis_feature.sql` (§4.6)
- [ ] Vérifier préalablement : `SELECT COUNT(*) FROM avis` (doit être 0 ou uniquement des lignes de test tolérables)
- [ ] Appliquer la migration sur une branche Supabase avant prod (via MCP `create_branch` puis `apply_migration`)
- [ ] Appliquer en production une fois le build front validé
- [ ] Régénérer les types TypeScript si `database.types.ts` existe

**Phase 4 — Vérification & commit**
- [ ] `git status` pour inventorier la suppression
- [ ] Commit avec message clair : `Retire la fonctionnalité Avis (risque juridique)`
- [ ] Déploiement preview Vercel → smoke test → promotion prod

### Recipients de handoff

- **Dev (Amelia via `/bmad-bmm-dev-story`)** : exécute phases 1, 2, 4.
- **Infra / DB** : phase 3 (DROP TABLE) — Sylvain valide manuellement l'exécution de la migration.
- **Product (John) / Architect (Winston)** : relecture des éditions PRD et Architecture (peut être fait par Sylvain directement en solo).

### Critères de succès

1. Build Next.js vert, `tsc --noEmit` vert, aucune référence `avis` résiduelle dans `app/`, `components/`, `lib/` (hors migrations supabase et mentions « préavis » ou orthographes non liées).
2. Table `avis` supprimée en base.
3. PRD, Architecture, UX, Brief cohérents sur la nouvelle portée (15 fonctionnalités, pas de section Avis).
4. Les tests manuels (fiche accompagnante, admin, suppression RGPD) fonctionnent sans erreur.

---

## Section 6 — Décisions arrêtées

Les trois questions ouvertes ont été tranchées par Sylvain à l'approbation :

1. **Renumérotation des FR** : **non**. FR33-FR44 conservent leurs identifiants actuels malgré le retrait de FR30-FR32. Stabilité privilégiée.
2. **Remplacement de « Avis vérifiés pour vous guider »** (`app/page.tsx` L368) : **« Chaque auxiliaire rencontrée et validée »**.
   - Note de cohérence : cette formulation introduit une **promesse de rencontre physique** qui n'est pas encore documentée dans le PRD (FR7-FR11 décrivent aujourd'hui une validation sur pièces + OCR uniquement). Sylvain a confirmé le 2026-04-18 que la rencontre est effective en pratique. **Action de suivi requise** : mettre à jour le PRD pour formaliser l'étape de rencontre dans le processus de vérification — ajouter un FR (par exemple après FR11) du type « Un admin rencontre chaque auxiliaire avant validation définitive ». À traiter lors de la phase 1 (mise à jour documentaire).
3. **Timing migration SQL** : **après** merge du code applicatif, pour préserver la stabilité des environnements preview pendant la phase 2.

---

## Approbation

- **Approuvé par** : Sylvain
- **Date** : 2026-04-18
- **Conditions** : aucune — exécution conforme au plan séquencé §5.
- **Prochaine étape** : handoff vers `/bmad-bmm-dev-story` (Amelia, Developer Agent) dans une fenêtre de contexte neuve.

---

## Historique checklist Change Navigation

| Section | Statut |
|---------|--------|
| 1. Understand trigger | [x] Done — risque juridique (diffamation, AFNOR, modération solo) |
| 2. Epic impact | [x] Done — pas d'epic formel, feature 11 MVP retirée |
| 3. Artifact conflict | [x] Done — PRD, Architecture, UX, Brief, 13 fichiers code, 1 migration SQL |
| 4. Path forward | [x] Done — Option 1 (Direct Adjustment) retenue |
| 5. Proposal components | [x] Done — cette proposition |
| 6. Final review | [x] Done — approuvé par Sylvain le 2026-04-18 |
