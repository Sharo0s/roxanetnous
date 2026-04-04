import Stripe from 'stripe'

export const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
  apiVersion: '2026-01-28.clover',
  typescript: true,
})

export type PlanType = 'mensuel' | 'annuel'

export function getStripePriceId(role: 'auxiliaire' | 'beneficiaire', plan: PlanType): string {
  const prices: Record<string, string> = {
    auxiliaire_mensuel: process.env.STRIPE_PRICE_AUXILIAIRE_MENSUEL!,
    auxiliaire_annuel: process.env.STRIPE_PRICE_AUXILIAIRE_ANNUEL!,
    beneficiaire_mensuel: process.env.STRIPE_PRICE_BENEFICIAIRE_MENSUEL!,
    beneficiaire_annuel: process.env.STRIPE_PRICE_BENEFICIAIRE_ANNUEL!,
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

export type PlanningPlanType = 'mensuel' | 'annuel'

export function getPlanningPriceId(plan: PlanningPlanType): string {
  const prices: Record<string, string> = {
    mensuel: process.env.STRIPE_PRICE_PLANNING_MENSUEL!,
    annuel: process.env.STRIPE_PRICE_PLANNING_ANNUEL!,
  }
  return prices[plan]
}

export function isLaunchOffer(): boolean {
  const launchEnd = process.env.LAUNCH_OFFER_END
  if (!launchEnd) return false
  return new Date() < new Date(launchEnd)
}
