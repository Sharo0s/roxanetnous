'use client'

import { useState } from 'react'
import { updateAnnonceAuxiliaireStatus, updateAnnonceBeneficiaireStatus } from '@/app/actions/annonces'

type Props = {
  annonceId: string
  currentStatus: string
  type: 'auxiliaire' | 'beneficiaire'
}

export function AnnonceStatusToggle({ annonceId, currentStatus, type }: Props) {
  const [loading, setLoading] = useState(false)

  async function handleToggle() {
    setLoading(true)
    const newStatus = currentStatus === 'publiee' ? 'archivee' : 'publiee'
    const action = type === 'auxiliaire'
      ? updateAnnonceAuxiliaireStatus
      : updateAnnonceBeneficiaireStatus
    await action(annonceId, newStatus as 'publiee' | 'archivee')
    setLoading(false)
    window.location.reload()
  }

  return (
    <button
      onClick={handleToggle}
      disabled={loading}
      className="px-3 py-1.5 text-xs font-medium border border-gray-300 text-gray-700 rounded-lg hover:border-accent transition disabled:opacity-50"
    >
      {loading
        ? '...'
        : currentStatus === 'publiee'
          ? 'Archiver'
          : 'Republier'
      }
    </button>
  )
}
