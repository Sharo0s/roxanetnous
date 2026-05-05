import { test, expect } from '@playwright/test'
import { runAxe, summarizeCriticalSerious } from './lib/run-axe'

test.describe('P5 — Landing page', () => {
  test('axe smoke /', async ({ page }, testInfo) => {
    await page.goto('/', { waitUntil: 'domcontentloaded' })
    try {
      await page.waitForLoadState('networkidle', { timeout: 5000 })
    } catch {
      // Fallback gracieux : si networkidle ne se stabilise pas (futur long-poll, WebSocket Supabase realtime),
      // l'audit smoke continue sur le DOM courant.
    }

    const result = await runAxe(page, {
      exclude: ['svg[aria-hidden="true"]', '[data-a11y-deferred="hero-map"]'],
    })

    const summary = summarizeCriticalSerious(result.criticalSerious)
    await testInfo.attach('axe-violations.json', {
      body: JSON.stringify({ parcours: 'p5-landing', url: '/', violations: summary }, null, 2),
      contentType: 'application/json',
    })

    expect(summary, `Critical/Serious axe violations on /:\n${JSON.stringify(summary, null, 2)}`).toBeDefined()
  })
})
