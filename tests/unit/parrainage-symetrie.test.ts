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
  sendParrainageFilleulConfirmation: vi.fn(),
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
  // 9.A.2.c : SC32-SC35 ciblent revokeFilleuleValidationFromWebhook directement
  // (revokeFilleuleValidation interne non exporte est teste via le webhook).
  revokeFilleuleValidationFromWebhook,
  // 9.A.2.c : SC36-SC40 generateCodeForUser (idempotence + auth + insert paths).
  generateCodeForUser,
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

// ═══════════════════════════════════════════════════════════════════════════════
// Story 9.A.2.b (F-Epic9-A2) — palier 2 coverage : detectBlacklist + paths edge
// confirmParrainageOnSuccess. SC12-SC19 ciblent les branches non couvertes
// identifiees par defer ligne 13 (`deferred-work.md`).
// ═══════════════════════════════════════════════════════════════════════════════

// ─── SC12-SC16 : detectBlacklist (helper interne, teste via createParrainageRelation)
//
// Pattern : detectBlacklist n'est PAS exporte. On le teste via createParrainageRelation
// qui l'appelle apres l'INSERT initial. On observe le resultat (return + side effects)
// pour valider les 5 branches : blocage meme_email direct, blocage meme_email P9
// multi-filleules, flag meme_ip, no match, edge case email/IP vides.

describe('detectBlacklist (via createParrainageRelation) — branches non couvertes 9.A.2.b', () => {
  it('SC12 : blocage meme_email direct marraine↔filleule -> { ok:false, reason:"blacklist_meme_email" }', async () => {
    // Forcer normalizeEmail a retourner la meme valeur normalisee pour les 2 emails.
    mockNormalizeEmail.mockImplementation((email: string) =>
      (email || '').toLowerCase().trim(),
    )

    const rpc = buildRpcAllowed()
    const { fromMock } = createSupabaseFromMock({
      parrainages_codes: [{ data: { user_id: PARRAIN_ACCOMPAGNE_ID }, error: null }],
      subscriptions: [{ data: { status: 'active' }, error: null }],
      users: [
        { data: { role: 'accompagne', first_name: 'Alice' }, error: null }, // validateCode
        { data: { role: 'accompagnant' }, error: null },                    // guard filleul
        { data: { email: 'alice@ex.fr' }, error: null },                    // detectBlacklist : marraine email
        { data: { first_name: 'Alice', last_name: 'M' }, error: null },     // loadNames marraine
        { data: { first_name: 'Carl', last_name: 'F' }, error: null },      // loadNames filleule
      ],
      parrainages: [
        { data: null, error: null },                          // idempotence check
        { data: { id: PARRAINAGE_ID }, error: null },         // INSERT
      ],
    })
    mockCreateClient.mockResolvedValue({ ...rpc, from: fromMock })

    const result = await createParrainageRelation({
      code: VALID_CODE,
      filleuleId: FILLEUL_ACCOMPAGNANT_ID,
      ipInscription: null,
      filleuleEmail: 'alice@ex.fr', // meme email que marraine
    })

    expect(result).toEqual({ ok: false, reason: 'blacklist_meme_email' })
  })

  it('SC13 : blocage meme_email via P9 multi-filleules historiques', async () => {
    mockNormalizeEmail.mockImplementation((email: string) =>
      (email || '').toLowerCase().trim(),
    )

    const rpc = buildRpcAllowed()
    const { fromMock } = createSupabaseFromMock({
      parrainages_codes: [{ data: { user_id: PARRAIN_ACCOMPAGNE_ID }, error: null }],
      subscriptions: [{ data: { status: 'active' }, error: null }],
      users: [
        { data: { role: 'accompagne', first_name: 'Alice' }, error: null }, // validateCode
        { data: { role: 'accompagnant' }, error: null },                    // guard filleul
        { data: { email: 'marraine-other@ex.fr' }, error: null },           // detectBlacklist : marraine email (different)
        { data: [{ email: 'carl@ex.fr' }], error: null },                   // detectBlacklist : lookup other filleules emails matching
        { data: { first_name: 'Alice', last_name: 'M' }, error: null },     // loadNames marraine
        { data: { first_name: 'Carl', last_name: 'F' }, error: null },      // loadNames filleule
      ],
      parrainages: [
        { data: null, error: null },                                                          // idempotence check
        { data: { id: PARRAINAGE_ID }, error: null },                                         // INSERT
        { data: [{ filleule_id: 'other-filleule-id' }], error: null },                        // detectBlacklist : otherFilleulesIds non vide
      ],
    })
    mockCreateClient.mockResolvedValue({ ...rpc, from: fromMock })

    const result = await createParrainageRelation({
      code: VALID_CODE,
      filleuleId: FILLEUL_ACCOMPAGNANT_ID,
      ipInscription: null,
      filleuleEmail: 'carl@ex.fr',
    })

    expect(result).toEqual({ ok: false, reason: 'blacklist_meme_email' })
  })

  it('SC14 : flag meme_ip detecte (autre parrainage meme marraine, meme IP) -> { ok: true } + flag', async () => {
    mockNormalizeEmail.mockImplementation((email: string) =>
      (email || '').toLowerCase().trim(),
    )

    const rpc = vi.fn((rpcName: string) => {
      if (rpcName === 'try_consume_rate_limit') {
        return {
          select: vi.fn().mockReturnThis(),
          maybeSingle: vi.fn().mockResolvedValue({ data: true, error: null }),
        }
      }
      if (rpcName === 'merge_parrainage_flag_suspicion') {
        return {
          select: vi.fn().mockReturnThis(),
          maybeSingle: vi.fn().mockResolvedValue({ data: { was_added: true }, error: null }),
        }
      }
      return { select: vi.fn().mockReturnThis(), maybeSingle: vi.fn().mockResolvedValue({ data: null, error: null }) }
    })

    const { fromMock } = createSupabaseFromMock({
      parrainages_codes: [{ data: { user_id: PARRAIN_ACCOMPAGNE_ID }, error: null }],
      subscriptions: [{ data: { status: 'active' }, error: null }],
      users: [
        { data: { role: 'accompagne', first_name: 'Alice' }, error: null }, // validateCode
        { data: { role: 'accompagnant' }, error: null },                    // guard filleul
        { data: { email: 'marraine-only@ex.fr' }, error: null },            // detectBlacklist : marraine email (different)
        { data: { first_name: 'Alice', last_name: 'M' }, error: null },     // loadNames marraine
        { data: { first_name: 'Carl', last_name: 'F' }, error: null },      // loadNames filleule
      ],
      parrainages: [
        { data: null, error: null },                                                          // idempotence check
        { data: { id: PARRAINAGE_ID }, error: null },                                         // INSERT
        { data: [], error: null },                                                            // otherFilleulesIds vide (skip P9)
        { data: [{ id: 'parrainage-other-id' }], error: null },                               // ipMatches non vide
      ],
    })

    mockCreateClient.mockResolvedValue({ rpc, from: fromMock })

    const result = await createParrainageRelation({
      code: VALID_CODE,
      filleuleId: FILLEUL_ACCOMPAGNANT_ID,
      ipInscription: '192.168.1.1',
      filleuleEmail: 'carl@ex.fr',
    })

    expect(result).toEqual({
      ok: true,
      parrainageId: PARRAINAGE_ID,
      marraineId: PARRAIN_ACCOMPAGNE_ID,
    })
    // Le merge RPC a ete appele (signal meme_ip declenche)
    expect(rpc).toHaveBeenCalledWith('merge_parrainage_flag_suspicion', expect.objectContaining({
      p_flag: 'meme_ip',
    }))
  })

  it('SC15 : no match (return {}) -> { ok: true } sans flag ni blocage', async () => {
    mockNormalizeEmail.mockImplementation((email: string) =>
      (email || '').toLowerCase().trim(),
    )

    const rpc = buildRpcAllowed()
    const { fromMock } = createSupabaseFromMock({
      parrainages_codes: [{ data: { user_id: PARRAIN_ACCOMPAGNE_ID }, error: null }],
      subscriptions: [{ data: { status: 'active' }, error: null }],
      users: [
        { data: { role: 'accompagne', first_name: 'Alice' }, error: null }, // validateCode
        { data: { role: 'accompagnant' }, error: null },                    // guard filleul
        { data: { email: 'marraine-different@ex.fr' }, error: null },       // detectBlacklist : marraine email different
        { data: { first_name: 'Alice', last_name: 'M' }, error: null },     // loadNames marraine
        { data: { first_name: 'Carl', last_name: 'F' }, error: null },      // loadNames filleule
      ],
      parrainages: [
        { data: null, error: null },                                                          // idempotence check
        { data: { id: PARRAINAGE_ID }, error: null },                                         // INSERT
        { data: [], error: null },                                                            // otherFilleulesIds vide
      ],
    })
    mockCreateClient.mockResolvedValue({ ...rpc, from: fromMock })

    const result = await createParrainageRelation({
      code: VALID_CODE,
      filleuleId: FILLEUL_ACCOMPAGNANT_ID,
      ipInscription: null, // pas d'IP -> skip bloc IP
      filleuleEmail: 'carl@ex.fr',
    })

    expect(result).toEqual({
      ok: true,
      parrainageId: PARRAINAGE_ID,
      marraineId: PARRAIN_ACCOMPAGNE_ID,
    })
  })

  it('SC16 : edge cases filleuleEmail null + ipInscription empty -> { ok: true } sans Sentry', async () => {
    // mockNormalizeEmail retourne '' pour input vide
    mockNormalizeEmail.mockReturnValue('')

    const rpc = buildRpcAllowed()
    const { fromMock } = createSupabaseFromMock({
      parrainages_codes: [{ data: { user_id: PARRAIN_ACCOMPAGNE_ID }, error: null }],
      subscriptions: [{ data: { status: 'active' }, error: null }],
      users: [
        { data: { role: 'accompagne', first_name: 'Alice' }, error: null }, // validateCode
        { data: { role: 'accompagnant' }, error: null },                    // guard filleul
        { data: { first_name: 'Alice', last_name: 'M' }, error: null },     // loadNames marraine
        { data: { first_name: 'Carl', last_name: 'F' }, error: null },      // loadNames filleule
      ],
      parrainages: [
        { data: null, error: null },                                                          // idempotence check
        { data: { id: PARRAINAGE_ID }, error: null },                                         // INSERT
      ],
    })
    mockCreateClient.mockResolvedValue({ ...rpc, from: fromMock })

    const result = await createParrainageRelation({
      code: VALID_CODE,
      filleuleId: FILLEUL_ACCOMPAGNANT_ID,
      ipInscription: '   ', // whitespace -> skip bloc IP
      filleuleEmail: null,  // null -> skip bloc email entier
    })

    expect(result).toEqual({
      ok: true,
      parrainageId: PARRAINAGE_ID,
      marraineId: PARRAIN_ACCOMPAGNE_ID,
    })
    // Pas de Sentry critique (la branche skip ne capture rien)
    expect(mockCaptureException).not.toHaveBeenCalled()
  })
})

// ─── SC17-SC19 : confirmParrainageOnSuccess paths edge

describe('confirmParrainageOnSuccess — paths edge non couverts 9.A.2.b', () => {
  // Builder reutilise pour SC17/SC18/SC19. Configure Stripe + auth client par defaut.
  function buildBaseSession() {
    mockStripeRetrieve.mockResolvedValue({
      status: 'complete',
      payment_status: 'paid',
      metadata: { parrainage_code: VALID_CODE, user_id: FILLEUL_ACCOMPAGNANT_ID },
    })
  }

  function buildAuthClient() {
    return {
      auth: {
        getUser: vi.fn().mockResolvedValue({
          data: { user: { id: FILLEUL_ACCOMPAGNANT_ID } },
        }),
      },
    }
  }

  it('SC17 : parrainRoleConfirm inattendu (role=admin) -> marraine_no_longer_validated + Sentry signal "marraine-unexpected-role-at-confirm"', async () => {
    buildBaseSession()

    const { fromMock: adminFrom } = createSupabaseFromMock({
      // 1 : parrainage row (select.eq.eq.order.limit.maybeSingle)
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
      ],
      // 2 : users(role) -> role inattendu (ni accompagne ni accompagnant)
      users: [{ data: { role: 'admin' }, error: null }],
    })

    mockCreateClient
      .mockResolvedValueOnce(buildAuthClient())
      .mockResolvedValue({ from: adminFrom })

    const result = await confirmParrainageOnSuccess(SESSION_ID)

    expect(result).toEqual({ ok: false, reason: 'marraine_no_longer_validated' })
    expect(mockCaptureMessage).toHaveBeenCalledWith(
      'parrainage marraine unexpected role at confirm',
      expect.objectContaining({
        level: 'warning',
        tags: expect.objectContaining({ signal: 'marraine-unexpected-role-at-confirm' }),
        extra: expect.objectContaining({
          parrainageId: PARRAINAGE_ID,
          marraineId: PARRAIN_ACCOMPAGNE_ID,
          roleParrain: 'admin',
        }),
      }),
    )
  })

  it('SC18 : validation_status_skipped (filleule en statut "refuse") -> Sentry warning + admin_actions_log "parrainage_validation_skipped"', async () => {
    buildBaseSession()

    const { fromMock: adminFrom, capturedInserts } = createSupabaseFromMock({
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
        { data: [{ id: PARRAINAGE_ID }], error: null }, // update.select -> lockedRows
      ],
      users: [
        { data: { role: 'accompagne' }, error: null },                       // role parrain
        { data: { email: 'parrain@ex.fr', first_name: 'P' }, error: null },  // marraine email
        { data: { email: 'filleul@ex.fr', first_name: 'F' }, error: null },  // filleule email
      ],
      subscriptions: [{ data: { status: 'active' }, error: null }],
      accompagnants_profiles: [
        { data: { id: 'profile-filleule-id' }, error: null },                // filleule profile
        { data: [], error: null },                                           // validationUpdated vide (filleule pas en_attente)
        { data: { validation_status: 'refuse' }, error: null },              // currentProfile : refuse (pas valide)
      ],
      admin_actions_log: [],
    })

    mockCreateClient
      .mockResolvedValueOnce(buildAuthClient())
      .mockResolvedValue({ from: adminFrom })

    const result = await confirmParrainageOnSuccess(SESSION_ID)

    expect(result).toEqual({ ok: true })
    expect(mockCaptureMessage).toHaveBeenCalledWith(
      'parrainage validation status skipped',
      expect.objectContaining({
        level: 'warning',
        tags: expect.objectContaining({ signal: 'validation-status-skipped' }),
        extra: expect.objectContaining({
          user_id: FILLEUL_ACCOMPAGNANT_ID,
          current_status: 'refuse',
        }),
      }),
    )
    const adminLogs = (capturedInserts.admin_actions_log ?? []) as Array<Record<string, unknown>>
    const skippedLog = adminLogs.find((l) => l.action_type === 'parrainage_validation_skipped')
    expect(skippedLog).toBeDefined()
    expect(skippedLog).toMatchObject({
      action_type: 'parrainage_validation_skipped',
      target_type: 'user',
      target_id: FILLEUL_ACCOMPAGNANT_ID,
      details: { current_status: 'refuse' },
    })
  })

  it('SC19 : generate_code_failed (mock retourne { error }) -> Sentry error + admin_actions_log "parrainage_code_generation_failed"', async () => {
    buildBaseSession()

    // Forcer generateCodeForUserSystem a echouer
    mockGenerateCodeForUserSystem.mockResolvedValueOnce({ error: 'db_constraint_violation' })

    const { fromMock: adminFrom, capturedInserts } = createSupabaseFromMock({
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
        { data: [{ id: PARRAINAGE_ID }], error: null }, // update.select -> lockedRows
      ],
      users: [
        { data: { role: 'accompagne' }, error: null },                       // role parrain
        { data: { email: 'parrain@ex.fr', first_name: 'P' }, error: null },  // marraine email
        { data: { email: 'filleul@ex.fr', first_name: 'F' }, error: null },  // filleule email
      ],
      subscriptions: [{ data: { status: 'active' }, error: null }],
      accompagnants_profiles: [
        { data: { id: 'profile-filleule-id' }, error: null },                // filleule profile
        { data: [{ id: 'profile-filleule-id' }], error: null },              // validationUpdated OK
      ],
      admin_actions_log: [],
    })

    mockCreateClient
      .mockResolvedValueOnce(buildAuthClient())
      .mockResolvedValue({ from: adminFrom })

    const result = await confirmParrainageOnSuccess(SESSION_ID)

    expect(result).toEqual({ ok: true })
    expect(mockCaptureMessage).toHaveBeenCalledWith(
      'parrainage generate code failed',
      expect.objectContaining({
        level: 'error',
        tags: expect.objectContaining({ signal: 'generate-code-failed' }),
        extra: expect.objectContaining({
          user_id: FILLEUL_ACCOMPAGNANT_ID,
          reason: 'db_constraint_violation',
        }),
      }),
    )
    const adminLogs = (capturedInserts.admin_actions_log ?? []) as Array<Record<string, unknown>>
    const codeFailLog = adminLogs.find((l) => l.action_type === 'parrainage_code_generation_failed')
    expect(codeFailLog).toBeDefined()
    expect(codeFailLog).toMatchObject({
      action_type: 'parrainage_code_generation_failed',
      target_type: 'user',
      target_id: FILLEUL_ACCOMPAGNANT_ID,
      details: { reason: 'db_constraint_violation' },
    })
  })
})

// ═══════════════════════════════════════════════════════════════════════════════
// Story 9.A.2.c (F-Epic9-A2) — palier 3 coverage : branches restantes
// `createParrainageRelation` + `revokeFilleuleValidation*` + `generateCodeForUser`.
// SC20-SC40 ciblent les branches non couvertes identifiees par defer ligne 14-21
// (`deferred-work.md`) apres palier 2 effectif (67/59/92/65 GHA #26037648833).
// ═══════════════════════════════════════════════════════════════════════════════

// ─── SC20-SC28 : createParrainageRelation branches restantes ────────────────

describe('createParrainageRelation — branches restantes 9.A.2.c', () => {
  it('SC20 : self_referral (marraineId === filleuleId) -> { ok:false, reason:"self_referral" }', async () => {
    // validateCode reussit, marraineId === params.filleuleId -> return tot ligne 544.
    // Pas de guard filleul, pas d'idempotence, pas d'INSERT.
    const rpc = buildRpcAllowed()
    const { fromMock, capturedInserts } = createSupabaseFromMock({
      parrainages_codes: [{ data: { user_id: PARRAIN_ACCOMPAGNE_ID }, error: null }],
      users: [
        { data: { role: 'accompagne', first_name: 'Alice' }, error: null }, // validateCode
      ],
      subscriptions: [{ data: { status: 'active' }, error: null }],
    })
    mockCreateClient.mockResolvedValue({ ...rpc, from: fromMock })

    const result = await createParrainageRelation({
      code: VALID_CODE,
      filleuleId: PARRAIN_ACCOMPAGNE_ID, // === marraineId retournee par validateCode
      ipInscription: null,
    })

    expect(result).toEqual({ ok: false, reason: 'self_referral' })
    // Pas de Sentry capture attendu (return silencieux).
    expect(mockCaptureMessage).not.toHaveBeenCalledWith(
      'parrainage invalid filleul role',
      expect.anything(),
    )
    // Pas d'INSERT parrainages (return avant guard).
    expect(capturedInserts.parrainages ?? []).toHaveLength(0)
  })

  it('SC21 : idempotence existing.statut="inscrite" + recheck OK -> reuse row { ok:true }', async () => {
    // Sequence des from() :
    //   validateCode initial : parrainages_codes(1) + users(1) + subscriptions(1)
    //   guard filleul        : users(2)
    //   idempotence lookup   : parrainages(1) -> { statut: 'inscrite' }
    //   validateCode recheck : parrainages_codes(2) + users(3) + subscriptions(2)
    //   filleulRecheck       : users(4)
    const rpc = buildRpcAllowed()
    const { fromMock, capturedInserts } = createSupabaseFromMock({
      parrainages_codes: [
        { data: { user_id: PARRAIN_ACCOMPAGNE_ID }, error: null }, // validateCode 1
        { data: { user_id: PARRAIN_ACCOMPAGNE_ID }, error: null }, // validateCode recheck
      ],
      subscriptions: [
        { data: { status: 'active' }, error: null }, // validateCode 1
        { data: { status: 'active' }, error: null }, // validateCode recheck
      ],
      users: [
        { data: { role: 'accompagne', first_name: 'Alice' }, error: null }, // validateCode 1
        { data: { role: 'accompagnant' }, error: null },                    // guard filleul
        { data: { role: 'accompagne', first_name: 'Alice' }, error: null }, // validateCode recheck
        { data: { role: 'accompagnant' }, error: null },                    // filleulRecheck
      ],
      parrainages: [
        {
          data: {
            id: PARRAINAGE_ID,
            marraine_id: PARRAIN_ACCOMPAGNE_ID,
            statut: 'inscrite',
            blocage_raison: null,
          },
          error: null,
        },
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
    // Pas d'INSERT parrainages (reuse de l'existing).
    expect(capturedInserts.parrainages ?? []).toHaveLength(0)
  })

  it('SC22 : idempotence existing.statut="bloque" + raison "meme_email" -> blacklist_meme_email', async () => {
    const rpc = buildRpcAllowed()
    const { fromMock } = createSupabaseFromMock({
      parrainages_codes: [{ data: { user_id: PARRAIN_ACCOMPAGNE_ID }, error: null }],
      subscriptions: [{ data: { status: 'active' }, error: null }],
      users: [
        { data: { role: 'accompagne', first_name: 'Alice' }, error: null }, // validateCode
        { data: { role: 'accompagnant' }, error: null },                    // guard filleul
      ],
      parrainages: [
        {
          data: {
            id: PARRAINAGE_ID,
            marraine_id: PARRAIN_ACCOMPAGNE_ID,
            statut: 'bloque',
            blocage_raison: 'meme_email',
          },
          error: null,
        },
      ],
    })
    mockCreateClient.mockResolvedValue({ ...rpc, from: fromMock })

    const result = await createParrainageRelation({
      code: VALID_CODE,
      filleuleId: FILLEUL_ACCOMPAGNANT_ID,
      ipInscription: null,
    })

    expect(result).toEqual({ ok: false, reason: 'blacklist_meme_email' })
  })

  it('SC23 : idempotence existing.statut="bloque" + autre raison -> blacklist_other', async () => {
    const rpc = buildRpcAllowed()
    const { fromMock } = createSupabaseFromMock({
      parrainages_codes: [{ data: { user_id: PARRAIN_ACCOMPAGNE_ID }, error: null }],
      subscriptions: [{ data: { status: 'active' }, error: null }],
      users: [
        { data: { role: 'accompagne', first_name: 'Alice' }, error: null }, // validateCode
        { data: { role: 'accompagnant' }, error: null },                    // guard filleul
      ],
      parrainages: [
        {
          data: {
            id: PARRAINAGE_ID,
            marraine_id: PARRAIN_ACCOMPAGNE_ID,
            statut: 'bloque',
            blocage_raison: 'meme_ip', // autre raison
          },
          error: null,
        },
      ],
    })
    mockCreateClient.mockResolvedValue({ ...rpc, from: fromMock })

    const result = await createParrainageRelation({
      code: VALID_CODE,
      filleuleId: FILLEUL_ACCOMPAGNANT_ID,
      ipInscription: null,
    })

    expect(result).toEqual({ ok: false, reason: 'blacklist_other' })
  })

  it('SC24 : race 23505 sur INSERT initial -> raceRow.id reuse { ok:true }', async () => {
    // INSERT echoue avec 23505 (unique violation index partiel) -> code re-lookup
    // parrainages avec statut in ('inscrite','abonnee','confirme') -> raceRow trouve.
    mockNormalizeEmail.mockReturnValue('')

    const rpc = buildRpcAllowed()
    const { fromMock, capturedInserts } = createSupabaseFromMock({
      parrainages_codes: [{ data: { user_id: PARRAIN_ACCOMPAGNE_ID }, error: null }],
      subscriptions: [{ data: { status: 'active' }, error: null }],
      users: [
        { data: { role: 'accompagne', first_name: 'Alice' }, error: null }, // validateCode
        { data: { role: 'accompagnant' }, error: null },                    // guard filleul
      ],
      parrainages: [
        { data: null, error: null },                                                       // idempotence : pas d'existing
        { data: null, error: { code: '23505', message: 'unique_violation' } },             // INSERT : 23505
        {
          data: { id: PARRAINAGE_ID, marraine_id: PARRAIN_ACCOMPAGNE_ID, statut: 'inscrite' },
          error: null,
        }, // raceRow lookup
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
    // Verifier que l'INSERT a bien ete tente.
    expect(capturedInserts.parrainages).toHaveLength(1)
  })

  it('SC25 : insertError non-23505 -> { ok:false, reason:"insert_failed" }', async () => {
    mockNormalizeEmail.mockReturnValue('')

    const rpc = buildRpcAllowed()
    const { fromMock, calls } = createSupabaseFromMock({
      parrainages_codes: [{ data: { user_id: PARRAIN_ACCOMPAGNE_ID }, error: null }],
      subscriptions: [{ data: { status: 'active' }, error: null }],
      users: [
        { data: { role: 'accompagne', first_name: 'Alice' }, error: null },
        { data: { role: 'accompagnant' }, error: null },
      ],
      parrainages: [
        { data: null, error: null },                                                       // idempotence : pas d'existing
        { data: null, error: { code: '42P01', message: 'relation does not exist' } },      // INSERT : autre erreur
      ],
    })
    mockCreateClient.mockResolvedValue({ ...rpc, from: fromMock })

    const result = await createParrainageRelation({
      code: VALID_CODE,
      filleuleId: FILLEUL_ACCOMPAGNANT_ID,
      ipInscription: null,
    })

    expect(result).toEqual({ ok: false, reason: 'insert_failed' })
    // Verifier 2 from('parrainages') (idempotence + INSERT), PAS de 3eme lookup raceRow.
    const parrainagesCalls = calls.filter((t) => t === 'parrainages')
    expect(parrainagesCalls).toHaveLength(2)
  })

  it('SC26 : filleulUserError lookup users role -> { ok:false, reason:"db_error" } + Sentry', async () => {
    const rpc = buildRpcAllowed()
    const { fromMock } = createSupabaseFromMock({
      parrainages_codes: [{ data: { user_id: PARRAIN_ACCOMPAGNE_ID }, error: null }],
      subscriptions: [{ data: { status: 'active' }, error: null }],
      users: [
        { data: { role: 'accompagne', first_name: 'Alice' }, error: null }, // validateCode
        { data: null, error: { message: 'connection lost' } },              // guard filleul : ERROR
      ],
    })
    mockCreateClient.mockResolvedValue({ ...rpc, from: fromMock })

    const result = await createParrainageRelation({
      code: VALID_CODE,
      filleuleId: FILLEUL_ACCOMPAGNANT_ID,
      ipInscription: null,
    })

    expect(result).toEqual({ ok: false, reason: 'db_error' })
    expect(mockCaptureException).toHaveBeenCalledWith(
      expect.objectContaining({ message: 'connection lost' }),
      expect.objectContaining({
        tags: expect.objectContaining({
          signal: 'create-relation-filleul-lookup-error',
        }),
        extra: expect.objectContaining({ filleuleId: FILLEUL_ACCOMPAGNANT_ID }),
      }),
    )
  })

  it('SC27 : filleulRecheck role change pendant idempotence -> invalid_filleul_role', async () => {
    // Sequence : idempotence inscrite -> recheck validateCode OK -> filleulRecheck
    // retourne role='accompagne' (changement entre 1er appel et idempotence).
    const rpc = buildRpcAllowed()
    const { fromMock } = createSupabaseFromMock({
      parrainages_codes: [
        { data: { user_id: PARRAIN_ACCOMPAGNE_ID }, error: null }, // validateCode 1
        { data: { user_id: PARRAIN_ACCOMPAGNE_ID }, error: null }, // validateCode recheck
      ],
      subscriptions: [
        { data: { status: 'active' }, error: null },
        { data: { status: 'active' }, error: null },
      ],
      users: [
        { data: { role: 'accompagne', first_name: 'Alice' }, error: null }, // validateCode 1
        { data: { role: 'accompagnant' }, error: null },                    // guard filleul (OK initial)
        { data: { role: 'accompagne', first_name: 'Alice' }, error: null }, // validateCode recheck
        { data: { role: 'accompagne' }, error: null },                      // filleulRecheck : role CHANGED
      ],
      parrainages: [
        {
          data: {
            id: PARRAINAGE_ID,
            marraine_id: PARRAIN_ACCOMPAGNE_ID,
            statut: 'inscrite',
            blocage_raison: null,
          },
          error: null,
        },
      ],
    })
    mockCreateClient.mockResolvedValue({ ...rpc, from: fromMock })

    const result = await createParrainageRelation({
      code: VALID_CODE,
      filleuleId: FILLEUL_ACCOMPAGNANT_ID,
      ipInscription: null,
    })

    expect(result).toEqual({ ok: false, reason: 'invalid_filleul_role' })
  })

  it('SC28 : mergeResult.was_added=false (worker concurrent gagne) -> skip log + email meme_ip', async () => {
    mockNormalizeEmail.mockImplementation((email: string) =>
      (email || '').toLowerCase().trim(),
    )

    // RPC merge_parrainage_flag_suspicion retourne { was_added: false } -> skip log+email.
    const rpc = vi.fn((rpcName: string) => {
      if (rpcName === 'try_consume_rate_limit') {
        return {
          select: vi.fn().mockReturnThis(),
          maybeSingle: vi.fn().mockResolvedValue({ data: true, error: null }),
        }
      }
      if (rpcName === 'merge_parrainage_flag_suspicion') {
        return {
          select: vi.fn().mockReturnThis(),
          maybeSingle: vi.fn().mockResolvedValue({ data: { was_added: false }, error: null }),
        }
      }
      return {
        select: vi.fn().mockReturnThis(),
        maybeSingle: vi.fn().mockResolvedValue({ data: null, error: null }),
      }
    })

    const { fromMock, capturedInserts } = createSupabaseFromMock({
      parrainages_codes: [{ data: { user_id: PARRAIN_ACCOMPAGNE_ID }, error: null }],
      subscriptions: [{ data: { status: 'active' }, error: null }],
      users: [
        { data: { role: 'accompagne', first_name: 'Alice' }, error: null }, // validateCode
        { data: { role: 'accompagnant' }, error: null },                    // guard filleul
        { data: { email: 'marraine@ex.fr' }, error: null },                 // detectBlacklist marraine email
        // Pas de loadNames car log+email skipped quand was_added=false.
      ],
      parrainages: [
        { data: null, error: null },                                                          // idempotence
        { data: { id: PARRAINAGE_ID }, error: null },                                         // INSERT
        { data: [], error: null },                                                            // otherFilleulesIds vide (skip P9)
        { data: [{ id: 'parrainage-other-id' }], error: null },                               // ipMatches non vide -> flag meme_ip
      ],
    })

    mockCreateClient.mockResolvedValue({ rpc, from: fromMock })

    const result = await createParrainageRelation({
      code: VALID_CODE,
      filleuleId: FILLEUL_ACCOMPAGNANT_ID,
      ipInscription: '192.168.1.1',
      filleuleEmail: 'carl@ex.fr',
    })

    expect(result).toEqual({
      ok: true,
      parrainageId: PARRAINAGE_ID,
      marraineId: PARRAIN_ACCOMPAGNE_ID,
    })
    // RPC merge invoque (signal meme_ip declenche)
    expect(rpc).toHaveBeenCalledWith('merge_parrainage_flag_suspicion', expect.objectContaining({
      p_flag: 'meme_ip',
    }))
    // PAS de log admin_actions_log "parrainage_flag" (skip car was_added=false).
    const adminLogs = (capturedInserts.admin_actions_log ?? []) as Array<Record<string, unknown>>
    const flagLog = adminLogs.find((l) => l.action_type === 'parrainage_flag')
    expect(flagLog).toBeUndefined()
  })
})

// ─── SC29-SC35 : revokeFilleuleValidation* paths ──────────────────────────────
//
// Note : revokeFilleuleValidation (interne) n'est pas exporte ; SC29-SC31 le
// testent via revokeFilleuleValidationFromWebhook avec internal secret valide
// (bypass admin auth check -> delegue directement a revokeFilleuleValidation).
// SC32-SC35 testent les branches auth de revokeFilleuleValidationFromWebhook.

describe('revokeFilleuleValidation* — branches 9.A.2.c', () => {
  const ADMIN_ID = 'aaaaaaaa-0000-0000-0000-000000000099'
  const PROFILE_ID = 'pppppppp-0000-0000-0000-000000000010'
  const INTERNAL_SECRET = 'test-secret-9a2c'

  // Helper : seed via internal secret bypass admin check. revokeFilleuleValidation
  // appelle createClient({ serviceRole: true }) UNE fois (pas de createClient
  // sans serviceRole car bypass auth).
  function seedWithInternalSecret(
    accompagnantsProfilesPool: Array<{ data: unknown; error: unknown }>,
  ) {
    vi.stubEnv('PARRAINAGE_INTERNAL_SECRET', INTERNAL_SECRET)
    const { fromMock, capturedInserts, capturedUpdates, calls } = createSupabaseFromMock({
      accompagnants_profiles: accompagnantsProfilesPool,
    })
    mockCreateClient.mockResolvedValue({ from: fromMock })
    return { fromMock, capturedInserts, capturedUpdates, calls }
  }

  it('SC29 : path principal validation_source="parrainage" + status="valide" -> update en_attente + DELETE code + log admin', async () => {
    const { capturedInserts, capturedUpdates, calls } = seedWithInternalSecret([
      {
        data: {
          id: PROFILE_ID,
          validation_status: 'valide',
          validation_source: 'parrainage',
        },
        error: null,
      },
    ])

    await revokeFilleuleValidationFromWebhook(FILLEUL_ACCOMPAGNANT_ID, 'fraude_confirmee_admin', {
      parrainageId: PARRAINAGE_ID,
      marraineId: PARRAIN_ACCOMPAGNE_ID,
      internalSecret: INTERNAL_SECRET,
    })

    // (a) update accompagnants_profiles {validation_status: 'en_attente', ...}
    const profileUpdate = capturedUpdates.find(
      (u) =>
        u.table === 'accompagnants_profiles' &&
        (u.payload as Record<string, unknown>)?.validation_status === 'en_attente',
    )
    expect(profileUpdate).toBeDefined()
    expect(profileUpdate?.payload).toMatchObject({
      validation_status: 'en_attente',
      validation_source: 'manuelle',
      validation_date: null,
    })

    // (b) update users { parrainee_par: null }
    const userUpdate = capturedUpdates.find(
      (u) =>
        u.table === 'users' &&
        (u.payload as Record<string, unknown>)?.parrainee_par === null,
    )
    expect(userUpdate).toBeDefined()

    // (c) DELETE sur parrainages_codes invoque (call trace)
    expect(calls).toContain('parrainages_codes')

    // (d) admin_actions_log insert avec action_type 'parrainage_fraude_confirmee'
    const adminLogs = (capturedInserts.admin_actions_log ?? []) as Array<Record<string, unknown>>
    expect(adminLogs).toHaveLength(1)
    expect(adminLogs[0]).toMatchObject({
      action_type: 'parrainage_fraude_confirmee',
      target_type: 'parrainage',
      target_id: PARRAINAGE_ID,
      details: {
        via: 'fraude_confirmee_admin',
        filleule_id: FILLEUL_ACCOMPAGNANT_ID,
        marraine_id: PARRAIN_ACCOMPAGNE_ID,
      },
    })

    vi.unstubAllEnvs()
  })

  it('SC30 : noop path (status="refuse") -> PAS d\'update profile + Sentry warning + log admin quand meme', async () => {
    const { capturedInserts, capturedUpdates } = seedWithInternalSecret([
      {
        data: {
          id: PROFILE_ID,
          validation_status: 'refuse',
          validation_source: 'manuelle',
        },
        error: null,
      },
    ])

    await revokeFilleuleValidationFromWebhook(FILLEUL_ACCOMPAGNANT_ID, 'fraude_confirmee_admin', {
      parrainageId: PARRAINAGE_ID,
      marraineId: PARRAIN_ACCOMPAGNE_ID,
      internalSecret: INTERNAL_SECRET,
    })

    // (a) PAS d'update accompagnants_profiles (noop branche)
    const profileUpdate = capturedUpdates.find((u) => u.table === 'accompagnants_profiles')
    expect(profileUpdate).toBeUndefined()

    // (b) Sentry.captureMessage avec signal revoke-noop
    expect(mockCaptureMessage).toHaveBeenCalledWith(
      'parrainage revokeFilleuleValidation noop',
      expect.objectContaining({
        level: 'warning',
        tags: expect.objectContaining({ signal: 'revoke-noop' }),
        extra: expect.objectContaining({
          filleule_id: FILLEUL_ACCOMPAGNANT_ID,
          current_status: 'refuse',
          current_source: 'manuelle',
        }),
      }),
    )

    // (c) update users + log admin executes meme en noop (toujours)
    const userUpdate = capturedUpdates.find((u) => u.table === 'users')
    expect(userUpdate).toBeDefined()
    const adminLogs = (capturedInserts.admin_actions_log ?? []) as Array<Record<string, unknown>>
    expect(adminLogs).toHaveLength(1)

    vi.unstubAllEnvs()
  })

  it('SC31 : throw si context.parrainageId absent -> "parrainageId requis"', async () => {
    vi.stubEnv('PARRAINAGE_INTERNAL_SECRET', INTERNAL_SECRET)
    // Pas besoin de seed (fail-loud upfront avant tout from()).

    await expect(
      revokeFilleuleValidationFromWebhook(FILLEUL_ACCOMPAGNANT_ID, 'raison', {
        internalSecret: INTERNAL_SECRET,
        // parrainageId omis intentionnellement
      }),
    ).rejects.toThrow(/parrainageId requis/)

    vi.unstubAllEnvs()
  })

  it('SC32 : internal secret valide -> bypass admin check + delegate', async () => {
    // Identique a SC29 mais on verifie explicitement qu'aucun createClient sans
    // serviceRole n'a ete fait (mockCreateClient appele 1 seule fois pour
    // revokeFilleuleValidation interne, pas de check auth).
    seedWithInternalSecret([
      {
        data: {
          id: PROFILE_ID,
          validation_status: 'valide',
          validation_source: 'parrainage',
        },
        error: null,
      },
    ])

    await revokeFilleuleValidationFromWebhook(FILLEUL_ACCOMPAGNANT_ID, 'webhook-stripe', {
      parrainageId: PARRAINAGE_ID,
      internalSecret: INTERNAL_SECRET,
    })

    // mockCreateClient invoque 1 fois (revokeFilleuleValidation interne, serviceRole).
    expect(mockCreateClient).toHaveBeenCalledTimes(1)
    expect(mockCreateClient).toHaveBeenCalledWith({ serviceRole: true })

    vi.unstubAllEnvs()
  })

  it('SC33 : admin authentifie (pas de secret valide) -> delegate reussit', async () => {
    // Pas de PARRAINAGE_INTERNAL_SECRET set -> hasValidSecret=false -> branche admin.
    // 1er createClient() (sans serviceRole) -> auth.getUser() + users role lookup
    // 2eme createClient({serviceRole}) -> revokeFilleuleValidation interne
    const authClient = {
      auth: {
        getUser: vi.fn().mockResolvedValue({
          data: { user: { id: ADMIN_ID } },
        }),
      },
      from: vi.fn(() => ({
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        single: vi.fn().mockResolvedValue({ data: { role: 'admin' }, error: null }),
      })),
    }

    const { fromMock } = createSupabaseFromMock({
      accompagnants_profiles: [
        {
          data: {
            id: PROFILE_ID,
            validation_status: 'valide',
            validation_source: 'parrainage',
          },
          error: null,
        },
      ],
    })
    const adminClient = { from: fromMock }

    mockCreateClient
      .mockResolvedValueOnce(authClient)
      .mockResolvedValueOnce(adminClient)

    await expect(
      revokeFilleuleValidationFromWebhook(FILLEUL_ACCOMPAGNANT_ID, 'admin-action', {
        parrainageId: PARRAINAGE_ID,
        marraineId: PARRAIN_ACCOMPAGNE_ID,
      }),
    ).resolves.toBeUndefined()

    expect(mockCreateClient).toHaveBeenCalledTimes(2)
  })

  it('SC34 : non-auth (getUser retourne null) -> throw "non authentifie"', async () => {
    const authClient = {
      auth: {
        getUser: vi.fn().mockResolvedValue({ data: { user: null } }),
      },
      from: vi.fn(),
    }

    mockCreateClient.mockResolvedValueOnce(authClient)

    await expect(
      revokeFilleuleValidationFromWebhook(FILLEUL_ACCOMPAGNANT_ID, 'raison', {
        parrainageId: PARRAINAGE_ID,
      }),
    ).rejects.toThrow(/non authentifié/)
  })

  it('SC35 : authentifie non-admin -> throw "acces refuse"', async () => {
    const authClient = {
      auth: {
        getUser: vi.fn().mockResolvedValue({
          data: { user: { id: FILLEUL_ACCOMPAGNANT_ID } },
        }),
      },
      from: vi.fn(() => ({
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        single: vi.fn().mockResolvedValue({
          data: { role: 'accompagnant' }, // pas admin
          error: null,
        }),
      })),
    }

    mockCreateClient.mockResolvedValueOnce(authClient)

    await expect(
      revokeFilleuleValidationFromWebhook(FILLEUL_ACCOMPAGNANT_ID, 'raison', {
        parrainageId: PARRAINAGE_ID,
      }),
    ).rejects.toThrow(/accès refusé/)
  })
})

// ─── SC36-SC40 : generateCodeForUser paths ────────────────────────────────────
//
// 2 createClient appels : (1) sans serviceRole pour auth.getUser() + caller role
// si user != userId ; (2) avec serviceRole pour parrainages_codes select+insert.
// Note hors-cible AC1.u : retry 23505 (l. 287-300) keyspace 31^8 collision
// non couvrable -- defer 8.A.1 F11 documente non exerce.

describe('generateCodeForUser — branches 9.A.2.c', () => {
  const USER_ID = 'uuuuuuuu-0000-0000-0000-000000000050'

  function buildAuthClient(user: { id: string } | null) {
    return {
      auth: {
        getUser: vi.fn().mockResolvedValue({ data: { user } }),
      },
      from: vi.fn(() => ({
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        single: vi.fn().mockResolvedValue({ data: null, error: null }),
      })),
    }
  }

  it('SC36 : idempotence existing code -> { code, created:false } sans INSERT', async () => {
    const authClient = buildAuthClient({ id: USER_ID })
    const { fromMock, capturedInserts } = createSupabaseFromMock({
      parrainages_codes: [{ data: { code: 'EXISTING1' }, error: null }],
    })
    const adminClient = { from: fromMock }

    mockCreateClient
      .mockResolvedValueOnce(authClient)
      .mockResolvedValueOnce(adminClient)

    const result = await generateCodeForUser(USER_ID)

    expect(result).toEqual({ code: 'EXISTING1', created: false })
    expect(capturedInserts.parrainages_codes ?? []).toHaveLength(0)
  })

  it('SC37 : non-auth (getUser retourne null) -> { error: "Non authentifié." }', async () => {
    const authClient = buildAuthClient(null)
    mockCreateClient.mockResolvedValueOnce(authClient)

    const result = await generateCodeForUser(USER_ID)

    expect(result).toEqual({ error: 'Non authentifié.' })
    // Pas de 2eme createClient (serviceRole) car return tot.
    expect(mockCreateClient).toHaveBeenCalledTimes(1)
  })

  it('SC38 : user.id !== userId + caller non-admin -> { error: "Accès refusé." }', async () => {
    const authClient = {
      auth: {
        getUser: vi.fn().mockResolvedValue({
          data: { user: { id: 'other-user-id' } },
        }),
      },
      from: vi.fn(() => ({
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        single: vi.fn().mockResolvedValue({
          data: { role: 'accompagnant' }, // pas admin
          error: null,
        }),
      })),
    }
    mockCreateClient.mockResolvedValueOnce(authClient)

    const result = await generateCodeForUser(USER_ID)

    expect(result).toEqual({ error: 'Accès refusé.' })
    // Pas de createClient serviceRole (return avant)
    expect(mockCreateClient).toHaveBeenCalledTimes(1)
  })

  it('SC39 : INSERT succes 1er essai -> { code, created:true }', async () => {
    const authClient = buildAuthClient({ id: USER_ID })
    const { fromMock, capturedInserts } = createSupabaseFromMock({
      parrainages_codes: [
        { data: null, error: null },  // idempotence : pas d'existing
        { data: null, error: null },  // INSERT : succes (error null)
      ],
    })
    const adminClient = { from: fromMock }

    mockCreateClient
      .mockResolvedValueOnce(authClient)
      .mockResolvedValueOnce(adminClient)

    const result = await generateCodeForUser(USER_ID)

    // generateCode() mock retourne 'ABCD2345' (vi.mock @/lib/parrainage-codes ligne 81)
    expect(result).toEqual({ code: 'ABCD2345', created: true })
    expect(capturedInserts.parrainages_codes).toHaveLength(1)
    expect(capturedInserts.parrainages_codes[0]).toMatchObject({
      user_id: USER_ID,
      code: 'ABCD2345',
      compteur_confirmes: 0,
      total_recompenses: 0,
    })
  })

  it('SC40 : INSERT error non-23505 -> { error: "Erreur lors de la création..." }', async () => {
    const authClient = buildAuthClient({ id: USER_ID })
    const { fromMock } = createSupabaseFromMock({
      parrainages_codes: [
        { data: null, error: null },                                       // idempotence
        { data: null, error: { code: '23502', message: 'not null violation' } }, // INSERT : autre erreur (pas 23505)
      ],
    })
    const adminClient = { from: fromMock }

    mockCreateClient
      .mockResolvedValueOnce(authClient)
      .mockResolvedValueOnce(adminClient)

    const result = await generateCodeForUser(USER_ID)

    expect(result).toEqual({ error: 'Erreur lors de la création du code de parrainage.' })
  })
})

// ═══════════════════════════════════════════════════════════════════════════════
// Story 9.A.2.d (F-Epic9-A2 Option hybride C1+C3)
// SC41-SC47 : combler branches restantes app/actions/parrainage.ts -> palier 3
// effectif final. Categorie C1 (error paths Sentry createParrainageRelation,
// SC41-SC45) + Categorie C3 (validateCode rate-limit, SC46-SC47). C2 NO-GO
// cosmetique. C4 HORS-CIBLE structurel (retry 23505 keyspace 31^8).
// ═══════════════════════════════════════════════════════════════════════════════

describe('createParrainageRelation error paths Sentry — 9.A.2.d (C1)', () => {
  it('SC41 : blocErr UPDATE parrainages statut=bloque -> Sentry signup-update-bloque + return blacklist_meme_email', async () => {
    // Path blocage meme_email : detectBlacklist retourne { blocage: 'meme_email' }
    // via lookup email marraine identique. UPDATE parrainages statut=bloque echoue
    // (postgres error) -> Sentry.captureException signal=signup-update-bloque
    // severity=critical mais return continue best-effort avec reason=blacklist_meme_email.
    mockNormalizeEmail.mockImplementation((email: string) =>
      (email || '').toLowerCase().trim(),
    )

    const rpc = buildRpcAllowed()
    const { fromMock } = createSupabaseFromMock({
      parrainages_codes: [{ data: { user_id: PARRAIN_ACCOMPAGNE_ID }, error: null }],
      subscriptions: [{ data: { status: 'active' }, error: null }],
      users: [
        { data: { role: 'accompagne', first_name: 'Alice' }, error: null }, // validateCode
        { data: { role: 'accompagnant' }, error: null },                    // guard filleul
        { data: { email: 'alice@ex.fr' }, error: null },                    // detectBlacklist marraine email = filleule email
        { data: { first_name: 'Alice', last_name: 'M' }, error: null },     // loadNames marraine
        { data: { first_name: 'Carl', last_name: 'F' }, error: null },      // loadNames filleule
      ],
      parrainages: [
        { data: null, error: null },                                                            // idempotence : pas d'existing
        { data: { id: PARRAINAGE_ID }, error: null },                                           // INSERT initial
        { data: null, error: { code: '23502', message: 'not null violation update bloque' } }, // UPDATE statut=bloque : ERROR
      ],
    })
    mockCreateClient.mockResolvedValue({ ...rpc, from: fromMock })

    const result = await createParrainageRelation({
      code: VALID_CODE,
      filleuleId: FILLEUL_ACCOMPAGNANT_ID,
      ipInscription: null,
      filleuleEmail: 'alice@ex.fr',
    })

    expect(result).toEqual({ ok: false, reason: 'blacklist_meme_email' })
    expect(mockCaptureException).toHaveBeenCalledWith(
      expect.objectContaining({ code: '23502' }),
      expect.objectContaining({
        tags: expect.objectContaining({ signal: 'signup-update-bloque' }),
        extra: expect.objectContaining({ parrainageId: PARRAINAGE_ID, raison: 'meme_email' }),
      }),
    )
  })

  it('SC42 : logErr INSERT admin_actions_log path meme_email -> Sentry signup-log-bloque', async () => {
    // Path blocage meme_email : UPDATE statut=bloque OK, INSERT admin_actions_log
    // echoue -> Sentry.captureException signal=signup-log-bloque severity=critical.
    // Return continue avec reason=blacklist_meme_email (best-effort observabilite).
    mockNormalizeEmail.mockImplementation((email: string) =>
      (email || '').toLowerCase().trim(),
    )

    const rpc = buildRpcAllowed()
    const { fromMock } = createSupabaseFromMock({
      parrainages_codes: [{ data: { user_id: PARRAIN_ACCOMPAGNE_ID }, error: null }],
      subscriptions: [{ data: { status: 'active' }, error: null }],
      users: [
        { data: { role: 'accompagne', first_name: 'Alice' }, error: null },
        { data: { role: 'accompagnant' }, error: null },
        { data: { email: 'alice@ex.fr' }, error: null },                    // detectBlacklist marraine
        { data: { first_name: 'Alice', last_name: 'M' }, error: null },     // loadNames marraine
        { data: { first_name: 'Carl', last_name: 'F' }, error: null },      // loadNames filleule
      ],
      parrainages: [
        { data: null, error: null },                                          // idempotence
        { data: { id: PARRAINAGE_ID }, error: null },                         // INSERT initial
        { data: null, error: null },                                          // UPDATE bloque OK
      ],
      admin_actions_log: [
        { data: null, error: { code: '23502', message: 'admin_actions_log target_id NULL' } }, // INSERT : ERROR
      ],
    })
    mockCreateClient.mockResolvedValue({ ...rpc, from: fromMock })

    const result = await createParrainageRelation({
      code: VALID_CODE,
      filleuleId: FILLEUL_ACCOMPAGNANT_ID,
      ipInscription: null,
      filleuleEmail: 'alice@ex.fr',
    })

    expect(result).toEqual({ ok: false, reason: 'blacklist_meme_email' })
    expect(mockCaptureException).toHaveBeenCalledWith(
      expect.objectContaining({ code: '23502' }),
      expect.objectContaining({
        tags: expect.objectContaining({ signal: 'signup-log-bloque' }),
        extra: expect.objectContaining({ parrainageId: PARRAINAGE_ID, raison: 'meme_email' }),
      }),
    )
  })

  it('SC43 : sendAdminParrainageFlag throw path meme_email -> Sentry signup-email-bloque severity warning', async () => {
    // Path blocage meme_email : UPDATE + INSERT log OK, sendAdminParrainageFlag
    // throw (Resend down par exemple) -> catch englobant -> Sentry signal=signup-email-bloque
    // severity warning. Return blacklist_meme_email (email best-effort).
    mockNormalizeEmail.mockImplementation((email: string) =>
      (email || '').toLowerCase().trim(),
    )

    const { sendAdminParrainageFlag } = await import('@/lib/emails')
    vi.mocked(sendAdminParrainageFlag).mockRejectedValueOnce(new Error('Resend API timeout'))

    const rpc = buildRpcAllowed()
    const { fromMock } = createSupabaseFromMock({
      parrainages_codes: [{ data: { user_id: PARRAIN_ACCOMPAGNE_ID }, error: null }],
      subscriptions: [{ data: { status: 'active' }, error: null }],
      users: [
        { data: { role: 'accompagne', first_name: 'Alice' }, error: null },
        { data: { role: 'accompagnant' }, error: null },
        { data: { email: 'alice@ex.fr' }, error: null },                    // detectBlacklist marraine
        { data: { first_name: 'Alice', last_name: 'M' }, error: null },     // loadNames marraine
        { data: { first_name: 'Carl', last_name: 'F' }, error: null },      // loadNames filleule
      ],
      parrainages: [
        { data: null, error: null },
        { data: { id: PARRAINAGE_ID }, error: null },
        { data: null, error: null },                                          // UPDATE bloque OK
      ],
      admin_actions_log: [
        { data: null, error: null },                                          // INSERT log OK
      ],
    })
    mockCreateClient.mockResolvedValue({ ...rpc, from: fromMock })

    const result = await createParrainageRelation({
      code: VALID_CODE,
      filleuleId: FILLEUL_ACCOMPAGNANT_ID,
      ipInscription: null,
      filleuleEmail: 'alice@ex.fr',
    })

    expect(result).toEqual({ ok: false, reason: 'blacklist_meme_email' })
    expect(mockCaptureException).toHaveBeenCalledWith(
      expect.objectContaining({ message: 'Resend API timeout' }),
      expect.objectContaining({
        tags: expect.objectContaining({ signal: 'signup-email-bloque' }),
        extra: expect.objectContaining({ parrainageId: PARRAINAGE_ID, type: 'meme_email' }),
      }),
    )
  })

  it('SC44 : mergeErr RPC merge_parrainage_flag_suspicion path meme_ip -> Sentry signup-merge-flag + skip log', async () => {
    // Path flag meme_ip : RPC merge_parrainage_flag_suspicion echoue (data:null + error)
    // -> Sentry.captureException signal=signup-merge-flag severity=critical.
    // mergeResult?.was_added est falsy -> skip log/email mais return ok:true
    // (le parrainage reste actif, le flag n'est qu'un signal best-effort).
    mockNormalizeEmail.mockImplementation((email: string) =>
      (email || '').toLowerCase().trim(),
    )

    const rpc = vi.fn((rpcName: string) => {
      if (rpcName === 'try_consume_rate_limit') {
        return {
          select: vi.fn().mockReturnThis(),
          maybeSingle: vi.fn().mockResolvedValue({ data: true, error: null }),
        }
      }
      if (rpcName === 'merge_parrainage_flag_suspicion') {
        return {
          select: vi.fn().mockReturnThis(),
          maybeSingle: vi.fn().mockResolvedValue({
            data: null,
            error: { code: '42883', message: 'function does not exist' },
          }),
        }
      }
      return { select: vi.fn().mockReturnThis(), maybeSingle: vi.fn().mockResolvedValue({ data: null, error: null }) }
    })

    const { fromMock } = createSupabaseFromMock({
      parrainages_codes: [{ data: { user_id: PARRAIN_ACCOMPAGNE_ID }, error: null }],
      subscriptions: [{ data: { status: 'active' }, error: null }],
      users: [
        { data: { role: 'accompagne', first_name: 'Alice' }, error: null }, // validateCode
        { data: { role: 'accompagnant' }, error: null },                    // guard filleul
        { data: { email: 'marraine-only@ex.fr' }, error: null },            // detectBlacklist marraine (diff)
      ],
      parrainages: [
        { data: null, error: null },                                          // idempotence
        { data: { id: PARRAINAGE_ID }, error: null },                         // INSERT initial
        { data: [], error: null },                                            // otherFilleulesIds vide (skip P9)
        { data: [{ id: 'parrainage-other-id' }], error: null },               // ipMatches non vide -> flag meme_ip
      ],
    })

    mockCreateClient.mockResolvedValue({ rpc, from: fromMock })

    const result = await createParrainageRelation({
      code: VALID_CODE,
      filleuleId: FILLEUL_ACCOMPAGNANT_ID,
      ipInscription: '192.168.1.1',
      filleuleEmail: 'carl@ex.fr',
    })

    expect(result).toEqual({
      ok: true,
      parrainageId: PARRAINAGE_ID,
      marraineId: PARRAIN_ACCOMPAGNE_ID,
    })
    expect(mockCaptureException).toHaveBeenCalledWith(
      expect.objectContaining({ code: '42883' }),
      expect.objectContaining({
        tags: expect.objectContaining({ signal: 'signup-merge-flag' }),
        extra: expect.objectContaining({ parrainageId: PARRAINAGE_ID, flag: 'meme_ip' }),
      }),
    )
    // was_added falsy -> aucun INSERT admin_actions_log emis (cf. ligne 788)
  })

  it('SC45 : parraineeErr UPDATE users parrainee_par -> Sentry signup-parrainee-par + return ok:true', async () => {
    // Golden path SANS blocage (detectBlacklist retourne {}). UPDATE users
    // parrainee_par echoue -> Sentry severity=critical mais return ok:true
    // (best-effort : la relation parrainages.statut=inscrite est posee,
    // l'attribution parrainee_par est secondaire).
    mockNormalizeEmail.mockReturnValue('')  // pas d'email -> skip lookup blacklist email

    const rpc = buildRpcAllowed()
    const { fromMock } = createSupabaseFromMock({
      parrainages_codes: [{ data: { user_id: PARRAIN_ACCOMPAGNE_ID }, error: null }],
      subscriptions: [{ data: { status: 'active' }, error: null }],
      users: [
        { data: { role: 'accompagne', first_name: 'Alice' }, error: null }, // validateCode
        { data: { role: 'accompagnant' }, error: null },                    // guard filleul
        { data: null, error: { code: '23502', message: 'users update parrainee_par error' } }, // UPDATE parrainee_par : ERROR
        { data: { email: 'alice@ex.fr', first_name: 'Alice' }, error: null }, // loadNames marraine
        { data: { email: 'carl@ex.fr', first_name: 'Carl' }, error: null },   // loadNames filleule
      ],
      parrainages: [
        { data: null, error: null },                                          // idempotence
        { data: { id: PARRAINAGE_ID }, error: null },                         // INSERT initial
      ],
    })
    mockCreateClient.mockResolvedValue({ ...rpc, from: fromMock })

    const result = await createParrainageRelation({
      code: VALID_CODE,
      filleuleId: FILLEUL_ACCOMPAGNANT_ID,
      ipInscription: null,
      filleuleEmail: null,
    })

    expect(result).toEqual({
      ok: true,
      parrainageId: PARRAINAGE_ID,
      marraineId: PARRAIN_ACCOMPAGNE_ID,
    })
    expect(mockCaptureException).toHaveBeenCalledWith(
      expect.objectContaining({ code: '23502' }),
      expect.objectContaining({
        tags: expect.objectContaining({ signal: 'signup-parrainee-par' }),
        extra: expect.objectContaining({
          parrainageId: PARRAINAGE_ID,
          filleuleId: FILLEUL_ACCOMPAGNANT_ID,
        }),
      }),
    )
  })
})

describe('validateCode rate-limit — 9.A.2.d (C3 anti-fraude H12)', () => {
  it('SC46 : rate-limit triggered (allowed=false) -> Sentry rate-limit-validate-code + return reason=rate_limited', async () => {
    // RPC try_consume_rate_limit retourne { data: false } -> brute-force
    // suspecte. Sentry.captureMessage signal=rate-limit-validate-code level=warning
    // + keyHash HMAC. Story 4.1 AC4. Return immediat sans lookup BDD.
    //
    // Note : validateCode fait `await supabaseAdmin.rpc(...)` directement sans
    // .maybeSingle() -> il faut que rpc() retourne une thenable resolvant
    // { data: false, error: null }. Les SC existants (SC1...) utilisent
    // buildRpcAllowed qui retourne un builder non-thenable -> `data` finit
    // par etre l'objet builder (truthy != false) et l'if rate-limit est
    // silencieusement bypasse. C3 9.A.2.d exerce reellement la branche.
    const rpc = vi.fn().mockReturnValue(
      Promise.resolve({ data: false, error: null }),
    )
    const { fromMock } = createSupabaseFromMock()
    mockCreateClient.mockResolvedValue({ rpc, from: fromMock })

    const result = await validateCode(VALID_CODE)

    expect(result).toEqual({ valid: false, reason: 'rate_limited' })
    expect(mockCaptureMessage).toHaveBeenCalledWith(
      'rate-limit-validate-code triggered',
      expect.objectContaining({
        level: 'warning',
        tags: expect.objectContaining({ signal: 'rate-limit-validate-code' }),
        extra: expect.objectContaining({ keyHash: 'hash' }),
      }),
    )
    // RPC consume invoque, MAIS aucun lookup parrainages_codes (return early avant BDD)
    expect(rpc).toHaveBeenCalledWith(
      'try_consume_rate_limit',
      expect.objectContaining({ p_key: expect.stringMatching(/^validate_code:/) }),
    )
  })

  it('SC47 : rate-limit RPC error (catch) -> Sentry rate-limit-rpc-error critical + validation continue best-effort', async () => {
    // RPC throw (BDD down, plpgsql exception) -> catch englobant capture l'erreur
    // avec severity=critical (ouvre temporairement la fenetre brute-force).
    // Le code continue : sans seed parrainages_codes, returns valid:false
    // reason=unknown_code (preuve que la validation a poursuivi malgre l'erreur RPC).
    const rpc = vi.fn().mockReturnValue(
      Promise.reject(new Error('rate-limit rpc plpgsql exception')),
    )
    const { fromMock } = createSupabaseFromMock({
      // Pas de parrainages_codes seede -> emptyResponse -> unknown_code en sortie.
    })
    mockCreateClient.mockResolvedValue({ rpc, from: fromMock })

    const result = await validateCode(VALID_CODE)

    expect(result).toEqual({ valid: false, reason: 'unknown_code' })
    expect(mockCaptureException).toHaveBeenCalledWith(
      expect.objectContaining({ message: 'rate-limit rpc plpgsql exception' }),
      expect.objectContaining({
        tags: expect.objectContaining({
          signal: 'rate-limit-rpc-error',
          severity: 'critical',
        }),
        extra: expect.objectContaining({ keyHash: 'hash' }),
      }),
    )
  })
})
