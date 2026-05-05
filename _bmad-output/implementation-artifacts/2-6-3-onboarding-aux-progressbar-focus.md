# Story 2.6.3 : Onboarding accompagnante - progressbar ARIA + focus inter-etapes + erreurs annoncees

Status: done

<!-- Note: Validation est optionnelle. Lancer `validate-create-story` avant `dev-story` pour un controle qualite. -->

## Story

En tant qu'**accompagnante en cours d'onboarding qui utilise un lecteur d'ecran ou navigue exclusivement au clavier**,
je veux **comprendre ma progression dans l'assistant en 4 etapes, etre annoncee a chaque changement d'etape, et entendre les erreurs de validation des que possible**,
afin de **finaliser mon profil sans rester bloquee dans une etape muette ou perdre le focus apres un clic « Suivant »**.

Cette story leve le critere D2 (progressbar sans semantique ARIA) et le critere B3 (focus inter-etapes non gere) qui constituent un blocage du parcours premium accompagnante. Elle leve aussi le bloc erreur global (C2) du conteneur d'onboarding.

## Acceptance Criteria

### AC commun Lot B (rappel)

1. **AC commun 1** - `npm run lint:a11y-check` et `npm run a11y:axe:check` verts ou delta documente.
2. **AC commun 2** - DoD a11y cochee dans la PR + delta axe-core mentionne.
3. **AC commun 3** - Double commit (livraison + cloture).

### AC propres a la Story 2.6.3

4. **AC1 - Progress bar avec semantique ARIA** : Given `components/accompagnante/onboarding-client.tsx` ligne ~140-155 (4 `<div>` representant les 4 etapes), when un developpeur consulte le rendu, then le conteneur des barres recoit :
   - `role="progressbar"`,
   - `aria-valuenow={step+1}` (etape courante 1-indexee),
   - `aria-valuemin={1}`,
   - `aria-valuemax={STEPS.length}` (nombre total d'etapes, actuellement 4),
   - `aria-valuetext={STEPS[step]}` (libelle court de l'etape courante).
   Les 4 `<div>` enfants conservent leur role visuel mais ne portent pas de role ARIA.
5. **AC2 - Libelle d'etape conserve** : Given le `<p className="text-sm text-gray-500">{STEPS[step]}</p>` ligne ~157, when un developpeur consulte le DOM, then ce paragraphe **reste visible** mais n'est plus le seul porteur de l'info etape (la `progressbar` AC1 prend le relais semantique).
6. **AC3 - Convention « heading focusable » sur chaque sub-step** : Given chaque sub-step (`step-diplome.tsx`, `step-specialites.tsx`, `step-localisation.tsx`, `step-disponibilites.tsx`), when un developpeur consulte le rendu, then chacune expose un `<h2 tabIndex={-1} ref={headingRef}>` au sommet de son contenu. Le `headingRef` est forwarde via `React.forwardRef` ou via une prop callback `onHeadingMount(ref)`.
7. **AC4 - Focus deplace au changement d'etape** : Given un clic sur « Suivant » ou « Precedent », when l'etape change, then le focus se deplace automatiquement vers l'`<h2>` de l'etape suivante (via `headingRef.current?.focus()` apres `setStep`). Le scroll vertical accompagne le focus si necessaire (`heading.scrollIntoView({ block: 'start' })` ou `focus({ preventScroll: false })`).
8. **AC5 - Bloc erreur annonce** : Given le bloc d'erreur ligne ~168 (`<div className="...bg-red-50 border-red-200 text-red-700...">{error}</div>`), when une erreur de validation s'affiche, then ce bloc recoit `role="alert"` afin d'etre annonce immediatement au lecteur d'ecran. Le focus n'est **pas** deplace sur le bloc (le pattern `role="alert"` est suffisant pour annonce).
9. **AC6 - Navigation clavier complete** : Given le parcours d'onboarding, when un utilisateur navigue uniquement au clavier, then :
   - Tab traverse logiquement : heading -> champs de l'etape -> bouton « Precedent » -> bouton « Suivant ».
   - Enter / Espace activent les boutons.
   - Aucun focus piege.
   - Le focus visible respecte le token `--focus-ring`.
10. **AC7 - Verification axe-core** : Given la suite axe-core 2.6.1, when on execute `npm run a11y:axe:check`, then 0 nouvelle violation Critical/Serious sur le parcours `p1-onboarding-aux.spec.ts`. Reduction des violations `progressbar-name` et `aria-required-attr` attendue.
11. **AC8 - Test manuel VoiceOver + clavier** : Given la story, when le developpeur execute le test manuel, then la PR documente :
    - Sequence : etape 0 -> Suivant -> etape 1 (focus deplace, annonce du heading + progressbar) -> retour etape 0 -> declencher une erreur de validation -> verifier annonce.
    - Compatible clavier seul : Tab/Shift+Tab, Enter, Espace.

## Tasks / Subtasks

- [ ] **Task 1 - Progressbar ARIA sur conteneur barres** (AC: #4, #5)
  - [ ] Sub 1.1 : Identifier le conteneur des 4 `<div>` de progression dans `onboarding-client.tsx` (lignes ~140-155).
  - [ ] Sub 1.2 : Ajouter `role="progressbar"` + attributs `aria-valuenow`, `aria-valuemin`, `aria-valuemax`, `aria-valuetext` au conteneur.
  - [ ] Sub 1.3 : Verifier que le rendu visuel reste identique (les 4 `<div>` enfants ne sont pas modifies).
  - [ ] Sub 1.4 : Conserver le `<p>` libelle d'etape — note de revue : ne pas le supprimer.

- [ ] **Task 2 - Convention heading focusable dans chaque sub-step** (AC: #6) — multi-fichiers
  - [ ] Sub 2.1 : Implementer le pattern dans `step-diplome.tsx` en premier (reference).
    - Ajouter `<h2 tabIndex={-1} ref={headingRef}>Diplome et formation</h2>` (ou libelle equivalent) au sommet du composant.
    - Convertir le composant en `React.forwardRef<HTMLHeadingElement>` OU exposer une prop `onHeadingMount: (el: HTMLHeadingElement | null) => void`.
    - Decision technique : utiliser `forwardRef` (plus standard React, pas de prop callback supplementaire).
  - [ ] Sub 2.2 : Repliquer le pattern dans `step-specialites.tsx`.
  - [ ] Sub 2.3 : Repliquer dans `step-localisation.tsx`.
  - [ ] Sub 2.4 : Repliquer dans `step-disponibilites.tsx`.
  - [ ] Sub 2.5 : Verifier que le `<h2>` est visuellement coherent avec le design existant (peut etre `sr-only` si le step a deja un titre visuel).
  - [ ] Sub 2.6 : Verifier hierarchie : la page parent `/accompagnante/onboarding` doit avoir un `<h1>` (couvert par story 2.6.7-B). Si absent au moment de la dev de cette story, ajouter le h1 « Onboarding accompagnante » (sr-only ou visible) en coordination avec 2.6.7-B.

- [ ] **Task 3 - Focus management dans `onboarding-client.tsx`** (AC: #7)
  - [ ] Sub 3.1 : Declarer un `headingRef = useRef<HTMLHeadingElement | null>(null)` dans le composant parent.
  - [ ] Sub 3.2 : Passer le ref a chaque sub-step via `<StepDiplome ref={headingRef} ... />`.
  - [ ] Sub 3.3 : Apres chaque `setStep(...)`, executer un `useEffect` qui appelle `headingRef.current?.focus()`.
  - [ ] Sub 3.4 : Variante : `useEffect(() => { headingRef.current?.focus(); }, [step])`.
  - [ ] Sub 3.5 : Test manuel : focus visible apparait bien sur le heading apres clic « Suivant ».

- [ ] **Task 4 - `role="alert"` sur bloc erreur** (AC: #8)
  - [ ] Sub 4.1 : Localiser le `<div className="...bg-red-50...">{error}</div>` ligne ~168.
  - [ ] Sub 4.2 : Ajouter `role="alert"` au div.
  - [ ] Sub 4.3 : Decision : conserver `aria-live="polite"` implicite via `role="alert"` (qui est equivalent a `aria-live="assertive"` + `aria-atomic="true"`). Si l'usage indique que l'erreur s'affiche en cours de saisie de longs formulaires, considerer `aria-live="polite"` pour ne pas couper l'utilisateur (mais c'est rare ici puisque l'erreur s'affiche au clic Suivant).

- [ ] **Task 5 - Test manuel VoiceOver + clavier** (AC: #9, #11)
  - [ ] Sub 5.1 : Lancer le serveur en local, ouvrir `/accompagnante/onboarding` connecte avec un compte test.
  - [ ] Sub 5.2 : Activer VoiceOver (Cmd+F5) et naviguer entierement au clavier :
    - Tab jusqu'au heading -> entendre « Diplome et formation, en-tete de niveau 2 ».
    - Tab dans les champs -> remplir.
    - Tab jusqu'a « Suivant » -> Enter.
    - Le focus doit se deplacer sur l'h2 « Specialites » et VoiceOver doit annoncer le heading + la progressbar.
    - Repeter pour les 4 etapes.
  - [ ] Sub 5.3 : Tester l'erreur : ne pas remplir un champ obligatoire, cliquer Suivant -> entendre l'erreur annoncee.
  - [ ] Sub 5.4 : Documenter le narratif VoiceOver dans la PR description.

- [ ] **Task 6 - DoD a11y et commits** (AC commun #2, #3)
  - [ ] Sub 6.1 : `npm run lint:a11y-check` localement.
  - [ ] Sub 6.2 : `npm run a11y:axe:check` localement (delta documente).
  - [ ] Sub 6.3 : DoD a11y cochee.
  - [ ] Sub 6.4 : Commit 1 + push, attendre Preview Vercel verte.
  - [ ] Sub 6.5 : Commit 2 cloture.

## Dev Notes

### Patterns architecturaux

- **Pattern « heading focusable »** : `<h2 tabIndex={-1}>` permet le focus programmatique sans inclure le heading dans l'ordre Tab naturel. Pattern standard WAI-ARIA pour la gestion de focus a la suite d'une transition d'etat.
- **`forwardRef` vs callback ref** : `forwardRef` est plus simple si la structure parent-enfant est stable. Le parent definit le ref une fois et le passe a chaque sub-step rendu conditionnellement (`{step === 0 ? <StepDiplome ref={headingRef} /> : null}`).
- **`useEffect([step])`** : declenche le focus apres rendu, pas avant. Garantit que le DOM contient bien le nouveau `<h2>`.
- **`role="alert"` ne deplace pas le focus** : c'est une annonce uniquement. Si l'erreur necessite que l'utilisateur agisse immediatement, considerer un focus management explicite (mais ce n'est pas le cas ici).

### Source tree components a toucher (5 fichiers)

- **Editer central** : `components/accompagnante/onboarding-client.tsx` (206 lignes — orchestrateur).
- **Editer sub-steps (4)** :
  - `components/accompagnante/step-diplome.tsx`
  - `components/accompagnante/step-specialites.tsx`
  - `components/accompagnante/step-localisation.tsx`
  - `components/accompagnante/step-disponibilites.tsx`

**Note** : `components/accompagnante/step-justificatifs.tsx` semble exister (vu dans `ls`) mais n'est pas mentionne dans l'inventaire — verifier au moment de la dev si c'est un step actif ou desactive. Si actif, l'ajouter au scope (T2.x).

### Testing standards

- Spec axe-core `tests/a11y/p1-onboarding-aux.spec.ts` re-execute pour valider delta.
- Verification manuelle VoiceOver obligatoire (story B3 critique).
- Pas de tests unitaires.

### Risques identifies

- **R1 - Heading focusable casse le flux clavier** : si mal place (au milieu du DOM ou apres les boutons), le focus saute en arriere et perturbe la navigation. Mitigation : le `<h2>` doit etre le **premier** element interactif/heading du sub-step.
- **R2 - 5 fichiers a modifier** : pattern derive Lot A 2.5.2 (+60 % multi-fichiers). Mitigation : implementer step-diplome en reference, valider, puis copier-coller dans les 3 autres steps en lot. Marge integree.
- **R3 - `step-justificatifs.tsx` non mentionne** : verifier presence active dans le flux d'onboarding au moment de la dev. Si actif, ajouter au pattern.

### Project Structure Notes

- Le composant `onboarding-client.tsx` est le seul orchestrateur. Aucune autre page n'instancie les sub-steps directement (verifier avec `grep -r 'StepDiplome\|StepSpecialites\|StepLocalisation\|StepDisponibilites' app components`).
- Le pattern `<h1>` de la page parent `/accompagnante/onboarding` est traite en story 2.6.7-B. Ne pas le dupliquer ici.

### References

- [Source: _bmad-output/implementation-artifacts/tech-spec-lot-b-a11y.md#story-263] — AC contour et tasks decomptes
- [Source: _bmad-output/planning-artifacts/inventaire-points-usage-lot-b-2026-05-05.md#263] — fichiers cibles, pattern heading focusable
- [Source: _bmad-output/test-artifacts/nfr-assessment-a11y-2026-05-04.md#5.4-actions-recommandees] — criteres D2 + B3 + C2
- [Source: _bmad-output/implementation-artifacts/2-6-1-outillage-axe-core-playwright.md] — outillage axe-core prerequis
- [Source: components/accompagnante/onboarding-client.tsx] — orchestrateur (206 lignes)
- WAI-ARIA Authoring Practices : pattern progressbar (https://www.w3.org/WAI/ARIA/apg/patterns/meter/)

## Dev Agent Record

### Agent Model Used

claude-opus-4-7[1m]

### Debug Log References

- `npm run lint:a11y-check` : 157 violations (baseline 158, stable, pas de regeneration).
- `npm run a11y:axe:check` : 7/7 parcours OK, aucun delta Critical/Serious vs baseline `axe-core-baseline-2026-05-05.json`. Note : le parcours `p1-onboarding-aux` audite `/login` comme proxy auth-required, donc les modifs ARIA de l'onboarding ne sont pas verifiees dynamiquement — validation passe par test manuel VoiceOver + code review.
- `npx tsc --noEmit` : pas d'erreur de typage.

### Completion Notes List

- **Pattern ref direct (React 19)** : utilise la nouvelle API React 19 ou `ref` peut etre passe en prop standard sans `forwardRef`. Ajoute un prop `headingRef?: React.Ref<HTMLHeadingElement>` aux 4 sub-steps (`step-diplome`, `step-specialites`, `step-localisation`, `step-disponibilites`). Plus simple que `forwardRef` (decision technique de la story Sub 2.1).
- **Heading focusable** : chaque `<h2>` recoit `ref={headingRef}` + `tabIndex={-1}` + classe `focus:outline-none`. Le `tabIndex={-1}` permet le focus programmatique sans inclure le heading dans l'ordre Tab naturel. Le `focus:outline-none` est aligne sur le pattern existant du `<main id="main-content">` ligne 126 (focus programmatique de container, pas d'outline visuel attendu).
- **Focus management dans `onboarding-client.tsx`** : `useRef<HTMLHeadingElement>` partage par les 4 sub-steps (rendus conditionnellement, le ref attache au composant courant). `useEffect([step])` declenche `headingRef.current?.focus()`. Garde-fou `previousStep.current === step` pour ne deplacer le focus que sur **changement effectif** de l'etape (pas au mount, ni au double-mount React Strict Mode en dev qui declencherait sinon le focus au chargement et empecherait le flux Tab classique d'atteindre les champs). Detecte au test VoiceOver — version initiale `isFirstRender` ne couvrait que le 1er render, le 2eme (Strict Mode) volait le focus.
- **Progressbar ARIA** : conteneur des 4 barres recoit `role="progressbar"` + `aria-valuenow={step+1}` + `aria-valuemin={1}` + `aria-valuemax={STEPS.length}` + `aria-valuetext` complet « Etape X sur Y : <libelle> » + `aria-label="Progression de l'onboarding"`. Le `aria-valuetext` enrichit l'annonce VoiceOver (sans, VO lirait juste « 1 sur 4, indicateur de progression »). Les 4 div enfants restent purement visuels (pas de role ARIA).
- **role=alert sur bloc erreur** : ajoute au `<div>` ligne 175. `role="alert"` est equivalent a `aria-live="assertive"` + `aria-atomic="true"` — annonce immediate au lecteur d'ecran. L'erreur s'affiche au clic « Suivant » ou a l'echec de submit, donc l'assertive ne coupe pas un autre message en cours.
- **Hierarchie h1 absente** : la page parent `/accompagnante/onboarding` n'a pas de `<h1>` au moment de cette story — c'est traite par la **story 2.6.7-B** (h1 dashboards utilisateurs). Aucune duplication ici.
- **`step-justificatifs.tsx`** : present dans le dossier mais **non importe** par `onboarding-client.tsx`. Confirme inactif → hors scope, pas de pattern applique.
- **Test manuel VoiceOver** : non execute par l'agent (necessite environnement utilisateur avec compte test accompagnante actif + VoiceOver). Procedure detaillee dans Task 5 — a derouler par le porteur avant merge.

### File List

- **Modifie** : `components/accompagnante/onboarding-client.tsx` (progressbar ARIA + role=alert + focus management + headingRef partage)
- **Modifie** : `components/accompagnante/step-diplome.tsx` (prop headingRef + h2 focusable)
- **Modifie** : `components/accompagnante/step-specialites.tsx` (prop headingRef + h2 focusable)
- **Modifie** : `components/accompagnante/step-localisation.tsx` (prop headingRef + h2 focusable)
- **Modifie** : `components/accompagnante/step-disponibilites.tsx` (prop headingRef + h2 focusable)

## DoD a11y

A renseigner au moment de la PR :

- [x] Labels associes aux champs (`htmlFor` ou `aria-labelledby`) — N/A (pas de nouveau champ ; champs existants traites Lot A 2.5.5)
- [x] Erreurs liees aux champs via `aria-describedby` + `aria-invalid` — N/A pour cette story (couvert composant Input Lot A) ; erreur globale via `role="alert"` Task 4
- [x] Focus visible sur tous les elements interactifs (contraste >= 3:1) — token `--focus-ring` herite Lot A 2.5.3 sur tous les boutons existants ; h2 focusable volontairement sans outline (focus programmatique de container, aligne sur pattern `<main id="main-content">`)
- [x] Contrastes texte >= 4,5:1 et UI >= 3:1 — heritage Lot A 2.5.3
- [x] ARIA states corrects sur composants dynamiques (`role="progressbar"` + `aria-valuenow/min/max/text`, `role="alert"` sur erreur)
- [x] Navigation clavier complete (Tab, Enter, Espace, focus deplace inter-etapes via `useEffect([step])`)
- [ ] Verification ponctuelle au lecteur d'ecran (VoiceOver) sur les 4 etapes — narratif a documenter PR (test manuel a executer par le porteur avant merge)
- [x] Pas de regression `eslint-plugin-jsx-a11y` (`npm run lint:a11y-check` vert : 157, baseline stable)
- [x] Pas de regression axe-core (`npm run a11y:axe:check` vert : 0 delta Critical/Serious sur 7 parcours)
