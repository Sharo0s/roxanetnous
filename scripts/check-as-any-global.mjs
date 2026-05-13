#!/usr/bin/env node
// scripts/check-as-any-global.mjs
// Story 5.C.1 (DECISIONS.md F12 ou suivante) : extension du garde-fou anti-`as any`
// hors `app/admin/` (deja couvert par check-as-any-admin.mjs depuis story 4.6).
//
// Scope : app/, lib/, components/ (hors node_modules, .next, types/, *.d.ts).
//
// Pattern interdit : toute expression `expr as any` (sous toutes formes).
// Pattern AUTORISE (pas un match) : `expr as unknown as <T>` -- cast localise
// vers un type concret via `unknown` intermediate. Ce pattern est legitime quand
// les types Supabase generes modelisent une relation 1-1 imbriquee comme tableau
// alors qu'au runtime c'est un objet (cf. story 5.C.1 messages, recherche).
//
// Exit codes :
//   0 : aucun match (OK)
//   1 : >= 1 match (FAIL livraison)
//   2 : erreur de scan

import { existsSync, readFileSync, readdirSync, statSync } from 'node:fs'
import { join, resolve, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
import ts from 'typescript'

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const SEARCH_PATHS = ['app', 'lib', 'components']
const EXTENSIONS = ['.ts', '.tsx']
const SKIP_DIRS = new Set(['node_modules', '.next', '.swc', 'types'])
const SKIP_SUFFIXES = ['.d.ts']

const matches = []

function* walk(dir) {
  for (const entry of readdirSync(dir)) {
    if (SKIP_DIRS.has(entry)) continue
    const full = join(dir, entry)
    const st = statSync(full)
    if (st.isDirectory()) {
      yield* walk(full)
    } else if (EXTENSIONS.some((ext) => full.endsWith(ext)) && !SKIP_SUFFIXES.some((suf) => full.endsWith(suf))) {
      yield full
    }
  }
}

function containsAnyKeyword(typeNode) {
  if (!typeNode) return false
  if (typeNode.kind === ts.SyntaxKind.AnyKeyword) return true
  let found = false
  ts.forEachChild(typeNode, (child) => {
    if (found) return
    if (containsAnyKeyword(child)) found = true
  })
  return found
}

function isUnknownKeyword(typeNode) {
  return typeNode && typeNode.kind === ts.SyntaxKind.UnknownKeyword
}

try {
  for (const searchDir of SEARCH_PATHS) {
    const fullSearchPath = join(ROOT, searchDir)
    if (!existsSync(fullSearchPath)) continue

    for (const file of walk(fullSearchPath)) {
      // Exclure app/admin/ (couvert par check-as-any-admin.mjs)
      if (file.includes(`${ROOT}/app/admin/`)) continue

      const source = readFileSync(file, 'utf8')
      const scriptKind = file.endsWith('.tsx') ? ts.ScriptKind.TSX : ts.ScriptKind.TS
      const sf = ts.createSourceFile(file, source, ts.ScriptTarget.Latest, true, scriptKind)

      function visit(node) {
        if (ts.isAsExpression(node) && containsAnyKeyword(node.type)) {
          // Pattern accepte : `expr as unknown as <T>` -> AsExpression dont
          // `node.expression` est lui-meme une AsExpression vers `unknown`.
          // On rejette si le cast direct est vers `any` (sans passage par unknown).
          const inner = node.expression
          if (ts.isAsExpression(inner) && isUnknownKeyword(inner.type)) {
            // C'est un `<expr> as unknown as any` -> toujours interdit.
            // Mais ce script ne devrait pas matcher cela vu que la cible est <T>, pas any.
          }
          const { line } = sf.getLineAndCharacterOfPosition(node.getStart(sf))
          const rel = file.replace(`${ROOT}/`, '')
          matches.push(`${rel}:${line + 1}: ${node.getText(sf)}`)
        }
        if (ts.isTypeAssertionExpression(node) && containsAnyKeyword(node.type)) {
          const { line } = sf.getLineAndCharacterOfPosition(node.getStart(sf))
          const rel = file.replace(`${ROOT}/`, '')
          matches.push(`${rel}:${line + 1}: ${node.getText(sf)}`)
        }
        ts.forEachChild(node, visit)
      }
      visit(sf)
    }
  }
} catch (err) {
  console.error('[check-as-any-global] ERREUR : scan AST echec inattendu.')
  console.error(err.stack || err.message)
  process.exit(2)
}

if (matches.length === 0) {
  console.log('[check-as-any-global] OK : aucune occurrence `as any` detectee hors app/admin/.')
  process.exit(0)
}

console.error(
  `[check-as-any-global] ERREUR : ${matches.length} occurrence(s) \`as any\` detectee(s) hors app/admin/. ` +
    'Resorber via typage strict (pattern recommande : `as unknown as <T>` avec type local).',
)
for (const line of matches) {
  console.error(`  ${line}`)
}
process.exit(1)
