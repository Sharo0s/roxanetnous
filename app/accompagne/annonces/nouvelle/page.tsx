import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { AccompagneHeader } from '@/components/layout/accompagne-header'
import { getUnreadCount } from '@/lib/unread-count'
import { NouvelleAnnonceAccompagneForm } from '@/components/accompagne/nouvelle-annonce-form'
import { getCodesDepartementsOuverts } from '@/lib/departements'

export default async function NouvelleAnnonceAccompagne() {
  const supabase = await createClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: userData } = await supabase
    .from('users')
    .select('first_name, last_name, role')
    .eq('id', user.id)
    .single()

  if (!userData || userData.role !== 'accompagne') redirect('/')

  const unreadCount = await getUnreadCount(user.id)
  const departementsOuverts = await getCodesDepartementsOuverts()

  return (
    <main className="min-h-screen kraft bg-kraft">
      <AccompagneHeader
        userId={user.id}
        unreadCount={unreadCount}
        firstName={userData.first_name}
        lastName={userData.last_name}
        currentPage="annonces"
      />

      <div className="max-w-3xl mx-auto px-4 py-8 relative z-10">
        <NouvelleAnnonceAccompagneForm departementsOuverts={departementsOuverts} />
      </div>
    </main>
  )
}
