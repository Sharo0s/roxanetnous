---
story: 5.A.1
storyTitle: 'Architecture review strategie migration enum role'
epic: 5
miniEpic: 5.A
created: '2026-05-13'
status: 'draft v1 - en attente validation Sylvain'
inputDocuments:
  - epic-5.md
  - architecture-technique-roxanetnous-2026-02-09.md
  - audit MCP BDD prod 2026-05-13
contraintes_techniques:
  postgres_version: '17.6'
  drop_enum_value_natif: false  # disponible Postgres 18+
---

# Tech-spec 5.A : Renommage `accompagnante` -> `accompagnant`

## 1. Contexte et perimetre

**Demande Sylvain 2026-05-13** : passer tout le projet du feminin `accompagnante` au masculin neutre `accompagnant`. Inventaire initial : 1755 occurrences dans le repo.

**Audit BDD prod via MCP 2026-05-13** (source de verite, divergent du doc archi 2026-02-09) :

### Inventaire factuel BDD prod

**Postgres** : 17.6 (donc `ALTER TYPE ... DROP VALUE` indisponible nativement).

**Enum `user_role`** (schema public) : valeurs `'accompagnante'`, `'accompagne'`, `'admin'`. SEULE `'accompagnante'` -> `'accompagnant'` est en scope.

**Volumetrie prod 2026-05-13** :

| Table | Lignes |
|---|---|
| users | 822 |
| accompagnantes_profiles | 818 |
| annonces_accompagnantes | 796 |
| accompagnes_profiles | 4 |
| favoris | 1 |
| **accompagne_accompagnantes, annonces_accompagnes, conversations, messages, planning_documents, planning_shifts, planning_document_assignments** | **0 (toutes vides)** |

**Implication majeure** : la volumetrie est faible (max 822 lignes) et concentree sur 3 tables. **Le risque de cutover atomique est minime**.

**2 tables nommees apres le role feminin** :
- `accompagne_accompagnantes` (0 lignes)
- `annonces_accompagnantes` (796 lignes)

**15 colonnes BDD impactees dans 8 tables** :

| Table | Colonne | Type | NULL | Lignes table |
|---|---|---|---|---|
| accompagne_accompagnantes | `accompagnante_user_id` | uuid | NO | 0 |
| accompagne_accompagnantes | `accompagne_id` | uuid | NO | 0 |
| annonces_accompagnantes | `accompagnante_id` | uuid | NO | 796 |
| annonces_accompagnes | `accompagne_id` | uuid | NO | 0 |
| annonces_accompagnes | `message_accompagnantes` | text | YES | 0 |
| conversations | `accompagnante_id` | uuid | NO | 0 |
| conversations | `accompagne_id` | uuid | YES | 0 |
| conversations | `archived_by_accompagnante` | bool | NO | 0 |
| conversations | `archived_by_accompagne` | bool | NO | 0 |
| favoris | `annonce_accompagnante_id` | uuid | YES | 1 |
| favoris | `annonce_accompagne_id` | uuid | YES | 1 |
| planning_document_assignments | `accompagnante_user_id` | uuid | NO | 0 |
| planning_documents | `accompagne_id` | uuid | NO | 0 |
| planning_shifts | `accompagnante_user_id` | uuid | NO | 0 |
| planning_shifts | `accompagne_id` | uuid | NO | 0 |

**Helpers RLS** (schema `public`, PAS `auth`) :

| Helper | Body |
|---|---|
| `is_accompagnante()` | `SELECT EXISTS (SELECT 1 FROM public.users WHERE id = auth.uid() AND role = 'accompagnante')` |
| `is_accompagne()` | `SELECT EXISTS (SELECT 1 FROM public.users WHERE id = auth.uid() AND role = 'accompagne')` |
| `is_admin()` | `SELECT EXISTS (SELECT 1 FROM public.users WHERE id = auth.uid() AND role = 'admin')` |
| `is_document_owner(doc_id)` | reference `accompagnes_profiles` + `pd.accompagne_id` |

**23 policies RLS** sur 10 tables referencent `accompagnante` (qual ou with_check) :

```
public.accompagne_accompagnantes : 2 policies
public.annonces_accompagnantes : 4 policies (select/insert/update/delete)
public.annonces_accompagnes : 4 policies
public.conversations : 3 policies
public.messages : 3 policies
public.planning_document_assignments : 1 policy
public.planning_document_reads : 1 policy
public.planning_documents : 2 policies
public.planning_shifts : 2 policies
storage.objects : 1 policy (bucket planning-documents)
```

## 2. Decisions strategiques

### Decision D1 : Strategie BDD = cutover atomique (rejet expand-contract)

**Choix retenu** : cutover atomique en une seule migration transactionnelle.

**Justification** :
- Volumetrie max 822 lignes (users) -> backfill < 100 ms en transaction.
- 9 des 12 tables impactees sont VIDES en prod -> aucun risque applicatif sur ces tables.
- 3 tables non-vides : users (822), accompagnantes_profiles (818), annonces_accompagnantes (796). Toutes mises a jour en `UPDATE ... SET role = 'accompagnant' WHERE role = 'accompagnante'` ou equivalents, transactionnels.
- Postgres 17.6 supporte `ALTER TYPE ... ADD VALUE` mais pas `DROP VALUE`. Le cutover atomique evite la complexite de gestion de 2 valeurs enum coexistantes pendant une fenetre.
- Pas de necessite de coordination entre code et BDD : un seul deploiement code 5.A.3 suit la migration 5.A.2.

**Strategie expand-contract REJETEE** :
- Cout d'orchestration eleve (dual-write code 5.A.3 + verification consommateurs + cutover differe).
- Aucun gain pour 822 lignes en prod et 0 utilisateur en messagerie active.
- Complexite des helpers RLS dual (`SELECT EXISTS ... role IN ('accompagnante', 'accompagnant')`) sur la fenetre de transition.

**Strategie alias via fonction helper SQL REJETEE** :
- Patch superficiel qui n'aligne pas l'enum source. Maintien de la dette terminologique BDD.
- Necessite quand meme un cutover ulterieur.

### Decision D2 : Recreation enum via colonne TEXT intermediaire (pattern Postgres < 18)

**Choix retenu** : la migration cutover utilisera le pattern standard Postgres < 18 pour "remplacer" une valeur enum :

```sql
-- 1. Ajouter la nouvelle valeur
ALTER TYPE user_role ADD VALUE 'accompagnant' BEFORE 'accompagne';

-- 2. Migrer les donnees vers la nouvelle valeur
UPDATE users SET role = 'accompagnant' WHERE role = 'accompagnante';

-- 3. (Optionnel, hors scope 5.A.2) Suppression de l'ancienne valeur :
-- ALTER TYPE user_role RENAME TO user_role_v_old;
-- CREATE TYPE user_role AS ENUM ('accompagnant', 'accompagne', 'admin');
-- ALTER TABLE users ALTER COLUMN role TYPE user_role USING role::text::user_role;
-- DROP TYPE user_role_v_old;
```

**La suppression de la valeur `accompagnante` (etape 3 ci-dessus) est differee a Epic 6** (story 5.A.7 candidat ou story Epic 6 dediee). Justification :
- L'etape 3 implique un downtime supplementaire (ALTER COLUMN TYPE reecrit la table) et n'apporte aucun benefice utilisateur.
- L'enum garde `'accompagnante'` en valeur orpheline (0 ligne apres etape 2) sans impact applicatif.
- Cout/benefice negatif sur scope 5.A.

### Decision D3 : Renommage des 2 tables = OUT OF SCOPE 5.A

**Choix retenu** : les tables `accompagne_accompagnantes` et `annonces_accompagnantes` **ne sont pas renommees** dans Epic 5.

**Justification** :
- Le renommage tables casse 6 RLS policies (4 sur annonces_accompagnantes + 2 sur accompagne_accompagnantes) qui devraient etre droppees + recreees.
- Le renommage tables casse les types Supabase generes -> regeneration MCP obligatoire (deja prevue 5.A.3).
- Le renommage tables propage dans le code TS (queries `.from('annonces_accompagnantes')`) -> charge supplementaire 5.A.3.
- **Aucun benefice utilisateur** : les noms de tables ne sont pas visibles dans la copy UI.
- La dette technique (noms de tables au feminin) est documentee dans DECISIONS.md et candidate Epic 6.

**Implication AC 5.A.2** : les colonnes `*_accompagnante_*` dans ces 2 tables suivent quand meme le renommage de colonnes ; seul le NOM de la table reste au feminin.

### Decision D4 : Renommage colonnes = IN SCOPE 5.A (15 colonnes)

**Choix retenu** : toutes les 15 colonnes inventoriees sont renommees dans 5.A.2.

**Mapping** :

| Ancien nom | Nouveau nom |
|---|---|
| `accompagnante_user_id` (accompagne_accompagnantes) | `accompagnant_user_id` |
| `accompagnante_id` (annonces_accompagnantes) | `accompagnant_id` |
| `message_accompagnantes` (annonces_accompagnes) | `message_accompagnants` |
| `accompagnante_id` (conversations) | `accompagnant_id` |
| `archived_by_accompagnante` (conversations) | `archived_by_accompagnant` |
| `annonce_accompagnante_id` (favoris) | `annonce_accompagnant_id` |
| `accompagnante_user_id` (planning_document_assignments) | `accompagnant_user_id` |
| `accompagnante_user_id` (planning_shifts) | `accompagnant_user_id` |

(Les colonnes deja masculines `accompagne_*` ne sont pas touchees.)

**Methode SQL** : `ALTER TABLE ... RENAME COLUMN` (operation metadata seulement, pas de reecriture de table, < 10 ms par colonne).

### Decision D5 : Renommage helpers RLS = IN SCOPE 5.A (3 helpers)

**Choix retenu** : les helpers `is_accompagnante`, `is_accompagne`, `is_document_owner` sont renommes dans 5.A.2.

**Mapping** :

| Ancien nom | Nouveau nom | Modifie body ? |
|---|---|---|
| `is_accompagnante()` | `is_accompagnant()` | Oui : `role = 'accompagnant'` (au lieu de `'accompagnante'`) |
| `is_accompagne()` | `is_accompagne()` | NON renomme (deja masculin) |
| `is_admin()` | `is_admin()` | NON modifie |
| `is_document_owner()` | `is_document_owner()` | NON modifie (referencer accompagnes_profiles ne change pas) |

**Methode SQL** : `DROP FUNCTION is_accompagnante CASCADE` puis `CREATE FUNCTION is_accompagnant()`. **CASCADE est destructeur sur les policies dependantes** -> les 23 policies seront automatiquement DROP. La migration doit les recreer dans la meme transaction (decision D6).

### Decision D6 : Recreation explicite des 23 policies dans la migration 5.A.2

**Choix retenu** : la migration 5.A.2 contient explicitement le DDL `CREATE POLICY ...` pour les 23 policies impactees, **apres** le `DROP FUNCTION ... CASCADE` qui les supprime.

**Justification** :
- CASCADE est imprevisible si on ne sait pas exactement quelles policies dependent. L'audit `pg_policies` 2026-05-13 inventorie 23 policies a recreer.
- Plus sur : `DROP POLICY <name> ON <table>` explicite pour les 23 + `DROP FUNCTION is_accompagnante` (sans CASCADE) + `CREATE FUNCTION is_accompagnant` + recreation explicite des 23 policies avec le nouveau helper.
- Permet une review precise du DDL avant application.

**Inventaire 23 policies a recreer** (cf. audit pg_policies 2026-05-13) :

```
public.accompagne_accompagnantes :
  - "Accompagnante reads own assignments"
  - "Accompagne manages own team"
public.annonces_accompagnantes :
  - ann_acc_select, ann_acc_insert, ann_acc_update, ann_acc_delete
public.annonces_accompagnes :
  - ann_acg_select, ann_acg_insert, ann_acg_update, ann_acg_delete
public.conversations :
  - conv_select_own, conv_insert_own, conv_update_own
public.messages :
  - msg_select_own, msg_insert_own, msg_update_read
public.planning_document_assignments :
  - "Accompagnante reads own document assignments"
public.planning_document_reads :
  - "Accompagne reads document reads"
public.planning_documents :
  - "Accompagne manages own documents"
  - "Assigned accompagnantes read documents"
public.planning_shifts :
  - "Accompagnante reads own shifts"
  - "Accompagne manages own shifts"
storage.objects :
  - "Planning document readers can download" (bucket planning-documents)
```

**Note** : les 23 policies sont recreees avec le MEME nom (pas de renommage des policies elles-memes en scope 5.A, sauf "Accompagnante reads ..." qui peut etre renomme "Accompagnant reads ..." pour coherence editoriale -- decision laissee a l'execution 5.A.2).

### Decision D7 : Ordre execution stories 5.A.1 -> 5.A.6

Confirme et detaille :

1. **5.A.1 (cette story)** : produit tech-spec (ce document). Aucun impact code/BDD.
2. **5.A.2** : migration BDD prod en une seule transaction Supabase (`apply_migration`). Apres : enum a 4 valeurs (3 actives + 1 orpheline `accompagnante`), 15 colonnes renommees, 3 helpers RLS renommes, 23 policies recreees. **Fenetre cutover < 5 secondes** (snapshot + DDL + UPDATE 822 lignes + recreation policies).
3. **5.A.3** : regeneration `types/supabase.ts` via MCP. Resorption references code TS : queries `.from()`, conditions `role === 'accompagnante'` -> `'accompagnant'`, types locaux derives. **L'enum `user_role` cote TS continue de lister les 4 valeurs** (`'accompagnante' | 'accompagnant' | 'accompagne' | 'admin'`) tant que la valeur orpheline n'est pas droppee Epic 6. Le code applicatif n'utilise plus que `'accompagnant'`.
4. **5.A.4** : renommage 6 dossiers routes `/accompagnante/*` -> `/accompagnant/*`, redirects 301, middleware.
5. **5.A.5** : find-replace global copy UI + emails. **Hors scope** : la copy de la table `accompagne_accompagnantes` dans les 9 RLS policies (renommees au feminin pour conformite name-as-data) -> dette acceptee.
6. **5.A.6** : tests E2E Playwright + validation a11y + DECISIONS.md cloture.

### Decision D8 : Plan rollback par mode de defaillance

**Mode 1 - Defaillance backfill UPDATE (n lignes != attendu)** :
- Cause probable : race condition d'insertion pendant la migration (improbable car cutover < 5 sec, mais possible si un nouvel user s'inscrit pendant la migration en non-bloquant).
- Detection : query post-migration `SELECT role, COUNT(*) FROM users GROUP BY role` doit retourner 0 ligne `accompagnante`.
- Rollback : `UPDATE users SET role = 'accompagnante' WHERE role = 'accompagnant'` puis investigation race condition. Pas de rollback enum (valeur conservee, non destructive).
- Cout : ~1 minute.

**Mode 2 - Defaillance policies RLS (test post-migration revele acces non autorise ou denial illegitime)** :
- Cause probable : erreur de copie dans le DDL `CREATE POLICY`, ou helper renomme avec body incorrect.
- Detection : test scenarios Vitest/Playwright sur les 7+ policies critiques (5.A.2 AC).
- Rollback : DROP les 23 policies + recreation depuis snapshot `pg_dump pg_policies` realise avant 5.A.2. Snapshot SQL stocke dans `_bmad-output/implementation-artifacts/snapshot-5-a-2-pre-cutover-policies.sql`.
- Cout : ~5 minutes.

**Mode 3 - Defaillance helper renomme** :
- Cause probable : oubli d'un call site (policies, vues, autres functions).
- Detection : erreur SQL `function is_accompagnante() does not exist` en runtime.
- Rollback : recreer la function `is_accompagnante` comme alias vers `is_accompagnant` :
  ```sql
  CREATE FUNCTION public.is_accompagnante() RETURNS boolean LANGUAGE sql STABLE
  AS $$ SELECT public.is_accompagnant() $$;
  ```
  Pas de rollback du renommage cote applicatif.
- Cout : ~2 minutes.

**Mode 4 - Defaillance code TS post-merge (build Vercel rouge)** :
- Cause probable : story 5.A.3 a oublie un cast `role === 'accompagnante'` qui ne match plus l'enum migre (cote BDD la valeur existe encore comme orpheline, donc TS continue de la lister).
- Detection : `tsc` rouge en CI, ou erreur runtime apres deploy.
- Rollback : revert commit story 5.A.3 (le revert ne touche pas la BDD donc safe). Re-tenter 5.A.3 plus rigoureusement.
- Cout : ~3 minutes (revert + redeploy Vercel automatique).

**Mode 5 - Defaillance perception utilisateur (regression UX visible inattendue)** :
- Cause probable : copy 5.A.5 a casse une chaine traduite, ou redirect 301 5.A.4 boucle.
- Detection : Sentry uptick exception ou retour utilisateur Slack/email.
- Rollback : revert commit story specifique (5.A.4 ou 5.A.5).
- Cout : ~2 minutes.

**Snapshot pre-cutover obligatoire** : avant `apply_migration` 5.A.2, executer :

```sql
-- Snapshot enum
SELECT enumlabel FROM pg_enum WHERE enumtypid = 'user_role'::regtype;
-- Snapshot 23 policies (sortie pg_get_policy en SQL DDL pour replay)
SELECT 'CREATE POLICY ' || quote_ident(policyname) || ' ON ' || quote_ident(tablename) || ' ... ' AS ddl FROM pg_policies WHERE qual LIKE '%accompagn%' OR with_check LIKE '%accompagn%';
-- Snapshot count users par role
SELECT role, COUNT(*) FROM users GROUP BY role;
-- Snapshot helpers (body)
SELECT proname, prosrc FROM pg_proc WHERE proname LIKE 'is_accompagn%';
```

Resultat persiste dans `_bmad-output/implementation-artifacts/snapshot-5-a-2-pre-cutover.md` avant story 5.A.2.

## 3. Plan validation pre-cutover

### Validation automatique CI (a faire passer en preview avant prod)

- `tsc --noEmit` exit 0 (apres 5.A.3, regenere types BDD)
- `npm run lint` baseline preservee
- `npm run lint:a11y-check` baseline preservee
- `npm run a11y:axe:check` exit 0 (zero violation Critical/Serious)
- `npm run test:unit` 8/8 verts
- `npm run test:integration` 14/14 verts (apres seeds rejoues sur nouveau schema)
- `npm run test:e2e` (si applicable, 6 parcours critiques)
- `npm run check:env`, `check:ip-spoofing`, `check:as-any-admin` exit 0

### Validation manuelle checklist parcours par role

| Action | Role accompagnant | Role accompagne | Role admin |
|---|---|---|---|
| Login | A tester | A tester | A tester |
| Lecture dashboard | A tester | A tester | A tester |
| Lecture profil | A tester | A tester | - |
| Publication annonce | A tester (accompagnant) | A tester (accompagne) | - |
| Envoi message | A tester | A tester | - |
| Ajout favori | A tester | A tester | - |
| Validation auxiliaire admin queue | - | - | A tester |
| Lecture historique admin | - | - | A tester |

## 4. Budget temps estime

| Story | Estimation | Justification |
|---|---|---|
| 5.A.1 (cette story) | 0.5 j | Tech-spec, pas de code |
| 5.A.2 | 1.5 j | Migration BDD + recreation 23 policies + test scenarios |
| 5.A.3 | 1 j | Regeneration types + grep `accompagnante` TS + replacements |
| 5.A.4 | 1 j | Renommage routes + redirects + middleware + test 301 |
| 5.A.5 | 1.5 j | Find-replace UI/emails massif + revue copy (1755 occurrences -> ~1000 hors code) |
| 5.A.6 | 0.5 j | Tests E2E + a11y + retro DECISIONS.md |
| **Total** | **6 j-dev** | Coherent avec cadrage initial (~6-8j) |

## 5. Items hors scope 5.A (candidats Epic 6)

- **Drop de la valeur enum orpheline `'accompagnante'`** : Postgres < 18 impose recreation enum complete. Reportee Epic 6 (1 story dediee, downtime ~30 sec sur table users 822 lignes).
- **Renommage des 2 tables** `accompagne_accompagnantes` -> `accompagnant_accompagnants` (ou `accompagne_accompagnants`) et `annonces_accompagnantes` -> `annonces_accompagnants`. Cf. decision D3.
- **Renommage de la copy des policies RLS** "Accompagnante reads own ..." -> "Accompagnant reads own ...". Decision D6.
- **Resorption de la dette terminologique dans les commentaires/docstrings TS** : optionnel, faible valeur.

## 6. Acte DECISIONS.md

A acter dans DECISIONS.md a la fin de cette story (decision F12) :

> **F12 : Strategie migration enum role `accompagnante` -> `accompagnant` = cutover atomique avec valeur orpheline differee**

Le contenu integre les decisions D1 a D8 ci-dessus.

## 7. Sorties de cette story

- Ce fichier `tech-spec-5-a-renommage.md` (livraison principale).
- Decision F12 ajoutee a `DECISIONS.md`.
- Commit `Story 5.A.1 : tech-spec renommage accompagnante -> accompagnant + decision F12`.
- Story 5.A.2 debloquee, peut demarrer apres validation Sylvain de ce tech-spec.
