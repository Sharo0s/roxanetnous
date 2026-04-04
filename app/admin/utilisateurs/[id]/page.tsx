import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import Link from 'next/link'
import { DIPLOMES, EXPERIENCE_LEVELS, SPECIALITES, JOURS_SEMAINE, CRENEAUX } from '@/lib/constants'
import { ValidationActions } from '@/components/admin/validation-actions'

export default async function AdminUtilisateurDetailPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params
  const supabase = await createClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const supabaseAdmin = await createClient({ serviceRole: true })

  // Charger l'utilisateur
  const { data: userData } = await supabaseAdmin
    .from('users')
    .select('id, email, first_name, last_name, role, phone, created_at')
    .eq('id', id)
    .single()

  if (!userData) redirect('/admin/utilisateurs')

  // Charger le profil selon le role
  let auxProfile: any = null
  let benProfile: any = null

  if (userData.role === 'accompagnante') {
    const { data } = await supabaseAdmin
      .from('accompagnantes_profiles')
      .select('*')
      .eq('user_id', id)
      .single()
    auxProfile = data
  } else if (userData.role === 'accompagne') {
    const { data } = await supabaseAdmin
      .from('accompagnes_profiles')
      .select('*')
      .eq('user_id', id)
      .single()
    benProfile = data
  }

  // Generer les URLs signees pour les justificatifs accompagnante
  let identiteUrl: string | null = null
  let permisUrl: string | null = null
  let cvUrl: string | null = null
  const diplomeUrls: { label: string; url: string }[] = []

  if (auxProfile) {
    if (auxProfile.justificatif_identite_url) {
      const { data } = await supabaseAdmin.storage
        .from('justificatifs')
        .createSignedUrl(auxProfile.justificatif_identite_url, 3600)
      identiteUrl = data?.signedUrl || null
    }
    if (auxProfile.justificatif_permis_url) {
      const { data } = await supabaseAdmin.storage
        .from('justificatifs')
        .createSignedUrl(auxProfile.justificatif_permis_url, 3600)
      permisUrl = data?.signedUrl || null
    }
    if (auxProfile.justificatif_cv_url) {
      const { data } = await supabaseAdmin.storage
        .from('justificatifs')
        .createSignedUrl(auxProfile.justificatif_cv_url, 3600)
      cvUrl = data?.signedUrl || null
    }
    const justificatifsDiplomes = (auxProfile.justificatifs_diplomes as Record<string, string>) || {}
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
  }

  // Logger la consultation
  await supabaseAdmin.from('admin_actions_log').insert({
    admin_id: user.id,
    action_type: 'consultation_profil',
    target_type: userData.role,
    target_id: id,
    details: { viewed_at: new Date().toISOString() },
  })

  const diplomeLabels = (auxProfile?.diplomes as string[] || []).map(
    (d: string) => DIPLOMES.find((dp) => dp.value === d)?.label || d
  )
  const experienceLabel = auxProfile?.experience
    ? EXPERIENCE_LEVELS.find((e) => e.value === auxProfile.experience)?.label || auxProfile.experience
    : null
  const specialiteLabels = (auxProfile?.specialites as string[] || []).map(
    (s: string) => SPECIALITES.find((sp) => sp.value === s)?.label || s
  )

  // Disponibilites
  const disponibilites = auxProfile?.disponibilites as Record<string, string[]> | null

  return (
    <div className="max-w-4xl mx-auto px-4 py-8">
      {/* Navigation retour */}
      <Link
        href="/admin/utilisateurs"
        className="inline-flex items-center text-sm text-gray-500 hover:text-accent mb-6 transition-colors"
      >
        &larr; Retour aux utilisateurs
      </Link>

      {/* En-tete */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h2 className="text-2xl font-bold text-gray-900">
            {userData.first_name} {userData.last_name}
          </h2>
          <p className="text-gray-500">{userData.email}</p>
        </div>
        <div className="flex items-center gap-3">
          <span className="px-2 py-0.5 rounded-full text-xs font-medium bg-gray-200 text-gray-700">
            {userData.role}
          </span>
          {auxProfile && (
            <StatusBadge status={auxProfile.validation_status} />
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Informations personnelles */}
        <div className="bg-white rounded-xl border p-6">
          <h3 className="font-semibold mb-4">Informations personnelles</h3>
          <dl className="space-y-3 text-sm">
            <div>
              <dt className="text-gray-500">Nom complet</dt>
              <dd className="font-medium">{userData.first_name} {userData.last_name}</dd>
            </div>
            <div>
              <dt className="text-gray-500">Email</dt>
              <dd className="font-medium">{userData.email}</dd>
            </div>
            {userData.phone && (
              <div>
                <dt className="text-gray-500">Telephone</dt>
                <dd className="font-medium">{userData.phone}</dd>
              </div>
            )}
            <div>
              <dt className="text-gray-500">Inscription</dt>
              <dd className="font-medium">
                {new Date(userData.created_at).toLocaleDateString('fr-FR')}
              </dd>
            </div>
          </dl>
        </div>

        {/* Localisation */}
        {(auxProfile || benProfile) && (
          <div className="bg-white rounded-xl border p-6">
            <h3 className="font-semibold mb-4">Localisation</h3>
            <dl className="space-y-3 text-sm">
              {(auxProfile?.adresse || benProfile?.adresse) && (
                <div>
                  <dt className="text-gray-500">Adresse</dt>
                  <dd className="font-medium">{auxProfile?.adresse || benProfile?.adresse}</dd>
                </div>
              )}
              <div>
                <dt className="text-gray-500">Ville</dt>
                <dd className="font-medium">
                  {(auxProfile?.ville || benProfile?.ville) || '-'}{' '}
                  {(auxProfile?.code_postal || benProfile?.code_postal) && (
                    <span className="text-gray-400">
                      ({auxProfile?.code_postal || benProfile?.code_postal})
                    </span>
                  )}
                </dd>
              </div>
              {auxProfile?.rayon_km && (
                <div>
                  <dt className="text-gray-500">Rayon d'intervention</dt>
                  <dd className="font-medium">{auxProfile.rayon_km} km</dd>
                </div>
              )}
              {auxProfile?.permis_conduire !== undefined && (
                <div>
                  <dt className="text-gray-500">Permis de conduire</dt>
                  <dd className="font-medium">
                    {auxProfile.permis_conduire
                      ? `Oui${auxProfile.vehicule ? ' (avec vehicule)' : ''}`
                      : 'Non'}
                  </dd>
                </div>
              )}
            </dl>
          </div>
        )}

        {/* Profil professionnel (accompagnante) */}
        {auxProfile && (
          <div className="bg-white rounded-xl border p-6">
            <h3 className="font-semibold mb-4">Profil professionnel</h3>
            <dl className="space-y-3 text-sm">
              <div>
                <dt className="text-gray-500">Diplomes</dt>
                <dd className="font-medium">
                  {diplomeLabels.length > 0 ? diplomeLabels.join(', ') : '-'}
                </dd>
              </div>
              <div>
                <dt className="text-gray-500">Experience</dt>
                <dd className="font-medium">{experienceLabel || '-'}</dd>
              </div>
              {auxProfile.langues && (auxProfile.langues as string[]).length > 0 && (
                <div>
                  <dt className="text-gray-500">Langues</dt>
                  <dd className="font-medium">{(auxProfile.langues as string[]).join(', ')}</dd>
                </div>
              )}
            </dl>
          </div>
        )}

        {/* Specialites (accompagnante) */}
        {auxProfile && specialiteLabels.length > 0 && (
          <div className="bg-white rounded-xl border p-6">
            <h3 className="font-semibold mb-4">Specialites ({specialiteLabels.length})</h3>
            <div className="flex flex-wrap gap-2">
              {specialiteLabels.map((label: string, i: number) => (
                <span
                  key={i}
                  className="px-3 py-1 bg-gray-100 text-gray-700 rounded-full text-xs font-medium"
                >
                  {label}
                </span>
              ))}
            </div>
          </div>
        )}

        {/* Disponibilites (accompagnante) */}
        {auxProfile && disponibilites && Object.keys(disponibilites).length > 0 && (
          <div className="bg-white rounded-xl border p-6 md:col-span-2">
            <h3 className="font-semibold mb-4">Disponibilites</h3>
            <div className="overflow-x-auto">
              <table className="w-full text-xs">
                <thead>
                  <tr>
                    <th className="text-left py-1.5 pr-3 font-medium text-gray-500"></th>
                    {CRENEAUX.map((c) => (
                      <th key={c.value} className="text-center py-1.5 px-2 font-medium text-gray-500">
                        {c.label}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {JOURS_SEMAINE.map((j) => (
                    <tr key={j.value} className="border-t">
                      <td className="py-1.5 pr-3 font-medium text-gray-700">{j.label}</td>
                      {CRENEAUX.map((c) => (
                        <td key={c.value} className="text-center py-1.5 px-2">
                          {disponibilites[j.value]?.includes(c.value) ? (
                            <span className="inline-block w-4 h-4 bg-black rounded-sm"></span>
                          ) : (
                            <span className="inline-block w-4 h-4 bg-gray-100 rounded-sm"></span>
                          )}
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* Description (accompagnante) */}
        {auxProfile && (
          <div className="bg-white rounded-xl border p-6 md:col-span-2">
            <h3 className="font-semibold mb-4">Description</h3>
            {auxProfile.description ? (
              <p className="text-sm text-gray-700 whitespace-pre-wrap">{auxProfile.description}</p>
            ) : (
              <p className="text-sm text-gray-400">Aucune description fournie.</p>
            )}
          </div>
        )}

        {/* Justificatifs (accompagnante) */}
        {auxProfile && (
          <div className="bg-white rounded-xl border p-6 md:col-span-2">
            <h3 className="font-semibold mb-4">Justificatifs</h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              <DocLink label="CV" url={cvUrl} />
              <DocLink label="Piece d'identite" url={identiteUrl} />
              <DocLink label="Permis de conduire" url={permisUrl} />
              {diplomeUrls.map((d, i) => (
                <DocLink key={i} label={`Diplome : ${d.label}`} url={d.url} />
              ))}
              {diplomeUrls.length === 0 && (
                <DocLink label="Diplomes" url={null} />
              )}
            </div>
          </div>
        )}
      </div>

      {/* Actions de validation (accompagnante en attente) */}
      {auxProfile?.validation_status === 'en_attente' && (
        <div className="mt-8">
          <ValidationActions profileId={auxProfile.id} />
        </div>
      )}

      {/* Refus motif */}
      {auxProfile?.validation_status === 'refuse' && auxProfile.refus_motif && (
        <div className="mt-6 bg-white rounded-xl border p-6">
          <h3 className="font-semibold mb-2">Motif du refus</h3>
          <p className="text-sm text-gray-700">{auxProfile.refus_motif}</p>
        </div>
      )}

      {/* Actions rapides */}
      <div className="mt-8 flex gap-3">
        <a
          href={`mailto:${userData.email}`}
          className="px-4 py-2 text-sm font-medium border border-gray-300 rounded-lg hover:border-accent transition-colors"
        >
          Envoyer un email
        </a>
        {auxProfile?.validation_status === 'valide' && (
          <Link
            href={`/recherche?accompagnante=${id}`}
            className="px-4 py-2 text-sm font-medium border border-gray-300 rounded-lg hover:border-accent transition-colors"
            target="_blank"
          >
            Voir le profil public
          </Link>
        )}
      </div>
    </div>
  )
}

function StatusBadge({ status }: { status: string }) {
  const styles: Record<string, string> = {
    en_attente: 'bg-gray-200 text-gray-700',
    valide: 'bg-accent text-black',
    refuse: 'bg-white text-gray-900 border border-gray-400',
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

function DocLink({ label, url }: { label: string; url: string | null }) {
  return (
    <div>
      <p className="text-sm text-gray-500 mb-2">{label}</p>
      {url ? (
        <a
          href={url}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center px-4 py-2 border border-gray-300 rounded-lg text-sm hover:border-accent transition"
        >
          Voir le document
        </a>
      ) : (
        <p className="text-sm text-gray-400">Non fourni</p>
      )}
    </div>
  )
}
