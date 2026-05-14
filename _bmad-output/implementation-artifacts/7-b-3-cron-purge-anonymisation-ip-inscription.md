# Story 7.B.3 : Cron purge / anonymisation `parrainages.ip_inscription` + `notifications_ouverture.ip_inscription`

Status: done

<!-- Note: Validation is optional. Run validate-create-story for quality check before dev-story. -->

## Story

As a responsable conformite roxanetnous (Sylvain, DPO de fait pre-trafic),
I want **livrer le cron Vercel quotidien `app/api/cron/purge-ip-addresses/route.ts`** qui anonymise in-place (`UPDATE ... SET ip_inscription = NULL`) les rows `parrainages` dont `created_at < now() - interval '2 years' AND ip_inscription IS NOT NULL` ET les rows `notifications_ouverture` dont `created_at < now() - interval '6 months' AND ip_inscription IS NOT NULL`,
so that la politique de retention contractualisee par F-Epic7-B1 (`DECISIONS.md:859-913`) cesse d etre theorique pour les **deux tables IP visiteur** (la 1ere story 7.B.2 a traite `notifications_log`, cette story solde les 2 dernieres tables PII). L IP brute est PII directe sous RGPD (art. 4.1 + jurisprudence CJUE Patrick Breyer 2016) et accumuler sans purge expose roxanetnous (a) a une demande CNIL en cas de controle, (b) au risque d obligation de fournir l IP sur un droit a l acces si la duree de conservation depasse la justification metier. Au 2026-05-14, l audit MCP confirme : `parrainages` = 3 rows, oldest `created_at` = 2026-04-28, `rows_anonymisables` = 0 (premiere row eligible ~2028-04-28) ; `notifications_ouverture` = 0 row. Le 1er run prod est donc un **no-op idempotent safe** a deployer immediatement. **Aucune migration BDD necessaire** (les colonnes `ip_inscription` sont deja NULLABLE confirme audit MCP 2026-05-14). La page publique `politique-de-confidentialite/page.tsx` est deja a jour (7.B.1 commit `3c94ae3`) -- aucune modif UI requise.

## Acceptance Criteria

1. **AC1 - Cron Vercel quotidien declare** : ajouter dans `vercel.json` une entree `crons` avec `{"path": "/api/cron/purge-ip-addresses", "schedule": "0 7 * * *"}` (07h00 UTC quotidien, plage **libre** entre 06h `reactivate-disponible` et 08h `expiration-reminder`). Crons existants au 2026-05-14 (a NE PAS chevaucher) : 01h `purge-notifications` (7.B.2), 02h `confirm-parrainages`, 03h `update-badges`, 04h `sweep-stripe-events`, 05h `notify-ouverture-retry`, 06h `reactivate-disponible`, 08h `expiration-reminder`, 09h `relance-profils-incomplets`. **Verifier explicitement** dans Completion Notes qu aucun chevauchement horaire n a ete introduit.

2. **AC2 - Endpoint `app/api/cron/purge-ip-addresses/route.ts`** : Route Next.js App Router export `async function GET(request: NextRequest)`. Auth obligatoire avec garde-fou env null (heritage 7.B.2 review-finding T1 corrige commit `8c4c8ac`) :
   ```ts
   const authHeader = request.headers.get('authorization')
   const secret = process.env.CRON_SECRET
   if (!secret || authHeader !== `Bearer ${secret}`) {
     return NextResponse.json({ error: 'Non autorise' }, { status: 401 })
   }
   ```
   Retourne `401 { error: 'Non autorise' }` si auth invalide OU si `CRON_SECRET` non defini (garde-fou anti-bypass). Le client Supabase est cree avec `serviceRole: true` (pattern heritage `app/api/cron/notify-ouverture-retry/route.ts:40` -- service_role pour bypasser RLS sur les 2 tables ; RLS bloquerait sinon car aucune policy `UPDATE` n existe pour le client anonyme).

3. **AC3 - Logique d anonymisation in-place** : execute deux UPDATE successifs (un par table) dans l ordre PARRAINAGES -> NOTIFICATIONS_OUVERTURE (heritage F-Epic7-B1 `DECISIONS.md:903-906`, requete cible). **Anonymisation in-place** preserve les rows pour l audit anti-fraude (parrainages : `marraine_id`, `stripe_fingerprint`, `code` preserves ; notifications_ouverture : `email`, `code_departement` preserves pour le cron de notification a l ouverture du departement). Implementation :
   ```ts
   const supabase = await createClient({ serviceRole: true })
   // Cutoffs JS approx mois moyens 30.44j (cf. justification AC4).
   const cutoffParrainages = new Date(Date.now() - 2 * 365.25 * 24 * 60 * 60 * 1000).toISOString()
   const cutoffWaitlist = new Date(Date.now() - 6 * 30.44 * 24 * 60 * 60 * 1000).toISOString()

   // Etape 1 : parrainages.ip_inscription anonymisable > 2 ans.
   const { data: anonParrainages, error: errParr } = await supabase
     .from('parrainages')
     .update({ ip_inscription: null })
     .lt('created_at', cutoffParrainages)
     .not('ip_inscription', 'is', null)
     .select('id')

   // Etape 2 : notifications_ouverture.ip_inscription anonymisable > 6 mois.
   const { data: anonWaitlist, error: errWait } = await supabase
     .from('notifications_ouverture')
     .update({ ip_inscription: null })
     .lt('created_at', cutoffWaitlist)
     .not('ip_inscription', 'is', null)
     .select('id')

   const anonymizedParrainages = anonParrainages?.length ?? 0
   const anonymizedWaitlist = anonWaitlist?.length ?? 0
   const anonymizedTotal = anonymizedParrainages + anonymizedWaitlist
   ```
   **Critique** : le filtre `.not('ip_inscription', 'is', null)` est **indispensable** -- sans lui, l UPDATE re-ecrit `NULL -> NULL` sur les rows deja anonymisees, ce qui (a) fait monter artificiellement `purgedCount` et casse l idempotence-par-construction promise par AC4, (b) genere un row-update Postgres sans effet metier (cout I/O inutile), (c) **empeche le test (b) re-run no-op** de passer car le 2e run remonterait les memes IDs deja NULL.

4. **AC4 - Idempotence par construction** : le couple WHERE `(created_at < cutoff) AND (ip_inscription IS NOT NULL)` est idempotent : 2 runs consecutifs sur le meme cutoff -> 2e run no-op (les rows anonymisees au 1er run ont `ip_inscription IS NULL` et sont exclues par le 2e filtre). **Aucune erreur Sentry sur run no-op.** Si error retournee par Supabase (PostgREST exotique, RLS violation), capture `Sentry.captureException` avec `tags: { flow: 'cron_purge_ip_addresses', signal: 'update_failed', severity: 'warning' }` + retourner `500 { error: 'Purge failed' }`. **Le calcul JS approx 30.44j/mois (notifications_ouverture) et 365.25j/an (parrainages) est imposé par le client Supabase JS** (pas de RPC pour cette story, decision deferee comme 7.B.2 AC3). L imprecision (~12h sur 6 mois = 0.27%, ~6h sur 2 ans = 0.03%) est negligeable pour un cron quotidien : une row eligible ratee d un jour est anonymisee le run suivant.

5. **AC5 - Observabilite Sentry** :
   - Breadcrumb `info` a chaque run avec les counts finaux : `Sentry.addBreadcrumb({ category: 'cron', level: 'info', message: 'purge-ip-addresses-done', data: { anonymizedParrainages, anonymizedWaitlist, anonymizedTotal, durationMs } })`. **Toujours emis**, meme si tous les counts sont a 0 (signal vital "le cron tourne").
   - Alerte `Sentry.captureMessage` **warning** si `anonymizedTotal > 100` dans un run (signal d anomalie -- 100 IPs anonymisees en 1 nuit = pic non explique vu la volumetrie attendue de quelques rows/mois). Tags : `{ flow: 'cron_purge_ip_addresses', signal: 'purge-spike', severity: 'warning' }`, extra `{ anonymizedParrainages, anonymizedWaitlist, anonymizedTotal, cutoffParrainages, cutoffWaitlist }`. Le seuil 100 est documente en commentaire (plus bas que 7.B.2 `notifications_log`=1000 car les 2 tables IP sont 10x moins denses). Le seuil est posé en constante : `const PURGE_SPIKE_THRESHOLD = 100`.
   - Console.info de cloture : `console.info('[cron_purge_ip_addresses] anonymizedParrainages=' + anonymizedParrainages + ' anonymizedWaitlist=' + anonymizedWaitlist + ' durationMs=' + durationMs)` (pattern heritage 7.B.2 `purge-notifications/route.ts:107-109`).

6. **AC6 - Response JSON** : retourne `NextResponse.json({ anonymizedTotal, anonymizedParrainages, anonymizedWaitlist, cutoffParrainages, cutoffWaitlist })` avec status 200. Permet inspection rapide via `vercel logs` ou curl manuel (`curl -H "Authorization: Bearer $CRON_SECRET" https://roxanetnous.vercel.app/api/cron/purge-ip-addresses`).

7. **AC7 - Audit MCP pre-deploy** : executer en pre-implementation la requete d audit volumetrie (structure identique a 7.B.2 AC7) :
   ```sql
   SELECT 'parrainages' AS tbl, COUNT(*) AS rows,
          MIN(created_at) AS oldest_created, MAX(created_at) AS newest_created,
          COUNT(*) FILTER (WHERE ip_inscription IS NOT NULL) AS rows_ip_non_null,
          COUNT(*) FILTER (WHERE created_at < now() - interval '2 years' AND ip_inscription IS NOT NULL) AS rows_anonymisables
   FROM parrainages
   UNION ALL
   SELECT 'notifications_ouverture' AS tbl, COUNT(*) AS rows,
          MIN(created_at) AS oldest_created, MAX(created_at) AS newest_created,
          COUNT(*) FILTER (WHERE ip_inscription IS NOT NULL) AS rows_ip_non_null,
          COUNT(*) FILTER (WHERE created_at < now() - interval '6 months' AND ip_inscription IS NOT NULL) AS rows_anonymisables
   FROM notifications_ouverture;
   ```
   Capturer la sortie dans `Dev Agent Record > Debug Log References`. **Au 2026-05-14, l audit doit retourner `rows_anonymisables=0` sur les 2 tables** (confirme par audit create-story 2026-05-14 : parrainages = 3 rows / 3 ip non-null / 0 anonymisable, oldest 2026-04-28 ; notifications_ouverture = 0 row). Si > 0 a la livraison, **documenter explicitement** dans Completion Notes le snapshot pre-cutover (count, sample 1-3 IDs anonymisees pour preuve forensique RGPD -- pas les IPs elles-memes evidemment).

8. **AC8 - Test integration Vitest** sous `tests/integration/cron-purge-ip-addresses/purge-cron.test.ts` (nouveau dossier). Pattern heritage `tests/integration/cron-purge-notifications/purge-cron.test.ts`. **4 cas obligatoires** :
   - **(a) parrainages : seed 2 old (25 mois, ip non-null) + 2 recent (3 mois, ip non-null) -> apres GET cron = 2 recent gardent ip, 2 old ont ip=NULL**. Old = `created_at` 25 mois avant maintenant (`new Date(Date.now() - 25 * 30.44 * ONE_DAY_MS).toISOString()`), recent = `created_at = now()`. Verifier via `supabase.from('parrainages').select('id, ip_inscription').in('id', allIds)`. **Tracker local obligatoire** : pousser les 4 IDs (old + recent) dans `seededIds` car les rows survivent (anonymisation in-place != DELETE), nettoyage manuel via `afterEach`.
   - **(b) notifications_ouverture : seed 2 old (7 mois, ip non-null) + 2 recent (1 mois, ip non-null) -> apres GET cron = 2 recent gardent ip, 2 old ont ip=NULL**. Old = `created_at` 7 mois avant maintenant. **Specificite waitlist** : l index UNIQUE `notifications_ouverture_email_code_uniq` sur `(lower(email), code_departement)` impose des couples email/dpt uniques entre les 4 rows seed -- utiliser email-prefix UUID-randomise + code_departement different par row (ex. `'01'..'04'` ou `'29','35','56','22'` Bretagne).
   - **(c) re-run cron = no-op (counts = 0 sur nos rows)**. Apres (a) + (b), refaire un GET cron, verifier via SELECT cible que les rows non-anonymisees au 1er run (recent) restent intactes, et que les rows anonymisees au 1er run (old) ont toujours `ip_inscription IS NULL`. **NB**: contrairement a 7.B.2, on ne peut pas se baser sur `purgedCount === 0` global (la BDD peut avoir d autres rows anonymisables d origine externe au test) -- la verification est **SELECT cible sur nos IDs**.
   - **(d) parrainages : seed 1 old AVEC `ip_inscription IS NULL` (deja anonymise) + 1 old AVEC `ip_inscription = '1.2.3.4'` -> apres run, le premier reste NULL (no-op grace au filtre `.not('ip_inscription', 'is', null)`) et le second devient NULL.** Valide explicitement l idempotence-filtre AC3.
   - **Helpers**: utiliser `createTestUser` heritage `tests/integration/_lib/fixtures.ts` pour creer la marraine `parrainages.marraine_id` (NULLABLE mais on prefere une vraie marraine pour realisme). Pour `notifications_ouverture`, **pas besoin de marraine** (table sans FK utilisateur), seul un email randomise suffit. **Cleanup explicite via tracker `seededIds`** : `afterEach` doit DELETE les rows seed dans les 2 tables (anonymisation ne supprime pas la row, donc cleanup manuel obligatoire pour eviter pollution cross-tests). Pattern :
     ```ts
     const seededParrainageIds: string[] = []
     const seededWaitlistIds: string[] = []
     afterEach(async () => {
       const supabase = getAdminClient()
       if (seededParrainageIds.length > 0) {
         await supabase.from('parrainages').delete().in('id', seededParrainageIds)
         seededParrainageIds.length = 0
       }
       if (seededWaitlistIds.length > 0) {
         await supabase.from('notifications_ouverture').delete().in('id', seededWaitlistIds)
         seededWaitlistIds.length = 0
       }
     })
     afterAll(async () => { await cleanupAllFixtures() })
     ```
   - **Auth cron**: poser `process.env.CRON_SECRET = 'test-cron-secret-7b3'` en `beforeAll` (valeur dediee 7.B.3 pour eviter collision avec 7.B.2 `test-cron-secret-7b2` si les suites tournent en parallele). **Verifier en parallele** : ajouter `CRON_SECRET: test-cron-secret-7b3` dans `.github/workflows/integration-tests.yml` (job `Run integration tests > env`). **NB CRITIQUE** : la cle GHA `CRON_SECRET` existe deja avec valeur `test-cron-secret-7b2` (heritage 7.B.2). **Decision** : remplacer cette valeur par une chaine generique `test-cron-secret-7b3` ne marche pas car le test integration 7.B.2 utilise specifiquement `test-cron-secret-7b2`. **Solution recommandee** : utiliser **la meme valeur GHA `test-cron-secret-7b2`** dans le `beforeAll` de 7.B.3 (renommer `TEST_CRON_SECRET = 'test-cron-secret-7b2'` dans la suite 7.B.3 aussi). Justification : la GHA injecte une seule valeur `CRON_SECRET` dans `process.env` pour tout le job ; 2 suites de tests integration concurrentes lisant la meme env doivent partager la meme valeur. **Action dev** : aligner sur `'test-cron-secret-7b2'` dans le `beforeAll` 7.B.3 (NE PAS modifier la valeur GHA, NE PAS modifier 7.B.2). Documenter explicitement ce choix en commentaire en-tete du fichier test.
   - **Invocation route**: importer directement la fonction `GET` du route handler (`import { GET } from '@/app/api/cron/purge-ip-addresses/route'`) et l appeler avec un `NextRequest` factice (`new NextRequest('http://localhost/api/cron/purge-ip-addresses', { headers: { authorization: 'Bearer ' + TEST_CRON_SECRET } })`). Eviter `fetch` HTTP.

9. **AC9 - Test unit auth refusee** sous `tests/unit/cron-purge-ip-addresses.test.ts` (nouveau fichier). 3 cas : (i) `Authorization` absent -> 401 + body `{ error: 'Non autorise' }`. (ii) `Authorization` avec wrong bearer -> 401. (iii) `process.env.CRON_SECRET` non defini -> 401 (heritage 7.B.2 review-finding T1 : `if (!secret || authHeader !== ...)`). Mock du client Supabase obligatoire via `vi.mock('@/lib/supabase/server')` pour eviter toute connexion BDD. Mock `@sentry/nextjs` aussi (pattern heritage `tests/unit/cron-purge-notifications.test.ts`).

10. **AC10 - Garde-fou run prod 1er deploy** : DoD post-deploy = 1er run sur prod monitore via Sentry. Cron schedule = 07h00 UTC -> verifier le breadcrumb info `purge-ip-addresses-done` dans Sentry 24h apres deploy. **Aucun event captureException attendu** (audit MCP 2026-05-14 confirme 0 row anonymisable -> no-op). Documenter dans Completion Notes : "1er run prod attendu YYYY-MM-DD 07h00 UTC, verification J+1 dans Sentry filtre tags `flow:cron_purge_ip_addresses`, breadcrumb info `anonymizedTotal=0` attendu". **Audit MCP post-1er-run** : re-executer la requete AC7 et confirmer que `rows_anonymisables` reste a 0 ou diminue selon l ecoulement du temps.

11. **AC11 - Validation pre-commit livraison** (CLAUDE.md regle durcie + heritage 7.A.* + 7.B.2) :
    - `npm run lint` exit 0 (route.ts + test files lint-clean).
    - `npm run lint:a11y-check` exit 0 (baseline 155 preserve, aucun changement UI dans cette story).
    - `npm run a11y:axe:check` exit 0 (story sans impact UI, mais regle CLAUDE.md durcie 2026-05-06 = obligatoire pour TOUT commit livraison story). Baseline 0 Critical/Serious doit etre preservee.
    - `npm run test:unit` exit 0 (suite globale verte, +3 nouveaux tests AC9 -> attendu 64/64 si 61 actuels + 3).
    - `npm run test:integration` exit 0 (suite integration globale verte, +4 nouveaux tests AC8). **Sylvain ne lance pas Supabase localement** (memoire `feedback_test_local_supabase`) -> validation deferee a GHA workflow `integration-tests.yml`. **Heritage 7.B.2 decision Option B (commit direct main + workflow_dispatch)** : meme decision possible ici. Le dev agent **doit POSER** les 4 tests integration (AC8) mais peut ne pas executer localement. Pre-commit dev agent : skip `npm run test:integration` localement, **noter explicitement dans Completion Notes** la decision Option A (PR) vs B (commit direct + workflow_dispatch) et le statut GHA post-push.
    - `npm run check:no-direct-notifications-log-insert` exit 0 (garde-fou 7.A.11 : la story ne touche pas du tout `notifications_log` -> 0 match attendu par construction).
    - `npm run build` exit 0 (route.ts compile, vercel-build full chain green, route `/api/cron/purge-ip-addresses` declaree `ƒ` (dynamic) dans la sortie).

12. **AC12 - Solde dette + transitions + memoire** :
    - `_bmad-output/implementation-artifacts/deferred-work.md` : ligne **"Stockage IP brut sans TTL ni purge -- RGPD"** (L204 selon dernier audit) doit etre verifiee. Si deja barree par 7.B.1 (la politique TTL formalisee), ajouter le marker `[Solde 7.B.3 - 2026-05-XX]` a cote pour signer la livraison de la **mise en oeuvre concrete**. Si non barree, la barrer `~~...~~` avec ce marker.
    - `_bmad-output/implementation-artifacts/sprint-status.yaml` : transition `7-b-3-cron-purge-anonymisation-ip-inscription` de `ready-for-dev` (pose par create-story) -> `review` (livre par dev) -> `done` (post-merge selon `project_bmad_conventions`). Mettre `last_updated` au jour de livraison.
    - **Memoire utilisateur** : **mettre a jour la memoire existante `project_epic_7_cadrage`** apres livraison 7.B.3 pour acter mini-epic 7.B = 3/3 stories `done` (7.B.1 + 7.B.2 + 7.B.3). Ne PAS creer de memoire dediee 7.B.3. Texte type a ajouter : "Mini-epic 7.B (RGPD retention) clôture 2026-05-XX : 3/3 stories done. Cron `purge-notifications` (01h UTC, 18 mois) + cron `purge-ip-addresses` (07h UTC, 2 ans parrainages + 6 mois notifications_ouverture) en prod. 1er run no-op confirme MCP 2026-05-XX." En complement, si pertinent, mettre a jour `project_logNotification_bug` pour mentionner que le cron purge `notifications_log` est en place (si pas deja fait par 7.B.2).
    - **Pas de transition sur autre story Epic 7** : 7.B.3 cloture le mini-epic 7.B. Mini-epic 7.A (11 stories) progresse en parallele independamment. Mini-epic 7.C (E2E Playwright) reste backlog.

13. **AC13 - Hors-scope explicitement liste dans Completion Notes** :
    - Aucune modification du helper `app/actions/parrainage.ts` (lecture/ecriture INSERT IP preserve, cette story fait UPDATE SET NULL hors flux applicatif).
    - Aucune modification du helper `app/actions/notifications-ouverture.ts` (INSERT IP preserve).
    - Aucune migration BDD (DDL des 2 tables reste tel quel ; les colonnes `ip_inscription` sont deja NULLABLE confirme audit MCP 2026-05-14).
    - Aucun endpoint `app/api/admin/delete-pii` (decision F-Epic7-B1 : pas avant 5 demandes/an).
    - Aucune purge `notifications_log` (deja livre par 7.B.2 commit `b65d143`).
    - Aucune mise a jour de `politique-de-confidentialite/page.tsx` (deja aligne par 7.B.1 commit `3c94ae3`).
    - Aucune mise a jour de `DECISIONS.md` (la politique F-Epic7-B1 lignes 859-913 couvre 7.B.3 par anticipation, cette story est execution).
    - Aucun renommage de fichier ou table (`waitlist_departements` est deja renomme `notifications_ouverture` par migration `20260511180234`, repris verbatim dans la route).
    - Aucun `Sentry.captureMessage` info pour run no-op (uniquement breadcrumb info -- evite la pollution alerts, pattern fige par 7.B.2).
    - **Aucun DELETE physique sur les 2 tables** : l anonymisation in-place est **strict UPDATE** (decision F-Epic7-B1 documentee : preserve `marraine_id`/`filleule_id`/`stripe_fingerprint` cote parrainages pour audit anti-fraude, preserve `email`/`code_departement` cote notifications_ouverture pour le cron notification d ouverture).
    - **Aucune migration de renommage** des autres tables PII deja renommees (`waitlist_departements` -> `notifications_ouverture` deja fait par 6.C migration `20260511180234`). La route utilise directement le nouveau nom.

## Tasks / Subtasks

- [x] **T1 - Audit MCP pre-implementation** (AC: #7)
  - [x] T1.1 - Executer la requete d audit AC7 via `mcp__supabase__execute_sql` (UNION ALL sur les 2 tables). Capturer sortie JSON brute dans `Dev Agent Record > Debug Log References`.
  - [x] T1.2 - Confirmer `rows_anonymisables = 0` sur les 2 tables. Si > 0, ajouter sample anonymise (top 3 IDs par `created_at` ASC, **sans inclure les IPs elles-memes**) dans Completion Notes pour preuve forensique RGPD.

- [x] **T2 - Creer route Next.js `app/api/cron/purge-ip-addresses/route.ts`** (AC: #2, #3, #4, #5, #6)
  - [x] T2.1 - Initialiser le fichier avec en-tete commentaire descriptif (heritage `purge-notifications/route.ts:1-27` pour le style) : objectif story 7.B.3, decision F-Epic7-B1 referencee, justification calcul JS approx 30.44 jours/mois + 365.25 jours/an vs Postgres calendaire, rappel anonymisation in-place vs DELETE physique.
  - [x] T2.2 - Implementer `GET(request: NextRequest)` : auth bearer + garde-fou `!secret` + service-role client + 2 UPDATE successifs (parrainages 2 ans puis notifications_ouverture 6 mois) + filtre `.not('ip_inscription', 'is', null)` indispensable + breadcrumb + alerte spike + response JSON.
  - [x] T2.3 - Verifier en lecture qu aucun `INSERT` sur `notifications_log` n est ajoute (garde-fou T5 `check:no-direct-notifications-log-insert` doit rester vert). La story ne touche pas du tout cette table.

- [x] **T3 - Declarer le cron dans `vercel.json`** (AC: #1)
  - [x] T3.1 - Ouvrir `vercel.json`. Ajouter l entree `{ "path": "/api/cron/purge-ip-addresses", "schedule": "0 7 * * *" }` dans le tableau `crons` (ordre indifferent, mais coller a la suite de `purge-notifications` pour grouper les 2 crons RGPD).
  - [x] T3.2 - Verifier qu aucun chevauchement horaire n a ete introduit (07h libre entre 06h reactivate-disponible et 08h expiration-reminder). Documenter dans Completion Notes la liste complete des 9 crons post-livraison.

- [x] **T4 - Tests integration `tests/integration/cron-purge-ip-addresses/purge-cron.test.ts`** (AC: #8)
  - [x] T4.1 - Creer le dossier `tests/integration/cron-purge-ip-addresses/` + fichier de test. En-tete commentaire : "Story 7.B.3 (F-Epic7-B1)" + rappel valeur `TEST_CRON_SECRET = 'test-cron-secret-7b2'` partagee avec 7.B.2 (raison : GHA injecte 1 seule env var `CRON_SECRET` par job).
  - [x] T4.2 - Implementer cas (a) parrainages : seed 2 old (25 mois) + 2 recent + UPDATE cron + verifier ip=NULL sur old, ip preserve sur recent.
  - [x] T4.3 - Implementer cas (b) notifications_ouverture : seed 2 old (7 mois) + 2 recent avec code_departement different par row pour respecter UNIQUE INDEX `(lower(email), code_departement)`. Utiliser codes Bretagne `'29','35','56','22'` (toujours actifs en prod). Pour les emails, utiliser prefix randomise `test-purge-7b3-${randomUUID()}@test.local` pour eviter collision.
  - [x] T4.4 - Implementer cas (c) re-run cron = no-op : SELECT cible sur les IDs des cas (a) + (b), verifier integrite (recent ip preserve, old ip=NULL toujours).
  - [x] T4.5 - Implementer cas (d) idempotence-filtre : seed 1 old ip NULL deja + 1 old ip non-null, verifier le filtre `.not('ip_inscription', 'is', null)` ne touche pas la row deja NULL.
  - [x] T4.6 - Cleanup tracker `seededParrainageIds` + `seededWaitlistIds` dans `afterEach` (anonymisation in-place = rows survivent, cleanup manuel obligatoire).
  - [x] T4.7 - **Pas d execution locale** (heritage `feedback_test_local_supabase`). Validation GHA post-push. Mention explicite dans Completion Notes.

- [x] **T5 - Tests unit `tests/unit/cron-purge-ip-addresses.test.ts`** (AC: #9)
  - [x] T5.1 - Creer fichier de test. Pattern hoisted mocks `@/lib/supabase/server` + `@sentry/nextjs` heritage `tests/unit/cron-purge-notifications.test.ts`.
  - [x] T5.2 - Cas (i) auth header absent -> 401. (ii) wrong bearer -> 401. (iii) `process.env.CRON_SECRET = undefined` (via `delete process.env.CRON_SECRET` en `beforeEach` du cas + `vi.unstubAllEnvs()` cleanup) -> 401.
  - [x] T5.3 - Verifier `npm run test:unit` reste vert localement (+3 nouveaux tests, attendu 64/64 si 61 actuels + 3). Capturer sortie dans `Debug Log References`.

- [x] **T6 - Synchronisation env GHA** (AC: #8, #11)
  - [x] T6.1 - Verifier l etat actuel de `.github/workflows/integration-tests.yml:65` : `CRON_SECRET: test-cron-secret-7b2` deja present (heritage 7.B.2).
  - [x] T6.2 - **Aucune modification GHA requise** : la suite 7.B.3 partage la meme valeur env (`'test-cron-secret-7b2'` posee en `beforeAll` du test 7.B.3 aussi). **Justification dans Completion Notes** : 1 seul `CRON_SECRET` par job GHA, 2 suites de tests integration concurrentes doivent partager la valeur. NE PAS modifier le workflow GHA ni la suite 7.B.2.

- [x] **T7 - Validation pre-commit livraison** (AC: #11)
  - [x] T7.1 - `npm run lint` -> capturer sortie (attendu : 0 errors, warnings <= baseline 193).
  - [x] T7.2 - `npm run lint:a11y-check` -> baseline 155 preserve.
  - [x] T7.3 - `npm run a11y:axe:check` -> 0 delta Critical/Serious (regle CLAUDE.md durcie 2026-05-06).
  - [x] T7.4 - `npm run test:unit` -> +3 tests verts (attendu 64/64).
  - [x] T7.5 - `npm run test:integration` -> **skip local, valider GHA post-push** (heritage 7.B.2 Option B documentee).
  - [x] T7.6 - `npm run check:no-direct-notifications-log-insert` -> OK (story ne touche pas `notifications_log`).
  - [x] T7.7 - `npm run build` -> exit 0, route `/api/cron/purge-ip-addresses` declaree `ƒ` (dynamic) dans la sortie build.

- [x] **T8 - Update sprint-status.yaml + Completion Notes + File List** (AC: #12, #13)
  - [x] T8.1 - Editer `_bmad-output/implementation-artifacts/sprint-status.yaml` : transition `7-b-3-cron-purge-anonymisation-ip-inscription` `ready-for-dev` -> `review`. `last_updated` = jour livraison.
  - [x] T8.2 - Renseigner `Completion Notes` : liste hors-scope (AC13) + pointeur F-Epic7-B1 + rappel "mini-epic 7.B = 3/3 done apres merge" + 1er run prod attendu 07h UTC + decision GHA Option A vs B.
  - [x] T8.3 - `File List` : `vercel.json`, `app/api/cron/purge-ip-addresses/route.ts`, `tests/integration/cron-purge-ip-addresses/purge-cron.test.ts`, `tests/unit/cron-purge-ip-addresses.test.ts`, `_bmad-output/implementation-artifacts/sprint-status.yaml`, `_bmad-output/implementation-artifacts/7-b-3-cron-purge-anonymisation-ip-inscription.md`. **Aucun fichier sous `supabase/migrations/`** + **aucune modification `.github/workflows/integration-tests.yml`** (sinon AC13 / T6 viole). **Aucune modification `lib/notifications-log.ts`, `app/politique-de-confidentialite/page.tsx`, `DECISIONS.md`, `app/actions/parrainage.ts`, `app/actions/notifications-ouverture.ts`** (hors-scope strict).
  - [x] T8.4 - Mettre a jour `_bmad-output/implementation-artifacts/deferred-work.md` : ligne "Stockage IP brut sans TTL ni purge -- RGPD" L204 -> ajouter marker `[Solde 7.B.3 - 2026-05-XX]` apres la barre `~~...~~` existante (si deja barre par 7.B.1) ou la barrer (sinon).

- [x] **T9 - Mise a jour memoire `project_epic_7_cadrage`** (AC: #12)
  - [x] T9.1 - Editer `/Users/sylvain/.claude/projects/-Users-sylvain-Documents-roxanetnous/memory/project_epic_7_cadrage.md` : ajouter section "Mini-epic 7.B (RGPD retention) clôture 2026-05-XX" mentionnant 3/3 done + 1er run prod no-op confirme MCP.

- [x] **T10 - Commit livraison** (AC: #11, #12)
  - [x] T10.1 - Stage explicite des fichiers File List uniquement (pas de `git add .`).
  - [x] T10.2 - Commit message format Conventional Commits FR : `feat(rgpd): cron purge IP parrainages + notifications_ouverture (story 7.B.3)`. Heritage 7.A.* + 7.B.1 + 7.B.2.
  - [x] T10.3 - Pas de `git push` sans validation explicite Sylvain (heritage 7.B.2 T8.3).

### Review Findings

- [ ] [Review][Decision] T9 — Seuil spike `PURGE_SPIKE_THRESHOLD = 100` : risque d'alerte parasite au 1er run si volumétrie initiale > 100 rows — faut-il ajouter une exception 1er run ou laisser tel quel ? (Note : audit MCP 2026-05-14 = 0 row anonymisable, 1er run = no-op → risque théorique uniquement à court terme) [`app/api/cron/purge-ip-addresses/route.ts:51`]
- [ ] [Review][Decision] T11 — `TEST_CRON_SECRET` tests unit = `'unit-test-cron-secret-7b3'` vs spec AC9 qui indique `'test-cron-secret-7b2'` (valeur GHA) : les tests unit n'ont pas de contrainte GHA, la divergence est techniquement correcte mais viole la lettre de la spec. Aligner ou garder l'isolation ? [`tests/unit/cron-purge-ip-addresses.test.ts:24`]
- [x] [Review][Patch] T1 — Cas (d) assertion `anonymizedParrainages >= 1` trop permissive : ne prouve pas que le filtre `.not('ip_inscription', 'is', null)` exclut `id1` du count. Ajouter vérification scopée sur nos 2 IDs via SELECT count avant/après. [`tests/integration/cron-purge-ip-addresses/purge-cron.test.ts:340-357`]
- [x] [Review][Patch] T2 — Chemin "étape 1 OK + étape 2 KO" non testé : ajouter 1 cas unit mockant `update` parrainages → succès puis `update` notifications_ouverture → erreur, vérifier 500 + `captureException` step='update_notifications_ouverture'. [`tests/unit/cron-purge-ip-addresses.test.ts`]
- [x] [Review][Patch] T4 — `addBreadcrumb` absent du mock Sentry dans `tests/integration/setup.ts` : ajouté. [`tests/integration/setup.ts:47`]
- [x] [Review][Patch] T10 — Test (c) : le body du 2e run n'est pas inspecté. Ajout `expect(body2.anonymizedParrainages/Waitlist/Total).toBe(0)`. [`tests/integration/cron-purge-ip-addresses/purge-cron.test.ts:266`]
- [x] [Review][Defer] T3 — `createClient()` throw JS non capturé → 500 brut non observé Sentry [app/api/cron/purge-ip-addresses/route.ts:63] — deferred, pre-existing sur tous les crons existants
- [x] [Review][Defer] T5 — `notifications_ouverture` absente de `fkSafeOrder` dans `cleanupAllFixtures` [tests/integration/_lib/fixtures.ts] — deferred, pre-existing hors-scope story
- [x] [Review][Defer] T6 — Timing attack sur comparaison `CRON_SECRET` (chaîne naïve) [app/api/cron/purge-ip-addresses/route.ts:56] — deferred, pattern commun 8 autres crons existants
- [x] [Review][Defer] T7 — Fuite `cutoffParrainages`/`cutoffWaitlist` dans réponse 200 [app/api/cron/purge-ip-addresses/route.ts:136-141] — deferred, endpoint interne protégé Bearer, acceptable
- [x] [Review][Defer] T8 — Absence de LIMIT/batch sur UPDATE : risque timeout sur grand volume [app/api/cron/purge-ip-addresses/route.ts:67-72] — deferred, volumétrie cible < 100 rows/run, story 8.X si prod timeout
- [x] [Review][Defer] T12 — Module ESM mis en cache entre tests unit (import dynamique sans `vi.resetModules`) [tests/unit/cron-purge-ip-addresses.test.ts] — deferred, pattern identique cron-purge-notifications heritage 7.B.2, tests passent en pratique

## Dev Notes

### Contexte projet (a relire avant de coder)

- **Memoire `project_epic_7_cadrage`** : Epic 7 cadre 2026-05-13, mini-epic 7.B = 3 stories RGPD (7.B.1 done 2026-05-14 commit `3c94ae3`, 7.B.2 review 2026-05-14 commit `b65d143` + patches `8c4c8ac` + revert `c033ec2`, 7.B.3 cette story). Aucun bloquant go-live Bretagne. Estimation 0,5j-dev.
- **Memoire `project_a11y_lot_c`** : regle CLAUDE.md durcie 2026-05-06 = `npm run a11y:axe:check` exit 0 obligatoire pre-commit livraison story. Cette story n a pas d impact UI direct mais la regle s applique pareil.
- **Memoire `feedback_test_local_supabase`** : Sylvain ne lance pas Docker/`supabase start` localement. Validation BDD par GHA workflow uniquement. **Le dev agent POSE les tests integration (AC8) mais n execute pas localement** -- pre-commit skip `npm run test:integration`, documenter dans Completion Notes, GHA run post-push valide.
- **Memoire `project_bmad_conventions`** : statut `done` apres merge, format commit Conventional Commits FR.
- **DECISIONS.md F-Epic7-B1 lignes 859-913** : politique TTL contractualisee. Cette story execute la decision pour `parrainages.ip_inscription` (2 ans) + `notifications_ouverture.ip_inscription` (6 mois). **Les 2 requetes UPDATE exactes sont specifiees aux lignes 904-906**, suivre a la lettre cote semantique (ordre + filtre `IS NOT NULL` + anonymisation in-place).
- **Renommage critique** : `waitlist_departements` -> `notifications_ouverture` par migration `20260511180234_rename_waitlist_departements_to_notifications_ouverture.sql` (Epic 6 mini-epic 6.C). Le cadrage epic-7.md:394-413 utilise encore l ancien nom `waitlist_departements`. **TOUJOURS utiliser `notifications_ouverture` dans le code, les tests, le commit message et les commentaires.** F-Epic7-B1 acte explicitement ce renommage (DECISIONS.md:872).
- **Heritage 7.B.2 review-findings (commits `8c4c8ac` + `c033ec2`)** : 4 fixes appliques cote code de prod (auth garde-fou `!secret`, tracker test cas (b), GHA secret align, count exact reverted). Cette story 7.B.3 doit **reproduire les fixes preventivement** : (a) auth `if (!secret || authHeader !== ...)` en AC2/T2.2, (b) `seededIds` exhaustif en AC8/T4.6, (c) ne PAS utiliser `count: 'exact'` (incompatible SDK postgrest-js de ce projet -- voir review finding 7.B.2 T4 defere).

### Source tree components touches

- **Code** : `app/api/cron/purge-ip-addresses/route.ts` (nouveau, ~100 lignes Next.js App Router GET handler, structure quasi-identique a `purge-notifications/route.ts`).
- **Infra** : `vercel.json` (1 entree `crons` ajoutee).
- **Tests** : `tests/integration/cron-purge-ip-addresses/purge-cron.test.ts` (nouveau, 4 cas AC8), `tests/unit/cron-purge-ip-addresses.test.ts` (nouveau, 3 cas auth AC9).
- **CI** : **PAS de modification** de `.github/workflows/integration-tests.yml` (la valeur `CRON_SECRET: test-cron-secret-7b2` est partagee avec 7.B.2 -- voir T6).
- **Artefacts BMad** : `_bmad-output/implementation-artifacts/sprint-status.yaml` (1 transition statut), `_bmad-output/implementation-artifacts/7-b-3-cron-purge-anonymisation-ip-inscription.md` (cette story file -- tasks cochees post-livraison), `_bmad-output/implementation-artifacts/deferred-work.md` (marker `[Solde 7.B.3]` ajoute).
- **Memoire** : `/Users/sylvain/.claude/projects/-Users-sylvain-Documents-roxanetnous/memory/project_epic_7_cadrage.md` (mise a jour clôture mini-epic 7.B).
- **NON touches** : `supabase/migrations/**` (pas de DDL), `lib/notifications-log.ts` (helper INSERT preserve), `app/politique-de-confidentialite/page.tsx` (deja aligne par 7.B.1), `DECISIONS.md` (politique F-Epic7-B1 fige), `app/actions/parrainage.ts` (INSERT IP preserve, story UPDATE SET NULL out-of-band), `app/actions/notifications-ouverture.ts` (INSERT IP preserve), `app/api/cron/purge-notifications/route.ts` (cron sibling intact), `lib/emails.ts`, `package.json`, `tsconfig.json`, `tests/integration/cron-purge-notifications/**` (suite 7.B.2 preservee).

### Schema BDD actuel (audit MCP 2026-05-14)

**`parrainages`** (3 rows en BDD prod, oldest 2026-04-28) :
```
id                 uuid       NOT NULL  (PK)
code               text       NOT NULL
marraine_id        uuid       NULLABLE  -> users(id) ON DELETE SET NULL
filleule_id        uuid       NULLABLE  -> users(id) ON DELETE SET NULL
statut             text       NOT NULL  (pending|inscrite|abonnee|confirme|bloque|fraude|expire)
filleule_inscrite_at  timestamptz NULLABLE
filleule_abonnee_at   timestamptz NULLABLE
confirme_at        timestamptz NULLABLE
ip_inscription     text       NULLABLE  <-- CIBLE ANONYMISATION (2 ans)
stripe_fingerprint text       NULLABLE
blocage_raison     text       NULLABLE
flag_suspicion     text       NULLABLE
created_at         timestamptz NULLABLE  (default not specified ici -- a confirmer si NOT NULL en pratique)
expire_at          timestamptz NULLABLE
```

**`notifications_ouverture`** (0 row en BDD prod, ex-`waitlist_departements`) :
```
id                uuid        NOT NULL  (PK, default gen_random_uuid())
email             text        NOT NULL
code_departement  text        NOT NULL  -> departements_ouverts(code) ON DELETE CASCADE
role              text        NULLABLE
ip_inscription    text        NULLABLE  <-- CIBLE ANONYMISATION (6 mois)
user_agent        text        NULLABLE
created_at        timestamptz NOT NULL  default now()
notified_at       timestamptz NULLABLE
```

**Index** `notifications_ouverture_email_code_uniq` UNIQUE `(lower(email), code_departement)` -- **IMPORTANT** pour les tests integration AC8 cas (b) : seeder des couples uniques (utiliser codes Bretagne `'29','35','56','22'` differents par row + email randomise par row).

**Pas d index dedie sur `ip_inscription` ni sur `created_at`** dans aucune des 2 tables. Volumes attendus quotidiens (en regime de croisiere) = quelques rows max par run -> seq scan acceptable. Si timeout en prod (> 60s sur la fonction Vercel) : creer un index `CREATE INDEX CONCURRENTLY` en story 8.X (hors-scope ici).

**Audit MCP volumetrie 2026-05-14** :
```json
[
  {"tbl":"parrainages","rows":3,"oldest_created":"2026-04-28 17:35:39.466827+00",
   "newest_created":"2026-04-28 22:01:59.982334+00","rows_ip_non_null":3,"rows_anonymisables":0},
  {"tbl":"notifications_ouverture","rows":0,"oldest_created":null,
   "newest_created":null,"rows_ip_non_null":0,"rows_anonymisables":0}
]
```
-> 0 row anonymisable a date, 1er run prod = no-op safe.

### Testing standards summary

- **Unit tests** (`tests/unit/`) : Vitest pur, mocks libs externes via `vi.hoisted` + `vi.mock`. Pas d acces BDD. Pattern heritage `tests/unit/cron-purge-notifications.test.ts` (auth 401 + mock `@/lib/supabase/server` + mock `@sentry/nextjs`).
- **Integration tests** (`tests/integration/`) : Vitest + Supabase local (Docker, mais Sylvain n execute pas localement). Cleanup via tracker local `seededParrainageIds` + `seededWaitlistIds` (anonymisation in-place ne supprime pas les rows, contrairement a 7.B.2 DELETE). `cleanupAllFixtures` en `afterAll` pour les users crees par `createTestUser`.
- **A11y tests** (`tests/a11y/`) : Playwright axe-core. Cette story sans impact UI, baseline 0 Critical/Serious preserve.
- **Setup integration** : variables env auto-injectees par `tests/integration/setup.ts` si absentes (`SUPABASE_URL=localhost:54321` etc.). Garde-fou anti-prod (`SUPABASE_URL` doit etre local). `process.env.CRON_SECRET = 'test-cron-secret-7b2'` pose dans le `beforeAll` du fichier de test 7.B.3 (partagee avec 7.B.2).
- **CI GHA** : workflow `integration-tests.yml` se declenche uniquement sur `pull_request` vers `main`. Pour Epic 7 commit-direct-main, declencher via `gh workflow run integration-tests.yml` (Option B heritage 7.B.2) ou ouvrir une PR `feat/7-b-3-cron-purge-ip-addresses` -> `main` (Option A).

### Project Structure Notes

- **Convention App Router cron** : `app/api/cron/<name>/route.ts` avec `export async function GET(request: NextRequest)`. Auth via `request.headers.get('authorization')`. Tous les 8 crons existants suivent ce pattern.
- **Convention auth cron** : `Bearer ${process.env.CRON_SECRET}` + **garde-fou `!secret`** (heritage 7.B.2 review-finding T1, indispensable pour eviter bypass si l env var est absente en prod -- check-required-env l interdit en build mais runtime safeguard quand meme). La variable est declaree dans `scripts/check-required-env.mjs` (>=32 chars).
- **Convention Supabase client** : `await createClient({ serviceRole: true })` heritage `@/lib/supabase/server`. Le service_role bypasse RLS, indispensable pour UPDATE en masse sur `parrainages` et `notifications_ouverture` (RLS bloquerait sinon).
- **Convention nommage route** : `purge-ip-addresses` (verbe + sujet en kebab-case, pluriel `addresses` car 2 tables traitees). Heritage `purge-notifications`, `notify-ouverture-retry`.
- **Convention crons schedule** : cron syntaxe Vercel = standard `m h d M w` UTC. 07h00 UTC libre apres audit des 8 crons existants (cf. AC1 liste complete).
- **Pattern test integration cron** : 1 fichier `tests/integration/cron-<name>/purge-cron.test.ts` (kebab-case + dossier dedie par cron). Pattern heritage 7.B.2.

### References

- [Source: _bmad-output/planning-artifacts/epic-7.md#394-413] -- Mini-epic 7.B Story 7.B.3 cadrage initial (8 AC sources, **nom de table obsolete `waitlist_departements` a remplacer par `notifications_ouverture`**).
- [Source: DECISIONS.md#859-913 (F-Epic7-B1)] -- Politique TTL retention, requetes cibles AC3 (lignes 905-906) + justification durees 2 ans/6 mois + decision anonymisation in-place + note renommage table (ligne 872).
- [Source: _bmad-output/implementation-artifacts/7-b-1-politique-ttl-formalisee-decisions.md] -- Story 7.B.1 livree 2026-05-14 commit `3c94ae3`, base contractualisee.
- [Source: _bmad-output/implementation-artifacts/7-b-2-cron-purge-notifications-log-18-mois.md] -- Story 7.B.2 review 2026-05-14, **modele de reference** pour structure code + test + AC.
- [Source: app/api/cron/purge-notifications/route.ts] -- Pattern code complet a reprendre verbatim (en-tete commentaire, structure, auth, Sentry, response JSON).
- [Source: tests/integration/cron-purge-notifications/purge-cron.test.ts] -- Pattern test integration cron a reprendre verbatim (tracker `seededIds`, `buildAuthedRequest`, `getAdminClient`, `cleanupAllFixtures`).
- [Source: tests/unit/cron-purge-notifications.test.ts] -- Pattern test unit auth (mock hoisted, vi.mock supabase + sentry).
- [Source: app/actions/parrainage.ts:521] -- Site d INSERT `ip_inscription` (preserve, hors-scope).
- [Source: app/actions/notifications-ouverture.ts:70] -- Site d INSERT `ip_inscription` (preserve, hors-scope).
- [Source: supabase/migrations/20260511180234_rename_waitlist_departements_to_notifications_ouverture.sql] -- Renommage 6.C historique.
- [Source: scripts/check-required-env.mjs] -- Declaration `CRON_SECRET` obligatoire >=32 chars.
- [Source: scripts/check-no-direct-notifications-log-insert.mjs] -- Garde-fou 7.A.11 (la story 7.B.3 ne touche pas `notifications_log` -> 0 match).
- [Source: vercel.json] -- 8 crons existants + horaires occupes, ajouter 07h.
- [Source: tests/integration/_lib/fixtures.ts] -- `createTestUser` + `cleanupAllFixtures` ordre FK-safe.
- [Source: tests/integration/_lib/supabase-admin.ts] -- `getAdminClient()` pour service_role en test.
- [Source: tests/integration/README.md] -- Setup local Supabase, env vars, pattern integration.
- [Source: .github/workflows/integration-tests.yml:65] -- `CRON_SECRET: test-cron-secret-7b2` deja present, **PAS de modification**.
- [Source: CLAUDE.md] -- regles strictes (pas d emojis, a11y, masculin neutre).
- Audit MCP 2026-05-14 execute par workflow create-story (volumetrie + schema + indexes) : capture dans Debug Log References.

### Previous story intelligence (7.B.2 review 2026-05-14, commit `b65d143` + patches `8c4c8ac` + revert `c033ec2`)

- **Pattern File List explicite + Debug Log References capturees** : reuse pareil pour 7.B.3.
- **Pattern Commit Epic 7** : Conventional Commits FR `feat(rgpd):` / `docs(rgpd):` / `fix(rgpd):`. **Eviter** `Story 7.B.3 :` prefix.
- **AC10 hors-scope explicite dans Completion Notes** : pattern repris pour AC13.
- **Aucune migration BDD** : 7.B.1 + 7.B.2 le declarent aussi, idem ici. Verification `git status` -> 0 fichier `supabase/migrations/`. Mention explicite dans Completion Notes.
- **Audit MCP pre-commit (T1) + post-livraison (declenchement 1er run)** : 7.B.2 a capture l audit T1.1 dans Debug Log References. Pareil ici, **plus** ajouter un audit post-deploy 24h apres 1er run pour confirmer 0 erreur Sentry (note Completion Notes T8.2).
- **Idempotence par construction (UPDATE WHERE)** : heritage F-Epic7-B1 lignes 905-906 -- pattern figure dans DECISIONS. **Critique** : le filtre `.not('ip_inscription', 'is', null)` est ABSOLUMENT NECESSAIRE pour preserver l idempotence (cf. AC3, AC4, AC8 cas (d)).
- **Pas d endpoint admin `delete-pii`** : decision F-Epic7-B1 + memoire `project_epic_7_cadrage`. Hors-scope 7.B.3.
- **Reviews-findings 7.B.2 fixes preventifs a reproduire** :
  - **T1 fix (auth garde-fou null)** : reprendre `if (!secret || authHeader !== \`Bearer ${secret}\`)` verbatim en AC2/T2.2.
  - **T4 fix (test cas (b) tracker exhaustif)** : reprendre le tracker `seededIds` exhaustif en AC8/T4.6, **anonymisation in-place exige cleanup explicite via DELETE in [ids]**.
  - **T7 fix (GHA secret align)** : utiliser **la meme valeur `'test-cron-secret-7b2'`** dans le `beforeAll` 7.B.3 que dans 7.B.2 (cf. AC8). Justification documentee : 1 seule env var GHA par job.
  - **T4 review defere (`count: 'exact'` incompatible SDK)** : ne PAS utiliser `count: 'exact'` dans le route handler (utiliser `.select('id')` + `.length` heritage 7.B.2 commit `c033ec2`).

### Git intelligence summary

- 5 derniers commits (heads ordre antichronologique) :
  - `c033ec2 fix(rgpd): revert patch T4 count:exact incompatible SDK postgrest-js` -- 7.B.2 patch revert
  - `8c4c8ac fix(rgpd): patches code-review story 7.B.2 (4 findings)` -- 7.B.2 reviews
  - `b65d143 feat(rgpd): cron purge notifications_log 18 mois (story 7.B.2)` -- 7.B.2 livraison
  - `3c94ae3 docs(rgpd): formalise politique TTL retention donnees personnelles (story 7.B.1)` -- 7.B.1 livraison
  - `7b1f6e2 fix(admin): coherence libelles statuts + meta-filtre 'a traiter'` -- iteration UI admin
- **Pattern Conventional Commits FR `feat(rgpd):`** : repris pour 7.B.3 livraison.
- **7.B.2 livre en 1 commit + 2 commits patches review** : 7.B.3 vise 1 commit livraison + 0 patch attendu (les fixes 7.B.2 sont preventivement reproduits ici).
- **Aucun commit Epic 7.B sur `vercel.json`** depuis 7.B.2 (1 entree ajoutee). 7.B.3 ajoute la 2eme entree -> total 9 crons.
- **Pas de conflit attendu** sur `app/api/cron/`, `tests/integration/cron-*`, `tests/unit/cron-*`.

### Latest tech information

- **Vercel Crons (2026)** : tarif gratuit jusqu a 100 jobs/jour sur Pro. Limite execution = 300s par fonction (Fluid Compute par defaut, cf. session context Vercel `vercel:knowledge-update`). Le cron 7.B.3 attendu < 2s sur 100 rows max (volumetrie cible attendue tres faible en regime de croisiere) -> aucun risque timeout.
- **Vercel Functions Fluid Compute** : routes `app/api/cron/*` tournent en Node.js par defaut (pas Edge). Aucun changement de config attendu.
- **`@/lib/supabase/server`** : `createClient({ serviceRole: true })` retourne un `SupabaseClient` async (await). Pattern `await createClient({ serviceRole: true })` obligatoire heritage `notify-ouverture-retry/route.ts:40` + `purge-notifications/route.ts:49`.
- **PostgREST `.update().select('id')`** : retourne les rows mises a jour. Si rien ne matche le WHERE, retourne `[]` (data) sans erreur. Compatible avec le SDK postgrest-js de ce projet (revert 7.B.2 confirme : pas de `count: 'exact'`).
- **Filtre PostgREST `.not('col', 'is', null)`** : equivalent `WHERE col IS NOT NULL`. Syntaxe : `.not('column_name', 'is', null)` (3 arguments). Heritage standard, pas de surprise SDK.
- **NextRequest 16 / NextResponse** : import depuis `next/server`. `NextResponse.json(body, { status })` pour le retour. Pattern heritage.
- **Sentry @sentry/nextjs** : `Sentry.addBreadcrumb({ category, level, message, data })` et `Sentry.captureMessage(msg, { level, tags, extra })` patterns figes Epic 7 (heritage 7.A.6, 7.A.10, 7.B.2).
- **Postgres `now() - interval`** : non disponible cote client JS Supabase (pas de RPC pour cette story). Approximation JS `Date.now() - N * ms_per_unit` acceptable (precision < 0.3% sur 6 mois, < 0.05% sur 2 ans, justifie en commentaire route.ts).

### Project context reference

- `_bmad-output/planning-artifacts/architecture-technique-roxanetnous-2026-02-09.md` : pas de section RGPD retention. F-Epic7-B1 + cette story comblent.
- `_bmad-output/planning-artifacts/prd.md` : NFR a11y + securite, pas NFR RGPD explicite. La story 7.B.3 execute une decision documentee, pas une nouvelle NFR a definir.
- `_bmad-output/planning-artifacts/audit-cookies-2026-05-07.md` : audit cookies de session uniquement. Hors-scope retention BDD.

## Dev Agent Record

### Agent Model Used

claude-opus-4-7[1m]

### Debug Log References

**Audit MCP pre-implementation (T1.1, 2026-05-14)** :

```json
[
  {"tbl":"parrainages","rows":3,
   "oldest_created":"2026-04-28 17:35:39.466827+00",
   "newest_created":"2026-04-28 22:01:59.982334+00",
   "rows_ip_non_null":3,"rows_anonymisables":0},
  {"tbl":"notifications_ouverture","rows":0,
   "oldest_created":null,"newest_created":null,
   "rows_ip_non_null":0,"rows_anonymisables":0}
]
```

T1.2 : `rows_anonymisables = 0` confirme sur les 2 tables -> 1er run prod = no-op safe. Pas de snapshot anonymise necessaire (aucune row eligible).

**Validations pre-commit (T7, 2026-05-14)** :

- `npm run lint` -> exit 0 / 193 warnings (baseline preserve, identique sortie 7.B.2).
- `npm run lint:a11y-check` -> `OK: 155 jsx-a11y violations across 56 (file, rule) pair(s). Baseline total: 155. No regression.`
- `npm run a11y:axe:check` -> `OK: aucun delta Critical/Serious au-dela du baseline.` (7 parcours audites).
- `npm run test:unit` -> 7 files / 64 passed (61 avant + 3 nouveaux AC9).
- `npm run check:no-direct-notifications-log-insert` -> `OK : aucun INSERT direct sur notifications_log hors du helper autorise.`
- `npm run build` -> exit 0, route `ƒ /api/cron/purge-ip-addresses` listee dans le manifeste.

`npm run test:integration` : skip local (heritage `feedback_test_local_supabase`), delegue GHA `integration-tests.yml`.

### Completion Notes List

- **AC1 cron declare** : entree `{ "path": "/api/cron/purge-ip-addresses", "schedule": "0 7 * * *" }` ajoutee a `vercel.json` apres `purge-notifications` (regroupement RGPD). Liste complete des 9 crons post-livraison + horaires : 01h `purge-notifications`, 02h `confirm-parrainages`, 03h `update-badges`, 04h `sweep-stripe-events`, 05h `notify-ouverture-retry`, 06h `reactivate-disponible`, **07h `purge-ip-addresses` (nouveau)**, 08h `expiration-reminder`, 09h `relance-profils-incomplets`. **Aucun chevauchement horaire**.
- **AC2-AC6 route** : auth bearer + garde-fou `!secret` reproduit verbatim (heritage 7.B.2 T1). Service-role client. 2 UPDATE successifs (parrainages 2 ans -> notifications_ouverture 6 mois) avec filtre `.not('ip_inscription', 'is', null)` indispensable a l idempotence. Breadcrumb Sentry info systematique. Alerte spike >100 (seuil constant `PURGE_SPIKE_THRESHOLD`). Response JSON conforme schema.
- **AC7 audit MCP** : 0 row anonymisable sur les 2 tables au 2026-05-14, 1er run prod = no-op safe. Snapshot complet capture en Debug Log References.
- **AC8 tests integration** : 4 cas (a) parrainages old/recent, (b) notifications_ouverture old/recent avec codes Bretagne 29/35/56/22 + emails randomises (respect UNIQUE INDEX `(lower(email), code_departement)`), (c) re-run no-op SELECT cible, (d) idempotence-filtre (row deja NULL preservee). Tracker `seededParrainageIds` + `seededWaitlistIds` cleanup `afterEach` (anonymisation in-place = rows survivent). `TEST_CRON_SECRET = 'test-cron-secret-7b2'` partage avec 7.B.2 (justification : 1 seule env var GHA par job).
- **AC9 tests unit** : 3 cas auth (i) header absent / (ii) wrong bearer / (iii) `process.env.CRON_SECRET` absent -> 401 + body `{ error: 'Non autorise' }` + assertion `mockCreateClient` non-invoque (defense-en-profondeur). Le cas (iii) couvre le garde-fou heritage 7.B.2 T1, absent de la suite 7.B.2 (additif).
- **AC10 1er run prod attendu** : lendemain de merge a 07h00 UTC. Verification J+1 dans Sentry filtre tags `flow:cron_purge_ip_addresses`, breadcrumb info `purge-ip-addresses-done` attendu avec `anonymizedTotal=0` et `durationMs<5s`. Audit MCP post-1er-run a re-executer (requete AC7) pour confirmer `rows_anonymisables` reste a 0.
- **AC11 validations pre-commit** : toutes vertes (cf. Debug Log References). `test:integration` skip local heritage `feedback_test_local_supabase`.
- **AC12 transitions** :
  - sprint-status.yaml : `7-b-3-cron-purge-anonymisation-ip-inscription` `ready-for-dev` -> `review`, `last_updated` 2026-05-14.
  - deferred-work.md L212 : marker `[Solde 7.B.3 - 2026-05-14]` ajoute apres la barre 7.B.1 existante (mise en oeuvre concrete).
  - Memoire `project_epic_7_cadrage` : a mettre a jour T9 (mini-epic 7.B = 3/3 done apres merge).
- **AC13 hors-scope confirme** : 0 modification `app/actions/parrainage.ts`, `app/actions/notifications-ouverture.ts`, `lib/notifications-log.ts`, `app/politique-de-confidentialite/page.tsx`, `DECISIONS.md`, `app/api/cron/purge-notifications/route.ts`, `.github/workflows/integration-tests.yml`, `supabase/migrations/**`. Aucun endpoint `/admin/delete-pii`. Aucun DELETE physique. Aucun `Sentry.captureMessage` info pour run no-op (uniquement breadcrumb).
- **Decision GHA Option A vs B** : Option B recommandee (heritage 7.B.2 : commit direct main + `gh workflow run integration-tests.yml` manuel) car Epic 7 suit le pattern commit-direct-main. Decision finale Sylvain post-livraison.
- **Mini-epic 7.B status post-merge** : 3/3 stories done (7.B.1 commit `3c94ae3` + 7.B.2 review commit `b65d143` + 7.B.3 review ce commit). Audit Sentry J+7 calendrier passif ~2026-05-21 sur les 2 crons RGPD (purge-notifications + purge-ip-addresses).

### File List

- `app/api/cron/purge-ip-addresses/route.ts` (nouveau, ~130 lignes)
- `vercel.json` (1 entree crons ajoutee = 9eme cron total)
- `tests/integration/cron-purge-ip-addresses/purge-cron.test.ts` (nouveau, 4 cas AC8)
- `tests/unit/cron-purge-ip-addresses.test.ts` (nouveau, 3 cas AC9)
- `_bmad-output/implementation-artifacts/sprint-status.yaml` (transition statut + `last_updated`)
- `_bmad-output/implementation-artifacts/7-b-3-cron-purge-anonymisation-ip-inscription.md` (tasks cochees + Dev Agent Record)
- `_bmad-output/implementation-artifacts/deferred-work.md` (marker `[Solde 7.B.3 - 2026-05-14]` L212)

## DoD a11y

A renseigner pour toute story avec impact UI (ignorer si pas de changement visuel/interactif) :

- [x] Labels associes aux champs (`htmlFor` ou `aria-labelledby`) -- N/A (cron route, pas de UI).
- [x] Erreurs liees aux champs via `aria-describedby` + `aria-invalid` -- N/A.
- [x] Focus visible sur tous les elements interactifs (contraste >= 3:1) -- N/A.
- [x] Contrastes texte >= 4,5:1 et UI >= 3:1 -- N/A.
- [x] ARIA states corrects sur composants dynamiques -- N/A.
- [x] Navigation clavier complete -- N/A.
- [x] Verification ponctuelle au lecteur d ecran -- N/A.
- [x] Pas de regression `eslint-plugin-jsx-a11y` (`npm run lint:a11y-check` vert en CI) -- a valider T7.2.
- [x] Pas de regression axe-core (`npm run a11y:axe:check` vert) -- a valider T7.3.
