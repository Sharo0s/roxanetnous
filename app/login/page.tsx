'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { login } from '@/app/actions/auth'
import { checkEmailExists } from '@/app/actions/auth'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import Link from 'next/link'

export default function LoginPage() {
  const router = useRouter()
  const [step, setStep] = useState<'email' | 'password'>('email')
  const [email, setEmail] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)

  async function handleEmailSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!email.trim()) return
    setError(null)
    setLoading(true)

    try {
      const exists = await checkEmailExists(email.trim())
      if (exists) {
        setStep('password')
      } else {
        router.push(`/register?email=${encodeURIComponent(email.trim())}`)
      }
    } catch {
      setError('Erreur lors de la vérification. Réessayez.')
    } finally {
      setLoading(false)
    }
  }

  async function handleLoginSubmit(formData: FormData) {
    setError(null)
    setLoading(true)
    formData.set('email', email)
    const result = await login(formData)
    if (result?.error) {
      setError(result.error)
      setLoading(false)
    }
  }

  return (
    <main id="main-content" tabIndex={-1} className="min-h-screen flex items-center justify-center p-4 kraft bg-kraft focus:outline-none">
      <div className="w-full max-w-md relative z-10">
        <h1 className="sr-only">Se connecter</h1>
        <div className="text-center mb-8">
          <Link href="/" className="text-3xl font-bold text-black">
            roxanetnous
          </Link>
        </div>

        {step === 'email' ? (
          <form onSubmit={handleEmailSubmit} className="bg-white p-8 rounded-xl shadow-sm border space-y-5">
            {error && (
              <div role="alert" className="p-3 rounded-lg bg-red-50 border border-red-200 text-red-700 text-sm">
                {error}
              </div>
            )}

            <Input
              name="email"
              type="email"
              label="Adresse email"
              placeholder="vous@exemple.com"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
            />

            <Button type="submit" className="w-full" disabled={loading}>
              {loading ? 'Vérification...' : 'Continuer'}
            </Button>
          </form>
        ) : (
          <form action={handleLoginSubmit} className="bg-white p-8 rounded-xl shadow-sm border space-y-5">
            {error && (
              <div role="alert" className="p-3 rounded-lg bg-red-50 border border-red-200 text-red-700 text-sm">
                {error}
              </div>
            )}

            <div className="text-sm text-black">
              <span className="text-gray-500">Compte :</span>{' '}
              <button
                type="button"
                onClick={() => { setStep('email'); setError(null) }}
                className="font-medium underline"
              >
                {email}
              </button>
            </div>

            <Input
              name="password"
              type="password"
              label="Mot de passe"
              placeholder="Votre mot de passe"
              required
              autoFocus
            />

            <Button type="submit" className="w-full" disabled={loading}>
              {loading ? 'Connexion...' : 'Se connecter'}
            </Button>

            <div className="text-center">
              <Link href="/forgot-password" className="text-sm text-gray-500 hover:text-black">
                Mot de passe oublié ?
              </Link>
            </div>
          </form>
        )}
      </div>
    </main>
  )
}
