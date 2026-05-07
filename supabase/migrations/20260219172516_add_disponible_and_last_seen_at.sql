
ALTER TABLE auxiliaires_profiles ADD COLUMN IF NOT EXISTS disponible boolean NOT NULL DEFAULT true;

ALTER TABLE users ADD COLUMN IF NOT EXISTS last_seen_at timestamptz;
