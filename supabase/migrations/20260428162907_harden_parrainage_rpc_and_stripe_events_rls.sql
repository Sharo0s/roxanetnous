-- Hardening post code review 2026-04-28 :
-- 1. La RPC merge_parrainage_flag_suspicion etait executable par anon et
--    authenticated par defaut (Supabase grant EXECUTE a ces roles a la creation).
--    REVOKE ALL FROM PUBLIC ne suffit pas. On revoque explicitement.
-- 2. stripe_events_processed a RLS active sans policy : ajout d'une policy
--    qui bloque tout, accessible uniquement via service_role (qui bypass RLS).

BEGIN;

REVOKE EXECUTE ON FUNCTION public.merge_parrainage_flag_suspicion(UUID, TEXT) FROM anon;
REVOKE EXECUTE ON FUNCTION public.merge_parrainage_flag_suspicion(UUID, TEXT) FROM authenticated;

DROP POLICY IF EXISTS "stripe_events_processed_no_access" ON public.stripe_events_processed;
CREATE POLICY "stripe_events_processed_no_access" ON public.stripe_events_processed
  FOR ALL USING (false) WITH CHECK (false);

COMMIT;
