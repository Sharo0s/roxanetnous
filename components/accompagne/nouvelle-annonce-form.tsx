'use client'

import { useState } from 'react'
import { createAnnonceAccompagne } from '@/app/actions/annonces'
import { Button } from '@/components/ui/button'
import { SPECIALITES, DIPLOMES, EXPERIENCE_LEVELS, JOURS_SEMAINE, CRENEAUX } from '@/lib/constants'
import { CityAutocomplete } from '@/components/ui/city-autocomplete'
import { MapRadius } from '@/components/ui/map-radius'
import Link from 'next/link'

type Props = {
  departementsOuverts: string[]
}

export function NouvelleAnnonceAccompagneForm({ departementsOuverts }: Props) {
  const [step, setStep] = useState(1)
  const [titre, setTitre] = useState('')
  const [description, setDescription] = useState('')
  const [besoinsSpecifiques, setBesoinsSpecifiques] = useState('')
  const [specialitesRecherchees, setSpecialitesRecherchees] = useState<string[]>([])
  const [ville, setVille] = useState('')
  const [codePostal, setCodePostal] = useState('')
  const [diplomeRequis, setDiplomeRequis] = useState('')
  const [experienceMin, setExperienceMin] = useState('')
  const [niveauDependance, setNiveauDependance] = useState<'besoins_plus_plus_plus' | 'besoins_plus_plus' | 'besoins_plus'>('besoins_plus_plus')
  const [equipeEnPlace, setEquipeEnPlace] = useState('')
  const [disponibilites, setDisponibilites] = useState<Record<string, string[]>>({})
  const [dateDebut, setDateDebut] = useState('')
  const [infosComplementaires, setInfosComplementaires] = useState('')
  const [messageAccompagnantes, setMessageAccompagnantes] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  function toggleSpecialite(value: string) {
    setSpecialitesRecherchees((prev) =>
      prev.includes(value) ? prev.filter((s) => s !== value) : [...prev, value]
    )
  }

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
    if (!ville.trim() || specialitesRecherchees.length === 0) {
      setError('La ville et au moins une spécialité sont requis.')
      return
    }
    if (!dateDebut) {
      setError('La date de début est requise.')
      return
    }

    setLoading(true)
    const result = await createAnnonceAccompagne({
      titre,
      description,
      besoins_specifiques: besoinsSpecifiques,
      specialites_recherchees: specialitesRecherchees,
      ville,
      code_postal: codePostal,
      diplome_requis: diplomeRequis,
      experience_min: experienceMin,
      niveau_dependance: niveauDependance,
      ouverture_aide: '',
      equipe_en_place: equipeEnPlace,
      disponibilites,
      date_debut: dateDebut,
      infos_complementaires: infosComplementaires,
      message_accompagnantes: messageAccompagnantes,
    })

    if (result?.error) {
      setError(result.error)
      setLoading(false)
    }
  }

  const totalSteps = 4

  return (
    <div>
      <h2 className="text-2xl font-bold text-gray-900 mb-2">Publier une annonce</h2>
      <p className="text-sm text-gray-500 mb-6">Étape {step} sur {totalSteps}</p>

      <div className="flex gap-1 mb-8">
        {Array.from({ length: totalSteps }).map((_, i) => (
          <div
            key={i}
            className={`h-1 flex-1 rounded-full ${i < step ? 'bg-accent' : 'bg-gray-200'}`}
          />
        ))}
      </div>

      {error && (
        <div className="mb-6 p-3 rounded-lg bg-red-50 border border-red-200 text-red-700 text-sm">
          {error}
        </div>
      )}

      {step === 1 && (
        <div className="space-y-6">
          <div className="bg-white rounded-xl border p-6">
            <h3 className="font-semibold mb-4">Description de votre besoin</h3>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Titre de l&#39;annonce <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  value={titre}
                  onChange={(e) => setTitre(e.target.value)}
                  placeholder="Ex: Recherche accompagnante de vie pour personne âgée"
                  className="w-full rounded-lg border border-gray-400 bg-white px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-black"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Description détaillée <span className="text-red-500">*</span>
                </label>
                <textarea
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="Décrivez la situation, les besoins de la personne aidée..."
                  rows={5}
                  className="w-full rounded-lg border border-gray-400 bg-white px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-black resize-none"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Besoins spécifiques
                </label>
                <textarea
                  value={besoinsSpecifiques}
                  onChange={(e) => setBesoinsSpecifiques(e.target.value)}
                  placeholder="Particularités de la prise en charge, pathologies, etc."
                  rows={3}
                  className="w-full rounded-lg border border-gray-400 bg-white px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-black resize-none"
                />
              </div>
            </div>
          </div>

          <div className="bg-white rounded-xl border p-6">
            <h3 className="font-semibold mb-4">Spécialités recherchées <span className="text-red-500">*</span></h3>
            <div className="flex flex-wrap gap-2">
              {SPECIALITES.map((spec) => (
                <button
                  key={spec.value}
                  type="button"
                  onClick={() => toggleSpecialite(spec.value)}
                  className={`px-3 py-1.5 rounded-full text-sm border transition ${
                    specialitesRecherchees.includes(spec.value)
                      ? 'bg-accent text-black border-accent'
                      : 'bg-white text-gray-700 border-gray-400 hover:border-gray-400'
                  }`}
                >
                  {spec.label}
                </button>
              ))}
            </div>
          </div>

          <Button onClick={() => setStep(2)}>Suivant</Button>
        </div>
      )}

      {step === 2 && (
        <div className="space-y-6">
          <div className="bg-white rounded-xl border p-6">
            <h3 className="font-semibold mb-4">Situation</h3>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Besoin de l'accompagnement <span className="text-red-500">*</span>
                </label>
                <div className="flex gap-3">
                  {[
                    { value: 'besoins_plus' as const, label: 'Besoins +' },
                    { value: 'besoins_plus_plus' as const, label: 'Besoins ++' },
                    { value: 'besoins_plus_plus_plus' as const, label: 'Besoins +++' },
                  ].map((opt) => (
                    <button
                      key={opt.value}
                      type="button"
                      onClick={() => setNiveauDependance(opt.value)}
                      className={`px-4 py-2 rounded-lg text-sm border transition flex-1 ${
                        niveauDependance === opt.value
                          ? 'bg-accent text-black border-accent'
                          : 'bg-white text-gray-700 border-gray-400 hover:border-gray-400'
                      }`}
                    >
                      {opt.label}
                    </button>
                  ))}
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Équipe en place
                </label>
                <input
                  type="text"
                  value={equipeEnPlace}
                  onChange={(e) => setEquipeEnPlace(e.target.value)}
                  placeholder="Ex: Infirmière le matin, kinésithérapeute 2x/semaine..."
                  className="w-full rounded-lg border border-gray-400 bg-white px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-black"
                />
              </div>
            </div>
          </div>

          <div className="bg-white rounded-xl border p-6">
            <h3 className="font-semibold mb-4">Critères souhaités</h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Diplôme souhaité
                </label>
                <select
                  value={diplomeRequis}
                  onChange={(e) => setDiplomeRequis(e.target.value)}
                  className="w-full rounded-lg border border-gray-400 bg-white px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-black"
                >
                  <option value="">Pas de préférence</option>
                  {DIPLOMES.map((d) => (
                    <option key={d.value} value={d.value}>{d.label}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Expérience minimum
                </label>
                <select
                  value={experienceMin}
                  onChange={(e) => setExperienceMin(e.target.value)}
                  className="w-full rounded-lg border border-gray-400 bg-white px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-black"
                >
                  <option value="">Pas de préférence</option>
                  {EXPERIENCE_LEVELS.map((e) => (
                    <option key={e.value} value={e.value}>{e.label}</option>
                  ))}
                </select>
              </div>
            </div>
          </div>

          <div className="flex gap-3">
            <Button variant="ghost" onClick={() => setStep(1)}>Précédent</Button>
            <Button onClick={() => setStep(3)}>Suivant</Button>
          </div>
        </div>
      )}

      {step === 3 && (
        <div className="space-y-6">
          <div className="bg-white rounded-xl border p-6">
            <h3 className="font-semibold mb-4">Localisation et planning</h3>
            <div className="mb-6">
              <CityAutocomplete
                ville={ville}
                codePostal={codePostal}
                onVilleChange={setVille}
                onCodePostalChange={setCodePostal}
                departementsOuverts={departementsOuverts}
                required
              />
            </div>

            <MapRadius ville={ville} codePostal={codePostal} rayonKm={5} />

            <div className="mb-6">
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Date de début souhaitée <span className="text-red-500">*</span>
              </label>
              <input
                type="date"
                value={dateDebut}
                onChange={(e) => setDateDebut(e.target.value)}
                className="w-full sm:w-auto rounded-lg border border-gray-400 bg-white px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-black"
              />
            </div>

            <h4 className="font-medium text-sm text-gray-700 mb-3">Disponibilités souhaitées</h4>
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
            <Button variant="ghost" onClick={() => setStep(2)}>Précédent</Button>
            <Button onClick={() => setStep(4)}>Suivant</Button>
          </div>
        </div>
      )}

      {step === 4 && (
        <div className="space-y-6">
          <div className="bg-white rounded-xl border p-6">
            <h3 className="font-semibold mb-4">Informations complémentaires</h3>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Informations complémentaires
                </label>
                <textarea
                  value={infosComplementaires}
                  onChange={(e) => setInfosComplementaires(e.target.value)}
                  placeholder="Toute information utile pour les candidats..."
                  rows={3}
                  className="w-full rounded-lg border border-gray-400 bg-white px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-black resize-none"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Message aux accompagnantes
                </label>
                <textarea
                  value={messageAccompagnantes}
                  onChange={(e) => setMessageAccompagnantes(e.target.value)}
                  placeholder="Un mot personnel pour les accompagnantes qui verront votre annonce..."
                  rows={3}
                  className="w-full rounded-lg border border-gray-400 bg-white px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-black resize-none"
                />
              </div>
            </div>
          </div>

          <div className="bg-white rounded-xl border p-6">
            <h3 className="font-semibold mb-4">Récapitulatif</h3>
            <dl className="space-y-2 text-sm">
              <div className="flex justify-between">
                <dt className="text-gray-500">Titre</dt>
                <dd className="font-medium text-right">{titre || '-'}</dd>
              </div>
              <div className="flex justify-between">
                <dt className="text-gray-500">Ville</dt>
                <dd className="font-medium">{ville || '-'} {codePostal && `(${codePostal})`}</dd>
              </div>
              <div className="flex justify-between">
                <dt className="text-gray-500">Accompagnement</dt>
                <dd className="font-medium">
                  {niveauDependance === 'besoins_plus' ? 'Besoins +' : niveauDependance === 'besoins_plus_plus' ? 'Besoins ++' : 'Besoins +++'}
                </dd>
              </div>
              <div className="flex justify-between">
                <dt className="text-gray-500">Début</dt>
                <dd className="font-medium">{dateDebut ? new Date(dateDebut).toLocaleDateString('fr-FR') : '-'}</dd>
              </div>
              <div>
                <dt className="text-gray-500 mb-1">Spécialités ({specialitesRecherchees.length})</dt>
                <dd className="flex flex-wrap gap-1">
                  {specialitesRecherchees.map((s) => (
                    <span key={s} className="px-2 py-0.5 bg-gray-100 text-gray-600 rounded-full text-xs">
                      {SPECIALITES.find((sp) => sp.value === s)?.label || s}
                    </span>
                  ))}
                </dd>
              </div>
            </dl>
          </div>

          <div className="flex gap-3">
            <Button variant="ghost" onClick={() => setStep(3)}>Précédent</Button>
            <Button onClick={handleSubmit} disabled={loading}>
              {loading ? 'Publication...' : 'Publier l\'annonce'}
            </Button>
          </div>
        </div>
      )}
    </div>
  )
}
