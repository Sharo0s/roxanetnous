-- Code review 2026-04-29 H6 : ajouter le statut 'expire' au cycle de vie
-- des parrainages. Sans ce statut, une filleule qui annule son abonnement
-- entre J+0 et J+30 laissait sa row parrainages en 'abonnee' indéfiniment :
-- le cron la re-traitait chaque jour (LIMIT 200), saturait le batch et
-- starvait les nouvelles confirmations.
--
-- 'expire' est volontairement hors de l'index unique partiel
-- parrainages_filleule_code_active_unique (qui couvre 'inscrite', 'abonnee',
-- 'confirme'), donc une filleule peut re-souscrire avec un autre code après
-- expiration sans collision.
--
-- expire_at : timestamp de la transition pour observabilité.

BEGIN;

ALTER TABLE public.parrainages
  ADD COLUMN IF NOT EXISTS expire_at TIMESTAMPTZ NULL;

COMMENT ON COLUMN public.parrainages.expire_at IS
  'Timestamp de transition vers le statut "expire" (filleule annulée avant J+30 ou autre cas terminal hors fraude/blocage).';

COMMIT;
