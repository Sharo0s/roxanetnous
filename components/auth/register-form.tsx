'use client'

import { useState } from 'react'
import { useSearchParams } from 'next/navigation'
import { signup } from '@/app/actions/auth'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import Link from 'next/link'

export function RegisterForm() {
  const searchParams = useSearchParams()
  const initialRole = searchParams.get('role')
  const [role, setRole] = useState<'auxiliaire' | 'beneficiaire' | null>(
    initialRole === 'auxiliaire' || initialRole === 'beneficiaire' ? initialRole : null
  )
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)

  async function handleSubmit(formData: FormData) {
    if (!role) return
    formData.set('role', role)
    setError(null)
    setLoading(true)
    const result = await signup(formData)
    if (result?.error) {
      setError(result.error)
      setLoading(false)
    }
  }

  if (!role) {
    return (
      <main className="min-h-screen flex items-center justify-center p-4 bg-gray-50">
        <div className="w-full max-w-lg">
          <div className="text-center mb-8">
            <Link href="/" className="text-3xl font-bold text-black">
              roxanetnous
            </Link>
            <p className="mt-2 text-gray-600">Creez votre compte</p>
          </div>

          <div className="space-y-4">
            <button
              onClick={() => setRole('auxiliaire')}
              className="w-full p-6 bg-white rounded-xl shadow-sm border-2 border-transparent hover:border-black transition text-left"
            >
              <h3 className="text-lg font-semibold text-gray-900">Je suis auxiliaire de vie</h3>
              <p className="mt-1 text-sm text-gray-600">
                Je souhaite proposer mes services et trouver des missions
              </p>
            </button>

            <button
              onClick={() => setRole('beneficiaire')}
              className="w-full p-6 bg-white rounded-xl shadow-sm border-2 border-transparent hover:border-black transition text-left"
            >
              <h3 className="text-lg font-semibold text-gray-900">Je recherche un auxiliaire</h3>
              <p className="mt-1 text-sm text-gray-600">
                Je cherche un auxiliaire de vie pour moi ou un proche
              </p>
            </button>
          </div>

          <p className="text-center mt-6 text-sm text-gray-600">
            Deja un compte ?{' '}
            <Link href="/login" className="text-black font-medium hover:underline">
              Se connecter
            </Link>
          </p>
        </div>
      </main>
    )
  }

  return (
    <main className="min-h-screen flex items-center justify-center p-4 bg-gray-50">
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <Link href="/" className="text-3xl font-bold text-black">
            roxanetnous
          </Link>
          <p className="mt-2 text-gray-600">
            Inscription {role === 'auxiliaire' ? 'auxiliaire de vie' : 'beneficiaire'}
          </p>
        </div>

        <form action={handleSubmit} className="bg-white p-8 rounded-xl shadow-sm border space-y-5">
          {error && (
            <div className="p-3 rounded-lg bg-red-50 border border-red-200 text-red-700 text-sm">
              {error}
            </div>
          )}

          <div className="grid grid-cols-2 gap-4">
            <Input
              name="firstName"
              label="Prenom"
              placeholder="Prenom"
              required
            />
            <Input
              name="lastName"
              label="Nom"
              placeholder="Nom"
              required
            />
          </div>

          <Input
            name="email"
            type="email"
            label="Adresse email"
            placeholder="vous@exemple.com"
            required
          />

          <Input
            name="password"
            type="password"
            label="Mot de passe"
            placeholder="8 caracteres minimum"
            minLength={8}
            required
          />

          <Button type="submit" className="w-full" disabled={loading}>
            {loading ? 'Creation du compte...' : 'Creer mon compte'}
          </Button>

          <button
            type="button"
            onClick={() => { setRole(null); setError(null) }}
            className="w-full text-sm text-gray-500 hover:text-gray-700"
          >
            Changer de role
          </button>
        </form>

        <p className="text-center mt-6 text-sm text-gray-600">
          Deja un compte ?{' '}
          <Link href="/login" className="text-black font-medium hover:underline">
            Se connecter
          </Link>
        </p>
      </div>
    </main>
  )
}
