# Story 2.6.4 : Erreurs inline `role="alert"` sur 23 fichiers

Status: ready-for-dev

<!-- Note: Validation est optionnelle. Lancer `validate-create-story` avant `dev-story` pour un controle qualite. -->

## Story

En tant qu'**utilisateur de lecteur d'ecran qui declenche une erreur de validation ou de submission dans n'importe quel formulaire/composant du site**,
je veux **que cette erreur soit annoncee immediatement, pas seulement affichee visuellement**,
afin de **comprendre pourquoi mon action n'a pas abouti et corriger sans devoir explorer le DOM manuellement**.

Cette story leve le critere C2 (annonces d'erreurs) sur les 23 fichiers porteurs de blocs erreur inline (`bg-red-50` / `text-red-700`) hors composant `<Input>` partage (deja traite Lot A 2.5.5). C'est une story **mecanique mais a volume eleve** — meme profil que 2.5.5 (multi-fichiers) avec marge anti-derive integree.

## Acceptance Criteria

### AC commun Lot B (rappel)

1. **AC commun 1** - `npm run lint:a11y-check` et `npm run a11y:axe:check` verts ou delta documente.
2. **AC commun 2** - DoD a11y cochee + delta axe-core mentionne.
3. **AC commun 3** - Double commit (livraison + cloture).

### AC propres a la Story 2.6.4

4. **AC1 - 23 fichiers cibles annotes** : Given les 23 fichiers identifies dans l'inventaire `inventaire-points-usage-lot-b-2026-05-05.md` §2.6.4, when un developpeur consulte chaque fichier, then le conteneur d'erreur (typiquement `<div className="...bg-red-50 border-red-200 text-red-700...">`) recoit `role="alert"` quand l'erreur est conditionnellement rendue (apparition / disparition du DOM).
5. **AC2 - Cas blocs toujours rendus** : Given un bloc d'erreur **toujours present dans le DOM** (rare — verifier au cas par cas), when l'erreur est mise a jour via setState, then le conteneur utilise `aria-live="polite"` (sans `role="alert"`) et la valeur est mise a jour via le contenu, pas via `display:none`.
6. **AC3 - Pas de double-annonce avec `<Input>`** : Given un composant qui contient deja un `<Input>` partage (Lot A 2.5.5) **avec sa propre erreur attachee au champ via `aria-describedby`**, when on consulte ce fichier, then **ne pas** ajouter `role="alert"` sur un bloc d'erreur global qui ferait redondance avec l'erreur du `<Input>`. Cas typiques : `register-form.tsx`, `login.tsx`. Inspection cas par cas obligatoire.
7. **AC4 - `aria-live="polite"` par defaut** : Given les erreurs longuement affichees (ex. erreur de submission qui reste a l'ecran tant que l'utilisateur n'a pas corrige), when on choisit le niveau d'annonce, then on utilise `polite` (pas `assertive`). Justification : `assertive` coupe la lecture en cours et est reserve aux erreurs bloquantes critiques (typiquement aucun cas dans le projet actuellement). `role="alert"` est equivalent a `assertive + atomic` mais c'est le pattern standard pour les erreurs d'apparition.
8. **AC5 - Decompte garde-fou** : Given la cloture de la story, when le developpeur execute `grep -rn 'role="alert"' components app | grep -v 'ui/input.tsx' | wc -l`, then le compteur >= 23 (ou >= 22 si exclusion legitime documentee dans la PR avec justification).
9. **AC6 - Reduction des violations axe-core** : Given la suite axe-core 2.6.1, when on execute `npm run a11y:axe:check`, then les violations de la regle `aria-required-attr` ou `error-message` (selon ce que axe-core remonte) sont **reduites** sur les parcours qui contiennent ces composants : `p2-recherche.spec.ts` (favoris, signalements), `p4-inscription-checkout.spec.ts` (auth forms), `p6-suppression-rgpd.spec.ts` (delete-account).
10. **AC7 - Verification manuelle 3 echantillons** : Given le volume, when le developpeur teste manuellement, then 3 parcours echantillon sont verifies au lecteur d'ecran :
    - `register-form` : declencher une erreur (email invalide ou mot de passe court) -> entendre l'annonce.
    - `delete-account-button` : declencher une erreur de confirmation -> entendre l'annonce.
    - `contact-form` : declencher une erreur d'envoi -> entendre l'annonce.

## Tasks / Subtasks

- [ ] **Task 1 - Revue cas-par-cas et classification** (AC: #4, #5, #6) - 0,2 j
  - [ ] Sub 1.1 : Grep des 23 fichiers : `grep -rn 'bg-red-50\|text-red-700' components app | sort -u`.
  - [ ] Sub 1.2 : Pour chaque fichier, classifier le bloc erreur :
    - **Type A** : conditionnellement rendu (`{error && <div>...</div>}`) -> `role="alert"`.
    - **Type B** : toujours rendu, contenu mis a jour -> `aria-live="polite"`.
    - **Type C** : erreur attachee a un `<Input>` partage existant -> ne pas dupliquer.
  - [ ] Sub 1.3 : Documenter la classification dans un tableau dans la PR description (23 lignes — fichier, type, decision).

- [ ] **Task 2 - Application mecanique sur les 23 fichiers** (AC: #4, #5) - 0,4 j
  Composants (17) :
  - [ ] Sub 2.1 : `components/auth/register-form.tsx` (verifier Type C — coordination avec `<Input>`).
  - [ ] Sub 2.2 : `components/admin/delete-user-button.tsx`.
  - [ ] Sub 2.3 : `components/admin/validation-actions.tsx`.
  - [ ] Sub 2.4 : `components/admin/departements-manager.tsx`.
  - [ ] Sub 2.5 : `components/admin/annonce-actions.tsx`.
  - [ ] Sub 2.6 : `components/annonce-delete-button.tsx`.
  - [ ] Sub 2.7 : `components/recherche/favori-button.tsx`.
  - [ ] Sub 2.8 : `components/accompagnante/profile-form.tsx`.
  - [ ] Sub 2.9 : `components/accompagnante/onboarding-client.tsx` — **deja prevu en 2.6.3** Task 4. Si 2.6.3 deja merge, ne pas refaire ; sinon, factoriser ici en marquant la sub-task comme « delegue 2.6.3 ».
  - [ ] Sub 2.10 : `components/accompagnante/nouvelle-annonce-form.tsx`.
  - [ ] Sub 2.11 : `components/accompagnante/status-badge.tsx`.
  - [ ] Sub 2.12 : `components/accompagnante/modifier-annonce-form.tsx`.
  - [ ] Sub 2.13 : `components/accompagne/profile-form.tsx`.
  - [ ] Sub 2.14 : `components/accompagne/nouvelle-annonce-form.tsx`.
  - [ ] Sub 2.15 : `components/accompagne/modifier-annonce-form.tsx`.
  - [ ] Sub 2.16 : `components/contact-form.tsx`.
  - [ ] Sub 2.17 : `components/signalement-button.tsx`.

  Pages (6) :
  - [ ] Sub 2.18 : `app/admin/utilisateurs/[id]/page.tsx`.
  - [ ] Sub 2.19 : `app/forgot-password/page.tsx`.
  - [ ] Sub 2.20 : `app/accompagnante/profil/page.tsx`.
  - [ ] Sub 2.21 : `app/accompagnante/dashboard/page.tsx`.
  - [ ] Sub 2.22 : `app/reset-password/page.tsx`.
  - [ ] Sub 2.23 : `app/login/page.tsx` (verifier Type C — coordination avec `<Input>`).

- [ ] **Task 3 - Verification cas redondance Input + bloc global** (AC: #6) - 0,15 j
  - [ ] Sub 3.1 : Pour `register-form.tsx`, `login.tsx`, et tout autre Type C : verifier que **soit** l'erreur est portee par le `<Input>` (champ-specifique), **soit** par un bloc global (form-specifique). Pas les deux pour la meme erreur.
  - [ ] Sub 3.2 : Decision pour les forms qui ont une erreur **globale** (ex. « identifiants incorrects ») et des erreurs **par champ** : le bloc global recoit `role="alert"`, les `<Input>` gardent leur propre annonce. Pas de redondance car les messages sont differents (global vs per-field).

- [ ] **Task 4 - Test manuel VoiceOver sur 3 echantillons** (AC: #7) - 0,15 j
  - [ ] Sub 4.1 : `register-form` : email invalide -> annonce.
  - [ ] Sub 4.2 : `delete-account-button` : confirmation incorrecte -> annonce.
  - [ ] Sub 4.3 : `contact-form` : erreur envoi (simuler en deconnectant le reseau) -> annonce.
  - [ ] Sub 4.4 : Documenter dans la PR description.

- [ ] **Task 5 - Decompte garde-fou + commits** (AC: #5, AC commun #3) - 0,1 j
  - [ ] Sub 5.1 : Executer `grep -rn 'role="alert"' components app | grep -v 'ui/input.tsx' | wc -l` -> verifier >= 23.
  - [ ] Sub 5.2 : Si <  23 : identifier les fichiers manques et completer.
  - [ ] Sub 5.3 : `npm run lint:a11y-check` et `npm run a11y:axe:check` verts.
  - [ ] Sub 5.4 : DoD a11y cochee.
  - [ ] Sub 5.5 : Commit 1 : `Story 2.6.4 : erreurs inline role=alert (23 fichiers)`.
  - [ ] Sub 5.6 : Push, attendre Preview Vercel verte, commit 2 cloture.

## Dev Notes

### Patterns architecturaux

- **`role="alert"` vs `aria-live`** :
  - `role="alert"` = annonce **immediate et atomique**, equivalent a `aria-live="assertive" aria-atomic="true"`. Recommande pour les erreurs **conditionnellement rendues** (apparition d'un bloc qui n'existait pas avant dans le DOM).
  - `aria-live="polite"` = annonce **sans interrompre** la lecture en cours. Recommande pour les erreurs **toujours dans le DOM** dont le contenu change.
- **Anti-pattern a eviter** : `aria-live` sur un container conditionnellement rendu — l'annonce ne se declenche pas au mount (le live region doit exister avant l'apparition du contenu). C'est pour ca qu'on prefere `role="alert"` qui est specifiquement designe pour les erreurs apparaissant.
- **Pas de composant `<ErrorAlert>` central** : decision figee dans le tech-spec (§2.6.4 inventaire). Trop de churn vs marginal benefit. La consigne est mecanique.

### Source tree components a toucher (23 fichiers)

Cf. liste exhaustive dans Task 2 et `inventaire-points-usage-lot-b-2026-05-05.md` §2.6.4.

### Testing standards

- Pas de tests unitaires.
- Spec axe-core : delta documente sur P2, P4, P6.
- 3 verifications VoiceOver manuelles obligatoires.

### Risques identifies

- **R1 - Volume 23 fichiers (multi-fichiers massif)** : pattern derive Lot A 2.5.5 (+33 %). Mitigation : marge integree (effort 1 j vs 0,5 j naïf), garde-fou grep en cloture.
- **R2 - Double annonce Input + bloc global** : Task 3 dedie a la verification cas-par-cas. Si doute, ne pas ajouter `role="alert"` au bloc global et le retraiter en story Lot C.
- **R3 - `aria-live="assertive"` cassant la lecture** : on n'utilise que `role="alert"` (qui implique assertive mais pour erreurs apparaissantes uniquement) ou `aria-live="polite"` pour blocs persistants. Aucun `aria-live="assertive"` direct.

### Project Structure Notes

- Aucun fichier de creation, aucune nouvelle convention. Story 100 % editing.
- Si un fichier de la liste a ete supprime/renomme entre la creation de l'inventaire (2026-05-05) et le demarrage : verifier `git log` et adapter. Le decompte 23 reste contractuel.

### References

- [Source: _bmad-output/implementation-artifacts/tech-spec-lot-b-a11y.md#story-264] — AC contour, garde-fou grep
- [Source: _bmad-output/planning-artifacts/inventaire-points-usage-lot-b-2026-05-05.md#264] — liste exhaustive 23 fichiers, classification
- [Source: _bmad-output/test-artifacts/nfr-assessment-a11y-2026-05-04.md#5.4-actions-recommandees] — critere C2
- [Source: _bmad-output/implementation-artifacts/2-5-5-composant-input-accessible.md] — composant Input avec aria-describedby/aria-invalid (a ne pas dupliquer)
- WAI-ARIA Authoring Practices : alert pattern (https://www.w3.org/WAI/ARIA/apg/patterns/alert/)

## Dev Agent Record

### Agent Model Used

claude-opus-4-7[1m]

### Debug Log References

### Completion Notes List

### File List

## DoD a11y

A renseigner au moment de la PR :

- [ ] Labels associes aux champs (`htmlFor` ou `aria-labelledby`) — N/A pour cette story (couvert Lot A 2.5.5)
- [ ] Erreurs liees aux champs via `aria-describedby` + `aria-invalid` — N/A pour cette story (couvert Lot A 2.5.5) ; erreurs globales via `role="alert"` Task 2
- [ ] Focus visible sur tous les elements interactifs — N/A (pas d'element interactif modifie)
- [ ] Contrastes texte >= 4,5:1 et UI >= 3:1 — heritage Lot A 2.5.3 (les blocs `bg-red-50/text-red-700` ont deja le contraste verifie)
- [ ] ARIA states corrects sur composants dynamiques (`role="alert"`)
- [ ] Navigation clavier complete — N/A (pas de modification clavier)
- [ ] Verification ponctuelle au lecteur d'ecran (VoiceOver) sur 3 echantillons — narratif documente PR
- [ ] Pas de regression `eslint-plugin-jsx-a11y` (`npm run lint:a11y-check` vert en CI)
- [ ] Pas de regression axe-core (`npm run a11y:axe:check` vert ou delta documente — reduction attendue)
- [ ] Decompte garde-fou : `grep -rn 'role="alert"' components app | grep -v 'ui/input.tsx' | wc -l >= 23`
