'use client'

import { useState } from 'react'
import { login } from '@/app/actions/auth'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import Link from 'next/link'

export default function LoginPage() {
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)

  async function handleSubmit(formData: FormData) {
    setError(null)
    setLoading(true)
    const result = await login(formData)
    if (result?.error) {
      setError(result.error)
      setLoading(false)
    }
  }

  return (
    <main className="min-h-screen flex items-center justify-center p-4 bg-gray-50">
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <Link href="/" className="text-3xl font-bold text-black">
            roxanetnous
          </Link>
          <p className="mt-2 text-gray-600">Connectez-vous a votre compte</p>
        </div>

        <form action={handleSubmit} className="bg-white p-8 rounded-xl shadow-sm border space-y-5">
          {error && (
            <div className="p-3 rounded-lg bg-red-50 border border-red-200 text-red-700 text-sm">
              {error}
            </div>
          )}

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
            placeholder="Votre mot de passe"
            required
          />

          <Button type="submit" className="w-full" disabled={loading}>
            {loading ? 'Connexion...' : 'Se connecter'}
          </Button>
        </form>

        <p className="text-center mt-6 text-sm text-gray-600">
          Pas encore de compte ?{' '}
          <Link href="/register" className="text-black font-medium hover:underline">
            Creer un compte
          </Link>
        </p>
      </div>
    </main>
  )
}
