---
stepsCompleted: [step-01-validate-prerequisites, step-02-design-epics, step-03-create-stories, step-04-final-validation, checkpoint-review-2026-05-13]
checkpointReviews:
  - date: '2026-05-13'
    skill: bmad-checkpoint-preview
    findings: 'Audit MCP BDD prod revele divergence doc archi vs prod sur 4 axes : enum user_role (`accompagnante`/`accompagne`/`admin` au lieu de `auxiliaire`/`beneficiaire`/`admin`), 15 colonnes BDD impactees dans 8 tables (vs 2 colonnes annoncees), 2 tables a renommer (`accompagne_accompagnantes`, `annonces_accompagnantes`), helpers RLS `public.is_accompagnante` (pas `auth.is_auxiliaire`). Stories 5.A.1 et 5.A.2 mises a jour avec inventaire factuel + plan rollback explicite + Postgres < 18 DROP VALUE impossible. Section Additional Requirements annotee divergence doc archi vs realite prod.'
inputDocuments:
  - prd.md
  - architecture-technique-roxanetnous-2026-02-09.md
  - ux-design-specification.md
  - ../../DECISIONS.md
  - ../implementation-artifacts/epic-4-retro-2026-05-08.md
  - ../implementation-artifacts/deferred-work.md
  - epic-4.md
  - epic-3.md
workflowType: 'epic'
classification:
  projectType: web_app
  domain: general
  complexity: medium
epicNumber: 5
epicTheme: 'Coherence editoriale + hardening continu post-Bretagne'
created: '2026-05-13'
status: 'a cadrer formellement (Story List + ACs en cours via bmad-create-epics-and-stories steps 02 et 03)'
parentSkill: 'bmad-create-epics-and-stories'
---

# Epic 5 : Coherence editoriale + hardening continu post-Bretagne

## Vision

Trois objectifs paralleles, non-bloquants pour le go-live Bretagne :

1. **Coherence editoriale (5.A)** : passer le metier au masculin neutre `accompagnant` (1755 occurrences, BDD + routes + UI + emails + docs) pour resorber la dette terminologique heritage Epic 1 et aligner code + copy publique. Demande Sylvain 2026-05-13. Le pre-existant `role = 'accompagnante'` au feminin diverge du doc architecture qui prevoyait `'auxiliaire'` : le renommage doit traiter les deux fronts en une seule passe coordonnee.

2. **Hardening continu (5.B + 5.C + 5.D)** : solder les dettes accumulees en `deferred-work.md` (bugs latents messagerie, oracle de role) et les action items Epic 4 differes (resorption `as any` hors-admin, nettoyage CI, audits post-stabilisation 30j).

3. **Observabilite oncall (5.E)** : completer l'instrumentation Sentry livree en Epic 4 story 4.1 par un coupling alertes oncall (PagerDuty ou Slack), pour automatiser la remontee critique au-dela de la dashboard Sentry passive.

**Decisions de reference** : DECISIONS.md F6-F11 (Epic 4, ajoutees 2026-05-08), retrospective Epic 4 (`epic-4-retro-2026-05-08.md`, 15 AI Epic 5+ loges AI-4.4 a AI-4.15), memoire projet `project_renommage_accompagnante_todo`.

**FR/NFR couverts** : FR1, FR2, FR4-5 (RGPD), FR7, FR11-12 (verification auxiliaire), FR16-19 (paywall + annonces), FR27-29 (messagerie), FR45-46, FR48 (couverture geographique). NFR2 (securite : RLS messagerie), NFR4 (integrations : Sentry → oncall), NFR5 (fiabilite : observabilite), NFR6 (a11y : preservation baseline 0 violation Critical/Serious).

## Pre-requis et conditions de demarrage

**Decision 2026-05-13** : le sprint Epic 5 demarre en parallele du go-live Bretagne, sans attendre les audits 7j herites Epic 4 (DECISIONS.md F-Epic5-0).

Justification : Epic 5 est un chantier d'hardening transverse independant du go-live. Les mini-epics 5.C (hardening typage / nettoyage CI) et 5.E (observabilite oncall) n'ont aucune surface commune avec les flux critiques Epic 4 sous observation. 5.A (renommage BDD) demarre par une architecture review (5.A.1) sans impact code/BDD. La fenetre 7j devient une **observation passive en parallele** plutot qu'un blocage actif.

**Conditions d'observation parallele** (non-bloquantes, mais a surveiller) :

- **AI-4.1** - Audit Sentry prod observe en continu pendant le sprint Epic 5. Si exception critique non-attendue emerge, declencher `bmad-correct-course` avant d'embrayer une nouvelle story Epic 5.
- **AI-4.2** - Stabilisation GHA observee en continu. Si CI redevient instable sur 4.4 / 4.7, prioriser le fix avant les stories Epic 5 qui touchent la CI (5.C.4 notamment).
- **AI-4.3** - Toggle admin premier departement Bretagne en production : geste manuel independant, peut etre fait avant, pendant ou apres le sprint Epic 5.

**Pre-requis specifiques mini-epics (decisions actees 2026-05-13) :**

- **5.A renommage** : strategie migration enum role decidee en story 5.A.1 (architecture review legere, pas de modif code/BDD).
- **5.E observabilite oncall** : plateforme retenue = **Slack** (decision Sylvain 2026-05-13). Justification : Sylvain seul oncall, integration Sentry native gratuite, push mobile app Slack equivalent fonctionnel a PagerDuty pour ce usage. Compte Sentry deja actif depuis Epic 4 story 4.1.

## Periodemetre et hors-scope

### Mini-epics Epic 5 (decoupage valide Sylvain 2026-05-13)

| Mini-epic | Titre | Stories estimees | Bloque ? |
|---|---|---|---|
| **5.A** | Renommage `accompagnante` -> `accompagnant` | ~6 | Bloque 5.B (touche messages.ts) |
| **5.B** | Bugs latents `deferred-work` (oracle role, doublons conversations, validation type URL) | ~3-4 | Bloquee par 5.A |
| **5.C** | Hardening typage + nettoyage CI (`as any` hors admin, /api/test-sentry, IPv6, vercel env auto) | ~3-4 | Independant |
| **5.D** | Audits post-stabilisation 30j (cron notify-waitlist-retry, BATCH_LIMIT send-waitlist) | ~2 | Differe naturellement (audit > 30j) |
| **5.E** | Observabilite oncall (Sentry → PagerDuty/Slack) | ~1 | Independant |

### Hors scope Epic 5 - reportes Epic 6 (a definir)

- **Switch domaine Supabase prod** (Site URL + Redirect URLs + `NEXT_PUBLIC_BASE_URL`) : declencheur = achat vrai domaine. Cf. memoire `project_go_live_supabase_domain_switch`.
- **Seed migration UTF-8 departements/regions** : divergence prod/dev/CI 2026-05-11 (cf. memoire `project_accents_departements_2026_05_11`). **Note** : si une migration BDD 5.A touche le schema, evaluer absorbtion opportuniste plutot que report.
- **Tests parrainage anti-fraude / matching / RGPD cascade** (AI-4.11, AI-4.12) : extension suite Playwright story 4.4.
- **Documentation conventions tests** (AI-4.9) : fixtures inline vs seeds globaux.
- **Centralisation 18 helpers email** (AI-4.13) : DRY rejete story 4.3 D9. A reconsiderer si maintenance lourde.
- **Reconfiguration timeout Vercel Functions** (AI-4.14) : si latence pic. Conditionnel.
- **Story 4.10 OCR perfectionnement** : conditionnelle, declencheur > 25 auxiliaires inscrites OU delai validation > 24h. Non atteint au 2026-05-13.
- **Story 4.11 Matching UI** : conditionnelle, declencheur 3 mois donnees Bretagne post go-live. Go-live non encore debloque.
- **CMP granulaire** : conditionnel, declencheur intro analytics/retargeting/partenaires tiers.

## Requirements Inventory

### Functional Requirements (extraits PRD `prd.md`)

Le PRD contient 44 FRs. Ceux impactes directement ou indirectement par Epic 5 :

**Authentification & roles (impactes par renommage 5.A) :**

- **FR1** : Un visiteur peut creer un compte en choisissant son role (auxiliaire ou beneficiaire).
- **FR2** : Un utilisateur peut se connecter et se deconnecter de son compte.
- **FR4** : Un utilisateur peut supprimer son compte et ses donnees (RGPD).
- **FR5** : Un utilisateur peut exporter ses donnees personnelles (RGPD).

**Verification auxiliaires (terminologie role impactee 5.A) :**

- **FR7** : Une auxiliaire peut remplir son profil structure (diplome, experience, specialites, zones, disponibilites).
- **FR11** : Un admin peut valider, refuser ou demander des complements pour un profil auxiliaire.
- **FR12** : Une auxiliaire non verifiee ne peut pas publier d'annonce ni acceder aux fonctionnalites payantes.

**Soft paywall + annonces (impactes par renommage 5.A) :**

- **FR16** : Le systeme applique un soft paywall. Lecture libre, paywall sur actions de mise en relation.
- **FR18** : Une auxiliaire verifiee et abonnee peut creer, modifier et supprimer ses annonces de service.
- **FR19** : Un beneficiaire abonne peut creer, modifier et supprimer ses annonces de recherche.

**Messagerie (impactee par bugs 5.B) :**

- **FR27** : Deux utilisateurs abonnes peuvent echanger des messages en temps reel.
- **FR28** : Un utilisateur recoit une notification email lorsqu'il recoit un nouveau message.
- **FR29** : Un utilisateur peut consulter l'historique de ses conversations.

**Couverture geographique (impactee par audits 5.D) :**

- **FR45** : Le systeme restreint la visibilite des profils aux departements `departements_ouverts`.
- **FR46** : Un utilisateur hors zone peut s'inscrire a une waitlist (notification a l'ouverture).
- **FR48** : La landing page affiche les departements actuellement ouverts (rendu serveur).

### NonFunctional Requirements (extraits PRD)

**NFR1 (Performance)** : Pages publiques < 2.5s LCP, actions < 1s, messagerie < 500ms. Core Web Vitals (LCP < 2.5s, FID < 100ms, CLS < 0.1). Le renommage 5.A ne doit pas regresser ces metriques (redirects 301 efficients, pas de cascade serveur supplementaire).

**NFR2 (Securite)** :
- HTTPS + chiffrement Supabase au repos.
- RLS Supabase isolation stricte entre utilisateurs.
- Conformite RGPD : suppression compte, export, consentements.
- Webhooks Stripe verifies par signature.
- *Impact 5.A* : la migration enum `role` ne doit pas casser les helpers RLS `public.is_accompagnante()` / `public.is_accompagne()` / `public.is_admin()` / `public.is_document_owner()` ni les 7+ policies dependantes (inventaire complet story 5.A.1).
- *Impact 5.B* : bug oracle de role messagerie est une vulnerabilite NFR2 a corriger.

**NFR3 (Scalabilite)** : MVP 20 utilisateurs a 3 mois, 100 a 12 mois. Architecture serverless. Pas de contrainte critique au MVP. *Impact 5.A* : redirects 301 doivent supporter le trafic actuel sans degradation.

**NFR4 (Integrations)** : Stripe, Supabase, Google Cloud Vision, Resend. *Impact 5.E* : ajouter Sentry → PagerDuty/Slack comme nouvelle integration sortante.

**NFR5 (Fiabilite)** : Disponibilite 99.5%, pas de perte de messages, retry webhooks Stripe. *Impact 5.A* : pas de fenetre de downtime > 1 min sur cutover BDD enum. *Impact 5.D* : verifier 30j post-Epic 4 que les workarounds (`BATCH_LIMIT=200`, cron retry waitlist) sont effectivement inutiles avant suppression.

**NFR6 (Accessibilite WCAG 2.2 AA)** : Conforme avec reserves (18/22 PASS, 0 bloqueur). Baseline `@axe-core/playwright` zero violation Critical/Serious sur 7 parcours critiques. Regle CLAUDE.md ligne 6 durcie 2026-05-06 : `npm run a11y:axe:check` exit 0 obligatoire avant tout commit livraison story. *Impact toutes stories Epic 5 touchant l'UI* : preserver la baseline (5.A renommage textuel = risque faible, 5.B fix UX errors = risque moyen).

**NFR7 (Compatibilite navigateurs)** : Chrome/Firefox/Safari dernieres versions, responsive desktop + tablette.

### Additional Requirements (extraits Architecture)

**Renommage role (impactant 5.A) :**

> **Note divergence doc archi vs prod (audit MCP 2026-05-13)** : le doc archi 2026-02-09 mentionne `'auxiliaire'`/`'beneficiaire'` et helpers `auth.is_auxiliaire()`. La realite BDD prod (audit MCP) est `'accompagnante'`/`'accompagne'` et helpers `public.is_accompagnante()`. **Source de verite : voir inventaire factuel dans story 5.A.1.** Les references ci-dessous citent le doc archi pour tracabilite mais ne doivent PAS guider l'implementation.

- Enum `user_role` (doc archi : `'auxiliaire'`, `'beneficiaire'`, `'admin'`) -- **realite prod : `'accompagnante'`, `'accompagne'`, `'admin'`** (audit MCP 2026-05-13).
- RLS helper functions (doc archi : `auth.is_auxiliaire()`, `auth.is_beneficiaire()`, `auth.is_admin()`) -- **realite prod : `public.is_accompagnante()`, `public.is_accompagne()`, `public.is_admin()`, `public.is_document_owner()`**.
- Tables profils (doc archi : `auxiliaires_profiles`, `beneficiaires_profiles`) -- **realite prod : `accompagnantes_profiles`, `accompagnes_profiles`**. Plus 2 tables nommees apres le role feminin : `accompagne_accompagnantes`, `annonces_accompagnantes` (decision renommage in/out of scope a acter story 5.A.1).
- 15 colonnes BDD masculin/feminin a auditer dans 8 tables (voir story 5.A.1 inventaire complet) : conversations, messages, annonces_accompagnantes/accompagnes, favoris, planning_documents/shifts/document_assignments, accompagne_accompagnantes.
- Enum `validation_status` sur `accompagnantes_profiles` : `en_attente, visio_a_planifier, visio_realisee, valide, refusee` (a verifier sur cutover, pas modifie en scope 5.A).

**Bugs messages (impactant 5.B) :**

- Contrainte `UNIQUE` sur `conversations` (doc archi : `UNIQUE(auxiliaire_id, beneficiaire_id)`) -- **realite prod a auditer story 5.B.2** : la contrainte effective sera probablement sur `(accompagnante_id, accompagne_id)` ou n'existe pas (deferred-work.md suggere doublons possibles).
- Oracle de role implicite via `messages.sender_id` + participants conversation.
- RLS messages : policy `msg_select_own` audite 2026-05-13 utilise `conversations.accompagnante_id` + `conversations.accompagne_id` via sous-queries sur `accompagnantes_profiles`/`accompagnes_profiles`.

**Hardening typage (impactant 5.C) :**

- TypeScript strict + Supabase client typage genere (section Stack Technique). Story Epic 4 4.6 a livre la generation `types/supabase.ts` ~1700 lignes via MCP. Pattern reconductible Epic 5.
- Validation Zod cote serveur, `AnnonceAuxiliaireSchema.parse()` throw obligatoire (section Validation Inputs).
- Typage `createClient` serviceRole vs anon, webhooks Stripe DOIVENT utiliser serviceRole (section Webhooks Stripe).

**Infrastructure (impactant 5.C, 5.D) :**

- 4 Vercel Cron Jobs dans `vercel.json` (update-badges, send-weekly-digest, check-expiring-subscriptions, cleanup-old-notifications). Story 5.D evalue suppression du cron retry waitlist (AI-4.5) post-audit 30j.
- Rate limiting Upstash Redis sliding window 10 req/10s (section Rate Limiting Vercel Edge). Story Epic 4 4.5 (hardening IP spoofing) a livre normalisation IP base. AI-4.15 : normalisation IPv6 mapped → IPv4 reste a faire (5.C).
- Resend + React Email 9 templates. Story 5.C peut absorber centralisation helpers email seulement si Sylvain change d'avis vs decision F-Epic-4 (DRY rejete 4.3 D9).
- Sentry SDK livre Epic 4 story 4.1 (`@sentry/nextjs` + 3 configs : client, server, edge). Endpoint `/api/test-sentry` temporaire ajoute pendant 4.1 a supprimer (AI-4.6, story 5.C).
- Audit logging `admin_actions_log` (action_type, target_type, details JSONB) - section Schema BDD. 5.A doit logger les changements role si applicable.

**Observabilite oncall (impactant 5.E) :**

- Aucune mention Sentry/PagerDuty/Slack/Opsgenie dans le doc archi initial (Sentry SDK ajoute Epic 4 4.1).
- Conformite log 1 an documentee (section Securite & RGPD). Coupling Sentry → oncall doit respecter cette retention.

**Starter template** : aucun starter explicitement mentionne (stack Next.js 15 App Router + React + TypeScript + TailwindCSS sans reference create-next-app, T3, ou template Vercel).

### UX Design Requirements

Doc UX `ux-design-specification.md` minimaliste (3 defis + 3 opportunites + flow admin visio). **Aucun UX-DR specifique Epic 5** :

- Pas de design tokens nouveaux (palette/typo Epic 2 livres).
- Pas de composants reutilisables nouveaux (foyer refonte 2026-05-11 livree).
- Pas de pattern d'interaction nouveau (refontes accompagnante/accompagne/admin/landing/publiques toutes livrees).
- Pas d'exigence a11y nouvelle (Lots A/B/C cloturés 2026-05-06).

**UX-DR1 (impact 5.A indirect)** : Le renommage `accompagnante -> accompagnant` impactera la copy de toutes les pages refondues "foyer" (accompagnante 9 pages, accompagne 7 pages, admin 12 pages, landing 1 page, publiques 13 pages). Find-replace pur dans libelles UI, microtextes, headings, boutons CTA. Effort volumetrique, pas creatif. Aucune modification visuelle. Aucune regression a11y attendue.

**UX-DR2 (a11y a preserver)** : Toute story Epic 5 touchant l'UI doit valider la checklist DoD a11y (labels, focus, contrastes, ARIA, clavier, lecteur d'ecran) avant merge et executer `npm run a11y:axe:check` exit 0 (regle CLAUDE.md ligne 6, baseline 0 violation Critical/Serious sur 7 parcours critiques).

## FR Coverage Map

| FR/NFR/UX-DR | Mini-epic | Story principale |
|---|---|---|
| FR1, FR2, FR4-5 (auth + RGPD) | 5.A | 5.A.2 (migration BDD) + 5.A.4 (routes + redirects 301) |
| FR7, FR11-12 (verification auxiliaire) | 5.A | 5.A.2 (migration) + 5.A.5 (copy admin queue + emails convocation visio) |
| FR16-19 (paywall + annonces) | 5.A + 5.B | 5.A.5 (copy paywall + pages annonces) + 5.B.3 (validation type URL admin) |
| FR27 (messages temps reel) | 5.B | 5.B.1 (oracle role) + 5.B.2 (doublons) |
| FR28-29 (notif + historique messages) | 5.A | 5.A.5 (templates emails Resend) |
| FR45-46, FR48 (couverture geographique) | 5.D | 5.D.1 (cron notify-waitlist-retry) + 5.D.2 (BATCH_LIMIT send-waitlist) |
| NFR2 securite (oracle role + doublons + RLS) | 5.A + 5.B | 5.A.2 (RLS helpers preserves) + 5.B.1 + 5.B.2 |
| NFR4 integrations (oncall) | 5.E | 5.E.1 |
| NFR5 fiabilite (queue + audits 30j) | 5.B + 5.D | 5.B.2 + 5.D.1 + 5.D.2 |
| NFR6 a11y baseline (0 Critical/Serious) | toutes | DoD a11y systematique + validation finale 5.A.6 |
| UX-DR1 copy renommage volumetrique | 5.A | 5.A.5 (find-replace global UI + emails) |
| UX-DR2 a11y a preserver | toutes | DoD a11y inclus dans chaque story Epic 5 (regle CLAUDE.md ligne 6) |

**Couverture totale** : 13 FRs (FR1, FR2, FR4-5, FR7, FR11-12, FR16-19, FR27-29, FR45-46, FR48), 5 NFRs (NFR2, NFR4, NFR5, NFR6 + impact NFR1 perf preserve), 2 UX-DRs. Toutes les exigences inventoriees au step 1 sont mappees a au moins une story.

## Story List

**5 mini-epics, 16 stories au total.** Sequencage : 5.C et 5.E parallelisables des le deblocage Epic 5 ; 5.A sequentiel strict (chaine 5.A.1 -> 5.A.6) ; 5.B demarrable apres merge 5.A ; 5.D differe naturellement a ~2026-06-08 (audit 30j post-Epic 4).

### Mini-epic 5.A - Renommage `accompagnante` -> `accompagnant` (6 stories)

| # | Titre | Valeur livree | Severite | Ordre |
|---|---|---|---|---|
| **5.A.1** | Architecture review : strategie migration enum `role` + plan de cutover | Decision actee (mapping retro-compat vs cutover sec, ordre operations BDD/code/redirects) | Verte | 1 (prealable ~0.5j) |
| **5.A.2** | Migration BDD enum `role` + colonnes `accompagnante_id` -> `accompagnant_id` + helpers RLS | Schema BDD aligne masculin, RLS preservees, AC RGPD respectes (FR1, FR2, FR4, FR5) | Rouge | 2 (coeur du chantier) |
| **5.A.3** | Regeneration `types/supabase.ts` + resorption references code TS (server actions, queries, types locaux) | Code TS strictement type sur nouveau schema, build vert | Orange | 3 (depend 5.A.2) |
| **5.A.4** | Renommage 6 dossiers routes `/accompagnante/*` -> `/accompagnant/*` + redirects 301 + middleware | URLs publiques alignees, pas de lien mort, SEO preserve | Orange | 4 (depend 5.A.3) |
| **5.A.5** | Find-replace global copy UI + emails (libelles, microtextes, headings, CTAs, 9 templates Resend) | Coherence editoriale visible utilisateur final | Verte | 5 (depend 5.A.4) |
| **5.A.6** | Tests E2E Playwright sur 6 parcours critiques + validation a11y baseline + doc DECISIONS.md | Non-regression bout-en-bout + tracabilite decisionnelle | Verte | 6 (validation finale) |

### Mini-epic 5.B - Bugs latents `deferred-work` (3 stories)

| # | Titre | Valeur livree | Severite | Ordre |
|---|---|---|---|---|
| **5.B.1** | Fix oracle de role messagerie : message d'erreur unique generique `getOrCreateConversation*` | Securite NFR2 : suppression vecteur d'enumeration role d'un compte cible | Orange | 1 |
| **5.B.2** | Fix doublons conversations : `.maybeSingle()` + UNIQUE constraint BDD + migration anti-doublons retroactive | Integrite messagerie : 1 conversation = 1 paire utilisateurs | Orange | 2 |
| **5.B.3** | Validation stricte `type` URL admin annonces (whitelist + fallback explicite) | Hardening admin UX : 0 page silencieusement vide sur URL trafiquee | Verte | 3 |

**Note 5.B** : bloque par 5.A (touche `messages.ts` que 5.A.3 va re-typer). Demarre apres 5.A merged.

### Mini-epic 5.C - Hardening typage + nettoyage CI (4 stories)

| # | Titre | Valeur livree | Severite | Ordre |
|---|---|---|---|---|
| **5.C.1** | Resorption `as any` hors `app/admin/` (17 fichiers, 48 erreurs TS) + extension garde-fou `check:as-any` transverse | Code TS strict transverse, plus de cast paresseux | Orange | 1 (independant) |
| **5.C.2** | Suppression endpoint `/api/test-sentry` temporaire (AI-4.6) | Surface API minimale en prod (1 route morte en moins) | Verte | 2 (rapide) |
| **5.C.3** | Normalisation IPv6 mapped `::ffff:1.2.3.4` -> IPv4 dans rate-limit / Sentry tags (AI-4.15) | Metriques securite plus propres, agregation par IP fiable | Verte | 3 |
| **5.C.4** | Script `vercel env add` automatise pour push REQUIRED vars post-merge (AI-4.10) | Plus de drift env prod/preview, onboarding contributeurs simplifie | Verte | 4 |

**Note 5.C** : entierement independant. Peut tourner en parallele de 5.A/5.B.

### Mini-epic 5.D - Audits post-stabilisation 30j (2 stories conditionnelles)

| # | Titre | Valeur livree | Severite | Ordre |
|---|---|---|---|---|
| **5.D.1** | Audit + suppression cron `notify-waitlist-retry` apres 30j zero signal (AI-4.5) | Surface cron reduite (1 cron en moins si zero signal 30j) | Verte | 1 (audit ~2026-06-08) |
| **5.D.2** | Audit + suppression `BATCH_LIMIT=200` send-waitlist apres queue stable 30j (AI-4.7) | Send-waitlist sans plafond artificiel si queue stable 30j | Verte | 2 (audit ~2026-06-08) |

**Note 5.D** : stories declenchees par calendrier (>30j apres cloture Epic 4 = ~2026-06-08). Pre-requis explicite : zero signal d'incident sur les workarounds pendant la fenetre.

### Mini-epic 5.E - Observabilite oncall (1 story)

| # | Titre | Valeur livree | Severite | Ordre |
|---|---|---|---|---|
| **5.E.1** | Coupling Sentry -> PagerDuty/Slack (alertes oncall sur exceptions critiques) | Sylvain notifie activement sur incidents prod (vs dashboard passive) | Orange | 1 (independant) |

**Note 5.E** : Sylvain decide la plateforme (PagerDuty/Slack/Opsgenie) avant demarrage. Independant. Peut tourner en parallele.

### Recapitulatif

- **16 stories au total** (6+3+4+2+1)
- **Severites** : 1 Rouge (5.A.2 migration BDD), 6 Orange (oracle role, doublons, types, oncall, redirects, typage), 9 Verte
- **Sequencage global** : 5.C + 5.E paralleles des Epic 5 debloque ; 5.A sequentiel strict ; 5.B post-5.A ; 5.D differe ~2026-06-08

### Dependances cles

- **5.A.1 -> 5.A.2 -> 5.A.3 -> 5.A.4 -> 5.A.5 -> 5.A.6** : chaine sequentielle stricte intra-mini-epic A (BDD doit etre alignee avant types, types avant routes, routes avant copy, copy avant tests).
- **5.A merged -> 5.B demarrable** : 5.B touche `messages.ts` re-type par 5.A.3.
- **5.C, 5.E independants** : parallelisables avec 5.A/5.B sans contrainte.
- **5.D conditionne calendrier ~2026-06-08** : audit 30j post-Epic 4 (delai incompressible).

---

## Stories detail

---

## Mini-epic 5.A : Renommage `accompagnante` -> `accompagnant`

**Goal** : Aligner le metier au masculin neutre `accompagnant` (1755 occurrences) du schema BDD jusqu'a la copy publique, en preservant 100% de la fonctionnalite et les baselines a11y/securite.

**FRs couverts** : FR1, FR2, FR4, FR5, FR7, FR11, FR12, FR16, FR18, FR19, FR28, FR29 (impacts indirects).

**Pre-requis** : Pre-requis bloquants Epic 5 leves (AI-4.1, AI-4.2, AI-4.3).

### Story 5.A.1 : Architecture review strategie migration enum role

As Sylvain (developpeur lead),
I want decider formellement la strategie de migration de l'enum BDD `role` ('accompagnante' -> 'accompagnant'), l'ordre des operations BDD/code/redirects, et la fenetre de cutover acceptable, en m'appuyant sur l'inventaire factuel BDD prod ci-dessous,
So that l'execution des stories 5.A.2 a 5.A.6 suit un plan stable, documente dans DECISIONS.md, sans surprise en cours de chantier.

**Inventaire factuel BDD prod (audit MCP 2026-05-13, source de verite, divergent du doc archi 2026-02-09) :**

- **Enum `user_role`** (schema public) : valeurs `'accompagnante'`, `'accompagne'`, `'admin'`. SEULE `'accompagnante'` -> `'accompagnant'` est en scope (les 2 autres sont deja au masculin/neutre).
- **2 tables nommees apres le role feminin a renommer (ou conserver)** : `accompagne_accompagnantes`, `annonces_accompagnantes`. Decision in/out of scope a acter.
- **15 colonnes BDD impactees dans 8 tables** :
  - `accompagne_accompagnantes.accompagnante_user_id` (uuid NOT NULL)
  - `accompagne_accompagnantes.accompagne_id` (uuid NOT NULL, deja masculin)
  - `annonces_accompagnantes.accompagnante_id` (uuid NOT NULL)
  - `annonces_accompagnes.accompagne_id` (uuid NOT NULL, deja masculin)
  - `annonces_accompagnes.message_accompagnantes` (text NULLABLE) -- colonne texte qui contient le terme feminin dans son nom
  - `conversations.accompagnante_id` (uuid NOT NULL)
  - `conversations.accompagne_id` (uuid NULLABLE, deja masculin)
  - `conversations.archived_by_accompagnante` (bool NOT NULL)
  - `conversations.archived_by_accompagne` (bool NOT NULL, deja masculin)
  - `favoris.annonce_accompagnante_id` (uuid NULLABLE)
  - `favoris.annonce_accompagne_id` (uuid NULLABLE, deja masculin)
  - `planning_document_assignments.accompagnante_user_id` (uuid NOT NULL)
  - `planning_documents.accompagne_id` (uuid NOT NULL, deja masculin)
  - `planning_shifts.accompagnante_user_id` (uuid NOT NULL)
  - `planning_shifts.accompagne_id` (uuid NOT NULL, deja masculin)
- **Tables `accompagnantes_profiles` (feminin) et `accompagnes_profiles` (masculin)** : referencees par RLS via sous-queries. Renommage de table casse les policies.
- **Helpers RLS Postgres dans `public` (PAS `auth`)** : `is_accompagnante()`, `is_accompagne()`, `is_admin()`, `is_document_owner()`. Body `is_accompagnante` : `SELECT EXISTS (SELECT 1 FROM public.users WHERE id = auth.uid() AND role = 'accompagnante')`. ATTENTION : nom helper genere ambigu apres renommage (`is_accompagnante` -> `is_accompagnant` cassera l'API code).
- **Au moins 7 RLS policies** referencent directement les tables/colonnes/helpers : `annonces_accompagnantes` (select/insert/update/delete), `annonces_accompagnes` (4 idem), `conversations` (select/insert/update), `messages` (select/insert/update), `planning_documents` (2 policies), `planning_shifts` (2 policies), `planning_document_assignments`, `accompagne_accompagnantes` (2 policies), `storage.objects` bucket `planning-documents`.

**Contraintes techniques Postgres irrefutables :**

- **Suppression d'une valeur d'enum impossible nativement** (`ALTER TYPE ... DROP VALUE` n'existe pas avant Postgres 18). Toute strategie "remplacer la valeur enum" implique : `CREATE TYPE user_role_v2` + migration colonnes + `UPDATE` + `DROP TYPE user_role` + `RENAME TYPE`. Donc rollback enum n'est pas trivial.
- **Renommage d'une table casse les RLS policies referencant son ancien nom** (Postgres ne propage pas automatiquement). Toute strategie renommage table necessite recreation explicite des policies impactees.

**Acceptance Criteria :**

**Given** l'inventaire factuel ci-dessus,
**When** la story est lancee,
**Then** un document `_bmad-output/planning-artifacts/tech-spec-5-a-renommage.md` est cree decrivant : (a) strategie enum retenue (option 1 expand : ajout valeur `'accompagnant'` + dual-write + cutover code + suppression valeur via recreation enum / option 2 cutover atomique avec downtime mesure / option 3 alias via fonction helper SQL), (b) decision sur les 2 tables `accompagne_accompagnantes` et `annonces_accompagnantes` : renommees en scope 5.A ou conservees feminin (dette technique acceptee), (c) decision sur les helpers RLS `is_accompagnante`/`is_accompagne` : renommes en scope 5.A ou conserves feminin (dette acceptee), (d) ordre execution stories 5.A.2 -> 5.A.6, (e) plan rollback PAR mode de defaillance (rollback enum + rollback colonnes + rollback policies + rollback table + rollback code), (f) liste exhaustive des 7+ RLS policies a recreer/auditer,
**And** la decision est ajoutee a DECISIONS.md (decision F12 ou suivante) avec justification.

**Given** la strategie BDD retenue,
**When** la review est validee,
**Then** un plan de validation pre-cutover est defini : (a) export Supabase prod via MCP avant chaque migration, (b) liste des tests automatises a executer (tsc, lint, lint:a11y-check, a11y:axe:check, test:unit, test:e2e), (c) checklist manuelle parcours par role : login `accompagnante`/`accompagnant`, login `accompagne`, login `admin`, envoi message conversation existante, publication annonce auxiliaire, ajout favori, lecture planning shift, telechargement document planning,
**And** un budget temps total estime est documente (jour-dev par story).

**Given** la decision strategie BDD,
**When** elle implique des migrations expand-contract,
**Then** le plan documente explicitement quels objets (enum role, 15 colonnes inventoriees, 2 tables, 4 helpers RLS, 7+ policies) sont migres en mode expand (story 5.A.2) vs contract (story differee post-stabilisation, candidat Epic 6),
**And** la liste des RLS policies dependantes est explicitement reconstituee depuis l'audit `pg_policies` MCP (pas du doc archi).

**Given** la story est terminee,
**When** la decision est prise,
**Then** la story 5.A.2 peut demarrer sans nouvelle prise de decision strategie,
**And** un commit de livraison est cree avec message conforme convention projet (`Story 5.A.1 : ...`).

---

### Story 5.A.2 : Migration BDD enum role + colonnes accompagnante_* + helpers RLS + policies

As Sylvain (developpeur),
I want migrer le schema BDD prod pour aligner enum `role` (valeur `'accompagnante'` -> `'accompagnant'`), les 15 colonnes BDD inventoriees, les helpers RLS impactes, et les 7+ policies referencantes, selon la strategie validee story 5.A.1,
So that la couche persistance reflete le metier final avant la migration code TS (5.A.3) et routes (5.A.4), sans rupture des RLS ni perte de donnees.

**Reference inventaire factuel** : voir story 5.A.1 (15 colonnes, 8 tables impactees, 2 tables potentiellement renommees, 4 helpers RLS Postgres `is_*` schema `public`, 7+ policies pg_policies). Aucun objet a inventer hors de cette liste.

**Acceptance Criteria :**

**Given** la strategie de migration validee story 5.A.1 (`tech-spec-5-a-renommage.md`) avec inventaire factuel a jour,
**When** la story est implementee,
**Then** une migration Supabase est creee dans `supabase/migrations/` qui execute selon la strategie retenue : (a) ajoute la valeur enum `'accompagnant'` au type `user_role` (sans suppression de `'accompagnante'` si expand), (b) ajoute les 8 nouvelles colonnes masculin : `accompagne_accompagnantes.accompagnant_user_id`, `annonces_accompagnantes.accompagnant_id` (ou nouvelle table `annonces_accompagnants` selon decision 5.A.1), `conversations.accompagnant_id`, `conversations.archived_by_accompagnant`, `favoris.annonce_accompagnant_id`, `planning_document_assignments.accompagnant_user_id`, `planning_shifts.accompagnant_user_id`, `annonces_accompagnes.message_accompagnants` (renommee), (c) backfill les nouvelles colonnes depuis les anciennes (`UPDATE ... SET new = old`), (d) cree les helpers RLS `is_accompagnant()` (schema `public`) avec body `SELECT EXISTS (... WHERE role IN ('accompagnante', 'accompagnant'))` pour supporter expand-contract OU body strict `= 'accompagnant'` pour cutover, selon decision 5.A.1, (e) recree les 7+ policies impactees en utilisant les nouvelles colonnes/helpers,
**And** un export Supabase prod via MCP `execute_sql` (`COPY ... TO`) sur les 8 tables impactees + `pg_dump` des policies est realise avant application en prod (snapshot recuperable en cas de rollback).

**Given** la migration est appliquee en dev local + preview env,
**When** les tests de validation tournent,
**Then** les 7+ RLS policies dependantes sont testees individuellement via scenarios Vitest ou Playwright : (a) `conv_select_own` -- un role `accompagnant` lit ses conversations existantes via FK accompagnant_id, (b) `msg_select_own` -- meme test transitif via conversations, (c) `ann_acc_select` / `ann_acc_delete` -- gestion annonces accompagnant, (d) `ann_acg_select` / has_active_subscription pour role `accompagne`, (e) `Accompagne manages own team` (accompagne_accompagnantes), (f) `Assigned accompagnantes read documents` (planning_documents), (g) `storage.objects Planning document readers can download`,
**And** zero perte de ligne dans les 8 tables impactees : `users`, `accompagnantes_profiles`, `accompagnes_profiles`, `accompagne_accompagnantes`, `annonces_accompagnantes`, `annonces_accompagnes`, `conversations`, `favoris`, `planning_document_assignments`, `planning_documents`, `planning_shifts` (count comparatif avant/apres = identique),
**And** les FK contraintes sont preservees (zero orphelin `accompagnant_*` apres backfill, verifiable via `SELECT COUNT(*) FROM <table> WHERE <new_col> IS NULL AND <old_col> IS NOT NULL`).

**Given** la migration est validee preview,
**When** elle est appliquee en prod via MCP `apply_migration`,
**Then** la fenetre de downtime mesuree est < 1 min (cutover) OU 0 (expand-contract),
**And** Sentry n'enregistre aucune nouvelle exception non-attendue dans les 30 minutes suivant l'application (filtre tag `flow !== 'expected-migration'`),
**And** un sanity check manuel est realise sur 7 parcours role : (a) login `accompagnante` (existant) + lecture dashboard, (b) login compte accompagnant nouvellement provisionne + dashboard, (c) login `accompagne` + dashboard, (d) login `admin` + queue validation, (e) envoi message conversation existante (RLS messages), (f) publication annonce auxiliaire (RLS annonces_accompagnantes/accompagnants), (g) telechargement document planning (RLS storage.objects).

**Given** la migration prod est appliquee,
**When** un commit de livraison est cree,
**Then** le commit suit la convention projet (`Story 5.A.2 : ...`),
**And** DECISIONS.md est mis a jour avec resultat cutover (date, downtime mesure, incidents eventuels, mode strategie effectif),
**And** memoire projet `project_renommage_accompagnante_todo` est mise a jour (5.A.2 done, X stories restantes).

**Given** la story touche la BDD prod,
**When** une regression critique est detectee dans les 24h suivantes,
**Then** le rollback playbook documente story 5.A.1 est applique selon le mode de defaillance reel : (a) defaillance RLS policies -- DROP + recreation depuis snapshot pg_policies, (b) defaillance backfill colonnes -- UPDATE inverse depuis snapshot COPY, (c) defaillance enum -- procedure CREATE TYPE user_role_v_rollback + UPDATE + DROP + RENAME (note : suppression directe d'une valeur enum impossible Postgres < 18), (d) defaillance code TS post-merge -- revert commit 5.A.2 + redeploy automatique Vercel,
**And** un incident est ouvert dans DECISIONS.md avec mode de defaillance, action de rollback effective, et delai detection/resolution.

---

### Story 5.A.3 : Regeneration types Supabase + resorption references code TS

As Sylvain (developpeur),
I want regenerer `types/supabase.ts` apres la migration BDD 5.A.2 et resorber toutes les references code TS aux anciens noms (`accompagnante`, `accompagnante_id`),
So that le typage strict TS est aligne sur le nouveau schema et le build CI passe vert.

**Acceptance Criteria :**

**Given** la migration BDD 5.A.2 appliquee en prod,
**When** la story est lancee,
**Then** `types/supabase.ts` est regenere via le pattern Epic 4 story 4.6 (`scripts/gen-types-supabase.mjs` MCP) et reflete l'enum `role` + colonnes `accompagnant_id`,
**And** les anciennes definitions (`accompagnante`, `accompagnante_id`) sont absentes du fichier regenere (ou presentes uniquement en mode expand temporaire, selon strategie 5.A.1).

**Given** les types regeneres,
**When** `tsc` est lance,
**Then** toutes les erreurs TS liees au renommage sont identifiees,
**And** chaque erreur est resorbee dans le code (server actions, queries, types locaux, helpers),
**And** `tsc` exit 0 sans warning ni erreur.

**Given** les erreurs TS sont resorbees,
**When** les server actions touchant le role sont auditees,
**Then** les literaux `'accompagnante'` dans les conditions `role === ...` sont remplaces par `'accompagnant'`,
**And** les references aux colonnes BDD `accompagnante_id` sont remplacees par `accompagnant_id` dans les queries Supabase (`select`, `eq`, `insert`, `update`),
**And** les types locaux derives (`type Role = 'accompagnante' | ...`) sont mis a jour.

**Given** le code TS est resorbe,
**When** la suite CI tourne (build, lint, lint:a11y-check, test:unit),
**Then** tous les checks passent vert,
**And** la baseline `lint:a11y-check` 155 est preservee,
**And** zero regression `eslint-plugin-jsx-a11y`.

**Given** la story est terminee,
**When** un commit de livraison est cree,
**Then** le commit suit la convention projet (`Story 5.A.3 : ...`),
**And** la story 5.A.4 (routes) peut demarrer car le code TS compile sur le nouveau schema.

---

### Story 5.A.4 : Renommage routes /accompagnante/* + redirects 301 + middleware

As Sylvain (developpeur),
I want renommer les 6 dossiers de routes `/accompagnante/{abonnement,annonces,dashboard,onboarding,parrainage,profil}` en `/accompagnant/*` et installer des redirects 301 sur les anciennes URLs,
So that les URLs publiques sont alignees `accompagnant` sans casser les liens existants (SEO + bookmarks utilisateurs + emails deja envoyes).

**Acceptance Criteria :**

**Given** la migration BDD 5.A.2 et code TS 5.A.3 livres,
**When** la story est lancee,
**Then** les 6 dossiers `app/accompagnante/{abonnement,annonces,dashboard,onboarding,parrainage,profil}/` sont renommes en `app/accompagnant/*` (via `git mv` pour preserver l'historique),
**And** les imports internes referencant ces chemins sont mis a jour.

**Given** les routes sont renommees,
**When** le middleware Next.js (`middleware.ts`) est audite,
**Then** les regles existantes mentionnant `/accompagnante/*` sont dupliquees pour `/accompagnant/*` (verifier RBAC, paywall, redirect login),
**And** un test manuel confirme : un utilisateur role accompagnant accede a `/accompagnant/dashboard` sans erreur 403/404.

**Given** les nouvelles routes fonctionnent,
**When** la configuration des redirects 301 est ajoutee (via `next.config.ts` ou `middleware.ts`),
**Then** toute requete `/accompagnante/<path>/<id?>` redirige en 301 vers `/accompagnant/<path>/<id?>` (preservation du chemin complet et des params),
**And** les redirects sont testes pour les 6 dossiers + 1 cas avec query string + 1 cas avec dynamic segment.

**Given** les redirects 301 sont en place,
**When** un email transactionnel deja envoye (avant cutover) avec un lien `/accompagnante/...` est clique,
**Then** l'utilisateur arrive sur la nouvelle page sans message d'erreur,
**And** le 301 est verifiable via curl `-I` (status code 301 + header Location).

**Given** la story est terminee,
**When** la suite CI tourne (build, lint, a11y:axe:check, test:e2e si applicable),
**Then** tous les checks passent vert,
**And** un commit de livraison est cree (`Story 5.A.4 : ...`),
**And** la story 5.A.5 (copy UI) peut demarrer car les pages sont accessibles via les nouvelles URLs.

---

### Story 5.A.5 : Find-replace global copy UI + emails + templates Resend

As Sylvain (developpeur),
I want resorber toutes les occurrences textuelles `accompagnante` / `accompagnantes` dans la copy UI, microtextes, headings, CTAs, et 9 templates emails Resend,
So that l'utilisateur final voit `accompagnant` / `accompagnants` au masculin neutre partout, conformement a la regle CLAUDE.md ligne 6.

**Acceptance Criteria :**

**Given** les stories 5.A.2 a 5.A.4 livrees,
**When** la story est lancee,
**Then** un grep exhaustif est realise (`grep -rn "accompagnante\|accompagnantes" --include="*.tsx" --include="*.ts" --include="*.md" .`),
**And** chaque occurrence est categorisee : (a) copy UI a remplacer en `accompagnant`/`accompagnants`, (b) code metier historique a preserver au feminin pour cette story (cf. CLAUDE.md), (c) docs `_bmad-output/` a remplacer pour coherence editoriale.

**Given** les occurrences sont categorisees,
**When** le find-replace est applique,
**Then** la copy UI dans les 42 pages refondues "foyer" (accompagnante 9, accompagne 7, admin 12, landing 1, publiques 13) affiche `accompagnant`/`accompagnants` au masculin,
**And** les libelles formulaires (`<label>`, placeholder, helper text), boutons CTA, headings (`<h1>` a `<h6>`), microtextes, et messages d'erreur sont alignes,
**And** les liens vers les nouvelles routes `/accompagnant/*` sont a jour.

**Given** les 9 templates Resend (matching_standard, matching_pch, matching_apa, validation_accepted, validation_refusee, validation_a_completer, nouveau_message, weekly_digest, subscription_expiring),
**When** ils sont audites,
**Then** chaque template utilise `accompagnant`/`accompagnants` (sujets + corps + bouton CTA + lien),
**And** un envoi de test (preview) confirme le rendu visuel.

**Given** la story touche l'UI,
**When** la regle CLAUDE.md ligne 6 (a11y) est appliquee,
**Then** `npm run a11y:axe:check` exit 0 (baseline 0 Critical/Serious sur 7 parcours preservee),
**And** la baseline `lint:a11y-check` 155 est preservee.

**Given** la story est terminee,
**When** un commit de livraison est cree (`Story 5.A.5 : ...`),
**Then** la copy bug `Tous les accompagnantes` (recherche/page.tsx:382) est corrigee absorbeed (`Tous les accompagnants`),
**And** la copy bug `Demandes accompagnés` (dashboard accompagnante:318) est corrigee absorbeed (`Demandes des accompagnes`),
**And** memoire projet `feedback_genre_accompagnant` confirme : 0 occurrence feminin restante dans la copy UI.

---

### Story 5.A.6 : Tests E2E + validation a11y + documentation DECISIONS.md

As Sylvain (developpeur),
I want valider bout-en-bout via Playwright les 6 parcours critiques avec la nouvelle terminologie, confirmer la preservation a11y, et documenter dans DECISIONS.md la cloture du chantier,
So that le mini-epic 5.A est cloture proprement avec preuve de non-regression et tracabilite.

**Acceptance Criteria :**

**Given** les stories 5.A.2 a 5.A.5 livrees,
**When** la suite E2E Playwright `npm run test:e2e` est executee,
**Then** les 6 parcours critiques passent vert : (a) onboarding accompagnant, (b) recherche/favoris, (c) messagerie temps reel, (d) login + register + checkout Stripe, (e) landing publique, (f) suppression compte / export RGPD,
**And** les nouveaux paths `/accompagnant/*` sont referenced dans les fixtures de test (pas d'ancien path),
**And** les redirects 301 sont testes (un seul cas pour valider non-regression).

**Given** la story touche l'UI applicative,
**When** `npm run a11y:axe:check` est execute,
**Then** exit 0 (zero violation Critical/Serious sur 7 parcours baseline),
**And** la baseline lint:a11y-check 155 est preservee,
**And** un test manuel ponctuel VoiceOver/NVDA est realise sur 2 parcours (onboarding + messagerie) pour confirmer la coherence audio.

**Given** le mini-epic 5.A est cloture,
**When** DECISIONS.md est mis a jour,
**Then** une nouvelle decision F-Epic5-A1 (ou suivante) documente : (a) date de cloture, (b) downtime cumule mesure, (c) strategie BDD effectivement retenue, (d) AC15 deferred-work eventuels,
**And** memoire projet `project_renommage_accompagnante_todo` est supprimee ou marquee `done` (le chantier est plus actif).

**Given** le mini-epic est valide,
**When** la story 5.A.6 livre son commit final,
**Then** un commit est cree (`Story 5.A.6 : ...`) avec mention "Mini-epic 5.A cloture",
**And** la suite CI complete (build, tsc, lint, lint:a11y-check, a11y:axe:check, test:unit, test:e2e) passe verte sur preview puis prod,
**And** le mini-epic 5.B (bugs latents) peut demarrer car `messages.ts` est re-type et stable.

---

## Mini-epic 5.B : Bugs latents `deferred-work`

**Goal** : Resorber 3 bugs latents identifies en review Epic 3/4 dans `deferred-work.md` (oracle de role messagerie, doublons conversations, validation type URL admin annonces) pour eliminer les vecteurs d'enumeration de role et les regressions UX silencieuses.

**FRs couverts** : FR27 (messages temps reel), FR28 (notif message), FR29 (historique). NFR2 (securite : oracle role + RLS), NFR5 (fiabilite : integrite messagerie).

**Pre-requis** : Mini-epic 5.A merged (`messages.ts` re-type avec nouveau schema).

### Story 5.B.1 : Fix oracle de role messagerie

As un utilisateur connecte non-abonne,
I want que le message d'erreur retourne par `getOrCreateConversation*` soit identique quel que soit le role du compte cible,
So that je ne puisse pas inferer si un identifiant tiers correspond a un accompagnant ou un beneficiaire en testant des appels API.

**Acceptance Criteria :**

**Given** la situation actuelle (`app/actions/messages.ts:64,127`) ou les erreurs differencient `'... contacter un accompagnant.'` vs `'... contacter un beneficiaire.'`,
**When** la story est implementee,
**Then** les deux server actions `getOrCreateConversationAsAuxiliaire` et `getOrCreateConversationAsBeneficiaire` retournent un message d'erreur generique unique `'Abonnement requis pour contacter cet utilisateur.'`,
**And** aucun indice de role n'est revelable depuis le message d'erreur cote client.

**Given** un compte connecte non-abonne,
**When** il appelle `getOrCreateConversation*` sur un userId arbitraire (accompagnant OU beneficiaire OU inexistant),
**Then** le code de retour est identique dans les 3 cas (meme HTTP status, meme texte d'erreur),
**And** aucun delai de reponse different ne permet d'inferer le role (les 2 paths empruntent un retour anticipe identique).

**Given** la story est terminee,
**When** un test unitaire Vitest est ajoute (`tests/unit/messages.test.ts`),
**Then** il verifie pour chaque server action que : (a) message d'erreur identique pour 2 ids de roles differents, (b) message d'erreur identique pour un id inexistant, (c) zero leak via stack trace en mode prod.

**Given** la story est livree,
**When** un commit est cree (`Story 5.B.1 : ...`),
**Then** la story 5.B.2 (doublons) peut demarrer,
**And** Sentry tag `security: 'oracle-fix'` est applique sur les 2 server actions pour tracking.

---

### Story 5.B.2 : Fix doublons conversations + UNIQUE constraint BDD

As Sylvain (developpeur),
I want que `getOrCreateConversation*` utilise `.maybeSingle()` au lieu de `.single()` et qu'une contrainte UNIQUE BDD garantisse 1 conversation = 1 paire `(accompagnant_id, accompagne_id)`,
So that la messagerie ne peut plus creer de doublons en cas d'erreur transitoire Supabase ou de race condition.

**Acceptance Criteria :**

**Given** la situation actuelle (`app/actions/messages.ts:51-67,107-130`) ou `.single()` masque les erreurs DB silencieusement et peut entrainer un INSERT en doublon,
**When** la story est implementee,
**Then** les server actions utilisent `.maybeSingle()` qui distingue clairement (a) 0 row trouve (creation), (b) 1 row trouve (retour existant), (c) erreur DB (propagation explicite),
**And** les erreurs DB transitoires (`error !== null`) sont loggees Sentry (tag `flow: 'messaging'`) et propagent une erreur server claire au client.

**Given** la table `conversations` peut potentiellement contenir des doublons retroactifs (audit BDD prod a faire),
**When** une migration de hardening est creee,
**Then** elle (a) detecte les doublons existants via query `GROUP BY (accompagnant_id, accompagne_id) HAVING COUNT(*) > 1`, (b) consolide les doublons en gardant la conversation la plus ancienne (et migrant les messages des doublons), (c) ajoute la contrainte `UNIQUE (accompagnant_id, accompagne_id)` sur conversations,
**And** la migration est testee sur un export prod via MCP avant application.

**Given** la contrainte UNIQUE est en place,
**When** un INSERT en doublon est tente (course condition),
**Then** Postgres reject l'insert avec code `23505` (unique_violation),
**And** la server action catch ce cas et retourne la conversation existante (idempotence preservee).

**Given** la story est terminee,
**When** un test d'integration Vitest est ajoute,
**Then** il verifie : (a) 1er appel cree la conversation, (b) 2eme appel concurrent retourne la meme conversation (pas de doublon), (c) 3eme appel apres deletion BDD recree proprement.

**Given** un commit de livraison est cree (`Story 5.B.2 : ...`),
**When** la story est validee,
**Then** la story 5.B.3 peut demarrer.

---

### Story 5.B.3 : Validation stricte type URL admin annonces

As Sylvain (admin),
I want que la page `/admin/annonces` valide strictement le param `type` recu en URL et affiche un fallback explicite si la valeur est invalide,
So that une URL avec `?type=foo` ou `?type=Accompagnante` n'affiche pas silencieusement "0 annonces" alors qu'il y en a en BDD.

**Acceptance Criteria :**

**Given** la situation actuelle (`app/admin/annonces/page.tsx:80,116`) ou `params.type` est lu brut et cast force en `'accompagnant' | 'accompagne'`,
**When** la story est implementee,
**Then** une whitelist constante `const TYPE_VALUES = ['accompagnant', 'accompagne'] as const` est definie,
**And** la valeur URL est validee : si absente -> defaut `'accompagnant'`, si presente et valide -> utilisee, si presente et invalide -> redirect vers URL canonique sans param ou banner d'avertissement.

**Given** une URL `/admin/annonces?type=foo`,
**When** la page est rendue,
**Then** l'admin voit un message explicite (`Filtre 'foo' inconnu, affichage par defaut`) en lieu du faux 0 silencieux,
**And** la page rend les annonces du type par defaut.

**Given** la story est terminee,
**When** un test d'integration est ajoute (Playwright OU Vitest avec mock router),
**Then** il verifie : (a) URL `?type=accompagnant` rend les annonces accompagnant, (b) URL `?type=accompagne` rend les annonces accompagne, (c) URL `?type=invalid` rend le fallback avec banner.

**Given** la story est livree,
**When** un commit est cree (`Story 5.B.3 : ...`),
**Then** le mini-epic 5.B est cloture (3/3 stories done),
**And** memoire projet ou deferred-work.md est mis a jour pour retirer ces 3 items.

---

## Mini-epic 5.C : Hardening typage + nettoyage CI

**Goal** : Solder 4 dettes Epic 4 transverses sur le typage TS et la propreté de la surface API/CI : resorption `as any` hors admin (17 fichiers), nettoyage endpoint test temporaire, normalisation IPv6, automatisation push vars env.

**FRs couverts** : aucun (chantier technique, NFR4 + NFR5).

**Pre-requis** : aucun. Entierement parallele de 5.A/5.B.

### Story 5.C.1 : Resorption `as any` hors `app/admin/`

As Sylvain (developpeur),
I want resorber les 8 occurrences `as any` + 48 erreurs TS identifiees en review story 4.6 dans les 17 fichiers hors `app/admin/` et etendre le garde-fou `check:as-any-admin` en `check:as-any-global`,
So that le typage strict TypeScript est preserve transversalement et plus aucun cast paresseux ne peut etre introduit en CI.

**Acceptance Criteria :**

**Given** l'inventaire 4.6 (memoire projet) liste 17 fichiers hors admin avec `as any` ou cascades `(x: any)` non resorbes,
**When** la story est lancee,
**Then** chaque fichier est audite et le cast `as any` est remplace par : (a) le bon type Supabase genere, (b) un type local explicite, (c) un `unknown` + narrowing, ou (d) `as unknown as <T>` localise si vraiment necessaire et documente en commentaire,
**And** le typage strict TSC compile vert sur l'ensemble.

**Given** les 8 `as any` resorbes,
**When** le garde-fou existant `scripts/check-as-any-admin.mjs` (AST) est etendu,
**Then** il devient `check-as-any-global.mjs` couvrant tous les fichiers TS/TSX du projet (avec eventuelles exceptions documentees en allowlist),
**And** la commande `npm run check:as-any` est ajoutee a `vercel.json` buildCommand.

**Given** la story est livree,
**When** la suite CI tourne,
**Then** `tsc` passe vert, `lint` reste en baseline 213 warnings (ou moins), `check:as-any` exit 0,
**And** un commit est cree (`Story 5.C.1 : ...`).

---

### Story 5.C.2 : Suppression endpoint `/api/test-sentry` temporaire

As Sylvain (developpeur),
I want supprimer l'endpoint `/api/test-sentry` ajoute pendant la story 4.1 pour valider l'instrumentation Sentry,
So that la surface API en prod est minimale et qu'il n'existe plus de route morte exploitable.

**Acceptance Criteria :**

**Given** la route `app/api/test-sentry/route.ts` existe en prod (ajout temporaire story 4.1),
**When** la story est implementee,
**Then** le fichier `app/api/test-sentry/route.ts` est supprime,
**And** la documentation interne (si presente) referencant cet endpoint est mise a jour.

**Given** la suppression,
**When** la suite CI tourne (build, deploy preview),
**Then** zero reference orpheline a `/api/test-sentry` (grep code),
**And** Sentry continue de capturer les exceptions reelles (test : declencher une erreur intentionnelle dans une route metier et verifier presence sur Sentry).

**Given** la story est livree,
**When** un commit est cree (`Story 5.C.2 : ...`),
**Then** AI-4.6 est marque done.

---

### Story 5.C.3 : Normalisation IPv6 mapped -> IPv4

As Sylvain (developpeur),
I want normaliser les adresses IPv6 "IPv4-mapped" (`::ffff:1.2.3.4`) en leur forme IPv4 canonique dans le rate-limit et les tags Sentry,
So that les metriques securite agreges par IP soient fiables et que le rate-limit n'isole pas a tort les memes utilisateurs sous deux representations differentes.

**Acceptance Criteria :**

**Given** la situation actuelle ou `request.ip` ou les headers `x-forwarded-for` peuvent contenir `::ffff:1.2.3.4`,
**When** une fonction helper `normalizeIp(ip: string): string` est creee,
**Then** elle (a) detecte les prefixes `::ffff:` et extrait la partie IPv4, (b) preserve les vraies IPv6 (non-mapped), (c) preserve les IPv4 deja canoniques, (d) retourne `'unknown'` pour les valeurs invalides.

**Given** le helper `normalizeIp`,
**When** les call sites sont mis a jour (rate-limit `try_consume_rate_limit`, tags Sentry `ip_normalized`, logs admin),
**Then** toutes les ecritures BDD ou tags utilisent la forme normalisee,
**And** un test unitaire Vitest couvre 4 cas : IPv4-mapped, vraie IPv6, IPv4 canonique, valeur invalide.

**Given** la story est livree,
**When** un commit est cree (`Story 5.C.3 : ...`),
**Then** AI-4.15 est marque done.

---

### Story 5.C.4 : Script `vercel env add` automatise pour push REQUIRED vars post-merge

As Sylvain (developpeur),
I want un script `scripts/vercel-env-push.mjs` automatise qui synchronise les variables d'environnement REQUIRED depuis `.env.example` vers Vercel (Production + Preview) apres chaque merge sur main,
So that l'on elimine la configuration manuelle par environnement et le risque de drift entre prod et preview.

**Acceptance Criteria :**

**Given** la liste REQUIRED des env vars est definie dans `scripts/check-required-env.mjs` (story 4.8),
**When** le script `scripts/vercel-env-push.mjs` est cree,
**Then** il (a) lit la liste REQUIRED, (b) prompt l'utilisateur pour saisir les valeurs manquantes localement, (c) invoque `vercel env add <name> <env>` via Vercel CLI pour Production + Preview,
**And** il refuse de pousser des valeurs vides ou des secrets bidons (validation pattern).

**Given** le script execute en mode CI,
**When** il est integre dans la documentation `_bmad-output/planning-artifacts/architecture-technique-roxanetnous-2026-02-09.md` (section Stack Technique),
**Then** la procedure est documentee comme reference pour onboarding contributeurs,
**And** un test manuel confirme push vars sur un projet Vercel sandbox.

**Given** la story est livree,
**When** un commit est cree (`Story 5.C.4 : ...`),
**Then** AI-4.10 est marque done, et le mini-epic 5.C est cloture (4/4 done).

---

## Mini-epic 5.D : Audits post-stabilisation 30j

**Goal** : Apres une fenetre de stabilite production de 30 jours suivant la cloture Epic 4, supprimer les workarounds defensifs (cron retry waitlist + BATCH_LIMIT send-waitlist) si zero signal d'incident n'a ete enregistre.

**FRs couverts** : FR45, FR46, FR48 (couverture geographique et waitlist). NFR5 (fiabilite : surface code reduite).

**Pre-requis** : >= 30 jours apres cloture Epic 4 (declencheur ~2026-06-08). Audit Sentry/GHA zero signal pendant la fenetre.

### Story 5.D.1 : Audit + suppression cron `notify-waitlist-retry`

As Sylvain (developpeur),
I want auditer les logs et metriques Sentry sur 30 jours post-Epic 4 pour le cron `notify-waitlist-retry` (ajoute story 4.3 comme safety-net), et le supprimer si zero retry n'a effectivement ete declenche,
So que la surface cron en prod soit minimale et alignee sur la fiabilite reelle de la queue durable Workflow DevKit.

**Acceptance Criteria :**

**Given** au moins 30 jours ecoules depuis la cloture Epic 4 (2026-05-08, soit >= 2026-06-08),
**When** la story est lancee,
**Then** un audit est realise sur (a) logs Vercel Cron du cron `notify-waitlist-retry` (occurrences, exit codes), (b) metriques Sentry pour erreurs queue waitlist, (c) table `notifications_log` filtre `type='waitlist_notify_retry'`,
**And** un rapport d'audit est documente dans `_bmad-output/implementation-artifacts/audit-cron-notify-waitlist-2026-06-08.md` (ou date du run).

**Given** l'audit conclut "zero retry declenche, zero incident",
**When** la suppression du cron est implementee,
**Then** l'entree `crons` dans `vercel.json` referencant `notify-waitlist-retry` est supprimee,
**And** le fichier `app/api/cron/notify-waitlist-retry/route.ts` (ou equivalent) est supprime,
**And** la migration BDD eventuelle (table tampon) est evaluee : suppression si non utilisee ailleurs, conservation sinon.

**Given** l'audit conclut "retries effectivement declenches" ou "incidents detectes",
**When** la story est decidee,
**Then** le cron est conserve en prod,
**And** une story 5.D.1.b "investigation root-cause retries" est creee.

**Given** la story est livree,
**When** un commit est cree (`Story 5.D.1 : ...`),
**Then** AI-4.5 est marque done (ou conditional si conservation),
**And** la story 5.D.2 peut demarrer.

---

### Story 5.D.2 : Audit + suppression `BATCH_LIMIT=200` send-waitlist

As Sylvain (developpeur),
I want auditer les metriques d'envoi waitlist sur 30 jours pour confirmer que la queue durable Workflow DevKit gere correctement des batches > 200 sans degradation, et supprimer la limite defensive `BATCH_LIMIT=200`,
So que send-waitlist puisse honorer des ouvertures de departements a forte audience sans plafond artificiel.

**Acceptance Criteria :**

**Given** au moins 30 jours ecoules depuis la cloture Epic 4 et la livraison de la queue durable (story 4.3) + audit story 5.D.1,
**When** la story est lancee,
**Then** un audit metriques est realise sur (a) volume de notifications send-waitlist sur 30 jours, (b) p50/p95/max temps d'execution, (c) taux d'erreur Resend / Vercel Function timeouts,
**And** un rapport est documente dans `_bmad-output/implementation-artifacts/audit-batch-limit-send-waitlist-2026-06-08.md`.

**Given** l'audit conclut "queue stable, marge de croissance suffisante",
**When** la suppression du BATCH_LIMIT est implementee,
**Then** la constante `BATCH_LIMIT = 200` dans `send-waitlist` (ou config equivalente) est supprimee OU portee a valeur >= 1000 selon decision Sylvain,
**And** un test de charge ponctuel (ouverture d'un departement fictif >300 emails) est realise sur preview env.

**Given** la story est livree,
**When** un commit est cree (`Story 5.D.2 : ...`),
**Then** AI-4.7 est marque done,
**And** le mini-epic 5.D est cloture (2/2 done).

---

## Mini-epic 5.E : Observabilite oncall

**Goal** : Completer l'instrumentation Sentry livree Epic 4 par un coupling vers une plateforme oncall (PagerDuty, Slack, ou Opsgenie) pour notifier Sylvain activement sur les exceptions critiques en production, plutot que de dependre de la consultation passive du dashboard Sentry.

**FRs couverts** : aucun direct. NFR4 (integrations sortantes), NFR5 (fiabilite : detection rapide incidents).

**Pre-requis** : Sentry SDK livre Epic 4 story 4.1, compte Sentry actif. Sylvain decide la plateforme oncall avant demarrage.

### Story 5.E.1 : Coupling Sentry -> plateforme oncall

As Sylvain (admin/fondateur),
I want recevoir une notification active (push mobile, SMS, Slack) lorsqu'une exception critique est enregistree dans Sentry en production,
So que je puisse intervenir sur les incidents prod sans avoir a consulter le dashboard Sentry passivement.

**Acceptance Criteria :**

**Given** un compte Sentry actif (Epic 4 story 4.1) et une plateforme oncall choisie (PagerDuty, Slack, ou Opsgenie selon decision Sylvain en pre-requis story),
**When** la story est implementee,
**Then** l'integration native Sentry vers la plateforme est configuree (Sentry Settings -> Integrations -> <platform>),
**And** un test manuel confirme : declencher une erreur intentionnelle taggee `severity: 'critical'` en preview env, verifier reception sur la plateforme oncall sous 2 minutes.

**Given** l'integration fonctionnelle,
**When** les regles d'alerte Sentry sont definies,
**Then** elles couvrent (a) toute nouvelle exception non-resolved + tag `severity: 'critical'`, (b) un seuil de frequence > 10 exceptions/min sur n'importe quel tag, (c) une erreur dans les chemins critiques (Stripe webhook, fraude parrainage, paiement),
**And** les alertes non-critical (warnings) sont aggregees en digest quotidien plutot que push individuel.

**Given** la story est livree,
**When** un commit / changement de config Sentry est documente,
**Then** la documentation `_bmad-output/planning-artifacts/architecture-technique-roxanetnous-2026-02-09.md` (section Monitoring/Observabilite) est mise a jour avec la nouvelle integration,
**And** DECISIONS.md ajoute une decision F-Epic5-E1 (plateforme retenue + justification),
**And** le mini-epic 5.E est cloture (1/1 done).

---

## Indicateurs de succes post-Epic 5 (a mesurer 30 jours apres cloture)

**Coherence editoriale (5.A) :**

- **0 occurrence** `accompagnante`/`accompagnantes` dans la copy UI publique (grep tooling-agnostique sur `app/`, `components/`, `emails/`, `public/`), hors exceptions documentees historiques.
- **0 lien 404** retourne sur des URLs `/accompagnante/*` (audit Sentry + GoogleSearchConsole + manual sample emails > 30j).
- **0 regression a11y** : baseline `@axe-core/playwright` reste 0 violation Critical/Serious sur 7 parcours critiques (regle CLAUDE.md ligne 6 preserve).
- **DECISIONS.md F-Epic5-A1** documente le downtime cumule reel mesure (cible : < 5 min cumule sur tous les cutovers BDD).

**Securite messagerie (5.B) :**

- **0 vecteur d'enumeration role** detectable via les server actions `getOrCreateConversation*` (test de penetration leger via curl/Postman).
- **0 doublon de conversation** dans la table `conversations` (query `GROUP BY (accompagnant_id, accompagne_id) HAVING COUNT(*) > 1` retourne 0 ligne).
- **0 regression Sentry** taggee `flow: 'messaging'` apres deploiement.

**Hardening typage (5.C) :**

- **0 occurrence `as any`** hors allowlist explicite documentee (verification `npm run check:as-any` exit 0 globalement, pas seulement admin).
- **0 endpoint `/api/test-sentry`** en prod (verification curl 404).
- **0 IP au format `::ffff:...`** dans les tags Sentry et `admin_actions_log.details` (verification query Supabase).
- **Script `vercel env add` automatise** documente et utilisable par un nouveau contributeur (test : reproduction par Sylvain en preview env).

**Audits post-stabilisation (5.D) :**

- **0 cron `notify-waitlist-retry`** en prod (verification `vercel.json` crons section).
- **0 plafond artificiel** sur `send-waitlist` BATCH_LIMIT (verification code grep + audit envois reel sur un departement test > 200 emails).
- **Rapports d'audit** disponibles dans `_bmad-output/implementation-artifacts/audit-cron-notify-waitlist-*.md` et `audit-batch-limit-send-waitlist-*.md`.

**Observabilite oncall (5.E) :**

- **Sylvain notifie en < 2 minutes** sur exception Sentry severity critical en prod (test : declencher erreur intentionnelle, mesurer delai notification recue).
- **Plateforme oncall documentee** dans architecture-technique-roxanetnous + DECISIONS.md F-Epic5-E1.
- **0 alerte non-critical** push individuel (tout regroupe en digest quotidien).

**Indicateur transverse Epic 5 :**

- **Retrospective Epic 5 livree** dans `_bmad-output/implementation-artifacts/epic-5-retro-YYYY-MM-DD.md` (pattern Epic 2/3/4).
- **0 retour utilisateur en bug** lie au renommage (sondage email leger ou observation directe).
- **Capacite a demarrer Epic 6** : `deferred-work.md` decroisse en volume + au moins 1 candidat Epic 6 cadre (CMP, switch domaine, accents UTF-8, tests anti-fraude, ou nouveau departement Bretagne).
