-- Story 2.3 : index pour accélérer la page admin blacklist et le lookup email lower
-- Migration additive idempotente, aucune nouvelle colonne (les colonnes blocage_raison,
-- flag_suspicion, stripe_fingerprint, ip_inscription existent déjà depuis
-- 20260428130104_add_parrainage_feature.sql).

-- Index partiel pour la page admin /admin/parrainages/blacklist :
-- liste les parrainages bloqués, fraudes et flags de suspicion par created_at DESC.
CREATE INDEX IF NOT EXISTS idx_parrainages_blacklist
  ON public.parrainages (created_at DESC)
  WHERE statut = 'bloque' OR flag_suspicion IS NOT NULL OR statut = 'fraude';

-- Index fonctionnel sur LOWER(email) pour la détection meme_email
-- (l'index UNIQUE existant users_email_key sur email est case-sensitive et inutile pour LOWER()).
CREATE INDEX IF NOT EXISTS idx_users_email_lower
  ON public.users (LOWER(email));
