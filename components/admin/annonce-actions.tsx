'use client'

import { useState } from 'react'
import { adminUpdateAnnonceStatus } from '@/app/actions/admin-annonces'

type Props = {
  annonceId: string
  currentStatus: string
  type: 'accompagnant' | 'accompagne'
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
          className="inline-flex items-center px-3 py-1 text-xs border border-[#e8dfd2] rounded-full hover:border-kraft transition"
        >
          Suspendre
        </button>
      )}
      {currentStatus === 'suspendue' && (
        <button
          onClick={() => handleAction('publiee')}
          className="inline-flex items-center px-3 py-1 text-xs border border-[#e8dfd2] rounded-full hover:border-kraft transition"
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
          className="inline-flex items-center px-3 py-1 text-xs border border-[#e8dfd2] rounded-full hover:border-kraft transition"
        >
          Republier
        </button>
      )}
    </div>
  )
}
