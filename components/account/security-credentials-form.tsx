'use client'

import { useState } from 'react'
import { updateEmailFromProfile, updatePasswordFromProfile } from '@/app/actions/auth'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'

type Props = {
  currentEmail: string
}

export function SecurityCredentialsForm({ currentEmail }: Props) {
  return (
    <section aria-labelledby="security-heading" className="mt-12 pt-10 border-t border-[#e8dfd2]">
      <header className="text-center mb-6">
        <h2 id="security-heading" className="text-xl italic text-gray-900 mb-2">Identifiants et sécurité</h2>
        <p className="text-sm text-gray-600 max-w-md mx-auto">
          Modifiez votre adresse email ou votre mot de passe. Votre mot de passe actuel sera demandé pour confirmer.
        </p>
      </header>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <EmailCard currentEmail={currentEmail} />
        <PasswordCard />
      </div>
    </section>
  )
}

function EmailCard({ currentEmail }: { currentEmail: string }) {
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState(false)
  const [loading, setLoading] = useState(false)

  async function handleSubmit(formData: FormData) {
    setError(null)
    setSuccess(false)
    setLoading(true)
    const result = await updateEmailFromProfile(formData)
    setLoading(false)
    if (result.error) {
      setError(result.error)
    } else {
      setSuccess(true)
    }
  }

  return (
    <div className="bg-white rounded-xl border border-[#e8dfd2] p-6">
      <h3 className="font-semibold text-gray-900 mb-1">Changer mon email</h3>
      <p className="text-xs text-gray-600 mb-4">
        Email actuel : <span className="font-medium text-gray-800">{currentEmail}</span>
      </p>

      {error && (
        <div role="alert" className="mb-4 p-3 rounded-lg bg-red-50 border border-red-200 text-red-700 text-sm">
          {error}
        </div>
      )}
      {success && (
        <div role="status" className="mb-4 p-3 rounded-lg bg-gray-50 border border-gray-200 text-gray-700 text-sm">
          Un lien de confirmation a été envoyé à votre nouvelle adresse. Tant que vous n&apos;avez pas cliqué dessus, votre email de connexion reste inchangé.
        </div>
      )}

      <form action={handleSubmit} className="space-y-4">
        <Input
          name="email"
          type="email"
          label="Nouvelle adresse email"
          autoComplete="email"
          required
        />
        <Input
          name="currentPassword"
          type="password"
          label="Mot de passe actuel"
          autoComplete="current-password"
          required
        />
        <Button type="submit" disabled={loading} className="w-full">
          {loading ? 'Envoi...' : 'Envoyer le lien de confirmation'}
        </Button>
      </form>
    </div>
  )
}

function PasswordCard() {
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState(false)
  const [loading, setLoading] = useState(false)
  const [formKey, setFormKey] = useState(0)

  async function handleSubmit(formData: FormData) {
    setError(null)
    setSuccess(false)
    setLoading(true)
    const result = await updatePasswordFromProfile(formData)
    setLoading(false)
    if (result.error) {
      setError(result.error)
    } else {
      setSuccess(true)
      setFormKey((k) => k + 1)
    }
  }

  return (
    <div className="bg-white rounded-xl border border-[#e8dfd2] p-6">
      <h3 className="font-semibold text-gray-900 mb-1">Changer mon mot de passe</h3>
      <p className="text-xs text-gray-600 mb-4">8 caractères minimum.</p>

      {error && (
        <div role="alert" className="mb-4 p-3 rounded-lg bg-red-50 border border-red-200 text-red-700 text-sm">
          {error}
        </div>
      )}
      {success && (
        <div role="status" className="mb-4 p-3 rounded-lg bg-gray-50 border border-gray-200 text-gray-700 text-sm">
          Mot de passe mis à jour.
        </div>
      )}

      <form key={formKey} action={handleSubmit} className="space-y-4">
        <Input
          name="currentPassword"
          type="password"
          label="Mot de passe actuel"
          autoComplete="current-password"
          required
        />
        <Input
          name="password"
          type="password"
          label="Nouveau mot de passe"
          minLength={8}
          autoComplete="new-password"
          required
        />
        <Input
          name="passwordConfirm"
          type="password"
          label="Confirmer le nouveau mot de passe"
          minLength={8}
          autoComplete="new-password"
          required
        />
        <Button type="submit" disabled={loading} className="w-full">
          {loading ? 'Mise à jour...' : 'Mettre à jour le mot de passe'}
        </Button>
      </form>
    </div>
  )
}
