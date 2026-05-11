'use client'

import { useState, useMemo } from 'react'

type PeriodOption = '12m' | string // '12m' ou une annee comme '2025', '2026'

export function PeriodSelector<T extends { mois: string }>({
  data,
  children,
}: {
  data: T[]
  children: (filtered: T[]) => React.ReactNode
}) {
  // Extraire les annees disponibles
  const years = useMemo(() => {
    const set = new Set<string>()
    for (const row of data) {
      set.add(row.mois.split('-')[0])
    }
    return Array.from(set).sort()
  }, [data])

  const [period, setPeriod] = useState<PeriodOption>('12m')

  const filtered = useMemo(() => {
    if (period === '12m') {
      return data.slice(-12)
    }
    if (period === 'all') {
      return data
    }
    return data.filter((row) => row.mois.startsWith(period))
  }, [data, period])

  return (
    <div>
      <div className="flex gap-2 mb-4">
        <button
          onClick={() => setPeriod('12m')}
          className={`px-3 py-1.5 text-xs rounded-full transition ${
            period === '12m'
              ? 'bg-accent border border-accent text-black font-medium'
              : 'bg-white border border-[#e8dfd2] text-gray-700 hover:border-kraft'
          }`}
        >
          12 derniers mois
        </button>
        {years.map((y) => (
          <button
            key={y}
            onClick={() => setPeriod(y)}
            className={`px-3 py-1.5 text-xs rounded-full transition ${
              period === y
                ? 'bg-accent border border-accent text-black font-medium'
                : 'bg-white border border-[#e8dfd2] text-gray-700 hover:border-kraft'
            }`}
          >
            {y}
          </button>
        ))}
        <button
          onClick={() => setPeriod('all')}
          className={`px-3 py-1.5 text-xs rounded-full transition ${
            period === 'all'
              ? 'bg-accent border border-accent text-black font-medium'
              : 'bg-white border border-[#e8dfd2] text-gray-700 hover:border-kraft'
          }`}
        >
          Tout
        </button>
      </div>
      {children(filtered)}
    </div>
  )
}
