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

// Story 5.C.3 (AI-4.15) : normalisation IPv6 mapped IPv4 (`::ffff:1.2.3.4`)
// vers sa forme IPv4 canonique. Sans normalisation, le meme client emis via
// IPv4 OU via tunnel IPv6 (selon configuration reseau cote utilisateur ou
// load balancer) genere 2 cles rate-limit distinctes -> rate-limit contournable
// + metriques securite fragmentees. Le SDK `@vercel/functions` `ipAddress()`
// peut retourner l'une ou l'autre forme selon la chaine de proxies. Aussi
// utile pour les tags Sentry (agregation par IP fiable).
//
// Pattern detecte : `::ffff:` (8 chars de prefixe) suivi d'une IPv4 valide.
// Cas hors-cible :
//   - vraie IPv6 (ex: `2001:db8::1`) -> conserve telle quelle
//   - IPv4 deja canonique (ex: `1.2.3.4`) -> conserve telle quelle
//   - valeur invalide / null -> retourne null (laisse resolve gerer)
const IPV4_MAPPED_PREFIX = '::ffff:'
const IPV4_REGEX = /^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/

export function normalizeIp(ip: string | null | undefined): string | null {
  if (!ip || ip.length === 0) return null
  if (!ip.startsWith(IPV4_MAPPED_PREFIX)) return ip
  const candidate = ip.slice(IPV4_MAPPED_PREFIX.length)
  const match = candidate.match(IPV4_REGEX)
  if (!match) return ip
  // Valider que chaque octet est dans [0, 255]
  for (let i = 1; i <= 4; i++) {
    const octet = parseInt(match[i], 10)
    if (octet < 0 || octet > 255) return ip
  }
  return candidate
}

// Code review story 4.5 P4 : `ipAddress()` preserve une valeur vide (`''`)
// au lieu de la traiter comme nullish. Sans guard, `getClientIpOrUnknown`
// retournerait `''` -> rate-limit key `notifications-ouverture:` (bucket partage anonyme,
// DoS surface si Vercel emettait jamais un x-real-ip vide). Normalise les
// valeurs vides en absence d'IP (null / 'unknown').
function resolve(headers: RequestHeaders): string | null {
  const ip = ipAddress(headers)
  const cleaned = ip && ip.length > 0 ? ip : null
  return normalizeIp(cleaned)
}

export function getClientIp(headers: RequestHeaders): string | null {
  return resolve(headers)
}

export function getClientIpOrUnknown(headers: RequestHeaders): string {
  return resolve(headers) ?? 'unknown'
}
