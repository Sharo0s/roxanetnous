import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import Link from 'next/link'
import { getUnreadCount } from '@/lib/unread-count'
import { getSubscriptionStatus } from '@/lib/subscription-helpers'
import { AccompagneSubscriptionBanner } from '@/components/accompagne/subscription-banner'
import { AccompagneHeader } from '@/components/layout/accompagne-header'
import { AvatarUpload } from '@/components/accompagnante/avatar-upload'

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

  // Recuperer les annonces du accompagne
  const { data: profile } = await supabase
    .from('accompagnes_profiles')
    .select('id, ville')
    .eq('user_id', user.id)
    .single()

  let annoncesCount = 0

  if (profile) {
    const { count } = await supabase
      .from('annonces_accompagnes')
      .select('id', { count: 'exact', head: true })
      .eq('accompagne_id', profile.id)
    annoncesCount = count || 0
  }

  const { count: favorisCountRaw } = await supabase
    .from('favoris')
    .select('id', { count: 'exact', head: true })
    .eq('user_id', user.id)
  const favorisCount = favorisCountRaw || 0

  const profilIncomplet = !profile?.ville

  return (
    <main id="main-content" tabIndex={-1} className="min-h-screen kraft bg-kraft focus:outline-none">
      <h1 className="sr-only">Tableau de bord</h1>
      <AccompagneHeader
        userId={user.id}
        unreadCount={unreadCount}
        firstName={userData.first_name}
        lastName={userData.last_name}
        currentPage="dashboard"
      />

      <div className="max-w-5xl mx-auto px-4 py-8 relative z-10">
        <div className="flex items-start gap-5 mb-8 bg-white rounded-xl border p-5">
          <AvatarUpload
            currentUrl={userData.avatar_url}
            firstName={userData.first_name || ''}
            lastName={userData.last_name || ''}
            size="lg"
          />
          <div className="flex-1 min-w-0">
            <h2 className="text-xl font-bold text-gray-900">
              {userData.first_name} {userData.last_name}
            </h2>
            {profile?.ville && (
              <p className="text-sm text-gray-500 mt-1 flex items-center gap-1">
                <svg className="w-3.5 h-3.5 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M15 10.5a3 3 0 11-6 0 3 3 0 016 0z" />
                  <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 10.5c0 7.142-7.5 11.25-7.5 11.25S4.5 17.642 4.5 10.5a7.5 7.5 0 1115 0z" />
                </svg>
                {profile.ville}
              </p>
            )}
            {profilIncomplet ? (
              <div className="mt-3">
                <Link
                  href="/accompagne/profil"
                  className="inline-flex items-center gap-1.5 text-sm font-medium text-gray-700 hover:text-black transition"
                >
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01M5.07 19h13.86c1.54 0 2.5-1.67 1.73-3L13.73 4a2 2 0 00-3.46 0L3.34 16c-.77 1.33.19 3 1.73 3z" />
                  </svg>
                  Renseignez votre ville pour des recommandations locales
                </Link>
              </div>
            ) : (
              <div className="flex flex-wrap gap-1.5 mt-3">
                <span className="px-2 py-0.5 rounded-full bg-accent/20 text-xs font-medium text-gray-700">
                  {annoncesCount} annonce{annoncesCount > 1 ? 's' : ''}
                </span>
                <span className="px-2 py-0.5 rounded-full bg-accent/20 text-xs font-medium text-gray-700">
                  {favorisCount} favori{favorisCount > 1 ? 's' : ''}
                </span>
                {unreadCount > 0 && (
                  <span className="px-2 py-0.5 rounded-full bg-accent/20 text-xs font-medium text-gray-700">
                    {unreadCount} message{unreadCount > 1 ? 's' : ''} non lu{unreadCount > 1 ? 's' : ''}
                  </span>
                )}
              </div>
            )}
          </div>
        </div>

        {!subscribed && (
          <div className="mb-4">
            <AccompagneSubscriptionBanner />
          </div>
        )}

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="bg-white rounded-xl border p-6">
            <h2 className="font-semibold text-lg mb-2">Rechercher un(e) accompagnant(e)</h2>
            <p className="text-gray-600 mb-4">
              Trouvez l&#39;accompagnant(e) dont vous avez besoin
            </p>
            <Link
              href="/recherche"
              className="inline-flex items-center px-4 py-2 bg-accent text-black rounded-lg btn-hover transition text-sm font-medium"
            >
              Rechercher
            </Link>
          </div>

          <div className="bg-white rounded-xl border p-6">
            <h2 className="font-semibold text-lg mb-2">Publier une annonce</h2>
            <p className="text-gray-600 mb-4">
              Décrivez vos besoins et recevez des candidatures.
            </p>
            <Link
              href="/accompagne/annonces/nouvelle"
              className="inline-flex items-center px-4 py-2 bg-accent text-black rounded-lg btn-hover transition text-sm font-medium"
            >
              Créer une annonce
            </Link>
          </div>

          <div className="bg-white rounded-xl border p-6">
            <h2 className="font-semibold text-lg mb-2">Mes annonces</h2>
            <p className="text-gray-600 mb-1">
              {annoncesCount} annonce{annoncesCount > 1 ? 's' : ''} publiée{annoncesCount > 1 ? 's' : ''}
            </p>
            <p className="text-sm text-gray-400 mb-4">Gérez vos annonces de recherche.</p>
            <Link
              href="/accompagne/annonces"
              className="inline-flex items-center px-4 py-2 bg-accent text-black rounded-lg btn-hover transition text-sm font-medium"
            >
              Voir mes annonces
            </Link>
          </div>

          <div className="bg-white rounded-xl border p-6">
            <h2 className="font-semibold text-lg mb-2">Mes favoris</h2>
            <p className="text-gray-600 mb-4">
              Retrouvez vos accompagnant(e)s que vous avez mis en favori.
            </p>
            <Link
              href="/favoris"
              className="inline-flex items-center px-4 py-2 bg-accent text-black rounded-lg btn-hover transition text-sm font-medium"
            >
              Voir mes favoris
            </Link>
          </div>

          <div className="bg-white rounded-xl border p-6">
            <h2 className="font-semibold text-lg mb-2">Messages</h2>
            <p className="text-gray-600 mb-4">
              Consultez vos conversations avec les accompagnant(e)s.
            </p>
            <Link
              href="/messages"
              className="inline-flex items-center px-4 py-2 bg-accent text-black rounded-lg btn-hover transition text-sm font-medium"
            >
              Voir mes messages
            </Link>
          </div>

          <div className="bg-white rounded-xl border p-6">
            <h2 className="font-semibold text-lg mb-2">Mon profil</h2>
            <p className="text-gray-600 mb-4">
              Consultez et modifiez vos informations personnelles.
            </p>
            <Link
              href="/accompagne/profil"
              className="inline-flex items-center px-4 py-2 bg-accent text-black rounded-lg btn-hover transition text-sm font-medium"
            >
              Voir mon profil
            </Link>
          </div>

          <div className="bg-white rounded-xl border p-6">
            <h2 className="font-semibold text-lg mb-2">Mon abonnement</h2>
            <p className="text-gray-600 mb-4">
              {subscription.status === 'trialing'
                ? `Essai gratuit - Fin le ${subscription.trialEnd ? new Date(subscription.trialEnd).toLocaleDateString('fr-FR') : subscription.currentPeriodEnd ? new Date(subscription.currentPeriodEnd).toLocaleDateString('fr-FR') : '-'}`
                : subscription.cancelAt
                  ? `Expire le ${new Date(subscription.cancelAt).toLocaleDateString('fr-FR')}`
                  : subscribed
                    ? `${subscription.planType === 'annuel' ? 'Annuel' : 'Mensuel'} - Prochaine échéance : ${subscription.currentPeriodEnd ? new Date(subscription.currentPeriodEnd).toLocaleDateString('fr-FR') : '-'}`
                    : 'Aucun abonnement actif'}
            </p>
            <Link
              href="/accompagne/abonnement"
              className="inline-flex items-center px-4 py-2 bg-accent text-black rounded-lg btn-hover transition text-sm font-medium"
            >
              Gérer mon abonnement
            </Link>
          </div>

        </div>
      </div>
    </main>
  )
}
