import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { AccompagneProfileForm } from '@/components/accompagne/profile-form'
import { ExportDataButton } from '@/components/export-data-button'
import { DeleteAccountButton } from '@/components/delete-account-button'
import { AccompagneHeader } from '@/components/layout/accompagne-header'
import { getUnreadCount } from '@/lib/unread-count'

export default async function AccompagneProfilPage() {
  const supabase = await createClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: userData } = await supabase
    .from('users')
    .select('first_name, last_name, email, phone, role')
    .eq('id', user.id)
    .single()

  if (!userData || userData.role !== 'accompagne') redirect('/')

  const { data: profile } = await supabase
    .from('accompagnes_profiles')
    .select('*')
    .eq('user_id', user.id)
    .single()

  const unreadCount = await getUnreadCount(user.id)

  return (
    <main className="min-h-screen kraft bg-kraft">
      <AccompagneHeader
        userId={user.id}
        unreadCount={unreadCount}
        firstName={userData.first_name}
        lastName={userData.last_name}
        currentPage="profil"
      />

      <div className="max-w-3xl mx-auto px-4 py-8 relative z-10">
        <h2 className="text-2xl font-bold text-gray-900 mb-6">Mon profil</h2>

        <AccompagneProfileForm
          userInfo={{
            first_name: userData.first_name || '',
            last_name: userData.last_name || '',
            email: userData.email,
            phone: userData.phone || '',
          }}
          profile={{
            ville: profile?.ville || '',
            code_postal: profile?.code_postal || '',
            adresse: profile?.adresse || '',
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
