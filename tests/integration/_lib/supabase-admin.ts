import { createClient as createSupabaseClient, type SupabaseClient } from '@supabase/supabase-js'

let cachedClient: SupabaseClient | null = null

// Singleton client Supabase admin pour les helpers fixtures.
// Utilise SUPABASE_SERVICE_ROLE_KEY pour bypasser RLS (insertion/cleanup directs).
// Le garde-fou anti-prod est dans tests/integration/setup.ts (refus si SUPABASE_URL non local).
export function getAdminClient(): SupabaseClient {
  if (cachedClient) return cachedClient

  const url = process.env.SUPABASE_URL ?? process.env.NEXT_PUBLIC_SUPABASE_URL
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY

  if (!url) {
    throw new Error(
      '[tests/integration] SUPABASE_URL absent : lancer supabase start puis exporter ' +
        'SUPABASE_URL=http://localhost:54321',
    )
  }
  if (!serviceRoleKey) {
    throw new Error(
      '[tests/integration] SUPABASE_SERVICE_ROLE_KEY absent : recuperer la valeur via ' +
        'supabase status puis exporter SUPABASE_SERVICE_ROLE_KEY=...',
    )
  }

  cachedClient = createSupabaseClient(url, serviceRoleKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  })
  return cachedClient
}
