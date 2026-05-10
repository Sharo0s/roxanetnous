import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import Link from 'next/link'
import { getUnreadCount } from '@/lib/unread-count'
import { getSubscriptionStatus } from '@/lib/subscription-helpers'
import { SubscriptionBanner } from '@/components/accompagnante/subscription-banner'
import { AccompagnanteDashboardHeader } from '@/components/layout/accompagnante-dashboard-header'
import { DashboardPortrait } from '@/components/accompagnante/dashboard-portrait'
import { DisponibleToggle } from '@/components/accompagnante/disponible-toggle'
import { StatusBadge } from '@/components/accompagnante/status-badge'
import { LogoutButton } from '@/components/auth/logout-button'
import { SPECIALITES } from '@/lib/constants'

export default async function AccompagnanteDashboard() {
  const supabase = await createClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: userData } = await supabase
    .from('users')
    .select('first_name, last_name, role, avatar_url, parrainee_par')
    .eq('id', user.id)
    .single()

  if (!userData || userData.role !== 'accompagnante') redirect('/')

  const isFilleule = !!userData.parrainee_par

  const { data: profile } = await supabase
    .from('accompagnantes_profiles')
    .select('id, validation_status, validation_source, diplomes, refus_motif, ville, rayon_km, specialites, disponible, indisponible_jusqu_au')
    .eq('user_id', user.id)
    .single()

  const unreadCount = await getUnreadCount(user.id)
  const subscription = await getSubscriptionStatus(user.id)
  const subscribed = subscription.active

  // Detecte un parrainage bloque (anti-fraude) MAIS uniquement si la filleule
  // n'a pas encore ete validee par un admin. Si l'admin a tranche en faveur
  // de la filleule (validation_status='valide'), sa decision prime sur la
  // detection automatique : on ne lui affiche pas le bandeau "Verification
  // supplementaire en cours" car c'est resolu de son point de vue.
  let hasBlockedParrainage = false
  if (profile?.validation_status !== 'valide') {
    const { data: blockedParrainageRow } = await supabase
      .from('parrainages_filleule_view')
      .select('id')
      .eq('statut', 'bloque')
      .maybeSingle()
    hasBlockedParrainage = !!blockedParrainageRow
  }

  // Le contenu detaille (code, copie, liste filleules, jauge) vit sur
  // /accompagnante/parrainage. Sur le dashboard on n'affiche qu'un teaser
  // tant qu'un code existe et que le compteur peut etre montre.
  let parrainageCode: string | null = null
  let parrainageCompteur = 0
  let parrainageTotalRecompenses = 0

  if (profile?.validation_status === 'valide') {
    const { data: parrainageRow } = await supabase
      .from('parrainages_codes')
      .select('code, compteur_confirmes, total_recompenses')
      .eq('user_id', user.id)
      .maybeSingle()
    parrainageCode = parrainageRow?.code ?? null
    parrainageCompteur = parrainageRow?.compteur_confirmes ?? 0
    parrainageTotalRecompenses = parrainageRow?.total_recompenses ?? 0
  }

  let annoncesCount = 0
  let annoncesPubliees = 0
  if (profile) {
    const { count: total } = await supabase
      .from('annonces_accompagnantes')
      .select('id', { count: 'exact', head: true })
      .eq('accompagnante_id', profile.id)
    annoncesCount = total || 0

    const { count: publiees } = await supabase
      .from('annonces_accompagnantes')
      .select('id', { count: 'exact', head: true })
      .eq('accompagnante_id', profile.id)
      .eq('status', 'publiee')
    annoncesPubliees = publiees || 0
  }

  const isProfilIncomplet = !profile || (
    isFilleule
      ? !profile.ville
      : !profile.diplomes || profile.diplomes.length === 0
  )

  // Texte abonnement reutilise dans la carte secondaire
  const subscriptionLabel = subscription.status === 'trialing'
    ? `Essai gratuit - Fin le ${subscription.trialEnd ? new Date(subscription.trialEnd).toLocaleDateString('fr-FR') : subscription.currentPeriodEnd ? new Date(subscription.currentPeriodEnd).toLocaleDateString('fr-FR') : '-'}`
    : subscribed && !subscription.cancelAt
      ? `${subscription.planType === 'annuel' ? 'Annuel' : 'Mensuel'} - Prochaine échéance : ${subscription.currentPeriodEnd ? new Date(subscription.currentPeriodEnd).toLocaleDateString('fr-FR') : '-'}`
      : subscription.cancelAt
        ? new Date(subscription.cancelAt).getTime() < Date.now()
          ? `Abonnement expiré le ${new Date(subscription.cancelAt).toLocaleDateString('fr-FR')}`
          : `Expire le ${new Date(subscription.cancelAt).toLocaleDateString('fr-FR')}`
        : 'Aucun abonnement actif'

  return (
    <main id="main-content" tabIndex={-1} className="min-h-screen bg-[#faf7f2] focus:outline-none">
      <h1 className="sr-only">Tableau de bord</h1>
      <AccompagnanteDashboardHeader
        firstName={userData.first_name}
        lastName={userData.last_name}
        unreadCount={unreadCount}
      />

      <div className="max-w-3xl mx-auto px-4 py-10 md:py-14 relative z-10">

        {/* HERO : portrait + identite */}
        <section className="flex flex-col md:flex-row items-center md:items-start gap-6 md:gap-8 mb-8">
          <div className="flex-shrink-0">
            <DashboardPortrait
              currentUrl={userData.avatar_url}
              firstName={userData.first_name || ''}
              lastName={userData.last_name || ''}
            />
          </div>
          <div className="flex-1 min-w-0 text-center md:text-left">
            <h2 className="text-3xl md:text-4xl text-gray-900 italic mb-2 leading-tight">
              {userData.first_name} {userData.last_name}
            </h2>
            {profile && (
              <div className="mb-3 flex justify-center md:justify-start">
                {profile.validation_status === 'valide' ? (
                  <span className="inline-flex items-center gap-2 text-xs uppercase tracking-[0.14em] font-medium text-kraft">
                    <span className="w-1.5 h-1.5 rounded-full bg-green-600" aria-hidden="true" />
                    Accompagnante validée
                  </span>
                ) : (
                  <StatusBadge
                    status={profile.validation_status}
                    source={profile.validation_source as 'manuelle' | 'parrainage' | null}
                  />
                )}
              </div>
            )}
            {profile?.ville && (
              <p className="text-sm text-gray-600 mb-2 flex items-center justify-center md:justify-start gap-1.5">
                <svg className="w-3.5 h-3.5 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2} aria-hidden="true">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M15 10.5a3 3 0 11-6 0 3 3 0 016 0z" />
                  <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 10.5c0 7.142-7.5 11.25-7.5 11.25S4.5 17.642 4.5 10.5a7.5 7.5 0 1115 0z" />
                </svg>
                {profile.ville}{profile.rayon_km ? ` - Sur ${profile.rayon_km} km` : ''}
              </p>
            )}
            {profile?.specialites && (profile.specialites as string[]).length > 0 && (
              <div className="flex flex-wrap gap-1.5 justify-center md:justify-start">
                {(profile.specialites as string[]).map((s) => (
                  <span key={s} className="px-2 py-0.5 rounded-full bg-accent/20 text-xs font-medium text-gray-700">
                    {SPECIALITES.find((sp) => sp.value === s)?.label || s}
                  </span>
                ))}
              </div>
            )}
          </div>
        </section>

        {/* PRESENCE PILL : centree, toujours affichee si profil existe */}
        {profile && (
          <div className="flex justify-center mb-10">
            <div className="inline-flex items-center gap-3 px-5 py-2.5 rounded-full bg-white border border-gray-200">
              <DisponibleToggle
                initial={profile.disponible ?? true}
                initialIndisponibleJusquAu={profile.indisponible_jusqu_au}
                compact
              />
            </div>
          </div>
        )}

        {/* BANDEAUX CONDITIONNELS */}
        {hasBlockedParrainage ? (
          // Cas filleule bloquee par la detection anti-fraude (meme_carte,
          // meme_email, etc.). parrainee_par a ete reset a null cote BDD,
          // donc isFilleule=false. La filleule garde acces aux messages
          // (pour echanger avec l'admin), a son profil et a son abonnement
          // (pour pouvoir l'annuler si elle ne souhaite pas attendre).
          // Pas d'acces a la publication d'annonces ou aux demandes tant
          // que pas validee.
          <div className="space-y-4">
            <div className="bg-white rounded-xl border border-amber-300 p-6">
              <h2 className="font-semibold text-lg text-black mb-2">
                Vérification supplémentaire en cours
              </h2>
              <p className="text-gray-600 mb-2">
                Votre paiement a bien été reçu et votre abonnement est actif.
                En revanche, notre système a relevé un signal qui nécessite
                une vérification manuelle avant la publication de votre profil.
              </p>
              <p className="text-gray-600 mb-0">
                Un administrateur examinera votre dossier sous 48h ouvrées.
                Si vous pensez qu&apos;il s&apos;agit d&apos;une erreur, contactez-nous à{' '}
                <a href="mailto:roxanetnous@outlook.com" className="underline">
                  roxanetnous@outlook.com
                </a>
                .
              </p>
            </div>

            <h2 className="text-center italic text-xl text-gray-800 mt-10 mb-4">
              Ce que vous pouvez faire en attendant
            </h2>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <Link
                href="/messages"
                className="bg-white rounded-xl border p-6 hover:border-kraft transition flex flex-col"
              >
                <h3 className="italic text-lg mb-2">Messages</h3>
                <p className="text-gray-600 text-sm flex-1">
                  Échangez avec l&apos;équipe pour résoudre la vérification.
                </p>
                <span className="mt-4 text-sm text-kraft inline-flex items-center gap-1">
                  Ouvrir <span aria-hidden="true">→</span>
                </span>
              </Link>
              <Link
                href="/accompagnante/profil"
                className="bg-white rounded-xl border p-6 hover:border-kraft transition flex flex-col"
              >
                <h3 className="italic text-lg mb-2">Mon profil</h3>
                <p className="text-gray-600 text-sm flex-1">
                  Consultez et modifiez vos informations professionnelles.
                </p>
                <span className="mt-4 text-sm text-kraft inline-flex items-center gap-1">
                  Modifier <span aria-hidden="true">→</span>
                </span>
              </Link>
              <Link
                href="/accompagnante/abonnement"
                className="bg-white rounded-xl border p-6 hover:border-kraft transition flex flex-col"
              >
                <h3 className="italic text-lg mb-2">Mon abonnement</h3>
                <p className="text-gray-600 text-sm flex-1">
                  {subscriptionLabel}
                </p>
                <span className="mt-4 text-sm text-kraft inline-flex items-center gap-1">
                  Gérer <span aria-hidden="true">→</span>
                </span>
              </Link>
            </div>
          </div>
        ) : isProfilIncomplet ? (
          <div className="bg-white rounded-xl border p-6 text-center max-w-xl mx-auto">
            <h2 className="italic text-xl mb-2">Bienvenue {userData.first_name}.</h2>
            <p className="text-gray-600 mb-4">
              Pour apparaître sur la plateforme, vous devez d&#39;abord compléter votre profil professionnel.
            </p>
            <a
              href="/accompagnante/onboarding"
              className="inline-flex items-center px-5 py-2.5 bg-accent text-black rounded-lg btn-hover transition text-sm font-medium"
            >
              Compléter mon profil
            </a>
          </div>
        ) : (
          <div className="space-y-4">
            {isFilleule && profile?.validation_status === 'en_attente' && !subscribed && (
              <div className="bg-white rounded-xl border border-accent p-6">
                <h2 className="font-semibold text-lg text-black mb-2">
                  Plus qu&apos;une étape : souscrivez votre abonnement
                </h2>
                <p className="text-gray-600 mb-4">
                  Votre marraine se porte garante : pas de visio, pas de
                  vérification de documents. Souscrivez à un abonnement et
                  vous pourrez publier votre première annonce.
                </p>
                <Link
                  href="/accompagnante/abonnement"
                  className="inline-flex items-center px-4 py-2 bg-accent text-black rounded-lg btn-hover transition text-sm font-medium"
                >
                  Souscrire à un abonnement
                </Link>
              </div>
            )}
            {profile?.validation_status === 'visio_a_planifier' && (
              <div className="p-4 rounded-xl border border-blue-200 bg-blue-50 text-sm">
                <p className="font-medium text-blue-900">
                  Votre dossier a été revu. Nous vous avons envoyé un email pour convenir d&apos;un créneau visio avec l&apos;équipe.
                </p>
              </div>
            )}
            {profile?.validation_status === 'visio_realisee' && (
              <div className="p-4 rounded-xl border border-amber-200 bg-amber-50 text-sm">
                <p className="font-medium text-amber-900">
                  Visio réalisée — nous finalisons votre validation.
                </p>
              </div>
            )}
            {profile?.validation_status === 'a_completer' && (
              <div className="p-4 rounded-xl border border-blue-200 bg-blue-50 text-sm">
                <p className="font-medium text-blue-900">
                  Bienvenue ! Complétez votre profil pour le soumettre à validation.
                </p>
                {profile.refus_motif && (
                  <p className="text-blue-800 mt-1">{profile.refus_motif}</p>
                )}
                <Link
                  href="/accompagnante/onboarding"
                  className="inline-flex items-center px-4 py-2 bg-accent text-black rounded-lg btn-hover transition text-sm font-medium mt-3"
                >
                  Compléter mon profil
                </Link>
              </div>
            )}
            {profile?.validation_status === 'refuse' && (
              <div role="alert" className="p-4 rounded-xl border border-red-200 bg-red-50 text-sm">
                <p className="font-medium text-red-800">
                  Votre profil a été refusé. Veuillez corriger les informations demandées.
                </p>
                {profile.refus_motif && (
                  <p className="text-red-700 mt-1">{profile.refus_motif}</p>
                )}
                <Link
                  href="/accompagnante/profil"
                  className="inline-flex items-center px-4 py-2 bg-accent text-black rounded-lg btn-hover transition text-sm font-medium mt-3"
                >
                  Modifier mon profil
                </Link>
              </div>
            )}

            {profile?.validation_status === 'valide' && !subscribed && (
              <SubscriptionBanner />
            )}

            {profile?.validation_status === 'valide' && subscribed && (
              <>
                {/* STATS — 3 cercles principaux */}
                <section aria-label="Activite recente" className="grid grid-cols-3 gap-3 md:gap-6 mb-12 mt-2">
                  <Link
                    href="/recherche/demandes"
                    className="group flex flex-col items-center text-center"
                  >
                    <div className="relative w-20 h-20 md:w-24 md:h-24 rounded-full border border-kraft bg-accent/30 flex items-center justify-center mb-3 group-hover:-translate-y-0.5 transition">
                      <svg className="w-7 h-7 md:w-8 md:h-8 text-gray-800" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5} aria-hidden="true">
                        <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-5.197-5.197m0 0A7.5 7.5 0 105.196 5.196a7.5 7.5 0 0010.607 10.607z" />
                      </svg>
                    </div>
                    <span className="text-sm text-gray-700">demandes en attente</span>
                  </Link>

                  <Link
                    href="/messages"
                    className="group flex flex-col items-center text-center"
                    aria-label={unreadCount > 0 ? `${unreadCount} messages non lus` : 'Messages'}
                  >
                    <div className="relative w-20 h-20 md:w-24 md:h-24 rounded-full border border-kraft bg-accent/30 flex items-center justify-center mb-3 group-hover:-translate-y-0.5 transition">
                      {unreadCount > 0 && (
                        <span className="absolute top-2 right-3 w-2 h-2 rounded-full bg-red-500" aria-hidden="true" />
                      )}
                      <span className="italic text-2xl md:text-3xl text-gray-900">
                        {unreadCount}
                      </span>
                    </div>
                    <span className="text-sm text-gray-700">
                      message{unreadCount > 1 ? 's' : ''} non lu{unreadCount > 1 ? 's' : ''}
                    </span>
                  </Link>

                  <Link
                    href="/accompagnante/annonces"
                    className="group flex flex-col items-center text-center"
                    aria-label={`${annoncesPubliees} annonces publiees, ${annoncesCount} au total`}
                  >
                    <div className="relative w-20 h-20 md:w-24 md:h-24 rounded-full border border-kraft bg-accent/30 flex items-center justify-center mb-3 group-hover:-translate-y-0.5 transition">
                      <span className="italic text-2xl md:text-3xl text-gray-900">
                        {annoncesPubliees}
                      </span>
                    </div>
                    <span className="text-sm text-gray-700">
                      annonce{annoncesPubliees > 1 ? 's' : ''} publiée{annoncesPubliees > 1 ? 's' : ''}
                    </span>
                    {annoncesCount !== annoncesPubliees && (
                      <span className="text-xs text-gray-400 mt-0.5">{annoncesCount} au total</span>
                    )}
                  </Link>
                </section>

                {/* SECTION SECONDAIRE — 3 cartes : profil / parrainage / abonnement */}
                <section aria-labelledby="mon-espace-title">
                  <h2 id="mon-espace-title" className="text-center italic text-xl text-gray-800 mb-5">
                    Mon espace
                  </h2>
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">

                    <Link
                      href="/accompagnante/profil"
                      className="bg-white rounded-xl border border-[#e8dfd2] p-6 hover:border-kraft transition flex flex-col"
                    >
                      <h3 className="italic text-lg mb-2">Mon profil</h3>
                      <p className="text-gray-600 text-sm flex-1">
                        Informations professionnelles, photos, diplômes et description.
                      </p>
                    </Link>

                    {parrainageCode && (
                      <Link
                        href="/accompagnante/parrainage"
                        className="bg-white rounded-xl border border-[#e8dfd2] p-6 hover:border-kraft transition flex flex-col"
                      >
                        <h3 className="italic text-lg mb-2">Mon parrainage</h3>
                        <p className="text-gray-600 text-sm">
                          {parrainageCompteur > 0 || parrainageTotalRecompenses > 0
                            ? <><strong className="text-gray-900 font-medium">{parrainageCompteur} / 5</strong> parrainages confirmés.</>
                            : 'Partagez votre code, 6 mois offerts tous les 5 parrainages.'}
                        </p>
                        <div className="flex gap-1 mt-2 mb-1" aria-hidden="true">
                          {[0, 1, 2, 3, 4].map((i) => (
                            <span
                              key={i}
                              className={`h-1 flex-1 rounded-full ${i < (parrainageCompteur % 5) ? 'bg-kraft' : 'bg-gray-200'}`}
                            />
                          ))}
                        </div>
                        {parrainageCompteur < 5 && (
                          <p className="text-xs text-gray-500 mt-2">6 mois offerts à 5 parrainages.</p>
                        )}
                      </Link>
                    )}

                    <Link
                      href="/accompagnante/abonnement"
                      className="bg-white rounded-xl border border-[#e8dfd2] p-6 hover:border-kraft transition flex flex-col"
                    >
                      <h3 className="italic text-lg mb-2">Mon abonnement</h3>
                      <p className="text-gray-600 text-sm flex-1">
                        {subscriptionLabel}
                      </p>
                    </Link>

                  </div>
                </section>
              </>
            )}
          </div>
        )}

        {/* FOOTER */}
        <div className="mt-16 pt-6 border-t border-[#e8dfd2] flex flex-wrap justify-center items-center gap-x-6 gap-y-2 text-xs text-gray-500">
          <Link href="/cgu" className="hover:text-gray-800">Aide</Link>
          <span aria-hidden="true">·</span>
          <Link href="/politique-de-confidentialite" className="hover:text-gray-800">Confidentialité</Link>
          <span aria-hidden="true">·</span>
          <Link href="/cgu" className="hover:text-gray-800">Conditions</Link>
          <span aria-hidden="true">·</span>
          <LogoutButton />
        </div>
      </div>
    </main>
  )
}
