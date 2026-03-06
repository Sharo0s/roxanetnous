'use client'

import { useState } from 'react'
import {
  addAuxiliaireToTeam,
  updateAuxiliaireColor,
  toggleAuxiliaireActif,
  removeAuxiliaireFromTeam,
} from '@/app/actions/planning-equipe'

type TeamMember = {
  id: string
  auxiliaire_user_id: string
  couleur: string
  actif: boolean
  first_name: string
  last_name: string
}

type AvailableAuxiliaire = {
  id: string
  first_name: string
  last_name: string
}

export function PlanningEquipeClient({
  team: initialTeam,
  availableAuxiliaires: initialAvailable,
}: {
  team: TeamMember[]
  availableAuxiliaires: AvailableAuxiliaire[]
}) {
  const [team, setTeam] = useState(initialTeam)
  const [available, setAvailable] = useState(initialAvailable)
  const [selectedAux, setSelectedAux] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function handleAdd() {
    if (!selectedAux) return
    setLoading(true)
    setError(null)

    const result = await addAuxiliaireToTeam(selectedAux)
    if (result.error) {
      setError(result.error)
    } else {
      const added = available.find(a => a.id === selectedAux)
      if (added) {
        setTeam(prev => [...prev, {
          id: crypto.randomUUID(),
          auxiliaire_user_id: added.id,
          couleur: '#6B7280',
          actif: true,
          first_name: added.first_name,
          last_name: added.last_name,
        }])
        setAvailable(prev => prev.filter(a => a.id !== selectedAux))
      }
      setSelectedAux('')
    }
    setLoading(false)
  }

  function handleColorInput(auxUserId: string, couleur: string) {
    setTeam(prev => prev.map(m =>
      m.auxiliaire_user_id === auxUserId ? { ...m, couleur } : m
    ))
  }

  async function handleColorCommit(auxUserId: string, couleur: string) {
    await updateAuxiliaireColor(auxUserId, couleur)
  }

  async function handleToggle(auxUserId: string) {
    setTeam(prev => prev.map(m =>
      m.auxiliaire_user_id === auxUserId ? { ...m, actif: !m.actif } : m
    ))
    await toggleAuxiliaireActif(auxUserId)
  }

  async function handleRemove(auxUserId: string) {
    const member = team.find(m => m.auxiliaire_user_id === auxUserId)
    if (!member) return
    if (!confirm(`Retirer ${member.first_name} ${member.last_name} de votre equipe ? Les creneaux et documents associes seront supprimes.`)) return

    setTeam(prev => prev.filter(m => m.auxiliaire_user_id !== auxUserId))
    setAvailable(prev => [...prev, {
      id: member.auxiliaire_user_id,
      first_name: member.first_name,
      last_name: member.last_name,
    }])
    await removeAuxiliaireFromTeam(auxUserId)
  }

  return (
    <div className="space-y-6">
      {/* Equipe actuelle */}
      {team.length > 0 ? (
        <div className="space-y-3">
          {team.map(member => (
            <div key={member.auxiliaire_user_id} className="bg-white rounded-xl border p-4 flex items-center gap-4">
              {/* Couleur */}
              <input
                type="color"
                value={member.couleur}
                onChange={e => handleColorInput(member.auxiliaire_user_id, e.target.value)}
                onBlur={e => handleColorCommit(member.auxiliaire_user_id, e.target.value)}
                className="w-8 h-8 rounded-full cursor-pointer border-2 border-gray-200 hover:border-accent transition p-0"
              />

              {/* Nom */}
              <div className="flex-1">
                <p className={`font-medium ${!member.actif ? 'text-gray-400' : 'text-gray-900'}`}>
                  {member.first_name} {member.last_name}
                </p>
                {!member.actif && (
                  <p className="text-xs text-gray-400">Desactive</p>
                )}
              </div>

              {/* Actions */}
              <button
                onClick={() => handleToggle(member.auxiliaire_user_id)}
                className="px-3 py-1.5 text-xs font-medium border rounded-lg hover:border-accent transition"
              >
                {member.actif ? 'Desactiver' : 'Activer'}
              </button>
              <button
                onClick={() => handleRemove(member.auxiliaire_user_id)}
                className="px-3 py-1.5 text-xs font-medium text-gray-500 border rounded-lg hover:border-accent hover:text-black transition"
              >
                Retirer
              </button>
            </div>
          ))}
        </div>
      ) : (
        <div className="bg-white rounded-xl border p-6 text-center">
          <p className="text-gray-600">Aucun auxiliaire dans votre equipe.</p>
          <p className="text-sm text-gray-400 mt-1">
            Ajoutez un auxiliaire avec lequel vous avez deja une conversation.
          </p>
        </div>
      )}

      {/* Ajouter */}
      {available.length > 0 && (
        <div className="bg-white rounded-xl border p-6">
          <h3 className="font-semibold text-lg mb-4">Ajouter a l'equipe</h3>
          {error && (
            <p className="text-sm text-red-600 mb-3">{error}</p>
          )}
          <div className="flex gap-3">
            <select
              value={selectedAux}
              onChange={e => setSelectedAux(e.target.value)}
              className="flex-1 border rounded-lg px-3 py-2 text-sm bg-white"
            >
              <option value="">Selectionner un auxiliaire</option>
              {available.map(aux => (
                <option key={aux.id} value={aux.id}>
                  {aux.first_name} {aux.last_name}
                </option>
              ))}
            </select>
            <button
              onClick={handleAdd}
              disabled={!selectedAux || loading}
              className="px-4 py-2 bg-accent text-black rounded-lg btn-hover transition text-sm font-medium disabled:opacity-50"
            >
              {loading ? '...' : 'Ajouter'}
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
