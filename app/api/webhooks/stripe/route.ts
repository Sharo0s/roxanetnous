import { NextRequest, NextResponse } from 'next/server'
import { stripe } from '@/lib/stripe'
import { createServerClient } from '@supabase/ssr'
import { sendSubscriptionConfirmEmail, sendSubscriptionCancelEmail, sendPlanChangeEmail, sendRenewalReminderEmail } from '@/lib/emails'
import type Stripe from 'stripe'

function getSupabaseAdmin() {
  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    {
      cookies: {
        getAll() { return [] },
        setAll() {},
      },
    }
  )
}

function getSubscriptionPeriod(subscription: Stripe.Subscription) {
  const item = subscription.items.data[0]
  return {
    currentPeriodStart: item ? new Date(item.current_period_start * 1000).toISOString() : null,
    currentPeriodEnd: item ? new Date(item.current_period_end * 1000).toISOString() : null,
  }
}

function derivePlanType(priceId: string): 'mensuel' | 'annuel' {
  const annualPrices = [
    process.env.STRIPE_PRICE_AUXILIAIRE_ANNUEL,
    process.env.STRIPE_PRICE_BENEFICIAIRE_ANNUEL,
    process.env.STRIPE_PRICE_ACCOMPAGNANTE_ANNUEL,
    process.env.STRIPE_PRICE_ACCOMPAGNE_ANNUEL,
  ].filter(Boolean)
  const monthlyPrices = [
    process.env.STRIPE_PRICE_AUXILIAIRE_MENSUEL,
    process.env.STRIPE_PRICE_BENEFICIAIRE_MENSUEL,
    process.env.STRIPE_PRICE_ACCOMPAGNANTE_MENSUEL,
    process.env.STRIPE_PRICE_ACCOMPAGNE_MENSUEL,
  ].filter(Boolean)
  if (annualPrices.includes(priceId)) return 'annuel'
  if (monthlyPrices.includes(priceId)) return 'mensuel'
  // Fallback : si le prix ne correspond a aucune env var connue, defaut mensuel
  return 'mensuel'
}

async function hasRecentNotification(
  supabase: ReturnType<typeof getSupabaseAdmin>,
  userId: string,
  type: string,
  hoursAgo: number = 24,
): Promise<boolean> {
  const since = new Date(Date.now() - hoursAgo * 60 * 60 * 1000).toISOString()
  const { data } = await supabase
    .from('notifications_log')
    .select('id')
    .eq('user_id', userId)
    .eq('type', type)
    .gte('sent_at', since)
    .limit(1)
  return (data?.length ?? 0) > 0
}

export async function POST(request: NextRequest) {
  const body = await request.text()
  const signature = request.headers.get('stripe-signature')

  if (!signature) {
    return NextResponse.json({ error: 'Missing signature' }, { status: 400 })
  }

  let event: Stripe.Event

  try {
    event = stripe.webhooks.constructEvent(
      body,
      signature,
      process.env.STRIPE_WEBHOOK_SECRET!
    )
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error'
    return NextResponse.json({ error: `Webhook error: ${message}` }, { status: 400 })
  }

  const supabase = getSupabaseAdmin()

  switch (event.type) {
    case 'checkout.session.completed': {
      const session = event.data.object as Stripe.Checkout.Session

      if (session.mode !== 'subscription' || !session.subscription || !session.customer) {
        break
      }

      const userId = session.metadata?.user_id
      if (!userId) break

      const subscriptionResponse = await stripe.subscriptions.retrieve(session.subscription as string)
      const period = getSubscriptionPeriod(subscriptionResponse)
      await supabase.from('subscriptions').upsert(
        {
          user_id: userId,
          stripe_customer_id: session.customer as string,
          stripe_subscription_id: subscriptionResponse.id,
          stripe_price_id: subscriptionResponse.items.data[0]?.price.id || null,
          status: 'active',
          plan_type: session.metadata?.plan || 'mensuel',
          current_period_start: period.currentPeriodStart,
          current_period_end: period.currentPeriodEnd,
          first_subscription_date: new Date().toISOString(),
        },
        { onConflict: 'user_id' }
      )

      // Send confirmation email
      const { data: userData } = await supabase
        .from('users')
        .select('email, first_name, role')
        .eq('id', userId)
        .single()

      if (userData) {
        await sendSubscriptionConfirmEmail({
          email: userData.email,
          firstName: userData.first_name || '',
          role: userData.role as 'accompagnante' | 'accompagne',
          userId,
        })
      }
      break
    }

    case 'customer.subscription.updated': {
      const subscription = event.data.object as Stripe.Subscription

      const { data: existing } = await supabase
        .from('subscriptions')
        .select('user_id, stripe_price_id, plan_type')
        .eq('stripe_subscription_id', subscription.id)
        .single()

      if (!existing) break

      const period = getSubscriptionPeriod(subscription)
      const newPriceId = subscription.items.data[0]?.price.id || null
      const newPlanType = newPriceId ? derivePlanType(newPriceId) : existing.plan_type

      const cancellation = (subscription as any).cancellation_details
      const updateData: Record<string, unknown> = {
        status: subscription.status === 'active' ? 'active' : subscription.status === 'past_due' ? 'past_due' : subscription.status === 'canceled' ? 'cancelled' : subscription.status,
        current_period_start: period.currentPeriodStart,
        current_period_end: period.currentPeriodEnd,
        cancel_at: subscription.cancel_at ? new Date(subscription.cancel_at * 1000).toISOString() : null,
        cancelled_at: subscription.canceled_at ? new Date(subscription.canceled_at * 1000).toISOString() : null,
        stripe_price_id: newPriceId,
        plan_type: newPlanType,
        cancel_feedback: cancellation?.feedback || null,
        cancel_comment: cancellation?.comment || null,
        updated_at: new Date().toISOString(),
      }

      await supabase
        .from('subscriptions')
        .update(updateData)
        .eq('stripe_subscription_id', subscription.id)

      // Detect plan change and send email
      if (newPriceId && existing.stripe_price_id && newPriceId !== existing.stripe_price_id) {
        const oldPlanType = existing.plan_type || 'mensuel'
        const alreadySent = await hasRecentNotification(supabase, existing.user_id, 'plan_change')
        if (!alreadySent) {
          const { data: userData } = await supabase
            .from('users')
            .select('email, first_name, role')
            .eq('id', existing.user_id)
            .single()

          if (userData) {
            await sendPlanChangeEmail({
              email: userData.email,
              firstName: userData.first_name || '',
              oldPlan: oldPlanType,
              newPlan: newPlanType,
              role: userData.role as 'accompagnante' | 'accompagne',
              userId: existing.user_id,
            })
          }
        }
      }

      break
    }

    case 'customer.subscription.deleted': {
      const subscription = event.data.object as Stripe.Subscription

      const { data: existing } = await supabase
        .from('subscriptions')
        .select('user_id')
        .eq('stripe_subscription_id', subscription.id)
        .single()

      if (!existing) break
      const deletedUserId = existing.user_id

      await supabase
        .from('subscriptions')
        .update({
          status: 'cancelled',
          cancelled_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        })
        .eq('stripe_subscription_id', subscription.id)

      // Send cancellation email
      if (deletedUserId) {
        const { data: userData } = await supabase
          .from('users')
          .select('email, first_name, role')
          .eq('id', deletedUserId)
          .single()

        if (userData) {
          await sendSubscriptionCancelEmail({
            email: userData.email,
            firstName: userData.first_name || '',
            role: userData.role as 'accompagnante' | 'accompagne',
            userId: deletedUserId,
          })
        }
      }
      break
    }

    case 'invoice.payment_failed': {
      const invoice = event.data.object as Stripe.Invoice

      const subscriptionId = (invoice.parent as any)?.subscription_details?.subscription
      if (!subscriptionId) break

      const subId = typeof subscriptionId === 'string' ? subscriptionId : subscriptionId.id

      await supabase
        .from('subscriptions')
        .update({
          status: 'past_due',
          updated_at: new Date().toISOString(),
        })
        .eq('stripe_subscription_id', subId)

      break
    }

    case 'invoice.upcoming': {
      const invoice = event.data.object as Stripe.Invoice

      const customerId = typeof invoice.customer === 'string'
        ? invoice.customer
        : invoice.customer?.id

      if (!customerId) break

      const { data: sub } = await supabase
        .from('subscriptions')
        .select('user_id, stripe_price_id')
        .eq('stripe_customer_id', customerId)
        .order('created_at', { ascending: false })
        .limit(1)
        .single()

      if (!sub) break

      const { data: userData } = await supabase
        .from('users')
        .select('email, first_name, role')
        .eq('id', sub.user_id)
        .single()

      if (!userData) break

      const alreadySent = await hasRecentNotification(supabase, sub.user_id, 'renewal_reminder')
      if (!alreadySent) {
        const amount = (invoice.amount_due ?? 0) / 100
        const periodEnd = invoice.period_end
          ? new Date(invoice.period_end * 1000).toISOString()
          : new Date().toISOString()

        await sendRenewalReminderEmail({
          email: userData.email,
          firstName: userData.first_name || '',
          renewalDate: periodEnd,
          amount,
          role: userData.role as 'accompagnante' | 'accompagne',
          userId: sub.user_id,
        })
      }

      break
    }
  }

  return NextResponse.json({ received: true })
}
