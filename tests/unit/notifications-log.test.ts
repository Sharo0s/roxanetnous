// Story 7.A.6 (F-Epic7-A6) : tests unitaires purs pour le helper logNotification.
// AC8 : 4 cas (a-d) centres sur l API du helper.
// Mocks @/lib/supabase/server (factory createClient -> insert chainable) +
// @sentry/nextjs (captureException + addBreadcrumb spies).
// Pas de Supabase reel, pas de Docker. Vitest seul.

import { describe, it, expect, beforeEach, vi } from 'vitest'

// --- Mocks setup (avant import du SUT) ---

// Spies stables exposes via vi.hoisted pour etre referencables dans les
// factories vi.mock (qui sont hoisted en tete de module).
const { mockInsert, mockCaptureException, mockAddBreadcrumb, mockCreateClient } = vi.hoisted(() => {
  const insert = vi.fn()
  const captureException = vi.fn()
  const addBreadcrumb = vi.fn()
  const createClient = vi.fn()
  return {
    mockInsert: insert,
    mockCaptureException: captureException,
    mockAddBreadcrumb: addBreadcrumb,
    mockCreateClient: createClient,
  }
})

vi.mock('@/lib/supabase/server', () => ({
  createClient: mockCreateClient,
}))

vi.mock('@sentry/nextjs', () => ({
  captureException: mockCaptureException,
  addBreadcrumb: mockAddBreadcrumb,
}))

// Helper : configure mockCreateClient pour retourner un supabase mock dont
// `.from('notifications_log').insert(...)` resoud sur `insertResult`.
function mockSupabaseInsertResult(insertResult: { error: { code?: string; message?: string } | null }) {
  mockInsert.mockResolvedValueOnce(insertResult)
  mockCreateClient.mockResolvedValueOnce({
    from: vi.fn().mockReturnValue({ insert: mockInsert }),
  })
}

// --- SUT ---

import { logNotification } from '@/lib/notifications-log'

const baseParams = {
  userId: 'd1d1c054-ddc0-452e-8347-e6b5fa3799e2',
  email: 'test@example.com',
  type: 'subscription_confirm',
  subject: 'Abonnement active',
  status: 'sent' as const,
}

describe('logNotification', () => {
  beforeEach(() => {
    mockInsert.mockReset()
    mockCaptureException.mockReset()
    mockAddBreadcrumb.mockReset()
    mockCreateClient.mockReset()
  })

  it('(a) INSERT reussi : appelle insert 1x avec payload mappe, pas de Sentry', async () => {
    mockSupabaseInsertResult({ error: null })

    await logNotification(baseParams)

    expect(mockInsert).toHaveBeenCalledTimes(1)
    const payload = mockInsert.mock.calls[0]?.[0] as {
      user_id: string | null
      email: string
      type: string
      subject: string
      status: string
      error: string | null
      sent_at: string | null
    }
    expect(payload.user_id).toBe(baseParams.userId)
    expect(payload.email).toBe(baseParams.email)
    expect(payload.type).toBe(baseParams.type)
    expect(payload.subject).toBe(baseParams.subject)
    expect(payload.status).toBe('sent')
    expect(payload.error).toBeNull()
    // sent_at doit etre une ISO string (status='sent') - verification ISO 8601
    expect(payload.sent_at).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}.\d{3}Z$/)

    expect(mockCaptureException).not.toHaveBeenCalled()
    expect(mockAddBreadcrumb).not.toHaveBeenCalled()
  })

  it('(b) INSERT renvoie 23505 (unique_violation) : silent-skip + breadcrumb info, pas captureException', async () => {
    mockSupabaseInsertResult({
      error: {
        code: '23505',
        message: 'duplicate key value violates unique constraint "notifications_log_unique_sent_by_hour"',
      },
    })

    await logNotification(baseParams)

    expect(mockInsert).toHaveBeenCalledTimes(1)
    expect(mockCaptureException).not.toHaveBeenCalled()
    expect(mockAddBreadcrumb).toHaveBeenCalledTimes(1)
    expect(mockAddBreadcrumb).toHaveBeenCalledWith({
      category: 'notifications_log',
      level: 'info',
      message: 'duplicate-skip-idempotent',
      data: {
        type: baseParams.type,
        status: baseParams.status,
        hasUserId: true,
      },
    })
  })

  it('(c) INSERT renvoie 23514 (check_violation) : captureException severity warning, pas de breadcrumb', async () => {
    mockSupabaseInsertResult({
      error: {
        code: '23514',
        message: 'new row violates check constraint "notifications_log_status_check"',
      },
    })

    await logNotification({ ...baseParams, status: 'pending' })

    expect(mockInsert).toHaveBeenCalledTimes(1)
    expect(mockAddBreadcrumb).not.toHaveBeenCalled()
    expect(mockCaptureException).toHaveBeenCalledTimes(1)
    const [errArg, optsArg] = mockCaptureException.mock.calls[0] as [
      { code?: string; message?: string },
      {
        tags: { flow: string; signal: string; severity: string }
        extra: { type: string; status: string; hasUserId: boolean }
      },
    ]
    expect(errArg.code).toBe('23514')
    expect(optsArg.tags.flow).toBe('notifications_log')
    expect(optsArg.tags.signal).toBe('insert_failed')
    expect(optsArg.tags.severity).toBe('warning')
    expect(optsArg.extra.type).toBe(baseParams.type)
    expect(optsArg.extra.status).toBe('pending')
    expect(optsArg.extra.hasUserId).toBe(true)
  })

  it('(d) createClient throw (BDD down) : captureException, ne re-throw pas (defense en profondeur)', async () => {
    const bddError = new Error('BDD down')
    mockCreateClient.mockRejectedValueOnce(bddError)

    // Doit resoudre sans throw -> caller ne voit jamais l erreur (heritage 4.2 D1).
    await expect(logNotification(baseParams)).resolves.toBeUndefined()

    expect(mockInsert).not.toHaveBeenCalled()
    expect(mockAddBreadcrumb).not.toHaveBeenCalled()
    expect(mockCaptureException).toHaveBeenCalledTimes(1)
    const [errArg, optsArg] = mockCaptureException.mock.calls[0] as [
      Error,
      {
        tags: { flow: string; signal: string; severity: string }
        extra: { type: string; status: string; hasUserId: boolean }
      },
    ]
    expect(errArg).toBe(bddError)
    expect(optsArg.tags.flow).toBe('notifications_log')
    expect(optsArg.tags.signal).toBe('insert_failed')
    expect(optsArg.tags.severity).toBe('warning')
    expect(optsArg.extra.hasUserId).toBe(true)
  })
})

// Story 7.A.11 (F-Epic7-A11) : validation runtime UUID sur params.userId.
// Throw early *avant le try* si format invalide -> remonte au caller, n'est pas
// avale par le catch Sentry du helper. Defense en profondeur : aucun call-site
// connu n'exerce le cas 'undefined' literal a la livraison (audit AC7).
describe('logNotification > userId validation', () => {
  beforeEach(() => {
    mockInsert.mockReset()
    mockCaptureException.mockReset()
    mockAddBreadcrumb.mockReset()
    mockCreateClient.mockReset()
  })

  it('(uuid-a) UUID v4 minuscule valide : INSERT normal, pas de throw, pas de Sentry', async () => {
    mockSupabaseInsertResult({ error: null })

    await logNotification({ ...baseParams, userId: 'd1d1c054-ddc0-452e-8347-e6b5fa3799e2' })

    expect(mockInsert).toHaveBeenCalledTimes(1)
    const payload = mockInsert.mock.calls[0]?.[0] as { user_id: string | null }
    expect(payload.user_id).toBe('d1d1c054-ddc0-452e-8347-e6b5fa3799e2')
    expect(mockCaptureException).not.toHaveBeenCalled()
  })

  it('(uuid-b) UUID v4 majuscule valide : regex case-insensitive, payload preserve la casse', async () => {
    mockSupabaseInsertResult({ error: null })

    await logNotification({ ...baseParams, userId: 'D1D1C054-DDC0-452E-8347-E6B5FA3799E2' })

    expect(mockInsert).toHaveBeenCalledTimes(1)
    const payload = mockInsert.mock.calls[0]?.[0] as { user_id: string | null }
    expect(payload.user_id).toBe('D1D1C054-DDC0-452E-8347-E6B5FA3799E2')
    expect(mockCaptureException).not.toHaveBeenCalled()
  })

  it("(uuid-c) userId === 'undefined' literal : throw avant try, mockInsert jamais appele", async () => {
    await expect(logNotification({ ...baseParams, userId: 'undefined' })).rejects.toThrow(/UUID/)

    expect(mockInsert).not.toHaveBeenCalled()
    expect(mockCreateClient).not.toHaveBeenCalled()
    expect(mockCaptureException).not.toHaveBeenCalled()
  })

  it("(uuid-d) userId === '' empty string : falsy short-circuit, INSERT avec user_id=null", async () => {
    mockSupabaseInsertResult({ error: null })

    await logNotification({ ...baseParams, userId: '' })

    expect(mockInsert).toHaveBeenCalledTimes(1)
    const payload = mockInsert.mock.calls[0]?.[0] as { user_id: string | null }
    expect(payload.user_id).toBeNull()
    expect(mockCaptureException).not.toHaveBeenCalled()
  })

  it('(uuid-e) userId omis (undefined) : INSERT avec user_id=null', async () => {
    mockSupabaseInsertResult({ error: null })

    const { email, type, subject, status } = baseParams
    await logNotification({ email, type, subject, status })

    expect(mockInsert).toHaveBeenCalledTimes(1)
    const payload = mockInsert.mock.calls[0]?.[0] as { user_id: string | null }
    expect(payload.user_id).toBeNull()
    expect(mockCaptureException).not.toHaveBeenCalled()
  })

  it("(uuid-f) userId === 'not-a-uuid' : throw avant try, mockInsert jamais appele", async () => {
    await expect(logNotification({ ...baseParams, userId: 'not-a-uuid' })).rejects.toThrow(/UUID/)

    expect(mockInsert).not.toHaveBeenCalled()
    expect(mockCreateClient).not.toHaveBeenCalled()
    expect(mockCaptureException).not.toHaveBeenCalled()
  })
})
