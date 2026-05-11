import { Suspense } from 'react'
import { RegisterForm } from '@/components/auth/register-form'

export default function RegisterPage() {
  return (
    <main
      id="main-content"
      tabIndex={-1}
      className="min-h-screen flex items-center justify-center p-4 bg-[#fefaf8] focus:outline-none"
    >
      <h1 className="sr-only">Créer un compte</h1>
      <Suspense>
        <RegisterForm />
      </Suspense>
    </main>
  )
}
