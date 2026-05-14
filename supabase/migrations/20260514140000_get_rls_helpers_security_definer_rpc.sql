-- Story 7.A.8 fix-CI (F-Epic7-A8) : RPC dediee pour le garde-fou meta
-- scripts/check-rls-helpers-security-definer.mjs.
--
-- Contexte : la premiere implementation du garde-fou tentait d appeler l endpoint
-- interne /pg/meta/default/query (HTTP 404 sur Supabase SaaS). Pivot vers une
-- RPC publique typee retournant TABLE(proname, prosecdef) pour les 3 helpers RLS.
--
-- Securite :
--   - SECURITY DEFINER : la RPC lit pg_proc/pg_namespace qui ne sont pas exposes
--     a authenticated/anon en lecture directe. DEFINER pour acceder a ces vues
--     systeme via les droits du proprietaire.
--   - REVOKE PUBLIC + REVOKE anon + REVOKE authenticated : least-privilege strict.
--     Seul service_role (utilise par le script CI) peut appeler cette RPC.
--     (decision code review 7.A.8 : exposer pg_proc a authenticated = surface inutile)
--   - VOLATILE (non STABLE) : lit pg_proc qui peut changer sous DDL concurrent ;
--     STABLE autoriserait le planner a cacher l ancien resultat dans la meme tx.
--   - Scope strict : la RPC retourne UNIQUEMENT prosecdef pour les 3 helpers
--     `is_admin / is_accompagne / is_accompagnant`. Pas de schema introspection
--     elargie.

CREATE OR REPLACE FUNCTION public.get_rls_helpers_security_definer()
RETURNS TABLE (proname text, prosecdef boolean)
LANGUAGE sql
VOLATILE
SECURITY DEFINER
SET search_path = public, pg_catalog
AS $$
  SELECT p.proname::text, p.prosecdef
  FROM pg_proc p
  JOIN pg_namespace n ON p.pronamespace = n.oid
  WHERE n.nspname = 'public'
    AND p.proname IN ('is_admin','is_accompagne','is_accompagnant')
  ORDER BY p.proname;
$$;

REVOKE ALL ON FUNCTION public.get_rls_helpers_security_definer() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.get_rls_helpers_security_definer() FROM anon;
REVOKE ALL ON FUNCTION public.get_rls_helpers_security_definer() FROM authenticated;
GRANT EXECUTE ON FUNCTION public.get_rls_helpers_security_definer() TO service_role;

COMMENT ON FUNCTION public.get_rls_helpers_security_definer() IS
  'Story 7.A.8 fix-CI (F-Epic7-A8) : retourne prosecdef pour les 3 helpers RLS publics. Consomme par scripts/check-rls-helpers-security-definer.mjs au build Vercel pour verrouiller SECURITY DEFINER. Ne pas dropper sans mettre a jour le script.';
