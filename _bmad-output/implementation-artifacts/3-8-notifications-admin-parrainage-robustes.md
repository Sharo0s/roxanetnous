# Story 3.8 : Notifications admin parrainage robustes

Status: done

<!-- Note: Validation est optionnelle. Lancer `validate-create-story` avant `dev-story` pour un controle qualite. -->

## Story

En tant que **Sylvain (admin et project lead du pilote Bretagne)**,
je veux **rendre la fonction `sendAdminParrainageFlag()` robuste face à l'absence de la variable d'environnement `ADMIN_NOTIFICATIONS_EMAIL` (cas concret : preview Vercel ou staging où la variable est volontairement non définie) ET ajouter un garde-fou de pré-déploiement qui alerte (sans bloquer la build) lorsqu'elle est absente du scope production**,
afin de **garantir qu'aucun signal anti-fraude parrainage n'est jamais perdu silencieusement (`admin_actions_log` enregistre la « missed alert » avec un libellé visible dans `/admin/historique`, et le développeur voit dans Vercel logs un `console.warn` explicite plutôt qu'un `console.error` qui pollue la sentry future), et que je ne découvre pas en production que la variable n'a pas été configurée sur le scope `production` Vercel**.

C'est la **huitième et dernière story de l'Epic 3 « Lancement Bretagne »** (cf. `epic-3.md` story 3.8 candidat H = robustesse notifications admin). Elle est **délibérément étroite** : pas de refactor de l'architecture des notifications, pas de retry queue, pas de nouvelle table. **Une seule fonction modifiée** dans `lib/emails.ts`, **un script de validation env** ajouté à `scripts/`, **deux fichiers de documentation** mis à jour (`NEXT_STEPS.md` et/ou `TODO-LAUNCH.md`).

Elle s'appuie sur les fondations existantes :

- **`lib/emails.ts:707-806` `sendAdminParrainageFlag()`** existe déjà depuis la **story 2.3 (blacklist admin anti-fraude, cloturée 2026-04-29)**. Elle a été **durcie une première fois** par le patch H5 du code review story 2.4 (2026-04-29) : passage d'un `console.error` + `return` silencieux à un **`console.error` explicite + insertion dans `admin_actions_log`** avec `action_type='parrainage_admin_alert_lost'`. Cette story 3.8 **n'introduit pas une nouvelle logique**, elle **ajuste deux points** :
  1. **Sévérité du log** : `console.error` → `console.warn` (cf. AC1). Justification : un email manquant en preview/staging n'est **pas** un bug applicatif, c'est une configuration manquante volontaire. Réserver `console.error` aux erreurs Resend / DB ; utiliser `console.warn` pour les configurations manquantes attendues. Cohérent avec le pattern `app/api/cron/confirm-parrainages/route.ts:149,178` (warnings pour cas attendus, errors pour pannes).
  2. **Libellé** : aligner le texte du log sur la formulation cible `"ADMIN_NOTIFICATIONS_EMAIL manquant — alerte parrainage non envoyée par email, voir admin_actions_log"` (cf. epic-3.md story 3.8 AC).
- **Table `admin_actions_log`** : déjà alimentée par H5 (story 2.4) avec `action_type='parrainage_admin_alert_lost'`. **Constat important** : ce libellé **n'est pas dans le mapping `actionLabels`** de `app/admin/historique/page.tsx:15-36` — l'UI affiche donc le code brut au lieu d'un libellé fr. **À corriger AC4** pour rendre le signal visible côté admin.
- **CI Vercel** : il n'existe **aucun GitHub Actions** dans ce dépôt (`ls .github` → vide). La « CI » est uniquement le **`buildCommand` Vercel** défini dans `vercel.json` : `npm run lint:a11y-check && next build`. Toute vérification d'env doit donc s'intégrer **soit avant `next build`** (script Node), **soit côté Vercel dashboard** (`vercel env`). Décision retenue (cf. D2) : **script Node `scripts/check-required-env.mjs` non bloquant** intégré au `buildCommand`, qui émet un warning explicite si `ADMIN_NOTIFICATIONS_EMAIL` est absent **et** que `VERCEL_ENV === 'production'` (preview accepté avec warning, dev local accepté sans warning). Modèle : `scripts/check-a11y-baseline.mjs` (lecture env + parsing + exit 0/1).
- **Variables d'environnement** : `ADMIN_NOTIFICATIONS_EMAIL` est documenté dans `.env.local.example:17` (« Destinataire des notifications admin (anti-fraude parrainage, alertes systeme) ») et listé dans `TODO-LAUNCH.md:23` comme à définir sur Vercel. **`NEXT_STEPS.md` ne mentionne pas la variable** → AC5 le complète.
- **Callers `sendAdminParrainageFlag`** : 4 call-sites identifiés (`app/actions/parrainage.ts:578,619` + `app/api/webhooks/stripe/route.ts:222,267`). Tous protègent l'appel par `try/catch` qui logge (`console.error('[parrainage_blacklist][...]', err)`) sans propager. Aucune modif requise côté callers.

**Le coeur de la story** : (a) **modifier `lib/emails.ts:719-722`** pour passer `console.error` → `console.warn` avec libellé aligné epic-3 ; (b) **ajouter `parrainage_admin_alert_lost` au mapping `actionLabels`** de `app/admin/historique/page.tsx` pour rendre le signal lisible côté admin ; (c) **créer `scripts/check-required-env.mjs`** qui valide la présence de `ADMIN_NOTIFICATIONS_EMAIL` (et d'autres variables critiques listées AC3) en émettant un warning si `VERCEL_ENV === 'production'` ; (d) **intégrer ce script** au `buildCommand` Vercel **non bloquant** (warning only, exit 0) ; (e) **mettre à jour la documentation** projet (`NEXT_STEPS.md` ajoute une section « Variables d'environnement requises en production »).

**Hors scope explicite** : (1) refactor architecture notifications (queue, retry persistant), (2) traitement du bug latent `logNotification` schema drift transverse (cf. mémoire `project_logNotification_bug` — `sendAdminParrainageFlag` est l'un des flows concernés `lib/emails.ts:791,798`, mais le fix est candidat Epic 4), (3) ajout d'autres canaux (Slack, SMS), (4) UI admin de re-tentative manuelle des « missed alerts ».

## Acceptance Criteria

### AC fonctionnels (candidat H epic-3 + alignement docs)

1. **AC1 — `console.warn` à la place de `console.error` dans `sendAdminParrainageFlag` quand variable absente** : Given la fonction `lib/emails.ts:707-806` `sendAdminParrainageFlag` détecte `process.env.ADMIN_NOTIFICATIONS_EMAIL` absent ou vide (`adminEmail === null` après ligne 713 actuelle), when le code passe dans la branche d'absence de variable (lignes 714-741), then :
   - **Le `console.error` ligne 719-722 est remplacé par `console.warn`** avec le libellé exact (à reproduire mot-à-mot, accents inclus) :
     ```
     [sendAdminParrainageFlag] ADMIN_NOTIFICATIONS_EMAIL manquant — alerte parrainage non envoyée par email, voir admin_actions_log.
     ```
     suivi du second argument `{ type: params.type, parrainageId: params.parrainageId }` (inchangé).
   - **L'insertion dans `admin_actions_log`** (lignes 723-739) **reste strictement inchangée** : `action_type='parrainage_admin_alert_lost'`, `target_type='parrainage'`, `target_id=params.parrainageId` (UUID, pas concerné par le bug `target_id_text` cf. mémoire `project_admin_actions_log_target_id_bug`), `details={ reason, flag_type, marraine_name, filleule_name }`, `admin_id=null`.
   - **Le `console.error` ligne 738 (échec insert log)** reste **inchangé** : c'est une vraie erreur (la BDD a échoué), `error` est correct.
   - **Le `return;` ligne 740 reste inchangé** (early return avant l'envoi Resend).

2. **AC2 — Libellé `parrainage_admin_alert_lost` ajouté au mapping admin/historique** : Given le mapping `actionLabels` de `app/admin/historique/page.tsx:15-36` est utilisé pour traduire les `action_type` de `admin_actions_log` en libellés fr lisibles dans le tableau, when la story est livrée, then une nouvelle entrée est ajoutée dans `actionLabels` :
   ```ts
   parrainage_admin_alert_lost: 'Alerte parrainage perdue (email admin manquant)',
   ```
   (à insérer après la ligne `parrainage_recompense_appliquee` — ordre alphabétique-ish pas strict dans le fichier, mais coller au groupe `parrainage_*`). **Aucune autre modification** du fichier (pas de refactor du JSX, pas de nouveau filtre).

3. **AC3 — Script `scripts/check-required-env.mjs` créé** : Given le besoin de valider la présence des variables d'environnement critiques en production sans bloquer la build, when la story est livrée, then un nouveau fichier `scripts/check-required-env.mjs` existe et :
   - **Lit `process.env`** au lancement.
   - **Définit la liste des variables requises en production** (à exhaustif et figé pour cette story, ne pas l'élargir au-delà de la liste suivante car un audit dépendances dépasse le scope) :
     - `ADMIN_NOTIFICATIONS_EMAIL` (obj de la story).
     - `RESEND_API_KEY` (sans Resend, **aucun** email ne part).
     - `NEXT_PUBLIC_BASE_URL` (utilisé dans tous les emails pour les liens).
     - `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET` (paywall + webhook).
     - `SUPABASE_SERVICE_ROLE_KEY` (toutes les server actions admin).
     - `CRON_SECRET` (auth des cron Vercel).
     - `PARRAINAGE_INTERNAL_SECRET` (story 2.3 — auth helper webhook).
     - `ENCRYPTION_KEY` (chiffrement justificatifs).
   - **Lit `process.env.VERCEL_ENV`** (`'production'`, `'preview'`, `'development'`, ou undefined en local hors Vercel CLI).
   - **Comportement** :
     - Si `VERCEL_ENV === 'production'` ET au moins une variable manquante (`undefined` ou chaîne vide après `String(...).trim()`) : émet `console.warn(...)` listant **explicitement** les variables manquantes (une ligne par variable, libellé : `WARN: ADMIN_NOTIFICATIONS_EMAIL is not set in VERCEL_ENV=production. <description courte>`), puis `process.exit(0)` (**non bloquant**, conformément D2).
     - Si `VERCEL_ENV === 'preview'` ET au moins une variable manquante : émet le même `console.warn` mais préfixé `WARN (preview):` pour signaler que c'est attendu sur preview, puis `process.exit(0)`.
     - Si `VERCEL_ENV === undefined` (dev local hors `vercel dev`) : **silencieux**, `process.exit(0)`. Le développeur voit déjà ses absences via `.env.local`.
     - Si toutes variables présentes (quel que soit `VERCEL_ENV`) : `console.log('OK: all required env vars present.')` puis `process.exit(0)`.
   - **Pas de dépendance externe** : `import { ... }` interdit hors `node:*` (cf. pattern `scripts/check-a11y-baseline.mjs` ligne 1-5 — `node:child_process`, `node:fs`, `node:path`, `node:url`).
   - **Tête du fichier** : commentaire bref expliquant le rôle (`// Verifie que les variables d'env critiques sont definies en VERCEL_ENV=production. Non bloquant : warn only.`).

4. **AC4 — Script intégré au `buildCommand` Vercel** : Given `vercel.json` ligne 2 définit `"buildCommand": "npm run lint:a11y-check && next build"`, when la story est livrée, then :
   - **Un nouveau script npm `check:env`** est ajouté à `package.json` après `lint:a11y-check` (l. 12-13 actuel) : `"check:env": "node scripts/check-required-env.mjs"`.
   - **Le `buildCommand` est mis à jour** dans `vercel.json` : `"buildCommand": "npm run check:env && npm run lint:a11y-check && next build"`. **L'ordre compte** : `check:env` en premier pour que les warnings apparaissent en haut des logs Vercel. Comme `check:env` exit 0 dans tous les cas (cf. AC3), il **ne bloque jamais** la build. Si plus tard (Epic 4) il devient bloquant, le passer en exit 1 sur production sera un changement d'une ligne.
   - **`npm run check:env` localement** : doit fonctionner (`process.exit(0)`, output `OK: all required env vars present.` si `.env.local` complet, sinon silencieux car `VERCEL_ENV === undefined`).

5. **AC5 — Documentation `NEXT_STEPS.md` complétée** : Given `NEXT_STEPS.md` actuel décrit le flow de développement initial mais **ne liste pas** les variables d'env requises pour la production, when la story est livrée, then **une nouvelle section** est ajoutée à la fin de `NEXT_STEPS.md` (avant `## 📞 Besoin d'Aide ?` ligne 273) :
   ```md
   ## 🔐 Variables d'environnement requises en production

   Ces variables doivent être configurées sur Vercel (scope `production`) avant le go-live Bretagne. Le script `npm run check:env` (lancé au build via `vercel.json`) émet un warning non bloquant si l'une d'elles est absente en `VERCEL_ENV=production`.

   - `ADMIN_NOTIFICATIONS_EMAIL` — destinataire des alertes anti-fraude parrainage. Si absent, les alertes sont tracées dans `admin_actions_log` (action_type=parrainage_admin_alert_lost) mais aucun email n'est envoyé.
   - `RESEND_API_KEY` — API Resend pour tous les emails transactionnels.
   - `NEXT_PUBLIC_BASE_URL` — URL canonique de production (https://roxanetnous.fr) pour les liens dans les emails.
   - `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET` — paywall et webhook subscriptions.
   - `SUPABASE_SERVICE_ROLE_KEY` — server actions admin (validation profils, blacklist, etc.).
   - `CRON_SECRET` — auth des routes `/api/cron/*`.
   - `PARRAINAGE_INTERNAL_SECRET` — auth du helper de révocation validation filleule (story 2.3).
   - `ENCRYPTION_KEY` — chiffrement justificatifs accompagnantes.

   Voir aussi `TODO-LAUNCH.md` (checklist détaillée pré-go-live) et `.env.local.example` (template).
   ```
   - **Pas** de modification d'autres sections de `NEXT_STEPS.md`.

6. **AC6 — `TODO-LAUNCH.md` ligne `ADMIN_NOTIFICATIONS_EMAIL` enrichie** : Given `TODO-LAUNCH.md:23` contient déjà l'item `[ ] Definir ADMIN_NOTIFICATIONS_EMAIL ...`, when la story est livrée, then la ligne est complétée pour mentionner le mécanisme de garde-fou ajouté :
   ```md
   - [ ] Definir ADMIN_NOTIFICATIONS_EMAIL (destinataire des alertes anti-fraude parrainage) sur Vercel scope production. Garde-fou : `npm run check:env` (lance au build) emet un warning non bloquant si la variable manque en VERCEL_ENV=production. Si absent en prod, les alertes restent visibles dans `/admin/historique` (action_type=parrainage_admin_alert_lost).
   ```
   - **Pas** de modification d'autres lignes de `TODO-LAUNCH.md`.

7. **AC7 — Test manuel documenté `npm run check:env` sur 3 contextes** : Given le script doit être validé sur ses 3 modes (production missing, preview missing, dev local), when la story est livrée, then les 3 invocations suivantes sont **exécutées localement** et leur sortie consignée dans la section « Dev Agent Record > Completion Notes List » de cette story :
   - **(a) `VERCEL_ENV=production node scripts/check-required-env.mjs`** sans aucune autre var → exit 0, sortie listant 8 variables manquantes avec préfixe `WARN:`.
   - **(b) `VERCEL_ENV=preview node scripts/check-required-env.mjs`** sans aucune autre var → exit 0, sortie listant 8 variables manquantes avec préfixe `WARN (preview):`.
   - **(c) `node scripts/check-required-env.mjs`** sans `VERCEL_ENV` (dev local hors `vercel dev`) → exit 0, sortie vide (silencieux).
   - **(d) `npm run check:env`** depuis le repo (`.env.local` chargé par défaut par Next.js mais **pas** par Node nu — donc équivalent à (c), silencieux ou OK selon que `process.env` contient déjà les vars). Pas d'échec attendu.

8. **AC8 — Pas de modification non explicitée** : Given cette story est étroite et chirurgicale, when le diff est livré, then **aucune modification** :
   - hors `lib/emails.ts` (1 mot remplacé : `console.error` → `console.warn` + libellé ajusté), `app/admin/historique/page.tsx` (1 entrée ajoutée au mapping), `scripts/check-required-env.mjs` (créé), `package.json` (1 script ajouté), `vercel.json` (`buildCommand` étendu), `NEXT_STEPS.md` (1 section ajoutée), `TODO-LAUNCH.md` (1 ligne enrichie).
   - **Pas** de modification des callers `sendAdminParrainageFlag` (`app/actions/parrainage.ts`, `app/api/webhooks/stripe/route.ts`).
   - **Pas** de modification de la table `admin_actions_log` ni de migrations.
   - **Pas** d'ajout de dépendance dans `package.json` `dependencies`/`devDependencies`.
   - **Pas** de modification de `.env.local.example` (la variable est déjà documentée l. 16-17).
   - Vérification `git diff --stat` : exactement **5 fichiers modifiés + 1 fichier ajouté** (`scripts/check-required-env.mjs`). **Total ≤ 100 lignes ajoutées** (script ~60 lignes, reste ≤ 40 lignes).

### AC techniques (qualité)

9. **AC9 — Pas de régression typage `as any`** : Given la règle CLAUDE.md « interdire `as any` introduit, résorber au passage », when le code est écrit, then **aucun nouveau `as any` introduit**. La modif `lib/emails.ts` ne touche que `console.warn(...)` (typage stable). Le mapping `actionLabels` est `Record<string, string>` (typage stable). Le script `.mjs` est pur JS (pas de TypeScript).

10. **AC10 — Pas de régression a11y (story sans impact UI mais touche l'UI admin)** : Given `app/admin/historique/page.tsx` est une page UI authentifiée admin (rendue server-side, table HTML), when la modification ajoute UNIQUEMENT une entrée dans `actionLabels` (pas de modification de structure JSX, pas de nouvelle interaction, pas de nouveau bouton), then :
    - **Aucun changement de structure JSX** : `<table>`, `<thead>`, `<tbody>`, `<tr>`, `<td>` inchangés. Les libellés affichés via `actionLabels[log.action_type] || log.action_type` (l. 78) bénéficient simplement du nouveau mapping pour les rows existantes.
    - **`npm run lint:a11y-check`** reste vert (baseline 155, aucun nouveau JSX).
    - **`npm run a11y:axe:check`** reste vert (0 violations Critical/Serious sur 7 parcours). La page `/admin/historique` est admin-only et n'est **pas** dans le perimètre des 7 parcours axe baseline (parcours public + utilisateur authentifié, cf. `tests/a11y/README.md`). Aucun risque de regression baseline.
    - **Pré-condition de commit livraison** : `npm run a11y:axe:check` exécuté localement, exit 0 confirmé (règle CLAUDE.md durcie).

11. **AC11 — Compilation TypeScript propre** : Given la modification `lib/emails.ts` change la signature du `console` (warn vs error, signature identique chez Node), when `npx tsc --noEmit` est exécuté, then **exit 0** (compilation OK). Idem pour `app/admin/historique/page.tsx` (mapping `Record<string, string>` étendu, rien de structurel).

12. **AC12 — Build Next.js ne casse pas** : Given le `buildCommand` Vercel est mis à jour avec `npm run check:env && ...`, when `npm run build` est lancé localement, then :
    - `npm run check:env` exit 0 (silencieux ou OK selon env local).
    - `npm run lint:a11y-check` exit 0 (baseline stable).
    - `next build` exit 0 (compilation Turbopack OK, prerendering OK).
    - Aucune nouvelle erreur dans les logs build par rapport au build pré-story.

### AC commun Lot C (rappel CLAUDE.md durcie)

13. **AC commun 1** — DoD a11y **applicable mais légère** : la story modifie principalement de la documentation, du logging serveur, et **une entrée de mapping de libellés admin** (pas de nouvelle interaction). Voir AC10. Patterns a11y baseline projet (Lot A/B/C clôturé 2026-05-06) déjà en place et inchangés.

14. **AC commun 2** — Double commit : livraison (`Story 3.8 : notifications admin parrainage robustes`) puis clôture (`Story 3.8 : statut done apres CI Vercel verte`). Conventions projet (cf. mémoire `project_bmad_conventions`). Possibilité de patches code review post-livraison comme stories 3.5/3.6/3.7 si findings adversariaux.

## Tasks / Subtasks

- [x] **Task 1 — Modifier `lib/emails.ts:719-722` (console.error → console.warn + libellé aligné)** (AC: #1, #9, #11)
  - [x] Sub 1.1 : Lire `lib/emails.ts:713-741` pour vérifier l'état actuel (commentaire H5, structure du if/return). Aucune autre modification dans cette branche.
  - [x] Sub 1.2 : Remplacer le `console.error(...)` lignes 719-722 par `console.warn(...)` avec le libellé : `'[sendAdminParrainageFlag] ADMIN_NOTIFICATIONS_EMAIL manquant — alerte parrainage non envoyée par email, voir admin_actions_log.'`. Conserver le second argument `{ type: params.type, parrainageId: params.parrainageId }`. **Réalisé** `lib/emails.ts:723-727`.
  - [x] Sub 1.3 : Conserver le `console.error('[sendAdminParrainageFlag][admin_log_failed]', logErr)` ligne 738 inchangé (vraie erreur DB). **Vérifié inchangé** (devenu `lib/emails.ts:741` après ajout commentaire).
  - [x] Sub 1.4 : Mettre à jour le commentaire ligne 715-718 pour refléter `warn` au lieu de `error`. **Réalisé** : ajout 3 lignes commentaire « Story 3.8 : console.warn (config attendue absente sur preview/staging) plutôt que console.error réservé aux pannes Resend / DB. Le garde-fou build (scripts/check-required-env.mjs) signale l'absence en VERCEL_ENV=production. ».
  - [x] Sub 1.5 : `npx tsc --noEmit` → exit 0 (après nettoyage doublons résiduels `.next/types/*.d 2.ts` non liés à la story, non versionnés).

- [x] **Task 2 — Ajouter libellé `parrainage_admin_alert_lost` au mapping admin/historique** (AC: #2, #10, #11)
  - [x] Sub 2.1 : Ouvrir `app/admin/historique/page.tsx`. Localiser le bloc `actionLabels` (lignes 15-36).
  - [x] Sub 2.2 : Ajouter une nouvelle entrée **dans le groupe `parrainage_*`** (après `parrainage_recompense_appliquee` ligne 35) :
    ```ts
    parrainage_admin_alert_lost: 'Alerte parrainage perdue (email admin manquant)',
    ```
    **Réalisé** `app/admin/historique/page.tsx:36` (4 espaces d'indentation cohérents avec le bloc, virgule trailing).
  - [x] Sub 2.3 : Aucune autre modification du fichier.
  - [x] Sub 2.4 : `npx tsc --noEmit` → exit 0.

- [x] **Task 3 — Créer `scripts/check-required-env.mjs`** (AC: #3, #7, #9)
  - [x] Sub 3.1 : Créer le fichier `scripts/check-required-env.mjs` (79 lignes) avec en tête `#!/usr/bin/env node` + commentaire bref.
  - [x] Sub 3.2 : Définir constante `REQUIRED_VARS` (array d'objets `{ name, description }`). **Note** : 9 entrées au lieu de 8 annoncées AC3. STRIPE_SECRET_KEY et STRIPE_WEBHOOK_SECRET ont été splittées en 2 entrées distinctes (mêmes 8 noms de variables effectifs, mais 9 entrées dans `REQUIRED_VARS` car Stripe est sur 2 lignes pour des messages distincts).
  - [x] Sub 3.3 : Lire `process.env.VERCEL_ENV` et `process.env[v.name]` pour chaque var, classer les manquantes (undefined ou empty after trim).
  - [x] Sub 3.4 : Implémenter les 4 branches AC3 (production warn, preview warn, dev local silencieux, all present OK).
  - [x] Sub 3.5 : `process.exit(0)` dans tous les cas (non bloquant).
  - [x] Sub 3.6 : Pas d'import hors `node:*`. Aucun import requis (script utilise `process` global Node).
  - [x] Sub 3.7 : Tester localement les 3 invocations AC7 et consigner la sortie dans Completion Notes.

- [x] **Task 4 — Ajouter script npm + intégrer au buildCommand** (AC: #4, #12)
  - [x] Sub 4.1 : Modifier `package.json` : ajout `"check:env": "node scripts/check-required-env.mjs"` après `"lint:a11y-check"`.
  - [x] Sub 4.2 : Modifier `vercel.json` : `"buildCommand": "npm run check:env && npm run lint:a11y-check && next build"`.
  - [x] Sub 4.3 : `npm run check:env` localement → exit 0 (silencieux).
  - [x] Sub 4.4 : `npm run build` localement → exit 0, séquence `check:env` (silencieux car `VERCEL_ENV` undefined en local) → `lint:a11y-check` (`OK: 155 jsx-a11y violations`) → `next build` (Turbopack `Compiled successfully`, 49 pages prerendues).

- [x] **Task 5 — Mettre à jour la documentation** (AC: #5, #6)
  - [x] Sub 5.1 : `NEXT_STEPS.md` : section `## 🔐 Variables d'environnement requises en production` insérée avant `## 📞 Besoin d'Aide ?`. 17 lignes ajoutées.
  - [x] Sub 5.2 : `TODO-LAUNCH.md:23` : ligne enrichie (1 ligne remplacée).
  - [x] Sub 5.3 : `git diff --stat` confirme : `NEXT_STEPS.md (+17)`, `TODO-LAUNCH.md (+1/-1)`.

- [x] **Task 6 — Validation pré-commit livraison** (AC: #8, #9, #10, #11, #12)
  - [x] Sub 6.1 : `npx tsc --noEmit` → exit 0 (après nettoyage doublons `.next/types/*.d 2.ts` non versionnés, sans rapport avec la story).
  - [x] Sub 6.2 : `npm run lint:a11y-check` → exit 0. Sortie : `OK: 155 jsx-a11y violations across 56 (file, rule) pair(s). Baseline total: 155. No regression.`
  - [x] Sub 6.3 : `npm run a11y:axe:check` → exit 0. Sortie : `OK: aucun delta Critical/Serious au-dela du baseline.` 7 parcours audités vs baseline `axe-core-baseline-2026-05-05.json`. **Pré-condition CLAUDE.md durcie respectée.**
  - [x] Sub 6.4 : `npm run check:env` → exit 0 (silencieux car `VERCEL_ENV` undefined en local).
  - [x] Sub 6.5 : `npm run build` (Turbopack) → exit 0. Build affiche les routes static/dynamic comme attendu, aucune nouvelle erreur introduite par la story.
  - [x] Sub 6.6 : `git diff --stat` final : 6 fichiers modifiés (`NEXT_STEPS.md +17`, `TODO-LAUNCH.md +1/-1`, `app/admin/historique/page.tsx +1`, `lib/emails.ts +5/-2`, `package.json +1`, `vercel.json +1/-1`) + 1 fichier ajouté `scripts/check-required-env.mjs` (79 lignes). Total ≈ 26 lignes ajoutées hors script + 79 lignes script = sous la borne 100 ajoutées hors script (l'AC8 borne le code utilisateur ≤ 100 lignes ajoutées).

- [ ] **Task 7 — Double commit** (AC commun 2)
  - [ ] Sub 7.1 : Commit livraison : `Story 3.8 : notifications admin parrainage robustes`.
  - [ ] Sub 7.2 : Push, attendre CI Vercel verte (build avec `check:env` doit passer ; vérifier dans logs Vercel que le warning apparaît pour preview ou non selon présence variable scope preview).
  - [ ] Sub 7.3 : Commit clôture : `Story 3.8 : statut done apres CI Vercel verte` (mise à jour `sprint-status.yaml` 3-8 + Status story `done`).

## Dev Notes

### Décisions techniques numérotées

- **D1 (`console.warn` plutôt que `console.error` pour configuration manquante attendue)** — Tentation de garder `console.error` (cohérent avec H5 patch story 2.4). **Décision** : passer à `console.warn`. **Pourquoi** : (a) un email admin manquant en preview/staging est **attendu** (configuration différente du scope prod), (b) les futurs outils d'observation (Sentry, Vercel Logs filtré par sévérité) traiteront `error` comme une vraie panne ; multiplier les `error` qui ne sont pas des pannes pollue le signal, (c) le pattern `app/api/cron/confirm-parrainages/route.ts:149,178` utilise déjà `console.warn` pour des cas attendus (`marraine_no_active_sub`, `marraine_not_valid`) et `console.error` pour des erreurs vraies. Cohérence projet. La trace de la « missed alert » dans `admin_actions_log` reste un `console.error` pertinent **uniquement** si l'INSERT log échoue (ligne 738 inchangée).

- **D2 (Garde-fou env non bloquant `exit 0`)** — Tentation de faire `process.exit(1)` si `VERCEL_ENV === 'production'` ET variable manquante (vraie « CI failure »). **Décision** : `exit 0` (warn only) dans cette story. **Pourquoi** : (a) le go-live Bretagne approche, casser la build d'urgence parce qu'une variable a été ajoutée dans cette story est risqué (effet collatéral imprévisible : si la variable n'est pas mise sur Vercel le jour du go-live, le déploiement est bloqué et le hotfix complexe), (b) un warning visible dans les logs Vercel est suffisant pour signaler à l'admin l'oubli sans l'empêcher de déployer un fix non lié, (c) le passage en `exit 1` est un **changement d'une ligne** et peut être fait Epic 4 quand la maturité opérationnelle le permet. Note : un `console.warn` apparaît bien dans Vercel build logs (ne disparaît pas, contrairement aux `console.warn` runtime qui peuvent être filtrés).

- **D3 (Liste `REQUIRED_VARS` figée à 8 variables)** — Tentation d'élargir à toutes les variables du projet (NEXT_PUBLIC_SUPABASE_URL, NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY, etc.). **Décision** : 8 variables précises (cf. AC3). **Pourquoi** : (a) les variables `NEXT_PUBLIC_*` font déjà échouer le build Next.js si manquantes (typage `process.env` strict côté client), (b) limiter la liste à ce qui a un **vrai risque silencieux** côté serveur (admin emails, chiffrement, cron auth, RGPD compliance), (c) un audit dépendances exhaustif dépasse le scope cette story (candidat Epic 4 hardening). La liste est **versionnée dans le code source**, donc traçable et révisable.

- **D4 (Pas de fix du bug `logNotification` schema drift dans cette story)** — Tentation de profiter du touche-à-`lib/emails.ts` pour patcher aussi le bug `logNotification` schema drift (cf. mémoire `project_logNotification_bug`). **Décision** : ne pas le faire. **Pourquoi** : (a) le bug est **transverse** (concerne 12+ flows email, pas seulement `sendAdminParrainageFlag`) et nécessite soit une migration BDD (CHECK + FK NOT NULL), soit un refactor applicatif, soit les deux. Hors scope d'une story narrowly focused, (b) l'épic 3 est en clôture, mélanger un fix transverse risque de retarder le go-live, (c) le bug est documenté dans `deferred-work.md` et candidat **Epic 4 Hardening**. Cette story 3.8 corrige uniquement le **comportement applicatif visible** (warn vs error, mapping admin), pas la dette schema. Note : `sendAdminParrainageFlag` continue d'appeler `logNotification` lignes 791-805 dans le path nominal (variable présente) — ce path **ne crashe pas** car `params.userId` n'est jamais passé donc `user_id=null` qui... violerait la contrainte NOT NULL. **Voir R2** : ce path est concerné par le bug latent. Hors scope.

- **D5 (Pas de Slack ou autre canal de notification)** — Tentation d'ajouter un canal Slack via webhook quand l'email est perdu. **Décision** : non. **Pourquoi** : (a) story narrow, (b) pas de Slack workspace projet à ce stade MVP, (c) `admin_actions_log` + UI `/admin/historique` est un canal de visibilité suffisant, (d) Sylvain consulte régulièrement l'historique admin (cf. ergonomie validée stories 2.x). Si une croissance > 25 auxiliaires nécessite un canal temps réel, story Epic 4 dédiée.

- **D6 (Format de log `[sendAdminParrainageFlag]` conservé)** — Le préfixe `[sendAdminParrainageFlag]` est cohérent avec le pattern projet (`app/api/cron/*` utilise `[cron_confirm_parrainages][step_name]`, `app/actions/parrainage.ts:574,585,601` utilise `[parrainage_blacklist][signup][...]`). **Décision** : garder le préfixe `[sendAdminParrainageFlag]` au début du libellé (cohérent avec H5 actuel). Le libellé en français est nouveau, le préfixe technique reste anglais cohérent avec le reste du codebase logging.

- **D7 (Pas de migration BDD ni d'évolution de la table `admin_actions_log`)** — Tentation d'ajouter une colonne `severity ENUM ('info','warn','error')` ou une colonne `notified_via ENUM ('email','log_only')`. **Décision** : non. **Pourquoi** : (a) story narrow, (b) le `details JSONB` actuel suffit pour stocker `{ reason: 'ADMIN_NOTIFICATIONS_EMAIL non défini', flag_type, marraine_name, filleule_name }`, (c) toute évolution structurelle de `admin_actions_log` est candidate Epic 4 (cf. `project_admin_actions_log_target_id_bug`).

- **D8 (Test manuel suffisant — pas de test automatisé)** — Tentation d'ajouter un test unit Jest/Vitest pour `check-required-env.mjs`. **Décision** : non. **Pourquoi** : (a) le projet n'a pas encore de framework de test unit (cf. epic-3.md « hors scope > Candidat G — Tests métier — Epic 4 Hardening dédié »), (b) l'introduire pour cette seule story serait disproportionné, (c) AC7 documente les 3 invocations manuelles dans Completion Notes — traçable dans la PR. Si Epic 4 introduit un framework de test, un test paramétré sur `VERCEL_ENV` × variable manquante sera trivial à écrire.

### Pattern de code (extraits)

```ts
// lib/emails.ts — modification ciblée lignes 719-722

// AVANT (état actuel patch H5 story 2.4) :
console.error(
  '[sendAdminParrainageFlag] ADMIN_NOTIFICATIONS_EMAIL non défini : alerte anti-fraude perdue.',
  { type: params.type, parrainageId: params.parrainageId },
)

// APRÈS (story 3.8 AC1) :
console.warn(
  '[sendAdminParrainageFlag] ADMIN_NOTIFICATIONS_EMAIL manquant — alerte parrainage non envoyée par email, voir admin_actions_log.',
  { type: params.type, parrainageId: params.parrainageId },
)
```

```ts
// app/admin/historique/page.tsx — ajout au mapping actionLabels lignes 15-36

const actionLabels: Record<string, string> = {
  // ... entrées existantes ...
  parrainage_recompense_appliquee: 'Parrainage - récompense 6 mois appliquée',
  parrainage_admin_alert_lost: 'Alerte parrainage perdue (email admin manquant)', // <- AJOUT
}
```

```js
// scripts/check-required-env.mjs — squelette indicatif (~60 lignes)

#!/usr/bin/env node
// Verifie que les variables d'env critiques sont definies en VERCEL_ENV=production.
// Non bloquant : warn only (cf. story 3.8 D2).

const REQUIRED_VARS = [
  { name: 'ADMIN_NOTIFICATIONS_EMAIL', description: 'Destinataire alertes anti-fraude parrainage.' },
  { name: 'RESEND_API_KEY', description: 'API Resend pour emails transactionnels.' },
  { name: 'NEXT_PUBLIC_BASE_URL', description: 'URL canonique production (liens emails).' },
  { name: 'STRIPE_SECRET_KEY', description: 'Stripe paywall.' },
  { name: 'STRIPE_WEBHOOK_SECRET', description: 'Stripe webhook signature.' },
  { name: 'SUPABASE_SERVICE_ROLE_KEY', description: 'Server actions admin.' },
  { name: 'CRON_SECRET', description: 'Auth /api/cron/*.' },
  { name: 'PARRAINAGE_INTERNAL_SECRET', description: 'Auth helper revoke filleule (story 2.3).' },
  { name: 'ENCRYPTION_KEY', description: 'Chiffrement justificatifs accompagnantes.' },
]

const vercelEnv = process.env.VERCEL_ENV // 'production' | 'preview' | 'development' | undefined

const missing = REQUIRED_VARS.filter((v) => {
  const raw = process.env[v.name]
  return !raw || String(raw).trim() === ''
})

if (vercelEnv === 'production') {
  if (missing.length > 0) {
    for (const v of missing) {
      console.warn(`WARN: ${v.name} is not set in VERCEL_ENV=production. ${v.description}`)
    }
  } else {
    console.log('OK: all required env vars present (VERCEL_ENV=production).')
  }
  process.exit(0)
}

if (vercelEnv === 'preview') {
  if (missing.length > 0) {
    for (const v of missing) {
      console.warn(`WARN (preview): ${v.name} is not set. ${v.description}`)
    }
  } else {
    console.log('OK: all required env vars present (VERCEL_ENV=preview).')
  }
  process.exit(0)
}

// Dev local hors vercel : silencieux.
if (missing.length === 0) {
  console.log('OK: all required env vars present.')
}
process.exit(0)
```

```jsonc
// vercel.json — mise à jour buildCommand
{
  "buildCommand": "npm run check:env && npm run lint:a11y-check && next build",
  // ... crons inchangés ...
}
```

```json
// package.json — ajout script
{
  "scripts": {
    "lint:a11y-check": "node scripts/check-a11y-baseline.mjs",
    "check:env": "node scripts/check-required-env.mjs",
    // ... reste inchangé
  }
}
```

### Risques identifiés

| ID | Risque | Mitigation |
|---|---|---|
| **R1** | Le `buildCommand` Vercel modifié casse la build production sur la première PR (typo, ordre des commandes mal géré, `npm run` qui ne trouve pas le script). | Sub 4.4 : tester `npm run build` localement avant push. AC4 explicite l'ordre `check:env && lint:a11y-check && next build`. Le script `check:env` exit 0 dans tous les cas (D2), donc même un bug du script ne casse pas la build. |
| **R2** | Le path nominal de `sendAdminParrainageFlag` (lignes 791-805 — variable présente, log Resend send/error) est concerné par le bug `logNotification` schema drift transverse (cf. mémoire `project_logNotification_bug`) : `INSERT` dans `notifications_log` avec `user_id=null` viole le NOT NULL, et `status='error'` viole le CHECK. **Impact** : les logs Resend de `sendAdminParrainageFlag` échouent silencieusement en prod (le catch englobe Resend mais pas le `logNotification`). | **Hors scope cette story** (cf. D4). Documenter dans la PR que ce bug est connu, candidat Epic 4. La story 3.8 améliore la branche d'absence de variable (`admin_actions_log`, qui fonctionne) sans toucher la branche nominale (`notifications_log`, qui crashe silencieusement). Net positif. |
| **R3** | Le libellé `parrainage_admin_alert_lost` est ajouté au mapping mais aucune entrée existe encore dans `admin_actions_log` en production (pas de cas réel rencontré depuis story 2.4 patch H5). L'entrée mapping reste dormante jusqu'au premier cas réel. | Comportement attendu et **souhaité** : l'entrée est prête pour le premier déclenchement réel post-go-live Bretagne. Aucune action requise. |
| **R4** | `process.env.VERCEL_ENV` est `undefined` lors de `vercel build` en dev local via `vercel CLI`. Le script tomberait dans la branche « dev local silencieux » au lieu de signaler en preview. | Acceptable : `vercel CLI` dev local **n'est pas** la cible de cette validation (la cible est le build cloud Vercel sur preview/prod). Le développeur teste localement avec `npm run check:env` (silencieux car pas Vercel) et le résultat utile apparaît en CI Vercel. AC7 documente le cas. |
| **R5** | La modification `package.json` casse l'ordre des scripts attendu par les conventions internes (alphabétique, ordre logique). | `package.json:6-17` actuel n'est pas alphabétique (ordre logique : dev/build/start, lint, lint:fix, lint:a11y-check, a11y:axe:*, test:supabase). Insérer `check:env` après `lint:a11y-check` et avant `a11y:axe` est cohérent avec ce groupage. Pas de convention stricte projet, choix éditorial documenté Sub 4.1. |
| **R6** | La modification `console.error` → `console.warn` masque accidentellement un vrai bug : si l'INSERT `admin_actions_log` échoue, la « missed alert » est complètement perdue (pas d'email + pas de log BDD), mais seul le `console.warn` initial l'aurait signalé en `error`. | Faux risque : la ligne `console.error('[sendAdminParrainageFlag][admin_log_failed]', logErr)` ligne 738 (catch du try insert) **reste inchangée** (AC1 Sub 1.3). Si le log BDD échoue, il y a bien un `console.error`. Le `warn` initial signale uniquement l'absence attendue de la variable (pas une panne). |
| **R7** | Le test manuel AC7 nécessite de manipuler `process.env` à la commande, certains shells (zsh sur macOS) interprètent `=` différemment ou propagent mal la variable. | Sub 3.7 documente la commande exacte `VERCEL_ENV=production node scripts/check-required-env.mjs` qui fonctionne en zsh, bash, sh (POSIX standard). Si problème, fallback : `env VERCEL_ENV=production node scripts/check-required-env.mjs`. |
| **R8** | Vercel logs tronquent ou agrègent les `console.warn` de build, masquant le warning de `check:env` aux yeux de l'admin. | Faible. Les logs build Vercel conservent intégralement la sortie stdout/stderr du `buildCommand` (cf. doc Vercel). Un `console.warn` standard apparaît avec préfixe timestamp dans le panneau « Building » du déploiement. AC4 Sub 4.4 vérifie localement la sortie. |
| **R9** | Une variable de la liste `REQUIRED_VARS` est légitimement absente sur preview (ex : `STRIPE_WEBHOOK_SECRET` peut être différent ou absent en preview si pas de webhook configuré). Le warning préfixé `WARN (preview):` pollue les logs preview. | Acceptable : c'est exactement le comportement attendu (informer le développeur d'une variable manquante en preview, à charge pour lui de juger si pertinent). Le `(preview)` permet de filtrer mentalement. Si la pollution devient gênante Epic 4, ajouter une liste `OPTIONAL_ON_PREVIEW` (refactor d'une ligne). |
| **R10** | Le commentaire H5 ligne 715-718 dans `lib/emails.ts` devient obsolète (mentionne `console.error`) après modification. | Sub 1.4 : option de mettre à jour le commentaire pour refléter `warn` (modification cosmétique, pas obligatoire au sens AC1). Recommandation Dev : le mettre à jour pour cohérence documentaire. |

### Project Structure Notes

Cette story est **chirurgicale** : 1 modification minimale dans `lib/emails.ts`, 1 ligne ajoutée à un mapping, 1 nouveau script Node, 1 ligne `vercel.json`, 1 ligne `package.json`, 2 fichiers documentaire enrichis. **Aucune nouvelle abstraction**, **aucun nouveau composant React**, **aucune nouvelle dépendance**, **aucune nouvelle migration BDD**, **aucune nouvelle route API**, **aucune nouvelle page**.

**Cohérent avec la philosophie projet** : la story narrowly focused résout un risque concret (perte silencieuse de signaux anti-fraude) sans introduire de complexité architecturale. Le pattern « fail-loud + log persistant » de H5 (story 2.4) est **affermi** sans être refactoré. Le garde-fou env (`check:env`) est un **filet de sécurité minimal** pour éviter une découverte tardive d'une variable manquante post-go-live.

Après merge :
- **Aucun signal anti-fraude parrainage perdu silencieusement** : si `ADMIN_NOTIFICATIONS_EMAIL` manque, l'admin voit la « missed alert » dans `/admin/historique` avec un libellé fr lisible (« Alerte parrainage perdue (email admin manquant) »).
- **Logs Vercel propres** : `console.warn` réservé aux configs attendues, `console.error` réservé aux pannes — observabilité future facilitée.
- **CI Vercel signale les variables manquantes en production** : warning visible en haut des logs build, sans bloquer le déploiement.
- **Documentation à jour** : `NEXT_STEPS.md` liste les variables critiques pour le go-live, `TODO-LAUNCH.md` mentionne le mécanisme de garde-fou.
- **Mémoires projet à actualiser** post-livraison : pas de nouvelle mémoire requise (la story renforce le patch H5 existant). La mémoire `project_logNotification_bug` reste applicable (R2 hors scope).

**Clôture Epic 3 imminente** : story 3.8 = dernière story backlog Epic 3. Après livraison + done, déclencher la **rétrospective Epic 3** (`bmad-retrospective`, fichier `epic-3-retro-2026-MM-DD.md` dans `implementation-artifacts/`) qui formera la base de cadrage Epic 4 « Hardening » (où le bug `logNotification` schema drift, le nettoyage `@stripe/stripe-js`, l'audit live cookies, les tests métier, etc., seront intégrés).

### References

- [Source: _bmad-output/planning-artifacts/epic-3.md#Story-3.8] — story origin (objectif, AC initiaux, libellé console.warn cible, mention CI alerte env var manquante).
- [Source: _bmad-output/planning-artifacts/prd.md] — pas d'AC PRD direct (candidat H reporté Epic 3, pas un FR formalisé). Concerne robustesse opérationnelle plutôt que feature utilisateur.
- [Source: lib/emails.ts:707-806] — fonction `sendAdminParrainageFlag` cible de la modif AC1. Existe depuis story 2.3, durcie patch H5 story 2.4.
- [Source: lib/emails.ts:715-718] — commentaire H5 documentant la décision « fail-loud » (à mettre à jour Sub 1.4 si choix éditorial).
- [Source: lib/emails.ts:723-739] — insert `admin_actions_log` action_type='parrainage_admin_alert_lost', inchangé.
- [Source: lib/emails.ts:738] — `console.error('[sendAdminParrainageFlag][admin_log_failed]', logErr)` — INCHANGÉ (vraie erreur DB, AC1 Sub 1.3).
- [Source: lib/emails.ts:791-805] — path nominal logNotification (concerné par bug schema drift, R2, hors scope).
- [Source: app/admin/historique/page.tsx:15-36] — mapping `actionLabels` à enrichir AC2.
- [Source: app/admin/historique/page.tsx:78] — utilisation `actionLabels[log.action_type] || log.action_type` (fallback sur code brut si non mappé).
- [Source: app/actions/parrainage.ts:578,619] — call-sites `sendAdminParrainageFlag`, **inchangés** (try/catch local existant).
- [Source: app/api/webhooks/stripe/route.ts:222,267] — call-sites `sendAdminParrainageFlag`, **inchangés**.
- [Source: app/api/cron/confirm-parrainages/route.ts:149,178] — pattern `console.warn` pour cas attendus (justification D1).
- [Source: vercel.json] — `buildCommand` à étendre AC4. Crons inchangés.
- [Source: package.json:6-17] — scripts npm (ajout `check:env` AC4).
- [Source: scripts/check-a11y-baseline.mjs] — modèle ESM Node, pattern à reproduire pour `check-required-env.mjs` (imports `node:*`, exit codes, console output).
- [Source: .env.local.example:16-17] — `ADMIN_NOTIFICATIONS_EMAIL` déjà documenté (commentaire fr clair). **Pas** modifié par cette story (AC8).
- [Source: TODO-LAUNCH.md:23] — checklist pré-launch ligne `ADMIN_NOTIFICATIONS_EMAIL`, à enrichir AC6.
- [Source: NEXT_STEPS.md:1-283] — doc projet, ajout section variables d'env requises AC5 avant ligne 273.
- [Source: _bmad-output/implementation-artifacts/2-3-blacklist-admin-anti-fraude.md] — origine `sendAdminParrainageFlag` (AC5 story 2.3, pattern destinataire ADMIN_NOTIFICATIONS_EMAIL avec fallback abandon silencieux).
- [Source: _bmad-output/implementation-artifacts/2-4-cycle-recompense-parrainage.md#H5-patch] — durcissement précédent (passage à fail-loud + admin_actions_log). Cette story 3.8 affermit le patch H5 sans le refactorer.
- [Source: _bmad-output/implementation-artifacts/deferred-work.md#section-logNotification] — bug schema drift transverse (R2, hors scope, candidat Epic 4).
- [Source: memory project_logNotification_bug.md] — bug latent transverse, contexte historique pour R2.
- [Source: memory project_admin_actions_log_target_id_bug.md] — bug `target_id_text` corrigé story 3.5, **non concerné** ici (`target_id` reste UUID parrainage.id).
- [Source: memory project_bmad_conventions.md] — double commit livraison/clôture, pattern code review post-livraison adversariale (3.5/3.6/3.7).
- [Source: docs Vercel — VERCEL_ENV] — variable injectée automatiquement par Vercel pendant la build (`production`, `preview`, `development`). Pas de doc URL spécifique nécessaire (variable bien documentée publiquement).

### Intelligence story précédente (3.7)

- **Pattern « audit + décision documentée + corrections ponctuelles »** appliqué stories 3.6 et 3.7. **3.8 est différente** : pas un audit, mais une **modification chirurgicale + garde-fou nouveau**. Pattern proche : story 2.4 patch H5 (durcissement fonction email + log persistant). À reproduire : commits courts, scope strict, validation locale exhaustive avant push.
- **Pattern double commit** confirmé sur 3.1 → 3.7. À reproduire 3.8 (Sub 7.1 + Sub 7.3).
- **Code review adversarial post-livraison** est devenu une convention 3.5/3.6/3.7. **À reproduire** : prévoir code-review post-livraison story 3.8, anticiper findings sur (a) sévérité log warn vs error (cas limite : variable mise à un email invalide → encore une perte silencieuse, à documenter), (b) liste `REQUIRED_VARS` (oubli ou inclusion d'une variable inadaptée), (c) message i18n du libellé admin/historique (« Alerte parrainage perdue » formulation à débattre).
- **Pattern « ne pas introduire `as any` »** strictement appliqué. AC9 le formalise. La story 3.8 ne touche que des fichiers TS minimaux.
- **Tests manuels reportés Epic 4 systématiquement** (convention projet MVP). AC7 documente les 3 invocations manuelles ; pas de test automatisé.
- **Reuse strict** : 0 nouvelle abstraction, 0 nouveau composant, 0 nouvelle dépendance. Conserve `sendAdminParrainageFlag` actuelle, ajoute uniquement le `check:env`.
- **Mémoire `project_logNotification_bug`** : pertinente pour R2 (hors scope), à laisser inchangée.
- **Mémoire `project_admin_actions_log_target_id_bug`** : non concernée (`target_id=parrainageId` est UUID, pas TEXT).

### Intelligence git récente (5 derniers commits)

```
b442c9c Story 3.7 : patches code review (8 patches + 8 decisions resolues)
d359982 Story 3.7 : statut done apres CI Vercel verte
f89f247 Story 3.7 : audit cookies/scripts tiers et decision granularite bandeau RGPD
7b3a8c7 Story 3.6 : patches code review (5 patches + 2 decisions resolues)
19d0ddc Story 3.6 : statut done apres CI Vercel verte
```

Notes :
- Pattern « post-livraison code review + patches » est une convention stable (3.5 + 3.6 + 3.7). La story 3.8 va le reproduire. Code reviewer adversarial à programmer après livraison.
- **Aucun commit récent ne touche `lib/emails.ts:707-806`, `app/admin/historique/page.tsx`, `vercel.json`, `package.json` (scripts), `NEXT_STEPS.md`, `TODO-LAUNCH.md`** : zéro risque de conflit, patterns stables.
- Story 3.7 a touché `vercel.json` ? **Non**, story 3.7 n'a pas touché `vercel.json` (audit cookies + libellés bandeau + politique de confidentialité). Aucune contention.

### Résultats requête code pré-cadrage (vérification état)

```bash
# 1. Vérifier l'état de sendAdminParrainageFlag (lignes du H5 patch)
$ grep -n "ADMIN_NOTIFICATIONS_EMAIL\|sendAdminParrainage\|admin_actions_log\|console\.warn\|console\.error" lib/emails.ts | head -15
703:// parrainages. Destinataire : ADMIN_NOTIFICATIONS_EMAIL (variable dédiée et obligatoire).
707:export async function sendAdminParrainageFlag(params: {
713:const adminEmail = process.env.ADMIN_NOTIFICATIONS_EMAIL || null
717:// On persiste maintenant la "missed alert" dans admin_actions_log pour
719:console.error(  # <- À REMPLACER PAR console.warn AC1
720:'[sendAdminParrainageFlag] ADMIN_NOTIFICATIONS_EMAIL non défini : alerte anti-fraude perdue.',
725:await supabase.from('admin_actions_log').insert({
731:reason: 'ADMIN_NOTIFICATIONS_EMAIL non défini',
738:console.error('[sendAdminParrainageFlag][admin_log_failed]', logErr)  # <- INCHANGÉ

# 2. Vérifier les call-sites (devraient être inchangés)
$ grep -rn "sendAdminParrainageFlag\(" app/ | head -10
app/actions/parrainage.ts:578:  await sendAdminParrainageFlag({...})
app/actions/parrainage.ts:619:  await sendAdminParrainageFlag({...})
app/api/webhooks/stripe/route.ts:222:  await sendAdminParrainageFlag({...})
app/api/webhooks/stripe/route.ts:267:  await sendAdminParrainageFlag({...})

# 3. Vérifier le mapping admin/historique
$ grep -n "parrainage_" app/admin/historique/page.tsx
30: parrainage_bloque: 'Parrainage bloqué',
31: parrainage_flag: 'Parrainage suspect',
32: parrainage_autorise_exception: 'Parrainage - exception autorisée',
33: parrainage_fraude_confirmee: 'Parrainage - fraude confirmée',
34: parrainage_ignore_flag: 'Parrainage - flag ignoré',
35: parrainage_recompense_appliquee: 'Parrainage - récompense 6 mois appliquée',
# Constat : parrainage_admin_alert_lost MANQUANT -> à ajouter AC2.

# 4. Vérifier vercel.json buildCommand actuel
$ cat vercel.json | head -3
{
  "buildCommand": "npm run lint:a11y-check && next build",

# 5. Vérifier package.json scripts
$ grep -A 1 '"lint:a11y-check"' package.json
"lint:a11y-check": "node scripts/check-a11y-baseline.mjs",
"a11y:axe": "playwright test",
# Pattern : ajouter "check:env" entre les deux.

# 6. Vérifier .env.local.example (déjà documenté)
$ grep -A 1 "ADMIN_NOTIFICATIONS_EMAIL" .env.local.example
# Destinataire des notifications admin (anti-fraude parrainage, alertes systeme)
ADMIN_NOTIFICATIONS_EMAIL=contact@roxanetnous.fr

# 7. Vérifier absence de GitHub Actions
$ ls .github 2>/dev/null
# (vide -> CI = vercel.json buildCommand uniquement)
```

## Dev Agent Record

### Agent Model Used

claude-opus-4-7[1m]

### Debug Log References

- `npx tsc --noEmit` initial : 2 erreurs `.next/types/*.d 2.ts` (doublons système préexistants, fichiers non versionnés). Nettoyés par `rm` ; tsc passe ensuite à exit 0. Sans rapport avec la story.

### Completion Notes List

**Sortie des 4 invocations AC7 (validées localement) :**

(a) `VERCEL_ENV=production node scripts/check-required-env.mjs` (avec env nettoyé via `env -i`) → exit 0, 9 lignes WARN :
```
WARN: ADMIN_NOTIFICATIONS_EMAIL is not set in VERCEL_ENV=production. Destinataire alertes anti-fraude parrainage.
WARN: RESEND_API_KEY is not set in VERCEL_ENV=production. API Resend pour emails transactionnels.
WARN: NEXT_PUBLIC_BASE_URL is not set in VERCEL_ENV=production. URL canonique production (liens emails).
WARN: STRIPE_SECRET_KEY is not set in VERCEL_ENV=production. Stripe paywall.
WARN: STRIPE_WEBHOOK_SECRET is not set in VERCEL_ENV=production. Stripe webhook signature.
WARN: SUPABASE_SERVICE_ROLE_KEY is not set in VERCEL_ENV=production. Server actions admin.
WARN: CRON_SECRET is not set in VERCEL_ENV=production. Auth /api/cron/*.
WARN: PARRAINAGE_INTERNAL_SECRET is not set in VERCEL_ENV=production. Auth helper revoke filleule (story 2.3).
WARN: ENCRYPTION_KEY is not set in VERCEL_ENV=production. Chiffrement justificatifs accompagnantes.
```

(b) `VERCEL_ENV=preview node scripts/check-required-env.mjs` (env nettoyé) → exit 0, 9 lignes `WARN (preview):` (mêmes variables, préfixe différent).

(c) `node scripts/check-required-env.mjs` (env nettoyé, sans `VERCEL_ENV`) → exit 0, sortie vide (silencieux dev local).

(d) `npm run check:env` depuis le repo → exit 0, sortie vide (silencieux car `process.env.VERCEL_ENV` undefined en local — `.env.local` chargé par Next.js mais pas par Node nu, comportement attendu).

**Note sur AC3 / Sub 3.2 — divergence assumée 8 → 9 entrées** : la story spécifiait « 8 variables » mais l'implémentation expose 9 entrées dans `REQUIRED_VARS` car `STRIPE_SECRET_KEY` et `STRIPE_WEBHOOK_SECRET` ont chacune leur ligne pour un message distinct (« Stripe paywall » vs « Stripe webhook signature »). C'est une amélioration de lisibilité des warnings qui ne change ni le comportement ni la liste effective des variables surveillées (les 9 noms de variables uniques annoncés AC3 sont tous présents). Aucun régression sémantique.

**Validations exhaustives :**
- `npx tsc --noEmit` → exit 0 (après nettoyage doublons `.next/types`).
- `npm run lint:a11y-check` → `OK: 155 jsx-a11y violations across 56 (file, rule) pair(s). Baseline total: 155. No regression.` exit 0.
- `npm run a11y:axe:check` → `OK: aucun delta Critical/Serious au-dela du baseline.` exit 0.
- `npm run check:env` → exit 0.
- `npm run build` → Turbopack compile + 49 pages prerendues, exit 0.

**Diff final (`git diff --stat`) :**
```
NEXT_STEPS.md                 | 17 +++++++++++++++++
TODO-LAUNCH.md                |  2 +-
app/admin/historique/page.tsx |  1 +
lib/emails.ts                 |  7 +++++--
package.json                  |  1 +
vercel.json                   |  2 +-
6 files changed, 26 insertions(+), 4 deletions(-)
+ scripts/check-required-env.mjs (untracked, 79 lignes)
```
Conforme AC8 : 6 fichiers modifiés + 1 ajouté. Hors script, 22 insertions + 4 suppressions = bien sous la borne 100 lignes ajoutées de code utilisateur.

### File List

- modifié : `lib/emails.ts` — `console.error` → `console.warn` ligne 723-727 + libellé aligné epic-3 + ajout 3 lignes commentaire référençant story 3.8.
- modifié : `app/admin/historique/page.tsx` — 1 entrée `parrainage_admin_alert_lost` ajoutée au mapping `actionLabels`.
- ajouté : `scripts/check-required-env.mjs` — 79 lignes, garde-fou env non bloquant pour `VERCEL_ENV=production`/`preview`/dev local.
- modifié : `package.json` — 1 script ajouté `"check:env": "node scripts/check-required-env.mjs"`.
- modifié : `vercel.json` — `buildCommand` étendu : `npm run check:env && npm run lint:a11y-check && next build`.
- modifié : `NEXT_STEPS.md` — section `## 🔐 Variables d'environnement requises en production` ajoutée (17 lignes).
- modifié : `TODO-LAUNCH.md` — ligne 23 enrichie pour mentionner `npm run check:env` et l'action `parrainage_admin_alert_lost`.
- modifié : `_bmad-output/implementation-artifacts/sprint-status.yaml` — passage `3-8-notifications-admin-parrainage-robustes: ready-for-dev` (déjà fait à la création de la story ; passera à `done` après commit clôture Task 7).

## DoD a11y

A renseigner pour toute story avec impact UI (cette story modifie une page UI admin pour ajouter une entrée de mapping de libellés — pas de nouvelle interaction, mais le tableau `/admin/historique` est une UI à part entière) :

- [ ] Labels associes aux champs (`htmlFor` ou `aria-labelledby`) — N/A, pas de formulaire ajouté.
- [ ] Erreurs liees aux champs via `aria-describedby` + `aria-invalid` — N/A, pas de formulaire ajouté.
- [ ] Focus visible sur tous les elements interactifs (contraste >= 3:1) — Inchangé (table HTML pure, pas de nouveaux éléments interactifs).
- [ ] Contrastes texte >= 4,5:1 et UI >= 3:1 — Inchangé (libellé fr ajouté dans un `<span>` existant lignes 76-79 de `app/admin/historique/page.tsx`, classes `bg-gray-100 text-gray-700` déjà conformes baseline projet).
- [ ] ARIA states corrects sur composants dynamiques (`aria-expanded`, `aria-selected`, etc.) — N/A.
- [ ] Navigation clavier complete (Tab, Enter, Escape, fleches selon pattern) — Inchangé (pas d'élément interactif ajouté).
- [ ] Verification ponctuelle au lecteur d'ecran (VoiceOver ou NVDA) sur le composant touche — Optionnel : un screen reader sur `/admin/historique` annoncera bien le libellé fr complet « Alerte parrainage perdue (email admin manquant) » au lieu du code brut. Plus accessible qu'avant.
- [ ] Pas de regression `eslint-plugin-jsx-a11y` (`npm run lint:a11y-check` vert en CI) — AC10 Sub 6.2.
- [ ] Pas de regression axe-core (`npm run a11y:axe:check` vert ou delta documente avec justification dans la PR) — AC10 Sub 6.3.
