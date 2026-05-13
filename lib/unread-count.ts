import { createClient } from '@/lib/supabase/server'

export async function getUnreadCount(userId: string): Promise<number> {
  const supabase = await createClient({ serviceRole: true })

  const { data: userData } = await supabase
    .from('users')
    .select('role')
    .eq('id', userId)
    .single()

  const role = userData?.role

  const { data: auxProfile } = await supabase
    .from('accompagnants_profiles')
    .select('id')
    .eq('user_id', userId)
    .single()

  const { data: benProfile } = await supabase
    .from('accompagnes_profiles')
    .select('id')
    .eq('user_id', userId)
    .single()

  const conversationIds: string[] = []

  if (auxProfile) {
    const { data } = await supabase
      .from('conversations')
      .select('id')
      .eq('accompagnant_id', auxProfile.id)
    for (const c of data || []) conversationIds.push(c.id)
  }

  if (benProfile) {
    const { data } = await supabase
      .from('conversations')
      .select('id')
      .eq('accompagne_id', benProfile.id)
    for (const c of data || []) conversationIds.push(c.id)
  }

  if (role === 'admin') {
    const { data } = await supabase
      .from('conversations')
      .select('id')
      .eq('admin_id', userId)
    for (const c of data || []) conversationIds.push(c.id)
  }

  if (conversationIds.length === 0) return 0

  const { count } = await supabase
    .from('messages')
    .select('id', { count: 'exact', head: true })
    .in('conversation_id', conversationIds)
    .neq('sender_id', userId)
    .is('read_at', null)

  return count || 0
}
