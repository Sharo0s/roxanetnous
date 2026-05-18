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
      // Palier 1 (PR #8) = 49.48 / 41.92 / 64.28 / 48.14.
      // Palier 2 (PR #13 9.A.2.b) = 67.47 / 59.61 / 92.85 / 65.65 (cumul GHA #26037648833).
      // Palier 3 effectif (PR #14 9.A.2.c) = 80.96 / 72.69 / 100.00 / 79.79
      // (cumul GHA #26041382960). 21 SC unit ajoutes (SC20-SC40) : createParrainageRelation
      // branches restantes + revokeFilleuleValidation* + generateCodeForUser.
      // functions atteint cible 85% (100%), lines/branches/statements plafonnent <85%.
      // Gap branches 12.31 pts -> Option B-bis evolutive : palier 3 effectif =
      // chiffres mesures arrondis au point inferieur (jamais regresser sous palier
      // 2 = 67/59/92/65). Solde Option B evolutive 9.A.2.c. Cadrage 9.A.2.d pour
      // combler branches non couvrables sans mock artificiel (error paths Sentry
      // capture + retry 23505 generateCodeForUser keyspace 31^8 hors-cible
      // structurel defer 8.A.1 F11).
      thresholds: {
        'app/actions/parrainage.ts': {
          lines: 80,
          branches: 72,
          functions: 100,
          statements: 79,
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
