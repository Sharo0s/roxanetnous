import { ResetPasswordForm } from '@/components/auth/reset-password-form'

export default function ResetPasswordPage() {
  return (
    <main
      id="main-content"
      tabIndex={-1}
      className="min-h-screen flex items-center justify-center p-4 kraft bg-kraft focus:outline-none"
    >
      <h1 className="sr-only">Réinitialiser le mot de passe</h1>
      <ResetPasswordForm />
    </main>
  )
}
