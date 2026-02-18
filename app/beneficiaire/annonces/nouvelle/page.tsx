import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { BeneficiaireHeader } from '@/components/layout/beneficiaire-header'
import { getUnreadCount } from '@/lib/unread-count'
import { NouvelleAnnonceBeneficiaireForm } from '@/components/beneficiaire/nouvelle-annonce-form'

export default async function NouvelleAnnonceBeneficiaire() {
  const supabase = await createClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: userData } = await supabase
    .from('users')
    .select('first_name, last_name, role')
    .eq('id', user.id)
    .single()

  if (!userData || userData.role !== 'beneficiaire') redirect('/')

  const unreadCount = await getUnreadCount(user.id)

  return (
    <main className="min-h-screen bg-gray-50">
      <BeneficiaireHeader
        userId={user.id}
        unreadCount={unreadCount}
        firstName={userData.first_name}
        lastName={userData.last_name}
        currentPage="annonces"
      />

      <div className="max-w-3xl mx-auto px-4 py-8">
        <NouvelleAnnonceBeneficiaireForm />
      </div>
    </main>
  )
}
