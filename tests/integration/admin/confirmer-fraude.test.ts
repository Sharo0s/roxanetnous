// Story 9.A.5 — Tests integration confirmerFraude (defer F15 Epic 8).
//
// SC1 : decrement base nominal (compteur_confirmes=5 -> 4 apres confirmerFraude).
// SC2 : concurrence simulee (compteur_confirmes=5 + 2 parrainages confirmes pour le
//       meme parrain -> 2 confirmerFraude paralleles -> compteur final = 3, preuve
//       d'absence de lost-update grace a la RPC atomique parrainage_decrement_compteur.
//
// Patterns herites :
//   - tests/integration/parrainage/symetrie.test.ts (seed parrainages_codes, mock session admin)
//   - tests/integration/_lib/fixtures.ts (createTestUser, createTestSubscription,
//     createTestAccompagnanteProfile, createTestParrainage, cleanupAllFixtures)
//   - tests/integration/_lib/supabase-session-mock.ts (mockSupabaseSession)
//
// Mocks globaux (cf. tests/integration/setup.ts) :
//   - @sentry/nextjs no-op (captureException assertable via vi.mocked)
//   - @/lib/emails / @/lib/stripe / next/cache.revalidatePath neutralises

import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest'
import { randomUUID } from 'node:crypto'
import {
  cleanupAllFixtures,
  createTestAccompagnanteProfile,
  createTestAccompagneProfile,
  createTestParrainage,
  createTestSubscription,
  createTestUser,
} from '../_lib/fixtures'
import { getAdminClient } from '../_lib/supabase-admin'
import { mockSupabaseSession, resetSupabaseSessionMock } from '../_lib/supabase-session-mock'
import { confirmerFraude } from '@/app/actions/admin-parrainages'
import * as Sentry from '@sentry/nextjs'

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

// Seed direct d'un code parrainage (calque tests/integration/parrainage/symetrie.test.ts:62-78).
async function seedParrainageCode(
  userId: string,
  opts: { compteurConfirmes: number; totalRecompenses?: number },
): Promise<string> {
  const supabase = getAdminClient()
  const code = makeParrainageCode()
  const { error } = await supabase.from('parrainages_codes').insert({
    user_id: userId,
    code,
    compteur_confirmes: opts.compteurConfirmes,
    total_recompenses: opts.totalRecompenses ?? 0,
  })
  if (error) {
    throw new Error(`seedParrainageCode echec : ${error.message}`)
  }
  return code
}

beforeAll(async () => {
  await cleanupAllFixtures()
})

afterAll(async () => {
  await cleanupAllFixtures()
})

beforeEach(() => {
  vi.mocked(Sentry.captureException).mockClear()
})

afterEach(() => {
  resetSupabaseSessionMock()
})

describe('confirmerFraude — RPC parrainage_decrement_compteur (9.A.5)', () => {
  it('SC1 : decrement base (compteur 5 -> 4)', async () => {
    const supabase = getAdminClient()

    // Admin
    const admin = await createTestUser('admin')
    mockSupabaseSession(admin.id)

    // Marraine accompagnante validee + sub active + code (compteur=5, recompenses=0)
    const marraine = await createTestUser('accompagnant')
    await createTestAccompagnanteProfile(marraine.id)
    await createTestSubscription(marraine.id, { status: 'active' })
    await seedParrainageCode(marraine.id, { compteurConfirmes: 5, totalRecompenses: 0 })

    // Filleule accompagnante en_attente (validation_source='parrainage' pour exercer
    // le path suspension explicite ; non critique pour l'assertion compteur).
    const filleule = await createTestUser('accompagnant')
    const filleuleProfile = await createTestAccompagnanteProfile(filleule.id)
    await supabase
      .from('accompagnants_profiles')
      .update({ validation_status: 'valide', validation_source: 'parrainage' })
      .eq('id', filleuleProfile.id)

    // Parrainage confirme lie au couple.
    const parrainage = await createTestParrainage(marraine.id, filleule.id, {
      statut: 'inscrite',
    })
    // Bascule manuelle vers statut 'confirme' (hors enum createTestParrainage qui ne
    // propose que inscrite/abonnee/bloque). Le code metier confirmerFraude lit
    // parrainages.statut === 'confirme' pour declencher le decrement.
    await supabase
      .from('parrainages')
      .update({ statut: 'confirme', confirme_at: new Date().toISOString() })
      .eq('id', parrainage.id)

    const result = await confirmerFraude(parrainage.id, `fraude SC1 ${randomUUID()}`)
    expect(result.error).toBeUndefined()

    // Assert : compteur decremente de 5 -> 4
    const { data: codeRow } = await supabase
      .from('parrainages_codes')
      .select('compteur_confirmes, total_recompenses')
      .eq('user_id', marraine.id)
      .single()
    expect(codeRow?.compteur_confirmes).toBe(4)
    expect(codeRow?.total_recompenses).toBe(0)

    // Assert : parrainage bascule 'fraude'
    const { data: parrainageRow } = await supabase
      .from('parrainages')
      .select('statut')
      .eq('id', parrainage.id)
      .single()
    expect(parrainageRow?.statut).toBe('fraude')

    // Assert : 1 row admin_actions_log 'parrainage_fraude_confirmee'
    const { data: logRows } = await supabase
      .from('admin_actions_log')
      .select('action_type, details')
      .eq('admin_id', admin.id)
      .eq('action_type', 'parrainage_fraude_confirmee')
    expect(logRows?.length).toBe(1)

    // Assert : pas d'erreur Sentry sur le path nominal RPC.
    expect(vi.mocked(Sentry.captureException)).not.toHaveBeenCalled()

    // Assert : pas de log 'parrainage_fraude_recompense_a_reviser' (total_recompenses=0).
    const { data: reviewLogRows } = await supabase
      .from('admin_actions_log')
      .select('action_type')
      .eq('admin_id', admin.id)
      .eq('action_type', 'parrainage_fraude_recompense_a_reviser')
    expect(reviewLogRows?.length).toBe(0)
  })

  it('SC2 : concurrence simulee (lost-update prevention) compteur 5 -> 3 apres 2 confirmerFraude paralleles', async () => {
    const supabase = getAdminClient()

    const admin = await createTestUser('admin')
    mockSupabaseSession(admin.id)

    // Marraine accompagnee (path symetrique Epic 8) + sub + code (compteur=5, recompenses=0).
    // Variante accompagne pour verifier que le RPC est role-independant (heritage epic 8).
    const marraine = await createTestUser('accompagne')
    await createTestAccompagneProfile(marraine.id)
    await createTestSubscription(marraine.id, { status: 'active' })
    await seedParrainageCode(marraine.id, { compteurConfirmes: 5, totalRecompenses: 0 })

    // 2 filleules accompagnantes distinctes, validation_source='parrainage' pour
    // exercer le path suspension.
    const filleule1 = await createTestUser('accompagnant')
    const filleule1Profile = await createTestAccompagnanteProfile(filleule1.id)
    await supabase
      .from('accompagnants_profiles')
      .update({ validation_status: 'valide', validation_source: 'parrainage' })
      .eq('id', filleule1Profile.id)

    const filleule2 = await createTestUser('accompagnant')
    const filleule2Profile = await createTestAccompagnanteProfile(filleule2.id)
    await supabase
      .from('accompagnants_profiles')
      .update({ validation_status: 'valide', validation_source: 'parrainage' })
      .eq('id', filleule2Profile.id)

    // 2 parrainages confirmes lies a la meme marraine.
    const p1 = await createTestParrainage(marraine.id, filleule1.id, { statut: 'inscrite' })
    const p2 = await createTestParrainage(marraine.id, filleule2.id, { statut: 'inscrite' })
    await supabase
      .from('parrainages')
      .update({ statut: 'confirme', confirme_at: new Date().toISOString() })
      .in('id', [p1.id, p2.id])

    // Appel parallele : 2 confirmerFraude sur le meme marraine_id en simultane.
    // Avant 9.A.5, ce scenario produit un lost-update (compteur=4 au lieu de 3).
    // Apres 9.A.5, la RPC atomique garantit compteur=3.
    const [r1, r2] = await Promise.all([
      confirmerFraude(p1.id, `fraude SC2-A ${randomUUID()}`),
      confirmerFraude(p2.id, `fraude SC2-B ${randomUUID()}`),
    ])
    expect(r1.error).toBeUndefined()
    expect(r2.error).toBeUndefined()

    // Assert : compteur final = 3 (5 - 2). PAS 4 (preuve absence lost-update).
    const { data: codeRow } = await supabase
      .from('parrainages_codes')
      .select('compteur_confirmes')
      .eq('user_id', marraine.id)
      .single()
    expect(codeRow?.compteur_confirmes).toBe(3)

    // Assert : 2 parrainages basculent 'fraude'.
    const { data: parrainageRows } = await supabase
      .from('parrainages')
      .select('id, statut')
      .in('id', [p1.id, p2.id])
    expect(parrainageRows?.length).toBe(2)
    expect(parrainageRows?.every((row) => row.statut === 'fraude')).toBe(true)

    // Assert : 2 rows admin_actions_log 'parrainage_fraude_confirmee'.
    const { data: logRows } = await supabase
      .from('admin_actions_log')
      .select('action_type')
      .eq('admin_id', admin.id)
      .eq('action_type', 'parrainage_fraude_confirmee')
    expect(logRows?.length).toBe(2)

    // Assert : pas d'erreur Sentry sur le path nominal RPC.
    expect(vi.mocked(Sentry.captureException)).not.toHaveBeenCalled()
  })
})
