-- Story relances onboarding accompagnantes (2026-05-13).
--
-- Ajoute un flag d'opt-out RGPD sur public.users pour permettre a
-- l'utilisateur de refuser les emails de rappel "completez votre profil".
--
-- Contexte : les profils accompagnantes inscrits mais en validation_status
-- = 'a_completer' (jamais soumis l'onboarding) recoivent un rappel a J+2
-- puis J+7 via le cron /api/cron/relance-profils-incomplets. Le lien
-- d'opt-out est obligatoire (RGPD) meme pour du transactionnel : le
-- destinataire doit pouvoir mettre fin a la sollicitation. Voir
-- /api/email/optout?token=<hmac> + lib/optout-token.ts.
--
-- Granularite : un seul flag aujourd'hui car un seul type de mail
-- "rappel" existe. Si plus de types apparaissent, degrouper via une
-- table dediee email_optouts(user_id, type) (decision differee).
--
-- Pas de backfill : DEFAULT false couvre toutes les lignes existantes.

ALTER TABLE public.users
  ADD COLUMN rappels_optout BOOLEAN NOT NULL DEFAULT false;

COMMENT ON COLUMN public.users.rappels_optout IS
  'RGPD : true = l''utilisateur a clique sur le lien opt-out d''un email de rappel transactionnel. Plus aucun mail de relance type "completez votre profil" ne lui sera envoye. Geree par /api/email/optout via token HMAC signe.';
