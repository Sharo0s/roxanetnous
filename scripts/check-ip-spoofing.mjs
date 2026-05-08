#!/usr/bin/env node
// Story 4.5 (DECISIONS.md F10) : garde-fou anti-regression sur la detection IP.
//
// Pattern interdit : lecture directe de `x-forwarded-for` ou `x-real-ip`
// dans le code metier. Tout besoin d'IP cliente passe par le helper
// `lib/get-client-ip.ts` qui delegue a `ipAddress()` du SDK `@vercel/functions`.
//
// Le seul fichier autorise a mentionner ces strings est `lib/get-client-ip.ts`
// dans son commentaire d'entete documentant le pattern interdit (allowlist).
//
// Le check execute un grep recursif sur les sources de production (app/, lib/,
// scripts/). Les tests unitaires vivent sous tests/ (hors SEARCH_PATHS) donc
// aucune exclusion par pattern de fichier n'est necessaire.
//
// Pattern aligne sur scripts/check-required-env.mjs (story 4.8) : node mjs +
// exit code + log clair. Integre au buildCommand Vercel via vercel.json:6.

import { execSync } from 'node:child_process'
import { existsSync } from 'node:fs'

const FORBIDDEN_PATTERN = 'x-forwarded-for|x-real-ip'
const SEARCH_PATHS = ['app/', 'lib/', 'scripts/']
const ALLOWLIST = new Set([
  'lib/get-client-ip.ts',
  'scripts/check-ip-spoofing.mjs',
])

// Code review story 4.5 P2 : sans cette verification, si un refactor renomme
// ou supprime un fichier allowliste, le grep ne retourne plus la ligne et le
// script exit 0 silencieusement (zero match). Fail-loud explicite : echec si
// une entree d'allowlist pointe vers un fichier inexistant.
for (const allowlisted of ALLOWLIST) {
  if (!existsSync(allowlisted)) {
    console.error(
      `ERREUR : entree d'allowlist "${allowlisted}" introuvable. ` +
        'Mettre a jour ALLOWLIST dans scripts/check-ip-spoofing.mjs apres ' +
        'tout deplacement/suppression du helper IP.',
    )
    process.exit(2)
  }
}

let stdout = ''
try {
  stdout = execSync(
    `grep -rEn "${FORBIDDEN_PATTERN}" ` +
      `--include='*.ts' --include='*.tsx' --include='*.mjs' ` +
      SEARCH_PATHS.join(' '),
    { encoding: 'utf8' },
  )
} catch (err) {
  // grep exit 1 = aucun match -> cas nominal apres migration story 4.5.
  if (err.status === 1) {
    console.log('OK : aucune lecture directe x-forwarded-for / x-real-ip detectee.')
    process.exit(0)
  }
  console.error('ERREUR : exec grep echec inattendu.')
  console.error(err.stderr || err.message)
  process.exit(2)
}

const lines = stdout.trim().split('\n').filter(Boolean)

// Filtre les lignes provenant de fichiers en allowlist (commentaire d'entete
// du helper qui documente le pattern interdit).
const violations = lines.filter((line) => {
  const filePath = line.split(':', 1)[0]
  return !ALLOWLIST.has(filePath)
})

if (violations.length === 0) {
  console.log('OK : aucune lecture directe x-forwarded-for / x-real-ip detectee.')
  process.exit(0)
}

console.error(
  'ERREUR : detection directe de x-forwarded-for / x-real-ip detectee. ' +
    'Utiliser lib/get-client-ip.ts (story 4.5).',
)
for (const line of violations) {
  console.error(`  ${line}`)
}
process.exit(1)
