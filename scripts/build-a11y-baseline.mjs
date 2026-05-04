#!/usr/bin/env node
import { execSync } from 'node:child_process'
import { writeFileSync, mkdirSync } from 'node:fs'
import { dirname, relative, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = dirname(fileURLToPath(import.meta.url))
const repoRoot = resolve(__dirname, '..')

const today = new Date().toISOString().slice(0, 10)
const outFile = resolve(
  repoRoot,
  '_bmad-output',
  'test-artifacts',
  `a11y-lint-baseline-${today}.txt`,
)

let commit = 'unknown'
try {
  commit = execSync('git rev-parse HEAD', { cwd: repoRoot }).toString().trim()
} catch {}

let raw = ''
try {
  raw = execSync('npx eslint . --format=json', {
    cwd: repoRoot,
    maxBuffer: 64 * 1024 * 1024,
    stdio: ['ignore', 'pipe', 'pipe'],
  }).toString()
} catch (err) {
  raw = err.stdout?.toString() ?? ''
  if (!raw) {
    console.error('ESLint did not produce JSON output:', err.message)
    process.exit(1)
  }
}

let report
try {
  report = JSON.parse(raw)
} catch (err) {
  console.error('Could not parse ESLint JSON output:', err.message)
  process.exit(1)
}

const ruleCounts = new Map()
const fileCounts = new Map()
let totalErrors = 0
let totalWarnings = 0

for (const fileResult of report) {
  const fileMessages = fileResult.messages.filter(
    (m) => typeof m.ruleId === 'string' && m.ruleId.startsWith('jsx-a11y/'),
  )
  if (fileMessages.length === 0) continue

  const relPath = relative(repoRoot, fileResult.filePath)
  const fileBucket = fileCounts.get(relPath) ?? new Map()

  for (const msg of fileMessages) {
    if (msg.severity === 2) totalErrors += 1
    else if (msg.severity === 1) totalWarnings += 1

    ruleCounts.set(msg.ruleId, (ruleCounts.get(msg.ruleId) ?? 0) + 1)
    fileBucket.set(msg.ruleId, (fileBucket.get(msg.ruleId) ?? 0) + 1)
  }
  fileCounts.set(relPath, fileBucket)
}

const totalA11y = totalErrors + totalWarnings

const lines = []
lines.push('# Ne pas regenerer ce baseline pour faire passer la CI sans justification dans le PR.')
lines.push('# Toute regeneration doit etre motivee : montee de version plugin, livraison story Lot A, ou correction massive justifiee.')
lines.push('')
lines.push('A11Y LINT BASELINE')
lines.push(`Generated: ${today}`)
lines.push(`Commit: ${commit}`)
lines.push(`Total a11y violations: ${totalA11y}`)
lines.push(`Total errors: ${totalErrors}`)
lines.push(`Total warnings: ${totalWarnings}`)
lines.push('')
lines.push('By rule:')
const sortedRules = [...ruleCounts.entries()].sort(
  (a, b) => b[1] - a[1] || a[0].localeCompare(b[0]),
)
for (const [rule, count] of sortedRules) {
  lines.push(`  ${rule}: ${count}`)
}
lines.push('')
lines.push('By file:')
const sortedFiles = [...fileCounts.entries()].sort((a, b) =>
  a[0].localeCompare(b[0]),
)
for (const [file, bucket] of sortedFiles) {
  lines.push(`  ${file}:`)
  const fileRules = [...bucket.entries()].sort(
    (a, b) => b[1] - a[1] || a[0].localeCompare(b[0]),
  )
  for (const [rule, count] of fileRules) {
    lines.push(`    ${rule} (${count})`)
  }
}
lines.push('')

mkdirSync(dirname(outFile), { recursive: true })
writeFileSync(outFile, lines.join('\n'), 'utf8')

console.log(`Baseline written: ${outFile}`)
console.log(`Total a11y violations: ${totalA11y} (errors: ${totalErrors}, warnings: ${totalWarnings})`)
