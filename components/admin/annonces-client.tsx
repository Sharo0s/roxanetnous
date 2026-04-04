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
          className="w-full px-4 py-2.5 bg-white border border-gray-300 rounded-xl text-sm focus:outline-none focus:border-accent transition-colors"
        />
      </div>

      {filtered.length === 0 ? (
        <div className="bg-white rounded-xl border p-8 text-center text-gray-500">
          {search ? 'Aucune annonce ne correspond a ces criteres.' : 'Aucune annonce.'}
        </div>
      ) : (
        <div className="bg-white rounded-xl border overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-accent/20 border-b">
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
                  <tr key={annonce.id} className="border-b last:border-0 hover:bg-accent/10">
                    <td className="px-4 py-3">
                      <p className="font-medium text-gray-900 line-clamp-1">{annonce.titre}</p>
                    </td>
                    <td className="px-4 py-3 text-gray-600">{annonce.auteur_nom}</td>
                    <td className="px-4 py-3 text-gray-600">
                      {annonce.ville} {annonce.code_postal && `(${annonce.code_postal})`}
                    </td>
                    <td className="px-4 py-3">
                      <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${
                        annonce.status === 'publiee' ? 'bg-accent text-black' :
                        annonce.status === 'suspendue' ? 'bg-gray-200 text-gray-700 border border-gray-400' :
                        'bg-gray-200 text-gray-600'
                      }`}>
                        {annonce.status}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-gray-400">
                      {new Date(annonce.created_at).toLocaleDateString('fr-FR')}
                    </td>
                    <td className="px-4 py-3 text-right flex items-center justify-end gap-2">
                      <Link
                        href={`/recherche/${annonce.id}`}
                        target="_blank"
                        className="px-3 py-1.5 text-xs font-medium border border-gray-300 rounded-lg hover:border-accent transition-colors"
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
