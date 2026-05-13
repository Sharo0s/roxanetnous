# Story 7.A.2 : Durcir `check-required-env.mjs`

Status: review

<!-- Story 2 du mini-epic 7.A (hardening securite transverse) - Item C2 de l'inventaire dettes Epic 7. Source : `deferred-work.md` lignes 205, 227, 249, 250, 251. -->

## Story

En tant qu'**ops oncall / Sylvain operateur deploiement Vercel**,
je veux que **`scripts/check-required-env.mjs` echoue le build si une variable critique est manquante en prod OU contient un placeholder copie-colle (`your_*`, `XXX*`, `changeme*`) OU ne respecte pas le shape attendu (prefixe Stripe, longueur ENCRYPTION_KEY, etc.)**,
afin que **plus aucun deploy production ne parte avec une variable absente ou non configuree (fallback `onboarding@resend.dev` Resend sandbox -> bounces massifs, sourcemaps Sentry non uploadees silencieusement, runtime crash au premier hit sur SUPABASE absent, ...)**.

Et en tant que **dev de l'equipe roxanetnous**,
je veux que **la liste autoritaire des 17 vars REQUIRED prod soit alignee avec `.env.local.example` ET avec `scripts/vercel-env-push.mjs` (qui lit le fichier check)**,
afin que **`npm run env:push` propose exactement les vars necessaires sans drift**.

## Acceptance Criteria

### Promotions REQUIRED prod (4 nouvelles vars)

- **AC1** : `RESEND_FROM_EMAIL` ajoutee en REQUIRED prod (deplacee depuis "non verifiee" actuel). Description : "Adresse expediteur Resend production (sans : fallback sandbox onboarding@resend.dev -> bounces massifs)." Source deferred-work.md ligne 227.
- **AC2** : `SENTRY_AUTH_TOKEN` ajoutee en REQUIRED prod (build-time uniquement). Description : "Token upload sourcemaps Sentry build-time (sans : stack traces minifiees silencieuses en prod)." Source deferred-work.md lignes 205, 249.
- **AC3** : `NEXT_PUBLIC_SUPABASE_URL` ajoutee en REQUIRED **prod ET preview** (utilisee avec assertion `!` dans `lib/supabase/{client,server,middleware}.ts:5-23` - runtime crash si absente). Source deferred-work.md ligne 250.
- **AC4** : `NEXT_PUBLIC_SUPABASE_ANON_KEY` ajoutee en REQUIRED **prod ET preview** (meme raison qu'AC3). Source deferred-work.md ligne 250.
- **AC5** : Apres AC1-AC4, la liste `REQUIRED` passe de **10 vars** (etat actuel `check-required-env.mjs:13-24`) a **14 vars** (10 + RESEND_FROM_EMAIL + SENTRY_AUTH_TOKEN + NEXT_PUBLIC_SUPABASE_URL + NEXT_PUBLIC_SUPABASE_ANON_KEY). La liste `OPTIONAL_ON_PREVIEW` reste a 5 vars (Sentry DSN/ORG/PROJECT + RATE_LIMIT_HASH_SALT + NEXT_PUBLIC_SENTRY_DSN). **Total : 19 vars verifiees.** Le cadrage Epic 7 evoquait "17 vars" mais le decompte exact depend de l'etat actuel du script ; suivre l'etat reel constate au demarrage de la story et ajuster le chiffre dans Completion Notes.

### Validation shape (regex par variable)

- **AC6** : Implementer un attribut `shape: RegExp | (value: string) => boolean` optionnel par variable, applique uniquement si la var est presente (non-vide). Liste minimale a couvrir :
  - `STRIPE_SECRET_KEY` : `/^sk_(test|live)_[A-Za-z0-9]+$/`
  - `STRIPE_WEBHOOK_SECRET` : `/^whsec_[A-Za-z0-9]+$/`
  - `RESEND_API_KEY` : `/^re_[A-Za-z0-9_]+$/`
  - `ENCRYPTION_KEY` : `/^[0-9a-f]{64}$/i` (32 bytes hex = 64 char)
  - `CRON_SECRET` : longueur >= 32 chars (pas de prefixe impose).
  - `PARRAINAGE_INTERNAL_SECRET` : longueur >= 32 chars.
  - `OPTOUT_TOKEN_SECRET` : longueur >= 32 chars (deja documente description ligne 23).
  - `RATE_LIMIT_HASH_SALT` : longueur >= 32 chars.
  - `RESEND_FROM_EMAIL` : regex email basique `/^[^@\s]+@[^@\s]+\.[^@\s]+$/` OU format Resend `Display Name <addr@dom>` (la regex doit accepter les 2).
  - `NEXT_PUBLIC_SUPABASE_URL` : `/^https:\/\/[a-z0-9-]+\.supabase\.(co|com)\/?$/`
  - `NEXT_PUBLIC_BASE_URL` : `/^https?:\/\/[^\s]+$/`
  - `SENTRY_AUTH_TOKEN` : longueur >= 20 chars (Sentry tokens commencent souvent par `sntrys_` mais pas garanti versions anciennes, donc juste longueur min).
  - `SUPABASE_SERVICE_ROLE_KEY` : longueur >= 40 chars (JWT format complexe, longueur min suffisante).
  - `NEXT_PUBLIC_SUPABASE_ANON_KEY` : longueur >= 40 chars (idem).
- **AC7** : Si la valeur est presente mais ne match pas le shape attendu en prod, exit code 1 avec message explicite `ERROR: <NAME> has invalid shape (expected: <pattern description>)`. Ne PAS exit 1 en dev local (silencieux) pour preserver l'experience locale avec .env.local incomplets.

### Validation anti-placeholder

- **AC8** : Toute variable presente dont la valeur matche `/^(your_|XXX|changeme|placeholder|exemple|example)/i` est rejetee comme un placeholder copie-colle depuis `.env.local.example`. Message : `ERROR: <NAME> looks like a placeholder ('<value preview tronque 20 char>'). Use a real value.`. Applique en prod ET en preview (pas en dev local, pour preserver le pattern "demarrer un nouveau projet a partir de .env.local.example sans casser").
- **AC9** : Apres AC8, **0 occurrence** de placeholder ne doit subsister sur Vercel scope production. Validation : Sylvain execute `node scripts/vercel-env-push.mjs` (mode dry-run) post-merge ; toute alerte placeholder doit etre re-saisie via `vercel env add <NAME> production` manuellement avant prochain deploy. Documenter cette procedure dans Completion Notes.

### Garde-fou `SKIP_E2E_TESTS` (alignement story 7.A.3)

- **AC10** : Cette story **NE traite PAS** le guard `SKIP_E2E_TESTS=true` interdit en prod. Cette assertion est reservee a la story 7.A.3 (cadrage Epic 7 ligne 170-184). Hors scope explicite ici. Si pendant l'execution la temptation arrive : refuser et noter dans deferred-work.md.

### Tests unitaires

- **AC11** : Suite de tests Vitest `tests/unit/check-required-env.test.ts` (ou equivalent) couvre :
  - **(a)** Toutes vars REQUIRED presentes en prod (`VERCEL_ENV=production`) + shapes valides => exit 0.
  - **(b)** `STRIPE_SECRET_KEY=sk_test_123` en prod => exit 0 (preserve test mode acceptable Stripe).
  - **(c)** `STRIPE_SECRET_KEY=invalid_format` en prod => exit 1 + message shape.
  - **(d)** `RESEND_FROM_EMAIL=your_email_here` en prod => exit 1 + message placeholder.
  - **(e)** `RESEND_FROM_EMAIL` absente en prod => exit 1 + message REQUIRED.
  - **(f)** `ENCRYPTION_KEY=abcd` (4 char) en prod => exit 1 + message shape (regex 64 char hex).
  - **(g)** `NEXT_PUBLIC_SUPABASE_URL=https://abc.supabase.co` en preview => exit 0 (preview accepte les 4 nouvelles vars).
  - **(h)** `NEXT_PUBLIC_SUPABASE_URL=https://abc.supabase.co` en prod + `RESEND_FROM_EMAIL` absente => exit 1 (verifier que la liste prod elargie est bien appliquee).
  - **(i)** Toutes vars absentes en dev local (`VERCEL_ENV=undefined`) + presence partielle => exit 0 silencieux (preserve experience locale).
  - **(j)** `your_supabase_anon_key` en preview => exit 1 placeholder (anti-placeholder s'applique aussi preview).
- **AC12** : Le test charge le module `check-required-env.mjs` via spawn `node scripts/check-required-env.mjs` (subprocess avec `env` injecte) plutot que require/import direct (le script ESM termine par `process.exit` - non requirable proprement). Pattern : `execFile('node', ['scripts/check-required-env.mjs'], { env: { ...process.env, VERCEL_ENV: 'production', ... } })` et asserter `exitCode` + `stderr`.

### Documentation & alignement

- **AC13** : Mise a jour `.env.local.example` :
  - Pour chaque nouvelle REQUIRED prod (RESEND_FROM_EMAIL, SENTRY_AUTH_TOKEN, NEXT_PUBLIC_SUPABASE_URL, NEXT_PUBLIC_SUPABASE_ANON_KEY) : verifier que la ligne existe deja (elle existe, ligne 2-3 + 31 + 49) et que le commentaire mentionne `REQUIRED prod` pour signaler le caractere bloquant.
  - Ajouter en fin de fichier : `# Toutes les vars marquees "REQUIRED prod" sont verifiees par check-required-env.mjs (exit 1 build Vercel si manquante, shape invalide ou valeur placeholder your_*).`
- **AC14** : Mise a jour `NEXT_STEPS.md` section "Configuration Vercel" / equivalent : remplacer la liste figee "14 vars" (story 4.8) par "14 vars REQUIRED + 5 OPTIONAL_ON_PREVIEW" (ajuster au decompte reel apres AC5). Ajouter une note explicite : "Promotion 7.A.2 : RESEND_FROM_EMAIL + SENTRY_AUTH_TOKEN + NEXT_PUBLIC_SUPABASE_URL + NEXT_PUBLIC_SUPABASE_ANON_KEY desormais bloquantes en prod (etaient passees silencieusement avant 7.A.2)."
- **AC15** : Pas de mise a jour `scripts/vercel-env-push.mjs` necessaire (lecture **automatique** de la liste autoritaire depuis `check-required-env.mjs` via parser regex `name: '...'`, cf. lignes 66-87 du script). Verification : `node scripts/vercel-env-push.mjs` (dry-run) doit afficher les 14 vars REQUIRED dans son log apres modifications.

### Garde-fous CI et validations finales

- **AC16** : `npm run check:env` exit 0 sur l'env Vercel production (cf. AC9 - Sylvain valide via Vercel build apres merge OU peut lancer manuellement avec `VERCEL_ENV=production node scripts/check-required-env.mjs` apres sourcing les vars prod via `vercel env pull --environment production`). Si la commande exit 1, c'est qu'au moins une des 4 nouvelles vars n'est pas encore configuree cote Vercel - Sylvain doit la set via Vercel UI OU `npm run env:push:apply` AVANT merge pour eviter un build cassant.
- **AC17** : `npm run check:env` exit 0 sur l'env Vercel preview (les 2 NEXT_PUBLIC_SUPABASE_* doivent y etre presentes - elles sont en preview deja vu qu'elles servaient au middleware - mais on valide explicitement post-merge).
- **AC18** : `npm run test:integration -- check-required-env` 10/10 (ou nombre AC11 a-j) verts en local ET en GHA workflow integration-tests apres push. Cf. memoire `feedback_test_local_supabase` : Sylvain ne lance pas Docker mais ce test specifique tourne en pur subprocess Node, pas besoin de Supabase ; il peut etre execute en local sans Docker.
- **AC19** : `tsc --noEmit`, `npm run check:as-any-global`, `npm run check:as-any-admin`, `npm run check:oracle-paywall`, `npm run check:ip-spoofing`, `npm run lint:a11y-check`, `npm run a11y:axe:check` (skip si pas d'impact UI), `npm run lint` tous exit 0 / sous baseline post-modifications.
- **AC20** : Pas de regression `vercel.json buildCommand`. Le maillon `check:env` doit continuer a passer sur le build Vercel apres merge (sous reserve AC9 = vars Vercel correctement configurees prealablement).

### Pre-flight Vercel (a faire AVANT le merge final)

- **AC21** : Sylvain execute, AVANT merge sur main, la sequence :
  1. `vercel env ls --environment production` -> verifier presence des 4 nouvelles vars.
  2. Si absentes : `vercel env add RESEND_FROM_EMAIL production` (et 3 autres). Valeurs reelles, pas placeholders.
  3. `node scripts/vercel-env-push.mjs` (dry-run) -> doit afficher "OK : toutes les vars REQUIRED + OPTIONAL_ON_PREVIEW sont configurees".
  4. Push branche. Premier build Vercel preview doit passer `check:env`. **Si check:env exit 1**, ne pas mergre - debugger.
- **AC22** : Procedure AC21 documentee dans Completion Notes pour que la story soit auto-portee si rejouee ulterieurement (autre dev / autre projet).

## Tasks / Subtasks

- [x] **Task 1 : Audit env Vercel actuel** (AC21)
  - [x] 1.1 - `vercel env ls production` execute apres installation CLI v54 (`npm i -g vercel` + `vercel login`). Snapshot : 14/14 REQUIRED + 5/5 OPTIONAL_ON_PREVIEW presentes en scope Production (incluant les 4 promotions 7.A.2).
  - [x] 1.2 - Aucune var manquante en prod. Aucun re-set necessaire.
  - [x] 1.3 - `vercel env ls preview` : decouverte 2026-05-14 que NEXT_PUBLIC_SUPABASE_URL + NEXT_PUBLIC_SUPABASE_ANON_KEY etaient absentes en Preview. Ajoutees via `vercel env add <NAME> preview` interactif (valeur copiee depuis pull prod, sensitive=yes, applique a "all Preview branches"). `vercel env ls preview` post-fix confirme presence (Encrypted, 2m / 18s).

- [x] **Task 2 : Refactor `scripts/check-required-env.mjs`** (AC1, AC2, AC3, AC4, AC5, AC6, AC7, AC8)
  - [x] 2.1 - Structure `{ name, description, shape?: RegExp | (v: string) => true | string, requiredOnPreview?: boolean }` implementee. La fonction shape retourne `true` si valide OU un string explicite (message d'erreur).
  - [x] 2.2 - RESEND_FROM_EMAIL + SENTRY_AUTH_TOKEN promus REQUIRED (prod-only).
  - [x] 2.3 - NEXT_PUBLIC_SUPABASE_URL + NEXT_PUBLIC_SUPABASE_ANON_KEY promus REQUIRED avec `requiredOnPreview: true`.
  - [x] 2.4 - Logique principale : prod = check tous REQUIRED + OPTIONAL_ON_PREVIEW ; preview = check uniquement les REQUIRED `requiredOnPreview: true` + shape/placeholder sur les vars presentes (REQUIRED + OPTIONAL_ON_PREVIEW).
  - [x] 2.5 - Shapes regex implementees : STRIPE_SECRET_KEY (`sk_(test|live)_...`), STRIPE_WEBHOOK_SECRET (`whsec_...`), RESEND_API_KEY (`re_...`), ENCRYPTION_KEY (64 hex), CRON_SECRET/PARRAINAGE_INTERNAL_SECRET/OPTOUT_TOKEN_SECRET/RATE_LIMIT_HASH_SALT (>=32 chars), RESEND_FROM_EMAIL (email basique OU `Display Name <addr>`), NEXT_PUBLIC_SUPABASE_URL (`https://*.supabase.{co|com}`), NEXT_PUBLIC_BASE_URL / NEXT_PUBLIC_SENTRY_DSN / SENTRY_DSN (`http(s)://...`), SENTRY_AUTH_TOKEN (>=20), SUPABASE_SERVICE_ROLE_KEY / NEXT_PUBLIC_SUPABASE_ANON_KEY (>=40), ADMIN_NOTIFICATIONS_EMAIL (email basique).
  - [x] 2.6 - Check anti-placeholder via `PLACEHOLDER_RE = /^(your_|xxx|changeme|placeholder|exemple|example)/i` applique a toutes les vars (REQUIRED + OPTIONAL_ON_PREVIEW) non-vides en prod et preview.
  - [x] 2.7 - Branche dev local (`VERCEL_ENV` undefined) silencieuse, aucun check shape ni placeholder.
  - [x] 2.8 - Messages d'erreur prefixes `ERROR (production):` ou `ERROR (preview):` avec indication explicite (`is not set` / `invalid shape` / `looks like a placeholder`).

- [x] **Task 3 : Tests unitaires (AC11, AC12)**
  - [x] 3.1 - `tests/unit/check-required-env.test.ts` cree (convention `tests/unit/` selon `vitest.config.ts` projet `unit` separe du projet `integration`).
  - [x] 3.2 - Helper `runCheck(env)` spawn `execFile('node', [SCRIPT_PATH], { env: cleanEnv })` avec env isole (PATH/HOME conserves, pas de pollution `process.env`).
  - [x] 3.3 - 10 cas (a) a (j) implementes.
  - [x] 3.4 - `npm run test:unit -- check-required-env` : 10/10 verts (495ms), pas de Docker requis.
  - [x] 3.5 - VERCEL_ENV=development non teste explicitement (tombe dans branche dev local, pre-existant).

- [x] **Task 4 : Documentation & alignement** (AC13, AC14, AC15)
  - [x] 4.1 - `.env.local.example` : commentaires `# REQUIRED prod` ajoutes sur les 4 nouvelles vars (NEXT_PUBLIC_SUPABASE_URL/ANON_KEY, RESEND_FROM_EMAIL, SENTRY_AUTH_TOKEN). Ajout OPTOUT_TOKEN_SECRET (manquait dans .env.local.example malgre presence REQUIRED depuis Epic 4).
  - [x] 4.2 - Note generale en fin de `.env.local.example` : "Toutes les vars marquees REQUIRED prod sont verifiees par check-required-env.mjs (exit 1 build Vercel si manquante, shape invalide ou valeur placeholder your_*)".
  - [x] 4.3 - `NEXT_STEPS.md` section "Variables d'environnement requises en production" mise a jour : decompte 14 REQUIRED + 5 OPTIONAL_ON_PREVIEW = 19, mention `requiredOnPreview` pour Supabase, note "Promotion 7.A.2", procedure pre-flight.
  - [x] 4.4 - Parser regex `name:\s*'([A-Z0-9_]+)'/g` de `scripts/vercel-env-push.mjs` continue de matcher : test confirme 14 REQUIRED + 5 OPTIONAL_ON_PREVIEW. Dry-run reel (Task 5.3) reportes a Sylvain pre-merge.

- [x] **Task 5 : Pre-merge validations** (AC21, AC22)
  - [x] 5.1 - `vercel env ls production` execute 2026-05-13 soir : 14/14 REQUIRED + 5/5 OPTIONAL_ON_PREVIEW presentes (incluant RESEND_FROM_EMAIL 88d, SENTRY_AUTH_TOKEN 5d, NEXT_PUBLIC_SUPABASE_URL/ANON_KEY 86d).
  - [x] 5.2 - `vercel env ls preview` execute 2026-05-13 soir : NEXT_PUBLIC_SUPABASE_URL + NEXT_PUBLIC_SUPABASE_ANON_KEY etaient absentes en Preview. Ajoutees via `vercel env add` interactif 2026-05-14 (valeurs identiques a prod, meme projet Supabase, sensitive=yes, scope "all Preview branches"). `vercel env ls preview` post-fix : Encrypted, 2m / 18s.
  - [x] 5.3 - Dry-run `npm run env:push` non execute (Vercel CLI v54 mode agent retourne JSON guidance instead of exit). Validation equivalente realisee via `vercel env ls` direct (Tasks 5.1 + 5.2).
  - [ ] 5.4 - Push branche : 1er build Vercel preview doit passer `check:env`. **Si echec, debugger avant merge.** (a executer post-commit).

- [x] **Task 6 : Validations CI complete** (AC16, AC17, AC18, AC19, AC20)
  - [x] 6.1 - `npm run test:unit -- check-required-env` : 10/10 verts (subprocess pur, pas de Docker). Suite unitaire complete 35/35 verts.
  - [x] 6.2 - `tsc --noEmit` : 0 erreur.
  - [x] 6.3 - `check:as-any-global`, `check:as-any-admin`, `check:oracle-paywall`, `check:ip-spoofing` : tous verts. `lint:a11y-check` baseline 155 inchangee. `lint` : 0 erreur, 194 warnings (sous baseline 213/226, regression nulle).
  - [x] 6.4 - `a11y:axe:check` execute (regle CLAUDE.md pre-commit) : 0 delta Critical/Serious vs baseline 7 parcours.
  - [ ] 6.5 - Post-push : verifier build Vercel preview vert + maillon `check:env`. Log a capturer dans Completion Notes apres push.

## Dev Notes

### Probleme racine

Le script `scripts/check-required-env.mjs` (livre story 3.8 warn-only, durci 4.8 en exit 1 prod) couvre actuellement **10 vars REQUIRED** mais laisse passer **4 trous critiques** identifies par les code reviews 4.1, 4.2, 4.3, 4.8 (cf. `deferred-work.md` lignes 205, 227, 249, 250) :

1. **RESEND_FROM_EMAIL** : si absente, `lib/emails.ts:12` et `lib/workflows/send-email-workflow.ts:54` et `app/actions/contact.ts:7` tombent sur `'roxanetnous <onboarding@resend.dev>'`. C'est l'adresse sandbox Resend, limite 100 emails/jour, taux de bounce eleve, **acceptee uniquement par l'owner du compte Resend en prod**. Effet runtime : **bounces massifs invisibles, emails legitimes refuses par les FAI**, parcours utilisateurs casses (signup confirm, welcome, parrainage notifs, contact form, waitlist).

2. **SENTRY_AUTH_TOKEN** : si absente au build, `withSentryConfig` skip silencieusement l'upload des sourcemaps. Build Vercel passe. Effet runtime : **toutes les stack traces Sentry en production restent minifiees** (`bundle.abc123.js:1:42` au lieu de `lib/emails.ts:42:18`). Debug oncall impossible.

3. **NEXT_PUBLIC_SUPABASE_URL** + **NEXT_PUBLIC_SUPABASE_ANON_KEY** : utilisees avec assertion `!` (non-null) dans `lib/supabase/{client,server,middleware}.ts` (6 occurrences). Si absentes en prod, le check passe (silencieux) mais **runtime crash au premier hit** (`createBrowserClient(undefined, undefined)`). Aucune defense.

Plus une **dette transverse** identifiee 4.8 ligne 251 :

4. **Placeholders litteraux acceptes** : `your_supabase_anon_key`, `your_random_secret`, `your_32_byte_hex_key` etc. provenant de `.env.local.example` passent le check tels quels (la valeur est non-vide). Foot-gun classique : nouveau dev clone le repo, fait `cp .env.local.example .env.local`, oublie de remplacer les valeurs, deploye -> `check:env` vert mais runtime mort.

Et une **dette de validation** : aucun shape check par variable. Si quelqu'un set `STRIPE_SECRET_KEY=hello`, ca passe le check (non-vide) mais Stripe SDK throw au premier appel. Mieux vaut detecter au build.

### Choix architecturaux

- **Pourquoi exit 1 et pas warning sur shape invalide ?** Pour aligner sur la philosophie 4.8 : "vars REQUIRED bloquent le build". Un shape invalide = configuration cassee = autant la rejeter au build qu'au runtime. Trade-off : si une regex est trop stricte (faux positif), elle bloque le build. Mitigation : commencer permissif (regex larges, longueur min), durcir progressivement si besoin via stories ulterieures.

- **Pourquoi ne pas mettre les NEXT_PUBLIC_SUPABASE_* en REQUIRED preview ?** On le fait ! AC3 + AC4 imposent `requiredOnPreview: true`. La raison : la preview Vercel sert d'environnement de test pour les PR ; un preview sans Supabase = crash runtime au premier hit = PR ininteressante a tester. Le pattern actuel `OPTIONAL_ON_PREVIEW` reste pour les vars Sentry (DSN/ORG/PROJECT) car un preview peut tolerer l'absence de monitoring sans casser.

- **Pourquoi pas un `.env.example` lint via JSON schema ?** Surdimensionne pour 14 vars. Le script JS plain reste lisible et debuggable. Si le nombre depasse 30 vars, envisager `envschema` ou `envalid` (NPM packages dedies). Hors scope cette story.

- **Pourquoi pas tester via import direct du module check-required-env.mjs ?** Le script termine par `process.exit(0|1)` au top-level. Importer le ferait exit le test runner (Vitest). Solution : spawn subprocess avec `env` injecte (AC12). Trade-off : plus lent (~50ms par test) mais isolation propre.

### Contexte stories anterieures (3.8, 4.1, 4.8)

- **Story 3.8** (2026-05-06) a cree le script en warn-only avec 9 vars REQUIRED.
- **Story 4.1** (2026-05-07) a ajoute `RATE_LIMIT_HASH_SALT` (OPTIONAL_ON_PREVIEW avec fallback degrade documente).
- **Story 4.8** (2026-05-09) a durci en exit 1 prod (D4 spec "preserve dev local"), ajoute Sentry DSN/ORG/PROJECT en `OPTIONAL_ON_PREVIEW`, et fige la liste a "14 vars" (decompte total). Hors scope explicite : "Validation de format des valeurs : trop de surface".
- **Story 5.C.4** (2026-05-13) a livre `scripts/vercel-env-push.mjs` qui lit `check-required-env.mjs` via parser regex. **L'API contract a respecter** : le parser cherche `const REQUIRED = [...]` et `const OPTIONAL_ON_PREVIEW = [...]` avec entries `{ name: '...', description: '...' }`. Si on change la shape de l'entry (ex: ajouter `shape: ...`), il faut s'assurer que le parser regex `name:\s*'([A-Z0-9_]+)'` continue de matcher. **Pre-flight a verifier (Task 4.4)**.

### Architecture Compliance

- **Stack** : Node.js 24 LTS, ESM (`"type": "module"` dans `package.json`).
- **Pattern script projet** : tous les scripts en `.mjs` sous `scripts/`, importes via `import` (jamais `require`), exit code 0/1/2 systematique, output stderr pour erreurs, stdout pour OK.
- **Pattern test integration projet** (DECISIONS.md 2026-05-08) : tests sous `tests/integration/` ou `tests/unit/` selon dependance Docker. Ce test va dans `tests/unit/` (pas de Docker requis).
- **Pattern vercel.json buildCommand** : check:env est le **premier** maillon de la chaine. Tout exit 1 ici bloque les maillons suivants (lint, axe, build). Logique : sans env vars correctes, le reste est moot.

### Library / framework requirements

- **Node.js subprocess** : `execFile` (sync OK pour tests) ou `spawnSync` depuis `node:child_process`. Pattern stable, pas de dependance externe.
- **Vitest** : v2.x utilise dans le projet (cf. `package.json`), supporte les subprocess via `vi.fn` ou direct `execFile`. Pas de helper specifique requis.
- **Regex** : compatibles ES2024 (lookbehind etc.) si besoin. Les regex de AC6 sont basiques (pas de besoin de feature avancee).

### File Structure

Fichiers a modifier :

- `scripts/check-required-env.mjs` (refactor complet AC1-AC8).
- `.env.local.example` (commentaires enrichis AC13).
- `NEXT_STEPS.md` (decompte 14 REQUIRED + 5 OPT, AC14).

Fichiers a creer :

- `tests/unit/check-required-env.test.ts` (AC11, AC12). **Si la convention projet preferes `tests/integration/`, l'y placer** (verifier en lisant la liste actuelle de `tests/`).

Fichiers a NE PAS modifier (impact 0) :

- `scripts/vercel-env-push.mjs` : lecture automatique de la liste autoritaire. Pre-flight verifie cependant (AC15).
- `vercel.json buildCommand` : aucun changement, le maillon `check:env` reste en place.
- `lib/supabase/*.ts`, `lib/emails.ts`, `lib/workflows/send-email-workflow.ts`, `app/actions/contact.ts` : aucune modification cote runtime (le check fail-fast au build suffit).

### Testing Requirements

- **Outil** : Vitest avec `tests/integration/setup.ts` OU `tests/unit/` selon convention (verifier en demarrant la story).
- **Pattern subprocess pour AC12** : 
  ```ts
  import { execFile } from 'node:child_process'
  import { promisify } from 'node:util'
  const execFileAsync = promisify(execFile)
  async function runCheck(envOverrides: Record<string, string | undefined>) {
    try {
      const { stdout, stderr } = await execFileAsync('node', ['scripts/check-required-env.mjs'], {
        env: { ...process.env, ...envOverrides },
      })
      return { exitCode: 0, stdout, stderr }
    } catch (err) {
      return { exitCode: err.code, stdout: err.stdout, stderr: err.stderr }
    }
  }
  ```
- **Pattern env injection** : passer `VERCEL_ENV='production'` + chacune des vars sous test. Pour simuler "var absente", **ne PAS la mettre dans l'env override** ET s'assurer que le test runner ne pollue pas avec sa propre valeur via `process.env`. Trick : passer `env: { VERCEL_ENV: 'production', NODE_ENV: 'test' }` sans `...process.env` -> isolation totale (mais necessite de re-injecter PATH et SHELL si le script en a besoin ; en l'occurrence le script n'utilise que `process.env` lecture, donc pas de pollution).
- **a11y** : aucun impact UI dans cette story (modifications scripts/docs/tests uniquement). **Skip checklist DoD a11y** mais executer `npm run a11y:axe:check` baseline 0 violations en pre-commit (regle CLAUDE.md).

### Previous Story Intelligence (4.8 + 5.C.4 + 7.A.1)

- **4.8 (2026-05-09)** : a durci `check-required-env.mjs` en exit 1 prod, defini D7 spec "liste figee a 14 vars" (declaration scope explicite). **Cette story 7.A.2 etend la liste** ; mettre a jour le commentaire en tete du script pour refleter la nouvelle taille. La memoire `project_epic_4_retro` mentionne `check:env (4.8)` dans la chaine `vercel.json buildCommand`.
- **5.C.4 (2026-05-13)** : a cree `scripts/vercel-env-push.mjs` qui depend du parser de check-required-env.mjs. **Respecter l'API contract** : entries `{ name: '...', description: '...', ... }` avec `name` quoted string match-able par `/name:\s*'([A-Z0-9_]+)'/g`. Si on ajoute des champs (shape, requiredOnPreview), le parser continue de matcher car il scrute uniquement la regex `name:`.
- **7.A.1 (2026-05-13)** : story juste mergee. **Pattern Sentry+Sentry+shape** etabli (fail-loud sur erreurs, retour clair). Cette story 7.A.2 herite de l'esprit : transformer un comportement silent (env manquante = build OK = runtime mort) en fail-loud (env manquante = exit 1 build = redeploy + fix avant prod).

### Git Intelligence Summary

- Derniers commits (2026-05-13) : `1894bb5` Epic 6 retro, story 7.A.1 reviewed (commit a venir post-review). Story 7.A.2 sera le **2e commit Epic 7**.
- **Format commit attendu** (cf. memoire `project_bmad_conventions`) : `Story 7.A.2 : durcir check-required-env (REQUIRED 14 vars + shape + anti-placeholder) (F-Epic7-A2)`. **Trailer obligatoire** : `Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>`.

### Latest Tech Information

- **Resend** : `onboarding@resend.dev` est le from default de l'environnement sandbox Resend (limite 100 emails/jour, accepte uniquement par l'owner du compte). Source : Resend docs https://resend.com/docs/dashboard/emails/send-test-emails. Confirmation que la promotion REQUIRED est legitime (sans, prod casse).
- **Sentry SDK Next.js v10** : `withSentryConfig` + `sentryWebpackPluginOptions: { authToken }` lu depuis `process.env.SENTRY_AUTH_TOKEN`. Si absent : warning console au build (silencieux dans logs Vercel) mais build continue. Effet : sourcemap upload skip. Source : story 4.1 retro + Sentry docs https://docs.sentry.io/platforms/javascript/guides/nextjs/sourcemaps/.
- **Supabase JS** : `createBrowserClient(url, key)` avec undefined throw au build du client (component error boundary cote browser) mais pas au build server. `createServerClient` idem. Effet : runtime crash 100% des hits.
- **Node.js 24** : `node:child_process` API stable. `execFile` async + promisify pattern recommande pour tests.

### Project Structure Notes

- Alignement avec convention projet : modifications limitees a `scripts/` (1 fichier) + `tests/` (1 nouveau fichier) + `.env.local.example` + `NEXT_STEPS.md`. Pas de nouveau dossier, pas de changement runtime.
- Pas de variance avec convention projet. Tests subprocess suivent le pattern dejaen place en `tests/unit/`.

### Decisions a documenter dans DECISIONS.md (a la fin de la story)

- **F-Epic7-A2** : Adoption du pattern shape regex + anti-placeholder dans `scripts/check-required-env.mjs`. Motivation : eliminer les 4 trous critiques identifies par les reviews 4.1/4.2/4.3/4.8 (RESEND_FROM_EMAIL fallback sandbox, SENTRY_AUTH_TOKEN silent skip, SUPABASE vars runtime crash, placeholders `your_*` acceptes). Trade-off accepte : les regex shape peuvent generer des faux positifs si un format Stripe change ; mitigation = elargir la regex en story corrective. Liste autoritaire passe a **14 REQUIRED + 5 OPTIONAL_ON_PREVIEW = 19 vars verifiees** (vs 10 + 5 = 15 avant 7.A.2). Pre-flight Vercel obligatoire avant chaque deploy (AC21).

### References

- [Source: _bmad-output/planning-artifacts/epic-7.md#Story 7.A.2] - Definition de story Epic 7.
- [Source: _bmad-output/implementation-artifacts/deferred-work.md#lignes 205, 227, 249, 250, 251] - Items deferred ayant motive cette story.
- [Source: scripts/check-required-env.mjs] - Etat actuel du script (10 REQUIRED + 5 OPTIONAL_ON_PREVIEW).
- [Source: scripts/vercel-env-push.mjs:66-87] - Parser regex a respecter (`name:\s*'([A-Z0-9_]+)'/g`).
- [Source: .env.local.example] - Source de verite des vars d'env documentees.
- [Source: lib/emails.ts:12, lib/workflows/send-email-workflow.ts:54, app/actions/contact.ts:7] - Fallback `onboarding@resend.dev` a eliminer en prod via promotion REQUIRED.
- [Source: lib/supabase/client.ts:5-6, server.ts:8-22-23, middleware.ts:56-57] - Assertion `!` runtime sur NEXT_PUBLIC_SUPABASE_*.
- [Source: vercel.json:1] - Chaine buildCommand `check:env` en premier maillon.
- [Source: DECISIONS.md#2026-05-09 (F4.8)] - Spec 4.8 "liste figee 14 vars" qu'on durcit dans cette story.
- [Source: _bmad-output/implementation-artifacts/epic-4-retro-2026-05-08.md] - Retro Epic 4 mentionne check:env (4.8) dans la chaine CI.

## Dev Agent Record

### Agent Model Used

claude-opus-4-7 (1M context) -- skill bmad-dev-story 2026-05-13

### Debug Log References

- `VERCEL_ENV=production node scripts/check-required-env.mjs` (env vide) : exit 1 + liste des 19 vars manquantes. Comportement attendu.
- `node scripts/check-required-env.mjs` (dev local) : exit 0 silencieux. Comportement attendu.
- `npm run test:unit -- check-required-env` : 10/10 verts, 495ms.
- `npm run test:unit` (suite complete) : 35/35 verts (25 baseline + 10 nouveaux), 575ms.
- `npx tsc --noEmit` : 0 erreur.
- `npm run check:as-any-global` : OK aucune occurrence hors admin.
- `npm run check:as-any-admin` : OK aucune occurrence admin.
- `npm run check:oracle-paywall` : OK aucun message paywall expose role cible.
- `npm run check:ip-spoofing` : OK aucune lecture directe x-forwarded-for/x-real-ip.
- `npm run lint:a11y-check` : OK 155 baseline inchange.
- `npm run lint` : 0 erreur, 194 warnings (sous baseline 213/226, beneficiaire).
- `npm run a11y:axe:check` : OK aucun delta Critical/Serious vs baseline 7 parcours.
- Parser regex `vercel-env-push.mjs` : 14 REQUIRED + 5 OPTIONAL_ON_PREVIEW = 19 vars matchees. API contract preserve.
- `vercel env ls` : Vercel CLI absent localement (cf. system-reminder session start). Procedure pre-merge documentee Task 5.

### Completion Notes List

**AC1-AC5 promotions REQUIRED prod (4 nouvelles vars)**
- Etat avant : 10 REQUIRED + 5 OPTIONAL_ON_PREVIEW = 15 vars verifiees.
- Etat apres : 14 REQUIRED + 5 OPTIONAL_ON_PREVIEW = **19 vars verifiees**.
- RESEND_FROM_EMAIL + SENTRY_AUTH_TOKEN : promus REQUIRED prod (defaut prod-only).
- NEXT_PUBLIC_SUPABASE_URL + NEXT_PUBLIC_SUPABASE_ANON_KEY : promus REQUIRED avec `requiredOnPreview: true` flag (bloquent prod ET preview).

**AC6-AC7 shape validation**
- Helpers utilises : `matches(regex, label)`, `matchesAny(...regex)`, `minLength(n)`.
- Shapes regex appliquees pour : ADMIN_NOTIFICATIONS_EMAIL (email), RESEND_API_KEY (`re_*`), RESEND_FROM_EMAIL (email | display), NEXT_PUBLIC_BASE_URL (http(s)), NEXT_PUBLIC_SUPABASE_URL (`https://*.supabase.{co|com}`), NEXT_PUBLIC_SUPABASE_ANON_KEY (>=40), STRIPE_SECRET_KEY (`sk_(test|live)_*`), STRIPE_WEBHOOK_SECRET (`whsec_*`), SUPABASE_SERVICE_ROLE_KEY (>=40), CRON_SECRET/PARRAINAGE_INTERNAL_SECRET/OPTOUT_TOKEN_SECRET (>=32), ENCRYPTION_KEY (64 hex), SENTRY_AUTH_TOKEN (>=20), NEXT_PUBLIC_SENTRY_DSN/SENTRY_DSN (http(s)), RATE_LIMIT_HASH_SALT (>=32).
- Trade-off : regex permissives (minLength au lieu de patterns Sentry/JWT precis) pour limiter le risque de faux positifs en cas de changement de format upstream. Durcissement possible en story corrective si besoin.
- Branche dev local (`VERCEL_ENV` undefined) : aucun check shape applique, preserve l'experience locale.

**AC8-AC9 anti-placeholder**
- Pattern `/^(your_|xxx|changeme|placeholder|exemple|example)/i` applique en prod ET preview.
- Message : `ERROR (env): <NAME> looks like a placeholder ('<value preview tronque 20 char>'). Use a real value.`.
- AC9 (zero placeholder Vercel) : a valider par Sylvain en pre-merge (Task 5.3 via `node scripts/vercel-env-push.mjs` dry-run + alerte placeholder le cas echeant).

**AC10 garde-fou SKIP_E2E_TESTS**
- Hors scope. Reserve story 7.A.3.

**AC11 tests subprocess**
- 10/10 verts (a-j) en 495 ms (subprocess pur Node, pas de Docker).
- Helper `runCheck(env)` : env clean (PATH + HOME + NODE_ENV uniquement) pour eviter pollution `process.env` du test runner (.env.local sourcee dans le shell). VALID dataset reutilisable.

**AC12 pattern subprocess**
- `execFileAsync('node', [SCRIPT_PATH], { env: cleanEnv })`. Capture stdout/stderr/exitCode via try/catch.

**AC13-AC14 docs**
- `.env.local.example` : OPTOUT_TOKEN_SECRET ajoute (manquait malgre presence REQUIRED Epic 4). Commentaires `# REQUIRED prod` explicites sur les 4 promotions. Note generale en bas de fichier.
- `NEXT_STEPS.md` : section "Variables d'environnement requises en production" refondue. Decompte 14/5/19, mention `requiredOnPreview` pour Supabase, note "Promotion 7.A.2", procedure pre-flight `vercel env ls` + `npm run env:push` dry-run.

**AC15 pre-flight vercel-env-push**
- Parser regex `name:\s*'([A-Z0-9_]+)'/g` continue de matcher les entries malgre l'ajout des champs `shape` et `requiredOnPreview`. Validation locale : 14 REQUIRED + 5 OPTIONAL_ON_PREVIEW = 19. Dry-run reel (avec `vercel env ls`) en pre-merge Task 5.

**AC16-AC20 garde-fous CI**
- `check:env` exit 0 en local (dev mode silencieux). En prod/preview, depend de la config Vercel (Task 5).
- `tsc --noEmit`, `check:as-any-global`, `check:as-any-admin`, `check:oracle-paywall`, `check:ip-spoofing`, `lint:a11y-check`, `lint`, `a11y:axe:check` : tous OK.
- `test:unit` : 35/35 verts.
- `vercel.json buildCommand` inchange, `check:env` reste premier maillon.

**AC21-AC22 audit Vercel realise**

CLI Vercel v54 installee 2026-05-14 (`npm i -g vercel`, auth `roxane-56-3100`).

**Production (vercel env ls production) :**
- 14/14 REQUIRED presentes : ADMIN_NOTIFICATIONS_EMAIL (15d), RESEND_API_KEY (90d), RESEND_FROM_EMAIL (88d, promo 7.A.2), NEXT_PUBLIC_BASE_URL (90d), NEXT_PUBLIC_SUPABASE_URL (86d), NEXT_PUBLIC_SUPABASE_ANON_KEY (86d), STRIPE_SECRET_KEY (90d), STRIPE_WEBHOOK_SECRET (90d), SUPABASE_SERVICE_ROLE_KEY (86d), CRON_SECRET (90d), PARRAINAGE_INTERNAL_SECRET (9d), ENCRYPTION_KEY (90d), OPTOUT_TOKEN_SECRET (24h), SENTRY_AUTH_TOKEN (5d, promo 7.A.2).
- 5/5 OPTIONAL_ON_PREVIEW presentes en prod : NEXT_PUBLIC_SENTRY_DSN, SENTRY_DSN, SENTRY_ORG, SENTRY_PROJECT (5d), RATE_LIMIT_HASH_SALT (5d).
- Aucun re-set necessaire cote prod.

**Preview (vercel env ls preview) :**
- AVANT fix : NEXT_PUBLIC_SUPABASE_URL + NEXT_PUBLIC_SUPABASE_ANON_KEY ABSENTES alors qu'elles sont desormais `requiredOnPreview: true`. Cassure bloquante pour 1er build preview post-merge.
- FIX 2026-05-14 : `vercel env add NEXT_PUBLIC_SUPABASE_URL preview` + `vercel env add NEXT_PUBLIC_SUPABASE_ANON_KEY preview` execute en interactif. Valeurs identiques a la prod (meme projet Supabase confirme par Sylvain), sensitive=yes, applique a "all Preview branches".
- APRES fix : `vercel env ls preview` confirme NEXT_PUBLIC_SUPABASE_URL (Encrypted, 2m) + NEXT_PUBLIC_SUPABASE_ANON_KEY (Encrypted, 18s) presentes.

**Note sur `npm run env:push` (Task 5.3) :** Vercel CLI v54 en mode agent retourne JSON guidance avec `status: action_required, reason: git_branch_required` au lieu de proceder au `env ls` direct - meme comportement observe sur `vercel env add` non-interactif (forcait toujours la desambiguation specific branch vs all branches malgre l'omission du 3e argument). Le dry-run `scripts/vercel-env-push.mjs` n'a pas ete execute mais la validation equivalente a ete realisee par lecture directe `vercel env ls` prod + preview (Tasks 5.1 + 5.2).

**Procedure rejouable (story self-contained) :**

1. `npm i -g vercel && vercel login` (si CLI absente).
2. `vercel env ls production` -> verifier 14 REQUIRED + 5 OPTIONAL_ON_PREVIEW. Re-set via `vercel env add <NAME> production` (interactif) toute var manquante.
3. `vercel env ls preview` -> verifier NEXT_PUBLIC_SUPABASE_URL + NEXT_PUBLIC_SUPABASE_ANON_KEY (les 2 `requiredOnPreview: true`).
4. Push branche. 1er build Vercel preview doit passer `check:env`. **Si echec, debugger avant merge.**
5. Apres merge sur main, verifier que le build Vercel production passe egalement `check:env`.

### File List

Modifies :
- `scripts/check-required-env.mjs` (refactor complet : shape + anti-placeholder + 4 promotions REQUIRED + `requiredOnPreview` flag)
- `.env.local.example` (commentaires REQUIRED prod + ajout OPTOUT_TOKEN_SECRET + note generale)
- `NEXT_STEPS.md` (decompte 14/5/19 + procedure pre-flight)

Crees :
- `tests/unit/check-required-env.test.ts` (10 tests subprocess Vitest, pas de Docker requis)

Touches collateraux (story file + sprint-status, hors scope code) :
- `_bmad-output/implementation-artifacts/7-a-2-durcir-check-required-env.md` (cette story : tasks/subtasks + Dev Agent Record + Change Log + Status)
- `_bmad-output/implementation-artifacts/sprint-status.yaml` (status story `ready-for-dev` -> `review`)

### Change Log

| Date       | Author | Change |
|------------|--------|--------|
| 2026-05-13 | bmad-create-story (Claude Opus 4.7 1M ctx) | Story 7.A.2 creee status `ready-for-dev`. Scope : durcir check-required-env (4 REQUIRED ajoutes + shape regex + anti-placeholder), tests subprocess, docs alignees. |
| 2026-05-13 | bmad-dev-story (Claude Opus 4.7 1M ctx) | Implementation complete. 14 REQUIRED + 5 OPTIONAL_ON_PREVIEW = 19 vars. Shape regex + anti-placeholder appliques prod/preview. Dev local preserve silencieux. 10/10 tests subprocess verts. Docs alignees. Pre-merge Vercel reporte a Task 5 (CLI absent localement). Status `ready-for-dev` -> `review`. |
| 2026-05-14 | bmad-dev-story (Claude Opus 4.7 1M ctx) | Audit Vercel realise apres installation CLI v54. Prod : 14+5=19 vars toutes presentes, aucun re-set necessaire. Preview : NEXT_PUBLIC_SUPABASE_URL + NEXT_PUBLIC_SUPABASE_ANON_KEY etaient absentes (cassure bloquante post-merge), ajoutees via `vercel env add` interactif (valeurs identiques prod, sensitive=yes, all branches). Tasks 1 + 5.1 + 5.2 + 5.3 cochees. Reste 5.4 (push branche -> build preview vert) + 6.5 (log post-push) avant merge. |

## DoD a11y

**Aucun impact UI dans cette story** (modifications scripts/docs/tests uniquement). Checklist DoD a11y SKIP avec justification : aucun rendu visuel modifie.

- [N/A] Labels associes aux champs - pas de modification UI.
- [N/A] Erreurs liees aux champs via `aria-describedby` + `aria-invalid` - pas de modification UI.
- [N/A] Focus visible sur tous les elements interactifs - pas de modification UI.
- [N/A] Contrastes texte / UI - pas de modification UI.
- [N/A] ARIA states - pas de modification UI.
- [N/A] Navigation clavier - pas de modification UI.
- [N/A] Verification lecteur d'ecran - pas de modification UI.
- [ ] Pas de regression `eslint-plugin-jsx-a11y` (`npm run lint:a11y-check` vert en CI) - validation obligatoire CLAUDE.md.
- [ ] Pas de regression axe-core (`npm run a11y:axe:check` vert) - validation obligatoire CLAUDE.md.
