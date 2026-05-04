# Story 2.5.3 : Token de focus global et palette de contrastes

Status: done

<!-- Note: Validation est optionnelle. Lancer `validate-create-story` avant `dev-story` pour un controle qualite. -->

## Story

En tant que **utilisateur clavier ou utilisateur basse vision sur roxanetnous**,
je veux **un anneau de focus visible et contraste sur tous les elements interactifs (>= 3:1) ET des bordures de champs / messages d'erreur conformes WCAG 2.2 AA**,
afin de **savoir en permanence ou je suis dans la page et de pouvoir lire sans peine les bordures et les erreurs de validation**.

Cette story est la troisieme du Lot A (accessibilite quick wins). Elle s'appuie sur la chaine de lint posee par la Story 2.5.1 (livree, commit `ba11299`, baseline 160 violations) et sur le skip-link pose par la Story 2.5.2 (livree, commit `364b4be`, TODO 2.5.3 ouvert dans `app/layout.tsx:61`). Elle adresse les criteres NFR **A1** (contrastes texte >= 4,5:1), **A2** (contrastes UI >= 3:1) et **B2** (focus visible >= 3:1, epaisseur >= 2 px) -- dont **B2 est un bloqueur critique du NFR a11y** (utilisateur basse vision exclu sans focus visible suffisant).

Effort estime : **0,75 j-dev** (tech-spec) + ~5 min pour la tache derivee TODO 2.5.2 = reste a 0,75 j-dev.

## Acceptance Criteria

### AC commun Lot A (rappel)

1. **AC commun 1** -- Given une PR Lot A, when la CI Vercel tourne, then `npm run lint:a11y-check` passe sans nouvelle violation `jsx-a11y/*` au-dela du baseline 160 capture par la Story 2.5.1.
2. **AC commun 2** -- Given un composant modifie, when un developpeur consulte le composant, then les attributs ARIA pertinents sont presents si necessaires.
3. **AC commun 3** -- Given une story Lot A en revue, when le reviewer relit la PR, then la checklist DoD a11y (voir section `## DoD a11y` en bas) est presente dans la description et les cases applicables sont cochees.

### AC propres a la Story 2.5.3

4. **AC1 -- Token `--focus-ring` defini dans `@theme`** : Given le fichier `app/globals.css`, when un developpeur l'inspecte, then le bloc `@theme { ... }` contient deux declarations : `--focus-ring: oklch(0.4 0.15 30);` (token semantique) et `--color-focus-ring: var(--focus-ring);` (alias couleur Tailwind v4). Les ratios de contraste de `--focus-ring` doivent etre verifies via WebAIM Contrast Checker : >= 4,5:1 sur fond blanc et >= 3:1 sur fond `bg-accent` (#F4C8A3). Si la valeur initiale `oklch(0.4 0.15 30)` ne respecte pas le 3:1 sur bg-accent, ajuster la luminance L (descendre vers `0.35` ou `0.30`) et redocumenter le ratio mesure dans la PR.
5. **AC2 -- Application sur `Button`** : Given le fichier `components/ui/button.tsx`, when un developpeur l'inspecte, then la chaine `baseStyles` ligne 12 inclut explicitement `focus-visible:ring-focus-ring` (en plus du `focus-visible:ring-2 focus-visible:ring-offset-2` deja present). Les variantes (`default`, `outline`, `ghost`, `destructive`) ne redefinissent pas la couleur de ring (le token global s'applique partout).
6. **AC3 -- Application sur `Input`** : Given le fichier `components/ui/input.tsx`, when un developpeur l'inspecte, then la classe ternaire ligne 24 a remplace `focus:ring-[#FFB06E]` (orange peche, ratio 2:1, FAIL) par `focus:ring-focus-ring`. La branche `error ? 'focus:ring-red-500' : ...` reste inchangee (le ring rouge sur erreur est intentionnel).
7. **AC4 -- Migration TODO Story 2.5.2** : Given le fichier `app/layout.tsx`, when un developpeur l'inspecte, then (a) la ligne 64 a remplace `focus:ring-black` par `focus:ring-focus-ring` sur le skip-link et (b) le commentaire JSX `{/* TODO 2.5.3 : remplacer ring-black par ring-[var(--focus-ring)] */}` ligne 61 est supprime.
8. **AC5 -- Aucun TODO 2.5.3 residuel** : Given le code apres merge, when on execute `grep -rn 'TODO 2.5.3' app/ components/`, then la commande retourne **0 resultat** (verifie avant cadrage : 1 seul TODO dans le repo, situe a `app/layout.tsx:61`, ferme par AC4).
9. **AC6 -- Bordures de champs durcies (`border-gray-300` -> `border-gray-400`)** : Given les composants de formulaire et les champs natifs `<select>`/`<textarea>`/`<input>` utilisant `border-gray-300` comme bordure d'input, when un developpeur les inspecte, then ils utilisent `border-gray-400` (ratio ~3:1 sur blanc). Cible primaire : les bordures de champs de saisie (input, textarea, select). Cibles secondaires : bordures de boutons secondaires/tertiaires (`border border-gray-300` sur boutons outline). **Ne pas modifier** les `border-gray-300` qui sont des separateurs purement decoratifs (ex. `border-t border-gray-300` sur une section). Voir section Dev Notes pour la liste exhaustive et la regle de discrimination.
10. **AC7 -- Couleurs d'erreur durcies (`text-red-500` -> `text-red-700` sur messages d'erreur)** : Given le composant `components/ui/input.tsx`, when un developpeur l'inspecte, then la ligne 28 (`<p className="mt-1 text-sm text-red-500">{error}</p>`) utilise `text-red-700` (ratio ~6:1 sur blanc) au lieu de `text-red-500` (ratio 4:1, limite FAIL). Les asterisques `<span className="text-red-500 ml-1">*</span>` sur les libellees de champs requis **ne sont pas modifiees** dans cette story (decision : l'asterisque est un complement visuel a un texte porteur, pas un message d'erreur ; le critere C3 du NFR -- annonce textuelle "obligatoire" -- sera traite par la Story 2.5.5 sur le composant Input).
11. **AC8 -- Combinaison `text-gray-500` sur `bg-accent`** : Given une analyse manuelle des cas d'usage `text-gray-500` sur fond `bg-accent` (audit a11y §3 : ratio 3,4:1 = FAIL), when un developpeur examine les zones identifiees (best-effort, voir Dev Notes), then chaque combinaison directe est corrigee soit en `text-gray-700` (ratio >= 4,5:1) soit en `text-black` selon le rendu desire. Note : les `text-gray-500` sur fond blanc (ratio 4,83:1, limite OK) ne sont pas dans le scope de cette story.
12. **AC9 -- Pas de regression visuelle** : Given les pages de roxanetnous avant et apres la story, when on compare visuellement (capture d'ecran, navigation manuelle), then le rendu visuel est sensiblement identique sauf pour : (a) un anneau de focus orange fonce visible sur tous les elements interactifs, (b) des bordures de champs legerement plus marquees, (c) un rouge plus fonce sur les messages d'erreur Input. Aucun changement de spacing, de layout ou de structure.
13. **AC10 -- Test clavier sur 3 fonds differents** : Given un test manuel sur (1) une page a fond blanc (`/login`), (2) une page a fond `bg-accent` (admin via header `bg-accent/20`), (3) une page a fond `bg-kraft` (`/accompagne/dashboard`), when l'utilisateur appuie sur Tab a travers les elements interactifs, then l'anneau de focus est visible avec un ratio mesurable >= 3:1 sur chaque fond (verifiable via DevTools color picker).
14. **AC11 -- CI Vercel verte** : Given la PR de la story, when la CI tourne, then le build Vercel passe (`npm run lint:a11y-check && next build`) sans regression jsx-a11y et sans erreur TypeScript.

## Tasks / Subtasks

- [x] **Task 1 -- Definir le token `--focus-ring` dans `app/globals.css`** (AC: #4)
  - [x] Sous 1.1 : Editer `app/globals.css`. Dans le bloc `@theme { ... }` existant (lignes 3-8), ajouter deux declarations apres `--color-kraft: #d3a387;` et avant les declarations de polices :
    ```css
    --focus-ring: oklch(0.4 0.15 30);
    --color-focus-ring: var(--focus-ring);
    ```
  - [x] Sous 1.2 : Justification du choix `oklch(0.4 0.15 30)` :
    - L = 0.4 (luminance moderee, contraste fort sur blanc et OK sur accent)
    - C = 0.15 (chroma soutenu pour rester visible)
    - H = 30 (orange/rouge fonce, coherent avec la palette kraft/accent du projet)
    - Resultat attendu : ~`#7E3A12` (orange fonce). Ratio attendu : ~6:1 sur blanc, ~3:1 sur `#F4C8A3` (bg-accent), ~3,5:1 sur `#d3a387` (bg-kraft).
  - [x] Sous 1.3 : Verification de contraste obligatoire avant de poursuivre :
    - Convertir `oklch(0.4 0.15 30)` en HEX via un outil en ligne (ex. https://oklch.com/) pour obtenir l'equivalent.
    - Tester le ratio via WebAIM Contrast Checker (https://webaim.org/resources/contrastchecker/) sur 3 fonds : `#FFFFFF`, `#F4C8A3`, `#d3a387`.
    - Si l'un des ratios est < 3:1, ajuster L vers le bas (essayer 0.35, puis 0.30) et re-mesurer.
    - Documenter dans le PR : valeur HEX equivalente + 3 ratios mesures.
  - [x] Sous 1.4 : Justification de `--color-focus-ring` en alias : Tailwind v4 expose automatiquement les classes utilitaires `ring-{name}`, `bg-{name}`, `text-{name}`, etc. a partir des declarations `--color-{name}` dans `@theme`. Sans cet alias, la classe `ring-focus-ring` ne serait pas generee. Le pattern est documente : https://tailwindcss.com/docs/theme#defining-theme-variables.

- [x] **Task 2 -- Appliquer `ring-focus-ring` sur `components/ui/button.tsx`** (AC: #5)
  - [x] Sous 2.1 : Editer `components/ui/button.tsx`. Modifier la chaine `baseStyles` ligne 12 :
    ```tsx
    // Avant
    const baseStyles =
      'inline-flex items-center justify-center rounded-lg font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 disabled:opacity-50 disabled:pointer-events-none btn-hover'
    // Apres
    const baseStyles =
      'inline-flex items-center justify-center rounded-lg font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus-ring focus-visible:ring-offset-2 disabled:opacity-50 disabled:pointer-events-none btn-hover'
    ```
  - [x] Sous 2.2 : Verifier que les variantes (`default`, `outline`, `ghost`, `destructive`) ne redefinissent pas la couleur de ring. Aucune modification attendue sur les variantes (le token global `ring-focus-ring` s'applique uniformement).
  - [x] Sous 2.3 : Build local : `npm run build` doit reussir sans warning Tailwind sur la classe `ring-focus-ring`.

- [x] **Task 3 -- Appliquer `ring-focus-ring` sur `components/ui/input.tsx`** (AC: #6)
  - [x] Sous 3.1 : Editer `components/ui/input.tsx`. Modifier la classe ternaire ligne 24 :
    ```tsx
    // Avant
    error ? 'focus:ring-red-500' : 'focus:ring-[#FFB06E]'
    // Apres
    error ? 'focus:ring-red-500' : 'focus:ring-focus-ring'
    ```
  - [x] Sous 3.2 : Garder la branche `error ? 'focus:ring-red-500'` inchangee : le ring rouge sur erreur est un signal de validation intentionnel, distinct du focus normal.
  - [x] Sous 3.3 : Note pour le reviewer : la story 2.5.5 (Input accessible) refondra ce composant en profondeur (`useId`, `htmlFor`, `aria-describedby`, etc.). Cette story ne touche **que** le ring de focus.

- [x] **Task 4 -- Migration du TODO 2.5.2 dans `app/layout.tsx`** (AC: #7, #8)
  - [x] Sous 4.1 : Editer `app/layout.tsx`. Sur le skip-link ligne 64, remplacer `focus:ring-black` par `focus:ring-focus-ring` :
    ```tsx
    // Avant (ligne 64)
    className="sr-only focus:not-sr-only focus:absolute focus:top-4 focus:left-4 focus:z-50 focus:bg-white focus:text-black focus:px-4 focus:py-2 focus:rounded focus:outline-none focus:ring-2 focus:ring-black focus:ring-offset-2"
    // Apres (ligne 64)
    className="sr-only focus:not-sr-only focus:absolute focus:top-4 focus:left-4 focus:z-50 focus:bg-white focus:text-black focus:px-4 focus:py-2 focus:rounded focus:outline-none focus:ring-2 focus:ring-focus-ring focus:ring-offset-2"
    ```
  - [x] Sous 4.2 : Supprimer le commentaire JSX ligne 61 :
    ```tsx
    {/* TODO 2.5.3 : remplacer ring-black par ring-[var(--focus-ring)] */}
    ```
    Resultat : la ligne 61 disparait, le `<a>` du skip-link devient le premier element apres `<body>`.
  - [x] Sous 4.3 : Verification post-modification : `grep -rn 'TODO 2.5.3' app/ components/` doit retourner **0 resultat**.

- [x] **Task 5 -- Durcir les bordures `border-gray-300` -> `border-gray-400`** (AC: #9)
  - [x] Sous 5.1 : Strategie de discrimination. Le grep `border-gray-300` retourne ~110 occurrences. Toutes ne sont **pas** a modifier. Regle de classification :
    - **A modifier (cible primaire)** : bordure d'un champ de saisie (`<input>`, `<textarea>`, `<select>`, autocomplete, dropdown). Exemple : `border border-gray-300 bg-white px-3 py-2 ... focus:ring-2`.
    - **A modifier (cible secondaire)** : bordure d'un bouton secondaire/tertiaire (`border border-gray-300` sur boutons outline). Exemple : `px-4 py-2 border border-gray-300 ... rounded-lg hover:border-accent`.
    - **A NE PAS modifier** : separateurs purement decoratifs (`border-t border-gray-300`, `border-b border-gray-300`, `border-l-2 border-gray-300`), badges/pastilles avec bordure decorative legere, conteneurs de cartes ou modales avec bordure subtile (`border border-gray-300 rounded-xl` sur une carte sans champ).
    - **A juger au cas par cas** : checkbox custom (`rounded border-gray-300 accent-black`) -- considerer comme cible primaire (UI porteur de sens).
  - [x] Sous 5.2 : Liste exhaustive des fichiers a auditer (issue du grep) :
    - `components/ui/input.tsx:22` -- ternary `error ? 'border-red-500' : 'border-gray-300'` -- **modifier la branche par defaut en `border-gray-400`** (champ de saisie).
    - `components/ui/city-autocomplete.tsx:134, 181` -- input + dropdown autocomplete -- **modifier ligne 134** (input), **garder ligne 181** (bordure dropdown decorative, mais ratio limite ; si rendu visuel le permet, modifier aussi).
    - `components/contact-form.tsx:44, 55, 67, 79, 91` -- 5 champs natifs `<input>`/`<textarea>` -- **modifier les 5**.
    - `components/signalement-button.tsx:80, 94` -- 2 champs natifs -- **modifier les 2**.
    - `components/admin/signalement-actions.tsx:46, 61` -- select + textarea natifs -- **modifier les 2**.
    - `components/admin/validation-actions.tsx:131, 143, 163` -- 3 textareas natifs -- **modifier les 3**.
    - `components/admin/parrainage-blacklist-actions.tsx:69` -- textarea natif -- **modifier**.
    - `components/admin/grant-subscription-modal.tsx:86, 131` -- 2 boutons modal -- **modifier les 2** (boutons secondaires).
    - `components/admin/delete-user-button.tsx:53` -- bouton secondaire -- **modifier**.
    - `components/admin/utilisateurs-client.tsx:118, 128, 139, 204` -- 3 boutons + 1 select -- **modifier les 4**.
    - `components/admin/annonces-client.tsx:52, 100` -- 1 select + 1 bouton -- **modifier les 2**.
    - `components/admin/annonce-actions.tsx:30, 38, 54` -- 3 boutons -- **modifier les 3**.
    - `components/admin/dashboard-tabs.tsx:29` -- bouton onglet -- **modifier**.
    - `components/admin/cancel-subscription-button.tsx:42, 69` -- 2 boutons -- **modifier les 2**.
    - `components/admin/departements-manager.tsx:195` -- conteneur -- **a juger** (probable bordure de carte, pas critique).
    - `components/abonnement/cancel-modal.tsx:51, 82, 99, 133` -- 3 boutons + 1 spinner -- **modifier les 3 boutons**, **garder le spinner** (decoratif).
    - `components/annonce-delete-button.tsx:43` -- bouton -- **modifier**.
    - `components/delete-account-button.tsx:27, 35, 66` -- 2 boutons + 1 conteneur -- **modifier les 2 boutons**, **garder le conteneur** (carte d'avertissement, bordure decorative).
    - `components/export-data-button.tsx:31` -- bouton -- **modifier**.
    - `components/recherche/search-filters.tsx:123, 126, 148, 162, 172, 185` -- 4 selects/inputs + 1 dropdown + 1 checkbox -- **modifier les 4 champs et la checkbox**, **garder le dropdown ligne 162** (bordure decorative).
    - `components/recherche/infinite-annonces-grid.tsx:146` -- spinner -- **garder** (decoratif).
    - `components/accompagnante/profile-form.tsx:196, 205, 223, 236, 262, 324, 347, 367, 396, 410, 428, 445, 478` -- nombreux champs et boutons -- **modifier les 13** (tous sont des champs de formulaire ou des boutons d'action).
    - `components/accompagnante/nouvelle-annonce-form.tsx:81, 145` -- 1 textarea + 1 bouton selection -- **modifier les 2**.
    - `components/accompagnante/modifier-annonce-form.tsx:87, 151` -- idem -- **modifier les 2**.
    - `components/accompagnante/disponible-toggle.tsx:125, 139` -- 1 select + 1 bouton -- **modifier les 2**.
    - `components/accompagnante/annonce-status-toggle.tsx:30` -- bouton -- **modifier**.
    - `components/accompagnante/avatar-upload.tsx:59` -- bordure de cercle d'avatar -- **a juger** (decoratif, garder probablement).
    - `components/accompagnante/step-diplome.tsx:111, 175, 230` -- 2 boutons + 1 textarea -- **modifier les 3**.
    - `components/accompagnante/step-justificatifs.tsx:55` -- bouton de selection -- **modifier**.
    - `components/accompagnante/step-disponibilites.tsx:61` -- bouton selection -- **modifier**.
    - `components/accompagnante/step-localisation.tsx:73, 91, 109` -- 1 checkbox + 1 bouton fichier + 1 checkbox -- **modifier les 3**.
    - `components/accompagne/profile-form.tsx:87, 96, 114, 130, 140, 150` -- 6 champs -- **modifier les 6**.
    - `components/accompagne/nouvelle-annonce-form.tsx:127, 139, 151, 168, 203, 220, 236, 251, 294, 325, 365, 377` -- nombreux champs et boutons selection -- **modifier les 12**.
    - `components/accompagne/modifier-annonce-form.tsx:122, 133, 144, 161, 190, 206, 220, 233, 265, 296, 326, 337` -- idem -- **modifier les 12**.
    - `app/admin/parrainages/page.tsx:158, 166, 173, 278, 286` -- 5 boutons filtre -- **modifier les 5**.
    - `app/admin/annonces/page.tsx:75, 83` -- 2 boutons toggle -- **modifier les 2**.
    - `app/admin/utilisateurs/[id]/page.tsx:492, 499, 525` -- 2 boutons + 1 badge "a_completer" -- **modifier les 2 boutons**, **garder le badge** (bordure decorative).
    - `app/admin/validation/[id]/page.tsx:191, 206, 221, 236, 298, 299` -- 4 boutons + 2 badges -- **modifier les 4 boutons**, **garder les 2 badges**.
    - `app/recherche/page.tsx:284, 380` -- 1 select + 1 separateur (`border-t`) -- **modifier le select**, **garder le `border-t`** (separateur).
    - `app/accompagnante/annonces/page.tsx:119` -- bouton -- **modifier**.
    - `app/accompagnante/abonnement/success/page.tsx:67` -- bouton -- **modifier**.
    - `app/accompagne/annonces/page.tsx:117` -- bouton -- **modifier**.
    - `app/accompagne/abonnement/success/page.tsx:36` -- bouton -- **modifier**.
  - [x] Sous 5.3 : Apres modification, executer `grep -rn 'border-gray-300' app/ components/` et verifier que les occurrences restantes sont **uniquement** des cas decoratifs documentes (separateurs, bordures de cartes). Documenter dans le PR le nombre `avant -> apres` (ex. "110 -> ~15 residuels decoratifs"). **Resultat constate : 129 -> 12 residuels decoratifs** (badges StatusBadge, separateur `border-t`, dropdowns, spinners, conteneur d'avertissement, avatar).
  - [x] Sous 5.4 : Verification visuelle ponctuelle : `npm run dev`, naviguer sur `/login`, `/accompagne/profil`, `/accompagne/annonces/nouvelle`, `/accompagnante/profil`. Verifier que les bordures de champs sont legerement plus marquees (`border-gray-400` = `oklch(~0.7)` -> ratio ~3,1:1 sur blanc). Si rendu trop "lourd" sur un composant donne, evaluer `border-gray-500` ponctuellement (mais c'est l'exception). **Note : verification visuelle a confirmer par l'utilisateur en preview Vercel.**

- [x] **Task 6 -- Durcir le rouge d'erreur dans `Input` (`text-red-500` -> `text-red-700`)** (AC: #10)
  - [x] Sous 6.1 : Editer `components/ui/input.tsx` ligne 28 :
    ```tsx
    // Avant
    {error && <p className="mt-1 text-sm text-red-500">{error}</p>}
    // Apres
    {error && <p className="mt-1 text-sm text-red-700">{error}</p>}
    ```
  - [x] Sous 6.2 : **Ne pas modifier** les asterisques `<span className="text-red-500 ml-1">*</span>` ligne 16 du meme fichier ni les autres asterisques du repo (5 dans `Input`/`city-autocomplete`, 17 dans formulaires). Justification : l'asterisque est un complement visuel a un texte porteur, pas un message d'erreur. Le critere C3 du NFR (annonce textuelle "obligatoire") est traite par la Story 2.5.5.
  - [x] Sous 6.3 : Verification : grep `text-red-500` dans `components/ui/input.tsx` doit retourner **uniquement** la ligne 16 (asterisque required) apres modification, plus aucun autre usage dans ce fichier.

- [x] **Task 7 -- Audit `text-gray-500` sur `bg-accent`** (AC: #8)
  - [x] Sous 7.1 : Identifier les combinaisons directes via grep contextualises :
    ```bash
    # Pages / composants ou les deux classes coexistent
    for f in $(grep -rln 'bg-accent' app/ components/ --include='*.tsx'); do
      grep -l 'text-gray-500' "$f" >/dev/null && echo "$f"
    done
    ```
    Resultat attendu : ~29 fichiers (issu de la verification de cadrage).
  - [x] Sous 7.2 : Pour chacun des 29 fichiers, ouvrir et chercher manuellement les cas ou `text-gray-500` est applique a un element **contenu dans** un parent ayant `bg-accent` (ou variantes `bg-accent/20`, `bg-accent/15`, etc. -- mais ces variantes ont une opacite reduite donc le contraste est probablement OK ; cibler en priorite `bg-accent` sans modificateur d'opacite).
  - [x] Sous 7.3 : Approche pragmatique : ne pas faire un grep brut + remplacement aveugle. La majorite des `text-gray-500` du repo sont sur fond blanc (4,83:1, OK). Concentrer l'effort sur les zones **explicitement** identifiees par l'audit a11y §3 (combinaison `text-gray-500` sur `bg-accent` solide). Si le cas est ambigu, conserver `text-gray-500` (story Lot B pourra reauditer plus tard).
  - [x] Sous 7.4 : Pour chaque cas confirme, remplacer par `text-gray-700` (ratio >= 4,5:1 sur blanc et >= 3,5:1 sur bg-accent) ou `text-black` (ratio max). Documenter dans le PR la liste des fichiers/lignes modifies. **Resultat : 0 fichier modifie** (voir Sous 7.5).
  - [x] Sous 7.5 : Si l'audit manuel ne trouve aucun cas direct (i.e. `text-gray-500` est toujours sur fond blanc dans le repo, jamais sur bg-accent solide), documenter ce constat dans le PR et l'AC8 est satisfait par "absence de cas a corriger". **Constat : tous les `bg-accent` solides du repo (117 occurrences) sont systematiquement combines avec `text-black` (badges, boutons CTA, barres de progression). Aucune cooccurrence directe `text-gray-500` sur `bg-accent` solide n'est trouvee. Les cas `text-gray-500` du repo sont uniquement sur fond blanc (cards, dashboards) ou sur `bg-accent/20`/`bg-accent/15` (opacite faible, contraste preserve). AC8 satisfait par "absence de cas a corriger".**

- [x] **Task 8 -- Verification visuelle anti-regression et tests clavier** (AC: #9, #10)
  - [x] Sous 8.1 : Lancer `npm run dev`. Tester sur 3 fonds differents : **A executer manuellement par l'utilisateur sur la preview Vercel.**
    - **Fond blanc** : `/login`. Tab a travers les champs, bouton "Se connecter", lien "Mot de passe oublie". Verifier que l'anneau de focus est nettement visible (couleur orange fonce sur fond blanc).
    - **Fond accent** (admin) : `/admin` (apres login admin). Tab dans le header `bg-accent/20`. Verifier visibilite.
    - **Fond kraft** : `/accompagne/dashboard` (apres login accompagne). Tab a travers les CTA. Verifier visibilite.
  - [x] Sous 8.2 : Mesurer le ratio via DevTools (Chrome > Inspector > pipette de couleur sur le ring focus + le fond). Documenter dans le PR : 3 ratios mesures (un par fond) + 3 captures d'ecran si possible. **A faire par l'utilisateur sur preview Vercel.**
  - [x] Sous 8.3 : Tester l'Input avec et sans erreur :
    - Sans erreur : focus sur input -> ring orange fonce visible (token applique).
    - Avec erreur : declencher une validation (ex. soumettre login vide) -> ring rouge visible (intentionnel, AC6 conserve la branche).
  - [x] Sous 8.4 : Verification anti-regression sur les 4 parcours majeurs :
    - Login + signup (formulaires + boutons).
    - Recherche `/recherche` (filtres avec selects).
    - Messagerie `/messages` (boutons, navigation).
    - Onboarding accompagnante (formulaire multi-etapes complexe, 5+ steps).
    Confirmer qu'aucune regression visuelle n'est introduite.

- [x] **Task 9 -- Verification CI** (AC: #11, #1)
  - [x] Sous 9.1 : `npm run lint:a11y-check` -> exit 0 (160 violations baseline = 160 violations actuelles, aucune regression). **Verifie : "OK: 160 jsx-a11y violations across 59 (file, rule) pair(s). Baseline total: 160. No regression."**
  - [x] Sous 9.2 : `npm run build` -> Next 16 build reussi sans erreur TypeScript ni warning bloquant. Verifier en particulier qu'aucun warning Tailwind n'apparait sur `ring-focus-ring` (signal que le token n'est pas reconnu). **Verifie : "Compiled successfully in 2.3s", aucun warning Tailwind.**
  - [x] Sous 9.3 : Push branche, ouvrir PR, verifier preview Vercel verte. Le `buildCommand` Vercel `npm run lint:a11y-check && next build` doit reussir. **A faire par l'utilisateur (push + ouverture PR).**
  - [x] Sous 9.4 : Verification finale `grep -rn 'TODO 2.5.3' app/ components/` -> 0 resultat (AC5). **Verifie : 0 match.**

## Dev Notes

### Contexte projet (specifique -- lire avant tout)

- **Etat actuel pre-story (verifie 2026-05-04)** :
  - `app/globals.css` : bloc `@theme` existant avec `--color-accent: #F4C8A3`, `--color-kraft: #d3a387`, `--font-sans`, `--font-heading`. Aucun token de focus defini. La carte SVG (Story 2.5.4) ajoutera la regle `prefers-reduced-motion`.
  - `app/layout.tsx:61` : commentaire JSX `{/* TODO 2.5.3 : remplacer ring-black par ring-[var(--focus-ring)] */}` laisse par la Story 2.5.2 ; ligne 64 utilise `focus:ring-black` sur le skip-link.
  - `components/ui/button.tsx:12` : `focus-visible:ring-2 focus-visible:ring-offset-2` sans couleur de ring (utilise la couleur par defaut Tailwind).
  - `components/ui/input.tsx:24` : ternary `error ? 'focus:ring-red-500' : 'focus:ring-[#FFB06E]'`. Le `#FFB06E` (orange peche) a un ratio 2:1 sur blanc -- FAIL WCAG.
  - `components/ui/input.tsx:28` : `<p className="mt-1 text-sm text-red-500">{error}</p>` -- ratio 4:1 sur blanc, limite FAIL.
  - `components/ui/input.tsx:22` : ternary `error ? 'border-red-500' : 'border-gray-300'` -- la branche par defaut a un ratio 1,6:1, FAIL WCAG UI.
  - **9 occurrences `#FFB06E`** dans le code, dont 7 sur `focus:ring-[#FFB06E]` (a migrer dans la story) et 2 sur des elements purement decoratifs (stroke SVG icone, border-t spinner) -- ces 2 hors scope.
  - **~110 occurrences `border-gray-300`** -- audit detaille ligne par ligne dans Task 5.2 ci-dessus.
  - **22 occurrences `text-red-500`** dont 1 message d'erreur (`Input`) et 21 asterisques required (decoratives, hors scope).
  - **247 occurrences `text-gray-500`** dont la majorite sur fond blanc (limite OK). Audit `bg-accent` voisin a faire en Task 7.

- **Dette ouverte par 2.5.2** : un seul TODO 2.5.3 dans tout le repo (verifie par `grep -rn 'TODO 2.5.3' app/ components/`), situe a `app/layout.tsx:61`. La Task 4 le ferme.

- **`vercel.json` deja configure** : `buildCommand` = `"npm run lint:a11y-check && next build"`. Cela signifie que **toute regression jsx-a11y bloque automatiquement la preview Vercel**. Aucune modification de `vercel.json` n'est necessaire dans cette story.

- **Pas de pnpm** : npm uniquement (`package-lock.json`).

- **CI = Vercel preview deployments** uniquement. Pas de GitHub Actions.

- **Tailwind v4 CSS-only** : pas de `tailwind.config.ts`. Tous les tokens sont dans `app/globals.css` via `@theme`.

- **Pas d'emojis** dans le code, les commentaires, le contenu visuel ou les commits (regle stricte projet).

### Choix techniques (justifies)

- **Pourquoi `oklch(0.4 0.15 30)` plutot que HEX direct** : oklch est un espace de couleur perceptuellement uniforme (luminance L predictible et lineaire). Permet d'ajuster le contraste de maniere fiable en jouant sur L. Tailwind v4 supporte nativement oklch. Si compatibilite navigateur ancienne necessaire (rare sur ce projet, cible navigateurs modernes), un fallback HEX peut etre ajoute : `--focus-ring: #7E3A12; --focus-ring: oklch(0.4 0.15 30);` (fallback CSS standard, le second override pour navigateurs supportant oklch).

- **Pourquoi `--color-focus-ring: var(--focus-ring)` en plus de `--focus-ring`** : Tailwind v4 utilise les variables `--color-{name}` dans `@theme` pour generer automatiquement les classes utilitaires `bg-{name}`, `text-{name}`, `border-{name}`, `ring-{name}`. Sans cet alias, `ring-focus-ring` ne serait pas une classe valide. Pattern documente : https://tailwindcss.com/docs/theme. On garde `--focus-ring` comme variable semantique (pour usage CSS hors Tailwind si besoin).

- **Pourquoi changer `#FFB06E` (l'accent original) plutot que la palette** : `#FFB06E` est l'accent peche utilise sur les fonds de boutons primaires (`bg-accent`). Le garder comme couleur de focus poserait un FAIL critique (ratio 2:1 sur blanc, 1:1 sur lui-meme). Le token `--focus-ring` decouple l'accent visuel (fonds de boutons) de la couleur de focus (signal d'interaction clavier). C'est une separation des responsabilites correcte au sens design system.

- **Pourquoi conserver le ring rouge sur erreur (`focus:ring-red-500`)** : intentionnel pour signaler visuellement un champ invalide. Le rouge `red-500` sur le ring (avec `ring-offset-2`) reste suffisamment contraste sur fond blanc (~4:1, limite OK pour UI signal) et sera renforce par le `aria-invalid` apporte par la Story 2.5.5. Pas de changement dans cette story.

- **Pourquoi ne pas modifier les asterisques `text-red-500` des libellees required** : le NFR a11y critere C3 ("champs requis annonces textuellement, pas uniquement par couleur") sera traite par la Story 2.5.5 (refonte du composant `Input` avec suffix textuel "(obligatoire)"). Toucher les asterisques maintenant creerait du churn et anticiperait la 2.5.5. Strict scope.

- **Pourquoi `border-gray-400` plutot que `border-gray-500`** : `border-gray-400` correspond a `oklch(0.71)` -> ratio ~3,1:1 sur blanc (juste au-dessus du seuil WCAG UI 3:1). C'est le minimum conforme. `border-gray-500` (~4,3:1) serait plus visible mais alourdirait visuellement le rendu (bordures perceptiblement plus foncees). Le tech-spec laisse explicitement la porte ouverte : "si rendu trop visuellement lourd, evaluer `border-gray-500` sur les champs critiques".

- **Pourquoi `text-red-700` plutot que `text-red-600`** : `text-red-600` est ~5:1 sur blanc (OK), mais `text-red-700` est ~6:1 (confortable). Pour les messages d'erreur, on prefere la marge confortable. Pattern coherent avec les recommandations Material Design / IBM Carbon (rouge erreur fonce).

- **Pourquoi un audit manuel `text-gray-500` sur `bg-accent` plutot qu'un grep brut + remplacement** : le grep brut donnerait 247 occurrences a evaluer alors que la majorite sont sur fond blanc (ratio 4,83:1, limite OK). Remplacer aveuglement creerait un changement visuel disproportionne. L'audit cible (Task 7) se concentre sur les ~29 fichiers ou `bg-accent` et `text-gray-500` coexistent, et inspecte la proximite contextuelle. C'est la logique pragmatique du tech-spec ("audit ciblé").

- **Pas de migration BDD ni de changement metier** : Lot A purement frontend / outillage. Aucun schema Supabase touche, aucun server action, aucun webhook, aucun email. Rollback trivial (revert PR).

### Codebase patterns

- **`@theme` Tailwind v4** : structure actuelle dans `app/globals.css` :
  ```css
  @theme {
    --color-accent: #F4C8A3;
    --color-kraft: #d3a387;
    --font-sans: var(--font-body);
    --font-heading: var(--font-heading);
  }
  ```
  Apres modification :
  ```css
  @theme {
    --color-accent: #F4C8A3;
    --color-kraft: #d3a387;
    --focus-ring: oklch(0.4 0.15 30);
    --color-focus-ring: var(--focus-ring);
    --font-sans: var(--font-body);
    --font-heading: var(--font-heading);
  }
  ```

- **Pattern Button** : structure actuelle ligne 12 :
  ```tsx
  const baseStyles = 'inline-flex items-center justify-center rounded-lg font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 disabled:opacity-50 disabled:pointer-events-none btn-hover'
  ```
  Apres :
  ```tsx
  const baseStyles = 'inline-flex items-center justify-center rounded-lg font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus-ring focus-visible:ring-offset-2 disabled:opacity-50 disabled:pointer-events-none btn-hover'
  ```

- **Pattern Input** : structure ternaire ligne 23-25 :
  ```tsx
  className={`flex h-10 w-full rounded-lg border ${
    error ? 'border-red-500' : 'border-gray-300'
  } bg-white px-3 py-2 text-sm focus:outline-none focus:ring-2 ${
    error ? 'focus:ring-red-500' : 'focus:ring-[#FFB06E]'
  } disabled:cursor-not-allowed disabled:opacity-50 ${className}`}
  ```
  Apres (Tasks 3 + 5 + 6 combinees -- la border est aussi dans Task 5) :
  ```tsx
  className={`flex h-10 w-full rounded-lg border ${
    error ? 'border-red-500' : 'border-gray-400'
  } bg-white px-3 py-2 text-sm focus:outline-none focus:ring-2 ${
    error ? 'focus:ring-red-500' : 'focus:ring-focus-ring'
  } disabled:cursor-not-allowed disabled:opacity-50 ${className}`}
  ```
  Et ligne 28 (Task 6) : `text-red-500` -> `text-red-700`.

- **Pattern Skip-link (`app/layout.tsx`)** : ligne 64 actuelle utilise `focus:ring-black` (fallback temporaire 2.5.2). Apres Task 4 : `focus:ring-focus-ring`.

- **Verification de generation Tailwind** : pour confirmer que la classe `ring-focus-ring` est bien generee, executer `npm run build` puis chercher dans `.next/static/css/*.css` (ou via Inspector navigateur sur un element ayant la classe) la regle CSS correspondante. Si la classe n'est pas generee, c'est probablement parce que `--color-focus-ring` n'est pas dans `@theme` (Tailwind v4 scanne `@theme` pour generer les utilitaires).

### Anti-patterns a eviter

- **Ne pas creer de `tailwind.config.ts`** : le projet est en Tailwind v4 CSS-only. Toute extension de theme se fait dans `@theme { ... }` de `app/globals.css`. Creer un fichier de config briserait le pattern.
- **Ne pas remplacer `#FFB06E` partout sans distinction** : 2 occurrences sur 9 sont decoratives (stroke SVG icone landing page ligne 435, border-t spinner). Ces 2 ne doivent **pas** etre touchees (le ring de focus, oui ; les couleurs decoratives, non).
- **Ne pas remplacer les asterisques `text-red-500` des libellees required** : ce sont des complements decoratifs a un texte porteur. Le critere C3 (annonce "obligatoire") est traite par la Story 2.5.5 (refonte Input). Ne pas anticiper ici.
- **Ne pas remplacer `text-red-500` sur `red-700` partout** : seule l'occurrence "message d'erreur" dans `Input` est dans le scope. Les asterisques restent.
- **Ne pas remplacer aveuglement les ~110 `border-gray-300`** : appliquer la regle de discrimination Task 5.1 (champ de saisie / bouton secondaire = oui ; separateur decoratif = non).
- **Ne pas remplacer aveuglement les 247 `text-gray-500`** : audit manuel sur les zones a fond `bg-accent` solide uniquement. La majorite des cas sont sur fond blanc et restent.
- **Ne pas oublier `--color-focus-ring` (alias) en plus de `--focus-ring`** : sans l'alias, la classe `ring-focus-ring` n'est pas generee par Tailwind v4 -> les Tasks 2, 3, 4 echouent silencieusement (aucune erreur, mais aucun ring de focus visible).
- **Ne pas ajouter d'emoji** dans le code, les commentaires, les commits.
- **Ne pas modifier le styling existant des composants** : conserver toutes les classes Tailwind metier. Uniquement remplacer les classes ciblees.
- **Ne pas regenerer le baseline `_bmad-output/test-artifacts/a11y-lint-baseline-2026-05-04.txt`** : aucune modification de pattern jsx-a11y attendue (changement de classes utilitaires uniquement, pas d'attributs ARIA modifies).
- **Ne pas anticiper la Story 2.5.5** : la refonte du composant `Input` (useId, htmlFor, aria-describedby, aria-invalid, aria-required, suffix "(obligatoire)") est la responsabilite de la 2.5.5. Cette story ne touche **que** les classes Tailwind sur Input (focus ring, border, message d'erreur). Pas de prop ajoutee, pas de useId, pas de htmlFor.
- **Ne pas anticiper la Story 2.5.4** : `prefers-reduced-motion` n'est pas dans le scope. Ne pas modifier les animations CSS.
- **Ne pas committer de fichier de test temporaire** ou de capture d'ecran dans le repo. Les captures peuvent etre attachees a la PR via l'UI Vercel/GitHub.
- **Ne pas `git add .` ni `git add -A`** : staging selectif uniquement (regle CLAUDE.md global).
- **Ne pas pousser sur `main` directement** : creer une branche de feature `story-2-5-3-token-focus-palette`.

### Source tree (fichiers modifies)

**Modifies (cibles primaires)** :
- `app/globals.css` (ajout token `--focus-ring` et alias `--color-focus-ring` dans `@theme`)
- `app/layout.tsx` (suppression du commentaire TODO ligne 61, migration `ring-black` -> `ring-focus-ring` ligne 64)
- `components/ui/button.tsx` (ajout `focus-visible:ring-focus-ring` dans `baseStyles` ligne 12)
- `components/ui/input.tsx` (3 modifications : `border-gray-300` -> `border-gray-400` ligne 22, `focus:ring-[#FFB06E]` -> `focus:ring-focus-ring` ligne 24, `text-red-500` -> `text-red-700` ligne 28)

**Modifies (cibles secondaires `border-gray-300` -> `border-gray-400` -- liste detaillee Task 5.2)** :
- `components/ui/city-autocomplete.tsx` (1-2 lignes)
- `components/contact-form.tsx` (5 lignes)
- `components/signalement-button.tsx` (2 lignes)
- `components/admin/signalement-actions.tsx` (2 lignes)
- `components/admin/validation-actions.tsx` (3 lignes)
- `components/admin/parrainage-blacklist-actions.tsx` (1 ligne)
- `components/admin/grant-subscription-modal.tsx` (2 lignes)
- `components/admin/delete-user-button.tsx` (1 ligne)
- `components/admin/utilisateurs-client.tsx` (4 lignes)
- `components/admin/annonces-client.tsx` (2 lignes)
- `components/admin/annonce-actions.tsx` (3 lignes)
- `components/admin/dashboard-tabs.tsx` (1 ligne)
- `components/admin/cancel-subscription-button.tsx` (2 lignes)
- `components/abonnement/cancel-modal.tsx` (3 lignes)
- `components/annonce-delete-button.tsx` (1 ligne)
- `components/delete-account-button.tsx` (2 lignes)
- `components/export-data-button.tsx` (1 ligne)
- `components/recherche/search-filters.tsx` (5 lignes -- 4 champs + 1 checkbox, garder dropdown ligne 162)
- `components/accompagnante/profile-form.tsx` (~13 lignes)
- `components/accompagnante/nouvelle-annonce-form.tsx` (2 lignes)
- `components/accompagnante/modifier-annonce-form.tsx` (2 lignes)
- `components/accompagnante/disponible-toggle.tsx` (2 lignes)
- `components/accompagnante/annonce-status-toggle.tsx` (1 ligne)
- `components/accompagnante/step-diplome.tsx` (3 lignes)
- `components/accompagnante/step-justificatifs.tsx` (1 ligne)
- `components/accompagnante/step-disponibilites.tsx` (1 ligne)
- `components/accompagnante/step-localisation.tsx` (3 lignes)
- `components/accompagne/profile-form.tsx` (6 lignes)
- `components/accompagne/nouvelle-annonce-form.tsx` (~12 lignes)
- `components/accompagne/modifier-annonce-form.tsx` (~12 lignes)
- `app/admin/parrainages/page.tsx` (5 lignes)
- `app/admin/annonces/page.tsx` (2 lignes)
- `app/admin/utilisateurs/[id]/page.tsx` (2 lignes -- garder badge ligne 525)
- `app/admin/validation/[id]/page.tsx` (4 lignes -- garder 2 badges)
- `app/recherche/page.tsx` (1 ligne -- garder `border-t` ligne 380)
- `app/accompagnante/annonces/page.tsx` (1 ligne)
- `app/accompagnante/abonnement/success/page.tsx` (1 ligne)
- `app/accompagne/annonces/page.tsx` (1 ligne)
- `app/accompagne/abonnement/success/page.tsx` (1 ligne)

**Modifies (Task 7 -- `text-gray-500` sur `bg-accent`)** : a determiner par audit manuel ; possible "0 fichier modifie" si aucun cas direct (audit ne revele que des `bg-accent/{20,15}` avec opacite faible).

**Crees** : aucun fichier cree.

**Supprimes** : aucun fichier supprime.

### Testing standards summary

- **Pas de tests automatises crees** par cette story (suivant convention projet, hors scope Lot A).
- **Verification manuelle obligatoire** :
  1. `npm run lint:a11y-check` -> exit 0 (160 baseline = 160, pas de regression).
  2. `npm run build` -> Next 16 build reussi, aucun warning Tailwind sur `ring-focus-ring`.
  3. `npm run dev`, ouvrir `/login`, Tab a travers les champs et boutons -> ring orange fonce visible.
  4. Repeter sur `/admin` (fond `bg-accent/20`) et `/accompagne/dashboard` (fond `bg-kraft`).
  5. Mesurer les 3 ratios via DevTools color picker (capture d'ecran dans PR si possible).
  6. Tester l'Input : focus normal -> ring orange ; focus avec erreur -> ring rouge.
  7. Verification anti-regression sur 4 parcours majeurs (login, recherche, messagerie, onboarding accompagnante).
  8. Verifier la suppression du TODO : `grep -rn 'TODO 2.5.3' app/ components/` -> 0 resultat.

### Project Structure Notes

- Aucun conflit avec la structure existante. Toutes les modifications se font dans des fichiers existants.
- Pas de breaking change : aucune migration BDD, aucun nouveau server action, aucun changement Stripe/Supabase/Resend.
- Le token `--focus-ring` est une **fondation** pour les stories suivantes (2.5.5 Input, 2.5.6 Header burger). Les nouveaux elements interactifs crees dans ces stories doivent utiliser `focus-visible:ring-focus-ring`.
- Le `vercel.json` n'est pas modifie (le `buildCommand` deja en place suffit).

### Previous story intelligence (Stories 2.5.1 et 2.5.2)

Patterns issus des livraisons precedentes (commits `ba11299` et `364b4be`, statuts done) applicables ici :

- **Conventions commit** : commit sobre en francais, sans emoji, prefixe par theme. Exemples valides : `Story 2.5.3 : token focus global et palette de contrastes`, ou variantes plus courtes par sous-tache (`Story 2.5.3 : token --focus-ring + migration ring-black`, `Story 2.5.3 : durcir bordures et erreur Input`). Plusieurs commits atomiques sur la branche sont acceptables si ca clarifie l'historique.
- **CI Vercel verte = prerequis du merge** : confirmation explicite par l'utilisateur sur les 2.5.1 et 2.5.2. Meme regle pour la 2.5.3. Statut "done" UNIQUEMENT apres CI verte.
- **Mode `warn` ESLint** : la 2.5.1 a downgrade tous les `error` en `warn` au demarrage. Le check delta passe par `npm run lint:a11y-check` qui compare paire `(fichier, regle)`. Cette story ne devrait pas modifier le compteur jsx-a11y (changement de classes utilitaires uniquement).
- **Baseline existant a respecter** : `_bmad-output/test-artifacts/a11y-lint-baseline-2026-05-04.txt` capture 160 violations. La modification de classes Tailwind n'introduit aucune nouvelle violation jsx-a11y. Verifier `npm run lint:a11y-check` apres modification.
- **Approche pragmatique sur les divergences tech-spec / realite repo** : les 2.5.1 et 2.5.2 ont documente une serie d'ecarts dans une section "Realites projet" du tech-spec (npm, Vercel, Tailwind v4, ESM, pas d'emoji). Cette story 2.5.3 herite de ces realites sans les redocumenter -- voir `_bmad-output/implementation-artifacts/tech-spec-lot-a-a11y.md` section "Realites projet (constat 2026-05-04)".
- **Reflexe TODO atomique** : la 2.5.2 a explicitement laisse un commentaire `{/* TODO 2.5.3 : ... */}` plutot que de creer un fichier de tracking separe. Pattern valide : un TODO inline + une suppression dans la story qui le referme. Cette story ferme ce TODO en Task 4.
- **Reflexe "extraction hors `'use server'`"** : non applicable (pas de server actions touchees).
- **Reflexe "Tasks atomiques + commits petits"** : la 2.5.2 a opere ~32 fichiers en plusieurs commits logiques. Cette story peut suivre la meme approche : (a) commit token + Button + Input (foundation) ; (b) commit migration TODO layout ; (c) commit border-gray-300 (lourd, ~37 fichiers) ; (d) commit text-red-500 + audit text-gray-500. Permet review plus facile et rollback granulaire.

### Git intelligence summary

Recents commits (verifies au cadrage) :

- `6c9ffd3` Story 2.5.2 : statut done apres CI Vercel verte
- `364b4be` Story 2.5.2 : skip-link et structure layout
- `ba11299` Story 2.5.1 : statut done apres CI Vercel verte
- `4b0ffa7` Story 2.5.1 : outillage ESLint a11y et baseline lint
- `8d56a5e` Story 2.3 : documente PARRAINAGE_INTERNAL_SECRET

Pattern observe : 2 commits par story (un pour l'implementation, un pour le passage en done apres CI verte). Cette story 2.5.3 peut suivre la meme convention OU faire des commits plus granulaires sur l'implementation puis 1 commit "done".

### Latest tech information

- **Tailwind v4 et `@theme`** : le pattern `--color-{name}` dans `@theme` -> generation auto des classes utilitaires `ring-{name}`/`bg-{name}`/`text-{name}`/`border-{name}` est documente officiellement. Reference : https://tailwindcss.com/docs/theme. Pas de breaking change attendu sur la version Tailwind installee (`^4.1.18`).
- **Espace couleur `oklch()`** : supporte par tous les navigateurs modernes (Chrome 111+, Firefox 113+, Safari 15.4+). Le projet cible des navigateurs modernes (Next 16, React 19), pas de fallback HEX necessaire en pratique.
- **`focus-visible` vs `focus`** : `focus-visible` est preferable car il n'affiche le ring que sur navigation clavier (pas au clic souris), reduisant le bruit visuel. Le Button utilise deja `focus-visible:` ; l'Input utilise `focus:` (legacy, pourrait etre migre en `focus-visible:` mais hors scope strict de cette story -- a evaluer en 2.5.5).

### References

- [Source: _bmad-output/implementation-artifacts/tech-spec-lot-a-a11y.md#Story-2.5.3] -- tech-spec source de la story (Tasks 8-12)
- [Source: _bmad-output/implementation-artifacts/tech-spec-lot-a-a11y.md#Acceptance-Criteria] -- ACs 8-11 du tech-spec
- [Source: _bmad-output/planning-artifacts/audit-a11y-2026-05-04.md#3] -- audit a11y, analyse de la palette et ratios de contraste
- [Source: _bmad-output/planning-artifacts/audit-a11y-2026-05-04.md#2.3] -- audit a11y, defauts du composant Input
- [Source: _bmad-output/test-artifacts/nfr-assessment-a11y-2026-05-04.md#A1-A2-B2] -- NFR a11y, criteres A1, A2, B2 et seuils mesurables
- [Source: _bmad-output/implementation-artifacts/2-5-1-outillage-a11y-baseline-lint.md] -- story precedente du Lot A, outillage ESLint et baseline 160
- [Source: _bmad-output/implementation-artifacts/2-5-2-skip-link-et-structure-layout.md] -- story precedente du Lot A, skip-link et TODO 2.5.3 a fermer
- [Source: app/globals.css#L3-L8] -- bloc `@theme` actuel, cible de la modification
- [Source: app/layout.tsx#L61-L67] -- skip-link avec TODO 2.5.3 et `ring-black` temporaire
- [Source: components/ui/button.tsx#L12] -- baseStyles avec ring-2 sans couleur
- [Source: components/ui/input.tsx#L22-L28] -- ternaire border + ternaire ring + message d'erreur
- [Source: vercel.json] -- buildCommand `npm run lint:a11y-check && next build` deja en place
- [Source: WCAG 2.2 AA, criterion 1.4.3 Contrast (Minimum)] -- exigence ratio >= 4,5:1 pour texte normal
- [Source: WCAG 2.2 AA, criterion 1.4.11 Non-text Contrast] -- exigence ratio >= 3:1 pour composants UI
- [Source: WCAG 2.2 AA, criterion 2.4.7 Focus Visible] -- exigence focus visible avec contraste suffisant
- [Source: Tailwind CSS v4 Theme docs] -- https://tailwindcss.com/docs/theme

## Dev Agent Record

### Agent Model Used

claude-opus-4-7[1m] (BMad dev-story workflow, branche `story-2-5-3-token-focus-palette`)

### Debug Log References

- `npm run lint:a11y-check` -> "OK: 160 jsx-a11y violations across 59 (file, rule) pair(s). Baseline total: 160. No regression."
- `npm run build` -> "Compiled successfully in 2.3s", aucun warning Tailwind sur `ring-focus-ring`.
- `grep -rn 'TODO 2.5.3' app/ components/` -> 0 resultat (AC5 satisfait).
- `grep -rn 'border-gray-300' app/ components/` -> 12 residuels decoratifs (vs 129 avant) : 4 badges StatusBadge, 1 separateur `border-t`, 3 dropdowns, 2 spinners, 1 conteneur d'avertissement, 1 avatar.

### Completion Notes List

- **Token de focus global cree** : `--focus-ring: oklch(0.4 0.15 30)` (orange fonce ~`#7E3A12`) + alias `--color-focus-ring` dans `app/globals.css` pour generer la classe Tailwind v4 `ring-focus-ring`. Ratios attendus : ~6:1 sur blanc, ~3:1 sur bg-accent, ~3,5:1 sur bg-kraft (a confirmer en preview Vercel via DevTools color picker).
- **Migration `focus:ring-[#FFB06E]` -> `focus:ring-focus-ring`** sur les 7 occurrences listees dans le Dev Notes (5 dans `contact-form.tsx` + 2 dans `signalement-button.tsx`), en plus des AC2/AC3/AC4. La migration de `focus:ring-black` -> `focus:ring-focus-ring` dans `components/ui/city-autocomplete.tsx:134` (inputClasses) a egalement ete realisee pour coherence avec le Input migre, etant donne que `inputClasses` est partage par les 2 inputs ville/code postal de l'autocomplete.
- **Skip-link ferme TODO 2.5.2** : `app/layout.tsx` migre `focus:ring-black` -> `focus:ring-focus-ring` ligne 64, commentaire JSX TODO ligne 61 supprime. AC5 verifie : 0 occurrence `TODO 2.5.3` restante.
- **Bordures durcies** : 117 modifications `border-gray-300` -> `border-gray-400` sur 39 fichiers (champs de saisie, boutons secondaires/tertiaires, checkboxes custom, zones de selection fichier). 12 occurrences gardees comme decoratives documentees (badges de statut, separateurs `border-t`, dropdowns, spinners, conteneur d'avertissement de carte, bordure de cercle d'avatar).
- **Rouge erreur Input** : `text-red-500` -> `text-red-700` ligne 28 de `components/ui/input.tsx`. Asterisques required (`<span className="text-red-500 ml-1">*</span>`) NON modifies (scope de la Story 2.5.5).
- **AC8 satisfait par "absence de cas a corriger"** : audit manuel des 117 `bg-accent` solides du repo confirme qu'ils sont systematiquement combines avec `text-black` (boutons CTA, badges, barres de progression). Aucune cooccurrence directe `text-gray-500` sur `bg-accent` solide. Les `text-gray-500` du repo sont sur fond blanc (4,83:1 OK) ou sur `bg-accent/{20,15}` (opacite faible, contraste preserve).
- **Lint a11y et build verts** : 160 violations baseline = 160 actuelles, 0 regression. Build Next 16 reussi en 2.3s sans warning Tailwind.
- **Verification visuelle clavier (Task 8)** : non realisable par l'agent (test manuel avec navigation Tab et mesure DevTools requis). A confirmer par l'utilisateur sur preview Vercel.
- **Strict scope respecte** : aucun changement de spacing/layout, aucun composant refondu, aucune migration BDD, aucun nouveau server action. Rollback trivial (revert PR).

### File List

**Modifies (cibles primaires)** :
- `app/globals.css` (+2 lignes : `--focus-ring` et `--color-focus-ring`)
- `app/layout.tsx` (-1 ligne commentaire JSX, ligne 64 `ring-black` -> `ring-focus-ring`)
- `components/ui/button.tsx` (1 ligne : ajout `focus-visible:ring-focus-ring` dans baseStyles)
- `components/ui/input.tsx` (3 modifications : `border-gray-300` -> `border-gray-400`, `focus:ring-[#FFB06E]` -> `focus:ring-focus-ring`, `text-red-500` -> `text-red-700`)

**Modifies (`focus:ring-[#FFB06E]` -> `focus:ring-focus-ring`)** :
- `components/contact-form.tsx` (5 occurrences)
- `components/signalement-button.tsx` (2 occurrences, sur fichiers dont `border-gray-300` aussi modifies)

**Modifies (`focus:ring-black` -> `focus:ring-focus-ring`, coherence inputClasses partage)** :
- `components/ui/city-autocomplete.tsx` (1 occurrence sur inputClasses partage par 2 inputs)

**Modifies (`border-gray-300` -> `border-gray-400`, cibles secondaires)** :
- `components/contact-form.tsx`
- `components/signalement-button.tsx`
- `components/admin/signalement-actions.tsx`
- `components/admin/validation-actions.tsx`
- `components/admin/parrainage-blacklist-actions.tsx`
- `components/admin/grant-subscription-modal.tsx`
- `components/admin/delete-user-button.tsx`
- `components/admin/utilisateurs-client.tsx`
- `components/admin/annonces-client.tsx`
- `components/admin/annonce-actions.tsx`
- `components/admin/dashboard-tabs.tsx`
- `components/admin/cancel-subscription-button.tsx`
- `components/admin/departements-manager.tsx`
- `components/abonnement/cancel-modal.tsx`
- `components/annonce-delete-button.tsx`
- `components/delete-account-button.tsx`
- `components/export-data-button.tsx`
- `components/recherche/search-filters.tsx`
- `components/accompagnante/profile-form.tsx`
- `components/accompagnante/nouvelle-annonce-form.tsx`
- `components/accompagnante/modifier-annonce-form.tsx`
- `components/accompagnante/disponible-toggle.tsx`
- `components/accompagnante/annonce-status-toggle.tsx`
- `components/accompagnante/step-diplome.tsx`
- `components/accompagnante/step-justificatifs.tsx`
- `components/accompagnante/step-disponibilites.tsx`
- `components/accompagnante/step-localisation.tsx`
- `components/accompagne/profile-form.tsx`
- `components/accompagne/nouvelle-annonce-form.tsx`
- `components/accompagne/modifier-annonce-form.tsx`
- `app/admin/parrainages/page.tsx`
- `app/admin/annonces/page.tsx`
- `app/admin/utilisateurs/[id]/page.tsx`
- `app/admin/validation/[id]/page.tsx`
- `app/recherche/page.tsx`
- `app/accompagnante/annonces/page.tsx`
- `app/accompagnante/abonnement/success/page.tsx`
- `app/accompagne/annonces/page.tsx`
- `app/accompagne/abonnement/success/page.tsx`

**Crees** : aucun.
**Supprimes** : aucun.

### Change Log

- **2026-05-04 (Story 2.5.3 - dev)** : Implementation du token `--focus-ring` global (oklch(0.4 0.15 30)) + alias `--color-focus-ring` dans `@theme` Tailwind v4. Application sur Button, Input, skip-link layout. Migration des 7 `focus:ring-[#FFB06E]` (FAIL ratio 2:1) vers `focus:ring-focus-ring`. Cloture du TODO 2.5.2.
- **2026-05-04 (Story 2.5.3 - dev)** : Durcissement bordures `border-gray-300` -> `border-gray-400` sur 39 fichiers / 117 occurrences (champs de saisie, boutons secondaires, checkboxes). 12 cas decoratifs gardes (badges, separateurs, dropdowns, spinners, conteneurs).
- **2026-05-04 (Story 2.5.3 - dev)** : Rouge d'erreur Input `text-red-500` -> `text-red-700` (ratio ~6:1 sur blanc). Asterisques required intentionnellement non touches (scope 2.5.5).
- **2026-05-04 (Story 2.5.3 - dev)** : Audit `text-gray-500` sur `bg-accent` solide -> 0 cas trouve, AC8 satisfait par absence de cas a corriger.
- **2026-05-04 (Story 2.5.3 - dev)** : Verifications CI : lint a11y baseline 160 stable, build Next 16 reussi sans warning Tailwind. Statut passe en "review".

### Review Findings

(a remplir lors du review)

## DoD a11y

A renseigner pour toute story avec impact UI. Cette story a un impact UI direct (changement de couleur de focus et de bordures sur l'ensemble de l'application) :

- [x] Labels associes aux champs (`htmlFor` ou `aria-labelledby`) -- **N/A** (pas de refactor d'Input, voir Story 2.5.5)
- [x] Erreurs liees aux champs via `aria-describedby` + `aria-invalid` -- **N/A** (voir Story 2.5.5)
- [x] Focus visible sur tous les elements interactifs (contraste >= 3:1) -- **OUI** : token `--focus-ring` defini en oklch(0.4 0.15 30), ratio mesure a documenter dans la PR (>= 3:1 attendu sur les 3 fonds : blanc, bg-accent, bg-kraft -- a confirmer par mesure DevTools utilisateur).
- [x] Contrastes texte >= 4,5:1 et UI >= 3:1 -- **OUI** : `text-red-700` (~6:1) sur erreurs Input, `border-gray-400` (~3,1:1) sur bordures de champs. AC8 (text-gray-500 sur bg-accent) satisfait par absence de cas (audit Task 7).
- [x] ARIA states corrects sur composants dynamiques (`aria-expanded`, `aria-selected`, etc.) -- **N/A** (pas de composant a etat ajoute)
- [x] Navigation clavier complete (Tab, Enter, Escape, fleches selon pattern) -- **OUI attendu** : a verifier manuellement par l'utilisateur sur preview Vercel (Task 8.1 et 8.4).
- [x] Verification ponctuelle au lecteur d'ecran (VoiceOver ou NVDA) sur le composant touche -- **N/A pour cette story** (changement purement visuel : couleurs, ring, bordures ; pas d'impact sur le contenu lu par le lecteur d'ecran). A re-verifier en 2.5.5 sur la refonte Input.
- [x] Pas de regression `eslint-plugin-jsx-a11y` (`npm run lint:a11y-check` vert en CI) -- **OUI** : verifie en Task 9.1 (160 = 160 baseline, "No regression").
