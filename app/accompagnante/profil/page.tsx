import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { AccompagnanteProfileForm } from '@/components/accompagnante/profile-form'
import { ExportDataButton } from '@/components/export-data-button'
import { DeleteAccountButton } from '@/components/delete-account-button'
import { AccompagnanteHeader } from '@/components/layout/accompagnante-header'
import { getUnreadCount } from '@/lib/unread-count'
import { getCodesDepartementsOuverts } from '@/lib/departements'

export default async function AccompagnanteProfilPage() {
  const supabase = await createClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: userData } = await supabase
    .from('users')
    .select('first_name, last_name, email, phone, role, avatar_url')
    .eq('id', user.id)
    .single()

  if (!userData || userData.role !== 'accompagnante') redirect('/')

  const { data: profile } = await supabase
    .from('accompagnantes_profiles')
    .select('*')
    .eq('user_id', user.id)
    .single()

  if (!profile) redirect('/accompagnante/onboarding')

  let parrainageCode: string | null = null
  if (profile.validation_status === 'valide') {
    const { data: parrainageRow } = await supabase
      .from('parrainages_codes')
      .select('code')
      .eq('user_id', user.id)
      .maybeSingle()
    parrainageCode = parrainageRow?.code ?? null
  }

  const unreadCount = await getUnreadCount(user.id)
  const departementsOuverts = await getCodesDepartementsOuverts()

  return (
    <main id="main-content" tabIndex={-1} className="min-h-screen kraft bg-kraft focus:outline-none">
      <AccompagnanteHeader
        userId={user.id}
        unreadCount={unreadCount}
        firstName={userData.first_name}
        lastName={userData.last_name}
        currentPage="profil"
      />

      <div className="max-w-3xl mx-auto px-4 py-8 relative z-10">
        <h2 className="text-2xl font-bold text-gray-900 mb-6">Mon profil</h2>

        {parrainageCode && (
          <div className="mb-6 p-4 rounded-xl border bg-white">
            <p className="text-sm text-gray-600 mb-1">Votre code de parrainage</p>
            <p className="font-mono font-bold text-lg tracking-widest">{parrainageCode}</p>
          </div>
        )}

        {profile.validation_status === 'en_attente' && (
          <div className="mb-6 p-4 rounded-xl border bg-gray-50 text-sm text-gray-700">
            Votre profil est en cours de vérification par notre équipe.
          </div>
        )}
        {profile.validation_status === 'visio_a_planifier' && (
          <div className="mb-6 p-4 rounded-xl border border-blue-200 bg-blue-50 text-sm">
            <p className="font-medium text-blue-900">
              Votre dossier a été revu. Nous vous avons envoyé un email pour convenir d&apos;un créneau visio avec l&apos;équipe.
            </p>
          </div>
        )}
        {profile.validation_status === 'visio_realisee' && (
          <div className="mb-6 p-4 rounded-xl border border-amber-200 bg-amber-50 text-sm">
            <p className="font-medium text-amber-900">Visio réalisée — nous finalisons votre validation.</p>
          </div>
        )}
        {profile.validation_status === 'a_completer' && (
          <div className="mb-6 p-4 rounded-xl border border-red-200 bg-red-50 text-sm">
            <p className="font-medium text-red-800">Des informations complémentaires sont demandées.</p>
            {profile.refus_motif && (
              <p className="text-red-700 mt-1">Détails : {profile.refus_motif}</p>
            )}
          </div>
        )}
        {profile.validation_status === 'refuse' && (
          <div className="mb-6 p-4 rounded-xl border border-red-200 bg-red-50 text-sm">
            <p className="font-medium text-red-800">Votre profil a été refusé.</p>
            {profile.refus_motif && (
              <p className="text-red-700 mt-1">Motif : {profile.refus_motif}</p>
            )}
          </div>
        )}

        <AccompagnanteProfileForm
          userInfo={{
            first_name: userData.first_name || '',
            last_name: userData.last_name || '',
            email: userData.email,
            phone: userData.phone || '',
          }}
          profile={{
            diplomes: (profile.diplomes as string[]) || [],
            experience: profile.experience,
            specialites: profile.specialites as string[],
            ville: profile.ville || '',
            code_postal: profile.code_postal || '',
            rayon_km: profile.rayon_km || 10,
            disponibilites: (profile.disponibilites as Record<string, string[]>) || {},
            permis_conduire: profile.permis_conduire || false,
            vehicule: profile.vehicule || false,
            description: profile.description || '',
            justificatif_permis_url: profile.justificatif_permis_url || null,
            justificatifs_diplomes: (profile.justificatifs_diplomes as Record<string, string>) || {},
            justificatif_cv_url: profile.justificatif_cv_url || null,
          }}
          departementsOuverts={departementsOuverts}
        />

        <div className="mt-10 pt-8 border-t">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">Mes données personnelles</h3>
          <p className="text-sm text-gray-600 mb-4">
            Conformément au RGPD, vous pouvez exporter ou supprimer vos données à tout moment.
          </p>
          <div className="flex flex-wrap gap-3">
            <ExportDataButton />
            <DeleteAccountButton />
          </div>
        </div>
      </div>
    </main>
  )
}
