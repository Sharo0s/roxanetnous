'use client'

import { useState, useMemo } from 'react'
import Link from 'next/link'
import type { AccompagnanteRow, AccompagneRow } from '@/app/admin/utilisateurs/page'
import { formatExperienceLabel } from '@/lib/constants'
import { GrantSubscriptionModal } from './grant-subscription-modal'

type Tab = 'accompagnantes' | 'accompagnes' | 'resiliations'

export type AnnulationRow = {
  date: string | null
  nom: string
  email: string
  role: string
  plan: string
  feedback: string | null
  comment: string | null
  pending?: boolean
}

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

const VALIDATION_LABELS: Record<string, string> = {
  en_attente: 'En attente',
  visio_a_planifier: 'En attente de visio',
  visio_realisee: 'Visio réalisée',
  valide: 'Validé',
  refuse: 'Refusé',
  a_completer: 'À compléter',
}

const ROLE_LABELS: Record<string, string> = {
  accompagnante: 'Accompagnante',
  accompagne: 'Accompagné',
  admin: 'Administrateur',
}

const VALIDATION_STYLES: Record<string, string> = {
  en_attente: 'bg-gray-200 text-gray-700',
  visio_a_planifier: 'bg-blue-50 text-blue-800 border border-blue-200',
  visio_realisee: 'bg-amber-50 text-amber-800 border border-amber-200',
  valide: 'bg-accent text-black',
  refuse: 'bg-white text-gray-900 border border-gray-400',
  a_completer: 'bg-gray-100 text-gray-700 border border-gray-300',
}

export function UtilisateursClient({
  accompagnantes,
  accompagnes,
  enAttenteCount,
  validesCount,
  diplomeLabels,
  annulations = [],
}: {
  accompagnantes: AccompagnanteRow[]
  accompagnes: AccompagneRow[]
  enAttenteCount: number
  validesCount: number
  diplomeLabels: Record<string, string>
  annulations?: AnnulationRow[]
}) {
  const [tab, setTab] = useState<Tab>('accompagnantes')
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState<string>('tous')

  const filteredAccompagnantes = useMemo(() => {
    let result = accompagnantes
    if (search) {
      const q = search.toLowerCase()
      result = result.filter(
        (u) =>
          u.first_name?.toLowerCase().includes(q) ||
          u.last_name?.toLowerCase().includes(q) ||
          u.email?.toLowerCase().includes(q) ||
          u.ville?.toLowerCase().includes(q)
      )
    }
    if (statusFilter !== 'tous') {
      result = result.filter((u) => u.validation_status === statusFilter)
    }
    return result
  }, [accompagnantes, search, statusFilter])

  const filteredAccompagnes = useMemo(() => {
    if (!search) return accompagnes
    const q = search.toLowerCase()
    return accompagnes.filter(
      (u) =>
        u.first_name?.toLowerCase().includes(q) ||
        u.last_name?.toLowerCase().includes(q) ||
        u.email?.toLowerCase().includes(q) ||
        u.ville?.toLowerCase().includes(q)
    )
  }, [accompagnes, search])

  return (
    <div className="max-w-6xl mx-auto px-4 py-10 md:py-14">
      <header className="mb-8">
        <div className="text-xs uppercase tracking-[0.18em] text-kraft mb-2">Espace admin</div>
        <h2 className="text-3xl md:text-4xl italic text-gray-900 leading-tight">Utilisateurs</h2>
      </header>

      {/* Onglets */}
      <div className="flex gap-2 mb-8 flex-wrap">
        <button
          onClick={() => { setTab('accompagnantes'); setStatusFilter('tous') }}
          className={`inline-flex items-center px-5 py-2 rounded-full text-sm transition ${
            tab === 'accompagnantes'
              ? 'bg-accent border border-accent text-black font-medium'
              : 'bg-white border border-[#e8dfd2] text-gray-700 hover:border-kraft'
          }`}
        >
          Accompagnants ({accompagnantes.length})
        </button>
        <button
          onClick={() => { setTab('accompagnes'); setStatusFilter('tous') }}
          className={`inline-flex items-center px-5 py-2 rounded-full text-sm transition ${
            tab === 'accompagnes'
              ? 'bg-accent border border-accent text-black font-medium'
              : 'bg-white border border-[#e8dfd2] text-gray-700 hover:border-kraft'
          }`}
        >
          Accompagnés ({accompagnes.length})
        </button>
        {annulations.length > 0 && (
          <button
            onClick={() => { setTab('resiliations'); setStatusFilter('tous') }}
            className={`inline-flex items-center px-5 py-2 rounded-full text-sm transition ${
              tab === 'resiliations'
                ? 'bg-accent border border-accent text-black font-medium'
                : 'bg-white border border-[#e8dfd2] text-gray-700 hover:border-kraft'
            }`}
          >
            Résiliations ({annulations.length})
          </button>
        )}
      </div>

      {/* KPIs */}
      {tab === 'resiliations' ? null : tab === 'accompagnantes' ? (
        <div className="grid grid-cols-3 gap-3 md:gap-4 mb-6">
          <button
            onClick={() => setStatusFilter('tous')}
            className={`bg-white rounded-2xl border p-5 text-left transition ${
              statusFilter === 'tous' ? 'border-kraft' : 'border-[#e8dfd2] hover:border-kraft'
            }`}
          >
            <p className="text-[11px] uppercase tracking-[0.12em] text-kraft font-medium">Total</p>
            <p className="italic text-3xl text-gray-900 mt-1">{accompagnantes.length}</p>
          </button>
          <button
            onClick={() => setStatusFilter('en_attente')}
            className={`bg-white rounded-2xl border p-5 text-left transition ${
              statusFilter === 'en_attente' ? 'border-kraft' : 'border-[#e8dfd2] hover:border-kraft'
            }`}
          >
            <p className="text-[11px] uppercase tracking-[0.12em] text-kraft font-medium">En attente</p>
            <p className="italic text-3xl text-gray-900 mt-1">{enAttenteCount}</p>
          </button>
          <button
            onClick={() => setStatusFilter('valide')}
            className={`bg-white rounded-2xl border p-5 text-left transition ${
              statusFilter === 'valide' ? 'border-kraft' : 'border-[#e8dfd2] hover:border-kraft'
            }`}
          >
            <p className="text-[11px] uppercase tracking-[0.12em] text-kraft font-medium">Validés</p>
            <p className="italic text-3xl text-gray-900 mt-1">{validesCount}</p>
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-2 gap-3 md:gap-4 mb-6">
          <div className="bg-white rounded-2xl border border-[#e8dfd2] p-5">
            <p className="text-[11px] uppercase tracking-[0.12em] text-kraft font-medium">Total</p>
            <p className="italic text-3xl text-gray-900 mt-1">{accompagnes.length}</p>
          </div>
          <div className="bg-white rounded-2xl border border-[#e8dfd2] p-5">
            <p className="text-[11px] uppercase tracking-[0.12em] text-kraft font-medium">Ce mois</p>
            <p className="italic text-3xl text-gray-900 mt-1">
              {accompagnes.filter((u) => {
                const d = new Date(u.created_at)
                const now = new Date()
                return d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear()
              }).length}
            </p>
          </div>
        </div>
      )}

      {/* Recherche */}
      {tab !== 'resiliations' && <div className="mb-4">
        <input
          type="text"
          placeholder="Rechercher par nom, email ou ville..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="w-full px-4 py-2.5 bg-white border border-[#e8dfd2] rounded-full text-sm focus:outline-none focus:border-kraft transition"
        />
      </div>}

      {/* Filtre statut accompagnants */}
      {tab === 'accompagnantes' && (
        <div className="flex gap-2 mb-6 flex-wrap">
          {['tous', 'en_attente', 'visio_a_planifier', 'visio_realisee', 'valide', 'refuse', 'a_completer'].map((s) => (
            <button
              key={s}
              onClick={() => setStatusFilter(s)}
              className={`px-3 py-1.5 rounded-full text-xs transition ${
                statusFilter === s
                  ? 'bg-accent border border-accent text-black font-medium'
                  : 'bg-white border border-[#e8dfd2] text-gray-700 hover:border-kraft'
              }`}
            >
              {s === 'tous' ? 'Tous' : VALIDATION_LABELS[s]}
            </button>
          ))}
        </div>
      )}

      {/* Tableau */}
      {tab === 'accompagnantes' ? (
        <AccompagnantesTable
          accompagnantes={filteredAccompagnantes}
          diplomeLabels={diplomeLabels}
        />
      ) : tab === 'accompagnes' ? (
        <AccompagnesTable accompagnes={filteredAccompagnes} />
      ) : (
        <ResiliationsPanel annulations={annulations} />
      )}
    </div>
  )
}

function AccompagnantesTable({
  accompagnantes,
  diplomeLabels,
}: {
  accompagnantes: AccompagnanteRow[]
  diplomeLabels: Record<string, string>
}) {
  if (accompagnantes.length === 0) {
    return (
      <div className="bg-white rounded-2xl border border-[#e8dfd2] p-10 text-center text-gray-500 italic">
        Aucun accompagnant ne correspond à ces critères.
      </div>
    )
  }

  return (
    <div className="bg-white rounded-2xl border border-[#e8dfd2] overflow-hidden">
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="bg-[#faf7f2] border-b border-[#e8dfd2]">
            <tr>
              <th className="text-left px-4 py-3 font-medium text-gray-500">Nom</th>
              <th className="text-left px-4 py-3 font-medium text-gray-500">Ville</th>
              <th className="text-left px-4 py-3 font-medium text-gray-500">Statut</th>
              <th className="text-left px-4 py-3 font-medium text-gray-500">Diplôme</th>
              <th className="text-left px-4 py-3 font-medium text-gray-500">Expérience</th>
              <th className="text-left px-4 py-3 font-medium text-gray-500">Inscription</th>
              <th className="text-right px-4 py-3 font-medium text-gray-500"></th>
            </tr>
          </thead>
          <tbody>
            {accompagnantes.map((u) => {
              const firstDiplome = u.diplomes?.[0]
              const diplomeText = firstDiplome ? diplomeLabels[firstDiplome] || firstDiplome : '-'
              const moreCount = (u.diplomes?.length || 0) - 1

              return (
                <tr key={u.id} className="border-b last:border-0 hover:bg-accent/10">
                  <td className="px-4 py-3">
                    <div className="font-medium text-gray-900">
                      {u.first_name} {u.last_name}
                    </div>
                    <div className="text-xs text-gray-400">{u.email}</div>
                  </td>
                  <td className="px-4 py-3 text-gray-600">
                    {u.ville ? `${u.ville} (${u.code_postal})` : '-'}
                  </td>
                  <td className="px-4 py-3">
                    {u.validation_status ? (
                      <span
                        className={`px-2 py-0.5 rounded-full text-xs font-medium ${
                          VALIDATION_STYLES[u.validation_status] || 'bg-gray-100 text-gray-600'
                        }`}
                        title={
                          u.validation_status === 'valide' && u.validation_source === 'parrainage'
                            ? 'Validée par parrainage (filière express)'
                            : undefined
                        }
                      >
                        {u.validation_status === 'valide' && u.validation_source === 'parrainage'
                          ? 'Validé · parrainage'
                          : VALIDATION_LABELS[u.validation_status] || u.validation_status}
                      </span>
                    ) : (
                      <span className="text-gray-400">-</span>
                    )}
                  </td>
                  <td className="px-4 py-3 text-gray-600">
                    <span className="line-clamp-1">{diplomeText}</span>
                    {moreCount > 0 && (
                      <span className="text-xs text-gray-400 ml-1">+{moreCount}</span>
                    )}
                  </td>
                  <td className="px-4 py-3 text-gray-600">
                    {formatExperienceLabel(u.experience)}
                  </td>
                  <td className="px-4 py-3 text-gray-400">
                    {new Date(u.created_at).toLocaleDateString('fr-FR')}
                  </td>
                  <td className="px-4 py-3 text-right">
                    <div className="flex gap-2 justify-end">
                      <GrantSubscriptionModal
                        userId={u.id}
                        userName={`${u.first_name} ${u.last_name}`}
                      />
                      <Link
                        href={`/admin/utilisateurs/${u.id}`}
                        className="px-3 py-1.5 text-xs font-medium text-black rounded-lg hover:opacity-80 transition-colors" style={{ backgroundColor: '#ffb06e' }}
                      >
                        Voir
                      </Link>
                    </div>
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
    </div>
  )
}

function AccompagnesTable({
  accompagnes,
}: {
  accompagnes: AccompagneRow[]
}) {
  if (accompagnes.length === 0) {
    return (
      <div className="bg-white rounded-2xl border border-[#e8dfd2] p-10 text-center text-gray-500 italic">
        Aucun accompagné ne correspond à ces critères.
      </div>
    )
  }

  return (
    <div className="bg-white rounded-2xl border border-[#e8dfd2] overflow-hidden">
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="bg-[#faf7f2] border-b border-[#e8dfd2]">
            <tr>
              <th className="text-left px-4 py-3 font-medium text-gray-500">Nom</th>
              <th className="text-left px-4 py-3 font-medium text-gray-500">Ville</th>
              <th className="text-left px-4 py-3 font-medium text-gray-500">Inscription</th>
              <th className="text-right px-4 py-3 font-medium text-gray-500"></th>
            </tr>
          </thead>
          <tbody>
            {accompagnes.map((u) => (
              <tr key={u.id} className="border-b last:border-0 hover:bg-accent/10">
                <td className="px-4 py-3">
                  <div className="font-medium text-gray-900">
                    {u.first_name} {u.last_name}
                  </div>
                  <div className="text-xs text-gray-400">{u.email}</div>
                </td>
                <td className="px-4 py-3 text-gray-600">
                  {u.ville ? `${u.ville} (${u.code_postal})` : '-'}
                </td>
                <td className="px-4 py-3 text-gray-400">
                  {new Date(u.created_at).toLocaleDateString('fr-FR')}
                </td>
                <td className="px-4 py-3 text-right">
                  <div className="flex gap-2 justify-end">
                    <GrantSubscriptionModal
                      userId={u.id}
                      userName={`${u.first_name} ${u.last_name}`}
                    />
                    <Link
                      href={`/admin/utilisateurs/${u.id}`}
                      className="px-3 py-1.5 text-xs font-medium text-black rounded-lg hover:opacity-80 transition-colors" style={{ backgroundColor: '#ffb06e' }}
                    >
                      Voir
                    </Link>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}

function ResiliationsPanel({ annulations }: { annulations: AnnulationRow[] }) {
  if (annulations.length === 0) {
    return (
      <div className="bg-white rounded-2xl border border-[#e8dfd2] p-10 text-center text-gray-500 italic">
        Aucune résiliation.
      </div>
    )
  }

  return (
    <div className="bg-white rounded-2xl border border-[#e8dfd2] overflow-hidden">
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="bg-[#faf7f2] border-b border-[#e8dfd2]">
            <tr>
              <th className="text-left px-4 py-3 font-medium text-gray-500">Nom</th>
              <th className="text-left px-4 py-3 font-medium text-gray-500">Rôle</th>
              <th className="text-left px-4 py-3 font-medium text-gray-500">Plan</th>
              <th className="text-left px-4 py-3 font-medium text-gray-500">Raison</th>
              <th className="text-left px-4 py-3 font-medium text-gray-500">Date</th>
              <th className="text-right px-4 py-3 font-medium text-gray-500"></th>
            </tr>
          </thead>
          <tbody>
            {annulations.map((a, i) => (
              <tr key={i} className="border-b last:border-0 hover:bg-accent/10">
                <td className="px-4 py-3">
                  <div className="font-medium text-gray-900">{a.nom}</div>
                  <div className="text-xs text-gray-400">{a.email}</div>
                </td>
                <td className="px-4 py-3">
                  <span className="text-xs bg-gray-200 text-gray-700 px-2 py-0.5 rounded-full">{ROLE_LABELS[a.role] || a.role}</span>
                </td>
                <td className="px-4 py-3 text-gray-600">
                  {a.plan === 'annuel' || a.plan === 'annual' ? 'Annuel' : 'Mensuel'}
                </td>
                <td className="px-4 py-3 text-gray-600">
                  <div>
                    {a.feedback ? FEEDBACK_LABELS[a.feedback] || a.feedback : <span className="text-gray-400">-</span>}
                  </div>
                  {a.comment && (
                    <div className="text-xs text-gray-400 mt-0.5 line-clamp-1">{a.comment}</div>
                  )}
                </td>
                <td className="px-4 py-3 text-gray-400">
                  <div>{a.date ? new Date(a.date).toLocaleDateString('fr-FR') : '-'}</div>
                  {a.pending && <span className="text-xs bg-accent/30 text-gray-700 px-2 py-0.5 rounded-full">Prévue</span>}
                </td>
                <td className="px-4 py-3 text-right">
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}
