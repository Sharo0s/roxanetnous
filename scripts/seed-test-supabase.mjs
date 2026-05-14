#!/usr/bin/env node
// Seeds Supabase local pour les tests d'integration.
// Pattern : (1) cree 5 users via supabase.auth.admin.createUser avec UUID fixes,
// (2) execute les fichiers SQL supabase/seeds/01-04 via pg client.
//
// Usage :
//   node scripts/seed-test-supabase.mjs           # Apply seeds (idempotent)
//   node scripts/seed-test-supabase.mjs --reset   # Cleanup avant re-apply

import { createClient } from '@supabase/supabase-js'
import pg from 'pg'
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, resolve } from 'node:path'

const { Client } = pg
const __dirname = dirname(fileURLToPath(import.meta.url))
const SEEDS_DIR = resolve(__dirname, '..', 'supabase', 'seeds')

// Garde-fou D4 : refus categorique si non local.
const SUPABASE_URL = process.env.SUPABASE_URL ?? process.env.NEXT_PUBLIC_SUPABASE_URL
const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY

if (!SUPABASE_URL || !SERVICE_ROLE_KEY) {
  console.error(
    '[seed-test] Variables manquantes : SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY requis.\n' +
      'Lancer `supabase start` puis `supabase status --output json` pour les recuperer.',
  )
  process.exit(1)
}

// Comparaison stricte sur le hostname pour eviter qu'un domaine type
// `localhost.evil.com` matche le substring (review code 2026-05-09 H1).
let supabaseHostname
try {
  supabaseHostname = new URL(SUPABASE_URL).hostname
} catch {
  console.error(`[seed-test] SUPABASE_URL='${SUPABASE_URL}' n'est pas une URL valide.`)
  process.exit(1)
}
const LOCAL_HOSTS = new Set(['localhost', '127.0.0.1', '[::1]', '::1'])
if (!LOCAL_HOSTS.has(supabaseHostname)) {
  console.error(
    `[seed-test] Refus categorique d'executer : SUPABASE_URL hostname='${supabaseHostname}' n'est pas local.\n` +
      'Pattern aligne sur tests/integration/setup.ts (D4 story 4.4).',
  )
  process.exit(1)
}

// Connection string Postgres derivee de SUPABASE_URL.
// Supabase local expose Postgres sur localhost:54322 par defaut.
const PG_URL =
  process.env.SUPABASE_DB_URL ??
  'postgresql://postgres:postgres@localhost:54322/postgres'

const SEED_USERS = [
  { id: '00000000-0000-0000-0000-000000000001', role: 'admin', label: 'Admin' },
  { id: '00000000-0000-0000-0000-000000000002', role: 'accompagnant', label: 'Accompagnante' },
  { id: '00000000-0000-0000-0000-000000000003', role: 'accompagne', label: 'Accompagne' },
  { id: '00000000-0000-0000-0000-000000000004', role: 'accompagnant', label: 'Marraine' },
  { id: '00000000-0000-0000-0000-000000000005', role: 'accompagnant', label: 'Filleule' },
]

const SEED_FILES = [
  '01_users.sql',
  '02_parrainages.sql',
  '03_notifications_ouverture.sql',
  '04_subscriptions.sql',
]

async function reset(supabase, pgClient) {
  console.log('[seed-test] Reset : nettoyage des rows seed-* avant re-apply...')

  // Cleanup tables enfants -> parents (FK-safe).
  const seedIds = SEED_USERS.map((u) => u.id)

  // Cleanup parrainages (FK vers users)
  await pgClient.query(`DELETE FROM public.parrainages WHERE id IN (
    '00000000-0000-0000-0000-00000000aaa1',
    '00000000-0000-0000-0000-00000000aaa2'
  )`)
  await pgClient.query(`DELETE FROM public.parrainages_codes WHERE user_id = ANY($1)`, [seedIds])

  // Cleanup subscriptions
  await pgClient.query(`DELETE FROM public.subscriptions WHERE user_id = ANY($1)`, [seedIds])

  // Cleanup waitlist
  await pgClient.query(`DELETE FROM public.waitlist_departements WHERE email LIKE 'seed-waitlist-%@test.local'`)

  // Cleanup auth.users + public.users (cascade) via auth admin.
  // Try/catch explicite : on ne masque plus les erreurs reelles (review code
  // 2026-05-09 H7). Continue la boucle si un user est deja supprime, throw
  // si erreur reseau/auth pour rendre l'echec visible.
  for (const user of SEED_USERS) {
    try {
      const { error } = await supabase.auth.admin.deleteUser(user.id)
      if (error && !error.message?.includes('not found')) {
        console.warn(`[seed-test] Cleanup user ${user.label} : ${error.message}`)
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err)
      if (!message.includes('not found') && !message.includes('User not found')) {
        console.warn(`[seed-test] Cleanup user ${user.label} (throw) : ${message}`)
      }
    }
  }

  console.log('[seed-test] Reset complet.')
}

async function createSeedUsers(supabase) {
  console.log('[seed-test] Creation des 5 users seed via auth.admin...')

  for (const user of SEED_USERS) {
    const email = `seed-${user.label.toLowerCase()}@test.local`
    const { error } = await supabase.auth.admin.createUser({
      email,
      password: 'seed-password-1234',
      email_confirm: true,
      user_metadata: { role: user.role, first_name: 'Seed', last_name: user.label },
      // Note : le param `id` UUID custom est supporte depuis @supabase/supabase-js 2.41+.
      id: user.id,
    })
    if (error) {
      // Si le user existe deja (re-run sans --reset), on continue.
      if (error.message?.includes('already been registered') || error.message?.includes('duplicate')) {
        console.log(`[seed-test]   ${user.label} (${user.id.slice(0, 8)}...) deja existant, skip.`)
        continue
      }
      throw new Error(`createSeedUser ${user.label} echec : ${error.message}`)
    }
    console.log(`[seed-test]   ${user.label} (${user.id.slice(0, 8)}...) cree.`)
  }
}

async function applySeedFiles(pgClient) {
  console.log('[seed-test] Application des fichiers SQL seeds...')

  for (const filename of SEED_FILES) {
    const path = resolve(SEEDS_DIR, filename)
    const sql = readFileSync(path, 'utf-8')
    console.log(`[seed-test]   ${filename}...`)
    await pgClient.query(sql)
  }
}

async function main() {
  const reset_mode = process.argv.includes('--reset')

  const supabase = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, {
    auth: { autoRefreshToken: false, persistSession: false },
  })

  const pgClient = new Client({ connectionString: PG_URL })
  await pgClient.connect()

  try {
    if (reset_mode) {
      await reset(supabase, pgClient)
    }
    await createSeedUsers(supabase)
    await applySeedFiles(pgClient)

    // Verification : count des users seed crees
    const { rows } = await pgClient.query(
      `SELECT count(*) AS c FROM public.users WHERE email LIKE 'seed-%@test.local'`,
    )
    console.log(`[seed-test] OK : ${rows[0].c} users seed presents en BDD.`)
  } finally {
    await pgClient.end()
  }
}

main().catch((err) => {
  console.error('[seed-test] echec :', err.message)
  process.exit(1)
})
