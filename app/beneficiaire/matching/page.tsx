import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import Link from 'next/link'
import { SPECIALITES, DIPLOMES, EXPERIENCE_LEVELS } from '@/lib/constants'
import { calculateMatchScore } from '@/lib/matching'
import { getBadges } from '@/lib/badges'
import { BadgesDisplay } from '@/components/badges-display'
import { BeneficiaireHeader } from '@/components/layout/beneficiaire-header'
import { getUnreadCount } from '@/lib/unread-count'

export default async function MatchingPage({
  searchParams,
}: {
  searchParams: Promise<{ annonce?: string }>
}) {
  const params = await searchParams
  const supabase = await createClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: userData } = await supabase
    .from('users')
    .select('first_name, last_name, role')
    .eq('id', user.id)
    .single()

  if (!userData || userData.role !== 'beneficiaire') redirect('/')

  const { data: profile } = await supabase
    .from('beneficiaires_profiles')
    .select('id')
    .eq('user_id', user.id)
    .single()

  if (!profile) redirect('/beneficiaire/dashboard')

  // Recuperer les annonces du beneficiaire
  const { data: mesAnnonces } = await supabase
    .from('annonces_beneficiaires')
    .select('id, titre, specialites_recherchees, ville, code_postal, latitude, longitude, diplome_requis, experience_min, disponibilites')
    .eq('beneficiaire_id', profile.id)
    .eq('status', 'publiee')
    .order('created_at', { ascending: false })

  const selectedAnnonceId = params.annonce || mesAnnonces?.[0]?.id

  const selectedAnnonce = mesAnnonces?.find((a) => a.id === selectedAnnonceId)

  // Recuperer les auxiliaires valides avec annonce publiee
  const { data: auxAnnonces } = await supabase
    .from('annonces_auxiliaires')
    .select(`
      id, titre, description, ville, code_postal, rayon_km, disponibilites,
      auxiliaires_profiles:auxiliaire_id!inner (
        id, user_id, diplomes, experience, specialites, ville, code_postal, rayon_km,
        latitude, longitude, disponibilites, validation_status,
        users:user_id (first_name, last_name)
      )
    `)
    .eq('status', 'publiee')
    .eq('auxiliaires_profiles.validation_status', 'valide')

  // Calculer les scores de matching
  type ScoredAnnonce = {
    annonce: any
    score: number
    details: Record<string, number>
  }

  let scoredResults: ScoredAnnonce[] = []
  let badgesMap: Record<string, any> = {}

  if (selectedAnnonce && auxAnnonces) {
    const criteria = {
      specialites_recherchees: selectedAnnonce.specialites_recherchees as string[],
      ville: selectedAnnonce.ville,
      code_postal: selectedAnnonce.code_postal || undefined,
      experience_min: selectedAnnonce.experience_min || undefined,
      diplome_requis: selectedAnnonce.diplome_requis || undefined,
      disponibilites: (selectedAnnonce.disponibilites as Record<string, string[]>) || undefined,
      latitude: (selectedAnnonce as any).latitude ? Number((selectedAnnonce as any).latitude) : undefined,
      longitude: (selectedAnnonce as any).longitude ? Number((selectedAnnonce as any).longitude) : undefined,
    }

    scoredResults = auxAnnonces.map((annonce: any) => {
      const auxProfile = annonce.auxiliaires_profiles
      const { score, details } = calculateMatchScore(
        {
          specialites: auxProfile.specialites || [],
          ville: auxProfile.ville || annonce.ville,
          code_postal: auxProfile.code_postal || annonce.code_postal,
          experience: auxProfile.experience,
          diplomes: auxProfile.diplomes,
          disponibilites: (annonce.disponibilites || auxProfile.disponibilites) as Record<string, string[]>,
          rayon_km: annonce.rayon_km || auxProfile.rayon_km || 10,
          latitude: auxProfile.latitude ? Number(auxProfile.latitude) : undefined,
          longitude: auxProfile.longitude ? Number(auxProfile.longitude) : undefined,
        },
        criteria
      )
      return { annonce, score, details }
    })

    // Fetch des badges pour les auxiliaires
    const auxUserIds = auxAnnonces
      .map((a: any) => a.auxiliaires_profiles?.user_id)
      .filter(Boolean)
    badgesMap = await getBadges(auxUserIds)

    scoredResults.sort((a, b) => b.score - a.score)
  }

  const unreadCount = await getUnreadCount(user.id)

  return (
    <main className="min-h-screen bg-gray-50">
      <BeneficiaireHeader
        userId={user.id}
        unreadCount={unreadCount}
        firstName={userData.first_name}
        lastName={userData.last_name}
        currentPage="matching"
      />

      <div className="max-w-5xl mx-auto px-4 py-8">
        <h2 className="text-2xl font-bold text-gray-900 mb-2">Matching intelligent</h2>
        <p className="text-gray-500 text-sm mb-6">
          Auxiliaires classes par compatibilite avec votre annonce.
        </p>

        {!mesAnnonces || mesAnnonces.length === 0 ? (
          <div className="bg-white rounded-xl border p-8 text-center">
            <p className="text-gray-500 mb-4">Publiez une annonce pour trouver les meilleurs profils.</p>
            <Link
              href="/beneficiaire/annonces/nouvelle"
              className="inline-flex items-center px-4 py-2 bg-black text-white rounded-lg hover:bg-gray-800 transition text-sm font-medium"
            >
              Creer une annonce
            </Link>
          </div>
        ) : (
          <>
            {mesAnnonces.length > 1 && (
              <div className="mb-6">
                <label className="block text-xs font-medium text-gray-500 mb-1">Annonce de reference</label>
                <select
                  defaultValue={selectedAnnonceId}
                  className="rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-black"
                  onChange={(e) => {
                    // Client-side navigation handled via form
                  }}
                >
                  {mesAnnonces.map((a) => (
                    <option key={a.id} value={a.id}>{a.titre}</option>
                  ))}
                </select>
              </div>
            )}

            {selectedAnnonce && (
              <div className="bg-white rounded-xl border p-4 mb-6">
                <p className="text-sm text-gray-500">Matching pour :</p>
                <p className="font-medium text-gray-900">{selectedAnnonce.titre}</p>
              </div>
            )}

            {scoredResults.length === 0 ? (
              <div className="bg-white rounded-xl border p-8 text-center">
                <p className="text-gray-500">Aucun auxiliaire disponible pour le moment.</p>
              </div>
            ) : (
              <div className="space-y-3">
                {scoredResults.map(({ annonce, score, details }, index) => {
                  const profile = annonce.auxiliaires_profiles
                  const u = profile?.users
                  const diplomeLabels = (profile?.diplomes as string[] || []).map((v: string) => DIPLOMES.find((d) => d.value === v)?.label || v).join(', ')
                  const expLabel = EXPERIENCE_LEVELS.find((e) => e.value === profile?.experience)?.label || profile?.experience
                  const specs = (profile?.specialites as string[] || []).slice(0, 4)

                  return (
                    <Link
                      key={annonce.id}
                      href={`/recherche/${annonce.id}`}
                      className="flex items-start gap-4 bg-white rounded-xl border p-5 hover:border-black transition"
                    >
                      <div className="flex-shrink-0 text-center">
                        <div className={`w-14 h-14 rounded-full flex items-center justify-center text-lg font-bold ${
                          score >= 70 ? 'bg-black text-white' :
                          score >= 40 ? 'bg-gray-200 text-gray-700' :
                          'bg-gray-100 text-gray-400'
                        }`}>
                          {score}
                        </div>
                        <p className="text-xs text-gray-400 mt-1">/ 100</p>
                      </div>

                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-1">
                          <span className="text-xs text-gray-400 font-medium">#{index + 1}</span>
                          <h3 className="font-semibold text-gray-900 truncate">
                            {u?.first_name} {u?.last_name?.[0]}. — {annonce.titre}
                          </h3>
                          <BadgesDisplay badges={badgesMap[profile?.user_id]} />
                        </div>
                        <p className="text-sm text-gray-500 mb-2">
                          {diplomeLabels} — {expLabel} — {annonce.ville} ({annonce.code_postal})
                        </p>

                        <div className="flex flex-wrap gap-1 mb-2">
                          {specs.map((s: string) => (
                            <span key={s} className="px-2 py-0.5 bg-gray-100 text-gray-600 rounded-full text-xs">
                              {SPECIALITES.find((sp) => sp.value === s)?.label || s}
                            </span>
                          ))}
                        </div>

                        <div className="flex gap-3 text-xs text-gray-400">
                          <span>Specialites: {details.specialites}/40</span>
                          <span>Localisation: {details.localisation}/25</span>
                          <span>Experience: {details.experience}/15</span>
                          <span>Diplome: {details.diplome}/10</span>
                          <span>Dispos: {details.disponibilites}/10</span>
                        </div>
                      </div>
                    </Link>
                  )
                })}
              </div>
            )}
          </>
        )}
      </div>
    </main>
  )
}
