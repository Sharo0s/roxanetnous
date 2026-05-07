import { vi, beforeEach } from 'vitest'

// Garde-fou D4 : refus categorique d'executer contre staging/prod.
// Tout test integration doit cibler Supabase local (localhost:54321 / 127.0.0.1).
const supabaseUrl = process.env.SUPABASE_URL ?? process.env.NEXT_PUBLIC_SUPABASE_URL
if (
  supabaseUrl &&
  !supabaseUrl.includes('localhost') &&
  !supabaseUrl.includes('127.0.0.1')
) {
  throw new Error(
    `[tests/integration] Refus d'executer : SUPABASE_URL='${supabaseUrl}' n'est pas local. ` +
      'Lancer supabase start et exporter SUPABASE_URL=http://localhost:54321.',
  )
}

// Variables d'environnement de test : valeurs factices coherentes pour le webhook.
process.env.STRIPE_WEBHOOK_SECRET =
  process.env.STRIPE_WEBHOOK_SECRET ?? 'whsec_test_secret_for_integration_tests'
process.env.STRIPE_SECRET_KEY =
  process.env.STRIPE_SECRET_KEY ?? 'sk_test_dummy_for_integration_tests'

// Mock @sentry/nextjs : zero appel reseau, no-op total (D3).
vi.mock('@sentry/nextjs', () => ({
  init: vi.fn(),
  captureException: vi.fn(),
  captureMessage: vi.fn(),
  withScope: vi.fn((callback: (scope: unknown) => void) => {
    callback({
      setTag: vi.fn(),
      setExtra: vi.fn(),
      setContext: vi.fn(),
      setLevel: vi.fn(),
    })
  }),
  setTag: vi.fn(),
  setExtra: vi.fn(),
  setContext: vi.fn(),
}))

// Mock Resend SDK : empeche tout appel reseau.
// Resend est instanciee via `new Resend(key)` dans lib/emails.ts -> on expose
// une vraie classe (pas vi.fn().mockImplementation, casse en Vitest 4).
vi.mock('resend', () => {
  const send = vi.fn().mockResolvedValue({ data: { id: 'email_test_id' }, error: null })
  class FakeResend {
    emails = { send }
  }
  return { Resend: FakeResend }
})

// Mock @/lib/email-queue : n'enqueue jamais de workflow durable en CI.
vi.mock('@/lib/email-queue', () => ({
  enqueueEmail: vi.fn().mockResolvedValue({ runId: 'test-run-id' }),
}))

// Mock @/lib/stripe : aucun appel reseau Stripe outbound (D7).
// Les tests qui ont besoin de comportements specifiques surchargent via vi.mocked.
vi.mock('@/lib/stripe', async () => {
  const Stripe = (await import('stripe')).default
  return {
    stripe: {
      webhooks: {
        // generateTestHeaderString reel garde la meme signature : on garde le vrai
        // helper Stripe pour signer authentiquement, mais on conserve la possibilite
        // de surcharger constructEvent par test si besoin.
        constructEvent: Stripe.webhooks.constructEvent.bind(Stripe.webhooks),
        generateTestHeaderString:
          Stripe.webhooks.generateTestHeaderString.bind(Stripe.webhooks),
      },
      subscriptions: {
        retrieve: vi.fn(),
      },
      paymentMethods: {
        retrieve: vi.fn(),
        list: vi.fn(),
      },
      customers: {
        retrieve: vi.fn(),
      },
      checkout: {
        sessions: {
          retrieve: vi.fn(),
        },
      },
    },
    getStripePriceId: vi.fn().mockReturnValue('price_test_dummy'),
    getTrialDays: vi.fn().mockReturnValue(undefined),
    isLaunchOffer: vi.fn().mockReturnValue(false),
  }
})

// Mock next/headers cookies() : indispensable pour createServerClient cote tests
// paywall. Les tests peuvent surcharger via vi.mocked(cookies).mockReturnValue(...).
vi.mock('next/headers', () => ({
  cookies: vi.fn().mockResolvedValue({
    get: vi.fn().mockReturnValue(undefined),
    getAll: vi.fn().mockReturnValue([]),
    set: vi.fn(),
    delete: vi.fn(),
  }),
  headers: vi.fn().mockResolvedValue(new Map()),
}))

// Mock @/lib/emails : capture les sendXxxEmail synchrones du webhook Stripe.
// Les tests T1, T2, T4 asserent l'appel via vi.mocked(...).mock.calls.
// L'export reste partiel : on conserve les helpers reels qui ne sont pas
// asseres (logNotification, escapeHtml lus depuis emails.ts en interne).
vi.mock('@/lib/emails', () => ({
  sendWelcomeEmail: vi.fn().mockResolvedValue(undefined),
  sendValidationResultEmail: vi.fn().mockResolvedValue(undefined),
  sendNewMessageEmail: vi.fn().mockResolvedValue(undefined),
  sendSubscriptionConfirmEmail: vi.fn().mockResolvedValue(undefined),
  sendSubscriptionCancelEmail: vi.fn().mockResolvedValue(undefined),
  sendDisponibleReactivatedEmail: vi.fn().mockResolvedValue(undefined),
  sendFavoriDisponibleEmail: vi.fn().mockResolvedValue(undefined),
  sendMatchingNotificationEmail: vi.fn().mockResolvedValue(undefined),
  sendPlanChangeEmail: vi.fn().mockResolvedValue(undefined),
  sendRenewalReminderEmail: vi.fn().mockResolvedValue(undefined),
  sendParrainageBienvenueMarraine: vi.fn().mockResolvedValue(undefined),
  sendParrainageFilleuleConfirmation: vi.fn().mockResolvedValue(undefined),
  sendParrainageRecompense: vi.fn().mockResolvedValue(undefined),
  sendAdminParrainageFlag: vi.fn().mockResolvedValue(undefined),
  sendExpirationReminderEmail: vi.fn().mockResolvedValue(undefined),
  sendWaitlistConfirmationEmail: vi.fn().mockResolvedValue(undefined),
  sendWaitlistOpeningNotificationEmail: vi.fn().mockResolvedValue(undefined),
  enqueueWaitlistConfirmationEmail: vi.fn().mockResolvedValue(undefined),
  enqueueWaitlistOpeningNotificationEmail: vi.fn().mockResolvedValue(undefined),
  sendParrainageVerificationEmail: vi.fn().mockResolvedValue(undefined),
}))

// Mock @/lib/supabase/server.createClient : par defaut retourne un client admin
// local. Les tests paywall surchargent par test pour simuler une session
// authentifiee (auth.getUser retourne un user specifique).
// Le test fournit son propre client via vi.mocked(createClient).mockResolvedValue(...).
vi.mock('@/lib/supabase/server', async () => {
  const actual = await vi.importActual<typeof import('@/lib/supabase/server')>(
    '@/lib/supabase/server',
  )
  return {
    ...actual,
    createClient: vi.fn(actual.createClient),
  }
})

// Reset des compteurs de mocks entre chaque test (Risque #3 : leak entre tests).
beforeEach(() => {
  vi.clearAllMocks()
})
