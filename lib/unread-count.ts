import { createClient } from '@/lib/supabase/server'

export async function getUnreadCount(userId: string): Promise<number> {
  const supabase = await createClient({ serviceRole: true })

  // Get conversation IDs where this user participates
  const { data: auxProfile } = await supabase
    .from('auxiliaires_profiles')
    .select('id')
    .eq('user_id', userId)
    .single()

  const { data: benProfile } = await supabase
    .from('beneficiaires_profiles')
    .select('id')
    .eq('user_id', userId)
    .single()

  const profileId = auxProfile?.id || benProfile?.id
  if (!profileId) return 0

  // Get conversations for this user
  let query = supabase.from('conversations').select('id')
  if (auxProfile) {
    query = query.eq('auxiliaire_id', auxProfile.id)
  } else {
    query = query.eq('beneficiaire_id', benProfile!.id)
  }
  const { data: conversations } = await query

  if (!conversations || conversations.length === 0) return 0

  const conversationIds = conversations.map((c) => c.id)

  const { count } = await supabase
    .from('messages')
    .select('id', { count: 'exact', head: true })
    .in('conversation_id', conversationIds)
    .neq('sender_id', userId)
    .is('read_at', null)

  return count || 0
}
