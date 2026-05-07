import { describe, it, expect, afterAll, beforeAll } from 'vitest'
import { sendMessage } from '@/app/actions/messages'
import { mockSupabaseSession } from '@/tests/integration/_lib/supabase-session-mock'
import {
  createTestUser,
  createTestAccompagnanteProfile,
  cleanupAllFixtures,
} from '@/tests/integration/_lib/fixtures'
import { getAdminClient } from '@/tests/integration/_lib/supabase-admin'

// T10 (epic-4.md AC3 #5 + decouverte 2026-05-09 contrainte conversations_participant_xor) :
// La contrainte XOR impose qu'une conversation est SOIT accompagnante<->accompagne,
// SOIT accompagnante<->admin. Le pattern "admin bypass paywall" (messages.ts:240
// `if (!isAdmin && adminUserId === null)`) s'applique donc a l'accompagnante qui parle
// a l'admin (FR11quater - validation visio sans abonnement).
//
// Test : une accompagnante SANS abonnement peut envoyer un message dans une
// conversation admin pure (accompagnante_id + admin_id, accompagne_id NULL).
describe('paywall : admin bypass (T10)', () => {
  beforeAll(async () => {
    await cleanupAllFixtures()
  })

  afterAll(async () => {
    await cleanupAllFixtures()
  })

  it("permet a une accompagnante sans abonnement d envoyer un message dans une conversation admin", async () => {
    const aux = await createTestUser('accompagnante')
    const auxProfile = await createTestAccompagnanteProfile(aux.id)

    const admin = await createTestUser('admin')

    // Conversation admin pure : accompagnante_id + admin_id, accompagne_id NULL.
    // Pattern FR11quater : la convocation visio passe par cette conversation,
    // l'accompagnante n'a pas encore d'abonnement (validation en cours).
    const supabase = getAdminClient()
    const { data: conv, error } = await supabase
      .from('conversations')
      .insert({
        accompagnante_id: auxProfile.id,
        accompagne_id: null,
        admin_id: admin.id,
      })
      .select('id')
      .single()
    if (error || !conv) {
      throw new Error(`createTestConversation admin echec : ${error?.message}`)
    }

    mockSupabaseSession(aux.id)

    const result = await sendMessage(conv.id, 'Message accompagnante vers admin')
    expect(result).toEqual({})

    // Message effectivement insere
    const { data: msg } = await supabase
      .from('messages')
      .select('id, sender_id, content')
      .eq('conversation_id', conv.id)
      .eq('sender_id', aux.id)
      .single()
    expect(msg?.content).toBe('Message accompagnante vers admin')

    // Cleanup conversation directe (pas via tracker car insertion directe).
    await supabase.from('messages').delete().eq('conversation_id', conv.id)
    await supabase.from('conversations').delete().eq('id', conv.id)
  })
})
