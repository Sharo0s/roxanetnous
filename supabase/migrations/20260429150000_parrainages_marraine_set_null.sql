-- Code review 2026-04-29 M6 : la FK parrainages.marraine_id était
-- ON DELETE CASCADE, ce qui détruisait l'historique complet des
-- parrainages d'une marraine supprimée (rows confirmees, en cours,
-- bloquees, fraude). Plus aucun moyen de retracer les filleules qu'elle
-- a sponsorisées, et le compteur des filleules orphelines (parrainee_par
-- déjà SET NULL) devenait incohérent.
--
-- On passe en ON DELETE SET NULL pour préserver l'historique. Nécessite
-- de rendre marraine_id NULLABLE puisqu'on autorise NULL après deletion.
-- Les requêtes existantes filtrent toujours sur statut + filleule_id,
-- les rows orphelines ne perturbent ni le cron ni le webhook.

BEGIN;

ALTER TABLE public.parrainages
  ALTER COLUMN marraine_id DROP NOT NULL;

ALTER TABLE public.parrainages
  DROP CONSTRAINT parrainages_marraine_id_fkey;

ALTER TABLE public.parrainages
  ADD CONSTRAINT parrainages_marraine_id_fkey
  FOREIGN KEY (marraine_id) REFERENCES public.users(id) ON DELETE SET NULL;

COMMENT ON COLUMN public.parrainages.marraine_id IS
  'FK users.id ON DELETE SET NULL : on préserve l''historique des parrainages même si la marraine est supprimée.';

COMMIT;
