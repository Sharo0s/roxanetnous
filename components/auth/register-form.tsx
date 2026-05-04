'use client'

import { useState, useRef, useEffect } from 'react'
import { useSearchParams } from 'next/navigation'
import { signup } from '@/app/actions/auth'
import { validateCode } from '@/app/actions/parrainage'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import Link from 'next/link'

type Step = 'role' | 'name' | 'parrainage' | 'email' | 'password'

const STEPS_ACCOMPAGNANTE: Step[] = ['role', 'name', 'parrainage', 'email', 'password']
const STEPS_ACCOMPAGNE: Step[] = ['role', 'name', 'email', 'password']

type ParrainageState =
  | { status: 'idle' }
  | { status: 'checking' }
  | { status: 'valid'; marraineFirstName: string }
  | {
      status: 'invalid'
      reason:
        | 'invalid_format'
        | 'invalid_chars'
        | 'unknown_code'
        | 'marraine_not_validated'
        | 'marraine_subscription_inactive'
        | 'rate_limited'
    }

const PARRAINAGE_ERRORS: Record<
  Exclude<ParrainageState, { status: 'idle' | 'checking' | 'valid' }>['reason'],
  string
> = {
  invalid_format: 'Format de code invalide (8 caractères attendus).',
  invalid_chars:
    'Caractères invalides : seuls les chiffres 2-9 et lettres A-Z (sans 0, O, 1, I, L) sont autorisés.',
  unknown_code: 'Ce code de parrainage est inconnu.',
  marraine_not_validated:
    'La marraine associée à ce code n\'est pas encore validée.',
  marraine_subscription_inactive:
    'Le compte de votre marraine est inactif (abonnement suspendu ou en attente de paiement). Demandez-lui de régulariser sa situation, puis réessayez avec son code.',
  rate_limited:
    'Trop de tentatives de validation depuis votre adresse. Patientez quelques minutes avant de réessayer.',
}

export function RegisterForm() {
  const searchParams = useSearchParams()
  const initialRole = searchParams.get('role')
  const initialEmail = searchParams.get('email') || ''
  const initialParrainageCode = (searchParams.get('parrainage_code') || '').toUpperCase()

  const [role, setRole] = useState<'accompagnante' | 'accompagne' | null>(
    initialRole === 'accompagnante' || initialRole === 'accompagne' ? initialRole : null
  )
  const stepsForRole = role === 'accompagnante' ? STEPS_ACCOMPAGNANTE : STEPS_ACCOMPAGNE
  const [step, setStep] = useState<Step>(
    initialRole === 'accompagnante' || initialRole === 'accompagne' ? 'name' : 'role'
  )
  const [firstName, setFirstName] = useState('')
  const [lastName, setLastName] = useState('')
  const [parrainageCode, setParrainageCode] = useState(initialParrainageCode)
  const [parrainageState, setParrainageState] = useState<ParrainageState>({
    status: 'idle',
  })
  const [email, setEmail] = useState(initialEmail)
  const [password, setPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const [emailSent, setEmailSent] = useState(false)

  const bottomRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    setTimeout(() => {
      bottomRef.current?.scrollIntoView({ behavior: 'smooth', block: 'end' })
    }, 100)
  }, [step])

  // Validation automatique du code pré-rempli depuis l'URL au mount
  useEffect(() => {
    if (initialParrainageCode && role === 'accompagnante') {
      void checkParrainageCode(initialParrainageCode)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  function selectRole(r: 'accompagnante' | 'accompagne') {
    setRole(r)
    setStep('name')
    // Reset état parrainage si changement de rôle (évite état résiduel après aller-retour)
    if (r === 'accompagne') {
      setParrainageCode('')
      setParrainageState({ status: 'idle' })
    }
  }

  function submitName(e: React.FormEvent) {
    e.preventDefault()
    if (!firstName.trim() || !lastName.trim()) return
    setStep(role === 'accompagnante' ? 'parrainage' : 'email')
  }

  async function checkParrainageCode(value: string) {
    const trimmed = value.trim()
    if (!trimmed) {
      setParrainageState({ status: 'idle' })
      return
    }
    setParrainageState({ status: 'checking' })
    const result = await validateCode(trimmed)
    if (result.valid) {
      setParrainageState({
        status: 'valid',
        marraineFirstName: result.marraineFirstName,
      })
    } else {
      setParrainageState({ status: 'invalid', reason: result.reason })
    }
  }

  async function continueAfterParrainage(e: React.FormEvent) {
    e.preventDefault()
    const trimmed = parrainageCode.trim()
    // Si l'utilisatrice a saisi un code mais ne l'a pas blur (validation onBlur),
    // l'état peut être 'idle' — on relance la validation avant de progresser
    // pour éviter d'envoyer un code non-vérifié au server action signup.
    if (trimmed && parrainageState.status === 'idle') {
      await checkParrainageCode(trimmed)
      return
    }
    if (trimmed && parrainageState.status === 'invalid') {
      return
    }
    setStep('email')
  }

  function skipParrainage() {
    setParrainageCode('')
    setParrainageState({ status: 'idle' })
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
    if (role === 'accompagnante' && parrainageCode.trim()) {
      formData.set('parrainage_code', parrainageCode.trim())
    }

    const result = await signup(formData)
    if (result?.error) {
      setError(result.error)
      setLoading(false)
    } else if (result?.success) {
      setEmailSent(true)
      setLoading(false)
    }
  }

  const stepIndex = stepsForRole.indexOf(step)
  const isVisible = (s: Step) =>
    stepsForRole.includes(s) && stepsForRole.indexOf(s) <= stepIndex
  const isCurrent = (s: Step) => s === step

  if (emailSent) {
    return (
      <main id="main-content" tabIndex={-1} className="min-h-screen flex items-center justify-center p-4 kraft bg-kraft focus:outline-none">
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
    <main id="main-content" tabIndex={-1} className="min-h-screen flex items-center justify-center p-4 kraft bg-kraft focus:outline-none">
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

          {/* Step 3 : Parrainage (accompagnante uniquement) */}
          {role === 'accompagnante' && isVisible('parrainage') && (
            <form
              onSubmit={continueAfterParrainage}
              className="space-y-4 animate-fade-in"
            >
              <div>
                <label
                  htmlFor="parrainage_code"
                  className="block text-sm font-medium text-gray-700 mb-1"
                >
                  Code de parrainage <span className="text-gray-400">(optionnel)</span>
                </label>
                <Input
                  id="parrainage_code"
                  name="parrainage_code"
                  placeholder="Ex : K7QM2X9P"
                  maxLength={10}
                  value={parrainageCode}
                  onChange={(e) => {
                    const v = e.target.value.toUpperCase()
                    setParrainageCode(v)
                    setParrainageState({ status: 'idle' })
                  }}
                  onBlur={(e) => {
                    void checkParrainageCode(e.target.value)
                  }}
                  autoFocus={isCurrent('parrainage')}
                />
                {parrainageState.status === 'checking' && (
                  <p className="mt-2 text-xs text-gray-500">Vérification du code...</p>
                )}
                {parrainageState.status === 'valid' && (
                  <p className="mt-2 text-xs text-gray-700">
                    Code valide{parrainageState.marraineFirstName
                      ? ` (parrainage par ${parrainageState.marraineFirstName})`
                      : ''}
                    . Votre marraine se porte garante — vous publierez vos annonces dès la souscription.
                  </p>
                )}
                {parrainageState.status === 'invalid' && (
                  <p className="mt-2 text-xs text-red-600">
                    {PARRAINAGE_ERRORS[parrainageState.reason]}
                  </p>
                )}
                <p className="mt-2 text-xs text-gray-500">
                  Si une accompagnante validée vous a transmis un code, saisissez-le ici. Sa garantie remplace la visio et la vérification de documents : vous publierez vos annonces dès la souscription.
                </p>
              </div>

              {isCurrent('parrainage') && (
                <div className="flex flex-col sm:flex-row gap-2">
                  <Button
                    type="submit"
                    className="w-full"
                    disabled={
                      parrainageCode.trim().length > 0 &&
                      (parrainageState.status === 'invalid' ||
                        parrainageState.status === 'checking')
                    }
                  >
                    Continuer
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    className="w-full"
                    onClick={skipParrainage}
                  >
                    Continuer sans code
                  </Button>
                </div>
              )}
            </form>
          )}

          {/* Step 4 : Email */}
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

          {/* Step 5 : Mot de passe */}
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
