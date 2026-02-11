import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import Link from 'next/link'
import { ChatWindow } from '@/components/messages/chat-window'
import { markMessagesAsRead } from '@/app/actions/messages'

export default async function ConversationPage({
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

  if (!userData) redirect('/')

  // Recuperer la conversation avec les participants
  const { data: conversation } = await supabase
    .from('conversations')
    .select(`
      id,
      auxiliaire_id,
      beneficiaire_id,
      auxiliaires_profiles:auxiliaire_id (
        user_id,
        users:user_id (first_name, last_name)
      ),
      beneficiaires_profiles:beneficiaire_id (
        user_id,
        users:user_id (first_name, last_name)
      )
    `)
    .eq('id', id)
    .single()

  if (!conversation) redirect('/messages')

  // Verifier que l'utilisateur fait partie de la conversation
  const auxProfile = conversation.auxiliaires_profiles as any
  const benProfile = conversation.beneficiaires_profiles as any

  if (auxProfile?.user_id !== user.id && benProfile?.user_id !== user.id) {
    redirect('/messages')
  }

  const otherUser = auxProfile?.user_id === user.id
    ? benProfile?.users
    : auxProfile?.users

  // Recuperer les messages existants
  const { data: messages } = await supabase
    .from('messages')
    .select('id, sender_id, content, created_at, read_at')
    .eq('conversation_id', id)
    .order('created_at', { ascending: true })

  // Marquer les messages comme lus
  await markMessagesAsRead(id)

  const dashboardUrl = userData.role === 'auxiliaire' ? '/auxiliaire/dashboard' : '/beneficiaire/dashboard'

  return (
    <main className="min-h-screen bg-gray-50 flex flex-col">
      <header className="bg-white border-b">
        <div className="max-w-3xl mx-auto px-4 py-4 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Link href="/messages" className="text-sm text-gray-500 hover:text-black">
              Retour
            </Link>
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-full bg-gray-200 flex items-center justify-center text-xs font-bold text-gray-600">
                {otherUser?.first_name?.[0]}{otherUser?.last_name?.[0]}
              </div>
              <span className="font-medium text-gray-900">
                {otherUser?.first_name} {otherUser?.last_name}
              </span>
            </div>
          </div>
          <Link href={dashboardUrl} className="text-xl font-bold text-black">
            roxanetnous
          </Link>
        </div>
      </header>

      <ChatWindow
        conversationId={id}
        currentUserId={user.id}
        initialMessages={messages || []}
        otherUserName={`${otherUser?.first_name || ''} ${otherUser?.last_name || ''}`}
      />
    </main>
  )
}
