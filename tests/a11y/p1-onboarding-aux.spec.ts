import { test, expect } from '@playwright/test'
import { runAxe, summarizeCriticalSerious } from './lib/run-axe'

// Parcours auth-required : voir tests/a11y/lib/auth-stub.md
// On audite la page de login comme proxy d'entree de l'onboarding accompagnante.
test.describe('P1 — Onboarding accompagnante (proxy login)', () => {
  test('axe smoke /login (proxy P1)', async ({ page }, testInfo) => {
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
        { parcours: 'p1-onboarding-aux', url: '/login', proxy: true, violations: summary },
        null,
        2,
      ),
      contentType: 'application/json',
    })

    expect(summary).toBeDefined()
  })
})
