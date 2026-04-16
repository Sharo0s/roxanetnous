import { createCheckoutSession, createPortalSession, switchPlan, reactivateSubscription } from '@/app/actions/subscription'
import { isLaunchOffer } from '@/lib/stripe'
import type { SubscriptionInfo, PaymentMethod, Invoice, SubscriptionAmount } from '@/lib/subscription-helpers'
import { CancelModal } from './cancel-modal'

const CONTACT_EMAIL = 'contact@roxanetnous.fr'

export function SubscriptionPageContent({
  subscription,
  paymentMethod,
  invoices,
  role,
  amount,
  searchParams,
}: {
  subscription: SubscriptionInfo
  paymentMethod?: PaymentMethod | null
  invoices?: Invoice[]
  role?: 'accompagnante' | 'accompagne'
  amount?: SubscriptionAmount | null
  searchParams?: Record<string, string | string[] | undefined>
}) {
  const launch = isLaunchOffer()
  const switchError = searchParams?.error === 'switch_failed'

  const formatDate = (dateStr: string | null) => {
    if (!dateStr) return '-'
    return new Date(dateStr).toLocaleDateString('fr-FR', {
      day: 'numeric',
      month: 'long',
      year: 'numeric',
    })
  }

  const formatAmount = (value: number) => {
    return value.toFixed(2).replace('.', ',') + ' EUR'
  }

  if (subscription.active) {
    const planLabel = subscription.planType === 'annuel' ? 'Annuel' : 'Mensuel'
    const isTrialing = subscription.status === 'trialing'
    const hasCancelAt = !!subscription.cancelAt

    return (
      <div className="space-y-4">
        {/* Details de l'abonnement */}
        <div className="bg-white rounded-xl border p-6">
          <div className="flex items-center gap-3 mb-4">
            <h3 className="font-semibold text-lg">Détails de l&apos;abonnement</h3>
            <span className="px-2 py-1 rounded-full text-xs font-medium bg-accent text-black">
              {isTrialing ? 'Essai gratuit' : hasCancelAt ? 'Annulation prévue' : 'Actif'}
            </span>
          </div>

          <dl className="space-y-3 text-sm">
            <div className="flex justify-between">
              <dt className="text-gray-600">Formule</dt>
              <dd className="text-gray-900 font-medium">{planLabel}</dd>
            </div>
            {amount && (
              <div className="flex justify-between">
                <dt className="text-gray-600">Montant</dt>
                <dd className="text-gray-900 font-medium">
                  {formatAmount(amount.amount)}/{amount.interval === 'year' ? 'an' : 'mois'}
                </dd>
              </div>
            )}
            {isTrialing ? (
              <div className="flex justify-between">
                <dt className="text-gray-600">Fin de l&apos;essai gratuit</dt>
                <dd className="text-gray-900 font-medium">{formatDate(subscription.trialEnd || subscription.currentPeriodEnd)}</dd>
              </div>
            ) : (
              <div className="flex justify-between">
                <dt className="text-gray-600">Prochaine échéance</dt>
                <dd className="text-gray-900 font-medium">{formatDate(subscription.currentPeriodEnd)}</dd>
              </div>
            )}
            {hasCancelAt && (
              <div className="flex justify-between">
                <dt className="text-gray-600">Fin d&apos;accès prévue le</dt>
                <dd className="text-gray-900 font-medium">{formatDate(subscription.cancelAt)}</dd>
              </div>
            )}
          </dl>
        </div>

        {/* Moyen de paiement */}
        <div className="bg-white rounded-xl border p-6">
          <h3 className="font-semibold text-lg mb-4">Moyen de paiement</h3>
          {paymentMethod ? (
            <div className="flex items-center justify-between">
              <div className="text-sm">
                <p className="text-gray-900 font-medium capitalize">{paymentMethod.brand} **** {paymentMethod.last4}</p>
                <p className="text-gray-500">Expire {paymentMethod.expMonth.toString().padStart(2, '0')}/{paymentMethod.expYear}</p>
              </div>
              <form action={createPortalSession}>
                <button
                  type="submit"
                  className="px-4 py-2 text-sm font-medium bg-accent text-black rounded-lg btn-hover transition-colors"
                >
                  Modifier
                </button>
              </form>
            </div>
          ) : (
            <div className="flex items-center justify-between">
              <p className="text-sm text-gray-500">Information indisponible</p>
              <form action={createPortalSession}>
                <button
                  type="submit"
                  className="px-4 py-2 text-sm font-medium bg-accent text-black rounded-lg btn-hover transition-colors"
                >
                  Gérer via Stripe
                </button>
              </form>
            </div>
          )}
        </div>

        {/* Changer de formule (pas en trial, pas en annulation) */}
        {!isTrialing && !hasCancelAt && (
          <div className="bg-white rounded-xl border p-6">
            <h3 className="font-semibold text-lg mb-4">Changer de formule</h3>
            {switchError && (
              <p className="text-sm text-red-600 mb-4">
                Une erreur est survenue lors du changement de formule. Veuillez réessayer.
              </p>
            )}
            {subscription.planType === 'mensuel' ? (
              <div className="flex items-center justify-between">
                <div className="text-sm">
                  <p className="text-gray-900 font-medium">Passer à l&apos;annuel</p>
                  <p className="text-gray-500">La formule annuelle offre un meilleur tarif au mois</p>
                </div>
                <form action={switchPlan}>
                  <input type="hidden" name="plan" value="annuel" />
                  <button
                    type="submit"
                    className="px-4 py-2.5 text-sm font-medium bg-accent text-black rounded-lg btn-hover transition-colors"
                  >
                    Passer à l&apos;annuel
                  </button>
                </form>
              </div>
            ) : (
              <div className="flex items-center justify-between">
                <div className="text-sm">
                  <p className="text-gray-900 font-medium">Passer au mensuel</p>
                  <p className="text-gray-500">Le tarif mensuel est plus élevé que le tarif annuel rapporté au mois
                  </p>
                </div>
                <form action={switchPlan}>
                  <input type="hidden" name="plan" value="mensuel" />
                  <button
                    type="submit"
                    className="px-4 py-2.5 text-sm font-medium bg-accent text-black rounded-lg btn-hover transition-colors"
                  >
                    Passer au mensuel
                  </button>
                </form>
              </div>
            )}
          </div>
        )}

        {/* Reactiver (si annulation prevue) */}
        {hasCancelAt && (
          <div className="bg-white rounded-xl border p-6">
            <div className="flex items-center justify-between">
              <div className="text-sm">
                <p className="text-gray-900 font-medium">Réactiver mon abonnement</p>
                <p className="text-gray-500">Annuler la résiliation et conserver votre accès</p>
              </div>
              <form action={reactivateSubscription}>
                <button
                  type="submit"
                  className="px-4 py-2.5 text-sm font-medium bg-accent text-black rounded-lg btn-hover transition-colors"
                >
                  Réactiver
                </button>
              </form>
            </div>
          </div>
        )}

        {/* Historique des factures */}
        <div className="bg-white rounded-xl border p-6">
          <h3 className="font-semibold text-lg mb-4">Historique des factures</h3>
          {invoices && invoices.length > 0 ? (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b">
                    <th className="text-left py-2 text-gray-500 font-medium">Date</th>
                    <th className="text-left py-2 text-gray-500 font-medium">Montant</th>
                    <th className="text-left py-2 text-gray-500 font-medium">Statut</th>
                    <th className="text-right py-2 text-gray-500 font-medium">Facture</th>
                  </tr>
                </thead>
                <tbody>
                  {invoices.map((invoice) => (
                    <tr key={invoice.id} className="border-b last:border-0">
                      <td className="py-3 text-gray-900">
                        {new Date(invoice.date).toLocaleDateString('fr-FR')}
                      </td>
                      <td className="py-3 text-gray-900">{formatAmount(invoice.amount)}</td>
                      <td className="py-3">
                        <span className="px-2 py-0.5 rounded-full text-xs font-medium bg-accent/20 text-black">
                          Payé
                        </span>
                      </td>
                      <td className="py-3 text-right">
                        {invoice.pdfUrl ? (
                          <a
                            href={invoice.pdfUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-sm font-medium text-gray-700 hover:text-black transition-colors"
                          >
                            Télécharger
                          </a>
                        ) : (
                          <span className="text-gray-400">-</span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <p className="text-sm text-gray-500">
              {subscription.status === 'trialing'
                ? 'Aucune facture pendant l\'essai gratuit.'
                : 'Aucune facture disponible.'}
            </p>
          )}
        </div>

        {/* Resilier (si pas deja en annulation) */}
        {!hasCancelAt && (
          <div className="flex justify-start">
            <CancelModal subscription={subscription} />
          </div>
        )}

        {/* Mentions legales */}
        <div className="text-xs text-gray-500 space-y-1 pt-4">
          <p>
            Conformément à la législation, vous disposez d&apos;un droit de rétractation de 14 jours à compter de la souscription.
            Pour l&apos;exercer, contactez-nous à{' '}
            <a href={`mailto:${CONTACT_EMAIL}`} className="underline hover:text-gray-700">{CONTACT_EMAIL}</a>.
          </p>
          <p>
            Consultez nos{' '}
            <a href="/cgu" className="underline hover:text-gray-700">Conditions Générales d&apos;Utilisation</a>.
          </p>
        </div>
      </div>
    )
  }

  // Vue non-abonne (pricing cards) — inchangee
  return (
    <div className="space-y-4">
      {launch && (
        <div className="bg-accent text-black rounded-xl p-4 text-center">
          <p className="font-semibold">Offre de lancement</p>
          <p className="text-sm text-black/70 mt-1">
            2 mois offerts pour les premiers inscrits
          </p>
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* Mensuel */}
        <div className="bg-white rounded-xl border p-6 flex flex-col">
          <h3 className="font-semibold text-lg mb-1">Mensuel</h3>
          <p className="mb-1">
            <span className="text-lg text-gray-400 line-through">4,99€</span>
            <span className="text-2xl font-bold text-accent ml-2">2,99€/mois</span>
          </p>
          <p className="text-sm text-gray-500 mb-4">Pendant 1 mois, puis 4,99 €/mois</p>
          <ul className="space-y-2 text-sm text-gray-600 mb-6 flex-1">
            <li className="flex items-start gap-2">
              <span className="text-black font-bold mt-0.5">-</span>
              <span>Accès complet à la plateforme</span>
            </li>
            <li className="flex items-start gap-2">
              <span className="text-black font-bold mt-0.5">-</span>
              <span>Annulation à tout moment</span>
            </li>
          </ul>
          <form action={createCheckoutSession}>
            <input type="hidden" name="plan" value="mensuel" />
            <button
              type="submit"
              className="w-full px-4 py-3 border-2 border-accent text-black rounded-lg btn-hover transition text-sm font-medium"
            >
              {launch ? 'Essayer gratuitement' : 'S\'abonner'}
            </button>
          </form>
        </div>

        {/* Annuel */}
        <div className="bg-white rounded-xl border-2 border-accent p-6 flex flex-col relative">
          <div className="absolute -top-3 left-1/2 -translate-x-1/2 bg-accent text-black text-xs px-3 py-1 rounded-full font-medium">
            2 mois offerts
          </div>
          <h3 className="font-semibold text-lg mb-1">Annuel</h3>
          <p className="mb-1">
            <span className="text-lg text-gray-400 line-through">59,88€</span>
            <span className="text-2xl font-bold text-accent ml-2">49,99€/an</span>
          </p>
          <p className="text-sm text-gray-500 mb-4">soit 4,17 €/mois</p>
          <ul className="space-y-2 text-sm text-gray-600 mb-6 flex-1">
            <li className="flex items-start gap-2">
              <span className="text-black font-bold mt-0.5">-</span>
              <span>Accès complet à la plateforme</span>
            </li>
            <li className="flex items-start gap-2">
              <span className="text-black font-bold mt-0.5">-</span>
              <span>Meilleur rapport qualité-prix</span>
            </li>
          </ul>
          <form action={createCheckoutSession}>
            <input type="hidden" name="plan" value="annuel" />
            <button
              type="submit"
              className="w-full px-4 py-3 bg-accent text-black rounded-lg btn-hover transition text-sm font-medium"
            >
              {launch ? 'Essayer gratuitement' : 'S\'abonner'}
            </button>
          </form>
        </div>
      </div>

      {subscription.status === 'cancelled' && (
        <p className="text-sm text-gray-500 text-center">
          Votre abonnement précédent a été annulé. Vous pouvez vous réabonner à tout moment.
        </p>
      )}
    </div>
  )
}
