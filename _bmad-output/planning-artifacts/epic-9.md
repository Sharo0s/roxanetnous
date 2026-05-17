---
project_name: roxanetnous
epic: 9
title: Hardening Epic 8 + couverture E2E manquante + seed staging
status: ready-for-dev
generated: 2026-05-17
inputDocuments:
  - _bmad-output/implementation-artifacts/epic-8-retro-2026-05-17.md
  - _bmad-output/implementation-artifacts/deferred-work.md
  - _bmad-output/planning-artifacts/epic-7.md (stories 7.C.3 + 7.C.4 réactivées)
  - DECISIONS.md (F-Epic8-A0/A3, F-Epic7-A*)
stepsCompleted:
  - cadrage-initial-2026-05-17
---

# Epic 9 : Hardening Epic 8 + couverture E2E manquante + seed staging

## Vue d'ensemble

Epic technique post-Epic 8, dédié à **solder la dette tracée** par la rétrospective Epic 8 (~30 defers `deferred-work.md` + 11 AI items rétro + 2 stories 7.C backlog) avant d'ouvrir un nouvel epic produit. Aucune nouvelle feature utilisateur ; uniquement hardening, tests, observabilité, cleanup nommage et déblocage des validations manuelles UI accumulées.

**Origine** : AI-Epic9-A1 (rétro Epic 8), AI-Epic9-A2 (réactivation 7.C.3 + 7.C.4), AI-Epic9-A3 (seed staging).

**Cadrage** : 2026-05-17 via `bmad-create-epics-and-stories` (variante hardening sans extraction PRD, calquée sur le format epic-8.md). Pas de checkpoint review obligatoire avant exécution : scope arbitré, stories indépendantes, méthodologie BMad stabilisée Epic 5/6/7/8.

**Périmètre exclu** :
- Renommages BDD résiduels `marraine_id`/`filleule_id` (dette assumée Epic 5/6 — pas avant un epic renommage global dédié).
- Nouveaux audits BDD (les enums `user_role` / `subscription_status` sont stables, audits F5/F6 reportés au prochain audit sécurité global).
- Cron drift 30.44j/mois (E7-I3) — défer maintenu, dette acceptable à 18 mois.

## Requirements Inventory

### Exigences Fonctionnelles (techniques)

- **FR-Epic9-1** : Toute story unit de l'app touchant un appel `from('table_name')` doit pouvoir spécifier le nom de table attendu dans son mock (au lieu d'un dispatcher séquentiel positionnel).
- **FR-Epic9-2** : La couverture de `app/actions/parrainage.ts` doit être mesurable en CI (workflow GHA `integration-tests` étendu `--coverage` + publication artefact `coverage-summary.json`) et atteindre ≥ 85% (cible AC4 8.A.4).
- **FR-Epic9-3** : Les utilisateurs accompagnés (parrains Epic 8) doivent voir une progression de cycle de parrainage correcte au-delà du 1er cycle (`compteur % 5` au numérateur, barre pleine momentanée au palier).
- **FR-Epic9-4** : Le formulaire d'inscription (`/register`) doit empêcher l'avancement de step tant que `validateCode` est en cours (`status === 'checking'`).
- **FR-Epic9-5** : Sylvain doit disposer d'un mécanisme documenté pour seed un utilisateur accompagné « complet » (abonné actif + code parrainage généré) en staging, afin de solder les 6 validations manuelles UI Epic 8.
- **FR-Epic9-6** : Les scénarios E2E RGPD cascade (7.C.3) et matching (7.C.4) doivent être couverts par Playwright.

### NonFunctional Requirements

- **NFR-Epic9-1** : Aucun garde-fou CI existant (5 checks Epic 7) ne doit régresser. Tous les nouveaux scripts CI ajoutés doivent rester sous le timeout build Vercel (~10 min).
- **NFR-Epic9-2** : Aucune migration BDD prod ne doit être appliquée sans audit MCP préalable (pattern AI-5.M.2 / AI-6.M.1-3 / F-Epic8-A0 institutionnalisé).
- **NFR-Epic9-3** : Toute suppression de code deprecated (alias, types, fonctions) doit être précédée d'un `grep -r` exhaustif sur `app/ components/ lib/ tests/` confirmant zéro caller hors définition.
- **NFR-Epic9-4** : Les 4 baselines a11y (`lint:a11y-check` 155 + `axe-core` 8 parcours dont P7) doivent rester 0 violations Critical/Serious.
- **NFR-Epic9-5** : Idempotence des stories d'observabilité : un audit Sentry 7j post-deploy doit pouvoir être relancé sans effet de bord (lecture seule).

### Additional Requirements (Architecture)

- **AR-Epic9-1** : Le helper `tests/unit/_lib/supabase-mock.ts` (story 9.A.1) doit suivre le pattern existant des helpers `tests/integration/setup.ts` (vi.importActual + override sélectif).
- **AR-Epic9-2** : Le RPC `parrainage_decrement_compteur` (story 9.A.5) doit suivre le pattern transactionnel de `parrainage_claim_recompense` (existant Epic 2, atomique single-statement, `SECURITY DEFINER` avec check `auth.uid()` = admin via fonction `is_admin()`).
- **AR-Epic9-3** : Le seed staging (story 9.C.1) doit être un script Node.js exécutable manuellement (`npm run seed:staging:accompagne-abo-code`), pas une migration BDD ni un cron. Cible : instance Supabase staging (pas prod).

## Epic List

### Mini-épic 9.A — Hardening Epic 8 (6 stories, parallélisables sauf 9.A.4 après 9.A.3)

Solde les dettes tests + nommage + atomicité issues de la rétro Epic 8.

- 9.A.1 Refonte mocks Supabase `fromMock` discriminants par table
- 9.A.2 Coverage `app/actions/parrainage.ts` ≥ 85% (workflow GHA + artefact)
- 9.A.3 Supprimer alias deprecated `sendParrainageBienvenueMarraine`
- 9.A.4 Rename `sendParrainageFilleuleConfirmation` + types TS `FilleuleStatut` / `Filleule`
- 9.A.5 RPC atomique `parrainage_decrement_compteur` (race `confirmerFraude`)
- 9.A.6 Audit Sentry 7j post-deploy Epic 7+8 (signaux role-aware)

### Mini-épic 9.B — Couverture E2E manquante (2 stories, héritées 7.C, après 9.A.1 si refacto mocks impacte fixtures)

Réactive les 2 stories backlog Epic 7 jamais livrées. Pré-requis 7.C.1 infra Playwright déjà en place.

- 9.B.1 E2E RGPD cascade (suppression compte 3 rôles) — héritée 7.C.3
- 9.B.2 E2E matching (basique + notif email + filtre paywall) — héritée 7.C.4

### Mini-épic 9.C — Seed staging + validations manuelles UI (3 stories)

Solde les 6 validations manuelles UI Epic 8 reportées par absence d'environnement staging exploitable.

- 9.C.1 Mécanisme seed staging « accompagné + abo + code » documenté
- 9.C.2 Solder 6 validations UI Epic 8 (8.A.1 T7, 8.B.1 T5.7, 8.B.2 T5, 8.C.1 T10, 8.C.3 T14, 8.D.1 T7)
- 9.C.3 Nettoyer doublons fichiers `" 2.md"` dans `_bmad-output/`

### Mini-épic 9.D — Bugs UX parrainage multi-cycles (2 stories)

Solde 3 defers `deferred-work.md` ciblant le dashboard accompagné/accompagnant cycles post-1er + 1 race condition register-form.

- 9.D.1 Barre progression + compteur affichés correctement post 1er cycle
- 9.D.2 Race condition register-form (`status === 'checking'` + Enter rapide)

### Synthèse ordonnancement

| Ordre | Stories | Justification |
|---|---|---|
| **Ordre 1** (parallélisables) | 9.A.1, 9.A.2, 9.A.3, 9.A.5, 9.A.6, 9.C.3 | Hardening pur sans dépendance entre elles |
| **Ordre 2** (séquentiels) | 9.A.4 (après 9.A.3), 9.C.1 (avant 9.C.2) | 9.A.4 suit suppression alias ; 9.C.2 consomme 9.C.1 |
| **Ordre 3** (E2E + UX) | 9.B.1, 9.B.2, 9.D.1, 9.D.2 | Après stabilisation hardening |
| **Ordre 4** (calendrier passif) | 9.A.6 déclencheur ~2026-05-21 (J+7 Epic 7) puis ~2026-05-24 (J+7 Epic 8) | Échéance figée par calendrier |

---

## Epic 9 : Hardening Epic 8 + couverture E2E manquante + seed staging

### Story 9.A.1 : Refonte mocks Supabase `fromMock` discriminants par table

**Source** : rétro Epic 8 AI-Epic9-B1 (defer Epic 8 reconduit 3 stories sans correction).

**Problème** : Les tests unit `tests/unit/parrainage-symetrie.test.ts` (et autres futurs) reposent sur un dispatcher séquentiel positionnel qui ignore le nom de table. Si demain on refactore l'ordre des appels `from('users')` / `from('subscriptions')` dans `validateCode`, les tests passent silencieusement avec la mauvaise table.

**Acceptance Criteria**

- AC1 : Helper partagé créé : `tests/unit/_lib/supabase-mock.ts` exposant `createFromMock(handlers: Record<string, ChainBuilder>)` où `handlers` mappe `tableName → chainBuilder`.
- AC2 : Le helper supporte les chaînes existantes (`.select().eq().single()`, `.select().eq().maybeSingle()`, `.update().eq()`, `.insert().select().single()`).
- AC3 : Migration de `tests/unit/parrainage-symetrie.test.ts` (11 SC) vers le nouveau helper. Tous les SC restent verts.
- AC4 : Tests `tests/unit/_lib/supabase-mock.test.ts` couvrent : (a) dispatch par table, (b) erreur si table absente du mapping, (c) retour par défaut si `single()` après chain vide.
- AC5 : Pas de modification des tests intégration (`tests/integration/`) qui utilisent une vraie BDD.
- AC6 : `npm run test:unit` exit 0 ; `npm run test` exit 0 ; `tsc --noEmit` exit 0.
- AC7 : Documentation `tests/unit/README.md` (ou top du helper) explique l'usage avec exemple.

**Estimation** : 0,5j-dev.

---

### Story 9.A.2 : Coverage `app/actions/parrainage.ts` ≥ 85% (workflow GHA + artefact)

**Source** : rétro Epic 8 AI-Epic9-B2 + defer `deferred-work.md` ligne 54 (couverture AC4 8.A.4 non mesurée).

**Problème** : La cible AC4 ≥ 85% de 8.A.4 n'a jamais été vérifiée. Sylvain ne lance pas Docker localement (mémoire `feedback_test_local_supabase`). Le workflow GHA `integration-tests.yml` ne produit pas de rapport coverage.

**Acceptance Criteria**

- AC1 : `.github/workflows/integration-tests.yml` étendu avec `--coverage` (vitest) ou équivalent et publie `coverage/coverage-summary.json` comme artefact GHA (rétention 30j minimum).
- AC2 : Job CI failed si coverage `app/actions/parrainage.ts` < 85% (branches + statements).
- AC3 : Script local équivalent disponible : `npm run test:integration:coverage`.
- AC4 : Si coverage initiale < 85%, lister les branches non couvertes dans un commentaire `// TODO Epic 9.A.2` du fichier source et créer 1 PR follow-up ciblée (anti-fraude `detectBlacklist`, idempotence INSERT 23505 racy, anti auto-parrainage `self_referral` cités par defer ligne 54).
- AC5 : `tsc --noEmit` exit 0 ; `npm run lint:a11y-check` baseline 155 préservé.
- AC6 : 2 runs GHA verts consécutifs avant merge.
- AC7 : Chiffre final publié dans la mémoire `project_epic_9_cadrage` (ou successeur).

**Estimation** : 0,5j-dev (workflow), +0,5j-dev si combler des branches.

---

### Story 9.A.3 : Supprimer alias deprecated `sendParrainageBienvenueMarraine`

**Source** : `deferred-work.md` ligne 10 (F-Epic8-C3 alias 1-release).

**Problème** : Epic 8 a livré `sendParrainageBienvenueParrain` + un alias deprecated `sendParrainageBienvenueMarraine` (ligne 596 `lib/emails.ts`) en filet de sécurité 1-release. La prochaine release prod (Epic 9 deploy) est l'occasion de le supprimer si plus aucun caller n'existe.

**Acceptance Criteria**

- AC1 : `grep -r "sendParrainageBienvenueMarraine" app/ components/ lib/ tests/` retourne uniquement la définition de l'alias (`lib/emails.ts:596`) avant la story et zéro occurrence après.
- AC2 : Suppression de la fonction wrapper `lib/emails.ts:596-XXX` + retrait des références mock dans `tests/integration/setup.ts:165` + `tests/unit/parrainage-symetrie.test.ts:86` (mentionnés dans defer ligne 10).
- AC3 : `npm run build` exit 0 ; `tsc --noEmit` exit 0 ; `npm run test:unit` exit 0.
- AC4 : Pas de modification des emails livrés (sujet, body, fallback) — c'est une suppression d'alias pur.
- AC5 : Commit dédié `refactor(emails): supprimer alias deprecated sendParrainageBienvenueMarraine` (pas mélangé avec 9.A.4 même si même fichier).

**Estimation** : 0,25j-dev.

---

### Story 9.A.4 : Rename `sendParrainageFilleuleConfirmation` + types TS `FilleuleStatut` / `Filleule`

**Source** : `deferred-work.md` ligne 12 + ligne 14 (F-Epic8-C3 rename non exécuté pour éviter diff sur 4 callsites tests + 2 app/actions).

**Problème** : Cohérence wording neutre incomplète. Epic 8 a renommé `Marraine → Parrain` côté UI + helper texte, mais a laissé `sendParrainageFilleuleConfirmation` (fonction email) + types TS `FilleuleStatut` / `Filleule` (composants accompagnant). Le fallback `'votre marraine'` → `'votre parrain'` ligne 669 a été fixé en 8.C.3, donc l'utilisateur final est OK ; reste la sémantique interne.

**Pré-requis** : 9.A.3 doit être merged (sinon double alias).

**Acceptance Criteria**

- AC1 : `lib/emails.ts:659` `sendParrainageFilleuleConfirmation` renommée en `sendParrainageFilleulConfirmation` (suppression du 'e' féminin). Alias deprecated 1-release ajouté (pattern T2.2 8.C.3).
- AC2 : Types TS `FilleuleStatut` / `Filleule` renommés en `FilleulStatut` / `Filleul` dans `components/accompagnant/parrainage-view.tsx:5-13` + `components/accompagne/parrainage-view.tsx` (si dupliqué).
- AC3 : Tous callers (4 callsites tests + 2 app/actions cités par defer ligne 12) mis à jour. `grep -r "Filleule"` retourne zéro occurrence hors alias deprecated.
- AC4 : `npm run build` exit 0 ; `tsc --noEmit` exit 0 ; `npm run test:unit` exit 0 ; `npm run lint:a11y-check` baseline 155 préservé.
- AC5 : Pas de modification BDD (colonnes `filleule_id` conservées — dette assumée Epic 5/6).
- AC6 : Commit dédié + note dans DECISIONS.md (rationale wording neutre interne TS, pas BDD).

**Estimation** : 0,5j-dev.

---

### Story 9.A.5 : RPC atomique `parrainage_decrement_compteur` (race `confirmerFraude`)

**Source** : `deferred-work.md` ligne 39 (F15 race condition read-modify-write non atomique).

**Problème** : `confirmerFraude` (`app/actions/admin-parrainages.ts`) lit puis écrit `compteur_confirmes` en 2 requêtes séparées. Si 2 admins confirment fraude simultanément sur le même parrain, race window → compteur décrémenté 1 fois au lieu de 2. Probabilité prod faible (1 admin), mais à corriger avant un éventuel second admin.

**Acceptance Criteria**

- AC1 : Migration BDD `supabase/migrations/YYYYMMDDHHMMSS_parrainage_decrement_compteur.sql` créant un RPC `parrainage_decrement_compteur(p_user_id uuid, p_delta int default 1)` atomique single-statement (`UPDATE users SET compteur_confirmes = GREATEST(compteur_confirmes - p_delta, 0) WHERE id = p_user_id`).
- AC2 : `SECURITY DEFINER` + check `auth.uid()` correspond à un admin via fonction `is_admin()` (pattern existant) + `REVOKE EXECUTE FROM anon, authenticated; GRANT EXECUTE TO service_role` (ou équivalent service-role only).
- AC3 : `app/actions/admin-parrainages.ts:confirmerFraude` consomme le RPC au lieu du read-modify-write actuel.
- AC4 : Audit MCP prerequisite : `mcp__supabase__list_tables` confirme `users.compteur_confirmes` colonne existante + type int. Migration appliquée via `mcp__supabase__apply_migration` (PAS via fichier seul).
- AC5 : Test intégration `tests/integration/admin/confirmer-fraude.test.ts` : 1 SC base + 1 SC concurrence simulée (2 appels sequentiels rapprochés, assert décrément = 2).
- AC6 : Tests intégration verts en GHA, `npm run build` exit 0.
- AC7 : Audit Sentry 7j post-deploy (signal `admin_actions_log` action `confirmer_fraude` + tag `flow=admin_parrainages`).

**Estimation** : 0,75j-dev.

---

### Story 9.A.6 : Audit Sentry 7j post-deploy Epic 7+8 (signaux role-aware)

**Source** : rétro Epic 8 AI-Epic7-D1 + AI-Epic7-D2.

**Déclencheur calendaire** : ~2026-05-21 (J+7 Epic 7, dernière story 7.C.2 mergée 2026-05-16) puis ~2026-05-24 (J+7 Epic 8, 8.D.1 mergée 2026-05-17).

**Acceptance Criteria**

- AC1 : Lecture Sentry events filtrés par tags listés en rétro Epic 8 S4 :
  - Epic 7 : `flow=subscription_check`, `flow=messaging signal=profile-lookup-error`, `flow=admin_messages_load`, `flow=admin_actions_log`, RPC `get_admin_conversations_with_unread`.
  - Epic 8 : `marraine-unexpected-role`, `marraine-unexpected-role-at-confirm`, `invalid-filleul-role`, `marraine-sub-inactive`, `marraine-ineligible-at-payment`, `genese-accompagne-failed`, `genese-accompagne-email-failed`, `cron-marraine-unexpected-role`, `cron-marraine-role-read-failed`, `cron-coupon-failed`.
- AC2 : Pour chaque signal : compter occurrences sur 7j glissants + classifier en (a) 0 occurrence (attendu, pas d'action), (b) volume faible bénin (documenter), (c) régression réelle (créer story follow-up Epic 10+).
- AC3 : Rapport `_bmad-output/implementation-artifacts/audit-sentry-epic-7-8-2026-05-24.md` (ou date réelle déclenchement) avec tableau signal x volume x verdict.
- AC4 : Si 0 régression sur tous les signaux : marquer dans DECISIONS.md `F-Epic9-A6 audit Sentry Epic 7+8 PASS sans réserve`.
- AC5 : Aucune modification de code (story 100% lecture / observabilité). Pas de migration BDD.
- AC6 : Story bloquante go-live full France (si Bretagne ouvre élargissement avant audit, ré-évaluer).

**Estimation** : 0,25j-dev (lecture + rapport).

---

### Story 9.B.1 : E2E RGPD cascade (suppression compte 3 rôles) — héritée 7.C.3

**Source** : héritée Epic 7 story 7.C.3 (jamais livrée, backlog), réactivée AI-Epic9-A2.

**Pré-requis** : 7.C.1 infra E2E Playwright déjà en place (DONE Epic 7).

**Acceptance Criteria**

- AC1 : `tests/e2e/rgpd-cascade.spec.ts` couvre :
  - **Suppression compte accompagnant** : user delete → cascade BDD (annonces, conversations, messages, accompagnants_profiles, `parrainages.marraine_id` SET NULL, etc.).
  - **Suppression compte accompagné** : user delete → cascade (favoris, recherches, `parrainages.filleule_id` SET NULL, **+ nouveau** : `parrainages_codes.user_id` CASCADE — flag Epic 8 8.A.0).
  - **Suppression compte admin** : refus si dernier admin (RLS + appli).
- AC2 : Chaque scénario assert via `supabase.from('users').select('id').eq('id', userId)` → null + assert tables annexes. Pattern shortcut BDD via pg client + `assertLocalPgUrl` (hérité 7.C.2 / 8.D.1).
- AC3 : Workflow GHA `e2e-tests.yml` exécute ces specs après 7.C.1. Tag Playwright `@rgpd-cascade`.
- AC4 : Cleanup défensif `afterAll` reset rows seedées (pattern 8.D.1).
- AC5 : 2 runs GHA verts consécutifs avant merge (stabilisation flaky).
- AC6 : Réutilisation stricte infra 7.C.1 : `loginAs`, `resetEphemeralRows`, page objects.

**Estimation** : 0,5j-dev (spec connue depuis Epic 7).

---

### Story 9.B.2 : E2E matching (basique + notif email + filtre paywall) — héritée 7.C.4

**Source** : héritée Epic 7 story 7.C.4 (jamais livrée, backlog), réactivée AI-Epic9-A2.

**Pré-requis** : 7.C.1 infra E2E Playwright déjà en place.

**Acceptance Criteria**

- AC1 : `tests/e2e/matching.spec.ts` couvre :
  - **Matching basique** : accompagnant publie annonce dpt X → accompagné recherche dpt X → annonce apparaît dans `/recherche` + score calculé attendu.
  - **Notification email match** : accompagné enregistre recherche stockée → accompagnant publie nouvelle annonce dpt X → email envoyé à l'accompagné (assert via mock Resend ou inspection `notifications_log` — pattern 7.A.6 idempotence).
  - **Filtre soft paywall** : accompagné non-abonné voit liste mais clic « Contacter » → redirect paywall.
- AC2 : Workflow GHA exécute après 7.C.1. Tag Playwright `@matching`.
- AC3 : Cleanup défensif `afterAll` reset annonces seedées + recherches stockées.
- AC4 : Mock Resend optionnel — préférer assertion `notifications_log` (plus stable, déjà couvert par 7.A.11 lint INSERT direct).
- AC5 : 2 runs GHA verts consécutifs avant merge.
- AC6 : Vérifier que les baselines a11y restent intactes (les tests E2E sont sur config dédiée, mais sécurité).

**Estimation** : 0,5j-dev (spec connue depuis Epic 7).

---

### Story 9.C.1 : Mécanisme seed staging « accompagné + abo + code » documenté

**Source** : rétro Epic 8 AI-Epic9-A3 + 6 validations manuelles UI reportées (I3 rétro).

**Problème** : Aucun environnement local/staging permet à Sylvain de tester un parcours accompagné complet (abo Stripe actif + code parrainage généré). Toutes les validations UI Epic 8 ont été reportées par cette absence.

**Acceptance Criteria**

- AC1 : Script `scripts/seed-staging-accompagne-abo-code.mjs` (ou `.ts`) exécutable via `npm run seed:staging:accompagne-abo-code`.
- AC2 : Le script (a) crée un user accompagné via `supabase.auth.admin.createUser`, (b) insère row `subscriptions` status `active` + `stripe_subscription_id` mocké, (c) déclenche `triggerAccompagneCodeGenesisIfEligible` (ou simule l'insertion `parrainages_codes` équivalente), (d) imprime en sortie l'email/password + code parrainage généré.
- AC3 : Le script échoue immédiatement si `SUPABASE_URL` contient `production` ou correspond à l'URL prod connue (garde-fou anti-erreur). Pattern `assertLocalPgUrl` hérité 7.C.2.
- AC4 : Variables d'environnement consommées : `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`, `STRIPE_TEST_CUSTOMER_ID` (optionnel, mock par défaut).
- AC5 : Script idempotent : si user `e2e-staging-accompagne@example.test` existe déjà, refuse l'exécution ou propose `--reset` pour nettoyer avant.
- AC6 : Documentation `tests/staging/README.md` (ou top du script) avec : prérequis, commande, sortie attendue, mode reset, troubleshooting.
- AC7 : `tsc --noEmit` exit 0 ; pas d'impact tests existants ; pas d'ajout aux garde-fous CI (script manuel uniquement).

**Estimation** : 0,75j-dev.

---

### Story 9.C.2 : Solder 6 validations UI Epic 8 (8.A.1 T7, 8.B.1 T5.7, 8.B.2 T5, 8.C.1 T10, 8.C.3 T14, 8.D.1 T7)

**Source** : rétro Epic 8 I3 — 6 validations manuelles staging reportées par absence d'env.

**Pré-requis** : 9.C.1 livré + déployé sur staging Vercel.

**Acceptance Criteria**

- AC1 : Sylvain consomme 9.C.1 pour générer un compte accompagné staging + 1 compte accompagnant filleul.
- AC2 : Vérifications visuelles exécutées et statut consigné dans `_bmad-output/implementation-artifacts/validations-ui-epic-8.md` :
  - **8.A.1 T7** : webhook Stripe staging → row `parrainages_codes` créée avec `user_id` du nouvel accompagné + code 8-char alphanumérique + email Resend `welcome_parrainage_accompagne` reçu.
  - **8.B.1 T5.7** : `/accompagne/parrainage` affiche code visible, bouton « Copier » fonctionne, liste filleuls (vide), CTA WhatsApp / email pré-remplis. Lighthouse a11y ≥ 95.
  - **8.B.2 T5** : `/accompagne/dashboard` affiche teaser « Invitez un accompagnant » + barre progression 0/5.
  - **8.C.1 T10** : `/admin/parrainages` affiche colonne « Rôle parrain » + filtre déroulant fonctionnel (tous / accompagnant / accompagné).
  - **8.C.3 T14** : table admin affiche `Parrain` / `Filleul` en-têtes ; helper text H1 dit `Toutes les relations parrain / filleul` ; fallback `Filleul` apparaît si first/last name null.
  - **8.D.1 T7** : parcours golden path manuel (signup accompagnant avec code accompagné parrain) → arrive sur dashboard sans visio bypass UI visible.
- AC3 : Si une validation échoue : créer story bugfix dans Epic 10+ avec capture d'écran.
- AC4 : Rapport final committed dans `_bmad-output/implementation-artifacts/`.
- AC5 : Aucune modification de code app (story 100% validation manuelle).

**Estimation** : 0,5j-dev (validations) + 0,25j-dev (compte rendu).

---

### Story 9.C.3 : Nettoyer doublons fichiers `" 2.md"` dans `_bmad-output/`

**Source** : rétro Epic 8 I1 + AI-Epic8-M2.

**Problème** : `8-a-4-tests-integration-parrainage-symetrique 2.md` et `8-d-1-...golden-path 2.md` existent à côté des originaux (probable sync iCloud Drive).

**Acceptance Criteria**

- AC1 : Audit complet : `find _bmad-output/ -name "* 2.md" -o -name "* 2.txt" -o -name "* 2.yaml"` liste tous les fichiers en doublon.
- AC2 : Pour chaque doublon : `diff` avec l'original pour confirmer doublon identique (ou divergence à arbitrer).
- AC3 : Si doublon identique : suppression du fichier `" 2"`.
- AC4 : Si divergence : présenter le diff à Sylvain pour arbitrage (merger ou supprimer).
- AC5 : Investigation root cause iCloud Drive : documenter dans la mémoire `project_bmad_conventions` ou `feedback_icloud_drive_doublons` pour prévention future (ex. `.gitignore` pattern `* 2.md`, ou désactiver sync iCloud sur ce dossier).
- AC6 : Commit dédié `chore(bmad): nettoyer doublons fichiers iCloud Drive`.

**Estimation** : 0,15j-dev.

---

### Story 9.D.1 : Barre progression + compteur affichés correctement post 1er cycle

**Source** : `deferred-work.md` lignes 43-45 (3 defers conjoints `app/accompagne/dashboard/page.tsx:315-323` + `app/accompagnant/dashboard/page.tsx:472-484`).

**Problème** : 3 bugs UX cumulatifs sur le widget parrainage cycles multi-tours :
1. À `compteur % 5 === 0`, barre vide (5 segments gris) alors que la récompense vient d'être déclenchée.
2. `{parrainageCompteur} / 5` affiche `7 / 5` au lieu de `2 / 5` après le 2e cycle (compteur brut, pas modulo).
3. `parrainageTotalRecompenses > 0` + `compteur === 0` affiche « 0 / 5 confirmés » contradictoire (début 2e cycle).

**Acceptance Criteria**

- AC1 : Décision UX prise et actée dans DECISIONS.md (F-Epic9-D1) :
  - Option A : barre pleine momentanément au palier puis reset visuel après 2s (animation).
  - Option B : signal visuel distinct au palier (badge « +6 mois » par ex.), reset compteur immédiatement.
  - Choisir l'une des deux après revue mockup.
- AC2 : Formule numérateur passée à `parrainageCompteur % 5` (ou équivalent si Option B).
- AC3 : Cas « début 2e cycle » (`totalRecompenses > 0` + `compteur === 0`) traité explicitement : afficher « Cycle 2 commencé » ou similaire.
- AC4 : Fix appliqué aux **2 dashboards** (`app/accompagnant/dashboard/page.tsx` et `app/accompagne/dashboard/page.tsx`) en cohérence.
- AC5 : Tests unit : 1 SC par cas (compteur=0 cycle1 / compteur=3 cycle1 / compteur=5 cycle1 / compteur=0 cycle2 / compteur=7 cycle2).
- AC6 : Baselines a11y préservées + responsive mobile vérifié (capture mobile + desktop dans la PR).
- AC7 : Validation manuelle staging via 9.C.1 si possible (signaler dans 9.C.2 si en flight).

**Estimation** : 0,5j-dev.

---

### Story 9.D.2 : Race condition register-form (`status === 'checking'` + Enter rapide)

**Source** : `deferred-work.md` ligne 37 (F8 8.C.1 race condition).

**Problème** : Dans `components/auth/register-form.tsx`, clic rapide ou Enter pendant la validation async de `validateCode` (status `checking`) → step avance avec code non encore validé. Mitigé côté serveur (re-validation `createParrainageRelation`) mais l'UX est cassée (utilisateur croit son code accepté avant la réponse).

**Acceptance Criteria**

- AC1 : Bouton « Continuer » (ou submit form) disabled tant que `validateStatus === 'checking'`.
- AC2 : Enter key ignoré dans cet état (`onKeyDown` avec `e.preventDefault()` ou `disabled` natif si bouton est `type=submit`).
- AC3 : Spinner ou indicateur visuel sur le bouton pendant `checking` (a11y : `aria-busy="true"` + `aria-live="polite"` sur le statut).
- AC4 : Test unit `tests/unit/register-form-race.test.tsx` : 1 SC clic rapide avant fin async + 1 SC Enter pendant `checking`.
- AC5 : Validation manuelle staging via 9.C.1 (signaler dans 9.C.2 si en flight).
- AC6 : Baselines a11y préservées (`lint:a11y-check` 155 + axe `p4-register`).

**Estimation** : 0,25j-dev.

---

## Récapitulatif Epic 9

| Mini-épic | Stories | Estim. | Criticité | Ordonnancement |
|---|---|---|---|---|
| 9.A Hardening Epic 8 | 6 (9.A.1 à 9.A.6) | ~2,75j | Moyenne | Parallélisables (sauf 9.A.4 après 9.A.3) |
| 9.B Couverture E2E | 2 (9.B.1, 9.B.2) | ~1j | Moyenne | Après 7.C.1 (DONE), indépendantes entre elles |
| 9.C Seed staging + validations | 3 (9.C.1 à 9.C.3) | ~1,4j | Élevée (débloque 6 validations Epic 8) | 9.C.1 avant 9.C.2 ; 9.C.3 indépendante |
| 9.D Bugs UX parrainage | 2 (9.D.1, 9.D.2) | ~0,75j | Faible | Indépendantes, après 9.C.1 si validation staging souhaitée |
| **Total** | **13 stories** | **~5,9j-dev** | | |

**Ordre 1 (parallélisables sans bloquant)** : 9.A.1, 9.A.2, 9.A.3, 9.A.5, 9.A.6 (déclencheur calendaire), 9.C.3.

**Ordre 2 (dépendances internes)** : 9.A.4 (après 9.A.3), 9.C.1 (prérequis 9.C.2).

**Ordre 3 (après stabilisation hardening)** : 9.B.1, 9.B.2, 9.C.2, 9.D.1, 9.D.2.

**Pas de checkpoint review obligatoire avant exécution** : scope arbitré, criticité documentée story par story, méthodologie BMad stabilisée Epic 5/6/7/8. Sylvain peut lancer les stories on-demand.

---

## Mise à jour mémoires projet

À créer / mettre à jour après validation de ce cadrage :

- À créer : `project_epic_9_cadrage.md` (pointeur vers ce document + scope).
- À mettre à jour en clôture : `project_epic_9_retro.md` (après exécution).
- À mettre à jour : `project_epic_8_retro.md` (statut AI-Epic9-A1/A2/A3 marqués « cadré Epic 9 »).

---

**Cadrage clôturé 2026-05-17. Epic 9 prêt à exécuter on-demand. Pré-requis : aucun (toutes infras Playwright + a11y + CI hardening déjà en place).**
