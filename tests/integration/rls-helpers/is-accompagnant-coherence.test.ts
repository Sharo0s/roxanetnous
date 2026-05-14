// Story 7.A.8 (F-Epic7-A8) : test integration BDD pour le helper RLS
// public.is_accompagnant() apres ALTER SECURITY DEFINER.
// AC10 : 3 cas (a-c) calant la regression fonctionnelle sur les 3 roles.
// AC11 : complement du garde-fou meta scripts/check-rls-helpers-security-definer.mjs
// (qui assert prosecdef=true au build, ici on assert le contrat boolean retourne).
//
// Pattern fixtures heritage 7.A.6 + 7.A.7 + 7.A.4 : createTestUser
// + authenticatedClientFor (signInWithPassword + client anon) pour exposer auth.uid()
// cote PostgREST RPC + cleanupAllFixtures afterAll.

import { afterAll, afterEach, beforeAll, describe, expect, it } from 'vitest'
import { createClient as createSupabaseClient, type SupabaseClient } from '@supabase/supabase-js'
import type { Database } from '@/types/supabase'
import { createTestUser, cleanupAllFixtures } from '@/tests/integration/_lib/fixtures'

// Helper local : client authenticated via signInWithPassword (pattern 7.A.4).
// service_role bypass RLS mais expose auth.uid()=null -> is_accompagnant() retournerait
// toujours false. Pour tester le contrat reel on doit passer par un client anon signe.
async function authenticatedClientFor(email: string, password: string) {
  const url = process.env.SUPABASE_URL ?? process.env.NEXT_PUBLIC_SUPABASE_URL
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  if (!url || !anonKey) {
    throw new Error(
      '[7.A.8 tests] SUPABASE_URL ou NEXT_PUBLIC_SUPABASE_ANON_KEY absent : ' +
        'requis pour signer un client authenticated (cf. integration-tests.yml).',
    )
  }
  const client = createSupabaseClient<Database>(url, anonKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  })
  const { error } = await client.auth.signInWithPassword({ email, password })
  if (error) throw new Error(`signInWithPassword echec : ${error.message}`)
  return client
}

describe('rls-helpers : is_accompagnant() coherence DEFINER (story 7.A.8)', () => {
  let currentClient: SupabaseClient<Database> | null = null

  beforeAll(async () => {
    await cleanupAllFixtures()
  })

  afterEach(async () => {
    if (currentClient) {
      await currentClient.auth.signOut()
      currentClient = null
    }
  })

  afterAll(async () => {
    await cleanupAllFixtures()
  })

  it('(a) user role=accompagnant -> rpc is_accompagnant() retourne true', async () => {
    const user = await createTestUser('accompagnant')
    currentClient = await authenticatedClientFor(user.email, user.password)

    const { data, error } = await currentClient.rpc('is_accompagnant')

    expect(error).toBeNull()
    expect(data).toBe(true)
  })

  it('(b) user role=accompagne -> rpc is_accompagnant() retourne false', async () => {
    const user = await createTestUser('accompagne')
    currentClient = await authenticatedClientFor(user.email, user.password)

    const { data, error } = await currentClient.rpc('is_accompagnant')

    expect(error).toBeNull()
    expect(data).toBe(false)
  })

  it('(c) user role=admin -> rpc is_accompagnant() retourne false', async () => {
    const user = await createTestUser('admin')
    currentClient = await authenticatedClientFor(user.email, user.password)

    const { data, error } = await currentClient.rpc('is_accompagnant')

    expect(error).toBeNull()
    expect(data).toBe(false)
  })
})
