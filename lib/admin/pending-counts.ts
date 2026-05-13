import type { SupabaseClient } from '@supabase/supabase-js'
import { createClient } from '@/lib/supabase/server'
import type { Database } from '@/types/supabase'

export type AdminPendingCounts = {
  utilisateurs: number
  signalements: number
  parrainages: number
  messages: number
}

const EMPTY: AdminPendingCounts = {
  utilisateurs: 0,
  signalements: 0,
  parrainages: 0,
  messages: 0,
}

export async function getAdminPendingCounts(adminUserId: string): Promise<AdminPendingCounts> {
  const supabase = (await createClient({ serviceRole: true })) as unknown as SupabaseClient<Database>

  const [utilisateursRes, signalementsRes, parrainagesRes, messagesRes] = await Promise.all([
    supabase
      .from('accompagnantes_profiles')
      .select('id', { count: 'exact', head: true })
      .eq('validation_status', 'en_attente'),
    supabase
      .from('signalements')
      .select('id', { count: 'exact', head: true })
      .eq('status', 'en_attente'),
    supabase
      .from('parrainages')
      .select('id', { count: 'exact', head: true })
      .not('flag_suspicion', 'is', null)
      .not('statut', 'in', '(bloque,fraude)'),
    supabase
      .from('messages')
      .select('id, conversations!inner(admin_id)', { count: 'exact', head: true })
      .is('read_at', null)
      .neq('sender_id', adminUserId)
      .not('conversations.admin_id', 'is', null),
  ])

  return {
    utilisateurs: utilisateursRes.count ?? 0,
    signalements: signalementsRes.count ?? 0,
    parrainages: parrainagesRes.count ?? 0,
    messages: messagesRes.count ?? 0,
  }
}

export function emptyAdminPendingCounts(): AdminPendingCounts {
  return { ...EMPTY }
}
