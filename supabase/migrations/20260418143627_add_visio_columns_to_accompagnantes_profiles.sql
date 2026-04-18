-- FR11bis : colonnes de tracabilite visio sur les profils accompagnantes
-- Reference : sprint-change-proposal-2026-04-18-visio-validation.md

ALTER TABLE public.accompagnantes_profiles
  ADD COLUMN IF NOT EXISTS visio_date TIMESTAMPTZ NULL,
  ADD COLUMN IF NOT EXISTS visio_notes TEXT NULL;

COMMENT ON COLUMN public.accompagnantes_profiles.visio_date IS 'Date de la visio de validation (FR11bis)';
COMMENT ON COLUMN public.accompagnantes_profiles.visio_notes IS 'Notes libres de l''admin apres la visio (FR11bis)';
