import { describe, it, expect } from 'vitest'

// Smoke test : verifie que le tooling Vitest est correctement configure.
// Doit passer en local apres `npm install` sans dependre de Supabase ni Stripe.
describe('vitest smoke', () => {
  it('execute une assertion triviale', () => {
    expect(1 + 1).toBe(2)
  })

  it('a acces aux variables d env de test injectees par setup.ts', () => {
    expect(process.env.STRIPE_WEBHOOK_SECRET).toBe(
      'whsec_test_secret_for_integration_tests',
    )
  })
})
