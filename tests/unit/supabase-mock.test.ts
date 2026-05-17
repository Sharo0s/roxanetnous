// Tests Story 9.A.1 : garanties du helper `createSupabaseFromMock`.
// AC8 a-f : dispatch par table, défaut null, capture insert/update, chainable,
// table absente de `responses`.

import { describe, it, expect } from 'vitest'
import { createSupabaseFromMock } from './_lib/supabase-mock'

describe('createSupabaseFromMock', () => {
  it('(a) dispatch par table indépendant des appels intercalés', async () => {
    const { fromMock, calls } = createSupabaseFromMock({
      users: [
        { data: { id: 'u1' }, error: null },
        { data: { id: 'u2' }, error: null },
      ],
      subscriptions: [
        { data: { status: 'active' }, error: null },
      ],
    })

    const usersFirst = await fromMock('users').select().eq().maybeSingle()
    const subRow = await fromMock('subscriptions').select().eq().maybeSingle()
    const usersSecond = await fromMock('users').select().eq().maybeSingle()

    expect(usersFirst).toEqual({ data: { id: 'u1' }, error: null })
    expect(subRow).toEqual({ data: { status: 'active' }, error: null })
    expect(usersSecond).toEqual({ data: { id: 'u2' }, error: null })
    expect(calls).toEqual(['users', 'subscriptions', 'users'])
  })

  it('(b) défaut { data: null, error: null } si pool épuisé', async () => {
    const { fromMock } = createSupabaseFromMock({
      users: [{ data: { id: 'u1' }, error: null }],
    })

    await fromMock('users').maybeSingle()
    const overflow = await fromMock('users').maybeSingle()

    expect(overflow).toEqual({ data: null, error: null })
  })

  it('(c) capture insert accumule dans capturedInserts[table]', async () => {
    const { fromMock, capturedInserts } = createSupabaseFromMock()

    await fromMock('admin_actions_log').insert({ action_type: 'a1', target_id: 'x1' })
    await fromMock('admin_actions_log').insert({ action_type: 'a2', target_id: 'x2' })

    expect(capturedInserts.admin_actions_log).toHaveLength(2)
    expect(capturedInserts.admin_actions_log[0]).toMatchObject({ action_type: 'a1' })
    expect(capturedInserts.admin_actions_log[1]).toMatchObject({ action_type: 'a2' })
  })

  it('(d) capture update accumule { table, payload }', async () => {
    const { fromMock, capturedUpdates } = createSupabaseFromMock()

    fromMock('users').update({ parrainee_par: 'parrain-id' }).eq('id', 'filleul-id')
    fromMock('parrainages').update({ statut: 'abonnee' }).eq('id', 'p1')

    expect(capturedUpdates).toEqual([
      { table: 'users', payload: { parrainee_par: 'parrain-id' } },
      { table: 'parrainages', payload: { statut: 'abonnee' } },
    ])
  })

  it('(e) chaîne complète sans throw', async () => {
    const { fromMock } = createSupabaseFromMock({
      parrainages: [{ data: { id: 'p1' }, error: null }],
    })

    const builder = fromMock('parrainages')
    expect(() =>
      builder
        .select()
        .eq()
        .neq()
        .not()
        .is()
        .in()
        .order()
        .lte()
        .gte(),
    ).not.toThrow()

    const result = await builder.maybeSingle()
    expect(result).toEqual({ data: { id: 'p1' }, error: null })
  })

  it('(f) table absente de responses retourne { data: null, error: null }', async () => {
    const { fromMock } = createSupabaseFromMock({})

    const result = await fromMock('notifications_log').maybeSingle()
    expect(result).toEqual({ data: null, error: null })
  })

  it('insert chainable .select().single() retourne le pool de la table', async () => {
    const { fromMock, capturedInserts } = createSupabaseFromMock({
      parrainages: [{ data: { id: 'parrainage-new-id' }, error: null }],
    })

    const inserted = await fromMock('parrainages')
      .insert({ marraine_id: 'm1', filleule_id: 'f1' })
      .select()
      .single()

    expect(inserted).toEqual({ data: { id: 'parrainage-new-id' }, error: null })
    expect(capturedInserts.parrainages).toHaveLength(1)
  })
})
