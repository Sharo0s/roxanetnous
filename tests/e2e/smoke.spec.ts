import { test, expect } from '@playwright/test'
import { loginAs } from './_lib/session'

// Smoke test infrastructurel (story 7.C.1) : exerce le parcours end-to-end
// landing -> /login -> dashboard accompagnant sans assertion metier.
// Objectif : prouver que l'infra Playwright + Supabase local + seeds + helpers
// session.loginAs sont fonctionnels. Les scenarios applicatifs sont livres
// par 7.C.2 (anti-fraude), 7.C.3 (RGPD), 7.C.4 (matching).
test('smoke : landing -> login accompagnant -> dashboard accompagnant', async ({ page }) => {
  await page.goto('/')
  await expect(page.getByRole('heading', { level: 1 })).toBeVisible()

  await loginAs(page, 'accompagnant')

  await expect(page).toHaveURL(/\/accompagnant(\/.*)?$/)
  await expect(page.getByText(/bonjour|tableau de bord/i).first()).toBeVisible({
    timeout: 10_000,
  })
})
