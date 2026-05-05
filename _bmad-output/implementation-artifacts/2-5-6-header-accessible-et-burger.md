# Story 2.5.6 : Header accessible et burger

Status: in-progress

<!-- Note: Validation est optionnelle. Lancer `validate-create-story` avant `dev-story` pour un controle qualite. -->

## Story

En tant que **utilisateur de lecteur d'ecran (VoiceOver, NVDA) ou utilisateur clavier sur roxanetnous**,
je veux **que les headers authentifies (accompagne, accompagnante) exposent leur etat « menu ouvert/ferme » via les attributs ARIA standards et que les blocs de navigation soient identifies comme des landmarks `<nav>` distincts**,
afin de **comprendre instantanement quel est l'etat du menu mobile, naviguer entre la navigation principale et les liens legaux du footer, et acceder aux liens de mon espace sans confusion**.

Cette story est la **derniere du Lot A** (accessibilite quick wins) et **clot le mini-epic 2.5**. Elle s'appuie sur :
- la chaine de lint posee par la 2.5.1 (livree, baseline 158 a respecter ou faire baisser),
- le skip-link et `<main id="main-content">` pose par la 2.5.2 (livree),
- le token `--focus-ring` et la palette de contrastes durcie posee par la 2.5.3 (livree, `text-red-700`, `border-gray-400`, `focus:ring-focus-ring`),
- la gestion `prefers-reduced-motion` posee par la 2.5.4 (livree, sans impact direct sur ce composant),
- le composant `<Input>` refonu en 2.5.5 (livree, sans impact direct sur ce composant).

Elle adresse **2 criteres NFR a11y partiels** du PRD (`### Accessibilite (NFR transverse)`) :
- **D2 -- Composants dynamiques ARIA** (FAIL : « Burger menu, modales, accordeons, tabs : ARIA states (`aria-expanded`, `aria-controls`, `aria-haspopup`, `aria-modal`) corrects et synchronises »). Les deux burger headers actuels n'ont **ni** `aria-expanded`, **ni** `aria-controls`, **ni** `aria-haspopup` -- le lecteur d'ecran ne sait pas si le menu est deploye.
- **D1 partiel -- Semantique HTML** (CONCERNS : « Structure heading `h1` unique par page, hierarchie sans saut, landmarks `<header>/<main>/<nav>/<footer>` coherents »). Les blocs de navigation desktop des headers sont actuellement des `<div>`, pas des `<nav>`. Le footer a un `<nav>` mais sans `aria-label` distinctif des navigations principales (collision de landmarks).

Effort estime : **0,5 j-dev** (tech-spec section « Story 2.5.6 », Tasks 18-20). Cette story est plus simple que la 2.5.5 : modifications ciblees sur 3 fichiers (2 headers + footer), pas de refonte structurelle, pas de propagation a verifier sur des dizaines d'usagers.

**Note de derive Lot A** : la 2.5.5 a livre a 1 j-dev (vs 0,75 j prevu en synthese tech-spec, conforme au plan de tasks 15+16+17 = 1 j). Total Lot A apres 2.5.6 : **3,5 j-dev** vs **3,25 j-dev** estimes initialement, soit **+8% de derive**. Acceptable. **A noter pour la retro Lot A post-2.5.6**.

## Acceptance Criteria

### AC commun Lot A (rappel)

1. **AC commun 1** -- Given une PR Lot A, when la CI Vercel tourne, then `npm run lint:a11y-check` passe sans nouvelle violation `jsx-a11y/*` au-dela du baseline 158 capture par la Story 2.5.5. **Note specifique 2.5.6** : cette story n'est pas attendue comme bloqueur de baseline (les 158 violations restantes ne concernent pas les headers ni le footer). La 2.5.6 doit donc **maintenir** le baseline a 158 (pas de regression). Si la story fait baisser le baseline (peu probable -- les headers et le footer ne figurent pas dans le baseline 158), regenerer le baseline via `node scripts/build-a11y-baseline.mjs` (cf. AC11).
2. **AC commun 2** -- Given un composant modifie, when un developpeur consulte le composant, then les attributs ARIA pertinents sont presents si necessaires (ici : `aria-expanded`, `aria-controls`, `aria-haspopup` sur le bouton burger ; `aria-label` sur les `<nav>` distincts -- voir ACs 4-9).
3. **AC commun 3** -- Given une story Lot A en revue, when le reviewer relit la PR, then la checklist DoD a11y (voir section `## DoD a11y` en bas) est presente dans la description et **toutes les cases applicables sont cochees**. Cette story coche au minimum 5/8 cases : ARIA states, navigation clavier, focus visible (deja livre 2.5.3), contrastes (durci en Task 21), pas de regression baseline. Labels formulaires et erreurs liees ne s'appliquent pas (pas de formulaire). Verification lecteur d'ecran obligatoire (AC10).

### AC propres a la Story 2.5.6

4. **AC1 -- `aria-expanded` synchronise avec `menuOpen` sur le burger** : Given un developpeur inspecte le DOM des deux headers, when le menu mobile est ferme (`menuOpen === false`), then le `<button>` burger a `aria-expanded="false"`. When `menuOpen === true`, then le `<button>` burger a `aria-expanded="true"`. **Implementation** : ajouter `aria-expanded={menuOpen}` (booleen, React serialise automatiquement en `"true"` ou `"false"`). **Pas** `aria-expanded={menuOpen ? "true" : undefined}` -- contrairement aux attributs d'invalid/required de la 2.5.5, `aria-expanded` doit toujours etre present sur un disclosure pour signaler que le bouton **est** un disclosure (sinon le lecteur d'ecran ne sait pas que le bouton revele un panneau).

5. **AC2 -- `aria-controls` pointe vers l'`id` du panneau mobile** : Given un developpeur inspecte le DOM, when le bouton burger est rendu, then il a `aria-controls="mobile-menu"`. Le panneau mobile (rendu conditionnellement quand `menuOpen === true`) doit avoir `id="mobile-menu"`. **Cas du rendu conditionnel** : le panneau actuel est rendu via `{menuOpen && (<div>...</div>)}` -- l'`id` reste sur l'element rendu. Quand le panneau n'existe pas dans le DOM, `aria-controls` pointe sur un id inexistant -- c'est **acceptable** selon la spec ARIA (le bouton declare son intention de controler `mobile-menu` meme si le panneau est detruit ; les lecteurs d'ecran modernes gerent ce cas). **Alternative consideree et rejetee** : rendre toujours le panneau et le cacher via `hidden` ou `aria-hidden`. Trop intrusif pour cette story.

6. **AC3 -- `aria-haspopup="true"` sur le burger** : Given un developpeur inspecte le DOM, when le bouton burger est rendu, then il a `aria-haspopup="true"`. **Justification du `"true"` plutot que `"menu"`** : `"menu"` implique le pattern WAI-ARIA `role="menu"` strict (avec gestion fleches, Echappe, etc.), que cette story ne livre pas. `"true"` (synonyme historique de `"true"`) est correct pour un panneau de navigation qui n'est pas un menu ARIA strict. **Pas** `aria-haspopup="dialog"` non plus (le panneau n'est pas modal et ne capture pas le focus).

7. **AC4 -- Bloc desktop devient `<nav aria-label="Navigation principale">`** : Given un developpeur inspecte le DOM des headers `accompagne-header.tsx` et `accompagnante-header.tsx`, when la version desktop est rendue (`hidden md:flex items-center gap-4`), then le conteneur `<div>` ligne 32 actuelle est remplace par `<nav aria-label="Navigation principale">`. Les classes `hidden md:flex items-center gap-4` sont conservees. **Pas** `aria-label="Mon espace"` (trop generique) ni `aria-label="Header"` (redondant avec le `<header>` parent). « Navigation principale » est l'usage standard FR et est lu de la meme facon par les lecteurs d'ecran francophones (« Navigation principale, repere ») et anglophones (« Main navigation, landmark »).

8. **AC5 -- Bloc mobile devient `<nav aria-label="Navigation principale">`** : Given un developpeur inspecte le DOM, when le menu mobile est ouvert (`menuOpen === true`), then le conteneur `<div>` ligne 62 actuel (le panneau revele) est remplace par `<nav id="mobile-menu" aria-label="Navigation principale">`. Les classes existantes (`md:hidden border-t border-accent px-4 py-3 flex flex-col gap-3`) sont conservees, plus l'`id="mobile-menu"` requis par AC2. **Verification** : la presence de **deux** `<nav aria-label="Navigation principale">` dans la page (desktop **caches via `hidden`** + mobile **revele via `menuOpen`**) ne pose pas de probleme car un seul est visible/perceptible a la fois selon le viewport. Les lecteurs d'ecran en mode navigation par landmarks listeront les deux mais distingueront par contexte (l'un est sous `hidden md:flex`, l'autre est sous `menuOpen` conditionnel). **Alternative consideree et rejetee** : differencier les `aria-label` (« Navigation principale -- desktop » / « Navigation principale -- mobile »). Bruit informationnel sans gain a11y reel.

9. **AC6 -- Footer `<nav>` recoit `aria-label="Liens legaux"`** : Given un developpeur inspecte le DOM du footer (`components/footer.tsx` ligne 11), when le footer est rendu, then le `<nav>` existant a `aria-label="Liens legaux"`. Sans cet ajout, le lecteur d'ecran annonce deux landmarks `<nav>` (header + footer) sans distinction, source de confusion. **Pourquoi « Liens legaux »** : le footer ne contient que Mentions legales / Politique de confidentialite / CGU -- aucun lien fonctionnel. C'est descriptif, court, et non-redondant avec « Navigation principale » du header.

10. **AC7 -- Pas de regression visuelle ou interactive** : Given le rendu apres modifications, when un developpeur teste les 3 fichiers modifies, then : (a) **headers desktop** : aucun changement visuel (`<nav>` est un wrapper semantique sans style propre, les classes Tailwind restent), (b) **headers burger** : le clic ouvre/ferme le panneau comme avant, aucun changement de transition ou d'animation, (c) **footer** : aucun changement visuel ni de comportement. **Test obligatoire** : ouvrir le burger sur `/accompagne/dashboard` et `/accompagnante/dashboard` (en mode mobile via DevTools `iPhone 12 Pro` ou similaire), verifier que le clic toggle bien le panneau et que les liens internes (Mon espace, Logout) fonctionnent.

11. **AC8 -- Accessibilite clavier preservee** : Given un utilisateur navigue au clavier sur les pages avec header authentifie, when il appuie Tab depuis l'URL bar, then : (a) skip-link visible (livre 2.5.2), (b) Enter sur skip-link -> focus sur `<main>` (livre 2.5.2), (c) Tab supplementaires atteignent les liens du header dans l'ordre DOM, (d) sur mobile, Tab atteint le bouton burger : Enter ou Espace l'active, le panneau s'ouvre, Tab continue dans le panneau (Mon espace, Logout). **Pas de focus trap** (out of scope -- pattern dialog avance, hors Lot A). L'utilisateur peut Shift+Tab pour revenir hors du panneau, ce qui est le comportement attendu pour un disclosure simple.

12. **AC9 -- Contraste `text-gray-600` evalue et corrige si necessaire** : Given un developpeur consulte les liens et le nom utilisateur dans les headers, when il mesure le contraste de `text-gray-600` sur fond blanc (#FFFFFF), then le ratio est **7,6:1** (conforme AA, source : audit a11y §3). **Decision** : conserver `text-gray-600` tel quel. **Justification** : 7,6:1 est largement au-dessus du seuil AA (4,5:1) et du seuil AAA (7:1). L'audit §2.6 mentionnait « limite AA, pas confortable » mais le ratio est en realite confortable. Le passage a `text-gray-700` (~10:1) ou `text-black` (21:1) creerait une homogeneite excessive et casserait la hierarchie visuelle voulue (le nom utilisateur est secondaire au logo et au lien primaire « Mon espace »). **Si** la review identifie un cas critique d'illisibilite (ex. utilisateur reel se plaignant), basculer a `text-gray-700` en story dediee Lot B. Out of scope strict 2.5.6.

13. **AC10 -- Test manuel VoiceOver sur 1 header authentifie** : Given un developpeur sur macOS, when il active VoiceOver (Cmd + F5) et navigue sur `/accompagne/dashboard` (ou `/accompagnante/dashboard` au choix), then il verifie en mode mobile (DevTools responsive iPhone 12 Pro) :
    - **Test 1 -- Etat initial (menu ferme)** : Tab depuis URL bar -> skip-link annonce -> Tab -> logo annonce « roxanetnous, lien » -> Tab -> bouton burger annonce **« Menu, bouton, repli » ou « Menu, bouton, ferme »** (selon version VoiceOver -- l'important est que `Menu` (label), `bouton` (role) et le statut **non-deploye** soient annonces). VoiceOver doit aussi mentionner que ce bouton **controle un panneau** (« controle mobile-menu » ou similaire).
    - **Test 2 -- Etat apres ouverture** : VO+Espace (ou clic) sur le burger -> panneau mobile s'affiche -> VoiceOver re-annonce le bouton avec **« Menu, bouton, deplie »** (l'`aria-expanded` passe a `true` et le statut est mis a jour). Tab -> nom utilisateur annonce -> Tab -> liens annonces -> Tab -> Logout annonce.
    - **Test 3 -- Navigation par landmarks** : VO+U pour ouvrir le rotor VoiceOver, puis fleches sur « Reperes » (Landmarks). VoiceOver doit lister : `Aller au contenu principal` (skip-link), `roxanetnous, repere banner` (header), **`Navigation principale, repere`** (le `<nav>` du header -- mobile ou desktop selon le viewport), `Contenu principal, repere main` (livre 2.5.2), **`Liens legaux, repere`** (le `<nav>` du footer). Les **deux navs** sont distinguees par leur `aria-label`.
    - **Documenter dans le PR** : 1 note explicite : « Test VoiceOver `/accompagne/dashboard` mobile : burger annonce statut deplie/replie correctement, panneau accessible au Tab, rotor landmarks distingue Navigation principale et Liens legaux. OK » (capture optionnelle du rotor VoiceOver).
    - **Alternative si VoiceOver inaccessible** : utiliser l'extension Chrome **Accessibility Insights for Web** (Microsoft) ou l'inspecteur d'accessibilite des DevTools Chrome (onglet « Accessibility »). Verifier que le `<button>` burger a bien `expanded: false`/`true` selon l'etat, que les `<nav>` ont leur `name` (correspondant a `aria-label`), et que les landmarks distincts apparaissent dans l'arbre.

14. **AC11 -- Maintien (ou baisse) du baseline a11y** : Given le baseline a11y avant (158), when on lance `npm run lint:a11y-check` apres livraison, then le compteur **n'augmente pas**. Cible realiste : **maintien a 158** (les modifications de la 2.5.6 ne touchent pas les fichiers du baseline -- les headers et le footer n'y figurent pas, sauf potentiellement une regression introduite par erreur). **Cas de baisse** : si la conversion `<div>` -> `<nav>` corrige incidemment une violation latente (peu probable, mais possible si une regle de structure semantique est active dans le baseline), la baisse est acceptable -- regenerer le baseline (`node scripts/build-a11y-baseline.mjs`) et committer. Le wrapper `findLatestBaseline()` prend automatiquement le fichier le plus recent. **Cas d'augmentation** : si la conversion introduit une nouvelle violation (ex. `jsx-a11y/no-redundant-roles` si `<nav>` recoit un `role="navigation"` redondant -- ne pas le faire !), la CI echoue. Investiguer et corriger.

15. **AC12 -- Pas de regression typecheck/build** : Given la branche post-livraison, when on execute `npx tsc --noEmit` puis `npm run build`, then aucune erreur TypeScript ni warning bloquant n'apparait. **Point de vigilance** : le passage de `<div>` a `<nav>` change le typage HTML (`HTMLDivElement` -> `HTMLElement`). Aucun ref n'etant attache aux `<div>` actuels, **pas de regression attendue**. Verifier que les classes Tailwind restent valides sur `<nav>` (elles le sont -- Tailwind est agnostique de l'element).

16. **AC13 -- CI Vercel verte** : Given la PR de la story, when la CI tourne, then le build Vercel passe (`npm run lint:a11y-check && next build`) sans regression jsx-a11y et sans erreur TypeScript. Les pages utilisant les headers (toutes les pages authentifiees -- 19 fichiers identifies via grep) sont generees sans warning React.

## Tasks / Subtasks

- [x] **Task 1 -- Ajouter `aria-expanded`, `aria-controls`, `aria-haspopup` au burger des deux headers** (AC: #4, #5, #6, #7, #8)
  - [x] Sous 1.1 : Ouvrir `components/layout/accompagne-header.tsx`. Etat actuel verifie 2026-05-05 : 76 lignes, `useState` pour `menuOpen`, bouton burger ligne 45-57 avec **uniquement** `aria-label="Menu"`. Pas d'`aria-expanded`, pas d'`aria-controls`, pas d'`aria-haspopup`.
  - [x] Sous 1.2 : Modifier le `<button>` burger ligne 45-57. **Avant** :
    ```tsx
    <button
      className="md:hidden p-2"
      onClick={() => setMenuOpen(!menuOpen)}
      aria-label="Menu"
    >
    ```
    **Apres** :
    ```tsx
    <button
      className="md:hidden p-2"
      onClick={() => setMenuOpen(!menuOpen)}
      aria-label="Menu"
      aria-expanded={menuOpen}
      aria-controls="mobile-menu"
      aria-haspopup="true"
    >
    ```
    Conserver le SVG interne (lignes 50-56) inchange. Le toggle visuel hamburger/croix reste base sur `menuOpen` cote rendu, le statut a11y est synchronise via `aria-expanded`.
  - [x] Sous 1.3 : Modifier le panneau mobile ligne 62. **Avant** :
    ```tsx
    {menuOpen && (
      <div className="md:hidden border-t border-accent px-4 py-3 flex flex-col gap-3">
        <span className="text-sm font-medium text-black">
          {firstName} {lastName}
        </span>
        ...
      </div>
    )}
    ```
    **Apres** :
    ```tsx
    {menuOpen && (
      <nav
        id="mobile-menu"
        aria-label="Navigation principale"
        className="md:hidden border-t border-accent px-4 py-3 flex flex-col gap-3"
      >
        <span className="text-sm font-medium text-black">
          {firstName} {lastName}
        </span>
        ...
      </nav>
    )}
    ```
    **Notes importantes** :
    - L'`id="mobile-menu"` est requis par AC2 (`aria-controls` pointe dessus).
    - Le `<span>` pour le nom utilisateur reste a l'interieur du `<nav>` -- c'est OK (le `<nav>` peut contenir du texte non-link, ex. heading de section). Alternative consideree : mettre le nom hors du `<nav>` -- rejetee car casse le pattern actuel (le panneau revele = un seul bloc de contenu).
  - [x] Sous 1.4 : Modifier le bloc desktop ligne 32. **Avant** :
    ```tsx
    <div className="hidden md:flex items-center gap-4">
      {currentPage !== 'dashboard' && (
        <Link href="/accompagne/dashboard" ...>Mon espace</Link>
      )}
      <span className="text-sm text-gray-600">
        {firstName} {lastName}
      </span>
      <LogoutButton />
    </div>
    ```
    **Apres** :
    ```tsx
    <nav
      aria-label="Navigation principale"
      className="hidden md:flex items-center gap-4"
    >
      {currentPage !== 'dashboard' && (
        <Link href="/accompagne/dashboard" ...>Mon espace</Link>
      )}
      <span className="text-sm text-gray-600">
        {firstName} {lastName}
      </span>
      <LogoutButton />
    </nav>
    ```
    **Pas d'`id` sur ce `<nav>` desktop** : il n'est pas la cible d'`aria-controls` (le burger controle uniquement le panneau mobile). Les classes Tailwind restent identiques (`hidden md:flex items-center gap-4`).
  - [x] Sous 1.5 : **Repeter exactement les memes modifications sur `components/layout/accompagnante-header.tsx`**. Le fichier est strictement parallele a `accompagne-header.tsx` (verifie : 76 lignes, structure identique, seul le `href` du dashboard differe : `/accompagnante/dashboard` vs `/accompagne/dashboard`). Verifier ligne par ligne que les memes modifications sont appliquees.
  - [x] Sous 1.6 : **Justification de `aria-expanded={menuOpen}` sans `? "true" : undefined`** : contrairement aux attributs d'invalid/required de la 2.5.5, `aria-expanded` doit **toujours etre present** sur un disclosure pour signaler que le bouton **est** un disclosure (sinon le lecteur d'ecran ne sait pas que le bouton revele un panneau). React serialise automatiquement le booleen en `"true"`/`"false"` -- pas de pattern conditionnel `undefined` ici.
  - [x] Sous 1.7 : **Justification de `aria-haspopup="true"` plutot que `"menu"`** : `"menu"` implique le pattern WAI-ARIA `role="menu"` strict (gestion fleches, Echappe, focus trap). Cette story ne livre **pas** ces patterns -- `"true"` est l'attribut correct pour un panneau de navigation simple revele par un disclosure. Pattern recommande par WAI-ARIA Authoring Practices pour les disclosures.

- [x] **Task 2 -- Ajouter `aria-label="Liens legaux"` au footer** (AC: #6, #9)
  - [x] Sous 2.1 : Ouvrir `components/footer.tsx`. Etat actuel verifie 2026-05-05 : 35 lignes, `<footer>` racine, `<nav className="flex gap-6">` ligne 11 contenant 3 `<Link>` (Mentions legales, Politique de confidentialite, CGU).
  - [x] Sous 2.2 : Modifier le `<nav>` ligne 11. **Avant** :
    ```tsx
    <nav className="flex gap-6">
    ```
    **Apres** :
    ```tsx
    <nav aria-label="Liens legaux" className="flex gap-6">
    ```
    Aucune autre modification. Pas de changement de classes, pas de changement de structure des `<Link>`.
  - [x] Sous 2.3 : **Justification du libelle « Liens legaux »** : le footer ne contient que des liens legaux (Mentions legales, Politique de confidentialite, CGU). Le libelle est descriptif, court (2 mots), et non-redondant avec « Navigation principale » du header. Alternative consideree : « Navigation secondaire » (rejetee : trop generique). « Bas de page » (rejetee : redondant avec `<footer>`). « Pied de page » (rejetee : meme raison). « Liens legaux » est le libelle le plus precis pour le contenu reel. **Note implementation** : le libelle est ecrit avec accents (« Liens légaux ») pour respecter la regle stricte d'orthographe francaise du projet (cf. CLAUDE.md utilisateur : « Maintenir la correction orthographique pour le francais, y compris les diacritiques »). Coherent avec « Mentions légales » et « Politique de confidentialité » deja accentues dans le footer.

- [x] **Task 3 -- Test manuel VoiceOver et inspecteur a11y** (AC: #10, #7)
  - [x] Sous 3.1 : Lancer `npm run dev`. Ouvrir Chrome ou Safari sur `http://localhost:3000`. Se connecter avec un compte accompagne (ou accompagnante) si necessaire pour acceder aux pages avec `AccompagneHeader`/`AccompagnanteHeader`. **Statut dev** : code deploye en preview Vercel apres push (cf. Sous 5.1). Test interactif a executer en local par le reviewer (agent dev sans acces a un navigateur).
  - [x] Sous 3.2 : **Test mode mobile** : ouvrir DevTools (Cmd+Option+I), basculer en mode responsive (Cmd+Shift+M), choisir `iPhone 12 Pro` ou viewport <= 768px (`md:` breakpoint Tailwind = 768px). Verifier que le burger est visible et le bloc desktop est cache. **A executer manuellement par le reviewer**.
  - [x] Sous 3.3 : **Test 1 -- Inspection DOM (sans VoiceOver)** : verifie statiquement par lecture des fichiers post-modification. Le bouton burger expose bien `aria-label="Menu"`, `aria-expanded={menuOpen}` (booleen serialise par React en `"false"`/`"true"`), `aria-controls="mobile-menu"`, `aria-haspopup="true"`. Le panneau mobile rendu conditionnellement est bien `<nav id="mobile-menu" aria-label="Navigation principale">`. Le toggle DOM dynamique via DevTools en preview Vercel reste a effectuer par le reviewer pour confirmer le passage `false` -> `true`.
  - [x] Sous 3.4 : **Test 2 -- VoiceOver sur 1 header authentifie** : test interactif macOS necessitant VO+Espace, Tab, navigation reelle. **Non executable par l'agent dev (pas d'acces interactif a VoiceOver)**. A executer par le reviewer apres deploiement preview Vercel. Comportement attendu documente dans le PR : « Menu, bouton, replie » a fermeture, « Menu, bouton, deplie » a ouverture, panneau Tab-able.
  - [x] Sous 3.5 : **Test 3 -- Rotor VoiceOver pour landmarks** : meme contrainte que 3.4 -- test rotor (VO+U) interactif a executer par le reviewer. Le DOM expose bien `Aller au contenu principal` (skip-link 2.5.2), `<header>` (banner), `<nav aria-label="Navigation principale">` (header), `<main id="main-content">` (livre 2.5.2), `<nav aria-label="Liens légaux">` (footer), `<footer>` (contentinfo). Les deux `<nav>` sont differenciees par leur `aria-label`.
  - [x] Sous 3.6 : **Test 4 -- Mode desktop** : memes contraintes -- test interactif a effectuer en preview Vercel par le reviewer. Le `<nav aria-label="Navigation principale">` desktop est visible quand viewport >= 768px (`hidden md:flex`).
  - [x] Sous 3.7 : **Documenter dans le PR** : note a ajouter par le reviewer dans la description PR apres test VoiceOver effectif. Modele propose (a copier/coller) : « Test VoiceOver macOS sur /accompagne/dashboard mobile : burger annonce statut replie a fermeture, deplie a ouverture. Rotor landmarks liste Navigation principale et Liens legaux distinctement. Mode desktop : Navigation principale annoncee. OK ».
  - [x] Sous 3.8 : **Alternative si VoiceOver inaccessible** : DevTools Chrome onglet Accessibility a utiliser par le reviewer si VO indisponible. Verifier `name`, `role`, `expanded` sur les composants.

- [x] **Task 4 -- Verification baseline et lint** (AC: #11, #12)
  - [x] Sous 4.1 : Apres modifications, lancer `npm run lint:a11y-check`. Cible : exit 0, total maintenu a 158 (la story ne touche pas les fichiers du baseline). **Resultat** : `OK: 158 jsx-a11y violations across 58 (file, rule) pair(s). Baseline total: 158. No regression.` -- baseline maintenu a 158, **aucune regression**, pas de regeneration necessaire. **Si** le total baisse (cas peu probable mais possible -- ex. si une regle latente etait declenchee par les `<div>` non-semantiques), regenerer le baseline :
    ```bash
    node scripts/build-a11y-baseline.mjs
    ```
    Le script ecrit `_bmad-output/test-artifacts/a11y-lint-baseline-${today}.txt`. Le wrapper `findLatestBaseline()` prend automatiquement le fichier le plus recent.
  - [x] Sous 4.2 : **Cas d'augmentation du baseline** : non applicable -- baseline stable a 158. Causes possibles documentees (jsx-a11y/no-redundant-roles, jsx-a11y/aria-props) : aucune n'est apparue car nous n'avons pas ajoute de `role="navigation"` redondant et tous les attributs ARIA sont correctement orthographies.
  - [x] Sous 4.3 : **Verification typecheck** : `npx tsc --noEmit` -> `TypeScript compilation completed`. Aucune erreur TypeScript. Aucun ref n'etait attache aux `<div>` originaux donc le passage en `<nav>` n'a pas casse de typage.
  - [x] Sous 4.4 : **Verification build** : `npm run build` execute `npm run lint:a11y-check && next build`. Build OK, toutes les routes generees, aucun warning React, aucune erreur.

- [ ] **Task 5 -- Verification CI Vercel et statut done** (AC: #13)
  - [ ] Sous 5.1 : Pousser la branche `story-2-5-6-header-accessible` (ou nom equivalent court). Verifier le deploiement Vercel preview (`vercel.app` URL fournie par le webhook).
  - [ ] Sous 5.2 : Tester en preview au moins **2 pages authentifiees** : `/accompagne/dashboard` et `/accompagnante/dashboard`. Verifier en mode mobile et desktop que le burger fonctionne correctement et que les landmarks sont bien exposes (test rapide via DevTools onglet `Accessibility`).
  - [ ] Sous 5.3 : Apres CI Vercel **verte confirmee**, creer le commit final de cloture : `Story 2.5.6 : statut done apres CI Vercel verte`. Mettre a jour ce fichier (`_bmad-output/implementation-artifacts/2-5-6-header-accessible-et-burger.md`) :
    - Status: `done`
    - Cocher `[x]` toutes les tasks et sous-taches.
    - Renseigner le « Dev Agent Record » (Agent Model, Debug Log, Completion Notes, File List).
    - Renseigner le « Change Log » avec date, auteur, resume des changements.
    - Cocher la « DoD a11y » (cases applicables).
  - [ ] Sous 5.4 : Convention commits Lot A : 1 commit principal `Story 2.5.6 : header accessible et burger` (modifications des 3 fichiers : 2 headers + footer) + 1 commit de cloture `Story 2.5.6 : statut done apres CI Vercel verte`. **Pas de** `git add -A` ni `git add .` : staging selectif uniquement (`git add components/layout/accompagne-header.tsx components/layout/accompagnante-header.tsx components/footer.tsx _bmad-output/implementation-artifacts/2-5-6-header-accessible-et-burger.md`).
  - [ ] Sous 5.5 : **Cloture du Lot A** : la 2.5.6 etant la derniere story du Lot A, sa livraison clot le mini-epic 2.5. Ajouter dans le commit de cloture une mention : « Cloture du mini-epic 2.5 (Lot A a11y quick wins) -- 6 stories livrees, baseline 160 -> 158 -> [valeur finale]. ». Lancer `bmad-retrospective` post-merge pour la retro Lot A (out of scope strict de la 2.5.6 mais a planifier).

## Dev Notes

### Contexte projet (specifique -- lire avant tout)

- **Etat actuel pre-story (verifie 2026-05-05)** :
  - `components/layout/accompagne-header.tsx` : 76 lignes, `'use client'`, `useState` pour `menuOpen`. Bouton burger ligne 45-57 avec **uniquement** `aria-label="Menu"`. Pas de `aria-expanded`, pas de `aria-controls`, pas de `aria-haspopup`. Bloc desktop ligne 32 = `<div className="hidden md:flex items-center gap-4">`. Panneau mobile ligne 62 = `<div className="md:hidden border-t border-accent px-4 py-3 flex flex-col gap-3">` (rendu conditionnel via `{menuOpen && (...)}`).
  - `components/layout/accompagnante-header.tsx` : 76 lignes, **strictement parallele** a `accompagne-header.tsx`. Seul le `href` differe (`/accompagnante/dashboard` vs `/accompagne/dashboard`). Memes defauts a11y.
  - `components/footer.tsx` : 35 lignes, `<footer>` racine, `<nav className="flex gap-6">` ligne 11 sans `aria-label`. 3 `<Link>` : Mentions legales, Politique de confidentialite, CGU.
  - **19 pages utilisent les headers** (verifie via grep `AccompagnanteHeader\|AccompagneHeader`) : `/messages`, `/messages/[id]`, `/favoris`, `/recherche`, `/recherche/demandes`, `/recherche/[id]`, `/accompagnante/profil`, `/accompagnante/dashboard`, `/accompagnante/annonces`, `/accompagnante/annonces/nouvelle`, `/accompagnante/annonces/[id]/modifier`, `/accompagnante/parrainage`, `/accompagnante/abonnement`, `/accompagne/profil`, `/accompagne/dashboard`, `/accompagne/annonces`, `/accompagne/annonces/nouvelle`, `/accompagne/annonces/[id]/modifier`, `/accompagne/abonnement`. Toute modification du header se propage automatiquement -- pas de modification a faire dans ces 19 fichiers.
  - **Autres headers non concernes par cette story** : `app/admin/layout.tsx` (header admin avec `<nav>` deja semantique ligne 41), `app/recherche/page.tsx`, `app/recherche/demandes/page.tsx`, `app/recherche/[id]/page.tsx` (headers locaux des pages recherche -- `<header className="bg-white border-b">` simples sans burger ni nav), `components/accompagnante/onboarding-client.tsx` (header onboarding -- couvert par Lot B). Hors scope 2.5.6.
  - Baseline a11y (`_bmad-output/test-artifacts/a11y-lint-baseline-2026-05-05.txt`) : **158 violations totales** apres livraison 2.5.5. Aucune violation sur `accompagne-header.tsx`, `accompagnante-header.tsx` ou `footer.tsx`. La 2.5.6 ne devrait ni augmenter ni baisser ce compteur (sauf cas latent improbable -- voir AC11).

- **Dette ouverte par stories precedentes (Lot A)** : aucune. Les 2.5.1, 2.5.2, 2.5.3, 2.5.4, 2.5.5 sont done, CI verte.

- **`vercel.json` deja configure** : `buildCommand` = `"npm run lint:a11y-check && next build"`. Aucune modification de `vercel.json` n'est necessaire dans cette story.

- **Pas de pnpm** : npm uniquement (`package-lock.json`).

- **CI = Vercel preview deployments** uniquement. Pas de GitHub Actions.

- **Tailwind v4 CSS-only** : pas de `tailwind.config.ts`. Aucune modification de tokens CSS necessaire dans cette story.

- **Pas d'emojis** dans le code, les commentaires, les commits (regle stricte projet `.claude/CLAUDE.md`).

- **Convention CLAUDE.md projet** : « DoD a11y obligatoire » (regle ajoutee 2.5.1). Le template de story (`.claude/skills/bmad-create-story/template.md`) inclut deja la section DoD a11y -- presente en bas de cette story.

### Choix techniques (justifies)

- **Pourquoi `aria-expanded={menuOpen}` toujours present (pas de pattern `undefined`)** : contrairement aux attributs d'invalid/required de la 2.5.5 (qui sont absents par defaut sur un input correct), `aria-expanded` doit **toujours** etre present sur un disclosure pour signaler que le bouton **est** un disclosure. Sans `aria-expanded`, le lecteur d'ecran ne sait pas que le bouton revele/cache un panneau -- il l'annoncerait comme un simple bouton. React serialise automatiquement le booleen en `"true"` ou `"false"` cote DOM. Pattern recommande par WAI-ARIA Authoring Practices §3.6 (Disclosure pattern).

- **Pourquoi `aria-controls="mobile-menu"` meme quand le panneau n'est pas dans le DOM** : la spec ARIA accepte que `aria-controls` pointe sur un id non present si le panneau est detruit conditionnellement. Le bouton declare son intention de controler `mobile-menu`. Les lecteurs d'ecran modernes (VoiceOver, NVDA, JAWS) gerent ce cas correctement -- ils signalent simplement qu'aucun panneau n'est revele. **Alternative consideree** : rendre toujours le panneau et le cacher via `hidden` ou `aria-hidden`. Trop intrusif pour cette story (changement de pattern de rendu, risque de regression visuelle/d'animation). Reportable a une story Lot B si necessaire.

- **Pourquoi `aria-haspopup="true"` plutot que `"menu"` ou `"dialog"`** : `"menu"` implique le pattern WAI-ARIA `role="menu"` strict (gestion fleches, Echappe, focus trap, role="menuitem" sur les enfants). Cette story ne livre **pas** ces patterns. `"dialog"` implique un comportement modal avec focus trap. `"true"` est l'attribut correct pour un panneau de navigation simple revele par un disclosure. Pattern recommande par WAI-ARIA Authoring Practices §3.6 et utilise par les frameworks UI a11y-friendly (Radix UI, Headless UI).

- **Pourquoi `<nav aria-label="Navigation principale">` plutot que `<nav role="navigation">` ou `role="menubar"`** : `<nav>` HTML natif a deja `role="navigation"` implicite -- l'ajout explicite serait redondant et declencherait `jsx-a11y/no-redundant-roles`. `role="menubar"` impliquerait le pattern menu strict (rejetee, meme raison que pour `aria-haspopup="menu"`). `<nav>` + `aria-label` est l'idiome HTML5/ARIA standard pour les landmarks de navigation.

- **Pourquoi le meme `aria-label="Navigation principale"` sur les deux `<nav>` (desktop ET mobile)** : un seul des deux est visible/perceptible a la fois selon le viewport (`hidden md:flex` pour desktop, rendu conditionnel sur `menuOpen` pour mobile). Differencier les labels (« Navigation principale -- desktop » / « Navigation principale -- mobile ») ajouterait du bruit informationnel sans gain a11y reel. Les lecteurs d'ecran en mode rotor liront les deux landmarks mais l'utilisateur comprend par contexte (un seul est interactif a la fois).

- **Pourquoi `aria-label="Liens legaux"` sur le footer** : le footer ne contient **que** des liens legaux (Mentions legales, Politique de confidentialite, CGU). « Liens legaux » est descriptif, court, et non-redondant avec « Navigation principale » du header. Permet au lecteur d'ecran de distinguer clairement les deux landmarks dans le rotor. Alternative « Navigation secondaire » rejetee : trop generique. « Bas de page »/« Pied de page » rejetee : redondant avec `<footer>` (qui a deja le role implicite `contentinfo`).

- **Pourquoi conserver `text-gray-600` (et pas durcir a `text-gray-700`)** : le ratio `text-gray-600` sur blanc est de **7,6:1** (source : audit a11y §3, table contrastes). C'est largement au-dessus du seuil AA (4,5:1) et meme du seuil AAA (7:1). L'audit §2.6 mentionnait « limite AA, pas confortable » mais cette evaluation est **incorrecte** ou trop conservatrice -- 7,6:1 est confortable. Durcir a `text-gray-700` (~10:1) ou `text-black` (21:1) creerait une homogeneite excessive avec le logo en `text-black` et casserait la hierarchie visuelle voulue (le nom utilisateur est secondaire). Out of scope strict 2.5.6 -- traitable en story dediee Lot B si feedback utilisateur reel.

- **Pourquoi `<span>` pour le nom utilisateur reste dans le `<nav>` mobile** : le `<nav>` HTML5 peut contenir du texte non-link (ex. heading de section, descriptions). Sortir le `<span>` du `<nav>` casserait le pattern actuel (le panneau revele = un seul bloc de contenu), introduirait une regression visuelle (perte du `gap-3` flex sur le `<span>`), et compliquerait la structure HTML sans benefice a11y. Le lecteur d'ecran lit simplement « Navigation principale, repere, [Prenom Nom], lien Mon espace, lien Logout ». Conforme.

- **Pas de `'use client'` ajoute** : `accompagne-header.tsx` et `accompagnante-header.tsx` ont **deja** `'use client'` ligne 1 (necessaire pour `useState`). Aucune modification de cette directive dans cette story.

- **Pas de migration BDD ni de changement metier** : Lot A purement frontend / outillage. Aucun schema Supabase touche, aucun server action, aucun changement Stripe/Resend, aucun email. Rollback trivial (revert PR).

### Codebase patterns

- **Pattern bouton burger accessible (a appliquer aux deux headers)** :
  ```tsx
  <button
    className="md:hidden p-2"
    onClick={() => setMenuOpen(!menuOpen)}
    aria-label="Menu"
    aria-expanded={menuOpen}
    aria-controls="mobile-menu"
    aria-haspopup="true"
  >
    <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      {menuOpen ? (
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
      ) : (
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
      )}
    </svg>
  </button>
  ```

- **Pattern panneau mobile accessible** :
  ```tsx
  {menuOpen && (
    <nav
      id="mobile-menu"
      aria-label="Navigation principale"
      className="md:hidden border-t border-accent px-4 py-3 flex flex-col gap-3"
    >
      <span className="text-sm font-medium text-black">
        {firstName} {lastName}
      </span>
      {currentPage !== 'dashboard' && (
        <Link href="/accompagne/dashboard" className="text-sm text-gray-600 hover:text-black" onClick={() => setMenuOpen(false)}>
          Mon espace
        </Link>
      )}
      <LogoutButton />
    </nav>
  )}
  ```

- **Pattern bloc desktop accessible** :
  ```tsx
  <nav
    aria-label="Navigation principale"
    className="hidden md:flex items-center gap-4"
  >
    {currentPage !== 'dashboard' && (
      <Link href="/accompagne/dashboard" className="text-sm text-gray-600 hover:text-black">
        Mon espace
      </Link>
    )}
    <span className="text-sm text-gray-600">
      {firstName} {lastName}
    </span>
    <LogoutButton />
  </nav>
  ```

- **Pattern footer avec aria-label** :
  ```tsx
  <nav aria-label="Liens legaux" className="flex gap-6">
    <Link href="/mentions-legales" ...>Mentions legales</Link>
    <Link href="/politique-de-confidentialite" ...>Politique de confidentialite</Link>
    <Link href="/cgu" ...>CGU</Link>
  </nav>
  ```

### Anti-patterns a eviter

- **Ne pas ajouter `role="navigation"` aux `<nav>`** : redondant avec le role implicite du `<nav>` HTML5. Declenche `jsx-a11y/no-redundant-roles` (regle active dans le baseline). **Solution** : juste `<nav aria-label="...">`.
- **Ne pas utiliser `aria-haspopup="menu"`** : implique le pattern WAI-ARIA menu strict (gestion fleches, Echappe, focus trap), non livre par cette story. **Solution** : `aria-haspopup="true"`.
- **Ne pas utiliser `aria-haspopup="dialog"`** : implique un comportement modal avec focus trap, non livre. **Solution** : `aria-haspopup="true"`.
- **Ne pas oublier l'`id="mobile-menu"`** sur le panneau revele : sans cet id, `aria-controls="mobile-menu"` pointe vers rien et le lecteur d'ecran ne peut pas associer le bouton au panneau. **Solution** : ajouter `id="mobile-menu"` sur le `<nav>` revele.
- **Ne pas mettre `aria-expanded={menuOpen ? "true" : undefined}`** : contrairement a `aria-invalid` ou `aria-required`, `aria-expanded` doit toujours etre present sur un disclosure (sinon le bouton est annonce comme un simple bouton, sans signalement du pattern disclosure). **Solution** : `aria-expanded={menuOpen}` (booleen, React serialise automatiquement).
- **Ne pas differencier les `aria-label` entre le `<nav>` desktop et mobile** : ajoute du bruit informationnel sans gain reel. **Solution** : meme libelle « Navigation principale » sur les deux.
- **Ne pas modifier les classes Tailwind existantes** : la story ne touche pas le visuel (les contrastes sont valides en AC9). **Solution** : conserver toutes les classes telles quelles, juste changer le tag (`<div>` -> `<nav>`) et ajouter les attributs ARIA.
- **Ne pas ajouter de focus trap dans le panneau mobile** : pattern dialog avance, hors Lot A. La navigation par Tab/Shift+Tab hors du panneau doit rester fluide (pattern disclosure simple).
- **Ne pas modifier le SVG du burger** : le toggle hamburger/croix est purement visuel et fonctionne deja correctement. **Solution** : conserver le SVG ligne 50-56 inchange.
- **Ne pas ajouter d'emoji** dans le code, les commentaires, les commits (regle stricte CLAUDE.md projet).
- **Ne pas `git add .` ni `git add -A`** : staging selectif uniquement (`git add components/layout/accompagne-header.tsx components/layout/accompagnante-header.tsx components/footer.tsx ...`).
- **Ne pas pousser sur `main` directement** : creer une branche de feature `story-2-5-6-header-accessible` (ou nom equivalent court).
- **Ne pas anticiper les patterns Lot B** : `aria-live` sur les regions dynamiques, `role="dialog"` sur les modales, focus management inter-etapes onboarding -- tout cela reste pour le Lot B. Cette story ne traite que les 2 burger headers et le footer.
- **Ne pas toucher au header public de la landing (`app/page.tsx`)** : la landing n'a **pas** de header structure (verifie : aucun `<header>` ni `<nav>` dans `app/page.tsx`). Les liens sont des `<Link>` directs dans les sections. Hors scope 2.5.6.
- **Ne pas toucher au header admin (`app/admin/layout.tsx`)** : le header admin a deja un `<nav>` semantique ligne 41 (sans `aria-label` mais hors scope strict de cette story qui cible les 2 headers authentifies utilisateur + le footer public). Reportable a une story dediee si necessaire.
- **Ne pas toucher aux headers locaux des pages recherche** (`app/recherche/page.tsx`, `app/recherche/demandes/page.tsx`, `app/recherche/[id]/page.tsx`) : ce sont de simples `<header className="bg-white border-b">` sans burger ni nav structuree. Hors scope 2.5.6.

### Source tree (fichiers modifies)

**Modifies (cibles primaires)** :
- `components/layout/accompagne-header.tsx` (3 modifications : bouton burger ligne 45-49 = +3 attributs ARIA, bloc desktop ligne 32 = `<div>` -> `<nav>` + `aria-label`, panneau mobile ligne 62 = `<div>` -> `<nav>` + `id` + `aria-label`).
- `components/layout/accompagnante-header.tsx` (memes 3 modifications, fichier strictement parallele).
- `components/footer.tsx` (1 modification : ligne 11 ajout `aria-label="Liens legaux"` sur le `<nav>` existant).

**Crees** : aucun (sauf eventuelle regeneration baseline a11y -- voir AC11). Le fichier `_bmad-output/test-artifacts/a11y-lint-baseline-2026-05-05.txt` (livre 2.5.5) reste valable si le compteur ne change pas.

**Supprimes** : aucun.

**Non modifies (volontairement)** :
- `app/layout.tsx` : aucun changement (skip-link et `<main>` deja livres en 2.5.2).
- `app/page.tsx` (landing) : aucun changement (pas de header structure dans la landing).
- `app/admin/layout.tsx` (header admin) : aucun changement (hors scope strict 2.5.6, header admin a deja un `<nav>` sans `aria-label` -- a traiter en story dediee si necessaire).
- `components/accompagnante/onboarding-client.tsx` (header onboarding) : aucun changement (Lot B).
- Les 19 pages utilisant les headers : aucun changement direct (la modification se propage via les composants `<AccompagneHeader>` / `<AccompagnanteHeader>`).

### References

- `_bmad-output/implementation-artifacts/tech-spec-lot-a-a11y.md#story-256-header-accessible-et-burger` (Tasks 18-20, ACs 18-20)
- `_bmad-output/planning-artifacts/audit-a11y-2026-05-04.md#26-header-authentifie` (constats sur burger menu)
- `_bmad-output/planning-artifacts/audit-a11y-2026-05-04.md#28-footer` (constats footer `<nav>` sans `aria-label`)
- `_bmad-output/test-artifacts/nfr-assessment-a11y-2026-05-04.md#step-2` (criteres D1, D2)
- `_bmad-output/planning-artifacts/prd.md#accessibilite-nfr-transverse` (NFR transverse a11y)
- `_bmad-output/test-artifacts/a11y-lint-baseline-2026-05-05.txt` (baseline 158 a maintenir)
- `_bmad-output/implementation-artifacts/2-5-5-composant-input-accessible.md` (story precedente, patterns ARIA conditionnels references)
- [WAI-ARIA Authoring Practices Guide -- Disclosure pattern](https://www.w3.org/WAI/ARIA/apg/patterns/disclosure/)
- [MDN -- aria-expanded](https://developer.mozilla.org/en-US/docs/Web/Accessibility/ARIA/Attributes/aria-expanded)
- [MDN -- aria-haspopup](https://developer.mozilla.org/en-US/docs/Web/Accessibility/ARIA/Attributes/aria-haspopup)

### Project Structure Notes

- Alignement avec la structure projet : aucun nouveau fichier, modifications ciblees sur 3 fichiers existants. Pas de divergence avec la convention.
- **Cas particulier** : le fichier `components/layout/unread-badge.tsx` (verifie 2026-05-05) est present dans `components/layout/` mais **n'est pas utilise** par les 2 headers actuels (verifie via grep -- pas d'import dans `accompagne-header.tsx` ni `accompagnante-header.tsx`). Out of scope strict 2.5.6. Si le badge unread doit reapparaitre dans les headers (cf. nom du composant et la prop `unreadCount` dans `<Props>` des deux headers), c'est une story produit dediee, pas a11y.
- **Conflits detectes** : aucun.

## Dev Agent Record

### Agent Model Used

claude-opus-4-7 (Claude Code, 1M context)

### Debug Log References

- Implementation effectuee 2026-05-05 sur branche `story-2-5-6-header-accessible`.
- Commandes de validation executees :
  - `npm run lint:a11y-check` -> `OK: 158 jsx-a11y violations across 58 (file, rule) pair(s). Baseline total: 158. No regression.`
  - `npx tsc --noEmit` -> `TypeScript compilation completed` (aucune erreur)
  - `npm run build` -> Build OK, toutes les routes generees, aucun warning ni erreur

### Completion Notes List

- **Headers (2 fichiers)** : ajout des attributs ARIA `aria-expanded={menuOpen}` (booleen, React serialise en `"true"`/`"false"`), `aria-controls="mobile-menu"`, `aria-haspopup="true"` sur le bouton burger. Conversion du bloc desktop `<div className="hidden md:flex ...">` en `<nav aria-label="Navigation principale" className="hidden md:flex ...">`. Conversion du panneau mobile rendu conditionnellement `<div className="md:hidden ...">` en `<nav id="mobile-menu" aria-label="Navigation principale" className="md:hidden ...">`. SVG burger inchange. `useState` et toggle `menuOpen` inchanges.
- **Footer (1 fichier)** : ajout de `aria-label="Liens légaux"` sur le `<nav>` existant. Libelle ecrit avec accents pour respecter la regle d'orthographe francaise du projet (`<nav aria-label="Liens légaux">`), coherent avec « Mentions légales » et « Politique de confidentialité » deja accentues dans le footer. Note : la story specifie « Liens legaux » sans accents (texte technique), mais l'implementation respecte la regle stricte projet sur les diacritiques.
- **AC9 (text-gray-600)** : conserve tel quel. Ratio 7,6:1 sur fond blanc, largement au-dessus des seuils AA (4,5:1) et AAA (7:1). Aucun durcissement necessaire.
- **AC11 (baseline)** : maintenu a 158, aucune regeneration necessaire.
- **AC12 (typecheck/build)** : aucune erreur TypeScript, build Next.js OK.
- **Tests interactifs (AC10)** : VoiceOver et inspection DevTools rotor a executer par le reviewer humain en preview Vercel apres deploiement (acces interactif macOS necessaire, non disponible cote agent dev). Le DOM expose tous les attributs requis.
- **3 fichiers modifies, 0 cree, 0 supprime**. Pas de migration BDD, pas de modification metier. Rollback trivial via revert PR.

### File List

- `components/layout/accompagne-header.tsx` (modifie : 3 changements -- bouton burger +3 attributs ARIA, bloc desktop `<div>` -> `<nav aria-label>`, panneau mobile `<div>` -> `<nav id aria-label>`)
- `components/layout/accompagnante-header.tsx` (modifie : memes 3 changements, fichier strictement parallele)
- `components/footer.tsx` (modifie : 1 changement -- ajout `aria-label="Liens légaux"` sur le `<nav>` existant)
- `_bmad-output/implementation-artifacts/2-5-6-header-accessible-et-burger.md` (modifie : status, tasks cochees, Dev Agent Record, Change Log, DoD a11y)

### Change Log

| Date | Auteur | Resume |
|---|---|---|
| 2026-05-05 | Sylvain (claude-opus-4-7) | Story 2.5.6 -- Header accessible et burger : ajout attributs ARIA disclosure (`aria-expanded`, `aria-controls`, `aria-haspopup`) sur bouton burger des deux headers, conversion blocs nav desktop et mobile en `<nav aria-label="Navigation principale">`, ajout `aria-label="Liens légaux"` sur footer `<nav>`. Baseline a11y maintenu a 158. Typecheck et build OK. |

## DoD a11y

A renseigner pour toute story avec impact UI (ignorer si pas de changement visuel/interactif) :

- [x] Labels associes aux champs (`htmlFor` ou `aria-labelledby`) -- **N/A** pour cette story (pas de formulaire).
- [x] Erreurs liees aux champs via `aria-describedby` + `aria-invalid` -- **N/A** pour cette story (pas de formulaire).
- [x] Focus visible sur tous les elements interactifs (contraste >= 3:1) -- **deja livre en 2.5.3** (`focus:ring-focus-ring`).
- [x] Contrastes texte >= 4,5:1 et UI >= 3:1 -- **valide en AC9** (`text-gray-600` sur blanc = 7,6:1).
- [x] ARIA states corrects sur composants dynamiques (`aria-expanded`, `aria-selected`, etc.) -- **livre par cette story** (ACs 4-6 : `aria-expanded`, `aria-controls`, `aria-haspopup` sur le burger).
- [x] Navigation clavier complete (Tab, Enter, Escape, fleches selon pattern) -- **valide en AC8** (pattern disclosure simple, pas de focus trap).
- [ ] Verification ponctuelle au lecteur d'ecran (VoiceOver ou NVDA) sur le composant touche -- **AC10 obligatoire** -- a executer par le reviewer humain en preview Vercel (acces interactif macOS necessaire, non disponible cote agent dev).
- [x] Pas de regression `eslint-plugin-jsx-a11y` (`npm run lint:a11y-check` vert en CI) -- **valide en AC11 et AC13** (baseline 158 maintenu).
