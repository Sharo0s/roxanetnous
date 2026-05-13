import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import Link from 'next/link'
import { getUnreadCount } from '@/lib/unread-count'
import { getSubscriptionStatus } from '@/lib/subscription-helpers'
import { AccompagneSubscriptionBanner } from '@/components/accompagne/subscription-banner'
import { AccompagneDashboardHeader } from '@/components/layout/accompagne-dashboard-header'
import { DashboardPortrait } from '@/components/accompagnante/dashboard-portrait'
import { LogoutButton } from '@/components/auth/logout-button'

export default async function AccompagneDashboard() {
  const supabase = await createClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: userData } = await supabase
    .from('users')
    .select('first_name, last_name, role, avatar_url')
    .eq('id', user.id)
    .single()

  if (!userData || userData.role !== 'accompagne') redirect('/')

  const [unreadCount, subscription] = await Promise.all([
    getUnreadCount(user.id),
    getSubscriptionStatus(user.id),
  ])
  const subscribed = subscription.active

  const { data: profile } = await supabase
    .from('accompagnes_profiles')
    .select('id, ville')
    .eq('user_id', user.id)
    .single()

  let annoncesCount = 0
  let annoncesPubliees = 0
  if (profile) {
    const { count: total } = await supabase
      .from('annonces_accompagnes')
      .select('id', { count: 'exact', head: true })
      .eq('accompagne_id', profile.id)
    annoncesCount = total || 0

    const { count: publiees } = await supabase
      .from('annonces_accompagnes')
      .select('id', { count: 'exact', head: true })
      .eq('accompagne_id', profile.id)
      .eq('status', 'publiee')
    annoncesPubliees = publiees || 0
  }

  const { count: favorisCountRaw } = await supabase
    .from('favoris')
    .select('id', { count: 'exact', head: true })
    .eq('user_id', user.id)
  const favorisCount = favorisCountRaw || 0

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
    <main id="main-content" tabIndex={-1} className="min-h-screen bg-[#fefaf8] focus:outline-none">
      <h1 className="sr-only">Tableau de bord</h1>
      <AccompagneDashboardHeader
        firstName={userData.first_name}
        lastName={userData.last_name}
        unreadCount={unreadCount}
        currentPage="dashboard"
      />

      <div className="max-w-3xl mx-auto px-4 py-10 md:py-14 relative z-10">

        {/* HERO : carte foyer + portrait + identite */}
        <section className="relative overflow-hidden bg-white rounded-2xl border border-[#e8dfd2] p-6 md:p-7 mb-8">
          <span
            aria-hidden="true"
            className="pointer-events-none absolute top-0 right-0 w-[180px] h-[180px]"
            style={{ background: 'radial-gradient(circle at top right, #faecd9 0%, transparent 70%)' }}
          />
          <div className="relative flex flex-col md:flex-row items-center md:items-start gap-5 md:gap-6">
            <div className="flex-shrink-0">
              <DashboardPortrait
                currentUrl={userData.avatar_url}
                firstName={userData.first_name || ''}
                lastName={userData.last_name || ''}
                size="sm"
              />
            </div>
            <div className="flex-1 min-w-0 text-center md:text-left">
              <span className="inline-block text-[11px] uppercase tracking-[0.18em] text-kraft font-medium mb-1.5">
                Bonjour
              </span>
              <h2 className="text-3xl md:text-4xl text-gray-900 italic mb-2 leading-tight">
                {userData.first_name} {userData.last_name}
              </h2>
              {profile?.ville && (
                <p className="text-sm text-gray-600 flex items-center justify-center md:justify-start gap-1.5">
                  <svg className="w-3.5 h-3.5 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2} aria-hidden="true">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M15 10.5a3 3 0 11-6 0 3 3 0 016 0z" />
                    <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 10.5c0 7.142-7.5 11.25-7.5 11.25S4.5 17.642 4.5 10.5a7.5 7.5 0 1115 0z" />
                  </svg>
                  {profile.ville}
                </p>
              )}
            </div>
          </div>
        </section>

        {!subscribed ? (
          /* ETAT SANS ABONNEMENT : bandeau + cartes secondaires en lecture seule */
          <div className="space-y-4">
            <AccompagneSubscriptionBanner />

            <section aria-labelledby="en-attendant-title">
              <h2 id="en-attendant-title" className="text-center italic text-xl text-gray-800 mt-10 mb-5">
                En attendant
              </h2>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">

                <Link
                  href="/accompagne/profil"
                  className="bg-white rounded-2xl border border-[#e8dfd2] p-6 hover:border-kraft transition flex flex-col"
                >
                  <h3 className="italic text-lg mb-2">Mon profil</h3>
                  <p className="text-gray-600 text-sm flex-1">
                    Vos informations personnelles et votre ville.
                  </p>
                  <span className="mt-3 text-sm text-kraft inline-flex items-center gap-1">
                    Modifier <span aria-hidden="true">→</span>
                  </span>
                </Link>

                <Link
                  href="/messages"
                  className="bg-white rounded-2xl border border-[#e8dfd2] p-6 hover:border-kraft transition flex flex-col"
                >
                  <h3 className="italic text-lg mb-2">Messages</h3>
                  <p className="text-gray-600 text-sm flex-1">
                    Échangez avec les accompagnants déjà contactés.
                  </p>
                  <span className="mt-3 text-sm text-kraft inline-flex items-center gap-1">
                    Ouvrir <span aria-hidden="true">→</span>
                  </span>
                </Link>

                <Link
                  href="/accompagne/abonnement"
                  className="bg-white rounded-2xl border border-[#e8dfd2] p-6 hover:border-kraft transition flex flex-col"
                >
                  <h3 className="italic text-lg mb-2">Mon abonnement</h3>
                  <p className="text-gray-600 text-sm flex-1">
                    {subscriptionLabel}
                  </p>
                  <span className="mt-3 text-sm text-kraft inline-flex items-center gap-1">
                    Voir les offres <span aria-hidden="true">→</span>
                  </span>
                </Link>

              </div>
            </section>
          </div>
        ) : (
          /* ETAT NOMINAL : tuiles asymetriques + CTA annonce + section Mon espace */
          <>
            {/* TUILES asymetriques : Recherche (gros) + Messages + Annonces */}
            <section
              aria-label="Activite recente"
              className="grid grid-cols-1 md:grid-cols-[1.5fr_1fr] md:grid-rows-2 gap-3 mb-10"
            >
              <Link
                href="/recherche"
                aria-label="Rechercher un accompagnant"
                className="relative md:row-span-2 rounded-2xl border border-accent p-6 flex flex-col justify-between min-h-[160px] md:min-h-[270px] hover:border-kraft hover:-translate-y-0.5 transition"
                style={{ backgroundImage: 'linear-gradient(135deg, #faecd9 0%, #f4d8b9 100%)' }}
              >
                <div>
                  <div className="text-[11px] uppercase tracking-[0.14em] text-kraft font-medium mb-2">
                    Trouver
                  </div>
                  <div className="italic text-5xl md:text-7xl text-gray-900 leading-none mb-3">
                    <svg className="w-10 h-10 md:w-14 md:h-14 text-gray-800 inline-block" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.2} aria-hidden="true">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-5.197-5.197m0 0A7.5 7.5 0 105.196 5.196a7.5 7.5 0 0010.607 10.607z" />
                    </svg>
                  </div>
                  <div className="text-sm md:text-base text-gray-800">
                    Rechercher un accompagnant
                  </div>
                </div>
                <span className="self-end text-kraft text-base mt-4" aria-hidden="true">→</span>
              </Link>

              <Link
                href="/messages"
                aria-label={unreadCount > 0 ? `${unreadCount} messages non lus` : 'Messages'}
                className="relative rounded-2xl border border-[#e8dfd2] bg-white p-6 flex flex-col justify-between min-h-[130px] hover:border-kraft hover:-translate-y-0.5 transition"
              >
                {unreadCount > 0 && (
                  <span
                    aria-hidden="true"
                    className="absolute top-4 right-4 w-2 h-2 rounded-full bg-kraft"
                  />
                )}
                <div>
                  <div className="text-[11px] uppercase tracking-[0.14em] text-kraft font-medium mb-2">
                    Messages
                  </div>
                  <div className="italic text-3xl text-gray-900 leading-none mb-2">
                    {unreadCount}
                  </div>
                  <div className="text-sm text-gray-700">
                    non lu{unreadCount > 1 ? 's' : ''}
                  </div>
                </div>
                <span className="self-end text-kraft text-base mt-2" aria-hidden="true">→</span>
              </Link>

              <Link
                href="/accompagne/annonces"
                aria-label={`${annoncesPubliees} annonces publiees, ${annoncesCount} au total`}
                className="relative rounded-2xl border border-[#e8dfd2] bg-white p-6 flex flex-col justify-between min-h-[130px] hover:border-kraft hover:-translate-y-0.5 transition"
              >
                <div>
                  <div className="text-[11px] uppercase tracking-[0.14em] text-kraft font-medium mb-2">
                    Mes annonces
                  </div>
                  <div className="italic text-3xl text-gray-900 leading-none mb-2">
                    {annoncesPubliees}
                  </div>
                  <div className="text-sm text-gray-700">
                    publiée{annoncesPubliees > 1 ? 's' : ''}
                    {annoncesCount !== annoncesPubliees && (
                      <span className="text-gray-400"> · {annoncesCount} au total</span>
                    )}
                  </div>
                </div>
                <span className="self-end text-kraft text-base mt-2" aria-hidden="true">→</span>
              </Link>
            </section>

            {/* CTA secondaire : publier une annonce */}
            <div className="bg-white rounded-2xl border border-accent p-7 text-center mb-10">
              <h2 className="italic text-xl md:text-2xl text-gray-900 mb-2">
                Vous préférez qu&apos;on vous trouve ?
              </h2>
              <p className="text-gray-600 text-sm md:text-base mb-5">
                Publiez une annonce décrivant vos besoins et recevez des candidatures d&apos;accompagnants.
              </p>
              <Link
                href="/accompagne/annonces/nouvelle"
                className="inline-flex items-center px-5 py-2.5 rounded-full bg-accent border border-accent text-black hover:bg-kraft hover:border-kraft hover:text-white transition text-sm font-medium"
              >
                Publier une annonce
              </Link>
            </div>

            {/* SECONDAIRE : profil / favoris / abonnement */}
            <section aria-labelledby="mon-espace-title">
              <h2 id="mon-espace-title" className="text-center italic text-xl text-gray-800 mb-5">
                Mon espace
              </h2>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">

                <Link
                  href="/accompagne/profil"
                  className="bg-white rounded-2xl border border-[#e8dfd2] p-6 hover:border-kraft transition flex flex-col"
                >
                  <h3 className="italic text-lg mb-2">Mon profil</h3>
                  <p className="text-gray-600 text-sm flex-1">
                    Vos informations personnelles et votre ville.
                  </p>
                </Link>

                <Link
                  href="/favoris"
                  className="bg-white rounded-2xl border border-[#e8dfd2] p-6 hover:border-kraft transition flex flex-col"
                >
                  <h3 className="italic text-lg mb-2">Mes favoris</h3>
                  <p className="text-gray-600 text-sm flex-1">
                    {favorisCount > 0
                      ? `${favorisCount} accompagnant${favorisCount > 1 ? 's' : ''} enregistré${favorisCount > 1 ? 's' : ''}.`
                      : 'Aucun favori pour le moment.'}
                  </p>
                </Link>

                <Link
                  href="/accompagne/abonnement"
                  className="bg-white rounded-2xl border border-[#e8dfd2] p-6 hover:border-kraft transition flex flex-col"
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
