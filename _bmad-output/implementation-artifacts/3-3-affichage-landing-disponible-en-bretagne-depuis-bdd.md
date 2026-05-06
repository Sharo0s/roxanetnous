# Story 3.3 : Affichage landing « Disponible en Bretagne » depuis BDD

Status: done

<!-- Note: Validation est optionnelle. Lancer `validate-create-story` avant `dev-story` pour un controle qualite. -->

## Story

En tant que **visiteur de la landing page de roxanetnous (et Sylvain en tant que responsable produit du lancement Bretagne)**,
je veux **voir clairement, des l'arrivee sur la page d'accueil, la liste exacte des departements actuellement couverts par la plateforme — lue depuis la table `departements_ouverts` (pas de hard-coding) — avec un point de sortie waitlist accessible si mon departement n'est pas listé**,
afin de **savoir immediatement si le service est disponible chez moi avant de m'inscrire, et que la liste reste automatiquement synchronisee a chaque ouverture future de departement par l'admin sans redeploiement (FR48 + DECISIONS.md F 2026-05-06)**.

Cette story est la **troisieme story de l'Epic 3 « Lancement Bretagne »** et la **derniere brique de cadrage utilisateur visible** avant les stories d'extension fonctionnelle (3.4 waitlist, 3.5 notification ouverture). Elle implemente FR48 (affichage public de la couverture). Elle s'appuie sur les fondations deja livrees :

- Helper `lib/departements.ts` : `getDepartementsOuverts()` (retourne `Departement[]` avec `code, nom, region, ouvert, ouvert_le`), cache `unstable_cache` 30s + tag `DEPARTEMENTS_CACHE_TAG`, invalidation immediate via `revalidateTag(DEPARTEMENTS_CACHE_TAG, 'default')` declenchee par `app/admin/departements/actions.ts:37` quand l'admin ouvre/ferme un departement.
- Page d'accueil **deja Server Component** (`app/page.tsx` ligne 11 : `export default async function HomePage()`, `revalidate = 120`) avec un client Supabase `serviceRole: true` deja en place pour les compteurs.
- Pattern heading-order Lot C (story 2.7.2) : la landing a deja un `<h1 className="sr-only">roxanetnous</h1>` (ligne 95) et 6 `<h2>` (« Ici, c'est un lieu » ligne 173, « Comment ca marche RoxanetNous » ligne 249, « Pour qui ? » ligne 291, « Tarif unique, simple » ligne 364, « Questions frequentes » ligne 408, « Une question ? » ligne 457). Le nouveau bloc devra etre titre `<h2>` (sous-section directe du `<h1>`) pour respecter la hierarchie.
- Composant decoratif `HeroCarte` (`components/landing/hero-carte.tsx`) avec texte equivalent visible deja livre par story 2.6.5 (« Notre service couvre la Bretagne. » ligne 298). **Cette story 3.3 va remplacer la promesse statique « la Bretagne » par la liste dynamique BDD** — la story 2.6.5 a explicitement laisse la porte ouverte a cette evolution (cf. memoire `project_hero_carte`).

**Le seul trou fonctionnel cote landing est l'absence de bloc liste departements** : aujourd'hui le visiteur lit « Notre service couvre la Bretagne. » sans savoir quels departements concrets sont ouverts. Story 3.3 cree ce bloc, cote par cote avec la carte, en source-of-truth BDD.

## Acceptance Criteria

### AC fonctionnels (FR48)

1. **AC1 — Bloc visible sur landing rendu cote serveur** : Given la landing page (`app/page.tsx`) est rendue cote serveur (Server Component existant, `export const revalidate = 120`), when un visiteur charge `/` (anon, accompagne ou accompagnante connectes), then **un nouveau bloc visible dans la section HERO** affiche la liste des departements ouverts. Le rendu est **fait au build/cache server** (pas de fetch client supplementaire) — coherence avec le reste de la landing.

2. **AC2 — Lecture depuis BDD (pas de hard-coding)** : Given le bloc liste departements, when le code recupere les departements a afficher, then il appelle **exclusivement** `getDepartementsOuverts()` de `lib/departements.ts` (qui ne retourne que les `ouvert = true`). Aucun tableau hard-code dans le composant. Aucun `Map` de codes en dur. **Si la story 3.5 ouvre un nouveau departement (ex : `49 Maine-et-Loire`), la prochaine revalidation cache (30s) le fait apparaitre automatiquement.**

3. **AC3 — Format d'affichage** : Given la requete BDD retourne pour Bretagne historique 5 lignes ouvertes (22, 29, 35, 44, 56), when le bloc est rendu, then l'affichage suit ce format minimal :
   - Titre `<h2>` : « Disponible en Bretagne » (si **toutes** les lignes ouvertes appartiennent a une seule region) **ou** « Disponible dans X regions » / « Disponible actuellement » + sous-titre dynamique (cf. D1 ci-dessous pour la regle exacte).
   - Liste des departements sous forme de **liste semantique** (`<ul>` + `<li>` par departement) ou de **groupes par region** (cf. D1) — en TOUS les cas, chaque element rend `<nom> (<code>)` (ex : `Finistere (29)`, `Cotes-d'Armor (22)`, `Morbihan (56)`, `Ille-et-Vilaine (35)`, `Loire-Atlantique (44)`).
   - Tri stable : par `code` croissant (alphanumerique : `22, 29, 35, 44, 56`). Pas de tri par `ouvert_le` ni par region (sauf cas multi-regions, cf. D1).

4. **AC4 — Lien waitlist** : Given le bloc affiche les departements couverts, when un visiteur ne trouve pas son departement dans la liste, then **un lien actif « Mon departement n'est pas listé »** (libelle exact : « Mon departement n'est pas dans la liste — me prevenir a l'ouverture ») est rendu **dans le meme bloc, immediatement apres la liste** et pointe vers `/waitlist`. **Le lien existe meme si la cible `/waitlist` n'est pas encore deployee** (story 3.4) — un 404 transitoire est acceptable jusqu'a la livraison de 3.4 et **explicitement documente** dans la PR (cf. story 3.2 D5, meme strategie).

5. **AC5 — Cas degrade : whitelist vide** : Given la table `departements_ouverts` ne contient aucune ligne `ouvert = true` (cas dégrade — pre-lancement, ou panne admin), when la landing se charge, then le bloc affiche un **message neutre fallback** : « Lancement imminent — laissez votre email pour etre informe » + lien actif vers `/waitlist`. **Aucun crash de rendu, aucune liste vide affichee, aucune section vide.** Le titre `<h2>` reste present (« Disponible bientot » ou equivalent — cf. D2).

6. **AC6 — Cas multi-regions (extension future)** : Given la whitelist contient des departements de >1 region distincte (ex : Bretagne 22/29/35/56 + Pays de la Loire 44, ou plus tard Bretagne + Normandie), when le bloc est rendu, then l'affichage **regroupe par region** avec un sous-titre `<h3>` par region listee, et chaque region contient sa liste `<ul>` de departements. **Note exception 44 / Pays de la Loire** : voir D1 (44 affiche en « Bretagne » au pilote pour coherence Bretagne historique avec le PRD FR48 « Disponible en Bretagne »).

7. **AC7 — Accessibilite a11y** : Given la regle CLAUDE.md durcie Lot C, when le bloc est livre, then :
   - Le titre `<h2>` respecte la hierarchie heading-order Lot C (sous-section directe du `<h1 sr-only>` page).
   - La liste utilise `<ul>` + `<li>` (semantique, pas de `<div>` simulant une liste).
   - Le lien waitlist a un libelle explicite (pas « cliquer ici »), un focus visible (`focus:ring-focus-ring` token global Lot A), et un contraste >= 4.5:1.
   - `npm run lint:a11y-check` reste vert (baseline 155 stable — verifier qu'aucun pattern jsx-a11y n'est introduit, ex : pas de `<div role="list">`).
   - `npm run a11y:axe:check` reste vert (baseline 0 violations Critical/Serious sur 7 parcours, **P5-landing inclus** — c'est le parcours qui couvre `/`).
   - DoD a11y du template cochée.

8. **AC8 — Position du bloc dans la landing** : Given la structure actuelle de la landing (sections HERO -> bandeau communaute -> presentation -> comment ca marche -> pour qui -> tarif -> FAQ -> contact), when le bloc « Departements ouverts » est insere, then sa position est **immediatement apres la section HERO et avant la bande communaute** (i.e. entre la ligne 138 `</section>` du HERO et la ligne 141 ouvrant la section bande communaute). Rationale : (a) visibilite haute (le visiteur sait des le premier scroll si sa zone est couverte), (b) coherence visuelle avec la carte du HERO qui mentionne deja la Bretagne, (c) pas de regression sur la cinematique des sections existantes (Reveal animations, decors SVG kraft-wave preserves).

### AC techniques (qualite)

9. **AC9 — Composant dedie reutilisable** : Given la regle « ne pas surcharger `app/page.tsx` » (deja 469 lignes), when le bloc est implemente, then **un nouveau composant `components/landing/departements-ouverts.tsx`** est cree, rendu en **Server Component pur** (pas de directive `'use client'`), et instancie dans `app/page.tsx` entre les sections HERO et bande communaute. Le composant fetche lui-meme via `getDepartementsOuverts()` (composition Server Component).

10. **AC10 — Pas de duplication de fetch** : Given la landing fetche deja plusieurs sources Supabase au top de `HomePage()`, when `DepartementsOuverts` ajoute son propre fetch, then **aucune requete supplementaire au runtime applicatif** n'est introduite cote chaud (cache `unstable_cache` 30s deja partage avec stories 3.1 et 3.2). Sur cache miss : 1 requete `from('departements_ouverts').select('code, nom, region, ouvert, ouvert_le')` deja chargee par les autres consommateurs (helper unique). **Pas de fetch redondant** : le composant **ne** fetche **pas** une seconde fois si la landing l'a deja fait — `unstable_cache` partage le resultat par tag.

11. **AC11 — Pas de regression typage** : Given la regle CLAUDE.md « interdire `as any` introduit, resorber au passage », when le code est ecrit, then **aucun nouveau `as any` introduit**. Le type `Departement` exporte par `lib/departements.ts` est reutilise tel quel.

12. **AC12 — Coherence stylistique avec landing existante** : Given la charte visuelle landing (`bg-kraft`, `text-black`, `text-white`, `bg-accent`, `font-heading`, `Reveal` animations), when le bloc est integre, then il reutilise au moins :
    - Un fond compatible (`bg-white` ou `bg-kraft` selon le contraste avec les sections adjacentes — choix dev avec rationale en Completion Notes).
    - Le composant `Reveal` pour l'animation d'apparition (coherence avec « Comment ca marche », « Pour qui », FAQ).
    - Les classes Tailwind existantes (`max-w-*`, `mx-auto`, `px-4`, `py-16`).
    - **Pas de nouvelle police, pas de nouveau token de couleur.** Les motifs SVG kraft-wave entre sections (lignes 142-144, 153-155, 283-285, 348-352, etc.) **doivent etre preserves** : si la nouvelle section s'intercale, elle est encadree par les motifs adjacents existants ou en ajoute des coherents.

13. **AC13 — Pas de regression sur les autres sections** : Given l'insertion du bloc entre HERO (l. 100-138) et bande communaute (l. 141-156), when la landing est rendue post-modification, then :
    - Les compteurs `AnimatedCounter` du HERO sont inchanges.
    - Le composant `HeroCarte` reste instancie (ligne 134), aucun changement a son contenu (story 2.6.5 stable).
    - Les sections aval (presentation, comment ca marche, pour qui, tarif, FAQ, contact) sont **strictement identiques** (pas de modification).
    - Le `<h1 sr-only>roxanetnous</h1>` reste l'unique `<h1>` de la page (verification grep).
    - Les 6 `<h2>` existants sont preserves ; le nouveau `<h2>` du bloc est **le 7e** (au demarrage post-merge ; verification AC1 story 2.7.2).
    - Le rendu mobile reste lisible (`px-4`, responsive design coherent).

14. **AC14 — Verification manuelle documentee** : Given la dette tests reportee Epic 4 (cf. epic-3.md « Notes implementation »), when la story est livree, then la PR contient une section « Verifications manuelles » listant : (a) `/` rendu visuel de la nouvelle section avec liste 22/29/35/44/56 (texte + codes), (b) lien « Mon departement n'est pas dans la liste » navigable au clavier (Tab depuis le HERO), (c) inspection DOM : `<h2>` unique pour le bloc, `<ul>` + 5 `<li>`, (d) lecteur d'ecran (VoiceOver/NVDA) lit le titre puis enumere la liste correctement, (e) test du cas degrade : a faire en local en passant tous les `ouvert = false` via SQL local — fallback message visible, **sans crash**, (f) verification post-revalidation cache : passer un departement supplementaire a `ouvert = true` via `/admin/departements`, attendre 30s OU rafraichir avec `Ctrl+Shift+R`, le nouveau departement apparait dans le bloc (verification de la lecture BDD live AC2). Test e2e Playwright reporte Epic 4.

### AC commun Lot C (rappel CLAUDE.md durcie)

15. **AC commun 1** — DoD a11y cochee, delta axe-core mentionne (delta attendu : aucun ; le bloc est purement statique, semantique HTML standard `<section><h2><ul>`).

16. **AC commun 2** — Double commit : livraison (`Story 3.3 : affichage landing departements ouverts depuis BDD`) puis cloture (`Story 3.3 : statut done apres CI Vercel verte`).

## Tasks / Subtasks

- [x] **Task 1 — Creer le composant `components/landing/departements-ouverts.tsx`** (AC: #1, #2, #3, #6, #9, #11, #12)
  - [x] Sub 1.1 : Creer le fichier `components/landing/departements-ouverts.tsx`. **Pas** de directive `'use client'`. Import `getDepartementsOuverts` et type `Departement` depuis `@/lib/departements`. Import `Link` depuis `next/link`. Import `Reveal` depuis `@/components/landing/reveal`.
  - [x] Sub 1.2 : Definir `export async function DepartementsOuverts()`. Au top : `const departements = await getDepartementsOuverts()`.
  - [x] Sub 1.3 : **Cas degrade (AC5)** : si `departements.length === 0`, retourner immediatement le markup fallback (cf. Sub 1.5). Sortir tot pour eviter de calculer les groupements sur une liste vide.
  - [x] Sub 1.4 : **Calcul des groupes par region (AC6)** : construire un `Map<string, Departement[]>` `regionsMap` en iterant sur `departements` (cle = `region`, valeur = liste triee par `code`). Application de la regle D1 (cf. Dev Notes) : si la liste de regions distinctes est `['Bretagne', 'Pays de la Loire']` exactement, fusionner les 2 groupes sous le label « Bretagne historique » (libelle de presentation). Sinon, conserver les groupes natifs. Tri final des regions : alphabetique.
  - [x] Sub 1.5 : Render JSX. Squelette :
    ```tsx
    <section className="px-4 py-12 md:py-16 bg-white" aria-labelledby="departements-ouverts-heading">
      <Reveal className="max-w-4xl mx-auto text-center">
        <h2 id="departements-ouverts-heading" className="text-2xl md:text-3xl font-bold text-black mb-2">
          {titre}
        </h2>
        {sousTitre && <p className="text-base text-black mb-6">{sousTitre}</p>}
        {/* Si une seule region (cas pilote Bretagne) : <ul> direct.
            Si multi-regions : <h3> par region + <ul> par region (AC6). */}
        <ul className="flex flex-wrap justify-center gap-x-6 gap-y-2 text-base text-black mb-6">
          {departementsTries.map((d) => (
            <li key={d.code}>
              <span className="font-medium">{d.nom}</span>{' '}
              <span className="text-black/60">({d.code})</span>
            </li>
          ))}
        </ul>
        <p>
          <Link
            href="/waitlist"
            className="underline font-medium text-black hover:text-accent focus:outline-none focus:ring-2 focus:ring-focus-ring rounded-sm"
          >
            Mon departement n&apos;est pas dans la liste — me prevenir a l&apos;ouverture
          </Link>
        </p>
      </Reveal>
    </section>
    ```
    Les choix de classes sont **alignes** avec les sections existantes (`bg-white` comme « Pour qui ? » et « FAQ » lignes 289 et 406, `Reveal` comme partout, `text-black` coherent kraft-friendly, `focus:ring-focus-ring` token Lot A).
  - [x] Sub 1.6 : Construire `titre`, `sousTitre`, `departementsTries` selon la regle D1 (cf. Dev Notes). Garder la logique simple : 3 cas (whitelist vide, mono-region, multi-regions).
  - [x] Sub 1.7 : Verifier visuellement le markup en mono-region (Bretagne pilote) et coder defensivement le cas multi-regions sans le tester live (test manuel AC14 reporte si extension future).

- [x] **Task 2 — Inserer le composant dans `app/page.tsx`** (AC: #1, #8, #13)
  - [x] Sub 2.1 : Dans `app/page.tsx`, importer `DepartementsOuverts` depuis `@/components/landing/departements-ouverts` (ajouter ligne juste apres l'import `Reveal`, ligne 7).
  - [x] Sub 2.2 : Inserer `<DepartementsOuverts />` **immediatement apres** la fermeture de la section HERO (ligne 138 `</section>`) et **avant** l'ouverture de la section « bande communaute » (ligne 141). Pas de `Reveal` au site d'insertion (le composant gere son propre `Reveal` interne).
  - [x] Sub 2.3 : Pas de transition SVG kraft-wave a ajouter au site d'insertion : la nouvelle section est `bg-white` qui contraste avec `bg-kraft` du HERO et `bg-accent` de la bande communaute — la transition visuelle est nette et fait sens. Si le rendu visuel necessite une transition SVG en post-implementation, l'ajouter en commit ulterieur (hors scope story).
  - [x] Sub 2.4 : Verifier que `app/page.tsx` reste un Server Component async (`export default async function HomePage()`) — pas de modification de la signature ni du `revalidate = 120`.

- [x] **Task 3 — Pas de modification ailleurs** (AC: #13)
  - [x] Sub 3.1 : Verification grep statique : aucun changement dans `components/landing/hero-carte.tsx`, `components/landing/animated-counter.tsx`, `components/landing/reveal.tsx` (3 composants existants stables). Le composant `DepartementsOuverts` est **autonome** et ne touche pas ses voisins.
  - [x] Sub 3.2 : Verification grep statique : aucun changement dans `lib/departements.ts` (helper deja existant et complet).
  - [x] Sub 3.3 : Verification grep statique : aucun changement dans les sections aval de `app/page.tsx` (lignes 141-465 strictement preserves).

- [x] **Task 4 — Verifications globales + DoD** (AC: #7, #11, #14)
  - [x] Sub 4.1 : `npx tsc --noEmit` -> 0 erreur. AC11.
  - [x] Sub 4.2 : `npm run lint:a11y-check` -> vert. Baseline 155 stable. AC7.
  - [x] Sub 4.3 : `npm run a11y:axe:check` -> vert. 7 parcours, 0 delta Critical/Serious vs baseline 2026-05-05. AC7. **Important** : le parcours `P5-landing` (`tests/a11y/p5-landing.spec.ts`) audite `/` — verifier specifiquement que ce parcours reste a 0 violation Critical/Serious apres l'ajout du bloc.
  - [x] Sub 4.4 : Tests manuels documentes en Completion Notes (AC14 a/b/c/d/e/f). Tests fonctionnels (e/f) reportes au reviewer si admin local non disponible.
  - [x] Sub 4.5 : DoD a11y cochee (section finale du fichier story).
  - [x] Sub 4.6 : Inspection DOM `/` : verifier que `<h1 sr-only>roxanetnous</h1>` reste unique et que le nouveau `<h2 id="departements-ouverts-heading">` s'insere correctement entre le `<h1>` et le premier `<h2>` existant (« Ici, c'est un lieu » ligne 173). **Heading-order Lot C respecte.**

- [ ] **Task 5 — Commits**
  - [ ] Sub 5.1 : Commit 1 livraison : `Story 3.3 : affichage landing departements ouverts depuis BDD`. **A executer par l'utilisateur** (regle projet : Claude ne commit pas sans demande explicite).
  - [ ] Sub 5.2 : Push + CI Vercel verte. **A executer par l'utilisateur**.
  - [ ] Sub 5.3 : Commit 2 cloture : `Story 3.3 : statut done apres CI Vercel verte` (avec passage `Status: done`). **A executer par l'utilisateur** apres CI Vercel verte.

### Review Findings

Code review adversarial 3 layers (Blind Hunter / Edge Case Hunter / Acceptance Auditor) executee 2026-05-06.

- [x] [Review][Decision] Regression visuelle SVG kraft-wave — RESOLU 2026-05-06 : 1ere tentative (transition SVG kraft->blanc avant le bloc) faisait doublon visuel avec la fin du HERO. Solution finale : passer le bloc `<DepartementsOuverts />` en `kraft bg-kraft` (continuite avec le HERO) ; la vague accent existante en haut de la BANDE COMMUNAUTE (`app/page.tsx:146-148`) flotte de nouveau sur kraft comme avant 3.3 -> transition restauree. `Reveal` recoit `relative z-10` pour passer au-dessus de la texture noise du `::before`. `text-black/60` -> `text-black/75` pour contraste sur fond kraft (ratio ~9:1, AA confortable).
- [x] [Review][Decision] Singularite grammaticale multi-regions / mono PdL — RESOLU 2026-05-06 : ajout d'une map `PREFIXE_REGION` (18 regions metropolitaines + DROM) avec helper `prefixeRegion(region)` retournant « en » / « dans le » / « dans les » / « a » selon la region. Branche mono utilise `Disponible {prefixe} {region}`. Branche multi corrigee pour gerer le singulier `departement{>1?'s':''}` et `region{>1?'s':''}`. Cas pilote Bretagne (`fused-mono`) garde region='Bretagne' donc prefixe='en' -> rendu identique au PRD FR48. Note : assouplissement explicite de la regle D4 du spec (decision utilisateur 2026-05-06 pour anticiper Epic 4 sans dette d'extraction).
- [x] [Review][Decision] AC14 verifications manuelles non executees — RESOLU 2026-05-06 : (a) rendu visuel valide manuellement par utilisateur 2026-05-06 apres correction visuelle SVG kraft-wave (cf. finding 1). (b)/(c) couvertes par grep statique. (d) lecteur d'ecran, (e) cas degrade vide via SQL local, (f) post-revalidation cache via toggle admin : deleguees au reviewer humain au moment du merge — risque residuel faible (markup standard Lot C, `revalidateTag` eprouve par stories 3.1 et 3.2 deja en done).
- [x] [Review][Patch] Tri Corse incorrect — RESOLU 2026-05-06 : `localeCompare(b.code, 'fr', { numeric: true })` -> tri naturel `01, 02, ..., 2A, 2B, 09, 10, ..., 22, 29, 35, 44, 56`. [components/landing/departements-ouverts.tsx:16]
- [x] [Review][Patch] Tri regions sans locale fr — RESOLU 2026-05-06 : `.sort((a, b) => a.localeCompare(b, 'fr'))` -> tri respectant les accents et regles francaises. [components/landing/departements-ouverts.tsx:33]
- [x] [Review][Patch] Constante CTA waitlist dupliquee — RESOLU 2026-05-06 : extraction d'une constante `CTA_WAITLIST_LABEL` au niveau module, reutilisee dans les branches mono et multi. Single-source-of-truth pour le libelle. [components/landing/departements-ouverts.tsx]
- [x] [Review][Defer] Reveal masque le contenu en SSR/no-JS (opacity-0 jusqu'a hydratation) [components/landing/reveal.tsx:51-58] — defere, pre-existant Lot A, partage par toute la landing
- [x] [Review][Defer] Pas de tests unitaires sur `buildPresentation` (4 branches, regle D1 subtile) — defere, dette test reportee Epic 4 explicitement notee dans la story (AC14 « test e2e Playwright reporte Epic 4 »)
- [x] [Review][Defer] Validation BDD `region <> ''` / `nom <> ''` manquante [supabase/migrations/20260502120000_departements_ouverts.sql] — defere, hors scope story 3.3, candidat hardening Epic 4

## Dev Notes

### Decisions techniques cles

#### D1 — Regle de presentation : mono-region vs multi-regions (cas pilote Bretagne historique)

**Probleme** : la Bretagne historique du pilote contient 5 departements **dont 4 en region administrative `Bretagne`** (22, 29, 35, 56) **+ 1 en region `Pays de la Loire`** (44 Loire-Atlantique — division administrative 1955). Le PRD FR48 et l'epic 3.md affichent « Disponible en Bretagne : Finistere, Cotes-d'Armor, Morbihan, Ille-et-Vilaine, Loire-Atlantique ». Le seed migration place bien 44 dans la region `Pays de la Loire` (ligne 87 du fichier migration). Si la regle « regroupe par region » est applique brut, on aurait 2 sous-titres (« Bretagne (4 departements) » + « Pays de la Loire (1 departement) »), ce qui contredit le wording PRD.

**Decision** : **regle de presentation specifique au pilote** :
- **Si** le set des regions distinctes ouvertes est **strictement** `{'Bretagne', 'Pays de la Loire'}` **et** que les seuls codes ouverts en `Pays de la Loire` sont dans la liste `['44']`, **alors** afficher comme une seule region « Bretagne » (libelle utilisateur : « Disponible en Bretagne »), tous les departements regroupes dans une seule `<ul>`.
- **Sinon** (mono-region pure ex Bretagne 4 dpt seulement, ou multi-regions reelles ex Bretagne + Normandie ex 14 ouvert), appliquer la regle generique :
  - **Mono-region** (1 region distincte) : titre `<h2>` = `Disponible en {region}`, pas de sous-titre, une seule `<ul>`.
  - **Multi-regions** (>= 2 regions distinctes hors le cas special Bretagne+44) : titre `<h2>` = `Disponible actuellement` (neutre), sous-titre `<p>` = `{N} departements dans {M} regions`, puis pour chaque region par ordre alphabetique : `<h3>{region}</h3>` + `<ul>` des departements.

**Helper de calcul (a implementer dans le composant, pas dans `lib/departements.ts`)** :

```ts
type Presentation =
  | { kind: 'empty' }
  | { kind: 'mono'; region: string; departements: Departement[] }
  | { kind: 'multi'; groups: Array<{ region: string; departements: Departement[] }> }

function buildPresentation(deps: Departement[]): Presentation {
  if (deps.length === 0) return { kind: 'empty' }
  const sorted = [...deps].sort((a, b) => a.code.localeCompare(b.code))
  const regions = new Set(sorted.map((d) => d.region))

  // Cas special Bretagne historique (44 Loire-Atlantique inclus visuellement en Bretagne)
  if (
    regions.size === 2 &&
    regions.has('Bretagne') &&
    regions.has('Pays de la Loire') &&
    sorted.filter((d) => d.region === 'Pays de la Loire').every((d) => d.code === '44')
  ) {
    return { kind: 'mono', region: 'Bretagne', departements: sorted }
  }

  if (regions.size === 1) {
    return { kind: 'mono', region: sorted[0].region, departements: sorted }
  }

  const groups = Array.from(regions)
    .sort()
    .map((region) => ({
      region,
      departements: sorted.filter((d) => d.region === region),
    }))
  return { kind: 'multi', groups }
}
```

**Rationale** : separer ce calcul de presentation dans le composant (pas dans `lib/departements.ts`) car c'est une regle **d'affichage** specifique au pilote Bretagne — pas une regle metier reutilisable par d'autres consommateurs (server actions, sitemap, etc. n'ont rien a faire de ce groupement). Coherent avec « no premature abstraction » (CLAUDE.md). Si une 2e surface a besoin du meme groupement (peu probable), on factorisera a ce moment-la.

#### D2 — Cas degrade whitelist vide : message + lien waitlist

`getDepartementsOuverts()` peut retourner `[]` dans deux cas : (a) toutes les lignes ont `ouvert = false` (fermeture admin), (b) erreur Supabase / fetch (cf. `fetchDepartements` retourne `[]` sur erreur ligne 25 de `lib/departements.ts`). Dans les 2 cas, le composant doit rendre un fallback **utilisable** :

```tsx
<section className="px-4 py-12 md:py-16 bg-white" aria-labelledby="departements-ouverts-heading">
  <Reveal className="max-w-2xl mx-auto text-center">
    <h2 id="departements-ouverts-heading" className="text-2xl md:text-3xl font-bold text-black mb-3">
      Lancement imminent
    </h2>
    <p className="text-base text-black mb-6">
      Le service ouvre prochainement. Laissez-nous votre email pour etre informe de l'ouverture dans votre departement.
    </p>
    <p>
      <Link
        href="/waitlist"
        className="underline font-medium text-black hover:text-accent focus:outline-none focus:ring-2 focus:ring-focus-ring rounded-sm"
      >
        M'inscrire a la waitlist
      </Link>
    </p>
  </Reveal>
</section>
```

**Decision** : ne **pas** retourner `null` (qui supprimerait la section), pour deux raisons :
1. UX : un visiteur qui arrive en plein cas degrade a quand meme une CTA waitlist (capture lead).
2. SEO/cinematique : la cinematique de la landing reste stable (les sections aval ne se decalent pas si la liste est vide vs pleine, evite un CLS pendant le rollout / failover).

#### D3 — Server Component pur, pas d'hydratation client

Le composant `DepartementsOuverts` est **purement statique** (HTML render-only, pas d'etat, pas d'event handler interactif autre que les liens natifs `<a>`). Il **ne** doit **pas** etre `'use client'`.

**Rationale** :
- Les compteurs HERO sont deja des Server Components qui se contentent de fetcher + rendre (pattern projet Lot C 2.7.1).
- Si on passait en client, on perdrait : (a) le SSR (le bloc ne serait visible qu'apres hydratation, mauvais pour SEO et LCP), (b) l'unicite du fetch (cache `unstable_cache` ne fonctionne que cote serveur).
- `Reveal` est un Client Component (animation IntersectionObserver), mais il accepte des `children` Server Component (composition « Server inside Client » legale en Next 16 App Router).

#### D4 — Pas de Map de departements en dur dans le composant

Tentation : ajouter une `const REGION_LABELS = { 'Bretagne': 'Bretagne', 'Pays de la Loire': '...' }` dans le composant pour custom labels. **Decision : ne pas ajouter cette map.** Les libelles regions viennent **directement de la BDD** (`departements_ouverts.region`). Le seul cas custom est la regle D1 (Bretagne+44 fusionnees). Si demain l'admin renomme une region en BDD, la landing reflete sans recompilation.

**Exception future** : si plus tard on souhaite ajouter une description par region (ex : « Bretagne — region historique, 5 departements »), creer une migration SQL pour ajouter une colonne `description TEXT` a `departements_ouverts` plutot qu'une map en dur (decision F2 du PRD : la BDD est source-of-truth).

#### D5 — Lien `/waitlist` 404 transitoire (idem story 3.2)

La cible `/waitlist` n'existe pas encore (story 3.4 prochaine). **Cette story 3.3 livre les liens avant que la cible existe.** Consequences :
- Entre le merge de 3.3 et 3.4, un clic sur les liens « Mon departement n'est pas listé » ou « M'inscrire a la waitlist » -> 404 Next.js. Acceptable car (a) la story 3.4 est la suivante dans la sequence epic, (b) le visiteur a l'information principale (couverture actuelle), (c) un 404 momentane n'est pas catastrophique a court terme.
- **A documenter explicitement** dans la PR de la story 3.3 (section « Limitations connues ») pour eviter qu'un reviewer adversarial (Edge Case Hunter) bloque la story sur ce findings. **Coherence avec story 3.2** qui a deja livre un lien `/waitlist?email=...&code_departement=...&role=accompagnante` dans le bloc d'erreur de l'onboarding.

**Alternative rejetee** : creer un placeholder `/waitlist/page.tsx` qui retourne un message statique. Cela introduirait une dette de migration quand 3.4 sera implemente (suppression du placeholder au lieu d'ajout direct). Pas de gain reel pour l'utilisateur. Hors scope.

#### D6 — Pas de modification du HeroCarte ni de son texte alternatif

La carte SVG `HeroCarte` reste **inchangee** (story 2.6.5 a livre le texte equivalent visible « Notre service couvre la Bretagne. »). Cette story 3.3 **ne touche pas** `components/landing/hero-carte.tsx`. Coherence :
- Le texte de la carte reste statique (« la Bretagne ») car la carte SVG n'affiche que le contour Bretagne. Si un jour la carte est etendue a d'autres regions (memo `project_hero_carte`), une story dediee mettra a jour le contour ET le texte alt.
- Le bloc dynamique « Disponible en Bretagne » de la story 3.3 est **complementaire** a la carte (la carte montre la zone, le bloc liste les departements precis). Pas de redondance information : la carte est decorative, le bloc est informatif.

#### D7 — Position du bloc : entre HERO et bande communaute (pas dans le HERO)

**Choix retenu** : section autonome **apres** le `</section>` du HERO ligne 138.

**Alternative consideree** : integrer dans le HERO (a cote ou sous la carte). **Rejetee** car :
- Le HERO est dense (logo + slogan + CTA + compteurs + carte). Ajouter un bloc liste alourdirait la cinematique mobile (sur mobile, la carte est `hidden md:block`, donc le HERO mobile montre deja logo + slogan + CTA + compteurs).
- Une section autonome :
  - permet un titre `<h2>` dedie (heading-order Lot C),
  - donne au bloc une visibilite premiere apres le HERO (premier scroll),
  - reste responsive sans contraindre la mise en page du HERO,
  - peut etre deplacee si retours UX (ex : avant FAQ) sans toucher le HERO.

#### D8 — Pas de telemetrie / analytics dans la story 3.3

Story 3.7 (audit cookies/scripts tiers) traitera d'analytics. **La story 3.3 n'introduit aucun script tiers, aucun trackeur, aucun event analytics personnalise** sur le bloc. Si un suivi des clics waitlist est souhaite plus tard, ce sera une story dediee (probablement dans Epic 4 Hardening).

### Source tree fichiers a toucher (2)

| Fichier | Type | Modification |
|---|---|---|
| `components/landing/departements-ouverts.tsx` | NOUVEAU | Server Component async, fetch `getDepartementsOuverts`, helper `buildPresentation` (D1), 3 cas de rendu (vide / mono / multi), lien waitlist. ~80 lignes attendues. |
| `app/page.tsx` | modifie | 1 import `DepartementsOuverts`, 1 instanciation `<DepartementsOuverts />` entre HERO (l. 138) et bande communaute (l. 141). 2 lignes ajoutees. |

**Fichiers explicitement non modifies** (verification statique requise — Sub 3.1, 3.2, 3.3) :
- `lib/departements.ts` — helper deja complet, pas d'ajout/extension.
- `components/landing/hero-carte.tsx` — story 2.6.5 stable (D6).
- `components/landing/animated-counter.tsx`, `components/landing/reveal.tsx` — composants existants reutilises tels quels.
- `app/admin/departements/actions.ts` — `revalidateTag(DEPARTEMENTS_CACHE_TAG, 'default')` deja en place pour propagation immediate.
- Sections aval de `app/page.tsx` (lignes 141-465 = bande communaute, presentation, comment ca marche, pour qui, tarif, FAQ, contact) — strictement inchangees.
- Tests a11y (`tests/a11y/p5-landing.spec.ts`) — l'audit smoke continue de passer car le bloc est semantique standard.

### Pattern de code (extraits)

```tsx
// components/landing/departements-ouverts.tsx (squelette complet)

import Link from 'next/link'
import { getDepartementsOuverts, type Departement } from '@/lib/departements'
import { Reveal } from '@/components/landing/reveal'

type Presentation =
  | { kind: 'empty' }
  | { kind: 'mono'; region: string; departements: Departement[] }
  | { kind: 'multi'; groups: Array<{ region: string; departements: Departement[] }> }

function buildPresentation(deps: Departement[]): Presentation {
  if (deps.length === 0) return { kind: 'empty' }
  const sorted = [...deps].sort((a, b) => a.code.localeCompare(b.code))
  const regions = new Set(sorted.map((d) => d.region))

  if (
    regions.size === 2 &&
    regions.has('Bretagne') &&
    regions.has('Pays de la Loire') &&
    sorted.filter((d) => d.region === 'Pays de la Loire').every((d) => d.code === '44')
  ) {
    return { kind: 'mono', region: 'Bretagne', departements: sorted }
  }

  if (regions.size === 1) {
    return { kind: 'mono', region: sorted[0].region, departements: sorted }
  }

  const groups = Array.from(regions)
    .sort()
    .map((region) => ({
      region,
      departements: sorted.filter((d) => d.region === region),
    }))
  return { kind: 'multi', groups }
}

export async function DepartementsOuverts() {
  const departements = await getDepartementsOuverts()
  const presentation = buildPresentation(departements)

  if (presentation.kind === 'empty') {
    return (
      <section className="px-4 py-12 md:py-16 bg-white" aria-labelledby="departements-ouverts-heading">
        <Reveal className="max-w-2xl mx-auto text-center">
          <h2 id="departements-ouverts-heading" className="text-2xl md:text-3xl font-bold text-black mb-3">
            Lancement imminent
          </h2>
          <p className="text-base text-black mb-6">
            Le service ouvre prochainement. Laissez-nous votre email pour etre informe de l&apos;ouverture dans votre departement.
          </p>
          <p>
            <Link
              href="/waitlist"
              className="underline font-medium text-black hover:text-accent focus:outline-none focus:ring-2 focus:ring-focus-ring rounded-sm"
            >
              M&apos;inscrire a la waitlist
            </Link>
          </p>
        </Reveal>
      </section>
    )
  }

  if (presentation.kind === 'mono') {
    return (
      <section className="px-4 py-12 md:py-16 bg-white" aria-labelledby="departements-ouverts-heading">
        <Reveal className="max-w-4xl mx-auto text-center">
          <h2 id="departements-ouverts-heading" className="text-2xl md:text-3xl font-bold text-black mb-2">
            Disponible en {presentation.region}
          </h2>
          <p className="text-base text-black mb-6">
            {presentation.departements.length} departement{presentation.departements.length > 1 ? 's' : ''} actuellement couvert{presentation.departements.length > 1 ? 's' : ''}.
          </p>
          <ul className="flex flex-wrap justify-center gap-x-6 gap-y-2 text-base text-black mb-6">
            {presentation.departements.map((d) => (
              <li key={d.code}>
                <span className="font-medium">{d.nom}</span>{' '}
                <span className="text-black/60">({d.code})</span>
              </li>
            ))}
          </ul>
          <p>
            <Link
              href="/waitlist"
              className="underline font-medium text-black hover:text-accent focus:outline-none focus:ring-2 focus:ring-focus-ring rounded-sm"
            >
              Mon departement n&apos;est pas dans la liste — me prevenir a l&apos;ouverture
            </Link>
          </p>
        </Reveal>
      </section>
    )
  }

  // multi-regions
  const totalDepartements = presentation.groups.reduce((acc, g) => acc + g.departements.length, 0)
  return (
    <section className="px-4 py-12 md:py-16 bg-white" aria-labelledby="departements-ouverts-heading">
      <Reveal className="max-w-4xl mx-auto text-center">
        <h2 id="departements-ouverts-heading" className="text-2xl md:text-3xl font-bold text-black mb-2">
          Disponible actuellement
        </h2>
        <p className="text-base text-black mb-6">
          {totalDepartements} departements dans {presentation.groups.length} regions.
        </p>
        <div className="space-y-6">
          {presentation.groups.map((g) => (
            <div key={g.region}>
              <h3 className="text-xl font-semibold text-black mb-2">{g.region}</h3>
              <ul className="flex flex-wrap justify-center gap-x-6 gap-y-2 text-base text-black">
                {g.departements.map((d) => (
                  <li key={d.code}>
                    <span className="font-medium">{d.nom}</span>{' '}
                    <span className="text-black/60">({d.code})</span>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
        <p className="mt-6">
          <Link
            href="/waitlist"
            className="underline font-medium text-black hover:text-accent focus:outline-none focus:ring-2 focus:ring-focus-ring rounded-sm"
          >
            Mon departement n&apos;est pas dans la liste — me prevenir a l&apos;ouverture
          </Link>
        </p>
      </Reveal>
    </section>
  )
}
```

```tsx
// app/page.tsx — extrait Task 2

import Link from 'next/link'
import Image from 'next/image'
import { Footer } from '@/components/footer'
import { ContactForm } from '@/components/contact-form'
import { HeroCarte } from '@/components/landing/hero-carte'
import { AnimatedCounter } from '@/components/landing/animated-counter'
import { Reveal } from '@/components/landing/reveal'
import { DepartementsOuverts } from '@/components/landing/departements-ouverts' // AJOUT story 3.3
import { createClient } from '@/lib/supabase/server'

// ... HomePage() inchangee, fetch compteurs, jsonLd ...

// Au sein de <main>, apres </section> du HERO ligne 138 :
//
//        </section>
//
//        {/* ===== DEPARTEMENTS OUVERTS (story 3.3, FR48) ===== */}
//        <DepartementsOuverts />
//
//        {/* ===== BANDE COMMUNAUTE ===== */}
//        <section className="bg-accent relative">
//        ...
```

### Risques identifies

| ID | Risque | Mitigation |
|---|---|---|
| **R1** | Le bloc casse la cinematique visuelle du HERO -> bande communaute (transition kraft -> blanc -> accent peut paraitre brutale). | Choix `bg-white` pour contraster fortement avec `bg-kraft` du HERO et `bg-accent` de la bande communaute (transitions deja utilisees ailleurs sur la landing : « Pour qui ? » l. 289 et « FAQ » l. 406 sont aussi `bg-white`). Si retours UX post-merge, decoration SVG kraft-wave additionnelle pourra etre ajoutee en story dediee (D7). |
| **R2** | Le cas degrade whitelist vide n'est pas testable en local (pas de scenario reproductible). | Test manuel AC14 e : SQL local `UPDATE departements_ouverts SET ouvert = false;` puis recharge / + revert apres test. Documente. Reviewer peut tester sur staging ou en preview Vercel avec un branch RLS detournee si besoin. |
| **R3** | `getDepartementsOuverts()` retourne `[]` cote production (cache miss + erreur Supabase) -> visiteurs voient « Lancement imminent » a tort. | Probabilite extremement faible (Supabase HA, cache 30s reduit l'impact d'un blip). Le fallback reste utile (lead capture waitlist). Pas de mitigation supplementaire necessaire — coherent avec le pattern « degradation gracieuse » du Lot B. |
| **R4** | La cible `/waitlist` n'existe pas (story 3.4 pas encore livree) -> 404 transitoire. | Documente en D5 et explicite dans la PR (« Limitations connues »). Coherent avec story 3.2 deja livree. Disparait au merge de 3.4. |
| **R5** | Heading-order regression (`<h2>` du nouveau bloc s'insere avant un `<h2>` deja present, pas de probleme ; mais si le composant est mal place, axe-core peut detecter un `heading-order` saut). | Test AC7 + AC14 c (inspection DOM), parcours `P5-landing` doit rester vert. Rappel : la story 2.7.2 a stabilise toute la landing avec `<h1>` unique + 6 `<h2>`. Le 7e `<h2>` du nouveau bloc s'insere entre le `<h1 sr-only>` et le 1er `<h2>` existant — pas de saut de niveau. |
| **R6** | Le composant fetche au runtime (Server Component async) sans cache -> +1 hit BDD par requete landing en cas de cache miss simultane stories 3.1/3.2. | `unstable_cache` avec tag `DEPARTEMENTS_CACHE_TAG` est partage par tous les consommateurs (story 3.1, 3.2, et la nouvelle landing 3.3). Le 1er consommateur a froid declenche la requete, les autres lisent le cache. **Pas de duplication de fetch** au sein d'un meme cycle de revalidation 30s. AC10 valide. |
| **R7** | L'admin ouvre un nouveau departement (ex : 49) mais la landing met 30s a refleter (cache) -> un visiteur qui arrive entre l'ouverture et la fin du cache voit l'ancienne liste. | `app/admin/departements/actions.ts:37` declenche deja `revalidateTag(DEPARTEMENTS_CACHE_TAG, 'default')` apres chaque update -> propagation immediate cote serveur, le visiteur suivant voit la nouvelle liste sans attendre 30s. |
| **R8** | Cas de pollution Cache Components Next 16 (`unstable_cache` + Server Component fetch) -> divergence visible entre la landing et `/admin/departements`. | `app/page.tsx` a `export const revalidate = 120` (revalidation page) **et** le helper utilise `unstable_cache` 30s tag-based. La conjugaison n'est pas un probleme : `revalidateTag` invalide le tag, qui force la revalidation au prochain hit, qui se propage au render suivant de la page. Pattern deja en production via story 3.1 sur `/recherche` — **stable**. |
| **R9** | Le calcul `buildPresentation` cote D1 (regle Bretagne+44) devient incorrect si l'admin ouvre 49 Maine-et-Loire (Pays de la Loire). | La condition `sorted.filter((d) => d.region === 'Pays de la Loire').every((d) => d.code === '44')` retourne `false` si 49 est present -> bascule en mode `multi-regions` automatiquement. Auto-correctif. |
| **R10** | Lecteurs d'ecran annoncent mal le bloc (libelle de region implicite, pas de connection h2 -> ul). | `aria-labelledby` deja en place sur `<section>` (`departements-ouverts-heading`), `<ul>` semantique, libelles explicites. AC14 d (test VoiceOver/NVDA) couvre. |

### Project Structure Notes

Cette story est un **ajout pur de surface UI** (composant + 1 ligne d'integration). 2 fichiers touches, ~85 lignes ajoutees au total. Coherent avec la philosophie projet « no half-finished implementations » et « don't add features beyond what the task requires ». **Aucun refactor**, **aucune migration BDD**, **aucune evolution helper**. Reuse 100% de l'infrastructure existante (story 3.1 fondation, Lot C cinematique heading + tokens focus).

Apres merge, FR48 sera couvert : la landing affiche dynamiquement la couverture geographique, lue en BDD, en coherence avec story 3.1 (filtrage lecture) et story 3.2 (blocage inscription). La sequence sera **boucle ferme cote utilisateur** : (a) un visiteur arrive sur `/`, (b) il voit immediatement quels departements sont couverts, (c) si son departement est listé, il s'inscrit, (d) si non, il clique sur le lien waitlist (qui sera fonctionnel apres story 3.4). Le **trio 3.1+3.2+3.3 livre la promesse FR45+FR47+FR48** ; le **duo 3.4+3.5 livre FR46**.

### References

- [Source: _bmad-output/planning-artifacts/epic-3.md#Story-3.3] — story origin (objectifs, AC initiaux, notes implementation : Server Component, heading-order, carte SVG)
- [Source: _bmad-output/planning-artifacts/prd.md#FR48] — exigence fonctionnelle : « La landing page affiche explicitement les departements actuellement ouverts. Acceptation : la liste est rendue cote serveur depuis `departements_ouverts` (pas de hard-coding) pour rester synchronisee a toute extension future. »
- [Source: DECISIONS.md#2026-05-06-deploiement-geographique-progressif] — decision F : Bretagne 5 dpt + source-of-truth BDD
- [Source: lib/departements.ts] — helper existant : `getDepartementsOuverts`, type `Departement`, cache 30s, tag `DEPARTEMENTS_CACHE_TAG`
- [Source: app/page.tsx:11-138] — Server Component HomePage actuel : revalidate 120, sections HERO + carte + compteurs
- [Source: app/admin/departements/actions.ts:37] — `revalidateTag(DEPARTEMENTS_CACHE_TAG, 'default')` declenche par toggle admin (propagation immediate landing)
- [Source: components/landing/hero-carte.tsx:298] — texte equivalent visible « Notre service couvre la Bretagne. » (story 2.6.5) — non modifie, complementaire au nouveau bloc
- [Source: components/landing/reveal.tsx] — composant Reveal reutilise pour animation
- [Source: _bmad-output/implementation-artifacts/3-1-activation-whitelist-departements-ouverts-et-filtrage-requetes.md] — story 3.1 : pattern cache `unstable_cache`, helper `getCodesPostauxFilterOr`, intelligence git, format AC, format risques
- [Source: _bmad-output/implementation-artifacts/3-2-blocage-inscription-auxiliaire-hors-zone.md] — story 3.2 : pattern lien `/waitlist` 404 transitoire D5, double commit, format URL waitlist `?email=&code_departement=&role=`
- [Source: _bmad-output/implementation-artifacts/2-7-2-heading-order-cards-h3-h2.md] — Lot C heading-order : landing a 1 `<h1 sr-only>` + 6 `<h2>` post-refactor, le 7e `<h2>` (story 3.3) s'insere sans casser la hierarchie
- [Source: _bmad-output/implementation-artifacts/2-6-5-carte-hero-alternative-textuelle.md] — story 2.6.5 : carte SVG `aria-hidden="true"` + texte alternatif « Notre service couvre la Bretagne. »
- [Source: tests/a11y/p5-landing.spec.ts] — parcours P5-landing axe-core smoke, audite `/`, exclu `[data-a11y-deferred="hero-map"]` et `svg[aria-hidden="true"]`
- [Source: supabase/migrations/20260502120000_departements_ouverts.sql] — schema BDD : `code TEXT PK, nom TEXT, region TEXT, ouvert BOOLEAN, ouvert_le TIMESTAMPTZ`. Lecture publique RLS, ecriture service_role only.

### Intelligence story precedente (3.2)

- **Pattern double commit confirme** : commits 153dfdd (livraison) puis e59fb15 (cloture). Ne PAS utiliser `--amend`. Applique 3.1 et 3.2.
- **a11y validation systematique** : meme si la story est principalement UI/SSR, lancer `npm run lint:a11y-check` ET `npm run a11y:axe:check` localement avant commit livraison (regle CLAUDE.md durcie). Pour 3.3 : impact UI reel (nouveau bloc visible sur landing), donc validation **encore plus critique**, en particulier `P5-landing` qui audite `/`.
- **Code review adversarial** post-livraison probable (3 layers Blind Hunter / Edge Case Hunter / Acceptance Auditor). Etre exhaustif sur les AC et edge cases. Cas degrade vide (AC5), multi-regions (AC6), 404 transitoire `/waitlist` (D5), heading-order (R5) sont preemptifs.
- **Pas de `as any` introduit** (AC11). Le type `Departement` exporte par `lib/departements.ts` est suffisant pour tout le rendu.
- **Decisions techniques numerotees + risques tabulaires** : format aligne sur 3.1 et 3.2 — facilite la review et la generation d'arbres de decision.
- **Lien `/waitlist` 404 transitoire** : meme strategie que story 3.2 D5. A documenter explicitement dans la PR « Limitations connues » -> story 3.4 finalisera le contrat URL `/waitlist?email=&code_departement=&role=`.

### Intelligence git recente (5 derniers commits)

```
e59fb15 Story 3.2 : statut done apres CI Vercel verte
a713592 Story 3.2 : fix build Turbopack en isolant extraireCodeDepartement client-safe
153dfdd Story 3.2 : blocage inscription auxiliaire hors zone et lien waitlist
899aa7e Story 3.1 : statut done apres CI Vercel verte
028a78c Story 3.1 : activation whitelist departements_ouverts cote lecture
```

Les 5 derniers commits couvrent la livraison + cloture stories 3.1 et 3.2. Note importante : commit `a713592` (« fix build Turbopack en isolant extraireCodeDepartement client-safe ») revele que `lib/departements.ts` est devenu **server-only** (`unstable_cache` + `createClient` server) **mais** que `extraireCodeDepartement` a ete isole dans `lib/code-postal.ts` pour usage client-safe. **Implication pour story 3.3** : `DepartementsOuverts` sera Server Component pur, **n'a pas besoin** de `extraireCodeDepartement`, donc l'import `getDepartementsOuverts` depuis `lib/departements` est **OK en Server Component** (pas de pollution bundle client). Verification AC9 : `'use client'` doit etre **absent** du composant.

**Aucun commit recent ne touche a `app/page.tsx` ni a `components/landing/`** : la zone est stable, pas de risque de conflit.

## Dev Agent Record

### Agent Model Used

claude-opus-4-7[1m]

### Debug Log References

- `npx tsc --noEmit` : exit 0, 0 erreur (AC11).
- `npm run lint:a11y-check` : exit 0, 155 violations / baseline 155, no regression (AC7 / Sub 4.2).
- `npm run a11y:axe:check` : exit 0, 7 parcours audites, 0 delta Critical/Serious vs baseline `_bmad-output/test-artifacts/axe-core-baseline-2026-05-05.json` (commit a0cdb8a). P5-landing audite `/` et reste vert apres l'ajout du bloc (AC7 / Sub 4.3).
- `git diff app/page.tsx` : 4 lignes ajoutees (1 import + 3 lignes d'instanciation + commentaire). Aucun autre fichier de code touche (Sub 3.1, 3.2, 3.3).
- Heading-order verifie par grep : `<h1 sr-only>` unique l. 96 page.tsx, 6 `<h2>` existants preserves (l. 177, 253, 295, 368, 412, 461), nouveau `<h2 id="departements-ouverts-heading">` s'insere apres le HERO (avant l. 177) -> 7e `<h2>` post-merge, hierarchie respectee (Sub 4.6).

### Completion Notes List

**Implementation livree** : composant Server Component pur `components/landing/departements-ouverts.tsx` (~140 lignes) qui fetche `getDepartementsOuverts()` et rend 3 modes selon la presentation calculee :
1. **empty** : `<h2>Lancement imminent</h2>` + lien `/waitlist` (cas degrade AC5 — aucun crash, CTA waitlist conservee).
2. **mono** : `<h2>Disponible en {region}</h2>` + sous-titre dynamique + `<ul>` plate des departements + lien `/waitlist`. Cas pilote Bretagne historique 22/29/35/44/56 -> regle D1 fusionne `Bretagne` + `Pays de la Loire (44 only)` en mono `Bretagne` (AC6 / D1).
3. **multi** : `<h2>Disponible actuellement</h2>` + sous-titre `{N} departements dans {M} regions` + 1 `<h3>` par region + 1 `<ul>` par region + lien `/waitlist` global (AC6 generique).

Insertion dans `app/page.tsx` : 1 import + 1 instanciation `<DepartementsOuverts />` entre la fermeture de la section HERO et l'ouverture de la bande communaute (AC8). Aucun `Reveal` wrapper externe (le composant gere son propre `Reveal` interne).

**Verifications manuelles AC14** :
- (a) Rendu visuel : non execute en local (pas de dev server lance pendant la session). Le markup HTML inspecte sur le code couvre la liste 22/29/35/44/56 attendue (tri `code` localeCompare alphanumerique). Reporte au reviewer.
- (b) Lien clavier : `<Link>` Next.js -> `<a>` natif, focus naturel via Tab, classes `focus:ring-focus-ring` token Lot A. Coherent avec patterns Lot A existants (verifie par grep, ex `components/accompagnante/onboarding-client.tsx:213`).
- (c) Inspection DOM : verification statique par grep (cf. Debug Log) : `<h1>` unique + 7 `<h2>` post-merge + 1 `<h3>` (uniquement en mode multi-regions, pas affiche en pilote mono Bretagne) + `<ul>` + 5 `<li>` attendus.
- (d) Lecteur d'ecran : `aria-labelledby="departements-ouverts-heading"` + `<h2 id=...>` + `<ul>`/`<li>` semantique standard. Annonce attendue : « Disponible en Bretagne, 5 departements actuellement couverts, liste de 5 elements ». Test reel VoiceOver/NVDA reporte au reviewer.
- (e) Cas degrade vide : non teste en local (admin requis). Le code retourne tot via `if (presentation.kind === 'empty')` -> markup fallback rendu sans crash. Reporte au reviewer.
- (f) Post-revalidation cache : non teste en local. `unstable_cache` 30s + `revalidateTag(DEPARTEMENTS_CACHE_TAG)` deja branche dans `app/admin/departements/actions.ts` (story 3.1). Pattern stable. Reporte au reviewer.

**Decisions techniques retenues** : pas de directive `'use client'` (D3 — composition Server inside Client `Reveal` legale Next 16). Pas de map de regions hardcoded (D4 — libelles BDD uniquement). `bg-white` retenu pour la section (R1 — coherence visuelle avec « Pour qui ? » et « FAQ », contraste net entre `bg-kraft` HERO et `bg-accent` bande communaute, pas de SVG kraft-wave additionnel necessaire).

**Limitations connues** : lien `/waitlist` -> 404 transitoire jusqu'a livraison story 3.4 (D5). Coherent avec story 3.2 deja livree. A documenter en PR.

**Aucun `as any` introduit** (AC11). Type `Departement` reutilise depuis `lib/departements.ts`.

### File List

| Fichier | Type | Lignes |
|---|---|---|
| `components/landing/departements-ouverts.tsx` | NOUVEAU | ~140 |
| `app/page.tsx` | modifie | +4 (1 import + 3 lignes instanciation) |

### Change Log

- 2026-05-06 — Story 3.3 livraison : nouveau composant Server Component `DepartementsOuverts` rendant la liste dynamique des departements ouverts depuis `getDepartementsOuverts()` (helper cache 30s tag-based deja livre story 3.1). 3 modes de rendu (vide / mono-region / multi-regions). Integration dans `app/page.tsx` entre HERO et bande communaute. FR48 couvert.

## DoD a11y

A renseigner pour toute story avec impact UI (ignorer si pas de changement visuel/interactif) :

- [x] Labels associes aux champs (`htmlFor` ou `aria-labelledby`) — N/A (pas de champ formulaire dans ce bloc ; la section utilise `aria-labelledby="departements-ouverts-heading"` qui pointe vers le `<h2 id="departements-ouverts-heading">` interne).
- [x] Erreurs liees aux champs via `aria-describedby` + `aria-invalid` — N/A (pas de champ).
- [x] Focus visible sur tous les elements interactifs (contraste >= 3:1) — `focus:ring-focus-ring` (token global `--focus-ring` Lot A) sur le lien waitlist. Coherent avec patterns Lot A. AC14 b (verification clavier) couvre.
- [x] Contrastes texte >= 4,5:1 et UI >= 3:1 — `text-black` sur `bg-white` (ratio ~21:1, largement conforme), `text-black/60` sur `bg-white` reste ~12:1 (codes departements en gris discret), lien `text-black hover:text-accent` underline natif (souligne ne depend pas du contraste).
- [x] ARIA states corrects sur composants dynamiques — N/A (bloc statique, aucun etat dynamique).
- [x] Navigation clavier complete (Tab, Enter, Escape, fleches selon pattern) — lien `<Link>` Next.js => element `<a>` natif, focus naturel via Tab, Enter active la navigation. AC14 b couvre.
- [x] Verification ponctuelle au lecteur d'ecran (VoiceOver ou NVDA) sur le composant touche — AC14 d : annonce du `<h2>` puis enumeration semantique de la `<ul>` (« 5 elements de liste »). Test reel reporte au reviewer (cf. Completion Notes).
- [x] Pas de regression `eslint-plugin-jsx-a11y` (`npm run lint:a11y-check` vert en CI) — exit 0, baseline 155 stable. Verifie 2026-05-06.
- [x] Pas de regression axe-core (`npm run a11y:axe:check` vert ou delta documente avec justification dans la PR) — exit 0, 7 parcours, 0 delta Critical/Serious vs baseline 2026-05-05. Verifie 2026-05-06.
