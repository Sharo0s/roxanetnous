import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { AuxiliaireProfileForm } from '@/components/auxiliaire/profile-form'
import { ExportDataButton } from '@/components/export-data-button'
import { DeleteAccountButton } from '@/components/delete-account-button'
import { AuxiliaireHeader } from '@/components/layout/auxiliaire-header'
import { getUnreadCount } from '@/lib/unread-count'

export default async function AuxiliaireProfilPage() {
  const supabase = await createClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: userData } = await supabase
    .from('users')
    .select('first_name, last_name, email, phone, role')
    .eq('id', user.id)
    .single()

  if (!userData || userData.role !== 'auxiliaire') redirect('/')

  const { data: profile } = await supabase
    .from('auxiliaires_profiles')
    .select('*')
    .eq('user_id', user.id)
    .single()

  if (!profile) redirect('/auxiliaire/onboarding')

  const unreadCount = await getUnreadCount(user.id)

  return (
    <main className="min-h-screen bg-gray-50">
      <AuxiliaireHeader
        userId={user.id}
        unreadCount={unreadCount}
        firstName={userData.first_name}
        lastName={userData.last_name}
        currentPage="profil"
      />

      <div className="max-w-3xl mx-auto px-4 py-8">
        <h2 className="text-2xl font-bold text-gray-900 mb-6">Mon profil</h2>

        {profile.validation_status === 'en_attente' && (
          <div className="mb-6 p-4 rounded-xl border bg-gray-50 text-sm text-gray-700">
            Votre profil est en cours de verification par notre equipe.
          </div>
        )}
        {profile.validation_status === 'a_completer' && (
          <div className="mb-6 p-4 rounded-xl border border-red-200 bg-red-50 text-sm">
            <p className="font-medium text-red-800">Des informations complementaires sont demandees.</p>
            {profile.refus_motif && (
              <p className="text-red-700 mt-1">Details : {profile.refus_motif}</p>
            )}
          </div>
        )}
        {profile.validation_status === 'refuse' && (
          <div className="mb-6 p-4 rounded-xl border border-red-200 bg-red-50 text-sm">
            <p className="font-medium text-red-800">Votre profil a ete refuse.</p>
            {profile.refus_motif && (
              <p className="text-red-700 mt-1">Motif : {profile.refus_motif}</p>
            )}
          </div>
        )}

        <AuxiliaireProfileForm
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
        />

        <div className="mt-10 pt-8 border-t">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">Mes donnees personnelles</h3>
          <p className="text-sm text-gray-600 mb-4">
            Conformement au RGPD, vous pouvez exporter ou supprimer vos donnees a tout moment.
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
