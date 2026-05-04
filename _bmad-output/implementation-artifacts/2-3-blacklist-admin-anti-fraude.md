# Story 2.3 : Blacklist admin et detection anti-fraude parrainage

Status: done

<!-- Note: Validation est optionnelle. Lancer `validate-create-story` avant `dev-story` pour un controle qualite. -->

## Story

En tant qu'**administrateur** de la plateforme,
je veux que le systeme **detecte automatiquement les parrainages frauduleux** (meme email, meme telephone, meme carte de paiement, meme IP, meme adresse postale entre marraine et filleule) et m'alerte par email + une page admin dediee, et que je puisse **autoriser une exception, confirmer une fraude ou ignorer un flag**,
afin de **proteger l'integrite financiere du programme** (5 parrainages = 6 mois offerts) sans avoir a passer en revue manuellement chaque inscription.

## Acceptance Criteria

1. **AC1 - Helper `detectBlacklist` (server-only)**
   `app/actions/parrainage.ts` expose (interne, non `export`) une fonction `detectBlacklist({ marraineId, filleuleId, filleuleEmail, ipInscription }): Promise<{ blocage?: 'meme_email', flag?: 'meme_ip' | 'meme_adresse' }>`. Comportement attendu :
   - **Blocage** (`statut='bloque'`) si l'email normalise (lowercase + trim) de la filleule correspond a celui de la marraine (`users.email` joint sur `marraine_id`). Renvoie `{ blocage: 'meme_email' }`.
   - **Flag suspicion** (`flag_suspicion='meme_ip'`) si `ipInscription` non null et identique a `ip_inscription` d'un autre `parrainages` row de la **meme marraine** (i.e. la marraine a deja parraine quelqu'un depuis la meme IP) ou identique a une IP precedemment loggee pour cette marraine elle-meme - on cherche les collisions d'IP entre filleules d'une meme marraine.
   - Le detecteur **n'a pas acces** au telephone/adresse/fingerprint au signup (donnees pas encore en base) : ces signaux sont evalues plus tard (cf. AC2 et AC3).
   - Aucun blocage n'est fait pour `meme_ip` (signal flag uniquement, l'admin tranche).
   - Anti auto-parrainage est deja gere par `createParrainageRelation` (return `self_referral`) et n'est pas duplique ici.

2. **AC2 - Integration `detectBlacklist` dans `createParrainageRelation` (Story 2.1)**
   Apres l'INSERT initial dans `parrainages` avec `statut='inscrite'`, l'appel a `detectBlacklist` est fait. Selon le retour :
   - `{ blocage: 'meme_email' }` -> `UPDATE parrainages SET statut='bloque', blocage_raison='meme_email' WHERE id=...` + `UPDATE users SET parrainee_par=NULL WHERE id=filleuleId` (la filleule reste utilisateur normal, perd le bypass OCR/visio) + log `admin_actions_log` (`action_type='parrainage_bloque'`, `details: { marraine_id, filleule_id, raison: 'meme_email' }`) + email admin via `sendAdminParrainageFlag` (sujet : « Parrainage bloque - meme email »).
   - `{ flag: 'meme_ip' }` -> `UPDATE parrainages SET flag_suspicion='meme_ip' WHERE id=...` (statut reste `inscrite`, le bypass continue de fonctionner) + log admin (`action_type='parrainage_flag'`) + email admin (sujet : « Parrainage suspect - meme IP »).
   - Aucun retour -> rien de plus.
   - Le retour de `createParrainageRelation` reste compatible avec Story 2.1 : si bloque, retourne `{ ok: false, reason: 'blacklist_meme_email' }`. Si flag, retourne `{ ok: true, parrainageId, marraineId }` (le flow continue).
   - Le `signup()` cote `app/actions/auth.ts` ne change pas son comportement utilisateur : le code `blacklist_meme_email` est silencieux cote UX (l'inscription auth reussit, le user existe mais le parrainage est bloque). On garde le pattern « inscription silencieuse en cas d'echec parrainage » deja en place ligne 104-110.
   - **Idempotence** : si `parrainages.statut` est deja `bloque`, ne pas relancer la detection ni redoubler les logs/emails.

3. **AC3 - Detection `meme_adresse` differee + `meme_carte` au webhook**
   Dans le webhook Stripe `checkout.session.completed` (`app/api/webhooks/stripe/route.ts`), apres la capture du `stripe_fingerprint` (Story 2.2), si la ligne parrainages associee est encore `statut='inscrite'` ET sans flag de blocage, executer un second passage de detection :
   - **`meme_carte` (BLOCAGE)** : si le `stripe_fingerprint` qu'on vient de capturer correspond au fingerprint d'une carte deja utilisee par la marraine (lookup via `subscriptions` joints sur la marraine, exposing son `stripe_customer_id`, puis listage des cartes attachees a ce customer Stripe ou enregistrees dans une autre row `parrainages.stripe_fingerprint` de la meme marraine). Si match -> `UPDATE parrainages SET statut='bloque', blocage_raison='meme_carte'` + revoke abonnement filleule via la suite du webhook (cf. AC4 helper `revokeFilleuleValidation`) + log admin `parrainage_bloque` + email admin.
   - **`meme_adresse` (FLAG)** : comparer l'`accompagnantes_profiles.adresse` (lowercase + trim + collapse multi-spaces, **PAS** de normalisation geocodage MVP) de la marraine et de la filleule. Si identique non vide -> `UPDATE parrainages SET flag_suspicion='meme_adresse'` + log admin `parrainage_flag` + email admin.
   - Si la filleule a deja un flag `meme_ip` (Story 2.1) et qu'on detecte aussi `meme_adresse`, concatener `flag_suspicion='meme_ip,meme_adresse'` (pattern CSV simple, pas une nouvelle colonne).
   - Le bloc complet est englobe dans un `try/catch` silencieux (consistance avec le pattern Story 2.2). Logger via `console.error` avec prefixe `[parrainage_blacklist][webhook]`.

4. **AC4 - Helper `revokeFilleuleValidation` (cas blocage post-paiement)**
   Si la detection blocage `meme_carte` se declenche au webhook **APRES** que la filleule ait deja transitionne `valide` via parrainage (cas `confirmParrainageOnSuccess` ayant deja tourne), il faut revoquer cette validation :
   - Nouveau helper interne `revokeFilleuleValidation(filleuleId, raison)` dans `app/actions/parrainage.ts` qui :
     - `UPDATE accompagnantes_profiles SET validation_status='en_attente', validation_source='manuelle', validation_date=NULL WHERE user_id=filleuleId`,
     - `UPDATE users SET parrainee_par=NULL WHERE id=filleuleId`,
     - log `admin_actions_log` (`action_type='parrainage_fraude_confirmee'` avec `details.via='webhook_meme_carte'`).
   - Si la filleule n'etait **pas encore** `valide` (cas plus rare : webhook `meme_carte` arrive avant `confirmParrainageOnSuccess` cote success page), le helper se contente de mettre `parrainee_par=NULL`.
   - **Important** : on ne revoque PAS l'abonnement Stripe lui-meme (la filleule a paye, elle peut continuer son abonnement) ; on revoque uniquement le bypass de validation. Decision documentee : « la filleule devra repasser par OCR + visio si elle veut etre validee ». L'admin pourra aussi confirmer fraude via la page admin (AC7) qui ajoute la suspension comportementale (suspendre les annonces) - mais ce n'est PAS automatique.

5. **AC5 - Email admin `sendAdminParrainageFlag` (`lib/emails.ts`)**
   Nouvelle fonction async `sendAdminParrainageFlag({ marraineName, filleuleName, type, parrainageId })` ou `type ∈ { 'meme_email', 'meme_carte', 'meme_ip', 'meme_adresse' }`. Comportement :
   - Destinataire : `process.env.ADMIN_NOTIFICATIONS_EMAIL` (nouvelle variable d'env), avec fallback sur `process.env.RESEND_FROM_EMAIL` au cas ou (mais privilegier ADMIN). Si aucun n'est defini, log et abandon silencieux.
   - Sujet : `Parrainage bloque` si type ∈ {meme_email, meme_carte}, `Parrainage suspect` si type ∈ {meme_ip, meme_adresse}.
   - Corps : nom marraine, nom filleule, raison/flag en clair, lien direct `${BASE_URL}/admin/parrainages/blacklist?id=${parrainageId}` (highlight via querystring).
   - Logger via `notifications_log` avec `type='admin_parrainage_flag'` et `user_id=null` (pas un utilisateur final). Pattern try/catch identique aux autres emails du fichier.
   - Pas d'emoji, design noir/blanc, pattern HTML coherent avec les autres emails.

6. **AC6 - Page admin `/admin/parrainages` (vue d'ensemble)**
   `app/admin/parrainages/page.tsx` (server component). Acces strictement `userData.role === 'admin'` (heritage du layout admin existant `app/admin/layout.tsx` deja gere par `redirect('/')` si non-admin).
   - **Counters en haut** (1 row de 6 stats cards) : `en_attente`, `inscrite`, `abonnee`, `confirme`, `bloque`, `flag_suspicion non null` (peut etre comptage independant du statut, donc agregation en SQL : `COUNT(*) WHERE flag_suspicion IS NOT NULL`).
   - **Tableau paginee** (50 rows / page, ordonne par `created_at DESC`) avec colonnes : Date, Marraine (first_name + last_name + email), Filleule (idem ou « N/A » si `filleule_id IS NULL`), Statut (badge couleur noir/blanc + libelle FR), Flag (libelle FR ou « - »), Actions (bouton « Voir » -> ancre `/admin/parrainages/blacklist?id=...`).
   - Filtre par statut via querystring (`?statut=bloque`), filtre par flag (`?flag=1` -> non null only).
   - Lien navigation vers sous-onglet « Blacklist & flags » -> `/admin/parrainages/blacklist`.
   - Pas d'actions cote ce premier ecran (l'agent admin clique « Voir » pour acceder a la page detaillee).

7. **AC7 - Page admin `/admin/parrainages/blacklist` (gestion des cas)**
   `app/admin/parrainages/blacklist/page.tsx` (server component) qui liste les rows `parrainages` avec `statut='bloque' OR flag_suspicion IS NOT NULL OR statut='fraude'`, ordonnes par `created_at DESC`.
   - Colonnes detaillees : Date, Marraine (nom + email + telephone), Filleule (nom + email + telephone + adresse profil si dispo), Raison (`blocage_raison` ou `flag_suspicion`), Statut, Actions (composant client).
   - Si `searchParams.id` est present, scroll-into-view sur la row correspondante (ou la met en surbrillance via `bg-accent/30` une frame + `aria-current`).
   - **Composant client `ParrainageBlacklistActions`** (`components/admin/parrainage-blacklist-actions.tsx`) :
     - Bouton « Autoriser exception » (visible si `statut='bloque'` ou `flag_suspicion IS NOT NULL`) -> ouvre une textarea « Notes » + valide -> appel `autoriserException(parrainageId, notes)`.
     - Bouton « Confirmer fraude » (visible si `statut='bloque'` ou `flag_suspicion IS NOT NULL`) -> ouvre une textarea « Notes » + valide -> appel `confirmerFraude(parrainageId, notes)`.
     - Bouton « Ignorer flag » (visible si `flag_suspicion IS NOT NULL` uniquement) -> appel direct `ignorerFlag(parrainageId)` sans textarea.
     - Pattern UI identique a `signalement-actions.tsx` (Button + state collapse).

8. **AC8 - Server actions `app/actions/admin-parrainages.ts`**
   Nouveau fichier (`'use server'`) qui exporte 3 actions, chacune avec controle strict `userData.role === 'admin'` (pattern admin-signalements.ts) :
   - `autoriserException(parrainageId, notes): Promise<{ error?: string }>` :
     - `UPDATE parrainages SET statut = (statut IN ('abonnee','confirme') ? statut : 'inscrite'), blocage_raison=NULL, flag_suspicion=NULL WHERE id=parrainageId`. **Decision 2026-05-04 D2** : si la filleule a deja paye (statut `abonnee` ou `confirme`) au moment de l'autorisation admin, on **preserve** ce statut au lieu de regresser vers `inscrite` -- evite la desync avec Stripe et le compteur recompense. Sinon, le flow normal reprend (`inscrite`, la filleule pourra payer et etre validee).
     - **Quota recompense** : le parrainage compte normalement dans le quota de la marraine (lecture stricte). L'admin a explicitement valide qu'il ne s'agit pas d'une fraude, le parrainage est donc legitime cote palier 5 = 6 mois.
     - **Critique** : si la filleule etait deja `valide` via Story 2.1 AC9 (cas de la decouverte fraude post-paiement par re-vue admin), `validation_status` reste `valide` (l'admin a explicitement decide d'autoriser).
     - Si la filleule avait perdu son `parrainee_par` au moment du blocage (AC2), restaurer `parrainee_par = parrainages.marraine_id`.
     - Log `admin_actions_log` (`action_type='parrainage_autorise_exception'`, `details: { notes }`).
     - `revalidatePath('/admin/parrainages')` et `revalidatePath('/admin/parrainages/blacklist')`.
   - `confirmerFraude(parrainageId, notes): Promise<{ error?: string }>` :
     - `UPDATE parrainages SET statut='fraude', flag_suspicion=NULL WHERE id=parrainageId` (le flag suspicion est aussi nettoye pour coherence d'etat).
     - **Decision 2026-05-04 D1** : ne retrograder la filleule QUE si sa validation provient du parrainage. Charger `accompagnantes_profiles.validation_source` avant : si `validation_source='parrainage'`, appeler `revokeFilleuleValidation(filleuleId, 'fraude_confirmee')` (helper AC4) qui met `validation_status='refuse'` + `refus_motif='Suspicion fraude parrainage - confirme par admin'` + log structure. Si `validation_source IN ('ocr','visio','manuelle')`, **preserver** la validation -- la filleule a prouve son identite par un autre canal, elle n'est pas penalisee pour la fraude (presumee) de la marraine.
     - **Suspension marraine optionnelle** : pour MVP, on **ne suspend PAS automatiquement** la marraine - l'admin decidera manuellement via la page utilisateurs si besoin (decision design assumee, eviter les faux positifs cote marraine). Documenter en Dev Notes.
     - Log `admin_actions_log` (`action_type='parrainage_fraude_confirmee'`, `details: { notes, marraine_id, filleule_id, filleule_validation_preservee: boolean }`).
     - `revalidatePath` idem.
   - `ignorerFlag(parrainageId): Promise<{ error?: string }>` :
     - `UPDATE parrainages SET flag_suspicion=NULL WHERE id=parrainageId` (statut reste tel quel, le flag est juste marque comme revu).
     - Log `admin_actions_log` (`action_type='parrainage_ignore_flag'`, `details: { parrainage_id }`).
     - `revalidatePath` idem.

9. **AC9 - Lien navigation admin (`app/admin/layout.tsx`)**
   Ajouter `{ href: '/admin/parrainages', label: 'Parrainages' }` dans le tableau de navigation (ligne 43-49), insere entre `Signalements` et `Historique` (ordre : tableau de bord, utilisateurs, annonces, messages, signalements, **parrainages**, historique). Pas d'autres modifications.

10. **AC10 - Labels historique admin**
    Etendre l'objet `actionLabels` dans `app/admin/historique/page.tsx:15-29` avec 4 nouvelles entrees :
    - `parrainage_bloque: 'Parrainage bloque'`
    - `parrainage_flag: 'Parrainage suspect'`
    - `parrainage_autorise_exception: 'Parrainage - exception autorisee'`
    - `parrainage_fraude_confirmee: 'Parrainage - fraude confirmee'`
    - `parrainage_ignore_flag: 'Parrainage - flag ignore'`
    - `validation_par_parrainage: 'Validation par parrainage'` (deja loggue par Story 2.1 AC9 mais absent de la map - ajouter aussi pour completude).

11. **AC11 - Migration SQL additive (contraintes)**
    Nouvelle migration `supabase/migrations/<timestamp>_parrainage_blacklist_constraints.sql` :
    - Index partiel pour acceleration de la page admin : `CREATE INDEX IF NOT EXISTS idx_parrainages_blacklist ON parrainages(created_at DESC) WHERE statut='bloque' OR flag_suspicion IS NOT NULL OR statut='fraude';`
    - Index sur `users.email` lowercase si non existant (pour le lookup `meme_email` rapide). Verifier prealablement avec `\d+ users`.
    - Pas de nouvelles colonnes (les colonnes `blocage_raison`, `flag_suspicion`, `stripe_fingerprint`, `ip_inscription` existent deja depuis la migration `20260428130104_add_parrainage_feature.sql`).
    - Migration idempotente (`IF NOT EXISTS`).

12. **AC12 - Tests**
    - `npx tsc --noEmit` : 0 erreur.
    - `npm run build` : succes, toutes routes generees.
    - Tests scenarios (manuels en preview Vercel) :
      1. Marraine A genere code, filleule B s'inscrit avec **meme email** que A -> entree `parrainages` cree avec `statut='bloque'`, `blocage_raison='meme_email'` ; `users.parrainee_par=NULL` cote B ; entree `admin_actions_log` ; email admin recu ; entree visible dans `/admin/parrainages/blacklist`.
      2. Filleule B s'inscrit avec **meme IP** que filleule precedente d'une meme marraine -> `flag_suspicion='meme_ip'` ; bypass continue de fonctionner ; email admin envoye ; ligne visible dans la page admin.
      3. Filleule B paie avec carte deja utilisee par marraine A (test Stripe : utiliser `4242 4242 4242 4242` cote marraine ET cote filleule) -> webhook detecte fingerprint identique -> `statut='bloque'`, `blocage_raison='meme_carte'`, validation revoquee si deja appliquee.
      4. Admin clique « Autoriser exception » sur un row bloque -> `statut='inscrite'`, `parrainee_par` restaure, log admin OK.
      5. Admin clique « Confirmer fraude » -> `statut='fraude'`, `validation_status='refuse'` cote filleule, log admin OK.
      6. Admin clique « Ignorer flag » -> `flag_suspicion=NULL`, statut inchange.
      7. Tests automatiques (fonctions pures) : extension de `scripts/test-parrainage.ts` avec quelques cas pour le helper de normalisation d'adresse.

## Tasks / Subtasks

- [x] **Task 1 - Migration SQL additive (AC: 11)**
  - [x] Creer `supabase/migrations/20260428144601_parrainage_blacklist_constraints.sql`.
  - [x] Index partiel `idx_parrainages_blacklist` (covering `statut='bloque' OR flag_suspicion IS NOT NULL OR statut='fraude'`).
  - [x] Index fonctionnel `idx_users_email_lower ON users(LOWER(email))`.
  - [x] Applique via `mcp__supabase__apply_migration` (succes).
  - [x] EXPLAIN confirme `Index Scan using idx_parrainages_blacklist` et `Index Scan using idx_users_email_lower`.

- [x] **Task 2 - Helpers detection (`app/actions/parrainage.ts` + `lib/parrainage-detection.ts`) (AC: 1, 4)**
  - [x] `detectBlacklist(...)` interne (non export) avec lookup email marraine (case-insensitive) + lookup IP collision.
  - [x] `revokeFilleuleValidation(filleuleId, raison, context)` interne + wrapper export `revokeFilleuleValidationFromWebhook` pour usage hors `'use server'`.
  - [x] Helpers purs `normalizeAddress`, `normalizeEmail`, `mergeFlagSuspicion` extraits dans `lib/parrainage-detection.ts` (un fichier `'use server'` ne peut exporter que des async functions).
  - [x] Tests pure functions etendus dans `scripts/test-parrainage.ts` (5 cas normalizeAddress, normalizeEmail, mergeFlagSuspicion idempotence/concat).

- [x] **Task 3 - Integration `detectBlacklist` dans `createParrainageRelation` (AC: 2)**
  - [x] Apres l'INSERT initial, appel `detectBlacklist`. Selon retour : UPDATE statut/raison + reset `parrainee_par` si bloque + log admin + email admin.
  - [x] Idempotence : si la row existe deja en `bloque/meme_email`, retour direct `{ ok: false, reason: 'blacklist_meme_email' }` sans relancer la detection.
  - [x] Retour adapte : `{ ok: false, reason: 'blacklist_meme_email' }` si bloque, `{ ok: true, parrainageId, marraineId }` si flag (continue normal).
  - [x] `signup()` (`app/actions/auth.ts:104-110`) gere deja `result.ok === false` via log silencieux + continuation -> compatible avec le nouveau reason.

- [x] **Task 4 - Detection webhook (`app/api/webhooks/stripe/route.ts`) (AC: 3, 4)**
  - [x] Fonction `detectBlacklistAtWebhook(supabase, parrainage)` ajoutee. Branchee aux deux points de capture du fingerprint : `checkout.session.completed` et `customer.subscription.updated` (rattrapage trial via `captureParrainageFingerprint`).
  - [x] `meme_carte` : lookup primaire en BDD (autres rows `parrainages.stripe_fingerprint` joint sur la marraine en tant que marraine ou filleule), fallback `stripe.paymentMethods.list` sur le customer de la marraine. Match -> `statut='bloque'`, `blocage_raison='meme_carte'` + `revokeFilleuleValidationFromWebhook` + log admin + email admin.
  - [x] `meme_adresse` : comparaison `normalizeAddress` sur `accompagnantes_profiles.adresse` marraine vs filleule. Match -> `flag_suspicion` concatene via `mergeFlagSuspicion` (CSV avec un eventuel `meme_ip` deja pose au signup).
  - [x] Tout englobe dans `try/catch` silencieux. Logs `console.error` prefixes `[parrainage_blacklist][webhook]`.

- [x] **Task 5 - Email admin (`lib/emails.ts`) (AC: 5)**
  - [x] `sendAdminParrainageFlag({ marraineName, filleuleName, type, parrainageId })` avec destinataire `ADMIN_NOTIFICATIONS_EMAIL`, fallback sur `RESEND_FROM_EMAIL`, abandon silencieux si aucun.
  - [x] Sujet : `Parrainage bloque - ...` si `meme_email/meme_carte`, `Parrainage suspect - ...` si `meme_ip/meme_adresse`.
  - [x] Variable d'env documentee dans `.env.local.example`.
  - [x] Pattern try/catch + `notifications_log` (type=`admin_parrainage_flag`, user_id=null). HTML noir/blanc, pas d'emoji.

- [x] **Task 6 - Server actions admin (`app/actions/admin-parrainages.ts`) (AC: 8)**
  - [x] Fichier cree avec pattern `'use server'` + helper interne `requireAdmin()`.
  - [x] `autoriserException`, `confirmerFraude`, `ignorerFlag` selon AC8 (auth admin obligatoire, log `admin_actions_log`, `revalidatePath` sur les deux pages admin).
  - [x] `confirmerFraude` suspend la filleule (`validation_status='refuse'`, `refus_motif='Suspicion fraude parrainage - confirme par admin'`) mais ne suspend PAS automatiquement la marraine (decision MVP).

- [x] **Task 7 - Page admin vue d'ensemble (`app/admin/parrainages/page.tsx`) (AC: 6)**
  - [x] Server component avec 6 counters cards (en_attente, inscrite, abonnee, confirme, bloque, flag).
  - [x] Tableau pagine 50 rows ordonnes par `created_at DESC`.
  - [x] Filtres querystring `?statut=...&page=...&flag=1`.
  - [x] Lien vers `/admin/parrainages/blacklist`.

- [x] **Task 8 - Page admin blacklist + composant actions (AC: 7)**
  - [x] `app/admin/parrainages/blacklist/page.tsx` : server component avec union `statut IN (bloque, fraude) OR flag_suspicion IS NOT NULL` (deux requetes + dedup JS).
  - [x] Composant client `components/admin/parrainage-blacklist-actions.tsx` (pattern signalement-actions). Boutons "Autoriser exception" / "Confirmer fraude" (textarea notes), "Ignorer flag" (direct).
  - [x] Highlight `?id=...` via `bg-accent/30` + `aria-current`.

- [x] **Task 9 - Layout + historique (AC: 9, 10)**
  - [x] `app/admin/layout.tsx` : insertion `{ href: '/admin/parrainages', label: 'Parrainages' }` entre Signalements et Historique.
  - [x] `app/admin/historique/page.tsx` : 6 nouveaux labels (`validation_par_parrainage`, `parrainage_bloque`, `parrainage_flag`, `parrainage_autorise_exception`, `parrainage_fraude_confirmee`, `parrainage_ignore_flag`).

- [x] **Task 10 - Documentation et tests (AC: 12)**
  - [x] `app/politique-de-confidentialite/page.tsx` : mention explicite de la detection anti-fraude (email/IP/adresse/fingerprint carte) + clarification que l'IP ne declenche jamais une decision automatique penalisante (revue admin).
  - [x] `TODO-LAUNCH.md` : 7 scenarios de test preview ajoutes + variable `ADMIN_NOTIFICATIONS_EMAIL` ajoutee a la section Securite.
  - [x] `_bmad-output/implementation-artifacts/deferred-work.md` : section dette technique 2.3 ajoutee (meme_telephone, suspension marraine, normalisation adresse, masque /24, cron rattrapage, backfill, UNIQUE constraint).
  - [x] `scripts/test-parrainage.ts` : 9 tests ajoutes pour `normalizeAddress` (5), `normalizeEmail` (1), `mergeFlagSuspicion` (3). Tous passent (18 PASS).
  - [x] `npx tsc --noEmit` : 0 erreur. `npm run build` : 42 routes generees, succes (3 nouvelles routes ajoutees).

### Review Findings

Code review effectuee le 2026-04-28 (3 sous-agents : Blind Hunter, Edge Case Hunter, Acceptance Auditor). Diff cible 2.3 = 2099 lignes (option 3 elargie). 1 decision-needed resolue, 16 patches a traiter, 8 defer, ~70 dismissed.

- [x] [Review][Patch] Server Action publique sans authz : `generateCodeForUserSystem` deplace dans `lib/parrainage-codes.ts` (module non-`'use server'`) ; re-export `generateCodeForUserInternal` supprime ; callers `app/actions/admin.ts` et `app/actions/parrainage.ts` mis a jour
- [x] [Review][Patch] Composant `ParrainageBlacklistActions` : `setLoading(false)` + `setMode('idle')` + `router.refresh()` apres succes [components/admin/parrainage-blacklist-actions.tsx]
- [x] [Review][Patch] Webhook `meme_carte` UPDATE compare-and-swap (guard `statut IN (inscrite, abonnee)` + `blocage_raison IS NULL` + `.select()`) [app/api/webhooks/stripe/route.ts]
- [x] [Review][Patch] Capture fingerprint elargie a `statut IN (inscrite, abonnee)` pour gerer la race avec `confirmParrainageOnSuccess` [app/api/webhooks/stripe/route.ts]
- [x] [Review][Patch] PostgREST `.or()` remplace par deux `.eq()` paralleles + dedup JS (anti-injection) [app/api/webhooks/stripe/route.ts]
- [x] [Review][Patch] `confirmerFraude` appelle `revokeFilleuleValidationFromWebhook` puis suspend uniquement si `validation_source` etait parrainage [app/actions/admin-parrainages.ts]
- [x] [Review][Patch] `confirmerFraude` ne suspend plus une filleule validee par OCR/visio [app/actions/admin-parrainages.ts]
- [x] [Review][Patch] Erreurs Supabase loggees via `console.error` prefixe (sites principaux : signup blacklist, admin actions, webhook bloque/flag) [app/actions/parrainage.ts ; app/actions/admin-parrainages.ts ; app/api/webhooks/stripe/route.ts]
- [x] [Review][Patch] Pagination admin clamp via `redirect` vers la derniere page valide si `page > totalPages` [app/admin/parrainages/page.tsx]
- [x] [Review][Patch] Tableau admin tie-break secondaire sur `id DESC` [app/admin/parrainages/page.tsx]
- [x] [Review][Patch] Counter/filtre `en_attente` retire (statut inexistant en BDD) ; counter `fraude` ajoute en cards [app/admin/parrainages/page.tsx]
- [x] [Review][Patch] Counter `flag_suspicion` exclu des statuts `bloque`/`fraude` (disjonction) [app/admin/parrainages/page.tsx]
- [x] [Review][Patch] Race double webhook : CAS sur UPDATE (`select()` + `affected_rows > 0`) avant email/log [app/api/webhooks/stripe/route.ts]
- [x] [Review][Patch] Idempotence `createParrainageRelation` re-appelle `validateCode` avant retour pour revalider la marraine [app/actions/parrainage.ts]
- [x] [Review][Patch] `mergeFlagSuspicion` : CAS guard sur `flag_suspicion` initial avant UPDATE (eq/is selon null) [app/api/webhooks/stripe/route.ts]
- [ ] [Review][Patch] `validateCode` expose publiquement via service role sans rate-limit [app/actions/parrainage.ts:255-298] -- **NON PATCHE** (decision archi requise : choix middleware, Upstash Redis, Vercel Edge Config). A traiter separement.
- [x] [Review][Defer] Migration sans `CONCURRENTLY` (lock ecriture sur `users` pendant `CREATE INDEX`) [supabase/migrations/20260428144601_parrainage_blacklist_constraints.sql] -- deferred, pre-existing pattern + volume actuel ~320 users negligeable
- [x] [Review][Defer] `normalizeAddress` sans gestion accents [lib/parrainage-detection.ts] -- deferred, decision MVP documentee Dev Notes
- [x] [Review][Defer] `normalizeEmail` sans gestion `+suffix` Gmail / IDN [lib/parrainage-detection.ts] -- deferred, decision MVP documentee Dev Notes
- [x] [Review][Defer] Detection IP sans normalisation IPv6/IPv4-mapped [app/actions/parrainage.ts:60-72] -- deferred, signal flag uniquement
- [x] [Review][Defer] Stripe `paymentMethods.list` sans pagination (limit 10) [app/api/webhooks/stripe/route.ts:97] -- deferred, faux negatif acceptable
- [x] [Review][Defer] Pas de pagination sur `/admin/parrainages/blacklist` [app/admin/parrainages/blacklist/page.tsx] -- deferred, OK MVP volume faible
- [x] [Review][Defer] `notes` admin sans cap longueur [app/actions/admin-parrainages.ts] -- deferred, jsonb tolere mais a borner ulterieurement
- [x] [Review][Defer] Email admin fallback silencieux sur `RESEND_FROM_EMAIL` [lib/emails.ts:2023-2030] -- deferred, documenter ou fail loud plus tard

### Review Findings -- 2026-05-04 (passe code review multi-agent)

- [x] [Review][Patch] confirmerFraude doit filtrer sur validation_source='parrainage' avant rétrogradation -- décision 2026-05-04 D1=1 : préserver les filleules validées OCR/visio. **Déjà patché sur main** (lignes 175-203 de admin-parrainages.ts, logique `wasValidatedByParrainage`).
- [x] [Review][Patch] autoriserException : préserver statut='abonnee'/'confirme' si déjà payé -- décision 2026-05-04 D2=2 : ne pas régresser une filleule payante. **Déjà patché sur main** (lignes 49-51 de admin-parrainages.ts). **Spec AC8 mise à jour** dans cette session pour acter la nuance + quota stricte.
- [x] [Review][Patch] revokeFilleuleValidationFromWebhook exposé sans authz -- **Patché 2026-05-04** : auth guard ajouté (secret partagé `PARRAINAGE_INTERNAL_SECRET` ou auth admin). Webhook met à jour pour passer le secret. [app/actions/parrainage.ts]
- [x] [Review][Patch] generateCodeForUserSystem ré-exporté comme server action sans authz -- **Déjà fixé sur main** : pas de ré-export dans parrainage.ts, import depuis `lib/parrainage-codes.ts` (module non `'use server'`).
- [x] [Review][Patch] UPDATE meme_carte sans compare-and-swap -- **Déjà patché sur main** (route.ts ligne 165-179, `.in('statut',[...])`+`.is('blocage_raison',null)`+`.select('id')`).
- [x] [Review][Patch] mergeFlagSuspicion UPDATE sans CAS guard -- **Déjà patché sur main** via RPC atomique `merge_parrainage_flag_suspicion` qui retourne `was_added`.
- [x] [Review][Patch] PostgREST .or() avec interpolation directe d'UUID -- **Déjà patché sur main** (route.ts lignes 77-92, deux `.eq()` parallèles).
- [x] [Review][Patch] confirmerFraude n'utilise pas le helper revokeFilleuleValidation -- **Déjà patché sur main** (admin-parrainages.ts ligne 185, appel `revokeFilleuleValidationFromWebhook`).
- [x] [Review][Patch] revokeFilleuleValidation log toujours parrainage_fraude_confirmee -- **Déjà patché sur main** (parrainage.ts lignes 102-113, no-op log distinct via `console.warn` au lieu d'INSERT inconditionnel).
- [x] [Review][Patch] stripe.paymentMethods.list non paginé -- **Patché 2026-05-04** : `limit: 100` ajouté. Fallback `stripe.charges.list` couvrait déjà la majorité des cas mais autant maximiser ici. [app/api/webhooks/stripe/route.ts]
- [x] [Review][Patch] Détection meme_email trop étroite -- **Patché 2026-05-04** : extension à plusieurs filleules d'une même marraine partageant le même email. [app/actions/parrainage.ts]
- [x] [Review][Patch] confirmerFraude ne reset pas flag_suspicion -- **Patché 2026-05-04** : ajout `flag_suspicion: null` dans l'UPDATE. [app/actions/admin-parrainages.ts]
- [x] [Review][Patch] CSV flag_suspicion non normalisé en ordre canonique -- **Patché 2026-05-04** : tri alphabétique avant `.join(',')` dans `mergeFlagSuspicion` (helper local ; le RPC BDD couvre l'idempotence runtime). [lib/parrainage-detection.ts]
- [x] [Review][Patch] Webhook : si meme_carte ET meme_adresse, seul meme_carte est posé -- **Patché 2026-05-04** : pose explicite du flag `meme_adresse` AVANT le bloc carteMatch, plus champ `flag_adresse_pose` dans le log de blocage carte pour traçabilité. [app/api/webhooks/stripe/route.ts]
- [x] [Review][Patch] parrainee_par désynchronisé du parrainages.statut -- **Déjà patché sur main** (parrainage.ts lignes 451-480, détection AVANT de poser parrainee_par).
- [x] [Review][Defer] validateCode exposé sans rate-limit (oracle d'énumération de codes) -- deferred, reconnu dans la spec comme « à traiter séparément »
- [x] [Review][Defer] console.error sans alerting/Sentry partout -- deferred, dette pré-existante de la stack
- [x] [Review][Defer] Types `as any` dans pages admin -- deferred, dette TS pré-existante
- [x] [Review][Defer] escapeHtml dans lib/emails.ts non visible dans le diff -- deferred, dépendance externe à valider hors review

## Dev Notes

### Source d'autorite

**Sprint Change Proposal du 2026-04-18 parrainage** ([Source: _bmad-output/planning-artifacts/sprint-change-proposal-2026-04-18-parrainage.md]) - sections cles :
- §4.6.a : signature `detectBlacklist` (params + retour).
- §4.6.b : signature des 3 server actions admin.
- §4.7.a, §4.7.b, §4.7.c : pages admin.
- §4.8 : email `sendAdminParrainageFlag`.
- §6 decisions arretees : email/tel/carte = blocage critique, IP/adresse = flag suspicion + email admin immediat.

**Le SCP fait autorite** ; en cas de conflit avec PRD ou architecture, suivre le SCP. Decisions consignees dans la memoire projet (`project_parrainage_decisions.md`) - notamment SCP approuve 2026-04-18, blacklist admin pour anti-fraude.

### Stories precedentes - signaux deja captures

[Source: _bmad-output/implementation-artifacts/2-1-validation-automatique-filleule.md] **Story 2.1** a deja livre :
- `parrainages.ip_inscription` : capture au signup via `headers().get('x-forwarded-for')` (Story 2.1 AC6).
- `users.parrainee_par` : foreign key vers la marraine, persiste a la creation de la relation.
- `parrainages.code` indexe, `parrainages.marraine_id` indexe, `parrainages.filleule_id` indexe.
- `createParrainageRelation` deja en place + retourne `self_referral` si auto-parrainage detecte.
- Migration corrective `20260428153210_parrainee_par_on_delete_set_null.sql` deja appliquee : la filleule survit si la marraine supprime son compte.

[Source: _bmad-output/implementation-artifacts/2-2-ui-parrainage-card-et-fingerprint-stripe.md] **Story 2.2** a deja livre :
- `parrainages.stripe_fingerprint` : capture au webhook `checkout.session.completed` ET au handler `customer.subscription.updated` (rattrapage post-trial).
- Helper `captureParrainageFingerprint(supabase, subscription)` deja extrait dans le webhook - point d'extension naturel pour cette Story 2.3.
- UPDATE scopee `WHERE statut='inscrite' AND stripe_fingerprint IS NULL` (preserve la valeur d'inscription, idempotent).
- Pattern `try/catch` silencieux + `console.error` avec prefixe `[parrainage_fingerprint]`.

### Schema base de donnees - signaux disponibles

Verifie via MCP Supabase 2026-04-28 :
- `users` : `email` (UNIQUE, indexe), `phone` (nullable, **non hashe** en pratique, `phone_hash` colonne existe mais jamais peuplee dans le code app), `parrainee_par`. **Pas de colonne `address` cote `users` directement**.
- `accompagnantes_profiles` : `adresse`, `ville`, `code_postal`, `latitude`, `longitude`. **C'est la seule source d'adresse postale.** Pour la filleule, l'adresse est saisie via `updateAccompagnanteProfile` apres l'inscription.
- `accompagnes_profiles` : meme triplet `adresse/ville/code_postal` (mais le programme parrainage est restreint aux accompagnantes - design produit).
- `parrainages` : `blocage_raison`, `flag_suspicion`, `stripe_fingerprint`, `ip_inscription`, `statut` enum incluant `bloque` et `fraude`.

**Decision MVP : pas de detection telephone** (phone_hash jamais peuple, `users.phone` est nullable et pas obligatoire au signup). Si une evolution future veut ajouter cette detection, declencher le hash via trigger ou normaliser au moment de la mise a jour profil. Documenter en dette technique.

### Detection telephone - dette reportee

[Source: SCP §6, decision 5] L'anti-doublon critique inclut le **telephone E.164**. Cette story **ne l'implemente pas** car :
1. `users.phone_hash` existe en base mais n'est jamais peuple par le code applicatif (verifie via `grep -rn phone_hash` -> 0 hit).
2. Au signup, le telephone n'est pas demande (formulaire 4 champs : email/password/firstName/lastName).
3. La donnee n'est saisie que via `updateProfile` apres inscription, plus tard que la detection blacklist au signup.

**Implication** : la detection `meme_telephone` n'est pas dans le perimetre Story 2.3 mais constitue une dette - a traiter quand le telephone deviendra obligatoire au signup OU via un cron quotidien qui re-evalue les parrainages ouverts en croisant `users.phone`. Documenter en `deferred-work.md`.

### Detection IP - granularite

L'IP capturee dans `parrainages.ip_inscription` (Story 2.1) provient de `headers().get('x-forwarded-for')?.split(',')[0]?.trim() || h.get('x-real-ip')`. Sur Vercel, ce header est sanitize en prod (auto). En dev local, il peut etre vide ou `127.0.0.1`. La detection `meme_ip` doit donc :
- Ignorer les IPs vides ou nulles.
- Comparer literalement (pas de masque /24, pas de geolocation MVP). Une IP partagee (operateur mobile, NAT entreprise) est un faux positif acceptable cote flag (l'admin tranche).
- Lookup : `SELECT 1 FROM parrainages WHERE marraine_id = ? AND filleule_id <> ? AND ip_inscription = ? LIMIT 1`.

**Note securite** [deferred-work.md ligne 10] : `x-forwarded-for` est non sanitize cote app et l'app peut etre spooofee si elle n'est pas systematiquement derriere un reverse proxy de confiance. Sur Vercel, c'est OK. **A documenter en politique de confidentialite + ne pas baser de decision automatique critique uniquement sur l'IP** (raison du flag, pas blocage).

### Detection email - normalisation

`normalizeEmail(e: string)` = `e.toLowerCase().trim()`. Pas de gestion `+suffix` Gmail (decision MVP : faux negatif acceptable, l'admin pourra confirmer fraude manuellement). Pas de gestion punycode/unicode IDN (idem, faux positif rare).

Le lookup utilise un index fonctionnel `LOWER(email)` (Task 1 le cree si absent). Avec ~320 users actuels, la requete est triviale meme sans index, mais l'index couvre la croissance future.

### Detection adresse - normalisation MVP

`normalizeAddress(s: string)` = `s.toLowerCase().trim().replace(/\s+/g, ' ')`. Pas de :
- Gestion accents (decision : laisser tel quel - les accents sont stables UTF-8 dans la base, normaliser pourrait casser les comparaisons exactes).
- Geocoding (latitude/longitude existent mais pas systematiquement renseignes -> pas un signal fiable MVP).
- Suppression de la mention « rue/avenue/bd » (faux positif sur les chemins ruraux).

**Faux positifs/negatifs assumes** :
- « 1 rue de la Paix » et « 1 Rue de la Paix » -> match (OK).
- « 1 rue de la Paix » et « 1 rue de la paix, paris 75001 » -> pas match (faux negatif, l'admin doit voir manuellement). Acceptable car flag de suspicion + revue admin.
- Adresse vide chez l'un des deux -> pas de comparaison, pas de flag.

### Detection fingerprint - source

Source primaire : `parrainages.stripe_fingerprint` (capture par Story 2.2). Pour comparer avec la marraine :
- Si la marraine est elle-meme une ancienne filleule (`parrainages` row avec `filleule_id=marraineId`) -> son fingerprint est dans cette row.
- Sinon, lookup `subscriptions` -> `stripe_customer_id` -> via API Stripe `paymentMethods.list({ customer })` -> match `card.fingerprint`.

**Privilegier le lookup base de donnees** (option a + scan des autres `parrainages.stripe_fingerprint` de la marraine en tant que marraine) avant Stripe API (plus lent, rate-limit). Decision : SQL d'abord, Stripe API en fallback. Si la marraine n'a jamais eu de fingerprint capture (jamais ete filleule, jamais parraine personne avant), alors fallback Stripe API uniquement.

### Variable d'env nouvelle

`ADMIN_NOTIFICATIONS_EMAIL` = email destinataire des flags admin. Decision : variable dediee plutot que reutilisation de `RESEND_FROM_EMAIL` (qui est l'expediteur). Documentation a ajouter dans `.env.example`. Si non defini, log warning + abandon silencieux dans `sendAdminParrainageFlag` (le bypass de blacklist reste effectif, juste pas de notification admin).

### Pattern logging admin actions (deja en place)

Reference : `app/actions/admin-signalements.ts:43-50`.
- `admin_id` : UUID admin connecte (ou `null` pour actions systeme cron/webhook - cf. migration `20260428130322_admin_actions_log_allow_null_admin.sql`).
- `action_type` : string libre, doit matcher la map `actionLabels` dans `historique/page.tsx`.
- `target_type` : `'parrainage'` (nouvelle valeur) pour les actions sur la table `parrainages`.
- `target_id` : UUID du parrainage.
- `details` : JSONB libre (notes, raison, marraine_id, filleule_id selon contexte).

### Stack et conventions projet (rappel)

- **Next.js 16** App Router, React 19, TypeScript 6, ESM (`type: module`). [Source: package.json]
- **Supabase SSR** via `@/lib/supabase/server` : anon par defaut, `serviceRole: true` pour bypass RLS. [Source: lib/supabase/server.ts]
- **Stripe** via `@/lib/stripe`, API version `2026-03-25.dahlia`. [Source: lib/stripe.ts]
- **Resend** : pattern `try { send } catch {} -> logNotification`. Sender `RESEND_FROM_EMAIL`. [Source: lib/emails.ts:1-33]
- **Server actions** : `'use server'` en haut, retour `{ error?: string, success?: boolean }`. Auth check obligatoire (`role === 'admin'` pour les actions admin). [Source: app/actions/admin-signalements.ts:13-23]
- **Pas d'emojis** code et UI. [Source: .claude/CLAUDE.md, DECISIONS.md]
- **Design noir/blanc** : `gray-*`, `black`, `white`, `bg-accent`. Pas de classes `green-*`/`blue-*`/`primary-*`. [Source: DECISIONS.md 2026-02-11]
- **Communication francais**, accents complets `é`, `è`, `à`. [Source: _bmad/bmm/config.yaml]
- **Cards admin** : `bg-white rounded-xl border p-6` (pattern `app/admin/page.tsx`). Tableau : `<table>` avec `bg-accent/20` pour le `<thead>`, `border-b last:border-0 hover:bg-accent/10` pour les rows. [Source: app/admin/historique/page.tsx:42-83]

### Project Structure Notes

- Server actions admin : `app/actions/admin-<domaine>.ts`. Nouveau fichier `app/actions/admin-parrainages.ts` coherent avec la convention.
- Pages admin : `app/admin/<domaine>/page.tsx`. Sous-page : `app/admin/<domaine>/<sous>/page.tsx`. Pattern existant : `app/admin/utilisateurs/`, `app/admin/annonces/`, `app/admin/messages/`, `app/admin/signalements/`, `app/admin/historique/`, `app/admin/validation/`.
- Composants admin client : `components/admin/<nom>.tsx`. Convention : `<entity>-actions.tsx` pour les composants d'action (ex. `signalement-actions.tsx`, `validation-actions.tsx`). Nouveau : `parrainage-blacklist-actions.tsx`.
- Detection helpers : interne a `app/actions/parrainage.ts` (non exportes), reutilises par le webhook et `createParrainageRelation`.

### Testing Standards

- **Pas de framework test automatise** (pas de Jest/Vitest/Playwright dans `package.json`).
- Tests pure functions ad-hoc via `scripts/test-parrainage.ts` (extension du fichier existant).
- `npx tsc --noEmit` : 0 erreur (gate de qualite).
- `npm run build` : 40 routes generees sans erreur (gate de qualite).
- Tests manuels en preview Vercel pour les flows bout-en-bout (marraine, filleule, admin).
- Pas de test possible localement pour : webhook Stripe (signature requise), email Resend (cle API).

### Dette technique reportee

| Sujet | Reporte a | Pourquoi |
|-------|-----------|----------|
| Detection `meme_telephone` | Story future | `users.phone_hash` non peuple en pratique ; `users.phone` non obligatoire au signup. Necessite trigger SQL ou cron de re-evaluation. |
| Suspension automatique de la marraine en cas de fraude confirmee | Story future / decision produit | Risque de faux positif sur la marraine (la filleule peut avoir tente une fraude unilaterale). MVP : decision admin manuelle. |
| Geocoding/normalisation avancee adresse | V2 anti-fraude | MVP : comparaison literale + flag pour revue admin suffisant. |
| Masque /24 ou geolocation IP | V2 anti-fraude | Idem, MVP : comparaison literale. |
| Cron de re-evaluation periodique des parrainages ouverts (rattrapage signaux differes) | Story future | Le webhook capture deja les signaux post-paiement ; cas marginaux (changement de carte, modif adresse profil) non couverts. |
| Backfill historique : detection appliquee retroactivement aux parrainages existants pre-Story-2.3 | Hors story | A decider : script ad-hoc. Probablement aucun parrainage en prod a date (table 0 rows). |
| UNIQUE constraint sur `(filleule_id)` ou `(marraine_id, filleule_id)` dans `parrainages` | Hors story | Couvre la race au signup rapide. La detection blacklist limite deja le risque pratique. |

### References

- [Source: _bmad-output/planning-artifacts/sprint-change-proposal-2026-04-18-parrainage.md#Section-4.6.a] - signature `detectBlacklist`
- [Source: _bmad-output/planning-artifacts/sprint-change-proposal-2026-04-18-parrainage.md#Section-4.6.b] - signatures actions admin
- [Source: _bmad-output/planning-artifacts/sprint-change-proposal-2026-04-18-parrainage.md#Section-4.7.b] - page admin parrainages
- [Source: _bmad-output/planning-artifacts/sprint-change-proposal-2026-04-18-parrainage.md#Section-4.7.c] - page admin blacklist
- [Source: _bmad-output/planning-artifacts/sprint-change-proposal-2026-04-18-parrainage.md#Section-4.8] - email admin sendAdminParrainageFlag
- [Source: _bmad-output/implementation-artifacts/2-1-validation-automatique-filleule.md] - Story 2.1 (createParrainageRelation, capture IP)
- [Source: _bmad-output/implementation-artifacts/2-2-ui-parrainage-card-et-fingerprint-stripe.md] - Story 2.2 (capture stripe_fingerprint)
- [Source: _bmad-output/implementation-artifacts/deferred-work.md] - dette x-forwarded-for, race signup, FK asymetrie
- [Source: app/actions/parrainage.ts:205-278] - `createParrainageRelation` a etendre
- [Source: app/api/webhooks/stripe/route.ts] - point d'extension webhook (apres `captureParrainageFingerprint`)
- [Source: app/actions/admin-signalements.ts] - pattern server action admin a copier
- [Source: components/admin/signalement-actions.tsx] - pattern UI client component admin
- [Source: app/admin/historique/page.tsx:15-29] - actionLabels a etendre
- [Source: app/admin/layout.tsx:43-49] - navigation admin a etendre
- [Source: lib/emails.ts:531-636] - patterns email parrainage Story 2.1/2.2
- [Source: supabase/migrations/20260428130104_add_parrainage_feature.sql] - schema parrainages (colonnes deja presentes)
- [Source: DECISIONS.md] - regles design noir/blanc, pas d'emojis
- [Source: .claude/CLAUDE.md] - regles projet (pas d'emojis, ESM, Supabase MCP)

## Dev Agent Record

### Agent Model Used

claude-opus-4-7[1m]

### Debug Log References

- TS error initial sur `validation.marraineId` dans une closure async : capture explicite dans une const `marraineId` apres validation (narrowing perdu par TS dans la closure interne).
- Build error initial : `'use server'` interdit l'export de fonctions non-async. Helpers purs (`normalizeAddress`, `normalizeEmail`, `mergeFlagSuspicion`) extraits dans `lib/parrainage-detection.ts` pour permettre l'import depuis route handlers et tests.

### Completion Notes List

- AC1 helper `detectBlacklist` interne couvre `meme_email` (BLOCAGE) et `meme_ip` (FLAG). Lookup IP scope `marraine_id = X AND id <> currentRow AND ip_inscription = Y`.
- AC2 idempotence renforcee : si la row existe deja en `bloque/meme_email`, retour direct sans relancer la detection ni dupliquer log/email. Si elle existe en `inscrite`, retour normal.
- AC3 webhook : detection branchee aux DEUX endpoints (checkout.session.completed ET subscription.updated via captureParrainageFingerprint) pour couvrir le cas trial 30j ou le PM n'est dispo que post-trial.
- AC3 fingerprint : lookup primaire BDD (parrainages.stripe_fingerprint joint sur marraine_id ou filleule_id = X), fallback Stripe API si la marraine n'a jamais ete filleule ni parraine personne.
- AC4 `revokeFilleuleValidation` : ne touche pas a l'abonnement Stripe (la filleule a paye, elle continue). Revoque uniquement le bypass de validation : si `validation_source='parrainage'` et `validation_status='valide'`, repasse en `en_attente` avec `validation_source='manuelle'`. Toujours retire `parrainee_par`.
- AC5 email admin : variable `ADMIN_NOTIFICATIONS_EMAIL` avec fallback sur `RESEND_FROM_EMAIL`. Si rien defini, log warning + abandon silencieux (le bypass de blacklist reste effectif).
- AC7 page blacklist : deux requetes (statut IN bloque/fraude + flag_suspicion IS NOT NULL) puis dedup cote JS car PostgREST ne permet pas un OR croise simple sur IS NOT NULL. Volume admin small donc OK.
- AC8 `confirmerFraude` : suspension automatique de la marraine NON implementee (decision MVP, evite faux positifs - l'admin tranche manuellement via la page utilisateurs). Documente en deferred-work.md.
- AC11 migration additive sans nouvelle colonne (les colonnes blocage_raison/flag_suspicion/stripe_fingerprint/ip_inscription existent deja depuis 20260428130104). Index partiel + index fonctionnel LOWER(email) idempotents.
- Detection `meme_telephone` non implementee (users.phone_hash jamais peuple, telephone non demande au signup) : reportee en dette technique.
- Tests pure functions : 18 PASS, 0 FAIL. tsc 0 erreur. Build Next 16.2.4 reussi (42 routes generees, dont 2 nouvelles `/admin/parrainages` et `/admin/parrainages/blacklist`).

### File List

**Created:**
- `supabase/migrations/20260428144601_parrainage_blacklist_constraints.sql`
- `lib/parrainage-detection.ts`
- `app/actions/admin-parrainages.ts`
- `app/admin/parrainages/page.tsx`
- `app/admin/parrainages/blacklist/page.tsx`
- `components/admin/parrainage-blacklist-actions.tsx`

**Modified:**
- `app/actions/parrainage.ts` (ajout `detectBlacklist`, `revokeFilleuleValidation`, `revokeFilleuleValidationFromWebhook`, integration dans `createParrainageRelation`)
- `app/api/webhooks/stripe/route.ts` (ajout `detectBlacklistAtWebhook`, branchement aux deux points de capture du fingerprint)
- `lib/emails.ts` (ajout `sendAdminParrainageFlag`)
- `app/admin/layout.tsx` (lien navigation Parrainages)
- `app/admin/historique/page.tsx` (6 nouveaux `actionLabels`)
- `app/politique-de-confidentialite/page.tsx` (mention detection anti-fraude)
- `scripts/test-parrainage.ts` (9 tests purs supplementaires)
- `.env.local.example` (variable `ADMIN_NOTIFICATIONS_EMAIL`)
- `TODO-LAUNCH.md` (scenarios test bout-en-bout + variable env)
- `_bmad-output/implementation-artifacts/deferred-work.md` (dette technique Story 2.3)

## Change Log

| Date | Auteur | Description |
|------|--------|-------------|
| 2026-04-28 | Dev (Claude Opus 4.7) | Implementation Story 2.3 - blacklist admin et detection anti-fraude (AC1-AC12). Migration index, helpers detection, integration createParrainageRelation et webhook Stripe, email admin, server actions admin, pages admin /admin/parrainages et /admin/parrainages/blacklist, layout + historique, documentation politique de confidentialite et TODO-LAUNCH. Tests purs 18 PASS, tsc 0 erreur, build 42 routes succes. |
| 2026-05-04 | Dev (Claude Opus 4.7) | Code review multi-agent (Blind Hunter + Edge Case Hunter + Acceptance Auditor). 15 patches identifies, 9 deja appliques sur main, 6 nouveaux patches appliques : (1) auth guard sur revokeFilleuleValidationFromWebhook avec PARRAINAGE_INTERNAL_SECRET, (2) detection meme_email etendue aux filleules d'une meme marraine, (3) reset flag_suspicion dans confirmerFraude, (4) tri canonique CSV mergeFlagSuspicion, (5) flag meme_adresse pose avant blocage meme_carte pour tracabilite, (6) limit 100 sur stripe.paymentMethods.list. Decisions D1=preserve OCR/visio, D2=preserve abonnee/confirme, quota=stricte. Spec AC8 mise a jour. tsc 0 erreur. Statut passe a done. |
