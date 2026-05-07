import { describe, it, expect, vi, afterAll, beforeAll } from 'vitest'
import type Stripe from 'stripe'
import {
  createTestUser,
  createTestSubscription,
  createTestAccompagneProfile,
  createTestParrainage,
  cleanupAllFixtures,
} from '@/tests/integration/_lib/fixtures'
import { getAdminClient } from '@/tests/integration/_lib/supabase-admin'
import {
  createStripeEvent,
  postWebhookEvent,
} from '@/tests/integration/_lib/stripe-webhook-helper'
import { stripe } from '@/lib/stripe'
import { sendAdminParrainageFlag } from '@/lib/emails'

// T2 (epic-4.md AC2 #2 + D12 path 2 E2E) : customer.subscription.updated avec
// fingerprint matchant la marraine -> blacklist meme_carte.
//
// Pre-fixture : marraine + subscription marraine + filleule + parrainage 'inscrite'.
// Mock paymentMethods.retrieve (capture fingerprint depuis subscription.default_payment_method).
// La logique compares stripe_fingerprint contre les rows parrainages existantes :
// on seede une 2e row parrainage de la marraine avec le MEME fingerprint pour declencher carteMatch.
describe('Stripe webhook : customer.subscription.updated -> parrainage bloque meme_carte (T2)', () => {
  beforeAll(async () => {
    await cleanupAllFixtures()
  })

  afterAll(async () => {
    await cleanupAllFixtures()
  })

  it('passe le parrainage en bloque + log admin + envoie email admin meme_carte', async () => {
    // Marraine + subscription marraine (necessaire pour la lookup customer dans detectBlacklistAtWebhook)
    const marraine = await createTestUser('accompagnante')
    await createTestSubscription(marraine.id, { status: 'active' })

    // Filleule + son profil
    const filleule = await createTestUser('accompagne')
    await createTestAccompagneProfile(filleule.id)

    // Le parrainage cible (filleule en cours) - doit avoir stripe_fingerprint NULL
    // pour que captureParrainageFingerprint le rempliisse depuis le PM mock.
    const code = 'TESTPARR2'
    const parrainage = await createTestParrainage(marraine.id, filleule.id, {
      code,
      statut: 'inscrite',
      fingerprint: null,
    })

    // Une 2e row parrainage de la marraine (en tant que filleule passee) avec
    // le meme fingerprint -> declenche matchAsFilleule dans detectBlacklistAtWebhook.
    const marraineExFilleule = await createTestUser('accompagnante')
    await createTestParrainage(marraineExFilleule.id, marraine.id, {
      statut: 'abonnee',
      fingerprint: 'fp_test_match_t2',
    })

    // Mock paymentMethods.retrieve : retourne un PM dont card.fingerprint match.
    vi.mocked(stripe.paymentMethods.retrieve).mockResolvedValue({
      id: 'pm_test_t2',
      object: 'payment_method',
      card: { fingerprint: 'fp_test_match_t2' },
    } as unknown as Stripe.PaymentMethod as never)

    // Event customer.subscription.updated. La metadata user_id+parrainage_code
    // est lue par captureParrainageFingerprint (route.ts:332).
    const subId = `sub_test_t2_${Date.now()}`
    // Pre-seed la subscription via createTestSubscription helper pour beneficier
    // du tracker + cleanupAllFixtures (review code 2026-05-09 H3).
    const filleuleSub = await createTestSubscription(filleule.id, {
      status: 'active',
      stripeSubscriptionId: subId,
    })
    void filleuleSub
    const supabase = getAdminClient()

    const now = Math.floor(Date.now() / 1000)
    const fakeSubscription = {
      id: subId,
      object: 'subscription',
      status: 'active',
      default_payment_method: 'pm_test_t2',
      cancel_at: null,
      canceled_at: null,
      items: {
        data: [
          {
            price: { id: 'price_test_dummy' },
            current_period_start: now,
            current_period_end: now + 30 * 24 * 60 * 60,
          },
        ],
      },
      metadata: { user_id: filleule.id, parrainage_code: code },
    } as unknown as Stripe.Subscription

    const event = createStripeEvent('customer.subscription.updated', fakeSubscription)

    const { status } = await postWebhookEvent(event)
    expect(status).toBe(200)

    // (i) Parrainage passe en bloque/meme_carte
    const { data: parrainageRow } = await supabase
      .from('parrainages')
      .select('id, statut, blocage_raison, stripe_fingerprint')
      .eq('id', parrainage.id)
      .single()
    expect(parrainageRow).toMatchObject({
      statut: 'bloque',
      blocage_raison: 'meme_carte',
      stripe_fingerprint: 'fp_test_match_t2',
    })

    // (ii) admin_actions_log row inseree avec action_type='parrainage_bloque'
    const { data: logs } = await supabase
      .from('admin_actions_log')
      .select('action_type, target_id, details')
      .eq('target_id', parrainage.id)
      .eq('action_type', 'parrainage_bloque')
    expect(logs).not.toBeNull()
    expect(logs?.length ?? 0).toBeGreaterThanOrEqual(1)
    expect(logs?.[0]?.details).toMatchObject({ raison: 'meme_carte' })

    // (iii) sendAdminParrainageFlag appele avec type='meme_carte'
    expect(vi.mocked(sendAdminParrainageFlag)).toHaveBeenCalled()
    expect(vi.mocked(sendAdminParrainageFlag).mock.calls[0]?.[0]).toMatchObject({
      type: 'meme_carte',
      parrainageId: parrainage.id,
    })
  })
})
