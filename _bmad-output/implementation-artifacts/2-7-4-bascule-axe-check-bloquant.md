# Story 2.7.4 : Bascule `a11y:axe:check` bloquant CI (Option 1 - audit local discipline)

Status: review

<!-- Note: Validation est optionnelle. Lancer `validate-create-story` avant `dev-story` pour un controle qualite. -->

## Story

En tant que **Project Lead de roxanetnous (Sylvain)**,
je veux **formaliser dans `.claude/CLAUDE.md` la regle stricte que `npm run a11y:axe:check` doit etre vert localement (exit 0) avant tout commit livraison story du Lot C et au-dela**,
afin de **verrouiller le gain accessibilite obtenu Lot B (baseline 0 violations Critical/Serious sur 7 parcours) sans engager le cout de friction d'un hook git pre-commit (Option 2) ni la complexite d'un webhook Vercel post-deploiement (Option 3)**.

Cette story est la **cloture du Lot C** : elle ne touche pas au code applicatif, elle durcit uniquement la regle projet pour empecher toute regression silencieuse du baseline axe-core. La decision Project Lead est tracee dans la story (AC1).

## Decision Project Lead

**Option retenue : Option 1 - audit local discipline.**

**Date** : 2026-05-06.

**Justification** :

- **Contexte solo dev** : roxanetnous est porte par un seul contributeur actif (cf. activite git, conventions BMad projet). La discipline d'execution `npm run a11y:axe:check` avant chaque commit Lot C a ete systematiquement respectee (2.7.1, 2.7.2, 2.7.3, 2.7.6). Formaliser cette pratique dans `CLAUDE.md` codifie l'existant sans introduire de friction.
- **Coupures de baseline rares** : la baseline axe-core est verte et stable depuis le 2026-05-05 (cf. `lot-b-bilan-axe-core-2026-05-06.md`). Les 7 parcours audites couvrent les flows critiques. Le risque de regression silencieuse reste faible vu le rythme de la solo dev.
- **Option 2 (hook git)** ecartee : le check axe lance Playwright + dev server (~1-2 min). Trop lourd a chaque commit, contournable via `--no-verify`, risque concret de desactivation si friction ressentie.
- **Option 3 (webhook Vercel)** ecartee : check post-push (boucle de retour plus lente), configuration CI Vercel non triviale pour Playwright, consomme les minutes CI.
- **Re-evaluation** : si un autre contributeur rejoint le projet ou si la frequence de commits applicatifs augmente, une story 2.X.Y de durcissement (Option 2 ou 3) pourra etre cadree separement.

## Acceptance Criteria

### AC commun Lot C (rappel tech-spec)

1. **AC commun 1** - `npm run lint:a11y-check` vert (baseline 155 stable). `npm run a11y:axe:check` vert (baseline 0 violations Critical/Serious sur 7 parcours).
2. **AC commun 2** - DoD a11y : **N/A** (story de doc/process, pas d'impact UI).
3. **AC commun 3** - Double commit : livraison (`Story 2.7.4 : bascule axe-check bloquant Option 1`) puis cloture (`Story 2.7.4 : statut done apres CI Vercel verte`).

### AC propres a la Story 2.7.4

4. **AC1 - Decision Project Lead documentee** : la section « Decision Project Lead » ci-dessus trace explicitement le choix Option 1, la date 2026-05-06, et la justification (4 points : contexte solo dev, coupures rares, raison ecart Option 2/3, re-evaluation conditionnelle).

5. **AC2 - Mise a jour `.claude/CLAUDE.md`** : la ligne actuelle « executer `npm run a11y:axe:check` localement avant merge pour valider le baseline dynamique axe-core (6 parcours critiques, voir `tests/a11y/README.md`) » est remplacee par une formulation **stricte et bloquante** :
   - Le verbe passe de « executer » a « **executer et confirmer exit 0** ».
   - L'expression « avant merge » devient « **avant tout commit livraison story** » (porte plus tot dans le cycle).
   - La mention « 6 parcours » est corrigee a **7 parcours** (Lot B 2.6.7 a porte le compte de 6 a 7).
   - Une phrase de consequence est ajoutee : « **Tout commit livraison story sans cette validation est rejete au code review.** »

6. **AC3 - Pas de modification `vercel.json`, `package.json`, `.husky/`, `lefthook.yml` ni hook git** : Option 1 est strictement non-invasive cote outillage. Verification : `git status` ne doit pas lister ces fichiers/repertoires en modification. **Garde-fou** : si l'un de ces fichiers est modifie, la story bascule mecaniquement en Option 2 (hook git) et l'AC4 du tech-spec doit etre satisfait - revoir la decision Project Lead.

7. **AC4 - Pas de regression a11y** : `npm run lint:a11y-check` vert (baseline 155 stable, story doc-only) et `npm run a11y:axe:check` vert (baseline 0 violations Critical/Serious sur 7 parcours, idem). Cette story ne touche pas au code applicatif, donc check no-op attendu.

## Tasks / Subtasks

- [x] **Task 1 - Decision Project Lead** (AC: #1)
  - [x] Sub 1.1 : Section « Decision Project Lead » de cette story renseignee avec : option retenue (Option 1), date (2026-05-06), justification 4 points. **Deja fait dans ce fichier story** (cf. ci-dessus).

- [x] **Task 2 - Mise a jour `.claude/CLAUDE.md`** (AC: #2)
  - [x] Sub 2.1 : Editer `.claude/CLAUDE.md` ligne 6 (regle a11y) - formulation Option 1 stricte appliquee.
  - [x] Sub 2.2 : Regle reste dans la section « Regles strictes » (pas de creation de section parallele).
  - [x] Sub 2.3 : La regle `eslint-plugin-jsx-a11y` (baseline 155 via `npm run lint:a11y-check`) est conservee a l'identique. Durcissement porte uniquement sur axe-core.

- [x] **Task 3 - Verifications statiques (a la charge agent dev-story)** (AC: #3, #4)
  - [x] Sub 3.1 : `git status` -> seul `.claude/CLAUDE.md` est modifie (en plus des artefacts story 2.7.3 deja presents). Aucune modification de `vercel.json`, `package.json`, `.husky/`, `lefthook.yml`, ni de scripts.
  - [x] Sub 3.2 : `npm run lint:a11y-check` -> `OK: 155 jsx-a11y violations across 56 (file, rule) pair(s). Baseline total: 155. No regression.`
  - [x] Sub 3.3 : `npm run a11y:axe:check` -> `OK: aucun delta Critical/Serious au-dela du baseline.` (7 parcours audites).

- [ ] **Task 4 - Commits**
  - [ ] Sub 4.1 : Commit 1 livraison `Story 2.7.4 : bascule axe-check bloquant Option 1`. **A executer par l'utilisateur** (regle projet : Claude ne commit pas sans demande explicite).
  - [ ] Sub 4.2 : Push + CI Vercel verte. **A executer par l'utilisateur**.
  - [ ] Sub 4.3 : Commit 2 cloture (`Status: done`). **A executer par l'utilisateur** apres CI Vercel verte.

### Review Findings (passe 2 - 2026-05-06)

Deuxieme code review du 2026-05-06 (3 layers independants : Blind Hunter, Edge Case Hunter, Acceptance Auditor). Acceptance Auditor independant : tous les AC respectes a la lettre, aucun GAP avec l'auto-review existante (passe 1). 18 findings bruts triages. 1 decision-needed, 0 patch, 2 defer (dont 1 elargissement R4), 15 dismiss.

**Decision-needed (1) :**

- [x] [Review][Decision] **Tranche 2026-05-06 : option 1 (defer)** -- Precisions de portee de la regle CLAUDE.md ligne 6 reportees a une story polish doc post-Lot C, en meme temps que la synchronisation cross-corpus 6 -> 7 parcours (cf. defer elargi R4 ci-dessous). Justification utilisateur : la regle telle quelle est suffisante par sens commun (s'applique aux commits qui touchent du code applicatif), patcher maintenant ferait du scope creep vis-a-vis de l'AC2 strict (4 changements semantiques precisement definis). Defer ajoute a `deferred-work.md` (passe 2). Detail de la decision conservee ci-dessous pour traçabilite :

  La nouvelle formulation « Avant tout commit livraison story (`Story X.Y.Z : ...`), executer `npm run a11y:axe:check` et confirmer exit 0 » laisse 3 cas sous-specifies que les reviewers futurs (humains et IA) devront trancher au cas par cas :
  1. **Stories doc-only** (ex. retro 2.7.5, tech-spec, inventaire) — aucun fichier UI ne change, exit 0 garanti par construction. Faut-il quand meme exiger l'execution comme preuve, ou exempter explicitement ?
  2. **Commit clôture `Status: done apres CI Vercel verte`** — c'est un commit « livraison story » au sens du format mais la modif est markdown-only post-CI. Re-executer `axe:check` est redondant.
  3. **Suffixes lettres** (`Story 2.6.7-A`, `Story 2.6.7-B`, `Story 2.6.7-C` dans l'historique git) — le pattern `X.Y.Z` strict ne couvre pas. La regle s'applique-t-elle ?

  **Choix possibles :**
  1. **Defer** (recommande) : laisser la regle telle quelle, traiter ces 3 cas comme jurisprudence implicite (sens commun = la regle s'applique aux commits qui touchent du code applicatif, pas aux commits doc/markdown-only). Risque : reviewer pointilleux peut bloquer un commit doc-only legitimement.
  2. **Patch CLAUDE.md** maintenant : ajouter une parenthese « (s'applique aux commits qui modifient `app/`, `components/`, `lib/`, `tests/` ; les commits doc-only et de cloture en sont exemptes) ». Risque : scope creep par rapport a l'AC2 qui specifie strictement les 4 changements semantiques.
  3. **Story 2.X.Y de polish doc** post-Lot C : reformuler cette regle quand les divergences PRD/NFR/inventaire seront synchronisees (cf. defer ci-dessous), pour un changement coherent de tout le corpus.

**Patch (0)** : aucun patch unambigu sur le fichier `.claude/CLAUDE.md` modifie. (Le « patch » de synchronisation des 5 fichiers projet est trop large pour le scope 2.7.4 - voir defer suivant.)

**Defer (2) :**

- [x] [Review][Defer] **Elargissement R4 : 5 fichiers projet contredisent la nouvelle regle CLAUDE.md (« 6 parcours » residuel)** [`_bmad-output/planning-artifacts/prd.md:17,272,283,291`, `_bmad-output/test-artifacts/nfr-assessment-a11y-2026-05-04.md:147,184,254,291,321,332,340,375,383,390`, `_bmad-output/planning-artifacts/inventaire-points-usage-lot-c-2026-05-06.md:99`, `tests/a11y/README.md:3,115`] — l'auto-review passe 1 R4 ne mentionnait que `tests/a11y/README.md`. La verite est plus large : le PRD (autorite produit), le NFR assessment, et l'inventaire Lot C utilisent encore « 6 parcours critiques » comme perimetre normatif. Note technique : 6 = nombre de parcours metier definis dans le PRD (P1 onboarding aux, P2 recherche, P3 messagerie, P4 inscription/checkout, P5 landing, P6 suppression RGPD) ; 7 = entrees baseline JSON axe-core (P4 a 2 sous-entrees `p4-login` + `p4-register`). Les deux comptes sont defendables selon la definition. **A traiter en story 2.X.Y de polish doc apres decision retro Lot C 2.7.5** : (a) decider du compte canonique (6 metier OU 7 baseline) ; (b) ajouter une note de reconciliation explicite dans le PRD ou un glossaire ; (c) synchroniser tous les documents en consequence.

- [x] [Review][Defer] Format `Story X.Y.Z : ...` ambigu pour les suffixes lettres [`.claude/CLAUDE.md:6`] — l'historique git contient `Story 2.6.7-A`, `Story 2.6.7-B`, `Story 2.6.7-C` qui ne respectent pas strictement `X.Y.Z`. Le tech-spec `tech-spec-lot-c-a11y.md:239` cite meme `Story 2.7.X : ...` (X majuscule) comme variante. Aucun document ne formalise la grammaire admise. Pas un blocker (le sens commun couvre), mais a clarifier dans la story 2.X.Y de polish doc ci-dessus.

**Dismiss (15) :**

- Contradiction interne 6 -> 7 sans justification dans le diff (Blind) — la justification est documentee dans la story (`lot-b-bilan-axe-core-2026-05-06.md` cite, Completion Notes ligne 176-177).
- Ambiguite « exit 0 » vs « 0 violations Critical/Serious » (Blind) — le script `npm run a11y:axe:check` est concu pour exit 0 SSI 0 Critical/Serious : equivalence par construction, pas d'ambiguite operationnelle.
- Portee declencheur floue commit livraison vs intermediaires (Blind) — repris dans decision-needed ci-dessus, jurisprudence implicite suffisante.
- « rejete au code review » non outille (Blind) — Decision Project Lead Option 1 a explicitement ecarte les hooks (Option 2) et webhook CI (Option 3) : le choix conscient est l'audit local discipline + revue manuelle. Pas un finding, c'est l'AC1.
- Absence d'accents systematique dans CLAUDE.md (Blind) — convention projet (le fichier entier est sans accents, decision deliberee anti-encodage).
- Formulation passive « rejete » imprecise sur l'agent (Blind) — style mineur, le reviewer humain est implicite par contexte.
- Markdown gras imbrique avec backticks fragile (Blind) — CommonMark valide, pattern utilise ailleurs dans le projet sans probleme.
- Mot « dynamique » disparait du texte (Blind) — substantif redondant avec « 0 violations Critical/Serious sur 7 parcours », non-loss.
- Double obligation « avant merge » + « avant commit livraison » (Blind) — les 2 jalons s'enchainent (livraison => CI verte => merge), pas de contradiction, juste 2 gates a 2 stades differents.
- Pas de hook pre-commit (Edge) — Decision Project Lead Option 1 = choix explicite, c'est l'AC1 lui-meme.
- Absence de reference a la preuve d'audit (Edge) — Option 1 = confiance dev (cf. Decision Project Lead « Contexte solo dev »).
- Cas commit unique pour story doc-only non couvert (Edge) — repris dans decision-needed ci-dessus.
- Semantique « livraison » vs « done apres CI » (Edge) — repris dans decision-needed ci-dessus.
- `inventaire-points-usage-lot-c-2026-05-06.md:99` dit encore « 6 parcours » (Edge) — fusionne avec le defer elargissement R4.
- Acceptance Auditor passe 2 : aucun GAP avec auto-review passe 1, tous AC OK.

**Verdict Acceptance Auditor (passe 2) :** tous les AC respectes (commun 1-3, AC1-AC4 strict). Diff conforme a la spec, scope respecte a la lettre (1 fichier, 1 ligne, +1 -1). La passe 1 (auto-review) est exhaustive et son verdict tient. Decouverte significative passe 2 : R4 a sous-estime l'etendue des fichiers a synchroniser (5 fichiers projet, pas seulement le README a11y).

### Review Findings (passe 1 - auto-review ciblee, 2026-05-06)

Code review du 2026-05-06 (auto-review ciblee : story doc-only, 1 ligne diff). Acceptance Auditor : tous les AC respectes a la lettre.

**Audit AC :**

- AC commun 1 (lint + axe verts) : OK no-op (story doc-only, baseline 155 stable, axe 0 delta).
- AC commun 2 (DoD a11y) : OK N/A documentee.
- AC commun 3 (double commit) : differe a la charge utilisateur (Task 4 non cochee, attendu).
- AC1 (Decision Project Lead documentee) : OK, section presente avec Option 1 + date 2026-05-06 + justification 4 points.
- AC2 (mise a jour `.claude/CLAUDE.md`) : OK strict. Verbe « executer » -> « executer et confirmer exit 0 » ; portee « avant merge » -> « avant tout commit livraison story » ; compte « 6 » -> « 7 » ; phrase de consequence ajoutee. Les 4 changements semantiques attendus sont tous presents.
- AC3 (pas de modif `vercel.json`/`package.json`/`.husky/`/`lefthook.yml`/hook git) : OK, `git status` confirme seul `.claude/CLAUDE.md` touche cote scope 2.7.4.
- AC4 (pas de regression a11y) : OK no-op confirme.

**Decision-needed (1) — resolue 2026-05-06 :**

- [x] [Review][Decision] Divergence `tests/a11y/README.md` (6 parcours) vs `.claude/CLAUDE.md` (7 parcours apres Story 2.7.4) — **Choix retenu : 1b** (defer documente, signaler dans la retro Lot C 2.7.5). Justification : (1) le risque R4 de la story a explicitement anticipe ce cas et choisi cette voie ; (2) toucher au README en cours de review ferait du scope creep vis-a-vis du `Source tree` de la story qui limite a 1 fichier ; (3) la story 2.7.5 (retro Lot B) est la prochaine review et constitue le bon moment pour decider d'une story 2.X.Y de polish doc. **Note technique** : il y a 6 spec files Playwright (P1-P6) MAIS 7 entrees dans le baseline JSON (P4 a 2 sous-entrees `p4-login` + `p4-register`). Les 2 chiffres sont defendables selon la definition (specs vs entrees baseline). Le README ligne 31 documente deja « 2 sous-entrees dans le baseline » ; seule l'intro ligne 3 et le titre tableau ligne 24 utilisent le compte « 6 ». Defer ajoute a `deferred-work.md`.

**Patch (0)** : aucun.

**Defer (1) — issue anticipee R4 :**

- [x] [Review][Defer] Synchronisation `tests/a11y/README.md` : passer « 6 parcours » a « 7 parcours audites (P1-P6 dont P4 = 2 sous-entrees) » dans intro ligne 3 et titre tableau ligne 24 — deferred 2026-05-06, anticipe par R4 de la story. A traiter en story 2.X.Y de polish doc apres decision retro Lot C 2.7.5.

**Verdict :** story prete pour le commit livraison. Patterns commits `Story X.Y.Z : ...` codifies par cette story sont deja respectes par tout l'historique recent (verifie `git log --oneline`).

## Dev Notes

### Origine de la story

Story formelle du Lot C (mini-epic 2.7) cadree dans `tech-spec-lot-c-a11y.md` (2026-05-06) §Story 2.7.4 (lignes 414-426) et §Pattern « bascule axe-check bloquant » (lignes 234-242).

C'est la **cloture du Lot C** : 4 stories applicatives (2.7.1, 2.7.2, 2.7.3, 2.7.6) ont stabilise le code, cette story durcit la regle projet pour empecher la derive future. L'option 1 a ete **choisie par le Project Lead Sylvain le 2026-05-06** apres exposition des 3 options (cf. echange dev-story cette session).

### Trace formulation actuelle vs nouvelle (avant/apres pour code review)

**Avant** (`.claude/CLAUDE.md` ligne 6, etat 2026-05-06 pre-story) :

```
- **Accessibilite (a11y)** : toute story avec impact UI doit valider la checklist DoD a11y avant merge (labels, focus, contrastes, ARIA, clavier, lecteur d'ecran). Voir `.claude/skills/bmad-create-story/template.md`. La CI Vercel bloque toute regression `eslint-plugin-jsx-a11y` au-dela du baseline (`npm run lint:a11y-check`). En complement, executer `npm run a11y:axe:check` localement avant merge pour valider le baseline dynamique axe-core (6 parcours critiques, voir `tests/a11y/README.md`).
```

**Apres** (cible Story 2.7.4) :

```
- **Accessibilite (a11y)** : toute story avec impact UI doit valider la checklist DoD a11y avant merge (labels, focus, contrastes, ARIA, clavier, lecteur d'ecran). Voir `.claude/skills/bmad-create-story/template.md`. La CI Vercel bloque toute regression `eslint-plugin-jsx-a11y` au-dela du baseline (`npm run lint:a11y-check`). Avant tout commit livraison story (`Story X.Y.Z : ...`), **executer `npm run a11y:axe:check` localement et confirmer exit 0** (baseline 0 violations Critical/Serious sur 7 parcours critiques, voir `tests/a11y/README.md`). Tout commit livraison story sans cette validation est rejete au code review.
```

**Diff resume** :

| Element | Avant | Apres |
|---|---|---|
| Verbe | « executer ... pour valider » | « executer et confirmer exit 0 » |
| Cycle | « avant merge » | « avant tout commit livraison story » |
| Compte parcours | 6 | 7 (corrige Lot B 2.6.7) |
| Consequence | implicite | « rejete au code review » |
| Statut | recommandation | obligation |

### Source tree fichiers a toucher (1)

- `.claude/CLAUDE.md` (modifie, ligne 6 ; pas de modification de `app/`, `components/`, `package.json`, `vercel.json`).

**Hors scope** : aucun changement de code applicatif. Aucune modification de scripts, de hook git, de configuration CI/CD. Aucun nouveau fichier cree (en dehors de cette story dans `_bmad-output/implementation-artifacts/`).

### Risques identifies

| ID | Risque | Mitigation |
|---|---|---|
| **R1** | Regle ignoree (discipline non tenue dans le futur) | Re-evaluation conditionnelle inscrite dans Decision Project Lead : si un autre contributeur rejoint ou si la frequence augmente, story 2.X.Y de durcissement (Option 2 ou 3) sera cadree. La regle reste auditable au code review. |
| **R2** | Diff CLAUDE.md introduit une coquille typographique | Verification visuelle Sub 2.1 + Sub 3.1 (`git diff .claude/CLAUDE.md`). Fragment inchange autour : la regle DoD a11y et la regle `lint:a11y-check` sont conservees a l'identique. |
| **R3** | Confusion entre les deux scripts (`lint:a11y-check` vs `a11y:axe:check`) | Le diff garde les deux scripts cites distinctement : `lint:a11y-check` reste sur regression `eslint-plugin-jsx-a11y` (CI Vercel), `a11y:axe:check` est l'obligation locale durcie. |
| **R4** | Mise a jour de `tests/a11y/README.md` non synchronisee (compte parcours, doc) | Hors scope cette story (focus durcissement regle CLAUDE.md). Verification que le README est a jour reste une bonne pratique mais pas un AC bloquant. Si decalage detecte au passage, le signaler en Completion Notes pour story future. |

### Project Structure Notes

- Cette story est la 5eme et derniere story du Lot C (mini-epic 2.7). Apres son done, la mini-epic 2.7 est entierement cloturee (5/5 stories done).
- L'inventaire `inventaire-points-usage-lot-c-2026-05-06.md` §2.7.4 prevoit cette bascule en cloture.
- Pas de modification du `package.json` : les scripts `lint:a11y-check` et `a11y:axe:check` existent deja (Lot A 2.5.1 et Lot B 2.6.1).
- Pas de modification de la convention `<main id="main-content">` (Lot A 2.5.2) ni de la convention `<h1>` unique (Lot B 2.6.7).

### References

- [Source: _bmad-output/implementation-artifacts/tech-spec-lot-c-a11y.md#Story 2.7.4] (lignes 414-426) - cadrage AC contour, 3 options
- [Source: _bmad-output/implementation-artifacts/tech-spec-lot-c-a11y.md#Pattern « bascule axe-check bloquant »] (lignes 234-242) - patron Option 1
- [Source: _bmad-output/planning-artifacts/inventaire-points-usage-lot-c-2026-05-06.md#2.7.4] - trame de reference
- [Source: _bmad-output/implementation-artifacts/lot-b-bilan-axe-core-2026-05-06.md] - resultats Lot B (baseline 0 sur 7 parcours, justifie correction « 6 -> 7 »)
- [Source: .claude/CLAUDE.md] - fichier cible (ligne 6)
- [Source: tests/a11y/README.md] - doc parcours axe-core (pour synchronisation eventuelle)

## Dev Agent Record

### Agent Model Used

claude-opus-4-7 (Opus 4.7, 1M context) via Claude Code dev-story workflow

### Debug Log References

- `git status --short` : seul `.claude/CLAUDE.md` en modification cote scope story 2.7.4 (les autres entrees - `components/footer.tsx`, `app/accessibilite/`, le fichier story 2.7.3 - sont les artefacts de la story 2.7.3 livree juste avant en meme session, deja en review). AC3 satisfait : aucune modification `vercel.json`, `package.json`, `.husky/`, `lefthook.yml`.
- `npm run lint:a11y-check` : `OK: 155 jsx-a11y violations across 56 (file, rule) pair(s). Baseline total: 155. No regression.`
- `npm run a11y:axe:check` : `OK: aucun delta Critical/Serious au-dela du baseline.` Parcours audites: 7. Baseline `axe-core-baseline-2026-05-05.json` (commit a0cdb8a).

### Completion Notes List

- **Decision Project Lead** : Option 1 retenue par Sylvain le 2026-05-06 apres exposition des 3 options en session dev-story (cf. echange utilisateur). Justification 4 points tracee dans la section « Decision Project Lead » de la story.
- **Diff CLAUDE.md** : un seul edit ciblant la ligne 6, remplacant la formulation « complement / executer ... avant merge » (recommandation) par « Avant tout commit livraison story ... executer ... et confirmer exit 0 ... rejete au code review » (obligation). 5 changements semantiques dans la phrase, conformement au tableau « Diff resume » des Dev Notes.
- **Correction « 6 -> 7 parcours »** : la mention « 6 parcours critiques » dans CLAUDE.md etait obsolete (heritage de l'ecriture initiale Lot B avant 2.6.7). Le compte reel des parcours axe-core est 7 depuis le 2026-05-05 (cf. `lot-b-bilan-axe-core-2026-05-06.md` et output `npm run a11y:axe:check` qui confirme « Parcours audites: 7 »). Correction integree silencieusement dans le diff.
- **Conservation des regles existantes** : la regle DoD a11y (template, checklist) et la regle `eslint-plugin-jsx-a11y` (CI Vercel + `lint:a11y-check` baseline 155) sont **strictement preservees**. Seule la regle axe-core est durcie. Pas de regression de couverture.
- **R4 (sync `tests/a11y/README.md`)** : verification rapide effectuee - le README parle bien du scope axe-core et des parcours. Synchronisation eventuelle de la mention « 6 -> 7 parcours » dans le README **hors scope** Story 2.7.4 (cf. risque R4 Dev Notes). A signaler dans la retro Lot C 2.7.5 si pertinent ; pas de bloquant.
- **No-op a11y attendu et confirme** : story doc-only, aucun changement code applicatif, donc baseline 155 stable et 0 delta axe-core attendus et observes.

### File List

**Fichiers modifies** :
- `.claude/CLAUDE.md` (durcissement regle axe-core ligne 6 : recommandation -> obligation, correction « 6 -> 7 parcours »).

**Nouveaux fichiers** :
- `_bmad-output/implementation-artifacts/2-7-4-bascule-axe-check-bloquant.md` (cette story).

**Aucun fichier de code applicatif modifie** (`app/`, `components/`, `lib/`, etc.).

### Change Log

| Date | Auteur | Description |
|---|---|---|
| 2026-05-06 | dev-story (Opus 4.7) | Implementation initiale Story 2.7.4 : Option 1 (audit local discipline). Durcissement `.claude/CLAUDE.md` ligne 6 (recommandation -> obligation), correction « 6 -> 7 parcours ». Verifications statiques no-op : lint:a11y-check 155 stable, a11y:axe:check 0 delta. Statut : ready-for-dev -> review. |

## DoD a11y

**N/A** : story de doc/process pure (modification de `.claude/CLAUDE.md` uniquement). Aucun impact UI, aucun changement visuel ou interactif. La checklist DoD a11y ne s'applique pas (cf. template.md « ignorer si pas de changement visuel/interactif »).

Verifications a11y de regression (no-op attendu) executees Task 3 :

- [x] Pas de regression `eslint-plugin-jsx-a11y` (`npm run lint:a11y-check` vert) - Sub 3.2 : baseline 155 stable.
- [x] Pas de regression axe-core (`npm run a11y:axe:check` vert) - Sub 3.3 : 0 delta Critical/Serious sur 7 parcours.
