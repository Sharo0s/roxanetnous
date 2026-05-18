# Story 9.A.2.d : Palier 3 final 85% strict OU acceptation palier 3 effectif 80/72/100/79 comme palier final definitif

Status: ready-for-dev

<!-- Note: Validation is optional. Run validate-create-story for quality check before dev-story. -->

## Story

As a developer Epic 9.A hardening,
I want soit combler les ~12 pts branches restantes de `app/actions/parrainage.ts` via 5-8 SC unit error paths Sentry pour atteindre palier 3 final 85% strict, soit acter formellement l'acceptation du palier 3 effectif 80/72/100/79 comme palier final definitif et solder F-Epic9-A2 du backlog roadmap,
so that la dette coverage tracee depuis 2026-05-18 (PR #8 9.A.2) est entierement soldee avec une decision explicite "effort vs valeur metier" plutot que de laisser un seuil "presque 85%" eternellement en backlog.

## Acceptance Criteria

1. **AC1 Decision-gate light cadrage (DEV STEP 1 obligatoire AVANT toute implementation)** : avant d'ecrire un seul SC additionnel, evaluer cas par cas la valeur metier de chacune des 4 categories de branches restantes (cf. AC3 categorisation). Documenter le verdict dans un bloc "Verdict 9.A.2.d" ajoute a `DECISIONS.md > F-Epic9-A2` : (a) **Option A "palier 3 final 85% strict"** = combler les categories a valeur metier reelle via ~5-8 SC unit + ajustement thresholds `vitest.config.ts` aux chiffres mesures GHA arrondis (>= 85% sur 4/4 indicateurs cible) ; (b) **Option B "acceptation palier 3 effectif final"** = acter 80/72/100/79 comme palier final definitif, retirer F-Epic9-A2 du backlog roadmap, conserver les thresholds actuels comme verrou anti-regression final, plus aucune story de coverage sur `app/actions/parrainage.ts` future. Option B est **explicitement valide** comme verdict si l'evaluation conclut que les branches restantes n'ont pas de valeur metier reelle anti-regression production. GO Sylvain prealable obligatoire (cadrage 1-page presente avant execution).

2. **AC2 Evaluation valeur metier par categorie** : pour chaque categorie de branches restantes ci-dessous (cf. AC3), documenter dans le verdict 9.A.2.d : (a) la nature de la branche (defensive/structurelle/edge metier), (b) le scenario d'usage reel en prod (jamais observe / observable rarement / pourrait arriver), (c) si la non-couverture creerait un risque de regression silencieuse non detectee par d'autres tests (integration / E2E), (d) l'effort SC unit estime (1 SC = ~10-20 lignes test + 1-2 lignes coverage gain), (e) verdict GO/NO-GO par categorie. Le GO ne s'applique qu'aux categories a valeur metier reelle (regle 9.A.2.c Dev Notes "pas de mock artificiel pour gagner 1 pt").

3. **AC3 Categorisation explicite des branches restantes** (etat post-9.A.2.c, cumul GHA #26041382960) :
   - **Categorie C1 : Error paths Sentry defensifs `createParrainageRelation`** -- `blocErr` (l. 722), `logErr` (l. 743 / 800), `mergeErr` (l. 780), `parraineeErr` (l. 691), `loadNamesForAdminEmail` try/catch (l. 759). Pattern : `if (error) Sentry.captureException(...)`. Couvrables uniquement en seedant `{ data: null, error: { code: 'XXXXX', message: '...' } }` via helper `createSupabaseFromMock` etendu 9.A.2.c (type `error: unknown`). Estimation : ~4-6 SC unit, +6-9 pts branches. **Verdict attendu** : evaluer si une regression silencieuse "INSERT admin_actions_log error sans Sentry capture" serait detectable par autre moyen. Si non -> GO. Si oui (deja couvert par integration) -> NO-GO.
   - **Categorie C2 : `loadNamesForAdminEmail` defaults** -- branches `marraine?.first_name || ''` + `|| 'Parrain'`/`|| 'Filleul'` (l. 712-713). Couvrable trivialement en seedant `users: [{ data: { first_name: '' }, error: null }]`. Estimation : ~1 SC unit, +1-2 pts branches. **Verdict attendu** : couverture facile, valeur metier marginale (defaults UX cosmetiques). GO seulement si Option A globale retenue.
   - **Categorie C3 : `validateCode` rate-limit branches** -- `rate_limit_triggered` (l. 358-374) + `rate_limit_rpc_error` catch (l. 375-391). Partiellement couvertes par integration. Couvrables en seedant `rpc.try_consume_rate_limit` retournant `{ data: false }` ou throw. Estimation : ~1-2 SC unit, +2-3 pts branches. **Verdict attendu** : critique anti-fraude (defense H12 brute-force keyspace 31^8). Probable GO meme si Option B globale retenue (impact securite reel).
   - **Categorie C4 : `generateCodeForUser` retry 23505** (l. 287-300) -- **NON COUVRABLE structurel** (defer 8.A.1 F11 documente "non exerce en pratique", keyspace 31^8 ~10^12 collisions). **Verdict force** : hors-cible final, jamais NO-GO. Pas de SC additionnel.

4. **AC4 (cond Option A retenue)** : si Option A (palier 3 final 85% strict) retenue partiellement ou totalement -> implementer les SC unit pour les categories GO, ajuster `vitest.config.ts > thresholds['app/actions/parrainage.ts']` aux chiffres mesures GHA arrondis au point inferieur (jamais regresser sous palier 3 effectif 80/72/100/79). Pattern execution identique 9.A.2.c (1er run GHA mesure -> 2e push ajustement thresholds). Si gap residuel > 5 pts apres ajout SC -> ne PAS forcer mock artificiel (regle preservee), documenter en defer Epic 10+ et retirer F-Epic9-A2 backlog (palier 3 reel = chiffre final mesure).

5. **AC5 (cond Option B retenue)** : si Option B (acceptation palier 3 effectif final) retenue -> ZERO SC ajoute, ZERO modification de `app/actions/parrainage.ts` (AC9 miroir 9.A.2.c). Bloc "Verdict 9.A.2.d : Option B acceptation palier 3 effectif final" ajoute a `DECISIONS.md > F-Epic9-A2`. Item 9.A.2.d solde dans `deferred-work.md` `[Solde 9.A.2.d - YYYY-MM-DD]` + entree `## Final Resolution: F-Epic9-A2 palier 3 effectif 80/72/100/79 acte comme final` ajoutee. Thresholds `vitest.config.ts` conserves a 80/72/100/79 comme verrou anti-regression final permanent. Plus aucune story de coverage sur `app/actions/parrainage.ts` future au backlog roadmap.

6. **AC6 Cas hybride autorise** : verdict mixte Option A partielle + Option B residuelle est explicitement valide (ex. GO categories C1+C3 si valeur metier reelle, NO-GO C2 marginale, hors-cible C4 structurel -> ~5-6 SC unit, palier 3 effectif final = chiffres GHA mesures post-implementation < 85% strict mais > 80/72/100/79). Verdict 9.A.2.d documente la decision finale par categorie + chiffres atteints + solde Option B-bis evolutive avec mention "palier 3 effectif final = X/Y/Z/W via combinaison categories C{i,j,...}".

7. **AC7 (cond SC unit ajoutes)** : `tsc --noEmit` exit 0 ; `npm run lint` baseline reelle 193 warnings preservee ; `npm run lint:a11y-check` baseline 155 preservee ; `npm run test:unit` exit 0 (126 SC existants + N nouveaux SC). Pas d'`as any` ni `@ts-ignore` sans justification commentaire. Reutilisation stricte `createSupabaseFromMock` (extension 9.A.2.c suffisante : type `error: unknown` + `delete` chainable).

8. **AC8 (cond SC unit ajoutes)** : `npm run check:no-direct-notifications-log-insert` / `check:as-any-global` / `check:oracle-paywall` exit 0 (aucune regression linting custom).

9. **AC9 (cond SC unit ajoutes)** : 1 run GHA `integration-tests` vert post-merge (pattern relaxe F-Epic9-A2 : 1 run suffit pour ajustement seuil coverage). Si Option B retenue : pas de 2e push, 1 run sur le commit unique de doc suffit.

10. **AC10 (miroir 9.A.2.c)** : aucune modification de `app/actions/parrainage.ts` (story 100% test/doc). Si une branche n'est PAS exercable sans toucher le code source ou sans mock artificiel, elle est **explicitement listee** dans le verdict 9.A.2.d comme hors-cible final.

11. **AC11 (idempotence + tracabilite)** : `DECISIONS.md > F-Epic9-A2` enrichi avec bloc "Verdict 9.A.2.d (YYYY-MM-DD)" qui solde definitivement Option B evolutive : (a) chiffres GHA final post-implementation, (b) verdict par categorie C1-C4, (c) Option A/B/hybride retenue, (d) ref PR + run GHA, (e) statut F-Epic9-A2 backlog : **retire** (palier final acte) OU **maintenu** (si Option B retenue, le seuil reste mais la story coverage est finale). `deferred-work.md` item 9.A.2.d solde definitif. `sprint-status.yaml` `9-a-2-d-...` `backlog` -> `ready-for-dev` -> `in-progress` -> `review` -> `done`.

12. **AC12** : commit dedie format `Story 9.A.2.d : chore(coverage) verdict palier 3 final/effectif F-Epic9-A2 solde` (Option B 0-SC) OU `Story 9.A.2.d : test(parrainage) SC unit error paths C{i,j} -> palier 3 effectif final X/Y/Z/W` (Option A/hybride). PR titre clair + entree dans Change Log de cette story.

## Tasks / Subtasks

- [ ] **T1 Cadrage 1-page : evaluation valeur metier par categorie** (AC1, AC2, AC3)
  - [ ] T1.1 Lire le rapport coverage GHA #26041382960 (artefact `coverage-integration`, telecharge via `gh run download 26041382960 --repo Sharo0s/roxanetnous --name coverage-integration`) ou parser `coverage/coverage-summary.json` ligne `app/actions/parrainage.ts` pour identifier precisement les ranges de lignes rouges restantes (branches non couvertes).
  - [ ] T1.2 Cross-reference avec la liste AC3 categorisee (C1 error paths Sentry, C2 loadNamesForAdminEmail defaults, C3 rate-limit, C4 retry 23505). Confirmer le mapping branche source -> categorie + estimation pts branches gagnes par SC.
  - [ ] T1.3 Pour chaque categorie (C1, C2, C3) : evaluer (a) nature (defensive/edge/structurel), (b) scenario prod reel observable, (c) risque regression silencieuse non detectable par integration/E2E, (d) effort SC, (e) verdict GO/NO-GO. C4 verdict force NO-GO structurel.
  - [ ] T1.4 Documenter le verdict propose dans une note Markdown 1-page (`_bmad-output/implementation-artifacts/9-a-2-d-verdict-draft.md` temporaire, supprime apres GO Sylvain). 3 scenarios proposes : (1) Option A complete (~5-8 SC) palier 3 final ~85% pur si possible, (2) Option B complete (0 SC) acceptation palier 3 effectif final, (3) Option hybride (~3-6 SC sur categories GO uniquement) palier 3 effectif final = chiffres mesures.
  - [ ] T1.5 **HALT GO Sylvain** : presenter la note 1-page via `AskUserQuestion` (3 options : A / B / hybride avec preview chiffres attendus). Attendre verdict explicite avant d'enclencher T2 ou T9.

- [ ] **T2 (cond Option A ou hybride) Implementation SC unit categories GO** (AC4, AC10)
  - [ ] T2.1 Pour chaque categorie GO, ajouter SC unit dans `tests/unit/parrainage-symetrie.test.ts` (continuite numerotation SC41+ apres SC40 9.A.2.c).
  - [ ] T2.2 Reutilisation stricte `createSupabaseFromMock` (extension 9.A.2.c suffisante : type `error: unknown` permet de seeder `{ data: null, error: { code: 'XXXXX' } }` sur n'importe quelle table). Pas de mock artificiel sans valeur metier (regle 9.A.2.c).
  - [ ] T2.3 Pattern SC pour error paths Sentry (categorie C1 si GO) : seed la table cible avec `{ data: null, error: { code: 'XXXXX', message: '...' } }` -> assert (a) return continue (best-effort, pas de throw) ou retourne `reason: 'db_error'`, (b) `mockCaptureException` invoque avec signal Sentry approprie + extra context.
  - [ ] T2.4 Pattern SC pour C2 (defaults loadNames) si GO : seed `users: [{ data: { first_name: '', last_name: '' }, error: null }, ...]` (marraine ou filleule) -> assert email payload `marraineName === 'Parrain'` (ou `'Filleul'`).
  - [ ] T2.5 Pattern SC pour C3 (rate-limit) si GO : 2 sous-SC : (a) `rpc.try_consume_rate_limit` retourne `{ data: false }` -> return `reason: 'rate_limited'` + `mockCaptureMessage` signal `rate-limit-validate-code`, (b) `rpc.try_consume_rate_limit` throw error -> Sentry capture signal `rate-limit-rpc-error` + validation continue best-effort.
  - [ ] T2.6 `beforeEach(() => { vi.clearAllMocks() })` au top de chaque `describe` (pattern existant) + `afterEach(() => vi.unstubAllEnvs())` au top du describe block si SC utilise `vi.stubEnv` (heritage finding code review 9.A.2.c env stub leak score 75, pre-correction proactive).

- [ ] **T3 (cond Option A ou hybride) Verifications locales** (AC7, AC8)
  - [ ] T3.1 `npx vitest run --project unit` : 126+N SC verts (baseline 9.A.2.c + N nouveaux).
  - [ ] T3.2 `npx vitest run --project unit --coverage` : indicateurs locaux unit-only `app/actions/parrainage.ts` (point comparaison avant push GHA).
  - [ ] T3.3 `npx tsc --noEmit` exit 0.
  - [ ] T3.4 `npm run lint` : 193 warnings preserves baseline reelle, 0 erreur.
  - [ ] T3.5 `npm run lint:a11y-check` : baseline 155 preserve. `npm run a11y:axe:check` : N/A (story 100% tests/doc, pas d'UI touchee -- voir DoD a11y plus bas).
  - [ ] T3.6 `npm run check:no-direct-notifications-log-insert` / `check:as-any-global` / `check:oracle-paywall` : exit 0.

- [ ] **T4 (cond Option A ou hybride) Push + run GHA + ajustement thresholds palier 3 final/effectif** (AC4, AC9)
  - [ ] T4.1 Push branche `story/9-a-2-d-palier-3-final` ou `story/9-a-2-d-hybride`. Workflow `integration-tests` declenche sur PR.
  - [ ] T4.2 1er run GHA mesure coverage cumulee unit+integration sur `app/actions/parrainage.ts`. Documenter les 4 indicateurs precis (lines/branches/functions/statements).
  - [ ] T4.3 **Decision palier 3 final** : si 4/4 indicateurs >= 85% -> palier 3 final pur, MAJ thresholds = chiffres mesures arrondis (>= 85). Si < 85% sur 1-2 indicateurs apres SC GO -> palier 3 effectif final = chiffres mesures arrondis (jamais < palier 3 effectif courant 80/72/100/79). Bloc verdict 9.A.2.d MAJ avec chiffres finaux.
  - [ ] T4.4 `vitest.config.ts > thresholds` MAJ avec chiffres mesures arrondis + commentaire inline solde definitivement la roadmap 9.A.2/b/c/d (mention F-Epic9-A2 final + ref PR/run + date).
  - [ ] T4.5 2e push (ajustement thresholds + doc) sur la meme PR. 1 run vert suffit (pattern F-Epic9-A2 relaxe).

- [ ] **T5 Documentation + handoff (toutes options)** (AC5, AC11, AC12)
  - [ ] T5.1 `DECISIONS.md > F-Epic9-A2` : bloc "Verdict 9.A.2.d (YYYY-MM-DD)" ajoute avec : (a) chiffres GHA final post-implementation, (b) verdict par categorie C1-C4 (GO/NO-GO + justification 1-2 lignes), (c) Option A/B/hybride retenue, (d) ref PR + run GHA, (e) statut F-Epic9-A2 backlog : **retire definitivement** (palier final acte). Mention "Option B evolutive **soldee definitivement**".
  - [ ] T5.2 `deferred-work.md > 9.A.2.d` solde `[Solde 9.A.2.d - YYYY-MM-DD - PR #XX / run GHA #YYYYYYYYY]` + chiffres + Option retenue + categories couvertes/skipped. Ajout bloc final `## Final Resolution: F-Epic9-A2 palier 3 effectif/final X/Y/Z/W acte comme final permanent`.
  - [ ] T5.3 `_bmad-output/implementation-artifacts/sprint-status.yaml` : `9-a-2-d-...` `ready-for-dev` -> `in-progress` -> `review` (post-merge passera a `done`).
  - [ ] T5.4 Memoire `project_epic_9_cadrage` MAJ : story 9.A.2.d done YYYY-MM-DD + chiffres final + Option retenue + solde definitif F-Epic9-A2.
  - [ ] T5.5 Change Log de cette story : 3 entrees minimum (creation ready-for-dev, verdict + implementation in-progress->review, ajustement thresholds post-GHA + solde DECISIONS si Option A/hybride).
  - [ ] T5.6 Supprimer le draft temporaire `_bmad-output/implementation-artifacts/9-a-2-d-verdict-draft.md` (si cree en T1.4).

- [ ] **T6 (cond Option B uniquement) Commit doc-only + solde definitif** (AC5, AC11, AC12)
  - [ ] T6.1 Si Option B retenue : T5 uniquement, pas de T2/T3/T4. Commit unique `Story 9.A.2.d : chore(coverage) verdict palier 3 effectif final F-Epic9-A2 solde definitivement`. Pas de push thresholds (deja a 80/72/100/79 depuis 9.A.2.c).
  - [ ] T6.2 1 run GHA sur le commit doc-only pour preuve baseline (les thresholds 80/72/100/79 doivent toujours passer, integration tests pas regresses). 1 run vert suffit.

## Dev Notes

### Source documents

- **Source primaire** : `_bmad-output/implementation-artifacts/deferred-work.md:14-22` (item 9.A.2.d cadre par 9.A.2.c, 4 categories C1-C4 listees + estimation effort + decision recommandee 1-page).
- **Source decision** : `DECISIONS.md > F-Epic9-A2` (Option B evolutive 9.A.2 -> 9.A.2.b -> 9.A.2.c soldee, palier 3 effectif 80/72/100/79, branches HORS-CIBLE structurel listees).
- **Source code cible** :
  - `app/actions/parrainage.ts:524-831` (`createParrainageRelation`, error paths Sentry restants : blocErr 722 / logErr 743+800 / mergeErr 780 / parraineeErr 691 / loadNames try/catch 759).
  - `app/actions/parrainage.ts:700-715` (`loadNamesForAdminEmail` defaults Parrain/Filleul).
  - `app/actions/parrainage.ts:327-518` (`validateCode` rate-limit branches 358-391 + edges accompagnant).
  - `app/actions/parrainage.ts:237-303` (`generateCodeForUser` retry 23505 HORS-CIBLE structurel defer 8.A.1 F11 confirme).
- **Source helper test** : `tests/unit/_lib/supabase-mock.ts` (extension 9.A.2.c suffisante : `error: unknown` + `delete` chainable).
- **Source SC pattern** : `tests/unit/parrainage-symetrie.test.ts:1051+` (SC20-SC40 9.A.2.c). Continuite numerotation SC41+ pour T2.
- **Source pre-correction code review 9.A.2.c** : finding env stub leak score 75 sur SC29-SC32 (utilisent `vi.stubEnv` + `vi.unstubAllEnvs()` inline en fin de test sans `afterEach`). Recommandation : ajouter `afterEach(() => vi.unstubAllEnvs())` au top du describe block dans T2.6 si nouveaux SC utilisent `vi.stubEnv` (eg. SC rate-limit categorie C3 si GO et necessite stub d'env var).

### Branches non couvertes restantes (chiffres post-9.A.2.c, cumul GHA #26041382960)

| Categorie | Lignes source | Estimation SC | Pts branches gagnes | Verdict propose |
|---|---|---|---|---|
| **C1 Error paths Sentry `createParrainageRelation`** | 691, 722, 743, 759, 780, 800 | ~4-6 SC | +6-9 pts | A evaluer T1.3 |
| **C2 `loadNamesForAdminEmail` defaults** | 712-713 | ~1 SC | +1-2 pts | A evaluer T1.3 (marginal cosmetique) |
| **C3 `validateCode` rate-limit branches** | 358-374, 375-391 | ~1-2 SC | +2-3 pts | A evaluer T1.3 (probable GO securite) |
| **C4 `generateCodeForUser` retry 23505** | 287-300 | 0 (structurel) | 0 | HORS-CIBLE FORCE (defer 8.A.1 F11) |

**Gain total max Option A pure** : +9-14 pts branches -> palier 3 final ~82-87%. Atteindre 85% strict realiste uniquement si C1+C2+C3 tous GO + chiffres GHA favorables. **Gain Option hybride C1+C3 (sans C2)** : +8-12 pts -> palier 3 effectif final ~80-85%.

### Pattern SC error paths Sentry (modele C1)

Sequence des `from()` calls pour SC error path INSERT admin_actions_log (exemple `logErr` l. 743 path bloque meme_email) :
1. validateCode initial : parrainages_codes(1) + users(1) + subscriptions(1)
2. guard filleul : users(2)
3. idempotence lookup : parrainages(1) -> null
4. INSERT parrainages(2) -> `{ data: { id: PARRAINAGE_ID }, error: null }`
5. detectBlacklist : users(3) marraine email + (parrainages(3) otherFilleulesIds)
6. UPDATE parrainages(4) statut=bloque + blocage_raison=meme_email -> `{ data: null, error: null }` (OK)
7. INSERT admin_actions_log(1) -> **`{ data: null, error: { code: '23502', message: 'not null violation' } }`** (forcer error)
8. loadNamesForAdminEmail : users(4) marraine + users(5) filleule
9. sendAdminParrainageFlag (mock @/lib/emails)

Assert : (a) return `{ ok: false, reason: 'blacklist_meme_email' }` malgre logErr (path bloque preserve), (b) `mockCaptureException` invoque avec signal `signup-log-bloque` + severity critical + extra `{ parrainageId, raison: 'meme_email' }`, (c) console.error mock invoque.

### Mocks deja en place (a NE PAS dupliquer)

Voir lignes 18-96 de `tests/unit/parrainage-symetrie.test.ts` : tous les `vi.mock(...)` necessaires sont hoisted (`@/lib/supabase/server`, `@sentry/nextjs`, `next/server`, `next/cache`, `next/headers`, `@/lib/stripe`, `@/lib/parrainage-codes`, `@/lib/emails`, `@/lib/subscription-helpers`, `@/lib/rate-limit-hash`, `@/lib/get-client-ip`, `@/lib/parrainage-detection`). Si nouveau SC dans **meme** fichier : reutiliser. **NB pour C3 rate-limit** : verifier que `mockHashRateLimitKey` (deja hoisted ligne 42) couvre l'usage `hashRateLimitKey(rateLimitKey)` dans le catch error rate-limit (l. 389) -- oui, deja mocke.

### Testing standards

- Pas de fixtures cross-suite ajoutees. Tous les nouveaux SC reutilisent `createSupabaseFromMock` (9.A.1 + extension 9.A.2.c).
- Baseline lint 193 warnings preservee. Pas d'`as any` ni `@ts-ignore` sans justification commentaire. Pas de `console.log` dans les tests.
- `beforeEach(() => { vi.clearAllMocks() })` au top de chaque `describe` (pattern existant ligne 125 du fichier).
- **Pre-correction code review 9.A.2.c** : si nouveaux SC utilisent `vi.stubEnv`, ajouter `afterEach(() => vi.unstubAllEnvs())` au top du describe block (heritage finding score 75 9.A.2.c, eviter env stub leak ordering-dependent).
- Nommage SC : continuer numerotation `SC41+` apres SC40 (dernier en 9.A.2.c). Description format `it('SCXX : <ce qui est teste> -> <resultat attendu>', async () => { ... })`.
- Grouper les SC par categorie dans des `describe` dedies (ex. `describe('createParrainageRelation error paths Sentry -- 9.A.2.d')`, `describe('validateCode rate-limit -- 9.A.2.d')`). Pattern miroir des `describe` existants 9.A.2.b/c.

### Hors scope explicite

- **Pas de modification de `app/actions/parrainage.ts`**. Story 100% tests/doc, miroir AC10 9.A.2.c. Si une branche n'est pas testable sans toucher le code, hors-cible final documente dans verdict.
- **Pas de coverage sur d'autres fichiers**. Seuil reste per-file `app/actions/parrainage.ts` (cf. F-Epic9-A2). Cibler `lib/parrainage-codes.ts` ou `webhooks/stripe/route.ts` = story future Epic 10+.
- **Pas de migration BDD**. Pas de nouveau script `check-*.mjs`. Pas de nouveau workflow GHA. La story etend uniquement (si Option A/hybride) `tests/unit/parrainage-symetrie.test.ts` + ajuste `vitest.config.ts > thresholds`.
- **Pas de regen baseline a11y / lint** (story 100% tests/doc, 0 composant React touche). DoD a11y N/A (pattern herite 9.A.2 / 9.A.2.b / 9.A.2.c).
- **Pas de tentative de couvrir C4 `generateCodeForUser` retry 23505** -- defer 8.A.1 F11 documente non exerce. Verdict force HORS-CIBLE final.
- **Pas de mock artificiel** d'erreurs Supabase pour forcer des branches qui n'ont pas de scenario metier reel. Si une branche d'erreur n'est exercee qu'en cas de panne BDD jamais observee, elle est evaluee NO-GO sauf si T1.3 justifie un risque regression silencieux concret.
- **Option B 0-SC valide** : si T1.5 verdict est Option B globale, la story se reduit a T5+T6 (commit doc-only solde). Pas de honte a acter "palier 3 effectif final" -- l'objectif de F-Epic9-A2 etait de tracer la dette + soit la combler soit l'acter explicitement, pas d'atteindre 85% a tout prix.

### References

- [Source: _bmad-output/implementation-artifacts/deferred-work.md:14-22] -- item 9.A.2.d cadre, 4 categories C1-C4, decision recommandee 1-page.
- [Source: DECISIONS.md > F-Epic9-A2] -- Option B evolutive, roadmap 4 paliers (1 -> 2 -> 3 effectif -> 3 final/effectif final), palier 3 effectif atteint 2026-05-18 via 9.A.2.c, palier 3 final reporte 9.A.2.d.
- [Source: _bmad-output/implementation-artifacts/9-a-2-c-combler-branches-parrainage-cible-85-percent.md] -- story precedente : patterns SC20-SC40, helper extension AC4 (`error: unknown` + `delete`), Option B-bis evolutive.
- [Source: app/actions/parrainage.ts:691, 722, 743, 759, 780, 800] -- error paths Sentry restants C1.
- [Source: app/actions/parrainage.ts:700-715] -- `loadNamesForAdminEmail` defaults C2.
- [Source: app/actions/parrainage.ts:327-518] -- `validateCode` + rate-limit branches C3.
- [Source: app/actions/parrainage.ts:287-300] -- `generateCodeForUser` retry 23505 HORS-CIBLE C4.
- [Source: tests/unit/parrainage-symetrie.test.ts:1051-1700] -- SC20-SC40 9.A.2.c patterns (continuite SC41+).
- [Source: tests/unit/_lib/supabase-mock.ts] -- helper `createSupabaseFromMock` extension 9.A.2.c (type `error: unknown` + `delete` chainable, suffisant pour T2).
- [Source: vitest.config.ts:42-58] -- bloc coverage thresholds palier 3 effectif 80/72/100/79.
- [Source: memory/feedback_test_local_supabase.md] -- Sylvain ne lance pas Docker Supabase local : validation GHA uniquement.
- [Source: code review automatique PR #14 (run agent Sonnet x5 parallel)] -- finding env stub leak score 75 sur SC29-SC32 (sans `afterEach unstubAllEnvs`), recommandation pre-correction proactive T2.6.

### Project Structure Notes

- Alignement strict avec la structure existante. Aucun nouveau dossier. Modifications surfaciques (cond Option A/hybride) :
  - `tests/unit/parrainage-symetrie.test.ts` (+50 a +200 lignes ajoutees pour 3-8 SC selon categories GO, total fichier ~1700-1900 lignes apres ajout).
  - `vitest.config.ts > coverage.thresholds['app/actions/parrainage.ts']` (4 valeurs numeriques + commentaire mis a jour si Option A/hybride change les chiffres).
  - `_bmad-output/implementation-artifacts/sprint-status.yaml` (3 changements status : ready-for-dev -> in-progress -> review).
  - `_bmad-output/implementation-artifacts/deferred-work.md` (item 9.A.2.d solde definitif + bloc Final Resolution F-Epic9-A2).
  - `DECISIONS.md > F-Epic9-A2` (ajout bloc Verdict 9.A.2.d + solde definitif Option B evolutive).
- Modifications doc-only (cond Option B) :
  - `DECISIONS.md > F-Epic9-A2` + `deferred-work.md` + `sprint-status.yaml` uniquement. ZERO fichier code/test touche.
- **Decision dev** : preference pour ajouter dans le fichier existant `parrainage-symetrie.test.ts` (continuite SC41+, coherence avec 9.A.2.b/c). Le fichier depasserait 1800-1900 lignes apres ajout selon nombre de categories GO -- envisager split en 2 fichiers thematiques (`tests/unit/parrainage-create-relation.test.ts` + `tests/unit/parrainage-revoke-validate-generate.test.ts`) uniquement si Option A complete livre 8+ SC. **Decision split a prendre par le dev** au moment du T1.4.

## Dev Agent Record

### Agent Model Used

{{agent_model_name_version}}

### Debug Log References

### Completion Notes List

### File List

## DoD a11y

N/A -- story 100% tests unitaires/doc sans impact UI applicatif. Aucun composant React, page HTML, label, focus, contraste ni navigation clavier modifies. Baselines `lint:a11y-check` 155 + `axe-core` 0 violations Critical/Serious sur 7 parcours sont preservees par construction (aucun fichier `.tsx` touche). Pattern herite des stories soeurs 9.A.1 / 9.A.2 / 9.A.2.b / 9.A.2.c (DoD a11y N/A pour stories 100% tests/config).

## Change Log

- 2026-05-18 -- Story creee via `bmad-create-story` (workflow `/bmad-create-story`). Source : defer ligne 14-22 `_bmad-output/implementation-artifacts/deferred-work.md` (cadre par 9.A.2.c, 4 categories C1-C4) + `DECISIONS.md > F-Epic9-A2` palier 3 effectif 80/72/100/79 (2026-05-18 via PR #14) + finding code review 9.A.2.c env stub leak score 75 (pre-correction proactive T2.6). 12 AC + 6 tasks structures en decision-gate explicite T1 -> branchement T2-T4 (Option A/hybride) OU T6 (Option B). Verdict 9.A.2.d documente cas-par-cas par categorie C1-C4 dans DECISIONS.md F-Epic9-A2 + solde definitif Option B evolutive F-Epic9-A2 (palier final acte). Option B (acceptation palier 3 effectif final) explicitement valide -- pas de honte a acter "presque 85%" comme final si valeur metier des branches restantes ne justifie pas l'effort. Heritage SC20-SC40 9.A.2.c + helper `createSupabaseFromMock` extension `error: unknown` + `.delete()` chainable (deja suffisante, pas d'extension supplementaire). Status `backlog` -> `ready-for-dev`.
