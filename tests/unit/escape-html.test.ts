// Story 4.9 : tests XSS sur escapeHtml. Vecteurs classiques + edge cases.
// Pattern strictement aligne sur tests/unit/get-client-ip.test.ts (story 4.5).
// Cf. AC2 / AC3 / AC13 de _bmad-output/implementation-artifacts/4-9-validation-escape-html-test-xss-emails.md.

import { describe, it, expect } from 'vitest'
import { escapeHtml } from '@/lib/escape-html'

describe('escapeHtml', () => {
  it('T1 : echappe un script tag basique', () => {
    expect(escapeHtml('<script>alert(1)</script>')).toBe(
      '&lt;script&gt;alert(1)&lt;/script&gt;',
    )
  })

  it('T2 : echappe le tag inline avec event handler', () => {
    expect(escapeHtml('<img src=x onerror=alert(1)>')).toBe(
      '&lt;img src=x onerror=alert(1)&gt;',
    )
  })

  it('T3 : preserve javascript: URI (escapeHtml n est PAS un sanitizer URL)', () => {
    expect(escapeHtml('javascript:alert(1)')).toBe('javascript:alert(1)')
  })

  it('T4 : non-idempotent (double-encodage volontaire de &)', () => {
    expect(escapeHtml('&amp;lt;')).toBe('&amp;amp;lt;')
  })

  it('T5 : preserve unicode + accent (decodage parser amont)', () => {
    expect(escapeHtml('café <b> bold')).toBe('café &lt;b&gt; bold')
  })

  it('T6 : echappe double quote (anti attribute breakout)', () => {
    expect(escapeHtml('a" onerror="alert(1)')).toBe(
      'a&quot; onerror=&quot;alert(1)',
    )
  })

  it('T7 : preserve single quote (attributs en double quote uniquement)', () => {
    expect(escapeHtml("d'arc")).toBe("d'arc")
  })

  it('T8 : empty string -> empty string', () => {
    expect(escapeHtml('')).toBe('')
  })

  it('T9 : chaine sans caractere a echapper inchangee', () => {
    expect(escapeHtml('Bonjour Sylvain')).toBe('Bonjour Sylvain')
  })

  it('T10 : combinaison de plusieurs vecteurs', () => {
    expect(
      escapeHtml('<a href="x" onclick="alert(\'xss\')">Cliquez</a>'),
    ).toBe(
      '&lt;a href=&quot;x&quot; onclick=&quot;alert(\'xss\')&quot;&gt;Cliquez&lt;/a&gt;',
    )
  })
})
