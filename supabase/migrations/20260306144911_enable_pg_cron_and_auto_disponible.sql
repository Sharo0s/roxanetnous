
CREATE EXTENSION IF NOT EXISTS pg_cron WITH SCHEMA pg_catalog;

SELECT cron.schedule(
  'auto-reactivate-disponible',
  '0 6 * * *',
  $$
    UPDATE auxiliaires_profiles
    SET disponible = true, indisponible_jusqu_au = NULL
    WHERE disponible = false
      AND indisponible_jusqu_au IS NOT NULL
      AND indisponible_jusqu_au <= CURRENT_DATE;
  $$
);
