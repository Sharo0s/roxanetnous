'use client'

import { useState } from 'react'
import { toggleDisponible } from '@/app/actions/profile'

type Props = {
  initial: boolean
  initialIndisponibleJusquAu?: string | null
  compact?: boolean
}

export function DisponibleToggle({ initial, initialIndisponibleJusquAu, compact }: Props) {
  const [disponible, setDisponible] = useState(initial)
  const [loading, setLoading] = useState(false)
  const [dateRetour, setDateRetour] = useState(initialIndisponibleJusquAu || '')
  const [showDate, setShowDate] = useState(false)

  async function handleToggle() {
    if (disponible) {
      // Passe indisponible — affiche le champ date avant de confirmer
      setShowDate(true)
      return
    }
    // Repasse disponible
    setLoading(true)
    const result = await toggleDisponible(null)
    if (result.success) {
      setDisponible(true)
      setDateRetour('')
      setShowDate(false)
    }
    setLoading(false)
  }

  async function handleConfirmIndisponible() {
    setLoading(true)
    const result = await toggleDisponible(dateRetour || null)
    if (result.success) {
      setDisponible(false)
      setShowDate(false)
    }
    setLoading(false)
  }

  function handleCancel() {
    setShowDate(false)
    setDateRetour('')
  }

  const today = new Date().toISOString().split('T')[0]

  async function handleCompactToggle() {
    setLoading(true)
    const result = await toggleDisponible(disponible ? null : null)
    if (result.success) {
      setDisponible(!disponible)
    }
    setLoading(false)
  }

  if (compact) {
    return (
      <div className="flex items-center gap-2">
        <button
          onClick={handleCompactToggle}
          disabled={loading}
          className={`relative w-9 h-5 rounded-full transition ${
            disponible ? 'bg-accent' : 'bg-gray-300'
          } ${loading ? 'opacity-50' : ''}`}
        >
          <span
            className={`absolute top-0.5 left-0.5 w-4 h-4 rounded-full bg-white transition-transform ${
              disponible ? 'translate-x-4' : 'translate-x-0'
            }`}
          />
        </button>
        <span className={`text-xs font-medium ${disponible ? 'text-gray-700' : 'text-gray-400'}`}>
          {disponible ? 'Je suis disponible' : 'Je suis indisponible'}
        </span>
      </div>
    )
  }

  return (
    <div className="mb-6 p-4 rounded-xl border bg-white">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-sm font-medium text-gray-900">
            {disponible ? 'Disponible pour de nouvelles missions' : 'Indisponible'}
          </p>
          <p className="text-xs text-gray-500 mt-0.5">
            {disponible
              ? 'Les accompagnés voient que vous êtes disponible.'
              : dateRetour
                ? `De retour le ${new Date(dateRetour).toLocaleDateString('fr-FR')}`
                : 'Votre annonce reste visible mais sans le badge Disponible.'}
          </p>
        </div>
        <button
          onClick={handleToggle}
          disabled={loading || showDate}
          className={`relative w-11 h-6 rounded-full transition ${
            disponible ? 'bg-accent' : 'bg-gray-300'
          } ${loading || showDate ? 'opacity-50' : ''}`}
        >
          <span
            className={`absolute top-0.5 left-0.5 w-5 h-5 rounded-full bg-white transition-transform ${
              disponible ? 'translate-x-5' : 'translate-x-0'
            }`}
          />
        </button>
      </div>

      {showDate && (
        <div className="mt-4 pt-3 border-t space-y-3">
          <div>
            <label className="block text-xs font-medium text-gray-700 mb-1">
              Date de retour (optionnel)
            </label>
            <input
              type="date"
              value={dateRetour}
              min={today}
              onChange={(e) => setDateRetour(e.target.value)}
              className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-accent"
            />
          </div>
          <div className="flex gap-2">
            <button
              onClick={handleConfirmIndisponible}
              disabled={loading}
              className="px-4 py-2 text-sm font-medium bg-accent text-black rounded-lg btn-hover transition disabled:opacity-50"
            >
              {loading ? '...' : 'Confirmer'}
            </button>
            <button
              onClick={handleCancel}
              disabled={loading}
              className="px-4 py-2 text-sm font-medium border border-gray-300 rounded-lg hover:border-accent transition"
            >
              Annuler
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
