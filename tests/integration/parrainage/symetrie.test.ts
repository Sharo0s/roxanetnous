// Story 8.A.4 — Suite tests d'integration parrainage symetrique (Epic 8).
// Verrouille les 4 sens (golden path + non-regression Epic 2 + 2 sens interdits)
// + comportement sub parrain inactif au validateCode + au cron palier.
//
// Patterns herites :
//   - tests/integration/_lib/fixtures.ts (createTestUser, createTestSubscription, ...)
//   - tests/integration/_lib/stripe-webhook-helper.ts (createStripeEvent, postWebhookEvent)
//   - tests/integration/_lib/supabase-session-mock.ts (mockSupabaseSession)
//   - tests/integration/cron-purge-notifications/purge-cron.test.ts (import dynamique cron + CRON_SECRET)
//
// Mocks globaux (cf. tests/integration/setup.ts) :
//   - @sentry/nextjs no-op (captureMessage / captureException assertables via vi.mocked)
//   - @/lib/emails sendXxxEmail no-op (assertables)
//   - @/lib/stripe.subscriptions.retrieve / coupons.create / subscriptions.update / checkout.sessions.retrieve / paymentMethods.retrieve mockes
//   - next/server.after neutralise (execution immediate, erreurs swallowed)
//   - next/cache.revalidatePath neutralise

import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from 'vitest'
import { randomUUID } from 'node:crypto'
import { NextRequest } from 'next/server'
import type Stripe from 'stripe'
import {
  cleanupAllFixtures,
  createTestAccompagnanteProfile,
  createTestAccompagneProfile,
  createTestParrainage,
  createTestSubscription,
  createTestUser,
  trackStripeEvent,
} from '../_lib/fixtures'
import { getAdminClient } from '../_lib/supabase-admin'
import { createStripeEvent, postWebhookEvent } from '../_lib/stripe-webhook-helper'
import { mockSupabaseSession, resetSupabaseSessionMock } from '../_lib/supabase-session-mock'
import {
  createParrainageRelation,
  confirmParrainageOnSuccess,
  validateCode,
} from '@/app/actions/parrainage'
import { stripe } from '@/lib/stripe'
import {
  sendParrainageBienvenueParrain,
  sendParrainageFilleuleConfirmation,
  sendParrainageRecompense,
} from '@/lib/emails'
import * as Sentry from '@sentry/nextjs'

const TEST_CRON_SECRET = 'test-cron-secret-7b2'
const PARRAINAGE_CODE_ALPHABET = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789'

function makeParrainageCode(): string {
  let out = ''
  for (let i = 0; i < 8; i++) {
    out += PARRAINAGE_CODE_ALPHABET.charAt(
      Math.floor(Math.random() * PARRAINAGE_CODE_ALPHABET.length),
    )
  }
  return out
}

// Seed direct d un code parrainage pour `userId`. Pas de helper fixtures dedie
// (parrainages_codes.user_id PRIMARY KEY ON DELETE CASCADE => cleanup auto via users).
async function seedParrainageCode(
  userId: string,
  opts?: { compteurConfirmes?: number; totalRecompenses?: number },
): Promise<string> {
  const supabase = getAdminClient()
  const code = makeParrainageCode()
  const { error } = await supabase.from('parrainages_codes').insert({
    user_id: userId,
    code,
    compteur_confirmes: opts?.compteurConfirmes ?? 0,
    total_recompenses: opts?.totalRecompenses ?? 0,
  })
  if (error) {
    throw new Error(`seedParrainageCode echec : ${error.message}`)
  }
  return code
}

function buildFakeSubscription(opts: {
  id: string
  status: string
}): Stripe.Subscription {
  const now = Math.floor(Date.now() / 1000)
  const periodEnd = now + 30 * 24 * 60 * 60
  return {
    id: opts.id,
    object: 'subscription',
    status: opts.status,
    default_payment_method: null,
    items: {
      data: [
        {
          price: { id: 'price_test_dummy' },
          current_period_start: now,
          current_period_end: periodEnd,
        },
      ],
    },
    metadata: {},
  } as unknown as Stripe.Subscription
}

function buildFakeCheckoutSession(opts: {
  id: string
  userId: string
  parrainageCode: string
}): Stripe.Checkout.Session {
  return {
    id: opts.id,
    object: 'checkout.session',
    mode: 'subscription',
    status: 'complete',
    payment_status: 'paid',
    metadata: { user_id: opts.userId, parrainage_code: opts.parrainageCode, plan: 'mensuel' },
  } as unknown as Stripe.Checkout.Session
}

beforeAll(async () => {
  process.env.CRON_SECRET = TEST_CRON_SECRET
  await cleanupAllFixtures()
})

afterAll(async () => {
  await cleanupAllFixtures()
})

afterEach(() => {
  resetSupabaseSessionMock()
})

describe('Parrainage symetrique — Epic 8 (8.A.4)', () => {
  it('SC1 : accompagne -> accompagnant golden path', async () => {
    const supabase = getAdminClient()

    // Seed parrain accompagne + sub active + code parrainage genese.
    const parrain = await createTestUser('accompagne')
    await createTestAccompagneProfile(parrain.id)
    await createTestSubscription(parrain.id, { status: 'active' })
    const code = await seedParrainageCode(parrain.id)

    // Seed filleul accompagnant + profil en_attente (cas validation par parrainage).
    const filleul = await createTestUser('accompagnant')
    {
      const profileSeed = await createTestAccompagnanteProfile(filleul.id)
      await supabase
        .from('accompagnants_profiles')
        // Story 9.A.7 : validation_source NOT NULL DEFAULT 'manuelle' (migration
        // 20260428130104) -- on ne peut pas passer null. La fixture etend deja les
        // champs metier requis par le CHECK accompagnants_profiles_completion_check
        // (migration 20260510234500). UPDATE partiel laisse les champs metier en
        // place donc CHECK ok.
        .update({ validation_status: 'en_attente', validation_source: 'manuelle' })
        .eq('id', profileSeed.id)
    }

    // 1) validateCode -> valid
    const validation = await validateCode(code)
    expect(validation).toEqual({
      valid: true,
      marraineId: parrain.id,
      marraineFirstName: 'Test',
    })

    // 2) createParrainageRelation -> ok
    const relation = await createParrainageRelation({
      code,
      filleuleId: filleul.id,
      ipInscription: '1.2.3.4',
    })
    if (!relation.ok) throw new Error(`createParrainageRelation expected ok, got ${relation.reason}`)
    expect(relation.marraineId).toBe(parrain.id)

    {
      const { data: parrainage } = await supabase
        .from('parrainages')
        .select('statut, marraine_id, filleule_id')
        .eq('id', relation.parrainageId)
        .single()
      expect(parrainage).toMatchObject({
        statut: 'inscrite',
        marraine_id: parrain.id,
        filleule_id: filleul.id,
      })
      const { data: userRow } = await supabase
        .from('users')
        .select('parrainee_par')
        .eq('id', filleul.id)
        .single()
      expect((userRow as { parrainee_par: string }).parrainee_par).toBe(parrain.id)
    }

    // 3) Webhook checkout.session.completed -> upsert sub filleul + parrainages.statut='abonnee'
    const filleulSubId = `sub_test_filleul_${randomUUID()}`
    vi.mocked(stripe.subscriptions.retrieve).mockResolvedValueOnce(
      buildFakeSubscription({ id: filleulSubId, status: 'active' }) as never,
    )
    const event = createStripeEvent('checkout.session.completed', {
      id: `cs_test_sc1_${randomUUID()}`,
      object: 'checkout.session',
      mode: 'subscription',
      subscription: filleulSubId,
      customer: `cus_test_${randomUUID()}`,
      metadata: { user_id: filleul.id, parrainage_code: code, plan: 'mensuel' },
    })
    trackStripeEvent(event.id)

    const { status: webhookStatus } = await postWebhookEvent(event)
    expect(webhookStatus).toBe(200)

    {
      const { data: filleulSub } = await supabase
        .from('subscriptions')
        .select('status, stripe_subscription_id')
        .eq('user_id', filleul.id)
        .single()
      expect(filleulSub).toMatchObject({ status: 'active', stripe_subscription_id: filleulSubId })

      const { data: parrainageAfterWebhook } = await supabase
        .from('parrainages')
        .select('statut')
        .eq('id', relation.parrainageId)
        .single()
      // Webhook ne bascule pas le statut a abonnee directement (c est confirmParrainageOnSuccess
      // qui le fait). Le statut reste 'inscrite' apres webhook -- la transition 'abonnee'
      // est faite par confirmParrainageOnSuccess ligne ~990 (compare-and-swap).
      expect(parrainageAfterWebhook?.statut).toBe('inscrite')
    }

    // 4) confirmParrainageOnSuccess
    const sessionId = `cs_test_sc1_confirm_${randomUUID()}`
    vi.mocked(stripe.checkout.sessions.retrieve).mockResolvedValueOnce(
      buildFakeCheckoutSession({
        id: sessionId,
        userId: filleul.id,
        parrainageCode: code,
      }) as never,
    )
    mockSupabaseSession(filleul.id)

    const confirmResult = await confirmParrainageOnSuccess(sessionId)
    expect(confirmResult).toEqual({ ok: true })

    // 5) Assertions post-confirm
    {
      const { data: parrainageFinal } = await supabase
        .from('parrainages')
        .select('statut, filleule_abonnee_at')
        .eq('id', relation.parrainageId)
        .single()
      expect(parrainageFinal?.statut).toBe('abonnee')
      expect(parrainageFinal?.filleule_abonnee_at).toBeTruthy()

      const { data: filleulProfile } = await supabase
        .from('accompagnants_profiles')
        .select('validation_status, validation_source')
        .eq('user_id', filleul.id)
        .single()
      expect(filleulProfile).toMatchObject({
        validation_status: 'valide',
        validation_source: 'parrainage',
      })

      // Filleul devient parrain a son tour : genese du code.
      const { data: filleulCode } = await supabase
        .from('parrainages_codes')
        .select('code')
        .eq('user_id', filleul.id)
        .maybeSingle()
      expect(filleulCode?.code).toBeTruthy()
    }

    // 6) Email confirmation envoye via after()
    expect(vi.mocked(sendParrainageFilleuleConfirmation)).toHaveBeenCalled()
    expect(vi.mocked(sendParrainageBienvenueParrain)).toHaveBeenCalled()
  })

  it('SC2 : accompagnant -> accompagnant non-regression Epic 2', async () => {
    const supabase = getAdminClient()

    // Parrain accompagnant + profil valide + sub active + code (path Epic 2).
    const parrain = await createTestUser('accompagnant')
    await createTestAccompagnanteProfile(parrain.id) // validation_status=valide
    await createTestSubscription(parrain.id, { status: 'active' })
    const code = await seedParrainageCode(parrain.id)

    // Filleul accompagnant en_attente.
    const filleul = await createTestUser('accompagnant')
    {
      const profileSeed = await createTestAccompagnanteProfile(filleul.id)
      await supabase
        .from('accompagnants_profiles')
        // Story 9.A.7 : validation_source NOT NULL DEFAULT 'manuelle' (migration
        // 20260428130104) -- on ne peut pas passer null. La fixture etend deja les
        // champs metier requis par le CHECK accompagnants_profiles_completion_check
        // (migration 20260510234500). UPDATE partiel laisse les champs metier en
        // place donc CHECK ok.
        .update({ validation_status: 'en_attente', validation_source: 'manuelle' })
        .eq('id', profileSeed.id)
    }

    const validation = await validateCode(code)
    expect(validation).toMatchObject({ valid: true, marraineId: parrain.id })

    const relation = await createParrainageRelation({
      code,
      filleuleId: filleul.id,
      ipInscription: '2.3.4.5',
    })
    if (!relation.ok) throw new Error(`SC2 createParrainageRelation expected ok, got ${relation.reason}`)

    const filleulSubId = `sub_test_filleul_sc2_${randomUUID()}`
    vi.mocked(stripe.subscriptions.retrieve).mockResolvedValueOnce(
      buildFakeSubscription({ id: filleulSubId, status: 'active' }) as never,
    )
    const event = createStripeEvent('checkout.session.completed', {
      id: `cs_test_sc2_${randomUUID()}`,
      object: 'checkout.session',
      mode: 'subscription',
      subscription: filleulSubId,
      customer: `cus_test_${randomUUID()}`,
      metadata: { user_id: filleul.id, parrainage_code: code, plan: 'mensuel' },
    })
    trackStripeEvent(event.id)
    const { status: webhookStatus } = await postWebhookEvent(event)
    expect(webhookStatus).toBe(200)

    const sessionId = `cs_test_sc2_confirm_${randomUUID()}`
    vi.mocked(stripe.checkout.sessions.retrieve).mockResolvedValueOnce(
      buildFakeCheckoutSession({ id: sessionId, userId: filleul.id, parrainageCode: code }) as never,
    )
    mockSupabaseSession(filleul.id)
    const confirmResult = await confirmParrainageOnSuccess(sessionId)
    expect(confirmResult).toEqual({ ok: true })

    {
      const { data: parrainageFinal } = await supabase
        .from('parrainages')
        .select('statut')
        .eq('id', relation.parrainageId)
        .single()
      expect(parrainageFinal?.statut).toBe('abonnee')
    }

    // Non-regression Epic 2 : aucun signal role-aware emis.
    const captureCalls = vi.mocked(Sentry.captureMessage).mock.calls
    for (const callArgs of captureCalls) {
      expect(callArgs[0]).not.toBe('parrainage marraine unexpected role')
      expect(callArgs[0]).not.toBe('parrainage marraine unexpected role at confirm')
      expect(callArgs[0]).not.toBe('parrainage invalid filleul role')
    }
  })

  it('SC3 : accompagne -> accompagne rejet invalid_filleul_role', async () => {
    const supabase = getAdminClient()

    const parrain = await createTestUser('accompagne')
    await createTestAccompagneProfile(parrain.id)
    await createTestSubscription(parrain.id, { status: 'active' })
    const code = await seedParrainageCode(parrain.id)

    const filleul = await createTestUser('accompagne')
    await createTestAccompagneProfile(filleul.id)

    const relation = await createParrainageRelation({
      code,
      filleuleId: filleul.id,
      ipInscription: null,
    })
    expect(relation).toEqual({ ok: false, reason: 'invalid_filleul_role' })

    // Aucune row parrainages
    const { count } = await supabase
      .from('parrainages')
      .select('id', { count: 'exact', head: true })
      .eq('filleule_id', filleul.id)
    expect(count).toBe(0)

    // parrainee_par reste null
    const { data: userRow } = await supabase
      .from('users')
      .select('parrainee_par')
      .eq('id', filleul.id)
      .single()
    expect((userRow as { parrainee_par: string | null }).parrainee_par).toBeNull()

    // Sentry capture du signal
    const captureCalls = vi.mocked(Sentry.captureMessage).mock.calls
    const invalidRoleCall = captureCalls.find(
      (call) => call[0] === 'parrainage invalid filleul role',
    )
    expect(invalidRoleCall).toBeDefined()
    expect(
      (invalidRoleCall?.[1] as { extra?: { roleFilleul?: string | null } } | undefined)?.extra
        ?.roleFilleul,
    ).toBe('accompagne')
  })

  it('SC4 : accompagnant -> accompagne rejet invalid_filleul_role', async () => {
    const supabase = getAdminClient()

    const parrain = await createTestUser('accompagnant')
    await createTestAccompagnanteProfile(parrain.id)
    await createTestSubscription(parrain.id, { status: 'active' })
    const code = await seedParrainageCode(parrain.id)

    const filleul = await createTestUser('accompagne')
    await createTestAccompagneProfile(filleul.id)

    const relation = await createParrainageRelation({
      code,
      filleuleId: filleul.id,
      ipInscription: null,
    })
    expect(relation).toEqual({ ok: false, reason: 'invalid_filleul_role' })

    const { count } = await supabase
      .from('parrainages')
      .select('id', { count: 'exact', head: true })
      .eq('filleule_id', filleul.id)
    expect(count).toBe(0)

    const { data: userRow } = await supabase
      .from('users')
      .select('parrainee_par')
      .eq('id', filleul.id)
      .single()
    expect((userRow as { parrainee_par: string | null }).parrainee_par).toBeNull()

    // Signal Sentry emis pour les deux sens interdits (symetrique de SC3).
    const captureCalls = vi.mocked(Sentry.captureMessage).mock.calls
    const invalidRoleCall = captureCalls.find(
      (call) => call[0] === 'parrainage invalid filleul role',
    )
    expect(invalidRoleCall).toBeDefined()
    expect(
      (invalidRoleCall?.[1] as { extra?: { roleFilleul?: string | null } } | undefined)?.extra
        ?.roleFilleul,
    ).toBe('accompagne')
  })

  it('SC5 : parrain accompagne sub cancelled -> marraine_subscription_inactive', async () => {
    const parrain = await createTestUser('accompagne')
    await createTestAccompagneProfile(parrain.id)
    // Enum BDD : cancelled (double L) cf. audit 8.A.0.
    await createTestSubscription(parrain.id, { status: 'cancelled' })
    const code = await seedParrainageCode(parrain.id)

    const validation = await validateCode(code)
    expect(validation).toEqual({ valid: false, reason: 'marraine_subscription_inactive' })

    const captureCalls = vi.mocked(Sentry.captureMessage).mock.calls
    const subInactiveCall = captureCalls.find(
      (call) => call[0] === 'parrainage marraine sub inactive',
    )
    expect(subInactiveCall).toBeDefined()
    const extra = (
      subInactiveCall?.[1] as {
        extra?: { roleParrain?: string | null; subStatus?: string | null }
      } | undefined
    )?.extra
    expect(extra?.roleParrain).toBe('accompagne')
    expect(extra?.subStatus).toBe('cancelled')
  })

  it('SC6 : parrain accompagne au palier 5 + sub cancelled -> cron skip recompense', async () => {
    const supabase = getAdminClient()

    const parrain = await createTestUser('accompagne')
    await createTestAccompagneProfile(parrain.id)
    await createTestSubscription(parrain.id, { status: 'cancelled' })
    // Compteur=4 : le prochain increment passe a 5 (palier atteint).
    await seedParrainageCode(parrain.id, { compteurConfirmes: 4 })

    const filleul = await createTestUser('accompagnant')
    await createTestAccompagnanteProfile(filleul.id)
    await createTestSubscription(filleul.id, { status: 'active' })

    // Seed parrainage statut=abonnee + filleule_abonnee_at J-31 (eligible cron J-30).
    const abonneeAt = new Date(Date.now() - 31 * 24 * 60 * 60 * 1000).toISOString()
    const parrainage = await createTestParrainage(parrain.id, filleul.id, { statut: 'abonnee' })
    await supabase
      .from('parrainages')
      .update({ filleule_abonnee_at: abonneeAt })
      .eq('id', parrainage.id)

    // Import dynamique du cron AVANT lecture process.env.CRON_SECRET (pattern 7.B.2).
    const { GET } = await import('@/app/api/cron/confirm-parrainages/route')
    const request = new NextRequest('http://localhost/api/cron/confirm-parrainages', {
      headers: { authorization: `Bearer ${TEST_CRON_SECRET}` },
    })
    const response = await GET(request)
    expect(response.status).toBe(200)
    const body = (await response.json()) as {
      processed: number
      confirmed: number
      rewards: number
      skipped: number
      errors: number
    }
    // Le cron peut iterer sur d'autres rows orphelines residentes en BDD ; on
    // verifie >= sur les compteurs (au minimum notre row) et 0 sur rewards.
    expect(body.processed).toBeGreaterThanOrEqual(1)
    expect(body.confirmed).toBeGreaterThanOrEqual(1)
    expect(body.rewards).toBe(0)

    // Bascule statut abonnee -> confirme (avant pre-check sub parrain ligne 107-126)
    {
      const { data: parrainageFinal } = await supabase
        .from('parrainages')
        .select('statut')
        .eq('id', parrainage.id)
        .single()
      expect(parrainageFinal?.statut).toBe('confirme')
    }

    // compteur passe a 5 (increment RPC avant pre-check sub) mais pas de claim.
    {
      const { data: codeRow } = await supabase
        .from('parrainages_codes')
        .select('compteur_confirmes, total_recompenses')
        .eq('user_id', parrain.id)
        .single()
      expect(codeRow?.compteur_confirmes).toBe(5)
      expect(codeRow?.total_recompenses).toBe(0)
    }

    // Pas d'appel Stripe coupon ni subscription update.
    expect(vi.mocked(stripe.coupons.create)).not.toHaveBeenCalled()
    expect(vi.mocked(stripe.subscriptions.update)).not.toHaveBeenCalled()

    // Pas d'email recompense.
    expect(vi.mocked(sendParrainageRecompense)).not.toHaveBeenCalled()

    // Pas de ligne admin_actions_log type recompense (ni appliquee ni perdue).
    // Coherent F-Epic8-A3 : pas de recompense_perdue, le palier sera re-tente au prochain cron.
    {
      const { data: logs } = await supabase
        .from('admin_actions_log')
        .select('action_type')
        .eq('target_id', parrain.id)
        .in('action_type', [
          'parrainage_recompense_appliquee',
          'parrainage_recompense_perdue',
        ])
      expect(logs ?? []).toEqual([])
    }
  })
})
