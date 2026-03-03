'use client'

import { useState, useRef } from 'react'
import { uploadPlanningDocument, deletePlanningDocument } from '@/app/actions/planning-documents'

type TeamMember = {
  auxiliaire_user_id: string
  first_name: string
  last_name: string
  couleur: string
  actif: boolean
}

type DocumentAuxiliaire = {
  user_id: string
  first_name: string
  last_name: string
  has_read: boolean
}

type PlanningDocument = {
  id: string
  nom_fichier: string
  file_size: number
  created_at: string
  auxiliaires: DocumentAuxiliaire[]
  read_count: number
  total_assigned: number
}

function formatFileSize(bytes: number) {
  if (bytes < 1024) return `${bytes} o`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} Ko`
  return `${(bytes / (1024 * 1024)).toFixed(1)} Mo`
}

export function PlanningDocumentsClient({
  documents: initialDocs,
  team,
}: {
  documents: PlanningDocument[]
  team: TeamMember[]
}) {
  const [documents, setDocuments] = useState(initialDocs)
  const [selectedAuxIds, setSelectedAuxIds] = useState<Set<string>>(new Set())
  const [uploading, setUploading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const fileRef = useRef<HTMLInputElement>(null)

  const activeTeam = team.filter(m => m.actif)
  const teamColorMap = new Map(team.map(m => [m.auxiliaire_user_id, m.couleur]))

  function toggleAux(auxId: string) {
    setSelectedAuxIds(prev => {
      const next = new Set(prev)
      if (next.has(auxId)) next.delete(auxId)
      else next.add(auxId)
      return next
    })
  }

  async function handleUpload() {
    const file = fileRef.current?.files?.[0]
    if (!file) {
      setError('Selectionnez un fichier')
      return
    }
    if (selectedAuxIds.size === 0) {
      setError('Selectionnez au moins un auxiliaire')
      return
    }

    setUploading(true)
    setError(null)

    const formData = new FormData()
    formData.append('file', file)
    for (const id of selectedAuxIds) {
      formData.append('auxiliaire_ids', id)
    }

    const result = await uploadPlanningDocument(formData)

    if (result.error) {
      setError(result.error)
    } else {
      // Refresh page data
      if (fileRef.current) fileRef.current.value = ''
      setSelectedAuxIds(new Set())
      window.location.reload()
    }
    setUploading(false)
  }

  async function handleDelete(docId: string) {
    if (!confirm('Supprimer ce document ?')) return
    await deletePlanningDocument(docId)
    setDocuments(prev => prev.filter(d => d.id !== docId))
  }

  return (
    <div className="space-y-6">
      {/* Formulaire upload */}
      <div className="bg-white rounded-xl border p-6">
        <h3 className="font-semibold text-lg mb-4">Partager un document</h3>

        {error && <p className="text-sm text-red-600 mb-3">{error}</p>}

        <div className="space-y-4">
          <div>
            <label className="text-sm font-medium text-gray-700 block mb-1">Fichier</label>
            <input
              ref={fileRef}
              type="file"
              className="block w-full text-sm border rounded-lg px-3 py-2 file:mr-4 file:py-1 file:px-3 file:rounded-lg file:border file:text-sm file:font-medium file:bg-black file:text-white hover:file:bg-gray-800"
            />
          </div>

          <div>
            <label className="text-sm font-medium text-gray-700 block mb-2">
              Partager avec
            </label>
            {activeTeam.length === 0 ? (
              <p className="text-sm text-gray-400">Aucun auxiliaire actif dans votre equipe.</p>
            ) : (
              <div className="flex flex-wrap gap-2">
                {activeTeam.map(member => (
                  <button
                    key={member.auxiliaire_user_id}
                    onClick={() => toggleAux(member.auxiliaire_user_id)}
                    className={`px-3 py-1.5 text-sm rounded-lg border transition ${
                      selectedAuxIds.has(member.auxiliaire_user_id)
                        ? 'text-white border-transparent'
                        : 'hover:border-black'
                    }`}
                    style={selectedAuxIds.has(member.auxiliaire_user_id)
                      ? { backgroundColor: member.couleur, borderColor: member.couleur }
                      : { color: member.couleur, borderColor: member.couleur }
                    }
                  >
                    {member.first_name} {member.last_name?.[0]?.toUpperCase()}.
                  </button>
                ))}
              </div>
            )}
          </div>

          <button
            onClick={handleUpload}
            disabled={uploading}
            className="px-4 py-2 bg-black text-white rounded-lg hover:bg-gray-800 transition text-sm font-medium disabled:opacity-50"
          >
            {uploading ? 'Envoi en cours...' : 'Envoyer'}
          </button>
        </div>
      </div>

      {/* Liste des documents */}
      {documents.length > 0 ? (
        <div className="space-y-3">
          {documents.map(doc => (
            <div key={doc.id} className="bg-white rounded-xl border p-4">
              <div className="flex items-start justify-between">
                <div>
                  <p className="font-medium text-sm">{doc.nom_fichier}</p>
                  <p className="text-xs text-gray-500 mt-0.5">
                    {formatFileSize(doc.file_size)} - {new Date(doc.created_at).toLocaleDateString('fr-FR')}
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-xs text-gray-500 border rounded-full px-2 py-1">
                    Lu par {doc.read_count}/{doc.total_assigned}
                  </span>
                  <button
                    onClick={() => handleDelete(doc.id)}
                    className="text-xs text-gray-400 hover:text-black transition"
                  >
                    Supprimer
                  </button>
                </div>
              </div>

              {doc.auxiliaires.length > 0 && (
                <div className="mt-2 flex flex-wrap gap-1.5">
                  {doc.auxiliaires.map(aux => {
                    const couleur = teamColorMap.get(aux.user_id) || '#6B7280'
                    return (
                      <span
                        key={aux.user_id}
                        className="text-xs px-2 py-0.5 rounded-full font-medium"
                        style={{ color: couleur, backgroundColor: `${couleur}15`, border: `1px solid ${couleur}30` }}
                      >
                        {aux.first_name} {aux.last_name?.[0]}.
                        {aux.has_read && ' (lu)'}
                      </span>
                    )
                  })}
                </div>
              )}
            </div>
          ))}
        </div>
      ) : (
        <div className="bg-white rounded-xl border p-6 text-center text-gray-500 text-sm">
          Aucun document partage.
        </div>
      )}
    </div>
  )
}
