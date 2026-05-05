'use client'

import { useState } from 'react'
import { updateAnnonceAccompagnante } from '@/app/actions/annonces'
import { Button } from '@/components/ui/button'
import { CityAutocomplete } from '@/components/ui/city-autocomplete'
import { MapRadius } from '@/components/ui/map-radius'
import { JOURS_SEMAINE, CRENEAUX } from '@/lib/constants'
import Link from 'next/link'

type Annonce = {
  id: string
  description: string
  ville: string
  code_postal: string
  rayon_km: number
  disponibilites: Record<string, string[]> | null
}

export function ModifierAnnonceForm({ annonce, departementsOuverts }: { annonce: Annonce; departementsOuverts: string[] }) {
  const [description, setDescription] = useState(annonce.description || '')
  const [ville, setVille] = useState(annonce.ville || '')
  const [codePostal, setCodePostal] = useState(annonce.code_postal || '')
  const [rayonKm, setRayonKm] = useState(annonce.rayon_km || 10)
  const [disponibilites, setDisponibilites] = useState<Record<string, string[]>>(
    (annonce.disponibilites as Record<string, string[]>) || {}
  )
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  function toggleDispo(jour: string, creneau: string) {
    setDisponibilites((prev) => {
      const current = prev[jour] || []
      if (current.includes(creneau)) {
        return { ...prev, [jour]: current.filter((c) => c !== creneau) }
      }
      return { ...prev, [jour]: [...current, creneau] }
    })
  }

  async function handleSubmit() {
    setError(null)

    if (!description.trim()) {
      setError('La description est requise.')
      return
    }
    if (!ville.trim() || !codePostal.trim()) {
      setError('La ville et le code postal sont requis.')
      return
    }

    setLoading(true)
    const result = await updateAnnonceAccompagnante(annonce.id, {
      description,
      ville,
      code_postal: codePostal,
      rayon_km: rayonKm,
      disponibilites,
    })

    if (result?.error) {
      setError(result.error)
      setLoading(false)
    }
  }

  return (
    <div className="space-y-6">
      {error && (
        <div role="alert" className="p-3 rounded-lg bg-red-50 border border-red-200 text-red-700 text-sm">
          {error}
        </div>
      )}

      <div className="bg-white rounded-xl border p-6">
        <h3 className="font-semibold mb-4">Votre annonce</h3>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Description <span className="text-red-500">*</span>
          </label>
          <textarea
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="Décrivez vos compétences, votre approche et ce que vous proposez..."
            rows={5}
            className="w-full rounded-lg border border-gray-400 bg-white px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-black resize-none"
          />
        </div>
      </div>

      <div className="bg-white rounded-xl border p-6">
        <h3 className="font-semibold mb-4">Zone d&#39;intervention</h3>
        <CityAutocomplete
          ville={ville}
          codePostal={codePostal}
          onVilleChange={setVille}
          onCodePostalChange={setCodePostal}
          departementsOuverts={departementsOuverts}
          required
        />
        <div className="mt-4">
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Rayon d'intervention : {rayonKm} km
          </label>
          <input
            type="range"
            min={1}
            max={100}
            value={rayonKm}
            onChange={(e) => setRayonKm(Number(e.target.value))}
            className="w-full accent-black"
          />
          <div className="flex justify-between text-xs text-gray-400 mt-1">
            <span>1 km</span>
            <span>50 km</span>
            <span>100 km</span>
          </div>
        </div>
        <MapRadius ville={ville} codePostal={codePostal} rayonKm={rayonKm} />
      </div>

      <div className="bg-white rounded-xl border p-6">
        <h3 className="font-semibold mb-4">Disponibilités</h3>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr>
                <th className="text-left py-2 pr-4 font-medium text-gray-500"></th>
                {CRENEAUX.map((c) => (
                  <th key={c.value} className="py-2 px-2 text-center font-medium text-gray-500">
                    {c.label}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {JOURS_SEMAINE.map((jour) => (
                <tr key={jour.value} className="border-t border-gray-100">
                  <td className="py-2 pr-4 font-medium text-gray-700">{jour.label}</td>
                  {CRENEAUX.map((creneau) => {
                    const isSelected = (disponibilites[jour.value] || []).includes(creneau.value)
                    return (
                      <td key={creneau.value} className="py-2 px-2 text-center">
                        <button
                          type="button"
                          onClick={() => toggleDispo(jour.value, creneau.value)}
                          className={`w-8 h-8 rounded-md border transition flex items-center justify-center ${
                            isSelected
                              ? 'border-accent bg-white text-black'
                              : 'bg-white border-gray-400 hover:border-gray-400'
                          }`}
                        >
                          {isSelected && (
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                            </svg>
                          )}
                        </button>
                      </td>
                    )
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <div className="flex gap-3">
        <Button onClick={handleSubmit} disabled={loading}>
          {loading ? 'Enregistrement...' : 'Enregistrer les modifications'}
        </Button>
        <Link href="/accompagnante/annonces">
          <Button variant="ghost" type="button">Annuler</Button>
        </Link>
      </div>
    </div>
  )
}
