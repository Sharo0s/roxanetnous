import { defineConfig } from 'vitest/config'

// Suite tests d'integration livree story 4.4 (DECISIONS.md F8).
// Plan stabilisation 7 jours : audit GitHub Actions logs flaky tests
// jusqu'au 2026-05-16. Si flaky > 5 %, ouverture story 4.4.b.
export default defineConfig({
  resolve: {
    tsconfigPaths: true,
  },
  test: {
    environment: 'node',
    include: ['tests/integration/**/*.test.ts'],
    setupFiles: ['tests/integration/setup.ts'],
    globals: false,
    testTimeout: 15_000,
    hookTimeout: 30_000,
    pool: 'forks',
    fileParallelism: false,
  },
})
