import Link from 'next/link'

export default function MentionsLegalesPage() {
  return (
    <div className="min-h-screen flex flex-col bg-[#fefaf8]">
      <main id="main-content" tabIndex={-1} className="flex-1 max-w-3xl mx-auto px-4 py-12 md:py-16 relative z-10 focus:outline-none">
        <Link href="/" className="inline-flex items-center gap-1.5 text-sm text-gray-600 hover:text-gray-900 transition mb-6">
          <span aria-hidden="true">←</span> Retour à l&apos;accueil
        </Link>

        <header className="text-center mb-10">
          <span className="inline-block text-[11px] uppercase tracking-[0.18em] text-kraft font-medium mb-2">
            Légal
          </span>
          <h1 className="text-3xl md:text-4xl italic text-gray-900 leading-tight">
            Mentions légales
          </h1>
        </header>

        <div className="space-y-8 text-gray-700 text-sm leading-relaxed">
          <section>
            <h2 className="text-lg font-semibold text-black mb-2">Éditeur du site</h2>
            <p>RoxanetNous</p>
            <p>Forme juridique : auto-entrepreneur</p>
            <p>Site : roxanetnous.fr</p>
            <p>Numéro SIREN : 103949004</p>
            <p>Email : roxanetnous@outlook.com</p>
            <p>Responsable / Directrice de la publication : Roxane Le Dherve</p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-black mb-2">Conception et réalisation</h2>
            <p>Nysia</p>
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
    </div>
  )
}
