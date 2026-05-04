# Story 2.5.2 : Skip-link et structure layout

Status: review

<!-- Note: Validation est optionnelle. Lancer `validate-create-story` avant `dev-story` pour un controle qualite. -->

## Story

En tant que **utilisateur clavier ou utilisateur de lecteur d'ecran sur roxanetnous**,
je veux **un lien "Aller au contenu principal" en tete de chaque page qui deplace le focus directement sur le contenu**,
afin de **contourner la repetition du header sur chaque page et atteindre le contenu utile en une seule action clavier (Tab + Enter)**.

Cette story est la deuxieme du Lot A (accessibilite quick wins). Elle s'appuie sur la chaine de lint posee par la Story 2.5.1 (livree, commit `ba11299`, baseline 160 violations) et adresse le critere NFR **B1** ("skip-link present et fonctionnel sur toutes les pages, focus deplace sur `<main>`") ainsi que le critere **D1 partiel** ("landmarks `<main>` coherents et uniques par page"). C'est un bloqueur critique du NFR a11y (utilisateur clavier exclu sans skip-link).

Effort estime : **0,25 j-dev** (mais l'inventaire `<main>` etend la charge a ~0,4 j-dev, voir Dev Notes).

## Acceptance Criteria

### AC commun Lot A (rappel)

1. **AC commun 1** - Given une PR Lot A, when la CI Vercel tourne, then `npm run lint:a11y-check` passe sans nouvelle violation `jsx-a11y/*` au-dela du baseline 160 capture par la Story 2.5.1.
2. **AC commun 2** - Given un composant modifie, when un developpeur consulte le composant, then les attributs ARIA pertinents sont presents si necessaires.
3. **AC commun 3** - Given une story Lot A en revue, when le reviewer relit la PR, then la checklist DoD a11y (voir section `## DoD a11y` en bas) est presente dans la description et les cases applicables sont cochees.

### AC propres a la Story 2.5.2

4. **AC1 - Skip-link present au layout root** : Given un visiteur sur n'importe quelle page de roxanetnous, when le DOM est rendu, then un element `<a href="#main-content">Aller au contenu principal</a>` existe en **premier enfant** de `<body>` (avant `{children}`, avant `LastSeenTracker`, avant `CookieBanner`), masque visuellement par defaut (`sr-only`) et revele au focus (`focus:not-sr-only`).
5. **AC2 - Skip-link premier element focusable** : Given un visiteur sur la home page (`/`), when il appuie sur Tab depuis la barre d'URL du navigateur, then le **premier** element focusable est le skip-link, qui apparait visuellement avec un fond contraste (`focus:bg-white focus:text-black`), un padding suffisant (`focus:px-4 focus:py-2`), une bordure arrondie (`focus:rounded`) et un ring de focus visible (`focus:outline-none focus:ring-2 focus:ring-black focus:ring-offset-2`).
6. **AC3 - Skip-link deplace le focus sur `<main>`** : Given le skip-link a le focus, when le visiteur appuie sur Enter, then le focus est deplace sur l'element `<main id="main-content">` (verifiable via `document.activeElement.tagName === 'MAIN'` ou test manuel : Tab suivant doit aller au premier element focusable de `<main>`, **pas** au logo header). Note : le `<main>` recoit `tabindex="-1"` pour permettre le deplacement programmatique du focus, sans pour autant entrer dans la sequence Tab naturelle.
7. **AC4 - Un seul `<main id="main-content">` par page** : Given le DOM rendu de chaque page de l'application, when un developpeur inspecte le HTML, then il existe **exactement un** element `<main id="main-content">` par page (pas zero, pas deux). Verifie sur les 5 categories de pages : (a) landing/auth publique (`/`, `/login`, `/register`, `/forgot-password`, `/reset-password`, `/cgu`, `/mentions-legales`, `/politique-de-confidentialite`, `/not-found`), (b) accompagne (`/accompagne/dashboard`, `/accompagne/profil`, `/accompagne/abonnement`, `/accompagne/annonces`, `/recherche`, `/recherche/[id]`, `/favoris`, `/messages`, `/messages/[id]`), (c) accompagnante (`/accompagnante/onboarding`, `/accompagnante/dashboard`, `/accompagnante/profil`, `/accompagnante/abonnement`, `/accompagnante/annonces`, `/accompagnante/parrainage`), (d) admin (toutes les pages sous `/admin/*`), (e) special (`/recherche/demandes`).
8. **AC5 - Pas de regression visuelle** : Given une page de roxanetnous avant et apres la story, when on compare visuellement (capture d'ecran, navigation manuelle), then le rendu visuel est **identique** sauf pour le skip-link qui apparait uniquement quand il a le focus. Aucun changement de fond, de spacing, ou de couleur.
9. **AC6 - Test clavier sur 3 pages representatives** : Given un test manuel sur (1) landing `/`, (2) `/accompagne/dashboard`, (3) `/accompagne/abonnement`, when l'utilisateur appuie sur Tab depuis la barre d'URL puis sur Enter, then le focus est visiblement deplace sur le contenu principal (le prochain Tab doit cibler un element interactif **dans** le `<main>`, pas dans le header).
10. **AC7 - CI Vercel verte** : Given la PR de la story, when la CI tourne, then le build Vercel passe (`npm run lint:a11y-check && next build`) sans regression jsx-a11y et sans erreur TypeScript.
11. **AC8 - Pas de double `<main>`** : Given la page `/admin/messages/[id]`, when le DOM est inspecte, then il n'existe qu'**un seul** `<main>` (resolu en convertissant le `<main>` interne de la page en `<div>` ou `<section>`, le `<main>` du `app/admin/layout.tsx` reste seul porteur de l'ancre `id="main-content"`).

## Tasks / Subtasks

- [x] **Task 1 - Ajouter le skip-link au layout root** (AC: #4, #5)
  - [x] Sous 1.1 : Editer `app/layout.tsx`. En premier enfant de `<body>` (avant `{children}`, avant `LastSeenTracker`, avant `CookieBanner`), ajouter :
    ```tsx
    <a
      href="#main-content"
      className="sr-only focus:not-sr-only focus:absolute focus:top-4 focus:left-4 focus:z-50 focus:bg-white focus:text-black focus:px-4 focus:py-2 focus:rounded focus:outline-none focus:ring-2 focus:ring-black focus:ring-offset-2"
    >
      Aller au contenu principal
    </a>
    ```
  - [x] Sous 1.2 : Justification du `focus:ring-2 focus:ring-black focus:ring-offset-2` (et non `focus:ring-[var(--focus-ring)]`) : le token `--focus-ring` n'existe pas encore (introduit en Story 2.5.3). On utilise `ring-black` (ratio 21:1 sur fond blanc) pour ne pas creer de dependance bloquante. Ce pattern est deja employe ailleurs dans le repo (ex. `app/recherche/page.tsx:284`, `components/admin/signalement-actions.tsx:46`). Ajouter un commentaire TODO discret juste au-dessus du skip-link : `{/* TODO 2.5.3 : remplacer ring-black par ring-[var(--focus-ring)] */}` (commentaire JSX, sans emoji).
  - [x] Sous 1.3 : Verifier que la classe `sr-only` est bien fournie par Tailwind v4 (utilisee deja dans `app/page.tsx:95`, `components/admin/departements-manager.tsx:224`, `components/accompagnante/profile-form.tsx`, etc. donc OK sans config supplementaire).

- [x] **Task 2 - Ajouter `id="main-content"` et `tabindex="-1"` au layout admin** (AC: #4, #6, #7)
  - [x] Sous 2.1 : Editer `app/admin/layout.tsx` ligne 25. Remplacer :
    ```tsx
    <main className="min-h-screen kraft bg-kraft">
    ```
    par :
    ```tsx
    <main id="main-content" tabIndex={-1} className="min-h-screen kraft bg-kraft focus:outline-none">
    ```
  - [x] Sous 2.2 : Justification de `tabindex={-1}` : permet au focus d'etre deplace programmatiquement (via le clic sur le skip-link qui declenche le focus du browser sur l'ancre) sans pour autant ajouter le `<main>` a la sequence Tab naturelle. Le `focus:outline-none` evite un ring de focus visible quand le `<main>` recoit le focus (sinon une bordure apparaitrait sur tout le layout, ce qui est laid). Pattern documente dans WAI-ARIA Authoring Practices.
  - [x] Sous 2.3 : Resoudre la collision avec `app/admin/messages/[id]/page.tsx` ligne 47 (voir Task 3).

- [x] **Task 3 - Resoudre le double-`<main>` admin/messages/[id]** (AC: #11)
  - [x] Sous 3.1 : Editer `app/admin/messages/[id]/page.tsx`. Remplacer ligne 47 :
    ```tsx
    <main className="flex flex-col flex-1">
    ```
    par :
    ```tsx
    <div className="flex flex-col flex-1">
    ```
    Et la balise fermante `</main>` correspondante par `</div>`.
  - [x] Sous 3.2 : Justification : un seul `<main>` autorise par document HTML5. Le `<main id="main-content">` du layout admin (Task 2) suffit. Le wrapper interne devient un simple `<div>` sans semantique de landmark.
  - [x] Sous 3.3 : Verifier visuellement que la conversion `<main>` -> `<div>` ne casse pas le flex layout (les classes Tailwind `flex flex-col flex-1` sont preservees).

- [x] **Task 4 - Ajouter `id="main-content"` et `tabindex="-1"` aux pages avec `<main>` direct** (AC: #4, #6, #7)
  - [x] Sous 4.1 : Liste exhaustive des fichiers a modifier (29 fichiers `page.tsx` + 1 page client + 2 composants client) :
    - `app/page.tsx` (ligne 89 : `<main className="flex-1">`)
    - `app/messages/page.tsx`, `app/messages/[id]/page.tsx`
    - `app/favoris/page.tsx`
    - `app/recherche/page.tsx`, `app/recherche/[id]/page.tsx`, `app/recherche/demandes/page.tsx`
    - `app/cgu/page.tsx`, `app/mentions-legales/page.tsx`, `app/politique-de-confidentialite/page.tsx`
    - `app/login/page.tsx`, `app/forgot-password/page.tsx`, `app/reset-password/page.tsx`
    - `app/not-found.tsx`
    - `app/accompagne/dashboard/page.tsx`, `app/accompagne/profil/page.tsx`
    - `app/accompagne/abonnement/page.tsx`, `app/accompagne/abonnement/success/page.tsx`
    - `app/accompagne/annonces/page.tsx`, `app/accompagne/annonces/nouvelle/page.tsx`, `app/accompagne/annonces/[id]/modifier/page.tsx`
    - `app/accompagnante/dashboard/page.tsx`, `app/accompagnante/profil/page.tsx`
    - `app/accompagnante/abonnement/page.tsx`, `app/accompagnante/abonnement/success/page.tsx`
    - `app/accompagnante/annonces/page.tsx`, `app/accompagnante/annonces/nouvelle/page.tsx`, `app/accompagnante/annonces/[id]/modifier/page.tsx`
    - `app/accompagnante/parrainage/page.tsx`
    - `components/auth/register-form.tsx` (2 `<main>` : ligne 186 emailSent, ligne 215 formulaire) -- utilise par `app/register/page.tsx`
    - `components/accompagnante/onboarding-client.tsx` (ligne 126) -- utilise par `app/accompagnante/onboarding/page.tsx`
  - [x] Sous 4.2 : Pour chacun, ajouter `id="main-content" tabIndex={-1}` au `<main>` et la classe `focus:outline-none` aux classes existantes. Exemple :
    ```tsx
    // Avant
    <main className="min-h-screen kraft bg-kraft">
    // Apres
    <main id="main-content" tabIndex={-1} className="min-h-screen kraft bg-kraft focus:outline-none">
    ```
  - [x] Sous 4.3 : Cas particulier `register-form.tsx` : les deux `<main>` sont dans des branches `if (emailSent) return ...` / `return ...` mutuellement exclusives, donc un seul est rendu a la fois. Ajouter `id="main-content"` et `tabIndex={-1}` aux deux est correct (pas de duplication a l'execution).
  - [x] Sous 4.4 : Ne **pas** modifier `app/admin/messages/[id]/page.tsx` (deja traite Task 3).

- [x] **Task 5 - Verification systematique anti-regression `<main>`** (AC: #4, #7)
  - [x] Sous 5.1 : Apres modifications, executer :
    ```bash
    grep -rn "<main" app/ components/ --include="*.tsx" | grep -v "id=\"main-content\""
    ```
    Le resultat attendu est **vide** (sauf eventuellement le `<main>` du layout admin qui sera capture par le grep precedent puisqu'il aura `id="main-content"`).
  - [x] Sous 5.2 : Verifier l'absence de double-`<main>` :
    ```bash
    grep -rn "<main" app/ components/ --include="*.tsx" | wc -l
    ```
    Le compteur doit correspondre au nombre attendu : 1 (admin layout) + 28 (pages publiques/auth/utilisateur avec `<main>` direct) + 2 (register-form emailSent + formulaire) + 1 (onboarding-client) = **32 occurrences**, toutes avec `id="main-content"`. Si le compteur est different, identifier la cause (page sans `<main>` ? double-`<main>` residual ?).
  - [x] Sous 5.3 : Verifier que `app/admin/page.tsx`, `app/admin/utilisateurs/page.tsx`, `app/admin/annonces/page.tsx`, `app/admin/parrainages/page.tsx`, `app/admin/parrainages/blacklist/page.tsx`, `app/admin/signalements/page.tsx`, `app/admin/historique/page.tsx`, `app/admin/departements/page.tsx`, `app/admin/utilisateurs/[id]/page.tsx`, `app/admin/validation/[id]/page.tsx`, `app/admin/messages/page.tsx` n'ont **toujours pas** de `<main>` (elles s'appuient sur celui du layout admin -- comportement attendu, ne pas en ajouter).

- [x] **Task 6 - Test manuel clavier sur 3 pages representatives** (AC: #6) -- **Valide par Sylvain en local le 2026-05-04**
  - [x] Sous 6.1 : Lancer `npm run dev`. Ouvrir Chrome ou Firefox.
  - [x] Sous 6.2 : Page 1 -- landing `/`. Cliquer dans la barre d'URL pour vider le focus. Appuyer sur Tab -> le skip-link apparait visuellement en haut a gauche. Appuyer sur Enter -> le focus passe sur `<main>`. Appuyer a nouveau sur Tab -> le prochain element focusable doit etre **dans** `<main>` (pas le logo header, pas un lien du header). Documenter dans le PR avec une capture du skip-link visible.
  - [x] Sous 6.3 : Page 2 -- `/accompagne/dashboard` (necessite login). Idem.
  - [x] Sous 6.4 : Page 3 -- `/accompagne/abonnement`. Idem.
  - [x] Sous 6.5 : Si l'une des pages echoue (focus reste sur le skip-link, ou repart sur le header), c'est generalement parce que le `<main>` cible n'a pas `tabindex={-1}` ou parce que l'`id="main-content"` pointe vers le mauvais element. Corriger.

- [x] **Task 7 - Verification CI** (AC: #7, #1)
  - [x] Sous 7.1 : `npm run lint:a11y-check` -> exit 0 (160 violations baseline = 160 violations actuelles, pas de nouvelle violation).
  - [x] Sous 7.2 : `npm run build` -> Next 16 build reussi sans erreur TypeScript ni warning bloquant.
  - [ ] Sous 7.3 : Push branche, ouvrir PR, verifier preview Vercel verte. -- **A faire par Sylvain**

## Dev Notes

### Contexte projet (specifique - lire avant tout)

- **Etat actuel pre-story (verifie 2026-05-04)** :
  - `app/layout.tsx` : pas de `<main>`, pas de skip-link. `{children}` est rendu directement dans `<body>`, suivi de `LastSeenTracker` et `CookieBanner`.
  - `app/admin/layout.tsx` : possede deja un `<main className="min-h-screen kraft bg-kraft">` ligne 25 qui enveloppe le header admin, la nav admin et `{children}`. Toutes les pages enfants `app/admin/*/page.tsx` n'ont **pas** de `<main>` propre **sauf** `app/admin/messages/[id]/page.tsx` qui en redeclare un (double-`<main>`, violation HTML5).
  - 29 pages `page.tsx` declarent un `<main>` direct (liste exhaustive en Task 4.1).
  - 2 composants client (`register-form.tsx`, `onboarding-client.tsx`) declarent des `<main>` utilises par `app/register/page.tsx` et `app/accompagnante/onboarding/page.tsx` respectivement.
  - **Total `<main>` dans le repo : 32 occurrences**, dont 1 de trop (le double dans admin/messages/[id]) -> apres story : **31 occurrences**, toutes avec `id="main-content"` et `tabIndex={-1}`.

- **Approche retenue (b) du tech-spec** : ajouter `id="main-content"` aux `<main>` existants page-level **plutot que** de centraliser un `<main>` au layout root. Justification : les `<main>` actuels portent du styling metier (`min-h-screen kraft bg-kraft`, `flex-1 max-w-3xl mx-auto px-4 py-12 relative z-10`, `min-h-screen flex items-center justify-center p-4 kraft bg-kraft`) qui differe selon les pages. Centraliser au layout root forcerait a remonter un styling generique et a soit (1) le surcharger sur chaque page (complexe), soit (2) accepter une regression visuelle. Le tech-spec autorise explicitement cette approche : « approche (a) preferee si possible ; sinon (b) garder le layout sans `<main>` et ajouter `id="main-content"` aux `<main>` existants ainsi qu'un audit pour s'assurer que toutes les pages en ont un ». L'audit Task 5 garantit la coherence.

- **Pas de pnpm** : le projet utilise **npm** (`package-lock.json`). Toutes les commandes : `npm run lint:a11y-check`, `npm run build`, `npm run dev`.

- **CI = Vercel preview deployments uniquement**. Pas de GitHub Actions.

- **Tailwind v4 CSS-only** : pas de `tailwind.config.ts`. Les classes utilitaires (`sr-only`, `focus:not-sr-only`, `focus:absolute`, etc.) sont fournies nativement par Tailwind v4. Aucune configuration supplementaire necessaire.

- **Pas d'emojis** dans le code, les commentaires, le contenu visuel ou les commits (regle stricte projet).

### Choix techniques (justifies)

- **`ring-black` plutot que `ring-[var(--focus-ring)]` sur le skip-link** : le tech-spec d'origine prevoit `focus:ring-2 focus:ring-[var(--focus-ring)]` mais le token `--focus-ring` est introduit en Story 2.5.3 (apres celle-ci dans l'ordre Lot A). Pour ne pas creer de dependance bloquante (la 2.5.2 doit pouvoir merger sans la 2.5.3), on utilise `focus:ring-2 focus:ring-black focus:ring-offset-2`. Avantages : (1) le ratio noir sur blanc est `21:1`, largement au-dela du seuil WCAG `3:1` ; (2) la conversion vers `focus:ring-[var(--focus-ring)]` lors de la 2.5.3 sera triviale (un seul attribut a changer) ; (3) ce pattern est deja employe sur le projet (`app/recherche/page.tsx:284`, `components/admin/signalement-actions.tsx:46`, `components/admin/validation-actions.tsx:131`), coherence preservee.

- **`tabindex="-1"` sur `<main>` plutot que `tabindex="0"`** : `tabindex="-1"` rend l'element focusable **programmatiquement** (via `element.focus()` ou par activation d'une ancre `#id`) **sans** l'inclure dans la sequence Tab naturelle. C'est exactement le comportement souhaite : le skip-link active le focus du `<main>`, mais l'utilisateur ne doit pas tabber dans le `<main>` lui-meme (il tabbe dans son contenu). Pattern documente : WAI-ARIA Authoring Practices, "Skip Link" example. `tabindex="0"` ajouterait une etape Tab inutile et changerait l'ordre de tabulation.

- **`focus:outline-none` sur `<main>` apres focus** : sans cette classe, certains navigateurs (Firefox, Safari) affichent un ring de focus par defaut sur l'element qui recoit le focus programmatique. Comme le `<main>` couvre toute la page, ce ring serait une bande visible autour de l'ecran apres clic sur le skip-link. `focus:outline-none` supprime cette indication purement decorative, sans casser l'a11y (le skip-link a deplace le focus, l'utilisateur sait deja ou il est ; le prochain Tab ira sur le premier element focusable du contenu, ce qui est l'indication concrete).

- **Skip-link en premier enfant de `<body>`, AVANT `{children}`** : le pattern WCAG 2.4.1 exige que le skip-link soit le **tout premier** element focusable du document. Il doit donc se situer dans le DOM avant tout autre lien, bouton ou input. Placer apres `{children}` ferait apparaitre dans la sequence Tab : tous les liens du header, puis le skip-link -- inutilisable.

- **Approche (b) preservee : pas de `<main>` au layout root** : voir « Approche retenue » ci-dessus. Consequence : le `app/layout.tsx` ne **gagne pas** un `<main>`. Il gagne uniquement le skip-link.

- **Conversion `<main>` -> `<div>` sur `app/admin/messages/[id]/page.tsx`** plutot que de retirer le `<main>` du layout admin : le `<main>` du layout admin est le porteur naturel de l'ancre `id="main-content"` pour toutes les pages admin. Le retirer obligerait chaque page admin a redeclarer un `<main>` (10+ fichiers a toucher). Il est plus simple et plus correct de retirer le `<main>` interne (un seul fichier) et de le remplacer par `<div>`.

- **Pas de modification du composant `LastSeenTracker` ni `CookieBanner`** : ces composants sont rendus en bas du `<body>`, apres `{children}`. Ils ne sont pas dans le `<main>`, ce qui est correct semantiquement (ce sont des elements transverses qui ne font pas partie du contenu principal de la page). Ne pas les deplacer dans le `<main>`.

### Codebase patterns

- **Layout root `app/layout.tsx`** : structure actuelle :
  ```tsx
  <html lang="fr" className={...}>
    <body className={inter.className}>
      {children}
      <LastSeenTracker />
      <CookieBanner />
    </body>
  </html>
  ```
  Apres modification :
  ```tsx
  <html lang="fr" className={...}>
    <body className={inter.className}>
      <a href="#main-content" className="sr-only focus:not-sr-only focus:absolute focus:top-4 focus:left-4 focus:z-50 focus:bg-white focus:text-black focus:px-4 focus:py-2 focus:rounded focus:outline-none focus:ring-2 focus:ring-black focus:ring-offset-2">
        Aller au contenu principal
      </a>
      {children}
      <LastSeenTracker />
      <CookieBanner />
    </body>
  </html>
  ```

- **Patterns `<main>` existants dans le repo** :
  - Pattern 1 (le plus courant, ~25 occurrences) : `<main className="min-h-screen kraft bg-kraft">` -- utilise sur toutes les pages applicatives avec fond kraft.
  - Pattern 2 (pages legales) : `<main className="flex-1 max-w-3xl mx-auto px-4 py-12 relative z-10">` -- 3 occurrences (cgu, mentions-legales, politique-de-confidentialite).
  - Pattern 3 (pages auth centrees) : `<main className="min-h-screen flex items-center justify-center p-4 kraft bg-kraft">` -- 4 occurrences (login, forgot-password, reset-password, register-form).
  - Pattern 4 (landing) : `<main className="flex-1">` -- 1 occurrence (`app/page.tsx`).
  - Pattern 5 (admin layout) : `<main className="min-h-screen kraft bg-kraft">` -- 1 occurrence.
  - Pattern 6 (admin/messages/[id], cas a corriger) : `<main className="flex flex-col flex-1">` -- a convertir en `<div>`.
  - Pattern 7 (success) : `<main className="min-h-screen kraft bg-kraft flex items-center justify-center">` -- 2 occurrences.
  - Pattern 8 (admin messages [id], le layout) : `<main className="flex flex-col flex-1">` -- voir Pattern 6.
  - Pattern 9 (annonces/[id]/modifier) : `<main className="min-h-screen kraft bg-kraft">` -- voir Pattern 1.
  - Pattern 10 (not-found) : `<main className="min-h-screen kraft bg-kraft flex flex-col items-center justify-center p-8">`
  
  Tous ces patterns conservent leurs classes Tailwind metier ; on **ajoute uniquement** `id="main-content" tabIndex={-1}` et la classe `focus:outline-none` (a la fin de la chaine de classes pour eviter les conflits).

- **`sr-only` Tailwind v4** : confirme present (utilise dans `app/page.tsx:95`, `components/admin/departements-manager.tsx:224`, `components/accompagnante/profile-form.tsx:303`, `components/accompagnante/step-specialites.tsx:42`, `components/accompagnante/step-diplome.tsx:154`).

- **Pas de tests unitaires** dans le repo (la retro epic 2 mentionne « 18 tests PASS » disparus). Cette story ne cree pas de tests automatises (Lot C).

### Anti-patterns a eviter

- **Ne pas creer un `<main>` au layout root** : ferait collision avec les 30+ `<main>` page-level existants -> `<main>` imbriques, violation HTML5 sur **toutes** les pages, regression catastrophique.
- **Ne pas oublier `tabindex={-1}` sur `<main>`** : sans lui, le focus ne peut **pas** etre deplace programmatiquement sur le `<main>` -> AC3 echoue, le skip-link visible mais non fonctionnel.
- **Ne pas mettre `tabindex="0"` sur `<main>`** : ajouterait une etape Tab inutile dans la sequence (apres le skip-link, l'utilisateur tabberait sur le `<main>` puis devrait re-tabber pour atteindre le contenu).
- **Ne pas ajouter `id="main-content"` ailleurs que sur `<main>`** : l'ancre doit pointer sur le landmark semantique. Pointer vers un `<div>` casse l'intention semantique.
- **Ne pas placer le skip-link APRES `{children}`** : il doit etre le **premier** focusable de la page. Apres `{children}`, il serait inutile.
- **Ne pas utiliser un `<button>` pour le skip-link** : la convention est un `<a href="#anchor">`. Un bouton ne deplace pas le focus du browser sur l'ancre automatiquement (il faudrait un handler `onClick` qui appelle `mainRef.current.focus()`, ce qui complique inutilement).
- **Ne pas ajouter d'emoji** dans le texte du skip-link (« Aller au contenu principal » uniquement, pas de fleche emoji ni d'icone unicode).
- **Ne pas modifier le styling existant du `<main>`** : conserver toutes les classes Tailwind actuelles. Ajouter uniquement `focus:outline-none` en plus.
- **Ne pas creer de tests automatises a11y** dans cette story (axe-core, Playwright a11y, etc. sont l'objet du Lot C).
- **Ne pas regenerer le baseline `_bmad-output/test-artifacts/a11y-lint-baseline-2026-05-04.txt`** : aucune modification de pattern jsx-a11y attendue (le skip-link est un `<a>` avec contenu textuel, pas de violation `anchor-has-content` ou autre).
- **Ne pas committer de fichier de test temporaire** (genre `app/_a11y-skiplink-test.tsx`) : si un fichier est cree pour les tests manuels, le supprimer avant le commit final.
- **Ne pas toucher a `app/admin/messages/[id]/page.tsx` au-dela de la conversion `<main>` -> `<div>`** : le reste de la page (logique Supabase, mark-as-read, classes existantes) reste intact.

### Source tree (fichiers modifies)

**Modifies** :
- `app/layout.tsx` (ajout du skip-link en premier enfant de `<body>`)
- `app/admin/layout.tsx` (ajout `id="main-content" tabIndex={-1}` + `focus:outline-none` au `<main>` ligne 25)
- `app/admin/messages/[id]/page.tsx` (conversion `<main>` -> `<div>` ligne 47)
- `app/page.tsx` (ajout `id` + `tabIndex` + `focus:outline-none` au `<main>` ligne 89)
- `app/messages/page.tsx`, `app/messages/[id]/page.tsx`
- `app/favoris/page.tsx`
- `app/recherche/page.tsx`, `app/recherche/[id]/page.tsx`, `app/recherche/demandes/page.tsx`
- `app/cgu/page.tsx`, `app/mentions-legales/page.tsx`, `app/politique-de-confidentialite/page.tsx`
- `app/login/page.tsx`, `app/forgot-password/page.tsx`, `app/reset-password/page.tsx`
- `app/not-found.tsx`
- `app/accompagne/dashboard/page.tsx`, `app/accompagne/profil/page.tsx`
- `app/accompagne/abonnement/page.tsx`, `app/accompagne/abonnement/success/page.tsx`
- `app/accompagne/annonces/page.tsx`, `app/accompagne/annonces/nouvelle/page.tsx`, `app/accompagne/annonces/[id]/modifier/page.tsx`
- `app/accompagnante/dashboard/page.tsx`, `app/accompagnante/profil/page.tsx`
- `app/accompagnante/abonnement/page.tsx`, `app/accompagnante/abonnement/success/page.tsx`
- `app/accompagnante/annonces/page.tsx`, `app/accompagnante/annonces/nouvelle/page.tsx`, `app/accompagnante/annonces/[id]/modifier/page.tsx`
- `app/accompagnante/parrainage/page.tsx`
- `components/auth/register-form.tsx` (2 `<main>` ligne 186 et 215)
- `components/accompagnante/onboarding-client.tsx` (1 `<main>` ligne 126)

**Crees** :
- (aucun fichier cree)

**Non modifies (mais pertinents)** :
- `app/admin/page.tsx`, `app/admin/utilisateurs/page.tsx`, `app/admin/utilisateurs/[id]/page.tsx`, `app/admin/annonces/page.tsx`, `app/admin/parrainages/page.tsx`, `app/admin/parrainages/blacklist/page.tsx`, `app/admin/signalements/page.tsx`, `app/admin/historique/page.tsx`, `app/admin/departements/page.tsx`, `app/admin/validation/[id]/page.tsx`, `app/admin/messages/page.tsx` (s'appuient sur le `<main>` du layout admin, pas de modification necessaire)
- `app/register/page.tsx`, `app/accompagnante/onboarding/page.tsx` (utilisent les composants client modifies, pas de `<main>` direct dans la page)
- `app/globals.css` (token `--focus-ring` introduit en Story 2.5.3, pas dans celle-ci)

### Testing standards summary

- **Pas de tests automatises** crees par cette story (suivant convention projet, et hors scope Lot A).
- **Verification manuelle obligatoire** :
  1. `npm run lint:a11y-check` -> exit 0 (160 = 160 baseline, pas de regression).
  2. `npm run build` -> reussi.
  3. `npm run dev`, ouvrir `/`, Tab depuis URL bar -> skip-link apparait, Enter -> focus sur `<main>`. Verifier visuellement.
  4. Repeter sur `/accompagne/dashboard` (apres login) et `/accompagne/abonnement`.
  5. Inspecter le DOM des 5 categories de pages (Task 5.3) pour verifier qu'il existe **exactement un** `<main id="main-content">`.
  6. Verification anti-regression : naviguer aux 4 parcours majeurs (login, recherche, messagerie, dashboard) au clavier seul pour s'assurer qu'aucune regression visuelle ou interactive n'est introduite.

### Project Structure Notes

- Aucun conflit avec la structure existante. Toutes les modifications se font dans des fichiers existants.
- Pas de breaking change : aucune migration BDD, aucun nouveau server action, aucun changement Stripe/Supabase/Resend.
- Le `<main>` du layout admin (`app/admin/layout.tsx`) devient le porteur principal de l'ancre pour toutes les pages admin -> simplifie la maintenance future.
- Le skip-link est entierement gere par le layout root, donc valide automatiquement pour **toutes** les pages futures (y compris celles a creer en epic 3 et au-dela). Aucune duplication de code.

### Previous story intelligence (Story 2.5.1)

Patterns issus de la livraison de la Story 2.5.1 (commit `ba11299`, statut done, baseline 160 violations) applicables ici :

- **Conventions commit** : commit sobre en francais, sans emoji, prefixe par theme. Pour cette story : `Story 2.5.2 : skip-link et structure layout` ou variante (`Story 2.5.2 : skip-link aller au contenu`).
- **CI Vercel verte = prerequis du merge** : confirmation explicite par l'utilisateur (« Story 2.5.1 mergee, CI Vercel verte »). Meme regle pour la 2.5.2.
- **Mode `warn` ESLint** : la 2.5.1 a downgrade tous les `error` en `warn` au demarrage. Le check delta passe par `npm run lint:a11y-check` qui compare paire `(fichier, regle)`. Cette story ne devrait pas modifier le compteur (skip-link bien forme + `<main>` valides).
- **Baseline existant a respecter** : `_bmad-output/test-artifacts/a11y-lint-baseline-2026-05-04.txt` capture 160 violations dont 77 `label-has-for`, 53 `label-has-associated-control`, 16 `control-has-associated-label`. La modification de `<main>` n'introduit aucune de ces patterns. Verifier `npm run lint:a11y-check` apres modification.
- **Approche pragmatique sur les divergences tech-spec / realite repo** : la Story 2.5.1 a documente une serie d'ecarts dans une section « Realites projet » du tech-spec. Cette story 2.5.2 herite de ces realites (npm, Vercel, Tailwind v4, ESM, pas d'emoji) sans les redocumenter -- voir le tech-spec `_bmad-output/implementation-artifacts/tech-spec-lot-a-a11y.md` section « Realites projet (constat 2026-05-04) ».
- **Reflexe « extraction hors `'use server'` »** : non applicable (pas de server actions touchees).

### References

- [Source: _bmad-output/implementation-artifacts/tech-spec-lot-a-a11y.md#Story-2.5.2] - tech-spec source de la story (Tasks 6 et 7)
- [Source: _bmad-output/planning-artifacts/audit-a11y-2026-05-04.md#2.1] - audit a11y, constat skip-link absent + `<main>` incoherent
- [Source: _bmad-output/test-artifacts/nfr-assessment-a11y-2026-05-04.md#B1] - NFR a11y, critere B1 skip-link et seuil mesurable
- [Source: _bmad-output/implementation-artifacts/2-5-1-outillage-a11y-baseline-lint.md] - story precedente du Lot A, outillage et baseline
- [Source: app/layout.tsx] - layout racine actuel (cible de la modification)
- [Source: app/admin/layout.tsx] - layout admin avec `<main>` deja present (cible de l'ancre)
- [Source: app/admin/messages/[id]/page.tsx#L47] - cas particulier double-`<main>` a corriger
- [Source: components/auth/register-form.tsx#L186-215] - composant client avec 2 `<main>` mutuellement exclusifs
- [Source: components/accompagnante/onboarding-client.tsx#L126] - composant client avec `<main>` direct
- [Source: WAI-ARIA Authoring Practices Guide, "Skip Link"] - pattern de reference pour `tabindex="-1"` sur `<main>`
- [Source: WCAG 2.2 AA, criterion 2.4.1 Bypass Blocks] - exigence formelle du skip-link

## Dev Agent Record

### Agent Model Used

claude-opus-4-7 (Claude Opus 4.7, 1M context) -- session 2026-05-04 via skill `bmad-dev-story`.

### Debug Log References

- `npm run lint:a11y-check` -> `OK: 160 jsx-a11y violations across 59 (file, rule) pair(s). Baseline total: 160. No regression.`
- `npm run build` -> `Compiled successfully in 2.5s` + `Finished TypeScript in 2.8s` + 46 routes generees.
- Audit grep avant modification : 34 occurrences `<main>` (1 admin layout + 1 admin/messages/[id] a convertir + 29 pages directes + 2 register-form + 1 onboarding-client). Apres : 33 occurrences, toutes avec `id="main-content"` (la conversion en `<div>` retire 1 occurrence).
- Verification finale `grep -rn "<main" ... | grep -v 'id="main-content"'` : aucun resultat (0 `<main>` orphelin).
- Verification anti-double : `grep -l "<main" $(find app/admin -name "page.tsx")` : exit 1, aucune page admin enfant ne porte un `<main>` propre (toutes s'appuient sur le layout admin).

### Completion Notes List

- Skip-link ajoute en premier enfant de `<body>` dans `app/layout.tsx`, avec commentaire TODO 2.5.3 anticipant la migration vers le token `--focus-ring` introduit en story 2.5.3.
- 32 fichiers modifies au total (1 layout root + 1 layout admin + 1 page admin/messages/[id] convertie + 29 pages directes + 2 composants client). La story prevoyait 32 fichiers ; la liste Task 4.1 contient bien 29 pages directes (la mention « 28 » dans Task 5.2 etait un decompte errone -- non bloquant, l'inventaire reel a ete suivi).
- Conversion `<main>` -> `<div>` reussie sur `app/admin/messages/[id]/page.tsx` (suppression du double-`<main>` HTML5).
- `tabIndex={-1}` ajoute sur tous les `<main>` pour permettre le deplacement programmatique du focus sans entrer dans la sequence Tab naturelle.
- `focus:outline-none` ajoute sur tous les `<main>` pour eviter un ring de focus visible sur la pleine largeur de la page (Firefox/Safari) lors du clic sur le skip-link.
- Pattern `ring-black` retenu (au lieu de `ring-[var(--focus-ring)]`) car le token est introduit par la story 2.5.3 ; remplacement trivial prevu (1 attribut).
- Aucun emoji introduit (regle stricte projet respectee).
- Aucune regression `jsx-a11y` (160 = 160 baseline).
- Aucune erreur TypeScript / build Next 16 reussi.
- Test manuel clavier (Task 6) valide par Sylvain le 2026-05-04 :
  - Landing `/` : skip-link visible au 1er Tab ; Enter saute au `<main>` (URL -> `#main-content`) ; 2e Tab arrive sur le 1er element interactif du main.
  - `/accompagne/dashboard` : OK.
  - `/accompagne/abonnement` : OK.
- Verification VoiceOver (DoD a11y) valide par Sylvain le 2026-05-04 : VoiceOver annonce correctement le skip-link au 1er Tab sur la landing.

### File List

**Modifies (32) :**

- `app/layout.tsx`
- `app/admin/layout.tsx`
- `app/admin/messages/[id]/page.tsx`
- `app/page.tsx`
- `app/messages/page.tsx`
- `app/messages/[id]/page.tsx`
- `app/favoris/page.tsx`
- `app/recherche/page.tsx`
- `app/recherche/[id]/page.tsx`
- `app/recherche/demandes/page.tsx`
- `app/cgu/page.tsx`
- `app/mentions-legales/page.tsx`
- `app/politique-de-confidentialite/page.tsx`
- `app/login/page.tsx`
- `app/forgot-password/page.tsx`
- `app/reset-password/page.tsx`
- `app/not-found.tsx`
- `app/accompagne/dashboard/page.tsx`
- `app/accompagne/profil/page.tsx`
- `app/accompagne/abonnement/page.tsx`
- `app/accompagne/abonnement/success/page.tsx`
- `app/accompagne/annonces/page.tsx`
- `app/accompagne/annonces/nouvelle/page.tsx`
- `app/accompagne/annonces/[id]/modifier/page.tsx`
- `app/accompagnante/dashboard/page.tsx`
- `app/accompagnante/profil/page.tsx`
- `app/accompagnante/abonnement/page.tsx`
- `app/accompagnante/abonnement/success/page.tsx`
- `app/accompagnante/annonces/page.tsx`
- `app/accompagnante/annonces/nouvelle/page.tsx`
- `app/accompagnante/annonces/[id]/modifier/page.tsx`
- `app/accompagnante/parrainage/page.tsx`
- `components/auth/register-form.tsx`
- `components/accompagnante/onboarding-client.tsx`

**Crees :** aucun.

**Supprimes :** aucun.

### Change Log

- 2026-05-04 -- Implementation Story 2.5.2 (skip-link et structure layout). Ajout du skip-link au layout root, ancrage `id="main-content"` + `tabIndex={-1}` + `focus:outline-none` sur tous les `<main>` du repo, conversion du double-`<main>` admin/messages/[id] en `<div>`. Build Next 16 vert, lint a11y baseline preserve (160 violations). Status : ready-for-dev -> review.

### Review Findings

## DoD a11y

A renseigner pour toute story avec impact UI. Cette story a un impact UI direct (ajout d'un element focusable au layout) :

- [x] Labels associes aux champs (`htmlFor` ou `aria-labelledby`) -- **N/A** (pas de formulaire touche)
- [x] Erreurs liees aux champs via `aria-describedby` + `aria-invalid` -- **N/A** (pas de gestion d'erreur touchee)
- [x] Focus visible sur tous les elements interactifs (contraste >= 3:1) -- **OUI** : skip-link a `focus:ring-2 focus:ring-black focus:ring-offset-2` (ratio 21:1 sur fond blanc, largement >= 3:1)
- [x] Contrastes texte >= 4,5:1 et UI >= 3:1 -- **OUI** : skip-link en `text-black` sur `bg-white` au focus, ratio 21:1
- [x] ARIA states corrects sur composants dynamiques (`aria-expanded`, `aria-selected`, etc.) -- **N/A** (skip-link n'est pas un composant a etat)
- [x] Navigation clavier complete (Tab, Enter, Escape, fleches selon pattern) -- **OUI** : test manuel Task 6 valide par Sylvain le 2026-05-04 sur landing `/`, `/accompagne/dashboard`, `/accompagne/abonnement`.
- [x] Verification ponctuelle au lecteur d'ecran (VoiceOver ou NVDA) sur le composant touche -- **OUI** : VoiceOver annonce correctement le skip-link au 1er Tab sur la landing (valide par Sylvain le 2026-05-04).
- [x] Pas de regression `eslint-plugin-jsx-a11y` (`npm run lint:a11y-check` vert en CI) -- **OUI** : verifie en Task 7.1 (160 = 160 baseline).
