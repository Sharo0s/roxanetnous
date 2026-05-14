// Story 7.A.6 (F-Epic7-A6) : tests d integration BDD pour l idempotence
// du helper logNotification via le partial UNIQUE INDEX
// `notifications_log_unique_sent_by_hour` (status='sent').
// AC9 : 5 cas (a-e) couvrant le pattern bout-en-bout sur Supabase local.
// AC10 : reuse pattern fixtures heritage 4.4 + 7.A.4 + 7.A.5 (createTestUser
// + cleanupAllFixtures + tracker notifications_log).

import { afterAll, afterEach, describe, expect, it } from 'vitest'
import { randomUUID } from 'node:crypto'
import { logNotification } from '@/lib/notifications-log'
import { createTestUser, cleanupAllFixtures } from '../_lib/fixtures'
import { getAdminClient } from '../_lib/supabase-admin'

// Tracker local pour les rows crees hors fixtures (cas (b) anonyme + cas (e)
// inserts directs avec sent_at custom). Cleanup en afterEach pour eviter
// pollution inter-cas dans la meme suite.
const localNotificationIds: string[] = []
const localNotificationEmails: string[] = []

async function cleanupLocalNotifications() {
  if (localNotificationIds.length === 0 && localNotificationEmails.length === 0) return
  const supabase = getAdminClient()
  if (localNotificationIds.length > 0) {
    await supabase.from('notifications_log').delete().in('id', localNotificationIds)
    localNotificationIds.length = 0
  }
  if (localNotificationEmails.length > 0) {
    await supabase.from('notifications_log').delete().eq('user_id', null).in('email', localNotificationEmails)
    localNotificationEmails.length = 0
  }
}

describe('logNotification - idempotence via partial UNIQUE INDEX (story 7.A.6)', () => {
  afterEach(async () => {
    await cleanupLocalNotifications()
  })

  afterAll(async () => {
    await cleanupAllFixtures()
  })

  it('(a) authentifie : 2 appels meme tuple dans la meme heure -> 1 row (silent-skip 23505)', async () => {
    const user = await createTestUser('accompagnant')
    const type = `subscription_confirm-test-${randomUUID().slice(0, 8)}`
    const subject = 'Abonnement active'

    await logNotification({
      userId: user.id,
      email: user.email,
      type,
      subject,
      status: 'sent',
    })
    await logNotification({
      userId: user.id,
      email: user.email,
      type,
      subject,
      status: 'sent',
    })

    const supabase = getAdminClient()
    const { data, error } = await supabase
      .from('notifications_log')
      .select('id, status')
      .eq('user_id', user.id)
      .eq('type', type)
      .eq('status', 'sent')
    expect(error).toBeNull()
    expect(data).toHaveLength(1)
    if (data) localNotificationIds.push(...data.map((r) => r.id))
  })

  it('(b) anonyme : 2 appels meme email + type + subject dans la meme heure -> 1 row (cle metier email)', async () => {
    const email = `visiteur-test-7a6-${randomUUID().slice(0, 8)}@example.com`
    const type = `contact_form-test-${randomUUID().slice(0, 8)}`
    const subject = 'Contact roxanetnous : Test 7.A.6'

    await logNotification({
      email,
      type,
      subject,
      status: 'sent',
    })
    await logNotification({
      email,
      type,
      subject,
      status: 'sent',
    })

    localNotificationEmails.push(email)

    const supabase = getAdminClient()
    const { data, error } = await supabase
      .from('notifications_log')
      .select('id, user_id')
      .eq('email', email)
      .eq('type', type)
      .eq('status', 'sent')
    expect(error).toBeNull()
    expect(data).toHaveLength(1)
    expect(data?.[0]?.user_id).toBeNull()
  })

  it('(c) variation legitime : meme userId + type, subjects differents -> 2 rows distinctes', async () => {
    const user = await createTestUser('accompagne')
    const type = `new_message-test-${randomUUID().slice(0, 8)}`

    await logNotification({
      userId: user.id,
      email: user.email,
      type,
      subject: 'Nouveau message de Jean',
      status: 'sent',
    })
    await logNotification({
      userId: user.id,
      email: user.email,
      type,
      subject: 'Nouveau message de Marie',
      status: 'sent',
    })

    const supabase = getAdminClient()
    const { data, error } = await supabase
      .from('notifications_log')
      .select('id, subject')
      .eq('user_id', user.id)
      .eq('type', type)
      .eq('status', 'sent')
      .order('subject', { ascending: true })
    expect(error).toBeNull()
    expect(data).toHaveLength(2)
    const subjects = data?.map((r) => r.subject).sort()
    expect(subjects).toEqual(['Nouveau message de Jean', 'Nouveau message de Marie'])
    if (data) localNotificationIds.push(...data.map((r) => r.id))
  })

  it("(d) statuts non-sent : 2 appels meme tuple status='pending' puis 2 status='error' -> audit trail libre", async () => {
    const user = await createTestUser('accompagnant')
    const type = `pending-test-${randomUUID().slice(0, 8)}`
    const subject = 'Test status non-sent'

    // 2 appels status='pending' meme tuple : pas de partial index applicable -> 2 rows.
    await logNotification({
      userId: user.id,
      email: user.email,
      type,
      subject,
      status: 'pending',
    })
    await logNotification({
      userId: user.id,
      email: user.email,
      type,
      subject,
      status: 'pending',
    })

    // 2 appels status='error' meme tuple : idem, partial index ne s applique pas.
    await logNotification({
      userId: user.id,
      email: user.email,
      type,
      subject,
      status: 'error',
      error: 'simulated transient error',
    })
    await logNotification({
      userId: user.id,
      email: user.email,
      type,
      subject,
      status: 'error',
      error: 'simulated transient error',
    })

    const supabase = getAdminClient()
    const { data: pendingRows, error: pendingErr } = await supabase
      .from('notifications_log')
      .select('id')
      .eq('user_id', user.id)
      .eq('type', type)
      .eq('status', 'pending')
    expect(pendingErr).toBeNull()
    expect(pendingRows).toHaveLength(2)

    const { data: errorRows, error: errorErr } = await supabase
      .from('notifications_log')
      .select('id')
      .eq('user_id', user.id)
      .eq('type', type)
      .eq('status', 'error')
    expect(errorErr).toBeNull()
    expect(errorRows).toHaveLength(2)

    if (pendingRows) localNotificationIds.push(...pendingRows.map((r) => r.id))
    if (errorRows) localNotificationIds.push(...errorRows.map((r) => r.id))
  })

  it('(e) cross-hour : meme tuple seed sent_at H et H+1 (insert direct admin) -> 2 rows distinctes', async () => {
    const user = await createTestUser('accompagnant')
    const type = `cross-hour-test-${randomUUID().slice(0, 8)}`
    const subject = 'Test cross-hour'
    const supabase = getAdminClient()

    // INSERT direct (bypass logNotification pour seed sent_at custom). Le partial
    // UNIQUE INDEX cle metier inclut date_trunc('hour', sent_at|created_at AT TIME ZONE 'UTC')
    // donc 2 sent_at dans des buckets horaires UTC distincts -> 2 rows acceptees.
    const sentAtHourBase = new Date('2026-01-15T10:00:00.000Z')
    const sentAtHourPlus1 = new Date('2026-01-15T11:00:00.000Z')

    const { data: row1, error: err1 } = await supabase
      .from('notifications_log')
      .insert({
        user_id: user.id,
        email: user.email,
        type,
        subject,
        status: 'sent',
        sent_at: sentAtHourBase.toISOString(),
      })
      .select('id')
      .single()
    expect(err1).toBeNull()
    expect(row1).not.toBeNull()

    const { data: row2, error: err2 } = await supabase
      .from('notifications_log')
      .insert({
        user_id: user.id,
        email: user.email,
        type,
        subject,
        status: 'sent',
        sent_at: sentAtHourPlus1.toISOString(),
      })
      .select('id')
      .single()
    expect(err2).toBeNull()
    expect(row2).not.toBeNull()

    const { data: rows, error: errSelect } = await supabase
      .from('notifications_log')
      .select('id, sent_at')
      .eq('user_id', user.id)
      .eq('type', type)
      .eq('status', 'sent')
      .order('sent_at', { ascending: true })
    expect(errSelect).toBeNull()
    expect(rows).toHaveLength(2)

    if (rows) localNotificationIds.push(...rows.map((r) => r.id))
  })
})
