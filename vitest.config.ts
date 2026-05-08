import { defineConfig } from 'vitest/config'

// Suite tests d'integration livree story 4.4 (DECISIONS.md F8).
// Plan stabilisation 7 jours : audit GitHub Actions logs flaky tests
// jusqu'au 2026-05-16. Si flaky > 5 %, ouverture story 4.4.b.
//
// Story 4.5 (DECISIONS.md F10) : ajout d'un projet `unit` distinct pour les
// tests unitaires purs (pas de Supabase, pas de mocks Sentry/Resend/Stripe).
// Les deux projets tournent ensemble via `npm test` et restent isolables via
// `npm run test:unit` ou `npm run test:integration`.
export default defineConfig({
  resolve: {
    tsconfigPaths: true,
  },
  test: {
    projects: [
      {
        resolve: { tsconfigPaths: true },
        test: {
          name: 'integration',
          environment: 'node',
          include: ['tests/integration/**/*.test.ts'],
          setupFiles: ['tests/integration/setup.ts'],
          globals: false,
          testTimeout: 15_000,
          hookTimeout: 30_000,
          pool: 'forks',
          fileParallelism: false,
        },
      },
      {
        resolve: { tsconfigPaths: true },
        test: {
          name: 'unit',
          environment: 'node',
          include: ['tests/unit/**/*.test.ts'],
          globals: false,
        },
      },
    ],
  },
})
