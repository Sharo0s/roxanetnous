import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { ModifierAnnonceBeneficiaireForm } from '@/components/beneficiaire/modifier-annonce-form'
import { BeneficiaireHeader } from '@/components/layout/beneficiaire-header'
import { getUnreadCount } from '@/lib/unread-count'

export default async function ModifierAnnonceBeneficiairePage({
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

  if (!userData || userData.role !== 'beneficiaire') redirect('/')

  const { data: profile } = await supabase
    .from('beneficiaires_profiles')
    .select('id')
    .eq('user_id', user.id)
    .single()

  if (!profile) redirect('/beneficiaire/dashboard')

  const { data: annonce } = await supabase
    .from('annonces_beneficiaires')
    .select('*')
    .eq('id', id)
    .eq('beneficiaire_id', profile.id)
    .single()

  if (!annonce) redirect('/beneficiaire/annonces')

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
        <h2 className="text-2xl font-bold text-gray-900 mb-6">Modifier l&apos;annonce</h2>
        <ModifierAnnonceBeneficiaireForm annonce={annonce} />
      </div>
    </main>
  )
}
