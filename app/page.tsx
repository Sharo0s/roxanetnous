import Link from 'next/link'
import { Footer } from '@/components/footer'

export default function HomePage() {
  return (
    <div className="min-h-screen flex flex-col">
      <main className="flex-1 flex flex-col items-center justify-center p-8">
        <div className="max-w-4xl text-center space-y-6">
          <h1 className="text-5xl font-bold text-black">
            roxanetnous
          </h1>
          <p className="text-2xl text-gray-600">
            Plateforme de mise en relation entre auxiliaires de vie et beneficiaires
          </p>

          <div className="flex gap-4 justify-center pt-8">
            <Link
              href="/recherche"
              className="px-6 py-3 bg-black text-white rounded-lg hover:bg-gray-800 transition"
            >
              Trouver un auxiliaire
            </Link>
            <Link
              href="/register"
              className="px-6 py-3 border-2 border-black text-black rounded-lg hover:bg-gray-100 transition"
            >
              Creer un compte
            </Link>
            <Link
              href="/login"
              className="px-6 py-3 text-gray-600 hover:text-black transition"
            >
              Se connecter
            </Link>
          </div>

          <div className="pt-12 grid grid-cols-1 md:grid-cols-2 gap-6 text-left">
            <div className="p-6 border rounded-lg">
              <h3 className="font-semibold mb-2">Auxiliaires verifies</h3>
              <p className="text-gray-600 text-sm">
                Validation manuelle des diplomes et pieces d&apos;identite
              </p>
            </div>

            <div className="p-6 border rounded-lg">
              <h3 className="font-semibold mb-2">Matching intelligent</h3>
              <p className="text-gray-600 text-sm">
                Algorithme base sur 6 criteres pour trouver le profil ideal
              </p>
            </div>
          </div>
        </div>
      </main>
      <Footer />
    </div>
  )
}
