'use client'

import { useState } from 'react'
import { updateAuxiliaireProfile, updateUserInfo } from '@/app/actions/profile'
import { Button } from '@/components/ui/button'
import { DIPLOMES, EXPERIENCE_LEVELS, SPECIALITES, JOURS_SEMAINE, CRENEAUX } from '@/lib/constants'

type Props = {
  userInfo: {
    first_name: string
    last_name: string
    email: string
    phone: string
  }
  profile: {
    diplome: string
    experience: string
    specialites: string[]
    ville: string
    code_postal: string
    rayon_km: number
    disponibilites: Record<string, string[]>
    langues: string[]
    permis_conduire: boolean
    vehicule: boolean
    description: string
  }
}

export function AuxiliaireProfileForm({ userInfo, profile }: Props) {
  const [firstName, setFirstName] = useState(userInfo.first_name)
  const [lastName, setLastName] = useState(userInfo.last_name)
  const [phone, setPhone] = useState(userInfo.phone)

  const [diplome, setDiplome] = useState(profile.diplome)
  const [experience, setExperience] = useState(profile.experience)
  const [specialites, setSpecialites] = useState<string[]>(profile.specialites)
  const [ville, setVille] = useState(profile.ville)
  const [codePostal, setCodePostal] = useState(profile.code_postal)
  const [rayonKm, setRayonKm] = useState(profile.rayon_km)
  const [disponibilites, setDisponibilites] = useState<Record<string, string[]>>(profile.disponibilites)
  const [langues, setLangues] = useState(profile.langues.join(', '))
  const [permisConduire, setPermisConduire] = useState(profile.permis_conduire)
  const [vehicule, setVehicule] = useState(profile.vehicule)
  const [description, setDescription] = useState(profile.description)

  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState(false)

  function toggleSpecialite(value: string) {
    setSpecialites((prev) =>
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

  async function handleSave() {
    setError(null)
    setSuccess(false)
    setLoading(true)

    // Mise a jour des infos utilisateur
    const userResult = await updateUserInfo({
      first_name: firstName,
      last_name: lastName,
      phone,
    })

    if (userResult.error) {
      setError(userResult.error)
      setLoading(false)
      return
    }

    // Mise a jour du profil auxiliaire
    const profileResult = await updateAuxiliaireProfile({
      diplome,
      experience,
      specialites,
      ville,
      code_postal: codePostal,
      rayon_km: rayonKm,
      disponibilites,
      langues: langues.split(',').map((l) => l.trim()).filter(Boolean),
      permis_conduire: permisConduire,
      vehicule,
      description,
    })

    if (profileResult.error) {
      setError(profileResult.error)
    } else {
      setSuccess(true)
    }

    setLoading(false)
  }

  return (
    <div className="space-y-6">
      {error && (
        <div className="p-3 rounded-lg bg-red-50 border border-red-200 text-red-700 text-sm">
          {error}
        </div>
      )}
      {success && (
        <div className="p-3 rounded-lg bg-gray-50 border text-gray-700 text-sm">
          Profil mis a jour avec succes.
        </div>
      )}

      <div className="bg-white rounded-xl border p-6">
        <h3 className="font-semibold mb-4">Informations personnelles</h3>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Prenom</label>
            <input
              type="text"
              value={firstName}
              onChange={(e) => setFirstName(e.target.value)}
              className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-black"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Nom</label>
            <input
              type="text"
              value={lastName}
              onChange={(e) => setLastName(e.target.value)}
              className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-black"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Email</label>
            <input
              type="email"
              value={userInfo.email}
              disabled
              className="w-full rounded-lg border border-gray-200 bg-gray-50 px-3 py-2 text-sm text-gray-500"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Telephone</label>
            <input
              type="tel"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-black"
            />
          </div>
        </div>
      </div>

      <div className="bg-white rounded-xl border p-6">
        <h3 className="font-semibold mb-4">Formation</h3>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Diplome</label>
            <select
              value={diplome}
              onChange={(e) => setDiplome(e.target.value)}
              className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-black"
            >
              {DIPLOMES.map((d) => (
                <option key={d.value} value={d.value}>{d.label}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Experience</label>
            <select
              value={experience}
              onChange={(e) => setExperience(e.target.value)}
              className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-black"
            >
              {EXPERIENCE_LEVELS.map((e) => (
                <option key={e.value} value={e.value}>{e.label}</option>
              ))}
            </select>
          </div>
        </div>
      </div>

      <div className="bg-white rounded-xl border p-6">
        <h3 className="font-semibold mb-4">Specialites</h3>
        <div className="flex flex-wrap gap-2">
          {SPECIALITES.map((spec) => (
            <button
              key={spec.value}
              type="button"
              onClick={() => toggleSpecialite(spec.value)}
              className={`px-3 py-1.5 rounded-full text-sm border transition ${
                specialites.includes(spec.value)
                  ? 'bg-black text-white border-black'
                  : 'bg-white text-gray-700 border-gray-300 hover:border-gray-400'
              }`}
            >
              {spec.label}
            </button>
          ))}
        </div>
      </div>

      <div className="bg-white rounded-xl border p-6">
        <h3 className="font-semibold mb-4">Localisation</h3>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Ville</label>
            <input
              type="text"
              value={ville}
              onChange={(e) => setVille(e.target.value)}
              className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-black"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Code postal</label>
            <input
              type="text"
              value={codePostal}
              onChange={(e) => setCodePostal(e.target.value)}
              maxLength={5}
              className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-black"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Rayon (km)</label>
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
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mt-4">
          <label className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={permisConduire}
              onChange={(e) => setPermisConduire(e.target.checked)}
              className="rounded border-gray-300"
            />
            Permis de conduire
          </label>
          <label className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={vehicule}
              onChange={(e) => setVehicule(e.target.checked)}
              className="rounded border-gray-300"
            />
            Vehicule personnel
          </label>
        </div>
        <div className="mt-4">
          <label className="block text-sm font-medium text-gray-700 mb-1">Langues (separees par des virgules)</label>
          <input
            type="text"
            value={langues}
            onChange={(e) => setLangues(e.target.value)}
            placeholder="Francais, Anglais, Arabe..."
            className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-black"
          />
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
                  <th key={c.value} className="py-2 px-2 text-center font-medium text-gray-500">{c.label}</th>
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

      <div className="bg-white rounded-xl border p-6">
        <h3 className="font-semibold mb-4">Description</h3>
        <textarea
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          placeholder="Presentez-vous, votre parcours et votre approche..."
          rows={5}
          className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-black resize-none"
        />
      </div>

      <Button onClick={handleSave} disabled={loading}>
        {loading ? 'Enregistrement...' : 'Enregistrer les modifications'}
      </Button>
    </div>
  )
}
