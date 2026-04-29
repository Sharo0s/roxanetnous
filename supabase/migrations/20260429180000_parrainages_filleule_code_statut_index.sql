-- Code review 2026-04-29 L10 : index composite pour le hot-path lookup
-- de confirmParrainageOnSuccess et captureParrainageFingerprint qui font :
--
--   SELECT ... FROM parrainages
--   WHERE code = ? AND filleule_id = ? AND statut IN (...)
--
-- L'index existant sur filleule_id seul est utilisable mais sous-optimal
-- car il scanne plusieurs rows si la filleule a multiples parrainages
-- (rare mais possible). Index composite directement sur les 3 colonnes
-- en filtre = lookup O(1).

BEGIN;

CREATE INDEX IF NOT EXISTS parrainages_filleule_code_statut_idx
  ON public.parrainages (filleule_id, code, statut);

COMMIT;
