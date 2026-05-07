
ALTER TABLE badges_cache ADD COLUMN IF NOT EXISTS disponible boolean NOT NULL DEFAULT false;
ALTER TABLE badges_cache ADD COLUMN IF NOT EXISTS actif boolean NOT NULL DEFAULT false;
ALTER TABLE badges_cache DROP COLUMN IF EXISTS annonce_active;
