import { createClient } from '@/lib/supabase/server'
import Link from 'next/link'
import { SPECIALITES, DIPLOMES, EXPERIENCE_LEVELS } from '@/lib/constants'
import { SearchFilters } from '@/components/recherche/search-filters'
import { getBadges } from '@/lib/badges'
import { BadgesDisplay } from '@/components/badges-display'
import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'Rechercher un auxiliaire de vie',
  description: 'Trouvez un auxiliaire de vie verifie pres de chez vous. Filtrez par specialite, localisation et experience.',
}

type SearchParams = {
  ville?: string
  specialite?: string
  experience?: string
  page?: string
}

export default async function RecherchePage({
  searchParams,
}: {
  searchParams: Promise<SearchParams>
}) {
  const params = await searchParams
  const supabase = await createClient()

  // Optionnellement recuperer l'utilisateur pour personnaliser
  const { data: { user } } = await supabase.auth.getUser()

  let userData = null
  if (user) {
    const { data } = await supabase
      .from('users')
      .select('first_name, last_name, role')
      .eq('id', user.id)
      .single()
    userData = data
  }

  // Requete les annonces auxiliaires publiees
  // On utilise le client normal (RLS applique)
  let query = supabase
    .from('annonces_auxiliaires')
    .select(`
      *,
      auxiliaires_profiles!inner (
        diplome,
        experience,
        specialites,
        description,
        permis_conduire,
        vehicule,
        validation_status,
        user_id,
        users:user_id (first_name, last_name)
      )
    `)
    .eq('status', 'publiee')
    .eq('auxiliaires_profiles.validation_status', 'valide')
    .order('published_at', { ascending: false })

  // Filtre par ville
  if (params.ville) {
    query = query.ilike('ville', `%${params.ville}%`)
  }

  // Filtre par specialite
  if (params.specialite) {
    query = query.contains('auxiliaires_profiles.specialites', [params.specialite])
  }

  // Filtre par experience
  if (params.experience) {
    query = query.eq('auxiliaires_profiles.experience', params.experience)
  }

  const page = Number(params.page) || 1
  const perPage = 12
  const from = (page - 1) * perPage
  const to = from + perPage - 1

  const { data: rawAnnonces } = await query

  // Filter to only show auxiliaires with active subscription
  let annonces = rawAnnonces || []
  if (annonces.length > 0) {
    const userIds = annonces.map((a: any) => a.auxiliaires_profiles?.user_id).filter(Boolean)
    const { data: activeSubs } = await supabase
      .from('subscriptions')
      .select('user_id')
      .in('user_id', userIds)
      .in('status', ['active', 'trialing'])
      .gte('current_period_end', new Date().toISOString())

    const activeUserIds = new Set((activeSubs || []).map((s) => s.user_id))
    annonces = annonces.filter((a: any) => activeUserIds.has(a.auxiliaires_profiles?.user_id))
  }

  // Fetch des badges
  const badgeUserIds = annonces.map((a: any) => a.auxiliaires_profiles?.user_id).filter(Boolean)
  const badgesMap = await getBadges(badgeUserIds)

  // Manual pagination after filtering
  const count = annonces.length
  const paginatedAnnonces = annonces.slice(from, to + 1)
  const totalPages = count ? Math.ceil(count / perPage) : 1

  return (
    <main className="min-h-screen bg-gray-50">
      <header className="bg-white border-b">
        <div className="max-w-6xl mx-auto px-4 py-4 flex items-center justify-between">
          <Link href="/" className="text-xl font-bold text-black">
            roxanetnous
          </Link>
          <div className="flex items-center gap-4">
            {userData ? (
              <Link
                href={userData.role === 'auxiliaire' ? '/auxiliaire/dashboard' : '/beneficiaire/dashboard'}
                className="text-sm text-gray-600 hover:text-black"
              >
                Mon espace
              </Link>
            ) : (
              <>
                <Link href="/login" className="text-sm text-gray-600 hover:text-black">
                  Connexion
                </Link>
                <Link
                  href="/register"
                  className="text-sm px-4 py-2 bg-black text-white rounded-lg hover:bg-gray-800 transition"
                >
                  Inscription
                </Link>
              </>
            )}
          </div>
        </div>
      </header>

      <div className="max-w-6xl mx-auto px-4 py-8">
        <h2 className="text-2xl font-bold text-gray-900 mb-6">Trouver un auxiliaire de vie</h2>

        <SearchFilters
          currentVille={params.ville || ''}
          currentSpecialite={params.specialite || ''}
          currentExperience={params.experience || ''}
        />

        {!paginatedAnnonces || paginatedAnnonces.length === 0 ? (
          <div className="bg-white rounded-xl border p-8 text-center mt-6">
            <p className="text-gray-500">Aucun resultat pour votre recherche.</p>
            {(params.ville || params.specialite || params.experience) && (
              <Link href="/recherche" className="text-sm text-black underline mt-2 inline-block">
                Voir tous les auxiliaires
              </Link>
            )}
          </div>
        ) : (
          <>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 mt-6">
              {paginatedAnnonces.map((annonce: any) => {
                const profile = annonce.auxiliaires_profiles
                const u = profile?.users
                const diplomeLabel = DIPLOMES.find((d) => d.value === profile?.diplome)?.label || profile?.diplome
                const expLabel = EXPERIENCE_LEVELS.find((e) => e.value === profile?.experience)?.label || profile?.experience
                const specs = (profile?.specialites as string[] || []).slice(0, 3)

                return (
                  <Link
                    key={annonce.id}
                    href={`/recherche/${annonce.id}`}
                    className="bg-white rounded-xl border p-5 hover:border-black transition block"
                  >
                    <div className="flex items-center gap-3 mb-3">
                      <div className="w-10 h-10 rounded-full bg-gray-200 flex items-center justify-center text-sm font-bold text-gray-600">
                        {u?.first_name?.[0]}{u?.last_name?.[0]}
                      </div>
                      <div>
                        <div className="flex items-center gap-2">
                          <p className="font-semibold text-gray-900">
                            {u?.first_name} {u?.last_name?.[0]}.
                          </p>
                          <BadgesDisplay badges={badgesMap[profile?.user_id]} />
                        </div>
                        <p className="text-xs text-gray-500">{diplomeLabel}</p>
                      </div>
                    </div>

                    <h3 className="font-medium text-gray-900 mb-1 line-clamp-1">{annonce.titre}</h3>
                    <p className="text-sm text-gray-600 line-clamp-2 mb-3">{annonce.description}</p>

                    <div className="flex flex-wrap gap-1 mb-3">
                      {specs.map((s: string) => (
                        <span key={s} className="px-2 py-0.5 bg-gray-100 text-gray-600 rounded-full text-xs">
                          {SPECIALITES.find((sp) => sp.value === s)?.label || s}
                        </span>
                      ))}
                      {(profile?.specialites?.length || 0) > 3 && (
                        <span className="px-2 py-0.5 bg-gray-100 text-gray-600 rounded-full text-xs">
                          +{profile.specialites.length - 3}
                        </span>
                      )}
                    </div>

                    <div className="flex items-center justify-between text-xs text-gray-500">
                      <span>{annonce.ville} ({annonce.code_postal})</span>
                      <span>{expLabel}</span>
                    </div>

                    {(profile?.permis_conduire || profile?.vehicule) && (
                      <div className="flex gap-2 mt-2">
                        {profile.permis_conduire && (
                          <span className="text-xs text-gray-500">Permis B</span>
                        )}
                        {profile.vehicule && (
                          <span className="text-xs text-gray-500">Vehicule</span>
                        )}
                      </div>
                    )}
                  </Link>
                )
              })}
            </div>

            {totalPages > 1 && (
              <div className="flex justify-center gap-2 mt-8">
                {page > 1 && (
                  <Link
                    href={`/recherche?${new URLSearchParams({ ...params, page: String(page - 1) }).toString()}`}
                    className="px-4 py-2 border border-gray-300 rounded-lg text-sm hover:border-black transition"
                  >
                    Precedent
                  </Link>
                )}
                <span className="px-4 py-2 text-sm text-gray-500">
                  Page {page} sur {totalPages}
                </span>
                {page < totalPages && (
                  <Link
                    href={`/recherche?${new URLSearchParams({ ...params, page: String(page + 1) }).toString()}`}
                    className="px-4 py-2 border border-gray-300 rounded-lg text-sm hover:border-black transition"
                  >
                    Suivant
                  </Link>
                )}
              </div>
            )}
          </>
        )}
      </div>
    </main>
  )
}
