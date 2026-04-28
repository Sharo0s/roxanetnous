-- Permet admin_id NULL pour les actions automatiques systeme
-- (ex : validation_par_parrainage declenchee par retour Stripe sans admin humain).
-- Story 2.1 - parrainage AC9.

BEGIN;

ALTER TABLE public.admin_actions_log
  ALTER COLUMN admin_id DROP NOT NULL;

COMMENT ON COLUMN public.admin_actions_log.admin_id IS 'UUID admin auteur de l''action. NULL si action automatique systeme (cron, webhook, validation parrainage).';

COMMIT;
