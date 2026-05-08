#!/usr/bin/env node
// scripts/check-as-any-admin.mjs
// Story 4.6 (DECISIONS.md F11) : garde-fou anti-`as any` dans les pages admin.
//
// Pattern interdit : toute expression `expr as any` dans `app/admin/`.
// Si un cast genuinement justifie est necessaire :
// - prefere un type local (cf. AdminLogDetails dans historique/page.tsx)
// - ou commente `// eslint-disable-next-line @typescript-eslint/no-explicit-any -- justification`
//
// Implementation AST (story 4.6 review patch 3 + pass 2 patch F3) : utilise le compiler
// TypeScript pour parser chaque fichier et detecter les noeuds qui ciblent `any` sous
// toutes leurs formes :
//   - `expr as any`            -> AsExpression(AnyKeyword)
//   - `<any>expr` (legacy .ts) -> TypeAssertionExpression(AnyKeyword)
//   - `expr as any[]`          -> AsExpression(ArrayType(AnyKeyword))
//   - `expr as Record<string, any>` -> AsExpression contenant un AnyKeyword en sous-arbre
// Le visiteur explore recursivement le sous-arbre `node.type` des `AsExpression` et
// `TypeAssertionExpression` pour ne pas rater les `any` imbriques (array, generics).
// Avantage vs regex : zero faux positif sur commentaires/strings, capture les variantes
// d'espacement (espaces multiples, tab, newline, commentaire inline `as /* */ any`).
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
const SEARCH_PATH = join(ROOT, 'app/admin')
const EXTENSIONS = ['.ts', '.tsx']

if (!existsSync(SEARCH_PATH)) {
  console.error(`[check-as-any-admin] ERREUR : ${SEARCH_PATH} absent (dossier deplace ?).`)
  process.exit(2)
}

function* walk(dir) {
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry)
    const st = statSync(full)
    if (st.isDirectory()) yield* walk(full)
    else if (EXTENSIONS.some((ext) => full.endsWith(ext))) yield full
  }
}

const matches = []

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

try {
  for (const file of walk(SEARCH_PATH)) {
    const source = readFileSync(file, 'utf8')
    // .ts files use ScriptKind.TS (autorise la syntaxe legacy `<any>expr`),
    // .tsx files use ScriptKind.TSX (interdit `<any>expr` car conflit JSX).
    const scriptKind = file.endsWith('.tsx') ? ts.ScriptKind.TSX : ts.ScriptKind.TS
    const sf = ts.createSourceFile(file, source, ts.ScriptTarget.Latest, true, scriptKind)

    function visit(node) {
      // `expr as <T>` ou `expr as <T[]>` ou `expr as Record<string, any>`
      // -> AsExpression dont le sous-arbre `node.type` contient un AnyKeyword.
      if (ts.isAsExpression(node) && containsAnyKeyword(node.type)) {
        const { line } = sf.getLineAndCharacterOfPosition(node.getStart(sf))
        const rel = file.replace(`${ROOT}/`, '')
        matches.push(`${rel}:${line + 1}: ${node.getText(sf)}`)
      }
      // `<any>expr` legacy syntax (uniquement valide en .ts, pas .tsx).
      if (ts.isTypeAssertionExpression(node) && containsAnyKeyword(node.type)) {
        const { line } = sf.getLineAndCharacterOfPosition(node.getStart(sf))
        const rel = file.replace(`${ROOT}/`, '')
        matches.push(`${rel}:${line + 1}: ${node.getText(sf)}`)
      }
      ts.forEachChild(node, visit)
    }
    visit(sf)
  }
} catch (err) {
  console.error('[check-as-any-admin] ERREUR : scan AST echec inattendu.')
  console.error(err.stack || err.message)
  process.exit(2)
}

if (matches.length === 0) {
  console.log('[check-as-any-admin] OK : aucune occurrence `as any` detectee dans app/admin/.')
  process.exit(0)
}

console.error(
  `[check-as-any-admin] ERREUR : ${matches.length} occurrence(s) \`as any\` detectee(s) dans app/admin/. ` +
    'Resorber via typage strict ou commenter avec eslint-disable-next-line.',
)
for (const line of matches) {
  console.error(`  ${line}`)
}
process.exit(1)
