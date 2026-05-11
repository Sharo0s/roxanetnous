import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import Link from 'next/link'
import { AccompagneDashboardHeader } from '@/components/layout/accompagne-dashboard-header'
import { LogoutButton } from '@/components/auth/logout-button'
import { getUnreadCount } from '@/lib/unread-count'
import { NouvelleAnnonceAccompagneForm } from '@/components/accompagne/nouvelle-annonce-form'
import { getCodesDepartementsOuverts } from '@/lib/departements'

export default async function NouvelleAnnonceAccompagne() {
  const supabase = await createClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: userData } = await supabase
    .from('users')
    .select('first_name, last_name, role')
    .eq('id', user.id)
    .single()

  if (!userData || userData.role !== 'accompagne') redirect('/')

  const unreadCount = await getUnreadCount(user.id)
  const departementsOuverts = await getCodesDepartementsOuverts()

  return (
    <main id="main-content" tabIndex={-1} className="min-h-screen bg-[#fefaf8] focus:outline-none">
      <AccompagneDashboardHeader
        firstName={userData.first_name}
        lastName={userData.last_name}
        unreadCount={unreadCount}
        currentPage="annonces"
      />

      <div className="max-w-3xl mx-auto px-4 py-10 md:py-14 relative z-10">

        <Link
          href="/accompagne/annonces"
          className="inline-flex items-center gap-1.5 text-sm text-gray-600 hover:text-gray-900 mb-6 transition"
        >
          <span aria-hidden="true">←</span> Mes annonces
        </Link>

        <header className="text-center mb-10">
          <div className="text-xs uppercase tracking-[0.18em] text-kraft mb-2">Votre espace</div>
          <h1 className="text-3xl md:text-4xl italic text-gray-900 leading-tight">Nouvelle annonce</h1>
          <p className="mt-3 text-sm text-gray-600">
            Décrivez vos besoins pour recevoir des candidatures d&apos;accompagnants.
          </p>
        </header>

        <NouvelleAnnonceAccompagneForm departementsOuverts={departementsOuverts} />

        <div className="mt-16 pt-6 border-t border-[#e8dfd2] flex flex-wrap justify-center items-center gap-x-6 gap-y-2 text-xs text-gray-500">
          <Link href="/cgu" className="hover:text-gray-800">Aide</Link>
          <span aria-hidden="true">·</span>
          <Link href="/politique-de-confidentialite" className="hover:text-gray-800">Confidentialité</Link>
          <span aria-hidden="true">·</span>
          <Link href="/cgu" className="hover:text-gray-800">Conditions</Link>
          <span aria-hidden="true">·</span>
          <LogoutButton />
        </div>

      </div>
    </main>
  )
}
