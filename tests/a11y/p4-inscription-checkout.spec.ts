import { test, expect } from '@playwright/test'
import { runAxe, summarizeCriticalSerious } from './lib/run-axe'

test.describe('P4 — Inscription / Login (publics)', () => {
  test('axe smoke /register?role=accompagnante', async ({ page }, testInfo) => {
    await page.goto('/register?role=accompagnante', { waitUntil: 'domcontentloaded' })
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
        { parcours: 'p4-register', url: '/register?role=accompagnante', violations: summary },
        null,
        2,
      ),
      contentType: 'application/json',
    })

    expect(summary).toBeDefined()
  })

  test('axe smoke /login', async ({ page }, testInfo) => {
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
        { parcours: 'p4-login', url: '/login', violations: summary },
        null,
        2,
      ),
      contentType: 'application/json',
    })

    expect(summary).toBeDefined()
  })
})
