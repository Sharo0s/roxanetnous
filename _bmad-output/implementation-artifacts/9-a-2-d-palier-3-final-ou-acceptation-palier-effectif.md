# Story 9.A.2.d : Palier 3 final 85% strict OU acceptation palier 3 effectif 80/72/100/79 comme palier final definitif

Status: review

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

- [x] **T1 Cadrage 1-page : evaluation valeur metier par categorie** (AC1, AC2, AC3)
  - [x] T1.1 Lire le rapport coverage GHA #26041382960 (artefact `coverage-integration`, telecharge via `gh run download 26041382960 --repo Sharo0s/roxanetnous --name coverage-integration`) ou parser `coverage/coverage-summary.json` ligne `app/actions/parrainage.ts` pour identifier precisement les ranges de lignes rouges restantes (branches non couvertes). -- **Done** : coverage local unit-only `app/actions/parrainage.ts` pre-9.A.2.d = lines 79.93 / branches 69.23 / functions 100 / statements 78.78. Cumul GHA #26041382960 = 80.96 / 72.69 / 100 / 79.79 (palier 3 effectif courant DECISIONS F-Epic9-A2).
  - [x] T1.2 Cross-reference avec la liste AC3 categorisee (C1 error paths Sentry, C2 loadNamesForAdminEmail defaults, C3 rate-limit, C4 retry 23505). Confirmer le mapping branche source -> categorie + estimation pts branches gagnes par SC. -- **Done** : mapping confirme par lecture `app/actions/parrainage.ts:524-831` (C1 5 blocs `if (xxxErr) Sentry.captureException`) + `app/actions/parrainage.ts:700-715` (C2 defaults) + `app/actions/parrainage.ts:340-391` (C3 rate-limit) + `app/actions/parrainage.ts:287-300` (C4 retry 23505). Verdict structurel C4 force NO-GO.
  - [x] T1.3 Pour chaque categorie (C1, C2, C3) : evaluer (a) nature (defensive/edge/structurel), (b) scenario prod reel observable, (c) risque regression silencieuse non detectable par integration/E2E, (d) effort SC, (e) verdict GO/NO-GO. C4 verdict force NO-GO structurel. -- **Done** : C1 GO (observabilite 1er verrou detection prod + regression silencieuse moyen), C2 NO-GO (cosmetique marginal), C3 GO net (anti-fraude H12 + zero couverture integration via grep `rate_limited tests/integration/` -> 0 occurrence), C4 HORS-CIBLE FORCE (keyspace 31^8 non exerce defer 8.A.1 F11).
  - [x] T1.4 Documenter le verdict propose dans une note Markdown 1-page (`_bmad-output/implementation-artifacts/9-a-2-d-verdict-draft.md` temporaire, supprime apres GO Sylvain). 3 scenarios proposes : (1) Option A complete (~5-8 SC) palier 3 final ~85% pur si possible, (2) Option B complete (0 SC) acceptation palier 3 effectif final, (3) Option hybride (~3-6 SC sur categories GO uniquement) palier 3 effectif final = chiffres mesures. -- **Done** : draft cree, supprime apres GO en T5.6.
  - [x] T1.5 **HALT GO Sylvain** : presenter la note 1-page via `AskUserQuestion` (3 options : A / B / hybride avec preview chiffres attendus). Attendre verdict explicite avant d'enclencher T2 ou T9. -- **Done** : AskUserQuestion 3 options A/B/hybride avec previews tableau, GO Sylvain = **Option hybride C1+C3 recommandee**.

- [x] **T2 (cond Option A ou hybride) Implementation SC unit categories GO** (AC4, AC10)
  - [x] T2.1 Pour chaque categorie GO, ajouter SC unit dans `tests/unit/parrainage-symetrie.test.ts` (continuite numerotation SC41+ apres SC40 9.A.2.c). -- **Done** : SC41-SC47 ajoutes (lignes 1803-2128). 2 describe dedies "createParrainageRelation error paths Sentry -- 9.A.2.d (C1)" + "validateCode rate-limit -- 9.A.2.d (C3 anti-fraude H12)".
  - [x] T2.2 Reutilisation stricte `createSupabaseFromMock` (extension 9.A.2.c suffisante : type `error: unknown` permet de seeder `{ data: null, error: { code: 'XXXXX' } }` sur n'importe quelle table). Pas de mock artificiel sans valeur metier (regle 9.A.2.c). -- **Done** + extension additive `then` sur sous-objet update (necessaire pour rendre `.update().eq()` awaitable et seeder error dans la pool). Zero breaking change : tests garantie helper passent.
  - [x] T2.3 Pattern SC pour error paths Sentry (categorie C1 si GO) : seed la table cible avec `{ data: null, error: { code: 'XXXXX', message: '...' } }` -> assert (a) return continue (best-effort, pas de throw) ou retourne `reason: 'db_error'`, (b) `mockCaptureException` invoque avec signal Sentry approprie + extra context. -- **Done** : SC41 (signup-update-bloque) / SC42 (signup-log-bloque) / SC43 (signup-email-bloque via vi.mocked(sendAdminParrainageFlag).mockRejectedValueOnce) / SC44 (signup-merge-flag) / SC45 (signup-parrainee-par). Tous asserts return best-effort + Sentry signal + extra context.
  - [x] T2.4 Pattern SC pour C2 (defaults loadNames) si GO : seed `users: [{ data: { first_name: '', last_name: '' }, error: null }, ...]` (marraine ou filleule) -> assert email payload `marraineName === 'Parrain'` (ou `'Filleul'`). -- **Skipped** : C2 NO-GO acte T1.3 (cosmetique).
  - [x] T2.5 Pattern SC pour C3 (rate-limit) si GO : 2 sous-SC : (a) `rpc.try_consume_rate_limit` retourne `{ data: false }` -> return `reason: 'rate_limited'` + `mockCaptureMessage` signal `rate-limit-validate-code`, (b) `rpc.try_consume_rate_limit` throw error -> Sentry capture signal `rate-limit-rpc-error` + validation continue best-effort. -- **Done** : SC46 + SC47. **Decouverte** : les SC existants utilisent `buildRpcAllowed` qui retourne un builder non-thenable -> `data` finit par etre l'objet builder (truthy != false) et l'if rate-limit est silencieusement bypasse. C3 9.A.2.d est le 1er SC qui exerce reellement la branche rate-limit en unit-only (validation : avant SC46-47, ces branches etaient couvertes uniquement par integration partielle).
  - [x] T2.6 `beforeEach(() => { vi.clearAllMocks() })` au top de chaque `describe` (pattern existant) + `afterEach(() => vi.unstubAllEnvs())` au top du describe block si SC utilise `vi.stubEnv` (heritage finding code review 9.A.2.c env stub leak score 75, pre-correction proactive). -- **N/A** : aucun nouveau SC n'utilise `vi.stubEnv`, donc pas besoin de `afterEach unstubAllEnvs`. Le `beforeEach vi.clearAllMocks` au top du fichier (ligne 130) couvre les nouveaux SC par construction.

- [x] **T3 (cond Option A ou hybride) Verifications locales** (AC7, AC8)
  - [x] T3.1 `npx vitest run --project unit` : 126+N SC verts (baseline 9.A.2.c + N nouveaux). -- **Done** : 133/133 verts (126 baseline + 7 nouveaux SC41-SC47).
  - [x] T3.2 `npx vitest run --project unit --coverage` : indicateurs locaux unit-only `app/actions/parrainage.ts` (point comparaison avant push GHA). -- **Done** : lines **85.46** (+5.53 vs 79.93) / branches **71.92** (+2.69 vs 69.23) / functions **100** (=) / statements **84.17** (+5.39 vs 78.78). Sur unit-only, 85% strict atteint sur lines + statements + functions ; gap branches ~13 pts. Cumul GHA mesure final post-PR -> T4.
  - [x] T3.3 `npx tsc --noEmit` exit 0. -- **Done** : TypeScript compilation completed sans erreur.
  - [x] T3.4 `npm run lint` : 193 warnings preserves baseline reelle, 0 erreur. -- **Done** : 193 warnings 0 erreur (baseline preservee exactement).
  - [x] T3.5 `npm run lint:a11y-check` : baseline 155 preserve. `npm run a11y:axe:check` : N/A (story 100% tests/doc, pas d'UI touchee -- voir DoD a11y plus bas). -- **Done** : lint:a11y-check 155 (file, rule) pair(s) baseline OK. **a11y:axe:check execute par securite (regle CLAUDE.md durcie)** : exit 0, "aucun delta Critical/Serious au-dela du baseline" sur 8 parcours.
  - [x] T3.6 `npm run check:no-direct-notifications-log-insert` / `check:as-any-global` / `check:oracle-paywall` : exit 0. -- **Done** : 3 scripts brownfield checks exit 0.

- [ ] **T4 (cond Option A ou hybride) Push + run GHA + ajustement thresholds palier 3 final/effectif** (AC4, AC9)
  - [ ] T4.1 Push branche `story/9-a-2-d-palier-3-final` ou `story/9-a-2-d-hybride`. Workflow `integration-tests` declenche sur PR. -- **A executer post-commit** (utilisateur push + ouvre PR).
  - [ ] T4.2 1er run GHA mesure coverage cumulee unit+integration sur `app/actions/parrainage.ts`. Documenter les 4 indicateurs precis (lines/branches/functions/statements). -- **A executer post-push GHA**.
  - [ ] T4.3 **Decision palier 3 final** : si 4/4 indicateurs >= 85% -> palier 3 final pur, MAJ thresholds = chiffres mesures arrondis (>= 85). Si < 85% sur 1-2 indicateurs apres SC GO -> palier 3 effectif final = chiffres mesures arrondis (jamais < palier 3 effectif courant 80/72/100/79). Bloc verdict 9.A.2.d MAJ avec chiffres finaux.
  - [ ] T4.4 `vitest.config.ts > thresholds` MAJ avec chiffres mesures arrondis + commentaire inline solde definitivement la roadmap 9.A.2/b/c/d (mention F-Epic9-A2 final + ref PR/run + date).
  - [ ] T4.5 2e push (ajustement thresholds + doc) sur la meme PR. 1 run vert suffit (pattern F-Epic9-A2 relaxe).

- [x] **T5 Documentation + handoff (toutes options)** (AC5, AC11, AC12)
  - [x] T5.1 `DECISIONS.md > F-Epic9-A2` : bloc "Verdict 9.A.2.d (YYYY-MM-DD)" ajoute avec : (a) chiffres GHA final post-implementation, (b) verdict par categorie C1-C4 (GO/NO-GO + justification 1-2 lignes), (c) Option A/B/hybride retenue, (d) ref PR + run GHA, (e) statut F-Epic9-A2 backlog : **retire definitivement** (palier final acte). Mention "Option B evolutive **soldee definitivement**". -- **Done** : bloc "Verdict 9.A.2.d (2026-05-18) -- Option hybride C1+C3 retenue -- F-Epic9-A2 solde definitivement" ajoute apres bloc palier 3 9.A.2.c. Tableau categorise C1-C4 + chiffres unit-only + extension helper + regle pattern futur. Cumul GHA placeholder a remplir T4.4 post-1er run GHA.
  - [x] T5.2 `deferred-work.md > 9.A.2.d` solde `[Solde 9.A.2.d - YYYY-MM-DD - PR #XX / run GHA #YYYYYYYYY]` + chiffres + Option retenue + categories couvertes/skipped. Ajout bloc final `## Final Resolution: F-Epic9-A2 palier 3 effectif/final X/Y/Z/W acte comme final permanent`. -- **Done** : item 9.A.2.d transforme en `[Solde 9.A.2.d - 2026-05-18 - PR a venir / GHA TBD]` (les chiffres GHA finaux seront mis a jour T4 post-push) + bloc `## Final Resolution: F-Epic9-A2 -- palier 3 effectif final acte comme palier final definitif (2026-05-18)` ajoute.
  - [x] T5.3 `_bmad-output/implementation-artifacts/sprint-status.yaml` : `9-a-2-d-...` `ready-for-dev` -> `in-progress` -> `review` (post-merge passera a `done`). -- **In-progress** acte (transition ready-for-dev -> in-progress en debut de workflow). Transition `in-progress -> review` faite en step 9 post-validation DoD.
  - [x] T5.4 Memoire `project_epic_9_cadrage` MAJ : story 9.A.2.d done YYYY-MM-DD + chiffres final + Option retenue + solde definitif F-Epic9-A2. -- **Done** : description + bloc 9.A.2.d ajoutes (status review 2026-05-18 + Option hybride C1+C3 + 7 SC SC41-SC47 + chiffres unit-only + F-Epic9-A2 soldee definitivement).
  - [x] T5.5 Change Log de cette story : 3 entrees minimum (creation ready-for-dev, verdict + implementation in-progress->review, ajustement thresholds post-GHA + solde DECISIONS si Option A/hybride). -- **Done** : 3 entrees Change Log ci-dessous (creation + verdict GO + livraison review).
  - [x] T5.6 Supprimer le draft temporaire `_bmad-output/implementation-artifacts/9-a-2-d-verdict-draft.md` (si cree en T1.4). -- **Done** : draft supprime post-GO Sylvain (rm).

- [ ] **T6 (cond Option B uniquement) Commit doc-only + solde definitif** (AC5, AC11, AC12)
  - **N/A** Option B non retenue (Option hybride retenue T1.5). T6 skip.

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

claude-opus-4-7[1m] (Claude Code via `/bmad-dev-story`)

### Debug Log References

**T1 cadrage** : audit code source `app/actions/parrainage.ts` lignes 524-831 (createParrainageRelation), 700-715 (loadNamesForAdminEmail), 340-391 (validateCode rate-limit), 287-300 (generateCodeForUser retry 23505 hors-cible). Grep `tests/integration/ -e rate_limited` -> 0 occurrence (preuve C3 anti-fraude non couvert par integration). Grep `tests/unit -e try_consume_rate_limit` -> 3 occurrences (SC1 + SC8 + SC14 dans `buildRpcAllowed` builder non-thenable, branches rate-limit jamais reellement exercees).

**T2 implementation SC** : 7 SC ajoutes lignes 1803-2128 dans 2 nouveaux describe blocks. SC41-SC45 utilisent pattern hérité SC12 (path blocage meme_email / flag meme_ip) + seed error `{ data: null, error: { code: 'XXXXX', message: '...' } }` dans pool `parrainages[2]` ou `admin_actions_log[0]`. SC44 utilise rpc dispatcher discriminant `try_consume_rate_limit` vs `merge_parrainage_flag_suspicion`. SC43 utilise `vi.mocked(sendAdminParrainageFlag).mockRejectedValueOnce(new Error)` pour forcer le try/catch email. SC46-SC47 utilisent `Promise.resolve({data:false})` / `Promise.reject(new Error)` directement sur `rpc()` (vs builder pattern) car validateCode fait `await supabaseAdmin.rpc(...)` sans `.maybeSingle()`.

**Extension helper `tests/unit/_lib/supabase-mock.ts`** : ajout d'un `then(resolve)` sur le sous-objet retourne par `.update(payload)` ligne 117. Rationale : code source utilise `await supabase.from(t).update({...}).eq('id', ...)` qui terminait sur l'objet sous-update non-awaitable -> `error` indefini -> path Sentry jamais hit. Avec `then`, `await ...update().eq()` resout `item` qui peut porter `error: { code, message }`. Test garantie helper `tests/unit/supabase-mock.test.ts:52-62` intact (ne fait pas `await` direct sur `.eq()`).

**T3 verifications locales** : 133/133 unit tests verts (126 baseline 9.A.2.c + 7 nouveaux). Coverage unit-only post-9.A.2.d `app/actions/parrainage.ts` = lines **85.46** / branches **71.92** / functions **100** / statements **84.17** (+5.53/+2.69/=/+5.39 vs 9.A.2.c local). tsc OK. lint 193 warnings 0 erreur (baseline). lint:a11y-check 155 (baseline). a11y:axe:check exit 0 aucun delta C/S 8 parcours. check:no-direct-notifications-log-insert / check:as-any-global / check:oracle-paywall exit 0.

**T4 push GHA** : a executer post-commit (utilisateur). Pattern attendu (heritage 9.A.2.c) : 1er run GHA mesure cumul -> ajustement `vitest.config.ts > thresholds` aux chiffres mesures arrondis au point inferieur (jamais < 80/72/100/79 palier 3 effectif courant) -> 2e push (1 run vert suffit pattern F-Epic9-A2 relaxe).

### Completion Notes List

- **Decision-gate Option hybride C1+C3 (recommande)** retenue via AskUserQuestion GO Sylvain explicite. 7 SC unit livres (SC41-SC47) sans toucher au code source (AC10 respecte).
- **F-Epic9-A2 soldee definitivement** : palier 3 effectif final acte comme palier final permanent. Aucune story de coverage future sur `app/actions/parrainage.ts`. Retrait F-Epic9-A2 du backlog roadmap.
- **Categories evaluees cas par cas** : C1 GO (5 SC error paths Sentry observabilite), C2 NO-GO (cosmetique), C3 GO net (2 SC rate-limit anti-fraude H12 + zero couverture integration), C4 HORS-CIBLE FORCE (retry 23505 keyspace 31^8 structurel defer 8.A.1 F11).
- **Extension helper additive** : `then` ajoute sur sous-objet update (zero breaking change, test garantie helper intact, heritage 9.A.2.c pattern).
- **Decouverte mineure** : les SC existants utilisent `buildRpcAllowed` qui retourne un builder non-thenable -> `data` finit par etre l'objet builder (truthy != false) et l'if `allowed === false` est silencieusement bypasse. SC46/SC47 sont les 1ers SC qui exercent reellement les branches rate-limit en unit-only. **Aucune correction necessaire** sur les SC existants (le bypass est silencieux et benin : le test ne vise pas le rate-limit dans ce path).
- **Pre-correction proactive T2.6** : aucun nouveau SC n'utilise `vi.stubEnv`, donc le finding code review 9.A.2.c env stub leak score 75 n'a pas besoin de `afterEach unstubAllEnvs` ajoute dans le nouveau describe block.
- **T4 ajustement thresholds vitest** : a executer post-1er run GHA (cumul unit+integration mesure). Thresholds courants 80/72/100/79 ne regressent jamais.
- **DoD a11y N/A confirme** : story 100% tests/doc, 0 fichier `.tsx`/`.css` touche (heritage 9.A.2/9.A.2.b/9.A.2.c). `a11y:axe:check` execute par securite (regle CLAUDE.md durcie), 0 delta Critical/Serious sur 8 parcours.

### File List

- **`tests/unit/parrainage-symetrie.test.ts`** (modifie, +325 lignes nettes 1803-2128) : 7 SC ajoutes SC41-SC47 dans 2 nouveaux describe blocks (createParrainageRelation error paths Sentry C1 + validateCode rate-limit C3).
- **`tests/unit/_lib/supabase-mock.ts`** (modifie, +8 lignes nettes commentaire + `then` ligne 117) : extension additive helper (then sur sous-objet update pour rendre `.update().eq()` awaitable).
- **`DECISIONS.md`** (modifie, +37 lignes) : bloc "Verdict 9.A.2.d (2026-05-18) -- Option hybride C1+C3 retenue -- F-Epic9-A2 solde definitivement" ajoute apres bloc palier 3 9.A.2.c. Tableau C1-C4 + extension helper + regle pattern futur.
- **`_bmad-output/implementation-artifacts/deferred-work.md`** (modifie, +4 lignes nettes) : item 9.A.2.d transforme `[Solde 9.A.2.d - 2026-05-18 - PR a venir / GHA TBD]` + bloc `## Final Resolution: F-Epic9-A2 -- palier 3 effectif final acte comme palier final definitif (2026-05-18)` ajoute.
- **`_bmad-output/implementation-artifacts/sprint-status.yaml`** (modifie, ligne 58 + ligne 407) : `last_updated` actualise + `9-a-2-d-palier-3-final-ou-acceptation-palier-effectif: ready-for-dev -> in-progress -> review`.
- **`_bmad-output/implementation-artifacts/9-a-2-d-palier-3-final-ou-acceptation-palier-effectif.md`** (modifie) : tasks/subtasks T1-T5 coches + Dev Agent Record + File List + Change Log + Status `ready-for-dev -> in-progress -> review`.
- **`_bmad-output/implementation-artifacts/9-a-2-d-verdict-draft.md`** (cree puis supprime T5.6) : draft 1-page evaluation valeur metier C1-C4, supprime apres GO Sylvain.
- **Memoire `project_epic_9_cadrage.md`** (modifie, +1 entree) : description actualisee + bloc 9.A.2.d.

## DoD a11y

N/A -- story 100% tests unitaires/doc sans impact UI applicatif. Aucun composant React, page HTML, label, focus, contraste ni navigation clavier modifies. Baselines `lint:a11y-check` 155 + `axe-core` 0 violations Critical/Serious sur 7 parcours sont preservees par construction (aucun fichier `.tsx` touche). Pattern herite des stories soeurs 9.A.1 / 9.A.2 / 9.A.2.b / 9.A.2.c (DoD a11y N/A pour stories 100% tests/config).

## Change Log

- 2026-05-18 -- Story creee via `bmad-create-story` (workflow `/bmad-create-story`). Source : defer ligne 14-22 `_bmad-output/implementation-artifacts/deferred-work.md` (cadre par 9.A.2.c, 4 categories C1-C4) + `DECISIONS.md > F-Epic9-A2` palier 3 effectif 80/72/100/79 (2026-05-18 via PR #14) + finding code review 9.A.2.c env stub leak score 75 (pre-correction proactive T2.6). 12 AC + 6 tasks structures en decision-gate explicite T1 -> branchement T2-T4 (Option A/hybride) OU T6 (Option B). Verdict 9.A.2.d documente cas-par-cas par categorie C1-C4 dans DECISIONS.md F-Epic9-A2 + solde definitif Option B evolutive F-Epic9-A2 (palier final acte). Option B (acceptation palier 3 effectif final) explicitement valide -- pas de honte a acter "presque 85%" comme final si valeur metier des branches restantes ne justifie pas l'effort. Heritage SC20-SC40 9.A.2.c + helper `createSupabaseFromMock` extension `error: unknown` + `.delete()` chainable (deja suffisante, pas d'extension supplementaire). Status `backlog` -> `ready-for-dev`.

- 2026-05-18 -- Verdict T1 cadrage 1-page execute + GO Sylvain via `AskUserQuestion` 3 options A/B/hybride. **Option hybride C1+C3 retenue (recommande)**. Verdict cas par cas : C1 error paths Sentry GO (~5 SC), C2 defaults NO-GO cosmetique, C3 rate-limit GO net (~2 SC anti-fraude H12 + zero couverture integration), C4 retry 23505 HORS-CIBLE FORCE structurel. Total ~7 SC, gain estime +8-12 pts branches en cumul GHA. Status `ready-for-dev` -> `in-progress`.

- 2026-05-18 -- T2-T3 livraison Option hybride : 7 SC unit ajoutes SC41-SC47 dans `tests/unit/parrainage-symetrie.test.ts` (5 C1 SC41-SC45 error paths Sentry createParrainageRelation + 2 C3 SC46-SC47 validateCode rate-limit). Extension helper additive `tests/unit/_lib/supabase-mock.ts` (then sur sous-objet update, zero breaking change). DoD CI vert : tsc 0 / lint 193 warnings 0 erreur (baseline) / lint:a11y-check 155 (baseline) / a11y:axe:check 0 delta C/S 8 parcours / 3 scripts checks brownfield exit 0 / test:unit 133/133 verts. Coverage unit-only `app/actions/parrainage.ts` post-9.A.2.d : lines **85.46** (+5.53) / branches **71.92** (+2.69) / functions **100** (=) / statements **84.17** (+5.39). DECISIONS.md F-Epic9-A2 enrichi (Verdict 9.A.2.d) + deferred-work.md (Solde + Final Resolution) + memoire MAJ. T4 push GHA + ajustement thresholds vitest a executer post-commit. Status `in-progress` -> `review`. F-Epic9-A2 **soldee definitivement** (retire backlog roadmap).
