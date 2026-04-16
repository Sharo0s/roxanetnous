'use client'

import { useState } from 'react'
import { creerSignalement } from '@/app/actions/signalements'
import { Button } from '@/components/ui/button'

type Props = {
  cibleType: 'user' | 'annonce_accompagnante' | 'annonce_accompagne' | 'avis' | 'message'
  cibleId: string
}

const MOTIFS = [
  'Contenu inapproprié',
  'Faux profil',
  'Comportement suspect',
  'Harcèlement',
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
      setError('Sélectionnez un motif.')
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
      <p className="text-xs text-gray-400">Signalement envoyé. Merci.</p>
    )
  }

  if (!open) {
    return (
      <button
        onClick={() => setOpen(true)}
        className="inline-flex items-center justify-center rounded-lg font-medium transition btn-hover bg-accent text-black h-10 px-4 py-2 w-full"
      >
        Signaler ce profil à l&#39;équipe
      </button>
    )
  }

  return (
    <div className="bg-white border rounded-xl p-6 space-y-4 text-left mt-3">
      {error && (
        <p className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg p-3">{error}</p>
      )}
      <div>
        <label className="block text-sm font-medium text-black mb-1">Motif</label>
        <select
          value={motif}
          onChange={(e) => setMotif(e.target.value)}
          className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#FFB06E]"
        >
          <option value="">Sélectionnez...</option>
          {MOTIFS.map((m) => (
            <option key={m} value={m}>{m}</option>
          ))}
        </select>
      </div>
      <div>
        <label className="block text-sm font-medium text-black mb-1">Détails (optionnel)</label>
        <textarea
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          rows={4}
          className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#FFB06E] resize-none"
          placeholder="Décrivez le problème..."
        />
      </div>
      <div className="flex gap-2">
        <button
          onClick={handleSubmit}
          disabled={loading}
          className="flex-1 px-4 py-2 rounded-lg text-sm font-medium text-black btn-hover disabled:opacity-50 bg-accent"
        >
          {loading ? 'Envoi en cours...' : 'Envoyer'}
        </button>
        <button
          onClick={() => setOpen(false)}
          className="px-4 py-2 rounded-lg text-sm font-medium text-black hover:bg-gray-100 transition"
        >
          Annuler
        </button>
      </div>
    </div>
  )
}
