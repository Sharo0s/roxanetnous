import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import Link from 'next/link'
import { ChatWindow } from '@/components/messages/chat-window'
import { markMessagesAsRead } from '@/app/actions/messages'
import { AccompagnanteDashboardHeader } from '@/components/layout/accompagnante-dashboard-header'
import { AccompagneHeader } from '@/components/layout/accompagne-header'
import { getUnreadCount } from '@/lib/unread-count'
import { hasActiveSubscription } from '@/lib/subscription-helpers'

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
    .eq('id', id)
    .single()

  if (!conversation) redirect('/messages')

  // Verifier que l'utilisateur fait partie de la conversation
  const auxProfile = conversation.accompagnantes_profiles as any
  const benProfile = conversation.accompagnes_profiles as any
  const adminUserId = (conversation as any).admin_id as string | null
  const isAdminConv = !!adminUserId

  const isAux = auxProfile?.user_id === user.id
  const isBen = benProfile?.user_id === user.id
  const isAdminParticipant = adminUserId === user.id

  if (!isAux && !isBen && !isAdminParticipant) {
    redirect('/messages')
  }

  // Determiner l'interlocuteur a afficher
  let otherUser: { first_name?: string; last_name?: string } | null = null
  if (isAux) {
    otherUser = isAdminConv
      ? { first_name: 'Équipe', last_name: 'roxanetnous' }
      : (benProfile?.users || null)
  } else if (isBen) {
    otherUser = auxProfile?.users || null
  } else if (isAdminParticipant) {
    otherUser = auxProfile?.users || null
  }

  // Recuperer le lien profil de l'interlocuteur (si accompagnante) - jamais pour conv admin
  let otherProfileUrl: string | null = null
  if (!isAdminConv && userData.role === 'accompagne' && conversation.accompagnante_id) {
    const { data: auxAnnonce } = await supabase
      .from('annonces_accompagnantes')
      .select('id')
      .eq('accompagnante_id', conversation.accompagnante_id)
      .eq('status', 'publiee')
      .limit(1)
      .single()
    if (auxAnnonce) {
      otherProfileUrl = `/recherche/${auxAnnonce.id}`
    }
  }

  // Recuperer les messages existants
  const { data: messages } = await supabase
    .from('messages')
    .select('id, sender_id, content, created_at, read_at')
    .eq('conversation_id', id)
    .order('created_at', { ascending: true })

  // Marquer les messages comme lus
  await markMessagesAsRead(id)

  const unreadCount = await getUnreadCount(user.id)
  // Story 3.6 : defense en profondeur paywall (D1 : skip si conversation contient un admin)
  const subscribed = await hasActiveSubscription(user.id)
  const conversationHasAdmin = isAdminConv

  const otherUserNameForHeading = isAdminConv && isAux
    ? 'Équipe roxanetnous'
    : `${otherUser?.first_name || ''} ${otherUser?.last_name || ''}`.trim() || 'votre interlocuteur'

  const isAccompagnante = userData.role === 'accompagnante'
  const otherInitials = `${otherUser?.first_name?.[0] || ''}${otherUser?.last_name?.[0] || ''}`

  return (
    <main id="main-content" tabIndex={-1} className="min-h-screen bg-[#faf7f2] flex flex-col focus:outline-none">
      <h1 className="sr-only">Conversation avec {otherUserNameForHeading}</h1>
      {isAccompagnante ? (
        <AccompagnanteDashboardHeader
          firstName={userData.first_name}
          lastName={userData.last_name}
          unreadCount={unreadCount}
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

      {/* Bandeau interlocuteur */}
      <div className="relative z-10 border-b border-[#e8dfd2] bg-[#faf7f2]">
        <div className="max-w-3xl mx-auto px-4 py-3 flex items-center gap-3">
          <Link
            href="/messages"
            className="inline-flex items-center gap-1.5 px-4 py-2 bg-white border border-[#e8dfd2] text-gray-700 rounded-full text-sm hover:border-kraft transition"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
            Messages
          </Link>

          {isAdminConv ? (
            <div className="inline-flex items-center gap-2.5 px-3 py-2 bg-white border border-[#e8dfd2] rounded-full">
              <span
                aria-hidden="true"
                className="w-7 h-7 rounded-full bg-gray-900 text-white flex items-center justify-center text-[10px] font-medium"
              >
                RN
              </span>
              <span className="text-sm font-medium text-gray-900">Équipe roxanetnous</span>
            </div>
          ) : otherProfileUrl ? (
            <Link
              href={otherProfileUrl}
              className="inline-flex items-center gap-2.5 px-3 py-2 bg-white border border-[#e8dfd2] rounded-full hover:border-kraft transition"
            >
              <span
                aria-hidden="true"
                className="w-7 h-7 rounded-full bg-accent/30 text-gray-900 flex items-center justify-center text-[10px] font-medium"
              >
                {otherInitials}
              </span>
              <span className="text-sm font-medium text-gray-900">
                {otherUser?.first_name} {otherUser?.last_name}
              </span>
            </Link>
          ) : (
            <div className="inline-flex items-center gap-2.5 px-3 py-2 bg-white border border-[#e8dfd2] rounded-full">
              <span
                aria-hidden="true"
                className="w-7 h-7 rounded-full bg-accent/30 text-gray-900 flex items-center justify-center text-[10px] font-medium"
              >
                {otherInitials}
              </span>
              <span className="text-sm font-medium text-gray-900">
                {otherUser?.first_name} {otherUser?.last_name}
              </span>
            </div>
          )}
        </div>
      </div>

      <ChatWindow
        conversationId={id}
        currentUserId={user.id}
        initialMessages={messages || []}
        otherUserName={
          isAdminConv && isAux
            ? 'Équipe roxanetnous'
            : `${otherUser?.first_name || ''} ${otherUser?.last_name || ''}`
        }
        subscribed={subscribed}
        conversationHasAdmin={conversationHasAdmin}
      />
    </main>
  )
}
