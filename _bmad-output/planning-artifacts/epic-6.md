---
stepsCompleted: [audit-mcp-prod-2026-05-13, inventaire-code-residuel-2026-05-13]
checkpointReviews: []
inputDocuments:
  - prd.md
  - epic-5.md
  - ../implementation-artifacts/epic-5-retro-2026-05-13.md
  - tech-spec-5-a-renommage.md
  - ../../DECISIONS.md
workflowType: 'epic'
classification:
  projectType: web_app
  domain: general
  complexity: medium
epicNumber: 6
epicTheme: 'Finalisation renommage + hardening Epic 5 reporte + bugs latents OCR/tests'
created: '2026-05-13'
status: 'a cadrer (audit MCP fait, inventaire code fait, checkpoint review en attente)'
parentSkill: 'bmad-create-epics-and-stories'
---

# Epic 6 : Finalisation renommage + hardening Epic 5 reporte

## Vision

Trois objectifs paralleles, **aucun bloquant pour le go-live Bretagne** :

1. **Finalisation cosmetique BDD + code (6.A)** : solder le renommage `accompagnante` -> `accompagnant` cote BDD residuel (3 tables + enum value orpheline + RPC orpheline) et code (composant `AccompagnanteDashboardHeader`, 121 references TS aux noms de tables, libelles UI). Volumetrie 381 occurrences (post-Epic 5, vs 1755 avant Epic 5).

2. **Bugs latents revelés par audit Epic 6 (6.B)** : 11 references `accompagnante_id` / `accompagnante_profile_id` dans des fichiers .ts pointant vers colonnes BDD inexistantes (renommees Epic 5 mais code TS non aligne) -> tests d'integration paywall casses silencieusement (5 occurrences) + 4 inserts `lib/ocr.ts` casses silencieusement vers table `ocr_results` qui n'existe pas en BDD. Reparation prioritaire.

3. **Actions reportees Epic 5 (6.C + 6.D)** : solder les action items differes a Epic 6 par la retrospective Epic 5 (DECISIONS.md F-Epic5-retro 2026-05-13) :
   - 6.C hardening dette : correction `lib/matching.ts` typage experience, switch domaine Supabase (conditionnel achat domaine), seed UTF-8 departements (divergence prod/dev/CI), centralisation helpers email (reconsidere).
   - 6.D suite Playwright : tests anti-fraude parrainage, RGPD cascade, matching (AI-4.11, AI-4.12, AI-4.13).
   - 6.E audits 30j post-Epic 4 : 5.D.1 cron notify-waitlist-retry + 5.D.2 BATCH_LIMIT send-waitlist (declencheur ~2026-06-08, conditionnel calendrier).

**Decisions de reference** : DECISIONS.md F-Epic5-retro (a creer post-checkpoint), retrospective Epic 5 (`epic-5-retro-2026-05-13.md`), memoire projet `project_renommage_accompagnante_todo`, methodologie AI-5.M.1 (checkpoint review post-cadrage) et AI-5.M.2 (audit MCP BDD prerequis) institutionnalisees Epic 5.

**FR/NFR couverts** : FR1 (auth role consistency), FR7 (profil auxiliaire), FR11-12 (verification), FR16-19 (paywall + annonces), FR27-29 (messagerie). NFR2 (securite : tests RLS regression sur tables renommees), NFR5 (fiabilite : tests d'integration paywall fonctionnels), NFR6 (a11y : preservation baseline 0 violation Critical/Serious).

## Pre-requis et conditions de demarrage

**Aucun pre-requis bloquant**. Epic 6 demarre quand Sylvain le decide. Le go-live Bretagne (toggle admin premier departement) est independant et peut se faire avant, pendant ou apres.

**Conditions d'observation parallele** (non bloquantes, herites Epic 4) :
- Audit Sentry prod observe en continu.
- Stabilisation GHA observee en continu.

**Pre-requis specifiques mini-epics (a acter au checkpoint review)** :
- **6.A renommage BDD** : strategie cutover decidee story 6.A.1 (architecture review legere) - inspiree de 5.A.1 dont la methodo a fonctionne (cutover < 5 sec 818 users).
- **6.E audits 30j** : declencheur calendrier ~2026-06-08 (depend de la date go-live Bretagne T+30). Stories preparees mais executees post-fenetre 30j d'observation.

## Audit MCP BDD prod (methodologie AI-5.M.2)

Audit factuel effectue 2026-05-13 avant cadrage, conformement a la methodologie institutionnalisee Epic 5.

### Elements BDD residuels au feminin

| Element | Detail | Volumetrie | Action 6.A |
|---|---|---|---|
| Enum value orpheline | `user_role.'accompagnante'` (0 user) | 0 | `ALTER TYPE ... DROP VALUE` Postgres 17 (verifier version) OU recreer enum |
| Table | `accompagnantes_profiles` | 818 lignes | RENAME TABLE -> `accompagnants_profiles` + cascade FK + 10 policies RLS |
| Table | `annonces_accompagnantes` | 796 lignes | RENAME TABLE -> `annonces_accompagnants` + cascade FK + 4 policies RLS |
| Table | `accompagne_accompagnantes` | 0 lignes | RENAME TABLE -> `accompagne_accompagnants` (trivial, table vide) |
| Policies RLS | 10 referencant tables feminines | 10 | DROP + CREATE post-RENAME (noms cohérents) |
| CHECK constraints | `accompagnantes_profiles_completion_check`, `accompagnantes_profiles_validation_source_check` | 2 | Renommage cosmetique uniquement (pas obligatoire) |
| Fonction RPC | `get_or_create_conversation(p_accompagnante_id uuid, p_accompagne_id uuid)` | 0 caller TS | DROP FUNCTION (orpheline) ou RENAME parametres si reactivation prevue |

### Elements BDD deja au masculin (Epic 5)

| Element | Volumetrie | Statut |
|---|---|---|
| Enum value `'accompagnant'` | 818 users | OK |
| Colonnes `accompagnant_id` / `accompagnant_user_id` (8 occurrences) | 8 tables | OK |
| Helper RLS `public.is_accompagnant()` | 1 fonction | OK |
| Helper RLS `public.is_document_owner()`, `public.is_admin()` | 2 fonctions | OK |

## Inventaire code residuel (post-Epic 5)

Total : **381 occurrences `accompagnante`** dans 82 fichiers TS/TSX (vs 1755 pre-Epic 5).

### Repartition par pattern

| Pattern | Occurrences | Nature | Action |
|---|---|---|---|
| `accompagnantes_profiles` | 121 | Nom table BDD | Find-replace post-RENAME TABLE (6.A.4) |
| `accompagnante` seul | 178 | Mix libelles UI + type alias `'accompagnante'`/`'accompagne'` (types annonces) + target_type log `'accompagnante'` + commentaires | Trier 6.A.4 : libelles UI -> rename ; type alias -> rename ; target_type log -> rename ; commentaires -> a discretion |
| `accompagnantes` seul | 82 | Mix pluriel idem | Idem 6.A.4 |
| `accompagnante_id` | 7 | **Bug latent** : colonne n'existe plus | Fix 6.B.1 (tests integration) |
| `accompagnante_profile_id` | 4 | **Bug prod** : colonne n'existe pas, table `ocr_results` n'existe pas | Fix 6.B.2 (OCR) |
| `accompagnante_vie`, `accompagnante_gerontologie` | 4 | **Libelles diplomes officiels** | NE PAS renommer (terminologie metier figee) |

### Fichiers a fort impact

- `components/admin/utilisateurs-client.tsx` (19) - libelles admin
- `app/recherche/page.tsx` (19) - libelles recherche
- `lib/matching.ts` (15) - matching annonces (type alias `'accompagnante'`/`'accompagne'`)
- `app/admin/annonces/page.tsx` (15) - libelles admin
- `app/actions/admin.ts` (14) - target_type log + libelles email
- `tests/integration/paywall/admin-bypass.test.ts` (12) - **bug latent** (6.B.1)
- `app/actions/annonces.ts` (12) - type alias
- `tests/integration/_lib/fixtures.ts` (11) - **bug latent** (6.B.1)
- `app/actions/parrainage.ts` (11) - target_type log + libelles
- `app/actions/messages.ts` (11) - libelles message
- `lib/notify-favori-disponible.ts` (10) - libelles email
- `lib/matching-notifications.ts` (10) - type alias + libelles
- `components/layout/accompagnante-dashboard-header.tsx` (composant) + 13 importeurs

### Composant a renommer

`components/layout/accompagnante-dashboard-header.tsx` :
- Export `AccompagnanteDashboardHeader` -> `AccompagnantDashboardHeader`
- 13 fichiers importateurs a mettre a jour (liste deterministe en 6.A.5)

### Routes deja renommees Epic 5

`/accompagnante/*` -> `/accompagnant/*` : **6/6 dossiers deja renommes en Epic 5**. Aucune route au feminin ne survit.

## Periodemetre et hors-scope

### Mini-epics Epic 6 (decoupage propose)

| Mini-epic | Titre | Stories estimees | Bloque ? |
|---|---|---|---|
| **6.A** | Renommage BDD + code residuel (3 tables + enum + RPC + composant + 121 ref TS + 250 libelles) | ~5 | Bloque 6.B partiellement (6.B.1 depend de 6.A.2) |
| **6.B** | Bugs latents reveles audit (tests integration paywall + OCR insert + ocr_results table absente) | ~3 | Partiellement bloquee par 6.A.2 |
| **6.C** | Hardening dette Epic 5 reporte (matching.ts, switch domaine Supabase, seed UTF-8 departements, helpers email) | ~4 | Independant (6.C.2 conditionnel domaine) |
| **6.D** | Suite Playwright (anti-fraude parrainage, RGPD cascade, matching) | ~3 | Independant |
| **6.E** | Audits 30j post-Epic 4 (cron notify-waitlist-retry, BATCH_LIMIT) | ~2 | Conditionnel calendrier (~2026-06-08) |

**Estimation totale : ~17 stories.** A reduire post-checkpoint review selon priorisation Sylvain.

### Hors scope Epic 6 - reportes Epic 7+ (a definir)

- **Story 4.10 OCR perfectionnement** : conditionnelle (declencheur > 25 auxiliaires inscrites OU delai validation > 24h). Note : Epic 6 fixe le bug d'insert `ocr_results` mais ne perfectionne pas l'OCR fonctionnel.
- **Story 4.11 Matching UI** : conditionnelle, 3 mois donnees Bretagne post go-live.
- **CMP granulaire** : conditionnel, intro analytics/retargeting/partenaires tiers.
- **Renommage table `accompagne_accompagnantes`** : trivial (table vide), absorbe dans 6.A si Sylvain accepte (sinon report).

## Mini-epic 6.A : Renommage BDD + code residuel

**Goal** : Solder la dette terminologique `accompagnante` -> `accompagnant` cote BDD residuel (3 tables, enum value orpheline, RPC orpheline) et cote code (composant `AccompagnanteDashboardHeader`, 121 ref TS aux noms de tables, libelles UI / type alias / target_type log).

### Story 6.A.1 : Architecture review + plan migration (light)

**As a** developpeur,
**I want** une architecture review legere des operations BDD 6.A,
**so that** le cutover RENAME TABLE + DROP enum value se fasse sans surprise et avec rollback explicite.

**Acceptance Criteria** :

**AC1** :
- **Given** l'audit MCP BDD prod du 2026-05-13 (3 tables, 1 enum value, 1 RPC, 10 policies, 2 CHECK)
- **When** le plan migration 6.A.2 est redige
- **Then** chaque operation BDD est documentee (RENAME TABLE, DROP VALUE, DROP FUNCTION) avec sa methode de rollback explicite et un test de validation post-cutover (count(*) avant/apres, RLS sample query)

**AC2** :
- **Given** que Postgres `ALTER TYPE ... DROP VALUE` n'est supporte qu'a partir de Postgres 17 (audit a faire story 6.A.1)
- **When** la version Postgres prod est < 17
- **Then** le plan migration utilise le pattern Epic 5 (recreer l'enum sans la valeur orpheline) plutot que DROP VALUE direct

**AC3** :
- **Given** la decision d'embarquer ou non le renommage table `accompagne_accompagnantes` (table vide)
- **When** la story 6.A.1 est revue avec Sylvain
- **Then** la decision est actee dans DECISIONS.md F-Epic6-A1 (embarque OU report Epic 7)

### Story 6.A.2 : Migration BDD (RENAME tables + DROP enum + DROP RPC)

**As an** administrateur BDD,
**I want** les 3 tables encore au feminin renommees au masculin et la valeur enum orpheline supprimee,
**so that** le schema BDD soit aligne avec le code et la copy editoriale.

**Acceptance Criteria** :

**AC1** :
- **Given** la migration `<timestamp>_rename_accompagnante_tables.sql` qui contient `ALTER TABLE accompagnantes_profiles RENAME TO accompagnants_profiles;` et idem pour les 2 autres tables
- **When** la migration est appliquee en prod
- **Then** les 3 tables sont renommees, les FK cascade automatiquement, les 10 policies RLS sont DROP + CREATE pour pointer vers les nouveaux noms

**AC2** :
- **Given** la migration applique `ALTER TYPE user_role DROP VALUE 'accompagnante';` (Postgres 17+) OU recree l'enum sans cette valeur (Postgres < 17, pattern Epic 5)
- **When** la migration est appliquee
- **Then** `SELECT enumlabel FROM pg_enum WHERE enumtypid = (SELECT oid FROM pg_type WHERE typname = 'user_role')` retourne exactement `['accompagnant', 'accompagne', 'admin']`

**AC3** :
- **Given** la fonction RPC orpheline `get_or_create_conversation(p_accompagnante_id uuid, p_accompagne_id uuid)` jamais appelee depuis le code TS
- **When** la migration applique `DROP FUNCTION public.get_or_create_conversation(uuid, uuid);`
- **Then** la fonction est supprimee, `types/supabase.ts` regenere ne la liste plus

**AC4** :
- **Given** que le cutover doit etre < 5 sec (pattern Epic 5)
- **When** la migration est testee sur branche Supabase preview avant prod
- **Then** la duree mesuree est < 5 sec et aucune query applicative ne timeout pendant le cutover

### Story 6.A.3 : Regeneration types Supabase + alignement code TS

**As a** developpeur,
**I want** `types/supabase.ts` regenere apres la migration 6.A.2,
**so that** TypeScript reflete le schema BDD actuel et detecte les references obsoletes au compile.

**Acceptance Criteria** :

**AC1** :
- **Given** la migration 6.A.2 appliquee
- **When** `npx supabase gen types typescript` est execute via MCP
- **Then** `types/supabase.ts` ne contient plus aucune occurrence de `accompagnantes_profiles`, `annonces_accompagnantes`, `accompagne_accompagnantes`, `'accompagnante'` enum, `p_accompagnante_id`, `get_or_create_conversation`

**AC2** :
- **Given** les nouveaux noms de tables BDD
- **When** `npm run typecheck` est execute
- **Then** TypeScript signale toutes les references TS obsoletes aux anciens noms (attendu : ~121 erreurs `accompagnantes_profiles`, references `from('annonces_accompagnantes')`, etc.)

**AC3** :
- **Given** les ~121 erreurs typecheck
- **When** find-replace global `accompagnantes_profiles` -> `accompagnants_profiles`, `annonces_accompagnantes` -> `annonces_accompagnants`, `accompagne_accompagnantes` -> `accompagne_accompagnants` est applique
- **Then** `npm run typecheck` passe a 0 erreur

### Story 6.A.4 : Renommage type aliases + target_type log + libelles UI

**As un** developpeur,
**I want** les type aliases `'accompagnante' | 'accompagne'` renommes au masculin et les libelles UI / target_type log alignes,
**so that** le code et la copy publique soient coherents avec le rename BDD.

**Acceptance Criteria** :

**AC1** :
- **Given** les 178 occurrences `accompagnante` seul (type alias dans `lib/matching.ts`, `lib/matching-notifications.ts`, `app/actions/admin-annonces.ts`, `app/actions/favoris.ts`, etc.)
- **When** le find-replace cible explicitement les type aliases (`type: 'accompagnante' | 'accompagne'` -> `type: 'accompagnant' | 'accompagne'`) et les comparaisons (`type === 'accompagnante'` -> `type === 'accompagnant'`)
- **Then** `npm run typecheck` passe a 0 erreur et `npm test` (tests unitaires) passe sans regression

**AC2** :
- **Given** les valeurs `target_type: 'accompagnante'` dans `admin_actions_log` (4 occurrences dans `app/actions/admin.ts`, `app/actions/parrainage.ts`)
- **When** le find-replace remplace au masculin
- **Then** une migration BDD `UPDATE admin_actions_log SET target_type = 'accompagnant' WHERE target_type = 'accompagnante'` est appliquee pour aligner l'historique log (decision Sylvain : aligner OU laisser historique)

**AC3** :
- **Given** les libelles UI au feminin dans 82 fichiers TSX
- **When** chaque libelle est revise (les libelles diplomes `'accompagnante en gerontologie'`, `'accompagnante de vie'` sont **preserves** car terminologie metier officielle)
- **Then** les libelles UI affichent uniquement le masculin neutre `accompagnant(s)` sauf valeurs diplomes
- **And** `npm run a11y:axe:check` passe a 0 violation Critical/Serious (preservation baseline NFR6)

### Story 6.A.5 : Renommage composant AccompagnanteDashboardHeader

**As a** developpeur,
**I want** le composant `AccompagnanteDashboardHeader` renomme au masculin,
**so that** le code soit coherent et qu'aucun fichier ne reste au feminin.

**Acceptance Criteria** :

**AC1** :
- **Given** `components/layout/accompagnante-dashboard-header.tsx` (1 fichier) et 13 fichiers importateurs
- **When** le fichier est renomme en `components/layout/accompagnant-dashboard-header.tsx`, l'export `AccompagnanteDashboardHeader` est renomme `AccompagnantDashboardHeader`, et les 13 imports sont mis a jour
- **Then** `npm run typecheck` passe a 0 erreur et `npm run build` reussit

**AC2** :
- **Given** que le composant est rendu dans les pages accompagnant (dashboard, profil, annonces, abonnement, parrainage, messages, favoris, recherche)
- **When** la suite `npm run a11y:axe:check` est executee sur les 7 parcours critiques
- **Then** 0 violation Critical/Serious (preservation baseline NFR6)

## Mini-epic 6.B : Bugs latents reveles par audit

**Goal** : Reparer les 11 references TS pointant vers des colonnes/tables BDD inexistantes (revelees par l'audit MCP Epic 6).

### Story 6.B.1 : Fix tests integration paywall (colonne accompagnante_id inexistante)

**As un** developpeur,
**I want** les tests d'integration paywall references a `accompagnante_id` corriges,
**so that** la CI valide vraiment le comportement paywall messagerie post-Epic 5.

**Acceptance Criteria** :

**AC1** :
- **Given** `tests/integration/paywall/abonne-actif.test.ts:41,45` et `tests/integration/paywall/admin-bypass.test.ts:18,34,41` referencent `accompagnante_id`
- **When** `.select('id, accompagnante_id')` et `.toMatchObject({ accompagnante_id: ... })` sont corriges en `accompagnant_id`
- **Then** la suite tests integration passe en CI (`npm run test:integration`)

**AC2** :
- **Given** `tests/integration/_lib/fixtures.ts:179` insere `accompagnante_id: accompagnanteProfileId` dans conversations
- **When** la fixture est corrigee en `accompagnant_id: accompagnantProfileId` (variable et clé)
- **Then** les fixtures generent des conversations valides post-Epic 5

### Story 6.B.2 : Fix inserts ocr_results dans lib/ocr.ts

**As un** developpeur,
**I want** comprendre et fixer le bug `lib/ocr.ts` qui insere dans une table `ocr_results` inexistante,
**so that** l'OCR Google Vision sauvegarde reellement ses resultats.

**Acceptance Criteria** :

**AC1** :
- **Given** que `lib/ocr.ts` execute 4x `supabase.from('ocr_results').insert({ accompagnante_profile_id: profileId, ... })` mais que la table `ocr_results` n'existe pas en BDD (audit MCP 2026-05-13)
- **When** la story 6.B.2 audite l'historique git de cette fonctionnalite et l'origine du bug
- **Then** une decision est prise : (a) creer la table `ocr_results` avec colonnes alignees (`accompagnant_profile_id`, etc.) si l'OCR est encore utilise, OU (b) supprimer le code mort si l'OCR n'est pas branche

**AC2** :
- **Given** la decision (a) ou (b) de l'AC1
- **When** la story est implementee
- **Then** soit la migration `create_ocr_results.sql` est appliquee avec RLS appropriee + types regeneres, soit `lib/ocr.ts` est supprime et ses imports nettoyes

### Story 6.B.3 : Cleanup type alias VALID_ROLES backward-compat

**As un** developpeur,
**I want** evaluer si le backward-compat `'accompagnante'` dans `notifications-ouverture.ts` et `me-tenir-au-courant/page.tsx` est encore necessaire,
**so that** on ne traine pas un alias mort indefiniment.

**Acceptance Criteria** :

**AC1** :
- **Given** `app/actions/notifications-ouverture.ts:18` (`VALID_ROLES = ['accompagnant', 'accompagnante', 'accompagne', 'visiteur']`) et `app/me-tenir-au-courant/page.tsx:18-19` (alias query-string `?role=accompagnante` -> `accompagnant`)
- **When** une recherche dans les analytics / Sentry / logs verifie qu'aucun lien email ou source externe n'envoie encore `?role=accompagnante` depuis 30 jours
- **Then** le backward-compat est supprime, le code se reduit

**AC2** :
- **Given** que si un trafic residuel `?role=accompagnante` est encore observe
- **When** une date de fin de backward-compat est decidee (~2026-08-01 par exemple)
- **Then** un commentaire `// TODO: drop backward-compat 2026-08-01` est ajoute avec date precise

## Mini-epic 6.C : Hardening dette Epic 5 reporte

**Goal** : Solder les action items reportes par la retrospective Epic 5 (DECISIONS.md F-Epic5-retro 2026-05-13).

### Story 6.C.1 : Fix `lib/matching.ts` typage experience

**As un** developpeur,
**I want** le typage `experience` corrige dans `lib/matching.ts`,
**so that** le matching annonces ne se base pas sur un type non-aligne avec BDD.

**Acceptance Criteria** :
- AC1 : audit factuel du type actuel `experience` (string | undefined | enum ?) vs realite BDD `accompagnants_profiles.experience` -> documenter divergence
- AC2 : alignement typage TS sur le type BDD reel
- AC3 : `npm run typecheck` passe + tests matching passent

### Story 6.C.2 : Switch domaine Supabase prod (conditionnel)

**As un** product owner,
**I want** le Site URL, Redirect URLs Supabase et `NEXT_PUBLIC_BASE_URL` mis a jour quand le vrai domaine remplace `roxanetnous.vercel.app`,
**so that** les flux email (signup confirm, reset password, magic link) ne soient pas casses.

**Acceptance Criteria** :
- AC1 (declencheur) : achat vrai domaine effectif. Story conditionnelle, non executee tant que pas de domaine prod.
- AC2 : checklist de switch documentee dans memoire `project_go_live_supabase_domain_switch` mise a jour avec etapes precises (Supabase dashboard + Vercel env var + tests flux email post-switch).
- AC3 : test bout-en-bout signup -> email confirm -> click link -> arrive sur le bon domaine.

### Story 6.C.3 : Seed UTF-8 departements/regions

**As un** developpeur,
**I want** la migration seed `departements`/`regions` resynchronisee avec la realite UTF-8 prod,
**so that** prod/dev/CI ne divergent plus.

**Acceptance Criteria** :
- AC1 : audit factuel divergence (memoire `project_accents_departements_2026_05_11`)
- AC2 : nouvelle migration seed avec accents UTF-8 corrects, idempotente
- AC3 : `supabase db reset` localement + CI redonnent un schema identique a prod

### Story 6.C.4 : Centralisation helpers email (reconsidere)

**As un** developpeur,
**I want** evaluer si la maintenance des 18 helpers email duplique est devenue lourde,
**so that** on decide de centraliser OU de confirmer le rejet historique (Epic 4 4.3 D9).

**Acceptance Criteria** :
- AC1 : audit factuel des 18 helpers email + diff a 30j (nouveaux helpers ajoutes Epic 4/5/6 ?)
- AC2 : decision Sylvain : centraliser (story dediee) OU confirmer rejet (mention dans DECISIONS.md)

## Mini-epic 6.D : Suite Playwright (REPORTE Epic 7+ apres decouverte 2026-05-13 - cf. DECISIONS.md F-Epic6-D)

**Statut 2026-05-13 :** mini-epic 6.D reporte Epic 7+ apres audit. Le tech-spec prevoyait "extension de la suite Playwright 4.4" mais 4.4 a livre des tests Vitest integration, pas Playwright fonctionnel. Le scope reel necessite la creation de l'infra E2E (config, helpers session, fixtures, seeds, page objects) + les 3 scenarios = 2-3j-dev. Hors envergure soiree Epic 6.

Cf. DECISIONS.md `F-Epic6-D` pour la decision complete + plan de reactivation Epic 7+.



**Goal** : Etendre la suite Playwright story 4.4 avec les scenarios reportes (AI-4.11, AI-4.12, AI-4.13).

### Story 6.D.1 : Tests anti-fraude parrainage (AI-4.11)

**Acceptance Criteria** : scenarios Playwright pour blacklist auto-detect, tentatives doublons parrain, contournement bypass visio filleule.

### Story 6.D.2 : Tests RGPD cascade (AI-4.12)

**Acceptance Criteria** : suppression compte declenche cascade (annonces, conversations, messages, favoris, parrainages, notifications). Validation BDD post-cascade.

### Story 6.D.3 : Tests matching (AI-4.13)

**Acceptance Criteria** : scenario matching annonce accompagnant <-> recherche accompagne (departements ouverts + diplomes + experience). Validation E2E notification email.

## Mini-epic 6.E : Audits 30j (conditionnel calendrier)

**Goal** : Verifier 30j post-Epic 4 que les workarounds Epic 4 (`BATCH_LIMIT=200` send-waitlist, cron retry waitlist) sont effectivement inutiles avant suppression.

### Story 6.E.1 : Audit cron notify-waitlist-retry (5.D.1)

**Declencheur calendrier** : ~2026-06-08 (T+30 post go-live Bretagne).

**Acceptance Criteria** :
- AC1 : metrics 30j du cron `notify-waitlist-retry` -> verifier que le retry n'a jamais ete utile (0 retry reussi qui debloque un envoi initialement echoué).
- AC2 : si OK, suppression du cron + migration + tests.
- AC3 : si KO (au moins 1 retry utile), garder le cron + documenter cause dans DECISIONS.md.

### Story 6.E.2 : Audit BATCH_LIMIT send-waitlist (5.D.2)

**Declencheur calendrier** : ~2026-06-08 (T+30).

**Acceptance Criteria** :
- AC1 : metrics 30j de la file waitlist -> verifier que `BATCH_LIMIT=200` n'a jamais ete atteint (max batch / cron tick observe).
- AC2 : si OK, augmenter ou supprimer le BATCH_LIMIT.
- AC3 : si KO, documenter pic et evaluer Vercel Functions timeout.

## Risques et mitigations

| Risque | Probabilite | Impact | Mitigation |
|---|---|---|---|
| RENAME TABLE prod bloque par lock contention | Faible | Bloquant | Test sur branche Supabase preview avant prod, fenetre cutover hors heures de pointe |
| `DROP VALUE 'accompagnante'` impossible (Postgres < 17) | Moyen | Moyen | Audit version prod story 6.A.1, fallback pattern Epic 5 (recreer enum) |
| Find-replace 121 ref TS casse un imports dynamique non-detecte | Faible | Moyen | `npm run typecheck` + `npm run build` post-find-replace, plus tests integration |
| Renommage composant 13 importeurs rate un fichier | Faible | Faible | `grep -rn AccompagnanteDashboard` post-rename = 0 |
| Decision 6.B.2 OCR : table jamais existe ou code mort | Moyen | Faible | Audit historique git + recherche callers `analyseOcr*` |
| Suppression backward-compat `?role=accompagnante` casse un email sortant | Faible | Faible | Audit Sentry / Vercel logs 30j avant suppression |

## Definition of Done Epic 6

- **6.A** : 3 tables BDD renommees + enum value orpheline supprimee + RPC orpheline supprimee + composant AccompagnanteDashboardHeader renomme + 121 ref TS aux noms de tables alignees + 178 + 82 occurrences `accompagnante`/`accompagnantes` triees (libelles diplomes preserves)
- **6.B** : 11 references colonnes BDD inexistantes corrigees ou supprimees (tests integration paywall verts, OCR table cree ou code mort supprime)
- **6.C** : `lib/matching.ts` typage aligne, switch domaine Supabase documente (executable on-demand), seed UTF-8 departements aligne, decision centralisation emails actee
- **6.D** : suite Playwright etendue +3 scenarios (anti-fraude, RGPD cascade, matching)
- **6.E** (conditionnel) : audits 30j effectues, workarounds Epic 4 supprimes ou conserves avec justification
- **Tests** : `npm run typecheck` 0 erreur, `npm run test` (unit) 0 echec, `npm run test:integration` 0 echec, `npm run a11y:axe:check` 0 violation Critical/Serious, `npm run build` reussi
- **Memoire projet** : `project_renommage_accompagnante_todo.md` cloture, `project_epic_6_retro.md` cree avec lecons apprises

## Retrospective Epic 5 - lecons applicables Epic 6

1. **Cadence non extrapolable** : Epic 5 a livre 15 stories / 1 jour beneficiant d'instrumentation Sentry massive + BDD prod minimale. Epic 6 ne doit pas etre planifie sur cette cadence. ~17 stories sur 3-5 jours travail effectif raisonnable.

2. **Checkpoint review post-cadrage** (AI-5.M.1) : avant tout demarrage execution, valider epic-6.md avec Sylvain pour ajuster scope.

3. **Audit MCP BDD prod obligatoire** (AI-5.M.2) : effectue 2026-05-13 avant cadrage Epic 6.

4. **Verifier l'existence d'un produit avant de le recommander** (AI-5.M.3) : applicable au choix table `ocr_results` (6.B.2) - verifier si Google Vision est encore utilise avant de creer la table.

## Pointeurs croisés

- **Decisions produit** : `DECISIONS.md` (a etendre F-Epic6-A1, F-Epic6-B2 post-checkpoint)
- **PRD** : `prd.md`
- **Architecture initiale** : `architecture-technique-roxanetnous-2026-02-09.md` (note divergence doc archi vs prod : annotee Epic 5)
- **Retro Epic 5** : `../implementation-artifacts/epic-5-retro-2026-05-13.md`
- **Tech spec 5.A** : `tech-spec-5-a-renommage.md` (pattern reconductible pour 6.A.2)
- **Memoire projet** : `project_renommage_accompagnante_todo`, `project_go_live_supabase_domain_switch`, `project_accents_departements_2026_05_11`, `project_epic_5_retro`
- **NFR Accessibilite** : `../test-artifacts/nfr-assessment-a11y-2026-05-04.md` (baseline a preserver)
