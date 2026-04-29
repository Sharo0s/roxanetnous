-- Code review 2026-04-29 D1 : la policy parrainages_filleule_read_own
-- ouverte le 2026-04-29 (migration 20260429000000) exposait a la filleule
-- des colonnes sensibles : flag_suspicion, blocage_raison, marraine_id,
-- stripe_fingerprint, ip_inscription. C'etait incompatible avec l'opacite
-- anti-fraude voulue par la spec 2.1 AC10 (l'email de verification cache
-- volontairement la raison du blocage).
--
-- On revoque la policy "open" et on la remplace par une vue
-- parrainages_filleule_view qui n'expose que les colonnes minimales dont
-- le dashboard filleule a besoin pour afficher le bandeau "Verification
-- supplementaire en cours" : (id, statut, filleule_id).
--
-- La marraine garde son acces direct a la table via la policy
-- parrainages_marraine_read inchangee.

BEGIN;

DROP POLICY IF EXISTS "parrainages_filleule_read_own" ON public.parrainages;

CREATE OR REPLACE VIEW public.parrainages_filleule_view
WITH (security_invoker = true) AS
SELECT id, statut, filleule_id
FROM public.parrainages
WHERE auth.uid() = filleule_id;

GRANT SELECT ON public.parrainages_filleule_view TO authenticated;

COMMENT ON VIEW public.parrainages_filleule_view IS
  'Vue restreinte exposant a la filleule uniquement les colonnes non sensibles de ses propres rows parrainages. Aucune fuite de flag_suspicion/blocage_raison/marraine_id/stripe_fingerprint/ip_inscription.';

COMMIT;
