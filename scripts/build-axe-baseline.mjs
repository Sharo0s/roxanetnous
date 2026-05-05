#!/usr/bin/env node
import { execSync, spawnSync } from 'node:child_process'
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = dirname(fileURLToPath(import.meta.url))
const repoRoot = resolve(__dirname, '..')

const today = new Date().toISOString().slice(0, 10)
const reportFile = resolve(repoRoot, 'playwright-report', 'results.json')
const outFile = resolve(
  repoRoot,
  '_bmad-output',
  'test-artifacts',
  `axe-core-baseline-${today}.json`,
)

let commit = 'unknown'
try {
  commit = execSync('git rev-parse HEAD', { cwd: repoRoot }).toString().trim()
} catch {}

console.log(`Running Playwright suite (JSON reporter -> ${reportFile}) ...`)
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
  console.error(`Playwright run failed with code ${run.status}`)
  process.exit(run.status ?? 1)
}

const playwrightHadFailures = run.status === 1

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

const parcours = []
let totalTests = 0
let testsWithAttachment = 0

const walkSuites = (suites = []) => {
  for (const suite of suites) {
    if (Array.isArray(suite.specs)) {
      for (const spec of suite.specs) {
        for (const t of spec.tests ?? []) {
          totalTests += 1
          let foundAttachmentForThisTest = false
          for (const result of t.results ?? []) {
            for (const attachment of result.attachments ?? []) {
              if (attachment.name === 'axe-violations.json' && attachment.body) {
                try {
                  const decoded = Buffer.from(attachment.body, 'base64').toString('utf8')
                  const payload = JSON.parse(decoded)
                  parcours.push({
                    id: payload.parcours,
                    url: payload.url,
                    proxy: Boolean(payload.proxy),
                    violations: payload.violations ?? [],
                  })
                  foundAttachmentForThisTest = true
                } catch (err) {
                  console.error(`Failed to decode attachment for ${spec.title}: ${err.message}`)
                }
              }
            }
          }
          if (foundAttachmentForThisTest) testsWithAttachment += 1
        }
      }
    }
    if (Array.isArray(suite.suites)) walkSuites(suite.suites)
  }
}

walkSuites(report.suites ?? [])

if (parcours.length === 0) {
  console.error('No axe attachments found in Playwright report.')
  console.error('Make sure each spec attaches an "axe-violations.json" via testInfo.attach().')
  process.exit(1)
}

if (playwrightHadFailures && testsWithAttachment < totalTests) {
  console.error(
    `Refusing to write baseline: Playwright reported ${totalTests} tests but only ${testsWithAttachment} produced an axe attachment, AND the run exited with code 1 (test failures).`,
  )
  console.error('Fix the failing specs first, then re-run `npm run a11y:axe:baseline`.')
  process.exit(1)
}

if (playwrightHadFailures) {
  console.warn(
    `Note: Playwright exited with code 1 but all ${totalTests} tests produced an axe attachment. ` +
      'Baseline will be generated, but please verify no spec failure altered the audited DOM.',
  )
}

parcours.sort((a, b) => a.id.localeCompare(b.id))

const totals = parcours.reduce(
  (acc, p) => {
    for (const v of p.violations) {
      acc.violations += 1
      acc.nodes += v.count ?? (v.nodes?.length ?? 0)
    }
    return acc
  },
  { violations: 0, nodes: 0 },
)

const baseline = {
  _comment: [
    'Ne pas regenerer ce baseline pour faire passer la CI sans justification dans le PR.',
    'Toute regeneration doit etre motivee : montee de version axe-core, livraison story Lot B, ou correction massive justifiee.',
  ],
  generatedAt: new Date().toISOString(),
  commitSha: commit,
  totals,
  parcours,
}

mkdirSync(dirname(outFile), { recursive: true })
writeFileSync(outFile, JSON.stringify(baseline, null, 2) + '\n', 'utf8')

console.log(`Baseline written: ${outFile}`)
console.log(
  `Parcours: ${parcours.length} | Critical/Serious violations: ${totals.violations} | nodes: ${totals.nodes}`,
)
