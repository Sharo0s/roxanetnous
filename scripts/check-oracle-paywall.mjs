#!/usr/bin/env node
// scripts/check-oracle-paywall.mjs
// Story 5.B.1 : garde-fou anti-regression sur le message d'erreur paywall messagerie.
//
// Pattern interdit : tout message d'erreur dans `app/actions/messages.ts` qui mentionne
// explicitement un role (`accompagnant`, `accompagnante`, `accompagne`, `beneficiaire`,
// `auxiliaire`) dans une chaine retournee a un visiteur non-abonne. Cela reintroduirait
// l'oracle d'enumeration de role corrige par 5.B.1.
//
// Cas autorises (pas un match) :
//   - 'Seuls les accompagnants peuvent utiliser cette fonction.' : message de
//     defense en profondeur DESTINATAIRE = l'utilisateur connecte, lit son propre role,
//     pas d'inference cross-user. C'est une regle de routing, pas un oracle.
//   - 'Seuls les accompagnés peuvent initier une conversation.' : meme cas.
//
// Le pattern cible specifiquement le mot 'contacter' (verb de l'interaction
// cross-user) couple a un role nomme.
//
// Exit codes : 0 OK, 1 violation detectee, 2 erreur scan.

import { existsSync, readFileSync } from 'node:fs'
import { resolve, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const TARGET = resolve(ROOT, 'app/actions/messages.ts')

if (!existsSync(TARGET)) {
  console.error(`[check-oracle-paywall] ERREUR : ${TARGET} absent.`)
  process.exit(2)
}

const source = readFileSync(TARGET, 'utf8')
const lines = source.split('\n')

// Cherche les literaux de strings qui matchent simultanement :
//   1. le verb 'contacter' (l'interaction cross-user)
//   2. un role nomme (accompagnant, accompagnante, accompagne, beneficiaire, auxiliaire)
// Doit etre dans un return error, pas dans un commentaire.
const ROLE_RE = /(accompagnant[es]?|accompagn[eé]s?|beneficiaire|auxiliaire)/i
const CONTACT_RE = /contacter\s+(un|une|le|la|cet|cette)?\s*(accompagnant|accompagnante|accompagne|beneficiaire|auxiliaire)/i

const matches = []
for (let i = 0; i < lines.length; i++) {
  const line = lines[i]
  // Skip commentaires (ligne commencant par //, ou ligne dans un block-comment)
  const trimmed = line.trim()
  if (trimmed.startsWith('//') || trimmed.startsWith('*')) continue
  if (CONTACT_RE.test(line) && ROLE_RE.test(line)) {
    matches.push(`${TARGET.replace(`${ROOT}/`, '')}:${i + 1}: ${trimmed}`)
  }
}

if (matches.length > 0) {
  console.error('[check-oracle-paywall] ERREUR : message paywall messagerie expose un role (oracle d\'enumeration).')
  for (const m of matches) console.error(`  ${m}`)
  console.error('  Utiliser PAYWALL_GENERIC_ERROR a la place (cf. story 5.B.1).')
  process.exit(1)
}

// AC5 Story 7.A.5 : verifier que la constante PAYWALL_GENERIC_ERROR existe + value attendue.
// Empeche une suppression silencieuse de la constante OU son renommage en literal differencie.
const CONST_RE = /const\s+PAYWALL_GENERIC_ERROR\s*=\s*['"]Abonnement requis pour echanger des messages\.['"]/
if (!CONST_RE.test(source)) {
  console.error('[check-oracle-paywall] ERREUR : constante PAYWALL_GENERIC_ERROR absente ou valeur differente du literal Story 7.A.5.')
  console.error('  Attendu : const PAYWALL_GENERIC_ERROR = \'Abonnement requis pour echanger des messages.\'')
  process.exit(1)
}

// AC6 Story 7.A.5 : verifier que le retour { error: PAYWALL_GENERIC_ERROR } est utilise >=3x (3 call sites).
// Empeche un retour partiel a un literal differencie sur l'un des 3 call sites.
const USAGE_RE = /return\s+\{\s*error:\s*PAYWALL_GENERIC_ERROR/g
const usageMatches = source.match(USAGE_RE) || []
if (usageMatches.length < 3) {
  console.error(`[check-oracle-paywall] ERREUR : PAYWALL_GENERIC_ERROR utilise ${usageMatches.length}x dans return error, attendu >=3 (cf. Story 7.A.5 AC6).`)
  console.error('  Verifier que les 3 server actions paywall (getOrCreateConversation, getOrCreateConversationAsAccompagnante, sendMessage) partagent toutes la constante.')
  process.exit(1)
}

console.log('[check-oracle-paywall] OK : aucun message paywall messagerie expose le role cible.')
process.exit(0)
