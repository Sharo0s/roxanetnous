import type { SupabaseClient } from '@supabase/supabase-js'
import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import Link from 'next/link'
import { DIPLOMES, SPECIALITES, formatExperienceLabel } from '@/lib/constants'
import { ValidationActions } from '@/components/admin/validation-actions'
import type { Database } from '@/types/supabase'

export default async function ValidationDetailPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params
  const supabase = await createClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  // Story 4.6 (variante locale SCP) : cast localise au point d'appel.
  const supabaseAdmin = (await createClient({ serviceRole: true })) as unknown as SupabaseClient<Database>

  const { data: profile } = await supabaseAdmin
    .from('accompagnants_profiles')
    .select(`
      *,
      users!user_id (first_name, last_name, email, phone, created_at)
    `)
    .eq('id', id)
    .single()

  if (!profile) redirect('/admin')

  const u = profile.users

  const diplomeLabels = (profile.diplomes as string[] || []).map(
    (d) => DIPLOMES.find((dp) => dp.value === d)?.label || d
  )
  const experienceLabel = formatExperienceLabel(profile.experience)
  const specialiteLabels = (profile.specialites as string[] | null || []).map(
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
    target_type: 'accompagnant',
    target_id: id,
    details: { viewed_at: new Date().toISOString() },
  })

  return (
      <div className="max-w-4xl mx-auto px-4 py-10 md:py-14">
        <header className="flex items-end justify-between mb-8 gap-4 flex-wrap">
          <div>
            <div className="text-xs uppercase tracking-[0.18em] text-kraft mb-2">Validation accompagnant</div>
            <h1 className="text-3xl md:text-4xl italic text-gray-900 leading-tight">
              {u?.first_name} {u?.last_name}
            </h1>
            <p className="text-sm text-gray-600 mt-2">{u?.email}</p>
          </div>
          <StatusBadge status={profile.validation_status} />
        </header>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* Informations personnelles */}
          <div className="bg-white rounded-2xl border border-[#e8dfd2] p-6">
            <h2 className="font-semibold mb-4">Informations personnelles</h2>
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
                  <dt className="text-gray-500">Téléphone</dt>
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
          <div className="bg-white rounded-2xl border border-[#e8dfd2] p-6">
            <h2 className="font-semibold mb-4">Profil professionnel</h2>
            <dl className="space-y-3 text-sm">
              <div>
                <dt className="text-gray-500">Diplômes</dt>
                <dd className="font-medium">{diplomeLabels.join(', ')}</dd>
              </div>
              <div>
                <dt className="text-gray-500">Expérience</dt>
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
                  <dd className="font-medium">Oui{profile.vehicule ? ' (avec véhicule)' : ''}</dd>
                </div>
              )}
            </dl>
          </div>

          {/* Specialites */}
          <div className="bg-white rounded-2xl border border-[#e8dfd2] p-6">
            <h2 className="font-semibold mb-4">Spécialités ({specialiteLabels.length})</h2>
            <div className="flex flex-wrap gap-2">
              {specialiteLabels.map((label, i) => (
                <span key={i} className="px-3 py-1 bg-gray-100 text-gray-700 rounded-full text-xs font-medium">
                  {label}
                </span>
              ))}
            </div>
          </div>

          {/* Description */}
          <div className="bg-white rounded-2xl border border-[#e8dfd2] p-6">
            <h2 className="font-semibold mb-4">Description</h2>
            {profile.description ? (
              <p className="text-sm text-gray-700 whitespace-pre-wrap">{profile.description}</p>
            ) : (
              <p className="text-sm text-gray-400">Aucune description fournie.</p>
            )}
          </div>

          {/* Justificatifs */}
          <div className="bg-white rounded-2xl border border-[#e8dfd2] p-6 md:col-span-2">
            <h2 className="font-semibold mb-4">Justificatifs</h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              <div>
                <p className="text-sm text-gray-500 mb-2">CV</p>
                {cvUrl ? (
                  <a
                    href={cvUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center px-4 py-2 border border-gray-400 rounded-lg text-sm hover:border-accent transition"
                  >
                    Voir le document
                  </a>
                ) : (
                  <p className="text-sm text-gray-400">Non fourni</p>
                )}
              </div>
              <div>
                <p className="text-sm text-gray-500 mb-2">Pièce d'identité</p>
                {identiteUrl ? (
                  <a
                    href={identiteUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center px-4 py-2 border border-gray-400 rounded-lg text-sm hover:border-accent transition"
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
                    className="inline-flex items-center px-4 py-2 border border-gray-400 rounded-lg text-sm hover:border-accent transition"
                  >
                    Voir le document
                  </a>
                ) : (
                  <p className="text-sm text-gray-400">Non fourni</p>
                )}
              </div>
              {diplomeUrls.map((d, i) => (
                <div key={i}>
                  <p className="text-sm text-gray-500 mb-2">Diplôme : {d.label}</p>
                  <a
                    href={d.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center px-4 py-2 border border-gray-400 rounded-lg text-sm hover:border-accent transition"
                  >
                    Voir le document
                  </a>
                </div>
              ))}
              {diplomeUrls.length === 0 && (
                <div>
                  <p className="text-sm text-gray-500 mb-2">Diplômes</p>
                  <p className="text-sm text-gray-400">Non fourni</p>
                </div>
              )}
            </div>
          </div>

        </div>

        {/* Bloc visio realisee */}
        {profile.visio_date && (
          <div className="mt-8 bg-white rounded-2xl border border-[#e8dfd2] p-6">
            <h2 className="font-semibold mb-3">Visio de validation</h2>
            <dl className="space-y-2 text-sm">
              <div className="flex gap-2">
                <dt className="text-gray-500">Réalisée le :</dt>
                <dd className="font-medium">
                  {new Date(profile.visio_date).toLocaleString('fr-FR', {
                    day: 'numeric',
                    month: 'long',
                    year: 'numeric',
                    hour: '2-digit',
                    minute: '2-digit',
                  })}
                </dd>
              </div>
              {profile.visio_notes && (
                <div>
                  <dt className="text-gray-500 mb-1">Notes :</dt>
                  <dd className="text-gray-700 whitespace-pre-wrap">{profile.visio_notes}</dd>
                </div>
              )}
            </dl>
          </div>
        )}

        {/* Actions de validation */}
        {(profile.validation_status === 'en_attente' ||
          profile.validation_status === 'visio_a_planifier' ||
          profile.validation_status === 'visio_realisee') && (
          <div className="mt-8">
            <ValidationActions profileId={id} status={profile.validation_status} />
          </div>
        )}
      </div>
  )
}

function StatusBadge({ status }: { status: string }) {
  const styles: Record<string, string> = {
    en_attente: 'bg-gray-200 text-gray-700',
    visio_a_planifier: 'bg-blue-50 text-blue-800 border border-blue-200',
    visio_realisee: 'bg-amber-50 text-amber-800 border border-amber-200',
    valide: 'bg-accent text-black',
    refuse: 'bg-gray-100 text-gray-900 border border-gray-300',
    a_completer: 'bg-gray-100 text-gray-700 border border-gray-300',
  }

  const labels: Record<string, string> = {
    en_attente: 'En attente',
    visio_a_planifier: 'En attente de visio',
    visio_realisee: 'Visio réalisée',
    valide: 'Validé',
    refuse: 'Refusé',
    a_completer: 'À compléter',
  }

  return (
    <span className={`px-3 py-1 rounded-full text-sm font-medium ${styles[status] || 'bg-gray-100 text-gray-600'}`}>
      {labels[status] || status}
    </span>
  )
}
