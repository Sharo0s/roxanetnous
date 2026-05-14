// Story 7.B.2 (F-Epic7-B2) : tests unitaires purs du handler cron
// purge-notifications, ciblant le branchement auth (AC9).
// Mocks @/lib/supabase/server pour eviter toute connexion BDD.

import { describe, it, expect, beforeAll, beforeEach, vi } from 'vitest'
import { NextRequest } from 'next/server'

const { mockCreateClient } = vi.hoisted(() => ({
  mockCreateClient: vi.fn(),
}))

vi.mock('@/lib/supabase/server', () => ({
  createClient: mockCreateClient,
}))

vi.mock('@sentry/nextjs', () => ({
  addBreadcrumb: vi.fn(),
  captureException: vi.fn(),
  captureMessage: vi.fn(),
}))

const TEST_CRON_SECRET = 'unit-test-cron-secret-7b2'

beforeAll(() => {
  process.env.CRON_SECRET = TEST_CRON_SECRET
})

beforeEach(() => {
  mockCreateClient.mockReset()
})

describe('GET /api/cron/purge-notifications (auth)', () => {
  it('(i) Authorization header absent -> 401 { error: "Non autorise" }', async () => {
    const { GET } = await import('@/app/api/cron/purge-notifications/route')
    const req = new NextRequest('http://localhost/api/cron/purge-notifications', {
      headers: {},
    })
    const res = await GET(req)
    expect(res.status).toBe(401)
    const body = (await res.json()) as { error: string }
    expect(body).toEqual({ error: 'Non autorise' })
    // Pas d acces BDD : createClient ne doit pas etre invoque sur 401.
    expect(mockCreateClient).not.toHaveBeenCalled()
  })

  it('(ii) Authorization header avec wrong bearer -> 401', async () => {
    const { GET } = await import('@/app/api/cron/purge-notifications/route')
    const req = new NextRequest('http://localhost/api/cron/purge-notifications', {
      headers: { authorization: 'Bearer wrong-secret-totally' },
    })
    const res = await GET(req)
    expect(res.status).toBe(401)
    const body = (await res.json()) as { error: string }
    expect(body).toEqual({ error: 'Non autorise' })
    expect(mockCreateClient).not.toHaveBeenCalled()
  })
})
