'use client'

import { useState } from 'react'
import { submitAvis } from '@/app/actions/avis'

type Avis = {
  id: string
  note: number
  commentaire: string
  created_at: string
  auteur: { first_name: string; last_name: string } | null
}

type Props = {
  cibleUserId: string
  avisList: Avis[]
  moyenneNote: number | null
  canLeaveAvis: boolean
}

export function AvisSection({ cibleUserId, avisList, moyenneNote, canLeaveAvis }: Props) {
  const [showForm, setShowForm] = useState(false)
  const [note, setNote] = useState(5)
  const [commentaire, setCommentaire] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [submitted, setSubmitted] = useState(false)

  async function handleSubmit() {
    setError(null)
    if (!commentaire.trim()) {
      setError('Le commentaire est requis.')
      return
    }

    setLoading(true)
    const result = await submitAvis({
      cible_id: cibleUserId,
      note,
      commentaire,
    })

    if (result.error) {
      setError(result.error)
      setLoading(false)
      return
    }

    setSubmitted(true)
    setShowForm(false)
    setLoading(false)
  }

  return (
    <div className="bg-white rounded-xl border p-6">
      <div className="flex items-center justify-between mb-4">
        <h3 className="font-semibold">
          Avis ({avisList.length})
          {moyenneNote !== null && (
            <span className="ml-2 text-sm font-normal text-gray-500">
              {moyenneNote.toFixed(1)}/5
            </span>
          )}
        </h3>
        {canLeaveAvis && !submitted && (
          <button
            onClick={() => setShowForm(!showForm)}
            className="text-sm text-black underline"
          >
            {showForm ? 'Annuler' : 'Laisser un avis'}
          </button>
        )}
      </div>

      {submitted && (
        <div className="mb-4 p-3 rounded-lg bg-gray-50 border text-sm text-gray-700">
          Merci pour votre avis.
        </div>
      )}

      {showForm && (
        <div className="mb-6 p-4 border rounded-lg">
          {error && (
            <div className="mb-3 p-2 rounded bg-red-50 border border-red-200 text-red-700 text-sm">
              {error}
            </div>
          )}

          <div className="mb-3">
            <label className="block text-sm font-medium text-gray-700 mb-2">Note</label>
            <div className="flex gap-1">
              {[1, 2, 3, 4, 5].map((n) => (
                <button
                  key={n}
                  type="button"
                  onClick={() => setNote(n)}
                  className={`w-10 h-10 rounded-lg border text-sm font-medium transition ${
                    n <= note
                      ? 'bg-accent text-black border-accent'
                      : 'bg-white text-gray-400 border-gray-300 hover:border-gray-400'
                  }`}
                >
                  {n}
                </button>
              ))}
            </div>
          </div>

          <div className="mb-3">
            <label className="block text-sm font-medium text-gray-700 mb-2">Commentaire</label>
            <textarea
              value={commentaire}
              onChange={(e) => setCommentaire(e.target.value)}
              placeholder="Décrivez votre expérience..."
              rows={3}
              className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-black resize-none"
            />
          </div>

          <button
            onClick={handleSubmit}
            disabled={loading}
            className="px-4 py-2 bg-accent text-black rounded-lg transition text-sm font-medium disabled:opacity-50 btn-hover"
          >
            {loading ? 'Envoi...' : 'Publier l\'avis'}
          </button>
        </div>
      )}

      {avisList.length === 0 && !showForm ? (
        <p className="text-sm text-gray-400">Aucun avis pour le moment.</p>
      ) : (
        <div className="space-y-4">
          {avisList.map((avis) => (
            <div key={avis.id} className="border-t pt-4 first:border-0 first:pt-0">
              <div className="flex items-center justify-between mb-1">
                <div className="flex items-center gap-2">
                  <span className="text-sm font-medium text-gray-900">
                    {avis.auteur?.first_name} {avis.auteur?.last_name?.[0]}.
                  </span>
                  <div className="flex gap-0.5">
                    {[1, 2, 3, 4, 5].map((n) => (
                      <div
                        key={n}
                        className={`w-3 h-3 rounded-sm ${
                          n <= avis.note ? 'bg-accent' : 'bg-gray-200'
                        }`}
                      />
                    ))}
                  </div>
                </div>
                <span className="text-xs text-gray-400">
                  {new Date(avis.created_at).toLocaleDateString('fr-FR')}
                </span>
              </div>
              <p className="text-sm text-gray-700">{avis.commentaire}</p>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
