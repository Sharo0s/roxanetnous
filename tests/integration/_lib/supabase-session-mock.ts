import { vi } from 'vitest'
import { getAdminClient } from './supabase-admin'
import { createClient } from '@/lib/supabase/server'

// Helper pour les tests paywall : remplace createClient() (lu par les server actions)
// par un client admin avec auth.getUser() surcharge pour retourner un user specifique.
//
// Pattern : vi.mock('@/lib/supabase/server', ...) est deja installe globalement dans
// setup.ts. Ce helper centralise la logique de "session simulee" pour eviter la
// duplication dans chaque test paywall.
//
// TRADEOFF DOCUMENTE (review code 2026-05-09 D1) : le Proxy ci-dessous retourne
// le client SERVICE-ROLE pour `.from()/.rpc()`. Cela bypass les RLS policies. Les
// tests paywall verifient donc les invariants metier APPLICATIFS (paywall via
// `hasActiveSubscription`, validation roles via `userData.role`, etc.), PAS les
// RLS BDD. Les RLS sont supposees correctes (testees indirectement en prod et via
// les migrations brownfield). Ce choix est explicite : si un bug paywall vient de
// l'absence d'une RLS, ces tests ne le verront pas. Pour tester les RLS, il
// faudrait creer une vraie session via auth.signInWithPassword + injection cookies
// dans next/headers mock — refacto reporte Epic 5+ si bug RLS reel observe.
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
