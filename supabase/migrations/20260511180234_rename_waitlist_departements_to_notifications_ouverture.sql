-- Renommage waitlist_departements -> notifications_ouverture.
-- Vocabulaire UI : "waitlist" remplace par "Me tenir au courant" (page publique,
-- libelles emails, bouton CTA, etc.). Cf. lib/notify-ouverture.ts,
-- app/actions/notifications-ouverture.ts, components/notifications-ouverture/.
--
-- Aucune donnee a migrer (BDD vierge au moment du rename). FK historique
-- "waitlist_departements_code_departement_fkey" preservee (nom interne PG,
-- pas reference par le code applicatif).

ALTER TABLE public.waitlist_departements RENAME TO notifications_ouverture;

ALTER INDEX public.waitlist_departements_pkey RENAME TO notifications_ouverture_pkey;
ALTER INDEX public.waitlist_departements_email_code_uniq RENAME TO notifications_ouverture_email_code_uniq;
ALTER INDEX public.idx_waitlist_departements_code_notified RENAME TO idx_notifications_ouverture_code_notified;

COMMENT ON TABLE public.notifications_ouverture IS 'Inscriptions notification d''ouverture geographique par departement. Anciennement waitlist_departements (renomme 2026-05-11). Service-role only.';
