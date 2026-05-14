// Story 7.B.2 (F-Epic7-B2) : tests d integration BDD du cron purge-notifications.
// AC8 : 3 cas (a) seed old+recent, (b) re-run no-op, (c) seed sent_at IS NULL.
// AC10 : reuse pattern fixtures heritage 7.A.6 (cleanupAllFixtures + tracker
// local pour les rows notifications_log non-fixtures).

import { afterAll, afterEach, beforeAll, describe, expect, it } from 'vitest'
import { randomUUID } from 'node:crypto'
import { NextRequest } from 'next/server'
import { createTestUser, cleanupAllFixtures } from '../_lib/fixtures'
import { getAdminClient } from '../_lib/supabase-admin'

const ONE_DAY_MS = 24 * 60 * 60 * 1000

// Tracker local pour les rows notifications_log seedees directement (cleanup
// inter-cas pour eviter pollution dans la meme suite).
const seededIds: string[] = []

async function cleanupSeeded() {
  if (seededIds.length === 0) return
  const supabase = getAdminClient()
  await supabase.from('notifications_log').delete().in('id', seededIds)
  seededIds.length = 0
}

// Definit CRON_SECRET avant l import dynamique du SUT (le handler lit
// process.env.CRON_SECRET au runtime de chaque appel, donc tant que c est pose
// avant le GET, le test passe). On utilise une valeur fixe et explicite pour
// le test, sans interferer avec d eventuelles valeurs env CI (la verif egalite
// stricte n est pas affectee).
const TEST_CRON_SECRET = 'test-cron-secret-7b2'

beforeAll(() => {
  process.env.CRON_SECRET = TEST_CRON_SECRET
})

afterEach(async () => {
  await cleanupSeeded()
})

afterAll(async () => {
  await cleanupAllFixtures()
})

function buildAuthedRequest(): NextRequest {
  return new NextRequest('http://localhost/api/cron/purge-notifications', {
    headers: { authorization: `Bearer ${TEST_CRON_SECRET}` },
  })
}

describe('Cron purge-notifications (story 7.B.2)', () => {
  it('(a) seed 3 old + 3 recent : apres GET cron = 3 recents restent', async () => {
    const supabase = getAdminClient()
    const user = await createTestUser('accompagnant')
    const type = `purge-test-7b2-${randomUUID().slice(0, 8)}`
    const subjectPrefix = `Purge 7.B.2 ${randomUUID().slice(0, 6)}`

    const oldSentAt = new Date(Date.now() - 19 * 30.44 * ONE_DAY_MS).toISOString()
    const recentSentAt = new Date().toISOString()

    // 3 rows old (purgeables).
    const oldRows = await supabase
      .from('notifications_log')
      .insert(
        [1, 2, 3].map((n) => ({
          user_id: user.id,
          email: user.email,
          type,
          subject: `${subjectPrefix} old ${n}`,
          status: 'sent',
          sent_at: oldSentAt,
        })),
      )
      .select('id')
    expect(oldRows.error).toBeNull()
    const oldIds = (oldRows.data ?? []).map((r) => r.id)

    // 3 rows recent (a conserver).
    const recentRows = await supabase
      .from('notifications_log')
      .insert(
        [1, 2, 3].map((n) => ({
          user_id: user.id,
          email: user.email,
          type,
          subject: `${subjectPrefix} recent ${n}`,
          status: 'sent',
          sent_at: recentSentAt,
        })),
      )
      .select('id')
    expect(recentRows.error).toBeNull()
    const recentIds = (recentRows.data ?? []).map((r) => r.id)
    // Tracker pour cleanup (les recents survivent au cron donc on doit les supprimer).
    seededIds.push(...recentIds)

    // Import dynamique apres setup env (process.env.CRON_SECRET pose en beforeAll).
    const { GET } = await import('@/app/api/cron/purge-notifications/route')
    const response = await GET(buildAuthedRequest())
    expect(response.status).toBe(200)
    const body = (await response.json()) as {
      purgedCount: number
      deletedSent: number
      deletedAged: number
      cutoff: string
    }
    // purgedCount peut englober d'autres rows orphelines residentes en BDD
    // (cross-tests, BDD non vierge). On verifie >= 3 (les notres au minimum)
    // et on contrast en SELECTant precisement nos IDs old vs recent.
    expect(body.deletedSent).toBeGreaterThanOrEqual(3)

    // Verification : les 3 old ne sont plus la, les 3 recent oui.
    const allIds = [...oldIds, ...recentIds]
    const { data: survivors, error: errSurv } = await supabase
      .from('notifications_log')
      .select('id, sent_at')
      .in('id', allIds)
    expect(errSurv).toBeNull()
    const survivorIds = (survivors ?? []).map((r) => r.id)
    expect(survivorIds.sort()).toEqual([...recentIds].sort())
  })

  it('(b) re-run cron = no-op (purgedCount = 0 sur nos rows)', async () => {
    const supabase = getAdminClient()
    const user = await createTestUser('accompagnant')
    const type = `purge-test-7b2-${randomUUID().slice(0, 8)}`
    const subjectPrefix = `Purge 7.B.2 ${randomUUID().slice(0, 6)}`

    // Seed 2 old rows.
    const oldSentAt = new Date(Date.now() - 19 * 30.44 * ONE_DAY_MS).toISOString()
    const { error: insErr } = await supabase
      .from('notifications_log')
      .insert([
        { user_id: user.id, email: user.email, type, subject: `${subjectPrefix} old 1`, status: 'sent', sent_at: oldSentAt },
        { user_id: user.id, email: user.email, type, subject: `${subjectPrefix} old 2`, status: 'sent', sent_at: oldSentAt },
      ])
    expect(insErr).toBeNull()

    const { GET } = await import('@/app/api/cron/purge-notifications/route')

    // 1er run : doit purger nos 2 old (+ eventuellement d autres rows
    // orphelines residant en BDD).
    await GET(buildAuthedRequest())

    // Verifier que nos rows ne sont plus la.
    const { data: afterFirst } = await supabase
      .from('notifications_log')
      .select('id')
      .eq('user_id', user.id)
      .eq('type', type)
    expect(afterFirst).toHaveLength(0)

    // Snapshot count pre-2e run.
    const { count: countPre } = await supabase
      .from('notifications_log')
      .select('id', { count: 'exact', head: true })

    // 2e run : doit etre no-op (toutes rows eligibles deja purgees).
    const response2 = await GET(buildAuthedRequest())
    expect(response2.status).toBe(200)
    const body2 = (await response2.json()) as { purgedCount: number }
    expect(body2.purgedCount).toBe(0)

    const { count: countPost } = await supabase
      .from('notifications_log')
      .select('id', { count: 'exact', head: true })
    expect(countPost).toBe(countPre)
  })

  it('(c) sent_at IS NULL + created_at 19 mois old : 2 rows purgees (branche aged-null)', async () => {
    const supabase = getAdminClient()
    const user = await createTestUser('accompagnant')
    const type = `purge-test-7b2-${randomUUID().slice(0, 8)}`
    const subjectPrefix = `Purge 7.B.2 ${randomUUID().slice(0, 6)}`

    const oldCreatedAt = new Date(Date.now() - 19 * 30.44 * ONE_DAY_MS).toISOString()
    // Insert direct via service_role : sent_at IS NULL, created_at override.
    const { data: rows, error: insErr } = await supabase
      .from('notifications_log')
      .insert([
        {
          user_id: user.id,
          email: user.email,
          type,
          subject: `${subjectPrefix} aged-null 1`,
          status: 'pending',
          sent_at: null,
          created_at: oldCreatedAt,
        },
        {
          user_id: user.id,
          email: user.email,
          type,
          subject: `${subjectPrefix} aged-null 2`,
          status: 'failed',
          sent_at: null,
          created_at: oldCreatedAt,
        },
      ])
      .select('id')
    expect(insErr).toBeNull()
    const insertedIds = (rows ?? []).map((r) => r.id)
    expect(insertedIds).toHaveLength(2)

    const { GET } = await import('@/app/api/cron/purge-notifications/route')
    const response = await GET(buildAuthedRequest())
    expect(response.status).toBe(200)
    const body = (await response.json()) as { deletedAged: number }
    expect(body.deletedAged).toBeGreaterThanOrEqual(2)

    // Verifier que nos 2 rows aged-null ne sont plus la.
    const { data: survivors } = await supabase
      .from('notifications_log')
      .select('id')
      .in('id', insertedIds)
    expect(survivors).toHaveLength(0)
  })
})
