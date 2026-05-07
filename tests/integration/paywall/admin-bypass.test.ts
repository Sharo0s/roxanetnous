import { describe, it, expect, afterAll, beforeAll } from 'vitest'
import { sendMessage } from '@/app/actions/messages'
import { mockSupabaseSession } from '@/tests/integration/_lib/supabase-session-mock'
import {
  createTestUser,
  createTestAccompagneProfile,
  createTestAccompagnanteProfile,
  createTestConversation,
  cleanupAllFixtures,
} from '@/tests/integration/_lib/fixtures'
import { getAdminClient } from '@/tests/integration/_lib/supabase-admin'

// T10 (epic-4.md AC3 #5) : conversation contenant admin_id NOT NULL.
// Un accompagne sans abonnement peut envoyer un message car le paywall est skippe
// quand un admin est present (D1 messages.ts:240).
describe('paywall : admin bypass (T10)', () => {
  beforeAll(async () => {
    await cleanupAllFixtures()
  })

  afterAll(async () => {
    await cleanupAllFixtures()
  })

  it('permet a un accompagne sans abonnement d envoyer un message si admin_id NOT NULL', async () => {
    const accompagne = await createTestUser('accompagne')
    const accompagneProfile = await createTestAccompagneProfile(accompagne.id)

    const aux = await createTestUser('accompagnante')
    const auxProfile = await createTestAccompagnanteProfile(aux.id)

    const admin = await createTestUser('admin')

    // Conversation avec admin_id present -> paywall skippe pour preserver canal support.
    const conv = await createTestConversation(auxProfile.id, accompagneProfile.id, {
      adminUserId: admin.id,
    })

    mockSupabaseSession(accompagne.id)

    const result = await sendMessage(conv.id, 'Message vers admin sans abonnement')
    expect(result).toEqual({})

    // Message effectivement insere
    const supabase = getAdminClient()
    const { data: msg } = await supabase
      .from('messages')
      .select('id, sender_id, content')
      .eq('conversation_id', conv.id)
      .eq('sender_id', accompagne.id)
      .single()
    expect(msg?.content).toBe('Message vers admin sans abonnement')
  })
})
