import Stripe from 'stripe'

export const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
  apiVersion: '2026-04-22.dahlia',
  typescript: true,
})

export type PlanType = 'mensuel' | 'annuel'

export function getStripePriceId(role: 'accompagnant' | 'accompagne', plan: PlanType): string {
  const prices: Record<string, string> = {
    accompagnant_mensuel: process.env.STRIPE_PRICE_AUXILIAIRE_MENSUEL || process.env.STRIPE_PRICE_ACCOMPAGNANTE_MENSUEL || '',
    accompagnant_annuel: process.env.STRIPE_PRICE_AUXILIAIRE_ANNUEL || process.env.STRIPE_PRICE_ACCOMPAGNANTE_ANNUEL || '',
    accompagne_mensuel: process.env.STRIPE_PRICE_BENEFICIAIRE_MENSUEL || process.env.STRIPE_PRICE_ACCOMPAGNE_MENSUEL || '',
    accompagne_annuel: process.env.STRIPE_PRICE_BENEFICIAIRE_ANNUEL || process.env.STRIPE_PRICE_ACCOMPAGNE_ANNUEL || '',
  }
  return prices[`${role}_${plan}`]
}

// Offre de lancement : essai gratuit 1 mois
export function getTrialDays(plan: PlanType): number | undefined {
  const launchEnd = process.env.LAUNCH_OFFER_END
  if (!launchEnd) return undefined

  const now = new Date()
  const end = new Date(launchEnd)

  if (now >= end) return undefined

  if (plan === 'mensuel' || plan === 'annuel') return 30  // ~1 mois
  return undefined
}

export function isLaunchOffer(): boolean {
  const launchEnd = process.env.LAUNCH_OFFER_END
  if (!launchEnd) return false
  return new Date() < new Date(launchEnd)
}
