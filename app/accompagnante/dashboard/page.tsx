import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import Link from 'next/link'
import { getUnreadCount } from '@/lib/unread-count'
import { getSubscriptionStatus } from '@/lib/subscription-helpers'
import { SubscriptionBanner } from '@/components/accompagnante/subscription-banner'
import { AccompagnanteHeader } from '@/components/layout/accompagnante-header'
import { AvatarUpload } from '@/components/accompagnante/avatar-upload'
import { DisponibleToggle } from '@/components/accompagnante/disponible-toggle'
import { StatusBadge } from '@/components/accompagnante/status-badge'

export default async function AccompagnanteDashboard() {
  const supabase = await createClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: userData } = await supabase
    .from('users')
    .select('first_name, last_name, role, avatar_url')
    .eq('id', user.id)
    .single()

  if (!userData || userData.role !== 'accompagnante') redirect('/')

  const { data: profile } = await supabase
    .from('accompagnantes_profiles')
    .select('id, validation_status, diplomes, refus_motif, ville, rayon_km, specialites, disponible, indisponible_jusqu_au')
    .eq('user_id', user.id)
    .single()

  const unreadCount = await getUnreadCount(user.id)
  const subscription = await getSubscriptionStatus(user.id)
  const subscribed = subscription.active

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

  return (
    <main className="min-h-screen kraft bg-kraft">
      <AccompagnanteHeader
        userId={user.id}
        unreadCount={unreadCount}
        firstName={userData.first_name}
        lastName={userData.last_name}
        currentPage="dashboard"
      />

      <div className="max-w-5xl mx-auto px-4 py-8 relative z-10">
        <div className="flex flex-col items-center mb-8">
          <AvatarUpload
            currentUrl={userData.avatar_url}
            firstName={userData.first_name || ''}
            lastName={userData.last_name || ''}
            size="lg"
          />
          <div className="flex items-center gap-2 mt-3">
            <h2 className="text-xl font-bold text-gray-900">
              {userData.first_name} {userData.last_name}
            </h2>
            {profile && <StatusBadge status={profile.validation_status} />}
          </div>
          {profile?.ville && (
            <p className="text-sm text-gray-500 mt-0.5 flex items-center gap-1">
              <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M15 10.5a3 3 0 11-6 0 3 3 0 016 0z" />
                <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 10.5c0 7.142-7.5 11.25-7.5 11.25S4.5 17.642 4.5 10.5a7.5 7.5 0 1115 0z" />
              </svg>
              {profile.ville}{profile.rayon_km ? ` - ${profile.rayon_km} km` : ''}
            </p>
          )}
          {profile?.specialites && (profile.specialites as string[]).length > 0 && (
            <div className="flex flex-wrap justify-center gap-1.5 mt-2 max-w-md">
              {(profile.specialites as string[]).map((s) => (
                <span key={s} className="px-2 py-0.5 rounded-full bg-accent/20 text-xs font-medium text-gray-700">
                  {s}
                </span>
              ))}
            </div>
          )}
          {profile && (
            <div className="mt-2">
              <DisponibleToggle
                initial={profile.disponible ?? true}
                initialIndisponibleJusquAu={profile.indisponible_jusqu_au}
                compact
              />
            </div>
          )}
          <div className="flex items-center gap-1 mt-4 bg-white rounded-full border p-1">
            <span className="px-4 py-1.5 rounded-full bg-accent text-sm font-medium text-black">
              Dashboard
            </span>
            <Link
              href="/accompagnante/profil"
              className="px-4 py-1.5 rounded-full text-sm font-medium text-gray-500 hover:text-black transition"
            >
              Profil
            </Link>
          </div>
        </div>

        {!profile || !profile.diplomes || profile.diplomes.length === 0 ? (
          <div className="bg-white rounded-xl border p-6">
            <h3 className="font-semibold text-lg mb-2">Completez votre profil</h3>
            <p className="text-gray-600 mb-4">
              Pour apparaitre sur la plateforme, vous devez d&#39;abord completer votre profil professionnel.
            </p>
            <a
              href="/accompagnante/onboarding"
              className="inline-flex items-center px-4 py-2 bg-accent text-black rounded-lg btn-hover transition"
            >
              Completer mon profil
            </a>
          </div>
        ) : (
          <div className="space-y-4">
            <div className="bg-white rounded-xl border p-6">
              <div className="flex items-center gap-3 mb-2">
                <h3 className="font-semibold text-lg">Statut du profil</h3>
                <StatusBadge status={profile.validation_status} />
              </div>
              {profile.validation_status === 'en_attente' && (
                <p className="text-gray-600">
                  Votre profil est en cours de verification par notre equipe.
                </p>
              )}
              {profile.validation_status === 'valide' && (
                <p className="text-gray-600">
                  Votre profil est valide. Vous pouvez creer des annonces.
                </p>
              )}
              {profile.validation_status === 'refuse' && (
                <div>
                  <p className="text-red-800 font-medium">
                    Votre profil a ete refuse. Veuillez corriger les informations demandees.
                  </p>
                  {profile.refus_motif && (
                    <p className="text-sm text-red-700 mt-2 p-3 bg-red-50 rounded-lg">
                      Motif : {profile.refus_motif}
                    </p>
                  )}
                  <Link
                    href="/accompagnante/profil"
                    className="inline-flex items-center px-4 py-2 bg-accent text-black rounded-lg btn-hover transition text-sm font-medium mt-3"
                  >
                    Modifier mon profil
                  </Link>
                </div>
              )}
              {profile.validation_status === 'a_completer' && (
                <div>
                  <p className="text-red-800 font-medium">
                    Des informations complementaires sont demandees. Veuillez mettre a jour votre profil.
                  </p>
                  {profile.refus_motif && (
                    <p className="text-sm text-red-700 mt-2 p-3 bg-red-50 rounded-lg">
                      Details : {profile.refus_motif}
                    </p>
                  )}
                  <Link
                    href="/accompagnante/profil"
                    className="inline-flex items-center px-4 py-2 bg-accent text-black rounded-lg btn-hover transition text-sm font-medium mt-3"
                  >
                    Modifier mon profil
                  </Link>
                </div>
              )}
            </div>

            {profile.validation_status === 'valide' && !subscribed && (
              <SubscriptionBanner />
            )}

            {profile.validation_status === 'valide' && (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="bg-white rounded-xl border p-6">
                  <h3 className="font-semibold text-lg mb-2">Mes annonces</h3>
                  {subscribed ? (
                    <>
                      <p className="text-gray-600 mb-1">
                        {annoncesPubliees} annonce{annoncesPubliees > 1 ? 's' : ''} publiee{annoncesPubliees > 1 ? 's' : ''}
                      </p>
                      <p className="text-sm text-gray-400 mb-4">{annoncesCount} au total</p>
                      <Link
                        href="/accompagnante/annonces"
                        className="inline-flex items-center px-4 py-2 bg-accent text-black rounded-lg btn-hover transition text-sm font-medium"
                      >
                        Gerer mes annonces
                      </Link>
                    </>
                  ) : (
                    <p className="text-gray-500 text-sm">
                      Un abonnement est requis pour publier des annonces.
                    </p>
                  )}
                </div>
                <div className="bg-white rounded-xl border p-6">
                  <h3 className="font-semibold text-lg mb-2">Demandes accompagnes</h3>
                  <p className="text-gray-600 mb-4">
                    Consultez les demandes des accompagnes.
                  </p>
                  <Link
                    href="/recherche/demandes"
                    className="inline-flex items-center px-4 py-2 bg-accent text-black rounded-lg btn-hover transition text-sm font-medium"
                  >
                    Voir les demandes
                  </Link>
                </div>

                <div className="bg-white rounded-xl border p-6">
                  <h3 className="font-semibold text-lg mb-2">Messages</h3>
                  <p className="text-gray-600 mb-4">
                    Consultez vos conversations avec les accompagnes.
                  </p>
                  <Link
                    href="/messages"
                    className="inline-flex items-center px-4 py-2 bg-accent text-black rounded-lg btn-hover transition text-sm font-medium"
                  >
                    Voir mes messages
                  </Link>
                </div>

                <div className="bg-white rounded-xl border p-6">
                  <h3 className="font-semibold text-lg mb-2">Mon profil</h3>
                  <p className="text-gray-600 mb-4">
                    Consultez et modifiez vos informations professionnelles.
                  </p>
                  <Link
                    href="/accompagnante/profil"
                    className="inline-flex items-center px-4 py-2 bg-accent text-black rounded-lg btn-hover transition text-sm font-medium"
                  >
                    Voir mon profil
                  </Link>
                </div>

                <div className="bg-white rounded-xl border p-6">
                  <h3 className="font-semibold text-lg mb-2">Mon abonnement</h3>
                  <p className="text-gray-600 mb-4">
                    {subscription.status === 'trialing'
                      ? `Essai gratuit - Fin le ${subscription.trialEnd ? new Date(subscription.trialEnd).toLocaleDateString('fr-FR') : subscription.currentPeriodEnd ? new Date(subscription.currentPeriodEnd).toLocaleDateString('fr-FR') : '-'}`
                      : subscription.cancelAt
                        ? `Expire le ${new Date(subscription.cancelAt).toLocaleDateString('fr-FR')}`
                        : subscribed
                          ? `${subscription.planType === 'annuel' ? 'Annuel' : 'Mensuel'} - Prochaine echeance : ${subscription.currentPeriodEnd ? new Date(subscription.currentPeriodEnd).toLocaleDateString('fr-FR') : '-'}`
                          : 'Aucun abonnement actif'}
                  </p>
                  <Link
                    href="/accompagnante/abonnement"
                    className="inline-flex items-center px-4 py-2 bg-accent text-black rounded-lg btn-hover transition text-sm font-medium"
                  >
                    Gerer mon abonnement
                  </Link>
                </div>

              </div>
            )}
          </div>
        )}
      </div>
    </main>
  )
}
