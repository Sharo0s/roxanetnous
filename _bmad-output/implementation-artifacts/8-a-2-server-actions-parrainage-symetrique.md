# Story 8.A.2 : Server actions parrainage symétrique (validateCode + createParrainageRelation + guards)

Status: done

<!-- Note: Validation is optional. Run validate-create-story for quality check before dev-story. -->

## Story

As a accompagnant filleul,
I want saisir au signup un code de parrainage émis par un accompagné OU par un accompagnant,
so that je bénéficie du bypass visio + validation auto identique au parrainage existant.

## Acceptance Criteria

1. **AC1 — `validateCode` branching role-aware (parrain accompagné)** : lorsque le lookup `parrainages_codes` retourne un `user_id` dont `users.role = 'accompagne'`, la fonction skip entièrement le join `accompagnants_profiles` (inexistant pour les accompagnés) et vérifie uniquement `subscriptions.status IN ('active', 'trialing')` (la valeur BDD est `'trialing'`, pas `'trialing'`). Le retour est `{ valid: true, marraineId, marraineFirstName }` si l'abonnement est actif, `{ valid: false, reason: 'marraine_subscription_inactive' }` sinon. La raison `'marraine_not_validated'` n'est jamais retournée pour un parrain accompagné.

2. **AC2 — `validateCode` path accompagnant inchangé** : lorsque `users.role = 'accompagnant'`, le comportement existant est conservé à l'identique — join `accompagnants_profiles!accompagnants_profiles_user_id_fkey(validation_status)`, vérification `validation_status = 'valide'`, puis vérification abonnement actif. Zéro régression sur le flux Epic 2.

3. **AC3 — `createParrainageRelation` garde `invalid_filleul_role`** : un guard est ajouté après le check `self_referral` (existant) — si `role(filleul) !== 'accompagnant'`, le retour est `{ ok: false, reason: 'invalid_filleul_role' }` et aucune row `parrainages` n'est insérée. Un event Sentry `level: 'warning', tags: { flow: 'parrainage', signal: 'invalid-filleul-role' }` est capturé avec `extra: { filleuleId, roleFilleul }`. Cette guard couvre les deux sens interdits : `accompagne → accompagne` ET `accompagnant → accompagne` (le filleul est accompagné dans les deux cas).

4. **AC4 — Sens `accompagne → accompagnant` golden path** : lorsque le parrain est accompagné (`role = 'accompagne'`, abonnement actif) et que le filleul est accompagnant (`role = 'accompagnant'`), `createParrainageRelation` réussit : une row `parrainages` est insérée avec `marraine_id = parrain.id`, `filleule_id = filleul.id`, `statut = 'inscrite'`. `users.parrainee_par` du filleul est mis à `parrain.id` (guard `IS NULL` existant préservé). La détection `detectBlacklist` s'exécute identiquement (rôle-indépendante).

5. **AC5 — `confirmParrainageOnSuccess` branching role-aware (parrain accompagné)** : `confirmParrainageOnSuccess` est modifié pour lire `users.role` du `parrain` (`parrainage.marraine_id`) avant de vérifier `accompagnants_profiles` :
   - Si `role = 'accompagne'` : skip le check `accompagnants_profiles.validation_status` (la table ne contient pas de row pour un accompagné) et vérifier à la place `subscriptions.status IN ('active', 'trialing')` du parrain. Si l'abonnement est inactif, retourner `{ ok: false, reason: 'marraine_no_longer_validated' }` (reason réutilisée pour compatibilité).
   - Si `role = 'accompagnant'` : conserver le path existant `accompagnants_profiles.validation_status = 'valide'` (zéro régression).
   - Le reste du flux (mise à jour `accompagnants_profiles` du filleul, génération code filleul, emails, log admin) est inchangé quel que soit le rôle du parrain.

6. **AC6 — Auto-parrainage interdit** : un parrain accompagné qui saisit son propre code déclenche le guard `self_referral` existant (`{ ok: false, reason: 'self_referral' }`) — aucune modification de cette logique.

7. **AC7 — Abonnement parrain accompagné inactif au signup** : si un parrain accompagné a un abonnement `'past_due'` ou `'cancelled'` au moment du `validateCode`, le retour est `{ valid: false, reason: 'marraine_subscription_inactive' }`. La copy existante dans le formulaire signup accompagnant affiche ce retour correctement (aucune modification UI requise dans 8.A.2).

8. **AC8 — Audit MCP `accompagnants_profiles` et `users.parrainee_par` avant implémentation** : avant d'écrire le code, l'agent dev effectue via MCP Supabase un audit ciblé sur (a) `accompagnants_profiles` (colonnes, CHECK, FK, valeurs enum `validation_status`, RLS) et (b) `users.parrainee_par` (type, CHECK, FK, NULL). Les résultats confirment l'absence de guard rôle bloquant sur ces colonnes (FLAG-B et FLAG-C de l'audit 8.A.0). Si un ALTER est requis, il est créé via `apply_migration` avant toute modification applicative.

9. **AC9 — Anti-fraude transposé, signature `detectBlacklist` inchangée** : la fonction interne `detectBlacklist` n'est pas modifiée (elle est rôle-indépendante : compare email/IP filleul à d'autres filleuls du même parrain, sans filtre sur le rôle du parrain). Audit grep confirme zéro modification de `detectBlacklist`.

10. **AC10 — Index optionnel `idx_users_role`** : si l'audit MCP confirme l'absence d'index sur `users.role` (attendu d'après audit 8.A.0), créer l'index via migration Supabase si 8.A.2 ajoute des requêtes batch filtrant par rôle. Dans le cas d'un simple lookup par `id` (PK), l'index est optionnel et peut être différé à 8.C.1. Documenter la décision dans la story.

11. **AC11 — Type `ValidationCodeResult` étendu si nécessaire** : si de nouvelles raisons d'échec sont ajoutées (`invalid_filleul_role` dans `createParrainageRelation` existait déjà comme string générique), vérifier la cohérence TypeScript des types d'union. La raison `'invalid_filleul_role'` est ajoutée au type `CreateParrainageRelationResult` si absente.

12. **AC12 — Zéro régression `accompagnant → accompagnant`** : le test unitaire existant (si présent) ou un test de non-régression vérifie que le path accompagnant complet (validateCode → validation_status → subscription → createParrainageRelation → confirmParrainageOnSuccess) est inchangé. `npm run test:unit` reste exit 0.

## Tasks / Subtasks

- [x] **T0 — Audit MCP pré-implémentation** (AC: #8)
  - [x] T0.1 — Via `mcp__supabase__execute_sql` : DDL + CHECK + FK + RLS de `accompagnants_profiles` (colonnes, valeurs enum `validation_status`, présence row pour `user_id` accompagné)
  - [x] T0.2 — Via `mcp__supabase__execute_sql` : DDL de `users.parrainee_par` (type, CHECK, FK, NULL, index)
  - [x] T0.3 — Documenter les résultats dans les Dev Notes et la section References (ou fichier `_bmad-output/implementation-artifacts/audit-bdd-accompagnants-profiles-2026-05-17.md`)
  - [x] T0.4 — Si ALTER requis, créer migration via `mcp__supabase__apply_migration` et référencer dans la story

- [x] **T1 — Modifier `validateCode` — branching role-aware** (AC: #1, #2, #7)
  - [x] T1.1 — Après le lookup `parrainages_codes.user_id` (ligne ~392), effectuer un SELECT `users.role, first_name` sur `row.user_id`
  - [x] T1.2 — Si `role === 'accompagne'` : skip le join `accompagnants_profiles`, aller directement au check subscription (`status IN ('active', 'trialing')`)
  - [x] T1.3 — Si `role === 'accompagnant'` (ou tout autre valeur) : conserver le path existant complet (join `accompagnants_profiles!accompagnants_profiles_user_id_fkey(validation_status)` + vérification `valide`)
  - [x] T1.4 — `maybeSingle()` sur le SELECT subscription du parrain accompagné (contrainte UNIQUE `subscriptions_user_id_key` garantit 0 ou 1 row)
  - [x] T1.5 — Filtrer sur `status === 'active' || status === 'trialing'` (valeurs BDD réelles — pas `'canceled'`, pas `'unpaid'` qui n'existent pas dans l'enum BDD `subscription_status`)
  - [x] T1.6 — Vérifier TypeScript : pas de régression sur `ValidationCodeResult` (les types de retour existants sont suffisants)

- [x] **T2 — Modifier `createParrainageRelation` — garde `invalid_filleul_role`** (AC: #3, #4, #6, #9)
  - [x] T2.1 — Après le check `self_referral` (ligne ~474), effectuer un SELECT `users.role` sur `params.filleuleId`
  - [x] T2.2 — Si `role !== 'accompagnant'` : capturer Sentry `level: 'warning', tags: { flow: 'parrainage', signal: 'invalid-filleul-role' }, extra: { filleuleId: params.filleuleId, roleFilleul: role }` et retourner `{ ok: false, reason: 'invalid_filleul_role' }`
  - [x] T2.3 — Ajouter `'invalid_filleul_role'` au type union `CreateParrainageRelationResult` si absent du type existant
  - [x] T2.4 — Vérifier que `detectBlacklist` n'est pas modifiée (grep de la signature)
  - [x] T2.5 — Vérifier que le path golden path `accompagne → accompagnant` insère correctement la row `parrainages` avec `marraine_id`, `filleule_id`, `statut = 'inscrite'`, `parrainee_par` mis à jour (guard `IS NULL` existant préservé)

- [x] **T3 — Modifier `confirmParrainageOnSuccess` — branching role-aware parrain** (AC: #5)
  - [x] T3.1 — Après la récupération de `parrainage` (ligne ~769), effectuer un SELECT `users.role` sur `parrainage.marraine_id`
  - [x] T3.2 — Si `role === 'accompagne'` : skip le block `accompagnants_profiles` du parrain et vérifier `subscriptions.status IN ('active', 'trialing')` du parrain (`.maybeSingle()`)
  - [x] T3.3 — Si `role === 'accompagnant'` : conserver le block existant `accompagnants_profiles.validation_status = 'valide'` (zéro modification)
  - [x] T3.4 — Le reste du flux (vérification `filleuleProfile`, update `accompagnants_profiles` filleul, génération code filleul via `generateCodeForUserSystem`, emails, log admin, `revalidatePath`) est inchangé quel que soit le rôle du parrain
  - [x] T3.5 — Si l'abonnement parrain accompagné est inactif : retourner `{ ok: false, reason: 'marraine_no_longer_validated' }` (réutilise la reason existante pour cohérence avec les callers amont)

- [x] **T4 — Migration index optionnel `idx_users_role`** (AC: #10)
  - [x] T4.1 — Vérifier si les requêtes ajoutées en T1/T2/T3 filtrent sur `users.role` en dehors d'un lookup par PK (`id`)
  - [x] T4.2 — Décision : toutes les requêtes ajoutées font un lookup par PK (`id`) avec SELECT `role` — pas de scan par rôle. Index `idx_users_role` **différé à 8.C.1** (volumétrie actuelle < 100 users, lookup PK toujours O(1)).
  - [x] T4.3 — Décision documentée dans la story (T4.2 ci-dessus) et dans `deferred-work.md`

- [x] **T5 — Tests unitaires** (AC: #1, #2, #3, #5, #12)
  - [x] T5.1 — Fichier créé `tests/unit/parrainage-symetrie.test.ts` (7 scénarios)
  - [x] T5.2 — Scénario 1 : `validateCode` — parrain `accompagne`, abonnement `active` → `{ valid: true }`
  - [x] T5.3 — Scénario 2 : `validateCode` — parrain `accompagne`, abonnement `cancelled` → `{ valid: false, reason: 'marraine_subscription_inactive' }`
  - [x] T5.4 — Scénario 3 : `validateCode` — parrain `accompagnant`, `validation_status = 'valide'`, abonnement `active` → `{ valid: true }` (non-régression)
  - [x] T5.5 — Scénario 4 : `createParrainageRelation` — filleul `accompagne` → `{ ok: false, reason: 'invalid_filleul_role' }` + Sentry capturé
  - [x] T5.6 — Scénario 5 : `createParrainageRelation` — filleul `accompagnant`, parrain `accompagne` → `{ ok: true }` (golden path symétrique)
  - [x] T5.7 — Scénario 6 : `confirmParrainageOnSuccess` — parrain `accompagne`, abonnement `active` → `{ ok: true }` sans lookup `accompagnants_profiles` parrain
  - [x] T5.8 — Scénario 7 : `confirmParrainageOnSuccess` — parrain `accompagne`, abonnement `cancelled` → `{ ok: false, reason: 'marraine_no_longer_validated' }`
  - [x] T5.9 — Mocks chainables Supabase (pattern story 8.A.1 : `from().select().eq().maybeSingle()`)
  - [x] T5.10 — `npm run test:unit` exit 0 — 78/78 tests verts

- [x] **T6 — Validation TypeScript et lint** (AC: #11, #12)
  - [x] T6.1 — `npx tsc --noEmit` : 2 erreurs pré-existantes `.next/types/` (doublons build Next.js), 0 erreur sur les fichiers modifiés
  - [x] T6.2 — `npm run lint` exit 0 (0 erreur, 194 warnings = baseline -1)
  - [x] T6.3 — `npm run check:no-direct-notifications-log-insert` exit 0

## Dev Notes

### Contexte métier

Cette story étend les trois server actions centrales du parrainage (`validateCode`, `createParrainageRelation`, `confirmParrainageOnSuccess` dans `app/actions/parrainage.ts`) pour accepter un parrain de rôle `accompagne` en plus du rôle `accompagnant` historique. C'est la **story pivot de l'Epic 8** : sans elle, un accompagné peut générer un code (8.A.1) mais ce code est rejeté dès le `validateCode` (la branche actuelle cherche un `accompagnants_profiles.validation_status = 'valide'` qui n'existe pas pour les accompagnés).

### Flags critiques hérités de l'audit BDD 8.A.0 (à traiter impérativement)

**FLAG-A** : `confirmParrainageOnSuccess:789` interroge `accompagnants_profiles` inconditionnellement et retourne `ok: false, reason: 'marraine_no_longer_validated'` si la row est absente. Un accompagné n'a JAMAIS de row dans `accompagnants_profiles`. **Sans le T3, tout parrain accompagné bloque à cette ligne.** C'est le bug bloquant principal de cette story.

**FLAG-B** : `accompagnants_profiles` n'a pas été auditée dans 8.A.0 (périmètre limité). Avant d'écrire le code, **effectuer T0.1** (audit MCP DDL + valeurs enum `validation_status` + FK + RLS). Confirmer l'absence de constraint qui forcerait la présence d'une row accompagnant.

**FLAG-C** : `users.parrainee_par` non audité dans 8.A.0. `createParrainageRelation:584` écrit sur cette colonne pour le filleul. **Effectuer T0.2** avant d'implémenter T2 pour s'assurer qu'aucune FK ou CHECK ne bloque l'écriture quand le parrain est accompagné.

**FLAG-D** : filtrer sur `subscriptions.status IN ('active', 'trialing')` pour le parrain accompagné (pas seulement `'active'`), cohérent avec `isSubActive` existant dans `validateCode` ligne 438.

### Invariants BDD confirmés (audit 8.A.0)

- Enum `user_role` : `'accompagnant'`, `'accompagne'`, `'admin'` (3 valeurs, pas de `'visiteur'`)
- Enum `subscription_status` : `'active'`, `'cancelled'` (**double L**), `'past_due'`, `'trialing'` (4 valeurs — pas `'canceled'`, pas `'unpaid'`)
- `subscriptions.user_id` UNIQUE → `.maybeSingle()` suffisant
- `parrainages_codes` : aucun CHECK ne discrimine le rôle du parrain
- `parrainages.marraine_id` : FK `ON DELETE SET NULL`, NULLable, aucun CHECK de rôle
- RLS `parrainages_codes` et `parrainages` : aucune policy ne filtre sur le rôle du parrain

### Localisation des fonctions à modifier

- `app/actions/parrainage.ts:326` — `validateCode`
- `app/actions/parrainage.ts:392` — lookup `parrainages_codes.user_id` (point d'insertion branche rôle)
- `app/actions/parrainage.ts:454` — `createParrainageRelation`
- `app/actions/parrainage.ts:474` — guard `self_referral` (point d'insertion garde `invalid_filleul_role`)
- `app/actions/parrainage.ts:733` — `confirmParrainageOnSuccess`
- `app/actions/parrainage.ts:789` — lookup `accompagnants_profiles` parrain (à rendre conditionnel sur le rôle)

### Fonctions NON à modifier (audit zéro diff attendu)

- `detectBlacklist` : rôle-indépendante, signature inchangée
- `app/actions/admin.ts` : path `validateAccompagnante` / `generateCodeForUserSystem` inchangé
- `lib/parrainage-codes.ts` : `generateCodeForUserSystem` inchangé (story 8.A.1 l'a déjà enrichi du helper accompagné)

### Pattern de test mock Supabase (référence story 8.A.1)

```typescript
// Pattern mock chainable utilisé dans tests/unit/parrainage-codes-genesis.test.ts
const mockFrom = vi.fn().mockReturnValue({
  select: vi.fn().mockReturnThis(),
  eq: vi.fn().mockReturnThis(),
  maybeSingle: vi.fn().mockResolvedValue({ data: { role: 'accompagne', ... }, error: null }),
})
vi.mock('@/lib/supabase/server', () => ({
  createClient: vi.fn().mockResolvedValue({ from: mockFrom }),
}))
```

### Points de vigilance TypeScript

- La raison `'invalid_filleul_role'` doit être ajoutée à l'union `{ ok: false; reason: string }` de `CreateParrainageRelationResult` si le type est étendu vers des raisons typées. Vérifier si `reason: string` est déjà générique (auquel cas aucune modification TypeScript nécessaire).
- Le type `ValidationCodeResult` n'est pas affecté par les changements de `validateCode` (les mêmes raisons d'échec sont retournées, juste sur un chemin différent selon le rôle).

### Ordonnancement interne des checks dans `validateCode` (après modification)

1. Normalisation/format/regex (inchangé)
2. Rate-limit RPC (inchangé)
3. Lookup `parrainages_codes.user_id` (inchangé)
4. **[NOUVEAU]** SELECT `users.role, first_name` sur `row.user_id`
5. **Si `role === 'accompagne'`** : check subscription uniquement → return `valid/invalid`
6. **Si `role === 'accompagnant'`** : join `accompagnants_profiles` + check subscription → return `valid/invalid` (inchangé)

### Ordonnancement interne des guards dans `createParrainageRelation` (après modification)

1. Normalisation code (inchangé)
2. `validateCode` inchangé
3. Guard `self_referral` (inchangé)
4. **[NOUVEAU]** SELECT `users.role` sur `params.filleuleId` → guard `invalid_filleul_role` si `!= 'accompagnant'`
5. Idempotence lookup `parrainages` existante (inchangé)
6. INSERT + detectBlacklist + parrainee_par (inchangé)

### Project Structure Notes

- Fichier principal : `app/actions/parrainage.ts` (un seul fichier modifié côté logique métier)
- Tests : `tests/unit/parrainage-symetrie.test.ts` (nouveau fichier, ou extension du fichier existant si un `parrainage.test.ts` existe déjà — vérifier avec `find tests/unit -name "*parrainage*"`)
- Pas de migration BDD si audit T0 confirme l'absence de contrainte bloquante (attendu d'après audit 8.A.0)
- `deferred-work.md` : ajouter une entrée si la décision sur `idx_users_role` est de différer à 8.C.1

### References

- [Source: epic-8.md#Story 8.A.2] — spec complète AC et contexte métier
- [Source: epic-8.md#FR50] — `validateCode` lookup `users.role` + comportements aval cohérents
- [Source: epic-8.md#FR51] — bypass visio parrain accompagné (réutilisation `confirmParrainageOnSuccess`)
- [Source: epic-8.md#FR54] — guard `invalid_filleul_role` serveur explicite dans `createParrainageRelation`
- [Source: epic-8.md#AR-E8.3] — `validateCode` : requête `accompagnants_profiles` conditionnelle
- [Source: epic-8.md#AR-E8.4] — `createParrainageRelation` : guard `role(filleul) === 'accompagnant'`
- [Source: epic-8.md#NFR-Sec-E8.1] — anti-fraude rôle-indépendant, `detectBlacklist` inchangé
- [Source: epic-8.md#NFR-Sec-E8.2] — `validateCode` retourne `marraine_subscription_inactive` si sub inactif parrain accompagné
- [Source: _bmad-output/implementation-artifacts/audit-bdd-parrainage-symetrique-2026-05-16.md#6-liens-story-suivantes] — FLAGS critiques A/B/C/D à traiter en 8.A.2
- [Source: app/actions/parrainage.ts:326-448] — `validateCode` code complet
- [Source: app/actions/parrainage.ts:454-727] — `createParrainageRelation` code complet
- [Source: app/actions/parrainage.ts:733-961] — `confirmParrainageOnSuccess` code complet
- [Source: app/actions/parrainage.ts:36-99] — `detectBlacklist` (inchangée, référence)
- [Source: lib/parrainage-codes.ts:80-140] — `triggerAccompagneCodeGenesisIfEligible` (pattern lookup `users.role`)
- [Source: DECISIONS.md#F-Epic8-A0] — audit BDD GO sans migration, invariants confirmés
- [Source: _bmad-output/implementation-artifacts/8-a-1-webhook-stripe-genese-code-parrainage-accompagne.md#Dev Notes] — patterns mock tests unitaires

## Dev Agent Record

### Agent Model Used

claude-sonnet-4-6 (2026-05-17)

### Debug Log References

- Audit MCP T0.1 2026-05-17 : `accompagnants_profiles` — 34 colonnes, enum `validation_status` 6 valeurs (`en_attente`, `visio_a_planifier`, `visio_realisee`, `valide`, `refuse`, `a_completer`). RLS INSERT exige `user_id = auth.uid()` → bypassé par service_role. Aucune FK/CHECK forçant la présence d'une row pour un `user_id` accompagné. **Aucune migration requise (FLAG-B levé).**
- Audit MCP T0.2 2026-05-17 : `users.parrainee_par` — UUID NULLABLE, FK `ON DELETE SET NULL` vers `users(id)`. Aucun CHECK, aucun index. Écriture depuis parrain accompagné libre. **Aucune migration requise (FLAG-C levé).**
- Audit MCP T4 2026-05-17 : aucun index sur `users.role`. Requêtes ajoutées = lookup par PK (`id`) uniquement → index différé à 8.C.1.
- `detectBlacklist` : grep confirme 0 modification de la signature (AC9 validé).
- `CreateParrainageRelationResult.reason` est `string` générique → aucune modification TypeScript du type nécessaire pour `'invalid_filleul_role'` (AC11 validé).

### Completion Notes List

- **T0** : Audit MCP 2026-05-17 confirme l'absence de contrainte bloquante sur `accompagnants_profiles` et `users.parrainee_par`. Aucun ALTER requis. FLAGS B/C/D de l'audit 8.A.0 levés.
- **T1** : `validateCode` modifié — branche role-aware insérée après le lookup `parrainages_codes.user_id`. Parrain `accompagne` → skip `accompagnants_profiles`, check sub uniquement. Parrain `accompagnant` → path historique inchangé (zero-diff sur les 71 tests préexistants).
- **T2** : `createParrainageRelation` — guard `invalid_filleul_role` ajouté après le check `self_referral`. Lookup `users.role` sur `params.filleuleId`, Sentry `level:'warning'` + `{ signal: 'invalid-filleul-role' }`. `detectBlacklist` non touchée (grep 0 diff).
- **T3** : `confirmParrainageOnSuccess` — FLAG-A résolu. Branching role-aware sur `parrainage.marraine_id` avant le bloc `accompagnants_profiles`. Parrain `accompagne` → check sub + retourne `marraine_no_longer_validated` si inactif. Parrain `accompagnant` → path historique inchangé.
- **T4** : Index `idx_users_role` différé à 8.C.1 (toutes les requêtes ajoutées sont des lookups par PK, pas de scan par rôle).
- **T5** : 7 scénarios unitaires créés dans `tests/unit/parrainage-symetrie.test.ts`. 78/78 tests verts.
- **T6** : lint 0 erreur (194 warnings = baseline -1), check:no-direct-notifications-log-insert OK, tsc 0 erreur sur les fichiers modifiés (2 erreurs `.next/types/` pré-existantes non liées).

### File List

- `app/actions/parrainage.ts` (modifié — T1 validateCode branching, T2 guard filleul, T3 confirmParrainage branching)
- `tests/unit/parrainage-symetrie.test.ts` (nouveau — 7 scénarios unitaires)
- `_bmad-output/implementation-artifacts/8-a-2-server-actions-parrainage-symetrique.md` (tasks cochées + Dev Agent Record)
- `_bmad-output/implementation-artifacts/sprint-status.yaml` (8-a-2 → review)
- `_bmad-output/implementation-artifacts/deferred-work.md` (entrée idx_users_role différé 8.C.1)

## Change Log

- 2026-05-17 : Story 8.A.2 implémentée — branching role-aware dans `validateCode`, `createParrainageRelation` (guard `invalid_filleul_role`), `confirmParrainageOnSuccess` (FLAG-A résolu). 7 tests unitaires ajoutés. 78/78 verts.
- 2026-05-17 : Code review BMad (Blind Hunter + Edge Case Hunter + Acceptance Auditor) — 6 patches appliqués (extraction `error` sur 5 nouvelles requêtes + retour `db_error`, fail-fast rôle inconnu côté `validateCode` ET `confirmParrainageOnSuccess`, Sentry warning `marraine-sub-inactive` et `marraine-ineligible-at-payment` avec `roleParrain`/`subStatus` discriminants, assertion `users.parrainee_par` ajoutée SC5). 1 décision résolue (naming `marraine_no_longer_validated` conservé conforme AC5, observabilité réglée via Sentry extra). 3 defer reportés dans `deferred-work.md`. 78/78 tests verts, lint OK, tsc OK sur fichiers modifiés.

### Review Findings

Revue de code 2026-05-17 (Blind Hunter + Edge Case Hunter + Acceptance Auditor). Synthèse : 1 décision requise, 6 patches, 3 dette différée, 17 noise/false-positives écartés.

- [x] [Review][Decision][Resolved] Naming `marraine_no_longer_validated` réutilisé pour parrain accompagné dont la sub est inactive [app/actions/parrainage.ts:855] — Décision 2026-05-17 : **conserver tel quel (conforme spec AC5)**. Le besoin d'observabilité est traité via l'enrichissement Sentry du patch #5 (`extra: { roleParrain, subStatus }`). Pas de rupture compat UI. Si copy UI dédiée nécessaire ultérieurement, traiter en 8.B.x avec la page `/accompagne/parrainage`.
- [x] [Review][Patch] Erreurs Supabase silencieusement avalées sur les 5 nouvelles requêtes [app/actions/parrainage.ts:405, 416, 514, 839, 847] — Fixé 2026-05-17 : les 5 requêtes extraient désormais `error`. Sur erreur → Sentry.captureException avec tag dédié + retour `db_error` (nouvelle reason ajoutée à `ValidationCodeResult`). Copy UI `register-form.tsx` étendue avec message "Une erreur technique nous empêche de valider ce code".
- [x] [Review][Patch] Rôle parrain inconnu/null tombe silencieusement sur path accompagnant [app/actions/parrainage.ts:411-413, 844-846] — Fixé 2026-05-17 : check explicite `parrainRole !== 'accompagnant'` dans `validateCode` → Sentry warning `marraine-unexpected-role` + retour `marraine_not_validated`. Idem dans `confirmParrainageOnSuccess` avec `marraine-unexpected-role-at-confirm`.
- [x] [Review][Patch] Race TOCTOU rôle parrain entre `validateCode` et `confirmParrainageOnSuccess` [app/actions/parrainage.ts:405 vs 839] — Fixé 2026-05-17 : la branche par défaut de `confirmParrainageOnSuccess` (rôle ≠ `accompagne` && ≠ `accompagnant`) capture Sentry warning `marraine-unexpected-role-at-confirm` avec `roleParrain` en extra. Pas d'embed parrainages (out of scope), mais l'observabilité est en place pour détecter les changements.
- [x] [Review][Patch] Asymétrie observabilité : pas de Sentry warning sur `marraine_subscription_inactive` [app/actions/parrainage.ts:424] — Fixé 2026-05-17 : capture `parrainage marraine sub inactive` warning avec tags `signal: 'marraine-sub-inactive'`, extra `{ marraineId, roleParrain, subStatus }`.
- [x] [Review][Patch] Pas de Sentry sur `marraine_no_longer_validated` post-paiement [app/actions/parrainage.ts:855, 865] — Fixé 2026-05-17 : capture `parrainage marraine ineligible at payment` warning sur les deux branches (accompagné et accompagnant), avec extra discriminant `roleParrain` + `subStatus` ou `validationStatus`. Réalise la décision finding `decision-needed` résolue.
- [x] [Review][Patch] Test SC5 ne vérifie pas l'UPDATE `users.parrainee_par` du filleul [tests/unit/parrainage-symetrie.test.ts:206-289] — Fixé 2026-05-17 : mock `update` instrumenté pour tracer les payloads, nouvelle assertion `expect(updatePayloads).toContainEqual({ table: 'users', parrainee_par: PARRAIN_ACCOMPAGNE_ID })` (forme `find` pour ne pas vérifier les autres champs).
- [x] [Review][Defer] `first_name` vide silencieusement renvoyé via `|| ''` [app/actions/parrainage.ts:429] — deferred, pre-existing (même comportement ligne 478 pour le path accompagnant historique). Non-régression, dette UX globale.
- [x] [Review][Defer] Cast `as { role?: string } | null` désactive le typage strict Supabase [app/actions/parrainage.ts:411, 519, 844] — deferred, pre-existing (pattern récurrent du fichier, à traiter par génération de types Supabase end-to-end hors story).
- [x] [Review][Defer] Mocks `fromMock` séquentiels non discriminants (table ignorée), `mockAfter` exécuté sync sans await, `mockNormalizeEmail` retourne vide [tests/unit/parrainage-symetrie.test.ts:131-160, 169, 218] — deferred, pre-existing (pattern hérité du test 8.A.1 et autres test files du repo). À traiter par une refonte du harness de mocks Supabase (helper partagé), pas patch ciblé 8.A.2.

## DoD a11y

N/A — story sans impact UI (server actions uniquement, pas de modification de composants React). L'interface utilisateur du formulaire signup accompagnant existant réutilise les mêmes codes d'erreur (`marraine_subscription_inactive`, `marraine_not_validated`) sans modification de rendu. L'audit a11y sera effectué dans 8.B.1 (nouvelle page `/accompagne/parrainage`).
