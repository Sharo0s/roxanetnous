// Story 7.B.3 (F-Epic7-B1) : tests unitaires purs du handler cron
// purge-ip-addresses, ciblant le branchement auth (AC9).
// Mocks @/lib/supabase/server pour eviter toute connexion BDD.
// Heritage 7.B.2 : reprend les fixes review-finding T1 (garde-fou `!secret`,
// cas (iii) couvert ici en plus -- cf. AC9).

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
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
