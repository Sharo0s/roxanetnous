-- Code review 2026-04-29 H10 : la migration de backfill 20260428190000
-- générait les 317 codes des marraines existantes via random() PostgreSQL
-- (PRNG non cryptographique). Codes prévisibles si l'attaquant connaît le
-- timing/seed du backfill, ce qui réduit l'effective entropy bien en
-- dessous du 31^8 nominal et expose les 317 marraines validées (cible
-- de plus haute valeur) à un guessing attack.
--
-- On régénère TOUS les codes des marraines existantes via gen_random_bytes
-- (pgcrypto) sauf ceux qui ont déjà été partagés (i.e. associés à une
-- row dans parrainages). À l'instant T de cette migration, seuls 1 ou 2
-- codes sont utilisés ; les ~317 autres sont remplaçables sans casse.
--
-- gen_random_bytes(N) retourne N octets cryptographiquement sécurisés.
-- On les convertit en base31 (alphabet sans 0, O, 1, I, L) via division
-- modulaire, en bouclant jusqu'à obtenir 8 caractères.

BEGIN;

CREATE EXTENSION IF NOT EXISTS pgcrypto;

DO $$
DECLARE
  v_alphabet TEXT := '23456789ABCDEFGHJKMNPQRSTUVWXYZ'; -- 31 chars
  v_alphabet_len INT := length(v_alphabet);
  v_code_length INT := 8;
  v_user_id UUID;
  v_new_code TEXT;
  v_random_bytes BYTEA;
  v_byte_idx INT;
  v_max_attempts INT := 50;
  v_attempt INT;
BEGIN
  -- Pour chaque marraine ayant un code mais pas encore utilisé.
  FOR v_user_id IN
    SELECT pc.user_id
    FROM public.parrainages_codes pc
    WHERE NOT EXISTS (
      SELECT 1 FROM public.parrainages p WHERE p.code = pc.code
    )
  LOOP
    v_attempt := 0;
    LOOP
      v_attempt := v_attempt + 1;
      EXIT WHEN v_attempt > v_max_attempts;

      v_random_bytes := gen_random_bytes(v_code_length);
      v_new_code := '';
      FOR v_byte_idx IN 0..(v_code_length - 1) LOOP
        v_new_code := v_new_code || substr(
          v_alphabet,
          1 + (get_byte(v_random_bytes, v_byte_idx) % v_alphabet_len),
          1
        );
      END LOOP;

      -- Tenter l'UPDATE : si collision (UNIQUE sur code), on retente.
      BEGIN
        UPDATE public.parrainages_codes
        SET code = v_new_code
        WHERE user_id = v_user_id;
        EXIT; -- succès : sortir de la boucle de retry
      EXCEPTION WHEN unique_violation THEN
        -- Code déjà pris : on retente avec un nouveau random.
        CONTINUE;
      END;
    END LOOP;

    IF v_attempt > v_max_attempts THEN
      RAISE EXCEPTION 'Impossible de régénérer un code unique pour user % après % tentatives', v_user_id, v_max_attempts;
    END IF;
  END LOOP;
END;
$$;

COMMIT;
