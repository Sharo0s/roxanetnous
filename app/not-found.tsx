import Link from 'next/link'

export default function NotFound() {
  return (
    <main id="main-content" tabIndex={-1} className="min-h-screen bg-[#fefaf8] flex flex-col items-center justify-center p-8 focus:outline-none">
      <div className="text-center max-w-md relative z-10">
        <span className="inline-block text-[11px] uppercase tracking-[0.18em] text-kraft font-medium mb-3">
          Erreur 404
        </span>
        <h1 className="text-5xl md:text-6xl italic text-gray-900 leading-tight mb-4">404</h1>
        <p className="text-gray-600 mb-8 max-w-sm mx-auto">
          Cette page n&apos;existe pas ou a été déplacée.
        </p>
        <div className="flex flex-wrap gap-3 justify-center">
          <Link
            href="/"
            className="inline-flex items-center px-5 py-2.5 rounded-full bg-accent border border-accent text-black hover:bg-kraft hover:border-kraft hover:text-white transition text-sm font-medium"
          >
            Retour à l&apos;accueil
          </Link>
          <Link
            href="/recherche"
            className="inline-flex items-center px-5 py-2.5 rounded-full bg-white border border-[#e8dfd2] text-gray-900 hover:border-kraft transition text-sm font-medium"
          >
            Rechercher
          </Link>
        </div>
      </div>
    </main>
  )
}
