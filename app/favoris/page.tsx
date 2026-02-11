import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { LogoutButton } from '@/components/auth/logout-button'
import Link from 'next/link'
import { SPECIALITES, DIPLOMES, EXPERIENCE_LEVELS } from '@/lib/constants'

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
      annonce_auxiliaire_id,
      annonce_beneficiaire_id,
      created_at,
      annonces_auxiliaires:annonce_auxiliaire_id (
        id, titre, description, ville, code_postal, status,
        auxiliaires_profiles:auxiliaire_id (
          diplome, experience, specialites,
          users:user_id (first_name, last_name)
        )
      ),
      annonces_beneficiaires:annonce_beneficiaire_id (
        id, titre, description, ville, code_postal, status,
        specialites_recherchees, date_debut
      )
    `)
    .eq('user_id', user.id)
    .order('created_at', { ascending: false })

  const dashboardUrl = userData.role === 'auxiliaire' ? '/auxiliaire/dashboard' : '/beneficiaire/dashboard'

  return (
    <main className="min-h-screen bg-gray-50">
      <header className="bg-white border-b">
        <div className="max-w-5xl mx-auto px-4 py-4 flex items-center justify-between">
          <Link href={dashboardUrl} className="text-xl font-bold text-black">
            roxanetnous
          </Link>
          <div className="flex items-center gap-4">
            <Link href="/messages" className="text-sm text-gray-600 hover:text-black">
              Messages
            </Link>
            <span className="text-sm text-gray-600">
              {userData.first_name} {userData.last_name}
            </span>
            <LogoutButton />
          </div>
        </div>
      </header>

      <div className="max-w-5xl mx-auto px-4 py-8">
        <h2 className="text-2xl font-bold text-gray-900 mb-6">Mes favoris</h2>

        {!favoris || favoris.length === 0 ? (
          <div className="bg-white rounded-xl border p-8 text-center">
            <p className="text-gray-500 mb-4">Aucun favori pour le moment.</p>
            <Link href="/recherche" className="text-sm text-black underline">
              Rechercher des auxiliaires
            </Link>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {favoris.map((fav: any) => {
              if (fav.annonces_auxiliaires) {
                const annonce = fav.annonces_auxiliaires
                const profile = annonce.auxiliaires_profiles
                const u = profile?.users
                const diplomeLabel = DIPLOMES.find((d) => d.value === profile?.diplome)?.label || profile?.diplome

                return (
                  <Link
                    key={fav.id}
                    href={`/recherche/${annonce.id}`}
                    className="bg-white rounded-xl border p-5 hover:border-black transition block"
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
                    <h3 className="font-medium text-gray-900 mb-1 line-clamp-1">{annonce.titre}</h3>
                    <p className="text-sm text-gray-500">
                      {annonce.ville} ({annonce.code_postal})
                    </p>
                    {annonce.status !== 'publiee' && (
                      <span className="inline-block mt-2 px-2 py-0.5 bg-gray-200 text-gray-600 rounded-full text-xs">
                        Archivee
                      </span>
                    )}
                  </Link>
                )
              }

              if (fav.annonces_beneficiaires) {
                const annonce = fav.annonces_beneficiaires
                const specLabels = (annonce.specialites_recherchees as string[] || []).slice(0, 3).map(
                  (s: string) => SPECIALITES.find((sp) => sp.value === s)?.label || s
                )

                return (
                  <div key={fav.id} className="bg-white rounded-xl border p-5">
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
                        Archivee
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
