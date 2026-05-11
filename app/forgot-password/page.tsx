import { ForgotPasswordForm } from '@/components/auth/forgot-password-form'

export default function ForgotPasswordPage() {
  return (
    <main
      id="main-content"
      tabIndex={-1}
      className="min-h-screen flex items-center justify-center p-4 bg-[#fefaf8] focus:outline-none"
    >
      <h1 className="sr-only">Mot de passe oublié</h1>
      <ForgotPasswordForm />
    </main>
  )
}
