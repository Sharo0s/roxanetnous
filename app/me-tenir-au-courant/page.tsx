import type { Metadata } from 'next'
import { getAllDepartements } from '@/lib/departements'
import { NotificationsOuvertureForm } from '@/components/notifications-ouverture/form'

export const metadata: Metadata = {
  title: 'Me tenir au courant — roxanetnous',
  description: "Recevez un email automatique a l'ouverture du service dans votre departement.",
}

type SearchParams = Promise<{ email?: string; code_departement?: string; role?: string }>

export default async function MeTenirAuCourantPage({ searchParams }: { searchParams: SearchParams }) {
  const params = await searchParams
  const departements = await getAllDepartements()

  const initialRole = params.role && ['accompagnant', 'accompagne', 'visiteur'].includes(params.role)
    ? params.role
    : ''

  return (
    <main id="main-content" tabIndex={-1} className="min-h-screen bg-[#fefaf8] focus:outline-none">
      <div className="max-w-2xl mx-auto px-4 py-12 md:py-16">
        <header className="text-center mb-10">
          <span className="inline-block text-[11px] uppercase tracking-[0.18em] text-kraft font-medium mb-2">
            Me tenir au courant
          </span>
          <h1 className="text-3xl md:text-4xl italic text-gray-900 leading-tight mb-3">
            Me tenir au courant
          </h1>
          <p className="text-gray-600 text-sm md:text-base max-w-lg mx-auto">
            Indiquez votre email et le département où vous souhaitez utiliser roxanetnous. Nous vous enverrons un email à l&apos;ouverture du service.
          </p>
        </header>
        <NotificationsOuvertureForm
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
