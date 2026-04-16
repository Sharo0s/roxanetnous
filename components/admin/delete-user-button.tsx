'use client'

import { useState } from 'react'
import { adminDeleteUser } from '@/app/actions/admin'

export function DeleteUserButton({ userId, userName }: { userId: string; userName: string }) {
  const [confirming, setConfirming] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function handleDelete() {
    setLoading(true)
    setError(null)
    const result = await adminDeleteUser(userId)
    if (result?.error) {
      setError(result.error)
      setLoading(false)
      setConfirming(false)
    }
  }

  if (!confirming) {
    return (
      <button
        onClick={() => setConfirming(true)}
        className="px-4 py-2 text-sm font-medium text-red-600 border border-red-300 rounded-lg hover:bg-red-50 transition-colors"
      >
        Supprimer cet utilisateur
      </button>
    )
  }

  return (
    <div className="bg-red-50 border border-red-200 rounded-xl p-4">
      <p className="text-sm text-red-800 mb-3">
        Supprimer définitivement <strong>{userName}</strong> ? Cette action est irréversible.
        L'abonnement Stripe sera annulé et toutes les données seront supprimées.
      </p>
      {error && (
        <p className="text-sm text-red-600 mb-3">{error}</p>
      )}
      <div className="flex gap-2">
        <button
          onClick={handleDelete}
          disabled={loading}
          className="px-4 py-2 text-sm font-medium text-white bg-red-600 rounded-lg hover:bg-red-700 transition-colors disabled:opacity-50"
        >
          {loading ? 'Suppression...' : 'Confirmer la suppression'}
        </button>
        <button
          onClick={() => { setConfirming(false); setError(null) }}
          disabled={loading}
          className="px-4 py-2 text-sm font-medium border border-gray-300 rounded-lg hover:bg-white transition-colors disabled:opacity-50"
        >
          Annuler
        </button>
      </div>
    </div>
  )
}
