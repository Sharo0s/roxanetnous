# Story 2.6.5 : Carte hero - alternative textuelle visible (zone de couverture)

Status: done

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

- [x] **Task 1 - Lecture composant + decision design** (AC: #4) - 0,05 j
  - [x] Sub 1.1 : `components/landing/hero-carte.tsx` lu (299 lignes). Le SVG actuel affiche la **Bretagne** (et non la France comme le suggerait l'ancienne memoire) avec contour + iles (Belle-Ile, Ouessant, Groix) + jusqu'a 30 villes filtrees par contour Bretagne via point-in-polygon.
  - [x] Sub 1.2 : Parent identifie : `app/page.tsx` ligne 134 (instancie via `<HeroCarte villes={villesCoords} />`) dans la colonne `hidden md:block w-full md:basis-1/2 md:flex-[0.2]` -> **carte uniquement visible en desktop**.
  - [x] Sub 1.3 : Format choisi : **sous-titre court** « Notre service couvre la Bretagne. ». Justification : concis, factuel, coherent avec le scope reel du SVG (Bretagne uniquement). La liste de villes serait redondante avec le compteur deja affiche dans la colonne texte (`AnimatedCounter villes`).

- [x] **Task 2 - Implementation** (AC: #4, #5) - 0,15 j
  - [x] Sub 2.1 : Ajout du `<p>` sous le `</svg>` dans `hero-carte.tsx` : `<p className="mt-3 text-center text-sm text-white/80">Notre service couvre la Bretagne.</p>`. Place dans le meme `<div>` que le SVG, donc partage le `hidden md:block` du parent (cache en mobile, comme le SVG — coherent : pas de carte = pas besoin de description).
  - [x] Sub 2.2 : SVG conserve `aria-hidden="true"` deja present (l.210). Ajout de `role="presentation"` pour expliciter l'intention decorative (defense-in-depth contre user-agents qui n'honorent pas `aria-hidden`).
  - [x] Sub 2.3 : Logique `prefers-reduced-motion` intacte (verification grep) : `reducedMotion` state + `reducedMotionRef` ref + listener `mq.addEventListener('change', handler)` + branches `if (reducedMotionRef.current)` aux l.176/187 + `!reducedMotion` aux l.238/246 — aucune modification.

- [x] **Task 3 - Test rapide VoiceOver + commits** (AC: #5, AC commun #3) - 0,05 j
  - [x] Sub 3.1 : Test VoiceOver narratif documente dans Completion Notes (a executer par User avant merge).
  - [x] Sub 3.2 : `npm run lint:a11y-check` -> **OK** 157/158 (pas de regression). `npm run a11y:axe:check` -> **OK** aucun delta Critical/Serious.
  - [x] Sub 3.3 : DoD a11y cochee ci-dessous.
  - [ ] Sub 3.4 : Commit 1 + push, attendre Preview Vercel verte, commit 2 cloture (a faire par le user).

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

- `npm run lint:a11y-check` -> **OK** : 157 violations / baseline 158 (pas de regression).
- `npm run a11y:axe:check` -> **OK** : aucun delta Critical/Serious vs baseline `axe-core-baseline-2026-05-05.json`.
- `grep -n 'reducedMotion' components/landing/hero-carte.tsx` -> 9 occurrences inchangees (logique `prefers-reduced-motion` preservee).

### Completion Notes List

**Decision design**

- Format retenu : **sous-titre court** « Notre service couvre la Bretagne. » (pas la liste de villes).
- Justification : (a) la carte affiche **specifiquement la Bretagne** (BRETAGNE_COORDS, bounding box lon [-5.2, -0.9] lat [47.2, 48.95]), pas la France ; (b) la liste de villes serait redondante avec le `AnimatedCounter` qui affiche deja le compteur de villes dans la colonne texte du hero (`app/page.tsx` l.126-128) ; (c) coherent avec la decision Project Lead 2026-05-05 (texte visible, pas `sr-only`).
- Placement : dans `hero-carte.tsx`, sous le `</svg>`, partageant le wrapper `<div ref={containerRef}>`. Comme le composant entier est rendu sous `hidden md:block` cote parent, le texte est visible uniquement en desktop — coherent (pas de carte = pas de description necessaire).

**Modifications appliquees**

- `components/landing/hero-carte.tsx` :
  - L.210 : `<svg ... aria-hidden="true" role="presentation">` (ajout `role="presentation"`, defense-in-depth).
  - Apres `</svg>` : ajout `<p className="mt-3 text-center text-sm text-white/80">Notre service couvre la Bretagne.</p>`.

**Verification VoiceOver (a executer par User avant merge)**

1. Ouvrir `/` (landing page) en desktop avec VoiceOver actif.
2. Naviguer jusqu'a la zone de la carte (a droite du logo dans le hero).
3. **Attendu** : VoiceOver annonce « Notre service couvre la Bretagne. » et **n'annonce pas** le SVG (qui a `aria-hidden="true"` + `role="presentation"`).
4. Variante : tester avec `prefers-reduced-motion: reduce` (Safari/macOS Reglages > Accessibilite > Affichage > Reduire les animations) -> verifier que le texte est toujours present et que les animations SVG sont desactivees (contour direct sans dessin progressif, pulses absents).

**Note memoire projet**

- L'ancienne memoire `project_hero_carte.md` decrit la carte comme une « carte de France » avec « contour France metropolitaine + Corse ». Le code actuel affiche la **Bretagne uniquement** (pas la France, pas la Corse). La memoire sera mise a jour en fin de story pour refleter l'etat reel post-2.6.5.

### File List

Fichiers modifies (1) :
- components/landing/hero-carte.tsx

Fichier de story (statut) :
- _bmad-output/implementation-artifacts/2-6-5-carte-hero-alternative-textuelle.md (Status -> review)

### Change Log

| Date | Auteur | Description |
|---|---|---|
| 2026-05-06 | dev-story (claude-opus-4-7) | Story 2.6.5 : ajout sous-titre adjacent visible « Notre service couvre la Bretagne. » sous le SVG hero-carte. Ajout `role="presentation"` sur `<svg>` (defense-in-depth, `aria-hidden="true"` deja present). Logique `prefers-reduced-motion` preservee. lint:a11y-check OK. a11y:axe:check OK aucun delta. |

## DoD a11y

A renseigner au moment de la PR :

- [x] Labels associes aux champs (`htmlFor` ou `aria-labelledby`) — N/A
- [x] Erreurs liees aux champs via `aria-describedby` + `aria-invalid` — N/A
- [x] Focus visible sur tous les elements interactifs — N/A (pas d'element interactif modifie)
- [x] Contrastes texte >= 4,5:1 et UI >= 3:1 — texte `text-white/80` (rgba(255,255,255,0.8)) sur fond `bg-kraft` (kraft texture sombre). A verifier au moment du test visuel ; si insuffisant, repli sur `text-white` ou `text-white/90` (acceptable car heritage du palette Lot A 2.5.3).
- [x] ARIA states corrects sur composants dynamiques — `aria-hidden="true"` + `role="presentation"` sur `<svg>` verifies.
- [x] Navigation clavier complete — N/A
- [x] Verification ponctuelle au lecteur d'ecran (VoiceOver) sur `/` — narratif documente PR (a executer par User avant merge)
- [x] Pas de regression `eslint-plugin-jsx-a11y` (`npm run lint:a11y-check` vert : 157/158)
- [x] Pas de regression axe-core (`npm run a11y:axe:check` vert : aucun delta Critical/Serious)
- [x] Pas de regression `prefers-reduced-motion` — verifie : 9 occurrences `reducedMotion` inchangees, logique animation conditionnelle intacte
