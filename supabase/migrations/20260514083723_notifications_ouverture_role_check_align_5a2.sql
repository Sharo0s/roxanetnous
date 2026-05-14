-- Fix-CI 2026-05-14 : aligner 2 CHECK constraints orphelins sur les valeurs migrees
-- post-5.A.2 (renommage accompagnante -> accompagnant).
--
-- Bug latent revele par le 1er run GHA integration-tests.yml depuis la migration 5.A.2 :
-- les 2 CHECKs ci-dessous acceptent encore les anciennes valeurs textuelles, alors que
-- le code applicatif insere desormais les nouvelles. Toute insertion en prod via le
-- happy path applicatif se ferait rejeter par code Postgres 23514 (check_violation).
-- Tables actuellement vides en prod (0 row chacune) -> zero degat constate, mais
-- bombes a retardement.
--
-- 1) `waitlist_departements_role_check` sur public.notifications_ouverture(role)
--    (conname preserve sous l ancien nom de table par 5.A.2 lors du renommage
--    waitlist_departements -> notifications_ouverture)
--    Audit avant : CHECK (... role = ANY (ARRAY['accompagnante', 'accompagne', 'visiteur']))
--    Code applicatif : `app/actions/notifications-ouverture.ts:17`
--      VALID_ROLES = ['accompagnant', 'accompagne', 'visiteur'] (post-5.A.2)
--    Bombe : tout visiteur s inscrivant comme accompagnant a la waitlist.
--
-- 2) `signalements_cible_type_check` sur public.signalements(cible_type)
--    Audit avant : CHECK (cible_type = ANY (ARRAY['user', 'annonce_accompagnante', 'annonce_accompagne', 'message']))
--    Code applicatif : `app/actions/signalements.ts:11`
--      type SignalementInput.cible_type = 'user' | 'annonce_accompagnant' | 'annonce_accompagne' | 'message'
--    Bombe : tout signalement d annonce accompagnant (table renommee 5.A.2 :
--    annonces_accompagnantes -> annonces_accompagnants).
--
-- Pas de backfill necessaire : audit MCP confirme 0 row sur les 2 tables.
-- Pas de renommage des conname (preserve historique nom table 5.A.2).

BEGIN;

-- 1. notifications_ouverture.role : aligner enum role
ALTER TABLE public.notifications_ouverture
  DROP CONSTRAINT IF EXISTS waitlist_departements_role_check;

ALTER TABLE public.notifications_ouverture
  ADD CONSTRAINT waitlist_departements_role_check CHECK (
    role IS NULL OR role = ANY (ARRAY['accompagnant'::text, 'accompagne'::text, 'visiteur'::text])
  );

COMMENT ON CONSTRAINT waitlist_departements_role_check ON public.notifications_ouverture IS
  'Aligne sur enum user_role post-5.A.2 (accompagnant, accompagne, admin). Le role admin n est pas autorise ici (table publique de waitlist visiteurs). conname preserve historique nom table avant renommage waitlist_departements -> notifications_ouverture (5.A.2).';

-- 2. signalements.cible_type : aligner sur table renommee annonce_accompagnant
ALTER TABLE public.signalements
  DROP CONSTRAINT IF EXISTS signalements_cible_type_check;

ALTER TABLE public.signalements
  ADD CONSTRAINT signalements_cible_type_check CHECK (
    cible_type = ANY (ARRAY['user'::text, 'annonce_accompagnant'::text, 'annonce_accompagne'::text, 'message'::text])
  );

COMMENT ON CONSTRAINT signalements_cible_type_check ON public.signalements IS
  'Aligne sur tables renommees post-5.A.2 (annonces_accompagnantes -> annonces_accompagnants). cible_type=annonce_accompagnant ref annonces_accompagnants.id.';

COMMIT;
