-- Code review 2026-04-29 C2/H7 : remplacer les CAS read-then-write par
-- des RPC PG atomiques pour le compteur et la récompense parrainage.
--
-- Bugs corrigés :
-- - Compteur CAS-miss : si deux runs cron concurrents lisaient le même
--   oldCompteur, l'un incrémentait, l'autre échouait silencieusement et
--   le parrainage restait 'confirme' SANS contrepartie au compteur.
-- - Reward CAS-miss : le coupon Stripe pouvait être créé et appliqué AVANT
--   que la BDD ne soit mise à jour. Si le CAS final ratait, on avait coupon
--   sans tracking, email "6 mois offerts" envoyé, mais total_recompenses
--   non incrémenté → pouvait re-trigger la même récompense au cron suivant.
--
-- L'approche RPC permet d'utiliser les opérations atomiques natives Postgres
-- (UPDATE col = col + 1 RETURNING) qui ne souffrent pas du lost-update.

BEGIN;

-- 1. Increment atomique du compteur. Retourne le nouveau compteur ou NULL si
--    aucune row trouvée.
CREATE OR REPLACE FUNCTION public.parrainage_increment_compteur(
  p_marraine_id UUID
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
  SET compteur_confirmes = compteur_confirmes + 1
  WHERE user_id = p_marraine_id
  RETURNING compteur_confirmes INTO v_new_compteur;

  RETURN v_new_compteur;
END;
$$;

REVOKE ALL ON FUNCTION public.parrainage_increment_compteur(UUID) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.parrainage_increment_compteur(UUID) FROM anon;
REVOKE ALL ON FUNCTION public.parrainage_increment_compteur(UUID) FROM authenticated;

COMMENT ON FUNCTION public.parrainage_increment_compteur(UUID) IS
  'Incrément atomique du compteur de parrainages confirmés. Service-role uniquement (cron). Retourne le nouveau compteur ou NULL si aucune row.';


-- 2. Claim atomique d'un palier de récompense. Décrémente compteur de
--    p_palier, incrémente total_recompenses, met à jour derniere_recompense_at.
--    Retourne TRUE si le claim réussit (compteur >= palier au moment du UPDATE),
--    FALSE sinon (un autre run a déjà claim ce palier ou compteur insuffisant).
CREATE OR REPLACE FUNCTION public.parrainage_claim_recompense(
  p_marraine_id UUID,
  p_palier INTEGER
)
RETURNS TABLE(claimed BOOLEAN, total_recompenses INTEGER)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_total_recompenses INTEGER;
BEGIN
  UPDATE public.parrainages_codes
  SET
    compteur_confirmes = compteur_confirmes - p_palier,
    total_recompenses = total_recompenses + 1,
    derniere_recompense_at = now()
  WHERE user_id = p_marraine_id
    AND compteur_confirmes >= p_palier
  RETURNING parrainages_codes.total_recompenses INTO v_total_recompenses;

  IF v_total_recompenses IS NULL THEN
    RETURN QUERY SELECT FALSE, NULL::INTEGER;
  ELSE
    RETURN QUERY SELECT TRUE, v_total_recompenses;
  END IF;
END;
$$;

REVOKE ALL ON FUNCTION public.parrainage_claim_recompense(UUID, INTEGER) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.parrainage_claim_recompense(UUID, INTEGER) FROM anon;
REVOKE ALL ON FUNCTION public.parrainage_claim_recompense(UUID, INTEGER) FROM authenticated;

COMMENT ON FUNCTION public.parrainage_claim_recompense(UUID, INTEGER) IS
  'Claim atomique d''un palier de récompense parrainage. Service-role uniquement (cron). Garantit qu''un seul run cron peut consommer un palier donné, même en cas d''overlap.';


-- 3. Rollback atomique d'un claim (en cas d'échec Stripe après claim BDD).
--    Idempotent : ne rollback que si total_recompenses = p_expected_total
--    (sinon un autre claim a entre-temps incrémenté et le rollback serait
--    incorrect).
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
  'Rollback d''un claim en cas d''échec Stripe. Idempotent via expected_total.';

COMMIT;
