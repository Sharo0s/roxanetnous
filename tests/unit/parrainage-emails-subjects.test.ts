// Story 8.C.3 (AC #13 -- Option A) : verifie la stabilite des sujets emails parrainage
// apres l'alignement wording UI neutre (parrain/filleul, masculin neutre CLAUDE.md durcie).
// Pattern : mock @/lib/resend + @/lib/supabase/server + @/lib/notifications-log,
// capture l'argument `subject` de `resend.emails.send`, expect.toBe(...) chirurgical.
//
// Couvre 5 sujets clefs cite epic-8.md ligne 535 :
//  - sendParrainageBienvenueParrain
//  - sendParrainageBienvenueAccompagne
//  - sendParrainageFilleuleConfirmation
//  - sendParrainageRecompense
//  - sendAdminParrainageFlag (type: 'meme_email')

import { describe, it, expect, beforeEach, vi } from 'vitest'

// ─── Hoisted mocks ────────────────────────────────────────────────────────────
const { mockResendSend, mockLogNotification, mockSupabaseFromMaybeSingle } = vi.hoisted(() => ({
  mockResendSend: vi.fn().mockResolvedValue({ data: { id: 'email_test_id' }, error: null }),
  mockLogNotification: vi.fn().mockResolvedValue(undefined),
  mockSupabaseFromMaybeSingle: vi.fn().mockResolvedValue({ data: { email: 'admin@example.com' }, error: null }),
}))

vi.mock('resend', () => {
  class FakeResend {
    emails = { send: mockResendSend }
  }
  return { Resend: FakeResend }
})

vi.mock('@/lib/notifications-log', () => ({
  logNotification: mockLogNotification,
}))

vi.mock('@/lib/email-queue', () => ({
  enqueueEmail: vi.fn().mockResolvedValue({ runId: 'test-run-id' }),
}))

// Supabase admin client (utilise par sendAdminParrainageFlag pour lookup admin email).
vi.mock('@/lib/supabase/server', () => ({
  createClient: vi.fn().mockResolvedValue({
    from: () => ({
      select: () => ({
        eq: () => ({
          maybeSingle: mockSupabaseFromMaybeSingle,
        }),
      }),
    }),
  }),
}))

vi.mock('@sentry/nextjs', () => ({
  captureException: vi.fn(),
  captureMessage: vi.fn(),
}))

// ENV : sendAdminParrainageFlag necessite ADMIN_NOTIFICATIONS_EMAIL pour
// emprunter la branche "email envoye" (sinon fail-loud + early return).
process.env.RESEND_API_KEY = 'test-key'
process.env.ADMIN_NOTIFICATIONS_EMAIL = 'admin@example.com'

import {
  sendParrainageBienvenueParrain,
  sendParrainageBienvenueAccompagne,
  sendParrainageFilleuleConfirmation,
  sendParrainageRecompense,
  sendAdminParrainageFlag,
} from '@/lib/emails'

describe('Parrainage emails subjects (Story 8.C.3 AC#13)', () => {
  beforeEach(() => {
    mockResendSend.mockClear()
    mockLogNotification.mockClear()
  })

  it('sendParrainageBienvenueParrain -> subject = "Votre code de parrainage roxanetnous"', async () => {
    await sendParrainageBienvenueParrain({
      email: 'parrain@example.com',
      firstName: 'Alice',
      code: 'ABCD2345',
      userId: 'user-1',
    })
    expect(mockResendSend).toHaveBeenCalledTimes(1)
    expect(mockResendSend.mock.calls[0]?.[0]?.subject).toBe('Votre code de parrainage roxanetnous')
  })

  it('sendParrainageBienvenueAccompagne -> subject = "Votre code de parrainage roxanetnous"', async () => {
    await sendParrainageBienvenueAccompagne({
      email: 'accompagne@example.com',
      firstName: 'Bob',
      code: 'EFGH3456',
      userId: 'user-2',
    })
    expect(mockResendSend).toHaveBeenCalledTimes(1)
    expect(mockResendSend.mock.calls[0]?.[0]?.subject).toBe('Votre code de parrainage roxanetnous')
  })

  it('sendParrainageFilleuleConfirmation -> subject = "Bienvenue sur roxanetnous, votre profil est validé"', async () => {
    await sendParrainageFilleuleConfirmation({
      email: 'filleul@example.com',
      firstName: 'Claire',
      marraineFirstName: 'Alice',
      userId: 'user-3',
    })
    expect(mockResendSend).toHaveBeenCalledTimes(1)
    expect(mockResendSend.mock.calls[0]?.[0]?.subject).toBe('Bienvenue sur roxanetnous, votre profil est validé')
  })

  it('sendParrainageRecompense -> subject = "Félicitations, vous avez 6 mois offerts sur roxanetnous"', async () => {
    await sendParrainageRecompense({
      email: 'parrain@example.com',
      firstName: 'Alice',
      totalRecompenses: 1,
      role: 'accompagnant',
      userId: 'user-4',
    })
    expect(mockResendSend).toHaveBeenCalledTimes(1)
    expect(mockResendSend.mock.calls[0]?.[0]?.subject).toBe('Félicitations, vous avez 6 mois offerts sur roxanetnous')
  })

  it('sendAdminParrainageFlag (type meme_email) -> subject = "Parrainage bloqué - même email entre parrain et filleul"', async () => {
    await sendAdminParrainageFlag({
      type: 'meme_email',
      parrainageId: 'p-1',
      marraineName: 'Alice Martin',
      filleuleName: 'Claire Dupont',
    })
    expect(mockResendSend).toHaveBeenCalledTimes(1)
    expect(mockResendSend.mock.calls[0]?.[0]?.subject).toBe(
      'Parrainage bloqué - même email entre parrain et filleul',
    )
  })
})
