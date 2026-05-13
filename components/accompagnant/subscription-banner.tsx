import Link from 'next/link'

export function SubscriptionBanner() {
  return (
    <div className="bg-white rounded-xl border-2 border-accent p-6">
      <h3 className="font-semibold text-lg mb-2">Abonnement requis</h3>
      <p className="text-gray-600 mb-4">
        Souscrivez un abonnement pour publier vos annonces.
      </p>
      <Link
        href="/accompagnant/abonnement"
        className="inline-flex items-center px-4 py-2 bg-accent text-black rounded-lg transition text-sm font-medium btn-hover"
      >
        Voir les offres
      </Link>
    </div>
  )
}
