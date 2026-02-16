import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import Link from 'next/link'
import { DIPLOMES, EXPERIENCE_LEVELS, SPECIALITES } from '@/lib/constants'
import { ValidationActions } from '@/components/admin/validation-actions'

export default async function ValidationDetailPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params
  const supabase = await createClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: adminData } = await supabase
    .from('users')
    .select('role')
    .eq('id', user.id)
    .single()

  if (!adminData || adminData.role !== 'admin') redirect('/')

  // Recuperer le profil avec service role pour bypass RLS
  const supabaseAdmin = await createClient({ serviceRole: true })

  const { data: profile } = await supabaseAdmin
    .from('auxiliaires_profiles')
    .select(`
      *,
      users:user_id (first_name, last_name, email, phone, created_at)
    `)
    .eq('id', id)
    .single()

  if (!profile) redirect('/admin')

  const u = profile.users as any

  const diplomeLabel = DIPLOMES.find((d) => d.value === profile.diplome)?.label || profile.diplome
  const experienceLabel = EXPERIENCE_LEVELS.find((e) => e.value === profile.experience)?.label || profile.experience
  const specialiteLabels = (profile.specialites as string[]).map(
    (s) => SPECIALITES.find((sp) => sp.value === s)?.label || s
  )

  // Generer les URLs signees pour les justificatifs
  let identiteUrl: string | null = null
  let diplomeUrl: string | null = null

  if (profile.justificatif_identite_url) {
    const { data } = await supabaseAdmin.storage
      .from('justificatifs')
      .createSignedUrl(profile.justificatif_identite_url, 3600)
    identiteUrl = data?.signedUrl || null
  }

  if (profile.justificatif_diplome_url) {
    const { data } = await supabaseAdmin.storage
      .from('justificatifs')
      .createSignedUrl(profile.justificatif_diplome_url, 3600)
    diplomeUrl = data?.signedUrl || null
  }

  // Recuperer les resultats OCR
  const { data: ocrResults } = await supabaseAdmin
    .from('ocr_results')
    .select('*')
    .eq('auxiliaire_profile_id', id)
    .order('created_at', { ascending: false })

  // Logger la consultation
  await supabaseAdmin.from('admin_actions_log').insert({
    admin_id: user.id,
    action_type: 'consultation_justificatif',
    target_type: 'auxiliaire',
    target_id: id,
    details: { viewed_at: new Date().toISOString() },
  })

  return (
    <main className="min-h-screen bg-gray-50">
      <header className="bg-white border-b">
        <div className="max-w-4xl mx-auto px-4 py-4 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Link href="/admin" className="text-xl font-bold text-black">
              roxanetnous
            </Link>
            <span className="text-xs bg-gray-200 text-gray-700 px-2 py-1 rounded-full font-medium">Admin</span>
          </div>
          <Link href="/admin" className="text-sm text-gray-500 hover:text-black">
            Retour a la liste
          </Link>
        </div>
      </header>

      <div className="max-w-4xl mx-auto px-4 py-8">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h2 className="text-2xl font-bold text-gray-900">
              {u?.first_name} {u?.last_name}
            </h2>
            <p className="text-gray-500">{u?.email}</p>
          </div>
          <StatusBadge status={profile.validation_status} />
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* Informations personnelles */}
          <div className="bg-white rounded-xl border p-6">
            <h3 className="font-semibold mb-4">Informations personnelles</h3>
            <dl className="space-y-3 text-sm">
              <div>
                <dt className="text-gray-500">Nom complet</dt>
                <dd className="font-medium">{u?.first_name} {u?.last_name}</dd>
              </div>
              <div>
                <dt className="text-gray-500">Email</dt>
                <dd className="font-medium">{u?.email}</dd>
              </div>
              {u?.phone && (
                <div>
                  <dt className="text-gray-500">Telephone</dt>
                  <dd className="font-medium">{u.phone}</dd>
                </div>
              )}
              <div>
                <dt className="text-gray-500">Inscription</dt>
                <dd className="font-medium">
                  {new Date(u?.created_at).toLocaleDateString('fr-FR')}
                </dd>
              </div>
            </dl>
          </div>

          {/* Profil professionnel */}
          <div className="bg-white rounded-xl border p-6">
            <h3 className="font-semibold mb-4">Profil professionnel</h3>
            <dl className="space-y-3 text-sm">
              <div>
                <dt className="text-gray-500">Diplome</dt>
                <dd className="font-medium">{diplomeLabel}</dd>
              </div>
              <div>
                <dt className="text-gray-500">Experience</dt>
                <dd className="font-medium">{experienceLabel}</dd>
              </div>
              <div>
                <dt className="text-gray-500">Localisation</dt>
                <dd className="font-medium">{profile.ville} ({profile.code_postal})</dd>
              </div>
              <div>
                <dt className="text-gray-500">Rayon d'intervention</dt>
                <dd className="font-medium">{profile.rayon_km} km</dd>
              </div>
              {profile.permis_conduire && (
                <div>
                  <dt className="text-gray-500">Permis de conduire</dt>
                  <dd className="font-medium">Oui{profile.vehicule ? ' (avec vehicule)' : ''}</dd>
                </div>
              )}
            </dl>
          </div>

          {/* Specialites */}
          <div className="bg-white rounded-xl border p-6">
            <h3 className="font-semibold mb-4">Specialites ({specialiteLabels.length})</h3>
            <div className="flex flex-wrap gap-2">
              {specialiteLabels.map((label, i) => (
                <span key={i} className="px-3 py-1 bg-gray-100 text-gray-700 rounded-full text-xs font-medium">
                  {label}
                </span>
              ))}
            </div>
          </div>

          {/* Description */}
          <div className="bg-white rounded-xl border p-6">
            <h3 className="font-semibold mb-4">Description</h3>
            {profile.description ? (
              <p className="text-sm text-gray-700 whitespace-pre-wrap">{profile.description}</p>
            ) : (
              <p className="text-sm text-gray-400">Aucune description fournie.</p>
            )}
          </div>

          {/* Justificatifs */}
          <div className="bg-white rounded-xl border p-6 md:col-span-2">
            <h3 className="font-semibold mb-4">Justificatifs</h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <p className="text-sm text-gray-500 mb-2">Piece d'identite</p>
                {identiteUrl ? (
                  <a
                    href={identiteUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center px-4 py-2 border border-gray-300 rounded-lg text-sm hover:border-black transition"
                  >
                    Voir le document
                  </a>
                ) : (
                  <p className="text-sm text-gray-400">Non fourni</p>
                )}
              </div>
              <div>
                <p className="text-sm text-gray-500 mb-2">Diplome</p>
                {diplomeUrl ? (
                  <a
                    href={diplomeUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center px-4 py-2 border border-gray-300 rounded-lg text-sm hover:border-black transition"
                  >
                    Voir le document
                  </a>
                ) : (
                  <p className="text-sm text-gray-400">Non fourni</p>
                )}
              </div>
            </div>
          </div>

          {/* Analyse OCR */}
          <div className="bg-white rounded-xl border p-6 md:col-span-2">
            <h3 className="font-semibold mb-4">Analyse OCR</h3>
            {ocrResults && ocrResults.length > 0 ? (
              <div className="space-y-4">
                {ocrResults.map((ocr: any) => (
                  <div key={ocr.id} className="border rounded-lg p-4">
                    <div className="flex items-center justify-between mb-3">
                      <span className="text-sm font-medium">
                        {ocr.document_type === 'identite' ? "Piece d'identite" : 'Diplome'}
                      </span>
                      <span className="text-xs text-gray-500">
                        {new Date(ocr.created_at).toLocaleDateString('fr-FR', {
                          day: 'numeric',
                          month: 'long',
                          year: 'numeric',
                          hour: '2-digit',
                          minute: '2-digit',
                        })}
                      </span>
                    </div>

                    {ocr.confidence_score !== null && (
                      <div className="mb-3">
                        <p className="text-xs text-gray-500 mb-1">Confiance</p>
                        <div className="flex items-center gap-2">
                          <div className="flex-1 bg-gray-100 rounded-full h-2">
                            <div
                              className="bg-gray-700 h-2 rounded-full"
                              style={{ width: `${ocr.confidence_score}%` }}
                            />
                          </div>
                          <span className="text-xs font-medium">{ocr.confidence_score}%</span>
                        </div>
                      </div>
                    )}

                    <div className="flex gap-3 mb-3">
                      {ocr.document_type === 'identite' && ocr.coherence_identite !== null && (
                        <span
                          className={`text-xs px-2 py-1 rounded-full font-medium ${
                            ocr.coherence_identite
                              ? 'bg-gray-100 text-gray-800'
                              : 'bg-gray-200 text-gray-600'
                          }`}
                        >
                          Identite : {ocr.coherence_identite ? 'coherent' : 'non coherent'}
                        </span>
                      )}
                      {ocr.document_type === 'diplome' && ocr.coherence_diplome !== null && (
                        <span
                          className={`text-xs px-2 py-1 rounded-full font-medium ${
                            ocr.coherence_diplome
                              ? 'bg-gray-100 text-gray-800'
                              : 'bg-gray-200 text-gray-600'
                          }`}
                        >
                          Diplome : {ocr.coherence_diplome ? 'coherent' : 'non coherent'}
                        </span>
                      )}
                    </div>

                    {ocr.alerts && (ocr.alerts as string[]).length > 0 && (
                      <div className="mb-3">
                        <p className="text-xs text-gray-500 mb-1">Alertes</p>
                        <ul className="space-y-1">
                          {(ocr.alerts as string[]).map((alert: string, i: number) => (
                            <li key={i} className="text-xs text-gray-600 bg-gray-50 px-2 py-1 rounded">
                              {alert}
                            </li>
                          ))}
                        </ul>
                      </div>
                    )}

                    {ocr.extracted_text && (
                      <details className="mt-2">
                        <summary className="text-xs text-gray-500 cursor-pointer hover:text-gray-700">
                          Texte extrait
                        </summary>
                        <pre className="mt-2 text-xs text-gray-600 bg-gray-50 p-3 rounded-lg whitespace-pre-wrap max-h-48 overflow-y-auto">
                          {ocr.extracted_text.length > 1000
                            ? ocr.extracted_text.slice(0, 1000) + '...'
                            : ocr.extracted_text}
                        </pre>
                      </details>
                    )}
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-sm text-gray-400">
                {(profile.justificatif_identite_url || profile.justificatif_diplome_url)
                  ? 'Analyse en cours ou non disponible.'
                  : 'Aucun justificatif uploade.'}
              </p>
            )}
          </div>
        </div>

        {/* Actions de validation */}
        {profile.validation_status === 'en_attente' && (
          <div className="mt-8">
            <ValidationActions profileId={id} />
          </div>
        )}
      </div>
    </main>
  )
}

function StatusBadge({ status }: { status: string }) {
  const styles: Record<string, string> = {
    en_attente: 'bg-gray-200 text-gray-700',
    valide: 'bg-black text-white',
    refuse: 'bg-gray-100 text-gray-900 border border-gray-300',
    a_completer: 'bg-gray-100 text-gray-700 border border-gray-300',
  }

  const labels: Record<string, string> = {
    en_attente: 'En attente',
    valide: 'Valide',
    refuse: 'Refuse',
    a_completer: 'A completer',
  }

  return (
    <span className={`px-3 py-1 rounded-full text-sm font-medium ${styles[status] || 'bg-gray-100 text-gray-600'}`}>
      {labels[status] || status}
    </span>
  )
}
