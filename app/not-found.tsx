import Link from 'next/link'

export default function NotFound() {
  return (
    <main className="min-h-screen bg-gray-50 flex flex-col items-center justify-center p-8">
      <div className="text-center max-w-md">
        <h1 className="text-6xl font-bold text-black mb-4">404</h1>
        <p className="text-xl text-gray-600 mb-8">
          Cette page n&#39;existe pas ou a ete deplacee.
        </p>
        <div className="flex gap-4 justify-center">
          <Link
            href="/"
            className="px-6 py-3 bg-black text-white rounded-lg hover:bg-gray-800 transition text-sm font-medium"
          >
            Retour a l&#39;accueil
          </Link>
          <Link
            href="/recherche"
            className="px-6 py-3 border-2 border-black text-black rounded-lg hover:bg-gray-100 transition text-sm font-medium"
          >
            Rechercher
          </Link>
        </div>
      </div>
    </main>
  )
}
