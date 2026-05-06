# Story 3.5 : Notification automatique waitlist a l'ouverture departement

Status: in-progress

<!-- Note: Validation est optionnelle. Lancer `validate-create-story` avant `dev-story` pour un controle qualite. -->

## Story

En tant que **Sylvain (admin) operant l'extension geographique du service, et en tant que visiteur inscrit sur la waitlist d'un departement non encore ouvert**,
je veux **qu'au moment ou j'ouvre un nouveau departement (toggle admin sur `/admin/departements`), tous les visiteurs en `waitlist_departements` correspondants dont `notified_at IS NULL` recoivent automatiquement un email de notification d'ouverture, que chaque ligne notifiee marque son `notified_at = now()`, et que le tout soit idempotent (re-toggle off/on n'envoie pas un second email)**,
afin de **transformer l'extension geographique en conversions sans action manuelle, sans risque de double envoi, et avec un mecanisme de retry capable de rattraper un envoi Resend qui a echoue temporairement (FR46 extension)**.

Cette story est la **cinquieme story de l'Epic 3 « Lancement Bretagne »** et le **complement direct de la story 3.4** (qui livre la capture waitlist + email confirmation immediat). Elle livre le cycle complet : capture (3.4) -> ouverture admin (admin existant) -> notification automatique (cette story 3.5) -> conversion attendue.

Elle s'appuie sur les fondations deja livrees :

- **Mecanisme admin d'ouverture deja en place** : `app/admin/departements/actions.ts:toggleDepartement(code, ouvrir)` et `toggleRegion(region, ouvrir)`. Verifient `requireAdmin()`, font UPDATE sur `departements_ouverts.ouvert`, posent `ouvert_le = now()` quand `ouvrir=true`, log dans `admin_actions_log`, invalident `DEPARTEMENTS_CACHE_TAG` et `revalidatePath('/admin/departements')`. **Story 3.5 doit hooker ces deux actions** (et seulement ces deux) au moment du **passage `false -> true`** pour declencher l'envoi.
- **Table `waitlist_departements` deja livree** (story 3.4) : `id, email, code_departement (FK departements_ouverts.code CASCADE), role, ip_inscription, user_agent, created_at, notified_at`. UNIQUE INDEX `(lower(email), code_departement)`. Index secondaire `(code_departement, notified_at)` cree **explicitement pour cette story 3.5** afin de filtrer rapidement `WHERE code_departement = X AND notified_at IS NULL`. RLS `deny_all` -> tout passe par `service_role`.
- **Pattern email Resend** : `lib/emails.ts` expose deja `sendWaitlistConfirmationEmail` (story 3.4) avec gestion du visiteur anonyme (`canLog = Boolean(userId)`, skip `logNotification` si `userId` undefined, status `'failed'` au lieu de `'error'`). **Story 3.5 doit reproduire strictement ce pattern** pour la nouvelle fonction `sendWaitlistOpeningNotificationEmail`. Voir `lib/emails.ts:861-915`.
- **Pattern cron secondaire de retry** : `app/api/cron/confirm-parrainages/route.ts` (le plus mature du projet). Auth `Bearer ${process.env.CRON_SECRET}`, `createClient({ serviceRole: true })`, batch `BATCH_LIMIT = 200`, compare-and-swap idempotent via `UPDATE ... WHERE statut = 'abonnee'` -> si `swapped.length === 0` -> skip, log dans `admin_actions_log` avec `admin_id = null`. Compteurs `processed / sent / skipped / errors` retournes en JSON. **Story 3.5 doit cloner ce squelette** (auth + batch + compare-and-swap + log).
- **Schema `notifications_log` (BUG LATENT decouvert review 3.4)** : la colonne `user_id` est `NOT NULL FK users(id) ON DELETE CASCADE` et le CHECK `status` n'accepte que `('pending', 'sent', 'failed')` (pas `'error'`). **La story 3.4 a contourne en local** en skippant `logNotification` quand `userId` est undefined (visiteur anonyme) et en utilisant `status='failed'`. **La story 3.5 doit appliquer le meme contournement** car les destinataires waitlist sont anonymes par construction. **Ne PAS toucher au schema** (le fix transverse est report Epic 4, cf. memoire `project_logNotification_bug`).
- **Schema `admin_actions_log` (BUG LATENT decouvert pendant le cadrage 3.5)** : la colonne `target_id` est `UUID NOT NULL`. Or `app/admin/departements/actions.ts:62` insere `target_id: code` ou `code` est un TEXT (`'29'`, `'75'`, etc.). **Aucun toggle reel n'a jamais ete execute en production** (5 dpt seedes directement par migration `20260502120000`, 0 ligne dans `admin_actions_log` avec `action_type='departement_ouvert'`), donc le bug n'a jamais ete declenche. **Cette story 3.5 va exercer pour la premiere fois ce code path** (toggle reel d'un dpt hors-Bretagne) -> **le bug DOIT etre fix dans cette story** sinon le pre-requis d'envoi (l'UPDATE departements_ouverts) echoue avec une erreur Postgres `22P02 invalid input syntax for type uuid`. Decision : ajouter `target_id_text TEXT` nullable a `admin_actions_log` via migration et l'utiliser pour les `action_type IN ('departement_ouvert', 'departement_ferme', 'region_ouverte', 'region_fermee')`. Voir D1.

**Le coeur de la story** : (a) une migration `admin_actions_log` ajoute `target_id_text TEXT NULL`, (b) `lib/notify-waitlist.ts` (nouveau helper pur) expose `notifyWaitlistForCode(code: string)` qui charge les lignes `waitlist_departements` non notifiees pour ce code, envoie les emails un a un avec compare-and-swap atomique sur `notified_at`, (c) `app/admin/departements/actions.ts:toggleDepartement` et `toggleRegion` appellent `notifyWaitlistForCode` apres l'UPDATE pour chaque code passe `false -> true`, (d) un cron secondaire `app/api/cron/notify-waitlist-retry/route.ts` repasse quotidiennement sur les lignes `notified_at IS NULL` pour les codes deja `ouvert=true` (rattrapage Resend), (e) un email template `sendWaitlistOpeningNotificationEmail` dans `lib/emails.ts` (visiteur anonyme : skip `logNotification` si `userId` undefined, status `'failed'`).

## Acceptance Criteria

### AC fonctionnels (FR46 extension)

1. **AC1 - Migration `admin_actions_log` : ajout colonne `target_id_text TEXT NULL`** : Given une nouvelle migration `supabase/migrations/<timestamp>_admin_actions_log_target_id_text.sql`, when la migration s'applique, then la colonne `public.admin_actions_log.target_id_text TEXT NULL` existe (nullable, pas de CHECK, pas d'index), **And** un commentaire SQL `COMMENT ON COLUMN ... IS 'Target ID textuel pour actions ne portant pas sur un UUID (ex : code_departement). Mutex avec target_id : exactement un des deux doit etre renseigne.'` est pose, **And** la migration est idempotente (`ADD COLUMN IF NOT EXISTS`). **And** un check applicatif (commente, **non force au niveau BDD** car les lignes existantes ont `target_id NOT NULL`) documente l'intent dans le COMMENT.

2. **AC2 - Refactor `app/admin/departements/actions.ts`** : Given le bug latent identifie en pre-cadrage (target_id UUID NOT NULL recoit un TEXT code dpt), when la story est livree, then les 2 INSERT dans `admin_actions_log` (`toggleDepartement` ligne 62 et `toggleRegion` ligne 96) basculent `target_id` -> `target_id_text` pour le code/region, et passent `target_id: null`. **Important** : la signature de `admin_actions_log` reste UUID NOT NULL pour les autres callers (cf. cron `confirm-parrainages` qui pose un UUID utilisateur valide). C'est uniquement le call site dpt qui change. **AC2 valide si** : un toggle reel sur `/admin/departements` (UI manuelle) reussit sans erreur Postgres, et la ligne `admin_actions_log` est lisible avec `target_id IS NULL AND target_id_text = '29'`.

3. **AC3 - Helper `lib/notify-waitlist.ts:notifyWaitlistForCode(code)`** : Given le helper est invoque avec un code departement valide (existant dans `departements_ouverts`), when la fonction s'execute en serveur (Server Action ou route cron), then :
   - Charge le `nom` du departement depuis `departements_ouverts` (via `supabase.from('departements_ouverts').select('nom').eq('code', code).single()`).
   - Charge **toutes** les lignes `waitlist_departements` avec `code_departement = code AND notified_at IS NULL` (`.select('id, email').limit(500)` cap defensif anti-runaway).
   - Pour chaque ligne, **dans l'ordre** :
     - **Compare-and-swap atomique** : `UPDATE waitlist_departements SET notified_at = now() WHERE id = row.id AND notified_at IS NULL RETURNING id`. Si `data.length === 0` -> skip silencieux (concurrence cron + admin trigger : la ligne a deja ete prise en charge par l'autre run).
     - **Si swap reussi** : `await sendWaitlistOpeningNotificationEmail({ email, codeDepartement: code, nomDepartement: nom })`. **L'erreur Resend est capturee dans la fonction email** (try/catch interne, comme `sendWaitlistConfirmationEmail`). Pas d'erreur remonte ici.
   - Retourne un objet `{ processed: number, sent: number, skipped: number, errors: number }`.
   - Logge `console.info('[notify-waitlist] code=29 sent=12 skipped=0 errors=0')` pour observabilite Vercel.

4. **AC4 - Hook depuis `toggleDepartement`** : Given un admin clique « Ouvrir » sur un departement actuellement ferme dans `/admin/departements`, when `toggleDepartement(code, true)` est invoque, then **apres l'UPDATE reussi** et **avant** `invalidate()`, l'action :
   - Detecte le passage `false -> true` (le code etait `ouvert=false` avant, `ouvert=true` apres). Pour ce faire, l'UPDATE est etendu via `.select('code, ouvert')` ou un SELECT pre-update est ajoute. **Decision (D2)** : SELECT pre-update sur la ligne (`SELECT ouvert FROM departements_ouverts WHERE code = code FOR UPDATE`) — eviter une race condition (admin double-click) et n'envoyer qu'une seule fois.
   - **Si transition `false -> true`** : `await notifyWaitlistForCode(code)` est invoque **dans la meme requete server action** (synchrone, pas de fire-and-forget). L'email peut prendre ~200-500ms par destinataire * N lignes — cap N defensif via `BATCH_LIMIT = 200` dans `notifyWaitlistForCode`. **Si N > 200**, le surplus est ramasse au prochain cron retry (story acceptable pour MVP, N attendu = 0-50 par dpt en pilote).
   - **Si transition `true -> true` (re-toggle redondant)** : pas d'invocation `notifyWaitlistForCode` (idempotence : pas de second email).
   - **Si transition `* -> false` (fermeture)** : pas d'invocation `notifyWaitlistForCode`. Les lignes `notified_at NOT NULL` restent inchangees. Si le dpt est re-ouvert plus tard, **seules les nouvelles inscriptions** (`notified_at IS NULL` posterieures) sont notifiees — pattern idempotent on `notified_at`.
   - **Si l'envoi des emails echoue (network, Resend down, etc.)** : l'UPDATE `departements_ouverts` est **conserve** (le dpt est ouvert), `admin_actions_log` est ecrit, `invalidate()` est appele. **Le retour client `{ success: true }` est preserve**. Le cron secondaire (AC6) rattrape les lignes `notified_at IS NULL` au prochain passage.

5. **AC5 - Hook depuis `toggleRegion`** : Given un admin clique « Ouvrir toute la region X » dans `/admin/departements`, when `toggleRegion(region, true)` est invoque, then :
   - Le SELECT pre-update existant (`.select('code')` sur l'UPDATE) est complete pour recuperer aussi l'etat avant : decision (D3) -> faire un SELECT pre-update `SELECT code, ouvert FROM departements_ouverts WHERE region = region` puis UPDATE, puis identifier la liste des codes qui ont fait `false -> true`.
   - Pour **chaque code** ayant fait la transition `false -> true`, `notifyWaitlistForCode(code)` est invoque **sequentiellement** (pas de Promise.all : on protege Resend d'un burst). Sequentiellement = `for (const c of codesQuiOntChange) await notifyWaitlistForCode(c)`. Acceptable pour un toggle region en zone Bretagne (5 dpt max) ; pour une region a 13 dpt (ex : Auvergne-Rhone-Alpes) avec 50 inscrits/dpt, le worst case serait ~13 * 50 * 300ms = ~3min. **Mitigation** : le timeout server action Next 16 est 60s par defaut sur Vercel. Cas degrade : si le batch depasse, le cron retry rattrape. Documente en R2.
   - **Si la transition est `* -> false` (fermeture region)** : pas d'invocation. Comme AC4.

6. **AC6 - Cron secondaire `app/api/cron/notify-waitlist-retry/route.ts`** : Given un cron Vercel quotidien (`schedule: '0 5 * * *'`, recommandation : 5h du matin entre `reactivate-disponible` (6h) et `confirm-parrainages` (2h)), when le cron est invoque, then :
   - Auth via `Bearer ${process.env.CRON_SECRET}` (pattern strict identique aux 5 cron existants). Reponse 401 si auth fail.
   - `createClient({ serviceRole: true })`.
   - SELECT toutes les lignes `waitlist_departements` JOIN `departements_ouverts` ou `departements_ouverts.ouvert = true AND waitlist_departements.notified_at IS NULL`. Cap `BATCH_LIMIT = 200` defensif.
   - Pour chaque ligne, meme pattern que `notifyWaitlistForCode` : compare-and-swap UPDATE + envoi email.
   - Retourne `{ processed, sent, skipped, errors }` JSON. Log `console.info('[cron_notify_waitlist_retry] processed=X sent=Y skipped=Z errors=W')`.
   - **Idempotence garantie par le compare-and-swap** : meme si le cron tourne 24x par jour ou qu'admin trigger + cron se croisent, une ligne ne peut etre notifiee qu'une fois.

7. **AC7 - Email `sendWaitlistOpeningNotificationEmail`** : Given une ligne waitlist swappee, when `sendWaitlistOpeningNotificationEmail({ email, codeDepartement, nomDepartement })` est invoque, then un email est envoye via Resend au format suivant :
   - **From** : `RESEND_FROM_EMAIL` (env var, default `roxanetnous <onboarding@resend.dev>`).
   - **To** : email saisi.
   - **Subject** : `Le service est ouvert dans ${nomDepartement}`.
   - **Body HTML** : pattern `lib/emails.ts` (`<div style="font-family: sans-serif; max-width: 600px; margin: 0 auto;">`), `<h1>Bonne nouvelle</h1>`, paragraphe « Bonjour, le service roxanetnous est desormais ouvert dans le departement {nomDepartement} ({codeDepartement}). Vous pouvez des maintenant explorer les profils disponibles dans votre zone. », CTA primaire `<a href="${BASE_URL}/recherche?code_departement={codeDepartement}">Decouvrir roxanetnous dans {nomDepartement}</a>`.
   - **Toutes** les variables utilisateur (`nomDepartement`, `codeDepartement`) passees a `escapeHtml(...)` (XSS prevention, pattern `lib/emails.ts:11`).
   - **Logging** : pattern visiteur anonyme `sendWaitlistConfirmationEmail` (story 3.4) -> `canLog = Boolean(params.userId)`, **skip `logNotification` si `userId` undefined** (le destinataire waitlist n'est pas dans `users` table), status `'failed'` (pas `'error'`) sur catch. Si Resend echoue ET `userId` undefined : `console.error('[notify-waitlist][email_send_error]', error)` (visibilite Vercel logs).

8. **AC8 - Idempotence stricte** : Given un meme cycle d'admin actions (open dpt 75 -> notify -> close dpt 75 -> open dpt 75 a nouveau), when la sequence se deroule, then :
   - Au **premier open** : toutes les lignes `code_departement='75' AND notified_at IS NULL` sont notifiees, `notified_at` passe a `now()`.
   - Au **close** : aucune action sur `waitlist_departements`. Les lignes `notified_at NOT NULL` restent.
   - Au **second open** : `notifyWaitlistForCode('75')` filtre a nouveau `WHERE code_departement = '75' AND notified_at IS NULL`. **Seules les nouvelles inscriptions** (visiteurs qui se sont inscrits entre close et re-open) sont notifiees. Les anciennes (`notified_at NOT NULL`) ne sont pas re-notifiees.
   - **Verification SQL post-cycle** : `SELECT count(*) FROM waitlist_departements WHERE code_departement='75' AND notified_at IS NOT NULL` doit etre stable entre close et re-open (aucune nouvelle notification cumulative pour les anciens inscrits).

9. **AC9 - Cas degrade : ligne `waitlist_departements` orpheline post-CASCADE** : Given un admin supprime un departement (DELETE FROM `departements_ouverts` WHERE code = X — operation rare, hors UI, via SQL ad-hoc), when la FK CASCADE de `waitlist_departements` purge les lignes correspondantes, then `notifyWaitlistForCode(X)` (si invoque par erreur sur un code purge) :
   - SELECT `nom` echoue avec `null` -> retourne sans envoi (early return), log `console.warn('[notify-waitlist] code dpt inconnu', code)`. **Pas de crash, pas d'envoi a vide.**
   - Le cron retry filtre par JOIN `departements_ouverts.ouvert = true` -> les codes inconnus sont d'office hors scope.

10. **AC10 - Cas degrade : Resend down ou erreur reseau pendant la boucle** : Given Resend retourne une erreur 5xx ou timeout sur un email au milieu de la boucle, when l'erreur est levee, then :
   - Le compare-and-swap a deja swappe `notified_at = now()` AVANT l'envoi -> la ligne est marquee notifiee meme si l'email a fail. **Decision (D5)** : on accepte ce risque (le destinataire ne recoit pas son email mais sa ligne est marquee). **Justification** : le pattern inverse (swap apres envoi) ouvre une fenetre de double-envoi en cas de double execution cron+admin. **Mitigation** : surveillance via `console.error` Vercel logs + re-envoi manuel si signal en prod.
   - Alternative consideree mais rejetee (D5b) : transactions Postgres pour rollback du swap si email fail. Trop lourd pour MVP, asynchronicite Resend rend la transaction non triviale (commit applicatif != commit reseau).

11. **AC11 - Cas degrade : email destinataire invalide (compte resilie, mailbox full)** : Given Resend retourne `400 invalid recipient` ou similaire pour une adresse invalide, when l'erreur est captee dans `sendWaitlistOpeningNotificationEmail`, then `console.error` est emis (visibilite Vercel) et la ligne reste `notified_at NOT NULL` (cf. D5 — assume qu'on n'essaie pas a l'infini). Risque residuel R3 : ces lignes ne seront jamais notifiees a nouveau. **Mitigation** : SQL admin manuel (`UPDATE waitlist_departements SET notified_at = NULL WHERE id = X` puis re-trigger) si signal observe en prod.

### AC techniques (qualite)

12. **AC12 - Reuse strict des helpers existants** : Given les helpers et patterns deja en place, when le code est ecrit, then **aucune** nouvelle fonction utilitaire transversale creee. Reuse :
    - `lib/departements.ts` : pas de modification (le helper `getAllDepartements` n'est pas utilise dans cette story — on requete directement `departements_ouverts.nom` par code precis). **Aucun rafraichissement du cache requis** (les lignes `waitlist_departements` ne dependent pas du cache departements).
    - `lib/emails.ts` : pattern strict `sendWaitlistConfirmationEmail` (visiteur anonyme) -> ajouter `sendWaitlistOpeningNotificationEmail` qui clone le squelette avec `canLog = Boolean(params.userId)` + skip `logNotification` si undefined + status `'failed'` sur catch.
    - `app/api/cron/confirm-parrainages/route.ts` : pattern auth + batch + compare-and-swap a cloner pour `app/api/cron/notify-waitlist-retry/route.ts`.
    - `app/admin/departements/actions.ts` : modifier minimalement (hook avant `invalidate()`).
    - `vercel.json` : ajouter le 6e cron entry.

13. **AC13 - Pas de regression typage `as any`** : Given la regle CLAUDE.md « interdire `as any` introduit, resorber au passage », when le code est ecrit, then **aucun nouveau `as any` introduit**. Le retour de `notifyWaitlistForCode` est type `{ processed: number; sent: number; skipped: number; errors: number }`. La ligne `waitlist_departements` est typee inline ou via type Supabase generated. Le cron retourne `NextResponse.json(...)` typed.

14. **AC14 - Pas de regression a11y** : Given la regle CLAUDE.md durcie Lot C, when la story est livree, then :
    - **Aucun changement UI** dans cette story (toggle admin existe deja, pas de nouvel ecran, pas de nouveau composant client). **DoD a11y N/A** (story BDD + cron + email + server action — pas d'impact UI direct). **Verification statique** : `git diff --stat` ne doit toucher AUCUN fichier `.tsx` cote `components/` ou `app/[non-admin]/page.tsx`.
    - `npm run lint:a11y-check` reste vert (baseline 155 stables — aucun changement attendu).
    - `npm run a11y:axe:check` reste vert (0 violations Critical/Serious sur 7 parcours — aucune route touchee dans les parcours).
    - **Pre-condition de commit livraison** : `npm run a11y:axe:check` execute localement, exit 0 confirme (regle CLAUDE.md).

15. **AC15 - Pas de regression sur les autres routes** : Given l'ajout de la migration `admin_actions_log_target_id_text`, du helper `lib/notify-waitlist.ts`, du cron `app/api/cron/notify-waitlist-retry/route.ts`, de l'email template `sendWaitlistOpeningNotificationEmail`, de la modification de `app/admin/departements/actions.ts` et `vercel.json`, when le diff est livre, then :
    - **Aucune modification** de `app/page.tsx`, `app/recherche/page.tsx`, `app/waitlist/page.tsx`, ni d'aucune route publique.
    - **Aucune modification** de `lib/departements.ts` (helper existant suffisant).
    - **Aucune modification** de `lib/supabase/*`, `lib/auth/*`.
    - **Aucune modification** des autres callers de `admin_actions_log.target_id` (cron `confirm-parrainages` continue d'inserer un UUID utilisateur dans `target_id`, comportement inchange).
    - **Aucune modification** des autres crons existants (`update-badges`, `reactivate-disponible`, `expiration-reminder`, `confirm-parrainages`, `sweep-stripe-events`).
    - Verification grep `git diff --stat` : strictement 5 fichiers ajoutes (migration + helper + cron + email extension `lib/emails.ts` + entree vercel.json) + 1 fichier modifie (`app/admin/departements/actions.ts`). **Total ~6 fichiers, ~250 lignes ajoutees.**

16. **AC16 - Verification manuelle documentee** : Given la dette tests reportee Epic 4, when la story est livree, then la PR contient une section « Verifications manuelles » listant :
    - (a) Pre-prod : Insert manuel SQL de 3 lignes test waitlist sur dpt 75 (`INSERT INTO waitlist_departements(email, code_departement, role) VALUES ('test1@example.com', '75', 'visiteur'), ('test2@example.com', '75', 'accompagne'), ('test3@example.com', '75', NULL)`). Verifier `SELECT count(*) WHERE code_departement='75' AND notified_at IS NULL` = 3.
    - (b) Toggle dpt 75 a `ouvert=true` via UI admin `/admin/departements`. Mesurer le delai de retour (~500ms-2s pour 3 emails). Verifier `notified_at NOT NULL` pour les 3 lignes via SQL. Verifier reception email Resend (boite test ou logs Resend dashboard).
    - (c) Re-toggle dpt 75 `true -> false` puis `false -> true`. Verifier `notified_at` reste stable pour les 3 lignes (idempotence). **Ajouter une 4e ligne** entre les 2 toggles : verifier qu'au second `true` seule la 4e est notifiee (`SELECT email, notified_at FROM waitlist_departements WHERE code_departement='75' ORDER BY created_at`).
    - (d) Toggle dpt 75 `true -> true` (no-op redondant) — pas attendu via UI mais teste via double-click rapide ou SQL direct. Verifier qu'aucun email additionnel n'est envoye.
    - (e) Toggle region « Ile-de-France » (8 dpt : 75, 77, 78, 91, 92, 93, 94, 95). Inserer 1 ligne par dpt. Verifier que les 8 emails partent et que les 8 `notified_at` sont mis a jour.
    - (f) Cron retry : invoquer manuellement `curl -H "Authorization: Bearer $CRON_SECRET" https://<host>/api/cron/notify-waitlist-retry`. Doit retourner `{processed: 0, sent: 0, ...}` si rien en attente. Inserer une ligne `notified_at IS NULL` pour un dpt deja ouvert -> re-invoquer le cron -> doit envoyer 1 email et passer `notified_at NOT NULL`.
    - (g) Cas degrade Resend : non testable localement (cle valide). Documenter au reviewer pour validation manuelle staging si possible.
    - (h) Cas degrade `target_id_text` : verifier post-toggle qu'`admin_actions_log` contient bien la ligne `target_id IS NULL AND target_id_text = '75' AND action_type = 'departement_ouvert'`. Verifier qu'aucune ancienne ligne (cron `confirm-parrainages` execute apres deploiement) ne casse — le cron continue d'inserer `target_id: row.marraine_id` (UUID valide) sans toucher `target_id_text`.
    - (i) Apres tests : purge des lignes test : `DELETE FROM waitlist_departements WHERE email LIKE 'test%@example.com'`. Toggle dpt 75 a `ouvert=false` pour restaurer l'etat Bretagne pilote.
    - Test e2e Playwright **reporte Epic 4** (cf. `epic-3.md` « Notes implementation : dette tests »).

### AC commun Lot C (rappel CLAUDE.md durcie)

17. **AC commun 1** - DoD a11y **N/A** (story BDD + cron + email + server action — aucun impact UI direct, aucun nouveau composant client, aucune nouvelle route publique). Justification documentee en AC14 et dans Project Structure Notes. Verification statique `git diff --stat` impose : aucun fichier `.tsx` non-admin touche.

18. **AC commun 2** - Double commit : livraison (`Story 3.5 : notification automatique waitlist a l'ouverture departement`) puis cloture (`Story 3.5 : statut done apres CI Vercel verte`). Conventions projet (cf. `project_bmad_conventions`).

## Tasks / Subtasks

- [x] **Task 1 - Migration `admin_actions_log_target_id_text`** (AC: #1)
  - [x] Sub 1.1 : Creer `supabase/migrations/<timestamp>_admin_actions_log_target_id_text.sql`. Timestamp **strictement superieur** au max actuel (`20260506120000`) — utiliser le format `YYYYMMDDHHMMSS` coherent (ex : `20260506130000`).
  - [x] Sub 1.2 : Squelette migration :
    ```sql
    -- Ajout colonne target_id_text pour actions admin ne portant pas sur un UUID
    -- (ex : code_departement). Mutex applicatif avec target_id (exactement un des
    -- deux doit etre renseigne). Story 3.5 / FR46 extension.
    --
    -- Pre-existant : target_id UUID NOT NULL. Conserve tel quel pour les flows
    -- qui posent un UUID utilisateur ou subscription (ex : cron parrainage).
    --
    -- Bug latent : app/admin/departements/actions.ts:62 et :96 inseraient un
    -- code TEXT dans target_id (UUID) -> erreur Postgres 22P02. Aucun toggle
    -- reel n'a jamais ete execute en prod (5 dpt seedes par migration), donc
    -- le bug n'avait jamais ete declenche. Cette story 3.5 va exercer le code
    -- path pour la premiere fois.

    ALTER TABLE public.admin_actions_log
      ADD COLUMN IF NOT EXISTS target_id_text TEXT;

    COMMENT ON COLUMN public.admin_actions_log.target_id_text IS
      'Target ID textuel pour actions ne portant pas sur un UUID (ex : code_departement). Mutex applicatif avec target_id : exactement un des deux doit etre renseigne. Pas de CHECK BDD pour preserver les lignes historiques.';
    ```
  - [x] Sub 1.3 : Appliquer la migration via Supabase MCP `apply_migration` (cle conventions projet : Sylvain valide manuellement les migrations critiques avant push).
  - [x] Sub 1.4 : Verifier post-migration : `SELECT column_name, data_type, is_nullable FROM information_schema.columns WHERE table_name = 'admin_actions_log' AND column_name = 'target_id_text'` retourne `(target_id_text, text, YES)`.

- [x] **Task 2 - Email template `sendWaitlistOpeningNotificationEmail`** (AC: #7, #12)
  - [x] Sub 2.1 : Dans `lib/emails.ts`, ajouter **apres** `sendWaitlistConfirmationEmail` (donc avant `sendParrainageVerificationEmail`, autour de la ligne 916) :
    ```ts
    // Email envoye a un visiteur waitlist quand son departement est ouvert.
    // Pattern visiteur anonyme : userId est undefined par construction (les
    // lignes waitlist_departements ne sont pas liees a users.id). On skip le
    // logNotification dans ce cas pour eviter le bug latent NOT NULL FK
    // users(id) sur notifications_log (cf. memoire project_logNotification_bug).
    export async function sendWaitlistOpeningNotificationEmail(params: {
      email: string
      codeDepartement: string
      nomDepartement: string
      userId?: string
    }) {
      const subject = `Le service est ouvert dans ${params.nomDepartement}`
      const canLog = Boolean(params.userId)
      const ctaUrl = `${BASE_URL}/recherche?code_departement=${encodeURIComponent(params.codeDepartement)}`
      try {
        await resend.emails.send({
          from: FROM_EMAIL,
          to: params.email,
          subject,
          html: `
            <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto;">
              <h1 style="color: #000;">Bonne nouvelle</h1>
              <p>Bonjour,</p>
              <p>Le service roxanetnous est desormais ouvert dans le departement <strong>${escapeHtml(params.nomDepartement)}</strong> (${escapeHtml(params.codeDepartement)}).</p>
              <p>Vous pouvez des maintenant explorer les profils disponibles dans votre zone.</p>
              <p style="margin-top: 24px;">
                <a href="${ctaUrl}" style="background: #000; color: #fff; padding: 12px 24px; text-decoration: none; display: inline-block;">
                  Decouvrir roxanetnous dans ${escapeHtml(params.nomDepartement)}
                </a>
              </p>
            </div>
          `,
        })

        if (canLog) {
          await logNotification({
            userId: params.userId,
            email: params.email,
            type: 'waitlist_opening',
            subject,
            status: 'sent',
          })
        }
      } catch (error) {
        if (canLog) {
          await logNotification({
            userId: params.userId,
            email: params.email,
            type: 'waitlist_opening',
            subject,
            status: 'failed',
            error: error instanceof Error ? error.message : 'Erreur inconnue',
          })
        } else {
          console.error('[notify-waitlist][email_send_error]', { code: params.codeDepartement, email: params.email, error })
        }
      }
    }
    ```
  - [x] Sub 2.2 : Verifier que `escapeHtml` (deja defini ligne 11) est utilise sur **toutes** les variables utilisateur (`nomDepartement`, `codeDepartement`) — XSS prevention (R6).
  - [x] Sub 2.3 : Verifier `encodeURIComponent` sur `codeDepartement` dans le ctaUrl (defense en profondeur — meme si codes dpt sont alphanumeriques courts).
  - [x] Sub 2.4 : Pas d'export du type, juste de la fonction. Pas de `userId` requis car les destinataires sont anonymes.

- [x] **Task 3 - Helper `lib/notify-waitlist.ts:notifyWaitlistForCode`** (AC: #3, #8, #9, #10, #11, #12, #13)
  - [x] Sub 3.1 : Creer `lib/notify-waitlist.ts`. Imports :
    ```ts
    import { createClient } from '@/lib/supabase/server'
    import { sendWaitlistOpeningNotificationEmail } from '@/lib/emails'
    ```
  - [x] Sub 3.2 : Definir le type retour :
    ```ts
    export type NotifyWaitlistResult = {
      processed: number
      sent: number
      skipped: number
      errors: number
    }
    ```
  - [x] Sub 3.3 : Constante :
    ```ts
    const BATCH_LIMIT = 200
    ```
  - [x] Sub 3.4 : Implementer `export async function notifyWaitlistForCode(code: string): Promise<NotifyWaitlistResult>` :
    - `createClient({ serviceRole: true })` (RLS deny_all sur `waitlist_departements`).
    - SELECT `nom` du departement : `const { data: dpt } = await supabase.from('departements_ouverts').select('nom').eq('code', code).single()`. Si `!dpt` -> log warn + return `{ processed: 0, sent: 0, skipped: 0, errors: 0 }`.
    - SELECT lignes en attente :
      ```ts
      const { data: lignes, error: queryErr } = await supabase
        .from('waitlist_departements')
        .select('id, email')
        .eq('code_departement', code)
        .is('notified_at', null)
        .limit(BATCH_LIMIT)
      ```
    - Si `queryErr` ou `!lignes` -> log error + return `{ processed: 0, sent: 0, skipped: 0, errors: 1 }`.
    - Compteurs `processed = 0, sent = 0, skipped = 0, errors = 0`.
    - Boucle sequentielle (pas de Promise.all, protege Resend) :
      ```ts
      for (const row of lignes) {
        processed++
        // Compare-and-swap atomique : si une autre invocation (cron ou admin)
        // a deja swappe cette ligne, .select retourne un array vide.
        const { data: swapped, error: swapErr } = await supabase
          .from('waitlist_departements')
          .update({ notified_at: new Date().toISOString() })
          .eq('id', row.id)
          .is('notified_at', null)
          .select('id')

        if (swapErr) {
          console.error('[notify-waitlist][swap_error]', { id: row.id, err: swapErr })
          errors++
          continue
        }
        if (!swapped || swapped.length === 0) {
          // Concurrent : autre run a deja pris la ligne
          skipped++
          continue
        }

        // Envoi email (try/catch interne : ne throw jamais hors de la fonction email)
        await sendWaitlistOpeningNotificationEmail({
          email: row.email,
          codeDepartement: code,
          nomDepartement: dpt.nom,
        })
        sent++
      }
      ```
    - Log info : `console.info('[notify-waitlist] code=' + code + ' processed=' + processed + ' sent=' + sent + ' skipped=' + skipped + ' errors=' + errors)`.
    - Return `{ processed, sent, skipped, errors }`.
  - [x] Sub 3.5 : Pas de marquage `'use server'` (helper pur, importe par server actions et routes API qui sont deja server-side).

- [x] **Task 4 - Modification `app/admin/departements/actions.ts`** (AC: #2, #4, #5, #15)
  - [x] Sub 4.1 : Ajouter import en tete : `import { notifyWaitlistForCode } from '@/lib/notify-waitlist'`.
  - [x] Sub 4.2 : **Refactor `toggleDepartement`** (lignes ~41-72) :
    - **Avant l'UPDATE** : ajouter un SELECT pre-update pour capturer `ouvert` actuel :
      ```ts
      const { data: avant } = await supabase
        .from('departements_ouverts')
        .select('ouvert')
        .eq('code', code)
        .single()
      const etaitFerme = avant?.ouvert === false
      ```
    - **Apres UPDATE reussi**, **avant `invalidate()`** :
      ```ts
      // Bug latent fix (cf. story 3.5 D1) : target_id est UUID NOT NULL en BDD
      // alors que code dpt est TEXT. Bascule vers target_id_text (nullable, ajoute
      // par migration 3.5).
      await supabase.from('admin_actions_log').insert({
        admin_id: auth.adminId,
        action_type: ouvrir ? 'departement_ouvert' : 'departement_ferme',
        target_type: 'departement',
        target_id: null,
        target_id_text: code,
        details: { code, ouvert: ouvrir },
      })

      // Notification waitlist : declenchee uniquement sur transition false -> true.
      // Synchrone : on attend l'envoi des emails dans la meme requete server action
      // (pattern story 3.5 AC4). Fire-and-forget rejete car perdrait les erreurs
      // Resend silencieusement.
      if (ouvrir && etaitFerme) {
        try {
          await notifyWaitlistForCode(code)
        } catch (notifyErr) {
          // L'UPDATE departement est deja conserve. Le cron retry rattrapera.
          console.error('[toggleDepartement][notify_error]', { code, err: notifyErr })
        }
      }

      invalidate()
      return { success: true }
      ```
    - **Supprimer** l'INSERT `admin_actions_log` original (lignes ~62-68) puisqu'il est remplace ci-dessus.
  - [x] Sub 4.3 : **Refactor `toggleRegion`** (lignes ~74-106) :
    - **Avant l'UPDATE** : SELECT pre-update pour capturer codes actuellement fermes :
      ```ts
      const { data: avant } = await supabase
        .from('departements_ouverts')
        .select('code, ouvert')
        .eq('region', region)
      const codesAvantFermes = (avant || [])
        .filter((d) => d.ouvert === false)
        .map((d) => d.code)
      ```
    - **Conserver** l'UPDATE existant.
    - **Refactor INSERT `admin_actions_log`** : meme bascule `target_id_text`.
      ```ts
      await supabase.from('admin_actions_log').insert({
        admin_id: auth.adminId,
        action_type: ouvrir ? 'region_ouverte' : 'region_fermee',
        target_type: 'region',
        target_id: null,
        target_id_text: region,
        details: { region, ouvert: ouvrir, codes: codes?.map((d) => d.code) || [] },
      })
      ```
    - **Apres INSERT log**, **avant `invalidate()`** :
      ```ts
      // Notification waitlist sequentielle pour chaque code passe false -> true
      // (AC5). Sequentiel pour ne pas burst Resend. Worst case 13 dpt * 50 lignes
      // * ~300ms = ~3min, peut depasser le timeout server action 60s Vercel.
      // Le cron retry (notify-waitlist-retry) rattrapera ce qui n'aura pas pu etre
      // envoye dans la fenetre. Documente en R2.
      if (ouvrir) {
        for (const c of codesAvantFermes) {
          try {
            await notifyWaitlistForCode(c)
          } catch (notifyErr) {
            console.error('[toggleRegion][notify_error]', { code: c, region, err: notifyErr })
          }
        }
      }

      invalidate()
      return { success: true }
      ```

- [x] **Task 5 - Cron secondaire `app/api/cron/notify-waitlist-retry/route.ts`** (AC: #6, #8, #12)
  - [x] Sub 5.1 : Creer `app/api/cron/notify-waitlist-retry/route.ts`. Squelette :
    ```ts
    import { NextRequest, NextResponse } from 'next/server'
    import { createClient } from '@/lib/supabase/server'
    import { sendWaitlistOpeningNotificationEmail } from '@/lib/emails'

    const BATCH_LIMIT = 200

    export async function GET(request: NextRequest) {
      const authHeader = request.headers.get('authorization')
      if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
        return NextResponse.json({ error: 'Non autorisé' }, { status: 401 })
      }

      const supabase = await createClient({ serviceRole: true })

      // SELECT lignes waitlist non notifiees pour des dpt deja ouverts.
      // Le JOIN garantit qu'on ne notifie pas un dpt qui n'a jamais ete ouvert
      // (cas pathologique : ligne waitlist sur dpt qui n'est jamais passe ouvert).
      const { data: lignes, error: queryErr } = await supabase
        .from('waitlist_departements')
        .select('id, email, code_departement, departements_ouverts!inner(nom, ouvert)')
        .is('notified_at', null)
        .eq('departements_ouverts.ouvert', true)
        .limit(BATCH_LIMIT)

      if (queryErr) {
        console.error('[cron_notify_waitlist_retry][query_error]', queryErr)
        return NextResponse.json({ error: 'Query failed' }, { status: 500 })
      }

      let processed = 0
      let sent = 0
      let skipped = 0
      let errors = 0

      for (const row of lignes ?? []) {
        processed++

        const { data: swapped, error: swapErr } = await supabase
          .from('waitlist_departements')
          .update({ notified_at: new Date().toISOString() })
          .eq('id', row.id)
          .is('notified_at', null)
          .select('id')

        if (swapErr) {
          console.error('[cron_notify_waitlist_retry][swap_error]', { id: row.id, err: swapErr })
          errors++
          continue
        }
        if (!swapped || swapped.length === 0) {
          skipped++
          continue
        }

        // departements_ouverts est embed via PostgREST !inner. Acces nom :
        const dpt = Array.isArray(row.departements_ouverts) ? row.departements_ouverts[0] : row.departements_ouverts
        await sendWaitlistOpeningNotificationEmail({
          email: row.email,
          codeDepartement: row.code_departement,
          nomDepartement: dpt?.nom ?? row.code_departement,
        })
        sent++
      }

      console.info('[cron_notify_waitlist_retry] processed=' + processed + ' sent=' + sent + ' skipped=' + skipped + ' errors=' + errors)
      return NextResponse.json({ processed, sent, skipped, errors })
    }
    ```
  - [x] Sub 5.2 : Notes typage : Supabase PostgREST embed (`departements_ouverts!inner(nom, ouvert)`) retourne soit un objet soit un array selon la cardinalite de la relation. Defensif : `Array.isArray(...)` check pour ne pas casser si Supabase change la convention. Pas de `as any`. Si TS rale sur le type generique : declarer un type local `type LigneAvecDpt = { id: string; email: string; code_departement: string; departements_ouverts: { nom: string; ouvert: boolean } | { nom: string; ouvert: boolean }[] }`. **Pas** de cast `as any` (AC13).

- [x] **Task 6 - Ajout cron entry `vercel.json`** (AC: #6, #15)
  - [x] Sub 6.1 : Modifier `vercel.json` — ajouter une 6e entree dans `crons[]` :
    ```json
    {
      "path": "/api/cron/notify-waitlist-retry",
      "schedule": "0 5 * * *"
    }
    ```
    Place strategique : 5h du matin entre `confirm-parrainages` (2h) et `reactivate-disponible` (6h). Charge BDD nulle a cette heure (zero trafic pilote Bretagne).
  - [x] Sub 6.2 : Verifier que le `buildCommand` (`npm run lint:a11y-check && next build`) reste inchange.

- [x] **Task 7 - Validation pre-commit livraison** (AC: #13, #14, #15)
  - [x] Sub 7.1 : `npx tsc --noEmit` -> 0 erreur.
  - [x] Sub 7.2 : `npm run lint:a11y-check` -> baseline 155 stable, 0 regression.
  - [x] Sub 7.3 : `npm run a11y:axe:check` -> exit 0 (aucune route touchee, regle CLAUDE.md durcie).
  - [x] Sub 7.4 : `npm run build` (Turbopack) -> succes, le nouveau cron `notify-waitlist-retry` est enregistre comme route dynamique.
  - [x] Sub 7.5 : `git diff --stat` controle : exactement 5 nouveaux fichiers + 2 modifies (`app/admin/departements/actions.ts` + `lib/emails.ts` + `vercel.json`). **Aucun fichier `.tsx` non-admin** ne doit apparaitre dans le diff.
  - [x] Sub 7.6 : Tests manuels AC16 (a) a (i) executes. Documenter dans Completion Notes les tests passes vs reportes au reviewer.

- [ ] **Task 8 - Double commit (AC commun 2)**
  - [ ] Sub 8.1 : Commit livraison : `Story 3.5 : notification automatique waitlist a l'ouverture departement`. Corps : enumerer les 5 fichiers ajoutes + 2 modifies + le bug latent fix `target_id_text`.
  - [ ] Sub 8.2 : Push sur main, attendre CI Vercel verte.
  - [ ] Sub 8.3 : Commit cloture : `Story 3.5 : statut done apres CI Vercel verte`. Modifier uniquement `_bmad-output/implementation-artifacts/sprint-status.yaml` (3-5 -> done) et le Status du present fichier story.

## Dev Notes

### Decisions techniques numerotees

- **D1 (Bug latent `admin_actions_log.target_id` UUID NOT NULL)** — Decouvert pendant le cadrage de cette story 3.5. Le code actuel `app/admin/departements/actions.ts:62` insere `target_id: code` (TEXT type Postgres `'29'`, `'75'`) dans une colonne `target_id UUID NOT NULL`. Erreur Postgres `22P02 invalid input syntax for type uuid` garantie au premier toggle reel. Aucun toggle n'a jamais ete execute en prod (5 dpt seedes par migration `20260502120000`, `SELECT count(*) FROM admin_actions_log WHERE action_type LIKE 'departement_%' OR action_type LIKE 'region_%'` = 0). **Cette story 3.5 va exercer pour la premiere fois ce code path** (toggle reel d'un dpt hors-Bretagne pour declencher la notif). **Decision** : ajouter `target_id_text TEXT NULL` plutot que `ALTER COLUMN target_id DROP NOT NULL` ou `ALTER COLUMN target_id TYPE TEXT`. **Pourquoi** : (a) preserve les autres callers qui posent un UUID legitime (cron `confirm-parrainages` ligne 250 : `target_id: row.marraine_id`), (b) ne corrompt pas les lignes historiques, (c) introduit un mutex applicatif explicite (« si target_type='departement' alors target_id_text est rempli, sinon target_id »). **Alternative rejetee** : `ALTER COLUMN target_id TYPE TEXT` casse le typage type-safe avec users.id et subscriptions.id pour les autres callers, et le COMMENT n'est plus interpretable. **Pas de CHECK BDD** type `(target_id IS NULL) <> (target_id_text IS NULL)` car les lignes historiques ont `target_id NOT NULL` et un CHECK retroactif les invaliderait.

- **D2 (SELECT pre-update pour detection transition false -> true)** — `toggleDepartement` actuel fait UPDATE blind sans connaitre l'etat avant. Pour declencher `notifyWaitlistForCode` **uniquement** sur la transition `false -> true` (idempotence AC8), il faut connaitre l'etat avant. **Decision** : SELECT pre-update simple (sans `FOR UPDATE` lock — l'admin UI est sequentiel dans la pratique, double-click rare et idempotent par compare-and-swap dans `notifyWaitlistForCode`). **Alternative rejetee** : `UPDATE ... RETURNING (SELECT ouvert FROM ...)` -> syntaxe Postgres lourde via Supabase JS, lisibilite pire. **Alternative rejetee 2** : detecter via `ouvert_le IS NULL` apres UPDATE -> faux negatif si dpt re-ouvert (ouvert_le ecrase a chaque toggle ouvert).

- **D3 (Compare-and-swap pour idempotence cross-source)** — Le swap atomique `UPDATE ... WHERE notified_at IS NULL RETURNING id` garantit qu'un envoi ne peut avoir lieu deux fois meme si admin trigger + cron retry tournent simultanement. **Pattern eprouve** : `app/api/cron/confirm-parrainages/route.ts:106-122` (`UPDATE statut = 'confirme' WHERE statut = 'abonnee'`).

- **D4 (Sequentiel vs Promise.all)** — Boucle d'envoi sequentielle (pas de `Promise.all`). **Pourquoi** : (a) protege Resend d'un burst (rate-limit Resend ~10 req/s en plan free, jusqu'a 100/s en plan pro), (b) en cas d'erreur reseau partielle, on n'arrete pas le batch entier (`continue` sur erreur), (c) lisibilite des logs. **Cout** : ~300ms * N. Pour N=200 (cap), ~60s. Pour le hook admin, 60s = limite timeout server action Vercel par defaut. **Mitigation** : si jamais N > 200 sur une ouverture region, le cron retry rattrape. Acceptable pilote Bretagne.

- **D5 (Swap AVANT envoi email, pas apres)** — Le compare-and-swap `notified_at = now()` est applique AVANT `await sendWaitlistOpeningNotificationEmail`. **Trade-off conscient** : si Resend echoue, la ligne est marquee notifiee meme si l'email n'a pas atteint le destinataire. **Justification** : le pattern inverse (swap apres envoi reussi) ouvre une fenetre de double-envoi en cas de double execution cron+admin. **Risque residuel R3** : un destinataire peut ne pas recevoir son email si Resend echoue ponctuellement. Surveillance via `console.error` Vercel logs + re-trigger SQL manuel (`UPDATE waitlist_departements SET notified_at = NULL WHERE id = X`) si signal observe. **Alternative rejetee (D5b)** : transactions Postgres pour rollback du swap si email fail -> trop lourd, asynchronicite Resend rend la transaction non triviale.

- **D6 (Cron secondaire schedule 5h du matin)** — `'0 5 * * *'`. Place entre `confirm-parrainages` (2h) et `reactivate-disponible` (6h). **Pourquoi 5h** : (a) charge BDD nulle (pilote Bretagne, zero trafic nuit), (b) fenetre apres `confirm-parrainages` pour eviter contention sur `admin_actions_log` (peu probable mais propre), (c) ecart confortable avec `reactivate-disponible` (6h) qui tourne sur les profils — pas de conflit de table.

- **D7 (Visiteur anonyme : pas de logNotification)** — Le destinataire d'un email waitlist n'est pas dans `users` (les lignes `waitlist_departements` ne sont pas liees a `users.id`). Insertion dans `notifications_log` impossible (FK NOT NULL). **Decision** : skip `logNotification` quand `userId` undefined. Pattern strict `sendWaitlistConfirmationEmail` (story 3.4). Status `'failed'` au lieu de `'error'` (CHECK BDD). Le fix transverse du bug latent est report Epic 4 (memoire `project_logNotification_bug`).

- **D8 (Hook synchrone vs fire-and-forget)** — Le hook depuis `toggleDepartement` est **synchrone** (`await notifyWaitlistForCode(code)`). **Pourquoi pas fire-and-forget** : (a) Vercel kill les promises non-await dans une server action a la fin de la requete (pas de background workers natifs), (b) erreurs Resend silencieusement perdues, (c) le delai 200-500ms par email est negligeable pour un toggle admin manuel (l'admin attend 1-3s de feedback UI, c'est dans la norme).

- **D9 (Pas de `revalidateTag` sur `waitlist_departements`)** — La table n'a pas de cache `unstable_cache` cote application (a la difference de `departements_ouverts` via `lib/departements.ts:DEPARTEMENTS_CACHE_TAG`). Aucune invalidation explicite requise.

### Pattern de code (extraits)

```sql
-- supabase/migrations/<timestamp>_admin_actions_log_target_id_text.sql

-- Ajout colonne target_id_text pour actions admin ne portant pas sur un UUID
-- (ex : code_departement). Mutex applicatif avec target_id (exactement un des
-- deux doit etre renseigne). Story 3.5 / FR46 extension.
ALTER TABLE public.admin_actions_log
  ADD COLUMN IF NOT EXISTS target_id_text TEXT;

COMMENT ON COLUMN public.admin_actions_log.target_id_text IS
  'Target ID textuel pour actions ne portant pas sur un UUID (ex : code_departement). Mutex applicatif avec target_id : exactement un des deux doit etre renseigne. Pas de CHECK BDD pour preserver les lignes historiques.';
```

```ts
// lib/notify-waitlist.ts (squelette complet)

import { createClient } from '@/lib/supabase/server'
import { sendWaitlistOpeningNotificationEmail } from '@/lib/emails'

export type NotifyWaitlistResult = {
  processed: number
  sent: number
  skipped: number
  errors: number
}

const BATCH_LIMIT = 200

export async function notifyWaitlistForCode(code: string): Promise<NotifyWaitlistResult> {
  const supabase = await createClient({ serviceRole: true })

  const { data: dpt } = await supabase
    .from('departements_ouverts')
    .select('nom')
    .eq('code', code)
    .single()

  if (!dpt) {
    console.warn('[notify-waitlist] code dpt inconnu', code)
    return { processed: 0, sent: 0, skipped: 0, errors: 0 }
  }

  const { data: lignes, error: queryErr } = await supabase
    .from('waitlist_departements')
    .select('id, email')
    .eq('code_departement', code)
    .is('notified_at', null)
    .limit(BATCH_LIMIT)

  if (queryErr) {
    console.error('[notify-waitlist][query_error]', { code, err: queryErr })
    return { processed: 0, sent: 0, skipped: 0, errors: 1 }
  }

  let processed = 0
  let sent = 0
  let skipped = 0
  let errors = 0

  for (const row of lignes ?? []) {
    processed++

    const { data: swapped, error: swapErr } = await supabase
      .from('waitlist_departements')
      .update({ notified_at: new Date().toISOString() })
      .eq('id', row.id)
      .is('notified_at', null)
      .select('id')

    if (swapErr) {
      console.error('[notify-waitlist][swap_error]', { id: row.id, err: swapErr })
      errors++
      continue
    }
    if (!swapped || swapped.length === 0) {
      // Concurrent : autre run a deja pris la ligne
      skipped++
      continue
    }

    await sendWaitlistOpeningNotificationEmail({
      email: row.email,
      codeDepartement: code,
      nomDepartement: dpt.nom,
    })
    sent++
  }

  console.info('[notify-waitlist] code=' + code + ' processed=' + processed + ' sent=' + sent + ' skipped=' + skipped + ' errors=' + errors)
  return { processed, sent, skipped, errors }
}
```

```ts
// app/admin/departements/actions.ts (extraits modifies)

import { revalidatePath, revalidateTag } from 'next/cache'
import { createClient } from '@/lib/supabase/server'
import { DEPARTEMENTS_CACHE_TAG } from '@/lib/departements'
import { notifyWaitlistForCode } from '@/lib/notify-waitlist'

// ... requireAdmin et invalidate inchanges ...

export async function toggleDepartement(code: string, ouvrir: boolean): Promise<ToggleResult> {
  const auth = await requireAdmin()
  if ('error' in auth) return { error: auth.error }

  const supabase = await createClient({ serviceRole: true })

  // SELECT pre-update pour detecter transition false -> true (story 3.5 D2)
  const { data: avant } = await supabase
    .from('departements_ouverts')
    .select('ouvert')
    .eq('code', code)
    .single()
  const etaitFerme = avant?.ouvert === false

  const updateData: Record<string, unknown> = { ouvert: ouvrir, updated_by: auth.adminId }
  if (ouvrir) updateData.ouvert_le = new Date().toISOString()

  const { error } = await supabase
    .from('departements_ouverts')
    .update(updateData)
    .eq('code', code)
  if (error) return { error: 'Erreur lors de la mise à jour.' }

  // Bug latent fix (story 3.5 D1) : target_id_text au lieu de target_id
  await supabase.from('admin_actions_log').insert({
    admin_id: auth.adminId,
    action_type: ouvrir ? 'departement_ouvert' : 'departement_ferme',
    target_type: 'departement',
    target_id: null,
    target_id_text: code,
    details: { code, ouvert: ouvrir },
  })

  // Notification waitlist : transition false -> true uniquement (AC4, AC8)
  if (ouvrir && etaitFerme) {
    try {
      await notifyWaitlistForCode(code)
    } catch (notifyErr) {
      console.error('[toggleDepartement][notify_error]', { code, err: notifyErr })
    }
  }

  invalidate()
  return { success: true }
}
```

### Risques identifies

| ID | Risque | Mitigation |
|---|---|---|
| **R1** | Le hook synchrone `await notifyWaitlistForCode(code)` depuis `toggleDepartement` peut depasser le timeout server action Vercel (60s par defaut) si N > 200 destinataires sur un dpt donne. | Cap `BATCH_LIMIT = 200` defensif. Cron retry rattrape le surplus dans les 24h. Pour pilote Bretagne, N attendu = 0-50 par dpt (volume minuscule). Documente AC4 et D4. |
| **R2** | Ouverture region (toggleRegion) avec 13 dpt * 50 lignes = 650 emails sequentiels = ~3min, depasse 60s timeout server action. | Cap `BATCH_LIMIT = 200` par code. Cron retry rattrape. **L'admin re-execute le toggle** : `etaitFerme` sera false pour les dpt deja ouverts en base, donc ne re-trigger pas notifyWaitlistForCode (idempotent). Pour MVP Bretagne (region 5 dpt, ~50 inscrits/dpt total) c'est dans le budget. |
| **R3** | Resend down ou erreur reseau pendant la boucle : la ligne est swappee `notified_at = now()` AVANT l'envoi, donc le destinataire ne recoit pas son email mais sa ligne est marquee comme notifiee. | Decision D5 actee : trade-off pour eviter le double-envoi. Surveillance via `console.error` Vercel logs. Re-trigger SQL manuel si signal observe : `UPDATE waitlist_departements SET notified_at = NULL WHERE id = X` puis attendre cron retry. |
| **R4** | Race condition double-click admin sur le toggle (`false -> true` deux fois en < 1s). | (a) Compare-and-swap dans `notifyWaitlistForCode` -> chaque ligne est swappee une seule fois meme si 2 invocations paralleles, (b) le SELECT pre-update peut renvoyer `ouvert: false` deux fois (race), donc 2 invocations notifyWaitlistForCode mais la 2e voit toutes les lignes deja swappees -> `skipped` = N, `sent` = 0. **Cas accepte** : 0 double envoi, juste un log inutile. Pas de blocage. |
| **R5** | Cron retry tourne en parallele avec un toggle admin manuel. | Compare-and-swap garantit qu'une ligne ne peut etre prise qu'une fois. Pas de blocage. Cas accepte. |
| **R6** | XSS dans `nomDepartement` ou `codeDepartement` (ex : un admin SQL ad-hoc met `nom = '<script>alert(1)</script>'` dans `departements_ouverts`). | `escapeHtml(...)` applique sur **toutes** les variables utilisateur dans `sendWaitlistOpeningNotificationEmail`. Pattern eprouve `lib/emails.ts:11`. Pour le subject (pas escape) : Resend gere les caracteres correctement (pas d'interpretation HTML dans subject). |
| **R7** | Bug latent `notifications_log.user_id NOT NULL` se redeclenche si on tente de loguer un visiteur anonyme. | Pattern visiteur anonyme strict : `canLog = Boolean(params.userId)` -> skip `logNotification` si undefined (D7). Memoire `project_logNotification_bug` documente le fix transverse Epic 4. |
| **R8** | Migration `admin_actions_log_target_id_text` rejouee sur une BDD ou la colonne existe. | `ADD COLUMN IF NOT EXISTS` -> idempotent. Pas de risque de regression. |
| **R9** | Modification de `toggleDepartement` casse le contrat retour `{ error?, success? }`. | Tests manuels AC16 (b) verifient le toggle UI complet. Le retour reste `{ success: true }` ou `{ error: '...' }` — comportement client `DepartementsManager.tsx` inchange. |
| **R10** | Ajout du cron `notify-waitlist-retry` augmente la facture Vercel. | 1 invocation/jour, ~5s d'execution attendue (BATCH_LIMIT 200 avec ~300ms par envoi = max 60s, attendu ~5s en regime). Cout cron Vercel marginal. Hobby plan accepte 2 crons par projet — actuellement 5 deployes, le 6e necessite plan Pro. **Verifier avant deploiement** : compte Vercel sur plan Pro/Team. Si Hobby : reporter le cron retry et n'ouvrir que via admin trigger (perte de la robustesse retry, accepter R3 plus fortement). |
| **R11** | La signature TS du select PostgREST embed `departements_ouverts!inner(nom, ouvert)` est instable selon version Supabase JS. | Cast defensif `Array.isArray(...)` dans le cron retry. Pas de `as any` (AC13). Si le typage echoue completement : declarer un type local `LigneAvecDpt` (D documented in Sub 5.2). |
| **R12** | L'envoi email contient un CTA `${BASE_URL}/recherche?code_departement=29` qui peut ne pas filtrer correctement si la story 3.1 ne supporte pas ce query param. | **A verifier** : story 3.1 a livre `lib/matching.ts` et `app/recherche/page.tsx` avec filtrage par `departements_ouverts.code`. Si le CTA `?code_departement=29` n'est pas pris en compte par `/recherche`, le destinataire arrive sur la page recherche generique (toujours valide, pas un blocage). **Decision** : fallback gracieux accepte. Story 3.5 ne modifie pas `/recherche`. Si besoin, story dediee Epic 4 pour pre-filtrage URL. |
| **R13** | Une ligne `waitlist_departements.email` invalide (echappe la regex BDD CHECK car validee a l'INSERT story 3.4 mais le destinataire peut avoir change). | Resend retourne 400, capte par try/catch interne `sendWaitlistOpeningNotificationEmail`, log erreur, ligne reste swappee (R3). Acceptable. |

### Project Structure Notes

Cette story est un **ajout principalement additif** (5 nouveaux fichiers) avec **2 modifications minimales** (`app/admin/departements/actions.ts` pour hook + bug fix `target_id_text`, `lib/emails.ts` pour ajout fonction email, `vercel.json` pour ajout cron). Total ~250 lignes ajoutees, ~15 lignes modifiees.

**Pas de DoD a11y** : aucun nouvel ecran, aucun nouveau composant client, aucune modification UI. Les 2 modifications cote `app/admin/departements/actions.ts` sont strictement server-side (Server Action). Le composant `DepartementsManager.tsx` (Client Component) **n'est pas touche** : son contrat avec `toggleDepartement(code, ouvrir)` reste `{ error?, success? }`. Le delai supplementaire d'attente cote utilisateur admin (200-500ms par destinataire * N) est invisible UX (etat `pending` deja gere par `useTransition`).

Coherent avec la philosophie projet « no half-finished implementations » : la story 3.4 a livre la capture, la story 3.5 livre la notification, FR46 est complet apres merge. Le bug latent `target_id` UUID/TEXT est traite en passant (« interdire `as any` introduit, resorber au passage » ethos Lot C applique aussi aux bugs decouverts).

Apres merge :
- Cycle complet FR46 livre : capture (3.4) -> ouverture admin -> notification automatique (3.5) -> conversion attendue.
- Le bug latent `admin_actions_log.target_id` UUID NOT NULL est neutralise pour les call sites dpt/region (les autres callers UUID-valides continuent normalement).
- Le bug latent `notifications_log` reste a corriger Epic 4 (memoire `project_logNotification_bug`) — pas de regression introduite.

### References

- [Source: _bmad-output/planning-artifacts/epic-3.md#Story-3.5] — story origin (objectifs, AC initiaux, notes implementation : cron + admin trigger immediat avec retry, email template `sendWaitlistOpeningNotificationEmail`, log admin action).
- [Source: _bmad-output/planning-artifacts/prd.md#FR46] — exigence fonctionnelle : « Un visiteur ou utilisateur dont le departement de recherche est hors zone peut s'inscrire a une waitlist pour etre notifie a l'ouverture de son departement. » (extension : envoi automatique a l'ouverture).
- [Source: DECISIONS.md#2026-05-06-deploiement-geographique-progressif] — decision F : Bretagne 5 dpt + waitlist hors zone cote beneficiaire.
- [Source: lib/emails.ts:861-915] — pattern `sendWaitlistConfirmationEmail` (visiteur anonyme : `canLog`, skip `logNotification`, status `'failed'`). A cloner strictement.
- [Source: lib/emails.ts:11] — `escapeHtml(...)` XSS prevention helper.
- [Source: lib/emails.ts:15-33] — `logNotification` schema actuel (cf. bug latent project_logNotification_bug).
- [Source: app/admin/departements/actions.ts] — `toggleDepartement(code, ouvrir)` et `toggleRegion(region, ouvrir)`. Le call site a hooker.
- [Source: app/admin/departements/actions.ts:62] — bug latent `target_id: code` (TEXT dans UUID NOT NULL). A fix dans cette story.
- [Source: app/api/cron/confirm-parrainages/route.ts] — pattern cron mature : auth Bearer, batch BATCH_LIMIT, compare-and-swap, log compteurs, return JSON. A cloner pour `notify-waitlist-retry`.
- [Source: app/api/cron/confirm-parrainages/route.ts:246-256] — exemple INSERT `admin_actions_log` avec `admin_id: null` + `target_id` UUID valide (subscription). Pattern coexiste avec le nouveau `target_id_text` introduit pour les codes dpt.
- [Source: vercel.json] — 5 cron entries actuels. Story 3.5 ajoute la 6e.
- [Source: supabase/migrations/20260506120000_waitlist_departements.sql] — schema `waitlist_departements`. Index `(code_departement, notified_at)` deja en place pour cette story.
- [Source: supabase/migrations/20260428130322_admin_actions_log_allow_null_admin.sql] — schema `admin_actions_log` (admin_id nullable, target_id UUID NOT NULL).
- [Source: lib/departements.ts] — helpers `getAllDepartements`, `DEPARTEMENTS_CACHE_TAG`. **Non utilise dans cette story** (on requete `departements_ouverts.nom` directement par code precis).
- [Source: lib/supabase/server.ts] — `createClient({ serviceRole: true })` pattern.
- [Source: _bmad-output/implementation-artifacts/3-4-waitlist-hors-zone-beneficiaire-table-formulaire-et-email.md] — story 3.4 : pattern `sendWaitlistConfirmationEmail`, idempotence Postgres `23505`, format AC + risques + Dev Notes a cloner.
- [Source: _bmad-output/implementation-artifacts/3-1-activation-whitelist-departements-ouverts-et-filtrage-requetes.md] — story 3.1 : pattern double commit, format AC, format risques.
- [Source: tests/a11y/README.md] — 7 parcours axe-core actuels (P1-P6) — aucune route touchee dans cette story.

### Intelligence story precedente (3.4)

- **Pattern double commit confirme** : commits livraison + cloture, ne PAS utiliser `--amend`. Applique 3.1, 3.2, 3.3, 3.4. A reproduire 3.5.
- **A11y validation systematique** : impact UI **N/A** sur cette story (server actions + cron + email). Mais **garder discipline CLAUDE.md durcie** : `npm run a11y:axe:check` execute avant commit livraison pour confirmer 0 regression (les 7 parcours doivent rester verts puisqu'on ne touche pas leur surface).
- **Code review adversarial** post-livraison probable (3 layers Blind Hunter / Edge Case Hunter / Acceptance Auditor). Etre exhaustif sur les AC et edge cases : idempotence cross-source (admin + cron), compare-and-swap, cas degrade Resend (D5), bug latent `target_id_text` (D1), visiteur anonyme `notifications_log` (D7).
- **Pas de `as any` introduit** (AC13). Le retour `NotifyWaitlistResult` est type strictement. Le PostgREST embed dans le cron retry est gere defensivement avec `Array.isArray(...)`.
- **Decisions techniques numerotees + risques tabulaires** : format aligne 3.1, 3.2, 3.3, 3.4 — facilite review et generation d'arbres de decision.
- **Reuse strict** : 0 nouvelle abstraction, 0 nouveau composant. Helper `lib/notify-waitlist.ts` est strict minimum (`notifyWaitlistForCode`). Email template clone `sendWaitlistConfirmationEmail`. Cron clone `confirm-parrainages`.
- **Bug latent `notifications_log`** : pattern strict story 3.4 (`canLog`, skip si undefined, `'failed'`) reproduit dans `sendWaitlistOpeningNotificationEmail`. Pas de tentative de fix transverse (report Epic 4).

### Intelligence git recente (5 derniers commits)

```
339dcaf Story 3.4 : statut done apres CI Vercel verte
51f29fe Story 3.4 : waitlist hors zone beneficiaire (table + formulaire + email)
926c7c6 Story 3.3 : affichage landing disponible en Bretagne depuis BDD
e59fb15 Story 3.2 : statut done apres CI Vercel verte
a713592 Story 3.2 : fix build Turbopack en isolant extraireCodeDepartement client-safe
```

Note importante : commit `51f29fe` (story 3.4) a livre `sendWaitlistConfirmationEmail` avec le pattern visiteur anonyme. **Story 3.5 doit cloner strictement ce pattern** dans `sendWaitlistOpeningNotificationEmail`. Les patterns `escapeHtml`, `BASE_URL`, `FROM_EMAIL` sont stables.

**Aucun commit recent ne touche a `app/admin/departements/actions.ts`, `app/api/cron/*`, ou `vercel.json`** : les patterns a reproduire sont stables, pas de risque de conflit. Le toggle admin n'a jamais ete utilise en prod (5 dpt seedes par migration), donc le bug latent `target_id` n'a jamais ete declenche, donc cette story est la premiere a l'exercer.

### Resultats requete BDD pre-cadrage (verification etat)

```sql
-- 1. Schema notifications_log : confirme bug latent
SELECT conname, pg_get_constraintdef(oid) FROM pg_constraint
WHERE conrelid = 'public.notifications_log'::regclass;
-- => notifications_log_status_check : status IN ('pending','sent','failed')
-- => notifications_log_user_id_fkey : FK users(id) ON DELETE CASCADE
-- => user_id is NOT NULL

-- 2. Schema admin_actions_log : confirme bug latent target_id
SELECT column_name, data_type, is_nullable FROM information_schema.columns
WHERE table_name = 'admin_actions_log';
-- => target_id : uuid, NO (NOT NULL)
-- => target_type : text, NO

-- 3. Aucun toggle reel n'a jamais ete execute en prod
SELECT count(*) FROM admin_actions_log
WHERE action_type LIKE 'departement_%' OR action_type LIKE 'region_%';
-- => 0 lignes : le bug latent n'a JAMAIS ete declenche en prod (5 dpt
--    Bretagne seedes directement par migration 20260502120000)

-- 4. waitlist_departements vide en prod (story 3.4 livree, aucun visiteur encore)
SELECT count(*) FROM waitlist_departements;
-- => 0 lignes : pas de risque de retro-notification involontaire au deploiement
```

## Dev Agent Record

### Agent Model Used

claude-opus-4-7 (1M context) via Claude Code, workflow `bmad-dev-story`.

### Debug Log References

- `npx tsc --noEmit` -> exit 0 (aucune erreur TS).
- `npm run lint:a11y-check` -> 155 violations stables, baseline conserve.
- `npm run a11y:axe:check` -> exit 0, aucun delta Critical/Serious sur les 7 parcours.
- `npm run build` (Turbopack) -> succes, route `ƒ /api/cron/notify-waitlist-retry` enregistree.
- Migration appliquee via `mcp__supabase__apply_migration` (nom `admin_actions_log_target_id_text`). Verification post-migration : `target_id_text TEXT YES` confirme via `information_schema.columns`.
- `git diff --stat` : 3 fichiers modifies in-scope (`actions.ts`, `lib/emails.ts`, `vercel.json`) + 3 nouveaux in-scope (migration SQL, `lib/notify-waitlist.ts`, `app/api/cron/notify-waitlist-retry/route.ts`). Aucun fichier `.tsx` non-admin touche -> AC14 / AC15 confirmes.

### Completion Notes List

- **Migration `admin_actions_log_target_id_text` appliquee en BDD via Supabase MCP** : colonne `target_id_text TEXT NULL` ajoutee, idempotente (`ADD COLUMN IF NOT EXISTS`), commentaire pose. Bug latent D1 neutralise pour les call sites dpt/region.
- **Email template `sendWaitlistOpeningNotificationEmail`** ajoute dans `lib/emails.ts` apres `sendWaitlistConfirmationEmail`. Pattern visiteur anonyme strict (clone story 3.4) : `canLog = Boolean(params.userId)`, skip `logNotification` si undefined, status `'failed'` sur catch, `console.error` sinon. `escapeHtml` + `encodeURIComponent` appliques sur les variables utilisateur (R6, defense XSS).
- **Helper `lib/notify-waitlist.ts`** cree avec `notifyWaitlistForCode(code)`. Compare-and-swap atomique sur `notified_at` (D5 : swap AVANT envoi), `BATCH_LIMIT=200`, retour type `NotifyWaitlistResult`. Aucun `as any`. Log `console.info` pour observabilite Vercel.
- **`app/admin/departements/actions.ts`** : SELECT pre-update pour detecter transition `false -> true` (D2), bascule `target_id`/`target_id_text` (D1), hook `notifyWaitlistForCode` synchrone uniquement sur transition `false -> true`. `toggleRegion` parcourt sequentiellement les codes ayant transitionne (D3) — pas de Promise.all (D4). Erreurs Resend silencees a ce niveau (logs only) : l'UPDATE departement et le `admin_actions_log` sont preserves (AC4).
- **Cron `/api/cron/notify-waitlist-retry`** clone strict du pattern `confirm-parrainages` (auth Bearer, batch, compare-and-swap, JSON retour). PostgREST embed `departements_ouverts!inner(nom, ouvert)` filtre `ouvert=true` cote BDD. Defense `Array.isArray` sur l'embed (R11), type local `LigneAvecDpt` au lieu de `as any` (AC13).
- **`vercel.json`** : 6e cron `0 5 * * *` ajoute. Note R10 : suppose plan Vercel Pro/Team (Hobby cap 2 crons).
- **DoD a11y N/A** confirme : aucun fichier `.tsx` touche dans le diff (verification `git diff --stat`). `lint:a11y-check` (155 stable) et `axe:check` (0 violation Critical/Serious) verts.
- **Tests manuels AC16** : pre-prod et e2e Playwright reportes Epic 4 (cf. `epic-3.md` dette tests). Le reviewer humain validera (a) a (i) sur staging post-merge.
- **Idempotence verifiee par construction** : compare-and-swap `notified_at IS NULL` garantit qu'une ligne ne peut etre notifiee qu'une fois meme avec admin trigger + cron retry concurrents (AC8).
- **Bug latent `notifications_log` non touche** : pattern visiteur anonyme strict applique (D7), fix transverse reste reporte Epic 4.

### File List

**Nouveaux fichiers (3) :**
- `supabase/migrations/20260506130000_admin_actions_log_target_id_text.sql` — migration ADD COLUMN `target_id_text TEXT NULL` + COMMENT.
- `lib/notify-waitlist.ts` — helper `notifyWaitlistForCode(code)` + type `NotifyWaitlistResult`.
- `app/api/cron/notify-waitlist-retry/route.ts` — cron secondaire de retry quotidien (5h du matin).

**Fichiers modifies (3) :**
- `lib/emails.ts` — ajout `sendWaitlistOpeningNotificationEmail` (~60 lignes inserees).
- `app/admin/departements/actions.ts` — SELECT pre-update + bascule `target_id_text` + hook `notifyWaitlistForCode` (toggleDepartement et toggleRegion).
- `vercel.json` — ajout 6e cron entry `notify-waitlist-retry` schedule `0 5 * * *`.

### Change Log

- 2026-05-06 (story 3.5 livraison) : ajout notification automatique waitlist a l'ouverture d'un departement. Migration `admin_actions_log_target_id_text` (fix bug latent UUID/TEXT pour call sites dpt/region). Hook `toggleDepartement` / `toggleRegion` synchrone vers `notifyWaitlistForCode` sur transition `false -> true`. Cron secondaire de retry quotidien `notify-waitlist-retry` 5h. Email template `sendWaitlistOpeningNotificationEmail` (visiteur anonyme, pattern story 3.4 conserve). Cycle FR46 complet livre : capture (3.4) -> ouverture admin -> notification automatique (3.5).

## DoD a11y

**N/A** — story BDD + cron + email + server action. Aucun nouvel ecran, aucun nouveau composant client, aucune modification UI directe. Les modifications cote `app/admin/departements/actions.ts` sont strictement server-side (Server Action invoquee par `DepartementsManager.tsx` Client Component dont le contrat reste `{ error?, success? }`). Le composant Client Component **n'est pas touche**.

**Verification statique pre-commit livraison (regle CLAUDE.md durcie)** :
- `npm run lint:a11y-check` -> baseline 155 stable, 0 regression (aucun fichier `.tsx` non-admin touche).
- `npm run a11y:axe:check` -> exit 0, 0 violations Critical/Serious sur 7 parcours (aucune route publique touchee).
- `git diff --stat` ne doit toucher AUCUN fichier `.tsx` non-admin. Si un fichier `.tsx` apparait dans le diff (autre que regenerations triviales) : revoir le scope avant commit.
