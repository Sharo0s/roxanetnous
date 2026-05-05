# Story 2.6.5 : Carte hero - alternative textuelle visible (zone de couverture)

Status: ready-for-dev

<!-- Note: Validation est optionnelle. Lancer `validate-create-story` avant `dev-story` pour un controle qualite. -->

## Story

En tant que **visiteur de la landing page (avec ou sans lecteur d'ecran)**,
je veux **comprendre la zone geographique couverte par roxanetnous sans avoir a interpreter visuellement la carte SVG animee**,
afin de **savoir immediatement si le service est disponible dans ma region**.

Cette story leve le critere A3 (alternatives textuelles aux contenus non-textuels) sur le composant central de la landing page. **Decision Project Lead 2026-05-05** : le texte equivalent est **visible** (pas `sr-only`) — la carte est centrale a la landing page et l'information de couverture geographique a une valeur pour tous les utilisateurs.

## Acceptance Criteria

### AC commun Lot B (rappel)

1. **AC commun 1** - `npm run lint:a11y-check` et `npm run a11y:axe:check` verts ou delta documente.
2. **AC commun 2** - DoD a11y cochee + delta axe-core mentionne.
3. **AC commun 3** - Double commit (livraison + cloture).

### AC propres a la Story 2.6.5

4. **AC1 - Texte equivalent visible adjacent au SVG** : Given le composant `components/landing/hero-carte.tsx` (ou le parent landing page qui l'instancie), when un visiteur consulte la page, then un texte equivalent **visible** decrit la zone de couverture geographique, adjacent au SVG. Format suggere (a affiner au moment de la dev avec validation rapide design) :
   - Sous-titre court : « Notre service couvre la Bretagne » (concis), OU
   - Liste de villes principales : « Disponible a Rennes, Brest, Lorient, Vannes, Saint-Brieuc, Quimper et alentours. »
   La forme finale est validee dans la PR description avec un screenshot.
5. **AC2 - SVG conserve `aria-hidden="true"`** : Given le SVG est decoratif (le texte adjacent porte le sens), when un developpeur consulte le DOM, then le `<svg>` reste avec `aria-hidden="true"` et `role="presentation"` ou `role="img"` selon convention existante. **Note** : si l'audit revele que le SVG actuel a un `<title>` ou un `aria-label`, conserver ou remplacer selon la decision finale (privilegier `aria-hidden="true"` si le texte adjacent est explicite).
6. **AC3 - Pas de regression `prefers-reduced-motion`** : Given le composant utilise des animations conditionnelles via `prefers-reduced-motion` (Lot A 2.5.4), when un developpeur modifie le composant, then ce comportement n'est pas casse. L'ajout du texte adjacent ne touche pas a la logique d'animation.
7. **AC4 - Verification axe-core** : Given la suite axe-core 2.6.1, when on execute `npm run a11y:axe:check`, then 0 nouvelle violation Critical/Serious sur `p5-landing.spec.ts`. Reduction de la violation `image-alt` ou `svg-img-alt` attendue.
8. **AC5 - Test rapide VoiceOver landing** : Given le visiteur navigue avec VoiceOver sur `/`, when il atteint la zone de la carte, then il entend le texte equivalent (et **non** le SVG, qui est `aria-hidden`). Documenter le narratif VoiceOver dans la PR description.

## Tasks / Subtasks

- [ ] **Task 1 - Lecture composant + decision design** (AC: #4) - 0,05 j
  - [ ] Sub 1.1 : Lire `components/landing/hero-carte.tsx` (299 lignes — comprendre la structure SVG actuelle).
  - [ ] Sub 1.2 : Identifier le parent qui l'instancie (`app/page.tsx` ou un composant intermediaire).
  - [ ] Sub 1.3 : Decision sur la forme du texte (sous-titre court vs liste de villes) — **a valider avec utilisateur si doute**, sinon adopter le sous-titre court par defaut.

- [ ] **Task 2 - Implementation** (AC: #4, #5) - 0,15 j
  - [ ] Sub 2.1 : Ajouter le texte equivalent visible **adjacent** au SVG (au-dessus, en-dessous, ou a cote selon le layout responsive). Coordonner avec design pour ne pas alterer la composition visuelle.
  - [ ] Sub 2.2 : Conserver `aria-hidden="true"` sur le `<svg>` (verifier presence ; si absent, ajouter).
  - [ ] Sub 2.3 : Verifier que le composant `hero-carte.tsx` n'introduit pas de regression sur `prefers-reduced-motion`.

- [ ] **Task 3 - Test rapide VoiceOver + commits** (AC: #5, AC commun #3) - 0,05 j
  - [ ] Sub 3.1 : VoiceOver sur `/` -> verifier que le texte adjacent est annonce.
  - [ ] Sub 3.2 : `npm run lint:a11y-check` et `npm run a11y:axe:check` verts.
  - [ ] Sub 3.3 : DoD a11y cochee.
  - [ ] Sub 3.4 : Commit 1 + push, attendre Preview Vercel verte, commit 2 cloture.

## Dev Notes

### Patterns architecturaux

- **SVG decoratif vs informatif** : si le texte adjacent porte le sens, le SVG est **decoratif** (`aria-hidden="true"`). Si le SVG portait le sens et qu'on n'avait pas de texte adjacent, on aurait du soit ajouter un `<title>` interne, soit `role="img"` + `aria-label`. La decision projet : decoratif + texte visible adjacent.
- **`prefers-reduced-motion`** : la carte utilise des animations infinies conditionnees a la media query. La modification de cette story **ne doit pas** modifier cette logique.

### Source tree components a toucher (1 fichier principal + eventuellement 1 parent)

- **Editer** : `components/landing/hero-carte.tsx`.
- **Editer eventuellement** : le parent qui instancie le composant (probablement `app/page.tsx`) si le texte adjacent doit etre dans le contexte du parent plutot que dans le composant lui-meme. Decision a prendre au moment de la dev selon la composition.

### Testing standards

- Pas de tests unitaires.
- Spec `tests/a11y/p5-landing.spec.ts` re-execute pour valider delta.
- VoiceOver rapide.

### Risques identifies

- **R1 - Validation design** : si le texte adjacent altere la composition visuelle de la landing, retomber sur un placement discret (sous le titre principal, par exemple). Pas de risque structurel.
- **R2 - Story tres rapide (0,25 j)** : risque d'oublier l'AC sur `prefers-reduced-motion` (regression Lot A). Mitigation : verification explicite Sub 2.3.

### Project Structure Notes

- Composant isole, faible couplage. Aucune dependance avec d'autres stories Lot B.

### References

- [Source: _bmad-output/implementation-artifacts/tech-spec-lot-b-a11y.md#story-265] — AC contour, decision Project Lead
- [Source: _bmad-output/planning-artifacts/inventaire-points-usage-lot-b-2026-05-05.md#265] — fichier cible, decision visible vs sr-only
- [Source: _bmad-output/test-artifacts/nfr-assessment-a11y-2026-05-04.md#5.4-actions-recommandees] — critere A3
- [Source: _bmad-output/implementation-artifacts/2-5-4-prefers-reduced-motion.md] — logique animation conditionnelle a preserver
- [Source: components/landing/hero-carte.tsx] — composant a modifier (299 lignes)
- Memoire projet : [Carte SVG landing page](/Users/sylvain/.claude/projects/-Users-sylvain-Documents-roxanetnous/memory/project_hero_carte.md) — implementation actuelle

## Dev Agent Record

### Agent Model Used

claude-opus-4-7[1m]

### Debug Log References

### Completion Notes List

### File List

## DoD a11y

A renseigner au moment de la PR :

- [ ] Labels associes aux champs (`htmlFor` ou `aria-labelledby`) — N/A
- [ ] Erreurs liees aux champs via `aria-describedby` + `aria-invalid` — N/A
- [ ] Focus visible sur tous les elements interactifs — N/A (pas d'element interactif modifie)
- [ ] Contrastes texte >= 4,5:1 et UI >= 3:1 — verifier que le texte adjacent respecte le contraste sur le fond de la landing
- [ ] ARIA states corrects sur composants dynamiques — `aria-hidden="true"` sur le SVG verifie
- [ ] Navigation clavier complete — N/A
- [ ] Verification ponctuelle au lecteur d'ecran (VoiceOver) sur `/` — narratif documente PR
- [ ] Pas de regression `eslint-plugin-jsx-a11y` (`npm run lint:a11y-check` vert en CI)
- [ ] Pas de regression axe-core (`npm run a11y:axe:check` vert ou delta documente)
- [ ] Pas de regression `prefers-reduced-motion` — verifier explicitement
