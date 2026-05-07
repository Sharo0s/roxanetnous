// Story 4.1 : helper pur pour hasher les keys rate-limit avant envoi a Sentry.
// Permet d'identifier un attaquant recurrent sur le dashboard Sentry (meme
// keyHash = meme IP) sans envoyer la cle brute (qui contient l'IP).
//
// Review 2026-05-07 (D3) : passage SHA-256 -> HMAC-SHA-256 sale via
// `RATE_LIMIT_HASH_SALT`. Sans sel, un attaquant ayant lecture sur Sentry
// peut precomputer l'espace IPv4 (~4B addresses) et reverser le hash en
// quelques minutes -- la troncature 16 chars n'apportait aucune protection
// PII reelle. Avec un secret cote serveur, le hash devient irreversible.
//
// Tradeoff : si `RATE_LIMIT_HASH_SALT` est absent, on bascule sur SHA-256
// non-sale (degrade gracieusement, le keyHash garde sa valeur de dedup
// d'attaquants recurrents mais perd la garantie PII forte). Le garde-fou
// `scripts/check-required-env.mjs` warn en VERCEL_ENV=production si le sel
// est absent.
//
// Espace de sortie : 16 hex chars = 64 bits. Collision birthday-bound a
// ~2^32 (suffisant pour deduplication IPv4 sans collision pratique).

import { createHash, createHmac } from 'node:crypto'

export function hashRateLimitKey(key: string): string {
  const salt = process.env.RATE_LIMIT_HASH_SALT
  const digest = salt
    ? createHmac('sha256', salt).update(key).digest('hex')
    : createHash('sha256').update(key).digest('hex')
  return digest.slice(0, 16)
}
