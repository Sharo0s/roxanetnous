import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import Link from 'next/link'
import { ChatWindow } from '@/components/messages/chat-window'
import { markMessagesAsRead } from '@/app/actions/messages'

export default async function AdminConversationPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const supabaseAdmin = await createClient({ serviceRole: true })

  const { data: conversation } = await supabaseAdmin
    .from('conversations')
    .select(`
      id,
      accompagnante_id,
      admin_id,
      accompagnantes_profiles:accompagnante_id (
        user_id,
        users:user_id (first_name, last_name, email)
      )
    `)
    .eq('id', id)
    .single()

  if (!conversation || !conversation.admin_id) redirect('/admin/messages')

  const aux = (conversation.accompagnantes_profiles as any)?.users
  const fullName = `${aux?.first_name || ''} ${aux?.last_name || ''}`.trim() || 'Accompagnante'

  const { data: messages } = await supabaseAdmin
    .from('messages')
    .select('id, sender_id, content, created_at, read_at')
    .eq('conversation_id', id)
    .order('created_at', { ascending: true })

  await markMessagesAsRead(id)

  return (
    <div className="flex flex-col flex-1">
      <h1 className="sr-only">Conversation admin avec {fullName}</h1>
      <div className="max-w-3xl mx-auto w-full px-4 py-3 flex items-center gap-2">
        <Link href="/admin/messages" className="inline-flex items-center gap-2 px-4 h-[52px] bg-accent text-black rounded-xl text-base font-medium btn-hover transition">
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
          </svg>
          Messages
        </Link>
        <span className="inline-flex items-center gap-3 px-4 h-[52px] bg-black text-white rounded-xl text-base font-medium">
          <span className="w-9 h-9 rounded-full bg-gray-600 flex items-center justify-center text-sm font-bold text-white">
            {aux?.first_name?.[0]}{aux?.last_name?.[0]}
          </span>
          {fullName}
        </span>
      </div>

      <ChatWindow
        conversationId={id}
        currentUserId={user.id}
        initialMessages={messages || []}
        otherUserName={fullName}
      />
    </div>
  )
}
