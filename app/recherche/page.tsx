import { createClient } from '@/lib/supabase/server'
import Link from 'next/link'
import { SPECIALITES, DIPLOMES, EXPERIENCE_LEVELS } from '@/lib/constants'
import { SearchFilters } from '@/components/recherche/search-filters'
import { getBadges } from '@/lib/badges'
import { BadgesDisplay } from '@/components/badges-display'
import { AuxiliaireHeader } from '@/components/layout/auxiliaire-header'
import { BeneficiaireHeader } from '@/components/layout/beneficiaire-header'
import { getUnreadCount } from '@/lib/unread-count'
import { calculateMatchScore } from '@/lib/matching'
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
  annonce?: string
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
        diplomes,
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
  // Use service role to bypass RLS (beneficiaire can't read other users' subscriptions)
  const supabaseAdmin = await createClient({ serviceRole: true })
  let annonces = rawAnnonces || []
  if (annonces.length > 0) {
    const userIds = annonces.map((a: any) => a.auxiliaires_profiles?.user_id).filter(Boolean)
    const { data: activeSubs } = await supabaseAdmin
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

  // Matching pour les beneficiaires avec annonce publiee
  type ScoredAnnonce = {
    annonce: any
    score: number
    details: Record<string, number>
  }
  let matchResults: ScoredAnnonce[] = []
  let matchAnnonce: any = null

  let allBenAnnonces: any[] = []

  if (userData?.role === 'beneficiaire' && user) {
    const { data: benProfile } = await supabase
      .from('beneficiaires_profiles')
      .select('id')
      .eq('user_id', user.id)
      .single()

    if (benProfile) {
      const { data: mesAnnonces } = await supabase
        .from('annonces_beneficiaires')
        .select('id, titre, specialites_recherchees, ville, code_postal, latitude, longitude, diplome_requis, experience_min, disponibilites')
        .eq('beneficiaire_id', benProfile.id)
        .eq('status', 'publiee')
        .order('created_at', { ascending: false })

      allBenAnnonces = mesAnnonces || []

      if (allBenAnnonces.length > 0) {
        const selectedId = params.annonce || allBenAnnonces[0].id
        matchAnnonce = allBenAnnonces.find((a) => a.id === selectedId) || allBenAnnonces[0]
        const criteria = {
          specialites_recherchees: (matchAnnonce.specialites_recherchees as string[]) || [],
          ville: matchAnnonce.ville,
          code_postal: matchAnnonce.code_postal || undefined,
          experience_min: matchAnnonce.experience_min || undefined,
          diplome_requis: matchAnnonce.diplome_requis || undefined,
          disponibilites: (matchAnnonce.disponibilites as Record<string, string[]>) || undefined,
          latitude: matchAnnonce.latitude ? Number(matchAnnonce.latitude) : undefined,
          longitude: matchAnnonce.longitude ? Number(matchAnnonce.longitude) : undefined,
        }

        matchResults = annonces.map((a: any) => {
          const auxProfile = a.auxiliaires_profiles
          const { score, details } = calculateMatchScore(
            {
              specialites: auxProfile.specialites || [],
              ville: auxProfile.ville || a.ville,
              code_postal: auxProfile.code_postal || a.code_postal,
              experience: auxProfile.experience,
              diplomes: auxProfile.diplomes || [],
              disponibilites: (a.disponibilites || auxProfile.disponibilites) as Record<string, string[]>,
              rayon_km: a.rayon_km || auxProfile.rayon_km || 10,
              latitude: auxProfile.latitude ? Number(auxProfile.latitude) : undefined,
              longitude: auxProfile.longitude ? Number(auxProfile.longitude) : undefined,
            },
            criteria
          )
          return { annonce: a, score, details }
        })

        matchResults.sort((a, b) => b.score - a.score)
        matchResults = matchResults.slice(0, 6)
      }
    }
  }

  const unreadCount = user ? await getUnreadCount(user.id) : 0

  // Manual pagination after filtering
  const count = annonces.length
  const paginatedAnnonces = annonces.slice(from, to + 1)
  const totalPages = count ? Math.ceil(count / perPage) : 1

  return (
    <main className="min-h-screen bg-gray-50">
      {userData?.role === 'auxiliaire' && user ? (
        <AuxiliaireHeader
          userId={user.id}
          unreadCount={unreadCount}
          firstName={userData.first_name}
          lastName={userData.last_name}
          currentPage="other"
        />
      ) : userData?.role === 'beneficiaire' && user ? (
        <BeneficiaireHeader
          userId={user.id}
          unreadCount={unreadCount}
          firstName={userData.first_name}
          lastName={userData.last_name}
          currentPage="other"
        />
      ) : (
        <header className="bg-white border-b">
          <div className="max-w-6xl mx-auto px-4 py-4 flex items-center justify-between">
            <Link href="/" className="text-xl font-bold text-black">
              roxanetnous
            </Link>
            <div className="flex items-center gap-4">
              <Link href="/login" className="text-sm text-gray-600 hover:text-black">
                Connexion
              </Link>
              <Link
                href="/register"
                className="text-sm px-4 py-2 bg-black text-white rounded-lg hover:bg-gray-800 transition"
              >
                Inscription
              </Link>
            </div>
          </div>
        </header>
      )}

      <div className="max-w-6xl mx-auto px-4 py-8">
        <h2 className="text-2xl font-bold text-gray-900 mb-6">Trouver un auxiliaire de vie</h2>

        <SearchFilters
          currentVille={params.ville || ''}
          currentSpecialite={params.specialite || ''}
          currentExperience={params.experience || ''}
        />

        {matchResults.length > 0 && matchAnnonce && (
          <div className="mt-6 mb-8">
            <div className="flex items-center justify-between mb-4">
              <div>
                <h3 className="text-lg font-semibold text-gray-900">Vos meilleurs matchs</h3>
                {allBenAnnonces.length > 1 ? (
                  <form className="flex items-center gap-2 mt-1">
                    <label className="text-xs text-gray-500">Annonce de reference :</label>
                    <select
                      name="annonce"
                      defaultValue={matchAnnonce.id}
                      className="rounded-lg border border-gray-300 bg-white px-2 py-1 text-xs focus:outline-none focus:ring-2 focus:ring-black"
                    >
                      {allBenAnnonces.map((a: any) => (
                        <option key={a.id} value={a.id}>{a.titre}</option>
                      ))}
                    </select>
                    <button
                      type="submit"
                      className="px-3 py-1 bg-black text-white rounded-lg text-xs hover:bg-gray-800 transition"
                    >
                      Actualiser
                    </button>
                  </form>
                ) : (
                  <p className="text-xs text-gray-500">
                    Bases sur votre annonce : {matchAnnonce.titre}
                  </p>
                )}
              </div>
            </div>
            <div className="space-y-3">
              {matchResults.map(({ annonce, score, details }) => {
                const profile = annonce.auxiliaires_profiles
                const u = profile?.users
                const diplomeLabel = (profile?.diplomes as string[] || []).map((d: string) => DIPLOMES.find((dp) => dp.value === d)?.label || d).join(', ')
                const expLabel = EXPERIENCE_LEVELS.find((e) => e.value === profile?.experience)?.label || profile?.experience
                const specs = (profile?.specialites as string[] || []).slice(0, 3)

                return (
                  <Link
                    key={`match-${annonce.id}`}
                    href={`/recherche/${annonce.id}`}
                    className="bg-white rounded-xl border-2 border-gray-200 hover:border-black transition block"
                  >
                    <div className="flex">
                      <div className="flex-1 min-w-0 p-5">
                        <div className="flex items-center gap-3 mb-3">
                          <div className="w-10 h-10 rounded-full bg-gray-200 flex items-center justify-center text-sm font-bold text-gray-600 flex-shrink-0">
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

                        <p className="text-sm text-gray-600 line-clamp-2 mb-2">{annonce.description}</p>

                        <div className="flex flex-wrap gap-1 mb-2">
                          {specs.map((s: string) => (
                            <span key={s} className="px-2 py-0.5 bg-gray-100 text-gray-600 rounded-full text-xs">
                              {SPECIALITES.find((sp) => sp.value === s)?.label || s}
                            </span>
                          ))}
                        </div>

                        <div className="flex items-center justify-between text-xs text-gray-500">
                          <span>{annonce.ville} ({annonce.code_postal})</span>
                          <span>{expLabel}</span>
                        </div>
                      </div>

                      <div className="w-48 flex-shrink-0 border-l border-gray-200 p-4 flex flex-col items-center justify-center bg-gray-50 rounded-r-xl">
                        <div className={`w-12 h-12 rounded-full flex items-center justify-center text-lg font-bold mb-3 ${
                          score >= 70 ? 'bg-black text-white' :
                          score >= 40 ? 'bg-gray-300 text-gray-700' :
                          'bg-gray-100 text-gray-400'
                        }`}>
                          {score}
                        </div>
                        <div className="w-full space-y-1 text-xs">
                          <div className="flex justify-between text-gray-500">
                            <span>Specialites</span>
                            <span className="font-medium text-gray-700">{details.specialites}/40</span>
                          </div>
                          <div className="flex justify-between text-gray-500">
                            <span>Localisation</span>
                            <span className="font-medium text-gray-700">{details.localisation}/25</span>
                          </div>
                          <div className="flex justify-between text-gray-500">
                            <span>Experience</span>
                            <span className="font-medium text-gray-700">{details.experience}/15</span>
                          </div>
                          <div className="flex justify-between text-gray-500">
                            <span>Diplome</span>
                            <span className="font-medium text-gray-700">{details.diplome}/10</span>
                          </div>
                          <div className="flex justify-between text-gray-500">
                            <span>Disponibilites</span>
                            <span className="font-medium text-gray-700">{details.disponibilites}/10</span>
                          </div>
                        </div>
                      </div>
                    </div>
                  </Link>
                )
              })}
            </div>
          </div>
        )}

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
                const diplomeLabel = (profile?.diplomes as string[] || []).map((d: string) => DIPLOMES.find((dp) => dp.value === d)?.label || d).join(', ')
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

                    <p className="text-sm text-gray-600 line-clamp-3 mb-3">{annonce.description}</p>

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
                      <span>Experience : {expLabel}</span>
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
