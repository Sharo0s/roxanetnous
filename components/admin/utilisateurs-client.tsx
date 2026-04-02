'use client'

import { useState, useMemo } from 'react'
import Link from 'next/link'
import type { AuxiliaireRow, BeneficiaireRow } from '@/app/admin/utilisateurs/page'

type Tab = 'auxiliaires' | 'beneficiaires'

const VALIDATION_LABELS: Record<string, string> = {
  en_attente: 'En attente',
  valide: 'Valide',
  refuse: 'Refuse',
  a_completer: 'A completer',
}

const VALIDATION_STYLES: Record<string, string> = {
  en_attente: 'bg-gray-200 text-gray-700',
  valide: 'bg-black text-white',
  refuse: 'bg-white text-gray-900 border border-gray-400',
  a_completer: 'bg-gray-100 text-gray-700 border border-gray-300',
}

export function UtilisateursClient({
  auxiliaires,
  beneficiaires,
  enAttenteCount,
  validesCount,
  diplomeLabels,
  experienceLabels,
}: {
  auxiliaires: AuxiliaireRow[]
  beneficiaires: BeneficiaireRow[]
  enAttenteCount: number
  validesCount: number
  diplomeLabels: Record<string, string>
  experienceLabels: Record<string, string>
}) {
  const [tab, setTab] = useState<Tab>('auxiliaires')
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState<string>('tous')

  const filteredAuxiliaires = useMemo(() => {
    let result = auxiliaires
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
  }, [auxiliaires, search, statusFilter])

  const filteredBeneficiaires = useMemo(() => {
    if (!search) return beneficiaires
    const q = search.toLowerCase()
    return beneficiaires.filter(
      (u) =>
        u.first_name?.toLowerCase().includes(q) ||
        u.last_name?.toLowerCase().includes(q) ||
        u.email?.toLowerCase().includes(q) ||
        u.ville?.toLowerCase().includes(q)
    )
  }, [beneficiaires, search])

  return (
    <div className="max-w-6xl mx-auto px-4 py-8">
      <h2 className="text-2xl font-bold text-gray-900 mb-6">Utilisateurs</h2>

      {/* Onglets */}
      <div className="flex gap-1 mb-6 border-b">
        <button
          onClick={() => { setTab('auxiliaires'); setStatusFilter('tous') }}
          className={`px-4 py-2.5 text-sm font-medium border-b-2 transition-colors ${
            tab === 'auxiliaires'
              ? 'border-black text-black'
              : 'border-transparent text-gray-500 hover:text-black'
          }`}
        >
          Auxiliaires ({auxiliaires.length})
        </button>
        <button
          onClick={() => { setTab('beneficiaires'); setStatusFilter('tous') }}
          className={`px-4 py-2.5 text-sm font-medium border-b-2 transition-colors ${
            tab === 'beneficiaires'
              ? 'border-black text-black'
              : 'border-transparent text-gray-500 hover:text-black'
          }`}
        >
          Beneficiaires ({beneficiaires.length})
        </button>
      </div>

      {/* KPIs */}
      {tab === 'auxiliaires' ? (
        <div className="grid grid-cols-3 gap-4 mb-6">
          <button
            onClick={() => setStatusFilter('tous')}
            className={`bg-white rounded-xl border p-5 text-left transition-colors ${
              statusFilter === 'tous' ? 'border-black' : 'hover:border-gray-400'
            }`}
          >
            <p className="text-sm text-gray-500">Total</p>
            <p className="text-3xl font-bold mt-1">{auxiliaires.length}</p>
          </button>
          <button
            onClick={() => setStatusFilter('en_attente')}
            className={`bg-white rounded-xl border p-5 text-left transition-colors ${
              statusFilter === 'en_attente' ? 'border-black' : 'hover:border-gray-400'
            }`}
          >
            <p className="text-sm text-gray-500">En attente</p>
            <p className="text-3xl font-bold mt-1">{enAttenteCount}</p>
          </button>
          <button
            onClick={() => setStatusFilter('valide')}
            className={`bg-white rounded-xl border p-5 text-left transition-colors ${
              statusFilter === 'valide' ? 'border-black' : 'hover:border-gray-400'
            }`}
          >
            <p className="text-sm text-gray-500">Valides</p>
            <p className="text-3xl font-bold mt-1">{validesCount}</p>
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-2 gap-4 mb-6">
          <div className="bg-white rounded-xl border p-5">
            <p className="text-sm text-gray-500">Total</p>
            <p className="text-3xl font-bold mt-1">{beneficiaires.length}</p>
          </div>
          <div className="bg-white rounded-xl border p-5">
            <p className="text-sm text-gray-500">Ce mois</p>
            <p className="text-3xl font-bold mt-1">
              {beneficiaires.filter((u) => {
                const d = new Date(u.created_at)
                const now = new Date()
                return d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear()
              }).length}
            </p>
          </div>
        </div>
      )}

      {/* Recherche */}
      <div className="mb-4">
        <input
          type="text"
          placeholder="Rechercher par nom, email ou ville..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="w-full px-4 py-2.5 bg-white border border-gray-300 rounded-xl text-sm focus:outline-none focus:border-black transition-colors"
        />
      </div>

      {/* Filtre statut auxiliaires */}
      {tab === 'auxiliaires' && (
        <div className="flex gap-2 mb-4 flex-wrap">
          {['tous', 'en_attente', 'valide', 'refuse', 'a_completer'].map((s) => (
            <button
              key={s}
              onClick={() => setStatusFilter(s)}
              className={`px-3 py-1.5 rounded-full text-xs font-medium transition-colors ${
                statusFilter === s
                  ? 'bg-black text-white'
                  : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
              }`}
            >
              {s === 'tous' ? 'Tous' : VALIDATION_LABELS[s]}
            </button>
          ))}
        </div>
      )}

      {/* Tableau */}
      {tab === 'auxiliaires' ? (
        <AuxiliairesTable
          auxiliaires={filteredAuxiliaires}
          diplomeLabels={diplomeLabels}
          experienceLabels={experienceLabels}
        />
      ) : (
        <BeneficiairesTable beneficiaires={filteredBeneficiaires} />
      )}
    </div>
  )
}

function AuxiliairesTable({
  auxiliaires,
  diplomeLabels,
  experienceLabels,
}: {
  auxiliaires: AuxiliaireRow[]
  diplomeLabels: Record<string, string>
  experienceLabels: Record<string, string>
}) {
  if (auxiliaires.length === 0) {
    return (
      <div className="bg-white rounded-xl border p-8 text-center text-gray-500">
        Aucun auxiliaire ne correspond a ces criteres.
      </div>
    )
  }

  return (
    <div className="bg-white rounded-xl border overflow-hidden">
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="bg-gray-50 border-b">
            <tr>
              <th className="text-left px-4 py-3 font-medium text-gray-500">Nom</th>
              <th className="text-left px-4 py-3 font-medium text-gray-500">Ville</th>
              <th className="text-left px-4 py-3 font-medium text-gray-500">Statut</th>
              <th className="text-left px-4 py-3 font-medium text-gray-500">Diplome</th>
              <th className="text-left px-4 py-3 font-medium text-gray-500">Experience</th>
              <th className="text-left px-4 py-3 font-medium text-gray-500">Inscription</th>
              <th className="text-right px-4 py-3 font-medium text-gray-500"></th>
            </tr>
          </thead>
          <tbody>
            {auxiliaires.map((u) => {
              const firstDiplome = u.diplomes?.[0]
              const diplomeText = firstDiplome ? diplomeLabels[firstDiplome] || firstDiplome : '-'
              const moreCount = (u.diplomes?.length || 0) - 1

              return (
                <tr key={u.id} className="border-b last:border-0 hover:bg-gray-50">
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
                      >
                        {VALIDATION_LABELS[u.validation_status] || u.validation_status}
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
                    {u.experience ? experienceLabels[u.experience] || u.experience : '-'}
                  </td>
                  <td className="px-4 py-3 text-gray-400">
                    {new Date(u.created_at).toLocaleDateString('fr-FR')}
                  </td>
                  <td className="px-4 py-3 text-right">
                    <Link
                      href={`/admin/utilisateurs/${u.id}`}
                      className="px-3 py-1.5 text-xs font-medium border border-gray-300 rounded-lg hover:border-black transition-colors"
                    >
                      Voir
                    </Link>
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

function BeneficiairesTable({
  beneficiaires,
}: {
  beneficiaires: BeneficiaireRow[]
}) {
  if (beneficiaires.length === 0) {
    return (
      <div className="bg-white rounded-xl border p-8 text-center text-gray-500">
        Aucun beneficiaire ne correspond a ces criteres.
      </div>
    )
  }

  return (
    <div className="bg-white rounded-xl border overflow-hidden">
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="bg-gray-50 border-b">
            <tr>
              <th className="text-left px-4 py-3 font-medium text-gray-500">Nom</th>
              <th className="text-left px-4 py-3 font-medium text-gray-500">Ville</th>
              <th className="text-left px-4 py-3 font-medium text-gray-500">Inscription</th>
              <th className="text-right px-4 py-3 font-medium text-gray-500"></th>
            </tr>
          </thead>
          <tbody>
            {beneficiaires.map((u) => (
              <tr key={u.id} className="border-b last:border-0 hover:bg-gray-50">
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
                  <Link
                    href={`/admin/utilisateurs/${u.id}`}
                    className="px-3 py-1.5 text-xs font-medium border border-gray-300 rounded-lg hover:border-black transition-colors"
                  >
                    Voir
                  </Link>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}
