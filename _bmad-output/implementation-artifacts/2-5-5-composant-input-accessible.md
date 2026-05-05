# Story 2.5.5 : Composant Input accessible

Status: review

<!-- Note: Validation est optionnelle. Lancer `validate-create-story` avant `dev-story` pour un controle qualite. -->

## Story

En tant que **utilisateur de lecteur d'ecran (VoiceOver, NVDA) ou utilisateur clavier sur roxanetnous**,
je veux **que chaque champ de formulaire utilisant le composant `<Input>` partage annonce son libelle, son statut "obligatoire", et ses messages d'erreur de maniere correctement reliee au champ**,
afin de **pouvoir remplir et corriger les formulaires d'authentification et d'inscription sans assistance, en comprenant a tout instant quel champ je remplis et pourquoi il est en erreur**.

Cette story est la cinquieme du Lot A (accessibilite quick wins) et la **piece maitresse fonctionnelle** du lot. Elle s'appuie sur :
- la chaine de lint posee par la 2.5.1 (livree, baseline 160 violations a respecter ou faire baisser),
- le skip-link et `<main id="main-content">` pose par la 2.5.2 (livree),
- le token `--focus-ring` et la palette de contrastes durcie posee par la 2.5.3 (livree, `border-gray-400`, `text-red-700`, `focus:ring-focus-ring` deja appliques au composant `<Input>`),
- la gestion `prefers-reduced-motion` posee par la 2.5.4 (livree, sans impact direct sur ce composant).

Elle adresse **3 criteres NFR a11y critiques** du PRD (`### Accessibilite (NFR transverse)`) :
- **C1 -- Labels associes** (FAIL bloquant : « 100 % des `<input>`/`<select>`/`<textarea>` ont un `<label htmlFor>` ou `aria-labelledby` associe »). Le composant `<Input>` actuel a un `<label>` orphelin sans `htmlFor`, ce qui est l'une des raisons fondamentales pour lesquelles le composant figure au baseline avec `jsx-a11y/label-has-for (1)`.
- **C2 partiel -- Erreurs annoncees** (FAIL : « erreurs liees au champ par `aria-describedby` + `aria-invalid="true"` ; toast d'erreur global a `role="alert"` ou `aria-live="assertive"` »). Le composant rend l'erreur dans un `<p>` non lie au champ et sans annonce active.
- **C3 -- Champs requis** (CONCERNS : « `aria-required="true"` ou `required` HTML, et indication textuelle non uniquement visuelle »). L'asterisque rouge actuelle viole WCAG 1.3.1 (information non transmise uniquement par la couleur).

Effort estime : **1 j-dev** (la plus grosse story du Lot A, tech-spec section « Story 2.5.5 », Tasks 15-17).

**Note de derive Lot A** : la 2.5.5 est cadree a 1 j-dev contre 0,75 j prevu au tech-spec d'origine (Tasks 15 + 16 + 17 = 1 j de toute facon dans le tech-spec, mais la section « Solution » du tech-spec annoncait 0,75 j en synthese -- divergence interne du tech-spec). Cette derive de +8% sur le total Lot A (3,5 j vs 3,25 j prevus) est **acceptable** et **a noter pour la retro Lot A** (post-2.5.6). Justification de la majoration : la verification de propagation aux 4 fichiers usagers (Task 2) et le test manuel VoiceOver elargi (Task 3, voir AC8) absorbent du temps non comptabilise dans le tech-spec.

## Acceptance Criteria

### AC commun Lot A (rappel)

1. **AC commun 1** -- Given une PR Lot A, when la CI Vercel tourne, then `npm run lint:a11y-check` passe sans nouvelle violation `jsx-a11y/*` au-dela du baseline 160 capture par la Story 2.5.1. **Note specifique 2.5.5** : cette story doit faire **baisser** le baseline (au minimum la violation `jsx-a11y/label-has-for (1)` sur `components/ui/input.tsx`, et idealement aussi les violations sur `register-form.tsx`). Apres livraison, **regenerer** le baseline via `node scripts/build-a11y-baseline.mjs` et committer le fichier mis a jour (avec justification dans le PR : « livraison Story 2.5.5 »).
2. **AC commun 2** -- Given un composant modifie, when un developpeur consulte le composant, then les attributs ARIA pertinents sont presents si necessaires (ici : `htmlFor`, `id`, `aria-invalid`, `aria-describedby`, `aria-required`, `role="alert"` -- voir ACs 4-9).
3. **AC commun 3** -- Given une story Lot A en revue, when le reviewer relit la PR, then la checklist DoD a11y (voir section `## DoD a11y` en bas) est presente dans la description et **toutes les cases applicables sont cochees** (cette story coche 7/8 cases minimum -- focus deja livre en 2.5.3, contrastes deja livres en 2.5.3, navigation clavier preservee).

### AC propres a la Story 2.5.5

4. **AC1 -- `useId` + `htmlFor`/`id` synchronises** : Given le composant `components/ui/input.tsx`, when un developpeur l'inspecte, then le composant importe `useId` depuis React et genere un `fieldId = useId()`. La prop optionnelle `id` (typee `string | undefined`) prend le pas sur l'`useId` quand fournie : `const finalId = id ?? fieldId`. Le `<label>` a `htmlFor={finalId}` et l'`<input>` a `id={finalId}`. **Cas d'override teste explicitement** : `register-form.tsx:311-312` passe deja `id="parrainage_code"` (avec un `<label htmlFor="parrainage_code">` externe au composant Input ligne 305-310) -- ce cas doit continuer a fonctionner sans regression apres refonte.
5. **AC2 -- `<input>` enfant direct du `<label>` (pour `jsx-a11y/label-has-for` legacy)** : Given le DOM rendu du composant Input, when un developpeur inspecte, then l'`<input>` est **enfant direct** du `<label>` (le `<label>` enveloppe a la fois le texte du libelle et l'`<input>`, plus l'eventuel `<p>` d'erreur). Justification : la regle `jsx-a11y/label-has-for` (legacy mais active dans `recommended` du plugin v6.x) exige **soit** `htmlFor` **soit** un `<input>` nested -- la 2.5.5 doit faire les deux pour neutraliser definitivement la violation `label-has-for (1)` sur `components/ui/input.tsx`. **Risque visuel** : enrouler l'`<input>` dans le `<label>` peut casser la mise en page si le `<label>` herite de styles flex/grid parents. Verifier visuellement sur les 4 fichiers usagers (login, register-form, forgot-password, reset-password) qu'aucun debordement, retour a la ligne ou changement de spacing n'apparait.
6. **AC3 -- `aria-describedby` pointe sur le `<p>` d'erreur quand erreur** : Given un Input avec prop `error` definie, when le DOM est inspecte, then : (a) un `<p id={errorId}>` est rendu, ou `errorId = ${finalId}-error`, (b) l'`<input>` a `aria-describedby={errorId}` (uniquement quand `error` est truthy ; sinon, `aria-describedby` n'est pas rendu pour eviter de pointer vers un id inexistant), (c) le `<p>` d'erreur a `role="alert"` pour declencher l'annonce immediate par le lecteur d'ecran a l'apparition (sans attendre le focus). Garder la classe `text-red-700 text-sm mt-1` deja en place (livree par 2.5.3).
7. **AC4 -- `aria-invalid="true"` quand erreur** : Given un Input avec prop `error` definie, when le DOM est inspecte, then l'`<input>` a `aria-invalid="true"`. Quand `error` est `undefined`, **ne pas rendre `aria-invalid="false"`** (utiliser `aria-invalid={error ? true : undefined}`) pour eviter d'inonder le DOM d'attributs inutiles -- pattern accessibilite recommande par MDN.
8. **AC5 -- `aria-required` et `required` HTML synchronises** : Given un Input avec prop `required` (booleen), when le DOM est inspecte, then : (a) l'`<input>` recoit l'attribut `required` HTML natif (deja le cas via `{...props}`), (b) l'`<input>` recoit `aria-required={required ? true : undefined}` (le `required` HTML implique deja `aria-required` selon la spec ARIA, mais l'expliciter rend l'intention claire et prend en charge les lecteurs d'ecran qui n'inferent pas correctement). Quand `required` est faux ou non passe, ni `required` ni `aria-required` ne sont presents.
9. **AC6 -- Suffix textuel `(obligatoire)` au lieu de l'asterisque rouge seule** : Given un Input avec prop `required={true}` et un `label` non vide, when le label est rendu, then : (a) le texte du label se termine par `<span className="text-gray-700"> (obligatoire)</span>` (texte visible **et** lu par le lecteur d'ecran -- conforme WCAG 1.3.1, info pas uniquement par la couleur), (b) l'asterisque rouge `<span className="text-red-500 ml-1">*</span>` actuelle ligne 16 du composant **est supprimee** (decision : un seul indicateur visuel + textuel suffit, l'asterisque sans texte est redondante avec le suffix « (obligatoire) »). Justification du `text-gray-700` : ratio ~7:1 sur blanc, conforme AA, plus discret que le label principal en `text-black`. **Cas particulier `parrainage_code`** : le label externe ligne 309 du `register-form.tsx` utilise deja `<span className="text-gray-400">(optionnel)</span>` pour signaler que le champ est facultatif -- ce label etant **externe** au composant Input, il n'est pas affecte par cette story (et le suffix « (obligatoire) » du composant Input ne s'applique pas car la prop `required` n'est pas passee a cet usage).
10. **AC7 -- Pas de regression sur les usages existants** : Given les 4 fichiers usagers du composant `<Input>` (login, register-form, forgot-password, reset-password), when on inspecte le rendu apres refonte, then : (a) tous les champs gardent leur libelle visible, leur placeholder, leur `value`/`onChange`, leur `autoFocus` (si passe), (b) le ring de focus reste celui livre en 2.5.3 (`focus:ring-focus-ring` ou `focus:ring-red-500` en cas d'erreur), (c) le `register-form.tsx:311` continue de fonctionner avec son `id="parrainage_code"` overridant l'`useId`, (d) aucun champ ne perd son `name` (utilise par `formData` / server actions). **Test manuel obligatoire** : remplir et soumettre le formulaire de connexion `/login` (etape email puis etape password), declencher une erreur de mot de passe pour valider l'apparition de l'erreur (ce flow ne passe pas d'`error` prop au composant Input actuellement -- l'erreur est rendue dans un `<div>` separe au-dessus du formulaire -- mais on verifie qu'aucun warning console React n'apparait au rendu).
11. **AC8 -- Test manuel VoiceOver sur 2 formulaires critiques** : Given un developpeur sur macOS, when il active VoiceOver (Cmd + F5) et navigue au clavier (Tab), then il teste **les deux** formulaires suivants :
    - **Test 1 -- `/forgot-password`** (cas simple, 1 Input email obligatoire) : (a) Tab depuis le skip-link (ou la barre d'URL) atteint le champ Input, (b) VoiceOver annonce « Adresse email, obligatoire, zone de modification de texte » (ou variante equivalente -- l'important est que `email`, `obligatoire` et la nature `text edit` soient annonces), (c) si une erreur survient (via modification temporaire du composant -- voir Task 3.4), VoiceOver annonce le message d'erreur des son apparition grace a `role="alert"`, (d) au focus suivant sur le champ en erreur, VoiceOver re-lit l'erreur grace a `aria-describedby`.
    - **Test 2 -- `/register?role=accompagnante`** (cas mixte, valide les variantes ARIA conditionnelles) : navigation a travers les 5 etapes (role -> name -> parrainage -> email -> password). Verifier specifiquement : (a) sur l'etape `name`, **les deux Inputs (Prenom, Nom)** annoncent « obligatoire » (les deux ont `required`, donc `aria-required` present + suffix textuel), (b) sur l'etape `parrainage`, l'Input `parrainage_code` **n'annonce PAS « obligatoire »** (pas de prop `required`, donc `aria-required` absent et pas de suffix textuel ; le label externe « Code de parrainage (optionnel) » est lu a la place), (c) sur les etapes `email` et `password`, le champ annonce « obligatoire » comme attendu. Ce test valide la **conditionnalite** de `aria-required={props.required ? true : undefined}` (AC5) : present quand requis, absent sinon.
    - **Justification de l'elargissement a `/register`** : `/forgot-password` ne teste qu'un cas (1 champ requis). `/register` apporte le mix requis/optionnel necessaire pour valider que les variantes ARIA conditionnelles ne sont pas inversees (l'asterisque ne reapparait pas sur les optionnels, le suffix « (obligatoire) » ne s'affiche pas sur les optionnels, `aria-required` n'est pas systematiquement rendu).
    - **Documenter dans le PR par 1 note explicite par formulaire** : « VoiceOver `/forgot-password` OK : libelle annonce, statut obligatoire annonce, erreur annoncee a l'apparition et au refocus. VoiceOver `/register?role=accompagnante` OK : 4 champs requis annoncent « obligatoire », `parrainage_code` (optionnel) n'annonce pas « obligatoire » -- variantes ARIA conditionnelles validees. » (capture optionnelle).
12. **AC9 -- Baisse mesurable du baseline** : Given le baseline a11y avant (160) et apres (a regenerer), when on lance `npm run lint:a11y-check` apres regeneration, then le compteur total a baisse d'**au moins 1** (la violation `jsx-a11y/label-has-for (1)` sur `components/ui/input.tsx` doit disparaitre). **Cible realiste** : baisse de 1 a 4 violations selon que les violations `label-has-for (2)` + `label-has-associated-control (1)` sur `register-form.tsx` (provenant du label externe `parrainage_code` lignes 305-310) soient incidemment resolues ou non. Si la baisse est exactement 1, c'est conforme a l'AC. Si elle est superieure, mieux. Si elle est nulle ou negative, **echec de l'AC** -- investigation requise. **Action** : regenerer le baseline via `node scripts/build-a11y-baseline.mjs` (le script ecrit `_bmad-output/test-artifacts/a11y-lint-baseline-${today}.txt`, par exemple `2026-05-05.txt`). Le wrapper `scripts/check-a11y-baseline.mjs` utilise `findLatestBaseline()` qui prend automatiquement le fichier le plus recent par tri lexicographique sur la date ISO -- **aucune mise a jour de pointeur necessaire**, le nouveau fichier est utilise des sa creation. **Verification obligatoire post-regeneration (AC integre)** : apres `node scripts/build-a11y-baseline.mjs`, lancer `npm run lint:a11y-check` et verifier dans la sortie console que la ligne « Baseline file: ... » (en cas de regression) ou « Baseline total: <nouveau_total> » (en cas OK) **pointe sur le nouveau fichier** (`2026-05-05.txt`) et **pas** sur l'ancien (`2026-05-04.txt`). Si le check pointe sur l'ancien baseline, investigation requise (probleme de tri ou de pattern regex dans `findLatestBaseline`).
13. **AC10 -- Pas de regression typecheck/build** : Given la branche post-livraison, when on execute `npx tsc --noEmit` puis `npm run build`, then aucune erreur TypeScript ni warning bloquant n'apparait. **Point de vigilance** : la prop `id` qui devient officiellement supportee (et utilisee comme override) doit etre typee correctement. Le composant herite deja de `React.InputHTMLAttributes<HTMLInputElement>` qui inclut `id?: string` -- pas de modification d'interface necessaire, juste destructurer `id` parmi les props.
14. **AC11 -- CI Vercel verte** : Given la PR de la story, when la CI tourne, then le build Vercel passe (`npm run lint:a11y-check && next build`) sans regression jsx-a11y et sans erreur TypeScript, et les 4 pages utilisant Input (login, register, forgot-password, reset-password) sont generees sans warning React.

## Tasks / Subtasks

- [x] **Task 1 -- Refondre `components/ui/input.tsx` avec `useId`, ARIA et suffix textuel** (AC: #4, #5, #6, #7, #8, #9, #13)
  - [x] Sous 1.1 : Ouvrir `components/ui/input.tsx`. Etat actuel verifie : 36 lignes, `forwardRef<HTMLInputElement, InputProps>`, props `label`, `error`, `className`. Pas de `useId`, pas de `htmlFor`, pas d'ARIA, asterisque rouge sur `required`, `<p>` d'erreur non lie.
  - [x] Sous 1.2 : Ajouter l'import `useId` :
    ```tsx
    import * as React from 'react'
    ```
    devient
    ```tsx
    import * as React from 'react'
    import { useId } from 'react'
    ```
    (Alternative : `import * as React from 'react'` puis `React.useId()`. Choisir le named import pour la lisibilite.)
  - [x] Sous 1.3 : Au debut du `forwardRef`, generer les ids :
    ```tsx
    const Input = React.forwardRef<HTMLInputElement, InputProps>(
      ({ className = '', label, error, id, ...props }, ref) => {
        const generatedId = useId()
        const finalId = id ?? generatedId
        const errorId = `${finalId}-error`
        // ...
    ```
    **Important** : destructurer `id` des props pour eviter qu'il soit re-spread sur l'`<input>` via `{...props}` apres avoir deja set `id={finalId}` (sinon double attribut `id`).
  - [x] Sous 1.4 : Refondre la structure JSX. **Avant** :
    ```tsx
    <div className="w-full">
      {label && (
        <label className="block text-sm font-medium text-black mb-2">
          {label}
          {props.required && <span className="text-red-500 ml-1">*</span>}
        </label>
      )}
      <input ref={ref} className={...} {...props} />
      {error && <p className="mt-1 text-sm text-red-700">{error}</p>}
    </div>
    ```
    **Apres** :
    ```tsx
    <div className="w-full">
      <label htmlFor={finalId} className="block">
        {label && (
          <span className="block text-sm font-medium text-black mb-2">
            {label}
            {props.required && (
              <span className="text-gray-700"> (obligatoire)</span>
            )}
          </span>
        )}
        <input
          ref={ref}
          id={finalId}
          aria-invalid={error ? true : undefined}
          aria-describedby={error ? errorId : undefined}
          aria-required={props.required ? true : undefined}
          className={`flex h-10 w-full rounded-lg border ${
            error ? 'border-red-500' : 'border-gray-400'
          } bg-white px-3 py-2 text-sm focus:outline-none focus:ring-2 ${
            error ? 'focus:ring-red-500' : 'focus:ring-focus-ring'
          } disabled:cursor-not-allowed disabled:opacity-50 ${className}`}
          {...props}
        />
        {error && (
          <p id={errorId} role="alert" className="mt-1 text-sm text-red-700">
            {error}
          </p>
        )}
      </label>
    </div>
    ```
  - [x] Sous 1.5 : **Justification du wrapping `<label>` autour de tout** : la regle `jsx-a11y/label-has-for` (legacy, active dans `recommended` du plugin) accepte deux strategies (`nesting` ou `id`). On fait les **deux** : l'`<input>` est enfant direct du `<label>`, **et** le `<label>` a `htmlFor={finalId}` qui pointe sur l'`id` de l'`<input>`. Cette redondance neutralise definitivement la violation et reste robuste si la config ESLint est durcie plus tard. Le `<label className="block">` (au lieu de la version inline) preserve le comportement vertical du composant.
  - [x] Sous 1.6 : **Justification du `<span>` interne pour le texte du libelle** : on remplace le `<label>` direct sur le texte par un `<span>` interne, pour pouvoir styler le texte (`block text-sm font-medium text-black mb-2`) sans appliquer ces styles a l'`<input>` ou au `<p>` d'erreur. Le `<span>` est purement structurel, pas lu separement par les lecteurs d'ecran (ils lisent le contenu textuel du `<label>` integralement).
  - [x] Sous 1.7 : **Justification du suffix `(obligatoire)` en `text-gray-700`** : ratio ~7:1 sur blanc (conforme AA). Le `text-gray-700` est plus discret que `text-black` (ratio 21:1) tout en restant largement conforme. Visuellement, cela cree une hierarchie : libelle principal (noir, gras) > suffix « (obligatoire) » (gris fonce, regulier). Pattern recommande par WAI-ARIA Authoring Practices et le ARIA Standard.
  - [x] Sous 1.8 : **Suppression de l'asterisque rouge** : la ligne `{props.required && <span className="text-red-500 ml-1">*</span>}` actuelle ligne 16 est integralement supprimee, remplacee par le suffix textuel. L'asterisque etait redondante avec le suffix et violait WCAG 1.3.1 (information uniquement par la couleur rouge). **Pas de mode hybride** (texte ET asterisque) -- choix du suffix textuel seul, plus accessible et plus lisible.
  - [x] Sous 1.9 : **Note sur `props.required`** : `props.required` (boolean) est passe a la fois a l'`<input>` (via `{...props}`) et lu pour le suffix textuel et `aria-required`. C'est correct. La spread `{...props}` apres `aria-required` permet aux usagers d'override `aria-required` explicitement si besoin (cas extreme, non documente, mais robuste).

- [x] **Task 2 -- Verifier la propagation aux 4 formulaires usagers** (AC: #7, #10, #13)
  - [x] Sous 2.1 : Lister les 4 fichiers usagers (verifies par `grep "from '@/components/ui/input'"`) :
    - `app/login/page.tsx` (2 usages : email step + password step)
    - `app/forgot-password/page.tsx` (1 usage : email)
    - `app/reset-password/page.tsx` (1 usage : password)
    - `components/auth/register-form.tsx` (5 usages : firstName, lastName, parrainage_code, email, password)
  - [x] Sous 2.2 : Lancer `npm run dev` et tester chaque page :
    - `/login` etape email : Tab depuis URL bar -> skip-link -> Tab -> Input email (verifier label visible, suffix « (obligatoire) » present, focus ring orange fonce visible).
    - `/login` etape password : memes verifications sur le champ Mot de passe.
    - `/register?role=accompagne` puis Tab successifs : verifier les 4 Inputs (firstName/lastName/email/password) avec leur suffix « (obligatoire) ». **Verifier que le champ `parrainage_code` (role=accompagnante uniquement) garde son label externe « Code de parrainage (optionnel) » SANS suffix « (obligatoire) »** (pas de prop `required` passee, donc le suffix ne s'affiche pas).
    - `/forgot-password` : Input email avec « (obligatoire) ».
    - `/reset-password` : Input password avec « (obligatoire) ».
  - [x] Sous 2.3 : Verifier l'absence de double `htmlFor` ou de double `id` sur le cas `parrainage_code` (AC1) : le label externe ligne 305-310 a `htmlFor="parrainage_code"`, et le composant Input recoit `id="parrainage_code"` via override. Inspecter le DOM :
    - Le label externe « Code de parrainage » a `htmlFor="parrainage_code"` -> OK.
    - Le composant Input genere son **propre** `<label>` interne (Task 1) qui aussi a `htmlFor={finalId}` ou `finalId === "parrainage_code"` (override). Resultat : **deux labels** pointent sur le meme input via `htmlFor`, le label externe (avec le texte « Code de parrainage (optionnel) ») et le label interne (vide car la prop `label` n'est pas passee a l'Input ligne 311-326).
    - **Probleme potentiel** : double `<label>` qui referencent le meme input peut etre considere comme une faiblesse semantique (typiquement le lecteur d'ecran lit le premier `<label>` rencontre dans le DOM, qui sera le label externe -- cible souhaitee). Pas de regression a11y reelle car le label externe est lu en premier et fournit toute l'information.
    - **Decision** : laisser le code en l'etat. La 2.5.5 ne touche pas le label externe de `register-form.tsx`. Si le lint ESLint warn sur le double label (peu probable), ajuster en condition `{label && (...)}` autour du `<label>` interne ou supprimer le `<label>` interne quand `label` n'est pas passee. **Verifier en pratique apres refonte** : si `npx eslint components/auth/register-form.tsx` ou le check baseline signale une nouvelle violation, traiter selon la realite observee.
  - [x] Sous 2.4 : **Cas du `<label>` interne sans `label` prop** : si la prop `label` est `undefined` (non passee), le composant doit-il rendre un `<label>` vide qui enveloppe l'`<input>` ou ne pas rendre de `<label>` du tout ? Decision : **rendre le `<label>` toujours** (pour preserver `htmlFor` et la nesting de l'input dans le label, qui satisfont les regles ESLint a11y). Le `<span>` interne avec le texte est rendu **conditionnellement** (`{label && (<span>...)}`). Resultat : si `label` est non-passe, le `<label>` enveloppe l'input mais sans texte visible -- comportement equivalent a l'ancien composant (qui ne rendait pas de `<label>` du tout dans ce cas), avec en bonus l'association `htmlFor`/`id`. Le seul cas d'usage actuel sans `label` prop est `register-form.tsx:311` (champ `parrainage_code`) ou un label externe est deja rendu -- comportement OK.

- [ ] **Task 3 -- Test manuel VoiceOver sur `/forgot-password` ET `/register`** (AC: #11)
  - [ ] Sous 3.1 : Activer VoiceOver sur macOS : Cmd + F5 (ou Reglages > Accessibilite > VoiceOver > Activer VoiceOver). Si premiere utilisation, suivre le tutorial rapide (5 min) ou consulter la cheat-sheet : Tab pour focus suivant, VO+Espace pour activer, VO = Ctrl+Option par defaut.
  - [ ] Sous 3.2 : **Test 1 -- `/forgot-password`** (cas simple, 1 champ requis) : lancer `npm run dev`, ouvrir `http://localhost:3000/forgot-password`. Cliquer dans la barre d'URL puis appuyer Tab.
  - [ ] Sous 3.3 : Verifier les annonces sur `/forgot-password` :
    - Tab 1 -> skip-link « Aller au contenu principal, lien » (livre 2.5.2).
    - Tab 2 -> logo « roxanetnous, lien ».
    - Tab 3 -> champ email : VoiceOver doit annoncer **« Adresse email, obligatoire »** (l'ordre exact peut varier selon la version VoiceOver, l'important est que `obligatoire` soit annonce). Idealement, VoiceOver annonce aussi « zone de modification de texte » ou « champ de texte ».
    - Tab 4 -> bouton « Envoyer le lien ».
  - [ ] Sous 3.4 : **Test 2 -- `/register?role=accompagnante`** (cas mixte requis/optionnel, valide les variantes ARIA conditionnelles -- justification AC8) : ouvrir `http://localhost:3000/register?role=accompagnante`. Naviguer a travers les 5 etapes (`role` -> `name` -> `parrainage` -> `email` -> `password`) en remplissant les champs et en cliquant `Continuer` a chaque etape.
    - **Etape `name`** (2 Inputs requis) : VoiceOver doit annoncer **« Prenom, obligatoire »** sur le premier champ, puis **« Nom, obligatoire »** sur le second. Les deux ont la prop `required`, donc `aria-required="true"` + suffix textuel « (obligatoire) ». **Ne doivent PAS** annoncer une asterisque rouge (supprimee par cette story).
    - **Etape `parrainage`** (1 Input optionnel + label externe avec `(optionnel)`) : VoiceOver doit annoncer **« Code de parrainage, optionnel »** (le label externe avec `<span>(optionnel)</span>` ligne 309 du `register-form.tsx` est lu en premier). VoiceOver **NE doit PAS** annoncer « obligatoire ». **Verification cle** : `aria-required` est absent (`undefined`) car `required` n'est pas passe au composant Input -- l'absence est aussi importante que la presence. Le suffix textuel « (obligatoire) » du composant Input ne doit pas etre rendu non plus (le `<span>` interne avec le texte n'est pas rendu car `label` prop n'est pas passee, AC1.4).
    - **Etape `email`** (1 Input requis) : VoiceOver doit annoncer **« Adresse email, obligatoire »**.
    - **Etape `password`** (1 Input requis) : VoiceOver doit annoncer **« Mot de passe, obligatoire »**.
    - **Conclusion test 2** : **4 champs requis annoncent « obligatoire » + 1 champ optionnel n'annonce pas « obligatoire »**. Variantes ARIA conditionnelles validees.
  - [ ] Sous 3.5 : **Test de l'erreur** (sur `/forgot-password` ou `/login` step password, au choix) : le `forgot-password` ne passe pas de prop `error` au composant Input actuellement (l'erreur est rendue dans un `<div>` separe au-dessus du formulaire ligne 49-53). Pour tester l'annonce d'erreur via le composant Input, **modifier temporairement** une page (de preference `/forgot-password` car c'est le plus simple) pour passer une `error` prop fictive au composant Input :
    ```tsx
    // Modification TEMPORAIRE (a annuler avant commit) :
    <Input
      name="email"
      type="email"
      label="Adresse email"
      placeholder="vous@exemple.com"
      required
      error="Email invalide (test VoiceOver)"
    />
    ```
    Recharger la page : VoiceOver doit annoncer **immediatement** « Email invalide (test VoiceOver) » a l'apparition (grace a `role="alert"`), sans attendre le focus. Au focus suivant sur le champ, VoiceOver doit lire « Adresse email, obligatoire, invalid, Email invalide (test VoiceOver) » (ou similaire -- l'important est que l'erreur soit re-lue grace a `aria-describedby`). **Annuler la modification** apres test.
  - [ ] Sous 3.6 : **Documenter** dans la PR : ajouter **2 notes de test manuel** (une par formulaire), captures d'ecran VoiceOver Caption optionnelles. Exemples :
    - « Test VoiceOver macOS sur `/forgot-password` : libelle « Adresse email » annonce, statut « obligatoire » annonce. Test erreur via prop temporaire : annonce immediate via role=alert, re-lecture au refocus via aria-describedby. OK »
    - « Test VoiceOver macOS sur `/register?role=accompagnante` : 4 champs requis (Prenom, Nom, Email, Mot de passe) annoncent « obligatoire ». 1 champ optionnel (`parrainage_code`) n'annonce pas « obligatoire » (label externe annonce « optionnel »). Variantes ARIA conditionnelles validees. OK »
  - [ ] Sous 3.7 : **Alternative si VoiceOver inaccessible** : utiliser l'extension Chrome **Accessibility Insights for Web** (Microsoft) ou l'inspecteur d'accessibilite des DevTools Chrome (onglet « Accessibility »). Verifier sur les **deux** formulaires :
    - L'arbre d'accessibilite affiche les `<input>` avec `name`, `value`, `role="textbox"`, `required: true` (pour les requis) ou `required: false`/absent (pour `parrainage_code`).
    - Les `<input>` requis ont `describedBy` qui pointe sur le `<p>` d'erreur quand erreur (test via modif temporaire Sous 3.5).
    - Le `<input>` `parrainage_code` n'a **ni** `aria-required="true"` **ni** suffix « (obligatoire) » dans son label.
    - Documenter avec captures d'ecran de l'inspecteur DevTools si VoiceOver indisponible.

- [x] **Task 4 -- Regenerer le baseline a11y et committer** (AC: #1, #12)
  - [x] Sous 4.1 : Apres refonte du composant Input et verification qu'aucune regression n'apparait, **regenerer** le baseline :
    ```bash
    node scripts/build-a11y-baseline.mjs
    ```
    Le script ecrit `_bmad-output/test-artifacts/a11y-lint-baseline-${today}.txt` ou `${today}` est la date du jour (par exemple `2026-05-05`).
  - [x] Sous 4.2 : **Pas de pointeur a mettre a jour** : le wrapper `scripts/check-a11y-baseline.mjs` utilise une fonction `findLatestBaseline()` (verifie au cadrage 2026-05-05) qui :
    - liste tous les fichiers matchant le pattern regex `^a11y-lint-baseline-\d{4}-\d{2}-\d{2}\.txt$` dans `_bmad-output/test-artifacts/`,
    - les trie lexicographiquement (equivalent au tri chronologique pour les dates ISO `YYYY-MM-DD`),
    - prend le dernier (le plus recent).
    Resultat : creer `a11y-lint-baseline-2026-05-05.txt` (ou la date du jour) suffit -- le check delta utilise automatiquement le nouveau fichier des sa creation. **Garder l'ancien fichier `2026-05-04.txt`** pour la traçabilite historique : il n'interfere plus une fois qu'un fichier plus recent existe.
  - [x] Sous 4.3 : **Verification post-regeneration (obligatoire)** : apres `node scripts/build-a11y-baseline.mjs`, lancer `npm run lint:a11y-check` et **verifier explicitement** que le check pointe sur le nouveau baseline. La sortie console attendue :
    - En cas OK : `OK: <total_courant> jsx-a11y violations across N (file, rule) pair(s). Baseline total: <nouveau_total>. No regression.` (le « Baseline total » doit etre le total du **nouveau** baseline, pas 160).
    - En cas de regression : la sortie inclut explicitement `Baseline file: _bmad-output/test-artifacts/a11y-lint-baseline-2026-05-05.txt` (le chemin du nouveau fichier, pas `2026-05-04.txt`).
    Si la sortie pointe sur l'ancien baseline (`2026-05-04`), c'est un bug du `findLatestBaseline()` -- investigation requise (verifier que le nouveau fichier match bien le regex `^a11y-lint-baseline-\d{4}-\d{2}-\d{2}\.txt$` -- pas de suffixe inattendu, pas de `_v2`, etc.).
  - [x] Sous 4.4 : Verifier le delta : ouvrir le nouveau baseline, comparer le « Total a11y violations » au precedent (160). La baisse doit etre **>= 1** (la violation `jsx-a11y/label-has-for (1)` sur `components/ui/input.tsx` doit disparaitre). Si la baisse est plus importante (ex. 4 ou 5), verifier dans le « By file » que les violations correspondantes (`register-form.tsx`) sont bien resolues -- pas de regression silencieuse ailleurs.
  - [ ] Sous 4.5 : Committer le nouveau baseline avec une justification claire dans le message de commit : par exemple « Story 2.5.5 : refonte composant Input accessible (baseline ${nouvelle_valeur}) ». Le numero exact (159 ? 156 ?) sera calcule au moment de la regeneration.
  - [x] Sous 4.6 : Verifier que `npm run lint:a11y-check` passe (exit 0) avec le nouveau baseline.

- [ ] **Task 5 -- Verification CI Vercel et statut done** (AC: #14, #1, #13)
  - [x] Sous 5.1 : Executer en local : `npm run lint:a11y-check` (exit 0 attendu), `npx tsc --noEmit` (aucune erreur TypeScript), `npm run build` (Next 16 build OK, 46 pages generees).
  - [ ] Sous 5.2 : Pousser la branche `story-2-5-5-composant-input-accessible` (ou nom equivalent court). Verifier le deploiement Vercel preview (`vercel.app` URL fournie par le webhook).
  - [ ] Sous 5.3 : Tester en preview les 4 pages usagers (login, register, forgot-password, reset-password) en mode reel (pas seulement local).
  - [ ] Sous 5.4 : Apres CI Vercel **verte confirmee**, creer le commit final de cloture : `Story 2.5.5 : statut done apres CI Vercel verte`. Mettre a jour ce fichier (`_bmad-output/implementation-artifacts/2-5-5-composant-input-accessible.md`) :
    - Status: `done`
    - Cocher `[x]` toutes les tasks et sous-taches.
    - Renseigner le « Dev Agent Record » (Agent Model, Debug Log, Completion Notes, File List).
    - Renseigner le « Change Log » avec date, auteur, resume des changements.
    - Cocher la « DoD a11y » (8/8).
  - [ ] Sous 5.5 : Convention commits Lot A : 1 commit principal `Story 2.5.5 : composant Input accessible` (refonte du composant + propagation + baseline regenere) + 1 commit de cloture `Story 2.5.5 : statut done apres CI Vercel verte`. **Pas de** `git add -A` ni `git add .` : staging selectif uniquement (`git add components/ui/input.tsx _bmad-output/test-artifacts/a11y-lint-baseline-*.txt scripts/check-a11y-baseline.mjs _bmad-output/implementation-artifacts/2-5-5-composant-input-accessible.md`).

### Review Findings

Code review adversariale (Blind Hunter + Edge Case Hunter + Acceptance Auditor) executee 2026-05-05 sur `git diff HEAD -- components/ui/input.tsx`. Acceptance Auditor : 8/11 ACs PASS code, 0 FAIL, reste DEFERRED-MANUAL/CI. 18 findings hunters triees ci-dessous.

Decisions D1 + D2 + D3 appliquees post-revue (decisions Sylvain). Baseline regenere : 160 -> 158 (-2 violations vs cible AC9 >= 1). Resultats finaux : `npm run lint:a11y-check` OK 158, `npx tsc --noEmit` OK.

- [x] [Review][Decision] `<p role="alert">` enfant direct de `<label>` -- HTML invalide (label = phrasing content uniquement, `<p>` = flow content). Decision Sylvain (D1=1) : sortir le `<p>` du `<label>` en sibling dans la `<div>` racine. La nesting input-dans-label reste intacte (htmlFor + id couvrent `label-has-for`). Trois bugs regles : doublon nom accessible, click sur erreur ne focus plus l'input, HTML valide. Patch applique. [components/ui/input.tsx:35-65]
- [x] [Review][Decision] Chevauchement label externe + label interne sur `parrainage_code`. Decision Sylvain (D2=1) : migrer le label externe vers la prop `label` du composant Input (`label="Code de parrainage (optionnel)"`). Hors scope strict 2.5.5 mais haut ROI : delta baseline supplementaire de 1 violation `label-has-for` resorbee sur `register-form.tsx`. Note : la spec story Dev Notes ligne 235 surestimait le delta (3 violations attendues, en realite 2 dont 1 provient d'un autre label orphelin sur le step `Role` ligne 233 -- hors scope). Patch applique. [components/auth/register-form.tsx:304-321]
- [x] [Review][Decision] Spread `{...props}` apres les attributs ARIA calcules permet override silencieux. Decision Sylvain (D3=1) : destructurer `aria-invalid`/`aria-describedby`/`aria-required` des props et fusionner les IDs. La fusion `[ariaDescribedByProp, error ? errorId : undefined].filter(Boolean).join(' ')` permet l'override volontaire (hint externe) sans casser l'errorId. Le composant central d'a11y garantit ses invariants. Signature publique inchangee (props passees via `aria-*` cles standard). Patch applique. [components/ui/input.tsx:11-33]
- [x] [Review][Patch] Import dupliquee `import * as React from 'react'` + `import { useId } from 'react'` -- cosmetique, laisse en l'etat (decision implicite : la spec story Sous 1.2 documente le named import comme choix volontaire pour la lisibilite). [components/ui/input.tsx:1-2] -- left as-is, intentionnel
- [x] [Review][Defer] Violations baseline restantes sur `register-form.tsx` : `label-has-for (1) + label-has-associated-control (1)` -- les 2 viennent du label orphelin ligne 233 (step `Role` qui groupe des boutons radio non-input, pas du parrainage_code). Hors scope 2.5.5. [components/auth/register-form.tsx:233] -- deferred, pre-existing, decouvert post-D2
- [x] [Review][Defer] Violations baseline `jsx-a11y/no-autofocus x4` sur `register-form.tsx` + `x1` sur `app/login/page.tsx` -- hors scope explicite story 2.5.5 (Dev Notes ligne 235). [components/auth/register-form.tsx, app/login/page.tsx] -- deferred, pre-existing
- [x] [Review][Defer] Test manuel VoiceOver `/forgot-password` ET `/register?role=accompagnante` (Task 3 cochee `[ ]`) -- bloqueur pour passage en `done`, hors revue de code statique. [Task 3] -- deferred, pre-existing

Findings dismissed (faux positifs ou hors-pertinence) : pas de `'use client'` sur input.tsx (tous les usagers sont deja clients, useId SSR-safe), `text-gray-700` insuffisant sur `bg-kraft` (formulaires sont rendus dans `<form className="bg-white">`, contraste sur blanc ~10:1), `role="alert"` instable au mount/unmount (cas formulaire one-shot, pattern conforme), `aria-required` redondant avec `required` HTML (decision documentee Choix techniques), `aria-errormessage` ARIA 1.2 manquant (compat AT moins large que `aria-describedby`), `aria-invalid` non couple a la validation HTML5 native (par design), gestion `noValidate` (responsabilite du formulaire parent), `${className}` en queue peut ecraser etat erreur (pre-existant, aucun usager affecte), `useId()` retourne caracteres CSS invalides (IDREF != selector CSS), `disabled:focus:ring-0` manquant (`disabled` natif retire le focus), `name=undefined` via spread (pre-existant), doublons `id` page-wide (responsabilite usager), `autoFocus` retarde par wrapping `<label>` (aucun comportement navigateur connu), `label === ''` traite identique a `undefined` (`{label && (...)}` falsy-skip raisonnable), regression UX asterisque rouge -> texte gris (intention story AC6).

## Dev Notes

### Contexte projet (specifique -- lire avant tout)

- **Etat actuel pre-story (verifie 2026-05-05)** :
  - `components/ui/input.tsx` : 36 lignes, `forwardRef<HTMLInputElement, InputProps>`, props `label`, `error`, `className`. Etat actuel :
    - `<label>` orphelin sans `htmlFor` (ligne 14) -> violation `jsx-a11y/label-has-for (1)` au baseline.
    - Asterisque rouge `<span className="text-red-500 ml-1">*</span>` (ligne 16) sur `props.required` -> viole WCAG 1.3.1 (info uniquement par couleur).
    - `<input>` sans `id`, sans `aria-invalid`, sans `aria-describedby`, sans `aria-required` (ligne 19-27).
    - `<p>` d'erreur sans `id`, sans `role="alert"`, non lie au champ (ligne 28).
    - **Acquis 2.5.3** : `border-gray-400` (ligne 22), `focus:ring-focus-ring` (ligne 24), `text-red-700` sur le `<p>` d'erreur (ligne 28).
  - 4 fichiers usagers du composant `<Input>` (verifie par `grep "from '@/components/ui/input'"`) :
    - `app/login/page.tsx` (lignes 66, 99 : email + password)
    - `app/forgot-password/page.tsx` (ligne 59 : email)
    - `app/reset-password/page.tsx` (ligne 58 : password)
    - `components/auth/register-form.tsx` (lignes 272, 281, 311, 377, 398 : firstName, lastName, parrainage_code, email, password)
  - **Cas particulier `parrainage_code`** (ligne 311 de `register-form.tsx`) : passe `id="parrainage_code"` au composant Input, et un `<label htmlFor="parrainage_code">` externe est rendu lignes 305-310 avec « Code de parrainage (optionnel) ». La refonte doit preserver ce cas.
  - Baseline a11y (`_bmad-output/test-artifacts/a11y-lint-baseline-2026-05-04.txt`) : **160 violations totales**, dont :
    - `components/ui/input.tsx` : 1 `jsx-a11y/label-has-for` (cible directe de cette story).
    - `components/auth/register-form.tsx` : 2 `jsx-a11y/label-has-for` + 1 `jsx-a11y/label-has-associated-control` + 4 `jsx-a11y/no-autofocus` (les 3 premieres viennent vraisemblablement du label externe `parrainage_code` ; les 4 `no-autofocus` sont **hors scope** -- a traiter en Lot B ou story dediee).
    - `app/login/page.tsx` : 1 `jsx-a11y/no-autofocus` (hors scope).
    - `app/forgot-password/page.tsx` et `app/reset-password/page.tsx` : 0 violation au baseline.
  - **Estimation realiste de baisse du baseline** : minimum 1 violation (le `label-has-for` du composant Input lui-meme). Si la refonte du composant fixe **incidemment** les 2 `label-has-for` et 1 `label-has-associated-control` du `register-form.tsx` (peu probable car ils proviennent du label externe `parrainage_code` qui n'est pas modifie par cette story), le delta peut atteindre 4. **Cible AC9 : >= 1**.

- **Dette ouverte par stories precedentes (Lot A)** : aucune. Les 2.5.1, 2.5.2, 2.5.3, 2.5.4 sont done, CI verte.

- **`vercel.json` deja configure** : `buildCommand` = `"npm run lint:a11y-check && next build"`. Aucune modification de `vercel.json` n'est necessaire dans cette story.

- **Pas de pnpm** : npm uniquement (`package-lock.json`).

- **CI = Vercel preview deployments** uniquement. Pas de GitHub Actions.

- **Tailwind v4 CSS-only** : pas de `tailwind.config.ts`. Aucune modification de tokens CSS necessaire dans cette story (`--focus-ring` deja livre en 2.5.3).

- **Pas d'emojis** dans le code, les commentaires, les commits (regle stricte projet `.claude/CLAUDE.md`).

- **Convention CLAUDE.md projet** : « DoD a11y obligatoire » (regle ajoutee 2.5.1). Le template de story (`.claude/skills/bmad-create-story/template.md`) inclut deja la section DoD a11y.

### Choix techniques (justifies)

- **Pourquoi `useId` plutot qu'un id genere a la main** : React 18+ fournit `useId` qui garantit l'unicite SSR-safe et evite les collisions sur les pages avec plusieurs Inputs. Le pattern `const id = useId()` puis `<label htmlFor={id}><input id={id} ...>` est l'idiome React standard. **Ne pas utiliser** `Math.random()` (instable SSR -> hydration mismatch) ni `useState(generateId())` (overhead inutile). `useId` retourne une chaine stable entre serveur et client (par ex. `:r0:`, `:r1:`).

- **Pourquoi `<input>` enfant direct du `<label>` (nesting) + `htmlFor` (id)** : la regle `jsx-a11y/label-has-for` (legacy mais active dans `recommended` du plugin v6.x) accepte deux strategies (nesting OR htmlFor). On fait **les deux** pour neutraliser la regle quel que soit le mode de check. Robuste si la config ESLint est durcie plus tard. Le nesting est aussi recommande par WAI-ARIA pour la robustesse (cliquer sur le `<label>` focus le `<input>` meme si le navigateur a un bug avec `htmlFor`).

- **Pourquoi `aria-describedby` pour les erreurs, pas `aria-labelledby`** : le `<label>` **nomme** le champ (« Adresse email »), l'erreur le **decrit** (« Email invalide »). Pattern : `<input aria-describedby={errorId} aria-invalid={true}>...<p id={errorId} role="alert">{error}</p>`. Le `role="alert"` sur le `<p>` garantit l'annonce **immediate** par le lecteur d'ecran lors de l'apparition (sans attendre le focus). Le `aria-describedby` permet une **re-lecture** au refocus du champ. Les deux mecanismes sont complementaires.

- **Pourquoi `aria-invalid={error ? true : undefined}` plutot que `aria-invalid={!!error}`** : ne pas rendre `aria-invalid="false"` dans le DOM evite d'inonder le DOM d'attributs inutiles et est conforme a la recommandation MDN (« Pour les attributs ARIA d'etat, ne pas rendre l'attribut quand l'etat est `false` permet aux lecteurs d'ecran de mieux infer le comportement par defaut »). Pattern equivalent applique a `aria-required` et `aria-describedby`.

- **Pourquoi suffix `(obligatoire)` plutot que `aria-label="obligatoire"` sur l'asterisque** : le texte visible « (obligatoire) » est lu par le lecteur d'ecran **ET** reste comprehensible pour les utilisateurs voyants qui ne discernent pas la couleur rouge de l'asterisque (daltonisme rouge-vert affecte ~8% des hommes). Conforme WCAG 1.3.1 (information non transmise uniquement par la couleur). Alternative `<span aria-label="obligatoire">*</span>` est valide techniquement mais moins universelle (n'aide pas les daltoniens voyants).

- **Pourquoi supprimer l'asterisque rouge** : redondance avec le suffix textuel + WCAG 1.3.1. Garder l'asterisque en complement du suffix (mode hybride) cree du bruit visuel sans gain a11y. Decision : suffix textuel seul.

- **Pourquoi `text-gray-700` pour le suffix** : ratio ~7:1 sur blanc (largement conforme AA, pas FAIL comme `text-gray-500` sur certains fonds). Couleur grise qui le distingue du libelle principal `text-black` (hierarchie visuelle) sans nuire a la lisibilite. Pattern utilise ailleurs dans le repo pour les indications secondaires.

- **Pourquoi destructurer `id` des props plutot que le passer via `{...props}`** : si on ne destructure pas, le `id={finalId}` est **ecrase** par `{...props}` qui contient `id` en derniere position dans le spread. Resultat : l'`id` user override ne fonctionne pas. Solution : destructurer `id`, calculer `finalId = id ?? generatedId`, puis utiliser `id={finalId}` apres le spread (ou avant si on destructure correctement).

- **Pourquoi `<label>` enveloppe l'input meme si `label` prop n'est pas passee** : preserve la nesting et le `htmlFor` (qui satisfont les regles ESLint a11y). Le `<span>` interne avec le texte est rendu conditionnellement, mais le `<label>` lui-meme est toujours present. Comportement equivalent visuellement a l'ancien composant (pas de label visible si non passe), avec en bonus l'association semantique. Le seul cas d'usage actuel sans `label` prop est `register-form.tsx:311` ou un label externe est deja rendu -- pas de regression visuelle.

- **Pourquoi `forwardRef` est conserve** : le composant existant utilise `forwardRef<HTMLInputElement, InputProps>` pour permettre aux usagers de recuperer une ref vers l'`<input>` natif (utile pour `useRef`, focus programmatique, etc.). Pas de regression : la refonte preserve `forwardRef`, le `ref` est passe au `<input>` interne.

- **Pas de migration BDD ni de changement metier** : Lot A purement frontend / outillage. Aucun schema Supabase touche, aucun server action, aucun changement Stripe/Resend, aucun email. Rollback trivial (revert PR).

### Codebase patterns

- **Pattern composant Input accessible refonu** :
  ```tsx
  'use client'  // pas necessaire ici car le composant est purement React, mais OK pour les usagers
  import * as React from 'react'
  import { useId } from 'react'

  export interface InputProps
    extends React.InputHTMLAttributes<HTMLInputElement> {
    label?: string
    error?: string
  }

  const Input = React.forwardRef<HTMLInputElement, InputProps>(
    ({ className = '', label, error, id, ...props }, ref) => {
      const generatedId = useId()
      const finalId = id ?? generatedId
      const errorId = `${finalId}-error`

      return (
        <div className="w-full">
          <label htmlFor={finalId} className="block">
            {label && (
              <span className="block text-sm font-medium text-black mb-2">
                {label}
                {props.required && (
                  <span className="text-gray-700"> (obligatoire)</span>
                )}
              </span>
            )}
            <input
              ref={ref}
              id={finalId}
              aria-invalid={error ? true : undefined}
              aria-describedby={error ? errorId : undefined}
              aria-required={props.required ? true : undefined}
              className={`flex h-10 w-full rounded-lg border ${
                error ? 'border-red-500' : 'border-gray-400'
              } bg-white px-3 py-2 text-sm focus:outline-none focus:ring-2 ${
                error ? 'focus:ring-red-500' : 'focus:ring-focus-ring'
              } disabled:cursor-not-allowed disabled:opacity-50 ${className}`}
              {...props}
            />
            {error && (
              <p id={errorId} role="alert" className="mt-1 text-sm text-red-700">
                {error}
              </p>
            )}
          </label>
        </div>
      )
    }
  )

  Input.displayName = 'Input'

  export { Input }
  ```

- **Pattern usage avec `id` override** (cas `register-form.tsx:311` -- inchangé) :
  ```tsx
  <label htmlFor="parrainage_code" className="block text-sm font-medium text-gray-700 mb-1">
    Code de parrainage <span className="text-gray-400">(optionnel)</span>
  </label>
  <Input
    id="parrainage_code"
    name="parrainage_code"
    placeholder="Ex : K7QM2X9P"
    // ...pas de prop label, pas de prop required
  />
  ```
  Comportement : le composant Input genere un `<label>` interne (vide car `label` non passee, donc le `<span>` du texte n'est pas rendu) qui enveloppe l'input avec `htmlFor="parrainage_code"`. Le label externe a aussi `htmlFor="parrainage_code"`. Deux labels referencent le meme input -- le navigateur lit le premier (le label externe avec « Code de parrainage (optionnel) »).

### Anti-patterns a eviter

- **Ne pas utiliser `Math.random()` ou `Date.now()`** pour generer l'id : instables SSR, causent des hydration mismatches React.
- **Ne pas oublier de destructurer `id` des props** : sinon `id={finalId}` est ecrase par `{...props}` qui contient `id`.
- **Ne pas rendre `aria-invalid="false"`** : utiliser `aria-invalid={error ? true : undefined}` pour ne pas inonder le DOM. Idem pour `aria-required` et `aria-describedby`.
- **Ne pas garder l'asterisque rouge en plus du suffix textuel** (mode hybride) : redondance visuelle, pas de gain a11y, viole le principe de simplicite.
- **Ne pas utiliser `aria-labelledby` pour les erreurs** : `aria-labelledby` nomme le champ, `aria-describedby` le decrit. L'erreur est une description complementaire.
- **Ne pas rendre le `<p>` d'erreur sans `role="alert"`** : sans `role="alert"`, l'erreur n'est pas annoncee a l'apparition (seulement au refocus via `aria-describedby`). Les deux mecanismes sont complementaires.
- **Ne pas ajouter d'emoji** dans le code, les commentaires, les commits (regle stricte CLAUDE.md projet).
- **Ne pas `git add .` ni `git add -A`** : staging selectif uniquement (`git add components/ui/input.tsx ...`).
- **Ne pas pousser sur `main` directement** : creer une branche de feature `story-2-5-5-composant-input-accessible` (ou nom equivalent court).
- **Ne pas anticiper la Story 2.5.6** : header burger `aria-expanded` et `<nav aria-label>` reste pour la 2.5.6. Cette story ne touche **aucun** composant de header.
- **Ne pas anticiper le Lot B** : les ~30+ formulaires non-Input (signalement, profile-form, step-*, contact-form, etc.) avec `<input>` natifs sans label-has-for sont l'objet du Lot B. Cette story ne traite que le composant `<Input>` partage et ses 4 fichiers usagers.
- **Ne pas changer la convention de naming des erreurs** : la prop `error: string | undefined` reste. Pas d'introduction de `errors: string[]`, `errorId: string`, ou autre prop ad-hoc pour cette story.
- **Ne pas forwarder `aria-invalid` ou `aria-describedby` user-fournis** : si un usager passe `aria-invalid` ou `aria-describedby` en prop, le spread `{...props}` les override apres notre setting. Decide : c'est OK (on accepte que l'usager override). Pas de logique de merge pour cette story.
- **Ne pas oublier de regenerer le baseline** : sans regeneration, `npm run lint:a11y-check` peut signaler une « baisse » du compteur (de 160 a 159) qui sera interpretee comme une **non-regression** mais ne sera pas reflectee dans le fichier baseline -- le delta restera latent et un futur PR pourra reintroduire la violation sans CI rouge. **Toujours regenerer le baseline** apres correction de violations.

### Source tree (fichiers modifies)

**Modifies (cibles primaires)** :
- `components/ui/input.tsx` (refonte complete, ~+25 lignes : import `useId`, destructuration de `id`, calcul `finalId` et `errorId`, JSX restructuree avec `<label>` enveloppant + `<span>` interne pour le texte + suffix `(obligatoire)`, ajout `aria-invalid` / `aria-describedby` / `aria-required`, `<p>` d'erreur avec `id` et `role="alert"`).

**Crees (Task 4 -- baseline)** :
- `_bmad-output/test-artifacts/a11y-lint-baseline-2026-05-05.txt` (ou date du jour de livraison) -- nouveau fichier baseline, capture du compteur post-refonte. Aucun pointeur a mettre a jour : `scripts/check-a11y-baseline.mjs` utilise `findLatestBaseline()` qui prend automatiquement le fichier le plus recent.

**Supprimes** : aucun. L'ancien baseline `a11y-lint-baseline-2026-05-04.txt` reste pour la traçabilite historique (il n'interfere plus avec le check delta des qu'un fichier plus recent existe, grace au tri lexicographique de `findLatestBaseline()`).

**Non modifies (volontairement)** :
- `app/login/page.tsx` : aucun changement -- le composant Input refonu est utilise tel quel.
- `app/forgot-password/page.tsx` : aucun changement -- Input refonu utilise tel quel.
- `app/reset-password/page.tsx` : aucun changement -- Input refonu utilise tel quel.
- `components/auth/register-form.tsx` : aucun changement -- les 5 usages d'Input fonctionnent avec la refonte. Le label externe `parrainage_code` (lignes 305-310) reste tel quel.
- `app/globals.css` : aucun changement (token `--focus-ring` deja livre).
- `components/ui/button.tsx` : aucun changement.
- Composants headers et autres : aucun changement.

### Testing standards summary

- **Pas de tests automatises crees** par cette story (suivant convention projet, hors scope Lot A -- les tests `axe-core/Playwright` arrivent en Lot C).
- **Verification manuelle obligatoire** :
  1. `npm run lint:a11y-check` -> exit 0 apres regeneration du baseline (Task 4). Avant regeneration, si la baisse est de 1+, le check passera car « 159/160 » n'est pas une regression.
  2. `npm run build` -> Next 16 build reussi, aucune erreur TypeScript, 46 pages generees.
  3. `npx tsc --noEmit` -> aucune erreur TypeScript (verifier specifiquement la prop `id` destructuree).
  4. `npm run dev` puis test des 4 pages usagers (login email/password, register 4 etapes, forgot-password, reset-password) au clavier (Tab) : verifier le suffix « (obligatoire) » sur chaque champ requis, le focus ring orange fonce visible, le rendu visuel global identique a avant.
  5. Test manuel VoiceOver sur `/forgot-password` (Task 3) : annonces label + obligatoire + erreur (via modif temporaire). Documenter par note dans le PR.
  6. Verification de l'inspecteur d'accessibilite DevTools (alternative VoiceOver) sur le composant Input : verifier `name`, `role="textbox"`, `required: true`, `describedBy` quand erreur.
  7. Diff baseline a11y : `159/160` (ou moins) confirme dans le nouveau fichier. Documenter dans le PR.

### Project Structure Notes

- Aucun conflit avec la structure existante. Toutes les modifications se font dans 1 fichier de composant + 1 fichier de baseline.
- Pas de breaking change : la signature publique du composant `<Input>` est inchangee (`label`, `error`, `className`, plus toutes les `React.InputHTMLAttributes<HTMLInputElement>`). Les 4 fichiers usagers continuent de fonctionner sans modification.
- Le pattern `useId + htmlFor + nesting + aria-*` est **reutilisable** pour les futurs composants de formulaire (Lot B). Si une story future cree un composant `<Select>` accessible ou refonu `<Textarea>`, le meme pattern s'applique.
- L'override `id` (Task 1.3) est une feature qui previent les collisions avec des `<label>` externes (cas `parrainage_code`). Documenter cet usage dans un commentaire JSDoc sur la prop `id` est **optionnel** (la prop existe deja via `React.InputHTMLAttributes`).

### Previous story intelligence (Stories 2.5.1, 2.5.2, 2.5.3, 2.5.4)

Patterns issus des livraisons precedentes (commits `4b0ffa7`, `ba11299`, `364b4be`, `6c9ffd3`, `24dce75`, `f300277`, `d3b99bd`, `3838277`, statuts `done`) applicables ici :

- **Conventions commit** : commit sobre en francais, sans emoji, prefixe par theme. Format : `Story 2.5.5 : <description courte>`. Exemples valides :
  - `Story 2.5.5 : composant Input accessible (useId, ARIA, suffix obligatoire)`
  - `Story 2.5.5 : refonte composant Input accessible`
  - `Story 2.5.5 : statut done apres CI Vercel verte` (commit de cloture).
- **CI Vercel verte = prerequis du merge** : confirmation explicite par l'utilisateur Sylvain sur les 2.5.1, 2.5.2, 2.5.3, 2.5.4. Meme regle pour la 2.5.5. Statut « done » UNIQUEMENT apres CI verte.
- **Mode `warn` ESLint** : la 2.5.1 a downgrade tous les `error` en `warn` au demarrage. Le check delta passe par `npm run lint:a11y-check` qui compare paire `(fichier, regle)`. Cette story doit **regenerer** le baseline (Task 4) car elle change activement le compteur.
- **Baseline existant a respecter** : `_bmad-output/test-artifacts/a11y-lint-baseline-2026-05-04.txt` capture 160 violations. Apres livraison 2.5.5, le baseline doit etre regenere et le compteur doit avoir baisse d'au moins 1.
- **Approche pragmatique sur les divergences tech-spec / realite repo** : les stories precedentes ont herite d'une serie d'ecarts documentes dans la section « Realites projet » du tech-spec (npm, Vercel, Tailwind v4, ESM, pas d'emoji). Cette 2.5.5 herite egalement -- voir `_bmad-output/implementation-artifacts/tech-spec-lot-a-a11y.md` section « Realites projet (constat 2026-05-04) ».
- **Reflexe « Tasks atomiques + commits petits »** : la 2.5.5 est plus contenue que la 2.5.3 (1 fichier de composant principalement), un commit unique pour l'implementation est suffisant, plus 1 commit pour la regeneration du baseline (peut etre fusionne dans le commit principal), plus 1 commit final « statut done apres CI verte ».
- **Code review systematique** : les 2.5.3 et 2.5.4 ont declenche un `bmad-code-review` adversarial 3-layers (Blind Hunter, Edge Case Hunter, Acceptance Auditor) qui a remonte des findings critiques (notamment la stale closure `reducedMotion` dans la 2.5.4). Pour la 2.5.5, **lancer un code review** apres implementation complete avant merge -- le composant Input etant central, toute regression a un fort blast radius.
- **Test manuel obligatoire** : le tech-spec impose un test VoiceOver sur 1 formulaire critique (Task 17 du tech-spec). Documenter dans le PR -- pas optionnel.
- **Pas de useId / aria-* en place avant cette story** : confirme. La 2.5.5 est la **premiere** story du Lot A a introduire des attributs ARIA dans des composants partages. Les stories suivantes (2.5.6 burger header) appliqueront le meme pattern.

### Git intelligence summary

Recents commits (verifies au cadrage) :

- `3838277` Story 2.5.4 : statut done apres CI Vercel verte
- `d3b99bd` Story 2.5.4 : prefers-reduced-motion globale et carte hero
- `f300277` Story 2.5.3 : statut done apres CI Vercel verte
- `24dce75` Story 2.5.3 : token focus global et palette de contrastes
- `6c9ffd3` Story 2.5.2 : statut done apres CI Vercel verte
- `364b4be` Story 2.5.2 : skip-link et structure layout
- `ba11299` Story 2.5.1 : statut done apres CI Vercel verte
- `4b0ffa7` Story 2.5.1 : outillage ESLint a11y et baseline lint

Pattern observe : 2 commits par story (un pour l'implementation, un pour le passage en done apres CI verte). Cette story 2.5.5 peut suivre la meme convention. La regeneration du baseline (Task 4) peut etre committee dans le meme commit que l'implementation, ou separement (`Story 2.5.5 : regeneration baseline a11y post-Input refonte`).

### Latest tech information

- **`useId` (React 18+)** : hook standard pour generer des ids uniques SSR-safe. Documentation : https://react.dev/reference/react/useId. Pattern : `const id = useId()`. Retourne une chaine au format `:r0:`, `:r1:`, etc. Fonctionne avec `forwardRef`. Pas de breaking change attendu en React 19 (utilise par le projet via Next 16).
- **WAI-ARIA `aria-describedby`** : attribut qui pointe sur l'`id` d'un (ou plusieurs) elements decrivant le champ. Le lecteur d'ecran lit le contenu de l'element pointe **apres** le label. Reference : https://www.w3.org/TR/wai-aria-1.2/#aria-describedby. Compat universelle (NVDA, VoiceOver, JAWS).
- **WAI-ARIA `role="alert"`** : annonce immediate du contenu de l'element a l'apparition (ou a la mise a jour si le contenu change). Equivalent a `aria-live="assertive" aria-atomic="true"`. Pattern recommande pour les messages d'erreur de validation. Reference : https://www.w3.org/TR/wai-aria-1.2/#alert.
- **WAI-ARIA `aria-invalid`** : indique que le champ est en erreur. Valeurs : `"true"`, `"false"`, `"grammar"`, `"spelling"`. Pour cette story, on utilise `"true"` quand erreur, et **on ne rend pas l'attribut** quand pas d'erreur. Reference : https://www.w3.org/TR/wai-aria-1.2/#aria-invalid.
- **WAI-ARIA `aria-required`** : indique qu'un champ doit etre rempli pour soumettre le formulaire. Le `required` HTML implique deja `aria-required="true"` selon la spec ARIA, mais expliciter prend en charge les implementations imparfaites. Reference : https://www.w3.org/TR/wai-aria-1.2/#aria-required.
- **WCAG 2.2 -- 1.3.1 Information and Relationships** : « L'information, la structure et les relations vehiculees par la presentation peuvent etre determinees par programme ou sont disponibles dans le texte ». L'asterisque rouge seule viole ce critere car la couleur est porteuse de l'information « obligatoire » sans equivalent textuel. Le suffix « (obligatoire) » resout cette violation.
- **WCAG 2.2 -- 3.3.1 Error Identification, 3.3.2 Labels or Instructions, 3.3.3 Error Suggestion** : couverts par `aria-describedby` + `role="alert"` (3.3.1), `<label htmlFor>` + suffix (3.3.2), et la prop `error` qui peut contenir une suggestion (3.3.3, geree par les usagers du composant).
- **`eslint-plugin-jsx-a11y` v6.x** : la regle `label-has-for` est dans la config `recommended` mais marquee deprecated. Elle requiert **soit** `htmlFor` **soit** un `<input>` nested. La regle plus moderne `label-has-associated-control` accepte les deux mais avec une heuristique differente. Faire **les deux** (htmlFor + nesting) couvre toutes les configurations possibles. Reference : https://github.com/jsx-eslint/eslint-plugin-jsx-a11y/tree/main/docs/rules.

### References

- [Source: _bmad-output/implementation-artifacts/tech-spec-lot-a-a11y.md#Story-2.5.5] -- tech-spec source de la story (Tasks 15-17)
- [Source: _bmad-output/implementation-artifacts/tech-spec-lot-a-a11y.md#Acceptance-Criteria] -- ACs 14-17 du tech-spec
- [Source: _bmad-output/planning-artifacts/audit-a11y-2026-05-04.md#2.3-Composant-Input-partage] -- audit a11y, points sur htmlFor manquant, asterisque rouge, erreur non liee
- [Source: _bmad-output/planning-artifacts/prd.md#Accessibilite] -- NFR a11y, criteres C1, C2, C3 (Formulaires)
- [Source: _bmad-output/test-artifacts/nfr-assessment-a11y-2026-05-04.md#C1] -- NFR a11y, critere C1 et seuils mesurables (FAIL au baseline)
- [Source: _bmad-output/test-artifacts/nfr-assessment-a11y-2026-05-04.md#C2] -- NFR a11y, critere C2 partiel
- [Source: _bmad-output/test-artifacts/nfr-assessment-a11y-2026-05-04.md#C3] -- NFR a11y, critere C3 (CONCERNS)
- [Source: _bmad-output/test-artifacts/a11y-lint-baseline-2026-05-04.txt] -- baseline 160 violations, dont `components/ui/input.tsx` 1 `label-has-for`
- [Source: _bmad-output/implementation-artifacts/2-5-1-outillage-a11y-baseline-lint.md] -- story Lot A 1, outillage ESLint et baseline 160
- [Source: _bmad-output/implementation-artifacts/2-5-2-skip-link-et-structure-layout.md] -- story Lot A 2, skip-link et structure layout (`<main id="main-content">`)
- [Source: _bmad-output/implementation-artifacts/2-5-3-token-focus-global-et-palette-de-contrastes.md] -- story Lot A 3, token focus et palette (border-gray-400, focus:ring-focus-ring, text-red-700 deja appliques au composant Input)
- [Source: _bmad-output/implementation-artifacts/2-5-4-prefers-reduced-motion.md] -- story Lot A 4, prefers-reduced-motion (sans impact direct ici)
- [Source: components/ui/input.tsx] -- composant cible, etat actuel 36 lignes
- [Source: app/login/page.tsx#L66,L99] -- 2 usages Input (email + password)
- [Source: app/forgot-password/page.tsx#L59] -- 1 usage Input (email, le plus simple pour test VoiceOver)
- [Source: app/reset-password/page.tsx#L58] -- 1 usage Input (password)
- [Source: components/auth/register-form.tsx#L272,L281,L311,L377,L398] -- 5 usages Input, dont `parrainage_code` ligne 311 avec `id` override
- [Source: components/auth/register-form.tsx#L305-L310] -- label externe `parrainage_code` qui doit cohabiter avec le label interne du composant Input refonu
- [Source: scripts/build-a11y-baseline.mjs] -- script de regeneration du baseline
- [Source: scripts/check-a11y-baseline.mjs] -- wrapper CI delta
- [Source: vercel.json] -- buildCommand `npm run lint:a11y-check && next build` deja en place
- [Source: WCAG 2.2 AA, criterion 1.3.1 Information and Relationships] -- exigence info pas uniquement par couleur (justifie suppression asterisque rouge)
- [Source: WCAG 2.2 AA, criterion 3.3.1 Error Identification] -- exigence d'annonce des erreurs (justifie aria-describedby + role=alert)
- [Source: WCAG 2.2 AA, criterion 3.3.2 Labels or Instructions] -- exigence label associe (justifie htmlFor + nesting)
- [Source: WAI-ARIA 1.2 -- aria-describedby] -- https://www.w3.org/TR/wai-aria-1.2/#aria-describedby
- [Source: WAI-ARIA 1.2 -- alert role] -- https://www.w3.org/TR/wai-aria-1.2/#alert
- [Source: WAI-ARIA 1.2 -- aria-invalid] -- https://www.w3.org/TR/wai-aria-1.2/#aria-invalid
- [Source: WAI-ARIA 1.2 -- aria-required] -- https://www.w3.org/TR/wai-aria-1.2/#aria-required
- [Source: React useId hook] -- https://react.dev/reference/react/useId
- [Source: eslint-plugin-jsx-a11y label-has-for rule] -- https://github.com/jsx-eslint/eslint-plugin-jsx-a11y/blob/main/docs/rules/label-has-for.md
- [Source: eslint-plugin-jsx-a11y label-has-associated-control rule] -- https://github.com/jsx-eslint/eslint-plugin-jsx-a11y/blob/main/docs/rules/label-has-associated-control.md

## Dev Agent Record

### Agent Model Used

Claude Opus 4.7 (1M context) -- BMad dev-story workflow, 2026-05-05.

### Debug Log References

- `npx tsc --noEmit` : aucune erreur TypeScript (exit 0).
- `npm run lint:a11y-check` (avant regeneration) : `OK: 159 jsx-a11y violations across 58 (file, rule) pair(s). Baseline total: 160. No regression.` -- baisse de -1 confirmee (la violation `jsx-a11y/label-has-for (1)` sur `components/ui/input.tsx` a disparu).
- `npm run build` : Compiled successfully in 2.3s, 46 pages generees, aucun warning React.
- `node scripts/build-a11y-baseline.mjs` : `Baseline written: a11y-lint-baseline-2026-05-05.txt`. Total : 159 (errors: 0, warnings: 159).
- `npm run lint:a11y-check` (apres regeneration) : `OK: 159 jsx-a11y violations across 58 (file, rule) pair(s). Baseline total: 159. No regression.` -- pointe bien sur le nouveau baseline (`findLatestBaseline()` OK).
- Diff baseline 2026-05-04 -> 2026-05-05 : suppression de la paire `components/ui/input.tsx` / `jsx-a11y/label-has-for (1)`. Total `jsx-a11y/label-has-for` : 77 -> 76. Aucune autre regression silencieuse.

### Completion Notes List

- **Refonte composant Input accomplie** : `components/ui/input.tsx` passe de 36 a 53 lignes. Import `useId` ajoute, prop `id` destructuree pour permettre l'override, `finalId = id ?? generatedId`, `errorId = ${finalId}-error`. Structure JSX refondue : `<label htmlFor={finalId}>` enveloppe un `<span>` interne (texte conditionnel `{label && ...}`) + l'`<input>` enfant direct (nesting + htmlFor pour neutraliser `jsx-a11y/label-has-for`) + le `<p>` d'erreur (avec `id={errorId}` et `role="alert"`). ARIA conditionnels : `aria-invalid={error ? true : undefined}`, `aria-describedby={error ? errorId : undefined}`, `aria-required={props.required ? true : undefined}`. Asterisque rouge supprimee, remplacee par suffix textuel `<span className="text-gray-700"> (obligatoire)</span>` (WCAG 1.3.1 conforme, ratio ~7:1 sur blanc).
- **Cas `parrainage_code` (override `id`) preserve** : `register-form.tsx:311` passe `id="parrainage_code"`. La destructuration de `id` evite le double attribut. Le label externe ligne 305-310 reste fonctionnel (deux `<label>` referencent le meme input -- comportement non regressif, le label externe est lu en premier par les lecteurs d'ecran). Aucun changement dans `register-form.tsx`.
- **Propagation aux 4 fichiers usagers verifiee par lecture** : `app/login/page.tsx` (email + password, both `required`), `app/forgot-password/page.tsx` (email, `required`), `app/reset-password/page.tsx` (password, `required`, `minLength={8}`), `components/auth/register-form.tsx` (firstName, lastName, parrainage_code, email, password). Tous les usages preservent `name`, `value`, `onChange`, `autoFocus`, `required`, `placeholder`, `type` -- tous heritent via `{...props}`.
- **Baseline a11y regenere** : `_bmad-output/test-artifacts/a11y-lint-baseline-2026-05-05.txt` cree. Total 159 (vs 160). Baisse exactement de 1, conforme a la cible AC9 (baisse minimum 1). Les violations `register-form.tsx` (`label-has-for x2` + `label-has-associated-control x1`) ne sont pas resolues incidemment (label externe `parrainage_code` non touche, conforme au cadrage). L'ancien baseline `a11y-lint-baseline-2026-05-04.txt` est conserve pour la traçabilite historique.
- **Tests automatises hors scope** : conformement a la convention Lot A (les tests `axe-core/Playwright` arrivent en Lot C), aucun test unitaire ou e2e cree par cette story.
- **Restant a faire par l'utilisateur Sylvain** :
  - Task 2.2 : verification visuelle des 4 pages usagers en `npm run dev` (le composant a ete inspecte par lecture, mais pas teste visuellement par le LLM).
  - Task 3 (test manuel VoiceOver) : `/forgot-password` (cas simple, AC8 test 1) **ET** `/register?role=accompagnante` (cas mixte requis/optionnel, AC8 test 2). Documenter les annonces VoiceOver dans le PR.
  - Task 4.5 : commit du baseline regenere (et du composant) selon convention Lot A : `Story 2.5.5 : composant Input accessible (baseline 159)`.
  - Task 5.2-5.5 : push branche, validation CI Vercel verte, commit final `Story 2.5.5 : statut done apres CI Vercel verte`, passage du status `review` -> `done`.

### File List

**Modifies** :
- `components/ui/input.tsx` -- refonte complete : import `useId`, destructuration de `id`, calcul `finalId`/`errorId`, JSX restructuree avec `<label>` enveloppant + `<span>` interne pour le texte + suffix `(obligatoire)`, ajout `aria-invalid`/`aria-describedby`/`aria-required` conditionnels, `<p>` d'erreur avec `id={errorId}` et `role="alert"`.
- `_bmad-output/implementation-artifacts/2-5-5-composant-input-accessible.md` -- mise a jour dev-story (tasks cochees, Dev Agent Record renseigne, File List, Change Log, Status `review`).

**Crees** :
- `_bmad-output/test-artifacts/a11y-lint-baseline-2026-05-05.txt` -- nouveau baseline a11y (159 violations vs 160 precedemment).

**Non modifies (volontairement)** :
- `app/login/page.tsx`, `app/forgot-password/page.tsx`, `app/reset-password/page.tsx`, `components/auth/register-form.tsx` -- aucun changement, le composant Input refondu est utilise tel quel.
- `_bmad-output/test-artifacts/a11y-lint-baseline-2026-05-04.txt` -- conserve pour traçabilite historique (n'interfere plus avec le check delta).

### Change Log

| Date | Auteur | Changement |
|------|--------|------------|
| 2026-05-05 | Claude (BMad create-story) | Creation initiale de la story 2.5.5 a partir du tech-spec Lot A (Tasks 15-17, ACs 14-17), du NFR (criteres C1, C2, C3), et du composant Input actuel `components/ui/input.tsx` (36 lignes, sans htmlFor / ARIA / suffix textuel). 4 fichiers usagers identifies (login, register-form, forgot-password, reset-password). Cas particulier `parrainage_code` (`register-form.tsx:311` avec `id` override) documente. Effort estime : 1 j-dev. Status `ready-for-dev`. |
| 2026-05-05 | Claude (BMad create-story, amendement Sylvain) | 3 precisions integrees avant lancement dev-story : (1) **AC8 et Task 3 elargis** : test VoiceOver couvre desormais `/forgot-password` (cas simple) **ET** `/register?role=accompagnante` (cas mixte requis/optionnel) pour valider les variantes ARIA conditionnelles -- specifiquement que `parrainage_code` n'annonce pas « obligatoire » (pas de prop `required`, donc `aria-required` absent et pas de suffix). (2) **Task 4 simplifiee** : verifie `scripts/check-a11y-baseline.mjs` -- la fonction `findLatestBaseline()` prend automatiquement le fichier le plus recent par tri lexicographique sur la date ISO. **Aucun pointeur a mettre a jour** apres creation de `a11y-lint-baseline-2026-05-05.txt`. AC9 amende : verification explicite post-regeneration que le check pointe bien sur le nouveau baseline (sortie console). (3) **Note de derive Lot A** : 1 j-dev annonce vs 0,75 j prevu au tech-spec (synthese), +8% sur le total Lot A (3,5 j vs 3,25 j). Acceptable, a noter pour la retro Lot A post-2.5.6. |
| 2026-05-05 | Claude (BMad dev-story) | Implementation : refonte `components/ui/input.tsx` (53 lignes), `useId` + `forwardRef` + override `id`, ARIA conditionnels (`aria-invalid`/`aria-describedby`/`aria-required`), suffix textuel `(obligatoire)` (gris fonce, ratio ~7:1) en remplacement de l'asterisque rouge, `<p>` d'erreur avec `role="alert"` et `id={errorId}`. Verifications passees : `npx tsc --noEmit` (0 erreur), `npm run build` (46 pages OK), `npm run lint:a11y-check` (159 vs 160, baisse de 1 conforme AC9). Baseline regenere `a11y-lint-baseline-2026-05-05.txt`. Status `ready-for-dev` -> `review`. **Reste pour Sylvain** : test manuel VoiceOver Task 3 (sur `/forgot-password` ET `/register?role=accompagnante`), commit + push, validation CI Vercel verte, statut `done`. |

## DoD a11y

A renseigner pour toute story avec impact UI. Cette story a un impact UI direct (refonte du composant Input central) :

- [x] Labels associes aux champs (`htmlFor` ou `aria-labelledby`) -- **LIVRE** : `htmlFor={finalId}` + nesting `<input>` enfant du `<label>`. Violation `jsx-a11y/label-has-for (1)` sur `components/ui/input.tsx` neutralisee (verifie via diff baseline 2026-05-04 vs 2026-05-05).
- [x] Erreurs liees aux champs via `aria-describedby` + `aria-invalid` -- **LIVRE** : `aria-describedby={error ? errorId : undefined}` + `aria-invalid={error ? true : undefined}` + `<p id={errorId} role="alert">` quand `error`. Pattern conditionnel evite d'inonder le DOM d'attributs ARIA inutiles.
- [x] Focus visible sur tous les elements interactifs (contraste >= 3:1) -- **DEJA LIVRE par 2.5.3** et preserve : `focus:ring-focus-ring` (orange fonce) ou `focus:ring-red-500` en erreur. Aucun changement par cette story.
- [x] Contrastes texte >= 4,5:1 et UI >= 3:1 -- **OK** : `border-gray-400`, `text-red-700` (livres en 2.5.3) + suffix « (obligatoire) » en `text-gray-700` (ratio ~7:1 sur blanc, conforme AA).
- [x] ARIA states corrects sur composants dynamiques (`aria-expanded`, `aria-selected`, etc.) -- **N/A** (Input non dynamique). Les ARIA pertinents (`aria-invalid`, `aria-required`, `aria-describedby`) sont couverts par les cases 1 et 2 ci-dessus.
- [x] Navigation clavier complete (Tab, Enter, Escape, fleches selon pattern) -- **PRESERVEE** : aucun changement de comportement clavier, `<input>` reste focusable au Tab, le wrapping `<label>` n'interfere pas.
- [ ] Verification ponctuelle au lecteur d'ecran (VoiceOver ou NVDA) sur le composant touche -- **A FAIRE PAR SYLVAIN** (Task 3) : test VoiceOver macOS sur **`/forgot-password`** (cas simple) **ET** sur **`/register?role=accompagnante`** (cas mixte requis/optionnel pour valider les variantes ARIA conditionnelles). Documenter dans le PR par 2 notes explicites.
- [x] Pas de regression `eslint-plugin-jsx-a11y` (`npm run lint:a11y-check` vert en CI) -- **OK** : baseline regenere `a11y-lint-baseline-2026-05-05.txt` (159 violations vs 160), baisse de 1 conforme AC9. Verification CI Vercel verte = a confirmer apres push (Task 5.2).
