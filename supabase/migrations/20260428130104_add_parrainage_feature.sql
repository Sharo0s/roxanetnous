-- Programme de parrainage entre accompagnantes
-- FR11quinquies / FR45 / FR46 / FR47 / FR48 (PRD 2026-04-18, SCP 2026-04-18)
-- Strictement additive : aucune table existante modifiee, seulement des AJOUTS.
-- Story 2.1 - validation automatique filleule (server-side)

BEGIN;

-- 1. Table parrainages_codes (1 ligne par accompagnante validee)
CREATE TABLE IF NOT EXISTS public.parrainages_codes (
  user_id UUID PRIMARY KEY REFERENCES public.users(id) ON DELETE CASCADE,
  code TEXT NOT NULL UNIQUE,
  compteur_confirmes INTEGER NOT NULL DEFAULT 0,
  total_recompenses INTEGER NOT NULL DEFAULT 0,
  derniere_recompense_at TIMESTAMPTZ NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_parrainages_codes_code ON public.parrainages_codes(code);

-- 2. Table parrainages (historique relation marraine/filleule)
CREATE TABLE IF NOT EXISTS public.parrainages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  code TEXT NOT NULL,
  marraine_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  filleule_id UUID NULL REFERENCES public.users(id) ON DELETE SET NULL,
  statut TEXT NOT NULL DEFAULT 'en_attente'
    CHECK (statut IN ('en_attente', 'inscrite', 'abonnee', 'confirme', 'fraude', 'bloque')),
  filleule_inscrite_at TIMESTAMPTZ NULL,
  filleule_abonnee_at TIMESTAMPTZ NULL,
  confirme_at TIMESTAMPTZ NULL,
  ip_inscription TEXT NULL,
  stripe_fingerprint TEXT NULL,
  blocage_raison TEXT NULL,
  flag_suspicion TEXT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_parrainages_code ON public.parrainages(code);
CREATE INDEX IF NOT EXISTS idx_parrainages_marraine ON public.parrainages(marraine_id);
CREATE INDEX IF NOT EXISTS idx_parrainages_filleule ON public.parrainages(filleule_id);
CREATE INDEX IF NOT EXISTS idx_parrainages_statut ON public.parrainages(statut);

-- 3. Colonne parrainee_par sur users
ALTER TABLE public.users
  ADD COLUMN IF NOT EXISTS parrainee_par UUID NULL REFERENCES public.users(id);

-- 4. Colonne validation_source sur accompagnantes_profiles
ALTER TABLE public.accompagnantes_profiles
  ADD COLUMN IF NOT EXISTS validation_source TEXT NOT NULL DEFAULT 'manuelle'
    CHECK (validation_source IN ('manuelle', 'parrainage'));

-- 5. RLS policies
ALTER TABLE public.parrainages_codes ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "parrainages_codes_owner_read" ON public.parrainages_codes;
CREATE POLICY "parrainages_codes_owner_read" ON public.parrainages_codes
  FOR SELECT USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "parrainages_codes_admin_full" ON public.parrainages_codes;
CREATE POLICY "parrainages_codes_admin_full" ON public.parrainages_codes
  FOR ALL USING (
    EXISTS (SELECT 1 FROM public.users WHERE id = auth.uid() AND role = 'admin')
  );

ALTER TABLE public.parrainages ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "parrainages_marraine_read" ON public.parrainages;
CREATE POLICY "parrainages_marraine_read" ON public.parrainages
  FOR SELECT USING (auth.uid() = marraine_id);

DROP POLICY IF EXISTS "parrainages_admin_full" ON public.parrainages;
CREATE POLICY "parrainages_admin_full" ON public.parrainages
  FOR ALL USING (
    EXISTS (SELECT 1 FROM public.users WHERE id = auth.uid() AND role = 'admin')
  );

-- 6. Commentaires de documentation
COMMENT ON TABLE public.parrainages_codes IS 'Code de parrainage unique par accompagnante validee (FR11quinquies)';
COMMENT ON TABLE public.parrainages IS 'Historique des relations marraine/filleule et audit anti-fraude (FR45-FR48)';
COMMENT ON COLUMN public.accompagnantes_profiles.validation_source IS 'Source de la validation : manuelle (OCR+visio) ou parrainage (bypass)';
COMMENT ON COLUMN public.users.parrainee_par IS 'Marraine ayant parraine cet utilisateur, null si inscription normale';

COMMIT;
