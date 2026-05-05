# Story 2.6.7-B : Hierarchie h1 - Dashboards accompagnante/accompagne (11 pages)

Status: ready-for-dev

<!-- Note: Validation est optionnelle. Lancer `validate-create-story` avant `dev-story` pour un controle qualite. -->

## Story

En tant qu'**accompagnante ou accompagne authentifie qui consulte mon profil, dashboard, mes annonces, mon abonnement ou l'onboarding**,
je veux **chaque page de mon espace personnel exposer un et un seul `<h1>` au sommet**,
afin de **m'orienter au lecteur d'ecran et identifier rapidement la fonctionnalite a laquelle j'accede**.

Cette story est la deuxieme des 3 sous-stories du decoupage 2.6.7 (decision Project Lead 2026-05-05). Elle couvre la zone fonctionnelle **dashboards utilisateurs** (11 pages a corriger sur 13 dans la zone — 2 pages success ont deja un h1).

## Acceptance Criteria

### AC commun Lot B (rappel)

1. **AC commun 1** - `npm run lint:a11y-check` et `npm run a11y:axe:check` verts ou delta documente.
2. **AC commun 2** - DoD a11y cochee + delta axe-core mentionne.
3. **AC commun 3** - Double commit (livraison + cloture).

### AC commun aux 3 sous-stories 2.6.7-A/B/C

4. **AC commun 4** - Chaque page de la zone expose un et un seul `<h1>` au sommet de son contenu principal. Pour les pages dashboard, le h1 peut etre visuellement discret (`sr-only` ou taille reduite) mais structurellement present.
5. **AC commun 5** - Aucun saut de niveau dans la hierarchie de headings.
6. **AC commun 6** - Le `<h1>` n'est pas necessairement identique au `metadata.title` Next.
7. **AC commun 7** - Le titre du header (lien `roxanetnous`) reste un `<Link>` non-heading.

### AC propres a la Story 2.6.7-B

8. **AC1 - 11 pages dashboards corrigees** : Given les 11 pages listees, when un developpeur consulte chaque page, then chacune contient un et un seul `<h1>` au sommet de son contenu :

  Accompagnante (6) :
  - `app/accompagnante/profil/page.tsx` : « Mon profil ».
  - `app/accompagnante/dashboard/page.tsx` : « Tableau de bord ».
  - `app/accompagnante/annonces/page.tsx` : « Mes annonces ».
  - `app/accompagnante/annonces/nouvelle/page.tsx` : « Nouvelle annonce ».
  - `app/accompagnante/abonnement/page.tsx` : « Mon abonnement ».
  - `app/accompagnante/onboarding/page.tsx` : « Onboarding accompagnante » (peut etre `sr-only` car le composant `onboarding-client.tsx` a deja ses propres `<h2>` par etape — voir story 2.6.3).

  Accompagne (5) :
  - `app/accompagne/profil/page.tsx` : « Mon profil ».
  - `app/accompagne/dashboard/page.tsx` : « Tableau de bord ».
  - `app/accompagne/annonces/page.tsx` : « Mes annonces ».
  - `app/accompagne/annonces/nouvelle/page.tsx` : « Nouvelle annonce ».
  - `app/accompagne/abonnement/page.tsx` : « Mon abonnement ».

9. **AC2 - Pas de regression sur les pages deja conformes** : Given les 2 pages success (`app/accompagnante/abonnement/success/page.tsx`, `app/accompagne/abonnement/success/page.tsx`) qui ont deja un h1 (validees dans inventaire), when un developpeur les consulte, then leur `<h1>` n'est pas modifie ni duplique.
10. **AC3 - Coordination avec story 2.6.3** : Given que la story 2.6.3 (onboarding aux) ajoute des `<h2>` focusables dans les sub-steps, when le developpeur de cette story (2.6.7-B) ajoute un `<h1>` sur `app/accompagnante/onboarding/page.tsx`, then la hierarchie reste coherente : un seul `<h1>` au niveau page + des `<h2>` au niveau sub-step. Pas de conflit.
11. **AC4 - Verification axe-core par parcours** : Given la suite axe-core 2.6.1, when on execute `npm run a11y:axe:check`, then les violations `page-has-heading-one` et `heading-order` sont reduites a 0 sur les parcours qui touchent la zone :
    - `p1-onboarding-aux.spec.ts` (onboarding accompagnante)
    - `p3-messagerie.spec.ts` (verif non-regression — le header n'a pas de h1, mais les pages dashboard si)
    - `p6-suppression-rgpd.spec.ts` (suppression compte depuis profil)
12. **AC5 - Garde-fou cumulative** : Given la cloture de la story, when le developpeur execute `find app/accompagnante app/accompagne -name 'page.tsx' | xargs grep -L '<h1' | wc -l`, then le compteur retourne **0**.

## Tasks / Subtasks

- [ ] **Task 1 - Ajouter h1 sur 11 pages dashboards** (AC: #8) - 0,3 j
  Accompagnante :
  - [ ] Sub 1.1 : `app/accompagnante/profil/page.tsx`.
  - [ ] Sub 1.2 : `app/accompagnante/dashboard/page.tsx`.
  - [ ] Sub 1.3 : `app/accompagnante/annonces/page.tsx`.
  - [ ] Sub 1.4 : `app/accompagnante/annonces/nouvelle/page.tsx`.
  - [ ] Sub 1.5 : `app/accompagnante/abonnement/page.tsx`.
  - [ ] Sub 1.6 : `app/accompagnante/onboarding/page.tsx` (`sr-only` recommande, voir AC3).

  Accompagne :
  - [ ] Sub 1.7 : `app/accompagne/profil/page.tsx`.
  - [ ] Sub 1.8 : `app/accompagne/dashboard/page.tsx`.
  - [ ] Sub 1.9 : `app/accompagne/annonces/page.tsx`.
  - [ ] Sub 1.10 : `app/accompagne/annonces/nouvelle/page.tsx`.
  - [ ] Sub 1.11 : `app/accompagne/abonnement/page.tsx`.

  - [ ] Sub 1.12 : Pour chaque page, verifier que le h1 est dans le `<main>` (Lot A 2.5.2 skip-link).

- [ ] **Task 2 - Verification non-regression sur 2 pages success** (AC: #9) - 0,02 j
  - [ ] Sub 2.1 : Lire `app/accompagnante/abonnement/success/page.tsx` et `app/accompagne/abonnement/success/page.tsx` -> verifier h1 deja present, ne rien modifier.

- [ ] **Task 3 - Verification axe-core sur parcours touches** (AC: #11) - 0,1 j
  - [ ] Sub 3.1 : `npm run a11y:axe:check` localement.
  - [ ] Sub 3.2 : Verifier delta sur P1, P3, P6.

- [ ] **Task 4 - Garde-fou + DoD + commits** (AC: #12, AC commun #3) - 0,1 j
  - [ ] Sub 4.1 : Executer `find app/accompagnante app/accompagne -name 'page.tsx' | xargs grep -L '<h1' | wc -l` -> verifier 0.
  - [ ] Sub 4.2 : `npm run lint:a11y-check` vert.
  - [ ] Sub 4.3 : DoD a11y cochee.
  - [ ] Sub 4.4 : Commit 1 + push, attendre Preview Vercel verte, commit 2 cloture.

## Dev Notes

### Patterns architecturaux

- Voir `2-6-7-A-h1-pages-publiques-auth.md` Dev Notes (memes patterns).
- **Specifique dashboards** : les pages dashboard ont souvent un design epure ou un h1 visible peut paraitre redondant avec la sidebar/header. Privilegier `sr-only` si le design ne supporte pas un h1 visible. Le but est la **presence semantique**, pas l'esthetique.

### Source tree pages a toucher (11 fichiers)

Cf. liste exhaustive Task 1.

**Note sur `app/accompagnante/parrainage/page.tsx`** : pas dans le scope de cette story — verifie comme deja conforme (h1 present) dans l'inventaire.

### Testing standards

- Pas de tests unitaires.
- Spec axe-core re-execute pour P1, P3, P6.
- Pas de VoiceOver manuel obligatoire (mecanique).

### Risques identifies

- **R1 - Coordination 2.6.3 onboarding** : si 2.6.3 ajoute deja un h1 `<h1>Onboarding accompagnante</h1>` au composant client, ne pas le dupliquer dans la page parent. Verification cas-par-cas Sub 1.6.
- **R2 - h1 visible casse design** : adopter `sr-only` si necessaire. Pas de risque structurel.

### Project Structure Notes

- Verifier si un `app/accompagnante/layout.tsx` ou `app/accompagne/layout.tsx` existe et contient deja un h1. Si oui, ne pas dupliquer.

### References

- [Source: _bmad-output/implementation-artifacts/tech-spec-lot-b-a11y.md#story-267-B] — AC contour
- [Source: _bmad-output/planning-artifacts/inventaire-points-usage-lot-b-2026-05-05.md#267] — liste exhaustive 11 pages dashboards
- [Source: _bmad-output/test-artifacts/nfr-assessment-a11y-2026-05-04.md#5.4-actions-recommandees] — critere D1
- [Source: _bmad-output/implementation-artifacts/2-6-3-onboarding-aux-progressbar-focus.md] — coordination h2 sub-steps onboarding aux
- [Source: _bmad-output/implementation-artifacts/2-5-2-skip-link-et-structure-layout.md] — pattern `<main id="main-content">` page-level

## Dev Agent Record

### Agent Model Used

claude-opus-4-7[1m]

### Debug Log References

### Completion Notes List

### File List

## DoD a11y

A renseigner au moment de la PR :

- [ ] Labels associes aux champs (`htmlFor` ou `aria-labelledby`) — N/A
- [ ] Erreurs liees aux champs via `aria-describedby` + `aria-invalid` — N/A
- [ ] Focus visible sur tous les elements interactifs — N/A
- [ ] Contrastes texte >= 4,5:1 et UI >= 3:1 — heritage Lot A 2.5.3
- [ ] ARIA states corrects sur composants dynamiques — N/A
- [ ] Navigation clavier complete — N/A
- [ ] Verification ponctuelle au lecteur d'ecran — non requis pour cette story (axe-core suffit)
- [ ] Pas de regression `eslint-plugin-jsx-a11y` (`npm run lint:a11y-check` vert en CI)
- [ ] Pas de regression axe-core (`npm run a11y:axe:check` vert ou delta documente — reduction `page-has-heading-one` attendue sur P1/P3/P6)
- [ ] Garde-fou : `find app/accompagnante app/accompagne -name 'page.tsx' | xargs grep -L '<h1' | wc -l == 0`
