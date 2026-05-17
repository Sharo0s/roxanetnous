// Story 8.A.2 (F-Epic8-A2) : tests unitaires branching role-aware parrainage symétrique.
// Scénarios couverts (AC #1, #2, #3, #4, #5, #6, #7, #12) :
//  1. validateCode  — parrain accompagné + sub active         -> { valid: true }
//  2. validateCode  — parrain accompagné + sub cancelled      -> { valid: false, reason: 'marraine_subscription_inactive' }
//  3. validateCode  — parrain accompagnant + valide + active  -> { valid: true }  (non-régression)
//  4. createParrainageRelation — filleul accompagné           -> { ok: false, reason: 'invalid_filleul_role' } + Sentry
//  5. createParrainageRelation — filleul accompagnant + parrain accompagné -> { ok: true }
//  6. confirmParrainageOnSuccess — parrain accompagné + sub active  -> { ok: true }
//  7. confirmParrainageOnSuccess — parrain accompagné + sub cancelled -> { ok: false, reason: 'marraine_no_longer_validated' }
//
// Mocks : @/lib/supabase/server, @sentry/nextjs, next/server, next/headers,
//         next/cache, @/lib/stripe, @/lib/parrainage-codes, @/lib/emails,
//         @/lib/rate-limit-hash, @/lib/get-client-ip, @/lib/parrainage-detection.

import { describe, it, expect, beforeEach, vi } from 'vitest'

// ─── Hoisted mocks ────────────────────────────────────────────────────────────
const {
  mockCreateClient,
  mockCaptureMessage,
  mockCaptureException,
  mockAfter,
  mockRevalidatePath,
  mockStripeRetrieve,
  mockGenerateCodeForUserSystem,
  mockHashRateLimitKey,
  mockGetClientIpOrUnknown,
  mockNormalizeEmail,
  mockStripeCouponsCreate,
  mockStripeSubsUpdate,
  mockHasActiveSubscription,
  mockGetSubscriptionStatus,
  mockSendParrainageRecompense,
} = vi.hoisted(() => ({
  mockCreateClient: vi.fn(),
  mockCaptureMessage: vi.fn(),
  mockCaptureException: vi.fn(),
  mockAfter: vi.fn(),
  mockRevalidatePath: vi.fn(),
  mockStripeRetrieve: vi.fn(),
  mockGenerateCodeForUserSystem: vi.fn(),
  mockHashRateLimitKey: vi.fn().mockReturnValue('hash'),
  mockGetClientIpOrUnknown: vi.fn().mockReturnValue('127.0.0.1'),
  mockNormalizeEmail: vi.fn().mockReturnValue(''),
  mockStripeCouponsCreate: vi.fn(),
  mockStripeSubsUpdate: vi.fn(),
  mockHasActiveSubscription: vi.fn(),
  mockGetSubscriptionStatus: vi.fn(),
  mockSendParrainageRecompense: vi.fn(),
}))

vi.mock('@/lib/supabase/server', () => ({ createClient: mockCreateClient }))
vi.mock('@sentry/nextjs', () => ({
  captureMessage: mockCaptureMessage,
  captureException: mockCaptureException,
}))
vi.mock('next/server', () => ({
  after: mockAfter.mockImplementation((fn: () => Promise<void>) => fn()),
  // 8.A.3 : le cron `confirm-parrainages` utilise NextResponse.json(...) en
  // sortie. On fournit une implémentation minimale qui renvoie un objet
  // avec une méthode async `.json()` retournant le payload sérialisé.
  NextResponse: {
    json: (data: unknown, init?: { status?: number }) => ({
      status: init?.status ?? 200,
      json: async () => data,
    }),
  },
}))
vi.mock('next/cache', () => ({ revalidatePath: mockRevalidatePath }))
vi.mock('next/headers', () => ({
  headers: vi.fn().mockResolvedValue(new Map()),
}))
vi.mock('@/lib/stripe', () => ({
  stripe: {
    checkout: { sessions: { retrieve: mockStripeRetrieve } },
    coupons: { create: mockStripeCouponsCreate },
    subscriptions: { update: mockStripeSubsUpdate },
  },
}))
vi.mock('@/lib/parrainage-codes', () => ({
  generateCode: vi.fn().mockReturnValue('ABCD2345'),
  generateCodeForUserSystem: mockGenerateCodeForUserSystem,
}))
vi.mock('@/lib/emails', () => ({
  sendParrainageBienvenueParrain: vi.fn(),
  sendParrainageBienvenueMarraine: vi.fn(),
  sendParrainageFilleuleConfirmation: vi.fn(),
  sendAdminParrainageFlag: vi.fn(),
  sendParrainageRecompense: mockSendParrainageRecompense,
}))
vi.mock('@/lib/subscription-helpers', () => ({
  hasActiveSubscription: mockHasActiveSubscription,
  getSubscriptionStatus: mockGetSubscriptionStatus,
}))
vi.mock('@/lib/rate-limit-hash', () => ({ hashRateLimitKey: mockHashRateLimitKey }))
vi.mock('@/lib/get-client-ip', () => ({ getClientIpOrUnknown: mockGetClientIpOrUnknown }))
vi.mock('@/lib/parrainage-detection', () => ({ normalizeEmail: mockNormalizeEmail }))

import {
  validateCode,
  createParrainageRelation,
  confirmParrainageOnSuccess,
} from '@/app/actions/parrainage'
import { GET as cronConfirmParrainagesGET } from '@/app/api/cron/confirm-parrainages/route'
import { createSupabaseFromMock } from './_lib/supabase-mock'

// ─── Constantes ───────────────────────────────────────────────────────────────
const VALID_CODE = 'ABCD2345'
const PARRAIN_ACCOMPAGNE_ID = 'a1a1a1a1-0000-0000-0000-000000000001'
const PARRAIN_ACCOMPAGNANT_ID = 'b2b2b2b2-0000-0000-0000-000000000002'
const FILLEUL_ACCOMPAGNANT_ID = 'c3c3c3c3-0000-0000-0000-000000000003'
const FILLEUL_ACCOMPAGNE_ID = 'd4d4d4d4-0000-0000-0000-000000000004'
const PARRAINAGE_ID = 'e5e5e5e5-0000-0000-0000-000000000005'
const SESSION_ID = 'cs_test_abc123'

// ─── Mock rate-limit (toujours autorisé) ─────────────────────────────────────
function buildRpcAllowed() {
  return {
    rpc: vi.fn().mockReturnValue({
      select: vi.fn().mockReturnThis(),
      maybeSingle: vi.fn().mockResolvedValue({ data: true, error: null }),
    }),
  }
}

beforeEach(() => {
  vi.clearAllMocks()
  mockAfter.mockImplementation((fn: () => Promise<void>) => fn())
  mockGenerateCodeForUserSystem.mockResolvedValue({ code: 'NEWCODE1', created: true })
})

// ═══════════════════════════════════════════════════════════════════════════════
// Scénario 1 — validateCode : parrain accompagné + abonnement active -> valid:true
// ═══════════════════════════════════════════════════════════════════════════════
describe('validateCode — parrain accompagné', () => {
  it('SC1 : sub active -> { valid: true }', async () => {
    // Séquence des appels supabaseAdmin.from() dans validateCode :
    //  call 1 : rpc try_consume_rate_limit (via buildRpcAllowed)
    //  call 2 : parrainages_codes.select('user_id').eq('code', code).maybeSingle()
    //  call 3 : users.select('role, first_name').eq('id', userId).maybeSingle()  [NOUVEAU]
    //  call 4 : subscriptions.select('status').eq('user_id', userId).maybeSingle()
    const rpc = buildRpcAllowed()
    const { fromMock } = createSupabaseFromMock({
      parrainages_codes: [{ data: { user_id: PARRAIN_ACCOMPAGNE_ID }, error: null }],
      users: [{ data: { role: 'accompagne', first_name: 'Alice' }, error: null }],
      subscriptions: [{ data: { status: 'active' }, error: null }],
    })
    mockCreateClient.mockResolvedValue({ ...rpc, from: fromMock })

    const result = await validateCode(VALID_CODE)

    expect(result).toEqual({
      valid: true,
      marraineId: PARRAIN_ACCOMPAGNE_ID,
      marraineFirstName: 'Alice',
    })
  })

  it('SC2 : sub cancelled -> { valid: false, reason: "marraine_subscription_inactive" }', async () => {
    const rpc = buildRpcAllowed()
    const { fromMock } = createSupabaseFromMock({
      parrainages_codes: [{ data: { user_id: PARRAIN_ACCOMPAGNE_ID }, error: null }],
      users: [{ data: { role: 'accompagne', first_name: 'Alice' }, error: null }],
      subscriptions: [{ data: { status: 'cancelled' }, error: null }],
    })
    mockCreateClient.mockResolvedValue({ ...rpc, from: fromMock })

    const result = await validateCode(VALID_CODE)

    expect(result).toEqual({ valid: false, reason: 'marraine_subscription_inactive' })
  })
})

// ═══════════════════════════════════════════════════════════════════════════════
// Scénario 3 — validateCode : parrain accompagnant path historique (non-régression)
// ═══════════════════════════════════════════════════════════════════════════════
describe('validateCode — parrain accompagnant (non-régression)', () => {
  it('SC3 : validation_status=valide + sub active -> { valid: true }', async () => {
    const rpc = buildRpcAllowed()
    const { fromMock } = createSupabaseFromMock({
      parrainages_codes: [{ data: { user_id: PARRAIN_ACCOMPAGNANT_ID }, error: null }],
      users: [
        { data: { role: 'accompagnant', first_name: 'Bob' }, error: null },
        {
          data: {
            first_name: 'Bob',
            accompagnants_profiles: [{ validation_status: 'valide' }],
          },
          error: null,
        },
      ],
      subscriptions: [{ data: { status: 'active' }, error: null }],
    })
    mockCreateClient.mockResolvedValue({ ...rpc, from: fromMock })

    const result = await validateCode(VALID_CODE)

    expect(result).toEqual({
      valid: true,
      marraineId: PARRAIN_ACCOMPAGNANT_ID,
      marraineFirstName: 'Bob',
    })
  })
})

// ═══════════════════════════════════════════════════════════════════════════════
// Scénario 4 — createParrainageRelation : filleul accompagné -> invalid_filleul_role
// ═══════════════════════════════════════════════════════════════════════════════
describe('createParrainageRelation — guard invalid_filleul_role', () => {
  it('SC4 : filleul accompagné -> { ok:false, reason:"invalid_filleul_role" } + Sentry', async () => {
    // validateCode interne appelé en premier -> parrain accompagné valide.
    // createParrainageRelation post-validateCode lookup guard filleul -> role accompagné (interdit).
    const rpcValidate = buildRpcAllowed()
    const { fromMock } = createSupabaseFromMock({
      parrainages_codes: [{ data: { user_id: PARRAIN_ACCOMPAGNE_ID }, error: null }],
      users: [
        { data: { role: 'accompagne', first_name: 'Alice' }, error: null }, // validateCode
        { data: { role: 'accompagne' }, error: null },                      // guard filleul
      ],
      subscriptions: [{ data: { status: 'active' }, error: null }],
    })
    mockCreateClient.mockResolvedValue({ ...rpcValidate, from: fromMock })

    const result = await createParrainageRelation({
      code: VALID_CODE,
      filleuleId: FILLEUL_ACCOMPAGNE_ID,
      ipInscription: null,
    })

    expect(result).toEqual({ ok: false, reason: 'invalid_filleul_role' })
    expect(mockCaptureMessage).toHaveBeenCalledWith(
      'parrainage invalid filleul role',
      expect.objectContaining({
        level: 'warning',
        tags: expect.objectContaining({ signal: 'invalid-filleul-role' }),
        extra: expect.objectContaining({ filleuleId: FILLEUL_ACCOMPAGNE_ID }),
      }),
    )
  })
})

// ═══════════════════════════════════════════════════════════════════════════════
// Scénario 5 — createParrainageRelation : golden path accompagné -> accompagnant
// ═══════════════════════════════════════════════════════════════════════════════
describe('createParrainageRelation — golden path symétrique accompagné→accompagnant', () => {
  it('SC5 : parrain accompagné + filleul accompagnant -> { ok:true }', async () => {
    const rpc = buildRpcAllowed()

    // Séquence des from() dans cet ordre :
    //  validateCode : parrainages_codes / users(role+fn) / subscriptions
    //  guard filleul : users(role=accompagnant)
    //  idempotence : parrainages.select.eq.eq.in.maybeSingle -> null (no existing)
    //  INSERT parrainages -> { id: PARRAINAGE_ID }
    //  detectBlacklist : users(email) / (pas d'autres filleules)
    //  UPDATE users(parrainee_par)
    //  loadNamesForAdminEmail : users(marraine) / users(filleule)
    const { fromMock, capturedUpdates } = createSupabaseFromMock({
      parrainages_codes: [{ data: { user_id: PARRAIN_ACCOMPAGNE_ID }, error: null }],
      subscriptions: [{ data: { status: 'active' }, error: null }],
      users: [
        { data: { role: 'accompagne', first_name: 'Alice' }, error: null }, // validateCode
        { data: { role: 'accompagnant' }, error: null },                    // guard filleul
        { data: null, error: null },                                         // detectBlacklist email lookup
        { data: { email: 'alice@ex.fr', first_name: 'Alice' }, error: null }, // loadNames marraine
        { data: { email: 'carl@ex.fr', first_name: 'Carl' }, error: null },   // loadNames filleule
      ],
      // parrainages : (1) idempotence check -> null  (2) INSERT -> { id: PARRAINAGE_ID }
      parrainages: [
        { data: null, error: null },
        { data: { id: PARRAINAGE_ID }, error: null },
      ],
    })
    mockCreateClient.mockResolvedValue({ ...rpc, from: fromMock })

    const result = await createParrainageRelation({
      code: VALID_CODE,
      filleuleId: FILLEUL_ACCOMPAGNANT_ID,
      ipInscription: null,
    })

    expect(result).toEqual({
      ok: true,
      parrainageId: PARRAINAGE_ID,
      marraineId: PARRAIN_ACCOMPAGNE_ID,
    })
    expect(mockCaptureMessage).not.toHaveBeenCalledWith(
      'parrainage invalid filleul role',
      expect.anything(),
    )

    // AC4 — vérifie qu'un UPDATE a bien été émis sur la table users avec
    // parrainee_par = parrain.id (clé du bypass onboarding downstream).
    const parraineParUpdate = capturedUpdates.find(
      (u) =>
        u.table === 'users' &&
        (u.payload as Record<string, unknown>)?.parrainee_par === PARRAIN_ACCOMPAGNE_ID,
    )
    expect(parraineParUpdate).toBeDefined()
  })
})

// ═══════════════════════════════════════════════════════════════════════════════
// Scénario 6 — confirmParrainageOnSuccess : parrain accompagné + sub active -> ok:true
// ═══════════════════════════════════════════════════════════════════════════════
describe('confirmParrainageOnSuccess — parrain accompagné', () => {
  function buildConfirmMocks(parrainSubStatus: string) {
    // Stripe session
    mockStripeRetrieve.mockResolvedValue({
      status: 'complete',
      payment_status: 'paid',
      metadata: { parrainage_code: VALID_CODE, user_id: FILLEUL_ACCOMPAGNANT_ID },
    })

    // Séquence des from() dans confirmParrainageOnSuccess :
    //  createClient() (sans serviceRole) : auth.getUser() — mocké via supabase.auth
    //  createClient({ serviceRole }) :
    //    1. parrainages.select.eq.eq.order.limit.maybeSingle -> parrainage row
    //    2. users.select(role).eq(marraine_id).maybeSingle   -> role parrain [NOUVEAU]
    //    3. subscriptions.select.eq.maybeSingle               -> sub parrain accompagné [NOUVEAU]
    //    4. accompagnants_profiles.select.eq.maybeSingle      -> filleule profile
    //    5. parrainages.update.eq.eq.select -> lockedRows = [{id}]
    //    6. accompagnants_profiles.update.eq.eq.select -> validationUpdated = [{id}]
    //    (generateCodeForUserSystem mocké)
    //    7. users.select(email,fn marraine).eq.single
    //    8. users.select(email,fn filleule).eq.single
    //    9. admin_actions_log.insert

    const { fromMock: adminFrom } = createSupabaseFromMock({
      // 1 : parrainage row (select.eq.eq.order.limit.maybeSingle)
      // 2 : update parrainages (update.eq.eq.select -> lockedRows)
      parrainages: [
        {
          data: {
            id: PARRAINAGE_ID,
            statut: 'inscrite',
            marraine_id: PARRAIN_ACCOMPAGNE_ID,
            filleule_id: FILLEUL_ACCOMPAGNANT_ID,
          },
          error: null,
        },
        { data: [{ id: PARRAINAGE_ID }], error: null }, // update.select -> lockedRows (length=1)
      ],
      // role parrain (maybeSingle) — email/fn marraine+filleule (single×2)
      users: [
        { data: { role: 'accompagne' }, error: null },
        { data: { email: 'x@ex.fr', first_name: 'X' }, error: null },
        { data: { email: 'x@ex.fr', first_name: 'X' }, error: null },
      ],
      subscriptions: [{ data: { status: parrainSubStatus }, error: null }],
      // filleule profile (maybeSingle) — update accompagnants_profiles (update.eq.eq.select)
      accompagnants_profiles: [
        { data: { id: 'profile-filleule-id' }, error: null },
        { data: [{ id: 'profile-filleule-id' }], error: null }, // update.select -> validationUpdated
      ],
    })

    // Client non-admin (auth.getUser)
    const authClient = {
      auth: {
        getUser: vi.fn().mockResolvedValue({
          data: { user: { id: FILLEUL_ACCOMPAGNANT_ID } },
        }),
      },
    }

    mockCreateClient
      .mockResolvedValueOnce(authClient)
      .mockResolvedValue({ from: adminFrom })
  }

  it('SC6 : parrain accompagné + sub active -> { ok: true } sans lookup accompagnants_profiles', async () => {
    buildConfirmMocks('active')

    const result = await confirmParrainageOnSuccess(SESSION_ID)

    expect(result).toEqual({ ok: true })
  })

  it('SC7 : parrain accompagné + sub cancelled -> { ok: false, reason: "marraine_no_longer_validated" }', async () => {
    buildConfirmMocks('cancelled')

    const result = await confirmParrainageOnSuccess(SESSION_ID)

    expect(result).toEqual({ ok: false, reason: 'marraine_no_longer_validated' })
  })
})

// ═══════════════════════════════════════════════════════════════════════════════
// Story 8.A.3 (F-Epic8-A3) — cron `confirm-parrainages` récompense role-aware
// ─────────────────────────────────────────────────────────────────────────────
// Scénarios SC8-SC11 : branching `users.role` du parrain pour brancher le
// pré-check `accompagnants_profiles` (skip si accompagne) + enrichir
// `coupon.metadata.role_parrain` + `admin_actions_log.details.role_parrain` +
// `sendParrainageRecompense({ role })`.
// ═══════════════════════════════════════════════════════════════════════════════

function buildClaimRpc(claimResult: { claimed: boolean; total_recompenses?: number } | null) {
  return vi.fn((rpcName: string) => {
    if (rpcName === 'parrainage_increment_compteur') {
      return Promise.resolve({ data: 5, error: null })
    }
    if (rpcName === 'parrainage_claim_recompense') {
      return Promise.resolve({ data: [claimResult], error: null })
    }
    if (rpcName === 'parrainage_rollback_recompense') {
      return Promise.resolve({ data: null, error: null })
    }
    return Promise.resolve({ data: null, error: null })
  })
}

const MARRAINE_ID = 'f6f6f6f6-0000-0000-0000-000000000006'
const FILLEUL_ID = 'e7e7e7e7-0000-0000-0000-000000000007'
const PARRAINAGE_ROW_ID = 'd8d8d8d8-0000-0000-0000-000000000008'
const SUB_ID = 'sub_test_8a3'

// Le handler n'utilise que `request.headers.get('authorization')`. On évite
// `new NextRequest(...)` car le mock global de `next/server` ne réexporte pas
// cette classe (elle n'est pas listée dans le `vi.mock('next/server', ...)`
// du haut de fichier qui ne mocke que `after`).
function buildCronRequest(): unknown {
  process.env.CRON_SECRET = 'test_secret'
  return {
    headers: { get: (k: string) => (k.toLowerCase() === 'authorization' ? 'Bearer test_secret' : null) },
  }
}

describe('cron confirm-parrainages — récompense role-aware (8.A.3)', () => {
  beforeEach(() => {
    mockHasActiveSubscription.mockReset()
    mockGetSubscriptionStatus.mockReset()
    mockStripeCouponsCreate.mockReset()
    mockStripeSubsUpdate.mockReset()
    mockSendParrainageRecompense.mockReset()
  })

  it('SC8 : parrain accompagne + sub active + palier atteint -> coupon + email + log role_parrain=accompagne', async () => {
    mockHasActiveSubscription.mockResolvedValue(true)
    mockGetSubscriptionStatus.mockResolvedValue({
      active: true,
      stripeSubscriptionId: SUB_ID,
      status: 'active',
      cancelAt: null,
      planType: 'mensuel',
    })
    mockStripeCouponsCreate.mockResolvedValue({ id: 'coupon_test_8a3' })
    mockStripeSubsUpdate.mockResolvedValue({})
    mockSendParrainageRecompense.mockResolvedValue(undefined)

    const { fromMock, capturedInserts } = createSupabaseFromMock({
      parrainages: [
        // 1er from('parrainages') : .select.eq.lte.limit -> array de rows
        { data: [{ id: PARRAINAGE_ROW_ID, marraine_id: MARRAINE_ID, filleule_id: FILLEUL_ID, filleule_abonnee_at: new Date().toISOString() }], error: null },
        // 2e from('parrainages') : update.eq.eq.select -> swapped = [{id}]
        { data: [{ id: PARRAINAGE_ROW_ID }], error: null },
      ],
      parrainages_codes: [
        { data: { compteur_confirmes: 4, total_recompenses: 0, code: 'CODE8A3X' }, error: null },
      ],
      users: [
        // lookup role parrain (8.A.3 nouveau)
        { data: { role: 'accompagne' }, error: null },
        // lookup email/first_name marraine
        { data: { email: 'parrain@ex.fr', first_name: 'Pierre' }, error: null },
      ],
      // accompagnants_profiles : ne doit JAMAIS être appelée pour role=accompagne (assertion SC8)
      accompagnants_profiles: [],
      admin_actions_log: [],
    })

    const rpc = buildClaimRpc({ claimed: true, total_recompenses: 1 })

    mockCreateClient.mockResolvedValue({ from: fromMock, rpc })

    // @ts-expect-error — buildCronRequest renvoie un objet façon NextRequest minimal
    const response = await cronConfirmParrainagesGET(buildCronRequest())
    const json = await response.json()

    expect(json).toMatchObject({ processed: 1, confirmed: 1, rewards: 1, errors: 0 })

    // accompagnants_profiles JAMAIS appelée (FLAG-A propagé)
    expect(fromMock).not.toHaveBeenCalledWith('accompagnants_profiles')

    // coupon.metadata.role_parrain
    expect(mockStripeCouponsCreate).toHaveBeenCalledTimes(1)
    expect(mockStripeCouponsCreate.mock.calls[0][0].metadata).toMatchObject({
      role_parrain: 'accompagne',
      type: 'parrainage_recompense',
    })

    // admin_actions_log.details.role_parrain
    const adminLogInserts = (capturedInserts.admin_actions_log ?? []) as Array<Record<string, unknown>>
    const appliedLog = adminLogInserts.find((l) => l.action_type === 'parrainage_recompense_appliquee')
    expect(appliedLog).toBeDefined()
    expect((appliedLog?.details as Record<string, unknown>)?.role_parrain).toBe('accompagne')

    // sendParrainageRecompense reçoit role: 'accompagne'
    expect(mockSendParrainageRecompense).toHaveBeenCalledTimes(1)
    expect(mockSendParrainageRecompense.mock.calls[0][0]).toMatchObject({
      role: 'accompagne',
      email: 'parrain@ex.fr',
    })
  })

  it('SC9 : parrain accompagne + sub cancelled -> skip (pre-check marraineSub.active), pas de coupon ni claim', async () => {
    mockHasActiveSubscription.mockResolvedValue(true)
    mockGetSubscriptionStatus.mockResolvedValue({
      active: false,
      stripeSubscriptionId: null,
      status: 'cancelled',
      cancelAt: null,
      planType: 'mensuel',
    })
    mockStripeCouponsCreate.mockResolvedValue({ id: 'coupon_never_created' })

    const { fromMock } = createSupabaseFromMock({
      parrainages: [
        { data: [{ id: PARRAINAGE_ROW_ID, marraine_id: MARRAINE_ID, filleule_id: FILLEUL_ID, filleule_abonnee_at: new Date().toISOString() }], error: null },
        { data: [{ id: PARRAINAGE_ROW_ID }], error: null },
      ],
      parrainages_codes: [
        { data: { compteur_confirmes: 4, total_recompenses: 0, code: 'CODE8A3Y' }, error: null },
      ],
      users: [],
      accompagnants_profiles: [],
      admin_actions_log: [],
    })

    const rpc = buildClaimRpc({ claimed: true, total_recompenses: 1 })
    mockCreateClient.mockResolvedValue({ from: fromMock, rpc })

    // @ts-expect-error — buildCronRequest renvoie un objet façon NextRequest minimal
    const response = await cronConfirmParrainagesGET(buildCronRequest())
    const json = await response.json()

    // Confirme=1 (statut bascule abonnee->confirme) mais rewards=0 (sub inactive)
    expect(json).toMatchObject({ processed: 1, confirmed: 1, rewards: 0 })
    expect(mockStripeCouponsCreate).not.toHaveBeenCalled()
    expect(mockStripeSubsUpdate).not.toHaveBeenCalled()
    expect(mockSendParrainageRecompense).not.toHaveBeenCalled()
    // claim_recompense ne doit pas avoir été appelée non plus (skip avant)
    const rpcCallsClaim = (rpc as unknown as { mock: { calls: unknown[][] } }).mock.calls.filter(
      (c) => c[0] === 'parrainage_claim_recompense',
    )
    expect(rpcCallsClaim).toHaveLength(0)
  })

  it('SC10 : parrain accompagnant + validation_status=valide + sub active -> coupon role_parrain=accompagnant (non-régression Epic 2)', async () => {
    mockHasActiveSubscription.mockResolvedValue(true)
    mockGetSubscriptionStatus.mockResolvedValue({
      active: true,
      stripeSubscriptionId: SUB_ID,
      status: 'active',
      cancelAt: null,
      planType: 'mensuel',
    })
    mockStripeCouponsCreate.mockResolvedValue({ id: 'coupon_test_8a3_acc' })
    mockStripeSubsUpdate.mockResolvedValue({})
    mockSendParrainageRecompense.mockResolvedValue(undefined)

    const { fromMock, capturedInserts } = createSupabaseFromMock({
      parrainages: [
        { data: [{ id: PARRAINAGE_ROW_ID, marraine_id: MARRAINE_ID, filleule_id: FILLEUL_ID, filleule_abonnee_at: new Date().toISOString() }], error: null },
        { data: [{ id: PARRAINAGE_ROW_ID }], error: null },
      ],
      parrainages_codes: [
        { data: { compteur_confirmes: 4, total_recompenses: 0, code: 'CODE8A3Z' }, error: null },
      ],
      users: [
        // lookup role parrain
        { data: { role: 'accompagnant' }, error: null },
        // lookup email/first_name
        { data: { email: 'acc@ex.fr', first_name: 'Anne' }, error: null },
      ],
      accompagnants_profiles: [
        { data: { validation_status: 'valide' }, error: null },
      ],
      admin_actions_log: [],
    })

    const rpc = buildClaimRpc({ claimed: true, total_recompenses: 1 })
    mockCreateClient.mockResolvedValue({ from: fromMock, rpc })

    // @ts-expect-error — buildCronRequest renvoie un objet façon NextRequest minimal
    const response = await cronConfirmParrainagesGET(buildCronRequest())
    const json = await response.json()

    expect(json).toMatchObject({ processed: 1, confirmed: 1, rewards: 1, errors: 0 })

    // accompagnants_profiles APPELÉE (path accompagnant non-régression)
    expect(fromMock).toHaveBeenCalledWith('accompagnants_profiles')

    expect(mockStripeCouponsCreate.mock.calls[0][0].metadata).toMatchObject({
      role_parrain: 'accompagnant',
    })

    const adminLogInserts = (capturedInserts.admin_actions_log ?? []) as Array<Record<string, unknown>>
    const appliedLog = adminLogInserts.find((l) => l.action_type === 'parrainage_recompense_appliquee')
    expect((appliedLog?.details as Record<string, unknown>)?.role_parrain).toBe('accompagnant')

    expect(mockSendParrainageRecompense.mock.calls[0][0]).toMatchObject({
      role: 'accompagnant',
    })
  })

  it('SC11 : parrain accompagnant + validation_status=a_completer -> skip M3, pas de claim', async () => {
    mockHasActiveSubscription.mockResolvedValue(true)
    mockGetSubscriptionStatus.mockResolvedValue({
      active: true,
      stripeSubscriptionId: SUB_ID,
      status: 'active',
      cancelAt: null,
      planType: 'mensuel',
    })

    const { fromMock } = createSupabaseFromMock({
      parrainages: [
        { data: [{ id: PARRAINAGE_ROW_ID, marraine_id: MARRAINE_ID, filleule_id: FILLEUL_ID, filleule_abonnee_at: new Date().toISOString() }], error: null },
        { data: [{ id: PARRAINAGE_ROW_ID }], error: null },
      ],
      parrainages_codes: [
        { data: { compteur_confirmes: 4, total_recompenses: 0, code: 'CODE8A3W' }, error: null },
      ],
      users: [
        { data: { role: 'accompagnant' }, error: null },
      ],
      accompagnants_profiles: [
        { data: { validation_status: 'a_completer' }, error: null },
      ],
      admin_actions_log: [],
    })

    const rpc = buildClaimRpc({ claimed: true, total_recompenses: 1 })
    mockCreateClient.mockResolvedValue({ from: fromMock, rpc })

    // @ts-expect-error — buildCronRequest renvoie un objet façon NextRequest minimal
    const response = await cronConfirmParrainagesGET(buildCronRequest())
    const json = await response.json()

    expect(json).toMatchObject({ processed: 1, confirmed: 1, rewards: 0 })
    expect(fromMock).toHaveBeenCalledWith('accompagnants_profiles')
    expect(mockStripeCouponsCreate).not.toHaveBeenCalled()
    expect(mockSendParrainageRecompense).not.toHaveBeenCalled()
    const rpcCallsClaim = (rpc as unknown as { mock: { calls: unknown[][] } }).mock.calls.filter(
      (c) => c[0] === 'parrainage_claim_recompense',
    )
    expect(rpcCallsClaim).toHaveLength(0)
  })
})
