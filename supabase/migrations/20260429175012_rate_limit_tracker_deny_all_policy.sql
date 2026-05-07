-- L'advisor signale RLS sans policy. La table est intentionnellement
-- accessible UNIQUEMENT en service-role (RPC try_consume_rate_limit
-- est SECURITY DEFINER avec REVOKE). On ajoute une policy explicite
-- qui rejette tout pour rendre le contrat clair.
-- DROP IF EXISTS : permet l'idempotence sur cluster vierge ou une migration anterieure
-- (rate_limit_tracker.sql) aurait deja cree une policy du meme nom.
DROP POLICY IF EXISTS "rate_limit_tracker_deny_all" ON public.rate_limit_tracker;
CREATE POLICY "rate_limit_tracker_deny_all" ON public.rate_limit_tracker
  FOR ALL TO authenticated, anon
  USING (false)
  WITH CHECK (false);
