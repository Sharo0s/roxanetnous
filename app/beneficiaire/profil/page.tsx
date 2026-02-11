import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import Link from 'next/link'
import { LogoutButton } from '@/components/auth/logout-button'
import { BeneficiaireProfileForm } from '@/components/beneficiaire/profile-form'

export default async function BeneficiaireProfilPage() {
  const supabase = await createClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: userData } = await supabase
    .from('users')
    .select('first_name, last_name, email, phone, role')
    .eq('id', user.id)
    .single()

  if (!userData || userData.role !== 'beneficiaire') redirect('/')

  const { data: profile } = await supabase
    .from('beneficiaires_profiles')
    .select('*')
    .eq('user_id', user.id)
    .single()

  return (
    <main className="min-h-screen bg-gray-50">
      <header className="bg-white border-b">
        <div className="max-w-3xl mx-auto px-4 py-4 flex items-center justify-between">
          <Link href="/beneficiaire/dashboard" className="text-xl font-bold text-black">
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

        <BeneficiaireProfileForm
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
      </div>
    </main>
  )
}
