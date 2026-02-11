'use client'

import { useRouter } from 'next/navigation'
import { useState } from 'react'
import { SPECIALITES, EXPERIENCE_LEVELS } from '@/lib/constants'
import { Button } from '@/components/ui/button'

type Props = {
  currentVille: string
  currentSpecialite: string
  currentExperience: string
}

export function SearchFilters({ currentVille, currentSpecialite, currentExperience }: Props) {
  const router = useRouter()
  const [ville, setVille] = useState(currentVille)
  const [specialite, setSpecialite] = useState(currentSpecialite)
  const [experience, setExperience] = useState(currentExperience)

  function handleSearch() {
    const params = new URLSearchParams()
    if (ville.trim()) params.set('ville', ville.trim())
    if (specialite) params.set('specialite', specialite)
    if (experience) params.set('experience', experience)
    router.push(`/recherche?${params.toString()}`)
  }

  function handleReset() {
    setVille('')
    setSpecialite('')
    setExperience('')
    router.push('/recherche')
  }

  return (
    <div className="bg-white rounded-xl border p-5">
      <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
        <div>
          <label className="block text-xs font-medium text-gray-500 mb-1">Ville</label>
          <input
            type="text"
            value={ville}
            onChange={(e) => setVille(e.target.value)}
            placeholder="Ex: Paris, Lyon..."
            className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-black"
            onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
          />
        </div>
        <div>
          <label className="block text-xs font-medium text-gray-500 mb-1">Specialite</label>
          <select
            value={specialite}
            onChange={(e) => setSpecialite(e.target.value)}
            className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-black"
          >
            <option value="">Toutes</option>
            {SPECIALITES.map((s) => (
              <option key={s.value} value={s.value}>{s.label}</option>
            ))}
          </select>
        </div>
        <div>
          <label className="block text-xs font-medium text-gray-500 mb-1">Experience</label>
          <select
            value={experience}
            onChange={(e) => setExperience(e.target.value)}
            className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-black"
          >
            <option value="">Toutes</option>
            {EXPERIENCE_LEVELS.map((e) => (
              <option key={e.value} value={e.value}>{e.label}</option>
            ))}
          </select>
        </div>
        <div className="flex items-end gap-2">
          <Button onClick={handleSearch} className="flex-1">
            Rechercher
          </Button>
          {(currentVille || currentSpecialite || currentExperience) && (
            <Button variant="ghost" onClick={handleReset} size="sm">
              Effacer
            </Button>
          )}
        </div>
      </div>
    </div>
  )
}
