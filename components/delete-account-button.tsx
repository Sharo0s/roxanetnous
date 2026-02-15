'use client'

import { useState } from 'react'
import { deleteAccount } from '@/app/actions/auth'

export function DeleteAccountButton() {
  const [showConfirm, setShowConfirm] = useState(false)
  const [confirmation, setConfirmation] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function handleDelete() {
    if (confirmation !== 'SUPPRIMER') return
    setLoading(true)
    setError(null)
    const result = await deleteAccount()
    if (result?.error) {
      setError(result.error)
      setLoading(false)
    }
  }

  if (!showConfirm) {
    return (
      <button
        onClick={() => setShowConfirm(true)}
        className="px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-100 transition text-sm"
      >
        Supprimer mon compte
      </button>
    )
  }

  return (
    <div className="border border-gray-300 rounded-lg p-4 space-y-3">
      <p className="text-sm text-gray-700">
        Cette action est irreversible. Toutes vos donnees seront supprimees
        (profil, annonces, messages, abonnement).
      </p>
      <p className="text-sm text-gray-700">
        Tapez <span className="font-bold">SUPPRIMER</span> pour confirmer :
      </p>
      <input
        type="text"
        value={confirmation}
        onChange={(e) => setConfirmation(e.target.value)}
        className="w-full px-3 py-2 border rounded-lg text-sm"
        placeholder="SUPPRIMER"
        disabled={loading}
      />
      {error && <p className="text-sm text-gray-900 font-medium">{error}</p>}
      <div className="flex gap-2">
        <button
          onClick={handleDelete}
          disabled={confirmation !== 'SUPPRIMER' || loading}
          className="px-4 py-2 bg-black text-white rounded-lg text-sm disabled:opacity-50 hover:bg-gray-800 transition"
        >
          {loading ? 'Suppression...' : 'Confirmer la suppression'}
        </button>
        <button
          onClick={() => {
            setShowConfirm(false)
            setConfirmation('')
            setError(null)
          }}
          className="px-4 py-2 border border-gray-300 rounded-lg text-sm hover:bg-gray-100 transition"
          disabled={loading}
        >
          Annuler
        </button>
      </div>
    </div>
  )
}
