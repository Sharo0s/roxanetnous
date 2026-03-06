'use client'

import { useState } from 'react'
import { resetPassword } from '@/app/actions/auth'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import Link from 'next/link'

export default function ForgotPasswordPage() {
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState(false)
  const [loading, setLoading] = useState(false)

  async function handleSubmit(formData: FormData) {
    setError(null)
    setLoading(true)
    const result = await resetPassword(formData)
    if (result?.error) {
      setError(result.error)
      setLoading(false)
    } else {
      setSuccess(true)
      setLoading(false)
    }
  }

  return (
    <main className="min-h-screen flex items-center justify-center p-4 kraft bg-kraft">
      <div className="w-full max-w-md relative z-10">
        <div className="text-center mb-8">
          <Link href="/" className="text-3xl font-bold text-black">
            roxanetnous
          </Link>
          <p className="mt-2 text-gray-600">Reinitialiser votre mot de passe</p>
        </div>

        {success ? (
          <div className="bg-white p-8 rounded-xl shadow-sm border text-center">
            <p className="font-semibold text-gray-900 mb-2">Email envoye</p>
            <p className="text-sm text-gray-600 mb-4">
              Si un compte existe avec cette adresse, vous recevrez un lien pour reinitialiser votre mot de passe.
            </p>
            <Link href="/login" className="text-sm text-black font-medium hover:underline">
              Retour a la connexion
            </Link>
          </div>
        ) : (
          <form action={handleSubmit} className="bg-white p-8 rounded-xl shadow-sm border space-y-5">
            {error && (
              <div className="p-3 rounded-lg bg-red-50 border border-red-200 text-red-700 text-sm">
                {error}
              </div>
            )}

            <p className="text-sm text-gray-600">
              Entrez votre adresse email. Vous recevrez un lien pour creer un nouveau mot de passe.
            </p>

            <Input
              name="email"
              type="email"
              label="Adresse email"
              placeholder="vous@exemple.com"
              required
            />

            <Button type="submit" className="w-full" disabled={loading}>
              {loading ? 'Envoi en cours...' : 'Envoyer le lien'}
            </Button>
          </form>
        )}

        <p className="text-center mt-6 text-sm text-gray-600">
          <Link href="/login" className="text-black font-medium hover:underline">
            Retour a la connexion
          </Link>
        </p>
      </div>
    </main>
  )
}
