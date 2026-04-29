---
document: Sprint Change Proposal
project: roxanetnous
date: 2026-04-18
author: Sylvain (avec facilitation BMad Correct Course)
scope_classification: Moderate
status: Approuvé
approved_by: Sylvain
approved_at: 2026-04-18
change_topic: Programme de parrainage entre accompagnantes
decisions:
  portee: accompagnantes uniquement (pas de parrainage bénéficiaire)
  filleule_bypass: OCR + visio intégralement contournés sur présentation code valide
  recompense_marraine: 6 mois offerts via coupon Stripe à 5 parrainages confirmés, puis reset compteur
  delai_carence: 30 jours (filleule doit avoir payé 1 mois complet et rester abonnée)
  antifraude_critique: blocage auto si email, téléphone ou fingerprint carte Stripe identiques
  antifraude_suspicion: flag admin + email immédiat si même IP ou même adresse postale (non bloquant)
  admin_blacklist_page: nouvelle page /admin/parrainages avec sous-onglet blacklist
  admin_notification: email immédiat à contact@roxanetnous.fr à chaque flag de suspicion
---

# Sprint Change Proposal — Programme de parrainage entre accompagnantes

## Section 1 — Résumé du problème (Issue Summary)

### Problème

Le MVP repose sur la vérification manuelle stricte (OCR + visio, FR11bis/ter/quater) — processus nécessairement lent (24-72h) et entièrement porté par l'admin unique (Sylvain). Deux enjeux métier non traités :

1. **Acquisition accompagnantes** : pas de canal viral. L'acquisition repose uniquement sur Google / publicité Facebook (cf. PRD parcours Sophie).
2. **Rétention & engagement** : pas d'incitation financière directe à promouvoir la plateforme auprès du réseau professionnel existant.

**Besoin** : un **programme de parrainage entre accompagnantes** qui transforme les utilisatrices satisfaites en canal d'acquisition, récompense leur fidélité via 6 mois offerts (≈ 30€ de valeur) et exploite la **densité des réseaux professionnels** des auxiliaires de vie (anciennes collègues d'agence, formations partagées).

### Contexte de la découverte

Décision prise le 2026-04-18 en session Correct Course (mode Incrémental), dans la continuité des deux autres changements du jour (retrait Avis, validation visio). Le fondateur estime que :
1. Le positionnement « vérification humaine stricte » rend le bouche-à-oreille particulièrement puissant — une accompagnante vérifiée recommande une consœur qu'elle connaît personnellement.
2. L'introduction d'un canal viral ne peut se faire qu'après stabilisation du flux de validation (désormais stable avec la visio).
3. Le modèle 4,99€/mois permet d'offrir 6 mois comme récompense majeure sans fragiliser le P&L (coût marginal ≈ 0€ hors Stripe fee).

### Preuves

**État technique actuel** :
- Aucune table `parrainages` ni `parrainages_codes` en base.
- Aucun code de parrainage stocké sur les profils.
- Coupons Stripe **déjà utilisés** dans le code (`app/actions/admin.ts:466`) pour les abonnements offerts par l'admin → pattern éprouvé.
- Webhook Stripe (`app/api/webhooks/stripe/route.ts`) gère déjà les transitions d'abonnement → extension naturelle.

**Signaux métier** :
- Cible « auxiliaires indépendantes » a des réseaux professionnels denses et captifs.
- Coût d'acquisition par publicité payante élevé comparé au parrainage structuré.
- Objectif PRD : 25 auxiliaires validés à 12 mois → un parrainage avec 5 filleules en moyenne sur 5 marraines comblerait une part significative de cet objectif.

**Risques à couvrir** (décisions anti-fraude actées) :
- Auto-parrainage (marraine = filleule via double compte).
- Parrainages fantômes (abonnement puis résiliation immédiate).
- Fraude coordonnée (plusieurs comptes factices, même carte, même IP).
- Conflit direct avec FR11bis (bypass de la visio obligatoire).

### Décisions de design arrêtées (2026-04-18)

| Point | Décision |
|-------|----------|
| Filleule saute tout (OCR + visio) | Oui — validation automatique à souscription payée |
| Définition parrainage « réussi » | Filleule abonnée active ≥ 30 jours |
| Récompense marraine | 6 mois offerts après 5 parrainages confirmés, puis reset |
| Mécanisme Stripe | Coupon 100% sur 6 mois (cohérent avec `admin.ts:466`) |
| Anti-doublon email | Bloquant (normalisation sans `.` et sans `+alias`) |
| Anti-doublon téléphone | Bloquant (normalisation E.164) |
| Anti-doublon fingerprint carte Stripe | Bloquant |
| Délai de carence | 30 jours de paiement actif |
| Flag suspicion même IP | Non bloquant + email admin immédiat |
| Flag suspicion même adresse postale | Non bloquant + email admin immédiat |
| Page admin dédiée | `/admin/parrainages` (vue d'ensemble + sous-onglet blacklist) |
| Portée | Accompagnantes uniquement (bénéficiaires exclus) |
| Message félicitations marraine | « Félicitations, vous avez 6 mois offerts ! Continuez à parrainer pour aider la communauté. » |

---

## Section 2 — Analyse d'impact (Impact Analysis)

### Impact Epic

**Nouvelle fonctionnalité 16 du MVP** (passage de 15 à 16 features).

- Pas d'epic formel existant à modifier (workflow `create-epics-and-stories` pas encore exécuté).
- Cette feature devra produire **3 stories** à la génération future :
  - Story A : Table parrainages + codes + validation automatique filleule (server-side)
  - Story B : Récompense Stripe coupon + compteur marraine + UI dashboard
  - Story C : Blacklist admin (détection + page admin + notification email)

**Modification du plan de phases** : retirer « Programme de parrainage » de la Phase 3 (Vision Future) puisqu'il est anticipé au MVP.

### Impact stories

Aucune story existante à annuler. Aucun rollback.

### Impact artefacts de planification

| Artefact | Fichier | Sections impactées |
|----------|---------|-------------------|
| PRD | `_bmad-output/planning-artifacts/prd.md` | §Périmètre MVP L99-L116 (15→16), §Phase 3 L124-L133 (retrait), §Exigences Fonctionnelles L278-L287 (ajout FR11quinquies + nouveau bloc « Programme de Parrainage » avec FR45-FR48), §Parcours Sophie (enrichissement optionnel) |
| Architecture | `_bmad-output/planning-artifacts/architecture-technique-roxanetnous-2026-02-09.md` | §Schéma SQL (2 nouvelles tables `parrainages` et `parrainages_codes` après `admin_actions_log` L504), §Colonnes ajoutées (`users.parrainee_par`, `accompagnantes_profiles.validation_source`), §RLS policies (4 nouvelles), §admin_actions_log (5 nouveaux action_type), §Diagramme flux validation (L1219 — ajouter branche parrainage), §Webhook Stripe (extension), §Cron J+30 (nouveau) |
| UX Design | `_bmad-output/planning-artifacts/ux-design-specification.md` | Ajout section « Flow Parrainage » (marraine / filleule / admin) |
| Product Brief | `product-brief-roxanetnous-2026-02-09.md` | Remonter « Parrainage » des futures évolutions vers feature MVP |

### Impact technique — code à créer / modifier

**Nouvelles tables (migration SQL) :**
- `parrainages` (clé `code` unique, FK marraine/filleule, statut enum textuel, timestamps, colonnes audit anti-fraude)
- `parrainages_codes` (1 ligne par accompagnante validée : code, compteur, total récompenses)

**Colonnes ajoutées :**
- `users.parrainee_par UUID NULL REFERENCES users(id)`
- `accompagnantes_profiles.validation_source TEXT NOT NULL DEFAULT 'manuelle' CHECK (... IN ('manuelle', 'parrainage'))`

**Nouveaux fichiers à créer (10) :**
- `app/actions/parrainage.ts` — `generateCodeForUser`, `validateCode`, `detectBlacklist`, `markBlacklistFlag`
- `app/actions/admin-parrainages.ts` — `autoriserException`, `confirmerFraude`, `ignorerFlag`
- `app/admin/parrainages/page.tsx` — vue d'ensemble
- `app/admin/parrainages/blacklist/page.tsx` — liste des blocages et flags
- `components/admin/parrainages-blacklist-actions.tsx` — actions admin (autoriser / confirmer fraude / ignorer)
- `components/accompagnante/parrainage-card.tsx` — bloc dashboard marraine (code + compteur + liste filleules)
- `app/api/cron/confirm-parrainages/route.ts` — cron J+30 pour confirmer les parrainages et déclencher récompenses
- `supabase/migrations/<timestamp>_add_parrainage_feature.sql` — migration additive
- 2 emails templates à déclarer dans `lib/emails.ts`

**Fichiers à modifier (12) :**
- `app/admin/layout.tsx:43-49` — ajouter `{ href: '/admin/parrainages', label: 'Parrainages' }` dans la navigation
- `app/actions/admin.ts` — dans `validateAccompagnante`, après la transition vers `valide`, appeler `generateCodeForUser(profileId)` pour créer le code de la nouvelle marraine
- `app/api/webhooks/stripe/route.ts` — sur `checkout.session.completed`, si `session.metadata.parrainage_code` présent : créer/updater l'entrée `parrainages` et passer son statut à `abonnee`
- `app/actions/subscription.ts:9` (`createCheckoutSession`) — lire un cookie ou un query param `parrainage_code`, valider via `validateCode`, injecter dans `session.metadata`
- `app/accompagnante/onboarding/page.tsx` — ajouter le champ optionnel « Code de parrainage (optionnel) »
- `app/accompagnante/dashboard/page.tsx` — injecter `<ParrainageCard />` pour les accompagnantes validées (`validation_status === 'valide'`)
- `app/accompagnante/profil/page.tsx` — idem, afficher le code
- `app/admin/historique/page.tsx:15` — étendre `actionLabels` avec 5 nouvelles clés (`parrainage_bloque`, `parrainage_flag`, `parrainage_autorise_exception`, `parrainage_fraude_confirmee`, `parrainage_recompense_appliquee`)
- `app/politique-de-confidentialite/page.tsx` — mentionner collecte code parrainage, relation marraine/filleule, signaux anti-fraude (IP, fingerprint Stripe)
- `app/actions/rgpd.ts` — inclure les parrainages (en tant que marraine ET filleule) dans l'export
- `lib/emails.ts` — ajouter 4 fonctions : `sendParrainageBienvenueMarraine`, `sendParrainageFilleuleConfirmation`, `sendParrainageRecompense`, `sendAdminParrainageFlag`
- `scripts/test-supabase.ts` — ajouter `parrainages` et `parrainages_codes` à la liste testée
- `README.md`, `STATUS.md`, `NEXT_STEPS.md`, `TODO-LAUNCH.md` — mentions à jour

### Impact non-fonctionnel

- **Sécurité / RGPD** : collecte de signaux techniques (IP inscription, fingerprint carte Stripe) → à mentionner dans la politique de confidentialité. Durée de rétention proposée : 12 mois post-inscription de la filleule.
- **Rétention suppression compte** : soft-delete des parrainages (conserver le statut pour audit admin, anonymiser le nom via `ON DELETE SET NULL` côté `filleule_id`, `ON DELETE CASCADE` côté `marraine_id`).
- **Confiance / angle mort** : le bypass de la visio pour la filleule est un trade-off assumé, compensé par la responsabilité implicite de la marraine (son code la lie à la filleule). À documenter dans le PRD.
- **Performance** : négligeable. 1 SELECT additionnel à l'inscription pour la blacklist, 1 cron quotidien J+30, pas de charge significative.
- **Acquisition** : levier viral activé. Objectif de succès : 20%+ des nouvelles auxiliaires vérifiées à 3 mois proviennent du parrainage.

---

## Section 3 — Chemin recommandé (Recommended Approach)

### Options évaluées

| Option | Viable | Effort | Risque | Commentaire |
|--------|--------|--------|--------|-------------|
| **1. Ajustement direct** | Oui | Moyen-haut (4-6h) | Moyen | **Recommandé.** Extension additive, patterns réutilisés (coupons Stripe). |
| 2. Rollback | N/A | — | — | Rien à rollback. |
| 3. Revue MVP | Partiellement viable | — | — | Non nécessaire — MVP reste cohérent à 16 fonctionnalités. |

### Approche retenue : **Option 1 — Direct Adjustment**

**Rationale :**
- Aucune story en cours à annuler.
- Extension **additive** de l'architecture (tables, colonnes, policies, webhook enrichi) → pas de risque de régression.
- Exception au flux visio **formalisée** par un nouveau FR45 (pas cachée).
- Pattern **coupons Stripe** déjà en production (`admin.ts:466`) → pas d'intégration neuve à valider.
- Feature **découpable en 3 stories indépendantes** → gestion par incréments cohérents.

**Estimation d'effort global :** 4-6 heures
- Migration SQL : 30 min
- Server actions (parrainage + admin-parrainages) : 1h30
- UI accompagnante (dashboard + formulaire inscription) : 1h
- UI admin (page parrainages + blacklist + actions) : 1h30
- Webhook Stripe + cron J+30 : 45 min
- Emails (4 nouvelles fonctions) : 30 min
- Tests manuels bout en bout : 45 min

**Impact timeline :** neutre à légèrement positif (anticipe un levier d'acquisition dès le lancement, évite un epic Phase 3 séparé).

**Trade-offs assumés :**
- Bypass visio pour filleule → compensé par responsabilité de la marraine et anti-fraude lourd.
- Délai de gratification 30 jours pour la marraine → anti-fraude acceptable, UX à soigner pour éviter la frustration.

---

## Section 4 — Propositions d'édition détaillées (Detailed Change Proposals)

### 4.1 — PRD (`_bmad-output/planning-artifacts/prd.md`)

#### Édition 4.1.a — Périmètre MVP (L99-L116)

**OLD** (L99 et ligne finale L115) :
```
### MVP — 15 Fonctionnalités (Phase 1)
...
15. Couverture : toutes les villes de France
```

**NEW :**
```
### MVP — 16 Fonctionnalités (Phase 1)
...
15. Couverture : toutes les villes de France
16. Programme de parrainage entre accompagnantes (code unique, validation auto filleule, 5 parrainages = 6 mois offerts, blacklist anti-fraude)
```

**Rationale** : passage de 15 à 16 fonctionnalités, ajout de la feature 16.

---

#### Édition 4.1.b — Phase 3 Vision Future (L124-L133)

**OLD** (extrait L129) :
```
- Programme de parrainage
```

**NEW :** ligne entièrement supprimée.

**Rationale** : la feature est anticipée au MVP, plus pertinente en Phase 3.

---

#### Édition 4.1.c — Nouvelle section « Programme de Parrainage » (après L287 FR11quater)

**AJOUT** :
```markdown
### Programme de Parrainage (Accompagnantes uniquement)

- **FR11quinquies :** Lorsqu'une accompagnante atteint le statut `valide`, un code de parrainage unique (8 caractères alphanumériques) est automatiquement généré pour elle et stocké dans `parrainages_codes`. Ce code est visible sur son dashboard et son profil.
- **FR45 :** Lors de l'inscription d'une nouvelle accompagnante, un champ optionnel « Code de parrainage » permet de saisir le code d'une marraine. Si le code est valide et que l'anti-doublon ne bloque pas le parrainage, la filleule bypass intégralement le flux de vérification (pas d'OCR, pas de visio). Son profil passe automatiquement au statut `valide` avec `validation_source = 'parrainage'` au moment où elle souscrit un abonnement payant.
- **FR46 :** Un parrainage est considéré comme « confirmé » pour la marraine après 30 jours d'abonnement actif de la filleule (délai de carence anti-fraude). Avant ce délai, le parrainage apparaît côté marraine avec le statut « Abonnée » mais n'est pas encore comptabilisé.
- **FR47 :** Lorsqu'une marraine atteint 5 parrainages confirmés, un coupon Stripe 100% de 6 mois lui est automatiquement appliqué sur son abonnement en cours. Son compteur repart à zéro (elle peut continuer à parrainer pour déclencher une nouvelle récompense). Message de félicitations : « Félicitations, vous avez 6 mois offerts ! Continuez à parrainer pour aider la communauté. »
- **FR48 :** Le système applique une blacklist automatique à l'inscription de la filleule :
  - **Blocage critique** (parrainage refusé, aucun crédit pour la marraine) : email normalisé identique, téléphone E.164 identique, fingerprint carte Stripe identique.
  - **Flag de suspicion** (non bloquant, audit admin) : même IP d'inscription, même adresse postale. Déclenche immédiatement un email à l'admin et inscription dans la page `/admin/parrainages` (onglet blacklist).
  - L'admin peut **autoriser en exception** (ex : deux sœurs colocataires, cas légitime) — le parrainage est alors débloqué et comptabilisé. Il peut aussi **confirmer fraude** (suspension des comptes) ou **ignorer** (classement sans suite).
```

**Rationale** : 5 nouveaux FR qui formalisent intégralement la feature, y compris l'exception au flux visio (FR11bis).

---

#### Édition 4.1.d — Parcours 1 Sophie (optionnel, L164-L165)

**OLD :**
```
**Résolution :**
- Sophie a trouvé sa première mission via roxanetnous en moins d'une semaine. Elle se connecte 3 fois par semaine pour consulter les nouvelles annonces de bénéficiaires. En 2 mois, elle a 3 nouveaux clients. Son planning est rempli à 70%.
```

**NEW (enrichi) :**
```
**Résolution :**
- Sophie a trouvé sa première mission via roxanetnous en moins d'une semaine. Elle se connecte 3 fois par semaine pour consulter les nouvelles annonces de bénéficiaires. En 2 mois, elle a 3 nouveaux clients. Son planning est rempli à 70%. Elle partage son code de parrainage avec deux anciennes collègues d'agence — satisfaites du modèle, celles-ci s'inscrivent, bypass le flux de vérification grâce au code de Sophie, et souscrivent à leur tour un abonnement. Sophie voit son compteur avancer vers les 5 parrainages qui lui offriront 6 mois gratuits.
```

**Rationale** : illustrer concrètement le parcours viral du parrainage dans un parcours existant.

---

#### Édition 4.1.e — Critères de Succès Business (ajout métrique viralité, après L59)

**AJOUT** dans la table métrique :
```
| Auxiliaires via parrainage | 0% | 20%+ |
```

Et dans le texte :
```
- **Viralité parrainage** : 20%+ des nouvelles auxiliaires vérifiées à 3 mois arrivent via code de parrainage (objectif long terme 30%+).
```

---

### 4.2 — Architecture (`_bmad-output/planning-artifacts/architecture-technique-roxanetnous-2026-02-09.md`)

#### Édition 4.2.a — Nouvelles tables (à insérer après `admin_actions_log` L504)

**AJOUT** :
```sql
-- Table: parrainages_codes (1 ligne par accompagnante validée)
CREATE TABLE public.parrainages_codes (
  user_id UUID PRIMARY KEY REFERENCES public.users(id) ON DELETE CASCADE,
  code TEXT NOT NULL UNIQUE,
  compteur_confirmes INTEGER NOT NULL DEFAULT 0,
  total_recompenses INTEGER NOT NULL DEFAULT 0,
  derniere_recompense_at TIMESTAMPTZ NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_parrainages_codes_code ON parrainages_codes(code);

-- Table: parrainages (historique des relations marraine/filleule)
CREATE TABLE public.parrainages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  code TEXT NOT NULL,
  marraine_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  filleule_id UUID NULL REFERENCES public.users(id) ON DELETE SET NULL,
  statut TEXT NOT NULL DEFAULT 'en_attente'
    CHECK (statut IN ('en_attente', 'inscrite', 'abonnee', 'confirme', 'fraude', 'bloque')),
  -- en_attente : code utilisé mais filleule pas encore inscrite
  -- inscrite : filleule a créé un compte
  -- abonnee : filleule a souscrit (J+0)
  -- confirme : filleule abonnée active ≥ 30 jours → compteur marraine +1
  -- fraude : admin a confirmé une fraude (suspension)
  -- bloque : blacklist critique auto
  filleule_inscrite_at TIMESTAMPTZ NULL,
  filleule_abonnee_at TIMESTAMPTZ NULL,
  confirme_at TIMESTAMPTZ NULL,
  -- Signaux anti-fraude (audit admin)
  ip_inscription TEXT NULL,
  stripe_fingerprint TEXT NULL,
  blocage_raison TEXT NULL,
  flag_suspicion TEXT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_parrainages_code ON parrainages(code);
CREATE INDEX idx_parrainages_marraine ON parrainages(marraine_id);
CREATE INDEX idx_parrainages_filleule ON parrainages(filleule_id);
CREATE INDEX idx_parrainages_statut ON parrainages(statut);
```

---

#### Édition 4.2.b — Colonnes ajoutées

**AJOUT** dans la définition de `users` (L131) :
```sql
  parrainee_par UUID NULL REFERENCES public.users(id),
```

**AJOUT** dans la définition de `accompagnantes_profiles` (après L176, à côté de `validation_status`) :
```sql
  validation_source TEXT NOT NULL DEFAULT 'manuelle'
    CHECK (validation_source IN ('manuelle', 'parrainage')),
```

---

#### Édition 4.2.c — RLS policies (ajout dans la section RLS)

**AJOUT** :
```sql
-- TABLE: parrainages_codes
ALTER TABLE public.parrainages_codes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "parrainages_codes_owner_read" ON public.parrainages_codes
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "parrainages_codes_admin_full" ON public.parrainages_codes
  FOR ALL USING (
    EXISTS (SELECT 1 FROM public.users WHERE id = auth.uid() AND role = 'admin')
  );

-- TABLE: parrainages
ALTER TABLE public.parrainages ENABLE ROW LEVEL SECURITY;

CREATE POLICY "parrainages_marraine_read" ON public.parrainages
  FOR SELECT USING (auth.uid() = marraine_id);

CREATE POLICY "parrainages_admin_full" ON public.parrainages
  FOR ALL USING (
    EXISTS (SELECT 1 FROM public.users WHERE id = auth.uid() AND role = 'admin')
  );
```

---

#### Édition 4.2.d — admin_actions_log (5 nouveaux action_type à documenter)

**AJOUT** (dans la description de `admin_actions_log` vers L504) :
```
Nouveaux action_type pour le programme de parrainage :
- parrainage_bloque — payload { marraine_id, filleule_id, raison: 'meme_email'|'meme_telephone'|'meme_carte' }
- parrainage_flag — payload { marraine_id, filleule_id, flag: 'meme_ip'|'meme_adresse' }
- parrainage_autorise_exception — payload { marraine_id, filleule_id, notes: string }
- parrainage_fraude_confirmee — payload { marraine_id, filleule_id, notes: string }
- parrainage_recompense_appliquee — payload { marraine_id, coupon_id: string, nb_recompense: number }
```

---

#### Édition 4.2.e — Diagramme flux validation (L1219, extension)

**AJOUT** — nouvelle branche latérale « Parrainage » dans le diagramme :
```
en_attente
   │
   ├─[flux normal]─> visio_a_planifier → visio_realisee → valide
   │
   └─[inscription avec code parrainage valide + abonnement payé]
       └─> valide (validation_source='parrainage', bypass OCR+visio)
```

---

#### Édition 4.2.f — Nouveau cron `/api/cron/confirm-parrainages`

**AJOUT** (section Crons / Jobs) :
```
Cron : confirm-parrainages
- Fréquence : quotidienne (2h du matin)
- Cible : table `parrainages` avec statut='abonnee' et filleule_abonnee_at <= NOW() - INTERVAL '30 days'
- Action pour chaque ligne :
  1. Vérifier via subscriptions que la filleule est toujours active → sinon ignorer
  2. Update statut='confirme', confirme_at=NOW()
  3. Incrementer parrainages_codes.compteur_confirmes pour la marraine
  4. Si compteur_confirmes >= 5 → créer coupon Stripe 100% sur 6 mois, l'appliquer à l'abonnement actif de la marraine, incrémenter total_recompenses, reset compteur_confirmes à 0, envoyer sendParrainageRecompense
  5. Logger dans admin_actions_log (action_type='parrainage_recompense_appliquee') si récompense déclenchée
- Idempotence : UPDATE conditionné sur statut='abonnee' pour éviter double traitement
```

---

#### Édition 4.2.g — Webhook Stripe (extension `checkout.session.completed`)

**AJOUT** dans le case `checkout.session.completed` :
```typescript
// Si la filleule s'est inscrite via un code de parrainage, mettre à jour le statut
const parrainageCode = session.metadata?.parrainage_code
if (parrainageCode && session.customer && userId) {
  // Extraire fingerprint carte Stripe pour audit
  const paymentMethodId = typeof session.payment_method === 'string' ? session.payment_method : null
  let stripeFingerprint: string | null = null
  if (paymentMethodId) {
    try {
      const pm = await stripe.paymentMethods.retrieve(paymentMethodId)
      stripeFingerprint = pm.card?.fingerprint || null
    } catch {}
  }
  await supabase
    .from('parrainages')
    .update({
      statut: 'abonnee',
      filleule_abonnee_at: new Date().toISOString(),
      stripe_fingerprint: stripeFingerprint,
    })
    .eq('code', parrainageCode)
    .eq('filleule_id', userId)
    .eq('statut', 'inscrite')
}
```

---

### 4.3 — UX Design Specification (`_bmad-output/planning-artifacts/ux-design-specification.md`)

**AJOUT** — nouvelle section « Flow Parrainage » :
```markdown
### Flow Parrainage — Marraine (accompagnante validée)

1. **Génération automatique du code** : à la validation définitive (statut `valide`), un code 8 caractères alphanumériques est créé et affiché sur le dashboard.
2. **Bloc dashboard `ParrainageCard`** :
   - En-tête : « Votre code de parrainage : XXXX-XXXX » avec bouton « Copier »
   - Compteur visuel : « 2/5 parrainages confirmés — plus que 3 pour obtenir 6 mois gratuits »
   - Liste des parrainages actifs : pseudonyme filleule + statut (Inscrite / Abonnée / **Confirmée**)
   - CTA « Partager par email » / « Partager par SMS » (deep link avec message pré-rempli)
3. **Événement de récompense** (5/5 atteint) :
   - Toast de félicitations en haut de l'app : « Félicitations, vous avez 6 mois offerts ! »
   - Email dédié (`sendParrainageRecompense`)
   - Compteur retombe à 0/5

### Flow Parrainage — Filleule (inscription)

1. **Formulaire inscription accompagnante** : champ optionnel « Code de parrainage (optionnel) » en bas du formulaire.
2. **Validation live du code** : si code saisi, affichage « Code valide ! Votre profil sera validé automatiquement dès votre abonnement. » (ou message d'erreur si invalide).
3. **Parcours post-inscription** : bypass intégral des étapes OCR et visio. L'UI redirige directement vers la page d'abonnement.
4. **Après paiement** : le profil passe en `valide` automatiquement (source `parrainage`). L'accompagnante arrive sur son dashboard déjà fonctionnel.

### Flow Parrainage — Admin

1. **Page `/admin/parrainages`** (onglet principal) :
   - Compteurs en en-tête : parrainages en attente, confirmés, bloqués, flags non traités
   - Tableau : Marraine / Filleule / Statut / Date / Actions
2. **Sous-onglet Blacklist `/admin/parrainages/blacklist`** :
   - Colonnes : Date détection, Marraine (nom, email, téléphone), Filleule (nom, email, téléphone), Raison/Flag, Statut admin, Actions
   - Actions ligne : Autoriser en exception / Confirmer fraude / Ignorer
3. **Notifications email** : à chaque flag de suspicion, email immédiat à l'admin avec lien direct vers la ligne.
```

---

### 4.4 — Product Brief (`product-brief-roxanetnous-2026-02-09.md`)

**Action** : remonter la mention « Programme de parrainage » actuellement listée en futures évolutions vers la section MVP. Nécessite une passe manuelle (probablement 2-3 occurrences à réajuster). Principe : si la mention parle de « parrainage » comme feature future → déplacer en MVP ; si elle parle d'un autre concept → laisser.

---

### 4.5 — Migration Supabase

**Fichier à créer :** `supabase/migrations/<timestamp>_add_parrainage_feature.sql`

```sql
-- Programme de parrainage entre accompagnantes
-- FR11quinquies / FR45 / FR46 / FR47 / FR48 (PRD 2026-04-18)
-- Additif : aucune table existante modifiée, seulement des AJOUTS.

BEGIN;

-- 1. Table parrainages_codes (1 ligne par accompagnante validée)
CREATE TABLE IF NOT EXISTS public.parrainages_codes (
  user_id UUID PRIMARY KEY REFERENCES public.users(id) ON DELETE CASCADE,
  code TEXT NOT NULL UNIQUE,
  compteur_confirmes INTEGER NOT NULL DEFAULT 0,
  total_recompenses INTEGER NOT NULL DEFAULT 0,
  derniere_recompense_at TIMESTAMPTZ NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_parrainages_codes_code ON public.parrainages_codes(code);

-- 2. Table parrainages (historique relation marraine/filleule)
CREATE TABLE IF NOT EXISTS public.parrainages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  code TEXT NOT NULL,
  marraine_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  filleule_id UUID NULL REFERENCES public.users(id) ON DELETE SET NULL,
  statut TEXT NOT NULL DEFAULT 'en_attente'
    CHECK (statut IN ('en_attente', 'inscrite', 'abonnee', 'confirme', 'fraude', 'bloque')),
  filleule_inscrite_at TIMESTAMPTZ NULL,
  filleule_abonnee_at TIMESTAMPTZ NULL,
  confirme_at TIMESTAMPTZ NULL,
  ip_inscription TEXT NULL,
  stripe_fingerprint TEXT NULL,
  blocage_raison TEXT NULL,
  flag_suspicion TEXT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_parrainages_code ON public.parrainages(code);
CREATE INDEX IF NOT EXISTS idx_parrainages_marraine ON public.parrainages(marraine_id);
CREATE INDEX IF NOT EXISTS idx_parrainages_filleule ON public.parrainages(filleule_id);
CREATE INDEX IF NOT EXISTS idx_parrainages_statut ON public.parrainages(statut);

-- 3. Colonne parrainee_par sur users
ALTER TABLE public.users
  ADD COLUMN IF NOT EXISTS parrainee_par UUID NULL REFERENCES public.users(id);

-- 4. Colonne validation_source sur accompagnantes_profiles
ALTER TABLE public.accompagnantes_profiles
  ADD COLUMN IF NOT EXISTS validation_source TEXT NOT NULL DEFAULT 'manuelle'
    CHECK (validation_source IN ('manuelle', 'parrainage'));

-- 5. RLS policies
ALTER TABLE public.parrainages_codes ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "parrainages_codes_owner_read" ON public.parrainages_codes;
CREATE POLICY "parrainages_codes_owner_read" ON public.parrainages_codes
  FOR SELECT USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "parrainages_codes_admin_full" ON public.parrainages_codes;
CREATE POLICY "parrainages_codes_admin_full" ON public.parrainages_codes
  FOR ALL USING (
    EXISTS (SELECT 1 FROM public.users WHERE id = auth.uid() AND role = 'admin')
  );

ALTER TABLE public.parrainages ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "parrainages_marraine_read" ON public.parrainages;
CREATE POLICY "parrainages_marraine_read" ON public.parrainages
  FOR SELECT USING (auth.uid() = marraine_id);

DROP POLICY IF EXISTS "parrainages_admin_full" ON public.parrainages;
CREATE POLICY "parrainages_admin_full" ON public.parrainages
  FOR ALL USING (
    EXISTS (SELECT 1 FROM public.users WHERE id = auth.uid() AND role = 'admin')
  );

-- 6. Commentaires pour documentation auto
COMMENT ON TABLE public.parrainages_codes IS 'Code de parrainage unique par accompagnante validée (FR11quinquies)';
COMMENT ON TABLE public.parrainages IS 'Historique des relations marraine/filleule et audit anti-fraude (FR45-FR48)';
COMMENT ON COLUMN public.accompagnantes_profiles.validation_source IS 'Source de la validation : manuelle (OCR+visio) ou parrainage (bypass)';
COMMENT ON COLUMN public.users.parrainee_par IS 'Marraine ayant parrainé cet utilisateur, null si inscription normale';

COMMIT;
```

**Vérification préalable** : `SELECT COUNT(*) FROM accompagnantes_profiles WHERE validation_status = 'valide'` pour estimer le nombre de codes à générer rétroactivement (à traiter dans une étape post-migration manuelle ou script).

---

### 4.6 — Server actions

#### 4.6.a — `app/actions/parrainage.ts` (nouveau fichier)

**Fonctions à implémenter** :

```typescript
'use server'

// Generate 8-char alphanumeric code (exclude ambiguous chars: 0, O, 1, I, l)
function generateCode(): string { /* ... */ }

// Called from validateAccompagnante after decision='valide'
export async function generateCodeForUser(userId: string): Promise<void>

// Returns { valid: boolean, marraineId?: string } — called on registration form
export async function validateCode(code: string): Promise<ValidationResult>

// Called at registration completion: creates parrainages row, runs blacklist detection
export async function createParrainageRelation(params: {
  code: string
  filleuleId: string
  filleuleEmail: string
  filleuleTelephone: string | null
  filleuleAdresse: string | null
  ipInscription: string | null
}): Promise<{ statut: 'inscrite' | 'bloque', raison?: string, flag?: string }>

// Comparaison marraine ↔ filleule sur signaux critiques + flags
async function detectBlacklist(params: {
  marraineId: string
  filleuleEmail: string
  filleuleTelephone: string | null
  filleuleAdresse: string | null
  ipInscription: string | null
}): Promise<{ blocage?: string, flag?: string }>
```

#### 4.6.b — `app/actions/admin-parrainages.ts` (nouveau fichier)

```typescript
'use server'

export async function autoriserException(parrainageId: string, notes: string): Promise<ValidationResult>
// Débloque + passe statut à 'inscrite' (qui pourra évoluer normalement) + log admin

export async function confirmerFraude(parrainageId: string, notes: string): Promise<ValidationResult>
// Passe statut à 'fraude' + suspend marraine+filleule + log admin

export async function ignorerFlag(parrainageId: string): Promise<ValidationResult>
// Passe flag_suspicion à null (marque comme revu) + log admin
```

#### 4.6.c — Extension `app/actions/admin.ts` (`validateAccompagnante`)

Après la transition finale vers `valide` et avant le `redirect`, appel :
```typescript
await generateCodeForUser(profileId)
```
Générer le code de la nouvelle marraine dès qu'elle devient validée.

#### 4.6.d — Extension `app/actions/subscription.ts` (`createCheckoutSession`)

Avant la création de la session Stripe :
```typescript
const parrainageCode = cookies().get('parrainage_code')?.value
if (parrainageCode) {
  const { valid } = await validateCode(parrainageCode)
  if (valid) {
    sessionParams.metadata = { ...sessionParams.metadata, parrainage_code: parrainageCode }
  }
}
```

---

### 4.7 — UI

#### 4.7.a — `app/admin/layout.tsx` (L43-L49)

**OLD** :
```tsx
{[
  { href: '/admin', label: 'Tableau de bord' },
  { href: '/admin/utilisateurs', label: 'Utilisateurs' },
  { href: '/admin/annonces', label: 'Annonces' },
  { href: '/admin/messages', label: 'Messages' },
  { href: '/admin/signalements', label: 'Signalements' },
  { href: '/admin/historique', label: 'Historique' },
]}
```

**NEW** :
```tsx
{[
  { href: '/admin', label: 'Tableau de bord' },
  { href: '/admin/utilisateurs', label: 'Utilisateurs' },
  { href: '/admin/annonces', label: 'Annonces' },
  { href: '/admin/messages', label: 'Messages' },
  { href: '/admin/signalements', label: 'Signalements' },
  { href: '/admin/parrainages', label: 'Parrainages' },
  { href: '/admin/historique', label: 'Historique' },
]}
```

#### 4.7.b — `app/admin/parrainages/page.tsx` (nouveau)
Vue d'ensemble : compteurs (en attente / inscrites / abonnées / confirmées / bloquées / flags non traités) + tableau paginé des parrainages avec filtre par statut + lien vers onglet blacklist.

#### 4.7.c — `app/admin/parrainages/blacklist/page.tsx` (nouveau)
Liste des parrainages avec `statut='bloque'` OU `flag_suspicion IS NOT NULL`. Colonnes détaillées (marraine/filleule nom+email+téléphone, raison/flag, date, statut admin, actions). Composant client `<ParrainageBlacklistActions />` pour les 3 actions admin.

#### 4.7.d — `components/accompagnante/parrainage-card.tsx` (nouveau)
Bloc dashboard affiché sur `app/accompagnante/dashboard/page.tsx` si `validation_status === 'valide'`. Récupère code + compteur via requête Supabase côté serveur.

#### 4.7.e — Formulaire inscription (`app/accompagnante/onboarding/page.tsx`)
Ajout d'un champ optionnel :
```tsx
<input
  name="parrainage_code"
  placeholder="Code de parrainage (optionnel)"
  maxLength={10}
  className="..."
/>
```
Validation côté serveur via `validateCode`. Si valide, redirection directe vers page abonnement (skip OCR/visio).

---

### 4.8 — Emails (`lib/emails.ts`)

4 nouvelles fonctions à ajouter :

- `sendParrainageBienvenueMarraine({ email, firstName, code })` — envoyée à la génération du code, explique le programme
- `sendParrainageFilleuleConfirmation({ email, firstName, marraineName })` — envoyée à la filleule lorsqu'elle finalise son abonnement
- `sendParrainageRecompense({ email, firstName, nbRecompenses })` — envoyée à la marraine quand elle atteint 5 parrainages confirmés
- `sendAdminParrainageFlag({ marraineName, filleuleName, flag, parrainageId })` — envoyée immédiatement à l'admin à chaque flag de suspicion, avec lien direct vers `/admin/parrainages/blacklist?id={parrainageId}`

---

### 4.9 — Cron J+30 (`app/api/cron/confirm-parrainages/route.ts`)

Nouveau fichier. Route protégée par `CRON_SECRET`.

```typescript
import { NextResponse } from 'next/server'
import { createServerClient } from '@supabase/ssr'
import { stripe } from '@/lib/stripe'
import { sendParrainageRecompense } from '@/lib/emails'

export async function GET(request: Request) {
  // 1. Vérifier CRON_SECRET
  // 2. SELECT parrainages WHERE statut='abonnee' AND filleule_abonnee_at <= NOW() - INTERVAL '30 days'
  // 3. Pour chaque : vérifier subscription active de filleule, sinon skip
  // 4. UPDATE statut='confirme', confirme_at=NOW()
  // 5. UPDATE parrainages_codes.compteur_confirmes += 1
  // 6. Si compteur_confirmes >= 5 :
  //    a. Créer coupon Stripe 100% duration='repeating' duration_in_months=6
  //    b. Appliquer à l'abonnement actif de la marraine (stripe.subscriptions.update avec discounts)
  //    c. UPDATE parrainages_codes : total_recompenses += 1, derniere_recompense_at=NOW(), compteur_confirmes=0
  //    d. INSERT admin_actions_log (action_type='parrainage_recompense_appliquee')
  //    e. sendParrainageRecompense
  // 7. Retourner JSON { processed: N, rewards: M }
}
```

Configuration Vercel : ajouter dans `vercel.json` :
```json
{
  "crons": [
    { "path": "/api/cron/confirm-parrainages", "schedule": "0 2 * * *" }
  ]
}
```

---

### 4.10 — Documents de suivi

| Fichier | Action |
|---------|--------|
| `README.md` | Ajouter `parrainages_codes` et `parrainages` dans la liste des tables |
| `STATUS.md` | Ajouter la ligne feature Parrainage avec statut approprié |
| `NEXT_STEPS.md` | Ajouter les étapes d'implémentation des 3 stories |
| `TODO-LAUNCH.md` | Ajouter « Tester le flux parrainage bout en bout (marraine → filleule → abonnement → J+30 → récompense) » |
| `app/politique-de-confidentialite/page.tsx` | Mentionner code parrainage, relation marraine/filleule, IP inscription, fingerprint carte (données techniques d'audit) |
| `scripts/test-supabase.ts` | Ajouter `parrainages` et `parrainages_codes` à la liste testée |

---

## Section 5 — Handoff d'implémentation

### Classification de portée : **Moderate**

Justification :
- Pas de pivot produit (MVP passe à 16 fonctionnalités, pas de remaniement).
- Mais : 2 nouvelles tables + 2 colonnes + 4 RLS policies + 10 nouveaux fichiers code + 12 fichiers à modifier + 1 migration SQL + 4 nouveaux emails + 1 cron → au-delà d'un simple ajustement dev direct.

### Plan d'exécution recommandé (séquencé, 3 stories)

**Phase 1 — Mise à jour documentaire** (sans risque, à faire en premier)
- [ ] Éditer `prd.md` selon §4.1 (MVP 15→16, retrait Phase 3, nouveaux FR)
- [ ] Éditer architecture selon §4.2
- [ ] Éditer ux-design selon §4.3
- [ ] Éditer product-brief selon §4.4
- [ ] Nettoyer README / STATUS / NEXT_STEPS / TODO-LAUNCH selon §4.10
- [ ] Mettre à jour politique de confidentialité

**Phase 2 — Migration base de données** (branche Supabase en premier)
- [ ] Créer `supabase/migrations/<timestamp>_add_parrainage_feature.sql` (§4.5)
- [ ] Appliquer sur branche Supabase via `mcp__supabase__create_branch` + `mcp__supabase__apply_migration`
- [ ] Vérifier : tables créées, policies actives, colonnes ajoutées
- [ ] Régénérer `lib/supabase/database.types.ts` si présent
- [ ] Backfill script : générer rétroactivement les codes pour les accompagnantes déjà `valide`

**Phase 3 — Story A : Validation automatique filleule (server-side)**
- [ ] Créer `app/actions/parrainage.ts` (§4.6.a) avec `generateCodeForUser`, `validateCode`, `createParrainageRelation`, `detectBlacklist`
- [ ] Étendre `app/actions/admin.ts` : appeler `generateCodeForUser` dans `validateAccompagnante`
- [ ] Étendre `app/accompagnante/onboarding/page.tsx` : champ code de parrainage
- [ ] Étendre `app/actions/subscription.ts:createCheckoutSession` : passer code dans metadata
- [ ] Ajouter `sendParrainageBienvenueMarraine` et `sendParrainageFilleuleConfirmation` dans `lib/emails.ts`
- [ ] Tests manuels : inscription filleule avec code → bypass visio → abonnement → entrée `parrainages`

**Phase 4 — Story B : Récompense marraine (compteur + coupon Stripe)**
- [ ] Étendre webhook Stripe `checkout.session.completed` (§4.2.g) : capture fingerprint, update `parrainages.statut='abonnee'`
- [ ] Créer `app/api/cron/confirm-parrainages/route.ts` (§4.9)
- [ ] Déclarer le cron dans `vercel.json`
- [ ] Créer `components/accompagnante/parrainage-card.tsx` (§4.7.d)
- [ ] Intégrer `<ParrainageCard />` dans `app/accompagnante/dashboard/page.tsx` et `app/accompagnante/profil/page.tsx`
- [ ] Ajouter `sendParrainageRecompense` dans `lib/emails.ts`
- [ ] Tests manuels : simuler J+30 (update manuel en base), vérifier coupon + email marraine

**Phase 5 — Story C : Blacklist admin + page admin**
- [ ] Créer `app/actions/admin-parrainages.ts` (§4.6.b)
- [ ] Créer `app/admin/parrainages/page.tsx` (§4.7.b) — vue d'ensemble
- [ ] Créer `app/admin/parrainages/blacklist/page.tsx` (§4.7.c) — liste blacklist
- [ ] Créer `components/admin/parrainages-blacklist-actions.tsx` — actions admin
- [ ] Étendre `app/admin/layout.tsx` : lien navigation (§4.7.a)
- [ ] Étendre `app/admin/historique/page.tsx:15` : 5 nouveaux `actionLabels`
- [ ] Ajouter `sendAdminParrainageFlag` dans `lib/emails.ts`
- [ ] Tests manuels : inscription filleule avec même email → blocage + email admin

**Phase 6 — Vérification finale & commit**
- [ ] `npm run build`, `tsc --noEmit`, `npm run lint`
- [ ] Smoke test flow complet :
  1. Accompagnante marraine valide reçoit son code (`sendParrainageBienvenueMarraine`)
  2. Nouvelle accompagnante filleule s'inscrit avec ce code
  3. Système détecte anti-doublon OK (email/tel/carte distincts)
  4. Filleule souscrit abonnement → profil `valide` automatique
  5. Entrée `parrainages.statut='abonnee'` créée
  6. Simulation cron J+30 → `statut='confirme'`, compteur marraine +1
  7. Répéter 5 fois → coupon Stripe appliqué à la marraine + email félicitations
  8. Test blacklist : inscription avec même email que marraine → blocage + entrée admin
  9. Test flag : inscription avec même adresse → flag visible admin + email admin
- [ ] Commit : `Introduit le programme de parrainage entre accompagnantes`
- [ ] Déploiement preview Vercel → smoke test → promotion prod
- [ ] Appliquer la migration SQL en production

### Recipients de handoff

- **Dev (Amelia via `/bmad-bmm-dev-story`)** : Phases 1, 3, 4, 5, 6 (dans une nouvelle fenêtre de contexte).
- **Infra / DB (Sylvain)** : Phase 2 — valide l'application de la migration en prod.
- **Product (John) / Architect (Winston)** : relecture optionnelle du PRD et Architecture (Sylvain peut le faire directement).

### Critères de succès

1. Build Next.js vert, `tsc --noEmit` vert, lint OK.
2. Tables `parrainages` et `parrainages_codes` créées en prod, 2 colonnes ajoutées sur `users` et `accompagnantes_profiles`.
3. Les accompagnantes `valide` ont toutes un code de parrainage généré.
4. Une nouvelle accompagnante avec code valide :
   - Bypass OCR + visio
   - Arrive directement à la page abonnement
   - Passe en `valide` (source=`parrainage`) après souscription
5. Le cron J+30 confirme les parrainages et applique la récompense à 5/5.
6. La blacklist bloque automatiquement les cas critiques (email/tel/carte identiques).
7. Les flags de suspicion génèrent un email admin immédiat et une entrée dans `/admin/parrainages/blacklist`.
8. L'admin peut autoriser en exception / confirmer fraude / ignorer via la page admin.

---

## Section 6 — Décisions arrêtées

Prises par Sylvain le 2026-04-18 :

1. **Portée** : accompagnantes uniquement. Bénéficiaires exclus du programme.
2. **Bypass filleule** : la filleule saute intégralement le flux OCR + visio. Validation automatique au paiement.
3. **Récompense marraine** : 6 mois offerts (coupon Stripe 100% `duration='repeating'` `duration_in_months=6`) après 5 parrainages confirmés, reset du compteur ensuite.
4. **Définition « parrainage confirmé »** : filleule abonnée active depuis 30 jours.
5. **Anti-doublon critique** (blocage auto) : email normalisé, téléphone E.164, fingerprint carte Stripe identiques.
6. **Anti-fraude suspicion** (flag + email admin) : même IP d'inscription ou même adresse postale.
7. **Page admin dédiée** : `/admin/parrainages` avec sous-onglet blacklist + actions (autoriser exception / confirmer fraude / ignorer).
8. **Notification admin** : email immédiat à `contact@roxanetnous.fr` à chaque flag de suspicion.
9. **Message félicitations marraine** : « Félicitations, vous avez 6 mois offerts ! Continuez à parrainer pour aider la communauté. »

---

## Approbation

- **Approuvé par** : Sylvain
- **Date** : 2026-04-18
- **Conditions** : aucune — exécution conforme au plan séquencé §5.
- **Prochaine étape** : handoff vers `/bmad-bmm-dev-story` (Amelia, Developer Agent) dans une fenêtre de contexte neuve, découpé en 3 stories successives (Story A server-side, Story B récompense Stripe, Story C blacklist admin).

---

## Historique checklist Change Navigation

| Section | Statut |
|---------|--------|
| 1. Understand trigger | [x] Done — nouvelle exigence métier (acquisition + rétention), bypass visio explicite |
| 2. Epic impact | [x] Done — nouvelle feature 16 MVP, retrait Phase 3 |
| 3. Artifact conflict | [x] Done — PRD, Architecture, UX, Brief, 22 fichiers code, 1 migration SQL additive, 1 cron, 4 emails |
| 4. Path forward | [x] Done — Option 1 (Direct Adjustment) retenue |
| 5. Proposal components | [x] Done — cette proposition |
| 6. Final review | [x] Done — approuvé par Sylvain le 2026-04-18 |
