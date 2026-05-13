'use client'

import { useState } from 'react'
import { updateAnnonceAccompagnanteStatus, updateAnnonceAccompagneStatus } from '@/app/actions/annonces'

type Props = {
  annonceId: string
  currentStatus: string
  type: 'accompagnant' | 'accompagne'
}

export function AnnonceStatusToggle({ annonceId, currentStatus, type }: Props) {
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function handleToggle() {
    setLoading(true)
    setError(null)
    const newStatus = currentStatus === 'publiee' ? 'archivee' : 'publiee'
    const action = type === 'accompagnant'
      ? updateAnnonceAccompagnanteStatus
      : updateAnnonceAccompagneStatus
    const result = await action(annonceId, newStatus as 'publiee' | 'archivee')
    if (result?.error) {
      setError(result.error)
      setLoading(false)
      return
    }
    setLoading(false)
    window.location.reload()
  }

  return (
    <div>
      <button
        onClick={handleToggle}
        disabled={loading}
        className="px-3 py-1.5 text-xs font-medium border border-gray-400 text-gray-700 rounded-lg hover:border-accent transition disabled:opacity-50"
      >
        {loading
          ? '...'
          : currentStatus === 'publiee'
            ? 'Archiver'
            : 'Republier'
        }
      </button>
      {error && (
        <p role="alert" className="text-xs text-red-700 mt-2">
          {error}
        </p>
      )}
    </div>
  )
}
