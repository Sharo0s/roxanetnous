import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import Link from 'next/link'
import { DIPLOMES, SPECIALITES, JOURS_SEMAINE, CRENEAUX, formatExperienceLabel } from '@/lib/constants'
import { ValidationActions } from '@/components/admin/validation-actions'
import { DeleteUserButton } from '@/components/admin/delete-user-button'
import { CancelSubscriptionButton } from '@/components/admin/cancel-subscription-button'
import { getSubscriptionStatus } from '@/lib/subscription-helpers'

const ROLE_LABELS: Record<string, string> = {
  accompagnante: 'Accompagnant',
  accompagne: 'Accompagné',
  admin: 'Administrateur',
}

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

  // Verifier que l'utilisateur connecte est admin
  const { data: currentUserData } = await supabaseAdmin
    .from('users')
    .select('role')
    .eq('id', user.id)
    .single()

  if (!currentUserData || currentUserData.role !== 'admin') {
    redirect('/')
  }

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

  // Charger l'abonnement
  const subscriptionStatus = await getSubscriptionStatus(id)

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
  const experienceLabel = auxProfile?.experience ? formatExperienceLabel(auxProfile.experience) : null
  const specialiteLabels = (auxProfile?.specialites as string[] || []).map(
    (s: string) => SPECIALITES.find((sp) => sp.value === s)?.label || s
  )

  // Disponibilites
  const disponibilites = auxProfile?.disponibilites as Record<string, string[]> | null

  return (
    <div className="max-w-5xl mx-auto px-4 py-8">
      {/* Navigation retour */}
      <Link
        href="/admin/utilisateurs"
        className="inline-flex items-center gap-2 text-sm font-medium text-gray-700 hover:text-black mb-8 px-3 py-1.5 -ml-3 rounded-lg bg-white transition-colors"
      >
        <span aria-hidden="true">&larr;</span> Retour aux utilisateurs
      </Link>

      {/* En-tete utilisateur */}
      <div className="bg-white rounded-2xl border border-[#e8dfd2] overflow-hidden mb-8">
        <div className="bg-accent/20 px-6 py-5">
          <div className="flex items-start justify-between">
            <div className="flex items-center gap-4">
              <div className="w-14 h-14 rounded-full bg-accent/60 flex items-center justify-center text-xl font-bold text-black/70 shrink-0">
                {userData.first_name?.[0]}{userData.last_name?.[0]}
              </div>
              <div>
                <h1 className="italic text-3xl text-gray-900 leading-tight">
                  {userData.first_name} {userData.last_name}
                </h1>
                <p className="text-sm text-gray-600 mt-0.5">{userData.email}</p>
                {userData.phone && (
                  <p className="text-sm text-gray-500 mt-0.5">{userData.phone}</p>
                )}
              </div>
            </div>
            <div className="flex items-center gap-2 mt-1">
              <span className="px-2.5 py-1 rounded-full text-xs font-medium bg-white/80 text-gray-700">
                {ROLE_LABELS[userData.role] || userData.role}
              </span>
              {auxProfile && (
                <StatusBadge
                  status={auxProfile.validation_status}
                  source={auxProfile.validation_source}
                />
              )}
            </div>
          </div>
        </div>
        <div className="px-6 py-3 flex items-center gap-6 text-sm text-gray-500 border-t border-accent/10">
          <span>Inscrit le {new Date(userData.created_at).toLocaleDateString('fr-FR')}</span>
          {(auxProfile?.ville || benProfile?.ville) && (
            <span>
              {auxProfile?.ville || benProfile?.ville}
              {(auxProfile?.code_postal || benProfile?.code_postal) && (
                <> ({auxProfile?.code_postal || benProfile?.code_postal})</>
              )}
            </span>
          )}
          {auxProfile?.rayon_km && (
            <span>Rayon : {auxProfile.rayon_km} km</span>
          )}
        </div>
      </div>

      {/* Actions de validation (accompagnante en cycle de validation) */}
      {auxProfile && (
        auxProfile.validation_status === 'en_attente' ||
        auxProfile.validation_status === 'visio_a_planifier' ||
        auxProfile.validation_status === 'visio_realisee'
      ) && (
        <div className="mb-8">
          <ValidationActions profileId={auxProfile.id} status={auxProfile.validation_status} />
        </div>
      )}

      {/* Bloc visio realisee */}
      {auxProfile?.visio_date && (
        <div className="mb-8 bg-white rounded-2xl border border-[#e8dfd2] p-5">
          <h2 className="font-semibold mb-3">Visio de validation</h2>
          <dl className="space-y-2 text-sm">
            <div className="flex gap-2">
              <dt className="text-gray-500">Réalisée le :</dt>
              <dd className="font-medium">
                {new Date(auxProfile.visio_date).toLocaleString('fr-FR', {
                  day: 'numeric',
                  month: 'long',
                  year: 'numeric',
                  hour: '2-digit',
                  minute: '2-digit',
                })}
              </dd>
            </div>
            {auxProfile.visio_notes && (
              <div>
                <dt className="text-gray-500 mb-1">Notes :</dt>
                <dd className="text-gray-700 whitespace-pre-wrap">{auxProfile.visio_notes}</dd>
              </div>
            )}
          </dl>
        </div>
      )}

      {/* Refus motif */}
      {auxProfile?.validation_status === 'refuse' && auxProfile.refus_motif && (
        <div role="alert" className="mb-8 bg-red-50 border border-red-200 rounded-xl p-5">
          <h2 className="font-semibold text-red-800 mb-1">Motif du refus</h2>
          <p className="text-sm text-red-700">{auxProfile.refus_motif}</p>
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Informations personnelles */}
        <div className="bg-white rounded-2xl border border-[#e8dfd2] p-6">
          <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wide mb-4">Informations personnelles</h2>
          <dl className="space-y-4 text-sm">
            <div className="flex justify-between">
              <dt className="text-gray-500">Nom complet</dt>
              <dd className="font-medium text-right">{userData.first_name} {userData.last_name}</dd>
            </div>
            <div className="flex justify-between">
              <dt className="text-gray-500">Email</dt>
              <dd className="font-medium text-right">{userData.email}</dd>
            </div>
            {userData.phone && (
              <div className="flex justify-between">
                <dt className="text-gray-500">Téléphone</dt>
                <dd className="font-medium text-right">{userData.phone}</dd>
              </div>
            )}
            <div className="flex justify-between">
              <dt className="text-gray-500">Inscription</dt>
              <dd className="font-medium text-right">
                {new Date(userData.created_at).toLocaleDateString('fr-FR')}
              </dd>
            </div>
          </dl>
        </div>

        {/* Localisation */}
        {(auxProfile || benProfile) && (
          <div className="bg-white rounded-2xl border border-[#e8dfd2] p-6">
            <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wide mb-4">Localisation</h2>
            <dl className="space-y-4 text-sm">
              {(auxProfile?.adresse || benProfile?.adresse) && (
                <div className="flex justify-between">
                  <dt className="text-gray-500">Adresse</dt>
                  <dd className="font-medium text-right">{auxProfile?.adresse || benProfile?.adresse}</dd>
                </div>
              )}
              <div className="flex justify-between">
                <dt className="text-gray-500">Ville</dt>
                <dd className="font-medium text-right">
                  {(auxProfile?.ville || benProfile?.ville) || '-'}{' '}
                  {(auxProfile?.code_postal || benProfile?.code_postal) && (
                    <span className="text-gray-400">
                      ({auxProfile?.code_postal || benProfile?.code_postal})
                    </span>
                  )}
                </dd>
              </div>
              {auxProfile?.rayon_km && (
                <div className="flex justify-between">
                  <dt className="text-gray-500">Rayon d&apos;intervention</dt>
                  <dd className="font-medium text-right">{auxProfile.rayon_km} km</dd>
                </div>
              )}
              {auxProfile?.permis_conduire !== undefined && (
                <div className="flex justify-between">
                  <dt className="text-gray-500">Permis de conduire</dt>
                  <dd className="font-medium text-right">
                    {auxProfile.permis_conduire
                      ? `Oui${auxProfile.vehicule ? ' (avec véhicule)' : ''}`
                      : 'Non'}
                  </dd>
                </div>
              )}
            </dl>
          </div>
        )}

        {/* Profil professionnel (accompagnante) */}
        {auxProfile && (
          <div className="bg-white rounded-2xl border border-[#e8dfd2] p-6">
            <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wide mb-4">Profil professionnel</h2>
            <dl className="space-y-4 text-sm">
              <div className="flex justify-between">
                <dt className="text-gray-500">Diplômes</dt>
                <dd className="font-medium text-right">
                  {diplomeLabels.length > 0 ? diplomeLabels.join(', ') : '-'}
                </dd>
              </div>
              <div className="flex justify-between">
                <dt className="text-gray-500">Expérience</dt>
                <dd className="font-medium text-right">{experienceLabel || '-'}</dd>
              </div>
              {auxProfile.langues && (auxProfile.langues as string[]).length > 0 && (
                <div className="flex justify-between">
                  <dt className="text-gray-500">Langues</dt>
                  <dd className="font-medium text-right">{(auxProfile.langues as string[]).join(', ')}</dd>
                </div>
              )}
            </dl>
          </div>
        )}

        {/* Specialites (accompagnante) */}
        {auxProfile && specialiteLabels.length > 0 && (
          <div className="bg-white rounded-2xl border border-[#e8dfd2] p-6">
            <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wide mb-4">
              Spécialités <span className="text-gray-400 normal-case tracking-normal">({specialiteLabels.length})</span>
            </h2>
            <div className="flex flex-wrap gap-2">
              {specialiteLabels.map((label: string, i: number) => (
                <span
                  key={i}
                  className="px-3 py-1.5 bg-accent/15 text-gray-800 rounded-lg text-xs font-medium"
                >
                  {label}
                </span>
              ))}
            </div>
          </div>
        )}

        {/* Disponibilites (accompagnante) */}
        {auxProfile && disponibilites && Object.keys(disponibilites).length > 0 && (
          <div className="bg-white rounded-2xl border border-[#e8dfd2] p-6 md:col-span-2">
            <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wide mb-4">Disponibilités</h2>
            <div className="overflow-x-auto">
              <table className="w-full text-xs">
                <thead>
                  <tr>
                    <th className="text-left py-2 pr-3 font-medium text-gray-500"></th>
                    {CRENEAUX.map((c) => (
                      <th key={c.value} className="text-center py-2 px-2 font-medium text-gray-500">
                        {c.label}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {JOURS_SEMAINE.map((j) => (
                    <tr key={j.value} className="border-t">
                      <td className="py-2 pr-3 font-medium text-gray-700">{j.label}</td>
                      {CRENEAUX.map((c) => (
                        <td key={c.value} className="text-center py-2 px-2">
                          {disponibilites[j.value]?.includes(c.value) ? (
                            <span className="inline-block w-5 h-5 bg-accent rounded"></span>
                          ) : (
                            <span className="inline-block w-5 h-5 bg-gray-100 rounded"></span>
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
          <div className="bg-white rounded-2xl border border-[#e8dfd2] p-6 md:col-span-2">
            <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wide mb-4">Description</h2>
            {auxProfile.description ? (
              <p className="text-sm text-gray-700 whitespace-pre-wrap leading-relaxed">{auxProfile.description}</p>
            ) : (
              <p className="text-sm text-gray-400 italic">Aucune description fournie.</p>
            )}
          </div>
        )}

        {/* Justificatifs (accompagnante) */}
        {auxProfile && (
          <div className="bg-white rounded-2xl border border-[#e8dfd2] p-6 md:col-span-2">
            <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wide mb-4">Justificatifs</h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              <DocLink label="CV" url={cvUrl} />
              <DocLink label="Pièce d'identité" url={identiteUrl} />
              <DocLink label="Permis de conduire" url={permisUrl} />
              {diplomeUrls.map((d, i) => (
                <DocLink key={i} label={`Diplôme : ${d.label}`} url={d.url} />
              ))}
              {diplomeUrls.length === 0 && (
                <DocLink label="Diplômes" url={null} />
              )}
            </div>
          </div>
        )}
      </div>

      {/* Abonnement */}
      {(userData.role === 'accompagnante' || userData.role === 'accompagne') && (
        <div className="bg-white rounded-2xl border border-[#e8dfd2] p-6 mt-6">
          <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wide mb-4">Abonnement</h2>
          {subscriptionStatus.status ? (
            <dl className="space-y-3 text-sm">
              <div className="flex justify-between items-center">
                <dt className="text-gray-500">Statut</dt>
                <dd>
                  <span className={`px-2.5 py-1 rounded-full text-xs font-medium ${
                    subscriptionStatus.active
                      ? subscriptionStatus.cancelAt ? 'bg-gray-200 text-gray-700' : 'bg-accent text-black'
                      : 'bg-gray-100 text-gray-600'
                  }`}>
                    {subscriptionStatus.status === 'trialing'
                      ? 'Essai gratuit'
                      : subscriptionStatus.cancelAt
                        ? 'Annulation prévue'
                        : subscriptionStatus.status === 'active'
                          ? 'Actif'
                          : subscriptionStatus.status === 'past_due'
                            ? 'Paiement en retard'
                            : 'Annulé'}
                  </span>
                </dd>
              </div>
              {subscriptionStatus.planType && (
                <div className="flex justify-between">
                  <dt className="text-gray-500">Formule</dt>
                  <dd className="font-medium">{subscriptionStatus.planType === 'annuel' ? 'Annuel' : 'Mensuel'}</dd>
                </div>
              )}
              {subscriptionStatus.currentPeriodEnd && (
                <div className="flex justify-between">
                  <dt className="text-gray-500">Prochaine échéance</dt>
                  <dd className="font-medium">{new Date(subscriptionStatus.currentPeriodEnd).toLocaleDateString('fr-FR')}</dd>
                </div>
              )}
              {subscriptionStatus.cancelAt && (
                <div className="flex justify-between">
                  <dt className="text-gray-500">Fin d&apos;accès prévue</dt>
                  <dd className="font-medium">{new Date(subscriptionStatus.cancelAt).toLocaleDateString('fr-FR')}</dd>
                </div>
              )}
              {subscriptionStatus.cancelFeedback && (
                <div className="flex justify-between">
                  <dt className="text-gray-500">Raison</dt>
                  <dd className="font-medium">{
                    { customer_service: 'Service client', low_quality: 'Qualité insuffisante', missing_features: 'Fonctionnalités manquantes', switched_service: 'Passé à un concurrent', too_complex: 'Trop complexe', too_expensive: 'Trop cher', unused: 'Non utilisé', other: 'Autre' }[subscriptionStatus.cancelFeedback] || subscriptionStatus.cancelFeedback
                  }</dd>
                </div>
              )}
              {subscriptionStatus.cancelComment && (
                <div className="flex justify-between">
                  <dt className="text-gray-500">Commentaire</dt>
                  <dd className="font-medium text-right max-w-xs">{subscriptionStatus.cancelComment}</dd>
                </div>
              )}
              {subscriptionStatus.active && !subscriptionStatus.cancelAt && (
                <CancelSubscriptionButton
                  userId={id}
                  userName={`${userData.first_name} ${userData.last_name}`}
                />
              )}
            </dl>
          ) : (
            <p className="text-sm text-gray-400">Aucun abonnement</p>
          )}
        </div>
      )}

      {/* Actions rapides */}
      <div className="mt-8 flex flex-wrap gap-3">
        <a
          href={`mailto:${userData.email}`}
          className="px-4 py-2.5 text-sm font-medium bg-white border border-gray-400 rounded-lg hover:border-accent transition-colors"
        >
          Envoyer un email
        </a>
        {auxProfile?.validation_status === 'valide' && (
          <Link
            href={`/recherche?accompagnante=${id}`}
            className="px-4 py-2.5 text-sm font-medium bg-white border border-gray-400 rounded-lg hover:border-accent transition-colors"
            target="_blank"
          >
            Voir le profil public
          </Link>
        )}
      </div>

      {/* Suppression */}
      <div className="mt-10 pt-8 border-t border-black">
        <DeleteUserButton
          userId={userData.id}
          userName={`${userData.first_name} ${userData.last_name}`}
        />
      </div>
    </div>
  )
}

function StatusBadge({ status, source }: { status: string; source?: string | null }) {
  const styles: Record<string, string> = {
    en_attente: 'bg-gray-200 text-gray-700',
    visio_a_planifier: 'bg-blue-50 text-blue-800 border border-blue-200',
    visio_realisee: 'bg-amber-50 text-amber-800 border border-amber-200',
    valide: 'bg-accent text-black',
    refuse: 'bg-white text-gray-900 border border-gray-400',
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

  const showParrainage = status === 'valide' && source === 'parrainage'
  const label = showParrainage ? 'Validé · parrainage' : labels[status] || status

  return (
    <span
      className={`px-3 py-1 rounded-full text-sm font-medium ${styles[status] || 'bg-gray-100 text-gray-600'}`}
      title={showParrainage ? 'Validée par parrainage (filière express, sans visio ni OCR)' : undefined}
    >
      {label}
    </span>
  )
}

function DocLink({ label, url }: { label: string; url: string | null }) {
  return (
    <div className={`rounded-lg border p-4 ${url ? 'bg-gray-50 hover:border-accent transition-colors' : 'bg-gray-50/50 border-dashed'}`}>
      <p className="text-xs text-gray-500 mb-1.5">{label}</p>
      {url ? (
        <a
          href={url}
          target="_blank"
          rel="noopener noreferrer"
          className="text-sm font-medium text-gray-900 hover:text-accent transition-colors"
        >
          Voir le document &rarr;
        </a>
      ) : (
        <p className="text-sm text-gray-400 italic">Non fourni</p>
      )}
    </div>
  )
}
