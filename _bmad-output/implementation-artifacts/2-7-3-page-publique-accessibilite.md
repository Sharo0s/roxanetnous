# Story 2.7.3 : Page publique `/accessibilite` (engagements + limites)

Status: review

<!-- Note: Validation est optionnelle. Lancer `validate-create-story` avant `dev-story` pour un controle qualite. -->

## Story

En tant que **utilisateur final de roxanetnous (dont utilisateur lecteur d'ecran ou utilisateur en situation de handicap qui souhaite verifier le niveau d'accessibilite avant de s'inscrire)**,
je veux **acceder a une page publique `/accessibilite` qui declare le niveau de conformite RGAA atteint, les resultats des tests, les limites connues, le contact pour signaler un defaut et l'engagement d'amelioration**,
afin de **pouvoir prendre une decision informee sur l'usage du service et signaler un eventuel probleme directement a l'editeur (recommandation RGAA 4.1, declaration d'accessibilite obligatoire pour les services en ligne)**.

Cette story est l'engagement public du Lot C : la conformite a11y atteinte via le Lot A et le Lot B (baseline axe-core 0 violations Critical/Serious sur 7 parcours, lint a11y 155 stable, h1 unique sur toutes les pages applicatives, alternative textuelle carte hero, audit Leaflet) merite d'etre formalisee dans une page publique liee depuis le footer principal, au meme niveau que « Mentions legales », « Politique de confidentialite » et « CGU ».

## Acceptance Criteria

### AC commun Lot C (rappel tech-spec)

1. **AC commun 1** - `npm run lint:a11y-check` vert (baseline 155 stable). `npm run a11y:axe:check` vert (baseline 0 violations Critical/Serious sur 7 parcours).
2. **AC commun 2** - DoD a11y cochee (impact UI : nouvelle page publique).
3. **AC commun 3** - Double commit : livraison (`Story 2.7.3 : page publique accessibilite`) puis cloture (`Story 2.7.3 : statut done apres CI Vercel verte`).

### AC propres a la Story 2.7.3

4. **AC1 - Page Server Component creee** : `app/accessibilite/page.tsx` existe, est un Server Component (pas de directive `'use client'`), exporte `metadata: Metadata` avec `title: 'Accessibilite - roxanetnous'` et `description` non vide.

5. **AC2 - Pattern projet `<main>` respecte** : la page suit strictement le pattern des pages statiques publiques jumelles (`app/mentions-legales/page.tsx`, `app/cgu/page.tsx`, `app/politique-de-confidentialite/page.tsx`) :
   - Wrapper externe `<div className="min-h-screen flex flex-col kraft bg-kraft">`.
   - `<main id="main-content" tabIndex={-1} className="flex-1 max-w-3xl mx-auto px-4 py-12 relative z-10 focus:outline-none">`.
   - Lien retour accueil en debut de `<main>` (`<Link href="/" className="text-sm text-black/50 hover:text-black transition">Retour a l'accueil</Link>`).
   - `<h1 className="text-3xl font-bold text-black mt-6 mb-8">Accessibilite</h1>` immediatement apres le lien retour.
   - `<Footer />` rendu apres le `<main>`, dans le wrapper externe.

6. **AC3 - 5 sections de contenu** : la page contient 5 `<section>` distinctes avec `<h2 className="text-lg font-semibold text-black mb-2">` titre, dans cet ordre :
   1. **Niveau de conformite** : « roxanetnous est partiellement conforme au RGAA 4.1, niveau AA partiel ». Mentionne la date de la derniere evaluation (2026-05-06, fin du Lot B).
   2. **Resultats des tests** : enumere les tests automatises executes (`eslint-plugin-jsx-a11y` baseline 155, `axe-core/Playwright` 0 violation Critical/Serious sur **7 parcours**) et les tests manuels narratifs (VoiceOver macOS sur messagerie, onboarding, formulaires - 3 echantillons documentes Lot B).
   3. **Limites connues** : carte Leaflet neutralisee (`aria-hidden`+`inert`) avec alternative champs ville/rayon adjacents ; pages admin (back-office) non auditees ; cible tactile 44x44 px non auditee systematiquement.
   4. **Contact** : `roxanetnous@outlook.com` (mailto) pour signaler un defaut d'accessibilite.
   5. **Engagement amelioration** : prochaine revue programmee (re-run NFR a11y semestriel a partir de 2026-05-06).

7. **AC4 - Lien « Accessibilite » ajoute au footer** : `components/footer.tsx` rend un quatrieme `<Link href="/accessibilite">Accessibilite</Link>` dans le `<nav aria-label="Liens legaux">`, place dans l'ordre suivant : « Mentions legales », « Politique de confidentialite », « Accessibilite », « CGU ». Classes Tailwind identiques aux 3 liens existants (`text-sm text-black hover:text-black transition`).

8. **AC5 - Pas de regression a11y** : `npm run lint:a11y-check` vert (baseline 155 stable, aucun nouveau probleme jsx-a11y introduit). `npm run a11y:axe:check` vert (la nouvelle page n'introduit pas de violation Critical/Serious - elle n'est pas encore dans les 7 parcours mais ne doit pas casser ceux qui existent, et un test rapide manuel est mene Sub 4.2).

9. **AC6 - Lecture lineaire VoiceOver OK (test manuel a la charge utilisateur)** : sur Safari macOS avec VoiceOver active (`Cmd+F5`), la lecture lineaire de la page `/accessibilite` annonce dans l'ordre : skip-link, lien retour, h1 « Accessibilite », puis chaque h2 et son contenu. Aucun element decoratif n'est annonce a tort.

## Tasks / Subtasks

- [x] **Task 1 - Creation de la page Server Component** (AC: #1, #2, #3)
  - [x] Sub 1.1 : Creer le repertoire `app/accessibilite/` (mkdir).
  - [x] Sub 1.2 : Creer `app/accessibilite/page.tsx` en Server Component (sans `'use client'`). Imports requis : `import type { Metadata } from 'next'`, `import Link from 'next/link'`, `import { Footer } from '@/components/footer'`.
  - [x] Sub 1.3 : Exporter `const metadata: Metadata = { title: 'Accessibilite - roxanetnous', description: 'Engagement et limites d\'accessibilite de roxanetnous.' }`.
  - [x] Sub 1.4 : Implementer la structure JSX strictement alignee sur `app/cgu/page.tsx` (wrapper `min-h-screen flex flex-col kraft bg-kraft`, `<main>` avec classes identiques, lien retour, h1, sections, `<Footer />`). Voir Dev Notes §Pattern de reference.
  - [x] Sub 1.5 : Renseigner les 5 sections (niveau, resultats, limites, contact, engagement) selon le contenu specifie en AC3 (textes complets dans Dev Notes §Contenu attendu). Utiliser exactement les memes classes Tailwind que `mentions-legales` (`<div className="space-y-8 text-gray-700 text-sm leading-relaxed">` puis `<section>` avec `<h2 className="text-lg font-semibold text-black mb-2">`).
  - [x] Sub 1.6 : Pour le contact, utiliser un lien `<a href="mailto:roxanetnous@outlook.com">` avec classes texte alignees aux liens existants des autres pages legales (`text-black hover:underline` ou equivalent identifie en lisant les pages jumelles). Si pattern absent, utiliser `text-black underline` sobre.

- [x] **Task 2 - Ajout lien footer** (AC: #4)
  - [x] Sub 2.1 : Editer `components/footer.tsx` pour inserer un quatrieme `<Link href="/accessibilite">Accessibilite</Link>` entre « Politique de confidentialite » et « CGU » (ordre semantique : legaux historiques d'abord, accessibilite, conditions usage en dernier - choix retenu pour eviter de casser le tab order existant en placant le nouveau lien en queue).
  - [x] Sub 2.2 : Classes Tailwind du nouveau lien strictement identiques aux 3 existants : `text-sm text-black hover:text-black transition`.
  - [x] Sub 2.3 : Verifier visuellement que le `<nav>` reste lisible avec 4 liens (gap-6 actuel suffisant ; sur mobile le `flex-col md:flex-row` doit gerer le retour a la ligne sans surprise). **N/A dev-story** : verification visuelle a la charge utilisateur ; structure JSX inchangee a part l'ajout du quatrieme lien.

- [x] **Task 3 - Verifications statiques (a la charge agent dev-story)** (AC: #5)
  - [x] Sub 3.1 : `npx tsc --noEmit` -> 0 erreur de typage (Metadata correctement importee, Footer correctement importe).
  - [x] Sub 3.2 : `npm run lint:a11y-check` -> `OK: 155 jsx-a11y violations across 56 (file, rule) pair(s). Baseline total: 155. No regression.`
  - [x] Sub 3.3 : `npm run a11y:axe:check` -> `OK: aucun delta Critical/Serious au-dela du baseline.` (7 parcours audites).

- [x] **Task 4 - DoD a11y + verifications visuelles + manuelle** (AC: #6)
  - [ ] Sub 4.1 : Verification visuelle dev (page rendu OK, layout coherent avec mentions-legales). **N/A dev-story** : a la charge utilisateur.
  - [ ] Sub 4.2 : Test rapide VoiceOver `/accessibilite` (Cmd+F5 sur Safari). **N/A dev-story** : a la charge utilisateur. Marquer N/A si VoiceOver indisponible.
  - [x] Sub 4.3 : DoD a11y cochee ci-dessous.

- [ ] **Task 5 - Commits**
  - [ ] Sub 5.1 : Commit 1 livraison `Story 2.7.3 : page publique accessibilite`. **A executer par l'utilisateur** (regle projet : Claude ne commit pas sans demande explicite).
  - [ ] Sub 5.2 : Push + CI Vercel verte. **A executer par l'utilisateur**.
  - [ ] Sub 5.3 : Commit 2 cloture (`Status: done`). **A executer par l'utilisateur** apres CI Vercel verte.

### Review Findings (passe 3 - 2026-05-06)

Troisieme code review du 2026-05-06 (3 layers : Blind Hunter, Edge Case Hunter, Acceptance Auditor). Acceptance Auditor : tous les AC respectes, patches et decisions des passes 1 et 2 verifies. 28 findings bruts triages. 1 decision-needed, 0 patch, 3 defer, 24 dismiss.

**Decision-needed (1) :**

- [x] [Review][Decision] **Tranche 2026-05-06 : option 3 (defer)** -- Footer overflow viewport <320px (4 liens en `flex gap-6` sans `flex-wrap`) [components/footer.tsx:11]. Justification utilisateur : cible 320px hors DoD a11y projet (zoom 200% non audite, cf. AC3 limites connues), siblings footer identiques (story de polish footer transverse plutot que 2.7.3 specifique), aucun parcours axe-core ne couvre cette largeur, risque cosmetique uniquement. Defer ajoute a `deferred-work.md` (passe 3).

**Patch (0) :** aucun.

**Defer (3) :**

- [x] [Review][Defer] Date dupliquee « 6 mai 2026 » a 2 endroits sans constante partagee [app/accessibilite/page.tsx:32-35] — risque de desync a la prochaine maj. Pattern accepte passe 1 decision 2b (etablissement + derniere mise a jour distinctes), pas un bug, dette de maintenance editoriale.
- [x] [Review][Defer] Sitemap `lastModified: new Date()` recalcule a chaque fetch [app/sitemap.ts:17] — pre-existant sur les 7 entrees du sitemap, non introduit par 2.7.3. Defeats `changeFrequency: 'yearly'` cote crawler. A traiter de facon transverse sur toutes les pages statiques (story sitemap dediee).
- [x] [Review][Defer] Tokens techniques anglais sans `lang="en"` switch [app/accessibilite/page.tsx:43-50] (`axe-core`, `Playwright`, `VoiceOver`, `eslint-plugin-jsx-a11y`) — TTS francais peut mal prononcer. Hors DoD projet (tests TTS narratifs Lot B couvrent messagerie/onboarding/formulaires, pas la page de declaration). A wrapper en `<span lang="en">` si une revue manuelle TTS est demandee plus tard.

**Dismiss (24) :**

- Pas de header/nav above main (Blind) — le header global est rendu via `app/layout.tsx`, pattern projet pages publiques.
- `text-black hover:text-black` no hover affordance (Blind footer) — pre-existant 3 autres liens, dismiss passe 2.
- `text-black/50` retour link contraste (Blind) — pattern projet pages jumelles cgu/mentions-legales.
- `text-gray-700` sur `bg-kraft` contraste (Blind) — defer pre-existant passe 1 et 2.
- `tabIndex={-1}` + `focus:outline-none` masque focus (Blind) — defer pre-existant passe 1.
- `underline hover:no-underline` mailto inverse (Blind) — pattern visuel valide (texte garde role lien via underline base).
- « AA partiel » non standard RGAA (Blind) — passe 2 decision 2 a tranche : non-assujetti, pas de modele officiel obligatoire.
- Champs RGAA officiels manquants (entite, navigateurs, methode, recours) (Blind) — passe 2 decisions 2 et 3 ont tranche.
- Date 6 mai 2026 future risque (Blind) — date du jour reelle, pas future.
- Espaces insecables typo francaise (Blind) — passe 2 dismiss (subjectif).
- `inert` claim falsifiable (Blind+Edge) — verifie en code : `components/ui/map-radius-inner.tsx:38` applique bien `aria-hidden="true" inert`. False positive.
- Email `outlook.com` (Blind) — defer pre-existant passes precedentes.
- `<code>` sur `bg-kraft` non style (Blind+Edge) — sibling pages n'utilisent pas `<code>`, style UA par defaut, cosmetique.
- Apostrophe entity inconsistency description metadata (Blind) — passe 2 dismiss.
- `<title>` sans suffixe (Blind) — passe 1 decision 1 deja resolue (template `%s | roxanetnous`).
- `relative z-10` cargo-culte (Blind) — passe 2 dismiss, pattern partage.
- Footer link order divergence convention (Edge) — AC4 dicte explicitement l'ordre, dismiss passe 2.
- `<code>` doublon (Edge) — fusionne avec dismiss precedent.
- `inert` doublon (Edge) — fusionne avec verification false positive.
- Sibling pages n'exportent pas metadata regression hypothetique (Edge) — pas un blocker 2.7.3, dette siblings hors scope.
- OG/Twitter pas override (Edge) — enhancement, pas bug.
- Email mailto vs siblings placeholder bracketed (Edge) — choix conscient, mailto reel = bonne pratique RGAA.
- Acceptance Auditor passe 3 : aucun nouveau concern, tous AC OK.
- `changeFrequency: yearly` contredit revue semestrielle (Blind) — incoherence semantique uniquement, sibling pages identiques, defer si patch souhaite.

**Verdict Acceptance Auditor (passe 3) :** tous les AC respectes (commun 1-3, AC1-AC6 strict). Patches et decisions des passes 1 et 2 verifies en place. Aucune nouvelle violation d'AC.

### Review Findings (passe 2 - 2026-05-06)

Deuxieme code review du 2026-05-06 (3 layers : Blind Hunter, Edge Case Hunter, Acceptance Auditor). Acceptance Auditor : tous les AC respectes, patches et decisions de la passe 1 verifies. 29 findings bruts triages. 4 decision-needed, 2 patch, 7 defer, 16 dismiss.

**Decision-needed (4) — toutes resolues 2026-05-06 :**

- [x] [Review][Decision] Incoherence « 7 parcours » vs enumeration a 6 dans la section Resultats des tests [app/accessibilite/page.tsx:41-43] — **Choix retenu : 1c** (lister les 7 entrees baseline). Patch applique : enumeration corrigee en « landing, recherche, login proxy onboarding accompagnante, messagerie, inscription accompagnante, login proxy inscription, suppression RGPD ». Aligne sur la decision Story 2.7.4 (`.claude/CLAUDE.md` ligne 6 « 7 parcours »).
- [x] [Review][Decision] Mention RGAA non conforme au modele officiel [app/accessibilite/page.tsx:22-29] — **Choix retenu : 1** (clarification statut MVP non assujetti). Patch applique : ajout du paragraphe « roxanetnous est une plateforme privee non assujettie aux obligations legales de declaration d'accessibilite (article 47 de la loi 2005-102, decret 2019-768) ; cette declaration est publiee volontairement... ». Justification : roxanetnous est un service prive (<250 salaries, <50 M€ CA), donc non assujetti. Eviter la derive RGAA officielle (taux chiffre + derogations) qui n'a pas de sens hors entite assujettie.
- [x] [Review][Decision] Voie de recours « Defenseur des droits » absente de la section Contact [app/accessibilite/page.tsx:74-86] — **Choix retenu : 2** (ne pas l'ajouter). Justification : coherent avec la clarification « non assujetti » de la decision precedente. La voie de recours Defenseur des droits est specifique aux entites assujetties qui ont une obligation de reponse sous 3 mois.
- [x] [Review][Decision] Mailto comme unique canal de contact [app/accessibilite/page.tsx:79-85] — **Choix retenu : 2** (accepter MVP). Justification : l'adresse email est deja visible dans le label du lien (donc copiable), coherent avec `mentions-legales` qui ne fournit qu'un placeholder telephone. A reconsiderer quand un canal alternatif (formulaire, telephone reel) sera disponible (defer pre-existant passe 1 sur l'email outlook.com).

**Patch (2) — appliques 2026-05-06 :**

- [x] [Review][Patch] Sitemap omet `/accessibilite` [app/sitemap.ts:10-18] — **Applique** : ajout de `{ url: \`${BASE_URL}/accessibilite\`, lastModified: new Date(), changeFrequency: 'yearly', priority: 0.3 }` entre `/politique-de-confidentialite` et `/cgu`. La page publique est desormais decouvrable par les crawlers SEO.
- [x] [Review][Patch] `metadata.description` sans mention RGAA/declaration [app/accessibilite/page.tsx:7] — **Applique** : description mise a jour en « Declaration d'accessibilite RGAA 4.1 de roxanetnous : niveau de conformite, resultats des tests, limites connues et contact pour signaler un defaut. ». SEO ameliore sur requetes type « roxanetnous declaration accessibilite RGAA ».

**Defer (7) :**

- [x] [Review][Defer] Espaces insecables dans listes peuvent forcer overflow horizontal a zoom 200% sur mobile <320px [app/accessibilite/page.tsx:61] — deferred, edge case pas dans la DoD a11y projet (zoom 200% non audite systematiquement, voir AC3 limites connues « cible tactile 44x44 px non auditee systematiquement »).
- [x] [Review][Defer] `<code>` contraste/zoom non verifie sur `bg-kraft` [app/accessibilite/page.tsx:36-42, 59] — deferred, page hors 7 parcours axe (cf. defer pre-existant ligne 95 spec passe 1).
- [x] [Review][Defer] Email `outlook.com` adresse personnelle pour obligation legale [app/accessibilite/page.tsx:80] — deferred, probleme global hors story 2.7.3 (defer pre-existant ligne 96 spec passe 1).
- [x] [Review][Defer] `text-gray-700` sur `bg-kraft` contraste limite [app/accessibilite/page.tsx:20] — deferred, defer pre-existant ligne 95 spec passe 1.
- [x] [Review][Defer] Pas de `<time datetime>` autour des dates [app/accessibilite/page.tsx:25,28,92] — deferred, pattern projet (les pages jumelles n'utilisent pas non plus `<time>`).
- [x] [Review][Defer] Lien « Retour a l'accueil » texte identique entre 4 pages [app/accessibilite/page.tsx:14-16] — deferred, pattern partage avec `cgu`, `mentions-legales`, `politique-de-confidentialite`.
- [x] [Review][Defer] Pas de lien interne vers pages jumelles depuis le contenu [app/accessibilite/page.tsx] — deferred, asymetrie minor avec `cgu/page.tsx:91-94` qui linke vers la politique. Faible impact.

**Dismiss (16) :**

- Page sans header/nav (Blind) — pattern projet pages jumelles (cgu, mentions-legales).
- Date de publication ignore Lot C en cours (Blind) — faux : la story 2.7.3 EST le Lot C, la declaration pose le statut au 6 mai 2026.
- `aria-hidden`+`inert` carte Leaflet non verifiable depuis ce diff (Blind) — vu hors story (Lot B 2.6.6).
- Classe `kraft bg-kraft` redondante (Blind) — pattern pre-existant cgu/mentions-legales l.6.
- `relative z-10` code mort (Blind) — pattern pre-existant cgu/mentions-legales l.7.
- Engagement « revue semestrielle » sans plan verifiable (Blind) — decision passe 1 deja tranchee 2b (formule prospective).
- Espaces insecables typo inegale (Blind) — subjectif, pas une violation.
- `lang="fr"` non visible (Blind, hypothesis) — defini dans `app/layout.tsx`.
- Ordre footer non conventionnel (Blind) — AC4 dicte explicitement l'ordre.
- `hover:text-black` repete DRY (Blind) — out-of-scope nit.
- `&apos;` echappes JSX (Blind) — convention projet.
- Ancre `#main-content` focus invisible (Edge) — defer pre-existant ligne 94 spec passe 1.
- Tab order change footer 4 vs 3 liens (Edge) — AC4 demande l'insertion explicite.
- Dates « etablie » et « derniere MaJ » identiques (Edge) — patch decision 2 passe 1, intentionnel jusqu'a la prochaine edition.
- Lien hover sans etat distinct (Blind footer) — pattern pre-existant 3 autres liens du footer.
- Date publication 6 mai vs Lot C en cours, redondant avec dismiss precedent.

**Verdict Acceptance Auditor (passe 2) :** tous les AC respectes (commun 1-3 OK, AC1-6 OK strict). Tous les patches et decisions de la passe 1 verifies en place dans le code (`title: 'Accessibilite'`, baseline qualitative sans chiffre 155, ligne « Derniere mise a jour » distincte).

### Review Findings (passe 1 - 2026-05-06)

Code review du 2026-05-06 (3 layers : Blind Hunter, Edge Case Hunter, Acceptance Auditor). 0 violation d'AC detectee par Acceptance Auditor. 24 findings bruts triages. **Decisions tranchees + patch applique 2026-05-06.**

**Decision-needed (3) — resolues 2026-05-06 :**

- [x] [Review][Decision] Baseline « 155 violations » hardcodee dans le contenu — **Choix retenu : 1b** (wording qualitatif sans chiffre). Patch applique : ligne 35 reformulee en « `eslint-plugin-jsx-a11y` : baseline stable sur les patterns d'ecriture, surveillance continue en CI Vercel. ». Justification : la baseline est concue pour decroitre, exposer un compteur fige rend la page publique fausse au prochain mouvement. Le visiteur RGAA cherche le statut « partiellement conforme + tests automatises en CI », pas un nombre precis.
- [x] [Review][Decision] Dates et engagement prospectif statique — **Choix retenu : 2b** (ligne « Derniere mise a jour : 6 mai 2026 » distincte ajoutee, engagement prospectif conserve). Patch applique : section 1 « Niveau de conformite » + ligne « Derniere mise a jour : 6 mai 2026. ». Justification : aligne sur la pratique RGAA officielle (service-public.fr, beta.gouv.fr) qui distingue date d'etablissement et derniere revision. Maintenance future : actualiser uniquement la ligne « derniere mise a jour ».
- [x] [Review][Decision] Aucune couverture E2E/axe-core sur `/accessibilite` — **Choix retenu : 3b** (accepter la dette, passer en defer). Justification : page statique sans JS, sans formulaire, sans etat dynamique. Risque de regression silencieuse tres faible. Ajouter un 8eme parcours Playwright pour 100 lignes de markup fige n'est pas rentable. A reconsiderer si la page evolue avec composants client. Defer ajoute a `deferred-work.md`.

**Patch (1) — applique 2026-05-06 :**

- [x] [Review][Patch] Titre HTML duplique « Accessibilite - roxanetnous | roxanetnous » [app/accessibilite/page.tsx:6] — **Applique** : `title: 'Accessibilite - roxanetnous'` -> `title: 'Accessibilite'` (le template `%s | roxanetnous` de `app/layout.tsx:25-28` ajoute ` | roxanetnous`). Resultat correct dans l'onglet : `Accessibilite | roxanetnous`.

**Defer (6) — issues pre-existantes / pattern projet / dette acceptee :**

- [x] [Review][Defer] Pas d'`aria-current="page"` dans le footer [components/footer.tsx:13-35] — deferred, pre-existing (3 autres liens souffrent du meme defaut).
- [x] [Review][Defer] `focus:outline-none` sur `<main>` masque le focus du skip-link [app/accessibilite/page.tsx:13] — deferred, pre-existing (pattern partage par toutes les pages publiques cgu/mentions-legales/politique-de-confidentialite).
- [x] [Review][Defer] Contraste `text-gray-700` sur `bg-kraft` non valide par axe (page hors 7 parcours) [app/accessibilite/page.tsx:20] — deferred, pre-existing (lie au choix de couverture parcours, voir decision-needed #3).
- [x] [Review][Defer] Email `outlook.com` vs `roxanetnous.fr` — divergence projet [README.md, planning-artifacts] — deferred, pre-existing (probleme global hors story 2.7.3).
- [x] [Review][Defer] Lien « Retour a l'accueil » sans `focus-visible:` style explicite [app/accessibilite/page.tsx:14] — deferred, pre-existing (pattern partage avec les pages jumelles, repose sur l'UA par defaut).
- [x] [Review][Defer] Aucune couverture E2E/axe-core sur `/accessibilite` — deferred, dette acceptee 2026-05-06. Page statique faible risque, ajout d'un 8eme parcours Playwright non rentable. A reconsiderer si la page evolue avec JS / composants client.

**Verdict Acceptance Auditor :** tous les AC respectes (commun 1/2 OK, AC1-6 OK strict). 2 ecarts mineurs documentes en Completion Notes (`Accessibilite` avec accent + classe `pl-5` au lieu de `pl-6` du pseudo-code) defendables et conformes a l'intention « pattern projet reel » du Dev Notes §R1.

## Dev Notes

### Origine de la story

Story formelle du Lot C (mini-epic 2.7) cadree dans `tech-spec-lot-c-a11y.md` (2026-05-06). Le Lot B a leve la conformite technique sur 7 criteres FAIL bloquants ; le Lot C verrouille publiquement cette conformite par une page declarative. La story est isolee, sans dependance, et parallelisable avec 2.7.4 (bascule axe-check bloquant) et 2.7.5 (retro Lot B).

### Pattern de reference (CRITIQUE - aligner sur l'existant)

Le tech-spec donne un pseudo-code (lignes 204-232 de `tech-spec-lot-c-a11y.md`) qui ne correspond **pas** au pattern projet reel. Les pages publiques statiques en place (`mentions-legales`, `cgu`, `politique-de-confidentialite`) utilisent le pattern suivant. **Suivre ce pattern, pas le pseudo-code du tech-spec** :

```tsx
// app/accessibilite/page.tsx
import type { Metadata } from 'next'
import Link from 'next/link'
import { Footer } from '@/components/footer'

export const metadata: Metadata = {
  title: 'Accessibilite - roxanetnous',
  description: 'Engagement et limites d\'accessibilite de roxanetnous.',
}

export default function AccessibilitePage() {
  return (
    <div className="min-h-screen flex flex-col kraft bg-kraft">
      <main id="main-content" tabIndex={-1} className="flex-1 max-w-3xl mx-auto px-4 py-12 relative z-10 focus:outline-none">
        <Link href="/" className="text-sm text-black/50 hover:text-black transition">
          Retour a l&apos;accueil
        </Link>

        <h1 className="text-3xl font-bold text-black mt-6 mb-8">Accessibilite</h1>

        <div className="space-y-8 text-gray-700 text-sm leading-relaxed">
          <section>
            <h2 className="text-lg font-semibold text-black mb-2">Niveau de conformite</h2>
            <p>roxanetnous est partiellement conforme au RGAA 4.1, niveau AA partiel.</p>
            <p>Cette declaration a ete etablie le 6 mai 2026 a l&apos;issue du Lot B de mise en conformite (mini-epic 2.6).</p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-black mb-2">Resultats des tests</h2>
            <p>Tests automatises :</p>
            <ul className="list-disc pl-6 space-y-1">
              <li><code>eslint-plugin-jsx-a11y</code> : baseline 155 violations sur les patterns d&apos;ecriture, surveillance continue en CI Vercel.</li>
              <li><code>axe-core</code> via Playwright : 0 violation Critical/Serious sur 7 parcours critiques (landing, login proxy, recherche, messagerie, inscription/checkout, suppression RGPD).</li>
            </ul>
            <p>Tests manuels narratifs :</p>
            <ul className="list-disc pl-6 space-y-1">
              <li>VoiceOver macOS sur la messagerie, l&apos;onboarding accompagnante et les formulaires d&apos;inscription (3 echantillons documentes Lot B).</li>
            </ul>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-black mb-2">Limites connues</h2>
            <ul className="list-disc pl-6 space-y-1">
              <li>La carte interactive Leaflet de la recherche est neutralisee pour les technologies d&apos;assistance (<code>aria-hidden</code> + <code>inert</code>). L&apos;alternative non-visuelle complete est fournie par les champs « ville » et « rayon » adjacents.</li>
              <li>Les pages d&apos;administration (back-office) ne sont pas auditees : audience interne uniquement.</li>
              <li>La cible tactile 44 x 44 px n&apos;est pas auditee systematiquement ; verification au cas par cas.</li>
            </ul>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-black mb-2">Contact</h2>
            <p>
              Pour signaler un defaut d&apos;accessibilite ou demander une alternative :
              {' '}
              <a href="mailto:roxanetnous@outlook.com" className="text-black underline hover:no-underline">roxanetnous@outlook.com</a>.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-black mb-2">Engagement d&apos;amelioration</h2>
            <p>
              Une revue d&apos;accessibilite est programmee semestriellement a partir de mai 2026
              (re-run de l&apos;evaluation NFR a11y et de la baseline axe-core). Les retours
              utilisateurs sont integres au backlog au fil de l&apos;eau.
            </p>
          </section>
        </div>
      </main>
      <Footer />
    </div>
  )
}
```

### Contenu attendu (textes definitifs reproduits AC3)

Les 5 sections ci-dessus sont **le contenu definitif** (pas un placeholder). Elles ont ete redigees a partir de :
- Mini-epic 2.5 (Lot A) : baseline lint, skip-link, focus, contrastes, motion, input accessible, header.
- Mini-epic 2.6 (Lot B) : axe-core 7 parcours, messagerie, onboarding, erreurs, carte hero, audit Leaflet, h1 unique.
- `lot-b-bilan-axe-core-2026-05-06.md` : 0 violation Critical/Serious final.
- `inventaire-points-usage-lot-c-2026-05-06.md` §2.7.3 : trame editoriale de reference.
- `audit-a11y-2026-05-04.md` : NFR a11y initial.

**Limites « cible tactile » et « pages admin »** : declarees explicitement par honnetete editoriale (recommandation RGAA, evite le risque R4 du tech-spec).

**Contact `roxanetnous@outlook.com`** : meme adresse que `mentions-legales` ligne 22.

**Date « 6 mai 2026 »** : fin du Lot B confirmee par les commits `2.6.7-C` du 2026-05-06 (cf. memory `project_a11y_lot_b.md`).

### Source tree fichiers a toucher (2)

- `app/accessibilite/page.tsx` (nouveau, Server Component statique).
- `components/footer.tsx` (modifie, ajout d'un 4eme `<Link>`).

**Hors scope** : aucun nouveau composant. Aucune modification de `app/layout.tsx`, `app/sitemap.ts`, `app/robots.ts` (les pages legales existantes n'y sont pas referencees explicitement, donc cohrence avec l'existant - ne pas les ajouter dans cette story).

### Risques identifies

| ID | Risque | Mitigation |
|---|---|---|
| **R1** | Ecart entre pseudo-code tech-spec et pattern projet reel (mentions-legales) | Dev Notes §Pattern de reference fige le pattern projet. **Ignorer le pseudo-code du tech-spec, suivre `app/cgu/page.tsx`**. |
| **R2** | Engagements editoriaux non tenus (« revue semestrielle » sans plan reel) | Limites declarees explicitement. Engagement formule au futur conditionnel raisonnable, pas un SLA contractuel. |
| **R3** | Lien footer casse l'alignement visuel sur mobile (4 liens dans `flex gap-6`) | Pattern `flex-col md:flex-row` existant gere deja le retour a la ligne. AC4 verifie l'alignement visuel. |
| **R4** | `<a href="mailto:">` declenche une regle jsx-a11y inattendue | Verification Sub 3.2 (`lint:a11y-check`). Pattern `<a href="mailto:...">` deja accepte ailleurs dans le projet (cf. `mentions-legales` qui a un `<p>Email : roxanetnous@outlook.com</p>` sans lien - ici on ajoute le `mailto:` pour faciliter l'usage). |
| **R5** | Page non incluse dans les 7 parcours axe-core, donc audit manuel uniquement | Acceptable (story isolee, page statique sans formulaire). Sub 4.2 fournit verification VoiceOver manuelle. Pas de bloquant pour AC. |

### Project Structure Notes

- Cette page suit le pattern des **pages publiques statiques juridiques** (`mentions-legales`, `cgu`, `politique-de-confidentialite`) et non le pattern **pages applicatives** (qui utilisent des composants client extraits, des layouts dashboards, etc.).
- Le pattern `<main id="main-content" tabIndex={-1} ... focus:outline-none>` est conforme convention Lot A 2.5.2 (skip-link) et Lot C 2.7.1/2.7.6 (`<main>` cote Server Component).
- Le `<h1>` unique est immediatement apres le lien retour, dans le `<main>`. Convention Lot B 2.6.7 respectee (`<h1>` dans le `<main>`, premier titre rencontre).
- Garde-fou DOM Lot C : `grep -rn 'id="main-content"' components/ | wc -l` doit rester `0` apres la story (le footer n'a pas de `<main>`, le composant client `LoginForm` non plus, etc.). `grep -rn 'id="main-content"' app/ | wc -l` passe de 32 a 33 apres ajout de cette page.

### References

- [Source: _bmad-output/implementation-artifacts/tech-spec-lot-c-a11y.md#Story 2.7.3] - cadrage AC contour, pseudo-code (a corriger via Dev Notes ci-dessus)
- [Source: _bmad-output/planning-artifacts/inventaire-points-usage-lot-c-2026-05-06.md#2.7.3] - trame editoriale de reference
- [Source: _bmad-output/implementation-artifacts/lot-b-bilan-axe-core-2026-05-06.md] - resultats quantitatifs Lot B (baseline 0)
- [Source: _bmad-output/planning-artifacts/audit-a11y-2026-05-04.md] - NFR a11y initial
- [Source: app/mentions-legales/page.tsx] - pattern projet de reference (a copier strictement pour la structure)
- [Source: app/cgu/page.tsx] - pattern projet de reference (variante)
- [Source: components/footer.tsx] - point d'integration AC4
- [Source: _bmad-output/implementation-artifacts/2-7-1-refactor-main-pages-client.md] - convention `<main>` cote Server Component Lot C
- [Source: .claude/CLAUDE.md] - regles projet (pas d'emojis, DoD a11y obligatoire)

## Dev Agent Record

### Agent Model Used

claude-opus-4-7 (Opus 4.7, 1M context) via Claude Code dev-story workflow

### Debug Log References

- `npx tsc --noEmit` : 0 erreur (TypeScript compilation completed).
- `npm run lint:a11y-check` : `OK: 155 jsx-a11y violations across 56 (file, rule) pair(s). Baseline total: 155. No regression.`
- `npm run a11y:axe:check` : `OK: aucun delta Critical/Serious au-dela du baseline.` Parcours audites: 7. Baseline `axe-core-baseline-2026-05-05.json` (commit a0cdb8a).
- Note environnement : avant le premier run axe vert, le cache turbopack `.next/dev/cache/turbopack/e07398321/` contenait des fichiers parasites duplique macOS (`LOG 2`, `CURRENT 2`) qui faisaient paniquer le runtime turbopack ("Failed to open database / Unexpected file in persistence directory"). Purge complete `rm -rf .next` puis nouveau run axe : OK. Probleme environnemental local sans impact sur le code de la story.

### Completion Notes List

- **Pattern projet vs pseudo-code tech-spec** : suivi strict du pattern `app/cgu/page.tsx` (Dev Notes §Pattern de reference). Wrapper `min-h-screen flex flex-col kraft bg-kraft`, `<main id="main-content" tabIndex={-1} ... focus:outline-none>`, lien retour `text-black/50 hover:text-black transition`, `<h1 className="text-3xl font-bold text-black mt-6 mb-8">`, conteneur `<div className="space-y-8 text-gray-700 text-sm leading-relaxed">`, `<Footer />` apres `<main>`.
- **Casse francaise** : la page utilise les diacritiques complets (Accessibilite -> Accessibilité, deja, etabli, etc.) pour s'aligner sur le rendu visible des pages jumelles (`mentions-legales`, `cgu`, `politique-de-confidentialite`) qui utilisent les accents francais corrects. Le titre `metadata` et le `<h1>` sont donc « Accessibilité » (et non « Accessibilite »). Les caracteres specifiques (`'`, espaces insecables) sont echappes via `&apos;` et `&nbsp;` conformement au pattern projet.
- **Listes Tailwind** : `pl-5` retenu (pattern `mentions-legales` / `cgu` / `politique-de-confidentialite`) plutot que `pl-6` du pseudo-code Dev Notes, par coherence stricte avec les pages jumelles.
- **Lien mailto** : `<a href="mailto:roxanetnous@outlook.com" className="text-black underline hover:no-underline">` - aucune regression jsx-a11y observee. Le pattern `mailto:` est nouveau dans les pages legales (les autres pages exposent l'email en texte brut), mais accepte par le baseline lint et coherent avec le besoin d'AC3 (lien actif pour signaler un defaut).
- **Footer** : 4eme `<Link>` insere entre « Politique de confidentialité » et « CGU », classes strictement identiques aux 3 existants. Ordre final : Mentions legales, Politique de confidentialite, Accessibilite, CGU.
- **Garde-fou DOM Lot C** : `grep -rn 'id="main-content"' app/ | wc -l` passe bien de 32 a 33 (verification ponctuelle effectuee). Aucun `id="main-content"` ajoute dans `components/`.
- **Tasks/Subtasks N/A** : Sub 4.1 (visuel) et Sub 4.2 (VoiceOver) restent non cochees - a la charge utilisateur conforme tech-spec. Sub 5.1/5.2/5.3 (commits) egalement a la charge utilisateur (regle projet `.claude/CLAUDE.md`).
- **Hors scope respecte** : aucune modification de `app/layout.tsx`, `app/sitemap.ts`, `app/robots.ts`. Aucun nouveau composant cree.

### File List

**Nouveaux fichiers** :
- `app/accessibilite/page.tsx` (Server Component statique, page publique `/accessibilite`).

**Fichiers modifies** :
- `components/footer.tsx` (ajout d'un 4eme `<Link href="/accessibilite">Accessibilité</Link>` dans la `<nav aria-label="Liens légaux">`).

### Change Log

| Date | Auteur | Description |
|---|---|---|
| 2026-05-06 | dev-story (Opus 4.7) | Implementation initiale Story 2.7.3 : creation page publique `/accessibilite` (Server Component, 5 sections RGAA 4.1) + ajout lien footer. tsc / lint:a11y-check / a11y:axe:check verts. Statut : ready-for-dev -> review. |

## DoD a11y

A renseigner pour toute story avec impact UI :

- [x] Labels associes aux champs (`htmlFor` ou `aria-labelledby`) - **N/A** (page statique sans champ de saisie).
- [x] Erreurs liees aux champs via `aria-describedby` + `aria-invalid` - **N/A** (idem).
- [x] Focus visible sur tous les elements interactifs (contraste >= 3:1) - heritage Lot A 2.5.3 token-focus-global. Lien retour, lien mailto et les 4 liens du footer heritent du focus ring global. Aucun override `outline-none` introduit (le `focus:outline-none` est uniquement sur le `<main>` programmatic-focus, pattern Lot A 2.5.2 / 2.7.1).
- [x] Contrastes texte >= 4,5:1 et UI >= 3:1 - heritage `text-black` sur `bg-kraft` (deja audite Lot A) et `text-gray-700` sur `bg-kraft` (deja utilise dans `mentions-legales` / `cgu` / `politique-de-confidentialite`). Aucun nouveau token couleur introduit.
- [x] ARIA states corrects sur composants dynamiques (`aria-expanded`, `aria-selected`, etc.) - **N/A** (pas de composant dynamique).
- [x] Navigation clavier complete (Tab, Enter, Escape) - skip-link `#main-content` Tab+Enter atteint le `<main>`, Tab dans le `<main>` atteint successivement le lien retour, le lien mailto puis les 4 liens du footer. Pattern Server Component identique a `cgu` et `mentions-legales` (deja valides Lot A/B).
- [ ] Verification ponctuelle au lecteur d'ecran (VoiceOver ou NVDA) sur le composant touche - **A la charge utilisateur** (Sub 4.2). Page statique, structure de titres lineaire (h1 unique + 5 h2), lecture lineaire attendue conforme.
- [x] Pas de regression `eslint-plugin-jsx-a11y` (`npm run lint:a11y-check` vert) - Sub 3.2 OK : baseline 155 stable.
- [x] Pas de regression axe-core (`npm run a11y:axe:check` vert) - Sub 3.3 OK : 0 delta Critical/Serious sur les 7 parcours audites.
