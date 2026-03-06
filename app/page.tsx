import Link from 'next/link'
import { Footer } from '@/components/footer'
import { ContactForm } from '@/components/contact-form'
import { AvisMarquee } from '@/components/landing/avis-marquee'
import { HeroCarte } from '@/components/landing/hero-carte'
import { createClient } from '@/lib/supabase/server'

export default async function HomePage() {
  const supabase = await createClient({ serviceRole: true })

  const { count: auxiliairesCount } = await supabase
    .from('auxiliaires_profiles')
    .select('id', { count: 'exact', head: true })
    .eq('validation_status', 'valide')

  const { data: villesData } = await supabase
    .from('auxiliaires_profiles')
    .select('ville, latitude, longitude')
    .eq('validation_status', 'valide')

  // Dédupliquer par ville et garder les coordonnées
  const villesMap = new Map<string, { ville: string; lat: number; lon: number }>()
  for (const v of villesData || []) {
    const key = v.ville?.toLowerCase()
    if (key && v.latitude && v.longitude && !villesMap.has(key)) {
      villesMap.set(key, { ville: v.ville!, lat: v.latitude, lon: v.longitude })
    }
  }
  const villesUniques = villesMap
  const villesCoords = Array.from(villesMap.values())

  const { data: avisData } = await supabase
    .from('avis')
    .select('note, commentaire, auteur_id')
    .eq('masque', false)
    .eq('signale', false)
    .gte('note', 4)
    .order('created_at', { ascending: false })
    .limit(20)

  let avisWithNames: {
    note: number
    commentaire: string
    auteur_prenom: string
    auteur_nom: string
  }[] = []
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
  const launchOfferActive = launchOfferEnd
    ? new Date(launchOfferEnd) > new Date()
    : false

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
      {/* ===== BANDEAU OFFRE ===== */}
      {launchOfferActive && (
        <div className="overflow-hidden bg-black">
          <div className="animate-marquee whitespace-nowrap py-3 text-base font-bold text-accent">
            {Array.from({ length: 6 }).map((_, i) => (
              <span key={i} className="mx-12">
                OFFRE DE LANCEMENT — 5 MOIS OFFERTS POUR LES PREMIERS INSCRITS
              </span>
            ))}
          </div>
        </div>
      )}
      <main className="flex-1">
        {/* ===== HERO ===== */}
        <section className="px-4 py-16 md:py-24 kraft bg-kraft">
          <div className="max-w-5xl mx-auto relative z-10">
            <div className="flex flex-col md:flex-row items-center gap-10 md:gap-16">
              <div className="flex-1 text-center md:text-left space-y-5">
                <h1 className="text-5xl md:text-6xl font-bold text-black tracking-tight">
                  roxanetnous
                </h1>
                <p className="text-xl text-black leading-relaxed">
                  Donne vie a ton quotidien
                </p>

                <div className="flex gap-4 justify-center md:justify-start pt-4">
                  <Link
                    href="/login"
                    className="px-6 py-3 rounded-lg font-semibold text-sm text-black btn-hover bg-accent"
                  >
                    Connectez-vous a votre espace
                  </Link>
                </div>
              </div>

              <div className="hidden md:block flex-1 w-full max-w-sm md:max-w-md">
                <HeroCarte villes={villesCoords} />
              </div>
            </div>
          </div>
        </section>

        {/* ===== BANDE COMMUNAUTE ===== */}
        <section className="bg-accent">
          <div className="max-w-5xl mx-auto px-4 py-8 flex flex-col items-center gap-4 text-center md:flex-row md:justify-between md:text-left">
            <p className="text-base font-medium text-black tracking-wide">
              Premiere communaute de mise en relation entre accompagnants et accompagne(e)s
            </p>
            <div className="flex flex-col md:flex-row gap-3 items-center text-sm shrink-0">
              <Link href="/recherche" className="rounded-full px-4 py-1.5 font-medium bg-black text-white btn-hover whitespace-nowrap">
                Consulter les annonces
              </Link>
              <div className="flex gap-3 flex-wrap justify-center">
                {(auxiliairesCount || 0) > 0 && (
                  <span className="rounded-full px-4 py-1.5 font-medium text-black whitespace-nowrap overflow-hidden relative bg-kraft">
                    <span className="absolute inset-0 opacity-35 mix-blend-multiply pointer-events-none" style={{ backgroundImage: "url('/kraft-noise.png')", backgroundSize: '256px 256px', backgroundRepeat: 'repeat' }} />
                    <span className="relative">Deja {auxiliairesCount} accompagnant(e){(auxiliairesCount || 0) > 1 ? 's' : ''} verifie(e){(auxiliairesCount || 0) > 1 ? 's' : ''}</span>
                  </span>
                )}
                {villesUniques.size > 0 && (
                  <span className="rounded-full px-4 py-1.5 font-medium text-black whitespace-nowrap overflow-hidden relative bg-kraft">
                    <span className="absolute inset-0 opacity-35 mix-blend-multiply pointer-events-none" style={{ backgroundImage: "url('/kraft-noise.png')", backgroundSize: '256px 256px', backgroundRepeat: 'repeat' }} />
                    <span className="relative">Deja {villesUniques.size} ville{villesUniques.size > 1 ? 's' : ''}</span>
                  </span>
                )}
              </div>
            </div>
          </div>
        </section>

        {/* ===== COMMENT CA MARCHE ===== */}
        <section className="px-4 py-16 kraft bg-kraft">
          <div className="max-w-3xl mx-auto relative z-10">
            <h2 className="text-2xl font-bold text-center text-black mb-12">
              Comment ca marche RoxanetNous
            </h2>
            <div className="space-y-0">
              {[
                { step: '1', title: 'Inscription', desc: "Creez votre compte en tant qu'accompagnant(e) ou accompagne(e).." },
                { step: '2', title: 'Justificatifs', desc: "Accompagnant(e)s : deposez vos diplomes et piece d'identite. Accompagne(e)s : decrivez votre besoin." },
                { step: '3', title: 'Validation', desc: 'Notre equipe verifie manuellement chaque profil accompagnant(e). Sous 48h.' },
                { step: '4', title: 'Mise en relation', desc: 'Publiez votre annonce, nous vous recommandons les profils les plus compatibles. Premiers contacts en quelques jours.' },
              ].map((item, i) => (
                <div key={item.step} className="flex gap-6 items-start">
                  <div className="flex flex-col items-center">
                    <div className="w-10 h-10 rounded-full flex items-center justify-center font-bold text-sm shrink-0 text-black bg-accent">
                      {item.step}
                    </div>
                    {i < 3 && <div className="w-px h-16 bg-accent/40" />}
                  </div>
                  <div className="pb-10">
                    <h3 className="font-bold text-lg text-black">{item.title}</h3>
                    <p className="text-sm mt-1 text-black">{item.desc}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* ===== AVIS ===== */}
        {avisWithNames.length > 0 && (
          <section className="px-4 py-16 bg-white">
            <div className="max-w-4xl mx-auto mb-8">
              <h2 className="text-2xl font-bold text-center text-black mb-2">
                Ce qu'en disent nos utilisateurs
              </h2>
              <p className="text-center text-sm text-black">
                Avis verifies laisses sur la plateforme
              </p>
            </div>
            <AvisMarquee avis={avisWithNames} />
          </section>
        )}

        {/* ===== POUR QUI ===== */}
        <section className="px-4 py-16 bg-white">
          <div className="max-w-4xl mx-auto">
            <h2 className="text-2xl font-bold text-center text-black mb-10">
              Pour qui ?
            </h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
              <div className="border-2 border-accent rounded-xl p-8">
                <h3 className="font-bold text-xl text-black mb-6">Accompagnant(e)s</h3>
                <ul className="space-y-4 text-sm text-black">
                  {['Profil verifie qui inspire confiance', 'Visibilite directe aupres des accompagne(e)s', 'Profils recommandes selon vos competences', 'Pas de commission. Vous fixez vos conditions.'].map((text) => (
                    <li key={text} className="flex gap-3">
                      <span className="shrink-0 w-5 h-5 rounded-full flex items-center justify-center bg-accent">
                        <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="black" strokeWidth={3}><path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" /></svg>
                      </span>
                      {text}
                    </li>
                  ))}
                </ul>
                <Link
                  href="/register?role=auxiliaire"
                  className="block text-center mt-8 px-4 py-3 rounded-lg text-sm font-medium text-black btn-hover bg-accent"
                >
                  Creer mon profil accompagnant(e)
                </Link>
              </div>
              <div className="border-2 border-accent rounded-xl p-8">
                <h3 className="font-bold text-xl text-black mb-6">Accompagne(e)s et proches</h3>
                <ul className="space-y-4 text-sm text-black">
                  {['Tous les profils verifies manuellement', 'Recherche par specialite, localisation, experience', 'Les profils que nous vous recommandons', 'Avis verifies pour vous guider'].map((text) => (
                    <li key={text} className="flex gap-3">
                      <span className="shrink-0 w-5 h-5 rounded-full flex items-center justify-center bg-accent">
                        <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="black" strokeWidth={3}><path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" /></svg>
                      </span>
                      {text}
                    </li>
                  ))}
                </ul>
                <Link
                  href="/register?role=beneficiaire"
                  className="block text-center mt-8 px-4 py-3 rounded-lg text-sm font-medium text-black btn-hover bg-accent"
                >
                  Trouver un(e) accompagnant(e)
                </Link>
              </div>
            </div>
          </div>
        </section>

        {/* ===== OFFRES ===== */}
        <section className="px-4 py-16 kraft bg-kraft">
          <div className="max-w-4xl mx-auto relative z-10">
            <h2 className="text-2xl font-bold text-center text-black mb-2">Tarif unique, simple</h2>
            <p className="text-center text-sm text-black mb-10">
              Meme prix pour les accompagnant(e)s et les accompagne(e)s.            </p>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 max-w-2xl mx-auto">
              <div className="border border-accent rounded-xl p-6 bg-white flex flex-col">
                <h3 className="font-bold text-lg text-black mb-1">Mensuel</h3>
                <p className="text-3xl font-bold mb-1">
                  <span className="text-accent">4,99 EUR</span><span className="text-sm font-normal text-black"> / mois</span>
                </p>
                <p className="text-sm text-black mb-4">Sans engagement, resiliable a tout moment.</p>
                <Link
                  href="/register"
                  className="block text-center px-4 py-2 rounded-lg text-sm font-medium text-black btn-hover mt-auto bg-accent"
                >
                  Commencer
                </Link>
              </div>
              <div className="border-2 border-accent rounded-xl p-6 bg-white relative flex flex-col">
                <div className="absolute -top-3 left-1/2 -translate-x-1/2 text-xs px-3 py-1 rounded-full font-medium text-black bg-accent">
                  Recommande
                </div>
                <h3 className="font-bold text-lg text-black mb-1">Annuel</h3>
                <p className="text-3xl font-bold text-black mb-1 whitespace-nowrap">
                  <span className="text-xl font-normal text-black line-through mr-2">59,88 EUR</span>
                  <span className="text-accent">49,99 EUR</span><span className="text-sm font-normal text-black"> / an</span>
                </p>
                <p className="text-sm text-black mb-4">Soit 4,17 EUR / mois. Economisez 17%.</p>
                <Link
                  href="/register"
                  className="block text-center px-4 py-2 rounded-lg text-sm font-medium text-black btn-hover mt-auto bg-accent"
                >
                  Commencer
                </Link>
              </div>
            </div>
            {launchOfferActive && (
              <p className="text-center text-sm text-black mt-6">
                Offre de lancement : 5 mois offerts pour les premiers inscrits.
              </p>
            )}
          </div>
        </section>

        {/* ===== FAQ ===== */}
        <section className="px-4 py-16 bg-white">
          <div className="max-w-5xl mx-auto">
            <h2 className="text-2xl font-bold text-center text-black mb-10">Questions frequentes</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 items-start">
              {[
                { q: 'Comment fonctionne la verification des profils ?', a: "Chaque accompagnant(e) doit deposer ses diplomes et sa piece d'identite. Notre equipe verifie manuellement ces documents avant d'activer le profil." },
                { q: "Combien coute l'abonnement ?", a: "L'abonnement mensuel est a 4,99 EUR/mois sans engagement. L'abonnement annuel est a 49,99 EUR/an, soit une economie de 17%." },
                { q: 'Comment fonctionnent les recommandations de profils ?', a: 'Nous analysons 5 criteres (specialites, localisation, experience, diplome, disponibilites) pour vous recommander les profils les plus compatibles.' },
                { q: 'Puis-je utiliser la plateforme sans abonnement ?', a: "Vous pouvez consulter les annonces publiees sans abonnement. L'abonnement est requis pour publier des annonces et acceder aux profils que nous vous recommandons." },
                { q: 'Comment contacter un(e) accompagnant(e) ?', a: "Une fois inscrit en tant qu'accompagne(e), vous pouvez envoyer un message via la messagerie integree a partir de la fiche de l'accompagnant(e)." },
                { q: 'Comment supprimer mon compte ?', a: 'Vous pouvez supprimer votre compte depuis les parametres de votre espace personnel. Toutes vos donnees seront supprimees conformement au RGPD.' },
              ].map((faq, i) => (
                <details key={i} className="group rounded-xl bg-white p-5 border border-accent">
                  <summary className="cursor-pointer flex gap-4 items-start">
                    <div className="w-8 h-8 rounded-full flex items-center justify-center font-bold text-sm shrink-0 text-black bg-accent">
                      {i + 1}
                    </div>
                    <span className="font-semibold text-black pt-1">{faq.q}</span>
                    <svg className="w-5 h-5 shrink-0 ml-auto mt-1.5 transition-transform group-open:rotate-45" fill="none" viewBox="0 0 24 24" stroke="#FFB06E" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
                    </svg>
                  </summary>
                  <p className="text-sm text-black pt-3 pl-12">{faq.a}</p>
                </details>
              ))}
            </div>
          </div>
        </section>

        {/* ===== CONTACT ===== */}
        <section className="px-4 py-16 kraft bg-kraft">
          <div className="max-w-md mx-auto relative z-10">
            <h2 className="text-2xl font-bold text-center text-black mb-2">Une question ?</h2>
            <p className="text-center text-black mb-6">
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
