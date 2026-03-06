import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { checkPlanningAccess } from '@/lib/planning-gate'
import { getTeamMembers } from '@/app/actions/planning-equipe'
import { getShiftsForPeriod } from '@/app/actions/planning-shifts'
import { PlanningGridClient } from '@/components/planning/planning-grid-client'
import { BeneficiaireHeader } from '@/components/layout/beneficiaire-header'
import { getUnreadCount } from '@/lib/unread-count'

function pad2(n: number) {
  return n.toString().padStart(2, '0')
}

function toLocalDateStr(d: Date) {
  return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`
}

function getWeekRange(date: Date) {
  const d = new Date(date)
  const day = d.getDay()
  const diff = d.getDate() - day + (day === 0 ? -6 : 1)
  const start = new Date(d.setDate(diff))
  const end = new Date(start)
  end.setDate(start.getDate() + 6)
  return {
    start: toLocalDateStr(start),
    end: toLocalDateStr(end),
  }
}

export default async function PlanningPage() {
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

  const week = getWeekRange(new Date())

  const [team, shifts, unreadCount] = await Promise.all([
    getTeamMembers(),
    getShiftsForPeriod(week.start, week.end),
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

      <div className="max-w-6xl mx-auto px-4 py-8 relative z-10">
        <PlanningGridClient initialTeam={team} initialShifts={shifts} />
      </div>
    </main>
  )
}
