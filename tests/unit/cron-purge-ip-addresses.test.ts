// Story 7.B.3 (F-Epic7-B1) : tests unitaires purs du handler cron
// purge-ip-addresses, ciblant le branchement auth (AC9).
// Mocks @/lib/supabase/server pour eviter toute connexion BDD.
// Heritage 7.B.2 : reprend les fixes review-finding T1 (garde-fou `!secret`,
// cas (iii) couvert ici en plus -- cf. AC9).

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import type { Mock } from 'vitest'
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

const TEST_CRON_SECRET = 'unit-test-cron-secret-7b3'

beforeEach(() => {
  mockCreateClient.mockReset()
  process.env.CRON_SECRET = TEST_CRON_SECRET
})

afterEach(() => {
  process.env.CRON_SECRET = TEST_CRON_SECRET
})

describe('GET /api/cron/purge-ip-addresses (auth)', () => {
  it('(i) Authorization header absent -> 401 { error: "Non autorise" }', async () => {
    const { GET } = await import('@/app/api/cron/purge-ip-addresses/route')
    const req = new NextRequest('http://localhost/api/cron/purge-ip-addresses', {
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
    const { GET } = await import('@/app/api/cron/purge-ip-addresses/route')
    const req = new NextRequest('http://localhost/api/cron/purge-ip-addresses', {
      headers: { authorization: 'Bearer wrong-secret-totally' },
    })
    const res = await GET(req)
    expect(res.status).toBe(401)
    const body = (await res.json()) as { error: string }
    expect(body).toEqual({ error: 'Non autorise' })
    expect(mockCreateClient).not.toHaveBeenCalled()
  })

  it('(iii) process.env.CRON_SECRET absent -> 401 (garde-fou heritage 7.B.2 T1)', async () => {
    delete process.env.CRON_SECRET
    const { GET } = await import('@/app/api/cron/purge-ip-addresses/route')
    // Authorization correct au format Bearer, mais secret manquant cote serveur :
    // doit retourner 401 (jamais bypasser meme si auth header bien forme).
    const req = new NextRequest('http://localhost/api/cron/purge-ip-addresses', {
      headers: { authorization: 'Bearer any-value' },
    })
    const res = await GET(req)
    expect(res.status).toBe(401)
    const body = (await res.json()) as { error: string }
    expect(body).toEqual({ error: 'Non autorise' })
    expect(mockCreateClient).not.toHaveBeenCalled()
  })
})

describe('GET /api/cron/purge-ip-addresses (erreur partielle)', () => {
  it('(iv) etape 1 OK + etape 2 KO -> 500 + captureException step=update_notifications_ouverture', async () => {
    const Sentry = await import('@sentry/nextjs')
    const mockCaptureException = Sentry.captureException as Mock

    // Supabase mock : etape 1 (parrainages) reussit, etape 2 (notifications_ouverture) echoue.
    const mockUpdateNotNull = vi.fn().mockReturnValue({ data: [{ id: 'abc' }], error: null })
    const mockUpdateWithError = vi.fn().mockReturnValue({ data: null, error: { message: 'simulated_error', code: '42P01' } })

    let callCount = 0
    const mockFrom = vi.fn().mockImplementation(() => ({
      update: vi.fn().mockReturnValue({
        lt: vi.fn().mockReturnValue({
          not: vi.fn().mockReturnValue({
            select: callCount++ === 0 ? mockUpdateNotNull : mockUpdateWithError,
          }),
        }),
      }),
    }))
    mockCreateClient.mockResolvedValue({ from: mockFrom })

    const { GET } = await import('@/app/api/cron/purge-ip-addresses/route')
    const req = new NextRequest('http://localhost/api/cron/purge-ip-addresses', {
      headers: { authorization: `Bearer ${TEST_CRON_SECRET}` },
    })
    const res = await GET(req)
    expect(res.status).toBe(500)
    const body = (await res.json()) as { error: string }
    expect(body).toEqual({ error: 'Purge failed' })
    expect(mockCaptureException).toHaveBeenCalledWith(
      expect.objectContaining({ message: 'simulated_error' }),
      expect.objectContaining({
        extra: expect.objectContaining({ step: 'update_notifications_ouverture' }),
      }),
    )
  })
})
