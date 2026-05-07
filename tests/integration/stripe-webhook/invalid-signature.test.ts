import { describe, it, expect, vi } from 'vitest'
import { NextRequest } from 'next/server'
import { POST } from '@/app/api/webhooks/stripe/route'
import {
  createStripeEvent,
  signStripeEvent,
} from '@/tests/integration/_lib/stripe-webhook-helper'

// T5 (epic-4.md AC2 #5) : POST avec signature falsifiee.
// Verifie le rejet 400 + body { error: 'Webhook error: ...' }
// + AUCUN appel Supabase ni email (handler return AVANT toute IO BDD).
//
// Ce test ne necessite pas Supabase local : le code rejette la signature
// avant d'instancier getSupabaseAdmin (route.ts:471 constructEvent throw).
describe('Stripe webhook : signature invalide (T5)', () => {
  it('renvoie 400 Webhook error quand la signature est falsifiee avec un mauvais secret', async () => {
    // Event minimal valide structurellement, signe avec un secret different
    // de celui que process.env.STRIPE_WEBHOOK_SECRET attend cote serveur.
    const event = createStripeEvent('customer.subscription.deleted', {
      id: 'sub_test_invalid_sig',
      object: 'subscription',
      status: 'active',
    })
    const { body, signature } = signStripeEvent(event, 'whsec_WRONG_SECRET')

    const request = new NextRequest('http://localhost:3000/api/webhooks/stripe', {
      method: 'POST',
      headers: {
        'stripe-signature': signature,
        'content-type': 'application/json',
      },
      body,
    })

    const response = await POST(request)
    const responseBody = (await response.json()) as { error?: string }

    expect(response.status).toBe(400)
    expect(responseBody.error).toMatch(/^Webhook error: /)
  })

  it('renvoie 400 quand le header stripe-signature est absent', async () => {
    const event = createStripeEvent('customer.subscription.deleted', {
      id: 'sub_test_no_sig',
      object: 'subscription',
      status: 'active',
    })
    const body = JSON.stringify(event)

    const request = new NextRequest('http://localhost:3000/api/webhooks/stripe', {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
      },
      body,
    })

    const response = await POST(request)
    const responseBody = (await response.json()) as { error?: string }

    expect(response.status).toBe(400)
    expect(responseBody.error).toBe('Missing signature')
  })

  it("n'appelle pas enqueueEmail quand la signature est rejetee", async () => {
    const { enqueueEmail } = await import('@/lib/email-queue')
    const event = createStripeEvent('customer.subscription.deleted', {
      id: 'sub_test_no_email',
      object: 'subscription',
      status: 'active',
    })
    const { body, signature } = signStripeEvent(event, 'whsec_WRONG_SECRET')

    const request = new NextRequest('http://localhost:3000/api/webhooks/stripe', {
      method: 'POST',
      headers: {
        'stripe-signature': signature,
        'content-type': 'application/json',
      },
      body,
    })

    await POST(request)

    expect(vi.mocked(enqueueEmail)).not.toHaveBeenCalled()
  })
})
