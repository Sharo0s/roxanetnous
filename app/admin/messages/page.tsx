import type { SupabaseClient } from '@supabase/supabase-js'
import { createClient } from '@/lib/supabase/server'
import Link from 'next/link'
import type { Database } from '@/types/supabase'

export default async function AdminMessagesPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return null

  // Story 4.6 (variante locale SCP) : cast localise au point d'appel.
  const supabaseAdmin = (await createClient({ serviceRole: true })) as unknown as SupabaseClient<Database>

  const { data: conversations } = await supabaseAdmin
    .from('conversations')
    .select(`
      id,
      last_message_at,
      accompagnante_id,
      admin_id,
      accompagnantes_profiles:accompagnante_id (
        user_id,
        users!user_id (first_name, last_name, email)
      )
    `)
    .not('admin_id', 'is', null)
    .order('last_message_at', { ascending: false, nullsFirst: false })

  const unreadCounts: Record<string, number> = {}
  if (conversations) {
    for (const conv of conversations) {
      const { count } = await supabaseAdmin
        .from('messages')
        .select('id', { count: 'exact', head: true })
        .eq('conversation_id', conv.id)
        .neq('sender_id', user.id)
        .is('read_at', null)
      unreadCounts[conv.id] = count || 0
    }
  }

  return (
    <div className="max-w-3xl mx-auto px-4 py-10 md:py-14">
      <header className="mb-8">
        <div className="text-xs uppercase tracking-[0.18em] text-kraft mb-2">Espace admin</div>
        <h1 className="text-3xl md:text-4xl italic text-gray-900 leading-tight">Messages avec les accompagnants</h1>
      </header>

      {!conversations || conversations.length === 0 ? (
        <div className="bg-white rounded-2xl border border-[#e8dfd2] p-10 text-center text-gray-500 italic">
          Aucune conversation active.
        </div>
      ) : (
        <ul className="space-y-2">
          {conversations.map((conv) => {
            const aux = conv.accompagnantes_profiles?.users
            const unread = unreadCounts[conv.id] || 0
            const fullName = `${aux?.first_name || ''} ${aux?.last_name || ''}`.trim() || 'Accompagnant'
            const initials = `${aux?.first_name?.[0] || ''}${aux?.last_name?.[0] || ''}`

            return (
              <li key={conv.id}>
                <Link
                  href={`/admin/messages/${conv.id}`}
                  className="flex items-center justify-between bg-white rounded-2xl border border-[#e8dfd2] px-5 py-4 hover:border-kraft transition gap-4"
                >
                  <div className="flex items-center gap-4 min-w-0 flex-1">
                    <div className="w-10 h-10 rounded-full bg-accent/30 flex items-center justify-center text-sm font-medium text-gray-900 flex-shrink-0" aria-hidden="true">
                      {initials || '·'}
                    </div>
                    <div className="min-w-0">
                      <p className="font-medium text-gray-900 truncate">{fullName}</p>
                      <p className="text-xs text-gray-500 mt-0.5">
                        {aux?.email}
                        {conv.last_message_at && (
                          <>
                            {' · '}
                            {new Date(conv.last_message_at).toLocaleDateString('fr-FR', {
                              day: 'numeric',
                              month: 'short',
                              hour: '2-digit',
                              minute: '2-digit',
                            })}
                          </>
                        )}
                      </p>
                    </div>
                  </div>
                  {unread > 0 && (
                    <span className="w-6 h-6 rounded-full bg-kraft text-white text-xs flex items-center justify-center font-medium flex-shrink-0" aria-label={`${unread} non lus`}>
                      {unread}
                    </span>
                  )}
                </Link>
              </li>
            )
          })}
        </ul>
      )}
    </div>
  )
}
