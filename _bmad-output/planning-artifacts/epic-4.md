---
stepsCompleted: []
inputDocuments:
  - prd.md
  - ../../DECISIONS.md
  - ../implementation-artifacts/epic-3-retro-2026-05-07.md
  - ../implementation-artifacts/deferred-work.md
  - epic-3.md
workflowType: 'epic'
classification:
  projectType: web_app
  domain: general
  complexity: medium
epicNumber: 4
epicTheme: 'Hardening pre-go-live Bretagne'
created: '2026-05-07'
status: 'a cadrer formellement (sprint planning suivant) - 4 stories ordre 1 bloquantes go-live, 7 stories ordre 2 differees'
---

# Epic 4 : Hardening pre-go-live Bretagne

## Vision

Lever les 4 dettes critiques identifiees par la retrospective Epic 3 (`epic-3-retro-2026-05-07.md`) qui bloquent le go-live Bretagne pilote : visibilite erreurs prod (Sentry), tests automatises sur flux argent (Stripe webhook + paywall), fiabilite envoi email a la montee en charge (queue durable), et solidite des invariants BDD transverses (`logNotification` schema drift). Une fois ces 4 stories ordre 1 livrees, le toggle admin du premier departement Bretagne en production est autorise.

Sept axes complementaires (ordre 2) sont cadres dans cet epic pour solder progressivement les dettes Epic 2/3 sans bloquer le lancement.

**Decisions de reference** : `DECISIONS.md` 2026-05-07 (F1-F5 Epic 3), retrospective Epic 3 (4 AI bloquants AI-3.1 a AI-3.4 + 7 AI differes AI-3.5 a AI-3.11).

**FR/NFR couverts** : NFR fiabilite (visibilite erreurs, queue durable), NFR securite (rate-limit oracle d'enumeration), NFR testabilite (tests metier critiques), NFR maintenabilite (types stricts, schema BDD).

## Pre-requis avant demarrage sprint

- DECISIONS.md F1-F5 actees (fait 2026-05-07).
- Retrospective Epic 3 livree (fait 2026-05-07).
- Sprint-status Epic 4 cadre (cette etape).
- Verifier compte Sentry actif ou choisir alternative observabilite (Vercel Observability, Logtail, etc.) avant story 4.1.
- Choisir solution queue durable (Vercel Workflow DevKit prefere, Vercel KV polling, ou job runner externe) avant story 4.3.

## Story List

### Stories ordre 1 - BLOQUANTES go-live Bretagne

| # | Titre | Statut | Origine retro Epic 3 | Severite |
|---|---|---|---|---|
| 4.1 | Alerting Sentry transverse + rate-limit `validateCode` parrainage | a faire | AI-3.4 | Orange |
| 4.2 | Fix schema `logNotification` transversal (`user_id NULLABLE` + `type ENUM`) | a faire | AI-3.1 | Rouge |
| 4.3 | Email queue durable (Vercel Workflow DevKit) | a faire | AI-3.3 | Orange |
| 4.4 | Tests metier critiques Stripe webhook + paywall | a faire | AI-3.2 | Rouge |

### Stories ordre 2 - DIFFEREES (non bloquantes)

| # | Titre | Statut | Origine | Severite |
|---|---|---|---|---|
| 4.5 | Hardening IP spoofing (`request.ip` Vercel) | a faire | AI-3.5 | Jaune |
| 4.6 | Resorption `as any` pages admin | a faire | AI-3.6 (candidat I) | Jaune |
| 4.7 | Seeds Supabase pour tests d'integration | a faire | AI-3.7 (candidat J) | Jaune |
| 4.8 | Separation REQUIRED vs OPTIONAL_ON_PREVIEW dans `check-required-env.mjs` | a faire | AI-3.8 | Jaune |
| 4.9 | Validation `escapeHtml` test XSS templates email | a faire | AI-3.9 (heritage Epic 2 deferred) | Jaune |
| 4.10 | OCR perfectionnement (conditionnel) | conditionnel | AI-3.10 (candidat D) | Differee |
| 4.11 | Matching UI (conditionnel) | conditionnel | AI-3.11 (candidat B) | Differee |

---

## Story 4.1 : Alerting Sentry transverse + rate-limit `validateCode` parrainage

As Sylvain (admin),
I want que toutes les erreurs prod soient remontees vers un agregateur (Sentry ou equivalent) et que la fonction `validateCode` parrainage soit protegee contre l'enumeration de codes 8 chars,
So that je puisse detecter et corriger les incidents avant qu'ils impactent les utilisateurs et empecher un attaquant de bruteforcer le pool de codes parrainage.

**Acceptance Criteria :**

**Given** un compte Sentry (ou equivalent retenu : Vercel Observability, Logtail) est configure pour le projet roxanetnous,
**When** la story est implementee,
**Then** le SDK Sentry est integre cote Next.js (`@sentry/nextjs`) avec configuration `sentry.client.config.ts` + `sentry.server.config.ts` + `sentry.edge.config.ts`,
**And** les variables d'environnement `SENTRY_DSN`, `SENTRY_ORG`, `SENTRY_PROJECT` sont configurees dans Vercel (Production + Preview).

**Given** les chemins de code critique (fraude parrainage, envoi email, blacklist, paiement Stripe webhook),
**When** une erreur est levee,
**Then** elle est capturee par `Sentry.captureException()` avec tags metier (`flow: 'parrainage' | 'email' | 'paywall' | 'webhook'`, `severity: 'critical' | 'warning'`),
**And** les `console.error` existants sont remplaces ou complementes par `Sentry.captureException()` (a minima sur 8 chemins critiques inventories : `app/api/webhooks/stripe/route.ts`, `app/actions/parrainage.ts`, `lib/parrainage-detection.ts`, `lib/emails.ts`, `app/actions/admin-parrainages.ts`, `app/actions/messages.ts`, `app/admin/parrainages/`, `app/admin/utilisateurs/`).

**Given** la server action `validateCode(code: string)` dans `app/actions/parrainage.ts`,
**When** un appel est effectue,
**Then** le pattern `try_consume_rate_limit` (RPC Postgres deja en place story 3.4) est applique avec cle `validate-code:<ip>` limite **5 tentatives par minute par IP**,
**And** au-dela, l'appel retourne une erreur `tooManyRequests` sans reveler si le code est valide ou non,
**And** un evenement Sentry est emis avec tag `flow: 'parrainage', signal: 'rate-limit-validate-code'`.

**Given** le SDK Sentry est integre,
**When** une erreur non-capturee est levee cote client (React error boundary, hydration error),
**Then** elle est automatiquement remontee a Sentry via `withSentryConfig` (configuration Next.js native).

**Notes implementation** :
- Suivre la doc officielle `@sentry/nextjs` v8+ (auto-instrumentation App Router).
- IP detection : utiliser `request.ip` Vercel API ou `x-vercel-forwarded-for` (header trusted Vercel-only). Pattern story 4.5 anticipe.
- Rate-limit : table `rate_limits` deja en place (story 3.4). RPC `try_consume_rate_limit(key text, max int, window_seconds int)` reutilisable.
- Acquit dette deferred-work Epic 2 (review 2.3 du 2026-05-04 : "validateCode expose sans rate-limit", "console.error sans alerting/Sentry partout").

**Bloquant go-live** : oui (visibilite erreurs prod requise pour debug incidents).

---

## Story 4.2 : Fix schema `logNotification` transversal

As developpeur du projet,
I want que le schema BDD du logging notifications accepte des emetteurs anonymes (`user_id NULL`) et des types d'erreur arbitraires (`type ENUM` extensible),
So that le bug latent identifie sur 15+ flows email (cron parrainage, waitlist, ouverture dpt, admin notif, reset password) soit resolu et que les notifications a destination de visiteurs anonymes puissent etre tracees correctement.

**Acceptance Criteria :**

**Given** la table `notifications_log` actuelle a `user_id UUID NOT NULL` + `CHECK status IN ('sent', 'failed', 'pending')`,
**When** une migration `<timestamp>_logNotification_schema_fix.sql` est appliquee,
**Then** la colonne `user_id` devient `UUID NULL`,
**And** la contrainte `CHECK status IN (...)` est remplacee par une colonne `type ENUM` etendue : `('sent', 'failed', 'pending', 'error', 'lost', 'retry-scheduled', 'retry-exhausted')`,
**And** les rows existantes sont conservees sans perte (migration de donnees idempotente, valeur par defaut `'sent'` ou `'failed'` selon le statut historique).

**Given** les 15+ call-sites identifies (a inventorier exhaustivement en debut de story par grep `logNotification\|notifications_log`),
**When** la story est implementee,
**Then** le workaround actuel `skip si userId undefined` est supprime,
**And** chaque call-site qui logguait un email a destination d'un visiteur anonyme passe maintenant `user_id: null` correctement,
**And** chaque call-site qui levait une erreur Resend traite (timeout, recipient invalide) appelle `logNotification({ status: 'error', user_id: ... })` au lieu de `'failed'`.

**Given** un test manuel sur un flow visiteur anonyme (waitlist confirmation depuis `/waitlist` sans login),
**When** un email de confirmation est envoye,
**Then** une ligne est inseree dans `notifications_log` avec `user_id IS NULL` + `type = 'sent'` (precedemment : insertion echouait silencieusement avec le workaround).

**Given** un audit Sentry post-deploiement (story 4.1 deja livree),
**When** la story 4.2 est livree,
**Then** zero exception type `'NOT NULL constraint'` ou `'check constraint'` ne remonte sur `notifications_log` pendant 7 jours.

**Notes implementation** :
- Inventaire exhaustif des call-sites en debut de story (estimation initiale : 15+, a verifier par grep `logNotification\|notifications_log`).
- Migration idempotente : `ALTER TABLE notifications_log ALTER COLUMN user_id DROP NOT NULL` + `ALTER TABLE notifications_log DROP CONSTRAINT notifications_log_status_check` + `ALTER TABLE notifications_log ADD COLUMN type TEXT NOT NULL DEFAULT 'sent' CHECK type IN (...)` (eventuellement avec backfill des rows existantes).
- Resoud bug latent documente dans memoire `project_logNotification_bug.md`.

**Bloquant go-live** : oui (perte de signal email sur visiteur anonyme = perte de tracabilite metier critique).

---

## Story 4.3 : Email queue durable

As developpeur du projet,
I want une queue durable pour l'envoi d'emails (waitlist confirmation, ouverture dpt, admin notif, parrainage),
So that l'ouverture du premier departement Bretagne (burst potentiel de 200+ emails) ne provoque pas de timeout 60 s sur la server action et que les emails restent envoyes meme en cas de panne Resend transitoire.

**Acceptance Criteria :**

**Given** la solution retenue est Vercel Workflow DevKit (recommandee) ou alternative documentee (Vercel KV polling, BullMQ + Upstash Redis),
**When** la story est implementee,
**Then** un workflow `sendEmailWorkflow(recipient, template, payload)` est cree avec retry automatique 3 tentatives + backoff exponentiel,
**And** les server actions waitlist (story 3.4) et toggleRegion (story 3.5) appellent `sendEmailWorkflow(...)` au lieu d'`await sendEmail(...)` (fire-and-forget durable),
**And** la duree de la server action passe de "bloquante 60 s max" a "non-bloquante <500 ms" pour les flows email.

**Given** une ouverture de departement avec 250 inscrits en waitlist,
**When** l'admin clique "Ouvrir",
**Then** la server action retourne en <500 ms,
**And** les 250 emails sont envoyes en arriere-plan via le workflow durable (peut prendre 1-2 min selon Resend rate limit, mais sans bloquer l'UI),
**And** chaque email envoye met a jour `notified_at = now()` sur sa ligne `waitlist_departements`,
**And** un email en echec apres 3 retries genere une entree `notifications_log` `type = 'retry-exhausted'` + alerte Sentry (story 4.1).

**Given** le `BATCH_LIMIT = 200` actuel + cron retry,
**When** la story 4.3 est livree,
**Then** le `BATCH_LIMIT` peut etre supprime (le workflow gere le rate limiting cote queue),
**And** le cron retry secondaire devient redondant (le workflow gere les retries) - peut etre simplifie ou supprime.

**Given** un test manuel d'ouverture de dpt en staging avec 50 inscrits seedes,
**When** la story 4.3 est livree,
**Then** la server action `toggleRegion` retourne en <1 s,
**And** les 50 emails sont envoyes dans les 30 s suivantes,
**And** zero email perdu (verification `notified_at IS NOT NULL` pour toutes les lignes seedees).

**Notes implementation** :
- Vercel Workflow DevKit (preferred) : `npm install @vercel/workflow`. Doc : https://vercel.com/docs/workflow.
- Alternative Vercel KV polling : utiliser Vercel KV comme queue + cron `app/api/cron/process-email-queue/route.ts` qui depile.
- Alternative BullMQ + Upstash Redis : Marketplace Vercel.
- Decouplage progressif des call-sites Resend : chaque call-site doit etre migre individuellement, pas big-bang.
- Coupler avec story 4.2 (schema `logNotification` etendu type `'retry-scheduled'`, `'retry-exhausted'`).

**Bloquant go-live** : oui (premiere ouverture dpt prod = burst potentiel >200 emails).

---

## Story 4.4 : Tests metier critiques Stripe webhook + paywall

As developpeur du projet,
I want une suite de tests automatises sur les flux financiers et de mise en relation critiques,
So that toute regression future sur ces flux soit detectee en CI avant merge, plutot qu'en prod par un utilisateur ou un client.

**Acceptance Criteria :**

**Given** Playwright est installe (configuration `playwright.config.ts` deja en place pour axe-core),
**When** la story est implementee,
**Then** un dossier `tests/e2e/` est cree avec sous-dossiers `tests/e2e/stripe-webhook/`, `tests/e2e/paywall/`, `tests/e2e/parrainage/`,
**And** un script `npm run test:e2e` execute les tests Playwright.

**Given** le flux Stripe webhook (`app/api/webhooks/stripe/route.ts`),
**When** la story est implementee,
**Then** **5 tests minimum** couvrent : (1) `customer.subscription.created` avec marraine valide, (2) `customer.subscription.created` avec parrainage anti-fraude flag, (3) `invoice.payment_failed` (downgrade utilisateur), (4) `customer.subscription.deleted` (suppression), (5) signature webhook invalide (rejet).

**Given** le flux paywall (server actions sensibles `sendMessage`, `getOrCreateConversation*`, publication annonce auxiliaire),
**When** la story est implementee,
**Then** **5 tests minimum** couvrent : (1) visiteur non connecte -> redirect login, (2) connecte sans abonnement -> erreur paywall, (3) abonne actif -> succes, (4) abonnement expire pendant un echange -> lecture historique OK + creation bloquee, (5) admin -> bypass paywall conversation.

**Given** la suite de tests Playwright,
**When** un PR est ouvert,
**Then** la CI Vercel execute `npm run test:e2e` automatiquement,
**And** un test rouge bloque le merge.

**Given** un seed dataset minimal (couplage story 4.7),
**When** les tests Playwright tournent,
**Then** ils utilisent le seed pour creer un utilisateur abonne, un utilisateur non abonne, une marraine, une filleule, un admin (5 fixtures minimum).

**Notes implementation** :
- Coupler avec story 4.7 (seeds Supabase) pour fixtures de tests.
- Stripe webhook : utiliser Stripe CLI `stripe trigger ...` ou mocking du webhook signature en test.
- Suite minimale 10 tests (5 Stripe + 5 paywall). Extension future a parrainage anti-fraude / matching / RGPD cascade en stories ulterieures.
- Configuration CI Vercel : ajouter `npm run test:e2e` au build command ou en deployment hook.

**Bloquant go-live** : oui (zero filet de securite sur flux argent = risque incident prod non detecte).

---

## Story 4.5 : Hardening IP spoofing

As developpeur du projet,
I want que la detection IP utilisee dans les rate-limits et les detections anti-fraude soit robuste contre le spoofing du header `x-forwarded-for`,
So that un attaquant ne puisse pas contourner les rate-limits ou empoisonner les flags anti-fraude en falsifiant son IP.

**Acceptance Criteria :**

**Given** les call-sites actuels qui lisent `x-forwarded-for` (`app/actions/parrainage.ts:60-72`, server actions waitlist 3.4, server actions paywall 3.6),
**When** la story est implementee,
**Then** chaque call-site est migre vers `request.ip` (Vercel API native) ou `x-vercel-forwarded-for` (header trusted Vercel-only),
**And** un helper `lib/get-client-ip.ts` est cree pour centraliser la logique.

**Given** un audit security manuel post-migration,
**When** la story est livree,
**Then** zero `x-forwarded-for` lu directement dans le code (verification grep).

**Notes implementation** :
- Coupler avec story 4.1 (Sentry) - les events rate-limit doivent inclure l'IP cliente verifiee.
- Reference Vercel : https://vercel.com/docs/edge-network/headers#x-forwarded-for.

**Bloquant go-live** : non (Vercel sanitize en prod, risque uniquement hors-prod).

---

## Story 4.6 : Resorption `as any` pages admin

As developpeur du projet,
I want que les pages admin (`app/admin/parrainages/page.tsx`, `app/admin/parrainages/blacklist/page.tsx`, autres pages admin contenant `as any`) soient typees correctement avec les types Supabase generes,
So that les regressions de schema BDD soient detectees a la compilation TypeScript plutot qu'au runtime.

**Acceptance Criteria :**

**Given** les types Supabase sont stables (verification via MCP `generate_typescript_types`),
**When** la story est implementee,
**Then** les types generes sont integres dans `types/supabase.ts` ou equivalent,
**And** les `as any` des pages admin sont remplaces par les types generes (verification grep `as any` post-migration sur `app/admin/`),
**And** la compilation TypeScript reste a 0 erreur.

**Notes implementation** :
- Inventaire prealable : grep `as any` sur `app/admin/` pour cadrer le perimetre.
- Generation types : `npx supabase gen types typescript --project-id <id> > types/supabase.ts`.
- Acquit candidat I de l'Epic 3 + dette deferred Epic 2.

**Bloquant go-live** : non.

---

## Story 4.7 : Seeds Supabase pour tests d'integration

As developpeur du projet,
I want un seed dataset minimal et reproductible pour Supabase local et environnement de test,
So that les tests d'integration (story 4.4) puissent s'appuyer sur des fixtures connues sans depend de l'etat de la BDD prod ou staging.

**Acceptance Criteria :**

**Given** un dossier `supabase/seeds/` est cree,
**When** la story est implementee,
**Then** un fichier `supabase/seeds/01_users.sql` cree 5 utilisateurs (1 admin, 1 abonne, 1 non-abonne, 1 marraine, 1 filleule),
**And** un fichier `supabase/seeds/02_parrainages.sql` cree 1 parrainage en cours + 1 parrainage valide,
**And** un fichier `supabase/seeds/03_waitlist.sql` cree 5 lignes waitlist seedees,
**And** un script `npm run seed:test` applique les seeds sur Supabase local.

**Given** les seeds sont stables,
**When** les tests Playwright (story 4.4) tournent,
**Then** ils utilisent les fixtures seedees pour reproductibilite.

**Notes implementation** :
- Coupler avec story 4.4 (tests E2E utilisent les seeds).
- Acquit candidat J de l'Epic 3.

**Bloquant go-live** : non (mais bloquant pour livraison story 4.4 si seeds non disponibles).

---

## Story 4.8 : Separation REQUIRED vs OPTIONAL_ON_PREVIEW dans `check-required-env.mjs`

As developpeur du projet,
I want que le script `scripts/check-required-env.mjs` distingue les variables obligatoires en production des variables optionnelles en preview,
So that les deploiements preview Vercel n'emettent plus de warnings quotidiens sur des variables non-applicables (ex : `ADMIN_NOTIFICATIONS_EMAIL`).

**Acceptance Criteria :**

**Given** le script `scripts/check-required-env.mjs` actuel emet des warnings uniformes sur toutes les variables manquantes,
**When** la story est implementee,
**Then** deux listes distinctes sont declarees : `REQUIRED` (warning + exit 1 en production) + `OPTIONAL_ON_PREVIEW` (warning silencieux en preview, warning + exit 1 en production).

**Given** un deploiement preview sans `ADMIN_NOTIFICATIONS_EMAIL`,
**When** la CI execute `check-required-env.mjs`,
**Then** aucun warning n'est emis (variable classee `OPTIONAL_ON_PREVIEW`).

**Given** un deploiement production sans `ADMIN_NOTIFICATIONS_EMAIL`,
**When** la CI execute `check-required-env.mjs`,
**Then** un warning + exit 1 est emis (variable classee `OPTIONAL_ON_PREVIEW` mais requise en production).

**Notes implementation** :
- Acquit dette emergee story 3.8 retro Epic 3.

**Bloquant go-live** : non.

---

## Story 4.9 : Validation `escapeHtml` test XSS templates email

As developpeur du projet,
I want que les templates email (`lib/emails.ts`) soient testes contre les vecteurs XSS classiques,
So that aucun email envoye ne puisse exfiltrer un script ou injecter du contenu malicieux dans le mailbox du destinataire.

**Acceptance Criteria :**

**Given** la fonction `escapeHtml(input: string)` dans `lib/emails.ts`,
**When** la story est implementee,
**Then** un test unitaire `tests/unit/escape-html.test.ts` couvre les vecteurs XSS classiques (script tag, event handler, javascript: URI, html entities double-encoded, unicode escape).

**Given** les templates email qui interpolent du contenu utilisateur (nom, prenom, message),
**When** la story est implementee,
**Then** un audit grep verifie que **toutes** les interpolations passent par `escapeHtml()` (zero `${userInput}` direct dans une template HTML).

**Notes implementation** :
- Acquit dette deferred Epic 2 (review 2.3 du 2026-05-04 : "escapeHtml dans lib/emails.ts non visible dans le diff - test XSS dedie").

**Bloquant go-live** : non (mais souhaitable pre-volume).

---

## Story 4.10 : OCR perfectionnement (conditionnel)

**Statut** : conditionnel - declenchee uniquement si croissance > 25 auxiliaires inscrites OU delai validation manuelle > 24h.

Reference : `epic-3.md` "Hors scope Epic 3 - Candidat D".

A re-cadrer si declencheur atteint.

---

## Story 4.11 : Matching UI (conditionnel)

**Statut** : conditionnel - declenchee uniquement apres 3 mois de donnees utilisateur Bretagne (re-evaluation post-go-live).

Reference : `epic-3.md` "Hors scope Epic 3 - Candidat B".

A re-cadrer si declencheur atteint.

---

## Hors scope Epic 4 - reportes Epic 5 (a definir)

- **Candidat E - Visio integration technique** : par design hors plateforme (sprint-change-proposal-2026-04-18-visio-validation). Pas de re-evaluation prevue.
- **Tests parrainage anti-fraude / matching / RGPD cascade** : extension de la suite Playwright story 4.4 a ces flux, post-go-live Bretagne.
- **CMP granulaire** : si introduction future d'analytics, retargeting ou partenaires tiers a finalite commerciale (cf. decision 2026-05-07 RGPD).
- **Sentry coupling avec PagerDuty/Slack alerts** : automatisation alertes oncall, post-stabilisation Bretagne.

## Definition de "Done" Epic 4

Epic 4 est cloture quand :

1. Les 4 stories ordre 1 (4.1, 4.2, 4.3, 4.4) sont en statut `done` (commits livraison + cloture apres CI verte selon convention Lot C).
2. Les 5 stories ordre 2 non conditionnelles (4.5, 4.6, 4.7, 4.8, 4.9) sont en statut `done`. **OU** explicitement reportees Epic 5 avec justification documentee.
3. Sentry (ou equivalent) emet zero exception non-attendue sur 7 jours consecutifs en production.
4. Suite Playwright `npm run test:e2e` execute 10+ tests verts en CI sur chaque PR.
5. Schema `logNotification` aligne sur `user_id NULLABLE` + `type ENUM` etendu, zero workaround `skip si userId undefined` dans le code.
6. Email queue durable operationnelle, server actions waitlist + ouverture dpt non-bloquantes (<500 ms).
7. Retrospective Epic 4 livree (`epic-4-retro-YYYY-MM-DD.md`).
8. **Toggle admin du premier departement Bretagne en production autorise** (deblocage go-live).

## Indicateurs de succes post-Epic 4 (a mesurer 30 jours apres go-live Bretagne)

- Sentry exception rate < 0,1 % des requetes prod.
- Tests Playwright : 100 % verts sur main, < 1 flaky par semaine.
- `notifications_log` : zero entree `type = 'retry-exhausted'` (queue durable absorbe les retries).
- Server action `toggleRegion` : p95 < 1 s meme avec 200+ inscrits seedes.
- Zero rate-limit `validateCode` declenche par un utilisateur legitime (< 5 tentatives/min/IP).

---

## Estimation effort

Pas d'estimation chiffree (cf. convention projet retro Epic 3, Epic 2). Sequencage recommande :

1. **Story 4.1** Sentry + rate-limit `validateCode` -> debloque la visibilite, prerequis pour les autres.
2. **Story 4.7** Seeds Supabase -> prerequis pour story 4.4 tests.
3. **Story 4.2** Fix schema `logNotification` -> fondement pour story 4.3 (queue utilise types etendus).
4. **Story 4.3** Email queue durable -> remplace les workarounds 3.4/3.5.
5. **Story 4.4** Tests metier -> filet de securite avant go-live.
6. **Stories 4.5, 4.6, 4.8, 4.9** parallelement ou apres go-live selon urgence.
7. **Stories 4.10, 4.11** conditionnelles, non planifiees.

Apres livraison stories 4.1-4.4 + 4.7 : **go-live Bretagne pilote autorise**.
