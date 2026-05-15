import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import Link from 'next/link'
import { ModifierAnnonceForm } from '@/components/accompagnant/modifier-annonce-form'
import { AccompagnantDashboardHeader } from '@/components/layout/accompagnant-dashboard-header'
import { getUnreadCount } from '@/lib/unread-count'
import { getCodesDepartementsOuverts } from '@/lib/departements'

export default async function ModifierAnnoncePage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params
  const supabase = await createClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: userData } = await supabase
    .from('users')
    .select('first_name, last_name, role')
    .eq('id', user.id)
    .single()

  if (!userData || userData.role !== 'accompagnant') redirect('/')

  const { data: profile } = await supabase
    .from('accompagnants_profiles')
    .select('id')
    .eq('user_id', user.id)
    .single()

  if (!profile) redirect('/accompagnant/dashboard')

  const { data: annonce } = await supabase
    .from('annonces_accompagnants')
    .select('*')
    .eq('id', id)
    .eq('accompagnant_id', profile.id)
    .single()

  if (!annonce) redirect('/accompagnant/annonces')

  const unreadCount = await getUnreadCount(user.id)
  const departementsOuverts = await getCodesDepartementsOuverts()

  return (
    <main id="main-content" tabIndex={-1} className="min-h-screen bg-[#fefaf8] focus:outline-none">
      <AccompagnantDashboardHeader
        firstName={userData.first_name}
        lastName={userData.last_name}
        unreadCount={unreadCount}
        currentPage="annonces"
      />

      <div className="max-w-3xl mx-auto px-4 py-10 md:py-14 relative z-10">

        {/* Lien retour discret */}
        <Link
          href="/accompagnant/annonces"
          className="inline-flex items-center gap-1.5 text-sm text-gray-600 hover:text-gray-900 mb-6 transition"
        >
          <span aria-hidden="true">←</span> Mes annonces
        </Link>

        {/* TITRE EDITORIAL */}
        <header className="text-center mb-10">
          <div className="text-xs uppercase tracking-[0.18em] text-kraft mb-2">Mon espace</div>
          <h1 className="text-3xl md:text-4xl italic text-gray-900 leading-tight">Modifier l&apos;annonce</h1>
          <p className="mt-3 text-sm text-gray-600">
            Tenez vos informations à jour.
          </p>
        </header>

        <ModifierAnnonceForm annonce={annonce} departementsOuverts={departementsOuverts} />

        {/* FOOTER */}
        <div className="mt-16 pt-6 border-t border-[#e8dfd2] flex flex-wrap justify-center items-center gap-x-6 gap-y-2 text-xs text-gray-500">
          <Link href="/cgu" className="hover:text-gray-800">Aide</Link>
          <span aria-hidden="true">·</span>
          <Link href="/politique-de-confidentialite" className="hover:text-gray-800">Confidentialité</Link>
          <span aria-hidden="true">·</span>
          <Link href="/cgu" className="hover:text-gray-800">Conditions</Link>
        </div>

      </div>
    </main>
  )
}
