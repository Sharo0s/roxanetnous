'use client'

import { useState } from 'react'
import { updatePassword } from '@/app/actions/auth'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import Link from 'next/link'

export default function ResetPasswordPage() {
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState(false)
  const [loading, setLoading] = useState(false)

  async function handleSubmit(formData: FormData) {
    setError(null)
    setLoading(true)
    const result = await updatePassword(formData)
    if (result?.error) {
      setError(result.error)
      setLoading(false)
    } else {
      setSuccess(true)
      setLoading(false)
    }
  }

  return (
    <main id="main-content" tabIndex={-1} className="min-h-screen flex items-center justify-center p-4 kraft bg-kraft focus:outline-none">
      <div className="w-full max-w-md relative z-10">
        <div className="text-center mb-8">
          <Link href="/" className="text-3xl font-bold text-black">
            roxanetnous
          </Link>
          <p className="mt-2 text-gray-600">Nouveau mot de passe</p>
        </div>

        {success ? (
          <div className="bg-white p-8 rounded-xl shadow-sm border text-center">
            <p className="font-semibold text-gray-900 mb-2">Mot de passe mis à jour</p>
            <p className="text-sm text-gray-600 mb-4">
              Votre mot de passe a été modifié avec succès.
            </p>
            <Link
              href="/login"
              className="inline-flex items-center px-4 py-2 bg-accent text-black rounded-lg btn-hover transition text-sm font-medium"
            >
              Se connecter
            </Link>
          </div>
        ) : (
          <form action={handleSubmit} className="bg-white p-8 rounded-xl shadow-sm border space-y-5">
            {error && (
              <div className="p-3 rounded-lg bg-red-50 border border-red-200 text-red-700 text-sm">
                {error}
              </div>
            )}

            <Input
              name="password"
              type="password"
              label="Nouveau mot de passe"
              placeholder="8 caractères minimum"
              minLength={8}
              required
            />

            <Button type="submit" className="w-full" disabled={loading}>
              {loading ? 'Mise à jour...' : 'Mettre à jour le mot de passe'}
            </Button>
          </form>
        )}
      </div>
    </main>
  )
}
