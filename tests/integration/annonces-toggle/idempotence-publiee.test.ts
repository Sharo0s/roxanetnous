import { describe, it, expect, afterAll, beforeAll } from 'vitest'
import {
  updateAnnonceAccompagnanteStatus,
  updateAnnonceAccompagneStatus,
} from '@/app/actions/annonces'
import { mockSupabaseSession } from '@/tests/integration/_lib/supabase-session-mock'
import {
  createTestUser,
  createTestSubscription,
  createTestAccompagnanteProfile,
  createTestAccompagneProfile,
  cleanupAllFixtures,
} from '@/tests/integration/_lib/fixtures'
import {
  seedAnnonceAccompagnant,
  seedAnnonceAccompagne,
  readAnnonceAccompagnant,
  readAnnonceAccompagne,
  cleanupAnnoncesFixtures,
} from './_fixtures'

// Story 7.A.9 (AC6) : tests integration toggle status d'annonce.
// Couvre les 5 cas :
//   (a) `publiee -> publiee`  = no-op idempotent, published_at preserve
//   (b) status out-of-band     = `{ error: 'Statut invalide.' }`, BDD inchange
//   (c) `archivee -> publiee`  = bump legitime, published_at avance
//   (d) `publiee -> archivee`  = status change, published_at preserve
//   (e) symetrie accompagne    = smoke `publiee -> publiee` sur la jumelle
describe('annonces toggle status (7.A.9)', () => {
  beforeAll(async () => {
    await cleanupAllFixtures()
    await cleanupAnnoncesFixtures()
  })

  afterAll(async () => {
    await cleanupAnnoncesFixtures()
    await cleanupAllFixtures()
  })

  it('(a) `publiee -> publiee` est un no-op : published_at preserve', async () => {
    const user = await createTestUser('accompagnant')
    const profile = await createTestAccompagnanteProfile(user.id)
    await createTestSubscription(user.id, { status: 'active' })

    const t0 = new Date(Date.now() - 60_000)
    const annonce = await seedAnnonceAccompagnant(profile.id, {
      status: 'publiee',
      publishedAt: t0,
    })
    expect(annonce.publishedAt).not.toBeNull()
    const publishedAtBefore = annonce.publishedAt!

    mockSupabaseSession(user.id)

    const result = await updateAnnonceAccompagnanteStatus(annonce.id, 'publiee')
    expect(result.error).toBeUndefined()
    expect(result.success).toBe(true)

    const row = await readAnnonceAccompagnant(annonce.id)
    expect(row.status).toBe('publiee')
    expect(row.published_at).toBe(publishedAtBefore)
  })

  it('(b) status out-of-band retourne `Statut invalide.` sans toucher la BDD', async () => {
    const user = await createTestUser('accompagnant')
    const profile = await createTestAccompagnanteProfile(user.id)

    const annonce = await seedAnnonceAccompagnant(profile.id, {
      status: 'brouillon',
      publishedAt: null,
    })

    mockSupabaseSession(user.id)

    // Cast `as any` justifie : on simule un appel HTTP direct qui contourne
    // le typage TS pour valider la whitelist runtime AC4.
    const result = await updateAnnonceAccompagnanteStatus(
      annonce.id,
      'autre' as unknown as 'publiee',
    )
    expect(result.error).toBe('Statut invalide.')
    expect(result.success).toBeUndefined()

    const row = await readAnnonceAccompagnant(annonce.id)
    expect(row.status).toBe('brouillon')
    expect(row.published_at).toBeNull()
  })

  it('(c) `archivee -> publiee` bump legitime : published_at > T0', async () => {
    const user = await createTestUser('accompagnant')
    const profile = await createTestAccompagnanteProfile(user.id)
    await createTestSubscription(user.id, { status: 'active' })

    const t0 = new Date(Date.now() - 60_000)
    const annonce = await seedAnnonceAccompagnant(profile.id, {
      status: 'archivee',
      publishedAt: t0,
    })

    mockSupabaseSession(user.id)

    const result = await updateAnnonceAccompagnanteStatus(annonce.id, 'publiee')
    expect(result.error).toBeUndefined()
    expect(result.success).toBe(true)

    const row = await readAnnonceAccompagnant(annonce.id)
    expect(row.status).toBe('publiee')
    expect(row.published_at).not.toBeNull()
    expect(new Date(row.published_at!).getTime()).toBeGreaterThan(t0.getTime())
  })

  it('(d) `publiee -> archivee` archive sans bumper published_at', async () => {
    const user = await createTestUser('accompagnant')
    const profile = await createTestAccompagnanteProfile(user.id)

    const t0 = new Date(Date.now() - 60_000)
    const annonce = await seedAnnonceAccompagnant(profile.id, {
      status: 'publiee',
      publishedAt: t0,
    })
    const publishedAtBefore = annonce.publishedAt!

    mockSupabaseSession(user.id)

    const result = await updateAnnonceAccompagnanteStatus(annonce.id, 'archivee')
    expect(result.error).toBeUndefined()
    expect(result.success).toBe(true)

    const row = await readAnnonceAccompagnant(annonce.id)
    expect(row.status).toBe('archivee')
    expect(row.published_at).toBe(publishedAtBefore)
  })

  it('(e) symetrie `accompagne` : `publiee -> publiee` est aussi no-op', async () => {
    const user = await createTestUser('accompagne')
    const profile = await createTestAccompagneProfile(user.id)
    await createTestSubscription(user.id, { status: 'active' })

    const t0 = new Date(Date.now() - 60_000)
    const annonce = await seedAnnonceAccompagne(profile.id, {
      status: 'publiee',
      publishedAt: t0,
    })
    const publishedAtBefore = annonce.publishedAt!

    mockSupabaseSession(user.id)

    const result = await updateAnnonceAccompagneStatus(annonce.id, 'publiee')
    expect(result.error).toBeUndefined()
    expect(result.success).toBe(true)

    const row = await readAnnonceAccompagne(annonce.id)
    expect(row.status).toBe('publiee')
    expect(row.published_at).toBe(publishedAtBefore)
  })
})
