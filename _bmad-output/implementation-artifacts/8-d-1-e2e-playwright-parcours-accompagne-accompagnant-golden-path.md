# Story 8.D.1 : E2E Playwright -- parcours `accompagne -> accompagnant` golden path

Status: review

<!-- Note: Validation is optional. Run validate-create-story for quality check before dev-story. -->

## Story

As a responsable qualite roxanetnous (Sylvain, mainteneur solo),
I want un test E2E Playwright qui couvre le **parcours golden path du parrainage symetrique Epic 8** (`accompagne parraine accompagnant` : code visible cote accompagne -> validation code cote accompagnant -> bypass visio applique -> filleul devient parrain a son tour),
so that toute regression UX du parcours nouveau livre par 8.A/8.B (page `/accompagne/parrainage`, validation `validateCode` role-aware, `confirmParrainageOnSuccess` role-aware, bypass visio onboarding) soit detectee automatiquement avant merge ; la mecanique backend etant deja verrouillee par 8.A.4 (6 SC integration), 8.D.1 verrouille la **shape UI + flux navigation** bout-en-bout en reutilisant l infra Playwright posee par 7.C.1 et le pattern shortcut BDD valide par 7.C.2 (proxy server actions non appelables via le protocole RSC interne Next.js). **Aucun bloquant go-live Bretagne** (deja confirme Epic 5/6). Cette story cloture le mini-epic 8.D et acheve l Epic 8.

## Acceptance Criteria

1. **AC1 -- Fichier `tests/e2e/parrainage-symetrique.spec.ts` cree et vert en GHA** : couvre exactement les scenarios decrits AC2 a AC5. Le fichier reutilise les helpers `loginAs` (`tests/e2e/_lib/session.ts`), `resetEphemeralRows` + `assertLocalPgUrl` (`tests/e2e/_lib/fixtures.ts`), le pg client direct pour seeds/assertions BDD, et le PO `OnboardingPage` deja livre 7.C.2. **Tagger** chaque test avec `@parrainage-symetrique` pour execution selective via `npx playwright test --grep @parrainage-symetrique`. Pattern strict heritage 7.C.2 : `test.beforeAll(resetEphemeralRows)` + `test.afterAll(resetEphemeralRows)`.

2. **AC2 -- SC1 `[golden-path] parrain accompagne affiche son code parrainage sur /accompagne/parrainage`** :
   - **Setup BDD via pg client** (pattern 7.C.2 + helper `withPg`) :
     - `INSERT public.subscriptions (id, user_id, ..., status='active', plan_type='mensuel', current_period_start=now()-7d, current_period_end=now()+23d, first_subscription_date=now()-7d)` pour user3 (`...000003`, role `accompagne`). Le seed `04_subscriptions.sql` cree deja `ccc2` (status `active` mais expiree) pour user3 -- 8.D.1 doit upserter via `ON CONFLICT (id) DO UPDATE SET status='active', current_period_end=now()+30d` sur `ccc2` (pas une nouvelle row pour eviter pollution) ; **OR** mieux : faire `UPDATE public.subscriptions SET current_period_end = now() + interval '30 days', current_period_start = now() - interval '7 days' WHERE id = '...00000000ccc2'` -- transforme l abonnement expire seed en abonnement actif futur pour la duree du test. Pas de `e2e-test-` prefix requis car le seed est partage et la modification est non-destructive (reset au prochain `npm run seed:test:reset`).
     - `INSERT public.parrainages_codes (user_id, code, compteur_confirmes, total_recompenses)` pour user3 avec `code='E2ETEST8'` (8 caracteres, alphabet `ABCDEFGHJKMNPQRSTUVWXYZ23456789` -- cf. `app/actions/parrainage.ts:24`). **Important** : ne PAS utiliser le prefix `e2e-test-` ici car `parrainages_codes.code` est UNIQUE et `CODE_REGEX = /^[ABCDEFGHJKMNPQRSTUVWXYZ23456789]{8}$/` (le tiret + minuscules echoueraient `normalizeCode`). Utiliser `ON CONFLICT (user_id) DO UPDATE SET code='E2ETEST8'`. La cleanup `resetEphemeralRows` ne supprime pas `parrainages_codes` (cf. `fixtures.ts:37-65`) -- ajouter un cleanup specifique dans `afterAll` du fichier de test : `DELETE FROM public.parrainages_codes WHERE user_id = '...000003' AND code = 'E2ETEST8'` (pas de cascade vers autres tables -- la FK `parrainages.code` est NULLable sur DELETE de `parrainages_codes`, mais on supprime aussi les `parrainages` du test via leur prefix `e2e-test-`).
   - **Action UI** : `loginAs(page, 'accompagne')` puis navigation `/accompagne/parrainage`.
   - **Assertions UI** :
     - URL finale matchee : `/accompagne/parrainage` (pas de redirect ailleurs).
     - H1 visible : `getByRole('heading', { level: 1, name: 'Mon parrainage' })` -- pattern `app/accompagne/parrainage/page.tsx:78` strict.
     - Eyebrow visible : `getByText('Mon espace')` (pattern ligne 77, `text-xs uppercase tracking-[0.18em] text-kraft`).
     - Code visible exact : `getByText('E2ETEST8')` doit etre visible (rendu dans `<div class="select-all">` -- cf. `components/accompagne/parrainage-view.tsx:108-117`). **Note** : le code est rendu dans `letterSpacing: '0.4rem'` -- l assertion `.toHaveText('E2ETEST8')` peut etre fragile si Playwright normalise differemment ; utiliser `await expect(page.locator('text=E2ETEST8')).toBeVisible()` qui matche le contenu textuel.
     - Bouton "Copier le code" visible : `getByRole('button', { name: 'Copier le code' })` -- pattern ligne 124.
     - Bouton "Copier le lien d'invitation" visible : `getByRole('button', { name: /Copier le lien d['’]invitation/ })` -- pattern ligne 131 (l apostrophe rendue est `’` U+2019 RIGHT SINGLE QUOTATION MARK, pas le `'` ASCII -- utiliser regex `/Copier le lien d['’]invitation/` ou `getByText(/Copier le lien.*invitation/i)` pour robustesse).
     - Compteur initial : `getByText(/0\s*sur\s*5\s*filleuls\s*valid/i)` (rendu ligne 167 `{compteurClamped} sur {PALIER} filleuls validés`).
     - Empty state filleuls visible : `getByText(/Aucun filleul pour le moment/i)` -- pattern ligne 180 (initialement `compteur_confirmes=0` -> aucun parrainage en BDD pour user3 -> liste vide).
   - **Pas d assertion sur a11y axe-core dans ce test** : le baseline P7 est deja garanti par 8.B.1 + workflow GHA `a11y-axe`. SC1 valide le rendu UI fonctionnel, pas la conformite WCAG (separation des responsabilites entre suites E2E vs a11y -- cf. `tests/e2e/README.md` tableau "Quand utiliser E2E vs Vitest integration vs a11y axe-core").

3. **AC3 -- SC2 `[golden-path] filleul accompagnant valide le code sur /register et voit le state valide`** :
   - **Pre-requis** : le seed user3 (accompagne) a un code `E2ETEST8` actif (heritage setup SC1, ou recreer si tests independants). **Decision : tests independants** -- chaque `it(...)` recree son setup minimal (idempotent via `ON CONFLICT` ou `UPDATE`), permettant l execution selective.
   - **Action UI sans login** (le signup est un parcours public) : `page.goto('/register?role=accompagnant&parrainage_code=E2ETEST8')` -- URL deeplink qui pre-remplit le code via `searchParams.get('parrainage_code')` (`components/auth/register-form.tsx:59`).
   - **Verification UI** : la page `/register` affiche le wizard signup. Le code parrainage est pre-rempli dans l input (visible une fois le wizard avance jusqu a l etape `parrainage`, OU directement detecte au mount `useEffect` ligne 95-100 qui appelle `checkParrainageCode(initialParrainageCode)` lorsque `role === 'accompagnant'`).
   - **Strategie** : **NE PAS** completer le wizard signup en E2E. Le formulaire envoie un mail de confirmation Supabase (`emailSent=true` ligne 194-196) -> pas de capture inbox en CI -> impossible de finaliser sans bypass auth (refuse par decision Lot B). 
   - **Test alternatif : appeler directement `validateCode('E2ETEST8')` via la server action** -- mais idem 7.C.2 (proxy RSC interne fragile). **Decision** : asserter sur l etat UI **post pre-remplissage URL** :
     1. `page.goto('/register?role=accompagnant&parrainage_code=E2ETEST8')`.
     2. Step `role` est skippe car `initialRole === 'accompagnant'` -> `step = 'name'` (ligne 68-70).
     3. Avancer jusqu a la step `parrainage` en remplissant les steps `name` puis `localisation` :
        - `name` : `fill('input[name="firstName"]', 'E2E')` + `fill('input[name="lastName"]', 'Filleul')` + click bouton "Continuer" (texte exact a verifier dans le composant -- `submitName` ligne 112).
        - `localisation` : `fill('input[name="ville"]', 'Rennes')` + `fill('input[name="codePostal"]', '35000')` + click "Continuer".
     4. A l arrivee sur step `parrainage`, le code doit etre **pre-rempli** dans l input visible (`value={parrainageCode}` ligne 359) ET l etat `parrainageState.status === 'valid'` doit etre atteint apres le `validateCode` async (compteur de promesse).
     5. **Assertion UI** : un message de validation est visible sous le champ -- a verifier dans le composant `register-form.tsx` les ligne 380-430 (TODO si message exact different) : `getByText(/code valide|parrain.* trouv|Bienvenue/i)` ou un indicateur visuel (icone check / classe `text-green-*`). 
     6. **Si la copy du composant ne contient pas de message visible explicite, asserter sur le bouton "Continuer" enable** : `expect(page.getByRole('button', { name: /Continuer/i }).last()).toBeEnabled()` -- la condition d activation tient compte de `parrainageState.status` (ligne 396 : `parrainageCode.trim().length > 0 && parrainageState.status === 'valid'`).
   - **Robustesse** : si le formulaire `register-form.tsx` evolue (renommage input, refactor wizard), ce SC peut casser. **Documenter dans un commentaire** que cette story 8.D.1 photographie l etat 2026-05-17 du composant ; toute refacto majeure de `register-form.tsx` doit mettre a jour ce test (pattern lien `[Source: components/auth/register-form.tsx:124-156]` strict).
   - **Pas de submit final** : le wizard s arrete a l etape `parrainage` sans creer de user reel (evite pollution BDD + Resend + Supabase Auth). Reset cleanup non requis (pas d insert).

4. **AC4 -- SC3 `[golden-path] filleul accompagnant onboarding bypass visio (deja parraine via UI shortcut)`** :
   - **Pre-requis** : reutiliser le pattern 7.C.2 AC4 -- positionner `users.parrainee_par` sur user5 (filleule seed) avec `MARRAINE_ID = user4` (accompagnant, pas accompagne -- le seed n a pas d accompagne pre-parraine, et le test est role-independant cote bypass visio : `OnboardingClient.isFilleule` ne lit que `parrainee_par !== null`, pas le role du parrain).
   - **Justification reuse** : le test bypass visio livre par 7.C.2 valide deja le mecanisme pour un parrainage marraine accompagnante -> filleule. **8.D.1 ajoute un test miroir pour parrain accompagne -> filleul accompagnant** afin de prouver que le bypass visio fonctionne aussi quand le parrain est accompagne (FR51 + AR-E8.5).
   - **Setup BDD** : `UPDATE public.users SET parrainee_par = '00000000-0000-0000-0000-000000000003' WHERE id = '00000000-0000-0000-0000-000000000005'` (user5 = filleule, user3 = accompagne avec abonnement actif setup SC1). **Important : ce setup ECRASE l etat de user5 pose par 7.C.2** (qui pointe sur user4 = accompagnant). Les 2 tests ne tournent pas en parallel (Playwright `workers: 1`) mais peuvent s executer dans n importe quel ordre. **Decision** : 8.D.1 utilise un setup additif **et reset en `afterAll`** pour revenir a `parrainee_par = NULL` (etat seed) afin de ne pas casser 7.C.2 si re-execute :
     ```ts
     test.afterAll(async () => {
       await resetEphemeralRows()
       await withPg(async (client) => {
         await client.query(`UPDATE public.users SET parrainee_par = NULL WHERE id = $1`, [FILLEULE_ID])
         await client.query(`DELETE FROM public.parrainages_codes WHERE user_id = $1 AND code = $2`, [ACCOMPAGNE_ID, 'E2ETEST8'])
       })
     })
     ```
     **Note critique** : 7.C.2 AC4 documente explicitement « ne PAS reset `parrainee_par` en afterAll ». 8.D.1 deroge a cette regle parce qu il modifie le **parrain** (user3 accompagne) vs 7.C.2 qui modifie user4 (accompagnant). Si on laisse `parrainee_par = user3` apres 8.D.1, alors 7.C.2 (qui pose `parrainee_par = user4` en setup) sera fonctionnel mais la BDD finale ne refletera plus l etat seed. **Justification additionnelle** : 8.D.1 etant la derniere story Epic 8, le retour a l etat seed est plus sain pour les retros + audits future.
   - **Action UI** : `loginAs(page, 'filleule')` puis navigation `/accompagnant/onboarding` via `OnboardingPage.goto()`.
   - **Assertions UI** (heritage 7.C.2 strict, miroir) :
     - `OnboardingPage.expectBypassMessage()` -> texte visible `/pas de pieces justificatives ni de visio/i` (composant `components/accompagnant/onboarding-client.tsx:187`).
     - Helper "Optionnel grâce à votre parrainage" visible : `getByText(/Optionnel grace a votre parrainage/i)` ou `getByText(/Optionnel.+parrainage/i)` (pattern `components/accompagnant/step-diplome.tsx:140-143`).
   - **Assertion BDD** : `SELECT parrainee_par FROM public.users WHERE id = FILLEULE_ID` retourne ACCOMPAGNE_ID (verifier que le setup a bien pris).

5. **AC5 -- SC4 `[golden-path] confirmParrainageOnSuccess role-aware proxy via etat BDD post-paiement`** :
   - **Justification proxy BDD** : `confirmParrainageOnSuccess` est appelee par `app/accompagnant/abonnement/success/page.tsx:31` apres un retour de Stripe Checkout avec `session_id`. Pour tester ce flux en E2E reel il faudrait : (a) creer une session Stripe via `createCheckoutSession` (appel a `stripe.checkout.sessions.create`), (b) automatiser le UI Stripe Checkout, (c) attendre le webhook + redirect success. **Decision** : c est hors-portee Playwright (Stripe ne supporte pas d injection scripts sur leur UI, et meme avec Stripe CLI `webhook forward` le timing en GHA est fragile). **Strategie alternative** : reproduire l etat BDD final attendu apres `confirmParrainageOnSuccess` reussi pour un parrain accompagne + filleul accompagnant -- valider que la **shape BDD** est conforme aux invariants Epic 8 (FR51 bypass visio, FR54 sens autorise, AR-E8.5 generation code filleul).
   - **Setup BDD** : pre-requis SC1 (`subscriptions.status='active'` pour user3 accompagne + `parrainages_codes` user3 code `E2ETEST8`). Ajouter via pg :
     - `INSERT public.parrainages (code='E2ETEST8', marraine_id=user3, filleule_id=user5, statut='inscrite', filleule_inscrite_at=now())` avec `code` modifie en `e2e-test-symetric-1` pour eligibilite `resetEphemeralRows` -- **OU mieux** : utiliser le code `e2e-test-syme1` (8 caracteres, alphabet conforme : `E`, `2`, `E`, `-` non !) -- le tiret n est pas dans `CODE_ALPHABET` (cf. `parrainage.ts:24`) -> rejete par `normalizeCode` (qui strip espaces/tirets) MAIS la BDD `parrainages.code` est `TEXT` sans CHECK alphabet (la validation alphabet est applicative dans `validateCode`). **Decision** : seed la row `parrainages` avec `code='e2e-test-syme1'` qui satisfait le pattern cleanup `LIKE 'e2e-test-%'` -- la row n a pas besoin d etre valide en regard de `validateCode` car SC4 ne ré-appelle pas `validateCode`, il asserte sur l etat post-confirm.
     - `INSERT public.subscriptions (user_id=user5, status='active', ...)` pour le filleul (user5 accompagnant) -- on simule qu il vient de payer.
     - `UPDATE public.parrainages SET statut='abonnee', filleule_abonnee_at=now() WHERE code='e2e-test-syme1'` -- bascule simulee post-`confirmParrainageOnSuccess` (ligne 1010 `lockedRows.update.statut='abonnee'`).
     - `UPDATE public.accompagnants_profiles SET validation_status='valide', validation_source='parrainage', validation_date=now() WHERE user_id=user5` -- bascule simulee (ligne 1020-1024).
     - `INSERT public.parrainages_codes (user_id=user5, code='e2e-test-syme2', compteur_confirmes=0, total_recompenses=0)` -- simule la generation du code filleul (ligne 1064 `generateCodeForUserSystem(user.id)` apres bascule reussie). **Important** : `parrainages_codes.code` est UNIQUE -- choisir un code non-conflictuel et eligible cleanup (`e2e-test-syme2` -- 14 chars, mais BDD column est TEXT sans CHECK longueur).
   - **Assertions BDD** (proxy pour valider la shape attendue Epic 8) :
     - `parrainages.statut === 'abonnee'` pour la row `e2e-test-syme1` (transition inscrite -> abonnee declenchee).
     - `accompagnants_profiles.validation_status === 'valide'` pour user5 (bypass visio applique).
     - `accompagnants_profiles.validation_source === 'parrainage'` pour user5 (decision Epic 8 FR51 -- distincte de `'admin'` ou `'ocr_visio'`).
     - `parrainages_codes` existe pour user5 avec `compteur_confirmes=0` (le filleul devient parrain accompagnant a son tour -- AR-E8.5).
   - **Assertion UI optionnelle** : `loginAs(page, 'filleule')` puis navigation `/accompagnant/parrainage` -> verifier que le code du filleul (`e2e-test-syme2`) est visible. **Decision** : OUT scope SC4 (alourdit le test sans gain -- l UI accompagnant parrainage est verrouillee par Epic 2 + tests existants). SC4 se limite aux assertions BDD.
   - **Justification globale** : SC4 ne teste PAS `confirmParrainageOnSuccess` (deja couvert par 8.A.4 SC1 integration via `mockSupabaseSession`). SC4 teste la **forme finale** de la BDD apres un parcours symetrique reussi -- garantit que tout consommateur aval (admin/cron/UI) verra les bons invariants. Si un futur dev casse la signature de `confirmParrainageOnSuccess` (par exemple oublie de poser `validation_source='parrainage'`), SC4 echoue **mais** SC4 est un proxy non-strict : il ne previent pas la regression au moment de l ecriture, juste verifie que la shape attendue tient.

6. **AC6 -- Isolation stricte entre tests** :
   - `test.beforeAll(resetEphemeralRows)` + `test.afterAll(resetEphemeralRows)` au top du fichier.
   - SC1/SC2/SC3/SC4 dans 4 `it(...)` separes (pas de `test.describe.serial` -- l ordre n est pas strict).
   - **Toutes les rows `parrainages` creees** utilisent `code LIKE 'e2e-test-%'` pour eligibilite cleanup.
   - **Toutes les rows `parrainages_codes` test** doivent etre suprimees dans `afterAll` (le helper `resetEphemeralRows` ne touche pas cette table). Pattern : `DELETE FROM public.parrainages_codes WHERE user_id IN (...) AND code IN ('E2ETEST8', 'e2e-test-syme2')`.
   - **Reset `users.parrainee_par`** sur user5 en `afterAll` pour ne pas polluer 7.C.2 + retros.
   - **Reset `accompagnants_profiles.validation_status`** sur user5 en `afterAll` pour preserver l etat seed (le seed `01_users.sql:42-54` le force a `'valide'`, donc no-op apres reset, mais documenter dans commentaire).
   - **Reset `subscriptions.status`** sur user3 (`ccc2`) en `afterAll` : remettre `current_period_end = now() - 1 day` pour restaurer l etat seed "active expiree". Sans ca, le seed reset suivant lirait un etat divergent.

7. **AC7 -- Workflow GHA `e2e-tests.yml` execute ce spec** :
   - Le fichier `e2e-tests.yml` cree par 7.C.1 + complete par 7.C.2 est inchange (il execute `npm run test:e2e` qui cible `testDir: './tests/e2e'` via `playwright-e2e.config.ts`). Le nouveau fichier spec est automatiquement inclus sans configuration supplementaire.
   - Le run GHA doit passer avec les 4 nouveaux tests verts + le smoke test 7.C.1 + les 3 tests 7.C.2 (8 tests totaux).
   - **2 runs GHA consecutifs verts avant merge** (heritage AC8 de 7.C.1 + AC6 de 7.C.2, meme pattern). Run-ids documentes dans Completion Notes.
   - Variables env requises : aucune nouvelle vs 7.C.2. La spec utilise uniquement les vars `SUPABASE_URL`, `SUPABASE_DB_URL` (optionnel, fallback `postgresql://postgres:postgres@localhost:54322/postgres`) deja set par `e2e-tests.yml`.

8. **AC8 -- Validation pre-commit** (CLAUDE.md regle durcie + heritage Epic 7/8) :
   - `npm run lint` exit 0 (config + spec lint-clean, baseline warnings preserved).
   - `npm run lint:a11y-check` exit 0 (baseline 155, aucun changement UI applicatif).
   - `npm run a11y:axe:check` exit 0 (regle CLAUDE.md durcie : obligatoire pour TOUT commit livraison story, meme sans impact UI).
   - `npm run test:unit` exit 0 (suite unit globale verte, 0 nouveau test unit).
   - `npm run check:no-direct-notifications-log-insert` exit 0 (la story ne touche pas `notifications_log`, 0 match attendu).
   - `npm run build` exit 0 (vercel-build full chain green, aucune route ajoutee donc inchange).
   - `npx tsc --noEmit` : 0 erreur sur les fichiers modifies (les 2 erreurs pre-existantes `.next/types/` sont tolerees, heritage 8.A.4 AC14).
   - **Verification specifique E2E** : `npm run test:e2e --silent` (en local, si Supabase up + dev server) doit afficher "5 passed" (smoke + 4 nouveaux SC). Sinon noter dans Completion Notes la decision de deferer 100% a GHA (heritage `feedback_test_local_supabase`).

9. **AC9 -- Solde dette + transitions + memoire** :
   - `_bmad-output/implementation-artifacts/sprint-status.yaml` : transition `8-d-1-e2e-playwright-parcours-accompagne-accompagnant-golden-path` de `ready-for-dev` -> `review` (livre par dev) -> `done` (post-merge selon `[[project_bmad_conventions]]`). Mettre `last_updated` au jour de livraison avec commentaire format `# last_updated: YYYY-MM-DD (Story 8.D.1 DONE via bmad-code-review : ...)`.
   - **Memoire utilisateur** : **mettre a jour la memoire existante `project_epic_8_cadrage`** apres livraison 8.D.1 pour acter mini-epic 8.D = 1/1 stories `done` (8.D.1 livre, epic 8 cloture). Texte type a ajouter : "Mini-epic 8.D (E2E Playwright golden path symetrique) livre 2026-05-XX (story 8.D.1) : `tests/e2e/parrainage-symetrique.spec.ts` + 4 SC (code visible cote accompagne + validateCode pre-rempli + bypass visio role-independant + shape BDD post-confirm). **Epic 8 cloture (11/11 stories done).** Retro post-livraison."
   - **Pas de transition sur autre story Epic 8** : 8.D.1 cloture le mini-epic 8.D mais ne touche pas aux scenarios 7.C.3 / 7.C.4 (backlog separe Epic 7 RGPD + matching).
   - `_bmad-output/implementation-artifacts/deferred-work.md` : verifier si une entree "E2E parrainage symetrique" existe (heritage cadrage Epic 8 ou AI-Epic8-D). Si oui, la barrer `~~...~~` avec marker `[Solde 8.D.1 - YYYY-MM-DD]`.

10. **AC10 -- Hors-scope explicitement liste dans Completion Notes** :
    - **Aucun parcours Stripe Checkout reel** : pas de `createCheckoutSession` -> Stripe UI -> webhook. Justifie par fragilite UI Stripe + timing GHA + couverture deja assuree par 8.A.4 SC1 (integration end-to-end avec mocks Stripe).
    - **Aucune assertion sur l email "bienvenue parrain"** (envoye par `sendParrainageBienvenueAccompagne` apres genese code -- 8.A.1) : pas de capture inbox en E2E. Mock Resend hors-scope 8.D.1 (reste decision 7.C.4 si un test futur en a besoin).
    - **Aucun test de l email "filleule confirmation"** : envoye par `sendParrainageFilleuleConfirmation` apres `confirmParrainageOnSuccess`. Idem mock Resend hors-scope.
    - **Aucun test des sens interdits** (`accompagne -> accompagne`, `accompagnant -> accompagne`) : deja couverts par 8.A.4 SC3/SC4 (integration). Reproduire en E2E n apporterait rien (le guard `invalid_filleul_role` est applique cote serveur, pas UI).
    - **Aucun test du cron `confirm-parrainages` ou de la recompense Stripe** : deja couverts par 8.A.4 SC6 (integration). E2E ne peut pas declencher un cron Vercel.
    - **Aucun test de la page admin `/admin/parrainages` filtre role** : couvert separement par tests manuels admin (deferes ou story 8.C.1 deja livree -- `done`). Reproduire en E2E sortirait du perimetre golden path (8.D.1 = mini-epic 8.D).
    - **Aucun test de la page accompagnant `/accompagnant/parrainage`** : path Epic 2 deja en production depuis 2026-04 (Story 2.4 done), pas de regression cadree par Epic 8.
    - **Aucune modification de `playwright-e2e.config.ts`, `playwright.config.ts`, `vercel.json`, `package.json`, `.github/workflows/e2e-tests.yml`** : l infra existante suffit. La spec se branche sans config additionnelle.
    - **Aucune nouvelle migration BDD** : tout le setup passe par pg client INSERT/UPDATE sur tables existantes (heritage F-Epic8-A0 GO sans migration).

## Tasks / Subtasks

- [x] **T1 -- Audit pre-implementation de l etat seed user3 (accompagne) + verification copy register-form** (AC: #2, #3)
  - [x] T1.1 -- Via SELECT pg : verifier que `users.role = 'accompagne'` sur user3 (`...000003`). Confirmer aussi que `subscriptions ccc2` existe pour user3 (`SELECT * FROM subscriptions WHERE id = '...ccc2'`). Output : confirmer status `'active'` + current_period_end seed (`now() - 1 day` initialement).
  - [x] T1.2 -- Via SELECT pg : verifier `parrainages_codes WHERE user_id = '...000003'` -- doit etre vide (le seed 02_parrainages.sql ne pose code que pour user4). Setup SC1 ajoutera la row.
  - [x] T1.3 -- Lire `components/auth/register-form.tsx` (lignes 124-156, 350-430) pour reperer le selecteur exact du message de validation parrainage (icone check, classe text-green-*, ou texte "Code valide"). Documenter le selecteur retenu en commentaire de SC2.
  - [x] T1.4 -- Lire `app/accompagne/parrainage/page.tsx` + `components/accompagne/parrainage-view.tsx` pour confirmer les selecteurs/texte H1, eyebrow, boutons, empty state. Documenter en commentaire de SC1.

- [x] **T2 -- Creer `tests/e2e/parrainage-symetrique.spec.ts`** (AC: #1, #2, #3, #4, #5, #6)
  - [ ] T2.1 -- En-tete : importer `test, expect` de `@playwright/test`, `loginAs` de `./_lib/session`, `resetEphemeralRows, assertLocalPgUrl` de `./_lib/fixtures`, `OnboardingPage` de `./_lib/pages`, `pg` (Client). Constantes : `PG_URL`, `ACCOMPAGNE_ID = '...000003'`, `MARRAINE_ACCOMPAGNANT_ID = '...000004'`, `FILLEULE_ID = '...000005'`, `CODE_E2E = 'E2ETEST8'`, `PARRAINAGE_CODE_TEST = 'e2e-test-syme1'`, `FILLEUL_CODE_GEN = 'e2e-test-syme2'`.
  - [ ] T2.2 -- Helper local `withPg<T>(fn)` strict miroir de 7.C.2 (assertLocalPgUrl + Client.connect + try/finally end).
  - [ ] T2.3 -- `test.beforeAll(async () => { await resetEphemeralRows() })` pour nettoyer residus crash precedent.
  - [ ] T2.4 -- `test.afterAll(async () => { await resetEphemeralRows(); await withPg(...) })` avec : reset `parrainages_codes` ('E2ETEST8' + 'e2e-test-syme2'), reset `users.parrainee_par` sur user5 (NULL), reset `subscriptions.ccc2` (current_period_end = seed expiree), pas de reset `accompagnants_profiles` (no-op vs seed).

- [x] **T3 -- SC1 `[golden-path] parrain accompagne affiche code sur /accompagne/parrainage`** (AC: #2)
  - [ ] T3.1 -- Setup BDD : `UPDATE subscriptions ccc2 SET status='active', current_period_end=now()+30d, current_period_start=now()-7d` + `INSERT parrainages_codes (user_id=user3, code='E2ETEST8', ...) ON CONFLICT (user_id) DO UPDATE SET code='E2ETEST8'`.
  - [ ] T3.2 -- `loginAs(page, 'accompagne')`.
  - [ ] T3.3 -- `page.goto('/accompagne/parrainage')` puis `await expect(page).toHaveURL(/\/accompagne\/parrainage$/)`.
  - [ ] T3.4 -- Assertions UI : H1 "Mon parrainage", eyebrow "Mon espace", code visible "E2ETEST8", bouton "Copier le code", bouton "Copier le lien d'invitation" (regex apostrophe unicode), compteur "0 sur 5", empty state filleuls.
  - [ ] T3.5 -- Tagger le test avec `@parrainage-symetrique`.

- [x] **T4 -- SC2 `[golden-path] filleul accompagnant valide code sur /register`** (AC: #3)
  - [ ] T4.1 -- Pre-requis : recreer setup SC1 (idempotent via ON CONFLICT) au cas ou SC1 est skip.
  - [ ] T4.2 -- `page.goto('/register?role=accompagnant&parrainage_code=E2ETEST8')`.
  - [ ] T4.3 -- Avancer wizard : step `name` (firstName='E2E', lastName='Filleul') -> step `localisation` (ville='Rennes', codePostal='35000') -> step `parrainage`.
  - [ ] T4.4 -- Assertion : input `name="parrainage_code"` rempli avec `E2ETEST8` (via `input[value="E2ETEST8"]` ou `getByDisplayValue('E2ETEST8')`).
  - [ ] T4.5 -- Assertion : bouton "Continuer" de la step parrainage est enabled (signal indirect que `validateCode` a retourne valid via `useEffect` mount). Alternative si selecteur "Continuer" introuvable : reposer sur `getByText(/Bienvenue.*Seed/i)` ou `getByText(/code valide/i)` -- a determiner au dev selon copy reelle (T1.3).
  - [ ] T4.6 -- Pas de submit final (evite mail Resend + signup BDD).
  - [ ] T4.7 -- Tagger `@parrainage-symetrique`.

- [x] **T5 -- SC3 `[golden-path] filleul bypass visio role-independant onboarding`** (AC: #4)
  - [ ] T5.1 -- Pre-requis : reutiliser setup SC1 (`subscriptions.ccc2` active + `parrainages_codes` user3 E2ETEST8).
  - [ ] T5.2 -- Setup BDD : `UPDATE users SET parrainee_par = '...000003' WHERE id = '...000005'`.
  - [ ] T5.3 -- `loginAs(page, 'filleule')` puis `OnboardingPage.goto()` + `OnboardingPage.expectBypassMessage()`.
  - [ ] T5.4 -- Assertion : helper "Optionnel.+parrainage" visible (pattern `step-diplome.tsx:140-143`).
  - [ ] T5.5 -- Assertion BDD : `SELECT parrainee_par FROM users WHERE id = filleule_id` retourne user3 ID (proof setup pris).
  - [ ] T5.6 -- Tagger `@parrainage-symetrique`.

- [x] **T6 -- SC4 `[golden-path] confirmParrainageOnSuccess proxy BDD post-paiement`** (AC: #5)
  - [ ] T6.1 -- Pre-requis : setup SC1.
  - [ ] T6.2 -- Setup BDD : INSERT row `parrainages (code='e2e-test-syme1', marraine_id=user3, filleule_id=user5, statut='abonnee', filleule_inscrite_at=now()-1h, filleule_abonnee_at=now())`. INSERT row `subscriptions (user_id=user5, status='active', ...)`. UPDATE `accompagnants_profiles SET validation_status='valide', validation_source='parrainage', validation_date=now() WHERE user_id=user5`. INSERT `parrainages_codes (user_id=user5, code='e2e-test-syme2', compteur_confirmes=0, total_recompenses=0)` ON CONFLICT (user_id) DO UPDATE SET code='e2e-test-syme2'.
  - [ ] T6.3 -- Assertions BDD : SELECT * FROM `parrainages` WHERE code='e2e-test-syme1' -> statut='abonnee', marraine_id=user3, filleule_id=user5.
  - [ ] T6.4 -- Assertion BDD : SELECT `validation_status, validation_source` FROM `accompagnants_profiles` WHERE user_id=user5 -> `valide` + `parrainage`.
  - [ ] T6.5 -- Assertion BDD : SELECT * FROM `parrainages_codes` WHERE user_id=user5 -> compteur_confirmes=0 + code='e2e-test-syme2'.
  - [ ] T6.6 -- Cleanup specifique : la row `parrainages` (code prefix `e2e-test-`) sera cleanee par `resetEphemeralRows`. La row `parrainages_codes` user5 sera cleanee par `afterAll` T2.4.
  - [ ] T6.7 -- Reset user5 `accompagnants_profiles.validation_status` : no-op vs seed (deja 'valide'). Documenter en commentaire.
  - [ ] T6.8 -- Cleanup row `subscriptions` user5 inserted : DELETE FROM subscriptions WHERE user_id=user5 AND stripe_subscription_id LIKE 'sub_e2e_syme%' (utiliser prefix pour eligibilite cleanup -- ou bypass via row temporaire avec UUID predictible).
  - [ ] T6.9 -- Tagger `@parrainage-symetrique`.

- [x] **T7 -- Validations pre-commit + push** (AC: #7, #8)
  - [ ] T7.1 -- `npm run lint` exit 0.
  - [ ] T7.2 -- `npm run lint:a11y-check` exit 0 (baseline 155, no regression).
  - [ ] T7.3 -- `npm run a11y:axe:check` exit 0.
  - [ ] T7.4 -- `npm run test:unit` exit 0 (82/82 verts).
  - [ ] T7.5 -- `npm run check:no-direct-notifications-log-insert` exit 0.
  - [ ] T7.6 -- `npx tsc --noEmit` : 0 erreur sur les fichiers modifies.
  - [ ] T7.7 -- `npm run build` exit 0.
  - [ ] T7.8 -- Push direct main (Option B, heritage 7.C.1/7.C.2/7.B.3) + `gh workflow run e2e-tests.yml` x2 pour AC7. Run-ids documentes en Completion Notes ci-dessous.

- [ ] **T8 -- Transitions sprint-status + memoire + retrospective Epic 8** (AC: #9)
  - [ ] T8.1 -- `sprint-status.yaml` : `8-d-1-e2e-playwright-parcours-accompagne-accompagnant-golden-path` -> `review` post-livraison, `done` post-merge. `last_updated` au format documente.
  - [ ] T8.2 -- Memoire `project_epic_8_cadrage` : ajouter ligne "8.D livre + Epic 8 cloture (11/11 done)".
  - [ ] T8.3 -- `deferred-work.md` : barrer entree "E2E parrainage symetrique" si presente avec marker `[Solde 8.D.1 - YYYY-MM-DD]`.
  - [ ] T8.4 -- Proposer a Sylvain de lancer une retrospective Epic 8 (skill `bmad-retrospective`) -- hors scope direct 8.D.1 mais signal post-merge.

## Dev Notes

### Contexte metier

Cette story **cloture le mini-epic 8.D** (et l Epic 8) en couvrant le golden path UX du parrainage symetrique `accompagne -> accompagnant`. Le parrainage symetrique a ete cadre 2026-05-16 dans `epic-8.md` apres echange avec Sylvain (decisions actees DECISIONS.md F-Epic8-A0/A3). L Epic 8 a livre 11 stories (au 2026-05-17) en 4 mini-epics : 8.A backend metier (5 stories, parrainages_codes + validateCode + cron role-aware + tests integration), 8.B UI accompagne (2 stories : page parrainage + teaser dashboard), 8.C admin + wording + RGPD (3 stories, parallelisables), 8.D tests E2E (1 story = celle-ci).

Le **golden path** vise : un accompagne avec abonnement actif voit son code parrainage 8-caracteres sur `/accompagne/parrainage` -> partage le code (lien `/register?role=accompagnant&parrainage_code=...`) -> filleul accompagnant valide le code dans le wizard signup -> apres paiement Stripe, bypass visio applique + validation_status='valide' + filleul devient parrain a son tour. Toutes les briques back/UI sont livrees, ce test E2E **verrouille** le scenario nominal contre toute regression UX future.

### Pourquoi tests E2E plutot que tests integration etendus

Trois arguments :

1. **Couverture UX bout-en-bout** : 8.A.4 (integration) verrouille les invariants API/BDD au niveau Node (`validateCode`, `createParrainageRelation`, `confirmParrainageOnSuccess`, cron). 8.D.1 verrouille que **la chaine UI** (login -> page accompagne parrainage -> register pre-rempli code) reste fonctionnelle apres toute refacto frontend (page server component, composant client `ParrainageView`, wizard `RegisterForm`).

2. **Regression role-aware au niveau bypass visio** : 7.C.2 a livre 1 test bypass visio (parrain accompagnant -> filleul). 8.D.1 ajoute le **miroir** (parrain accompagne -> filleul) qui prouve que `OnboardingClient.isFilleule` est role-independant (lit `parrainee_par` seul, pas le role du parrain). C est un guard regression supplementaire pour FR51.

3. **Photographie de la UI Epic 8 a un instant T** : si demain quelqu un refactore `app/accompagne/parrainage/page.tsx` ou `components/accompagne/parrainage-view.tsx` (extract en `components/shared/`, rename props, etc.), 8.D.1 echouera et signalera que la page n affiche plus le code ou plus les bons boutons. C est un filet de securite UX en complement des integration tests qui n exercent jamais le rendu Server Component + hydration React.

### Patterns herites et a reutiliser

| Pattern | Source | Application 8.D.1 |
|---|---|---|
| `loginAs(page, role)` + 5 seed users statiques | `tests/e2e/_lib/session.ts` (story 7.C.1) | SC1 `loginAs(page, 'accompagne')`, SC3 `loginAs(page, 'filleule')` |
| `resetEphemeralRows()` + convention prefix `e2e-test-` | `tests/e2e/_lib/fixtures.ts` (story 7.C.1) | beforeAll + afterAll obligatoires, codes `e2e-test-syme*` pour rows parrainages |
| Helper `withPg(fn)` + `assertLocalPgUrl(PG_URL)` | `tests/e2e/parrainage-anti-fraude.spec.ts:50-60` (story 7.C.2) | Tous les setups/asserts BDD passent par ce helper |
| Setup BDD shortcut + assertion BDD post-action (strategie "etat reproductif" vs "appel server action") | `tests/e2e/parrainage-anti-fraude.spec.ts:8-31` (story 7.C.2) | SC4 entierement (proxy `confirmParrainageOnSuccess`), partiellement SC1/SC3 (setup) |
| `OnboardingPage.expectBypassMessage()` | `tests/e2e/_lib/pages.ts:52-63` (story 7.C.2) | SC3 reuse direct |
| `UPDATE users SET parrainee_par = ...` en setup test | `tests/e2e/parrainage-anti-fraude.spec.ts:225-230` (story 7.C.2 AC4) | SC3 setup (parrain=accompagne au lieu d accompagnant) |
| Tag `@parrainage-*` pour execution selective | `tests/e2e/parrainage-anti-fraude.spec.ts:82,143,218` (story 7.C.2) | Tous SC tags `@parrainage-symetrique` |
| Pattern Option B push + 2 runs GHA consecutifs | Stories 7.C.1 AC8, 7.C.2 AC6, 7.B.2/7.B.3 | T7.8 |
| Page server component lookup `parrainages_codes` + redirect si null | `app/accompagne/parrainage/page.tsx:23-31` (story 8.B.1) | SC1 setup doit creer la row pour eviter redirect |

### Decalages spec-vs-realite a respecter (audit 8.A.0)

L audit 8.A.0 a rectifie 3 decalages que 8.D.1 doit respecter pour les seeds BDD :

- **Enum `subscription_status`** : utiliser `'cancelled'` (**double L**) jamais `'canceled'` ni `'unpaid'`. L enum BDD accepte uniquement `active`, `cancelled`, `past_due`, `trialing`. SC1/SC4 utilisent uniquement `'active'`, donc pas de risque.
- **Enum `user_role`** : 3 valeurs (`accompagnant`, `accompagne`, `admin`), pas de `visiteur`. Pas de seed `visiteur` dans 8.D.1.
- **`parrainages.marraine_id`** : `ON DELETE SET NULL`, NULLable. Aucune assertion 8.D.1 n assume `marraine_id IS NOT NULL`.
- **`parrainages_codes.code`** : UNIQUE + `user_id` PK. Cleanup specifique `DELETE WHERE user_id IN (...)` ou via tracker prefix `e2e-test-` sur le champ `code`.

### Strategie tres pragmatique : pas de Stripe Checkout reel

Le `createCheckoutSession` (`app/actions/subscription.ts:97`) appelle `stripe.checkout.sessions.create` qui retourne une URL Stripe-hosted (`session.url`). En E2E reel cela impliquerait :
- Cliquer dans le UI Stripe (formulaire CB, redirect 3DS, etc.) -- impossible cross-browser stable.
- OU utiliser Stripe CLI `webhook forward` + `stripe trigger checkout.session.completed` -- timing GHA fragile + nouvelle dependance Docker.
- OU passer par les test_clocks Stripe + API -- complexe pour 8.D.1 et hors-scope.

**Decision** : 8.D.1 ne teste PAS le parcours Stripe. La couverture Stripe est assuree par :
- 8.A.4 SC1 integration (`createStripeEvent` + `postWebhookEvent` + assertions BDD complete).
- 4.4 integration (`checkout-completed-valid.test.ts`, `checkout-completed-parrainage-bloque.test.ts`).

8.D.1 se limite a tester la **shape BDD post-confirm** (SC4) en reproduisant l etat attendu, ce qui photographie le contrat aval (FR51/AR-E8.5) sans tester le flux complet.

### Selecteurs UI critiques (a verifier T1.3 + T1.4)

**Page `/accompagne/parrainage`** (`app/accompagne/parrainage/page.tsx` + `components/accompagne/parrainage-view.tsx`) :
- H1 `'Mon parrainage'` (italic, text-3xl md:text-4xl).
- Eyebrow `'Mon espace'` (text-xs uppercase tracking-[0.18em] text-kraft).
- Code : `<div class="select-all">` avec letterSpacing 0.4rem, contient le `code` string.
- Bouton "Copier le code" -> apres click, label devient "Copié" pendant 2s.
- Bouton "Copier le lien d'invitation" -> apostrophe est `'` (U+2019), regex `/d['’]invitation/`.
- Compteur progression : `{compteurClamped} sur {PALIER} filleuls validés` -- regex `/0\s*sur\s*5\s*filleuls\s*valid/i`.
- Empty state : "Aucun filleul pour le moment. Partagez votre code pour démarrer votre premier cycle." -- accent é peut etre tolere via regex `/Aucun filleul pour le moment/i`.

**Composant `RegisterForm`** (`components/auth/register-form.tsx`) :
- Steps : `'role' | 'name' | 'localisation' | 'parrainage' | 'email' | 'password'` (pour accompagnant).
- Input parrainage : `id="parrainage_code"` `name="parrainage_code"` `value={parrainageCode}` (ligne 354-359).
- Bouton "Continuer" present a chaque step (utiliser `.last()` pour cibler le bouton courant).
- Etat valid : `parrainageState.status === 'valid'` apres `checkParrainageCode` -> a la copy precise a verifier (ligne 380-430 environ) -- `getByText(/code valide|parrain.*trouv|Bienvenue/i)` ou check sur bouton "Continuer" enabled.

**Onboarding bypass visio** (`components/accompagnant/onboarding-client.tsx` + `step-diplome.tsx`) :
- Message visible : `"Pour finaliser votre inscription, complétez vos disponibilités et souscrivez votre abonnement — pas de pièces justificatives ni de visio à fournir."` (ligne 187).
- Helper diplome filleul : `"Optionnel grâce à votre parrainage"` (step-diplome.tsx:141-143) -- regex `/Optionnel.+parrainage/i` pour robustesse accent.

### Risques + mitigations

| Risque | Probabilite | Mitigation |
|---|---|---|
| Le wizard `RegisterForm` est refactore (steps renommees, copy modifiee) | Moyenne | Asserter via selectors stables (`name="parrainage_code"`, role+text bouton) + commentaires "photographie 2026-05-17". |
| `parrainages_codes.code` UNIQUE collide avec une row prod accidentellement seedee | Faible | Code `E2ETEST8` peu probable en prod. Cleanup en `afterAll` explicite. |
| `subscriptions.ccc2` modification persiste apres test (current_period_end != seed) | Haute | Reset explicite en `afterAll` T2.4 vers `now() - 1 day`. Sinon `npm run seed:test:reset` restaure. |
| Setup `users.parrainee_par` user5 ecrase 7.C.2 (qui pose user4 puis ne reset pas) | Haute | 8.D.1 reset en `afterAll` -- documente comme exception explicite vs convention 7.C.2 (8.D.1 est la derniere story Epic 8 et restaure l etat seed propre). |
| `parrainages_codes` apparait avec code different `'TESTSEED1'` (seed user4) + `'E2ETEST8'` (test user3) cote `/accompagnant/parrainage` user4 | Faible | Pas d impact : user3 et user4 sont des row distinctes, la page lit `user.id` filtre. |
| `confirmParrainageOnSuccess` mute apres SC4 -- shape attendue change | Moyenne | SC4 est proxy non-strict, ne previent pas regression au moment de l ecriture mais detecte derive UX. 8.A.4 reste source de verite test. |
| Tests E2E flaky sur GHA premiere execution | Haute | Pattern 7.C.1 AC8 : retries 2 en CI + 2 runs consecutifs verts requis (AC7). |

### Reset cleanup pieges -- attention dans afterAll T2.4

L `afterAll` doit etre defensif : si une assertion echoue mid-test, les inserts partiels doivent quand meme etre cleanees. Pattern strict :

```ts
test.afterAll(async () => {
  // 1. Cleanup ephemeral rows (codes e2e-test-* dans parrainages + admin_actions_log marker)
  await resetEphemeralRows()

  // 2. Cleanup specifique parrainages_codes (ne touche pas TESTSEED1 seed user4)
  await withPg(async (client) => {
    await client.query(
      `DELETE FROM public.parrainages_codes WHERE user_id IN ($1, $2) AND code IN ($3, $4)`,
      [ACCOMPAGNE_ID, FILLEULE_ID, CODE_E2E, FILLEUL_CODE_GEN],
    )
  })

  // 3. Reset users.parrainee_par sur filleule (eviter pollution 7.C.2 + retros)
  await withPg(async (client) => {
    await client.query(
      `UPDATE public.users SET parrainee_par = NULL WHERE id = $1`,
      [FILLEULE_ID],
    )
  })

  // 4. Reset subscriptions.ccc2 vers etat seed expire (current_period_end = now() - 1 day)
  await withPg(async (client) => {
    await client.query(
      `UPDATE public.subscriptions SET current_period_end = now() - interval '1 day', current_period_start = now() - interval '40 days' WHERE id = $1`,
      ['00000000-0000-0000-0000-00000000ccc2'],
    )
  })

  // 5. Cleanup subscriptions user5 inserted (filleul SC4)
  await withPg(async (client) => {
    await client.query(
      `DELETE FROM public.subscriptions WHERE user_id = $1 AND stripe_subscription_id LIKE 'sub_e2e_syme%'`,
      [FILLEULE_ID],
    )
  })
})
```

### Project Structure Notes

- **Fichier cree** : `tests/e2e/parrainage-symetrique.spec.ts` (~250-350 lignes avec 4 SC + helpers locaux + cleanup defensif).
- **Aucun fichier modifie** : `playwright-e2e.config.ts`, `.github/workflows/e2e-tests.yml`, `package.json`, `tests/e2e/_lib/*` (la story reuse strict, n etend pas).
- **Fichiers modifies metadata** :
  - `_bmad-output/implementation-artifacts/8-d-1-e2e-playwright-parcours-accompagne-accompagnant-golden-path.md` (story file final)
  - `_bmad-output/implementation-artifacts/sprint-status.yaml` (transition `ready-for-dev` -> `review` -> `done`)
  - `_bmad-output/implementation-artifacts/deferred-work.md` (si entree existante a barrer)
- **Pas de migration BDD** (heritage F-Epic8-A0 GO).
- **Pas de nouvelle dep npm** (Playwright + pg deja installes).
- **Pas d impact UI applicatif** -> DoD a11y N/A (modification uniquement de tests E2E).
- **Pas d impact PROD** (E2E tournent sur Supabase local + dev server, pas sur prod).

### Coupures securite / sentinelles

- **`assertLocalPgUrl(PG_URL)`** : refuse toute connexion non-locale (`localhost`, `127.0.0.1`, `[::1]`, `::1`). Pattern heritage 7.C.2 + `fixtures.ts:20-35`. Defensif si un dev exporte par megarde `SUPABASE_DB_URL=postgres://prod-host:5432/postgres`.
- **`tests/e2e/setup.ts`** : `globalSetup` deja en place 7.C.1 + verifie `SUPABASE_URL` hostname local + `process.exit(1)` en CI si non-local. Defense en profondeur.
- **Codes test prefixes `e2e-test-`** : eligibilite cleanup `resetEphemeralRows`. CODE_E2E `'E2ETEST8'` ne suit PAS le prefix (8 caracteres alphabet contraint) -- cleanup specifique en `afterAll`.

### Liens stories suivantes / cloture Epic 8

- **Retrospective Epic 8** : a lancer post-merge 8.D.1 via skill `bmad-retrospective`. Bilan 11/11 stories, decisions DECISIONS.md F-Epic8-A0/A2/A3, livraison en ~24h calendaires (cadrage 2026-05-16 -> 8.D.1 ready-for-dev 2026-05-17). Hors scope direct 8.D.1.
- **Epic 9 candidats** : extraction helper partage `components/shared/parrainage-view`, ajout item nav "Parrainage" dans `AccompagneDashboardHeader`, suppression alias retro-compat `sendParrainageBienvenueMarraine` (1 release apres 8.C.3), audit Sentry 7j signaux `cron-marraine-unexpected-role`, etc. Tous deferes Epic 9, pas blocant 8.D.1.

### References

- [Source: _bmad-output/planning-artifacts/epic-8.md#Story 8.D.1] -- spec originale (4 AC : harness Playwright + Stripe test mode, screenshot+trace on fail, blocked-by 7.C.1, doc README). 8.D.1 raffine la spec en 4 SC concrets avec strategie proxy BDD (justification pragmatique Stripe Checkout non-testable Playwright pur).
- [Source: _bmad-output/planning-artifacts/epic-8.md#NFR-Test-E8.1] -- tests integration tests/integration/parrainage (livre 8.A.4) + tests E2E (cette story).
- [Source: _bmad-output/implementation-artifacts/7-c-1-infra-e2e-playwright.md] -- infra Playwright complete (config, helpers, GHA workflow, pattern 5 seed users, garde-fou anti-prod).
- [Source: _bmad-output/implementation-artifacts/7-c-2-scenarios-anti-fraude-parrainage-e2e.md] -- pattern strategie BDD directe + `withPg` + `OnboardingPage` + reuse `loginAs('filleule')` + setup `parrainee_par` + cleanup defensif + run-ids GHA documentes en Completion Notes.
- [Source: _bmad-output/implementation-artifacts/8-a-1-webhook-stripe-genese-code-parrainage-accompagne.md] -- webhook genese `parrainages_codes` pour accompagne via `triggerAccompagneCodeGenesisIfEligible` (8.D.1 setup SC1 le bypasse en INSERT direct).
- [Source: _bmad-output/implementation-artifacts/8-a-2-server-actions-parrainage-symetrique.md] -- `validateCode` role-aware + `createParrainageRelation` guard `invalid_filleul_role` + `confirmParrainageOnSuccess` role-aware (8.D.1 SC4 photographie la shape BDD post-call).
- [Source: _bmad-output/implementation-artifacts/8-a-3-cron-confirm-parrainages-recompense-role-parrain.md] -- cron role-aware (hors-scope 8.D.1).
- [Source: _bmad-output/implementation-artifacts/8-a-4-tests-integration-parrainage-symetrique.md] -- 6 SC integration (4 sens golden + 2 sens interdits + sub inactive) deja verts. Reference pour la repartition de responsabilites integration vs E2E.
- [Source: _bmad-output/implementation-artifacts/8-b-1-page-accompagne-parrainage-code-filleuls-a11y.md] -- page `/accompagne/parrainage` complete (selectors UI exact, redirects, ParrainageView props).
- [Source: _bmad-output/implementation-artifacts/8-b-2-teaser-dashboard-accompagne-invitez-accompagnant.md] -- teaser dashboard accompagne lookup `parrainages_codes` (8.D.1 SC1 reuse pattern condition `parrainageCode` non null).
- [Source: _bmad-output/implementation-artifacts/8-c-3-wording-ui-neutre-marraine-filleule-parrain-filleul.md] -- wording neutre garanti (8.D.1 asserts text strictement masculin neutre, regle CLAUDE.md durcie).
- [Source: app/accompagne/parrainage/page.tsx] -- Server Component, redirects, query parrainages_codes + parrainages.
- [Source: components/accompagne/parrainage-view.tsx] -- client component, copy strictement neutre, structure DOM exacte.
- [Source: app/accompagnant/onboarding/page.tsx] -- lit `users.parrainee_par`.
- [Source: components/accompagnant/onboarding-client.tsx:179-190] -- texte bypass visio rendue uniquement quand `isFilleule=true`.
- [Source: components/accompagnant/step-diplome.tsx:140-143] -- helper "Optionnel grace a votre parrainage".
- [Source: components/auth/register-form.tsx:55-200] -- wizard signup + pre-remplissage `parrainage_code` via URL.
- [Source: app/actions/parrainage.ts:327-518] -- `validateCode` rate-limit + role-aware (hors-scope direct mais utile dev pour comprendre signature).
- [Source: app/actions/parrainage.ts:524-821] -- `createParrainageRelation` guard `invalid_filleul_role` + idempotence + anti-fraude.
- [Source: app/actions/parrainage.ts:827-1137] -- `confirmParrainageOnSuccess` role-aware + bypass visio + generation code filleul.
- [Source: tests/e2e/_lib/session.ts] -- `loginAs` + `SEED_USERS_CREDENTIALS` + `ROLE_REDIRECT` (filleule -> `/accompagnant`).
- [Source: tests/e2e/_lib/fixtures.ts] -- `resetEphemeralRows` (n inclut PAS `parrainages_codes`, doit etre cleane separement) + `assertLocalPgUrl`.
- [Source: tests/e2e/_lib/pages.ts:49-64] -- `OnboardingPage` (livre 7.C.2, reuse direct SC3).
- [Source: tests/e2e/parrainage-anti-fraude.spec.ts] -- pattern complet (header strategie + helpers + tests tagges + cleanup).
- [Source: tests/e2e/README.md] -- guide complet local + GHA + strategie auth + ajout spec.
- [Source: supabase/seeds/01_users.sql] -- 5 seed users + profils (user3 accompagne, user5 filleule).
- [Source: supabase/seeds/02_parrainages.sql] -- TESTSEED1 user4 + parrainages aaa1/aaa2.
- [Source: supabase/seeds/04_subscriptions.sql] -- ccc1 user2 active future + ccc2 user3 active expiree (a forcer en active future pour SC1).
- [Source: scripts/seed-test-supabase.mjs] -- UUIDs fixes + emails seed + password `seed-password-1234`.
- [Source: .github/workflows/e2e-tests.yml] -- workflow GHA existant + env vars.
- [Source: playwright-e2e.config.ts] -- config Playwright (testDir tests/e2e, workers 1, retries 2 CI, globalSetup).
- [Source: package.json scripts] -- `test:e2e`, `test:e2e:ui`, `test:e2e:debug`.
- [Source: DECISIONS.md#F-Epic8-A0] -- audit BDD GO sans migration, 4 invariants documentes (subscription_status double L, user_role 3 valeurs, marraine_id NULLable, pas d index sur users.role).
- [Source: DECISIONS.md#F-Epic8-A3] -- cron role-aware + divergence FLAG-E (pas de recompense_perdue, deterministe).
- [Source: CLAUDE.md] -- regles projet (pas d emoji, DoD a11y meme sans impact UI, wording masculin neutre, npm run a11y:axe:check obligatoire avant commit livraison).
- [Source: memoire `[[project_epic_8_cadrage]]`] -- cadrage 2026-05-16, 11 stories en 4 mini-epics, 7 nouveaux FR (FR49-55), demarrage post-Epic 7.
- [Source: memoire `[[project_bmad_conventions]]`] -- statut done apres merge, format commits, transition `ready-for-dev` -> `review` -> `done`.
- [Source: memoire `[[feedback_test_local_supabase]]`] -- Sylvain ne lance pas Docker localement, validation par GHA workflow uniquement.

## Dev Agent Record

### Agent Model Used

{{agent_model_name_version}}

### Debug Log References

### Completion Notes List

### File List

## DoD a11y

**Non applicable** : cette story est purement infrastructurelle (tests E2E Playwright reuse de PO existants). Aucun changement UI applicatif, aucune copy nouvelle, aucun composant React modifie. La regle CLAUDE.md `npm run a11y:axe:check` reste obligatoire avant commit livraison (AC8) pour preserver le baseline 0 violations Critical/Serious sur 7 parcours.

- [ ] **Non applicable** : story infrastructurelle E2E, 0 changement UI applicatif.
- [ ] Pas de regression `eslint-plugin-jsx-a11y` (`npm run lint:a11y-check` vert en CI) -- baseline 155, no regression.
- [ ] Pas de regression axe-core (`npm run a11y:axe:check` vert) -- aucun delta Critical/Serious vs baseline existante.
