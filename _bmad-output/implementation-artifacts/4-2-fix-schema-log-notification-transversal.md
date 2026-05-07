# Story 4.2 : Fix schema `logNotification` transversal (`user_id NULLABLE` + `status` etendu)

Status: ready-to-merge

<!-- Note : Validation est optionnelle. Lancer `validate-create-story` avant `dev-story` pour un controle qualite. -->

## Story

En tant que **developpeur du projet roxanetnous**,
je veux **aligner le schema BDD `notifications_log` avec la realite des flows email transverses (visiteurs anonymes + erreurs Resend) en (a) rendant `user_id` NULLABLE, (b) elargissant le `CHECK status` pour accepter `'error'`, `'lost'`, `'retry-scheduled'`, `'retry-exhausted'` en plus des trois valeurs actuelles, (c) refactorant le helper `lib/emails.ts:logNotification` et les 2 INSERT directs `app/actions/contact.ts` pour exploiter le nouveau schema sans workaround, et (d) supprimant les contournements `skip si userId undefined` poses Epic 3 story 3.4/3.5**,
afin de **resoudre le bug latent transverse identifie a la review story 3.4 (2026-05-06) qui touche 15+ flows email (welcome, new_message, subscription_confirm, contact_form, admin_parrainage_flag, parrainage_bienvenue, parrainage_filleule_confirm, parrainage_recompense, parrainage_verification, validation_*, expiration_reminder, renewal_reminder, plan_change, waitlist_confirmation, waitlist_opening, favori_disponible, disponible_reactivated, team_invite, matching_*) et solder l'AI-3.1 bloquant retro Epic 3, prerequis pour le go-live Bretagne et fondation pour story 4.3 (queue durable utilise `retry-scheduled`/`retry-exhausted`)**.

C'est la **deuxieme story de l'Epic 4 « Hardening pre-go-live Bretagne »** et la **deuxieme des 4 stories ordre 1** bloquantes go-live (sequencage : 4.1 done -> **4.2 (cette story)** -> 4.3 -> 4.4 -> go-live ; cf. `epic-4.md` Estimation effort, et la sortie sequencement note story 4.7 seeds non encore commencee mais decouplee de 4.2). Elle s'execute apres story 4.1 livree (Sentry actif), donc l'AC9 audit Sentry post-deploiement est exploitable directement.

**Le bug a corriger** (verification BDD prod 2026-05-07 via Supabase MCP) :

- `notifications_log.user_id UUID NOT NULL` + FK `users(id)` -> rejette tout INSERT avec `user_id IS NULL`. Or 4 flows email visent des destinataires hors-table `users` :
  - **Visiteur anonyme waitlist** (`sendWaitlistConfirmationEmail`, `sendWaitlistOpeningNotificationEmail`) : pas de `users.id` car les lignes `waitlist_departements` ne sont pas liees a `users`.
  - **Visiteur formulaire contact** (`sendContactMessage` dans `app/actions/contact.ts`) : visiteur potentiellement non connecte, INSERT direct sans `user_id`.
  - **Email admin transverse** (`sendAdminParrainageFlag` -> destinataire = `ADMIN_NOTIFICATIONS_EMAIL`, pas un `users.id` standard).
  - **Cas hypothetique parrainage filleule pre-creation compte** : flow potentiel post-Epic 4.
- `notifications_log.status TEXT DEFAULT 'pending' CHECK status IN ('pending', 'sent', 'failed')` -> rejette `status='error'` que `lib/emails.ts:logNotification` accepte au type TypeScript (`status: 'sent' | 'error' | 'failed'` ligne 21). Toutes les branches catch des 17+ fonctions email passent `'error'` -> INSERT echoue silencieusement (`.insert()` sans `.throwOnError()` ni catch en aval -> Promise rejection ignoree).
- **Constat empirique** : `SELECT COUNT(*), COUNT(*) FILTER (WHERE user_id IS NULL), COUNT(*) FILTER (WHERE status='failed' OR status='pending') FROM notifications_log;` retourne **50 / 0 / 0** au 2026-05-07 (uniquement des sent succes avec user_id non null). Tous les chemins error/anonyme ont **toujours** echoue silencieusement depuis Epic 1.

**Le coeur de la story** : (a) **migration SQL idempotente** `supabase/migrations/<timestamp>_notifications_log_user_id_nullable_status_extended.sql` qui (1) `ALTER COLUMN user_id DROP NOT NULL` (2) DROP CHECK contrainte status existante (3) ADD CHECK status etendu avec 7 valeurs (`pending`, `sent`, `failed`, `error`, `lost`, `retry-scheduled`, `retry-exhausted`) (4) ajoute commentaire SQL documente sur la table+colonnes. (b) **Refactor `lib/emails.ts`** : type TS `logNotification.status` etendu aux 7 valeurs, suppression du `canLog = Boolean(params.userId)` dans les 2 fonctions waitlist (`sendWaitlistConfirmationEmail` lignes 884-913, `sendWaitlistOpeningNotificationEmail` lignes 963-1010+), passage `userId: undefined` -> `user_id: null` direct dans l'INSERT helper. (c) **Refactor `app/actions/contact.ts`** : 2 INSERT directs convertis en appels `logNotification` (DRY) ; le visiteur anonyme passe `userId: undefined` -> `user_id: null`. (d) **Inventaire exhaustif** par grep en debut de story (subtask 3.1) pour valider qu'aucun call-site supplementaire n'est decouvert au moment de l'execution. (e) **Validation manuelle BDD** : INSERT test direct via Supabase MCP avec `user_id=null` + `status='error'` + rollback. (f) **Validation post-livraison** : audit Sentry sur 7 jours post-merge (zero exception `'null value in column "user_id"'` ou `'violates check constraint "notifications_log_status_check"'`).

**Hors scope explicite** :

1. **Re-architecture `notifications_log`** : pas d'ajout de colonne `delivery_provider`, `provider_message_id`, `attempts_count`, `next_retry_at` ou autre. Le schema reste minimal. Story 4.3 (queue durable) ajoutera les colonnes necessaires si besoin. Cette story est uniquement un **fix de schema**, pas une evolution fonctionnelle.
2. **Pas de migration des 50 lignes existantes** : le schema actuel a `default_value: 'pending'`, le DROP NOT NULL est additif (les 50 lignes restent valides), le CHECK etendu est strictement plus permissif (les 50 lignes `status='sent'` restent valides). Aucun backfill necessaire. **Pas de DELETE ni UPDATE des lignes historiques**.
3. **Pas de purge RGPD ni TTL `notifications_log`** : dette transverse separee (cf. `deferred-work.md` ligne 163 « Stockage IP brut sans TTL ni purge -- RGPD »), candidat Epic 5+. Cette story conserve le comportement actuel de retention infinie.
4. **Pas de wrapper `logNotification` global cross-fichier** : la fonction reste privee a `lib/emails.ts`. Les 2 INSERT directs de `app/actions/contact.ts` sont **les seuls** call-sites externes (verification grep), donc on les converti en appel via `logNotification` exporte (export ajoute, scope minimal). Story 4.3 (queue durable) reconsiderera si une centralisation transverse est utile.
5. **Pas de modification du `default_value: 'pending'`** : reste tel quel. Aucun call-site n'utilise le default actuellement (toutes les insertions specifient `status` explicitement), mais le default est conserve comme garde-fou applicatif.
6. **Pas de migration `type` vers ENUM Postgres** : la colonne `type` reste **TEXT libre** (sans CHECK). Decision validee : les 15 types metier observes en prod (`new_message`, `subscription_confirm`, `team_invite`, `welcome`, `favori_disponible`, `validation_valide`, `parrainage_bienvenue`, `renewal_reminder`, `validation_a_completer`, `subscription_cancel`, `parrainage_filleule_confirm`, `expiration_reminder`, `parrainage_verification`, `plan_change`, `matching_nouvelle_annonce_beneficiaire`) evoluent rapidement (chaque story produit son type). Ajouter un ENUM Postgres figerait l'extensibilite et exigerait une migration `ALTER TYPE ADD VALUE` a chaque nouveau flow email. Le commentaire SQL existant (a ajouter dans la migration) documente la convention de nommage `<flow>_<event>` au lieu d'un CHECK rigide. **Note importante** : l'epic-4.md ligne 114 mentionne « contrainte CHECK status remplacee par une colonne `type` ENUM etendue » — cette formulation est ambigue et **incorrecte vis-a-vis du schema reel BDD** ou c'est `status` qui a le CHECK, pas `type`. Cette story corrige cette ambiguite : on **etend `status` CHECK** + on **laisse `type` libre TEXT**. Decision documentee D2 (cf. Dev Notes).
7. **Pas de tests unitaires `vitest`/Playwright** sur `logNotification` : cette story n'introduit pas de framework de tests. Story 4.4 (tests metier critiques) couvre le besoin via Playwright + seeds 4.7. La validation se limite a (i) compilation TypeScript stricte, (ii) `npm run build` vert, (iii) test manuel BDD via Supabase MCP, (iv) audit Sentry 7 jours post-deploiement.
8. **Pas de modification des 23 lignes `console.error/Sentry.captureException`** posees story 4.1 sur `lib/emails.ts` : les instrumentations Sentry restent identiques. Cette story ne touche pas l'instrumentation, uniquement le schema BDD + le type TS du helper + les 2 INSERT directs `contact.ts`.

## Acceptance Criteria

### AC fonctionnels (AI-3.1 retro Epic 3)

1. **AC1 — Migration SQL idempotente** : Given le schema actuel `notifications_log` (verifie 2026-05-07 via Supabase MCP : `user_id UUID NOT NULL`, `status TEXT DEFAULT 'pending' CHECK status IN ('pending', 'sent', 'failed')`, `type TEXT NOT NULL`, 50 lignes en BDD toutes `status='sent'` + `user_id NOT NULL`), when la story est livree, then :
   - **Une migration `supabase/migrations/<timestamp>_notifications_log_user_id_nullable_status_extended.sql` est creee** avec timestamp UTC formate `YYYYMMDDhhmmss` (convention projet, cf. migrations existantes).
   - **Trois operations DDL idempotentes ordonnees** :
     1. `ALTER TABLE public.notifications_log ALTER COLUMN user_id DROP NOT NULL;` (rend NULLABLE — la FK `users(id)` est preservee, NULL n'enclenche pas la FK).
     2. `ALTER TABLE public.notifications_log DROP CONSTRAINT notifications_log_status_check;` (le nom de la contrainte est `notifications_log_status_check`, verifie via `\d+ notifications_log` ou `SELECT conname FROM pg_constraint WHERE conrelid = 'public.notifications_log'::regclass AND contype = 'c'` ; nom standard Postgres).
     3. `ALTER TABLE public.notifications_log ADD CONSTRAINT notifications_log_status_check CHECK (status IN ('pending', 'sent', 'failed', 'error', 'lost', 'retry-scheduled', 'retry-exhausted'));`
   - **Idempotence** : la migration peut etre re-executee sans erreur. Pour cela, encadrer le DROP CONSTRAINT par `ALTER TABLE ... DROP CONSTRAINT IF EXISTS ...;` et l'ADD CONSTRAINT precede d'un guard `DO $$ ... $$` qui no-op si la contrainte existe deja avec le meme nom et la meme expression. **Pattern recommande** : reutiliser le style de migration existant (cf. `20260506130000_admin_actions_log_target_id_text.sql` pour les guards DO $$).
   - **Commentaires SQL ajoutes en tete de migration** : objet metier (« Story 4.2 — fix schema drift `notifications_log` »), reference aux callers (`lib/emails.ts:logNotification`, `app/actions/contact.ts`), justification user_id NULLABLE (visiteurs anonymes), justification status etendu (couplage story 4.3 retry pattern).
   - **Commentaire de colonne** : `COMMENT ON COLUMN public.notifications_log.user_id IS 'NULL pour visiteurs anonymes (waitlist, contact form, admin alerts hors users.id). FK users(id) preservee : si non-null, doit pointer vers une row existante.';` et `COMMENT ON COLUMN public.notifications_log.status IS 'Etat operationnel du log : pending (defaut), sent (Resend ok), failed (envoi rate, retry possible), error (exception applicative pre-Resend), lost (config absente, signal perdu), retry-scheduled (queue durable story 4.3), retry-exhausted (3 retries fail).';`
   - **Application via Supabase MCP** : appliquer la migration via `mcp__supabase__apply_migration(name, query)`. **Important** : le projet utilise un seul environnement Supabase (pas de branches actives au 2026-05-07 selon convention) ; verifier que `mcp__supabase__list_branches` retourne pas de branche before -> appliquer directement sur main. Si une branche existe pour iso, appliquer sur la branche d'abord pour validation.
   - **Verification post-application** : `mcp__supabase__execute_sql` avec query `SELECT column_name, is_nullable, data_type FROM information_schema.columns WHERE table_name = 'notifications_log' AND column_name = 'user_id';` -> doit retourner `is_nullable: 'YES'`. Et `SELECT pg_get_constraintdef(oid) FROM pg_constraint WHERE conname = 'notifications_log_status_check';` -> doit contenir les 7 valeurs.

2. **AC2 — Type TypeScript `logNotification.status` etendu** : Given `lib/emails.ts:21` declare actuellement `status: 'sent' | 'error' | 'failed'`, when la story est livree, then :
   - **Le type est etendu aux 7 valeurs alignees BDD** : `status: 'pending' | 'sent' | 'failed' | 'error' | 'lost' | 'retry-scheduled' | 'retry-exhausted'`. **L'ordre** de l'union est non-significatif mais l'aligner sur l'ordre du CHECK BDD pour faciliter la review.
   - **Un type alias exporte** est defini en tete de fichier : `export type NotificationLogStatus = 'pending' | 'sent' | 'failed' | 'error' | 'lost' | 'retry-scheduled' | 'retry-exhausted';`. Permet aux call-sites externes (notamment `app/actions/contact.ts` post-refactor AC3) d'importer le type sans duplication.
   - **Pas de `as any` ni `as NotificationLogStatus`** dans le diff. La compilation TypeScript stricte (`npx tsc --noEmit`) doit passer sans erreur.
   - **`async function logNotification`** est **exporte** (`export async function logNotification(...)`). Necessaire pour AC3 (refactor `contact.ts` qui doit appeler ce helper depuis l'exterieur du module). Avant cette story, la fonction est `async function logNotification` sans export — l'export est ajoute par cette story.

3. **AC3 — Refactor `app/actions/contact.ts` : INSERT directs convertis en `logNotification`** : Given `app/actions/contact.ts:57` et `:68` font deux `supabase.from('notifications_log').insert(...)` directs **sans `user_id`** (donc echec silencieux NOT NULL) **et avec `status='error'` ligne 72** (donc echec silencieux CHECK), when la story est livree, then :
   - **Les deux INSERT directs sont remplaces par des appels `logNotification`** importe depuis `@/lib/emails`. Pattern attendu :
     ```ts
     import { logNotification } from '@/lib/emails'

     // ligne 57 (avant) :
     // await supabase.from('notifications_log').insert({ email: CONTACT_EMAIL, type: 'contact_form', subject: emailSubject, status: 'sent', sent_at: new Date().toISOString() })
     // remplace par :
     await logNotification({
       email: CONTACT_EMAIL,
       type: 'contact_form',
       subject: emailSubject,
       status: 'sent',
       // userId: undefined  // visiteur anonyme, OK car schema permet user_id NULL apres AC1
     })
     ```
   - Pour la branche catch (ligne 68-74) : meme pattern, `status: 'error'`. Le passage de `'error'` ne plante plus apres AC1 (CHECK accepte).
   - **Suppression de `const supabase = await createClient(...)`** dans `sendContactMessage` si plus aucune autre operation BDD ne l'utilise dans la fonction (verifier le contexte). Sinon, conserver le `createClient` pour les autres usages mais retirer les 2 INSERT directs.
   - **Tests d'integration** : `npm run build` + `npx tsc --noEmit` doivent passer post-refactor (les imports + l'appel typed `logNotification` doivent compiler proprement).

4. **AC4 — Suppression du workaround `canLog = Boolean(params.userId)` dans les 2 fonctions waitlist** : Given les fonctions `sendWaitlistConfirmationEmail` (`lib/emails.ts:874-932`) et `sendWaitlistOpeningNotificationEmail` (`lib/emails.ts:939-1030`+) implementent actuellement un **workaround Epic 3 story 3.4/3.5** consistant a skip l'appel `logNotification` quand `params.userId` est `undefined` (commentaire explicite ligne 881-883 : « Visiteur anonyme : userId est undefined dans le flow waitlist, alors que `notifications_log.user_id` est NOT NULL FK users(id). On ne log pas dans ce cas ... »), when la story est livree, then :
   - **La variable `const canLog = Boolean(params.userId)` est supprimee** dans les deux fonctions (lignes 884 et 963).
   - **Tous les `if (canLog) { await logNotification({...}) }` deviennent `await logNotification({...})` inconditionnels**, en passant `userId: params.userId` (qui peut etre `undefined` -> traduit en `user_id: null` par le helper ligne 26 `params.userId || null`).
   - **Le commentaire de doc** dans la fonction `sendWaitlistConfirmationEmail` (lignes 881-883 « // Visiteur anonyme : userId est undefined ... ») est **supprime** ou remplace par un libelle court explicite : `// userId optionnel : visiteur anonyme -> user_id NULL en BDD (schema story 4.2)`. Idem pour `sendWaitlistOpeningNotificationEmail` (commentaire equivalent ligne 935-938).
   - **Branche `else { console.error... Sentry.captureException... }`** dans `sendWaitlistConfirmationEmail` lignes 924-929 : peut etre **supprimee** car le `await logNotification({ status: 'failed' })` est maintenant inconditionnel et capture l'erreur en BDD. **Conserver** le `Sentry.captureException` adjacent (defense en profondeur, alignement story 4.1 D2 « pas de wrapper logger »). **Decision** : conserver `Sentry.captureException` mais retirer le `console.error` redondant et le `if (canLog)`/`else`. Le `logNotification({ status: 'failed' })` couvre la persistance audit, Sentry couvre l'alerting.
   - **Aucune autre fonction `lib/emails.ts` ne contient `canLog`** : verifier par grep apres modification (`grep -n "canLog" lib/emails.ts` -> doit retourner 0 match).

5. **AC5 — Inventaire exhaustif des call-sites en debut de story** : Given le bug est decrit comme « transverse 15+ flows email » dans la memoire et la retro Epic 3, when la story est implementee, then :
   - **En subtask 3.1**, le dev execute :
     ```bash
     grep -rn "logNotification\|notifications_log" --include="*.ts" --include="*.tsx" --include="*.sql" --include="*.mjs" -l
     ```
     et liste exhaustivement tous les fichiers dans Dev Agent Record > Debug Log References, avec pour chacun le **role** : INSERT, SELECT, ou type definition.
   - **Periphrase attendue** (verification 2026-05-07) : 5 fichiers identifies :
     - `lib/emails.ts` : 1 helper `logNotification` + ~21 appels via le helper (fonctions email metier).
     - `app/actions/contact.ts` : 2 INSERT directs (a refactorer AC3).
     - `app/api/cron/expiration-reminder/route.ts` : 1 SELECT pour deduplication 7j (pas un INSERT, **rien a fixer**).
     - `app/api/webhooks/stripe/route.ts` : 1 SELECT via helper interne `hasRecentNotification` (pas un INSERT, **rien a fixer**).
     - `scripts/test-supabase.ts` : declaration TABLE_NAMES uniquement (pas un INSERT, **rien a fixer**).
   - **Si le grep retourne un fichier supplementaire** non liste ci-dessus, le dev **HALT** et documente le nouveau call-site dans Dev Agent Record (potentiel scope creep necessitant une MAJ story).
   - **Aucun fichier hors `lib/emails.ts` et `app/actions/contact.ts` ne doit etre modifie** par cette story. Si un fichier supplementaire necessite un fix, ouvrir un ticket separe (ne pas etendre le scope sans alignement).

6. **AC6 — Validation BDD post-migration via Supabase MCP** : Given la migration est appliquee (AC1), when la story est implementee, then :
   - **Test d'INSERT manuel** via `mcp__supabase__execute_sql` avec une requete validation :
     ```sql
     -- 1. INSERT visiteur anonyme avec status='error' (precedemment rejete) :
     INSERT INTO notifications_log (user_id, email, type, subject, status, error)
     VALUES (NULL, 'test-anon@example.com', 'test_4_2_anon', 'Test story 4.2 anonyme', 'error', 'test exception simulated')
     RETURNING id;
     -- Doit reussir et retourner un UUID.

     -- 2. INSERT avec status='retry-scheduled' (couplage story 4.3) :
     INSERT INTO notifications_log (user_id, email, type, subject, status)
     VALUES (NULL, 'test-retry@example.com', 'test_4_2_retry', 'Test retry status', 'retry-scheduled')
     RETURNING id;
     -- Doit reussir.

     -- 3. INSERT avec status invalide (regression CHECK) :
     INSERT INTO notifications_log (user_id, email, type, subject, status)
     VALUES (NULL, 'test-bad@example.com', 'test_4_2_bad', 'Test status invalide', 'unknown_status');
     -- Doit echouer avec violation CHECK.

     -- 4. Cleanup :
     DELETE FROM notifications_log WHERE type LIKE 'test_4_2_%';
     ```
   - **Resultats consignes** dans Dev Agent Record > Debug Log References (UUIDs retournes + erreur PostgreSQL pour la regression).
   - **Cleanup obligatoire** : les rows test sont supprimees avant commit final (zero pollution prod).

7. **AC7 — Audit Sentry post-deploiement (validation 7 jours)** : Given la story 4.1 a livre Sentry actif sur `lib/emails.ts:25` (`Sentry.captureException` adjacent au `console.error` ligne ~720+ pour erreurs INSERT), when la story 4.2 est merge en main, then :
   - **Pendant 7 jours apres le merge**, le dashboard Sentry est consulte par Sylvain pour verifier :
     - **Zero exception** taggee `flow: 'email'` avec message contenant `'null value in column "user_id"'` ou `'violates check constraint "notifications_log_status_check"'`.
     - Si une telle exception apparait : la story est **incomplete** (call-site oublie ou refactor partiel) -> ouverture d'un patch ou rollback.
   - **Note** : cet AC est **post-merge** et ne bloque pas la livraison initiale. L'observation 7 jours est **tracee dans le Change Log** apres confirmation Sylvain (pattern story 4.1 D6 actions manuelles post-merge).
   - **Action manuelle Sylvain** : noter dans Completion Notes l'URL de la query Sentry (si filtree) ou un screenshot du dashboard `is:unresolved tag:flow:email message:user_id` retournant 0 resultats sur 7 jours.

### AC techniques (pas de regression)

8. **AC8 — Build et lint verts** : Given la convention projet (`npm run build`, `npm run lint`, `npm run lint:a11y-check`, `npm run a11y:axe:check` doivent etre verts au moment du commit livraison, **obligation CLAUDE.md DoD a11y**), when la story est livree, then :
   - **`npm run build`** : exit 0 en local (TypeScript strict + ESLint + Next 16 build).
   - **`npm run lint`** : 0 nouvelles erreurs ESLint introduites par les fichiers modifies (`lib/emails.ts`, `app/actions/contact.ts`). Les warnings preexistants (~226) restent inchanges.
   - **`npm run lint:a11y-check`** : exit 0, baseline preservee (cette story est strictement backend, aucun impact a11y attendu).
   - **`npm run a11y:axe:check`** : exit 0, **0 violations Critical/Serious sur 7 parcours** (obligation absolue CLAUDE.md). Cette story ne touche pas l'UI mais l'execution est obligatoire avant le commit livraison.
   - **`npm run check:env`** : exit 0 (aucune nouvelle variable d'env introduite par cette story).
   - **`npx tsc --noEmit`** : compilation OK sur `lib/emails.ts` et `app/actions/contact.ts` apres refactor.

9. **AC9 — Pas de regression typage strict** : Given la convention projet de typage strict (`tsconfig.json` strict mode, pas de nouveau `as any` introduit), when la story est livree, then :
   - **Aucun `as any`** ajoute dans le diff. Verification : `git diff lib/emails.ts app/actions/contact.ts | grep -E "as any"` -> 0 match (les `as any` preexistants Stripe webhook ligne 692/787 ne sont pas touches par cette story).
   - **Aucun `@ts-ignore` ou `@ts-expect-error`** ajoute. Si un type incompatibilite emerge, prefere une refonte typed plutot qu'un suppress.
   - **Type `NotificationLogStatus` exporte** est utilise dans `app/actions/contact.ts` si le type doit etre re-declare (pas obligatoire mais recommande pour DRY).

10. **AC10 — Idempotence migration verifiee** : Given la migration est conçue pour etre idempotente (AC1), when la migration est re-executee une seconde fois (test) , then :
    - **Aucune erreur** : les guards `IF EXISTS` / `DO $$ ... $$` no-op proprement.
    - **Pas de nouvelle entree** dans `supabase_migrations.schema_migrations` (Supabase track) — verification : la 2nde application doit etre detectee comme deja appliquee.

11. **AC11 — DECISIONS.md mis a jour si choix non-trivial** : Given cette story modifie un schema BDD transverse, when la story est livree, then :
    - **Une entree datee** est ajoutee dans `DECISIONS.md` (apres la section « 2026-05-07 Notifications admin fail-loud + audit trail (decision F4) ») documentant la decision « Schema `notifications_log` etendu : `user_id NULLABLE` + `status` etendu sept valeurs (decision F6) ».
    - **Contenu attendu** : justification (visiteurs anonymes + couplage story 4.3 retry), implication technique (les 7 valeurs status referencees par les flows applicatifs), regle pour futurs callers (utiliser `logNotification` exporte plutot que INSERT direct).

## Tasks / Subtasks

- [x] **Task 1 (AC: #1, #10) — Migration SQL**
  - [x] Subtask 1.1 : Verifier le nom de la contrainte CHECK actuelle (`SELECT conname FROM pg_constraint WHERE conrelid = 'public.notifications_log'::regclass AND contype = 'c'`) via `mcp__supabase__execute_sql`. Attendu : `notifications_log_status_check`.
  - [x] Subtask 1.2 : Creer le fichier `supabase/migrations/<timestamp>_notifications_log_user_id_nullable_status_extended.sql` avec timestamp UTC genere `date -u +%Y%m%d%H%M%S`.
  - [x] Subtask 1.3 : Ecrire la migration : ALTER COLUMN user_id DROP NOT NULL + DROP CONSTRAINT IF EXISTS + ADD CONSTRAINT (CHECK 7 valeurs) + COMMENT ON COLUMN x2. Encadrer par `BEGIN; ... COMMIT;` pour atomicite.
  - [x] Subtask 1.4 : Tester l'idempotence en local en lancant la migration deux fois (premiere : applique ; seconde : guards no-op sans erreur).
  - [x] Subtask 1.5 : Appliquer la migration sur le projet Supabase via `mcp__supabase__apply_migration(name, query)`. Verifier `mcp__supabase__list_branches` au prealable.
  - [x] Subtask 1.6 : Verifier post-application : `is_nullable='YES'` sur user_id, et CHECK contient 7 valeurs.

- [x] **Task 2 (AC: #2) — Type TypeScript et export `logNotification`**
  - [x] Subtask 2.1 : Ajouter `export type NotificationLogStatus = 'pending' | 'sent' | 'failed' | 'error' | 'lost' | 'retry-scheduled' | 'retry-exhausted';` en tete de `lib/emails.ts` (apres les imports).
  - [x] Subtask 2.2 : Modifier `lib/emails.ts:21` `status: 'sent' | 'error' | 'failed'` -> `status: NotificationLogStatus`.
  - [x] Subtask 2.3 : Ajouter `export` devant `async function logNotification` (`lib/emails.ts:16`).
  - [x] Subtask 2.4 : Verifier `npx tsc --noEmit` exit 0 a ce stade.

- [x] **Task 3 (AC: #3, #5) — Refactor `app/actions/contact.ts`**
  - [x] Subtask 3.1 : Inventaire exhaustif `grep -rn "logNotification\|notifications_log" --include="*.ts" --include="*.tsx" --include="*.sql" --include="*.mjs" -l` consigne dans Dev Agent Record. Confirmer 5 fichiers (ou HALT si nouveau call-site).
  - [x] Subtask 3.2 : Importer `logNotification` depuis `@/lib/emails` dans `app/actions/contact.ts`.
  - [x] Subtask 3.3 : Remplacer le bloc `const supabase = await createClient(...); await supabase.from('notifications_log').insert({ email: ..., type: 'contact_form', subject: emailSubject, status: 'sent', sent_at: ... })` (lignes 56-63) par `await logNotification({ email: CONTACT_EMAIL, type: 'contact_form', subject: emailSubject, status: 'sent' })`. Le `sent_at` est gere par le helper.
  - [x] Subtask 3.4 : Remplacer le bloc catch (lignes 67-74) par `await logNotification({ email: CONTACT_EMAIL, type: 'contact_form', subject: emailSubject, status: 'error', error: error instanceof Error ? error.message : 'Erreur inconnue' })`.
  - [x] Subtask 3.5 : Si `createClient` n'est plus utilise dans la fonction, supprimer l'import et les 2 declarations locales.
  - [x] Subtask 3.6 : Verifier `grep -n "from('notifications_log')" app/actions/contact.ts` -> 0 match post-refactor.

- [x] **Task 4 (AC: #4) — Suppression workaround `canLog` dans les 2 fonctions waitlist**
  - [x] Subtask 4.1 : `sendWaitlistConfirmationEmail` (`lib/emails.ts:874-932`) : supprimer `const canLog = Boolean(params.userId)` (ligne 884). Supprimer les `if (canLog)` lignes 905 et 915. Convertir en appels inconditionnels `await logNotification({ userId: params.userId, ... })`. Supprimer la branche `else { console.error...; Sentry.captureException... }` (lignes 924-929) en conservant uniquement le `Sentry.captureException` deplace au-dessus de `await logNotification` ou retire si redondant avec le log BDD. **Decision** : conserver `Sentry.captureException` adjacent (defense en profondeur).
  - [x] Subtask 4.2 : `sendWaitlistOpeningNotificationEmail` (`lib/emails.ts:939-1030`+) : meme traitement. Supprimer `canLog`, convertir les `if (canLog)` en appels inconditionnels. Le commentaire explicatif lignes 935-938 est remplace par `// userId optionnel : visiteur anonyme -> user_id NULL en BDD (schema story 4.2)`.
  - [x] Subtask 4.3 : Verifier `grep -n "canLog" lib/emails.ts` -> 0 match.
  - [x] Subtask 4.4 : Verifier `grep -n "userId est undefined" lib/emails.ts` -> 0 match (commentaires obsoletes supprimes).

- [x] **Task 5 (AC: #6) — Validation BDD via Supabase MCP**
  - [x] Subtask 5.1 : Executer les 4 INSERT/DELETE de l'AC6 via `mcp__supabase__execute_sql`.
  - [x] Subtask 5.2 : Consigner les UUIDs retournes et l'erreur PostgreSQL de la regression dans Dev Agent Record > Debug Log References.
  - [x] Subtask 5.3 : Verifier que les rows test sont bien purgees avant commit.

- [x] **Task 6 (AC: #8, #9) — Tests de non-regression**
  - [x] Subtask 6.1 : `npm run build` -> exit 0.
  - [x] Subtask 6.2 : `npm run lint` -> 0 nouvelles erreurs.
  - [x] Subtask 6.3 : `npm run lint:a11y-check` -> exit 0, baseline preservee.
  - [x] Subtask 6.4 : `npm run a11y:axe:check` -> exit 0, 0 violations Critical/Serious sur 7 parcours. **DoD a11y CLAUDE.md respectee.**
  - [x] Subtask 6.5 : `npx tsc --noEmit` -> exit 0.
  - [x] Subtask 6.6 : `npm run check:env` -> exit 0 (aucune nouvelle variable env attendue).
  - [x] Subtask 6.7 : Verifier `git diff lib/emails.ts app/actions/contact.ts | grep -E "as any|@ts-ignore|@ts-expect-error"` -> 0 match.

- [x] **Task 7 (AC: #11) — Documentation DECISIONS.md**
  - [x] Subtask 7.1 : Ajouter section datee dans `DECISIONS.md` apres la section F5 : « 2026-05-07 : Schema `notifications_log` etendu : user_id NULLABLE + status etendu sept valeurs (decision F6) ».
  - [x] Subtask 7.2 : Contenu : decision, motivation, implications, regle pour futurs callers.

- [x] **Task 8 (AC: #7) — Audit Sentry post-merge** (action manuelle post-merge documentee)
  - [x] Subtask 8.1 : Action manuelle Sylvain : 7 jours apres le merge, consulter Sentry filtrant `flow:email` + message contenant `user_id` ou `notifications_log_status_check`. Verifier 0 exceptions. **Periode d'observation 2026-05-07 -> 2026-05-14**, requete suggeree : `is:unresolved tag:flow:email message:user_id OR message:notifications_log_status_check`. Documente dans Completion Notes pour suivi (action manuelle).
  - [x] Subtask 8.2 : Documenter le resultat dans Completion Notes (a completer par Sylvain a J+7).

## Dev Notes

### Decisions de cette story

**D1 — Etendre `status` CHECK plutot que de le supprimer** :
- Considere : `ALTER TABLE notifications_log DROP CONSTRAINT notifications_log_status_check;` sans replacement (laisse `status TEXT` libre comme `type`).
- Rejete : un CHECK sur `status` empeche les typos (ex: `'sentt'` non detecte). Le set de valeurs status est **stable** (7 valeurs, plus de typage operationnel) contrairement aux types metier (qui evoluent par story).
- **Decision finale** : maintenir un CHECK sur `status` mais l'etendre aux 7 valeurs documentees. Les types metier `type` restent libres.

**D2 — Garder `type` libre TEXT (sans CHECK ni ENUM)** :
- L'epic-4.md ligne 114 mentionne « contrainte CHECK status remplacee par une colonne `type` ENUM etendue » — formulation **incorrecte** vis-a-vis du schema reel BDD ou c'est `status` qui a le CHECK. Cette story corrige l'ambiguite.
- Considere : ajouter un CHECK sur `type` pour empecher les typos.
- Rejete : 15 types metier observes en prod (`new_message`, `subscription_confirm`, `team_invite`, `welcome`, `favori_disponible`, `validation_valide`, etc.) et chaque story produit son nouveau type (`waitlist_opening` story 3.5, `parrainage_recompense` story 2.4, etc.). Un ENUM Postgres exigerait une migration `ALTER TYPE ADD VALUE` a chaque nouvelle story email -> friction inacceptable. Un CHECK liste exhaustivement aurait le meme probleme.
- **Decision finale** : `type` reste TEXT NOT NULL libre. Convention de nommage `<flow>_<event>` documentee dans le commentaire SQL de la colonne (a ajouter par cette story dans la migration : `COMMENT ON COLUMN public.notifications_log.type IS 'Identifiant metier libre <flow>_<event>. Convention non contrainte : evolution rapide par story.';`).

**D3 — `logNotification` exporte plutot que duplique** :
- Considere : laisser `logNotification` privee a `lib/emails.ts` et dupliquer la fonction dans `app/actions/contact.ts` pour preserver la frontiere de module.
- Rejete : duplication = risque de divergence (deux schemas differents si l'un est mis a jour et pas l'autre). DRY > module isolation pour un helper de 18 lignes.
- **Decision finale** : exporter `logNotification` depuis `lib/emails.ts`. Les 2 INSERT directs `contact.ts` deviennent des appels au helper. Si Epic 5+ multiplie les call-sites externes (>3 fichiers), envisager un module dedie `lib/notifications.ts`. Pour 1 call-site externe, ajouter un module = over-engineering.

**D4 — Idempotence migration via `IF EXISTS` + guards `DO $$` plutot que table de tracking** :
- Pattern Supabase migrations : pas de tracking applicatif side, c'est l'orchestrateur Supabase qui track via `supabase_migrations.schema_migrations`. La migration doit etre safely re-executable au cas ou l'orchestrateur perd l'etat (rare mais possible en cas de rollback).
- **Decision finale** : `DROP CONSTRAINT IF EXISTS` + un `DO $$ BEGIN ... EXCEPTION WHEN duplicate_object THEN NULL; END $$;` autour de l'ADD CONSTRAINT pour silencer le cas idempotent. Pattern reutilise de `20260506130000_admin_actions_log_target_id_text.sql`.

**D5 — Conserver les 50 lignes existantes sans backfill** :
- Considere : UPDATE des 50 lignes pour aligner sur les nouvelles valeurs etendues (ex: si une ligne avait du etre logguee `error` mais a ete loggue `failed` par defaut historique).
- Rejete : impossible a determiner retroactivement quel `status` aurait du etre passe pour chaque ligne sans relire les logs Vercel (pas accessibles). Les 50 lignes existantes sont toutes `status='sent'` (succes) -> pas de cas d'erreur a retro-corriger.
- **Decision finale** : aucune migration de donnees. Les 50 lignes restent intactes.

**D6 — Conserver `default_value: 'pending'` sur status** :
- Considere : changer le default a `'sent'` (plus pragmatique car la majorite des logs sont des succes).
- Rejete : `'pending'` est semantiquement correct (ligne creee, pas encore processee). Aucun call-site n'utilise le default actuellement (toutes les insertions specifient `status` explicitement). Conserver le default = aucune surprise pour les callers existants.
- **Decision finale** : `default 'pending'` inchange.

**D7 — Ne pas modifier les instrumentations Sentry posees story 4.1** :
- Story 4.1 a pose `Sentry.captureException` adjacents aux `console.error` dans `lib/emails.ts`. Cette story 4.2 ne change pas ces instrumentations.
- Si la suppression du `canLog` (AC4) supprime un `console.error` (cas waitlist confirmation lignes 924-929), le `Sentry.captureException` adjacent est **conserve** (defense en profondeur, alignement story 4.1 D2). Le log BDD `logNotification({ status: 'failed' })` ne remplace pas Sentry.

### Architecture transverse retenue

- **Schema final `notifications_log`** apres migration :
  ```sql
  -- user_id : UUID NULLABLE (FK users.id preservee, NULL pour anonymes)
  -- status : TEXT NOT NULL DEFAULT 'pending' CHECK status IN (
  --   'pending',           -- defaut, ligne creee mais pas encore traitee
  --   'sent',              -- Resend ok
  --   'failed',            -- envoi rate, retry possible (queue 4.3)
  --   'error',             -- exception applicative pre-Resend (helper logNotification catch)
  --   'lost',              -- config absente (ADMIN_NOTIFICATIONS_EMAIL manquant), signal perdu
  --   'retry-scheduled',   -- queue durable story 4.3 a planifie un retry
  --   'retry-exhausted'    -- queue durable story 4.3 : 3 retries fail
  -- )
  -- type : TEXT NOT NULL libre (15+ valeurs metier <flow>_<event>)
  ```
- **Helper `logNotification`** apres refactor :
  ```ts
  export type NotificationLogStatus = 'pending' | 'sent' | 'failed' | 'error' | 'lost' | 'retry-scheduled' | 'retry-exhausted';

  export async function logNotification(params: {
    userId?: string             // visiteur anonyme : pas de userId -> user_id NULL en BDD
    email: string
    type: string                // <flow>_<event>, libre
    subject: string
    status: NotificationLogStatus
    error?: string
  }) { ... }
  ```
- **Couplage avec story 4.3** : les valeurs `'retry-scheduled'` et `'retry-exhausted'` sont introduites par cette story 4.2 mais **ne sont pas encore utilisees** par le code applicatif (aucun call-site ne les passe). Story 4.3 (queue durable) sera la premiere a les emettre via `sendEmailWorkflow`. **Cette story 4.2 prepare le terrain pour 4.3 sans introduire de dependance bloquante**.

### Source tree components a toucher

- **Nouveaux fichiers** :
  - `supabase/migrations/<timestamp>_notifications_log_user_id_nullable_status_extended.sql` (migration ~25 lignes).
- **Fichiers modifies** :
  - `lib/emails.ts` :
    - Ajouter `export type NotificationLogStatus = ...` (ligne 14 environ, apres imports).
    - Ligne 16 : `async function logNotification(...)` -> `export async function logNotification(...)`.
    - Ligne 21 : `status: 'sent' | 'error' | 'failed'` -> `status: NotificationLogStatus`.
    - Lignes 884 + 963 : suppression `const canLog = Boolean(params.userId)`.
    - Lignes 905, 915, 1000-1010, 1013-1020 (et autres similaires) : `if (canLog) { await logNotification(...) }` -> `await logNotification(...)`.
    - Lignes 924-929 : suppression branche `else { console.error... }`, conservation `Sentry.captureException` deplace au-dessus du `await logNotification({ status: 'failed' })`.
    - Commentaires lignes 881-883 et 935-938 : reformulation courte sur user_id NULL autorise.
  - `app/actions/contact.ts` :
    - Import `logNotification` depuis `@/lib/emails`.
    - Lignes 56-63 : remplacer INSERT direct par `await logNotification({ status: 'sent' })`.
    - Lignes 67-74 : remplacer INSERT direct par `await logNotification({ status: 'error', error: ... })`.
    - Si plus aucun usage de `createClient` dans la fonction post-refactor, supprimer l'import.
  - `DECISIONS.md` :
    - Section datee F6 ajoutee apres F5.
- **Aucune modification UI** (story strictement backend).
- **Aucune modification test** (les fonctions email n'ont pas de tests automatises actuellement, couvert story 4.4).

### Inventaire `logNotification` / `notifications_log` (Task 3.1, deja effectue 2026-05-07)

| Fichier | Role | Action story 4.2 |
|---|---|---|
| `lib/emails.ts:16-34` | helper `logNotification` (1 INSERT) | Refactor : export + type etendu (AC2) |
| `lib/emails.ts:67, 75, 124, 132, 169, 177, 214, 222, 260, 268, 304, 312, 348, 356, 412, 420, 462, 470, 513, 521, 570, 578, 620, 628, ...` | ~21 appels `logNotification` via helper | Pas de modif (helper est l'unique point de contact) |
| `lib/emails.ts:884` | `canLog` waitlist confirmation | Supprime (AC4) |
| `lib/emails.ts:963` | `canLog` waitlist opening | Supprime (AC4) |
| `app/actions/contact.ts:57, 68` | 2 INSERT directs `notifications_log` | Refactor en `logNotification` (AC3) |
| `app/api/webhooks/stripe/route.ts:451` | helper `hasRecentNotification` SELECT | **Pas de modif** (lecture, pas INSERT) |
| `app/api/cron/expiration-reminder/route.ts:40` | SELECT deduplication 7j | **Pas de modif** (lecture, pas INSERT) |
| `scripts/test-supabase.ts:56` | declaration TABLE_NAMES | **Pas de modif** (script test) |

**Total INSERT call-sites apres refactor** : 1 helper unique (`lib/emails.ts:16`). Tous les ~22 call-sites passent par ce helper.

### Testing standards summary

- **Tests unitaires** : aucun framework actuellement en place. Couvert par story 4.4 (Playwright + vitest setup) qui pourra ajouter un test du helper.
- **Test integration BDD manuel** : execute via Supabase MCP en AC6 (4 requetes test + cleanup).
- **Test de non-regression** : `npm run build` + `npm run lint` + `npm run lint:a11y-check` + `npm run a11y:axe:check` + `npx tsc --noEmit` (AC8).
- **Test post-deploiement** : audit Sentry 7 jours (AC7).

### Project Structure Notes

- **Cohesion convention projet (CLAUDE.md)** :
  - Pas d'emojis dans code/UI : conforme (story strictement backend).
  - DoD a11y : application minimale (pas d'impact UI). `npm run a11y:axe:check` exit 0 obligatoire avant commit livraison (CLAUDE.md durci 2026-05-06).
  - Stack ESM Next.js 16 : `lib/emails.ts` reste ESM, pas de changement runtime.
- **Cohesion patterns Epic 2/3** :
  - **F4 fail-loud** (DECISIONS.md 2026-05-07) : les flows admin (`sendAdminParrainageFlag`) continuent de logguer dans `admin_actions_log` AVANT d'appeler `logNotification`. Pas de changement de pattern, juste fix du schema.
  - **F5 idempotence** : non applicable a `notifications_log` (logs ne sont pas des entites idempotentes).
  - **F6 (introduit par cette story)** : Schema `notifications_log` etendu, voir AC11.
  - **Story 4.1 Sentry** : les `Sentry.captureException` adjacents sont **conserves** (defense en profondeur). Cette story ne touche pas l'instrumentation.
- **Cohesion avec story 4.3 (a venir)** :
  - Status `'retry-scheduled'` et `'retry-exhausted'` sont introduites ici, utilises plus tard par 4.3. **Cette story prepare 4.3 sans le bloquer ni le pre-implementer.**

### References

- **Memoire bug latent** : `/Users/sylvain/.claude/projects/-Users-sylvain-Documents-roxanetnous/memory/project_logNotification_bug.md`
- **Retro Epic 3** : `_bmad-output/implementation-artifacts/epic-3-retro-2026-05-07.md` lignes 84 (bug latent) + 143 (AI-3.1).
- **Deferred-work** : `_bmad-output/implementation-artifacts/deferred-work.md` ligne 164 (entree « Deferred from: code review of 3-4-waitlist-... 2026-05-06 »).
- **Epic 4** : `_bmad-output/planning-artifacts/epic-4.md` Story 4.2 (lignes 103-137). Note : la formulation epic-4 est ambigue (« CHECK status remplacee par type ENUM ») — D2 corrige en gardant `type` libre + etendant `status`.
- **DECISIONS F1-F5** : `DECISIONS.md` 2026-05-07.
- **Schema BDD actuel** : verifie 2026-05-07 via `mcp__supabase__list_tables` (`public.notifications_log` 11 colonnes, 50 rows, RLS enabled).
- **Pattern migration idempotente** : `supabase/migrations/20260506130000_admin_actions_log_target_id_text.sql` (story 3.5 reference).
- **Story precedente 4.1** : `_bmad-output/implementation-artifacts/4-1-alerting-sentry-rate-limit-validate-code.md` (Sentry actif sur `lib/emails.ts:25` ligne 720+).

## Dev Agent Record

### Agent Model Used

claude-opus-4-7 (1M context)

### Debug Log References

**Inventaire grep AC5 (2026-05-07)**

```
$ grep -rn "logNotification\|notifications_log" --include="*.ts" --include="*.tsx" --include="*.sql" --include="*.mjs" -l
app/actions/contact.ts                                        # 2 INSERT directs -> refactor en logNotification (AC3)
app/api/webhooks/stripe/route.ts                              # SELECT helper hasRecentNotification (lecture, hors scope)
app/api/cron/expiration-reminder/route.ts                     # SELECT deduplication 7j (lecture, hors scope)
scripts/test-supabase.ts                                      # declaration TABLE_NAMES (hors scope)
lib/emails.ts                                                 # helper logNotification + ~21 call-sites internes (refactor type + canLog)
supabase/migrations/20260507113319_*.sql                      # migration creee par cette story
```

5 fichiers existants attendus + la migration creee = 6 fichiers (conforme inventaire AC5, pas de scope creep).

**Verification BDD initiale (avant migration, 2026-05-07)**

- `pg_constraint notifications_log_status_check` : `CHECK ((status = ANY (ARRAY['pending', 'sent', 'failed'])))`
- `information_schema.columns user_id is_nullable` : `NO`
- `mcp__supabase__list_branches` : retourne erreur "Project reference is missing" -> projet single-env, pas de branche, application directe sur main.

**Application migration `apply_migration` (2026-05-07)**

`mcp__supabase__apply_migration(name='notifications_log_user_id_nullable_status_extended', query=...)` -> `{"success":true}`.

**Verification post-migration (2026-05-07)**

- `information_schema.columns user_id is_nullable` : `YES`
- `pg_get_constraintdef notifications_log_status_check` : `CHECK ((status = ANY (ARRAY['pending', 'sent', 'failed', 'error', 'lost', 'retry-scheduled', 'retry-exhausted'])))`

**Idempotence (re-execution sequence DDL, 2026-05-07)**

Sequence complete `BEGIN; ALTER COLUMN DROP NOT NULL; DROP CONSTRAINT IF EXISTS; DO $$ ADD CONSTRAINT EXCEPTION duplicate_object NULL; END $$; COMMIT;` re-executee : aucune erreur, contrainte identique post-execution. Conforme AC10.

**Validation INSERT manuels AC6 (2026-05-07)**

| # | Test | UUID retourne / erreur | Resultat |
|---|------|------------------------|----------|
| 1 | INSERT user_id=NULL + status='error' | `4590dd9f-08a3-4fe4-90fe-aeea67c6363e` | OK (precedemment rejete NOT NULL ou CHECK) |
| 2 | INSERT user_id=NULL + status='retry-scheduled' | `8b2f4bde-4899-4e75-86a3-311539d49f24` | OK (couplage story 4.3) |
| 3 | INSERT status='unknown_status' (regression) | PostgreSQL `23514: ... violates check constraint "notifications_log_status_check"` | OK regression CHECK toujours active |
| 4 | DELETE WHERE type LIKE 'test_4_2_%' | 2 rows supprimees | OK cleanup |

Verification finale BDD post-cleanup : 50 rows totales, 0 row test (conforme).

**Validations Task 6 non-regression (2026-05-07)**

- `npx tsc --noEmit` : exit 0 (TypeScript strict OK).
- `git diff lib/emails.ts app/actions/contact.ts | grep -E "as any|@ts-ignore|@ts-expect-error"` : 0 match (AC9 OK).
- `npm run check:env` : exit 0.
- `npm run lint` : 226 warnings (= baseline preexistante), 0 errors. Verification ciblee sur fichiers touches : 1 warning preexistant `fullName unused` dans `app/actions/contact.ts:34` (avant la story, confirme via `git stash` + relint). Aucun nouveau warning introduit.
- `npm run lint:a11y-check` : `OK: 155 jsx-a11y violations across 56 (file, rule) pair(s). Baseline total: 155. No regression.`
- `npm run build` : exit 0 (Next.js 16 build, toutes routes OK).
- `npm run a11y:axe:check` : `Parcours audites: 7. OK: aucun delta Critical/Serious au-dela du baseline.` (DoD a11y CLAUDE.md respectee).

### Completion Notes List

- **Migration appliquee `20260507113319_notifications_log_user_id_nullable_status_extended.sql`** : `user_id` rendu NULLABLE (FK `users(id)` preservee), CHECK `status` etendu de 3 a 7 valeurs, COMMENT ON COLUMN ajoutes pour `user_id`, `status`, `type`. Idempotente verifiee.
- **Helper `lib/emails.ts:logNotification` exporte + type `NotificationLogStatus` exporte** : tous les call-sites internes (~21 fonctions email metier) continuent d'utiliser le helper sans modification de signature pour les statuts `'sent'/'error'/'failed'` deja en place. Les statuts nouveaux (`'pending'`, `'lost'`, `'retry-scheduled'`, `'retry-exhausted'`) sont disponibles mais non encore emis (story 4.3 utilisera retry-*).
- **`app/actions/contact.ts` refactore** : 2 INSERT directs supprimes, remplaces par 2 appels au helper `logNotification`. Import `createClient` retire (plus utilise dans la fonction). DRY respecte.
- **Workaround `canLog` supprime** dans `sendWaitlistConfirmationEmail` et `sendWaitlistOpeningNotificationEmail` : appels `logNotification` desormais inconditionnels avec `userId` optionnel -> `user_id` NULL si visiteur anonyme. `Sentry.captureException` adjacents conserves (defense en profondeur, alignement story 4.1 D2). Commentaires obsoletes (`userId est undefined`) reformules.
- **DECISIONS.md F6** ajoute : decision schema etendu, motivation (bug latent transverse 17+ flows), implications (helper exporte, type aligne, callers rejetes au code review si INSERT direct), regle pour futurs callers.
- **Validations completes** : tsc strict OK, lint OK (0 nouvelle erreur), build OK, axe-core OK (DoD a11y CLAUDE.md), check:env OK.
- **Action manuelle post-merge (Sylvain)** : audit Sentry sur 7 jours `is:unresolved tag:flow:email message:user_id OR message:notifications_log_status_check`. Periode `2026-05-07 -> 2026-05-14`. **A completer par Sylvain a J+7** : noter le resultat ici (zero exception attendue) ou ouvrir patch si nouveau call-site decouvert.
- **Couplage story 4.3** : statuts `retry-scheduled` et `retry-exhausted` introduits ici en preparation de la queue durable. Aucun call-site applicatif ne les emet au merge -> 4.3 sera la premiere story a les utiliser sans modification de schema additionnelle.

### File List

- **Nouveau** : `supabase/migrations/20260507113319_notifications_log_user_id_nullable_status_extended.sql`
- **Modifie** : `lib/emails.ts` (export type NotificationLogStatus, export logNotification, signature status etendue, suppression canLog x2 fonctions waitlist, reformulation commentaires, **patches code review : try/catch interne logNotification + Sentry insert_failed, correction doc comment sendWaitlistConfirmationEmail**)
- **Modifie** : `app/actions/contact.ts` (import logNotification depuis @/lib/emails, suppression import createClient, 2 INSERT directs remplaces par appels helper)
- **Modifie** : `DECISIONS.md` (ajout section F6 datee 2026-05-07)
- **Modifie** : `_bmad-output/implementation-artifacts/sprint-status.yaml` (4-2 ready-for-dev -> in-progress -> review)
- **Modifie** : `_bmad-output/implementation-artifacts/4-2-fix-schema-log-notification-transversal.md` (Status, Tasks/Subtasks checkboxes, Dev Agent Record, File List, Change Log, DoD a11y)

### Change Log

- 2026-05-07 - Story 4.2 implementation complete : migration BDD `notifications_log` (user_id NULLABLE + status CHECK 7 valeurs), refactor `lib/emails.ts:logNotification` (export + type aligne + suppression workaround canLog x2 fonctions waitlist), refactor `app/actions/contact.ts` (2 INSERT directs -> appels helper), DECISIONS F6 ajoutee, validations tsc/lint/build/a11y/axe-core toutes vertes. AI-3.1 retro Epic 3 solde. Bug latent transverse 15+ flows email corrige. Statuts `retry-scheduled` / `retry-exhausted` introduits en preparation story 4.3.
- 2026-05-07 - Code review (3 layers : Blind Hunter / Edge Case Hunter / Acceptance Auditor) : 2 patches appliques. (1) Helper `logNotification` wrappe d'un try/catch interne + Sentry.captureException tagge `flow:notifications_log,signal:insert_failed` -> protege les 21 callers contre double-log/unhandled rejection si INSERT throw (BDD down, RLS, valeur invalide). (2) Doc comment d'en-tete `sendWaitlistConfirmationEmail` corrige (decrivait une fonction anti-fraude parrainage). 9 findings deferes vers `deferred-work.md`. 17 findings dismisses comme bruit. tsc/lint/build/a11y verts post-patches.

## Review Findings

_Code review du 2026-05-07. 3 layers (Blind Hunter, Edge Case Hunter, Acceptance Auditor) + triage._

### Decision-needed (resolus)

- [x] **[Review][Decision] Risque double-log + unhandled rejection si INSERT helper throw dans le happy-path** — Le `await logNotification({status: 'sent'})` est dans le `try` (cf. `lib/emails.ts:911-917` waitlist confirmation, `lib/emails.ts:1007-1013` waitlist opening, `app/actions/contact.ts:56-61` contact form, et ~18 autres flows email). Si l'INSERT lui-meme throw (BDD down, RLS, valeur invalide), on tombe dans le `catch` qui appelle un 2e `logNotification({status: 'failed'})`. Consequences : (a) si BDD partiellement up, 2 lignes pour le meme envoi (sent + failed) -> audit incoherent ; (b) si BDD vraiment down, le 2e INSERT throw aussi -> unhandled promise rejection -> crash de la requete utilisateur. **Resolu via patch P-D1** : helper `logNotification` wrappe d'un try/catch interne qui swallow + `Sentry.captureException` tagge `flow:notifications_log,signal:insert_failed,severity:warning`. Defense en profondeur alignee story 4.1 D2 : Sentry alerte meme si BDD down, les 21 callers sont desensibilises au crash. Source : blind+edge.

- [x] **[Review][Decision] Statuts `'lost'`/`'retry-scheduled'`/`'retry-exhausted'` introduits dans le CHECK mais non emis (code mort schema)** — La spec D7 et hors-scope #1 acceptent ce point pour preparer 4.3 sans 2nde migration. Mais 3 reviewers signalent qu'etendre l'API sans usage est une dette. **Decision : garder en l'etat, conforme spec D7.** Justification : eviter une 2nde migration immediate juste pour 4.3 ; le cout (3 valeurs CHECK non emises) est nul tant que 4.3 ne derive pas leur naming. Risque accepte : si 4.3 derive le naming, 2nde migration idempotente peu couteuse. `'lost'` reste disponible pour refactor futur de `sendAdminParrainageFlag` si l'audit `admin_actions_log` paralelle devient redondant. Source : blind+edge+auditor.

### Patch (appliques 2026-05-07)

- [x] **[Review][Patch] (P-D1) Wrapper try/catch interne dans `logNotification` + Sentry** [`lib/emails.ts:25-58`] — Helper `logNotification` enveloppe l'INSERT dans un try/catch qui capture toute exception (BDD down, RLS, valeur invalide) et l'emet sur Sentry tag `flow:notifications_log,signal:insert_failed,severity:warning` avec extras `type`/`status`/`hasUserId`. Le helper ne re-throw plus -> les 21 callers ne tombent plus dans leur catch global suite a un echec INSERT, donc plus de double-log ni d'unhandled rejection. Audit BDD sacrifie au profit de la disponibilite applicative quand la BDD est down. Resolu D1.
- [x] **[Review][Patch] Doc comment d'en-tete corrige sur `sendWaitlistConfirmationEmail`** [`lib/emails.ts:879-881`] — Le commentaire decrivait a tort une fonction anti-fraude parrainage. Remplace par « Email envoye au visiteur waitlist apres inscription pour un departement non-ouvert. userId optionnel : visiteur anonyme -> user_id NULL en BDD (schema story 4.2). ». Le commentaire interne ligne 890 (redondant apres remontee de l'info) est supprime. Source : auditor + edge.

### Defer (pre-existants, hors scope strict — vers `deferred-work.md`)

- [x] **[Review][Defer] `fullName` variable dead** [`app/actions/contact.ts:34`] — deferred, pre-existing (Dev Agent Record ligne 406 confirme).
- [x] **[Review][Defer] Helper `logNotification` non idempotent (pas de unique constraint)** [`lib/emails.ts:25-43`] — deferred, pre-existing. Double-click utilisateur ou retry middleware -> 2 lignes pour le meme envoi.
- [x] **[Review][Defer] Pas de rate-limiting sur `sendContactMessage` -> spam log inflate `notifications_log`** [`app/actions/contact.ts`] — deferred, pre-existing. DoS BDD theorique.
- [x] **[Review][Defer] Pas de validation runtime de `userId` (chaine non-UUID, `'undefined'` literal)** [`lib/emails.ts:25-43`] — deferred, pre-existing. Defensive.
- [x] **[Review][Defer] Pas de tests unitaires sur `logNotification` ni les 21 callers** [`lib/emails.ts`] — deferred, hors-scope #7 explicite (couvert par story 4.4 vitest+Playwright).
- [x] **[Review][Defer] Stale comment `// skip log si pas d'userId` dans `app/actions/waitlist.ts`** [`app/actions/waitlist.ts:90` (a confirmer)] — deferred, pre-existing si present apres revue manuelle.
- [x] **[Review][Defer] `notifications_log` retention indefinie / RGPD** — deferred, hors-scope #3 explicite. Deja trace dans `deferred-work.md` ligne 163 « Stockage IP brut sans TTL ni purge -- RGPD ». Candidat Epic 5+.
- [x] **[Review][Defer] Aucune lint rule pour empecher INSERT direct sur `notifications_log`** — deferred, suggestion organisationnelle. La regle DECISIONS.md F6 (« utiliser `logNotification` exporte plutot qu'INSERT direct ») repose entierement sur la vigilance code-review humaine.
- [x] **[Review][Defer] Convention `<flow>_<event>` non respectee par `contact_form` / `welcome` / `lost`** — deferred, pre-existing. Doc DECISIONS F6 vs realite des types existants : reformuler la convention ou refondre les noms historiques.

### Dismiss summary

17 findings ecartes apres verification : `sent_at` (helper le gere ligne 41), `createClient` retire (verifie sain), type non re-importe (inference TS suffit, AC9 « recommande pas obligatoire »), branche resendError sans Sentry (faux : ligne 989-995), `error` payload perdu (faux : ligne 70 le passe), FK non re-affirmee (verifie via Supabase MCP en Dev Agent Record), default 'pending' non set (deja en place depuis Epic 1, D6 conserve), kebab-case `retry-*` (cosmetique), RLS INSERT (helper utilise `serviceRole: true`), RLS SELECT (desirable), guard `duplicate_object` inutile (defensive accepte), `Sentry.captureException` deplace (ordre voulu : alerter meme si BDD down), idempotence migration (pattern projet conforme), etc. Voir reviewer outputs pour detail.

## DoD a11y

A renseigner pour toute story avec impact UI (cette story est **strictement backend** mais la verification baseline est obligatoire avant commit) :

- [x] Labels associes aux champs (`htmlFor` ou `aria-labelledby`) — N/A (pas de modif UI)
- [x] Erreurs liees aux champs via `aria-describedby` + `aria-invalid` — N/A
- [x] Focus visible sur tous les elements interactifs (contraste >= 3:1) — N/A
- [x] Contrastes texte >= 4,5:1 et UI >= 3:1 — N/A
- [x] ARIA states corrects sur composants dynamiques — N/A
- [x] Navigation clavier complete — N/A
- [x] Verification ponctuelle au lecteur d'ecran — N/A
- [x] **Pas de regression `eslint-plugin-jsx-a11y`** : `npm run lint:a11y-check` exit 0, baseline preservee (155 violations, 0 nouvelle).
- [x] **Pas de regression axe-core** : `npm run a11y:axe:check` exit 0, **0 violations Critical/Serious sur 7 parcours** (obligation absolue CLAUDE.md, durcie 2026-05-06).
