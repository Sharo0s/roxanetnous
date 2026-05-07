import { describe, it, expect, vi, afterAll, beforeAll } from 'vitest'
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
import { sendSubscriptionCancelEmail } from '@/lib/emails'

// T4 (epic-4.md AC2 #4) : customer.subscription.deleted -> subscriptions.status='cancelled'
// + cancelled_at NOT NULL + email subscription_cancel.
describe('Stripe webhook : customer.subscription.deleted -> cancelled (T4)', () => {
  beforeAll(async () => {
    await cleanupAllFixtures()
  })

  afterAll(async () => {
    await cleanupAllFixtures()
  })

  it('met subscription en cancelled, set cancelled_at et envoie email cancel', async () => {
    const user = await createTestUser('accompagne')
    const sub = await createTestSubscription(user.id, {
      status: 'active',
      stripeSubscriptionId: `sub_test_t4_${Date.now()}`,
    })

    const supabase = getAdminClient()

    const fakeSubscription = {
      id: sub.stripeSubscriptionId,
      object: 'subscription',
      status: 'canceled',
    } as unknown as Stripe.Subscription

    const event = createStripeEvent('customer.subscription.deleted', fakeSubscription)
    trackStripeEvent(event.id)

    const { status } = await postWebhookEvent(event)
    expect(status).toBe(200)

    const { data: updated } = await supabase
      .from('subscriptions')
      .select('status, cancelled_at')
      .eq('stripe_subscription_id', sub.stripeSubscriptionId)
      .single()
    expect(updated?.status).toBe('cancelled')
    expect(updated?.cancelled_at).not.toBeNull()

    expect(vi.mocked(sendSubscriptionCancelEmail)).toHaveBeenCalledTimes(1)
    expect(vi.mocked(sendSubscriptionCancelEmail).mock.calls[0]?.[0]).toMatchObject({
      email: user.email,
      userId: user.id,
    })
  })
})
