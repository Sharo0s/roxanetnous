'use client'

import { useState } from 'react'
import { createAnnonceAuxiliaire } from '@/app/actions/annonces'
import { Button } from '@/components/ui/button'
import { JOURS_SEMAINE, CRENEAUX } from '@/lib/constants'
import Link from 'next/link'

export default function NouvelleAnnonceAuxiliaire() {
  const [titre, setTitre] = useState('')
  const [description, setDescription] = useState('')
  const [ville, setVille] = useState('')
  const [codePostal, setCodePostal] = useState('')
  const [rayonKm, setRayonKm] = useState(10)
  const [disponibilites, setDisponibilites] = useState<Record<string, string[]>>({})
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

    if (!titre.trim() || !description.trim()) {
      setError('Le titre et la description sont requis.')
      return
    }
    if (!ville.trim() || !codePostal.trim()) {
      setError('La ville et le code postal sont requis.')
      return
    }

    setLoading(true)
    const result = await createAnnonceAuxiliaire({
      titre,
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
    <main className="min-h-screen bg-gray-50">
      <header className="bg-white border-b">
        <div className="max-w-3xl mx-auto px-4 py-4 flex items-center justify-between">
          <Link href="/auxiliaire/dashboard" className="text-xl font-bold text-black">
            roxanetnous
          </Link>
          <Link href="/auxiliaire/annonces" className="text-sm text-gray-500 hover:text-black">
            Retour aux annonces
          </Link>
        </div>
      </header>

      <div className="max-w-3xl mx-auto px-4 py-8">
        <h2 className="text-2xl font-bold text-gray-900 mb-6">Creer une annonce</h2>

        {error && (
          <div className="mb-6 p-3 rounded-lg bg-red-50 border border-red-200 text-red-700 text-sm">
            {error}
          </div>
        )}

        <div className="space-y-6">
          <div className="bg-white rounded-xl border p-6">
            <h3 className="font-semibold mb-4">Votre annonce</h3>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Titre <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  value={titre}
                  onChange={(e) => setTitre(e.target.value)}
                  placeholder="Ex: Auxiliaire de vie experimentee disponible"
                  className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-black"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Description <span className="text-red-500">*</span>
                </label>
                <textarea
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="Decrivez vos competences, votre approche et ce que vous proposez..."
                  rows={5}
                  className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-black resize-none"
                />
              </div>
            </div>
          </div>

          <div className="bg-white rounded-xl border p-6">
            <h3 className="font-semibold mb-4">Zone d&#39;intervention</h3>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Ville <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  value={ville}
                  onChange={(e) => setVille(e.target.value)}
                  placeholder="Paris"
                  className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-black"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Code postal <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  value={codePostal}
                  onChange={(e) => setCodePostal(e.target.value)}
                  placeholder="75001"
                  maxLength={5}
                  className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-black"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Rayon (km)
                </label>
                <input
                  type="number"
                  value={rayonKm}
                  onChange={(e) => setRayonKm(Number(e.target.value))}
                  min={1}
                  max={100}
                  className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-black"
                />
              </div>
            </div>
          </div>

          <div className="bg-white rounded-xl border p-6">
            <h3 className="font-semibold mb-4">Disponibilites</h3>
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
                              className={`w-8 h-8 rounded-md border transition ${
                                isSelected
                                  ? 'bg-black border-black text-white'
                                  : 'bg-white border-gray-300 hover:border-gray-400'
                              }`}
                            >
                              {isSelected ? 'O' : ''}
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
              {loading ? 'Publication...' : 'Publier l\'annonce'}
            </Button>
            <Link href="/auxiliaire/annonces">
              <Button variant="ghost" type="button">Annuler</Button>
            </Link>
          </div>
        </div>
      </div>
    </main>
  )
}
