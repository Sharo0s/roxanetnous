'use client'

import { useState, useRef, useEffect } from 'react'
import type { ShiftData, TeamMember } from '@/components/planning/planning-grid-client'

function pad2(n: number) {
  return n.toString().padStart(2, '0')
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

export function PlanningDayView({
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
  const dateStr = `${date.getFullYear()}-${pad2(date.getMonth() + 1)}-${pad2(date.getDate())}`
  const activeTeam = team.filter(m => m.actif)
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

  // Construire la liste chronologique : un item par (auxiliaire, creneau)
  type TimelineItem = {
    auxId: string
    name: string
    couleur: string
    debut: string
    fin: string
    totalHeures: number
    note: string | null
  }

  const items: TimelineItem[] = []
  for (const s of shifts) {
    if (s.date !== dateStr) continue
    const member = activeTeam.find(m => m.auxiliaire_user_id === s.auxiliaire_user_id)
    if (!member) continue
    const creneaux = s.creneaux as { debut: string; fin: string }[]
    for (const c of creneaux) {
      items.push({
        auxId: s.auxiliaire_user_id,
        name: `${member.first_name} ${member.last_name?.[0]?.toUpperCase()}.`,
        couleur: member.couleur,
        debut: c.debut,
        fin: c.fin,
        totalHeures: Number(s.total_heures),
        note: s.note,
      })
    }
  }

  items.sort((a, b) => a.debut.localeCompare(b.debut))

  const totalH = shifts
    .filter(s => s.date === dateStr)
    .reduce((sum, s) => sum + Number(s.total_heures), 0)

  function openAddPopup() {
    const auxIdsWithShift = new Set(shifts.filter(s => s.date === dateStr).map(s => s.auxiliaire_user_id))

    const entries = [...auxIdsWithShift].map(auxId => {
      const member = activeTeam.find(m => m.auxiliaire_user_id === auxId)!
      const auxShifts = shifts.filter(s => s.date === dateStr && s.auxiliaire_user_id === auxId)
      const creneaux = auxShifts.flatMap(s => s.creneaux as { debut: string; fin: string }[])
      const totalHeures = auxShifts.reduce((sum, s) => sum + Number(s.total_heures), 0)
      return {
        auxId,
        name: `${member.first_name} ${member.last_name?.[0]?.toUpperCase()}.`,
        couleur: member.couleur,
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

    setPopup({ date: dateStr, entries, available })
  }

  if (activeTeam.length === 0) {
    return (
      <div className="bg-white rounded-xl border p-6 text-center text-gray-500">
        Aucun auxiliaire actif dans votre equipe.
      </div>
    )
  }

  return (
    <div>
      {/* Liste chronologique */}
      {items.length > 0 ? (
        <div className="space-y-2 mb-4">
          {items.map((item, i) => (
            <button
              key={`${item.auxId}-${item.debut}-${i}`}
              onClick={() => onCellClick(item.auxId, dateStr)}
              className="w-full bg-white rounded-xl border p-4 text-left hover:border-black transition flex items-center gap-4"
              style={{ borderLeftWidth: 4, borderLeftColor: item.couleur }}
            >
              <div className="text-right min-w-[90px]">
                <p className="text-base font-semibold">{item.debut}</p>
                <p className="text-sm text-gray-400">{item.fin}</p>
              </div>
              <div className="flex-1">
                <p className="text-base font-medium" style={{ color: item.couleur }}>
                  {item.name}
                </p>
                {item.note && (
                  <p className="text-xs text-gray-400 mt-0.5 truncate">{item.note}</p>
                )}
              </div>
            </button>
          ))}
        </div>
      ) : (
        <div className="bg-white rounded-xl border p-6 text-center text-gray-500 text-sm mb-4">
          Aucun creneau ce jour.
        </div>
      )}

      {/* Bouton ajouter */}
      <button
        onClick={openAddPopup}
        className="w-full py-3 border border-dashed rounded-xl text-sm font-medium text-black hover:border-black transition"
      >
        + Ajouter un creneau
      </button>

      {/* Popup choix auxiliaire */}
      {popup && (
        <div className="fixed inset-0 z-50 flex items-end md:items-center md:justify-center" onClick={() => setPopup(null)}>
          <div className="absolute inset-0 bg-black/30" />
          <div
            ref={popupRef}
            className="relative w-full md:w-auto md:min-w-[360px] md:max-w-[420px] bg-white rounded-t-2xl md:rounded-2xl p-5 pb-8 md:pb-5 shadow-xl max-h-[70vh] overflow-y-auto"
            onClick={e => e.stopPropagation()}
          >
            <div className="w-10 h-1 bg-gray-300 rounded-full mx-auto mb-4 md:hidden" />
            <p className="text-sm font-semibold text-gray-900 mb-3">Ajouter un creneau</p>

            {popup.entries.length > 0 && (
              <div className="space-y-2 mb-4">
                <p className="text-xs text-gray-500 mb-1">Modifier un creneau existant</p>
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
                  <p className="text-xs text-gray-500 mb-2">Nouvel auxiliaire</p>
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
