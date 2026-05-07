import { describe, it, expect, afterAll, beforeAll } from 'vitest'
import type Stripe from 'stripe'
import {
  createTestUser,
  createTestSubscription,
  cleanupAllFixtures,
  trackStripeEvent,
} from '@/tests/integration/_lib/fixtures'
import { getAdminClient } from '@/tests/integration/_lib/supabase-admin'
import {
  createStripeEvent,
  postWebhookEvent,
} from '@/tests/integration/_lib/stripe-webhook-helper'

// T3 (epic-4.md AC2 #3) : invoice.payment_failed -> subscriptions.status='past_due'.
// Pre-fixture : subscription active. Le handler met simplement a jour status.
describe('Stripe webhook : invoice.payment_failed -> past_due (T3)', () => {
  beforeAll(async () => {
    await cleanupAllFixtures()
  })

  afterAll(async () => {
    await cleanupAllFixtures()
  })

  it('met subscription.status=past_due quand le paiement de la facture echoue', async () => {
    const user = await createTestUser('accompagne')
    const sub = await createTestSubscription(user.id, {
      status: 'active',
      stripeSubscriptionId: `sub_test_t3_${Date.now()}`,
    })

    const supabase = getAdminClient()

    // Stripe.Invoice : la structure parent.subscription_details.subscription est lue par route.ts:787.
    const invoice = {
      id: 'in_test_t3',
      object: 'invoice',
      parent: {
        subscription_details: {
          subscription: sub.stripeSubscriptionId,
        },
      },
    } as unknown as Stripe.Invoice

    const event = createStripeEvent('invoice.payment_failed', invoice)
    trackStripeEvent(event.id)

    const { status } = await postWebhookEvent(event)
    expect(status).toBe(200)

    const { data: updated } = await supabase
      .from('subscriptions')
      .select('status, updated_at, created_at')
      .eq('stripe_subscription_id', sub.stripeSubscriptionId)
      .single()
    expect(updated?.status).toBe('past_due')
  })
})
