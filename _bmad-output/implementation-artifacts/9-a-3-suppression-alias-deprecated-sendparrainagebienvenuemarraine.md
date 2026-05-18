# Story 9.A.3 : Supprimer alias deprecated `sendParrainageBienvenueMarraine`

Status: review

<!-- Note: Validation is optional. Run validate-create-story for quality check before dev-story. -->

## Story

As a **développeur back-end du projet**,
I want **supprimer la fonction wrapper `sendParrainageBienvenueMarraine` (alias deprecated 1-release créé en 8.C.3) ainsi que ses 2 mocks de tests, tout en gardant intacte la fonction cible `sendParrainageBienvenueParrain`**,
so that **on solde le defer Epic 8 `F-Epic8-C3 alias 1-release` (filet de sécurité posé pour 1 release prod) avant que la dette n'enracine un wording féminin obsolète interdit par la règle CLAUDE.md « accompagnant masculin neutre »**.

## Contexte

La rétrospective Epic 8 (`epic-8-retro-2026-05-17.md`) + `deferred-work.md:23` documentent qu'à la livraison de la story 8.C.3 (« Wording UI neutre marraine/filleule → parrain/filleul »), un **alias deprecated 1-release** a été délibérément conservé en filet de sécurité :

```ts
// lib/emails.ts:595-596
/** @deprecated Epic 8 -- supprimer prochaine release (Epic 9). Voir _bmad-output/implementation-artifacts/deferred-work.md */
export const sendParrainageBienvenueMarraine = sendParrainageBienvenueParrain
```

Ce wrapper a rempli sa mission : aucun caller applicatif n'utilise plus l'ancien nom (cf. AC1 grep). La prochaine release prod (déploiement Epic 9) est précisément l'occasion identifiée par le defer pour le supprimer.

**Périmètre strict** : suppression mécanique de 3 lignes (1 alias + 2 mocks tests) + commentaire d'en-tête `lib/emails.ts:599` qui fait référence à l'ancien nom. Aucune modification du contenu des emails (sujet, body HTML, fallback wording), aucune migration BDD, aucune rename de la fonction cible `sendParrainageBienvenueParrain`. Le grep `sendParrainageBienvenueMarraine` doit retourner zéro occurrence après la story.

**Pré-requis pour 9.A.4** : cette story doit être merged avant 9.A.4 (qui ajoutera un nouvel alias deprecated `sendParrainageFilleulConfirmation` selon le pattern T2.2 de 8.C.3 — éviter d'avoir 2 alias deprecated simultanés dans `lib/emails.ts`).

## Acceptance Criteria

1. **AC1 — Audit pré-suppression** : `grep -r "sendParrainageBienvenueMarraine" app/ components/ lib/ tests/` retourne exactement **4 occurrences avant la story** :
   - `lib/emails.ts:596` (définition de l'alias)
   - `lib/emails.ts:599` (commentaire d'en-tête `sendParrainageBienvenueAccompagne` qui mentionne l'ancien nom)
   - `tests/integration/setup.ts:173` (mock vitest)
   - `tests/unit/parrainage-symetrie.test.ts:86` (mock vitest)

   **Après la story**, le même grep retourne **zéro occurrence**. Vérification idempotente : commande `grep -r "sendParrainageBienvenueMarraine" app/ components/ lib/ tests/ ; echo "exit=$?"` doit afficher `exit=1` (rien trouvé).

2. **AC2 — Suppression de la fonction wrapper** : suppression de `lib/emails.ts:595-596` (le bloc `/** @deprecated ... */` JSDoc + la ligne `export const sendParrainageBienvenueMarraine = sendParrainageBienvenueParrain`). La ligne blanche éventuellement laissée doit aussi être retirée (pas de double blank line). La fonction `sendParrainageBienvenueParrain` (cible de l'alias) reste **strictement inchangée** (signature, corps, type de retour).

3. **AC3 — Mise à jour du commentaire d'en-tête `sendParrainageBienvenueAccompagne`** : `lib/emails.ts:598-602` (commentaire bloc qui dit « Symetrique de sendParrainageBienvenueMarraine mais le destinataire... ») mis à jour pour référencer `sendParrainageBienvenueParrain` à la place de `sendParrainageBienvenueMarraine`. Le sens du commentaire reste identique, seul l'identifiant change.

4. **AC4 — Suppression du mock unit** : `tests/unit/parrainage-symetrie.test.ts:86` ligne `sendParrainageBienvenueMarraine: vi.fn(),` supprimée du bloc `vi.mock('@/lib/emails', () => ({ ... }))`. Aucun autre mock du même bloc n'est touché. La virgule de fin de ligne précédente / suivante doit rester cohérente avec le style existant (pas de trailing comma orpheline).

5. **AC5 — Suppression du mock integration** : `tests/integration/setup.ts:173` ligne `sendParrainageBienvenueMarraine: vi.fn().mockResolvedValue(undefined),` supprimée du bloc `vi.mock('@/lib/emails', () => ({ ... }))`. Idem : pas de modification des autres lignes du mock.

6. **AC6 — Pas de modification du wording email** : aucune modification du sujet, body HTML, fallback texte, ou paramètres de `sendParrainageBienvenueParrain`. C'est une **suppression d'alias pur**. Aucune nouvelle dépendance ajoutée. Aucun changement de signature.

7. **AC7 — `npm run test:unit` exit 0** : la suite vitest unit reste verte. Le mock supprimé en AC4 n'est utilisé par aucun appel `expect(...)` (puisque aucun code applicatif ne l'appelle), donc aucune assertion ne casse. Baseline attendue : **94 tests verts** (héritée de 9.A.1, à confirmer en local).

8. **AC8 — `npm run test:integration` reste vert** : la suite integration reste verte (à confirmer via GHA workflow `integration-tests` sur la PR, conformément à `feedback_test_local_supabase` — Sylvain ne lance pas Docker localement). Le mock supprimé en AC5 n'est utilisé par aucun appel.

9. **AC9 — `tsc --noEmit` exit 0** : aucune erreur TypeScript sur les fichiers modifiés. Baseline héritée 9.A.1 : 2 erreurs `.next/types/` pré-existantes tolérées. Suppression d'un `export const` ne peut pas introduire de nouvelle erreur de typage.

10. **AC10 — `npm run build` exit 0** : Next.js build reste vert.

11. **AC11 — `npm run lint` baseline préservée** : 0 erreur, baseline 192 warnings préservée (héritée 9.A.1). La suppression de 3 lignes ne peut introduire de nouveau warning.

12. **AC12 — `npm run lint:a11y-check` exit 0** : baseline 155 préservée (héritée 9.A.1/9.A.7). Story sans impact UI, mais run de sécurité.

13. **AC13 — Commit dédié atomique** : un seul commit livraison avec le message exact :

    ```
    Story 9.A.3 : refactor(emails) supprimer alias deprecated sendParrainageBienvenueMarraine
    ```

    Le commit ne mélange **pas** la story 9.A.4 (rename `sendParrainageFilleuleConfirmation`) même si le fichier `lib/emails.ts` est commun aux deux. La séparation est explicitement exigée par epic-9.md ligne 156 (« Commit dédié ... pas mélangé avec 9.A.4 même si même fichier »).

14. **AC14 — `deferred-work.md` mis à jour** : préfixer la ligne 23 `F-Epic8-C3 alias 1-release -- supprimer lib/emails.ts:sendParrainageBienvenueMarraine` par `[Solde 9.A.3 - YYYY-MM-DD]` (date du commit livraison). Ne pas supprimer la ligne (convention BMad : barrer pour traçabilité). Ne pas toucher aux autres lignes `F-Epic8-C3` (rename `sendParrainageFilleuleConfirmation` ligne 25 = scope 9.A.4 ; rename types TS ligne 27 = scope 9.A.4 ; audit Sentry ligne 29 = scope 9.A.6 ; validation manuelle staging ligne 31 = scope 9.C.2).

15. **AC15 — Story sans impact UI = DoD a11y N/A** (cf. CLAUDE.md projet, règle a11y obligatoire pour stories à impact UI uniquement). Aucune obligation `npm run a11y:axe:check` ne s'applique. Documenter explicitement N/A dans le commit / PR.

## Tasks / Subtasks

- [x] **T1 — Audit pré-suppression** (AC1)
  - [x] T1.1 Exécuter `grep -rn "sendParrainageBienvenueMarraine" app/ components/ lib/ tests/` et confirmer 4 occurrences attendues (1 alias + 1 commentaire + 2 mocks).
  - [x] T1.2 Si une 5e occurrence apparaît (ex. caller applicatif oublié), **STOP** et signaler dans la PR : la suppression devient bloquante tant que le caller n'est pas migré vers `sendParrainageBienvenueParrain`.

- [x] **T2 — Supprimer la fonction wrapper `lib/emails.ts`** (AC2)
  - [x] T2.1 Supprimer les lignes 595-596 (JSDoc `@deprecated` + `export const sendParrainageBienvenueMarraine = sendParrainageBienvenueParrain`).
  - [x] T2.2 Vérifier qu'aucune double blank line ne reste après suppression (cohérence style existant du fichier).

- [x] **T3 — Mettre à jour le commentaire d'en-tête `sendParrainageBienvenueAccompagne`** (AC3)
  - [x] T3.1 Dans le commentaire `lib/emails.ts:598-602`, remplacer `sendParrainageBienvenueMarraine` par `sendParrainageBienvenueParrain`. Conserver le reste du wording du commentaire à l'identique (mention règle CLAUDE.md durcie, CTA `/accompagne/parrainage`, story 8.B.1, etc.).

- [x] **T4 — Supprimer le mock unit** (AC4)
  - [x] T4.1 `tests/unit/parrainage-symetrie.test.ts:86` : supprimer la ligne `sendParrainageBienvenueMarraine: vi.fn(),`.
  - [x] T4.2 Vérifier la cohérence des virgules (pas de `,,` orpheline ; respecter le style du fichier).

- [x] **T5 — Supprimer le mock integration** (AC5)
  - [x] T5.1 `tests/integration/setup.ts:173` : supprimer la ligne `sendParrainageBienvenueMarraine: vi.fn().mockResolvedValue(undefined),`.
  - [x] T5.2 Vérifier la cohérence des virgules.

- [x] **T6 — Audit post-suppression** (AC1)
  - [x] T6.1 Re-exécuter `grep -rn "sendParrainageBienvenueMarraine" app/ components/ lib/ tests/` et confirmer **zéro occurrence** (exit code 1).
  - [x] T6.2 Confirmer que `sendParrainageBienvenueParrain` reste exporté et utilisé (grep sanity : au moins 1 caller applicatif dans `app/actions/parrainage.ts`).

- [x] **T7 — DoD CI complet** (AC7, AC8, AC9, AC10, AC11, AC12)
  - [x] T7.1 `npx tsc --noEmit` exit 0 (baseline `.next/types/` préservée — 2 erreurs `.next/types/routes.d 2.ts` + `cache-life.d 2.ts` pré-existantes).
  - [x] T7.2 `npm run lint` baseline 193 warnings (0 erreur) — note : baseline réelle mesurée = 193 (vs 192 indiquée dans la story, dérive de mesure entre stories, pas de régression introduite par 9.A.3 car suppression de 3 lignes uniquement, baseline pré-story re-mesurée identique à post-story).
  - [x] T7.3 `npm run lint:a11y-check` exit 0 — baseline 155 préservée.
  - [x] T7.4 `npm run test:unit` exit 0 (94 tests verts, 11 fichiers, 1.12s).
  - [x] T7.5 `npm run build` exit 0.
  - [x] T7.6 `npm run check:no-direct-notifications-log-insert` exit 0.
  - [x] T7.7 `npm run check:as-any-global` exit 0.
  - [x] T7.8 `npm run check:oracle-paywall` exit 0.
  - **AC8 (integration tests)** : exécution déléguée au workflow GHA `integration-tests` sur la PR (cf. `feedback_test_local_supabase` — Sylvain ne lance pas Docker localement). Mock supprimé non référencé par aucune assertion, régression impossible.

- [x] **T8 — Solder defer `deferred-work.md`** (AC14)
  - [x] T8.1 Préfixer la ligne 23 par `[Solde 9.A.3 - 2026-05-18]`.
  - [x] T8.2 Ne pas toucher aux autres lignes `F-Epic8-C3` (scope 9.A.4 / 9.A.6 / 9.C.2).
  - [x] T8.3 Sanity check : grep `F-Epic8-C3 alias 1-release` retourne 1 ligne préfixée `[Solde 9.A.3 - 2026-05-18]`.

- [ ] **T9 — Commit livraison dédié** (AC13)
  - [ ] T9.1 Stager **uniquement** les 4 fichiers modifiés (`lib/emails.ts`, `tests/unit/parrainage-symetrie.test.ts`, `tests/integration/setup.ts`, `_bmad-output/implementation-artifacts/deferred-work.md`) + le fichier de cette story basculé en statut `review` puis `done` (cf. T10).
  - [ ] T9.2 Vérifier `git status` : aucun fichier hors-scope (notamment pas de modification `lib/emails.ts` ligne ~659 = scope 9.A.4).
  - [ ] T9.3 Message commit exact : `Story 9.A.3 : refactor(emails) supprimer alias deprecated sendParrainageBienvenueMarraine`.

- [ ] **T10 — Mise à jour statut sprint** (convention BMad)
  - [ ] T10.1 Après merge PR, basculer `sprint-status.yaml` `9-a-3-suppression-alias-deprecated-sendparrainagebienvenuemarraine` de `review` → `done` (commit dédié `chore(sprint)` séparé du commit livraison, pattern hérité 9.A.2).
  - [ ] T10.2 Mettre à jour le champ `last_updated` en tête de fichier.

## Dev Notes

- **Stack** : Next.js 16 + TypeScript 5 + Vitest (unit + integration). Pas de framework UI impacté.
- **Helper test partagé `createSupabaseFromMock`** (story 9.A.1) : non touché ici, mais les 2 fichiers tests modifiés contiennent toujours des `vi.mock('@/lib/emails', ...)` indépendants (chaque fichier déclare son propre mock). Ne **pas** déplacer ces mocks dans un helper partagé dans le scope de 9.A.3 (out-of-scope).
- **Risque régression** : extrêmement faible. La suppression est mécanique. Le seul piège est un caller applicatif oublié qui importerait `sendParrainageBienvenueMarraine` (T1.2 détecte ce cas avant d'exécuter la suppression).
- **Ordre dans le sprint 9.A** : 9.A.3 est en **Ordre 1 (parallélisable)** selon epic-9.md ligne 95. 9.A.4 est en **Ordre 2 séquentiel après 9.A.3** car 9.A.4 ajoutera un nouveau alias deprecated dans le même fichier `lib/emails.ts` selon le pattern T2.2 8.C.3 — éviter d'avoir 2 alias deprecated coexistant brièvement.
- **Pas de migration BDD, pas de modification env vars, pas de modification CI** (workflows `.github/workflows/` inchangés). La PR sera mergée via le workflow standard `integration-tests` qui se déclenche sur PR (cf. mémoire `feedback_test_local_supabase` + leçon 9.A.7 sur les workflows GHA `pull_request` only).

### Project Structure Notes

- **Pas de nouveau fichier créé**. 4 fichiers modifiés uniquement :
  - `lib/emails.ts` (suppression alias ligne 595-596 + maj commentaire ligne 598-602)
  - `tests/unit/parrainage-symetrie.test.ts` (suppression mock ligne 86)
  - `tests/integration/setup.ts` (suppression mock ligne 173)
  - `_bmad-output/implementation-artifacts/deferred-work.md` (préfixage ligne 23)
- **Aucun conflit attendu** avec la structure existante. La fonction cible `sendParrainageBienvenueParrain` (`lib/emails.ts:~500` selon le contexte 8.A.1) reste exportée et utilisable.

### References

- [Source: `_bmad-output/planning-artifacts/epic-9.md#Story-9.A.3`] — Cadrage Epic 9 ligne 144-158, AC1-AC5 originaux.
- [Source: `_bmad-output/implementation-artifacts/deferred-work.md:23`] — Defer `F-Epic8-C3 alias 1-release` à solder.
- [Source: `lib/emails.ts:595-596`] — Définition actuelle de l'alias `sendParrainageBienvenueMarraine`.
- [Source: `lib/emails.ts:598-602`] — Commentaire d'en-tête `sendParrainageBienvenueAccompagne` à corriger.
- [Source: `tests/unit/parrainage-symetrie.test.ts:84-90`] — Bloc `vi.mock('@/lib/emails', ...)` contenant le mock à supprimer.
- [Source: `tests/integration/setup.ts:161-184`] — Bloc `vi.mock('@/lib/emails', ...)` contenant le mock à supprimer.
- [Source: `_bmad-output/implementation-artifacts/9-a-1-refonte-mocks-supabase-frommock-discriminants-par-table.md#AC9-AC13`] — Baselines CI héritées (94 tests unit, 192 warnings lint, 155 baseline a11y).
- [Source: `.claude/CLAUDE.md`] — Règle accompagnant masculin neutre (motivation finale du retrait de l'alias `Marraine`).
- [Source: `_bmad-output/implementation-artifacts/sprint-status.yaml:369`] — Statut backlog avant cette story.

## Dev Agent Record

### Agent Model Used

claude-opus-4-7[1m]

### Debug Log References

- Audit pré : `grep -rn "sendParrainageBienvenueMarraine" app/ components/ lib/ tests/` → 4 occurrences attendues confirmées (`lib/emails.ts:596` alias, `lib/emails.ts:599` commentaire d'en-tête, `tests/unit/parrainage-symetrie.test.ts:86` mock, `tests/integration/setup.ts:173` mock).
- Audit post : `grep -rn "sendParrainageBienvenueMarraine" app/ components/ lib/ tests/ ; echo "exit=$?"` → `exit=1` (0 occurrence).
- Sanity cible : `grep -rn "sendParrainageBienvenueParrain" app/ lib/` → présent dans `app/actions/admin.ts:9,226`, `app/actions/parrainage.ts:9,1119`, `lib/emails.ts:538` (définition).
- `npx tsc --noEmit` : 2 erreurs `.next/types/routes.d 2.ts` + `cache-life.d 2.ts` pré-existantes, exit 0.
- `npm run lint` : 193 warnings (0 erreur), baseline préservée (mesure pré-story identique = 193).
- `npm run lint:a11y-check` : 155 violations, baseline préservée.
- `npm run test:unit` : 11 fichiers, 94 tests passés, 1.12s.
- `npm run build` : exit 0.
- `npm run check:no-direct-notifications-log-insert` / `check:as-any-global` / `check:oracle-paywall` : exit 0.

### Completion Notes List

- **Suppression d'alias mécanique** : retrait des 3 lignes prévues (1 alias `lib/emails.ts:595-596` + 2 mocks tests). Cible `sendParrainageBienvenueParrain` strictement inchangée.
- **AC3 commentaire d'en-tête** : seul l'identifiant `sendParrainageBienvenueMarraine` est remplacé par `sendParrainageBienvenueParrain` dans le commentaire `lib/emails.ts:595-599` (numérotation post-suppression). Sens et wording du commentaire préservés (règle CLAUDE.md durcie, story 8.B.1, CTA `/accompagne/parrainage`).
- **AC11 — note sur baseline lint** : la story indiquait baseline 192 warnings. Mesure pré-story (via `git stash`) = 193 warnings. Mesure post-story = 193 warnings. Aucune régression introduite. La dérive (192 → 193) provient probablement d'une story Epic 9.A intercalée non re-baselinée ; pas dans le scope de 9.A.3 de l'investiguer.
- **AC8 integration** : non exécuté localement (cf. mémoire `feedback_test_local_supabase`). Validation déléguée au workflow GHA `integration-tests` sur la PR. Risque nul : le mock supprimé n'était référencé par aucune assertion (`expect(...)`).
- **AC15 a11y N/A confirmée** : suppression alias TypeScript serveur, aucun composant React/DOM/clavier impacté. `lint:a11y-check` reste vert (run de sécurité).
- **Defer `F-Epic8-C3 alias 1-release` soldé** : `deferred-work.md:23` préfixé `[Solde 9.A.3 - 2026-05-18]`, ligne conservée pour traçabilité (convention BMad).
- **Reste à faire (T9/T10)** : commit livraison atomique + sprint-status `review → done` post-merge PR. Géré par l'utilisateur après cette session ou via skill `commit-push-pr`.

### File List

- `lib/emails.ts` (modifié — suppression alias deprecated lignes 595-596 + correction identifiant dans le commentaire d'en-tête `sendParrainageBienvenueAccompagne`).
- `tests/unit/parrainage-symetrie.test.ts` (modifié — suppression mock `sendParrainageBienvenueMarraine: vi.fn()`).
- `tests/integration/setup.ts` (modifié — suppression mock `sendParrainageBienvenueMarraine: vi.fn().mockResolvedValue(undefined)`).
- `_bmad-output/implementation-artifacts/deferred-work.md` (modifié — préfixage ligne 23 `[Solde 9.A.3 - 2026-05-18]`).
- `_bmad-output/implementation-artifacts/sprint-status.yaml` (modifié — bascule `9-a-3-...: ready-for-dev → in-progress → review` + `last_updated`).
- `_bmad-output/implementation-artifacts/9-a-3-suppression-alias-deprecated-sendparrainagebienvenuemarraine.md` (modifié — Status, Tasks cochées T1-T8, Dev Agent Record renseigné).

### Change Log

- 2026-05-18 — Implémentation 9.A.3 : suppression mécanique de l'alias deprecated `sendParrainageBienvenueMarraine` (`lib/emails.ts` + 2 mocks tests) + correction du commentaire d'en-tête `sendParrainageBienvenueAccompagne` pour référencer `sendParrainageBienvenueParrain`. Defer `F-Epic8-C3 alias 1-release` soldé dans `deferred-work.md:23`. DoD CI complet vert (tsc baseline, lint 193 warnings 0 erreur, lint:a11y-check 155 baseline, test:unit 94/94, build, 3 scripts de garde brownfield). AC8 integration délégué GHA PR. Status story → `review`. T9/T10 (commit livraison + sprint done) en attente côté utilisateur.

## DoD a11y

Story sans impact UI = **N/A** (cf. AC15, règle CLAUDE.md projet : checklist a11y obligatoire pour stories à impact UI uniquement). La suppression d'un alias TypeScript serveur n'affecte aucun composant React, aucun DOM rendu, aucune interaction clavier. Aucun run `npm run a11y:axe:check` requis (mais `lint:a11y-check` doit rester vert en sécurité — cf. AC12).
