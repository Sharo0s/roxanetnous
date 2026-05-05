#!/usr/bin/env node
import { spawnSync } from 'node:child_process'
import { mkdirSync, readdirSync, readFileSync } from 'node:fs'
import { dirname, relative, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = dirname(fileURLToPath(import.meta.url))
const repoRoot = resolve(__dirname, '..')
const baselineDir = resolve(repoRoot, '_bmad-output', 'test-artifacts')
const reportFile = resolve(repoRoot, 'playwright-report', 'results.json')

function findLatestBaseline() {
  let files = []
  try {
    files = readdirSync(baselineDir).filter((f) =>
      /^axe-core-baseline-\d{4}-\d{2}-\d{2}\.json$/.test(f),
    )
  } catch {
    return null
  }
  if (files.length === 0) return null
  files.sort()
  return resolve(baselineDir, files[files.length - 1])
}

const baselinePath = findLatestBaseline()
if (!baselinePath) {
  console.error(
    'No axe-core baseline found. Run `npm run a11y:axe:baseline` first to generate one.',
  )
  process.exit(1)
}

let baseline
try {
  baseline = JSON.parse(readFileSync(baselinePath, 'utf8'))
} catch (err) {
  console.error(`Failed to parse baseline ${baselinePath}: ${err.message}`)
  process.exit(1)
}

console.log(`Using baseline: ${relative(repoRoot, baselinePath)}`)
console.log('Running Playwright suite (JSON reporter) ...')

mkdirSync(dirname(reportFile), { recursive: true })

const env = { ...process.env, PLAYWRIGHT_JSON_OUTPUT_NAME: reportFile }
const run = spawnSync(
  'npx',
  ['playwright', 'test', '--reporter=json'],
  {
    cwd: repoRoot,
    env,
    stdio: ['ignore', 'pipe', 'inherit'],
    maxBuffer: 256 * 1024 * 1024,
  },
)

if (run.status !== 0 && run.status !== 1) {
  console.error(`Playwright run failed with exit code ${run.status}`)
  process.exit(run.status ?? 1)
}

let raw = run.stdout?.toString() ?? ''
let report
try {
  report = raw ? JSON.parse(raw) : JSON.parse(readFileSync(reportFile, 'utf8'))
} catch {
  try {
    report = JSON.parse(readFileSync(reportFile, 'utf8'))
  } catch (err) {
    console.error('Could not parse Playwright JSON report:', err.message)
    process.exit(1)
  }
}

const current = []

const walk = (suites = []) => {
  for (const suite of suites) {
    for (const spec of suite.specs ?? []) {
      for (const t of spec.tests ?? []) {
        for (const result of t.results ?? []) {
          for (const attachment of result.attachments ?? []) {
            if (attachment.name === 'axe-violations.json' && attachment.body) {
              try {
                const decoded = Buffer.from(attachment.body, 'base64').toString('utf8')
                const payload = JSON.parse(decoded)
                current.push({
                  id: payload.parcours,
                  url: payload.url,
                  proxy: Boolean(payload.proxy),
                  violations: payload.violations ?? [],
                })
              } catch (err) {
                console.error(`Failed to decode axe attachment: ${err.message}`)
              }
            }
          }
        }
      }
    }
    if (Array.isArray(suite.suites)) walk(suite.suites)
  }
}

walk(report.suites ?? [])

if (current.length === 0) {
  console.error('No axe attachments found in current Playwright run.')
  process.exit(1)
}

current.sort((a, b) => a.id.localeCompare(b.id))

const baselineByParcours = new Map()
const baselineDuplicateIds = []
for (const p of baseline.parcours ?? []) {
  if (baselineByParcours.has(p.id)) {
    baselineDuplicateIds.push(p.id)
  }
  baselineByParcours.set(p.id, p)
}
if (baselineDuplicateIds.length > 0) {
  console.warn(
    `Baseline contient des ids parcours en doublon (${baselineDuplicateIds.length}): ${baselineDuplicateIds.join(', ')}. ` +
      'Le wrapper a conserve la derniere occurrence. Corriger en regenerant le baseline.',
  )
}

const currentIds = new Set(current.map((c) => c.id))
const removedFromCurrent = []
for (const id of baselineByParcours.keys()) {
  if (!currentIds.has(id)) {
    removedFromCurrent.push(id)
  }
}

const newViolations = []
const addedNodes = []
const escalatedImpacts = []
const resolvedRules = []
const missingParcours = []

const IMPACT_RANK = { minor: 1, moderate: 2, serious: 3, critical: 4 }
const isImpactEscalation = (baseImpact, curImpact) => {
  const baseRank = IMPACT_RANK[baseImpact] ?? 0
  const curRank = IMPACT_RANK[curImpact] ?? 0
  return curRank > baseRank
}

for (const cur of current) {
  const base = baselineByParcours.get(cur.id)
  if (!base) {
    missingParcours.push(cur.id)
    if (cur.violations.length > 0) {
      for (const v of cur.violations) {
        newViolations.push({ parcours: cur.id, ruleId: v.ruleId, count: v.count, impact: v.impact })
      }
    }
    continue
  }
  const baseRules = new Map(base.violations.map((v) => [v.ruleId, v]))
  const curRules = new Map(cur.violations.map((v) => [v.ruleId, v]))

  for (const [ruleId, v] of curRules.entries()) {
    if (!baseRules.has(ruleId)) {
      newViolations.push({ parcours: cur.id, ruleId, count: v.count, impact: v.impact })
      continue
    }
    const baseV = baseRules.get(ruleId)
    if ((v.count ?? 0) > (baseV.count ?? 0)) {
      addedNodes.push({
        parcours: cur.id,
        ruleId,
        baselineCount: baseV.count ?? 0,
        currentCount: v.count ?? 0,
        delta: (v.count ?? 0) - (baseV.count ?? 0),
        impact: v.impact,
      })
    }
    if (isImpactEscalation(baseV.impact, v.impact)) {
      escalatedImpacts.push({
        parcours: cur.id,
        ruleId,
        baseImpact: baseV.impact ?? 'unknown',
        currentImpact: v.impact ?? 'unknown',
        count: v.count ?? 0,
      })
    }
  }
  for (const ruleId of baseRules.keys()) {
    if (!curRules.has(ruleId)) {
      resolvedRules.push({ parcours: cur.id, ruleId })
    }
  }
}

const hasRegression = newViolations.length > 0 || addedNodes.length > 0

console.log('')
console.log('axe-core delta vs baseline')
console.log(`Baseline: ${relative(repoRoot, baselinePath)} (commit ${baseline.commitSha ?? 'unknown'})`)
console.log(`Parcours audites: ${current.length}`)
if (resolvedRules.length > 0) {
  console.log(`Regles resolues (${resolvedRules.length}):`)
  for (const r of resolvedRules) console.log(`  - [${r.parcours}] ${r.ruleId}`)
}
if (missingParcours.length > 0) {
  console.warn(`Parcours absents du baseline (${missingParcours.length}):`)
  for (const id of missingParcours) console.warn(`  - ${id}`)
}
if (removedFromCurrent.length > 0) {
  console.warn(
    `Parcours presents dans le baseline mais absents du run courant (${removedFromCurrent.length}):`,
  )
  for (const id of removedFromCurrent) console.warn(`  - ${id}`)
  console.warn(
    'Verifier qu\'aucune spec n\'a ete supprimee par erreur. Si la suppression est volontaire, regenerer le baseline.',
  )
}
if (escalatedImpacts.length > 0) {
  console.warn(`Escalades d'impact detectees a count constant (${escalatedImpacts.length}, non bloquant):`)
  for (const e of escalatedImpacts) {
    console.warn(`  ! [${e.parcours}] ${e.ruleId}: ${e.baseImpact} -> ${e.currentImpact} (${e.count} noeud(s))`)
  }
  console.warn(
    'Une regle a ete reclassifiee a un impact superieur. Cause probable : montee de version axe-core. ' +
      'Pas une nouvelle violation mais une priorisation accrue. Regenerez le baseline si l\'escalade est connue.',
  )
}

if (hasRegression) {
  console.error('')
  console.error('Regression axe-core detectee :')
  for (const v of newViolations) {
    console.error(`  + [${v.parcours}] ${v.ruleId} (${v.impact ?? 'unknown'}) — ${v.count} noeud(s) (nouveau)`)
  }
  for (const v of addedNodes) {
    console.error(`  ~ [${v.parcours}] ${v.ruleId} (${v.impact ?? 'unknown'}) — ${v.baselineCount} -> ${v.currentCount} (+${v.delta})`)
  }
  console.error('')
  console.error(
    'Corrigez les nouvelles violations ou, si le baseline doit changer, regenerez-le via `npm run a11y:axe:baseline` et committez-le (avec justification dans le PR).',
  )
  process.exit(1)
}

console.log('OK: aucun delta Critical/Serious au-dela du baseline.')
process.exit(0)
