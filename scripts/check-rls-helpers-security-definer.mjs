#!/usr/bin/env node
// scripts/check-rls-helpers-security-definer.mjs
// Story 7.A.8 (decision F-Epic7-A8) : garde-fou meta verrouillant
// SECURITY DEFINER sur les 3 helpers RLS role-based de public :
//   - public.is_admin()
//   - public.is_accompagne()
//   - public.is_accompagnant()
//
// Toute future migration qui dropperait ou recreerait l un d eux sans clause
// SECURITY DEFINER fera echouer ce check au build (vercel.json buildCommand chainage
// apres check:oracle-paywall). Regle DECISIONS.md F-Epic7-A8.
//
// Mecanique : appel a la RPC `public.get_rls_helpers_security_definer()` (cree
// migration 20260514140000) qui retourne TABLE (proname text, prosecdef boolean)
// pour les 3 helpers. La RPC est SECURITY DEFINER + GRANT EXECUTE TO service_role.
//
// Exit codes : 0 OK, 1 violation detectee, 2 erreur connexion / env manquante.
//
// Hors-CI (pas de SUPABASE_SERVICE_ROLE_KEY ou pas de SUPABASE_URL) : skip silencieux
// exit 0 -> pas de bruit en dev local. Le check s arme en CI / build prod ou preview.

import { createClient } from '@supabase/supabase-js'

const HELPERS = ['is_admin', 'is_accompagne', 'is_accompagnant']

const url = process.env.SUPABASE_URL ?? process.env.NEXT_PUBLIC_SUPABASE_URL
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY

if (!url || !serviceKey) {
  // Skip silencieux hors CI : aligne sur check:env qui ne fail pas en dev local.
  console.log('[check-rls-helpers] skip : SUPABASE_URL ou SUPABASE_SERVICE_ROLE_KEY absent (hors CI).')
  process.exit(0)
}

const supabase = createClient(url, serviceKey, {
  auth: { autoRefreshToken: false, persistSession: false },
})

let rows
try {
  const { data, error } = await supabase.rpc('get_rls_helpers_security_definer')
  if (error) {
    console.error(`[check-rls-helpers] ERREUR RPC : ${error.message} (code=${error.code ?? '?'})`)
    console.error('[check-rls-helpers] Verifier que la migration 20260514140000_get_rls_helpers_security_definer_rpc.sql a bien ete appliquee.')
    process.exit(2)
  }
  if (!Array.isArray(data)) {
    console.error('[check-rls-helpers] ERREUR : reponse RPC inattendue (non-array).')
    process.exit(2)
  }
  rows = data
} catch (err) {
  const message = err instanceof Error ? err.message : String(err)
  console.error(`[check-rls-helpers] ERREUR connexion Supabase : ${message}`)
  process.exit(2)
}

const prosecdefByName = new Map(rows.map((row) => [row.proname, row.prosecdef === true]))

const violations = []
for (const helper of HELPERS) {
  if (!prosecdefByName.has(helper)) {
    violations.push(`${helper}: ABSENT en BDD prod (drift ou helper supprime).`)
    continue
  }
  if (prosecdefByName.get(helper) !== true) {
    violations.push(`${helper}: prosecdef=false (attendu true / SECURITY DEFINER, cf. F-Epic7-A8).`)
  }
}

if (violations.length > 0) {
  console.error('[check-rls-helpers] VIOLATIONS DETECTEES :')
  for (const v of violations) console.error(`  - ${v}`)
  console.error('')
  console.error('Regle DECISIONS.md F-Epic7-A8 : tout helper RLS is_<role>() dans public')
  console.error('doit etre STABLE SECURITY DEFINER. Si une migration recente a recreer un')
  console.error('helper sans cette clause, ajouter ALTER FUNCTION public.<name>() SECURITY DEFINER;')
  process.exit(1)
}

console.log(`[check-rls-helpers] OK : ${HELPERS.length} helpers en SECURITY DEFINER (${HELPERS.join(', ')}).`)
process.exit(0)
