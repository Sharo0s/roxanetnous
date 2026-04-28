-- Backfill 2026-04-28 : genere un code de parrainage pour toutes les
-- accompagnantes validees qui n'en ont pas (cas des marraines validees
-- avant le deploiement de la feature parrainage).

BEGIN;

CREATE OR REPLACE FUNCTION public.generate_unique_parrainage_code()
RETURNS TEXT
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_code TEXT;
  v_attempt INT := 0;
  v_alphabet TEXT := 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';
  v_exists BOOLEAN;
BEGIN
  LOOP
    v_attempt := v_attempt + 1;
    IF v_attempt > 10 THEN
      RAISE EXCEPTION 'Could not generate unique parrainage code after 10 attempts';
    END IF;

    SELECT string_agg(
      substr(v_alphabet, 1 + floor(random() * length(v_alphabet))::int, 1),
      ''
    ) INTO v_code
    FROM generate_series(1, 8);

    SELECT EXISTS (SELECT 1 FROM public.parrainages_codes WHERE code = v_code) INTO v_exists;
    EXIT WHEN NOT v_exists;
  END LOOP;

  RETURN v_code;
END;
$$;

REVOKE ALL ON FUNCTION public.generate_unique_parrainage_code() FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.generate_unique_parrainage_code() FROM anon;
REVOKE EXECUTE ON FUNCTION public.generate_unique_parrainage_code() FROM authenticated;
GRANT EXECUTE ON FUNCTION public.generate_unique_parrainage_code() TO service_role;

INSERT INTO public.parrainages_codes (user_id, code)
SELECT u.id, generate_unique_parrainage_code()
FROM public.users u
JOIN public.accompagnantes_profiles ap ON ap.user_id = u.id
LEFT JOIN public.parrainages_codes pc ON pc.user_id = u.id
WHERE u.role = 'accompagnante'
  AND ap.validation_status = 'valide'
  AND pc.user_id IS NULL;

COMMIT;
