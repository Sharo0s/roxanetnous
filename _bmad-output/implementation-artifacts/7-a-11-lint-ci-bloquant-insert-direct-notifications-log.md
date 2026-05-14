# Story 7.A.11 : Lint/CI bloquant INSERT direct `notifications_log` + validation UUID `userId`

Status: done

<!-- Note: Validation is optional. Run validate-create-story for quality check before dev-story. -->

## Story

As a developpeur backend roxanetnous,
I want d'une part un garde-fou CI qui interdit tout `from('notifications_log').insert(...)` direct hors du seul caller autorise `lib/notifications-log.ts`, et d'autre part une validation runtime stricte du format UUID de `params.userId` en amont de l'INSERT dans `logNotification`,
so that la convention "passer par le helper `logNotification` plutot que faire un INSERT direct" (heritage decisions F5/F6/F7) cesse de reposer 100% sur la vigilance code-review humaine, et que les bugs latents `userId: 'undefined'` literal -> truthy -> INSERT user_id='undefined' -> exception Postgres UUID parse error soient interceptes en early-throw avec un message explicite, plutot que de se propager silencieusement vers le `catch` global du helper (qui les capture en Sentry warning sans signal clair).

## Acceptance Criteria

1. **AC1 - Script CI `scripts/check-no-direct-notifications-log-insert.mjs`** : nouveau script Node.js ESM (cf. `"type": "module"` dans `package.json`) qui scanne recursivement `app/`, `lib/`, `components/`, `scripts/` (extensions `.ts`/`.tsx`/`.mjs`) et detecte tout match du pattern `.from('notifications_log').insert` ou `.from("notifications_log").insert` (quotes simples ou doubles). **Exception unique whiteliste** : `lib/notifications-log.ts` (le seul caller autorise, qui implemente le helper). **Exclusions** : `node_modules/`, `.next/`, `.swc/`, `tests/` (les tests integration peuvent legitimement seeder via insert direct, cf. `tests/integration/notifications-log/idempotence-partial-unique-index.test.ts`), `_bmad-output/` (artefacts BMad), `*.d.ts`. **Detection** : grep textuel suffit (regex `\.from\(['\"]notifications_log['\"]\)\s*\.insert`) -- pas besoin d'AST TypeScript pour ce cas simple, contrairement a `check-as-any-global.mjs` qui doit distinguer `as unknown as <T>` de `as any`. Exit code 0 si aucun match hors whitelist, exit 1 si >= 1 match (avec liste fichier:ligne en stderr + suggestion `Utiliser logNotification() depuis lib/notifications-log.ts (decision F-Epic7-A11)`), exit 2 si erreur de scan inattendue.

2. **AC2 - Integration dans `vercel.json` buildCommand + script npm** : (a) ajout de `"check:no-direct-notifications-log-insert": "node scripts/check-no-direct-notifications-log-insert.mjs"` dans la section `scripts` de `package.json` (apres les autres `check:*` lignes 13-18) ; (b) integration dans `vercel.json` `buildCommand` apres `npm run check:rls-helpers` et avant `next build` : la chaine devient `"npm run check:env && npm run lint:a11y-check && npm run check:ip-spoofing && npm run check:as-any-admin && npm run check:as-any-global && npm run check:oracle-paywall && npm run check:rls-helpers && npm run check:no-direct-notifications-log-insert && next build"`. La CI Vercel preview/prod **bloque tout deploy** sur match positif. **Pas d'integration GHA** : le buildCommand Vercel suffit (memoire `feedback_test_local_supabase.md` -- validation par GHA workflow uniquement pour BDD, mais pour les checks statiques le buildCommand Vercel fait foi).

3. **AC3 - Validation runtime UUID dans `logNotification`** : modification de `lib/notifications-log.ts` pour ajouter, **en tete de la fonction `logNotification` avant le `try`**, une validation stricte du format UUID de `params.userId` quand il est present (non-null, non-empty). Pattern regex utilise : `/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i` (case-insensitive : Postgres accepte `D1D1...` aussi bien que `d1d1...`). Comportement requis :
   - `params.userId === undefined` -> aucune validation, mappe a `null` via `params.userId || null` (comportement actuel preserve).
   - `params.userId === null` -> idem (mappe a `null`).
   - `params.userId === ''` -> falsy, mappe a `null` (comportement actuel preserve).
   - `params.userId === 'undefined'` literal (string) -> truthy mais format invalide -> **throw `new Error("logNotification: userId invalid format (expected UUID v4, got: \"undefined\")")` AVANT le try** (= remonte au caller, le `catch` du helper ne l'avale pas).
   - `params.userId === 'foo-bar'` ou tout autre string non-UUID -> throw avec message explicite.
   - `params.userId === 'd1d1c054-ddc0-452e-8347-e6b5fa3799e2'` -> passe la validation, INSERT normal.
   
   **Justification du throw plutot que de mapper a null + Sentry warning** : la decision F-Epic7-A11 retient le throw early **avant le try** pour que le caller ait un signal clair (exception remonte) plutot qu'un silencieux mappage qui masquerait le bug d'origine cote caller (souvent `String(undefined)` accidentel dans le chemin du caller). Cela inverse le pattern "defense en profondeur" historique (cf. commentaire de tete `lib/notifications-log.ts:6-10` "Sentry capture l'incident, l'audit BDD est sacrifie au profit de la disponibilite applicative") **uniquement pour ce cas precis de validation d'input du caller** -- les exceptions DB internes (RLS, BDD down, CHECK status invalide) restent capturees par le try/catch.

4. **AC4 - Mise a jour du commentaire de tete `lib/notifications-log.ts`** : la note ligne 16-18 qui annonce la story 7.A.11 future (`"Story 7.A.11 (futur, mini-epic 7.A) ajoutera un garde-fou CI ... + une validation UUID stricte sur userId en amont du try."`) est remplacee par une note **livraison** : `"Story 7.A.11 (2026-05-14 / decision F-Epic7-A11) : garde-fou CI scripts/check-no-direct-notifications-log-insert.mjs + validation runtime regex UUID sur params.userId (throw early avant try si format invalide, propage au caller)."`. La structure du commentaire est conservee (ne pas reecrire toute la tete).

5. **AC5 - Tests Vitest unit pour la validation UUID** : extension du fichier existant `tests/unit/notifications-log.test.ts` (story 7.A.6) avec un nouveau `describe('logNotification > userId validation')` regroupant 6 cas :
   - **(uuid-a) UUID valide minuscule** : `userId: 'd1d1c054-ddc0-452e-8347-e6b5fa3799e2'` -> `mockInsert` appele 1x avec `user_id = 'd1d1c054-...'`, aucun throw, aucun Sentry capture.
   - **(uuid-b) UUID valide majuscule** : `userId: 'D1D1C054-DDC0-452E-8347-E6B5FA3799E2'` -> idem (regex `/i` case-insensitive), payload preserve la casse du caller.
   - **(uuid-c) `userId: 'undefined'` literal** : `await expect(logNotification({...baseParams, userId: 'undefined'})).rejects.toThrow(/UUID/)` -> throw avant try, `mockInsert` jamais appele (`expect(mockInsert).not.toHaveBeenCalled()`), `mockCaptureException` jamais appele.
   - **(uuid-d) `userId: ''` empty string** : `await logNotification({...baseParams, userId: ''})` -> resolve sans throw, `mockInsert` appele avec `user_id = null` (falsy short-circuit preserve).
   - **(uuid-e) `userId: undefined` (omis)** : `await logNotification({email, type, subject, status})` (sans le champ `userId`) -> resolve sans throw, `mockInsert` appele avec `user_id = null`.
   - **(uuid-f) `userId: 'not-a-uuid'`** : `await expect(...).rejects.toThrow(/UUID/)` -> throw avant try, `mockInsert` jamais appele.
   
   Le `beforeEach` existant (lignes 57-62) reste applicable. Le helper `mockSupabaseInsertResult` n'est PAS appele dans les cas (uuid-c) et (uuid-f) puisque l'insert ne doit pas etre atteint (l'absence de mock garantirait un throw au runtime du test si le code regressait et atteignait l'insert -- garde-fou supplementaire). Total tests existants `tests/unit/notifications-log.test.ts` apres extension : tests actuels (4 cas a-d + 23505 idempotence du 7.A.6 si presents) + 6 nouveaux cas = **suite verte**.

6. **AC6 - Tests Vitest pour le script de check** : nouveau fichier `tests/unit/check-no-direct-notifications-log-insert.test.ts` qui invoque le script via `execSync('node scripts/check-no-direct-notifications-log-insert.mjs', { cwd, env })` (ou execution programmatique si le script exporte une fonction -- au choix du dev, le test fonctionnel via `execSync` est le minimum requis). 3 cas :
   - **(check-a) HEAD courant (apres livraison story)** : exit 0 -- seul `lib/notifications-log.ts` contient le pattern, et il est whiteliste.
   - **(check-b) Fixture violation** : create temporairement un fichier `tests/fixtures/fake-direct-insert.ts.fixture` contenant `supabase.from('notifications_log').insert({...})`, copier dans `app/_test-fixture-7-a-11.ts`, run script -> exit 1, message contient le path du fichier offendant, puis cleanup du fichier de fixture (`afterAll`). **Alternative plus robuste** : mocker la liste de fichiers scannes via env var (`CHECK_NDLI_PATHS_OVERRIDE=...`) -- au choix du dev selon contrainte de mock.
   - **(check-c) Whitelist verifiable** : grep le contenu du script et asserter qu'il contient la chaine `'lib/notifications-log.ts'` dans sa whitelist (anti-regression : eviter qu'un refactor du script casse silencieusement la whitelist).
   
   Si `execSync` se revele trop fragile (timeout, env, etc.), fallback acceptable : tester la logique pure du script en l'extrayant en module ESM testable (`scripts/check-no-direct-notifications-log-insert.mjs` exporte une fonction `scanForDirectInserts(rootDir, options)` consommee par les 2 cas + un bin shim CLI en tete -- pattern similaire a `check-as-any-global.mjs`).

7. **AC7 - Audit zero regression sur les call-sites existants** : grep exhaustif `logNotification\b` dans le repo (deja effectue au cadrage : 5 fichiers `.ts` source hors worktrees et hors node_modules -- `app/actions/contact.ts`, `tests/unit/notifications-log.test.ts`, `tests/integration/setup.ts`, `tests/integration/notifications-log/idempotence-partial-unique-index.test.ts`, `lib/notifications-log.ts`) **revele que tous les call-sites prod passent `userId` soit absent, soit `user.id` Supabase Auth (toujours UUID valide), soit `null` explicite** -- aucun call-site connu ne passe `'undefined'` literal. La validation AC3 est donc une defense en profondeur (intercepte un bug futur de regression), pas un correctif d'un bug actuel exerce en prod. Cela doit etre **explicitement note dans Dev Agent Record** : "Validation runtime UUID = defense en profondeur, aucun call-site connu n'exerce le cas `userId: 'undefined'` literal a la date de livraison."

8. **AC8 - Validation pre-commit livraison + DoD** :
   - `npm run check:no-direct-notifications-log-insert` exit 0 sur HEAD.
   - `npm run lint` exit 0 (aucun nouveau warning).
   - `npm run lint:a11y-check` exit 0 (story sans impact UI, baseline 158 conserve).
   - `npm run test:unit` exit 0 (tests 7.A.6 + 6 nouveaux cas + 3 cas check script = verts).
   - `npm run build` exit 0 (le buildCommand Vercel passe le nouveau check + next build).
   - `npm run a11y:axe:check` exit 0 (regle CLAUDE.md durcie, meme si story sans impact UI -- baseline 0 violations Critical/Serious sur 7 parcours).
   - **Tests integration** : pas de nouveau test integration prevu (le script CI est purement statique, la validation UUID est testable unit). Les tests integration existants (`tests/integration/notifications-log/idempotence-partial-unique-index.test.ts`) doivent rester verts -- ils utilisent `supabase.from('notifications_log').insert(...)` directement pour seeder, mais sont **dans `tests/`** donc dans la liste d'exclusions du script (AC1).

9. **AC9 - Solde dette + mise a jour artefacts BMad** :
   - `_bmad-output/implementation-artifacts/deferred-work.md` : barrer les **2 lignes** suivantes (markdown `~~...~~`) avec prefixe `[Solde 7.A.11 - 2026-05-14]` :
     - Ligne 244 (`Pas de validation runtime de userId dans logNotification`).
     - Ligne 248 (`Aucune lint rule / hook CI pour empecher INSERT direct sur notifications_log`).
   - Note : la mention dans le commentaire de tete `lib/notifications-log.ts:16-18` n'est PAS dans `deferred-work.md` (c'est une note inline), elle est traitee par AC4.
   - `sprint-status.yaml` : passer `7-a-11-lint-ci-bloquant-insert-direct-notifications-log` de `backlog` a `ready-for-dev` (fait par ce workflow) puis a `review` post-implementation par le dev agent, puis a `done` post-merge selon conventions BMad (memoire `project_bmad_conventions.md`).
   - **Pas de DECISIONS.md** : la convention "passer par `logNotification`" est deja documentee (heritage F5/F6/F7), et la validation UUID est une defense en profondeur cosmetique qui ne merite pas une entree DECISIONS dediee. Si le dev rencontre un cas limite (ex : decision de mapper `'undefined'` literal a `null` plutot que throw), il **doit** ouvrir DECISIONS avec une entree `F-Epic7-A11` et marquer la story `blocked` jusqu'a alignement avec Sylvain.

## Tasks / Subtasks

- [x] **T1 - Script CI `check-no-direct-notifications-log-insert.mjs`** (AC: #1, #2)
  - [x] T1.1 - Creer `scripts/check-no-direct-notifications-log-insert.mjs` en s'inspirant de la structure de `scripts/check-as-any-global.mjs` (lignes 1-116) : meme shebang, meme commentaire de tete (justification + scope + exit codes), meme pattern `walk()` generator avec `SKIP_DIRS` et `SKIP_SUFFIXES`. Adapter `SEARCH_PATHS = ['app', 'lib', 'components', 'scripts']` et `EXTENSIONS = ['.ts', '.tsx', '.mjs']`. Exclusions supplementaires : `tests/` (a ajouter dans `SKIP_DIRS`) + whitelist explicite `lib/notifications-log.ts` (verification par `file.endsWith('lib/notifications-log.ts')`).
  - [x] T1.2 - Implementation detection : pour chaque fichier, lire le contenu (`readFileSync`), appliquer la regex `/\.from\(['"]notifications_log['"]\)\s*\.insert/g`, pour chaque match calculer le numero de ligne (`content.slice(0, match.index).split('\n').length`), pousser dans `matches.push({ file: rel, line, snippet })`. Pas d'AST TypeScript necessaire (pattern unique et simple, faux positifs improbables -- contrairement a `as any`).
  - [x] T1.3 - Implementer la sortie : exit 0 + message OK si `matches.length === 0`. Sinon exit 1, stderr liste `file:line: snippet` + message `Utiliser logNotification() depuis lib/notifications-log.ts (decision F-Epic7-A11)`. Catch global pour exit 2 si erreur de scan.
  - [x] T1.4 - Ajouter le script `"check:no-direct-notifications-log-insert": "node scripts/check-no-direct-notifications-log-insert.mjs"` dans `package.json` apres la ligne 18 (`check:rls-helpers`).
  - [x] T1.5 - Modifier `vercel.json` `buildCommand` : inserer `&& npm run check:no-direct-notifications-log-insert` apres `&& npm run check:rls-helpers` et avant `&& next build`.

- [x] **T2 - Validation runtime UUID dans `logNotification`** (AC: #3, #4)
  - [x] T2.1 - Editer `lib/notifications-log.ts` : ajouter la constante `UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i` au module-level (au-dessus de `export async function logNotification`) -- choix module-level pour economie d'allocation par appel.
  - [x] T2.2 - Ajouter le bloc de validation `if (params.userId && !UUID_REGEX.test(params.userId)) { throw new Error(...) }` **avant le `try`**. Throw avec template literal interpolant `params.userId`. Positionne avant le try -> remonte au caller, n'est PAS avale par le catch Sentry.
  - [x] T2.3 - Mettre a jour le commentaire de tete `lib/notifications-log.ts:16-18` : remplacer la note prospective sur 7.A.11 par la note livraison F-Epic7-A11.

- [x] **T3 - Tests Vitest unit logNotification UUID validation** (AC: #5)
  - [x] T3.1 - Ajouter dans `tests/unit/notifications-log.test.ts` un nouveau `describe('logNotification > userId validation', () => {...})` apres le `describe` existant. Mocks `mockInsert`, `mockCaptureException`, `mockCreateClient`, `mockSupabaseInsertResult` reutilises.
  - [x] T3.2 - Implementer les 6 cas (uuid-a a uuid-f) selon les specs AC5.
  - [x] T3.3 - `npm run test:unit -- tests/unit/notifications-log.test.ts` -> 10/10 verts (4 existants + 6 nouveaux).

- [x] **T4 - Tests Vitest unit script CI** (AC: #6)
  - [x] T4.1 - Approche retenue : (b) refactor du script pour exporter `scanForDirectInserts(rootDir, options)` + `WHITELIST` + un shim CLI en fin de fichier (detection `isMain` via `fileURLToPath(import.meta.url) === resolve(process.argv[1])`). Effort < 15 min. Choix justifie : evite la fragilite execSync (timeouts/env) + permet de tester l'isolation de la whitelist via un repo temporaire `mkdtempSync(os.tmpdir())` au lieu de creer une fixture dans le repo source (option plus robuste que la suggestion AC6 fixture inline).
  - [x] T4.2 - Creer `tests/unit/check-no-direct-notifications-log-insert.test.ts` avec les 3 cas + 1 cas additionnel (check-b1 fixture + check-b2 whitelist respectee dans le repo temporaire).
  - [x] T4.3 - Cas (check-b) : repo temporaire `mkdtempSync(join(tmpdir(), 'check-ndli-'))` + cleanup `afterAll` via `rmSync(... { recursive: true, force: true })`. **Avantage vs fixture inline** : aucun risque de polluer le repo source meme en cas de crash du test, le repo temporaire est isole dans `/tmp`.

- [x] **T5 - Validation pre-commit livraison** (AC: #8)
  - [x] T5.1 - `npm run check:no-direct-notifications-log-insert` -> exit 0.
  - [x] T5.2 - `npm run lint` -> exit 0 (apres ajout `.claude/worktrees/**` aux ignores eslint.config.js : 3 worktrees git locked d'agents anciens polluaient tsconfigRootDir, blocker pre-existant orthogonal a la story).
  - [x] T5.3 - `npm run lint:a11y-check` -> exit 0, 155 baseline preserve.
  - [x] T5.4 - `npm run test:unit` -> exit 0, 59/59 verts (vs 49 avant story).
  - [x] T5.5 - `npm run build` -> exit 0 + chaine Vercel buildCommand simulee localement (`npm run check:env && lint:a11y-check && check:ip-spoofing && check:as-any-admin && check:as-any-global && check:oracle-paywall && check:rls-helpers && check:no-direct-notifications-log-insert`) -> tous OK.
  - [x] T5.6 - `npm run a11y:axe:check` -> exit 0, 0 delta Critical/Serious sur 7 parcours.

- [x] **T6 - Mise a jour artefacts BMad** (AC: #9)
  - [x] T6.1 - Editer `_bmad-output/implementation-artifacts/deferred-work.md` : 2 lignes (244 + 248) barrees avec `~~...~~ [Solde 7.A.11 - 2026-05-14]`.
  - [x] T6.2 - Editer `_bmad-output/implementation-artifacts/sprint-status.yaml` : `7-a-11-...` `ready-for-dev` -> `in-progress` -> `review`. `last_updated` enrichi.
  - [x] T6.3 - Dev Agent Record renseigne (File List + Completion Notes + note AC7).

## Dev Notes

### Architecture et conventions

- **Stack** : Next.js 16 App Router + Supabase + TypeScript strict + Tailwind v4 (cf. `_bmad-output/planning-artifacts/architecture-technique-roxanetnous-2026-02-09.md` + `.claude/CLAUDE.md`).
- **Package type ESM** : pas de `require`, imports `from '@/...'` (alias root `tsconfig.json`). Le script `scripts/check-no-direct-notifications-log-insert.mjs` doit etre ecrit en ESM (`.mjs` ou `.js` avec `"type": "module"` -- le pattern existant dans `scripts/` est `.mjs` cf. `check-as-any-global.mjs`, `check-required-env.mjs`).
- **Pattern garde-fou CI** : les checks `scripts/check-*.mjs` suivent une structure unifiee depuis la story 5.C.1 : commentaire de tete justificatif (DECISIONS reference + scope + exit codes), import ESM, generator `walk()`, sortie OK/ERREUR avec exit code explicite. Le nouveau script doit suivre exactement ce pattern (cf. `check-as-any-global.mjs` lignes 1-116 comme modele de reference le plus proche -- meme principe de scan recursif avec exclusions).
- **Pattern singleton helper SDK** : le helper `logNotification` est le **seul point d'entree autorise** pour INSERT dans `notifications_log` (cf. commentaire `lib/notifications-log.ts:1-19`). La convention est tracee dans les commentaires de tete + le buildCommand Vercel apres cette story. Pas de presence explicite dans DECISIONS.md (cf. note AC9 sur l'absence de creation d'une nouvelle decision F-Epic7-A11 formelle).

### Code paths critiques touches

- **`lib/notifications-log.ts`** :
  - Tete du fichier (lignes 16-18) : note prospective 7.A.11 a remplacer par note livraison.
  - Ligne 32-39 (signature `logNotification` + accolade ouvrante) : zone d'insertion de la validation UUID **avant** le try ligne 40.
  - Lignes 42-50 (mapping payload) : ne pas toucher -- la validation UUID n'affecte pas le mapping (elle gate l'entree de la fonction).
  - Lignes 75-84 (catch global Sentry) : ne pas toucher -- ce catch ne doit PAS attraper l'erreur de validation UUID (le throw est avant le try).
- **`scripts/check-no-direct-notifications-log-insert.mjs`** : fichier neuf, modele = `scripts/check-as-any-global.mjs` (structure + exit codes + format de sortie).
- **`package.json`** : ajout d'une ligne `check:no-direct-notifications-log-insert` dans la section `scripts` apres ligne 18.
- **`vercel.json`** : modification de la string `buildCommand` ligne 2 -- ajouter `&& npm run check:no-direct-notifications-log-insert` au bon endroit (apres `check:rls-helpers`, avant `next build`).
- **`tests/unit/notifications-log.test.ts`** : extension avec un nouveau `describe` -- ne pas toucher les tests existants (story 7.A.6).
- **`tests/unit/check-no-direct-notifications-log-insert.test.ts`** : fichier neuf, pattern execSync ou import direct selon choix T4.1.
- **`_bmad-output/implementation-artifacts/deferred-work.md`** : barrer 2 lignes (244 + 248).
- **`_bmad-output/implementation-artifacts/sprint-status.yaml`** : update statut story (workflow handle ready-for-dev, dev agent handle review).

### Risques et mitigations

- **R1 - Faux positifs du grep textuel sur `.from('notifications_log').insert`** : si un fichier contient cette chaine dans un commentaire ou une string (ex : un commentaire qui mentionne le pattern interdit), le script va matcher a tort. **Mitigation** : pour cette story, accepter le risque et corriger reactivement si une false-positive apparait sur HEAD. Sinon, fallback AST TypeScript (plus lourd, hors scope). Une regex sur le code source d'un projet de cette taille (~50 fichiers `.ts` dans `lib/`) a une probabilite tres faible de false-positive sur un pattern aussi specifique. **Verification au moment T1.3** : run le script sur HEAD apres implementation, confirmer exit 0 -- si exit 1, ajuster les exclusions ou raffiner la regex.
- **R2 - Le pattern regex echoue sur formattings exotiques** : `supabase\n  .from('notifications_log')\n  .insert(...)` (split multi-ligne). La regex `/\.from\(['"]notifications_log['"]\)\s*\.insert/g` avec le flag `\s*` couvre les whitespaces, mais pas les newlines sans flag `s`. **Mitigation** : tester la regex sur le contenu de `lib/notifications-log.ts:42` qui contient le seul match legitime, en s'assurant qu'il matche. Si le code prod future passe en multi-ligne, raffiner la regex avec `[\s\n]*` ou flag `s` global. La forme actuelle de `lib/notifications-log.ts:42` est sur une seule ligne (`.from('notifications_log').insert({`), donc la regex sans `s` suffit.
- **R3 - La validation UUID introduit un throw dans un helper historiquement silencieux** : le commentaire de tete `lib/notifications-log.ts:6-10` revendique explicitement "ni propager dans le try du caller (risque double-log) ni provoquer d'unhandled rejection". Le throw early de l'AC3 **inverse partiellement** cette garantie pour le cas precis de la validation d'input. **Mitigation** : (a) le throw est positionne **avant le try** -> ce n'est PAS un unhandled rejection (c'est une exception synchronousable par le caller), (b) le cas est defensif (AC7 confirme qu'aucun call-site connu ne l'exerce), (c) le commentaire de tete est mis a jour (AC4) pour documenter explicitement cette inversion ciblee. **Si Sylvain prefere mapper `'undefined'` literal a `null`** (pattern moins strict), c'est une decision F-Epic7-A11 formelle a documenter -- le dev doit alors marquer la story `blocked` et ouvrir DECISIONS avant de continuer.
- **R4 - Le test cas (check-b) avec fixture sur disque peut polluer le repo** : si le test crash entre la creation et le cleanup, le fichier fixture reste, faisant echouer tous les runs suivants. **Mitigation** : utiliser `try/finally` dans le test OU une fixture `tests/fixtures/*.fixture` (extension non scannee par le script grace a `SKIP_SUFFIXES`) + un test qui appelle le script avec un `cwd` ou env var pointant vers `tests/fixtures/` -- mais ce mode test impose un refactor du script en module testable (option T4.1.b).

### Pattern test

- **Test unit existant a etendre** : `tests/unit/notifications-log.test.ts` (story 7.A.6) -- structure des mocks deja en place (`mockInsert`, `mockCaptureException`, `mockCreateClient`, `mockSupabaseInsertResult`).
- **Test unit nouveau** : `tests/unit/check-no-direct-notifications-log-insert.test.ts` -- pas de mocks complexes, le test exerce le script en boite noire (execSync) ou via import direct.
- **Validation BDD locale** : pas necessaire (memoire `feedback_test_local_supabase.md` : Sylvain ne lance pas Docker/supabase start, validation via GHA workflow uniquement). Cette story est purement statique cote CI + unitaire cote tests -- aucune migration BDD, aucun INSERT runtime, aucune RLS impactee.

### References

- Cadrage : `_bmad-output/planning-artifacts/epic-7.md` lignes 329-346 (story 7.A.11).
- Source dette #1 (validation UUID) : `_bmad-output/implementation-artifacts/deferred-work.md:244` (review 4.2 deferred).
- Source dette #2 (lint CI INSERT direct) : `_bmad-output/implementation-artifacts/deferred-work.md:248` (review 4.2 deferred).
- Helper actuel : `lib/notifications-log.ts:1-86` (livre story 7.A.6).
- Convention "passer par `logNotification`" : commentaire de tete `lib/notifications-log.ts:1-19` + heritage DECISIONS.md F5/F6/F7 (note : F6 documente le schema `notifications_log` etendu user_id NULLABLE + status sept valeurs, F7 la queue email durable Workflow DevKit -- la convention "INSERT via helper" est implicite mais pas formellement ecrite, ce qui justifie justement le besoin d'un garde-fou CI).
- Modele de script CI : `scripts/check-as-any-global.mjs` (lignes 1-116) -- pattern walk + exclusions + exit codes.
- Modele alternatif (plus simple, grep textuel) : `scripts/check-ip-spoofing.mjs` (a inspecter si grep textuel sans AST suffit -- ce qui est le cas ici).
- Tests unit existants : `tests/unit/notifications-log.test.ts` (story 7.A.6, 4+ cas).
- Tests integration existants : `tests/integration/notifications-log/idempotence-partial-unique-index.test.ts` (story 7.A.6) -- a verifier qu'il reste vert apres ajout du check (le script exclut `tests/`).
- Memoires associees :
  - `project_logNotification_bug.md` (cette story cloture les 2 reliquats : lint CI + validation UUID -- a mettre a jour post-merge avec status "Solde 7.A.11").
  - `feedback_test_local_supabase.md` (validation par GHA workflow uniquement).
  - `project_bmad_conventions.md` (format commit `Story 7.A.11 : ...` + statut `done` apres merge).
- Regle a11y : `.claude/CLAUDE.md` -- `npm run a11y:axe:check` obligatoire pre-commit livraison meme si la story n'a aucun impact UI.

### Project Structure Notes

- Alignement avec la structure du repo : aucun nouveau dossier, fichiers crees dans `scripts/` et `tests/unit/` qui suivent les conventions existantes.
- Aucune nouvelle dependance npm requise (utilise `node:fs`, `node:path`, `node:url` deja consommes par les autres scripts -- pas besoin de `typescript` package pour ce check vu l'AST n'est pas necessaire).
- Aucune migration BDD.
- Aucune modification de RLS, de policy, de type Supabase genere (`types/supabase.ts`).

## Dev Agent Record

### Agent Model Used

claude-opus-4-7 (Opus 4.7, 1M context) via bmad-dev-story skill, 2026-05-14.

### Debug Log References

- `npm run test:unit -- tests/unit/notifications-log.test.ts` : 10/10 verts (4 existants 7.A.6 + 6 nouveaux 7.A.11 UUID).
- `npm run test:unit -- tests/unit/check-no-direct-notifications-log-insert.test.ts` : 4/4 verts (check-a HEAD, check-b1 fixture violante, check-b2 whitelist respectee, check-c WHITELIST + source).
- `npm run test:unit` full : 59/59 verts en 1.03s (5 fichiers).
- `npm run check:no-direct-notifications-log-insert` : exit 0 sur HEAD.
- Chaine Vercel buildCommand simulee localement (check:env -> check:no-direct-notifications-log-insert) : tous exit 0.
- `npm run lint` : exit 0 apres ajout `.claude/worktrees/**` aux ignores eslint.config.js (correctif chirurgical d'un blocker pre-existant non lie a la story, 3 worktrees git locked d'agents anciens polluaient tsconfigRootDir avec 981 errors).
- `npm run lint:a11y-check` : 155 baseline preserve (0 nouveau warning).
- `npm run a11y:axe:check` : 0 delta Critical/Serious sur 7 parcours, baseline `_bmad-output/test-artifacts/axe-core-baseline-2026-05-05.json`.
- `npm run build` : exit 0, Compiled successfully in 4.9s, 55/55 static pages generated.

### Completion Notes List

- **Choix T4.1 documente** : approche (b) retenue (export `scanForDirectInserts` + shim CLI). Effort effectif ~10 min (script court, pattern direct). Avantage : repo temporaire `mkdtempSync(os.tmpdir())` plus robuste que fixture inline (suggestion AC6) -- aucun risque de polluer le repo source meme en cas de crash du test. Le shim CLI est testable indirectement via la chaine `npm run check:no-direct-notifications-log-insert` qui exerce le binary path.
- **Detection `isMain` du shim CLI** : implementee via `resolve(process.argv[1] || '') === fileURLToPath(import.meta.url)` dans un try/catch (le wrap try/catch attrape les cas exotiques de tests qui font `argv[1] = undefined`). Sous Vitest, l'import direct n'active pas le shim, evitant tout `process.exit()` parasite.
- **Note AC7 explicite** : la validation runtime UUID dans `logNotification` est une defense en profondeur. Audit grep `logNotification\b` au cadrage : 5 fichiers sources hors `node_modules/` et `.claude/worktrees/` -- `app/actions/contact.ts` (passe `user.id` Supabase Auth ou ne passe pas `userId`), `tests/unit/notifications-log.test.ts` (mocks contrlees), `tests/integration/setup.ts` (test fixtures avec UUID generes), `tests/integration/notifications-log/idempotence-partial-unique-index.test.ts` (UUID test fixtures), `lib/notifications-log.ts` (le helper lui-meme). **Aucun call-site connu n'exerce le cas `userId: 'undefined'` literal a la date de livraison.** La validation intercepte un bug futur de regression (typiquement `String(undefined)` accidentel), pas un bug actuel exerce en prod. Le throw early *avant le try* inverse partiellement la garantie historique du helper ("ne propage jamais d'erreur au caller") mais uniquement pour la validation d'input du caller -- les erreurs DB internes restent capturees par le catch Sentry.
- **Pas de DECISIONS.md F-Epic7-A11** : conformement a AC9, la convention "passer par `logNotification`" est deja documentee (heritage F5/F6/F7) et la validation UUID est une defense cosmetique qui ne merite pas une entree DECISIONS dediee. La reference `F-Epic7-A11` est utilisee comme tag de tracabilite dans les commentaires de code + messages CI sans formalisation DECISIONS.
- **Cleanup chirurgical eslint.config.js** : ajout `.claude/worktrees/**` aux ignores. Probleme pre-existant : 3 worktrees git locked (`agent-a8cce1d6381c837a8`, `agent-a91aecc1c04f57191`, `agent-ab6a2442dd9dd04a9`) d'agents anciens dont les copies tsconfig polluent `tsconfigRootDir` typescript-eslint. Validation utilisateur explicite avant modif (cf. AskUserQuestion).
- **Pas de migration BDD** : story purement statique cote CI + helper runtime serveur. Aucune RLS, aucun type Supabase regen, aucune policy modifiee.

### File List

**Nouveaux fichiers (2)** :
- `scripts/check-no-direct-notifications-log-insert.mjs` (115 lignes) -- garde-fou CI ESM grep textuel, exporte `scanForDirectInserts(rootDir, options)` + `WHITELIST` + `DEFAULT_*` constantes + shim CLI.
- `tests/unit/check-no-direct-notifications-log-insert.test.ts` (66 lignes) -- 4 cas Vitest unit via import direct.

**Fichiers modifies (6)** :
- `lib/notifications-log.ts` -- ajout `UUID_REGEX` module-level (1 ligne) + bloc guard validation 5 lignes avant le `try` + maj commentaire de tete lignes 16-18 (note prospective -> note livraison F-Epic7-A11).
- `tests/unit/notifications-log.test.ts` -- nouveau `describe('logNotification > userId validation', ...)` 6 cas (uuid-a..uuid-f) ajoute en fin de fichier (~65 lignes ajoutees).
- `package.json` -- ajout `"check:no-direct-notifications-log-insert": "node scripts/check-no-direct-notifications-log-insert.mjs"` apres `check:rls-helpers`.
- `vercel.json` -- insertion `&& npm run check:no-direct-notifications-log-insert` dans `buildCommand` entre `check:rls-helpers` et `next build`.
- `eslint.config.js` -- ajout `'.claude/worktrees/**'` a la liste `ignores` (correctif chirurgical blocker pre-existant).
- `_bmad-output/implementation-artifacts/deferred-work.md` -- 2 lignes barrees `~~...~~ [Solde 7.A.11 - 2026-05-14]` (244 + 248).
- `_bmad-output/implementation-artifacts/sprint-status.yaml` -- statut story `ready-for-dev` -> `review` + `last_updated` enrichi.
- `_bmad-output/implementation-artifacts/7-a-11-lint-ci-bloquant-insert-direct-notifications-log.md` -- Status `ready-for-dev` -> `review`, tasks/subtasks toutes cochees, Dev Agent Record renseigne.

### Change Log

| Date | Auteur | Resume |
|---|---|---|
| 2026-05-14 | Sylvain (Opus 4.7 via bmad-dev-story) | Livraison Story 7.A.11 status `review` : garde-fou CI INSERT direct `notifications_log` + validation runtime UUID `userId` dans `logNotification` (throw early avant try). 2 nouveaux fichiers + 6 modifies. 59/59 unit verts, chaine Vercel buildCommand simulee localement OK, lint/a11y baselines preserves. 2 lignes deferred-work.md soldees. |

### Review Findings

- [x] [Review][Defer] PATTERN ne détecte pas les inserts via variable intermédiaire (`const q = supabase.from('notifications_log'); q.insert(...)`) [scripts/check-no-direct-notifications-log-insert.mjs] — deferred, limite délibérée du grep textuel (documentée AC1 R1/R2, AST hors scope)
- [x] [Review][Defer] PATTERN ne détecte pas les template literals backtick (`.from(\`notifications_log\`)`) [scripts/check-no-direct-notifications-log-insert.mjs] — deferred, faux positif improbable en pratique Supabase JS
- [x] [Review][Defer] `skipDirs` filtre par basename → sous-dossier nommé `tests` dans `app/` serait silencieusement exclu [scripts/check-no-direct-notifications-log-insert.mjs] — deferred, risque faible (convention du projet : pas de dossier `tests/` dans `app/`)
- [x] [Review][Defer] UUID nil (`00000000-0000-0000-0000-000000000000`) accepté comme valide — regex dit "v4" mais valide tous formats UUID RFC 4122 [lib/notifications-log.ts:24] — deferred, Supabase Auth ne génère jamais d'UUID nil, défense en profondeur suffisante
- [x] [Review][Defer] Symlinks non gérés dans `walk()` — boucle infinie théorique si symlink circulaire [scripts/check-no-direct-notifications-log-insert.mjs:35-49] — deferred, pré-existant (pattern hérité de check-as-any-global.mjs), risque infime sur ce repo
- [x] [Review][Defer] Whitelist sensible à la casse sur macOS — rename de casse git-invisible pourrait casser la whitelist [scripts/check-no-direct-notifications-log-insert.mjs:66] — deferred, risque extrêmement faible, observable immédiatement en CI Linux
- [x] [Review][Defer] Whitelist avec séparateur Windows (`\`) — faux positif si exécuté sur Windows [scripts/check-no-direct-notifications-log-insert.mjs:66] — deferred, CI Vercel tourne Linux, dev local macOS uniquement
- [x] [Review][Defer] Calcul de numéro de ligne off-by-one sur fichiers CRLF / BOM [scripts/check-no-direct-notifications-log-insert.mjs:72] — deferred, cosmétique (diagnostic uniquement), repo encode en LF

## DoD a11y

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

**Note story 7.A.11** : story sans impact UI (script CI + validation runtime cote serveur). La checklist DoD a11y ci-dessus n'est pas applicable, mais la regle CLAUDE.md durcie reste : `npm run a11y:axe:check` exit 0 obligatoire pre-commit livraison (verification baseline 0 Critical/Serious -- non-regression vs HEAD).
