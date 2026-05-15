import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import Link from 'next/link'
import { SPECIALITES } from '@/lib/constants'
import { AccompagnantDashboardHeader } from '@/components/layout/accompagnant-dashboard-header'
import { ContactAccompagneButton } from '@/components/messages/contact-accompagne-button'
import { getUnreadCount } from '@/lib/unread-count'
import { hasActiveSubscription } from '@/lib/subscription-helpers'
import { isDepartementOuvert } from '@/lib/departements'

export default async function ProfilAccompagnePage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params
  const supabase = await createClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: userData } = await supabase
    .from('users')
    .select('first_name, last_name, role')
    .eq('id', user.id)
    .single()

  if (!userData) redirect('/')

  // Paywall : seuls les accompagnants abonnes (et l'accompagne lui-meme) peuvent consulter.
  if (userData.role === 'accompagnant') {
    const subscribed = await hasActiveSubscription(user.id)
    if (!subscribed) redirect('/accompagnant/abonnement')
  } else if (userData.role !== 'accompagne' && userData.role !== 'admin') {
    redirect('/')
  }

  const { data: profile } = await supabase
    .from('accompagnes_profiles')
    .select(`
      id,
      user_id,
      ville,
      code_postal,
      created_at,
      users:user_id (first_name, created_at)
    `)
    .eq('id', id)
    .single()

  if (!profile) redirect('/recherche/demandes')

  // Gate geographique : pas de fuite hors departements ouverts pour les accompagnants.
  if (userData.role === 'accompagnant' && !(await isDepartementOuvert(profile.code_postal))) {
    redirect('/recherche/demandes')
  }

  const { data: annonces } = await supabase
    .from('annonces_accompagnes')
    .select('id, titre, ville, code_postal, date_debut, description, specialites_recherchees, published_at')
    .eq('accompagne_id', profile.id)
    .eq('status', 'publiee')
    .order('published_at', { ascending: false })

  const u = Array.isArray(profile.users) ? profile.users[0] : profile.users
  const firstName = u?.first_name ?? ''
  const initiale = firstName.charAt(0).toUpperCase()
  const memberSince = u?.created_at
    ? new Date(u.created_at).toLocaleDateString('fr-FR', { month: 'long', year: 'numeric' })
    : null
  const annoncesCount = annonces?.length ?? 0
  const isOwner = userData.role === 'accompagne' && profile.user_id === user.id
  const canContact = userData.role === 'accompagnant'

  const unreadCount = await getUnreadCount(user.id)

  return (
    <main id="main-content" tabIndex={-1} className="min-h-screen bg-[#fefaf8] focus:outline-none">
      {userData.role === 'accompagnant' ? (
        <AccompagnantDashboardHeader
          firstName={userData.first_name}
          lastName={userData.last_name}
          unreadCount={unreadCount}
          currentPage="demandes"
        />
      ) : (
        <header className="bg-[#faf7f2] border-b border-[#e8dfd2]">
          <div className="max-w-3xl mx-auto px-4 md:px-6 py-4 flex items-center justify-between">
            <Link href="/" className="text-lg font-bold text-black">
              roxanetnous
            </Link>
            <Link href="/recherche/demandes" className="text-sm text-gray-600 hover:text-gray-900">
              Retour aux demandes
            </Link>
          </div>
        </header>
      )}

      <div className="max-w-3xl mx-auto px-4 py-10 md:py-14 relative z-10">

        <Link
          href="/recherche/demandes"
          className="inline-flex items-center gap-2 text-sm text-gray-600 hover:text-gray-900 mb-6 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus-ring focus-visible:ring-offset-2 rounded"
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
          </svg>
          Retour aux demandes
        </Link>

        {/* EN-TETE PROFIL */}
        <header className="text-center mb-10">
          <div className="inline-flex items-center justify-center w-20 h-20 rounded-full bg-accent/20 mb-4">
            <span className="italic text-3xl text-kraft">{initiale}</span>
          </div>
          <h1 className="italic text-3xl md:text-4xl text-gray-900 leading-tight mb-2">
            {firstName}
          </h1>
          {profile.ville && (
            <p className="text-sm text-gray-600">
              {profile.ville} {profile.code_postal && `(${profile.code_postal})`}
            </p>
          )}
        </header>

        {/* A PROPOS */}
        <section className="bg-white rounded-2xl border border-[#e8dfd2] p-6 md:p-8 mb-6">
          <h2 className="italic text-xl text-gray-900 mb-4">À propos</h2>
          <dl className="grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-4 text-sm">
            {profile.ville && (
              <div>
                <dt className="text-xs uppercase tracking-[0.12em] text-gray-500 mb-1">Ville</dt>
                <dd className="text-gray-900">{profile.ville}</dd>
              </div>
            )}
            {profile.code_postal && (
              <div>
                <dt className="text-xs uppercase tracking-[0.12em] text-gray-500 mb-1">Code postal</dt>
                <dd className="text-gray-900">{profile.code_postal}</dd>
              </div>
            )}
            {memberSince && (
              <div>
                <dt className="text-xs uppercase tracking-[0.12em] text-gray-500 mb-1">Membre depuis</dt>
                <dd className="text-gray-900">{memberSince}</dd>
              </div>
            )}
            <div>
              <dt className="text-xs uppercase tracking-[0.12em] text-gray-500 mb-1">Annonces actives</dt>
              <dd className="text-gray-900">{annoncesCount}</dd>
            </div>
          </dl>
        </section>

        {/* ANNONCES PUBLIEES */}
        {annonces && annonces.length > 0 && (
          <section className="mb-8">
            <h2 className="italic text-xl text-gray-900 mb-4 px-1">
              {isOwner ? 'Vos demandes en cours' : `Ses demandes en cours`}
            </h2>
            <div className="space-y-3">
              {annonces.map((annonce) => {
                const specLabels = (annonce.specialites_recherchees as string[] | null || []).map(
                  (s) => SPECIALITES.find((sp) => sp.value === s)?.label || s
                )
                return (
                  <article
                    key={annonce.id}
                    className="bg-white rounded-2xl border border-[#e8dfd2] p-5 hover:border-kraft transition"
                  >
                    <h3 className="italic text-lg text-gray-900 mb-1.5">{annonce.titre}</h3>
                    <p className="text-xs text-gray-600 mb-3">
                      {annonce.ville} {annonce.code_postal && `(${annonce.code_postal})`}
                      {annonce.date_debut && (
                        <>
                          <span className="text-gray-400 mx-1">·</span>
                          Début : {new Date(annonce.date_debut).toLocaleDateString('fr-FR')}
                        </>
                      )}
                    </p>
                    {annonce.description && (
                      <p className="text-sm text-gray-700 line-clamp-2 mb-3 leading-relaxed">
                        {annonce.description}
                      </p>
                    )}
                    {specLabels.length > 0 && (
                      <div className="flex flex-wrap gap-1.5">
                        {specLabels.slice(0, 3).map((label, i) => (
                          <span key={i} className="px-2 py-0.5 bg-accent/20 text-gray-700 rounded-full text-xs">
                            {label}
                          </span>
                        ))}
                        {specLabels.length > 3 && (
                          <span className="px-2 py-0.5 bg-accent/20 text-gray-700 rounded-full text-xs">
                            +{specLabels.length - 3}
                          </span>
                        )}
                      </div>
                    )}
                  </article>
                )
              })}
            </div>
          </section>
        )}

        {/* CTA CONTACT — visible accompagnants uniquement */}
        {canContact && (
          <div className="bg-white rounded-2xl border border-[#e8dfd2] p-6 text-center">
            <h2 className="italic text-lg text-gray-900 mb-2">
              Vous souhaitez accompagner {firstName} ?
            </h2>
            <p className="text-sm text-gray-600 mb-4">
              Envoyez-lui un message pour démarrer la conversation.
            </p>
            <div className="max-w-xs mx-auto">
              <ContactAccompagneButton accompagneProfileId={profile.id} subscribed={true} />
            </div>
          </div>
        )}


      </div>
    </main>
  )
}
