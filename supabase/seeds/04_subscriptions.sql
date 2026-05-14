-- Seeds subscriptions : 1 active future + 1 active expiree.
-- Sert les futures stories Epic 5+ qui auront besoin d'un dataset paywall
-- (sans devoir creer les fixtures inline a chaque test).

BEGIN;

-- 1. Subscription active future (user 2 = accompagnant valide, abonnement OK).
INSERT INTO public.subscriptions (
  id,
  user_id,
  stripe_customer_id,
  stripe_subscription_id,
  stripe_price_id,
  status,
  plan_type,
  current_period_start,
  current_period_end,
  first_subscription_date
)
VALUES (
  '00000000-0000-0000-0000-00000000ccc1',
  '00000000-0000-0000-0000-000000000002',
  'cus_seed_active_future',
  'sub_seed_active_future',
  'price_seed_dummy',
  'active',
  'mensuel',
  now() - interval '5 days',
  now() + interval '25 days',
  now() - interval '5 days'
)
ON CONFLICT (id) DO NOTHING;

-- 2. Subscription active mais expiree (user 3 = accompagne, abonnement caduc).
--    Sert le pattern test T9 paywall mid-conversation expiration.
INSERT INTO public.subscriptions (
  id,
  user_id,
  stripe_customer_id,
  stripe_subscription_id,
  stripe_price_id,
  status,
  plan_type,
  current_period_start,
  current_period_end,
  first_subscription_date
)
VALUES (
  '00000000-0000-0000-0000-00000000ccc2',
  '00000000-0000-0000-0000-000000000003',
  'cus_seed_active_expired',
  'sub_seed_active_expired',
  'price_seed_dummy',
  'active',
  'mensuel',
  now() - interval '40 days',
  now() - interval '1 day',
  now() - interval '40 days'
)
ON CONFLICT (id) DO NOTHING;

COMMIT;
