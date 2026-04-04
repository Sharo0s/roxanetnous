'use client'

import { useState } from 'react'
import { deleteAnnonceAccompagnante, deleteAnnonceAccompagne } from '@/app/actions/annonces'

type Props = {
  annonceId: string
  type: 'accompagnante' | 'accompagne'
}

export function AnnonceDeleteButton({ annonceId, type }: Props) {
  const [confirming, setConfirming] = useState(false)
  const [loading, setLoading] = useState(false)

  async function handleDelete() {
    setLoading(true)
    const action = type === 'accompagnante'
      ? deleteAnnonceAccompagnante
      : deleteAnnonceAccompagne
    const result = await action(annonceId)
    if (result.error) {
      alert(result.error)
      setLoading(false)
      setConfirming(false)
      return
    }
    window.location.reload()
  }

  if (confirming) {
    return (
      <div className="flex items-center gap-1">
        <button
          onClick={handleDelete}
          disabled={loading}
          className="px-3 py-1.5 text-xs font-medium bg-red-600 text-white rounded-lg hover:bg-red-700 transition disabled:opacity-50"
        >
          {loading ? '...' : 'Confirmer'}
        </button>
        <button
          onClick={() => setConfirming(false)}
          disabled={loading}
          className="px-3 py-1.5 text-xs font-medium border border-gray-300 rounded-lg hover:border-accent transition"
        >
          Annuler
        </button>
      </div>
    )
  }

  return (
    <button
      onClick={() => setConfirming(true)}
      className="px-3 py-1.5 text-xs font-medium text-red-600 border border-red-200 rounded-lg hover:border-red-400 transition"
    >
      Supprimer
    </button>
  )
}
