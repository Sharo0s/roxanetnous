import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import Link from 'next/link'
import { LogoutButton } from '@/components/auth/logout-button'
import { AuxiliaireProfileForm } from '@/components/auxiliaire/profile-form'
import { ExportDataButton } from '@/components/export-data-button'
import { DeleteAccountButton } from '@/components/delete-account-button'

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

  return (
    <main className="min-h-screen bg-gray-50">
      <header className="bg-white border-b">
        <div className="max-w-3xl mx-auto px-4 py-4 flex items-center justify-between">
          <Link href="/auxiliaire/dashboard" className="text-xl font-bold text-black">
            roxanetnous
          </Link>
          <div className="flex items-center gap-4">
            <Link href="/messages" className="text-sm text-gray-600 hover:text-black">Messages</Link>
            <span className="text-sm text-gray-600">{userData.first_name} {userData.last_name}</span>
            <LogoutButton />
          </div>
        </div>
      </header>

      <div className="max-w-3xl mx-auto px-4 py-8">
        <h2 className="text-2xl font-bold text-gray-900 mb-6">Mon profil</h2>

        <AuxiliaireProfileForm
          userInfo={{
            first_name: userData.first_name || '',
            last_name: userData.last_name || '',
            email: userData.email,
            phone: userData.phone || '',
          }}
          profile={{
            diplome: profile.diplome,
            experience: profile.experience,
            specialites: profile.specialites as string[],
            ville: profile.ville || '',
            code_postal: profile.code_postal || '',
            rayon_km: profile.rayon_km || 10,
            disponibilites: (profile.disponibilites as Record<string, string[]>) || {},
            langues: (profile.langues as string[]) || [],
            permis_conduire: profile.permis_conduire || false,
            vehicule: profile.vehicule || false,
            description: profile.description || '',
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
