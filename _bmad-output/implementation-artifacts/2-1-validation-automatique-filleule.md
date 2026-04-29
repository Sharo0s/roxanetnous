# Story 2.1 : Validation automatique filleule (server-side parrainage)

Status: in-progress

<!-- Note: Validation est optionnelle. Lancer `validate-create-story` avant `dev-story` pour un contrôle qualité. -->

## Story

En tant qu'**accompagnante validée** (marraine) ou nouvelle accompagnante en cours d'inscription (filleule),
je veux pouvoir **partager / saisir un code de parrainage** qui valide automatiquement la filleule sans OCR ni visio dès qu'elle souscrit un abonnement payant,
afin que **l'acquisition d'auxiliaires se fasse via le réseau professionnel existant et que les filleules accèdent à la plateforme sans friction**.

## Acceptance Criteria

1. **AC1 — Migration additive appliquée**
   La migration SQL crée les tables `parrainages_codes` et `parrainages`, ajoute les colonnes `users.parrainee_par` et `accompagnantes_profiles.validation_source`, et active les 4 RLS policies (lecture propriétaire pour la marraine, accès admin total). La migration est idempotente (`CREATE TABLE IF NOT EXISTS`, `ADD COLUMN IF NOT EXISTS`, `DROP POLICY IF EXISTS` avant `CREATE POLICY`).

2. **AC2 — Code généré à la validation finale d'une accompagnante**
   Quand `validateAccompagnante(profileId, 'valide', ...)` réussit (transition `visio_realisee → valide`), un code de parrainage 8 caractères alphanumériques (excluant `0`, `O`, `1`, `I`, `l`) est inséré dans `parrainages_codes(user_id, code, compteur_confirmes=0, total_recompenses=0)`. La génération est idempotente : si une ligne existe déjà pour ce `user_id`, elle n'est pas remplacée.

3. **AC3 — Email de bienvenue marraine**
   À la génération du code, un email `sendParrainageBienvenueMarraine` est envoyé à la nouvelle marraine (sujet, code mis en évidence, message expliquant le programme et le seuil 5 parrainages = 6 mois offerts). L'envoi est non-bloquant (pattern `void (async () => { ... })()`), une entrée est logguée dans `notifications_log` (type `parrainage_bienvenue`).

4. **AC4 — Validation d'un code via formulaire**
   La fonction `validateCode(code)` retourne `{ valid: true, marraineId, marraineFirstName }` si :
   - Le code existe dans `parrainages_codes`,
   - La marraine a `accompagnantes_profiles.validation_status = 'valide'`,
   - Le code est strictement non vide après normalisation (uppercase, trim, max 8 caractères).
   Sinon retourne `{ valid: false, reason }` avec `reason ∈ { 'invalid_format', 'unknown_code', 'marraine_not_validated' }`.

5. **AC5 — Champ optionnel sur le formulaire d'inscription accompagnante**
   Le formulaire `RegisterForm` accompagnante (avant le step `password` ou en step dédié placé avant `password`) propose un champ optionnel « Code de parrainage (optionnel) ». La validation live appelle `validateCode` au blur. Si valide, un message vert affiche « Code valide — vous serez validée automatiquement dès votre abonnement. ». Si invalide, message rouge spécifique selon `reason`. Champ non bloquant : laisser vide doit fonctionner.
   Le code saisi est passé dans le `FormData` envoyé à `signup()` (champ `parrainage_code`, optionnel).

6. **AC6 — Création de la relation parrainage à l'inscription**
   Quand `signup()` reçoit un `parrainage_code` non vide ET valide, la fonction crée une ligne dans `parrainages` :
   - `code = <code normalisé>`
   - `marraine_id = <résolu via validateCode>`
   - `filleule_id = <authData.user.id>`
   - `statut = 'inscrite'`
   - `filleule_inscrite_at = NOW()`
   - `ip_inscription = <header x-forwarded-for ou null>`
   La colonne `users.parrainee_par` de la filleule est aussi mise à jour avec `marraine_id`.
   Si `parrainage_code` est invalide à ce moment (rare race condition), l'inscription se poursuit normalement sans parrainage et sans erreur visible côté UX.

7. **AC7 — Bypass OCR + visio pour la filleule en flow onboarding**
   Tant que la filleule est `parrainee_par IS NOT NULL` :
   - L'onboarding affiche un message d'accueil dédié : « Vous avez été parrainée par [Prénom marraine]. Pour finaliser votre inscription, complétez vos disponibilités et souscrivez votre abonnement — pas de pièces justificatives ni de visio à fournir. »
   - Les étapes 0 (Diplôme + uploads CV/diplôme), 2 (uploads permis si applicable), et l'envoi de justificatifs ne sont plus requis. Les uploads restent optionnels mais le bouton « Valider » accepte sans aucun upload.
   - Les fichiers `submitOnboarding` côté serveur n'exigent plus de justificatifs si la filleule a `parrainee_par` non null.
   - Le `validation_status` initial reste `en_attente` (la transition vers `valide` se fait au paiement, AC8).

8. **AC8 — Injection du code dans `createCheckoutSession`**
   Quand `createCheckoutSession` est appelée par une accompagnante avec `parrainee_par IS NOT NULL` :
   - Récupération du code parrainage actif (depuis `parrainages` `WHERE filleule_id = user.id AND statut = 'inscrite'` ; on prend le plus récent si plusieurs).
   - Si trouvé, ajout de `parrainage_code: <code>` dans `sessionParams.metadata`.
   - Le reste du flow Stripe est inchangé (pas de modification du webhook ni du calcul de prix dans cette story).

9. **AC9 — Transition automatique en `valide` (validation_source='parrainage') au retour Stripe**
   La page de succès `/accompagnante/abonnement/success` (ou un endpoint server-side appelé depuis cette page) lit le `session_id` Stripe, vérifie que la session contient `metadata.parrainage_code`, et si oui :
   - Met à jour `accompagnantes_profiles.validation_status = 'valide'`, `validation_source = 'parrainage'`, `validation_date = NOW()`, `validated_by = NULL` pour cette filleule.
   - Met à jour la ligne `parrainages` correspondante : `statut = 'abonnee'`, `filleule_abonnee_at = NOW()`.
   - Génère immédiatement le code parrainage de la filleule (la filleule devient marraine à son tour, AC2 réutilisé) et envoie l'email `sendParrainageBienvenueMarraine`.
   - Envoie l'email `sendParrainageFilleuleConfirmation` à la filleule (« Votre profil est validé, bienvenue ! »).
   - Logge `admin_actions_log` avec `action_type = 'validation_par_parrainage'`, `admin_id = NULL`, `target_type = 'accompagnante'`, `target_id = <profile_id>`, `details = { parrainage_id, marraine_id }`.
   - Idempotence : si la ligne `parrainages` est déjà en `abonnee`, ne rien refaire.

10. **AC10 — RLS et sécurité**
    - Une marraine peut lire SES lignes dans `parrainages_codes` et `parrainages` mais pas celles des autres.
    - Une filleule **ne peut PAS** lire la ligne `parrainages` qui la concerne (politique : lecture côté marraine et admin uniquement). La filleule peut lire son propre `users.parrainee_par`.
    - L'admin a accès complet aux deux tables.
    - Aucune écriture directe par les utilisateurs : toutes les insertions/updates passent par les server actions ou le service role.

## Tasks / Subtasks

- [x] **Task 1 — Migration SQL parrainage (AC: 1)**
  - [x] Créer `supabase/migrations/20260428130104_add_parrainage_feature.sql` selon §4.5 du SCP.
  - [x] Appliquer via le MCP Supabase (directement sur le projet existant — pas de branche dev, choix utilisateur).
  - [x] Migration additive `20260428130322_admin_actions_log_allow_null_admin.sql` ajoutée pour permettre `admin_id NULL` (action systeme `validation_par_parrainage`).
  - [x] Vérifié : 2 tables créées (parrainages 13 colonnes, parrainages_codes 6), 2 colonnes ajoutées, 4 RLS policies actives.

- [x] **Task 2 — Helper `generateCode` + `app/actions/parrainage.ts` initial (AC: 2, 4, 6)**
  - [x] Créé `app/actions/parrainage.ts` avec `generateCode`, `normalizeCode`, `generateCodeForUser`, `validateCode`, `createParrainageRelation`, `confirmParrainageOnSuccess`.
  - [x] Tests des fonctions pures via `scripts/test-parrainage.ts` : 6/6 PASS (alphabet, normalisation, longueur).

- [x] **Task 3 — Hook dans `validateAccompagnante` (AC: 2, 3)**
  - [x] Hook ajouté dans la même IIFE non-bloquante après `sendValidationResultEmail`. Génère le code et envoie l'email parrainage uniquement si `decision === 'valide'`.

- [x] **Task 4 — Emails parrainage dans `lib/emails.ts` (AC: 3, 9)**
  - [x] `sendParrainageBienvenueMarraine` ajoutée (type log `parrainage_bienvenue`).
  - [x] `sendParrainageFilleuleConfirmation` ajoutée (type log `parrainage_filleule_confirm`).
  - [x] HTML cohérent avec les autres emails (pas d'emojis, charset, design noir/blanc).

- [x] **Task 5 — Champ code de parrainage dans `RegisterForm` (AC: 5, 6)**
  - [x] Step `parrainage` ajouté entre `name` et `email`, **uniquement si role === 'accompagnante'** (steps dynamiques selon le rôle).
  - [x] Pré-remplissage depuis `searchParams.get('parrainage_code')`.
  - [x] Validation live au `onBlur` via `validateCode` avec feedback visuel (valide / messages d'erreur précis).
  - [x] Boutons « Continuer » / « Continuer sans code ».
  - [x] Récupération IP via `headers()` + `x-forwarded-for` / `x-real-ip` dans `signup`.
  - [x] Code invalide silencieux côté UX.

- [x] **Task 6 — Bypass OCR + visio dans onboarding (AC: 7)**
  - [x] `app/accompagnante/onboarding/page.tsx` transformé en server component qui charge `parrainee_par` + `marraineFirstName` et délègue à `OnboardingClient`.
  - [x] Bannière dédiée affichée si `isFilleule = true`.
  - [x] `canProceed()` adapté : tous les uploads et le diplôme deviennent optionnels pour les filleules.
  - [x] `submitOnboarding` côté server : si `parrainee_par` non null, lève l'exigence `diplomes/experience/specialites`. `validation_status` reste `en_attente` (transition vers `valide` faite à l'AC9).

- [x] **Task 7 — Injection metadata dans `createCheckoutSession` (AC: 8)**
  - [x] Lecture de `users.parrainee_par`, requête `parrainages` (statut='inscrite', plus récent), injection `parrainage_code` dans `metadata`.
  - [x] Pas de modification du webhook Stripe (= Story 2.2).

- [x] **Task 8 — Validation automatique côté success page (AC: 9)**
  - [x] `confirmParrainageOnSuccess(sessionId)` créée dans `parrainage.ts` (vérification session Stripe, transition `valide` + `validation_source='parrainage'`, transition `parrainages.statut='abonnee'`, génération code filleule, envoi des 2 emails non-bloquants, log admin).
  - [x] Idempotence : si `parrainages.statut !== 'inscrite'`, retourne `alreadyDone: true`.
  - [x] Appel depuis `app/accompagnante/abonnement/success/page.tsx` (server component) avec lecture de `searchParams.session_id` et message dédié si validation par parrainage déclenchée.

- [x] **Task 9 — Tests bout en bout (AC: 1-10)**
  - [x] `npx tsc --noEmit` : 0 erreur.
  - [x] `npm run build` : succès, toutes routes générées.
  - [x] Tests fonctions pures via `scripts/test-parrainage.ts` : 6 PASS / 0 FAIL.
  - [x] Vérification SQL côté Supabase : 2 tables, 4 RLS policies, 2 colonnes, advisors sans nouveau warning.
  - [ ] Tests bout en bout via UI (browser) à effectuer en preview Vercel par l'utilisateur (compte marraine validée, partage code, inscription filleule, abonnement, vérification base) — voir TODO-LAUNCH.md.
  - Note : `npm run lint` non fonctionnel (pas de config eslint préexistante, hors scope story).

- [x] **Task 10 — Documentation et nettoyage (AC: 1-10)**
  - [x] `README.md` : `parrainages_codes` et `parrainages` ajoutées à la liste des tables (suppression de la mention "(18 tables)" et de `contrats` retirée précédemment).
  - [x] `app/politique-de-confidentialite/page.tsx` : ligne « Données de parrainage » ajoutée à la section Données collectées (code, marraine/filleule, IP).
  - [x] `TODO-LAUNCH.md` : section parrainage ajoutée (test bout en bout en preview, Stories 2.2/2.3 à venir).
  - [x] `STATUS.md` et `NEXT_STEPS.md` : non modifiés (fichiers anciens et obsolètes, refonte hors scope story).
  - [x] `npm run build` final OK.

## Dev Notes

### Source d'autorité

Le **Sprint Change Proposal du 2026-04-18** ([Source: _bmad-output/planning-artifacts/sprint-change-proposal-2026-04-18-parrainage.md]) fait foi pour cette story. Les sections clés :
- §4.1 (PRD) : nouveaux FR11quinquies, FR45-48 (la story implémente FR11quinquies + FR45 + parties de FR48 hors blacklist).
- §4.2 (Architecture) : §4.2.a tables, §4.2.b colonnes, §4.2.c RLS.
- §4.5 : migration SQL complète.
- §4.6.a, §4.6.c, §4.6.d : server actions parrainage + extension admin.ts + extension subscription.ts.
- §5 Phase 3 : périmètre exact de la Story A.

**Le SCP fait autorité ; en cas de conflit avec le PRD non encore mis à jour, suivre le SCP.** Le PRD sera mis à jour ultérieurement (hors périmètre Story 2.1).

### Stack et conventions projet

- **Next.js 16** avec App Router, React 19, TypeScript 6, ESM (`type: module`). [Source: package.json]
- **Supabase SSR** via `@/lib/supabase/server` avec deux modes : anon par défaut, service role via `createClient({ serviceRole: true })`. [Source: lib/supabase/server.ts]
- **Stripe** via `@/lib/stripe` (instance préconfigurée), API version `2026-03-25.dahlia`. [Source: lib/stripe.ts]
- **Resend** pour les emails via `@/lib/emails.ts` ; pattern obligatoire : `try { send } catch {} → logNotification`. Sender `RESEND_FROM_EMAIL`. [Source: lib/emails.ts:1-33]
- **Server actions** : `'use server'` en haut, paramètres typés explicitement, retour `{ error?, success? }` ou `Promise<void>` avec `redirect()`. [Source: app/actions/admin.ts:18-22]
- **Pas d'emojis** dans le code ni les UI (règle stricte projet). [Source: .claude/CLAUDE.md, DECISIONS.md]
- **Design noir et blanc** : pas de classes `green-*`, `blue-*`, `primary-*` non grises. Utiliser `gray-*`, `black`, `white`, `bg-accent` (déjà défini). [Source: DECISIONS.md 2026-02-11]
- **Communication français** dans tous les messages utilisateur, accents complets (`é`, `è`, `à`, etc.). [Source: _bmad/bmm/config.yaml]

### Pattern coupons Stripe (référence pour Story B uniquement, hors périmètre 2.1)

Le pattern `stripe.coupons.create({ percent_off: 100, duration: 'forever' })` existe déjà dans `app/actions/admin.ts:466`. La Story B (récompense marraine) le réutilisera avec `duration: 'repeating', duration_in_months: 6`. **Cette Story 2.1 ne touche PAS aux coupons** — elle se contente d'injecter le code dans `metadata`.

### Webhook Stripe (hors périmètre)

Le webhook `app/api/webhooks/stripe/route.ts` n'est **PAS modifié** dans cette story. La transition `parrainages.statut='abonnee'` est faite côté success page (AC9) plutôt que dans le webhook, pour réduire le couplage avec Story B. Story B prendra le relais via le webhook (capture du `stripe_fingerprint` pour la blacklist anti-fraude).

### Détection blacklist (hors périmètre)

`detectBlacklist` est listé dans le SCP §4.6.a mais **reporté à Story 2.3 (blacklist admin)**. Story 2.1 ne fait **pas** de détection anti-doublon : un même email/téléphone peut techniquement créer un parrainage. La protection viendra avec Story 2.3. **Documenter cette dette explicitement** dans Completion Notes.

### Génération du code — alphabet recommandé

Alphabet 32 chars : `ABCDEFGHJKMNPQRSTUVWXYZ23456789` (exclut `0/O/1/I/L`). 8 chars donnent 32^8 ≈ 1.1 trillion de combinaisons — collision quasi nulle pour < 1M d'utilisateurs. Retry sur UNIQUE constraint suffit.

### Format de stockage du code

Le code est stocké et affiché sans séparateur (8 chars contigus, ex `K7QM2X9P`). L'UI peut afficher un séparateur visuel (`K7QM-2X9P`) mais la valeur stockée reste de 8 caractères. La normalisation côté `validateCode` retire les tirets et espaces avant comparaison.

### Headers IP en Next.js 16 App Router

Récupération via `headers()` de `next/headers` (async dans Next 16) :
```ts
import { headers } from 'next/headers'
const h = await headers()
const ip = h.get('x-forwarded-for')?.split(',')[0]?.trim() || h.get('x-real-ip') || null
```
À utiliser dans `signup()` et passé à `createParrainageRelation`.

### Schéma actuel base de données

Tables existantes confirmées (via MCP Supabase, 2026-04-28) : `users` (320 rows), `accompagnantes_profiles` (317), `subscriptions` (303), `admin_actions_log` (39), 16 autres tables. **Aucune table `parrainages*` n'existe** : pas de risque de collision. La migration est strictement additive.

Migrations existantes (récentes) :
- `20260418145317_admin_conversations.sql`
- `20260418143627_add_visio_columns_to_accompagnantes_profiles.sql`
- `20260418143626_add_visio_validation_statuses.sql`
- `20260418135719_drop_avis_feature.sql`

Le timestamp de la nouvelle migration sera donc supérieur, par ex `20260428HHMMSS_add_parrainage_feature.sql`.

### Statuts validation accompagnante

Énumération actuelle (post-visio) : `en_attente | visio_a_planifier | visio_realisee | valide | refuse | a_completer` [Source: app/actions/admin.ts:50-58, 147-149, 269-271]. La valeur `valide` est déjà connue de l'enum, **pas besoin de migration enum** — seul `validation_source` est nouveau.

### Trigger handle_new_user

Le trigger SQL `handle_new_user` insère automatiquement une ligne dans `public.users` quand un user auth est créé [Source: app/actions/auth.ts:54]. Pas de modification requise dans cette story — la colonne `parrainee_par` étant nullable et créée par la migration, le trigger n'a pas à la connaître.

### Project Structure Notes

- Server actions : `app/actions/<domain>.ts`. Nouveau fichier `app/actions/parrainage.ts` cohérent avec la convention.
- Migrations : `supabase/migrations/<YYYYMMDDHHMMSS>_<slug>.sql`.
- Emails : tout dans `lib/emails.ts` (déjà 12 fonctions, ajouter 2 reste cohérent).
- Components UI : `components/<domain>/<component>.tsx`. Cette story ne crée **pas** de composants car le champ parrainage va dans le `RegisterForm` existant.
- Variables d'env Stripe / Supabase : déjà toutes en place (`STRIPE_SECRET_KEY`, `NEXT_PUBLIC_SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`, `RESEND_API_KEY`, `RESEND_FROM_EMAIL`, `NEXT_PUBLIC_BASE_URL`).

### Testing Standards

Le projet n'a **pas de framework de tests automatisés** (pas de Jest/Vitest/Playwright dans `package.json`). Les tests sont **manuels** :
- Smoke test après chaque AC via le UI réel (browser).
- Vérifications BDD via `mcp__supabase__execute_sql` ponctuelles.
- `npm run build` et `npm run lint` font office de gate de qualité de base.
- `npm run test:supabase` (script existant) pour vérifier la connectivité Supabase.

**Le workflow `bmad-dev-story` parle de cycle red-green-refactor avec tests** — adapter au contexte : pour les fonctions pures (`generateCode`, `normalizeCode`), créer un fichier de test ad-hoc invoquable via `tsx scripts/test-parrainage.ts` qui imprime PASS/FAIL en console. Pour le reste : tests manuels documentés dans Completion Notes.

### Dette technique reportée

| Sujet | Reporté à | Pourquoi |
|-------|-----------|----------|
| Détection blacklist (email, tel, fingerprint, IP, adresse) | Story 2.3 | Découplage UI admin nécessaire |
| Capture `stripe_fingerprint` au paiement | Story 2.2 | Logique webhook + UI compteur |
| Cron J+30 confirmation parrainages | Story 2.2 | Compteur récompense |
| Coupon Stripe 100% 6 mois | Story 2.2 | Compteur ≥ 5 |
| UI ParrainageCard dashboard | Story 2.2 | Lié au compteur récompense |
| Page `/admin/parrainages` + blacklist | Story 2.3 | Découplage clair |
| Mise à jour PRD/Architecture/UX | Tâche dédiée hors story | SCP fait foi en attendant |

### References

- [Source: _bmad-output/planning-artifacts/sprint-change-proposal-2026-04-18-parrainage.md#Section-4.1] — FR11quinquies, FR45 (périmètre Story 2.1)
- [Source: _bmad-output/planning-artifacts/sprint-change-proposal-2026-04-18-parrainage.md#Section-4.2.a] — schéma SQL des 2 tables
- [Source: _bmad-output/planning-artifacts/sprint-change-proposal-2026-04-18-parrainage.md#Section-4.2.b] — colonnes ajoutées
- [Source: _bmad-output/planning-artifacts/sprint-change-proposal-2026-04-18-parrainage.md#Section-4.2.c] — RLS policies
- [Source: _bmad-output/planning-artifacts/sprint-change-proposal-2026-04-18-parrainage.md#Section-4.5] — migration complète prête à copier
- [Source: _bmad-output/planning-artifacts/sprint-change-proposal-2026-04-18-parrainage.md#Section-4.6.a] — signatures server actions
- [Source: _bmad-output/planning-artifacts/sprint-change-proposal-2026-04-18-parrainage.md#Section-5-Phase-3] — checklist d'implémentation Story A
- [Source: app/actions/admin.ts#validateAccompagnante] — point d'extension génération code marraine (L23-122)
- [Source: app/actions/auth.ts#signup] — point d'extension création relation parrainage (L14-92)
- [Source: app/actions/subscription.ts#createCheckoutSession] — point d'injection metadata (L9-66)
- [Source: app/actions/admin.ts:466] — pattern coupon Stripe existant (référence pour Story B)
- [Source: lib/emails.ts:1-33] — pattern emails + logNotification
- [Source: lib/supabase/server.ts] — createClient avec mode serviceRole
- [Source: DECISIONS.md] — règles design noir/blanc, pas d'emojis
- [Source: .claude/CLAUDE.md] — règles projet (pas d'emojis, ESM, Supabase MCP)

## Dev Agent Record

### Agent Model Used

Claude Opus 4.7 (1M context) — `claude-opus-4-7[1m]`

### Debug Log References

- Migration appliquée via `mcp__supabase__apply_migration` directement sur le projet Supabase (pas de branche dev — choix utilisateur). Migration secondaire ajoutée pour autoriser `admin_actions_log.admin_id` NULL (action systeme `validation_par_parrainage`).
- `app/accompagnante/onboarding/page.tsx` transformé en server component → extraction de `OnboardingData` et de la logique client vers `components/accompagnante/onboarding-client.tsx`. 4 imports mis à jour dans `step-*.tsx`.
- `lint` non fonctionnel (pas de config ESLint préexistante) — non bloquant.
- `confirmParrainageOnSuccess` appelée côté server component success ; idempotente (court-circuit si `statut !== 'inscrite'`).
- Détection blacklist non implémentée (reportée explicitement à Story 2.3 par le SCP §4.6.a — voir Dev Notes / Dette technique reportée).

### Completion Notes List

**Périmètre livré** (10/10 ACs) :
1. Migration SQL additive appliquée et vérifiée (2 tables, 2 colonnes, 4 indexes, 4 RLS policies).
2. Code 8 caractères généré pour la marraine à la transition `visio_realisee → valide`. Idempotent. Alphabet 32 chars sans 0/O/1/I/L.
3. Email `sendParrainageBienvenueMarraine` envoyé non-bloquant à la génération + logué.
4. `validateCode` retourne `{ valid, marraineId, marraineFirstName }` ou `{ valid: false, reason }` (3 raisons typées).
5. Step parrainage dans `RegisterForm` (accompagnante uniquement), validation live, pré-remplissage URL.
6. `signup` crée la relation `parrainages` + met à jour `users.parrainee_par`. IP capturée via headers Next.js 16 (async).
7. Onboarding allégé pour les filleules : bannière marraine + uploads optionnels (UI + serveur).
8. `parrainage_code` injecté dans `Stripe.metadata` lors de la création de la session.
9. `confirmParrainageOnSuccess` : transition automatique vers `valide` (validation_source='parrainage'), `parrainages.statut='abonnee'`, génération code filleule, 2 emails non-bloquants, log admin.
10. RLS : marraine lit ses propres lignes, filleule ne peut pas lire `parrainages` (policy seulement marraine + admin).

**Dette technique connue (reportée explicitement par le SCP)** :
- Détection blacklist (email/téléphone/carte/IP/adresse) → Story 2.3.
- Capture `stripe_fingerprint` au paiement → Story 2.2 (webhook).
- Cron J+30 + compteur récompense + coupon 6 mois → Story 2.2.
- UI ParrainageCard dashboard → Story 2.2.
- Page admin `/admin/parrainages` → Story 2.3.
- Mise à jour PRD/Architecture/UX → tâche dédiée hors story.

**Validation effectuée** :
- `npx tsc --noEmit` : 0 erreur.
- `npm run build` : succès, 40 routes générées.
- Tests fonctions pures (`scripts/test-parrainage.ts`) : 6/6 PASS.
- Vérification SQL : tables/colonnes/policies présentes, advisors propres pour cette migration.

**Tests UI bout en bout à exécuter par l'utilisateur** (référence TODO-LAUNCH.md) :
- Valider une marraine via /admin → vérifier code généré + email reçu.
- Inscription filleule avec code → onboarding allégé → souscription Stripe (mode test) → success page → vérifier `validation_status=valide`, `validation_source=parrainage`, ligne `parrainages.statut=abonnee`, code filleule généré, email reçu.
- Test code invalide → message d'erreur clair.
- Test sans code → flow normal (visio obligatoire, comportement préexistant inchangé).
- Test RLS : connecté en tant que filleule, `SELECT * FROM parrainages` doit retourner 0 ligne (côté serveur public).

### File List

**Migrations SQL (2 nouveaux fichiers)** :
- `supabase/migrations/20260428130104_add_parrainage_feature.sql`
- `supabase/migrations/20260428130322_admin_actions_log_allow_null_admin.sql`

**Server actions (1 nouveau, 3 modifiés)** :
- `app/actions/parrainage.ts` (nouveau)
- `app/actions/admin.ts` (hook generateCodeForUser + envoi email à la validation)
- `app/actions/auth.ts` (lecture parrainage_code dans signup, capture IP, appel createParrainageRelation)
- `app/actions/subscription.ts` (injection parrainage_code dans metadata Stripe)
- `app/actions/accompagnante.ts` (workaround filleule sur submitOnboarding)

**Pages (2 modifiées)** :
- `app/accompagnante/onboarding/page.tsx` (server component qui charge le contexte parrainage)
- `app/accompagnante/abonnement/success/page.tsx` (appel confirmParrainageOnSuccess + message dédié)

**Composants (1 nouveau, 1 modifié)** :
- `components/accompagnante/onboarding-client.tsx` (nouveau client component, extrait + bannière + uploads optionnels filleule)
- `components/auth/register-form.tsx` (step parrainage accompagnante, steps dynamiques selon rôle, validation live)

**Imports redirigés (4 fichiers)** :
- `components/accompagnante/step-diplome.tsx`
- `components/accompagnante/step-disponibilites.tsx`
- `components/accompagnante/step-localisation.tsx`
- `components/accompagnante/step-specialites.tsx`

**Emails (1 fichier modifié)** :
- `lib/emails.ts` (sendParrainageBienvenueMarraine + sendParrainageFilleuleConfirmation)

**Documentation (3 fichiers modifiés)** :
- `README.md` (liste des tables)
- `app/politique-de-confidentialite/page.tsx` (mention parrainage RGPD)
- `TODO-LAUNCH.md` (test parrainage, Stories 2.2/2.3)

**Scripts (1 nouveau)** :
- `scripts/test-parrainage.ts` (tests fonctions pures generateCode/normalizeCode)

### Review Findings

#### Decisions résolues (2026-04-28)

- [x] [Review][Decision] Trial Stripe : **résolu (a)** — valider à la souscription, trial OK. Statu quo du code actuel.
- [x] [Review][Decision] Rate-limit `validateCode` : **résolu (a)** — pas de rate-limit MVP. Dette → Story 2.3 (blacklist + rate-limit cohérents).
- [x] [Review][Decision] `target_id` log admin si profil absent : **résolu (a)** — refuser le log ET la validation. Devient un patch (cf. ci-dessous).
- [x] [Review][Decision] UX onboarding filleule : **résolu (a)** — laisser barre "X sur 4" + bannière (statu quo).
- [x] [Review][Decision] `step_localisation` : **résolu (a)** — ville+code_postal restent obligatoires pour la filleule (statu quo).
- [x] [Review][Decision] Oracle énumération `validateCode` : **résolu (a)** — garder différenciation `unknown_code` / `marraine_not_validated` pour UX.

#### Patch (fixable sans input utilisateur)

- [x] [Review][Patch] **CRITIQUE** `validateCode` lit `parrainages_codes` avec client anon mais RLS exige `auth.uid() = user_id` → AC4/AC5 cassés en production (tous les codes apparaissent `unknown_code`). [app/actions/parrainage.ts:86-92] — passer en `serviceRole: true`.
- [x] [Review][Patch] **CRITIQUE** `createCheckoutSession` lit `parrainages` avec client anon mais RLS interdit à la filleule (`auth.uid() = marraine_id`) → AC8/AC9 inopérants (metadata `parrainage_code` jamais injectée). [app/actions/subscription.ts:52-58] — service role pour cette lecture.
- [x] [Review][Patch] **CRITIQUE** Auto-parrainage non bloqué : `marraine_id === filleule_id` accepté. [app/actions/parrainage.ts:135-198] — ajouter check explicite avant `INSERT`.
- [x] [Review][Patch] `confirmParrainageOnSuccess` : vérification `sessionUserId` bypass-able si vide. [app/actions/parrainage.ts:233-236] — passer à `if (sessionUserId !== user.id)` strict.
- [x] [Review][Patch] `Math.random()` non cryptographique pour le code de parrainage (jeton d'auto-validation). [app/actions/parrainage.ts:14-20] — utiliser `crypto.randomInt` (node:crypto).
- [x] [Review][Patch] Email + génération de code marraine dans IIFE catch-tout : si `sendValidationResultEmail` jette, le code n'est pas généré. AC2/AC3 cassés silencieusement. [app/actions/admin.ts ~98-138] — séparer en 2 IIFE indépendantes (pattern AC3 explicite).
- [x] [Review][Patch] Marraine déchue (`refuse`) après inscription mais avant paiement : filleule validée quand même. [app/actions/parrainage.ts:204-345] — re-vérifier `marraine.validation_status === 'valide'` au moment de `confirmParrainageOnSuccess`.
- [x] [Review][Patch] Idempotence partielle : 4 updates non transactionnels, refresh = doubles emails/logs. [app/actions/parrainage.ts:259-345] — passer `UPDATE parrainages SET statut='abonnee' WHERE id=? AND statut='inscrite'` EN PREMIER avec check `count=1`, abandonner si 0.
- [x] [Review][Patch] Migration `users.parrainee_par` sans `ON DELETE SET NULL` → suppression marraine bloquée par FK. [supabase/migrations/20260428130104_add_parrainage_feature.sql:43-45] — migration corrective additive.
- [x] [Review][Patch] Signature `createParrainageRelation` omet `filleuleEmail/Telephone/Adresse` requis par SCP §4.6.a pour Story 2.3. [app/actions/parrainage.ts:135-139] — ajouter en optionnel dès maintenant.
- [x] [Review][Patch] Accents manquants dans emails et messages : `Felicitations`, `validee`, `Acceder`, `Erreur lors de la creation`, `Impossible de generer`, `associee`, `marche`, `automatiquement des qu'elle`. [lib/emails.ts:528-624 ; app/actions/parrainage.ts:65,69 ; components/auth/register-form.tsx:265,295] — règle stricte projet (CLAUDE.md).
- [x] [Review][Patch] `signup` ignore le retour `ok=false` de `createParrainageRelation` sans log : perte de signal opérationnel. [app/actions/auth.ts:88-104] — `console.error` + alerte si `ok=false`.
- [x] [Review][Patch] `submitOnboarding` lit `parrainee_par` avec client anon (RLS dépendant) → bypass cassé serveur si la policy `users` n'autorise pas la lecture de la colonne. [app/actions/accompagnante.ts:43-48] — service role pour la cohérence avec `onboarding/page.tsx`.
- [x] [Review][Patch] Commentaire alphabet "32 chars sans 0/O/1/I/L" mais en compte 31. [app/actions/parrainage.ts:10-11] — corriger commentaire.
- [x] [Review][Patch] `validateCode` ne distingue pas longueur < 8 → renvoie `unknown_code` au lieu de `invalid_format`. [app/actions/parrainage.ts:79-83] — ajouter `if (code.length !== CODE_LENGTH) return { reason: 'invalid_format' }`.
- [x] [Review][Patch] `normalizeCode` tronque silencieusement à 8 caractères : 10 caractères collés produisent un code différent. [app/actions/parrainage.ts:22-27] — détecter longueur > 8 et renvoyer `invalid_format` plutôt que tronquer.
- [x] [Review][Patch] IIFE `void (async)` sans `waitUntil` sur Vercel : emails potentiellement perdus si la fonction termine. [app/actions/parrainage.ts:307-330] — utiliser `after()` de Next 16.
- [x] [Review][Patch] Pas de `useEffect` pour valider le code pré-rempli depuis URL — pas de feedback live au mount. [components/auth/register-form.tsx:65-66] — déclencher `checkParrainageCode` au mount si `initialParrainageCode`.
- [x] [Review][Patch] Bouton "Continuer" parrainage actif pendant `checking` : race au clic rapide. [components/auth/register-form.tsx:294-303] — désactiver tant que `checking`.
- [x] [Review][Patch] Caractères hors alphabet (`0`, `O`, `L`, etc.) renvoient `unknown_code` au lieu d'un message ciblé. [app/actions/parrainage.ts:79-95] — ajouter check regex et `reason: 'invalid_chars'`.
- [x] [Review][Patch] `marraineFirstName === ''` produit un email mal formé (`Grâce au parrainage de ,`). [lib/emails.ts:589-624] — fallback "votre marraine".
- [x] [Review][Patch] `RegisterForm` ne reset pas `parrainageCode` au changement de rôle : état résiduel. [components/auth/register-form.tsx:73-77] — reset dans `selectRole`.
- [x] [Review][Patch] `generateCodeForUser` exposée publiquement sans check d'authz : peut être appelée avec userId arbitraire pour polluer `parrainages_codes`. [app/actions/parrainage.ts:31] — vérifier que `auth.uid() === userId` ou `role === 'admin'`.
- [x] [Review][Patch] (issu décision 3a) Refuser la validation et le log admin si `filleuleProfile` est absent. [app/actions/parrainage.ts:262-345] — short-circuit `return { ok: false, reason: 'profile_not_found' }` avant les updates et le log.

#### Defer (préexistant ou explicitement reporté)

- [x] [Review][Defer] Quota marraine illimité (parrainages × N) [app/actions/parrainage.ts] — reporté Story 2.2 (compteur récompense + plafond), pas urgent
- [x] [Review][Defer] Pas de contrainte CHECK sur format code en DB [migration:9-16] — robustesse, pas de bug actuel
- [x] [Review][Defer] Asymétrie FK marraine CASCADE vs filleule SET NULL : filleule en limbo si marraine supprimée entre paiement et validation [migration:23-25] — rare, à doc Story 2.3
- [x] [Review][Defer] `admin_actions_log.admin_id NULL` sans CHECK contraignant — accepté pour MVP, à doc
- [x] [Review][Defer] Pas de fallback webhook si filleule ne revient pas sur /success [parrainage.ts:204-345] — reporté Story 2.2 explicitement, mais à mentionner dans TODO-LAUNCH
- [x] [Review][Defer] `x-forwarded-for` non sanitizé — Vercel sanitize en prod, à doc Story 2.3
- [x] [Review][Defer] Step parrainage non visité si email pré-rempli via URL [register-form.tsx:73-77] — UX rare
- [x] [Review][Defer] Race au signup rapide : 2 inscriptions avec même code, pas de UNIQUE `(filleule_id)` sur `parrainages` — Story 2.3 blacklist
- [x] [Review][Defer] `users.single()` dans onboarding peut crash si trigger `handle_new_user` lent [onboarding/page.tsx:173-189] — handle_new_user est synchrone Postgres, pas reproductible

## Change Log

| Date | Auteur | Changement |
|------|--------|-----------|
| 2026-04-28 | Claude (Sonnet via bmad-create-story) | Création initiale de la story sur la base du SCP 2026-04-18 parrainage |
| 2026-04-28 | Claude Opus 4.7 (1M) via bmad-dev-story | Implémentation complète Story 2.1. 10/10 tâches terminées, 10/10 ACs satisfaits. Build vert. Statut → review. |
| 2026-04-28 | Claude Opus 4.7 (1M) via bmad-code-review | Revue de code adversariale (3 layers). 6 décisions, 24 patches, 9 défers, 9 dismiss. 2 bugs CRITIQUES bloquant la feature en prod (RLS anon sur `parrainages_codes` + `parrainages`). |
| 2026-04-28 | Claude Opus 4.7 (1M) via bmad-code-review | Batch-apply : 24/24 patches appliqués. Migration corrective `20260428153210_parrainee_par_on_delete_set_null` appliquée et vérifiée (`delete_rule = SET NULL`). Build vert, tsc 0 erreur, 9/9 tests pure-functions PASS. Statut → in-progress (tests preview Vercel à exécuter). |
