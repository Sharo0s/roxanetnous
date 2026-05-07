import { randomUUID } from 'node:crypto'
import { NextRequest } from 'next/server'
import Stripe from 'stripe'
import { POST } from '@/app/api/webhooks/stripe/route'

// Construit un Stripe.Event minimal en memoire. Caller fournit le `data.object`
// adapte au type d'event (Subscription, Invoice, CheckoutSession, etc.).
// `id` UUID v4 unique pour idempotence cross-tests (route.ts:487 idempotence par event.id).
export function createStripeEvent<T = unknown>(
  type: Stripe.Event['type'],
  dataObject: T,
  overrides?: Partial<Stripe.Event>,
): Stripe.Event {
  return {
    id: `evt_test_${randomUUID()}`,
    object: 'event',
    api_version: '2026-03-25.dahlia',
    created: Math.floor(Date.now() / 1000),
    data: { object: dataObject as Stripe.Event.Data['object'] },
    livemode: false,
    pending_webhooks: 0,
    request: { id: null, idempotency_key: null },
    type,
    ...overrides,
  } as Stripe.Event
}

// Signe un payload Stripe avec le secret de test (matches process.env.STRIPE_WEBHOOK_SECRET
// injecte dans tests/integration/setup.ts).
export function signStripeEvent(
  event: Stripe.Event,
  secret: string = process.env.STRIPE_WEBHOOK_SECRET ?? 'whsec_test_secret_for_integration_tests',
): { body: string; signature: string } {
  const body = JSON.stringify(event)
  const signature = Stripe.webhooks.generateTestHeaderString({
    payload: body,
    secret,
    timestamp: Math.floor(Date.now() / 1000),
  })
  return { body, signature }
}

// Helper de bout-en-bout : signe + appelle directement POST() expose par le route handler.
// Pas de serveur HTTP necessaire (Next.js App Router permet l'invocation directe
// via NextRequest mocke, AC4 + D1).
export async function postWebhookEvent(
  event: Stripe.Event,
  opts?: { secret?: string; signatureOverride?: string },
): Promise<{ status: number; body: unknown }> {
  const { body, signature } = signStripeEvent(event, opts?.secret)
  const finalSignature = opts?.signatureOverride ?? signature

  const request = new NextRequest('http://localhost:3000/api/webhooks/stripe', {
    method: 'POST',
    headers: {
      'stripe-signature': finalSignature,
      'content-type': 'application/json',
    },
    body,
  })

  const response = await POST(request)
  const responseBody = await response.json().catch(() => null)
  return { status: response.status, body: responseBody }
}
