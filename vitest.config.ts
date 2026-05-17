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
    // Story 9.A.2 : coverage agrege unit + integration au niveau racine `test:`
    // afin que les hits des 2 projets soient cumules dans un seul rapport.
    // Seuil per-file applique uniquement a `app/actions/parrainage.ts`
    // (cible AC4 8.A.4 hardening, retro Epic 8 I2, defer ligne 60 solde).
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json-summary', 'html'],
      reportsDirectory: 'coverage',
      include: ['app/**/*.{ts,tsx}', 'lib/**/*.{ts,tsx}'],
      exclude: [
        '**/*.test.ts',
        '**/*.spec.ts',
        '**/types.ts',
        'app/**/layout.tsx',
        'app/**/page.tsx',
        'app/**/loading.tsx',
        'app/**/error.tsx',
        'app/**/not-found.tsx',
        '.next/**',
        'app/api/auth/**',
        'lib/database.types.ts',
      ],
      // Note: l'option `all` (Vitest <=2) n'existe plus en Vitest 4.x ; les
      // fichiers matchant `include` sont desormais instrumentes meme s'ils
      // ne sont pas importes par un test.
      // Story 9.A.2 - Option B evolutive (DECISIONS.md F-Epic9-A2) :
      // 1er run GHA = 49.48 lines / 41.92 branches / 64.28 functions / 48.14 statements.
      // Ecart vs cible 85% (>5 pts sur tous indicateurs) -> palier 1 = chiffres
      // courants arrondis au point inferieur (refus regression sous niveau actuel).
      // Story follow-up 9.A.2.b backlog : combler vers palier 2 (65%) en ciblant
      // detectBlacklist + confirmParrainageOnSuccess paths.
      // Story follow-up 9.A.2.c backlog : combler vers cible originale (85%).
      thresholds: {
        'app/actions/parrainage.ts': {
          lines: 49,
          branches: 41,
          functions: 64,
          statements: 48,
        },
      },
    },
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
