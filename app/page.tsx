import Link from 'next/link'
import Image from 'next/image'
import { Footer } from '@/components/footer'
import { ContactForm } from '@/components/contact-form'
import { HeroCarte } from '@/components/landing/hero-carte'
import { AnimatedCounter } from '@/components/landing/animated-counter'
import { Reveal } from '@/components/landing/reveal'
import { DepartementsOuverts } from '@/components/landing/departements-ouverts'
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
    description: 'Plateforme de mise en relation entre accompagnants de vie vérifiées et accompagnés.',
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
    <div className="min-h-screen flex flex-col bg-[#fefaf8]">
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

      {/* ===== HEADER ===== */}
      <header className="bg-[#faf7f2] border-b border-[#e8dfd2] sticky top-0 z-50">
        <div className="max-w-6xl mx-auto px-4 md:px-6 py-3 flex items-center justify-between">
          <Link href="/" className="inline-flex items-center gap-2 text-base font-bold text-black">
            <Image
              src="/logo-transparent.png"
              alt=""
              width={100}
              height={100}
              priority
              className="w-[100px] h-[100px] object-contain"
            />
            <span>roxanetnous</span>
          </Link>
          <nav aria-label="Navigation principale" className="hidden md:flex items-center gap-6 text-sm">
            <Link href="#comment" className="text-gray-600 hover:text-gray-900">Comment ça marche</Link>
            <Link href="#tarifs" className="text-gray-600 hover:text-gray-900">Tarifs</Link>
            <Link href="#faq" className="text-gray-600 hover:text-gray-900">FAQ</Link>
            <Link
              href="/login"
              className="inline-flex items-center px-4 py-2 rounded-full border border-[#e8dfd2] text-gray-900 hover:border-kraft transition text-sm font-medium"
            >
              Connexion
            </Link>
          </nav>
          <Link
            href="/login"
            className="md:hidden inline-flex items-center px-3 py-1.5 rounded-full border border-[#e8dfd2] text-gray-900 hover:border-kraft transition text-xs font-medium"
          >
            Connexion
          </Link>
        </div>
      </header>

      <main id="main-content" tabIndex={-1} className="flex-1 focus:outline-none">

        {/* ===== HERO ===== */}
        <section className="relative overflow-hidden bg-[#fefaf8] px-4 py-12 md:py-20">
          <span
            aria-hidden="true"
            className="pointer-events-none absolute -top-24 -right-32 w-[600px] h-[600px]"
            style={{ background: 'radial-gradient(circle, #faecd9 0%, transparent 65%)' }}
          />
          <div className="relative max-w-6xl mx-auto grid md:grid-cols-[1.1fr_1fr] gap-12 md:gap-16 items-center">
            <div>
              <span className="inline-block -translate-y-6 text-[11px] uppercase tracking-[0.2em] text-kraft font-medium mb-3">
                L&apos;accompagnement de vie
              </span>
              <h1 className="text-4xl md:text-5xl lg:text-6xl text-gray-900 italic leading-[1.05] tracking-tight mb-5">
                L&apos;accompagnement, entre nous.
              </h1>
              <p className="text-base md:text-lg text-gray-600 leading-relaxed max-w-lg mb-7">
                Une communauté de mise en relation entre accompagnants vérifiés et personnes accompagnées. Sans intermédiaire, sans commission.
              </p>
              <div className="flex flex-wrap gap-3 mb-9">
                <Link
                  href="/register"
                  className="inline-flex items-center px-5 py-2.5 rounded-full bg-accent border border-accent text-black hover:bg-kraft hover:border-kraft hover:text-white transition text-sm font-medium"
                >
                  Créer mon profil
                </Link>
                <Link
                  href="/recherche"
                  className="inline-flex items-center px-5 py-2.5 rounded-full bg-white border border-[#e8dfd2] text-gray-900 hover:border-kraft transition text-sm font-medium"
                >
                  Consulter les annonces
                </Link>
              </div>
              {((accompagnantesCount || 0) > 0 || (accompagnesCount || 0) > 0 || villesUniques.size > 0) && (
                <div className="flex flex-wrap gap-8">
                  {(accompagnantesCount || 0) > 0 && (
                    <AnimatedCounter end={accompagnantesCount || 0} label={`accompagnant${(accompagnantesCount || 0) > 1 ? 's' : ''}`} />
                  )}
                  {(accompagnesCount || 0) > 0 && (
                    <AnimatedCounter end={accompagnesCount || 0} label={`accompagné${(accompagnesCount || 0) > 1 ? 's' : ''}`} />
                  )}
                  {villesUniques.size > 0 && (
                    <AnimatedCounter end={villesUniques.size} label={`ville${villesUniques.size > 1 ? 's' : ''}`} />
                  )}
                </div>
              )}
            </div>

            <div className="hidden md:block w-full">
              <HeroCarte villes={villesCoords} />
            </div>
          </div>
        </section>

        {/* ===== STRIP DEPARTEMENTS OUVERTS ===== */}
        <DepartementsOuverts />

        {/* ===== STORY ROXANE ===== */}
        <section className="px-4 py-16 md:py-20 bg-[#faf7f2]">
          <div className="max-w-4xl mx-auto">
            <Reveal>
              <div className="relative overflow-hidden bg-white rounded-2xl border border-[#e8dfd2] p-7 md:p-10">
                <span
                  aria-hidden="true"
                  className="pointer-events-none absolute top-0 right-0 w-[280px] h-[280px]"
                  style={{ background: 'radial-gradient(circle at top right, #faecd9 0%, transparent 70%)' }}
                />
                <div className="relative grid md:grid-cols-[280px_1fr] gap-8 md:gap-10 items-start">
                  <div className="w-full aspect-[4/5] rounded-2xl overflow-hidden shadow-[0_18px_40px_-18px_rgba(0,0,0,0.25)] mx-auto md:mx-0">
                    <Image
                      src="/roxane-portrait.jpg"
                      alt="Roxane, aide médico-psychologique"
                      width={2048}
                      height={1365}
                      className="w-full h-full object-cover"
                    />
                  </div>
                  <div>
                    <span className="inline-block text-[11px] uppercase tracking-[0.2em] text-kraft font-medium mb-3">
                      Notre histoire
                    </span>
                    <h2 className="text-3xl md:text-4xl text-gray-900 italic leading-tight mb-4">
                      Ici, c&apos;est un lieu.
                    </h2>
                    <p className="text-gray-600 leading-relaxed mb-3">
                      Roxanetnous a pour mission de créer une communauté, un endroit unique dédié à la recherche d&apos;accompagnement entre particuliers. Ensemble.
                    </p>
                    <p className="text-gray-600 leading-relaxed mb-3">
                      Je suis Roxane, aide médico-psychologique, j&apos;exerce mon métier avec passion depuis une dizaine d&apos;années.
                    </p>
                    <p className="text-gray-600 leading-relaxed mb-3">
                      Aujourd&apos;hui, je fais un constat : la difficulté, en tant qu&apos;accompagné ou accompagnant, à trouver son accompagnement. Où, quoi, qui, comment chercher ?{' '}
                      <strong className="font-medium text-gray-900">C&apos;est ici.</strong>
                    </p>
                    <p className="italic text-kraft mt-5">Roxane</p>
                  </div>
                </div>
              </div>
            </Reveal>
          </div>
        </section>

        {/* ===== POUR QUI ===== */}
        <section className="px-4 py-16 md:py-20 bg-[#fefaf8]">
          <div className="max-w-6xl mx-auto">
            <Reveal>
              <div className="text-center mb-10">
                <span className="inline-block text-[11px] uppercase tracking-[0.2em] text-kraft font-medium mb-3">
                  Pour vous
                </span>
                <h2 className="text-3xl md:text-4xl text-gray-900 italic leading-tight mb-3">
                  Pour qui
                </h2>
                <p className="text-gray-600 max-w-md mx-auto">
                  Deux espaces dédiés, une seule communauté.
                </p>
              </div>
            </Reveal>

            <div className="grid md:grid-cols-[1.5fr_1fr] gap-4 md:gap-4">
              <Reveal>
                <Link
                  href="/register?role=accompagnante"
                  className="group bg-white rounded-2xl border border-accent overflow-hidden flex flex-col h-full hover:border-kraft transition"
                >
                  <div className="aspect-[7/5]">
                    <Image
                      src="/pour-qui.svg"
                      alt=""
                      width={1080}
                      height={776}
                      className="w-full h-full object-cover object-[center_35%]"
                    />
                  </div>
                  <div className="p-7 md:p-8 bg-gradient-to-b from-white to-[#faecd9] rounded-b-2xl">
                    <span className="inline-block text-[11px] uppercase tracking-[0.18em] text-kraft font-medium mb-2">
                      Côté accompagnants
                    </span>
                    <h3 className="text-2xl md:text-3xl text-gray-900 italic mb-4 leading-tight">
                      Faites-vous connaître, gardez la main.
                    </h3>
                    <ul className="space-y-1.5 text-gray-700 mb-4">
                      {[
                        'Profil vérifié qui inspire confiance',
                        'Visibilité directe auprès des accompagnés',
                        'Profils recommandés selon vos compétences',
                        'Pas de commission. Vous fixez vos conditions.',
                      ].map((t) => (
                        <li key={t} className="flex gap-2 text-sm">
                          <span className="text-kraft font-bold" aria-hidden="true">·</span>
                          <span>{t}</span>
                        </li>
                      ))}
                    </ul>
                    <span className="inline-flex items-center gap-1 text-sm text-kraft font-medium">
                      Créer mon profil <span aria-hidden="true">→</span>
                    </span>
                  </div>
                </Link>
              </Reveal>

              <div className="grid gap-4">
                <Reveal delay={80}>
                  <Link
                    href="/register?role=accompagne"
                    className="block bg-white rounded-2xl border border-[#e8dfd2] p-7 hover:border-kraft transition h-full"
                  >
                    <span className="inline-block text-[11px] uppercase tracking-[0.18em] text-kraft font-medium mb-2">
                      Accompagnés
                    </span>
                    <h3 className="text-xl text-gray-900 italic mb-2">Trouver son accompagnant</h3>
                    <p className="text-sm text-gray-600 leading-relaxed mb-3">
                      Profils vérifiés manuellement, recherche fine et recommandations adaptées.
                    </p>
                    <span className="inline-flex items-center gap-1 text-sm text-kraft font-medium">
                      Découvrir <span aria-hidden="true">→</span>
                    </span>
                  </Link>
                </Reveal>
                <Reveal delay={160}>
                  <Link
                    href="/register?role=accompagne"
                    className="block bg-white rounded-2xl border border-[#e8dfd2] p-7 hover:border-kraft transition h-full"
                  >
                    <span className="inline-block text-[11px] uppercase tracking-[0.18em] text-kraft font-medium mb-2">
                      Proches
                    </span>
                    <h3 className="text-xl text-gray-900 italic mb-2">Aider un proche</h3>
                    <p className="text-sm text-gray-600 leading-relaxed mb-3">
                      Vous accompagnez un parent ou un proche dans sa recherche ? Inscrivez-vous pour lui.
                    </p>
                    <span className="inline-flex items-center gap-1 text-sm text-kraft font-medium">
                      En savoir plus <span aria-hidden="true">→</span>
                    </span>
                  </Link>
                </Reveal>
              </div>
            </div>
          </div>
        </section>

        {/* ===== COMMENT CA MARCHE ===== */}
        <section id="comment" className="px-4 py-16 md:py-20 bg-[#faf7f2]">
          <div className="max-w-3xl mx-auto">
            <Reveal>
              <div className="text-center mb-10">
                <span className="inline-block text-[11px] uppercase tracking-[0.2em] text-kraft font-medium mb-3">
                  Étape par étape
                </span>
                <h2 className="text-3xl md:text-4xl text-gray-900 italic leading-tight mb-3">
                  Comment ça marche
                </h2>
                <p className="text-gray-600 max-w-md mx-auto">
                  Quatre étapes, et la mise en relation se fait.
                </p>
              </div>
            </Reveal>
            <div>
              {[
                { n: '01', t: 'Inscription', d: "Créez votre compte en tant qu'accompagnant ou accompagné." },
                { n: '02', t: 'Justificatifs', d: "Accompagnants : déposez vos diplômes et pièce d'identité. Accompagnés : décrivez votre besoin." },
                { n: '03', t: 'Validation', d: 'Notre équipe vérifie manuellement chaque profil accompagnant, sous 48h.' },
                { n: '04', t: 'Mise en relation', d: 'Publiez votre annonce, nous vous recommandons les profils les plus compatibles. Premiers contacts en quelques jours.' },
              ].map((s, i) => (
                <Reveal key={s.n} delay={i * 80}>
                  <div className="grid grid-cols-[60px_1fr] md:grid-cols-[80px_1fr] gap-4 md:gap-6 items-start py-6 border-b border-[#e8dfd2] last:border-b-0">
                    <div className="italic text-3xl md:text-4xl text-kraft leading-none">{s.n}</div>
                    <div>
                      <h3 className="text-lg md:text-xl text-gray-900 italic mb-1.5">{s.t}</h3>
                      <p className="text-sm md:text-base text-gray-600 leading-relaxed">{s.d}</p>
                    </div>
                  </div>
                </Reveal>
              ))}
            </div>
          </div>
        </section>

        {/* ===== TARIFS ===== */}
        <section id="tarifs" className="px-4 py-16 md:py-20 bg-[#fefaf8]">
          <div className="max-w-3xl mx-auto">
            <Reveal>
              <div className="text-center mb-10">
                <span className="inline-block text-[11px] uppercase tracking-[0.2em] text-kraft font-medium mb-3">
                  Tarifs
                </span>
                <h2 className="text-3xl md:text-4xl text-gray-900 italic leading-tight mb-3">
                  Un tarif unique, simple
                </h2>
                <p className="text-gray-600 max-w-md mx-auto">
                  Même prix pour les accompagnants et les accompagnés.
                </p>
              </div>
            </Reveal>
            {launchOfferActive && (
              <div className="bg-accent/30 border border-accent text-gray-900 text-center py-2.5 px-5 rounded-full max-w-md mx-auto mb-6 text-sm">
                Offre de lancement : <strong className="font-medium">1 mois offert</strong> pour toute inscription.
              </div>
            )}
            <div className="grid md:grid-cols-2 gap-4 max-w-2xl mx-auto">
              <Reveal>
                <div className="bg-white rounded-2xl border border-[#e8dfd2] p-7 text-center h-full flex flex-col">
                  <h3 className="text-xl text-gray-900 italic mb-2">Mensuel</h3>
                  <p className="text-3xl md:text-4xl italic text-gray-900 mb-1">
                    4,99€
                    <span className="text-sm font-normal text-gray-500 not-italic"> / mois</span>
                  </p>
                  <p className="text-sm text-gray-600 mb-5">Sans engagement, résiliable à tout moment.</p>
                  <Link
                    href="/register"
                    className="mt-auto inline-flex items-center justify-center px-5 py-2.5 rounded-full bg-white border border-[#e8dfd2] text-gray-900 hover:border-kraft transition text-sm font-medium"
                  >
                    Commencer
                  </Link>
                </div>
              </Reveal>
              <Reveal delay={80}>
                <div className="relative bg-gradient-to-b from-white to-[#faecd9] rounded-2xl border border-kraft p-7 text-center h-full flex flex-col">
                  <span className="absolute -top-3 left-1/2 -translate-x-1/2 bg-kraft text-white text-[10px] uppercase tracking-[0.14em] font-medium px-3 py-1 rounded-full">
                    Recommandé
                  </span>
                  <h3 className="text-xl text-gray-900 italic mb-2">Annuel</h3>
                  <p className="text-gray-400 line-through text-sm mb-1">59,88€</p>
                  <p className="text-3xl md:text-4xl italic text-gray-900 mb-1">
                    49,99€
                    <span className="text-sm font-normal text-gray-500 not-italic"> / an</span>
                  </p>
                  <p className="text-sm text-gray-600 mb-5">Soit 4,17€/mois. Économisez 17%.</p>
                  <Link
                    href="/register"
                    className="mt-auto inline-flex items-center justify-center px-5 py-2.5 rounded-full bg-accent border border-accent text-black hover:bg-kraft hover:border-kraft hover:text-white transition text-sm font-medium"
                  >
                    Commencer
                  </Link>
                </div>
              </Reveal>
            </div>
          </div>
        </section>

        {/* ===== FAQ ===== */}
        <section id="faq" className="px-4 py-16 md:py-20 bg-[#faf7f2]">
          <div className="max-w-6xl mx-auto">
            <Reveal>
              <div className="text-center mb-10">
                <span className="inline-block text-[11px] uppercase tracking-[0.2em] text-kraft font-medium mb-3">
                  Questions
                </span>
                <h2 className="text-3xl md:text-4xl text-gray-900 italic leading-tight">
                  Questions fréquentes
                </h2>
              </div>
            </Reveal>
            <div className="grid md:grid-cols-[minmax(280px,_360px)_1fr] gap-8 md:gap-12 items-start">
              <Reveal>
                <div className="md:sticky md:top-24 aspect-[3/4] max-w-[320px] mx-auto md:mx-0 rounded-2xl overflow-hidden shadow-[0_18px_40px_-18px_rgba(0,0,0,0.22)]">
                  <Image
                    src="/faq.jpg"
                    alt=""
                    width={768}
                    height={1024}
                    className="w-full h-full object-cover"
                  />
                </div>
              </Reveal>
              <div className="grid gap-3">
                {[
                  { q: 'Comment fonctionne la vérification des profils ?', a: "Chaque accompagnant doit déposer ses diplômes et sa pièce d'identité. Notre équipe vérifie manuellement ces documents avant d'activer le profil." },
                  { q: "Combien coûte l'abonnement ?", a: "L'abonnement mensuel est à 4,99€/mois sans engagement. L'abonnement annuel est à 49,99€/an, soit une économie de 17%." },
                  { q: 'Comment fonctionnent les recommandations de profils ?', a: 'Nous analysons 5 critères (spécialités, localisation, expérience, diplôme, disponibilités) pour vous recommander les profils les plus compatibles.' },
                  { q: 'Puis-je utiliser la plateforme sans abonnement ?', a: "Vous pouvez consulter les annonces publiées sans abonnement. L'abonnement est requis pour publier des annonces et accéder aux profils que nous vous recommandons." },
                  { q: 'Comment contacter un accompagnant ?', a: "Une fois inscrit en tant qu'accompagné, vous pouvez envoyer un message via la messagerie intégrée à partir de la fiche de l'accompagnant." },
                  { q: 'Comment supprimer mon compte ?', a: 'Vous pouvez supprimer votre compte depuis les paramètres de votre espace personnel. Toutes vos données seront supprimées conformément au RGPD.' },
                ].map((faq, i) => (
                  <Reveal key={i} delay={i * 60}>
                    <details className="group bg-white rounded-2xl border border-[#e8dfd2] px-5 py-4 hover:border-kraft transition">
                      <summary className="cursor-pointer flex items-center justify-between gap-4 list-none">
                        <span className="italic text-base md:text-lg text-gray-900">{faq.q}</span>
                        <span
                          aria-hidden="true"
                          className="text-kraft text-2xl leading-none transition-transform group-open:rotate-45 flex-shrink-0"
                        >
                          +
                        </span>
                      </summary>
                      <p className="text-sm md:text-base text-gray-600 mt-3 leading-relaxed">{faq.a}</p>
                    </details>
                  </Reveal>
                ))}
              </div>
            </div>
          </div>
        </section>

        {/* ===== CONTACT ===== */}
        <section className="px-4 py-16 md:py-20 bg-[#fefaf8]">
          <div className="max-w-2xl mx-auto">
            <Reveal>
              <div className="relative overflow-hidden bg-white rounded-2xl border border-[#e8dfd2] p-8 md:p-10">
                <span
                  aria-hidden="true"
                  className="pointer-events-none absolute top-0 right-0 w-[260px] h-[260px]"
                  style={{ background: 'radial-gradient(circle at top right, #faecd9 0%, transparent 70%)' }}
                />
                <div className="relative text-center">
                  <span className="inline-block text-[11px] uppercase tracking-[0.2em] text-kraft font-medium mb-3">
                    Contact
                  </span>
                  <h2 className="text-3xl md:text-4xl text-gray-900 italic leading-tight mb-3">
                    Une question ?
                  </h2>
                  <p className="text-gray-600 mb-6 max-w-md mx-auto">
                    Notre équipe vous répond sous 48h ouvrées.
                  </p>
                  <ContactForm />
                </div>
              </div>
            </Reveal>
          </div>
        </section>
      </main>
      <Footer />
    </div>
  )
}
