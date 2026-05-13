import { createCheckoutSession, createPortalSession, switchPlan, reactivateSubscription } from '@/app/actions/subscription'
import { isLaunchOffer } from '@/lib/stripe'
import type { SubscriptionInfo, PaymentMethod, Invoice, SubscriptionAmount } from '@/lib/subscription-helpers'
import { CancelModal } from './cancel-modal'

const CONTACT_EMAIL = 'roxanetnous@outlook.com'

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
  role?: 'accompagnant' | 'accompagne'
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

    const statusBadgeClass = isTrialing
      ? 'bg-[#f0e9e0] text-[#6b5635]'
      : hasCancelAt
        ? 'bg-[#fbf0ed] text-[#8a3a2e]'
        : 'bg-[#faecd9] text-gray-900'
    const statusBadgeLabel = isTrialing ? 'Essai gratuit' : hasCancelAt ? 'Annulation prévue' : 'Actif'

    return (
      <div className="space-y-4">
        {/* Details de l'abonnement */}
        <section className="bg-white rounded-2xl border border-[#e8dfd2] p-7">
          <div className="flex items-center gap-3 mb-5">
            <h3 className="italic text-xl text-gray-900">Détails de l&apos;abonnement</h3>
            <span className={`px-2.5 py-0.5 rounded-full text-[10px] uppercase tracking-[0.12em] font-medium ${statusBadgeClass}`}>
              {statusBadgeLabel}
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
        </section>

        {/* Moyen de paiement */}
        <section className="bg-white rounded-2xl border border-[#e8dfd2] p-7">
          <h3 className="italic text-xl text-gray-900 mb-5">Moyen de paiement</h3>
          {paymentMethod ? (
            <div className="flex items-center justify-between gap-4">
              <div className="text-sm">
                <p className="text-gray-900 font-medium capitalize">{paymentMethod.brand} **** {paymentMethod.last4}</p>
                <p className="text-gray-500">Expire {paymentMethod.expMonth.toString().padStart(2, '0')}/{paymentMethod.expYear}</p>
              </div>
              <form action={createPortalSession}>
                <button
                  type="submit"
                  className="px-5 py-2 text-sm font-medium bg-accent border border-accent text-black rounded-full hover:bg-kraft hover:border-kraft transition whitespace-nowrap"
                >
                  Modifier
                </button>
              </form>
            </div>
          ) : (
            <div className="flex items-center justify-between gap-4">
              <p className="text-sm text-gray-500">Information indisponible</p>
              <form action={createPortalSession}>
                <button
                  type="submit"
                  className="px-5 py-2 text-sm font-medium bg-accent border border-accent text-black rounded-full hover:bg-kraft hover:border-kraft transition whitespace-nowrap"
                >
                  Gérer via Stripe
                </button>
              </form>
            </div>
          )}
        </section>

        {/* Changer de formule (pas en trial, pas en annulation) */}
        {!isTrialing && !hasCancelAt && (
          <section className="bg-white rounded-2xl border border-[#e8dfd2] p-7">
            <h3 className="italic text-xl text-gray-900 mb-5">Changer de formule</h3>
            {switchError && (
              <p className="text-sm text-red-700 mb-4">
                Une erreur est survenue lors du changement de formule. Veuillez réessayer.
              </p>
            )}
            {subscription.planType === 'mensuel' ? (
              <div className="flex items-center justify-between gap-4">
                <div className="text-sm">
                  <p className="text-gray-900 font-medium">Passer à l&apos;annuel</p>
                  <p className="text-gray-500">La formule annuelle offre un meilleur tarif au mois</p>
                </div>
                <form action={switchPlan}>
                  <input type="hidden" name="plan" value="annuel" />
                  <button
                    type="submit"
                    className="px-5 py-2 text-sm font-medium bg-accent border border-accent text-black rounded-full hover:bg-kraft hover:border-kraft transition whitespace-nowrap"
                  >
                    Passer à l&apos;annuel
                  </button>
                </form>
              </div>
            ) : (
              <div className="flex items-center justify-between gap-4">
                <div className="text-sm">
                  <p className="text-gray-900 font-medium">Passer au mensuel</p>
                  <p className="text-gray-500">Le tarif mensuel est plus élevé que le tarif annuel rapporté au mois
                  </p>
                </div>
                <form action={switchPlan}>
                  <input type="hidden" name="plan" value="mensuel" />
                  <button
                    type="submit"
                    className="px-5 py-2 text-sm font-medium bg-accent border border-accent text-black rounded-full hover:bg-kraft hover:border-kraft transition whitespace-nowrap"
                  >
                    Passer au mensuel
                  </button>
                </form>
              </div>
            )}
          </section>
        )}

        {/* Reactiver (si annulation prevue) */}
        {hasCancelAt && (
          <section className="bg-white rounded-2xl border border-[#e8dfd2] p-7">
            <div className="flex items-center justify-between gap-4">
              <div className="text-sm">
                <p className="text-gray-900 font-medium">Réactiver mon abonnement</p>
                <p className="text-gray-500">Annuler la résiliation et conserver votre accès</p>
              </div>
              <form action={reactivateSubscription}>
                <button
                  type="submit"
                  className="px-5 py-2 text-sm font-medium bg-accent border border-accent text-black rounded-full hover:bg-kraft hover:border-kraft transition whitespace-nowrap"
                >
                  Réactiver
                </button>
              </form>
            </div>
          </section>
        )}

        {/* Historique des factures */}
        <section className="bg-white rounded-2xl border border-[#e8dfd2] p-7">
          <h3 className="italic text-xl text-gray-900 mb-5">Historique des factures</h3>
          {invoices && invoices.length > 0 ? (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr>
                    <th className="text-left py-2 text-gray-500 font-medium text-[11px] uppercase tracking-[0.08em] border-b border-[#e8dfd2]">Date</th>
                    <th className="text-left py-2 text-gray-500 font-medium text-[11px] uppercase tracking-[0.08em] border-b border-[#e8dfd2]">Montant</th>
                    <th className="text-left py-2 text-gray-500 font-medium text-[11px] uppercase tracking-[0.08em] border-b border-[#e8dfd2]">Statut</th>
                    <th className="text-right py-2 text-gray-500 font-medium text-[11px] uppercase tracking-[0.08em] border-b border-[#e8dfd2]">Facture</th>
                  </tr>
                </thead>
                <tbody>
                  {invoices.map((invoice) => (
                    <tr key={invoice.id} className="border-b border-[#f5efe5] last:border-0">
                      <td className="py-3 text-gray-900">
                        {new Date(invoice.date).toLocaleDateString('fr-FR')}
                      </td>
                      <td className="py-3 text-gray-900">{formatAmount(invoice.amount)}</td>
                      <td className="py-3">
                        <span className="px-2 py-0.5 rounded-full text-[11px] font-medium bg-[#e0efde] text-[#4d7a47]">
                          Payé
                        </span>
                      </td>
                      <td className="py-3 text-right">
                        {invoice.pdfUrl ? (
                          <a
                            href={invoice.pdfUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-sm text-gray-700 hover:text-kraft transition underline"
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
            <p className="text-sm text-gray-500 italic">
              {subscription.status === 'trialing'
                ? 'Aucune facture pendant l\'essai gratuit.'
                : 'Aucune facture disponible.'}
            </p>
          )}
        </section>

        {/* Resilier (si pas deja en annulation) */}
        {!hasCancelAt && (
          <div className="flex justify-center pt-2">
            <CancelModal subscription={subscription} />
          </div>
        )}

        {/* Mentions legales */}
        <div className="text-xs text-gray-500 space-y-1.5 pt-6 leading-relaxed">
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

  // ─── Vue non-abonne (pricing cards) ──────────────────
  return (
    <div className="space-y-4">
      {launch && (
        <div
          className="rounded-2xl p-5 text-center"
          style={{ backgroundImage: 'linear-gradient(135deg, #faecd9 0%, #f4d8b9 100%)' }}
        >
          <p className="italic text-xl text-gray-900">Offre de lancement</p>
          <p className="text-sm text-gray-700 mt-1">
            1 mois offert pour toute inscription
          </p>
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* Mensuel */}
        <div className="bg-white rounded-2xl border border-[#e8dfd2] p-7 flex flex-col">
          <h3 className="italic text-2xl text-gray-900 mb-3">Mensuel</h3>
          <p className="mb-1">
            <span className="italic text-3xl text-gray-900">4,99 €</span>
            <span className="text-sm text-gray-500 ml-1">/mois</span>
          </p>
          <p className="text-xs text-gray-500 mb-5">Sans engagement</p>
          <ul className="space-y-2 text-sm text-gray-700 mb-6 flex-1">
            <li className="flex items-start gap-2">
              <span className="text-kraft mt-0.5" aria-hidden="true">—</span>
              <span>Sans engagement</span>
            </li>
            <li className="flex items-start gap-2">
              <span className="text-kraft mt-0.5" aria-hidden="true">—</span>
              <span>Résiliable à tout moment</span>
            </li>
          </ul>
          <form action={createCheckoutSession}>
            <input type="hidden" name="plan" value="mensuel" />
            <button
              type="submit"
              className="w-full px-4 py-3 bg-white border border-[#e8dfd2] text-gray-900 rounded-full hover:border-kraft transition text-sm font-medium"
            >
              S&apos;abonner
            </button>
          </form>
        </div>

        {/* Annuel */}
        <div className="bg-white rounded-2xl border border-kraft p-7 flex flex-col relative shadow-[0_8px_24px_-16px_rgba(208,131,99,0.4)]">
          <div className="absolute -top-2.5 left-1/2 -translate-x-1/2 bg-kraft text-white text-[10px] uppercase tracking-[0.1em] px-3 py-1 rounded-full font-medium">
            1 mois offert
          </div>
          <h3 className="italic text-2xl text-gray-900 mb-3">Annuel</h3>
          <p className="mb-1">
            <span className="text-base text-gray-400 line-through mr-2">59,88 €</span>
            <span className="italic text-3xl text-gray-900">49,99 €</span>
            <span className="text-sm text-gray-500 ml-1">/an</span>
          </p>
          <p className="text-xs text-gray-500 mb-5">soit 4,17 €/mois</p>
          <ul className="space-y-2 text-sm text-gray-700 mb-6 flex-1">
            <li className="flex items-start gap-2">
              <span className="text-kraft mt-0.5" aria-hidden="true">—</span>
              <span>Économisez 17 % sur l&apos;année</span>
            </li>
            <li className="flex items-start gap-2">
              <span className="text-kraft mt-0.5" aria-hidden="true">—</span>
              <span>Engagement annuel, paiement unique</span>
            </li>
          </ul>
          <form action={createCheckoutSession}>
            <input type="hidden" name="plan" value="annuel" />
            <button
              type="submit"
              className="w-full px-4 py-3 bg-accent border border-accent text-black rounded-full hover:bg-kraft hover:border-kraft transition text-sm font-medium"
            >
              S&apos;abonner
            </button>
          </form>
        </div>
      </div>

      {subscription.status === 'cancelled' && (
        <p className="text-sm text-gray-500 text-center italic">
          Votre abonnement précédent a été annulé. Vous pouvez vous réabonner à tout moment.
        </p>
      )}
    </div>
  )
}
