# Story 2.7.2 : Heading-order — cards `<h3>` -> `<h2>`

Status: review

<!-- Note: Validation est optionnelle. Lancer `validate-create-story` avant `dev-story` pour un controle qualite. -->

## Story

En tant que **utilisateur lecteur d'ecran (VoiceOver/NVDA) qui navigue par titres sur les pages internes de roxanetnous**,
je veux **que les sections principales des pages liste et detail soient annoncees comme `<h2>` au lieu de `<h3>`**,
afin de **disposer d'une hierarchie de titres lineaire (h1 -> h2 -> h3) qui me permet de sauter rapidement de section en section et de ne plus subir le saut h1 -> h3 (axe-core `heading-order`, severity `moderate`).**

Cette story finalise le compromis pragmatique du Lot B 2.6.7 explicitement reporte au Lot C : le Lot B a ajoute un `<h1>` unique au sommet de chaque page mais a laisse les cards et sections principales en `<h3>`, creant un saut de hierarchie. Cible : transformer ces `<h3>` en `<h2>` quand ils correspondent semantiquement a des sous-sections directes du `<h1>` de page.

## Acceptance Criteria

### AC commun Lot C (rappel tech-spec)

1. **AC commun 1** - `npm run lint:a11y-check` vert (baseline 155 stable, aucune nouvelle violation `jsx-a11y` introduite par le changement de niveau de titre).
2. **AC commun 2** - `npm run a11y:axe:check` vert (baseline 0 violations Critical/Serious sur 7 parcours preserve). La regle `heading-order` est `moderate` chez axe-core, hors baseline Critical/Serious — verifier neanmoins qu'elle disparait des warnings axe sur les parcours testes (P3-recherche, P5-favoris, P6-messagerie, P7-onboarding-aux qui auditent au moins une page de la liste cible).
3. **AC commun 3** - DoD a11y cochee.
4. **AC commun 4** - Double commit : livraison (`Story 2.7.2 : heading-order cards h3 -> h2`) puis cloture (`Story 2.7.2 : statut done apres CI Vercel verte`).

### AC propres a la Story 2.7.2

5. **AC1 - Inventaire pre-modification** : Given le repo a l'etat HEAD au demarrage de la story, when on execute `grep -rn '<h3' app | wc -l`, then le decompte est **enregistre dans la PR description** (decompte exhaustif AVANT modification, sub-task 1.0 obligatoire). Decompte attendu au demarrage = **56 occurrences dans 14 fichiers** (releve 2026-05-06, susceptible d'avoir bouge si commits intermediaires).

6. **AC2 - Decision case-par-case** : Given le decompte AC1, when le dev decide pour chaque `<h3>` s'il devient `<h2>` ou reste `<h3>`, then la **decision case-par-case** est documentee dans la PR description (~30-50 lignes : par fichier, ancien `<h3>`, nouveau `<h2>` OU laisse `<h3>` + une raison courte). Regle de decision (issue tech-spec) :
   - **Cards-data principales** ou **sections-detail principales** (sous-sections directes du `<h1>` de page) -> `<h2>`.
   - **Sous-sections d'une section deja titree par un `<h2>` parent** -> reste `<h3>`.
   - **Cards qui repetent un titre dynamique tronque** (`{annonce.titre}` dans une grille de cards de liste) -> reste `<h3>` si elles sont des items repetes a l'interieur d'une section deja titree par un `<h2>` parent (ou un `<h2>` ajoute par cette story).

7. **AC3 - Conservation du styling visuel** : Given un `<h3>` transforme en `<h2>`, when on compare le rendu visuel pre/post refactor, then **les classes Tailwind sont integralement preservees** (font-semibold, text-lg, text-2xl, mb-X, etc.). Verification visuelle : aucun changement de taille de police, de poids, de couleur ni d'espacement n'est attendu (les niveaux de titre HTML sont reset par le `globals.css` Tailwind v4 — la difference est uniquement semantique pour les lecteurs d'ecran).

8. **AC4 - Decompte post-modification** : Given le repo apres modification, when on execute `grep -rn '<h3' app | wc -l`, then le decompte est **strictement inferieur** au decompte AC1, et la difference correspond exactement au nombre de transformations documentees dans la decision AC2.

9. **AC5 - Pas de doublon `<h2>`** : Given chaque page modifiee, when on liste les `<h2>` post-modification, then **aucun `<h2>` n'est duplique** au sein d'une meme section semantique. Verification : sur les 3 pages qui ont **deja** un (ou des) `<h2>` (`app/accompagne/dashboard/page.tsx` h2=1, `app/accompagnante/dashboard/page.tsx` h2=1, `app/page.tsx` h2=6), la cohabitation `<h2>` deja present + `<h2>` issu de transformation est verifiee semantiquement (pas de niveau brise).

10. **AC6 - Pas de regression visuelle** : verification au navigateur post-refactor que le style Tailwind reste identique pour chaque `<h2>` issu d'une transformation. Pas de screenshot obligatoire (changement minime), mais navigation visuelle des 14 pages cible attendue.

11. **AC7 - Pas de regression a11y** : `npm run lint:a11y-check` vert (baseline 155 stable) ET `npm run a11y:axe:check` vert (baseline 0 Critical/Serious). Toute modification du baseline est documentee dans la PR.

## Tasks / Subtasks

- [x] **Task 1 - Inventaire pre-modification** (AC: #5)
  - [x] Sub 1.1 : Executer `grep -rn '<h3' app | wc -l` -> enregistrer le decompte initial (cible 56 ou actuel si commits intermediaires). **Resultat : 56** (identique au releve 2026-05-06).
  - [x] Sub 1.2 : Executer `grep -rn '<h3' app | sort` -> capturer la liste exhaustive `fichier:ligne -> contenu` dans la PR description. Liste capturee dans Dev Agent Record ci-dessous.
  - [x] Sub 1.3 : Pour chaque fichier, capturer egalement les `<h1>` et `<h2>` existants pour fonder la decision (AC2). Utile : `for f in <liste>; do echo "==> $f"; grep -nE '<h[1-3]' "$f"; done`. Inventaire h1/h2/h3/h4 capture pour les 14 fichiers.

- [x] **Task 2 - Decision case-par-case** (AC: #6)

  Construire la **table de decision** dans la PR description en s'appuyant sur l'inventaire ci-dessous (releve 2026-05-06, **NE PAS RECOPIER AVEUGLEMENT — re-verifier au demarrage de la story**) :

  ### Inventaire 2026-05-06 (ground truth a re-verifier)

  | Fichier | h1 | h2 | h3 | Recommandation par defaut |
  |---|---|---|---|---|
  | `app/accompagnante/annonces/page.tsx` | 1 | 0 | 1 | h3 « Abonnement requis » -> **h2** (sous-section unique du h1, structure « hub paywall ») |
  | `app/accompagnante/dashboard/page.tsx` | 1 | 1 | 12 | Cas mixte : un `<h2>` deja present, 12 `<h3>` cards. Regle : les cards directement sous le `<h1>` deviennent `<h2>` ; celles sous le `<h2>` existant restent `<h3>`. Verifier la structure DOM precise au moment du refactor. |
  | `app/accompagnante/profil/page.tsx` | 1 | 0 | 1 | h3 « Mes données personnelles » -> **h2** |
  | `app/accompagne/annonces/page.tsx` | 1 | 0 | 1 | h3 `{annonce.titre}` (item de liste de cards) -> ambiguous : si la liste a un wrapper semantique non-titre, pertinent de **laisser `<h3>`** ET d'ajouter un `<h2>` parent « Mes annonces » au-dessus. Decision dev. Default conservatif : **laisser `<h3>`** (eviter `<h2>` repete par item). |
  | `app/accompagne/dashboard/page.tsx` | 1 | 1 | 7 | Cas mixte (cf. dashboard accompagnante). |
  | `app/accompagne/profil/page.tsx` | 1 | 0 | 1 | h3 « Mes données personnelles » -> **h2** |
  | `app/admin/page.tsx` | 1 | 0 | 1 (+ 3 h4) | h3 « Accompagnantes en cours de validation » -> **h2**. Les h4 restent h4 (ou montent en h3 selon decision dev — defaut conservatif : laisser h4). |
  | `app/admin/utilisateurs/[id]/page.tsx` | 1 | 0 | 10 | **Tous les 10 h3 -> h2** (sections principales du detail utilisateur : Visio, Refus, Informations personnelles, Localisation, Profil pro, Specialites, Disponibilites, Description, Justificatifs, Abonnement). Verifier qu'aucun h3 n'est en sous-section reelle. |
  | `app/admin/validation/[id]/page.tsx` | 1 | 0 | 6 | **Tous les 6 h3 -> h2** (sections principales du dossier validation). |
  | `app/favoris/page.tsx` | 1 | 0 | 1 | h3 `{annonce.titre}` (item de liste de cards) -> meme dilemme que `accompagne/annonces/page.tsx`. Default : **laisser `<h3>`** sauf si liste sous un `<h2>` ajoute. |
  | `app/page.tsx` | 1 | 6 | 5 | Cas particulier landing : pas de modification recommandee si la structure h1 -> h2 -> h3 est deja coherente avec les blocs visuels. **Verifier** : si les 5 h3 (« Accompagnant(e)s », « Accompagné(e)s et proches », « Mensuel », « Annuel », un autre dans `feature.title`) sont sous des `<h2>` parents existants, **laisser `<h3>`**. Risque de derive +30 % si touche sans verification. |
  | `app/recherche/[id]/page.tsx` | 1 | 0 | 7 | **Tous les 7 h3 -> h2** (sections principales du detail accompagnante : Description, A propos, Specialites, Disponibilites, Informations, Contacter, Interesse). |
  | `app/recherche/demandes/page.tsx` | 1 | 0 | 1 | h3 `{annonce.titre}` (item de liste) -> meme dilemme. Default : **laisser `<h3>`**. |
  | `app/recherche/page.tsx` | 1 | 0 | 2 | h3 « Les accompagnantes que nous vous recommandons » + « Tous les accompagnantes » -> **h2 les deux** (sections principales de la liste recherche). |

  - [x] Sub 2.1 : Pour chaque fichier de l'inventaire, valider/ajuster la recommandation par defaut a la lumiere du DOM reel. Analyse DOM detaillee effectuee sur les 3 cas mixtes (`accompagnante/dashboard`, `accompagne/dashboard`, `app/page.tsx`).
  - [x] Sub 2.2 : Compiler la table de decision finale dans la PR description. Table compilee dans Dev Agent Record ci-dessous.
  - [x] Sub 2.3 : Si une decision implique d'**ajouter** un `<h2>` parent sur une liste de cards (cas `accompagne/annonces`, `favoris`, `recherche/demandes`) — **out of scope par defaut**. Default conservatif applique : laisser ces 3 cards `{titre}` en `<h3>` sans creer de `<h2>` artificiel.

- [x] **Task 3 - Application h3 -> h2** (AC: #2, #3, #5)
  - [x] Sub 3.1 : Editer chaque fichier ciblé selon la table de decision Task 2. Conserver **integralement** les classes Tailwind (font-semibold, text-lg, text-2xl, mb-X, etc.). Aucun sed naif applique : tous les Edit ont ete cibles fichier par fichier (replace_all utilise uniquement quand le pattern entier etait specifique au fichier et non present dans les fichiers exclus).
  - [x] Sub 3.2 : Pour les 3 dashboards/page.tsx en cas mixte (`accompagnante/dashboard`, `accompagne/dashboard`, `app/page.tsx`) : analyse DOM effectuee. Decision : `app/page.tsx` exclu (les 5 h3 sont sous des h2 parents existants). Les 12 + 7 h3 des deux dashboards sont des cards freres directs du h1, transformees en h2 (h2 "Nom Prenom" deja present reste tel quel comme titre carte profil avatar — frere des autres h2).
  - [x] Sub 3.3 : Sur les pages avec h4 (`app/admin/page.tsx`) : h4 laisses intacts (defaut conservatif). Le seul h3 du fichier (ligne 97) transforme en h2.

- [x] **Task 4 - Verifications** (AC: #4, #7)
  - [x] Sub 4.1 : `grep -rn '<h3' app | wc -l` post-modification — verifier l'ecart correspond a la decision Task 2. **Resultat : 8** (= 56 - 48 transformations conformes a la table de decision).
  - [x] Sub 4.2 : `npx tsc --noEmit` (typage OK). **Resultat : TypeScript compilation completed**.
  - [x] Sub 4.3 : `npm run lint:a11y-check` -> doit etre vert (baseline 155 stable). **Resultat : OK 155 violations across 56 (file, rule) pair(s). Baseline total 155. No regression.**
  - [x] Sub 4.4 : `npm run a11y:axe:check` -> doit etre vert (baseline 0 Critical/Serious). **Resultat : OK aucun delta Critical/Serious au-dela du baseline.** La regle `heading-order` est `moderate` chez axe-core et n'apparaissait deja pas en Critical/Serious dans le baseline ; le rapport d'execution n'a pas signale de delta sur cette regle.
  - [ ] Sub 4.5 : Verification visuelle navigateur sur les 14 pages cible (ou au moins les 7 dont la table de decision a applique au moins une transformation) — aucune regression de taille/poids/couleur attendue. **A executer par l'utilisateur** (pas executable en dev-story).

- [x] **Task 5 - DoD a11y + commits**
  - [x] Sub 5.1 : DoD a11y cochee ci-dessous.
  - [ ] Sub 5.2 : Commit 1 livraison (`Story 2.7.2 : heading-order cards h3 -> h2`). **A executer par l'utilisateur** (regle projet : Claude ne commit pas sans demande explicite).
  - [ ] Sub 5.3 : Push + CI Vercel verte. **A executer par l'utilisateur**.
  - [ ] Sub 5.4 : Commit 2 cloture (`Story 2.7.2 : statut done apres CI Vercel verte`, `Status: done` dans le fichier story). **A executer par l'utilisateur** apres CI verte.

## Dev Notes

### Origine de la story

Compromis Lot B 2.6.7 explicitement reporte Lot C par le tech-spec (`tech-spec-lot-c-a11y.md` ligne 53). Lot B a ajoute un `<h1>` unique a chaque page mais a laisse les cards et sections en `<h3>` (saut h1 -> h3, regle axe-core `heading-order` severity `moderate`, hors baseline Critical/Serious mais detectable).

### Pattern reference (issue tech-spec)

**Avant** (`app/admin/utilisateurs/[id]/page.tsx`) :

```tsx
<h1>Nom utilisateur</h1>
{/* ... */}
<h3 className="text-sm font-semibold text-gray-500 uppercase tracking-wide mb-4">Informations personnelles</h3>
```

**Apres** :

```tsx
<h1>Nom utilisateur</h1>
{/* ... */}
<h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wide mb-4">Informations personnelles</h2>
```

Aucune classe Tailwind retiree. Aucun nouveau wrapper HTML cree. Changement purement semantique.

### Realites projet (rappel, issu tech-spec Lot C)

- Tailwind v4 CSS-only : les niveaux de titre HTML (h1..h6) **sont resets** par `@layer base` dans `globals.css` — aucun changement de taille/poids/couleur n'est attendu visuellement quand on transforme un `<h3>` en `<h2>` qui conserve les memes classes.
- Pas de tests Playwright dedies a la regle `heading-order` (axe-core `moderate` n'echoue pas sur baseline Critical/Serious actuel). La verification est manuelle par grep + visuelle.
- Pas de fichier `sprint-status.yaml` dans ce projet (workflow `bmad-create-story` saute cette etape — confirme tech-spec ligne 36).

### Decompte et seuil de derive (mitigation pattern 2.5.5)

**Decompte initial (2026-05-06)** : 56 occurrences `<h3>` dans 14 fichiers. Le tech-spec annoncait « ~10 pages porteuses, ~20 occurrences » (`tech-spec-lot-c-a11y.md` ligne 81) — l'inventaire reel est **plus large** (+180 % sur les occurrences) mais la majorite des cas tombent sous la regle « laisser `<h3>` » (cards-items repetes, h3 deja sous un `<h2>` parent, page d'accueil structuree). **Estimation realiste de transformations** : ~25-30 sur 56. Cible Lot C minimaliste : ne pas etendre artificiellement.

**Sub-task 1.0 obligatoire** = inventaire grep avant modification (mitigation pattern 2.5.5 : « Inventaire fait foi sur les decomptes »). Si l'inventaire au demarrage diffère de 56, **mettre a jour la table de decision Task 2 en consequence**.

### Source tree fichiers a toucher (jusqu'a 14)

Liste exhaustive issue de l'inventaire 2026-05-06 (a re-verifier au demarrage Sub-task 1.1) :

- `app/accompagnante/annonces/page.tsx` (1 h3)
- `app/accompagnante/dashboard/page.tsx` (12 h3)
- `app/accompagnante/profil/page.tsx` (1 h3)
- `app/accompagne/annonces/page.tsx` (1 h3)
- `app/accompagne/dashboard/page.tsx` (7 h3)
- `app/accompagne/profil/page.tsx` (1 h3)
- `app/admin/page.tsx` (1 h3 + 3 h4)
- `app/admin/utilisateurs/[id]/page.tsx` (10 h3)
- `app/admin/validation/[id]/page.tsx` (6 h3)
- `app/favoris/page.tsx` (1 h3)
- `app/page.tsx` (5 h3 — landing, possible exclusion totale)
- `app/recherche/[id]/page.tsx` (7 h3)
- `app/recherche/demandes/page.tsx` (1 h3)
- `app/recherche/page.tsx` (2 h3)

### Risques identifies

| ID | Risque | Mitigation |
|---|---|---|
| **R1** (haut) | Derive +30 % via sed naif `<h3` -> `<h2` global. Pattern 2.5.5. | Sub-task 1.0 obligatoire (decompte exhaustif). Edits ciblees uniquement. Decision case-par-case Task 2 enregistree dans la PR description. |
| **R2** (moyen) | Cas mixtes (3 fichiers avec `<h2>` deja present : `accompagnante/dashboard`, `accompagne/dashboard`, `app/page.tsx`) — risque de creer une hierarchie incoherente (h1 > h2 > h2 sans groupement) si transformation aveugle. | Task 3 Sub 3.2 : analyse DOM serieuse avant modification. Default sur ces 3 fichiers : ne **pas** modifier sauf decision explicite documentee. |
| **R3** (moyen) | Cards-items dans des grilles (`{annonce.titre}` x N) — si transformees en `<h2>`, on duplique le `<h2>` au sein d'une meme section. | AC5 enforce : pas de `<h2>` repete par item. Default : laisser `<h3>` sur ces cards (Task 2 Sub 2.3). |
| **R4** (faible) | Le styling Tailwind se casse sur le nouveau `<h2>` (heritage `@layer base` Tailwind v4). | AC3 : conservation integrale des classes. Verification visuelle Sub 4.5. |
| **R5** (faible) | La regle `heading-order` ne disparait pas des warnings axe-core post-modification (ex : un `<h3>` oublie sous un `<h1>` direct). | Sub 4.4 : verifier le rapport axe-core. Si la regle persiste, identifier le fichier responsable et trancher en code review. |

### Project Structure Notes

Cette story est **mecanique** et touche uniquement le niveau semantique HTML. Aucun nouveau composant. Aucun changement de logique. Aucun changement de styling visuel.

### Convention `<h1>` unique par page (heritage Lot B 2.6.7)

Cette story **ne touche pas aux `<h1>`**. Le garde-fou Lot B post-2.6.7 reste : `find app -name 'page.tsx' | xargs grep -L '<h1' | wc -l = 0`. A re-verifier en fin de story (`Sub 4.x`).

### References

- [Source: _bmad-output/implementation-artifacts/tech-spec-lot-c-a11y.md#story-2-7-2--heading-order--cards-h3-h2] — pattern et regle de decision
- [Source: _bmad-output/planning-artifacts/inventaire-points-usage-lot-c-2026-05-06.md#272--heading-order--cards-h3-h2] — inventaire detaillé pages porteuses
- [Source: _bmad-output/implementation-artifacts/2-7-1-refactor-main-pages-client.md] — story precedente Lot C (pattern double commit livraison + cloture)
- [Source: _bmad-output/implementation-artifacts/2-7-6-refactor-main-pages-auth-jumelles.md] — story livree juste avant 2.7.2 (rappel : double commit, AC commun Lot C, baseline 155/0)
- [Source: _bmad-output/planning-artifacts/audit-a11y-2026-05-04.md] — audit NFR D1 (hierarchie heading)

## Dev Agent Record

### Agent Model Used

claude-opus-4-7[1m]

### Debug Log References

#### Inventaire pre-modification (2026-05-06, demarrage de la story)

```
$ grep -rn '<h3' app | wc -l
56

$ grep -rn '<h3' app | sort
app/accompagnante/annonces/page.tsx:66 (1)
app/accompagnante/dashboard/page.tsx:159, 179, 191, 203, 226, 241, 297, 318, 331, 344, 358, 374 (12)
app/accompagnante/profil/page.tsx:125 (1)
app/accompagne/annonces/page.tsx:83 (1)
app/accompagne/dashboard/page.tsx:125, 138, 151, 165, 178, 191, 204 (7)
app/accompagne/profil/page.tsx:59 (1)
app/admin/page.tsx:97 (1, + 3 h4 lignes 189, 270, 280)
app/admin/utilisateurs/[id]/page.tsx:203, 230, 238, 266, 308, 333, 352, 389, 401, 420 (10)
app/admin/validation/[id]/page.tsx:104, 131, 160, 172, 182, 256 (6)
app/favoris/page.tsx:124 (1)
app/page.tsx:267, 306, 325, 369, 385 (5)
app/recherche/[id]/page.tsx:148, 154, 160, 172, 216, 247, 255 (7)
app/recherche/demandes/page.tsx:113 (1)
app/recherche/page.tsx:277, 382 (2)
```

Total : 56 occurrences dans 14 fichiers (releve identique au releve tech-spec du 2026-05-06).

### Completion Notes List

#### Table de decision finale (Task 2, AC2)

| Fichier | h3 av. | Action | Justification (DOM) |
|---|---:|---|---|
| `app/accompagnante/annonces/page.tsx` | 1 | h3 -> h2 | Sous-section unique du h1 (« Mes annonces »). Pas de h2 parent. |
| `app/accompagnante/dashboard/page.tsx` | 12 | 12x h3 -> h2 | h1 sr-only « Tableau de bord » > carte profil avatar (h2 « Nom Prenom » ligne 109, frere) + 12 cards (toutes freres directs du h1, dans grilles `grid-cols-2`). Pas de hierarchie h2 > h3 a preserver. |
| `app/accompagnante/profil/page.tsx` | 1 | h3 -> h2 | Sous-section unique du h1 (« Mon profil »). Pas de h2 parent. |
| `app/accompagne/annonces/page.tsx` | 1 | **laisse h3** | Card-item `{annonce.titre}` repete dans une grille. Default conservatif (Sub 2.3) : ne pas creer de h2 parent artificiel. |
| `app/accompagne/dashboard/page.tsx` | 7 | 7x h3 -> h2 | Idem dashboard accompagnante : carte profil avatar (h2 ligne 75) + 7 cards freres du h1. |
| `app/accompagne/profil/page.tsx` | 1 | h3 -> h2 | Sous-section unique du h1 (« Mon profil »). |
| `app/admin/page.tsx` | 1 | h3 -> h2 | Section principale « Accompagnantes en cours de validation » sous h1. h4 Repartition / MRR / Resiliations laisses intacts (defaut conservatif Sub 3.3). |
| `app/admin/utilisateurs/[id]/page.tsx` | 10 | 10x h3 -> h2 | Sections principales du detail utilisateur (Visio, Refus, Informations, Localisation, Profil pro, Specialites, Disponibilites, Description, Justificatifs, Abonnement) toutes sous h1 sans h2 intermediaire. |
| `app/admin/validation/[id]/page.tsx` | 6 | 6x h3 -> h2 | Sections principales du dossier validation (Informations, Profil pro, Specialites, Description, Justificatifs, Visio) toutes sous h1 sans h2 intermediaire. |
| `app/favoris/page.tsx` | 1 | **laisse h3** | Card-item `{annonce.titre}` repete dans une grille. Default conservatif. |
| `app/page.tsx` | 5 | **laisse h3** (5/5) | Hierarchie deja coherente : 6 h2 parents (« Comment ca marche », « Pour qui ? », « Tarif unique, simple », FAQ, contact, accroche) > h3 sous-elements (etapes, profils Acc/Acc, Mensuel/Annuel). Risque +30 % (R1) si on touche. |
| `app/recherche/[id]/page.tsx` | 7 | 7x h3 -> h2 | Sections principales du detail accompagnante (Description, A propos, Specialites, Disponibilites, Informations, Contacter, Interesse) toutes sous h1 sans h2 intermediaire. |
| `app/recherche/demandes/page.tsx` | 1 | **laisse h3** | Card-item `{annonce.titre}` repete. Default conservatif. |
| `app/recherche/page.tsx` | 2 | 2x h3 -> h2 | « Les accompagnantes que nous vous recommandons » + « Tous les accompagnantes » sont des sections principales sous h1, sans h2 intermediaire. |

**Total transformations : 48 sur 56** (1+12+1+0+7+1+1+10+6+0+0+7+0+2). **h3 conserves : 8** (4 cards-items repetes + 5 dans landing).

#### Verifications (Task 4)

- `grep -rn '<h3' app | wc -l` post-modification = **8** (= 56 - 48). Conforme AC4.
- Symmetrie ouverture/fermeture h2 verifiee fichier par fichier (10 fichiers modifies, 100 % equilibre).
- `npx tsc --noEmit` : compilation OK.
- `npm run lint:a11y-check` : baseline 155 stable, 0 regression.
- `npm run a11y:axe:check` : 0 delta Critical/Serious vs baseline 2026-05-05.
- `npm run lint` global : 0 errors, 226 warnings (= baseline pre-existant, aucun nouveau warning introduit).
- Garde-fou h1 unique par page (`find app -name 'page.tsx' | xargs grep -L '<h1' | wc -l`) = **0** (intact).

#### Decisions techniques

- **Cas mixtes dashboards** : la decision « 12 h3 -> h2 » et « 7 h3 -> h2 » a ete prise apres analyse DOM serieuse (Sub 3.2). Le h2 « Nom Prenom » deja present dans la carte profil avatar (lignes 109/75) est SEMANTIQUEMENT un titre de carte au meme niveau que les autres cards du grid. La page se lit donc comme : h1 « Tableau de bord » -> h2 [Nom Prenom] -> h2 [Mes annonces] -> h2 [Messages] -> ... Lecture lineaire VoiceOver/NVDA coherente.
- **`app/page.tsx` exclu** (5 h3 conserves) : le risque de derive +30 % (pattern 2.5.5) est reel sur ce fichier. La hierarchie h1 sr-only > h2 > h3 est deja correcte, aucune action requise.
- **`app/admin/page.tsx`** : les 3 h4 (Repartition, MRR par segment, Resiliations) restent en h4. Cela cree un saut h1 -> h4 dans les onglets DashboardTabs, mais c'est hors scope de cette story (focus h3->h2). A traiter si besoin dans une story future Lot D.
- **Tailwind v4 reset** : aucune classe Tailwind retiree ou ajoutee. Le CSS-only de Tailwind v4 reset les niveaux de titre (`@layer base` dans `globals.css`), donc h2 conserve l'apparence visuelle exacte du h3 (taille, poids, couleur, espacement). AC3 satisfait par construction.

### File List

Fichiers modifies (10) :

- `app/accompagnante/annonces/page.tsx` — 1 h3 -> h2
- `app/accompagnante/dashboard/page.tsx` — 12 h3 -> h2 (h2 deja present ligne 109 conserve)
- `app/accompagnante/profil/page.tsx` — 1 h3 -> h2
- `app/accompagne/dashboard/page.tsx` — 7 h3 -> h2 (h2 deja present ligne 75 conserve)
- `app/accompagne/profil/page.tsx` — 1 h3 -> h2
- `app/admin/page.tsx` — 1 h3 -> h2 (3 h4 inchanges)
- `app/admin/utilisateurs/[id]/page.tsx` — 10 h3 -> h2
- `app/admin/validation/[id]/page.tsx` — 6 h3 -> h2
- `app/recherche/[id]/page.tsx` — 7 h3 -> h2
- `app/recherche/page.tsx` — 2 h3 -> h2

Fichiers ajoutes en code review (extension scope, decision option 1 sur Decision 2) :

- `components/accompagnante/profile-form.tsx` — 6 h3 -> h2 (Informations personnelles, Description, Formation, Specialites, Localisation, Disponibilites). Resolution du zigzag h1 -> h3 -> h2 RGPD sur `app/accompagnante/profil/page.tsx`.
- `components/accompagne/profile-form.tsx` — 2 h3 -> h2 (Informations personnelles, Adresse). Resolution du zigzag h1 -> h3 -> h2 RGPD sur `app/accompagne/profil/page.tsx`.

**Total transformations final : 56 sur 64** (48 initialement + 8 ajoutees en code review).

Fichiers non modifies (4 dans le scope mais exclus apres decision Task 2) :

- `app/accompagne/annonces/page.tsx` — h3 card-item repete laisse en place
- `app/favoris/page.tsx` — h3 card-item repete laisse en place
- `app/page.tsx` — 5 h3 sous h2 parents existants
- `app/recherche/demandes/page.tsx` — h3 card-item repete laisse en place

Fichier story mis a jour :

- `_bmad-output/implementation-artifacts/2-7-2-heading-order-cards-h3-h2.md` — Tasks/Subtasks coches, Dev Agent Record renseigne, Status -> review.

### Review Findings

Code review BMad du 2026-05-06 (3 layers : Blind Hunter, Edge Case Hunter, Acceptance Auditor). Synthese : 2 decisions a trancher, 4 elements deferes, 5 dismissed comme bruit.

- [x] [Review][Defer] **Pages exclues h1 -> h3 (favoris, accompagne/annonces, recherche/demandes)** [`app/accompagne/annonces/page.tsx:83`, `app/favoris/page.tsx:124`, `app/recherche/demandes/page.tsx:113`] — deferred, defaut conservatif Sub 2.3 documente. axe `heading-order` `moderate` hors baseline Critical/Serious. A traiter dans une story Lot D dediee « heading-order pages liste » (decision design : libelle h2 parent, tests).
- [x] [Review][Patch] **Pages profil : zigzag h1 -> h3 (form sections) -> h2 (RGPD) RESOLU** — verification DOM confirme : les composants `<*ProfileForm>` contenaient bien 8 `<h3>` siblings directs du `<h1>` page, sans `<h2>` parent interne. Decision option 1 appliquee : promotion des 8 `<h3>` -> `<h2>` dans `components/accompagnante/profile-form.tsx` (Informations personnelles, Description, Formation, Specialites, Localisation, Disponibilites) et `components/accompagne/profile-form.tsx` (Informations personnelles, Adresse). Outline final : `h1 -> h2 (×N) -> h2 RGPD`. Verifications relancees vertes : tsc OK, lint:a11y-check baseline 155 stable, a11y:axe:check baseline 0 Critical/Serious stable. [`components/accompagnante/profile-form.tsx:188,230,241,357,377,453`, `components/accompagne/profile-form.tsx:79,121`]
- [x] [Review][Defer] **Saut h2 -> h4 sur app/admin/page.tsx** [`app/admin/page.tsx:97 + 189/270/280`] — deferred, pre-existant. Documente explicitement dans Decisions techniques (ligne 248) hors scope 2.7.2, story Lot D pressentie.
- [x] [Review][Defer] **`<h2>` "Nom Prenom" carte profil avatar dans dashboards** [`app/accompagnante/dashboard/page.tsx:109`, `app/accompagne/dashboard/page.tsx:75`] — deferred, choix semantique conscient documente (Decisions techniques ligne 246). Edge Case Hunter le marque "Nice-to-have".
- [x] [Review][Defer] **Accord grammatical "Tous les accompagnantes" -> "Toutes"** [`app/recherche/page.tsx:382`] — deferred, copy bug pre-existant hors scope 2.7.2.
- [x] [Review][Defer] **Copy "Demandes accompagnés" ungrammatical** [`app/accompagnante/dashboard/page.tsx:318`] — deferred, copy bug pre-existant hors scope 2.7.2.

Findings dismissed (5) : doublons texte `<h2>` "Messages"/"Mon profil"/"Mon abonnement" dans `accompagnante/dashboard` (mutuelle exclusion verifiee via ternaire top-level lignes 149-238) ; outline plat post-promotion (objectif explicite story, valide HTML5) ; markers "around line N" (artefact prompt subagent, pas defaut code) ; absence de tests E2E (baselines lint+axe servent de filet) ; mismatch visuel h2 `text-sm uppercase gray-500` (AC3 oblige a preserver Tailwind verbatim, design admin volontaire).

## Change Log

| Date | Auteur | Description |
|---|---|---|
| 2026-05-06 | Dev (Claude Opus 4.7) | Implementation Story 2.7.2 : 48 occurrences `<h3>` transformees en `<h2>` sur 10 fichiers (sections principales sous h1 sans h2 parent intermediaire). 8 h3 conserves (4 cards-items repetes, 5 sous h2 parents existants dans la landing). Vérifications vertes : tsc OK, lint:a11y-check baseline 155 stable, a11y:axe:check baseline 0 stable. Status -> review. |
| 2026-05-06 | Code Review BMad | 3 layers (Blind / Edge / Auditor). 2 decisions a trancher, 4 deferes, 5 dismissed. AC tous compliant (Auditor : zero blocking). |
| 2026-05-06 | Code Review BMad — patch Decision 2 | Extension scope : 8 h3 -> h2 ajoutees dans `components/{accompagnante,accompagne}/profile-form.tsx` pour resoudre le zigzag DOM h1 -> h3 (form) -> h2 (RGPD page) sur les 2 pages profil. Verifications relancees vertes (tsc, lint:a11y-check 155 stable, a11y:axe:check 0 Critical/Serious stable). Decision 1 (pages liste) reclassifiee defer. |

## DoD a11y

A renseigner pendant la dev-story :

- [x] Labels associes aux champs (`htmlFor` ou `aria-labelledby`) — **N/A** (pas de modification de formulaire).
- [x] Erreurs liees aux champs via `aria-describedby` + `aria-invalid` — **N/A**.
- [x] Focus visible sur tous les elements interactifs (contraste >= 3:1) — **N/A** (pas d'element interactif modifie).
- [x] Contrastes texte >= 4,5:1 et UI >= 3:1 — **N/A** (couleurs et tailles inchangees, classes Tailwind preservees).
- [x] ARIA states corrects sur composants dynamiques — **N/A**.
- [x] Navigation clavier complete (Tab, Enter, Escape, fleches selon pattern) — **N/A**.
- [ ] Verification ponctuelle au lecteur d'ecran (VoiceOver ou NVDA) sur le composant touche — **a executer par l'utilisateur** : navigation par titres VO sur 1 page detail (ex `/recherche/[id]`) — confirmer lecture lineaire `<h1>` puis `<h2>` (Description, A propos, ...) sans saut h1->h3.
- [x] Pas de regression `eslint-plugin-jsx-a11y` (`npm run lint:a11y-check` vert : baseline 155 stable). **OK : 155 violations across 56 (file, rule) pair(s). No regression.**
- [x] Pas de regression axe-core (`npm run a11y:axe:check` vert : baseline 0 Critical/Serious sur 7 parcours, regle `heading-order` `moderate` peut sortir des warnings — delta documente dans la PR). **OK : aucun delta Critical/Serious vs baseline 2026-05-05.**
- [x] Aucune regression visuelle attendue (taille/poids/couleur des `<h2>` issus de transformation = identiques aux `<h3>` originaux car classes Tailwind preservees integralement, et Tailwind v4 reset les niveaux de titre dans `@layer base`). Verification visuelle navigateur a executer par l'utilisateur (Sub 4.5).
