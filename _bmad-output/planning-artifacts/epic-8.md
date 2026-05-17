---
stepsCompleted: ['step-01-validate-prerequisites', 'step-02-design-epics', 'step-03-create-stories']
inputDocuments:
  - prd.md
  - architecture-technique-roxanetnous-2026-02-09.md
  - ux-design-specification.md
  - sprint-change-proposal-2026-04-18-parrainage.md
  - epics.md
  - ../../DECISIONS.md
  - ../../app/actions/parrainage.ts
  - ../../lib/parrainage-codes.ts
  - ../../lib/parrainage-detection.ts
  - ../../app/api/cron/confirm-parrainages/route.ts
workflowType: 'create-epics-and-stories'
epic_number: 8
epic_title: 'Parrainage symétrique — autorisation accompagné → accompagnant'
created: '2026-05-16'
status: 'requirements-extracted'
---

# Epic 8 — Parrainage symétrique (accompagné → accompagnant)

## Vue d'ensemble

Étend le programme de parrainage existant (Epic 2, SCP 2026-04-18) pour autoriser un **accompagné** à parrainer un **accompagnant**, avec récompense symétrique (6 mois Stripe offerts à 5 parrainages confirmés). Le parrainage actuel `accompagnant → accompagnant` est conservé tel quel.

**Sens autorisés après Epic 8 :**
- `accompagne → accompagnant` (NOUVEAU)
- `accompagnant → accompagnant` (existant, inchangé)

**Sens interdits (garde-fou serveur explicite) :**
- `accompagne → accompagne`
- `accompagnant → accompagne`

**Décisions actées (échange Sylvain 2026-05-16) :**

| Point | Décision |
|---|---|
| Bénéfice filleul | Bypass visio + validation auto après 1er paiement Stripe (identique parrainage actuel) |
| Éligibilité parrain accompagné | Tout accompagné avec abonnement actif |
| Récompense parrain accompagné | 6 mois offerts à 5 parrainages confirmés, sur `STRIPE_PRICE_ACCOMPAGNE_MENSUEL`/`ANNUEL` selon abonnement courant |
| Pas d'abonnement actif au palier | Récompense perdue + reset compteur (symétrie totale) |
| Saisie code filleul | Même champ que parrainage existant au signup accompagnant |
| Page partage parrain accompagné | `/accompagne/parrainage` (nouvelle) |
| Anti-fraude `meme_email`/`meme_ip` | Transposable directement (logique parrain-indépendante) |
| Blacklist admin | Cible n'importe quel rôle parrain |
| Wording UI | "marraine/filleule" → "parrain/filleul" partout (sauf colonnes BDD historiques) |
| Cron `confirm-parrainages` | Sélection `price_id` selon `role(parrain)` |
| Page admin `/admin/parrainages` | Élargir filtre tous rôles |
| Email `Bienvenue marraine` | Reformulation neutre `Bienvenue parrain` |

---

## Requirements Inventory

### Exigences Fonctionnelles (nouvelles Epic 8)

- **FR49** : Un accompagné avec abonnement actif (`subscriptions.status IN ('active', 'trialing')`) possède un code de parrainage unique 8 caractères généré automatiquement à la première bascule `status = 'active'` (idempotent via `parrainages_codes.user_id` unique). Le code est accessible via la page `/accompagne/parrainage`.

- **FR50** : Le champ « Code de parrainage (optionnel) » au signup accompagnant accepte un code émis par un parrain accompagné OU par un parrain accompagnant. La validation `validateCode` lookup `parrainages_codes.user_id` puis détecte automatiquement le rôle du parrain via `users.role` et applique les règles métier appropriées. Acceptation : un même formulaire, un même appel `validateCode`, deux comportements aval cohérents.

- **FR51** : À la confirmation du 1er paiement Stripe (`checkout.session.completed`, `session.metadata.parrainage_code` présent), le filleul accompagnant est validé automatiquement (`accompagnants_profiles.validation_status = 'valide'`, `validation_source = 'parrainage'`) sans passer par OCR + visio (bypass `FR11bis/ter/quater`), quel que soit le rôle du parrain. Acceptation : la règle de validation existante (cf. `confirmParrainageOnSuccess`) s'applique identiquement.

- **FR52** : Un parrain accompagné gagne 6 mois d'abonnement offerts (coupon Stripe 100% sur 6 mois) appliqué sur son abonnement courant (`accompagne_mensuel` ou `accompagne_annuel`) lorsque son compteur `parrainages_codes.compteur_confirmes` atteint 5. Le compteur est ensuite reset à 0 et `total_recompenses` incrémenté. Acceptation : identique à la règle accompagnant, le cron `confirm-parrainages` sélectionne le bon `price_id` selon `role(parrain)`.

- **FR53** : Si l'abonnement du parrain (accompagné OU accompagnant) n'est pas actif (`status NOT IN ('active', 'trialing')`) au moment du palier 5, la récompense est perdue et le compteur reset sans coupon appliqué (symétrie totale avec règle actuelle `hasActiveSubscription`). Acceptation : aucune créance différée, comportement déterministe.

- **FR54** : Le serveur impose les sens autorisés via guard explicite dans `createParrainageRelation` : (a) `role(filleul) === 'accompagnant'` obligatoire (sinon `ok: false, reason: 'invalid_filleul_role'`) ; (b) `role(parrain) IN ('accompagnant', 'accompagne')` ; (c) sens `parrain accompagnant → filleul accompagne` impossible car le champ code n'existe pas dans le signup accompagné. Acceptation : un test d'intégration force chaque sens interdit et vérifie le rejet serveur.

- **FR55** : La page admin `/admin/parrainages` liste tous les parrainages avec colonne « Rôle parrain » (Accompagnant / Accompagné) et filtre déroulant. La blacklist admin (`/admin/parrainages/blacklist`) cible n'importe quel rôle. Acceptation : aucun parrainage masqué selon le rôle, audit complet possible.

### NonFunctional Requirements (héritées)

- **NFR-Sec-E8.1** : Anti-fraude `meme_email` (bloquant) et `meme_ip` (flag) transposés. La détection est rôle-indépendante (compare email/IP filleule à autres filleules du même parrain). Acceptation : `detectBlacklist` ne change pas de signature.

- **NFR-Sec-E8.2** : Le code parrainage d'un accompagné dont l'abonnement passe `canceled`/`unpaid` est invalidé immédiatement par `validateCode` (existant `marraine_subscription_inactive` réutilisé). Acceptation : test d'intégration `subscription paused → validateCode fails`.

- **NFR-A11y-E8.1** : La page `/accompagne/parrainage` respecte WCAG 2.2 AA : 0 violation Critical/Serious axe-core, `lint:a11y-check` baseline ≤ 158 conservée. Entrée baseline ajoutée à `tests/a11y/`. DoD a11y obligatoire (CLAUDE.md règle durcie).

- **NFR-RGPD-E8.1** : Aucune nouvelle PII collectée (réutilise table `parrainages` existante avec TTL 18 mois Epic 7.B). Mise à jour `/politique-de-confidentialite` pour mentionner extension aux accompagnés (1 ligne).

- **NFR-Test-E8.1** : Tests d'intégration `tests/api/parrainage/` à étendre : sens `accompagne→accompagnant` (golden path), sens interdits (`accompagne→accompagne`, `accompagnant→accompagne`), récompense palier 5 sur price_id accompagné, abonnement parrain inactif au palier.

### Additional Requirements (Architecture)

- **AR-E8.1** : Schéma `parrainages_codes` inchangé (colonne `user_id` UUID référence `users.id` sans contrainte de rôle). Audit MCP à faire en step suivant pour confirmer absence de CHECK constraint discriminant.

- **AR-E8.2** : Audit MCP `parrainages.marraine_id` FK et CHECK constraints — confirmer qu'aucune contrainte n'impose `role = 'accompagnant'`. Si CHECK existe, prévoir migration ALTER.

- **AR-E8.3** : `validateCode` (`app/actions/parrainage.ts:326-448`) : la requête `accompagnants_profiles!accompagnants_profiles_user_id_fkey(validation_status)` doit devenir conditionnelle (skip si parrain accompagné — pas de profil accompagnant). Logique : si `role(parrain) === 'accompagne'`, ne pas vérifier `validation_status`, vérifier uniquement `subscriptions.status IN ('active', 'trialing')`.

- **AR-E8.4** : `createParrainageRelation` (`app/actions/parrainage.ts:454-727`) : ajouter guard `role(filleul) === 'accompagnant'` après le check `self_referral`. Retour `{ ok: false, reason: 'invalid_filleul_role' }` si violation.

- **AR-E8.5** : `confirmParrainageOnSuccess` (`app/actions/parrainage.ts:733-961`) : `generateCodeForUserSystem(user.id)` à la fin (ligne ~879) — le filleul accompagnant devient parrain à son tour, ce qui est OK quel que soit le rôle du parrain initial. Pas de modification.

- **AR-E8.6** : Cron `/api/cron/confirm-parrainages/route.ts` : étape d'application coupon Stripe doit lire `users.role` du parrain et sélectionner le `price_id` correspondant. Code actuel suppose `accompagnant_*`.

- **AR-E8.7** : Webhook Stripe `app/api/webhooks/stripe/route.ts` : la genèse du code accompagné se fait à la première transition `subscription.status = 'active'` (pas au signup) — nouveau hook à ajouter ou réutiliser `customer.subscription.created`/`updated`.

- **AR-E8.8** : Page accompagné `/accompagne/parrainage/page.tsx` à créer, miroir de `/accompagnant/parrainage/page.tsx`. Composant `ParrainageView` (`components/accompagnant/parrainage-view.tsx`) à généraliser (extraire dans `components/shared/` ou créer variante `components/accompagne/parrainage-view.tsx`).

- **AR-E8.9** : Page admin `/admin/parrainages/page.tsx` : query SELECT à enrichir avec `users(role)` JOIN pour afficher colonne « Rôle parrain » + filtre URL `?role_parrain=accompagne|accompagnant|all`.

- **AR-E8.10** : Renommage `sendParrainageBienvenueMarraine` → `sendParrainageBienvenueParrain` (`lib/emails.ts`). Alias rétro-compatible 1 release puis suppression dette technique Epic 9.

- **AR-E8.11** : Audit grep complet pour wording UI : `marraine`, `filleule`, `Marraine`, `Filleule` → `parrain`/`filleul`. Périmètre : UI uniquement (libellés, messages, emails). Colonnes BDD `marraine_id`/`filleule_id` conservées (dette assumée, cohérent avec `accompagnante` → `accompagnant` traité Epic 5+6).

### UX Design Requirements

- **UX-DR-E8.1** : Page `/accompagne/parrainage` reprend le pattern visuel et l'IA de `/accompagnant/parrainage` (code grand format, bouton copier, compteur visuel `[X/5]`, liste des filleuls confirmés avec prénom + date), adaptée au design system "foyer" accompagné (background kraft, palette accompagné).

- **UX-DR-E8.2** : Le dashboard accompagné `/accompagne/dashboard` affiche un teaser « Invitez un accompagnant et gagnez 6 mois » visible uniquement si abonnement actif. Click → `/accompagne/parrainage`.

- **UX-DR-E8.3** : Page admin `/admin/parrainages` : nouveau filtre déroulant « Rôle parrain » (Tous / Accompagnant / Accompagné) en sus des filtres existants statut/blacklist. Colonne « Rôle parrain » ajoutée à la table.

- **UX-DR-E8.4** : Wording UI neutre : « Votre code parrain », « Vos filleuls », « Inviter un accompagnant », « Votre parrain », « Félicitations, vous avez 6 mois offerts ». Aucune occurrence visible de « marraine » / « filleule » en français.

- **UX-DR-E8.5** : Conformité a11y page `/accompagne/parrainage` : audit axe-core ajouté à `tests/a11y/parcours-*` (nouveau parcours ou extension existant), focus visible, contrastes, labels, lecteur d'écran (annonce ARIA live du compteur).

- **UX-DR-E8.6** : Page `/politique-de-confidentialite` : 1 ligne ajoutée mentionnant le parrainage entre accompagné et accompagnant (collecte code, email, IP — cohérent texte existant).

### Requirements Coverage Map

| Requirement | Story(ies) prévue(s) |
|---|---|
| FR49 (code accompagné + page partage) | 8.A.1, 8.B.1 |
| FR50 (saisie filleul détection rôle) | 8.A.2 |
| FR51 (validation auto bypass visio) | 8.A.2 (réutilisation) |
| FR52 (récompense 6 mois price_id accompagné) | 8.A.3 |
| FR53 (récompense perdue si sub inactif) | 8.A.3 |
| FR54 (sens interdits garde-fou) | 8.A.2 |
| FR55 (admin tous rôles) | 8.C.1 |
| NFR-Sec-E8.1 (anti-fraude transposé) | 8.A.2 (no-op extension) |
| NFR-Sec-E8.2 (sub inactif invalide code) | 8.A.2 |
| NFR-A11y-E8.1 (a11y page accompagné) | 8.B.1 |
| NFR-RGPD-E8.1 (politique confidentialité) | 8.C.2 |
| NFR-Test-E8.1 (tests intégration) | 8.D.1 |
| AR-E8.1/2 (audit BDD) | 8.A.0 (pré-requis) |
| AR-E8.3/4/5 (server actions) | 8.A.2 |
| AR-E8.6 (cron) | 8.A.3 |
| AR-E8.7 (webhook genèse code) | 8.A.1 |
| AR-E8.8 (UI page accompagné) | 8.B.1 |
| AR-E8.9 (UI admin) | 8.C.1 |
| AR-E8.10 (rename email + alias) | 8.C.3 |
| AR-E8.11 (wording UI) | 8.C.3 |
| UX-DR-E8.1/2/5 | 8.B.1, 8.B.2 |
| UX-DR-E8.3 | 8.C.1 |
| UX-DR-E8.4 | 8.C.3 |
| UX-DR-E8.6 | 8.C.2 |

---

## Epic List

Epic 8 est mono-épic, organisé en **4 mini-épics** (pattern Epic 5/6/7) :

### Mini-épic 8.A — Backend & métier (5 stories, ordre séquentiel strict)

Permet à un accompagné de parrainer un accompagnant, mécanique serveur fonctionnelle end-to-end (testable via curl + Stripe test mode).

**Stories** : 8.A.0 (audit BDD), 8.A.1 (webhook genèse code), 8.A.2 (server actions), 8.A.3 (cron récompense), 8.A.4 (tests intégration)
**FR couverts** : FR49, FR50, FR51, FR52, FR53, FR54 + NFR-Sec-E8.1, NFR-Sec-E8.2, NFR-Test-E8.1

### Mini-épic 8.B — UI accompagné (2 stories)

Un accompagné voit son code, peut le partager, suit ses parrainages.

**Stories** : 8.B.1 (page `/accompagne/parrainage` + a11y), 8.B.2 (teaser dashboard)
**FR couverts** : FR49 (UI volet) + NFR-A11y-E8.1 + UX-DR-E8.1, UX-DR-E8.2, UX-DR-E8.5
**Pré-requis** : 8.A.1 (genèse code) minimum, idéalement 8.A complet

### Mini-épic 8.C — UI admin & wording transverse (3 stories, parallélisables avec 8.A/8.B)

L'admin voit/blackliste tous les parrainages quel que soit le rôle parrain. Wording UI cohérent.

**Stories** : 8.C.1 (admin tous rôles), 8.C.2 (politique confidentialité), 8.C.3 (wording neutre + rename email)
**FR couverts** : FR55 + NFR-RGPD-E8.1 + AR-E8.9, AR-E8.10, AR-E8.11 + UX-DR-E8.3, UX-DR-E8.4, UX-DR-E8.6

### Mini-épic 8.D — Tests E2E Playwright (1 story)

Régression automatisée du parcours symétrique.

**Stories** : 8.D.1 (E2E golden path `accompagne → accompagnant`)
**FR couverts** : NFR-Test-E8.1 (volet E2E)
**Pré-requis** : 8.A + 8.B complets, harness Playwright Epic 7.C

### Synthèse ordonnancement

| Ordre | Mini-épic | Stories | Bloquant go-live ? |
|---|---|---|---|
| 1 | 8.A | 5 | OUI (fondation backend) |
| 2 | 8.B | 2 | OUI (UX feature complète) |
| 2 (parallèle) | 8.C | 3 | NON (peut être différé semaine +1) |
| 3 | 8.D | 1 | NON (régression, livrée après go-live OK) |

**Total : 11 stories**

---

## Epic 8 : Parrainage symétrique (accompagné → accompagnant)

**Goal :** étendre le programme de parrainage pour qu'un accompagné avec abonnement actif puisse parrainer un accompagnant (bypass visio + validation auto + récompense 6 mois Stripe à 5 parrainages confirmés), tout en conservant le parrainage `accompagnant → accompagnant` existant.

---

### Story 8.A.0 : Audit MCP schéma parrainages (pré-requis backend)

As a developer,
I want auditer le schéma Supabase des tables `parrainages`, `parrainages_codes`, `users.role`, `subscriptions`,
So that je confirme l'absence de CHECK constraint ou FK discriminant le rôle du parrain avant d'écrire le code Epic 8.

**Acceptance Criteria :**

**Given** la BDD prod accessible via MCP Supabase
**When** je liste les CHECK constraints sur `parrainages` et `parrainages_codes`
**Then** aucune contrainte n'impose `role = 'accompagnant'` côté parrain
**And** un compte rendu (`_bmad-output/implementation-artifacts/audit-bdd-parrainage-symetrique-{date}.md`) consigne : (1) DDL actuelles, (2) FK et CHECK existantes, (3) indexes utiles, (4) verdict GO/NO-GO pour Epic 8 sans migration, (5) si migration nécessaire, ALTER proposés.

**Given** la table `users`
**When** je vérifie les valeurs possibles de `role`
**Then** les valeurs `'accompagnant'`, `'accompagne'`, `'admin'`, `'visiteur'` sont confirmées (enum ou CHECK textuel)
**And** la colonne est NOT NULL et indexée (sinon flag pour story 8.A.2 future requête `validateCode` parrain accompagné).

**Given** la table `subscriptions`
**When** je vérifie son schéma
**Then** la colonne `status` existe et accepte les valeurs `'active'`, `'trialing'`, `'past_due'`, `'canceled'`, `'unpaid'`
**And** la FK `user_id` permet le lookup direct depuis n'importe quel rôle (pas de filtre rôle).

**Given** l'audit MCP terminé
**When** un GO est conclu
**Then** une entrée DECISIONS.md `F-Epic8-A0` est appendue avec la décision « parrainage symétrique implémentable sans migration BDD » (ou la liste des ALTER nécessaires).

---

### Story 8.A.1 : Webhook Stripe — genèse code parrainage à 1ère activation abonnement accompagné

As a accompagné,
I want que mon code de parrainage soit créé automatiquement la 1ère fois que mon abonnement passe `status='active'`,
So that je puisse le partager avec un proche accompagnant sans démarche supplémentaire.

**Acceptance Criteria :**

**Given** un accompagné qui souscrit son 1er abonnement Stripe
**When** le webhook `customer.subscription.created` ou `customer.subscription.updated` reçoit un event avec `status='active'` ou `'trialing'`
**Then** le serveur appelle `generateCodeForUserSystem(user.id)` (idempotent, retourne le code existant si déjà présent)
**And** une row `parrainages_codes` est créée avec `compteur_confirmes=0`, `total_recompenses=0`.

**Given** un accompagné qui résilie puis ré-active son abonnement
**When** le webhook re-déclenche `status='active'`
**Then** l'appel `generateCodeForUserSystem` est no-op (`created: false`) et le code initial est conservé
**And** aucun email "bienvenue parrain" n'est renvoyé (idempotence emails via flag `created`).

**Given** un accompagné qui active pour la 1ère fois
**When** la row `parrainages_codes` est créée
**Then** l'email de bienvenue parrain est envoyé via `after()` non-bloquant en réutilisant la fonction `sendParrainageBienvenueMarraine` existante (le rename neutre est traité en 8.C.3 sans bloquer 8.A.1)
**And** un log `notifications_log` est inséré (clé idempotence dédoublonnage)
**And** si 8.C.3 est mergée avant 8.A.1, utiliser directement `sendParrainageBienvenueParrain` (alias rétro-compat conservé pour les autres callers).

**Given** un accompagnant qui souscrit (cas existant)
**When** le webhook se déclenche
**Then** le comportement existant (genèse via `validateAccompagnante`) est inchangé
**And** une logique anti-double-création vérifie `users.role` avant de déclencher la branche accompagné (évite collision avec `validateAccompagnante`).

**Given** un sous-test de régression
**When** un signup accompagné sans abonnement (état `incomplete`/`incomplete_expired`)
**Then** aucun code n'est créé
**And** la page `/accompagne/parrainage` (livrée 8.B.1) affiche le bon état "Abonnement requis".

---

### Story 8.A.2 : Server actions parrainage symétrique (validateCode + createParrainageRelation + guards)

As a accompagnant filleul,
I want saisir au signup un code de parrainage émis par un accompagné OU par un accompagnant,
So that je bénéficie du bypass visio + validation auto identique au parrainage existant.

**Acceptance Criteria :**

**Given** un code parrainage émis par un accompagné avec abonnement actif
**When** un visiteur accompagnant appelle `validateCode(code)` au signup
**Then** le retour est `{ valid: true, marraineId, marraineFirstName }`
**And** la fonction lookup `users.role` du parrain : si `accompagne`, skip la vérification `accompagnants_profiles.validation_status` (inexistant) ; si `accompagnant`, conserve la vérification actuelle.

**Given** un code parrainage d'un accompagné dont l'abonnement est `canceled` ou `unpaid`
**When** `validateCode(code)` est appelée
**Then** le retour est `{ valid: false, reason: 'marraine_subscription_inactive' }` (existant réutilisé)
**And** l'erreur est annoncée à l'utilisateur dans la copy existante du signup.

**Given** un accompagné qui tente de saisir un code parrainage dans un signup accompagné
**When** la server action `createParrainageRelation` est appelée avec `role(filleul)='accompagne'`
**Then** le retour est `{ ok: false, reason: 'invalid_filleul_role' }`
**And** aucune row `parrainages` n'est insérée
**And** un event Sentry `tags={flow:'parrainage',signal:'invalid-filleul-role'}` est capturé (warning, pas critical).

**Given** un parrain accompagnant ET un filleul accompagné (sens interdit)
**When** la server action `createParrainageRelation` est appelée
**Then** le retour est `{ ok: false, reason: 'invalid_filleul_role' }` (même garde, le rôle filleul est seul filtré).

**Given** un parrain accompagné ET un filleul accompagnant (sens nouveau autorisé)
**When** `createParrainageRelation` réussit
**Then** une row `parrainages` est créée avec `marraine_id=user_parrain`, `filleule_id=user_filleul`, `statut='inscrite'`
**And** `users.parrainee_par` du filleul est mis à `user_parrain` (guard `IS NULL` conservé)
**And** la détection anti-fraude `detectBlacklist` s'exécute identiquement (rôle-indépendante).

**Given** un parrain accompagné qui auto-parraine (saisit son propre code)
**When** `createParrainageRelation` est appelée
**Then** le retour est `{ ok: false, reason: 'self_referral' }` (existant réutilisé, marche déjà).

**Given** la fonction `confirmParrainageOnSuccess` (existante)
**When** elle est appelée après paiement filleul accompagnant
**Then** elle fonctionne identiquement quel que soit le rôle du parrain
**And** `generateCodeForUserSystem(filleul.id)` est appelé en fin de flux (le filleul accompagnant devient parrain à son tour).

**Given** une suite de tests intégration `tests/integration/parrainage/symetrie.test.ts` (créée 8.A.4)
**When** elle est exécutée
**Then** les 4 sens (`accompagne→accompagnant` OK, `accompagnant→accompagnant` OK, `accompagne→accompagne` KO, `accompagnant→accompagne` KO) sont couverts.

---

### Story 8.A.3 : Cron `confirm-parrainages` — récompense Stripe selon rôle parrain

As a accompagné parrain,
I want recevoir 6 mois d'abonnement offerts sur mon abonnement courant (`accompagne_mensuel` ou `accompagne_annuel`) après 5 parrainages confirmés,
So that la mécanique de récompense est strictement symétrique au parrainage accompagnant.

**Acceptance Criteria :**

**Given** un parrain accompagné dont le compteur `parrainages_codes.compteur_confirmes` atteint 5
**When** le cron `/api/cron/confirm-parrainages` s'exécute et détecte le palier
**Then** le serveur lookup `users.role` puis sélectionne le `price_id` correspondant (`STRIPE_PRICE_BENEFICIAIRE_MENSUEL` ou `STRIPE_PRICE_BENEFICIAIRE_ANNUEL` selon l'abonnement courant)
**And** un coupon Stripe 100% sur 6 mois est appliqué sur l'abonnement actif via l'API Stripe (même pattern que `admin.ts:466`)
**And** `compteur_confirmes` est reset à 0 et `total_recompenses` incrémenté de 1.

**Given** un parrain accompagné dont l'abonnement est inactif (`status NOT IN ('active','trialing')`) au moment du palier
**When** le cron tente d'appliquer la récompense
**Then** aucun coupon n'est appliqué (Stripe call skip)
**And** `compteur_confirmes` est reset à 0 sans incrémenter `total_recompenses` (récompense perdue, symétrie totale)
**And** un log `admin_actions_log` `action_type='parrainage_recompense_perdue'` est inséré avec `details: { reason: 'sub_inactive', role: 'accompagne' }`.

**Given** un parrain accompagnant (cas existant)
**When** le cron s'exécute
**Then** le comportement existant est inchangé (sélection `STRIPE_PRICE_AUXILIAIRE_*`).

**Given** un email de notification de récompense
**When** la récompense est appliquée avec succès
**Then** `sendParrainageRecompense` est envoyé via `after()` (réutilise template existant, wording neutre OK 8.C.3)
**And** la copy email mentionne le bon montant (6 mois sur abonnement courant) sans préciser le rôle.

**Given** un cron qui rencontre une erreur Stripe (timeout, rate limit)
**When** le call coupon échoue
**Then** le statut `parrainages_codes` n'est PAS reset (retry possible au prochain cron)
**And** un event Sentry `tags={flow:'parrainage',signal:'cron-coupon-failed',severity:'critical'}` est capturé.

---

### Story 8.A.4 : Tests d'intégration parrainage symétrique

As a tech lead,
I want une suite de tests d'intégration qui couvre les 4 sens (golden path + sens interdits + abonnement inactif au palier),
So that je préviens toute régression du parrainage existant lors de l'extension Epic 8.

**Acceptance Criteria :**

**Given** un fichier `tests/integration/parrainage/symetrie.test.ts` créé
**When** la suite est exécutée via `npm run test:integration`
**Then** elle passe avec exit 0
**And** elle couvre minimum 6 scénarios :
  1. `accompagne → accompagnant` golden path (validateCode OK + createParrainageRelation OK + confirmParrainageOnSuccess OK + bypass visio appliqué + code filleul généré)
  2. `accompagnant → accompagnant` (régression : comportement Epic 2 inchangé)
  3. `accompagne → accompagne` rejet (`invalid_filleul_role`)
  4. `accompagnant → accompagne` rejet (`invalid_filleul_role`)
  5. parrain accompagné sub `canceled` → `validateCode` retourne `marraine_subscription_inactive`
  6. parrain accompagné au palier 5 mais sub `unpaid` → cron reset compteur sans coupon, log `recompense_perdue`.

**Given** la suite de tests
**When** elle s'exécute en CI GHA
**Then** elle est ajoutée au workflow existant et bloque la merge si exit != 0.

**Given** un seed de test Supabase (local ou CI ephemere)
**When** la suite construit les fixtures
**Then** elle crée 2 accompagnés + 2 accompagnants + 1 admin avec abonnements distincts, sans pollution prod (cf. règle `feedback_test_local_supabase` : validation par GHA).

**Given** un audit de couverture
**When** `npm run test:integration -- --coverage` est exécuté
**Then** `app/actions/parrainage.ts` atteint ≥ 85% de couverture (le code existant est déjà partiellement couvert par Epic 2 tests, on étend).

---

### Story 8.B.1 : Page `/accompagne/parrainage` — affichage code + filleuls + a11y

As a accompagné avec abonnement actif,
I want consulter mon code de parrainage, le copier facilement, voir mes filleuls confirmés et mon compteur de progression,
So that je peux inviter un accompagnant à rejoindre la communauté en toute autonomie.

**Acceptance Criteria :**

**Given** un accompagné avec abonnement actif et code généré
**When** il navigue sur `/accompagne/parrainage`
**Then** la page affiche : (1) code 8 caractères en grand format, (2) bouton "Copier le code" avec feedback ARIA live, (3) compteur visuel `[X/5]` parrainages confirmés, (4) liste des filleuls confirmés (prénom + date), (5) explication concise des 6 mois offerts.

**Given** un accompagné sans abonnement actif (jamais souscrit ou résilié)
**When** il navigue sur `/accompagne/parrainage`
**Then** la page affiche un état "Abonnement requis" avec CTA vers `/accompagne/abonnement`
**And** aucun code n'est exposé.

**Given** la page `/accompagne/parrainage`
**When** elle est auditée par `@axe-core/playwright`
**Then** 0 violation Critical/Serious
**And** une entrée baseline est ajoutée à `tests/a11y/` (parcours nouveau ou extension existant)
**And** `npm run a11y:axe:check` reste exit 0
**And** `npm run lint:a11y-check` baseline ≤ 158 conservée.

**Given** un utilisateur navigation clavier seul
**When** il atteint la page
**Then** focus visible sur tous les contrôles interactifs, ordre de tabulation logique, bouton "Copier" activable via Entrée/Espace.

**Given** un utilisateur lecteur d'écran
**When** il copie le code
**Then** une annonce ARIA live confirme "Code copié dans le presse-papier".

**Given** un audit visuel design system "foyer"
**When** la page est rendue
**Then** background kraft, palette accompagné, typographie cohérente avec `/accompagne/dashboard`.

---

### Story 8.B.2 : Teaser dashboard accompagné — "Invitez un accompagnant"

As a accompagné avec abonnement actif,
I want voir un teaser sur mon dashboard qui m'invite à parrainer un accompagnant,
So that je découvre la fonctionnalité sans devoir aller chercher la page dédiée.

**Acceptance Criteria :**

**Given** un accompagné avec abonnement actif et code généré
**When** il consulte `/accompagne/dashboard`
**Then** un bloc teaser est affiché avec : (1) titre court ("Invitez un accompagnant"), (2) explication 1 phrase (6 mois offerts à 5 parrainages), (3) CTA vers `/accompagne/parrainage`
**And** le bloc s'intègre au layout existant sans casser la hiérarchie visuelle.

**Given** un accompagné sans abonnement actif
**When** il consulte `/accompagne/dashboard`
**Then** le teaser n'est PAS affiché (pas de fausse promesse).

**Given** un audit a11y
**When** le bloc est ajouté
**Then** la baseline `lint:a11y-check` reste ≤ 158 et axe-core 0 violations.

**Given** un audit design system
**When** le bloc est rendu
**Then** wording masculin neutre (cf. règle CLAUDE.md), pas d'emoji, style cohérent.

---

### Story 8.C.1 : Page admin `/admin/parrainages` — tous rôles + filtre

As a admin,
I want voir tous les parrainages quel que soit le rôle du parrain et filtrer par rôle,
So que je peux monitorer la mécanique symétrique et blacklister un parrain accompagné si nécessaire.

**Acceptance Criteria :**

**Given** la page `/admin/parrainages` existante
**When** elle est rendue
**Then** la table affiche une nouvelle colonne "Rôle parrain" (Accompagnant / Accompagné) lookup via `users(role)` JOIN
**And** un filtre déroulant "Rôle parrain" (Tous / Accompagnant / Accompagné) est ajouté en sus des filtres existants
**And** l'URL reflète le filtre (`?role_parrain=accompagne`).

**Given** un admin qui filtre par `accompagne`
**When** il valide le filtre
**Then** seuls les parrainages dont `role(marraine_id)='accompagne'` sont listés.

**Given** la page `/admin/parrainages/blacklist` existante
**When** un admin blackliste un parrain
**Then** l'action fonctionne quel que soit son rôle (le toggle utilise déjà `user_id`, à valider qu'aucun guard rôle n'est posé)
**And** le log `admin_actions_log` capture le rôle dans `details.role_parrain`.

**Given** un audit a11y
**When** la table est rendue
**Then** entête de colonne ajoutée avec `scope="col"`, filtre déroulant avec `<label>` associé, baseline `lint:a11y-check` ≤ 158.

---

### Story 8.C.2 : Page politique de confidentialité — extension parrainage accompagné

As a visiteur curieux de mes données,
I want voir mentionné dans la politique de confidentialité que les accompagnés peuvent aussi parrainer,
So que la transparence RGPD est maintenue.

**Acceptance Criteria :**

**Given** la page `/politique-de-confidentialite` existante
**When** elle est rendue
**Then** la section parrainage est mise à jour pour préciser que le programme s'applique aux accompagnants ET aux accompagnés (1-2 lignes ajoutées)
**And** la mention des signaux anti-fraude (IP, email) est conservée et clarifiée comme rôle-indépendante.

**Given** un audit RGPD
**When** le contenu est revu
**Then** la durée de conservation 18 mois (Epic 7.B.1) est rappelée
**And** aucun nouveau traitement non documenté n'est introduit.

**Given** un audit a11y
**When** la page est auditée
**Then** baseline `lint:a11y-check` ≤ 158, 0 violation Critical/Serious axe-core.

---

### Story 8.C.3 : Wording UI neutre — `marraine/filleule` → `parrain/filleul` + rename email

As a utilisateur de la plateforme (n'importe quel rôle),
I want que la copy UI soit cohérente avec la règle masculin neutre du projet,
So que l'expérience est uniforme et accessible peu importe le genre.

**Acceptance Criteria :**

**Given** un grep cross-codebase des occurrences `marraine`, `Marraine`, `filleule`, `Filleule` dans `app/`, `components/`, `lib/emails.ts`, templates email
**When** la story est livrée
**Then** toutes les occurrences UI/copy sont remplacées par `parrain`, `Parrain`, `filleul`, `Filleul`
**And** les colonnes BDD `marraine_id`, `filleule_id` sont conservées (dette assumée, cohérent avec `accompagnante` → `accompagnant` Epic 5/6)
**And** les noms de variables JS internes peuvent être renommés si cohérent (à l'appréciation du dev, pas bloquant).

**Given** la fonction `sendParrainageBienvenueMarraine` dans `lib/emails.ts`
**When** elle est renommée
**Then** la nouvelle fonction `sendParrainageBienvenueParrain` est créée
**And** l'ancienne `sendParrainageBienvenueMarraine` devient un alias rétro-compatible qui appelle la nouvelle (1 release de transition)
**And** un commentaire `// @deprecated Epic 8 — remove next release` est ajouté
**And** une entrée `deferred-work.md` planifie la suppression de l'alias.

**Given** les templates email Resend
**When** ils sont vérifiés
**Then** les sujets et corps utilisent "parrain"/"filleul"
**And** la copy reste compréhensible pour un accompagnant comme pour un accompagné.

**Given** un audit régression
**When** la story est mergée
**Then** un test snapshot vérifie les sujets email (au minimum 4 : bienvenue parrain, confirmation filleul, récompense parrain, alerte admin) pour éviter régression copy future.

**Given** le règle CLAUDE.md "genre accompagnant"
**When** un futur dev ajoute une copy parrainage
**Then** la formulation masculin neutre est respectée (parrain, filleul, accompagnant).

---

### Story 8.D.1 : E2E Playwright — parcours `accompagne → accompagnant` golden path

As a tech lead,
I want un test E2E Playwright qui couvre le parcours complet `accompagne parraine accompagnant`,
So que je préviens toute régression UX du nouveau parcours et que la mécanique reste validée bout-en-bout.

**Acceptance Criteria :**

**Given** un harness Playwright + Stripe test mode opérationnel (cf. Epic 7.C)
**When** le test E2E `tests/e2e/parrainage-symetrique.spec.ts` est exécuté
**Then** il parcourt : (1) signup accompagné A → souscription Stripe test → code parrainage généré, (2) copie code A, (3) signup accompagnant B avec code A → souscription Stripe test → bypass visio → validation auto `valide`, (4) vérification BDD : `parrainages.statut='abonnee'`, `accompagnants_profiles.validation_status='valide'`, `validation_source='parrainage'`, code B généré
**And** le test passe en CI GHA.

**Given** un fail intermédiaire
**When** le test échoue
**Then** un screenshot et la trace Playwright sont attachés au run CI pour debug
**And** le test est marqué `@parrainage-symetrique` pour exécution sélective.

**Given** le pré-requis Stripe test mode
**When** Epic 7.C.1 n'est pas encore livré
**Then** la story est mise en `blocked-by-7.C.1` dans `sprint-status.yaml` jusqu'à résolution.

**Given** la story est livrée
**When** le run GHA est vert
**Then** une entrée `tests/e2e/README.md` documente le nouveau parcours et son périmètre.

---
