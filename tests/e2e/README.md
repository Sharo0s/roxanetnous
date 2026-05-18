# Tests E2E Playwright (suite 7.C)

Suite de tests **end-to-end** qui exercent l'application via un navigateur reel
(Chromium) contre une stack Supabase locale et un serveur `npm run dev` Next.js.

Suite livree par la story **7.C.1 (infra)**. Les scenarios applicatifs arrivent
avec 7.C.2 (anti-fraude parrainage), 7.C.3 (RGPD cascade), 7.C.4 (matching).

## Quand utiliser E2E vs Vitest integration vs a11y axe-core

Trois suites coexistent dans `tests/` -- chacune a un perimetre disjoint.

| Suite | Outil | Couvre | Ne couvre PAS |
|---|---|---|---|
| **E2E** (`tests/e2e/`) | Playwright + dev server + Supabase local | Parcours utilisateur complet via UI reelle (formulaire login, navigation entre pages, assertions visuelles, redirections role-aware). | Invariants metier server-side (preferes Vitest integration). |
| **Integration** (`tests/integration/`) | Vitest + Supabase local | Server actions, RLS, webhooks Stripe, cron jobs, idempotence, edge cases metier. Resend/Stripe/Sentry sont mockes. | Rendering UI, formulaires, navigation. |
| **a11y** (`tests/a11y/`) | Playwright + axe-core | Scan accessibilite WCAG des 6 parcours publics (sans auth, voir `lib/auth-stub.md`). | Logique applicative, parcours connectes profonds. |

Pas de chevauchement attendu : si un comportement merite a la fois un test
metier server-side ET une assertion visuelle UI, ecrire **deux** tests (un
Vitest integration + un E2E).

## Comment lancer en local

Pre-requis : Docker en marche + `supabase` CLI installe.

```bash
# Terminal 1 : Supabase local
supabase start
# Recuperer les cles emises (anon + service_role)
supabase status --output json | jq '{anon: .ANON_KEY, service: .SERVICE_ROLE_KEY}'

# Terminal 2 : variables d'env + seeds + dev server
export SUPABASE_URL=http://localhost:54321
export NEXT_PUBLIC_SUPABASE_URL=http://localhost:54321
export SUPABASE_SERVICE_ROLE_KEY=<service-role-key-recuperee>
export NEXT_PUBLIC_SUPABASE_ANON_KEY=<anon-key-recuperee>
# Plus les vars boot app : RESEND_API_KEY, ENCRYPTION_KEY, STRIPE_*, etc.
# (cf. .github/workflows/e2e-tests.yml pour la liste complete).
npm run seed:test
npm run dev

# Terminal 3 : Playwright E2E
npm run test:e2e
```

Le `webServer` Playwright detecte `reuseExistingServer: !process.env.CI` -- en
local, si le dev server tourne deja sur le port 3000, Playwright l'utilise sans
le redemarrer.

## Comment debugger

- **UI mode interactif** : `npm run test:e2e:ui` (timeline, selectors, retries).
- **Mode pas-a-pas** : `npm run test:e2e:debug` (Playwright Inspector).
- **Rapport HTML** : apres un run echoue, Playwright ecrit dans
  `playwright-e2e-report/`. Ouvrir `playwright-e2e-report/index.html`.
- **En CI GHA** : le workflow upload l'artifact `playwright-e2e-report` on failure
  (retention 7j). Telecharger via l'onglet Actions -> run -> Artifacts.

## Comment seed data

Les 5 users seed (`seed-admin@test.local`, `seed-accompagnant@test.local`,
`seed-accompagne@test.local`, `seed-marraine@test.local`,
`seed-filleule@test.local`, password commun `seed-password-1234`) sont crees par
`scripts/seed-test-supabase.mjs` avec des UUID fixes
`00000000-0000-0000-0000-00000000000{1-5}`. Idempotent : re-rejouable.

**Convention `e2e-test-` prefix** : toute fixture creee dynamiquement par un test
E2E (annonce, code parrainage, message) DOIT prefixer son champ texte
identifiant avec `e2e-test-`. Le helper `resetEphemeralRows()`
(`_lib/fixtures.ts`) ne nettoie QUE les rows avec ce prefix, jamais les seeds.

## Strategie auth

Decision **opposee a la suite a11y** : reutilisation des 5 seed users
existants via le vrai formulaire `/login` (cf. `_lib/session.ts:loginAs`).

- **Pourquoi pas un bypass `?test_user=` ou un cookie magique** : decision Lot B
  preservee. Le formulaire d'auth fait partie de la surface qu'on doit tester.
- **Pourquoi pas `createUser` au runtime test** : eviter la pollution + cleanup
  cross-tests fragile + race conditions sur la creation de profil par le trigger
  `handle_new_user`.
- **Pourquoi 5 seeds statiques (vs 1)** : couvrir les 3 roles applicatifs
  (`admin`, `accompagnant`, `accompagne`) + la paire marraine/filleule pour les
  scenarios parrainage de 7.C.2.

Reference : `tests/a11y/lib/auth-stub.md` documente le choix oppose pour la
suite a11y (audit `/login` proxy plutot que parcours connecte).

## Pourquoi 2 configs Playwright distinctes

`playwright.config.ts` (suite a11y, `testDir: tests/a11y`) et
`playwright-e2e.config.ts` (suite E2E, `testDir: tests/e2e`) coexistent a la
racine. Cinq differences :

| Aspect | a11y | E2E |
|---|---|---|
| `testDir` | `tests/a11y` | `tests/e2e` |
| `reporter` outputFolder | `playwright-report/` | `playwright-e2e-report/` |
| `retries` en CI | `0` (axe est deterministe) | `2` (Playwright + UI = flaky possible) |
| `globalSetup` | aucun | `tests/e2e/setup.ts` (garde-fou anti-prod) |
| Auth | aucun login (audit pages publiques) | `loginAs` via formulaire reel |

Les 2 configs ne se gachent jamais : `npm run a11y:axe` lit la config par
defaut (`playwright.config.ts`), `npm run test:e2e` precise
`--config=playwright-e2e.config.ts`.

## Comment ajouter une spec

```ts
// tests/e2e/mon-scenario.spec.ts
import { test, expect } from '@playwright/test'
import { loginAs } from './_lib/session'
import { resetEphemeralRows } from './_lib/fixtures'

test.afterAll(async () => {
  await resetEphemeralRows()
})

test('description metier explicite', async ({ page }) => {
  await loginAs(page, 'accompagnant')
  // ... actions + assertions
})
```

Puis : `npm run test:e2e -- tests/e2e/mon-scenario.spec.ts`.

## Hors-scope (cette infra 7.C.1)

Les contenus suivants sont reportes aux stories qui les portent :

- **Anti-fraude parrainage** -> `7.C.2` (`tests/e2e/parrainage-anti-fraude.spec.ts`).
- **RGPD cascade** -> `9.B.1` (`tests/e2e/rgpd-cascade.spec.ts`). Tag `@rgpd-cascade` (3 SC : SC1 suppression accompagnant, SC2 suppression accompagne, SC3 refus admin).
- **Matching email** -> `7.C.4` (`tests/e2e/matching.spec.ts`).
- **Page objects dashboard / messages / admin / parrainage** : ajoutes a la
  demande par 7.C.2/3/4 dans `_lib/pages.ts`.
- **Helper `createTestUser` runtime** : pas necessaire tant que les seeds
  suffisent. 7.C.2 (marraine/filleule dynamiques) decidera si besoin.
- **Strategie mock Resend pour E2E** : a decider par 7.C.4 quand un test devra
  asserter qu'un email est envoye.
