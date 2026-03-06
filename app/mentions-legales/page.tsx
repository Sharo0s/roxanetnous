import Link from 'next/link'
import { Footer } from '@/components/footer'

export default function MentionsLegalesPage() {
  return (
    <div className="min-h-screen flex flex-col kraft bg-kraft">
      <main className="flex-1 max-w-3xl mx-auto px-4 py-12 relative z-10">
        <Link href="/" className="text-sm text-black/50 hover:text-black transition">
          Retour a l&apos;accueil
        </Link>

        <h1 className="text-3xl font-bold text-black mt-6 mb-8">Mentions legales</h1>

        <div className="space-y-8 text-gray-700 text-sm leading-relaxed">
          <section>
            <h2 className="text-lg font-semibold text-black mb-2">Editeur du site</h2>
            <p>[Nom de la societe ou de l&apos;entrepreneur individuel]</p>
            <p>[Forme juridique - ex: SAS, SARL, auto-entrepreneur]</p>
            <p>[Adresse du siege social]</p>
            <p>[Numero SIRET]</p>
            <p>[Numero de TVA intracommunautaire]</p>
            <p>Email : [contact@roxanetnous.fr]</p>
            <p>Telephone : [numero]</p>
            <p>Directeur de la publication : [Nom du responsable]</p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-black mb-2">Hebergeur</h2>
            <p>Vercel Inc.</p>
            <p>440 N Barranca Ave #4133</p>
            <p>Covina, CA 91723, USA</p>
            <p>Site web : vercel.com</p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-black mb-2">Base de donnees</h2>
            <p>Supabase Inc.</p>
            <p>970 Toa Payoh North #07-04</p>
            <p>Singapore 318992</p>
            <p>Site web : supabase.com</p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-black mb-2">Paiements</h2>
            <p>Les paiements sont traites par Stripe Payments Europe, Ltd.</p>
            <p>1 Grand Canal Street Lower, Grand Canal Dock, Dublin, D02 H210, Irlande</p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-black mb-2">Propriete intellectuelle</h2>
            <p>
              L&apos;ensemble du contenu de ce site (textes, images, structure) est protege par le
              droit d&apos;auteur. Toute reproduction ou representation, en tout ou partie, est
              interdite sans autorisation prealable de l&apos;editeur.
            </p>
          </section>
        </div>
      </main>
      <Footer />
    </div>
  )
}
