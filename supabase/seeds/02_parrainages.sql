-- Seeds parrainages : 1 code marraine + 1 parrainage en cours + 1 parrainage bloque.
-- Prerequis : 01_users.sql applique (users 4=marraine, 5=filleule existent).

BEGIN;

-- 1. Code de parrainage pour la marraine (user 4).
INSERT INTO public.parrainages_codes (user_id, code, compteur_confirmes, total_recompenses)
VALUES (
  '00000000-0000-0000-0000-000000000004',
  'TESTSEED1',
  0,
  0
)
ON CONFLICT (user_id) DO NOTHING;

-- 2. Parrainage en cours (marraine 4 + filleule 5, statut 'inscrite').
INSERT INTO public.parrainages (
  id, code, marraine_id, filleule_id, statut, filleule_inscrite_at
)
VALUES (
  '00000000-0000-0000-0000-00000000aaa1',
  'TESTSEED1',
  '00000000-0000-0000-0000-000000000004',
  '00000000-0000-0000-0000-000000000005',
  'inscrite',
  now()
)
ON CONFLICT (id) DO NOTHING;

-- 3. Parrainage bloque (anti-fraude 'meme_carte').
--    filleule_id NULL pour eviter une 2e contrainte unique sur (filleule_id, statut)
--    qui rejetterait un 2e parrainage 'inscrite' avec la meme filleule.
INSERT INTO public.parrainages (
  id, code, marraine_id, filleule_id, statut, blocage_raison, stripe_fingerprint
)
VALUES (
  '00000000-0000-0000-0000-00000000aaa2',
  'TESTSEED1',
  '00000000-0000-0000-0000-000000000004',
  NULL,
  'bloque',
  'meme_carte',
  'fp_seed_blocage'
)
ON CONFLICT (id) DO NOTHING;

COMMIT;
