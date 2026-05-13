import { createClient } from '@/lib/supabase/server'
import Link from 'next/link'
import { SPECIALITES, DIPLOMES, formatExperienceLabel } from '@/lib/constants'
import { AccompagnanteDashboardHeader } from '@/components/layout/accompagnante-dashboard-header'
import { LogoutButton } from '@/components/auth/logout-button'
import { getUnreadCount } from '@/lib/unread-count'
import { ContactAccompagneButton } from '@/components/messages/contact-accompagne-button'
import { getCodesPostauxFilterOr } from '@/lib/departements'
import { hasActiveSubscription } from '@/lib/subscription-helpers'

type SearchParams = {
  ville?: string
  specialite?: string
  page?: string
}

export default async function DemandesAccompagnesPage({
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

  const codesFilter = await getCodesPostauxFilterOr()

  let query = supabase
    .from('annonces_accompagnes')
    .select('*')
    .eq('status', 'publiee')
    .or(codesFilter)
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
  // Story 3.6 : prop subscribed pour defense en profondeur UI sur ContactAccompagneButton.
  // Patch F10 review : court-circuiter quand le bouton ne sera pas rendu (role != accompagnante).
  const subscribed = user && userData?.role === 'accompagnante'
    ? await hasActiveSubscription(user.id)
    : false

  const isAccompagnante = userData?.role === 'accompagnante' && !!user

  return (
    <main id="main-content" tabIndex={-1} className="min-h-screen bg-[#fefaf8] focus:outline-none">
      {isAccompagnante ? (
        <AccompagnanteDashboardHeader
          firstName={userData!.first_name}
          lastName={userData!.last_name}
          unreadCount={unreadCount}
          currentPage="demandes"
        />
      ) : (
        <header className="bg-[#faf7f2] border-b border-[#e8dfd2] relative z-10">
          <div className="max-w-5xl mx-auto px-4 md:px-6 py-4 flex items-center justify-between">
            <Link href="/" className="text-lg font-bold text-black">
              roxanetnous
            </Link>
            <div className="flex items-center gap-4">
              {userData ? (
                <Link href="/accompagne/dashboard" className="text-sm text-gray-600 hover:text-gray-900">
                  Mon espace
                </Link>
              ) : (
                <Link href="/login" className="text-sm text-gray-600 hover:text-gray-900">
                  Connexion
                </Link>
              )}
            </div>
          </div>
        </header>
      )}

      <div className="max-w-5xl mx-auto px-4 py-10 md:py-14 relative z-10">

        {/* TITRE EDITORIAL */}
        <header className="text-center mb-10">
          {isAccompagnante && (
            <div className="text-xs uppercase tracking-[0.18em] text-kraft mb-2">Mon espace</div>
          )}
          <h1 className="text-3xl md:text-4xl italic text-gray-900 leading-tight">
            Demandes des accompagnés
          </h1>
          <p className="mt-3 text-sm text-gray-600">
            Découvrez les personnes qui cherchent un accompagnant près de chez vous.
          </p>
        </header>

        {!annonces || annonces.length === 0 ? (
          <div className="bg-white rounded-2xl border border-[#e8dfd2] p-12 text-center">
            <h2 className="italic text-xl text-gray-900 mb-2">Aucune demande pour le moment.</h2>
            <p className="text-sm text-gray-600">
              Revenez bientôt — de nouvelles demandes sont publiées chaque semaine.
            </p>
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
              const expLabel = annonce.experience_min ? formatExperienceLabel(annonce.experience_min) : null

              return (
                <article
                  key={annonce.id}
                  className="bg-white rounded-2xl border border-[#e8dfd2] p-6 flex flex-col hover:border-kraft transition"
                >
                  <h3 className="italic text-lg text-gray-900 mb-1.5">{annonce.titre}</h3>
                  <p className="text-sm text-gray-600 mb-3">
                    {annonce.ville} {annonce.code_postal && `(${annonce.code_postal})`} <span className="text-gray-400 mx-1">·</span> Début : {new Date(annonce.date_debut).toLocaleDateString('fr-FR')}
                  </p>
                  <p className="text-sm text-gray-700 line-clamp-3 mb-4 leading-relaxed">{annonce.description}</p>

                  <div className="flex flex-wrap gap-1.5 mb-4">
                    {specLabels.slice(0, 3).map((label, i) => (
                      <span key={i} className="px-2 py-0.5 bg-accent/20 text-gray-700 rounded-full text-xs">
                        {label}
                      </span>
                    ))}
                    {specLabels.length > 3 && (
                      <span className="px-2 py-0.5 bg-accent/20 text-gray-700 rounded-full text-xs cursor-default relative group">
                        +{specLabels.length - 3}
                        <span className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 hidden group-hover:block bg-white border border-[#e8dfd2] text-gray-900 text-xs rounded-lg px-3 py-2 whitespace-nowrap z-50 shadow-md">
                          {specLabels.slice(3).join(', ')}
                        </span>
                      </span>
                    )}
                  </div>

                  <div className="flex items-center gap-3 text-xs text-gray-500 mb-4">
                    {diplomeLabel && <span>{diplomeLabel}</span>}
                    {expLabel && <span>{expLabel}</span>}
                    <span>{annonce.niveau_dependance === 'besoins_plus' ? 'Besoins +' : annonce.niveau_dependance === 'besoins_plus_plus' ? 'Besoins ++' : 'Besoins +++'}</span>
                  </div>

                  {isAccompagnante && (
                    <div className="mt-auto">
                      <ContactAccompagneButton accompagneProfileId={annonce.accompagne_id} subscribed={subscribed} />
                    </div>
                  )}
                </article>
              )
            })}
          </div>
        )}

        {/* FOOTER : seulement si role accompagnante connecte */}
        {isAccompagnante && (
          <div className="mt-16 pt-6 border-t border-[#e8dfd2] flex flex-wrap justify-center items-center gap-x-6 gap-y-2 text-xs text-gray-500">
            <Link href="/cgu" className="hover:text-gray-800">Aide</Link>
            <span aria-hidden="true">·</span>
            <Link href="/politique-de-confidentialite" className="hover:text-gray-800">Confidentialité</Link>
            <span aria-hidden="true">·</span>
            <Link href="/cgu" className="hover:text-gray-800">Conditions</Link>
            <span aria-hidden="true">·</span>
            <LogoutButton />
          </div>
        )}

      </div>
    </main>
  )
}
