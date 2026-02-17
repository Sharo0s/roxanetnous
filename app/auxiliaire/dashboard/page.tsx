import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { LogoutButton } from '@/components/auth/logout-button'
import Link from 'next/link'
import { UnreadBadge } from '@/components/layout/unread-badge'
import { getUnreadCount } from '@/lib/unread-count'
import { hasActiveSubscription } from '@/lib/subscription-helpers'
import { SubscriptionBanner } from '@/components/auxiliaire/subscription-banner'

export default async function AuxiliaireDashboard() {
  const supabase = await createClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: userData } = await supabase
    .from('users')
    .select('first_name, last_name, role')
    .eq('id', user.id)
    .single()

  if (!userData || userData.role !== 'auxiliaire') redirect('/')

  const { data: profile } = await supabase
    .from('auxiliaires_profiles')
    .select('id, validation_status, diplomes')
    .eq('user_id', user.id)
    .single()

  const unreadCount = await getUnreadCount(user.id)
  const subscribed = await hasActiveSubscription(user.id)

  let annoncesCount = 0
  let annoncesPubliees = 0
  if (profile) {
    const { count: total } = await supabase
      .from('annonces_auxiliaires')
      .select('id', { count: 'exact', head: true })
      .eq('auxiliaire_id', profile.id)
    annoncesCount = total || 0

    const { count: publiees } = await supabase
      .from('annonces_auxiliaires')
      .select('id', { count: 'exact', head: true })
      .eq('auxiliaire_id', profile.id)
      .eq('status', 'publiee')
    annoncesPubliees = publiees || 0
  }

  return (
    <main className="min-h-screen bg-gray-50">
      <header className="bg-white border-b">
        <div className="max-w-5xl mx-auto px-4 py-4 flex items-center justify-between">
          <Link href="/auxiliaire/dashboard" className="text-xl font-bold text-black">roxanetnous</Link>
          <div className="flex items-center gap-4">
            <UnreadBadge userId={user.id} initialCount={unreadCount} />
            <Link href="/auxiliaire/profil" className="text-sm text-gray-600 hover:text-black">
              Mon profil
            </Link>
            <span className="text-sm text-gray-600">
              {userData.first_name} {userData.last_name}
            </span>
            <LogoutButton />
          </div>
        </div>
      </header>

      <div className="max-w-5xl mx-auto px-4 py-8">
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
              href="/auxiliaire/onboarding"
              className="inline-flex items-center px-4 py-2 bg-black text-white rounded-lg hover:bg-gray-800 transition"
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
                <p className="text-gray-900 font-medium">
                  Votre profil a ete refuse. Veuillez corriger les informations demandees.
                </p>
              )}
              {profile.validation_status === 'a_completer' && (
                <p className="text-gray-900 font-medium">
                  Des informations complementaires sont demandees. Veuillez mettre a jour votre profil.
                </p>
              )}
            </div>

            {profile.validation_status === 'valide' && !subscribed && (
              <SubscriptionBanner />
            )}

            {profile.validation_status === 'valide' && (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="bg-white rounded-xl border p-6">
                  <h3 className="font-semibold text-lg mb-2">Mes annonces</h3>
                  <p className="text-gray-600 mb-1">
                    {annoncesPubliees} annonce{annoncesPubliees > 1 ? 's' : ''} publiee{annoncesPubliees > 1 ? 's' : ''}
                  </p>
                  <p className="text-sm text-gray-400 mb-4">{annoncesCount} au total</p>
                  <Link
                    href="/auxiliaire/annonces"
                    className="inline-flex items-center px-4 py-2 bg-black text-white rounded-lg hover:bg-gray-800 transition text-sm font-medium"
                  >
                    Gerer mes annonces
                  </Link>
                </div>
                <div className="bg-white rounded-xl border p-6">
                  <h3 className="font-semibold text-lg mb-2">Annonces beneficiaires</h3>
                  <p className="text-gray-600 mb-4">
                    Consultez les demandes des beneficiaires proches de chez vous.
                  </p>
                  <Link
                    href="/recherche/demandes"
                    className="inline-flex items-center px-4 py-2 border-2 border-black text-black rounded-lg hover:bg-gray-100 transition text-sm font-medium"
                  >
                    Voir les demandes
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
    valide: 'bg-black text-white',
    refuse: 'bg-gray-100 text-gray-900 border border-gray-300',
    a_completer: 'bg-gray-100 text-gray-700 border border-gray-300',
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
