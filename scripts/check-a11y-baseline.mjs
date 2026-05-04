#!/usr/bin/env node
import { execSync } from 'node:child_process'
import { readFileSync, readdirSync } from 'node:fs'
import { dirname, relative, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = dirname(fileURLToPath(import.meta.url))
const repoRoot = resolve(__dirname, '..')
const baselineDir = resolve(repoRoot, '_bmad-output', 'test-artifacts')

function findLatestBaseline() {
  const files = readdirSync(baselineDir).filter(
    (f) => /^a11y-lint-baseline-\d{4}-\d{2}-\d{2}\.txt$/.test(f),
  )
  if (files.length === 0) return null
  files.sort()
  return resolve(baselineDir, files[files.length - 1])
}

function parseBaseline(path) {
  const content = readFileSync(path, 'utf8')
  const totalMatch = content.match(/^Total a11y violations:\s*(\d+)/m)
  if (!totalMatch) {
    throw new Error(`Cannot parse baseline total in ${path}`)
  }
  const total = parseInt(totalMatch[1], 10)

  // Empreinte (file, rule) -> count parsee depuis la section "By file:"
  const byFileRule = new Map()
  const byFileSectionStart = content.indexOf('\nBy file:\n')
  if (byFileSectionStart !== -1) {
    const tail = content.slice(byFileSectionStart + '\nBy file:\n'.length)
    let currentFile = null
    for (const rawLine of tail.split('\n')) {
      if (!rawLine.length) continue
      // Fichier : "  path/to/file.tsx:" (2 espaces, finit par ":")
      const fileMatch = rawLine.match(/^ {2}([^ ].*?):$/)
      if (fileMatch) {
        currentFile = fileMatch[1]
        continue
      }
      // Regle : "    jsx-a11y/<rule> (N)" (4 espaces)
      const ruleMatch = rawLine.match(/^ {4}(jsx-a11y\/\S+) \((\d+)\)$/)
      if (ruleMatch && currentFile) {
        const key = `${currentFile}::${ruleMatch[1]}`
        byFileRule.set(key, parseInt(ruleMatch[2], 10))
        continue
      }
    }
  }

  return { total, byFileRule }
}

function runEslintJson() {
  try {
    return execSync('npx eslint . --format=json', {
      cwd: repoRoot,
      maxBuffer: 64 * 1024 * 1024,
      stdio: ['ignore', 'pipe', 'pipe'],
    }).toString()
  } catch (err) {
    const out = err.stdout?.toString() ?? ''
    if (out) return out
    throw err
  }
}

const baselinePath = findLatestBaseline()
if (!baselinePath) {
  console.error(
    'No a11y baseline file found in _bmad-output/test-artifacts/. Run `node scripts/build-a11y-baseline.mjs` first.',
  )
  process.exit(1)
}

const baseline = parseBaseline(baselinePath)
const raw = runEslintJson()

let report
try {
  report = JSON.parse(raw)
} catch (err) {
  console.error('Could not parse ESLint JSON output:', err.message)
  process.exit(1)
}

// Construire l'empreinte courante (file, rule) -> count + total
const currentByFileRule = new Map()
const currentDetails = new Map() // key -> [{ line, col, message }, ...]
let currentTotal = 0

for (const fileResult of report) {
  const relPath = relative(repoRoot, fileResult.filePath)
  for (const msg of fileResult.messages) {
    if (typeof msg.ruleId !== 'string' || !msg.ruleId.startsWith('jsx-a11y/')) continue
    currentTotal += 1
    const key = `${relPath}::${msg.ruleId}`
    currentByFileRule.set(key, (currentByFileRule.get(key) ?? 0) + 1)
    if (!currentDetails.has(key)) currentDetails.set(key, [])
    currentDetails.get(key).push({
      line: msg.line,
      column: msg.column,
      message: msg.message,
    })
  }
}

// Detection des regressions par paire (file, rule)
// - paire absente du baseline mais presente courante = nouvelle violation
// - paire dont le compteur courant > compteur baseline = aggravation
const regressions = []
for (const [key, currentCount] of currentByFileRule.entries()) {
  const baselineCount = baseline.byFileRule.get(key) ?? 0
  if (currentCount > baselineCount) {
    const [file, rule] = key.split('::')
    regressions.push({
      file,
      rule,
      baselineCount,
      currentCount,
      delta: currentCount - baselineCount,
      details: currentDetails.get(key) ?? [],
    })
  }
}

if (regressions.length > 0) {
  console.error(
    `\nA11y regression detected: ${regressions.length} (file, rule) pair(s) above baseline.`,
  )
  console.error(
    `Total: ${currentTotal} violations (baseline total: ${baseline.total}).`,
  )
  console.error(`Baseline file: ${relative(repoRoot, baselinePath)}\n`)
  console.error('Regressions par paire (fichier, regle) :')
  for (const r of regressions) {
    console.error(
      `  ${r.file}  ${r.rule}  ${r.baselineCount} -> ${r.currentCount}  (+${r.delta})`,
    )
    for (const d of r.details) {
      console.error(`    ligne ${d.line}:${d.column}  ${d.message}`)
    }
  }
  console.error(
    '\nFix the new violations or, if the baseline must change, regenerate it via `node scripts/build-a11y-baseline.mjs` and commit it (with PR justification).',
  )
  process.exit(1)
}

// Garde-fou supplementaire : detecter un baseline qui aurait shrink artificiellement
// (e.g. depreciation d'une regle plugin qui retire des violations sans correctif reel)
// Si le baseline total est largement superieur au total courant, suggerer une regen.
const shrinkRatio = baseline.total > 0 ? currentTotal / baseline.total : 1
if (shrinkRatio < 0.9 && baseline.total - currentTotal >= 10) {
  console.warn(
    `\nNote: current total (${currentTotal}) is significantly below baseline (${baseline.total}). ` +
      `Consider regenerating the baseline to lock in the improvement (commit it with PR justification).`,
  )
}

console.log(
  `OK: ${currentTotal} jsx-a11y violations across ${currentByFileRule.size} (file, rule) pair(s). Baseline total: ${baseline.total}. No regression.`,
)
process.exit(0)
