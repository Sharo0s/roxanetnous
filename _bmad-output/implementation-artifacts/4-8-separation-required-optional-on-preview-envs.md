# Story 4.8 : Separation REQUIRED vs OPTIONAL_ON_PREVIEW dans `check-required-env.mjs`

Status: done

<!-- Note : Story ordre 2 NON BLOQUANTE go-live Bretagne (cf. epic-4.md ligne 58 + sprint-status.yaml ligne 156). Acquit de la dette AI-3.8 issue de la retro Epic 3 (epic-3-retro-2026-05-07.md ligne 159). Le pattern productionOnly:true a deja ete partiellement introduit story 4.1 (cf. patch review 2026-05-07 sur scripts/check-required-env.mjs:46-60) — cette story formalise l'API en renommant productionOnly -> OPTIONAL_ON_PREVIEW + en passant le script en exit 1 sur prod si REQUIRED manquant (durcissement par rapport au warn-only actuel). -->

## Story

En tant que **developpeur du projet roxanetnous**,
je veux **(1) refactorer `scripts/check-required-env.mjs` pour declarer explicitement deux categories de variables d'environnement (`REQUIRED` strictement obligatoires en production ET en preview, `OPTIONAL_ON_PREVIEW` obligatoires en production mais tolerees absentes en preview), (2) durcir le comportement production en faisant exit 1 (build Vercel rouge) si une variable `REQUIRED` ou `OPTIONAL_ON_PREVIEW` est absente en `VERCEL_ENV=production`, (3) garder le silence en preview uniquement pour les variables classees `OPTIONAL_ON_PREVIEW` (Sentry/RATE_LIMIT_HASH_SALT typiquement), et (4) basculer toutes les variables actuellement marquees `productionOnly: true` (4 vars Sentry + RATE_LIMIT_HASH_SALT) sous la nouvelle categorie `OPTIONAL_ON_PREVIEW`**,
afin de **(a) supprimer la pollution `console.warn` quotidienne sur les builds preview Vercel pour des variables non-applicables hors prod (heritage AI-3.8 retro Epic 3), (b) re-installer un vrai garde-fou go-live en faisant casser la build prod si une variable critique manque (renforcement par rapport au warn-only D2 story 3.8 explicitement signale comme "a durcir Epic 4" dans la retro), (c) clarifier semantiquement la liste des 14 variables REQUIRED_VARS actuellement traitees uniformement (9 vraies REQUIRED + 5 OPTIONAL_ON_PREVIEW melangees avec un flag implicite), (d) preparer la base API pour de futures categories (DEV_ONLY, PROD_ONLY) si Epic 5+ en a besoin**.

C'est la **sixieme story de l'Epic 4 « Hardening pre-go-live Bretagne »** (1ere story ordre 2 a etre developpee, post go-live Bretagne envisageable). Elle est **non bloquante go-live Bretagne** (cf. epic-4.md ligne 321 « Bloquant go-live : non »), donc peut etre livree apres ou en parallele du toggle admin du premier departement Bretagne. Sequencage actuel : 4.1 done -> 4.2 done -> 4.3 done -> 4.4 done -> 4.7 done -> **4.8 (cette story)** -> 4.5/4.6/4.9 (autres stories ordre 2).

Elle s'appuie sur les decouvertes intermediaires des stories ordre 1 :

- **Story 3.8 (livree 2026-05-07)** : creation du script `scripts/check-required-env.mjs` en mode `warn-only / exit 0` avec 9 variables REQUIRED (cf. story 3-8 AC3 ligne 49-72). Decision D2 explicite « non bloquant pour cette story, a durcir Epic 4 » (cf. story 3-8 AC4 ligne 71 commentaire « Si plus tard (Epic 4) il devient bloquant, le passer en exit 1 sur production sera un changement d'une ligne »).
- **Story 4.1 (livree 2026-05-07, patch review)** : ajout de 4 variables Sentry (`NEXT_PUBLIC_SENTRY_DSN`, `SENTRY_DSN`, `SENTRY_ORG`, `SENTRY_PROJECT`) + `RATE_LIMIT_HASH_SALT` (5 nouvelles variables au total) avec un flag ad hoc `productionOnly: true` introduit par patch [scripts/check-required-env.mjs:46-60] pour eviter le bruit warn quotidien preview. Pattern non documente dans les AC initiaux story 4.1, ajoute en revue. **Cette story 4.8 le formalise**.
- **Retro Epic 3 ligne 130** : « Build-time garde-fou `scripts/check-required-env.mjs` warning si `ADMIN_NOTIFICATIONS_EMAIL` manquant en `VERCEL_ENV=production` (non-bloquant Epic 3, **a durcir Epic 4**) ». Cette story livre ce durcissement.

**Le coeur de la story** :

- (a) **Refactor structure de donnees `scripts/check-required-env.mjs`** : remplacer la constante unique `REQUIRED_VARS` (array d'objets `{ name, description, productionOnly?: true }`) par **deux constantes distinctes** : `REQUIRED` (array d'objets `{ name, description }`, 9 entrees) + `OPTIONAL_ON_PREVIEW` (array d'objets `{ name, description }`, 5 entrees). Le flag `productionOnly` disparait au profit de la categorie de la liste.
- (b) **Logique de check refactoree** : la fonction `isMissing(v)` reste identique. Les listes manquantes sont recalculees en deux passes (`missingRequired`, `missingOptionalOnPreview`).
- (c) **Comportement par environnement** :
  - `VERCEL_ENV === 'production'` : si `missingRequired.length > 0` OU `missingOptionalOnPreview.length > 0`, **emettre `console.error` (pas warn)** + **`process.exit(1)`** (build Vercel ROUGE, regression bloquante). Sinon `console.log('OK: all required env vars present (production).')` + exit 0.
  - `VERCEL_ENV === 'preview'` : si `missingRequired.length > 0`, emettre `console.warn(...)` + **exit 1** (preview ROUGE car les REQUIRED sont strictement obligatoires meme en preview, ex : `RESEND_API_KEY` sans laquelle aucun email ne part meme en debug preview). Si seulement `missingOptionalOnPreview.length > 0`, **silencieux total** (zero log, exit 0). Sinon `console.log('OK: all required env vars present (preview).')` + exit 0.
  - `VERCEL_ENV === undefined` (dev local hors `vercel dev`) : comportement **identique a l'actuel**, silencieux sauf si tout est present (alors `OK`). Exit 0 systematiquement (dev local n'a pas vocation a echouer pour vars absentes, le `.env.local` est responsabilite du dev).
- (d) **Bascule des 5 variables `productionOnly: true` actuelles vers `OPTIONAL_ON_PREVIEW`** : `NEXT_PUBLIC_SENTRY_DSN`, `SENTRY_DSN`, `SENTRY_ORG`, `SENTRY_PROJECT`, `RATE_LIMIT_HASH_SALT`. Toutes les autres variables (9) restent en `REQUIRED`.
- (e) **Documentation** : commentaire d'en-tete reformule explicitement les deux categories + leur semantique. Mise a jour de `NEXT_STEPS.md` section variables d'env (ajouter sous-section `Optionnelles en preview` distincte). Mise a jour de `TODO-LAUNCH.md` ligne `ADMIN_NOTIFICATIONS_EMAIL` (le garde-fou est desormais bloquant en prod, non plus warning).
- (f) **Test manuel documente sur 4 contextes** (vs 3 contextes story 3.8) : ajouter le cas `VERCEL_ENV=preview` avec une `OPTIONAL_ON_PREVIEW` manquante (silencieux exit 0) et `VERCEL_ENV=preview` avec une `REQUIRED` manquante (warn + exit 1). Sortie exacte consignee dans `Completion Notes List`.
- (g) **Validation CI** : pousser une PR, verifier que la build preview Vercel ne genere aucun `WARN` Sentry/RATE_LIMIT_HASH_SALT (ces vars sont absentes des scopes preview confirme par `vercel env ls --environment preview` au cadrage). Verifier que la build production simulee localement avec `VERCEL_ENV=production node scripts/check-required-env.mjs` exit 1 si `ADMIN_NOTIFICATIONS_EMAIL` est artificiellement masque (`unset ADMIN_NOTIFICATIONS_EMAIL && VERCEL_ENV=production node scripts/check-required-env.mjs ; echo $?` -> doit afficher `1`).

**Hors scope explicite** :

1. **Ajout de nouvelles variables au check** : zero nouvelle entree dans `REQUIRED` ou `OPTIONAL_ON_PREVIEW`. La liste reste identique a l'apres-4.1 (9 + 5 = 14 vars). Si une variable manque (ex : `SUPABASE_JWT_SECRET`), audit dependances dedie en story Epic 5+.
2. **Categories supplementaires (`DEV_ONLY`, `PROD_ONLY`, `OPTIONAL_ALWAYS`)** : pas de generalisation premature. Deux categories suffisent pour l'Epic 4. Extension future si besoin avere.
3. **Validation de format des valeurs (regex DSN, longueur clef HMAC)** : trop de surface, hors scope. La validation reste binaire `present / absent / chaine vide apres trim`.
4. **Migration vers TypeScript (`scripts/check-required-env.ts` + tsx)** : conserver `.mjs` pure JS pour eviter ajout de toolchain build-time. Pattern coherent avec `scripts/check-a11y-baseline.mjs`.
5. **Tests unitaires Vitest** : test manuel suffisant (cf. AC8). Ajouter Vitest sur ce script ne ratrape pas le ratio cout/benefice. Si Epic 5+ multiplie les scripts CI, factoriser dans une suite dediee.
6. **Modification du `buildCommand` Vercel** : `vercel.json` reste inchange (`npm run check:env && ...`). Le seul changement est que `npm run check:env` peut desormais retourner exit 1 (et donc casser la build) en production, ce qui est le but explicite.
7. **Modification de `lib/emails.ts`, `app/admin/historique/page.tsx`, ou tout code applicatif** : zero changement applicatif. Story chirurgicale sur le script + docs.
8. **Suppression du flag `productionOnly: true` de l'historique** : il sera physiquement absent du nouveau code mais on ne re-ecrit pas l'historique des commits. Le pattern legacy `productionOnly: true` ne survit que dans les diffs git anciens (cf. story 4.1 patch review 2026-05-07).
9. **Sentry capture de l'evenement « build prod casse pour env manquante »** : pas necessaire — le build Vercel rouge est deja le signal explicite (notification email Vercel + Slack si configure). Pas de bouclage Sentry sur les erreurs de build.

## Acceptance Criteria

### AC fonctionnels (refactor + comportement)

1. **AC1 — Deux constantes distinctes `REQUIRED` et `OPTIONAL_ON_PREVIEW`** : Given le script actuel `scripts/check-required-env.mjs:6-75` declare une constante unique `REQUIRED_VARS` melangeant 9 vraies REQUIRED + 5 entrees flagguees `productionOnly: true`, when la story est livree, then :
   - **Constante `REQUIRED`** (9 entrees, ordre conserve depuis l'actuel) :
     - `ADMIN_NOTIFICATIONS_EMAIL` — `'Destinataire alertes anti-fraude parrainage.'`
     - `RESEND_API_KEY` — `'API Resend pour emails transactionnels.'`
     - `NEXT_PUBLIC_BASE_URL` — `'URL canonique production (liens emails).'`
     - `STRIPE_SECRET_KEY` — `'Stripe paywall.'`
     - `STRIPE_WEBHOOK_SECRET` — `'Stripe webhook signature.'`
     - `SUPABASE_SERVICE_ROLE_KEY` — `'Server actions admin.'`
     - `CRON_SECRET` — `'Auth /api/cron/*.'`
     - `PARRAINAGE_INTERNAL_SECRET` — `'Auth helper revoke filleule (story 2.3).'`
     - `ENCRYPTION_KEY` — `'Chiffrement justificatifs accompagnantes.'`
   - **Constante `OPTIONAL_ON_PREVIEW`** (5 entrees, ordre conserve depuis les 5 entrees `productionOnly: true` actuelles) :
     - `NEXT_PUBLIC_SENTRY_DSN` — `'DSN Sentry expose au client (capture exceptions browser).'`
     - `SENTRY_DSN` — `'DSN Sentry server-side (peut etre identique au public).'`
     - `SENTRY_ORG` — `'Slug organisation Sentry (upload sourcemaps build-time).'`
     - `SENTRY_PROJECT` — `'Slug projet Sentry (upload sourcemaps build-time).'`
     - `RATE_LIMIT_HASH_SALT` — `'Sel HMAC hash rate-limit Sentry (irreversibilite IP).'`
   - **Aucune entree avec flag `productionOnly`** dans le code livre. Le flag est entierement remplace par la categorie de la liste.
   - **Total : 14 entrees** (9 REQUIRED + 5 OPTIONAL_ON_PREVIEW), strictement equivalent a la liste actuelle (zero ajout, zero suppression).

2. **AC2 — Comportement `VERCEL_ENV === 'production'` strict** : Given le script est execute avec `VERCEL_ENV=production`, when **au moins une variable REQUIRED OU OPTIONAL_ON_PREVIEW** est manquante (`undefined` ou chaine vide apres `String(...).trim()`), then :
   - **`console.error(...)` (pas warn)** est emis pour chaque variable manquante, format : `ERROR: <NAME> is not set in VERCEL_ENV=production. <description>` (changement libelle warn->error pour signaler la severite accrue).
   - **`process.exit(1)`** termine le script (build Vercel **ROUGE**, merge bloque sur main).
   - Si toutes les variables sont presentes : `console.log('OK: all required env vars present (VERCEL_ENV=production).')` + `process.exit(0)`. Format identique a l'actuel.

3. **AC3 — Comportement `VERCEL_ENV === 'preview'` differencie** : Given le script est execute avec `VERCEL_ENV=preview`, when la story est livree, then :
   - **Si au moins une variable `REQUIRED` est manquante** : `console.error(...)` pour chaque (format : `ERROR (preview): <NAME> is not set. <description>`) + `process.exit(1)` (build preview **ROUGE** — les REQUIRED restent strictement obligatoires meme en preview car sans elles le code applicatif crash au runtime, ex : pas de `RESEND_API_KEY` = pas d'envoi email = test preview email impossible). **Note** : libelle `ERROR` (pas `WARN`) aligne avec branche prod, applique en code review 2026-05-07 pour coherence severite vs exit code.
   - **Si seulement des variables `OPTIONAL_ON_PREVIEW` sont manquantes** (et toutes les `REQUIRED` presentes) : **silence total**, aucun log emis, `process.exit(0)` (build preview verte). C'est la regression cible : plus de spam `WARN: NEXT_PUBLIC_SENTRY_DSN is not set` quotidien.
   - **Si toutes presentes** : `console.log('OK: all required env vars present (VERCEL_ENV=preview).')` + `process.exit(0)`.

4. **AC4 — Comportement dev local (sans `VERCEL_ENV`) inchange** : Given le script est execute sans variable d'environnement `VERCEL_ENV` definie (cas `npm run check:env` lance manuellement par un dev local), when la story est livree, then :
   - **Si toutes les variables presentes** : `console.log('OK: all required env vars present.')` + `process.exit(0)`.
   - **Si au moins une manquante** (REQUIRED ou OPTIONAL_ON_PREVIEW) : **silence total**, aucun log emis, `process.exit(0)`. Le dev consulte `.env.local` lui-meme.
   - **Comportement strictement identique** au script actuel (lignes 113-116 `scripts/check-required-env.mjs:113-116`). Aucune regression.

5. **AC5 — Commentaire d'en-tete reformule** : Given le commentaire actuel `scripts/check-required-env.mjs:1-4` mentionne uniquement « Verifie que les variables d'env critiques sont definies en VERCEL_ENV=production. Non bloquant : warn only », when la story est livree, then le commentaire d'en-tete (4-12 lignes) decrit explicitement les deux categories :
   ```js
   #!/usr/bin/env node
   // Verifie la presence des variables d'env critiques selon l'environnement Vercel.
   //
   // Deux categories :
   //   - REQUIRED              : obligatoires en production ET en preview (exit 1 si manquantes).
   //                             Sans elles, le code applicatif crash au runtime (ex: RESEND_API_KEY).
   //   - OPTIONAL_ON_PREVIEW   : obligatoires en production uniquement (exit 1 prod / silence preview).
   //                             Tolerees absentes en preview/dev (ex: Sentry sans projet preview cree).
   //
   // Integre au buildCommand Vercel via `npm run check:env` (vercel.json).
   // Story 3.8 a installe le script en warn-only ; story 4.8 le durcit en exit 1 prod.
   ```

6. **AC6 — Variables ENCRYPTION_KEY, PARRAINAGE_INTERNAL_SECRET, CRON_SECRET, SUPABASE_SERVICE_ROLE_KEY restent strictement REQUIRED** : Given ces 4 variables sont des secrets cryptographiques utilises a la fois en production ET en preview (les preview Vercel hit les meme cron jobs et meme BDD Supabase staging si configuree), when la story est livree, then **aucune** de ces 4 variables n'est classee `OPTIONAL_ON_PREVIEW`. Justification : leur absence en preview = panique runtime (justificatif decrypt fail, helper webhook auth fail, cron 401, server action admin 500).

### AC techniques (qualite)

7. **AC7 — Pas de regression typage `as any` ni TypeScript** : Given le script reste un fichier `.mjs` pure JS (pas de TypeScript), when la story est livree, then **aucun nouveau `as any` introduit** ailleurs dans le repo (la story ne touche pas aux fichiers `.ts`/`.tsx`). `npx tsc --noEmit` reste exit 0 sans changement (le script `.mjs` n'est pas inclus dans le typecheck Next.js).

8. **AC8 — Test manuel documente sur 6 contextes** : Given le script doit etre valide sur ses 4 modes principaux (production missing REQUIRED, production missing OPTIONAL_ON_PREVIEW, preview missing REQUIRED, preview missing OPTIONAL_ON_PREVIEW, preview all present, dev local), when la story est livree, then les **6 invocations suivantes** sont **executees localement** et leur sortie + exit code consignes dans la section « Dev Agent Record > Completion Notes List » de cette story :
   - **(a) production avec REQUIRED manquante** : `unset ADMIN_NOTIFICATIONS_EMAIL ; VERCEL_ENV=production node scripts/check-required-env.mjs ; echo "exit=$?"` -> attendu : `ERROR: ADMIN_NOTIFICATIONS_EMAIL is not set in VERCEL_ENV=production. ...` + `exit=1`.
   - **(b) production avec OPTIONAL_ON_PREVIEW manquante** : `unset NEXT_PUBLIC_SENTRY_DSN ; VERCEL_ENV=production node scripts/check-required-env.mjs ; echo "exit=$?"` -> attendu : `ERROR: NEXT_PUBLIC_SENTRY_DSN is not set in VERCEL_ENV=production. ...` + `exit=1` (cette categorie est aussi bloquante en prod).
   - **(c) preview avec REQUIRED manquante** : `unset RESEND_API_KEY ; VERCEL_ENV=preview node scripts/check-required-env.mjs ; echo "exit=$?"` -> attendu : `ERROR (preview): RESEND_API_KEY is not set. ...` + `exit=1` (libelle `ERROR` post-code-review 2026-05-07, coherence severite vs exit code).
   - **(d) preview avec OPTIONAL_ON_PREVIEW manquante** : `env -i VERCEL_ENV=preview ADMIN_NOTIFICATIONS_EMAIL=x RESEND_API_KEY=x NEXT_PUBLIC_BASE_URL=x STRIPE_SECRET_KEY=x STRIPE_WEBHOOK_SECRET=x SUPABASE_SERVICE_ROLE_KEY=x CRON_SECRET=x PARRAINAGE_INTERNAL_SECRET=x ENCRYPTION_KEY=x node scripts/check-required-env.mjs ; echo "exit=$?"` -> attendu : **aucune sortie** + `exit=0` (silence total : 9 REQUIRED presentes, 5 OPTIONAL_ON_PREVIEW absentes, comportement cible).
   - **(e) preview tout present** : `env -i VERCEL_ENV=preview ADMIN_NOTIFICATIONS_EMAIL=x RESEND_API_KEY=x NEXT_PUBLIC_BASE_URL=x STRIPE_SECRET_KEY=x STRIPE_WEBHOOK_SECRET=x SUPABASE_SERVICE_ROLE_KEY=x CRON_SECRET=x PARRAINAGE_INTERNAL_SECRET=x ENCRYPTION_KEY=x NEXT_PUBLIC_SENTRY_DSN=x SENTRY_DSN=x SENTRY_ORG=x SENTRY_PROJECT=x RATE_LIMIT_HASH_SALT=x node scripts/check-required-env.mjs ; echo "exit=$?"` -> attendu : `OK: all required env vars present (VERCEL_ENV=preview).` + `exit=0`.
   - **(f) dev local** : `env -i node scripts/check-required-env.mjs ; echo "exit=$?"` -> attendu : **aucune sortie** + `exit=0` (silence dev local, comportement legacy preserve).

9. **AC9 — Documentation `NEXT_STEPS.md` section env vars mise a jour** : Given `NEXT_STEPS.md` contient une section « Variables d'environnement requises en production » ajoutee story 3.8, when la story est livree, then la section est restructuree avec **deux sous-sections distinctes** :

   ```md
   ## Variables d'environnement requises en production

   Ces variables doivent etre configurees sur Vercel avant le go-live Bretagne. Le script `npm run check:env` (lance au build via `vercel.json`) verifie leur presence.

   **Comportement par environnement** :
   - **Production** (`VERCEL_ENV=production`) : la build casse (exit 1) si une variable REQUIRED ou OPTIONAL_ON_PREVIEW est absente.
   - **Preview** (`VERCEL_ENV=preview`) : la build casse (exit 1) si une variable REQUIRED est absente. Les OPTIONAL_ON_PREVIEW sont tolerees absentes silencieusement.
   - **Dev local** (sans `VERCEL_ENV`) : silencieux.

   ### REQUIRED (obligatoires production ET preview)

   - `ADMIN_NOTIFICATIONS_EMAIL` — destinataire des alertes anti-fraude parrainage.
   - `RESEND_API_KEY` — API Resend pour tous les emails transactionnels.
   - `NEXT_PUBLIC_BASE_URL` — URL canonique de production (https://roxanetnous.fr).
   - `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET` — paywall et webhook subscriptions.
   - `SUPABASE_SERVICE_ROLE_KEY` — server actions admin.
   - `CRON_SECRET` — auth des routes `/api/cron/*`.
   - `PARRAINAGE_INTERNAL_SECRET` — auth du helper de revocation validation filleule (story 2.3).
   - `ENCRYPTION_KEY` — chiffrement justificatifs accompagnantes.

   ### OPTIONAL_ON_PREVIEW (obligatoires production uniquement)

   - `NEXT_PUBLIC_SENTRY_DSN`, `SENTRY_DSN`, `SENTRY_ORG`, `SENTRY_PROJECT` — alerting Sentry transverse (story 4.1). Tolerees absentes en preview pour eviter la creation d'un projet Sentry preview-only.
   - `RATE_LIMIT_HASH_SALT` — sel HMAC pour irreversibilite hash IP rate-limit (story 4.1 patch review). Tolerees absentes en preview (degradation gracieuse SHA-256 non-sale, acceptable pour debug local).
   ```

10. **AC10 — `TODO-LAUNCH.md` ligne `ADMIN_NOTIFICATIONS_EMAIL` mise a jour** : Given `TODO-LAUNCH.md` contient une ligne sur `ADMIN_NOTIFICATIONS_EMAIL` mentionnant le garde-fou non bloquant warn-only (heritage story 3.8), when la story est livree, then la ligne est reformulee :
   ```md
   - [ ] Definir ADMIN_NOTIFICATIONS_EMAIL (destinataire des alertes anti-fraude parrainage) sur Vercel scope production. Garde-fou : `npm run check:env` (lance au build) **bloque la build production** (exit 1) si la variable manque en VERCEL_ENV=production. Si absent en prod, la build est rouge et le merge bloque ; les alertes restent visibles dans `/admin/historique` (action_type=parrainage_admin_alert_lost) une fois la variable configuree.
   ```

11. **AC11 — Pas de regression a11y** : Given la story ne touche que des fichiers .mjs, .md et eventuellement le fichier `.env.local.example` (commentaire), when la modification est livree, then aucun JSX modifie. **`npm run lint:a11y-check`** reste vert (baseline 155 stable). **`npm run a11y:axe:check`** reste vert (0 violations Critical/Serious sur 7 parcours, baseline Lot B/C maintenue). Pre-condition de commit livraison : `npm run a11y:axe:check` execute localement, exit 0 confirme (regle CLAUDE.md).

12. **AC12 — Compilation TypeScript propre** : Given la story ne modifie que des fichiers .mjs et .md, when `npx tsc --noEmit` est execute, then **exit 0** (compilation OK, baseline 0 erreur preservee).

13. **AC13 — Build Next.js ne casse pas en local** : Given le `buildCommand` Vercel est inchange (`npm run check:env && npm run lint:a11y-check && (test \"$SKIP_E2E_TESTS\" = \"true\" || npm run test:integration) && next build`), when `npm run build` est lance localement avec `.env.local` complet (toutes les vars REQUIRED + OPTIONAL_ON_PREVIEW presentes), then :
   - `npm run check:env` exit 0 (toutes vars presentes ou silence dev local sans VERCEL_ENV).
   - `npm run lint:a11y-check` exit 0 (baseline 155 stable).
   - `next build` exit 0 (pas de changement applicatif).
   - Aucune nouvelle erreur dans les logs build par rapport au build pre-story.

14. **AC14 — Validation preview Vercel post-merge** : Given la story modifie le comportement preview du script, when la PR est mergee, then **action manuelle Sylvain** : verifier dans les logs build de la prochaine deploiement preview Vercel que :
   - **Aucun log `WARN`** pour `NEXT_PUBLIC_SENTRY_DSN`, `SENTRY_DSN`, `SENTRY_ORG`, `SENTRY_PROJECT`, `RATE_LIMIT_HASH_SALT` (la regression cible — preview clean).
   - **Si une REQUIRED manque dans le scope preview** (ex : `RESEND_API_KEY` absent par configuration Vercel), la build preview est **rouge** au step `npm run check:env` (signal explicite, fix env vars Vercel preview avant merge en main).
   - Documenter la validation dans `Completion Notes List`.

### AC commun Lot C (rappel CLAUDE.md durcie)

15. **AC commun 1** — DoD a11y **applicable mais legere** : la story modifie principalement un script CLI, de la documentation, et **zero JSX**. Voir AC11. Patterns a11y baseline projet (Lot A/B/C cloture 2026-05-06) deja en place et inchanges.

16. **AC commun 2** — Double commit : livraison (`Story 4.8 : separation REQUIRED vs OPTIONAL_ON_PREVIEW dans check-required-env`) puis cloture (`Story 4.8 : statut done apres CI Vercel verte`). Conventions projet (cf. memoire `project_bmad_conventions`). Possibilite de patches code review post-livraison comme stories 3.5/3.6/3.7/4.1 si findings adversariaux.

## Tasks / Subtasks

- [x] **Task 1 — Refactor `scripts/check-required-env.mjs`** (AC: #1, #2, #3, #4, #5, #6, #7)
  - [x] Sub 1.1 : Lire le fichier actuel `scripts/check-required-env.mjs` integralement (117 lignes) pour identifier les 14 entrees actuelles + 5 flags `productionOnly: true`.
  - [x] Sub 1.2 : Reformuler le commentaire d'en-tete (lignes 1-4) avec la description des deux categories selon AC5.
  - [x] Sub 1.3 : Remplacer la constante `REQUIRED_VARS` par deux constantes : `REQUIRED` (9 entrees `{ name, description }` sans flag) + `OPTIONAL_ON_PREVIEW` (5 entrees `{ name, description }` sans flag), conformement AC1.
  - [x] Sub 1.4 : Refactorer la logique `isMissing` + computation des manquantes. Conserver la fonction helper `isMissing(v)` actuelle (ligne 79-82).
  - [x] Sub 1.5 : Implementer le bloc `vercelEnv === 'production'` avec `console.error` + `process.exit(1)` si `missingRequired.length + missingOptionalOnPreview.length > 0`. Conformement AC2.
  - [x] Sub 1.6 : Implementer le bloc `vercelEnv === 'preview'` avec **deux branches** : si `missingRequired.length > 0` -> warn + exit 1, sinon si seulement `missingOptionalOnPreview.length > 0` -> silence + exit 0, sinon `OK` + exit 0. Conformement AC3.
  - [x] Sub 1.7 : Conserver le bloc dev local final (sans `VERCEL_ENV`) **strictement identique** : `if (missingAll.length === 0) console.log('OK...')` + `process.exit(0)`. Conformement AC4.
  - [x] Sub 1.8 : Verification : `npx tsc --noEmit` reste exit 0 (le script `.mjs` n'est pas dans le tsconfig).

- [x] **Task 2 — Test manuel sur 6 contextes** (AC: #8)
  - [x] Sub 2.1 : Executer (a) production REQUIRED manquante. Capturer sortie + exit code.
  - [x] Sub 2.2 : Executer (b) production avec OPTIONAL_ON_PREVIEW manquante. Capturer.
  - [x] Sub 2.3 : Executer (c) preview avec REQUIRED manquante. Capturer.
  - [x] Sub 2.4 : Executer (d) preview avec OPTIONAL_ON_PREVIEW manquante (9 REQUIRED set). Capturer (silence attendu).
  - [x] Sub 2.5 : Executer (e) preview tout present. Capturer (`OK` attendu).
  - [x] Sub 2.6 : Executer (f) dev local sans `VERCEL_ENV`. Capturer (silence attendu).
  - [x] Sub 2.7 : Consigner les 6 sorties + exit codes dans `Completion Notes List` ci-dessous.

- [x] **Task 3 — Documentation `NEXT_STEPS.md`** (AC: #9)
  - [x] Sub 3.1 : Localiser la section « Variables d'environnement requises en production » dans `NEXT_STEPS.md` (ajoutee story 3.8, fin du fichier).
  - [x] Sub 3.2 : Restructurer en deux sous-sections REQUIRED + OPTIONAL_ON_PREVIEW selon le template AC9.
  - [x] Sub 3.3 : Verifier que le rendu Markdown reste correct (preview VS Code ou GitHub).
  - [x] Sub 3.4 : Aucune autre modification du fichier (autres sections inchangees).

- [x] **Task 4 — Documentation `TODO-LAUNCH.md`** (AC: #10)
  - [x] Sub 4.1 : Localiser la ligne `ADMIN_NOTIFICATIONS_EMAIL` (probablement vers ligne 23, heritage story 3.8).
  - [x] Sub 4.2 : Reformuler la ligne pour mentionner le durcissement exit 1 selon AC10.
  - [x] Sub 4.3 : Aucune autre modification du fichier.

- [x] **Task 5 — Validation locale + a11y** (AC: #11, #12, #13)
  - [x] Sub 5.1 : `npx tsc --noEmit` -> exit 0.
  - [x] Sub 5.2 : `npm run lint:a11y-check` -> exit 0 (baseline 155).
  - [x] Sub 5.3 : **`npm run a11y:axe:check` -> exit 0 confirme** (regle CLAUDE.md durcie obligatoire avant commit livraison).
  - [x] Sub 5.4 : `npm run build` (avec `.env.local` complet) -> exit 0.
  - [x] Sub 5.5 : `git diff --stat` montre **3 fichiers modifies** : `scripts/check-required-env.mjs`, `NEXT_STEPS.md`, `TODO-LAUNCH.md`.

- [x] **Task 6 — Commit livraison + validation preview Vercel** (AC: #14, #16)
  - [x] Sub 6.1 : `git add` les 3 fichiers modifies + commit livraison : `git commit -m "Story 4.8 : separation REQUIRED vs OPTIONAL_ON_PREVIEW dans check-required-env"`.
  - [x] Sub 6.2 : `git push` (commit livraison c505f78 + commit review patch 8d92456) -> trigger build prod Vercel.
  - [x] Sub 6.3 : Build prod initialement ERROR (5 vars Sentry/RATE_LIMIT_HASH_SALT non configurees scope production). Configuration des 6 vars Vercel scope Production effectuee 2026-05-08 (NEXT_PUBLIC_SENTRY_DSN, SENTRY_DSN, SENTRY_ORG=roxanetnous, SENTRY_PROJECT=roxanetnous, RATE_LIMIT_HASH_SALT, SENTRY_AUTH_TOKEN). Redeploy 2026-05-08 verifie via MCP Vercel : dpl_6iReah6atXaaZigGa21W3sS6twSs **READY** (vert). Branche prod du script desormais validee bout-en-bout (exit 0 quand toutes vars set, exit 1 verifie manuellement quand absentes).
  - [x] Sub 6.4 : Documente dans `Completion Notes List` post-Sub6.3 : ERROR initial sur 5 vars OPTIONAL_ON_PREVIEW (regression cible AC2 confirmee), build verte apres config Vercel.
  - [x] Sub 6.5 : Commit cloture `Story 4.8 : statut done apres CI Vercel verte` execute 2026-05-08.

### Review Findings (2026-05-07, code review adversarial 3 layers)

**Verdict global Acceptance Auditor** : 14/14 ACs PASS sur le fond. Aucun blocker. Implementation aligne litteralement sur l'architecture cible spec lignes 263-328.

**Layers** : Blind Hunter (diff seul) + Edge Case Hunter (diff + repo read access) + Acceptance Auditor (diff + spec). Aucun layer en echec.

**Patches proposes (1)** :

- [x] [Review][Patch] Preview REQUIRED missing : libelle `WARN` incoherent avec `process.exit(1)` [scripts/check-required-env.mjs:58] — applique 2026-05-07, `console.warn` -> `console.error`, libelle `WARN (preview):` -> `ERROR (preview):`. AC3 + AC8(c) + Completion Notes (c) synchronises. Re-test (c) confirme ci-dessous. — Le code emet `console.warn(\`WARN (preview): ...\`)` puis `process.exit(1)` (build rouge). Branche prod a ete durcie en `console.error` + `ERROR:` libelle pour signaler la severite ; la branche preview reste sur `WARN:` alors qu'elle casse aussi la build. Trois reviewers (blind+edge) signalent l'incoherence entre niveau de log (warn) et severite reelle (exit 1 = bloquant). Patch trivial : `console.error(\`ERROR (preview): ${v.name} is not set. ${v.description}\`)`. Coherence avec D2 spec « console.error aligne avec la severite » applicable aussi au cas preview-REQUIRED.

**Defers (8 — pre-existants ou hors scope explicite 4.8)** :

- [x] [Review][Defer] `VERCEL_ENV='development'` (vercel dev) tombe dans branche dev local sans branche dediee [scripts/check-required-env.mjs:40-65] — pre-existant story 3.8, conforme D4 spec « dev local inchange ».
- [x] [Review][Defer] `SENTRY_AUTH_TOKEN` documente dans `.env.local.example` mais absent du check (sourcemaps non uploadees silencieuses) [scripts/check-required-env.mjs vs .env.local.example:41-45] — adresse explicitement par la note ajoutee `NEXT_STEPS.md:298` « non verifiee par check:env ». Choix conscient documente. Audit dependance vars d'env = story Epic 5+.
- [x] [Review][Defer] `NEXT_PUBLIC_SUPABASE_URL` + `NEXT_PUBLIC_SUPABASE_ANON_KEY` utilises avec assertion `!` dans `lib/supabase/{client,server,middleware}.ts` mais absents du check [scripts/check-required-env.mjs] — pre-existant 3.8, hors scope explicite (« liste figee a 14 vars » D7).
- [x] [Review][Defer] `isMissing` accepte placeholders litteraux (`your_random_secret`, `your_supabase_anon_key`) [scripts/check-required-env.mjs:36] — hors scope explicite story 4.8 ligne 38 « Validation de format des valeurs : trop de surface, hors scope ».
- [x] [Review][Defer] `vercel.json` masque exit code des E2E tests via `(test "$SKIP_E2E_TESTS" = "true" || npm run test:integration)` [vercel.json] — orthogonal 4.8 (heritage story 4.4 stabilisation 7j flag). Si `SKIP_E2E_TESTS=true` leak en prod env, prod deploys silencieux sans tests. A traiter independamment.
- [x] [Review][Defer] CI GHA `integration-tests.yml` ne lance pas `check:env` (premier signal vars manquantes = build Vercel preview, pas PR check) [.github/workflows/integration-tests.yml] — informational, pre-existant. Acceptable design car redondant avec Vercel build.
- [x] [Review][Defer] Description `RATE_LIMIT_HASH_SALT` perd la mention « fallback SHA-256 non-sale » dans le code [scripts/check-required-env.mjs:30 vs ancien commentaire 4.1] — contexte deplace dans `NEXT_STEPS.md` section OPTIONAL_ON_PREVIEW (« degradation gracieuse SHA-256 non-sale, acceptable pour debug local »). Pas de regression, juste relocalisation.
- [x] [Review][Defer] Emoji `🔐` heritage story 3.8 dans heading `NEXT_STEPS.md:273` [NEXT_STEPS.md:273] — pre-existant a 4.8 (introduit 3.8). Regle CLAUDE.md « Pas d'emojis dans le code ni les interfaces » — applicable docs ? Cleanup follow-up.
- [x] [Review][Defer] Risque rollout : si scope preview Vercel n'a pas les 9 REQUIRED set, mass-red builds preview au merge (regression cible AC3 mais a anticiper) — operationnel, pas un bug code. AC14 documente deja la validation post-merge. Validation `vercel env ls --environment preview` ou dashboard Vercel recommandee avant merge si doute.

**Dismissed (3 — comportement cible confirme par spec)** :

- Preview OPTIONAL missing : silence total au lieu de log positif → conforme verbatim AC3 « **silence total**, aucun log emis » (regression cible voulue contre spam WARN Sentry quotidien).
- Pas de garde anti-doublon entre REQUIRED et OPTIONAL_ON_PREVIEW → nit, surcharge prematuree pour 14 vars stables.
- Dev local exit 0 inconditionnel meme si REQUIRED missing → conforme AC4 + D4 spec (« dev local n'a pas vocation a echouer pour vars absentes »).

## Dev Notes

### Decisions de cette story

**D1 — Renommer `productionOnly: true` -> `OPTIONAL_ON_PREVIEW` (categorie de liste)** :
- Le flag `productionOnly: true` introduit story 4.1 patch review etait correct semantiquement mais melangeait deux concepts dans une meme constante.
- Deux listes distinctes (`REQUIRED` + `OPTIONAL_ON_PREVIEW`) sont plus lisibles : un dev qui ouvre le fichier voit immediatement la classification sans devoir scanner les flags.
- Le titre de l'epic 4.8 (`Separation REQUIRED vs OPTIONAL_ON_PREVIEW`) impose semantiquement cette structure (vs `productionOnly` ad hoc).
- **Decision finale** : deux constantes distinctes. Le flag legacy `productionOnly` disparait du code livre.

**D2 — Production : `console.error` (pas warn) + exit 1** :
- La retro Epic 3 (ligne 130) explicite le besoin : « non-bloquant Epic 3, **a durcir Epic 4** ».
- `console.error` aligne avec la severite : une variable critique manquante en prod = vrai probleme (alerte oncall, pas signal informatif).
- `exit 1` casse la build Vercel = signal go/no-go binaire pour le merge sur main. Pas d'ambiguite.
- **Decision finale** : `console.error` + `exit 1` en production. Message libelle `ERROR:` (pas `WARN:`) pour discrimination dans les logs Vercel.

**D3 — Preview avec REQUIRED manquante : warn + exit 1 (preview rouge)** :
- Tentation : preview = warn-only (legacy story 3.8) pour ne pas bloquer la velocite preview.
- Rejete : si une REQUIRED manque en preview (ex : `RESEND_API_KEY`), le code applicatif crashera au runtime des qu'un test preview manuel touchera un envoi email. Mieux vaut bloquer au build qu'au runtime.
- Le seul cas legitime « variable absente en preview » concerne les OPTIONAL_ON_PREVIEW (Sentry preview-only pas configure).
- **Decision finale** : preview REQUIRED missing -> exit 1 (rouge). Preview OPTIONAL_ON_PREVIEW missing -> silence exit 0.

**D4 — Conserver le bloc dev local silencieux/exit 0 inchange** :
- Le dev local (sans `VERCEL_ENV`) lance souvent `npm run check:env` indirectement via un autre script.
- Faire echouer le check sur un dev local sans `.env.local` complet casserait des workflows non-Vercel (CI GHA story 4.4 par exemple, qui set certaines vars manuellement).
- **Decision finale** : dev local reste 100% legacy (silencieux ou OK + exit 0). Aucune regression.

**D5 — Pas de mode `STRICT` opt-in** :
- Tentation : ajouter une variable `STRICT_ENV_CHECK=true` permettant de forcer exit 1 en preview pour les OPTIONAL_ON_PREVIEW (utile pour un staging-prod-like).
- Rejete : surface API qui ne sert aucun cas concret aujourd'hui. Ajout speculatif.
- Si Epic 5+ introduit un environnement « staging-prod-like », ajouter `VERCEL_ENV=staging` traite comme production sera un changement minime (3 lignes).
- **Decision finale** : pas de flag opt-in. KISS.

**D6 — Pas de Sentry capture de l'erreur build** :
- Tentation : `Sentry.captureMessage('check-required-env failed in production')` avant exit 1.
- Rejete : (a) le script `.mjs` n'a pas Sentry initialise (pure Node, hors instrumentation Next.js), (b) le build Vercel rouge declenche deja les notifications Vercel natives (email + Slack si configure), (c) ajout de dependance Sentry CLI/SDK dans un script build-time = surface inutile.
- **Decision finale** : zero Sentry dans le script. Build rouge suffit.

**D7 — Liste figee a 14 vars (pas d'audit dependances)** :
- Tentation : lancer un grep `process.env\.` exhaustif sur le repo pour decouvrir des vars manquantes du check.
- Rejete : hors scope explicite (cf. ligne 73 « Hors scope explicite » 1).
- Audit dependances vars d'env = story Epic 5+ dediee si besoin avere.
- **Decision finale** : strictement 9 + 5 = 14 vars, identique a l'apres-4.1.

### Architecture du script refactore

Forme cible (~70 lignes apres refactor, vs 117 actuellement — la disparition du flag `productionOnly` simplifie la branche preview) :

```js
#!/usr/bin/env node
// Verifie la presence des variables d'env critiques selon l'environnement Vercel.
// (... cf. AC5 pour le commentaire complet)

const REQUIRED = [
  { name: 'ADMIN_NOTIFICATIONS_EMAIL', description: 'Destinataire alertes anti-fraude parrainage.' },
  { name: 'RESEND_API_KEY',            description: 'API Resend pour emails transactionnels.' },
  { name: 'NEXT_PUBLIC_BASE_URL',      description: 'URL canonique production (liens emails).' },
  { name: 'STRIPE_SECRET_KEY',         description: 'Stripe paywall.' },
  { name: 'STRIPE_WEBHOOK_SECRET',     description: 'Stripe webhook signature.' },
  { name: 'SUPABASE_SERVICE_ROLE_KEY', description: 'Server actions admin.' },
  { name: 'CRON_SECRET',               description: 'Auth /api/cron/*.' },
  { name: 'PARRAINAGE_INTERNAL_SECRET',description: 'Auth helper revoke filleule (story 2.3).' },
  { name: 'ENCRYPTION_KEY',            description: 'Chiffrement justificatifs accompagnantes.' },
]

const OPTIONAL_ON_PREVIEW = [
  { name: 'NEXT_PUBLIC_SENTRY_DSN',    description: 'DSN Sentry expose au client (capture exceptions browser).' },
  { name: 'SENTRY_DSN',                description: 'DSN Sentry server-side (peut etre identique au public).' },
  { name: 'SENTRY_ORG',                description: 'Slug organisation Sentry (upload sourcemaps build-time).' },
  { name: 'SENTRY_PROJECT',            description: 'Slug projet Sentry (upload sourcemaps build-time).' },
  { name: 'RATE_LIMIT_HASH_SALT',      description: 'Sel HMAC hash rate-limit Sentry (irreversibilite IP).' },
]

const vercelEnv = process.env.VERCEL_ENV
const isMissing = (v) => {
  const raw = process.env[v.name]
  return !raw || String(raw).trim() === ''
}

const missingRequired           = REQUIRED.filter(isMissing)
const missingOptionalOnPreview  = OPTIONAL_ON_PREVIEW.filter(isMissing)

if (vercelEnv === 'production') {
  const allMissing = [...missingRequired, ...missingOptionalOnPreview]
  if (allMissing.length > 0) {
    for (const v of allMissing) {
      console.error(`ERROR: ${v.name} is not set in VERCEL_ENV=production. ${v.description}`)
    }
    process.exit(1)
  }
  console.log('OK: all required env vars present (VERCEL_ENV=production).')
  process.exit(0)
}

if (vercelEnv === 'preview') {
  if (missingRequired.length > 0) {
    for (const v of missingRequired) {
      console.warn(`WARN (preview): ${v.name} is not set. ${v.description}`)
    }
    process.exit(1)
  }
  // missingOptionalOnPreview tolerees silencieusement.
  if (missingOptionalOnPreview.length === 0) {
    console.log('OK: all required env vars present (VERCEL_ENV=preview).')
  }
  process.exit(0)
}

// Dev local : silencieux sauf si tout est present.
if (missingRequired.length === 0 && missingOptionalOnPreview.length === 0) {
  console.log('OK: all required env vars present.')
}
process.exit(0)
```

### Source tree components a toucher

- **Modifies** :
  - `scripts/check-required-env.mjs` (refactor majeur, ~70 lignes apres vs 117 avant)
  - `NEXT_STEPS.md` (restructuration section env vars en deux sous-sections)
  - `TODO-LAUNCH.md` (1 ligne reformulee, mention exit 1 prod)
- **Inchanges (vigilance)** :
  - `package.json` (script `check:env` deja en place story 3.8, ligne 13)
  - `vercel.json` (`buildCommand` deja chaine `npm run check:env && ...`, ligne 2 — c'est *exactement* ce qu'on veut, le exit 1 du script casse maintenant la chaine `&&`)
  - `.env.local.example` (les 14 vars sont deja documentees, pas de raison d'y toucher sauf si le commentaire de tete de section a modifier)
  - `lib/emails.ts`, `app/admin/historique/page.tsx`, tous les call-sites Sentry/Resend/Stripe : zero changement applicatif
  - `instrumentation.ts`, `instrumentation-client.ts`, `sentry.server.config.ts`, `sentry.edge.config.ts` : la configuration Sentry `enabled: !!DSN` (decision D5 story 4.1) reste pertinente meme avec exit 1 prod, car le check intervient AVANT le build et donc avant l'init Sentry runtime.

### Testing standards summary

- **Test manuel** uniquement (cf. AC8). Aucun test Vitest ou Playwright dedie.
- **Coverage attendu** : 6 invocations sur 6 modes (production REQUIRED missing, production OPTIONAL_ON_PREVIEW missing, preview REQUIRED missing, preview OPTIONAL_ON_PREVIEW missing, preview all present, dev local).
- **Validation CI** : la build preview Vercel post-merge doit etre verte sans WARN Sentry (AC14). C'est le test d'integration final.

### Project Structure Notes

**Alignement avec la structure projet** :
- Pattern script `.mjs` pure JS coherent avec `scripts/check-a11y-baseline.mjs` (cf. story 3.8 reference).
- `import { ... }` interdit hors `node:*` (cf. story 3.8 AC3 ligne 66) — mais ce script n'a aucune dependance externe, juste `process.env`.
- Convention naming : `check-<feature>.mjs` (cf. `check-required-env.mjs`, `check-a11y-baseline.mjs`).

**Pas de conflit detecte** : la story est strictement additive (zero suppression de comportement, durcissement uniquement).

### Previous story intelligence

**Story 3.8 (livree 2026-05-07)** :
- Convention double commit (livraison + cloture apres CI verte) tenue 8 stories Epic 3 + 5 stories Epic 4. Repeter pour 4.8.
- Pattern test manuel documente dans `Completion Notes List` (3 invocations 3.8 -> 6 invocations 4.8). Format consigne sortie + exit code.
- Pattern CLAUDE.md durcie : `npm run a11y:axe:check` execute localement avant commit livraison. Exit 0 confirme (regle obligatoire). Cette story n'a aucun impact UI mais la regle reste applicable (precaution baseline).

**Story 4.1 (livree 2026-05-07, patch review 2026-05-07)** :
- Le flag `productionOnly: true` a ete introduit en patch review (pas dans les AC initiaux). Cette story 4.8 le formalise en categorie de liste — c'est la « phase 2 » de la decision review.
- Tag commentaire `// Story 4.1 review D3` ligne 67-74 du script actuel : a supprimer dans le refactor (la classification est desormais structurelle, pas commentaire).

**Story 4.7 (livree 2026-05-09)** :
- Pattern de test manuel + doc dans story Markdown reaffirme (cf. AC1-AC8 story 4.7).
- Convention naming `seed-test-supabase.mjs` -> coherente avec `check-required-env.mjs`.

### Latest tech information

- **Node.js** : pas de version specifique requise. Le script utilise uniquement `process.env`, `process.exit`, `console.warn/error/log` (API standard Node 18+). Compatible Node 24 LTS (default Vercel 2026).
- **Vercel CLI** : non utilise dans le script lui-meme. Mais pour valider AC8(b)(d)(e) et AC14, l'usage de `vercel env ls --environment preview` peut etre utile (verification scope preview avant push). Vercel CLI **non installe** sur la machine dev (cf. session start hook). Recommandation : `npm i -g vercel` si validation poussee souhaitee, mais non bloquant (Sylvain peut verifier les logs preview dans le dashboard Vercel directement post-merge).

### References

- [Source: scripts/check-required-env.mjs:1-117] — script actuel, 14 entrees REQUIRED_VARS dont 5 avec flag `productionOnly: true`.
- [Source: vercel.json:2] — `buildCommand` actuel chaine `npm run check:env && ...` — la chaine `&&` propage l'exit 1 = build rouge.
- [Source: package.json:13] — script `check:env` lance `node scripts/check-required-env.mjs`.
- [Source: _bmad-output/planning-artifacts/epic-4.md#Story-4.8] — cadrage AI-3.8 origine retro Epic 3.
- [Source: _bmad-output/implementation-artifacts/3-8-notifications-admin-parrainage-robustes.md#AC3-AC4] — origine du script story 3.8, decision D2 « warn-only, a durcir Epic 4 ».
- [Source: _bmad-output/implementation-artifacts/4-1-alerting-sentry-rate-limit-validate-code.md#patch-review-2026-05-07] — introduction du flag `productionOnly: true` en patch review.
- [Source: _bmad-output/implementation-artifacts/epic-3-retro-2026-05-07.md#L130, #L159] — retro Epic 3, AI-3.8 origine, garde-fou « a durcir Epic 4 ».
- [Source: NEXT_STEPS.md, section variables env] — section actuelle a restructurer.
- [Source: TODO-LAUNCH.md, ligne ADMIN_NOTIFICATIONS_EMAIL] — ligne actuelle a reformuler.
- [Source: .claude/CLAUDE.md] — regle a11y obligatoire avant commit livraison story (`npm run a11y:axe:check` exit 0).
- [Source: _bmad-output/planning-artifacts/architecture-technique-roxanetnous-2026-02-09.md] — pas de section dediee au scripts/, le pattern .mjs est convention de fait sur le projet.

## Dev Agent Record

### Agent Model Used

claude-opus-4-7[1m]

### Debug Log References

- 2026-05-07 : refactor `scripts/check-required-env.mjs` en place. 117 lignes -> 73 lignes (suppression flag `productionOnly` ad hoc + remplacement par 2 constantes structurelles).
- 2026-05-07 : 6 invocations AC8 executees localement avec `env -i PATH="/opt/homebrew/bin:/usr/bin:/bin"` pour isoler des `.env.local`/`process.env` parasites. Toutes conformes aux attendus AC.
- 2026-05-07 : `npx tsc --noEmit` exit 0 ; `npm run lint:a11y-check` exit 0 (baseline 155 stable, zero JSX modifie) ; `npm run a11y:axe:check` exit 0 (0 violations Critical/Serious sur 7 parcours, baseline Lot B/C maintenue) ; `npm run build` exit 0.

### Completion Notes List

**Tests manuels AC8 (6 contextes)** — executes le 2026-05-07, machine Sylvain, repo `/Users/sylvain/Documents/roxanetnous`, isolation `env -i PATH=...` :

- **(a) production avec REQUIRED manquante** (`ADMIN_NOTIFICATIONS_EMAIL=''`) :
  ```
  ERROR: ADMIN_NOTIFICATIONS_EMAIL is not set in VERCEL_ENV=production. Destinataire alertes anti-fraude parrainage.
  exit=1
  ```
- **(b) production avec OPTIONAL_ON_PREVIEW manquante** (`NEXT_PUBLIC_SENTRY_DSN` absent, 13 autres present) :
  ```
  ERROR: NEXT_PUBLIC_SENTRY_DSN is not set in VERCEL_ENV=production. DSN Sentry expose au client (capture exceptions browser).
  exit=1
  ```
- **(c) preview avec REQUIRED manquante** (`RESEND_API_KEY` absent) — re-execute apres patch code review 2026-05-07 :
  ```
  ERROR (preview): RESEND_API_KEY is not set. API Resend pour emails transactionnels.
  exit=1
  ```
- **(d) preview avec OPTIONAL_ON_PREVIEW manquantes** (9 REQUIRED set, 5 OPTIONAL_ON_PREVIEW absents) :
  ```
  exit=0
  ```
  (silence total, regression cible — plus de spam WARN Sentry/RATE_LIMIT_HASH_SALT en preview)
- **(e) preview tout present** (14 vars set) :
  ```
  OK: all required env vars present (VERCEL_ENV=preview).
  exit=0
  ```
- **(f) dev local sans VERCEL_ENV** :
  ```
  exit=0
  ```
  (silence total, comportement legacy preserve)

**Validation chain locale** :
- `npx tsc --noEmit` -> exit 0 (baseline 0 erreur preservee).
- `npm run lint:a11y-check` -> exit 0 (`OK: 155 jsx-a11y violations across 56 (file, rule) pair(s). Baseline total: 155. No regression.`).
- `npm run a11y:axe:check` -> exit 0 (`OK: aucun delta Critical/Serious au-dela du baseline.` sur 7 parcours).
- `npm run build` -> exit 0 (next build complet, aucune nouvelle erreur).
- `git diff --stat` confirme 3 fichiers modifies (`scripts/check-required-env.mjs` 127 lignes diff, `NEXT_STEPS.md` 28 lignes diff, `TODO-LAUNCH.md` 2 lignes diff).

**AC14 — Validation prod Vercel (consignee 2026-05-08)** :

Le projet roxanetnous utilise des deploiements `target: production` directs sur main (pas de preview Vercel separee). La validation AC14 a donc ete faite sur la build production.

**Phase 1 — Build prod ERROR initiale** (regression cible AC2 confirmee) :
- Deploiement `dpl_Cr6ELWdt8WU76cZY1VfYPawKQBRR` (commit `8d92456`, 2026-05-07) : state ERROR.
- Logs build (extraits via MCP Vercel) :
  ```
  > node scripts/check-required-env.mjs
  ERROR: NEXT_PUBLIC_SENTRY_DSN is not set in VERCEL_ENV=production. DSN Sentry expose au client (capture exceptions browser).
  ERROR: SENTRY_DSN is not set in VERCEL_ENV=production. DSN Sentry server-side (peut etre identique au public).
  ERROR: SENTRY_ORG is not set in VERCEL_ENV=production. Slug organisation Sentry (upload sourcemaps build-time).
  ERROR: SENTRY_PROJECT is not set in VERCEL_ENV=production. Slug projet Sentry (upload sourcemaps build-time).
  ERROR: RATE_LIMIT_HASH_SALT is not set in VERCEL_ENV=production. Sel HMAC hash rate-limit Sentry (irreversibilite IP).
  Error: Command "npm run check:env && ..." exited with 1
  ```
- **Comportement strictement conforme AC2** : `console.error` + libelle `ERROR:` + `process.exit(1)` casse la build. Le durcissement story 4.8 fonctionne.

**Phase 2 — Configuration vars Vercel scope Production (2026-05-08)** :
- Creation projet Sentry `roxanetnous` org slug `roxanetnous` (Data Storage Region : European Union).
- 6 variables ajoutees scope Production :
  - `NEXT_PUBLIC_SENTRY_DSN` = `https://c147bf2b...@o4511353445154816.ingest.de.sentry.io/4511354180010064`
  - `SENTRY_DSN` = idem
  - `SENTRY_ORG` = `roxanetnous`
  - `SENTRY_PROJECT` = `roxanetnous`
  - `RATE_LIMIT_HASH_SALT` = `90e8bd0fa5ce652c91885b74636c0db470d97c89907c55327db3d440d10e45d9` (genere `openssl rand -hex 32`)
  - `SENTRY_AUTH_TOKEN` = Organization Token Sentry scope `org:ci` (Source Map Upload, Release Creation, Code Mappings) — nom `vercel-roxanetnous-prod`

**Phase 3 — Redeploy READY** :
- Deploiement `dpl_6iReah6atXaaZigGa21W3sS6twSs` (action: redeploy, originalDeploymentId: `dpl_Cr6ELWdt8WU76cZY1VfYPawKQBRR`, commit `8d92456`, 2026-05-08) : state **READY**.
- URL prod active : `https://roxanetnous-b12dh1n8d-roxanetnous.vercel.app`.
- Build prod verte avec les 9 REQUIRED + 5 OPTIONAL_ON_PREVIEW configurees. Comportement story 4.8 valide bout-en-bout en prod reelle.

**Conclusion AC14** : la regression cible (durcissement exit 1 prod sur OPTIONAL_ON_PREVIEW manquantes) a casse la build comme prevu, declenchant la configuration manquante des 6 vars Sentry/RATE_LIMIT_HASH_SALT scope prod (action restee en suspens depuis story 4.1). Story 4.8 a donc rempli son role de garde-fou go-live.

### File List

- `scripts/check-required-env.mjs` — refactor majeur : separation REQUIRED + OPTIONAL_ON_PREVIEW, durcissement exit 1 production, comportement preview differencie, dev local inchange.
- `NEXT_STEPS.md` — restructuration section variables d'environnement en deux sous-sections REQUIRED / OPTIONAL_ON_PREVIEW + bloc comportement par environnement + note `SENTRY_AUTH_TOKEN` (build-time non couvert par check:env).
- `TODO-LAUNCH.md` — ligne `ADMIN_NOTIFICATIONS_EMAIL` reformulee (warn-only -> exit 1 bloquant).

## Change Log

- 2026-05-07 : Story 4.8 livree (commit livraison). Refactor `scripts/check-required-env.mjs` (separation REQUIRED + OPTIONAL_ON_PREVIEW, exit 1 prod, preview differencie). Documentation `NEXT_STEPS.md` + `TODO-LAUNCH.md` mises a jour. Tests manuels 6 contextes AC8 verts. tsc/lint a11y/axe/build locaux verts. Statut story -> `review` ; sprint-status `4-8-separation-required-optional-on-preview-envs` -> `review`.
- 2026-05-07 : Code review adversarial 3 layers (Blind Hunter + Edge Case Hunter + Acceptance Auditor). Verdict global : 14/14 ACs PASS sur le fond. 1 patch applique (`scripts/check-required-env.mjs:58` `console.warn` -> `console.error`, libelle `WARN (preview):` -> `ERROR (preview):` pour coherence severite vs exit 1). 8 defers logues dans `deferred-work.md`. 3 dismissed (comportement cible spec). AC3 + AC8(c) + Completion Notes (c) synchronises avec le nouveau libelle. Re-test contexte (c) confirme : sortie `ERROR (preview): RESEND_API_KEY ...` + exit=1.
- 2026-05-07 : Patch code review committe (`8d92456` + push origin/main).
- 2026-05-08 : Build prod initialement ERROR (commit `8d92456`, dpl_Cr6ELWdt8WU76cZY1VfYPawKQBRR) sur 5 vars Sentry/RATE_LIMIT_HASH_SALT non configurees scope production Vercel. Regression cible AC2 confirmee : durcissement exit 1 prod fonctionne, casse la build comme prevu. Action manuelle Sylvain : creation projet Sentry `roxanetnous` (EU region, slug roxanetnous) + configuration 6 vars Vercel scope Production (NEXT_PUBLIC_SENTRY_DSN, SENTRY_DSN, SENTRY_ORG, SENTRY_PROJECT, RATE_LIMIT_HASH_SALT, SENTRY_AUTH_TOKEN org:ci scope). Redeploy `dpl_6iReah6atXaaZigGa21W3sS6twSs` state **READY** verifie via MCP Vercel. Statut story -> `done` ; sprint-status `4-8-separation-required-optional-on-preview-envs` -> `done`. Action complementaire restante : creer une action manuelle TODO-LAUNCH.md ou story dediee pour valider que les vars Sentry sont aussi necessaires scope **Preview** (les preview deployments declencheraient ERROR si on en faisait un) — ou passer en `OPTIONAL_ON_PREVIEW` reste correct, decision a prendre Epic 5+.

## DoD a11y

A renseigner pour toute story avec impact UI (ignorer si pas de changement visuel/interactif). **Cette story n'a aucun impact UI** (script CLI + docs Markdown), mais la regle CLAUDE.md durcie impose `npm run a11y:axe:check` exit 0 avant commit livraison :

- [N/A] Labels associes aux champs (`htmlFor` ou `aria-labelledby`) — pas de JSX modifie
- [N/A] Erreurs liees aux champs via `aria-describedby` + `aria-invalid` — pas de JSX modifie
- [N/A] Focus visible sur tous les elements interactifs (contraste >= 3:1) — pas d'element interactif modifie
- [N/A] Contrastes texte >= 4,5:1 et UI >= 3:1 — pas de couleur modifiee
- [N/A] ARIA states corrects sur composants dynamiques (`aria-expanded`, `aria-selected`, etc.) — pas de composant dynamique modifie
- [N/A] Navigation clavier complete (Tab, Enter, Escape, fleches selon pattern) — pas de pattern clavier modifie
- [N/A] Verification ponctuelle au lecteur d'ecran (VoiceOver ou NVDA) sur le composant touche — aucun composant touche
- [x] Pas de regression `eslint-plugin-jsx-a11y` (`npm run lint:a11y-check` vert en CI) — baseline 155 stable confirme localement 2026-05-07
- [x] Pas de regression axe-core (`npm run a11y:axe:check` vert) — baseline 0 violations Critical/Serious sur 7 parcours stable confirme localement 2026-05-07

**Pre-condition de commit livraison** : `npm run a11y:axe:check` execute localement, exit 0 confirme (regle CLAUDE.md durcie obligatoire).

## Questions pour l'utilisateur (a traiter post-livraison ou avant Task 1)

1. **Confirmation que la build preview Vercel actuelle a effectivement les 9 REQUIRED set** : si `RESEND_API_KEY` ou autre REQUIRED n'est pas dans le scope `preview` Vercel, le merge de cette PR cassera la build preview du jour (regression cible AC3, mais a anticiper). Question : `vercel env ls --environment preview` confirme-t-il les 9 REQUIRED presentes ? (Note : Vercel CLI non installe — verification via dashboard Vercel `roxanetnous > Settings > Environment Variables > Filter: Preview`.)

2. **Confirmation que `RATE_LIMIT_HASH_SALT` reste OPTIONAL_ON_PREVIEW** : la decision D5 story 4.1 (degradation gracieuse SHA-256 non-sale en preview) est-elle toujours acceptable ? Si la sterilisation IP en preview est devenue critique pour un cas d'usage specifique, basculer en REQUIRED. Decision par defaut : conserver OPTIONAL_ON_PREVIEW.

3. **Souhait d'ajouter d'autres categories (`DEV_ONLY`, `OPTIONAL_ALWAYS`)** : la story est ecrite avec **2 categories uniquement** (REQUIRED + OPTIONAL_ON_PREVIEW). Si une 3eme categorie est souhaitee (ex : variable `DEBUG_LOG_LEVEL` jamais bloquante), elle sera scope-creep — recommandation : story Epic 5+ dediee.
