import { describe, it, expect, beforeEach, vi } from 'vitest'
import * as Sentry from '@sentry/nextjs'
import { createClient } from '@/lib/supabase/server'
import { hasActiveSubscription } from '@/lib/subscription-helpers'

// Story 7.A.1 (AC6 c) : sur erreur Supabase transitoire dans `hasActiveSubscription`
// (timeout reseau, RLS denied, double-row), le helper DOIT :
//   1. logger l'erreur via Sentry.captureException avec tag flow='subscription_check'
//      severity='critical' ;
//   2. fail-loud : throw new Error('subscription check failed: ...').
// Avant 7.A.1, le code utilisait `.single()` sans destructurer error et tombait
// silencieusement sur `return false` -> paywall invisible pour l'abonne legitime.
//
// On simule l'incident en surchargeant le createClient mock pour fournir une chaine
// `.from('subscriptions').select().eq().in().maybeSingle()` qui resoud avec
// { data: null, error: PostgrestError-like }.
describe("paywall : erreur Supabase transitoire sur hasActiveSubscription (T-7A1-c)", () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('throw fail-loud + Sentry capture avec tag flow=subscription_check severity=critical', async () => {
    const transientError = {
      code: 'PGRST301',
      message: 'JWT expired (simulated timeout)',
      details: '',
      hint: '',
      name: 'PostgrestError',
    }

    // Chaine fluente `.from().select().eq().in().maybeSingle()` resolue avec
    // { data: null, error }. Chaque maillon retourne `this` pour preserver le
    // chainage, sauf `.maybeSingle()` qui termine en Promise.
    const fakeQuery = {
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      in: vi.fn().mockReturnThis(),
      maybeSingle: vi.fn().mockResolvedValue({ data: null, error: transientError }),
    }
    const fakeClient = {
      from: vi.fn().mockReturnValue(fakeQuery),
    }

    vi.mocked(createClient).mockResolvedValue(fakeClient as never)

    // Egalite stricte du message sanitise (pas de leak BDD dans le throw).
    // La cause originale est preservee via Error.cause (ES2022) pour conserver
    // la stack PostgrestError debuggable.
    let thrown: unknown
    try {
      await hasActiveSubscription('user-id-irrelevant')
    } catch (e) {
      thrown = e
    }
    expect(thrown).toBeInstanceOf(Error)
    expect((thrown as Error).message).toBe('subscription check failed')
    expect((thrown as Error).cause).toBe(transientError)

    expect(Sentry.captureException).toHaveBeenCalledTimes(1)
    const captureCall = vi.mocked(Sentry.captureException).mock.calls[0]
    expect(captureCall?.[0]).toBe(transientError)
    expect(captureCall?.[1]).toMatchObject({
      tags: { flow: 'subscription_check', severity: 'critical' },
    })
  })
})
