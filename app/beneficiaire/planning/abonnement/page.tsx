import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { getSubscriptionStatus } from '@/lib/subscription-helpers'
import { getPlanningSubscriptionStatus } from '@/lib/planning-subscription-helpers'
import { PlanningSubscriptionContent } from '@/components/planning/planning-subscription-content'
import { BeneficiaireHeader } from '@/components/layout/beneficiaire-header'
import { getUnreadCount } from '@/lib/unread-count'

export default async function PlanningAbonnementPage() {
  const supabase = await createClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: userData } = await supabase
    .from('users')
    .select('first_name, last_name, role')
    .eq('id', user.id)
    .single()

  if (!userData || userData.role !== 'beneficiaire') redirect('/')

  const baseSubscription = await getSubscriptionStatus(user.id)
  if (!baseSubscription.active) redirect('/beneficiaire/abonnement')

  const planningSubscription = await getPlanningSubscriptionStatus(user.id)
  const unreadCount = await getUnreadCount(user.id)

  return (
    <main className="min-h-screen bg-gray-50">
      <BeneficiaireHeader
        userId={user.id}
        unreadCount={unreadCount}
        firstName={userData.first_name}
        lastName={userData.last_name}
        currentPage="other"
      />

      <div className="max-w-2xl mx-auto px-4 py-8">
        <h2 className="text-2xl font-bold text-gray-900 mb-6">Module Planning</h2>
        <PlanningSubscriptionContent subscription={planningSubscription} />
      </div>
    </main>
  )
}
