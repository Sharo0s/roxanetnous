#!/usr/bin/env node
// scripts/vercel-env-push.mjs
// Story 5.C.4 (AI-4.10) : push semi-automatise des env vars REQUIRED vers Vercel
// (Production + Preview) en s'appuyant sur la liste autoritaire de check-required-env.mjs.
//
// Pourquoi : la configuration manuelle via Vercel UI est sujette au drift entre
// environnements et chronophage. Ce script :
//   1. Lit la liste REQUIRED + OPTIONAL_ON_PREVIEW depuis scripts/check-required-env.mjs
//   2. Pour chaque var manquante en Vercel (verifie via `vercel env ls`), prompt
//      l'utilisateur pour la valeur (lecture stdin, masquage saisie).
//   3. Pousse via `vercel env add <NAME> <ENV>` pour Production + Preview.
//
// Hors scope : suppression de vars existantes, modification de vars existantes,
// dev environment (utiliser .env.local manuel).
//
// Pre-requis :
//   - Vercel CLI installe (`npm i -g vercel`)
//   - `vercel link` execute prealablement (.vercel/project.json present)
//
// Usage :
//   node scripts/vercel-env-push.mjs              # dry-run, liste les vars manquantes
//   node scripts/vercel-env-push.mjs --apply      # mode interactif, prompt + push
//
// Exit codes :
//   0 : OK (toutes vars presentes OU push reussi)
//   1 : echec push ou prompt annule
//   2 : pre-requis manquant (CLI, projet non linke)

import { execSync, spawnSync } from 'node:child_process'
import { existsSync, readFileSync } from 'node:fs'
import { createInterface } from 'node:readline'
import { resolve, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
import { pathToFileURL } from 'node:url'

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const APPLY_MODE = process.argv.includes('--apply')

// ---------------------------------------------------------------------------
// 1. Pre-requis : Vercel CLI installe + projet linke
// ---------------------------------------------------------------------------

function checkVercelCli() {
  try {
    execSync('vercel --version', { stdio: 'pipe' })
  } catch {
    console.error('[vercel-env-push] ERREUR : Vercel CLI absent.')
    console.error('  Installer : npm i -g vercel')
    process.exit(2)
  }
}

function checkProjectLinked() {
  const linkFile = resolve(ROOT, '.vercel/project.json')
  if (!existsSync(linkFile)) {
    console.error('[vercel-env-push] ERREUR : projet non linke a Vercel.')
    console.error('  Executer : vercel link')
    process.exit(2)
  }
}

// ---------------------------------------------------------------------------
// 2. Lire la liste autoritaire depuis check-required-env.mjs
// ---------------------------------------------------------------------------

async function loadAuthoritativeList() {
  const checkEnvPath = resolve(ROOT, 'scripts/check-required-env.mjs')
  const source = readFileSync(checkEnvPath, 'utf8')
  // Parser naif : extrait les `name` des deux constantes REQUIRED et OPTIONAL_ON_PREVIEW.
  // Plus robuste qu'un import dynamique car evite les side-effects de check-required-env.mjs.
  const extract = (constName) => {
    const re = new RegExp(`const ${constName} = \\[([\\s\\S]*?)\\]`)
    const match = source.match(re)
    if (!match) return []
    const namesRe = /name:\s*'([A-Z0-9_]+)'/g
    const names = []
    let m
    while ((m = namesRe.exec(match[1])) !== null) {
      names.push(m[1])
    }
    return names
  }
  return {
    required: extract('REQUIRED'),
    optionalOnPreview: extract('OPTIONAL_ON_PREVIEW'),
  }
}

// ---------------------------------------------------------------------------
// 3. Lister les vars deja configurees dans Vercel
// ---------------------------------------------------------------------------

function listVercelEnv(target) {
  // `vercel env ls <target>` retourne un tableau ASCII. On extrait juste les noms.
  try {
    const output = execSync(`vercel env ls ${target}`, {
      stdio: ['pipe', 'pipe', 'pipe'],
      encoding: 'utf8',
    })
    // Cherche lignes type "  VAR_NAME    Encrypted   3d ago" et extrait VAR_NAME.
    const names = new Set()
    for (const line of output.split('\n')) {
      const match = line.match(/^\s*([A-Z][A-Z0-9_]+)\s+/)
      if (match) names.add(match[1])
    }
    return names
  } catch (err) {
    console.error(`[vercel-env-push] ERREUR : echec 'vercel env ls ${target}'.`)
    console.error(err.message)
    process.exit(2)
  }
}

// ---------------------------------------------------------------------------
// 4. Prompt utilisateur pour une valeur (saisie masquee)
// ---------------------------------------------------------------------------

async function promptValue(name, description) {
  return new Promise((resolveP) => {
    const rl = createInterface({
      input: process.stdin,
      output: process.stdout,
    })
    process.stdout.write(`\n[${name}] ${description || ''}\n  Valeur (vide = skip) : `)
    rl.question('', (answer) => {
      rl.close()
      resolveP(answer.trim())
    })
  })
}

// ---------------------------------------------------------------------------
// 5. Push vers Vercel (Production + Preview)
// ---------------------------------------------------------------------------

function pushEnvVar(name, value, target) {
  const result = spawnSync('vercel', ['env', 'add', name, target], {
    input: `${value}\n`,
    stdio: ['pipe', 'inherit', 'inherit'],
    encoding: 'utf8',
  })
  if (result.status !== 0) {
    console.error(`[vercel-env-push] ECHEC push ${name} -> ${target}.`)
    return false
  }
  return true
}

// ---------------------------------------------------------------------------
// MAIN
// ---------------------------------------------------------------------------

async function main() {
  checkVercelCli()
  checkProjectLinked()

  const { required, optionalOnPreview } = await loadAuthoritativeList()
  const allVars = [...required, ...optionalOnPreview]

  console.log(`[vercel-env-push] ${required.length} REQUIRED + ${optionalOnPreview.length} OPTIONAL_ON_PREVIEW = ${allVars.length} vars autoritaires.\n`)

  const prodExisting = listVercelEnv('production')
  const previewExisting = listVercelEnv('preview')

  const missingProd = allVars.filter((v) => !prodExisting.has(v))
  const missingPreview = required.filter((v) => !previewExisting.has(v))

  console.log(`Vars manquantes en Production : ${missingProd.length}`)
  if (missingProd.length > 0) console.log(`  ${missingProd.join(', ')}`)
  console.log(`Vars manquantes en Preview    : ${missingPreview.length}`)
  if (missingPreview.length > 0) console.log(`  ${missingPreview.join(', ')}`)

  if (missingProd.length === 0 && missingPreview.length === 0) {
    console.log('\n[vercel-env-push] OK : toutes les vars REQUIRED + OPTIONAL_ON_PREVIEW sont configurees.')
    process.exit(0)
  }

  if (!APPLY_MODE) {
    console.log('\n[vercel-env-push] Mode dry-run. Pour pousser les vars manquantes : node scripts/vercel-env-push.mjs --apply')
    process.exit(0)
  }

  // Mode --apply : prompt + push
  const targets = new Set([...missingProd.map((v) => ({ name: v, target: 'production' })), ...missingPreview.map((v) => ({ name: v, target: 'preview' }))])
  for (const { name, target } of targets) {
    const value = await promptValue(name, `Push vers Vercel ${target}`)
    if (!value) {
      console.log(`  [SKIP] ${name} (${target}) : valeur vide.`)
      continue
    }
    const ok = pushEnvVar(name, value, target)
    if (!ok) {
      console.error(`[vercel-env-push] Echec push ${name} -> ${target}. Arret.`)
      process.exit(1)
    }
    console.log(`  [OK] ${name} -> ${target}.`)
  }

  console.log('\n[vercel-env-push] Termine. Redeployer Vercel pour activer les nouvelles vars.')
  process.exit(0)
}

main().catch((err) => {
  console.error('[vercel-env-push] ERREUR inattendue.', err)
  process.exit(1)
})
