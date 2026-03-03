import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import Link from 'next/link'
import { getUnreadCount } from '@/lib/unread-count'
import { hasActiveSubscription } from '@/lib/subscription-helpers'
import { canAccessPlanning } from '@/lib/planning-subscription-helpers'
import { BeneficiaireSubscriptionBanner } from '@/components/beneficiaire/subscription-banner'
import { BeneficiaireHeader } from '@/components/layout/beneficiaire-header'

export default async function BeneficiaireDashboard() {
  const supabase = await createClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: userData } = await supabase
    .from('users')
    .select('first_name, last_name, role')
    .eq('id', user.id)
    .single()

  if (!userData || userData.role !== 'beneficiaire') redirect('/')

  const [unreadCount, subscribed, hasPlanning] = await Promise.all([
    getUnreadCount(user.id),
    hasActiveSubscription(user.id),
    canAccessPlanning(user.id),
  ])

  // Recuperer les annonces du beneficiaire
  const { data: profile } = await supabase
    .from('beneficiaires_profiles')
    .select('id')
    .eq('user_id', user.id)
    .single()

  let annoncesCount = 0
  let planningTeamCount = 0
  let planningShiftsCount = 0

  if (profile) {
    const { count } = await supabase
      .from('annonces_beneficiaires')
      .select('id', { count: 'exact', head: true })
      .eq('beneficiaire_id', profile.id)
    annoncesCount = count || 0

    if (hasPlanning) {
      const { count: teamCount } = await supabase
        .from('beneficiaire_auxiliaires')
        .select('id', { count: 'exact', head: true })
        .eq('beneficiaire_id', profile.id)
        .eq('actif', true)
      planningTeamCount = teamCount || 0

      // Shifts cette semaine
      const now = new Date()
      const day = now.getDay()
      const monday = new Date(now)
      monday.setDate(now.getDate() - day + (day === 0 ? -6 : 1))
      const sunday = new Date(monday)
      sunday.setDate(monday.getDate() + 6)

      const { count: shiftsCount } = await supabase
        .from('planning_shifts')
        .select('id', { count: 'exact', head: true })
        .eq('beneficiaire_id', profile.id)
        .gte('date', monday.toISOString().split('T')[0])
        .lte('date', sunday.toISOString().split('T')[0])
      planningShiftsCount = shiftsCount || 0
    }
  }

  return (
    <main className="min-h-screen bg-gray-50">
      <BeneficiaireHeader
        userId={user.id}
        unreadCount={unreadCount}
        firstName={userData.first_name}
        lastName={userData.last_name}
        currentPage="dashboard"
        hasPlanningSubscription={hasPlanning}
      />

      <div className="max-w-5xl mx-auto px-4 py-8">
        <h2 className="text-2xl font-bold text-gray-900 mb-6">
          Bonjour {userData.first_name}
        </h2>

        {!subscribed && (
          <div className="mb-4">
            <BeneficiaireSubscriptionBanner />
          </div>
        )}

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="bg-white rounded-xl border p-6">
            <h3 className="font-semibold text-lg mb-2">Rechercher un auxiliaire</h3>
            <p className="text-gray-600 mb-4">
              Trouvez l&#39;auxiliaire de vie ideal grace au matching intelligent.
            </p>
            <Link
              href="/recherche"
              className="inline-flex items-center px-4 py-2 bg-black text-white rounded-lg hover:bg-gray-800 transition text-sm font-medium"
            >
              Rechercher
            </Link>
          </div>

          <div className="bg-white rounded-xl border p-6">
            <h3 className="font-semibold text-lg mb-2">Publier une annonce</h3>
            <p className="text-gray-600 mb-4">
              Decrivez vos besoins et recevez des candidatures.
            </p>
            <Link
              href="/beneficiaire/annonces/nouvelle"
              className="inline-flex items-center px-4 py-2 border-2 border-black text-black rounded-lg hover:bg-gray-100 transition text-sm font-medium"
            >
              Creer une annonce
            </Link>
          </div>

          <div className="bg-white rounded-xl border p-6">
            <h3 className="font-semibold text-lg mb-2">Mes annonces</h3>
            <p className="text-gray-600 mb-1">
              {annoncesCount} annonce{annoncesCount > 1 ? 's' : ''} publiee{annoncesCount > 1 ? 's' : ''}
            </p>
            <p className="text-sm text-gray-400 mb-4">Gerez vos annonces de recherche.</p>
            <Link
              href="/beneficiaire/annonces"
              className="inline-flex items-center px-4 py-2 border-2 border-black text-black rounded-lg hover:bg-gray-100 transition text-sm font-medium"
            >
              Voir mes annonces
            </Link>
          </div>

          <div className="bg-white rounded-xl border p-6">
            <h3 className="font-semibold text-lg mb-2">Mes favoris</h3>
            <p className="text-gray-600 mb-4">
              Retrouvez les profils que vous avez mis en favori.
            </p>
            <Link
              href="/favoris"
              className="inline-flex items-center px-4 py-2 border-2 border-black text-black rounded-lg hover:bg-gray-100 transition text-sm font-medium"
            >
              Voir mes favoris
            </Link>
          </div>

          <div className="bg-white rounded-xl border p-6">
            <h3 className="font-semibold text-lg mb-2">Planning</h3>
            {hasPlanning ? (
              <>
                <p className="text-gray-600 mb-1">
                  {planningTeamCount} auxiliaire{planningTeamCount > 1 ? 's' : ''}, {planningShiftsCount} creneau{planningShiftsCount > 1 ? 'x' : ''} cette semaine
                </p>
                <p className="text-sm text-gray-400 mb-4">Gerez les interventions de vos auxiliaires.</p>
                <Link
                  href="/beneficiaire/planning"
                  className="inline-flex items-center px-4 py-2 bg-black text-white rounded-lg hover:bg-gray-800 transition text-sm font-medium"
                >
                  Acceder au planning
                </Link>
              </>
            ) : (
              <>
                <p className="text-gray-600 mb-4">
                  Organisez les interventions de vos auxiliaires de vie.
                </p>
                <Link
                  href="/beneficiaire/planning/abonnement"
                  className="inline-flex items-center px-4 py-2 border-2 border-black text-black rounded-lg hover:bg-gray-100 transition text-sm font-medium"
                >
                  Decouvrir le module
                </Link>
              </>
            )}
          </div>
        </div>
      </div>
    </main>
  )
}
