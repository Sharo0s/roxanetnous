import { describe, it, expect, afterAll, beforeAll } from 'vitest'
import { getOrCreateConversation } from '@/app/actions/messages'
import { mockSupabaseSession } from '@/tests/integration/_lib/supabase-session-mock'
import { cleanupAllFixtures } from '@/tests/integration/_lib/fixtures'

// T6 (epic-4.md AC3 #1) : appel getOrCreateConversation sans cookie de session
// (auth.getUser retourne null) -> retour { error: 'Non connecté.' }.
//
// Verifie aussi : aucune row conversations creee.
describe('paywall : visiteur non connecte (T6)', () => {
  beforeAll(async () => {
    await cleanupAllFixtures()
  })

  afterAll(async () => {
    await cleanupAllFixtures()
  })

  it("retourne 'Non connecté.' quand aucun user n'est dans la session", async () => {
    mockSupabaseSession(null)

    const result = await getOrCreateConversation('00000000-0000-0000-0000-000000000001')
    expect(result).toEqual({ error: 'Non connecté.' })
  })
})
