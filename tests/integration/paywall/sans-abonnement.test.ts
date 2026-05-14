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
// -> retour { error: PAYWALL_GENERIC_ERROR }
// Story 5.B.1 (2026-05-13) a unifie le message paywall messagerie sur les 3 server
// actions (PAYWALL_GENERIC_ERROR) pour empecher l'oracle d'enumeration du role.
// Story 7.A.1 (2026-05-13) aligne ce test avec le message unifie (l'ancien literal
// 'contacter une accompagnante' tombait sous le coup du garde-fou check-oracle-paywall).
// Story 7.A.5 (2026-05-14) reformule le literal en 'Abonnement requis pour echanger
// des messages.' (wording cadrage epic-7.md plus generique, couvre ouverture + envoi)
// et l'etend a sendMessage (cf. message-unifie-anti-oracle.test.ts pour le test cross-flow).
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
      error: 'Abonnement requis pour echanger des messages.',
    })
  })
})
