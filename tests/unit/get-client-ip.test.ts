// Story 4.5 : tests unitaires purs pour le helper de detection IP.
// Pas de Supabase, pas de fixtures, pas de mock Sentry. Vitest seul.
// AC6 : cas U1-U5 garantissant le contrat anti-spoofing du helper.
// Code review story 4.5 : U6 (Headers natif, lock contrat SDK runtime),
// U7 (empty-string normalise en absence d'IP, P4 anti-DoS bucket vide).

import { describe, it, expect } from 'vitest'
import { getClientIp, getClientIpOrUnknown, normalizeIp, type RequestHeaders } from '@/lib/get-client-ip'

function makeHeaders(entries: Record<string, string>): RequestHeaders {
  return {
    get(name: string) {
      return entries[name.toLowerCase()] ?? null
    },
  }
}

describe('getClientIp', () => {
  it('U1 : retourne x-real-ip quand present', () => {
    const h = makeHeaders({ 'x-real-ip': '1.2.3.4' })
    expect(getClientIp(h)).toBe('1.2.3.4')
  })

  it('U2 : retourne null quand x-real-ip absent', () => {
    const h = makeHeaders({})
    expect(getClientIp(h)).toBeNull()
  })

  it('U4 : ignore x-forwarded-for (anti-spoofing contract)', () => {
    const h = makeHeaders({ 'x-forwarded-for': '1.2.3.4' })
    expect(getClientIp(h)).toBeNull()
  })

  it('U5 : priorite stricte a x-real-ip vs x-forwarded-for', () => {
    const h = makeHeaders({ 'x-real-ip': '1.2.3.4', 'x-forwarded-for': '5.6.7.8' })
    expect(getClientIp(h)).toBe('1.2.3.4')
  })

  it('U6 : accepte un Headers natif (lock contrat SDK runtime path)', () => {
    const h = new Headers([['x-real-ip', '1.2.3.4']])
    expect(getClientIp(h)).toBe('1.2.3.4')
  })

  it('U7 : x-real-ip vide normalise en null (anti rate-limit collapse)', () => {
    const h = makeHeaders({ 'x-real-ip': '' })
    expect(getClientIp(h)).toBeNull()
  })
})

describe('getClientIpOrUnknown', () => {
  it('U3 : retourne "unknown" quand x-real-ip absent', () => {
    const h = makeHeaders({})
    expect(getClientIpOrUnknown(h)).toBe('unknown')
  })

  it('U7b : x-real-ip vide retourne "unknown" (pas de bucket notifications-ouverture: vide)', () => {
    const h = makeHeaders({ 'x-real-ip': '' })
    expect(getClientIpOrUnknown(h)).toBe('unknown')
  })
})

// Story 5.C.3 (AI-4.15) : tests normalizeIp pour la conversion
// IPv4-mapped IPv6 vers IPv4 canonique. Couvre 4 cas requis par le tech-spec.
describe('normalizeIp', () => {
  it('N1 : IPv4-mapped IPv6 -> IPv4 canonique', () => {
    expect(normalizeIp('::ffff:1.2.3.4')).toBe('1.2.3.4')
    expect(normalizeIp('::ffff:192.168.1.1')).toBe('192.168.1.1')
    expect(normalizeIp('::ffff:255.255.255.255')).toBe('255.255.255.255')
  })

  it('N2 : vraie IPv6 -> conservee telle quelle', () => {
    expect(normalizeIp('2001:db8::1')).toBe('2001:db8::1')
    expect(normalizeIp('::1')).toBe('::1')
    expect(normalizeIp('fe80::1234:5678:90ab:cdef')).toBe('fe80::1234:5678:90ab:cdef')
  })

  it('N3 : IPv4 deja canonique -> conservee telle quelle', () => {
    expect(normalizeIp('1.2.3.4')).toBe('1.2.3.4')
    expect(normalizeIp('192.168.1.1')).toBe('192.168.1.1')
  })

  it('N4 : valeur invalide / null / vide -> null', () => {
    expect(normalizeIp(null)).toBeNull()
    expect(normalizeIp(undefined)).toBeNull()
    expect(normalizeIp('')).toBeNull()
  })

  it('N5 : IPv4-mapped avec octets hors plage -> conservee (pas de fix tacite)', () => {
    expect(normalizeIp('::ffff:999.999.999.999')).toBe('::ffff:999.999.999.999')
    expect(normalizeIp('::ffff:1.2.3.256')).toBe('::ffff:1.2.3.256')
  })

  it('N6 : faux positif IPv4-mapped (prefixe sans IPv4 valide derriere) -> conservee', () => {
    expect(normalizeIp('::ffff:foo')).toBe('::ffff:foo')
    expect(normalizeIp('::ffff:1.2.3')).toBe('::ffff:1.2.3')
  })

  it('N7 : integration getClientIp normalise IPv4-mapped', () => {
    const h = makeHeaders({ 'x-real-ip': '::ffff:1.2.3.4' })
    expect(getClientIp(h)).toBe('1.2.3.4')
  })
})
