'use client'

import { useState } from 'react'
import { toggleFavori } from '@/app/actions/favoris'

type Props = {
  annonceId: string
  type: 'auxiliaire' | 'beneficiaire'
  initialIsFavori: boolean
}

export function FavoriButton({ annonceId, type, initialIsFavori }: Props) {
  const [isFavori, setIsFavori] = useState(initialIsFavori)
  const [loading, setLoading] = useState(false)

  async function handleToggle(e: React.MouseEvent) {
    e.preventDefault()
    e.stopPropagation()
    setLoading(true)

    const result = await toggleFavori(annonceId, type)
    if (result.isFavori !== undefined) {
      setIsFavori(result.isFavori)
    }

    setLoading(false)
  }

  return (
    <button
      onClick={handleToggle}
      disabled={loading}
      className={`w-8 h-8 rounded-full border flex items-center justify-center transition ${
        isFavori
          ? 'bg-white border-red-500 text-red-500'
          : 'bg-white border-gray-300 text-gray-400 hover:border-red-500 hover:text-red-500'
      }`}
      title={isFavori ? 'Retirer des favoris' : 'Ajouter aux favoris'}
    >
      <svg
        xmlns="http://www.w3.org/2000/svg"
        viewBox="0 0 24 24"
        fill={isFavori ? 'currentColor' : 'none'}
        stroke="currentColor"
        strokeWidth={2}
        className="w-4 h-4"
      >
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          d="M21 8.25c0-2.485-2.099-4.5-4.688-4.5-1.935 0-3.597 1.126-4.312 2.733-.715-1.607-2.377-2.733-4.313-2.733C5.1 3.75 3 5.765 3 8.25c0 7.22 9 12 9 12s9-4.78 9-12z"
        />
      </svg>
    </button>
  )
}
