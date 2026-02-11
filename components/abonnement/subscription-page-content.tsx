import { createCheckoutSession, createPortalSession, cancelSubscription } from '@/app/actions/subscription'
import { isLaunchOffer } from '@/lib/stripe'
import type { SubscriptionInfo } from '@/lib/subscription-helpers'

export function SubscriptionPageContent({
  subscription,
}: {
  subscription: SubscriptionInfo
}) {
  const launch = isLaunchOffer()

  const formatDate = (dateStr: string | null) => {
    if (!dateStr) return '-'
    return new Date(dateStr).toLocaleDateString('fr-FR', {
      day: 'numeric',
      month: 'long',
      year: 'numeric',
    })
  }

  if (subscription.active) {
    return (
      <div className="space-y-4">
        <div className="bg-white rounded-xl border p-6">
          <div className="flex items-center gap-3 mb-4">
            <h3 className="font-semibold text-lg">Abonnement actif</h3>
            <span className="px-2 py-1 rounded-full text-xs font-medium bg-black text-white">
              {subscription.status === 'trialing' ? 'Essai gratuit' : 'Actif'}
            </span>
          </div>

          <div className="space-y-2 text-sm">
            {subscription.status === 'trialing' && (
              <div className="flex justify-between">
                <span className="text-gray-600">Fin de l'essai gratuit</span>
                <span className="text-gray-900 font-medium">{formatDate(subscription.currentPeriodEnd)}</span>
              </div>
            )}
            {subscription.status !== 'trialing' && (
              <div className="flex justify-between">
                <span className="text-gray-600">Prochaine echeance</span>
                <span className="text-gray-900 font-medium">{formatDate(subscription.currentPeriodEnd)}</span>
              </div>
            )}
            {subscription.cancelAt && (
              <div className="flex justify-between">
                <span className="text-gray-600">Annulation prevue le</span>
                <span className="text-gray-900 font-medium">{formatDate(subscription.cancelAt)}</span>
              </div>
            )}
          </div>
        </div>

        <div className="flex gap-3">
          <form action={createPortalSession}>
            <button
              type="submit"
              className="px-4 py-2 bg-black text-white rounded-lg hover:bg-gray-800 transition text-sm font-medium"
            >
              Gerer mon abonnement
            </button>
          </form>

          {!subscription.cancelAt && (
            <form action={cancelSubscription}>
              <button
                type="submit"
                className="px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:border-black transition text-sm font-medium"
              >
                Annuler
              </button>
            </form>
          )}
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-4">
      {launch && (
        <div className="bg-gray-900 text-white rounded-xl p-4 text-center">
          <p className="font-semibold">Offre de lancement</p>
          <p className="text-sm text-gray-300 mt-1">
            2 mois offerts sur le mensuel, 3 mois offerts sur l'annuel
          </p>
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* Mensuel */}
        <div className="bg-white rounded-xl border p-6 flex flex-col">
          <h3 className="font-semibold text-lg mb-1">Mensuel</h3>
          <p className="text-2xl font-bold text-gray-900 mb-1">4,99 / mois</p>
          {launch && (
            <p className="text-sm text-gray-600 mb-4">2 mois d'essai gratuit</p>
          )}
          {!launch && (
            <p className="text-sm text-gray-600 mb-4">Sans engagement</p>
          )}
          <ul className="space-y-2 text-sm text-gray-600 mb-6 flex-1">
            <li className="flex items-start gap-2">
              <span className="text-black font-bold mt-0.5">-</span>
              <span>Acces complet a la plateforme</span>
            </li>
            <li className="flex items-start gap-2">
              <span className="text-black font-bold mt-0.5">-</span>
              <span>Annulation a tout moment</span>
            </li>
          </ul>
          <form action={createCheckoutSession}>
            <input type="hidden" name="plan" value="mensuel" />
            <button
              type="submit"
              className="w-full px-4 py-3 border-2 border-black text-black rounded-lg hover:bg-gray-100 transition text-sm font-medium"
            >
              {launch ? 'Essayer gratuitement' : 'S\'abonner'}
            </button>
          </form>
        </div>

        {/* Annuel */}
        <div className="bg-white rounded-xl border-2 border-black p-6 flex flex-col relative">
          <div className="absolute -top-3 left-1/2 -translate-x-1/2 bg-black text-white text-xs px-3 py-1 rounded-full font-medium">
            2 mois offerts
          </div>
          <h3 className="font-semibold text-lg mb-1">Annuel</h3>
          <p className="text-2xl font-bold text-gray-900 mb-1">49,99 / an</p>
          <p className="text-sm text-gray-600 mb-1">soit 4,17 / mois</p>
          {launch && (
            <p className="text-sm text-gray-600 mb-4">+ 3 mois d'essai gratuit</p>
          )}
          {!launch && (
            <p className="text-sm text-gray-600 mb-4">Economies de 2 mois</p>
          )}
          <ul className="space-y-2 text-sm text-gray-600 mb-6 flex-1">
            <li className="flex items-start gap-2">
              <span className="text-black font-bold mt-0.5">-</span>
              <span>Acces complet a la plateforme</span>
            </li>
            <li className="flex items-start gap-2">
              <span className="text-black font-bold mt-0.5">-</span>
              <span>Meilleur rapport qualite-prix</span>
            </li>
          </ul>
          <form action={createCheckoutSession}>
            <input type="hidden" name="plan" value="annuel" />
            <button
              type="submit"
              className="w-full px-4 py-3 bg-black text-white rounded-lg hover:bg-gray-800 transition text-sm font-medium"
            >
              {launch ? 'Essayer gratuitement' : 'S\'abonner'}
            </button>
          </form>
        </div>
      </div>

      {subscription.status === 'cancelled' && (
        <p className="text-sm text-gray-500 text-center">
          Votre abonnement precedent a ete annule. Vous pouvez vous reabonner a tout moment.
        </p>
      )}
    </div>
  )
}
