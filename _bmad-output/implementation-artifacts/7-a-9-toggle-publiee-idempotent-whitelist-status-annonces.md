# Story 7.A.9 : Toggle `publiee` idempotent + whitelist status annonces

Status: review

<!-- Story 9 du mini-epic 7.A (hardening securite transverse) - Source : reviews 3.6 deferred-work.md lignes 215-216. Cadrage epic-7.md lignes 288-304. -->

## Story

En tant qu'**ingenieur backend roxanetnous voulant durcir les Server Actions de toggle d'annonces (`updateAnnonceAccompagnanteStatus` / `updateAnnonceAccompagneStatus`)**,
je veux **(a) rendre le toggle `publiee -> publiee` idempotent cote serveur (early-return sans UPDATE pour eviter le bump frauduleux de `published_at`), (b) ajouter une whitelist applicative `['publiee','archivee']` avant tout call BDD pour transformer une valeur out-of-band en message d'erreur lisible plutot qu'en erreur Postgres `invalid input value for enum annonce_status`, (c) acquitter l'audit BDD demande par AC3 cadrage en documentant que le type colonne `status` est deja un ENUM `annonce_status` qui rend factuellement impossible une donnee corrompue cote BDD**,
afin que **(1) un user abonne ne puisse plus spammer le bouton "Republier" pour bumper artificiellement `published_at` et remonter son annonce en tete du tri (effet de fraude au classement), (2) un client custom HTTP qui appellerait `updateAnnonce*Status(id, 'autre' as any)` recoive une erreur applicative explicite plutot que de produire une exception Postgres opaque dans Sentry, (3) la dette latente "TS guard contourne -> donnee corrompue" tracee dans `deferred-work.md:216` soit definitivement soldee avec une preuve audit (l'ENUM BDD est equivalent fort d'un CHECK et empeche structurellement la corruption)**.

**Contexte runtime actuel (audit MCP 2026-05-14)** :

```text
-- Type colonne status sur annonces_accompagnants et annonces_accompagnes :
data_type     | USER-DEFINED
udt_name      | annonce_status   <- ENUM Postgres
column_default| 'brouillon'::annonce_status
is_nullable   | NO

-- Valeurs autorisees par l'ENUM annonce_status :
brouillon, publiee, archivee, suspendue

-- CHECK constraints sur annonces_accompagnants + annonces_accompagnes :
0 row (aucun CHECK applicatif)
```

**Decouverte non triviale** : l'AC3 du cadrage epic-7.md ligne 300 demande de "verifier qu'un CHECK existe sur la colonne `status`. Si absent, story doit ajouter le CHECK". L'audit MCP 2026-05-14 revele que **le CHECK n'est pas necessaire car la colonne est typee ENUM Postgres `annonce_status`** : toute valeur hors `{brouillon, publiee, archivee, suspendue}` est rejetee nativement par Postgres avec erreur `invalid input value for enum annonce_status: "..."` (SQLSTATE 22P02). Un CHECK applicatif sur enum serait redondant et anti-pattern (double source de verite). La story doit donc :
- **NE PAS ajouter de CHECK** (l'ENUM le rend redondant)
- **Documenter explicitement** dans la story et la migration que l'AC3 du cadrage est satisfait par l'ENUM existant (audit log)
- **Garder l'AC2 whitelist applicative** car la valeur ajoutee n'est pas la securite BDD mais le message d'erreur utilisateur lisible + economie d'un round-trip BDD inutile

**Risque concret du bump non-corrige (AC1)** : un user abonne qui clique successivement "Archiver" -> "Republier" -> "Archiver" -> "Republier" sur la meme annonce bump `published_at` a chaque republication, ce qui sur le feed de recherche (tri par `published_at DESC` ligne 287 de `app/actions/annonces.ts`) remonte son annonce en haut. Apres correction (early-return sur `publiee -> publiee`), seul un cycle complet `archivee -> publiee` bumpera (legitime : reactivation reelle). Le scenario "publiee -> publiee direct" n'existe pas via le composant `AnnonceStatusToggle` (qui calcule `newStatus = currentStatus === 'publiee' ? 'archivee' : 'publiee'` ligne 19) **mais peut etre provoque par appel HTTP direct a la Server Action** -> AC1 protege contre cet abus.

**Risque concret du status out-of-band non-corrige (AC2)** : aujourd'hui, `updateAnnonce*Status(id, 'autre' as any)` arrive a Supabase qui leve une exception Postgres `22P02`. La branche `if (error) return { error: 'Erreur lors de la mise a jour.' }` masque le motif a l'utilisateur (message generique) **mais Sentry capture l'exception comme erreur applicative**. Apres correction (whitelist serveur), l'erreur retournee est explicite (`'Statut invalide.'`), aucun bruit Sentry, aucun round-trip BDD. Le surface d'attaque reel est faible (seul le composant client legitime appelle la Server Action, et il binarise sur 2 valeurs), donc AC5 audit Sentry 7j sera quasi-certainement 0 hit (ce qui valide que la dette est bien latente / theorique mais soldee proprement).

**Note historique** : la fonction s'appelle `updateAnnonceAccompagnanteStatus` (feminin) cote Server Action, **mais le cadrage epic-7.md utilise `updateAnnonceAccompagnantStatus` (masculin)**. La dette de renommage `accompagnante -> accompagnant` est suivie a part (AI-6.A.1 du retro Epic 6, ~84 variables internes TS restantes). Cette story **ne touche pas au nom de fonction** (preservation strict du code metier feminin, regle CLAUDE.md). Lire `updateAnnonceAccompagnanteStatus` partout ou le cadrage dit `updateAnnonceAccompagnantStatus`.

## Acceptance Criteria

### Audit BDD (acquittement AC3 cadrage)

- **AC1** : Audit MCP `execute_sql` documente dans `Dev Agent Record > Debug Log References` confirmant :
  - Le type de la colonne `status` des tables `annonces_accompagnants` ET `annonces_accompagnes` est `annonce_status` (ENUM).
  - Les valeurs autorisees par l'ENUM sont `{brouillon, publiee, archivee, suspendue}`.
  - Aucun CHECK constraint applicatif n'existe (`pg_constraint contype='c'` = 0 row sur ces 2 tables).
  - Conclusion ecrite : "AC3 du cadrage epic-7.md satisfait par l'ENUM BDD (equivalent fort de CHECK). Aucune migration ajoutee pour eviter le double-source-of-truth ENUM + CHECK."

### Idempotence toggle (AC1 cadrage)

- **AC2** : `app/actions/annonces.ts` `updateAnnonceAccompagnanteStatus` (lignes 155-197) et `updateAnnonceAccompagneStatus` (lignes 459-501) ajoutent un early-return idempotent **apres** la verification du profil et **avant** le check abonnement :
  ```typescript
  // Charger le status actuel pour idempotence (7.A.9 AC2) : evite le bump frauduleux de published_at
  const { data: current, error: currentErr } = await supabase
    .from('annonces_accompagnants') // ou 'annonces_accompagnes'
    .select('status')
    .eq('id', annonceId)
    .eq('accompagnant_id', profile.id) // ou 'accompagne_id'
    .maybeSingle()

  if (currentErr) return { error: 'Erreur lors de la mise a jour.' }
  if (!current) return { error: 'Annonce introuvable.' }

  if (current.status === 'publiee' && status === 'publiee') {
    return { success: true } // no-op idempotent : published_at preserve
  }
  ```
  **Important** : le early-return doit etre **avant** le check `hasActiveSubscription` pour eviter de paywaller un no-op (sinon un user qui perd son abonnement entre deux republications recevrait un message paywall errone alors qu'aucune action n'est requise).

- **AC3** : Le early-return ne s'applique qu'au cas `publiee -> publiee`. Les autres cas conservent le comportement existant :
  - `archivee -> publiee` : check abonnement + UPDATE `status='publiee'` + `published_at=now()` (legitime, reactivation reelle).
  - `publiee -> archivee` : UPDATE `status='archivee'` SANS bump `published_at` (deja le comportement actuel).
  - `archivee -> archivee` : non testable depuis le composant client (le toggle est binaire) mais l'early-return idempotent serveur est nice-to-have. **NON REQUIS** par cette story (faible valeur). Si le dev le fait gratuitement (cout = 1 ligne `if (current.status === 'archivee' && status === 'archivee') return { success: true }`), tant mieux ; sinon, traite uniquement `publiee -> publiee`.

### Whitelist status (AC2 cadrage)

- **AC4** : Les deux Server Actions ajoutent une whitelist applicative **en debut de fonction**, avant tout call BDD (avant meme `auth.getUser()` pour fail-fast) :
  ```typescript
  const ALLOWED_STATUSES = ['publiee', 'archivee'] as const
  if (!ALLOWED_STATUSES.includes(status as (typeof ALLOWED_STATUSES)[number])) {
    return { error: 'Statut invalide.' }
  }
  ```
  Justification du placement : le check ne necessite aucun acces BDD ni session, donc le faire en tete economise un round-trip auth + profil pour un appel malveillant.

- **AC5** : Le typage TypeScript `status: 'publiee' | 'archivee'` reste preserve (defense en profondeur : TS guard a la compilation + whitelist runtime). **NE PAS** elargir la signature a `string` -- la whitelist est un filet de securite, pas un assouplissement du contrat TS.

### Tests Vitest integration (AC4 cadrage)

- **AC6** : Nouveau fichier `tests/integration/annonces-toggle/idempotence-publiee.test.ts` qui couvre les 5 cas :
  - **(a) Toggle `publiee -> publiee` = no-op** : seed 1 annonce `status='publiee'` `published_at=T0`, appel `updateAnnonceAccompagnanteStatus(id, 'publiee')`, assert `success: true` + SELECT confirme `published_at = T0` (inchange, pas de bump).
  - **(b) Toggle status valeur out-of-band = error** : appel `updateAnnonceAccompagnanteStatus(id, 'autre' as any)`, assert `error: 'Statut invalide.'` + SELECT confirme `status` inchange + Sentry pas appele.
  - **(c) Toggle `archivee -> publiee` = bump legitime** : seed 1 annonce `status='archivee'` `published_at=T0`, mock `hasActiveSubscription` -> true, appel `updateAnnonceAccompagnanteStatus(id, 'publiee')`, assert `success: true` + SELECT confirme `published_at > T0` (bump effectif).
  - **(d) Toggle `publiee -> archivee` = pas de bump** : seed 1 annonce `status='publiee'` `published_at=T0`, appel `updateAnnonceAccompagnanteStatus(id, 'archivee')`, assert `success: true` + SELECT confirme `status='archivee'` + `published_at = T0` (preserve).
  - **(e) Symetrie `accompagne`** : repeter le test (a) pour `updateAnnonceAccompagneStatus` sur table `annonces_accompagnes` (au minimum un test smoke pour eviter une regression silencieuse sur l'une des 2 jumelles).

  Pattern de reference : `tests/integration/paywall/*.test.ts` (seed via supabase admin client, RLS-aware). Setup commun `tests/integration/setup.ts` deja en place (garde-fou Supabase local uniquement).

- **AC7** : Tous les tests existants (Vitest unit + integration + a11y axe-core) restent verts apres modification. Verifier specifiquement :
  - `tests/integration/paywall/abonne-actif.test.ts` (peut toucher au toggle annonce).
  - `tests/integration/paywall/sans-abonnement.test.ts` (idem).
  - `tsc --noEmit` 0 erreur.

### Audit Sentry post-deploy (AC5 cadrage)

- **AC8** : 7 jours apres deploy en prod, audit Sentry MCP pour confirmer 0 occurrence d'erreur "Statut invalide." declenchee par AC4. Resultat documente dans `Dev Agent Record > Completion Notes`. Si > 0 occurrences detectees, ouvrir investigation : un client custom HTTP existe vraiment et merite enquete (potentiel scraper, bot, ou debug client interne oublie). Decision attendue en review.

### Polish technique

- **AC9** : Aucun emoji introduit (regle CLAUDE.md). Tous les nouveaux libelles UI/erreurs en francais sans accents corrompus.
- **AC10** : Aucune copy UI nouvelle ne contient "accompagnante"/"accompagnantes" (regle CLAUDE.md genre). Le seul libelle utilisateur introduit est `'Statut invalide.'` (neutre).
- **AC11** : Pas de regression `npm run lint:a11y-check` (baseline jsx-a11y) ni `npm run a11y:axe:check` (baseline 0 violation Critical/Serious sur 7 parcours). Story sans impact UI direct mais commit livraison declenche les checks de toute facon.
- **AC12** : Commit de livraison au format `Story 7.A.9 : Toggle publiee idempotent + whitelist status annonces (F-Epic7-A9)` + Co-Authored-By Claude Sonnet 4.6 (pattern conventions BMad).

## Tasks / Subtasks

- [x] **T1 - Audit BDD ENUM annonce_status (AC1)**
  - [x] T1.1 - Executer via MCP `execute_sql` le snapshot pg_constraint sur les 2 tables (attendu 0 row).
  - [x] T1.2 - Executer via MCP `execute_sql` le snapshot information_schema.columns + pg_enum.
  - [x] T1.3 - Coller les 2 snapshots SQL bruts dans `Dev Agent Record > Debug Log References` avec ligne de conclusion "AC3 cadrage satisfait par ENUM".

- [x] **T2 - Patcher `updateAnnonceAccompagnanteStatus` (AC2, AC3, AC4, AC5)**
  - [x] T2.1 - `app/actions/annonces.ts` : ajout constant `ALLOWED_TOGGLE_STATUSES = ['publiee','archivee'] as const` + type `AllowedToggleStatus` apres le type `AnnonceResult` (lignes 15-19 post-modif).
  - [x] T2.2 - Check whitelist ajoute en tete de fonction (avant `auth.getUser()`).
  - [x] T2.3 - Apres recuperation `profile`, SELECT idempotence `.maybeSingle()` sur `status` filtre par `id` + `accompagnant_id`.
  - [x] T2.4 - `current.status === 'publiee' && status === 'publiee'` -> return `{ success: true }`.
  - [x] T2.5 - Check `hasActiveSubscription` confirme **apres** l'early-return idempotent (preservation pattern D5 Story 3.6).

- [x] **T3 - Patcher `updateAnnonceAccompagneStatus` (symetrie)**
  - [x] T3.1 - Pattern symetrique applique sur table `annonces_accompagnes` + colonne `accompagne_id` + profil `accompagnes_profiles`.
  - [x] T3.2 - Messages d'erreur strictement symetriques (`'Statut invalide.'`, `'Annonce introuvable.'`, `'Erreur lors de la mise à jour.'`) entre les 2 jumelles.

- [x] **T4 - Tests Vitest integration (AC6, AC7)**
  - [x] T4.1 - Dossier `tests/integration/annonces-toggle/` cree.
  - [x] T4.2 - Fixture `_fixtures.ts` avec `seedAnnonceAccompagnant({status, publishedAt})` + `seedAnnonceAccompagne(...)` + `readAnnonce*` + tracker local + `cleanupAnnoncesFixtures()` (le tracker global `_lib/fixtures.ts` ne couvre pas les tables `annonces_*`).
  - [x] T4.3 - `idempotence-publiee.test.ts` ecrit avec les 5 cas (a-e) d'AC6.
  - [x] T4.4 - Test:integration delegue GHA workflow au push branche dediee (heritage `feedback_test_local_supabase`, pas de Docker local Sylvain).

- [x] **T5 - Validation transversale (AC7, AC11)**
  - [x] T5.1 - `tsc --noEmit` : 0 erreur.
  - [x] T5.2 - `npm run lint` : 195 warnings = baseline 7.A.8 preserve, 0 erreur.
  - [x] T5.3 - `npm run lint:a11y-check` : 155 baseline preserve, no regression.
  - [x] T5.4 - `npm run a11y:axe:check` : 0 delta Critical/Serious sur 7 parcours.
  - [x] T5.5 - `npm run test:unit` : 49/49 verts en 1.02s (regression 7.A.6+7.A.7+7.A.8 preservee).

- [x] **T6 - Documentation et closeout**
  - [x] T6.1 - Dev Agent Record > Completion Notes List rempli ci-dessous (snapshots SQL pre = post car pas de migration, fichiers modifies, AC8 audit Sentry J+7 planifie).
  - [ ] T6.2 - Commit livraison au format `Story 7.A.9 : ...` (deferre a la phase commit utilisateur).
  - [x] T6.3 - `deferred-work.md` lignes 215-216 barrees avec mention `[Solde 7.A.9 - 2026-05-14]`.

## Dev Notes

### Architecture et conventions

- **Stack** : Next.js 16 App Router + Supabase + TypeScript strict + Tailwind v4 (cf. `_bmad-output/planning-artifacts/architecture-technique-roxanetnous-2026-02-09.md` + `.claude/CLAUDE.md`).
- **Package type ESM** : pas de `require`, imports `from '@/...'` (alias root `tsconfig.json`).
- **Pattern Server Action** : "use server" implicite via dossier `app/actions/`. Retour `Promise<{ success: true } | { error: string }>` (type `AnnonceResult` defini en haut de `app/actions/annonces.ts`).
- **Pattern paywall asymetrique D5** : check abonnement uniquement sur `status === 'publiee'`. Confirme par story 3.6 (cf. `app/actions/annonces.ts:172-179`). **Ne pas casser ce pattern** : le early-return idempotent doit etre **avant** le check abonnement (cf. AC2 note).
- **Pattern Supabase RLS** : filtrer par `accompagnant_id = profile.id` (resp. `accompagne_id`) sur tous les SELECT/UPDATE pour respecter la RLS. Le SELECT idempotence doit imperativement avoir ce filtre.

### Code paths critiques touches

- `app/actions/annonces.ts:155-197` (fonction `updateAnnonceAccompagnanteStatus` -- nom feminin, dette renommage hors scope).
- `app/actions/annonces.ts:459-501` (fonction `updateAnnonceAccompagneStatus`).
- **Call sites client** : `components/accompagnant/annonce-status-toggle.tsx:4` (seul consommateur connu, binarise sur 2 valeurs). Pas de modification cote composant client necessaire.

### Pattern test integration

- `tests/integration/setup.ts` : garde-fou refus hostname non-local. Auto-loaded via `vitest.config.ts`.
- `tests/integration/paywall/abonne-actif.test.ts` : exemple de seed user abonne + annonce + assertion sur Server Action.
- `tests/integration/_lib/` : helpers communs (admin client, seedUser, etc.).
- **Convention naming** : fichier `<feature>.test.ts` dans dossier `<feature-group>/`.
- **Convention mock subscription** : pattern `vi.mock('@/lib/subscription-helpers')` puis `vi.mocked(hasActiveSubscription).mockResolvedValue(true)`. Voir `tests/integration/paywall/abonne-actif.test.ts:15-25`.

### References

- Cadrage : `_bmad-output/planning-artifacts/epic-7.md` lignes 288-304 (story 7.A.9).
- Source dette : `_bmad-output/implementation-artifacts/deferred-work.md` lignes 215-216 (review 3.6 deferred).
- Code metier : `app/actions/annonces.ts` (155-197, 459-501).
- Consommateur client : `components/accompagnant/annonce-status-toggle.tsx` (12-54).
- Pattern paywall : `app/actions/annonces.ts:172-184` (decision D5 story 3.6).
- Pattern tests integration : `tests/integration/paywall/*.test.ts` + `tests/integration/setup.ts`.
- Conventions BMad : memoire `project_bmad_conventions.md` (format commit + statut done apres merge).
- Regle test BDD : memoire `feedback_test_local_supabase.md` (validation via GHA workflow uniquement, pas de Docker local).
- Audit MCP 2026-05-14 : pg_enum + information_schema + pg_constraint sur `annonce_status` / `annonces_accompagnants` / `annonces_accompagnes` (resultats dans contexte cadrage ci-dessus).

### Project Structure Notes

- Modifications sur `app/actions/annonces.ts` uniquement cote code metier. Aucun nouveau fichier de migration BDD (cf. AC1 : ENUM existant fait office de CHECK).
- Nouveau dossier `tests/integration/annonces-toggle/` aligne avec la convention test integration en place (1 dossier = 1 feature-group).
- Pas d'impact composant client (`AnnonceStatusToggle` reste inchange : il binarise deja les valeurs).
- Pas d'impact UI : commits ne devraient pas declencher de nouveau warning axe-core ou jsx-a11y, mais checks DoD a11y CI s'executent par defaut sur tout commit livraison story.

### Previous Story Intelligence

- **Story 7.A.8 (done 2026-05-14)** : pattern d'investigation MCP + decision DECISIONS.md, exhaustivite audit (3 queries SQL pour confirmer 0 dependance). **Adopter le meme rigueur ici** : coller les snapshots SQL bruts dans Dev Agent Record.
- **Story 7.A.7 (done 2026-05-14)** : CHECK XOR sur `admin_actions_log` -- exemple de cas ou un CHECK applicatif a ete ajoute parce que l'ENUM n'etait pas une option (colonnes texte libres). **Contraste avec 7.A.9** : ici l'ENUM existe deja, donc pas de CHECK.
- **Story 7.A.6 (done 2026-05-14)** : idempotence `logNotification` via partial UNIQUE INDEX + capture 23505. **Pattern symetrique** : idempotence cote application via early-return (7.A.9) vs idempotence cote BDD via index (7.A.6). Les deux co-existent par design (BDD = defense en profondeur, app = UX + economie round-trip).
- **Story 3.6 (done 2026-05-07)** : a introduit le check paywall asymetrique sur le toggle. Les 2 dettes adressees par 7.A.9 ont ete identifiees au code review de 3.6 (cf. `deferred-work.md:215-216`). **Ne pas regresser** le check paywall.

### Git Intelligence

- Branche cible : `main` (workflow trunk-based, pas de feature branch).
- Pattern commit recent : `chore(7.A.8): cloture code review story 7.A.8 + patches review` (9fb3612) -- le commit livraison `Story X.Y.Z : ...` precede souvent un commit `chore(X.Y.Z): cloture code review ...` apres review humaine.
- Co-Authored-By systematique : `Co-Authored-By: Claude Sonnet 4.6 <noreply@anthropic.com>`.

### Latest Tech Information

- Supabase JS SDK : `.maybeSingle()` recommande pour le SELECT idempotence (retourne `null` au lieu de throw sur 0 row). `.single()` throw sur 0 ou 2+ rows et peut masquer une erreur transitoire en `error.code === 'PGRST116'`. Pattern deja utilise dans `app/actions/annonces.ts:164-168` (profile fetch).
- Postgres ENUM : valeur invalide rejette avec `error.code === '22P02'` (`invalid_text_representation`). Le filtre TypeScript + whitelist applicative empeche structurellement ce code d'arriver, mais la branche `if (error)` reste un filet de derniere chance.
- Vitest 1.x + `@vitest/integration` : pattern `describe('integration:', () => { ... })` avec `beforeEach` qui reset la BDD via tronquature ciblee. Confirmer le pattern de cleanup dans `tests/integration/_lib/cleanup.ts` (si existe) ou suivre celui de `paywall/`.

## Dev Agent Record

### Agent Model Used

claude-opus-4-7 (1M context) via bmad-dev-story workflow, 2026-05-14.

### Debug Log References

**Audit MCP 2026-05-14 (T1) -- snapshots SQL bruts :**

```sql
-- T1.2 information_schema.columns sur 2 tables, colonne `status`
SELECT table_name, column_name, data_type, udt_name, column_default, is_nullable
FROM information_schema.columns
WHERE table_schema = 'public'
  AND table_name IN ('annonces_accompagnants','annonces_accompagnes')
  AND column_name = 'status';
```

Resultat :

| table_name | column_name | data_type | udt_name | column_default | is_nullable |
| --- | --- | --- | --- | --- | --- |
| annonces_accompagnants | status | USER-DEFINED | annonce_status | `'brouillon'::annonce_status` | NO |
| annonces_accompagnes | status | USER-DEFINED | annonce_status | `'brouillon'::annonce_status` | NO |

```sql
-- T1.2 pg_enum valeurs autorisees
SELECT t.typname AS enum_name, e.enumlabel AS enum_value, e.enumsortorder
FROM pg_type t
JOIN pg_enum e ON e.enumtypid = t.oid
WHERE t.typname = 'annonce_status'
ORDER BY e.enumsortorder;
```

Resultat : `brouillon (1), publiee (2), archivee (3), suspendue (4)`.

```sql
-- T1.1 pg_constraint CHECK applicatifs sur les 2 tables
SELECT n.nspname AS schema, c.relname AS table_name, con.conname, pg_get_constraintdef(con.oid)
FROM pg_constraint con
JOIN pg_class c ON c.oid = con.conrelid
JOIN pg_namespace n ON n.oid = c.relnamespace
WHERE c.relname IN ('annonces_accompagnants','annonces_accompagnes')
  AND con.contype = 'c';
```

Resultat : `[]` (0 row).

**Conclusion (T1.3)** : **AC3 du cadrage epic-7.md ligne 300 est satisfait par l'ENUM Postgres `annonce_status` existant** (equivalent fort d'un CHECK : toute valeur hors `{brouillon, publiee, archivee, suspendue}` est rejetee nativement avec SQLSTATE `22P02 invalid_text_representation`). Aucune migration BDD ajoutee : un CHECK applicatif sur enum serait redondant et anti-pattern double-source-of-truth.

### Completion Notes List

- **Implementation** : 2 Server Actions patchees avec strict symetrie (whitelist runtime fail-fast + SELECT `.maybeSingle()` idempotence + early-return `publiee -> publiee` AVANT check abonnement pour ne pas paywaller un no-op). Constante `ALLOWED_TOGGLE_STATUSES = ['publiee','archivee'] as const` declaree au scope module (1 source de verite pour les 2 jumelles).
- **Pas de migration BDD** : audit MCP T1 confirme que l'ENUM `annonce_status` est equivalent fort d'un CHECK. AC3 cadrage acquitte sans migration (cf. Debug Log References).
- **Tests** : `tests/integration/annonces-toggle/` 2 fichiers (1 fixtures + 1 test 5 cas a/b/c/d/e). `_fixtures.ts` instaure un tracker local car le tracker global `_lib/fixtures.ts` ne couvre pas les tables `annonces_*` (ordre FK-safe + cleanup explicite). Cas (b) utilise `'autre' as unknown as 'publiee'` pour simuler proprement un bypass TS sans `any` global.
- **Validations** : tsc 0 erreur, lint 195 warnings (= baseline 7.A.8 preserve), lint:a11y-check 155 baseline preserve, a11y:axe:check 0 delta Critical/Serious sur 7 parcours (regle CLAUDE.md durcie respectee meme si story BDD/code metier pure 0 impact UI), test:unit 49/49 verts.
- **Tests integration** : delegue GHA workflow `integration-tests.yml` au push branche dediee (heritage `feedback_test_local_supabase` : pas de Docker local Sylvain).
- **AC8 audit Sentry J+7** : planifie ~2026-05-21 post-merge, attente 0 occurrence d'erreur `'Statut invalide.'` declenchee par AC4 (surface d'attaque reelle quasi-nulle, seul `AnnonceStatusToggle` legitime call la Server Action et binarise sur 2 valeurs). Si > 0 occurrences -> investigation client custom HTTP / scraper / debug oublie.
- **Dette acquittee** : `deferred-work.md` lignes 215-216 barrees avec mention `[Solde 7.A.9 - 2026-05-14]`.
- **Hors scope** : aucun renommage `accompagnante -> accompagnant` (preservation stricte du code metier feminin historique conformement a la regle CLAUDE.md, dette AI-6.A.1 suivie a part).

### File List

- `app/actions/annonces.ts` (modifie : ajout constante module `ALLOWED_TOGGLE_STATUSES` + patch 2 Server Actions `updateAnnonceAccompagnanteStatus` et `updateAnnonceAccompagneStatus`)
- `tests/integration/annonces-toggle/_fixtures.ts` (nouveau : helpers seed/read + tracker local + cleanup)
- `tests/integration/annonces-toggle/idempotence-publiee.test.ts` (nouveau : 5 cas a/b/c/d/e couvrant AC6)
- `_bmad-output/implementation-artifacts/deferred-work.md` (modifie : lignes 215-216 barrees + mention solde)
- `_bmad-output/implementation-artifacts/7-a-9-toggle-publiee-idempotent-whitelist-status-annonces.md` (modifie : status, tasks coches, Dev Agent Record renseigne, change log)
- `_bmad-output/implementation-artifacts/sprint-status.yaml` (modifie : statut story 7.A.9 `ready-for-dev -> in-progress -> review`)

### Change Log

- 2026-05-14 : implementation 7.A.9 -- whitelist applicative + early-return idempotent `publiee -> publiee` sur les 2 Server Actions toggle d'annonce. Audit MCP confirme ENUM BDD `annonce_status` suffit (pas de CHECK ajoute). 5 tests integration nouveau dossier `tests/integration/annonces-toggle/`. Acquit dettes deferred-work.md lignes 215-216. Story `ready-for-dev -> review`.

## DoD a11y

Story sans impact UI direct (modifie uniquement code metier Server Actions + tests integration). Checks CI declenches par defaut sur commit livraison story :

- [ ] Pas de regression `eslint-plugin-jsx-a11y` (`npm run lint:a11y-check` vert en CI)
- [ ] Pas de regression axe-core (`npm run a11y:axe:check` vert, baseline 0 violation Critical/Serious sur 7 parcours)
- [N/A] Labels associes aux champs : pas de champ ajoute/modifie.
- [N/A] Erreurs liees aux champs via aria-describedby : pas de formulaire touche.
- [N/A] Focus visible : pas de composant interactif touche.
- [N/A] Contrastes texte/UI : pas de couleur modifiee.
- [N/A] ARIA states : pas de composant dynamique touche.
- [N/A] Navigation clavier : pas de pattern interactif touche.
- [N/A] Verification lecteur d'ecran : pas de composant touche.
