-- Story 5.A.2 part 1 : ajout de la valeur enum 'accompagnant'
--
-- Postgres exige que la valeur ADD VALUE soit committee avant d'etre utilisable
-- dans la meme transaction. On split donc en 2 migrations sequentielles :
-- - Part 1 (ce fichier) : ADD VALUE
-- - Part 2 : UPDATE backfill + RENAME COLUMN + helpers RLS + policies

ALTER TYPE user_role ADD VALUE IF NOT EXISTS 'accompagnant' BEFORE 'accompagne';
