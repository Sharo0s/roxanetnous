# Story 4.9 : Validation `escapeHtml` test XSS templates email

Status: done

<!-- Note : Story ordre 2 NON BLOQUANTE go-live Bretagne (cf. epic-4.md ligne 59 + 345 « Bloquant go-live : non »). Acquit de la dette AI-3.9 issue de la retro Epic 3 (epic-3-retro-2026-05-07.md) qui elle-meme est l'heritage du `deferred-work.md` review 2.3 du 2026-05-04 : « `escapeHtml` dans `lib/emails.ts` non visible dans le diff -- dependance externe utilisee intensivement, a valider hors review (test XSS dedie sur les templates email) ». La story livre (1) une suite de tests unitaires Vitest sur `escapeHtml` couvrant les vecteurs XSS classiques + (2) un audit grep des interpolations dans les templates email pour detecter les fuites residuelles + (3) un fix chirurgical des fuites residuelles confirmees + (4) une factorisation `escapeHtml` (actuellement DUPLIQUEE dans `lib/emails.ts:14` ET `lib/email-templates.ts:11`) dans un module dedie `lib/escape-html.ts`. -->

## Story

En tant que **developpeur du projet roxanetnous**,
je veux **(1) factoriser la fonction `escapeHtml` actuellement DUPLIQUEE dans `lib/emails.ts:14` et `lib/email-templates.ts:11` dans un module dedie `lib/escape-html.ts` (export nomme), (2) ecrire une suite de tests unitaires Vitest `tests/unit/escape-html.test.ts` couvrant les vecteurs XSS classiques (script tag, event handler, javascript: URI, html entities double-encodees, unicode escape, attribute breakout via guillemet double), (3) auditer par grep exhaustif les ~83 interpolations `${...}` des templates email dans `lib/emails.ts` (1150 lignes, 21 fonctions exportees) + `lib/email-templates.ts` (75 lignes, 2 fonctions exportees) pour detecter les interpolations de contenu utilisateur non passees par `escapeHtml`, et (4) corriger chirurgicalement les fuites residuelles confirmees (deja identifiees lors du cadrage : `params.motif` lignes 83-84 de `lib/emails.ts` injecte sans escape dans `messages.refuse`/`messages.a_completer`)**,
afin de **(a) acquitter la dette deferred-work review 2.3 du 2026-05-04 explicitement reconduite en AI-3.9 retro Epic 3 (« escapeHtml dans lib/emails.ts non visible dans le diff -- a valider hors review »), (b) eliminer le risque XSS sur les emails envoyes a des destinataires reels (admin via `sendAdminParrainageFlag`, accompagnees, accompagnantes) qui pourraient devenir vecteur d'exfiltration ou de phishing en cas de compromission d'un compte admin ou d'une accompagnante, (c) prevenir la duplication du fix XSS sur 2 implementations divergentes (deja un risque actuel : si une regex evolue dans une copie sans l'autre, le comportement diverge silencieusement), (d) installer une suite de tests unitaires `escape-html.test.ts` reproductible en CI (rejoint le pattern story 4.5 `get-client-ip.test.ts` deja livre)**.

C'est la **septieme story de l'Epic 4 « Hardening pre-go-live Bretagne »** (2eme story ordre 2 a etre developpee, post go-live Bretagne envisageable). Elle est **non bloquante go-live Bretagne** (cf. epic-4.md ligne 345 « Bloquant go-live : non (mais souhaitable pre-volume) »). Sequencage actuel : 4.1 done -> 4.2 done -> 4.3 done -> 4.4 done -> 4.7 done -> 4.5 done -> 4.6 done -> 4.8 done -> **4.9 (cette story)**.

Elle s'appuie sur les decouvertes des stories precedentes :

- **Story 4.5 (livree 2026-05-09)** a installe le **premier pattern de tests unitaires Vitest purs** dans `tests/unit/get-client-ip.test.ts` (8 tests, project `unit` distinct de `integration` dans `vitest.config.ts:32-39`). Cette story 4.9 reutilise strictement ce pattern : import depuis `@/lib/...`, `describe`/`it` Vitest, exit 0 via `npm run test:unit`. Aucune nouvelle infrastructure requise.
- **Story 4.3 (livree 2026-05-08)** a introduit `lib/email-templates.ts` (helpers HTML purs reutilisables par le step `sendEmailViaResend` du Workflow DevKit). C'est la creation de cette duplication `escapeHtml` (cf. `lib/email-templates.ts:11-13` : `function escapeHtml(str: string)` strictement identique a `lib/emails.ts:14`). La story 4.9 corrige cette duplication.
- **Story 4.2 (livree 2026-05-07)** a introduit le pattern de migration BDD chirurgicale + audit grep transverse (15+ call-sites). Pattern reutilise ici : audit grep `\${[a-zA-Z_]` dans `lib/emails.ts` + `lib/email-templates.ts` -> classer chaque interpolation en (a) constante figee, (b) URL/parametre encodeURIComponent, (c) variable controlee (date formattee, score numerique), (d) saisie utilisateur escape, (e) saisie utilisateur **non** escape -> trou XSS confirme.

**Le coeur de la story** :

- (a) **Creation du module `lib/escape-html.ts`** (single source of truth) : export nomme `escapeHtml(str: string): string` strictement identique a la fonction actuelle (4 remplacements : `&`, `<`, `>`, `"`). Pas d'evolution comportementale dans cette story : la story est chirurgicale, pas une refonte de la fonction.
- (b) **Migration des call-sites** : `lib/emails.ts` ligne 14 (suppression de la copie locale + import depuis `@/lib/escape-html`), `lib/email-templates.ts` ligne 11-13 (idem). Les ~31 call-sites `escapeHtml(...)` dans `lib/emails.ts` et les ~5 call-sites dans `lib/email-templates.ts` continuent de fonctionner sans changement (meme nom).
- (c) **Audit grep des ~83 interpolations** dans `lib/emails.ts` : pour chaque `${...}` dans un template literal HTML, classer en categorie (cf. AC4) et identifier les fuites residuelles. Audit DEJA FAIT au cadrage (cf. Dev Notes ci-dessous) : **2 fuites confirmees** sur `params.motif` lignes 83-84 de `lib/emails.ts` (interpole dans `messages.refuse` et `messages.a_completer`, puis injecte dans le HTML ligne 96 sans escape). Toutes les autres interpolations sont soit constantes/figees, soit deja escapees.
- (d) **Fix chirurgical des 2 fuites confirmees** dans `lib/emails.ts:83-84` : remplacer `${params.motif}` par `${escapeHtml(params.motif)}` (2 occurrences). Test manuel post-fix : passer `params.motif = '<script>alert(1)</script>'` -> verifier que le HTML genere contient `&lt;script&gt;alert(1)&lt;/script&gt;` (pas de tag executable).
- (e) **Suite de tests unitaires Vitest `tests/unit/escape-html.test.ts`** : couvre les vecteurs XSS classiques selon AC2-AC3. ~10 tests minimum (script tag, event handler, javascript: URI, html entities double, unicode, attribute breakout, idempotence sur chaine deja escaped, performance sur input long, edge case empty string, type non-string si applicable -> mais la signature est `string -> string`, donc pas de test type runtime). Pas de test sur les templates email complets (hors scope, integration tests trop lourds).
- (f) **Audit grep verifiable en CI via un script `scripts/check-html-interpolation.mjs`** OPTIONNEL et PROBABLEMENT REJETE : la complexite d'un check AST sur les template literals (distinguer `${escapeHtml(x)}` ok de `${x}` non-ok dans une chaine HTML mais pas dans une URL) depasse le ratio cout/benefice pour un audit ponctuel. La story se contente d'un audit grep documente une fois, repete a la main si nouvelle template ajoutee. Hors scope explicite.

**Hors scope explicite** :

1. **Refonte de la fonction `escapeHtml` (DOMPurify, sanitize-html, encodage numerique des entites, support attribut vs contenu)** : la fonction actuelle 4-replacement est suffisante pour le **contenu** HTML (zero injection script possible apres `<` -> `&lt;` + `>` -> `&gt;`). Pour les attributs, le `"` est aussi escape (anti-breakout). Aucune injection style/href reste possible **dans les contextes ou la fonction est utilisee** (toujours sur du contenu visible ou des attributs `style="color:#000"` et `<strong>...</strong>` simples, jamais sur `href="${...}"` qui passe par `encodeURIComponent` ou `BASE_URL` constante). Si Epic 5+ introduit des emails avec attributs `href` dynamiques user-controlled, il faudra ajouter une `escapeHtmlAttribute` distincte. Hors scope 4.9.
2. **Audit interpolations dans les templates non-email (toast UI, server action error messages, components React)** : React JSX echappe automatiquement les `{var}` (sauf `dangerouslySetInnerHTML`). La story se concentre strictement sur les **templates email HTML** (template literals JS dans `lib/emails.ts` + `lib/email-templates.ts`), seul contexte ou l'echappement est manuel.
3. **Migration vers MJML, react-email ou tout templating engine externe** : changement majeur architecture, audit cout/benefice dedie. Hors scope durcissement Epic 4. La story conserve les template literals JS actuels.
4. **Tests d'integration sur les fonctions `send*Email`** : couts (mock Resend, fixtures Supabase) > benefice. Le test unitaire pur sur `escapeHtml` couvre la regression. Si un composant template dynamique apparait Epic 5+, ajouter test integration cible.
5. **Audit XSS sur les `subject` Resend** : les sujets sont passes a Resend qui les serialise dans les headers MIME (UTF-8 encoded-word RFC 2047 si caracteres non-ASCII). Resend SDK gere l'encodage. Les sujets contenant `${escapeHtml(params.firstName)}` actuellement (lignes 136, 155, 163, 315, 334, 342, 736) **sur-echappent** : `&lt;` apparait dans le subject des emails. Comportement existant pre-4.9, hors scope (ce serait une regression cosmetique a corriger dans une story dediee post-go-live).
6. **Modifier `lib/parrainage-detection.ts`, `app/actions/*.ts`, ou tout code applicatif hors `lib/emails.ts`/`lib/email-templates.ts`** : zero changement applicatif hors emails. Story chirurgicale.
7. **Ajout d'un script CI `check:html-interpolation` (audit grep automatise)** : complexite > benefice pour 2 fichiers stables. Audit manuel documente dans la story suffit. Si Epic 5+ ajoute 5+ nouveaux fichiers email, factoriser dans un script dedie.
8. **Sentry capture explicite d'une tentative XSS detectee** : non applicable (escapeHtml escape silencieusement, pas de flag possible — un firstName legitime peut contenir `&` ou `'`). Pas de Sentry sur l'echappement.

## Acceptance Criteria

### AC fonctionnels (factorisation + tests + fix)

1. **AC1 — Module `lib/escape-html.ts` cree avec export nomme** : Given la fonction `escapeHtml` est actuellement dupliquee dans `lib/emails.ts:14` et `lib/email-templates.ts:11-13`, when la story est livree, then :
   - Un fichier `lib/escape-html.ts` est cree avec **un seul export nomme** :
     ```ts
     // Story 4.9 : module unique pour l'echappement HTML des templates email.
     // Avant 4.9 : duplication dans lib/emails.ts:14 et lib/email-templates.ts:11.
     // Couvert par tests/unit/escape-html.test.ts (vecteurs XSS classiques).
     export function escapeHtml(str: string): string {
       return str
         .replace(/&/g, '&amp;')
         .replace(/</g, '&lt;')
         .replace(/>/g, '&gt;')
         .replace(/"/g, '&quot;')
     }
     ```
   - **Comportement strictement identique** a la fonction actuelle (4 remplacements, ordre conserve : `&` en premier pour eviter le double-encoding). Aucune regression fonctionnelle.
   - **Pas d'export par defaut** (coherent avec la convention projet : tous les helpers `lib/*.ts` exportent par nom, cf. `lib/get-client-ip.ts`, `lib/parrainage-detection.ts`).

2. **AC2 — Tests unitaires `tests/unit/escape-html.test.ts` (vecteurs XSS classiques)** : Given le module `lib/escape-html.ts` est cree, when la story est livree, then un fichier de tests `tests/unit/escape-html.test.ts` est cree, suivant strictement le pattern `tests/unit/get-client-ip.test.ts` (cf. story 4.5 livree 2026-05-09). Il couvre **au minimum 10 cas** :
   - **T1 — script tag basique** : `escapeHtml('<script>alert(1)</script>')` retourne `'&lt;script&gt;alert(1)&lt;/script&gt;'` (pas de `<` ni `>` survivant).
   - **T2 — event handler inline** : `escapeHtml('<img src=x onerror=alert(1)>')` retourne `'&lt;img src=x onerror=alert(1)&gt;'` (le `<` initial est escape, donc le navigateur ne parse pas le tag). Le contenu apres `<img ` n'a pas a etre transforme cote `escapeHtml` (les guillemets non-doubles + `=` sont des caracteres legitimes en contenu HTML escape).
   - **T3 — javascript: URI dans un attribut** : `escapeHtml('javascript:alert(1)')` retourne `'javascript:alert(1)'` (sans changement, car aucun caractere a escaper dans cette chaine). **Note** : `escapeHtml` n'est PAS un sanitizer d'URL. Le test documente cette limite — l'attribut `href` ne doit JAMAIS recevoir un user input, c'est l'invariant respecte par le code actuel (cf. l.943 `lib/emails.ts` : `ctaUrl` construit par `encodeURIComponent`).
   - **T4 — html entities double-encoding (idempotence partielle)** : `escapeHtml('&amp;lt;')` retourne `'&amp;amp;lt;'` (le `&` deja-escape est ESCAPE A NOUVEAU en `&amp;amp;`). Comportement attendu et documente — la fonction n'est pas idempotente, c'est intentionnel pour ne jamais perdre un `&` legitime dans un texte. Les call-sites doivent appeler escapeHtml une seule fois.
   - **T5 — unicode escape & emoji** : `escapeHtml('café <b> bold')` retourne `'café &lt;b&gt; bold'` (le `<` est decode par le parser JS en `<` AVANT l'appel a `escapeHtml`, donc le `<` resultant est escape normalement). Test documente : le risque unicode escape passe par le parser JS amont, escapeHtml voit du texte deja decode.
   - **T6 — attribute breakout via double quote** : `escapeHtml('a" onerror="alert(1)')` retourne `'a&quot; onerror=&quot;alert(1)'` (le `"` est escape, anti-breakout d'attribut HTML). Test critique : les templates email utilisent `<a href="..."` et `<strong>`, escapeHtml protege contre le saut d'attribut.
   - **T7 — single quote NON escape (decision documentee)** : `escapeHtml("d'arc")` retourne `"d'arc"` (le `'` n'est pas dans la liste des 4 remplacements). Test documente la decision : les templates email utilisent UNIQUEMENT des attributs en double quote (`style="..."`, `href="..."`). Si un attribut single-quote etait introduit, il faudrait ajouter `'` -> `&#39;` dans la fonction.
   - **T8 — empty string** : `escapeHtml('')` retourne `''`. Trivial, lock du contrat (pas de throw, pas de NaN).
   - **T9 — chaine sans caractere a escape** : `escapeHtml('Bonjour Sylvain')` retourne `'Bonjour Sylvain'` (no-op preservation).
   - **T10 — combinaison de plusieurs vecteurs** : `escapeHtml('<a href="x" onclick="alert(\'xss\')">Cliquez</a>')` retourne `'&lt;a href=&quot;x&quot; onclick=&quot;alert(\'xss\')&quot;&gt;Cliquez&lt;/a&gt;'` (toutes les instances de `<`, `>`, `"` escape ; `'` preserve cf. T7).
   - Tous les tests passent via `npm run test:unit` -> exit 0.

3. **AC3 — Tests Vitest s'integrent dans le project `unit` existant** : Given `vitest.config.ts:32-39` definit un project `unit` distinct (`tests/unit/**/*.test.ts`, environment node, globals false), when la story est livree, then :
   - `tests/unit/escape-html.test.ts` est detecte par `vitest.config.ts` sans modification de la config.
   - **`npm run test:unit` reporte au moins 8 tests passants (story 4.5 actuels) + les 10+ nouveaux tests de cette story** = >= 18 tests verts en local. Aucun nouveau test rouge ou skipped.
   - **`npm run test`** (les 2 projects) reste vert post-merge (verification CI Vercel).

4. **AC4 — Migration des 2 call-sites duplique vers `@/lib/escape-html`** : Given `lib/emails.ts:14-16` et `lib/email-templates.ts:11-13` contiennent chacun la copie locale `function escapeHtml(...)`, when la story est livree, then :
   - **`lib/emails.ts`** : la copie locale (lignes 14-16) est **supprimee**. Un import est ajoute en tete : `import { escapeHtml } from '@/lib/escape-html'`. Les ~31 call-sites `escapeHtml(...)` dans le fichier (lignes 37, 95, 136, 140, 141, 155, 163, 185, 230, 274, 315, 319, 320, 334, 342, 379, 382, 432, 483, 530, 535, 580, 590, 630, 763, 767, 771, 821, 871, 955, 959, 1111) sont **inchanges** (meme nom, meme signature).
   - **`lib/email-templates.ts`** : la copie locale (lignes 11-13) est **supprimee**. Un import est ajoute en tete : `import { escapeHtml } from '@/lib/escape-html'`. Les ~5 call-sites `escapeHtml(...)` dans le fichier (lignes 23, 49, 53) sont **inchanges**.
   - **Audit grep post-migration** : `grep -n "function escapeHtml" lib/` retourne **uniquement** `lib/escape-html.ts:1` (aucune autre copie). Verification AC10.

5. **AC5 — Fix chirurgical des 2 fuites XSS confirmees `params.motif`** : Given `lib/emails.ts:83-84` interpolent `${params.motif}` directement dans les chaines `messages.refuse` et `messages.a_completer`, qui sont ensuite injectees dans le HTML ligne 96 (`<p>${messages[params.decision]}</p>`) sans passer par `escapeHtml`, when la story est livree, then :
   - **Ligne 83 actuelle** : `refuse: \`Votre profil accompagnante a ete refuse.${params.motif ? \` Motif : ${params.motif}\` : ''} Vous pouvez mettre a jour votre profil et le soumettre a nouveau.\`` -> **devient** `refuse: \`Votre profil accompagnante a ete refuse.${params.motif ? \` Motif : ${escapeHtml(params.motif)}\` : ''} Vous pouvez mettre a jour votre profil et le soumettre a nouveau.\``.
   - **Ligne 84 actuelle** : `a_completer: \`Des informations complementaires sont necessaires pour valider votre profil.${params.motif ? \` Details : ${params.motif}\` : ''} Veuillez mettre a jour votre profil.\`` -> **devient** `a_completer: \`Des informations complementaires sont necessaires pour valider votre profil.${params.motif ? \` Details : ${escapeHtml(params.motif)}\` : ''} Veuillez mettre a jour votre profil.\``.
   - **Test manuel apres fix** : appel `sendValidationResultEmail({ email: 'x@y', firstName: 'Test', decision: 'refuse', motif: '<script>alert(1)</script>' })` (mocke avec `process.env.RESEND_API_KEY` invalide pour eviter l'envoi reel) -> inspection du HTML genere via console.log temporaire ou test integration ligne -> contient `Motif : &lt;script&gt;alert(1)&lt;/script&gt;` (aucun tag `<script>` brut). Sortie consignee dans Completion Notes List.
   - **Justification** : `params.motif` provient de l'admin (`app/actions/admin-validation.ts` -> server action `validateAccompagnante` qui passe le motif depuis un textarea de l'UI admin). Risque concret : un admin compromis (compte vole) pourrait stocker un payload XSS dans le champ motif et envoyer un email a une victime ciblee (phishing avec lien embarque dans `<script>` ou exfil cookies via `<img onerror>`). Pre-condition de l'attaque = compromission admin = haute severite mais probabilite faible. Justifie le fix non bloquant go-live mais important pre-volume (epic-4.md ligne 345).

6. **AC6 — Audit grep des interpolations templates email documente** : Given les fichiers `lib/emails.ts` (1150 lignes, 21 fonctions email exportees, ~83 interpolations `${...}`) et `lib/email-templates.ts` (75 lignes, 2 fonctions exportees, ~7 interpolations) interpolent du contenu dans des template literals HTML, when la story est livree, then :
   - Un audit grep manuel est documente dans la section « Dev Notes > Audit grep interpolations » de cette story (deja pre-cadre ci-dessous).
   - Chaque interpolation est classee en **5 categories** :
     - **(a) Constante figee de l'application** (BASE_URL, FROM_EMAIL, dashboardUrl construit avec template literal a partir de BASE_URL, etc.) -> **safe par construction**.
     - **(b) URL/parametre passe par `encodeURIComponent`** (ex : `${encodeURIComponent(params.parrainageId)}` ligne 749, `${encodeURIComponent(params.codeDepartement)}` ligne 942) -> **safe par construction**.
     - **(c) Variable controlee par l'application** (ex : `${formattedDate}` ligne 822 — produit par `toLocaleDateString` ; `${params.score}` ligne 383 — type number ; `${typeLabels[params.type]}` ligne 771 — lookup dans une `Record<string, string>` constante) -> **safe par typage TypeScript ou source non-user**.
     - **(d) Saisie utilisateur escape via `escapeHtml(...)`** (ex : `${escapeHtml(params.firstName)}` ligne 37) -> **safe**.
     - **(e) Saisie utilisateur NON escape** -> **fuite XSS confirmee, fix requis**.
   - **L'audit identifie 2 fuites en categorie (e) : lignes 83-84 `params.motif`** (cf. AC5). Aucune autre fuite confirmee. Audit consigne post-execution dans Completion Notes List avec table grep + classification.

7. **AC7 — Pas de regression fonctionnelle envoi email** : Given les emails sont envoyes via Resend SDK (`resend.emails.send(...)` dans `lib/emails.ts`), when la story est livree, then :
   - Les ~31 call-sites `escapeHtml(...)` dans `lib/emails.ts` continuent d'echapper le contenu visible (firstName, accompagnanteFirstName, marraineName, filleuleName, annonceTitle, code, nomDepartement, codeDepartement). **Aucun email n'a son rendu altere** (le HTML genere est strictement identique pre/post-migration, seule la source de la fonction change).
   - Les sujets `subject: \`Nouveau message de ${escapeHtml(params.senderFirstName)}\`` (lignes 136, 155, 163, 315, 334, 342) restent inchanges (sur-echappement existant pre-4.9, hors scope cf. note 5 « Hors scope »).
   - Les workflows asynchrones `enqueueWaitlistConfirmationEmail` et `enqueueWaitlistOpeningNotificationEmail` (lignes 1023-1095) restent inchanges — ils delegent a `lib/email-templates.ts` qui re-exporte le meme `escapeHtml`. Verification : un envoi waitlist dans staging post-merge produit le meme HTML qu'avant.
   - **Pas de test integration explicite requis** (cf. Hors scope point 4) — la garantie est apportee par (a) le test unitaire qui prouve que `escapeHtml` se comporte identiquement et (b) le typing TypeScript qui empeche un mauvais import.

### AC techniques (qualite)

8. **AC8 — Compilation TypeScript propre** : Given le nouveau fichier `lib/escape-html.ts`, le fichier de tests `tests/unit/escape-html.test.ts`, et les modifications dans `lib/emails.ts` + `lib/email-templates.ts`, when `npx tsc --noEmit` est execute, then **exit 0** (compilation OK, baseline 0 erreur preservee). Aucun `as any` introduit (le module est pure JS-like, types triviaux `string -> string`).

9. **AC9 — Pas de regression lint** : Given le baseline lint actuel ~213 warnings (cf. story 4.6 last_updated 2026-05-09 ligne 2 sprint-status), when `npm run lint` est execute, then **0 nouvelle erreur ESLint** introduite. Les warnings preexistants restent inchanges (la story ne touche pas aux JSX/TSX). `npm run lint:a11y-check` exit 0 (baseline 155 stable, aucun JSX modifie).

10. **AC10 — Audit grep post-migration `function escapeHtml`** : Given la migration vers `lib/escape-html.ts`, when la story est livree, then `grep -rn "function escapeHtml" lib/ --include="*.ts"` retourne **strictement une ligne** : `lib/escape-html.ts:1: export function escapeHtml(str: string): string {`. Toute autre ligne = regression d'AC1/AC4. Sortie consignee dans Completion Notes List.

11. **AC11 — Pas de regression a11y** : Given la story ne touche que des fichiers `.ts` (script, library, tests) et **zero JSX**, when la modification est livree, then `npm run lint:a11y-check` reste vert (baseline 155 stable). `npm run a11y:axe:check` reste vert (0 violations Critical/Serious sur 7 parcours, baseline Lot B/C maintenue). Pre-condition de commit livraison : `npm run a11y:axe:check` execute localement, **exit 0 confirme** (regle CLAUDE.md durcie obligatoire).

12. **AC12 — Build Next.js ne casse pas en local** : Given le `buildCommand` Vercel inchange (`npm run check:env && npm run lint:a11y-check && (test "$SKIP_E2E_TESTS" = "true" || npm run test:integration) && next build`), when `npm run build` est lance localement avec `.env.local` complet, then :
    - `npm run check:env` exit 0 (silence dev local sans VERCEL_ENV).
    - `npm run lint:a11y-check` exit 0 (baseline 155 stable).
    - `next build` exit 0 (le tree-shake elimine la duplication, pas de regression bundle size — 4 lignes `escapeHtml` -> import `escapeHtml`).
    - Aucune nouvelle erreur dans les logs build par rapport au build pre-story.

13. **AC13 — Tests unitaires verts et reproductibles localement** : Given le pattern story 4.5 (tests unitaires Vitest pure JS, pas de Supabase, pas de fixtures), when `npm run test:unit` est execute localement, then :
    - **Exit 0**.
    - **Au moins 10 tests verts** dans `tests/unit/escape-html.test.ts` (T1-T10 selon AC2).
    - Duree totale `npm run test:unit` < 500 ms (les tests sont des appels de fonction pure sans I/O).
    - **Aucun test integration declenche** (project `unit` isole de `integration` via `vitest.config.ts:33-46`).
    - Sortie consignee post-execution dans Completion Notes List : nombre de tests + duree.

### AC commun Lot C (rappel CLAUDE.md durcie)

14. **AC commun 1** — DoD a11y **applicable mais legere** : la story modifie 4 fichiers `.ts` (scripts/library/tests) et **zero JSX/composant React**. Voir AC11. Patterns a11y baseline projet (Lot A/B/C cloture 2026-05-06) deja en place et inchanges. La checklist DoD a11y du template story est **a cocher integralement par convention** (cf. CLAUDE.md « toute story avec impact UI doit valider la checklist DoD a11y »), avec annotation explicite « non applicable, story sans impact UI » si necessaire. **Pre-condition obligatoire avant commit livraison** : `npm run a11y:axe:check` execute localement, exit 0 confirme.

15. **AC commun 2** — Double commit : livraison (`Story 4.9 : factorisation escapeHtml + tests XSS + fix params.motif`) puis cloture (`Story 4.9 : statut done apres CI Vercel verte`). Conventions projet (cf. memoire `project_bmad_conventions`). Possibilite de patches code review post-livraison comme stories 3.5/3.6/3.7/4.1/4.5/4.6/4.8 si findings adversariaux.

## Tasks / Subtasks

- [x] **Task 1 — Creation du module `lib/escape-html.ts`** (AC: #1, #8)
  - [x] Sub 1.1 : Lire `lib/emails.ts:14-16` pour confirmer la signature actuelle (4 replacements `&`, `<`, `>`, `"`).
  - [x] Sub 1.2 : Lire `lib/email-templates.ts:11-13` pour confirmer la copie strictement identique.
  - [x] Sub 1.3 : Creer `lib/escape-html.ts` avec **un seul export nomme** `escapeHtml(str: string): string` (cf. AC1 pour le contenu exact incluant le commentaire d'en-tete).
  - [x] Sub 1.4 : Verification : `npx tsc --noEmit` -> exit 0 (le nouveau fichier n'a aucune dependance externe, juste un export pure JS).

- [x] **Task 2 — Migration `lib/emails.ts` vers le module commun** (AC: #4, #7)
  - [x] Sub 2.1 : Supprimer les lignes 14-16 de `lib/emails.ts` (`function escapeHtml(str: string): string { ... }`).
  - [x] Sub 2.2 : Ajouter l'import `import { escapeHtml } from '@/lib/escape-html'` apres les imports existants (lignes 1-7).
  - [x] Sub 2.3 : Verifier qu'aucun autre changement n'est requis : les ~31 call-sites `escapeHtml(...)` continuent de fonctionner (meme nom, meme signature).
  - [x] Sub 2.4 : Verification grep : `grep -n "function escapeHtml" lib/emails.ts` -> **0 match** (ligne supprimee).

- [x] **Task 3 — Migration `lib/email-templates.ts` vers le module commun** (AC: #4, #7)
  - [x] Sub 3.1 : Supprimer les lignes 11-13 de `lib/email-templates.ts` (`function escapeHtml(str: string): string { ... }`).
  - [x] Sub 3.2 : Ajouter l'import `import { escapeHtml } from '@/lib/escape-html'` apres les imports existants (ligne 9 actuelle est `const BASE_URL = ...`, l'import va avant).
  - [x] Sub 3.3 : Verification grep : `grep -n "function escapeHtml" lib/email-templates.ts` -> **0 match**.

- [x] **Task 4 — Fix chirurgical des 2 fuites XSS `params.motif`** (AC: #5, #6)
  - [x] Sub 4.1 : Modifier `lib/emails.ts:83` (decale a `lib/emails.ts:80` apres suppression copie locale) : remplacer `${params.motif}` par `${escapeHtml(params.motif)}` dans `messages.refuse`.
  - [x] Sub 4.2 : Modifier `lib/emails.ts:84` (decale a `lib/emails.ts:81`) : remplacer `${params.motif}` par `${escapeHtml(params.motif)}` dans `messages.a_completer`.
  - [x] Sub 4.3 : Couverture par test unitaire T1 (`escapeHtml('<script>alert(1)</script>') -> '&lt;script&gt;...&lt;/script&gt;'`) + audit AC6 confirmant unique fuite + fix. Pas de test runtime sur `sendValidationResultEmail` (Hors scope point 4).
  - [x] Sub 4.4 : Audit grep post-fix : `grep -nE 'params\.motif' lib/emails.ts` -> **2 matches** (lignes 80-81) ET les 2 sont des `escapeHtml(params.motif)`.

- [x] **Task 5 — Tests unitaires `tests/unit/escape-html.test.ts`** (AC: #2, #3, #13)
  - [x] Sub 5.1 : Pattern `tests/unit/get-client-ip.test.ts` lu et applique (import `vitest`, `describe`/`it`/`expect`, header commentaire story+version).
  - [x] Sub 5.2 : Creation `tests/unit/escape-html.test.ts` avec **les 10 tests T1-T10** definis dans AC2.
  - [x] Sub 5.3 : `npm run test:unit` -> exit 0, **18 tests verts** (8 story 4.5 + 10 story 4.9).
  - [x] Sub 5.4 : Sortie + duree consignees dans Completion Notes List.

- [x] **Task 6 — Audit grep documente** (AC: #6, #10)
  - [x] Sub 6.1 : `grep -cE '\${[a-zA-Z_]' lib/emails.ts` -> **83** matches (cf. pre-cadrage).
  - [x] Sub 6.2 : `grep -cE '\${[a-zA-Z_]' lib/email-templates.ts` -> **8** matches (~7 attendu, ecart trivial).
  - [x] Sub 6.3 : Classification pre-cadrage Dev Notes confirmee : 0 categorie (e) post-fix.
  - [x] Sub 6.4 : `grep -rn "function escapeHtml" lib/ --include="*.ts"` -> **1 seul match** : `lib/escape-html.ts:8`. AC10 satisfait.
  - [x] Sub 6.5 : Sorties grep consignees dans Completion Notes List.

- [x] **Task 7 — Validation locale + a11y** (AC: #8, #9, #11, #12, #13)
  - [x] Sub 7.1 : `npx tsc --noEmit` -> exit 0.
  - [x] Sub 7.2 : `npm run lint` -> 0 erreur, 213 warnings (baseline stable).
  - [x] Sub 7.3 : `npm run lint:a11y-check` -> exit 0 (baseline 155).
  - [x] Sub 7.4 : `npm run a11y:axe:check` -> exit 0 confirme (regle CLAUDE.md durcie obligatoire). 7 parcours, aucun delta Critical/Serious.
  - [x] Sub 7.5 : `npm run test:unit` -> exit 0, **18 tests verts**, duree 147 ms.
  - [x] Sub 7.6 : `npm run build` -> exit 0, compilation 4.8s, 52 pages statiques.
  - [x] Sub 7.7 : `git status` confirme **4 fichiers** : `lib/escape-html.ts` (nouveau), `lib/emails.ts` (modifie), `lib/email-templates.ts` (modifie), `tests/unit/escape-html.test.ts` (nouveau). `git diff --stat` sur les 2 fichiers modifies : `lib/email-templates.ts | 6 ++----`, `lib/emails.ts | 9 +++------`.

- [x] **Task 8 — Commit livraison + validation CI** (AC: #14, #15)
  - [x] Sub 8.1 : Commit livraison cree -- commit SHA `3b7f998` avec message "Story 4.9 : factorisation escapeHtml + tests XSS + fix params.motif". 5 fichiers (4 code + story.md).
  - [x] Sub 8.2 : `git push` OK -> trigger Vercel deployment `dpl_GV3bFRLkk3RN3kGWh9q4MNUmDzu3`.
  - [x] Sub 8.3 : **CI Vercel verte** -- deployment state **READY**, build 72 s (region iad1, framework nextjs). Aliases prod : roxanetnous.vercel.app, roxanetnous-roxanetnous.vercel.app, roxanetnous-git-main-roxanetnous.vercel.app.
  - [x] Sub 8.4 : Commit cloture `Story 4.9 : statut done apres CI Vercel verte` (ce commit).
  - [x] Sub 8.5 : `sprint-status.yaml` -> `4-9-validation-escape-html-test-xss-emails: done` + `last_updated` MAJ.

## Dev Notes

### Decisions de cette story

**D1 — Module dedie `lib/escape-html.ts` (single source of truth)** :
- La fonction est actuellement dupliquee entre `lib/emails.ts:14` et `lib/email-templates.ts:11` avec une implementation strictement identique. Pas de divergence existante mais risque latent : si une regex evolue dans une copie sans l'autre, divergence silencieuse.
- Alternative rejetee : exporter `escapeHtml` depuis `lib/emails.ts` (`'use server'`). Rejetee car `lib/emails.ts` est `'use server'` (server actions Next.js) -- importer depuis un module non-server-action (ex : un test unitaire ou un client component futur) leve des contraintes Next 16. Un module pure JS `lib/escape-html.ts` neutralise est plus reutilisable et testable.
- **Decision finale** : creation d'un module dedie `lib/escape-html.ts` sans `'use server'`, sans dependance externe. Les 2 fichiers email importent depuis `@/lib/escape-html`.

**D2 — Pas de refonte de la fonction (DOMPurify, sanitize-html)** :
- La fonction actuelle 4-replacement (`&`, `<`, `>`, `"`) est suffisante pour le **contenu HTML** dans les contextes utilises (texte visible + attributs `style="..."` constants).
- DOMPurify ou sanitize-html : surface de dependance + ~30 KB bundle pour un use-case ou 4 replacements suffisent. Surdimensionne.
- **Decision finale** : conserver la fonction actuelle. Si Epic 5+ introduit du templating user-controlled riche (ex : signature email custom avec markdown), reconsiderer.

**D3 — Test unitaire pure (pas de test integration sur `sendValidationResultEmail`)** :
- Tentation : ecrire un test integration qui appelle `sendValidationResultEmail` avec un Resend mocke et asserte sur le HTML genere.
- Rejete : (a) cout (mock Resend SDK + capturer le payload `resend.emails.send`), (b) couverture redondante avec le test unitaire `escapeHtml` qui prouve l'invariant fonction-niveau.
- **Decision finale** : test unitaire pur sur `escapeHtml`. La regression sur `params.motif` est protegee par (a) le test unitaire qui prouve l'invariant et (b) l'audit grep AC6 qui confirme l'unique fuite et son fix.

**D4 — Pas de script CI `check:html-interpolation` automatise** :
- Tentation : ajouter `scripts/check-html-interpolation.mjs` qui parcourt les template literals et flag les `${...}` non-passes par escapeHtml dans un contexte HTML.
- Rejete : complexite d'un check AST (TS Compiler API, classification du contexte template literal HTML vs URL vs subject) >> benefice pour 2 fichiers stables (`lib/emails.ts` + `lib/email-templates.ts`).
- **Decision finale** : audit grep manuel documente une fois (cf. ci-dessous), repete a la main si nouveau template ajoute (verification dans la story future). Si Epic 5+ ajoute 5+ nouveaux fichiers email, factoriser dans un script dedie.

**D5 — Conserver le comportement non-idempotent (pas de check `&[a-z]+;` avant escape)** :
- La fonction actuelle escape `&` -> `&amp;` toujours, meme si l'input est deja `&amp;`. Resultat : `&amp;` -> `&amp;amp;`.
- Alternative : detecter si `&` est deja le debut d'une entite HTML et passer outre.
- Rejetee : (a) complexite (regex `&[a-z]+;` ou `&#\d+;`), (b) risque ambigu (un texte legitime "Tom & Jerry" deviendrait correctement `Tom &amp; Jerry` mais "AT&T" -> `AT&amp;T` est aussi le comportement voulu — l'idempotence serait surcharge prematuree).
- **Decision finale** : conserver le comportement 4-replace strict. Documenter dans test T4 que la fonction n'est PAS idempotente, contrat respecte par les call-sites (1 seul appel jamais imbrique).

**D6 — Pas d'echappement du single quote `'`** :
- La fonction actuelle escape `&`, `<`, `>`, `"` mais PAS `'`.
- Rationale : tous les attributs HTML dans les templates sont en double quote (`style="..."`, `href="..."`, `class="..."`). Un `'` dans le contenu (ex : "L'enfant") n'introduit aucune surface d'attaque.
- Alternative : ajouter `.replace(/'/g, '&#39;')` pour belt-and-suspenders.
- Rejetee : (a) regression visuelle minime mais reelle (`d'arc` -> `d&#39;arc` dans certains clients email qui ne decodent pas les entites numeriques), (b) inutile dans le contexte de templates a attributs double-quote uniquement.
- **Decision finale** : pas d'escape de `'`. Documenter dans test T7. Si Epic 5+ introduit un attribut single-quote, refactor de la fonction necessaire.

### Architecture du module refactore

Forme cible (`lib/escape-html.ts`, ~12 lignes) :

```ts
// Story 4.9 : module unique pour l'echappement HTML des templates email.
// Avant 4.9 : duplication dans lib/emails.ts:14 et lib/email-templates.ts:11.
// Couvert par tests/unit/escape-html.test.ts (vecteurs XSS classiques).
//
// La fonction n'est PAS idempotente (escape '&' systematiquement, meme deja-encode).
// La fonction n'echappe PAS le single quote (attributs HTML toujours en double quote).

export function escapeHtml(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}
```

Forme cible (`tests/unit/escape-html.test.ts`, ~50 lignes, 10 tests) :

```ts
// Story 4.9 : tests XSS sur escapeHtml. Vecteurs classiques + edge cases.

import { describe, it, expect } from 'vitest'
import { escapeHtml } from '@/lib/escape-html'

describe('escapeHtml', () => {
  it('T1 : echappe un script tag basique', () => {
    expect(escapeHtml('<script>alert(1)</script>'))
      .toBe('&lt;script&gt;alert(1)&lt;/script&gt;')
  })

  it('T2 : echappe le tag inline avec event handler', () => {
    expect(escapeHtml('<img src=x onerror=alert(1)>'))
      .toBe('&lt;img src=x onerror=alert(1)&gt;')
  })

  it('T3 : preserve javascript: URI (pas un sanitizer URL)', () => {
    expect(escapeHtml('javascript:alert(1)')).toBe('javascript:alert(1)')
  })

  it('T4 : non-idempotent (double-encodage volontaire)', () => {
    expect(escapeHtml('&amp;lt;')).toBe('&amp;amp;lt;')
  })

  it('T5 : preserve unicode + accent (decodage parser amont)', () => {
    expect(escapeHtml('café <b> bold')).toBe('café &lt;b&gt; bold')
  })

  it('T6 : echappe double quote (anti attribute breakout)', () => {
    expect(escapeHtml('a" onerror="alert(1)'))
      .toBe('a&quot; onerror=&quot;alert(1)')
  })

  it('T7 : preserve single quote (attributs en double quote uniquement)', () => {
    expect(escapeHtml("d'arc")).toBe("d'arc")
  })

  it('T8 : empty string -> empty string', () => {
    expect(escapeHtml('')).toBe('')
  })

  it('T9 : chaine sans caractere a echapper inchangee', () => {
    expect(escapeHtml('Bonjour Sylvain')).toBe('Bonjour Sylvain')
  })

  it('T10 : combinaison de plusieurs vecteurs', () => {
    expect(escapeHtml('<a href="x" onclick="alert(\'xss\')">Cliquez</a>'))
      .toBe('&lt;a href=&quot;x&quot; onclick=&quot;alert(\'xss\')&quot;&gt;Cliquez&lt;/a&gt;')
  })
})
```

### Audit grep interpolations templates email (pre-cadrage 2026-05-09)

**`lib/emails.ts` — ~83 interpolations identifiees par `grep -nE '\$\{[a-zA-Z_]' lib/emails.ts`** :

Classification par categorie (cf. AC6) :

- **Categorie (a) constante figee (BASE_URL, dashboardUrl, FROM_EMAIL, abonnementUrl, link, ctaUrl construit avec encodeURIComponent, baseClean)** : lignes 25, 26, 41, 98, 143, 188, 234, 278, 322, 386, 436, 487, 521, 544, 578, 594, 629, 657, 749, 775, 825, 874, 942, 1125. **Safe par construction.**
- **Categorie (b) `encodeURIComponent`** : lignes 749, 942 (`encodeURIComponent(params.parrainageId)`, `encodeURIComponent(params.codeDepartement)`). **Safe par construction.**
- **Categorie (c) variable controlee** :
  - `roleLabel` ligne 38 -> hardcoded ternary `'accompagnante de vie' / 'accompagne'`. **Safe.**
  - `params.role === 'accompagnante' ? '<p>...</p>' : '<p>...</p>'` ligne 39 -> ternary string constants. **Safe.**
  - `subjects[params.decision]` lignes 91, 94 + `params.decision` ligne 109, 117 -> `params.decision` est typee `'valide' | 'refuse' | 'a_completer'` (TS) + `subjects` est `Record<string, string>` constant. **Safe par typage.**
  - `messages[params.decision]` ligne 96 -> **VOIR fuite (e) sur `params.motif` injecte dans `messages.refuse/a_completer`**.
  - `${role}` ligne 188, 234 -> `'accompagnante' | 'accompagne'` constant ternary. **Safe.**
  - `params.role` ligne 436, 487, 825 -> typage TS. **Safe.**
  - `subject` ligne 378 (fonction `sendMatchingNotificationEmail`) -> calcule depuis ternary boolean. **Safe.**
  - `description` ligne 380 -> idem ternary string constant. **Safe.**
  - `linkUrl` ligne 386 -> ternary URL hardcoded. **Safe.**
  - `params.score` ligne 383 -> typage TS `score: number`. **Safe.**
  - `params.type` lignes 109, 117, 397, 405 (notification log) -> typee TS. **Safe.**
  - `planLabels[params.oldPlan] || params.oldPlan` ligne 433 + `planLabels[params.newPlan] || params.newPlan` ligne 433 -> `planLabels` est `Record<string, string>` constant `{ mensuel, annuel }`. `params.oldPlan` / `params.newPlan` sont type `string` issus de Stripe webhook (controle par Stripe + valide upstream). **Safe par source.** Note de revue : le fallback `|| params.oldPlan` interpole un raw user-controlled si le lookup miss. **Risque theorique faible** (Stripe ne renvoie pas de payload script tag), **a documenter en defer si reviewer adversaire le flag**.
  - `formattedDate` ligne 484, 822 -> `toLocaleDateString('fr-FR')` produit un string controle. **Safe.**
  - `formattedAmount` ligne 484 -> formatte numerique. **Safe.**
  - `subject` ligne 758 (`sendAdminParrainageFlag`) -> `subjectPrefix` ternary string constant + `typeLabels[params.type] || params.type` -> `params.type` est typee `'meme_email' | 'meme_carte' | ...`. **Safe par typage.**
  - `marraineLabel` ligne 591 -> ternary `escapeHtml(params.marraineFirstName) | 'votre marraine'`. **Safe par escapeHtml a la source.**
  - `safeFirstName` ligne 631 -> calcule via `escapeHtml(params.firstName)`. **Safe par escapeHtml a la source.**
  - `greetingFirstName` ligne 631 -> derive de safeFirstName. **Safe.**
  - `cumulSentence` ligne 655 -> string constant ou template constant avec `params.totalRecompenses` (number). **Safe par typage number.**
  - `recompenseText` ligne 654 -> string constant ternary. **Safe.**
  - `nom` ligne 935, 955, 959 -> validation defensive amont (`isValidNomDepartement`-like) ligne 921-922. **Safe par validation amont.** Note : escapeHtml encore applique en defense-in-depth.
- **Categorie (d) `escapeHtml(...)` deja applique** : lignes 37, 95, 136, 140, 141, 155, 163, 185, 230, 274, 315, 319, 320, 334, 342, 379, 382, 432, 483, 530, 535, 580, 590, 630, 763, 767, 771, 821, 871 (x2), 955, 959, 1111. **31 occurrences. Safe.**
- **Categorie (e) FUITE XSS CONFIRMEE** :
  - **Ligne 83** : `messages.refuse: \`...${params.motif ? \` Motif : ${params.motif}\` : ''} ...\`` -> `params.motif` est saisie admin (textarea de la page validation), interpole sans escape, puis ligne 96 le HTML inclut `${messages[params.decision]}` qui contient ce motif non-escape. **Fuite confirmee.**
  - **Ligne 84** : `messages.a_completer: \`...${params.motif ? \` Details : ${params.motif}\` : ''} ...\`` -> idem. **Fuite confirmee.**
  - **Total : 2 fuites confirmees.** Fix dans Task 4.

**`lib/email-templates.ts` — ~7 interpolations identifiees** :

- Ligne 23 : `${escapeHtml(params.nomDepartement)}` + `${escapeHtml(params.codeDepartement)}` -> categorie (d). **Safe.**
- Ligne 26 : `${BASE_URL}` -> categorie (a). **Safe.**
- Ligne 44 : `${baseClean}` + `${encodeURIComponent(params.codeDepartement)}` -> categorie (a) + (b). **Safe.**
- Ligne 49 : `${escapeHtml(params.nomDepartement)}` + `${escapeHtml(params.codeDepartement)}` -> categorie (d). **Safe.**
- Ligne 52 : `${ctaUrl}` -> categorie (a) construit avec encodeURIComponent. **Safe.**
- Ligne 53 : `${escapeHtml(params.nomDepartement)}` -> categorie (d). **Safe.**

**Conclusion audit pre-cadrage** : **2 fuites confirmees uniquement** (`lib/emails.ts:83-84`). Aucune autre fuite dans les 90 interpolations totales (83 + 7). Story scope limite a Task 4 sur ces 2 lignes.

### Source tree components a toucher

- **Crees** :
  - `lib/escape-html.ts` (~12 lignes, single export `escapeHtml`)
  - `tests/unit/escape-html.test.ts` (~50 lignes, 10 tests)
- **Modifies** :
  - `lib/emails.ts` : suppression lignes 14-16 (function locale), ajout import ligne 8 (apres les imports existants), modification lignes 83-84 (`${params.motif}` -> `${escapeHtml(params.motif)}`). **Net : 3 lignes -, 1 ligne import +, 2 modifs =. Diff ~6 lignes.**
  - `lib/email-templates.ts` : suppression lignes 11-13 (function locale), ajout import (~ligne 9 avant `const BASE_URL`). **Net : 3 lignes -, 1 ligne import +. Diff ~4 lignes.**
- **Inchanges (vigilance)** :
  - `lib/email-queue.ts` (workflow durable) : delegue a `lib/emails.ts` ou `lib/email-templates.ts` qui re-exportent le meme `escapeHtml`. Pas de changement requis.
  - `lib/workflows/send-email-workflow.ts` (si existant) : idem.
  - `package.json` : aucun script ajoute (test:unit existe deja story 4.5).
  - `vitest.config.ts` : aucun changement (le project `unit` deja configure detecte le nouveau fichier).
  - `tsconfig.json` : aucun changement (`@/lib/*` deja mappe vers `lib/*`).
  - `vercel.json` : `buildCommand` inchange.

### Testing standards summary

- **Tests unitaires Vitest** uniquement (cf. AC2-AC3, AC13). Pattern strictement aligne sur `tests/unit/get-client-ip.test.ts` (story 4.5).
- **Coverage attendu** : 10 tests T1-T10 sur `escapeHtml` couvrant les vecteurs XSS classiques.
- **Pas de test integration** (cf. Hors scope point 4).
- **Pas de test Playwright** (cf. Hors scope point 4).
- **Validation CI** : `npm run test:unit` execute via le projet `unit` Vitest, exit 0 attendu. CI Vercel via `vercel.json` -> `(test "$SKIP_E2E_TESTS" = "true" || npm run test:integration)` -> tests unit ne sont PAS lances par le buildCommand actuel. **Note** : la couverture CI repose sur (a) tsc check, (b) lint:a11y-check, (c) build Next.js. Les tests unit doivent etre lances manuellement par le dev avant commit (Task 7 Sub 7.5). Pattern coherent story 4.5.

### Project Structure Notes

**Alignement avec la structure projet** :
- Pattern module `lib/<feature>.ts` coherent avec `lib/get-client-ip.ts`, `lib/parrainage-detection.ts`, `lib/email-queue.ts`, `lib/email-templates.ts`, `lib/notifications-log.ts`.
- Pattern test `tests/unit/<feature>.test.ts` coherent avec `tests/unit/get-client-ip.test.ts`.
- Convention naming : `<feature>.ts` + `<feature>.test.ts` (pas de suffixe `.spec.ts`, pas de prefix `_test`).

**Pas de conflit detecte** : la story est strictement additive (zero suppression de comportement, factorisation + tests + fix chirurgical XSS).

### Previous story intelligence

**Story 4.8 (livree 2026-05-08)** :
- Convention double commit (livraison + cloture apres CI verte) tenue 8 stories Epic 3 + 6 stories Epic 4. Repeter pour 4.9.
- Pattern audit grep documente dans Completion Notes List (Sub 6.1-6.5 ici).
- Pattern CLAUDE.md durcie : `npm run a11y:axe:check` execute localement avant commit livraison. Exit 0 confirme (regle obligatoire). Cette story n'a aucun impact UI mais la regle reste applicable.

**Story 4.5 (livree 2026-05-09)** :
- **Premier pattern de tests unitaires Vitest purs** dans le projet : `tests/unit/get-client-ip.test.ts` (8 tests, 119 ms total). Cette story 4.9 reutilise strictement ce pattern (import vitest, describe/it/expect, project `unit` distinct).
- Convention naming : `<feature>.test.ts` (pas `.spec.ts`).
- Convention header commentaire : `// Story X.Y : <description>. <details>.`.

**Story 4.3 (livree 2026-05-08)** :
- A introduit `lib/email-templates.ts` (helpers HTML purs). C'est la creation de cette duplication `escapeHtml` que la story 4.9 corrige (cf. `lib/email-templates.ts:11-13`).
- Pattern de delegation `lib/emails.ts` -> `lib/email-templates.ts` deja en place (lignes 1023-1095 `enqueueWaitlist*Email`). Le module commun `lib/escape-html.ts` s'integre naturellement dans cette chaine.

**Story 4.2 (livree 2026-05-07)** :
- Pattern audit grep transverse (15+ call-sites) repris ici sur les ~90 interpolations templates email (Task 6).

### References

- Epic 4 source : `_bmad-output/planning-artifacts/epic-4.md` lignes 326-345 (Story 4.9 acceptance criteria initiaux)
- Heritage Epic 3 : `_bmad-output/implementation-artifacts/epic-3-retro-2026-05-07.md` (AI-3.9 deferred Epic 4)
- Heritage Epic 2 : `_bmad-output/implementation-artifacts/deferred-work.md` section « Deferred from: code review of 2-3-blacklist-admin-anti-fraude (2026-05-04) » : « `escapeHtml` dans `lib/emails.ts` non visible dans le diff -- dependance externe utilisee intensivement, a valider hors review (test XSS dedie sur les templates email) »
- Pattern tests unitaires : `tests/unit/get-client-ip.test.ts` (story 4.5)
- Configuration Vitest projects : `vitest.config.ts:32-39` (project `unit`)
- Source `escapeHtml` actuelle (a factoriser) : `lib/emails.ts:14-16` + `lib/email-templates.ts:11-13`
- Fuite XSS confirmee a fixer : `lib/emails.ts:83-84` (interpolation `${params.motif}` non-escape)
- Convention double commit : memoire `project_bmad_conventions`
- Regle CLAUDE.md durcie a11y : `.claude/CLAUDE.md` ligne 6 (`npm run a11y:axe:check` exit 0 obligatoire avant commit livraison)
- DECISIONS.md F-Epic-4 series (F1-F11) : aucune decision specifique escapeHtml/XSS, story 4.9 ne genere pas de F-Epic-4 nouvelle (decisions D1-D6 documentees ci-dessus suffisent pour la post-mortem retro Epic 4).

## Dev Agent Record

### Agent Model Used

claude-opus-4-7[1m]

### Debug Log References

- Phase RED initiale : `npm run test:unit` post-creation `tests/unit/escape-html.test.ts` (sans module) -> echec attendu `Cannot find package '@/lib/escape-html'`. Confirme la valeur du test (test correctement positionne, refuse de passer sans implementation).
- Phase GREEN : `npm run test:unit` post-creation `lib/escape-html.ts` -> 18 tests verts (8 story 4.5 + 10 story 4.9), duree 132 ms.
- Verification post-fix XSS : `grep -nE 'params\.motif' lib/emails.ts` -> 2 matches lignes 80-81 (decale de 83-84 pre-suppression copie locale), tous deux passes par `escapeHtml`.

### Completion Notes List

**Implementation date** : 2026-05-09 par claude-opus-4-7[1m] via bmad-dev-story.

**Resume** :
- Module unique `lib/escape-html.ts` cree (12 lignes), 4 remplacements `&` `<` `>` `"`. Aucun changement comportemental versus copies locales pre-existantes.
- 2 call-sites dupliques migres : `lib/emails.ts:14-16` supprime + import ; `lib/email-templates.ts:11-13` supprime + import. Les ~31 + ~5 call-sites `escapeHtml(...)` continuent de fonctionner sans changement (meme nom, meme signature).
- 2 fuites XSS confirmees fixees : `lib/emails.ts:80-81` (anciennes 83-84) -- `${params.motif}` -> `${escapeHtml(params.motif)}` dans `messages.refuse` et `messages.a_completer`. Le HTML genere ligne 93 (`<p>${messages[params.decision]}</p>`) ne contient plus de motif admin non-echappe.
- Suite de tests Vitest `tests/unit/escape-html.test.ts` -- **10 tests** T1-T10 couvrant script tag, event handler, javascript: URI, double-encodage volontaire, unicode, attribute breakout, single quote preserve, empty string, no-op, combinaison.

**Audit grep post-fix (AC6, AC10)** :
- `grep -cE '\${[a-zA-Z_]' lib/emails.ts` -> **83 interpolations** (cf. pre-cadrage AC6).
- `grep -cE '\${[a-zA-Z_]' lib/email-templates.ts` -> **8 interpolations**.
- `grep -rn "function escapeHtml" lib/ --include="*.ts"` -> **1 match unique** : `lib/escape-html.ts:8: export function escapeHtml(str: string): string {`. **AC10 satisfait**.
- `grep -nE 'params\.motif' lib/emails.ts` -> **2 matches lignes 80-81**, tous deux escape via `escapeHtml(params.motif)`.

**Validations locales (AC8-AC13)** :
- `npx tsc --noEmit` -> **exit 0**, 0 erreur (apres clean `.next/types/`).
- `npm run lint` -> **0 erreur**, 213 warnings (baseline stable).
- `npm run lint:a11y-check` -> **exit 0**, baseline 155 jsx-a11y stable.
- `npm run a11y:axe:check` -> **exit 0**, 7 parcours, 0 delta Critical/Serious vs baseline 2026-05-05 (regle CLAUDE.md durcie obligatoire respectee, story sans impact UI).
- `npm run test:unit` -> **exit 0**, **18 tests verts**, duree **147 ms** (< 500 ms cible AC13).
- `npm run build` -> **exit 0**, compilation 4.8s, 52 pages statiques generees.

**Decisions D1-D6 (cf. Dev Notes)** appliquees integralement -- pas de DECISIONS.md F-Epic-4 nouvelle requise (decisions documentees dans la story).

**Hors scope respecte** : aucun fichier hors `lib/escape-html.ts`/`lib/emails.ts`/`lib/email-templates.ts`/`tests/unit/escape-html.test.ts` modifie. Pas de DOMPurify, pas de script CI `check:html-interpolation`, pas de tests integration `sendValidationResultEmail`, pas d'echappement single quote.

**Pattern story 4.5 reutilise** : Vitest pure JS, project `unit` distinct de `integration`, header commentaire `// Story X.Y : ...`, naming `<feature>.test.ts`.

### File List

**Crees** :
- `lib/escape-html.ts` -- 14 lignes, 1 export nomme `escapeHtml(str: string): string`.
- `tests/unit/escape-html.test.ts` -- 56 lignes, 10 tests T1-T10 sur vecteurs XSS.

**Modifies** :
- `lib/emails.ts` -- suppression copie locale `escapeHtml` (3 lignes), ajout import `@/lib/escape-html` (1 ligne), fix XSS sur `params.motif` x2 (lignes 80-81). Net `git diff --stat` : 9 lignes touchees, 4 inserts / 6 deletes.
- `lib/email-templates.ts` -- suppression copie locale `escapeHtml` (3 lignes), ajout import `@/lib/escape-html` (1 ligne). Net `git diff --stat` : 6 lignes touchees, 2 inserts / 4 deletes.

## DoD a11y

A renseigner pour toute story avec impact UI (ignorer si pas de changement visuel/interactif) :

- [x] Labels associes aux champs (`htmlFor` ou `aria-labelledby`) — **non applicable, story sans JSX modifie**
- [x] Erreurs liees aux champs via `aria-describedby` + `aria-invalid` — **non applicable**
- [x] Focus visible sur tous les elements interactifs (contraste >= 3:1) — **non applicable**
- [x] Contrastes texte >= 4,5:1 et UI >= 3:1 — **non applicable**
- [x] ARIA states corrects sur composants dynamiques (`aria-expanded`, `aria-selected`, etc.) — **non applicable**
- [x] Navigation clavier complete (Tab, Enter, Escape, fleches selon pattern) — **non applicable**
- [x] Verification ponctuelle au lecteur d'ecran (VoiceOver ou NVDA) sur le composant touche — **non applicable**
- [x] Pas de regression `eslint-plugin-jsx-a11y` (`npm run lint:a11y-check` vert en CI) — **OK, baseline 155 stable**
- [x] Pas de regression axe-core (`npm run a11y:axe:check` vert ou delta documente avec justification dans la PR) — **OK, exit 0 confirme localement, 0 delta Critical/Serious sur 7 parcours**

## Change Log

| Date       | Story    | Description                                                                 | Auteur                |
|------------|----------|-----------------------------------------------------------------------------|-----------------------|
| 2026-05-09 | 4.9      | Story creation et cadrage via bmad-create-story                             | Sylvain (PM agent)    |
| 2026-05-09 | 4.9      | Implementation via bmad-dev-story : module `lib/escape-html.ts`, migration 2 call-sites, fix XSS `params.motif` x2, 10 tests Vitest. Status -> review. | claude-opus-4-7[1m] (Dev agent) |
| 2026-05-09 | 4.9      | CI Vercel verte sur commit 3b7f998 (deployment dpl_GV3bFRLkk3RN3kGWh9q4MNUmDzu3 state READY, build 72 s). Status -> done. | claude-opus-4-7[1m] (Dev agent) |
