-- P12 (code review 2026-04-28) : table d'idempotence pour les webhooks Stripe.
-- Stripe peut rejouer un événement (timeout, retry 24h). On INSERT en tête du
-- handler avec ON CONFLICT DO NOTHING ; si 0 ligne -> déjà traité, return 200.

BEGIN;

CREATE TABLE IF NOT EXISTS public.stripe_events_processed (
  event_id TEXT PRIMARY KEY,
  event_type TEXT NOT NULL,
  processed_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_stripe_events_processed_at
  ON public.stripe_events_processed (processed_at DESC);

COMMENT ON TABLE public.stripe_events_processed IS
  'Trace des webhook events Stripe deja consommes (idempotence anti-rejeu).';

-- RLS : table systeme, accessible uniquement via service role.
-- Policy explicite "no access" pour anon/authenticated : le service_role bypass
-- RLS et garde l'acces complet via le webhook handler.
ALTER TABLE public.stripe_events_processed ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "stripe_events_processed_no_access" ON public.stripe_events_processed;
CREATE POLICY "stripe_events_processed_no_access" ON public.stripe_events_processed
  FOR ALL USING (false) WITH CHECK (false);

COMMIT;
