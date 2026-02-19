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

  const diplomeLabels = (profile.diplomes as string[] || []).map(
    (d) => DIPLOMES.find((dp) => dp.value === d)?.label || d
  )
  const experienceLabel = EXPERIENCE_LEVELS.find((e) => e.value === profile.experience)?.label || profile.experience
  const specialiteLabels = (profile.specialites as string[]).map(
    (s) => SPECIALITES.find((sp) => sp.value === s)?.label || s
  )

  // Generer les URLs signees pour les justificatifs
  let identiteUrl: string | null = null
  const diplomeUrls: { label: string; url: string }[] = []
  let permisUrl: string | null = null
  let cvUrl: string | null = null

  if (profile.justificatif_identite_url) {
    const { data } = await supabaseAdmin.storage
      .from('justificatifs')
      .createSignedUrl(profile.justificatif_identite_url, 3600)
    identiteUrl = data?.signedUrl || null
  }

  const justificatifsDiplomes = (profile.justificatifs_diplomes as Record<string, string>) || {}
  for (const [diplomeValue, storagePath] of Object.entries(justificatifsDiplomes)) {
    if (!storagePath) continue
    const { data } = await supabaseAdmin.storage
      .from('justificatifs')
      .createSignedUrl(storagePath, 3600)
    if (data?.signedUrl) {
      const label = DIPLOMES.find((d) => d.value === diplomeValue)?.label || diplomeValue
      diplomeUrls.push({ label, url: data.signedUrl })
    }
  }

  if (profile.justificatif_permis_url) {
    const { data } = await supabaseAdmin.storage
      .from('justificatifs')
      .createSignedUrl(profile.justificatif_permis_url, 3600)
    permisUrl = data?.signedUrl || null
  }

  if (profile.justificatif_cv_url) {
    const { data } = await supabaseAdmin.storage
      .from('justificatifs')
      .createSignedUrl(profile.justificatif_cv_url, 3600)
    cvUrl = data?.signedUrl || null
  }

  // Logger la consultation
  await supabaseAdmin.from('admin_actions_log').insert({
    admin_id: user.id,
    action_type: 'consultation_justificatif',
    target_type: 'auxiliaire',
    target_id: id,
    details: { viewed_at: new Date().toISOString() },
  })

  return (
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
                <dt className="text-gray-500">Diplomes</dt>
                <dd className="font-medium">{diplomeLabels.join(', ')}</dd>
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
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              <div>
                <p className="text-sm text-gray-500 mb-2">CV</p>
                {cvUrl ? (
                  <a
                    href={cvUrl}
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
                <p className="text-sm text-gray-500 mb-2">Permis de conduire</p>
                {permisUrl ? (
                  <a
                    href={permisUrl}
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
              {diplomeUrls.map((d, i) => (
                <div key={i}>
                  <p className="text-sm text-gray-500 mb-2">Diplome : {d.label}</p>
                  <a
                    href={d.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center px-4 py-2 border border-gray-300 rounded-lg text-sm hover:border-black transition"
                  >
                    Voir le document
                  </a>
                </div>
              ))}
              {diplomeUrls.length === 0 && (
                <div>
                  <p className="text-sm text-gray-500 mb-2">Diplomes</p>
                  <p className="text-sm text-gray-400">Non fourni</p>
                </div>
              )}
            </div>
          </div>

        </div>

        {/* Actions de validation */}
        {profile.validation_status === 'en_attente' && (
          <div className="mt-8">
            <ValidationActions profileId={id} />
          </div>
        )}
      </div>
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
