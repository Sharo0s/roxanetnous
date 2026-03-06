import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import Link from 'next/link'
import { SPECIALITES, DIPLOMES, EXPERIENCE_LEVELS, JOURS_SEMAINE, CRENEAUX } from '@/lib/constants'
import { ContactButton } from '@/components/messages/contact-button'
import { FavoriButton } from '@/components/recherche/favori-button'
import { AvisSection } from '@/components/recherche/avis-section'
import { SignalementButton } from '@/components/signalement-button'
import { getBadges } from '@/lib/badges'
import { BadgesDisplay } from '@/components/badges-display'
import { AuxiliaireHeader } from '@/components/layout/auxiliaire-header'
import { BeneficiaireHeader } from '@/components/layout/beneficiaire-header'
import { getUnreadCount } from '@/lib/unread-count'

export default async function AnnonceDetailPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params
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

  const { data: annonce } = await supabase
    .from('annonces_auxiliaires')
    .select(`
      *,
      auxiliaires_profiles!inner (
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
    .eq('auxiliaires_profiles.validation_status', 'valide')
    .single()

  if (!annonce) redirect('/recherche')

  const profile = annonce.auxiliaires_profiles as any
  const u = profile?.users
  const auxUserId = profile?.user_id

  // Verifier si l'annonce est en favori
  let isFavori = false
  if (user) {
    const { data: favori } = await supabase
      .from('favoris')
      .select('id')
      .eq('user_id', user.id)
      .eq('annonce_auxiliaire_id', id)
      .single()
    isFavori = !!favori
  }

  // Recuperer les avis pour cet auxiliaire
  const { data: avisList } = await supabase
    .from('avis')
    .select(`
      id, note, commentaire, created_at,
      users:auteur_id (first_name, last_name)
    `)
    .eq('cible_id', auxUserId)
    .eq('masque', false)
    .order('created_at', { ascending: false })

  const avisFormatted = (avisList || []).map((a: any) => ({
    id: a.id,
    note: a.note,
    commentaire: a.commentaire,
    created_at: a.created_at,
    auteur: a.users,
  }))

  const moyenneNote = avisFormatted.length > 0
    ? avisFormatted.reduce((sum: number, a: any) => sum + a.note, 0) / avisFormatted.length
    : null

  const canLeaveAvis = !!user && userData?.role === 'beneficiaire' && auxUserId !== user.id

  // Fetch des badges
  const badgesMap = auxUserId ? await getBadges([auxUserId]) : {}

  const unreadCount = user ? await getUnreadCount(user.id) : 0

  const diplomeLabel = (profile?.diplomes as string[] || []).map((d: string) => DIPLOMES.find((dp) => dp.value === d)?.label || d).join(', ')
  const expLabel = EXPERIENCE_LEVELS.find((e) => e.value === profile?.experience)?.label || profile?.experience
  const specLabels = (profile?.specialites as string[] || []).map(
    (s: string) => SPECIALITES.find((sp) => sp.value === s)?.label || s
  )

  const dispos = (annonce.disponibilites || profile?.disponibilites || {}) as Record<string, string[]>

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
          <div className="max-w-4xl mx-auto px-4 py-4 flex items-center justify-between">
            <Link href="/" className="text-xl font-bold text-black">
              roxanetnous
            </Link>
            <Link href="/recherche" className="text-sm text-gray-500 hover:text-black">
              Retour a la recherche
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
                <h2 className="text-2xl font-bold text-gray-900">
                  {u?.first_name} {u?.last_name?.[0]}.
                </h2>
                <BadgesDisplay badges={badgesMap[auxUserId]} />
              </div>
              <p className="text-black">
                {diplomeLabel} — Experience : {expLabel}
                {moyenneNote !== null && ` — ${moyenneNote.toFixed(1)}/5 (${avisFormatted.length} avis)`}
              </p>
            </div>
          </div>
          {user && (
            <FavoriButton annonceId={id} type="auxiliaire" initialIsFavori={isFavori} />
          )}
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <div className="md:col-span-2 space-y-6">
            <div className="bg-white rounded-xl border p-6">
              <h3 className="font-semibold mb-3">Description</h3>
              <p className="text-sm text-gray-700 whitespace-pre-wrap break-words overflow-hidden">{annonce.description}</p>
            </div>

            {profile?.description && (
              <div className="bg-white rounded-xl border p-6">
                <h3 className="font-semibold mb-3">A propos</h3>
                <p className="text-sm text-gray-700 whitespace-pre-wrap break-words overflow-hidden">{profile.description}</p>
              </div>
            )}

            <div className="bg-white rounded-xl border p-6">
              <h3 className="font-semibold mb-3">Specialites ({specLabels.length})</h3>
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
                <h3 className="font-semibold mb-3">Disponibilites</h3>
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
            <AvisSection
              cibleUserId={auxUserId}
              avisList={avisFormatted}
              moyenneNote={moyenneNote}
              canLeaveAvis={canLeaveAvis}
            />
          </div>

          <div className="space-y-6">
            <div className="bg-white rounded-xl border p-6">
              <h3 className="font-semibold mb-3">Informations</h3>
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
                  <dt className="text-gray-500">Experience</dt>
                  <dd className="font-medium">{expLabel}</dd>
                </div>
                {profile?.permis_conduire && (
                  <div>
                    <dt className="text-gray-500">Permis de conduire</dt>
                    <dd className="font-medium">Oui{profile.vehicule ? ' (avec vehicule)' : ''}</dd>
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

            {userData?.role === 'beneficiaire' ? (
              <div className="bg-white rounded-xl border p-6">
                <h3 className="font-semibold mb-3">Contacter</h3>
                <p className="text-sm text-gray-600 mb-4">
                  Envoyez un message pour en savoir plus ou proposer une mission.
                </p>
                <ContactButton auxiliaireProfileId={annonce.auxiliaire_id} />
              </div>
            ) : !user ? (
              <div className="bg-white rounded-xl border p-6">
                <h3 className="font-semibold mb-3">Interesse ?</h3>
                <p className="text-sm text-gray-600 mb-4">
                  Connectez-vous pour contacter cet auxiliaire.
                </p>
                <Link
                  href="/register"
                  className="inline-flex items-center px-4 py-2 bg-accent text-black rounded-lg btn-hover transition text-sm font-medium w-full justify-center"
                >
                  Creer un compte
                </Link>
              </div>
            ) : null}

            {user && (
              <div className="text-center pt-2">
                <SignalementButton cibleType="annonce_auxiliaire" cibleId={id} />
              </div>
            )}
          </div>
        </div>
      </div>
    </main>
  )
}
