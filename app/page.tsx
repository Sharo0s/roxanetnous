import Link from 'next/link'
import Image from 'next/image'
import { Footer } from '@/components/footer'
import { ContactForm } from '@/components/contact-form'
import { HeroCarte } from '@/components/landing/hero-carte'
import { AnimatedCounter } from '@/components/landing/animated-counter'
import { Reveal } from '@/components/landing/reveal'
import { createClient } from '@/lib/supabase/server'

export const revalidate = 120

export default async function HomePage() {
  const supabase = await createClient({ serviceRole: true })

  const { count: accompagnantesCount } = await supabase
    .from('accompagnantes_profiles')
    .select('id', { count: 'exact', head: true })
    .eq('validation_status', 'valide')

  const { count: accompagnesCount } = await supabase
    .from('accompagnes_profiles')
    .select('id', { count: 'exact', head: true })

  const { data: villesData } = await supabase
    .from('accompagnantes_profiles')
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

  const launchOfferEnd = process.env.LAUNCH_OFFER_END
  const launchOfferActive = launchOfferEnd
    ? new Date(launchOfferEnd) > new Date()
    : false

  const jsonLd = {
    '@context': 'https://schema.org',
    '@type': 'WebApplication',
    name: 'roxanetnous',
    url: process.env.NEXT_PUBLIC_BASE_URL || 'https://roxanetnous.fr',
    description: 'Plateforme de mise en relation entre accompagnantes de vie vérifiées et accompagnés.',
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
        description: 'Abonnement annuel, économisez 17%',
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
                OFFRE DE LANCEMENT — 1 MOIS OFFERT POUR LES PREMIERS INSCRITS
              </span>
            ))}
          </div>
        </div>
      )}
      <main className="flex-1">
        {/* ===== HERO ===== */}
        <section className="px-4 py-16 md:py-24 kraft bg-kraft">
          <div className="max-w-7xl mx-auto relative z-10">
            <div className="flex flex-col md:flex-row items-center gap-10 md:gap-16">
              <div className="flex-1 text-center space-y-5">
                <h1 className="sr-only">roxanetnous</h1>
                <Image
                  src="/logo-transparent.png"
                  alt="roxanetnous"
                  width={480}
                  height={160}
                  priority
                  className="h-auto w-64 md:w-80 mx-auto"
                />

                <p className="text-2xl text-white leading-relaxed text-center font-heading italic">
                  Donne vie à ton quotidien
                </p>

                <div className="flex gap-4 justify-center pt-4">
                  <Link
                    href="/login"
                    className="px-6 py-3 rounded-lg font-semibold text-sm text-black btn-hover bg-accent"
                  >
                    Inscription / Connexion
                  </Link>
                </div>

                {((accompagnantesCount || 0) > 0 || (accompagnesCount || 0) > 0 || villesUniques.size > 0) && (
                  <div className="flex gap-8 justify-center pt-10">
                    {(accompagnantesCount || 0) > 0 && (
                      <AnimatedCounter end={accompagnantesCount || 0} label={`accompagnant(e)${(accompagnantesCount || 0) > 1 ? 's' : ''} vérifié(e)${(accompagnantesCount || 0) > 1 ? 's' : ''}`} />
                    )}
                    {(accompagnesCount || 0) > 0 && (
                      <AnimatedCounter end={accompagnesCount || 0} label={`accompagné(e)${(accompagnesCount || 0) > 1 ? 's' : ''}`} />
                    )}
                    {villesUniques.size > 0 && (
                      <AnimatedCounter end={villesUniques.size} label={`ville${villesUniques.size > 1 ? 's' : ''}`} />
                    )}
                  </div>
                )}
              </div>

              <div className="hidden md:block w-full md:basis-1/2 md:flex-[0.2]">
                <HeroCarte villes={villesCoords} />
              </div>
            </div>
          </div>
        </section>

        {/* ===== BANDE COMMUNAUTE ===== */}
        <section className="bg-accent relative">
          <svg viewBox="0 0 1440 60" preserveAspectRatio="none" className="absolute top-0 left-0 w-full h-8 md:h-12 -translate-y-full">
            <path d="M0,60 Q240,20 480,50 T960,50 T1440,50 L1440,60 L0,60 Z" fill="#F4C8A3" />
          </svg>
          <Reveal className="max-w-5xl mx-auto px-4 py-8 flex flex-col items-center gap-4 text-center md:flex-row md:justify-between md:text-left">
            <p className="text-lg font-medium text-black tracking-wide font-heading italic">
              Notre communauté de mise en relation entre accompagnants et accompagné(e)s
            </p>
            <Link href="/recherche" className="rounded-full px-7 py-3 font-semibold bg-black text-white btn-hover whitespace-nowrap text-lg shrink-0">
              Consulter les annonces
            </Link>
          </Reveal>
          <svg viewBox="0 0 1440 60" preserveAspectRatio="none" className="absolute bottom-0 left-0 w-full h-8 md:h-12 translate-y-full">
            <path d="M0,0 C360,40 720,-20 1080,20 T1440,0 L1440,60 L0,60 Z" fill="#F4C8A3" />
          </svg>
        </section>

        {/* ===== PRESENTATION ===== */}
        <section className="px-4 py-16 md:py-24 kraft bg-kraft relative">
          <div className="max-w-5xl mx-auto relative z-10">
            <div className="flex flex-col md:flex-row items-center gap-10 md:gap-16">
              <Reveal variant="blur" className="flex-1 w-full">
                <Image
                  src="/IMG-7294675.png"
                  alt="Roxane, aide médico-psychologique"
                  width={1200}
                  height={1600}
                  className="h-auto w-full rounded-lg"
                />
              </Reveal>
              <div className="flex-1 text-white space-y-4">
                <Reveal as="span" className="block">
                  <h2 className="text-3xl md:text-4xl font-bold text-black">Ici, c&apos;est un lieu</h2>
                </Reveal>
                <Reveal as="span" delay={80} className="block relative">
                  <svg
                    aria-hidden="true"
                    viewBox="0 0 24 24"
                    className="w-6 h-6 text-accent fill-current absolute -left-9 top-1"
                  >
                    <path d="M12 2l2.39 7.36H22l-6.19 4.5L18.2 21 12 16.5 5.8 21l2.39-7.14L2 9.36h7.61L12 2z" />
                  </svg>
                  <p className="text-lg leading-relaxed">
                    Roxanetnous a pour mission de créer une communauté, un endroit unique dédié à la recherche d&apos;accompagnement. Ensemble&nbsp;.
                    <svg
                      aria-hidden="true"
                      viewBox="0 0 24 24"
                      className="inline-block w-5 h-5 ml-1 -mt-1 text-accent fill-current align-middle"
                    >
                      <circle cx="12" cy="12" r="4" />
                      <g stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                        <line x1="12" y1="2" x2="12" y2="5" />
                        <line x1="12" y1="19" x2="12" y2="22" />
                        <line x1="2" y1="12" x2="5" y2="12" />
                        <line x1="19" y1="12" x2="22" y2="12" />
                        <line x1="4.22" y1="4.22" x2="6.34" y2="6.34" />
                        <line x1="17.66" y1="17.66" x2="19.78" y2="19.78" />
                        <line x1="4.22" y1="19.78" x2="6.34" y2="17.66" />
                        <line x1="17.66" y1="6.34" x2="19.78" y2="4.22" />
                      </g>
                    </svg>
                  </p>
                </Reveal>
                <Reveal as="span" delay={160} className="block">
                  <p className="text-lg leading-relaxed">
                    Je suis Roxane, aide médico-psychologique, j&apos;exerce mon métier avec passion depuis une dizaine d&apos;années.
                  </p>
                </Reveal>
                <Reveal as="span" delay={240} className="block">
                  <p className="text-lg leading-relaxed">
                    Aujourd&apos;hui, je fais un constat : celui de la difficulté en tant qu&apos;accompagné ou accompagnant à trouver son accompagnement.
                  </p>
                </Reveal>
                <Reveal as="span" delay={320} className="block">
                  <p className="text-lg leading-relaxed italic">
                    Où, quoi, qui, comment chercher ?
                  </p>
                </Reveal>
                <Reveal as="span" delay={400} className="block">
                  <p className="text-lg leading-relaxed font-semibold">
                    C&apos;est ici.
                  </p>
                </Reveal>
                <Reveal as="span" delay={480} className="block">
                  <p className="text-lg leading-relaxed">
                    Parlons de nous, pour nous faciliter l&apos;accès à demain.
                  </p>
                </Reveal>
              </div>
            </div>
          </div>
        </section>

        {/* ===== COMMENT CA MARCHE ===== */}
        <section className="px-4 pt-16 pb-24 md:pb-28 kraft bg-kraft relative">
          <div className="max-w-3xl mx-auto relative z-10">
            <h2 className="text-3xl font-bold text-center text-black mb-12">
              Comment ça marche RoxanetNous
            </h2>
            <div className="space-y-0">
              {[
                { step: '1', title: 'Inscription', desc: "Créez votre compte en tant qu'accompagnant(e) ou accompagné(e).." },
                { step: '2', title: 'Justificatifs', desc: "Accompagnant(e)s : déposez vos diplômes et pièce d'identité. Accompagné(e)s : décrivez votre besoin." },
                { step: '3', title: 'Validation', desc: 'Notre équipe vérifie manuellement chaque profil accompagnant(e). Sous 48h.' },
                { step: '4', title: 'Mise en relation', desc: 'Publiez votre annonce, nous vous recommandons les profils les plus compatibles. Premiers contacts en quelques jours.' },
              ].map((item, i) => (
                <Reveal key={item.step} delay={i * 120} className="flex gap-6 items-start">
                  <div className="flex flex-col items-center">
                    <div className="w-10 h-10 rounded-full flex items-center justify-center font-bold text-sm shrink-0 text-black bg-accent">
                      {item.step}
                    </div>
                    {i < 3 && <div className="w-px h-16 bg-accent/40" />}
                  </div>
                  <div className="pb-10">
                    <h3 className="font-bold text-xl text-black">{item.title}</h3>
                    <p className="text-base mt-1 text-white flex items-start gap-2">
                      <svg
                        aria-hidden="true"
                        viewBox="0 0 24 24"
                        className="w-4 h-4 shrink-0 mt-1 text-accent fill-current"
                      >
                        <path d="M12 2l2.39 7.36H22l-6.19 4.5L18.2 21 12 16.5 5.8 21l2.39-7.14L2 9.36h7.61L12 2z" />
                      </svg>
                      <span>{item.desc}</span>
                    </p>
                  </div>
                </Reveal>
              ))}
            </div>
          </div>
          <svg viewBox="0 0 1440 60" preserveAspectRatio="none" className="absolute bottom-0 left-0 w-full h-8 md:h-12 z-[2]">
            <path d="M0,30 Q360,60 720,30 T1440,30 L1440,60 L0,60 Z" fill="white" />
          </svg>
        </section>

        {/* ===== POUR QUI ===== */}
        <section className="px-4 py-16 bg-white">
          <div className="max-w-6xl mx-auto">
            <h2 className="text-3xl font-bold text-center text-black mb-10">
              Pour qui ?
            </h2>
            <div className="flex flex-col md:flex-row gap-8 items-start">
              <Reveal variant="blur" className="w-full md:w-2/5 shrink-0">
                <Image
                  src="/IMG-9432645.png"
                  alt="Pour qui ?"
                  width={1200}
                  height={1600}
                  className="h-auto w-full rounded-lg"
                />
              </Reveal>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-8 flex-1">
              <Reveal className="border-2 border-accent rounded-xl p-8">
                <h3 className="font-bold text-2xl text-black mb-6">Accompagnant(e)s</h3>
                <ul className="space-y-4 text-base text-black">
                  {['Profil vérifié qui inspire confiance', 'Visibilité directe auprès des accompagné(e)s', 'Profils recommandés selon vos compétences', 'Pas de commission. Vous fixez vos conditions.'].map((text) => (
                    <li key={text} className="flex gap-3">
                      <span className="shrink-0 w-5 h-5 rounded-full flex items-center justify-center bg-accent">
                        <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="black" strokeWidth={3}><path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" /></svg>
                      </span>
                      {text}
                    </li>
                  ))}
                </ul>
                <Link
                  href="/register?role=accompagnante"
                  className="block text-center mt-8 px-4 py-3 rounded-lg text-sm font-medium text-black btn-hover bg-accent"
                >
                  Créer mon profil accompagnant(e)
                </Link>
              </Reveal>
              <Reveal delay={100} className="border-2 border-accent rounded-xl p-8">
                <h3 className="font-bold text-2xl text-black mb-6">Accompagné(e)s et proches</h3>
                <ul className="space-y-4 text-base text-black">
                  {['Tous les profils vérifiés manuellement', 'Recherche par spécialité, localisation, expérience', 'Les profils que nous vous recommandons', 'Chaque auxiliaire rencontrée et validée'].map((text) => (
                    <li key={text} className="flex gap-3">
                      <span className="shrink-0 w-5 h-5 rounded-full flex items-center justify-center bg-accent">
                        <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="black" strokeWidth={3}><path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" /></svg>
                      </span>
                      {text}
                    </li>
                  ))}
                </ul>
                <Link
                  href="/register?role=accompagne"
                  className="block text-center mt-8 px-4 py-3 rounded-lg text-sm font-medium text-black btn-hover bg-accent"
                >
                  Trouver un(e) accompagnant(e)
                </Link>
              </Reveal>
              </div>
            </div>
          </div>
        </section>

        <svg viewBox="0 0 1440 60" preserveAspectRatio="none" className="w-full h-8 md:h-12 block -mb-px bg-white">
          <defs><pattern id="kraft-wave-3" patternUnits="userSpaceOnUse" width="256" height="256"><image href="/kraft-noise.png" width="256" height="256" /></pattern></defs>
          <path d="M0,30 Q240,0 480,30 T960,30 T1440,30 L1440,60 L0,60 Z" fill="#d3a387" />
          <path d="M0,30 Q240,0 480,30 T960,30 T1440,30 L1440,60 L0,60 Z" fill="url(#kraft-wave-3)" opacity="0.35" style={{ mixBlendMode: 'multiply' }} />
        </svg>

        {/* ===== OFFRES ===== */}
        <section className="px-4 pt-16 pb-24 md:pb-28 kraft bg-kraft relative">
          <div className="max-w-4xl mx-auto relative z-10">
            {launchOfferActive && (
              <div className="bg-accent text-black text-center py-3 px-6 rounded-xl mb-6 max-w-2xl mx-auto">
                <p className="text-xl font-bold">
                  Offre de lancement : 1 mois offert pour les premiers inscrits !
                </p>
              </div>
            )}
            <h2 className="text-3xl font-bold text-center text-black mb-2">Tarif unique, simple</h2>
            <p className="text-center text-base text-black mb-10">
              Même prix pour les accompagnant(e)s et les accompagné(e)s.            </p>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 max-w-2xl mx-auto">
              <Reveal className="border border-accent rounded-xl p-6 bg-white flex flex-col">
                <h3 className="font-bold text-xl text-black mb-1">Mensuel</h3>
                <p className="text-4xl font-bold mb-1">
                  <span className="text-accent">4,99 EUR</span><span className="text-base font-normal text-black"> / mois</span>
                </p>
                <p className="text-base text-black mb-4">Sans engagement, résiliable à tout moment.</p>
                <Link
                  href="/register"
                  className="block text-center px-4 py-2 rounded-lg text-sm font-medium text-black btn-hover mt-auto bg-accent"
                >
                  Commencer
                </Link>
              </Reveal>
              <Reveal delay={100} className="border-2 border-accent rounded-xl p-6 bg-white relative flex flex-col">
                <Reveal as="span" delay={400} variant="blur" className="absolute -top-3 left-1/2 -translate-x-1/2 text-xs px-3 py-1 rounded-full font-medium text-black bg-accent">
                  Recommandé
                </Reveal>
                <h3 className="font-bold text-xl text-black mb-1">Annuel</h3>
                <p className="text-4xl font-bold text-black mb-1 whitespace-nowrap">
                  <span className="text-2xl font-normal text-black line-through mr-2">59,88 EUR</span>
                  <span className="text-accent">49,99 EUR</span><span className="text-base font-normal text-black"> / an</span>
                </p>
                <p className="text-base text-black mb-4">Soit 4,17 EUR / mois. Économisez 17%.</p>
                <Link
                  href="/register"
                  className="block text-center px-4 py-2 rounded-lg text-sm font-medium text-black btn-hover mt-auto bg-accent"
                >
                  Commencer
                </Link>
              </Reveal>
            </div>
          </div>
          <svg viewBox="0 0 1440 60" preserveAspectRatio="none" className="absolute bottom-0 left-0 w-full h-8 md:h-12 z-[2]">
            <path d="M0,30 Q360,60 720,30 T1440,30 L1440,60 L0,60 Z" fill="white" />
          </svg>
        </section>

        {/* ===== FAQ ===== */}
        <section className="px-4 py-16 bg-white">
          <div className="max-w-6xl mx-auto">
            <h2 className="text-3xl font-bold text-center text-black mb-10">Questions fréquentes</h2>
            <div className="flex flex-col md:flex-row gap-8 items-start">
              <Reveal variant="blur" className="w-full md:w-2/5 shrink-0 md:sticky md:top-8">
                <Image
                  src="/IMG-6482896.png"
                  alt="Questions fréquentes"
                  width={1200}
                  height={1600}
                  className="h-auto w-full rounded-lg"
                />
              </Reveal>
              <div className="grid grid-cols-1 gap-4 items-start flex-1">
              {[
                { q: 'Comment fonctionne la vérification des profils ?', a: "Chaque accompagnant(e) doit déposer ses diplômes et sa pièce d'identité. Notre équipe vérifie manuellement ces documents avant d'activer le profil." },
                { q: "Combien coûte l'abonnement ?", a: "L'abonnement mensuel est à 4,99 EUR/mois sans engagement. L'abonnement annuel est à 49,99 EUR/an, soit une économie de 17%." },
                { q: 'Comment fonctionnent les recommandations de profils ?', a: 'Nous analysons 5 critères (spécialités, localisation, expérience, diplôme, disponibilités) pour vous recommander les profils les plus compatibles.' },
                { q: 'Puis-je utiliser la plateforme sans abonnement ?', a: "Vous pouvez consulter les annonces publiées sans abonnement. L'abonnement est requis pour publier des annonces et accéder aux profils que nous vous recommandons." },
                { q: 'Comment contacter un(e) accompagnant(e) ?', a: "Une fois inscrit en tant qu'accompagné(e), vous pouvez envoyer un message via la messagerie intégrée à partir de la fiche de l'accompagnant(e)." },
                { q: 'Comment supprimer mon compte ?', a: 'Vous pouvez supprimer votre compte depuis les paramètres de votre espace personnel. Toutes vos données seront supprimées conformément au RGPD.' },
              ].map((faq, i) => (
                <Reveal as="span" key={i} delay={i * 60} className="block">
                <details className="group rounded-xl bg-white p-5 border border-accent">
                  <summary className="cursor-pointer flex gap-4 items-start">
                    <div className="w-8 h-8 rounded-full flex items-center justify-center font-bold text-sm shrink-0 text-black bg-accent">
                      {i + 1}
                    </div>
                    <span className="font-semibold text-black pt-1 text-lg">{faq.q}</span>
                    <svg className="w-5 h-5 shrink-0 ml-auto mt-1.5 transition-transform group-open:rotate-45" fill="none" viewBox="0 0 24 24" stroke="#FFB06E" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
                    </svg>
                  </summary>
                  <p className="text-base text-black pt-3 pl-12">{faq.a}</p>
                </details>
                </Reveal>
              ))}
              </div>
            </div>
          </div>
        </section>

        <svg viewBox="0 0 1440 60" preserveAspectRatio="none" className="w-full h-8 md:h-12 block -mb-px bg-white">
          <defs><pattern id="kraft-wave-5" patternUnits="userSpaceOnUse" width="256" height="256"><image href="/kraft-noise.png" width="256" height="256" /></pattern></defs>
          <path d="M0,30 Q240,0 480,30 T960,30 T1440,30 L1440,60 L0,60 Z" fill="#d3a387" />
          <path d="M0,30 Q240,0 480,30 T960,30 T1440,30 L1440,60 L0,60 Z" fill="url(#kraft-wave-5)" opacity="0.35" style={{ mixBlendMode: 'multiply' }} />
        </svg>

        {/* ===== CONTACT ===== */}
        <section className="px-4 py-16 kraft bg-kraft">
          <Reveal className="max-w-md mx-auto relative z-10">
            <h2 className="text-3xl font-bold text-center text-white mb-2">Une question ?</h2>
            <p className="text-center text-white text-lg mb-6">
              Notre équipe est disponible pour répondre à toutes vos questions.
            </p>
            <ContactForm />
          </Reveal>
        </section>
      </main>
      <Footer />
    </div>
  )
}
