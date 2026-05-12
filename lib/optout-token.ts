// Token HMAC pour les liens d'opt-out dans les emails transactionnels.
//
// Format payload : "<userId>.<type>.<expEpochSec>"
// Signature   : HMAC-SHA256(payload, OPTOUT_TOKEN_SECRET)
// Token URL   : base64url(payload) + "." + base64url(signature)
//
// TTL 90 jours par defaut : assez long pour qu'un mail recu et lu plus
// tard fonctionne encore, assez court pour qu'un lien expose dans des
// logs ne soit pas eternel. La verification compare exp >= now.
//
// Pas de dependance externe : crypto natif Node + base64url maison.
// L'usage est strictement server-side (cron + route GET).

import { createHmac, timingSafeEqual } from 'node:crypto'

const DEFAULT_TTL_SECONDS = 90 * 24 * 60 * 60

function getSecret(): string {
  const secret = process.env.OPTOUT_TOKEN_SECRET
  if (!secret || secret.length < 32) {
    throw new Error(
      'OPTOUT_TOKEN_SECRET manquant ou trop court (32 caracteres minimum requis)'
    )
  }
  return secret
}

function base64urlEncode(input: string | Buffer): string {
  const buf = typeof input === 'string' ? Buffer.from(input, 'utf8') : input
  return buf.toString('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
}

function base64urlDecode(input: string): Buffer {
  const padded = input + '='.repeat((4 - (input.length % 4)) % 4)
  return Buffer.from(padded.replace(/-/g, '+').replace(/_/g, '/'), 'base64')
}

function sign(payload: string): string {
  return base64urlEncode(createHmac('sha256', getSecret()).update(payload).digest())
}

export function createOptoutToken(params: {
  userId: string
  type: string
  ttlSeconds?: number
}): string {
  const exp = Math.floor(Date.now() / 1000) + (params.ttlSeconds ?? DEFAULT_TTL_SECONDS)
  const payload = `${params.userId}.${params.type}.${exp}`
  const signature = sign(payload)
  return `${base64urlEncode(payload)}.${signature}`
}

export type OptoutVerifyResult =
  | { ok: true; userId: string; type: string }
  | { ok: false; reason: 'malformed' | 'bad_signature' | 'expired' }

export function verifyOptoutToken(token: string): OptoutVerifyResult {
  const parts = token.split('.')
  if (parts.length !== 2) return { ok: false, reason: 'malformed' }

  const [encodedPayload, providedSignature] = parts
  let payload: string
  try {
    payload = base64urlDecode(encodedPayload).toString('utf8')
  } catch {
    return { ok: false, reason: 'malformed' }
  }

  const expectedSignature = sign(payload)
  const a = Buffer.from(providedSignature)
  const b = Buffer.from(expectedSignature)
  if (a.length !== b.length || !timingSafeEqual(a, b)) {
    return { ok: false, reason: 'bad_signature' }
  }

  const payloadParts = payload.split('.')
  if (payloadParts.length !== 3) return { ok: false, reason: 'malformed' }
  const [userId, type, expStr] = payloadParts
  const exp = Number.parseInt(expStr, 10)
  if (!Number.isFinite(exp)) return { ok: false, reason: 'malformed' }
  if (Math.floor(Date.now() / 1000) > exp) return { ok: false, reason: 'expired' }

  return { ok: true, userId, type }
}
