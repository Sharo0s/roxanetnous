'use client'

import { useState, useRef, useEffect } from 'react'
import type { ShiftData, TeamMember } from '@/components/planning/planning-grid-client'

const JOURS_HEADER = ['Lun', 'Mar', 'Mer', 'Jeu', 'Ven', 'Sam', 'Dim']

function pad2(n: number) {
  return n.toString().padStart(2, '0')
}

function formatLocalDate(year: number, month: number, day: number) {
  return `${year}-${pad2(month + 1)}-${pad2(day)}`
}

function getMonthCalendar(date: Date): (string | null)[][] {
  const year = date.getFullYear()
  const month = date.getMonth()
  const firstDay = new Date(year, month, 1)
  const lastDay = new Date(year, month + 1, 0)

  let startOffset = firstDay.getDay() - 1
  if (startOffset < 0) startOffset = 6

  const weeks: (string | null)[][] = []
  let week: (string | null)[] = []

  for (let i = 0; i < startOffset; i++) week.push(null)

  for (let day = 1; day <= lastDay.getDate(); day++) {
    week.push(formatLocalDate(year, month, day))
    if (week.length === 7) {
      weeks.push(week)
      week = []
    }
  }

  if (week.length > 0) {
    while (week.length < 7) week.push(null)
    weeks.push(week)
  }

  return weeks
}

type PopupInfo = {
  date: string
  // Shifts existants
  entries: {
    auxId: string
    name: string
    couleur: string
    creneaux: { debut: string; fin: string }[]
    totalHeures: number
  }[]
  // Auxiliaires sans shift ce jour (pour "Ajouter")
  available: {
    auxId: string
    name: string
    couleur: string
  }[]
}

export function PlanningMonthView({
  date,
  team,
  shifts,
  onCellClick,
}: {
  date: Date
  team: TeamMember[]
  shifts: ShiftData[]
  onCellClick: (auxUserId: string, date: string) => void
}) {
  const weeks = getMonthCalendar(date)
  const activeTeam = team.filter(m => m.actif)
  const now = new Date()
  const today = formatLocalDate(now.getFullYear(), now.getMonth(), now.getDate())
  const [popup, setPopup] = useState<PopupInfo | null>(null)
  const popupRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (popupRef.current && !popupRef.current.contains(e.target as Node)) {
        setPopup(null)
      }
    }
    if (popup) {
      document.addEventListener('mousedown', handleClickOutside)
      return () => document.removeEventListener('mousedown', handleClickOutside)
    }
  }, [popup])

  const shiftsByDate = new Map<string, ShiftData[]>()
  for (const s of shifts) {
    const arr = shiftsByDate.get(s.date) || []
    arr.push(s)
    shiftsByDate.set(s.date, arr)
  }

  function openPopup(d: string) {
    const dayShifts = shiftsByDate.get(d) || []
    const auxIdsWithShift = new Set(dayShifts.map(s => s.auxiliaire_user_id))

    const entries = [...auxIdsWithShift].map(auxId => {
      const member = activeTeam.find(m => m.auxiliaire_user_id === auxId)
      const auxShifts = dayShifts.filter(s => s.auxiliaire_user_id === auxId)
      const creneaux = auxShifts.flatMap(s => s.creneaux as { debut: string; fin: string }[])
      const totalHeures = auxShifts.reduce((sum, s) => sum + Number(s.total_heures), 0)
      return {
        auxId,
        name: member ? `${member.first_name} ${member.last_name?.[0]?.toUpperCase()}.` : '',
        couleur: member?.couleur || '#6B7280',
        creneaux,
        totalHeures,
      }
    })

    const available = activeTeam
      .filter(m => !auxIdsWithShift.has(m.auxiliaire_user_id))
      .map(m => ({
        auxId: m.auxiliaire_user_id,
        name: `${m.first_name} ${m.last_name?.[0]?.toUpperCase()}.`,
        couleur: m.couleur,
      }))

    setPopup({ date: d, entries, available })
  }

  return (
    <div className="overflow-x-auto relative">
      <table className="w-full border-collapse">
        <thead>
          <tr>
            {JOURS_HEADER.map(j => (
              <th key={j} className="p-2 text-sm md:text-base font-medium text-gray-500 text-center">
                {j}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {weeks.map((week, wi) => (
            <tr key={wi}>
              {week.map((d, di) => {
                if (!d) {
                  return <td key={di} className="p-1" />
                }

                const dayShifts = shiftsByDate.get(d) || []
                const auxIds = [...new Set(dayShifts.map(s => s.auxiliaire_user_id))]
                const isToday = d === today
                const dayNum = new Date(d + 'T12:00:00').getDate()
                const isEmpty = auxIds.length === 0

                return (
                  <td key={d} className="p-1 align-top">
                    <div
                      className={`rounded-lg border p-2 min-h-[60px] md:min-h-[90px] transition cursor-pointer hover:border-black ${isToday ? 'border-black border-2' : ''}`}
                      onClick={() => openPopup(d)}
                    >
                      <div className="flex items-center justify-between mb-1">
                        <span className={`text-sm md:text-base ${isToday ? 'font-bold text-black' : 'text-gray-700'}`}>
                          {dayNum}
                        </span>
                        {dayShifts.length > 0 && (
                          <span className="text-xs md:text-sm text-gray-500 hidden md:inline">
                            {dayShifts.reduce((sum, s) => sum + Number(s.total_heures), 0)}h
                          </span>
                        )}
                      </div>

                      {/* Mobile : pastilles ou + */}
                      <div className="md:hidden">
                        {isEmpty ? (
                          <p className="text-lg text-black text-center mt-2">+</p>
                        ) : (
                          <div className="flex flex-wrap gap-1 items-end">
                            {auxIds.map(auxId => {
                              const member = activeTeam.find(m => m.auxiliaire_user_id === auxId)
                              if (!member) return null
                              return (
                                <div
                                  key={auxId}
                                  className="w-4 h-4 rounded-full"
                                  style={{ backgroundColor: member.couleur }}
                                />
                              )
                            })}
                            <span className="text-sm text-black ml-auto leading-none">+</span>
                          </div>
                        )}
                      </div>

                      {/* Desktop : nom + horaires ou + */}
                      <div className="hidden md:flex flex-col gap-1">
                        {isEmpty ? (
                          <p className="text-lg text-black text-center mt-2">+</p>
                        ) : (
                          <>
                            {auxIds.map(auxId => {
                              const member = activeTeam.find(m => m.auxiliaire_user_id === auxId)
                              if (!member) return null
                              const auxShifts = dayShifts.filter(s => s.auxiliaire_user_id === auxId)
                              const creneaux = auxShifts.flatMap(s => s.creneaux as { debut: string; fin: string }[])
                              const shortName = `${member.first_name} ${member.last_name?.[0]?.toUpperCase()}.`
                              return (
                                <div key={auxId} className="text-left">
                                  <p className="text-sm font-medium truncate" style={{ color: member.couleur }}>
                                    {shortName}
                                  </p>
                                  {creneaux.map((c, i) => (
                                    <p key={i} className="text-xs text-gray-500 leading-tight">
                                      {c.debut}-{c.fin}
                                    </p>
                                  ))}
                                </div>
                              )
                            })}
                            <span className="text-sm text-black self-end mt-auto leading-none">+</span>
                          </>
                        )}
                      </div>
                    </div>
                  </td>
                )
              })}
            </tr>
          ))}
        </tbody>
      </table>

      {/* Popup — bottom sheet mobile, modal centree desktop */}
      {popup && (
        <div className="fixed inset-0 z-50 flex items-end md:items-center md:justify-center" onClick={() => setPopup(null)}>
          <div className="absolute inset-0 bg-black/30" />
          <div
            ref={popupRef}
            className="relative w-full md:w-auto md:min-w-[360px] md:max-w-[420px] bg-white rounded-t-2xl md:rounded-2xl p-5 pb-8 md:pb-5 shadow-xl max-h-[70vh] overflow-y-auto"
            onClick={e => e.stopPropagation()}
          >
            <div className="w-10 h-1 bg-gray-300 rounded-full mx-auto mb-4 md:hidden" />
            <p className="text-sm font-semibold text-gray-900 mb-3">
              {new Date(popup.date + 'T12:00:00').toLocaleDateString('fr-FR', {
                weekday: 'long',
                day: 'numeric',
                month: 'long',
              })}
            </p>

            {/* Shifts existants */}
            {popup.entries.length > 0 && (
              <div className="space-y-2 mb-4">
                {popup.entries.map(entry => (
                  <button
                    key={entry.auxId}
                    className="w-full text-left p-3 rounded-lg border hover:border-black transition"
                    onClick={() => {
                      setPopup(null)
                      onCellClick(entry.auxId, popup.date)
                    }}
                  >
                    <div className="flex items-center gap-2 mb-1">
                      <div className="w-3 h-3 rounded-full flex-shrink-0" style={{ backgroundColor: entry.couleur }} />
                      <span className="text-sm font-medium" style={{ color: entry.couleur }}>{entry.name}</span>
                      <span className="text-xs text-gray-500 ml-auto">{entry.totalHeures}h</span>
                    </div>
                    {entry.creneaux.map((c, i) => (
                      <p key={i} className="text-xs text-gray-600 ml-5">
                        {c.debut} - {c.fin}
                      </p>
                    ))}
                  </button>
                ))}
              </div>
            )}

            {/* Ajouter un creneau */}
            {popup.available.length > 0 && (
              <div>
                {popup.entries.length > 0 && (
                  <p className="text-xs text-gray-500 mb-2">Ajouter un creneau</p>
                )}
                <div className="space-y-2">
                  {popup.available.map(aux => (
                    <button
                      key={aux.auxId}
                      className="w-full text-left p-3 rounded-lg border border-dashed hover:border-black transition flex items-center gap-2"
                      onClick={() => {
                        setPopup(null)
                        onCellClick(aux.auxId, popup.date)
                      }}
                    >
                      <div className="w-3 h-3 rounded-full flex-shrink-0" style={{ backgroundColor: aux.couleur }} />
                      <span className="text-sm" style={{ color: aux.couleur }}>{aux.name}</span>
                      <span className="text-sm text-black ml-auto">+</span>
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
