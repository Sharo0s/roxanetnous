// Story 7.A.11 (F-Epic7-A11) : tests unitaires du garde-fou CI
// scripts/check-no-direct-notifications-log-insert.mjs.
//
// 3 cas (cf. AC6) :
//  (check-a) HEAD courant : exit 0 -- seul lib/notifications-log.ts contient
//            le pattern, whitelist.
//  (check-b) Fixture violation : repo temporaire (os.tmpdir) avec un fichier
//            contenant l'INSERT direct -> matches.length >= 1.
//  (check-c) Whitelist verifiable : grep du source du script pour la chaine
//            'lib/notifications-log.ts' dans WHITELIST.
//
// Approche : import direct de scanForDirectInserts() depuis le module ESM.
// Le shim CLI en fin de fichier est volontairement ignore (isMain = false en
// contexte de test). Pas d'execSync : evite la fragilite (timeouts, env).

import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { join, resolve, dirname } from 'node:path'
import { tmpdir } from 'node:os'
import { fileURLToPath } from 'node:url'

import { scanForDirectInserts, WHITELIST } from '../../scripts/check-no-direct-notifications-log-insert.mjs'

const REPO_ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..', '..')
const SCRIPT_PATH = resolve(REPO_ROOT, 'scripts/check-no-direct-notifications-log-insert.mjs')

describe('check-no-direct-notifications-log-insert', () => {
  it('(check-a) HEAD courant : aucun match hors whitelist (exit 0 equivalent)', () => {
    const matches = scanForDirectInserts(REPO_ROOT)
    expect(matches).toEqual([])
  })

  describe('(check-b) Fixture violation : repo temporaire avec INSERT direct', () => {
    let tmpRoot: string

    beforeAll(() => {
      tmpRoot = mkdtempSync(join(tmpdir(), 'check-ndli-'))
      mkdirSync(join(tmpRoot, 'app'), { recursive: true })
      writeFileSync(
        join(tmpRoot, 'app', 'fake-direct-insert.ts'),
        "import { supabase } from 'x'\nawait supabase.from('notifications_log').insert({ email: 'x' })\n",
        'utf8',
      )
    })

    afterAll(() => {
      if (tmpRoot) rmSync(tmpRoot, { recursive: true, force: true })
    })

    it('detecte le match dans le fichier offendant', () => {
      const matches = scanForDirectInserts(tmpRoot)
      expect(matches).toHaveLength(1)
      expect(matches[0]?.file).toBe('app/fake-direct-insert.ts')
      expect(matches[0]?.line).toBe(2)
      expect(matches[0]?.snippet).toContain(".from('notifications_log').insert")
    })

    it('respecte la whitelist meme dans le repo temporaire', () => {
      mkdirSync(join(tmpRoot, 'lib'), { recursive: true })
      writeFileSync(
        join(tmpRoot, 'lib', 'notifications-log.ts'),
        "await supabase.from('notifications_log').insert({})\n",
        'utf8',
      )

      const matches = scanForDirectInserts(tmpRoot)
      // 1 match attendu dans app/, 0 dans lib/notifications-log.ts (whiteliste).
      expect(matches).toHaveLength(1)
      expect(matches.map((m) => m.file)).not.toContain('lib/notifications-log.ts')
    })
  })

  it('(check-c) Whitelist verifiable : lib/notifications-log.ts present + script source contient la chaine', () => {
    // Verification programmatique (export)
    expect(WHITELIST).toContain('lib/notifications-log.ts')

    // Verification anti-regression sur le source : un refactor qui casserait
    // silencieusement la whitelist serait detecte.
    const source = readFileSync(SCRIPT_PATH, 'utf8')
    expect(source).toContain("'lib/notifications-log.ts'")
  })
})
