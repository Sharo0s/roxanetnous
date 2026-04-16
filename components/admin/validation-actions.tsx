'use client'

import { useState } from 'react'
import { validateAccompagnante } from '@/app/actions/admin'
import { Button } from '@/components/ui/button'

type Props = {
  profileId: string
}

export function ValidationActions({ profileId }: Props) {
  const [action, setAction] = useState<'valide' | 'refuse' | 'a_completer' | null>(null)
  const [motif, setMotif] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function handleSubmit() {
    if (!action) return

    if ((action === 'refuse' || action === 'a_completer') && !motif.trim()) {
      setError('Le motif est requis.')
      return
    }

    setError(null)
    setLoading(true)
    const result = await validateAccompagnante(profileId, action, motif || undefined)
    if (result?.error) {
      setError(result.error)
      setLoading(false)
    }
  }

  if (!action) {
    return (
      <div className="bg-white rounded-xl border p-6">
        <h3 className="font-semibold mb-4">Décision</h3>
        <div className="flex gap-3">
          <Button onClick={() => setAction('valide')}>
            Valider le profil
          </Button>
          <Button variant="outline" onClick={() => setAction('a_completer')}>
            Demander un complément
          </Button>
          <Button variant="destructive" onClick={() => setAction('refuse')}>
            Refuser
          </Button>
        </div>
      </div>
    )
  }

  return (
    <div className="bg-white rounded-xl border p-6">
      <h3 className="font-semibold mb-4">
        {action === 'valide' && 'Confirmer la validation'}
        {action === 'refuse' && 'Confirmer le refus'}
        {action === 'a_completer' && 'Demande de complément'}
      </h3>

      {error && (
        <div className="mb-4 p-3 rounded-lg bg-red-50 border border-red-200 text-red-700 text-sm">
          {error}
        </div>
      )}

      {action === 'valide' ? (
        <p className="text-sm text-gray-600 mb-4">
          Ce profil sera marqué comme validé. L'accompagnante pourra accéder à la plateforme.
        </p>
      ) : (
        <div className="mb-4">
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Motif <span className="text-red-500">*</span>
          </label>
          <textarea
            value={motif}
            onChange={(e) => setMotif(e.target.value)}
            placeholder={
              action === 'refuse'
                ? 'Expliquez la raison du refus...'
                : 'Précisez les documents ou informations manquants...'
            }
            rows={4}
            className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-black resize-none"
          />
        </div>
      )}

      <div className="flex gap-3">
        <Button
          onClick={handleSubmit}
          disabled={loading}
          variant={action === 'refuse' ? 'destructive' : 'default'}
        >
          {loading ? 'En cours...' : 'Confirmer'}
        </Button>
        <Button
          variant="ghost"
          onClick={() => { setAction(null); setMotif(''); setError(null) }}
          disabled={loading}
        >
          Annuler
        </Button>
      </div>
    </div>
  )
}
