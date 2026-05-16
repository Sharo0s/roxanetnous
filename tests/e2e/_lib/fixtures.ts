// Helper de cleanup des fixtures E2E.
//
// CONTRAT : tout fixture cree par les tests E2E DOIT utiliser un prefix
// `e2e-test-` dans son champ texte identifiant (titre annonce, code parrainage,
// content message, etc.). resetEphemeralRows() s'appuie sur ce contrat pour
// faire un DELETE cible sans toucher aux 5 seed users ni aux rows de seed.
//
// Pas de TRUNCATE (casserait les FK + seeds). Pas de cleanup des seed users.
//
// Connection Postgres directe via pg client (heritage scripts/seed-test-supabase.mjs:50-54).

import pg from 'pg'

const { Client } = pg

const DEFAULT_PG_URL = 'postgresql://postgres:postgres@localhost:54322/postgres'

const LOCAL_HOSTS = new Set(['localhost', '127.0.0.1', '[::1]', '::1'])

function assertLocalPgUrl(connectionString: string): void {
  let hostname: string
  try {
    hostname = new URL(connectionString.replace(/^postgres(?:ql)?:/, 'http:')).hostname
  } catch {
    throw new Error(
      `[tests/e2e/fixtures] Connection string invalide : '${connectionString}'.`,
    )
  }
  if (!LOCAL_HOSTS.has(hostname)) {
    throw new Error(
      `[tests/e2e/fixtures] Refus categorique : hostname='${hostname}' n'est pas local. ` +
        'Aucun DELETE ne sera execute hors de Supabase local.',
    )
  }
}

export async function resetEphemeralRows(): Promise<void> {
  const connectionString = process.env.SUPABASE_DB_URL ?? DEFAULT_PG_URL
  assertLocalPgUrl(connectionString)

  const client = new Client({ connectionString })
  await client.connect()

  try {
    // Ordre FK-safe : enfants -> parents. Toutes les conditions WHERE utilisent
    // le prefix `e2e-test-` ou un LIKE strict (pas de DELETE non qualifie).

    // Messages : matcher sur la colonne content.
    await client.query(`DELETE FROM public.messages WHERE content LIKE 'e2e-test-%'`)

    // Annonces accompagnants : matcher sur titre.
    await client.query(`DELETE FROM public.annonces_accompagnants WHERE titre LIKE 'e2e-test-%'`)

    // Annonces accompagnes : matcher sur titre.
    await client.query(`DELETE FROM public.annonces_accompagnes WHERE titre LIKE 'e2e-test-%'`)

    // Parrainages : matcher sur code (TEXT NOT NULL).
    await client.query(`DELETE FROM public.parrainages WHERE code LIKE 'e2e-test-%'`)
  } finally {
    await client.end()
  }
}
