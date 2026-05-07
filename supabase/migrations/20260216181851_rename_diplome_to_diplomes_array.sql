ALTER TABLE public.auxiliaires_profiles
  ADD COLUMN diplomes text[] DEFAULT '{}';

UPDATE public.auxiliaires_profiles
  SET diplomes = CASE WHEN diplome IS NOT NULL THEN ARRAY[diplome] ELSE '{}' END;

ALTER TABLE public.auxiliaires_profiles
  DROP COLUMN diplome;
