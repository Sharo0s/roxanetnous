-- Story 7.A.7 : CHECK XOR target_id / target_id_text (decision F-Epic7-A7)
--
-- Contexte : story 3.5 a ajoute target_id_text (code TEXT) pour absorber les identifiants
-- non-UUID (toggleDepartement/toggleRegion). Mutex applicatif uniquement (cf. commentaire
-- migration 20260506130000_admin_actions_log_target_id_text.sql L15-17). Aucun CHECK BDD
-- n empechait un futur call-site de shipper (target_id NULL ET target_id_text NULL) OU
-- (target_id NOT NULL ET target_id_text NOT NULL), corrompant l audit trail.
--
-- Cette migration formalise l invariant via CHECK BDD :
--   (target_id IS NULL) <> (target_id_text IS NULL)
-- soit exactement un des deux renseigne (XOR strict).
--
-- Pattern NOT VALID + VALIDATE : la NOT VALID phase ajoute la contrainte SANS verifier les
-- lignes historiques (acquire ACCESS EXCLUSIVE briefly, ~10ms). La VALIDATE phase scanne
-- toute la table sous SHARE UPDATE EXCLUSIVE (lectures + ecritures non bloquees, juste
-- les autres ALTER concurrents). Audit MCP 2026-05-14 : 85 rows toutes conformes (100%
-- uuid_only), VALIDATE scan < 1 seconde. Pour les tables >100k rows, le pattern reste
-- preferable a un CHECK direct qui poserait un AccessExclusiveLock pendant le scan.
--
-- Effet runtime post-migration : tout INSERT/UPDATE shipping (target_id NULL = target_id_text NULL)
-- est rejete avec code SQLSTATE 23514 (check_violation) message
-- "new row for relation admin_actions_log violates check constraint target_id_xor".
--
-- Heritage : story 3.5 D1 (introduction target_id_text), story 7.A.6 (pattern audit MCP
-- pre-cutover + DECISIONS F-Epic7-A7), story 4.2 (pattern migration idempotente).
-- Cf. memoire project_admin_actions_log_target_id_bug : ce CHECK clot definitivement le bug
-- latent decouvert 2026-05-06 (target_id NOT NULL + 2 call-sites posant null) ET previent
-- toute regression future via les 29 call-sites insert direct.

-- 1) NOT VALID : declare la contrainte sans scanner les rows historiques.
-- Si la contrainte existe deja (re-execution), DO NOTHING.
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'target_id_xor'
      AND conrelid = 'public.admin_actions_log'::regclass
  ) THEN
    ALTER TABLE public.admin_actions_log
      ADD CONSTRAINT target_id_xor
      CHECK ((target_id IS NULL) <> (target_id_text IS NULL))
      NOT VALID;
  END IF;
END
$$;

-- 2) VALIDATE : scanne la table en SHARE UPDATE EXCLUSIVE (non bloquant lectures/ecritures).
-- Idempotent : si deja VALIDATED, VALIDATE retourne sans erreur (Postgres skip).
ALTER TABLE public.admin_actions_log
  VALIDATE CONSTRAINT target_id_xor;

-- 3) Lever la NOT NULL constraint sur target_id : sinon les call-sites dpt/region
-- qui posent target_id: null heurtent 23502 (not_null_violation) AVANT le CHECK XOR.
-- Le CHECK XOR garantit deja "au moins un des deux renseigne", donc la NOT NULL est
-- redondante et hostile aux flows non-UUID. Pas de risque de regression : les call-sites
-- UUID (29 sur 31) continuent de poser target_id non-null par construction TS.
ALTER TABLE public.admin_actions_log
  ALTER COLUMN target_id DROP NOT NULL;

-- 4) Comment colonnes mis a jour (heritage 7.A.6 commentaire index).
COMMENT ON COLUMN public.admin_actions_log.target_id IS
  'UUID cible de l action (user_id, profile_id, parrainage_id, etc.). NULL autorise depuis story 7.A.7 a condition que target_id_text soit renseigne (mutex CHECK XOR target_id_xor). Pre-7.A.7 : NOT NULL impose, mutex applicatif uniquement.';
COMMENT ON COLUMN public.admin_actions_log.target_id_text IS
  'Target ID textuel pour actions ne portant pas sur un UUID (ex : code_departement, region). Mutex BDD avec target_id via CHECK XOR target_id_xor (story 7.A.7) : exactement un des deux doit etre renseigne. Heritage story 3.5 D1.';
COMMENT ON CONSTRAINT target_id_xor ON public.admin_actions_log IS
  'Story 7.A.7 (F-Epic7-A7) : invariant metier "chaque ligne porte exactement une reference cible (UUID OU TEXT, jamais les deux, jamais aucun)". Violation -> Postgres 23514. Heritage 3.5 D1 (mutex applicatif) + bug latent decouvert 2026-05-06 (target_id NOT NULL + 2 call-sites posant null aurait pete au premier toggle dpt/region reel).';
