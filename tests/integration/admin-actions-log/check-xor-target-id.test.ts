// Story 7.A.7 (F-Epic7-A7) : tests d integration BDD pour le CHECK XOR
// `target_id_xor` sur `admin_actions_log` ((target_id IS NULL) <> (target_id_text IS NULL)).
// AC13 : 4 cas (a-d) couvrant l invariant bout-en-bout sur Supabase local.
// AC14 : reuse pattern fixtures heritage 4.4 + 7.A.6 (createTestUser admin
// + cleanupAllFixtures + tracker admin_actions_log + service_role bypass RLS).
// AC15 : pas de regression sur tests integration existants (paywall, admin-messages,
// notifications-log).

import { afterAll, afterEach, describe, expect, it } from 'vitest'
import { randomUUID } from 'node:crypto'
import { createTestUser, cleanupAllFixtures } from '../_lib/fixtures'
import { getAdminClient } from '../_lib/supabase-admin'

// Tracker local pour les rows reussies (cas (a)+(b)) ; les cas (c)+(d) ne creent
// aucune row (rejet 23514 cote BDD). Cleanup en afterEach pour eviter pollution.
const localActionIds: string[] = []

async function cleanupLocalActions() {
  if (localActionIds.length === 0) return
  const supabase = getAdminClient()
  await supabase.from('admin_actions_log').delete().in('id', localActionIds)
  localActionIds.length = 0
}

describe('admin_actions_log - CHECK XOR target_id / target_id_text (story 7.A.7)', () => {
  afterEach(async () => {
    await cleanupLocalActions()
  })

  afterAll(async () => {
    await cleanupAllFixtures()
  })

  it('(a) cas nominal UUID : target_id=<uuid>, target_id_text=null -> 1 row inseree', async () => {
    const admin = await createTestUser('admin')
    const target = await createTestUser('accompagnant')
    const actionType = `test_xor_uuid-${randomUUID().slice(0, 8)}`

    const supabase = getAdminClient()
    const { data, error } = await supabase
      .from('admin_actions_log')
      .insert({
        admin_id: admin.id,
        action_type: actionType,
        target_type: 'accompagnant',
        target_id: target.id,
        target_id_text: null,
      })
      .select('id, target_id, target_id_text')
      .single()

    expect(error).toBeNull()
    expect(data).not.toBeNull()
    expect(data?.target_id).toBe(target.id)
    expect(data?.target_id_text).toBeNull()

    if (data) localActionIds.push(data.id)
  })

  it('(b) cas nominal TEXT : target_id=null, target_id_text="<code>" -> 1 row inseree', async () => {
    const admin = await createTestUser('admin')
    const actionType = `test_xor_text-${randomUUID().slice(0, 8)}`

    const supabase = getAdminClient()
    const { data, error } = await supabase
      .from('admin_actions_log')
      .insert({
        admin_id: admin.id,
        action_type: actionType,
        target_type: 'departement',
        target_id: null,
        target_id_text: '29',
      })
      .select('id, target_id, target_id_text')
      .single()

    expect(error).toBeNull()
    expect(data).not.toBeNull()
    expect(data?.target_id).toBeNull()
    expect(data?.target_id_text).toBe('29')

    if (data) localActionIds.push(data.id)
  })

  it('(c) cas violation les deux NULL : target_id=null, target_id_text=null -> rejet 23514', async () => {
    const admin = await createTestUser('admin')
    const actionType = `test_xor_both_null-${randomUUID().slice(0, 8)}`

    const supabase = getAdminClient()
    const { data, error } = await supabase
      .from('admin_actions_log')
      .insert({
        admin_id: admin.id,
        action_type: actionType,
        target_type: 'invalid',
        target_id: null,
        target_id_text: null,
      })
      .select('id')
      .single()

    expect(data).toBeNull()
    expect(error).not.toBeNull()
    expect(error?.code).toBe('23514')
    expect(error?.message).toContain('target_id_xor')
  })

  it('(d) cas violation les deux SET : target_id=<uuid>, target_id_text="both-set" -> rejet 23514', async () => {
    const admin = await createTestUser('admin')
    const target = await createTestUser('accompagnant')
    const actionType = `test_xor_both_set-${randomUUID().slice(0, 8)}`

    const supabase = getAdminClient()
    const { data, error } = await supabase
      .from('admin_actions_log')
      .insert({
        admin_id: admin.id,
        action_type: actionType,
        target_type: 'invalid',
        target_id: target.id,
        target_id_text: 'both-set',
      })
      .select('id')
      .single()

    expect(data).toBeNull()
    expect(error).not.toBeNull()
    expect(error?.code).toBe('23514')
    expect(error?.message).toContain('target_id_xor')
  })
})
