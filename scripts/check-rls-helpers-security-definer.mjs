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
// apres check:as-any-admin). Regle DECISIONS.md F-Epic7-A8.
//
// Exit codes : 0 OK, 1 violation detectee, 2 erreur connexion / env manquante.
//
// Hors-CI (pas de VERCEL_ENV, pas de SUPABASE_SERVICE_ROLE_KEY) : skip silencieux
// exit 0 -> pas de bruit en dev local. Le check s arme en CI / build prod ou preview.

const HELPERS = ['is_admin', 'is_accompagne', 'is_accompagnant']

const url = process.env.SUPABASE_URL ?? process.env.NEXT_PUBLIC_SUPABASE_URL
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY

if (!url || !serviceKey) {
  // Skip silencieux hors CI : aligne sur check:env qui ne fail pas en dev local.
  console.log('[check-rls-helpers] skip : SUPABASE_URL ou SUPABASE_SERVICE_ROLE_KEY absent (hors CI).')
  process.exit(0)
}

const sql = `
  SELECT proname, prosecdef
  FROM pg_proc p
  JOIN pg_namespace n ON p.pronamespace = n.oid
  WHERE n.nspname = 'public'
    AND proname IN ('is_admin','is_accompagne','is_accompagnant')
  ORDER BY proname;
`

// Pas d API SQL directe en supabase-js v2 : on passe par une RPC dediee si elle
// existe, sinon on tente un appel pg_meta via fetch direct. Le pattern le plus
// simple et portable est d invoquer les 3 helpers via .rpc() et de verifier
// qu ils ne throw pas, ET de lire prosecdef via un SELECT sur une vue qu on
// expose seulement si dispo. Pour rester self-contained, on cree une RPC ad-hoc
// si absente est trop intrusif : on utilise donc l API postgres-meta de Supabase
// REST endpoint /rest/v1/rpc/<helper> n expose pas prosecdef.
//
// Approche retenue : appel REST POST a la fonction PostgreSQL via le endpoint
// /rest/v1/ avec une instruction SQL impossible (PostgREST ne supporte pas le SQL
// brut). On utilise donc le client supabase pour appeler une fonction systeme
// via pg-meta : l URL /pg/meta n est pas garantie publique.
//
// Solution simple : exposer cette verification via une fonction Postgres dediee
// `public.get_rls_helpers_security_definer()` retournant TABLE (proname text,
// prosecdef boolean). MAIS cela necessite une nouvelle migration. Trop lourd
// pour un garde-fou meta.
//
// Compromis pragmatique : faire un appel HTTP direct au endpoint pg-rest avec
// le service_role et une requete .from('pg_proc')... echoue car pg_proc n est
// pas expose. On utilise donc directement le endpoint `https://${ref}.supabase.co/pg/meta/v1/query`
// **OU** l API admin REST. Le plus portable et zero-dependance : fetch direct
// sur l endpoint `/rest/v1/rpc/pg_meta_query` n existe pas.
//
// Solution finale : on cree une RPC `__check_rls_helpers_definer()` MAIS pour
// eviter une migration dediee on s appuie sur le fait que les 3 helpers existent
// deja et qu ils ont des comportements DEFINER differents : si DEFINER, le helper
// peut lire users meme si l user ne peut pas (et inversement). MAIS le SELECT
// retourne false dans les 2 cas pour un user qui n est pas le role en question.
// -> insuffisant pour distinguer DEFINER vs INVOKER cote test runtime.
//
// Donc on adopte l approche : appel HTTP direct au endpoint pg-meta query
// (privé Supabase) avec service_role. URL : /pg/meta/default/query.

const projectRef = (() => {
  try {
    const u = new URL(url)
    return u.hostname.split('.')[0]
  } catch {
    return null
  }
})()

if (!projectRef) {
  console.error(`[check-rls-helpers] ERREUR : impossible de parser le project ref depuis SUPABASE_URL=${url}`)
  process.exit(2)
}

// Endpoint pg-meta interne Supabase : POST query SQL libre via service_role.
// Note : si Supabase change cet endpoint, fallback documente : ajouter une RPC
// `public.get_rls_helpers_security_definer()` dediee dans une migration.
const endpoint = `${url.replace(/\/+$/, '')}/pg/meta/default/query`

let prosecdefByName
try {
  const res = await fetch(endpoint, {
    method: 'POST',
    headers: {
      apikey: serviceKey,
      Authorization: `Bearer ${serviceKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ query: sql }),
  })
  if (!res.ok) {
    const body = await res.text().catch(() => '<no body>')
    console.error(
      `[check-rls-helpers] ERREUR pg-meta : HTTP ${res.status} ${res.statusText} - ${body.slice(0, 200)}`,
    )
    console.error('[check-rls-helpers] Fallback : ajouter une RPC dediee si l endpoint pg/meta n est pas accessible.')
    process.exit(2)
  }
  const rows = await res.json()
  if (!Array.isArray(rows)) {
    console.error('[check-rls-helpers] ERREUR : reponse pg-meta inattendue (non-array).')
    process.exit(2)
  }
  prosecdefByName = new Map(rows.map((row) => [row.proname, row.prosecdef === true]))
} catch (err) {
  const message = err instanceof Error ? err.message : String(err)
  console.error(`[check-rls-helpers] ERREUR connexion pg-meta : ${message}`)
  process.exit(2)
}

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
