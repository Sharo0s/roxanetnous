import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { ModifierAnnonceForm } from '@/components/auxiliaire/modifier-annonce-form'
import { AuxiliaireHeader } from '@/components/layout/auxiliaire-header'
import { getUnreadCount } from '@/lib/unread-count'

export default async function ModifierAnnoncePage({
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

  if (!userData || userData.role !== 'auxiliaire') redirect('/')

  const { data: profile } = await supabase
    .from('auxiliaires_profiles')
    .select('id')
    .eq('user_id', user.id)
    .single()

  if (!profile) redirect('/auxiliaire/dashboard')

  const { data: annonce } = await supabase
    .from('annonces_auxiliaires')
    .select('*')
    .eq('id', id)
    .eq('auxiliaire_id', profile.id)
    .single()

  if (!annonce) redirect('/auxiliaire/annonces')

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
        <h2 className="text-2xl font-bold text-gray-900 mb-6">Modifier l'annonce</h2>
        <ModifierAnnonceForm annonce={annonce} />
      </div>
    </main>
  )
}
