-- Story 7.A.6 : Idempotence helper logNotification via partial UNIQUE INDEX BDD (decision F-Epic7-A6)
--
-- Contexte : le helper lib/notifications-log.ts:logNotification (unique point d entree
-- INSERT autorise par DECISIONS.md F6) executait un INSERT sec sans contrainte d unicite.
-- Resend deduplique cote serveur via idempotencyKey = stepId (story 4.3) MAIS uniquement
-- pour les retries du meme step. Un nouveau runId Workflow DevKit -> nouveau stepId ->
-- Resend ne deduplique plus -> BDD log doublons. Cette migration livre le filet BDD
-- complementaire imposed par DECISIONS.md F5 (idempotence niveau BDD obligatoire).
--
-- Cle metier : (COALESCE(user_id::text, email), type, subject,
--   date_trunc('hour', COALESCE(sent_at, created_at) AT TIME ZONE 'UTC'))
-- Granularite 1h volontaire (sweet spot entre double-clicks et resends legitimes admin).
-- WHERE status = 'sent' : partial index, statuts non-sent restent libres pour audit trail
-- du cycle de vie (pending -> sent -> failed).
--
-- Note IMMUTABILITE : `date_trunc('hour', timestamptz)` n est PAS IMMUTABLE car le resultat
-- depend du timezone de session Postgres. On caste explicitement via `AT TIME ZONE 'UTC'`
-- pour produire un `timestamp without time zone` IMMUTABLE compatible expression d index.
-- Le bucket horaire est donc en UTC, coherent avec sent_at/created_at qui sont stockes en UTC.
--
-- Audit MCP prod 2026-05-14 (snapshot pre-migration):
-- - 29 rows total, toutes status='sent', 11 distinct users, 0 anonymous, 11 distinct types
-- - 2 groupes de doublons historiques :
--   * validation_a_completer sylvainmalard@outlook.com bucket 2026-02-17 15:00 UTC (ids e153132d 15:37 + 74f2a044 15:47)
--   * subscription_confirm sylvainmalard@outlook.com bucket 2026-02-18 13:00 UTC (ids 3e4c567b 13:26 + 2136233e 13:34)
-- Total DELETE attendu : 2 rows (preserve la plus ancienne par created_at dans chaque groupe).

-- 1) Backfill : supprimer les doublons historiques status='sent' (preserve le plus ancien par created_at).
-- AVANT toute creation d index, sinon CREATE UNIQUE INDEX echoue sur les doublons existants.
WITH ranked AS (
  SELECT
    id,
    ROW_NUMBER() OVER (
      PARTITION BY
        COALESCE(user_id::text, email),
        type,
        subject,
        date_trunc('hour', COALESCE(sent_at, created_at) AT TIME ZONE 'UTC')
      ORDER BY created_at ASC
    ) AS rn
  FROM public.notifications_log
  WHERE status = 'sent'
)
DELETE FROM public.notifications_log
WHERE id IN (SELECT id FROM ranked WHERE rn > 1);

-- 2) Creation du partial UNIQUE INDEX.
-- Note : CREATE UNIQUE INDEX CONCURRENTLY n est pas executable dans une transaction
-- Supabase migration. CREATE UNIQUE INDEX IF NOT EXISTS bloque la table ~50ms sur 27 rows
-- post-backfill, acceptable. Si volumetrie future > 100k rows, refactor en migration manuelle
-- hors-transaction via MCP execute_sql.
CREATE UNIQUE INDEX IF NOT EXISTS notifications_log_unique_sent_by_hour
  ON public.notifications_log (
    (COALESCE(user_id::text, email)),
    type,
    subject,
    (date_trunc('hour', COALESCE(sent_at, created_at) AT TIME ZONE 'UTC'))
  )
  WHERE status = 'sent';

-- 3) Comment colonne pour tracabilite long-terme (audit, debug, futur 7.A.11 lint check).
COMMENT ON INDEX public.notifications_log_unique_sent_by_hour IS
  'Story 7.A.6 (F-Epic7-A6) : partial UNIQUE INDEX status=sent pour deduplication idempotente des notifications transactionnelles. Cle metier : (COALESCE(user_id::text, email), type, subject, date_trunc(hour, sent_at|created_at AT TIME ZONE UTC)). Granularite 1h UTC. Helper logNotification capture code Postgres 23505 -> silent-skip + breadcrumb info Sentry.';
