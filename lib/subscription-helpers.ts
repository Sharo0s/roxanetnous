import { createClient } from '@/lib/supabase/server'
import { stripe } from '@/lib/stripe'
import type Stripe from 'stripe'
import * as Sentry from '@sentry/nextjs'

export type SubscriptionInfo = {
  active: boolean
  status: string | null
  currentPeriodEnd: string | null
  cancelAt: string | null
  stripeCustomerId: string | null
  stripeSubscriptionId: string | null
  planType: 'mensuel' | 'annuel' | null
  stripePriceId: string | null
  trialEnd: string | null
  cancelFeedback: string | null
  cancelComment: string | null
}

export type PaymentMethod = {
  brand: string
  last4: string
  expMonth: number
  expYear: number
}

export type Invoice = {
  id: string
  date: string
  amount: number
  status: string
  pdfUrl: string | null
}

export type SubscriptionAmount = {
  amount: number
  interval: 'month' | 'year'
}

export async function hasActiveSubscription(userId: string): Promise<boolean> {
  const supabase = await createClient({ serviceRole: true })

  // Story 7.A.1 : fail-loud sur incident Supabase transitoire. `.maybeSingle()`
  // distingue `data === null` (pas d'abonnement, paywall legitime) de
  // `error !== null` (incident BDD a remonter en Sentry + throw pour casser le
  // silence et basculer sur error boundary Next.js plutot qu'un faux paywall).
  const { data, error } = await supabase
    .from('subscriptions')
    .select('status, current_period_end')
    .eq('user_id', userId)
    .in('status', ['active', 'trialing'])
    .maybeSingle()

  if (error) {
    try {
      Sentry.captureException(error, {
        tags: { flow: 'subscription_check', severity: 'critical' },
      })
    } catch {}
    throw new Error('subscription check failed', { cause: error })
  }

  if (!data) return false

  // Verify the period hasn't expired
  if (data.current_period_end) {
    return new Date(data.current_period_end) > new Date()
  }

  return true
}

export async function getSubscriptionStatus(userId: string): Promise<SubscriptionInfo> {
  const supabase = await createClient({ serviceRole: true })

  const { data } = await supabase
    .from('subscriptions')
    .select('status, current_period_end, cancel_at, stripe_customer_id, stripe_subscription_id, plan_type, stripe_price_id, trial_end, cancel_feedback, cancel_comment')
    .eq('user_id', userId)
    .order('created_at', { ascending: false })
    .limit(1)
    .single()

  if (!data) {
    return {
      active: false,
      status: null,
      currentPeriodEnd: null,
      cancelAt: null,
      stripeCustomerId: null,
      stripeSubscriptionId: null,
      planType: null,
      stripePriceId: null,
      trialEnd: null,
      cancelFeedback: null,
      cancelComment: null,
    }
  }

  const active = (data.status === 'active' || data.status === 'trialing') &&
    (!data.current_period_end || new Date(data.current_period_end) > new Date())

  return {
    active,
    status: data.status,
    currentPeriodEnd: data.current_period_end,
    cancelAt: data.cancel_at,
    stripeCustomerId: data.stripe_customer_id,
    stripeSubscriptionId: data.stripe_subscription_id,
    planType: data.plan_type as 'mensuel' | 'annuel' | null,
    stripePriceId: data.stripe_price_id,
    trialEnd: data.trial_end,
    cancelFeedback: data.cancel_feedback,
    cancelComment: data.cancel_comment,
  }
}

export async function getPaymentMethod(stripeCustomerId: string, stripeSubscriptionId?: string | null): Promise<PaymentMethod | null> {
  try {
    // D'abord chercher sur l'abonnement
    if (stripeSubscriptionId) {
      const sub = await stripe.subscriptions.retrieve(stripeSubscriptionId, {
        expand: ['default_payment_method'],
      })
      const subPm = sub.default_payment_method
      if (subPm && typeof subPm !== 'string' && subPm.card) {
        return {
          brand: subPm.card.brand,
          last4: subPm.card.last4,
          expMonth: subPm.card.exp_month,
          expYear: subPm.card.exp_year,
        }
      }
    }

    // Fallback : chercher sur le client
    const customer = await stripe.customers.retrieve(stripeCustomerId, {
      expand: ['invoice_settings.default_payment_method'],
    }) as Stripe.Customer

    const pm = customer.invoice_settings?.default_payment_method
    if (!pm || typeof pm === 'string') return null

    const card = pm.card
    if (!card) return null

    return {
      brand: card.brand,
      last4: card.last4,
      expMonth: card.exp_month,
      expYear: card.exp_year,
    }
  } catch {
    return null
  }
}

export async function getInvoices(stripeCustomerId: string): Promise<Invoice[]> {
  try {
    const invoices = await stripe.invoices.list({
      customer: stripeCustomerId,
      limit: 24,
      status: 'paid',
    })

    return invoices.data.map((inv) => ({
      id: inv.id,
      date: new Date((inv.created ?? 0) * 1000).toISOString(),
      amount: (inv.amount_paid ?? 0) / 100,
      status: inv.status || 'unknown',
      pdfUrl: inv.invoice_pdf || null,
    }))
  } catch {
    return []
  }
}

export async function getSubscriptionAmount(stripePriceId: string): Promise<SubscriptionAmount | null> {
  try {
    const price = await stripe.prices.retrieve(stripePriceId)
    return {
      amount: (price.unit_amount ?? 0) / 100,
      interval: price.recurring?.interval === 'year' ? 'year' : 'month',
    }
  } catch {
    return null
  }
}
