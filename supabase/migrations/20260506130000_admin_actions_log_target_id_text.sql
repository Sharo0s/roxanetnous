-- Ajout colonne target_id_text pour actions admin ne portant pas sur un UUID
-- (ex : code_departement). Mutex applicatif avec target_id : exactement un des
-- deux doit etre renseigne. Story 3.5 / FR46 extension.
--
-- Pre-existant : target_id UUID NOT NULL. Conserve tel quel pour les flows
-- qui posent un UUID utilisateur ou subscription (ex : cron parrainage).
--
-- Bug latent : app/admin/departements/actions.ts:62 et :96 inseraient un
-- code TEXT (ex '29', '75') dans target_id (UUID) -> erreur Postgres 22P02.
-- Aucun toggle reel n'a jamais ete execute en prod (5 dpt seedes par
-- migration 20260502120000, 0 ligne dans admin_actions_log avec
-- action_type='departement_ouvert'), donc le bug n'avait jamais ete
-- declenche. Cette story 3.5 va exercer le code path pour la premiere fois.
--
-- Pas de CHECK BDD du type (target_id IS NULL) <> (target_id_text IS NULL)
-- car les lignes historiques ont target_id NOT NULL et un CHECK retroactif
-- les invaliderait.

ALTER TABLE public.admin_actions_log
  ADD COLUMN IF NOT EXISTS target_id_text TEXT;

COMMENT ON COLUMN public.admin_actions_log.target_id_text IS
  'Target ID textuel pour actions ne portant pas sur un UUID (ex : code_departement). Mutex applicatif avec target_id : exactement un des deux doit etre renseigne. Pas de CHECK BDD pour preserver les lignes historiques.';
