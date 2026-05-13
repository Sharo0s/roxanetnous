---
stepsCompleted: [recensement-candidats-2026-05-13, arbitrage-scope-2026-05-13]
checkpointReviews: []
inputDocuments:
  - prd.md
  - epic-6.md
  - ../implementation-artifacts/epic-6-retro-2026-05-13.md
  - ../implementation-artifacts/epic-5-retro-2026-05-13.md
  - ../implementation-artifacts/deferred-work.md
  - ../../DECISIONS.md
workflowType: 'epic'
classification:
  projectType: web_app
  domain: general
  complexity: medium
epicNumber: 7
epicTheme: 'Hardening securite + RGPD retention + tests E2E Playwright'
created: '2026-05-13'
status: 'a cadrer (scope arbitre, stories a detailler avant execution)'
parentSkill: 'bmad-create-epics-and-stories'
---

# Epic 7 : Hardening securite + RGPD retention + tests E2E

## Vision

Trois objectifs paralleles, **aucun bloquant go-live Bretagne** (deja confirme par Epic 5 et Epic 6) :

1. **Hardening securite transverse (7.A)** : solder ~11 dettes de robustesse identifiees par les reviews code Epic 3 et Epic 4 (oracle role messagerie, robustesse `hasActiveSubscription`, durcissement `check-required-env`, idempotence `logNotification`, CHECK XOR `admin_actions_log`, N+1 admin messages, etc.). Items dispersés depuis 2 mois dans `deferred-work.md` et action items Epic 4 / Epic 6 retro.

2. **Conformite RGPD retention donnees (7.B)** : formaliser la politique de retention (DECISIONS.md) puis livrer les crons de purge / anonymisation pour `notifications_log` (PII visiteurs anonymes), `parrainages.ip_inscription` et `waitlist_departements.ip_inscription`. Obligation legale CNIL avant prise de trafic.

3. **Infra E2E Playwright + 3 scenarios applicatifs (7.C)** : creer l'infra E2E qui n'a jamais ete livree (decouverte audit Epic 6 : la story 4.4 avait livre Vitest integration, pas Playwright fonctionnel) puis ecrire les 3 scenarios anti-fraude / RGPD / matching. Reporte formellement de Epic 6 par decision `F-Epic6-D` avec scope clarifie.

**Niveau de risque** : majoritairement **hardening / dette technique**, pas de nouvelles fonctionnalites metier. 1 mini-epic legal-sensible (7.B). 1 mini-epic infrastructurel (7.C).

---

## Pre-requis et conditions de demarrage

- Aucune dependance bloquante issue d'Epic 6 (clos 2026-05-13).
- Audits calendrier 5.D / 6.E (`notify-waitlist-retry` cron + `BATCH_LIMIT=200` send-waitlist) **NE FONT PAS partie d'Epic 7** : declencheur calendrier >= 2026-06-08, traitement Epic 8.
- Switch domaine Supabase `roxanetnous.fr` **HORS scope** : conditionnellement reporte (`F-Epic6-C2`), reactivation au jour J achat domaine via memoire `project_go_live_supabase_domain_switch`.
- Aucun toggle departemental `departements_ouverts.ouvert` ne sera touche pendant Epic 7.

---

## Audit MCP BDD prod (methodologie AI-5.M.2 + AI-6.M.1/2/3)

A executer **avant** le tech-spec de chaque story BDD-touching (7.A.7, 7.B.2, 7.B.3). Methodologie elargie post-Epic 6 :

- Lire le body des fonctions/triggers qui referent les tables impactees (AI-6.M.1).
- Pour patterns recreate-enum / ALTER COLUMN TYPE : chercher toutes references `users.role` dans `pg_policies.qual/with_check` (AI-6.M.2).
- Snapshot pre-cutover obligatoire pour DDL **ou** DML > 0 rows (AI-6.M.3).

A executer story par story, pas en bloc upfront.

---

## Inventaire dettes consolidees (post-Epic 6)

### Categorie hardening securite (7.A)

Source : reviews 3.5 / 3.6 / 4.2 / 4.3 / 4.6 / 4.8 (cf. `deferred-work.md`).

| # | Item | Impact runtime |
|---|---|---|
| C1 | `hasActiveSubscription` `.single()` erreur transitoire -> faux paywall utilisateur abonne | Eleve - UX utilisateur payant |
| C2 | `RESEND_FROM_EMAIL` fallback `onboarding@resend.dev` accepte en prod (sandbox 100/jour + bounces) | Eleve - prod emails massivement KO si var manquante |
| C3 | `SKIP_E2E_TESTS=true` leak en prod `VERCEL_ENV=production` = deploys silencieux sans tests | Eleve - regression silencieuse |
| C4 | N+1 unread counts admin messages (100 conv = 101 round-trips Supabase) | Moyen - latence admin > 50 conv |
| C5 | Oracle role messagerie : `getOrCreateConversation*` revele role compte cible via message d'erreur | Moyen - leak securite |
| C6 | `logNotification` non idempotent (pas de unique constraint) | Moyen - doublons logs |
| C7 | CHECK XOR sur `admin_actions_log.target_id` / `target_id_text` (mutex applicatif au lieu de BDD) | Moyen - cohérence BDD |
| C8 | `is_accompagnant()` non `SECURITY DEFINER` (vs `is_accompagne`, `is_admin`) - decider si voulu | Moyen - investigation securite |
| C9 | Toggle annonce `publiee` bumpe `published_at` (spam tri) + status out-of-band TS bypass | Faible-Moyen - UX/donnees |
| C10 | `(profile.specialites as string[]).map()` sans fallback (crash 500 si null) + `fullName` dead + singleton Resend manquant | Faible - polish |
| C11 | Pas de lint/CI bloquant INSERT direct `notifications_log` + validation UUID `userId` runtime | Faible - garde-fou meta |

### Categorie RGPD retention (7.B)

Source : reviews 3.4 / 4.2 (cf. `deferred-work.md`).

| # | Item | Volumetrie prod actuelle |
|---|---|---|
| D1 | `notifications_log.user_id IS NULL` (visiteurs anonymes waitlist + contact) sans TTL | ~50 lignes actuelles, pre-trafic |
| D2 | `parrainages.ip_inscription` IP brut sans TTL ni purge (CNIL ~2 ans) | 0 ligne actuelle |
| D3 | `waitlist_departements.ip_inscription` IP brut sans TTL | 0 ligne actuelle |

**Note critique** : le projet n'a quasi pas de PII en prod (822 users beta, waitlist 0, parrainages 0). C'est le moment pour cadrer la politique avant que la dette devienne onereuse a resorber.

### Categorie tests E2E (7.C)

Source : `F-Epic6-D` (DECISIONS.md 2026-05-13) + retro Epic 6 AI-6.D.1/2/3/4.

| # | Item | Estimation |
|---|---|---|
| E1 | Infra E2E Playwright : config separee de a11y, helpers session/login, fixtures Supabase reset, page objects, CI GHA | 1j |
| E2 | Scenarios anti-fraude parrainage : blacklist auto-detect, doublons parrain, bypass visio filleule | 0,5j |
| E3 | Scenarios RGPD cascade : suppression compte -> verification BDD post-delete | 0,5j |
| E4 | Scenarios matching : annonce accompagnant <-> recherche accompagne + notification email E2E | 0,5j |

---

## Perimetre et hors-scope

### Mini-epics Epic 7 (decoupage)

- **7.A** Hardening securite transverse (11 stories, ~4j-dev). **Ordre 1** : items C1, C2, C3 (criticite elevee runtime).
- **7.B** RGPD retention donnees (3 stories, ~1,5j-dev). **Ordre 1** : 7.B.1 (politique avant cron).
- **7.C** Infra E2E + scenarios (4 stories, ~2,5j-dev). **Ordre 1** : 7.C.1 (infra avant scenarios).

Total : **18 stories**, ~8j-dev theoriques (cadence Sylvain : potentiellement plus court).

### Hors scope Epic 7 (reportes Epic 8+)

- **AI-6.A.1 / AI-6.A.2 / AI-6.A.3** : renommage ~84 variables TS internes + policies RLS `aux_*` + contraintes residuelles `auxiliaires_*` / `beneficiaire_*`. Cosmetique pur, faible ROI.
- **AI-5.C.2** : factories Supabase typees `<Database>` (48 erreurs TS hors-admin) - chantier transverse merite son propre Epic.
- **Audit Sentry/GHA 7j post-Epic 4** (AI-4.1, AI-4.2) : declencheurs calendrier passifs.
- **Audits 30j cron `notify-waitlist-retry` + `BATCH_LIMIT=200`** (5.D / 6.E) : declencheur >= 2026-06-08.
- **Switch domaine Supabase prod** (6.C.2) : declencheur achat `roxanetnous.fr`.
- **Stories conditionnelles** (4.10 OCR, 4.11 Matching UI, 3.7 CMP granulaire) : declencheurs externes non advenus.
- **Doc/methodo** (reconciliation "6 vs 7 parcours" a11y, email canonique `outlook.com` vs `roxanetnous.fr`, qualification art. 28 RGPD sous-traitants, `<Reveal>` SSR/no-JS) : saupoudrer dans stories Epic 8+ ou story dediee.

---

## Mini-epic 7.A : Hardening securite transverse

### Story 7.A.1 : Robustifier `hasActiveSubscription` + `getOrCreateConversation*`

**Source** : reviews 3.6 (`deferred-work.md` lignes 182-183).

**Probleme** : `lib/subscription-helpers.ts:39-57` utilise `.single()` qui echoue sur 0 row ET 2+ rows, et la branche error est destructuree (`{ data }` seul) -> erreur transitoire Supabase (timeout, RLS) renvoie `false` -> utilisateur abonne paywalle silencieusement. Meme pattern dans `app/actions/messages.ts:51-67,107-130` (`getOrCreateConversation*`) : idempotence cassee sur erreur transitoire, tentative INSERT pouvant creer doublon.

**Acceptance Criteria**

- AC1 : `hasActiveSubscription` utilise `.maybeSingle()` au lieu de `.single()`.
- AC2 : Erreurs Supabase (`error != null`) sont **loggees explicitement** via Sentry (`captureException` avec tag `flow=subscription_check`) au lieu d'etre swallowed.
- AC3 : Comportement de retour clarifie : `null` => "abonnement absent" (faux), `Error` => fail-loud (throw), pas de degradation silencieuse.
- AC4 : Meme pattern applique a `getOrCreateConversationFromAccompagne` et `getOrCreateConversationFromAccompagnant` dans `app/actions/messages.ts`.
- AC5 : Unique constraint BDD `conversations(accompagnant_id, accompagne_id)` ajoutee (decouverte review 3.6) si pas deja en place.
- AC6 : Tests Vitest integration : (a) abonne actif paywall OK, (b) abonne expire paywall NOK, (c) erreur Supabase fail-loud, (d) double-call idempotent meme conversation.
- AC7 : Audit MCP `list_tables` post-merge : verifier qu'aucune conversation doublon n'a ete creee depuis 6 mois (`COUNT(*) GROUP BY (accompagnant_id, accompagne_id) HAVING COUNT(*) > 1`).

**Estimation** : 0,5j-dev.

---

### Story 7.A.2 : Durcir `check-required-env.mjs`

**Source** : reviews 4.3 + 4.8 (`deferred-work.md` lignes 221, 243-245).

**Probleme** : Plusieurs variables critiques absentes du check (`SENTRY_AUTH_TOKEN`, `NEXT_PUBLIC_SUPABASE_*`), `RESEND_FROM_EMAIL` non-REQUIRED prod (fallback `onboarding@resend.dev` sandbox = bounces massifs), placeholders litteraux (`your_supabase_anon_key`) passent le check sans alerter.

**Acceptance Criteria**

- AC1 : `RESEND_FROM_EMAIL` promu REQUIRED prod (`VERCEL_ENV=production`) avec validation format email valide.
- AC2 : `SENTRY_AUTH_TOKEN` ajoute REQUIRED en prod (build-time uniquement, sinon sourcemaps non uploadees silencieusement).
- AC3 : `NEXT_PUBLIC_SUPABASE_URL` + `NEXT_PUBLIC_SUPABASE_ANON_KEY` ajoutes REQUIRED prod + preview (sans : runtime crash au premier hit).
- AC4 : Validation regex de shape par variable : `STRIPE_SECRET_KEY` doit commencer par `sk_`, `STRIPE_WEBHOOK_SECRET` par `whsec_`, `ENCRYPTION_KEY` 64 char hex, `RESEND_API_KEY` par `re_`, etc.
- AC5 : Validation anti-placeholder : rejet de toute valeur matchant `^your_.*` ou `^XXX.*` ou `^changeme.*`.
- AC6 : Liste figee promue de 14 vars (4.8) a 17 vars (4 nouvelles : RESEND_FROM_EMAIL prod, SENTRY_AUTH_TOKEN prod, NEXT_PUBLIC_SUPABASE_URL prod+preview, NEXT_PUBLIC_SUPABASE_ANON_KEY prod+preview). Mise a jour `NEXT_STEPS.md`.
- AC7 : `npm run check:env` reste exit 0 sur l'env local Sylvain post-modification.
- AC8 : Verification dans `vercel env ls --environment production` que les 17 vars sont definies avec valeurs format-valides.

**Estimation** : 0,5j-dev.

---

### Story 7.A.3 : Garde-fou `SKIP_E2E_TESTS` interdit en prod

**Source** : review 4.8 (`deferred-work.md` ligne 246).

**Probleme** : `vercel.json` masque exit code des tests integration via `(test "$SKIP_E2E_TESTS" = "true" || npm run test:integration)`. Si la var `SKIP_E2E_TESTS=true` leak en scope `production` (regression Vercel scope), prod deploys silencieux sans tests integration. Action manuelle Sylvain prise 2026-05-09 (env var Production set) mais aucun guard automatique.

**Acceptance Criteria**

- AC1 : `scripts/check-required-env.mjs` throw si `VERCEL_ENV=production` ET `SKIP_E2E_TESTS=true` (assertion explicite).
- AC2 : Test unitaire Vitest sur le script : (a) prod + skip=true => throw, (b) prod + skip=undefined => OK, (c) preview + skip=true => OK (autorise), (d) dev + skip=true => OK.
- AC3 : Documentation `NEXT_STEPS.md` mise a jour : "SKIP_E2E_TESTS interdite en VERCEL_ENV=production".
- AC4 : Verification post-merge : `vercel env ls --environment production` ne contient pas `SKIP_E2E_TESTS`.

**Estimation** : 0,25j-dev.

---

### Story 7.A.4 : Aggreger N+1 unread counts admin messages

**Source** : review 4.6 (`deferred-work.md` ligne 261).

**Probleme** : `app/admin/messages/page.tsx:30-39` boucle non touchee par 4.6, revelee par le typage propre post-`as any`. Pour chaque conversation, un appel separe a `messages` pour le count. 100 conversations admin = 101 round-trips Supabase. Latence elevee >50 conv, timeout possible Vercel.

**Acceptance Criteria**

- AC1 : Aggregation cote BDD via RPC dedie OU jointure LEFT JOIN avec GROUP BY count(message_id).
- AC2 : Si RPC : `get_admin_conversations_with_unread(limit int, offset int)` returns table avec `conversation_id`, `last_message_at`, `unread_count`. Definie SECURITY DEFINER avec check `is_admin()` upfront.
- AC3 : Page admin charge en 1 round-trip BDD max (vs 101).
- AC4 : Latence p50 mesuree avant/apres sur preview Vercel avec dataset seed 100 conversations : doit baisser >70%.
- AC5 : Tests Vitest integration : (a) admin voit toutes conv non lues, (b) admin ne voit pas conv des autres (RLS preserve), (c) limit/offset pagination OK.
- AC6 : Audit Sentry 7j post-merge : 0 nouvelle erreur RPC `get_admin_conversations_with_unread`.

**Estimation** : 0,5j-dev.

---

### Story 7.A.5 : Unifier message d'erreur soft paywall messagerie (anti-oracle)

**Source** : review 3.6 (`deferred-work.md` ligne 181).

**Probleme** : `app/actions/messages.ts:64,127` retournent messages d'erreur differencies (`'... contacter une accompagnante.'` vs `'... contacter un beneficiaire.'`) permettant a un attaquant connecte d'inferer le role du compte cible (oracle paywall). Note CLAUDE.md : la copy doit utiliser **accompagnant** (masculin neutre).

**Acceptance Criteria**

- AC1 : Message unique cote serveur : `'Abonnement requis pour echanger des messages.'` (pas de mention de role).
- AC2 : Pas de leak via codes HTTP, headers, ou shape du JSON (response identique role-agnostic).
- AC3 : Garde-fou test Vitest : compte non-abonne tentant getOrCreate sur accompagnant OU accompagne -> meme message exact, meme status.
- AC4 : Audit grep `grep -rn 'contacter une accompagnant\|contacter un beneficiaire\|contacter un accompagne' app/` apres modif : 0 occurrence dans messages d'erreur server.

**Estimation** : 0,25j-dev.

---

### Story 7.A.6 : Idempotence `logNotification`

**Source** : reviews 4.2 + 4.3 (`deferred-work.md` lignes 205 + 225).

**Probleme** : Pas de unique constraint sur `(user_id, type, subject, sent_at)` ou similaire. Double-click utilisateur ou retry middleware Next.js -> 2 lignes `notifications_log` distinctes pour le meme envoi. Le dedup `hasRecentNotification` (Stripe webhook) compense pour certains types mais pas tous. Resend SDK `idempotency_key=runId-stepId` ne couvre que les retries du meme step, pas un nouveau runId.

**Acceptance Criteria**

- AC1 : Choix architectural documente DECISIONS.md : (a) partial unique index BDD sur `(email, type, hash(subject), date_trunc('hour', sent_at))` OU (b) idempotency_key applicatif deterministe `SHA-256(template + to + variables + date_trunc('hour'))`.
- AC2 : Implementation conforme au choix AC1.
- AC3 : Si BDD : migration SQL avec `CREATE UNIQUE INDEX CONCURRENTLY` + tests d'integration (double envoi meme contenu = 1 ligne en BDD).
- AC4 : Si applicatif : helper `computeIdempotencyKey(template, to, variables, date)` + tests Vitest (memes inputs = meme key, inputs differents = key differente).
- AC5 : Migration applicable sans backfill (clean state) OU avec backfill documente si conflits potentiels detectes.
- AC6 : Audit Sentry 7j post-merge : 0 erreur unique constraint violation inattendue.

**Estimation** : 0,5j-dev (incluant migration + tests).

---

### Story 7.A.7 : CHECK XOR sur `admin_actions_log.target_id` / `target_id_text`

**Source** : review 3.5 (`deferred-work.md` ligne 175).

**Probleme** : Mutex purement applicatif. Un futur code path peut INSERT avec les deux NULL ou les deux NOT NULL sans rejet Postgres.

**Acceptance Criteria**

- AC1 : Audit MCP BDD prod : `SELECT COUNT(*) FROM admin_actions_log WHERE (target_id IS NULL) = (target_id_text IS NULL)` -> doit retourner 0. Si > 0, backfill manuel avant ALTER.
- AC2 : Migration SQL :
  ```sql
  ALTER TABLE admin_actions_log
  ADD CONSTRAINT target_id_xor
  CHECK ((target_id IS NULL) <> (target_id_text IS NULL)) NOT VALID;

  ALTER TABLE admin_actions_log
  VALIDATE CONSTRAINT target_id_xor;
  ```
- AC3 : Snapshot pre-cutover : count actuel + sample 5 rows pre-ALTER.
- AC4 : Test idempotence migration (BEGIN/ROLLBACK).
- AC5 : Apres apply : test INSERT INVALID (les deux NULL OU les deux NOT NULL) -> doit etre rejete par CHECK.
- AC6 : Pas d'impact applicatif (les call sites valides respectent deja le mutex).

**Estimation** : 0,25j-dev.

---

### Story 7.A.8 : Investigation `is_accompagnant()` SECURITY DEFINER

**Source** : retro Epic 6 AI-6.A.4.

**Probleme** : Incoherence securitaire detectee Epic 6 : `is_accompagnant()` n'est pas `SECURITY DEFINER` contrairement a `is_accompagne` et `is_admin`. Preservee a l'identique 6.A.2 par principe de moindre surprise. A decider : (a) voulu (raison metier) ou (b) heritage involontaire a corriger.

**Acceptance Criteria**

- AC1 : Audit MCP : `pg_get_functiondef('public.is_accompagnant'::regprocedure)` + `pg_get_functiondef('public.is_accompagne'::regprocedure)` + `pg_get_functiondef('public.is_admin'::regprocedure)` -> comparer signatures + body + DEFINER/INVOKER.
- AC2 : Git blame de la creation des 3 helpers : determiner si la difference etait intentionnelle (commit + message).
- AC3 : Test fonctionnel : un user accompagne ou admin appelant `is_accompagnant()` actuellement -> que retourne-t-il ? Si SECURITY INVOKER lit la table users avec les droits du caller, peut-il retourner true a tort ou crash RLS ?
- AC4 : Decision documentee DECISIONS.md : (a) garder INVOKER (avec justification) ou (b) ALTER FUNCTION ... SECURITY DEFINER (migration BDD).
- AC5 : Si ALTER : snapshot pre-cutover + tests integration RLS sur 3 roles.
- AC6 : Si garder INVOKER : commentaire `COMMENT ON FUNCTION` explicite + ligne dans DECISIONS.md + verification que les 14 policies RLS qui utilisent `is_accompagnant()` fonctionnent correctement en INVOKER.

**Estimation** : 0,25j-dev (majoritairement investigation).

---

### Story 7.A.9 : Toggle `publiee` idempotent + whitelist status annonces

**Source** : review 3.6 (`deferred-work.md` lignes 184-185).

**Probleme** :
1. `updateAnnonce*Status(id, 'publiee')` sur annonce deja publiee bumpe `published_at` -> user abonne peut spammer le toggle pour remettre son annonce en haut du tri (bump effect).
2. Status value out-of-band TS bypass : client custom HTTP appelant `updateAnnonce*Status(id, 'autre' as any)` contourne le TS guard -> donnee corrompue si schema BDD n'a pas CHECK.

**Acceptance Criteria**

- AC1 : `updateAnnonceAccompagnantStatus` et `updateAnnonceAccompagneStatus` ajoutent un early-return : `if (current.status === 'publiee' && status === 'publiee') return { success: true }` sans update.
- AC2 : Whitelist serveur : `if (!['publiee', 'archivee'].includes(status)) return { error: 'Statut invalide.' }` avant tout call BDD.
- AC3 : Audit BDD : verifier qu'un CHECK existe sur la colonne `status` des tables `annonces_*`. Si absent, story doit ajouter le CHECK.
- AC4 : Tests Vitest integration : (a) toggle publiee->publiee = no-op (published_at inchange), (b) toggle status='autre' = error, (c) toggle archivee->publiee = published_at = now() (legitime).
- AC5 : Audit Sentry 7j : 0 erreur whitelist hit (signal qu'un client custom HTTP existait reellement).

**Estimation** : 0,5j-dev.

---

### Story 7.A.10 : Cleanup polish (Resend singleton + specialites fallback + fullName dead)

**Source** : reviews 4.3 + 4.6 + 4.2 (`deferred-work.md` lignes 219 + 259 + 204).

**Probleme** : 3 dettes triviales groupees pour eviter 3 PRs friables.
1. Resend client recree a chaque retry (~5ms x N) -> singleton module-level.
2. `(profile.specialites as string[]).map()` sans fallback `|| []` -> crash 500 si null.
3. `fullName` variable dead dans `app/actions/contact.ts:34`.

**Acceptance Criteria**

- AC1 : `lib/workflows/send-email-workflow.ts` : `const resend = new Resend(process.env.RESEND_API_KEY)` au scope module (singleton). Verifier que le SDK Resend est fork-safe / stateless HTTP.
- AC2 : `app/admin/validation/[id]/page.tsx:40` : `(profile.specialites as string[] || []).map(...)` (pattern aligne avec ligne 36 `diplomes`).
- AC3 : `app/actions/contact.ts:34` : supprimer `const fullName = ...` OU inclure `fullName` dans le mail HTML/payload Resend pour rendre l'affichage plus naturel.
- AC4 : tsc 0 erreur post-modifications. Build 0 warning.
- AC5 : Tests Vitest existants restent verts.

**Estimation** : 0,25j-dev.

---

### Story 7.A.11 : Lint/CI bloquant INSERT direct `notifications_log` + validation UUID `userId`

**Source** : review 4.2 (`deferred-work.md` lignes 207 + 211).

**Probleme** :
1. La regle DECISIONS.md F6 (utiliser `logNotification` exporte plutot que INSERT direct) repose 100% sur vigilance code-review humaine.
2. `logNotification` accepte `userId: 'undefined'` literal -> truthy -> INSERT user_id='undefined' -> Postgres UUID parse error -> exception propage.

**Acceptance Criteria**

- AC1 : Script CI `scripts/check-no-direct-notifications-log-insert.mjs` qui grep `.from\(['"\]notifications_log['"\]\)\.insert` dans tous les fichiers `.ts`/`.tsx` hors `lib/emails.ts` (le seul caller autorise). Exit code 1 si match.
- AC2 : Integration dans `vercel.json` buildCommand (apres les check existants).
- AC3 : `logNotification` : validation runtime UUID via regex `^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$` sur `params.userId` non-null/non-empty. Throw early si format invalide.
- AC4 : Tests Vitest : (a) UUID valide OK, (b) `userId: 'undefined'` literal => throw, (c) `userId: ''` => null (mappe correctement), (d) `userId: null` => null.
- AC5 : Verification : `npm run lint` et `npm run check-no-direct-notifications-log-insert` exit 0 sur HEAD.

**Estimation** : 0,25j-dev.

---

## Mini-epic 7.B : Conformite RGPD retention donnees

### Story 7.B.1 : Politique TTL formalisee DECISIONS.md

**Source** : reviews 3.4 + 4.2 (`deferred-work.md` lignes 163 + 210).

**Probleme** : Aucune politique de retention documentee. Visiteurs anonymes (waitlist + contact) -> rows `notifications_log` avec `email` PII, `subject` parfois sensible, aucune cle de jointure user pour cascade `ON DELETE`. Droit a l'oubli RGPD inapplicable. Idem `ip_inscription` (parrainages + waitlist) >2 ans CNIL.

**Acceptance Criteria**

- AC1 : Section dediee dans DECISIONS.md "2026-05-XX : Politique de retention donnees personnelles (decision F-Epic7-B1)".
- AC2 : Pour chaque table contenant PII : durée TTL justifiee CNIL / RGPD :
  - `notifications_log` : 18 mois (justification : trace operationnelle email transactionnel, post-delai prescription opposabilite).
  - `parrainages.ip_inscription` : 2 ans (anti-fraude, CNIL recommandation).
  - `waitlist_departements.ip_inscription` : 6 mois (anti-spam waitlist, plus court car moins sensible).
  - `admin_actions_log` : conserve indefiniment (audit trail conformite art. 5.1.f RGPD - integrite).
- AC3 : Methode de purge documentee : (a) cron Vercel quotidien, (b) anonymisation in-place (NULL ip + email_hash kept) vs (c) DELETE hard. Choix justifie par table.
- AC4 : Procedure droit a l'oubli utilisateur authentifie : cascade existante via FK `ON DELETE` documentee. Procedure droit a l'oubli visiteur anonyme : `delete-pii` endpoint admin avec email en input.
- AC5 : Mise a jour `politique-de-confidentialite/page.tsx` avec durees de conservation citees.
- AC6 : Validation legale informelle : Sylvain confirme l'alignement avec son audit RGPD anterieur (audit cookies 2026-05-07).

**Estimation** : 0,5j-dev. **Pre-requis Stories 7.B.2 et 7.B.3**.

---

### Story 7.B.2 : Cron purge `notifications_log` > 18 mois

**Source** : reviews 3.4 + 4.2.

**Probleme** : `notifications_log` accumule PII visiteurs anonymes (email + sometimes nom dpt sensible). Aucune purge actuelle.

**Acceptance Criteria**

- AC1 : Cron Vercel `app/api/cron/purge-notifications/route.ts` execute quotidien (`crons` dans `vercel.json`).
- AC2 : Logique : `DELETE FROM notifications_log WHERE sent_at < now() - interval '18 months'`. Idempotent (re-run sans effet si rien a purger).
- AC3 : Audit MCP BDD prod avant 1er run : `SELECT COUNT(*), MIN(sent_at), MAX(sent_at) FROM notifications_log WHERE sent_at < now() - interval '18 months'`. Si > 0, snapshot pre-cutover.
- AC4 : Log Sentry breadcrumb a chaque run avec `purged_count`. Alert si > seuil (ex: > 1000 rows / run = signal anormal).
- AC5 : Test integration Vitest : seed 3 rows old + 3 rows recent -> apres cron run = 3 rows recent. Re-run = no-op.
- AC6 : Auth cron : header `Authorization: Bearer ${CRON_SECRET}` verifie. Endpoint refuse les calls non-Vercel.
- AC7 : DoD post-deploy : 1er run sur prod monitore via Sentry. Confirmer 0 erreur.

**Estimation** : 0,5j-dev.

---

### Story 7.B.3 : Cron purge / anonymisation `parrainages.ip_inscription` + `waitlist_departements.ip_inscription`

**Source** : review 3.4.

**Probleme** : IP brutes accumulent sans purge. Volumetrie actuelle prod = 0 mais la dette doit etre traitee avant prise de trafic.

**Acceptance Criteria**

- AC1 : Cron `app/api/cron/purge-ip-addresses/route.ts` quotidien.
- AC2 : Logique anonymisation in-place (preserve les rows pour audit anti-fraude) :
  - `UPDATE parrainages SET ip_inscription = NULL WHERE created_at < now() - interval '2 years' AND ip_inscription IS NOT NULL`.
  - `UPDATE waitlist_departements SET ip_inscription = NULL WHERE created_at < now() - interval '6 months' AND ip_inscription IS NOT NULL`.
- AC3 : Audit MCP avant 1er run sur les 2 tables. Volumes attendus = 0 actuellement.
- AC4 : Idempotent (re-run sans effet).
- AC5 : Log Sentry breadcrumb par run avec `anonymized_count_parrainages` + `anonymized_count_waitlist`.
- AC6 : Auth cron : header `Authorization: Bearer ${CRON_SECRET}` verifie.
- AC7 : Tests integration Vitest : seed rows old + recent, run cron, verifier ip NULL pour old + preserve recent.
- AC8 : Mise a jour memoire `project_epic_7_cadrage` apres deploy : 1er run prod OK.

**Estimation** : 0,5j-dev.

---

## Mini-epic 7.C : Infra E2E Playwright + 3 scenarios

### Story 7.C.1 : Infra E2E Playwright

**Source** : retro Epic 6 AI-6.D.1 + decision `F-Epic6-D`.

**Probleme** : Aucune infra E2E n'existe (la story 4.4 avait livre Vitest integration, pas Playwright fonctionnel). Le seul Playwright en place est `tests/a11y/` (6 specs axe-core).

**Acceptance Criteria**

- AC1 : Nouveau dossier `tests/e2e/` separe de `tests/a11y/`. Config `playwright-e2e.config.ts` dediee (ne partage pas le `playwright.config.ts` a11y).
- AC2 : Helpers `tests/e2e/_lib/`:
  - `session.ts` : `loginAs(role, email?)` qui creee un user via `supabase.auth.admin.createUser` puis pose le cookie session.
  - `fixtures.ts` : seed data Supabase (reset entre tests via TRUNCATE + restart RLS).
  - `pages.ts` : page objects pour pages cles (login, dashboard accompagnant, dashboard accompagne, messages, admin).
- AC3 : Workflow GHA `.github/workflows/e2e-tests.yml` qui demarre Supabase local + Vercel preview deployment + execute Playwright. Trigger : push sur branches + main.
- AC4 : 1 smoke test minimal `tests/e2e/smoke.spec.ts` qui verifie landing page + login + dashboard apparait. Doit etre vert avant merge.
- AC5 : Documentation `tests/e2e/README.md` : comment lancer en local (`npm run test:e2e`), comment debugger (UI mode), comment seed data, comment isoler entre tests.
- AC6 : Integration `package.json` : scripts `test:e2e`, `test:e2e:ui`, `test:e2e:debug`.
- AC7 : `vercel.json` buildCommand : aucune modification (E2E ne tournent pas en build Vercel - reserves a CI GHA).
- AC8 : Tests verts 2 runs consecutifs GHA avant merge (stabilisation flaky).

**Estimation** : 1j-dev. **Pre-requis Stories 7.C.2 / 7.C.3 / 7.C.4**.

---

### Story 7.C.2 : Scenarios anti-fraude parrainage E2E

**Source** : retro Epic 6 AI-6.D.2.

**Acceptance Criteria**

- AC1 : `tests/e2e/parrainage-anti-fraude.spec.ts` couvre 3 scenarios :
  - **Blacklist auto-detect** : marraine A + filleule B avec meme `meme_adresse` ou `meme_email_pattern` -> parrainage flag `blacklist=true` BDD + email admin recu.
  - **Doublons parrain** : marraine A tente 2 codes pour 2 filleules differentes -> 2 parrainages valides, mais 3eme tentative meme cycle -> rejet (si plafond configure).
  - **Bypass visio filleule** : filleule arrive sur `/onboarding` avec `parrainee_par != null` -> step visio skip + validation auto.
- AC2 : Chaque scenario assert : (a) UI state attendu, (b) row BDD coherente via `supabase.from(...).select()`, (c) email recu (mock Resend ou Mailpit).
- AC3 : Isolation : chaque test reset BDD seed + signup unique email + cookie session unique.
- AC4 : Workflow GHA execute ces specs apres 7.C.1.

**Estimation** : 0,5j-dev.

---

### Story 7.C.3 : Scenarios RGPD cascade E2E

**Source** : retro Epic 6 AI-6.D.3.

**Acceptance Criteria**

- AC1 : `tests/e2e/rgpd-cascade.spec.ts` couvre :
  - **Suppression compte accompagnant** : user delete -> verifier cascade BDD (annonces, conversations, messages, accompagnants_profiles, parrainages.marraine_id SET NULL, etc.).
  - **Suppression compte accompagne** : user delete -> cascade (favoris, recherches, parrainages.filleule_id SET NULL).
  - **Suppression compte admin** : refus si dernier admin (RLS + appli).
- AC2 : Chaque scenario assert via `supabase.from('users').select('id').eq('id', userId)` -> null + assert tables annexes.
- AC3 : Workflow GHA.

**Estimation** : 0,5j-dev.

---

### Story 7.C.4 : Scenarios matching E2E

**Source** : retro Epic 6 AI-6.D.4.

**Acceptance Criteria**

- AC1 : `tests/e2e/matching.spec.ts` couvre :
  - **Matching basique** : accompagnant publie annonce dpt X -> accompagne recherche dpt X -> annonce apparait dans `/recherche` + score calcule attendu.
  - **Notification email match** : accompagne enregistre recherche stockee -> accompagnant publie nouvelle annonce dpt X -> email envoye a l'accompagne (assert via mock Resend ou notifications_log).
  - **Filtre soft paywall** : accompagne non-abonne voit liste mais clic "Contacter" -> redirect paywall.
- AC2 : Workflow GHA.

**Estimation** : 0,5j-dev.

---

## Recapitulatif Epic 7

| Mini-epic | Stories | Estim. | Criticite | Ordonnancement |
|---|---|---|---|---|
| 7.A Hardening securite | 11 (7.A.1 a 7.A.11) | ~4j | Elevee + Moyenne + Faible | Independantes entre elles (paralellisable) |
| 7.B RGPD retention | 3 (7.B.1, 7.B.2, 7.B.3) | ~1,5j | Legal-sensible | 7.B.1 avant 7.B.2 et 7.B.3 |
| 7.C E2E Playwright | 4 (7.C.1, 7.C.2, 7.C.3, 7.C.4) | ~2,5j | Infrastructurel | 7.C.1 avant 7.C.2/3/4 |
| **Total** | **18 stories** | **~8j-dev** | | |

**Ordre 1 (bloquantes risque produit)** : 7.A.1, 7.A.2, 7.A.3 (criticite elevee runtime) + 7.B.1 (politique RGPD avant cron) + 7.C.1 (infra avant scenarios).

**Pas de checkpoint review obligatoire avant execution** : scope arbitré, criticite documentee story par story, retros Epic 5/6 ont stabilise la methodologie. Sylvain peut lancer les stories on-demand au rythme souhaite (pattern Epic 5/6).

---

## Mise a jour memoires projet

A creer / mettre a jour apres validation de ce cadrage :

- A creer : `project_epic_7_cadrage.md` (pointeur vers ce document + scope).
- A mettre a jour en clôture : `project_epic_7_retro.md` (apres execution).
- A mettre a jour : `project_logNotification_bug.md` (cloture par 7.A.6 + 7.A.11).
- A mettre a jour : `project_admin_actions_log_target_id_bug.md` (cloture par 7.A.7).

---

**Cadrage cloture 2026-05-13. Epic 7 pret a executer on-demand.**
