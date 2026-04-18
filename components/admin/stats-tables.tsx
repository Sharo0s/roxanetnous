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
      active ? 'bg-accent text-black' : 'bg-white border text-gray-600 hover:bg-gray-50'
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
              <th className="text-right px-4 py-3 font-medium text-gray-500">Accompagnés</th>
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
              <th className="text-right px-4 py-3 font-medium text-gray-500">Abonnés</th>
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

type MrrSegmentRow = {
  mois: string
  accompagnante_mensuel: { count: number; mrr: number }
  accompagnante_annuel: { count: number; mrr: number }
  accompagne_mensuel: { count: number; mrr: number }
  accompagne_annuel: { count: number; mrr: number }
  total: number
}

export function MrrSegmentTable({ data }: { data: MrrSegmentRow[] }) {
  const { period, setPeriod, filtered } = useFiltered(data)

  return (
    <div>
      <PeriodButtons data={data} period={period} setPeriod={setPeriod} />
      <div className="bg-white rounded-xl border overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-accent/20 border-b">
            <tr>
              <th className="text-left px-4 py-3 font-medium text-gray-500">Mois</th>
              <th className="text-right px-4 py-3 font-medium text-gray-500">Acc. Mens.</th>
              <th className="text-right px-4 py-3 font-medium text-gray-500">Acc. Ann.</th>
              <th className="text-right px-4 py-3 font-medium text-gray-500">Acg. Mens.</th>
              <th className="text-right px-4 py-3 font-medium text-gray-500">Acg. Ann.</th>
              <th className="text-right px-4 py-3 font-medium text-gray-500">MRR Total</th>
            </tr>
          </thead>
          <tbody>
            {filtered.map((row) => {
              const isZero = row.total === 0
              return (
                <tr key={row.mois} className={`border-b last:border-0 hover:bg-accent/10 ${isZero ? 'text-gray-300' : ''}`}>
                  <td className={`px-4 py-3 ${isZero ? '' : 'font-medium'}`}>{formatMois(row.mois)}</td>
                  <td className="px-4 py-3 text-right">
                    <span>{row.accompagnante_mensuel.count}</span>
                    <span className="text-gray-400 ml-1 text-xs">({formatEur(row.accompagnante_mensuel.mrr)})</span>
                  </td>
                  <td className="px-4 py-3 text-right">
                    <span>{row.accompagnante_annuel.count}</span>
                    <span className="text-gray-400 ml-1 text-xs">({formatEur(row.accompagnante_annuel.mrr)})</span>
                  </td>
                  <td className="px-4 py-3 text-right">
                    <span>{row.accompagne_mensuel.count}</span>
                    <span className="text-gray-400 ml-1 text-xs">({formatEur(row.accompagne_mensuel.mrr)})</span>
                  </td>
                  <td className="px-4 py-3 text-right">
                    <span>{row.accompagne_annuel.count}</span>
                    <span className="text-gray-400 ml-1 text-xs">({formatEur(row.accompagne_annuel.mrr)})</span>
                  </td>
                  <td className={`px-4 py-3 text-right ${isZero ? '' : 'font-medium'}`}>{formatEur(row.total)}</td>
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
  data: { mois: string; messages: number; conversations: number }[]
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
            </tr>
          </thead>
          <tbody>
            {filtered.map((row) => {
              const isZero = row.messages === 0 && row.conversations === 0
              return (
                <tr key={row.mois} className={`border-b last:border-0 hover:bg-accent/10 ${isZero ? 'text-gray-300' : ''}`}>
                  <td className={`px-4 py-3 ${isZero ? '' : 'font-medium'}`}>{formatMois(row.mois)}</td>
                  <td className="px-4 py-3 text-right">{row.messages}</td>
                  <td className="px-4 py-3 text-right">{row.conversations}</td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
    </div>
  )
}

// --- Resiliations ---

const FEEDBACK_LABELS: Record<string, string> = {
  customer_service: 'Service client',
  low_quality: 'Qualité insuffisante',
  missing_features: 'Fonctionnalités manquantes',
  switched_service: 'Passé à un concurrent',
  too_complex: 'Trop complexe',
  too_expensive: 'Trop cher',
  unused: 'Non utilisé',
  other: 'Autre',
}

type AnnulationRow = {
  date: string | null
  nom: string
  email: string
  role: string
  plan: string
  feedback: string | null
  comment: string | null
  pending?: boolean
}

type PeriodFilter = 'ce-mois' | '3-mois' | '12-mois' | 'tout'

export function ResiliationsTable({ data }: { data: AnnulationRow[] }) {
  const [period, setPeriod] = useState<PeriodFilter>('3-mois')

  const filtered = useMemo(() => {
    if (period === 'tout') return data
    const now = new Date()
    let cutoff: Date
    if (period === 'ce-mois') {
      cutoff = new Date(now.getFullYear(), now.getMonth(), 1)
    } else if (period === '3-mois') {
      cutoff = new Date(now.getFullYear(), now.getMonth() - 3, 1)
    } else {
      cutoff = new Date(now.getFullYear() - 1, now.getMonth(), 1)
    }
    return data.filter((a) => {
      if (!a.date) return true
      return new Date(a.date) >= cutoff
    })
  }, [data, period])

  const btnClass = (active: boolean) =>
    `px-3 py-1.5 text-xs font-medium rounded-lg transition-colors ${
      active ? 'bg-accent text-black' : 'bg-white border text-gray-600 hover:bg-gray-50'
    }`

  return (
    <div>
      <div className="flex gap-2 mb-4">
        <button onClick={() => setPeriod('ce-mois')} className={btnClass(period === 'ce-mois')}>Ce mois</button>
        <button onClick={() => setPeriod('3-mois')} className={btnClass(period === '3-mois')}>3 derniers mois</button>
        <button onClick={() => setPeriod('12-mois')} className={btnClass(period === '12-mois')}>12 derniers mois</button>
        <button onClick={() => setPeriod('tout')} className={btnClass(period === 'tout')}>Tout</button>
      </div>
      <div className="bg-white rounded-xl border overflow-hidden">
        {filtered.length === 0 ? (
          <div className="p-8 text-center text-gray-500 text-sm">
            Aucune résiliation sur cette période.
          </div>
        ) : (
          <table className="w-full text-sm">
            <thead className="bg-accent/20 border-b">
              <tr>
                <th className="text-left px-4 py-3 font-medium text-gray-500">Date</th>
                <th className="text-left px-4 py-3 font-medium text-gray-500">Nom</th>
                <th className="text-left px-4 py-3 font-medium text-gray-500">Email</th>
                <th className="text-left px-4 py-3 font-medium text-gray-500">Rôle</th>
                <th className="text-left px-4 py-3 font-medium text-gray-500">Plan</th>
                <th className="text-left px-4 py-3 font-medium text-gray-500">Raison</th>
                <th className="text-left px-4 py-3 font-medium text-gray-500">Commentaire</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((a, i) => (
                <tr key={i} className="border-b last:border-0 hover:bg-accent/10">
                  <td className="px-4 py-3 text-gray-400 whitespace-nowrap">
                    {a.date ? new Date(a.date).toLocaleDateString('fr-FR') : '-'}
                    {a.pending && <span className="ml-1 text-xs bg-accent/30 text-gray-700 px-1.5 py-0.5 rounded-full">Prévue</span>}
                  </td>
                  <td className="px-4 py-3 font-medium">{a.nom}</td>
                  <td className="px-4 py-3 text-gray-500">{a.email}</td>
                  <td className="px-4 py-3">
                    <span className="text-xs bg-gray-200 text-gray-700 px-2 py-0.5 rounded-full">{a.role}</span>
                  </td>
                  <td className="px-4 py-3">{a.plan === 'annuel' || a.plan === 'annual' ? 'Annuel' : 'Mensuel'}</td>
                  <td className="px-4 py-3 text-gray-500">{a.feedback ? FEEDBACK_LABELS[a.feedback] || a.feedback : '-'}</td>
                  <td className="px-4 py-3 text-gray-500 max-w-48 truncate">{a.comment || '-'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  )
}
