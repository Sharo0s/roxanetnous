import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { ModifierAnnonceAccompagneForm } from '@/components/accompagne/modifier-annonce-form'
import { AccompagneHeader } from '@/components/layout/accompagne-header'
import { getUnreadCount } from '@/lib/unread-count'
import { getCodesDepartementsOuverts } from '@/lib/departements'

export default async function ModifierAnnonceAccompagnePage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params
  const supabase = await createClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: userData } = await supabase
    .from('users')
    .select('first_name, last_name, role')
    .eq('id', user.id)
    .single()

  if (!userData || userData.role !== 'accompagne') redirect('/')

  const { data: profile } = await supabase
    .from('accompagnes_profiles')
    .select('id')
    .eq('user_id', user.id)
    .single()

  if (!profile) redirect('/accompagne/dashboard')

  const { data: annonce } = await supabase
    .from('annonces_accompagnes')
    .select('*')
    .eq('id', id)
    .eq('accompagne_id', profile.id)
    .single()

  if (!annonce) redirect('/accompagne/annonces')

  const unreadCount = await getUnreadCount(user.id)
  const departementsOuverts = await getCodesDepartementsOuverts()

  return (
    <main id="main-content" tabIndex={-1} className="min-h-screen kraft bg-kraft focus:outline-none">
      <AccompagneHeader
        userId={user.id}
        unreadCount={unreadCount}
        firstName={userData.first_name}
        lastName={userData.last_name}
        currentPage="annonces"
      />

      <div className="max-w-3xl mx-auto px-4 py-8 relative z-10">
        <h1 className="text-2xl font-bold text-gray-900 mb-6">Modifier l&apos;annonce</h1>
        <ModifierAnnonceAccompagneForm annonce={annonce} departementsOuverts={departementsOuverts} />
      </div>
    </main>
  )
}
