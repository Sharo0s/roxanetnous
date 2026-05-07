-- Seeds waitlist Bretagne : 5 inscriptions sur 4 departements bretons distincts
-- (29 Finistere x2, 22 Cotes-d'Armor, 35 Ille-et-Vilaine, 56 Morbihan).
-- Sert les futures stories Epic 5+ qui auront besoin d'un dataset stable
-- pour tester les flows admin (toggleDepartement notify-waitlist, etc.).

BEGIN;

INSERT INTO public.waitlist_departements (id, email, code_departement, role, ip_inscription)
VALUES
  ('00000000-0000-0000-0000-00000000bbb1', 'seed-waitlist-1@test.local', '29', 'accompagne', '127.0.0.1'),
  ('00000000-0000-0000-0000-00000000bbb2', 'seed-waitlist-2@test.local', '22', 'accompagnante', '127.0.0.1'),
  ('00000000-0000-0000-0000-00000000bbb3', 'seed-waitlist-3@test.local', '35', 'accompagne', '127.0.0.1'),
  ('00000000-0000-0000-0000-00000000bbb4', 'seed-waitlist-4@test.local', '56', 'accompagnante', '127.0.0.1'),
  ('00000000-0000-0000-0000-00000000bbb5', 'seed-waitlist-5@test.local', '29', 'accompagnante', '127.0.0.1')
ON CONFLICT (id) DO NOTHING;

COMMIT;
