-- Seeds users + profils. UUID fixes pour reproductibilite cross-runs.
-- Le script scripts/seed-test-supabase.mjs cree d'abord les users dans auth.users
-- via supabase.auth.admin.createUser({ id: 'UUID-fixe', user_metadata: { role, ... } }).
-- Le trigger handle_new_user (migration brownfield 20260404134919) cree
-- automatiquement les rows public.users + accompagnantes_profiles ou
-- accompagnes_profiles selon le role metadata. Ce fichier UPDATE les rows pour
-- enrichir les champs metier (validation_status, adresse, etc.).

BEGIN;

-- 1. UPDATE public.users : ajuster role/first_name/last_name (le trigger pose
--    seulement les valeurs du metadata, on enrichit ici).
--    Note : les role 'admin' n'est pas pris par le trigger qui ne supporte que
--    'accompagnante'/'accompagne' (cf. migration handle_new_user). On force le
--    role pour le user 1 (admin).
UPDATE public.users SET role = 'admin', first_name = 'Seed', last_name = 'Admin'
  WHERE id = '00000000-0000-0000-0000-000000000001';

UPDATE public.users SET role = 'accompagnante', first_name = 'Seed', last_name = 'Accompagnante'
  WHERE id = '00000000-0000-0000-0000-000000000002';

UPDATE public.users SET role = 'accompagne', first_name = 'Seed', last_name = 'Accompagne'
  WHERE id = '00000000-0000-0000-0000-000000000003';

UPDATE public.users SET role = 'accompagnante', first_name = 'Seed', last_name = 'Marraine'
  WHERE id = '00000000-0000-0000-0000-000000000004';

UPDATE public.users SET role = 'accompagnante', first_name = 'Seed', last_name = 'Filleule'
  WHERE id = '00000000-0000-0000-0000-000000000005';

-- 2. UPDATE accompagnantes_profiles : valide les profils (le trigger les cree
--    en validation_status = 'en_attente' par defaut).
UPDATE public.accompagnantes_profiles
  SET validation_status = 'valide', adresse = 'Seed Address Bretagne'
  WHERE user_id IN (
    '00000000-0000-0000-0000-000000000002',
    '00000000-0000-0000-0000-000000000004',
    '00000000-0000-0000-0000-000000000005'
  );

COMMIT;
