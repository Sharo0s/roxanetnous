'use server'

import { createClient } from '@/lib/supabase/server'
import { stripe, getStripePriceId, getTrialDays } from '@/lib/stripe'
import type { PlanType } from '@/lib/stripe'
import { redirect } from 'next/navigation'
import { getSubscriptionStatus } from '@/lib/subscription-helpers'

export async function createCheckoutSession(formData: FormData): Promise<void> {
  const plan = (formData.get('plan') as PlanType) || 'mensuel'
  const supabase = await createClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: userData } = await supabase
    .from('users')
    .select('role, email, first_name, last_name')
    .eq('id', user.id)
    .single()

  if (!userData) redirect('/')

  const role = userData.role as 'accompagnante' | 'accompagne'
  if (role !== 'accompagnante' && role !== 'accompagne') redirect('/')

  const priceId = getStripePriceId(role, plan)
  if (!priceId) redirect(`/${role}/abonnement`)

  // Check if user already has a Stripe customer
  const subStatus = await getSubscriptionStatus(user.id)
  let customerId = subStatus.stripeCustomerId

  if (!customerId) {
    const customer = await stripe.customers.create({
      email: userData.email,
      name: `${userData.first_name || ''} ${userData.last_name || ''}`.trim() || undefined,
      metadata: { user_id: user.id, role },
    })
    customerId = customer.id
  }

  const trialDays = getTrialDays(plan)
  const dashboardPath = role === 'accompagnante' ? '/accompagnante' : '/accompagne'

  const sessionParams: Record<string, unknown> = {
    customer: customerId,
    mode: 'subscription',
    line_items: [{ price: priceId, quantity: 1 }],
    success_url: `${process.env.NEXT_PUBLIC_BASE_URL}${dashboardPath}/abonnement/success?session_id={CHECKOUT_SESSION_ID}`,
    cancel_url: `${process.env.NEXT_PUBLIC_BASE_URL}${dashboardPath}/abonnement`,
    metadata: { user_id: user.id, role, plan },
    billing_address_collection: 'required',
    customer_update: { name: 'auto', address: 'auto' },
  }

  if (trialDays) {
    sessionParams.subscription_data = { trial_period_days: trialDays }
  }

  const session = await stripe.checkout.sessions.create(sessionParams as any)

  if (!session.url) redirect(`${dashboardPath}/abonnement`)

  redirect(session.url)
}

export async function createPortalSession(): Promise<void> {
  const supabase = await createClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: userData } = await supabase
    .from('users')
    .select('role')
    .eq('id', user.id)
    .single()

  const role = userData?.role || 'accompagnante'
  const subStatus = await getSubscriptionStatus(user.id)

  if (!subStatus.stripeCustomerId) redirect(`/${role}/abonnement`)

  const session = await stripe.billingPortal.sessions.create({
    customer: subStatus.stripeCustomerId,
    return_url: `${process.env.NEXT_PUBLIC_BASE_URL}/${role}/abonnement`,
  })

  redirect(session.url)
}

export async function cancelSubscription(): Promise<void> {
  const supabase = await createClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: userData } = await supabase
    .from('users')
    .select('role')
    .eq('id', user.id)
    .single()

  const role = userData?.role || 'accompagnante'
  const subStatus = await getSubscriptionStatus(user.id)

  if (!subStatus.stripeSubscriptionId) redirect(`/${role}/abonnement`)

  await stripe.subscriptions.update(subStatus.stripeSubscriptionId, {
    cancel_at_period_end: true,
  })

  redirect(`/${role}/abonnement`)
}

export async function cancelSubscriptionFromModal(): Promise<{
  success: boolean
  cancelAt: string | null
  error?: string
}> {
  const supabase = await createClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { success: false, cancelAt: null, error: 'Non connecté.' }

  const subStatus = await getSubscriptionStatus(user.id)
  if (!subStatus.stripeSubscriptionId || !subStatus.active) {
    return { success: false, cancelAt: null, error: 'Aucun abonnement actif.' }
  }

  try {
    const updated = await stripe.subscriptions.update(subStatus.stripeSubscriptionId, {
      cancel_at_period_end: true,
    })

    const cancelAt = updated.cancel_at
      ? new Date(updated.cancel_at * 1000).toISOString()
      : subStatus.currentPeriodEnd

    return { success: true, cancelAt }
  } catch {
    return { success: false, cancelAt: null, error: 'Erreur lors de la résiliation.' }
  }
}

export async function switchPlan(formData: FormData): Promise<void> {
  const newPlan = formData.get('plan') as PlanType
  if (!newPlan || (newPlan !== 'mensuel' && newPlan !== 'annuel')) {
    return
  }

  const supabase = await createClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: userData } = await supabase
    .from('users')
    .select('role')
    .eq('id', user.id)
    .single()

  if (!userData) redirect('/')

  const role = userData.role as 'accompagnante' | 'accompagne'
  const subscription = await getSubscriptionStatus(user.id)

  if (subscription.status !== 'active' || subscription.cancelAt) {
    redirect(`/${role}/abonnement`)
  }

  if (newPlan === subscription.planType) {
    redirect(`/${role}/abonnement`)
  }

  const newPriceId = getStripePriceId(role, newPlan)
  if (!newPriceId || !subscription.stripeSubscriptionId) {
    redirect(`/${role}/abonnement`)
  }

  try {
    const stripeSubscription = await stripe.subscriptions.retrieve(subscription.stripeSubscriptionId)
    const itemId = stripeSubscription.items.data[0]?.id

    if (!itemId) redirect(`/${role}/abonnement`)

    await stripe.subscriptions.update(subscription.stripeSubscriptionId, {
      items: [{ id: itemId, price: newPriceId }],
      proration_behavior: 'create_prorations',
    })
  } catch {
    redirect(`/${role}/abonnement?error=switch_failed`)
  }

  const { revalidatePath } = await import('next/cache')
  revalidatePath(`/${role}/abonnement`)
  redirect(`/${role}/abonnement`)
}

export async function reactivateSubscription(): Promise<void> {
  const supabase = await createClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: userData } = await supabase
    .from('users')
    .select('role')
    .eq('id', user.id)
    .single()

  const role = userData?.role || 'accompagnante'
  const subStatus = await getSubscriptionStatus(user.id)

  if (!subStatus.stripeSubscriptionId || !subStatus.cancelAt) {
    redirect(`/${role}/abonnement`)
  }

  try {
    await stripe.subscriptions.update(subStatus.stripeSubscriptionId, {
      cancel_at_period_end: false,
    })
  } catch {
    redirect(`/${role}/abonnement?error=reactivate_failed`)
  }

  const { revalidatePath } = await import('next/cache')
  revalidatePath(`/${role}/abonnement`)
  redirect(`/${role}/abonnement`)
}
