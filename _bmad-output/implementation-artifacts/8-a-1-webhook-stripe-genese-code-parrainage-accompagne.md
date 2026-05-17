# Story 8.A.1 : Webhook Stripe -- genese code parrainage a 1ere activation abonnement accompagne

Status: done

<!-- Note: Validation is optional. Run validate-create-story for quality check before dev-story. -->

## Story

As a accompagne,
I want que mon code de parrainage soit cree automatiquement la 1ere fois que mon abonnement passe `status='active'` (ou `'trialing'`),
so that je puisse le partager avec un proche accompagnant sans demarche supplementaire (page `/accompagne/parrainage` livree 8.B.1).

## Acceptance Criteria

1. **AC1 -- Genese du code a 1ere activation accompagne** : lorsque le webhook Stripe traite un event `checkout.session.completed` (mode `subscription`) **OU** `customer.subscription.updated` qui correspond a un user de role `accompagne` dont l abonnement bascule en `status='active'` ou `'trialing'`, le serveur appelle `generateCodeForUserSystem(user.id)`. Une row `parrainages_codes` est creee avec `compteur_confirmes=0`, `total_recompenses=0`. La fonction est idempotente : si une row existe deja pour ce `user_id`, elle retourne `{ code, created: false }` sans erreur (cf. `lib/parrainage-codes.ts:29-62`).

2. **AC2 -- Idempotence stricte sur re-activation** : un accompagne qui resilie puis reactive son abonnement ne declenche pas de regeneration de code. L appel `generateCodeForUserSystem` retourne `created: false`, **aucun email "bienvenue parrain" n est renvoye**, et **aucun nouveau log `notifications_log` de type `parrainage_bienvenue` n est insere**. La garde idempotence repose sur le flag `created` retourne par la fonction (cf. `app/actions/admin.ts:225` precedent pattern `validateAccompagnante`).

3. **AC3 -- Envoi email bienvenue parrain a 1ere creation uniquement** : si `created === true`, l email de bienvenue parrain est envoye via `after(async () => { ... })` (non-bloquant, post-reponse) en reutilisant la fonction `sendParrainageBienvenueMarraine` existante. Le log `notifications_log` est insere par la fonction email elle-meme (type `parrainage_bienvenue`). Aucune duplication de log : `logNotification` gere deja le partial UNIQUE INDEX `notifications_log_unique_sent_by_hour` avec silent-skip 23505 (story 7.A.6, cf. `lib/notifications-log.ts:62-80`).

4. **AC4 -- Branche role-aware sans collision avec accompagnant** : la nouvelle branche genese accompagne ne se declenche QUE si `users.role === 'accompagne'`. Pour un user `accompagnant`, le comportement existant est strictement inchange : la genese du code accompagnant continue de se faire dans `validateAccompagnante` (admin valide) cf. `app/actions/admin.ts:216-232`, **pas** dans le webhook Stripe. Pour un user `admin`, aucune genese (defensive). La verification du role se fait via un SELECT `users.role` dans la branche webhook avant l appel a `generateCodeForUserSystem`.

5. **AC5 -- Pas de genese si abonnement non actif** : un signup accompagne suivi d un echec de paiement (`status='incomplete'`, `'incomplete_expired'`, `'past_due'`) ne declenche aucune genese de code. La condition explicite est `status IN ('active','trialing')`. Verifie via test integration `accompagne signup payment_failed -> no parrainages_codes row`.

6. **AC6 -- Compatibilite alias `sendParrainageBienvenueParrain` 8.C.3** : la story 8.A.1 utilise **`sendParrainageBienvenueMarraine`** (nom actuel). La story 8.C.3 (wording neutre) introduira `sendParrainageBienvenueParrain` comme nouvelle API et conservera `sendParrainageBienvenueMarraine` en alias retro-compatible 1 release. **Si 8.C.3 est mergee avant 8.A.1**, le dev 8.A.1 doit basculer sur `sendParrainageBienvenueParrain` (verifier la presence de la fonction au moment du dev) ; sinon conserver le nom actuel. Pas de blocage cross-story.

7. **AC7 -- Wording email reste neutre/compatible accompagne** : le corps de l email `sendParrainageBienvenueMarraine` actuel (cf. `lib/emails.ts:538-593`) mentionne "votre profil accompagnant est maintenant valide", "partagez ce code avec un accompagnant de votre reseau professionnel" et redirige vers `/accompagnant/dashboard`. **Le contenu doit etre adapte pour un accompagne** : (a) condition sur le `role` du destinataire OU (b) creation d une variante `sendParrainageBienvenueAccompagne` dediee. **Decision : creer une nouvelle fonction `sendParrainageBienvenueAccompagne` dans `lib/emails.ts`** qui :
   - sujet : "Votre code de parrainage roxanetnous"
   - titre : "Bienvenue dans le programme parrainage, {firstName}"
   - corps : explique que tout accompagne abonne peut inviter un accompagnant, mentionne le bypass visio pour le filleul, mentionne les 6 mois offerts a 5 parrainages confirmes, CTA vers `/accompagne/parrainage`
   - type log : `parrainage_bienvenue` (meme cle qu accompagnant pour cohesion stats)
   - **Wording masculin neutre obligatoire** (regle CLAUDE.md durcie) : "parrain", "filleul", "accompagnant" (jamais "marraine"/"filleule"/"accompagnante")

8. **AC8 -- Test integration scenario role accompagne** : ajouter dans `tests/integration/` (ou path equivalent existant) un test qui mocke un event Stripe `customer.subscription.updated` avec un user `accompagne`, verifie l INSERT dans `parrainages_codes`, verifie l envoi de l email via mock `resend` (compteur d appels), et verifie l idempotence en rejouant le meme event 2 fois (table `stripe_events_processed` filtre + idempotence applicative). Note : si l infra test integration n est pas encore en place pour le webhook (la story 8.A.4 cadre la suite complete), un test unitaire ciblant uniquement la fonction extraite (cf. AC9 ci-dessous) est acceptable en livraison 8.A.1 ; la story 8.A.4 couvrira l end-to-end.

9. **AC9 -- Architecture : fonction helper isolable** : la logique de genese code accompagne doit etre extraite dans un helper testable independamment du switch webhook. Pattern propose : ajouter dans `lib/parrainage-codes.ts` (ou nouveau fichier `lib/parrainage-genesis.ts`) une fonction `triggerAccompagneCodeGenesisIfEligible({ supabase, userId, status })` qui : (1) verifie `status IN ('active','trialing')`, (2) lookup `users.role === 'accompagne'`, (3) appelle `generateCodeForUserSystem`, (4) si `created`, declenche l email via `after()`. Le webhook appelle ce helper depuis 2 endroits (cas `checkout.session.completed` apres upsert subscription + cas `customer.subscription.updated` apres update). La fonction retourne `{ codeCreated: boolean, code?: string }` ou `null` (utilisateur non eligible / ineligible / erreur silencieuse).

10. **AC10 -- Pas de regression `parrainages_codes` accompagnant** : aucune modification du flux existant `validateAccompagnante -> generateCodeForUserSystem -> sendParrainageBienvenueMarraine` dans `app/actions/admin.ts:196-237`. La table `parrainages_codes` continue d accepter les rows accompagnants sans changement. Audit grep `validateAccompagnante` confirme zero modification de cette server action.

11. **AC11 -- Idempotence event Stripe respectee** : la genese du code se fait DANS le bloc `try { switch (event.type) { ... } } catch` du webhook (cf. `app/api/webhooks/stripe/route.ts:514-857`). Le claim idempotence `stripe_events_processed` (UNIQUE event_id) protege deja les rejeux : si un crash survient apres l INSERT `parrainages_codes` mais avant le retour 200, le rollback `DELETE FROM stripe_events_processed WHERE event_id = ?` permet a Stripe de rejouer. La 2eme tentative trouvera la row `parrainages_codes` existante grace au `maybeSingle()` interne de `generateCodeForUserSystem` -> `created: false` -> pas de re-email. Pattern verifie dans le test AC8.

12. **AC12 -- Observabilite Sentry sur echec genese** : si `generateCodeForUserSystem` retourne `{ error: ... }`, capturer un event Sentry `tags={flow:'parrainage', signal:'genese-accompagne-failed', severity:'warning'}` avec extra `{userId, status}`. Le webhook continue son flux normalement (non-bloquant pour le upsert subscription). Si l envoi email throw, captureException dans le `catch` du `after()` mais ne re-throw pas (pattern existant `validateAccompagnante`).

## Tasks / Subtasks

- [x] **T1 -- Creer fonction email `sendParrainageBienvenueAccompagne`** (AC: #3, #7)
  - [x] T1.1 -- Dans `lib/emails.ts` apres `sendParrainageBienvenueMarraine` (ligne 593), creer `sendParrainageBienvenueAccompagne(params: { email, firstName, code, userId? })`
  - [x] T1.2 -- Sujet : "Votre code de parrainage roxanetnous"
  - [x] T1.3 -- Corps adapte : "Bienvenue dans le programme parrainage, {firstName}", explication 6 mois offerts a 5 parrainages, mention bypass visio pour le filleul accompagnant, CTA `/accompagne/parrainage`
  - [x] T1.4 -- `logNotification({ userId, email, type: 'parrainage_bienvenue', subject, status: 'sent' })` apres `resend.emails.send`
  - [x] T1.5 -- Catch erreur Resend -> `logNotification` avec `status: 'error'` (meme pattern que `sendParrainageBienvenueMarraine`)
  - [x] T1.6 -- Wording strictement masculin neutre (regle CLAUDE.md), pas d emoji

- [x] **T2 -- Creer helper `triggerAccompagneCodeGenesisIfEligible`** (AC: #1, #4, #5, #9, #12)
  - [x] T2.1 -- Extension de `lib/parrainage-codes.ts` (decision recommandee, evite sprawl)
  - [x] T2.2 -- Signature `triggerAccompagneCodeGenesisIfEligible(params: { userId, status }): Promise<{ codeCreated, code? } | null>`
  - [x] T2.3 -- Early return `null` si `status NOT IN ('active','trialing')`
  - [x] T2.4 -- SELECT `users.role, email, first_name` via `createClient({ serviceRole: true })`
  - [x] T2.5 -- Early return `null` si `role !== 'accompagne'`
  - [x] T2.6 -- Appel `generateCodeForUserSystem` ; si `error`, capture Sentry `genese-accompagne-failed` warning + return `null`
  - [x] T2.7 -- Si `created === true`, declenchement `sendParrainageBienvenueAccompagne` via `after(async () => { ... })` avec try/catch + Sentry warning sur echec
  - [x] T2.8 -- Return `{ codeCreated, code }`
  - [x] T2.9 -- Module sans directive `'use server'` (heritage `lib/parrainage-codes.ts:22-23`)

- [x] **T3 -- Hook dans `checkout.session.completed`** (AC: #1, #11)
  - [x] T3.1 -- Appel `await triggerAccompagneCodeGenesisIfEligible({ userId, status: 'active' })` apres upsert subscription
  - [x] T3.2 -- Pas de try/catch supplementaire (helper defensif + try/catch global C1 du webhook)
  - [x] T3.3 -- `break` final preserve, email confirmation subscription inchange

- [x] **T4 -- Hook dans `customer.subscription.updated`** (AC: #1, #2, #11)
  - [x] T4.1 -- Appel `await triggerAccompagneCodeGenesisIfEligible({ userId: existing.user_id, status: updateData.status as string })` apres update subscription
  - [x] T4.2 -- `updateData.status` (mapping Stripe `canceled` -> BDD `cancelled` preserve)
  - [x] T4.3 -- `captureParrainageFingerprint` inchange (orthogonal au parrainage parrain)

- [x] **T5 -- Tests unitaires (6 scenarios)** (AC: #8, #2)
  - [x] T5.1 -- Fichier `tests/unit/parrainage-codes-genesis.test.ts` (acceptable selon AC8 : 8.A.4 cadrera l end-to-end)
  - [x] T5.2 -- 5 scenarios obligatoires + 1 bonus :
    1. accompagne + status='active' -> code cree + email envoye une fois (`created: true`) [OK]
    2. accompagne + status='active' rejoue -> `created: false`, 0 nouvel email [OK]
    3. accompagne + status='incomplete' -> `null`, aucun lookup BDD [OK]
    4. accompagnant + status='active' -> `null`, aucune genese [OK]
    5. user inexistant -> capture Sentry warning + `null` [OK]
    6. (bonus) status=`trialing` egalement eligible [OK]
  - [x] T5.3 -- `sendParrainageBienvenueAccompagne` mocke + assert compteur d appels
  - [x] T5.4 -- Client Supabase mocke (chainable users/parrainages_codes), `after()` mocke pour execution synchrone

- [x] **T6 -- Documentation et coherence cross-story** (AC: #6, #10)
  - [x] T6.1 -- Commentaire en tete de `triggerAccompagneCodeGenesisIfEligible` (3 couches idempotence + reference Epic 8 stories 8.A.1/8.B.1)
  - [x] T6.2 -- Entree ajoutee en tete `deferred-work.md` : bascule `sendParrainageBienvenueMarraine` -> `sendParrainageBienvenueParrain` differee a 8.C.3 + note non-applicable a `sendParrainageBienvenueAccompagne` (neutre des creation)
  - [x] T6.3 -- `git diff --stat app/actions/admin.ts` -> zero modification confirme

### Review Findings

- [x] [Review][Decision] **F2 — Signature helper sans paramètre `supabase` (AC9)** — Dismissé : T2.2 fait autorité sur AC9, écart documenté.
- [x] [Review][Decision] **F6 — `lib/emails.ts` a `'use server'` et est importé depuis un module plain** — Dismissé : build Next.js validé par dev-agent, comportement conforme App Router.
- [x] [Review][Patch] **F1 — `checkout.session.completed` passe `status: 'active'` en dur** [app/api/webhooks/stripe/route.ts:551] — Fixé : `subscriptionResponse.status` utilisé à la place du literal `'active'`.
- [x] [Review][Patch] **F3 — `first_name: null` produit un greeting avec virgule traînante** [lib/emails.ts:616] — Fixé : greeting conditionnel `params.firstName ? \`, ${escapeHtml(params.firstName)}\` : ''`.
- [x] [Review][Patch] **F5 — `email: ''` (string vide) silencieux** [lib/parrainage-codes.ts:114] — Fixé : branche séparée avec capture Sentry `genese-accompagne-email-skipped` quand `created && !email`.
- [x] [Review][Patch] **F7 — `updateData.status as string` masque `undefined`** [app/api/webhooks/stripe/route.ts:729] — Fixé : `typeof updateData.status === 'string' ? updateData.status : ''`.
- [x] [Review][Defer] **F4 — Type log `parrainage_bienvenue` partagé entre accompagné et accompagnant** [lib/emails.ts] — deferred, pré-existant dans `sendParrainageBienvenueMarraine`. Analytics ambigus (impossible de distinguer les deux roles en SQL sans JOIN users). À adresser lors du renommage global 8.C.3.
- [x] [Review][Defer] **F8 — Sentry `tags.severity='warning'` sans `level: 'warning'`** [lib/parrainage-codes.ts] — deferred, pattern pré-existant dans tout le webhook. Les alertes remontent en level `error` par défaut. À aligner sur la convention Sentry globale dans un hardening dédié.
- [x] [Review][Defer] **F9 — 3 clients Supabase serviceRole ouverts par appel genesis** [lib/parrainage-codes.ts + lib/parrainage-codes.ts:generateCodeForUserSystem] — deferred, conception actuelle de `generateCodeForUserSystem` (pré-existant). Refactoriser pour accepter un client injecté dans un epic perf dédié.
- [x] [Review][Defer] **F10 — Genesis appelée sur chaque renouvellement mensuel** [app/api/webhooks/stripe/route.ts:727] — deferred, accepté par spec (l'idempotence layer 2 court-circuite sans effet secondaire). Optimisation possible : early-exit si row existe déjà avant le lookup users. À évaluer sous charge réelle.
- [x] [Review][Defer] **F11 — Chemin retry 23505 non couvert par le mock test** [tests/unit/parrainage-codes-genesis.test.ts] — deferred, le mock `insertOk: false` utilise code `'XXOTHER'`, pas `'23505'`. La branche retry de `generateCodeForUserSystem` reste non testée. À couvrir en 8.A.4 (tests E2E webhook).

- [ ] **T7 -- Validation manuelle Stripe test mode** (AC: #1, #2, #11) -- **A executer par Sylvain post-merge**
  - [ ] T7.1 -- Stripe CLI/Dashboard test mode : signup `accompagne` complet (signup -> checkout -> webhook)
  - [ ] T7.2 -- Verifier `parrainages_codes` (user_id, compteur_confirmes=0) via MCP Supabase
  - [ ] T7.3 -- Verifier `notifications_log` (type='parrainage_bienvenue', status='sent')
  - [ ] T7.4 -- `stripe events resend <event_id>` : aucune nouvelle row (idempotence stripe_events_processed + maybeSingle + silent-skip 23505)

## Dev Notes

**Contexte metier :** Cette story est la PREMIERE story d ecriture de l Epic 8 (apres l audit BDD 8.A.0 lecture seule). Elle bootstrap la capacite parrainage cote BDD pour les accompagnes : sans code genere, la page `/accompagne/parrainage` (8.B.1) n a rien a afficher et le path validateCode 8.A.2 n a pas de seed. C est donc le point d entree mecanique du flux parrainage symetrique.

**Pourquoi le webhook Stripe et pas le signup direct :** decision F-Epic8-A0 cadrage 2026-05-16 -- la genese se fait a la **1ere transition status='active' (ou 'trialing')** parce qu un accompagne sans abonnement ne peut pas etre parrain (regle metier FR49). Le webhook est l unique source de verite serveur pour l etat Stripe ; le signup n a pas encore d info de souscription (le checkout suit). Implementer cote signup creerait une race condition + des codes orphelins pour les signups avortes.

**Symetrie avec accompagnant :** pour les accompagnants, la genese se fait dans `validateAccompagnante` apres validation admin (cf. `app/actions/admin.ts:196-237`). Pourquoi pas le meme path pour accompagne ? Parce qu il n y a **pas de validation manuelle accompagne** (l accompagne se valide via paiement Stripe direct, pas par OCR + visio). Le webhook joue le role de "moment de validation business" pour cette population.

**Idempotence -- 3 couches imbriquees :**
1. **Stripe level** : `stripe_events_processed.event_id` UNIQUE bloque le rejeu d un event id strictement identique (cf. webhook ligne 487-507)
2. **Application level** : `generateCodeForUserSystem` filtre via `maybeSingle()` sur `parrainages_codes.user_id` PK, retourne `created: false` si row existe (cf. `lib/parrainage-codes.ts:33-38`)
3. **Notification level** : `logNotification` filtre via partial UNIQUE INDEX `notifications_log_unique_sent_by_hour` sur `(user_id, email, type, subject, hour)`, silent-skip 23505 (cf. `lib/notifications-log.ts:62-80`, story 7.A.6 F-Epic7-A6)

**Pourquoi creer `sendParrainageBienvenueAccompagne` plutot que reutiliser `sendParrainageBienvenueMarraine` avec une branche role :** le corps de l email actuel parle de "votre profil accompagnant est maintenant valide" et lie vers `/accompagnant/dashboard`. Pour un accompagne, ce message est faux et le lien casse. Une fonction dediee est plus claire qu une branche conditionnelle imbriquee. Le type de log reste identique (`parrainage_bienvenue`) pour conserver la coherence des stats parrainage cross-role.

**Wording neutre obligatoire :** la regle CLAUDE.md durcie impose le masculin neutre dans toute nouvelle copy UI. La nouvelle fonction email ne doit JAMAIS contenir "marraine"/"filleule"/"accompagnante". Cette story est aussi l occasion de valider que le pattern propose pour 8.C.3 fonctionne (alias retro-compat sans casser les callers).

**Code serveur de reference :**
- `app/api/webhooks/stripe/route.ts:460-890` -- webhook complet (idempotence event + switch cases)
- `app/api/webhooks/stripe/route.ts:514-679` -- `checkout.session.completed` (upsert subscription + parrainage filleul + email confirm)
- `app/api/webhooks/stripe/route.ts:681-747` -- `customer.subscription.updated` (update subscription + capture fingerprint parrainage filleul)
- `lib/parrainage-codes.ts:29-62` -- `generateCodeForUserSystem` (idempotent, retourne `created: boolean`)
- `app/actions/admin.ts:196-237` -- `validateAccompagnante` (pattern de reference pour genese accompagnant)
- `lib/emails.ts:538-593` -- `sendParrainageBienvenueMarraine` (template a adapter pour accompagne)
- `lib/notifications-log.ts:35-96` -- `logNotification` (idempotence partial UNIQUE INDEX + UUID validation)

**Audit BDD confirme (F-Epic8-A0) :**
- `parrainages_codes` accepte un `user_id` accompagne sans CHECK constraint (PK + FK CASCADE)
- `subscriptions.user_id` UNIQUE -> `.maybeSingle()`
- Enum `subscription_status` 4 valeurs : `active`, `cancelled` (double L), `past_due`, `trialing` -- filtrer sur `active`/`trialing` uniquement
- Enum `user_role` 3 valeurs : `accompagnant`, `accompagne`, `admin`
- Aucune RLS ne discrimine le role parrain

**Garde-fou anti-collision avec validateAccompagnante :** le webhook se declenche au paiement Stripe ; `validateAccompagnante` se declenche a la validation admin (apres OCR + visio). Pour un accompagnant, l ordre theorique est : signup -> abonnement Stripe (webhook : pas de genese car `role='accompagnant'` filtre la branche accompagne) -> validation admin (`validateAccompagnante` cree le code). Si demain un accompagnant souscrit AVANT d etre valide (cas que la regle metier evite mais que la BDD permet), la branche webhook ne creera pas de code car le filtre `role='accompagne'` est strict. **Aucun risque de double creation.**

**Garde-fou Sentry :** la genese accompagne est consideree comme **best-effort** : un echec ne doit pas bloquer le upsert subscription ni l email confirm. La capture Sentry severity `warning` permet de detecter les anomalies sans page critique (oncall). Si demain un volume anormal de `genese-accompagne-failed` apparait, l audit BDD pourra confirmer si c est un bug applicatif (mauvais role lookup) ou un probleme infra (timeout Supabase).

**Outils a utiliser :**
1. `Read` sur `app/api/webhooks/stripe/route.ts`, `lib/parrainage-codes.ts`, `app/actions/admin.ts`, `lib/emails.ts`
2. `Edit` sur les memes fichiers pour les modifications ciblees
3. `Write` si extraction nouveau fichier `lib/parrainage-genesis.ts` (decision T2.1)
4. Pas de MCP Supabase necessaire en ecriture (decision F-Epic8-A0 GO sans migration)
5. Validation manuelle Stripe via `stripe trigger` ou Stripe Dashboard test mode (T7)

**Patterns precedents :**
- Story 7.A.6 (idempotence logNotification, F-Epic7-A6) : le pattern silent-skip 23505 + breadcrumb Sentry est la reference pour les inserts notifications idempotents
- Story 4.2/4.3 (schema notifications_log F5/F6/F7) : la table notifications_log est cle metier pour traquer les emails parrainage cross-role
- Story 7.A.11 (lint CI bloquant INSERT direct notifications_log) : tout INSERT dans notifications_log doit passer par le helper `logNotification`. La nouvelle fonction `sendParrainageBienvenueAccompagne` respecte ce contrat via `logNotification`.

### Project Structure Notes

- **Fichiers modifies** :
  - `app/api/webhooks/stripe/route.ts` (+~6 lignes : 2 appels helper dans 2 case branches)
  - `lib/parrainage-codes.ts` (+~50 lignes : nouvelle fonction helper)
  - `lib/emails.ts` (+~55 lignes : nouvelle fonction `sendParrainageBienvenueAccompagne`)
- **Fichier de test cree** : `tests/unit/parrainage-codes.test.ts` (ou path equivalent selon convention projet, scenario T5)
- **Fichier potentiellement cree** : `lib/parrainage-genesis.ts` (alternative T2.1 -- decision dev, recommandation = extension de `lib/parrainage-codes.ts`)
- **Fichiers NON modifies** (verifier zero diff apres commit) :
  - `app/actions/admin.ts` (path accompagnant intact)
  - `app/actions/parrainage.ts` (path validateCode et createParrainageRelation a modifier en 8.A.2, hors-scope 8.A.1)
- **Story suivante 8.A.2** : `validateCode` + `createParrainageRelation` + guards. Depend de 8.A.1 pour avoir des rows `parrainages_codes` accompagne en BDD.
- **Story 8.B.1 page `/accompagne/parrainage`** : depend de 8.A.1 pour avoir un code a afficher.

### References

- [Source: epic-8.md#Story 8.A.1] -- spec complete AC et contexte metier
- [Source: epic-8.md#AR-E8.7] -- webhook Stripe genese code accompagne specification architecture
- [Source: epic-8.md#FR49] -- exigence fonctionnelle code parrainage accompagne unique et idempotent
- [Source: epic-8.md#AR-E8.10] -- rename `sendParrainageBienvenueMarraine` -> `sendParrainageBienvenueParrain` (story 8.C.3, alias retro-compat 1 release)
- [Source: DECISIONS.md#F-Epic8-A0] -- audit BDD GO sans migration, invariants 4 invariants documentes
- [Source: _bmad-output/implementation-artifacts/audit-bdd-parrainage-symetrique-2026-05-16.md] -- DDL detaillee + RLS + indexes
- [Source: app/api/webhooks/stripe/route.ts:460-890] -- webhook structure idempotence + cases
- [Source: app/actions/admin.ts:196-237] -- pattern de reference genese code accompagnant via `validateAccompagnante`
- [Source: lib/parrainage-codes.ts:29-62] -- `generateCodeForUserSystem` idempotent
- [Source: lib/emails.ts:538-593] -- `sendParrainageBienvenueMarraine` template a adapter
- [Source: lib/notifications-log.ts:35-96] -- `logNotification` idempotent silent-skip 23505
- [Source: DECISIONS.md#F-Epic7-A6] -- pattern idempotence notifications_log (story 7.A.6)
- [Source: DECISIONS.md#F-Epic7-A11] -- garde-fou CI INSERT direct notifications_log (story 7.A.11)

## Dev Agent Record

### Agent Model Used

claude-opus-4-7 (Opus 4.7 1M context) via bmad-dev-story workflow.

### Debug Log References

- `npm run test:unit` -- 71/71 tests passes (dont 6 nouveaux `parrainage-codes-genesis`).
- `npm run lint` -- 0 errors (194 warnings preexistants hors scope).
- `npx tsc --noEmit` -- TypeScript compilation OK.
- `npm run check:no-direct-notifications-log-insert` -- garde-fou Epic 7 A.11 satisfait (nouvelle fonction email passe par `logNotification`).
- `npx next build` -- build complet OK (toutes routes, dont `app/api/webhooks/stripe`).

### Completion Notes List

- **Decision T2.1 :** extension de `lib/parrainage-codes.ts` (option recommandee) -- pas de nouveau fichier `lib/parrainage-genesis.ts` cree, le helper reste co-localise avec `generateCodeForUserSystem`. Imports ajoutes : `next/server.after`, `@sentry/nextjs` (captureException), `@/lib/emails.sendParrainageBienvenueAccompagne`.
- **AC6 wording neutre :** la story livre directement `sendParrainageBienvenueAccompagne` (nouveau nom, neutre des creation). La fonction historique `sendParrainageBienvenueMarraine` n'est pas modifiee (path accompagnant intact, audit `git diff --stat app/actions/admin.ts` zero ligne). Bascule vers `sendParrainageBienvenueParrain` deferree a 8.C.3 (entree ajoutee `deferred-work.md`).
- **AC8 :** test integration end-to-end report a 8.A.4 (decision documentee dans la story et dans `deferred-work.md`). Couverture unitaire 6 scenarios (5 obligatoires + bonus `status=trialing`) satisfait le critere minimal AC8 dernier paragraphe.
- **AC9 helper isolable :** signature `{ userId, status }` -> `{ codeCreated, code? } | null`. Pas de directive `'use server'` (module reste neutre, exportable depuis lib).
- **AC12 Sentry :** 2 points de capture warning :
  - `genese-accompagne-failed` (user lookup ou generateCodeForUserSystem erreur)
  - `genese-accompagne-email-failed` (echec envoi email dans le `after()`)
- **Symetrie avec validateAccompagnante :** comportement strictement symetrique cote idempotence (`created: true/false`) mais source different (webhook vs action admin), filtre `role === 'accompagne'` strict pour garantir zero collision (AR-E8.7).
- **T7 manuel report :** la validation Stripe test mode requiert Stripe CLI installee + Stripe test mode config -- a executer par Sylvain post-merge avant go-live Epic 8.

### File List

**Fichiers modifies :**
- `lib/emails.ts` -- ajout fonction `sendParrainageBienvenueAccompagne` (+58 lignes)
- `lib/parrainage-codes.ts` -- ajout helper `triggerAccompagneCodeGenesisIfEligible` + imports `after`/`Sentry`/`sendParrainageBienvenueAccompagne` (+75 lignes)
- `app/api/webhooks/stripe/route.ts` -- import `triggerAccompagneCodeGenesisIfEligible` + 2 appels (case `checkout.session.completed` apres upsert + case `customer.subscription.updated` apres update) (+15 lignes)
- `_bmad-output/implementation-artifacts/deferred-work.md` -- entree 8.A.1 (bascule wording 8.C.3 + test E2E 8.A.4)

**Fichier cree :**
- `tests/unit/parrainage-codes-genesis.test.ts` -- 6 scenarios (5 AC + 1 bonus trialing) (+200 lignes)

**Fichiers verifies NON modifies (zero diff) :**
- `app/actions/admin.ts` (path accompagnant intact via `validateAccompagnante`)
- `app/actions/parrainage.ts` (path validateCode/createParrainageRelation reserve a 8.A.2)

## Change Log

- 2026-05-17 -- Story 8.A.1 implementee : genese code parrainage accompagne sur webhook Stripe (checkout.session.completed + customer.subscription.updated). 3 fichiers modifies + 1 test cree. 71/71 tests verts. Status passe a `review`.

## DoD a11y

N/A -- story sans impact UI (webhook serveur + email template HTML envoye via Resend). La page `/accompagne/parrainage` qui beneficiera de cette genese fera l objet de l audit a11y complet dans la story 8.B.1.
