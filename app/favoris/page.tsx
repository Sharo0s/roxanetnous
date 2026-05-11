import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import Link from 'next/link'
import { SPECIALITES, DIPLOMES } from '@/lib/constants'
import { AccompagnanteDashboardHeader } from '@/components/layout/accompagnante-dashboard-header'
import { AccompagneDashboardHeader } from '@/components/layout/accompagne-dashboard-header'
import { getUnreadCount } from '@/lib/unread-count'

export default async function FavorisPage() {
  const supabase = await createClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: userData } = await supabase
    .from('users')
    .select('first_name, last_name, role')
    .eq('id', user.id)
    .single()

  if (!userData) redirect('/')

  const { data: favoris } = await supabase
    .from('favoris')
    .select(`
      id,
      annonce_accompagnante_id,
      annonce_accompagne_id,
      created_at,
      annonces_accompagnantes:annonce_accompagnante_id (
        id, description, ville, code_postal, status,
        accompagnantes_profiles:accompagnante_id (
          diplomes, experience, specialites,
          users:user_id (first_name, last_name)
        )
      ),
      annonces_accompagnes:annonce_accompagne_id (
        id, titre, description, ville, code_postal, status,
        specialites_recherchees, date_debut
      )
    `)
    .eq('user_id', user.id)
    .order('created_at', { ascending: false })

  const unreadCount = await getUnreadCount(user.id)

  return (
    <main id="main-content" tabIndex={-1} className="min-h-screen bg-[#fefaf8] focus:outline-none">
      {userData.role === 'accompagnante' ? (
        <AccompagnanteDashboardHeader
          firstName={userData.first_name}
          lastName={userData.last_name}
          unreadCount={unreadCount}
          currentPage="other"
        />
      ) : (
        <AccompagneDashboardHeader
          firstName={userData.first_name}
          lastName={userData.last_name}
          unreadCount={unreadCount}
          currentPage="favoris"
        />
      )}

      <div className="max-w-5xl mx-auto px-4 py-10 md:py-14 relative z-10">
        <header className="text-center mb-8">
          <span className="inline-block text-[11px] uppercase tracking-[0.18em] text-kraft font-medium mb-2">
            {userData.role === 'accompagnante' ? 'Mon espace' : 'Votre espace'}
          </span>
          <h1 className="text-3xl md:text-4xl italic text-gray-900 leading-tight">Mes favoris</h1>
        </header>

        {!favoris || favoris.length === 0 ? (
          <div className="bg-white rounded-2xl border border-[#e8dfd2] p-12 text-center">
            <p className="text-gray-600 mb-4">Aucun favori pour le moment.</p>
            <Link href="/recherche" className="inline-flex items-center gap-1 text-sm text-kraft hover:text-gray-900">
              Rechercher un accompagnant <span aria-hidden="true">→</span>
            </Link>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {favoris.map((fav: any) => {
              if (fav.annonces_accompagnantes) {
                const annonce = fav.annonces_accompagnantes
                const profile = annonce.accompagnantes_profiles
                const u = profile?.users
                const diplomeLabel = (profile?.diplomes as string[] || []).map((d: string) => DIPLOMES.find((dp) => dp.value === d)?.label || d).join(', ')

                return (
                  <Link
                    key={fav.id}
                    href={`/recherche/${annonce.id}`}
                    className="bg-white rounded-2xl border border-[#e8dfd2] p-5 hover:border-kraft transition block"
                  >
                    <div className="flex items-center gap-3 mb-3">
                      <div className="w-10 h-10 rounded-full bg-gray-200 flex items-center justify-center text-sm font-bold text-gray-600">
                        {u?.first_name?.[0]}{u?.last_name?.[0]}
                      </div>
                      <div>
                        <p className="font-semibold text-gray-900">
                          {u?.first_name} {u?.last_name?.[0]}.
                        </p>
                        <p className="text-xs text-gray-500">{diplomeLabel}</p>
                      </div>
                    </div>
                    <p className="text-sm text-gray-600 line-clamp-2 mb-2">{annonce.description}</p>
                    <p className="text-sm text-gray-500">
                      {annonce.ville} ({annonce.code_postal})
                    </p>
                    {annonce.status !== 'publiee' && (
                      <span className="inline-block mt-2 px-2 py-0.5 bg-gray-200 text-gray-600 rounded-full text-xs">
                        Archivée
                      </span>
                    )}
                  </Link>
                )
              }

              if (fav.annonces_accompagnes) {
                const annonce = fav.annonces_accompagnes
                const specLabels = (annonce.specialites_recherchees as string[] || []).slice(0, 3).map(
                  (s: string) => SPECIALITES.find((sp) => sp.value === s)?.label || s
                )

                return (
                  <div key={fav.id} className="bg-white rounded-2xl border border-[#e8dfd2] p-5">
                    <h3 className="font-semibold text-gray-900 mb-1 line-clamp-1">{annonce.titre}</h3>
                    <p className="text-sm text-gray-500 mb-2">
                      {annonce.ville} {annonce.code_postal && `(${annonce.code_postal})`}
                    </p>
                    <div className="flex flex-wrap gap-1">
                      {specLabels.map((label: string, i: number) => (
                        <span key={i} className="px-2 py-0.5 bg-gray-100 text-gray-600 rounded-full text-xs">
                          {label}
                        </span>
                      ))}
                    </div>
                    {annonce.status !== 'publiee' && (
                      <span className="inline-block mt-2 px-2 py-0.5 bg-gray-200 text-gray-600 rounded-full text-xs">
                        Archivée
                      </span>
                    )}
                  </div>
                )
              }

              return null
            })}
          </div>
        )}
      </div>
    </main>
  )
}
