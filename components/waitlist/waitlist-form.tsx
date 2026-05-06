'use client'

import { useState } from 'react'
import { Input } from '@/components/ui/input'
import type { Departement } from '@/lib/departements'
import { submitWaitlist, type WaitlistResult } from '@/app/actions/waitlist'

type Props = {
  initial: { email: string; codeDepartement: string; role: string }
  departements: Departement[]
}

export function WaitlistForm({ initial, departements }: Props) {
  const [status, setStatus] = useState<'idle' | 'loading' | 'success' | 'error'>('idle')
  const [error, setError] = useState('')
  const [result, setResult] = useState<WaitlistResult | null>(null)

  async function handleSubmit(formData: FormData) {
    setStatus('loading')
    setError('')
    const res = await submitWaitlist(formData)
    if (res.error) {
      setError(res.error)
      setStatus('error')
    } else {
      setResult(res)
      setStatus('success')
    }
  }

  const sortedDepartements = [...departements].sort((a, b) =>
    a.code.localeCompare(b.code, 'fr', { numeric: true })
  )

  if (status === 'success' && result) {
    const isAlready = result.alreadyRegistered
    return (
      <div className="bg-white border rounded-xl p-6" role="status" aria-live="polite">
        <p className="font-semibold text-black mb-1">
          {isAlready ? 'Vous etes deja inscrit(e)' : 'Inscription confirmee'}
        </p>
        <p className="text-sm text-black/70">
          {isAlready
            ? `Vous etes deja sur la waitlist pour ${result.nomDepartement} (${result.codeDepartement}). Nous vous notifierons a l'ouverture.`
            : `Merci ! Vous etes sur la waitlist pour ${result.nomDepartement} (${result.codeDepartement}). Un email de confirmation vient de partir.`}
        </p>
      </div>
    )
  }

  return (
    <form action={handleSubmit} className="bg-white border rounded-xl p-6 space-y-4">
      {error && (
        <p role="alert" className="text-sm text-red-700 bg-red-50 border border-red-200 rounded-lg p-3">
          {error}
        </p>
      )}
      <Input
        label="Votre email"
        id="waitlist-email"
        name="email"
        type="email"
        defaultValue={initial.email}
        required
        autoComplete="email"
      />
      <div className="w-full">
        <label htmlFor="waitlist-departement" className="block">
          <span className="block text-sm font-medium text-black mb-2">
            Departement
            <span className="text-gray-700"> (obligatoire)</span>
          </span>
          <select
            id="waitlist-departement"
            name="code_departement"
            required
            defaultValue={initial.codeDepartement}
            className="flex h-10 w-full rounded-lg border border-gray-400 bg-white px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-focus-ring"
          >
            <option value="" disabled>Choisissez un departement</option>
            {sortedDepartements.map((d) => (
              <option key={d.code} value={d.code}>
                {d.nom} ({d.code})
              </option>
            ))}
          </select>
        </label>
      </div>
      <div className="w-full">
        <label htmlFor="waitlist-role" className="block">
          <span className="block text-sm font-medium text-black mb-2">Vous etes...</span>
          <select
            id="waitlist-role"
            name="role"
            defaultValue={initial.role}
            className="flex h-10 w-full rounded-lg border border-gray-400 bg-white px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-focus-ring"
          >
            <option value="">Sans precision</option>
            <option value="accompagnante">Accompagnante de vie (auxiliaire)</option>
            <option value="accompagne">Accompagne ou proche aidant</option>
            <option value="visiteur">Visiteur curieux</option>
          </select>
        </label>
      </div>
      <button
        type="submit"
        disabled={status === 'loading'}
        aria-busy={status === 'loading'}
        className="w-full px-4 py-2 rounded-lg text-sm font-medium text-black btn-hover disabled:opacity-50 bg-accent"
      >
        {status === 'loading' ? 'Envoi en cours...' : 'Rejoindre la waitlist'}
      </button>
    </form>
  )
}
