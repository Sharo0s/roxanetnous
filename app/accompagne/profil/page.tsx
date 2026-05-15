import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { AccompagneProfileForm } from '@/components/accompagne/profile-form'
import { SecurityCredentialsForm } from '@/components/account/security-credentials-form'
import { ExportDataButton } from '@/components/export-data-button'
import { DeleteAccountButton } from '@/components/delete-account-button'
import { AccompagneDashboardHeader } from '@/components/layout/accompagne-dashboard-header'
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
    <main id="main-content" tabIndex={-1} className="min-h-screen bg-[#fefaf8] focus:outline-none">
      <AccompagneDashboardHeader
        firstName={userData.first_name}
        lastName={userData.last_name}
        unreadCount={unreadCount}
        currentPage="profil"
      />

      <div className="max-w-3xl mx-auto px-4 py-10 md:py-14 relative z-10">

        <header className="text-center mb-10">
          <div className="text-xs uppercase tracking-[0.18em] text-kraft mb-2">Votre espace</div>
          <h1 className="text-3xl md:text-4xl italic text-gray-900 leading-tight">Mon profil</h1>
          <p className="mt-3 text-sm text-gray-600">
            Tenez vos informations à jour pour faciliter vos échanges.
          </p>
        </header>

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

        <SecurityCredentialsForm currentEmail={userData.email} />

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


      </div>
    </main>
  )
}
