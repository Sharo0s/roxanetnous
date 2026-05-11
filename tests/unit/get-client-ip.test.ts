// Story 4.5 : tests unitaires purs pour le helper de detection IP.
// Pas de Supabase, pas de fixtures, pas de mock Sentry. Vitest seul.
// AC6 : cas U1-U5 garantissant le contrat anti-spoofing du helper.
// Code review story 4.5 : U6 (Headers natif, lock contrat SDK runtime),
// U7 (empty-string normalise en absence d'IP, P4 anti-DoS bucket vide).

import { describe, it, expect } from 'vitest'
import { getClientIp, getClientIpOrUnknown, type RequestHeaders } from '@/lib/get-client-ip'

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
