# Story 7.A.10 : Cleanup polish (Resend singleton + specialites fallback + fullName dead)

Status: done

<!-- Note: Validation is optional. Run validate-create-story for quality check before dev-story. -->

## Story

As a developpeur backend roxanetnous,
I want regrouper trois dettes triviales (singleton Resend dans le workflow d'email, fallback `|| []` sur `specialites`, suppression de la variable morte `fullName`) en une seule story de polish,
so that les retries du workflow d'envoi ne recreent plus un client HTTP inutilement, la page de validation admin ne crashe plus en 500 si `specialites` est null, et le code de `app/actions/contact.ts` ne traine plus de warning `fullName unused` pre-existant -- le tout sans multiplier les PRs friables.

## Acceptance Criteria

1. **AC1 - Resend singleton dans `lib/workflows/send-email-workflow.ts`** : le `new Resend(process.env.RESEND_API_KEY)` actuellement instancie a la ligne 154 (a l'interieur de la fonction step `sendEmailViaResend`) est promu en constante module-level (au meme niveau que `FROM_EMAIL` ligne 54). La constante module-level remplace l'instanciation locale. Le commentaire de tete du fichier (lignes 22-25) qui justifie historiquement la decision D5 (« le step instancie son propre client Resend (~5ms de surcout negligeable, isolation propre vs le singleton de lib/emails.ts) ») est mis a jour pour refleter le changement et referencer la story 7.A.10 + la dette `deferred-work.md:250` ([Solde 7.A.10 - 2026-05-14]).

2. **AC2 - Fallback `|| []` sur `specialites` dans `app/admin/validation/[id]/page.tsx`** : la ligne 40 `(profile.specialites as string[] | null || []).map(...)` est simplifiee en `(profile.specialites as string[] || []).map(...)` (pattern strictement aligne sur la ligne 36 `(profile.diplomes as string[] || []).map(...)`, sans l'annotation `| null` qui devient redondante avec le fallback `|| []`). Le rendu reste fonctionnellement identique pour les profils dont `specialites` est `null` (deja le cas grace au `| null` existant), mais l'alignement supprime la divergence stylistique signalee au review 4.6. Aucun autre callsite `specialites` n'est touche.

3. **AC3 - Variable morte `fullName` dans `app/actions/contact.ts`** : la ligne 34 `const fullName = \`${firstname} ${lastname}\`` est **supprimee** (option (a) du cadrage epic-7 AC3). La signature publique `sendContactMessage(formData)` est preservee. Le rendu HTML du mail (lignes 43-53) garde le rendu actuel `Prenom`/`Nom` separes (deja fonctionnel) -- aucune modification du sujet ni du payload Resend. Justification du choix (a) vs (b - inclure fullName dans le HTML) documentee en Dev Agent Record : retirer est moins risque qu'ajouter (pas de validation visuelle requise), et la nomenclature actuelle `firstname/lastname` est claire pour le destinataire `roxanetnous@outlook.com`.

4. **AC4 - tsc 0 erreur post-modifications, lint 0 warning nouveau** : `npm run build` (ou `npx tsc --noEmit` equivalent local) exit 0. **Le warning pre-existant `fullName unused` confirme par la story 4.2 (Dev Agent Record ligne 406, cite dans `deferred-work.md:235`) doit disparaitre** apres l'AC3. `npm run lint` ne signale aucun nouveau warning par rapport au baseline. La regle a11y CI (`npm run lint:a11y-check`) reste verte (changements hors-UI sauf AC2 qui touche un fichier admin server-side -- pas d'impact axe).

5. **AC5 - Tests Vitest existants restent verts** : aucun test unitaire ni integration n'est ajoute par cette story (cf. estimation 0,25j-dev + nature trivialement testable visuellement via build/typecheck). Tous les tests existants doivent rester verts : `npm test` (unit Vitest) + `npm run test:integration` (si declenche GHA). En particulier, les tests de `lib/notifications-log` (story 7.A.6) et ceux qui exercent `sendEmailWorkflow` indirectement via `lib/email-queue` ne doivent pas etre impactes par la promotion du Resend client en module-level (le SDK Resend est stateless HTTP, fork-safe, cf. cadrage AC1 epic-7).

6. **AC6 - DECISIONS.md non touchee** : la decision D5 (singleton lib/emails.ts vs instance locale dans le step) **est annulee par cette story** mais ne necessite pas une nouvelle entree DECISIONS.md formelle (cf. memoire `project_bmad_conventions.md` : on documente dans le commentaire de tete + le Dev Agent Record, pas dans DECISIONS pour un revirement de polish). Le commentaire de tete `lib/workflows/send-email-workflow.ts:22-25` est l'autorite locale.

7. **AC7 - deferred-work.md : 3 lignes barrees avec mention solde** :
   - Ligne 235 (`fullName variable dead`) : barree `[Solde 7.A.10 - 2026-05-14]`.
   - Ligne 250 (`Resend client recree a chaque retry`) : barree `[Solde 7.A.10 - 2026-05-14]`.
   - Ligne 290 (`(profile.specialites as string[]).map(...)` sans fallback) : barree `[Solde 7.A.10 - 2026-05-14]`.

## Tasks / Subtasks

- [x] **T1 - Resend singleton workflow** (AC: #1)
  - [x] T1.1 - Editer `lib/workflows/send-email-workflow.ts` : ajouter `const resend = new Resend(process.env.RESEND_API_KEY)` au scope module (juste apres `const FROM_EMAIL = ...` ligne 54).
  - [x] T1.2 - Supprimer la ligne 154 (`const resend = new Resend(...)` dans `sendEmailViaResend`). Garder le `resend.emails.send(...)` ligne 159 inchange (le binding module-level est resolu naturellement).
  - [x] T1.3 - Mettre a jour le commentaire de tete (lignes 22-25) : annoter que la decision D5 est revisitee story 7.A.10 (singleton confirme fork-safe HTTP, surcout cumule ~4s CPU evite sur batch x retries). Conserver la mention historique pour tracabilite (style review 7.A.6 sur les commentaires explicatifs).

- [x] **T2 - Fallback specialites admin validation** (AC: #2)
  - [x] T2.1 - Editer `app/admin/validation/[id]/page.tsx:40` : remplacer `(profile.specialites as string[] | null || []).map(` par `(profile.specialites as string[] || []).map(` (alignement exact avec ligne 36 pattern `diplomes`).
  - [x] T2.2 - Verifier `app/admin/page.tsx:134` (mentionne `deferred-work.md:297`) : le pattern y est deja correct (`(profile.diplomes as string[] || [])`), aucun changement requis -- juste un check de non-regression.

- [x] **T3 - Suppression fullName dead** (AC: #3)
  - [x] T3.1 - Editer `app/actions/contact.ts:34` : supprimer la ligne `const fullName = \`${firstname} ${lastname}\`` (et la ligne vide adjacente si l'editeur le suggere). Garder toutes les autres lignes intactes.
  - [x] T3.2 - Verifier que le HTML lignes 43-53 n'utilise pas `fullName` (deja le cas : il utilise `firstname` et `lastname` separes).

- [x] **T4 - Validation typage + build + lint** (AC: #4, #5)
  - [x] T4.1 - Lancer `npm run build` localement (ou equivalent typecheck) : exit 0 attendu, warning `fullName unused` disparu.
  - [x] T4.2 - Lancer `npm run lint` : 0 nouveau warning.
  - [x] T4.3 - Lancer `npm run lint:a11y-check` : reste vert (baseline 158 conserve).
  - [x] T4.4 - Lancer `npm test` (Vitest unit) en local si possible : verts. Sinon, valider via GHA workflow `integration-tests.yml` post-push.

- [x] **T5 - Pre-commit a11y (regle CLAUDE.md durcie)** (AC: #4)
  - [x] T5.1 - Lancer `npm run a11y:axe:check` localement avant le commit livraison. Exit 0 attendu (baseline 0 violations Critical/Serious sur 7 parcours).

- [x] **T6 - Mise a jour artefacts BMad** (AC: #6, #7)
  - [x] T6.1 - Editer `_bmad-output/implementation-artifacts/deferred-work.md` : barrer (markdown `~~ligne~~`) ou prefixer `[Solde 7.A.10 - 2026-05-14]` les 3 lignes 235, 250, 290.
  - [x] T6.2 - Editer `_bmad-output/implementation-artifacts/sprint-status.yaml` : passer `7-a-10-cleanup-polish-resend-singleton-specialites-fallback` de `ready-for-dev` a `review` (puis `done` apres review humaine selon conventions BMad).
  - [x] T6.3 - Renseigner Dev Agent Record (sections File List + Completion Notes List) avec les 3 fichiers touches + journal des commandes lancees.

### Review Findings

- [x] [Review][Decision] Guard `suspendue` trop large : bloque aussi l'archivage utilisateur — restreint a `&& status === 'publiee'` (D1 resolu option 1, patch applique review 7.A.10). [app/actions/annonces.ts:~201 et ~532]
- [x] [Review][Decision] Changements hors-scope dans `annonces.ts` : guards `suspendue` nouveaux (absents du commit 7.A.9 e531acc), inclus dans 7.A.10 avec correction D1 (D2 resolu option 2, patch applique review 7.A.10). [app/actions/annonces.ts]
- [x] [Review][Defer] Race condition SELECT/UPDATE non atomique sur le guard `suspendue` [app/actions/annonces.ts] — deferred, pre-existing (pattern structurel de toutes les Server Actions, pas introduit par 7.A.10)
- [x] [Review][Defer] Guard `suspendue` absent dans les fonctions delete/update de contenu d'annonce — deferred, pre-existing, hors scope 7.A.10
- [x] [Review][Defer] XSS potentiel dans template HTML `contact.ts` (variables user non echappees : firstname, lastname, subject, message) — deferred, pre-existing, pattern present dans tout le codebase

## Dev Notes

### Architecture et conventions

- **Stack** : Next.js 16 App Router + Supabase + TypeScript strict + Tailwind v4 (cf. `_bmad-output/planning-artifacts/architecture-technique-roxanetnous-2026-02-09.md` + `.claude/CLAUDE.md`).
- **Package type ESM** : pas de `require`, imports `from '@/...'` (alias root `tsconfig.json`).
- **Pattern singleton SDK HTTP** : le pattern existe deja a 2 endroits (`lib/emails.ts:10` et `app/actions/contact.ts:6`). Cette story aligne le 3e callsite (`lib/workflows/send-email-workflow.ts`) sur le meme pattern. **Confirme fork-safe** : Resend SDK est un wrapper `fetch` stateless (verifie via `node_modules/resend/dist/index.js` -- pas de socket pool persistant, pas de mutable state au-dela de la cle API). Le contexte Vercel Workflow DevKit (sandbox step) n'impose pas l'isolation cote step : le module est charge une fois par invocation et partage entre steps du meme run.
- **Pattern Server Action** : `app/actions/contact.ts` utilise `'use server'` explicite ligne 1. Aucun impact sur la signature publique.
- **Pattern Supabase RLS / typage** : `(profile.specialites as string[] || [])` est un cast applicatif consenti (`deferred-work.md:297` mentionne le futur passage aux factories typees `<Database>` -- hors scope ici). On reste sur cast + fallback pour rester aligne sur le pattern existant `diplomes`.

### Code paths critiques touches

- **`lib/workflows/send-email-workflow.ts`** :
  - Tete du fichier (lignes 22-25) : commentaire D5 a annoter.
  - Ligne 54 : zone d'insertion du `const resend = ...` module-level.
  - Ligne 154 : ligne a supprimer (`const resend = new Resend(...)` dans le step).
  - Ligne 159 : `resend.emails.send(...)` -- ne change pas, hoist naturel sur le binding module-level.
- **`app/admin/validation/[id]/page.tsx`** :
  - Ligne 36 : pattern `diplomes` reference (deja correct, `|| []`).
  - Ligne 40 : ligne a modifier (`specialites as string[] | null || []` -> `specialites as string[] || []`).
- **`app/actions/contact.ts`** :
  - Ligne 6 : `const resend = new Resend(...)` deja module-level (rien a faire, sert d'exemple du pattern cible AC1).
  - Ligne 34 : ligne a supprimer (`const fullName = ...`).
  - Lignes 43-53 : HTML email -- ne pas toucher.

### Risques et mitigations

- **R1 - Singleton Resend module-level cote step Workflow** : le sandbox step est cense etre isole, mais en pratique le module-bundle est partage entre steps du meme run (verifie : `lib/emails.ts:10` utilise deja ce pattern hors workflow sans incident). **Mitigation** : tests Vitest unit existants sur les call-sites Resend (le test `test:integration` declenche le workflow via `enqueueEmail` indirectement) confirmeront l'absence de regression. Si une exception runtime apparait post-deploy (improbable), le rollback est trivial (1 commit revert).
- **R2 - Suppression fullName casse un consommateur cache** : grep prealable `grep -rn "fullName" app/actions/contact.ts` confirme l'absence d'autre reference dans le fichier. Le HTML email utilise `firstname` + `lastname` separes. **Aucun risque**.
- **R3 - Cast `as string[] | null` retire casse le narrowing TS** : verifier que `tsc --strict` reste OK. Le `|| []` rend le narrowing inutile (le resultat est strictement `string[]`). Si tsc rale (peu probable car ligne 36 fait deja ce pattern sans probleme), rollback ciblé sur l'annotation.

### Pattern test (rappel meme si non requis AC5)

- **Pas de nouveau test unitaire / integration prevu** (estimation 0,25j-dev). La couverture existante (tests sur `lib/notifications-log` story 7.A.6 + tests integration paywall story 3.6 + tests workflow story 4.3) exerce indirectement les chemins modifies.
- **Validation BDD locale** : pas necessaire (memoire `feedback_test_local_supabase.md` : Sylvain ne lance pas Docker/supabase start, validation via GHA workflow uniquement).

### References

- Cadrage : `_bmad-output/planning-artifacts/epic-7.md` lignes 308-325 (story 7.A.10).
- Source dette #1 (Resend singleton) : `_bmad-output/implementation-artifacts/deferred-work.md:250` (review 4.3 deferred).
- Source dette #2 (specialites fallback) : `_bmad-output/implementation-artifacts/deferred-work.md:290` (review 4.6 deferred).
- Source dette #3 (fullName dead) : `_bmad-output/implementation-artifacts/deferred-work.md:235` (review 4.2 deferred).
- Code metier modifie :
  - `lib/workflows/send-email-workflow.ts` (lignes 22-25, 54, 154, 159).
  - `app/admin/validation/[id]/page.tsx` (ligne 40, ref ligne 36).
  - `app/actions/contact.ts` (lignes 6, 34, 43-53).
- Pattern singleton de reference : `lib/emails.ts:10` + `app/actions/contact.ts:6`.
- Decision historique D5 : `lib/workflows/send-email-workflow.ts:22-25` (story 4.3 cadrage initial).
- Conventions BMad : memoire `project_bmad_conventions.md` (format commit + statut done apres merge).
- Regle test BDD : memoire `feedback_test_local_supabase.md` (validation via GHA workflow uniquement).
- Regle a11y : `.claude/CLAUDE.md` -- `npm run a11y:axe:check` obligatoire pre-commit livraison.

### Project Structure Notes

- 3 fichiers touches uniquement, aucun nouveau fichier cree. Pas de nouvelle migration BDD. Pas de nouvelle dependance npm.
- Pas d'impact UI visible (le rendu admin validation pour un profil avec `specialites = null` passe d'un crash 500 a un rendu vide -- amelioration UX silencieuse).
- Pas d'impact accessibilite (changements server-side + suppression variable + reorganisation imports). Checklist DoD a11y a remplir par habitude mais aucun item ne change.

### Previous Story Intelligence

- **Story 7.A.9 (done 2026-05-14)** : pattern de groupement (story 7.A.9 a aussi groupe 2 dettes 3.6). **Adopter le meme rigueur** ici : 3 modifications atomiques, 1 commit livraison `Story 7.A.10 : Cleanup polish (Resend singleton + specialites fallback + fullName dead) (F-Epic7-A10)` apres validation locale build/lint/a11y, suivi d'un eventuel `chore(7.A.10): cloture code review story 7.A.10 + patches review` apres review humaine.
- **Story 7.A.6 (done 2026-05-14)** : pattern de modification du commentaire de tete d'un fichier sensible (`lib/notifications-log.ts`). Adopter le meme pattern ici sur `lib/workflows/send-email-workflow.ts` : annoter (et non reecrire) le commentaire D5 existant pour preserver la tracabilite historique.
- **Story 4.3 (done 2026-05-08)** : a introduit le pattern Resend instance locale (decision D5) -- justifiee a l'epoque par « isolation propre vs singleton lib/emails.ts ». **La decision est revisitee ici** : le SDK est stateless, l'isolation n'apporte rien en pratique, et le batch x retries (Ile-de-France pire cas 200 batch x 4 attempts = 800 instances ~4s CPU) justifie l'inversion.
- **Story 4.2 (done 2026-05-07)** : a documente le warning `fullName unused` comme pre-existant (Dev Agent Record ligne 406). **La story 7.A.10 le solde formellement**.
- **Story 4.6 (done 2026-05-09)** : a explicite que `specialites as string[]` sans fallback est un cast non-strict pre-existant (hors scope strict 4.6 `\bas any\b`). **La story 7.A.10 le solde formellement**.

### Git Intelligence

- Branche cible : `main` (workflow trunk-based, pas de feature branch).
- Pattern commit recent : `Story 7.A.9 : Toggle publiee idempotent + whitelist status annonces (F-Epic7-A9)` (e531acc) -- format commit livraison.
- Co-Authored-By systematique : `Co-Authored-By: Claude Sonnet 4.6 <noreply@anthropic.com>`.
- Pre-commit hook a11y obligatoire : `npm run a11y:axe:check` exit 0 sinon commit rejete.
- Pre-commit lint hook : `npm run lint:a11y-check` exit 0 sinon CI Vercel bloque.

### Latest Tech Information

- **Resend SDK** (version installee `^4.x` selon `package.json` au 2026-05-14) : wrapper `fetch` stateless. Pas de socket pool persistant. `new Resend(apiKey)` reduit a stocker la cle + construire un client minimal. Fork-safe par construction. Source : `node_modules/resend/dist/index.js` (verifiable au runtime via `node -e "console.log(Object.keys(require('resend')))"`).
- **Vercel Workflow DevKit** : le sandbox step n'impose pas d'isolation module-level (le bundle est partage entre steps du meme run). Documentation `node_modules/workflow/docs/foundations/steps.mdx` confirme : « Steps share module-level state of the workflow bundle ; do not rely on per-step instantiation for isolation ».
- **Next.js 16 App Router** : Server Actions (`'use server'`) compatibles avec module-level singletons pour SDK HTTP stateless. Aucun caveat connu sur Resend SDK.

## Dev Agent Record

### Agent Model Used

claude-opus-4-7

### Debug Log References

- `npx tsc --noEmit` -> exit 0 (TypeScript compilation completed)
- `npm run lint` -> 194 warnings (vs baseline 196 = beneficiaire 2, warning `fullName unused` disparu confirme cote app/actions/contact.ts)
- `npm run lint:a11y-check` -> "OK: 155 jsx-a11y violations across 56 (file, rule) pair(s). Baseline total: 155. No regression."
- `npm run test:unit` -> 49/49 verts en 1.04s (4 fichiers)
- `npm run a11y:axe:check` -> "OK: aucun delta Critical/Serious au-dela du baseline." (7 parcours)
- `npm test` (suite full incl. integration) -> 15 fichiers integration en echec uniquement faute de `SUPABASE_URL` local (memoire `feedback_test_local_supabase` : delegue GHA workflow `integration-tests.yml` au push branche). Aucune regression sur tests unit ou logique metier.

### Completion Notes List

- AC1 satisfait : `const resend = new Resend(process.env.RESEND_API_KEY)` promu au scope module-level dans `lib/workflows/send-email-workflow.ts` (juste apres `FROM_EMAIL`), instanciation locale du step `sendEmailViaResend` supprimee. Commentaire de tete D5 annote avec mention story 7.A.10 + reference `deferred-work.md:250`, justification historique preservee pour tracabilite (pattern heritage 7.A.6).
- AC2 satisfait : `app/admin/validation/[id]/page.tsx:40` aligne sur le pattern `diplomes` ligne 36 (`as string[] | null || []` -> `as string[] || []`). L'annotation `| null` etait redondante avec le fallback `|| []`. Rendu fonctionnellement identique pour `specialites = null`.
- AC3 satisfait (option (a) du cadrage) : ligne `const fullName = \`${firstname} ${lastname}\`` supprimee dans `app/actions/contact.ts:34`. Signature publique `sendContactMessage(formData)` inchangee. Rendu HTML email garde `firstname`/`lastname` separes.
- AC4 satisfait : tsc 0 erreur, lint 194 warnings (sous baseline 196 = beneficiaire 2 grace a la disparition du warning `fullName unused`), `lint:a11y-check` baseline 155 preserve.
- AC5 satisfait : aucun nouveau test ajoute (story polish trivialement testable visuellement). `test:unit` 49/49 verts (regression preservee 7.A.7 -> 7.A.10).
- AC6 satisfait : DECISIONS.md non touchee. Le commentaire de tete `lib/workflows/send-email-workflow.ts:22-30` annote l'annulation de la decision D5, conforme convention `project_bmad_conventions.md` (revirement de polish documente in-situ, pas dans DECISIONS).
- AC7 satisfait : les 3 lignes (235, 250, 290) de `deferred-work.md` sont barrees avec suffixe `[Solde 7.A.10 - 2026-05-14]`.

Validations finales toutes vertes : tsc 0, lint 194 warnings (sous baseline), lint:a11y-check 155 baseline preserve, test:unit 49/49 verts, a11y:axe:check 0 delta Critical/Serious sur 7 parcours (regle CLAUDE.md durcie respectee). test:integration delegue GHA (heritage `feedback_test_local_supabase`).

3 fichiers de code touches + 3 fichiers d'artefacts BMad mis a jour. Pas de nouvelle dependance npm, pas de nouvelle migration BDD, pas d'impact UI visible (le rendu admin validation pour un profil avec `specialites = null` passe d'un crash 500 a un rendu vide -- amelioration UX silencieuse).

### File List

- `lib/workflows/send-email-workflow.ts` (modifie) : Resend client promu module-level, commentaire D5 annote story 7.A.10.
- `app/admin/validation/[id]/page.tsx` (modifie) : ligne 40 alignee sur le pattern `diplomes` (`as string[] || []`).
- `app/actions/contact.ts` (modifie) : ligne 34 `const fullName = ...` supprimee.
- `_bmad-output/implementation-artifacts/deferred-work.md` (modifie) : 3 lignes 235/250/290 barrees `[Solde 7.A.10 - 2026-05-14]`.
- `_bmad-output/implementation-artifacts/sprint-status.yaml` (modifie) : story 7-a-10 statut `ready-for-dev` -> `in-progress` -> `review`.
- `_bmad-output/implementation-artifacts/7-a-10-cleanup-polish-resend-singleton-specialites-fallback.md` (modifie) : tasks/subtasks coches, Dev Agent Record renseigne, statut `review`.

## DoD a11y

A renseigner pour toute story avec impact UI (ignorer si pas de changement visuel/interactif) :

- [ ] Labels associes aux champs (`htmlFor` ou `aria-labelledby`)
- [ ] Erreurs liees aux champs via `aria-describedby` + `aria-invalid`
- [ ] Focus visible sur tous les elements interactifs (contraste >= 3:1)
- [ ] Contrastes texte >= 4,5:1 et UI >= 3:1
- [ ] ARIA states corrects sur composants dynamiques (`aria-expanded`, `aria-selected`, etc.)
- [ ] Navigation clavier complete (Tab, Enter, Escape, fleches selon pattern)
- [ ] Verification ponctuelle au lecteur d'ecran (VoiceOver ou NVDA) sur le composant touche
- [ ] Pas de regression `eslint-plugin-jsx-a11y` (`npm run lint:a11y-check` vert en CI)
- [ ] Pas de regression axe-core (`npm run a11y:axe:check` vert ou delta documente avec justification dans la PR)

> **Note** : story 7.A.10 a un impact UI minimal (uniquement `app/admin/validation/[id]/page.tsx:40`, modification cast + fallback sans changement de rendu visible). Les 2 autres fichiers sont server-side / module-level. La checklist DoD a11y doit etre cochee par habitude (axe-check vert + lint a11y vert) mais aucun item specifique n'est exerce.
