# Story 3.1 : Activation whitelist `departements_ouverts` et filtrage requetes

Status: ready-for-dev

<!-- Note: Validation est optionnelle. Lancer `validate-create-story` avant `dev-story` pour un controle qualite. -->

## Story

En tant que **visiteur ou utilisateur connecte de roxanetnous (et Sylvain en tant que responsable produit du lancement Bretagne)**,
je veux **que la plateforme ne montre que les profils auxiliaires et annonces situes dans les 5 departements de la whitelist `departements_ouverts` (29, 22, 56, 35, 44)**,
afin de **ne pas creer de fausse promesse de service hors zone et de tenir l'engagement "Disponible en Bretagne" affiche en landing (FR48) tout en respectant la decision F (DECISIONS.md 2026-05-06)**.

Cette story est la **premiere story de l'Epic 3 "Lancement Bretagne"**. Elle implemente FR45 (filtrage cote lecture). Elle s'appuie sur les fondations deja livrees : table `departements_ouverts` (migration `20260502120000`), helper `lib/departements.ts` (`isDepartementOuvert`, `getCodesDepartementsOuverts`, `extraireCodeDepartement`, cache `unstable_cache` 30s + tag `DEPARTEMENTS_CACHE_TAG`), checks deja en place cote **ecriture** (server actions `app/actions/annonces.ts`, `app/actions/profile.ts`). **Le seul trou fonctionnel est cote lecture publique** — les visiteurs voient encore aujourd'hui des profils/annonces hors zone via `/recherche`, `/recherche/demandes`, `/recherche/[id]`, `sitemap.ts`.

## Acceptance Criteria

### AC fonctionnels (FR45)

1. **AC1 - Filtrage `/recherche` (annonces accompagnantes)** : Given la table `departements_ouverts` contient `(22, 29, 35, 44, 56)` avec `ouvert = true` (etat actuel migration), when un visiteur ou utilisateur connecte (anon, accompagne ou accompagnante) charge `/recherche` avec ou sans filtres, then la requete `from('annonces_accompagnantes')` retourne **uniquement** les annonces dont `code_postal` extrait sur 2 caracteres correspond a un code de la whitelist (incluant les 2 sources de la requete : la requete principale ligne 57 et la requete de matching ligne 162 dans `app/recherche/page.tsx`). Aucun profil hors Bretagne n'apparait dans la grille principale ni dans le bloc "Les accompagnantes que nous vous recommandons".

2. **AC2 - Filtrage `/recherche/[id]` (detail annonce)** : Given une annonce dont le `code_postal` est hors whitelist (ex : `75001`), when un visiteur tente d'acceder a son URL directe `/recherche/<id-hors-zone>`, then la page redirige vers `/recherche` (meme comportement que pour une annonce inexistante ou non publiee). Le filtre est applique **avant** ou **dans** la requete `from('annonces_accompagnantes').select(...).eq('id', id)` ligne 35.

3. **AC3 - Filtrage `/recherche/demandes` (annonces accompagnes vues par auxiliaires)** : Given un visiteur ou utilisateur connecte (anon ou accompagnante) charge `/recherche/demandes`, when la requete `from('annonces_accompagnes')` est executee (ligne 35), then **seules** les demandes dont `code_postal` est dans la whitelist sont retournees. Note : les demandes sans `code_postal` (`NULL`) sont **exclues** au pilote Bretagne (decision D2 ci-dessous).

4. **AC4 - Filtrage `notifyMatchingUsers` (lib/matching-notifications.ts)** : Given une nouvelle annonce accompagne est publiee (`createAnnonceAccompagne`), when `notifyMatchingUsers({annonceType: 'accompagne', ...})` charge `auxProfiles` ligne 37, then **seules** les accompagnantes dont `code_postal` est dans la whitelist sont candidates au scoring + email. Symetrique : when `notifyMatchingUsers({annonceType: 'accompagnante', ...})` charge `benAnnonces` ligne 117, then **seules** les annonces accompagnes dont `code_postal` est dans la whitelist sont candidates. Aucun email "nouveau profil" envoye a une accompagnante hors zone, aucun email "nouvelle annonce" envoye a un beneficiaire dont l'annonce est hors zone.

5. **AC5 - Filtrage `sitemap.ts`** : Given le sitemap `https://roxanetnous.fr/sitemap.xml` est genere, when la requete `from('annonces_accompagnantes')` ligne 23 charge les URLs `/recherche/[id]`, then **seules** les annonces dans la whitelist sont incluses. Pas de URL hors zone indexable par Google. (Coherence SEO + AC2 : eviter qu'une annonce reference par sitemap retourne une redirection.)

6. **AC6 - Pages admin non filtrees** : Given un admin (`users.role = 'admin'`) accede a `/admin/annonces`, when la page liste les annonces accompagnantes et accompagnes (lignes 19, 28, 32, 41 de `app/admin/annonces/page.tsx`), then **toutes** les annonces sont visibles, **y compris hors zone**. La whitelist ne s'applique **jamais** cote admin (verification de moderation, audit, validation justificatifs).

7. **AC7 - Listings utilisateur non filtres** : Given un utilisateur connecte accede a ses propres ressources (`/accompagnante/annonces`, `/accompagne/annonces`, `/accompagnante/dashboard`, `/accompagne/dashboard`, `/messages`, `/messages/[id]`, `/favoris`, `/recherche/[id]/page.tsx` favoris check), when ces pages chargent les annonces filtrees par `accompagnante_id = profile.id` ou `accompagne_id = profile.id` ou `id IN favoris`, then **aucun filtre whitelist n'est applique**. Rationale : un auxiliaire qui demenage hors zone doit pouvoir continuer a gerer ses annonces existantes (archiver, supprimer) ; un beneficiaire doit voir ses propres annonces et favoris meme si certains sont hors zone.

8. **AC8 - Idempotence du seed (rappel)** : Given la migration `20260502120000_departements_ouverts` insere deja les 96 departements + Corse (avec 22, 29, 35, 44, 56 a `ouvert=true`) via `INSERT INTO ... VALUES (...)`, when la migration est rejouee sur une base ou elle est deja appliquee, then aucune erreur (la migration n'est pas re-executee — Supabase suit le journal des migrations). **Pas d'INSERT supplementaire dans cette story** : la decision F est deja seeded. Si une re-application complete d'environnement est necessaire, un `INSERT ... ON CONFLICT (code) DO NOTHING` peut etre ajoute en migration corrective si besoin (hors scope par defaut, voir D3).

### AC techniques (qualite)

9. **AC9 - Helper centralise** : Given le filtrage whitelist doit s'appliquer a 6+ requetes, when le code est ecrit, then un **seul** helper de filtrage cote lecture est utilise (extension de `lib/departements.ts`) — pas de duplication de logique d'extraction de departement ni de fetch des codes ouverts. Reutiliser `getCodesDepartementsOuverts()` (cache `unstable_cache` 30s deja en place).

10. **AC10 - Type-check strict** : Given la regle CLAUDE.md "interdire `as any` introduit, resorber au passage" (rappel epic 2 candidat I), when le code de filtrage est ecrit, then aucun nouveau `as any` n'est introduit dans les fichiers modifies. Si un `as any` preexistant est touche, le **resorber au passage** si le typage est trivial.

11. **AC11 - Performance** : Given le cache `unstable_cache` 30s sur `getCodesDepartementsOuverts()`, when une page de recherche est rendue, then le filtre whitelist ajoute au plus **1 hit BDD par revalidation cache** (30s) et **0 round-trip supplementaire au runtime applicatif**. Le filtre Postgres se fait en append a la query existante (`OR` sur les prefixes code postal — voir Dev Notes).

12. **AC12 - Pas de regression a11y** : Given la regle CLAUDE.md durcie Lot C, when la story est livree, then `npm run lint:a11y-check` reste **vert** (baseline 155 ou nouveau baseline si justifie) et `npm run a11y:axe:check` reste **vert** (baseline 0 violations Critical/Serious sur 7 parcours, P3-recherche-anon-rgpd inclus). Le filtrage est purement BDD donc **aucune regression a11y attendue**, mais validation systematique.

13. **AC13 - Verification manuelle documentee** : Given la dette tests reportee Epic 4 (cf. epic-3.md "Notes implementation"), when la story est livree, then la PR contient une section "Verifications manuelles" listant : (a) une URL `/recherche?ville=Paris` qui retourne 0 annonce hors zone, (b) une URL `/recherche?ville=Brest` qui retourne au moins 1 annonce Bretagne (si data presente, sinon mock), (c) `/recherche/[id-hors-zone]` qui redirige, (d) `/admin/annonces` accessible et listant **tout** (en local avec un compte admin de test). Test automatise reporte Epic 4.

### AC commun Lot C (rappel CLAUDE.md durcie)

14. **AC commun 1** - DoD a11y cochee, delta axe-core mentionne (aucun delta attendu).

15. **AC commun 2** - Double commit : livraison (`Story 3.1 : activation whitelist departements_ouverts cote lecture`) puis cloture (`Story 3.1 : statut done apres CI Vercel verte`).

## Tasks / Subtasks

- [ ] **Task 1 — Etendre `lib/departements.ts` avec un helper de filtrage** (AC: #9, #11)
  - [ ] Sub 1.1 : Ajouter `export function buildCodesPostauxFilterOr(codesDepartements: string[]): string` qui retourne une chaine PostgREST utilisable dans `query.or(...)` du type `code_postal.like.22%,code_postal.like.29%,code_postal.like.35%,code_postal.like.44%,code_postal.like.56%`. Cas Corse : si `2A` ou `2B` dans la liste, ajouter `code_postal.like.20%`.
  - [ ] Sub 1.2 : Ajouter `export async function getCodesPostauxFilterOr(): Promise<string>` qui combine `getCodesDepartementsOuverts()` + `buildCodesPostauxFilterOr()`. Garde le cache existant (`unstable_cache` 30s).
  - [ ] Sub 1.3 : Cas degrade : si la whitelist est vide (0 codes ouverts), `getCodesPostauxFilterOr()` retourne une chaine qui ne match jamais (ex : `code_postal.eq.__none__`). Comportement attendu : 0 resultat plutot que crash. Documenter en commentaire.

- [ ] **Task 2 — Filtrer `/recherche` (page principale + matching)** (AC: #1)
  - [ ] Sub 2.1 : Dans `app/recherche/page.tsx`, importer `getCodesPostauxFilterOr` depuis `@/lib/departements`. Ajouter `const codesFilter = await getCodesPostauxFilterOr()` en tete de fonction (apres `await searchParams`).
  - [ ] Sub 2.2 : Sur la query principale ligne 57 (`supabaseAdmin.from('annonces_accompagnantes')...`), ajouter `.or(codesFilter)` apres `.eq('accompagnantes_profiles.validation_status', 'valide')`. **Important** : `.or()` PostgREST s'applique au niveau de la table principale (`annonces_accompagnantes.code_postal`), pas au join — c'est le comportement attendu (la position geographique de l'annonce, pas du profil).
  - [ ] Sub 2.3 : Sur la query de matching secondaire ligne 162 (chargee si `matchSourceAnnonces.length === 0`), ajouter le meme `.or(codesFilter)` au meme endroit.
  - [ ] Sub 2.4 : Verifier que le bloc "matchAnnonce" (recherche d'annonces beneficiaire ligne 136 `from('annonces_accompagnes')`) n'a pas besoin de filtre — c'est l'annonce **propre** du beneficiaire connecte qui sert de critere de matching, donc AC7 s'applique (pas de filtre).

- [ ] **Task 3 — Filtrer `/recherche/[id]`** (AC: #2)
  - [ ] Sub 3.1 : Dans `app/recherche/[id]/page.tsx`, importer `extraireCodeDepartement` et `isDepartementOuvert` depuis `@/lib/departements`.
  - [ ] Sub 3.2 : Apres la recuperation de `annonce` ligne 35-58, ajouter une garde : `if (annonce && !(await isDepartementOuvert(annonce.code_postal))) redirect('/recherche')`. L'utilisateur ne voit pas une page 404 mais retombe sur la liste filtree.
  - [ ] Sub 3.3 : Note : on garde la verif post-fetch plutot que d'integrer au `.eq()` — plus lisible, et evite que le profil voie son propre profil hors zone (cas accompagnante connectee qui aurait demenage : AC7). Acceptable car le coup de cette annonce restera marginal (1 annonce vs N).

- [ ] **Task 4 — Filtrer `/recherche/demandes`** (AC: #3)
  - [ ] Sub 4.1 : Dans `app/recherche/demandes/page.tsx`, importer `getCodesPostauxFilterOr`.
  - [ ] Sub 4.2 : Sur la query ligne 35, ajouter `.or(codesFilter)` apres `.eq('status', 'publiee')`. **Important** : `.or()` ici exclut automatiquement les annonces avec `code_postal IS NULL` (decision D2).

- [ ] **Task 5 — Filtrer `sitemap.ts`** (AC: #5)
  - [ ] Sub 5.1 : Dans `app/sitemap.ts`, importer `getCodesPostauxFilterOr`.
  - [ ] Sub 5.2 : Sur la query ligne 23, ajouter `.or(codesFilter)` apres `.eq('status', 'publiee')`. Garantit que les URLs sitemap restent coherentes avec ce qui est indexable (AC2 redirige les URLs hors zone).

- [ ] **Task 6 — Filtrer `lib/matching-notifications.ts`** (AC: #4)
  - [ ] Sub 6.1 : Dans `lib/matching-notifications.ts`, importer `getCodesPostauxFilterOr`.
  - [ ] Sub 6.2 : Branche `annonceType === 'accompagne'` : sur la query `from('accompagnantes_profiles')` ligne 37, ajouter `.or(codesFilter)`. Ainsi, seules les accompagnantes dont le profil est en zone sont candidates a la notification d'une nouvelle annonce.
  - [ ] Sub 6.3 : Branche `annonceType === 'accompagnante'` : sur la query `from('annonces_accompagnes')` ligne 117, ajouter `.or(codesFilter)`. Seules les annonces accompagnes en zone declenchent une notif vers les accompagnantes.
  - [ ] Sub 6.4 : Cas particulier : si l'annonce **source** elle-meme est hors zone (ne devrait pas arriver, AC `createAnnonce*` bloque deja), **early return** au debut de la fonction. Defense en profondeur. Pseudocode : `if (!(await isDepartementOuvert(annonce.code_postal))) return`.

- [ ] **Task 7 — Verifier que les pages admin restent non filtrees** (AC: #6)
  - [ ] Sub 7.1 : Lecture de `app/admin/annonces/page.tsx` (lignes 19, 28, 32, 41) : verifier qu'aucun filtre `.or(codesFilter)` n'est ajoute. Pas de modification de ces lignes.
  - [ ] Sub 7.2 : Test manuel : avec un compte admin, charger `/admin/annonces` et verifier qu'une annonce hors zone (creee manuellement avant l'activation) reste visible.

- [ ] **Task 8 — Verifier que les listings utilisateur restent non filtres** (AC: #7)
  - [ ] Sub 8.1 : Lecture (sans modification) de : `app/accompagnante/annonces/page.tsx`, `app/accompagne/annonces/page.tsx`, `app/accompagnante/dashboard/page.tsx`, `app/accompagne/dashboard/page.tsx`, `app/messages/page.tsx`, `app/messages/[id]/page.tsx`, `app/actions/favoris.ts`. Aucune modification — ces requetes filtrent deja par `user_id`/`profile.id`/`favoris.user_id`, ce qui est l'isolation correcte.
  - [ ] Sub 8.2 : Lire `app/actions/rgpd.ts` ligne 27-46 (export RGPD) : aucune modification — un utilisateur doit pouvoir exporter **toutes** ses donnees, hors zone incluse. AC7 explicite.

- [ ] **Task 9 — Verifications globales + DoD** (AC: #11, #12, #13)
  - [ ] Sub 9.1 : `npx tsc --noEmit` -> 0 erreur. AC10.
  - [ ] Sub 9.2 : `npm run lint:a11y-check` -> vert (baseline stable). AC12.
  - [ ] Sub 9.3 : `npm run a11y:axe:check` -> vert (baseline 0 Critical/Serious). AC12.
  - [ ] Sub 9.4 : `npm run test` (si tests existants ne plantent pas — verifier le scope tests Epic 1 livre).
  - [ ] Sub 9.5 : Tests manuels documentes en Completion Notes : AC13 (a, b, c, d).
  - [ ] Sub 9.6 : DoD a11y cochee (section finale).

- [ ] **Task 10 — Commits**
  - [ ] Sub 10.1 : Commit 1 livraison : `Story 3.1 : activation whitelist departements_ouverts cote lecture`. **A executer par l'utilisateur** (regle projet : Claude ne commit pas sans demande explicite).
  - [ ] Sub 10.2 : Push + CI Vercel verte. **A executer par l'utilisateur**.
  - [ ] Sub 10.3 : Commit 2 cloture : `Story 3.1 : statut done apres CI Vercel verte` (avec passage `Status: done`). **A executer par l'utilisateur** apres CI Vercel verte.

## Dev Notes

### Decisions techniques cles

#### D1 — Approche filtrage : `.or()` PostgREST sur prefix code_postal vs sous-requete

**Choix retenu** : `.or('code_postal.like.22%,code_postal.like.29%,...')` direct sur la query existante.

**Rationale** :
- Les codes departement (2 chars) sont les **2 premiers chars** des codes postaux (sauf Corse `20xxx` -> `2A`/`2B` traite a part). Le `LIKE 'XX%'` est un **index range scan** efficace meme sans index sur `code_postal` (toutes les lignes existent deja avec `code_postal NOT NULL` cote annonces).
- Pas de jointure sur `departements_ouverts` necessaire — la whitelist est lue une fois par revalidation cache (30s) puis materialisee dans la query.
- Coherent avec le pattern actuel du projet : aucune query existante ne joint `departements_ouverts`, c'est `lib/departements.ts` qui materialise les codes en memoire.

**Alternatives rejetees** :
- `WHERE code_postal IN (SELECT ...)` via Supabase RPC : ajoute une dependance BDD a cacher correctement, plus complexe a tester.
- Filtre cote application (post-fetch JS) : viole AC11 (perf), charge potentiellement N annonces puis en jette 90%, et ne fonctionne pas avec la pagination `range()` de `/recherche/demandes`.
- Trigger BDD ou RLS dynamique : sur-engineering, et incompatible avec AC6 (admin doit voir tout).

#### D2 — Annonces avec `code_postal NULL`

**Choix retenu** : exclure les annonces avec `code_postal IS NULL` du filtrage public (`.or()` PostgREST exclut naturellement les NULL).

**Rationale** :
- Au pilote Bretagne, une annonce sans code postal est inutile pour l'utilisateur (impossible de geo-cibler). Aucune raison metier de la montrer.
- `app/actions/annonces.ts:215` valide deja `code_postal.trim() !== ''` cote `createAnnonceAccompagne` — donc les nouvelles annonces auront forcement un code postal. Les NULL ne peuvent provenir que de l'historique pre-soft-paywall.
- Si une annonce historique a `code_postal NULL`, le proprietaire la verra toujours via AC7 (listings utilisateur non filtres) et pourra la mettre a jour.

**Alternative rejetee** : `.or('code_postal.is.null,code_postal.like.22%,...')` qui inclurait les NULL — risque de fuites visuelles d'annonces sans localisation, et deroge a la promesse "Disponible en Bretagne".

#### D3 — Pas de seed supplementaire dans cette story

La migration `20260502120000_departements_ouverts.sql` insere deja les 96 departements metropolitains + 2A/2B avec **22, 29, 35, 44, 56 ouverts** (lignes 72-75 et 146 du SQL). La story 3.1 **n'ajoute aucune migration** : elle se contente d'activer le filtre cote application qui consomme cette table.

Une story future pourra ajouter un `INSERT ... ON CONFLICT DO NOTHING` defensif si une procedure de seed re-applicable est jugee utile (typiquement reset d'environnement preview Vercel) — pour cette story, hors scope.

### Source tree fichiers a toucher (6)

| Fichier | Type | Modification |
|---|---|---|
| `lib/departements.ts` | extension | Ajouter `buildCodesPostauxFilterOr` + `getCodesPostauxFilterOr` |
| `app/recherche/page.tsx` | filtre | `.or(codesFilter)` sur 2 queries (ligne 57 + ligne 162) |
| `app/recherche/[id]/page.tsx` | redirect | Garde `isDepartementOuvert` post-fetch ligne 60 |
| `app/recherche/demandes/page.tsx` | filtre | `.or(codesFilter)` sur 1 query (ligne 35) |
| `app/sitemap.ts` | filtre | `.or(codesFilter)` sur 1 query (ligne 23) |
| `lib/matching-notifications.ts` | filtres | `.or(codesFilter)` sur 2 queries (ligne 37 et ligne 117) + early return |

**Fichiers explicitement non modifies** (verification statique requise — Sub 7.1, 8.1, 8.2) :
- `app/admin/**` — admin voit tout (AC6).
- `app/accompagnante/{annonces,dashboard}/page.tsx`, `app/accompagnante/annonces/[id]/modifier/page.tsx`, `app/accompagne/{annonces,dashboard}/page.tsx`, `app/accompagne/annonces/[id]/modifier/page.tsx` — listings/edition utilisateur (AC7).
- `app/messages/**` — messagerie (relations existantes).
- `app/actions/favoris.ts` — favoris deja ajoutes.
- `app/actions/rgpd.ts` — export RGPD complet.
- `app/actions/annonces.ts`, `app/actions/profile.ts` — checks ecriture deja en place via `isDepartementOuvert`.

### Pattern de code (exemple Task 1)

```ts
// lib/departements.ts (extension)

/**
 * Construit une chaine PostgREST `.or()` pour filtrer code_postal sur les
 * 2 premiers chars (= code departement). Cas Corse : 2A et 2B mappent vers
 * code_postal LIKE '20%'.
 *
 * Si la liste est vide, retourne un filtre qui ne match jamais (eq.__none__).
 */
export function buildCodesPostauxFilterOr(codesDepartements: string[]): string {
  if (codesDepartements.length === 0) {
    // Cas degrade : 0 departement ouvert -> 0 resultat plutot que crash.
    return 'code_postal.eq.__none__'
  }

  const prefixes = new Set<string>()
  for (const code of codesDepartements) {
    if (code === '2A' || code === '2B') {
      prefixes.add('20') // Corse : codes postaux 20xxx couvrent 2A et 2B
    } else {
      prefixes.add(code)
    }
  }

  return Array.from(prefixes)
    .map((p) => `code_postal.like.${p}%`)
    .join(',')
}

export async function getCodesPostauxFilterOr(): Promise<string> {
  const codes = await getCodesDepartementsOuverts()
  return buildCodesPostauxFilterOr(codes)
}
```

```ts
// app/recherche/page.tsx (extrait Task 2)

import { getCodesPostauxFilterOr } from '@/lib/departements'

// ... dans RecherchePage, apres `const params = await searchParams` ...
const codesFilter = await getCodesPostauxFilterOr()

// Query principale (ligne ~57) :
let query = supabaseAdmin
  .from('annonces_accompagnantes')
  .select(`...`)
  .eq('status', 'publiee')
  .eq('accompagnantes_profiles.validation_status', 'valide')
  .or(codesFilter) // <- AJOUT
  .order('published_at', { ascending: false })
```

### Pattern de code (exemple Task 3)

```ts
// app/recherche/[id]/page.tsx (extrait)

import { isDepartementOuvert } from '@/lib/departements'
// ... apres .single() ligne 58 ...

if (!annonce) redirect('/recherche')
if (!(await isDepartementOuvert(annonce.code_postal))) redirect('/recherche')
```

### Risques identifies

| ID | Risque | Mitigation |
|---|---|---|
| **R1** | `.or()` PostgREST mal forme casse la query (string injection ou quote manquant). | Ne jamais interpoler de variable utilisateur dans `codesFilter` — la chaine est construite uniquement depuis `getCodesDepartementsOuverts()` qui lit la BDD (codes 2 chars valides). Tests : verifier qu'un code postal hors zone retourne 0 resultat (Sub 9.5). |
| **R2** | Cache `unstable_cache` 30s -> ouverture d'un departement par admin met 30s a se propager au filtre. | Comportement actuel deja en place pour `isDepartementOuvert`. `app/admin/departements/actions.ts:38` appelle deja `revalidateTag(DEPARTEMENTS_CACHE_TAG, 'default')` apres toggle — invalidation est immediate via tag. Aucune action requise. |
| **R3** | Annonces existantes en BDD hors zone (data legacy avant pilote) : visibles avant l'activation, masquees apres. Risque d'effet "ou sont passes les profils ?" pour les utilisateurs deja inscrits hors zone. | Acceptation : le pilote Bretagne **n'a pas encore eu d'utilisateurs hors zone** (whitelist deja partielle dans la migration 20260502 : 5 codes ouverts). Si data legacy existe, AC7 garantit que le proprietaire continue a voir ses annonces dans son dashboard et peut archiver. Pas de communication user-facing requise pour cette story. |
| **R4** | Performance : 5 codes -> 5 conditions `OR` sur `code_postal`. Sur 100K annonces, scan sequentiel possible. | Pas un risque MVP (volume actuel ~10-50 annonces). Si volume croit, ajouter un index BTREE sur `code_postal` ou un index expression sur `LEFT(code_postal, 2)`. Hors scope story 3.1 — Epic 4 candidat. |
| **R5** | `notifyMatchingUsers` `annonceType === 'accompagne'` filtre `auxProfiles` mais pas le source `annonce` (sa source est cree via `createAnnonceAccompagne` qui valide deja le code postal — defense en profondeur via early return Sub 6.4). | Sub 6.4 explicite l'early return pour eviter qu'un bug futur (creation directe BDD, seed dev) declenche un email d'accompagnant pour une annonce hors zone. |
| **R6** | Une annonce `accompagne_id` lie a un profil hors zone reste filtree par `code_postal` mais le **profil** lui-meme l'est aussi (`accompagnes_profiles.code_postal`). Risque de double check ? | Non — on filtre uniquement sur la table de l'annonce (`annonces_accompagnes.code_postal`), pas sur le profil. C'est la **localisation de la mission** qui compte, pas le domicile du beneficiaire. Coherent avec le filtre symetrique sur `annonces_accompagnantes.code_postal`. |

### Project Structure Notes

Cette story est un **filtre additif minimal** : pas de nouvelle table, pas de nouveau composant UI, pas de nouvelle route. 6 fichiers touches, ~50 lignes ajoutees au total. Coherent avec la philosophie projet "no half-finished implementations" et "don't add features beyond what the task requires".

Apres merge, le projet aura un alignement complet sur la decision F (DECISIONS.md 2026-05-06) cote ecriture (deja en place) **et** cote lecture (objet de cette story). FR45 sera couvert. FR46-48 sont l'objet des stories 3.2-3.5 qui suivent.

### References

- [Source: _bmad-output/planning-artifacts/epic-3.md#Story-3.1] — story origin (objectifs, AC initiaux, notes implementation)
- [Source: DECISIONS.md#2026-05-06-deploiement-geographique-progressif] — decision F : Bretagne 5 dpt + regle "toute nouvelle feature touchant la geographie doit respecter la whitelist"
- [Source: _bmad-output/planning-artifacts/prd.md#FR45] — exigence fonctionnelle : "le systeme restreint la visibilite des profils auxiliaires et des annonces aux departements presents dans la whitelist"
- [Source: lib/departements.ts] — helper existant : `isDepartementOuvert`, `getCodesDepartementsOuverts`, `extraireCodeDepartement`, `DEPARTEMENTS_CACHE_TAG`, cache 30s
- [Source: supabase/migrations/20260502120000_departements_ouverts.sql] — table + RLS + seed (22, 29, 35, 44, 56 a `ouvert=true` lignes 72-75 et 146)
- [Source: app/admin/departements/actions.ts] — server actions admin avec `revalidateTag(DEPARTEMENTS_CACHE_TAG, 'default')` -> pas d'action de cache requise dans la story 3.1
- [Source: app/actions/annonces.ts:52,125,215,341] — checks `isDepartementOuvert` cote ecriture deja en place
- [Source: app/actions/profile.ts:49,211] — checks `isDepartementOuvert` cote inscription/profil deja en place
- [Source: _bmad-output/implementation-artifacts/2-7-6-refactor-main-pages-auth-jumelles.md] — story precedente (Lot C) : pattern double commit livraison + cloture, regle CLAUDE.md durcie
- [Source: _bmad-output/implementation-artifacts/mini-epic-2-7-retro-2026-05-06.md] — retro Lot C : convention validation a11y + verifications statiques

### Intelligence story precedente (2.7.6)

- **Pattern double commit** confirme et applique : `Story X.Y : <description>` -> attendre CI Vercel verte -> `Story X.Y : statut done apres CI Vercel verte`. Ne PAS utiliser `--amend` (cf. instructions globales).
- **a11y validation** : meme si la story est purement BDD/server, lancer `npm run lint:a11y-check` ET `npm run a11y:axe:check` localement avant commit livraison (regle CLAUDE.md).
- **Code review adversarial** post-livraison probable (3 layers Blind Hunter / Edge Case Hunter / Acceptance Auditor) — etre exhaustif sur les AC et les edge cases. AC8 (idempotence seed) et AC11 (perf) sont specifiquement la pour preempter des findings.
- **Pas de `as any` introduit** — regle Epic 4 candidat I deja appliquee de fait dans tout le code Lot C. Verifier au passage.

### Intelligence git recente (5 derniers commits)

```
5e5bde6 Re-run NFR a11y post-Lot C (AI-13) : statut done apres CI Vercel verte
ed2d362 Re-run NFR a11y post-Lot C (AI-13) : statut PASS avec reserves
c983d6c Retrospective Lot C : mini-epic 2.7 documentee
9f41675 Story 2.7.5 : statut done apres CI Vercel verte (cloture mini-epic 2.7 Lot C)
282a29c Story 2.7.4 : statut done apres CI Vercel verte
```

Les 5 derniers commits sont uniquement des cloture/retro Lot C (NFR a11y AI-13, mini-epic 2.7) — aucune modification recente du code de recherche, matching ou departements. Le code de `lib/departements.ts`, `app/recherche/*`, `lib/matching-notifications.ts` est stable, pas de risque de conflit avec un travail en cours.

## Dev Agent Record

### Agent Model Used

claude-opus-4-7[1m]

### Debug Log References

### Completion Notes List

### File List

## DoD a11y

A renseigner pour toute story avec impact UI (ignorer si pas de changement visuel/interactif) :

- [ ] Labels associes aux champs (`htmlFor` ou `aria-labelledby`) — N/A (story BDD/server, pas de modification UI/formulaire).
- [ ] Erreurs liees aux champs via `aria-describedby` + `aria-invalid` — N/A.
- [ ] Focus visible sur tous les elements interactifs (contraste >= 3:1) — N/A.
- [ ] Contrastes texte >= 4,5:1 et UI >= 3:1 — N/A.
- [ ] ARIA states corrects sur composants dynamiques — N/A.
- [ ] Navigation clavier complete (Tab, Enter, Escape, fleches selon pattern) — N/A.
- [ ] Verification ponctuelle au lecteur d'ecran (VoiceOver ou NVDA) sur le composant touche — N/A.
- [ ] Pas de regression `eslint-plugin-jsx-a11y` (`npm run lint:a11y-check` vert en CI) — **a verifier en pre-commit** (AC12).
- [ ] Pas de regression axe-core (`npm run a11y:axe:check` vert ou delta documente avec justification dans la PR) — **a verifier en pre-commit** (AC12).
