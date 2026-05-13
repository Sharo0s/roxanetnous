import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import Link from 'next/link'
import { SPECIALITES, DIPLOMES, JOURS_SEMAINE, CRENEAUX, formatExperienceLabel } from '@/lib/constants'
import { ContactButton } from '@/components/messages/contact-button'
import { FavoriButton } from '@/components/recherche/favori-button'
import { SignalementButton } from '@/components/signalement-button'
import { getBadges } from '@/lib/badges'
import { BadgesDisplay } from '@/components/badges-display'
import { AccompagnanteDashboardHeader } from '@/components/layout/accompagnante-dashboard-header'
import { AccompagneDashboardHeader } from '@/components/layout/accompagne-dashboard-header'
import { getUnreadCount } from '@/lib/unread-count'
import { isDepartementOuvert } from '@/lib/departements'
import { hasActiveSubscription } from '@/lib/subscription-helpers'

type AnnoncePublicProfile = {
  user_id: string
  diplomes: string[] | null
  experience: number | null
  specialites: string[] | null
  description: string | null
  ville: string | null
  code_postal: string | null
  rayon_km: number | null
  permis_conduire: boolean | null
  vehicule: boolean | null
  langues: string[] | null
  disponibilites: Record<string, unknown> | null
  validation_status: string | null
  users: { first_name: string | null; last_name: string | null } | null
} | null

export default async function AnnonceDetailPage({
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

  if (userData?.role === 'accompagne') {
    const isSubscribed = await hasActiveSubscription(user.id)
    if (!isSubscribed) redirect('/accompagne/abonnement')
  }

  const { data: annonce } = await supabase
    .from('annonces_accompagnants')
    .select(`
      *,
      accompagnants_profiles!inner (
        user_id,
        diplomes,
        experience,
        specialites,
        description,
        ville,
        code_postal,
        rayon_km,
        permis_conduire,
        vehicule,
        langues,
        disponibilites,
        validation_status,
        users:user_id (first_name, last_name)
      )
    `)
    .eq('id', id)
    .eq('status', 'publiee')
    .eq('accompagnants_profiles.validation_status', 'valide')
    .single()

  if (!annonce) redirect('/recherche')
  if (!(await isDepartementOuvert(annonce.code_postal))) redirect('/recherche')

  const profile = annonce.accompagnants_profiles as unknown as AnnoncePublicProfile
  const u = profile?.users
  const auxUserId = profile?.user_id

  // Verifier si l'annonce est en favori
  const { data: favori } = await supabase
    .from('favoris')
    .select('id')
    .eq('user_id', user.id)
    .eq('annonce_accompagnant_id', id)
    .single()
  const isFavori = !!favori

  // Fetch des badges
  const badgesMap = auxUserId ? await getBadges([auxUserId]) : {}

  const unreadCount = await getUnreadCount(user.id)
  // Defense en profondeur UI sur ContactButton : accompagne arrivant ici est forcement abonne (gate page).
  const subscribed = userData?.role === 'accompagne'

  const diplomeLabel = (profile?.diplomes as string[] || []).map((d: string) => DIPLOMES.find((dp) => dp.value === d)?.label || d).join(', ')
  const expLabel = formatExperienceLabel(profile?.experience != null ? String(profile.experience) : null)
  const specLabels = (profile?.specialites as string[] || []).map(
    (s: string) => SPECIALITES.find((sp) => sp.value === s)?.label || s
  )

  const dispos = (annonce.disponibilites || profile?.disponibilites || {}) as Record<string, string[]>

  return (
    <main id="main-content" tabIndex={-1} className="min-h-screen bg-[#fefaf8] focus:outline-none">
      {userData?.role === 'accompagnant' ? (
        <AccompagnanteDashboardHeader
          firstName={userData.first_name}
          lastName={userData.last_name}
          unreadCount={unreadCount}
          currentPage="other"
        />
      ) : userData?.role === 'accompagne' ? (
        <AccompagneDashboardHeader
          firstName={userData.first_name}
          lastName={userData.last_name}
          unreadCount={unreadCount}
          currentPage="recherche"
        />
      ) : (
        <header className="bg-[#faf7f2] border-b border-[#e8dfd2]">
          <div className="max-w-4xl mx-auto px-4 py-4 flex items-center justify-between">
            <Link href="/" className="text-base font-bold text-black">
              roxanetnous
            </Link>
            <Link href="/recherche" className="text-sm text-gray-600 hover:text-gray-900">
              Retour à la recherche
            </Link>
          </div>
        </header>
      )}

      <div className="max-w-4xl mx-auto px-4 py-8 relative z-10">
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-4">
            <div className="w-14 h-14 rounded-full bg-gray-200 flex items-center justify-center text-lg font-bold text-gray-600">
              {u?.first_name?.[0]}{u?.last_name?.[0]}
            </div>
            <div>
              <div className="flex items-center gap-3">
                <h1 className="text-2xl font-bold text-gray-900">
                  {u?.first_name} {u?.last_name?.[0]}.
                </h1>
                <BadgesDisplay badges={auxUserId ? badgesMap[auxUserId] : undefined} />
              </div>
              <p className="text-black">
                {diplomeLabel} — Expérience : {expLabel}
              </p>
            </div>
          </div>
          <FavoriButton annonceId={id} type="accompagnant" initialIsFavori={isFavori} />
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <div className="md:col-span-2 space-y-6">
            <div className="bg-white rounded-xl border p-6">
              <h2 className="font-semibold mb-3">Description</h2>
              <p className="text-sm text-gray-700 whitespace-pre-wrap break-words overflow-hidden">{annonce.description}</p>
            </div>

            {profile?.description && (
              <div className="bg-white rounded-xl border p-6">
                <h2 className="font-semibold mb-3">À propos</h2>
                <p className="text-sm text-gray-700 whitespace-pre-wrap break-words overflow-hidden">{profile.description}</p>
              </div>
            )}

            <div className="bg-white rounded-xl border p-6">
              <h2 className="font-semibold mb-3">Spécialités ({specLabels.length})</h2>
              <div className="flex flex-wrap gap-2">
                {specLabels.map((label: string, i: number) => (
                  <span key={i} className="px-3 py-1 bg-accent text-black rounded-full text-xs font-medium">
                    {label}
                  </span>
                ))}
              </div>
            </div>

            {Object.keys(dispos).length > 0 && (
              <div className="bg-white rounded-xl border p-6">
                <h2 className="font-semibold mb-3">Disponibilités</h2>
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr>
                        <th className="text-left py-2 pr-4 font-medium text-gray-500"></th>
                        {CRENEAUX.map((c) => (
                          <th key={c.value} className="py-2 px-2 text-center font-medium text-gray-500">
                            {c.label}
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {JOURS_SEMAINE.map((jour) => (
                        <tr key={jour.value} className="border-t border-gray-100">
                          <td className="py-2 pr-4 font-medium text-gray-700">{jour.label}</td>
                          {CRENEAUX.map((creneau) => {
                            const available = (dispos[jour.value] || []).includes(creneau.value)
                            return (
                              <td key={creneau.value} className="py-2 px-2 text-center">
                                <div className={`w-8 h-8 mx-auto rounded-md border flex items-center justify-center ${
                                  available ? 'border-accent bg-white text-black' : 'border-gray-200 bg-gray-50'
                                }`}>
                                  {available && (
                                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                                    </svg>
                                  )}
                                </div>
                              </td>
                            )
                          })}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </div>

          <div className="space-y-6">
            <div className="bg-white rounded-xl border p-6">
              <h2 className="font-semibold mb-3">Informations</h2>
              <dl className="space-y-3 text-sm">
                <div>
                  <dt className="text-gray-500">Localisation</dt>
                  <dd className="font-medium">{annonce.ville} ({annonce.code_postal})</dd>
                </div>
                <div>
                  <dt className="text-gray-500">Rayon d&#39;intervention</dt>
                  <dd className="font-medium">{annonce.rayon_km} km</dd>
                </div>
                <div>
                  <dt className="text-gray-500">Expérience</dt>
                  <dd className="font-medium">{expLabel}</dd>
                </div>
                {profile?.permis_conduire && (
                  <div>
                    <dt className="text-gray-500">Permis de conduire</dt>
                    <dd className="font-medium">Oui{profile.vehicule ? ' (avec véhicule)' : ''}</dd>
                  </div>
                )}
                {profile?.langues && profile.langues.length > 0 && (
                  <div>
                    <dt className="text-gray-500">Langues</dt>
                    <dd className="font-medium">{profile.langues.join(', ')}</dd>
                  </div>
                )}
              </dl>
            </div>

            {userData?.role === 'accompagne' ? (
              <div className="bg-white rounded-xl border p-6">
                <h2 className="font-semibold mb-3">Contacter</h2>
                <p className="text-sm text-gray-600 mb-4">
                  Envoyez un message pour en savoir plus ou proposer une mission.
                </p>
                <ContactButton accompagnanteProfileId={annonce.accompagnant_id} subscribed={subscribed} />
              </div>
            ) : null}

            <div className="text-center pt-2">
              <SignalementButton cibleType="annonce_accompagnant" cibleId={id} />
            </div>
          </div>
        </div>
      </div>
    </main>
  )
}
