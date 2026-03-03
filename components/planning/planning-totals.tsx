'use client'

import type { ShiftData, TeamMember } from '@/components/planning/planning-grid-client'

export function PlanningTotals({
  team,
  shifts,
}: {
  team: TeamMember[]
  shifts: ShiftData[]
}) {
  const activeTeam = team.filter(m => m.actif)
  if (shifts.length === 0) return null

  const totalsByAux = new Map<string, number>()
  for (const s of shifts) {
    const prev = totalsByAux.get(s.auxiliaire_user_id) || 0
    totalsByAux.set(s.auxiliaire_user_id, prev + Number(s.total_heures))
  }

  const globalTotal = [...totalsByAux.values()].reduce((a, b) => a + b, 0)

  return (
    <div className="bg-white rounded-xl border p-4 mt-4">
      <div className="flex items-center justify-between mb-3">
        <h4 className="text-sm font-semibold text-gray-900">Total heures</h4>
        <span className="text-lg font-bold">{globalTotal.toFixed(1)}h</span>
      </div>
      <div className="space-y-1.5">
        {activeTeam.map(member => {
          const total = totalsByAux.get(member.auxiliaire_user_id) || 0
          if (total === 0) return null
          return (
            <div key={member.auxiliaire_user_id} className="flex items-center justify-between text-sm">
              <div className="flex items-center gap-2">
                <div className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: member.couleur }} />
                <span className="text-gray-700">{member.first_name} {member.last_name}</span>
              </div>
              <span className="font-medium">{total.toFixed(1)}h</span>
            </div>
          )
        })}
      </div>
    </div>
  )
}
