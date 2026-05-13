import { describe, it, expect, afterAll, beforeAll } from 'vitest'
import { getOrCreateConversation } from '@/app/actions/messages'
import { mockSupabaseSession } from '@/tests/integration/_lib/supabase-session-mock'
import {
  createTestUser,
  createTestAccompagneProfile,
  createTestAccompagnanteProfile,
  cleanupAllFixtures,
} from '@/tests/integration/_lib/fixtures'

// T7 (epic-4.md AC3 #2) : utilisateur connecte sans subscriptions row active.
// -> retour { error: 'Abonnement requis pour contacter une accompagnante.' }
describe('paywall : connecte sans abonnement (T7)', () => {
  beforeAll(async () => {
    await cleanupAllFixtures()
  })

  afterAll(async () => {
    await cleanupAllFixtures()
  })

  it("retourne 'Abonnement requis...' pour un accompagne non abonne", async () => {
    const user = await createTestUser('accompagne')
    await createTestAccompagneProfile(user.id)

    // Une accompagnante cible existe (sinon le code n'atteindrait pas le paywall)
    const aux = await createTestUser('accompagnant')
    const auxProfile = await createTestAccompagnanteProfile(aux.id)

    mockSupabaseSession(user.id)

    const result = await getOrCreateConversation(auxProfile.id)
    expect(result).toEqual({
      error: 'Abonnement requis pour contacter une accompagnante.',
    })
  })
})
