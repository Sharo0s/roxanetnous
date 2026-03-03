import { createClient } from '@/lib/supabase/server'
import { hasActiveSubscription } from '@/lib/subscription-helpers'
import type { SubscriptionInfo } from '@/lib/subscription-helpers'

export async function hasPlanningSubscription(userId: string): Promise<boolean> {
  const supabase = await createClient({ serviceRole: true })

  const { data } = await supabase
    .from('planning_subscriptions')
    .select('status, current_period_end')
    .eq('user_id', userId)
    .in('status', ['active', 'trialing'])
    .single()

  if (!data) return false

  if (data.current_period_end) {
    return new Date(data.current_period_end) > new Date()
  }

  return true
}

export async function getPlanningSubscriptionStatus(userId: string): Promise<SubscriptionInfo> {
  const supabase = await createClient({ serviceRole: true })

  const { data } = await supabase
    .from('planning_subscriptions')
    .select('status, current_period_end, cancel_at, stripe_customer_id, stripe_subscription_id')
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
  }
}

export async function canAccessPlanning(userId: string): Promise<boolean> {
  const [hasBase, hasPlanning] = await Promise.all([
    hasActiveSubscription(userId),
    hasPlanningSubscription(userId),
  ])
  return hasBase && hasPlanning
}
