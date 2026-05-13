'use server'

import { createClient } from '@/lib/supabase/server'
import { stripe, getStripePriceId, getTrialDays } from '@/lib/stripe'
import type { PlanType } from '@/lib/stripe'
import Stripe from 'stripe'
import { redirect } from 'next/navigation'
import { getSubscriptionStatus } from '@/lib/subscription-helpers'

export async function createCheckoutSession(formData: FormData): Promise<void> {
  const plan = (formData.get('plan') as PlanType) || 'mensuel'
  const supabase = await createClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: userData } = await supabase
    .from('users')
    .select('role, email, first_name, last_name, parrainee_par')
    .eq('id', user.id)
    .single()

  if (!userData) redirect('/')

  const role = userData.role as 'accompagnant' | 'accompagne'
  if (role !== 'accompagnant' && role !== 'accompagne') redirect('/')

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
  const dashboardPath = role === 'accompagnant' ? '/accompagnante' : '/accompagne'

  const metadata: Record<string, string> = { user_id: user.id, role, plan }

  // FR45/AC8 : si la filleule a été parrainée, on injecte le code dans la metadata
  // de la session Stripe pour que la success page puisse déclencher la validation
  // automatique au retour (cf. confirmParrainageOnSuccess).
  // RLS sur `parrainages` autorise uniquement la marraine à lire ses lignes ; la
  // filleule ne peut donc pas lire la sienne via le client utilisateur. On passe
  // par le service role pour cette lecture serveur-side.
  if (role === 'accompagnant' && userData.parrainee_par) {
    const supabaseAdmin = await createClient({ serviceRole: true })
    const { data: parrainageRow } = await supabaseAdmin
      .from('parrainages')
      .select('code')
      .eq('filleule_id', user.id)
      .eq('statut', 'inscrite')
      .order('filleule_inscrite_at', { ascending: false })
      .limit(1)
      .maybeSingle()
    if (parrainageRow?.code) {
      metadata.parrainage_code = parrainageRow.code
    }
  }

  const sessionParams: Stripe.Checkout.SessionCreateParams = {
    customer: customerId,
    mode: 'subscription',
    line_items: [{ price: priceId, quantity: 1 }],
    success_url: `${process.env.NEXT_PUBLIC_BASE_URL}${dashboardPath}/abonnement/success?session_id={CHECKOUT_SESSION_ID}`,
    cancel_url: `${process.env.NEXT_PUBLIC_BASE_URL}${dashboardPath}/abonnement`,
    metadata,
    billing_address_collection: 'required',
    customer_update: { name: 'auto', address: 'auto' },
    // M6/M7 (code review 2026-04-28) : restriction à 'card' pour garantir que
    // pm.card.fingerprint sera disponible côté webhook et permettre la
    // détection anti-fraude par carte partagée. Apple Pay / Google Pay /
    // Link / SEPA n'exposent pas tous le fingerprint et casseraient la promesse
    // affichée dans la politique de confidentialité.
    payment_method_types: ['card'],
  }

  // Propager la metadata sur la subscription pour qu'elle reste accessible aux
  // handlers webhook ultérieurs (customer.subscription.updated, etc.) — utile
  // notamment pour le rattrapage du fingerprint parrainage en mode trial.
  type SubscriptionDataParam = NonNullable<Stripe.Checkout.SessionCreateParams['subscription_data']>
  const subscriptionData: SubscriptionDataParam = { metadata }
  if (trialDays) {
    subscriptionData.trial_period_days = trialDays
  }
  sessionParams.subscription_data = subscriptionData

  const session = await stripe.checkout.sessions.create(sessionParams)

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

  const role = userData?.role || 'accompagnant'
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

  const role = userData?.role || 'accompagnant'
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

  const role = userData.role as 'accompagnant' | 'accompagne'
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

  const role = userData?.role || 'accompagnant'
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
