'use client'

import { useState } from 'react'
import { updateUserInfo, updateBeneficiaireProfile } from '@/app/actions/profile'
import { Button } from '@/components/ui/button'

type Props = {
  userInfo: {
    first_name: string
    last_name: string
    email: string
    phone: string
  }
  profile: {
    ville: string
    code_postal: string
    adresse: string
  }
}

export function BeneficiaireProfileForm({ userInfo, profile }: Props) {
  const [firstName, setFirstName] = useState(userInfo.first_name)
  const [lastName, setLastName] = useState(userInfo.last_name)
  const [phone, setPhone] = useState(userInfo.phone)
  const [ville, setVille] = useState(profile.ville)
  const [codePostal, setCodePostal] = useState(profile.code_postal)
  const [adresse, setAdresse] = useState(profile.adresse)

  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState(false)

  async function handleSave() {
    setError(null)
    setSuccess(false)
    setLoading(true)

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

    const profileResult = await updateBeneficiaireProfile({
      ville,
      code_postal: codePostal,
      adresse,
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
        <h3 className="font-semibold mb-4">Adresse</h3>
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Adresse</label>
            <input
              type="text"
              value={adresse}
              onChange={(e) => setAdresse(e.target.value)}
              placeholder="12 rue de la Paix"
              className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-black"
            />
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
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
          </div>
        </div>
      </div>

      <Button onClick={handleSave} disabled={loading}>
        {loading ? 'Enregistrement...' : 'Enregistrer les modifications'}
      </Button>
    </div>
  )
}
