-- Table waitlist_departements : capture email visiteurs hors zone (FR46, story 3.4).
-- RLS : aucune policy publique. Service-role uniquement (Server Actions).
-- FK vers departements_ouverts.code garantit que seuls des codes existants
-- sont stockes ; CASCADE purge la waitlist si un dpt est supprime.

CREATE TABLE public.waitlist_departements (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  email TEXT NOT NULL CHECK (email ~* '^[^@\s]+@[^@\s]+\.[^@\s]+$' AND length(email) <= 254),
  code_departement TEXT NOT NULL REFERENCES public.departements_ouverts(code) ON DELETE CASCADE,
  role TEXT CHECK (role IS NULL OR role IN ('accompagnante', 'accompagne', 'visiteur')),
  ip_inscription TEXT,
  user_agent TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  notified_at TIMESTAMPTZ
);

CREATE UNIQUE INDEX waitlist_departements_email_code_uniq
  ON public.waitlist_departements (lower(email), code_departement);

CREATE INDEX idx_waitlist_departements_code_notified
  ON public.waitlist_departements (code_departement, notified_at);

ALTER TABLE public.waitlist_departements ENABLE ROW LEVEL SECURITY;

-- Aucune policy publique : tout passe par service_role (Server Actions).
-- Une policy explicite "deny_all" clarifie l'intention pour les futurs lecteurs.
CREATE POLICY "waitlist_departements_deny_all"
  ON public.waitlist_departements
  FOR ALL TO anon, authenticated
  USING (false)
  WITH CHECK (false);

COMMENT ON TABLE public.waitlist_departements IS
  'Inscriptions waitlist pour notification d''ouverture geographique (story 3.4 / FR46). Service-role only.';
