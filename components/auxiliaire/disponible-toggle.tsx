'use client'

import { useState } from 'react'
import { toggleDisponible } from '@/app/actions/profile'

export function DisponibleToggle({ initial }: { initial: boolean }) {
  const [disponible, setDisponible] = useState(initial)
  const [loading, setLoading] = useState(false)

  async function handleToggle() {
    setLoading(true)
    const result = await toggleDisponible()
    if (result.success) {
      setDisponible(!disponible)
    }
    setLoading(false)
  }

  return (
    <div className="mb-6 p-4 rounded-xl border bg-white flex items-center justify-between">
      <div>
        <p className="text-sm font-medium text-gray-900">
          {disponible ? 'Disponible pour de nouvelles missions' : 'Indisponible'}
        </p>
        <p className="text-xs text-gray-500 mt-0.5">
          {disponible
            ? 'Les beneficiaires voient que vous etes disponible.'
            : 'Votre annonce reste visible mais sans le badge Disponible.'}
        </p>
      </div>
      <button
        onClick={handleToggle}
        disabled={loading}
        className={`relative w-11 h-6 rounded-full transition ${
          disponible ? 'bg-black' : 'bg-gray-300'
        } ${loading ? 'opacity-50' : ''}`}
      >
        <span
          className={`absolute top-0.5 left-0.5 w-5 h-5 rounded-full bg-white transition-transform ${
            disponible ? 'translate-x-5' : 'translate-x-0'
          }`}
        />
      </button>
    </div>
  )
}
