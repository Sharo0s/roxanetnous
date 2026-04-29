import Link from 'next/link'
import { Footer } from '@/components/footer'

export default function MentionsLegalesPage() {
  return (
    <div className="min-h-screen flex flex-col kraft bg-kraft">
      <main className="flex-1 max-w-3xl mx-auto px-4 py-12 relative z-10">
        <Link href="/" className="text-sm text-black/50 hover:text-black transition">
          Retour à l&apos;accueil
        </Link>

        <h1 className="text-3xl font-bold text-black mt-6 mb-8">Mentions légales</h1>

        <div className="space-y-8 text-gray-700 text-sm leading-relaxed">
          <section>
            <h2 className="text-lg font-semibold text-black mb-2">Éditeur du site</h2>
            <p>[Nom de la société ou de l&apos;entrepreneur individuel]</p>
            <p>[Forme juridique - ex: SAS, SARL, auto-entrepreneur]</p>
            <p>[Adresse du siège social]</p>
            <p>[Numéro SIRET]</p>
            <p>[Numéro de TVA intracommunautaire]</p>
            <p>Email : roxanetnous@outlook.com</p>
            <p>Téléphone : [numéro]</p>
            <p>Directeur de la publication : [Nom du responsable]</p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-black mb-2">Hébergeur</h2>
            <p>Vercel Inc.</p>
            <p>440 N Barranca Ave #4133</p>
            <p>Covina, CA 91723, USA</p>
            <p>Site web : vercel.com</p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-black mb-2">Base de données</h2>
            <p>Supabase Inc.</p>
            <p>970 Toa Payoh North #07-04</p>
            <p>Singapore 318992</p>
            <p>Site web : supabase.com</p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-black mb-2">Paiements</h2>
            <p>Les paiements sont traités par Stripe Payments Europe, Ltd.</p>
            <p>1 Grand Canal Street Lower, Grand Canal Dock, Dublin, D02 H210, Irlande</p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-black mb-2">Propriété intellectuelle</h2>
            <p>
              L&apos;ensemble du contenu de ce site (textes, images, structure) est protégé par le
              droit d&apos;auteur. Toute reproduction ou représentation, en tout ou partie, est
              interdite sans autorisation préalable de l&apos;éditeur.
            </p>
          </section>
        </div>
      </main>
      <Footer />
    </div>
  )
}
