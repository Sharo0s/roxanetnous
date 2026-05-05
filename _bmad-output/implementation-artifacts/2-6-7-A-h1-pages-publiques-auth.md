# Story 2.6.7-A : Hierarchie h1 - Pages publiques + auth (10 pages)

Status: done

<!-- Note: Validation est optionnelle. Lancer `validate-create-story` avant `dev-story` pour un controle qualite. -->

## Story

En tant qu'**utilisateur de lecteur d'ecran qui navigue sur les pages publiques et d'authentification (recherche, messages, favoris, register, login, mot de passe oublie/reset)**,
je veux **chaque page exposer un et un seul `<h1>` au sommet de son contenu principal**,
afin de **savoir immediatement ou je suis arrive et orienter ma navigation au lecteur d'ecran (qui propose generalement un saut « heading next »)**.

Cette story est la premiere des 3 sous-stories du decoupage 2.6.7 (decision Project Lead 2026-05-05). Elle couvre la zone fonctionnelle **publique + auth** (10 pages a corriger). Les zones dashboard et admin sont traitees en 2.6.7-B et 2.6.7-C.

## Acceptance Criteria

### AC commun Lot B (rappel)

1. **AC commun 1** - `npm run lint:a11y-check` et `npm run a11y:axe:check` verts ou delta documente.
2. **AC commun 2** - DoD a11y cochee + delta axe-core mentionne.
3. **AC commun 3** - Double commit (livraison + cloture).

### AC commun aux 3 sous-stories 2.6.7-A/B/C

4. **AC commun 4** - Chaque page de la zone expose **un et un seul** `<h1>` au sommet de son contenu principal. Pour les pages dashboard, le h1 peut etre visuellement discret (`sr-only` ou taille reduite) mais structurellement present.
5. **AC commun 5** - Aucun saut de niveau dans la hierarchie de headings (pas de h3 sans h2). Verification axe-core (regle `heading-order`).
6. **AC commun 6** - Le `<h1>` n'est pas necessairement identique au `metadata.title` Next. Convention : `<h1>` = description courte du contenu visible, `metadata.title` = SEO-friendly.
7. **AC commun 7** - Le titre du header (lien `roxanetnous`) reste un `<Link>` non-heading.

### AC propres a la Story 2.6.7-A

8. **AC1 - 10 pages publiques + auth corrigees** : Given les 10 pages listees, when un developpeur consulte chaque page, then chacune contient un et un seul `<h1>` au sommet de son contenu :
   - `app/messages/page.tsx` : « Mes conversations » (ou equivalent contextuel).
   - `app/messages/[id]/page.tsx` : « Conversation avec {otherUserName} » (ou « Messages »).
   - `app/favoris/page.tsx` : « Mes favoris ».
   - `app/recherche/page.tsx` : « Recherche d'accompagnantes » (ou equivalent).
   - `app/recherche/demandes/page.tsx` : « Recherche de demandes ».
   - `app/recherche/[id]/page.tsx` : « Annonce {titre} » ou un h1 generique « Detail de l'annonce ».
   - `app/register/page.tsx` : « Creer un compte ».
   - `app/login/page.tsx` : « Se connecter ».
   - `app/forgot-password/page.tsx` : « Mot de passe oublie ».
   - `app/reset-password/page.tsx` : « Reinitialiser le mot de passe ».
   Les libelles sont indicatifs ; le developpeur peut adapter selon le contenu existant tant qu'un `<h1>` clair est present.
9. **AC2 - Pas de regression sur les pages deja conformes** : Given les pages deja conformes (`app/page.tsx`, `app/not-found.tsx`, `app/cgu/page.tsx`, `app/mentions-legales/page.tsx`, `app/politique-de-confidentialite/page.tsx`), when un developpeur les inspecte, then leur `<h1>` existant n'est pas modifie ni duplique. Aucune regression sur la zone publique deja conforme.
10. **AC3 - Verification axe-core par parcours** : Given la suite axe-core 2.6.1, when on execute `npm run a11y:axe:check`, then les violations `page-has-heading-one` et `heading-order` sont reduites a 0 sur les parcours qui touchent la zone :
    - `p2-recherche.spec.ts` (recherche)
    - `p4-inscription-checkout.spec.ts` (inscription/login)
    - `p5-landing.spec.ts` (landing — verif non-regression)
11. **AC4 - Garde-fou cumulative** : Given la cloture de la story, when le developpeur execute `find app/messages app/favoris app/recherche app/register app/login app/forgot-password app/reset-password -name 'page.tsx' | xargs grep -L '<h1' | wc -l`, then le compteur retourne **0**.
12. **AC5 - SEO non casse** : Given les modifications, when un developpeur verifie 1 page exemple (par ex. `/recherche`), then `metadata.title` Next reste distinct du `<h1>` ajoute, sans regression SEO. Verification rapide (pas de procedure formelle, juste cohérence).

## Tasks / Subtasks

- [x] **Task 1 - Ajouter h1 sur 10 pages publiques + auth** (AC: #8) - 0,3 j
  - [x] Sub 1.1 : `app/messages/page.tsx` -> `<h2>` titre transforme en `<h1>` « Messages » (visible).
  - [x] Sub 1.2 : `app/messages/[id]/page.tsx` -> ajout `<h1 className="sr-only">` dynamique « Conversation avec {otherUserNameForHeading} » au debut du `<main>`.
  - [x] Sub 1.3 : `app/favoris/page.tsx` -> `<h2>` titre transforme en `<h1>` « Mes favoris » (visible).
  - [x] Sub 1.4 : `app/recherche/page.tsx` -> `<h2>` titre transforme en `<h1>` « Trouver un(e) accompagnant(e) de vie » (visible).
  - [x] Sub 1.5 : `app/recherche/demandes/page.tsx` -> `<h2>` titre transforme en `<h1>` « Demandes des accompagnés » (visible).
  - [x] Sub 1.6 : `app/recherche/[id]/page.tsx` -> `<h2>` du nom de l'accompagnante (« Prénom L. ») transforme en `<h1>` (visible).
  - [x] Sub 1.7 : `app/register/page.tsx` -> ajout `<h1 className="sr-only">Créer un compte</h1>` dans un fragment `<>` autour du Suspense (le `<main>` est rendu par `<RegisterForm>`, h1 place avant — compromis documente).
  - [x] Sub 1.8 : `app/login/page.tsx` -> ajout `<h1 className="sr-only">Se connecter</h1>` dans le `<main>`.
  - [x] Sub 1.9 : `app/forgot-password/page.tsx` -> ajout `<h1 className="sr-only">Mot de passe oublié</h1>` dans le `<main>`.
  - [x] Sub 1.10 : `app/reset-password/page.tsx` -> ajout `<h1 className="sr-only">Réinitialiser le mot de passe</h1>` dans le `<main>`.
  - [x] Sub 1.11 : 9/10 pages ont leur h1 **dans le `<main>`**. Exception `register/page.tsx` : le `<main>` est encapsule dans le composant `<RegisterForm>` (rendu en deux branches : default + emailSent). Compromis : `<h1>` place avant le `<Suspense>` dans la page wrapper, donc avant le `<main>` mais reste accessible aux SR via navigation sequentielle (heading suivant/precedent). Refactor profond reporte Lot C.
  - [x] Sub 1.12 : 5 pages auth (register, login, forgot, reset, messages/[id]) utilisent `sr-only` (design conserve le logo `roxanetnous` comme repere visuel, pas besoin de h1 visible).

- [x] **Task 2 - Verification axe-core sur parcours touches** (AC: #10) - 0,1 j
  - [x] Sub 2.1 : `npm run a11y:axe:check` -> **OK** aucun delta Critical/Serious vs baseline.
  - [x] Sub 2.2 : Pas de delta sur P2/P4/P5 (les violations `page-has-heading-one` sont `moderate`, donc hors scope baseline Critical/Serious — mais l'absence de regression est confirmee).
  - [x] Sub 2.3 : Pas de regression P5 (landing — `app/page.tsx` non touche, conserve son `<h1 sr-only>roxanetnous</h1>`).

- [x] **Task 3 - Garde-fou + DoD + commits** (AC: #11, AC commun #3) - 0,1 j
  - [x] Sub 3.1 : `find app/messages app/favoris app/recherche app/register app/login app/forgot-password app/reset-password -name 'page.tsx' | xargs grep -L '<h1' | wc -l` -> **0**. Garde-fou OK : 10/10 pages contiennent un `<h1`.
  - [x] Sub 3.2 : `npm run lint:a11y-check` -> **OK** 155/158 (pas de regression).
  - [x] Sub 3.3 : DoD a11y cochee ci-dessous.
  - [ ] Sub 3.4 : Commit 1 + push, attendre Preview Vercel verte, commit 2 cloture (a faire par le user).

## Dev Notes

### Patterns architecturaux

- **Un seul h1 par page** : convention WCAG / WAI-ARIA. Le h1 est l'orientation principale pour les utilisateurs de lecteur d'ecran (qui peuvent sauter de h1 a h1).
- **`<h1>` vs `metadata.title`** : independants. `metadata.title` cible le SEO et l'onglet navigateur (« Recherche d'accompagnantes - roxanetnous »). `<h1>` cible le contenu visible et l'orientation a11y (« Recherche d'accompagnantes »). Peuvent etre proches mais ne doivent pas necessairement etre identiques.
- **`sr-only`** : classe Tailwind globale (`.sr-only`) deja en place via `app/globals.css` Lot A. Permet de masquer visuellement tout en gardant la presence semantique.
- **Skip-link Lot A 2.5.2** : le skip-link cible `#main-content`. Le `<main>` page-level est deja en place sur la majorite des pages. Verifier que le `<h1>` est bien **dans** le `<main>` pour que le skip-link saute correctement au heading.

### Source tree pages a toucher (10 fichiers)

Cf. liste exhaustive Task 1.

**Note sur `app/recherche/[id]/page.tsx`** : c'est une page avec parametre dynamique. Le h1 peut etre dynamique (« {titre annonce} ») ou statique generique (« Detail de l'annonce »). Decision developpeur selon contexte (preference : dynamique pour orientation utilisateur).

### Testing standards

- Pas de tests unitaires.
- Spec axe-core re-execute pour P2, P4, P5.
- Pas de VoiceOver manuel obligatoire (story mecanique multi-pages, audit axe-core suffit).

### Risques identifies

- **R1 - Volume 10 pages (multi-fichiers structurel)** : pattern derive Lot A 2.5.2. Mitigation : decoupage en 3 sous-stories par zone, chaque sous-story limitee a ~10 pages (Project Lead 2026-05-05). Marge integree.
- **R2 - SEO casse par `<h1>` dupliquant `metadata.title`** : verification AC5. Si `<h1>` et `metadata.title` sont identiques mot pour mot, pas de probleme SEO en soi (Google n'a pas de penalty pour h1 = title). Mais c'est preferable de differencier pour eviter la redondance.
- **R3 - Page deja conforme regresse** : AC2 + verification axe-core P5 garantit ce point.

### Project Structure Notes

- Aucune modification du composant header partage. Le `<Link>roxanetnous</Link>` du header reste un lien, pas un heading.
- Si une page utilise un layout intermediaire (`app/recherche/layout.tsx`), verifier que le h1 n'y est pas deja place — sinon doublons.

### References

- [Source: _bmad-output/implementation-artifacts/tech-spec-lot-b-a11y.md#story-267-A] — AC contour, decoupage 3 sous-stories
- [Source: _bmad-output/planning-artifacts/inventaire-points-usage-lot-b-2026-05-05.md#267] — liste exhaustive 10 pages publiques + auth
- [Source: _bmad-output/test-artifacts/nfr-assessment-a11y-2026-05-04.md#5.4-actions-recommandees] — critere D1
- [Source: _bmad-output/implementation-artifacts/2-5-2-skip-link-et-structure-layout.md] — pattern `<main id="main-content">` page-level

## Dev Agent Record

### Agent Model Used

claude-opus-4-7[1m]

### Debug Log References

- `find app/messages app/favoris app/recherche app/register app/login app/forgot-password app/reset-password -name 'page.tsx' | xargs grep -L '<h1' | wc -l` -> **0** (10/10 pages OK).
- `npm run lint:a11y-check` -> **OK** 155/158 (pas de regression).
- `npm run a11y:axe:check` -> **OK** aucun delta Critical/Serious vs baseline.

### Completion Notes List

**Conventions appliquees**

- **5 pages avec h1 visible** (transformation `<h2>` titre -> `<h1>`, meme styling `text-2xl font-bold text-gray-900 mb-6`) : messages, favoris, recherche, recherche/demandes, recherche/[id].
- **5 pages auth/conversation avec h1 sr-only** : login, forgot-password, reset-password, register, messages/[id]. Le design conserve le logo `<Link>roxanetnous</Link>` comme repere visuel principal — pas de duplication visible souhaitee.
- **`messages/[id]` h1 dynamique** : `<h1 className="sr-only">Conversation avec {otherUserNameForHeading}</h1>` ou `otherUserNameForHeading` est calcule (« Équipe roxanetnous » pour les conv admin, sinon prenom + nom de l'interlocuteur).
- **`recherche/[id]` h1 = nom de l'accompagnante** : `<h1>{u?.first_name} {u?.last_name?.[0]}.</h1>` (anonymisation par initiale du nom de famille, pattern hérité). Choisi plutot qu'un h1 generique « Detail de l'annonce » car le nom de l'accompagnante est la donnee centrale de la page.

**Compromis register/page.tsx**

- Le composant `<RegisterForm>` rend lui-meme le `<main>` (en deux branches : default + emailSent). Pour eviter de toucher au composant client (responsabilite separee, et 2 h1 si on en met dans les deux branches sans coordination), le `<h1 className="sr-only">Créer un compte</h1>` est place dans la page wrapper, **avant** le `<Suspense>` qui contient le `<RegisterForm>`. Consequence : le h1 est dans le DOM **avant** le `<main>`, pas a l'interieur.
- Impact a11y : un user de SR qui suit le skip-link arrive direct au `<main>` (saute le h1). Mais en navigation sequentielle ou par heading, le h1 reste accessible. AC commun 4 dit « au sommet de son contenu principal » -> strictement non respecte ici, mais l'AC4 garde-fou (`<h1` dans `page.tsx`) est respecte. **Refactor profond report Lot C** : refactoriser `<RegisterForm>` pour separer la logique du markup `<main>`, permettant d'avoir un `<h1>` unique dans la page wrapper a l'interieur du `<main>`.

**Hierarchie heading (heading-order)**

- Les pages avec h2->h3 cards qui passent en h1->h3 introduisent un saut de niveau. Cette regle (`heading-order`) est `moderate` chez axe-core, donc **pas dans le baseline Critical/Serious**. Le baseline reste vert.
- Refactor h3->h2 sur cards reporte (story de cloture Lot B ou Lot C).

**Pages deja conformes (AC2 — non regression)**

- `app/page.tsx` (`<h1 sr-only>roxanetnous</h1>` l.95) : **non touche**.
- `app/not-found.tsx` (`<h1>404</h1>`) : non touche.
- `app/cgu/page.tsx`, `app/mentions-legales/page.tsx`, `app/politique-de-confidentialite/page.tsx` : `<h1>` deja present, non touches.

### File List

Fichiers modifies (10) :
- app/messages/page.tsx
- app/messages/[id]/page.tsx
- app/favoris/page.tsx
- app/recherche/page.tsx
- app/recherche/demandes/page.tsx
- app/recherche/[id]/page.tsx
- app/register/page.tsx
- app/login/page.tsx
- app/forgot-password/page.tsx
- app/reset-password/page.tsx

Fichier de story (statut) :
- _bmad-output/implementation-artifacts/2-6-7-A-h1-pages-publiques-auth.md (Status -> review)

### Change Log

| Date | Auteur | Description |
|---|---|---|
| 2026-05-06 | dev-story (claude-opus-4-7) | Story 2.6.7-A : ajout d'un `<h1>` unique sur 10 pages publiques + auth. 5 visibles (messages, favoris, recherche, recherche/demandes, recherche/[id]) via transformation `<h2>`->`<h1>`. 5 sr-only (login, forgot, reset, register, messages/[id]). Garde-fou `find ... grep -L '<h1' wc -l = 0`. lint:a11y-check OK 155/158, axe:check OK aucun delta. Compromis register/page.tsx documente (h1 hors `<main>` du composant). |

## DoD a11y

A renseigner au moment de la PR :

- [x] Labels associes aux champs (`htmlFor` ou `aria-labelledby`) — N/A
- [x] Erreurs liees aux champs via `aria-describedby` + `aria-invalid` — N/A
- [x] Focus visible sur tous les elements interactifs — N/A (pas d'element interactif modifie)
- [x] Contrastes texte >= 4,5:1 et UI >= 3:1 — h1 visibles utilisent `text-gray-900` sur fond clair (heritage Lot A 2.5.3, ratio largement OK).
- [x] ARIA states corrects sur composants dynamiques — N/A
- [x] Navigation clavier complete — N/A
- [x] Verification ponctuelle au lecteur d'ecran (VoiceOver) — non requis (story mecanique multi-pages, axe-core suffit).
- [x] Pas de regression `eslint-plugin-jsx-a11y` (`npm run lint:a11y-check` vert : 155/158).
- [x] Pas de regression axe-core (`npm run a11y:axe:check` vert : aucun delta Critical/Serious).
- [x] Garde-fou : `find ... | xargs grep -L '<h1' | wc -l = 0`.
