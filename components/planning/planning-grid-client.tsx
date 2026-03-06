'use client'

import { useState, useCallback } from 'react'
import { getShiftsForPeriod } from '@/app/actions/planning-shifts'
import { PlanningViewSwitcher } from '@/components/planning/planning-view-switcher'
import { PlanningDayView } from '@/components/planning/planning-day-view'
import { PlanningWeekView } from '@/components/planning/planning-week-view'
import { PlanningMonthView } from '@/components/planning/planning-month-view'
import { ShiftEditorModal } from '@/components/planning/shift-editor-modal'
import { PlanningTotals } from '@/components/planning/planning-totals'
import Link from 'next/link'

export type TeamMember = {
  id: string
  auxiliaire_user_id: string
  couleur: string
  actif: boolean
  first_name: string
  last_name: string
}

export type ShiftData = {
  id: string
  auxiliaire_user_id: string
  date: string
  creneaux: unknown
  total_heures: number
  note: string | null
  first_name: string
  last_name: string
  couleur: string
}

type ViewType = 'day' | 'week' | 'month'

function pad2(n: number) {
  return n.toString().padStart(2, '0')
}

function toLocalDateStr(d: Date) {
  return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`
}

function getDateRange(view: ViewType, date: Date): { start: string; end: string } {
  if (view === 'day') {
    const d = toLocalDateStr(date)
    return { start: d, end: d }
  }

  if (view === 'week') {
    const d = new Date(date)
    const day = d.getDay()
    d.setDate(d.getDate() - day + (day === 0 ? -6 : 1))
    const start = toLocalDateStr(d)
    d.setDate(d.getDate() + 6)
    const end = toLocalDateStr(d)
    return { start, end }
  }

  const year = date.getFullYear()
  const month = date.getMonth()
  const start = toLocalDateStr(new Date(year, month, 1))
  const end = toLocalDateStr(new Date(year, month + 1, 0))
  return { start, end }
}

export function PlanningGridClient({
  initialTeam,
  initialShifts,
}: {
  initialTeam: TeamMember[]
  initialShifts: ShiftData[]
}) {
  const [view, setView] = useState<ViewType>('week')
  const [currentDate, setCurrentDate] = useState(new Date())
  const [shifts, setShifts] = useState<ShiftData[]>(initialShifts)
  const [team] = useState<TeamMember[]>(initialTeam)
  const [editingShift, setEditingShift] = useState<{
    auxUserId: string
    date: string
  } | null>(null)
  const [loading, setLoading] = useState(false)

  const fetchShifts = useCallback(async (v: ViewType, d: Date) => {
    setLoading(true)
    const range = getDateRange(v, d)
    const data = await getShiftsForPeriod(range.start, range.end)
    setShifts(data as ShiftData[])
    setLoading(false)
  }, [])

  function handleViewChange(v: ViewType) {
    setView(v)
    fetchShifts(v, currentDate)
  }

  function handleDateChange(d: Date) {
    setCurrentDate(d)
    fetchShifts(view, d)
  }

  function handleCellClick(auxUserId: string, date: string) {
    setEditingShift({ auxUserId, date })
  }

  function handleShiftSaved() {
    setEditingShift(null)
    fetchShifts(view, currentDate)
  }

  const editShiftData = editingShift
    ? shifts.find(
        s => s.auxiliaire_user_id === editingShift.auxUserId && s.date === editingShift.date
      )
    : null

  const editAuxMember = editingShift
    ? team.find(m => m.auxiliaire_user_id === editingShift.auxUserId)
    : null

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-2xl font-bold text-gray-900">Planning</h2>
        <div className="flex gap-2">
          <Link
            href="/beneficiaire/planning/equipe"
            className="px-4 py-2 border rounded-lg hover:border-accent transition text-sm font-medium"
          >
            Mon equipe
          </Link>
          <Link
            href="/beneficiaire/planning/documents"
            className="px-4 py-2 border rounded-lg hover:border-accent transition text-sm font-medium"
          >
            Documents
          </Link>
        </div>
      </div>

      <PlanningViewSwitcher
        view={view}
        currentDate={currentDate}
        onViewChange={handleViewChange}
        onDateChange={handleDateChange}
      />

      {loading && (
        <div className="text-center py-8 text-gray-400 text-sm">Chargement...</div>
      )}

      {!loading && view === 'day' && (
        <PlanningDayView
          date={currentDate}
          team={team}
          shifts={shifts}
          onCellClick={handleCellClick}
        />
      )}

      {!loading && view === 'week' && (
        <PlanningWeekView
          date={currentDate}
          team={team}
          shifts={shifts}
          onCellClick={handleCellClick}
        />
      )}

      {!loading && view === 'month' && (
        <PlanningMonthView
          date={currentDate}
          team={team}
          shifts={shifts}
          onCellClick={handleCellClick}
        />
      )}

      <PlanningTotals team={team} shifts={shifts} />

      {editingShift && editAuxMember && (
        <ShiftEditorModal
          auxiliaireUserId={editingShift.auxUserId}
          auxiliaireName={`${editAuxMember.first_name} ${editAuxMember.last_name}`}
          date={editingShift.date}
          existingShift={editShiftData ? {
            id: editShiftData.id,
            creneaux: editShiftData.creneaux as Array<{ debut: string; fin: string }>,
            note: editShiftData.note,
          } : null}
          onClose={() => setEditingShift(null)}
          onSaved={handleShiftSaved}
        />
      )}
    </div>
  )
}
