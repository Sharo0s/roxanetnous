# Story 2.6.6 : Audit Leaflet et alternative clavier (composant tiers)

Status: ready-for-dev

<!-- Note: Validation est optionnelle. Lancer `validate-create-story` avant `dev-story` pour un controle qualite. -->

## Story

En tant qu'**utilisateur de lecteur d'ecran ou utilisateur clavier qui consulte une page utilisant le composant carte Leaflet (recherche, onboarding aux etape localisation, formulaires d'annonce)**,
je veux **soit pouvoir interagir au clavier avec la carte, soit avoir une alternative non-visuelle (les champs ville/rayon) qui me permet d'atteindre le meme resultat**,
afin de **ne pas etre exclu d'une fonctionnalite cle (definition de la zone d'intervention) parce que je ne peux pas manipuler la souris ou voir la carte**.

Cette story leve le critere D4 (composants tiers) du NFR a11y transverse. Elle est **time-boxee a 1 j** : si l'audit revele des problemes structurels Leaflet qui depassent ce budget, repli automatique sur strategie 2 (`aria-hidden` + alternative textuelle).

## Acceptance Criteria

### AC commun Lot B (rappel)

1. **AC commun 1** - `npm run lint:a11y-check` et `npm run a11y:axe:check` verts ou delta documente.
2. **AC commun 2** - DoD a11y cochee + delta axe-core mentionne.
3. **AC commun 3** - Double commit (livraison + cloture).

### AC propres a la Story 2.6.6

4. **AC1 - Audit ecrit Leaflet** : Given le composant `components/ui/map-radius-inner.tsx`, when le developpeur execute l'audit (0,3 j max), then un document `_bmad-output/test-artifacts/leaflet-a11y-audit-2026-05-XX.md` est genere et liste :
   - Tests effectues : navigation clavier (Tab, Shift+Tab, fleches, Enter), VoiceOver sur la carte, inspection DOM Leaflet.
   - Constats : focus piege ? annonces ARIA polluantes ? attributs natifs Leaflet (boutons zoom, attribution) ? markers focusables ?
   - Verdict : carte exploitable au clavier ? VoiceOver-friendly ?
5. **AC2 - Decision strategique documentee** : Given l'audit AC1, when le developpeur prend la decision (0,1 j), then le document audit conclut sur l'une des deux strategies :
   - **Strategie 1 (carte interactive)** : `aria-label="Carte de la zone d'intervention"` sur le conteneur Leaflet + alternative clavier confirmee via les champs ville/rayon presents dans les formulaires usagers (suffisants pour atteindre le meme resultat sans la carte).
   - **Strategie 2 (carte neutralisee)** : `aria-hidden="true"` sur le conteneur Leaflet + alternative textuelle adjacente (« Carte indicative — utilisez les champs de localisation ci-dessus pour ajuster »).
   La decision prend en compte les contraintes de la time-box (Strategie 1 = 0,3 j d'implementation max, Strategie 2 = 0,15 j).
6. **AC3 - Implementation strategie choisie** : Given la decision AC2, when le developpeur implemente (0,3 j max — Strategie 1, ou 0,15 j — Strategie 2), then `components/ui/map-radius-inner.tsx` (et possiblement `components/ui/map-radius.tsx` wrapper) sont modifies en consequence.
7. **AC4 - 5 usagers heritent automatiquement** : Given les 5 composants qui instancient `map-radius-inner.tsx` ou `map-radius.tsx` (cf. inventaire), when un developpeur consulte le rendu de chacun, then la decision strategique est correctement propagee :
   - `components/accompagnante/profile-form.tsx`
   - `components/accompagnante/nouvelle-annonce-form.tsx`
   - `components/accompagnante/step-localisation.tsx`
   - `components/accompagnante/modifier-annonce-form.tsx`
   - `components/accompagne/nouvelle-annonce-form.tsx`
   Aucun de ces 5 fichiers ne doit avoir besoin de modification autre que verification (le composant heritant des changements automatiquement).
8. **AC5 - Verification axe-core** : Given la suite axe-core 2.6.1, when on execute `npm run a11y:axe:check`, then le composant Leaflet n'introduit plus de violation Critical/Serious sur `p2-recherche.spec.ts` (qui utilise la carte indirectement) et autres parcours qui l'utilisent.
9. **AC6 - Test manuel VoiceOver + clavier** : Given une page utilisant la carte (`/accompagnante/onboarding` etape localisation, ou `/recherche` selon le parcours qui rend Leaflet directement), when le developpeur teste, then :
   - **Strategie 1** : la carte est annoncee « Carte de la zone d'intervention » et l'utilisateur peut soit interagir (si Leaflet le permet en clavier sans focus piege) soit utiliser les champs alternatifs.
   - **Strategie 2** : la carte est completement ignoree par le lecteur d'ecran, les champs ville/rayon prennent le relais, le texte alternatif est annonce.
10. **AC7 - Hors scope refonte ergonomique** : Given que cette story est time-boxee, when le developpeur identifie un besoin de refonte profonde (ajout markers focusables, panel de controle clavier custom, etc.), then ce besoin est **documente comme report Lot C** dans le document audit, pas implemente.
11. **AC8 - Resorption violation `select-name` heritee 2.6.1** : Given le baseline axe-core 2026-05-05 contient 1 violation Critical `select-name` sur `/recherche` (target `select`, dans `components/recherche/search-filters.tsx:182` et/ou `app/recherche/page.tsx:281` — selects « Experience » et « Annonce de reference »), when la story 2.6.6 livre, then cette violation est resorbee (label associe via `htmlFor` + `id`, ou `aria-label` explicite). Le baseline est regenere et le total Critical/Serious passe a 0 sur P2. **Cette violation doit etre resorbee avant cloture Lot B** — c'est un pre-requis a la bascule de `a11y:axe:check` en mode bloquant (story de cloture Lot B).

## Tasks / Subtasks

- [ ] **Task 1 - Audit Leaflet** (AC: #4) - 0,3 j
  - [ ] Sub 1.1 : Executer le projet en local (`npm run dev`) et naviguer vers une page qui rend Leaflet (par ex. `/accompagnante/onboarding` etape localisation).
  - [ ] Sub 1.2 : Tester clavier seul : Tab dans la carte, Shift+Tab pour sortir, fleches (zoom/pan), Enter (selection point).
  - [ ] Sub 1.3 : Tester VoiceOver : entendre comment la carte est annoncee, comment les boutons zoom/attribution Leaflet sont prononces.
  - [ ] Sub 1.4 : Inspecter le DOM Leaflet : presence de `<button>` natifs, `aria-*` attributs, focus traps eventuels, role implicite du conteneur.
  - [ ] Sub 1.5 : Rediger `_bmad-output/test-artifacts/leaflet-a11y-audit-2026-05-XX.md` (date du jour de la dev) : 1-2 pages, sections constats / verdict / recommandation strategique.

- [ ] **Task 2 - Decision strategique** (AC: #5) - 0,1 j
  - [ ] Sub 2.1 : Selon les constats Task 1, choisir Strategie 1 ou 2.
  - [ ] Sub 2.2 : Critere de decision (suggestion) :
    - Si Leaflet n'a **aucun** focus piege ni annonce polluante -> Strategie 1.
    - Si Leaflet a un focus piege ou des dizaines de boutons annonces sans label clair -> Strategie 2.
  - [ ] Sub 2.3 : Documenter la decision et la justification dans le document audit (paragraphe « Decision »).

- [ ] **Task 3 - Implementation strategie** (AC: #6) - 0,3 j (Strategie 1) ou 0,15 j (Strategie 2)
  - [ ] Sub 3.1 (Strategie 1) : Ajouter `aria-label="Carte de la zone d'intervention"` au conteneur Leaflet (probablement via prop ou attribut sur la `<div>` qui recoit Leaflet).
  - [ ] Sub 3.2 (Strategie 1) : Verifier qu'un texte adjacent ou un label de form mentionne « Vous pouvez aussi utiliser les champs ville et rayon ci-dessous » pour orienter les utilisateurs clavier.
  - [ ] Sub 3.3 (Strategie 2) : Ajouter `aria-hidden="true"` au conteneur Leaflet.
  - [ ] Sub 3.4 (Strategie 2) : Ajouter un texte alternatif adjacent visible : « Carte indicative — utilisez les champs de localisation ci-dessus pour ajuster ».
  - [ ] Sub 3.5 : Si Strategie 1 et que la time-box deborde au mid-point (>= 0,4 j d'implementation), basculer Strategie 2 et documenter le repli dans la PR.

- [ ] **Task 4 - Verification 5 usagers** (AC: #7) - 0,1 j
  - [ ] Sub 4.1 : Pour chaque fichier listé en AC4, naviguer vers la page qui le rend (ou lire le code si pas de UI directe) et confirmer que le composant Leaflet herite correctement.
  - [ ] Sub 4.2 : Aucune modification a faire sauf ajustement du texte alternatif si le contexte d'usage le requiert (ex. `step-localisation.tsx` peut avoir un texte specifique).

- [ ] **Task 5 - Test manuel VoiceOver + clavier** (AC: #9) - 0,15 j
  - [ ] Sub 5.1 : Au moins 1 page testee en VoiceOver (recommandation : `/accompagnante/onboarding` etape localisation).
  - [ ] Sub 5.2 : Documenter le narratif VoiceOver dans la PR description.

- [ ] **Task 6 - DoD a11y et commits** (AC commun #2, #3) - 0,05 j
  - [ ] Sub 6.1 : `npm run lint:a11y-check` et `npm run a11y:axe:check` verts (delta documente).
  - [ ] Sub 6.2 : DoD a11y cochee.
  - [ ] Sub 6.3 : Commit 1 + push, attendre Preview Vercel verte, commit 2 cloture.

- [ ] **Task 7 - Resorption violation `select-name` /recherche heritee 2.6.1** (AC: #11) - 0,1 j
  - [ ] Sub 7.1 : Identifier le(s) `<select>` fautif(s) sur `/recherche` :
    - `components/recherche/search-filters.tsx:182` : `<select>` « Experience », `<label>` parent en frere (pas wrappant) sans `htmlFor`/`id`.
    - `app/recherche/page.tsx:281` : `<select name="annonce">` « Annonce de reference », `<label>` en frere sans `htmlFor`/`id`.
  - [ ] Sub 7.2 : Corriger en associant chaque `<label>` a son `<select>` via `htmlFor`/`id` explicite, ou en wrappant le `<select>` dans le `<label>` (label implicite). Pas d'`aria-label` standalone (decision Lot A : prefere les labels visibles natifs).
  - [ ] Sub 7.3 : Regenerer le baseline (`npm run a11y:axe:baseline`), verifier que `totals.violations` passe de 1 a 0 sur P2.
  - [ ] Sub 7.4 : Documenter la regen baseline dans la PR (delta : -1 violation Critical `select-name`).

## Dev Notes

### Patterns architecturaux

- **`aria-label` sur conteneur Leaflet** : Strategie 1 minimaliste. L'utilisateur entend que c'est une carte sans details. Pour aller plus loin, il faudrait un panel de description dynamique des coordonnees, ce qui est hors scope time-box.
- **`aria-hidden="true"` + alternative textuelle** : Strategie 2 conservatrice. Plus simple et plus sure, mais perd l'interactivite carte pour les lecteurs d'ecran.
- **Pas de modification de la logique geocoding** : `map-radius.tsx` (1.3K) wrap le geocoding ; on ne touche pas a la logique fetch, uniquement aux attributs ARIA du DOM rendu.

### Source tree components a toucher (2 fichiers principaux + 5 verifications)

- **Editer** : `components/ui/map-radius-inner.tsx` (57 lignes — composant Leaflet rendu cote client).
- **Editer eventuellement** : `components/ui/map-radius.tsx` (35 lignes — wrapper geocoding) si le texte alternatif doit etre dans le wrapper plutot que dans l'inner.
- **Verifier (lecture seule)** : 5 usagers listes en AC4. Aucune modification attendue sauf cas marginal.

### Testing standards

- Pas de tests unitaires.
- Document audit ecrit en livrable.
- Spec axe-core re-execute (P2 et eventuellement autres si Leaflet est rendu sur d'autres parcours).
- VoiceOver manuel obligatoire.

### Risques identifies

- **R1 - Audit Leaflet revele des problemes structurels** (focus piege, dizaines de boutons polluants) qui depassent le budget time-box. Mitigation : repli automatique Strategie 2.
- **R2 - 5 usagers ne se comportent pas tous pareil** : `step-localisation.tsx` peut avoir besoin d'un texte alternatif specifique. Verification individuelle Task 4.
- **R3 - Refonte ergonomique demandee** : reportee Lot C explicitement (AC7 garde-fou).

### Dette heritee story 2.6.1

La story 2.6.1 a livre un baseline axe-core avec **1 violation Critical `select-name`** sur `/recherche` (selects « Experience » et « Annonce de reference », labels en frere sans `htmlFor`/`id`). Cette violation **doit etre resorbee avant cloture Lot B** (pre-requis bascule `a11y:axe:check` bloquant). Couverte par la nouvelle Task 7 ci-dessus. Sources : `components/recherche/search-filters.tsx:182`, `app/recherche/page.tsx:281`.

### Project Structure Notes

- Le composant Leaflet est dynamiquement importe (probablement via `next/dynamic` car Leaflet ne supporte pas SSR). Verifier que les modifications ARIA s'appliquent bien au rendu cote client.

### References

- [Source: _bmad-output/implementation-artifacts/tech-spec-lot-b-a11y.md#story-266] — AC contour, time-box, repli
- [Source: _bmad-output/planning-artifacts/inventaire-points-usage-lot-b-2026-05-05.md#266] — fichiers cibles, 5 usagers, decisions strategique
- [Source: _bmad-output/test-artifacts/nfr-assessment-a11y-2026-05-04.md#5.4-actions-recommandees] — critere D4
- [Source: components/ui/map-radius-inner.tsx] — composant Leaflet (57 lignes)
- [Source: components/ui/map-radius.tsx] — wrapper geocoding (35 lignes)
- Leaflet a11y community thread (https://github.com/Leaflet/Leaflet/issues/3210) — contexte general

## Dev Agent Record

### Agent Model Used

claude-opus-4-7[1m]

### Debug Log References

### Completion Notes List

### File List

## DoD a11y

A renseigner au moment de la PR :

- [ ] Labels associes aux champs (`htmlFor` ou `aria-labelledby`) — N/A pour cette story (champs ville/rayon traites Lot A 2.5.5)
- [ ] Erreurs liees aux champs via `aria-describedby` + `aria-invalid` — N/A
- [ ] Focus visible sur tous les elements interactifs — verifier que les boutons zoom Leaflet (si Strategie 1) ont un focus visible ; sinon (Strategie 2 `aria-hidden`) N/A
- [ ] Contrastes texte >= 4,5:1 et UI >= 3:1 — verifier le contraste du texte alternatif si Strategie 2
- [ ] ARIA states corrects sur composants dynamiques (`aria-label` ou `aria-hidden` selon strategie)
- [ ] Navigation clavier complete — verifier (Strategie 1) ou N/A (Strategie 2 — alternative via champs ville/rayon)
- [ ] Verification ponctuelle au lecteur d'ecran (VoiceOver) sur 1 page Leaflet — narratif documente PR
- [ ] Pas de regression `eslint-plugin-jsx-a11y` (`npm run lint:a11y-check` vert en CI)
- [ ] Pas de regression axe-core (`npm run a11y:axe:check` vert ou delta documente)
- [ ] Document audit Leaflet livre (`_bmad-output/test-artifacts/leaflet-a11y-audit-2026-05-XX.md`)
