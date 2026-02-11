'use client'

import { useState } from 'react'
import { traiterSignalement } from '@/app/actions/admin-signalements'
import { Button } from '@/components/ui/button'

type Props = {
  signalementId: string
}

export function SignalementActions({ signalementId }: Props) {
  const [open, setOpen] = useState(false)
  const [decision, setDecision] = useState<'suspendu' | 'supprime' | 'averti' | 'ignore'>('averti')
  const [notes, setNotes] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function handleSubmit() {
    setLoading(true)
    setError(null)

    const result = await traiterSignalement(signalementId, decision, notes)
    if (result.error) {
      setError(result.error)
      setLoading(false)
    }
  }

  if (!open) {
    return (
      <Button size="sm" variant="outline" onClick={() => setOpen(true)}>
        Traiter
      </Button>
    )
  }

  return (
    <div className="ml-4 min-w-[200px]">
      {error && <p className="text-xs text-red-600 mb-2">{error}</p>}

      <div className="mb-2">
        <label className="block text-xs font-medium text-gray-700 mb-1">Decision</label>
        <select
          value={decision}
          onChange={(e) => setDecision(e.target.value as typeof decision)}
          className="w-full rounded-lg border border-gray-300 bg-white px-2 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-black"
        >
          <option value="averti">Avertissement</option>
          <option value="suspendu">Suspension</option>
          <option value="supprime">Suppression</option>
          <option value="ignore">Ignorer</option>
        </select>
      </div>

      <div className="mb-2">
        <label className="block text-xs font-medium text-gray-700 mb-1">Notes</label>
        <textarea
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          rows={2}
          className="w-full rounded-lg border border-gray-300 bg-white px-2 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-black resize-none"
        />
      </div>

      <div className="flex gap-2">
        <Button size="sm" onClick={handleSubmit} disabled={loading}>
          {loading ? '...' : 'Confirmer'}
        </Button>
        <Button size="sm" variant="ghost" onClick={() => setOpen(false)}>
          Annuler
        </Button>
      </div>
    </div>
  )
}
