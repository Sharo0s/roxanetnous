'use server'

import { createClient } from '@/lib/supabase/server'
import { stripe, getPlanningPriceId } from '@/lib/stripe'
import type { PlanningPlanType } from '@/lib/stripe'
import { redirect } from 'next/navigation'
import { hasActiveSubscription, getSubscriptionStatus } from '@/lib/subscription-helpers'
import { getPlanningSubscriptionStatus } from '@/lib/planning-subscription-helpers'

export async function createPlanningCheckoutSession(formData: FormData): Promise<void> {
  const plan = (formData.get('plan') as PlanningPlanType) || 'mensuel'
  const supabase = await createClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: userData } = await supabase
    .from('users')
    .select('role, email, first_name, last_name')
    .eq('id', user.id)
    .single()

  if (!userData || userData.role !== 'beneficiaire') redirect('/')

  // Verifier abonnement de base actif
  const hasBase = await hasActiveSubscription(user.id)
  if (!hasBase) redirect('/beneficiaire/abonnement')

  const priceId = getPlanningPriceId(plan)
  if (!priceId) redirect('/beneficiaire/planning/abonnement')

  // Reutiliser le stripe_customer_id existant
  const subStatus = await getSubscriptionStatus(user.id)
  let customerId = subStatus.stripeCustomerId

  if (!customerId) {
    const customer = await stripe.customers.create({
      email: userData.email,
      name: `${userData.first_name || ''} ${userData.last_name || ''}`.trim() || undefined,
      metadata: { user_id: user.id, role: 'beneficiaire' },
    })
    customerId = customer.id
  }

  const session = await stripe.checkout.sessions.create({
    customer: customerId,
    mode: 'subscription',
    line_items: [{ price: priceId, quantity: 1 }],
    success_url: `${process.env.NEXT_PUBLIC_BASE_URL}/beneficiaire/planning/abonnement/success?session_id={CHECKOUT_SESSION_ID}`,
    cancel_url: `${process.env.NEXT_PUBLIC_BASE_URL}/beneficiaire/planning/abonnement`,
    metadata: { user_id: user.id, type: 'planning', plan },
    billing_address_collection: 'required',
    customer_update: { name: 'auto', address: 'auto' },
  } as any)

  if (!session.url) redirect('/beneficiaire/planning/abonnement')

  redirect(session.url)
}

export async function createPlanningPortalSession(): Promise<void> {
  const supabase = await createClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const planningStatus = await getPlanningSubscriptionStatus(user.id)

  if (!planningStatus.stripeCustomerId) redirect('/beneficiaire/planning/abonnement')

  const session = await stripe.billingPortal.sessions.create({
    customer: planningStatus.stripeCustomerId,
    return_url: `${process.env.NEXT_PUBLIC_BASE_URL}/beneficiaire/planning/abonnement`,
  })

  redirect(session.url)
}

export async function cancelPlanningSubscription(): Promise<void> {
  const supabase = await createClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const planningStatus = await getPlanningSubscriptionStatus(user.id)

  if (!planningStatus.stripeSubscriptionId) redirect('/beneficiaire/planning/abonnement')

  await stripe.subscriptions.update(planningStatus.stripeSubscriptionId, {
    cancel_at_period_end: true,
  })

  redirect('/beneficiaire/planning/abonnement')
}
