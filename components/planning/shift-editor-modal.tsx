'use client'

import { useState } from 'react'
import { createOrUpdateShift, deleteShift } from '@/app/actions/planning-shifts'

type Creneau = { debut: string; fin: string }

export function ShiftEditorModal({
  auxiliaireUserId,
  auxiliaireName,
  date,
  existingShift,
  onClose,
  onSaved,
}: {
  auxiliaireUserId: string
  auxiliaireName: string
  date: string
  existingShift?: {
    id: string
    creneaux: Creneau[]
    note: string | null
  } | null
  onClose: () => void
  onSaved: () => void
}) {
  const [creneaux, setCreneaux] = useState<Creneau[]>(
    existingShift?.creneaux?.length ? existingShift.creneaux : [{ debut: '08:00', fin: '12:00' }]
  )
  const [note, setNote] = useState(existingShift?.note || '')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  function addCreneau() {
    const last = creneaux[creneaux.length - 1]
    setCreneaux([...creneaux, { debut: last?.fin || '14:00', fin: '18:00' }])
  }

  function removeCreneau(index: number) {
    setCreneaux(creneaux.filter((_, i) => i !== index))
  }

  function updateCreneau(index: number, field: 'debut' | 'fin', value: string) {
    setCreneaux(creneaux.map((c, i) => i === index ? { ...c, [field]: value } : c))
  }

  async function handleSave() {
    if (creneaux.length === 0) {
      setError('Ajoutez au moins un creneau')
      return
    }

    setSaving(true)
    setError(null)

    const result = await createOrUpdateShift({
      auxiliaireUserId,
      date,
      creneaux,
      note: note || undefined,
    })

    if (result.error) {
      setError(result.error)
      setSaving(false)
    } else {
      onSaved()
    }
  }

  async function handleDelete() {
    if (!existingShift?.id) return
    if (!confirm('Supprimer ce creneau ?')) return

    setSaving(true)
    await deleteShift(existingShift.id)
    onSaved()
  }

  const formattedDate = new Date(date + 'T12:00:00').toLocaleDateString('fr-FR', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
  })

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50" onClick={onClose}>
      <div
        className="bg-white rounded-xl border shadow-lg w-full max-w-md mx-4 p-6"
        onClick={e => e.stopPropagation()}
      >
        <div className="flex items-center justify-between mb-4">
          <div>
            <h3 className="font-semibold text-lg">{auxiliaireName}</h3>
            <p className="text-sm text-gray-500 capitalize">{formattedDate}</p>
          </div>
          <button onClick={onClose} className="p-1 hover:bg-gray-100 rounded-lg transition">
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {error && (
          <p className="text-sm text-red-600 mb-3">{error}</p>
        )}

        <div className="space-y-3 mb-4">
          <label className="text-sm font-medium text-gray-700">Creneaux</label>
          {creneaux.map((c, i) => (
            <div key={i} className="flex items-center gap-2">
              <input
                type="time"
                value={c.debut}
                onChange={e => updateCreneau(i, 'debut', e.target.value)}
                className="border rounded-lg px-3 py-2 text-sm flex-1"
              />
              <span className="text-gray-400">-</span>
              <input
                type="time"
                value={c.fin}
                onChange={e => updateCreneau(i, 'fin', e.target.value)}
                className="border rounded-lg px-3 py-2 text-sm flex-1"
              />
              {creneaux.length > 1 && (
                <button
                  onClick={() => removeCreneau(i)}
                  className="p-1.5 text-gray-400 hover:text-black transition"
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              )}
            </div>
          ))}
          <button
            onClick={addCreneau}
            className="text-sm text-gray-600 hover:text-black transition"
          >
            + Ajouter un creneau
          </button>
        </div>

        <div className="mb-6">
          <label className="text-sm font-medium text-gray-700 block mb-1">Note</label>
          <textarea
            value={note}
            onChange={e => setNote(e.target.value)}
            rows={2}
            className="w-full border rounded-lg px-3 py-2 text-sm resize-none"
            placeholder="Note optionnelle..."
          />
        </div>

        <div className="flex gap-3">
          <button
            onClick={handleSave}
            disabled={saving}
            className="flex-1 px-4 py-2 bg-black text-white rounded-lg hover:bg-gray-800 transition text-sm font-medium disabled:opacity-50"
          >
            {saving ? '...' : 'Enregistrer'}
          </button>
          {existingShift?.id && (
            <button
              onClick={handleDelete}
              disabled={saving}
              className="px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:border-black transition text-sm font-medium disabled:opacity-50"
            >
              Supprimer
            </button>
          )}
        </div>
      </div>
    </div>
  )
}
