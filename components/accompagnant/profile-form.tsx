'use client'

import { useRef, useState } from 'react'
import { updateAccompagnantProfile, updateUserInfo } from '@/app/actions/profile'
import { uploadJustificatif } from '@/app/actions/accompagnante'
import { Button } from '@/components/ui/button'
import { CityAutocomplete } from '@/components/ui/city-autocomplete'
import { DIPLOMES, EXPERIENCE_LEVELS, SPECIALITES, JOURS_SEMAINE, CRENEAUX } from '@/lib/constants'
import { MapRadius } from '@/components/ui/map-radius'

type Props = {
  userInfo: {
    first_name: string
    last_name: string
    email: string
    phone: string
  }
  profile: {
    diplomes: string[]
    experience: string
    specialites: string[]
    ville: string
    code_postal: string
    rayon_km: number
    disponibilites: Record<string, string[]>
    permis_conduire: boolean
    vehicule: boolean
    description: string
    justificatif_permis_url: string | null
    justificatifs_diplomes: Record<string, string>
    justificatif_cv_url: string | null
  }
  departementsOuverts: string[]
}

export function AccompagnantProfileForm({ userInfo, profile, departementsOuverts }: Props) {
  const [firstName, setFirstName] = useState(userInfo.first_name)
  const [lastName, setLastName] = useState(userInfo.last_name)
  const [phone, setPhone] = useState(userInfo.phone)

  const [diplomes, setDiplomes] = useState<string[]>(profile.diplomes)
  const [experience, setExperience] = useState(profile.experience)
  const [specialites, setSpecialites] = useState<string[]>(profile.specialites)
  const [ville, setVille] = useState(profile.ville)
  const [codePostal, setCodePostal] = useState(profile.code_postal)
  const [rayonKm, setRayonKm] = useState(profile.rayon_km)
  const [disponibilites, setDisponibilites] = useState<Record<string, string[]>>(profile.disponibilites)
  const [permisConduire, setPermisConduire] = useState(profile.permis_conduire)
  const [vehicule, setVehicule] = useState(profile.vehicule)
  const [description, setDescription] = useState(profile.description)

  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState(false)
  const [uploadingPermis, setUploadingPermis] = useState(false)
  const [permisFileName, setPermisFileName] = useState<string | null>(
    profile.justificatif_permis_url ? profile.justificatif_permis_url.split('/').pop() || null : null
  )
  const permisFileRef = useRef<HTMLInputElement>(null)
  const [uploadingDiplome, setUploadingDiplome] = useState<string | null>(null)
  const [diplomeFileNames, setDiplomeFileNames] = useState<Record<string, string>>(
    Object.fromEntries(
      Object.entries(profile.justificatifs_diplomes).map(([k, v]) => [k, v.split('/').pop() || v])
    )
  )
  const diplomeFileRefs = useRef<Record<string, HTMLInputElement | null>>({})
  const [uploadingCv, setUploadingCv] = useState(false)
  const [cvFileName, setCvFileName] = useState<string | null>(
    profile.justificatif_cv_url ? profile.justificatif_cv_url.split('/').pop() || null : null
  )
  const cvFileRef = useRef<HTMLInputElement>(null)

  async function handleCvUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    setUploadingCv(true)
    setError(null)
    const formData = new FormData()
    formData.set('file', file)
    formData.set('type', 'cv')
    const result = await uploadJustificatif(formData)
    if (result?.error) {
      setError(result.error)
    } else {
      setCvFileName(file.name)
    }
    setUploadingCv(false)
  }

  async function handleDiplomeUpload(e: React.ChangeEvent<HTMLInputElement>, diplomeValue: string) {
    const file = e.target.files?.[0]
    if (!file) return
    setUploadingDiplome(diplomeValue)
    setError(null)
    const formData = new FormData()
    formData.set('file', file)
    formData.set('type', `diplome:${diplomeValue}`)
    const result = await uploadJustificatif(formData)
    if (result?.error) {
      setError(result.error)
    } else {
      setDiplomeFileNames((prev) => ({ ...prev, [diplomeValue]: file.name }))
    }
    setUploadingDiplome(null)
  }

  async function handlePermisUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    setUploadingPermis(true)
    setError(null)
    const formData = new FormData()
    formData.set('file', file)
    formData.set('type', 'permis')
    const result = await uploadJustificatif(formData)
    if (result?.error) {
      setError(result.error)
    } else {
      setPermisFileName(file.name)
    }
    setUploadingPermis(false)
  }

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

    // Mise a jour du profil accompagnant
    const profileResult = await updateAccompagnantProfile({
      diplomes,
      experience,
      specialites,
      ville,
      code_postal: codePostal,
      rayon_km: rayonKm,
      disponibilites,
      langues: [],
      permis_conduire: permisConduire,
      vehicule,
      description,
    })

    if (profileResult.error) {
      setError(profileResult.error)
    } else {
      setSuccess(true)
      setTimeout(() => {
        window.location.reload()
      }, 2000)
    }

    setLoading(false)
  }

  return (
    <div className="space-y-6">
      <div className="bg-white rounded-xl border p-6">
        <h2 className="font-semibold mb-4">Informations personnelles</h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Prénom</label>
            <input
              type="text"
              value={firstName}
              onChange={(e) => setFirstName(e.target.value)}
              className="w-full rounded-lg border border-gray-400 bg-white px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-black"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Nom</label>
            <input
              type="text"
              value={lastName}
              onChange={(e) => setLastName(e.target.value)}
              className="w-full rounded-lg border border-gray-400 bg-white px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-black"
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
            <label className="block text-sm font-medium text-gray-700 mb-1">Téléphone</label>
            <input
              type="tel"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              className="w-full rounded-lg border border-gray-400 bg-white px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-black"
            />
          </div>
        </div>
      </div>

      <div className="bg-white rounded-xl border p-6">
        <h2 className="font-semibold mb-4">Description</h2>
        <textarea
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          placeholder="Présentez-vous, votre parcours et votre approche..."
          rows={5}
          className="w-full rounded-lg border border-gray-400 bg-white px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-black resize-none"
        />
      </div>

      <div className="bg-white rounded-xl border p-6">
        <h2 className="font-semibold mb-4">Formation</h2>

        {/* CV upload */}
        <div className="space-y-2 mb-6">
          <label className="block text-sm font-medium text-gray-700">
            Curriculum vitae (CV) <span className="text-red-500">*</span>
          </label>
          <input
            ref={cvFileRef}
            type="file"
            accept=".pdf,.jpg,.jpeg,.png,.webp"
            onChange={handleCvUpload}
            className="hidden"
          />
          <button
            type="button"
            onClick={() => cvFileRef.current?.click()}
            disabled={uploadingCv}
            className={`w-full p-4 rounded-lg border-2 border-dashed transition text-sm ${
              cvFileName
                ? 'border-accent bg-gray-50'
                : 'border-gray-400 hover:border-gray-500'
            }`}
          >
            {uploadingCv
              ? 'Upload en cours...'
              : cvFileName
                ? `Fichier : ${cvFileName}`
                : 'Cliquez pour sélectionner un fichier'}
          </button>
          <p className="text-xs text-gray-400">PDF, JPG, PNG ou WebP (max. 10 Mo)</p>
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">Diplômes</label>
          <div className="space-y-2 mb-4">
            {DIPLOMES.map((d) => {
              const isSelected = diplomes.includes(d.value)
              return (
                <div key={d.value}>
                  <label
                    className={`flex items-center p-3 rounded-lg border cursor-pointer transition ${
                      isSelected
                        ? 'border-accent bg-gray-50'
                        : 'border-gray-200 hover:border-gray-400'
                    }`}
                  >
                    <input
                      type="checkbox"
                      checked={isSelected}
                      onChange={() => {
                        if (d.value === 'sans_diplome') {
                          setDiplomes((prev) => prev.includes('sans_diplome') ? prev.filter((v) => v !== 'sans_diplome') : ['sans_diplome'])
                          setDiplomeFileNames({})
                        } else {
                          setDiplomes((prev) =>
                            prev.includes(d.value)
                              ? prev.filter((v) => v !== d.value)
                              : [...prev.filter((v) => v !== 'sans_diplome'), d.value]
                          )
                        }
                      }}
                      className="sr-only"
                    />
                    <span className="text-sm">{d.label}</span>
                  </label>

                  {isSelected && d.value !== 'sans_diplome' && (
                    <div className="mt-2 ml-4 mb-3">
                      <input
                        ref={(el) => { diplomeFileRefs.current[d.value] = el }}
                        type="file"
                        accept=".pdf,.jpg,.jpeg,.png,.webp"
                        onChange={(e) => handleDiplomeUpload(e, d.value)}
                        className="hidden"
                      />
                      <button
                        type="button"
                        onClick={() => diplomeFileRefs.current[d.value]?.click()}
                        disabled={uploadingDiplome === d.value}
                        className={`w-full rounded-lg border-2 border-dashed px-4 py-3 text-sm transition ${
                          diplomeFileNames[d.value]
                            ? 'border-accent bg-gray-50 text-gray-700'
                            : 'border-gray-400 text-gray-500 hover:border-gray-400'
                        }`}
                      >
                        {uploadingDiplome === d.value
                          ? 'Upload en cours...'
                          : diplomeFileNames[d.value]
                            ? `Fichier : ${diplomeFileNames[d.value]}`
                            : `Justificatif ${d.label} *`}
                      </button>
                      <p className="text-xs text-gray-400 mt-1">PDF, JPG, PNG ou WebP (max. 10 Mo)</p>
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Expérience</label>
          <select
            value={experience}
            onChange={(e) => setExperience(e.target.value)}
            className="w-full rounded-lg border border-gray-400 bg-white px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-black"
          >
            {EXPERIENCE_LEVELS.map((e) => (
              <option key={e.value} value={e.value}>{e.label}</option>
            ))}
          </select>
        </div>
      </div>

      <div className="bg-white rounded-xl border p-6">
        <h2 className="font-semibold mb-4">Spécialités</h2>
        <div className="flex flex-wrap gap-2">
          {SPECIALITES.map((spec) => (
            <button
              key={spec.value}
              type="button"
              onClick={() => toggleSpecialite(spec.value)}
              className={`px-3 py-1.5 rounded-full text-sm border transition ${
                specialites.includes(spec.value)
                  ? 'bg-accent text-black border-accent'
                  : 'bg-white text-gray-700 border-gray-400 hover:border-gray-400'
              }`}
            >
              {spec.label}
            </button>
          ))}
        </div>
      </div>

      <div className="bg-white rounded-xl border p-6">
        <h2 className="font-semibold mb-4">Localisation</h2>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 items-end">
          <div className="sm:col-span-2">
            <CityAutocomplete
              ville={ville}
              codePostal={codePostal}
              onVilleChange={setVille}
              onCodePostalChange={setCodePostal}
              departementsOuverts={departementsOuverts}
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
              className="w-full rounded-lg border border-gray-400 bg-white px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-black"
            />
          </div>
        </div>
        <div className="mt-4">
          <MapRadius ville={ville} codePostal={codePostal} rayonKm={rayonKm} />
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mt-4">
          <div>
            <label className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={permisConduire}
                onChange={(e) => setPermisConduire(e.target.checked)}
                className="rounded border-gray-400"
              />
              Permis de conduire
            </label>

            {permisConduire && (
              <div className="mt-3 ml-6">
                <input
                  ref={permisFileRef}
                  type="file"
                  accept=".pdf,.jpg,.jpeg,.png,.webp"
                  onChange={handlePermisUpload}
                  className="hidden"
                />
                <button
                  type="button"
                  onClick={() => permisFileRef.current?.click()}
                  disabled={uploadingPermis}
                  className="w-full rounded-lg border-2 border-dashed border-gray-400 px-4 py-3 text-sm text-gray-500 hover:border-gray-400 transition"
                >
                  {uploadingPermis
                    ? 'Upload en cours...'
                    : permisFileName
                      ? `Fichier : ${permisFileName}`
                      : 'Joindre un scan du permis de conduire'}
                </button>
                <p className="text-xs text-gray-400 mt-1">PDF, JPG, PNG ou WebP (max. 10 Mo)</p>
              </div>
            )}
          </div>
          <label className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={vehicule}
              onChange={(e) => setVehicule(e.target.checked)}
              className="rounded border-gray-400"
            />
            Véhicule personnel
          </label>
        </div>
      </div>

      <div className="bg-white rounded-xl border p-6">
        <h2 className="font-semibold mb-4">Disponibilités</h2>
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
                              ? 'bg-accent border-accent text-black'
                              : 'bg-white border-gray-400 hover:border-gray-400'
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

      {success && (
        <div className="p-4 rounded-lg bg-accent text-black text-sm font-medium">
          Profil mis à jour avec succès.
        </div>
      )}
      {error && (
        <div role="alert" className="p-3 rounded-lg bg-red-50 border border-red-200 text-red-700 text-sm">
          {error}
        </div>
      )}

      <Button onClick={handleSave} disabled={loading}>
        {loading ? 'Enregistrement...' : 'Enregistrer les modifications'}
      </Button>
    </div>
  )
}
