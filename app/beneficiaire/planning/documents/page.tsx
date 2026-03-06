import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import Link from 'next/link'
import { checkPlanningAccess } from '@/lib/planning-gate'
import { getDocumentsForBeneficiaire } from '@/app/actions/planning-documents'
import { getTeamMembers } from '@/app/actions/planning-equipe'
import { PlanningDocumentsClient } from '@/components/planning/planning-documents-client'
import { BeneficiaireHeader } from '@/components/layout/beneficiaire-header'
import { getUnreadCount } from '@/lib/unread-count'

export default async function PlanningDocumentsPage() {
  const supabase = await createClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: userData } = await supabase
    .from('users')
    .select('first_name, last_name, role')
    .eq('id', user.id)
    .single()

  if (!userData || userData.role !== 'beneficiaire') redirect('/')

  const access = await checkPlanningAccess(user.id)
  if (!access.hasBase) redirect('/beneficiaire/abonnement')
  if (!access.canAccess) redirect('/beneficiaire/planning/abonnement')

  const [documents, team, unreadCount] = await Promise.all([
    getDocumentsForBeneficiaire(),
    getTeamMembers(),
    getUnreadCount(user.id),
  ])

  return (
    <main className="min-h-screen kraft bg-kraft">
      <BeneficiaireHeader
        userId={user.id}
        unreadCount={unreadCount}
        firstName={userData.first_name}
        lastName={userData.last_name}
        currentPage="planning"
        hasPlanningSubscription
      />

      <div className="max-w-3xl mx-auto px-4 py-8 relative z-10">
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-2xl font-bold text-gray-900">Documents</h2>
          <Link
            href="/beneficiaire/planning"
            className="px-4 py-2 border rounded-lg hover:border-accent transition text-sm font-medium"
          >
            Retour au planning
          </Link>
        </div>
        <PlanningDocumentsClient documents={documents} team={team} />
      </div>
    </main>
  )
}
