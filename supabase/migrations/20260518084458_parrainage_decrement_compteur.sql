-- Story 9.A.5 : RPC atomique decrement compteur_confirmes (defer F15 Epic 8).
-- Symetrique de parrainage_increment_compteur (20260429140000_parrainage_atomic_rpcs.sql:20-45).
-- Remplace le read-modify-write non atomique dans confirmerFraude
-- (app/actions/admin-parrainages.ts:174-193) qui souffre d'une race lost-update
-- si deux admins confirment fraude simultanement sur le meme parrain.
--
-- Service-role only (admin confirmerFraude). Borne a zero cote SQL via GREATEST.
-- Retourne nouveau compteur ou NULL si aucune row (parrain sans code genere).

CREATE OR REPLACE FUNCTION public.parrainage_decrement_compteur(
  p_user_id UUID,
  p_delta INTEGER DEFAULT 1
)
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_new_compteur INTEGER;
BEGIN
  UPDATE public.parrainages_codes
  SET compteur_confirmes = GREATEST(compteur_confirmes - p_delta, 0)
  WHERE user_id = p_user_id
  RETURNING compteur_confirmes INTO v_new_compteur;

  RETURN v_new_compteur;
END;
$$;

REVOKE ALL ON FUNCTION public.parrainage_decrement_compteur(UUID, INTEGER) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.parrainage_decrement_compteur(UUID, INTEGER) FROM anon;
REVOKE ALL ON FUNCTION public.parrainage_decrement_compteur(UUID, INTEGER) FROM authenticated;

COMMENT ON FUNCTION public.parrainage_decrement_compteur(UUID, INTEGER) IS
  'Decrement atomique borne a zero de compteur_confirmes (parrainages_codes). Service-role uniquement (admin confirmerFraude). Retourne le nouveau compteur ou NULL si aucune row. Story 9.A.5 (defer F15).';
