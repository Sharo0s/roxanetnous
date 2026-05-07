import { describe, it, expect, vi, afterAll, beforeAll } from 'vitest'
import type Stripe from 'stripe'
import {
  createTestUser,
  createTestAccompagneProfile,
  cleanupAllFixtures,
  trackStripeEvent,
} from '@/tests/integration/_lib/fixtures'
import { getAdminClient } from '@/tests/integration/_lib/supabase-admin'
import {
  createStripeEvent,
  postWebhookEvent,
} from '@/tests/integration/_lib/stripe-webhook-helper'
import { stripe } from '@/lib/stripe'
import { sendSubscriptionConfirmEmail } from '@/lib/emails'

// T1 (epic-4.md AC2 #1) : checkout.session.completed valide.
// Verifie : (i) row subscriptions upsert active, (ii) row stripe_events_processed inseree,
// (iii) sendSubscriptionConfirmEmail appele 1 fois.
//
// Necessite Supabase local (SUPABASE_URL=http://localhost:54321 + SUPABASE_SERVICE_ROLE_KEY).
// Mock stripe.subscriptions.retrieve pour eviter tout appel reseau outbound (D7).
describe('Stripe webhook : checkout.session.completed valide (T1)', () => {
  beforeAll(async () => {
    // Defense en profondeur : s'assurer qu'aucune row orpheline d'un test precedent
    // ne pollue les assertions.
    await cleanupAllFixtures()
  })

  afterAll(async () => {
    await cleanupAllFixtures()
  })

  it('upsert subscriptions, insert stripe_events_processed, envoie email confirm', async () => {
    const user = await createTestUser('accompagne')
    await createTestAccompagneProfile(user.id)

    const supabase = getAdminClient()

    // Mock stripe.subscriptions.retrieve : retourne un Stripe.Subscription minimal
    // avec un item dont les periodes sont coherentes pour getSubscriptionPeriod (route.ts:416).
    const now = Math.floor(Date.now() / 1000)
    const periodEnd = now + 30 * 24 * 60 * 60
    const fakeSubscription = {
      id: 'sub_test_t1',
      object: 'subscription',
      status: 'active',
      default_payment_method: null,
      items: {
        data: [
          {
            price: { id: 'price_test_dummy' },
            current_period_start: now,
            current_period_end: periodEnd,
          },
        ],
      },
      metadata: {},
    } as unknown as Stripe.Subscription
    vi.mocked(stripe.subscriptions.retrieve).mockResolvedValueOnce(fakeSubscription as never)

    const event = createStripeEvent('checkout.session.completed', {
      id: 'cs_test_t1',
      object: 'checkout.session',
      mode: 'subscription',
      subscription: 'sub_test_t1',
      customer: 'cus_test_t1',
      metadata: { user_id: user.id, plan: 'mensuel' },
    })
    trackStripeEvent(event.id)

    const { status, body } = await postWebhookEvent(event)

    expect(status).toBe(200)
    expect(body).toMatchObject({ received: true })

    // (i) Subscription upserted active
    const { data: sub } = await supabase
      .from('subscriptions')
      .select('user_id, status, stripe_subscription_id, stripe_customer_id, plan_type')
      .eq('user_id', user.id)
      .single()
    expect(sub).not.toBeNull()
    expect(sub).toMatchObject({
      user_id: user.id,
      status: 'active',
      stripe_subscription_id: 'sub_test_t1',
      stripe_customer_id: 'cus_test_t1',
      plan_type: 'mensuel',
    })

    // (ii) Idempotence row inseree
    const { data: eventRow } = await supabase
      .from('stripe_events_processed')
      .select('event_id, event_type')
      .eq('event_id', event.id)
      .single()
    expect(eventRow).toMatchObject({
      event_id: event.id,
      event_type: 'checkout.session.completed',
    })

    // (iii) Email confirm envoye
    expect(vi.mocked(sendSubscriptionConfirmEmail)).toHaveBeenCalledTimes(1)
    expect(vi.mocked(sendSubscriptionConfirmEmail).mock.calls[0]?.[0]).toMatchObject({
      email: user.email,
      userId: user.id,
    })
  })
})
