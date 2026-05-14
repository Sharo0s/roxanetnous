#!/usr/bin/env node
// scripts/check-no-direct-notifications-log-insert.mjs
// Story 7.A.11 (2026-05-14, F-Epic7-A11) : garde-fou CI anti-INSERT direct sur
// `notifications_log` hors du helper autorise `lib/notifications-log.ts`.
//
// Heritage : convention "tout INSERT dans notifications_log passe par
// logNotification()" -- voir DECISIONS.md F5/F6/F7 (schema + queue email) +
// commentaire de tete lib/notifications-log.ts. Avant cette story, la convention
// reposait 100% sur la vigilance code-review humaine.
//
// Scope scanne : app/, lib/, components/, scripts/ (extensions .ts, .tsx, .mjs).
// Exclusions : node_modules/, .next/, .swc/, tests/, _bmad-output/, *.d.ts.
// Whitelist unique : lib/notifications-log.ts (le helper lui-meme).
//
// Detection : grep textuel via regex `\.from\(['"]notifications_log['"]\)\s*\.insert`.
// Pas d'AST necessaire (pattern simple et specifique, false-positive improbable).
//
// Exit codes :
//   0 : aucun match hors whitelist (OK)
//   1 : >= 1 match hors whitelist (FAIL livraison)
//   2 : erreur de scan inattendue

import { existsSync, readFileSync, readdirSync, statSync } from 'node:fs'
import { join, resolve, dirname, relative } from 'node:path'
import { fileURLToPath } from 'node:url'

export const DEFAULT_SEARCH_PATHS = ['app', 'lib', 'components', 'scripts']
export const DEFAULT_EXTENSIONS = ['.ts', '.tsx', '.mjs']
export const DEFAULT_SKIP_DIRS = new Set(['node_modules', '.next', '.swc', 'tests', '_bmad-output'])
export const DEFAULT_SKIP_SUFFIXES = ['.d.ts']
export const WHITELIST = ['lib/notifications-log.ts']

const PATTERN = /\.from\(['"]notifications_log['"]\)\s*\.insert/g

function* walk(dir, skipDirs, extensions, skipSuffixes) {
  for (const entry of readdirSync(dir)) {
    if (skipDirs.has(entry)) continue
    const full = join(dir, entry)
    const st = statSync(full)
    if (st.isDirectory()) {
      yield* walk(full, skipDirs, extensions, skipSuffixes)
    } else if (
      extensions.some((ext) => full.endsWith(ext)) &&
      !skipSuffixes.some((suf) => full.endsWith(suf))
    ) {
      yield full
    }
  }
}

export function scanForDirectInserts(rootDir, options = {}) {
  const searchPaths = options.searchPaths || DEFAULT_SEARCH_PATHS
  const extensions = options.extensions || DEFAULT_EXTENSIONS
  const skipDirs = options.skipDirs || DEFAULT_SKIP_DIRS
  const skipSuffixes = options.skipSuffixes || DEFAULT_SKIP_SUFFIXES
  const whitelist = options.whitelist || WHITELIST

  const matches = []

  for (const searchDir of searchPaths) {
    const fullSearchPath = join(rootDir, searchDir)
    if (!existsSync(fullSearchPath)) continue

    for (const file of walk(fullSearchPath, skipDirs, extensions, skipSuffixes)) {
      const rel = relative(rootDir, file)
      if (whitelist.includes(rel)) continue

      const source = readFileSync(file, 'utf8')
      PATTERN.lastIndex = 0
      let match
      while ((match = PATTERN.exec(source)) !== null) {
        const line = source.slice(0, match.index).split('\n').length
        const snippet = source.split('\n')[line - 1].trim()
        matches.push({ file: rel, line, snippet })
      }
    }
  }

  return matches
}

// CLI shim
const isMain = (() => {
  try {
    return resolve(process.argv[1] || '') === fileURLToPath(import.meta.url)
  } catch {
    return false
  }
})()

if (isMain) {
  const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..')
  try {
    const matches = scanForDirectInserts(ROOT)
    if (matches.length === 0) {
      console.log(
        '[check-no-direct-notifications-log-insert] OK : aucun INSERT direct sur notifications_log hors du helper autorise.',
      )
      process.exit(0)
    }
    console.error(
      `[check-no-direct-notifications-log-insert] ERREUR : ${matches.length} INSERT direct(s) sur notifications_log detecte(s) hors whitelist.`,
    )
    for (const m of matches) {
      console.error(`  ${m.file}:${m.line}: ${m.snippet}`)
    }
    console.error(
      '  Utiliser logNotification() depuis lib/notifications-log.ts (decision F-Epic7-A11).',
    )
    process.exit(1)
  } catch (err) {
    console.error('[check-no-direct-notifications-log-insert] ERREUR : scan echec inattendu.')
    console.error(err.stack || err.message)
    process.exit(2)
  }
}
