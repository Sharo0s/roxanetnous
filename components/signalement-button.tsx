'use client'

import { useState } from 'react'
import { creerSignalement } from '@/app/actions/signalements'
import { Button } from '@/components/ui/button'

type Props = {
  cibleType: 'user' | 'annonce_auxiliaire' | 'annonce_beneficiaire' | 'avis' | 'message'
  cibleId: string
}

const MOTIFS = [
  'Contenu inapproprie',
  'Faux profil',
  'Comportement suspect',
  'Harcelement',
  'Autre',
]

export function SignalementButton({ cibleType, cibleId }: Props) {
  const [open, setOpen] = useState(false)
  const [motif, setMotif] = useState('')
  const [description, setDescription] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [submitted, setSubmitted] = useState(false)

  async function handleSubmit() {
    if (!motif) {
      setError('Selectionnez un motif.')
      return
    }

    setError(null)
    setLoading(true)

    const result = await creerSignalement({
      cible_type: cibleType,
      cible_id: cibleId,
      motif,
      description,
    })

    if (result.error) {
      setError(result.error)
    } else {
      setSubmitted(true)
    }

    setLoading(false)
  }

  if (submitted) {
    return (
      <p className="text-xs text-gray-400">Signalement envoye. Merci.</p>
    )
  }

  if (!open) {
    return (
      <button
        onClick={() => setOpen(true)}
        className="text-xs text-gray-400 hover:text-gray-600 underline"
      >
        Signaler
      </button>
    )
  }

  return (
    <div className="mt-3 p-3 border rounded-lg">
      {error && (
        <p className="text-xs text-red-600 mb-2">{error}</p>
      )}
      <div className="mb-2">
        <label className="block text-xs font-medium text-gray-700 mb-1">Motif</label>
        <select
          value={motif}
          onChange={(e) => setMotif(e.target.value)}
          className="w-full rounded-lg border border-gray-300 bg-white px-2 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-black"
        >
          <option value="">Selectionnez...</option>
          {MOTIFS.map((m) => (
            <option key={m} value={m}>{m}</option>
          ))}
        </select>
      </div>
      <div className="mb-2">
        <label className="block text-xs font-medium text-gray-700 mb-1">Details (optionnel)</label>
        <textarea
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          rows={2}
          className="w-full rounded-lg border border-gray-300 bg-white px-2 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-black resize-none"
        />
      </div>
      <div className="flex gap-2">
        <Button size="sm" onClick={handleSubmit} disabled={loading}>
          {loading ? '...' : 'Envoyer'}
        </Button>
        <Button size="sm" variant="ghost" onClick={() => setOpen(false)}>
          Annuler
        </Button>
      </div>
    </div>
  )
}
