import { createClient } from '@/lib/supabase/server'
import Link from 'next/link'
import { SPECIALITES, DIPLOMES, EXPERIENCE_LEVELS } from '@/lib/constants'
import { AuxiliaireHeader } from '@/components/layout/auxiliaire-header'
import { getUnreadCount } from '@/lib/unread-count'
import { ContactBeneficiaireButton } from '@/components/messages/contact-beneficiaire-button'

type SearchParams = {
  ville?: string
  specialite?: string
  page?: string
}

export default async function DemandesBeneficiairesPage({
  searchParams,
}: {
  searchParams: Promise<SearchParams>
}) {
  const params = await searchParams
  const supabase = await createClient()

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

  let query = supabase
    .from('annonces_beneficiaires')
    .select('*')
    .eq('status', 'publiee')
    .order('published_at', { ascending: false })

  if (params.ville) {
    query = query.ilike('ville', `%${params.ville}%`)
  }

  if (params.specialite) {
    query = query.contains('specialites_recherchees', [params.specialite])
  }

  const page = Number(params.page) || 1
  const perPage = 12
  const from = (page - 1) * perPage
  const to = from + perPage - 1

  const { data: annonces } = await query.range(from, to)

  const unreadCount = user ? await getUnreadCount(user.id) : 0

  return (
    <main className="min-h-screen kraft bg-kraft">
      {userData?.role === 'auxiliaire' && user ? (
        <AuxiliaireHeader
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
              {userData ? (
                <Link
                  href="/beneficiaire/dashboard"
                  className="text-sm text-gray-600 hover:text-black"
                >
                  Mon espace
                </Link>
              ) : (
                <Link href="/login" className="text-sm text-gray-600 hover:text-black">
                  Connexion
                </Link>
              )}
            </div>
          </div>
        </header>
      )}

      <div className="max-w-6xl mx-auto px-4 py-8 relative z-10">
        <h2 className="text-2xl font-bold text-gray-900 mb-6">Demandes des beneficiaires</h2>

        {!annonces || annonces.length === 0 ? (
          <div className="bg-white rounded-xl border p-8 text-center">
            <p className="text-gray-500">Aucune demande pour le moment.</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {annonces.map((annonce) => {
              const specLabels = (annonce.specialites_recherchees as string[]).map(
                (s) => SPECIALITES.find((sp) => sp.value === s)?.label || s
              )
              const diplomeLabel = annonce.diplome_requis
                ? DIPLOMES.find((d) => d.value === annonce.diplome_requis)?.label
                : null
              const expLabel = annonce.experience_min
                ? EXPERIENCE_LEVELS.find((e) => e.value === annonce.experience_min)?.label
                : null

              return (
                <div key={annonce.id} className="bg-white rounded-xl border p-5 flex flex-col">
                  <h3 className="font-semibold text-gray-900 mb-1">{annonce.titre}</h3>
                  <p className="text-sm text-gray-500 mb-2">
                    {annonce.ville} {annonce.code_postal && `(${annonce.code_postal})`} — Debut: {new Date(annonce.date_debut).toLocaleDateString('fr-FR')}
                  </p>
                  <p className="text-sm text-gray-600 line-clamp-3 mb-3">{annonce.description}</p>

                  <div className="flex flex-wrap gap-1 mb-3">
                    {specLabels.slice(0, 3).map((label, i) => (
                      <span key={i} className="px-2 py-0.5 bg-gray-100 text-gray-600 rounded-full text-xs">
                        {label}
                      </span>
                    ))}
                    {specLabels.length > 3 && (
                      <span className="px-2 py-0.5 bg-gray-100 text-gray-600 rounded-full text-xs cursor-default relative group">
                        +{specLabels.length - 3}
                        <span className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 hidden group-hover:block bg-accent text-black text-xs rounded-lg px-3 py-2 whitespace-nowrap z-50">
                          {specLabels.slice(3).join(', ')}
                        </span>
                      </span>
                    )}
                  </div>

                  <div className="flex items-center gap-3 text-xs text-gray-400 mb-4">
                    {diplomeLabel && <span>{diplomeLabel}</span>}
                    {expLabel && <span>{expLabel}</span>}
                    <span>{annonce.niveau_dependance === 'besoins_plus' ? 'Besoins +' : annonce.niveau_dependance === 'besoins_plus_plus' ? 'Besoins ++' : 'Besoins +++'}</span>
                  </div>

                  {userData?.role === 'auxiliaire' && (
                    <ContactBeneficiaireButton beneficiaireProfileId={annonce.beneficiaire_id} />
                  )}
                </div>
              )
            })}
          </div>
        )}
      </div>
    </main>
  )
}
