import { vi } from 'vitest'
import { getAdminClient } from './supabase-admin'
import { createClient } from '@/lib/supabase/server'

// Helper pour les tests paywall : remplace createClient() (lu par les server actions)
// par un client admin avec auth.getUser() surcharge pour retourner un user specifique.
//
// Pattern : vi.mock('@/lib/supabase/server', ...) est deja installe globalement dans
// setup.ts. Ce helper centralise la logique de "session simulee" pour eviter la
// duplication dans chaque test paywall.
export function mockSupabaseSession(userId: string | null): void {
  const adminClient = getAdminClient()

  // Patch auth.getUser pour retourner le user voulu sans dependre des cookies.
  const fakeAuth = {
    ...adminClient.auth,
    getUser: vi.fn().mockResolvedValue({
      data: {
        user: userId ? { id: userId, email: `user-${userId}@test.local` } : null,
      },
      error: null,
    }),
  }

  // Le proxy laisse passer toutes les operations (.from, .rpc, etc.) vers l'admin client
  // mais surcharge auth pour fournir une session simulee.
  const sessionClient = new Proxy(adminClient, {
    get(target, prop, receiver) {
      if (prop === 'auth') return fakeAuth
      return Reflect.get(target, prop, receiver)
    },
  })

  vi.mocked(createClient).mockResolvedValue(sessionClient as never)
}

// Reset : utile en beforeEach des tests paywall pour repartir de la mock createClient
// d'origine entre tests si necessaire.
export function resetSupabaseSessionMock(): void {
  vi.mocked(createClient).mockReset()
}
