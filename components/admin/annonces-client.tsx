'use client'

import { useState, useMemo } from 'react'
import Link from 'next/link'
import { AdminAnnonceActions } from '@/components/admin/annonce-actions'

type AnnonceRow = {
  id: string
  titre: string
  ville: string
  code_postal: string | null
  status: string
  created_at: string
  auteur_nom: string
  type: 'accompagnante' | 'accompagne'
}

const STATUS_LABELS: Record<string, string> = {
  publiee: 'Publiée',
  suspendue: 'Suspendue',
  archivee: 'Archivée',
}

export function AnnoncesSearchTable({
  annonces,
  type,
}: {
  annonces: AnnonceRow[]
  type: 'accompagnante' | 'accompagne'
}) {
  const [search, setSearch] = useState('')

  const filtered = useMemo(() => {
    if (!search) return annonces
    const q = search.toLowerCase()
    return annonces.filter(
      (a) =>
        a.titre?.toLowerCase().includes(q) ||
        a.auteur_nom?.toLowerCase().includes(q) ||
        a.ville?.toLowerCase().includes(q)
    )
  }, [annonces, search])

  return (
    <>
      <div className="mb-4">
        <input
          type="text"
          placeholder="Rechercher par titre, auteur ou ville..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="w-full px-4 py-2.5 bg-white border border-[#e8dfd2] rounded-full text-sm focus:outline-none focus:border-kraft transition"
        />
      </div>

      {filtered.length === 0 ? (
        <div className="bg-white rounded-2xl border border-[#e8dfd2] p-10 text-center text-gray-500 italic">
          {search ? 'Aucune annonce ne correspond à ces critères.' : 'Aucune annonce.'}
        </div>
      ) : (
        <div className="bg-white rounded-2xl border border-[#e8dfd2] overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-[#faf7f2] border-b border-[#e8dfd2]">
                <tr>
                  <th className="text-left px-4 py-3 font-medium text-gray-500">Titre</th>
                  <th className="text-left px-4 py-3 font-medium text-gray-500">Auteur</th>
                  <th className="text-left px-4 py-3 font-medium text-gray-500">Ville</th>
                  <th className="text-left px-4 py-3 font-medium text-gray-500">Statut</th>
                  <th className="text-left px-4 py-3 font-medium text-gray-500">Date</th>
                  <th className="text-right px-4 py-3 font-medium text-gray-500">Actions</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((annonce) => (
                  <tr key={annonce.id} className="border-b border-[#f5efe5] last:border-0 hover:bg-accent/10">
                    <td className="px-4 py-3">
                      <p className="font-medium text-gray-900 line-clamp-1">{annonce.titre}</p>
                    </td>
                    <td className="px-4 py-3 text-gray-600">{annonce.auteur_nom}</td>
                    <td className="px-4 py-3 text-gray-600">
                      {annonce.ville} {annonce.code_postal && `(${annonce.code_postal})`}
                    </td>
                    <td className="px-4 py-3">
                      <span className={`px-2 py-0.5 rounded-full text-[11px] font-medium ${
                        annonce.status === 'publiee' ? 'bg-[#e0efde] text-[#4d7a47]' :
                        annonce.status === 'suspendue' ? 'bg-amber-50 text-amber-800 border border-amber-200' :
                        'bg-gray-100 text-gray-600'
                      }`}>
                        {STATUS_LABELS[annonce.status] || annonce.status}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-gray-400">
                      {new Date(annonce.created_at).toLocaleDateString('fr-FR')}
                    </td>
                    <td className="px-4 py-3 text-right flex items-center justify-end gap-2">
                      <Link
                        href={`/recherche/${annonce.id}`}
                        target="_blank"
                        className="inline-flex items-center px-3 py-1.5 text-xs border border-[#e8dfd2] rounded-full hover:border-kraft transition"
                      >
                        Voir
                      </Link>
                      <AdminAnnonceActions
                        annonceId={annonce.id}
                        currentStatus={annonce.status}
                        type={type}
                      />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </>
  )
}
