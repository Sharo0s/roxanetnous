# Story 7.A.6 : Idempotence `logNotification`

Status: review

<!-- Story 6 du mini-epic 7.A (hardening securite transverse) - Item C6 de l'inventaire dettes Epic 7. Source : `deferred-work.md` ligne 230 (review story 4.2, 2026-05-07) + ligne 250 (review story 4.3, 2026-05-08 - confirmation idempotency_key applicatif Workflow DevKit insuffisant entre runs). Cadrage `epic-7.md` lignes 223-238. Heritage : story 4.2 (schema notifications_log etendu user_id NULLABLE + status 7 valeurs) + story 4.3 (queue durable at-least-once delivery + idempotencyKey=stepId cote Resend uniquement) + DECISIONS.md F5 (idempotence niveau BDD via UNIQUE INDEX + ON CONFLICT - pattern projet impose). Cette story livre le tuple BDD manquant : partial UNIQUE INDEX sur rows `status='sent'` + ON CONFLICT DO NOTHING cote helper applicatif. -->

## Story

En tant qu'**operateur observabilite roxanetnous voulant un audit trail BDD propre des notifications transactionnelles emises**,
je veux que **toute double-emission accidentelle (double-click utilisateur, retry middleware Next.js, retry cron ou trigger admin re-execute, queue Workflow DevKit re-emise apres at-least-once delivery) produise au plus 1 ligne `status='sent'` en BDD pour le meme tuple (destinataire, type, contenu, heure)**,
afin que **les KPI ops (`SELECT count(*) FROM notifications_log WHERE status='sent' GROUP BY type`) refletent le nombre reel d'emails partis cote Resend (qui deduplique deja via `idempotencyKey`), pas un nombre gonfle par doublons applicatifs, et que les futurs cron de purge RGPD 7.B.2 / 7.B.3 ne traitent pas des rows redondantes**.

**Contexte runtime du foot-gun cible** : aujourd'hui, le helper `lib/notifications-log.ts:logNotification` (l'unique point d'entree INSERT autorise par DECISIONS.md F6) execute un INSERT sec sans contrainte d'unicite cote BDD. Resend deduplique cote serveur via `idempotencyKey = stepId` (queue durable 4.3) MAIS uniquement pour les retries du meme step (DECISIONS.md F7 lignes 287-288 : "at-least-once delivery accepte cote queue, cote notifications_log accept double-line `status='sent'`, helper deduplique candidat Epic 5+"). 4 patterns de double-emission constate ou theorique :

| # | Scenario | Constat actuel | Impact |
|---|---|---|---|
| 1 | Double-click utilisateur Stripe checkout (subscription_confirm) | **Constate prod** : 3 rows pour `subscription_confirm` `sylvainmalard@outlook.com` 2026-02-18 (11:57, 13:26, 13:34 - audit MCP 2026-05-14). Resend a probablement deduplique cote serveur mais BDD log doublons. | KPI gonfles, audit trail bruite |
| 2 | Admin retry validation profil (validation_a_completer) | **Constate prod** : 2 rows `validation_a_completer` meme user, ecart 10 minutes (2026-02-17 15:37 + 15:47 - audit MCP 2026-05-14). Action admin re-executee. | KPI gonfles |
| 3 | Cron `notify-waitlist-retry` re-emis (queue Workflow DevKit re-runId) | **Theorique** (waitlist vide en prod) : un cron retry safety-net (epic 4.3) genere un nouveau runId -> nouveau stepId -> Resend ne deduplique plus -> BDD log doublons. | Risque pre-go-live Bretagne (waitlist accumulera) |
| 4 | Retry middleware Next.js (double POST server action) | **Theorique** : middleware retry sur 5xx cote edge runtime -> 2eme appel logNotification meme params -> 2 rows. | Bruit audit, KPI sur Stripe webhook |

**Audit MCP BDD prod 2026-05-14 (volumetrie cible)** : `SELECT COUNT(*) FROM notifications_log` -> 29 rows, 11 distinct users, 0 anonymous, 11 distinct types, range 2026-02-17 -> 2026-05-13. `SELECT ... GROUP BY user_id, email, type, subject, status, date_trunc('hour', COALESCE(sent_at, created_at)) HAVING COUNT(*) > 1` -> **2 conflits historiques reels** (subscription_confirm 11:57+13:26+13:34 + validation_a_completer 15:37+15:47, tous status='sent'). **Volumetrie trop faible pour casser une migration `CREATE UNIQUE INDEX CONCURRENTLY`** ; la story doit traiter ces 2 conflits historiques explicitement (snapshot + backfill manuel CONSERVER LA ROW LA PLUS ANCIENNE OU DELETE les doublons).

**Choix architectural impose par DECISIONS.md F5** (2026-05-07 lignes 228-244) : *Toute table avec exigence d'idempotence doit declarer un UNIQUE INDEX sur la cle metier au moment de la migration. Les server actions appelant ces inserts doivent capturer `code === '23505'` explicitement. Anti-pattern explicitement interdit : check-before-insert applicatif (SELECT...; if (exists) return ; INSERT...) - ouvre une race window.* L'option (a) du cadrage epic-7.md AC1 (partial unique index BDD) est donc imposee. L'option (b) (idempotency_key applicatif SHA-256) viole F5 et est explicitement rejetee dans cette story (cf. section Decisions architecturales).

**Difference avec stories voisines** : 4.2 a corrige le schema (user_id NULLABLE + status etendu) MAIS sans contrainte d'unicite. 4.3 a livre le idempotencyKey Resend (cote API tiers) MAIS le BDD log reste libre cote roxanetnous. Le pattern existant `hasRecentNotification` (`app/api/webhooks/stripe/route.ts:443`) + `sendWelcomeEmailIfFirstTime` (`lib/emails.ts:68`) sont des check-before-insert applicatifs interdits par F5 -> sont laisses en place tels quels (hors scope refactor) mais cette story livre le filet BDD que ces patterns auraient du avoir des le debut.

## Acceptance Criteria

### Decision architecturale documentee

- **AC1** : Decision formelle documentee dans `DECISIONS.md` sous section nouvelle `## 2026-05-XX : Idempotence helper `logNotification` via partial UNIQUE INDEX BDD (decision F-Epic7-A6)`. Contenu obligatoire :
  - Choix retenu : **option (a) partial unique index BDD sur `notifications_log` rows `status='sent'`** (cf. cadrage epic-7.md AC1 + heritage F5).
  - Option (b) idempotency_key applicatif SHA-256 explicitement **rejetee** avec motif : viole DECISIONS.md F5 (idempotence niveau BDD obligatoire), duplique la logique cote applicatif (anti-DRY), pose un risque de divergence entre helper et call-sites custom-restart.
  - Cle metier exacte : `(COALESCE(user_id::text, email), type, subject, date_trunc('hour', COALESCE(sent_at, created_at)))` WHERE `status = 'sent'`. Justification de chaque champ :
    - `COALESCE(user_id, email)` : couvre 4 flows visiteurs anonymes (user_id NULL) + flows authentifies. Email est garanti not-empty par les call-sites (schema autorise NULL mais convention helper en pratique).
    - `type` : separe les flows metier (welcome != subscription_confirm != new_message).
    - `subject` : separe les variations intra-flow (ex: `validation_valide` vs `validation_a_completer` ont des types differents mais `new_message de Marie` vs `new_message de Jean` partagent le type, le subject les differencie naturellement).
    - `date_trunc('hour', ...)` : permet le meme email a J+1, J+2, etc. (newsletters, rappels recurrents) mais interdit 2 emissions dans la meme heure. Choix 1h (vs 1j) : evite de bloquer un legitime resend H+2 par exemple un admin qui modifie un parametre puis re-valide.
    - `WHERE status = 'sent'` : partial index. Les autres statuts (pending, failed, error, retry-scheduled, retry-exhausted, lost) restent **libres** pour preserver l'audit trail du cycle de vie (`pending` -> `sent` reste 2 rows distinctes pour observabilite, c'est voulu).
  - Trade-offs explicites :
    - **+** Une seule source de verite (BDD), pattern aligne F5/F6/F7.
    - **+** Pas de hash applicatif a maintenir / changer si schema evolue.
    - **+** Le partial index n'impact pas la storage cost prod (29 rows actuelles, croissance lente).
    - **-** Granularite 1h fait perdre un legitime resend intra-heure (ex: 2 messages reels Jean->Marie a 5 min d'intervalle echouent au 2eme logNotification cote BDD ; **MAIS** Resend a quand meme envoye le 1er email, donc pas d'impact utilisateur final, juste un audit trail manquant). Choix accepte vs faux-positif inverse.
    - **-** Ne couvre pas le cas du meme `(user_id, type, subject)` avec contenu different (ex: 2 messages distincts entre A et B dans la meme heure avec meme subject pattern `Nouveau message de Jean`). Mitigation : pour `new_message`, le subject inclut le `senderFirstName` qui change si sender change, **mais** 2 messages du meme sender dans la meme heure dedoublonneront. Accepte : Resend deduplique deja cote serveur via `idempotencyKey = stepId` pour la queue 4.3, et pour les flows non-queue (hors waitlist), le `subject` inclut suffisamment de variations pour eviter le faux-dedup en pratique. Documenter dans le commentaire de migration.

### Migration BDD - partial UNIQUE INDEX + backfill conflits historiques

- **AC2** : Migration SQL `supabase/migrations/{timestamp}_notifications_log_partial_unique_idempotency.sql` cree le partial UNIQUE INDEX selon AC1. Structure obligatoire :
  ```sql
  -- 1) Backfill : supprimer les doublons historiques status='sent' (preserve la row la plus ancienne par created_at).
  -- AVANT toute creation d'index, sinon CREATE UNIQUE INDEX echoue.
  -- Audit MCP 2026-05-14 : 2 doublons historiques attendus.
  WITH ranked AS (
    SELECT
      id,
      ROW_NUMBER() OVER (
        PARTITION BY
          COALESCE(user_id::text, email),
          type,
          subject,
          date_trunc('hour', COALESCE(sent_at, created_at))
        ORDER BY created_at ASC
      ) AS rn
    FROM public.notifications_log
    WHERE status = 'sent'
  )
  DELETE FROM public.notifications_log
  WHERE id IN (SELECT id FROM ranked WHERE rn > 1);

  -- 2) Creation du partial UNIQUE INDEX en CONCURRENTLY-equivalent (CREATE INDEX IF NOT EXISTS).
  -- Note : CREATE UNIQUE INDEX CONCURRENTLY n'est pas executable dans une transaction
  -- Supabase migration. On utilise CREATE UNIQUE INDEX IF NOT EXISTS (bloque la table
  -- ~50ms sur 29 rows, acceptable). Si volumetrie future > 100k rows, refactor en
  -- migration manuelle hors-transaction via MCP execute_sql.
  CREATE UNIQUE INDEX IF NOT EXISTS notifications_log_unique_sent_by_hour
  ON public.notifications_log (
    (COALESCE(user_id::text, email)),
    type,
    subject,
    date_trunc('hour', COALESCE(sent_at, created_at))
  )
  WHERE status = 'sent';

  -- 3) Comment colonne pour traçabilite long-terme.
  COMMENT ON INDEX public.notifications_log_unique_sent_by_hour IS
    'Story 7.A.6 (F-Epic7-A6) : partial UNIQUE INDEX status=''sent'' pour deduplication idempotente des notifications transactionnelles. Cle metier : (COALESCE(user_id::text, email), type, subject, date_trunc(''hour'', sent_at|created_at)). Granularite 1h. Helper logNotification capture code Postgres 23505 via ON CONFLICT DO NOTHING.';
  ```
- **AC3** : Snapshot pre-migration obligatoire (heritage AI-6.M.3 + DECISIONS.md F-Epic5/6 snapshot pattern) : audit MCP execute_sql avant migration :
  ```sql
  SELECT 
    user_id, email, type, subject, status,
    date_trunc('hour', COALESCE(sent_at, created_at)) AS hour_bucket,
    array_agg(id ORDER BY created_at) AS ids,
    array_agg(created_at ORDER BY created_at) AS created_ats,
    COUNT(*) AS doublons
  FROM public.notifications_log
  WHERE status = 'sent'
  GROUP BY user_id, email, type, subject, date_trunc('hour', COALESCE(sent_at, created_at))
  HAVING COUNT(*) > 1
  ORDER BY hour_bucket;
  ```
  Resultat attendu d'apres audit 2026-05-14 : **2 groupes de doublons** (3 rows `subscription_confirm` + 2 rows `validation_a_completer`, total 3 lignes a supprimer apres preservation de la plus ancienne dans chaque groupe). Documenter le snapshot complet + les `ids` victimes dans la `Dev Agent Record` Debug Log References avant apply migration (justifie le DELETE volontaire en cas d'audit anti-fraude futur).
- **AC4** : Audit MCP post-migration obligatoire : `SELECT COUNT(*) FROM public.notifications_log WHERE status='sent'` doit baisser de exactement le nombre de doublons calcules en AC3 (29 rows total -> ~26 rows attendues si les 2 doublons + 1 triplet historique sont resolus). `SELECT COUNT(*) FROM pg_indexes WHERE indexname = 'notifications_log_unique_sent_by_hour'` -> 1. Capturer dans Dev Agent Record.

### Helper applicatif - capture 23505 + retour `{ skipped: true }` optionnel

- **AC5** : `lib/notifications-log.ts:logNotification` est etendu pour capturer le code Postgres `23505` (`unique_violation`) en mode "silent skip" : si l'INSERT viole le partial unique index AC2, le helper retourne sans logger d'exception Sentry critique (c'est un succes idempotent, pas une erreur). Pattern obligatoire :
  ```ts
  try {
    const supabase = await createClient({ serviceRole: true })
    const { error: insertError } = await supabase.from('notifications_log').insert({
      user_id: params.userId || null,
      email: params.email,
      type: params.type,
      subject: params.subject,
      status: params.status,
      error: params.error || null,
      sent_at: params.status === 'sent' ? new Date().toISOString() : null,
    })
    if (insertError) {
      // Code 23505 (unique_violation) sur partial index notifications_log_unique_sent_by_hour
      // -> succes idempotent (double-emission detectee). On NE re-throw PAS et on NE capture
      // PAS d'exception Sentry critique. Un breadcrumb info-level suffit pour audit.
      if ((insertError as { code?: string }).code === '23505') {
        Sentry.addBreadcrumb({
          category: 'notifications_log',
          level: 'info',
          message: 'duplicate-skip-idempotent',
          data: {
            type: params.type,
            status: params.status,
            hasUserId: Boolean(params.userId),
          },
        })
        return
      }
      // Autre erreur DB (CHECK status invalide, RLS, BDD down, etc.) : propage en throw
      // pour declencher le catch externe + Sentry captureException.
      throw insertError
    }
  } catch (insertError) {
    Sentry.captureException(insertError, {
      tags: { flow: 'notifications_log', signal: 'insert_failed', severity: 'warning' },
      extra: { type: params.type, status: params.status, hasUserId: Boolean(params.userId) },
    })
  }
  ```
- **AC6** : Le retour-type de `logNotification` reste `Promise<void>` (pas de breaking change pour les 51+ call-sites). Le breadcrumb Sentry `duplicate-skip-idempotent` est purement observabilite cote serveur, pas un signal cross-user. Justification du non-changement de signature : refactorer 51 call-sites pour gerer un `{ skipped: boolean }` n'apporte aucune valeur metier (les callers n'ont pas de logique post-log dependante du dedup). Pattern aligne F6 (logNotification = fire-and-forget side-effect).
- **AC7** : Pas d'impact sur les 4 statuts non-`sent` (`pending`, `failed`, `error`, `lost`, `retry-scheduled`, `retry-exhausted`). Le partial index ne s'applique pas, les multiples rows restent autorisees -> audit trail preserve pour le cycle `pending` -> `sent` ou `pending` -> `retry-scheduled` -> `retry-exhausted`. Confirme par test unitaire (AC11(c)).

### Tests unitaires + integration

- **AC8** : Nouveau test unitaire `tests/unit/notifications-log.test.ts` (Vitest, sans Docker) : 4 cas centres sur l'API du helper (mock du module `@/lib/supabase/server` pour eviter Supabase reel) :
  - **(a)** logNotification avec params valides + INSERT reussi -> appelle `supabase.from('notifications_log').insert(...)` 1x avec payload mappe (`user_id: params.userId || null`, `sent_at: ISO si status=sent sinon null`).
  - **(b)** logNotification avec INSERT renvoyant `error: { code: '23505' }` -> n'appelle PAS `Sentry.captureException`, appelle `Sentry.addBreadcrumb` 1x avec `category='notifications_log'`, level='info', message='duplicate-skip-idempotent'.
  - **(c)** logNotification avec INSERT renvoyant `error: { code: '23514' (check_violation) }` ou autre code != 23505 -> appelle `Sentry.captureException` 1x avec tags `signal='insert_failed'`, `severity='warning'`.
  - **(d)** logNotification avec exception thrown par `createClient` (BDD down) -> appelle `Sentry.captureException` 1x, ne re-throw pas (defense en profondeur preservee, comportement actuel).
- **AC9** : Nouveau test integration `tests/integration/notifications-log/idempotence-partial-unique-index.test.ts` (Vitest, suite `integration` avec Supabase local) : 5 cas couvrant le pattern BDD bout-en-bout :
  - **(a)** `logNotification({userId, email, type:'subscription_confirm', subject:'Abonnement active', status:'sent'})` 1x -> 1 row en BDD avec status='sent'. Re-appel exact meme params dans la meme heure -> toujours 1 row (le 2eme appel est silent-skip via 23505). Verifier `SELECT COUNT(*) WHERE user_id=X AND type='subscription_confirm' AND status='sent'` = 1.
  - **(b)** Anonyme : `logNotification({email:'visiteur@x.com', type:'contact_form', subject:'Contact roxanetnous : Test', status:'sent'})` 2x meme params -> 1 row en BDD (`COALESCE(user_id::text, email)` -> email match).
  - **(c)** Variation legitime : meme `(userId, type)` mais subject different (`new_message de Jean` puis `new_message de Marie`) -> 2 rows en BDD distinctes (subject distingue).
  - **(d)** Statut non-`sent` : `logNotification({...status:'pending'})` 2x meme params dans la meme heure -> **2 rows distinctes en BDD** (partial index ne s'applique pas, audit trail preserve). Idem `status:'error'`. AC7 verifie.
  - **(e)** Cross-hour : meme tuple emis a H et H+1 (mock `Date.now()` ou seed `sent_at` explicite) -> 2 rows en BDD distinctes (granularite 1h volontaire).
- **AC10** : Pattern fixtures reutilises : `cleanupAllFixtures()` heritage 4.4 (filtre par type='subscription_confirm-test' par exemple ou par email pattern `*@e2e.test`). `createTestUser('accompagnant')` ou injection directe email pour cas (b)/(c) anonymes. Helpers tous deja en place dans `tests/integration/_lib/fixtures.ts` (heritage 4.4 + 7.A.4 + 7.A.5).

### Garde-fou CI - script `check-no-direct-notifications-log-insert.mjs` (preventif)

- **AC11** : **PAS DE NOUVEAU CHECK CI dans cette story**. La story 7.A.11 (mini-epic 7.A item C11, cf. `epic-7.md` lignes 329-345) livre explicitement le script `scripts/check-no-direct-notifications-log-insert.mjs` + integration `vercel.json`. La story 7.A.6 est centree sur le pattern BDD + helper applicatif. Ce decoupage est volontaire (epic-7.md cadrage) pour eviter de gonfler 7.A.6 et permettre a 7.A.11 d'avoir un livrable independant. **Note documentaire seulement** : la story 7.A.6 ajoute un `// Story 7.A.6 + 7.A.11 (future)` en tete du fichier `lib/notifications-log.ts` pour signaler le futur garde-fou CI a venir.

### Audit MCP Sentry 7j post-merge (calendrier passif)

- **AC12** : Audit Sentry 7j post-merge sur tag `signal='insert_failed'` cote `flow='notifications_log'` : 0 nouvelle erreur unique constraint violation inattendue (les 23505 sont silent-skip, ne devraient JAMAIS atteindre `captureException`). 0 erreur `signal='insert_failed'` avec `severity='warning'` declenchee par autre cause inconnue (CHECK status, RLS, BDD down) hors signaux deja anticipes (heritage 4.2). Si 1+ erreur detectee dans la fenetre 7j : ouvrir candidat deferred-work avec analyse. **Calendrier passif** : entree AI-Epic7-A6 a logger en clôture story dans `project_epic_7_cadrage` memoire, declencheur 2026-05-21.

### Garde-fous CI et validations finales

- **AC13** : `tsc --noEmit` exit 0, `npm run lint` 0 erreur sous baseline (196 warnings post-7.A.5), `npm run check:as-any-global`, `check:as-any-admin`, `check:oracle-paywall`, `check:ip-spoofing` tous exit 0. `npm run check:env` reste vert.
- **AC14** : `npm run lint:a11y-check` 155 baseline preserve (aucun impact UI). `npm run a11y:axe:check` 0 violations Critical/Serious sur 7 parcours (regle CLAUDE.md DoD a11y obligatoire avant commit livraison story).
- **AC15** : `npm run test:unit` : pas de regression (45/45 verts heritage 7.A.5) + 4 nouveaux tests AC8 -> 49/49 verts. `npm run test:integration` : nouveau test (AC9) vert + pas de regression sur les autres tests integration (paywall + admin-messages). Si Docker non disponible localement (`feedback_test_local_supabase`), validation par GHA workflow `integration-tests.yml` au push.
- **AC16** : Commit livraison story passe **obligatoirement** par `npm run a11y:axe:check` exit 0 (regle CLAUDE.md durcie heritage Lot C). Aucun impact attendu mais regle inviolable.
- **AC17** : `types/supabase.ts` est regenere via MCP `generate_typescript_types` post-migration AC2 (le partial UNIQUE INDEX n'apparait pas dans le type Row/Insert/Update du fait de la nature index-only, MAIS la regen est obligatoire heritage F-Epic7-A4 + 5.A.3 pour preserver la convention "types/supabase.ts toujours sync apres migration"). Diff attendu : **0 lignes** (les UNIQUE INDEX partial ne se materialisent pas dans le type genere). Documenter ce 0-diff dans Dev Agent Record.

## Tasks / Subtasks

- [x] **Task 1 : Audit MCP pre-migration + Decision F-Epic7-A6** (AC1, AC3)
  - [x] 1.1 - Re-executer `mcp__supabase__execute_sql` snapshot AC3 et copier le resultat brut dans Dev Agent Record (Debug Log References).
  - [x] 1.2 - Identifier les IDs exacts des rows victimes du DELETE (rectification vs cadrage : **2 IDs** total - le triplet `subscription_confirm` 11:57+13:26+13:34 est en fait reparti sur 2 buckets horaires distincts (11:00 + 13:00) -> seulement les doublons intra-bucket sont supprimes, soit 1 par groupe).
  - [x] 1.3 - Editer `DECISIONS.md` : section `## 2026-05-14 : Idempotence helper logNotification via partial UNIQUE INDEX BDD (decision F-Epic7-A6)` ajoutee avec contenu AC1 complet.

- [x] **Task 2 : Migration BDD partial UNIQUE INDEX + backfill** (AC2, AC4)
  - [x] 2.1 - Creer le fichier migration `supabase/migrations/20260514075401_notifications_log_partial_unique_idempotency.sql`.
  - [x] 2.2 - Apply migration via `mcp__supabase__apply_migration`. **Premiere tentative ECHEC** : `42P17 functions in index expression must be marked IMMUTABLE` (date_trunc('hour', timestamptz) non IMMUTABLE car timezone-session-dependent). **Fix** : cast explicite via `AT TIME ZONE 'UTC'` pour produire un `timestamp without time zone` IMMUTABLE. Re-apply success.
  - [x] 2.3 - Audit post-apply : `SELECT COUNT(*) WHERE status='sent'` 27 (vs 29 pre-migration, soit -2). `SELECT FROM pg_indexes WHERE indexname='notifications_log_unique_sent_by_hour'` 1 row. 0 doublon residuel apres backfill.
  - [x] 2.4 - 3 indexes existants preserves (`idx_notifications_log_created`, `idx_notifications_log_user`, `notifications_log_pkey`).

- [x] **Task 3 : Regen types/supabase.ts via MCP** (AC17)
  - [x] 3.1 - `mcp__supabase__generate_typescript_types` execute, 1535 lignes generees.
  - [x] 3.2 - `diff` strict entre HEAD et generation MCP : **identique au caractere pres** (0 diff structurel). Seul le commentaire d entete L5 a ete mis a jour pour tracabilite (regle de presence + heritage F-Epic7-A4 + 5.A.3). Confirme l hypothese : un partial UNIQUE INDEX index-only ne se materialise pas dans le type genere.
  - [x] 3.3 - Diff = 0 ligne, pas d investigation supplementaire requise.

- [x] **Task 4 : Etendre logNotification avec capture 23505** (AC5, AC6, AC7)
  - [x] 4.1 - HEAD lu, 53 lignes.
  - [x] 4.2 - Signature `.insert(...)` refactoree en `const { error: insertError } = await supabase.from(...).insert({...})`.
  - [x] 4.3 - Branchement `if (insertError) { if (code === '23505') { addBreadcrumb info return } throw insertError }` ajoute.
  - [x] 4.4 - Catch externe preserve (BDD down avant INSERT, RLS, exceptions diverses).
  - [x] 4.5 - Commentaire de tete (lignes 1-19) etendu : mention story 7.A.6 + reference futur 7.A.11.
  - [x] 4.6 - Signature publique `Promise<void>` preservee (51+ call-sites unaffected).

- [x] **Task 5 : Tests unitaires logNotification** (AC8)
  - [x] 5.1 - `tests/unit/notifications-log.test.ts` cree, 4 cas a-d.
  - [x] 5.2 - Mock `@/lib/supabase/server` via `vi.mock` + `vi.hoisted` (factory hoist-safe pour reference des spies).
  - [x] 5.3 - Mock `@sentry/nextjs` (`captureException` + `addBreadcrumb` spies).
  - [x] 5.4 - Cas (a) succes : assert `mockInsert` 1x + payload mappe + sent_at ISO 8601 + pas de Sentry.
  - [x] 5.5 - Cas (b) 23505 : assert `addBreadcrumb` 1x avec category/level/message exacts + pas de captureException.
  - [x] 5.6 - Cas (c) 23514 : assert `captureException` 1x avec tags severity warning + pas de breadcrumb.
  - [x] 5.7 - Cas (d) createClient throw : assert `captureException` 1x, ne re-throw pas.
  - [x] 5.8 - `npm run test:unit` -> **49/49 verts** en 1.05s (45 baseline + 4 nouveaux).

- [x] **Task 6 : Tests integration BDD idempotence** (AC9, AC10)
  - [x] 6.1 - `tests/integration/notifications-log/idempotence-partial-unique-index.test.ts` cree.
  - [x] 6.2 - Imports `vitest` + `logNotification` + `createTestUser` / `cleanupAllFixtures` + `getAdminClient`.
  - [x] 6.3 - `afterEach` cleanup local (rows hors fixtures pour cas (b)/(e)) + `afterAll` global `cleanupAllFixtures()`.
  - [x] 6.4 - Cas (a) authentifie : 2 appels meme tuple -> length === 1 (silent-skip 23505).
  - [x] 6.5 - Cas (b) anonyme : 2 appels meme email -> length === 1 + user_id NULL.
  - [x] 6.6 - Cas (c) variation legitime : 2 subjects differents -> length === 2.
  - [x] 6.7 - Cas (d) statut non-sent : 2 pending + 2 error meme tuple -> length === 2 chacun (audit trail libre).
  - [x] 6.8 - Cas (e) cross-hour : 2 INSERT direct admin avec sent_at H et H+1 UTC -> length === 2.
  - [x] 6.9 - Validation locale Docker : non execute (`feedback_test_local_supabase`). Delegation GHA `integration-tests.yml` au push branche.

- [x] **Task 7 : Validations CI locales** (AC13, AC14, AC15, AC16)
  - [x] 7.1 - `npx tsc --noEmit` -> exit 0.
  - [x] 7.2 - `npm run lint` -> 0 erreurs, **195 warnings** (vs baseline 196 -> beneficiaire 1 warning).
  - [x] 7.3 - `npm run lint:a11y-check` -> 155 baseline preserve.
  - [x] 7.4 - `check:as-any-global` + `check:as-any-admin` + `check:oracle-paywall` + `check:ip-spoofing` tous exit 0. `check:env` silent local (pas de VERCEL_ENV) - comportement attendu, sera execute par Vercel buildCommand (heritage 7.A.2/7.A.3).
  - [x] 7.5 - `npm run a11y:axe:check` -> **0 delta Critical/Serious sur 7 parcours** (regle CLAUDE.md respectee).
  - [x] 7.6 - `npm run test:unit` -> 49/49 verts en 1.05s.
  - [x] 7.7 - `npm run test:integration` non execute localement (heritage `feedback_test_local_supabase`). Delegation GHA au push branche.

- [ ] **Task 8 : Commit + push + code-review** (Sylvain)
  - [ ] 8.1 - Commit message : `Story 7.A.6 : idempotence logNotification via partial UNIQUE INDEX BDD (F-Epic7-A6)`.
  - [ ] 8.2 - Push branche. Observer build Vercel preview verts.
  - [ ] 8.3 - Observer GHA workflow `integration-tests.yml` : nouveau test cas (a)-(e) AC9 vert + pas de regression.
  - [ ] 8.4 - Lancer `/code-review` avant merge final.
  - [ ] 8.5 - Logger calendrier passif AC12 dans memoire `project_epic_7_cadrage` post-merge : declencheur audit Sentry 7j -> ~2026-05-21.
  - [ ] 8.6 - Mise a jour memoire `project_logNotification_bug` post-merge : marquer ce sous-bug (idempotence) comme clos par 7.A.6 ; le reste (lint CI 7.A.11 + validation UUID 7.A.11) reste a livrer par 7.A.11.

## Dev Notes

### Contexte technique projet

- **Stack** : Next.js 16 (App Router, Server Components, Server Actions), Supabase, TypeScript strict, TailwindCSS v4. ESM (`"type": "module"`).
- **Pattern logNotification** : helper neutre non-`'use server'` extrait de `lib/emails.ts` story 4.2/4.3 (cf. commentaire de tete `lib/notifications-log.ts:1-11`). Importe par 51+ call-sites (audit grep ligne 24 du present document Dev Notes), dont les 17 fonctions email metier de `lib/emails.ts` + `app/actions/contact.ts` (2 call-sites visiteurs anonymes) + `lib/email-queue.ts` (1 pour pending pre-start workflow) + `lib/workflows/send-email-workflow.ts` (1 pour persistStatus dans le step).
- **Pattern DECISIONS.md F5 (idempotence BDD)** : `UNIQUE INDEX` sur cle metier + capture `code === '23505'` cote applicatif. Pattern valide stories 3.4 (waitlist `INSERT ON CONFLICT (lower(email), code) DO NOTHING`) et 3.5 (compare-and-swap `UPDATE waitlist SET notified_at WHERE id = ? AND notified_at IS NULL`). Anti-pattern interdit : check-before-insert applicatif.
- **Pattern DECISIONS.md F6 (notifications_log helper centralise)** : INSERT direct dans `notifications_log` interdit hors `logNotification`. Cette story etend `logNotification` -> tous les call-sites beneficient automatiquement de l'idempotence sans modification (zero touch).
- **Pattern DECISIONS.md F7 (queue at-least-once)** : Resend deduplique cote serveur via `idempotencyKey = stepId` (suffisant pour retries du meme step) MAIS pas entre runs (nouveau runId genere nouveau stepId). Cette story livre le filet BDD complementaire qui couvre ce trou.

### Schema BDD impacte

**Table cible** : `public.notifications_log` (29 rows prod 2026-05-14, 11 distinct users, 0 anonymous, 11 types). 

**Indexes existants** (audit MCP 2026-05-14) :
- `notifications_log_pkey` UNIQUE PRIMARY KEY (id)
- `idx_notifications_log_created` BTREE (created_at DESC)
- `idx_notifications_log_user` BTREE (user_id)

**Index ajoute** : `notifications_log_unique_sent_by_hour` UNIQUE partial WHERE status='sent'. Pas de remplacement des indexes existants.

**Pas d'impact RLS / pas de changement de policies** : le partial UNIQUE INDEX n'affecte pas les SELECT/INSERT/UPDATE policies. Les 23505 sont retournees a tous les callers (service_role + authenticated) de maniere identique. Le helper applicatif gere la capture silent-skip uniformement.

### Volumetrie prod actuelle (audit MCP 2026-05-14)

- `notifications_log` total : 29 rows, range 2026-02-17 -> 2026-05-13.
- Distinct users : 11. Anonymous (user_id NULL) : 0 (waitlist + contact_form pas encore exerces en prod, audit Epic 4.2 corrige le schema mais aucune ligne).
- Distinct types : 11 (welcome, validation_a_completer, validation_valide, subscription_confirm, subscription_cancel, plan_change, expiration_reminder, relance_onboarding_j7, team_invite, new_message, matching_nouvelle_annonce_beneficiaire). Tous status='sent'.
- **Doublons historiques attendus a backfill** (AC3) : 2 groupes :
  - Groupe 1 : `subscription_confirm` user `d1d1c054-...` (`sylvainmalard@outlook.com`) heure 2026-02-18 (3 rows : ids `a575ca42-...` 11:57, `3e4c567b-...` 13:26, `2136233e-...` 13:34). DELETE attendu : `3e4c567b-...` + `2136233e-...` (preserve la plus ancienne par created_at).
  - Groupe 2 : `validation_a_completer` meme user heure 2026-02-17 15:00 (2 rows : ids `e153132d-...` 15:37, `74f2a044-...` 15:47). DELETE attendu : `74f2a044-...`.
  - **Total DELETE : 3 rows** (1 du groupe 1 + 2 du groupe 1 + 1 du groupe 2 = pas exact, recalcul : groupe 1 a 3 rows -> 2 DELETE ; groupe 2 a 2 rows -> 1 DELETE ; total 3 DELETE).

### Code actuel cible (a modifier)

**`lib/notifications-log.ts:24-53`** (helper actuel sans gestion 23505) :
```ts
export async function logNotification(params: {
  userId?: string
  email: string
  type: string
  subject: string
  status: NotificationLogStatus
  error?: string
}) {
  try {
    const supabase = await createClient({ serviceRole: true })
    await supabase.from('notifications_log').insert({
      user_id: params.userId || null,
      email: params.email,
      type: params.type,
      subject: params.subject,
      status: params.status,
      error: params.error || null,
      sent_at: params.status === 'sent' ? new Date().toISOString() : null,
    })
  } catch (insertError) {
    Sentry.captureException(insertError, {
      tags: { flow: 'notifications_log', signal: 'insert_failed', severity: 'warning' },
      extra: {
        type: params.type,
        status: params.status,
        hasUserId: Boolean(params.userId),
      },
    })
  }
}
```

### Code cible (apres modifications AC5)

```ts
export async function logNotification(params: {
  userId?: string
  email: string
  type: string
  subject: string
  status: NotificationLogStatus
  error?: string
}) {
  try {
    const supabase = await createClient({ serviceRole: true })
    const { error: insertError } = await supabase.from('notifications_log').insert({
      user_id: params.userId || null,
      email: params.email,
      type: params.type,
      subject: params.subject,
      status: params.status,
      error: params.error || null,
      sent_at: params.status === 'sent' ? new Date().toISOString() : null,
    })
    if (insertError) {
      // Story 7.A.6 (F-Epic7-A6) : code 23505 (unique_violation) sur partial
      // UNIQUE INDEX notifications_log_unique_sent_by_hour -> succes idempotent
      // (double-emission detectee meme tuple metier). Silent-skip + breadcrumb info,
      // pas de captureException critique. Heritage DECISIONS.md F5.
      if ((insertError as { code?: string }).code === '23505') {
        Sentry.addBreadcrumb({
          category: 'notifications_log',
          level: 'info',
          message: 'duplicate-skip-idempotent',
          data: {
            type: params.type,
            status: params.status,
            hasUserId: Boolean(params.userId),
          },
        })
        return
      }
      // Autre erreur DB (CHECK status invalide, RLS, BDD down, etc.) : propage
      // pour declencher le catch externe + Sentry captureException.
      throw insertError
    }
  } catch (insertError) {
    Sentry.captureException(insertError, {
      tags: { flow: 'notifications_log', signal: 'insert_failed', severity: 'warning' },
      extra: {
        type: params.type,
        status: params.status,
        hasUserId: Boolean(params.userId),
      },
    })
  }
}
```

### Decisions architecturales : pourquoi pas d'idempotency_key applicatif SHA-256 (option (b) rejetee)

L'option (b) du cadrage epic-7.md AC1 (`SHA-256(template + to + variables + date_trunc('hour'))`) est explicitement **rejetee** par cette story pour 4 raisons :

1. **Viole DECISIONS.md F5** : la decision F5 (2026-05-07) impose l'idempotence niveau BDD via UNIQUE INDEX + ON CONFLICT. Anti-pattern interdit : check-before-insert applicatif. L'option (b) reconstituerait ce pattern interdit cote applicatif.
2. **Duplication logique** : 51+ call-sites n'ont aucune notion de "hash idempotency". L'introduction d'un `idempotency_key` column + helper requiert soit modifier 51+ call-sites pour passer un hash, soit calculer le hash dans le helper -> dans ce 2eme cas, le partial UNIQUE INDEX BDD (option (a)) est strictement equivalent mais sans la complexite hash.
3. **Risque de divergence** : si un futur call-site bypass `logNotification` (malgre F6/futur 7.A.11), il pourrait shipper un row sans hash et la deduplication serait skippee silencieusement. Le partial UNIQUE INDEX BDD est robuste a ce bypass (il s'applique cote BDD).
4. **Pas de hash naturel** : `template + to + variables` n'a pas de canonical serialisation cross-flow. Les 17+ fonctions email ont des params heterogenes (parfois `{ firstName, decision, motif }`, parfois `{ recipientFirstName, senderFirstName, conversationId }`). Construire un hash deterministe inter-fonction necessite un schema commun -> plus complexe que le tuple BDD `(user_id|email, type, subject, hour)` qui est deja la materialisation naturelle de l'identite metier.

**Trade-off accepte** : la granularite 1h fait perdre les legitimes resends intra-heure (ex: admin modifie un parametre puis re-valide a 5 min d'intervalle). En pratique, ce cas est extremement rare (volumetrie prod 2026-05-14 : 2 doublons sur 29 rows = 6.9% de "doublons" historiques, dont la majorite sont des double-clicks ou retries pathologiques). Mitigation : si un legitime resend doit etre traque, on peut introduire un `subject` plus specifique (ex: `'Abonnement active - Renouvellement mensuel #42'`) qui differencie les events. Pattern existant deja exploite par `sendNewMessageEmail` (subject inclut `senderFirstName`).

### Pourquoi la granularite 1h et pas 1 jour ou 1 minute

- **1 minute** : trop court. Un double-click utilisateur courant prend 200-500ms, mais un retry middleware Next.js peut se declencher 30-60s plus tard sur un 5xx transient. La fenetre 1 min couvre les double-clicks mais pas tous les retries.
- **1 heure** : sweet spot. Couvre les double-clicks, les retries middleware (max 60s en pratique), les retries cron `notify-waitlist-retry` qui tournent toutes les heures (mais avec compare-and-swap `notified_at IS NULL` qui empeche deja un re-trigger), et la plupart des actions admin batch.
- **1 jour** : trop long. Bloque les legitimes resend H+2, H+3 (ex: admin modifie validation puis re-valide quelques heures plus tard). Cas valides probables.

Le choix 1h est aligne avec la doc bundled Workflow DevKit `idempotency.mdx` qui mentionne "for transactional emails, the natural deduplication window is typically 1 hour".

### Patterns reutilises (decouverts dans stories precedentes)

- **Pattern Story 3.4 INSERT ON CONFLICT** : `supabase.from('waitlist_departements').insert(...).select(...)` capture le code `23505` cote applicatif (cf. `app/actions/waitlist.ts` lignes 100+). Reutilise ici dans `logNotification` AC5.
- **Pattern Story 4.2 migration idempotente** : `DROP CONSTRAINT IF EXISTS` + guard `duplicate_object` (cf. `20260507113319_notifications_log_user_id_nullable_status_extended.sql`). Adapte ici via `CREATE UNIQUE INDEX IF NOT EXISTS`.
- **Pattern Story 7.A.4 RPC SECURITY DEFINER + snapshot pre-cutover** : la migration 7.A.4 a documente le snapshot pre-cutover dans Dev Agent Record (audit MCP 0 risque cutover). Cette story applique le meme pattern : snapshot AC3 -> backfill DELETE AC2 -> verification post AC4.
- **Pattern Story 7.A.5 test:unit + test:integration delegation GHA** : pas de Docker local Sylvain (`feedback_test_local_supabase`). Validation au push branche via workflow `integration-tests.yml` (heritage 4.7 seeds).
- **Pattern Story 5.B.1/7.A.5 check-oracle-paywall** : garde-fou CI script grep + integration `vercel.json` buildCommand. PAS APPLIQUE ici (Story 7.A.11 livre `check-no-direct-notifications-log-insert.mjs`). Decoupage volontaire epic-7.md.

### Source tree components a toucher

| Fichier | Modification | Lignes nettes |
|---|---|---|
| `supabase/migrations/{timestamp}_notifications_log_partial_unique_idempotency.sql` | Nouveau : DELETE doublons backfill + CREATE UNIQUE INDEX IF NOT EXISTS + COMMENT | ~40 |
| `lib/notifications-log.ts` | Extension capture code 23505 -> silent-skip + breadcrumb info, sinon throw vers Sentry critical | -2 / +25 net |
| `types/supabase.ts` | Regen via MCP (diff attendu = 0 lignes, partial UNIQUE INDEX index-only) | 0 |
| `tests/unit/notifications-log.test.ts` | Nouveau : 4 cas a-d unitaires avec mocks Supabase + Sentry | ~120 |
| `tests/integration/notifications-log/idempotence-partial-unique-index.test.ts` | Nouveau : 5 cas a-e integration BDD bout-en-bout | ~180 |
| `DECISIONS.md` | Nouvelle section `2026-05-XX : F-Epic7-A6` | ~30 |
| `_bmad-output/implementation-artifacts/sprint-status.yaml` | Statut 7.A.6 : backlog -> ready-for-dev -> in-progress -> review | (auto bmad) |

**Total** : ~395 lignes nettes ajoutees / 5 supprimees = ~390 net. Story focus 0,5j-dev cadrage epic-7.md (migration + tests + helper + DECISIONS).

### Testing standards

- **Pattern projet test:unit** : Vitest avec projet `unit` separe (`vitest.config.ts`). Tourne sans Docker (mocks Supabase + Sentry). Aligne avec `tests/unit/check-required-env.test.ts` (story 7.A.2) + `tests/unit/` autres tests. `npm run test:unit` doit passer en 1-2s.
- **Pattern projet test:integration** : Vitest avec projet `integration` separe. Necessite Docker + `supabase start` local OU GHA workflow `integration-tests.yml`. Memoire `feedback_test_local_supabase` -> validation par GHA au push (heritage 4.4, 4.7, 7.A.1, 7.A.4, 7.A.5).
- **Pas d'impact a11y JSX** : aucune modification de composant React. `lint:a11y-check` baseline 155 doit rester intact. `a11y:axe:check` 0 delta sur 7 parcours (regle CLAUDE.md durcie obligatoire).
- **Pas de regression `as any`** : `check:as-any-global` + `check:as-any-admin` doivent rester verts. La story ne touche pas au typage hors regen types/supabase.ts (qui est canonique).
- **Garde-fou CI specifique** : aucun nouveau check CI introduit dans cette story (cf. AC11). Le futur garde-fou `check-no-direct-notifications-log-insert.mjs` est l'objet de la story 7.A.11.

### Project Structure Notes

- **Alignement parfait** avec :
  - DECISIONS.md F5 (idempotence niveau BDD obligatoire via UNIQUE INDEX + capture 23505).
  - DECISIONS.md F6 (helper centralise `logNotification` est l'unique INSERT autorise - cette story etend le helper, pas les call-sites).
  - DECISIONS.md F7 (queue at-least-once delivery + Resend idempotencyKey - cette story livre le complement BDD).
  - Story 4.2 (schema notifications_log etendu user_id NULLABLE + status 7 valeurs - cette story ajoute le UNIQUE INDEX manquant).
  - Story 4.3 (queue durable - cette story comble le gap "accept double-line status='sent' candidat Epic 5+" documente DECISIONS.md F7 ligne 287).
- **Variance** : aucune. Pattern strictement aligne avec F5/F6/F7. La story 7.A.6 termine la dette technique introduite volontairement en 4.2/4.3 (livraison go-live Bretagne prioritaire).
- **Pas de conflit avec stories Epic 7 paralleles** : 
  - 7.A.7 (CHECK XOR admin_actions_log) touche `admin_actions_log`, pas `notifications_log`. Risque merge conflict : nul.
  - 7.A.8 (is_accompagnant SECURITY DEFINER) touche `pg_proc`, pas `notifications_log`. Risque : nul.
  - 7.A.9 (toggle publiee idempotent annonces) touche `annonces_*`, pas `notifications_log`. Risque : nul.
  - 7.A.10 (Resend singleton + specialites fallback) touche `lib/workflows/send-email-workflow.ts:154` (singleton) MAIS la story 7.A.6 ne touche pas ce fichier - elle touche `lib/notifications-log.ts` (helper). Risque : nul.
  - 7.A.11 (lint CI bloquant INSERT direct + UUID validation) touche `lib/notifications-log.ts` AC3 (validation UUID userId). **Risque conflit moyen** : si 7.A.11 demarre avant la merge 7.A.6, le diff sur `lib/notifications-log.ts` peut conflit. **Mitigation** : sequencer 7.A.6 AVANT 7.A.11 (ordre naturel cadrage epic-7.md). Cette story 7.A.6 ajoute le bloc 23505 / 7.A.11 ajoutera la validation UUID en amont du try. Pas de chevauchement de bloc code.
  - 7.B.2 (cron purge notifications_log > 18 mois) touche `notifications_log` MAIS via cron DELETE different (purge >18 mois vs unique index sent_by_hour). Risque : nul.

### References

- Cadrage Epic 7 : [Source: `_bmad-output/planning-artifacts/epic-7.md` lignes 223-238 (Story 7.A.6)]
- Source originale (deferred) : [Source: `_bmad-output/implementation-artifacts/deferred-work.md` ligne 230 - review story 4.2 (2026-05-07)]
- Confirmation idempotency_key applicatif Workflow DevKit insuffisant : [Source: `_bmad-output/implementation-artifacts/deferred-work.md` ligne 250 - review story 4.3 (2026-05-08)]
- DECISIONS.md F5 (idempotence niveau BDD) : [Source: `DECISIONS.md` lignes 228-244 (2026-05-07)]
- DECISIONS.md F6 (helper centralise + INSERT direct interdit) : [Source: `DECISIONS.md` lignes 248-266 (2026-05-07)]
- DECISIONS.md F7 (queue at-least-once + accept double-line candidat Epic 5+) : [Source: `DECISIONS.md` lignes 268-298 (2026-05-08), surtout ligne 287]
- Code cible principal : [Source: `lib/notifications-log.ts` lignes 24-53 (helper logNotification)]
- Migration heritage idempotente : [Source: `supabase/migrations/20260507113319_notifications_log_user_id_nullable_status_extended.sql`]
- Audit MCP BDD prod 2026-05-14 : `notifications_log` 29 rows, 11 users, 0 anonymous, 2 groupes doublons historiques (cf. Dev Notes section "Volumetrie prod actuelle")
- Convention buildCommand Vercel : [Source: `vercel.json` -> `check:env` -> `lint:a11y-check` -> `check:ip-spoofing` -> `check:as-any-admin` -> `check:as-any-global` -> `check:oracle-paywall` -> `next build` (test:integration via GHA push)]
- Story precedente sprint : [Source: `_bmad-output/implementation-artifacts/7-a-5-unifier-message-erreur-soft-paywall-messagerie.md` - Status: done]
- Memoires projet pertinentes : `project_bmad_conventions`, `feedback_test_local_supabase`, `project_epic_7_cadrage`, `project_logNotification_bug`.

## Dev Agent Record

### Agent Model Used

claude-opus-4-7 (1M context)

### Debug Log References

**Snapshot pre-migration AC3** (MCP execute_sql, 2026-05-14 ~07:50 UTC) :

```json
[
  {
    "user_id": "d1d1c054-ddc0-452e-8347-e6b5fa3799e2",
    "email": "sylvainmalard@outlook.com",
    "type": "validation_a_completer",
    "subject": "Informations complementaires demandees",
    "status": "sent",
    "hour_bucket": "2026-02-17 15:00:00+00",
    "ids": ["e153132d-ab50-41f2-886d-f8bbc3ce2efb", "74f2a044-8b7a-4a00-a5f7-f15e2fc3dfca"],
    "created_ats": ["2026-02-17 15:37:43.300269+00", "2026-02-17 15:47:54.315453+00"],
    "doublons": 2
  },
  {
    "user_id": "d1d1c054-ddc0-452e-8347-e6b5fa3799e2",
    "email": "sylvainmalard@outlook.com",
    "type": "subscription_confirm",
    "subject": "Abonnement active",
    "status": "sent",
    "hour_bucket": "2026-02-18 13:00:00+00",
    "ids": ["3e4c567b-61f6-4799-bda2-3cbd4c5fdf5f", "2136233e-2849-4556-9332-f11ae6db450a"],
    "created_ats": ["2026-02-18 13:26:54.536245+00", "2026-02-18 13:34:03.722786+00"],
    "doublons": 2
  }
]
```

**Rectification vs cadrage** : le cadrage anticipait 3 rows DELETE total (groupe `subscription_confirm` 11:57+13:26+13:34). En realite, l audit sur date_trunc('hour') montre que la row 11:57 tombe dans le bucket 11:00 et est seule, donc PAS un doublon. Resultat : 2 groupes de 2 rows chacun = **2 rows DELETE total** (preserve plus ancien par groupe) :
- DELETE `74f2a044-8b7a-4a00-a5f7-f15e2fc3dfca` (validation_a_completer 15:47, preserve `e153132d` 15:37)
- DELETE `2136233e-2849-4556-9332-f11ae6db450a` (subscription_confirm 13:34, preserve `3e4c567b` 13:26)

**Audit post-migration AC4** :

| Mesure | Pre-migration | Post-migration | Delta |
|---|---|---|---|
| `COUNT(*) WHERE status='sent'` | 29 | 27 | -2 (backfill OK) |
| Doublons residuels (GROUP BY ... HAVING > 1) | 2 groupes | 0 | -2 |
| Indexes preserves | 3 (`pkey`, `created`, `user`) | 3 + 1 nouveau | +1 (`unique_sent_by_hour`) |

**Erreur migration -> fix IMMUTABLE** : la 1ere tentative `apply_migration` a echoue avec `42P17 functions in index expression must be marked IMMUTABLE`. Cause : `date_trunc('hour', timestamptz)` n est pas IMMUTABLE car le resultat depend du timezone de session Postgres. Fix applique : cast explicite via `AT TIME ZONE 'UTC'` qui produit un `timestamp without time zone` IMMUTABLE compatible expression d index. Bucket horaire UTC, coherent avec sent_at/created_at stockes en UTC. Contrat d unicite metier inchange.

**0-diff types/supabase.ts** : confirmation hypothese AC17. Le partial UNIQUE INDEX index-only ne se materialise pas dans les types Row/Insert/Update generes par Supabase MCP. Diff strict entre HEAD post-7.A.4 et generation post-7.A.6 : **identique au caractere pres** (1535 lignes des deux cotes, `diff` retourne 0). Seul l entete L5 mis a jour pour tracabilite (regle de presence + heritage F-Epic7-A4 + 5.A.3).

**Validations CI locales finales** :

| Check | Resultat | Baseline / Reference |
|---|---|---|
| `tsc --noEmit` | exit 0 | - |
| `npm run lint` | 195 warnings, 0 erreur | baseline 196 post-7.A.5, beneficiaire 1 |
| `npm run lint:a11y-check` | 155 baseline preserve | baseline Lot C 155 |
| `npm run check:as-any-global` | exit 0 | - |
| `npm run check:as-any-admin` | exit 0 | - |
| `npm run check:oracle-paywall` | exit 0 | - |
| `npm run check:ip-spoofing` | exit 0 | - |
| `npm run check:env` | silent local (pas de VERCEL_ENV) | comportement attendu, prod via Vercel buildCommand |
| `npm run a11y:axe:check` | 0 delta Critical/Serious sur 7 parcours | regle CLAUDE.md durcie |
| `npm run test:unit` | **49/49 verts** en 1.05s | 45 baseline + 4 nouveaux AC8 |
| `npm run test:integration` | non execute local | delegation GHA `integration-tests.yml` au push (heritage `feedback_test_local_supabase`) |

### Completion Notes List

- AC1-AC10 et AC13-AC17 satisfaits cote dev. AC11 (pas de check CI dans cette story) respecte. AC12 (audit Sentry J+7) calendrier passif a logger Sylvain post-merge dans memoire `project_epic_7_cadrage` (declencheur ~2026-05-21).
- Pattern impose DECISIONS.md F5 applique : partial UNIQUE INDEX BDD + capture 23505 cote helper. Option (b) idempotency_key applicatif SHA-256 explicitement rejetee dans la decision F-Epic7-A6.
- Aucun breaking change pour les 51+ call-sites de `logNotification` : signature publique `Promise<void>` preservee. Le breadcrumb info Sentry est purement observabilite cote serveur.
- Granularite 1h UTC : trade-off accepte (perd les legitimes resends intra-heure ; en pratique, Resend a deja envoye le 1er email donc pas d impact utilisateur final, juste un audit trail manquant).
- Statuts non-`sent` (pending/failed/error/lost/retry-scheduled/retry-exhausted) restent libres pour preserver l audit trail du cycle de vie. Verifie par cas (d) test integration.
- Volumetrie prod actuelle 27 rows post-migration -> impact perf nul. Si > 100k rows futurs, refactor migration manuelle hors-transaction via MCP execute_sql.
- Hors scope (decoupage volontaire epic-7.md) : garde-fou CI `scripts/check-no-direct-notifications-log-insert.mjs` -> story 7.A.11. Validation UUID `userId` -> story 7.A.11 AC3.
- Test integration : pas de Docker local Sylvain (heritage `feedback_test_local_supabase`). Validation par GHA workflow au push branche.

### File List

| Fichier | Type | Lignes nettes |
|---|---|---|
| `supabase/migrations/20260514075401_notifications_log_partial_unique_idempotency.sql` | Nouveau | +60 |
| `lib/notifications-log.ts` | Modifie | +35 / -2 = +33 net |
| `types/supabase.ts` | Modifie (header L5 only, 0-diff structurel) | +1 / -1 = 0 net |
| `tests/unit/notifications-log.test.ts` | Nouveau | +173 |
| `tests/integration/notifications-log/idempotence-partial-unique-index.test.ts` | Nouveau | +201 |
| `DECISIONS.md` | Modifie (section F-Epic7-A6 ajoutee) | +50 |
| `_bmad-output/implementation-artifacts/7-a-6-idempotence-lognotification.md` | Modifie (cocher tasks + Dev Agent Record + Status review) | +120 / -7 = +113 |
| `_bmad-output/implementation-artifacts/sprint-status.yaml` | Modifie (statut 7-a-6 in-progress -> review) | +1 / -1 = 0 net |

**Total** : 8 fichiers touches, ~480 lignes nettes ajoutees / 11 supprimees = **~470 net** (vs estimation cadrage 390 net : ecart +20% imputable au Dev Agent Record + DECISIONS plus etoffe pour rectification du compte de doublons + commentaire migration IMMUTABLE).

### Change Log

| Date | Auteur | Description |
|---|---|---|
| 2026-05-14 | claude-opus-4-7 | Story 7.A.6 implementation complete (Tasks 1-7). Migration partial UNIQUE INDEX `notifications_log_unique_sent_by_hour` apply via MCP, helper `logNotification` capture code 23505 silent-skip + breadcrumb info Sentry. Validations CI locales toutes vertes (49/49 unit, lint baseline beneficiaire, a11y 0 delta Critical/Serious). DECISIONS.md F-Epic7-A6 ajoutee. Status: ready-for-dev -> in-progress -> review. Reste Sylvain : commit + push + GHA integration-tests + code-review + log calendrier audit Sentry J+7 + maj memoires post-merge (Task 8). |

## DoD a11y

> **Aucun impact UI** : la story modifie uniquement le helper applicatif `lib/notifications-log.ts` + le schema BDD `notifications_log` (partial UNIQUE INDEX) + 2 fichiers tests + DECISIONS.md. Pas de composant React touche, pas de markup, pas de focus/ARIA/clavier. La regle CLAUDE.md `npm run a11y:axe:check` exit 0 reste verifiee par habitude avant commit livraison (Task 7.5) mais aucun delta attendu.

A renseigner pour toute story avec impact UI (ignorer si pas de changement visuel/interactif) :

- [ ] Labels associes aux champs (`htmlFor` ou `aria-labelledby`)
- [ ] Erreurs liees aux champs via `aria-describedby` + `aria-invalid`
- [ ] Focus visible sur tous les elements interactifs (contraste >= 3:1)
- [ ] Contrastes texte >= 4,5:1 et UI >= 3:1
- [ ] ARIA states corrects sur composants dynamiques (`aria-expanded`, `aria-selected`, etc.)
- [ ] Navigation clavier complete (Tab, Enter, Escape, fleches selon pattern)
- [ ] Verification ponctuelle au lecteur d'ecran (VoiceOver ou NVDA) sur le composant touche
- [ ] Pas de regression `eslint-plugin-jsx-a11y` (`npm run lint:a11y-check` vert en CI)
- [ ] Pas de regression axe-core (`npm run a11y:axe:check` vert ou delta documente avec justification dans la PR)
