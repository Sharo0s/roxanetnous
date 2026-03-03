'use client'

import { useState, useCallback, useRef, useEffect } from 'react'
import { getAuxiliaireShifts } from '@/app/actions/planning-auxiliaire'
import { markDocumentAsRead } from '@/app/actions/planning-documents'
import { PlanningViewSwitcher } from '@/components/planning/planning-view-switcher'

type ViewType = 'day' | 'week' | 'month'

type AuxShift = {
  id: string
  beneficiaire_id: string
  date: string
  creneaux: unknown
  total_heures: number
  note: string | null
  beneficiaire_name: string
  couleur: string
}

type AuxDocument = {
  id: string
  nom_fichier: string
  file_size: number
  created_at: string
  beneficiaire_name: string
  is_read: boolean
}

const JOURS = ['Lun', 'Mar', 'Mer', 'Jeu', 'Ven', 'Sam', 'Dim']

function pad2(n: number) {
  return n.toString().padStart(2, '0')
}

function toLocalDateStr(d: Date) {
  return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`
}

function formatLocalDate(year: number, month: number, day: number) {
  return `${year}-${pad2(month + 1)}-${pad2(day)}`
}

function getWeekDates(date: Date): string[] {
  const d = new Date(date)
  const day = d.getDay()
  d.setDate(d.getDate() - day + (day === 0 ? -6 : 1))
  const dates: string[] = []
  for (let i = 0; i < 7; i++) {
    dates.push(toLocalDateStr(d))
    d.setDate(d.getDate() + 1)
  }
  return dates
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

function getDateRange(view: ViewType, date: Date) {
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
    return { start, end: toLocalDateStr(d) }
  }
  const year = date.getFullYear()
  const month = date.getMonth()
  return {
    start: toLocalDateStr(new Date(year, month, 1)),
    end: toLocalDateStr(new Date(year, month + 1, 0)),
  }
}

function formatFileSize(bytes: number) {
  if (bytes < 1024) return `${bytes} o`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} Ko`
  return `${(bytes / (1024 * 1024)).toFixed(1)} Mo`
}

type PopupInfo = {
  date: string
  entries: {
    benefId: string
    name: string
    couleur: string
    creneaux: { debut: string; fin: string }[]
    totalHeures: number
    note: string | null
  }[]
}

export function AuxiliairePlanningClient({
  initialShifts,
  initialDocuments,
}: {
  initialShifts: AuxShift[]
  initialDocuments: AuxDocument[]
}) {
  const [view, setView] = useState<ViewType>('week')
  const [currentDate, setCurrentDate] = useState(new Date())
  const [shifts, setShifts] = useState<AuxShift[]>(initialShifts)
  const [documents, setDocuments] = useState(initialDocuments)
  const [loading, setLoading] = useState(false)
  const [popup, setPopup] = useState<PopupInfo | null>(null)
  const popupRef = useRef<HTMLDivElement>(null)

  const today = toLocalDateStr(new Date())

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

  const fetchShifts = useCallback(async (v: ViewType, d: Date) => {
    setLoading(true)
    const range = getDateRange(v, d)
    const data = await getAuxiliaireShifts(range.start, range.end)
    setShifts(data as AuxShift[])
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

  async function handleMarkRead(docId: string) {
    await markDocumentAsRead(docId)
    setDocuments(prev => prev.map(d =>
      d.id === docId ? { ...d, is_read: true } : d
    ))
  }

  const shiftsByDate = new Map<string, AuxShift[]>()
  for (const s of shifts) {
    const arr = shiftsByDate.get(s.date) || []
    arr.push(s)
    shiftsByDate.set(s.date, arr)
  }

  function openPopup(d: string) {
    const dayShifts = shiftsByDate.get(d) || []
    if (dayShifts.length === 0) return

    const benefIds = [...new Set(dayShifts.map(s => s.beneficiaire_id))]
    const entries = benefIds.map(benefId => {
      const bShifts = dayShifts.filter(s => s.beneficiaire_id === benefId)
      const creneaux = bShifts.flatMap(s => s.creneaux as { debut: string; fin: string }[])
      const totalHeures = bShifts.reduce((sum, s) => sum + Number(s.total_heures), 0)
      const note = bShifts.find(s => s.note)?.note || null
      return {
        benefId,
        name: bShifts[0].beneficiaire_name,
        couleur: bShifts[0].couleur,
        creneaux,
        totalHeures,
        note,
      }
    })

    setPopup({ date: d, entries })
  }

  // Totaux
  const totalsByBenef = new Map<string, { name: string; total: number }>()
  for (const s of shifts) {
    const prev = totalsByBenef.get(s.beneficiaire_id) || { name: s.beneficiaire_name, total: 0 }
    prev.total += Number(s.total_heures)
    totalsByBenef.set(s.beneficiaire_id, prev)
  }
  const globalTotal = [...totalsByBenef.values()].reduce((a, b) => a + b.total, 0)

  return (
    <div>
      <h2 className="text-2xl font-bold text-gray-900 mb-4">Mon planning</h2>

      <PlanningViewSwitcher
        view={view}
        currentDate={currentDate}
        onViewChange={handleViewChange}
        onDateChange={handleDateChange}
      />

      {loading && (
        <div className="text-center py-8 text-gray-400 text-sm">Chargement...</div>
      )}

      {/* Vue jour — liste chronologique */}
      {!loading && view === 'day' && (
        <DayView
          dateStr={toLocalDateStr(currentDate)}
          shifts={shifts}
        />
      )}

      {/* Vue semaine — grille 7 colonnes */}
      {!loading && view === 'week' && (
        <WeekGrid
          weekDates={getWeekDates(currentDate)}
          shiftsByDate={shiftsByDate}
          today={today}
          onCellClick={openPopup}
        />
      )}

      {/* Vue mois — calendrier */}
      {!loading && view === 'month' && (
        <MonthGrid
          date={currentDate}
          shiftsByDate={shiftsByDate}
          today={today}
          onCellClick={openPopup}
        />
      )}

      {/* Totaux */}
      {shifts.length > 0 && (
        <div className="bg-white rounded-xl border p-4 mt-4">
          <div className="flex items-center justify-between mb-3">
            <h4 className="text-sm font-semibold text-gray-900">Total heures</h4>
            <span className="text-lg font-bold">{globalTotal.toFixed(1)}h</span>
          </div>
          <div className="space-y-1.5">
            {[...totalsByBenef.entries()].map(([id, { name, total }]) => (
              <div key={id} className="flex items-center justify-between text-sm">
                <span className="text-gray-700">{name}</span>
                <span className="font-medium">{total.toFixed(1)}h</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Documents */}
      {documents.length > 0 && (
        <div className="mt-8">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">Documents</h3>
          <div className="space-y-2">
            {documents.map(doc => (
              <div key={doc.id} className="bg-white rounded-xl border p-4 flex items-center justify-between">
                <div>
                  <p className="font-medium text-sm">{doc.nom_fichier}</p>
                  <p className="text-xs text-gray-500 mt-0.5">
                    {doc.beneficiaire_name} - {formatFileSize(doc.file_size)} - {new Date(doc.created_at).toLocaleDateString('fr-FR')}
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  {doc.is_read ? (
                    <span className="text-xs text-gray-400 px-2 py-1 border rounded-full">Lu</span>
                  ) : (
                    <button
                      onClick={() => handleMarkRead(doc.id)}
                      className="text-xs font-medium px-3 py-1.5 bg-black text-white rounded-lg hover:bg-gray-800 transition"
                    >
                      Marquer comme lu
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Popup detail jour */}
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
            <div className="space-y-2">
              {popup.entries.map(entry => (
                <div
                  key={entry.benefId}
                  className="p-3 rounded-lg border"
                  style={{ borderLeftWidth: 4, borderLeftColor: entry.couleur }}
                >
                  <div className="flex items-center gap-2 mb-1">
                    <span className="text-sm font-medium">{entry.name}</span>
                    <span className="text-xs text-gray-500 ml-auto">{entry.totalHeures}h</span>
                  </div>
                  {entry.creneaux.map((c, i) => (
                    <p key={i} className="text-xs text-gray-600">
                      {c.debut} - {c.fin}
                    </p>
                  ))}
                  {entry.note && (
                    <p className="text-xs text-gray-400 mt-1">{entry.note}</p>
                  )}
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

// --- Sous-composants ---

function DayView({ dateStr, shifts }: { dateStr: string; shifts: AuxShift[] }) {
  type TimelineItem = {
    benefName: string
    couleur: string
    debut: string
    fin: string
    note: string | null
  }

  const items: TimelineItem[] = []
  for (const s of shifts) {
    if (s.date !== dateStr) continue
    const creneaux = s.creneaux as { debut: string; fin: string }[]
    for (const c of creneaux) {
      items.push({
        benefName: s.beneficiaire_name,
        couleur: s.couleur,
        debut: c.debut,
        fin: c.fin,
        note: s.note,
      })
    }
  }
  items.sort((a, b) => a.debut.localeCompare(b.debut))

  const totalH = shifts
    .filter(s => s.date === dateStr)
    .reduce((sum, s) => sum + Number(s.total_heures), 0)

  if (items.length === 0) {
    return (
      <div className="bg-white rounded-xl border p-6 text-center text-gray-500 text-sm">
        Aucun creneau ce jour.
      </div>
    )
  }

  return (
    <div>
      <div className="space-y-2">
        {items.map((item, i) => (
          <div
            key={`${item.debut}-${i}`}
            className="bg-white rounded-xl border p-4 flex items-center gap-4"
            style={{ borderLeftWidth: 4, borderLeftColor: item.couleur }}
          >
            <div className="text-right min-w-[90px]">
              <p className="text-base font-semibold">{item.debut}</p>
              <p className="text-sm text-gray-400">{item.fin}</p>
            </div>
            <div className="flex-1">
              <p className="text-base font-medium">{item.benefName}</p>
              {item.note && (
                <p className="text-xs text-gray-400 mt-0.5 truncate">{item.note}</p>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}

function WeekGrid({
  weekDates,
  shiftsByDate,
  today,
  onCellClick,
}: {
  weekDates: string[]
  shiftsByDate: Map<string, AuxShift[]>
  today: string
  onCellClick: (d: string) => void
}) {
  return (
    <div className="grid grid-cols-7 gap-1">
      {weekDates.map((d, i) => {
        const dayShifts = shiftsByDate.get(d) || []
        const benefIds = [...new Set(dayShifts.map(s => s.beneficiaire_id))]
        const isToday = d === today
        const dayNum = new Date(d + 'T12:00:00').getDate()
        const totalH = dayShifts.reduce((sum, s) => sum + Number(s.total_heures), 0)

        return (
          <div key={d} className="flex flex-col">
            <div className="text-center mb-1">
              <span className={`text-sm md:text-base font-medium ${isToday ? 'text-black' : 'text-gray-500'}`}>
                {JOURS[i]}
              </span>
            </div>
            <div
              className={`rounded-lg border p-2 min-h-[100px] md:min-h-[140px] transition flex flex-col ${
                isToday ? 'border-black border-2' : ''
              } ${dayShifts.length > 0 ? 'cursor-pointer hover:border-black' : ''}`}
              onClick={() => dayShifts.length > 0 && onCellClick(d)}
            >
              <div className="flex items-center justify-between mb-1">
                <span className={`text-sm md:text-base ${isToday ? 'font-bold text-black' : 'text-gray-700'}`}>
                  {dayNum}
                </span>
                {totalH > 0 && (
                  <span className="text-xs md:text-sm text-gray-500">{totalH}h</span>
                )}
              </div>

              {/* Mobile : pastilles */}
              {benefIds.length > 0 && (
                <div className="flex flex-wrap gap-1 md:hidden">
                  {benefIds.map(benefId => {
                    const s = dayShifts.find(s => s.beneficiaire_id === benefId)!
                    return (
                      <div
                        key={benefId}
                        className="w-4 h-4 rounded-full"
                        style={{ backgroundColor: s.couleur }}
                      />
                    )
                  })}
                </div>
              )}

              {/* Desktop : noms + horaires */}
              <div className="hidden md:flex flex-col gap-1">
                {benefIds.map(benefId => {
                  const bShifts = dayShifts.filter(s => s.beneficiaire_id === benefId)
                  const creneaux = bShifts.flatMap(s => s.creneaux as { debut: string; fin: string }[])
                  return (
                    <div key={benefId} className="text-left">
                      <p className="text-sm font-medium truncate" style={{ color: bShifts[0].couleur }}>
                        {bShifts[0].beneficiaire_name}
                      </p>
                      {creneaux.map((c, ci) => (
                        <p key={ci} className="text-xs text-gray-500 leading-tight">
                          {c.debut}-{c.fin}
                        </p>
                      ))}
                    </div>
                  )
                })}
              </div>
            </div>
          </div>
        )
      })}
    </div>
  )
}

function MonthGrid({
  date,
  shiftsByDate,
  today,
  onCellClick,
}: {
  date: Date
  shiftsByDate: Map<string, AuxShift[]>
  today: string
  onCellClick: (d: string) => void
}) {
  const weeks = getMonthCalendar(date)

  return (
    <div className="overflow-x-auto">
      <table className="w-full border-collapse">
        <thead>
          <tr>
            {JOURS.map(j => (
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
                const benefIds = [...new Set(dayShifts.map(s => s.beneficiaire_id))]
                const isToday = d === today
                const dayNum = new Date(d + 'T12:00:00').getDate()
                const totalH = dayShifts.reduce((sum, s) => sum + Number(s.total_heures), 0)

                return (
                  <td key={d} className="p-1 align-top">
                    <div
                      className={`rounded-lg border p-2 min-h-[60px] md:min-h-[90px] transition flex flex-col ${
                        isToday ? 'border-black border-2' : ''
                      } ${dayShifts.length > 0 ? 'cursor-pointer hover:border-black' : ''}`}
                      onClick={() => dayShifts.length > 0 && onCellClick(d)}
                    >
                      <div className="flex items-center justify-between mb-1">
                        <span className={`text-sm md:text-base ${isToday ? 'font-bold text-black' : 'text-gray-700'}`}>
                          {dayNum}
                        </span>
                        {totalH > 0 && (
                          <span className="text-xs md:text-sm text-gray-500 hidden md:inline">{totalH}h</span>
                        )}
                      </div>

                      {/* Mobile : pastilles */}
                      {benefIds.length > 0 && (
                        <div className="flex flex-wrap gap-1 md:hidden">
                          {benefIds.map(benefId => {
                            const s = dayShifts.find(s => s.beneficiaire_id === benefId)!
                            return (
                              <div
                                key={benefId}
                                className="w-4 h-4 rounded-full"
                                style={{ backgroundColor: s.couleur }}
                              />
                            )
                          })}
                        </div>
                      )}

                      {/* Desktop : noms + horaires */}
                      <div className="hidden md:flex flex-col gap-1">
                        {benefIds.map(benefId => {
                          const bShifts = dayShifts.filter(s => s.beneficiaire_id === benefId)
                          const creneaux = bShifts.flatMap(s => s.creneaux as { debut: string; fin: string }[])
                          return (
                            <div key={benefId} className="text-left">
                              <p className="text-sm font-medium truncate" style={{ color: bShifts[0].couleur }}>
                                {bShifts[0].beneficiaire_name}
                              </p>
                              {creneaux.map((c, ci) => (
                                <p key={ci} className="text-xs text-gray-500 leading-tight">
                                  {c.debut}-{c.fin}
                                </p>
                              ))}
                            </div>
                          )
                        })}
                      </div>
                    </div>
                  </td>
                )
              })}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
