'use client'

import { useState, useMemo } from 'react'

function formatMois(mois: string) {
  const [year, month] = mois.split('-')
  const date = new Date(parseInt(year), parseInt(month) - 1)
  return date.toLocaleDateString('fr-FR', { month: 'short', year: '2-digit' })
}

function formatEur(n: number) {
  return n.toLocaleString('fr-FR', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + ' EUR'
}

// --- Period selector ---

function PeriodButtons({ data, period, setPeriod }: {
  data: { mois: string }[]
  period: string
  setPeriod: (p: string) => void
}) {
  const years = useMemo(() => {
    const set = new Set<string>()
    for (const row of data) set.add(row.mois.split('-')[0])
    return Array.from(set).sort()
  }, [data])

  const btnClass = (active: boolean) =>
    `px-3 py-1.5 text-xs font-medium rounded-lg transition-colors ${
      active ? 'bg-accent text-white' : 'bg-white border text-gray-600 hover:bg-gray-50'
    }`

  return (
    <div className="flex gap-2 mb-4">
      <button onClick={() => setPeriod('12m')} className={btnClass(period === '12m')}>12 derniers mois</button>
      {years.map((y) => (
        <button key={y} onClick={() => setPeriod(y)} className={btnClass(period === y)}>{y}</button>
      ))}
      <button onClick={() => setPeriod('all')} className={btnClass(period === 'all')}>Tout</button>
    </div>
  )
}

function useFiltered<T extends { mois: string }>(data: T[]) {
  const [period, setPeriod] = useState('12m')
  const filtered = useMemo(() => {
    if (period === '12m') return data.slice(-12)
    if (period === 'all') return data
    return data.filter((row) => row.mois.startsWith(period))
  }, [data, period])
  return { period, setPeriod, filtered }
}

// --- Tables ---

export function InscriptionsTable({ data }: {
  data: { mois: string; accompagnantes: number; accompagnes: number; total: number }[]
}) {
  const { period, setPeriod, filtered } = useFiltered(data)

  return (
    <div>
      <PeriodButtons data={data} period={period} setPeriod={setPeriod} />
      <div className="bg-white rounded-xl border overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-accent/20 border-b">
            <tr>
              <th className="text-left px-4 py-3 font-medium text-gray-500">Mois</th>
              <th className="text-right px-4 py-3 font-medium text-gray-500">Accompagnantes</th>
              <th className="text-right px-4 py-3 font-medium text-gray-500">Accompagnes</th>
              <th className="text-right px-4 py-3 font-medium text-gray-500">Total</th>
            </tr>
          </thead>
          <tbody>
            {filtered.map((row) => {
              const isZero = row.total === 0
              return (
                <tr key={row.mois} className={`border-b last:border-0 hover:bg-accent/10 ${isZero ? 'text-gray-300' : ''}`}>
                  <td className={`px-4 py-3 ${isZero ? '' : 'font-medium'}`}>{formatMois(row.mois)}</td>
                  <td className="px-4 py-3 text-right">{row.accompagnantes}</td>
                  <td className="px-4 py-3 text-right">{row.accompagnes}</td>
                  <td className={`px-4 py-3 text-right ${isZero ? '' : 'font-medium'}`}>{row.total}</td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
    </div>
  )
}

export function RevenusTable({ data }: {
  data: { mois: string; abonnes: number; mrr: number }[]
}) {
  const { period, setPeriod, filtered } = useFiltered(data)

  return (
    <div>
      <PeriodButtons data={data} period={period} setPeriod={setPeriod} />
      <div className="bg-white rounded-xl border overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-accent/20 border-b">
            <tr>
              <th className="text-left px-4 py-3 font-medium text-gray-500">Mois</th>
              <th className="text-right px-4 py-3 font-medium text-gray-500">Abonnes</th>
              <th className="text-right px-4 py-3 font-medium text-gray-500">MRR</th>
            </tr>
          </thead>
          <tbody>
            {filtered.map((row) => {
              const isZero = row.abonnes === 0
              return (
                <tr key={row.mois} className={`border-b last:border-0 hover:bg-accent/10 ${isZero ? 'text-gray-300' : ''}`}>
                  <td className={`px-4 py-3 ${isZero ? '' : 'font-medium'}`}>{formatMois(row.mois)}</td>
                  <td className="px-4 py-3 text-right">{row.abonnes}</td>
                  <td className={`px-4 py-3 text-right ${isZero ? '' : 'font-medium'}`}>{formatEur(row.mrr)}</td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
    </div>
  )
}

export function ActiviteTable({ data }: {
  data: { mois: string; messages: number; conversations: number; avis: number }[]
}) {
  const { period, setPeriod, filtered } = useFiltered(data)

  return (
    <div>
      <PeriodButtons data={data} period={period} setPeriod={setPeriod} />
      <div className="bg-white rounded-xl border overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-accent/20 border-b">
            <tr>
              <th className="text-left px-4 py-3 font-medium text-gray-500">Mois</th>
              <th className="text-right px-4 py-3 font-medium text-gray-500">Messages</th>
              <th className="text-right px-4 py-3 font-medium text-gray-500">Conversations</th>
              <th className="text-right px-4 py-3 font-medium text-gray-500">Avis</th>
            </tr>
          </thead>
          <tbody>
            {filtered.map((row) => {
              const isZero = row.messages === 0 && row.conversations === 0 && row.avis === 0
              return (
                <tr key={row.mois} className={`border-b last:border-0 hover:bg-accent/10 ${isZero ? 'text-gray-300' : ''}`}>
                  <td className={`px-4 py-3 ${isZero ? '' : 'font-medium'}`}>{formatMois(row.mois)}</td>
                  <td className="px-4 py-3 text-right">{row.messages}</td>
                  <td className="px-4 py-3 text-right">{row.conversations}</td>
                  <td className="px-4 py-3 text-right">{row.avis}</td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
    </div>
  )
}
