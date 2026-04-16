'use client'

import { useState, useRef, useEffect } from 'react'
import { useSearchParams } from 'next/navigation'
import { signup } from '@/app/actions/auth'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import Link from 'next/link'

type Step = 'role' | 'name' | 'email' | 'password'

const STEPS: Step[] = ['role', 'name', 'email', 'password']

export function RegisterForm() {
  const searchParams = useSearchParams()
  const initialRole = searchParams.get('role')
  const initialEmail = searchParams.get('email') || ''

  const [step, setStep] = useState<Step>(
    initialRole === 'accompagnante' || initialRole === 'accompagne' ? 'name' : 'role'
  )
  const [role, setRole] = useState<'accompagnante' | 'accompagne' | null>(
    initialRole === 'accompagnante' || initialRole === 'accompagne' ? initialRole : null
  )
  const [firstName, setFirstName] = useState('')
  const [lastName, setLastName] = useState('')
  const [email, setEmail] = useState(initialEmail)
  const [password, setPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const [emailSent, setEmailSent] = useState(false)

  const bottomRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    // Scroll vers le bas quand on passe à l'étape suivante
    setTimeout(() => {
      bottomRef.current?.scrollIntoView({ behavior: 'smooth', block: 'end' })
    }, 100)
  }, [step])

  function selectRole(r: 'accompagnante' | 'accompagne') {
    setRole(r)
    setStep('name')
  }

  function submitName(e: React.FormEvent) {
    e.preventDefault()
    if (!firstName.trim() || !lastName.trim()) return
    setStep('email')
  }

  function submitEmail(e: React.FormEvent) {
    e.preventDefault()
    if (!email.trim()) return
    setStep('password')
  }

  async function submitPassword(e: React.FormEvent) {
    e.preventDefault()
    if (!password || password.length < 8) {
      setError('Le mot de passe doit contenir au moins 8 caractères.')
      return
    }
    setError(null)
    setLoading(true)

    const formData = new FormData()
    formData.set('email', email.trim())
    formData.set('password', password)
    formData.set('firstName', firstName.trim())
    formData.set('lastName', lastName.trim())
    formData.set('role', role!)

    const result = await signup(formData)
    if (result?.error) {
      setError(result.error)
      setLoading(false)
    } else if (result?.success) {
      setEmailSent(true)
      setLoading(false)
    }
  }

  const stepIndex = STEPS.indexOf(step)
  const isVisible = (s: Step) => STEPS.indexOf(s) <= stepIndex
  const isCurrent = (s: Step) => s === step

  if (emailSent) {
    return (
      <main className="min-h-screen flex items-center justify-center p-4 kraft bg-kraft">
        <div className="w-full max-w-md text-center relative z-10">
          <Link href="/" className="text-3xl font-bold text-black">
            roxanetnous
          </Link>
          <div className="mt-8 bg-white p-8 rounded-xl shadow-sm border border-accent">
            <h2 className="text-xl font-semibold text-black mb-4">
              Vérifiez votre email
            </h2>
            <p className="text-gray-600 mb-2">
              Un email de confirmation a été envoyé à :
            </p>
            <p className="font-medium text-black mb-6">{email}</p>
            <p className="text-sm text-black/50 mb-6">
              Cliquez sur le lien dans le mail pour activer votre compte, puis connectez-vous.
            </p>
            <Link
              href="/login"
              className="inline-block px-6 py-2.5 bg-accent text-black rounded-lg text-sm font-medium btn-hover transition"
            >
              Aller à la page de connexion
            </Link>
          </div>
        </div>
      </main>
    )
  }

  return (
    <main className="min-h-screen flex items-center justify-center p-4 kraft bg-kraft">
      <div className="w-full max-w-md relative z-10">
        <div className="text-center mb-8">
          <Link href="/" className="text-3xl font-bold text-black">
            roxanetnous
          </Link>
          <p className="mt-2 text-gray-600">Créez votre compte</p>
        </div>

        <div className="bg-white p-8 rounded-xl shadow-sm border space-y-6">
          {error && (
            <div className="p-3 rounded-lg bg-red-50 border border-red-200 text-red-700 text-sm animate-fade-in">
              {error}
            </div>
          )}

          {/* Step 1 : Role */}
          <div className="animate-fade-in">
            <label className="block text-sm font-medium text-gray-700 mb-3">
              Vous êtes
            </label>
            <div className="grid grid-cols-2 gap-3">
              <button
                type="button"
                onClick={() => selectRole('accompagnante')}
                className={`p-4 rounded-lg border-2 text-left transition ${
                  role === 'accompagnante'
                    ? 'border-accent bg-accent text-black'
                    : 'border-gray-200 hover:border-accent'
                }`}
              >
                <p className="font-semibold text-sm">Vos compétences méritent que vous soyez trouvé(e)</p>
                <p className={`text-xs mt-1 ${role === 'accompagnante' ? 'text-black/50' : 'text-gray-500'}`}>
                  Au bon moment, au bon endroit
                </p>
              </button>
              <button
                type="button"
                onClick={() => selectRole('accompagne')}
                className={`p-4 rounded-lg border-2 text-left transition ${
                  role === 'accompagne'
                    ? 'border-accent bg-accent text-black'
                    : 'border-gray-200 hover:border-accent'
                }`}
              >
                <p className="font-semibold text-sm">Choisissez votre accompagnant(e)</p>
                <p className={`text-xs mt-1 ${role === 'accompagne' ? 'text-black/50' : 'text-gray-500'}`}>
                  On s'occupe de tout
                </p>
              </button>
            </div>
          </div>

          {/* Step 2 : Prenom / Nom */}
          {isVisible('name') && (
            <form onSubmit={submitName} className="space-y-4 animate-fade-in">
              <div className="grid grid-cols-2 gap-4">
                <Input
                  name="firstName"
                  label="Prénom"
                  placeholder="Prénom"
                  required
                  value={firstName}
                  onChange={(e) => setFirstName(e.target.value)}
                  autoFocus={isCurrent('name')}
                />
                <Input
                  name="lastName"
                  label="Nom"
                  placeholder="Nom"
                  required
                  value={lastName}
                  onChange={(e) => setLastName(e.target.value)}
                />
              </div>
              {isCurrent('name') && (
                <Button type="submit" className="w-full">
                  Continuer
                </Button>
              )}
            </form>
          )}

          {/* Step 3 : Email */}
          {isVisible('email') && (
            <form onSubmit={submitEmail} className="space-y-4 animate-fade-in">
              <Input
                name="email"
                type="email"
                label="Adresse email"
                placeholder="vous@exemple.com"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                autoFocus={isCurrent('email')}
              />
              {isCurrent('email') && (
                <Button type="submit" className="w-full">
                  Continuer
                </Button>
              )}
            </form>
          )}

          {/* Step 4 : Mot de passe */}
          {isVisible('password') && (
            <form onSubmit={submitPassword} className="space-y-4 animate-fade-in">
              <Input
                name="password"
                type="password"
                label="Mot de passe"
                placeholder="8 caractères minimum"
                minLength={8}
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                autoFocus={isCurrent('password')}
              />
              <Button type="submit" className="w-full" disabled={loading}>
                {loading ? 'Création du compte...' : 'Créer mon compte'}
              </Button>
            </form>
          )}

          <div ref={bottomRef} />
        </div>
      </div>
    </main>
  )
}
