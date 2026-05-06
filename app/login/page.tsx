import { LoginForm } from '@/components/auth/login-form'

export default function LoginPage() {
  return (
    <main
      id="main-content"
      tabIndex={-1}
      className="min-h-screen flex items-center justify-center p-4 kraft bg-kraft focus:outline-none"
    >
      <h1 className="sr-only">Se connecter</h1>
      <LoginForm />
    </main>
  )
}
