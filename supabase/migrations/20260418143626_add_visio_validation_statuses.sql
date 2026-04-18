-- FR11bis / FR11ter : ajout des statuts intermediaires pour la validation par visioconference
-- Reference : sprint-change-proposal-2026-04-18-visio-validation.md
-- Additif : les profils deja 'valide' restent intacts (aucune retroactivite).
-- Note PostgreSQL : ALTER TYPE ADD VALUE doit s'executer en autocommit
-- (il ne peut pas etre suivi dans la meme transaction d'une requete qui lit la nouvelle valeur).

ALTER TYPE validation_status ADD VALUE IF NOT EXISTS 'visio_a_planifier' BEFORE 'valide';
ALTER TYPE validation_status ADD VALUE IF NOT EXISTS 'visio_realisee' BEFORE 'valide';
