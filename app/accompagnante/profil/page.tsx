import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import Link from 'next/link'
import { AccompagnanteProfileForm } from '@/components/accompagnante/profile-form'
import { SecurityCredentialsForm } from '@/components/account/security-credentials-form'
import { ExportDataButton } from '@/components/export-data-button'
import { DeleteAccountButton } from '@/components/delete-account-button'
import { AccompagnanteDashboardHeader } from '@/components/layout/accompagnante-dashboard-header'
import { LogoutButton } from '@/components/auth/logout-button'
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
    <main id="main-content" tabIndex={-1} className="min-h-screen bg-[#fefaf8] focus:outline-none">
      <AccompagnanteDashboardHeader
        firstName={userData.first_name}
        lastName={userData.last_name}
        unreadCount={unreadCount}
        currentPage="profil"
      />

      <div className="max-w-3xl mx-auto px-4 py-10 md:py-14 relative z-10">

        {/* TITRE EDITORIAL */}
        <header className="text-center mb-10">
          <div className="text-xs uppercase tracking-[0.18em] text-kraft mb-2">Mon espace</div>
          <h1 className="text-3xl md:text-4xl italic text-gray-900 leading-tight">Mon profil</h1>
          <p className="mt-3 text-sm text-gray-600">
            Tenez vos informations à jour pour rassurer les accompagnés.
          </p>
        </header>

        {/* CODE PARRAINAGE (si valide) */}
        {parrainageCode && (
          <div className="mb-6 flex items-center justify-between bg-white rounded-xl border border-[#e8dfd2] px-5 py-4">
            <span className="text-sm text-gray-600">Votre code de parrainage</span>
            <span className="font-mono font-medium tracking-[0.18em] text-gray-900">{parrainageCode}</span>
          </div>
        )}

        {/* BANDEAUX STATUT (couleurs semantiques preservees) */}
        {profile.validation_status === 'en_attente' && (
          <div className="mb-6 p-4 rounded-xl border border-[#e8dfd2] bg-white text-sm text-gray-700">
            Votre profil est en cours de vérification par notre équipe.
          </div>
        )}
        {profile.validation_status === 'visio_a_planifier' && (
          <div className="mb-6 p-4 rounded-xl border border-blue-200 bg-blue-50 text-sm">
            <p className="font-medium text-blue-900 mb-1">Votre dossier a été revu.</p>
            <p className="text-blue-900">
              Nous vous avons envoyé un email pour convenir d&apos;un créneau visio avec l&apos;équipe.
            </p>
          </div>
        )}
        {profile.validation_status === 'visio_realisee' && (
          <div className="mb-6 p-4 rounded-xl border border-amber-200 bg-amber-50 text-sm">
            <p className="font-medium text-amber-900">Visio réalisée — nous finalisons votre validation.</p>
          </div>
        )}
        {profile.validation_status === 'a_completer' && (
          <div className="mb-6 p-4 rounded-xl border border-blue-200 bg-blue-50 text-sm">
            <p className="font-medium text-blue-900 mb-1">Complétez votre profil pour le soumettre à validation.</p>
            {profile.refus_motif && (
              <p className="text-blue-800">Détails : {profile.refus_motif}</p>
            )}
          </div>
        )}
        {profile.validation_status === 'refuse' && (
          <div role="alert" className="mb-6 p-4 rounded-xl border border-red-200 bg-red-50 text-sm">
            <p className="font-medium text-red-800 mb-1">Votre profil a été refusé.</p>
            {profile.refus_motif && (
              <p className="text-red-700">Motif : {profile.refus_motif}</p>
            )}
          </div>
        )}

        {/* FORMULAIRE PROFIL (inchange) */}
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

        {/* SECTION IDENTIFIANTS / SECURITE */}
        <SecurityCredentialsForm currentEmail={userData.email} />

        {/* SECTION RGPD */}
        <section className="mt-16 pt-12 border-t border-[#e8dfd2] text-center">
          <h2 className="text-xl italic text-gray-900 mb-2">Mes données personnelles</h2>
          <p className="text-sm text-gray-600 mb-6 max-w-md mx-auto">
            Conformément au RGPD, vous pouvez exporter ou supprimer vos données à tout moment.
          </p>
          <div className="flex justify-center flex-wrap gap-3">
            <ExportDataButton />
            <DeleteAccountButton />
          </div>
        </section>

        {/* FOOTER coherent avec dashboard */}
        <div className="mt-16 pt-6 border-t border-[#e8dfd2] flex flex-wrap justify-center items-center gap-x-6 gap-y-2 text-xs text-gray-500">
          <Link href="/cgu" className="hover:text-gray-800">Aide</Link>
          <span aria-hidden="true">·</span>
          <Link href="/politique-de-confidentialite" className="hover:text-gray-800">Confidentialité</Link>
          <span aria-hidden="true">·</span>
          <Link href="/cgu" className="hover:text-gray-800">Conditions</Link>
          <span aria-hidden="true">·</span>
          <LogoutButton />
        </div>

      </div>
    </main>
  )
}
