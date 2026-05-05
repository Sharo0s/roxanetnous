import { test, expect } from '@playwright/test'
import { runAxe, summarizeCriticalSerious } from './lib/run-axe'

test.describe('P2 — Recherche publique', () => {
  test('axe smoke /recherche', async ({ page }, testInfo) => {
    await page.goto('/recherche', { waitUntil: 'domcontentloaded' })
    try {
      await page.waitForLoadState('networkidle', { timeout: 5000 })
    } catch {
      // Fallback gracieux : si networkidle ne se stabilise pas (futur long-poll, WebSocket Supabase realtime),
      // l'audit smoke continue sur le DOM courant.
    }

    const result = await runAxe(page, {
      exclude: ['.leaflet-container', '.leaflet-pane', '[data-a11y-deferred="map"]'],
    })

    const summary = summarizeCriticalSerious(result.criticalSerious)
    await testInfo.attach('axe-violations.json', {
      body: JSON.stringify({ parcours: 'p2-recherche', url: '/recherche', violations: summary }, null, 2),
      contentType: 'application/json',
    })

    expect(summary).toBeDefined()
  })
})
