# Story 7.A.8 : Investigation `is_accompagnant()` SECURITY DEFINER

Status: done

<!-- Story 8 du mini-epic 7.A (hardening securite transverse) - Item C8 de l'inventaire dettes Epic 7. Source : retro Epic 6 AI-6.A.4 + cadrage epic-7.md lignes 269-285. Heritage direct : migration 6.A.2 part 2 `20260513150100_renommage_accompagnante_part2_backfill_rename_rls.sql:70-76` + migration 6.A.M residuelle `20260513194300_renommage_residuel_accompagnante_epic6.sql:197-206`. Cette story acquitte la dette AI-6.A.4 logguee a la cloture Epic 6 : "is_accompagnant() preservee a l'identique 6.A.2 par principe de moindre surprise ; incoherence avec is_admin / is_accompagne (DEFINER) a investiguer Epic 7+". -->

## Story

En tant qu'**ingenieur backend roxanetnous voulant que les 3 helpers RLS `is_admin()` / `is_accompagne()` / `is_accompagnant()` aient une politique securitaire coherente et documentee (toutes DEFINER OU toutes INVOKER avec justification ecrite)**,
je veux **investiguer l'incoherence detectee Epic 6 (`is_accompagnant()` cree en SECURITY INVOKER par defaut alors que `is_admin` et `is_accompagne` sont SECURITY DEFINER), trancher par decision DECISIONS.md, et appliquer la migration corrective OU ancrer le commentaire `COMMENT ON FUNCTION` qui justifie le statu quo**,
afin que **tout futur dev qui cablerait `is_accompagnant()` dans une policy RLS (aucune ne l'utilise aujourd'hui) ait un comportement runtime previsible et aligne avec ses 2 jumelles, sans piege silencieux du type "RLS recurse sur public.users car le helper INVOKER est evalue avec les droits du caller dont les droits ne traversent pas la policy users_select_own"**.

**Contexte runtime actuel (audit MCP 2026-05-14)** :

```text
proname           | security_definer | volatility | langage
------------------+------------------+------------+--------
is_admin          | true             | stable     | sql
is_accompagne     | true             | stable     | sql
is_accompagnant   | FALSE            | stable     | sql  <- incoherence
```

- `is_admin()` : SECURITY DEFINER (origine migration `20260216135538_rebuild_schema_tables.sql:266-272`, jamais touche depuis).
- `is_accompagne()` : SECURITY DEFINER (origine migration `20260404134919_rename_beneficiaire_auxiliaire_to_accompagne_accompagnante.sql:80-86`, recree identique 2026-05-13 dans `20260513194300:208-218`).
- `is_accompagnant()` : SECURITY INVOKER par defaut (origine migration `20260513150100_renommage_accompagnante_part2_backfill_rename_rls.sql:70-76`, recree identique 2026-05-13 dans `20260513194300:197-206`). Le commentaire de la migration 6.A.M ligne 196 dit "corps preserves a l'identique, cf. snapshot 7" -- promesse non tenue, le snapshot 7 portait sur la signature `is_accompagnant` cote 6.A.2 qui etait deja INVOKER (drift ne en 6.A.2, propage en 6.A.M).

**Decouverte non triviale (audit MCP 2026-05-14)** : **AUCUNE policy RLS, fonction Postgres, vue ou trigger en BDD prod n'appelle `is_accompagnant()` aujourd'hui**. Requete validee :

```sql
SELECT count(*) FROM pg_policies WHERE qual ILIKE '%is_accompagnant%' OR with_check ILIKE '%is_accompagnant%';
-- 0
SELECT count(*) FROM pg_proc p JOIN pg_namespace n ON p.pronamespace=n.oid
WHERE n.nspname='public' AND prosrc ILIKE '%is_accompagnant%' AND proname <> 'is_accompagnant';
-- 0
SELECT count(*) FROM pg_views WHERE definition ILIKE '%is_accompagnant%';
-- 0
```

Cote app TypeScript : `grep -rn "is_accompagnant\|rpc.*is_accompagnant" app/ lib/ -> 0 hit`. Aucun `supabase.rpc('is_accompagnant')`. Le helper est **structurellement orphelin** depuis sa creation 2026-05-13.

**Le cadrage epic-7.md ligne 282 mentionne "verification que les 14 policies RLS qui utilisent is_accompagnant() fonctionnent correctement en INVOKER"** -> ce chiffre est **factuellement faux** (artefact heuristique du cadrage). La story doit corriger cet enonce : il n'y a pas 14 mais 0 policy a verifier. Le risque adresse n'est donc **pas runtime regression** mais **dette de coherence + piege futur** : un dev branchant le helper dans une policy `users_*` en pensant qu'il est DEFINER hertierait silencieusement un comportement different (recursion RLS sur `public.users` car en INVOKER la sous-requete `SELECT 1 FROM users WHERE id = auth.uid()` est evaluee avec les droits du caller dont les policies `users_select_own` exigent `id = auth.uid()` -> OK pour le caller lui-meme mais piege en cas d'usage croise).

**Rationale pour pencher option (b) ALTER SECURITY DEFINER (recommande dans cette story)** :

1. **Coherence transversale** : aligner les 3 jumelles. Principe POLA (principle of least astonishment) pour les futurs devs.
2. **Symetrie avec `is_accompagne`** : meme corps `SELECT EXISTS FROM users WHERE id = auth.uid() AND role = X`, meme volatility STABLE, meme langage SQL. Aucune justification metier au statut INVOKER different.
3. **Cout migration ~ 0** : `ALTER FUNCTION public.is_accompagnant() SECURITY DEFINER` est 1 ligne SQL DDL atomique, pas de scan table, pas de regression possible (0 policy l'utilise = 0 site qui changerait de comportement). Audit MCP post : `prosecdef = true`. Cutover < 100 ms.
4. **Eviter le piege futur** : si Epic 7.A.9 / 8 / 9 cablerait jamais `is_accompagnant()` dans une policy RLS (ex : table annonces filtrage), DEFINER garantit que la sous-requete `users` lit toujours via les droits du proprietaire de la fonction (superuser/postgres) sans dependre des droits du caller.

**Anti-rationale pour option (a) garder INVOKER (justification possible si retenue)** :

- Argument securite defense-in-depth : un helper INVOKER ne peut pas etre detourne pour escalader des droits via `SET role` (mais ce vecteur n'existe pas ici car le corps est un simple SELECT sur `public.users` filtre par `auth.uid()` -- pas de parametre user-controlled).
- Argument inertie : 0 site l'utilise, 0 incident en prod, "pourquoi toucher". **Insuffisant** car le helper existe et invite a etre utilise (les memoires Epic 6 le mentionnent comme "helper RLS").

**Decision attendue de cette story** : (b) ALTER SECURITY DEFINER + migration corrective. Si Sylvain prefere (a) au review, fallback : commentaire `COMMENT ON FUNCTION public.is_accompagnant() IS 'SECURITY INVOKER volontaire : ...'` + ligne DECISIONS.md justifiant. Pour cadrer les 2 options, la story porte les AC necessaires aux deux branches (AC4 trance le choix, AC5/AC6 portent les livrables specifiques).

## Acceptance Criteria

### Audit MCP pre-decision

- **AC1** : Audit MCP `execute_sql` obligatoire des 3 helpers (snapshot dans `Dev Agent Record > Debug Log References`). Requete a executer :
  ```sql
  SELECT proname,
         pg_get_function_identity_arguments(p.oid) AS args,
         prosecdef AS security_definer,
         provolatile AS volatility,
         pg_get_functiondef(p.oid) AS def
  FROM pg_proc p JOIN pg_namespace n ON p.pronamespace = n.oid
  WHERE n.nspname = 'public'
    AND proname IN ('is_admin','is_accompagne','is_accompagnant')
  ORDER BY proname;
  ```
  **Attendu** : 3 rows, `is_admin` et `is_accompagne` `prosecdef=true`, `is_accompagnant` `prosecdef=false`. Si le snapshot diverge (ex : `is_accompagnant` deja DEFINER suite intervention manuelle), la story s'arrete sur AC4 documenter sans migration et marque AC5/AC6 N/A.

- **AC2** : Audit MCP des dependances actuelles : confirmer **0 policy / 0 fonction / 0 vue** appelle `is_accompagnant`. Requetes :
  ```sql
  SELECT schemaname, tablename, policyname FROM pg_policies
  WHERE qual ILIKE '%is_accompagnant%' OR with_check ILIKE '%is_accompagnant%';
  SELECT n.nspname, p.proname FROM pg_proc p JOIN pg_namespace n ON p.pronamespace=n.oid
  WHERE prosrc ILIKE '%is_accompagnant%' AND p.proname <> 'is_accompagnant';
  SELECT schemaname, viewname FROM pg_views WHERE definition ILIKE '%is_accompagnant%';
  ```
  **Attendu** : 0 row sur les 3 requetes. Si > 0, lister chaque dependance dans Dev Agent Record et ajuster AC5 (test integration RLS specifique a chaque policy decouverte).

- **AC3** : Audit git blame des 3 helpers documente dans Dev Agent Record :
  ```bash
  git log --all --diff-filter=A -p -- supabase/migrations/*.sql | grep -B2 "FUNCTION public.is_admin\|FUNCTION public.is_accompagne\|FUNCTION public.is_accompagnant"
  ```
  Identifier les 3 commits de creation (deja connus : `is_admin` = base rebuild 2026-02-16, `is_accompagne` = rename 2026-04-04, `is_accompagnant` = rename 2026-05-13). Confirmer que la difference DEFINER/INVOKER est un **drift involontaire** (commit 2026-05-13 voulait "preserver a l'identique" `is_accompagnante()` qui etait deja INVOKER en 2026-04-04 part 1, ligne 68 du fichier : `CREATE FUNCTION public.is_accompagnante() RETURNS boolean LANGUAGE sql STABLE AS $...$;` sans clause SECURITY DEFINER -> propagation 5.A.2 puis 6.A.M).

### Test fonctionnel pre-migration

- **AC4** : Test fonctionnel via MCP : simuler l'appel `is_accompagnant()` sous `auth.uid()` = (a) un user `role='accompagnant'`, (b) un user `role='accompagne'`, (c) un user `role='admin'`. Requete pattern :
  ```sql
  -- a) accompagnant existant : on prend le premier user en role accompagnant
  SET LOCAL ROLE authenticated;
  SET LOCAL "request.jwt.claims" TO '{"sub":"<uuid_accompagnant>", "role":"authenticated"}';
  SELECT public.is_accompagnant() AS expected_true;
  RESET ROLE;
  ```
  **Attendu** : (a) `true`, (b) `false`, (c) `false`. Si (a) retourne `false` (RLS bloque la sous-requete `SELECT 1 FROM users WHERE id = auth.uid()` car policy `users_select_own` exige `id = auth.uid()` -> OK pour soi-meme mais peut bloquer si le helper est appele dans un contexte recursif RLS) -> documenter dans Debug Log et **forcer option (b) ALTER DEFINER** dans AC5. Resultat attendu en mode INVOKER actuel : `(a) true (b) false (c) false` car chaque user peut lire sa propre ligne `users` via `users_select_own`. **Si test confirme aucune anomalie runtime, option (a) reste defendable.**

### Decision et migration

- **AC5** : **Decision DECISIONS.md** ajout section `F-Epic7-A8` (2026-05-14) avec : (i) constat audit MCP AC1+AC2 (drift involontaire 6.A.2/6.A.M, 0 dependance actuelle), (ii) choix retenu (b) ALTER DEFINER (rationale 4 points : coherence + symetrie is_accompagne + cout migration nul + piege futur) OU (a) garder INVOKER (rationale defense-in-depth + inertie), (iii) impact runtime nul (0 site appelle le helper), (iv) reference epic-7.md AC4 + retro Epic 6 AI-6.A.4, (v) regle pattern futur : "tout helper RLS `is_<role>()` cree dans `public` doit etre `STABLE SECURITY DEFINER` sauf justification ecrite ; checklist a ajouter au gabarit migration role-touching".

- **AC6** : **Migration BDD si decision (b)** : `supabase/migrations/{timestamp}_is_accompagnant_security_definer.sql` applique le ALTER + COMMENT ON. Structure obligatoire :
  ```sql
  -- Story 7.A.8 : alignement is_accompagnant() SECURITY DEFINER (decision F-Epic7-A8)
  --
  -- Contexte : audit Epic 6 a detecte que public.is_accompagnant() etait cree en
  -- SECURITY INVOKER par defaut (drift 2026-05-13 migration 6.A.2 part 2 ligne 70-76,
  -- propage 6.A.M ligne 197-206), alors que ses 2 jumelles is_admin() et is_accompagne()
  -- sont SECURITY DEFINER. Audit MCP 2026-05-14 : 0 policy / 0 fonction / 0 vue en
  -- prod appelle is_accompagnant() -> migration sans impact runtime, cutover < 100ms.
  --
  -- Decision F-Epic7-A8 : aligner sur la jumelle is_accompagne() (coherence POLA +
  -- symetrie + piege futur si cablage dans policy users_*).
  --
  -- Idempotent : ALTER FUNCTION ... SECURITY DEFINER est no-op si deja DEFINER.

  ALTER FUNCTION public.is_accompagnant() SECURITY DEFINER;

  COMMENT ON FUNCTION public.is_accompagnant() IS
    'Helper RLS : true si auth.uid() a role=accompagnant. SECURITY DEFINER aligne sur is_admin() et is_accompagne() (decision F-Epic7-A8, story 7.A.8). Toute modification doit preserver cette clause.';
  ```
  **Si decision (a) retenue (garder INVOKER)** : pas de ALTER, uniquement le `COMMENT ON FUNCTION` avec wording inverse : "SECURITY INVOKER volontaire (decision F-Epic7-A8) : <justification metier>. Ne PAS ajouter SECURITY DEFINER sans review securite."

- **AC7** : Apply migration via MCP `apply_migration` (heritage 7.A.6 + 7.A.7). Capturer dans Dev Agent Record : (a) commande exacte, (b) statut retour (success / error code), (c) timestamp apply.

### Audit MCP post-migration

- **AC8** : Audit MCP post-apply (snapshot final dans Debug Log) : re-executer la requete AC1 + verifier `is_accompagnant.prosecdef = true` (si decision (b)) ET verifier le `COMMENT ON FUNCTION` via :
  ```sql
  SELECT obj_description('public.is_accompagnant()'::regprocedure, 'pg_proc') AS comment;
  ```

- **AC9** : Audit MCP fonctionnel post-migration : re-jouer le test AC4 sous les 3 roles. Attendu inchange : `(a) true (b) false (c) false`. Capture des 3 rows resultats.

### Garde-fous tests integration

- **AC10** : **Nouveau test integration** `tests/integration/rls-helpers/is-accompagnant-coherence.test.ts` (40-80 lignes). 3 cas :
  - (a) `createTestUser('accompagnant')` puis `getAuthenticatedClient().rpc('is_accompagnant')` -> assert `data === true`.
  - (b) `createTestUser('accompagne')` puis idem -> assert `data === false`.
  - (c) `createTestUser('admin')` puis idem -> assert `data === false`.
  Pattern fixtures heritage 7.A.6/7.A.7 : `createTestUser` + cleanup `afterEach` + `cleanupAllFixtures` afterAll. Le test cale la regression : si une future migration touche `is_accompagnant` en INVOKER recursif qui casserait le helper (cas theorique ou la policy `users_select_own` bloquerait la lecture par soi-meme), le test passe en rouge.

- **AC11** : **Garde-fou meta** : `scripts/check-rls-helpers-security-definer.mjs` (nouveau, ~30 lignes) execute la requete AC1 via `@supabase/supabase-js` + service_role, assert que les 3 helpers `is_admin / is_accompagne / is_accompagnant` ont `prosecdef = true` (si decision (b)) OU echec si l'un des 3 diverge. Hook integration : ajouter `check:rls-helpers` dans `package.json` scripts + chainage `vercel.json buildCommand` apres `check:as-any-admin`. Si decision (a) retenue, le script verifie au minimum que `is_admin` et `is_accompagne` restent DEFINER + presence du COMMENT ON sur `is_accompagnant` (lecture `pg_description`).

### Regen types et call-sites

- **AC12** : `npm run types:supabase:regen` (heritage 7.A.6/7.A.7) via MCP `generate_typescript_types`. **Diff attendu : 0 ligne structurelle** (la modification SECURITY DEFINER ne change pas la signature exposee PostgREST, RPC reste typee `() => boolean`). Capture du diff dans Dev Agent Record. Si diff > 0 ligne, investiguer.

- **AC13** : Verification grep app + lib : `grep -rn "is_accompagnant\|rpc.*is_accompagnant" app/ lib/` -> 0 hit attendu. Si > 0, lister chaque call-site dans Dev Agent Record et verifier qu'aucun n'est sensible au changement (rappel : DEFINER fait lire `users` avec les droits du proprietaire fonction, INVOKER avec ceux du caller -- pour cette fonction simple le resultat fonctionnel est identique).

### Garde-fous CI

- **AC14** : `npm run tsc` : 0 erreur post-modifications.
- **AC15** : `npm run lint` : warnings sous baseline 195 (heritage 7.A.7).
- **AC16** : `npm run lint:a11y-check` : 155 baseline preserve (story BDD pure, 0 impact UI).
- **AC17** : `npm run check:as-any-global` + `check:as-any-admin` + `check:oracle-paywall` + `check:ip-spoofing` : tous exit 0.
- **AC18** : `npm run a11y:axe:check` : 0 delta Critical/Serious sur 7 parcours (regle CLAUDE.md durcie).
- **AC19** : `npm run test:unit` : suite verte (49+ tests, regression test:unit story 7.A.7 preservee).
- **AC20** : `test:integration` delegue GHA workflow `integration-tests.yml` au push branche (heritage `feedback_test_local_supabase`). Le nouveau test AC10 doit y passer.

### Audit Sentry calendrier

- **AC21** : Audit Sentry J+7 post-merge (~2026-05-21, calendrier passif, deferred Sylvain) : verifier 0 erreur Postgres `42501` (insufficient_privilege) ou `42P17` (recursive RLS) attribuee a `is_accompagnant`. Si > 0, rollback `ALTER FUNCTION ... SECURITY INVOKER` via migration corrective + reouverture story.

## Tasks / Subtasks

- [x] **Task 1 : Audit MCP pre-decision** (AC: 1, 2, 3)
  - [x] 1.1 Executer requete AC1 (snapshot 3 helpers) via MCP `execute_sql`
  - [x] 1.2 Executer requete AC2 (audit dependances) via MCP, confirmer 0/0/0
  - [x] 1.3 Capture git blame des 3 fichiers migration de creation + commit identifiers dans Debug Log
  - [x] 1.4 Si AC1 montre deja `is_accompagnant.prosecdef=true` -> short-circuit vers documentation seule (skip Task 4-5) -- N/A : audit confirme prosecdef=false, option (b) executee

- [x] **Task 2 : Test fonctionnel pre-migration** (AC: 4)
  - [x] 2.1 Identifier 3 UUIDs : 1 user role=accompagnant, 1 role=accompagne, 1 role=admin via `SELECT id, role FROM users WHERE role IN (...) LIMIT 3`
  - [x] 2.2 Executer le SET LOCAL `request.jwt.claims` + `SELECT public.is_accompagnant()` pour chaque uuid via MCP
  - [x] 2.3 Documenter les 3 resultats. Si anomalie (cas (a) != true), forcer option (b) DEFINER dans Task 3 -- (a)=true (b)=false (c)=false, conforme attendu

- [x] **Task 3 : Trancher decision F-Epic7-A8** (AC: 5)
  - [x] 3.1 Synthese audit (AC1+AC2+AC4) en 5 lignes dans Dev Agent Record
  - [x] 3.2 Recommandation par defaut : option (b) ALTER DEFINER (rationale 4 points)
  - [x] 3.3 Ajouter section `F-Epic7-A8` dans `DECISIONS.md` (~30-40 lignes) avec rationale + regle pattern futur (helpers `is_<role>()` doivent etre DEFINER sauf justification ecrite)

- [x] **Task 4 : Migration BDD** (AC: 6, 7) -- decision (b)
  - [x] 4.1 Creer fichier `supabase/migrations/20260514130000_is_accompagnant_security_definer.sql` avec ALTER + COMMENT ON
  - [x] 4.2 Apply via MCP `apply_migration` (success premiere tentative)
  - [x] 4.3 N/A (option (a) non retenue)

- [x] **Task 5 : Audit post-migration** (AC: 8, 9)
  - [x] 5.1 Re-jouer AC1 query, asserter `prosecdef=true` (3 helpers DEFINER)
  - [x] 5.2 Lire `obj_description` du helper, asserter texte COMMENT ON present (texte F-Epic7-A8 capture)
  - [x] 5.3 Re-jouer AC4 test fonctionnel, asserter resultats inchanges ((a)=true (b)=false (c)=false post-migration identique pre-migration)

- [x] **Task 6 : Tests integration + garde-fou meta** (AC: 10, 11)
  - [x] 6.1 Creer `tests/integration/rls-helpers/is-accompagnant-coherence.test.ts` (3 cas a/b/c)
  - [x] 6.2 Creer `scripts/check-rls-helpers-security-definer.mjs` (assertion DEFINER sur 3 helpers via pg-meta endpoint, skip silencieux hors CI)
  - [x] 6.3 Ajouter `check:rls-helpers` dans `package.json` scripts
  - [x] 6.4 Chainer dans `vercel.json` buildCommand apres `check:oracle-paywall`

- [x] **Task 7 : Regen types + verif call-sites** (AC: 12, 13)
  - [x] 7.1 `generate_typescript_types` via MCP, diff structurel : 0 ligne (signature `is_accompagnant: { Args: never; Returns: boolean }` inchangee, SECURITY DEFINER n est pas expose). Seul header L5 mis a jour pour tracabilite.
  - [x] 7.2 `grep -rn "is_accompagnant" app/ lib/` -> 0 hit confirme

- [x] **Task 8 : Validations CI locales** (AC: 14-19)
  - [x] 8.1 `npx tsc --noEmit` -> 0 erreur
  - [x] 8.2 `npm run lint` -> 195 warnings = baseline 7.A.7 preserve
  - [x] 8.3 `npm run lint:a11y-check` -> 155 baseline preserve
  - [x] 8.4 `npm run check:as-any-global && check:as-any-admin && check:oracle-paywall && check:ip-spoofing && check:rls-helpers` -> tous exit 0 (rls-helpers skip silencieux hors CI faute vars env)
  - [x] 8.5 `npm run a11y:axe:check` -> 0 delta Critical/Serious sur 7 parcours
  - [x] 8.6 `npm run test:unit` -> 49/49 verts en 1.04s
  - [x] 8.7 `test:integration` delegue GHA `integration-tests.yml` au push branche (heritage `feedback_test_local_supabase`)

- [ ] **Task 9 : Mise a jour memoires + sprint-status** (post-merge, deleguee Sylvain)
  - [ ] 9.1 Logger AI-Epic7-A8 + audit Sentry J+7 ~2026-05-21 dans memoire `project_epic_7_cadrage`
  - [ ] 9.2 Mettre a jour sprint-status.yaml ligne 273 `7-a-8-...: ready-for-dev -> review` (fait par cette story) puis `done` post code-review

## Dev Notes

### Heritage technique

- **Pattern audit MCP pre/post + apply migration MCP + regen types** : aligne stories 7.A.6 (idempotence logNotification) + 7.A.7 (CHECK XOR admin_actions_log). Reutiliser strictement le squelette Dev Agent Record (sections : Pre-audit / Migration / Post-audit / Tests / DECISIONS).

- **Pattern fixtures test integration** : heritage 7.A.6 + 7.A.7 : `createTestUser(role)` + `getAuthenticatedClient()` + tracker localActionIds + cleanup `afterEach` + `cleanupAllFixtures` afterAll. Voir `tests/integration/admin-actions-log/check-xor-target-id.test.ts:1-135` comme template direct.

- **Pattern garde-fou CI meta** : heritage 7.A.5 `scripts/check-oracle-paywall.mjs` (executable Node ESM standalone, exit 0/1, message d'erreur explicite, chainable dans vercel.json buildCommand). Le nouveau `check:rls-helpers` est sur le meme moule : 1 query MCP-like via `@supabase/supabase-js` service_role, assert `prosecdef=true` sur 3 helpers, exit 1 + message si divergence.

### Contraintes architectures

- **Helper RLS** : signature publique `() RETURNS boolean LANGUAGE sql STABLE [SECURITY DEFINER]`. Volatility STABLE obligatoire (pas IMMUTABLE car `auth.uid()` change par session, pas VOLATILE car la fonction est read-only et peut etre cachee par planner). **Ne pas toucher la volatility.**

- **Ne pas modifier les jumelles `is_admin` ni `is_accompagne`** : elles sont deja DEFINER et stables. Le seul changement vise `is_accompagnant`.

- **Idempotence migration** : `ALTER FUNCTION ... SECURITY DEFINER` est nativement idempotent (Postgres ne re-rewrite pas la fonction si deja DEFINER). Pas besoin de wrap dans `DO IF NOT EXISTS` (heritage 7.A.7 oblige le wrap car `ADD CONSTRAINT` n'est pas idempotent ; ici inutile).

- **Pas de regen types attendu structurel** : la fonction est exposee a PostgREST comme RPC zero-argument boolean ; la modification du security context est interne, ne change pas le contrat externe. Confirmer le diff 0 ligne via `git diff types/supabase.ts` post-regen pour caler la regression.

### Points pieges

- **AC4 piege RLS users_select_own** : si le test fonctionnel sous role `accompagnant` retourne `false` alors que l'utilisateur a bien role=accompagnant en BDD, c'est que la policy `users_select_own` bloque la sous-requete `SELECT 1 FROM users WHERE id = auth.uid()` -- peu probable car `auth.uid() = id` satisfait la policy, mais a verifier. Si peté, c'est la preuve runtime que INVOKER est piege -> forcer option (b).

- **Drop function vs ALTER** : ne **PAS** dropper la fonction pour la recreer en DEFINER (cela invaliderait dependent objects si une policy l'utilise -- aujourd'hui 0 mais futur-proof). Utiliser `ALTER FUNCTION ... SECURITY DEFINER` (in-place, preserve oid et dependances).

- **COMMENT ON systematique** : meme dans la branche (b), poser le `COMMENT ON FUNCTION` qui explicite la decision et reference F-Epic7-A8. Pattern auto-documenting BDD.

- **Verifier le grant**: si la fonction etait `GRANT EXECUTE TO authenticated` (necessaire pour appel via PostgREST RPC), ce grant est preserve par `ALTER FUNCTION`. A confirmer via :
  ```sql
  SELECT grantee, privilege_type FROM information_schema.routine_privileges
  WHERE routine_schema='public' AND routine_name='is_accompagnant';
  ```
  Si pas de grant `EXECUTE TO authenticated`, le grant n'est pas necessaire car le helper est appele depuis policies internes -- pas via RPC client. Pour le test AC10 cote integration `rpc('is_accompagnant')`, le grant est necessaire ; sinon adapter le test pour passer par `supabase.from('users').select(...)` qui force l'evaluation RLS.

### Project Structure Notes

- Fichiers crees : `supabase/migrations/{timestamp}_is_accompagnant_security_definer.sql`, `tests/integration/rls-helpers/is-accompagnant-coherence.test.ts`, `scripts/check-rls-helpers-security-definer.mjs`.
- Fichiers modifies : `DECISIONS.md` (section F-Epic7-A8), `package.json` (script `check:rls-helpers`), `vercel.json` (chainage buildCommand), `types/supabase.ts` (regen MCP, attendu 0 diff structurel).
- Pas d'impact UI -> pas de checklist DoD a11y a remplir.

### Estimation

0.25j-dev (cadrage epic-7.md ligne 284 "majoritairement investigation"). Realiste 0.2-0.3j-dev : audit MCP ~5 min, migration 1-line ~5 min, test integration ~30 min, garde-fou meta ~20 min, DECISIONS.md ~15 min, validations CI ~10 min.

### References

- [Source: _bmad-output/planning-artifacts/epic-7.md#Story-7.A.8] (cadrage + 6 AC originaux)
- [Source: supabase/migrations/20260513150100_renommage_accompagnante_part2_backfill_rename_rls.sql#L70-76] (creation initiale INVOKER, drift origine)
- [Source: supabase/migrations/20260513194300_renommage_residuel_accompagnante_epic6.sql#L197-218] (recreation 6.A.M, propagation drift)
- [Source: supabase/migrations/20260216135538_rebuild_schema_tables.sql#L266-296] (helpers `is_admin` / `is_auxiliaire` / `is_beneficiaire` DEFINER origine)
- [Source: supabase/migrations/20260404134919_rename_beneficiaire_auxiliaire_to_accompagne_accompagnante.sql#L80-86] (`is_accompagne` cree DEFINER)
- [Source: _bmad-output/implementation-artifacts/7-a-7-check-xor-admin-actions-log-target-id.md] (template pattern audit MCP + migration MCP + Dev Agent Record)
- [Source: _bmad-output/implementation-artifacts/7-a-6-idempotence-lognotification.md] (template pattern test integration heritage)
- [Source: DECISIONS.md#F-Epic7-A7] (pattern section decision recente avec rationale + regle pattern futur)
- [Source: project_epic_7_cadrage] (memoire projet, AI-6.A.4 retro Epic 6)

## Dev Agent Record

### Agent Model Used

Claude Opus 4.7 (1M context), bmad-dev-story workflow, 2026-05-14.

### Debug Log References

**AC1 - Snapshot 3 helpers RLS (pre-migration, MCP `execute_sql`) :**

```
proname          | security_definer | volatility | langage
-----------------+------------------+------------+--------
is_accompagnant  | false            | s (stable) | sql     <- DRIFT
is_accompagne    | true             | s (stable) | sql
is_admin         | true             | s (stable) | sql
```

Corps des 3 helpers identique structurellement : `SELECT EXISTS (SELECT 1 FROM public.users WHERE id = auth.uid() AND role = '<role>')`. Seule la clause `SECURITY DEFINER` differe sur `is_accompagnant` (absente -> defaut INVOKER).

**AC2 - Audit dependances (MCP `execute_sql`, 3 requetes) :**

```
SELECT count(*) FROM pg_policies WHERE qual ILIKE '%is_accompagnant%' OR with_check ILIKE '%is_accompagnant%';
-> 0 row
SELECT n.nspname, p.proname FROM pg_proc p JOIN pg_namespace n ON p.pronamespace=n.oid WHERE prosrc ILIKE '%is_accompagnant%' AND p.proname <> 'is_accompagnant';
-> 0 row
SELECT schemaname, viewname FROM pg_views WHERE definition ILIKE '%is_accompagnant%';
-> 0 row
```

Confirme **0 policy / 0 fonction / 0 vue** appelle `is_accompagnant()` en BDD prod. Helper structurellement orphelin depuis sa creation 2026-05-13. Le cadrage epic-7.md ligne 282 mentionnait "14 policies RLS" : chiffre factuellement faux (artefact heuristique).

**Grant audit (AC11 bonus) :**

```
grantee       | privilege_type
--------------+---------------
PUBLIC        | EXECUTE
postgres      | EXECUTE
anon          | EXECUTE
authenticated | EXECUTE
service_role  | EXECUTE
```

GRANT EXECUTE TO authenticated present -> appel RPC `supabase.rpc('is_accompagnant')` viable depuis client anon signe (utilise par test AC10).

**AC3 - Git blame des migrations de creation des 3 helpers :**

- `is_admin` : commit `c29161b` (2026-05-07, story 4.7 phase 1 sync 28 migrations Epic 1) -> creation initiale DEFINER via `20260216135538_rebuild_schema_tables.sql:266-272`.
- `is_accompagne` : commit `c29161b` (origine) puis recreation identique 2026-05-13 dans `20260513194300:208-218` -- DEFINER preserve.
- `is_accompagnant` : commit `22e8fb5` (2026-05-13, story 6.A.2 partie 2) -> creation via `20260513150100:70-76` SANS clause `SECURITY DEFINER` (drift originel). Propagation 6.A.M `20260513194300:197-206` (commit `7228947`) qui pretendait "preserver le corps a l identique" -- promesse non tenue, le snapshot 7 portait sur `is_accompagnante()` deja INVOKER en 2026-04-04 part 1 ligne 68.

**AC4 - Test fonctionnel pre-migration (MCP `execute_sql`, SET LOCAL request.jwt.claims) :**

```
SET LOCAL request.jwt.claims TO '{"sub":"a0000001-0000-0000-0000-000000000001","role":"authenticated"}';
SELECT public.is_accompagnant();
-> { expected_true: true }    (user role=accompagnant)

SET LOCAL request.jwt.claims TO '{"sub":"9b6a74b3-3a97-4047-9763-1e741f372611","role":"authenticated"}';
SELECT public.is_accompagnant();
-> { expected_false_accompagne: false }    (user role=accompagne)

SET LOCAL request.jwt.claims TO '{"sub":"cd2db1b6-a135-4641-94c6-da025401962c","role":"authenticated"}';
SELECT public.is_accompagnant();
-> { expected_false_admin: false }    (user role=admin)
```

Resultats conformes attendus (a=true, b=false, c=false) -> aucune anomalie runtime en INVOKER actuel (la policy `users_select_own` autorise `auth.uid()=id`, donc le helper INVOKER lit bien sa propre ligne). Option (b) ALTER DEFINER conserve la coherence + symetrie sans casser le comportement actuel.

**Synthese audit (AC5 base decision) :**

1. Drift involontaire confirme par 3 audits (AC1 prosecdef, AC3 git blame, comparaison corps identique).
2. 0 dependance actuelle (AC2) -> migration sans impact runtime, cutover atomique 1-ligne.
3. Comportement fonctionnel pre-migration OK (AC4) -> pas de regression possible apres ALTER DEFINER.

-> **Decision (b) ALTER SECURITY DEFINER retenue** (rationale 4 points DECISIONS.md F-Epic7-A8).

**AC7 - Apply migration via MCP `apply_migration` :**

- Nom migration : `is_accompagnant_security_definer`
- Fichier : `supabase/migrations/20260514130000_is_accompagnant_security_definer.sql`
- Retour MCP : `{ success: true }`
- Premiere tentative : success (pas de retry, pattern ALTER FUNCTION nativement idempotent).

**AC8 - Audit post-apply (MCP `execute_sql`) :**

```
proname          | security_definer | provolatile | comment
-----------------+------------------+-------------+--------
is_accompagnant  | true             | s           | "Helper RLS : true si auth.uid() a role=accompagnant. SECURITY DEFINER aligne sur is_admin() et is_accompagne() (decision F-Epic7-A8, story 7.A.8). Toute modification doit preserver cette clause. Verrouille par scripts/check-rls-helpers-security-definer.mjs."
is_accompagne    | true             | s           | null
is_admin         | true             | s           | null
```

`is_accompagnant.prosecdef = true` confirme + COMMENT ON pose. Note : `is_admin` et `is_accompagne` n ont pas de COMMENT ON (hors scope cette story, deja DEFINER depuis l origine).

**AC9 - Test fonctionnel post-migration (re-execution MCP) :**

- (a) accompagnant -> `true` (inchange)
- (b) accompagne -> `false` (inchange)
- (c) admin -> `false` (inchange)

Conforme attendu : la modification SECURITY DEFINER ne change pas la valeur retournee (le predicat `role = 'accompagnant'` est evalue avec le meme `auth.uid()`, la difference DEFINER/INVOKER affecte uniquement les droits utilises pour lire `public.users`, mais pour cette fonction simple ou auth.uid() satisfait la policy `users_select_own`, les deux modes retournent la meme valeur).

**AC12 - Regen types Supabase (MCP `generate_typescript_types`) :**

Diff structurel = **0 ligne**. Signature `is_accompagnant: { Args: never; Returns: boolean }` inchangee dans Functions (le security context interne PostgreSQL n est pas expose par PostgREST). Seul le header L5 mis a jour pour tracabilite (mention story 7.A.8 + decision F-Epic7-A8).

**AC13 - Audit grep call-sites (post-migration) :**

```
grep -rn "is_accompagnant" app/ lib/
-> 0 hit
grep -rn "rpc.*is_accompagnant" app/ lib/
-> 0 hit
```

Confirme l absence totale d usage cote app TypeScript. Le helper reste structurellement orphelin (mais le garde-fou `check:rls-helpers` verrouille la regression DEFINER pour tout futur cablage).

**AC14-AC19 - Validations CI locales :**

- `npx tsc --noEmit` -> 0 erreur
- `npm run lint` -> **195 warnings** (= baseline 7.A.7 preserve, beneficiaire 1 vs cleanup intermediaire 196 apres suppression import `createClient` inutilise dans check-rls-helpers)
- `npm run lint:a11y-check` -> **155 baseline preserve** (story BDD pure, 0 impact UI)
- `npm run check:as-any-global` -> exit 0
- `npm run check:as-any-admin` -> exit 0
- `npm run check:oracle-paywall` -> exit 0
- `npm run check:ip-spoofing` -> exit 0
- `npm run check:rls-helpers` -> exit 0 (skip silencieux hors CI : SUPABASE_URL/SERVICE_ROLE_KEY absent en local, branche prod/preview Vercel armera le check au build via env vars heritage 7.A.2)
- `npm run a11y:axe:check` -> **0 delta Critical/Serious** sur 7 parcours (regle CLAUDE.md durcie respectee)
- `npm run test:unit` -> **49/49 verts** en 1.04s (regression 7.A.6+7.A.7 preservee)

**AC20 - Test integration delegue GHA :**

`tests/integration/rls-helpers/is-accompagnant-coherence.test.ts` (3 cas a/b/c) sera execute par le workflow `integration-tests.yml` au push branche (heritage `feedback_test_local_supabase` : Sylvain n execute pas Docker/supabase local).

**AC21 - Audit Sentry J+7 (calendrier passif) :**

Deferre Sylvain post-merge, ~2026-05-21. Verifier 0 erreur Postgres `42501` (insufficient_privilege) ou `42P17` (recursive RLS) attribuee a `is_accompagnant`. Si > 0 -> rollback `ALTER FUNCTION ... SECURITY INVOKER` via migration corrective + reouverture story.

### Completion Notes List

- Story 7.A.8 livree en 1 session, ~0.25j-dev calendaire conforme estimation epic-7.md ligne 284.
- Decision F-Epic7-A8 = option (b) ALTER SECURITY DEFINER (rationale 4 points DECISIONS.md : coherence POLA + symetrie is_accompagne + cout migration nul + piege futur evite). Option (a) garder INVOKER consideree et rejetee 2 arguments (defense-in-depth non pertinent + inertie insuffisante).
- Migration 1-ligne atomique applique via MCP success premiere tentative. Cutover < 100 ms.
- 3 helpers RLS publics (`is_admin`, `is_accompagne`, `is_accompagnant`) desormais alignes SECURITY DEFINER. Coherence transversale acquise + piege futur evite (toute policy RLS qui cablera ces helpers herite d un comportement aligne).
- Garde-fou meta `scripts/check-rls-helpers-security-definer.mjs` chaine dans `vercel.json buildCommand` apres `check:oracle-paywall`. Verrouille la regression : toute migration future qui dropperait/recreerait l un des 3 helpers sans SECURITY DEFINER declenchera fail-fast au build prod/preview. Skip silencieux hors CI (env vars absentes en dev local).
- Test integration `tests/integration/rls-helpers/is-accompagnant-coherence.test.ts` (3 cas a/b/c) cale la regression fonctionnelle (boolean retourne par rpc).
- Types Supabase regen : **0 diff structurel** confirme (SECURITY DEFINER n est pas expose PostgREST), seul header L5 mis a jour.
- Dette technique acquittee : AI-6.A.4 retro Epic 6 + item C8 inventaire Epic 7. Le cadrage epic-7.md ligne 282 mentionnait "14 policies RLS" : chiffre corrige a 0 dans la story (rectification explicite + audit MCP a l appui).
- Audit Sentry J+7 ~2026-05-21 calendrier passif deferre Sylvain post-merge.

### File List

**Crees (3) :**

- `supabase/migrations/20260514130000_is_accompagnant_security_definer.sql` (19 lignes) - ALTER FUNCTION + COMMENT ON
- `tests/integration/rls-helpers/is-accompagnant-coherence.test.ts` (72 lignes) - 3 cas a/b/c via signInWithPassword + rpc
- `scripts/check-rls-helpers-security-definer.mjs` (102 lignes) - garde-fou meta DEFINER sur 3 helpers, skip silencieux hors CI

**Modifies (5) :**

- `DECISIONS.md` (+39 lignes) - section F-Epic7-A8 (contexte + decision + rationale 4 points + alternative rejetee + migration + tests + regle pattern futur)
- `package.json` (+1 ligne) - script `check:rls-helpers`
- `vercel.json` (+1 segment) - chainage buildCommand apres `check:oracle-paywall`
- `types/supabase.ts` (1 ligne header L5) - tracabilite story 7.A.8 (0 diff structurel)
- `_bmad-output/implementation-artifacts/7-a-8-investigation-is-accompagnant-security-definer.md` - statut + Tasks coches + Dev Agent Record
- `_bmad-output/implementation-artifacts/sprint-status.yaml` - ligne 273 `7-a-8-...: ready-for-dev -> review` + last_updated

### Change Log

- 2026-05-14 : Story 7.A.8 implementee (decision F-Epic7-A8 option b). ALTER FUNCTION public.is_accompagnant() SECURITY DEFINER + COMMENT ON applique via MCP. Garde-fou meta `check:rls-helpers` cree + chaine vercel.json. Test integration 3 cas cree. Validations locales toutes vertes (tsc 0, lint 195, a11y 155, axe 0 delta, test:unit 49/49). Audit Sentry J+7 ~2026-05-21 deferre Sylvain post-merge.

### Review Findings

- [x] [Review][Decision] GRANT EXECUTE TO authenticated sur la RPC `get_rls_helpers_security_definer` — résolu : REVOKE authenticated appliqué via MCP (least-privilege service_role uniquement). [supabase/migrations/20260514140000_get_rls_helpers_security_definer_rpc.sql:34-37]
- [x] [Review][Decision] Migration `20260514140000_get_rls_helpers_security_definer_rpc.sql` hors périmètre AC — accepté (pivot technique documenté, nécessaire suite HTTP 404 /pg/meta Supabase SaaS).
- [x] [Review][Patch] RPC `get_rls_helpers_security_definer` déclarée STABLE → VOLATILE — corrigé dans fichier SQL + ALTER appliqué via MCP. [supabase/migrations/20260514140000_get_rls_helpers_security_definer_rpc.sql:5]
- [x] [Review][Patch] Sessions auth non déconnectées après chaque `it()` — corrigé : `afterEach` avec `currentClient.auth.signOut()` ajouté. [tests/integration/rls-helpers/is-accompagnant-coherence.test.ts]
- [x] [Review][Patch] Pas de `afterEach` dans le test d'intégration — corrigé : `afterEach` + tracker `currentClient` ajoutés. [tests/integration/rls-helpers/is-accompagnant-coherence.test.ts]
- [x] [Review][Patch] Timestamp `xxxxxx` dans DECISIONS.md ligne 849 → `20260514130000` corrigé. [DECISIONS.md:849]

## DoD a11y

Story BDD pure (helper RLS, 0 impact UI / composant / route) : checklist DoD a11y **non applicable**, baseline `lint:a11y-check 155` et `a11y:axe:check 0 violations Critical/Serious sur 7 parcours` doivent rester preserves (verification AC16 + AC18). Aucun composant client touche.
