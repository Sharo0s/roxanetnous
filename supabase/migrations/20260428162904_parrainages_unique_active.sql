-- P13 (code review 2026-04-28) : empêche les doublons concurrents sur
-- parrainages(filleule_id, code) lors d'un double POST signup. Index partiel
-- qui couvre seulement les statuts actifs ; on conserve les rows 'bloque' /
-- 'fraude' pour l'audit historique sans contrainte d'unicité.

BEGIN;

CREATE UNIQUE INDEX IF NOT EXISTS parrainages_filleule_code_active_unique
  ON public.parrainages (filleule_id, code)
  WHERE statut IN ('inscrite', 'abonnee', 'confirme');

COMMIT;
