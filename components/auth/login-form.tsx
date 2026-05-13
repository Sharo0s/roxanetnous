'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { login, checkEmailExists, resendConfirmation } from '@/app/actions/auth'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import Link from 'next/link'

export function LoginForm() {
  const router = useRouter()
  const [step, setStep] = useState<'email' | 'password'>('email')
  const [email, setEmail] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [errorCode, setErrorCode] = useState<'email_not_confirmed' | null>(null)
  const [loading, setLoading] = useState(false)
  const [resendState, setResendState] = useState<'idle' | 'sending' | 'sent'>('idle')

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
    setErrorCode(null)
    setResendState('idle')
    setLoading(true)
    formData.set('email', email)
    const result = await login(formData)
    if (result?.error) {
      setError(result.error)
      setErrorCode(result.errorCode ?? null)
      setLoading(false)
    }
  }

  async function handleResend() {
    setResendState('sending')
    const formData = new FormData()
    formData.set('email', email)
    const result = await resendConfirmation(formData)
    if (result?.success) {
      setResendState('sent')
    } else {
      setResendState('idle')
      setError(result?.error || 'Erreur lors de l\'envoi.')
    }
  }

  return (
    <div className="w-full max-w-md relative z-10">
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
              <p>{error}</p>
              {errorCode === 'email_not_confirmed' && resendState !== 'sent' && (
                <button
                  type="button"
                  onClick={handleResend}
                  disabled={resendState === 'sending'}
                  className="mt-2 text-sm font-medium underline disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {resendState === 'sending' ? 'Envoi en cours...' : 'Renvoyer le lien de confirmation'}
                </button>
              )}
            </div>
          )}

          {resendState === 'sent' && (
            <div role="status" className="p-3 rounded-lg bg-green-50 border border-green-200 text-green-700 text-sm">
              Un nouveau lien de confirmation a été envoyé à {email}. Vérifiez votre boîte mail (et vos spams).
            </div>
          )}

          <div className="text-sm text-black">
            <span className="text-gray-500">Compte :</span>{' '}
            <button
              type="button"
              onClick={() => { setStep('email'); setError(null); setErrorCode(null); setResendState('idle'); setLoading(false) }}
              disabled={loading}
              className="font-medium underline disabled:opacity-50 disabled:cursor-not-allowed"
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

          <label htmlFor="rememberMe" className="flex items-center gap-2 text-sm text-black cursor-pointer select-none">
            <input
              id="rememberMe"
              type="checkbox"
              name="rememberMe"
              defaultChecked
              className="h-4 w-4 rounded border-gray-300 text-black focus:ring-2 focus:ring-black focus:ring-offset-0"
            />
            <span>Rester connecté</span>
          </label>

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
  )
}
