ALTER TABLE auxiliaires_profiles ADD COLUMN IF NOT EXISTS justificatifs_diplomes jsonb DEFAULT '{}'::jsonb;

UPDATE auxiliaires_profiles
SET justificatifs_diplomes = jsonb_build_object(diplomes[1], justificatif_diplome_url)
WHERE justificatif_diplome_url IS NOT NULL
  AND diplomes IS NOT NULL
  AND array_length(diplomes, 1) > 0;
