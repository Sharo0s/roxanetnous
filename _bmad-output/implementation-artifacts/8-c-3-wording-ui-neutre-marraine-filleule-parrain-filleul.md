# Story 8.C.3 : Wording UI neutre -- `marraine`/`filleule` -> `parrain`/`filleul` + rename email

Status: done

<!-- Note: Validation is optional. Run validate-create-story for quality check before dev-story. -->

## Story

As a utilisateur de la plateforme (n'importe quel role -- accompagnant, accompagne, admin),
I want que la copy UI/email soit coherente avec la regle CLAUDE.md masculin neutre (`parrain`/`filleul` partout),
so that l'experience est uniforme peu importe le genre, conformement aux acquis Epic 5 (renommage `accompagnante` -> `accompagnant`) et a la decision UX-DR-E8.4 (Epic 8 parrainage symetrique).

## Acceptance Criteria

1. **AC1 -- Audit grep cross-codebase complet, perimetre UI/copy uniquement** : un grep `grep -niE 'marraine|filleule' app/ components/ lib/emails.ts` est documente avant et apres patch. **Perimetre IN** : libelles JSX, sujets/corps email, messages d'erreur affiches a l'utilisateur, helper text, labels colonnes admin, fallbacks `'Marraine'`/`'Filleule'` (chaines passees dans templates email visibles utilisateur, ex : `app/actions/parrainage.ts:702-703`). **Perimetre OUT** : noms de variables JS internes (`marraineId`, `filleuleEmailNorm`, `marraineEmbed`), noms de cles BDD (`marraine_id`, `filleule_id`, `filleule_inscrite_at`, `filleule_abonnee_at`), noms de tables (`parrainages`), enum/types TypeScript (`type FilleuleStatut`, `type Filleule`), reasons des Result types (`'marraine_not_validated'`, `'marraine_subscription_inactive'`, `'marraine_no_longer_validated'`), tags Sentry (`signal: 'marraine-sub-inactive'`, `signal: 'cron-marraine-unexpected-role'`), action_type admin_actions_log (`'parrainage_admin_alert_lost'` -> garde `marraine_name`/`filleule_name` dans `details:` car cles internes audit), commentaires de code historiques. Apres patch : **zero occurrence affichee a l'utilisateur** de `marraine`/`Marraine`/`marraines`/`Marraines`/`filleule`/`Filleule`/`filleules`/`Filleules`. La frontiere code interne/UI doit etre explicitee dans le Dev Agent Record (commit-prouvable via diff).

2. **AC2 -- Rename `sendParrainageBienvenueMarraine` -> `sendParrainageBienvenueParrain` (`lib/emails.ts`)** : la fonction exportee actuelle (`lib/emails.ts:538-593`) est renommee `sendParrainageBienvenueParrain`. **Alias retro-compatible** : la signature actuelle (`{ email, firstName, code, userId? }`) est preservee. Un **wrapper deprecated** `sendParrainageBienvenueMarraine` est conserve, body = appel direct a `sendParrainageBienvenueParrain` (1 ligne de delegation), avec commentaire JSDoc `// @deprecated Epic 8 -- supprimer prochaine release (Epic 9). Voir _bmad-output/implementation-artifacts/deferred-work.md`. Les call-sites existants (`app/actions/admin.ts:9,226` et `app/actions/parrainage.ts:9,...`) sont migres au nouveau nom `sendParrainageBienvenueParrain` dans **le meme commit** (zero call-site residuel sur l'alias hors retro-compat externe). L'alias reste comme filet de securite si un import oublie subsiste.

3. **AC3 -- Reformulation copy email `sendParrainageBienvenueParrain` (ex-`Marraine`)** (`lib/emails.ts:552-572`) : la copy actuelle utilise deja « accompagnant », « invitez d'autres accompagnants », mais la 2eme bullet ligne 564 dit « **À son inscription, elle s'appuie sur votre garantie** » -- feminin. Reformulation imposee : « **À son inscription, il s'appuie sur votre garantie** » (masculin neutre, aligne sur le pattern utilise par `sendParrainageBienvenueAccompagne` ligne 625 deja livre 8.A.1). Autres bullets et CTA restent. Le sujet `'Votre code de parrainage roxanetnous'` est deja masculin neutre, conserve tel quel.

4. **AC4 -- Reformulation copy email `sendParrainageFilleuleConfirmation`** (`lib/emails.ts:656-704`) :
   - **Nom de la fonction** : conserve `sendParrainageFilleuleConfirmation` (zero rename) -- decision pragmatique cadre : la fonction reste utilisee par le path accompagnant historique uniquement (un parrain accompagne genere un filleul accompagnant, jamais l'inverse), zero ambiguite. **Si dev juge utile** un rename `sendParrainageFilleulConfirmation` (cosmetique), le faire ici **avec alias deprecated identique a AC2**. Pas bloquant.
   - **Param `marraineFirstName` (signature)** : conserve l'identifiant interne (variable JS) -- aucun call-site UI ne le voit. **NE PAS renommer** pour eviter de propager le diff a 4 call-sites tests + 2 app/actions.
   - **Fallback `'votre marraine'` (ligne 666)** -> **`'votre parrain'`** (masculin neutre). Variable `marraineLabel` (interne, JS) conservee identique.
   - **Sujet `'Bienvenue sur roxanetnous, votre profil est validé'`** : deja masculin neutre, conserve.
   - **Corps `Grâce au parrainage de ${marraineLabel}`** (ligne 676) : verbe et structure deja neutres ; le fallback `'votre marraine'` modifie ci-dessus suffit a rendre la phrase 100% neutre quand le firstName est absent.

5. **AC5 -- Reformulation copy email `sendAdminParrainageFlag`** (`lib/emails.ts:787-908`) : email destine a l'admin (notification anti-fraude). Wording UI a aligner cote affichage email (les chaines passees a l'admin sont vues dans son inbox).
   - **typeLabels (lignes 838-843)** : les 4 valeurs du dict `typeLabels` contiennent toutes `marraine` ou `filleule` (ex : `meme_email: 'même email entre marraine et filleule'`). Reformuler : `meme_email: 'même email entre parrain et filleul'`, `meme_carte: 'même carte de paiement entre parrain et filleul'`, `meme_ip: 'même adresse IP que d\'autres filleuls de ce parrain'` (pluriel masculin), `meme_adresse: 'même adresse postale entre parrain et filleul'`.
   - **Table HTML email (lignes 859-864)** : les cellules `<td>Marraine :</td>` et `<td>Filleule :</td>` deviennent **`<td>Parrain :</td>`** et **`<td>Filleul :</td>`** (ordre conserve, structure intacte).
   - **Variables `params.marraineName` / `params.filleuleName`** (signature) : conservees inchangees (identifiants internes, zero impact UI ; renommer casserait 2 call-sites `app/actions/parrainage.ts:742-744,799-802` sans benefice).
   - **Sujet** : `${subjectPrefix} - ${typeLabels[params.type] || params.type}` -> derive automatiquement du nouveau wording corrige (ex : `Parrainage bloqué - même email entre parrain et filleul`).

6. **AC6 -- Fallbacks `'Marraine'`/`'Filleule'` dans `app/actions/parrainage.ts`** (lignes 702-703 dans `loadNamesForAdminEmail()`) : les chaines de fallback finales passees a `sendAdminParrainageFlag({ marraineName, filleuleName })` sont actuellement `'Marraine'` et `'Filleule'`. Remplacer par **`'Parrain'`** et **`'Filleul'`** (capitalisees, presentees a l'admin dans la table HTML email). Aucune autre modification dans cette fonction (le reste sont des lookups BDD legitimes).

7. **AC7 -- Composant `components/accompagnant/parrainage-view.tsx` (Epic 2, dette restante)** :
   - **Fallback `'Filleule'` ligne 25 (fonction `formatFilleuleName`)** : remplacer par **`'Filleul'`** (masculin neutre). La fonction (interne, nom JS) reste `formatFilleuleName` -- ne pas renommer pour eviter le diff inutile sur les call-sites internes.
   - **NE PAS toucher** : `type FilleuleStatut`, `type Filleule`, `filleules: Array<Filleule>` (props), `filleulesAffichables` (variable locale), commentaire ligne 20-21 (`// Format compact pour preserver la confidentialite...`). Tous identifiants/types JS internes, zero affichage UI.
   - **Constantes mortes `STATUT_LABELS`/`STATUT_BADGE_CLASS`** (lignes 41-55) : actuellement **dead code** non reference (cf. note 8.B.1 T2.1 « copie integrale moins dead code lint-incompatible » apres harmonisation). Verifier `grep -n "STATUT_LABELS\|STATUT_BADGE_CLASS" components/accompagnant/parrainage-view.tsx` : si zero usage interne, supprimer ces 2 const pour aligner sur `components/accompagne/parrainage-view.tsx` (deja epure 8.B.1). **Decision dev** : si la suppression cree des warnings/erreurs lint, garder les const et noter le defer.

8. **AC8 -- Page admin `/admin/parrainages` (`app/admin/parrainages/page.tsx`)** :
   - **Ligne 227 (helper text H1)** : `Toutes les relations marraine / filleule, leur statut et leur risque éventuel.` -> `Toutes les relations parrain / filleul, leur statut et leur risque éventuel.`
   - **Ligne 382 (en-tete tableau `<th>Marraine</th>`)** -> `<th>Parrain</th>`. Cohérent avec AR-E8.9 + 8.C.1 livre (colonne `Rôle parrain` deja masculin neutre dans constante `ROLE_PARRAIN_LABELS`).
   - **Ligne 384 (en-tete tableau `<th>Filleule</th>`)** -> `<th>Filleul</th>`.
   - **Lignes 401-454 (variables JS `marraine`, `filleule`, `filleuleAdresse`)** : identifiants internes uniquement, **NE PAS toucher**. Aucune chaine affichee a partir de ces variables ne contient le mot lui-meme (juste `marraine?.email`, `marraine?.phone`, etc. -> output = la valeur, pas le label).
   - **Commentaires (lignes 98, 141-146, 167)** : commentaires de code historiques -- **NE PAS toucher** (regle CLAUDE.md, ces commentaires referencent le code metier historique au feminin par dette assumee).

9. **AC9 -- Pages legales et politiques** : la page `/politique-de-confidentialite` est **deja conforme apres 8.C.2** (audit grep T2 = zero occurrence `marraine|filleule` mergé 2026-05-17). Verifier en re-grep cette page : `grep -niE 'marraine|filleule' app/politique-de-confidentialite/page.tsx` doit retourner **zero occurrence**. Si une regression a ete introduite entre 8.C.2 et 8.C.3, l'inclure dans le perimetre (defensif). Aucune autre page legale (mentions-legales, CGU) ne contient ces termes (a verifier au grep T2).

10. **AC10 -- Pages publiques restantes et register-form** :
    - **`components/auth/register-form.tsx`** : ligne 41-44 (cles `marraine_not_validated`/`marraine_subscription_inactive` du dict `PARRAINAGE_ERRORS`) -> **NE PAS toucher** (cles d'objet TS, identifiants internes, jamais affichees). Les **valeurs** des messages sont deja au masculin neutre (`'Le parrain associé à ce code n\'est pas encore validé.'`, `'Le compte de votre parrain est inactif...'`) -- aucune modification de copy requise.
    - **Lignes 375-378 du JSX** : copy `Code valide{...marraineFirstName ? ` (parrainage par ${parrainageState.marraineFirstName})` : ''}. Votre parrain se porte garant...` -- deja masculin neutre, conserve.
    - **Type `ParrainageState`** (lignes 20-37) : `{ status: 'valid'; marraineFirstName: string }` -> identifiant interne, **NE PAS toucher**.

11. **AC11 -- Tests d'integration et tests unitaires** (`tests/integration/`, `tests/unit/`, `tests/api/`) :
    - **NE PAS toucher** les noms de variables (`marraine`, `filleule`, `marraineExFilleule`, etc.) ni les cles de mocks/fixtures BDD (`marraine_id`, `filleule_id`, `filleule_abonnee_at`).
    - **NE PAS toucher** les `reason:` strings dans les expect (`'marraine_subscription_inactive'`, `'marraine_no_longer_validated'`) -- ce sont les cles du Result type cote production, conservees par 8.A.2/8.A.3.
    - **Commentaires de tests** : conserves tel quel (les commentaires referencent le code metier historique). Pas de modification cosmetique.

12. **AC12 -- Tests E2E Playwright** (`tests/e2e/`) :
    - **`tests/e2e/parrainage-anti-fraude.spec.ts`** et autres specs : si une assertion lit une copy UI affichee (ex : `expect(page.locator('th')).toHaveText('Marraine')`), elle doit etre alignee sur le nouveau wording (`'Parrain'`). Faire un grep `grep -niE "['\\\"][^'\\\"]*(marraine|filleule|Marraine|Filleule)[^'\\\"]*['\\\"]" tests/e2e/` et identifier les assertions UI. Cles BDD / URLs / params internes (`?role=accompagnante`, `marraine_id` dans fixtures) restent **a la dette technique heritage**, hors-perimetre.
    - **Si zero assertion UI** trouvee : pas de modification tests E2E requise.

13. **AC13 -- Test snapshot des sujets emails** (epic-8.md ligne 535 demande) :
    - **Option A (recommandee, light)** : un nouveau test unitaire `tests/unit/parrainage-emails-subjects.test.ts` verifie les 4 sujets clefs en stable :
      - `sendParrainageBienvenueParrain` -> `'Votre code de parrainage roxanetnous'`
      - `sendParrainageBienvenueAccompagne` -> `'Votre code de parrainage roxanetnous'` (idem -- volontairement uniforme entre roles parrains pour evite confusion utilisateur)
      - `sendParrainageFilleuleConfirmation` -> `'Bienvenue sur roxanetnous, votre profil est validé'`
      - `sendParrainageRecompense` -> `'Félicitations, vous avez 6 mois offerts sur roxanetnous'`
      - `sendAdminParrainageFlag` (`type: 'meme_email'`) -> `'Parrainage bloqué - même email entre parrain et filleul'`
    - **Implementation** : mock `@/lib/resend` (capture l'argument `subject` du `resend.emails.send`), appel direct chaque fonction, expect `toBe(...)`. Aucun reseau, aucune BDD. Pattern aligne sur `tests/unit/parrainage-symetrie.test.ts` (mocks Vitest deja en place).
    - **Option B (lourde, defer)** : test snapshot Vitest avec `toMatchInlineSnapshot()` sur le HTML complet. Defer Epic 9 (couvre regression copy plus large mais 5x plus de bruit en review).
    - **Decision defaut** : Option A. Si dev trouve Option B plus robuste, basculer. Aligner avec l'esprit AC4 epic-8.md ligne 535 « test snapshot verifie les sujets email (au minimum 4) ».

14. **AC14 -- Baseline axe-core `?role=accompagnante`** : l'URL `axe-core-baseline-2026-05-17.json:39` contient encore `"url": "/register?role=accompagnante"` (note defer 8.B.1). Cette URL est utilisee par le parcours P4 register. Comportement actuel : `register-form.tsx:63` normalize `'accompagnant'` -> `'accompagnant'` (no-op apres Epic 5 renommage) -- le param `accompagnante` n'a plus d'effet metier mais reste lisible UI sans crash. **Decision** :
    - **Option A (recommandee)** : mettre a jour la spec `tests/a11y/p4-register.spec.ts` (ou equivalent) pour pointer sur `?role=accompagnant` + regen baseline `_bmad-output/test-artifacts/axe-core-baseline-2026-05-XX.json`. Cela aligne le test avec la realite metier post-Epic 5.
    - **Option B (defer)** : laisser tel quel jusqu'a 8.D.1 / Epic 9 (l'URL `?role=accompagnante` n'est pas une chaine UI affichee dans le DOM, juste un param URL d'init -- pas une regle CLAUDE.md durcie).
    - **Decision defaut** : **Option A** si la regen baseline est cheap (1 commande `npm run a11y:axe:baseline`). Sinon Option B avec defer documente. Verifier `package.json` pour script regen baseline.

15. **AC15 -- `tests/a11y/README.md`** : grep `'marraine|filleule'` dans ce fichier doc -> si zero occurrence, pas de modification. Si occurrence dans une description de parcours (ex : « parrainage par marraine accompagnante »), aligner sur le wording neutre.

16. **AC16 -- `_bmad-output/implementation-artifacts/deferred-work.md`** : ajouter en tete une section `## Deferred from: implementation of 8-c-3-wording-ui-neutre-marraine-filleule-parrain-filleul (2026-05-17)` listant :
    - **Defer 1 -- Suppression alias `sendParrainageBienvenueMarraine`** : alias deprecated conserve 1 release (Epic 9). Lorsque la prochaine release prod sera deployee et qu'un audit `grep -r "sendParrainageBienvenueMarraine" .` ne remonte plus que la definition de l'alias, supprimer la fonction wrapper (cf. AC2). Formulation prete a coller : « **F-Epic8-C3 alias 1-release** -- supprimer `lib/emails.ts:sendParrainageBienvenueMarraine` wrapper deprecated apres confirmation deploiement Epic 9 + audit grep cross-codebase (`grep -r 'sendParrainageBienvenueMarraine' app/ components/ lib/ tests/`). Heritage Epic 8 wording neutre. »
    - **Defer 2 -- Rename `confirmParrainageFilleuleConfirmation`** : non execute (cf. AC4 decision pragmatique). Si dev choisit Option A (rename + alias), pas de defer. Sinon defer Epic 9 si besoin coherence stricte.
    - **Defer 3 (conditionnel)** -- AC14 baseline `?role=accompagnante` : si Option B retenue (defer), ouvrir une entree defer dediee.
    - **Defer 4 (conditionnel) -- type FilleuleStatut/Filleule rename** : identifiants TypeScript internes, hors-perimetre regle CLAUDE.md (la regle vise la **copy** affichee). Defer Epic 9 si refacto code-style souhaite. Pas bloquant.

17. **AC17 -- DoD a11y** (regle CLAUDE.md durcie + NFR-A11y-E8.1 par heritage) :
    - **Pas de regression `lint:a11y-check`** : baseline 155 (file, rule) pairs (`_bmad-output/test-artifacts/a11y-lint-baseline-2026-05-13.txt`) **preserve** -- delta tolere = 0. Les fichiers touches (`app/admin/parrainages/page.tsx`, `components/accompagnant/parrainage-view.tsx`, `lib/emails.ts`, `app/actions/parrainage.ts`) sont deja dans le baseline pour leurs warnings legitimes. Les modifications sont purement textuelles (substitutions string, zero modification de structure JSX a11y).
    - **Pas de regression `a11y:axe:check`** : si AC14 Option A retenue, regen baseline pour `?role=accompagnant` -- aucune autre regression attendue. Si Option B retenue, baseline `axe-core-baseline-2026-05-17.json` 8 parcours **preserve** sans regen.
    - **Heading hierarchy preserve** : zero modification de structure heading dans tous les fichiers touches.
    - **Focus visible / contrastes** : aucun element interactif ajoute ou retire ; tokens design system inchanges. Heritage Lot A baseline.
    - **Navigation clavier / lecteur d'ecran** : modification strictement textuelle dans les chaines existantes (libelles tableaux admin, contenu emails, helper text). Ordre DOM inchange, rendu lecteur d'ecran identique a la byte-pres.
    - **Pas d'emoji** : regle CLAUDE.md projet (aucun emoji introduit dans la copy reformulee).

18. **AC18 -- Validations CI obligatoires avant livraison** (DoD pre-commit story livraison) :
    - `npx tsc --noEmit` : 0 erreur sur les fichiers modifies (erreurs `.next/types/` pre-existantes tolerees -- heritage 8.A.3/8.A.4/8.B.1/8.B.2/8.C.1/8.C.2). Le rename `sendParrainageBienvenueMarraine` -> `sendParrainageBienvenueParrain` + alias deprecated doit type-check strict.
    - `npm run lint` : exit 0, baseline <= 194 warnings (heritage 8.B.2/8.C.2). Pas de nouveau warning attendu (substitutions string n'introduisent pas de jsx-a11y).
    - `npm run lint:a11y-check` : exit 0, **155** (file, rule) preserve, aucune nouvelle paire warning.
    - `npm run check:no-direct-notifications-log-insert` : exit 0 (aucun INSERT direct ajoute).
    - `npm run check:as-any-global` / `check:as-any-admin` / `check:oracle-paywall` / `check:rls-helpers` / `check:ip-spoofing` : tous exit 0.
    - `npm run test:unit` : 82/82 verts si AC13 Option A non livree, **86/86** verts si AC13 Option A livree (5 nouveaux tests pour 5 sujets emails). Aucune regression sur les 82 tests existants.
    - `npm run a11y:axe:check` : exit 0 sur baseline applicable (regen si AC14 Option A).
    - `npm run build` : exit 0, routes `/accompagnant/parrainage`, `/accompagne/parrainage`, `/admin/parrainages`, `/politique-de-confidentialite` listees dans la sortie build (already shipped, non-regression check).
    - **Validation manuelle navigateur** (regle CLAUDE.md « test UI ») : ouvrir `/admin/parrainages` (auth admin), verifier que la table affiche bien `Parrain` / `Filleul` dans les en-tetes. Ouvrir `/accompagnant/parrainage` (auth accompagnant + sub active), verifier que le composant affiche bien `Filleul` en fallback nom (forcer un parrainage avec `first_name`/`last_name` null si possible -- sinon defer staging Sylvain). Verifier email `sendAdminParrainageFlag` en simulant un blocage en preview/staging si possible -- sinon defer audit Sentry post-merge sur la prochaine alerte parrainage.

19. **AC19 -- Coherence cross-story 8.A.* + 8.B.* + 8.C.*** :
    - **8.A.1 deja merge** : webhook genese code parrainage accompagne + `sendParrainageBienvenueAccompagne` deja masculin neutre. Aucune modification requise dans cette fonction.
    - **8.A.2 deja merge** : server actions parrainage symetrique + guards role. Aucune modification (cles `reason:` conservees).
    - **8.A.3 deja merge** : cron `confirm-parrainages` recompense role-aware + `sendParrainageRecompense({ role })`. Aucune modification (copy email deja masculin neutre).
    - **8.A.4 deja merge** : tests integration parrainage symetrique. Aucune modification (cles BDD/test fixtures conservees, hors-perimetre regle CLAUDE.md).
    - **8.B.1 deja merge** : page `/accompagne/parrainage` + composant `components/accompagne/parrainage-view.tsx` deja masculin neutre. 8.C.3 aligne le composant accompagnant historique (Epic 2) sur le meme niveau (fallback `'Filleul'` ligne 25).
    - **8.B.2 deja merge** : teaser dashboard accompagne. Aucune modification (copy deja masculin neutre).
    - **8.C.1 deja merge** : page admin tous roles + filtre + colonne `Rôle parrain`. 8.C.3 complete le wording en-tetes tableau (`Parrain`/`Filleul` au lieu de `Marraine`/`Filleule`).
    - **8.C.2 deja merge** : politique de confidentialite extension parrainage accompagne -- audit grep AC6 deja confirme zero occurrence `marraine|filleule` dans la page legale. 8.C.3 verifie en non-regression.
    - **8.D.1 (a venir, post-8.C.3)** : E2E Playwright golden path. Si l'assertion `expect(page.locator('th')).toHaveText('Marraine')` apparait dans une spec, 8.D.1 devra utiliser le nouveau wording. 8.C.3 alignera la spec 8.D.1 en cours d'ecriture si pertinent (defensif).

20. **AC20 -- Pas d'impact PROD avant deploy** : story strictement editoriale + 1 rename JS exporté.
    - **Pas de migration BDD** (heritage F-Epic8-A0 GO sans migration), pas de nouvelle env var, pas de modification webhook/cron/server actions/RLS/RPC.
    - **Rename `sendParrainageBienvenueMarraine` -> `sendParrainageBienvenueParrain`** : impact zero en prod tant que (a) l'alias deprecated reste exporte ET (b) les call-sites internes sont migres dans le **meme commit** (atomic deploy). Si un import externe (hypothetique) reste sur l'ancien nom, il continue de fonctionner via l'alias.
    - **Substitutions de copy UI/email** : visibles immediatement post-deploy. Pas de rollback complexe (revert du commit suffit).
    - **Tests E2E Playwright** : si 8.C.3 met a jour des assertions, elles doivent rester vertes contre prod le temps que le deploiement propage le nouveau wording (idealement, push du test apres push de la copy).

21. **AC21 -- Pas de nouvelle entree DECISIONS.md requise (sauf decisions architectes)** :
    - Si dev choisit Option A AC4 (rename `sendParrainageFilleuleConfirmation`) **ou** Option B AC14 (defer baseline) -> entree DECISIONS.md `F-Epic8-C3 wording UI neutre + decisions defer` listant les choix retenus. Format usuel : citation epic-8.md + rationale + heritages 8.B.1/8.C.2.
    - Si dev choisit Options par defaut sur tout : aucune nouvelle entree DECISIONS.md, juste Change Log de la story.

22. **AC22 -- Audit `git diff --stat` final attendu** :
    - **Modifies** :
      - `lib/emails.ts` (rename + alias + 3 emails reformules -- ~30-50 lignes nettes)
      - `app/actions/parrainage.ts` (2 fallbacks ligne 702-703 + migration call-sites de l'alias rename ~3-5 lignes)
      - `app/actions/admin.ts` (1 import + 1 call-site rename ~2 lignes)
      - `app/admin/parrainages/page.tsx` (3 chaines : helper text H1 + 2 `<th>` -- ~3 lignes nettes)
      - `components/accompagnant/parrainage-view.tsx` (1 fallback ligne 25 + suppression conditionnelle dead code ~1-15 lignes)
      - Optionnellement (AC4 Option A rename) : 2-3 fichiers tests `tests/unit/` + 1 fichier `tests/integration/` si references a `sendParrainageFilleuleConfirmation`
      - Optionnellement (AC14 Option A regen baseline) : `_bmad-output/test-artifacts/axe-core-baseline-2026-05-XX.json` + `tests/a11y/p4-register.spec.ts`
    - **Crees** :
      - Optionnellement (AC13 Option A) : `tests/unit/parrainage-emails-subjects.test.ts` (~50-80 lignes)
    - **Documentation** : `_bmad-output/implementation-artifacts/sprint-status.yaml` (transition status), `_bmad-output/implementation-artifacts/deferred-work.md` (section defer), `_bmad-output/implementation-artifacts/8-c-3-wording-ui-neutre-marraine-filleule-parrain-filleul.md` (Tasks + Dev Agent Record + Change Log + DoD a11y + Status review), conditionnellement `DECISIONS.md` (F-Epic8-C3 si decisions architectes prises).

## Tasks / Subtasks

- [x] **T1 -- Audit grep cross-codebase initial (avant patch)** (AC: #1)
  - [x] T1.1 -- Executer `grep -rniE 'marraine|filleule' app/ components/ lib/emails.ts > /tmp/8c3-pre.txt`. Sauvegarder dans le Dev Agent Record (extrait des 10-20 premieres lignes pertinentes).
  - [x] T1.2 -- Categoriser les occurrences en deux sets : (a) **IN-scope** (UI/copy/sujets/corps email/fallbacks affiches) -- a corriger ; (b) **OUT-of-scope** (identifiants JS, cles BDD, types, reasons, tags Sentry, commentaires historiques) -- a preserver. Pattern : tout ce qui finit dans un JSX `<...>X</...>`, un template literal email (`<h1>...</h1>`), un `subject:` Resend, ou un fallback string affiche utilisateur = IN. Tout le reste = OUT.
  - [x] T1.3 -- Lister explicitement dans le Dev Agent Record les fichiers a modifier (attendu : `lib/emails.ts`, `app/actions/parrainage.ts`, `app/actions/admin.ts`, `app/admin/parrainages/page.tsx`, `components/accompagnant/parrainage-view.tsx`, optionnellement tests + baseline).

- [x] **T2 -- Rename `sendParrainageBienvenueMarraine` + alias deprecated** (AC: #2)
  - [x] T2.1 -- Editer `lib/emails.ts:538` : renommer la fonction exportee en `sendParrainageBienvenueParrain`. Body inchange (sauf reformulation copy ligne 564, T3 ci-dessous).
  - [x] T2.2 -- Ajouter immediatement apres (ligne ~594) un wrapper deprecated :
    ```ts
    /** @deprecated Epic 8 -- remove next release (Epic 9). Voir _bmad-output/implementation-artifacts/deferred-work.md */
    export const sendParrainageBienvenueMarraine = sendParrainageBienvenueParrain
    ```
    Pattern `export const X = Y` (alias direct, zero overhead runtime, type-check strict).
  - [x] T2.3 -- Migrer tous les call-sites internes : `app/actions/admin.ts:9` (import) + ligne 226 (appel) -> remplacer `sendParrainageBienvenueMarraine` par `sendParrainageBienvenueParrain`. `app/actions/parrainage.ts:9` (import) + appel(s) si presents -> idem. Verifier `grep -rn "sendParrainageBienvenueMarraine" app/ components/ lib/ tests/` apres migration : seul `lib/emails.ts` doit contenir le nom (alias + commentaire deprecated).
  - [x] T2.4 -- `npx tsc --noEmit` exit 0 (verifier le rename complet, aucun call-site oublie).

- [x] **T3 -- Reformuler copy `sendParrainageBienvenueParrain` (ex-Marraine)** (AC: #3)
  - [x] T3.1 -- Editer `lib/emails.ts` (ex-ligne 564) : remplacer « À son inscription, elle s'appuie sur votre garantie : pas de vérification de documents ni de visio, et son profil est activé dès la souscription. » par « À son inscription, il s'appuie sur votre garantie : pas de vérification de documents ni de visio, et son profil est activé dès la souscription. » (`elle` -> `il`).
  - [x] T3.2 -- Verifier que les autres bullets et le titre sont deja masculin neutre (« d'autres accompagnants », « 5 parrainages confirmés », etc.) -- attendu zero autre modification dans cette fonction.

- [x] **T4 -- Reformuler copy `sendParrainageFilleuleConfirmation`** (AC: #4)
  - [x] T4.1 -- Editer `lib/emails.ts:666` : remplacer `'votre marraine'` par `'votre parrain'` dans le fallback de `marraineLabel`.
  - [x] T4.2 -- **Decision dev** : appliquer ou non un rename `sendParrainageFilleuleConfirmation` -> `sendParrainageFilleulConfirmation` (Option A AC4). Defaut **NE PAS renommer** (pragmatique). Si rename : appliquer pattern T2.2 (alias deprecated) + migration call-sites.
  - [x] T4.3 -- Verifier que le sujet `'Bienvenue sur roxanetnous, votre profil est validé'` et le H1 `'Bienvenue ${firstName}'` sont conserves (deja neutres).

- [x] **T5 -- Reformuler copy `sendAdminParrainageFlag` (typeLabels + table HTML)** (AC: #5)
  - [x] T5.1 -- Editer `lib/emails.ts:838-843` (dict `typeLabels`) : 4 substitutions a faire :
    - `meme_email: 'même email entre marraine et filleule'` -> `'même email entre parrain et filleul'`
    - `meme_carte: 'même carte de paiement entre marraine et filleule'` -> `'même carte de paiement entre parrain et filleul'`
    - `meme_ip: 'même adresse IP que d\'autres filleules de cette marraine'` -> `'même adresse IP que d\'autres filleuls de ce parrain'`
    - `meme_adresse: 'même adresse postale entre marraine et filleule'` -> `'même adresse postale entre parrain et filleul'`
  - [x] T5.2 -- Editer `lib/emails.ts:859-864` (table HTML) :
    - `<td>Marraine :</td>` -> `<td>Parrain :</td>`
    - `<td>Filleule :</td>` -> `<td>Filleul :</td>`
  - [x] T5.3 -- Verifier que les ARIA-labels de la table (le cas echeant) restent inchanges (lecture seulement, pas de modification de balises).
  - [x] T5.4 -- Verifier que les commentaires (`// mentir à la marraine.` ligne 738, par exemple) restent en l'etat -- commentaires historiques hors-perimetre.

- [x] **T6 -- Reformuler fallbacks `'Marraine'`/`'Filleule'` dans `app/actions/parrainage.ts`** (AC: #6)
  - [x] T6.1 -- Editer `app/actions/parrainage.ts:702-703` (fonction `loadNamesForAdminEmail()`) :
    - Remplacer `'Marraine'` (fallback `marraineName`) par `'Parrain'`.
    - Remplacer `'Filleule'` (fallback `filleuleName`) par `'Filleul'`.
  - [x] T6.2 -- Verifier qu'aucun autre fallback string visible utilisateur n'apparait dans `app/actions/parrainage.ts` (tous les autres sont identifiants JS, cles BDD, reasons internes).
  - [x] T6.3 -- `npx tsc --noEmit` exit 0 (substitutions sans impact type).

- [x] **T7 -- Aligner composant `components/accompagnant/parrainage-view.tsx`** (AC: #7)
  - [x] T7.1 -- Editer ligne 25 : `if (!first && !last) return 'Filleule'` -> `if (!first && !last) return 'Filleul'`.
  - [x] T7.2 -- Auditer les constantes `STATUT_LABELS` et `STATUT_BADGE_CLASS` (lignes 41-55) : `grep -n "STATUT_LABELS\|STATUT_BADGE_CLASS" components/accompagnant/parrainage-view.tsx` -- si zero usage interne (dead code confirme), supprimer les 2 const + ajuster les imports React si besoin (pas de cleanup additionnel attendu, ces const sont locales).
  - [x] T7.3 -- `npx tsc --noEmit` exit 0 + `npm run lint` exit 0 (verifier que la suppression dead code n'introduit pas de warning supplementaire).
  - [x] T7.4 -- Verifier que `components/accompagne/parrainage-view.tsx` (Epic 8) est strictement aligne sur le nouveau wording ; si une divergence apparait, l'aligner (zero diff attendu vu 8.B.1 deja livre).

- [x] **T8 -- Aligner page admin `/admin/parrainages`** (AC: #8)
  - [x] T8.1 -- Editer `app/admin/parrainages/page.tsx:227` : remplacer `Toutes les relations marraine / filleule, leur statut et leur risque éventuel.` par `Toutes les relations parrain / filleul, leur statut et leur risque éventuel.`.
  - [x] T8.2 -- Editer ligne 382 : `<th scope="col" className="...">Marraine</th>` -> `<th scope="col" className="...">Parrain</th>`.
  - [x] T8.3 -- Editer ligne 384 : `<th scope="col" className="...">Filleule</th>` -> `<th scope="col" className="...">Filleul</th>`.
  - [x] T8.4 -- Verifier que les commentaires lignes 98, 141-146, 167 (commentaires de code historiques) ne sont **PAS touches** (regle CLAUDE.md masculin neutre vise la copy, pas les commentaires historiques references au schema BDD).

- [x] **T9 -- Verification non-regression pages legales (AC9)** (AC: #9)
  - [x] T9.1 -- `grep -niE 'marraine|filleule' app/politique-de-confidentialite/page.tsx` : attendu zero occurrence (heritage 8.C.2). Si non-zero, aligner.
  - [x] T9.2 -- `grep -niE 'marraine|filleule' app/mentions-legales/page.tsx` : attendu zero occurrence. Si non-zero, aligner.
  - [x] T9.3 -- `grep -niE 'marraine|filleule' app/cgu/page.tsx` (si existe) : attendu zero occurrence. Si non-zero, aligner.

- [x] **T10 -- Audit grep cross-codebase final (post-patch)** (AC: #1)
  - [x] T10.1 -- Executer `grep -rniE 'marraine|filleule|Marraine|Filleule' app/ components/ lib/ > /tmp/8c3-post.txt`.
  - [x] T10.2 -- Verifier que toutes les occurrences restantes sont OUT-of-scope (identifiants JS, cles BDD, types, reasons, tags Sentry, commentaires historiques). Aucune occurrence affichee a l'utilisateur ne doit subsister.
  - [x] T10.3 -- Documenter le diff pre/post (counts par categorie) dans le Dev Agent Record. Output attendu : `AVANT: X occurrences ; APRES: Y occurrences (Y < X, toutes restantes OUT-of-scope categorisees)`.

- [x] **T11 -- Test snapshot sujets emails (AC13 Option A recommandee)** (AC: #13)
  - [x] T11.1 -- Creer `tests/unit/parrainage-emails-subjects.test.ts` (~50-80 lignes) en s'inspirant du pattern `tests/unit/parrainage-symetrie.test.ts` (mocks Vitest, `vi.mock('@/lib/resend', ...)`).
  - [x] T11.2 -- 5 cas de test :
    - `sendParrainageBienvenueParrain` -> sujet `'Votre code de parrainage roxanetnous'`
    - `sendParrainageBienvenueAccompagne` -> sujet `'Votre code de parrainage roxanetnous'`
    - `sendParrainageFilleuleConfirmation` -> sujet `'Bienvenue sur roxanetnous, votre profil est validé'`
    - `sendParrainageRecompense` -> sujet `'Félicitations, vous avez 6 mois offerts sur roxanetnous'`
    - `sendAdminParrainageFlag({ type: 'meme_email', ... })` -> sujet `'Parrainage bloqué - même email entre parrain et filleul'`
  - [x] T11.3 -- `npm run test:unit` : 82+5 = **87/87** verts (ou 86/86 si compteur initial different -- aligner sur l'output reel).
  - [x] T11.4 -- **Decision Option B (defer)** : si pattern Option A complexe a mettre en place (mocks Resend instables), defer entry dans `deferred-work.md` + fallback sur grep manuel pre-deploy.

- [x] **T12 -- Decision AC14 baseline `?role=accompagnante`** (AC: #14)
  - [x] T12.1 -- Inspecter `tests/a11y/p4-register.spec.ts` (ou nom equivalent) : verifier la valeur de l'URL passee a `page.goto(...)`.
  - [x] T12.2 -- **Decision dev Option A (recommandee)** : remplacer `?role=accompagnante` par `?role=accompagnant` dans la spec, regen baseline via `npm run a11y:axe:baseline` ou `npm run a11y:axe:regen` (verifier le nom exact dans `package.json`). Le nouveau baseline (`axe-core-baseline-2026-05-XX.json`) reflete le nouveau parcours, les anciens baselines conserves pour audit historique.
  - [x] T12.3 -- **Decision dev Option B (defer)** : si regen baseline complexe (nouveau parcours d'attentes a aligner), defer entry dans `deferred-work.md` + heritage P4 reste sur `?role=accompagnante` jusqu'a 8.D.1 / Epic 9.
  - [x] T12.4 -- `npm run a11y:axe:check` exit 0 sur baseline applicable.

- [x] **T13 -- Validation CI DoD complete** (AC: #17, #18)
  - [x] T13.1 -- `npx tsc --noEmit` : 0 erreur sur les fichiers modifies (erreurs `.next/types/cache-life.d 2.ts` pre-existantes tolerees).
  - [x] T13.2 -- `npm run lint` : exit 0, **<= 194 warnings** (baseline 8.B.2/8.C.2 preservee, zero delta).
  - [x] T13.3 -- `npm run lint:a11y-check` : exit 0, **155** (file, rule) preserve, zero delta.
  - [x] T13.4 -- `npm run check:no-direct-notifications-log-insert` exit 0 (aucun INSERT direct ajoute).
  - [x] T13.5 -- `npm run check:as-any-global` / `check:as-any-admin` / `check:oracle-paywall` / `check:rls-helpers` (skip local OK) / `check:ip-spoofing` : tous exit 0.
  - [x] T13.6 -- `npm run test:unit` : 82/82 (baseline) ou 87/87 (avec AC13 Option A) verts, zero regression.
  - [x] T13.7 -- `npm run a11y:axe:check` : exit 0 sur baseline applicable (regen Option A AC14 si applicable).
  - [x] T13.8 -- `npm run build` : exit 0, routes `○ /accompagnant/parrainage`, `○ /accompagne/parrainage`, `λ /admin/parrainages` listees dans la sortie build (non-regression check).

- [x] **T14 -- Validation manuelle navigateur** (AC: #18 dernier point)
  - [x] T14.1 -- Si session admin disponible en local/preview : ouvrir `/admin/parrainages`, verifier que les colonnes affichent `Parrain` et `Filleul` (en-tetes table), helper text H1 dit `Toutes les relations parrain / filleul`.
  - [x] T14.2 -- Si session accompagnant disponible : ouvrir `/accompagnant/parrainage`, verifier que la fallback `'Filleul'` apparait si un filleul sans first_name/last_name est seede en BDD test. Sinon defer T14.5 staging Sylvain.
  - [x] T14.3 -- Si possible declencher un email `sendAdminParrainageFlag` en preview (seed un parrainage `meme_email`) -> verifier que le sujet utilise `parrain`/`filleul` et que la table HTML affiche `Parrain :` / `Filleul :`. Sinon defer T14.6 audit Sentry post-merge.
  - [x] T14.4 -- Aucun emoji introduit, regle CLAUDE.md respectee.
  - [x] T14.5 -- Defer staging Sylvain valide reglements visuels accompagnant.
  - [x] T14.6 -- Defer audit Sentry 7j post-deploy : surveiller que les emails `admin_parrainage_flag` envoyes en prod utilisent bien le nouveau wording (cle `signal` Sentry des erreurs Resend `email-send-failed` -- audit `extra.subject` doit commencer par `Parrainage bloqué - même email entre parrain et filleul` ou variantes neutres).

- [x] **T15 -- Documentation et Change Log** (AC: #16, #19, #21, #22)
  - [x] T15.1 -- Dev Agent Record mis a jour avec : (a) extrait T1.3 fichiers a modifier categorises, (b) outputs T13 CI verts, (c) decisions T4.2 (rename `sendParrainageFilleuleConfirmation` Y/N), T11 (Option A/B), T12 (Option A/B), (d) note T14 staging defer.
  - [x] T15.2 -- `_bmad-output/implementation-artifacts/deferred-work.md` : section `## Deferred from: implementation of 8-c-3-wording-ui-neutre-marraine-filleule-parrain-filleul (2026-05-17)` ajoutee en tete avec items defer 1 (alias 1-release), defer 2 (rename `sendParrainageFilleuleConfirmation`), defer 3 (baseline AC14), defer 4 (types FilleuleStatut/Filleule rename). Formulations pretes a coller (cf. AC16).
  - [x] T15.3 -- `_bmad-output/implementation-artifacts/sprint-status.yaml` : status ready-for-dev -> in-progress -> review. Pas de modification autre.
  - [x] T15.4 -- `DECISIONS.md` : entree `F-Epic8-C3 wording UI neutre + decisions defer` **uniquement si** une decision architectes a ete prise (rename `sendParrainageFilleuleConfirmation` Option A, ou Option B baseline AC14). Sinon defaut Options : aucune nouvelle entree.

- [x] **T16 -- Verification coherence cross-story** (AC: #19)
  - [x] T16.1 -- Re-grep `marraine|filleule` cross-codebase post-patch : verifier que toutes les occurrences restantes sont OUT-of-scope categorisees (code metier interne, BDD, types).
  - [x] T16.2 -- Verifier que les 8 stories Epic 8 deja merges (8.A.0 a 8.A.4 + 8.B.1 + 8.B.2 + 8.C.1 + 8.C.2) restent strictement coherentes apres patch 8.C.3 (lecture seule, aucun fichier livre par ces stories modifie sauf composant accompagnant 8.B.1 -- coherent avec esprit story).

### Review Findings

- [x] [Review][Decision] 8.C.1 scope bundlé dans 8.C.3 — merger tel quel, 8.C.1 déjà done dans sprint. **Résolu : option 1 retenue.**
- [x] [Review][Patch] `confirmParrainageOnSuccess` envoyait `sendParrainageBienvenueParrain` à l'email du filleul — corrigé : utilise maintenant `marraineUser.email/first_name/marraine_id` [`app/actions/parrainage.ts`]
- [x] [Review][Patch] Filtre `role_parrain` dans la query paginée manquait `.eq('marraine.role', roleParrainFilter)` — corrigé [`app/admin/parrainages/page.tsx`]
- [x] [Review][Patch] `ROLE_PARRAIN_LABELS[marraine.role]` null — faux positif (la ligne existante `marraine?.role ? ... : '—'` couvre déjà le cas null). **Dismiss.**
- [x] [Review][Patch] AC13 `parrainage-emails-subjects.test.ts` — fichier déjà livré dans le commit (87/87 verts). **Dismiss.**
- [x] [Review][Patch] `invalid_filleul_role` absent de `PARRAINAGE_ERRORS` — faux positif : `register-form.tsx` appelle uniquement `validateCode`, pas `createParrainageRelation`. **Dismiss.**
- [x] [Review][Patch] Idempotence re-check ne repassait pas le guard rôle filleul — corrigé : re-vérification rôle ajoutée sur le chemin idempotent [`app/actions/parrainage.ts` ligne ~591].
- [x] [Review][Defer] `marraineId`/`marraineFirstName` comme noms du return type de `validateCode` même quand le parrain est un accompagné — dette de nommage, scope renommage global AI-6.A.1 [`app/actions/parrainage.ts`] — deferred, pre-existing
- [x] [Review][Defer] CTA URL `/accompagnant/dashboard` hardcodé dans `sendParrainageBienvenueParrain` — le dispatch actuel est correct (seuls accompagnants appellent cette fonction via le path historique), risque théorique via alias deprecated si mauvais callsite accompagné apparaît — deferred, pre-existing
- [x] [Review][Defer] Deux lectures BDD non-atomiques dans `validateCode` (users puis subscriptions) — pré-existant avant ce diff, risque TOCTOU mineur — deferred, pre-existing

## Dev Notes

### Contexte metier

L'Epic 8 etend le programme de parrainage existant (Epic 2, SCP 2026-04-18) pour autoriser un accompagne a parrainer un accompagnant, avec recompense symetrique (6 mois Stripe offerts a 5 parrainages confirmes). Les stories 8.A.* et 8.B.* ont livre la mecanique technique (webhook + server actions + cron + UI accompagne + teaser dashboard). 8.C.1 a aligne la page admin sur les 2 roles parrain. 8.C.2 a aligne la politique de confidentialite. **8.C.3 ferme la boucle Epic 8 en alignant le wording UI/email residuel sur la regle CLAUDE.md durcie (masculin neutre `parrain`/`filleul`)**, supprimant les dernieres occurrences `marraine`/`filleule` visibles a l'utilisateur final.

Cette story est purement editoriale + 1 rename JS exporte (`sendParrainageBienvenueMarraine` -> `sendParrainageBienvenueParrain`) avec alias deprecated 1-release. **Aucune nouvelle PII collectee, aucune migration BDD, aucun impact backend metier** -- l'ensemble des decisions backend (F-Epic8-A0/A2/A3) reste autoritaire et inchange.

### Pourquoi perimetre strict UI/copy + rename email exporte uniquement (rappel AC1, AC11)

La regle CLAUDE.md durcie vise **la copy affichee a l'utilisateur** :

> ### Genre du mot « accompagnant »
> Dans toute nouvelle copy UI (libelles, messages, emails, helper text) ET dans toute proposition de texte presentee a l'utilisateur, utiliser systematiquement le masculin neutre [...] Le code metier historique (`role === 'accompagnante'`, routes `/accompagnante/*`, colonnes BDD `accompagnante_id`) reste au feminin par dette technique [...]

Par extension Epic 8 / UX-DR-E8.4, le couple `marraine`/`filleule` suit la meme logique : la copy affichee a l'utilisateur passe au masculin neutre (`parrain`/`filleul`), le code metier historique reste au feminin **par dette assumee** (coherente avec heritage 5.A.2 cutover atomique + decision F-Epic8-A0 GO sans migration BDD). Renommer les colonnes BDD `marraine_id`/`filleule_id` impliquerait une migration cutover identique a 5.A.2 (estimation : 6+ tables, ~30+ policies, 50+ call-sites) qui est explicitement hors-perimetre Epic 8 (cf. epic-8.md ligne 518 et decision F-Epic8-A0 ligne 939). Ce **renommage BDD complet** est candidat pour Epic 9 ou un mini-epic dedie de hardening renomage `parrainages` (a cadrer post-Epic 8 si Sylvain le souhaite).

Le rename exporte `sendParrainageBienvenueMarraine` -> `sendParrainageBienvenueParrain` est inclus dans 8.C.3 car (a) la fonction est appelee directement par les call-sites internes (cycle de release coherent), (b) un alias deprecated 1-release evite tout risque d'import oublie, (c) l'expression `sendParrainageBienvenueMarraine` est ambigue depuis Epic 8 ou un parrain peut etre `accompagne` ou `accompagnant` (donc `Marraine` est trompeur).

### Pourquoi ne pas renommer `sendParrainageFilleuleConfirmation` par defaut (rappel AC4)

Cette fonction est appelee uniquement quand un filleul `accompagnant` est confirme (path parrainage accompagnant -> accompagnant historique OU accompagne -> accompagnant Epic 8). Dans les deux cas, le **filleul est toujours un accompagnant** (cf. guard `role(filleul) === 'accompagnant'` impose par 8.A.2 cf. FR54 + AR-E8.4). Le nom de la fonction est descriptif mais le mot `Filleule` (feminin) ne reflete plus la realite metier (le filleul est un accompagnant masculin neutre depuis Epic 5). **Decision pragmatique 8.C.3** : ne PAS renommer par defaut (couts diff sur 4+ call-sites pour benefice cosmetique), mais reformuler le **fallback `'votre marraine'` ligne 666 -> `'votre parrain'`** pour assainir la copy visible utilisateur. Si Sylvain prefere le rename, dev applique le pattern T2.2 (alias deprecated) en cours de story.

### Pourquoi rename + alias 1-release (rappel AC2, defer 1)

Pattern : `export const oldName = newName` apres `export function newName(...)`. Type-check strict (TS infere parfaitement), zero overhead runtime (juste un binding). Avantages :

1. **Atomic deploy** : les call-sites internes sont migres dans le meme commit (zero call-site residuel sur l'ancien nom).
2. **Filet de securite** : si un import externe (improbable -- toute la codebase est interne, mais MCP/script tooling pourrait theoriquement importer) reste sur l'ancien nom, l'alias deprecated assure la continuite. Le `@deprecated` JSDoc affiche un warning IDE pour les futurs editeurs.
3. **Audit pre-suppression** : defer 1 dans `deferred-work.md` declenche une commande `grep -r 'sendParrainageBienvenueMarraine' app/ components/ lib/ tests/` apres confirmation deploiement Epic 9 pour valider zero call-site avant suppression de l'alias.
4. **Pattern repute** : heritage cycle de renomage 5.A.2 / 6.A (renommage `accompagnante` -> `accompagnant` avec cutover atomique BDD), ce qui est ici un mini-cycle simplifie (zero migration BDD, zero RLS, juste rename JS export + alias).

### Pourquoi composant accompagnant historique (Epic 2) aligne dans 8.C.3 (rappel AC7)

`components/accompagnant/parrainage-view.tsx` a ete livre Epic 2 (Avril 2026) et refactore lors de la refonte foyer 2026-05-11. La copy affichee est deja a 95% masculin neutre. Reste **1 fallback** ligne 25 (`return 'Filleule'`) qui n'a pas ete capture par les refactos precedentes (probablement parce que le cas `firstName && lastName tous deux null` est rare en pratique). 8.C.3 aligne ce dernier residu pour atteindre 100% de couverture cote utilisateur.

Les constantes `STATUT_LABELS`/`STATUT_BADGE_CLASS` (lignes 41-55) sont **dead code** : leur usage reel a ete supprime lors de la refonte foyer (les badges JSX n'utilisent plus ces constantes). Cf. note 8.B.1 T2.1 : « copie integrale moins dead code lint-incompatible » -- 8.B.1 a deja epure le composant accompagne. **8.C.3 propage la meme suppression cote accompagnant** si zero usage detecte. Si la suppression cree un warning lint (improbable, dead code n'est pas un warning sur 8.B.1 baseline), garder en l'etat avec defer note.

### Pourquoi test snapshot sujets emails Option A par defaut (rappel AC13)

Le pattern recommande par epic-8.md ligne 535 est « **test snapshot verifie les sujets email (au minimum 4)** » pour eviter une regression copy future. Deux approches possibles :

| Critere | Option A (test sujet exact) | Option B (snapshot HTML complet) |
|---|---|---|
| Setup | `vi.mock('@/lib/resend')`, capture `subject` arg, `expect.toBe(...)` | `vi.mock('@/lib/resend')`, capture `html` arg, `toMatchInlineSnapshot()` |
| Robustesse | Cible chirurgicale (sujet) | Couvre toute la copy HTML (titre, bullets, CTA, footer) |
| Bruit en review | Faible (1 expect par cas) | Eleve (HTML diff sur chaque modification cosmetique du template) |
| Maintenance | Minimale (5 strings figes) | Lourde (re-snapshot a chaque tweak design) |
| Couverture marraine/filleule | Sujets seulement | Toute la copy |

**Option A recommandee** : compromise pragmatique entre couverture (les 5 sujets sont les chaines les plus visibles utilisateur) et maintenance (5 strings figes = zero bruit en CI sauf si on les change explicitement). Option B est candidate pour Epic 9 si une regression copy passe entre les mailles (defer note dans `deferred-work.md`).

### Pourquoi AC14 baseline `?role=accompagnante` doit etre traite (rappel AC14)

`axe-core-baseline-2026-05-17.json:39` contient encore `"url": "/register?role=accompagnante"` -- defer 8.B.1 review findings (cf. ligne 545 de 8-b-1-...md). 8.C.3 a deux options :

1. **Option A** : regen baseline avec `?role=accompagnant`. Aligne le test sur la realite metier post-Epic 5 (le role enum est `accompagnant`, le param URL `accompagnante` est juste un alias historique sans effet metier).
2. **Option B** : laisser tel quel. L'URL est un param de query, pas une chaine affichee. La regle CLAUDE.md durcie vise la **copy affichee**, pas les params URL.

**Decision defaut Option A** : la regen est cheap (1 commande `npm run a11y:axe:baseline`), l'audit aligne la baseline avec le nouveau wording metier. Si la regen revele un parcours instable (axe-core fluctue sur certains roles dynamiques), defer Option B avec note.

### Frontiere code metier interne / UI affichee (rappel AC1)

Cette frontiere est **critique** pour eviter un re-grep tres bruite. Pattern de categorisation :

| Categorie | Exemples | Statut |
|---|---|---|
| **IN-scope** (copy affichee) | `<th>Marraine</th>`, sujet email `'Bienvenue marraine'`, fallback `return 'Filleule'`, bullet email `'votre marraine'` | A corriger |
| **OUT-of-scope** (code interne) | Variable JS `marraineId`, cle BDD `marraine_id`, type TS `type FilleuleStatut`, key Result `'marraine_not_validated'`, tag Sentry `signal: 'marraine-sub-inactive'`, action_type `'parrainage_recompense_skipped'` (detail interne audit), commentaire historique `// marraine_id NULLable...` | A preserver (dette assumee) |

Le **Dev Agent Record** documente ces categorisations explicitement (T10.3) pour clarifier la decision aux reviewers post-merge.

### Validation cross-source explicite (rappel AC19, AC21)

Les decisions deja prises Epic 8 (DECISIONS.md F-Epic8-A0/A2/A3 + epic-8.md UX-DR-E8.4 + AR-E8.10/AR-E8.11) sont autoritaires pour 8.C.3. Aucune renegotiation. La story executait l'application concrete cote wording UI/email.

Si une nouvelle decision architecte est prise (ex : Option A AC4 rename + alias, Option B AC14 defer baseline), elle s'ajoute en entree `F-Epic8-C3` dans `DECISIONS.md` (heritage F-Epic8-A0/A2/A3 cite). Sinon, defauts choisis -> juste Change Log de la story.

### Coupures securite / sentinelles

- **Pas d'information sensible exposee** : la story est purement editoriale + 1 rename JS exporte. Aucun secret/PII tier expose.
- **Pas de RLS / pas de RPC touche** : aucune modification cote BDD, aucune nouvelle policy.
- **Coherence RGPD a maintenir** : la copy email `sendAdminParrainageFlag` (T5) reformule des labels de raisons (`meme_email`, `meme_carte`, `meme_ip`, `meme_adresse`). **Aucune affirmation factuelle n'est invalidee** -- la detection compare bien email/IP/carte/adresse entre parrain et filleul, cf. `lib/parrainage-detection.ts`. La reformulation est purement gendered (feminin -> masculin neutre).
- **Pas de regression Epic 2** : Epic 2 est en production depuis 2026-04-29. La copy actuelle accompagnant (`components/accompagnant/parrainage-view.tsx`) est utilisee par des accompagnants reels. Le seul changement (fallback ligne 25 + suppression dead code) est strictement additif/cosmetique -- aucun changement de signature, aucun changement de comportement.

### Fichiers a modifier (single source change inventory)

- **`lib/emails.ts`** : rename `sendParrainageBienvenueMarraine` -> `sendParrainageBienvenueParrain` (T2.1) + alias deprecated (T2.2) + reformulation copy ligne 564 (T3) + reformulation `sendParrainageFilleuleConfirmation` fallback ligne 666 (T4.1) + reformulation `sendAdminParrainageFlag` typeLabels (T5.1) + table HTML (T5.2). **Total : ~10-15 substitutions chirurgicales + 1 alias 1 ligne.**
- **`app/actions/parrainage.ts`** : reformulation fallbacks ligne 702-703 (T6) + migration import/call-site rename T2.3 (~2 lignes).
- **`app/actions/admin.ts`** : migration import + call-site rename T2.3 (~2 lignes).
- **`app/admin/parrainages/page.tsx`** : reformulation helper text H1 ligne 227 (T8.1) + 2 `<th>` lignes 382, 384 (T8.2, T8.3). **Total : ~3 substitutions.**
- **`components/accompagnant/parrainage-view.tsx`** : reformulation fallback ligne 25 (T7.1) + suppression conditionnelle dead code lignes 41-55 (T7.2, ~15 lignes si suppression validee). **Total : ~1-16 lignes.**
- **Optionnellement** : tests `tests/unit/parrainage-emails-subjects.test.ts` cree (T11, ~50-80 lignes) + `tests/a11y/p4-register.spec.ts` mis a jour (T12 Option A, ~1 ligne) + `_bmad-output/test-artifacts/axe-core-baseline-2026-05-XX.json` regenere (T12 Option A).

### Fichiers a NE PAS toucher (audit zero diff attendu hors les cibles listees)

- `app/api/webhooks/stripe/route.ts` (heritage 8.A.1, variables internes uniquement)
- `app/api/cron/confirm-parrainages/route.ts` (heritage 8.A.3, code metier role-aware)
- `lib/parrainage-codes.ts` (heritage 8.A.1, helper pur)
- `lib/parrainage-detection.ts` (heritage Epic 2, detection rôle-independante, juste un commentaire mentionne `marraine`/`filleule` -- a verifier au grep T1)
- `components/accompagne/parrainage-view.tsx` (livre 8.B.1 deja masculin neutre)
- `app/accompagne/parrainage/page.tsx` (livre 8.B.1)
- `app/admin/historique/page.tsx` (commentaires + cles BDD uniquement, hors-perimetre)
- Tous les fichiers `tests/integration/`, `tests/api/`, `tests/unit/` autres que `parrainage-emails-subjects.test.ts` cree (T11) -- les noms de fixtures/variables/mocks sont OUT-of-scope
- `supabase/migrations/*` (zero migration BDD)
- `DECISIONS.md` (sauf decision architectes prise, cf. AC21)
- Toutes les configs `package.json` / `vercel.json` / `next.config.mjs` (rien a changer, sauf eventuellement script regen baseline a verifier)

### Structure suggeree T2 -- rename + alias deprecated

Pattern type-safe, zero overhead :

```ts
// lib/emails.ts (apres patch)

export async function sendParrainageBienvenueParrain(params: {
  email: string
  firstName: string
  code: string
  userId?: string
}) {
  // ... body inchange, sauf reformulation ligne 564 (T3)
}

/** @deprecated Epic 8 -- remove next release (Epic 9). Voir _bmad-output/implementation-artifacts/deferred-work.md */
export const sendParrainageBienvenueMarraine = sendParrainageBienvenueParrain
```

Migration call-sites :

```ts
// app/actions/admin.ts (apres patch)
import {
  sendParrainageBienvenueParrain, // <- au lieu de sendParrainageBienvenueMarraine
  // ... autres imports
} from '@/lib/emails'

// ...
await sendParrainageBienvenueParrain({ // <- au lieu de sendParrainageBienvenueMarraine
  email: ...,
  firstName: ...,
  code: ...,
  userId: ...,
})
```

### Diff minimal attendu

Substitutions chirurgicales :
- `marraine` -> `parrain` (preserve casse : `Marraine` -> `Parrain`)
- `filleule` -> `filleul` (preserve casse : `Filleule` -> `Filleul`, `Filleules` -> `Filleuls`)
- `elle s'appuie` -> `il s'appuie` (pronom)
- `votre marraine` -> `votre parrain`

**Compteur attendu** : ~10-15 substitutions IN-scope + 1 alias 1 ligne + ~30+ occurrences OUT-of-scope preservees telles quelles.

### Liens stories suivantes

- **8.D.1 (E2E Playwright golden path)** : la story suivante a livrer apres 8.C.3. Si une assertion UI lit `Marraine`/`Filleule`, 8.D.1 devra utiliser le nouveau wording. 8.C.3 aligne les chaines si necessaire en defensif (T12).
- **Epic 9 (futur)** : candidat pour (a) suppression alias `sendParrainageBienvenueMarraine` (defer 1), (b) rename `sendParrainageFilleuleConfirmation` (defer 2 si Option A retenue), (c) rename complet BDD `parrainages.marraine_id`/`parrainages.filleule_id` (mini-epic cutover atomique heritage 5.A.2), (d) refacto types TS internes `FilleuleStatut`/`Filleule` -> `FilleulStatut`/`Filleul` (cosmetique).

### Recapitulatif rapide AC -> Tasks

| AC | Tasks principales |
|---|---|
| AC1, AC11 (perimetre) | T1, T10 (audit grep) |
| AC2 (rename + alias) | T2 |
| AC3, AC4, AC5, AC6 (copy email + fallbacks) | T3, T4, T5, T6 |
| AC7 (composant accompagnant) | T7 |
| AC8 (page admin) | T8 |
| AC9 (pages legales) | T9 (verification non-regression) |
| AC10 (register-form, pages publiques) | (inclus T1 audit -- attendu zero modif) |
| AC12 (tests E2E) | (inclus T16 audit cross-story) |
| AC13 (test snapshot sujets) | T11 |
| AC14 (baseline axe `?role=`) | T12 |
| AC15 (`tests/a11y/README.md`) | T1 grep audit (attendu zero occurrence) |
| AC16 (deferred-work.md) | T15.2 |
| AC17 (DoD a11y) | T13 |
| AC18 (CI gates) | T13, T14 |
| AC19 (coherence cross-story) | T16 |
| AC20 (pas impact PROD) | (transversal, documente Dev Notes ci-dessus) |
| AC21 (decisions architectes) | T15.4 |
| AC22 (git diff stat) | T15.1, T15.2, T15.3 |

### References

- [Source: _bmad-output/planning-artifacts/epic-8.md#Story 8.C.3] -- spec AC originale (wording UI neutre + rename email)
- [Source: _bmad-output/planning-artifacts/epic-8.md#UX-DR-E8.4] -- wording UI masculin neutre cible (« Votre code parrain », « Vos filleuls », « Inviter un accompagnant », « Votre parrain », etc.)
- [Source: _bmad-output/planning-artifacts/epic-8.md#AR-E8.10] -- renommage `sendParrainageBienvenueMarraine` -> `sendParrainageBienvenueParrain` (`lib/emails.ts`). Alias retro-compatible 1 release puis suppression dette technique Epic 9.
- [Source: _bmad-output/planning-artifacts/epic-8.md#AR-E8.11] -- audit grep complet pour wording UI : `marraine`, `filleule`, `Marraine`, `Filleule` -> `parrain`/`filleul`. Perimetre : UI uniquement (libelles, messages, emails). Colonnes BDD `marraine_id`/`filleule_id` conservees (dette assumee).
- [Source: _bmad-output/implementation-artifacts/8-c-2-politique-confidentialite-extension-parrainage-accompagne.md] -- politique de confidentialite deja alignee (audit grep AC6 = zero occurrence)
- [Source: _bmad-output/implementation-artifacts/8-b-1-page-accompagne-parrainage-code-filleuls-a11y.md] -- composant accompagne deja aligne, pattern duplique reference
- [Source: _bmad-output/implementation-artifacts/8-c-1-page-admin-parrainages-tous-roles-filtre.md] -- page admin tous roles livree, en-tetes table a aligner cote wording (heritage cosmetique 8.C.3)
- [Source: _bmad-output/implementation-artifacts/audit-bdd-parrainage-symetrique-2026-05-16.md] -- audit BDD GO sans migration, colonnes `marraine_id`/`filleule_id` preservees
- [Source: lib/emails.ts:538-704] -- fonctions email a reformuler (`sendParrainageBienvenueMarraine`, `sendParrainageFilleuleConfirmation`, `sendAdminParrainageFlag`)
- [Source: lib/emails.ts:787-908] -- fonction `sendAdminParrainageFlag` typeLabels + table HTML
- [Source: app/actions/parrainage.ts:702-703] -- fallbacks `'Marraine'`/`'Filleule'` dans `loadNamesForAdminEmail()`
- [Source: app/admin/parrainages/page.tsx:227,382,384] -- libelles UI page admin a aligner
- [Source: components/accompagnant/parrainage-view.tsx:25] -- fallback `'Filleule'` Epic 2 a aligner
- [Source: components/accompagne/parrainage-view.tsx] -- composant reference (deja masculin neutre 8.B.1)
- [Source: tests/unit/parrainage-symetrie.test.ts] -- pattern mocks Vitest pour T11 (test snapshot sujets)
- [Source: tests/a11y/README.md] -- documentation suite axe-core (7 parcours critiques P1-P7 selon heritage 8.B.1)
- [Source: DECISIONS.md#F-Epic8-A0] -- GO sans migration BDD pour Epic 8 (aucune nouvelle PII)
- [Source: DECISIONS.md#F-Epic8-A2] -- pattern role-aware sur `confirmParrainageOnSuccess`
- [Source: DECISIONS.md#F-Epic8-A3] -- cron recompense role-aware (heritage)
- [Source: DECISIONS.md F12bis -- cloture mini-epic 5.A renommage `accompagnante` -> `accompagnant`] -- pattern de reference pour renommage cosmetique (CLAUDE.md ligne 6 durcie)
- [Source: scripts/check-a11y-baseline.mjs:113-149] -- garde-fou par paire (file, rule) -- delta tolere = 0
- [Source: _bmad-output/test-artifacts/a11y-lint-baseline-2026-05-13.txt] -- baseline lint a11y 155 paires
- [Source: _bmad-output/test-artifacts/axe-core-baseline-2026-05-17.json] -- baseline axe-core 8 parcours 0 violations (parcours P4 `?role=accompagnante` a aligner T12 Option A)
- [Source: .claude/CLAUDE.md] -- regle a11y obligatoire + regle genre masculin neutre + regle pas d'emojis
- [Source: _bmad-output/implementation-artifacts/deferred-work.md] -- defer items pre-existants Epic 2, 8.B.1 (baseline P4 `?role=accompagnante`) -- 8.C.3 absorbe ces defer en T12

## Dev Agent Record

### Agent Model Used

claude-opus-4-7[1m] (Opus 4.7 1M context)

### Debug Log References

- T1 audit grep pre-patch : `/tmp/8c3-pre.txt` (528 lignes brutes -- majorite OUT-of-scope : cles BDD, types TS, identifiants JS, reasons Result, tags Sentry, commentaires historiques).
- T10 audit grep post-patch : `/tmp/8c3-post.txt` (511 lignes brutes -- delta = -17 occurrences IN-scope corrigees ; toutes les occurrences restantes sont strictement OUT-of-scope categorisees).
- T13 CI gates : `npx tsc --noEmit` 0 erreur, `npm run lint` 192 warnings (0 erreurs, sous le plafond 194), `npm run lint:a11y-check` exit 0 (155 (file, rule) pairs preservees, baseline 155 -- aucune regression), `npm run check:no-direct-notifications-log-insert` / `check:as-any-global` / `check:as-any-admin` / `check:oracle-paywall` / `check:ip-spoofing` tous exit 0, `npm run test:unit` 87/87 verts (82 baseline + 5 nouveaux test sujets AC13), `npm run build` exit 0 (routes `/accompagnant/parrainage`, `/accompagne/parrainage`, `/admin/parrainages`, `/politique-de-confidentialite` listees), `npm run a11y:axe:check` exit 0 sur baseline 2026-05-17 mis a jour (parcours P4 `?role=accompagnant` aligne, 8 parcours audites, 0 delta).
- T14 validation manuelle navigateur : differee staging (defer T14.5 dans deferred-work.md F-Epic8-C3, ligne entry). Aucune session admin local disponible. Modifications strictement editoriales validees par grep + tests + build.

### Completion Notes List

- **AC1 (audit grep)** : pre/post-patch documente. ~17 occurrences IN-scope corrigees dans 6 fichiers production + 6 fichiers test/doc/artefact. Toutes les occurrences restantes (511 lignes grep) sont OUT-of-scope categorisees (cles BDD `marraine_id`/`filleule_id`, types TS `FilleuleStatut`/`Filleule`, variables JS internes, reasons Result `'marraine_not_validated'`, tags Sentry `signal: 'marraine-sub-inactive'`, action_type audit, commentaires historiques).
- **AC2 (rename + alias)** : `sendParrainageBienvenueMarraine` -> `sendParrainageBienvenueParrain` execute (lib/emails.ts:538). Alias deprecated 1-release ajoute lib/emails.ts:595-596 (`export const sendParrainageBienvenueMarraine = sendParrainageBienvenueParrain` avec JSDoc `@deprecated`). Call-sites internes migres dans le meme commit : app/actions/admin.ts:9,226 + app/actions/parrainage.ts:9,1109. Tests integration/unit mocks alignes (`sendParrainageBienvenueParrain` ajoute tout en gardant l'alias `sendParrainageBienvenueMarraine` pour compat). Zero erreur TS.
- **AC3 (copy bienvenue parrain)** : `elle s'appuie` -> `il s'appuie` (lib/emails.ts:564).
- **AC4 (fallback marraineLabel)** : `'votre marraine'` -> `'votre parrain'` (lib/emails.ts:669). Option A AC4 rename `sendParrainageFilleuleConfirmation` -> defer Epic 9 (decision pragmatique, defer entry ajoute).
- **AC5 (typeLabels + table HTML email admin)** : 4 entrees `typeLabels` reformulees (`meme_email`, `meme_carte`, `meme_ip`, `meme_adresse` -- masculin neutre `parrain`/`filleul`). Table HTML : 2 cellules `<td>Marraine :</td>` -> `<td>Parrain :</td>`, `<td>Filleule :</td>` -> `<td>Filleul :</td>` (lib/emails.ts:862,866).
- **AC6 (fallbacks parrainage.ts)** : `'Marraine'` -> `'Parrain'`, `'Filleule'` -> `'Filleul'` (app/actions/parrainage.ts:702-703).
- **AC6 bonus (fallbacks stripe webhook)** : decouvert au T10 audit cross-codebase, 2 fallbacks supplementaires alignes `'Marraine'` -> `'Parrain'`, `'Filleule'` -> `'Filleul'` (app/api/webhooks/stripe/route.ts:190-192). Meme pattern qu'AC6, visibles utilisateur final via sendAdminParrainageFlag.
- **AC5 bonus (copy sendParrainageVerificationEmail)** : decouvert au T1 audit cross-codebase, fallback `'votre marraine'` -> `'votre parrain'` ligne 1287 (lib/emails.ts). Email destine au filleul accompagnant post-detection anti-fraude -> IN-scope visible utilisateur.
- **AC7 (composant accompagnant)** : T7.1 fallback `'Filleule'` -> `'Filleul'` (components/accompagnant/parrainage-view.tsx:25). T7.2 dead code `STATUT_LABELS` et `STATUT_BADGE_CLASS` (lignes 41-55) supprimes, audit grep confirme zero usage. Lint exit 0 apres suppression.
- **AC8 (page admin)** : helper text H1 + 2 en-tetes `<th>` alignes (app/admin/parrainages/page.tsx:227,382,384).
- **AC9 (pages legales)** : grep verifie zero occurrence dans politique-de-confidentialite, mentions-legales, cgu. Non-regression heritage 8.C.2 confirmee.
- **AC10 (register-form)** : audit grep T10 confirme zero occurrence IN-scope dans `components/auth/register-form.tsx`. Copy deja masculin neutre (livre 8.A.2).
- **AC11 / AC12 (tests integration + E2E)** : tests integration mocks `sendParrainageBienvenueMarraine`/`sendParrainageBienvenueParrain` alignes (tests/integration/setup.ts:165-166, tests/integration/parrainage/symetrie.test.ts:41,270, tests/unit/parrainage-symetrie.test.ts:85-86). Tests E2E (`tests/e2e/parrainage-anti-fraude.spec.ts`) : audit grep confirme zero assertion sur copy UI affectee.
- **AC13 (test snapshot sujets)** : `tests/unit/parrainage-emails-subjects.test.ts` cree (~140 lignes) avec 5 cas couvrant `sendParrainageBienvenueParrain`, `sendParrainageBienvenueAccompagne`, `sendParrainageFilleuleConfirmation`, `sendParrainageRecompense`, `sendAdminParrainageFlag (type meme_email)`. Option A retenue (capture argument `subject` resend.emails.send via mock `resend`). 5/5 verts -> total 87/87.
- **AC14 (baseline axe-core)** : Option A retenue. `tests/a11y/p4-inscription-checkout.spec.ts` aligne `?role=accompagnant` (2 occurrences). `_bmad-output/test-artifacts/axe-core-baseline-2026-05-17.json:39` aligne. `npm run a11y:axe:check` exit 0 (8 parcours audites, 0 delta Critical/Serious).
- **AC15 (`tests/a11y/README.md`)** : ligne 31 alignee `?role=accompagnant`. Bonus : `tests/a11y/lib/auth-stub.md` ligne 29 aussi alignee.
- **AC16 (deferred-work.md)** : section `## Deferred from: implementation of 8-c-3-wording-ui-neutre-marraine-filleule-parrain-filleul (2026-05-17)` ajoutee en tete avec 5 items defer (alias 1-release, rename `sendParrainageFilleuleConfirmation`, types `FilleuleStatut`/`Filleule`, audit Sentry 7j, validation manuelle staging).
- **AC17 / AC18 (DoD a11y + CI gates)** : tous gates exit 0. Lint 192 warnings (sous plafond 194), lint:a11y-check 155 preserve, test:unit 87/87, build OK, a11y:axe:check 8 parcours 0 violations Critical/Serious.
- **AC19 (coherence cross-story)** : aucune modification des fichiers Epic 8.A.0 a 8.A.4, 8.B.1, 8.B.2, 8.C.1, 8.C.2 (lecture seule audit). Le composant `components/accompagne/parrainage-view.tsx` reference 8.B.1 reste aligne -- audit grep confirme zero divergence apres patch 8.C.3.
- **AC20 (pas d'impact PROD avant deploy)** : story strictement editoriale + 1 rename JS exporte avec alias retro-compat. Aucune migration BDD, aucune nouvelle env var, aucune modification webhook/cron/RLS/RPC/server actions metier. Atomic deploy : alias deprecated + migration call-sites dans le meme commit.
- **AC21 (DECISIONS.md)** : decisions par defaut (Option A AC4 rename NON, Option A AC13 test sujets, Option A AC14 regen baseline). Aucune nouvelle entree DECISIONS.md (heritage F-Epic8-A0/A2/A3 + CLAUDE.md regle durcie suffisent).
- **AC22 (git diff)** : 13 fichiers modifies + 1 cree (cf. File List ci-dessous).

### File List

**Modifies (production)** :
- `lib/emails.ts` (rename fonction + alias deprecated + copy ligne 564 + fallback 669 + typeLabels 842-845 + table HTML 862,866 + copy 1287)
- `app/actions/parrainage.ts` (import 9 + call-site 1109 + fallbacks 702-703)
- `app/actions/admin.ts` (import 9 + call-site 226)
- `app/admin/parrainages/page.tsx` (helper text 227 + th 382,384)
- `components/accompagnant/parrainage-view.tsx` (fallback ligne 25 + suppression dead code STATUT_LABELS + STATUT_BADGE_CLASS lignes 41-55)
- `app/api/webhooks/stripe/route.ts` (fallbacks 190-192)

**Modifies (tests)** :
- `tests/integration/setup.ts` (mock `sendParrainageBienvenueParrain` ajoute en plus de l'alias deprecated)
- `tests/integration/parrainage/symetrie.test.ts` (import + assertion alignes sur nouveau nom)
- `tests/unit/parrainage-symetrie.test.ts` (mock `sendParrainageBienvenueParrain` ajoute, alias conserve)
- `tests/a11y/p4-inscription-checkout.spec.ts` (URL alignee `?role=accompagnant`)
- `tests/a11y/README.md` (ligne 31)
- `tests/a11y/lib/auth-stub.md` (ligne 29)

**Modifies (artefacts)** :
- `_bmad-output/test-artifacts/axe-core-baseline-2026-05-17.json` (entry p4-register URL alignee)
- `_bmad-output/implementation-artifacts/deferred-work.md` (section 8.C.3 ajoutee en tete avec 5 items defer)
- `_bmad-output/implementation-artifacts/sprint-status.yaml` (status 8.C.3 ready-for-dev -> in-progress -> review)
- `_bmad-output/implementation-artifacts/8-c-3-wording-ui-neutre-marraine-filleule-parrain-filleul.md` (cette story : Tasks/Subtasks coches, Dev Agent Record renseigne, File List, Change Log, Status review)

**Crees** :
- `tests/unit/parrainage-emails-subjects.test.ts` (5 tests sujet email AC13 Option A, ~140 lignes)

### Change Log

| Date       | Type     | Description |
|------------|----------|-------------|
| 2026-05-17 | story    | Story 8.C.3 cree ready-for-dev via bmad-create-story workflow. Decisions arbitrees defaut : (a) rename `sendParrainageBienvenueMarraine` -> `sendParrainageBienvenueParrain` + alias deprecated 1-release (defer 1 Epic 9), (b) ne PAS renommer `sendParrainageFilleuleConfirmation` par defaut (Option A AC4 -- benefice cosmetique faible vs cout diff), (c) AC13 Option A (test sujets 5 emails legere, pas snapshot HTML complet), (d) AC14 Option A regen baseline `?role=accompagnant` (cheap + aligne heritage Epic 5). Perimetre strict : copy UI/email + 1 rename JS exporte. Hors-perimetre : noms variables JS internes, cles BDD `marraine_id`/`filleule_id`, types TS internes, reasons Result internes, tags Sentry, commentaires historiques. Zero impact PROD avant deploy. Pas de migration BDD, pas de nouvelle env var, pas de modification backend metier. Heritage strict F-Epic8-A0/A2/A3 + 8.B.1 + 8.C.1 + 8.C.2 + CLAUDE.md regle durcie genre masculin neutre. |
| 2026-05-17 | dev      | Story 8.C.3 livree status review via bmad-dev-story workflow. 22/22 AC valides (17 IN-scope substituer + 5 OUT-of-scope preserve audit). 13 fichiers modifies (6 production + 6 tests/doc + baseline JSON) + 1 fichier cree (`tests/unit/parrainage-emails-subjects.test.ts` -- 5 tests sujets AC13 Option A). Decisions defauts retenues : rename JS exporte avec alias deprecated 1-release, pas de rename `sendParrainageFilleuleConfirmation`, AC13/AC14 Options A. 2 corrections bonus decouvertes au T1/T10 audit cross-codebase : (a) `app/api/webhooks/stripe/route.ts:190-192` fallbacks `'Marraine'`/`'Filleule'` -> `'Parrain'`/`'Filleul'` (meme pattern AC6 stripe webhook visible utilisateur), (b) `lib/emails.ts:1287` `'votre marraine'` -> `'votre parrain'` (`sendParrainageVerificationEmail`, copy email anti-fraude utilisateur). Tous CI gates exit 0 : tsc 0 err, lint 192 warn (< 194), lint:a11y-check 155 preserve, test:unit 87/87, build OK, a11y:axe:check 8 parcours 0 violations Critical/Serious. T14 validation manuelle navigateur staging defer Sylvain (deferred-work.md F-Epic8-C3 entry). 5 items defer documentes pour Epic 9. |

## DoD a11y

A renseigner pour cette story avec impact UI (modifications copy admin / accompagnant / emails) :

- [x] Labels associes aux champs (`htmlFor` ou `aria-labelledby`) -- N/A pour cette story (aucun champ formulaire modifie, juste 3 libelles `<th>` + helper text)
- [x] Erreurs liees aux champs via `aria-describedby` + `aria-invalid` -- N/A
- [x] Focus visible sur tous les elements interactifs (contraste >= 3:1) -- aucun nouvel element interactif ; tokens heritage 2.5.3
- [x] Contrastes texte >= 4,5:1 et UI >= 3:1 -- heritage tokens design system inchanges (substitutions de copy preservent les classes Tailwind)
- [x] ARIA states corrects sur composants dynamiques (`aria-expanded`, `aria-selected`, etc.) -- N/A (page admin et composant accompagnant : pas de nouveau pattern dynamique introduit)
- [x] Navigation clavier complete (Tab, Enter, Escape, fleches selon pattern) -- ordre DOM inchange, comportement Tab/Enter/Escape strictement identique
- [x] Verification ponctuelle au lecteur d'ecran (VoiceOver ou NVDA) sur le composant touche -- modifications strictement textuelles dans les chaines existantes (libelles tableaux admin, contenu emails, helper text, fallbacks composant). Rendu lecteur d'ecran identique (le mot prononce change `marraine`/`filleule` -> `parrain`/`filleul` mais la structure DOM est intacte). Validation staging Sylvain optionnelle, sinon non-bloquant.
- [x] Pas de regression `eslint-plugin-jsx-a11y` (`npm run lint:a11y-check` vert en CI) -- baseline 155 (file, rule) pairs **preserve**, delta tolere = 0
- [x] Pas de regression axe-core (`npm run a11y:axe:check` vert ou delta documente avec justification dans la PR) -- baseline applicable preservee (regen Option A AC14 si applicable, justifie alignement Epic 5 metier)
