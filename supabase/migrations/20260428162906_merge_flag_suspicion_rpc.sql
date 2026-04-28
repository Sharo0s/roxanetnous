-- M4 (code review 2026-04-28) : RPC atomique pour merger un flag dans
-- parrainages.flag_suspicion sans perdre les flags posés concurremment.
-- Le compare-and-swap côté code (eq('flag_suspicion', flagGuard)) échouait
-- silencieusement si une autre instance du webhook avait déjà ajouté un autre
-- flag entre la lecture et l'update -> perte de signal anti-fraude.
--
-- La RPC fait merge string -> array dédupliqué -> string en une seule
-- transaction PG. Idempotente (ne re-pose pas un flag déjà présent),
-- atomic (verrouillage de la row le temps de l'UPDATE).

BEGIN;

CREATE OR REPLACE FUNCTION public.merge_parrainage_flag_suspicion(
  p_parrainage_id UUID,
  p_flag TEXT
)
RETURNS TABLE (id UUID, flag_suspicion TEXT, was_added BOOLEAN)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_existing TEXT;
  v_flags TEXT[];
  v_new TEXT;
  v_was_added BOOLEAN;
BEGIN
  IF p_flag IS NULL OR length(trim(p_flag)) = 0 THEN
    RAISE EXCEPTION 'flag must be non-empty';
  END IF;

  -- Verrouillage en lecture pour éviter le toctou avec un autre worker
  SELECT parrainages.flag_suspicion INTO v_existing
  FROM public.parrainages
  WHERE parrainages.id = p_parrainage_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RETURN;
  END IF;

  -- Split, trim, retire les vides et dédup
  v_flags := COALESCE(string_to_array(v_existing, ','), ARRAY[]::TEXT[]);
  v_flags := ARRAY(
    SELECT DISTINCT t FROM (
      SELECT trim(f) AS t FROM unnest(v_flags) AS f
    ) sub
    WHERE t <> ''
  );

  IF p_flag = ANY(v_flags) THEN
    v_was_added := FALSE;
    v_new := v_existing;
  ELSE
    v_was_added := TRUE;
    v_flags := array_append(v_flags, p_flag);
    v_new := array_to_string(v_flags, ',');
    UPDATE public.parrainages
    SET flag_suspicion = v_new
    WHERE parrainages.id = p_parrainage_id;
  END IF;

  RETURN QUERY SELECT p_parrainage_id, v_new, v_was_added;
END;
$$;

-- Note : Supabase accorde par defaut EXECUTE a anon et authenticated lors de la
-- creation. REVOKE ... FROM PUBLIC ne couvre pas ces roles -> revocation explicite.
REVOKE ALL ON FUNCTION public.merge_parrainage_flag_suspicion(UUID, TEXT) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.merge_parrainage_flag_suspicion(UUID, TEXT) FROM anon;
REVOKE EXECUTE ON FUNCTION public.merge_parrainage_flag_suspicion(UUID, TEXT) FROM authenticated;
GRANT EXECUTE ON FUNCTION public.merge_parrainage_flag_suspicion(UUID, TEXT) TO service_role;

COMMENT ON FUNCTION public.merge_parrainage_flag_suspicion(UUID, TEXT) IS
  'Merge atomique d''un flag dans parrainages.flag_suspicion (csv dedup). Renvoie was_added=true si le flag a effectivement été ajouté.';

COMMIT;
