---
story: 6.A.1
storyTitle: 'Architecture review + plan migration BDD residuel + composant + 121 ref TS'
epic: 6
miniEpic: 6.A
created: '2026-05-13'
status: 'draft v1 - en attente validation Sylvain'
inputDocuments:
  - epic-6.md
  - tech-spec-5-a-renommage.md
  - audit MCP BDD prod 2026-05-13 (re-run 6.A.1)
contraintes_techniques:
  postgres_version: '17.6'
  drop_enum_value_natif: false  # ALTER TYPE DROP VALUE 'not implemented' (erreur 0A000) en Postgres 17
decisionsActees:
  - F-Epic6-A1-a: embarquer rename accompagne_accompagnantes (table vide) dans 6.A.2
  - F-Epic6-A1-b: renommer toutes les contraintes BDD historiques (FK/PK/UNIQUE/CHECK)
  - F-Epic6-A1-c: migration directe en prod (fenetre hors heures), sans branche Supabase preview
  - F-Epic6-A1-d: pattern recreate-enum (DROP VALUE non implementee Postgres 17), reecriture colonne users.role 822 lignes
  - F-Epic6-A1-e: fix trigger handle_new_user obsolete dans la meme migration 6.A.2
---

# Tech-spec 6.A : Renommage BDD residuel + code (suite Epic 5)

## 1. Contexte et perimetre

**Suite Epic 5 (DECISIONS.md F12)** : Epic 5 a solde la couche enum + colonnes + helpers RLS + routes + libelles UI, mais a laisse 3 tables encore au feminin + une enum value orpheline + une fonction RPC orpheline (cf. tech-spec 5.A decisions D2 et D3). Epic 6 sold le residuel.

**Audit MCP BDD prod re-run 2026-05-13 (6.A.1)** : confirme l'inventaire epic-6.md avec deux corrections majeures :

1. **`ALTER TYPE ... DROP VALUE` n'est PAS implementee en Postgres 17** (test BEGIN/ROLLBACK -> `ERROR: 0A000: dropping an enum value is not implemented`). Il faut donc reprendre le **pattern recreate-enum** d'Epic 5 D2.
2. **Bug latent decouvert dans le trigger `handle_new_user`** : la fonction reference encore `'accompagnante'` et insere dans `accompagnantes_profiles`. Tout nouveau signup d'accompagnant depuis Epic 5 cutover devrait etre mal route (cf. section "Bug trigger handle_new_user" ci-dessous). Aucun cas observe en prod (0 signup accompagnant en 1 jour) mais **bug arme**.

### Inventaire factuel BDD prod

**Postgres** : **17.6** (confirme). `ALTER TYPE ... DROP VALUE` **non implementee** (Postgres ne l'a toujours pas a cette version) -> pattern recreate-enum obligatoire (cf. D4 ci-dessous).

**Enum `user_role`** :

| Valeur | enumsortorder | users actifs |
|---|---|---|
| `accompagnante` | 1 | 0 (orpheline) |
| `accompagnant` | 1.5 | 818 |
| `accompagne` | 2 | 3 |
| `admin` | 3 | 1 |

Le sortorder fractionnaire `1.5` confirme un `ALTER TYPE ADD VALUE BEFORE` historique Epic 5. Sans impact fonctionnel.

**3 tables a renommer** :

| Table actuelle | Lignes | Nouveau nom |
|---|---|---|
| `accompagnantes_profiles` | 818 | `accompagnants_profiles` |
| `annonces_accompagnantes` | 796 | `annonces_accompagnants` |
| `accompagne_accompagnantes` | 0 | `accompagne_accompagnants` |

**1 fonction RPC orpheline** : `get_or_create_conversation(p_accompagnante_id uuid, p_accompagne_id uuid) RETURNS uuid`. Audit code TS : 0 caller (jamais appelee depuis lib/messages, lib/conversation, etc.).

**11 policies RLS** (vs 10 annoncees dans epic-6.md) sur les 3 tables :

| Table | Policy | cmd |
|---|---|---|
| accompagnantes_profiles | aux_select_own | SELECT |
| accompagnantes_profiles | aux_insert_own | INSERT |
| accompagnantes_profiles | aux_update_own | UPDATE |
| accompagnantes_profiles | aux_delete_own | DELETE |
| accompagne_accompagnantes | Accompagnant reads own assignments | SELECT |
| accompagne_accompagnantes | Accompagne manages own team | ALL |
| accompagne_accompagnantes | Admins read all teams | SELECT |
| annonces_accompagnantes | ann_acc_select | SELECT |
| annonces_accompagnantes | ann_acc_insert | INSERT |
| annonces_accompagnantes | ann_acc_update | UPDATE |
| annonces_accompagnantes | ann_acc_delete | DELETE |

**Constat important** : les policies referencent `accompagnantes_profiles` en sous-query (`qual` / `with_check`), donc apres RENAME TABLE, **leur definition reste valide automatiquement** (Postgres conserve les references par OID, pas par nom). **Aucune recreation de policy n'est strictement necessaire fonctionnellement.**

Toutefois, la cosmetique (texte SQL des policies) reste obsolete. Decision D5 ci-dessous.

**Contraintes historiques (10 noms residuels)** :

| Type | Nom actuel | Table | Renommage cible |
|---|---|---|---|
| PK | `auxiliaires_profiles_pkey` | accompagnantes_profiles | `accompagnants_profiles_pkey` |
| UNIQUE | `auxiliaires_profiles_user_id_key` | accompagnantes_profiles | `accompagnants_profiles_user_id_key` |
| FK | `auxiliaires_profiles_user_id_fkey` | accompagnantes_profiles | `accompagnants_profiles_user_id_fkey` |
| FK | `auxiliaires_profiles_validated_by_fkey` | accompagnantes_profiles | `accompagnants_profiles_validated_by_fkey` |
| CHECK | `accompagnantes_profiles_completion_check` | accompagnantes_profiles | `accompagnants_profiles_completion_check` |
| CHECK | `accompagnantes_profiles_validation_source_check` | accompagnantes_profiles | `accompagnants_profiles_validation_source_check` |
| PK | `annonces_auxiliaires_pkey` | annonces_accompagnantes | `annonces_accompagnants_pkey` |
| FK | `annonces_auxiliaires_auxiliaire_id_fkey` | annonces_accompagnantes | `annonces_accompagnants_accompagnant_id_fkey` |
| PK | `beneficiaire_auxiliaires_pkey` | accompagne_accompagnantes | `accompagne_accompagnants_pkey` |
| UNIQUE | `beneficiaire_auxiliaires_beneficiaire_id_auxiliaire_user_id_key` | accompagne_accompagnantes | `accompagne_accompagnants_accompagne_id_accompagnant_user_id_key` |
| FK | `beneficiaire_auxiliaires_auxiliaire_user_id_fkey` | accompagne_accompagnantes | `accompagne_accompagnants_accompagnant_user_id_fkey` |
| FK | `beneficiaire_auxiliaires_beneficiaire_id_fkey` | accompagne_accompagnantes | `accompagne_accompagnants_accompagne_id_fkey` |

**FK externes pointant vers les 3 tables (renames transparents)** :

| Table referencante | Colonne | Table referencee | FK actuelle | Renommage cible |
|---|---|---|---|---|
| conversations | accompagnant_id | accompagnantes_profiles | `conversations_auxiliaire_id_fkey` | `conversations_accompagnant_id_fkey` |
| favoris | annonce_accompagnant_id | annonces_accompagnantes | `favoris_annonce_auxiliaire_id_fkey` | `favoris_annonce_accompagnant_id_fkey` |

Au total : **14 contraintes a renommer**.

### Bug trigger `handle_new_user` decouvert 2026-05-13 (6.A.1)

La fonction trigger sur signup `auth.users` :

```sql
CREATE FUNCTION public.handle_new_user() RETURNS trigger AS $$
DECLARE v_role public.user_role;
        v_role_text text;
BEGIN
  v_role_text := NEW.raw_user_meta_data->>'role';
  IF v_role_text IN ('accompagnante', 'accompagne') THEN
    v_role := v_role_text::public.user_role;
  ELSE
    v_role := 'accompagne'::public.user_role;
  END IF;
  INSERT INTO public.users (id, email, role, first_name, last_name) VALUES (NEW.id, NEW.email, v_role, ...);
  IF v_role = 'accompagnante' THEN
    INSERT INTO public.accompagnantes_profiles (user_id) VALUES (NEW.id);
  ELSE
    INSERT INTO public.accompagnes_profiles (user_id) VALUES (NEW.id);
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
```

**Probleme** : le code Epic 5 (`app/actions/auth.ts:20`) envoie `role = 'accompagnant'` (masculin neutre), mais le trigger attend `'accompagnante'` (feminin Epic 4-) dans son IF. **Tout signup accompagnant tombe dans le ELSE et finit comme `accompagne`**.

**Constat prod 2026-05-13** : 0 cas observe (aucun accompagnant n'a tente de s'inscrire depuis Epic 5 cutover du 2026-05-13 matin). 2 signups recents (`sylvainmalard87`, `guyonvarchnils3`) avaient intent `'accompagne'` -> correctement routes. **Mais bug arme** -> tirera au prochain signup accompagnant.

**Decision** : fixer le trigger dans la migration 6.A.2 (decision F-Epic6-A1-e). Pas de re-routing data necessaire (aucun user mal route).

## 2. Decisions strategiques

### Decision D1 : Strategie BDD = cutover atomique en une migration unique

**Choix retenu** : `apply_migration` unique transactionnelle qui execute :
1. Guard : verifier `users.role = 'accompagnante'` count = 0 (sinon ABORT).
2. RENAME des 3 tables (operation metadata, < 10 ms par table sur Postgres).
3. RENAME des 14 contraintes (operation metadata, < 5 ms par contrainte).
4. DROP + CREATE des 11 policies avec nouveau texte SQL (cosmetique cf. D5).
5. **Pattern recreate-enum** pour supprimer la valeur orpheline `'accompagnante'` (cf. D4) :
   - CREATE TYPE `user_role_v2 AS ENUM ('accompagnant','accompagne','admin')`
   - DROP les helpers RLS qui referencent `user_role` (`is_accompagnant`, `is_accompagne`)
   - ALTER TABLE users ALTER COLUMN role TYPE `user_role_v2` USING role::text::user_role_v2 (reecriture 822 lignes, ~100 ms)
   - DROP TYPE user_role + RENAME user_role_v2 -> user_role
   - CREATE les helpers RLS (corps inchange, type user_role natif)
6. Fix trigger `handle_new_user` (cf. D10) :
   - CREATE OR REPLACE FUNCTION handle_new_user avec `IF v_role_text IN ('accompagnant', 'accompagne')` + INSERT dans `accompagnants_profiles`.
7. `DROP FUNCTION get_or_create_conversation(uuid, uuid)` (orpheline, 0 caller).

**Justification** :
- Le seul cout non-metadata est l'ALTER COLUMN TYPE sur users.role (822 lignes, ~100 ms d'apres benchmarks Postgres standards).
- Cutover total estime **< 5 secondes** (pas < 1 sec comme initialement annonce car ALTER COLUMN TYPE reecrit la table).
- Toutes les operations sont transactionnelles : tout passe ou tout roule.

**Strategie expand-contract REJETEE** : aucun gain (operation atomique sur 822 lignes garde une fenetre acceptable, pas de risque applicatif si la migration tient en < 5 sec).

### Decision D2 : Sortir `accompagne_accompagnantes` du scope ? NON, embarquer (F-Epic6-A1-a)

**Choix retenu** : embarquer le rename de `accompagne_accompagnantes` dans 6.A.2.

**Justification** :
- Table vide (0 ligne) -> rename trivial.
- Coherence terminologique totale post-migration : zero residu feminin BDD.
- Evite de reporter une 4e story Epic 7 pour une operation triviale.
- Decision F-Epic6-A1-a actee 2026-05-13.

### Decision D3 : Renommer les contraintes historiques ? OUI tout (F-Epic6-A1-b)

**Choix retenu** : renommer les 14 contraintes (PK + UNIQUE + FK + CHECK).

**Justification** :
- Operation pure metadata, < 100 ms cumule.
- Cosmetique propre : `pg_dump` futur lit comme un schema coherent.
- Eclaircit le debug : un developpeur qui lit une erreur `auxiliaires_profiles_user_id_fkey violated` n'a pas a deviner qu'il s'agit de `accompagnants_profiles`.
- Aligne avec l'esprit Epic 6 = solder la dette terminologique residuelle.
- Decision F-Epic6-A1-b actee 2026-05-13.

### Decision D4 : Pattern recreate-enum pour supprimer la valeur orpheline (F-Epic6-A1-d)

**Choix retenu** : recreate-enum complet (CREATE TYPE v2 + ALTER COLUMN + DROP TYPE + RENAME). Pattern Epic 5 D2 reconductible.

**Justification** :
- **`ALTER TYPE user_role DROP VALUE 'accompagnante'` n'est PAS implementee en Postgres 17** (test BEGIN/ROLLBACK 2026-05-13 = `ERROR: 0A000: dropping an enum value is not implemented`). L'epic-6.md disait "verifier story 6.A.1" : verifie, ca ne marche pas.
- Une seule colonne typee `user_role` en BDD : `users.role` (verifie via `information_schema.columns WHERE udt_name = 'user_role'`). Donc le pattern reste contenu.
- 822 lignes a reecrire (`ALTER COLUMN TYPE` reecrit physiquement la table). Estimation < 200 ms sur Postgres 17 a froid.
- Le `users.role` n'a pas de DEFAULT (verifie). Pas besoin de gerer un default qui ferait reference au type.

**Sequence SQL complete** :

```sql
-- 0. Guard
DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM public.users WHERE role::text = 'accompagnante') THEN
    RAISE EXCEPTION 'Refus migration : au moins 1 user a encore role=accompagnante';
  END IF;
END $$;

-- 1. Creer le nouveau type sans la valeur orpheline
CREATE TYPE public.user_role_v2 AS ENUM ('accompagnant', 'accompagne', 'admin');

-- 2. Drop les fonctions qui referencent l'ancien type
--    (CASCADE de l'ALTER TYPE est imprevisible, on les recree explicitement)
DROP FUNCTION IF EXISTS public.is_accompagnant();
DROP FUNCTION IF EXISTS public.is_accompagne();
-- Note : is_admin() ne reference pas user_role dans son body (compare a 'admin' text)
-- mais il faut quand meme verifier que le body ne casse pas apres ALTER COLUMN TYPE.

-- 3. Reecrire la colonne users.role
ALTER TABLE public.users
  ALTER COLUMN role TYPE public.user_role_v2
  USING role::text::public.user_role_v2;

-- 4. Drop l'ancien type, rename le nouveau
DROP TYPE public.user_role;
ALTER TYPE public.user_role_v2 RENAME TO user_role;

-- 5. Recreer les helpers RLS (corps preserves a l'identique, cf. audit pg_get_functiondef 2026-05-13)
--    Note : is_accompagnant n'est PAS SECURITY DEFINER en prod (incoherence Epic 5 a signaler Epic 7+),
--    on preserve telle quelle pour eviter tout changement de comportement RLS.
CREATE FUNCTION public.is_accompagnant() RETURNS boolean LANGUAGE sql STABLE AS $$
  SELECT EXISTS (SELECT 1 FROM public.users WHERE id = auth.uid() AND role = 'accompagnant');
$$;
CREATE FUNCTION public.is_accompagne() RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER AS $$
  SELECT EXISTS (SELECT 1 FROM public.users WHERE id = auth.uid() AND role = 'accompagne');
$$;
```

**Verifications faites 2026-05-13 (6.A.1)** :
- **Aucune policy RLS ne reference `is_accompagnant()` ni `is_accompagne()` dans son qual/with_check** (verifie via `pg_policies WHERE qual LIKE '%is_accompagnant%' OR with_check LIKE '%is_accompagnant%'`). Donc le DROP FUNCTION est sans risque de CASCADE inattendu.
- **Aucune dependance dans pg_depend** sur ces fonctions. Recreation safe.
- `is_admin()` et `is_document_owner()` ne referencent pas `user_role` enum dans leur body (compare a `'admin'` text et joint sur `accompagnes_profiles`). Pas touchees par cette migration.

### Decision D5 : Recreation explicite des 11 policies (cosmetique)

**Choix retenu** : DROP + CREATE des 11 policies dans la migration, avec texte SQL mis a jour pour referencer les nouveaux noms de tables.

**Justification** :
- Fonctionnellement non strictement necessaire (les references sont par OID), mais le texte SQL stocke (`pg_policies.qual`, `pg_policies.with_check`) continuera d'afficher `accompagnantes_profiles` apres un simple RENAME TABLE.
- Recreer les policies aligne le texte SQL avec la realite. Audit `pg_policies` futur sera coherent.
- 1 policy `accompagne_accompagnantes."Accompagnant reads own assignments"` -> renommee `accompagne_accompagnants."Accompagnant reads own assignments"` (le NOM est deja correct, seul le tablename change).

**Renommage des noms de policies (cosmetique secondaire)** :
- Policies `aux_*` (4) -> `acc_*` ? **NON** retenu : `aux_*` reste lisible (auxiliaire = ancien terme metier), risque de churn excessif.
- Policies `ann_acc_*` (4) -> aucun changement (deja masculin).
- Policy `"Accompagnant reads own assignments"` -> deja au masculin.

Donc **0 renommage de nom de policy**, seulement DROP+CREATE pour rafraichir le texte SQL.

### Decision D6 : DROP FUNCTION RPC orpheline `get_or_create_conversation`

**Choix retenu** : `DROP FUNCTION public.get_or_create_conversation(uuid, uuid)`.

**Justification** :
- 0 caller TS (grep `get_or_create_conversation` dans le repo = 0 match).
- Code mort post-Epic 5 (la creation de conversations passe par insert direct dans `messages.ts`).
- Pas de re-activation prevue dans Epic 6+.

**Alternative rejetee** : renommer parametres `p_accompagnante_id -> p_accompagnant_id`. Reportee Epic 7+ uniquement si la fonction est reactivee.

### Decision D10 : Reecriture du trigger `handle_new_user` (F-Epic6-A1-e)

**Choix retenu** : `CREATE OR REPLACE FUNCTION public.handle_new_user()` dans la migration 6.A.2, avec :
- IF v_role_text IN (**'accompagnant'**, 'accompagne') (au lieu de `'accompagnante'`).
- INSERT INTO public.**accompagnants_profiles** (au lieu de `accompagnantes_profiles`).
- Default case (ELSE) inchange : route vers `accompagne` + `accompagnes_profiles`.

**Justification** :
- Bug latent decouvert 6.A.1 : tout signup avec `role = 'accompagnant'` envoye par le code Epic 5 tombe dans le ELSE du trigger -> route vers `accompagne` + `accompagnes_profiles`. **0 cas observe en prod 2026-05-13** (aucun signup accompagnant en 1 jour) mais bug arme.
- La migration 6.A.2 renomme `accompagnantes_profiles` -> `accompagnants_profiles`, donc le trigger actuel **se casserait immediatement** post-rename (insert dans une table inexistante).
- Fix indispensable au moment du cutover, pas optionnel.

**Body cible** :

```sql
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = 'public'
AS $function$
DECLARE
  v_role public.user_role;
  v_role_text text;
BEGIN
  v_role_text := NEW.raw_user_meta_data->>'role';

  IF v_role_text IN ('accompagnant', 'accompagne') THEN
    v_role := v_role_text::public.user_role;
  ELSE
    v_role := 'accompagne'::public.user_role;
  END IF;

  INSERT INTO public.users (id, email, role, first_name, last_name)
  VALUES (
    NEW.id,
    NEW.email,
    v_role,
    COALESCE(NEW.raw_user_meta_data->>'first_name', ''),
    COALESCE(NEW.raw_user_meta_data->>'last_name', '')
  );

  IF v_role = 'accompagnant' THEN
    INSERT INTO public.accompagnants_profiles (user_id) VALUES (NEW.id);
  ELSE
    INSERT INTO public.accompagnes_profiles (user_id) VALUES (NEW.id);
  END IF;

  RETURN NEW;
END;
$function$;
```

**Pas de re-routing data** : audit 2026-05-13 confirme 0 user mal route en prod (aucun user avec intent_role='accompagnant' et final_role='accompagne'). Les 2 signups recents (`sylvainmalard87`, `guyonvarchnils3`) avaient intent_role='accompagne' et sont correctement routes.

### Decision D7 : Validation directe en prod (pas de branche preview) (F-Epic6-A1-c)

**Choix retenu** : `apply_migration` directement sur la BDD prod, dans une fenetre hors heures de pointe.

**Justification** :
- Sur 5 etapes, 4 sont metadata DDL (sub-seconde). Seule l'etape 3 du pattern recreate-enum (`ALTER COLUMN TYPE` sur users.role) reecrit physiquement 822 lignes, estime < 200 ms.
- Postgres 17 garantit la transactionnalite DDL (tout passe ou tout roule).
- Pattern Epic 5 (cutover ~5 sec sur 822 users) deja eprouve sans branche preview, meme volumetrie.
- Snapshot pre-cutover (D8) + rollback explicite (D9) couvrent le risque residuel.
- Decision F-Epic6-A1-c actee 2026-05-13.

**Cutover total estime : < 5 secondes** (largeur). Pendant cette fenetre :
- ALTER TABLE pose un AccessExclusiveLock sur `users` -> tous les SELECT/INSERT/UPDATE sur users attendent.
- Les autres tables (accompagnants_profiles, etc.) sont rapidement renommees (metadata) -> SELECT en cours sur ces tables continuent jusqu'au commit.

**Fenetre cutover recommandee** : nuit (2h-6h heure FR) ou matin tres tot. **Pas un dimanche soir** (lecture admin frequente lundi matin).

### Decision D8 : Snapshot pre-cutover obligatoire

Avant `apply_migration` 6.A.2, executer et persister dans `_bmad-output/implementation-artifacts/snapshot-6-a-2-pre-cutover.md` :

```sql
-- 1. Snapshot enum
SELECT enumlabel, enumsortorder FROM pg_enum
WHERE enumtypid = 'user_role'::regtype
ORDER BY enumsortorder;

-- 2. Snapshot count users par role (doit montrer 0 accompagnante)
SELECT role, COUNT(*) FROM users GROUP BY role ORDER BY role;

-- 3. Snapshot count lignes 3 tables (verif rollback)
SELECT 'accompagnantes_profiles' AS tbl, COUNT(*) FROM accompagnantes_profiles
UNION ALL SELECT 'annonces_accompagnantes', COUNT(*) FROM annonces_accompagnantes
UNION ALL SELECT 'accompagne_accompagnantes', COUNT(*) FROM accompagne_accompagnantes;

-- 4. Snapshot definition des 11 policies (DDL replay-able)
SELECT
  'DROP POLICY IF EXISTS ' || quote_ident(policyname) || ' ON public.' || quote_ident(tablename) || ';' AS ddl_drop,
  policyname, tablename, cmd, qual, with_check
FROM pg_policies
WHERE schemaname = 'public'
  AND tablename IN ('accompagnantes_profiles','annonces_accompagnantes','accompagne_accompagnantes')
ORDER BY tablename, policyname;

-- 5. Snapshot contraintes (DDL replay-able)
SELECT conname, conrelid::regclass AS tbl, pg_get_constraintdef(oid) AS def
FROM pg_constraint
WHERE conrelid::regclass::text IN ('accompagnantes_profiles','annonces_accompagnantes','accompagne_accompagnantes')
   OR confrelid::regclass::text IN ('accompagnantes_profiles','annonces_accompagnantes','accompagne_accompagnantes')
ORDER BY conrelid::regclass::text, conname;

-- 6. Snapshot signature RPC orpheline
SELECT proname, pg_get_function_identity_arguments(oid) AS args,
       pg_get_functiondef(oid) AS body
FROM pg_proc
WHERE proname = 'get_or_create_conversation';

-- 7. Snapshot trigger handle_new_user + helpers RLS (pour rollback eventuel)
SELECT proname, pg_get_functiondef(oid) AS body
FROM pg_proc
WHERE proname IN ('handle_new_user','is_accompagnant','is_accompagne')
  AND pronamespace = 'public'::regnamespace;

-- 8. Snapshot dependances helpers (verifier absence de policies dependantes)
SELECT
  p.polname AS policy_name,
  c.relname AS table_name,
  pg_get_expr(p.polqual, p.polrelid) AS qual,
  pg_get_expr(p.polwithcheck, p.polrelid) AS with_check
FROM pg_policy p
JOIN pg_class c ON c.oid = p.polrelid
WHERE pg_get_expr(p.polqual, p.polrelid) LIKE '%is_accompagn%'
   OR pg_get_expr(p.polwithcheck, p.polrelid) LIKE '%is_accompagn%';
-- Si non-vide : recreer ces policies apres step 5 (CREATE helpers).
```

### Decision D9 : Plan rollback par mode de defaillance

**Mode 1 - DROP VALUE refuse (guard `accompagnante` count > 0)** :
- Cause : un user s'est inscrit avec role=accompagnante entre l'audit et la migration (improbable, frontend interdit, mais possible via insert direct ou race).
- Detection : exception levee par le DO block guard de la migration -> transaction rollback automatique.
- Rollback : aucun necessaire (transaction n'a rien commit). Investiguer la creation suspecte.
- Cout : 0.

**Mode 2 - RENAME TABLE lock contention** :
- Cause : une longue transaction tenait un AccessShareLock sur la table renomee.
- Detection : la migration timeout sur RENAME.
- Mitigation : lock_timeout = 5s dans la migration, retry manuel hors heures de pointe.
- Rollback : aucun (transaction rollback automatique).
- Cout : 5 minutes investigation + retry.

**Mode 3 - Policy recreation incorrecte** :
- Cause : erreur de copie SQL dans le DDL CREATE POLICY apres RENAME tables.
- Detection : tests integration paywall + queries applicatives apres cutover.
- Rollback : DROP les nouvelles policies + CREATE depuis snapshot pre-cutover (point 4 du snapshot D8) avec adaptation manuelle au nouveau tablename. **OU** revert via `apply_migration` d'une migration inverse (RENAME tables retour + restore policies originales).
- Cout : ~10 minutes.

**Mode 4 - Types Supabase regenerent une rupture TS massive non absorbee par 6.A.3** :
- Cause : 6.A.3 prevoit l'absorption mais une reference dynamique (template literal) peut echapper au typecheck.
- Detection : `npm run build` rouge en CI apres merge 6.A.3.
- Rollback : revert commit 6.A.3 cote code (BDD reste migree, pas de risque). Re-tenter 6.A.3 avec recherche plus large.
- Cout : ~5 minutes.

**Mode 5 - DROP FUNCTION casse un caller insoupconne** :
- Cause : un caller TS dynamique ou un caller hors-repo (Edge Function ?) appelle `get_or_create_conversation`.
- Detection : erreur runtime Sentry.
- Rollback : recreer la fonction via `apply_migration` depuis snapshot D8.6 (body persiste).
- Cout : ~5 minutes.

**Mode 6 - ALTER COLUMN TYPE echoue (recreate-enum step 3)** :
- Cause probable : une row a une valeur enum qui ne peut pas etre castee (improbable, guard step 0 verifie deja 0 ligne `accompagnante` et les 3 autres valeurs sont conservees dans v2).
- Detection : exception SQL pendant l'ALTER -> transaction rollback automatique.
- Rollback : aucun necessaire (transaction n'a rien commit). Investigation row pathologique via `SELECT id, role FROM users WHERE role::text NOT IN ('accompagnant','accompagne','admin')`.
- Cout : ~5 minutes investigation.

**Mode 7 - Trigger `handle_new_user` recree incorrectement** :
- Cause : erreur de copie SQL dans le CREATE OR REPLACE FUNCTION step 6.
- Detection : tout nouveau signup leve une exception (table `accompagnants_profiles` invalide, ou role invalide). Erreur Sentry "function handle_new_user failed".
- Rollback : `CREATE OR REPLACE FUNCTION handle_new_user` depuis snapshot D8.7 (body original preserved). Apres le rollback, le trigger reference de nouveau `accompagnantes_profiles` qui n'existe plus -> il faut SIMULTANEMENT rollback le RENAME TABLE OU pousser une 2e correction qui re-pointe le trigger vers la bonne table.
- Mitigation : prevoir un test post-migration immediat (`INSERT INTO auth.users` sandbox role accompagnant + verif route correcte).
- Cout : ~10 minutes.

**Migration de rollback complete** (a tenir prete dans `_bmad-output/implementation-artifacts/rollback-6-a-2.sql`) :

```sql
BEGIN;
-- Reverse RENAME tables
ALTER TABLE accompagnants_profiles RENAME TO accompagnantes_profiles;
ALTER TABLE annonces_accompagnants RENAME TO annonces_accompagnantes;
ALTER TABLE accompagne_accompagnants RENAME TO accompagne_accompagnantes;
-- Reverse RENAME constraints (14 ALTER ... RENAME CONSTRAINT ...)
-- ...
-- Restore enum value (irreversible si DROP VALUE a deja flush ; necessite ADD VALUE)
ALTER TYPE user_role ADD VALUE IF NOT EXISTS 'accompagnante' BEFORE 'accompagnant';
-- Restore RPC (depuis snapshot D8.6)
CREATE OR REPLACE FUNCTION public.get_or_create_conversation(p_accompagnante_id uuid, p_accompagne_id uuid)
RETURNS uuid LANGUAGE sql AS $$ /* body depuis snapshot */ $$;
COMMIT;
```

## 3. Plan execution stories 6.A.1 -> 6.A.5

### 6.A.1 (cette story)
- Livraison : ce tech-spec + DECISIONS.md F-Epic6-A1
- Pas d'impact code/BDD.

### 6.A.2 : Migration BDD
- Snapshot pre-cutover (D8) -> commit dans `implementation-artifacts/`
- `apply_migration` unique : RENAME tables + RENAME 14 contraintes + DROP+CREATE 11 policies + DROP VALUE enum + DROP RPC.
- Tests post-migration immediats :
  - `SELECT enumlabel FROM pg_enum WHERE enumtypid = 'user_role'::regtype` doit retourner exactement `[accompagnant, accompagne, admin]`.
  - `SELECT COUNT(*) FROM accompagnants_profiles WHERE 1=1` doit retourner 818.
  - Test RLS sample : `SET ROLE authenticated; SET request.jwt.claims = '{"sub":"<un_user_id>"}'; SELECT id FROM accompagnants_profiles LIMIT 1;` doit retourner correctement selon la policy.
- Commit `Story 6.A.2 : migration BDD residuel renommage accompagnante`.

### 6.A.3 : Regenerer types Supabase + alignement code TS
- `mcp__supabase__generate_typescript_types` -> overwrite `types/supabase.ts`.
- `npm run typecheck` -> attendu ~121 erreurs `accompagnantes_profiles`, `annonces_accompagnantes`, `accompagne_accompagnantes`, type alias `'accompagnante'`.
- Find-replace cible (avec git apply review) :
  - `accompagnantes_profiles` -> `accompagnants_profiles` (121 occ)
  - `annonces_accompagnantes` -> `annonces_accompagnants`
  - `accompagne_accompagnantes` -> `accompagne_accompagnants`
- `npm run typecheck` -> 0 erreur.
- `npm run build` -> succes.
- Commit `Story 6.A.3 : regen types + alignement 121 ref TS noms tables`.

### 6.A.4 : Type aliases + target_type log + libelles UI
- Type aliases : `type === 'accompagnante' | 'accompagne'` -> `type === 'accompagnant' | 'accompagne'` dans :
  - `lib/matching.ts` (15)
  - `lib/matching-notifications.ts` (10)
  - `app/actions/admin-annonces.ts`
  - `app/actions/favoris.ts`
  - `app/actions/annonces.ts` (12)
- `target_type: 'accompagnante'` dans admin_actions_log : 4 occurrences.
- Migration BDD complementaire : `UPDATE admin_actions_log SET target_type = 'accompagnant' WHERE target_type = 'accompagnante'` (decision Sylvain confirmee a l'execution 6.A.4 : aligner historique).
- Libelles UI : 250 occurrences a trier (libelles diplomes `accompagnante de vie`, `accompagnante en gerontologie` **preserves**, terminologie metier figee).
- `npm run a11y:axe:check` -> 0 violation Critical/Serious (baseline NFR6).
- Commit `Story 6.A.4 : type aliases + target_type log + libelles UI`.

### 6.A.5 : Renommage composant AccompagnanteDashboardHeader
- `git mv components/layout/accompagnante-dashboard-header.tsx components/layout/accompagnant-dashboard-header.tsx`
- Renommage export `AccompagnanteDashboardHeader` -> `AccompagnantDashboardHeader`.
- 13 fichiers importateurs : find-replace import path + symbole.
- `grep -rn AccompagnanteDashboard` -> 0 match attendu.
- `npm run typecheck`, `npm run build`, `npm run a11y:axe:check` -> verts.
- Commit `Story 6.A.5 : renommage composant AccompagnantDashboardHeader`.

## 4. Validation pre-cutover

### Validation automatique CI (pre-merge chaque story 6.A.X)

| Commande | Cible |
|---|---|
| `npm run typecheck` | exit 0 |
| `npm run lint` | baseline preservee |
| `npm run lint:a11y-check` | baseline 0 |
| `npm run a11y:axe:check` | 0 violation Critical/Serious |
| `npm run test` (unit) | 0 echec |
| `npm run test:integration` | 0 echec (6.B.1 prerequis : si tests integration paywall sont casses, ils sont fixes en 6.B.1 *avant* d'etre exiges verts ici) |
| `npm run build` | succes |

**Note dependance** : 6.B.1 (fix tests integration paywall) doit etre execute **avant** 6.A.3 OU **apres** 6.A.3 mais avant 6.A merge final, sinon CI rouge sur tests integration. Recommandation : 6.B.1 execute **apres 6.A.2 et avant 6.A.3** (necessite la BDD migree pour valider).

### Validation manuelle post-cutover 6.A.2

| Action | Verif |
|---|---|
| Login admin | OK (table users intacte) |
| Lecture liste auxiliaires admin | retourne 818 lignes |
| Lecture annonces publiques | retourne ~796 annonces publiees |
| Acces conversation existante | OK (FK transparente vers `accompagnants_profiles`) |
| Acces favoris existant | OK (1 favori, FK transparente vers `annonces_accompagnants`) |
| Inscription nouvel accompagnant (sandbox) | OK : `INSERT INTO auth.users` avec `raw_user_meta_data->'role' = 'accompagnant'` -> trigger insere dans `accompagnants_profiles` (PAS dans `accompagnes_profiles`). Critique : valide le fix F-Epic6-A1-e. |
| Inscription nouvel accompagne (sandbox) | OK : meme test avec `role = 'accompagne'` -> trigger insere dans `accompagnes_profiles`. |
| Publication annonce | OK (insert dans `annonces_accompagnants`) |
| `SELECT enumlabel FROM pg_enum WHERE enumtypid = 'user_role'::regtype` | retourne exactement `['accompagnant','accompagne','admin']` (plus de `'accompagnante'` orpheline) |

## 5. Budget temps estime

| Story | Estimation | Justification |
|---|---|---|
| 6.A.1 (cette story) | 0.5 j | Tech-spec + audit MCP + 2 corrections critiques (DROP VALUE non-impl + bug trigger) |
| 6.A.2 | 0.75 j | Migration BDD (recreate-enum + RENAME tables + fix trigger + snapshot etendu + tests post-cutover signup sandbox) |
| 6.A.3 | 0.75 j | Regen types + find-replace 121 + verif build |
| 6.A.4 | 1 j | Type aliases + 250 libelles UI a trier (preservation diplomes) |
| 6.A.5 | 0.25 j | Rename composant + 13 imports |
| **Total 6.A** | **3.25 j-dev** | Comparable a 6.A Epic 5 (Postgres 17 DROP VALUE non-impl confirme) |

## 6. Items hors scope 6.A (Epic 7+ ou DECISIONS.md)

- Renommage policies `aux_*` -> `acc_*` (D5) : reporte Epic 7 si volonte de coherence accrue.
- Suppression de `accompagnante` dans les commentaires/docstrings TS : decision execution 6.A.4 (a discretion).
- Renommage `is_accompagne()` (deja masculin, hors scope).
- Renommage des libelles diplomes `accompagnante en gerontologie` / `accompagnante de vie` : terminologie metier figee, **JAMAIS renommee**.

## 7. Acte DECISIONS.md (a creer end of 6.A.1)

Ajout dans DECISIONS.md des entrees F-Epic6-A1-a, F-Epic6-A1-b, F-Epic6-A1-c (avec contenu D2, D3, D7 ci-dessus).

## 8. Sorties de cette story

- Ce fichier `tech-spec-6-a-renommage.md` (livraison principale).
- 3 decisions ajoutees a `DECISIONS.md` (F-Epic6-A1-a/b/c).
- Commit `Story 6.A.1 : tech-spec renommage BDD residuel + decisions F-Epic6-A1`.
- Stories 6.A.2 a 6.A.5 prepares (suivent ce plan), peuvent demarrer apres validation Sylvain de ce tech-spec.
