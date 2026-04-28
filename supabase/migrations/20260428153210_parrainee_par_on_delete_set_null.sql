-- Story 2.1 - patch post-revue : ON DELETE SET NULL sur users.parrainee_par
-- Sans cette clause, supprimer une marraine échoue si elle a au moins une filleule
-- (FK violation). Cohérent avec parrainages.filleule_id ON DELETE SET NULL.

BEGIN;

ALTER TABLE public.users
  DROP CONSTRAINT IF EXISTS users_parrainee_par_fkey;

ALTER TABLE public.users
  ADD CONSTRAINT users_parrainee_par_fkey
  FOREIGN KEY (parrainee_par)
  REFERENCES public.users(id)
  ON DELETE SET NULL;

COMMIT;
