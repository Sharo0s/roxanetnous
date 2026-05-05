# Story 2.6.7-C : Hierarchie h1 - Pages admin (11 pages) + bilan global cloture Lot B

Status: ready-for-dev

<!-- Note: Validation est optionnelle. Lancer `validate-create-story` avant `dev-story` pour un controle qualite. -->

## Story

En tant qu'**administrateur de la plateforme roxanetnous qui consulte les pages d'administration (utilisateurs, validation, parrainages, signalements, annonces, messages, historique)**,
je veux **chaque page admin exposer un et un seul `<h1>` au sommet**,
afin de **m'orienter rapidement parmi les sections du back-office**.

Cette story est la troisieme et **derniere des 3 sous-stories du decoupage 2.6.7** (decision Project Lead 2026-05-05). Elle couvre la zone fonctionnelle **admin** (11 pages a corriger sur 12 dans la zone — 1 page deja conforme). Elle inclut **un bilan global axe-core** en cloture du Lot B.

## Acceptance Criteria

### AC commun Lot B (rappel)

1. **AC commun 1** - `npm run lint:a11y-check` et `npm run a11y:axe:check` verts ou delta documente.
2. **AC commun 2** - DoD a11y cochee + delta axe-core mentionne.
3. **AC commun 3** - Double commit (livraison + cloture).

### AC commun aux 3 sous-stories 2.6.7-A/B/C

4. **AC commun 4** - Chaque page expose un et un seul `<h1>` au sommet du contenu.
5. **AC commun 5** - Aucun saut de niveau (heading-order respecte).
6. **AC commun 6** - `<h1>` distinct de `metadata.title` Next.
7. **AC commun 7** - Header `<Link>roxanetnous</Link>` reste un lien, pas un heading.

### AC propres a la Story 2.6.7-C

8. **AC1 - 11 pages admin corrigees** : Given les 11 pages listees, when un developpeur consulte chaque page, then chacune contient un et un seul `<h1>` au sommet :
   - `app/admin/page.tsx` : « Tableau de bord administration » (ou « Administration »).
   - `app/admin/historique/page.tsx` : « Historique ».
   - `app/admin/messages/page.tsx` : « Messages (admin) ».
   - `app/admin/messages/[id]/page.tsx` : « Conversation {id} » ou « Detail conversation (admin) ».
   - `app/admin/parrainages/page.tsx` : « Parrainages ».
   - `app/admin/parrainages/blacklist/page.tsx` : « Blacklist parrainages ».
   - `app/admin/annonces/page.tsx` : « Annonces (admin) ».
   - `app/admin/signalements/page.tsx` : « Signalements ».
   - `app/admin/utilisateurs/page.tsx` : « Utilisateurs ».
   - `app/admin/utilisateurs/[id]/page.tsx` : « Utilisateur {id} » ou « Detail utilisateur ».
   - `app/admin/validation/[id]/page.tsx` : « Validation accompagnante {id} ».
9. **AC2 - Pas de regression sur la page deja conforme** : Given `app/admin/departements/page.tsx` qui a deja un h1, when un developpeur la consulte, then le `<h1>` existant n'est pas modifie ni duplique.
10. **AC3 - Verification axe-core ciblee admin** : Given la suite axe-core 2.6.1, when on execute `npm run a11y:axe:check`, then les pages admin n'ont pas de violations `page-has-heading-one` ni `heading-order`. **Note** : les pages admin **ne sont pas dans les 6 parcours critiques** mais le critere D1 reste applicable. Une spec dediee n'est pas obligatoire — verification ad-hoc avec `npx playwright test --grep admin` (si une spec admin existe en Lot B+) ou audit manuel via DevTools axe extension.
11. **AC4 - Garde-fou cumulative admin** : Given la cloture de la story, when le developpeur execute `find app/admin -name 'page.tsx' | xargs grep -L '<h1' | wc -l`, then le compteur retourne **0**.
12. **AC5 - Garde-fou anti-derive global Lot B** : Given que cette story est la derniere du Lot B, when le developpeur execute `find app -name 'page.tsx' | xargs grep -L '<h1' | wc -l`, then le compteur retourne **0** sur l'ensemble de l'app. **Si > 0** : identifier les pages oubliees, creer une story corrective, ne pas marquer Lot B done tant que ce compteur n'est pas a 0.
13. **AC6 - Bilan global axe-core post-Lot B** : Given que cette story cloture le Lot B, when le developpeur execute `npm run a11y:axe:baseline` (regenere un nouveau snapshot baseline), then :
    - Un nouveau fichier `_bmad-output/test-artifacts/axe-core-baseline-2026-05-XX.json` (date du jour de cloture) est genere et committe.
    - Le fichier `_bmad-output/implementation-artifacts/lot-b-bilan-axe-core-2026-05-XX.md` est cree, comparant le baseline initial (2.6.1) au baseline final (2.6.7-C). Format : tableau par parcours (P1-P6), nombre de violations Critical+Serious avant/apres, delta. Texte court (1 page max) sur les enseignements.
    - Ce bilan alimente le **re-run NFR post-Lot B** prevu dans le tech-spec.

## Tasks / Subtasks

- [ ] **Task 1 - Ajouter h1 sur 11 pages admin** (AC: #8) - 0,15 j (pattern uniforme attendu)
  - [ ] Sub 1.1 : `app/admin/page.tsx`.
  - [ ] Sub 1.2 : `app/admin/historique/page.tsx`.
  - [ ] Sub 1.3 : `app/admin/messages/page.tsx`.
  - [ ] Sub 1.4 : `app/admin/messages/[id]/page.tsx`.
  - [ ] Sub 1.5 : `app/admin/parrainages/page.tsx`.
  - [ ] Sub 1.6 : `app/admin/parrainages/blacklist/page.tsx`.
  - [ ] Sub 1.7 : `app/admin/annonces/page.tsx`.
  - [ ] Sub 1.8 : `app/admin/signalements/page.tsx`.
  - [ ] Sub 1.9 : `app/admin/utilisateurs/page.tsx`.
  - [ ] Sub 1.10 : `app/admin/utilisateurs/[id]/page.tsx`.
  - [ ] Sub 1.11 : `app/admin/validation/[id]/page.tsx`.
  - [ ] Sub 1.12 : Verifier que `app/admin/layout.tsx` (s'il existe) ne contient pas deja un h1 — sinon doublons.

- [ ] **Task 2 - Verification axe-core ciblee admin** (AC: #10) - 0,02 j
  - [ ] Sub 2.1 : Audit ad-hoc via DevTools axe extension OU `npx playwright test` si une spec admin existe.
  - [ ] Sub 2.2 : Verifier que les pages admin ne remontent plus de violation `page-has-heading-one`.

- [ ] **Task 3 - Garde-fou cumulative admin et global** (AC: #11, #12) - 0,03 j
  - [ ] Sub 3.1 : `find app/admin -name 'page.tsx' | xargs grep -L '<h1' | wc -l` -> 0.
  - [ ] Sub 3.2 : `find app -name 'page.tsx' | xargs grep -L '<h1' | wc -l` -> 0 (verification globale Lot B).
  - [ ] Sub 3.3 : Si compteur global > 0 : identifier, completer, ou ouvrir une story corrective et alerter Project Lead.

- [ ] **Task 4 - Bilan global axe-core post-Lot B** (AC: #13) - 0,05 j
  - [ ] Sub 4.1 : `npm run a11y:axe:baseline` -> nouveau snapshot date du jour.
  - [ ] Sub 4.2 : Comparer manuellement avec le baseline initial cree par 2.6.1.
  - [ ] Sub 4.3 : Rediger `_bmad-output/implementation-artifacts/lot-b-bilan-axe-core-2026-05-XX.md` (1 page max). Tableau par parcours, delta violations, enseignements.
  - [ ] Sub 4.4 : Commit du nouveau baseline + bilan dans le commit final de la story.

- [ ] **Task 5 - DoD + commits** (AC commun #2, #3) - Inclus dans Tasks precedentes
  - [ ] Sub 5.1 : `npm run lint:a11y-check` vert.
  - [ ] Sub 5.2 : DoD a11y cochee.
  - [ ] Sub 5.3 : Commit 1 : `Story 2.6.7-C : h1 admin + bilan cloture Lot B`.
  - [ ] Sub 5.4 : Push, attendre Preview Vercel verte.
  - [ ] Sub 5.5 : Commit 2 : `Story 2.6.7-C : statut done apres CI Vercel verte`.

## Dev Notes

### Patterns architecturaux

- Voir `2-6-7-A-h1-pages-publiques-auth.md` et `2-6-7-B-h1-dashboards-utilisateurs.md` Dev Notes.
- **Specifique admin** : structure repetitive attendue (pattern uniforme entre les pages liste, detail, validation). Effort reduit a 0,25 j vs 0,5 j sur publique/dashboard car le copier-coller du pattern h1 est immediat.
- **Bilan global** : derniere etape avant re-run NFR post-Lot B. Le bilan documente le succes mesurable du Lot B (avant/apres axe-core sur les 6 parcours critiques).

### Source tree pages a toucher (11 fichiers)

Cf. liste exhaustive Task 1.

### Testing standards

- Pas de tests unitaires.
- Audit ad-hoc admin (pas de spec parcours critique).
- Bilan axe-core en livrable.

### Risques identifies

- **R1 - Page admin oubliee** : la liste de l'inventaire reste valable au demarrage de cette story, mais une nouvelle page admin pourrait avoir ete creee entre-temps. Mitigation : garde-fou Task 3 garantit detection.
- **R2 - Bilan post-Lot B revele que les violations Critical/Serious n'ont pas baisse autant qu'attendu** : non bloquant pour la story (la story corrige bien les h1), mais alerte le Project Lead pour le re-run NFR.

### Project Structure Notes

- Verifier `app/admin/layout.tsx` au demarrage : si un layout admin commun existe et contient deja un titre, l'ajout d'un h1 par page peut creer un doublon. Adapter en consequence.

### References

- [Source: _bmad-output/implementation-artifacts/tech-spec-lot-b-a11y.md#story-267-C] — AC contour, bilan cloture
- [Source: _bmad-output/planning-artifacts/inventaire-points-usage-lot-b-2026-05-05.md#267] — liste exhaustive 11 pages admin
- [Source: _bmad-output/test-artifacts/nfr-assessment-a11y-2026-05-04.md#5.4-actions-recommandees] — critere D1, projection post-Lot B
- [Source: _bmad-output/implementation-artifacts/2-6-1-outillage-axe-core-playwright.md] — baseline initiale + commande `a11y:axe:baseline`

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
- [ ] Verification ponctuelle au lecteur d'ecran — non requis (axe-core + audit ad-hoc suffit)
- [ ] Pas de regression `eslint-plugin-jsx-a11y` (`npm run lint:a11y-check` vert en CI)
- [ ] Pas de regression axe-core (`npm run a11y:axe:check` vert ou delta documente)
- [ ] Garde-fou admin : `find app/admin -name 'page.tsx' | xargs grep -L '<h1' | wc -l == 0`
- [ ] Garde-fou global Lot B : `find app -name 'page.tsx' | xargs grep -L '<h1' | wc -l == 0`
- [ ] Bilan global axe-core post-Lot B livre (`lot-b-bilan-axe-core-YYYY-MM-DD.md`)
- [ ] Nouveau snapshot baseline post-Lot B committe
