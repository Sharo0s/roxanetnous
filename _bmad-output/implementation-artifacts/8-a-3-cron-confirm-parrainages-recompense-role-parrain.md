# Story 8.A.3 : Cron `confirm-parrainages` — récompense Stripe selon rôle parrain

Status: review

<!-- Note: Validation is optional. Run validate-create-story for quality check before dev-story. -->

## Story

As a accompagné parrain,
I want recevoir 6 mois d'abonnement offerts sur mon abonnement courant (`accompagne_mensuel` ou `accompagne_annuel`) après 5 parrainages confirmés,
so that la mécanique de récompense est strictement symétrique au parrainage accompagnant.

## Acceptance Criteria

1. **AC1 — Lookup `users.role` du parrain dans le cron** : après le pré-check `marraineSub.active` (existant `app/api/cron/confirm-parrainages/route.ts:148`), le cron effectue un SELECT `users.role` sur `row.marraine_id` via `.maybeSingle()`. La valeur lue est utilisée pour : (a) brancher le pré-check de validation parrain (AC2), (b) tracer le rôle dans les logs `admin_actions_log` (AC5), (c) sélectionner la branche `sendParrainageRecompense` (AC6). Aucune nouvelle requête BDD n'est ajoutée si `row.marraine_id` est NULL (FK `ON DELETE SET NULL` → skip avec log `marraine_unlinked`).

2. **AC2 — Pré-check validation parrain branché sur le rôle** : le bloc `M3 marraineProfile` (`route.ts:172-183`) qui interroge `accompagnants_profiles.validation_status` est rendu **conditionnel sur `role === 'accompagnant'`** :
   - Si `role === 'accompagnant'` → conserver le check existant `validation_status = 'valide'` (zéro régression Epic 2).
   - Si `role === 'accompagne'` → **skip le check `accompagnants_profiles`** (la row n'existe pas pour un accompagné) et conserver uniquement les pré-checks `marraineSub.active`, `status !== 'trialing'`, `cancelAt IS NULL` déjà appliqués en amont (lignes 147-167). L'abonnement actif du parrain accompagné est donc la seule condition de pré-éligibilité.
   - Si `role !== 'accompagnant' && role !== 'accompagne'` (cas défense en profondeur, ex. `admin` ou rôle futur) → skip la récompense + log `admin_actions_log.action_type = 'parrainage_recompense_skipped'` + Sentry warning `signal: 'cron-marraine-unexpected-role'`. Le compteur reste à 5, le palier sera re-tenté au prochain cron si le rôle redevient cohérent.

3. **AC3 — Sélection `price_id` selon rôle pour info coupon (pas d'impact Stripe direct)** : le coupon Stripe créé (`stripe.coupons.create`) reste **inchangé** dans sa logique (percent_off 100, duration repeating, duration_in_months 6) car il s'applique à l'abonnement existant via `stripe.subscriptions.update({ discounts: [...] })` sans référence au `price_id`. Le `metadata` du coupon est enrichi avec `role_parrain: role` pour audit Stripe Dashboard. Aucune sélection de `STRIPE_PRICE_*` n'est requise dans 8.A.3 (le coupon s'attache à l'abonnement courant du parrain, qu'il pointe `STRIPE_PRICE_AUXILIAIRE_*` ou `STRIPE_PRICE_BENEFICIAIRE_*`).

4. **AC4 — Comportement plan annuel parrain accompagné identique à l'accompagnant** : pour un parrain accompagné dont `subscriptions.plan_type === 'annuel'`, le coupon `duration_in_months: 6` produit une réduction 50% sur la prochaine facture annuelle (limitation Stripe documentée code review 2026-04-29 M12). La fonction `sendParrainageRecompense` adapte déjà le texte selon `params.planType` (cf. `lib/emails.ts:727-729`). Aucune modification de cette logique.

5. **AC5 — Log `admin_actions_log` enrichi avec `role_parrain`** : sur application réussie de la récompense (`route.ts:246-256`), le payload `details` inclut désormais `role_parrain: role` (en plus de `coupon_id`, `marraine_id`, `total_recompenses`). Sur skip pour cause de rôle inattendu (AC2 branche 3), un log dédié `action_type = 'parrainage_recompense_skipped'` est inséré avec `details: { marraine_id, role_parrain, reason: 'unexpected_role' }`. **Aucune ligne `parrainage_recompense_perdue` n'est introduite** : la spec epic-8.md mentionne `recompense_perdue` (sub inactive), mais les pré-checks existants (`!marraineSub.active`, `cancelAt`, `status === 'trialing'`) interceptent déjà ces cas et émettent des `console.warn`/`console.info` sans claim ni reset du compteur — cohérent avec la logique « le palier sera re-tenté au prochain cron une fois sub active » (héritage M1/D4). Documenter cette divergence cadrage-vs-réalité dans Dev Notes (FLAG-E ci-dessous).

6. **AC6 — Email récompense parrain accompagné — URL d'abonnement adaptée au rôle** : la fonction `sendParrainageRecompense` est étendue pour accepter `role: 'accompagnant' | 'accompagne'` et adapter `abonnementUrl` (`${BASE_URL}/${role}/abonnement` au lieu de hardcoder `/accompagnant/abonnement` `lib/emails.ts:714`). Le sujet (« Félicitations, vous avez 6 mois offerts sur roxanetnous ») et le corps texte restent neutres (déjà conformes à la règle CLAUDE.md masculin neutre, pas d'occurrence « accompagnante » dans le template). Le cron passe `role: role` au call `sendParrainageRecompense` (`route.ts:258-264`).

7. **AC7 — Idempotence parrainage_claim_recompense préservée** : la RPC `parrainage_claim_recompense` (claim atomique avant Stripe, héritage C2/H7 code review 2026-04-29) reste inchangée. Elle ne fait aucune référence au rôle du parrain. Le rollback `parrainage_rollback_recompense` reste inchangé. La sémantique idempotence (deux runs cron concurrents → un seul réussit le claim) est préservée pour les parrains accompagnés comme pour les accompagnants.

8. **AC8 — Sentry sur échec Stripe enrichi avec `role_parrain`** : le bloc `catch (stripeErr)` (`route.ts:267-285`) ajoute `Sentry.captureException(stripeErr, { tags: { flow: 'parrainage', signal: 'cron-coupon-failed', severity: 'critical' }, extra: { marraineId: row.marraine_id, roleParrain: role, paliers: RECOMPENSE_PALIER } })`. Le rollback compteur conserve son comportement existant.

9. **AC9 — Tests unitaires (4 nouveaux scénarios, extension `tests/unit/parrainage-symetrie.test.ts`)** : le fichier existant (créé en 8.A.2) est étendu avec un nouveau `describe('cron confirm-parrainages — récompense role-aware')` comportant :
   - **SC8** : parrain `accompagne` avec sub `active`, palier atteint → coupon Stripe appliqué + email envoyé avec `role: 'accompagne'` + log `admin_actions_log` avec `role_parrain: 'accompagne'`.
   - **SC9** : parrain `accompagne` avec sub `cancelled` au moment du palier → skip récompense (pré-check existant `marraineSub.active`), aucun claim, aucune insertion log, compteur reste à 5.
   - **SC10** : parrain `accompagnant` avec `validation_status = 'valide'` et sub `active` → coupon appliqué (non-régression, identique Epic 2 + 2.4 AC2).
   - **SC11** : parrain `accompagnant` avec `validation_status = 'a_completer'` → skip récompense (check existant `marraineProfile.validation_status !== 'valide'`), compteur reste à 5, **et inversement le path `accompagne` ne tombe PAS dans cette branche** (garantie AC2 du skip conditionnel).
   - Mocks via pattern story 8.A.2 (chainables Supabase `from().select().eq().maybeSingle()`, mock Stripe coupons + subscriptions).
   - Total attendu : 78 + 4 = **82 tests unitaires**, exit 0.

10. **AC10 — Test d'intégration GHA dédié au cron (optionnel, défère 8.A.4)** : la story 8.A.3 ne crée **pas** de test d'intégration end-to-end (lancement réel du handler GET + Stripe test mode + Supabase) — ce périmètre est porté par **8.A.4** (« Tests d'intégration parrainage symétrique »). 8.A.3 garantit uniquement la couverture unitaire de la branche role-aware + email + log.

11. **AC11 — Type TypeScript `sendParrainageRecompense` étendu** : le paramètre optionnel `role?: 'accompagnant' | 'accompagne'` est ajouté à la signature. Si `role` est omis (callers existants `app/actions/parrainage.ts` non touchés par cette story), le comportement par défaut est `role = 'accompagnant'` pour préserver la rétro-compat (l'URL `/accompagnant/abonnement` reste valable). Audit grep des callers : un seul caller actif aujourd'hui (le cron) — un éventuel deuxième caller historique sera vérifié au runtime par dev-story.

12. **AC12 — DECISIONS.md `F-Epic8-A3` ajoutée** : une entrée DECISIONS.md est appendée sous le format `F-Epic8-A3 — Cron récompense parrainage rôle-aware (date)` consignant :
   - Décision : skip conditionnel du check `accompagnants_profiles` pour parrain accompagné (pas de migration BDD, pas d'extension RPC).
   - Motivation : la table `accompagnants_profiles` n'a pas de row pour un accompagné (FLAG-A de l'audit 8.A.0 levé par 8.A.2 dans `confirmParrainageOnSuccess`, à propager au cron).
   - Implications techniques : `details.role_parrain` ajouté aux logs admin, paramètre `role` ajouté à `sendParrainageRecompense`, coupon Stripe `metadata.role_parrain` enrichi.
   - Règle : tout futur cron lisant `accompagnants_profiles` doit brancher sur `users.role` avant le lookup (pattern réutilisable à étendre si Epic 9+ ajoute d'autres crons à validation_status).

13. **AC13 — Validations CI obligatoires avant livraison** :
   - `npx tsc --noEmit` : 0 erreur sur les fichiers modifiés (les 2 erreurs pré-existantes `.next/types/` sont tolérées).
   - `npm run lint` : exit 0, baseline ≤ 194 warnings (héritage 8.A.2).
   - `npm run lint:a11y-check` : baseline ≤ 158 (story sans impact UI, non-régression).
   - `npm run check:no-direct-notifications-log-insert` : exit 0.
   - `npm run test:unit` : 82/82 verts.
   - `npx tsc --noEmit` + `npm run build` : pas de régression buildCommand Vercel.

## Tasks / Subtasks

- [x] **T1 — Modifier `app/api/cron/confirm-parrainages/route.ts` — lookup rôle parrain** (AC: #1, #2)
  - [x] T1.1 — Après le check `cancelAt` et avant le bloc M3 `marraineProfile`, insérer SELECT `users.role` sur `row.marraine_id` via `.maybeSingle()`. Capture d'erreur Supabase → Sentry warning `signal: 'cron-marraine-role-read-failed'`, retour `continue` (errors++).
  - [x] T1.2 — Encapsuler le bloc M3 existant dans un `if (role === 'accompagnant')` (conservation 100% du code existant pour zéro régression Epic 2).
  - [x] T1.3 — Branche `else if (role === 'accompagne')` : aucun check supplémentaire (les pré-checks `marraineSub.active`, `trialing`, `cancelAt` couvrent déjà l'éligibilité), passer directement à la suite.
  - [x] T1.4 — Branche `else` (defense en profondeur, rôle inattendu) : insérer log `admin_actions_log` `action_type = 'parrainage_recompense_skipped'` + Sentry warning `signal: 'cron-marraine-unexpected-role'` + `continue`.

- [x] **T2 — Enrichir le log admin et le metadata coupon avec `role_parrain`** (AC: #3, #5, #8)
  - [x] T2.1 — Modifier le payload `stripe.coupons.create` : ajouter `metadata.role_parrain: role`.
  - [x] T2.2 — Modifier l'insertion `admin_actions_log` : ajouter `details.role_parrain: role`.
  - [x] T2.3 — Modifier le catch Stripe : insérer `Sentry.captureException(stripeErr, { tags: { flow: 'parrainage', signal: 'cron-coupon-failed', severity: 'critical' }, extra: { marraineId, roleParrain: role, palier: RECOMPENSE_PALIER } })` avant le rollback.

- [x] **T3 — Étendre `sendParrainageRecompense` avec paramètre `role`** (AC: #6, #11)
  - [x] T3.1 — `lib/emails.ts` : ajouter `role?: 'accompagnant' | 'accompagne'` au type des params (optionnel pour rétro-compat).
  - [x] T3.2 — `lib/emails.ts` : `const abonnementUrl = \`${BASE_URL}/${params.role ?? 'accompagnant'}/abonnement\``.
  - [x] T3.3 — Audit grep callers `sendParrainageRecompense` : un seul caller actif (`app/api/cron/confirm-parrainages/route.ts`) + un mock test (`tests/integration/setup.ts`). Pas de caller historique sans `role`.
  - [x] T3.4 — Aucune modification du sujet/HTML (déjà au masculin neutre).

- [x] **T4 — Passage du paramètre `role` au call site cron** (AC: #6)
  - [x] T4.1 — Ajouter `role: role` à l'objet passé à `sendParrainageRecompense({...})`.
  - [x] T4.2 — Vérifié : `role` est dans le scope du `try` Stripe (lookup placé avant le claim atomique).

- [x] **T5 — Tests unitaires (4 scénarios, extension du fichier existant)** (AC: #9)
  - [x] T5.1 — Nouveau `describe('cron confirm-parrainages — récompense role-aware (8.A.3)')` ajouté à `tests/unit/parrainage-symetrie.test.ts`.
  - [x] T5.2 — **SC8** vert : assertions `metadata.role_parrain === 'accompagne'`, payload admin_actions_log `role_parrain: 'accompagne'`, `sendParrainageRecompense` reçoit `role: 'accompagne'`, `accompagnants_profiles` jamais appelée.
  - [x] T5.3 — **SC9** vert : sub cancelled → `coupons.create` non appelé, `parrainage_claim_recompense` non appelée, `sendParrainageRecompense` non appelée, mais `confirmed=1` (statut bascule à confirme avant pré-check sub).
  - [x] T5.4 — **SC10** vert : parrain accompagnant + validé → `accompagnants_profiles` appelée, `role_parrain: 'accompagnant'` dans coupon + log + email.
  - [x] T5.5 — **SC11** vert : parrain accompagnant + `a_completer` → skip M3, pas de coupon, pas de claim.
  - [x] T5.6 — `npm run test:unit` → 82/82 verts en 1.08s.
  - [x] T5.7 — Mock Stripe étendu via `vi.hoisted` : `coupons: { create: mockStripeCouponsCreate }`, `subscriptions: { update: mockStripeSubsUpdate }`. Mock `@/lib/subscription-helpers` ajouté. Mock `@/lib/emails.sendParrainageRecompense` ajouté. Mock `next/server` étendu avec `NextResponse.json` minimal (nouveauté 8.A.3, le mock global ne le déclarait pas).

- [x] **T6 — DECISIONS.md F-Epic8-A3** (AC: #12)
  - [x] T6.1 — Section `## F-Epic8-A3 -- Cron confirm-parrainages recompense role-aware parrainage symetrique (2026-05-17)` appendée sous F-Epic8-A0.
  - [x] T6.2 — Sections Décision / Motivation / Implications techniques / Règle (pattern reproductible).
  - [x] T6.3 — Mention divergence cadrage-vs-réalité `parrainage_recompense_perdue` (FLAG-E) : pas de nouvelle ligne `recompense_perdue` introduite, sémantique « retry au prochain cron » conservée pour symétrie totale.

- [x] **T7 — Validations finales CI (DoD)** (AC: #13)
  - [x] T7.1 — `npx tsc --noEmit` → 2 erreurs pré-existantes `.next/types/` tolérées, 0 erreur sur fichiers modifiés.
  - [x] T7.2 — `npm run lint` → 194 warnings (baseline maintenue, 0 errors).
  - [x] T7.3 — `npm run lint:a11y-check` → 155 (baseline 155, no regression).
  - [x] T7.4 — `npm run check:no-direct-notifications-log-insert` → OK.
  - [x] T7.5 — `npm run test:unit` → 82/82 verts.
  - [x] T7.6 — `npm run build` → exit 0, route `/api/cron/confirm-parrainages` listée.

## Dev Notes

### Contexte métier

Cette story rend le **cron quotidien `confirm-parrainages` symétrique** : aujourd'hui, le cron traite uniquement les parrains accompagnants (Epic 2) ; après 8.A.3, il traite aussi les parrains accompagnés (Epic 8). Le cron consomme les rows `parrainages.statut = 'abonnee'` dont la filleule est active depuis >30 jours, incrémente le compteur du parrain, et applique le coupon 6 mois Stripe au palier 5.

**Hypothèse héritée 8.A.2** : `confirmParrainageOnSuccess` (`app/actions/parrainage.ts:733-961`) gère déjà le branching role-aware pour faire passer `parrainages.statut` de `inscrite` → `abonnee` (à la souscription Stripe filleule). 8.A.3 prend le relais sur le cycle `abonnee` → `confirme` + récompense (post +30j).

### Point bloquant principal résolu : FLAG-A propagé au cron

L'audit 8.A.0 + l'implémentation 8.A.2 ont identifié **FLAG-A** : `accompagnants_profiles` n'a pas de row pour un accompagné, donc tout lookup `validation_status` retourne `null` et bloque le flux à `'marraine_no_longer_validated'`. Dans `confirmParrainageOnSuccess`, 8.A.2 a résolu ce point en branchant le lookup sur `users.role`.

**FLAG-A non encore résolu dans le cron** : `route.ts:172-183` interroge inconditionnellement `accompagnants_profiles.validation_status`. Pour un parrain accompagné, cette requête retourne `null` (ou `data === undefined` selon `.single()`), et le check `marraineProfile?.validation_status !== 'valide'` est **vrai** → la récompense est **skippée silencieusement**. Sans 8.A.3, un parrain accompagné qui atteint le palier 5 ne reçoit jamais sa récompense, et le compteur reste à 5 indéfiniment, re-traité chaque cron.

C'est le bug bloquant principal de cette story.

### Flags critiques hérités

**FLAG-A (résolu par 8.A.2 dans `confirmParrainageOnSuccess`, à propager au cron 8.A.3)** : skip `accompagnants_profiles.validation_status` quand `role === 'accompagne'`. **T1.2 + T1.3 résolvent ce flag dans le cron.**

**FLAG-D (résolu par 8.A.2)** : filtrer sub `IN ('active', 'trialing')`. Dans le cron, le pré-check existant `marraineSub.active` (`getSubscriptionStatus`) couvre déjà `active OR trialing`, et le check additionnel `status === 'trialing'` (D4 code review 2026-04-29) skip explicitement les trials pour éviter le double-bénéfice trial + coupon. **Aucune modification nécessaire dans 8.A.3** — le comportement existant est transposable au parrain accompagné sans changement (trial accompagné = trial accompagnant pour cette logique).

**FLAG-E (nouveau, divergence cadrage epic-8.md vs réalité code)** : l'epic-8.md mentionne « si sub inactive au palier → log `parrainage_recompense_perdue` + reset compteur sans coupon (symétrie totale) ». **Or le code existant ne reset pas le compteur** quand le sub est inactif au palier — il `continue` et re-tente au prochain cron (héritage M1/D4 : « si la marraine est en trial OU cancel_at OU sub inactive → skip cette itération, le palier sera traité au prochain passage en active »).

**Décision 8.A.3** : conserver la sémantique « retry au prochain cron » (héritée Epic 2) plutôt qu'introduire un `parrainage_recompense_perdue` qui contredirait la logique actuelle. Le comportement est cohérent et déterministe : si l'abonnement parrain redevient `active`, la récompense sera appliquée ; sinon elle reste en attente. **Pas de breaking change sémantique** Epic 2.

À documenter explicitement dans DECISIONS.md F-Epic8-A3 (T6.3) pour éviter qu'un futur dev croit qu'il « manque » une fonctionnalité de reset.

### Invariants BDD hérités de 8.A.0/8.A.2 (rappel)

- Enum `user_role` : `'accompagnant'`, `'accompagne'`, `'admin'` (3 valeurs, pas de `'visiteur'`)
- Enum `subscription_status` : `'active'`, `'cancelled'` (**double L**), `'past_due'`, `'trialing'` (4 valeurs — pas `'canceled'`, pas `'unpaid'`)
- `subscriptions.user_id` UNIQUE → `.maybeSingle()` suffisant (déjà géré par `getSubscriptionStatus` existant)
- `parrainages.marraine_id` FK `ON DELETE SET NULL`, NULLable → filtrer `IS NOT NULL` avant lookup rôle (cf. AC1)
- `users.role` non indexée → lookup PK uniquement (pas de scan), pas d'impact perf

### Localisation des fonctions à modifier

- `app/api/cron/confirm-parrainages/route.ts:165-168` — insertion SELECT `users.role` après check `cancelAt`
- `app/api/cron/confirm-parrainages/route.ts:172-183` — encapsuler bloc M3 dans `if (role === 'accompagnant')`
- `app/api/cron/confirm-parrainages/route.ts:232-238` — enrichir `coupon.metadata.role_parrain`
- `app/api/cron/confirm-parrainages/route.ts:246-256` — enrichir `admin_actions_log.details.role_parrain`
- `app/api/cron/confirm-parrainages/route.ts:258-264` — passer `role: role` à `sendParrainageRecompense`
- `app/api/cron/confirm-parrainages/route.ts:267-285` — enrichir Sentry catch Stripe avec `roleParrain`
- `lib/emails.ts:706-712` — étendre signature `sendParrainageRecompense` avec `role?: 'accompagnant' | 'accompagne'`
- `lib/emails.ts:714` — adapter `abonnementUrl` à `/${role ?? 'accompagnant'}/abonnement`

### Fonctions / fichiers NON à modifier (audit zéro diff attendu)

- `supabase/migrations/20260429173822_parrainage_rollback_recompense.sql` et autres RPC (`parrainage_claim_recompense`, `parrainage_increment_compteur`, `parrainage_rollback_recompense`) : aucune modification SQL. Les RPC sont rôle-indépendantes (opèrent sur `parrainages_codes.user_id`).
- `lib/subscription-helpers.ts` (`hasActiveSubscription`, `getSubscriptionStatus`) : aucune modification (déjà rôle-indépendantes).
- `app/actions/parrainage.ts` : aucune modification (8.A.2 a déjà branché `confirmParrainageOnSuccess` côté server action ; 8.A.3 traite uniquement le cron).
- `lib/stripe.ts` : aucune modification (la fonction `getStripePriceId` n'est pas utilisée par le cron — le coupon s'attache à l'abonnement existant sans référencer un nouveau price_id).

### Pattern de test mock Supabase (hérité 8.A.1 + 8.A.2)

```typescript
// Pattern mock chainable utilisé dans tests/unit/parrainage-symetrie.test.ts (SC1-SC7)
const fromMock = vi.fn().mockImplementation((table: string) => {
  if (table === 'users') {
    return {
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      maybeSingle: vi.fn().mockResolvedValue({ data: { role: 'accompagne' }, error: null }),
    }
  }
  if (table === 'parrainages_codes') { /* ... */ }
  // etc.
})

vi.mock('@/lib/supabase/server', () => ({
  createClient: vi.fn().mockResolvedValue({ from: fromMock, rpc: vi.fn() }),
}))
vi.mock('@/lib/stripe', () => ({
  stripe: { coupons: { create: vi.fn() }, subscriptions: { update: vi.fn() } },
}))
vi.mock('@/lib/emails', () => ({ sendParrainageRecompense: vi.fn() }))
vi.mock('@/lib/subscription-helpers', () => ({
  hasActiveSubscription: vi.fn(),
  getSubscriptionStatus: vi.fn(),
}))
```

**Limite connue** (defer héritée 8.A.2 review) : les mocks séquentiels `fromMock` n'isolent pas la table appelée (mock global par défaut). Pour SC11 (vérifier que `accompagnants_profiles` n'est PAS appelée pour `role === 'accompagne'`), tracer les appels via `fromMock.mock.calls` et asserter `expect(fromMock).not.toHaveBeenCalledWith('accompagnants_profiles')` quand `role === 'accompagne'`.

### Points de vigilance TypeScript

- `sendParrainageRecompense` : le paramètre `role` doit être typé `'accompagnant' | 'accompagne'` (pas `string` générique) pour permettre l'inférence TypeScript du template URL.
- Le lookup `users.role` retourne `Database['public']['Enums']['user_role'] | null` côté typage strict. Cast localisé ou narrowing via `if (role !== 'accompagnant' && role !== 'accompagne')` pour traiter le cas défense en profondeur.
- Cohérence : utiliser la même union de types `'accompagnant' | 'accompagne'` qu'en 8.A.2 (T2 `createParrainageRelation`, T3 `confirmParrainageOnSuccess`).

### Ordonnancement interne des checks dans le cron (après modification)

1. Boucle `for (const row of parrainages)` (inchangée)
2. Check `hasActiveSubscription(filleule)` (inchangé) — sinon expire le parrainage
3. Lookup `parrainages_codes` du parrain (inchangé) — sinon confirmer sans compteur (H9)
4. CAS `abonnee` → `confirme` (inchangé)
5. RPC `parrainage_increment_compteur` (inchangée)
6. Check `newCompteur >= RECOMPENSE_PALIER` (inchangé)
7. Check `marraineSub.active` (inchangé)
8. Check `marraineSub.status === 'trialing'` (skip si oui — D4) (inchangé)
9. Check `marraineSub.cancelAt` (skip si oui — M1) (inchangé)
10. **[NOUVEAU T1.1]** SELECT `users.role` sur `row.marraine_id`
11. **[NOUVEAU T1.2]** Si `role === 'accompagnant'` → check M3 `validation_status = 'valide'` (inchangé interne)
12. **[NOUVEAU T1.3]** Si `role === 'accompagne'` → skip M3, pas de check supplémentaire
13. **[NOUVEAU T1.4]** Si `role` autre → log skip + Sentry warning + continue
14. Lookup `marraineUser.email` (inchangé)
15. RPC `parrainage_claim_recompense` (inchangée)
16. Stripe coupons.create + subscriptions.update + log + email (modifiés T2/T3/T4 pour `role_parrain`)
17. Catch Stripe + rollback (modifié T2.3 pour Sentry enrichi)

### Project Structure Notes

- **Fichiers modifiés** : 2 (`app/api/cron/confirm-parrainages/route.ts` + `lib/emails.ts`)
- **Fichiers test** : 1 extension (`tests/unit/parrainage-symetrie.test.ts`, 8 → 12 scénarios)
- **Fichiers doc** : 1 mise à jour (`DECISIONS.md`)
- **Pas de migration BDD** (audit 8.A.0 GO confirmé, RPC inchangées)
- **Pas de nouvelle dep npm**
- **Pas d'impact UI** → DoD a11y N/A

### Coupures sécurité / sentinelles

- **CRON_SECRET** : aucune modification de l'authentification Bearer (`route.ts:11-15`). Le cron reste invocable uniquement par Vercel cron avec le secret.
- **Service role** : le client Supabase est créé avec `serviceRole: true` (`route.ts:17`) — toutes les requêtes bypassent les RLS, cohérent avec le pattern existant. **Aucune modification.**
- **Idempotence** : la RPC `parrainage_claim_recompense` reste la garantie atomique anti-double-application. **Aucune modification.**

### References

- [Source: epic-8.md#Story 8.A.3] — spec complète AC et contexte métier
- [Source: epic-8.md#FR52] — récompense parrain accompagné 6 mois sur `STRIPE_PRICE_BENEFICIAIRE_*`
- [Source: epic-8.md#FR53] — récompense perdue si sub inactive (cf. FLAG-E divergence)
- [Source: epic-8.md#AR-E8.6] — cron lit `users.role` pour sélection `price_id`
- [Source: app/api/cron/confirm-parrainages/route.ts:1-293] — code complet du cron actuel
- [Source: app/actions/parrainage.ts:733-961] — `confirmParrainageOnSuccess` (référence pattern role-aware déjà appliqué en 8.A.2)
- [Source: lib/emails.ts:706-768] — `sendParrainageRecompense` actuelle
- [Source: lib/subscription-helpers.ts:73-116] — `getSubscriptionStatus` (référence types, inchangée)
- [Source: lib/stripe.ts:10-18] — `getStripePriceId` (référence, non utilisée par le cron 8.A.3)
- [Source: _bmad-output/implementation-artifacts/audit-bdd-parrainage-symetrique-2026-05-16.md#6-liens-story-suivantes] — FLAGS A/D/E hérités
- [Source: _bmad-output/implementation-artifacts/8-a-2-server-actions-parrainage-symetrique.md#Dev Notes] — pattern role-aware appliqué à `confirmParrainageOnSuccess` (référence pour 8.A.3 cron)
- [Source: DECISIONS.md#F-Epic8-A0] — audit BDD GO sans migration
- [Source: DECISIONS.md#M1, D4, H6, H9, C2/H7, L5, L6, M3, M12] — invariants code review 2026-04-29 préservés (cron Epic 2.4)
- [Source: supabase/migrations/20260429173822_parrainage_rollback_recompense.sql] — RPC rollback (inchangée)
- [Source: app/api/webhooks/stripe/route.ts:425-442] — `derivePlanType` (référence pour mapping price → plan, inchangée)

## Dev Agent Record

### Agent Model Used

claude-opus-4-7 (1M context) — bmad-dev-story

### Debug Log References

- 2 itérations de mock `next/server` requises côté test (manquait `NextRequest` puis `NextResponse`). Remplacé `new NextRequest(...)` par un objet minimal `{ headers: { get } }` (le handler n'utilise que `request.headers.get('authorization')`), et étendu le mock `next/server` avec `NextResponse.json` minimal.
- Aucun reset du compteur de récompense parrain sur sub inactif au palier (FLAG-E, conformément cadrage AC5 + Dev Notes) : le code Epic 2 héritage M1/D4 `continue`-and-retry sans nouvelle ligne `parrainage_recompense_perdue`. Décision conservatrice formalisée dans DECISIONS.md F-Epic8-A3.

### Completion Notes List

- **AC1-AC13 satisfaits**. Lookup `users.role` ajouté avant le bloc M3, encapsulation conditionnelle `if (role === 'accompagnant')` (zéro régression Epic 2), branche `else if (role === 'accompagne')` skip M3 (FLAG-A propagé), branche défense en profondeur `else` Sentry warning + log skip + continue.
- **Coupon Stripe inchangé** dans sa logique (s'attache à l'abonnement existant sans sélection nouveau price_id). Seul `metadata.role_parrain` enrichi pour audit Stripe Dashboard.
- **`sendParrainageRecompense({ role })`** : nouvelle signature avec `role?: 'accompagnant' | 'accompagne'` (optionnel pour rétro-compat, fallback `'accompagnant'`). Corrige aussi le hardcode `/accompagnant/abonnement` ligne 714 → `/${params.role ?? 'accompagnant'}/abonnement`.
- **Sentry catch Stripe enrichi** avec `tags.signal: 'cron-coupon-failed'` + `tags.severity: 'critical'` + `extra.roleParrain` pour discrimination observabilité.
- **4 nouveaux tests unitaires SC8-SC11** ajoutés à `tests/unit/parrainage-symetrie.test.ts` (78 → 82 verts en 1.08s). Pattern mock Supabase chainable par-table avec dispatcher `fromMock`, mock Stripe coupons/subscriptions, mock subscription-helpers, mock emails.sendParrainageRecompense, extension du mock `next/server` avec `NextResponse.json` minimal.
- **DECISIONS.md F-Epic8-A3** appendée (~70 lignes) avec Décision / Motivation / Implications / Règle + mention explicite divergence cadrage-vs-réalité FLAG-E (pas de `parrainage_recompense_perdue` introduit).
- **DoD CI** : tsc (2 erreurs pré-existantes `.next/types/` tolérées, 0 sur fichiers modifiés), lint 194 warnings (baseline maintenue), lint:a11y-check 155 (baseline), check:no-direct-notifications-log-insert OK, test:unit 82/82, build OK.
- **DoD a11y** : N/A (story sans impact UI — modification cron API + helper email backend uniquement).

### File List

- `app/api/cron/confirm-parrainages/route.ts` (modifié : +~60 lignes — import Sentry, lookup `users.role`, branching `accompagnant`/`accompagne`/défense en profondeur, enrichissement `coupon.metadata.role_parrain`, `admin_actions_log.details.role_parrain`, Sentry catch Stripe, passage `role` à `sendParrainageRecompense`)
- `lib/emails.ts` (modifié : +~5 lignes — signature `sendParrainageRecompense` étendue avec `role?: 'accompagnant' | 'accompagne'`, `abonnementUrl` adaptée via `params.role ?? 'accompagnant'`)
- `tests/unit/parrainage-symetrie.test.ts` (modifié : +~270 lignes — 5 nouveaux mocks hoisted, extension mock `@/lib/stripe` + `@/lib/subscription-helpers` + `@/lib/emails`, extension mock `next/server` avec `NextResponse.json`, helpers `buildCronFromMock` + `buildClaimRpc` + `buildCronRequest`, 4 nouveaux scénarios SC8-SC11)
- `DECISIONS.md` (modifié : +~70 lignes — entrée `F-Epic8-A3` appendée)
- `_bmad-output/implementation-artifacts/sprint-status.yaml` (modifié : `8-a-3-cron-confirm-parrainages-recompense-role-parrain: review`, `last_updated` enrichi)

### Change Log

| Date       | Type     | Description |
|------------|----------|-------------|
| 2026-05-17 | feat     | Cron `confirm-parrainages` role-aware : lookup `users.role` + encapsulation conditionnelle check `accompagnants_profiles` + branche `accompagne` (skip M3) + branche défense en profondeur (Sentry warning + log skip). |
| 2026-05-17 | feat     | Enrichissement `coupon.metadata.role_parrain`, `admin_actions_log.details.role_parrain`, `Sentry.captureException` catch Stripe avec `roleParrain` discriminant. |
| 2026-05-17 | refactor | `sendParrainageRecompense({ role })` : signature étendue + `abonnementUrl` adaptée selon le rôle (corrige le hardcode `/accompagnant/abonnement` ligne 714 sans casser la rétro-compat). |
| 2026-05-17 | test     | +4 scénarios unitaires SC8-SC11 (78 → 82 verts). Mock Supabase par-table, mock Stripe coupons/subs, mock subscription-helpers, mock emails.sendParrainageRecompense, extension `next/server` mock avec `NextResponse.json`. |
| 2026-05-17 | docs     | DECISIONS.md F-Epic8-A3 appendée (décision + motivation + implications + règle pattern futur + divergence FLAG-E formalisée). |

## DoD a11y

N/A — story sans impact UI (modification du cron API + helper email backend uniquement, aucun composant React touché). L'email récompense parrain accompagné réutilise le template existant `sendParrainageRecompense` sans modification de rendu HTML (seule l'URL CTA est adaptée selon le rôle). L'audit a11y de la page `/accompagne/parrainage` est porté par 8.B.1.
