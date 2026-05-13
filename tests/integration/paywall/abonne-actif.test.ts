import { describe, it, expect, afterAll, beforeAll } from 'vitest'
import { getOrCreateConversation } from '@/app/actions/messages'
import { mockSupabaseSession } from '@/tests/integration/_lib/supabase-session-mock'
import {
  createTestUser,
  createTestSubscription,
  createTestAccompagneProfile,
  createTestAccompagnanteProfile,
  cleanupAllFixtures,
} from '@/tests/integration/_lib/fixtures'
import { getAdminClient } from '@/tests/integration/_lib/supabase-admin'

// T8 (epic-4.md AC3 #3) : utilisateur connecte avec subscription active +
// current_period_end > now() -> retour { conversationId } + row conversations creee.
describe('paywall : abonne actif (T8)', () => {
  beforeAll(async () => {
    await cleanupAllFixtures()
  })

  afterAll(async () => {
    await cleanupAllFixtures()
  })

  it('cree une conversation pour un accompagne abonne actif', async () => {
    const user = await createTestUser('accompagne')
    await createTestAccompagneProfile(user.id)
    await createTestSubscription(user.id, { status: 'active' })

    const aux = await createTestUser('accompagnante')
    const auxProfile = await createTestAccompagnanteProfile(aux.id)

    mockSupabaseSession(user.id)

    const result = await getOrCreateConversation(auxProfile.id)
    expect(result.error).toBeUndefined()
    expect(result.conversationId).toMatch(/^[0-9a-f-]{36}$/i)

    const supabase = getAdminClient()
    const { data: conv } = await supabase
      .from('conversations')
      .select('id, accompagnant_id')
      .eq('id', result.conversationId!)
      .single()
    expect(conv).not.toBeNull()
    expect(conv).toMatchObject({ accompagnant_id: auxProfile.id })
  })
})
