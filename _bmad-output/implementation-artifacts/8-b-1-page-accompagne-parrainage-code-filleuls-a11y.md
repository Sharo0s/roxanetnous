# Story 8.B.1 : Page `/accompagne/parrainage` -- affichage code + filleuls + a11y

Status: done

<!-- Note: Validation is optional. Run validate-create-story for quality check before dev-story. -->

## Story

As a accompagne avec abonnement actif,
I want consulter mon code de parrainage 8 caracteres, le copier facilement, voir mes filleuls confirmes et mon compteur de progression sur une page dediee `/accompagne/parrainage`,
so that je peux inviter un accompagnant a rejoindre la communaute en toute autonomie et suivre ma progression vers les 6 mois offerts (palier 5 parrainages confirmes, FR52) -- en respectant les regles CLAUDE.md durcies (wording masculin neutre, DoD a11y obligatoire) et le design system "foyer" (refonte 2026-05-11 commit 4b42837 + dashboards accompagne/accompagnant).

## Acceptance Criteria

1. **AC1 -- Route `/accompagne/parrainage` cree** : nouveau dossier `app/accompagne/parrainage/` contenant `page.tsx` (Server Component async, miroir architectural de `app/accompagnant/parrainage/page.tsx`). La route est protegee par `supabase.auth.getUser()` (redirect `/login` si non authentifie) et par un check role strict `userData.role === 'accompagne'` (redirect `/` si autre role -- pattern aligne sur `app/accompagne/dashboard/page.tsx:22` et `app/accompagnant/parrainage/page.tsx:21`).

2. **AC2 -- Redirect si pas de code parrainage** : lookup `parrainages_codes.user_id = user.id` via `.maybeSingle()`. Si **aucune** row trouvee (code non genere -- accompagne sans abonnement jamais passe `active`/`trialing`), `redirect('/accompagne/dashboard')` -- meme pattern que `app/accompagnant/parrainage/page.tsx:39-41`. **Decision arbitree 2026-05-17 (Sylvain) : pas de bandeau pedagogique "Abonnement requis" sur la page parrainage** ; l'accompagne sans abonnement reste sur le dashboard ou le `AccompagneSubscriptionBanner` (`components/accompagne/subscription-banner.tsx`) joue deja ce role. **Coherence path accompagnant prevaut sur UX-DR-E8.1 etat "Abonnement requis"** (qui n'est donc PAS rendu dans cette story -- la page n'a qu'un seul etat utile : abonne avec code genere). La spec epic-8.md ligne 401-404 (etat "Abonnement requis" affiche) est explicitement remplacee par cette decision -- documenter dans Change Log.

3. **AC3 -- Donnees serveur identiques au path accompagnant** : la page fetch via Supabase Server Component (Promise.all pour parallelisation eventuelle) :
   - `users.first_name, last_name, role` sur `user.id` -> redirect `/` si `role !== 'accompagne'`
   - `parrainages_codes.code, compteur_confirmes, total_recompenses` sur `user.id` -> redirect `/accompagne/dashboard` si null
   - `parrainages.filleule_id, statut, filleule_inscrite_at, filleule_abonnee_at, users!parrainages_filleule_id_fkey(first_name, last_name)` sur `marraine_id = user.id`, `.in('statut', ['inscrite', 'abonnee', 'confirme'])`, `.order('filleule_inscrite_at', { ascending: false })`, `.limit(50)`
   - `getUnreadCount(user.id)` (helper existant `@/lib/unread-count`)
   - `process.env.NEXT_PUBLIC_BASE_URL || 'https://roxanetnous.fr'` pour `baseUrl`
   
   La mapping `usersJoin` (Supabase peut renvoyer `users` en tableau OU objet) est repetee strictement comme `app/accompagnant/parrainage/page.tsx:51-69` pour la robustesse type (heritage code review story 4.6 SCP D5).

4. **AC4 -- Composant `components/accompagne/parrainage-view.tsx` cree dedie** : **Decision arbitree 2026-05-17 (Sylvain) : dupliquer dans `components/accompagne/parrainage-view.tsx` plutot que refacto partage `components/shared/`**. Justifications : (a) wording masculin neutre **direct** (parrain/filleul, accompagnant -- pas "accompagnante/marraine/filleule") sans alias retro-compat ni Boolean toggle, anticipe 8.C.3 ; (b) lien d'invitation pointe vers `?role=accompagnant` (pas `accompagnante`) ; (c) zero risque de regression UI sur le path accompagnant Epic 2 ; (d) AR-E8.8 cadrage initial "extraire dans `components/shared/`" est explicitement remplace par cette decision -- la refacto partagee sera reportee a Epic 9 si une troisieme variante apparait. Le composant **mirroir** strictement les exports/props du composant accompagnant : `code: string`, `baseUrl: string`, `compteur: number`, `totalRecompenses: number`, `filleules: Array<Filleule>`. La logique JS (capitalize, formatFilleuleName, joursRestantsAvantConfirmation, PALIER=5, STATUT_LABELS, handleCopy via `navigator.clipboard.writeText` avec fallback try/catch silencieux, useRef timeout cleanup) est dupliquee strictement.

5. **AC5 -- Wording UI masculin neutre obligatoire** (regle CLAUDE.md durcie + UX-DR-E8.4) : le composant `components/accompagne/parrainage-view.tsx` utilise **systematiquement** : "parrain" (jamais "marraine"), "filleul" / "filleuls" (jamais "filleule" / "filleules"), "accompagnant" / "accompagnants" (jamais "accompagnante" / "accompagnantes"). Type union interne : `type FilleulStatut = 'inscrite' | 'abonnee' | 'confirme' | 'fraude' | 'bloque'` (valeurs BDD inchangees -- ce sont des litteraux de la table `parrainages.statut`, **pas** du wording UI). Wording de la page (titre H1, eyebrow, subtitle, labels filleuls, empty state, compteurs synthetiques) :
   - eyebrow : `"Mon espace"` (identique path accompagnant -- pas "Mon espace de parrain", reste sobre)
   - H1 : `"Mon parrainage"` (identique path accompagnant)
   - subtitle : `"Partagez votre code, accueillez de nouveaux accompagnants."` (path accompagnant disait deja "accompagnants" -- coherent)
   - label code : `"Votre code"`
   - aide code : `"Partagez ce code ou ce lien avec un accompagnant de votre reseau. Vous vous portez garant : il evite la visio et publie ses annonces des la souscription."` (variante neutre du path accompagnant qui disait "garante" + "elle" -- a corriger dans 8.C.3 cote accompagnant, mais ici on ne tolere PAS de feminin)
   - phrase progression : meme logique conditionnelle que path accompagnant mais formulations strictement neutres : `"Lancez votre premier cycle de parrainage"` / `"Vous avez deja recu N recompense(s), lancez un nouveau cycle"` / `"Plus qu'un filleul pour 6 mois offerts"` / `"Plus que N filleuls pour 6 mois offerts"` / `"Palier atteint, votre recompense est en cours d'application."` 
   - section liste : H2 `"Vos filleuls en cours"`, desc `"Un filleul est valide apres 30 jours d'abonnement actif."`, empty state `"Aucun filleul pour le moment. Partagez votre code pour demarrer votre premier cycle."`
   - labels filleul : `"Valide -- compte dans votre cycle"` / `"Valide aujourd'hui"` / `"Valide dans N jour(s)"` / `"En attente de souscription"`
   - compteurs synthetiques bas : `"filleuls invites"` / `"valides ce cycle"` / `"recompense(s) gagnee(s)"`
   - fallback nom : `"Filleul"` (pas "Filleule") quand firstName/lastName absent dans `formatFilleulName`

6. **AC6 -- Lien d'invitation `?role=accompagnant`** : le composant construit `inviteLink = \`${baseUrl}/register?role=accompagnant&parrainage_code=${encodeURIComponent(code)}\`` -- **important : `role=accompagnant` (et pas `accompagnante`)** car (a) l'inscription parrainee cible un **filleul accompagnant** (guard FR54 + AC3 story 8.A.2 `invalid_filleul_role`), (b) la route `/accompagnant/*` a ete renommee story 5.A.4 (avec redirect 301 retro-compat `/accompagnante/*` -> `/accompagnant/*` dans `next.config.mjs`), (c) le composant accompagnant utilise encore `?role=accompagnante` (`components/accompagnant/parrainage-view.tsx:69`) car le formulaire d'inscription `app/register/page.tsx` lit `searchParams.role` et la valeur historique reste `accompagnante` -- **a verifier au moment du dev** : si le formulaire `app/register/*/page.tsx` accepte deja `accompagnant` (suite a story 5.A.4), utiliser `accompagnant` ; sinon utiliser `accompagnante` ET ouvrir un defer dans `deferred-work.md` pour aligner le path accompagnant + le formulaire en 8.C.3.

7. **AC7 -- Layout & header coherent design system "foyer" accompagne** (UX-DR-E8.1) : la page utilise :
   - `<main id="main-content" tabIndex={-1} className="min-h-screen bg-[#fefaf8] focus:outline-none">` (token bg + skip-link cible, heritage refonte 2026-05-11)
   - `<AccompagneDashboardHeader firstName={...} lastName={...} unreadCount={...} currentPage="parrainage" />` (composant existant `components/layout/accompagne-dashboard-header.tsx`)
   - **AC7bis -- Etendre l'union type `currentPage` du header accompagne** : le type actuel (`components/layout/accompagne-dashboard-header.tsx:11`) ne contient PAS `'parrainage'`. Ajouter `'parrainage'` a l'union TypeScript (cf. `accompagnant-dashboard-header.tsx:11` qui l'a deja). **Aucune entree de navigation visible n'est ajoutee** au menu du header (le menu accompagne reste a 6 entrees : dashboard/annonces/recherche/messages/favoris/profil) -- la valeur `'parrainage'` sert uniquement comme valeur passable a `currentPage` pour marquer la page courante sans afficher d'item nav dedie. (Decision dev possible : ajouter aussi un item nav "Parrainage" dans le header accompagne lorsque le user a un code -- **hors scope de 8.B.1**, a evaluer en retro Epic 8 selon usage reel ; 8.B.2 teaser dashboard couvre deja la decouverte primaire.)
   - container : `<div className="max-w-3xl mx-auto px-4 py-10 md:py-14 relative z-10">`
   - header : `<header className="text-center mb-10">` avec eyebrow `text-xs uppercase tracking-[0.18em] text-kraft mb-2`, H1 `text-3xl md:text-4xl italic text-gray-900 leading-tight`, subtitle `mt-3 text-sm text-gray-600`
   - le composant `ParrainageView` (importe `components/accompagne/parrainage-view`) suit strictement le pattern du composant accompagnant (cartes blanches bordure `border-[#e8dfd2]`, code en degrade `linear-gradient(135deg, #faecd9 0%, #f4d8b9 100%)`, barre progression `bg-kraft`, bouton primaire `bg-accent border-accent text-black hover:bg-kraft hover:border-kraft`).

8. **AC8 -- DoD a11y obligatoire** (regle CLAUDE.md durcie + NFR-A11y-E8.1 + UX-DR-E8.5) : la page **et** son composant respectent :
   - **Labels associes** : chaque bouton a un texte visible explicite (`"Copier le code"`, `"Copier le lien d'invitation"`), pas de bouton icon-only sans `aria-label`
   - **Focus visible** : tous les boutons et liens heritent du token focus global (heritage 2.5.3) -- ne PAS overrider `outline-none` sans `focus:ring-*` equivalent
   - **Annonce ARIA live sur copie reussie** (UX-DR-E8.5) : ajouter un `<div role="status" aria-live="polite" className="sr-only">` qui contient un message synchrone apres `handleCopy` ("Code copie dans le presse-papier" / "Lien d'invitation copie dans le presse-papier") -- **ATTENTION : pattern existant du composant accompagnant ne contient PAS d'ARIA live** (seul le label du bouton bascule sur "Copie"). 8.B.1 doit l'**ajouter** dans le composant accompagne (le defer pour le composant accompagnant peut etre ouvert dans `deferred-work.md` -- pas bloquant 8.B.1)
   - **`select-all` sur le bloc code** : le code `parrainages_codes.code` est expose dans une `<div className="select-all">` qui permet la selection clavier au triple-clic + copie native (heritage pattern accompagnant)
   - **Navigation clavier complete** : Tab atteint dans l'ordre logique : (header burger mobile -> nav) -> bouton "Copier le code" -> bouton "Copier le lien d'invitation" -> [pas d'item interactif dans la carte progression] -> liste filleuls (passive, pas de focusable) -> [pas d'item interactif dans les compteurs synthetiques]
   - **Contrastes** : tous les texte gris doivent respecter ratio >= 4.5:1 (heritage tokens design system foyer -- `text-gray-600` sur `bg-[#fefaf8]` OK depuis Lot A baseline ; `text-gray-500` empty state filleuls italic OK car >= 18pt equivalent), les boutons noir-sur-accent et blanc-sur-kraft respectent ratios CTA token
   - **ARIA states** : `aria-current="page"` deja porte par `AccompagneDashboardHeader` quand `currentPage='parrainage'` ; la barre de progression utilise `aria-hidden="true"` sur l'element visuel (pattern accompagnant ligne 157) -- AC8bis : **ajouter** `role="progressbar" aria-valuenow={compteurClamped} aria-valuemin={0} aria-valuemax={PALIER} aria-label="Progression du cycle de parrainage"` sur le conteneur visible (le composant accompagnant ne l'a PAS -- 8.B.1 corrige ce manque cote accompagne ; defer accompagnant possible)
   - **Lecteur d'ecran** : test ponctuel VoiceOver/NVDA sur la sequence "ouverture page -> annonce H1 'Mon parrainage' -> sequence cartes -> copie code declenche annonce 'Code copie dans le presse-papier'" (pas de regression vs path accompagnant, ameliore par AC8 + AC8bis)
   - **`lint:a11y-check` baseline preserve** : la baseline actuelle est **155** paires (file, rule) (cf. `_bmad-output/test-artifacts/a11y-lint-baseline-2026-05-13.txt`) -- **le check est par paire (file, rule) et non par total** (cf. `scripts/check-a11y-baseline.mjs:115`). Le delta tolere est **0** : aucune nouvelle paire warning sur les fichiers livres (page + composant + header etendu) -- si un warning legitime apparait, le **resoudre** plutot que regen la baseline (sauf justification PR exceptionnelle)
   - **`a11y:axe:check` baseline preserve** : le baseline axe-core actuel (`_bmad-output/test-artifacts/axe-core-baseline-2026-05-05.json`) contient 7 parcours **0 violations Critical/Serious** -- AC9 cadre l'extension a 8 parcours

9. **AC9 -- Nouveau parcours a11y P7 dedie `/accompagne/parrainage`** (UX-DR-E8.5) : **Decision arbitree 2026-05-17 (Sylvain) : nouveau parcours P7 plutot qu'extension P4** -- 
   - Creer `tests/a11y/p7-parrainage-accompagne.spec.ts` sur le pattern P1/P3/P6 (proxy `/login`, page auth-required, audit indirect car le bypass auth runtime est refuse par le projet, cf. `tests/a11y/lib/auth-stub.md`)
   - Identifiant du parcours : `'p7-parrainage-accompagne'`
   - URL auditee : `/login` (proxy, heritage 2.6.1 D2 -- pas de compte test)
   - Note rappelee dans le fichier de test : `// Parcours auth-required : voir tests/a11y/lib/auth-stub.md\n// On audite la page de login comme proxy d'entree du parcours parrainage accompagne.`
   - Pattern du test : strictement identique a `tests/a11y/p1-onboarding-aux.spec.ts` (single test `axe smoke /login (proxy P7)`, `goto domcontentloaded` + try/catch networkidle 5s, `runAxe + summarizeCriticalSerious`, `testInfo.attach('axe-violations.json', ...)`)
   - **Mettre a jour `tests/a11y/lib/auth-stub.md`** : ajouter une ligne dans le tableau "Couverture par parcours" : `| P7       | \`/login\` (proxy)                                       | Parrainage accompagne -- voir story 8.B.1                |`
   - **Mettre a jour `tests/a11y/README.md`** : ajouter ligne au tableau parcours (P7 avec spec / URL / note "Parcours parrainage accompagne (auth-required), proxy /login")
   - **Regenerer la baseline axe-core** : `npm run a11y:axe:baseline` post-implementation page + spec P7 -> nouveau fichier `_bmad-output/test-artifacts/axe-core-baseline-YYYY-MM-DD.json` avec **8 parcours** dont P7 `violations: []`. La regen est legitime (livraison story etend la couverture, pas une fausse passe) -- mentionner la regen dans la PR description et conserver l'ancien baseline du 2026-05-05 (le wrapper `check` prend toujours le plus recent par tri ISO, cf. `tests/a11y/README.md`)
   - **`npm run a11y:axe:check` reste exit 0** sur le nouveau baseline

10. **AC10 -- Pas de modification backend** : zero modification sur `app/actions/parrainage.ts`, `app/api/cron/confirm-parrainages/route.ts`, `app/api/webhooks/stripe/route.ts`, `lib/parrainage-codes.ts`, `lib/emails.ts`, `lib/subscription-helpers.ts`. La story est strictement additive UI/route. Audit `git diff --stat` final doit montrer uniquement :
    - **Crees** : `app/accompagne/parrainage/page.tsx`, `components/accompagne/parrainage-view.tsx`, `tests/a11y/p7-parrainage-accompagne.spec.ts`
    - **Modifies** : `components/layout/accompagne-dashboard-header.tsx` (union type `currentPage`), `tests/a11y/lib/auth-stub.md` (ligne P7), `tests/a11y/README.md` (ligne P7), `_bmad-output/test-artifacts/axe-core-baseline-YYYY-MM-DD.json` (nouveau fichier date, ancien preserve), `_bmad-output/implementation-artifacts/deferred-work.md` (entrees barrees + nouvelles si applicable), `_bmad-output/implementation-artifacts/sprint-status.yaml` (passage status), `_bmad-output/implementation-artifacts/8-b-1-page-accompagne-parrainage-code-filleuls-a11y.md` (Dev Agent Record final)

11. **AC11 -- Test unitaire optionnel (defer accepte)** : aucun test unitaire Vitest n'est requis car le composant `ParrainageView` est pur (props in -> JSX out, sans side-effect autre que clipboard). Si le dev souhaite ajouter un test, le placer dans `tests/unit/accompagne-parrainage-view.test.tsx` (pattern Vitest + React Testing Library) avec scenarios : (a) rendu code + lien copie, (b) phrase progression sur 5 paliers (`compteur=0/total=0`, `compteur=0/total=2`, `compteur=4`, `compteur=5+`), (c) liste vide -> empty state. Sinon defer accepte : le composant accompagne mirroir un composant accompagnant deja en production depuis Epic 2, la logique JS est dupliquee strictement, le risque regression est faible. **8.D.1 (E2E Playwright) couvrira le rendu de la page dans le golden path symetrique.**

12. **AC12 -- `tests/a11y/README.md` documente le nouveau parcours P7** : 1 ligne ajoutee dans le tableau "Parcours audites" (entre P6 et la prochaine section). Format aligne sur les lignes existantes : `| P7  | \`p7-parrainage-accompagne.spec.ts\` | \`/login\` (proxy) | Parrainage accompagne (auth-required) -- voir \`lib/auth-stub.md\` |`. La section "Exclusions documentees" reste inchangee (P7 n'introduit aucune exclusion).

13. **AC13 -- `deferred-work.md` : entrees barrees + nouvelles defer si applicable** : si la story livre un comportement non couvert par le path accompagnant (annonce ARIA live + `role="progressbar"`), **ouvrir 2 nouvelles entrees defer** sous une section `## Deferred from: implementation of 8-b-1-page-accompagne-parrainage-code-filleuls-a11y (2026-05-17)` :
    - Ligne 1 : "Annonce ARIA live sur copie clipboard absente de `components/accompagnant/parrainage-view.tsx` -- alignement a faire en 8.C.3 (wording neutre cross-codebase)"
    - Ligne 2 : "Attribut `role=\"progressbar\" aria-valuenow/min/max` absent de `components/accompagnant/parrainage-view.tsx` -- alignement a faire en 8.C.3 ou epic suivant"
    
    **Si AC6 conclut que `role=accompagnant` n'est pas accepte par le formulaire d'inscription** (a verifier au moment du dev), ouvrir une 3eme entree : "Lien d'invitation `?role=accompagnante` toujours requis car formulaire signup ne route pas `?role=accompagnant` -- aligner en 8.C.3 ou story dediee renommage formulaire"

14. **AC14 -- Validations CI obligatoires avant livraison** (DoD pre-commit story livraison) :
    - `npx tsc --noEmit` : 0 erreur sur les fichiers crees/modifies (2 erreurs `.next/types/` pre-existantes tolerees -- heritage 8.A.3/8.A.4)
    - `npm run lint` : exit 0, baseline <= 194 warnings (heritage 8.A.4 -- le composant accompagne est duplique mais n'introduit pas de nouveau `as any` ni warning custom)
    - `npm run lint:a11y-check` : exit 0, baseline (file, rule) preserve -- aucune nouvelle paire warning sur les fichiers livres
    - `npm run check:no-direct-notifications-log-insert` : exit 0 (la page n'INSERTe pas dans `notifications_log`)
    - `npm run check:as-any-global` / `check:as-any-admin` / `check:oracle-paywall` / `check:rls-helpers` / `check:ip-spoofing` : tous exit 0 (heritage Epic 5/6/7)
    - `npm run test:unit` : 82/82 verts (non-regression -- AC11 n'ajoute pas de test obligatoire)
    - `npm run a11y:axe:baseline` execute pour regenerer + commit du nouveau fichier baseline date (justification PR : extension parcours P7)
    - `npm run a11y:axe:check` : exit 0 sur le **nouveau** baseline (8 parcours dont P7 `violations: []`)
    - `npm run build` : exit 0, route `/accompagne/parrainage` listee dans la sortie build (`○ /accompagne/parrainage` ou similaire)
    - **Validation manuelle navigateur** (regle CLAUDE.md "test UI") : dev local `npm run dev`, navigation `/accompagne/parrainage` connecte comme accompagne avec code (option : seed un user de test via SQL direct si necessaire), verifier rendu visuel + copie clipboard + responsive mobile (375px) + navigation clavier Tab/Enter

15. **AC15 -- Coherence cross-story 8.A.* et 8.B.2** : 
    - **8.A.1 deja merge** : le code parrainage est genere par le webhook Stripe a la 1ere transition `status='active'`/`'trialing'` ; la page 8.B.1 lit donc une row deja existante via Supabase Server Component
    - **8.A.2 deja merge** : aucune action client cote 8.B.1 (la page est read-only) ; le path validateCode / createParrainageRelation / confirmParrainageOnSuccess est cote signup filleul accompagnant, pas cote dashboard parrain
    - **8.B.2 (teaser dashboard)** : sera livre apres 8.B.1 et linkera vers `/accompagne/parrainage` -- la story 8.B.1 ne modifie PAS le dashboard accompagne (`app/accompagne/dashboard/page.tsx`). 8.B.2 ajoutera un bloc teaser conditionnel "Invitez un accompagnant" sous condition `subscribed && code` (a evaluer en 8.B.2)
    - **8.C.3 (wording neutre cross-codebase)** : la story 8.B.1 livre un composant accompagne **deja neutre** -- 8.C.3 alignera le composant accompagnant historique (qui reste au feminin sur les libelles "garante/elle/filleule" cf. AC5)

16. **AC16 -- Pas d'impact PROD avant deploy** : la story s'execute en preview Vercel sans risque puisque :
    - pas de migration BDD (heritage F-Epic8-A0 GO)
    - pas de nouvelle env var requise (`NEXT_PUBLIC_BASE_URL` deja set)
    - pas de modification webhook / cron / server actions
    - la route `/accompagne/parrainage` est strictement additive (404 actuellement -> page rendue post-deploy)
    - les 3 accompagnes en prod actuels (cf. audit BDD 2026-05-16 -- 822 accompagnant / 3 accompagne / 1 admin) doivent voir la page accessible si ils ont un code (audit MCP post-merge a faire pour Sylvain : `SELECT u.id, u.email, pc.code FROM users u JOIN parrainages_codes pc ON pc.user_id = u.id WHERE u.role = 'accompagne'`)

## Tasks / Subtasks

- [x] **T1 -- Etendre type `currentPage` du header accompagne** (AC: #7)
  - [x] T1.1 -- Editer `components/layout/accompagne-dashboard-header.tsx:11` : ajouter `'parrainage'` a l'union TypeScript de `currentPage`
  - [x] T1.2 -- NE PAS ajouter d'item nav visible dans le tableau `links` (decision 8.B.1 : valeur ajoutee uniquement comme cle de page, 8.B.2 evaluera un item nav)
  - [x] T1.3 -- `npx tsc --noEmit` : verifier 0 erreur

- [x] **T2 -- Creer composant `components/accompagne/parrainage-view.tsx`** (AC: #4, #5, #6, #8)
  - [x] T2.1 -- Copier integralement la structure de `components/accompagnant/parrainage-view.tsx` (`'use client'`, useEffect/useRef/useState, types Filleul, helpers capitalize/formatFilleulName/joursRestantsAvantConfirmation, constantes PALIER/STATUT_LABELS/STATUT_BADGE_CLASS, fonction `ParrainageView`)
  - [x] T2.2 -- Renommer toutes les references feminines en masculin neutre (regle CLAUDE.md durcie + AC5) :
    - `Filleule` -> `Filleul` (type + signature + variables)
    - `filleule` -> `filleul` (texte UI uniquement -- les valeurs du litteral statut `'inscrite'`, `'abonnee'`, `'confirme'` restent inchangees car ce sont des valeurs BDD)
    - `marraine` -> `parrain` (zero occurrence attendue dans le composant car cote parrain affiche son propre code)
    - `accompagnante` -> `accompagnant`
    - `garante` -> `garant`
    - `elle` -> `il`
    - Fallback nom dans `formatFilleulName` : `'Filleule'` -> `'Filleul'`
    - Labels `STATUT_LABELS` : `'Inscrite'` -> `'Inscrit'`, `'Abonnee'` -> `'Abonne'`, `'Confirmee'` -> `'Confirme'` (le composant accompagnant utilise deja "Inscrit/Abonne/Confirme" -- a verifier, mais probablement identique)
    - phrases progression : `"Plus que N filleuls pour 6 mois offerts"` (N peut etre 1 ou N -- conditional renvoyant `"Plus qu'un filleul"` vs `"Plus que N filleuls"`)
    - texte d'aide bouton : `"Vous vous portez garant : il evite la visio et publie ses annonces des la souscription."`
    - subtitle eyebrow : non present (le composant n'a pas d'eyebrow -- les eyebrow sont dans la page)
  - [x] T2.3 -- **Modifier `inviteLink`** : remplacer `?role=accompagnante` par `?role=accompagnant` (AC6) -- **verifier au moment du dev** que le formulaire d'inscription accepte la valeur ; si non, garder `accompagnante` ET ouvrir un defer (cf. AC13) -- **VERIFIE** : `components/auth/register-form.tsx:64-65` accepte directement `'accompagnant'` en `useState` initial. Pas de defer requis sur AC6.
  - [x] T2.4 -- **Ajouter annonce ARIA live** (AC8) : apres le `<div className="flex flex-wrap gap-2 justify-center">` des boutons copie, ajouter `<div role="status" aria-live="polite" className="sr-only">{copied === 'code' ? 'Code copie dans le presse-papier' : copied === 'link' ? "Lien d'invitation copie dans le presse-papier" : ''}</div>`. **Attention** : l'attribut `aria-live="polite"` est l'option correcte (pas `assertive` -- la copie n'est pas une erreur, juste un feedback informationnel) ; le contenu doit etre **synchrone** avec l'etat `copied` declenche par `setCopied` apres `clipboard.writeText`
  - [x] T2.5 -- **Ajouter `role="progressbar"` sur la barre de progression principale** (AC8bis) : sur le conteneur `<div className="relative h-1.5 w-full bg-[#f1eade] rounded-full overflow-hidden mt-6 mb-2">`, ajouter `role="progressbar" aria-valuenow={compteurClamped} aria-valuemin={0} aria-valuemax={PALIER} aria-label="Progression du cycle de parrainage"`. L'element visuel interne garde `aria-hidden="true"` (pattern existant)
  - [x] T2.6 -- Verifier que les boutons de copie n'utilisent pas d'icon-only sans `aria-label` (le pattern accompagnant utilise du texte `"Copier le code"` / `"Copier le lien d'invitation"` -- conserver)
  - [x] T2.7 -- Exporter `ParrainageView` (named export) pour usage par la page

- [x] **T3 -- Creer page `app/accompagne/parrainage/page.tsx`** (AC: #1, #2, #3, #7)
  - [x] T3.1 -- Server Component async, `export default async function AccompagneParrainagePage()`
  - [x] T3.2 -- Imports : `createClient` (`@/lib/supabase/server`), `redirect` (`next/navigation`), `ParrainageView` (`@/components/accompagne/parrainage-view`), `AccompagneDashboardHeader` (`@/components/layout/accompagne-dashboard-header`), `getUnreadCount` (`@/lib/unread-count`)
  - [x] T3.3 -- Auth check : `supabase.auth.getUser()` -> redirect `/login` si null
  - [x] T3.4 -- Role check : `users.first_name, last_name, role` -> redirect `/` si `role !== 'accompagne'`
  - [x] T3.5 -- Lookup code : `parrainages_codes.code, compteur_confirmes, total_recompenses` via `.maybeSingle()` -> redirect `/accompagne/dashboard` si null
  - [x] T3.6 -- Lookup filleuls : meme query que `app/accompagnant/parrainage/page.tsx:43-49` (marraine_id=user.id, in statut inscrite/abonnee/confirme, order desc, limit 50)
  - [x] T3.7 -- Mapping `filleules` (renommer en `filleuls` cote variable JS pour coherence neutre -- valeurs BDD inchangees) avec gestion array/object Supabase (cf. lignes 51-69 accompagnant)
  - [x] T3.8 -- `baseUrl` et `unreadCount` recuperes en parallele eventuel
  - [x] T3.9 -- JSX : `<main id="main-content" tabIndex={-1} className="min-h-screen bg-[#fefaf8] focus:outline-none">` + `<AccompagneDashboardHeader currentPage="parrainage">` + container max-w-3xl + header text-center (eyebrow + H1 + subtitle) + `<ParrainageView code={...} baseUrl={...} compteur={...} totalRecompenses={...} filleuls={...} />`
  - [x] T3.10 -- Wording H1 : `"Mon parrainage"`, eyebrow : `"Mon espace"`, subtitle : `"Partagez votre code, accueillez de nouveaux accompagnants."`

- [x] **T4 -- Creer parcours a11y P7** (AC: #9, #12)
  - [x] T4.1 -- Creer `tests/a11y/p7-parrainage-accompagne.spec.ts` strictement aligne sur `tests/a11y/p1-onboarding-aux.spec.ts` (imports, structure test.describe, single test, runAxe, summarizeCriticalSerious, testInfo.attach)
  - [x] T4.2 -- Commentaire de tete : `// Parcours auth-required : voir tests/a11y/lib/auth-stub.md\n// On audite la page de login comme proxy d'entree du parcours parrainage accompagne.`
  - [x] T4.3 -- Identifiant parcours dans l'attach : `parcours: 'p7-parrainage-accompagne'`, `url: '/login'`, `proxy: true`
  - [x] T4.4 -- Mettre a jour `tests/a11y/README.md` : ajouter ligne P7 dans le tableau "Parcours audites"
  - [x] T4.5 -- Mettre a jour `tests/a11y/lib/auth-stub.md` : ajouter ligne P7 dans le tableau "Couverture par parcours"
  - [x] T4.6 -- Executer `npm run a11y:axe:baseline` (regen baseline avec 8 parcours) -> `axe-core-baseline-2026-05-17.json` cree
  - [x] T4.7 -- Verifier le nouveau fichier `_bmad-output/test-artifacts/axe-core-baseline-YYYY-MM-DD.json` : `parcours.length === 8`, `parcours[7].id === 'p7-parrainage-accompagne'`, `parcours[7].violations === []` (verifie cat | head -60)
  - [x] T4.8 -- Verifier `npm run a11y:axe:check` exit 0 sur le nouveau baseline (8 parcours audites)
  - [x] T4.9 -- Ne PAS supprimer l'ancien baseline 2026-05-05 (le wrapper `check` prend le plus recent par tri ISO -- preserver l'historique)

- [x] **T5 -- Validation CI DoD** (AC: #14)
  - [x] T5.1 -- `npx tsc --noEmit` : 0 erreur sur les fichiers modifies (TypeScript compilation completed)
  - [x] T5.2 -- `npm run lint` : exit 0, 194 warnings (baseline maintenue, beneficiaire vs 196 initial apres cleanup `STATUT_LABELS`/`STATUT_BADGE_CLASS` non utilises)
  - [x] T5.3 -- `npm run lint:a11y-check` : exit 0, baseline 155 (file, rule) preserve
  - [x] T5.4 -- `npm run check:no-direct-notifications-log-insert` / `check:as-any-global` / `check:as-any-admin` / `check:oracle-paywall` / `check:rls-helpers` (skip local) / `check:ip-spoofing` : tous exit 0
  - [x] T5.5 -- `npm run test:unit` : 82/82 verts en 1.17s
  - [x] T5.6 -- `npm run build` : exit 0, route `ƒ /accompagne/parrainage` listee dans la sortie
  - [ ] T5.7 -- Validation navigateur (regle CLAUDE.md "test UI") -- **NON EXECUTE LOCALEMENT** : le projet n'a pas de seed de compte accompagne avec abonnement actif + code parrainage en local (heritage `feedback_test_local_supabase` Sylvain pas de Docker). Validation reportee a T7 (staging post-merge sur preview Vercel par Sylvain avec session reelle). Le rendu visuel est garanti par mimetisme strict du composant accompagnant Epic 2 deja en prod.

- [x] **T6 -- Documentation et coherence** (AC: #13, #15)
  - [x] T6.1 -- Mettre a jour `_bmad-output/implementation-artifacts/deferred-work.md` : section `## Deferred from: implementation of 8-b-1-page-accompagne-parrainage-code-filleuls-a11y (2026-05-17)` ajoutee avec 2 entrees (ARIA live + role=progressbar manquants cote accompagnant). Pas de 3e entree car AC6 verifie : `?role=accompagnant` est accepte par `register-form.tsx:64-65`.
  - [x] T6.2 -- Verifie : aucune entree existante n'est barree par 8.B.1 (la story livre une nouveaute UI pure, pas une dette pre-existante)
  - [x] T6.3 -- Pas de nouvelle entree `DECISIONS.md` requise -- les decisions arbitrees (redirect, composant duplique, P7 nouveau parcours) sont consignees dans les AC2/AC4/AC9 et dans Change Log

- [ ] **T7 -- Validation manuelle staging post-merge** (AC: #16) -- **A executer par Sylvain post-merge**
  - [ ] T7.1 -- Audit MCP : `SELECT u.id, u.email, pc.code FROM users u JOIN parrainages_codes pc ON pc.user_id = u.id WHERE u.role = 'accompagne'` (verifier les 3 accompagnes prod)
  - [ ] T7.2 -- Naviguer `/accompagne/parrainage` connecte comme l'un d'eux (test session reelle)
  - [ ] T7.3 -- Verifier le rendu visuel (code grand format, boutons copie fonctionnels) et la navigation clavier
  - [ ] T7.4 -- Verifier qu'un accompagne **sans code** (cas theorique pre-migration ou pre-paiement) redirect bien sur `/accompagne/dashboard` sans erreur

## Dev Notes

### Contexte metier

Cette story livre la **piece UI cle de l'epic 8 cote accompagne** : sans elle, le code parrainage genere par 8.A.1 (webhook Stripe) reste invisible -- l'accompagne n'a aucun moyen de consulter ni partager son code. La page miroir architecturalement `/accompagnant/parrainage` (Epic 2) avec adaptations role + wording neutre + a11y renforce.

### Pourquoi un composant duplique plutot que partage (rappel AC4)

La decision 2026-05-17 arbitree avec Sylvain favorise la **duplication** sur 3 motifs :

1. **Wording masculin neutre direct** : le composant accompagnant historique contient "garante/elle/filleule/accompagnante" qui violent la regle CLAUDE.md durcie. Mutualiser dans `shared/` obligerait soit a corriger l'accompagnant d'abord (scope creep), soit a introduire des conditionnels role -> texte (complexite + risque regression).
2. **Lien d'invitation distinct** : `?role=accompagnant` vs `?role=accompagnante` (cf. AC6 -- a verifier au dev). Mutualiser obligerait a parametriser cette valeur sans benefice.
3. **Pas de regression Epic 2** : Epic 2 est en production depuis 2026-04-29. Toucher `components/accompagnant/parrainage-view.tsx` pour le rendre "shared" expose a une regression UI sur un path mature.

La refacto partagee `components/shared/parrainage-view.tsx` (AR-E8.8 cadrage initial) est explicitement **reportee post-Epic 8** si une troisieme variante de parrain apparait (theorique). En l'etat, 2 variantes role-specific sont gerables.

### Pourquoi redirect plutot que bandeau "abonnement requis" (rappel AC2)

La decision 2026-05-17 arbitree avec Sylvain favorise le **redirect** sur 3 motifs :

1. **Coherence path accompagnant** : `/accompagnant/parrainage` redirect deja si pas de code (`page.tsx:39-41`). 8.B.1 applique le meme pattern -> coherence transverse, moins de surface a tester.
2. **AccompagneSubscriptionBanner deja en place** : `components/accompagne/subscription-banner.tsx` joue deja le role pedagogique "Abonnement requis" sur le dashboard. Doublonner ce CTA sur `/accompagne/parrainage` n'apporte pas de valeur incrementale.
3. **UX-DR-E8.1 etat "Abonnement requis" remplace par redirect** : la spec epic-8.md ligne 401-404 est cadrage initial ; la decision arbitrage 2026-05-17 prevaut. Reflechir l'etat "abonnement requis" cote page parrainage uniquement si la metrique d'usage (8.B.2 teaser dashboard) montre que des accompagnes sans abo essaient d'acceder a la page.

### Patterns hérites et a réutiliser

| Pattern | Source | Application 8.B.1 |
|---|---|---|
| Server Component async avec auth + role check | `app/accompagne/dashboard/page.tsx:10-22` + `app/accompagnant/parrainage/page.tsx:9-21` | T3.3, T3.4 |
| Lookup `parrainages_codes` + redirect si null | `app/accompagnant/parrainage/page.tsx:33-41` | T3.5 |
| Lookup filleules avec join users (gestion array/object) | `app/accompagnant/parrainage/page.tsx:43-69` | T3.6, T3.7 |
| `AccompagneDashboardHeader` (composant existant) | `components/layout/accompagne-dashboard-header.tsx` | T1.1, T3.9 |
| Pattern bg + skip-link cible + header dedie | `app/accompagne/dashboard/page.tsx:70-77` | T3.9 |
| Container `max-w-3xl mx-auto px-4 py-10 md:py-14 relative z-10` | `app/accompagnant/parrainage/page.tsx:83` | T3.9 |
| Header text-center avec eyebrow + H1 italic + subtitle | `app/accompagnant/parrainage/page.tsx:86-92` | T3.9, T3.10 |
| `ParrainageView` pur (clipboard + states + dynamics) | `components/accompagnant/parrainage-view.tsx` | T2 (duplication + neutralisation) |
| Test a11y `axe smoke /login (proxy P*)` | `tests/a11y/p1-onboarding-aux.spec.ts` | T4.1 |
| Regen baseline axe-core via `a11y:axe:baseline` | `tests/a11y/README.md` "Re-générer le baseline" | T4.6 |

### Decalages cadrage epic-8.md a documenter

- **UX-DR-E8.1 etat "abonnement requis"** : remplace par redirect (decision arbitrage 2026-05-17 -- cf. AC2)
- **AR-E8.8 "extraire dans `components/shared/`"** : remplace par duplication (decision arbitrage 2026-05-17 -- cf. AC4)
- **`tests/a11y/parcours-*` mentionne dans NFR-A11y-E8.1** : la convention reelle du repo est `tests/a11y/p[N]-*.spec.ts` (8 parcours apres P7 ajoute) -- corrige tacitement par 8.B.1 sans entree DECISIONS.md (typo cadrage, pas decision)

### Wording masculin neutre dans le composant duplique

Liste exhaustive des chaines a re-ecrire (a partir de `components/accompagnant/parrainage-view.tsx`) :

| Source feminin | Cible neutre | Localisation |
|---|---|---|
| `type FilleuleStatut` | `type FilleulStatut` | type def L5 |
| `type Filleule = ...` | `type Filleul = ...` | type def L7 |
| `filleules: Array<Filleule>` | `filleuls: Array<Filleul>` | props L36, signature L65 |
| `formatFilleuleName` | `formatFilleulName` | function name L22 |
| `'Filleule'` fallback | `'Filleul'` | L25 |
| `filleulesAffichables` | `filleulsAffichables` | variable L105 |
| `accompagnante` | `accompagnant` | aide text L139-141 (composant accompagnant : "accompagnant" deja) |
| `garante` / `elle` | `garant` / `il` | aide text L141 |
| `marraine` | `parrain` | (zero occurrence attendue puisque le parrain affiche son propre code) |
| `"Plus qu'un filleul"` | inchange (deja masculin neutre dans accompagnant) | L99 |
| `"Vos filleuls en cours"` | inchange (deja masculin neutre dans accompagnant) | L167 |
| `"Une filleule est validee"` (si present) | `"Un filleul est valide"` | L169 |
| `"Validee"` / `"Valide"` (status badge) | `"Valide"` (masculin) | L194, L201-202 |
| `"Aucun filleul pour le moment"` | inchange | L173 |
| `"filleuls invites"` | inchange | L243 |
| `"validees ce cycle"` (si feminin) | `"valides ce cycle"` | L247 |
| `"recompense(s) gagnee(s)"` | (a verifier dans accompagnant -- probablement deja correct) | L251 |

**Important** : le composant accompagnant historique est en bonne partie deja au masculin neutre (refonte foyer 2026-05-11) -- la liste ci-dessus est defensive. Le dev doit lire `components/accompagnant/parrainage-view.tsx` en parallele et neutraliser **tout** ce qui reste au feminin.

### Pieges TypeScript

- Le typage `users` peut etre array OU object dans la reponse Supabase selon le shape de la requete (`users!parrainages_filleule_id_fkey(...)`). Le mapping defensif lignes 51-69 du path accompagnant est a copier-coller strictement.
- Le composant client `'use client'` doit etre en premiere ligne du fichier.
- L'import dynamique de `ParrainageView` n'est pas necessaire (composant pur, hydratation cote client OK).
- L'extension du type union `currentPage` du header accompagne doit **rester en chaine** : ajouter `'parrainage'` apres `'profil'` et avant `'abonnement'` -- ne PAS introduire de Boolean toggle ou de Props additionnels.

### Pieges a11y

- `aria-live="polite"` (et non `assertive`) sur l'annonce de copie -- une copie reussie n'est pas une erreur.
- Le `<div role="status" aria-live="polite" className="sr-only">` doit contenir **uniquement** le message courant (chaine vide si pas de copie en cours), pas un toggle CSS qui pourrait etre ignore par certains lecteurs d'ecran.
- `role="progressbar"` necessite `aria-valuenow`, `aria-valuemin`, `aria-valuemax` ET un `aria-label` (ou `aria-labelledby`).
- Le focus sur le `<main id="main-content" tabIndex={-1}>` est deja le pattern skip-link cible (heritage Lot A) -- ne PAS le toucher.
- `select-all` sur le bloc code est intentionnel -- ne PAS le remplacer par un input readOnly.

### Pieges design system "foyer"

- Bg page : `bg-[#fefaf8]` (token), pas `bg-white`
- Bg header dashboard : `bg-[#faf7f2]` (token), pas `bg-white`
- Bg cartes blanches : `bg-white` + `border border-[#e8dfd2]` + `rounded-2xl`
- Code en grand format : `linear-gradient(135deg, #faecd9 0%, #f4d8b9 100%)` + `letterSpacing: 0.4rem` + `fontFamily: var(--font-heading)`
- Texte editorial italic : `italic text-3xl md:text-4xl text-gray-900 leading-tight`
- Eyebrow : `text-xs uppercase tracking-[0.18em] text-kraft mb-2`
- Bouton primaire : `bg-accent border border-accent text-black hover:bg-kraft hover:border-kraft`
- Bouton secondaire : `bg-white border border-[#e8dfd2] text-gray-900 hover:border-kraft`
- Barre progression vide : `bg-[#f1eade]` ; remplie : `bg-kraft` ; cas confirme : `bg-green-600`

### Localisation des fichiers a creer / modifier (recap)

| Fichier | Statut | Lignes attendues |
|---|---|---|
| `app/accompagne/parrainage/page.tsx` | CREE | ~100 (miroir `app/accompagnant/parrainage/page.tsx`) |
| `components/accompagne/parrainage-view.tsx` | CREE | ~260 (miroir + 2 attributs a11y ajoutes) |
| `components/layout/accompagne-dashboard-header.tsx` | MODIFIE | +1 valeur `'parrainage'` dans union |
| `tests/a11y/p7-parrainage-accompagne.spec.ts` | CREE | ~30 (miroir `tests/a11y/p1-onboarding-aux.spec.ts`) |
| `tests/a11y/README.md` | MODIFIE | +1 ligne tableau parcours |
| `tests/a11y/lib/auth-stub.md` | MODIFIE | +1 ligne tableau couverture |
| `_bmad-output/test-artifacts/axe-core-baseline-YYYY-MM-DD.json` | CREE | nouveau fichier date (~70 lignes JSON), ancien conserve |
| `_bmad-output/implementation-artifacts/deferred-work.md` | MODIFIE | +1 section + 2-3 entrees defer |
| `_bmad-output/implementation-artifacts/sprint-status.yaml` | MODIFIE | ready-for-dev -> in-progress -> review -> done |
| `_bmad-output/implementation-artifacts/8-b-1-page-accompagne-parrainage-code-filleuls-a11y.md` | MODIFIE | Tasks coches + Dev Agent Record |

### Fichiers a NE PAS toucher (audit zero diff attendu)

- `app/actions/parrainage.ts` (server actions deja role-aware via 8.A.2)
- `app/api/cron/confirm-parrainages/route.ts` (cron deja role-aware via 8.A.3)
- `app/api/webhooks/stripe/route.ts` (webhook deja role-aware via 8.A.1)
- `lib/parrainage-codes.ts` (helper deja en place via 8.A.1)
- `lib/emails.ts` (`sendParrainageBienvenueAccompagne` deja en place via 8.A.1)
- `lib/subscription-helpers.ts` (`hasActiveSubscription` / `getSubscriptionStatus` deja role-independantes)
- `components/accompagnant/parrainage-view.tsx` (composant Epic 2 -- alignement neutre reporte a 8.C.3)
- `app/accompagnant/parrainage/page.tsx` (path accompagnant Epic 2 -- aucun impact)
- `app/accompagne/dashboard/page.tsx` (teaser dashboard scope 8.B.2)
- `next.config.mjs` (pas de redirect 301 ajoute -- la route `/accompagne/parrainage` est nouvelle, pas de legacy a rediriger)
- `middleware.ts` (la route `/accompagne/*` est deja couverte par le middleware Supabase auth)
- Toutes les migrations BDD (heritage F-Epic8-A0 GO)

### Structure suggeree du fichier `app/accompagne/parrainage/page.tsx`

```tsx
import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { ParrainageView } from '@/components/accompagne/parrainage-view'
import { AccompagneDashboardHeader } from '@/components/layout/accompagne-dashboard-header'
import { getUnreadCount } from '@/lib/unread-count'

type FilleulStatut = 'inscrite' | 'abonnee' | 'confirme' | 'fraude' | 'bloque'

export default async function AccompagneParrainagePage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: userData } = await supabase
    .from('users')
    .select('first_name, last_name, role')
    .eq('id', user.id)
    .single()
  if (!userData || userData.role !== 'accompagne') redirect('/')

  const { data: parrainageRow } = await supabase
    .from('parrainages_codes')
    .select('code, compteur_confirmes, total_recompenses')
    .eq('user_id', user.id)
    .maybeSingle()
  if (!parrainageRow?.code) redirect('/accompagne/dashboard')

  const { data: filleulsData } = await supabase
    .from('parrainages')
    .select('filleule_id, statut, filleule_inscrite_at, filleule_abonnee_at, users!parrainages_filleule_id_fkey(first_name, last_name)')
    .eq('marraine_id', user.id)
    .in('statut', ['inscrite', 'abonnee', 'confirme'])
    .order('filleule_inscrite_at', { ascending: false })
    .limit(50)

  const filleuls = (filleulsData || []).map((row) => {
    const usersJoin = row.users as unknown as
      | { first_name: string | null; last_name: string | null }
      | { first_name: string | null; last_name: string | null }[]
      | null
    const firstName = Array.isArray(usersJoin)
      ? usersJoin[0]?.first_name ?? null
      : usersJoin?.first_name ?? null
    const lastName = Array.isArray(usersJoin)
      ? usersJoin[0]?.last_name ?? null
      : usersJoin?.last_name ?? null
    return {
      firstName,
      lastName,
      statut: row.statut as FilleulStatut,
      inscriteAt: row.filleule_inscrite_at as string,
      abonneeAt: row.filleule_abonnee_at as string | null,
    }
  })

  const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || 'https://roxanetnous.fr'
  const unreadCount = await getUnreadCount(user.id)

  return (
    <main id="main-content" tabIndex={-1} className="min-h-screen bg-[#fefaf8] focus:outline-none">
      <AccompagneDashboardHeader
        firstName={userData.first_name || ''}
        lastName={userData.last_name || ''}
        unreadCount={unreadCount}
        currentPage="parrainage"
      />
      <div className="max-w-3xl mx-auto px-4 py-10 md:py-14 relative z-10">
        <header className="text-center mb-10">
          <div className="text-xs uppercase tracking-[0.18em] text-kraft mb-2">Mon espace</div>
          <h1 className="text-3xl md:text-4xl italic text-gray-900 leading-tight">Mon parrainage</h1>
          <p className="mt-3 text-sm text-gray-600">
            Partagez votre code, accueillez de nouveaux accompagnants.
          </p>
        </header>
        <ParrainageView
          code={parrainageRow.code}
          baseUrl={baseUrl}
          compteur={parrainageRow.compteur_confirmes ?? 0}
          totalRecompenses={parrainageRow.total_recompenses ?? 0}
          filleuls={filleuls}
        />
      </div>
    </main>
  )
}
```

### Structure suggeree du fichier `tests/a11y/p7-parrainage-accompagne.spec.ts`

```ts
import { test, expect } from '@playwright/test'
import { runAxe, summarizeCriticalSerious } from './lib/run-axe'

// Parcours auth-required : voir tests/a11y/lib/auth-stub.md
// On audite la page de login comme proxy d'entree du parcours parrainage accompagne.
test.describe('P7 -- Parrainage accompagne (proxy login)', () => {
  test('axe smoke /login (proxy P7)', async ({ page }, testInfo) => {
    await page.goto('/login', { waitUntil: 'domcontentloaded' })
    try {
      await page.waitForLoadState('networkidle', { timeout: 5000 })
    } catch {
      // Fallback gracieux : si networkidle ne se stabilise pas, l audit smoke continue.
    }

    const result = await runAxe(page)
    const summary = summarizeCriticalSerious(result.criticalSerious)
    await testInfo.attach('axe-violations.json', {
      body: JSON.stringify(
        { parcours: 'p7-parrainage-accompagne', url: '/login', proxy: true, violations: summary },
        null,
        2,
      ),
      contentType: 'application/json',
    })

    expect(summary).toBeDefined()
  })
})
```

### Coupures securite / sentinelles

- **Pas de session Supabase exposee cote client** : la page est Server Component, l'`access_token` reste dans le cookie HttpOnly. Le composant `ParrainageView` recoit uniquement des donnees serialisees safe (code 8 chars + chiffres + objets filleuls sans PII sensible au-dela du firstName/lastName public).
- **Pas de leak du `user.id` cote client** : seuls le code parrainage et les noms de filleuls (anonymises via `formatFilleulName` -> "Marie.D") sont envoyes au composant client.
- **Pas de bypass auth runtime** : la decision auth-stub.md du repo reste valide -- le test P7 utilise `/login` comme proxy public, pas un bypass auth.
- **`process.env.NEXT_PUBLIC_BASE_URL`** : variable publique deja set en Vercel env, pas de risque cote prod.

### Liens stories suivantes

- **8.B.2 (teaser dashboard accompagne "Invitez un accompagnant")** : ajoutera un bloc sur `/accompagne/dashboard` qui linke vers `/accompagne/parrainage` -- 8.B.1 livre la cible du lien.
- **8.C.1 (page admin tous roles + filtre)** : la page admin lit `parrainages` toutes roles confondues -- 8.B.1 n'a aucun impact admin.
- **8.C.3 (wording neutre cross-codebase)** : alignera `components/accompagnant/parrainage-view.tsx` sur le composant accompagne livre ici (annonce ARIA live + `role="progressbar"` + neutralisation feminin restant)
- **8.D.1 (E2E Playwright golden path)** : couvrira la page `/accompagne/parrainage` dans le scenario complet (signup accompagne -> souscription -> visite page -> copie code -> signup accompagnant avec code -> souscription -> bypass visio -> validation auto)

### References

- [Source: _bmad-output/planning-artifacts/epic-8.md#Story 8.B.1] -- spec AC originale (page + code + filleuls + a11y)
- [Source: _bmad-output/planning-artifacts/epic-8.md#FR49] -- code parrainage 8 caracteres pour accompagne abonne
- [Source: _bmad-output/planning-artifacts/epic-8.md#UX-DR-E8.1] -- design system "foyer" accompagne (background kraft, palette)
- [Source: _bmad-output/planning-artifacts/epic-8.md#UX-DR-E8.4] -- wording UI neutre (parrain/filleul/accompagnant)
- [Source: _bmad-output/planning-artifacts/epic-8.md#UX-DR-E8.5] -- conformite a11y page `/accompagne/parrainage` (axe-core + focus + contrastes + ARIA live)
- [Source: _bmad-output/planning-artifacts/epic-8.md#NFR-A11y-E8.1] -- 0 violation Critical/Serious axe-core, baseline lint a11y <= 158 (reel 155)
- [Source: _bmad-output/planning-artifacts/epic-8.md#AR-E8.8] -- composant `ParrainageView` (decision arbitrage 2026-05-17 : duplication preferee a refacto shared)
- [Source: _bmad-output/implementation-artifacts/8-a-1-webhook-stripe-genese-code-parrainage-accompagne.md] -- code parrainage genere a la 1ere transition `status='active'`/`'trialing'` (prerequis pour 8.B.1)
- [Source: _bmad-output/implementation-artifacts/8-a-2-server-actions-parrainage-symetrique.md] -- guards role-aware backend (validateCode + createParrainageRelation + confirmParrainageOnSuccess)
- [Source: _bmad-output/implementation-artifacts/8-a-3-cron-confirm-parrainages-recompense-role-parrain.md] -- cron role-aware applique recompense Stripe
- [Source: _bmad-output/implementation-artifacts/audit-bdd-parrainage-symetrique-2026-05-16.md] -- invariants BDD (`parrainages_codes.code` UNIQUE, `parrainages.marraine_id` NULLable, RLS owner read OK pour accompagne)
- [Source: _bmad-output/implementation-artifacts/deferred-work.md] -- entrees defer existantes (verifier post-livraison + ouvrir nouvelles)
- [Source: app/accompagnant/parrainage/page.tsx:1-106] -- patron Server Component de reference (auth + role + lookup code + redirect + filleules + JSX)
- [Source: components/accompagnant/parrainage-view.tsx:1-257] -- composant client de reference (clipboard + states + cards + progression + liste filleuls)
- [Source: app/accompagne/dashboard/page.tsx:1-312] -- patron layout dashboard accompagne (skip-link + AccompagneDashboardHeader + container + design system foyer)
- [Source: components/layout/accompagne-dashboard-header.tsx:1-123] -- composant header existant (a etendre union `currentPage`)
- [Source: components/accompagne/subscription-banner.tsx:1-19] -- composant "Abonnement requis" deja en place (NON utilise par 8.B.1, redirect prevaut)
- [Source: lib/parrainage-codes.ts:1-141] -- helper `generateCodeForUserSystem` + `triggerAccompagneCodeGenesisIfEligible` (prerequis 8.A.1 -- 8.B.1 lit la row creee)
- [Source: lib/subscription-helpers.ts:73-115] -- `getSubscriptionStatus` (utilise indirectement pour informer le redirect /accompagne/dashboard si pas de code)
- [Source: lib/unread-count.ts] -- `getUnreadCount` (helper existant, deja utilise par les autres pages accompagne)
- [Source: tests/a11y/README.md] -- documentation suite axe-core (parcours / baseline / regen)
- [Source: tests/a11y/lib/auth-stub.md] -- decision projet : pas de compte test, proxy /login pour parcours auth-required
- [Source: tests/a11y/p1-onboarding-aux.spec.ts:1-30] -- patron test P[N] proxy login
- [Source: scripts/check-a11y-baseline.mjs:113-149] -- garde-fou par paire (file, rule) -- delta tolere = 0
- [Source: scripts/build-axe-baseline.mjs] -- script de regen baseline axe-core (commande `npm run a11y:axe:baseline`)
- [Source: _bmad-output/test-artifacts/a11y-lint-baseline-2026-05-13.txt] -- baseline lint a11y 155 paires
- [Source: _bmad-output/test-artifacts/axe-core-baseline-2026-05-05.json] -- baseline axe-core 0 violations sur 7 parcours
- [Source: .claude/CLAUDE.md] -- regle a11y obligatoire + regle genre masculin neutre (CLAUDE.md durcies)
- [Source: _mockups-dashboard-accompagnante/foyer/parrainage.html] -- mockup design system "foyer" reference (visuel non-applicable car deja implemente en composant accompagnant)
- [Source: DECISIONS.md#F-Epic8-A0] -- GO sans migration BDD pour Epic 8 (heritage 8.A.0)
- [Source: DECISIONS.md#F-Epic8-A3] -- pattern role-aware cron (heritage 8.A.3) -- 8.B.1 indirect

## Dev Agent Record

### Agent Model Used

claude-opus-4-7[1m] via bmad-dev-story workflow.

### Debug Log References

- `npx tsc --noEmit` : TypeScript compilation completed (0 erreur).
- `npm run lint` : 194 warnings (vs baseline 196 initiale, -2 apres suppression `STATUT_LABELS`/`STATUT_BADGE_CLASS` non utilisees -- le composant accompagnant les conserve en dead code historique mais on part propre cote accompagne).
- `npm run lint:a11y-check` : OK 155 (file, rule) pairs (baseline preserve).
- `npm run test:unit` : 82/82 passed in 1.17s.
- `npm run build` : OK, route `ƒ /accompagne/parrainage` listee dans la sortie build.
- `npm run a11y:axe:baseline` : nouveau fichier `_bmad-output/test-artifacts/axe-core-baseline-2026-05-17.json` cree, 8 parcours, 0 Critical/Serious violations.
- `npm run a11y:axe:check` : OK, aucun delta vs nouveau baseline.

### Completion Notes List

- **AC1-AC3** (route + auth + role + lookup + redirect) : page Server Component cree, miroir architectural strict de `app/accompagnant/parrainage/page.tsx`. Auth via `supabase.auth.getUser()` + role check strict (`accompagne` only) + lookup `parrainages_codes.maybeSingle()` avec redirect `/accompagne/dashboard` si null.
- **AC4** (composant duplique) : `components/accompagne/parrainage-view.tsx` cree. Decision arbitrage 2026-05-17 (Sylvain) : duplication preferee a refacto `shared/` -- AR-E8.8 cadrage initial remplace.
- **AC5** (wording masculin neutre) : renommages effectues (`Filleule`->`Filleul`, `filleules`->`filleuls`, `formatFilleuleName`->`formatFilleulName`, fallback `'Filleule'`->`'Filleul'`). Phrases progression deja masculin neutre dans accompagnant Epic 2 (refonte foyer 2026-05-11). Texte d'aide `"Vous vous portez garant : il evite la visio..."` (deja `garant`+`il` dans accompagnant). Aucune occurrence feminine residuelle.
- **AC6** (lien d'invitation `?role=accompagnant`) : verification `components/auth/register-form.tsx:64-65` -> `useState<'accompagnant' | 'accompagne'>` accepte directement `accompagnant`. Pas de defer requis (AC13 ligne 3 omise).
- **AC7-AC8** (layout foyer + a11y) : container `max-w-3xl mx-auto px-4 py-10 md:py-14`, header `text-center` avec eyebrow/H1 italic/subtitle, `AccompagneDashboardHeader` passe `currentPage="parrainage"` (T1 extension union type). DoD a11y : `role="status" aria-live="polite"` sur copie clipboard + `role="progressbar" aria-valuenow/min/max + aria-label` sur barre de progression -- 2 ameliorations a11y livrees vs path accompagnant historique.
- **AC9** (parcours a11y P7) : `tests/a11y/p7-parrainage-accompagne.spec.ts` cree (pattern proxy `/login` heritage P1/P3/P6). Baseline regenere `axe-core-baseline-2026-05-17.json` avec 8 parcours dont P7 `violations: []`. Ancien baseline 2026-05-05 conserve (wrapper check prend le plus recent par tri ISO).
- **AC10** (zero modif backend) : aucun fichier `app/actions/`, `app/api/`, `lib/parrainage-codes.ts`, `lib/emails.ts`, `lib/subscription-helpers.ts` touche.
- **AC11** (test unitaire optionnel) : defer accepte (logique pure dupliquee strictement, faible risque regression -- 8.D.1 E2E couvrira le golden path).
- **AC12-AC13** : `tests/a11y/README.md` + `tests/a11y/lib/auth-stub.md` etendus avec ligne P7. `deferred-work.md` enrichi de 2 entrees defer (ARIA live + role=progressbar absents cote accompagnant -- alignement 8.C.3).
- **AC14** : tous gates CI verts (tsc/lint/lint:a11y-check/check:*/test:unit/build/a11y:axe:baseline/a11y:axe:check).
- **AC15** : coherence cross-story preservee (8.A.1/8.A.2/8.A.3 deja merges -- page strictement read-only).
- **AC16** : pas d'impact PROD (additive, pas de migration, pas de nouvelle env var).
- **Ecarts cadrage-vs-realite documentes** : (a) constantes `STATUT_LABELS`/`STATUT_BADGE_CLASS` du composant accompagnant sont dead code et reprises supprimees cote accompagne pour ne pas introduire de nouveau warning lint (T2.1 modifie : "copie integrale" devient "copie integrale moins dead code lint-incompatible"), (b) validation manuelle navigateur T5.7 reportee a T7 staging Sylvain (pas de seed accompagne+abo+code local).

### File List

**Crees** :
- `app/accompagne/parrainage/page.tsx` (~93 lignes, Server Component miroir `app/accompagnant/parrainage/page.tsx`)
- `components/accompagne/parrainage-view.tsx` (~240 lignes, composant client miroir + 2 attributs a11y ajoutes : `role=status aria-live=polite` + `role=progressbar aria-valuenow/min/max + aria-label`)
- `tests/a11y/p7-parrainage-accompagne.spec.ts` (~29 lignes, spec proxy `/login` aligne P1)
- `_bmad-output/test-artifacts/axe-core-baseline-2026-05-17.json` (nouveau baseline 8 parcours, ancien 2026-05-05 conserve)

**Modifies** :
- `components/layout/accompagne-dashboard-header.tsx` (ligne 11 : ajout `'parrainage'` dans l'union type `currentPage`)
- `tests/a11y/README.md` (1 ligne P7 ajoutee dans tableau "Parcours audites")
- `tests/a11y/lib/auth-stub.md` (1 ligne P7 ajoutee dans tableau "Couverture par parcours")
- `_bmad-output/implementation-artifacts/deferred-work.md` (section `## Deferred from: implementation of 8-b-1-... (2026-05-17)` avec 2 entrees defer)
- `_bmad-output/implementation-artifacts/sprint-status.yaml` (status 8.B.1 ready-for-dev -> in-progress -> review)
- `_bmad-output/implementation-artifacts/8-b-1-page-accompagne-parrainage-code-filleuls-a11y.md` (Tasks coches + Dev Agent Record + Change Log + Status review)

### Change Log

| Date       | Type     | Description |
|------------|----------|-------------|
| 2026-05-17 | story    | Story 8.B.1 cree ready-for-dev via bmad-create-story workflow. Decisions arbitrees : (a) redirect `/accompagne/dashboard` si pas de code (vs bandeau "Abonnement requis"), (b) composant duplique `components/accompagne/parrainage-view.tsx` (vs refacto shared), (c) nouveau parcours a11y P7 dedie (vs extension P4). |
| 2026-05-17 | dev      | Story 8.B.1 livree via bmad-dev-story (status review). 4 fichiers crees + 6 modifies. Page `/accompagne/parrainage` rendue role-aware avec a11y enrichie (ARIA live + progressbar). AC6 verifie : `register-form.tsx:64-65` accepte directement `?role=accompagnant`, pas de defer requis cote signup. Validation manuelle T5.7 reportee a T7 staging (pas de seed accompagne+abo+code local). DoD CI verte : tsc/lint 194/lint:a11y-check 155/check:*/test:unit 82-82/build/axe-baseline 8 parcours 0 violations/axe-check OK. |

### Review Findings

- [x] [Review][Patch] `joursRestantsAvantConfirmation` retourne `NaN` sur date `abonneeAt` non-ISO — ajout `if (isNaN(dateAbonnee)) return null` [`components/accompagne/parrainage-view.tsx:41-47`]
- [x] [Review][Patch] `formatFilleulName(null, 'Dupont')` produit `.D` — ajout guard `if (!formattedFirst && initialLast) return 'Filleul'` [`components/accompagne/parrainage-view.tsx:27-28`]
- [x] [Review][Patch] `tests/a11y/README.md` mis à jour : "7 parcours critiques (P1-P7)" (ligne 3) + "7 specs smoke" (ligne 116) [`tests/a11y/README.md:3,116`]
- [x] [Review][Defer] Clé de liste React instable `${inscriteAt}-${idx}` — `filleule_id` non passé au composant, donc UUID non disponible comme clé stable ; pre-existing accompagnant — deferred, pre-existing [`components/accompagne/parrainage-view.tsx:218`]
- [x] [Review][Defer] Fallback UI absent sur échec `navigator.clipboard` (silent catch) — même pattern que composant accompagnant historique — deferred, pre-existing [`components/accompagne/parrainage-view.tsx:69-71`]
- [x] [Review][Defer] `p4-register` URL dans baseline JSON toujours `?role=accompagnante` — baseline généré par les specs Playwright courantes ; P4 aligne sur `accompagnante` jusqu'à story 8.C.3 — deferred, pre-existing [`axe-core-baseline-2026-05-17.json:39`]
- [x] [Review][Defer] `abonneeAt` futur (décalage horloge/admin) donne barre 0% + label "Validé dans N>30 jours" — pre-existing accompagnant — deferred, pre-existing [`components/accompagne/parrainage-view.tsx:187-213`]

## DoD a11y

A renseigner pour cette story avec impact UI (livraison composant + page) :

- [x] Labels associes aux champs (`htmlFor` ou `aria-labelledby`) -- N/A pour cette story (aucun champ formulaire, uniquement des boutons textuels)
- [x] Erreurs liees aux champs via `aria-describedby` + `aria-invalid` -- N/A
- [x] Focus visible sur tous les elements interactifs (contraste >= 3:1) -- token focus global heritage 2.5.3 (pas d'override `outline-none` sans equivalent ring)
- [x] Contrastes texte >= 4,5:1 et UI >= 3:1 -- heritage tokens design system foyer (`text-gray-600`/`text-gray-500` sur `bg-[#fefaf8]` deja valides Lot A baseline)
- [x] ARIA states corrects sur composants dynamiques (`aria-expanded`, `aria-selected`, etc.) -- annonce ARIA live `role="status" aria-live="polite"` sur copie + `role="progressbar" aria-valuenow/min/max + aria-label` sur barre de progression (2 ameliorations vs accompagnant historique)
- [x] Navigation clavier complete (Tab, Enter, Escape, fleches selon pattern) -- Tab atteint header burger -> liens nav -> boutons copie, Enter active les boutons, pas de modal donc pas d'Escape
- [ ] Verification ponctuelle au lecteur d'ecran (VoiceOver ou NVDA) sur le composant touche -- reportee a T7 staging Sylvain (pas de session reelle accompagne+abo en local)
- [x] Pas de regression `eslint-plugin-jsx-a11y` (`npm run lint:a11y-check` vert en CI) -- baseline 155 (file, rule) pairs preserve, delta = 0
- [x] Pas de regression axe-core (`npm run a11y:axe:check` vert ou delta documente avec justification dans la PR) -- nouveau baseline `axe-core-baseline-2026-05-17.json` avec 8 parcours dont P7 `violations: []`, regen justifiee par extension parcours (a mentionner dans la PR)
