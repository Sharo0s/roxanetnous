# Story 4.7 : Sync migrations historiques + seeds Supabase pour tests integration

Status: ready-for-dev

<!-- Note : Story repriorisee bloquante go-live ordre 1 le 2026-05-09 suite au blocage CI decouvert au premier run GHA workflow #25502322720 (story 4.4). Scope elargi vs cadrage initial epic-4.md (qui ne couvrait que les seeds) pour adresser la cause racine : 27 migrations historiques 2026-02-16 -> 2026-04-09 sont en prod mais ABSENTES du repo local. -->

## Story

En tant que **developpeur du projet roxanetnous**,
je veux **(1) recuperer les 27 migrations historiques manquantes du repo (rebuild_schema_tables, rebuild_rls_and_storage, planning_module, etc.) qui creent l'integralite du schema brownfield Epic 1 (signalements, users, accompagnantes_profiles, conversations, messages, subscriptions, parrainages_codes, etc.) en exportant leur SQL depuis `supabase_migrations.schema_migrations` de la BDD prod, (2) les commiter dans `supabase/migrations/` avec leurs noms reels (versions `20260216135538` -> `20260409212552`), (3) ajouter un dossier `supabase/seeds/` avec 4 fichiers SQL minimaux (5 utilisateurs roles distincts, 1 parrainage en cours, 1 parrainage bloque, 5 lignes waitlist) actives via `npm run seed:test`, (4) verifier que `supabase start` reussit sur cluster vierge avec l'historique complet via le workflow GHA `Integration Tests` deja en place (story 4.4)**,
afin de **(a) debloquer la CI integration tests de la story 4.4 (9/14 tests T1-T4 + T6-T10 actuellement bloques car `supabase start` crash sur la migration `drop_avis_feature` qui presume `signalements` existant), (b) lever la dette brownfield Epic 1 (schema initial jamais capture en migration formelle), (c) permettre toute future story qui touche au schema BDD de tourner contre un cluster vierge reproductible (preview env, runner CI, onboarding nouveau dev), (d) installer un dataset de tests stable pour les fixtures `tests/integration/_lib/fixtures.ts` (story 4.4 utilise actuellement des fixtures inline minimales D2)**.

C'est la **cinquieme story de l'Epic 4 « Hardening pre-go-live Bretagne »** et la **derniere ordre 1 bloquante go-live** (repriorisee le 2026-05-09 depuis l'ordre 2). Apres livraison de cette story + re-run vert du workflow GHA `Integration Tests` story 4.4, le toggle admin du premier departement Bretagne en production est autorise (cf. `epic-4.md` Definition de "Done" Epic 4 + sprint-status.yaml ligne 130).

Sequencage actuel : 4.1 done -> 4.2 done -> 4.3 done -> 4.4 review (5/14 verts) -> **4.7 (cette story)** -> re-run GHA 4.4 -> 4.4 done -> go-live Bretagne autorise.

Elle s'appuie sur les decouvertes du premier run GHA :

- **Run #25502322720 echoue au step `Start Supabase local stack`** : `ERROR: relation "public.signalements" does not exist (SQLSTATE 42P01)` au statement 1 de la migration `20260418135719_drop_avis_feature.sql`. Confirmation que le schema initial n'est pas reconstructible depuis le repo seul.
- **Inventaire MCP Supabase 2026-05-09** : 26 tables en prod (`users`, `accompagnantes_profiles`, `accompagnes_profiles`, `subscriptions`, `annonces_accompagnantes`, `annonces_accompagnes`, `favoris`, `conversations`, `messages`, `signalements`, `notifications_log`, `badges_cache`, `admin_actions_log`, `planning_subscriptions`, `accompagne_accompagnantes`, `planning_shifts`, `planning_documents`, `planning_document_assignments`, `planning_document_reads`, `parrainages_codes`, `parrainages`, `stripe_events_processed`, `rate_limit_tracker`, `departements_ouverts`, `waitlist_departements`). Aucune trace de `avis` (correctement supprime par `drop_avis_feature`).
- **Inventaire MCP migrations prod 2026-05-09** : 52 migrations en prod (`supabase_migrations.schema_migrations`). Le repo local `supabase/migrations/` n'en a que 25 (a partir de `20260418135719_drop_avis_feature.sql`). **27 migrations 2026-02-16 -> 2026-04-09 manquent du repo** :
  - `20260216135538_rebuild_schema_tables` (premier schema initial brownfield)
  - `20260216135615_rebuild_rls_and_storage`
  - `20260216145619_fix_handle_new_user_search_path`
  - `20260216181851_rename_diplome_to_diplomes_array`
  - `20260216185852_add_justificatif_permis_url`
  - `20260217110814_add_justificatif_cv_url`
  - `20260217115742_add_justificatifs_diplomes_jsonb`
  - `20260217173228_drop_ocr_results`
  - `20260218133036_add_unique_user_id_subscriptions`
  - `20260218135644_fix_annonces_auxiliaires_select_policy`
  - `20260218135804_fix_auxiliaires_profiles_select_policy`
  - `20260218143521_fix_users_select_policy`
  - `20260218162836_fix_beneficiaires_profiles_select_policy`
  - `20260219172516_add_disponible_and_last_seen_at`
  - `20260219172740_update_badges_cache_columns`
  - `20260225144855_planning_module`
  - `20260225191028_fix_planning_documents_rls_recursion`
  - `20260302145048_allow_public_read_annonces_auxiliaires`
  - `20260302145148_allow_public_read_auxiliaires_profiles_valides`
  - `20260306143933_add_indisponible_jusqu_au`
  - `20260306144911_enable_pg_cron_and_auto_disponible`
  - `20260306145555_remove_pg_cron_auto_disponible`
  - `20260402125323_rename_niveau_dependance_enum_values`
  - `20260404134919_rename_beneficiaire_auxiliaire_to_accompagne_accompagnante`
  - `20260405132254_add_cancel_feedback_to_subscriptions`
  - `20260409212552_add_avatar_url_to_users`
- **Pas de `supabase/seed.sql` ni `supabase/seeds/` en place** : les fixtures story 4.4 sont inline dans `tests/integration/_lib/fixtures.ts` (D2 story 4.4 : decouplage explicite). Cette story 4.7 ajoute des seeds **complementaires** non substituts (les fixtures inline restent souveraines pour les tests qui les utilisent ; les seeds servent les futures stories Epic 5+ qui auront besoin d'un dataset de demo).

**Le coeur de la story** :

- (a) **Recuperation des SQL historiques via Supabase MCP** : utiliser `mcp__supabase__execute_sql` pour interroger `SELECT version, name, statements FROM supabase_migrations.schema_migrations WHERE version < '20260418140024' ORDER BY version`. Cette requete retourne pour chaque migration manquante son tableau de statements SQL exacts. **Important** : les statements sont stockes en TEXT[] dans Postgres (un element par instruction SQL).
- (b) **Reconstruction des fichiers `.sql` locaux** : pour chaque migration recuperee, ecrire un fichier `supabase/migrations/{version}_{name}.sql` contenant les statements joints par `;\n`. Conserver les commentaires originaux si presents dans les statements. **Important** : ne PAS modifier le SQL meme si certains styles paraissent suspects (ex : guillemets doubles, fonctions sans search_path) — la prod tourne avec ces SQL, les recuperer tels quels garantit que `supabase start` reproduit fidelement l'etat prod.
- (c) **Verification de coherence** : apres ecriture des 27 fichiers, executer `supabase migration list --local` (ou equivalent) pour confirmer que les 52 migrations sont bien presentes dans le repo. Le diff entre `supabase migration list --remote` (prod) et `--local` doit etre vide.
- (d) **Seeds minimaux** : creer `supabase/seeds/01_users.sql` (5 users roles distincts), `supabase/seeds/02_parrainages.sql` (1 parrainage en cours + 1 bloque), `supabase/seeds/03_waitlist.sql` (5 lignes), `supabase/seeds/04_subscriptions.sql` (1 active + 1 expiree pour les tests T8/T9 paywall). Tous les seeds utilisent des UUID fixes (`'00000000-0000-0000-0000-00000000000X'`) pour reproductibilite cross-runs.
- (e) **Script `npm run seed:test`** : ajouter au `package.json` un script qui execute `psql "$SUPABASE_DB_URL" -f supabase/seeds/01_users.sql -f supabase/seeds/02_parrainages.sql -f supabase/seeds/03_waitlist.sql -f supabase/seeds/04_subscriptions.sql`. Optionnel : `npm run seed:test:reset` qui drop les seeds avant re-application (pour iteration locale).
- (f) **Workflow GHA mise a jour** : etendre `.github/workflows/integration-tests.yml` story 4.4 pour ajouter un step `npm run seed:test` apres `supabase start` et avant `npm run test:integration`. Les fixtures inline de story 4.4 continueront a creer leurs propres rows (cleanup tracker) ; les seeds 4.7 servent aux futures stories Epic 5+ qui voudront un etat BDD plus riche sans dupliquer les fixtures.
- (g) **Fix migration `drop_avis_feature`** : VERIFIER apres recuperation des migrations historiques que la migration `rebuild_schema_tables` cree bien `signalements` ET `avis`. Si la table `avis` n'a jamais ete creee en prod (donc absente de `rebuild_schema_tables`), alors `drop_avis_feature` est une migration **idempotente fictive** qui ne tournera plus jamais sur cluster vierge — **decision a prendre en Subtask 4.x** : (i) supprimer `drop_avis_feature` du repo (rejete : casse la chaine prod), (ii) la rendre idempotente avec `IF EXISTS` (deja le cas pour DROP CONSTRAINT et DROP TABLE, mais le DELETE et le ADD CONSTRAINT supposent la table) -> renforcer avec un guard `DO $$ BEGIN IF EXISTS (SELECT FROM information_schema.tables WHERE table_name='signalements') THEN ... END IF; END $$;` autour des operations.
- (h) **Validation finale** : push branche + trigger workflow `Integration Tests` -> `supabase start` doit passer + 14 tests verts (5 sans BDD smoke+T5 + 9 BDD T1-T4+T6-T10). Documenter dans la PR description le gain observable : commit story 4.4 (5/14) -> commit story 4.7 (14/14).

**Hors scope explicite** :

1. **Refactor des migrations historiques** : aucune modification du SQL recupere (pas de simplification, pas d'ajout de search_path, pas de re-ecriture des policies RLS). On commit fidelement.
2. **Migration vers `supabase db reset` workflow** : la commande `supabase db reset` reset la BDD locale + applique migrations + applique seed.sql. Cette story conserve le pattern actuel (`supabase start` + `npm run seed:test` separe) pour ne pas changer le workflow CI deja livre par 4.4.
3. **Couverture seeds exhaustive** : on cree uniquement les rows necessaires pour les 10 tests existants story 4.4 + futurs tests Epic 5+ raisonnables. Pas de seed pour les 26 tables, pas de fixtures pour `planning_*` (hors scope tests metier critiques).
4. **Synchronisation continue local <-> prod** : on capture l'etat 2026-05-09 mais on n'installe pas de garde CI qui detecte un drift futur (story Epic 5+ candidate).
5. **Modifications du schema prod** : zero `apply_migration` cette story. On lit la prod, on ecrit le repo, point.
6. **Suppression de `drop_avis_feature`** : on la garde et on la durcit (idempotence renforcee). Suppression hors scope.
7. **Documentation README `supabase/`** : un README court suffit (rappel `supabase start` + `npm run seed:test`). Pas de doc onboarding complete.
8. **Tests unitaires des seeds** : verifier que les seeds appliques retournent les bons compteurs SQL est suffisant. Pas de tests Vitest dedies.
9. **Modification config Supabase locale (`supabase/config.toml`)** : pas necessaire si le fichier existe deja avec port 54321 par defaut. Si absent, le creer minimal.

## Acceptance Criteria

### AC fonctionnels (debloquer CI 4.4 + cleanup brownfield)

1. **AC1 — 27 migrations historiques recuperees et commitees** : Given le repo `supabase/migrations/` contient actuellement 25 migrations (a partir de `20260418135719_drop_avis_feature.sql`), when la story est livree, then :
   - **27 nouveaux fichiers** dans `supabase/migrations/` couvrant les versions `20260216135538` -> `20260409212552` (liste exhaustive dans Story body section « Inventaire MCP migrations prod »).
   - **Contenu identique** au SQL retourne par `mcp__supabase__execute_sql 'SELECT version, name, statements FROM supabase_migrations.schema_migrations WHERE version < ''20260418140024'' ORDER BY version'`. Verification cross-check : `diff <(supabase migration list --remote --output csv) <(supabase migration list --local --output csv)` retourne 0 lignes differentes.
   - **Aucune modification** du SQL recupere : meme casse, meme ordre des statements, memes commentaires si presents. Si le SQL prod contient des warnings de style, on les conserve (sera traite Epic 5+).
   - **Total repo apres** : 52 fichiers `.sql` dans `supabase/migrations/` (alignement complet avec prod).

2. **AC2 — `supabase start` reussit sur cluster vierge** : Given le runner GitHub Actions (ubuntu-latest, sans Docker pre-rempli), when le workflow `Integration Tests` execute `supabase start`, then :
   - **Aucune erreur** de type `ERROR: relation "X" does not exist` lors de l'application des 52 migrations en sequence.
   - **Health check** `curl http://localhost:54321/auth/v1/health` retourne 200 dans la fenetre 60 s post-start.
   - **Capture du `service_role_key`** via `supabase status --output json | jq -r '.SERVICE_ROLE_KEY'` retourne une clef non-vide.
   - **Verification implicite** : le run GHA story 4.4 passe au step `Run integration tests` (anciennement bloque au step `Start Supabase local stack`).

3. **AC3 — 14 tests d'integration verts en CI** : Given les 27 migrations historiques + seeds + fixtures inline story 4.4, when le workflow `Integration Tests` execute `npm run test:integration`, then :
   - **14/14 tests verts** (5 smoke + T5 sans BDD deja verts en local + 9 T1-T4+T6-T10 desormais runables).
   - **Duree totale** workflow < 5 minutes (incluant pull Docker images Supabase).
   - **Cleanup BDD** : `SELECT count(*) FROM users WHERE email LIKE 'test-%@test.local'` retourne 0 apres run (verifie via `mcp__supabase__execute_sql` post-run sur staging local — ou simplement via une etape de check final dans le workflow).

4. **AC4 — Dossier `supabase/seeds/` cree avec 4 fichiers** : Given pas de dossier `supabase/seeds/` au moment du cadrage, when la story est livree, then :
   - **`supabase/seeds/01_users.sql`** : INSERT 5 lignes `users` avec UUID fixes :
     - `'00000000-0000-0000-0000-000000000001'` admin (`role='admin'`)
     - `'00000000-0000-0000-0000-000000000002'` accompagnante validee (`role='accompagnante'`)
     - `'00000000-0000-0000-0000-000000000003'` accompagne sans abonnement (`role='accompagne'`)
     - `'00000000-0000-0000-0000-000000000004'` marraine (`role='accompagnante'`, code parrainage en `parrainages_codes`)
     - `'00000000-0000-0000-0000-000000000005'` filleule (`role='accompagnante'`)
     - **Note** : auth.users equivalent doit etre cree via `supabase.auth.admin.createUser` au moment du seed (script wrapper, pas un INSERT SQL direct car auth.users a un trigger handle_new_user qui crash si bypass).
     - **Alternative** : `seeds/01_users.sql` cree uniquement les rows `public.users` (le trigger `handle_new_user` n'execute pas si on insere directement dans `public.users`). Ajouter `auth.users` via `supabase auth admin create` dans le script `npm run seed:test` (commandes shell composees).
   - **`supabase/seeds/02_parrainages.sql`** : INSERT 1 row `parrainages_codes` (code 'TESTSEED1' pour marraine UUID 4) + 2 rows `parrainages` :
     - 1 parrainage `statut='inscrite'` (marraine 4 + filleule 5)
     - 1 parrainage `statut='bloque'` + `blocage_raison='meme_carte'` (marraine 4 + filleule UUID factice 6)
   - **`supabase/seeds/03_waitlist.sql`** : INSERT 5 rows `waitlist_departements` avec emails `seed-waitlist-{1..5}@test.local`, departements `'29'`, `'22'`, `'35'`, `'56'`, `'29'` (Finistere x2 pour tester deduplication future).
   - **`supabase/seeds/04_subscriptions.sql`** : INSERT 2 rows `subscriptions` :
     - 1 active (user UUID 2, `status='active'`, `current_period_end = now() + 30 jours`)
     - 1 expiree (user UUID 3, `status='active'` + `current_period_end = now() - 1 jour`)
   - **Convention** : tous les fichiers commencent par `BEGIN;`, terminent par `COMMIT;`, utilisent des INSERT explicites (pas `COPY`), et sont idempotents via `ON CONFLICT DO NOTHING` quand applicable.

5. **AC5 — Script `npm run seed:test` operationnel** : Given le besoin de re-appliquer les seeds rapidement en local + CI, when la story est livree, then :
   - **`package.json`** ajoute :
     ```json
     "scripts": {
       "seed:test": "node scripts/seed-test-supabase.mjs",
       "seed:test:reset": "node scripts/seed-test-supabase.mjs --reset"
     }
     ```
   - **`scripts/seed-test-supabase.mjs` cree** : 
     - Lit `SUPABASE_URL` + `SUPABASE_SERVICE_ROLE_KEY` (defaults `http://localhost:54321` + valeur retournee par `supabase status --output json` si non set).
     - Cree les 5 users via `supabase.auth.admin.createUser` (avec UUID fixes via `id` parametre — supportee API auth admin v2.95+).
     - Execute en sequence les fichiers `01_users.sql`, `02_parrainages.sql`, `03_waitlist.sql`, `04_subscriptions.sql` via `psql "$SUPABASE_DB_URL"` ou via `supabase.rpc` si une RPC custom est definie.
     - Mode `--reset` : DELETE les rows seedees avant re-INSERT (FK-safe order, similaire a `cleanupAllFixtures` story 4.4).
   - **Garde-fou anti-prod** : refus categorique si `SUPABASE_URL` ne contient pas `localhost`/`127.0.0.1`. Pattern aligne sur `tests/integration/setup.ts` story 4.4 (D4).
   - **Verification** : apres `supabase start && npm run seed:test`, `mcp__supabase__execute_sql` (ou `psql`) `SELECT count(*) FROM users WHERE email LIKE 'seed-%@test.local'` retourne **5**.

6. **AC6 — Workflow GHA `integration-tests.yml` etendu** : Given le workflow story 4.4 a actuellement la sequence checkout + setup-node + npm ci + supabase/setup-cli + supabase start + wait health + capture key + npm run test:integration + supabase stop, when la story est livree, then :
   - **Nouveau step `Apply seeds`** ajoute apres `Capture Supabase service role key` et avant `Run integration tests` :
     ```yaml
     - name: Apply test seeds
       run: npm run seed:test
       env:
         SUPABASE_URL: http://localhost:54321
         SUPABASE_SERVICE_ROLE_KEY: ${{ steps.supabase-keys.outputs.service_role_key }}
     ```
   - **Verification** : run GHA complet passe vert avec les 14 tests + 0 leak de rows seedees post-run (cleanup automatique via `supabase stop --no-backup` qui detruit les containers).

7. **AC7 — Documentation `supabase/README.md` cree** : Given un nouveau dossier `supabase/seeds/` est introduit, when la story est livree, then :
   - **`supabase/README.md` cree** avec sections :
     - **Setup local** : `brew install supabase/tap/supabase`, `supabase start`, `npm run seed:test`.
     - **Architecture migrations** : explication de la migration brownfield (Epic 1 livre retroactivement, schema initial recupere via MCP 2026-05-09 dans cette story 4.7).
     - **Convention seeds** : UUID fixes (`'00000000-0000-0000-0000-00000000000X'`), pattern reset, garde-fou anti-prod.
     - **Troubleshooting** : `supabase start` echoue (`brew upgrade supabase`), `psql command not found` (utiliser `supabase db psql` alternatif), tests d'integration story 4.4 (`tests/integration/README.md`).
   - **Rappel coherence** : `supabase/migrations/` contient l'historique COMPLET prod, `supabase/seeds/` contient le dataset de tests reproductible. Distinction claire migration <-> seed.

8. **AC8 — DECISIONS.md F9 ajoutee** : Given cette story etablit un pattern transverse (sync migrations historiques + seeds), when la story est livree, then :
   - **Section datee 2026-05-09** ajoutee dans `DECISIONS.md` apres F8 (story 4.4), intitulee « Sync migrations historiques + seeds tests integration (decision F9) ».
   - **Contenu attendu** :
     - **Decision** : recuperer les 27 migrations brownfield via Supabase MCP, commit fidelement, ajouter dossier seeds.
     - **Motivation** : debloquage CI story 4.4 (run #25502322720) + dette Epic 1 leve.
     - **Alternatives rejetees** : ecrire une migration init synthetique (risque de divergence vs prod), staging cluster dedie tests (cout + complexite), skipper la migration `drop_avis_feature` (casse historique).
     - **Pattern interdit** : modifier le SQL des migrations historiques (pas de cleanup retroactif). Modifier le schema prod via `apply_migration` depuis cette story (zero migration prod).
     - **Regle** : toute future story qui touche au schema BDD doit (a) creer une migration formelle dans `supabase/migrations/` AVANT de modifier la prod, (b) verifier que `supabase start` reussit en local apres ajout, (c) pas de migration brownfield retroactive (l'epoque 2026-02 -> 2026-04 est figee).

### AC techniques (qualite et non-regression)

9. **AC9 — `supabase migration list` cross-check** : Given la prod a 52 migrations dans `supabase_migrations.schema_migrations` apres livraison, when la verification est executee, then :
   - **`supabase migration list`** local : 52 lignes.
   - **Diff prod vs local** : zero migration manquante d'un cote ou de l'autre. Test : `comm -3 <(supabase migration list --local --output csv | sort) <(supabase migration list --remote --output csv | sort)` retourne 0 lignes.

10. **AC10 — Pas de regression typage strict** : Given la convention projet (`tsconfig.json` strict mode + CLAUDE.md « pas de `as any` introduit »), when la story est livree, then :
    - **Aucun nouveau `as any`** dans le diff `*.ts/*.tsx` (la story est principalement SQL + scripts Node, mais le check standard est applique).
    - **`npx tsc --noEmit`** exit 0.
    - **Aucun `@ts-ignore` / `@ts-expect-error`** ajoute.

11. **AC11 — Build + lint + a11y verts** : Given les conventions projet (`npm run build`, `npm run lint`, `npm run lint:a11y-check`, `npm run a11y:axe:check`), when la story est livree, then :
    - **`SKIP_E2E_TESTS=true npm run build`** exit 0 (mode Vercel CI).
    - **`npm run lint`** : 0 nouvelles erreurs ESLint. Baseline ~227 warnings preservee.
    - **`npm run lint:a11y-check`** : exit 0, baseline 155 preservee.
    - **`npm run a11y:axe:check`** : exit 0, **0 violations Critical/Serious sur 7 parcours**. **Obligation absolue CLAUDE.md durcie**.
    - **`npm run check:env`** : exit 0.

12. **AC12 — Pas de modification UI** : Given cette story est strictement BDD/CI/scripts, when la story est livree, then :
    - **`git diff --stat`** ne touche AUCUN fichier `.tsx` cote `components/`, ni `app/(routes)`, ni les pages admin.
    - **DoD a11y** : N/A pour les sections UI mais lint + axe-core obligatoires (cf. AC11).

13. **AC13 — Periphrase des fichiers touches** : Given le scope est borne, when le diff est livre, then **strictement** les fichiers suivants sont attendus :
    - **Nouveaux fichiers** :
      - `supabase/migrations/20260216135538_rebuild_schema_tables.sql`
      - `supabase/migrations/20260216135615_rebuild_rls_and_storage.sql`
      - 25 autres fichiers migrations historiques (versions `20260216145619` -> `20260409212552`).
      - `supabase/seeds/01_users.sql`
      - `supabase/seeds/02_parrainages.sql`
      - `supabase/seeds/03_waitlist.sql`
      - `supabase/seeds/04_subscriptions.sql`
      - `supabase/README.md`
      - `scripts/seed-test-supabase.mjs`
    - **Fichiers modifies** :
      - `package.json` : ajout 2 scripts `seed:test*`.
      - `.github/workflows/integration-tests.yml` : ajout step `Apply test seeds`.
      - `DECISIONS.md` : ajout section F9.
      - `_bmad-output/implementation-artifacts/sprint-status.yaml` : story 4.7 ready-for-dev -> in-progress -> review.
      - `_bmad-output/implementation-artifacts/4-7-seeds-supabase-tests-integration.md` : checkboxes Tasks/Subtasks + Dev Agent Record + Change Log + DoD a11y.
    - **Total estimation** : 36 fichiers nouveaux + 5 fichiers modifies, ~3000 lignes ajoutees (essentiellement SQL recupere).

14. **AC14 — Verifications manuelles documentees dans la PR** : Given la dette est livree mais validee par re-run du workflow GHA, when la story est livree, then la PR contient une section « Verifications manuelles » listant :
    - (a) `supabase migration list --remote` retourne 52 lignes (idem local).
    - (b) Re-run du workflow GHA `Integration Tests` (sur la branche de la PR) -> 14 tests verts.
    - (c) `npm run seed:test` en local (apres `supabase start`) -> 5 users + 1 parrainage code + 2 parrainages + 5 waitlist + 2 subscriptions inseres.
    - (d) `npm run seed:test:reset` -> rows seedees nettoyees, comptage retombe a 0.
    - (e) Garde-fou anti-prod : `SUPABASE_URL=https://prod.supabase.co npm run seed:test` -> exit code != 0 + message `Refus d'executer contre prod`.
    - (f) Audit Vercel preview : build vert avec `SKIP_E2E_TESTS=true` (deja set dashboard 2026-05-09).
    - (g) `git diff --stat` aligne avec AC13 (~36 nouveaux + 5 modifies).
    - (h) Apres merge : Sylvain configure branch protection rule `Require status checks: integration-tests / integration` sur `main` (anciennement reportee).

## Tasks / Subtasks

- [ ] **Task 1 (AC: #1, #9, #13) — Recuperation des 27 migrations historiques via Supabase MCP**
  - [ ] Subtask 1.1 : Executer `mcp__supabase__execute_sql` avec query `SELECT version, name, statements FROM supabase_migrations.schema_migrations WHERE version < '20260418140024' ORDER BY version`. Stocker le retour JSON.
  - [ ] Subtask 1.2 : Pour chaque ligne retournee, ecrire un fichier `supabase/migrations/{version}_{name}.sql`. Le contenu est `statements.join(';\n') + ';'` (les statements sont dans un array Postgres TEXT[]).
  - [ ] Subtask 1.3 : Verifier coherence des noms : 27 fichiers attendus, noms strictement equivalents a `name` retourne par MCP (pas de typo, pas de transformation underscore).
  - [ ] Subtask 1.4 : Cross-check `supabase migration list --remote` vs `--local` : doit retourner 0 difference. Si la commande necessite `supabase login` + `supabase link`, le faire (ou utiliser le MCP pour comparer).

- [ ] **Task 2 (AC: #4, #13) — Creer dossier `supabase/seeds/` et 4 fichiers SQL**
  - [ ] Subtask 2.1 : Creer le dossier `supabase/seeds/`.
  - [ ] Subtask 2.2 : `01_users.sql` : INSERT 5 rows `users` avec UUID fixes (admin, accompagnante, accompagne, marraine, filleule). Pattern `BEGIN; INSERT ... ON CONFLICT (id) DO NOTHING; COMMIT;`.
  - [ ] Subtask 2.3 : `02_parrainages.sql` : INSERT 1 row `parrainages_codes` (code 'TESTSEED1') + 2 rows `parrainages` (1 inscrite + 1 bloque meme_carte).
  - [ ] Subtask 2.4 : `03_waitlist.sql` : INSERT 5 rows `waitlist_departements` avec emails `seed-waitlist-{1..5}@test.local` et 4 departements bretons distincts (29 x2, 22, 35, 56).
  - [ ] Subtask 2.5 : `04_subscriptions.sql` : INSERT 2 rows `subscriptions` (1 active future, 1 active expiree).

- [ ] **Task 3 (AC: #5, #13) — Script `scripts/seed-test-supabase.mjs` + scripts npm**
  - [ ] Subtask 3.1 : Creer `scripts/seed-test-supabase.mjs` (Node ESM, lit env vars, garde-fou anti-prod via check `SUPABASE_URL`).
  - [ ] Subtask 3.2 : Etape 1 du script : creer 5 users via `supabase.auth.admin.createUser({ id: '00000000-...-X', email: 'seed-X@test.local', password: 'seed-test-1234', email_confirm: true })`. Note : l'API auth admin v2.95+ supporte le param `id` UUID custom.
  - [ ] Subtask 3.3 : Etape 2 : executer les 4 fichiers SQL via `psql "$SUPABASE_DB_URL" -f ...` ou via le client `pg` Node en lecture/execution sequentielle. Privilegier `pg` pour eviter dependance externe `psql`.
  - [ ] Subtask 3.4 : Mode `--reset` : DELETE FK-safe order avant re-INSERT. Pattern aligne sur `cleanupAllFixtures` story 4.4 (`tests/integration/_lib/fixtures.ts`).
  - [ ] Subtask 3.5 : Ajouter `package.json` scripts `seed:test` et `seed:test:reset`.

- [ ] **Task 4 (AC: #2, #6) — Workflow GHA + verification supabase start**
  - [ ] Subtask 4.1 : Etendre `.github/workflows/integration-tests.yml` story 4.4 avec un step `Apply test seeds` (apres capture key, avant tests).
  - [ ] Subtask 4.2 : Verifier que `supabase start` reussit sur cluster vierge en CI : trigger workflow_dispatch sur la branche.
  - [ ] Subtask 4.3 : Si `supabase start` echoue toujours (ex : migration `drop_avis_feature` crash car `signalements` cree mais sans contrainte CHECK matching), rendre la migration plus idempotente via `DO $$ BEGIN ... EXCEPTION WHEN ... END $$;` wrapper. Documenter dans Dev Notes.
  - [ ] Subtask 4.4 : Verifier que les 14 tests passent dans le run GHA. Si echec : iterer (peut etre un fix de fixtures inline 4.4 si conflit avec seeds).

- [ ] **Task 5 (AC: #7, #13) — Documentation `supabase/README.md`**
  - [ ] Subtask 5.1 : Creer `supabase/README.md` avec sections Setup local, Architecture migrations, Convention seeds, Troubleshooting.

- [ ] **Task 6 (AC: #8) — DECISIONS.md F9**
  - [ ] Subtask 6.1 : Ajouter section dattee `## 2026-05-09 : Sync migrations historiques + seeds tests integration (decision F9)` apres F8 dans DECISIONS.md.
  - [ ] Subtask 6.2 : Contenu : decision (recuperer migrations brownfield via Supabase MCP), motivation (debloquage CI 4.4), alternatives rejetees (init synthetique, staging dedie, skip drop_avis_feature), patterns interdits (modifier SQL historique, apply_migration prod), regle pour futures stories (toute future story BDD doit creer migration formelle).

- [ ] **Task 7 (AC: #10, #11, #12) — Tests de non-regression**
  - [ ] Subtask 7.1 : `npx tsc --noEmit` -> exit 0.
  - [ ] Subtask 7.2 : `npm run lint` -> 0 nouvelles erreurs.
  - [ ] Subtask 7.3 : `npm run lint:a11y-check` -> baseline 155 preservee.
  - [ ] Subtask 7.4 : `npm run a11y:axe:check` -> 0 violations Critical/Serious sur 7 parcours.
  - [ ] Subtask 7.5 : `npm run check:env` -> exit 0.
  - [ ] Subtask 7.6 : `SKIP_E2E_TESTS=true npm run build` -> exit 0.
  - [ ] Subtask 7.7 : `git diff -- '*.ts' '*.tsx' | grep -E "as any|@ts-ignore|@ts-expect-error"` -> 0 match.

- [ ] **Task 8 (AC: #14) — Verifications manuelles + activation gate merge**
  - [ ] Subtask 8.1 : Section « Verifications manuelles » prete pour la PR description (points a-h AC14).
  - [ ] Subtask 8.2 : Apres merge story 4.7 + re-run workflow vert : Sylvain configure branch protection rule sur main (action manuelle reportee story 4.4).
  - [ ] Subtask 8.3 : Audit BDD post-run : `mcp__supabase__execute_sql 'SELECT count(*) FROM users WHERE email LIKE ''test-%@test.local'' OR email LIKE ''seed-%@test.local'''` -> 0 (cleanup robuste).

## Dev Notes

### Decisions de cette story

**D1 — Recuperation via Supabase MCP vs reconstruction synthetique** :
- **Considere** : (a) ecrire une migration init synthetique en lisant le schema prod via `pg_dump`, (b) recuperer les statements via `supabase_migrations.schema_migrations` MCP, (c) demander a Supabase Cloud de re-emettre l'historique CLI.
- **Rejete (a) `pg_dump`** : reconstitue l'etat final mais perd l'historique des migrations (52 ne deviennent qu'une grosse migration init). Casse la chaine de traceabilite : impossible de comprendre pourquoi telle policy RLS existe ou pourquoi telle colonne a ete renommee.
- **Rejete (c) Supabase CLI** : pas de commande native pour exporter une migration prod en fichier SQL local. La commande `supabase db pull` capture uniquement le schema final, pas l'historique.
- **Decision finale** : (b) Supabase MCP. La table `supabase_migrations.schema_migrations` contient `statements TEXT[]` qui est exactement le SQL applique a chaque migration. Lire et ecrire fidelement preserve l'historique.

**D2 — Seeds inline (story 4.4) vs seeds globaux (cette story)** :
- **Considere** : (a) deprecier les fixtures inline story 4.4 et tout migrer sur les seeds 4.7, (b) garder les 2 systems en parallele, (c) faire un wrapper qui appelle les seeds avant chaque test 4.4.
- **Rejete (a) Migration big-bang** : casse les tests T1-T10 deja livres (statut `review`). Refactor risque pour gain marginal.
- **Rejete (c) Wrapper** : ajoute couplage entre les 2 systems. Si un seed change, tous les tests 4.4 cassent.
- **Decision finale** : (b) Coexistence. Les fixtures inline 4.4 restent souveraines pour les 10 tests existants (controle precis row-by-row, cleanup tracker). Les seeds 4.7 servent les **futures stories Epic 5+** qui voudront un dataset stable (ex : tests UI dashboard avec annonces pre-existantes). Distinction documentee dans `supabase/README.md` AC7.

**D3 — UUID fixes seeds vs UUID generes** :
- **Considere** : (a) UUID fixes `'00000000-0000-0000-0000-00000000000X'`, (b) UUID generes par defaut (gen_random_uuid()), (c) UUID derives par hash deterministe.
- **Decision finale** : (a) UUID fixes. Permet les reset / re-runs reproductibles. Permet aussi aux tests futurs de hard-coder l'UUID admin pour tester un scenario specifique sans creer de fixture. Anti-pattern : utiliser ces UUID en prod (impossible car la prod a deja un set d'UUID, conflit IDempotency `ON CONFLICT DO NOTHING` ferait le bon choix mais on doit etre defensif).

**D4 — Garde-fou anti-prod via `SUPABASE_URL` check** :
- **Pattern aligne** sur story 4.4 `tests/integration/setup.ts` D4. Refus categorique si `SUPABASE_URL` ne contient pas `localhost`/`127.0.0.1`. Pas d'override possible (pas de `--force`). Si Sylvain veut un jour seeder un staging dedie, ce sera une autre story 4.7.b avec une whitelist explicite des hostnames staging.

**D5 — `auth.users` vs `public.users`** :
- **Probleme** : Supabase impose un trigger `handle_new_user` (cf. migration `20260216145619_fix_handle_new_user_search_path`) qui se declenche sur INSERT dans `auth.users` et tente de creer une row `public.users`. Si on insere d'abord `public.users` puis `auth.users`, conflit FK ou double insert.
- **Decision finale** : creer les 5 users via `supabase.auth.admin.createUser({ id: 'UUID', email: '...', password: '...' })`. L'API auth admin gere correctement le trigger : INSERT dans `auth.users` -> trigger declenche -> INSERT dans `public.users`. Eviter `INSERT INTO public.users` direct dans le seed SQL pour cette raison. Le seed `01_users.sql` traite uniquement la mise a jour de champs metier (`role`, `first_name`, `last_name`) **apres** que le trigger ait cree la row de base. Pattern : `UPDATE public.users SET role='...' WHERE id='UUID'` plutot que `INSERT`.

**D6 — Migration `drop_avis_feature` : faut-il la durcir ?** :
- **Question** : la migration `drop_avis_feature` execute `DELETE FROM public.signalements WHERE cible_type = 'avis'` et `ALTER TABLE public.signalements ADD CONSTRAINT signalements_cible_type_check CHECK (...)`. Sur cluster vierge, apres recuperation de `rebuild_schema_tables`, la table `signalements` existera. **Mais** la table `avis` aura-t-elle ete creee ?
- **Verification a faire en Subtask 1.x** : ouvrir le contenu retourne par MCP pour `rebuild_schema_tables` et chercher `CREATE TABLE public.avis`. Si presente -> migration brownfield correcte, `drop_avis_feature` tournera bien. Si absente -> il y a une 28e migration manquante quelque part, ou la table `avis` etait dans le schema initial Supabase (pre-migration) et a ete supprimee a la main. Si c'est ce dernier cas, durcir `drop_avis_feature` avec un guard `DROP TABLE IF EXISTS public.avis CASCADE` (deja le cas) + un guard sur `DELETE FROM public.signalements` via `WHERE cible_type = 'avis'` (qui ne fait rien si la valeur n'existe pas dans la CHECK constraint).

### Patterns deja en place (a reutiliser)

**Pattern garde-fou anti-prod** (`tests/integration/setup.ts:14-22`, story 4.4) :
```ts
if (
  supabaseUrl &&
  !supabaseUrl.includes('localhost') &&
  !supabaseUrl.includes('127.0.0.1')
) {
  throw new Error(`[seed-test] Refus categorique d'executer : SUPABASE_URL='${supabaseUrl}' n'est pas local.`)
}
```
**Reutiliser** dans `scripts/seed-test-supabase.mjs` au top-level.

**Pattern cleanup FK-safe** (`tests/integration/_lib/fixtures.ts:cleanupAllFixtures`, story 4.4) :
- Ordre : `messages -> conversations -> parrainages -> subscriptions -> admin_actions_log -> stripe_events_processed -> notifications_log -> accompagnantes_profiles -> accompagnes_profiles -> users` + balayage `auth.users.deleteUser(id)`.
- **Reutiliser** dans le mode `--reset` du script seed.

**Pattern workflow GHA** (`.github/workflows/integration-tests.yml`, story 4.4) :
- 8 steps actuels : checkout + setup-node + npm ci + setup-cli + supabase start + wait health + capture key + run tests + supabase stop.
- **Modification** : ajouter step `Apply test seeds` apres capture key.

### Risques connus

**Risque #1 : SQL recupere via MCP contient des caracteres speciaux problematiques** :
- Symptome : les statements stockes en TEXT[] pourraient contenir des `\n`, des quotes echappes, etc. Ecrire fidelement dans un `.sql` peut produire un fichier qui ne tourne pas tel quel.
- **Mitigation** : tester un fichier recupere via `psql -f` en local. Si echec, identifier le pattern specifique et appliquer un decodage minimal (ex : remplacer `\\n` par `\n` reel).

**Risque #2 : Une 28e migration cachee** :
- Symptome : meme apres recuperation des 27 migrations + ecriture, `supabase start` echoue toujours sur une autre relation.
- **Mitigation** : verifier que `SELECT count(*) FROM supabase_migrations.schema_migrations` en prod retourne bien 52 (pas 53+). Si plus, l'ajouter au scope.

**Risque #3 : `auth.users` ne supporte pas l'`id` parametre custom** :
- Symptome : `supabase.auth.admin.createUser({ id: '...', ... })` ignore le param et genere un UUID aleatoire.
- **Mitigation** : verifier la doc `@supabase/supabase-js@2.95.3` (version installee). Si non supporte, fallback : laisser l'API generer l'UUID puis UPDATE les rows seeds 02/03/04 pour referencer le vrai UUID. Pattern moins propre mais fonctionnel.

**Risque #4 : Workflow GHA expire (timeout 6h GitHub free tier)** :
- Symptome : `supabase start` + `npm run seed:test` + 14 tests prend > 5 min.
- **Mitigation** : non bloquant car le timeout free tier est 6h. Mais si > 5 min, ajouter un cache Docker pour les images Supabase via `actions/cache@v4`.

**Risque #5 : Conflit cleanup fixtures 4.4 vs seeds 4.7** :
- Symptome : `cleanupAllFixtures` story 4.4 utilise `email LIKE 'test-%@test.local'` pour le balayage final. Les seeds utilisent `seed-%@test.local` -> pas de conflit prefix. **Mais** si un test 4.4 cree un user avec email `test-X@test.local` ET la fixture 4.4 oublie le tracker -> cleanup peut effacer un user sans tracker mais epargner les seeds. Comportement attendu et correct.

### Architecture compliance

- **CLAUDE.md « pas d'emojis »** : zero emoji dans les nouveaux fichiers.
- **CLAUDE.md « DoD a11y »** : story strictement BDD/scripts, axe-core check obligatoire avant commit.
- **DECISIONS.md F4 (fail-loud)** : N/A (pas de runtime metier dans cette story).
- **DECISIONS.md F5 (idempotence BDD)** : pattern `ON CONFLICT DO NOTHING` dans tous les seeds pour permettre re-runs sans casse.
- **DECISIONS.md F8 (tests d'integration)** : seeds 4.7 + fixtures inline 4.4 coexistent. Distinction documentee README.

### References

- `_bmad-output/planning-artifacts/epic-4.md` Story 4.7 (lignes 271-294) : cadrage initial (seeds uniquement, scope etendu cette story).
- `_bmad-output/implementation-artifacts/4-4-tests-metier-stripe-webhook-paywall.md` : story dont le blocage CI motive cette story.
- `.github/workflows/integration-tests.yml` story 4.4 : workflow a etendre.
- `tests/integration/_lib/fixtures.ts` story 4.4 : pattern cleanup FK-safe a reutiliser.
- `tests/integration/setup.ts` story 4.4 : garde-fou anti-prod a reutiliser.
- `supabase/migrations/20260418135719_drop_avis_feature.sql` : migration qui crash en CI vierge, motivation directe.
- Run GHA #25502322720 (https://github.com/Sharo0s/roxanetnous/actions/runs/25502322720) : log d'echec source de verite.
- MCP Supabase `list_tables` 2026-05-09 : 26 tables prod, source de verite schema.
- MCP Supabase `list_migrations` 2026-05-09 : 52 migrations prod, source de verite historique.

### Project Structure Notes

- **Alignement** : nouveau dossier `supabase/seeds/` parallele a `supabase/migrations/`. Convention Supabase officielle.
- **Path aliases** : N/A (story SQL + scripts Node).
- **ESM** : `scripts/seed-test-supabase.mjs` aligne avec `"type": "module"`.

## Dev Agent Record

### Agent Model Used

(a remplir pendant l'implementation)

### Debug Log References

(a remplir pendant l'implementation)

### Completion Notes List

(a remplir pendant l'implementation)

### File List

(a remplir pendant l'implementation)

## DoD a11y

A renseigner pour toute story avec impact UI (ignorer si pas de changement visuel/interactif) :

- [x] Pas d'impact UI (story strictement BDD/scripts/CI). DoD a11y N/A sauf garde transverse :
- [ ] Pas de regression `eslint-plugin-jsx-a11y` (`npm run lint:a11y-check` vert en CI)
- [ ] Pas de regression axe-core (`npm run a11y:axe:check` vert ou delta documente avec justification dans la PR)
