import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import Link from 'next/link'
import { ParrainageView } from '@/components/accompagnant/parrainage-view'
import { AccompagnantDashboardHeader } from '@/components/layout/accompagnant-dashboard-header'
import { getUnreadCount } from '@/lib/unread-count'

type FilleuleStatut = 'inscrite' | 'abonnee' | 'confirme' | 'fraude' | 'bloque'

export default async function AccompagnanteParrainagePage() {
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
    .select('validation_status')
    .eq('user_id', user.id)
    .single()

  if (profile?.validation_status !== 'valide') {
    redirect('/accompagnant/dashboard')
  }

  const { data: parrainageRow } = await supabase
    .from('parrainages_codes')
    .select('code, compteur_confirmes, total_recompenses')
    .eq('user_id', user.id)
    .maybeSingle()

  if (!parrainageRow?.code) {
    redirect('/accompagnant/dashboard')
  }

  const { data: filleulesData } = await supabase
    .from('parrainages')
    .select('filleule_id, statut, filleule_inscrite_at, filleule_abonnee_at, users!parrainages_filleule_id_fkey(first_name, last_name)')
    .eq('marraine_id', user.id)
    .in('statut', ['inscrite', 'abonnee', 'confirme'])
    .order('filleule_inscrite_at', { ascending: false })
    .limit(50)

  const filleules = (filleulesData || []).map((row) => {
    const usersJoin = row.users as unknown as
      | { first_name: string | null; last_name: string | null }
      | { first_name: string | null; last_name: string | null }[]
      | null
    const firstName = Array.isArray(usersJoin)
      ? usersJoin[0]?.first_name ?? null
      : usersJoin?.first_name ?? null
    const lastName = Array.isArray(usersJoin)
      ? usersJoin[0]?.last_name ?? null
      : usersJoin?.last_name ?? null
    return {
      firstName,
      lastName,
      statut: row.statut as FilleuleStatut,
      inscriteAt: row.filleule_inscrite_at as string,
      abonneeAt: row.filleule_abonnee_at as string | null,
    }
  })

  const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || 'https://roxanetnous.fr'
  const unreadCount = await getUnreadCount(user.id)

  return (
    <main id="main-content" tabIndex={-1} className="min-h-screen bg-[#fefaf8] focus:outline-none">
      <AccompagnantDashboardHeader
        firstName={userData.first_name || ''}
        lastName={userData.last_name || ''}
        unreadCount={unreadCount}
        currentPage="parrainage"
      />

      <div className="max-w-3xl mx-auto px-4 py-10 md:py-14 relative z-10">

        {/* TITRE EDITORIAL */}
        <header className="text-center mb-10">
          <div className="text-xs uppercase tracking-[0.18em] text-kraft mb-2">Mon espace</div>
          <h1 className="text-3xl md:text-4xl italic text-gray-900 leading-tight">Mon parrainage</h1>
          <p className="mt-3 text-sm text-gray-600">
            Partagez votre code, accueillez de nouveaux accompagnants.
          </p>
        </header>

        <ParrainageView
          code={parrainageRow.code}
          baseUrl={baseUrl}
          compteur={parrainageRow.compteur_confirmes ?? 0}
          totalRecompenses={parrainageRow.total_recompenses ?? 0}
          filleules={filleules}
        />

        {/* FOOTER coherent avec dashboard */}
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
