import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { AccompagnanteHeader } from '@/components/layout/accompagnante-header'
import { getUnreadCount } from '@/lib/unread-count'
import { NouvelleAnnonceForm } from '@/components/accompagnante/nouvelle-annonce-form'

export default async function NouvelleAnnonceAccompagnante() {
  const supabase = await createClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: userData } = await supabase
    .from('users')
    .select('first_name, last_name, role')
    .eq('id', user.id)
    .single()

  if (!userData || userData.role !== 'accompagnante') redirect('/')

  const unreadCount = await getUnreadCount(user.id)

  return (
    <main className="min-h-screen kraft bg-kraft">
      <AccompagnanteHeader
        userId={user.id}
        unreadCount={unreadCount}
        firstName={userData.first_name}
        lastName={userData.last_name}
        currentPage="annonces"
      />

      <div className="max-w-3xl mx-auto px-4 py-8 relative z-10">
        <h2 className="text-2xl font-bold text-gray-900 mb-6">Créer une annonce</h2>
        <NouvelleAnnonceForm />
      </div>
    </main>
  )
}
