import { defineConfig, devices } from '@playwright/test'

// Config Playwright dediee aux tests E2E (parcours utilisateur via UI reelle).
// Cohabite avec playwright.config.ts (suite a11y axe-core) sans le modifier.
// - testDir : tests/e2e (vs tests/a11y pour la config a11y).
// - reporter HTML : playwright-e2e-report/ (vs playwright-report/ pour a11y) afin
//   d'eviter tout ecrasement de rapport entre les 2 suites.
// - workers: 1 + fullyParallel: false : pattern a11y, evite les races sur Supabase
//   local + le serveur dev unique.
// - retries: 2 en CI : stabilisation flaky Playwright (cf. story 7.C.1 AC8).
// - globalSetup : refus categorique d'executer contre une URL Supabase non-locale.
export default defineConfig({
  testDir: './tests/e2e',
  fullyParallel: false,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: 1,
  reporter: [
    ['list'],
    ['html', { outputFolder: 'playwright-e2e-report', open: 'never' }],
  ],
  globalSetup: './tests/e2e/setup.ts',
  use: {
    baseURL: 'http://localhost:3000',
    trace: 'retain-on-failure',
  },
  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },
  ],
  webServer: {
    command: 'npm run dev',
    url: 'http://localhost:3000',
    reuseExistingServer: !process.env.CI,
    timeout: 120_000,
  },
})
