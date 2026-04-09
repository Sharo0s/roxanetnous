import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import Link from 'next/link'
import { AccompagnanteProfileForm } from '@/components/accompagnante/profile-form'
import { ExportDataButton } from '@/components/export-data-button'
import { DeleteAccountButton } from '@/components/delete-account-button'
import { AccompagnanteHeader } from '@/components/layout/accompagnante-header'
import { AvatarUpload } from '@/components/accompagnante/avatar-upload'
import { DisponibleToggle } from '@/components/accompagnante/disponible-toggle'
import { StatusBadge } from '@/components/accompagnante/status-badge'
import { getUnreadCount } from '@/lib/unread-count'

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

  const unreadCount = await getUnreadCount(user.id)

  return (
    <main className="min-h-screen kraft bg-kraft">
      <AccompagnanteHeader
        userId={user.id}
        unreadCount={unreadCount}
        firstName={userData.first_name}
        lastName={userData.last_name}
        currentPage="profil"
      />

      <div className="max-w-3xl mx-auto px-4 py-8 relative z-10">
        <div className="flex flex-col items-center mb-8">
          <AvatarUpload
            currentUrl={userData.avatar_url}
            firstName={userData.first_name || ''}
            lastName={userData.last_name || ''}
            size="lg"
          />
          <div className="flex items-center gap-2 mt-3">
            <h2 className="text-xl font-bold text-gray-900">
              {userData.first_name} {userData.last_name}
            </h2>
            <StatusBadge status={profile.validation_status} />
          </div>
          {profile.ville && (
            <p className="text-sm text-gray-500 mt-0.5 flex items-center gap-1">
              <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M15 10.5a3 3 0 11-6 0 3 3 0 016 0z" />
                <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 10.5c0 7.142-7.5 11.25-7.5 11.25S4.5 17.642 4.5 10.5a7.5 7.5 0 1115 0z" />
              </svg>
              {profile.ville}{profile.rayon_km ? ` - Sur ${profile.rayon_km} km` : ''}
            </p>
          )}
          {profile.specialites && (profile.specialites as string[]).length > 0 && (
            <div className="flex flex-wrap justify-center gap-1.5 mt-2 max-w-md">
              {(profile.specialites as string[]).map((s: string) => (
                <span key={s} className="px-2 py-0.5 rounded-full bg-accent/20 text-xs font-medium text-gray-700">
                  {s}
                </span>
              ))}
            </div>
          )}
          <div className="mt-2">
            <DisponibleToggle
              initial={profile.disponible ?? true}
              initialIndisponibleJusquAu={profile.indisponible_jusqu_au}
              compact
            />
          </div>
          <div className="flex items-center gap-1 mt-4 bg-white rounded-full border p-1">
            <Link
              href="/accompagnante/dashboard"
              className="px-4 py-1.5 rounded-full text-sm font-medium text-gray-500 hover:text-black transition"
            >
              Dashboard
            </Link>
            <span className="px-4 py-1.5 rounded-full bg-accent text-sm font-medium text-black">
              Profil
            </span>
          </div>
        </div>

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
