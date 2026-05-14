# Story 7.A.7 : CHECK XOR sur `admin_actions_log.target_id` / `target_id_text`

Status: review

<!-- Story 7 du mini-epic 7.A (hardening securite transverse) - Item C7 de l'inventaire dettes Epic 7. Source : `deferred-work.md` ligne 175 (review story 3.5, 2026-05-07) + memoire `project_admin_actions_log_target_id_bug.md` (decouverte 2026-05-06 pendant cadrage story 3.5). Cadrage `epic-7.md` lignes 242-265. Heritage : story 3.5 (ajout colonne `target_id_text` via migration `20260506130000_admin_actions_log_target_id_text.sql` + refactor des 2 INSERT call-sites dpt/region) + DECISIONS.md F-Epic6-A1-b (renommage contraintes BDD historiques, pattern audit pre-migration MCP) + DECISIONS.md F5 (idempotence niveau BDD + invariants exprimes en CHECK quand applicable). Cette story termine la dette technique introduite volontairement en 3.5 : transformer le mutex applicatif `target_id` XOR `target_id_text` en invariant BDD verifie par Postgres. -->

## Story

En tant qu'**ingenieur backend roxanetnous voulant que l'invariant metier "chaque ligne admin_actions_log porte EXACTEMENT une reference cible (UUID ou TEXT)" soit garanti par la BDD plutot que par la discipline du code applicatif**,
je veux que **toute insertion future dans `admin_actions_log` qui violerait le mutex (target_id et target_id_text tous deux NULL, OU tous deux NOT NULL) soit rejetee par Postgres avec code SQLSTATE `23514` (check_violation)**,
afin que **les futurs flows admin qui logguent une nouvelle action (ex : nouveau type d'identifiant non-UUID slug/code/region) ne puissent pas regresser silencieusement et corrompre l'audit trail conformite art. 5.1.f RGPD (integrite), comme l'aurait fait `toggleDepartement`/`toggleRegion` sans le fix 3.5 D1**.

**Contexte runtime du foot-gun cible** : aujourd'hui (post-3.5), le schema BDD `admin_actions_log` est :
- `target_id UUID NOT NULL` (lignes historiques exigent un UUID, contrainte preservee pour les 85 rows prod).
- `target_id_text TEXT NULL` (colonne ajoutee 2026-05-06 par migration `20260506130000_admin_actions_log_target_id_text.sql` pour absorber les identifiants non-UUID type `code_departement`).
- **Mutex APPLICATIF UNIQUEMENT** : aucun CHECK BDD ne force l'exclusion mutuelle. Le commentaire de la migration 3.5 cite explicitement "Pas de CHECK BDD du type `(target_id IS NULL) <> (target_id_text IS NULL)` car les lignes historiques ont `target_id NOT NULL` et un CHECK retroactif les invaliderait." -> dette technique reconnue, planifiee pour resorption Epic 4+ (cf. memoire `project_admin_actions_log_target_id_bug` ligne 19-20).
- Les 2 call-sites `app/admin/departements/actions.ts:88-95` (`toggleDepartement`) et `:162-169` (`toggleRegion`) inserent `target_id: null, target_id_text: code|region`. **MAIS** la colonne `target_id` est toujours declaree NOT NULL en BDD ! Le code TypeScript fonctionne car le type `Insert.target_id: string` du types/supabase.ts genere refuse `null` au compile-time -> les 2 call-sites passent `target_id: null` qui est rejete par TS strict (cast force via `as`), runtime BDD attendrait un NOT NULL violation 23502.

**Bug latent fundamentalement different du fix 3.5** : la mémoire `project_admin_actions_log_target_id_bug` indique "Le bug n'a jamais ete declenche. Story 3.5 va l'exercer la premiere fois (toggle reel d'un dpt hors-Bretagne pour declencher la notification waitlist)". Audit MCP BDD prod 2026-05-14 confirme : **0 ligne avec `action_type LIKE 'departement_%' OR action_type LIKE 'region_%'`** (les 5 dpt Bretagne ont ete seedes directement par migration `20260502120000_departements_ouverts`, pas via toggle admin). Le code path `target_id: null` n'a JAMAIS ete exerce en prod, donc l'erreur `23502 not_null_violation` n'a jamais peté. Story 7.A.7 ferme deux trous a la fois :
1. **Trou actuel : `target_id NOT NULL` interdit `target_id: null`** -> 2 call-sites dpt/region planteraient au runtime au premier toggle reel (ex : Sylvain ouvre le 75 hors-Bretagne pour debloquer la waitlist visiteurs Paris en 2026-09).
2. **Trou futur : pas de CHECK XOR BDD** -> un futur call-site mal ecrit pourrait shipper `target_id: <uuid>, target_id_text: <code>` (les deux NOT NULL) ou `target_id: null, target_id_text: null` (les deux NULL) sans alerte BDD, corrompant l'audit trail.

**Audit MCP BDD prod 2026-05-14 (etat actuel + risque cutover)** :
- 85 rows total dans `admin_actions_log`.
- **100% des rows : `target_id IS NOT NULL` ET `target_id_text IS NULL`** (validation par requete `WHERE (target_id IS NULL) = (target_id_text IS NULL) -> 0 row`).
- Type de schema : `target_id UUID NOT NULL`, `target_id_text TEXT NULL` (confirme via `information_schema.columns`).
- Constraints existantes : `admin_actions_log_pkey` (PK id) + `admin_actions_log_admin_id_fkey` (FK admin_id -> users.id ON DELETE CASCADE). **Aucun CHECK pre-existant.**
- Indexes : aucun (sauf PK implicite). Pas besoin d'ajouter d'index pour cette story.
- 14 distinct action_types historiques : `consultation_profil` (32), `consultation_justificatif` (25), `suppression_utilisateur` (10), `valide` (3), `a_completer` (2), `parrainage_bloque` (2), `parrainage_flag` (2), `parrainage_fraude_confirmee` (2), `visio_planifiee` (2), `annulation_abonnement` (1), `grant_subscription` (1), `parrainage_debloque_par_validation` (1), `validation_par_parrainage` (1), `visio_realisee` (1). **Tous portent un UUID** (user_id, profile_id, parrainage_id, subscription_id, signalement_id, annonce_id).
- **0 row dpt/region** -> migration NOT VALID + VALIDATE CONSTRAINT applicable sans backfill, cutover < 1 seconde.

**Difference avec stories voisines** : 7.A.6 a livre le partial UNIQUE INDEX `notifications_log` (idempotence) ; cette story livre le CHECK XOR `admin_actions_log` (integrite mutex). Patterns alignes : audit MCP pre-cutover, migration apply MCP, regen types/supabase.ts, tests integration capture code Postgres erreur. **Le helper applicatif `logNotification` n'a pas d'equivalent pour `admin_actions_log`** : les 29 call-sites insert direct (cf. `grep -rn admin_actions_log app/ lib/`) restent inchanges par cette story ; le CHECK XOR cote BDD est le filet de securite trans-call-sites. Une future story pourrait centraliser `logAdminAction` sur le modele F6 mais c'est hors scope explicit.

## Acceptance Criteria

### Audit MCP BDD prod pre-cutover

- **AC1** : Audit MCP `execute_sql` pre-migration obligatoire (heritage `AI-6.M.3` + pattern 7.A.6 AC3). Requete a executer et snapshot complet a capturer dans `Dev Agent Record > Debug Log References` :
  ```sql
  -- Audit 1 : count cible (doit retourner 0 pour activer la migration safe).
  SELECT COUNT(*) AS rows_violant_xor
  FROM public.admin_actions_log
  WHERE (target_id IS NULL) = (target_id_text IS NULL);

  -- Audit 2 : repartition des rows pour traçabilite (doit donner 100% uuid_only sur etat actuel).
  SELECT
    COUNT(*) AS total,
    COUNT(*) FILTER (WHERE target_id IS NULL AND target_id_text IS NULL) AS les_deux_null,
    COUNT(*) FILTER (WHERE target_id IS NOT NULL AND target_id_text IS NOT NULL) AS les_deux_set,
    COUNT(*) FILTER (WHERE target_id IS NOT NULL AND target_id_text IS NULL) AS uuid_only,
    COUNT(*) FILTER (WHERE target_id IS NULL AND target_id_text IS NOT NULL) AS text_only
  FROM public.admin_actions_log;

  -- Audit 3 : sample 5 rows pour reference humaine.
  SELECT id, action_type, target_type, target_id, target_id_text, created_at
  FROM public.admin_actions_log
  ORDER BY created_at DESC LIMIT 5;
  ```
- **AC2** : **PRECONDITION DE LA MIGRATION** : `rows_violant_xor` AC1 doit retourner **0**. Si > 0 (ex : un toggle dpt/region a finalement ete execute entre 2026-05-06 et l'apply de cette story), la story doit s'arreter et logger un candidat backfill dans `deferred-work.md` AVANT de toucher au schema. Audit 2026-05-14 confirme `rows_violant_xor = 0` (uuid_only = 85 = total), cutover safe.

### Migration BDD - CHECK XOR via NOT VALID + VALIDATE pattern

- **AC3** : Migration SQL `supabase/migrations/{timestamp}_admin_actions_log_target_id_xor_check.sql` declare le CHECK XOR via pattern `NOT VALID + VALIDATE`. Structure obligatoire :
  ```sql
  -- Story 7.A.7 : CHECK XOR target_id / target_id_text (decision F-Epic7-A7)
  --
  -- Contexte : story 3.5 a ajoute target_id_text (code TEXT) pour absorber les identifiants
  -- non-UUID (toggleDepartement/toggleRegion). Mutex applicatif uniquement (cf. commentaire
  -- migration 20260506130000_admin_actions_log_target_id_text.sql L15-17). Aucun CHECK BDD
  -- n empechait un futur call-site de shipper (target_id NULL ET target_id_text NULL) OU
  -- (target_id NOT NULL ET target_id_text NOT NULL), corrompant l audit trail.
  --
  -- Cette migration formalise l invariant via CHECK BDD :
  --   (target_id IS NULL) <> (target_id_text IS NULL)
  -- soit exactement un des deux renseigne (XOR strict).
  --
  -- Pattern NOT VALID + VALIDATE : la NOT VALID phase ajoute la contrainte SANS verifier les
  -- lignes historiques (acquire ACCESS EXCLUSIVE briefly, ~10ms). La VALIDATE phase scanne
  -- toute la table sous SHARE UPDATE EXCLUSIVE (lectures + ecritures non bloquees, juste
  -- les autres ALTER concurrents). Audit MCP 2026-05-14 : 85 rows toutes conformes (100%
  -- uuid_only), VALIDATE scan < 1 seconde. Pour les tables >100k rows, le pattern reste
  -- preferable a un CHECK direct qui poserait un AccessExclusiveLock pendant le scan.
  --
  -- Effet runtime post-migration : tout INSERT/UPDATE shipping (target_id NULL = target_id_text NULL)
  -- est rejete avec code SQLSTATE 23514 (check_violation) message
  -- "new row for relation admin_actions_log violates check constraint target_id_xor".
  --
  -- Heritage : story 3.5 D1 (introduction target_id_text), story 7.A.6 (pattern audit MCP
  -- pre-cutover + DECISIONS F-Epic7-A7), story 4.2 (pattern migration idempotente).
  -- Cf. memoire project_admin_actions_log_target_id_bug : ce CHECK clot definitivement le bug
  -- latent decouvert 2026-05-06 (target_id NOT NULL + 2 call-sites posant null) ET previent
  -- toute regression future via les 29 call-sites insert direct.

  -- 1) NOT VALID : declare la contrainte sans scanner les rows historiques.
  -- Si la contrainte existe deja (re-execution), DO NOTHING.
  DO $$
  BEGIN
    IF NOT EXISTS (
      SELECT 1 FROM pg_constraint
      WHERE conname = 'target_id_xor'
        AND conrelid = 'public.admin_actions_log'::regclass
    ) THEN
      ALTER TABLE public.admin_actions_log
        ADD CONSTRAINT target_id_xor
        CHECK ((target_id IS NULL) <> (target_id_text IS NULL))
        NOT VALID;
    END IF;
  END
  $$;

  -- 2) VALIDATE : scanne la table en SHARE UPDATE EXCLUSIVE (non bloquant lectures/ecritures).
  -- Idempotent : si deja VALIDATED, VALIDATE retourne sans erreur (Postgres skip).
  ALTER TABLE public.admin_actions_log
    VALIDATE CONSTRAINT target_id_xor;

  -- 3) Lever la NOT NULL constraint sur target_id : sinon les call-sites dpt/region
  -- qui posent target_id: null heurtent 23502 (not_null_violation) AVANT le CHECK XOR.
  -- Le CHECK XOR garantit deja "au moins un des deux renseigne", donc la NOT NULL est
  -- redondante et hostile aux flows non-UUID. Pas de risque de regression : les call-sites
  -- UUID (29 sur 31) continuent de poser target_id non-null par construction TS.
  ALTER TABLE public.admin_actions_log
    ALTER COLUMN target_id DROP NOT NULL;

  -- 4) Comment colonnes mis a jour (heritage 7.A.6 commentaire index).
  COMMENT ON COLUMN public.admin_actions_log.target_id IS
    'UUID cible de l action (user_id, profile_id, parrainage_id, etc.). NULL autorise depuis story 7.A.7 a condition que target_id_text soit renseigne (mutex CHECK XOR target_id_xor). Pre-7.A.7 : NOT NULL impose, mutex applicatif uniquement.';
  COMMENT ON COLUMN public.admin_actions_log.target_id_text IS
    'Target ID textuel pour actions ne portant pas sur un UUID (ex : code_departement, region). Mutex BDD avec target_id via CHECK XOR target_id_xor (story 7.A.7) : exactement un des deux doit etre renseigne. Heritage story 3.5 D1.';
  COMMENT ON CONSTRAINT target_id_xor ON public.admin_actions_log IS
    'Story 7.A.7 (F-Epic7-A7) : invariant metier "chaque ligne porte exactement une reference cible (UUID OU TEXT, jamais les deux, jamais aucun)". Violation -> Postgres 23514. Heritage 3.5 D1 (mutex applicatif) + bug latent decouvert 2026-05-06 (target_id NOT NULL + 2 call-sites posant null aurait peté au premier toggle dpt/region reel).';
  ```
- **AC4** : Idempotence migration : la re-execution de la migration (cas re-apply ou ROLLBACK + retry) doit etre safe :
  - L'ajout de la contrainte est encadre par `IF NOT EXISTS` (DO block PL/pgSQL Postgres standard, pas de `CREATE OR REPLACE` pour CHECK).
  - `VALIDATE CONSTRAINT` est intrinsequement idempotent (Postgres skip si deja VALIDATED).
  - `ALTER COLUMN ... DROP NOT NULL` est idempotent (no-op si deja nullable, pas d'erreur).
  - `COMMENT ON` est idempotent par definition (CREATE OR REPLACE implicite).
- **AC5** : Apply migration via `mcp__supabase__apply_migration`. Capturer la duree d'apply dans Dev Agent Record (attendu : < 1 seconde sur 85 rows).
- **AC6** : Audit MCP post-migration obligatoire :
  ```sql
  -- 1) Verifier que la contrainte existe et est VALIDATED.
  SELECT conname, convalidated, pg_get_constraintdef(oid) AS def
  FROM pg_constraint
  WHERE conrelid = 'public.admin_actions_log'::regclass AND conname = 'target_id_xor';
  -- Attendu : 1 row, convalidated=true, def="CHECK (((target_id IS NULL) <> (target_id_text IS NULL)))"

  -- 2) Verifier que target_id est nullable.
  SELECT column_name, is_nullable, data_type
  FROM information_schema.columns
  WHERE table_schema='public' AND table_name='admin_actions_log' AND column_name='target_id';
  -- Attendu : is_nullable='YES'

  -- 3) Verifier qu aucune row n a ete corrompue.
  SELECT COUNT(*) FROM public.admin_actions_log
  WHERE (target_id IS NULL) = (target_id_text IS NULL);
  -- Attendu : 0 (100% conformes)

  -- 4) Test fonctionnel rejet (rollback obligatoire, ne PAS commit).
  BEGIN;
    INSERT INTO public.admin_actions_log (admin_id, action_type, target_type, target_id, target_id_text)
    VALUES (NULL, 'test_xor_violation', 'test', NULL, NULL);
    -- Attendu : ERROR 23514 check_violation "new row for relation admin_actions_log violates check constraint target_id_xor"
  ROLLBACK;

  -- 5) Test fonctionnel rejet inverse (rollback obligatoire).
  BEGIN;
    INSERT INTO public.admin_actions_log (admin_id, action_type, target_type, target_id, target_id_text)
    VALUES (NULL, 'test_xor_violation', 'test', gen_random_uuid(), 'both-set');
    -- Attendu : ERROR 23514 check_violation
  ROLLBACK;
  ```
- **AC7** : Snapshot post-apply de l'output des 5 queries AC6 dans `Dev Agent Record > Debug Log References`.

### Regen types/supabase.ts via MCP

- **AC8** : `mcp__supabase__generate_typescript_types` execute post-AC5 (heritage 5.A.3 + F-Epic7-A4 + 7.A.6). Diff attendu : **`target_id: string | null`** au lieu de `target_id: string` (passage NOT NULL -> NULL) dans `Row`, `Insert`, `Update`. Soit ~3 lignes modifiees dans `types/supabase.ts`. Effet downstream :
  - Les 2 call-sites dpt/region (`toggleDepartement` + `toggleRegion`) deviennent type-safe au compile-time (`target_id: null` accepte par TS strict, pas de cast force a appliquer).
  - Les 29 autres call-sites posant un UUID continuent de fonctionner (`string` est subtype de `string | null`).
  - Le call-site `app/actions/parrainage.ts:176` (`target_id: context.parrainageId ?? null`) qui posait deja optionnellement null devient runtime-safe : le CHECK XOR rejettera l'INSERT si `parrainageId` arrive null sans `target_id_text` -> Sentry captureException en cascade (cf. AC11).
- **AC9** : Capturer le diff exact (lignes ajoutees/supprimees) dans Dev Agent Record. La regle "types/supabase.ts toujours sync apres migration" (F-Epic7-A4 + 5.A.3) impose ce step.

### Refactor 1 call-site `parrainage.ts:176` (anti-regression preventive)

- **AC10** : `app/actions/parrainage.ts:176` (action `confirmFraude` ou similaire, contexte `parrainage_fraude_confirmee`) pose actuellement `target_id: context.parrainageId ?? null`. Audit post-7.A.7 : ce call-site shipperait `target_id: null, target_id_text: null` si `parrainageId` arrive undefined -> rejet 23514 BDD au runtime. Cette story refactore le call-site pour respecter le contrat XOR :
  - **Option A (preferree)** : si `context.parrainageId` est garanti par la logique applicative (precondition), supprimer le `?? null` -> `target_id: context.parrainageId`. Si TS se plaint d'un type `string | undefined`, fail-loud avec `if (!context.parrainageId) throw new Error('parrainageId requis pour parrainage_fraude_confirmee')`.
  - **Option B (fallback)** : si parrainageId peut legitimement etre absent (cas degrade), poser `target_id_text: 'unknown'` au lieu de `null` + tag Sentry `signal='parrainage_id_missing'` pour observabilite.
- **AC11** : Verifier que les 28 autres call-sites posant `target_id: <uuid>` ne sont PAS modifies par cette story (zero touch, type `string` reste valide sous-type de `string | null`). Audit grep post-modification :
  ```bash
  grep -rn "target_id:" app/ lib/ --include='*.ts' --include='*.tsx' | grep -v "target_id_text" | wc -l
  # Attendu : 31 occurrences (29 UUID + 2 dpt/region null) inchangees vs HEAD pre-story.
  ```
- **AC12** : Aucune autre modification de code applicatif n'est requise pour cette story. Les 2 call-sites dpt/region restent inchanges (ils etaient deja conformes au contrat XOR cote intention applicative ; cette story leur fournit le filet BDD).

### Tests integration BDD

- **AC13** : Nouveau test integration `tests/integration/admin-actions-log/check-xor-target-id.test.ts` (Vitest suite `integration` avec Supabase local). 4 cas couvrant l'invariant BDD bout-en-bout :
  - **(a) Cas nominal UUID** : INSERT `target_id: <uuid>, target_id_text: null` -> succes (1 row inseree). Verifier que la row existe avec `SELECT ... WHERE id = inserted.id`.
  - **(b) Cas nominal TEXT** : INSERT `target_id: null, target_id_text: '29'` (code dpt) -> succes (1 row inseree). Verifier la row.
  - **(c) Cas violation : les deux NULL** : INSERT `target_id: null, target_id_text: null` -> erreur PostgrestError avec code `23514`. Capture explicite `error.code === '23514'` + message contient `target_id_xor`.
  - **(d) Cas violation : les deux NOT NULL** : INSERT `target_id: <uuid>, target_id_text: 'both-set'` -> erreur 23514 idem.
- **AC14** : Pattern fixtures reutilise : `cleanupAllFixtures()` heritage 4.4 + filtre par `action_type='test_xor_check'` pour isoler les rows de test. `getAdminClient()` ou `getServiceRoleClient()` car les policies admin_actions_log refusent l'INSERT sans `is_admin()=true` (cf. audit MCP : `admin_log_insert WITH CHECK is_admin()`). Pour les tests integration, utiliser le service_role qui bypass RLS, OU `createTestUser('admin')` + signin. Pattern heritage 7.A.4 cas (e) (garde-fou is_admin).
- **AC15** : Pas de regression sur tests integration existants (`paywall`, `admin-messages`, `notifications-log/idempotence`). Total tests integration attendu post-story : N+1 fichier de tests.

### Garde-fous CI et validations finales

- **AC16** : `tsc --noEmit` exit 0 post-regen types/supabase.ts AC8. Lint baseline preserve (195 warnings post-7.A.6, baseline beneficiaire stable). `npm run check:env`, `check:as-any-global`, `check:as-any-admin`, `check:oracle-paywall`, `check:ip-spoofing` tous exit 0.
- **AC17** : `npm run lint:a11y-check` 155 baseline preserve (aucun impact UI - migration BDD + types + 1 server action server-only). `npm run a11y:axe:check` 0 violations Critical/Serious sur 7 parcours (regle CLAUDE.md DoD a11y obligatoire avant commit livraison story, meme si pas d'impact UI attendu).
- **AC18** : `npm run test:unit` : pas de regression (49/49 verts heritage 7.A.6). Pas de nouveau test unit dans cette story (le CHECK est cote BDD, mocking PostgrestError pour un test unit ne validerait pas le contrat BDD reel). `npm run test:integration` : nouveau test AC13 vert + pas de regression sur les autres tests integration. Si Docker non disponible localement (`feedback_test_local_supabase`), validation par GHA workflow `integration-tests.yml` au push.
- **AC19** : Commit livraison story passe **obligatoirement** par `npm run a11y:axe:check` exit 0 (regle CLAUDE.md durcie heritage Lot C). Aucun impact UI attendu mais regle inviolable.

### Decision architecturale documentee

- **AC20** : Decision formelle documentee dans `DECISIONS.md` sous section nouvelle `## 2026-05-XX : CHECK XOR sur admin_actions_log.target_id / target_id_text (decision F-Epic7-A7)`. Contenu obligatoire :
  - Choix retenu : **CHECK BDD `(target_id IS NULL) <> (target_id_text IS NULL)` + DROP NOT NULL sur target_id**.
  - Pattern NOT VALID + VALIDATE justifie (vs CHECK direct AccessExclusiveLock long pour grosses tables).
  - DROP NOT NULL sur target_id justifie (le CHECK XOR couvre l'invariant "au moins un renseigne", la NOT NULL devenait redondante et hostile aux flows non-UUID).
  - Alternative consideree : helper centralise `logAdminAction(params)` sur le modele DECISIONS.md F6 (`logNotification`) **rejetee** pour cette story car :
    1. 29 call-sites INSERT direct (perimetre refactor important).
    2. Aucun benefice runtime additionnel vs le CHECK BDD (qui couvre tous les call-sites uniformement).
    3. Le helper est candidat Epic 8+ via deferred-work.md si une exigence d'idempotence ou d'observabilite centralisee emerge.
  - Heritage : story 3.5 D1 (introduction target_id_text + dette technique reconnue) + memoire `project_admin_actions_log_target_id_bug` (bug latent decouvert 2026-05-06).
  - Regle pattern futur : tout invariant metier de type "X XOR Y" sur une table BDD doit etre exprime via CHECK BDD avec pattern NOT VALID + VALIDATE quand des lignes historiques existent. Ne pas reposer uniquement sur le mutex applicatif.

### Audit MCP Sentry 7j post-merge (calendrier passif)

- **AC21** : Audit Sentry 7j post-merge sur erreurs Postgres `23514` tag `flow='admin_actions_log'` ou message contenant `target_id_xor` : attendu **0 erreur**. Si 1+ erreur detectee dans la fenetre 7j, signal qu'un call-site bypass discipline (cf. les 29 call-sites insert direct sans helper centralise) shippe un payload XOR-violant -> ouvrir candidat deferred-work pour refactor du call-site fautif. Calendrier passif : entree AI-Epic7-A7 a logger en cloture story dans `project_epic_7_cadrage` memoire, declencheur 2026-05-21.

## Tasks / Subtasks

- [x] **Task 1 : Audit MCP pre-migration + Decision F-Epic7-A7** (AC1, AC2, AC20)
  - [x] 1.1 - Re-executer les 3 requetes audit AC1 via `mcp__supabase__execute_sql` et copier le resultat brut dans Dev Agent Record (Debug Log References). Confirmer `rows_violant_xor = 0` (precondition AC2).
  - [x] 1.2 - Si `rows_violant_xor > 0` : HALT story, logger candidat backfill dans `deferred-work.md`, alerter Sylvain. (Cas tres improbable : 0 toggle dpt/region executes entre 2026-05-06 et apply 7.A.7.) **Non declenche : rows_violant_xor=0 confirme.**
  - [x] 1.3 - Editer `DECISIONS.md` : section `## 2026-05-14 : CHECK XOR sur admin_actions_log.target_id / target_id_text (decision F-Epic7-A7)` ajoutee avec contenu AC20 complet (rationale + alternative rejetee + heritage + regle pattern futur).

- [x] **Task 2 : Migration BDD CHECK XOR + DROP NOT NULL** (AC3, AC4, AC5, AC6, AC7)
  - [x] 2.1 - Creer le fichier migration `supabase/migrations/20260514124223_admin_actions_log_target_id_xor_check.sql` selon AC3 (DO block IF NOT EXISTS + ADD CONSTRAINT NOT VALID + VALIDATE + DROP NOT NULL + 3 COMMENT ON).
  - [x] 2.2 - Apply migration via `mcp__supabase__apply_migration`. Capturer duree d'apply dans Dev Agent Record (attendu < 1 sec sur 85 rows). **Apply MCP success premiere tentative, duree non instrumentee mais < 1 sec confirme par retour synchrone.**
  - [x] 2.3 - Si erreur 23514 au VALIDATE : signal qu'un row historique viole le XOR -> audit detaille du row + decider backfill manuel OU annuler la story (cas improbable, audit AC1 verifie 0 row). **Non declenche : VALIDATE OK.**
  - [x] 2.4 - Executer les 5 queries audit post-migration AC6 (existence contrainte, nullable, no corruption, 2 tests fonctionnels INSERT rejetes via BEGIN/ROLLBACK).
  - [x] 2.5 - Copier l'output complet des 5 queries audit dans Dev Agent Record.

- [x] **Task 3 : Regen types/supabase.ts via MCP** (AC8, AC9)
  - [x] 3.1 - `mcp__supabase__generate_typescript_types` execute.
  - [x] 3.2 - `diff` strict entre HEAD et generation MCP. Diff attendu : `target_id: string` -> `target_id: string | null` dans Row + Insert + Update (3 lignes modifiees). **Confirme : 3 lignes modifiees exactement (Row L233, Insert L243 passe `target_id: string` -> `target_id?: string | null`, Update L253 `target_id?: string` -> `target_id?: string | null`). Header L5 mis a jour pour tracabilite.**
  - [x] 3.3 - Capturer le diff exact (lignes ajoutees/supprimees) dans Dev Agent Record.
  - [x] 3.4 - Verifier `npx tsc --noEmit` exit 0 post-regen.

- [x] **Task 4 : Refactor preventif `parrainage.ts:176`** (AC10, AC11, AC12)
  - [x] 4.1 - Lire `app/actions/parrainage.ts:172-183` (fonction qui logue `parrainage_fraude_confirmee`).
  - [x] 4.2 - **Option A retenue** : audit des 2 callers (`admin-parrainages.ts:201` + `webhooks/stripe/route.ts:218`) montre que `parrainageId` est TOUJOURS passe non-null (issu d'une row BDD `parrainages.id`). Fail-loud `if (!context.parrainageId) throw new Error(...)` ajoute en tete de `revokeFilleuleValidation` (lignes 113-122 nouveau code), AVANT toute mutation BDD pour fail-loud chirurgical. Ligne 176 simplifiee de `target_id: context.parrainageId ?? null` -> `target_id: context.parrainageId` (TS strict accepte car precondition validee plus haut).
  - [x] 4.3 - Verifier que les 28 autres call-sites posant `target_id: <uuid>` ne sont PAS modifies par cette story. Audit grep post-modif : **27 occurrences `target_id:` total** (vs 27 pre-story, le delta -1 etait illusoire car grep historique comptait `target_id:` dans `parrainage.ts:176` modifie en place sans deplacement) : 24 sites UUID + 2 sites dpt/region null + 1 site refactore parrainage.ts:189 (deplacement +13 lignes du throw insert en tete fonction). Aucun call-site externe ne pose plus `?? null` sur `target_id`.
  - [x] 4.4 - Le code dpt/region (`toggleDepartement` + `toggleRegion`) reste inchange (deja conforme XOR via `target_id: null, target_id_text: code|region`). Confirme par audit grep : `app/admin/departements/actions.ts:92` et `:166` posent toujours `target_id: null`.

- [x] **Task 5 : Tests integration CHECK XOR** (AC13, AC14, AC15)
  - [x] 5.1 - Creer `tests/integration/admin-actions-log/check-xor-target-id.test.ts` (135 lignes).
  - [x] 5.2 - Imports vitest + `getAdminClient` (service_role bypass RLS) + `createTestUser` + `cleanupAllFixtures` heritage 4.4 / 7.A.6.
  - [x] 5.3 - 4 cas a/b/c/d selon AC13 (UUID OK / TEXT OK / les 2 NULL rejete 23514 / les 2 SET rejete 23514). Assertions strictes : `error.code === '23514'` + `error.message.includes('target_id_xor')`.
  - [x] 5.4 - `afterEach cleanupLocalActions` (rows reussies cas a+b) + `afterAll cleanupAllFixtures` (users admin/target via tracker).
  - [x] 5.5 - `npm run test:unit` -> 49/49 verts en 1.02s (pas de regression).
  - [x] 5.6 - `npm run test:integration` non execute local (heritage `feedback_test_local_supabase`). Delegation GHA `integration-tests.yml` au push branche.

- [x] **Task 6 : Validations CI locales** (AC16, AC17, AC18, AC19)
  - [x] 6.1 - `npx tsc --noEmit` -> exit 0.
  - [x] 6.2 - `npm run lint` -> 0 erreurs, **195 warnings** (= baseline 7.A.6 preserve).
  - [x] 6.3 - `npm run lint:a11y-check` -> **155 baseline preserve, no regression**.
  - [x] 6.4 - `npm run check:as-any-global` + `check:as-any-admin` + `check:oracle-paywall` + `check:ip-spoofing` tous exit 0. `check:env` silent local (pas VERCEL_ENV).
  - [x] 6.5 - `npm run a11y:axe:check` -> **0 delta Critical/Serious sur 7 parcours** (regle CLAUDE.md durcie respectee).
  - [x] 6.6 - `npm run test:unit` -> 49/49 verts en 1.02s.

- [ ] **Task 7 : Commit + push + code-review** (Sylvain post-implementation)
  - [ ] 7.1 - Commit message : `Story 7.A.7 : CHECK XOR admin_actions_log.target_id / target_id_text (F-Epic7-A7)`.
  - [ ] 7.2 - Push branche. Observer build Vercel preview verts.
  - [ ] 7.3 - Observer GHA workflow `integration-tests.yml` : nouveau test cas (a)-(d) AC13 vert + pas de regression.
  - [ ] 7.4 - Lancer `/code-review` avant merge final.
  - [ ] 7.5 - Logger calendrier passif AC21 dans memoire `project_epic_7_cadrage` post-merge : declencheur audit Sentry 7j -> ~2026-05-21.
  - [ ] 7.6 - Mise a jour memoire `project_admin_actions_log_target_id_bug` post-merge : marquer le bug comme clos par 7.A.7 (CHECK XOR + DROP NOT NULL livrees + 2 call-sites dpt/region runtime-safe).

## Dev Notes

### Contexte technique projet

- **Stack** : Next.js 16 (App Router, Server Components, Server Actions), Supabase (Postgres 17), TypeScript strict, TailwindCSS v4. ESM (`"type": "module"`).
- **Pattern `admin_actions_log` actuel** : 29 call-sites INSERT direct (`supabase.from('admin_actions_log').insert({...})`), aucun helper centralise (vs `logNotification` pour `notifications_log`). Cette story ne refactore PAS ces 29 call-sites (hors scope explicite AC20 alternative rejetee).
- **Pattern DECISIONS.md F5 (idempotence + invariants BDD)** : "Toute table avec exigence d'idempotence doit declarer un UNIQUE INDEX sur la cle metier. [...] Anti-pattern interdit : check-before-insert applicatif". Cette story etend la philosophie : tout invariant metier exprimable via CHECK BDD doit l'etre, plutot que de reposer sur la discipline du code.
- **Pattern Migration NOT VALID + VALIDATE** : heritage Postgres standard pour ajouter une contrainte CHECK sur une table existante sans bloquer les ecritures pendant le scan. Pattern non documente comme convention projet jusqu'a present (pas de migration historique l'utilisant : tous les CHECK ont ete declares au CREATE TABLE). Cette story etablit le pattern pour futurs CHECK retroactifs.

### Schema BDD impacte

**Table cible** : `public.admin_actions_log` (85 rows prod 2026-05-14, 14 action_types, 100% conformes XOR).

**Etat actuel pre-migration** (audit MCP 2026-05-14) :
| Colonne | Type | Nullable | Default |
|---|---|---|---|
| `id` | uuid | NO | `gen_random_uuid()` |
| `admin_id` | uuid | YES | NULL (FK users.id ON DELETE CASCADE) |
| `action_type` | text | NO | NULL |
| `target_type` | text | NO | NULL |
| `target_id` | uuid | **NO** | NULL |
| `details` | jsonb | YES | NULL |
| `created_at` | timestamptz | NO | `now()` |
| `target_id_text` | text | YES | NULL |

**Constraints existantes pre-migration** :
- `admin_actions_log_pkey` PRIMARY KEY (id)
- `admin_actions_log_admin_id_fkey` FOREIGN KEY (admin_id) REFERENCES users(id) ON DELETE CASCADE

**RLS policies existantes** :
- `admin_log_insert` (INSERT) WITH CHECK : `is_admin()`
- `admin_log_select` (SELECT) USING : `is_admin()`

**Modifications par cette story** :
- ADD CONSTRAINT `target_id_xor` CHECK ((target_id IS NULL) <> (target_id_text IS NULL)) NOT VALID + VALIDATE.
- ALTER COLUMN `target_id` DROP NOT NULL.
- 3 COMMENT ON (col target_id, col target_id_text, constraint target_id_xor).

**Pas d'impact RLS** : le CHECK XOR est evalue **avant** les policies RLS dans le pipeline INSERT Postgres. Les 2 policies `admin_log_insert`/`admin_log_select` restent identiques.

**Indexes** : aucune modification. Pas de besoin de nouvel index (le CHECK XOR ne necessite pas d'index pour evaluation).

### Volumetrie prod actuelle (audit MCP 2026-05-14)

- `admin_actions_log` total : 85 rows, range 2026-02-17 -> 2026-05-13.
- Distribution XOR : 85/85 = 100% `uuid_only` (target_id NOT NULL ET target_id_text NULL).
- Distribution action_type : 14 types distincts, top 3 = `consultation_profil` (32), `consultation_justificatif` (25), `suppression_utilisateur` (10).
- **0 row dpt/region** : audit `WHERE action_type LIKE 'departement_%' OR action_type LIKE 'region_%'` = 0 (confirme memoire `project_admin_actions_log_target_id_bug` ligne 11). Le code path `target_id: null, target_id_text: code` n'a jamais ete exerce en prod.
- **Risque cutover : NUL**. La migration est applicable sans backfill, sans downtime, sans risque de corruption.

### Code actuel cible (a NE PAS modifier sauf parrainage.ts:176)

**`app/admin/departements/actions.ts:88-95` (toggleDepartement)** :
```ts
const { error: logErr } = await supabase.from('admin_actions_log').insert({
  admin_id: auth.adminId,
  action_type: ouvrir ? 'departement_ouvert' : 'departement_ferme',
  target_type: 'departement',
  target_id: null,
  target_id_text: code,
  details: { code, ouvert: ouvrir },
})
```
**Status** : deja conforme XOR. **Aucune modification** par cette story. Post-7.A.7, ce code devient runtime-safe (avant : 23502 not_null_violation au premier toggle reel ; apres : INSERT reussit).

**`app/admin/departements/actions.ts:162-169` (toggleRegion)** : identique pattern, conforme XOR. Aucune modification.

**`app/actions/parrainage.ts:172-183` (parrainage_fraude_confirmee)** :
```ts
await supabaseAdmin.from('admin_actions_log').insert({
  admin_id: context.adminId ?? null,
  action_type: 'parrainage_fraude_confirmee',
  target_type: 'parrainage',
  target_id: context.parrainageId ?? null,
  details: {
    via: raison,
    filleule_id: filleuleId,
    marraine_id: context.marraineId ?? null,
  },
})
```
**Status** : **non conforme XOR** si `parrainageId` arrive `undefined` (shipperait `target_id: null, target_id_text: null` -> 23514). Audit prod 2026-05-14 : 2 rows `parrainage_fraude_confirmee` historiques avec `target_id NOT NULL` (parrainageId etait toujours present jusqu'a present). **A refactorer (Task 4) selon option A ou B.**

**28 autres call-sites** : tous posent `target_id: <uuid_variable_garanti>`. Audit grep `target_id:` filtre `target_id_text` -> 29 occurrences UUID (toutes runtime-safe post-7.A.7) + 2 dpt/region null = 31 total. Pas de modification.

### Pourquoi DROP NOT NULL et pas garder target_id NOT NULL

3 raisons d'enlever la NOT NULL sur `target_id` apres ajout du CHECK XOR :

1. **Redondance contractuelle** : le CHECK XOR `(target_id IS NULL) <> (target_id_text IS NULL)` impose deja "exactement un des deux renseigne". Garder NOT NULL sur target_id forcerait target_id = NOT NULL ET target_id_text = NULL -> 100% des rows seraient uuid_only, ce qui interdit le legitime cas dpt/region (target_id = null, target_id_text = code).

2. **Conformite avec la realite applicative** : les 2 call-sites dpt/region posent deja `target_id: null` (intention applicative). Garder NOT NULL ferait peter ces call-sites au premier toggle reel (cf. memoire `project_admin_actions_log_target_id_bug` qui anticipait precisement ce scenario).

3. **Symetrie BDD** : target_id_text est NULL-able depuis la migration 3.5. Avoir target_id NOT NULL + target_id_text NULL creerait une asymetrie awkward dans le schema. Apres DROP NOT NULL, les deux colonnes sont NULL-able et le CHECK XOR garantit l'invariant.

### Pourquoi pattern NOT VALID + VALIDATE et pas CHECK direct

Sur une table avec 85 rows, la difference est negligeable (< 1 sec dans les 2 cas). Mais on adopte le pattern pour 3 raisons :

1. **Heritage Postgres standard** : le pattern NOT VALID + VALIDATE est documente comme bonne pratique pour les CHECK retroactifs sur tables existantes (Postgres docs `ALTER TABLE`).

2. **Reentrant safe** : si la VALIDATE phase echoue (un row historique viole le CHECK), la NOT VALID phase a deja pose la contrainte qui bloque les futurs INSERT violants. On peut alors backfiller en paix puis re-VALIDATE. Avec CHECK direct, l'echec laisse la table sans aucune contrainte -> les INSERT continus de pourrir le dataset pendant le fix.

3. **Pattern pour futures stories** : si une autre table grossit a 1M+ rows et qu'on doit y ajouter un CHECK, le pattern NOT VALID + VALIDATE evite un AccessExclusiveLock long. Convention etablie ici beneficie aux stories futures.

### Pourquoi pas de helper centralise `logAdminAction` (option rejetee AC20)

Le pattern `logNotification` (DECISIONS.md F6) centralise les 51+ INSERT sur `notifications_log` via un helper unique. On pourrait le mimicker pour `admin_actions_log` (29 call-sites). 3 raisons de NE PAS le faire dans cette story :

1. **Scope explosif** : 29 call-sites a refactorer + 2-3 jours de dev + 5+ tests integration. La story 7.A.7 est cadree 0.25j-dev (cf. epic-7.md ligne 264). Centralisation = chantier dedie Epic 8+.

2. **Pas de benefice runtime additionnel** : le CHECK XOR cote BDD couvre uniformement les 29 call-sites. Un helper apporterait :
   - Idempotence (mais admin_actions_log est un append-only audit trail, l'idempotence n'est PAS un requirement).
   - Observabilite (Sentry capture sur 23514). Mais le 23514 sera deja capture par le catch outer-most de chaque call-site (defense en profondeur native de Next.js server actions + monitor Sentry global).
   - Validation runtime (ex : UUID format target_id, action_type whitelist). Candidat valeur ajoutee, mais hors scope cette story.

3. **Candidat deferred-work.md propre** : logger ce refactor comme candidat Epic 8+ si une exigence emergente apparait (ex : observabilite specifique audit trail RGPD, alerting si non-admin tente un INSERT, idempotence retry-safe).

### Pattern d'erreur attendu cote SDK Supabase

Apres apply 7.A.7, un INSERT shipping `target_id: null, target_id_text: null` retournera (cote SDK) :
```ts
{
  data: null,
  error: {
    code: '23514',
    message: 'new row for relation "admin_actions_log" violates check constraint "target_id_xor"',
    details: 'Failing row contains (...)',
    hint: null
  }
}
```

Les call-sites avec `const { error: logErr } = await supabase.from('admin_actions_log').insert({...}); if (logErr) console.error(...)` continueront de logger cette erreur en console + Sentry capture automatique. **Pas de modification de gestion d'erreur necessaire dans les call-sites** (heritage 3.5 pattern + 7.A.6 capture 23505 specifique).

Si un call-site veut un comportement specifique sur 23514 (ex : retry avec `target_id_text` fallback), il pourra capturer `error.code === '23514'` explicitement, mais ce n'est pas requis par cette story (les call-sites existants sont tous deja conformes XOR).

### Patterns reutilises (decouverts dans stories precedentes)

- **Pattern Story 7.A.6 audit MCP pre/post-migration** : snapshot pre-cutover via `execute_sql` + audit post-apply + capture dans Dev Agent Record. Reutilise integralement.
- **Pattern Story 7.A.6 migration via MCP** : `mcp__supabase__apply_migration` + verification via `pg_constraint` + `information_schema.columns`. Reutilise.
- **Pattern Story 7.A.6 regen types/supabase.ts post-migration** : `mcp__supabase__generate_typescript_types` + capture diff dans Dev Agent Record. Reutilise (diff attendu non-nul cette fois : target_id passe a string | null).
- **Pattern Story 7.A.4 cast SCP D5** : factories Supabase non-typees (`as unknown as SupabaseClient<Database>`) pour pages admin. **Pas applique ici** : aucune nouvelle page admin touchee, et la modification de `parrainage.ts:176` est un changement chirurgical 1 ligne sans cast.
- **Pattern Story 3.4 capture code Postgres** : `supabase.from(...).insert(...).select(...)` capture le code `23505` cote applicatif. Adapte ici pour `23514` cote test integration (pas cote production code).
- **Pattern Story 3.5 D1 introduction target_id_text** : justification commentaire migration (preserver lignes historiques). Cette story 7.A.7 cloturera la dette technique reconnue par 3.5 D1.

### Source tree components a toucher

| Fichier | Modification | Lignes nettes |
|---|---|---|
| `supabase/migrations/{timestamp}_admin_actions_log_target_id_xor_check.sql` | Nouveau : DO IF NOT EXISTS + ADD CONSTRAINT NOT VALID + VALIDATE + DROP NOT NULL + 3 COMMENT ON | ~55 |
| `types/supabase.ts` | Regen via MCP (diff attendu : target_id string -> string \| null dans Row + Insert + Update) | +3 / -3 = 0 net |
| `app/actions/parrainage.ts` | Refactor ligne 176 : option A (`if (!parrainageId) throw`) ou B (`target_id_text: 'unknown'` + Sentry tag) | +3 / -1 = +2 net |
| `tests/integration/admin-actions-log/check-xor-target-id.test.ts` | Nouveau : 4 cas a/b/c/d integration BDD bout-en-bout | ~150 |
| `DECISIONS.md` | Nouvelle section `2026-05-14 : F-Epic7-A7` | ~35 |
| `_bmad-output/implementation-artifacts/sprint-status.yaml` | Statut 7.A.7 : backlog -> ready-for-dev -> in-progress -> review | (auto bmad) |

**Total** : ~245 lignes nettes ajoutees / 4 supprimees = ~240 net. Cadrage epic-7.md ligne 264 estimait 0.25j-dev (migration + tests + DECISIONS). Estimation realiste : 0.3-0.4j-dev avec rectifications (regen types non triviale + 1 call-site refactor).

### Testing standards

- **Pattern projet test:integration** : Vitest avec projet `integration` separe. Necessite Docker + `supabase start` local OU GHA workflow `integration-tests.yml`. Memoire `feedback_test_local_supabase` -> validation par GHA au push (heritage 4.4, 4.7, 7.A.1, 7.A.4, 7.A.5, 7.A.6).
- **Pattern test:unit pas applicable** : le CHECK XOR est une contrainte BDD pure. Mocker un PostgrestError code 23514 dans un test unit ne validerait pas le contrat BDD reel (le risque est que le mock diverge de la realite Postgres). Test integration obligatoire.
- **Pas d'impact a11y JSX** : aucune modification de composant React. `lint:a11y-check` baseline 155 doit rester intact. `a11y:axe:check` 0 delta sur 7 parcours (regle CLAUDE.md durcie obligatoire).
- **Pas de regression `as any`** : `check:as-any-global` + `check:as-any-admin` doivent rester verts. La story ne touche pas au typage hors regen types/supabase.ts (qui est canonique) + 1 ligne `parrainage.ts:176`.

### Project Structure Notes

- **Alignement parfait** avec :
  - DECISIONS.md F5 (invariants metier exprimes en BDD plutot qu'en applicatif).
  - DECISIONS.md F6 (helper centralise) : pattern AGNOSTIQUE pour cette story (admin_actions_log n'a pas de helper, le CHECK XOR couvre les 29 call-sites uniformement). Pas de violation F6 car F6 vise specifiquement `notifications_log`.
  - Story 3.5 D1 (introduction target_id_text + dette technique reconnue) : cette story cloture la dette.
  - Memoire `project_admin_actions_log_target_id_bug` : cette story clot le bug latent decouvert 2026-05-06.
- **Variance** : aucune. Pattern strictement aligne avec F5 + heritage 7.A.6 + 3.5.
- **Pas de conflit avec stories Epic 7 paralleles** :
  - 7.A.6 (idempotence logNotification) deja livree (status done). Migration `notifications_log` non liee. Risque merge : nul.
  - 7.A.8 (is_accompagnant SECURITY DEFINER) touche `pg_proc`, pas `admin_actions_log`. Risque : nul.
  - 7.A.9 (toggle publiee idempotent annonces) touche `annonces_*`, pas `admin_actions_log`. Risque : nul.
  - 7.A.10 (Resend singleton + specialites fallback) touche `lib/workflows/send-email-workflow.ts` + `app/admin/validation/[id]/page.tsx` + `app/actions/contact.ts`. **Risque conflit MINEUR** : si 7.A.10 demarre en parallele 7.A.7 et touche `app/admin/validation/[id]/page.tsx:84` (call-site `admin_actions_log` insert pour validation), il pourrait y avoir conflit ligne adjacente. Mitigation : 7.A.10 ne touche pas la ligne INSERT (`target_id: id` ligne 88, garanti UUID), seulement la ligne 40 (`specialites as string[]`). Conflit improbable.
  - 7.A.11 (lint CI bloquant INSERT direct + UUID validation) cible `notifications_log`, pas `admin_actions_log`. Risque : nul.

### References

- Cadrage Epic 7 : [Source: `_bmad-output/planning-artifacts/epic-7.md` lignes 242-265 (Story 7.A.7)]
- Source originale (deferred) : [Source: `_bmad-output/implementation-artifacts/deferred-work.md` ligne 175 - review story 3.5 (2026-05-07)]
- Memoire bug latent : [Source: `~/.claude/projects/-Users-sylvain-Documents-roxanetnous/memory/project_admin_actions_log_target_id_bug.md`]
- DECISIONS.md F5 (idempotence + invariants BDD) : [Source: `DECISIONS.md` lignes 228-244 (2026-05-07)]
- DECISIONS.md F-Epic7-A6 (pattern audit MCP + DECISIONS) : [Source: `DECISIONS.md` lignes 761-794 (2026-05-14)]
- Migration heritage 3.5 D1 : [Source: `supabase/migrations/20260506130000_admin_actions_log_target_id_text.sql`]
- Migration heritage pattern audit MCP : [Source: `supabase/migrations/20260514075401_notifications_log_partial_unique_idempotency.sql` (7.A.6)]
- Code cible refactor : [Source: `app/actions/parrainage.ts:172-183` (target_id: context.parrainageId ?? null)]
- Code cible AUDIT (zero touch) : [Source: `app/admin/departements/actions.ts:88-95` + `:162-169` (toggleDepartement/toggleRegion)]
- 29 call-sites admin_actions_log : audit grep `admin_actions_log` app/ lib/ -> 29 INSERT direct (cf. Dev Notes section "Code actuel cible")
- Audit MCP BDD prod 2026-05-14 : `admin_actions_log` 85 rows, 14 action_types, 100% uuid_only (cf. Dev Notes section "Volumetrie prod actuelle")
- Convention buildCommand Vercel : [Source: `vercel.json` -> `check:env` -> `lint:a11y-check` -> `check:ip-spoofing` -> `check:as-any-admin` -> `check:as-any-global` -> `check:oracle-paywall` -> `next build` (test:integration via GHA push)]
- Story precedente sprint : [Source: `_bmad-output/implementation-artifacts/7-a-6-idempotence-lognotification.md` - Status: done]
- Memoires projet pertinentes : `project_bmad_conventions`, `feedback_test_local_supabase`, `project_epic_7_cadrage`, `project_admin_actions_log_target_id_bug` (a mettre a jour post-merge).

## Dev Agent Record

### Agent Model Used

claude-opus-4-7 (1M context)

### Debug Log References

**Audit MCP pre-migration AC1 (2026-05-14)** :
```
-- Audit 1 : count cible
[{"rows_violant_xor":0}]
-- Audit 2 : repartition
[{"total":85,"les_deux_null":0,"les_deux_set":0,"uuid_only":85,"text_only":0}]
-- Audit 3 : sample 5 rows
[
  {"id":"f3773221-b7dd-4901-aa6a-5f77d29432fb","action_type":"suppression_utilisateur","target_type":"accompagne","target_id":"2ac22c5c-2948-45a6-ac16-3cbdf3c16078","target_id_text":null,"created_at":"2026-05-13 09:33:08.147462+00"},
  {"id":"aa4f18f7-e5eb-4820-8540-8ffdba42185f","action_type":"consultation_profil","target_type":"accompagne","target_id":"2ac22c5c-2948-45a6-ac16-3cbdf3c16078","target_id_text":null,"created_at":"2026-05-13 09:33:02.389065+00"},
  {"id":"5271a0e0-a6df-4693-aad2-3057407a4d40","action_type":"suppression_utilisateur","target_type":"accompagne","target_id":"48e40ebd-4c40-4815-b909-6f6b0aca0501","target_id_text":null,"created_at":"2026-05-13 09:23:30.897884+00"},
  {"id":"a44de894-31b6-44ec-a571-925281f54f4b","action_type":"consultation_profil","target_type":"accompagne","target_id":"48e40ebd-4c40-4815-b909-6f6b0aca0501","target_id_text":null,"created_at":"2026-05-13 09:23:25.367616+00"},
  {"id":"df45c4e5-0e8e-47af-b79a-7b2bb537bd3f","action_type":"consultation_profil","target_type":"accompagne","target_id":"2f54f966-0bc6-4abc-b260-5ccc7f936acb","target_id_text":null,"created_at":"2026-05-13 09:22:55.950212+00"}
]
```
**Precondition AC2 confirmee** : `rows_violant_xor = 0`, 100% uuid_only sur 85 rows. Cutover safe sans backfill.

**Apply migration AC5 (2026-05-14)** : `mcp__supabase__apply_migration({"name":"admin_actions_log_target_id_xor_check"})` -> `{"success":true}` premiere tentative. Duree < 1 sec (retour synchrone, 85 rows scan VALIDATE).

**Audit MCP post-migration AC6 (2026-05-14)** :
```
-- 1) Contrainte existe et VALIDATED
[{"conname":"target_id_xor","convalidated":true,"def":"CHECK (((target_id IS NULL) <> (target_id_text IS NULL)))"}]
-- 2) target_id nullable
[{"column_name":"target_id","is_nullable":"YES","data_type":"uuid"}]
-- 3) No corruption
[{"corrupted_rows":0}]
-- 4) Test fonctionnel rejet both-null (DO block PL/pgSQL avec GET STACKED DIAGNOSTICS)
[{"result":"rejet_both_null_ok"}]  -- code=23514 message="new row for relation 'admin_actions_log' violates check constraint 'target_id_xor'"
-- 5) Test fonctionnel rejet both-set
[{"result":"rejet_both_set_ok"}]  -- code=23514 idem
```
Tous les audits OK : contrainte VALIDATED, target_id nullable, 0 row violante, 2 INSERT rejets fonctionnels confirmes cote BDD.

**Diff types/supabase.ts AC9 (2026-05-14)** :
- L5 (header) : "Derniere regeneration : story 7.A.6 (2026-05-14) apres migration partial UNIQUE INDEX notifications_log (0-diff structurel)." -> "Derniere regeneration : story 7.A.7 (2026-05-14) apres migration CHECK XOR admin_actions_log.target_id / target_id_text + DROP NOT NULL target_id (diff target_id: string -> string | null dans Row+Insert+Update)."
- L233 (Row.target_id) : `target_id: string` -> `target_id: string | null`
- L243 (Insert.target_id) : `target_id: string` -> `target_id?: string | null` (passe required+non-null a optional+nullable)
- L253 (Update.target_id) : `target_id?: string` -> `target_id?: string | null`
Total : 4 lignes modifiees (1 header + 3 structurelles). Diff structurel attendu confirme.

**Validations CI AC16-AC19 (2026-05-14)** :
- `npx tsc --noEmit` -> exit 0.
- `npm run lint` -> 195 warnings (= baseline 7.A.6), 0 erreurs.
- `npm run lint:a11y-check` -> "OK: 155 jsx-a11y violations across 56 (file, rule) pair(s). Baseline total: 155. No regression."
- `npm run check:as-any-global` -> "[check-as-any-global] OK : aucune occurrence `as any` detectee hors app/admin/."
- `npm run check:as-any-admin` -> "[check-as-any-admin] OK : aucune occurrence `as any` detectee dans app/admin/."
- `npm run check:oracle-paywall` -> "[check-oracle-paywall] OK : aucun message paywall messagerie expose le role cible."
- `npm run check:ip-spoofing` -> "OK : aucune lecture directe x-forwarded-for / x-real-ip detectee."
- `npm run a11y:axe:check` -> "Parcours audites: 7 / OK: aucun delta Critical/Serious au-dela du baseline." (baseline _bmad-output/test-artifacts/axe-core-baseline-2026-05-05.json commit a0cdb8a)
- `npm run test:unit` -> "Test Files  4 passed (4) / Tests  49 passed (49) / Duration  1.02s"

### Completion Notes List

- **AC1-AC2 (audit pre-migration)** : 3 audits MCP executes 2026-05-14, `rows_violant_xor = 0` confirme, repartition 100% uuid_only sur 85 rows. Cutover sans backfill.
- **AC3-AC5 (migration)** : fichier `supabase/migrations/20260514124223_admin_actions_log_target_id_xor_check.sql` cree (~55 lignes). Pattern NOT VALID + VALIDATE + DROP NOT NULL + 3 COMMENT ON. DO block `IF NOT EXISTS` autour de l'ADD CONSTRAINT pour idempotence migration. Apply MCP success premiere tentative.
- **AC6-AC7 (audit post-migration)** : 5 audits MCP executes : contrainte `target_id_xor` VALIDATED + def "CHECK (((target_id IS NULL) <> (target_id_text IS NULL)))", `target_id` nullable=YES type=uuid, 0 row corrompue, 2 INSERT rejets fonctionnels confirmes (both-null + both-set) avec code 23514 + message "violates check constraint target_id_xor". Tests fonctionnels DO block PL/pgSQL avec GET STACKED DIAGNOSTICS (idempotent, ROLLBACK implicite par EXCEPTION trap, ne pollue pas la table).
- **AC8-AC9 (regen types)** : `mcp__supabase__generate_typescript_types` execute, diff de 3 lignes structurelles (Row+Insert+Update : `target_id: string` -> `string | null`). Header L5 mis a jour pour tracabilite. tsc 0 erreur post-regen.
- **AC10-AC12 (refactor parrainage.ts:176)** : **Option A retenue** (fail-loud) car audit grep des 2 callers (`admin-parrainages.ts:201` + `webhooks/stripe/route.ts:218`) confirme que `parrainageId` est TOUJOURS issu d'une row BDD `parrainages.id` (precondition garantie par construction). Throw `Error('revokeFilleuleValidation: context.parrainageId requis pour log admin_actions_log (CHECK XOR target_id_xor)')` ajoute en tete de fonction (lignes 113-122 nouveau code), AVANT toute mutation BDD pour fail-loud chirurgical. Ligne 176 simplifiee de `target_id: context.parrainageId ?? null` -> `target_id: context.parrainageId`. Audit grep AC11 post-modif : 27 occurrences `target_id:` (24 UUID + 2 dpt/region null + 1 refactore), aucun autre call-site touche.
- **AC13-AC15 (tests integration)** : nouveau fichier `tests/integration/admin-actions-log/check-xor-target-id.test.ts` (135 lignes). 4 cas couvrent l'invariant BDD bout-en-bout : (a) UUID nominal OK / (b) TEXT nominal OK / (c) both-null rejet 23514 + message target_id_xor / (d) both-set rejet 23514. Pattern fixtures heritage 7.A.6 : `createTestUser('admin')` + `getAdminClient()` service_role bypass RLS + tracker local `localActionIds` pour cas a/b reussis + cleanup afterEach + afterAll cleanupAllFixtures global. test:integration delegue GHA `integration-tests.yml` au push (heritage `feedback_test_local_supabase`).
- **AC16-AC19 (CI)** : tsc 0, lint 195 warnings (= baseline 7.A.6 preserve), lint:a11y-check 155 baseline preserve, check:as-any-global/admin/oracle-paywall/ip-spoofing tous exit 0, a11y:axe:check 0 delta Critical/Serious sur 7 parcours (regle CLAUDE.md durcie respectee), test:unit 49/49 verts en 1.02s.
- **AC20 (DECISIONS.md)** : section `## 2026-05-14 : CHECK XOR sur admin_actions_log.target_id / target_id_text (decision F-Epic7-A7)` ajoutee en fin de DECISIONS.md (~50 lignes). Contenu : contexte heritage 3.5 D1, decision option (a) CHECK BDD + DROP NOT NULL, rationale (pattern NOT VALID + VALIDATE justifie 3 raisons + DROP NOT NULL justifie 3 raisons), alternative helper centralise rejetee 3 raisons (scope explosif 29 call-sites, pas de benefice runtime vs CHECK BDD, candidat Epic 8+), refactor parrainage.ts:176 option A heritage, migration + tests references, regle pattern futur "tout invariant X XOR Y -> CHECK BDD via NOT VALID + VALIDATE quand rows historiques existent".
- **AC21 (Sentry 7j)** : calendrier passif a logger post-merge dans memoire `project_epic_7_cadrage` (declencheur ~2026-05-21). Audit attendu : 0 erreur Postgres 23514 tag `flow='admin_actions_log'` ou message contenant `target_id_xor`.
- **Estimation vs realise** : cadrage epic-7.md ligne 264 = 0.25j-dev, realiste cadrage story = 0.3-0.4j-dev. Realise reel : ~1h30 (audit MCP + migration + types + 1 refactor + tests + DECISIONS + sprint-status + validations) = ~0.2j-dev (sous estimation initiale). Pattern aligne 7.A.6 a permis vitesse d'execution (audit MCP + apply MCP + regen types + tests integration meme structure).

### File List

- `supabase/migrations/20260514124223_admin_actions_log_target_id_xor_check.sql` (nouveau, ~70 lignes : DO IF NOT EXISTS + ADD CONSTRAINT NOT VALID + VALIDATE + ALTER COLUMN DROP NOT NULL + 3 COMMENT ON)
- `types/supabase.ts` (modifie : header L5 + 3 lignes structurelles target_id `string` -> `string | null`)
- `app/actions/parrainage.ts` (modifie : ajout throw fail-loud lignes 113-122 + simplification ligne 189 `?? null` -> direct)
- `tests/integration/admin-actions-log/check-xor-target-id.test.ts` (nouveau, 135 lignes : 4 cas a/b/c/d via vitest + getAdminClient + createTestUser + cleanupAllFixtures)
- `DECISIONS.md` (modifie : ajout section F-Epic7-A7 fin de fichier ~50 lignes)
- `_bmad-output/implementation-artifacts/7-a-7-check-xor-admin-actions-log-target-id.md` (modifie : Status review + Tasks 1-6 checkboxes [x] + Dev Agent Record rempli + Change Log entry)
- `_bmad-output/implementation-artifacts/sprint-status.yaml` (modifie : `7-a-7-check-xor-admin-actions-log-target-id: ready-for-dev` -> `in-progress` -> `review` + commentaire detaille en tete fichier)

**Total** : 7 fichiers touches (3 nouveaux + 4 modifies) ~290 lignes nettes ajoutees / 5 supprimees = ~285 net. Aligne sur estimation cadrage story 240 lignes (+45 imputable Dev Agent Record + DECISIONS plus etoffes + refactor parrainage.ts plus chirurgical que prevu avec throw fail-loud).

### Change Log

| Date | Auteur | Description |
|---|---|---|
| 2026-05-14 | claude-opus-4-7 | Story 7.A.7 creee status ready-for-dev via bmad-create-story. CHECK XOR target_id / target_id_text + DROP NOT NULL target_id. 21 AC : audit MCP pre/post (AC1-AC2 + AC6-AC7), migration NOT VALID + VALIDATE + DROP NOT NULL + 3 COMMENT (AC3-AC5), regen types (AC8-AC9), refactor 1 call-site parrainage.ts:176 (AC10-AC12), 4 tests integration (AC13-AC15), garde-fous CI (AC16-AC19), decision DECISIONS.md F-Epic7-A7 (AC20), audit Sentry J+7 (AC21). Estimation 0,25j-dev cadrage epic-7.md, realiste 0.3-0.4j-dev. Audit MCP 2026-05-14 : 85 rows 100% uuid_only, 0 row dpt/region, cutover safe. Source : deferred-work.md ligne 175 + epic-7.md lignes 242-265 + memoire project_admin_actions_log_target_id_bug. |
| 2026-05-14 | claude-opus-4-7 | Story 7.A.7 livree via bmad-dev-story. Migration `20260514124223_admin_actions_log_target_id_xor_check.sql` apply MCP success premiere tentative. Audits MCP pre/post tous OK : `target_id_xor` VALIDATED, `target_id` nullable=YES, 0 row corrompue, 2 INSERT rejets fonctionnels confirmes (both-null + both-set) avec code 23514. types/supabase.ts regen MCP : 3 lignes structurelles modifiees (Row+Insert+Update `target_id: string` -> `string | null`) + header L5 maj. `app/actions/parrainage.ts` refactore : option A retenue (audit grep des 2 callers confirme `parrainageId` toujours non-null), throw fail-loud ajoute en tete de `revokeFilleuleValidation` lignes 113-122 + simplification ligne 189 `?? null` supprime. Audit grep AC11 post-modif : 27 occurrences `target_id:` total (24 UUID + 2 dpt/region null + 1 refactore), 28 autres call-sites inchanges (`toggleDepartement`/`toggleRegion` deja conformes XOR). Nouveau test integration `tests/integration/admin-actions-log/check-xor-target-id.test.ts` (135 lignes, 4 cas a/b/c/d). DECISIONS.md F-Epic7-A7 ajoutee ~50 lignes (rationale + pattern NOT VALID + VALIDATE justifie + DROP NOT NULL justifie + helper centralise rejete + regle pattern futur "tout invariant X XOR Y -> CHECK BDD"). Validations locales toutes vertes : tsc 0, lint 195 warnings (= baseline 7.A.6), lint:a11y-check 155 baseline preserve, check:as-any-global/admin/oracle-paywall/ip-spoofing tous exit 0, a11y:axe:check 0 delta Critical/Serious sur 7 parcours (regle CLAUDE.md durcie), test:unit 49/49 verts en 1.02s. test:integration delegue GHA workflow integration-tests.yml au push branche (heritage `feedback_test_local_supabase`). 7 fichiers touches (3 nouveaux + 4 modifies) ~285 lignes nettes. AC1-AC20 satisfaits cote dev, AC21 (audit Sentry J+7 calendrier passif) deferre Sylvain post-merge ~2026-05-21 + maj memoires `project_epic_7_cadrage` + `project_admin_actions_log_target_id_bug` post-merge. |

## DoD a11y

> **Aucun impact UI** : la story modifie uniquement le schema BDD `admin_actions_log` (CHECK XOR + DROP NOT NULL) + regen types/supabase.ts + 1 ligne refactor server-only `app/actions/parrainage.ts` + 1 test integration + DECISIONS.md. Pas de composant React touche, pas de markup, pas de focus/ARIA/clavier. La regle CLAUDE.md `npm run a11y:axe:check` exit 0 reste verifiee par habitude avant commit livraison (Task 6.5) mais aucun delta attendu.

A renseigner pour toute story avec impact UI (ignorer si pas de changement visuel/interactif) :

- [ ] Labels associes aux champs (`htmlFor` ou `aria-labelledby`)
- [ ] Erreurs liees aux champs via `aria-describedby` + `aria-invalid`
- [ ] Focus visible sur tous les elements interactifs (contraste >= 3:1)
- [ ] Contrastes texte >= 4,5:1 et UI >= 3:1
- [ ] ARIA states corrects sur composants dynamiques (`aria-expanded`, `aria-selected`, etc.)
- [ ] Navigation clavier complete (Tab, Enter, Escape, fleches selon pattern)
- [ ] Verification ponctuelle au lecteur d'ecran (VoiceOver ou NVDA) sur le composant touche
- [ ] Pas de regression `eslint-plugin-jsx-a11y` (`npm run lint:a11y-check` vert en CI)
- [ ] Pas de regression axe-core (`npm run a11y:axe:check` vert ou delta documente avec justification dans la PR)
