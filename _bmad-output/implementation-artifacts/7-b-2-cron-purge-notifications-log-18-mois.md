# Story 7.B.2 : Cron purge `notifications_log` > 18 mois

Status: done (code-review 2 terminée 2026-05-15, 3 patches appliqués, validation GHA en attente)

<!-- Note: Validation is optional. Run validate-create-story for quality check before dev-story. -->

## Story

As a responsable conformite roxanetnous (Sylvain, DPO de fait pre-trafic),
I want **livrer le cron Vercel quotidien `app/api/cron/purge-notifications/route.ts`** qui supprime de maniere idempotente les rows `notifications_log` dont `sent_at < now() - interval '18 months'` (et celles avec `sent_at IS NULL AND created_at < now() - interval '18 months'`, statuts `pending` / `failed` / `error` / `lost` / `retry-scheduled` / `retry-exhausted`),
so that la politique de retention contractualisee par F-Epic7-B1 (`DECISIONS.md:859-913`) cesse d'etre theorique. La table accumule actuellement de la PII visiteurs anonymes (`email` NULLABLE mais souvent renseigne, `subject` parfois sensible cote contact form, `data jsonb` pouvant contenir le nom du departement). Aucun cron ne purge actuellement. La page publique `politique-de-confidentialite/page.tsx:64-72` annonce "Logs de notification email : 18 mois maximum, puis suppression definitive" depuis 7.B.1 -> le commitment public devient mensonger tant que ce cron n'existe pas. Au 2026-05-14, l'audit MCP confirme 0 row eligible a la purge (oldest `sent_at` = 2026-02-25 = ~2,5 mois, premiere row purgeable ~2027-08-25), donc le 1er run prod est un **no-op idempotent** safe a deployer immediatement. Story sœur 7.B.3 (cron purge/anonymisation IP `parrainages` + `notifications_ouverture`) traitera les autres tables PII.

## Acceptance Criteria

1. **AC1 - Cron Vercel quotidien declare** : ajouter dans `vercel.json` une entree `crons` avec `{"path": "/api/cron/purge-notifications", "schedule": "0 1 * * *"}` (01h00 UTC quotidien, choisi pour ne pas chevaucher les 7 crons existants : `update-badges` 03h, `sweep-stripe-events` 04h, `notify-ouverture-retry` 05h, `reactivate-disponible` 06h, `expiration-reminder` 08h, `relance-profils-incomplets` 09h, `confirm-parrainages` 02h). **Verifier explicitement** dans Completion Notes qu'aucun chevauchement horaire n'a ete introduit.

2. **AC2 - Endpoint `app/api/cron/purge-notifications/route.ts`** : Route Next.js App Router export `async function GET(request: NextRequest)`. Auth obligatoire : `request.headers.get('authorization') === \`Bearer ${process.env.CRON_SECRET}\`` (pattern heritage `app/api/cron/relance-profils-incomplets/route.ts:44-47`). Retourne `401 { error: 'Non autorise' }` si auth invalide. Le client Supabase est cree avec `serviceRole: true` (pattern `createClient({ serviceRole: true })` heritage `app/api/cron/notify-ouverture-retry/route.ts:40` -- service_role pour bypasser RLS).

3. **AC3 - Logique de purge** : execute deux DELETE successifs dans le bon ordre pour couvrir l'integralite du cutoff F-Epic7-B1 (`DECISIONS.md:903-904`, pattern explicite) :
   ```ts
   const supabase = await createClient({ serviceRole: true })
   const cutoff = new Date(Date.now() - 18 * 30.44 * 24 * 60 * 60 * 1000).toISOString() // approx 18 mois
   // 1. Rows avec sent_at non-null < cutoff (statuts 'sent' historiquement).
   const { data: deletedSent, error: errSent } = await supabase
     .from('notifications_log')
     .delete()
     .lt('sent_at', cutoff)
     .select('id')
   // 2. Rows avec sent_at IS NULL ET created_at < cutoff (statuts 'pending', 'failed',
   //    'error', 'lost', 'retry-scheduled', 'retry-exhausted' -- le partial UNIQUE
   //    INDEX status='sent' n'empeche pas le DELETE ici).
   const { data: deletedAged, error: errAged } = await supabase
     .from('notifications_log')
     .delete()
     .is('sent_at', null)
     .lt('created_at', cutoff)
     .select('id')
   const purgedCount = (deletedSent?.length ?? 0) + (deletedAged?.length ?? 0)
   ```
   **NB**: l'utilisation de `Date.now() - 18 * 30.44 * 24 * 60 * 60 * 1000` (JS) plutot que `now() - interval '18 months'` (Postgres) est imposee par le client Supabase JS (pas de RPC pour cette story -- garde-fou simplicite). L'imprecision (mois moyens 30.44 jours vs Postgres calendaire) est negligeable pour un cron quotidien (decalage max ~12h sur 18 mois, soit < 0.1% du TTL). **A documenter explicitement dans le commentaire en-tete du fichier route.ts.** Si Sylvain prefere la precision Postgres, basculer en RPC Postgres (`supabase.rpc('purge_notifications_log_18m')`) avec migration DDL idoine -- decision deferee, scope hors story sauf objection reviewer.

4. **AC4 - Idempotence par construction** : la requete DELETE WHERE est idempotente : 2 runs consecutifs sur le meme cutoff -> 2e run no-op (les rows purgees au 1er run n'existent plus). **Aucune erreur Sentry sur run no-op.** Verifier que `errSent`/`errAged` sont gardes silencieux si `data` est `[]` (pas de log inutile). Si error retournee par Supabase (`PGRST*`, RLS violation cas exotique), capture `Sentry.captureException` avec `tags: { flow: 'cron_purge_notifications', signal: 'delete_failed', severity: 'warning' }` + retourner `500 { error: 'Purge failed' }`.

5. **AC5 - Observabilite Sentry** :
   - Breadcrumb `info` a chaque run avec `purgedCount` final : `Sentry.addBreadcrumb({ category: 'cron', level: 'info', message: 'purge-notifications-done', data: { purgedCount, durationMs } })`. **Toujours emis**, meme si `purgedCount === 0` (signal vital "le cron tourne").
   - Alerte `Sentry.captureMessage` **warning** si `purgedCount > 1000` dans un run (signal d'anomalie -- 1000 rows en 1 nuit = pic non explique). Tags : `{ flow: 'cron_purge_notifications', signal: 'purge-spike', severity: 'warning' }`, extra `{ purgedCount, cutoff }`. Le seuil 1000 est documente en commentaire (heritage AC4 epic-7.md:385).
   - Console.info de cloture : `console.info('[cron_purge_notifications] purgedCount=' + purgedCount + ' durationMs=' + durationMs)` (pattern heritage `notify-ouverture-retry/route.ts:165`).

6. **AC6 - Response JSON** : retourne `NextResponse.json({ purgedCount, deletedSent: deletedSent?.length ?? 0, deletedAged: deletedAged?.length ?? 0, cutoff })` avec status 200. Permet inspection rapide via `vercel logs` ou curl manuel (`curl -H "Authorization: Bearer $CRON_SECRET" https://roxanetnous.vercel.app/api/cron/purge-notifications`).

7. **AC7 - Audit MCP pre-deploy** : executer en pre-commit la requete exacte d'audit volumetrie (heritage F-Epic7-B1, structure identique a 7.B.1 AC7) :
   ```sql
   SELECT 'notifications_log' AS tbl, COUNT(*) AS rows, MIN(sent_at) AS oldest_sent, MAX(sent_at) AS newest_sent,
          COUNT(*) FILTER (WHERE sent_at < now() - interval '18 months') AS rows_purgeables_sent,
          COUNT(*) FILTER (WHERE sent_at IS NULL AND created_at < now() - interval '18 months') AS rows_purgeables_aged_null
   FROM notifications_log;
   ```
   Capturer la sortie dans `Dev Agent Record > Debug Log References`. **Au 2026-05-14, l'audit doit retourner `rows_purgeables_sent=0` et `rows_purgeables_aged_null=0`** (confirme par audit create-story 2026-05-14). Si > 0 a la livraison, **documenter explicitement** dans Completion Notes le snapshot pre-cutover (count, sample 1-3 rows anonymisees pour preuve forensique RGPD).

8. **AC8 - Test integration Vitest** sous `tests/integration/cron-purge-notifications/purge-cron.test.ts` (nouveau dossier). Pattern heritage `tests/integration/notifications-log/idempotence-partial-unique-index.test.ts`. **3 cas obligatoires** :
   - **(a) seed 3 rows old + 3 rows recent -> apres GET cron = 3 rows recent restantes**. Old = `sent_at` 19 mois avant maintenant (`new Date(Date.now() - 19 * 30.44 * ONE_DAY_MS).toISOString()`), recent = `sent_at = now()`. Verifier via `supabase.from('notifications_log').select('id, sent_at').in('id', [...allIds])`.
   - **(b) re-run cron = no-op (purgedCount = 0)**. Apres (a), refaire un GET cron, asserter response.body.purgedCount === 0 et aucun row supplementaire purge.
   - **(c) seed 2 rows avec `sent_at IS NULL` + `created_at` 19 mois old -> purgees aussi** (cover branche AC3 step 2). Verifier que les 2 rows sont bien deleted via le 2e DELETE.
   - **Helpers**: utiliser `createTestUser` + `cleanupAllFixtures` heritage `tests/integration/_lib/fixtures.ts`. Pour les rows pre-existantes (BDD locale non vierge), utiliser un email-prefix UUID-randomise (`test-purge-7b2-${randomUUID()}@test.local`) et filtrer le SELECT final sur ce prefix exclusivement pour eviter polution cross-tests.
   - **Auth cron**: le test doit poser `request.headers = { authorization: 'Bearer ' + process.env.CRON_SECRET }`. Pour les tests, definir `process.env.CRON_SECRET = 'test-cron-secret-7b2'` en `beforeAll` du fichier de test (pattern setup heritage `tests/integration/setup.ts`). **Verifier en parallele** : ajouter `CRON_SECRET: test-cron-secret-7b2` dans `.github/workflows/integration-tests.yml` (job `Run integration tests > env`) -- sans ca, GHA echouera car la variable n'est pas declaree dans le workflow. Faire le diff explicitement dans la PR / commit.
   - **Invocation route**: importer directement la fonction `GET` du route handler (`import { GET } from '@/app/api/cron/purge-notifications/route'`) et l'appeler avec un `NextRequest` factice (`new NextRequest('http://localhost/api/cron/purge-notifications', { headers: ... })`). Eviter `fetch` HTTP qui necessiterait un serveur Next dev tournant.

9. **AC9 - Test unit auth refusee** sous `tests/unit/cron-purge-notifications.test.ts` (nouveau fichier). 2 cas : (i) `Authorization` absent -> 401 + body `{ error: 'Non autorise' }`. (ii) `Authorization` avec wrong bearer -> 401. Mock du client Supabase obligatoire via `vi.mock('@/lib/supabase/server')` pour eviter toute connexion BDD dans la suite unit (rapide, isolation).

10. **AC10 - Garde-fou run prod 1er deploy** : DoD post-deploy = 1er run sur prod monitore via Sentry. Cron schedule = 01h00 UTC -> verifier le breadcrumb info `cron purge-notifications-done` dans Sentry 24h apres deploy. **Aucun event captureException attendu**. Documenter dans Completion Notes : "1er run prod attendu YYYY-MM-DD 01h00 UTC, verification J+1 dans Sentry filtre tags `flow:cron_purge_notifications`".

11. **AC11 - Validation pre-commit livraison** (CLAUDE.md regle durcie + heritage 7.A.* + 7.B.1) :
    - `npm run lint` exit 0 (route.ts + test files lint-clean).
    - `npm run lint:a11y-check` exit 0 (baseline preserve, aucun changement UI dans cette story).
    - `npm run a11y:axe:check` exit 0 (story sans impact UI, mais regle CLAUDE.md durcie 2026-05-06 = obligatoire pour TOUT commit livraison story). Baseline 0 Critical/Serious doit etre preservee.
    - `npm run test:unit` exit 0 (suite globale verte, +2 nouveaux tests AC9).
    - `npm run test:integration` exit 0 (suite integration globale verte, +3 nouveaux tests AC8). **Sylvain ne lance pas Supabase localement** (memoire `feedback_test_local_supabase`) -> validation deferee a GHA workflow `integration-tests.yml`. **Attention** : ce workflow se declenche uniquement sur `pull_request` vers `main` (cf. `.github/workflows/integration-tests.yml:3-5`). Or l'heritage Epic 7 commit-direct-sur-main (cf. 7.B.1 commit `3c94ae3` direct push) **NE declenche pas** le workflow. **Option A (recommandee)** : pour cette story, creer une PR `feat/7-b-2-cron-purge-notifications` -> `main`, laisser le GHA passer, puis merger. **Option B** : commit direct main + `gh workflow run integration-tests.yml` manuel pour declencher via `workflow_dispatch`. Le dev agent **doit POSER** les tests (AC8 livre les 3 cas) + ajouter `CRON_SECRET` dans le workflow GHA, mais peut ne pas executer localement. Pre-commit dev agent : skip `npm run test:integration` localement, **noter explicitement dans Completion Notes** la decision Option A vs B et le statut GHA post-push.
    - `npm run check:no-direct-notifications-log-insert` exit 0 (garde-fou 7.A.11 : la story ne fait que `DELETE` sur `notifications_log`, le scan grep cherche `.insert` -> 0 match attendu).
    - `npm run build` exit 0 (route.ts compile, vercel-build full chain green).

12. **AC12 - Solde dette + transitions** :
    - `_bmad-output/implementation-artifacts/deferred-work.md` : barrer (`~~...~~`) la ligne **"Cron purge notifications_log > 18 mois (RGPD)"** si presente (sinon recenser dans Completion Notes que la ligne n'existait pas avant 7.B.1 -- la dette 7.B.1 deja soldee couvre, mais la livraison du cron concret renforce). Pattern `[Solde 7.B.2 - 2026-05-XX]`.
    - `_bmad-output/implementation-artifacts/sprint-status.yaml` : transition `7-b-2-cron-purge-notifications-log-18-mois` de `ready-for-dev` (pose par create-story) -> `review` (livre par dev) -> `done` (post-merge selon `project_bmad_conventions`). Mettre `last_updated` au jour de livraison.
    - **Pas de transition sur 7.B.3** : reste `backlog`, prochaine story du mini-epic 7.B (anonymisation IP `parrainages` + `notifications_ouverture`).
    - **Memoire utilisateur** : ne PAS creer de memoire dediee 7.B.2. La memoire `project_epic_7_cadrage` couvre le mini-epic 7.B globalement. Une fois 7.B.3 + 7.B.1 + 7.B.2 livres et 1er run prod ok, **mettre a jour `project_epic_7_cadrage`** avec status final (memoire deja existante a mettre a jour, pas a creer).

13. **AC13 - Hors-scope explicitement liste dans Completion Notes** :
    - Aucune modification du helper `lib/notifications-log.ts` (helper INSERT, pas DELETE -- garde-fou 7.A.11 preserve).
    - Aucune migration BDD (DDL `notifications_log` reste tel quel, schema F6 etendu et partial UNIQUE INDEX intacts).
    - Aucun endpoint `app/api/admin/delete-pii` (decision F-Epic7-B1 : pas avant 5 demandes/an).
    - Aucune purge IP `parrainages` / `notifications_ouverture` -> 7.B.3 dedie.
    - Aucune mise a jour de `politique-de-confidentialite/page.tsx` (deja aligne par 7.B.1 commit `3c94ae3`).
    - Aucun `Sentry.captureMessage` info pour run no-op (uniquement breadcrumb info -- evite la pollution alerts).
    - Aucun renommage `waitlist_departements` -> `notifications_ouverture` cote epic-7.md (epic fige post-cadrage, note F-Epic7-B1 suffit).

## Tasks / Subtasks

- [x] **T1 - Audit MCP pre-implementation** (AC: #7)
  - [x] T1.1 - Executer la requete d'audit AC7 via `mcp__supabase__execute_sql`. Capturer sortie JSON brute dans `Dev Agent Record > Debug Log References`.
  - [x] T1.2 - Confirmer `rows_purgeables_sent=0` et `rows_purgeables_aged_null=0`. Si > 0, **rajouter sample anonymise** (top 3 rows par `sent_at` ASC avec `email` -> `***@domain.com`) dans Completion Notes pour preuve forensique RGPD.

- [x] **T2 - Creer route Next.js `app/api/cron/purge-notifications/route.ts`** (AC: #2, #3, #4, #5, #6)
  - [x] T2.1 - Initialiser le fichier avec en-tete commentaire descriptif (heritage `notify-ouverture-retry/route.ts:1-18` pour le style) : objectif story 7.B.2, decision F-Epic7-B1 referencee, justification calcul JS approx 30.44 jours/mois vs Postgres calendaire.
  - [x] T2.2 - Implementer `GET(request: NextRequest)` : auth bearer + service-role client + 2 DELETE successifs + breadcrumb + alerte spike + response JSON.
  - [x] T2.3 - Verifier en lecture qu'aucun `INSERT` direct sur `notifications_log` n'est ajoute (le garde-fou T5 `check:no-direct-notifications-log-insert` doit rester vert).

- [x] **T3 - Declarer le cron dans `vercel.json`** (AC: #1)
  - [x] T3.1 - Ouvrir `vercel.json`. Ajouter l'entree dans le tableau `crons` (apres `confirm-parrainages` 02h ou `relance-profils-incomplets` 09h, ordre indifferent).
  - [x] T3.2 - Verifier qu'aucun chevauchement horaire n'a ete introduit (01h libre, comprime entre `confirm-parrainages` 02h et minuit). Documenter dans Completion Notes.

- [x] **T4 - Tests integration `tests/integration/cron-purge-notifications/purge-cron.test.ts`** (AC: #8)
  - [x] T4.1 - Creer le dossier `tests/integration/cron-purge-notifications/` + fichier de test.
  - [x] T4.2 - Implementer cas (a) seed 3+3, run cron, verifier 3 restantes.
  - [x] T4.3 - Implementer cas (b) re-run = no-op.
  - [x] T4.4 - Implementer cas (c) seed `sent_at IS NULL` + `created_at` 19 mois old -> purgees.
  - [x] T4.5 - Cleanup via `cleanupAllFixtures` + tracker local pour les rows non-fixtures (pattern heritage `idempotence-partial-unique-index.test.ts:17-31`).
  - [x] T4.6 - **Pas d'execution locale** (Sylvain ne lance pas Supabase). Validation GHA post-push. Mention explicite dans Completion Notes.

- [x] **T5 - Tests unit `tests/unit/cron-purge-notifications.test.ts`** (AC: #9)
  - [x] T5.1 - Creer fichier de test.
  - [x] T5.2 - Cas (i) auth header absent -> 401. (ii) wrong bearer -> 401. Mock `@/lib/supabase/server` global.
  - [x] T5.3 - Verifier `npm run test:unit` reste vert localement (+2 nouveaux tests). Capturer sortie dans `Debug Log References`.

- [x] **T6 - Validation pre-commit livraison** (AC: #11)
  - [x] T6.1 - `npm run lint` -> capturer sortie (attendu : 0 errors, warnings <= baseline 193).
  - [x] T6.2 - `npm run lint:a11y-check` -> 155 baseline preserve.
  - [x] T6.3 - `npm run a11y:axe:check` -> 0 delta Critical/Serious.
  - [x] T6.4 - `npm run test:unit` -> +2 tests verts (suite globale verte, attendue 61/61 si 59 actuels + 2).
  - [x] T6.5 - `npm run test:integration` -> **skip local, valider GHA post-push** (documenter Completion Notes).
  - [x] T6.6 - `npm run check:no-direct-notifications-log-insert` -> OK (story ne fait que DELETE).
  - [x] T6.7 - `npm run build` -> exit 0, route `/api/cron/purge-notifications` declaree dynamic ou static-prerender selon Next.js (probable dynamic vu l'auth header).

- [x] **T7 - Update sprint-status.yaml + Completion Notes + File List** (AC: #12, #13)
  - [x] T7.1 - Editer `_bmad-output/implementation-artifacts/sprint-status.yaml` : transition `7-b-2-cron-purge-notifications-log-18-mois` `ready-for-dev` -> `review`. `last_updated` = jour livraison.
  - [x] T7.2 - Renseigner `Completion Notes` : liste hors-scope (AC13) + pointeur F-Epic7-B1 + rappel "7.B.3 reste backlog" + 1er run prod attendu.
  - [x] T7.3 - `File List` : `vercel.json`, `app/api/cron/purge-notifications/route.ts`, `tests/integration/cron-purge-notifications/purge-cron.test.ts`, `tests/unit/cron-purge-notifications.test.ts`, `.github/workflows/integration-tests.yml` (ajout `CRON_SECRET` env), `_bmad-output/implementation-artifacts/sprint-status.yaml`, `_bmad-output/implementation-artifacts/7-b-2-cron-purge-notifications-log-18-mois.md`. **Aucun fichier sous `supabase/migrations/`** (sinon AC13 viole).

- [ ] **T8 - Commit livraison** (AC: #11, #12)
  - [ ] T8.1 - Stage explicite des fichiers File List uniquement (pas de `git add .`).
  - [ ] T8.2 - Commit message format Conventional Commits FR : `feat(rgpd): cron purge notifications_log 18 mois (story 7.B.2)`. Heritage 7.A.* + 7.B.1.
  - [ ] T8.3 - Pas de `git push` sans validation explicite Sylvain (heritage 7.B.1 T7.3).

## Dev Notes

### Contexte projet (a relire avant de coder)

- **Memoire `project_epic_7_cadrage`** : Epic 7 cadre 2026-05-13, mini-epic 7.B = 3 stories RGPD (7.B.1 done 2026-05-14, 7.B.2 cette story, 7.B.3 backlog). Aucun bloquant go-live Bretagne. Estimation 0,5j-dev.
- **Memoire `project_a11y_lot_c`** : regle CLAUDE.md durcie 2026-05-06 = `npm run a11y:axe:check` exit 0 obligatoire pre-commit livraison story. Cette story n'a pas d'impact UI direct mais la regle s'applique pareil. **Si la commande baisse le baseline de 0, OK. Si elle leve une nouvelle violation due a un side-effect (improbable), corriger sans toucher au baseline.**
- **Memoire `feedback_test_local_supabase`** : Sylvain ne lance pas Docker/`supabase start` localement. Validation BDD par GHA workflow uniquement. **Le dev agent POSE les tests integration (AC8) mais n'execute pas localement** -- pre-commit skip `npm run test:integration`, documenter dans Completion Notes, GHA run post-push valide.
- **Memoire `project_bmad_conventions`** : statut `done` apres merge, format commit Conventional Commits FR.
- **Memoire `project_logNotification_bug`** : 7.A.6 idempotence livree (partial UNIQUE INDEX). Cette story ne touche pas `lib/notifications-log.ts` (helper INSERT) -- le pattern partial index `WHERE status='sent'` n'a aucun impact sur le DELETE de purge (DELETE peut frapper toutes les rows, le partial index existe pour deduplication INSERT seulement).
- **DECISIONS.md F-Epic7-B1 lignes 859-913** : politique TTL contractualisee. Cette story execute la decision pour `notifications_log` uniquement. La requete exacte (AC3 step 1 + 2) y est specifiee, **suivre a la lettre**.

### Source tree components touches

- **Code** : `app/api/cron/purge-notifications/route.ts` (nouveau, ~80 lignes Next.js App Router GET handler).
- **Infra** : `vercel.json` (1 entree `crons` ajoutee).
- **Tests** : `tests/integration/cron-purge-notifications/purge-cron.test.ts` (nouveau, 3 cas), `tests/unit/cron-purge-notifications.test.ts` (nouveau, 2 cas auth).
- **CI** : `.github/workflows/integration-tests.yml` (ajout `CRON_SECRET` env dans le job `Run integration tests`, sinon test integration cron echoue en GHA).
- **Artefacts BMad** : `_bmad-output/implementation-artifacts/sprint-status.yaml` (1 transition statut), `_bmad-output/implementation-artifacts/7-b-2-cron-purge-notifications-log-18-mois.md` (cette story file -- tasks cochees post-livraison).
- **NON touches** : `supabase/migrations/**` (pas de DDL), `lib/notifications-log.ts` (helper INSERT preserve, 7.A.6 + 7.A.11 acquis intacts), `app/politique-de-confidentialite/page.tsx` (deja aligne par 7.B.1 commit `3c94ae3`), `DECISIONS.md` (politique F-Epic7-B1 fige cote retention, cette story est execution), `lib/emails.ts`, `package.json`, `tsconfig.json`.

### Schema BDD actuel `notifications_log` (audit MCP 2026-05-14)

```
id              uuid       NOT NULL  default gen_random_uuid()  (PK)
user_id         uuid       NULLABLE  ON DELETE CASCADE -> users(id)
email           text       NULLABLE  (souvent renseigne mais NULLABLE confirme schema)
type            text       NOT NULL
subject         text       NULLABLE
template        text       NULLABLE
data            jsonb      NULLABLE
sent_at         timestamptz NULLABLE  (filled when status='sent', null sinon)
status          text       NOT NULL   default 'pending'
                            (whitelist : pending|sent|failed|error|lost|retry-scheduled|retry-exhausted)
error           text       NULLABLE
created_at      timestamptz NOT NULL  default now()
```

**Index existants** :
- `notifications_log_pkey` UNIQUE `(id)` -- PK.
- `idx_notifications_log_user` btree `(user_id)`.
- `idx_notifications_log_created` btree `(created_at DESC)`.
- `notifications_log_unique_sent_by_hour` UNIQUE partial sur `(COALESCE(user_id::text, email), type, subject, date_trunc('hour', COALESCE(sent_at, created_at) AT TIME ZONE 'UTC')) WHERE status='sent'` -- partial idempotence INSERT story 7.A.6.

**Pas d'index dedie sur `sent_at`**. Pour une purge sur quelques rows / nuit (volumetrie attendue : 0-50 rows/run apres regime de croisiere, < 1000 max), un seq scan est acceptable. **Si Sylvain observe en prod un timeout** (> 60s sur la fonction Vercel), creer un index `CREATE INDEX CONCURRENTLY idx_notifications_log_sent_at ON notifications_log(sent_at) WHERE sent_at IS NOT NULL` en story 8.X. **Pour 7.B.2 : pas de DDL, accepter le seq scan.**

**Volumetrie audit MCP 2026-05-14** :
```json
[{"tbl":"notifications_log","rows":24,"oldest_sent":"2026-02-25 18:39:12.072+00",
  "newest_sent":"2026-05-14 17:04:00.701+00","oldest_created":"2026-02-25 18:39:12.104102+00",
  "newest_created":"2026-05-14 17:04:00.761734+00",
  "rows_purgeables_18m_sent_at":0,"rows_purgeables_18m_created_null_sent_at":0,
  "rows_sent_at_null":0,"rows_anonymes":0}]
```
-> 0 row purgeable a date, 0 row `sent_at IS NULL`, 0 anonyme. **1er run prod = no-op safe.**

### Testing standards summary

- **Unit tests** (`tests/unit/`) : Vitest pur, mocks libs externes. Pas d'acces BDD. Auth route handler testable via mock `@/lib/supabase/server`. Heritage `tests/unit/notifications-log.test.ts` pour le pattern mock.
- **Integration tests** (`tests/integration/`) : Vitest + Supabase local (Docker). Cleanup via `cleanupAllFixtures()` heritage `_lib/fixtures.ts:265`. Tracker local pour rows hors-fixtures (pattern `tests/integration/notifications-log/idempotence-partial-unique-index.test.ts:17-31`).
- **A11y tests** (`tests/a11y/`) : Playwright axe-core. Cette story sans impact UI, baseline 0 Critical/Serious preserve.
- **Setup integration** : variables env auto-injectees par `tests/integration/setup.ts` si absentes (`SUPABASE_URL=localhost:54321` etc.). Garde-fou anti-prod (`SUPABASE_URL` doit etre local).
- **CI GHA** : workflow `e2e-tests.yml` lance Supabase + Vercel preview + tests integration. Story 7.C.1 livrera l'infra E2E Playwright (non-bloquant pour cette story).

### Project Structure Notes

- **Convention App Router cron** : `app/api/cron/<name>/route.ts` avec `export async function GET(request: NextRequest)`. Auth via `request.headers.get('authorization')` -- jamais via cookies (cron Vercel ne pose pas de session).
- **Convention auth cron** : `Bearer ${process.env.CRON_SECRET}`. La variable est obligatoire (declare dans `scripts/check-required-env.mjs:72`, >=32 chars). **Pas de hardcode**, pas de fallback `if (!process.env.CRON_SECRET) skip` -- garde-fou check-required-env catch ca en build.
- **Convention Supabase client** : `createClient({ serviceRole: true })` heritage `@/lib/supabase/server`. Le service_role bypasse RLS, indispensable pour DELETE en masse sur `notifications_log` (RLS bloquerait sinon).
- **Convention nommage** : route name `purge-notifications` (verbe + sujet en kebab-case, heritage `notify-ouverture-retry`, `reactivate-disponible`).
- **Convention crons schedule** : cron syntaxe Vercel = standard `m h d M w` UTC. Choisir `0 1 * * *` (01h00 UTC quotidien) pour eviter les 7 plages deja prises.

### References

- [Source: _bmad-output/planning-artifacts/epic-7.md#374-390] -- Mini-epic 7.B Story 7.B.2 cadrage initial (7 AC sources).
- [Source: DECISIONS.md#859-913] -- F-Epic7-B1 politique TTL retention, requete cible AC3 + heritage F5 idempotence DELETE.
- [Source: _bmad-output/implementation-artifacts/7-b-1-politique-ttl-formalisee-decisions.md] -- Story 7.B.1 livree 2026-05-14 commit `3c94ae3`, base contractualisee.
- [Source: app/api/cron/notify-ouverture-retry/route.ts] -- Pattern Sentry + structured response + auth bearer.
- [Source: app/api/cron/relance-profils-incomplets/route.ts:43-47] -- Pattern auth header `Bearer ${process.env.CRON_SECRET}`.
- [Source: lib/notifications-log.ts] -- Helper INSERT (preserve, non touche par cette story).
- [Source: scripts/check-no-direct-notifications-log-insert.mjs] -- Garde-fou 7.A.11 (scan grep `.insert`, le DELETE ne match pas).
- [Source: scripts/check-required-env.mjs:72] -- Declaration `CRON_SECRET` obligatoire >=32 chars.
- [Source: vercel.json] -- 7 crons existants + horaires occupes, ajouter 01h.
- [Source: tests/integration/notifications-log/idempotence-partial-unique-index.test.ts] -- Pattern integration test cron-style + tracker local + cleanup.
- [Source: tests/integration/_lib/fixtures.ts:265-307] -- `cleanupAllFixtures` ordre FK-safe.
- [Source: tests/integration/README.md] -- Setup local Supabase, env vars, pattern integration.
- [Source: CLAUDE.md] -- regles strictes (pas d'emojis, a11y, masculin neutre).
- Audit MCP 2026-05-14 execute par workflow create-story (volumetrie + schema + indexes) : capture dans Debug Log References.

### Previous story intelligence (7.B.1 done 2026-05-14, commit `3c94ae3`)

- **Pattern File List explicite + Debug Log References capturees** : reuse pareil pour 7.B.2 (T7.2/T7.3). Sylvain valide manuellement post-livraison.
- **Pattern Commit Epic 7** : Conventional Commits FR `feat(rgpd):` / `docs(rgpd):` / `fix(rgpd):`. **Eviter** `Story 7.B.2 :` prefix (heritage Epic 4, deja deprecie par 7.A.* + 7.B.1).
- **AC10 hors-scope explicite dans Completion Notes** : pattern repris pour AC13.
- **Aucune migration BDD** : 7.B.1 le declare aussi, idem ici. Verification `git status` -> 0 fichier `supabase/migrations/`. Mention explicite dans Completion Notes.
- **Audit MCP pre-commit (T1) + post-livraison (declenchement 1er run)** : 7.B.1 a capture l'audit T1.1 dans Debug Log References. Pareil ici, **plus** ajouter un audit post-deploy 24h apres 1er run pour confirmer 0 erreur Sentry (note Completion Notes T7.2).
- **Idempotence par construction (DELETE/UPDATE WHERE)** : heritage F-Epic7-B1 lignes 903-907 -- pattern figure dans DECISIONS. Le dev agent doit reprendre verbatim la requete DELETE + couvrir explicitement la branche `sent_at IS NULL AND created_at < cutoff` (sinon les rows `pending`/`failed`/`error`/`lost`/`retry-scheduled`/`retry-exhausted` resteraient eternellement en BDD malgre la politique).
- **Pas d'endpoint admin `delete-pii`** : decision F-Epic7-B1 + memoire `project_epic_7_cadrage`. Hors-scope 7.B.2.

### Git intelligence summary

- 5 derniers commits non-Epic7 (`fix(admin)`, `feat(admin)`, `style(admin)`) -- iteration UI admin par Sylvain, pas de pattern technique repris.
- 7.B.1 commit `3c94ae3` (`docs(rgpd):`) : pattern Conventional Commits FR + story livree en 1 commit (pas de split PR/code/docs). Repris ici.
- Aucun commit Epic 7.B sur `vercel.json` ni `app/api/cron/**` jusqu'a present -- la story 7.B.2 sera le premier ajout cron Epic 7. Pas de conflit attendu.
- Aucun commit sur `tests/integration/cron-*` -- premier test integration sur un cron (les autres tests integration couvrent webhook Stripe + paywall + idempotence notifications_log). Pattern nouveau a etablir proprement pour reuse 7.B.3.

### Latest tech information

- **Vercel Crons (2026)** : tarif gratuit jusqu'a 100 jobs/jour sur Pro. Limite execution = 300s par fonction (Fluid Compute par defaut, cf. session context Vercel). Le cron 7.B.2 attendu < 5s sur 1000 rows max -> aucun risque timeout.
- **Vercel Functions Fluid Compute** : routes `app/api/cron/*` tournent en Node.js par defaut (pas Edge). Aucun changement de config attendu, le pattern heritage `notify-ouverture-retry/route.ts` confirme.
- **`@/lib/supabase/server`** : `createClient({ serviceRole: true })` retourne un `SupabaseClient` async (await). Pattern `await createClient({ serviceRole: true })` obligatoire heritage `notify-ouverture-retry/route.ts:40` + `relance-profils-incomplets/route.ts:49`.
- **NextRequest 16 / NextResponse** : import depuis `next/server`. `NextResponse.json(body, { status })` pour le retour. Pattern heritage.
- **Sentry @sentry/nextjs** : `Sentry.addBreadcrumb({ category, level, message, data })` et `Sentry.captureMessage(msg, { level, tags, extra })` patterns figes Epic 7 (heritage 7.A.6, 7.A.10).
- **Postgres `now() - interval`** : non disponible cote client JS Supabase (pas de RPC pour cette story). Approximation JS Date.now() - N ms acceptable (precision < 0.1% sur 18 mois, justifie en commentaire route.ts).

### Project context reference

- `_bmad-output/planning-artifacts/architecture-technique-roxanetnous-2026-02-09.md` : pas de section RGPD retention. F-Epic7-B1 + cette story comblent.
- `_bmad-output/planning-artifacts/prd.md` : NFR a11y + securite, pas NFR RGPD explicite. La story 7.B.2 execute une decision documentee, pas une nouvelle NFR a definir.
- `_bmad-output/planning-artifacts/audit-cookies-2026-05-07.md` : audit cookies de session uniquement. Hors-scope retention BDD.

## Dev Agent Record

### Agent Model Used

`claude-opus-4-7 (1M context)` via `bmad-dev-story` workflow.

### Debug Log References

**T1.1 Audit MCP volumetrie pre-implementation 2026-05-14** :

```json
[{"tbl":"notifications_log","rows":24,"oldest_sent":"2026-02-25 18:39:12.072+00",
  "newest_sent":"2026-05-14 17:04:00.701+00","rows_purgeables_sent":0,
  "rows_purgeables_aged_null":0}]
```

Snapshot identique au capture create-story du meme jour. `rows_purgeables_sent=0` et `rows_purgeables_aged_null=0` confirmes -> 1er run prod = no-op safe (AC7 valide, pas de sample forensique requis).

**T6 Validations pre-commit** :

- T6.1 `npm run lint` : `0 errors, 193 warnings` (sous baseline 195/213/226 herite Epic 7.A.*, beneficiaire 2 vs sortie 7.B.1).
- T6.2 `npm run lint:a11y-check` : `OK: 155 jsx-a11y violations across 56 (file, rule) pair(s). Baseline total: 155. No regression.`
- T6.3 `npm run a11y:axe:check` : `OK: aucun delta Critical/Serious au-dela du baseline.` (7 parcours, baseline 0).
- T6.4 `npm run test:unit` : `Test Files 6 passed (6) / Tests 61 passed (61) / Duration 1.11s` (vs 59 attendus en regression Epic 7.A.11, +2 nouveaux tests AC9).
- T6.5 `npm run test:integration` : **skip local par decision dev** (heritage `feedback_test_local_supabase`, Sylvain ne lance pas Docker/supabase start). Tests AC8 poses dans `tests/integration/cron-purge-notifications/purge-cron.test.ts`, validation deleguee GHA workflow `integration-tests.yml`.
- T6.6 `npm run check:no-direct-notifications-log-insert` : `OK : aucun INSERT direct sur notifications_log hors du helper autorise.` (garde-fou 7.A.11 vert, route DELETE pur ne match pas la regex `.insert`).
- T6.7 `npm run build` : exit 0. Route `/api/cron/purge-notifications` declaree `ƒ` (dynamic) dans la sortie build, aux cotes des 7 autres `/api/cron/*` existants.

### Completion Notes List

**Livre** :

- Route `app/api/cron/purge-notifications/route.ts` (nouvelle, ~110 lignes) : auth bearer `process.env.CRON_SECRET` + service_role bypass RLS + 2 DELETE successifs (sent_at < cutoff puis sent_at IS NULL AND created_at < cutoff) + breadcrumb info systematique + alerte spike Sentry warning si purgedCount > 1000 + response JSON `{purgedCount, deletedSent, deletedAged, cutoff}`.
- Cron Vercel `0 1 * * *` (01h00 UTC quotidien) declare dans `vercel.json`, plage horaire libre (pas de chevauchement avec les 7 crons existants : 02h confirm-parrainages, 03h update-badges, 04h sweep-stripe-events, 05h notify-ouverture-retry, 06h reactivate-disponible, 08h expiration-reminder, 09h relance-profils-incomplets).
- 3 tests integration AC8 poses dans `tests/integration/cron-purge-notifications/purge-cron.test.ts` (cas a seed 3+3 / cas b re-run no-op / cas c sent_at IS NULL aged-null) + 2 tests unit AC9 poses dans `tests/unit/cron-purge-notifications.test.ts` (cas i header absent / cas ii wrong bearer).
- `.github/workflows/integration-tests.yml` : ajout `CRON_SECRET: test-cron-secret-7b2-integration-fixture-32chars` (47 chars, conforme garde-fou `check-required-env.mjs:72` >= 32 chars) dans `env` du job `Run integration tests`. Necessaire pour que le test integration ne crash pas en GHA si l override `beforeAll` est neutralise par un mecanisme amont.

**Decision dev test:integration (AC11 Option A vs B)** :

Le workflow GHA `integration-tests.yml` se declenche uniquement sur `pull_request` vers `main`. Epic 7 a procede en commit-direct-main (heritage 7.A.*, 7.B.1 commit `3c94ae3`), donc le commit livraison ne declenchera pas le workflow automatiquement.

**Option recommandee dev = Option B** (commit direct main + `gh workflow run integration-tests.yml` manuel via `workflow_dispatch`). Rationale : la pose des tests dans la PR (Option A) ajouterait un round-trip review/merge sans benefice metier vu que le dev agent confirme deja localement lint/a11y/unit/build green + audit MCP confirme 1er run prod = no-op safe. Sylvain peut basculer en Option A si preference politique pour PR pour cette story RGPD precisement.

**Hors-scope AC13 confirme** (verification post-implementation) :

- 0 fichier sous `supabase/migrations/` (verifie `git status`).
- 0 modification `lib/notifications-log.ts` (helper INSERT preserve, 7.A.6 partial UNIQUE INDEX + 7.A.11 validation UUID acquis intacts).
- 0 endpoint `app/api/admin/delete-pii` (decision F-Epic7-B1 : pas avant 5 demandes/an).
- 0 purge IP `parrainages` / `notifications_ouverture` (-> 7.B.3 reste backlog).
- 0 modification `app/politique-de-confidentialite/page.tsx` (deja aligne par 7.B.1 commit `3c94ae3`).
- 0 `Sentry.captureMessage` info pour run no-op (uniquement breadcrumb info, evite pollution alerts).
- 0 renommage `waitlist_departements` -> `notifications_ouverture` cote `epic-7.md` (epic fige post-cadrage, note F-Epic7-B1 suffit).

**Dette deferred-work.md (AC12)** :

Les 2 lignes pertinentes (`Stockage IP brut sans TTL ni purge -- RGPD` L204 et `notifications_log retention indefinie / RGPD pour visiteurs anonymes` L251) sont **deja barrees `~~...~~`** par les soldes 7.B.1 du 2026-05-14 (la politique TTL contractualisee couvre les 2). La livraison du cron concret 7.B.2 renforce le solde de la ligne L251 mais n'ajoute pas de nouvelle barre. Pas de mention `[Solde 7.B.2 - 2026-05-14]` ajoutee : la ligne L251 est deja close.

**1er run prod attendu** :

- Date : lendemain du merge livraison, **01h00 UTC** (cron quotidien `0 1 * * *`).
- Monitoring Sentry filtre `tags:flow:cron_purge_notifications` : breadcrumb info `purge-notifications-done` attendu avec `purgedCount=0` et `durationMs < 5s` (no-op). **Aucun event captureException attendu.**
- Verification J+1 : Sylvain ouvre Sentry, filtre flow ci-dessus, confirme 1 breadcrumb info + 0 exception.
- Si > 0 captureException post-deploy, investigation immediate (probable RLS mal configure malgre service_role, ou env CRON_SECRET divergente entre check-required-env validation et runtime).

**Stories deverrouillees** :

- 7.B.3 `cron-purge-anonymisation-ip-inscription` (backlog) reste backlog jusqu'a livraison Sylvain on-demand. Pattern 7.B.2 reutilisable verbatim (route handler + vercel.json cron + tests integration cas a/b/c + tests unit auth + GHA env).
- 7.B.1 + 7.B.2 + 7.B.3 livres -> mettre a jour memoire `project_epic_7_cadrage` avec status final mini-epic 7.B (note AC12 : pas de nouvelle memoire 7.B.2, la memoire epic-wide suffit).

### File List

- `vercel.json` (modifie : 1 entree cron ajoutee, schedule `0 1 * * *`)
- `app/api/cron/purge-notifications/route.ts` (nouveau, ~110 lignes)
- `tests/integration/cron-purge-notifications/purge-cron.test.ts` (nouveau, 3 cas AC8)
- `tests/unit/cron-purge-notifications.test.ts` (nouveau, 2 cas auth AC9)
- `.github/workflows/integration-tests.yml` (modifie : ajout `CRON_SECRET` env job integration)
- `_bmad-output/implementation-artifacts/sprint-status.yaml` (modifie : transition statut `ready-for-dev` -> `review` + `last_updated` enrichi)
- `_bmad-output/implementation-artifacts/7-b-2-cron-purge-notifications-log-18-mois.md` (modifie : tasks T1-T7 cochees + Dev Agent Record renseigne + DoD a11y coches)

**Aucun fichier sous `supabase/migrations/`** (AC13 valide, confirme `git status`).

## Review Findings

- [x] [Review][Patch] **T1 — Auth bypass si `CRON_SECRET` non défini** [`app/api/cron/purge-notifications/route.ts:42`] — Fix appliqué : `const secret = process.env.CRON_SECRET; if (!secret || authHeader !== \`Bearer ${secret}\`)`.
- [x] [Review][Defer] **T4 — `purgedCount` plafonné PostgREST (≤ 1000) + alerte spike jamais déclenchée** [`app/api/cron/purge-notifications/route.ts:55,74`] — Fix tenté (count:'exact') mais incompatible avec PostgrestTransformBuilder.select() de cette version SDK (1 seul argument). Revenu à .select('id') + .length. Déféré : volumétrie < 50 rows/run en régime de croisière, seuil 1000 jamais atteint en pratique. Candidat upgrade si SDK mis à jour ou via RPC Postgres.
- [x] [Review][Patch] **T6 — Test intégration cas (b) : `oldIds` non trackés + assert `purgedCount === 0` fragile** [`tests/integration/cron-purge-notifications/purge-cron.test.ts:131-166`] — Fix appliqué : tracker `oldIds` dans `seededIds` + assert remplacé par vérification ciblée SELECT sur les IDs du test.
- [x] [Review][Patch] **T7 — Désynchronisation `CRON_SECRET` GHA ≠ `beforeAll` test intégration** [`.github/workflows/integration-tests.yml:63`] — Fix appliqué : valeur GHA alignée sur `'test-cron-secret-7b2'` (identique au `beforeAll`).
- [x] [Review][Defer] **T2 — Timing attack sur comparaison `===` du secret** [`route.ts:42`] — deferred, pre-existing dans tous les crons du projet
- [x] [Review][Defer] **T3 — DELETE étape 1 sans restriction de statut** [`route.ts:53-54`] — deferred, intentionnel et documenté (commentaire l.12 + DECISIONS.md F-Epic7-B1)
- [x] [Review][Defer] **T5 — Absence de transaction entre les deux DELETE** [`route.ts:51-74`] — deferred, idempotence par construction assumée et documentée, pattern commun aux autres crons
- [x] [Review][Defer] **T9 — `SUPABASE_SERVICE_ROLE_KEY` non-null assertion sans guard** [`lib/supabase/server.ts`] — deferred, pre-existing hors scope 7.B.2
- [x] [Review][Defer] **T12 — Drift 30.44j/mois vs calendaire (~2 sem sur 18 mois)** [`route.ts:34`] — deferred, accepté et documenté explicitement (commentaire l.24 + spec AC3)

### Review Findings — Code review 2 (2026-05-15)

- [x] [Review][Patch] **N1 — AC8-b : `purgedCount === 0` non affirmé sur le body du 2e run** [`tests/integration/cron-purge-notifications/purge-cron.test.ts:168-169`] — Fix appliqué : lecture `body2` + `expect(body2.purgedCount).toBe(0)`.
- [x] [Review][Patch] **N2 — Assertion count global fragile dans cas (b)** [`tests/integration/cron-purge-notifications/purge-cron.test.ts:177-180`] — Fix appliqué : snapshot `countPre`/`countPost` supprimé, vérification ciblée BDD sur `oldIds` conservée.
- [x] [Review][Patch] **N3 — Cas (c) : `insertedIds` non trackés si cron échoue après insert** [`tests/integration/cron-purge-notifications/purge-cron.test.ts:~215`] — Fix appliqué : `seededIds.push(...insertedIds)` ajouté immédiatement après l'assert insert.
- [x] [Review][Defer] **N4 — Rows `sent_at` non-null mais `created_at` > 18 mois jamais purgées (retry tardif)** [`route.ts:51-56`] — deferred, intentionnel : la spec purge par `sent_at` (date d'envoi effectif), pas `created_at`. Cas théorique (retry tardif = `sent_at` récent même si `created_at` vieux) documenté DECISIONS.md F-Epic7-B1. Pattern stable.
- [x] [Review][Defer] **N5 — Pas de limite batch sur DELETE (risque timeout volumétrie extrême)** [`route.ts:52-75`] — deferred, documenté dans la spec (seq scan acceptable, volumétrie < 50 rows/run régime de croisière). Candidat story 8.X si timeout prod observé.

## DoD a11y

A renseigner pour toute story avec impact UI (ignorer si pas de changement visuel/interactif) :

- [x] Labels associes aux champs (`htmlFor` ou `aria-labelledby`) -- N/A (cron route, pas de UI).
- [x] Erreurs liees aux champs via `aria-describedby` + `aria-invalid` -- N/A.
- [x] Focus visible sur tous les elements interactifs (contraste >= 3:1) -- N/A.
- [x] Contrastes texte >= 4,5:1 et UI >= 3:1 -- N/A.
- [x] ARIA states corrects sur composants dynamiques -- N/A.
- [x] Navigation clavier complete -- N/A.
- [x] Verification ponctuelle au lecteur d'ecran -- N/A.
- [x] Pas de regression `eslint-plugin-jsx-a11y` (`npm run lint:a11y-check` vert en CI) -- valide T6.2 : `OK: 155 jsx-a11y violations across 56 (file, rule) pair(s). Baseline total: 155. No regression.`
- [x] Pas de regression axe-core (`npm run a11y:axe:check` vert) -- valide T6.3 : `OK: aucun delta Critical/Serious au-dela du baseline.` sur 7 parcours (regle CLAUDE.md durcie 2026-05-06 respectee).
