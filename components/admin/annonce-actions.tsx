'use client'

import { useState } from 'react'
import { adminUpdateAnnonceStatus } from '@/app/actions/admin-annonces'

type Props = {
  annonceId: string
  currentStatus: string
  type: 'auxiliaire' | 'beneficiaire'
}

export function AdminAnnonceActions({ annonceId, currentStatus, type }: Props) {
  const [loading, setLoading] = useState(false)

  async function handleAction(status: 'publiee' | 'suspendue' | 'archivee') {
    setLoading(true)
    await adminUpdateAnnonceStatus(annonceId, status, type)
    setLoading(false)
  }

  if (loading) {
    return <span className="text-xs text-gray-400">...</span>
  }

  return (
    <div className="flex gap-1">
      {currentStatus === 'publiee' && (
        <button
          onClick={() => handleAction('suspendue')}
          className="px-2 py-1 text-xs border border-gray-300 rounded hover:border-black transition"
        >
          Suspendre
        </button>
      )}
      {currentStatus === 'suspendue' && (
        <button
          onClick={() => handleAction('publiee')}
          className="px-2 py-1 text-xs border border-gray-300 rounded hover:border-black transition"
        >
          Republier
        </button>
      )}
      {currentStatus !== 'archivee' && (
        <button
          onClick={() => handleAction('archivee')}
          className="px-2 py-1 text-xs text-red-600 border border-red-200 rounded hover:border-red-400 transition"
        >
          Archiver
        </button>
      )}
      {currentStatus === 'archivee' && (
        <button
          onClick={() => handleAction('publiee')}
          className="px-2 py-1 text-xs border border-gray-300 rounded hover:border-black transition"
        >
          Republier
        </button>
      )}
    </div>
  )
}
