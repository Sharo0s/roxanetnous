// Tests ad-hoc des fonctions pures de parrainage (alphabet, normalisation).
// Lance via : ./node_modules/.bin/tsx scripts/test-parrainage.ts
// Les tests ne touchent pas Supabase (ce qui requerrait un scope HTTP Next.js).
// Pour les tests bout en bout, utiliser le UI reel via `npm run dev`.

import { randomInt } from 'node:crypto'
import { normalizeAddress, normalizeEmail, mergeFlagSuspicion } from '../lib/parrainage-detection'

const CODE_ALPHABET = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789'
const CODE_LENGTH = 8
const CODE_REGEX = new RegExp(`^[${CODE_ALPHABET}]{${CODE_LENGTH}}$`)

function generateCode(): string {
  let out = ''
  for (let i = 0; i < CODE_LENGTH; i++) {
    out += CODE_ALPHABET.charAt(randomInt(0, CODE_ALPHABET.length))
  }
  return out
}

function normalizeCode(input: string): string {
  return (input || '').toUpperCase().replace(/[\s-]/g, '')
}

let pass = 0
let fail = 0

function check(label: string, ok: boolean, detail?: unknown) {
  if (ok) {
    pass++
    console.log(`PASS ${label}`)
  } else {
    fail++
    console.log(`FAIL ${label}`, detail ?? '')
  }
}

// Alphabet : 31 chars sans 0/O/1/I/L
check('Alphabet length = 31', CODE_ALPHABET.length === 31)
check('Alphabet exclut 0/O/1/I/L', !/[0OIL1]/.test(CODE_ALPHABET))

// generateCode genere une chaine 8 chars dans l'alphabet (crypto.randomInt)
let allOk = true
for (let i = 0; i < 1000; i++) {
  const code = generateCode()
  if (!CODE_REGEX.test(code)) {
    allOk = false
    console.log(`FAIL generateCode iter ${i}: ${code}`)
    fail++
    break
  }
}
check('generateCode (1000 iter, alphabet ok, longueur 8, crypto.randomInt)', allOk)

// normalizeCode : uppercase
check('normalizeCode("k7qm2x9p") -> "K7QM2X9P"', normalizeCode('k7qm2x9p') === 'K7QM2X9P')
// normalizeCode : retire tirets et espaces
check('normalizeCode("k7qm-2x9p") -> "K7QM2X9P"', normalizeCode('k7qm-2x9p') === 'K7QM2X9P')
check('normalizeCode("  K7QM 2X9P  ") -> "K7QM2X9P"', normalizeCode('  K7QM 2X9P  ') === 'K7QM2X9P')
// normalizeCode : ne tronque PAS (la troncature a été supprimée pour rejeter explicitement les codes trop longs)
check(
  'normalizeCode > 8 chars NE tronque PAS',
  normalizeCode('ABCDEFGHIJ') === 'ABCDEFGHIJ'
)
// normalizeCode : input vide
check('normalizeCode("") -> ""', normalizeCode('') === '')
check('normalizeCode("   -- ") -> ""', normalizeCode('   -- ') === '')

// Story 2.3 : normalizeAddress / normalizeEmail / mergeFlagSuspicion.
// Pas de gestion accents ni geocoding (decision MVP).
check(
  'normalizeAddress casse : "1 Rue De La Paix" -> "1 rue de la paix"',
  normalizeAddress('1 Rue De La Paix') === '1 rue de la paix',
)
check(
  'normalizeAddress espaces multiples : "1   rue  paix" -> "1 rue paix"',
  normalizeAddress('1   rue  paix') === '1 rue paix',
)
check(
  'normalizeAddress trim + tabulations : " \\t1 rue paix\\n " -> "1 rue paix"',
  normalizeAddress(' \t1 rue paix\n ') === '1 rue paix',
)
check('normalizeAddress vide : "" -> ""', normalizeAddress('') === '')
check(
  'normalizeAddress preserve accents : "12 Rue Forêt" -> "12 rue forêt"',
  normalizeAddress('12 Rue Forêt') === '12 rue forêt',
)

check('normalizeEmail("  Foo@Bar.COM ") -> "foo@bar.com"', normalizeEmail('  Foo@Bar.COM ') === 'foo@bar.com')

check('mergeFlagSuspicion(null, "meme_ip") -> "meme_ip"', mergeFlagSuspicion(null, 'meme_ip') === 'meme_ip')
check(
  'mergeFlagSuspicion("meme_ip", "meme_adresse") -> "meme_ip,meme_adresse"',
  mergeFlagSuspicion('meme_ip', 'meme_adresse') === 'meme_ip,meme_adresse',
)
check(
  'mergeFlagSuspicion idempotent : "meme_ip" + "meme_ip" -> "meme_ip"',
  mergeFlagSuspicion('meme_ip', 'meme_ip') === 'meme_ip',
)

console.log(`\n${pass} PASS, ${fail} FAIL`)
process.exit(fail > 0 ? 1 : 0)
