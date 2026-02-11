'use client'

import { useState } from 'react'
import { masquerAvis, demasquerAvis } from '@/app/actions/admin-avis'

type Props = {
  avisId: string
  isMasque: boolean
}

export function AdminAvisActions({ avisId, isMasque }: Props) {
  const [loading, setLoading] = useState(false)

  async function handleAction() {
    setLoading(true)
    if (isMasque) {
      await demasquerAvis(avisId)
    } else {
      await masquerAvis(avisId)
    }
    setLoading(false)
  }

  return (
    <button
      onClick={handleAction}
      disabled={loading}
      className="px-2 py-1 text-xs border border-gray-300 rounded hover:border-black transition whitespace-nowrap"
    >
      {loading ? '...' : isMasque ? 'Demasquer' : 'Masquer'}
    </button>
  )
}
