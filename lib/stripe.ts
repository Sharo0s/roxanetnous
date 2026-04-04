import Stripe from 'stripe'

export const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
  apiVersion: '2026-01-28.clover',
  typescript: true,
})

export type PlanType = 'mensuel' | 'annuel'

export function getStripePriceId(role: 'accompagnante' | 'accompagne', plan: PlanType): string {
  const prices: Record<string, string> = {
    accompagnante_mensuel: process.env.STRIPE_PRICE_ACCOMPAGNANTE_MENSUEL!,
    accompagnante_annuel: process.env.STRIPE_PRICE_ACCOMPAGNANTE_ANNUEL!,
    accompagne_mensuel: process.env.STRIPE_PRICE_ACCOMPAGNE_MENSUEL!,
    accompagne_annuel: process.env.STRIPE_PRICE_ACCOMPAGNE_ANNUEL!,
  }
  return prices[`${role}_${plan}`]
}

// Offre de lancement : essai gratuit 2 mois
export function getTrialDays(plan: PlanType): number | undefined {
  const launchEnd = process.env.LAUNCH_OFFER_END
  if (!launchEnd) return undefined

  const now = new Date()
  const end = new Date(launchEnd)

  if (now >= end) return undefined

  if (plan === 'mensuel' || plan === 'annuel') return 60  // ~2 mois
  return undefined
}

export function isLaunchOffer(): boolean {
  const launchEnd = process.env.LAUNCH_OFFER_END
  if (!launchEnd) return false
  return new Date() < new Date(launchEnd)
}
