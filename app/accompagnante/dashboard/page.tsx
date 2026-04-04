import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import Link from 'next/link'
import { getUnreadCount } from '@/lib/unread-count'
import { hasActiveSubscription } from '@/lib/subscription-helpers'
import { SubscriptionBanner } from '@/components/accompagnante/subscription-banner'
import { AccompagnanteHeader } from '@/components/layout/accompagnante-header'

export default async function AccompagnanteDashboard() {
  const supabase = await createClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: userData } = await supabase
    .from('users')
    .select('first_name, last_name, role')
    .eq('id', user.id)
    .single()

  if (!userData || userData.role !== 'accompagnante') redirect('/')

  const { data: profile } = await supabase
    .from('accompagnantes_profiles')
    .select('id, validation_status, diplomes, refus_motif')
    .eq('user_id', user.id)
    .single()

  const unreadCount = await getUnreadCount(user.id)
  const subscribed = await hasActiveSubscription(user.id)

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
        <h2 className="text-2xl font-bold text-gray-900 mb-6">
          Bonjour {userData.first_name}
        </h2>

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

              </div>
            )}
          </div>
        )}
      </div>
    </main>
  )
}

function StatusBadge({ status }: { status: string }) {
  const styles: Record<string, string> = {
    en_attente: 'bg-gray-200 text-gray-700',
    valide: 'bg-accent text-black',
    refuse: 'bg-red-50 text-red-800 border border-red-200',
    a_completer: 'bg-red-50 text-red-800 border border-red-200',
  }

  const labels: Record<string, string> = {
    en_attente: 'En attente',
    valide: 'Valide',
    refuse: 'Refuse',
    a_completer: 'A completer',
  }

  return (
    <span className={`px-2 py-1 rounded-full text-xs font-medium ${styles[status] || 'bg-gray-100 text-gray-600'}`}>
      {labels[status] || status}
    </span>
  )
}
