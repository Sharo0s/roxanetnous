import { NextRequest, NextResponse } from 'next/server'
import { stripe } from '@/lib/stripe'
import { createServerClient } from '@supabase/ssr'
import { sendSubscriptionConfirmEmail, sendSubscriptionCancelEmail } from '@/lib/emails'
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
        .select('email, first_name')
        .eq('id', userId)
        .single()

      if (userData) {
        await sendSubscriptionConfirmEmail({
          email: userData.email,
          firstName: userData.first_name || '',
          userId,
        })
      }
      break
    }

    case 'customer.subscription.updated': {
      const subscription = event.data.object as Stripe.Subscription

      const { data: existing } = await supabase
        .from('subscriptions')
        .select('user_id')
        .eq('stripe_subscription_id', subscription.id)
        .single()

      if (!existing) break

      const period = getSubscriptionPeriod(subscription)
      const updateData: Record<string, unknown> = {
        status: subscription.status === 'active' ? 'active' : subscription.status === 'past_due' ? 'past_due' : subscription.status === 'canceled' ? 'cancelled' : subscription.status,
        current_period_start: period.currentPeriodStart,
        current_period_end: period.currentPeriodEnd,
        updated_at: new Date().toISOString(),
      }

      if (subscription.cancel_at) {
        updateData.cancel_at = new Date(subscription.cancel_at * 1000).toISOString()
      }
      if (subscription.canceled_at) {
        updateData.cancelled_at = new Date(subscription.canceled_at * 1000).toISOString()
      }

      await supabase
        .from('subscriptions')
        .update(updateData)
        .eq('stripe_subscription_id', subscription.id)

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
          .select('email, first_name')
          .eq('id', deletedUserId)
          .single()

        if (userData) {
          await sendSubscriptionCancelEmail({
            email: userData.email,
            firstName: userData.first_name || '',
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
  }

  return NextResponse.json({ received: true })
}
