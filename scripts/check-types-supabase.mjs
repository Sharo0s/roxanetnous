#!/usr/bin/env node
// scripts/check-types-supabase.mjs
// Story 4.6 : verification de la presence + validite du fichier `types/supabase.ts`.
//
// Renomme en review patch 4 (story 4.6 review) : ce script ne genere pas, il
// verifie. Ancien nom `gen-types-supabase.mjs` etait trompeur (un dev croyait
// regenerer apres une migration BDD alors qu'il n'effectuait qu'un check).
//
// La regeneration reelle se fait via le MCP Supabase (`supabase__generate_typescript_types`)
// dans une session Claude Code. Le script affiche systematiquement la procedure
// au stdout pour rappeler le workflow correct.
//
// Pourquoi pas un appel direct CLI Supabase :
// - Le MCP est autoritaire pour ce projet (cf. .claude/CLAUDE.md projet).
// - Eviter d'ajouter `supabase` (~50 Mo) en devDependency pour usage rare.
// - Regeneration manuelle apres chaque migration BDD modifiant le schema public.

import { existsSync, readFileSync } from 'node:fs'
import { resolve, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const TYPES_PATH = resolve(ROOT, 'types/supabase.ts')

const PROCEDURE = [
  'Procedure de regeneration apres migration BDD :',
  '  1. Lancer le MCP Supabase `supabase__generate_typescript_types`',
  '  2. Copier integralement le retour dans types/supabase.ts',
  '  3. Conserver le header `// types/supabase.ts ...` (5 lignes)',
  '  4. Verifier `npx tsc --noEmit` exit 0',
  '  5. Verifier `npm run check:as-any-admin` exit 0',
]

if (!existsSync(TYPES_PATH)) {
  console.error(`[check-types-supabase] ERREUR : ${TYPES_PATH} absent.`)
  for (const line of PROCEDURE) console.error(line)
  process.exit(1)
}

const content = readFileSync(TYPES_PATH, 'utf8')
if (!content.includes('export type Database')) {
  console.error(`[check-types-supabase] ERREUR : ${TYPES_PATH} ne contient pas "export type Database".`)
  console.error('[check-types-supabase] Le fichier semble corrompu. Regenerer via MCP.')
  for (const line of PROCEDURE) console.error(line)
  process.exit(1)
}

console.log(`[check-types-supabase] OK : ${TYPES_PATH} present + valide.`)
console.log('[check-types-supabase] Rappel : ce script verifie, il ne regenere pas.')
for (const line of PROCEDURE) console.log(line)
