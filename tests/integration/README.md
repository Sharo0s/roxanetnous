# Tests d'integration backend

Suite Vitest dediee aux invariants metier critiques (signature webhook Stripe + paywall server actions). Livree story 4.4 (DECISIONS.md F8).

## Prerequis

- **Node 24+** (la stack tourne sous Node 25 en local).
- **Supabase CLI** : `brew install supabase/tap/supabase` ou `npx supabase`.
- **Docker Desktop** lance (Supabase utilise Postgres + GoTrue + PostgREST en containers).
- **`supabase start`** doit avoir reussi (ports 54321/54322/54323 libres).

## Commandes

```bash
npm run test:integration              # Run unique, exit code 0/1 (CI mode)
npm run test:integration:watch        # Mode watch pour developpement
npm run test:integration:coverage     # Couverture v8 dans coverage/
```

Pour cibler un fichier ou un dossier :

```bash
npm run test:integration -- tests/integration/stripe-webhook/
npx vitest run tests/integration/stripe-webhook/invalid-signature.test.ts
```

## Variables d'environnement requises

| Variable | Valeur attendue (local) | Notes |
| --- | --- | --- |
| `SUPABASE_URL` | `http://localhost:54321` | Garde-fou anti-prod : refus si non local. |
| `NEXT_PUBLIC_SUPABASE_URL` | `http://localhost:54321` | Lu par `getSupabaseAdmin` du webhook. |
| `SUPABASE_SERVICE_ROLE_KEY` | Valeur retournee par `supabase status` | Service role pour bypasser RLS. |
| `STRIPE_WEBHOOK_SECRET` | `whsec_test_secret_for_integration_tests` | Auto-injecte par `setup.ts` si absent. |
| `STRIPE_SECRET_KEY` | `sk_test_dummy_for_integration_tests` | Auto-injecte par `setup.ts` si absent. |

## Structure

```
tests/integration/
  setup.ts                         # Mocks globaux (Sentry, Resend, email-queue, lib/stripe, next/headers)
  _smoke.test.ts                   # Test trivial pour valider le tooling
  _lib/
    supabase-admin.ts              # Singleton client Supabase admin
    fixtures.ts                    # Helpers fixtures BDD + cleanupAllFixtures
    stripe-webhook-helper.ts       # createStripeEvent, signStripeEvent, postWebhookEvent
  stripe-webhook/                  # 5 tests Stripe (epic-4.md AC2)
    invalid-signature.test.ts      # T5 : signature falsifiee -> 400
    ...                            # T1, T2, T3, T4 (phase 2)
  paywall/                         # 5 tests paywall server actions (epic-4.md AC3)
    ...                            # T6-T10 (phase 2)
```

## Mocking

`tests/integration/setup.ts` configure les mocks globaux :

- **`@sentry/nextjs`** : `init`, `captureException`, `captureMessage` no-op (D3).
- **`resend`** : classe factice `FakeResend` avec `emails.send` mocke -> aucun appel reseau.
- **`@/lib/email-queue`** : `enqueueEmail` retourne `{ runId: 'test-run-id' }`. Permet `vi.mocked(enqueueEmail).mock.calls.length`.
- **`@/lib/stripe`** : `stripe.subscriptions.retrieve`, `stripe.paymentMethods.retrieve` etc. mockes (D7). Tests surchargent via `vi.mocked(stripe.subscriptions.retrieve).mockResolvedValue(...)`.
- **`next/headers`** : `cookies()` retourne un store factice. Tests paywall surchargent pour fournir une session valide.

### Ajouter un nouveau mock

Ouvrir `setup.ts`, ajouter au top-level :

```ts
vi.mock('@/lib/mon-module', () => ({
  maFonction: vi.fn().mockResolvedValue({ ok: true }),
}))
```

Reset des compteurs entre tests via `beforeEach(() => vi.clearAllMocks())` deja en place.

## Patterns

### Tester un endpoint Stripe webhook

```ts
import { createStripeEvent, postWebhookEvent } from '@/tests/integration/_lib/stripe-webhook-helper'

const event = createStripeEvent('checkout.session.completed', {
  id: 'cs_test_xxx',
  object: 'checkout.session',
  // ... payload Stripe.Checkout.Session
})
const { status, body } = await postWebhookEvent(event)
expect(status).toBe(200)
```

### Tester une server action paywall

```ts
import { getOrCreateConversation } from '@/app/actions/messages'
import { createTestUser, createTestSubscription } from '@/tests/integration/_lib/fixtures'

const user = await createTestUser('accompagne')
await createTestSubscription(user.id, { status: 'active' })
// ... mock cookies pour fournir une session pour user.id
const result = await getOrCreateConversation('aux-profile-id')
expect(result.conversationId).toBeTruthy()
```

## Troubleshooting

### `port 54321 already in use`
`supabase stop && supabase start`

### Tests timeout
Augmenter `testTimeout` dans `vitest.config.ts` (default 15 s).

### Rows orphelines en BDD apres crash test
`cleanupAllFixtures()` doit etre appele en `afterAll`. Pour reparer : `mcp__supabase__execute_sql 'DELETE FROM users WHERE email LIKE \'test-%@test.local\''`.

### `[tests/integration] Refus d'executer : SUPABASE_URL=... n'est pas local`
Garde-fou D4. Verifier `echo $SUPABASE_URL` -> doit pointer `localhost:54321` ou `127.0.0.1:54321`.

## Extension future

- **Nouvelle story metier qui ajoute une server action sensible** (paywall, signature, idempotence) : ajouter au moins 1 test d'integration dans `tests/integration/<flow>/`. Pattern documente dans DECISIONS.md F8.
- **Ne pas mocker Stripe outbound dans le test** : utiliser le mock global `@/lib/stripe` (override per-test si besoin).
- **Eviter `INSERT/UPDATE/DELETE` direct dans une table BDD prod** : pattern interdit. Tous les tests doivent passer par `getAdminClient()` (Supabase local uniquement).
