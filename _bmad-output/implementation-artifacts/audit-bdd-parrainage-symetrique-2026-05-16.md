# Audit BDD - parrainage symetrique (Epic 8, story 8.A.0)

- **Date** : 2026-05-16
- **Auteur** : dev-story (claude-opus-4-7) via MCP Supabase `execute_sql`
- **Perimetre** : 4 tables (`parrainages`, `parrainages_codes`, `users`, `subscriptions`) + types ENUM (`user_role`, `subscription_status`) + RLS associees
- **Volumetrie BDD prod le jour de l'audit** :
  - `users` : 822 `accompagnant` + 3 `accompagne` + 1 `admin` (826 total, **0 `visiteur`**)
  - `parrainages` : 3 rows (historiques Epic 2)
  - `parrainages_codes` : 813 rows (codes pre-genere par accompagnant)
  - `subscriptions` : 799 `active` (BDD prod largement peuplee depuis epic-6/refonte)

## 1. Verdict GO/NO-GO

**GO sans migration BDD** pour Epic 8 (parrainage symetrique accompagne -> accompagnant).
- Aucun CHECK constraint sur `parrainages` ou `parrainages_codes` ne discrimine le role du parrain.
- Aucune FK ne restreint `marraine_id` au sous-ensemble `role='accompagnant'`.
- Aucune RLS policy ne filtre selon le role du parrain (les policies actuelles operent sur `auth.uid()=marraine_id` ou `auth.uid()=user_id`, role-independant ; seul `admin` est verifie pour bypass full-access).
- L'enum `user_role` accepte deja `'accompagne'`, qui est la valeur ciblee pour le parrain accompagne.

**Flags non bloquants mais a propager dans les stories suivantes** :

1. **Decalage spec story `users.role`** : la story 8.A.0 cite 4 valeurs (`accompagnant`, `accompagne`, `admin`, **`visiteur`**). La BDD reelle expose **3 valeurs uniquement** dans l'enum `user_role` (`accompagnant`, `accompagne`, `admin`). Il n'existe pas de role `visiteur` cote BDD. **Aucun impact Epic 8** (un visiteur ne peut pas parrainer puisqu'il n'est pas authentifie). A noter pour eviter de propager une croyance erronee dans les futures stories.

2. **Decalage spec story `subscriptions.status`** : la story 8.A.0 cite 5 valeurs (`active`, `trialing`, `past_due`, `canceled`, `unpaid`). La BDD reelle expose **4 valeurs** dans l'enum `subscription_status` (`active`, `cancelled` [**double L**], `past_due`, `trialing`). Pas de `canceled` (anglais simple L), pas de `unpaid`. Le code applicatif d'Epic 8 (lookup parrain) devra filtrer sur `status = 'active'` uniquement -> aucun impact car cette valeur existe. Le decalage de naming (`cancelled` BDD vs `canceled` souvent utilise dans Stripe) est une dette pre-existante hors-scope.

3. **Index manquant sur `users.role`** (flag 8.A.2) : aucun index btree dedie. Distribution actuelle 822 / 3 / 1 = quasi-binaire. Le lookup `WHERE id = ? AND role = 'accompagne'` du parrain (8.A.2 `validateCode` branch accompagne) est selectif sur le PK donc l'index sur `role` seul ne change rien a la requete principale. **L'index est utile pour les futures stats admin** (8.C.1 page admin parrainages tous roles) mais pas critique pour le path 8.A. **Recommandation : creer l'index `idx_users_role` dans 8.A.2 si la story ajoute des requetes batch filtrant par role, sinon defer 8.C.1.**

4. **`subscriptions.user_id` est UNIQUE** : 1 utilisateur a au plus 1 souscription. Le lookup parrain `SELECT * FROM subscriptions WHERE user_id = ?` retournera donc 0 ou 1 row. Code 8.A.2 doit gerer `.maybeSingle()` ou equivalent.

5. **`parrainages.marraine_id` est NULLable** (FK ON DELETE SET NULL) : un parrain peut etre dissocie d'un parrainage en cours. Pour 8.A.2/8.A.3, **toute requete devra filtrer `marraine_id IS NOT NULL`** avant de lire le role (sinon JOIN renvoie NULL). Pattern existant dans `app/actions/parrainage.ts` deja conforme.

6. **`parrainages.code` n'est pas UNIQUE** : seul `parrainages_codes.code` l'est. Logique : un meme code (cle parrain) peut apparaitre dans plusieurs rows `parrainages` (1 par filleule). La UNIQUE INDEX partielle `parrainages_filleule_code_active_unique ON (filleule_id, code) WHERE statut IN ('inscrite','abonnee','confirme')` previent les doublons actifs par filleule. **Pas de modification necessaire pour Epic 8.**

7. **`parrainages.statut` CHECK constraint** : `('en_attente','inscrite','abonnee','confirme','fraude','bloque')`. Aucune extension necessaire pour Epic 8 (le parrain accompagne suit le meme cycle de vie qu'un parrain accompagnant).

## 2. DDL detaillee

### 2.1 Table `public.parrainages` (3 rows)

| Colonne | Type | NULL | Default |
| --- | --- | --- | --- |
| id | uuid | NO | `gen_random_uuid()` |
| code | text | NO | (aucun) |
| marraine_id | uuid | YES | (aucun) |
| filleule_id | uuid | YES | (aucun) |
| statut | text | NO | `'en_attente'::text` |
| filleule_inscrite_at | timestamptz | YES | (aucun) |
| filleule_abonnee_at | timestamptz | YES | (aucun) |
| confirme_at | timestamptz | YES | (aucun) |
| ip_inscription | text | YES | (aucun) |
| stripe_fingerprint | text | YES | (aucun) |
| blocage_raison | text | YES | (aucun) |
| flag_suspicion | text | YES | (aucun) |
| created_at | timestamptz | YES | `now()` |
| expire_at | timestamptz | YES | (aucun) |

**Contraintes** :
- PK `parrainages_pkey (id)`
- FK `parrainages_marraine_id_fkey (marraine_id) -> users(id) ON DELETE SET NULL`
- FK `parrainages_filleule_id_fkey (filleule_id) -> users(id) ON DELETE SET NULL`
- CHECK `parrainages_statut_check : statut = ANY (ARRAY['en_attente','inscrite','abonnee','confirme','fraude','bloque'])`
- **Aucun CHECK ne discrimine `role` du parrain.**

**Indexes** :
- `parrainages_pkey` (PK)
- `idx_parrainages_code (code)`
- `idx_parrainages_marraine (marraine_id)`
- `idx_parrainages_filleule (filleule_id)`
- `idx_parrainages_statut (statut)`
- `idx_parrainages_blacklist (created_at DESC) WHERE statut IN ('bloque','fraude') OR flag_suspicion IS NOT NULL`
- `parrainages_filleule_code_active_unique (filleule_id, code) WHERE statut IN ('inscrite','abonnee','confirme')` (UNIQUE partielle)
- `parrainages_filleule_code_statut_idx (filleule_id, code, statut)`

### 2.2 Table `public.parrainages_codes` (813 rows)

| Colonne | Type | NULL | Default |
| --- | --- | --- | --- |
| user_id | uuid | NO | (aucun) |
| code | text | NO | (aucun) |
| compteur_confirmes | integer | NO | `0` |
| total_recompenses | integer | NO | `0` |
| derniere_recompense_at | timestamptz | YES | (aucun) |
| created_at | timestamptz | YES | `now()` |

**Contraintes** :
- PK `parrainages_codes_pkey (user_id)` -> `user_id` est PK donc implicitement UNIQUE et NOT NULL (prerequis idempotence `generateCodeForUserSystem` confirme)
- FK `parrainages_codes_user_id_fkey (user_id) -> users(id) ON DELETE CASCADE`
- UNIQUE `parrainages_codes_code_key (code)`
- **Aucun CHECK ne discrimine `role` du parrain.**

**Indexes** :
- `parrainages_codes_pkey (user_id)` (UNIQUE)
- `parrainages_codes_code_key (code)` (UNIQUE)
- `idx_parrainages_codes_code (code)` (redondant avec UNIQUE, dette pre-existante - hors-scope)

**Verdict T2** : la table peut accueillir des rows avec un `user_id` pointant vers un utilisateur `role='accompagne'` sans contrainte BDD. Le code applicatif 8.A.1 (webhook Stripe genese code parrainage) est libre d'inserer ces rows.

### 2.3 Colonne `public.users.role`

| Colonne | Type | NULL | Default |
| --- | --- | --- | --- |
| role | **`user_role`** (ENUM type) | NO | (aucun) |

**Valeurs enum `user_role`** (definition Postgres) :
- `accompagnant` (sort order 1)
- `accompagne` (sort order 2)
- `admin` (sort order 3)
- **Pas de valeur `visiteur`** (decalage spec story 8.A.0 -> rectification documentee F-Epic8-A0)

**Aucun CHECK constraint dedie** (le typage enum suffit a contraindre les valeurs).

**Indexes sur `users`** :
- `users_pkey (id)` (UNIQUE)
- `users_email_key (email)` (UNIQUE)
- `idx_users_email_lower (lower(email))`
- **Aucun index sur `role`** (flag 8.A.2 / 8.C.1)

**Distribution actuelle** :
- `accompagnant` : 822 rows
- `accompagne` : 3 rows
- `admin` : 1 row

### 2.4 Table `public.subscriptions` (799 rows actives)

| Colonne | Type | NULL | Default |
| --- | --- | --- | --- |
| id | uuid | NO | `gen_random_uuid()` |
| user_id | uuid | NO | (aucun) |
| stripe_customer_id | text | YES | (aucun) |
| stripe_subscription_id | text | YES | (aucun) |
| stripe_price_id | text | YES | (aucun) |
| status | **`subscription_status`** (ENUM type) | NO | `'trialing'::subscription_status` |
| plan_type | text | YES | (aucun) |
| current_period_start | timestamptz | YES | (aucun) |
| current_period_end | timestamptz | YES | (aucun) |
| cancel_at | timestamptz | YES | (aucun) |
| cancelled_at | timestamptz | YES | (aucun) |
| trial_end | timestamptz | YES | (aucun) |
| first_subscription_date | timestamptz | YES | (aucun) |
| created_at | timestamptz | NO | `now()` |
| updated_at | timestamptz | NO | `now()` |
| cancel_feedback | text | YES | (aucun) |
| cancel_comment | text | YES | (aucun) |

**Valeurs enum `subscription_status`** (definition Postgres) :
- `active` (sort order 1)
- `cancelled` (sort order 2, **double L** - decalage spec story 8.A.0 qui disait `canceled`)
- `past_due` (sort order 3)
- `trialing` (sort order 4)
- **Pas de valeur `unpaid`** (decalage spec story 8.A.0)

**Contraintes** :
- PK `subscriptions_pkey (id)`
- FK `subscriptions_user_id_fkey (user_id) -> users(id) ON DELETE CASCADE`
- UNIQUE `subscriptions_user_id_key (user_id)` -> **1 user = max 1 souscription**
- UNIQUE `subscriptions_stripe_customer_id_key (stripe_customer_id)`
- UNIQUE `subscriptions_stripe_subscription_id_key (stripe_subscription_id)`
- **Aucun CHECK ne discrimine `role` du proprietaire.**

**Indexes** :
- `subscriptions_pkey`
- `subscriptions_user_id_key` (UNIQUE)
- `subscriptions_stripe_customer_id_key` (UNIQUE)
- `subscriptions_stripe_subscription_id_key` (UNIQUE)
- `idx_subscriptions_user (user_id)` (redondant avec UNIQUE - dette pre-existante hors-scope)
- `idx_subscriptions_status (status)`
- `idx_subscriptions_first_date (first_subscription_date)`

**Verdict T4** : le lookup parrain `subscriptions.user_id = parrain.id` peut etre execute sans filtre de role et retournera 0 ou 1 row (UNIQUE user_id). Pour valider qu'un parrain est abonne, filtrer sur `status = 'active'`.

## 3. RLS policies (recap pour Epic 8)

**`parrainages`** (RLS enabled) :
- `parrainages_admin_full` (ALL) : `EXISTS (SELECT 1 FROM users WHERE id=auth.uid() AND role='admin')`
- `parrainages_marraine_read` (SELECT) : `auth.uid() = marraine_id`
- **Aucune policy ne filtre marraine sur son role.** Un parrain accompagne authentifie pourra lire ses parrainages.

**`parrainages_codes`** (RLS enabled) :
- `parrainages_codes_admin_full` (ALL) : `role='admin'`
- `parrainages_codes_owner_read` (SELECT) : `auth.uid() = user_id`
- **Aucune restriction de role pour l'owner.** Un user accompagne peut lire son code parrainage.

**`subscriptions`** (RLS enabled) :
- `sub_select_own` (SELECT) : `user_id = auth.uid() OR is_admin()`
- `sub_insert_service` (INSERT) : `is_admin() OR user_id = auth.uid()`
- `sub_update_service` (UPDATE) : `is_admin()` (service role uniquement en prod)
- `sub_delete_service` (DELETE) : `is_admin()`
- **Aucune restriction de role.** Le webhook Stripe (service role) pourra inserer une subscription pour un user accompagne et le code applicatif 8.A.2 pourra lire l'abonnement du parrain accompagne via service role.

**Verdict RLS** : **GO** sans modification. Toutes les operations Epic 8 (lookup parrain accompagne, lecture subscription parrain, insertion parrainage, generation code parrainage) sont compatibles avec les policies actuelles.

## 4. ALTER proposes

**Aucun ALTER bloquant pour Epic 8.**

**Optionnel (defer 8.A.2 si requete batch ou 8.C.1 si stats admin requierent perf)** :

```sql
-- A appliquer SEULEMENT si 8.A.2 ou 8.C.1 le justifie par benchmark
CREATE INDEX IF NOT EXISTS idx_users_role ON public.users USING btree (role);
```

**Aucune autre migration n'est requise.** Les enums `user_role` (3 valeurs) et `subscription_status` (4 valeurs) couvrent tous les cas usages Epic 8 ; les decalages avec la spec story sont des erreurs de cadrage rectifiees ci-dessus, pas des manques BDD.

## 5. Sources MCP execute_sql

13 requetes execute_sql executees 2026-05-16 (toutes en lecture seule, aucune modification BDD) :

1. `information_schema.columns` x4 (1 par table)
2. `pg_constraint` x4 (1 par table)
3. `pg_indexes` x4 (1 par table)
4. `users.role` distribution (`SELECT role, COUNT(*) GROUP BY role`)
5. `subscriptions.status` distinct (`SELECT DISTINCT status`)
6. Enum dump `pg_type/pg_enum` (`user_role`, `subscription_status`)
7. Type kind verification `pg_attribute/pg_type` (enum vs CHECK)
8. Volumetrie agregee (`COUNT(*)` x4)
9. RLS policies (`pg_policy` x3)
10. RLS enabled flag (`pg_class.relrowsecurity` x4)

## 6. Liens story-suivantes

- **8.A.1 (webhook Stripe genese code parrainage accompagne)** : peut inserer dans `parrainages_codes` avec `user_id` accompagne sans modification BDD.
- **8.A.2 (server actions parrainage symetrique)** : peut faire `validateCode` -> lookup `users.role` du parrain et brancher conditionnellement sur `accompagne` vs `accompagnant`. **Pas de migration. Index sur `users.role` optionnel.**

  **FLAGS CRITIQUES issus de la code review 8.A.0 (2026-05-17) :**

  - **FLAG-A — `confirmParrainageOnSuccess` bloquant pour parrain accompagne** : `app/actions/parrainage.ts:789` interroge `accompagnants_profiles` inconditionnellement et retourne `ok: false, reason: 'marraine_no_longer_validated'` si la row est absente. Un accompagne n'a jamais de row dans `accompagnants_profiles`. **8.A.2 doit imperativement brancher `confirmParrainageOnSuccess` sur le role du parrain** (if `role='accompagne'` : verifier `subscriptions.status='active'` ; if `role='accompagnant'` : conserver le path existant `accompagnants_profiles.validation_status='valide'`).

  - **FLAG-B — `accompagnants_profiles` hors perimetre de cet audit** : la table est interrogee dans `validateCode` (ligne 408) ET `confirmParrainageOnSuccess` (lignes 789, 800, 835, 850). Son schema DDL, FK, RLS et les valeurs possibles de `validation_status` n'ont pas ete audites dans 8.A.0. Avant d'ecrire 8.A.2, effectuer un audit ciblé MCP sur `accompagnants_profiles` (colonnes, CHECK, FK, RLS, valeurs enum `validation_status`).

  - **FLAG-C — `users.parrainee_par` non audite** : `createParrainageRelation` (ligne 584) ecrit `users.parrainee_par = validation.marraineId` (UUID du parrain, qu'il soit accompagnant ou accompagne). Un CHECK ou FK potentiel sur cette colonne pourrait bloquer l'ecriture si le parrain est accompagne. Auditer `users.parrainee_par` (type, CHECK, FK, NULL) avant implementation 8.A.2.

  - **FLAG-D — `trialing` eligible pour parrain accompagne** : le filtre `subscriptions.status='active'` dans les implications F-Epic8-A0 est incomplet. Le code existant (`isSubActive`) accepte aussi `trialing`. Le path accompagne dans `validateCode` doit filtrer `status IN ('active', 'trialing')` pour etre coherent avec le comportement accompagnant.

- **8.A.3 (cron confirm parrainages + recompense role parrain)** : peut lire `parrainages.marraine_id` -> JOIN `users.role` -> brancher la recompense (6 mois Stripe pour accompagne, 1 mois cumulable pour accompagnant). **Pas de migration.**
- **8.A.4 (tests integration)** : couvrira les 2 paths de parrainage. **Pas de migration.**

---

**Fin du rapport.** Verdict synthese : **GO sans migration BDD pour Epic 8.**
