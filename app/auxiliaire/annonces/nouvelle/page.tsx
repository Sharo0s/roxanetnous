import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { AuxiliaireHeader } from '@/components/layout/auxiliaire-header'
import { getUnreadCount } from '@/lib/unread-count'
import { NouvelleAnnonceForm } from '@/components/auxiliaire/nouvelle-annonce-form'

export default async function NouvelleAnnonceAuxiliaire() {
  const supabase = await createClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: userData } = await supabase
    .from('users')
    .select('first_name, last_name, role')
    .eq('id', user.id)
    .single()

  if (!userData || userData.role !== 'auxiliaire') redirect('/')

  const unreadCount = await getUnreadCount(user.id)

  return (
    <main className="min-h-screen bg-gray-50">
      <AuxiliaireHeader
        userId={user.id}
        unreadCount={unreadCount}
        firstName={userData.first_name}
        lastName={userData.last_name}
        currentPage="annonces"
      />

      <div className="max-w-3xl mx-auto px-4 py-8">
        <h2 className="text-2xl font-bold text-gray-900 mb-6">Creer une annonce</h2>
        <NouvelleAnnonceForm />
      </div>
    </main>
  )
}
