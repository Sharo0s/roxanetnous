import { createClient } from '@/lib/supabase/server'

export async function getUnreadCount(userId: string): Promise<number> {
  const supabase = await createClient()

  const { count } = await supabase
    .from('messages')
    .select('id', { count: 'exact', head: true })
    .neq('sender_id', userId)
    .is('read_at', null)

  return count || 0
}
