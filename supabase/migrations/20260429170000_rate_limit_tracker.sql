-- Code review 2026-04-29 H12 : la fonction validateCode était exposée sans
-- authentification, en service-role, et retournait marraineFirstName.
-- Oracle d'énumération : un attaquant peut tester 31^8 codes (~8e11) pour
-- découvrir des codes valides et leurs marraines associées.
--
-- Rate-limit léger côté Postgres (pas de dépendance Upstash/Redis nouvelle).
-- Une table par-clé (key = IP client) avec compteur + fenêtre glissante.
-- RPC try_consume_rate_limit : incrémente atomiquement si sous le seuil,
-- retourne FALSE sinon. À utiliser depuis tout endpoint publiquement
-- exposé qu'on veut protéger.

BEGIN;

CREATE TABLE IF NOT EXISTS public.rate_limit_tracker (
  key TEXT PRIMARY KEY,
  count INT NOT NULL DEFAULT 0,
  window_start TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- RLS bloquée par défaut : seul service-role accède.
ALTER TABLE public.rate_limit_tracker ENABLE ROW LEVEL SECURITY;

-- Policy explicite "deny all" pour les rôles client (anon + authenticated).
-- La RPC try_consume_rate_limit (SECURITY DEFINER avec REVOKE depuis ces
-- rôles) est le seul vecteur d'accès légitime.
CREATE POLICY "rate_limit_tracker_deny_all" ON public.rate_limit_tracker
  FOR ALL TO authenticated, anon
  USING (false)
  WITH CHECK (false);

-- Index pour purge (cleanup éventuel des entrées vieilles).
CREATE INDEX IF NOT EXISTS rate_limit_tracker_window_start_idx
  ON public.rate_limit_tracker (window_start);


CREATE OR REPLACE FUNCTION public.try_consume_rate_limit(
  p_key TEXT,
  p_max_requests INT,
  p_window_seconds INT
)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_now TIMESTAMPTZ := now();
  v_window_start TIMESTAMPTZ;
  v_count INT;
BEGIN
  -- INSERT ON CONFLICT : si la clé n'existe pas, on l'insère avec count=1.
  -- Si elle existe et que la fenêtre est dépassée, on reset (count=1, window_start=now()).
  -- Sinon, on incrémente.
  INSERT INTO public.rate_limit_tracker (key, count, window_start)
  VALUES (p_key, 1, v_now)
  ON CONFLICT (key) DO UPDATE
  SET
    count = CASE
      WHEN public.rate_limit_tracker.window_start + (p_window_seconds || ' seconds')::INTERVAL < v_now
        THEN 1
      ELSE public.rate_limit_tracker.count + 1
    END,
    window_start = CASE
      WHEN public.rate_limit_tracker.window_start + (p_window_seconds || ' seconds')::INTERVAL < v_now
        THEN v_now
      ELSE public.rate_limit_tracker.window_start
    END
  RETURNING count INTO v_count;

  -- Retourne TRUE si on est encore sous le seuil après increment.
  RETURN v_count <= p_max_requests;
END;
$$;

REVOKE ALL ON FUNCTION public.try_consume_rate_limit(TEXT, INT, INT) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.try_consume_rate_limit(TEXT, INT, INT) FROM anon;
REVOKE ALL ON FUNCTION public.try_consume_rate_limit(TEXT, INT, INT) FROM authenticated;

COMMENT ON FUNCTION public.try_consume_rate_limit(TEXT, INT, INT) IS
  'Rate-limit fenêtre glissante. Service-role uniquement. Retourne TRUE si sous le seuil après increment, FALSE si seuil dépassé.';

COMMIT;
