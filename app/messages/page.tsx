import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import Link from 'next/link'
import { AccompagnanteDashboardHeader } from '@/components/layout/accompagnante-dashboard-header'
import { AccompagneDashboardHeader } from '@/components/layout/accompagne-dashboard-header'
import { LogoutButton } from '@/components/auth/logout-button'
import { getUnreadCount } from '@/lib/unread-count'

type ConvProfileWithUser = {
  users: { first_name: string | null; last_name: string | null } | null
} | null

export default async function MessagesPage() {
  const supabase = await createClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: userData } = await supabase
    .from('users')
    .select('first_name, last_name, role')
    .eq('id', user.id)
    .single()

  if (!userData) redirect('/')

  // Recuperer le profil selon le role
  let profileId: string | null = null

  if (userData.role === 'accompagnante') {
    const { data: profile } = await supabase
      .from('accompagnantes_profiles')
      .select('id')
      .eq('user_id', user.id)
      .single()
    profileId = profile?.id || null
  } else if (userData.role === 'accompagne') {
    const { data: profile } = await supabase
      .from('accompagnes_profiles')
      .select('id')
      .eq('user_id', user.id)
      .single()
    profileId = profile?.id || null
  }

  if (!profileId) redirect(userData.role === 'accompagnante' ? '/accompagnante/dashboard' : '/accompagne/dashboard')

  // Recuperer les conversations (inclut les conversations admin cote accompagnante)
  const profileField = userData.role === 'accompagnante' ? 'accompagnante_id' : 'accompagne_id'

  const { data: conversations } = await supabase
    .from('conversations')
    .select(`
      id,
      last_message_at,
      accompagnante_id,
      accompagne_id,
      admin_id,
      accompagnantes_profiles:accompagnante_id (
        user_id,
        users:user_id (first_name, last_name)
      ),
      accompagnes_profiles:accompagne_id (
        user_id,
        users:user_id (first_name, last_name)
      ),
      admin:admin_id (first_name, last_name)
    `)
    .eq(profileField, profileId)
    .order('last_message_at', { ascending: false })

  // Compter les messages non lus par conversation
  const unreadCounts: Record<string, number> = {}
  if (conversations) {
    for (const conv of conversations) {
      const { count } = await supabase
        .from('messages')
        .select('id', { count: 'exact', head: true })
        .eq('conversation_id', conv.id)
        .neq('sender_id', user.id)
        .is('read_at', null)
      unreadCounts[conv.id] = count || 0
    }
  }

  const unreadCount = await getUnreadCount(user.id)
  const isAccompagnante = userData.role === 'accompagnante'

  return (
    <main id="main-content" tabIndex={-1} className="min-h-screen bg-[#fefaf8] focus:outline-none">
      {isAccompagnante ? (
        <AccompagnanteDashboardHeader
          firstName={userData.first_name}
          lastName={userData.last_name}
          unreadCount={unreadCount}
          currentPage="messages"
        />
      ) : (
        <AccompagneDashboardHeader
          firstName={userData.first_name}
          lastName={userData.last_name}
          unreadCount={unreadCount}
          currentPage="messages"
        />
      )}

      <div className="max-w-3xl mx-auto px-4 py-10 md:py-14 relative z-10">

        {/* TITRE EDITORIAL */}
        <header className="text-center mb-10">
          <div className="text-xs uppercase tracking-[0.18em] text-kraft mb-2">
            {isAccompagnante ? 'Mon espace' : 'Votre espace'}
          </div>
          <h1 className="text-3xl md:text-4xl italic text-gray-900 leading-tight">Messages</h1>
          <p className="mt-3 text-sm text-gray-600">
            Vos échanges avec les {isAccompagnante ? 'accompagnés' : 'accompagnants'}.
          </p>
        </header>

        {!conversations || conversations.length === 0 ? (
          <div className="bg-white rounded-2xl border border-[#e8dfd2] p-12 text-center">
            <h2 className="italic text-xl text-gray-900 mb-2">Aucune conversation pour le moment.</h2>
            {userData.role === 'accompagne' && (
              <p className="text-sm text-gray-600 mt-2">
                <Link href="/recherche" className="text-kraft underline hover:text-gray-900">
                  Rechercher un accompagnant
                </Link>
              </p>
            )}
          </div>
        ) : (
          <ul className="space-y-2">
            {conversations.map((conv: any) => {
              const isAdminConv = !!conv.admin_id
              const unread = unreadCounts[conv.id] || 0

              let displayName: string
              let initials: string
              let isTeam = false

              if (isAdminConv) {
                // Cote accompagnante : l'interlocuteur est l'equipe
                // Cote admin (theoriquement non atteint ici car admin utilise /admin/messages)
                isTeam = true
                displayName = 'Équipe roxanetnous'
                initials = 'RN'
              } else if (userData.role === 'accompagnante') {
                const profile = conv.accompagnes_profiles as unknown as ConvProfileWithUser
                const u = profile?.users
                displayName = `${u?.first_name || ''} ${u?.last_name || ''}`.trim() || 'Accompagné'
                initials = `${u?.first_name?.[0] || ''}${u?.last_name?.[0] || ''}`
              } else {
                const profile = conv.accompagnantes_profiles as unknown as ConvProfileWithUser
                const u = profile?.users
                displayName = `${u?.first_name || ''} ${u?.last_name || ''}`.trim() || 'Accompagnant'
                initials = `${u?.first_name?.[0] || ''}${u?.last_name?.[0] || ''}`
              }

              return (
                <li key={conv.id}>
                  <Link
                    href={`/messages/${conv.id}`}
                    className="flex items-center justify-between bg-white rounded-2xl border border-[#e8dfd2] px-5 py-4 hover:border-kraft transition gap-4"
                  >
                    <div className="flex items-center gap-4 min-w-0 flex-1">
                      <div
                        className={`w-10 h-10 rounded-full flex items-center justify-center text-sm font-medium flex-shrink-0 ${
                          isTeam
                            ? 'bg-gray-900 text-white'
                            : 'bg-accent/30 text-gray-900'
                        }`}
                        aria-hidden="true"
                      >
                        {initials || '·'}
                      </div>
                      <div className="min-w-0">
                        <p className="font-medium text-gray-900 truncate">{displayName}</p>
                        <p className="text-xs text-gray-500 mt-0.5">
                          {conv.last_message_at
                            ? new Date(conv.last_message_at).toLocaleDateString('fr-FR', {
                                day: 'numeric',
                                month: 'short',
                                hour: '2-digit',
                                minute: '2-digit',
                              })
                            : 'Nouvelle conversation'}
                        </p>
                      </div>
                    </div>
                    {unread > 0 && (
                      <span
                        className="w-6 h-6 rounded-full bg-kraft text-white text-xs flex items-center justify-center font-medium flex-shrink-0"
                        aria-label={`${unread} non lus`}
                      >
                        {unread}
                      </span>
                    )}
                  </Link>
                </li>
              )
            })}
          </ul>
        )}

        {/* FOOTER */}
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
