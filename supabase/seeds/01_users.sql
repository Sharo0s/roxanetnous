-- Seeds users + profils. UUID fixes pour reproductibilite cross-runs.
-- Le script scripts/seed-test-supabase.mjs cree d'abord les users dans auth.users
-- via supabase.auth.admin.createUser({ id: 'UUID-fixe', user_metadata: { role, ... } }).
-- Le trigger handle_new_user (migration brownfield 20260404134919) cree
-- automatiquement les rows public.users + accompagnants_profiles ou
-- accompagnes_profiles selon le role metadata. Ce fichier UPDATE les rows pour
-- enrichir les champs metier (validation_status, adresse, etc.).
--
-- Note story 5.A.2 (2026-05-13) : enum user_role migre `accompagnante` -> `accompagnant`
-- + table `accompagnantes_profiles` renommee `accompagnants_profiles`. Seeds alignes ici
-- (fix-CI 2026-05-14 post-7.A.6 - 1er run GHA depuis migration enum).

BEGIN;

-- 1. UPDATE public.users : ajuster role/first_name/last_name (le trigger pose
--    seulement les valeurs du metadata, on enrichit ici).
--    Note : les role 'admin' n'est pas pris par le trigger qui ne supporte que
--    'accompagnant'/'accompagne' (cf. migration handle_new_user). On force le
--    role pour le user 1 (admin).
UPDATE public.users SET role = 'admin', first_name = 'Seed', last_name = 'Admin'
  WHERE id = '00000000-0000-0000-0000-000000000001';

UPDATE public.users SET role = 'accompagnant', first_name = 'Seed', last_name = 'Accompagnant'
  WHERE id = '00000000-0000-0000-0000-000000000002';

UPDATE public.users SET role = 'accompagne', first_name = 'Seed', last_name = 'Accompagne'
  WHERE id = '00000000-0000-0000-0000-000000000003';

UPDATE public.users SET role = 'accompagnant', first_name = 'Seed', last_name = 'Marraine'
  WHERE id = '00000000-0000-0000-0000-000000000004';

UPDATE public.users SET role = 'accompagnant', first_name = 'Seed', last_name = 'Filleule'
  WHERE id = '00000000-0000-0000-0000-000000000005';

-- 2. UPDATE accompagnants_profiles : valide les profils (le trigger les cree
--    en validation_status = 'a_completer' par defaut depuis migration 2026-05-10).
--    Note : la migration 20260510234500 ajoute le CHECK constraint
--    `accompagnants_profiles_completion_check` qui exige que tout profil hors
--    'a_completer' ait ville + code_postal + experience + specialites (>=1)
--    + diplomes (>=1) renseignes. On remplit donc tous ces champs en plus
--    de validation_status = 'valide'.
UPDATE public.accompagnants_profiles
  SET validation_status = 'valide',
      adresse = 'Seed Address Bretagne',
      ville = 'Rennes',
      code_postal = '35000',
      experience = 'Seed experience accompagnant 5 ans',
      specialites = ARRAY['Personnes agees'],
      diplomes = ARRAY['DEAES']
  WHERE user_id IN (
    '00000000-0000-0000-0000-000000000002',
    '00000000-0000-0000-0000-000000000004',
    '00000000-0000-0000-0000-000000000005'
  );

COMMIT;
