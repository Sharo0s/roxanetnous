import type { SupabaseClient } from '@supabase/supabase-js'
import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import Link from 'next/link'
import { ChatWindow } from '@/components/messages/chat-window'
import { markMessagesAsRead } from '@/app/actions/messages'
import type { Database } from '@/types/supabase'

export default async function AdminConversationPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  // Story 4.6 (variante locale SCP) : cast localise au point d'appel.
  const supabaseAdmin = (await createClient({ serviceRole: true })) as unknown as SupabaseClient<Database>

  const { data: conversation } = await supabaseAdmin
    .from('conversations')
    .select(`
      id,
      accompagnante_id,
      admin_id,
      accompagnantes_profiles:accompagnante_id (
        user_id,
        users!user_id (first_name, last_name, email)
      )
    `)
    .eq('id', id)
    .single()

  if (!conversation || !conversation.admin_id) redirect('/admin/messages')

  const aux = conversation.accompagnantes_profiles?.users
  const fullName = `${aux?.first_name || ''} ${aux?.last_name || ''}`.trim() || 'Accompagnant'

  const { data: messages } = await supabaseAdmin
    .from('messages')
    .select('id, sender_id, content, created_at, read_at')
    .eq('conversation_id', id)
    .order('created_at', { ascending: true })

  await markMessagesAsRead(id)

  return (
    <div className="flex flex-col flex-1">
      <h1 className="sr-only">Conversation admin avec {fullName}</h1>
      <div className="border-b border-[#e8dfd2] bg-[#faf7f2]">
        <div className="max-w-3xl mx-auto w-full px-4 py-3 flex items-center gap-3">
          <Link
            href="/admin/messages"
            className="inline-flex items-center gap-1.5 px-4 py-2 bg-white border border-[#e8dfd2] text-gray-700 rounded-full text-sm hover:border-kraft transition"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
            Messages
          </Link>
          <div className="inline-flex items-center gap-2.5 px-3 py-2 bg-white border border-[#e8dfd2] rounded-full">
            <span aria-hidden="true" className="w-7 h-7 rounded-full bg-accent/30 text-gray-900 flex items-center justify-center text-[10px] font-medium">
              {aux?.first_name?.[0]}{aux?.last_name?.[0]}
            </span>
            <span className="text-sm font-medium text-gray-900">{fullName}</span>
          </div>
        </div>
      </div>

      <ChatWindow
        conversationId={id}
        currentUserId={user.id}
        initialMessages={messages || []}
        otherUserName={fullName}
        subscribed
        conversationHasAdmin
      />
    </div>
  )
}
