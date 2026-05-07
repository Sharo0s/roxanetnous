CREATE OR REPLACE FUNCTION public.parrainage_rollback_recompense(
  p_marraine_id UUID,
  p_palier INTEGER,
  p_expected_total INTEGER
)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_rolled_back UUID;
BEGIN
  UPDATE public.parrainages_codes
  SET
    compteur_confirmes = compteur_confirmes + p_palier,
    total_recompenses = total_recompenses - 1,
    derniere_recompense_at = NULL
  WHERE user_id = p_marraine_id
    AND total_recompenses = p_expected_total
  RETURNING user_id INTO v_rolled_back;

  RETURN v_rolled_back IS NOT NULL;
END;
$$;

REVOKE ALL ON FUNCTION public.parrainage_rollback_recompense(UUID, INTEGER, INTEGER) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.parrainage_rollback_recompense(UUID, INTEGER, INTEGER) FROM anon;
REVOKE ALL ON FUNCTION public.parrainage_rollback_recompense(UUID, INTEGER, INTEGER) FROM authenticated;

COMMENT ON FUNCTION public.parrainage_rollback_recompense(UUID, INTEGER, INTEGER) IS
  'Rollback d''un claim en cas d''echec Stripe. Idempotent via expected_total.';
