-- Story 6.A.4 : aligner historique admin_actions_log target_type
-- 'accompagnante' -> 'accompagnant'
--
-- Decision Sylvain 2026-05-13 : aligner l'historique log apres le rename
-- des 5 inserts code en masculin (toujours dans 6.A.4). Coherence totale
-- code / log / BDD.
--
-- Audit pre-migration : 24 lignes target_type='accompagnante' (27 lignes
-- target_type='accompagne' inchangees). Post-migration : 0 ligne
-- target_type='accompagnante', 24 lignes 'accompagnant', 27 lignes
-- 'accompagne'.

UPDATE public.admin_actions_log
SET target_type = 'accompagnant'
WHERE target_type = 'accompagnante';
