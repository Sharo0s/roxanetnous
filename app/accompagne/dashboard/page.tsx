import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import Link from 'next/link'
import { getUnreadCount } from '@/lib/unread-count'
import { hasActiveSubscription } from '@/lib/subscription-helpers'
import { AccompagneSubscriptionBanner } from '@/components/accompagne/subscription-banner'
import { AccompagneHeader } from '@/components/layout/accompagne-header'

export default async function AccompagneDashboard() {
  const supabase = await createClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: userData } = await supabase
    .from('users')
    .select('first_name, last_name, role')
    .eq('id', user.id)
    .single()

  if (!userData || userData.role !== 'accompagne') redirect('/')

  const [unreadCount, subscribed] = await Promise.all([
    getUnreadCount(user.id),
    hasActiveSubscription(user.id),
  ])

  // Recuperer les annonces du accompagne
  const { data: profile } = await supabase
    .from('accompagnes_profiles')
    .select('id')
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

  return (
    <main className="min-h-screen kraft bg-kraft">
      <AccompagneHeader
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

        {!subscribed && (
          <div className="mb-4">
            <AccompagneSubscriptionBanner />
          </div>
        )}

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="bg-white rounded-xl border p-6">
            <h3 className="font-semibold text-lg mb-2">Rechercher un(e) accompagnant(e)</h3>
            <p className="text-gray-600 mb-4">
              Trouvez l&#39;accompagnant(e) que vous avez besoin
            </p>
            <Link
              href="/recherche"
              className="inline-flex items-center px-4 py-2 bg-accent text-black rounded-lg btn-hover transition text-sm font-medium"
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
              href="/accompagne/annonces/nouvelle"
              className="inline-flex items-center px-4 py-2 bg-accent text-black rounded-lg btn-hover transition text-sm font-medium"
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
              href="/accompagne/annonces"
              className="inline-flex items-center px-4 py-2 bg-accent text-black rounded-lg btn-hover transition text-sm font-medium"
            >
              Voir mes annonces
            </Link>
          </div>

          <div className="bg-white rounded-xl border p-6">
            <h3 className="font-semibold text-lg mb-2">Mes favoris</h3>
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

        </div>
      </div>
    </main>
  )
}
