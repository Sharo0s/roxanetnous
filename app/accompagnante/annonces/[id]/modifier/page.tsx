import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { ModifierAnnonceForm } from '@/components/accompagnante/modifier-annonce-form'
import { AccompagnanteHeader } from '@/components/layout/accompagnante-header'
import { getUnreadCount } from '@/lib/unread-count'
import { getCodesDepartementsOuverts } from '@/lib/departements'

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

  if (!userData || userData.role !== 'accompagnante') redirect('/')

  const { data: profile } = await supabase
    .from('accompagnantes_profiles')
    .select('id')
    .eq('user_id', user.id)
    .single()

  if (!profile) redirect('/accompagnante/dashboard')

  const { data: annonce } = await supabase
    .from('annonces_accompagnantes')
    .select('*')
    .eq('id', id)
    .eq('accompagnante_id', profile.id)
    .single()

  if (!annonce) redirect('/accompagnante/annonces')

  const unreadCount = await getUnreadCount(user.id)
  const departementsOuverts = await getCodesDepartementsOuverts()

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
        <h2 className="text-2xl font-bold text-gray-900 mb-6">Modifier l'annonce</h2>
        <ModifierAnnonceForm annonce={annonce} departementsOuverts={departementsOuverts} />
      </div>
    </main>
  )
}
