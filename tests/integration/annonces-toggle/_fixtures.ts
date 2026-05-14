import { getAdminClient } from '@/tests/integration/_lib/supabase-admin'

// Story 7.A.9 : fixtures locales pour les tests integration toggle status
// d'annonces. Le tracker global de `tests/integration/_lib/fixtures.ts` ne
// connait pas les tables `annonces_*` ; on suit nos propres rows ici et on
// les nettoie en afterAll via `cleanupAnnoncesFixtures()`.

type AnnonceRef = { table: 'annonces_accompagnants' | 'annonces_accompagnes'; id: string }
const tracker: AnnonceRef[] = []

export type SeedAnnonceOpts = {
  status: 'brouillon' | 'publiee' | 'archivee' | 'suspendue'
  publishedAt?: Date | null
}

export async function seedAnnonceAccompagnant(
  accompagnantProfileId: string,
  opts: SeedAnnonceOpts,
): Promise<{ id: string; publishedAt: string | null }> {
  const supabase = getAdminClient()
  const { data, error } = await supabase
    .from('annonces_accompagnants')
    .insert({
      accompagnant_id: accompagnantProfileId,
      titre: `Test annonce ${Date.now()}`,
      status: opts.status,
      published_at: opts.publishedAt === null ? null : opts.publishedAt?.toISOString() ?? null,
    })
    .select('id, published_at')
    .single()
  if (error || !data) {
    throw new Error(`seedAnnonceAccompagnant echec : ${error?.message}`)
  }
  tracker.push({ table: 'annonces_accompagnants', id: data.id })
  return { id: data.id, publishedAt: data.published_at }
}

export async function seedAnnonceAccompagne(
  accompagneProfileId: string,
  opts: SeedAnnonceOpts,
): Promise<{ id: string; publishedAt: string | null }> {
  const supabase = getAdminClient()
  const { data, error } = await supabase
    .from('annonces_accompagnes')
    .insert({
      accompagne_id: accompagneProfileId,
      titre: `Test annonce ${Date.now()}`,
      status: opts.status,
      published_at: opts.publishedAt === null ? null : opts.publishedAt?.toISOString() ?? null,
    })
    .select('id, published_at')
    .single()
  if (error || !data) {
    throw new Error(`seedAnnonceAccompagne echec : ${error?.message}`)
  }
  tracker.push({ table: 'annonces_accompagnes', id: data.id })
  return { id: data.id, publishedAt: data.published_at }
}

export async function readAnnonceAccompagnant(
  id: string,
): Promise<{ status: string; published_at: string | null }> {
  const supabase = getAdminClient()
  const { data, error } = await supabase
    .from('annonces_accompagnants')
    .select('status, published_at')
    .eq('id', id)
    .single()
  if (error || !data) throw new Error(`readAnnonceAccompagnant echec : ${error?.message}`)
  return data as { status: string; published_at: string | null }
}

export async function readAnnonceAccompagne(
  id: string,
): Promise<{ status: string; published_at: string | null }> {
  const supabase = getAdminClient()
  const { data, error } = await supabase
    .from('annonces_accompagnes')
    .select('status, published_at')
    .eq('id', id)
    .single()
  if (error || !data) throw new Error(`readAnnonceAccompagne echec : ${error?.message}`)
  return data as { status: string; published_at: string | null }
}

export async function cleanupAnnoncesFixtures(): Promise<void> {
  const supabase = getAdminClient()
  const aIds = tracker
    .filter((row) => row.table === 'annonces_accompagnants')
    .map((row) => row.id)
  const bIds = tracker
    .filter((row) => row.table === 'annonces_accompagnes')
    .map((row) => row.id)
  if (aIds.length > 0) await supabase.from('annonces_accompagnants').delete().in('id', aIds)
  if (bIds.length > 0) await supabase.from('annonces_accompagnes').delete().in('id', bIds)
  tracker.length = 0
}
