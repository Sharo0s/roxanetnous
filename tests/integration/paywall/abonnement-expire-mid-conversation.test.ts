import { describe, it, expect, afterAll, beforeAll } from 'vitest'
import { sendMessage } from '@/app/actions/messages'
import { mockSupabaseSession } from '@/tests/integration/_lib/supabase-session-mock'
import {
  createTestUser,
  createTestSubscription,
  createTestAccompagneProfile,
  createTestAccompagnanteProfile,
  createTestConversation,
  createTestMessage,
  cleanupAllFixtures,
} from '@/tests/integration/_lib/fixtures'
import { getAdminClient } from '@/tests/integration/_lib/supabase-admin'

// T9 (epic-4.md AC3 #4) : abonnement expire en cours d'echange.
// (a) lecture historique OK (2 messages preexistants visibles), (b) sendMessage
// retourne erreur paywall, (c) count messages reste a 2 (aucune insertion).
// Story 7.A.5 (2026-05-14) : sendMessage utilise maintenant PAYWALL_GENERIC_ERROR
// 'Abonnement requis pour echanger des messages.' (cross-flow avec
// getOrCreateConversation*) pour eliminer le demi-oracle sur l'existence d'une
// conversation. Cf. message-unifie-anti-oracle.test.ts pour assertion croisee.
describe('paywall : abonnement expire mid-conversation (T9)', () => {
  beforeAll(async () => {
    await cleanupAllFixtures()
  })

  afterAll(async () => {
    await cleanupAllFixtures()
  })

  it("permet la lecture historique mais bloque l'envoi quand subscription expiree", async () => {
    const accompagne = await createTestUser('accompagne')
    const accompagneProfile = await createTestAccompagneProfile(accompagne.id)

    const aux = await createTestUser('accompagnant')
    const auxProfile = await createTestAccompagnanteProfile(aux.id)

    // Abonnement expire (current_period_end dans le passe).
    await createTestSubscription(accompagne.id, {
      status: 'active',
      expiresAt: new Date(Date.now() - 24 * 60 * 60 * 1000),
    })

    const conv = await createTestConversation(auxProfile.id, accompagneProfile.id)
    await createTestMessage(conv.id, accompagne.id, 'Premier message historique')
    await createTestMessage(conv.id, aux.id, 'Reponse historique')

    const supabase = getAdminClient()

    // (a) Lecture historique : 2 messages
    const { data: history } = await supabase
      .from('messages')
      .select('id, content')
      .eq('conversation_id', conv.id)
    expect(history?.length).toBe(2)

    // (b) sendMessage rejette pour paywall
    mockSupabaseSession(accompagne.id)
    const result = await sendMessage(conv.id, 'Tentative apres expiration')
    expect(result).toEqual({
      error: 'Abonnement requis pour echanger des messages.',
    })

    // (c) count messages reste a 2
    const { count } = await supabase
      .from('messages')
      .select('id', { count: 'exact', head: true })
      .eq('conversation_id', conv.id)
    expect(count).toBe(2)
  })
})
