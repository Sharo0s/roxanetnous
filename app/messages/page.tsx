import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import Link from 'next/link'
import { AccompagnanteHeader } from '@/components/layout/accompagnante-header'
import { AccompagneHeader } from '@/components/layout/accompagne-header'
import { getUnreadCount } from '@/lib/unread-count'

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

  // Recuperer les conversations
  const profileField = userData.role === 'accompagnante' ? 'accompagnante_id' : 'accompagne_id'

  const { data: conversations } = await supabase
    .from('conversations')
    .select(`
      id,
      last_message_at,
      accompagnante_id,
      accompagne_id,
      accompagnantes_profiles:accompagnante_id (
        user_id,
        users:user_id (first_name, last_name)
      ),
      accompagnes_profiles:accompagne_id (
        user_id,
        users:user_id (first_name, last_name)
      )
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

  const dashboardUrl = userData.role === 'accompagnante' ? '/accompagnante/dashboard' : '/accompagne/dashboard'
  const unreadCount = await getUnreadCount(user.id)

  return (
    <main className="min-h-screen kraft bg-kraft">
      {userData.role === 'accompagnante' ? (
        <AccompagnanteHeader
          userId={user.id}
          unreadCount={unreadCount}
          firstName={userData.first_name}
          lastName={userData.last_name}
          currentPage="messages"
        />
      ) : (
        <AccompagneHeader
          userId={user.id}
          unreadCount={unreadCount}
          firstName={userData.first_name}
          lastName={userData.last_name}
          currentPage="messages"
        />
      )}

      <div className="max-w-3xl mx-auto px-4 py-8 relative z-10">
        <h2 className="text-2xl font-bold text-gray-900 mb-6">Messages</h2>

        {!conversations || conversations.length === 0 ? (
          <div className="bg-white rounded-xl border p-8 text-center">
            <p className="text-gray-500">Aucune conversation pour le moment.</p>
            {userData.role === 'accompagne' && (
              <Link href="/recherche" className="text-sm text-black underline mt-2 inline-block">
                Rechercher une accompagnante
              </Link>
            )}
          </div>
        ) : (
          <div className="space-y-2">
            {conversations.map((conv: any) => {
              const otherUser = userData.role === 'accompagnante'
                ? (conv.accompagnes_profiles as any)?.users
                : (conv.accompagnantes_profiles as any)?.users
              const unread = unreadCounts[conv.id] || 0

              return (
                <Link
                  key={conv.id}
                  href={`/messages/${conv.id}`}
                  className="flex items-center justify-between bg-white rounded-xl border p-4 hover:border-accent transition"
                >
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-full bg-gray-200 flex items-center justify-center text-sm font-bold text-gray-600">
                      {otherUser?.first_name?.[0]}{otherUser?.last_name?.[0]}
                    </div>
                    <div>
                      <p className="font-medium text-gray-900">
                        {otherUser?.first_name} {otherUser?.last_name}
                      </p>
                      <p className="text-xs text-gray-400">
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
                    <span className="w-6 h-6 rounded-full bg-accent text-black text-xs flex items-center justify-center font-medium">
                      {unread}
                    </span>
                  )}
                </Link>
              )
            })}
          </div>
        )}
      </div>
    </main>
  )
}
