import type { Metadata } from 'next'
import { getAllDepartements } from '@/lib/departements'
import { WaitlistForm } from '@/components/waitlist/waitlist-form'

export const metadata: Metadata = {
  title: 'Waitlist — roxanetnous',
  description: "Recevez un email automatique a l'ouverture du service dans votre departement.",
}

type SearchParams = Promise<{ email?: string; code_departement?: string; role?: string }>

export default async function WaitlistPage({ searchParams }: { searchParams: SearchParams }) {
  const params = await searchParams
  const departements = await getAllDepartements()

  const initialRole = params.role && ['accompagnante', 'accompagne', 'visiteur'].includes(params.role)
    ? params.role
    : ''

  return (
    <main id="main-content" tabIndex={-1} className="min-h-screen kraft bg-kraft focus:outline-none">
      <div className="max-w-2xl mx-auto px-4 py-12 md:py-16">
        <h1 className="text-3xl md:text-4xl font-bold text-black mb-3">M&apos;inscrire a la waitlist</h1>
        <p className="text-base text-black mb-8">
          Indiquez votre email et le departement ou vous souhaitez utiliser roxanetnous. Nous vous enverrons un email a l&apos;ouverture du service.
        </p>
        <WaitlistForm
          initial={{
            email: params.email ?? '',
            codeDepartement: params.code_departement ?? '',
            role: initialRole,
          }}
          departements={departements}
        />
      </div>
    </main>
  )
}
