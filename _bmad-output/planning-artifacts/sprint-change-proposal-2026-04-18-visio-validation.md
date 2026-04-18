---
document: Sprint Change Proposal
project: roxanetnous
date: 2026-04-18
author: Sylvain (avec facilitation BMad Correct Course)
scope_classification: Moderate
status: Approuvé
approved_by: Sylvain
approved_at: 2026-04-18
change_topic: Validation par visioconférence obligatoire avant validation définitive
decisions:
  canal: visio (remplace la rencontre physique)
  portee: accompagnantes uniquement
  mode_statuts: 3 statuts (visio_a_planifier → visio_realisee → valide)
  backfill: les profils déjà 'valide' restent 'valide' (pas de rétroactivité)
---

# Sprint Change Proposal — Validation par visioconférence

## Section 1 — Résumé du problème (Issue Summary)

### Problème

Le FR11bis ajouté au PRD le 2026-04-18 (commit `ff398eb`) impose qu'« un admin rencontre physiquement chaque auxiliaire avant la validation définitive du profil ». Cette règle est aujourd'hui :

1. **Non scalable** : la couverture visée est « toutes les villes de France » (PRD L116 post-renumérotation). La rencontre physique est incompatible avec cette ambition géographique, d'autant plus avec un admin unique (Sylvain, PRD L95).
2. **Non matérialisée dans l'UI** : `app/admin/validation/[id]/page.tsx` permet de passer de `en_attente` à `valide` sans aucune étape intermédiaire. `components/admin/validation-actions.tsx` propose uniquement les trois décisions (valide / a_completer / refuse). Rien ne force l'admin à honorer FR11bis.
3. **Non matérialisée dans l'enum** : `CREATE TYPE validation_status AS ENUM('en_attente', 'valide', 'refuse', 'a_completer')` — pas de statut intermédiaire (architecture L122, confirmé en prod via MCP Supabase).
4. **Non tracée** : pas de colonne `visio_date` / `visio_notes` sur `accompagnantes_profiles`. Aucun `action_type` dédié dans `admin_actions_log`.

### Contexte de la découverte

Décision prise le 2026-04-18 en session Correct Course (mode Incrémental) :
- Canal : **visioconférence** (remplace la rencontre physique).
- Portée : **accompagnantes uniquement** (pas de visio côté bénéficiaires).
- Flux : **3 statuts intermédiaires** (Sylvain a tranché « 3S »).

### Preuves

- **État du code** : `app/actions/admin.ts:14-101` permet la validation directe `en_attente → valide`.
- **État de la DB (prod, vérifié via MCP Supabase 2026-04-18)** : enum `validation_status` = `{en_attente, valide, refuse, a_completer}`. Table `accompagnantes_profiles` ne contient que `validation_status`, `validation_date`, `validated_by`, `refus_motif`. **317 profils actuellement `valide`** (données de test principalement) — à conserver intactes (aucune rétroactivité).
- **Écart PRD / code** : FR11bis existe textuellement (PRD L285) mais n'a aucune traduction technique.

---

## Section 2 — Analyse d'impact (Impact Analysis)

### Impact Epic

Feature 2 du MVP (« Vérification manuelle obligatoire des auxiliaires », PRD L102). Aucun epic formel produit à date, donc aucune story à annuler. **Scope de l'epic étendu** : 2 statuts supplémentaires, 2 nouvelles colonnes, 1 nouvelle notification email, enrichissement UI admin.

### Impact stories

Aucune story existante. Quand l'epic « Vérification auxiliaires » sera produit par `create-epics-and-stories`, il devra inclure les nouveaux FR (FR11bis réécrit + FR11ter + FR11quater).

### Impact artefacts de planification

| Artefact | Fichier | Sections impactées |
|----------|---------|-------------------|
| PRD | `_bmad-output/planning-artifacts/prd.md` | FR11bis réécrit (L285), FR11ter et FR11quater ajoutés (L285-L286), Parcours 4 Sylvain (L212 — ajouter étape visio) |
| Architecture | `_bmad-output/planning-artifacts/architecture-technique-roxanetnous-2026-02-09.md` | ENUM L122, colonnes `accompagnantes_profiles` (nouvelle définition), diagramme flux L1219, action_type logs (documentation) |
| UX Design | `_bmad-output/planning-artifacts/ux-design-specification.md` | Ajout d'un micro-flow admin validation |
| Product Brief | `product-brief-roxanetnous-2026-02-09.md` | Sections « Admin » mentionnant la validation |

### Impact technique — code à modifier

**Schéma SQL (migration destructive mais additive) :**
- `ALTER TYPE validation_status ADD VALUE 'visio_a_planifier'` (après `en_attente`)
- `ALTER TYPE validation_status ADD VALUE 'visio_realisee'` (après `visio_a_planifier`)
- `ALTER TABLE accompagnantes_profiles ADD COLUMN visio_date TIMESTAMPTZ NULL`
- `ALTER TABLE accompagnantes_profiles ADD COLUMN visio_notes TEXT NULL`

**Server actions :**
- `app/actions/admin.ts` :
  - Nouvelle fonction `markVisioToPlan(profileId)` — transition `en_attente → visio_a_planifier`, envoie email de convocation.
  - Nouvelle fonction `markVisioRealisee(profileId, visioDate, notes?)` — transition `visio_a_planifier → visio_realisee`, renseigne `visio_date` + `visio_notes`, log admin.
  - `validateAccompagnante()` modifiée : n'autorise `decision='valide'` que si le statut courant est `'visio_realisee'` (refuse et a_completer restent accessibles depuis tout statut).
- `app/actions/profile.ts:71` : si l'auxiliaire édite son profil alors qu'il est `visio_a_planifier` ou `visio_realisee`, retour à `en_attente` (la revue documentaire doit être refaite).

**UI admin :**
- `components/admin/validation-actions.tsx` : refonte — boutons contextuels selon le statut courant :
  - Si `en_attente` : boutons « Passer en attente de visio », « Demander complément », « Refuser ».
  - Si `visio_a_planifier` : boutons « Marquer visio réalisée » (avec date + notes), « Demander complément », « Refuser ».
  - Si `visio_realisee` : boutons « Valider », « Demander complément », « Refuser ».
- `app/admin/validation/[id]/page.tsx` : affichage du bloc visio quand `visio_date` est renseigné ; étend `StatusBadge` pour les deux nouveaux statuts.
- `app/admin/page.tsx` : compteur d'attente étendu à tous les statuts intermédiaires (ou colonnes séparées) ; label de la carte « X en attente » à reformuler.
- `app/admin/utilisateurs/page.tsx:96` + `components/admin/utilisateurs-client.tsx` : filtres statuts étendus.
- `app/admin/utilisateurs/[id]/page.tsx:181` : bloc d'actions admin élargi.
- `app/admin/historique/page.tsx:15` : `actionLabels` étendu (`visio_planifiee: 'Visio planifiée'`, `visio_realisee: 'Visio réalisée'`).

**UI auxiliaire :**
- `app/accompagnante/dashboard/page.tsx:76, 123-140` : bandeaux pour les deux nouveaux statuts.
- `app/accompagnante/profil/page.tsx:46-65` : idem.

**Emails :**
- `lib/emails.ts` : nouvelle fonction `sendVisioInvitationEmail(params)` envoyée lors de `markVisioToPlan`. Message : « Bonjour {firstName}, votre dossier est revu. Je souhaite vous rencontrer en visio avant de valider votre profil. Merci de me contacter à contact@roxanetnous.fr pour convenir d'un créneau. » (ou Calendly à choisir).

### Impact non-fonctionnel

- **Conformité** : la visio consignée renforce le dispositif de vérification (cohérent avec le retrait des avis et le positionnement « confiance par vérification humaine »).
- **Traçabilité RGPD** : ajouter `visio_notes` = donnée personnelle → à mentionner dans la politique de confidentialité et l'export RGPD.
- **Acquisition** : cycle de validation plus long (24-72h selon disponibilité visio). Message UX à soigner côté auxiliaire.
- **Dashboard admin** : le « délai moyen de validation » (PRD L215) augmente mécaniquement. Critère à surveiller.

---

## Section 3 — Chemin recommandé (Recommended Approach)

### Options évaluées

| Option | Viable | Effort | Risque | Commentaire |
|--------|--------|--------|--------|-------------|
| **1. Ajustement direct** | Oui | Moyen | Bas | **Recommandé.** Extension additive de l'enum, 2 colonnes, ~10 fichiers impactés. |
| 2. Rollback | N/A | — | — | Rien à rollback. |
| 3. Revue MVP | Non nécessaire | — | — | MVP reste à 15 fonctionnalités. |

### Approche retenue : **Option 1 — Direct Adjustment**

**Rationale :**
- Aucune story en cours à annuler.
- Enum étendu de manière **additive** (compatible avec les 317 profils existants).
- Les fonctions existantes (`validateAccompagnante`) continuent de fonctionner pour les profils déjà `valide` (pas de rétroactivité).
- La complexité principale est UI (boutons contextuels selon statut) — pas de refonte structurelle.

**Estimation d'effort global :** 3-4 heures (migration SQL + server actions + composants UI admin/auxiliaire + email + smoke test).

**Impact timeline :** neutre. À faire avant toute première acquisition publique.

---

## Section 4 — Propositions d'édition détaillées (Detailed Change Proposals)

### 4.1 — PRD (`_bmad-output/planning-artifacts/prd.md`)

#### Édition 4.1.a — Section « Vérification des Auxiliaires » (L278-L287)

**OLD** (L285) :
```
- **FR11bis :** Un admin rencontre physiquement chaque auxiliaire avant la validation définitive du profil (rencontre consignée dans le log admin)
```

**NEW** (remplace + 2 nouveaux FR) :
```
- **FR11bis :** Un admin réalise une visioconférence avec chaque auxiliaire avant la validation définitive du profil. La visio est consignée dans le log admin avec date, heure et notes optionnelles.
- **FR11ter :** L'interface admin matérialise deux statuts intermédiaires — `visio_a_planifier` (après revue documentaire) et `visio_realisee` (après tenue de la visio). Le bouton « Valider » n'est actif que si le statut courant est `visio_realisee`.
- **FR11quater :** L'auxiliaire reçoit un email de convocation visio lorsque son profil passe au statut `visio_a_planifier`.
```

**Rationale :** FR11bis reformulé (physique → visio) + matérialisation technique du flux + traçabilité email.

---

#### Édition 4.1.b — Parcours 4 Sylvain (L212)

**OLD** (extrait L212) :
```
- **Validation :** Notification "3 nouvelles demandes de validation". Il ouvre la queue. Pour chaque auxiliaire : profil structuré + justificatifs + résultat OCR pré-validation. L'OCR a détecté "Diplôme d'État aide-soignante" sur le document de Sophie — cohérence avec le diplôme déclaré. Il vérifie la pièce d'identité, tout est conforme. Il clique "Valider". L'action est tracée dans le log admin.
```

**NEW :**
```
- **Validation :** Notification "3 nouvelles demandes de validation". Il ouvre la queue. Pour chaque auxiliaire : profil structuré + justificatifs + résultat OCR pré-validation. L'OCR a détecté "Diplôme d'État aide-soignante" sur le document de Sophie — cohérence avec le diplôme déclaré. Il vérifie la pièce d'identité, tout est conforme. Il clique "Passer en attente de visio". Sophie reçoit un email de convocation. Deux jours plus tard, Sylvain la rencontre en visio, échange 20 minutes, rentre ses notes ("Parcours cohérent, discours clair, disponible dès la semaine prochaine"), puis clique "Valider". Chaque étape est tracée dans le log admin.
```

**Rationale :** parcours utilisateur aligné avec le nouveau flux à 3 statuts.

---

### 4.2 — Architecture (`_bmad-output/planning-artifacts/architecture-technique-roxanetnous-2026-02-09.md`)

#### Édition 4.2.a — Enum `validation_status` (L122)

**OLD :**
```sql
CREATE TYPE validation_status AS ENUM ('en_attente', 'valide', 'refuse', 'a_completer');
```

**NEW :**
```sql
CREATE TYPE validation_status AS ENUM ('en_attente', 'visio_a_planifier', 'visio_realisee', 'valide', 'refuse', 'a_completer');
```

---

#### Édition 4.2.b — Table `accompagnantes_profiles` (après L176)

**AJOUT** (à insérer dans la définition de la table, après la ligne `validation_status validation_status DEFAULT 'en_attente'`) :
```sql
  visio_date TIMESTAMPTZ NULL,
  visio_notes TEXT NULL,
```

**Rationale :** colonnes nullables, pas d'impact sur les 317 lignes existantes.

---

#### Édition 4.2.c — Diagramme flux validation (L1219)

**OLD** (extrait) :
```
│   (validation_status='en_attente')                          │
```

**NEW** (diagramme à actualiser — à réécrire à la main lors de la phase documentaire) pour refléter :
```
en_attente
   │ [admin "Passer en attente de visio"]
   ▼
visio_a_planifier  (email convocation envoyé)
   │ [admin "Marquer visio réalisée" + date + notes]
   ▼
visio_realisee
   │ [admin "Valider"]
   ▼
valide
```

Avec deux branches latérales `a_completer` et `refuse` accessibles depuis tout statut.

---

#### Édition 4.2.d — Action types du log admin (à documenter si section dédiée)

**AJOUT** — deux nouveaux `action_type` dans `admin_actions_log` :
- `visio_planifiee` — payload `details` : `{ planifie_le: ISO-date }`
- `visio_realisee` — payload `details` : `{ visio_date: ISO-date, notes?: string }`

---

### 4.3 — UX Design Specification (`_bmad-output/planning-artifacts/ux-design-specification.md`)

**AJOUT** — nouvelle sous-section « Flow admin — Validation auxiliaire » :
```
### Flow admin — Validation auxiliaire (3 statuts intermédiaires)

1. **Queue "en_attente"** : revue documentaire (justificatifs + OCR).
2. **Décision intermédiaire** : Passer en attente de visio / Demander complément / Refuser.
3. **Queue "visio_a_planifier"** : auxiliaires dont le dossier est clean, en attente de créneau visio. Email de convocation envoyé automatiquement à la transition.
4. **Visio réalisée** : admin saisit date + notes libres, log admin.
5. **Queue "visio_realisee"** : validation finale possible. Bouton "Valider" actif uniquement ici.
```

---

### 4.4 — Migration Supabase

**Fichier à créer :** `supabase/migrations/<timestamp>_add_visio_validation_statuses.sql`

```sql
-- Ajout des statuts intermédiaires pour la validation par visioconférence
-- FR11bis / FR11ter / FR11quater (PRD 2026-04-18)
-- Additif : les 317 profils déjà 'valide' restent intacts.

BEGIN;

-- 1. Étendre l'enum validation_status (transactionnellement sûr depuis PG 12)
ALTER TYPE validation_status ADD VALUE IF NOT EXISTS 'visio_a_planifier' BEFORE 'valide';
ALTER TYPE validation_status ADD VALUE IF NOT EXISTS 'visio_realisee' BEFORE 'valide';

-- 2. Ajouter les colonnes de traçabilité visio
ALTER TABLE public.accompagnantes_profiles
  ADD COLUMN IF NOT EXISTS visio_date TIMESTAMPTZ NULL,
  ADD COLUMN IF NOT EXISTS visio_notes TEXT NULL;

-- 3. Commentaires colonnes (auto-documentation)
COMMENT ON COLUMN public.accompagnantes_profiles.visio_date IS 'Date de la visio de validation (FR11bis)';
COMMENT ON COLUMN public.accompagnantes_profiles.visio_notes IS 'Notes libres de l''admin après la visio (FR11bis)';

COMMIT;
```

**Note PostgreSQL** : `ALTER TYPE ... ADD VALUE` ne peut pas s'exécuter à l'intérieur d'une transaction **s'il est suivi immédiatement d'une requête qui lit la nouvelle valeur**. Si Supabase impose une application dans une transaction unique, exécuter d'abord `ALTER TYPE` en migration n°1, puis les colonnes + usage en migration n°2. Sinon, laisser tel quel.

**Vérification préalable :**
```sql
SELECT validation_status, COUNT(*) FROM accompagnantes_profiles GROUP BY 1;
-- Attendu : tout est 'valide' / 'en_attente' / 'refuse' / 'a_completer' — aucune valeur inattendue.
```

---

### 4.5 — Server actions (`app/actions/admin.ts`)

**AJOUT de deux fonctions**, à insérer après `validateAccompagnante` :

```typescript
export async function markVisioToPlan(profileId: string): Promise<ValidationResult> {
  // 1. Auth + contrôle admin (identique à validateAccompagnante)
  // 2. Vérifier que le statut courant est 'en_attente'
  // 3. Update: validation_status = 'visio_a_planifier'
  // 4. Log admin: action_type = 'visio_planifiee', details = { planifie_le: NOW }
  // 5. sendVisioInvitationEmail (non bloquant)
  // 6. redirect('/admin')
}

export async function markVisioRealisee(
  profileId: string,
  visioDate: string,  // ISO
  notes?: string
): Promise<ValidationResult> {
  // 1. Auth + contrôle admin
  // 2. Vérifier que le statut courant est 'visio_a_planifier'
  // 3. Update: validation_status = 'visio_realisee', visio_date, visio_notes
  // 4. Log admin: action_type = 'visio_realisee', details = { visio_date, notes }
  // 5. redirect('/admin')
}
```

**MODIFICATION de `validateAccompagnante`** : si `decision === 'valide'`, vérifier avant update que `validation_status === 'visio_realisee'`. Sinon retourner `{ error: 'La visio doit être réalisée avant validation finale.' }`.

---

### 4.6 — Emails (`lib/emails.ts`)

**AJOUT** d'une fonction `sendVisioInvitationEmail` (~ L140, après `sendValidationResultEmail`) :

```typescript
export async function sendVisioInvitationEmail(params: {
  email: string
  firstName: string
  userId?: string
}) {
  const subject = 'Rendez-vous visio pour finaliser votre inscription'
  try {
    await resend.emails.send({
      from: FROM_EMAIL,
      to: params.email,
      subject,
      html: `
        <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto;">
          <h1 style="color: #000;">Dernière étape : un échange en visio</h1>
          <p>Bonjour ${escapeHtml(params.firstName)},</p>
          <p>Votre dossier a été revu. Pour finaliser votre inscription sur roxanetnous, nous souhaitons vous rencontrer lors d'un court échange en visio (15-20 minutes).</p>
          <p>Merci de me contacter à <a href="mailto:contact@roxanetnous.fr">contact@roxanetnous.fr</a> pour convenir d'un créneau.</p>
          <p style="margin-top: 24px;">
            <a href="${BASE_URL}/accompagnante/profil" style="background: #000; color: #fff; padding: 12px 24px; text-decoration: none; display: inline-block;">
              Voir mon profil
            </a>
          </p>
        </div>
      `,
    })
    await logNotification({
      userId: params.userId,
      email: params.email,
      type: 'visio_invitation',
      subject,
      status: 'sent',
    })
  } catch (error) {
    await logNotification({
      userId: params.userId,
      email: params.email,
      type: 'visio_invitation',
      subject,
      status: 'error',
      error: error instanceof Error ? error.message : 'Erreur inconnue',
    })
  }
}
```

---

### 4.7 — Composants UI

**`components/admin/validation-actions.tsx`** : refonte pour boutons contextuels selon `status` (passé en prop).

**`app/admin/validation/[id]/page.tsx`** :
- Passer `profile.validation_status` au composant `<ValidationActions />`.
- Afficher un bloc « Visio réalisée le … / Notes » si `profile.visio_date` est non-null.
- Étendre `StatusBadge` avec les 2 nouveaux libellés :
  ```typescript
  visio_a_planifier: 'En attente de visio',
  visio_realisee: 'Visio réalisée',
  ```

**`app/accompagnante/dashboard/page.tsx`** (L123-L140) et **`app/accompagnante/profil/page.tsx`** (L46-L65) : ajouter les bandeaux :
- `visio_a_planifier` → bandeau bleu/info : « Votre dossier a été revu. Nous vous avons envoyé un email pour convenir d'un créneau visio avec l'équipe. »
- `visio_realisee` → bandeau vert/info : « Visio réalisée — nous finalisons votre validation. »

**`components/admin/utilisateurs-client.tsx`** : étendre `VALIDATION_LABELS` et `VALIDATION_STYLES` avec les 2 nouveaux statuts + filtres.

**`app/admin/page.tsx:54-59`** : ajouter comptage `visio_a_planifier` et `visio_realisee` sur la page d'accueil admin (carte séparée ou compteur groupé « en cours »).

**`app/admin/utilisateurs/page.tsx:96-99`** : adapter le filtre par statut.

**`app/admin/historique/page.tsx:15`** : étendre `actionLabels` :
```typescript
visio_planifiee: 'Visio planifiée',
visio_realisee: 'Visio réalisée',
```

---

### 4.8 — Profile reset (`app/actions/profile.ts:71`)

**OLD** :
```typescript
if (currentProfile?.validation_status === 'a_completer' || currentProfile?.validation_status === 'refuse') {
  updateData.validation_status = 'en_attente'
}
```

**NEW** (étend aux statuts intermédiaires) :
```typescript
const resetFrom: Array<typeof currentProfile.validation_status> = [
  'a_completer', 'refuse', 'visio_a_planifier', 'visio_realisee'
]
if (currentProfile && resetFrom.includes(currentProfile.validation_status)) {
  updateData.validation_status = 'en_attente'
  updateData.visio_date = null
  updateData.visio_notes = null
}
```

**Rationale :** si l'auxiliaire modifie son dossier après la revue documentaire ou la visio, on reprend le cycle depuis le début (cohérence du processus de vérification).

---

## Section 5 — Handoff d'implémentation

### Classification de portée : **Moderate**

Justification : pas de pivot produit (MVP stable à 15 fonctionnalités), mais plusieurs artefacts de planification à mettre à jour + migration de base + ~10 fichiers code + enrichissement emails → au-delà d'un simple ajustement dev.

### Plan d'exécution recommandé (séquencé)

**Phase 1 — Mise à jour documentaire** (sans risque, en premier)
- [ ] Éditer `prd.md` selon §4.1
- [ ] Éditer architecture selon §4.2
- [ ] Éditer ux-design selon §4.3

**Phase 2 — Migration base de données** (additive, branche Supabase d'abord)
- [ ] Créer la migration SQL (§4.4) sur branche Supabase via `mcp__supabase__create_branch` + `mcp__supabase__apply_migration`
- [ ] Vérifier `enum_range(NULL::validation_status)` contient bien les 6 valeurs
- [ ] Vérifier colonnes ajoutées sur `accompagnantes_profiles`
- [ ] Régénérer les types TypeScript (`lib/supabase/database.types.ts` si présent)

**Phase 3 — Code applicatif**
- [ ] Étendre `app/actions/admin.ts` (§4.5) — 2 nouvelles fonctions + garde-fou sur `validateAccompagnante`
- [ ] Ajouter `sendVisioInvitationEmail` dans `lib/emails.ts` (§4.6)
- [ ] Refondre `components/admin/validation-actions.tsx` (§4.7) — boutons contextuels
- [ ] Étendre `StatusBadge` dans `app/admin/validation/[id]/page.tsx` et `app/accompagnante/dashboard/page.tsx`
- [ ] Étendre `VALIDATION_LABELS/STYLES` dans `components/admin/utilisateurs-client.tsx`
- [ ] Étendre `actionLabels` dans `app/admin/historique/page.tsx`
- [ ] Adapter `app/actions/profile.ts:71` (reset étendu aux statuts intermédiaires, §4.8)
- [ ] Adapter carte stats `app/admin/page.tsx`
- [ ] Adapter filtres `app/admin/utilisateurs/page.tsx`

**Phase 4 — Vérification & commit**
- [ ] `npm run build`, `tsc --noEmit`, `npm run lint`
- [ ] Smoke test flow complet (compte test) :
  - Inscription auxiliaire → statut `en_attente`
  - Admin → clic « Passer en attente de visio » → statut `visio_a_planifier` + email reçu
  - Admin → clic « Marquer visio réalisée » avec date + notes → statut `visio_realisee`
  - Admin → clic « Valider » → statut `valide` + email de validation
  - Modification de profil par l'auxiliaire après visio_realisee → retour `en_attente`
- [ ] Commit : `Introduit la validation par visio (statuts intermediaires visio_a_planifier + visio_realisee)`
- [ ] Application migration en prod après merge
- [ ] Déploiement preview Vercel → smoke test prod → promotion prod

### Recipients de handoff

- **Dev (Amelia via `/bmad-bmm-dev-story`)** : phases 1, 3, 4.
- **Infra / DB (Sylvain)** : phase 2, valide l'application de la migration.
- **Product (John) / Architect (Winston)** : relecture des éditions PRD et Architecture — peut être fait par Sylvain directement.

### Critères de succès

1. Build Next.js vert, `tsc --noEmit` vert.
2. Enum `validation_status` contient les 6 valeurs en prod.
3. Colonnes `visio_date` et `visio_notes` présentes sur `accompagnantes_profiles`.
4. Bouton « Valider » désactivé tant que le statut n'est pas `visio_realisee`.
5. Email de convocation visio envoyé automatiquement à la transition `visio_a_planifier`.
6. Les 317 profils actuellement `valide` restent intacts (aucune rétroactivité).
7. Smoke test flow complet OK.

---

## Section 6 — Décisions arrêtées

Prises par Sylvain le 2026-04-18 :

1. **Canal de vérification** : **visio** (remplace la rencontre physique). FR11bis réécrit.
2. **Portée** : **accompagnantes uniquement**. Les bénéficiaires ne sont pas soumis à visio (pas d'enjeu symétrique de vérification).
3. **Nombre de statuts intermédiaires** : **3** (`visio_a_planifier` → `visio_realisee` → `valide`). Justification : tracer aussi l'étape « visio à planifier mais pas encore faite », utile pour le tableau de bord admin et l'email de convocation.
4. **Backfill des profils existants** : les **317 profils actuellement `valide` restent `valide`** — aucune rétroactivité. Seuls les nouveaux cycles de validation passent par la visio.
5. **Outil de visio** : non tranché à ce stade — Sylvain convient d'un créneau par email (lien visio fourni à l'auxiliaire manuellement). Pas d'intégration Calendly / Zoom / Daily au MVP.

---

## Approbation

- **Approuvé par** : Sylvain
- **Date** : 2026-04-18
- **Conditions** : aucune — exécution conforme au plan séquencé §5.
- **Prochaine étape** : après approbation, handoff vers `/bmad-bmm-dev-story` (Amelia) dans une fenêtre de contexte neuve.

---

## Historique checklist Change Navigation

| Section | Statut |
|---------|--------|
| 1. Understand trigger | [x] Done — besoin d'une validation visio scalable, FR11bis non matérialisé |
| 2. Epic impact | [x] Done — feature 2 MVP (Vérification auxiliaires) étendue, pas de nouvel epic |
| 3. Artifact conflict | [x] Done — PRD, Architecture, UX, 10 fichiers code, 1 migration SQL additive |
| 4. Path forward | [x] Done — Option 1 (Direct Adjustment) retenue |
| 5. Proposal components | [x] Done — cette proposition |
| 6. Final review | [x] Done — approuvé par Sylvain le 2026-04-18 |
