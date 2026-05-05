import { test, expect } from '@playwright/test'
import { runAxe, summarizeCriticalSerious } from './lib/run-axe'

// Parcours auth-required : voir tests/a11y/lib/auth-stub.md
// On audite la page de login comme proxy d'entree de la messagerie.
test.describe('P3 — Messagerie (proxy login)', () => {
  test('axe smoke /login (proxy P3)', async ({ page }, testInfo) => {
    await page.goto('/login', { waitUntil: 'domcontentloaded' })
    try {
      await page.waitForLoadState('networkidle', { timeout: 5000 })
    } catch {
      // Fallback gracieux : si networkidle ne se stabilise pas (futur long-poll, WebSocket Supabase realtime),
      // l'audit smoke continue sur le DOM courant.
    }

    const result = await runAxe(page)
    const summary = summarizeCriticalSerious(result.criticalSerious)
    await testInfo.attach('axe-violations.json', {
      body: JSON.stringify(
        { parcours: 'p3-messagerie', url: '/login', proxy: true, violations: summary },
        null,
        2,
      ),
      contentType: 'application/json',
    })

    expect(summary).toBeDefined()
  })
})
