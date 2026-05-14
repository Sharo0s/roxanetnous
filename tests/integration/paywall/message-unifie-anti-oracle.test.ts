import { describe, it, expect, afterAll, beforeAll } from 'vitest'
import {
  getOrCreateConversation,
  getOrCreateConversationAsAccompagnante,
  sendMessage,
} from '@/app/actions/messages'
import { mockSupabaseSession } from '@/tests/integration/_lib/supabase-session-mock'
import {
  createTestUser,
  createTestAccompagneProfile,
  createTestAccompagnanteProfile,
  createTestConversation,
  createTestSubscription,
  cleanupAllFixtures,
} from '@/tests/integration/_lib/fixtures'

// Story 7.A.5 (2026-05-14) : assertion cross-flow anti-oracle.
// Les 3 server actions paywall messagerie (getOrCreateConversation,
// getOrCreateConversationAsAccompagnante, sendMessage) doivent retourner
// strictement le meme literal et la meme shape JSON pour qu'un attaquant
// connecte non-abonne ne puisse pas distinguer le role de la cible ni
// l'existence d'une conversation en comparant les reponses.
//
// Heritage : pattern Story 7.A.4 (JSON.stringify comparaison entre flows)
// + pattern Story 5.B.1 (literal partage PAYWALL_GENERIC_ERROR).
describe('paywall : message unifie anti-oracle (Story 7.A.5)', () => {
  const EXPECTED_PAYWALL_ERROR = 'Abonnement requis pour echanger des messages.'

  beforeAll(async () => {
    await cleanupAllFixtures()
  })

  afterAll(async () => {
    await cleanupAllFixtures()
  })

  it('retourne un literal et une shape identiques sur les 3 server actions paywall', async () => {
    // -- Setup (a) : accompagne non-abonne + accompagnant cible --
    const accompagneA = await createTestUser('accompagne')
    await createTestAccompagneProfile(accompagneA.id)
    const accompagnantA = await createTestUser('accompagnant')
    const accompagnantProfileA = await createTestAccompagnanteProfile(accompagnantA.id)

    // -- Setup (b) : accompagnant non-abonne + accompagne cible --
    const accompagnantB = await createTestUser('accompagnant')
    await createTestAccompagnanteProfile(accompagnantB.id)
    const accompagneB = await createTestUser('accompagne')
    const accompagneProfileB = await createTestAccompagneProfile(accompagneB.id)

    // -- Setup (c) : accompagne abonne expire + conversation deja existante --
    const accompagneC = await createTestUser('accompagne')
    const accompagneProfileC = await createTestAccompagneProfile(accompagneC.id)
    const accompagnantC = await createTestUser('accompagnant')
    const accompagnantProfileC = await createTestAccompagnanteProfile(accompagnantC.id)
    // Subscription expiree pour que hasActiveSubscription renvoie false sur le
    // sender mais que `subscriptions` row existe (case "abonnement expire").
    await createTestSubscription(accompagneC.id, {
      status: 'active',
      expiresAt: new Date(Date.now() - 24 * 60 * 60 * 1000),
    })
    const conv = await createTestConversation(accompagnantProfileC.id, accompagneProfileC.id)

    // -- (a) Appel getOrCreateConversation (caller = accompagne non-abonne) --
    mockSupabaseSession(accompagneA.id)
    const resA = await getOrCreateConversation(accompagnantProfileA.id)

    // -- (b) Appel getOrCreateConversationAsAccompagnante (caller = accompagnant non-abonne) --
    mockSupabaseSession(accompagnantB.id)
    const resB = await getOrCreateConversationAsAccompagnante(accompagneProfileB.id)

    // -- (c) Appel sendMessage (caller = accompagne participant non-abonne) --
    mockSupabaseSession(accompagneC.id)
    const resC = await sendMessage(conv.id, 'tentative')

    // -- Assertions individuelles : literal et shape --
    expect(resA).toEqual({ error: EXPECTED_PAYWALL_ERROR })
    expect(Object.keys(resA).length).toBe(1)
    expect('conversationId' in resA).toBe(false)

    expect(resB).toEqual({ error: EXPECTED_PAYWALL_ERROR })
    expect(Object.keys(resB).length).toBe(1)
    expect('conversationId' in resB).toBe(false)

    expect(resC).toEqual({ error: EXPECTED_PAYWALL_ERROR })
    expect(Object.keys(resC).length).toBe(1)
    expect('conversationId' in resC).toBe(false)

    // -- Assertion croisee (d) : JSON.stringify strictement identique --
    // Contrat anti-oracle : un attaquant comparant les 3 reponses ne peut
    // distinguer ni le role de la cible ni l'existence d'une conversation.
    const strA = JSON.stringify(resA)
    const strB = JSON.stringify(resB)
    const strC = JSON.stringify(resC)
    expect(strA).toBe(strB)
    expect(strB).toBe(strC)
  })
})
