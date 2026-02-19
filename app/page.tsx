import Link from 'next/link'
import { Footer } from '@/components/footer'
import { ContactForm } from '@/components/contact-form'
import { AvisMarquee } from '@/components/landing/avis-marquee'
import { createClient } from '@/lib/supabase/server'

export default async function HomePage() {
  const supabase = await createClient({ serviceRole: true })

  // Compteurs dynamiques
  const { count: auxiliairesCount } = await supabase
    .from('auxiliaires_profiles')
    .select('id', { count: 'exact', head: true })
    .eq('validation_status', 'valide')

  const { data: villesData } = await supabase
    .from('auxiliaires_profiles')
    .select('ville')
    .eq('validation_status', 'valide')

  const villesUniques = new Set((villesData || []).map((v) => v.ville?.toLowerCase()).filter(Boolean))

  // Avis recents (notes 4-5, non signales, non masques)
  const { data: avisData } = await supabase
    .from('avis')
    .select('note, commentaire, auteur_id')
    .eq('masque', false)
    .eq('signale', false)
    .gte('note', 4)
    .order('created_at', { ascending: false })
    .limit(20)

  let avisWithNames: { note: number; commentaire: string; auteur_prenom: string; auteur_nom: string }[] = []
  if (avisData && avisData.length > 0) {
    const auteurIds = [...new Set(avisData.map((a) => a.auteur_id))]
    const { data: auteursData } = await supabase
      .from('users')
      .select('id, first_name, last_name')
      .in('id', auteurIds)

    const auteursMap = new Map((auteursData || []).map((u) => [u.id, u]))
    avisWithNames = avisData
      .filter((a) => a.commentaire)
      .map((a) => {
        const auteur = auteursMap.get(a.auteur_id)
        return {
          note: a.note,
          commentaire: a.commentaire!,
          auteur_prenom: auteur?.first_name || 'Utilisateur',
          auteur_nom: auteur?.last_name || '',
        }
      })
  }

  const launchOfferEnd = process.env.LAUNCH_OFFER_END
  const launchOfferActive = launchOfferEnd ? new Date(launchOfferEnd) > new Date() : false

  const jsonLd = {
    '@context': 'https://schema.org',
    '@type': 'WebApplication',
    name: 'roxanetnous',
    url: process.env.NEXT_PUBLIC_BASE_URL || 'https://roxanetnous.fr',
    description: 'Plateforme de mise en relation entre auxiliaires de vie verifies et beneficiaires.',
    applicationCategory: 'HealthApplication',
    operatingSystem: 'Web',
    offers: [
      {
        '@type': 'Offer',
        name: 'Abonnement mensuel',
        price: '4.99',
        priceCurrency: 'EUR',
        description: 'Abonnement mensuel sans engagement',
      },
      {
        '@type': 'Offer',
        name: 'Abonnement annuel',
        price: '49.99',
        priceCurrency: 'EUR',
        description: 'Abonnement annuel, economisez 17%',
      },
    ],
  }

  return (
    <div className="min-h-screen flex flex-col">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />
      <main className="flex-1">
        {/* Hero */}
        <section className="flex flex-col items-center justify-center px-4 py-20 md:py-28">
          <div className="max-w-4xl text-center space-y-6">
            <h1 className="text-5xl font-bold text-black">
              roxanetnous
            </h1>
            <p className="text-2xl text-gray-600">
              Plateforme de mise en relation entre auxiliaires de vie et beneficiaires
            </p>

            <div className="flex gap-6 justify-center pt-4 text-sm text-gray-500">
              {(auxiliairesCount || 0) > 0 && (
                <span className="font-medium text-black">{auxiliairesCount} auxiliaire{(auxiliairesCount || 0) > 1 ? 's' : ''} verifie{(auxiliairesCount || 0) > 1 ? 's' : ''}</span>
              )}
              {villesUniques.size > 0 && (
                <span className="font-medium text-black">{villesUniques.size} ville{villesUniques.size > 1 ? 's' : ''} couverte{villesUniques.size > 1 ? 's' : ''}</span>
              )}
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 max-w-lg mx-auto pt-8">
              <Link
                href="/register?role=beneficiaire"
                className="p-5 border-2 border-black rounded-xl text-left hover:bg-gray-50 transition"
              >
                <p className="font-semibold text-black">Je recherche un auxiliaire</p>
                <p className="text-sm text-gray-500 mt-1">Pour moi ou un proche</p>
              </Link>
              <Link
                href="/register?role=auxiliaire"
                className="p-5 border-2 border-black rounded-xl text-left hover:bg-gray-50 transition"
              >
                <p className="font-semibold text-black">Je suis auxiliaire de vie</p>
                <p className="text-sm text-gray-500 mt-1">Je propose mes services</p>
              </Link>
            </div>

            <div className="flex gap-4 justify-center pt-4">
              <Link
                href="/recherche"
                className="text-sm text-gray-500 hover:text-black transition underline"
              >
                Consulter les annonces
              </Link>
              <Link
                href="/login"
                className="text-sm text-gray-500 hover:text-black transition underline"
              >
                Se connecter
              </Link>
            </div>
          </div>
        </section>

        {/* Avis */}
        {avisWithNames.length > 0 && (
          <section className="bg-gray-50 px-4 py-16">
            <div className="max-w-4xl mx-auto mb-8">
              <h2 className="text-2xl font-bold text-center mb-2">Ce qu'en disent nos utilisateurs</h2>
              <p className="text-center text-sm text-gray-500">Avis verifies laisses sur la plateforme</p>
            </div>
            <AvisMarquee avis={avisWithNames} />
          </section>
        )}

        {/* Comment ca marche */}
        <section className="px-4 py-16">
          <div className="max-w-4xl mx-auto">
            <h2 className="text-2xl font-bold text-center mb-10">Comment ca marche</h2>
            <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
              {[
                { step: '1', title: 'Inscription', desc: 'Creez votre compte en tant qu\'auxiliaire de vie ou beneficiaire.' },
                { step: '2', title: 'Justificatifs', desc: 'Auxiliaires : deposez vos diplomes et piece d\'identite.' },
                { step: '3', title: 'Validation', desc: 'Notre equipe verifie manuellement chaque profil.' },
                { step: '4', title: 'Profil actif', desc: 'Publiez votre annonce et trouvez les meilleurs profils.' },
              ].map((item) => (
                <div key={item.step} className="text-center">
                  <div className="w-10 h-10 rounded-full bg-black text-white flex items-center justify-center mx-auto mb-3 font-bold">
                    {item.step}
                  </div>
                  <h3 className="font-semibold mb-1">{item.title}</h3>
                  <p className="text-sm text-gray-600">{item.desc}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* Avantages */}
        <section className="bg-gray-50 px-4 py-16">
          <div className="max-w-4xl mx-auto">
            <h2 className="text-2xl font-bold text-center mb-10">Pourquoi roxanetnous</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
              <div className="border rounded-xl p-6">
                <h3 className="font-bold text-lg mb-4">Pour les auxiliaires de vie</h3>
                <ul className="space-y-3 text-sm text-gray-700">
                  <li>Profil verifie qui inspire confiance</li>
                  <li>Visibilite aupres de beneficiaires qualifies</li>
                  <li>Matching intelligent base sur vos competences</li>
                  <li>Messagerie integree pour echanger en toute securite</li>
                  <li>Avis et badges pour valoriser votre experience</li>
                </ul>
              </div>
              <div className="border rounded-xl p-6">
                <h3 className="font-bold text-lg mb-4">Pour les beneficiaires</h3>
                <ul className="space-y-3 text-sm text-gray-700">
                  <li>Auxiliaires verifies manuellement (diplomes, identite)</li>
                  <li>Recherche par specialite, localisation et experience</li>
                  <li>Algorithme de matching sur 100 points</li>
                  <li>Notifications quand un profil correspond</li>
                  <li>Avis des autres beneficiaires pour vous guider</li>
                </ul>
              </div>
            </div>
          </div>
        </section>

        {/* Offres d'abonnement */}
        <section className="px-4 py-16">
          <div className="max-w-4xl mx-auto">
            <h2 className="text-2xl font-bold text-center mb-3">Nos offres</h2>
            <p className="text-center text-gray-500 text-sm mb-10">
              Un abonnement est requis pour publier des annonces et acceder au matching.
            </p>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 max-w-2xl mx-auto">
              <div className="border rounded-xl p-6 bg-white">
                <h3 className="font-bold text-lg mb-1">Mensuel</h3>
                <p className="text-3xl font-bold mb-1">4,99 EUR<span className="text-sm font-normal text-gray-500"> / mois</span></p>
                <p className="text-sm text-gray-500 mb-4">Sans engagement, resiliable a tout moment.</p>
                <Link
                  href="/register"
                  className="block text-center px-4 py-2 border-2 border-black rounded-lg text-sm font-medium hover:bg-gray-100 transition"
                >
                  Commencer
                </Link>
              </div>
              <div className="border-2 border-black rounded-xl p-6 bg-white relative">
                <div className="absolute -top-3 left-1/2 -translate-x-1/2 bg-black text-white text-xs px-3 py-1 rounded-full font-medium">
                  Recommande
                </div>
                <h3 className="font-bold text-lg mb-1">Annuel</h3>
                <p className="text-3xl font-bold mb-1">49,99 EUR<span className="text-sm font-normal text-gray-500"> / an</span></p>
                <p className="text-sm text-gray-500 mb-4">Soit 4,17 EUR / mois. Economisez 17%.</p>
                <Link
                  href="/register"
                  className="block text-center px-4 py-2 bg-black text-white rounded-lg text-sm font-medium hover:bg-gray-800 transition"
                >
                  Commencer
                </Link>
              </div>
            </div>
            {launchOfferActive && (
              <p className="text-center text-sm text-gray-500 mt-6">
                Offre de lancement : 5 mois offerts pour les premiers inscrits.
              </p>
            )}
          </div>
        </section>

        {/* FAQ */}
        <section className="bg-gray-50 px-4 py-16">
          <div className="max-w-3xl mx-auto">
            <h2 className="text-2xl font-bold text-center mb-10">Questions frequentes</h2>
            <div className="space-y-6">
              {[
                {
                  q: 'Comment fonctionne la verification des profils ?',
                  a: 'Chaque auxiliaire de vie doit deposer ses diplomes et sa piece d\'identite. Notre equipe verifie manuellement ces documents avant d\'activer le profil.',
                },
                {
                  q: 'Combien coute l\'abonnement ?',
                  a: 'L\'abonnement mensuel est a 4,99 EUR/mois sans engagement. L\'abonnement annuel est a 49,99 EUR/an, soit une economie de 17%.',
                },
                {
                  q: 'Comment fonctionne le matching intelligent ?',
                  a: 'Notre algorithme analyse 5 criteres (specialites, localisation, experience, diplome, disponibilites) pour attribuer un score de compatibilite sur 100 points.',
                },
                {
                  q: 'Puis-je utiliser la plateforme sans abonnement ?',
                  a: 'Vous pouvez consulter les annonces publiees sans abonnement. L\'abonnement est requis pour publier des annonces et acceder au matching intelligent.',
                },
                {
                  q: 'Comment contacter un auxiliaire de vie ?',
                  a: 'Une fois inscrit en tant que beneficiaire, vous pouvez envoyer un message via la messagerie integree a partir de la fiche de l\'auxiliaire.',
                },
                {
                  q: 'Comment supprimer mon compte ?',
                  a: 'Vous pouvez supprimer votre compte depuis les parametres de votre espace personnel. Toutes vos donnees seront supprimees conformement au RGPD.',
                },
              ].map((faq, i) => (
                <div key={i} className="border-b pb-4">
                  <h3 className="font-semibold mb-2">{faq.q}</h3>
                  <p className="text-sm text-gray-600">{faq.a}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* Contact */}
        <section className="px-4 py-16">
          <div className="max-w-md mx-auto">
            <h2 className="text-2xl font-bold text-center mb-2">Une question ?</h2>
            <p className="text-center text-gray-600 mb-6">
              Notre equipe est disponible pour repondre a toutes vos questions.
            </p>
            <ContactForm />
          </div>
        </section>
      </main>
      <Footer />
    </div>
  )
}
