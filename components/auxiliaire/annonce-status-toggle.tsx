'use client'

import { useState } from 'react'
import { updateAnnonceAuxiliaireStatus, updateAnnonceBeneficiaireStatus } from '@/app/actions/annonces'
import { Button } from '@/components/ui/button'

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
    <Button
      variant="ghost"
      size="sm"
      onClick={handleToggle}
      disabled={loading}
    >
      {loading
        ? '...'
        : currentStatus === 'publiee'
          ? 'Archiver'
          : 'Republier'
      }
    </Button>
  )
}
