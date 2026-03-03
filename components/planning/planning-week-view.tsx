'use client'

import { useState, useRef, useEffect } from 'react'
import type { ShiftData, TeamMember } from '@/components/planning/planning-grid-client'

const JOURS = ['Lun', 'Mar', 'Mer', 'Jeu', 'Ven', 'Sam', 'Dim']

function pad2(n: number) {
  return n.toString().padStart(2, '0')
}

function getWeekDates(date: Date): string[] {
  const d = new Date(date)
  const day = d.getDay()
  d.setDate(d.getDate() - day + (day === 0 ? -6 : 1))
  const dates: string[] = []
  for (let i = 0; i < 7; i++) {
    const y = d.getFullYear()
    const m = d.getMonth()
    const dd = d.getDate()
    dates.push(`${y}-${pad2(m + 1)}-${pad2(dd)}`)
    d.setDate(d.getDate() + 1)
  }
  return dates
}

type PopupInfo = {
  date: string
  entries: {
    auxId: string
    name: string
    couleur: string
    creneaux: { debut: string; fin: string }[]
    totalHeures: number
  }[]
  available: {
    auxId: string
    name: string
    couleur: string
  }[]
}

export function PlanningWeekView({
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
  const weekDates = getWeekDates(date)
  const activeTeam = team.filter(m => m.actif)
  const now = new Date()
  const today = `${now.getFullYear()}-${pad2(now.getMonth() + 1)}-${pad2(now.getDate())}`
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

  if (activeTeam.length === 0) {
    return (
      <div className="bg-white rounded-xl border p-6 text-center text-gray-500">
        Aucun auxiliaire actif dans votre equipe.
      </div>
    )
  }

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
    <div className="relative">
      <div className="grid grid-cols-7 gap-1">
        {weekDates.map((d, i) => {
          const dayShifts = shiftsByDate.get(d) || []
          const auxIds = [...new Set(dayShifts.map(s => s.auxiliaire_user_id))]
          const isToday = d === today
          const dayNum = new Date(d + 'T12:00:00').getDate()
          const isEmpty = auxIds.length === 0
          const totalH = dayShifts.reduce((sum, s) => sum + Number(s.total_heures), 0)

          return (
            <div key={d} className="flex flex-col">
              <div className="text-center mb-1">
                <span className={`text-sm md:text-base font-medium ${isToday ? 'text-black' : 'text-gray-500'}`}>
                  {JOURS[i]}
                </span>
              </div>
              <div
                className={`rounded-lg border p-2 min-h-[100px] md:min-h-[140px] transition cursor-pointer hover:border-black flex flex-col ${isToday ? 'border-black border-2' : ''}`}
                onClick={() => openPopup(d)}
              >
                <div className="flex items-center justify-between mb-1">
                  <span className={`text-sm md:text-base ${isToday ? 'font-bold text-black' : 'text-gray-700'}`}>
                    {dayNum}
                  </span>
                  {totalH > 0 && (
                    <span className="text-xs md:text-sm text-gray-500">{totalH}h</span>
                  )}
                </div>

                {/* Mobile : pastilles ou + */}
                <div className="md:hidden flex-1 flex flex-col">
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
                <div className="hidden md:flex flex-col gap-1 flex-1">
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
                            {creneaux.map((c, ci) => (
                              <p key={ci} className="text-xs text-gray-500 leading-tight">
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
            </div>
          )
        })}
      </div>

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
                    {entry.creneaux.map((c, ci) => (
                      <p key={ci} className="text-xs text-gray-600 ml-5">
                        {c.debut} - {c.fin}
                      </p>
                    ))}
                  </button>
                ))}
              </div>
            )}

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
