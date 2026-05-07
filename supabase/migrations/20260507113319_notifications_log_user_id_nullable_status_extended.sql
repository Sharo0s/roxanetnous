-- Story 4.2 — Fix schema drift `notifications_log` (transversal)
--
-- Contexte : bug latent decouvert review story 3.4 (2026-05-06) puis acte
-- AI-3.1 retro Epic 3 (2026-05-07). Le schema existant rejette deux cas
-- transverses depuis Epic 1 :
--   1. INSERT avec user_id IS NULL (visiteurs anonymes : waitlist non
--      authentifies, formulaire de contact, alertes admin hors users.id)
--      -> echec NOT NULL silencieux (Promise rejetee non capturee).
--   2. INSERT avec status='error' (toutes les branches catch des helpers
--      `lib/emails.ts:logNotification`) -> echec CHECK silencieux.
-- Constat empirique : 50 lignes en BDD au 2026-05-07, toutes status='sent'
-- + user_id non null. Aucun chemin error/anonyme n'a jamais ete persiste.
--
-- Callers concernes :
--   - lib/emails.ts:logNotification (helper centralise) : type TS etendu
--     simultanement (cf. AC2 story 4.2).
--   - app/actions/contact.ts : 2 INSERT directs refactores en appel au
--     helper logNotification (cf. AC3 story 4.2).
--
-- Justification user_id NULLABLE : 4 flows visent des destinataires
-- hors-table users (waitlist visiteur, contact form visiteur, alerte
-- admin transverse, parrainage filleule pre-creation compte).
--
-- Justification CHECK status etendu (7 valeurs) :
--   - Statuts operationnels existants : pending, sent, failed.
--   - Statut applicatif catch-pre-Resend : error.
--   - Statut config-absente (signal perdu pour audit) : lost.
--   - Statuts queue durable preparation story 4.3 : retry-scheduled,
--     retry-exhausted. Introduits ici pour eviter une seconde migration
--     immediate ; pas encore emis par le code applicatif au merge 4.2.
--
-- Idempotence : DROP CONSTRAINT IF EXISTS + guard duplicate_object autour
-- de l'ADD CONSTRAINT. Pattern reutilise de
-- 20260506130000_admin_actions_log_target_id_text.sql.
--
-- Pas de migration de donnees : DROP NOT NULL est additif, CHECK etendu
-- strictement plus permissif. Les 50 lignes status='sent' restent valides.

BEGIN;

-- 1) user_id NULLABLE (FK users(id) preservee : NULL n'enclenche pas la FK)
ALTER TABLE public.notifications_log
  ALTER COLUMN user_id DROP NOT NULL;

-- 2) Drop CHECK existante (idempotent)
ALTER TABLE public.notifications_log
  DROP CONSTRAINT IF EXISTS notifications_log_status_check;

-- 3) Add CHECK etendu (idempotent via guard duplicate_object)
DO $$
BEGIN
  ALTER TABLE public.notifications_log
    ADD CONSTRAINT notifications_log_status_check
    CHECK (status IN (
      'pending',
      'sent',
      'failed',
      'error',
      'lost',
      'retry-scheduled',
      'retry-exhausted'
    ));
EXCEPTION
  WHEN duplicate_object THEN NULL;
END
$$;

-- 4) Documentation des colonnes (idempotent, COMMENT remplace toujours)
COMMENT ON COLUMN public.notifications_log.user_id IS
  'NULL pour visiteurs anonymes (waitlist, contact form, admin alerts hors users.id). FK users(id) preservee : si non-null, doit pointer vers une row existante.';

COMMENT ON COLUMN public.notifications_log.status IS
  'Etat operationnel du log : pending (defaut), sent (Resend ok), failed (envoi rate, retry possible), error (exception applicative pre-Resend), lost (config absente, signal perdu), retry-scheduled (queue durable story 4.3), retry-exhausted (queue durable, 3 retries fail).';

COMMENT ON COLUMN public.notifications_log.type IS
  'Identifiant metier libre <flow>_<event>. Convention non contrainte par CHECK : evolution rapide par story (ex: welcome, new_message, contact_form, parrainage_recompense, waitlist_opening, validation_valide, etc.).';

COMMIT;
