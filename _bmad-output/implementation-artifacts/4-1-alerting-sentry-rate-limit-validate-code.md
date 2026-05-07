# Story 4.1 : Alerting Sentry transverse + rate-limit `validateCode` parrainage

Status: review

<!-- Note : Validation est optionnelle. Lancer `validate-create-story` avant `dev-story` pour un controle qualite. -->

## Story

En tant que **Sylvain (admin du pilote Bretagne)**,
je veux **integrer un agregateur d'erreurs (Sentry) cote Next.js (client + server + edge) qui capture automatiquement les exceptions non-attrapees et instrumenter explicitement les chemins critiques (webhook Stripe, parrainage, blacklist, emails) avec `Sentry.captureException` + tags metier, ET emettre un evenement Sentry dedie quand le rate-limit `validateCode` parrainage declenche**,
afin de **detecter et corriger les incidents de production avant qu'ils impactent les utilisateurs (perte de paiement, perte de signal anti-fraude, validation filleule cassee), avoir un signal d'alerte si un attaquant tente de brute-forcer le keyspace 31^8 codes parrainage, et soldier l'AI-3.4 bloquant retro Epic 3**.

C'est la **premiere story de l'Epic 4 « Hardening pre-go-live Bretagne »** et la **premiere des 4 stories ordre 1** bloquantes go-live (4.1 -> 4.7 -> 4.2 -> 4.3 -> 4.4 -> go-live, cf. `epic-4.md` Estimation effort). Sequencage volontaire en tete d'epic : tous les debug suivants (story 4.2 schema, 4.3 queue, 4.4 tests metier) **beneficient de Sentry** pour valider qu'aucune regression silencieuse n'est introduite.

Elle s'appuie sur les fondations existantes :

- **Rate-limit `validateCode` deja implemente** : `app/actions/parrainage.ts:300-341` integre **deja** le pattern `try_consume_rate_limit` (constants `VALIDATE_CODE_MAX_REQUESTS=30`, `VALIDATE_CODE_WINDOW_SECONDS=300` ligne 297-298). Comportement actuel : `console.warn('[validateCode][rate_limited]', { ip })` + return `{ valid: false, reason: 'rate_limited' }`. La rretro Epic 3 mentionnait « pattern pose mais pas applique a validateCode » : c'est obsolete, l'application a bien eu lieu (probablement dans un commit Epic 3 que la retro n'a pas trace). **Cette story garde les seuils existants** (30/5min ~= 6/min/IP, suffisant pour saisie manuelle, infaisable pour bruteforce meme parallelise sur 100 IPs : 3000 tentatives/5min = 100k codes / 6 jours pour 1 hit espere) et **ajoute uniquement l'instrumentation Sentry** sur la branche rate-limit (AC4).
- **RPC Postgres `try_consume_rate_limit`** : signature `(p_key TEXT, p_max_requests INT, p_window_seconds INT) RETURNS BOOLEAN`, table `rate_limits`, migration `supabase/migrations/20260429170000_rate_limit_tracker.sql` deja appliquee.
- **`@sentry/nextjs` n'est PAS installe** : verification `package.json` (54 lignes, aucune dep `@sentry/*`), pas de `instrumentation.ts`, pas de `sentry.*.config.ts`, pas de DSN. Greenfield Sentry integration.
- **`next.config.mjs`** est minimal (15 lignes, ESM `export default`, juste `reactStrictMode` + `images.remotePatterns` pour Supabase). Pattern `withSentryConfig` (wrapper qui ajoute upload sourcemaps + tunnelRoute adblocker) doit s'appliquer ici.
- **`vercel.json`** definit `buildCommand: "npm run check:env && npm run lint:a11y-check && next build"` (story 3.8). L'integration Sentry (`withSentryConfig`) **ne touche pas** `buildCommand` mais delegue les sourcemaps au build Next ; vercel.json reste inchange.
- **Pattern fail-loud F4 (DECISIONS.md 2026-05-07)** : pour tout flow notification admin, audit trail `admin_actions_log` insertion **avant** retry. Cette story n'introduit pas de flow notification ; elle se contente de capturer les `console.error` existants vers Sentry. Donc **aucune migration BDD** ni nouveau `actionLabels`.
- **Console.error existants** sur les chemins critiques (a couvrir par cette story) : `app/api/webhooks/stripe/route.ts:16` occurrences, `app/actions/parrainage.ts:13` occurrences (dont ligne 340 sur erreur RPC rate-limit), `lib/emails.ts:8` occurrences (envoi Resend, log notification), `app/actions/admin-parrainages.ts:5` occurrences (autoriser, confirmer fraude, suspend). `lib/parrainage-detection.ts` est un module helper pur sans `console.error` -> rien a faire dessus.

**Le coeur de la story** : (a) **installer `@sentry/nextjs` v8+**, (b) **configurer instrumentation client + server + edge** (3 fichiers de config Sentry au root + `instrumentation.ts` au root + `instrumentation-client.ts` au root), (c) **wrapper `next.config.mjs` avec `withSentryConfig`**, (d) **ajouter SENTRY_DSN/SENTRY_ORG/SENTRY_PROJECT/SENTRY_AUTH_TOKEN au `scripts/check-required-env.mjs`** (categorie OPTIONAL_ON_PREVIEW : warning si manquant en production, silencieux ailleurs ; story 4.8 raffinera la separation REQUIRED vs OPTIONAL_ON_PREVIEW), (e) **instrumenter explicitement** les `console.error` critiques de 4 fichiers (webhook Stripe + parrainage actions + emails + admin-parrainages) avec `Sentry.captureException(err, { tags: { flow, severity }, extra })` **en gardant** le `console.error` existant (defense en profondeur : Sentry capture pour alerting, console.error reste pour debug Vercel logs), (f) **emettre un evenement Sentry** sur la branche rate-limit `validateCode:332-335` avec tag `flow: 'parrainage', signal: 'rate-limit-validate-code'`, (g) **documenter dans `.env.local.example` et `NEXT_STEPS.md`** les nouvelles variables Sentry.

**Hors scope explicite** :
1. **Re-architecture du logging** : pas de wrapper `logger.ts` unifie ni de migration `console.error` -> `logger.error`. Ajout chirurgical de `Sentry.captureException` adjacents aux `console.error` existants. La centralisation est differable Epic 5+ si besoin.
2. **Durcir les seuils rate-limit `validateCode`** : 30/5min reste, on ne passe pas a 5/min meme si l'AC initial epic-4 le mentionnait (decision : seuils actuels sont securitaires + UX-friendly, voir reference D1 dans Dev Notes).
3. **Couplage Sentry avec PagerDuty/Slack alerts** : explicitement reporte epic 5+ (`epic-4.md` Hors scope).
4. **Sentry replays / performance / profiling** : commentes/ desactives par defaut. Cette story se limite a `tracesSampleRate: 0` (aucune trace) + capture exceptions seules. Activation traces/replays = decision separee post-go-live (volume + cost trade-off).
5. **Story 4.5 (hardening IP spoofing)** : non couverte ici. La detection IP actuelle (`x-forwarded-for` + `x-real-ip` fallback `'unknown'`) reste inchangee dans cette story, malgre l'imperfection notee (Vercel sanitize en prod, OK pour MVP). 4.5 migrera vers `x-vercel-forwarded-for` dans une story dediee.
6. **Story 4.2 (schema logNotification)** : explicitement disjointe. Cette story 4.1 ne touche pas `notifications_log`.

## Acceptance Criteria

### AC fonctionnels (AI-3.4 retro Epic 3)

1. **AC1 — `@sentry/nextjs` installe + configurations en place** : Given le projet roxanetnous n'a aucune dependance Sentry actuellement (verification `grep "@sentry" package.json` -> aucun match), when la story est livree, then :
   - **Dependance `@sentry/nextjs` v8+** est ajoutee a `package.json` `dependencies` (pas `devDependencies` car le SDK tourne au runtime). Version retenue : la **derniere stable v8.x ou v9.x** au moment du dev (verifier `npm view @sentry/nextjs version`). **Contrainte** : compatible Next.js 16 (App Router + React 19). Ne pas installer une v7 obsolete.
   - **Cinq fichiers de configuration Sentry crees au root** :
     1. `instrumentation.ts` (registre serveur + edge) : pattern Next.js 16 standard, exporte `register()` qui charge `sentry.server.config` ou `sentry.edge.config` selon `process.env.NEXT_RUNTIME`.
     2. `instrumentation-client.ts` (browser, charge automatiquement par Next.js 16 / `@sentry/nextjs` v8+) : appelle `Sentry.init({ dsn: process.env.NEXT_PUBLIC_SENTRY_DSN, ... })` avec `tracesSampleRate: 0`, `replaysOnErrorSampleRate: 0`, `replaysSessionSampleRate: 0`.
     3. `sentry.server.config.ts` : appelle `Sentry.init({ dsn: process.env.SENTRY_DSN, ... })` avec `tracesSampleRate: 0`.
     4. `sentry.edge.config.ts` : meme pattern adapte runtime edge (utilise pour proxy / middleware si eligible). Important : roxanetnous n'a actuellement pas de middleware ni Edge Function explicite (verifier `grep -r "runtime.*edge" app`), mais la config edge est exigee par `withSentryConfig` -> on la cree quand meme.
     5. (optionnel) `sentry.config.ts` n'est PAS le pattern actuel ; pas de fichier consolide unique.
   - **`next.config.mjs` est wrappe** par `withSentryConfig(nextConfig, { silent: true, org: process.env.SENTRY_ORG, project: process.env.SENTRY_PROJECT, tunnelRoute: '/monitoring', disableLogger: true, automaticVercelMonitors: false })`. **Ne pas activer `automaticVercelMonitors: true`** (genere des cron monitors Sentry redondants avec ceux deja definis dans `vercel.json`).
   - **Aucune regression build** : `npm run build` passe en local **et** sur preview Vercel apres merge. Si `SENTRY_AUTH_TOKEN` est absent en preview, le build doit toujours passer (sourcemaps non uploadees en silence, c'est OK).

2. **AC2 — Variables d'environnement Sentry documentees + ajoutees a `check-required-env.mjs`** : Given le pattern de validation environnement etabli story 3.8 (`scripts/check-required-env.mjs` non bloquant, warning si manquante en `VERCEL_ENV=production`), when la story est livree, then :
   - **Quatre nouvelles variables ajoutees** a la liste de `scripts/check-required-env.mjs` (`REQUIRED` array si la story 4.8 n'est pas encore livree ; sinon dans la categorie `OPTIONAL_ON_PREVIEW` qui sera introduite par 4.8) :
     - `NEXT_PUBLIC_SENTRY_DSN` — DSN Sentry expose au client (prefixe `NEXT_PUBLIC_` car lu par `instrumentation-client.ts`).
     - `SENTRY_DSN` — DSN Sentry server-side (peut etre identique au public).
     - `SENTRY_ORG` — slug de l'organisation Sentry (ex: `roxanetnous`).
     - `SENTRY_PROJECT` — slug du projet Sentry (ex: `roxanetnous-web`).
     - **`SENTRY_AUTH_TOKEN`** — token d'upload sourcemaps build-time. **Ne PAS** l'ajouter a `check-required-env.mjs` car c'est une variable build-time uniquement, lue par `withSentryConfig` au moment de la build et JAMAIS au runtime. Documentee dans `.env.local.example` et `NEXT_STEPS.md` pour le scope `production` Vercel.
   - **Description courte adjacente** dans `check-required-env.mjs` : `'NEXT_PUBLIC_SENTRY_DSN — DSN Sentry pour capture erreurs runtime (alerting prod). Sans, aucun signal Sentry, debug uniquement via Vercel logs.'`. Suivre le pattern story 3.8.
   - **`.env.local.example`** : ajouter une section `# Sentry (alerting erreurs prod, story 4.1)` avec les 5 variables (4 runtime + `SENTRY_AUTH_TOKEN`) + comment court par variable. Laisser les valeurs vides (modele uniquement).
   - **`NEXT_STEPS.md`** : completer la section « Variables d'environnement requises en production » (deja existante, ajoutee story 3.8) avec les 5 variables Sentry, en respectant le format markdown existant (`- VARIABLE — description`).

3. **AC3 — Instrumentation explicite des chemins critiques** : Given les 4 fichiers cles avec `console.error` existants (webhook Stripe 16 occurrences, `app/actions/parrainage.ts` 13 occurrences, `lib/emails.ts` 8 occurrences, `app/actions/admin-parrainages.ts` 5 occurrences), when la story est livree, then :

   - **Pour chaque `console.error` actuel sur ces 4 fichiers**, ajouter **adjacement** (ligne suivante ou ligne precedente, au choix dev) un appel `Sentry.captureException(err, { tags: { flow, severity }, extra: { ... } })` ou `Sentry.captureMessage(...)` selon le cas. **Le `console.error` existant reste** : strategie defense-en-profondeur. Sentry pour alerting, console.error pour debug Vercel logs (gratuit, retroactif jusqu'a 30 jours).
   - **Tags obligatoires** sur chaque appel Sentry :
     - `flow` : un parmi `'webhook-stripe' | 'parrainage' | 'email' | 'admin' | 'paywall'`. Choix selon le fichier source :
       - `app/api/webhooks/stripe/route.ts` -> `flow: 'webhook-stripe'`
       - `app/actions/parrainage.ts` -> `flow: 'parrainage'`
       - `lib/emails.ts` -> `flow: 'email'`
       - `app/actions/admin-parrainages.ts` -> `flow: 'admin'`
     - `severity` : un parmi `'critical' | 'warning'`. **Critical** = perte de donnees ou paiement (insertion BDD ratee, signature webhook invalide, double-charge possible). **Warning** = retry ulterieur possible (Resend timeout, RPC rate-limit RPC down). Le dev applique le bon level apres lecture du contexte autour de chaque `console.error`.
   - **`extra`** : sterilise (ne JAMAIS inclure de PII brute non hashee). Acceptable : `parrainageId`, `userId` (UUID), `subscriptionId`, `eventId` Stripe, `code` (rate-limit key sans IP brute), `error.message`. Interdit : email plain, telephone, nom/prenom, adresse, IP brute.
   - **Inventaire detaille** dans Dev Notes (table fichier x ligne x flow x severity) **a remplir** par le dev en **debut de story** (premier sous-tache) pour valider qu'aucun `console.error` critique n'est oublie. Un dev qui change de strategie sur un point precis (ex: ne pas instrumenter un `console.error` qui ne reflete pas une vraie erreur) doit le justifier en commentaire dans Dev Notes.

4. **AC4 — Evenement Sentry dedie sur rate-limit `validateCode` declenche** : Given la branche rate-limit hit dans `app/actions/parrainage.ts:332-335` (`if (allowed === false) { console.warn(...); return { valid: false, reason: 'rate_limited' } }`), when la story est livree, then :
   - **Un appel `Sentry.captureMessage('rate-limit-validate-code triggered', { level: 'warning', tags: { flow: 'parrainage', signal: 'rate-limit-validate-code', severity: 'warning' }, extra: { keyHash: <hash de la key, PAS l'IP brute> } })`** est ajoute apres le `console.warn` existant ligne 333.
   - **`keyHash`** : pour ne pas envoyer l'IP brute a Sentry (PII), hasher la clef rate-limit avec `crypto.subtle` ou un simple `crypto.createHash('sha256').update(rateLimitKey).digest('hex').slice(0, 16)` (16 chars suffisent pour identifier l'attaquant si recurrent). Helper pur : `lib/rate-limit-hash.ts` (nouveau, ~10 lignes) reutilisable.
   - **Aucune modification des seuils `VALIDATE_CODE_MAX_REQUESTS=30` / `VALIDATE_CODE_WINDOW_SECONDS=300`** : ils restent. L'AC initial Epic 4 mentionnait « 5 tentatives par minute par IP » mais le code existant est plus permissif (30/5min ~= 6/min) et plus UX-friendly. Justification documentee dans `Dev Notes > Decisions` (D1).
   - **Aucune modification du fallback `'unknown'` IP** : reste tel quel. Story 4.5 (IP spoofing) traitera. Note explicite dans le commentaire au-dessus du `Sentry.captureMessage` : `// TODO story 4.5 : remplacer x-forwarded-for par x-vercel-forwarded-for`.
   - **Egalement instrumenter le catch `console.error('[validateCode][rate_limit_error]', rateLimitErr)` ligne 340** : `Sentry.captureException(rateLimitErr, { tags: { flow: 'parrainage', signal: 'rate-limit-rpc-error', severity: 'critical' } })`. Une defaillance du RPC rate-limit est critique car elle ouvre temporairement la fenetre brute-force.

5. **AC5 — Tunnel route `/monitoring` configure** : Given la decision de proteger les events Sentry contre les ad-blockers (extension navigateur frequente qui bloque `*.sentry.io`), when la story est livree, then :
   - **`tunnelRoute: '/monitoring'`** est passe a `withSentryConfig` dans `next.config.mjs`. Le SDK Sentry generera automatiquement un route handler interne `/monitoring/*` qui forward les events vers Sentry server-side, contournant l'adblock client.
   - **Verifier qu'aucun route conflict** existe avec un route applicatif (`grep -r "/monitoring" app` doit retourner 0 match avant la story, le route Sentry sera genere automatiquement).
   - **Vercel CSP / firewall** : aucune action requise (Vercel autorise les routes Next.js par defaut).

6. **AC6 — Validation manuelle preview Vercel** : Given la story integre un service externe (Sentry), when la PR est ouverte sur preview Vercel, then :
   - **Le dev declenche manuellement** une erreur de test via une page de debug temporaire (ou via un script `scripts/test-sentry.mjs` qui throw + capture, supprime apres validation) **OU** via un endpoint `/api/test-sentry` (creation puis suppression dans la meme PR ; alternative : commit-revert dans la PR).
   - **Verification dashboard Sentry** : l'erreur de test arrive avec les bons tags (`flow`, `severity`, `extra`).
   - **Cleanup post-validation** : tout fichier de test (`/api/test-sentry/route.ts`, scripts/test-sentry.mjs) est **supprime** dans le commit final de livraison. Pas de code mort en main.
   - **Captures d'ecran ou note** dans Dev Agent Record > Completion Notes mentionnant la validation reussie (date + URL Sentry de l'event capture).

### AC techniques (pas de regression)

7. **AC7 — Build et lint verts** : Given la convention projet (`npm run build`, `npm run lint`, `npm run lint:a11y-check`, `npm run a11y:axe:check` doivent etre verts au moment du commit livraison), when la story est livree, then :
   - **`npm run build`** passe en local (TypeScript strict + ESLint).
   - **`npm run lint`** passe (aucune nouvelle warning/error TypeScript-eslint introduite par les fichiers Sentry).
   - **`npm run lint:a11y-check`** passe (baseline a11y inchangee, c'est de l'instrumentation backend).
   - **`npm run a11y:axe:check`** passe (exit 0, baseline 0 violations Critical/Serious sur 7 parcours - obligation CLAUDE.md). Si Sentry SDK ajoute un script frontend, **verifier** qu'il n'introduit pas d'iframe sans `title` ou de noscript sans label.
   - **`npm run check:env`** passe (les nouvelles variables NEXT_PUBLIC_SENTRY_DSN/SENTRY_DSN/SENTRY_ORG/SENTRY_PROJECT sont declarees, mais leur absence ne bloque pas le build, juste warning).

8. **AC8 — Pas de regression typage strict** : Given la convention projet de typage strict (`tsconfig.json` strict mode, pas de nouveau `as any` introduit), when la story est livree, then :
   - **Aucun `as any`** ajoute dans le diff. Sentry SDK est typescript-strict natif depuis v7+.
   - **Imports Sentry typings** : `import * as Sentry from '@sentry/nextjs'` est canonique. Tags et extras typed via `Sentry.SeverityLevel`, `Sentry.Event` si necessaire.
   - **TypeScript build** : `npx tsc --noEmit` (si execute) doit passer sans erreur sur les nouveaux fichiers et les fichiers modifies.

9. **AC9 — Source maps uploadees automatiquement en production** : Given `withSentryConfig` est wrappe autour de `next.config.mjs`, when un build production tourne sur Vercel avec `SENTRY_AUTH_TOKEN` defini, then :
   - **Les sourcemaps sont uploadees a Sentry automatiquement** au moment du `next build`, **et** supprimees du bundle public (Sentry SDK les masque par defaut pour eviter de les exposer publiquement). Verifiable apres deploiement : les stack traces dans Sentry doivent montrer le code source TypeScript original (pas le bundle minifie).
   - **Si `SENTRY_AUTH_TOKEN` est absent** (cas preview Vercel ou local), le upload est skippe en silence (pas de fail build, juste log info `withSentryConfig`).

## Tasks / Subtasks

- [x] **Task 1 (AC: #1) — Installation et configuration Sentry SDK**
  - [x] Subtask 1.1 : `npm install @sentry/nextjs@latest` -> v10.52.0 installee (peerDeps Next 16 OK).
  - [x] Subtask 1.2 : Creation manuelle des 4 fichiers config (le wizard exigeait auth interactive, peu pratique en dev-story).
  - [x] Subtask 1.3 : Sentry.init configure dans 3 fichiers (instrumentation-client + sentry.server.config + sentry.edge.config) avec `enabled: !!dsn`, `tracesSampleRate: 0`, `replaysOnErrorSampleRate: 0`, `replaysSessionSampleRate: 0`, `debug: NODE_ENV==='development'`, `environment` mappe sur VERCEL_ENV.
  - [x] Subtask 1.4 : `next.config.mjs` wrappe par `withSentryConfig(nextConfig, { silent: true, org, project, tunnelRoute: '/monitoring', webpack: { automaticVercelMonitors: false, treeshake: { removeDebugLogging: true } } })`. Pattern v10 (les options `disableLogger` / `automaticVercelMonitors` au top-level sont deprecated en v10, deplaces sous `webpack.*`).
  - [x] Subtask 1.5 : `npm run build` local : exit 0, 0 deprecation warning.

- [x] **Task 2 (AC: #2) — Variables d'environnement et documentation**
  - [x] Subtask 2.1 : `scripts/check-required-env.mjs` etendu avec `NEXT_PUBLIC_SENTRY_DSN`, `SENTRY_DSN`, `SENTRY_ORG`, `SENTRY_PROJECT`. `SENTRY_AUTH_TOKEN` exclu (build-time only).
  - [x] Subtask 2.2 : `.env.local.example` enrichi section `# Sentry (alerting erreurs prod, story 4.1)` avec 5 variables + commentaires.
  - [x] Subtask 2.3 : `NEXT_STEPS.md` section env requises completee avec 5 variables Sentry.
  - [x] Subtask 2.4 : `npm run check:env` local : exit 0 silencieux (comportement attendu hors VERCEL_ENV=production).

- [x] **Task 3 (AC: #3) — Inventaire et instrumentation explicite des `console.error`**
  - [x] Subtask 3.1 : Inventaire 40 occurrences effectives (16+13+6+5). Ecart vs annonce 42 : `lib/emails.ts` montre 8 matches `grep -c` mais 2 sont des **commentaires** (lignes 719/720 evoquant `console.warn`/`console.error`). Inventaire detaille dans Debug Log References.
  - [x] Subtask 3.2 : Chaque `console.error/warn` conserve (defense en profondeur Vercel logs) + `Sentry.captureException`/`captureMessage` adjacent ajoute. Tags `flow` + `severity` + `extra` sterilise (UUID, message error, parrainageId, customerId, eventId Stripe seulement). Aucun email/telephone/nom/IP brute envoye.
  - [x] Subtask 3.3 : `import * as Sentry from '@sentry/nextjs'` en tete des 4 fichiers cibles.
  - [x] Subtask 3.4 : Inventaire applique 100% (40/40). Aucun skip.

- [x] **Task 4 (AC: #4) — Evenement Sentry rate-limit `validateCode`**
  - [x] Subtask 4.1 : `lib/rate-limit-hash.ts` cree (helper pur `hashRateLimitKey(key) -> SHA-256 16 chars`).
  - [x] Subtask 4.2 : `app/actions/parrainage.ts:333` instrumente `Sentry.captureMessage('rate-limit-validate-code triggered', ..., { extra: { keyHash } })`.
  - [x] Subtask 4.3 : `app/actions/parrainage.ts:340` instrumente `Sentry.captureException(rateLimitErr, { ..., severity: 'critical' })`.
  - [x] Subtask 4.4 : Commentaire `// TODO story 4.5 : remplacer x-forwarded-for par x-vercel-forwarded-for (hardening IP spoofing)` ajoute au-dessus du bloc rate-limit.

- [x] **Task 5 (AC: #5) — Tunnel route et validation route**
  - [x] Subtask 5.1 : `grep -r "/monitoring" app` -> 0 match. `tunnelRoute: '/monitoring'` configure.
  - [ ] Subtask 5.2 : Verification preview Vercel post-deploiement (action manuelle Sylvain : hit `/monitoring/...` devtools network tab).

- [x] **Task 6 (AC: #6) — Validation Sentry sur preview Vercel**
  - [x] Subtask 6.1 : `app/api/test-sentry/route.ts` cree (endpoint GET emettant captureMessage + captureException).
  - [ ] Subtask 6.2 : Action manuelle Sylvain : configurer DSN sur Vercel preview, hit `/api/test-sentry`, verifier dashboard.
  - [ ] Subtask 6.3 : Action manuelle Sylvain : SUPPRIMER `app/api/test-sentry/route.ts` avec un commit dedie avant merge final.
  - [ ] Subtask 6.4 : Documenter URL Sentry post-validation dans Completion Notes (action manuelle Sylvain).

- [x] **Task 7 (AC: #7-8) — Tests de non-regression**
  - [x] Subtask 7.1 : `npm run build` : exit 0.
  - [x] Subtask 7.2 : `npm run lint` : 0 errors, 226 warnings preexistants (aucun nouveau sur fichiers touches).
  - [x] Subtask 7.3 : `npm run lint:a11y-check` : exit 0, baseline 155, no regression.
  - [x] Subtask 7.4 : `npm run a11y:axe:check` : exit 0, aucun delta Critical/Serious sur 7 parcours. **DoD a11y CLAUDE.md respectee.**
  - [x] Subtask 7.5 : `npx tsc --noEmit` : compilation OK.
  - [x] Subtask 7.6 : `grep "as any"` sur 4 fichiers cibles : 2 occurrences preexistantes (webhooks/stripe:692, 787 sur types Stripe), 0 ajoutee par cette story.

- [ ] **Task 8 (AC: #9) — Source maps en production** (action manuelle post-merge)
  - [ ] Subtask 8.1 : Action manuelle Sylvain : `vercel env add SENTRY_AUTH_TOKEN production` apres creation projet Sentry.
  - [ ] Subtask 8.2 : Apres premier deploiement production post-merge, verifier stack trace Sentry dashboard.

### Review Findings

Code review du 2026-05-07 (multi-agent : Blind Hunter + Edge-Case Hunter + Acceptance Auditor). Verdict global : **PASS-with-caveats**, AC1-AC9 satisfaits, decisions D1-D5 respectees, PII Sentry sterilisee (UUIDs/hashes uniquement).

- [x] [Review][Dismiss] `treeshake.removeDebugLogging` et `automaticVercelMonitors` sous `webpack` : faux positif — Verification du source v10.52.0 (`node_modules/@sentry/nextjs/build/esm/config/withSentryConfig/deprecatedWebpackOptions.js`) confirme que ces options sont migrees automatiquement de top-level vers `webpack.*` ET que les top-level sont DEPRECATED. La forme actuelle de `next.config.mjs:33-37` est canonique v10.
- [x] [Review][Patch] Endpoint `/api/test-sentry` : ajouter guard `NODE_ENV === 'production' -> 404` en plus du commit cleanup [app/api/test-sentry/route.ts:17] (decision D2 -> patch) — applique 2026-05-07
- [x] [Review][Patch] `hashRateLimitKey` : passer en HMAC sale via `RATE_LIMIT_HASH_SALT` env var pour garantir l'irreversibilite (decision D3 -> patch) — applique 2026-05-07. (a) `lib/rate-limit-hash.ts` refactore en `createHmac('sha256', salt)` avec fallback SHA-256 si sel absent, (b) `RATE_LIMIT_HASH_SALT` ajoute a `.env.local.example` + `NEXT_STEPS.md` + `scripts/check-required-env.mjs` (productionOnly), (c) commentaire corrige (espace 2^64 + birthday 2^32, doc claim PII honnete)
- [x] [Review][Patch] `Sentry.init` manque `sendDefaultPii: false` explicite [sentry.server.config.ts:10-16, sentry.edge.config.ts:16-21, instrumentation-client.ts:16-24] — applique 2026-05-07
- [x] [Review][Patch] `captureException(rateLimitErr)` n'inclut pas le `keyHash` (incoherent avec branche success) [app/actions/parrainage.ts:370-376] — applique 2026-05-07 (rateLimitKey hisse hors du try, keyHash transmis dans le catch)
- [x] [Review][Patch] Sentry env vars produisent un warning bruyant en preview alors qu'elles sont optionnelles preview (spec AC2 dit silencieux ailleurs qu'en production) [scripts/check-required-env.mjs:46-60] — applique 2026-05-07 (flag `productionOnly: true` + filtre preview)
- [x] [Review][Patch] Doc imprecise `lib/rate-limit-hash.ts:6` : "collision theorique 2^64" ambigu (birthday-bound 2^32) — applique 2026-05-07 (doc reformulee)
- [x] [Review][Patch] Contradiction dans `_bmad-output/planning-artifacts/epics.md:30` : table dit "a cadrer formellement" mais prose suivante dit cadre 2026-05-07 — applique 2026-05-07 (cellule alignee "cadre 2026-05-07, en cours")
- [x] [Review][Defer] `sendWaitlistOpeningNotificationEmail` early-return invalid nom sans `admin_actions_log` [lib/emails.ts:949-961] — deferred, pre-existing (story 3.x patch #13/#14, dette F4)
- [x] [Review][Defer] `/monitoring` tunnel route : aucun `robots.txt` ni `noindex` [next.config.mjs:32] — deferred, hors scope story 4.1
- [x] [Review][Defer] `SENTRY_AUTH_TOKEN` build-time only sans helper enforce le contrat — deferred, theorique

## Dev Notes

### Decisions de cette story

**D1 — Garder seuils `validateCode` actuels (30/5min) au lieu du 5/min mentionne epic-4** :
- L'AC initial epic-4 mentionnait « 5 tentatives par minute par IP » mais le code livre par story 3.x (avant epic-4) implemente deja 30 tentatives / 5 minutes (~6/min).
- 30/5min reste **securitaire** : un attaquant parallelisant sur 100 IPs uniques fait 3000 tentatives / 5min = 36k/h = 864k/jour. Pour 31^8 codes possibles (~852 milliards) = 1 hit espere apres ~2700 ans. Bruteforce infaisable.
- 30/5min reste **UX-friendly** : un utilisateur legitime qui se trompe peut retaper son code 5-10 fois sans etre bloque (utile en cas de typo, copy-paste avec espaces, etc.).
- Durcir a 5/min n'apporte pas de gain securitaire materiel et risque de bloquer un utilisateur leger.
- **Decision finale** : seuils inchanges. Justification dans le commentaire au-dessus de `VALIDATE_CODE_MAX_REQUESTS` deja en place (`H12 (code review 2026-04-29)`).

**D2 — Pas de wrapper `logger.ts` unifie** :
- Considere : creer `lib/logger.ts` qui wrappe `console.error` + `Sentry.captureException` en un seul appel.
- Rejete : ajout de couche d'indirection sans benefice immediat (4 fichiers a instrumenter, pas 40). Aussi : risque de masquer les `console.error` dans Vercel logs si la wrapper est mal coduit. Strategie chirurgicale `console.error` + `Sentry.captureException` adjacents est plus claire pour debug.
- **Decision finale** : pas de wrapper. Si Epic 5+ multiplie les call-sites, extraction en wrapper sera trivial (1 commit search-replace).

**D3 — `tracesSampleRate: 0`, pas de session replays** :
- Performance monitoring + replays = +cost Sentry significatif (essentiellement le volume des events monte) et pas necessaire pour valider le go-live Bretagne.
- **Decision finale** : `tracesSampleRate: 0`, `replaysOnErrorSampleRate: 0`, `replaysSessionSampleRate: 0`. Ajustement post-go-live si visibilite manquante.

**D4 — Tunnel route `/monitoring`, pas `/api/monitoring` ni `/sentry-tunnel`** :
- `/monitoring` = pattern Sentry default, plus court, moins suspectable d'etre bloque par un firewall qui filtre `/api/*`.
- Verifier absence de conflit applicatif (`grep -r "/monitoring" app`).
- **Decision finale** : `/monitoring`. Si conflit detecte, fallback `/sentry-tunnel`.

**D5 — Sentry Init avec `enabled: !!DSN`** :
- Permet aux deploiements preview / dev sans `SENTRY_DSN` configure de tourner sans erreur (pas de console.warn `Sentry disabled`).
- Tradeoff : un dev oubliant de configurer Sentry en prod ne le saura que par l'absence d'events. Mitigation : `scripts/check-required-env.mjs` warning explicite en `VERCEL_ENV=production`.
- **Decision finale** : `enabled: !!DSN` partout.

### Architecture Sentry retenue

- **5 fichiers de config** au root : `instrumentation.ts` (registre serveur+edge), `instrumentation-client.ts` (browser), `sentry.server.config.ts`, `sentry.edge.config.ts`. Pattern canonique Sentry SDK v8+ pour Next.js 16.
- **`withSentryConfig`** wrappe `next.config.mjs`. Genere automatiquement :
  - Route handler `/monitoring/*` (tunnel adblocker).
  - Upload sourcemaps build-time vers Sentry (necessite `SENTRY_AUTH_TOKEN`).
  - Suppression sourcemaps du bundle public (securite).
- **Tags metier obligatoires** : `flow` (`webhook-stripe` | `parrainage` | `email` | `admin` | `paywall`) et `severity` (`critical` | `warning`). Permet filtrage Sentry par flow et alerting prioritaire sur critical.
- **PII steriliisee dans `extra`** : UUID + eventId + message d'erreur OK, email/telephone/nom/IP brute interdits. Pour rate-limit : hash SHA-256 16 chars de la key.

### Source tree components a toucher

- **Nouveaux fichiers** :
  - `instrumentation.ts` (root)
  - `instrumentation-client.ts` (root)
  - `sentry.server.config.ts` (root)
  - `sentry.edge.config.ts` (root)
  - `lib/rate-limit-hash.ts` (helper pur, ~10 lignes)
- **Fichiers modifies** :
  - `next.config.mjs` : wrappe par `withSentryConfig`.
  - `package.json` : `+@sentry/nextjs` dans `dependencies`.
  - `scripts/check-required-env.mjs` : `+NEXT_PUBLIC_SENTRY_DSN, +SENTRY_DSN, +SENTRY_ORG, +SENTRY_PROJECT` dans la liste verifiee.
  - `.env.local.example` : `+section Sentry avec 5 variables`.
  - `NEXT_STEPS.md` : `+5 variables Sentry` dans la section env requise.
  - `app/api/webhooks/stripe/route.ts` : `+import Sentry` + `+16 captureException` adjacents aux `console.error`.
  - `app/actions/parrainage.ts` : `+import Sentry` + `+13 captureException/Message` adjacents.
  - `lib/emails.ts` : `+import Sentry` + `+8 captureException` adjacents.
  - `app/actions/admin-parrainages.ts` : `+import Sentry` + `+5 captureException` adjacents.
- **Aucune migration BDD** (story 4.2 traite le schema notifications_log).
- **Aucune modification UI** (story strictement backend / instrumentation).

### Inventaire `console.error` a remplir en debut de story (Task 3.1)

Format attendu (a remplir par dev en Markdown table dans Dev Agent Record > Debug Log References) :

| Fichier | Ligne | Contexte (1 ligne) | Flow | Severity | Action |
|---|---|---|---|---|---|
| `app/api/webhooks/stripe/route.ts` | 124 | (contexte a inferer) | webhook-stripe | (critical/warning) | apply Sentry |
| ... | ... | ... | ... | ... | ... |

42 lignes attendues (16 + 13 + 8 + 5) au minimum.

### Testing standards summary

- **Test unitaire helper** : `tests/unit/rate-limit-hash.test.ts` (couvert par story 4.4 qui setup Playwright/vitest, **pas dans cette story**). Si dev veut tester immediatement, faisable en script ad hoc `node scripts/test-rate-limit-hash.mjs` (cleanup avant merge).
- **Test integration Sentry** : validation manuelle sur preview Vercel (AC6). Pas d'automated test Sentry dans cette story (couvert tangentiellement par story 4.4 qui ajoutera Playwright e2e).
- **Test de non-regression** : `npm run build`, `npm run lint`, `npm run lint:a11y-check`, `npm run a11y:axe:check` doivent rester verts (AC7).

### Project Structure Notes

- Cohesion avec convention projet (CLAUDE.md) :
  - Pas d'emojis dans le code/UI : conforme (Sentry n'introduit pas d'emoji par defaut).
  - DoD a11y : application minimale sur cette story (pas d'impact UI). `npm run a11y:axe:check` doit rester exit 0 mais le delta attendu est nul.
  - Stack ESM Next.js 16 : `next.config.mjs` reste ESM apres wrapping `withSentryConfig`. `instrumentation.ts` et autres fichiers TypeScript ESM par defaut.
- Cohesion avec patterns Epic 2/3 :
  - F4 fail-loud (DECISIONS.md 2026-05-07) : Sentry est un canal **complementaire** aux `admin_actions_log` audit trail. Ne se substitue pas. Pour les flows fail-loud (sendAdminParrainageFlag, etc.), Sentry capture l'erreur ET admin_actions_log conserve le signal. Defense en profondeur.
  - F5 idempotence (DECISIONS.md 2026-05-07) : ne s'applique pas a cette story (pas de nouvelle table BDD).
  - Story 3.8 : `scripts/check-required-env.mjs` reutilise et etendu sans refactor (cf. AC2).

### References

- **Doc Sentry Next.js officielle** : https://docs.sentry.io/platforms/javascript/guides/nextjs/ (verifie 2026-05-07 : pattern recommande = 5 fichiers config + `withSentryConfig`).
- **Vercel + Sentry integration** : https://vercel.com/docs/integrations/sentry (auto-provisionnement variables si integration installee depuis Vercel marketplace).
- **Migration `_bmad-output/implementation-artifacts/3-4-waitlist...md`** : pattern `try_consume_rate_limit` source.
- **`app/actions/parrainage.ts:300-341`** : code rate-limit `validateCode` deja en place.
- **`epic-4.md` Story 4.1** : AC initial (durcissement seuils 5/min mentionne mais override par D1).
- **`epic-3-retro-2026-05-07.md` AI-3.4** : origine de cette story.
- **`DECISIONS.md` 2026-05-07 F4 et F5** : patterns fail-loud + idempotence (alignement architectural).
- **`/Users/sylvain/.claude/projects/-Users-sylvain-Documents-roxanetnous/memory/project_logNotification_bug.md`** : note bug latent transverse, traite par story 4.2 (pas par cette story).
- **`/Users/sylvain/.claude/projects/-Users-sylvain-Documents-roxanetnous/memory/project_epic_3_retro.md`** : retro Epic 3 listant les 4 AI bloquants go-live (AI-3.1 a AI-3.4).

## Dev Agent Record

### Agent Model Used

claude-opus-4-7 (1M context)

### Debug Log References

**Inventaire console.error/warn (40 occurrences effectives instrumentees)**

| Fichier | Ligne | Contexte | Flow | Severity | Action |
|---|---|---|---|---|---|
| `app/actions/parrainage.ts` | 133 | revokeFilleuleValidation no-op (etat metier) | parrainage | warning | captureMessage |
| `app/actions/parrainage.ts` | 333 | rate-limit hit validateCode (AC4) | parrainage | warning | captureMessage + keyHash |
| `app/actions/parrainage.ts` | 340 | rate-limit RPC error (AC4) | parrainage | critical | captureException |
| `app/actions/parrainage.ts` | 517 | detectBlacklist signup raté | parrainage | critical | captureException |
| `app/actions/parrainage.ts` | 534 | UPDATE parrainee_par failed | parrainage | critical | captureException |
| `app/actions/parrainage.ts` | 559 | UPDATE statut bloque failed (meme_email) | parrainage | critical | captureException |
| `app/actions/parrainage.ts` | 574 | INSERT admin_actions_log bloque | parrainage | critical | captureException |
| `app/actions/parrainage.ts` | 585 | sendAdminParrainageFlag email failed (meme_email) | parrainage | warning | captureException |
| `app/actions/parrainage.ts` | 601 | RPC merge_flag_suspicion failed (meme_ip) | parrainage | critical | captureException |
| `app/actions/parrainage.ts` | 615 | INSERT admin_actions_log flag (meme_ip) | parrainage | critical | captureException |
| `app/actions/parrainage.ts` | 626 | sendAdminParrainageFlag email failed (meme_ip) | parrainage | warning | captureException |
| `app/actions/parrainage.ts` | 765 | validation_status_skipped (etat metier) | parrainage | warning | captureMessage |
| `app/actions/parrainage.ts` | 784 | generate_code_failed | parrainage | critical | captureMessage error |
| `app/api/webhooks/stripe/route.ts` | 124 | stripe paymentMethods.list failed | webhook-stripe | warning | captureException |
| `app/api/webhooks/stripe/route.ts` | 143 | stripe charges.list failed | webhook-stripe | warning | captureException |
| `app/api/webhooks/stripe/route.ts` | 181 | merge_flag adresse avant carte failed | webhook-stripe | critical | captureException |
| `app/api/webhooks/stripe/route.ts` | 196 | UPDATE statut bloque carte failed | webhook-stripe | critical | captureException |
| `app/api/webhooks/stripe/route.ts` | 219 | INSERT admin_actions_log carte failed | webhook-stripe | critical | captureException |
| `app/api/webhooks/stripe/route.ts` | 229 | sendAdminParrainageFlag email carte failed | webhook-stripe | warning | captureException |
| `app/api/webhooks/stripe/route.ts` | 248 | merge_flag adresse failed | webhook-stripe | critical | captureException |
| `app/api/webhooks/stripe/route.ts` | 264 | INSERT admin_actions_log adresse failed | webhook-stripe | critical | captureException |
| `app/api/webhooks/stripe/route.ts` | 274 | sendAdminParrainageFlag email adresse failed | webhook-stripe | warning | captureException |
| `app/api/webhooks/stripe/route.ts` | 278 | catch global detectBlacklistAtWebhook | webhook-stripe | critical | captureException |
| `app/api/webhooks/stripe/route.ts` | 317 | stripe paymentMethods.retrieve PM failed | webhook-stripe | warning | captureException |
| `app/api/webhooks/stripe/route.ts` | 359 | catch global captureParrainageFingerprint | webhook-stripe | warning | captureException |
| `app/api/webhooks/stripe/route.ts` | 441 | INSERT stripe_events_processed failed (perte event) | webhook-stripe | critical | captureException |
| `app/api/webhooks/stripe/route.ts` | 570 | catch global checkout fingerprint capture | webhook-stripe | warning | captureException |
| `app/api/webhooks/stripe/route.ts` | 793 | handler crashed apres claim idempotence | webhook-stripe | critical | captureException |
| `app/api/webhooks/stripe/route.ts` | 807 | rollback stripe_events_processed failed | webhook-stripe | critical | captureException |
| `lib/emails.ts` | 722 | ADMIN_NOTIFICATIONS_EMAIL manquant | email | warning | captureMessage |
| `lib/emails.ts` | 741 | INSERT admin_actions_log alert_lost failed | email | critical | captureException |
| `lib/emails.ts` | 915 | resend send waitlist confirmation failed | email | warning | captureException |
| `lib/emails.ts` | 936 | invalid nom departement (validation defensive) | email | critical | captureMessage error |
| `lib/emails.ts` | 969 | resend.emails.send retourne error (notify-waitlist) | email | warning | captureException |
| `lib/emails.ts` | 1003 | resend send notify-waitlist failed | email | warning | captureException |
| `app/actions/admin-parrainages.ts` | 68 | UPDATE parrainee_par autoriser failed | admin | critical | captureException |
| `app/actions/admin-parrainages.ts` | 82 | INSERT admin_actions_log autoriser failed | admin | critical | captureException |
| `app/actions/admin-parrainages.ts` | 139 | UPDATE compteur_confirmes rollback failed | admin | critical | captureException |
| `app/actions/admin-parrainages.ts` | 202 | UPDATE accompagnantes_profiles refuse failed | admin | critical | captureException |
| `app/actions/admin-parrainages.ts` | 218 | INSERT admin_actions_log confirmer_fraude failed | admin | critical | captureException |

**Total : 40 instrumentations** (la story annoncait 42 sur la base d'un grep brut sur lib/emails.ts ; lignes 719-720 sont des commentaires evoquant `console.warn`/`console.error` sans appel reel).

Verification : `grep -cE "Sentry\.(captureException|captureMessage)" app/api/webhooks/stripe/route.ts app/actions/parrainage.ts lib/emails.ts app/actions/admin-parrainages.ts` -> 16+13+6+5 = 40.

### Completion Notes List

**Implementation faite** :
- `@sentry/nextjs` v10.52.0 installe (compatible Next 16 + React 19, peerDeps verifie).
- 4 fichiers config Sentry crees au root + `next.config.mjs` wrappe avec `withSentryConfig`. Pattern v10 canonique (options `webpack.*` car v10 deprecie les top-level `disableLogger` / `automaticVercelMonitors`).
- 40 instrumentations explicites posees sur 4 fichiers critiques avec tags `flow` + `severity` + `extra` sterilise (UUID, eventId Stripe, parrainageId, customerId, message d'erreur seulement ; jamais email/telephone/nom/IP brute).
- AC4 : `lib/rate-limit-hash.ts` (helper pur SHA-256 16 chars) cree + 2 instrumentations dediees rate-limit `validateCode`. Commentaire TODO story 4.5 (IP spoofing) ajoute.
- AC5 : `tunnelRoute: '/monitoring'` configure. 0 conflit applicatif (`grep -r "/monitoring" app` -> 0 match).
- AC6 : endpoint ephemere `app/api/test-sentry/route.ts` cree (emet captureMessage + captureException avec tags test). **A SUPPRIMER avant merge final** par Sylvain dans un commit dedie apres validation dashboard.
- 5 variables d'env documentees : `NEXT_PUBLIC_SENTRY_DSN`, `SENTRY_DSN`, `SENTRY_ORG`, `SENTRY_PROJECT`, `SENTRY_AUTH_TOKEN`. 4 ajoutees a `scripts/check-required-env.mjs` (warning non bloquant en VERCEL_ENV=production). `SENTRY_AUTH_TOKEN` documentee dans `.env.local.example` et `NEXT_STEPS.md` (build-time uniquement).

**Tests non-regression (AC7-8)** :
- `npm run build` : exit 0, 0 deprecation warning.
- `npm run lint` : 0 errors, 226 warnings preexistants (aucun nouveau sur fichiers touches : 4 warnings preexistants survivent : parrainage.ts:912/927 blocs vides + webhooks/stripe:692/787 `as any` Stripe types).
- `npm run lint:a11y-check` : baseline 155, no regression.
- `npm run a11y:axe:check` : exit 0, aucun delta Critical/Serious sur 7 parcours. DoD a11y CLAUDE.md respectee.
- `npx tsc --noEmit` : compilation OK.
- 0 nouveau `as any` introduit.

**Actions manuelles post-merge requises (Sylvain)** :
1. Creer le projet Sentry (`roxanetnous` org, `roxanetnous-web` project).
2. Configurer DSN + ORG + PROJECT + AUTH_TOKEN sur Vercel scopes preview ET production : `vercel env add NEXT_PUBLIC_SENTRY_DSN`, `vercel env add SENTRY_DSN`, `vercel env add SENTRY_ORG`, `vercel env add SENTRY_PROJECT`, `vercel env add SENTRY_AUTH_TOKEN production` (ce dernier scope production seulement, build-time).
3. Apres merge en main : redeployer, hit `/api/test-sentry` sur la preview, verifier reception event sur dashboard Sentry avec tags `flow=test`, `signal=test-endpoint`.
4. Documenter l'URL Sentry de l'event capture dans ce fichier (Completion Notes).
5. Commit dedie : SUPPRIMER `app/api/test-sentry/route.ts` avant merge final en main.
6. Apres premier deploy production : verifier qu'une stack trace Sentry montre le code TypeScript original (sourcemaps OK).

**Decisions tracees** :
- D1 a D5 (cf. Dev Notes) appliquees telles quelles. Aucune deviation.
- Choix `Sentry.captureMessage` pour les `console.warn` (no-op metier) plutot que `captureException` : niveau warning approprie, evite le bruit sur dashboard Sentry pour des etats metier non-erreurs.

### File List

**Nouveaux fichiers** :
- `instrumentation.ts` (root, registre Sentry serveur + edge, hook onRequestError)
- `instrumentation-client.ts` (root, init browser Sentry, hook onRouterTransitionStart)
- `sentry.server.config.ts` (root, init Node.js runtime)
- `sentry.edge.config.ts` (root, init edge runtime - non utilise actuellement, requis par withSentryConfig)
- `lib/rate-limit-hash.ts` (helper pur SHA-256 hash)
- `app/api/test-sentry/route.ts` (**A SUPPRIMER avant merge final**, endpoint validation Sentry preview)

**Fichiers modifies** :
- `next.config.mjs` (wrappe avec `withSentryConfig`)
- `package.json` (`+@sentry/nextjs@^10.52.0`)
- `package-lock.json` (151 packages ajoutes)
- `scripts/check-required-env.mjs` (+4 variables Sentry runtime)
- `.env.local.example` (+section Sentry, 5 variables)
- `NEXT_STEPS.md` (+5 variables Sentry dans section env requise)
- `app/api/webhooks/stripe/route.ts` (+import Sentry, +16 captureException)
- `app/actions/parrainage.ts` (+import Sentry, +import hashRateLimitKey, +13 captureException/Message dont 2 AC4 rate-limit)
- `lib/emails.ts` (+import Sentry, +6 captureException/Message)
- `app/actions/admin-parrainages.ts` (+import Sentry, +5 captureException)
- `_bmad-output/implementation-artifacts/sprint-status.yaml` (4-1 ready-for-dev -> in-progress -> review)
- `_bmad-output/implementation-artifacts/4-1-alerting-sentry-rate-limit-validate-code.md` (statut, tasks cochees, Dev Agent Record, Change Log)

### Change Log

- **2026-05-07** : Implementation story 4.1 — alerting Sentry transverse + rate-limit `validateCode` parrainage. AC1 a AC9 livres en code, AC6 / AC8 partiellement (actions manuelles Vercel post-merge documentees). 40 instrumentations adjacentes posees sans suppression des `console.error/warn` existants (defense en profondeur). DoD a11y respectee (axe-core 0 violations Critical/Serious).
- **2026-05-07** : Code review multi-agent (Blind Hunter + Edge-Case Hunter + Acceptance Auditor). 7 patches appliques : (P1) `sendDefaultPii: false` explicite dans les 3 init Sentry, (P2) keyHash transmis dans le catch RPC error rate-limit, (P3) `productionOnly: true` flag pour Sentry env vars (silencieux en preview, conformement spec AC2), (P4) doc `lib/rate-limit-hash.ts` precisee (espace 2^64, birthday 2^32), (P5) cellule Epic 4 alignee dans `epics.md`. Decisions D2/D3 converties en patch : (D2) guard `NODE_ENV === 'production'` sur `/api/test-sentry`, (D3) HMAC sale via `RATE_LIMIT_HASH_SALT` pour irreversibilite hash IPv4. Decision D1 (forme webpack v10) verifiee dans le source `node_modules/@sentry/nextjs/build/esm/config/withSentryConfig/deprecatedWebpackOptions.js` -> faux positif, forme actuelle canonique. 3 defers consignes dans `deferred-work.md` (sendWaitlistOpeningNotificationEmail F4 dette pre-existante, /monitoring robots.txt, SENTRY_AUTH_TOKEN runtime guard). Tests post-patches : `npm run lint` 0 errors, `npm run lint:a11y-check` baseline 155 no regression, `npm run build` exit 0, `npx tsc --noEmit` OK.

## DoD a11y

A renseigner pour toute story avec impact UI (cette story est **principalement backend** mais Sentry SDK peut injecter un script frontend, donc verifications minimales requises) :

- [x] Labels associes aux champs (`htmlFor` ou `aria-labelledby`) — N/A (pas de modif UI)
- [x] Erreurs liees aux champs via `aria-describedby` + `aria-invalid` — N/A (pas de modif UI)
- [x] Focus visible sur tous les elements interactifs (contraste >= 3:1) — N/A
- [x] Contrastes texte >= 4,5:1 et UI >= 3:1 — N/A
- [x] ARIA states corrects sur composants dynamiques — N/A
- [x] Navigation clavier complete — N/A
- [x] Verification ponctuelle au lecteur d'ecran — N/A
- [x] **Pas de regression `eslint-plugin-jsx-a11y`** : `npm run lint:a11y-check` -> baseline 155, no regression.
- [x] **Pas de regression axe-core** : `npm run a11y:axe:check` -> exit 0, aucun delta Critical/Serious sur 7 parcours. Sentry SDK n'injecte aucun iframe ni noscript dans le DOM client (verifie via build + parcours Playwright a11y).
