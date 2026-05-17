// Story 8.A.1 (F-Epic8-A0/A1) : tests unitaires du helper
// `triggerAccompagneCodeGenesisIfEligible`. AC8 + AC2 + AC4 + AC5 + AC12.
// 5 scenarios :
//  1. accompagne + status=active            -> code cree + email envoye (created:true)
//  2. accompagne + status=active rejoue     -> created:false, 0 nouvel email
//  3. accompagne + status=incomplete        -> null, aucun appel BDD
//  4. accompagnant + status=active          -> null, aucune genese (path reserve a validateAccompagnante)
//  5. user inexistant + status=active       -> null, capture Sentry warning
//
// Mocks @/lib/supabase/server (createClient -> users.select + parrainages_codes.select/insert),
// @/lib/emails (sendParrainageBienvenueAccompagne spy), @sentry/nextjs (captureException),
// next/server (after run sync).

import { describe, it, expect, beforeEach, vi } from 'vitest'

const {
  mockCreateClient,
  mockSendParrainageBienvenueAccompagne,
  mockCaptureException,
  mockAfter,
} = vi.hoisted(() => ({
  mockCreateClient: vi.fn(),
  mockSendParrainageBienvenueAccompagne: vi.fn(),
  mockCaptureException: vi.fn(),
  mockAfter: vi.fn(),
}))

vi.mock('@/lib/supabase/server', () => ({
  createClient: mockCreateClient,
}))

vi.mock('@/lib/emails', () => ({
  sendParrainageBienvenueAccompagne: mockSendParrainageBienvenueAccompagne,
}))

vi.mock('@sentry/nextjs', () => ({
  captureException: mockCaptureException,
}))

// after(fn) execute la callback de maniere synchrone (en tests, pas de
// rendu Next.js -> on appelle directement la fn pour observer l'email).
vi.mock('next/server', () => ({
  after: mockAfter.mockImplementation((fn: () => Promise<void>) => fn()),
}))

import { triggerAccompagneCodeGenesisIfEligible } from '@/lib/parrainage-codes'

const USER_ID_ACCOMPAGNE = 'a1d1c054-ddc0-452e-8347-e6b5fa3799e2'
const USER_ID_ACCOMPAGNANT = 'b2e2d165-eed1-563f-9458-f7c6fb48a0f3'
const USER_ID_GHOST = 'c3f3e276-ffe2-674a-a569-08d7fc59b104'

type UserRow = {
  role: 'accompagne' | 'accompagnant' | 'admin'
  email: string
  first_name: string | null
}

function buildSupabaseMock(opts: {
  userRow?: UserRow | null
  userError?: { message: string } | null
  existingCode?: string | null
  insertOk?: boolean
}) {
  const usersSelectChain = {
    select: vi.fn().mockReturnThis(),
    eq: vi.fn().mockReturnThis(),
    maybeSingle: vi.fn().mockResolvedValue({
      data: opts.userRow ?? null,
      error: opts.userError ?? null,
    }),
  }

  const codesSelectChain = {
    select: vi.fn().mockReturnThis(),
    eq: vi.fn().mockReturnThis(),
    maybeSingle: vi.fn().mockResolvedValue({
      data: opts.existingCode ? { code: opts.existingCode } : null,
    }),
  }

  const codesInsert = vi.fn().mockResolvedValue({
    error: opts.insertOk === false ? { code: 'XXOTHER' } : null,
  })

  const from = vi.fn((table: string) => {
    if (table === 'users') return usersSelectChain
    if (table === 'parrainages_codes') {
      return {
        select: codesSelectChain.select,
        eq: codesSelectChain.eq,
        maybeSingle: codesSelectChain.maybeSingle,
        insert: codesInsert,
      }
    }
    throw new Error(`unexpected table: ${table}`)
  })

  return {
    supabase: { from },
    spies: { usersSelectChain, codesSelectChain, codesInsert, from },
  }
}

beforeEach(() => {
  vi.clearAllMocks()
  mockAfter.mockImplementation((fn: () => Promise<void>) => fn())
})

describe('triggerAccompagneCodeGenesisIfEligible', () => {
  it('AC1/AC3 : accompagne + status=active (1ere fois) -> code cree + email envoye', async () => {
    const { supabase, spies } = buildSupabaseMock({
      userRow: { role: 'accompagne', email: 'a@ex.fr', first_name: 'Alice' },
      existingCode: null,
      insertOk: true,
    })
    mockCreateClient.mockResolvedValue(supabase)

    const result = await triggerAccompagneCodeGenesisIfEligible({
      userId: USER_ID_ACCOMPAGNE,
      status: 'active',
    })

    expect(result).toEqual({ codeCreated: true, code: expect.any(String) })
    expect(spies.codesInsert).toHaveBeenCalledTimes(1)
    expect(mockSendParrainageBienvenueAccompagne).toHaveBeenCalledTimes(1)
    expect(mockSendParrainageBienvenueAccompagne).toHaveBeenCalledWith(
      expect.objectContaining({ email: 'a@ex.fr', firstName: 'Alice', userId: USER_ID_ACCOMPAGNE }),
    )
    expect(mockCaptureException).not.toHaveBeenCalled()
  })

  it('AC2 : rejeu accompagne + status=active (code existe deja) -> created:false, 0 nouvel email', async () => {
    const { supabase, spies } = buildSupabaseMock({
      userRow: { role: 'accompagne', email: 'a@ex.fr', first_name: 'Alice' },
      existingCode: 'ABCD2345',
    })
    mockCreateClient.mockResolvedValue(supabase)

    const result = await triggerAccompagneCodeGenesisIfEligible({
      userId: USER_ID_ACCOMPAGNE,
      status: 'active',
    })

    expect(result).toEqual({ codeCreated: false, code: 'ABCD2345' })
    expect(spies.codesInsert).not.toHaveBeenCalled()
    expect(mockSendParrainageBienvenueAccompagne).not.toHaveBeenCalled()
    expect(mockCaptureException).not.toHaveBeenCalled()
  })

  it('AC5 : accompagne + status=incomplete -> null, aucun lookup BDD', async () => {
    const result = await triggerAccompagneCodeGenesisIfEligible({
      userId: USER_ID_ACCOMPAGNE,
      status: 'incomplete',
    })

    expect(result).toBeNull()
    expect(mockCreateClient).not.toHaveBeenCalled()
    expect(mockSendParrainageBienvenueAccompagne).not.toHaveBeenCalled()
  })

  it('AC4 : accompagnant + status=active -> null, aucune genese, pas d email', async () => {
    const { supabase, spies } = buildSupabaseMock({
      userRow: { role: 'accompagnant', email: 'b@ex.fr', first_name: 'Bob' },
    })
    mockCreateClient.mockResolvedValue(supabase)

    const result = await triggerAccompagneCodeGenesisIfEligible({
      userId: USER_ID_ACCOMPAGNANT,
      status: 'active',
    })

    expect(result).toBeNull()
    expect(spies.codesInsert).not.toHaveBeenCalled()
    expect(mockSendParrainageBienvenueAccompagne).not.toHaveBeenCalled()
    expect(mockCaptureException).not.toHaveBeenCalled()
  })

  it('AC12 : user inexistant -> null + capture Sentry warning', async () => {
    const { supabase } = buildSupabaseMock({ userRow: null })
    mockCreateClient.mockResolvedValue(supabase)

    const result = await triggerAccompagneCodeGenesisIfEligible({
      userId: USER_ID_GHOST,
      status: 'active',
    })

    expect(result).toBeNull()
    expect(mockSendParrainageBienvenueAccompagne).not.toHaveBeenCalled()
    expect(mockCaptureException).toHaveBeenCalledTimes(1)
    expect(mockCaptureException).toHaveBeenCalledWith(
      expect.any(Error),
      expect.objectContaining({
        tags: expect.objectContaining({
          flow: 'parrainage',
          signal: 'genese-accompagne-failed',
          severity: 'warning',
        }),
        extra: expect.objectContaining({ userId: USER_ID_GHOST, status: 'active' }),
      }),
    )
  })

  it('AC1 : status=trialing est egalement eligible', async () => {
    const { supabase } = buildSupabaseMock({
      userRow: { role: 'accompagne', email: 'a@ex.fr', first_name: 'Alice' },
      existingCode: null,
      insertOk: true,
    })
    mockCreateClient.mockResolvedValue(supabase)

    const result = await triggerAccompagneCodeGenesisIfEligible({
      userId: USER_ID_ACCOMPAGNE,
      status: 'trialing',
    })

    expect(result?.codeCreated).toBe(true)
    expect(mockSendParrainageBienvenueAccompagne).toHaveBeenCalledTimes(1)
  })
})
