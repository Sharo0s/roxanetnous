'use client'

import { useState } from 'react'
import { adminCancelSubscription } from '@/app/actions/admin'

export function CancelSubscriptionButton({
  userId,
  userName,
}: {
  userId: string
  userName: string
}) {
  const [confirming, setConfirming] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function handleCancel() {
    setLoading(true)
    setError(null)
    try {
      const formData = new FormData()
      formData.set('userId', userId)
      const result = await adminCancelSubscription(formData)
      if (result?.error) {
        setError(result.error)
        setLoading(false)
        setConfirming(false)
      }
    } catch (e) {
      // NEXT_REDIRECT throws — let it propagate for navigation
      if (e && typeof e === 'object' && 'digest' in e) throw e
      setError('Erreur inattendue.')
      setLoading(false)
      setConfirming(false)
    }
  }

  if (!confirming) {
    return (
      <button
        onClick={() => setConfirming(true)}
        className="px-4 py-2 text-sm font-medium border border-gray-400 text-gray-700 rounded-lg hover:border-gray-400 transition-colors"
      >
        Annuler l&apos;abonnement
      </button>
    )
  }

  return (
    <div className="bg-gray-50 border border-gray-200 rounded-xl p-4 mt-4">
      <p className="text-sm text-gray-700 mb-3">
        Êtes-vous sûr de vouloir annuler l&apos;abonnement de <strong>{userName}</strong> ?
        L&apos;accès restera actif jusqu&apos;à la fin de la période en cours.
      </p>
      {error && (
        <p className="text-sm text-red-600 mb-3">{error}</p>
      )}
      <div className="flex gap-2">
        <button
          onClick={handleCancel}
          disabled={loading}
          className="px-4 py-2 text-sm font-medium text-white bg-gray-800 rounded-lg hover:bg-gray-900 transition-colors disabled:opacity-50"
        >
          {loading ? 'Annulation...' : 'Confirmer l\'annulation'}
        </button>
        <button
          onClick={() => { setConfirming(false); setError(null) }}
          disabled={loading}
          className="px-4 py-2 text-sm font-medium border border-gray-400 rounded-lg hover:bg-white transition-colors disabled:opacity-50"
        >
          Annuler
        </button>
      </div>
    </div>
  )
}
