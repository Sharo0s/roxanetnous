import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import { createClient as createSupabaseClient } from '@supabase/supabase-js'
import type { Database } from '@/types/supabase'
import {
  createTestUser,
  createTestAccompagnanteProfile,
  createTestAccompagneProfile,
  createTestConversation,
  createTestMessage,
  cleanupAllFixtures,
} from '@/tests/integration/_lib/fixtures'
import { getAdminClient } from '@/tests/integration/_lib/supabase-admin'

// Story 7.A.4 : RPC `get_admin_conversations_with_unread` aggregation 1-round-trip.
// 5 cas (a-e) couvrant : visibilite admin, filtre admin_id IS NOT NULL, pagination,
// unread=0, garde-fou is_admin() bloquant.
//
// Service_role bypass RLS mais EXPOSE le check is_admin() interne (auth.uid()=null
// -> is_admin() false -> exception 42501). Pour tester (a)-(d) on doit donc passer
// une session authentifiee admin via signInWithPassword + client anon.

describe('admin-messages : RPC get_admin_conversations_with_unread (T-7A4)', () => {
  beforeAll(async () => {
    await cleanupAllFixtures()
  })

  afterAll(async () => {
    await cleanupAllFixtures()
  })

  // Helper local : retourne un client Supabase authentifie comme `user` via password.
  // Pas de cookies/session Next.js : on s'appuie sur signInWithPassword direct sur
  // l'API auth Supabase, ce qui est suffisant pour exposer auth.uid() cote PostgREST/RPC.
  async function authenticatedClientFor(email: string, password: string) {
    const url = process.env.SUPABASE_URL ?? process.env.NEXT_PUBLIC_SUPABASE_URL
    const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
    if (!url || !anonKey) {
      throw new Error(
        '[7.A.4 tests] SUPABASE_URL ou NEXT_PUBLIC_SUPABASE_ANON_KEY absent : ' +
          'requis pour signer un client authenticated (cf. integration-tests.yml).',
      )
    }
    const client = createSupabaseClient<Database>(url, anonKey, {
      auth: { autoRefreshToken: false, persistSession: false },
    })
    const { error } = await client.auth.signInWithPassword({ email, password })
    if (error) throw new Error(`signInWithPassword echec : ${error.message}`)
    return client
  }

  it('(a) admin voit toutes les conversations admin avec unread_count correct', async () => {
    const admin = await createTestUser('admin')
    const aux1 = await createTestUser('accompagnant')
    const aux2 = await createTestUser('accompagnant')
    const aux3 = await createTestUser('accompagnant')
    const acc = await createTestUser('accompagne')

    const aux1Profile = await createTestAccompagnanteProfile(aux1.id)
    const aux2Profile = await createTestAccompagnanteProfile(aux2.id)
    const aux3Profile = await createTestAccompagnanteProfile(aux3.id)
    const accProfile = await createTestAccompagneProfile(acc.id)

    // 3 conversations admin avec chacune 1 message non-lu (sender = aux, read_at = null).
    const conv1 = await createTestConversation(aux1Profile.id, accProfile.id, { adminUserId: admin.id })
    const conv2 = await createTestConversation(aux2Profile.id, accProfile.id, { adminUserId: admin.id })
    const conv3 = await createTestConversation(aux3Profile.id, accProfile.id, { adminUserId: admin.id })
    await createTestMessage(conv1.id, aux1.id, 'msg unread 1')
    await createTestMessage(conv2.id, aux2.id, 'msg unread 2')
    await createTestMessage(conv3.id, aux3.id, 'msg unread 3')

    // 1 conversation hors-admin (accompagnant <-> accompagne directe) : ne doit PAS apparaitre.
    const aux4 = await createTestUser('accompagnant')
    const aux4Profile = await createTestAccompagnanteProfile(aux4.id)
    const conv4 = await createTestConversation(aux4Profile.id, accProfile.id, { adminUserId: null })
    await createTestMessage(conv4.id, aux4.id, 'msg hors admin')

    const adminClient = await authenticatedClientFor(admin.email, admin.password)
    const { data: rows, error } = await adminClient.rpc('get_admin_conversations_with_unread', {
      p_current_user_id: admin.id,
      p_limit: 100,
      p_offset: 0,
    })

    expect(error).toBeNull()
    expect(rows).not.toBeNull()
    expect(rows!.length).toBe(3)
    for (const row of rows!) {
      expect(Number(row.unread_count)).toBe(1)
      expect([conv1.id, conv2.id, conv3.id]).toContain(row.conversation_id)
    }
  })

  it('(b) filtre WHERE admin_id IS NOT NULL exclut les conversations hors-admin', async () => {
    const admin = await createTestUser('admin')
    const aux = await createTestUser('accompagnant')
    const acc = await createTestUser('accompagne')
    const auxProfile = await createTestAccompagnanteProfile(aux.id)
    const accProfile = await createTestAccompagneProfile(acc.id)

    // Une conversation accompagnant <-> accompagne (admin_id = NULL).
    await createTestConversation(auxProfile.id, accProfile.id, { adminUserId: null })

    const adminClient = await authenticatedClientFor(admin.email, admin.password)
    const { data: rows, error } = await adminClient.rpc('get_admin_conversations_with_unread', {
      p_current_user_id: admin.id,
      p_limit: 100,
      p_offset: 0,
    })

    expect(error).toBeNull()
    expect(rows).not.toBeNull()
    expect(rows!.length).toBe(0)
  })

  it('(c) pagination : limit=5/offset=0 puis offset=5 puis offset=10 vide', async () => {
    const admin = await createTestUser('admin')
    const acc = await createTestUser('accompagne')
    const accProfile = await createTestAccompagneProfile(acc.id)

    // 10 accompagnants + 10 conversations admin.
    const convIds: string[] = []
    for (let i = 0; i < 10; i++) {
      const aux = await createTestUser('accompagnant')
      const auxProfile = await createTestAccompagnanteProfile(aux.id)
      const conv = await createTestConversation(auxProfile.id, accProfile.id, { adminUserId: admin.id })
      convIds.push(conv.id)
    }

    const adminClient = await authenticatedClientFor(admin.email, admin.password)

    const { data: page1 } = await adminClient.rpc('get_admin_conversations_with_unread', {
      p_current_user_id: admin.id,
      p_limit: 5,
      p_offset: 0,
    })
    const { data: page2 } = await adminClient.rpc('get_admin_conversations_with_unread', {
      p_current_user_id: admin.id,
      p_limit: 5,
      p_offset: 5,
    })
    const { data: page3 } = await adminClient.rpc('get_admin_conversations_with_unread', {
      p_current_user_id: admin.id,
      p_limit: 5,
      p_offset: 10,
    })

    expect(page1!.length).toBe(5)
    expect(page2!.length).toBe(5)
    expect(page3!.length).toBe(0)
    // Pas de chevauchement entre page1 et page2.
    const ids1 = new Set(page1!.map((r) => r.conversation_id))
    for (const r of page2!) {
      expect(ids1.has(r.conversation_id)).toBe(false)
    }
  })

  it('(d) unread_count=0 quand tous les messages sont read OU envoyes par l admin', async () => {
    const admin = await createTestUser('admin')
    const aux = await createTestUser('accompagnant')
    const acc = await createTestUser('accompagne')
    const auxProfile = await createTestAccompagnanteProfile(aux.id)
    const accProfile = await createTestAccompagneProfile(acc.id)
    const conv = await createTestConversation(auxProfile.id, accProfile.id, { adminUserId: admin.id })

    // Message envoye PAR l admin (sender_id = admin.id) : exclu du count.
    await createTestMessage(conv.id, admin.id, 'msg admin self')

    // Message envoye par aux mais marque read_at != null : exclu du count.
    const supabase = getAdminClient()
    const { data: msgRead } = await supabase
      .from('messages')
      .insert({ conversation_id: conv.id, sender_id: aux.id, content: 'lu', read_at: new Date().toISOString() })
      .select('id')
      .single()
    expect(msgRead).not.toBeNull()

    const adminClient = await authenticatedClientFor(admin.email, admin.password)
    const { data: rows } = await adminClient.rpc('get_admin_conversations_with_unread', {
      p_current_user_id: admin.id,
      p_limit: 100,
      p_offset: 0,
    })
    expect(rows!.length).toBe(1)
    expect(Number(rows![0]!.unread_count)).toBe(0)
  })

  it('(e) garde-fou is_admin() : un user accompagnant declenche exception 42501', async () => {
    const aux = await createTestUser('accompagnant')

    const auxClient = await authenticatedClientFor(aux.email, aux.password)
    const { data, error } = await auxClient.rpc('get_admin_conversations_with_unread', {
      p_current_user_id: aux.id,
      p_limit: 10,
      p_offset: 0,
    })

    expect(data).toBeNull()
    expect(error).not.toBeNull()
    expect(error!.code).toBe('42501')
    expect(error!.message).toMatch(/requires admin role/i)
  })
})
