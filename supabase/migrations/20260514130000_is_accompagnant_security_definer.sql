-- Story 7.A.8 : alignement is_accompagnant() SECURITY DEFINER (decision F-Epic7-A8)
--
-- Contexte : audit Epic 6 a detecte que public.is_accompagnant() etait cree en
-- SECURITY INVOKER par defaut (drift 2026-05-13 migration 6.A.2 part 2 ligne 70-76,
-- propage 6.A.M ligne 197-206), alors que ses 2 jumelles is_admin() et is_accompagne()
-- sont SECURITY DEFINER. Audit MCP 2026-05-14 : 0 policy / 0 fonction / 0 vue en
-- prod appelle is_accompagnant() -> migration sans impact runtime, cutover < 100ms.
--
-- Decision F-Epic7-A8 : aligner sur les jumelles is_admin() et is_accompagne()
-- (coherence POLA + symetrie + piege futur si cablage dans policy users_*).
--
-- Idempotent : ALTER FUNCTION ... SECURITY DEFINER est no-op si deja DEFINER.

ALTER FUNCTION public.is_accompagnant() SECURITY DEFINER;

COMMENT ON FUNCTION public.is_accompagnant() IS
  'Helper RLS : true si auth.uid() a role=accompagnant. SECURITY DEFINER aligne sur is_admin() et is_accompagne() (decision F-Epic7-A8, story 7.A.8). Toute modification doit preserver cette clause. Verrouille par scripts/check-rls-helpers-security-definer.mjs.';
