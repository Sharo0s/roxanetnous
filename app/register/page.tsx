import { Suspense } from 'react'
import { RegisterForm } from '@/components/auth/register-form'

export default function RegisterPage() {
  return (
    <>
      <h1 className="sr-only">Créer un compte</h1>
      <Suspense>
        <RegisterForm />
      </Suspense>
    </>
  )
}
