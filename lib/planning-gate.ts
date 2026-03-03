import { hasActiveSubscription } from '@/lib/subscription-helpers'
import { hasPlanningSubscription } from '@/lib/planning-subscription-helpers'

export async function checkPlanningAccess(userId: string): Promise<{
  hasBase: boolean
  hasPlanning: boolean
  canAccess: boolean
}> {
  const [hasBase, hasPlanning] = await Promise.all([
    hasActiveSubscription(userId),
    hasPlanningSubscription(userId),
  ])

  return {
    hasBase,
    hasPlanning,
    canAccess: hasBase && hasPlanning,
  }
}
