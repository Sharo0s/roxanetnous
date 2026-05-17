# Story 8.A.0 : Audit MCP schema parrainages (pre-requis backend)

Status: done

<!-- Note: Validation is optional. Run validate-create-story for quality check before dev-story. -->

## Story

As a developer,
I want auditer le schema Supabase des tables `parrainages`, `parrainages_codes`, `users.role`, `subscriptions`,
so that je confirme l'absence de CHECK constraint ou FK discriminant le role du parrain avant d'ecrire le code Epic 8.

## Acceptance Criteria

1. **AC1 — Aucune contrainte role sur parrain** : apres execution des requetes MCP `execute_sql` sur `parrainages` et `parrainages_codes`, le resultat confirme qu'aucun CHECK constraint n'impose `role = 'accompagnant'` cote `marraine_id`. Les DDL completes sont documentees dans le rapport.

2. **AC2 — Enum/CHECK `users.role` confirme** : les valeurs possibles `'accompagnant'`, `'accompagne'`, `'admin'`, `'visiteur'` sont verifiees (CHECK constraint ou ENUM Postgres). La colonne est NOT NULL et indexee (sinon flag explicite pour 8.A.2).

3. **AC3 — Schema `subscriptions` confirme** : la colonne `status` accepte les valeurs `'active'`, `'trialing'`, `'past_due'`, `'canceled'`, `'unpaid'`. La FK `user_id` ne porte aucun filtre de role.

4. **AC4 — Rapport `audit-bdd-parrainage-symetrique-2026-05-16.md` cree** dans `_bmad-output/implementation-artifacts/` avec : (1) DDL actuelles des 4 tables, (2) FK et CHECK existantes, (3) indexes utiles, (4) verdict GO/NO-GO pour Epic 8 sans migration, (5) si migration necessaire, ALTER proposes.

5. **AC5 — Entree DECISIONS.md appendue** : cle `F-Epic8-A0` avec la decision « parrainage symetrique implementable sans migration BDD » (ou la liste des ALTER necessaires si migration requise).

## Tasks / Subtasks

- [x] **T1 - Auditer la table `parrainages`** (AC: #1, #4)
  - [x] T1.1 - `execute_sql` columns : 14 colonnes confirmees (id UUID PK, code TEXT NOT NULL, marraine_id UUID NULL, filleule_id UUID NULL, statut TEXT NOT NULL default 'en_attente', ip_inscription, stripe_fingerprint, blocage_raison, flag_suspicion, timestamps).
  - [x] T1.2 - `execute_sql` constraints : 1 CHECK (`statut IN ...`), 2 FK (marraine_id + filleule_id) -> users(id) ON DELETE SET NULL, 1 PK. **Aucun CHECK ne discrimine `role`.**
  - [x] T1.3 - `marraine_id` et `filleule_id` confirmes UUID NULLable sans CHECK role.
  - [x] T1.4 - 8 indexes documentes (PK, code, marraine, filleule, statut, blacklist partiel, UNIQUE partielle filleule_code, composite filleule_code_statut).

- [x] **T2 - Auditer la table `parrainages_codes`** (AC: #1, #4)
  - [x] T2.1 - 6 colonnes : user_id UUID NOT NULL (PK), code TEXT NOT NULL, compteur_confirmes INT default 0, total_recompenses INT default 0, derniere_recompense_at, created_at.
  - [x] T2.2 - PK (user_id), UNIQUE (code), FK user_id -> users(id) ON DELETE CASCADE. **Aucun CHECK role.**
  - [x] T2.3 - `user_id` est PK donc implicitement UNIQUE + NOT NULL -> prerequis `generateCodeForUserSystem` idempotent confirme.
  - [x] T2.4 - `compteur_confirmes` INTEGER NOT NULL default 0 + `total_recompenses` INTEGER NOT NULL default 0 confirmes.

- [x] **T3 - Auditer `users.role`** (AC: #2, #4)
  - [x] T3.1 - `role` est de type `user_role` (USER-DEFINED, kind=enum), NOT NULL, sans default.
  - [x] T3.2 - Aucun CHECK constraint dedie (le typage enum suffit).
  - [x] T3.3 - **Aucun index sur `users.role`** -> flag pour 8.A.2 / 8.C.1 (decision : defer la creation jusqu a justification benchmark, l index sur role seul n aide pas le path 8.A.2 selectif sur PK).
  - [x] T3.4 - Enum `user_role` expose **3 valeurs** : `accompagnant`, `accompagne`, `admin`. Decalage spec : la story citait aussi `visiteur` (inexistant cote BDD, aucun impact Epic 8). Distribution actuelle 822 / 3 / 1.

- [x] **T4 - Auditer la table `subscriptions`** (AC: #3, #4)
  - [x] T4.1 - 17 colonnes documentees (id PK UUID, user_id UNIQUE UUID NOT NULL, stripe IDs, status enum NOT NULL default 'trialing', timestamps, cancel_feedback).
  - [x] T4.2 - PK (id), UNIQUE (user_id, stripe_customer_id, stripe_subscription_id), FK user_id -> users(id) ON DELETE CASCADE. **Aucun CHECK role.** `user_id` UNIQUE -> 1 user max 1 sub.
  - [x] T4.3 - `user_id` UUID NOT NULL sans filtre role : le lookup parrain accompagne `subscriptions.user_id = parrain.id` est unrestrictif.
  - [x] T4.4 - Enum `subscription_status` expose **4 valeurs** : `active`, `cancelled` (double L), `past_due`, `trialing`. Decalage spec : la story citait aussi `canceled` (simple L) et `unpaid` (absents). Aucun impact Epic 8 (lookup filtrera sur `active`).

- [x] **T5 - Rediger le rapport `audit-bdd-parrainage-symetrique-2026-05-16.md`** (AC: #4)
  - [x] T5.1 - Fichier cree dans `_bmad-output/implementation-artifacts/` (~250 lignes).
  - [x] T5.2 - Structure : verdict GO/NO-GO en tete + 7 flags non bloquants + DDL detaillee par table + RLS recap + ALTER proposes (optionnel idx_users_role) + sources MCP + liens stories suivantes.
  - [x] T5.3 - Aucun CHECK ne bloque, aucun ALTER bloquant propose. Seul `CREATE INDEX idx_users_role` documente comme optionnel (defer 8.A.2 ou 8.C.1).

- [x] **T6 - Appender l'entree DECISIONS.md** (AC: #5)
  - [x] T6.1 - `DECISIONS.md` ouvert (912 lignes pre-append).
  - [x] T6.2 - Section `## F-Epic8-A0 -- Audit BDD parrainage symetrique (2026-05-16)` ajoutee : decision GO sans migration + 3 decalages spec rectifies + implications techniques par story 8.A.1-8.A.4 + regle pattern futur (tout nouveau role parrain requiert audit MCP identique).

### Review Findings

- [x] [Review][Patch] **F1 — `confirmParrainageOnSuccess` interroge `accompagnants_profiles` inconditionnellement** — FLAG-A ajouté section 6 rapport + DECISIONS.md 8.A.2.
- [x] [Review][Patch] **F2 — `accompagnants_profiles` hors périmètre d'audit mais critique pour 8.A.2/8.A.3** — FLAG-B ajouté section 6 rapport.
- [x] [Review][Patch] **F3 — DDL incohérents entre rapport et DECISIONS.md** — DECISIONS.md aligné sur le rapport (expire_at/updated_at corrigés).
- [x] [Review][Patch] **F4 — `plan_type` listé deux fois dans DDL `subscriptions` DECISIONS.md** — Doublon supprimé.
- [x] [Review][Patch] **F9 — `trialing` non tranché pour le parrain accompagné dans `validateCode`** — FLAG-D ajouté section 6 rapport + DECISIONS.md.
- [x] [Review][Patch] **F10 — `users.parrainee_par` non audité** — FLAG-C ajouté section 6 rapport + DECISIONS.md.
- [x] [Review][Defer] **F5 — AC2 partiel : `visiteur` absent de l'enum** — Écart de spec documenté dans rapport et DECISIONS.md, non-impactant Epic 8. Defer : clarifier la spec en début d'Epic 9.
- [x] [Review][Defer] **F6 — AC3 partiel : `canceled`/`unpaid` absents** — Écart de spec documenté, non-impactant Epic 8 (filtre sur `active` uniquement). Defer : noter pour spec Epic 9.
- [x] [Review][Defer] **F7 — AC4 : DDL `users` incomplète (seulement `role`)** — Périmètre ciblé accepté (audit Epic 8 sur colonnes pertinentes seulement). Defer hors-scope.
- [x] [Review][Defer] **F12 — `relforcerowsecurity` non vérifié pour `parrainages_codes`** — Webhook utilise service role ; bypass RLS garanti sauf FORCE RLS explicite, risque très faible. Defer à un audit sécurité global.

## Dev Notes

**Contexte metier :** Cette story est un audit pur (lecture seule sauf DECISIONS.md). Aucune migration BDD, aucun code applicatif. Le dev agent utilise uniquement les outils MCP Supabase (`execute_sql`, `list_tables`) et `Read`/`Write` pour les fichiers.

**Pourquoi cet audit en premier :** L'Epic 8 etend le parrainage a un nouveau role parrain (`accompagne`). Le code serveur existant dans `app/actions/parrainage.ts` fait des requetes sur `parrainages.marraine_id` et `parrainages_codes.user_id` sans contrainte de role explicite dans l'application — mais des CHECK BDD pourraient bloquer l'insertion de rows avec un parrain `accompagne`. L'audit confirme ou infirme avant que les stories 8.A.1+ ecrivent du code.

**Tables a auditer (4) :**
- `public.parrainages` — colonnes cles : `marraine_id UUID`, `filleule_id UUID`, `statut TEXT`, `code TEXT`, `ip_inscription TEXT`, `blacklist_suspicion TEXT` (ou JSONB selon version actuelle), `blocage_raison TEXT`
- `public.parrainages_codes` — colonnes cles : `user_id UUID UNIQUE`, `code TEXT UNIQUE`, `compteur_confirmes INT`, `total_recompenses INT`
- `public.users` — colonne cle : `role TEXT NOT NULL` (valeurs : `accompagnant`, `accompagne`, `admin`, `visiteur`)
- `public.subscriptions` — colonnes cles : `user_id UUID`, `status TEXT`, `price_id TEXT`, `stripe_subscription_id TEXT`

**Code serveur de reference :**
- `app/actions/parrainage.ts:326-448` — `validateCode` : lookup `parrainages_codes` par code, puis `users.role` du parrain (modification prevue 8.A.2 : comportement conditionnel si `role='accompagne'`)
- `app/actions/parrainage.ts:454-727` — `createParrainageRelation` : insere row `parrainages` avec `marraine_id` = parrain (quel que soit son role apres 8.A.2)
- `app/actions/parrainage.ts:733-961` — `confirmParrainageOnSuccess` : appele apres paiement Stripe, applique bypass visio + genese code filleul

**Guard anti-fraude a confirmer :** La fonction `detectBlacklist` (parrainage.ts ~700) compare `filleule.email` aux emails des autres filleules du meme parrain — logique role-independante selon la spec. L'audit confirme qu'aucune contrainte BDD ne reintroduit un filtre de role implicite.

**Outils a utiliser dans cet ordre :**
1. `mcp__supabase__list_tables` — inventaire rapide des tables
2. `mcp__supabase__execute_sql` — requetes DDL specifiques (voir T1-T4)
3. `Read` sur `DECISIONS.md` pour connaitre la section existante avant d'appender
4. `Write` pour le rapport et l'entree DECISIONS.md

**Patterns precedents :** Les stories d'audit similaires (7.A.8 investigation `is_accompagnant`, 4.8 separation required/optional) ont toutes produit un rapport `.md` dans `implementation-artifacts/`. Conserver ce pattern.

### Project Structure Notes

- Rapport de sortie : `_bmad-output/implementation-artifacts/audit-bdd-parrainage-symetrique-2026-05-16.md`
- DECISIONS.md : `/Users/sylvain/Documents/roxanetnous/DECISIONS.md` (a la racine du projet)
- Code serveur parrainage : `app/actions/parrainage.ts` (ne pas modifier)
- Story suivante bloquee par cette story : 8.A.1 (si migration BDD est requise) et 8.A.2 (si index manquant sur `users.role`)

### References

- [Source: epic-8.md#Story 8.A.0] — spec complete AC et contexte metier
- [Source: epic-8.md#AR-E8.1] — `parrainages_codes` inchange, audit confirme absence CHECK discriminant
- [Source: epic-8.md#AR-E8.2] — `parrainages.marraine_id` FK et CHECK constraints a confirmer
- [Source: epic-8.md#AR-E8.3] — `validateCode` : lookup `accompagnants_profiles` a rendre conditionnel selon role parrain (8.A.2)
- [Source: _bmad-output/planning-artifacts/sprint-change-proposal-2026-04-18-parrainage.md] — SCP original Epic 2 parrainage, historique du schema

## Dev Agent Record

### Agent Model Used

claude-opus-4-7 (1M context)

### Debug Log References

- 13 requetes MCP `execute_sql` lecture seule executees 2026-05-16, toutes succes :
  - 4x `information_schema.columns` (parrainages, parrainages_codes, users.role uniquement, subscriptions)
  - 4x `pg_constraint` (CHECK+FK+PK+UNIQUE par table cible)
  - 4x `pg_indexes` (parrainages, parrainages_codes, users, subscriptions)
  - 1x distribution `SELECT role, COUNT(*) GROUP BY role` -> 822/3/1
  - 1x `SELECT DISTINCT status FROM subscriptions` -> 2 valeurs effectives (`active`, `cancelled`)
  - 1x enum dump `pg_type/pg_enum` -> `user_role` (3 valeurs) + `subscription_status` (4 valeurs)
  - 1x `pg_attribute/pg_type` kind verification -> enum confirme (typtype='e')
  - 1x volumetrie agregee `COUNT(*)` x4 -> 3 parrainages, 813 codes, 3 accompagne, 799 subs actives
  - 1x `pg_policy` RLS dump -> 8 policies confirmees role-independantes (sauf admin bypass)
  - 1x `pg_class.relrowsecurity` -> RLS enabled sur les 4 tables
- Aucune erreur SQL, aucun rollback necessaire (lecture seule integrale).

### Completion Notes List

- **Verdict GO sans migration BDD** pour Epic 8 confirme par audit MCP. Toutes les operations envisagees stories 8.A.1-8.A.4 sont compatibles avec le schema actuel.
- **3 decalages spec-vs-realite rectifies** dans rapport + DECISIONS :
  1. `user_role` enum 3 valeurs (pas 4 -- pas de `visiteur`)
  2. `subscription_status` enum 4 valeurs (pas 5 -- `cancelled` double L, pas de `unpaid`)
  3. Pas d index sur `users.role` (flag 8.A.2/8.C.1, defer jusqu a justification benchmark)
- **4 invariants documentes pour le code 8.A.1+** : `marraine_id` NULLable filtrer dans JOIN, `subscriptions.user_id` UNIQUE `.maybeSingle()`, `parrainages.code` non UNIQUE seul `parrainages_codes.code` l est, RLS role-independantes confirmees.
- **Hors-scope volontaire** : aucune modification de `parrainages.statut` CHECK constraint (les valeurs `en_attente/inscrite/abonnee/confirme/fraude/bloque` suffisent), aucune modification de RLS, aucun nouvel index pre-emptif.
- **DECISIONS.md F-Epic8-A0** appendue avec regle pattern futur : tout nouveau role parrain requiert audit MCP identique avant ecriture code.

### File List

- `_bmad-output/implementation-artifacts/audit-bdd-parrainage-symetrique-2026-05-16.md` (cree, ~250 lignes)
- `DECISIONS.md` (section F-Epic8-A0 appendue, ~30 lignes)
- `_bmad-output/implementation-artifacts/8-a-0-audit-mcp-schema-parrainages.md` (cette story : tasks coches + Dev Agent Record renseigne + status review)
- `_bmad-output/implementation-artifacts/sprint-status.yaml` (8-a-0 in-progress -> review)

## Change Log

- 2026-05-16 : audit MCP lecture seule des 4 tables cibles Epic 8. Verdict **GO sans migration BDD**. Rapport detaille + DECISIONS.md F-Epic8-A0 livres. Stories 8.A.1-8.A.4 deverrouillees.

## DoD a11y

N/A — story sans impact UI (audit BDD + rapport texte uniquement).
