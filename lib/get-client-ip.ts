// Story 4.5 : helper centralise pour la detection IP cliente.
// Pourquoi : le pattern `headers().get('x-forwarded-for')?.split(',')[0]` etait
// sujet au spoofing hors Vercel et trompeur en lecture (le commentaire TODO
// historique `parrainage.ts:332` documentait la dette). On bascule sur
// `ipAddress()` du SDK `@vercel/functions` qui lit le header `x-real-ip`
// sanitise par Vercel Proxy (cf. https://vercel.com/docs/edge-network/headers).
// Pattern interdit (DECISIONS.md F10) : lecture directe de `x-forwarded-for`
// ou `x-real-ip` dans le code metier. Garde-fou `npm run check:ip-spoofing`.
//
// Le helper ne depend que de `@vercel/functions` (pas de Next.js, Supabase,
// Sentry) pour rester portable middleware Edge / route handlers / server
// actions / futurs workers Workflow.

import { ipAddress } from '@vercel/functions'

export type RequestHeaders = { get(name: string): string | null }

// Code review story 4.5 P4 : `ipAddress()` preserve une valeur vide (`''`)
// au lieu de la traiter comme nullish. Sans guard, `getClientIpOrUnknown`
// retournerait `''` -> rate-limit key `waitlist:` (bucket partage anonyme,
// DoS surface si Vercel emettait jamais un x-real-ip vide). Normalise les
// valeurs vides en absence d'IP (null / 'unknown').
function resolve(headers: RequestHeaders): string | null {
  const ip = ipAddress(headers)
  return ip && ip.length > 0 ? ip : null
}

export function getClientIp(headers: RequestHeaders): string | null {
  return resolve(headers)
}

export function getClientIpOrUnknown(headers: RequestHeaders): string {
  return resolve(headers) ?? 'unknown'
}
