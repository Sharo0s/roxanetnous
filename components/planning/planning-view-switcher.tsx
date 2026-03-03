'use client'

type ViewType = 'day' | 'week' | 'month'

const LABELS: Record<ViewType, string> = {
  day: 'Jour',
  week: 'Semaine',
  month: 'Mois',
}

function formatPeriodLabel(view: ViewType, date: Date): string {
  const opts: Intl.DateTimeFormatOptions = { month: 'long', year: 'numeric' }
  if (view === 'day') {
    return date.toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })
  }
  if (view === 'week') {
    const start = new Date(date)
    const day = start.getDay()
    start.setDate(start.getDate() - day + (day === 0 ? -6 : 1))
    const end = new Date(start)
    end.setDate(start.getDate() + 6)
    const s = start.toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' })
    const e = end.toLocaleDateString('fr-FR', { day: 'numeric', month: 'short', year: 'numeric' })
    return `${s} - ${e}`
  }
  return date.toLocaleDateString('fr-FR', opts)
}

export function PlanningViewSwitcher({
  view,
  currentDate,
  onViewChange,
  onDateChange,
}: {
  view: ViewType
  currentDate: Date
  onViewChange: (v: ViewType) => void
  onDateChange: (d: Date) => void
}) {
  function navigate(direction: -1 | 1) {
    const d = new Date(currentDate)
    if (view === 'day') d.setDate(d.getDate() + direction)
    else if (view === 'week') d.setDate(d.getDate() + direction * 7)
    else d.setMonth(d.getMonth() + direction)
    onDateChange(d)
  }

  function goToday() {
    onDateChange(new Date())
  }

  return (
    <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 mb-6">
      <div className="flex items-center gap-2">
        {(['day', 'week', 'month'] as ViewType[]).map(v => (
          <button
            key={v}
            onClick={() => onViewChange(v)}
            className={`px-3 py-1.5 text-sm font-medium rounded-lg transition ${
              view === v ? 'bg-black text-white' : 'border hover:border-black'
            }`}
          >
            {LABELS[v]}
          </button>
        ))}
      </div>

      <div className="flex items-center gap-3">
        <button
          onClick={() => navigate(-1)}
          className="p-1.5 border rounded-lg hover:border-black transition"
          aria-label="Precedent"
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
          </svg>
        </button>

        <button
          onClick={goToday}
          className="px-3 py-1.5 text-xs font-medium border rounded-lg hover:border-black transition"
        >
          Aujourd'hui
        </button>

        <span className="text-sm font-medium text-gray-900 min-w-[200px] text-center">
          {formatPeriodLabel(view, currentDate)}
        </span>

        <button
          onClick={() => navigate(1)}
          className="p-1.5 border rounded-lg hover:border-black transition"
          aria-label="Suivant"
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
          </svg>
        </button>
      </div>
    </div>
  )
}
