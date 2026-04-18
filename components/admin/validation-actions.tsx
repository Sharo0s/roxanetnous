'use client'

import { useState } from 'react'
import { validateAccompagnante, markVisioToPlan, markVisioRealisee } from '@/app/actions/admin'
import { Button } from '@/components/ui/button'

type Status = 'en_attente' | 'visio_a_planifier' | 'visio_realisee' | string

type Props = {
  profileId: string
  status: Status
}

type Action = 'valide' | 'refuse' | 'a_completer' | 'visio_a_planifier' | 'visio_realisee'

export function ValidationActions({ profileId, status }: Props) {
  const [action, setAction] = useState<Action | null>(null)
  const [motif, setMotif] = useState('')
  const [visioDate, setVisioDate] = useState('')
  const [visioNotes, setVisioNotes] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function handleSubmit() {
    if (!action) return

    if ((action === 'refuse' || action === 'a_completer') && !motif.trim()) {
      setError('Le motif est requis.')
      return
    }
    if (action === 'visio_realisee' && !visioDate) {
      setError('La date de la visio est requise.')
      return
    }

    setError(null)
    setLoading(true)

    let result: { error?: string } | undefined
    if (action === 'visio_a_planifier') {
      result = await markVisioToPlan(profileId)
    } else if (action === 'visio_realisee') {
      result = await markVisioRealisee(profileId, visioDate, visioNotes || undefined)
    } else {
      result = await validateAccompagnante(profileId, action, motif || undefined)
    }

    if (result?.error) {
      setError(result.error)
      setLoading(false)
    }
  }

  function reset() {
    setAction(null)
    setMotif('')
    setVisioDate('')
    setVisioNotes('')
    setError(null)
  }

  if (!action) {
    return (
      <div className="bg-white rounded-xl border p-6">
        <h3 className="font-semibold mb-4">Décision</h3>
        <div className="flex flex-wrap gap-3">
          {status === 'en_attente' && (
            <Button onClick={() => setAction('visio_a_planifier')}>
              Passer en attente de visio
            </Button>
          )}
          {status === 'visio_a_planifier' && (
            <Button onClick={() => setAction('visio_realisee')}>
              Marquer visio réalisée
            </Button>
          )}
          {status === 'visio_realisee' && (
            <Button onClick={() => setAction('valide')}>
              Valider le profil
            </Button>
          )}
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
        {action === 'visio_a_planifier' && 'Passer en attente de visio'}
        {action === 'visio_realisee' && 'Marquer la visio comme réalisée'}
      </h3>

      {error && (
        <div className="mb-4 p-3 rounded-lg bg-red-50 border border-red-200 text-red-700 text-sm">
          {error}
        </div>
      )}

      {action === 'valide' && (
        <p className="text-sm text-gray-600 mb-4">
          Ce profil sera marqué comme validé. L&apos;accompagnante pourra accéder à la plateforme.
        </p>
      )}

      {action === 'visio_a_planifier' && (
        <p className="text-sm text-gray-600 mb-4">
          Un email de convocation visio sera envoyé à l&apos;accompagnante. Le statut passera à « En attente de visio ».
        </p>
      )}

      {action === 'visio_realisee' && (
        <div className="mb-4 space-y-3">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Date et heure de la visio <span className="text-red-500">*</span>
            </label>
            <input
              type="datetime-local"
              value={visioDate}
              onChange={(e) => setVisioDate(e.target.value)}
              className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-black"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Notes (optionnel)
            </label>
            <textarea
              value={visioNotes}
              onChange={(e) => setVisioNotes(e.target.value)}
              placeholder="Impressions, points notables, éléments à retenir..."
              rows={4}
              className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-black resize-none"
            />
          </div>
        </div>
      )}

      {(action === 'refuse' || action === 'a_completer') && (
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
        <Button variant="ghost" onClick={reset} disabled={loading}>
          Annuler
        </Button>
      </div>
    </div>
  )
}
