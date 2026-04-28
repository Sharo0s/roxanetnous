import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import Link from 'next/link'
import { ParrainageView } from '@/components/accompagnante/parrainage-view'
import { AccompagnanteHeader } from '@/components/layout/accompagnante-header'
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

  if (!userData || userData.role !== 'accompagnante') redirect('/')

  const { data: profile } = await supabase
    .from('accompagnantes_profiles')
    .select('validation_status')
    .eq('user_id', user.id)
    .single()

  if (profile?.validation_status !== 'valide') {
    redirect('/accompagnante/dashboard')
  }

  const { data: parrainageRow } = await supabase
    .from('parrainages_codes')
    .select('code, compteur_confirmes, total_recompenses')
    .eq('user_id', user.id)
    .maybeSingle()

  if (!parrainageRow?.code) {
    redirect('/accompagnante/dashboard')
  }

  const { data: filleulesData } = await supabase
    .from('parrainages')
    .select('filleule_id, statut, filleule_inscrite_at, filleule_abonnee_at, users!parrainages_filleule_id_fkey(first_name)')
    .eq('marraine_id', user.id)
    .in('statut', ['inscrite', 'abonnee', 'confirme'])
    .order('filleule_inscrite_at', { ascending: false })
    .limit(50)

  const filleules = (filleulesData || []).map((row) => {
    const usersJoin = row.users as unknown as { first_name: string | null } | { first_name: string | null }[] | null
    const firstName = Array.isArray(usersJoin)
      ? usersJoin[0]?.first_name ?? null
      : usersJoin?.first_name ?? null
    return {
      firstName,
      statut: row.statut as FilleuleStatut,
      inscriteAt: row.filleule_inscrite_at as string,
      abonneeAt: row.filleule_abonnee_at as string | null,
    }
  })

  const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || 'https://roxanetnous.fr'
  const unreadCount = await getUnreadCount(user.id)

  return (
    <main className="min-h-screen kraft bg-kraft">
      <AccompagnanteHeader
        userId={user.id}
        unreadCount={unreadCount}
        firstName={userData.first_name || ''}
        lastName={userData.last_name || ''}
      />

      <div className="relative z-10 max-w-5xl mx-auto px-4 py-8">
        <div className="mb-6">
          <Link
            href="/accompagnante/dashboard"
            className="text-sm text-gray-600 hover:text-black transition"
          >
            &larr; Retour au tableau de bord
          </Link>
          <h1 className="text-3xl font-bold text-black mt-2">Mon parrainage</h1>
          <p className="text-gray-600 mt-1">
            Partagez votre code et suivez vos récompenses.
          </p>
        </div>

        <ParrainageView
          code={parrainageRow.code}
          baseUrl={baseUrl}
          compteur={parrainageRow.compteur_confirmes ?? 0}
          totalRecompenses={parrainageRow.total_recompenses ?? 0}
          filleules={filleules}
        />
      </div>
    </main>
  )
}
