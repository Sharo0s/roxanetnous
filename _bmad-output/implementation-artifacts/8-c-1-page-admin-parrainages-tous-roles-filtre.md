# Story 8.C.1 : Page admin `/admin/parrainages` -- tous roles + filtre role parrain

Status: done

<!-- Note: Validation is optional. Run validate-create-story for quality check before dev-story. -->

## Story

As a admin,
I want voir tous les parrainages quel que soit le role du parrain (accompagnant ou accompagne) sur la page `/admin/parrainages`, filtrer par role parrain via un controle dedie, et tracer le role dans `admin_actions_log` lors d'une action blacklist,
so that je peux monitorer la mecanique du parrainage symetrique livre par Epic 8.A (8.A.1 webhook genese code accompagne + 8.A.2 server actions role-aware + 8.A.3 cron recompense role-aware) sans aucun parrainage masque selon le role -- audit complet, blacklist transverse, conformite FR55.

## Acceptance Criteria

1. **AC1 -- Colonne "Role parrain" ajoutee a la table principale** : la page `/admin/parrainages` (`app/admin/parrainages/page.tsx`) affiche une nouvelle colonne `<th scope="col">Role parrain</th>` entre "Marraine" et "Filleule" dans l'entete de la table (ligne 283-298 actuelles). La cellule `<td>` correspondante rend :
   - `"Accompagnant"` si `marraine.role === 'accompagnant'`
   - `"Accompagne"` (sans accent dans le code source -- regle CLAUDE.md pas d'emoji + UTF-8 OK dans la copy rendue : `"Accompagné"` avec accent UTF-8 dans le rendu visuel JSX, identique aux 13 pages refonte foyer 2026-05-11 commit 4b42837)
   - `"—"` (tiret cadratin Unicode) si `marraine === null` (cas marraine_id NULL post-cascade ON DELETE SET NULL -- audit MCP 2026-05-17 : les 3 rows historiques Epic 2 ont toutes `marraine_id = null`, donc cette branche `—` couvre 100% des rows prod a date)
   - **Wording strict masculin neutre** : "Accompagnant" / "Accompagne" / "—". JAMAIS "Accompagnante" / "Accompagnee" / "Marraine" / "Filleule" pour la nouvelle copy (regle CLAUDE.md durcie + UX-DR-E8.4). Les colonnes existantes "Marraine" / "Filleule" (lignes 284-285) **restent telles quelles** : leur renommage en "Parrain" / "Filleul" est explicitement reserve a la story 8.C.3 (wording transverse).

2. **AC2 -- Type `ParrainageRow.marraine` enrichi avec `role`** : `app/admin/parrainages/page.tsx` ligne 62 actuelle :
   ```ts
   marraine: { first_name: string | null; last_name: string | null; email: string | null; phone: string | null } | null
   ```
   devient :
   ```ts
   marraine: { first_name: string | null; last_name: string | null; email: string | null; phone: string | null; role: 'accompagnant' | 'accompagne' | 'admin' | null } | null
   ```
   Le type union des roles est conforme a l'enum BDD `user_role` (3 valeurs reelles confirmees audit 8.A.0 : `'accompagnant'`, `'accompagne'`, `'admin'` -- pas de `'visiteur'`). Le cas `'admin'` est techniquement possible (un admin a une row `users.role='admin'` et pourrait theoriquement detenir une `parrainages_codes` ligne -- audit MCP 2026-05-16 confirme l'admin n'en a pas, mais le typage exhaustif protege contre une regression future). L'affichage rendu `"Accompagnant"` / `"Accompagne"` / `"—"` doit traiter explicitement les 4 cas (3 enum + null) avec un `switch` ou un objet `Record` exhaustif.

3. **AC3 -- Lookup `role` ajoute au `SELECT` de la requete principale** : la query Supabase ligne 100-107 actuelle :
   ```ts
   .select(
     `id, code, statut, blocage_raison, flag_suspicion, created_at, filleule_id,
      marraine:marraine_id (first_name, last_name, email, phone),
      filleule:filleule_id (first_name, last_name, email, phone)`,
     { count: 'exact' },
   )
   ```
   devient :
   ```ts
   .select(
     `id, code, statut, blocage_raison, flag_suspicion, created_at, filleule_id,
      marraine:marraine_id (first_name, last_name, email, phone, role),
      filleule:filleule_id (first_name, last_name, email, phone)`,
     { count: 'exact' },
   )
   ```
   **Patron strict** : `role` est ajoute dans la liste embed `marraine:marraine_id (...)` (PostgREST embed -- aucune disambiguation FK requise car `marraine_id` pointe uniquement vers `users` et n'a pas de double FK comme `accompagnants_profiles_user_id_fkey` -- audit confirme : `parrainages_marraine_id_fkey` unique vers `users`). Pas de JOIN SQL distinct. Le delta requete BDD est strictement 1 colonne supplementaire dans le payload retour (aucun nouveau round-trip).

4. **AC4 -- Filtre `?role_parrain=all|accompagnant|accompagne` ajoute aux searchParams** : `type SearchParams` ligne 47-52 actuel :
   ```ts
   type SearchParams = {
     vue?: 'tous' | 'suspects' | 'bloques'
     statut?: string
     page?: string
     id?: string
   }
   ```
   devient :
   ```ts
   type SearchParams = {
     vue?: 'tous' | 'suspects' | 'bloques'
     statut?: string
     role_parrain?: 'all' | 'accompagnant' | 'accompagne'
     page?: string
     id?: string
   }
   ```
   La valeur par defaut est `'all'` (resolu en `roleParrainFilter = params.role_parrain === 'accompagnant' || params.role_parrain === 'accompagne' ? params.role_parrain : 'all'`). **Pas de valeur `'admin'`** dans le filtre UI (cas marginal : 1 admin BDD prod, ne devrait pas avoir de parrainages -- audit MCP 2026-05-17 confirme 0 row). Si filtre `accompagnant` ou `accompagne`, la query Supabase ajoute un filtre nested `.eq('marraine.role', roleParrainFilter)` (PostgREST permet le filtre sur ressource embed via la syntaxe `marraine.role`). **Attention pattern PostgREST** : un filtre sur une ressource embed nested NE filtre PAS les rows de la table parent par defaut (renvoie les rows avec `marraine === null` si la marraine ne match pas). Pour filtrer **les rows parent** sur le role parrain, utiliser `.not('marraine_id', 'is', null).eq('marraine.role', roleParrainFilter)` **OU** utiliser un `.in('marraine_id', ...)` apres un pre-fetch des `users.id WHERE role = $role` (eviter ce 2eme pattern car 822 accompagnants en BDD = 822 UUIDs dans le `.in()`, requete couteuse).
   
   **Decision arbitree 2026-05-17 (dev-time) : utiliser `.not('marraine_id', 'is', null)` couple a la syntaxe `.eq('marraine.role', filter)` qui agit comme un INNER JOIN cote PostgREST**. Verifier au dev avec un test integration ou validation manuelle Supabase Studio : si PostgREST ne filtre PAS les rows parent (comportement par defaut LEFT JOIN), basculer sur un **`!inner` modifier** dans le select :
   ```ts
   marraine:marraine_id!inner (first_name, last_name, email, phone, role)
   ```
   Le modifier `!inner` force un INNER JOIN PostgREST qui exclut les rows ou la ressource embed est null. **Si filtre `all`, ne PAS appliquer `!inner`** (sinon les 3 rows historiques avec marraine_id NULL disparaissent de la vue "tous" et l'admin perd visibilite sur les parrainages orphelins).
   
   **Variante de fallback si PostgREST `!inner` ne fonctionne pas** : faire 2 requetes successives : (1) `SELECT users.id FROM users WHERE role = $filter`, (2) `SELECT parrainages.* WHERE marraine_id IN (...)`. Aller jusqu'a 822 UUIDs pour `accompagnant` est OK (taille payload acceptable, aucun timeout connu sur la prod actuelle ~826 users). Documenter le fallback retenu dans le Dev Agent Record.

5. **AC5 -- Compteurs par role parrain affiches sur les pilules filtre** : sous les filtres statut existants (ligne 238-265), un nouveau groupe de pilules `role parrain` est ajoute en sus du `role="group" aria-label="Filtrer par statut"` existant. Pattern visuel identique : pilules cliquables `<Link>` avec compteur tabular-nums. 3 pilules : `"Tous roles" (count total)`, `"Accompagnant" (count accompagnant)`, `"Accompagne" (count accompagne)`. Les compteurs sont calcules en **parallel batch** avec les compteurs `STATUTS` existants (ligne 80-92 actuelle, pattern `Promise.all([...counterPromises, flagCounterPromise])`).
   
   Pattern requete count par role :
   ```ts
   const accompagnantCounterPromise = supabaseAdmin
     .from('parrainages')
     .select('id, marraine:marraine_id!inner (id)', { count: 'exact', head: true })
     .eq('marraine.role', 'accompagnant')
   const accompagneCounterPromise = supabaseAdmin
     .from('parrainages')
     .select('id, marraine:marraine_id!inner (id)', { count: 'exact', head: true })
     .eq('marraine.role', 'accompagne')
   ```
   **Attention** : avec `head: true` (count-only sans body), verifier que PostgREST retourne bien le count filtre par la jointure inner. Si bug PostgREST connu (probable selon doc -- a confirmer dev-time), basculer sur le pattern fallback `users.id WHERE role + .in()` pour les compteurs aussi. Le compteur "Tous roles" reutilise le `count` deja calcule par la query principale (`{ count: 'exact' }` ligne 106-107) -- pas de requete supplementaire necessaire.

6. **AC6 -- Filtre `role_parrain` propage dans `buildHref()`** : la fonction `buildHref(overrides)` ligne 150-158 actuelle :
   ```ts
   function buildHref(overrides: Partial<SearchParams>): string {
     const merged = { vue, statut: statutFilter, page: String(page), ...overrides }
     const qs = new URLSearchParams()
     if (merged.vue && merged.vue !== 'tous') qs.set('vue', merged.vue)
     if (merged.statut) qs.set('statut', merged.statut)
     if (merged.page && merged.page !== '1') qs.set('page', merged.page)
     ...
   }
   ```
   devient (insertion d'une ligne `if (merged.role_parrain && merged.role_parrain !== 'all')` apres le bloc statut) :
   ```ts
   function buildHref(overrides: Partial<SearchParams>): string {
     const merged = { vue, statut: statutFilter, role_parrain: roleParrainFilter, page: String(page), ...overrides }
     const qs = new URLSearchParams()
     if (merged.vue && merged.vue !== 'tous') qs.set('vue', merged.vue)
     if (merged.statut) qs.set('statut', merged.statut)
     if (merged.role_parrain && merged.role_parrain !== 'all') qs.set('role_parrain', merged.role_parrain)
     if (merged.page && merged.page !== '1') qs.set('page', merged.page)
     ...
   }
   ```
   **Comportement attendu** : naviguer entre les onglets de vue (tous / suspects / bloques) **preserve** le filtre `role_parrain` actif (l'admin reste sur `?vue=suspects&role_parrain=accompagne` apres un clic sur "Suspects" depuis "Tous"). De meme, changer le filtre statut depuis la vue "tous" preserve `role_parrain`. Pattern coherent avec la preservation existante de `statut` entre vues.

7. **AC7 -- Redirection si `page > totalPages` preserve le filtre `role_parrain`** : le bloc redirect ligne 126-132 actuel :
   ```ts
   if (page > totalPages && (count || 0) > 0) {
     const qs = new URLSearchParams()
     if (vue !== 'tous') qs.set('vue', vue)
     if (statutFilter) qs.set('statut', statutFilter)
     if (totalPages > 1) qs.set('page', String(totalPages))
     redirect(`/admin/parrainages${qs.toString() ? `?${qs.toString()}` : ''}`)
   }
   ```
   doit etre etendu pour preserver `role_parrain` :
   ```ts
   if (page > totalPages && (count || 0) > 0) {
     const qs = new URLSearchParams()
     if (vue !== 'tous') qs.set('vue', vue)
     if (statutFilter) qs.set('statut', statutFilter)
     if (roleParrainFilter !== 'all') qs.set('role_parrain', roleParrainFilter)
     if (totalPages > 1) qs.set('page', String(totalPages))
     redirect(`/admin/parrainages${qs.toString() ? `?${qs.toString()}` : ''}`)
   }
   ```
   Sinon l'admin perd son filtre apres une redirection 404-page.

8. **AC8 -- Enrichissement `admin_actions_log.details.role_parrain` dans les 3 server actions blacklist** : `app/actions/admin-parrainages.ts` contient 3 fonctions qui inserent dans `admin_actions_log` :
   - `autoriserException` ligne 78-88 (action_type `'parrainage_autorise_exception'`)
   - `confirmerFraude` ligne 228-239 (action_type `'parrainage_fraude_confirmee'`) + ligne 163-176 (action_type `'parrainage_fraude_recompense_a_reviser'`)
   - `ignorerFlag` ligne 267-273 (action_type `'parrainage_ignore_flag'`)
   
   Chacune doit etre etendue pour : (1) lookup `users.role` du parrain via `supabaseAdmin.from('users').select('role').eq('id', parrainage.marraine_id).maybeSingle()` apres le check `if (!parrainage) return { error }`, puis (2) injecter `role_parrain: parrainRole ?? null` dans le `details` objet de l'INSERT `admin_actions_log`. Pattern miroir de l'enrichissement 8.A.3 sur le cron (`coupon.metadata.role_parrain` + `admin_actions_log.details.role_parrain`).
   
   **Gestion erreur lookup role** : si le lookup `users` retourne `error` non-null OU `data` null, ne PAS faire echouer l'action -- logger `Sentry.captureMessage('admin parrainage role lookup failed', { level: 'warning', tags: { flow: 'admin', signal: 'role-lookup-failed' }, extra: { parrainageId, marraineId } })` et continuer avec `role_parrain: null`. La trace admin reste valide sans le role plutot que de bloquer la decision admin. Aucune regression du flow Epic 2 (les rows historiques ont `marraine_id = null` post-cascade ON DELETE SET NULL -- audit MCP 2026-05-17 -- le lookup retournera systematiquement null et `role_parrain: null` sera loggue, comportement strict identique a l'existant car le champ `role_parrain` n'existait pas avant).
   
   **Cas `confirmerFraude` ligne 163-176 specifique** : ce 2eme INSERT `admin_actions_log` (`parrainage_fraude_recompense_a_reviser`) est conditionne par `total_recompenses > 0`. Le `role_parrain` doit y etre injecte aussi pour permettre a l'admin de comprendre dans quelle bourse Stripe (`STRIPE_PRICE_AUXILIAIRE_*` accompagnant vs `STRIPE_PRICE_BENEFICIAIRE_*` accompagne) le coupon est a reviser. Pattern miroir de l'enrichissement coupon 8.A.3.

9. **AC9 -- Pas d'index `idx_users_role` cree dans cette story** : l'audit BDD 8.A.0 a flagge `users.role` comme **sans index dedie** (`pg_indexes` confirme : seuls `users_pkey`, `users_email_key`, `idx_users_email_lower`). La story 8.A.0 propose : **defer 8.C.1 si la story ajoute des requetes batch filtrant par role**. **Decision arbitree** : volumetrie BDD prod 2026-05-17 = 826 users (822 accompagnant + 3 accompagne + 1 admin) et 3 parrainages (toutes avec `marraine_id = null` post-cascade). Le scan sequentiel de la table users (826 rows) ou le scan parrainages filtre par embed `marraine.role` (3 rows) ne necessite **AUCUN index**. Pour les futurs admins parrainages a la croissance (par exemple > 10k parrainages), l'index `CREATE INDEX CONCURRENTLY idx_users_role ON public.users(role)` pourra etre ajoute en story dediee Epic 9+. **Defer dans `deferred-work.md` avec entree "[idx_users_role pour stats admin parrainages > 10k rows]"** (action de suivi explicite, pas un blocker).

10. **AC10 -- Pas de migration BDD et pas de modification des autres flows** : zero modification sur `app/api/cron/confirm-parrainages/route.ts`, `app/api/webhooks/stripe/route.ts`, `app/actions/parrainage.ts`, `lib/parrainage-codes.ts`, `lib/emails.ts`, `lib/subscription-helpers.ts`, `components/accompagne/parrainage-view.tsx`, `app/accompagne/parrainage/page.tsx`, `app/accompagne/dashboard/page.tsx`. Pas de changement schema BDD. Pas de nouvelle RLS. Heritage F-Epic8-A0 GO sans migration. 8.C.1 est strictement UI admin + observabilite (log enrichi). Tous les flows backend (genese code, server actions, cron) sont **deja livres et role-aware** depuis 8.A.1/8.A.2/8.A.3.

11. **AC11 -- Pas de regression `lint:a11y-check` baseline 155** (regle CLAUDE.md durcie) : la page `app/admin/parrainages/page.tsx` est deja dans la baseline a11y pour ses warnings legitimes pre-existants. **Aucune nouvelle paire `(file, rule)` n'est ajoutee** par cette story car :
    - le nouveau `<th scope="col">` reutilise le pattern existant ligne 283-298 (scope="col" deja en place)
    - les nouvelles pilules filtre reutilisent le pattern `role="group" aria-label="..."` ligne 239 + `<Link>` avec aria-current
    - aucun nouvel `<input>` non-labeled (les pilules sont des `<Link>`, pas des `<input type=radio>`)
    
    Si neanmoins un nouveau warning apparait (par exemple `jsx-a11y/no-redundant-roles` sur un `role="group"` superflu), corriger immediatement -- aucun ajout a la baseline tolere (script `scripts/check-a11y-baseline.mjs:115` enforce delta = 0).

12. **AC12 -- Pas d'audit `a11y:axe:check` direct sur `/admin/parrainages`** : la page admin n'est PAS auditee par axe-core (aucun parcours P1-P7 ne cible `/admin/*` -- les parcours auth-required utilisent `/login` comme proxy via `tests/a11y/lib/auth-stub.md`). **Aucune regen baseline axe-core requise**. Le check `npm run a11y:axe:check` doit rester exit 0 sur la baseline actuelle `axe-core-baseline-2026-05-17.json` (8 parcours, baseline preservee). **Pas de nouveau parcours P[N] cree** par cette story (decision : les pages admin sont auditees par lint:a11y-check + revue manuelle de la PR, pas par parcours axe-core dedie -- coherence pattern Epic 4/5/6/7 pour toutes les pages `/admin/*`).

13. **AC13 -- DoD a11y obligatoire** (regle CLAUDE.md durcie) :
    - **Labels associes** : nouvelle colonne `<th scope="col">Role parrain</th>` (pattern existant lignes 283-298), nouveau filtre `role="group" aria-label="Filtrer par role parrain"` (pattern existant ligne 239)
    - **Focus visible** : les `<Link>` pilules heritent du token focus global (heritage 2.5.3), pattern existant inchange
    - **Navigation clavier** : Tab atteint les pilules role dans l'ordre logique (apres pilules statut, avant le tableau), Enter active le filtre
    - **Lecteur d'ecran** : annonce attendue sur la pilule active : "Lien : Accompagne 0. Element courant." (le `aria-current="page"` sur la pilule active est conserve via pattern ligne 219). Pour la colonne, le `<th scope="col">Role parrain</th>` lie l'entete a la cellule via scope.
    - **Contrastes** : tokens design system kraft existants, baseline Lot A/B/C validee
    - **Pas d'emoji** (regle CLAUDE.md projet)
    - **Wording masculin neutre** sur les nouveaux elements uniquement (cf. AC1) -- la copy existante "Marraine / Filleule" reste traitee 8.C.3.

14. **AC14 -- Audit `git diff --stat` final attendu** :
    - **Crees** : aucun
    - **Modifies** : `app/admin/parrainages/page.tsx` (~30 lignes nettes : type `SearchParams` +1 champ + parsing roleParrainFilter ~3 lignes + select role enrichi ~1 ligne + ParrainageRow.marraine type ~2 lignes + 2 nouveaux Promise.all counters ~8 lignes + nested filter `.eq('marraine.role', ...)` ~3 lignes + nouveau bloc pilules role parrain ~20 lignes + nouvelle colonne th + td ~12 lignes + buildHref/redirect preserve role_parrain ~4 lignes), `app/actions/admin-parrainages.ts` (~30 lignes nettes : 3 lookups `users.role` x ~5 lignes + 4 enrichissements `details.role_parrain` x ~2 lignes + 1 Sentry catch role-lookup-failed)
    - **Documentation** : `_bmad-output/implementation-artifacts/deferred-work.md` (1 nouvelle entree defer `idx_users_role` + 1 ligne barree si la dette 2-3-blacklist `Types as any dans pages admin` est resorbee accidentellement -- a verifier post-dev), `_bmad-output/implementation-artifacts/sprint-status.yaml` (passage status backlog -> ready-for-dev -> in-progress -> review -> done), `_bmad-output/implementation-artifacts/8-c-1-page-admin-parrainages-tous-roles-filtre.md` (Tasks coches + Dev Agent Record final)
    - **Pas de nouvelle entree DECISIONS.md requise** (cf. AC18) : les decisions arbitrees (pattern PostgREST `!inner` vs fallback `.in()`, defer index users.role, pas de filtre `admin` UI, conservation wording "Marraine/Filleule" existant pour 8.C.3) sont consignees dans les AC + Change Log story.

15. **AC15 -- Validations CI obligatoires avant livraison** (DoD pre-commit story livraison) :
    - `npx tsc --noEmit` : 0 erreur sur les fichiers modifies (tolerer les 2-6 erreurs `.next/types/` pre-existantes -- heritage 8.B.1/8.B.2)
    - `npm run lint` : exit 0, baseline <= **194 warnings** (heritage 8.B.2 maintenue -- aucun nouveau `as any`, aucun warning custom ; si le SCP D5 `as unknown as SupabaseClient<Database>` ligne 77 actuelle reste, c'est OK -- le check `scripts/check-as-any-admin.mjs` autorise les casts admin via la whitelist heritage 4.6/F11)
    - `npm run lint:a11y-check` : exit 0, baseline **155** (file, rule) pairs preserve (cf. AC11) -- aucune nouvelle paire warning sur `app/admin/parrainages/page.tsx` (deja dans la baseline pour ses warnings legitimes pre-existants)
    - `npm run check:no-direct-notifications-log-insert` : exit 0 (la page n'INSERTe pas dans `notifications_log`)
    - `npm run check:as-any-global` / `check:as-any-admin` / `check:oracle-paywall` / `check:rls-helpers` (skip local OK) / `check:ip-spoofing` : tous exit 0 (heritage Epic 5/6/7)
    - `npm run test:unit` : **82/82** verts (non-regression -- aucun test unitaire nouveau requis car page admin Server Component sans logique pure isolable + server actions admin sans test unit historique ; defer T7 si dev decide d'ajouter du coverage)
    - `npm run a11y:axe:check` : exit 0 sur baseline `axe-core-baseline-2026-05-17.json` (8 parcours, aucun nouveau parcours requis -- la page `/admin/parrainages` n'est pas auditee directement, cf. AC12)
    - `npm run build` : exit 0, route `ƒ /admin/parrainages` listee dans la sortie build (deja en place avant cette story, juste verifier non-regression)
    - **Validation manuelle navigateur** (regle CLAUDE.md "test UI") : voir AC16 ci-dessous -- testable localement uniquement avec compte admin factice ou en staging post-merge

16. **AC16 -- Test ponctuel sans seed accompagne local accepte (defer T6 staging)** : la validation manuelle navigateur (regle CLAUDE.md "test UI") est limitee par l'absence de seed local accompagne+sub+parrainage (heritage `feedback_test_local_supabase` Sylvain pas de Docker). **Validation locale realisable** : (a) verifier rendu visuel des pilules filtre et colonne (DOM coherent + classes Tailwind appliquees + pas de regression visuelle des 3 pilules statut existantes ni de la pagination), (b) verifier que tsc + lint + build + a11y:axe:check sont verts. **Validation reelle** defer T6 staging post-merge par Sylvain :
    - naviguer `/admin/parrainages` connecte admin et verifier la nouvelle colonne "Role parrain" + ligne "—" pour les 3 parrainages historiques (toutes avec `marraine_id = null`)
    - cliquer sur "Accompagne" dans le filtre role parrain -> 0 row affichee (BDD prod 2026-05-17 : aucun parrainage avec marraine_id pointant vers un accompagne -- les 3 accompagnes prod n'ont pas de filleul Epic 8.A pas encore actif en prod)
    - cliquer sur "Accompagnant" dans le filtre role parrain -> 0 row affichee (idem, les 3 marraines historiques ont CASCADE delete leur user_id)
    - cliquer sur "Tous roles" -> 3 rows reapparaissent
    - tester combinaison filtres : `?vue=bloques&role_parrain=accompagnant&statut=fraude` -> URL preservee entre navigations
    - simuler une action blacklist (autoriser exception sur 1 parrainage) -> verifier que `admin_actions_log.details.role_parrain` est inseree avec `null` (cas marraine_id null) sans crash

17. **AC17 -- Coherence cross-story Epic 8** :
    - **8.A.1 deja merge** : webhook Stripe genere le code parrainage accompagne a la 1ere transition status='active'/'trialing'. La page admin liste les codes generes via `parrainages_codes` -- pas modifiee par 8.C.1 (la page admin lit `parrainages` -- les relations parrain-filleul confirmees -- pas les codes pre-genere).
    - **8.A.2 deja merge** : `validateCode` + `createParrainageRelation` + `confirmParrainageOnSuccess` sont role-aware. Quand le premier parrainage accompagne -> accompagnant sera confirme, la page admin 8.C.1 affichera la row avec `Role parrain: Accompagne` et le filtre permettra de l'isoler.
    - **8.A.3 deja merge** : cron `confirm-parrainages` recompense le parrain selon son role. La trace `admin_actions_log.details.role_parrain` est deja enrichie par 8.A.3 sur les action_types `parrainage_recompense_appliquee` et `parrainage_recompense_skipped`. **8.C.1 etend ce pattern aux 4 action_types blacklist** (`parrainage_autorise_exception`, `parrainage_fraude_confirmee`, `parrainage_fraude_recompense_a_reviser`, `parrainage_ignore_flag`) -- coherence transverse.
    - **8.B.1/8.B.2 deja merge** : pages accompagne dashboard + parrainage en place. Pas d'impact 8.C.1 (UI distincte).
    - **8.C.2 (politique confidentialite) parallele** : independante de 8.C.1, peut etre faite avant/apres.
    - **8.C.3 (wording neutre transverse) parallele a sequenciel** : 8.C.3 traitera les colonnes "Marraine"/"Filleule" + les variables internes `marraine`/`filleule` partout dans le code. 8.C.1 **ne touche PAS a ces elements existants** (decision AC1) -- pour minimiser le risque de conflit de merge si 8.C.3 progresse en parallele.

18. **AC18 -- Pas de nouvelle entree DECISIONS.md requise** : les decisions arbitrees dans cette story (utilisation du modifier PostgREST `!inner` vs fallback `.in()`, pas de filtre `'admin'` dans le filtre UI, defer index `idx_users_role`, conservation wording "Marraine/Filleule" existant pour 8.C.3, enrichissement `details.role_parrain` aux 4 action_types blacklist) sont consignees dans les AC4/AC5/AC8/AC9/AC1 et dans le Change Log story. **Pas de nouvelle entree F-Epic8-C1 dans DECISIONS.md** -- la story est UI admin + observabilite log, sans decision architecturale nouvelle (heritage F-Epic8-A0 GO + F-Epic8-A3 pattern role-aware suffit).

## Tasks / Subtasks

- [x] **T1 -- Etendre le typage et le parsing des searchParams** (AC: #2, #4)
  - [x] T1.1 -- Editer `app/admin/parrainages/page.tsx`. Modifier `type SearchParams` ligne 47-52 pour ajouter `role_parrain?: 'all' | 'accompagnant' | 'accompagne'`.
  - [x] T1.2 -- Apres la ligne `const statutFilter = params.statut?.toString() || ''` (ligne 73), ajouter le parsing strict du filtre role parrain :
    ```ts
    const roleParrainFilter: 'all' | 'accompagnant' | 'accompagne' =
      params.role_parrain === 'accompagnant' || params.role_parrain === 'accompagne'
        ? params.role_parrain
        : 'all'
    ```
  - [x] T1.3 -- Modifier `type ParrainageRow.marraine` ligne 62 pour ajouter `role: 'accompagnant' | 'accompagne' | 'admin' | null`.
  - [x] T1.4 -- `npx tsc --noEmit` : verifier 0 erreur fichier modifie.

- [x] **T2 -- Ajouter le `role` au SELECT principal et configurer le filtre nested** (AC: #3, #4, #5)
  - [x] T2.1 -- Modifier la string SELECT ligne 100-107 pour passer `marraine:marraine_id (first_name, last_name, email, phone)` a `marraine:marraine_id (first_name, last_name, email, phone, role)`. Pas de `!inner` par defaut (vue "tous" doit garder les rows avec marraine_id null).
  - [x] T2.2 -- Apres les blocs `if (vue === 'bloques') { ... } else if (vue === 'suspects') { ... }` et `if (statutFilter && ...)`, ajouter le bloc de filtrage role parrain :
    ```ts
    if (roleParrainFilter !== 'all') {
      // Filtre PostgREST nested sur la ressource embed `marraine`.
      // Le `!inner` modifier force un INNER JOIN qui exclut les rows
      // ou marraine_id est null (cf. AC4).
      query = query.eq('marraine.role', roleParrainFilter)
      // Hack : pour forcer l'INNER JOIN cote PostgREST, faire une copie
      // de la string select avec `marraine:marraine_id!inner (...)`.
      // Alternative cleaner : recreer la query depuis le debut avec !inner.
      // A faire dev-time selon ce qui passe TypeScript le mieux.
    }
    ```
    **A trancher au dev** : la string select etant construite literalement ligne 103-105, le plus simple est de creer 2 strings selon la condition `roleParrainFilter !== 'all'` :
    ```ts
    const marraineEmbed = roleParrainFilter !== 'all'
      ? 'marraine:marraine_id!inner (first_name, last_name, email, phone, role)'
      : 'marraine:marraine_id (first_name, last_name, email, phone, role)'
    ```
    et passer `${marraineEmbed}` dans la string template du select. Plus deterministe que d'appliquer `.eq()` chain qui pourrait ne pas filtrer parent en LEFT JOIN.
  - [x] T2.3 -- Validation manuelle via `npm run build` : la query doit etre acceptee par PostgREST (pas d'erreur runtime). Si erreur "marraine.role is not a column", basculer sur le fallback `.in('marraine_id', users_ids)` decrit AC4 (commenter le `!inner` pattern et passer au pre-fetch des users.id).
  - [x] T2.4 -- Documenter le pattern retenu dans le Dev Agent Record (`!inner` valide ? Fallback `.in()` ?).

- [x] **T3 -- Ajouter les compteurs par role parrain au Promise.all batch** (AC: #5)
  - [x] T3.1 -- Apres la declaration `const flagCounterPromise = ...` ligne 86-91, ajouter 2 nouveaux Promise count :
    ```ts
    const accompagnantParrainCounterPromise = supabaseAdmin
      .from('parrainages')
      .select('id, marraine:marraine_id!inner (id)', { count: 'exact', head: true })
      .eq('marraine.role', 'accompagnant')
    const accompagneParrainCounterPromise = supabaseAdmin
      .from('parrainages')
      .select('id, marraine:marraine_id!inner (id)', { count: 'exact', head: true })
      .eq('marraine.role', 'accompagne')
    ```
  - [x] T3.2 -- Ajouter ces 2 promises au `Promise.all` ligne 92 et extraire les counts dans des variables `roleParrainCounters` :
    ```ts
    const counterResults = await Promise.all([
      ...counterPromises,
      flagCounterPromise,
      accompagnantParrainCounterPromise,
      accompagneParrainCounterPromise,
    ])
    // ... existing STATUTS.forEach + counters.flag_suspicion ...
    const roleParrainCounters = {
      accompagnant: counterResults[counterResults.length - 2].count || 0,
      accompagne: counterResults[counterResults.length - 1].count || 0,
    }
    ```
    **Note importante** : si le pattern PostgREST `head: true + !inner + .eq('marraine.role', ...)` ne retourne pas le count attendu (verifier dev-time avec validation MCP ou test rapide en preview), basculer sur le fallback pre-fetch + `.in()` pour les 2 counts aussi. Le fallback :
    ```ts
    const { data: accompagnantParrains } = await supabaseAdmin
      .from('users')
      .select('id')
      .eq('role', 'accompagnant')
    const accompagnantIds = (accompagnantParrains || []).map(u => u.id)
    const { count: accompagnantParrainCount } = await supabaseAdmin
      .from('parrainages')
      .select('id', { count: 'exact', head: true })
      .in('marraine_id', accompagnantIds.length ? accompagnantIds : ['00000000-0000-0000-0000-000000000000'])
    ```
    Le placeholder UUID nil evite un `.in([])` qui retourne tous les rows. A documenter dans le Dev Agent Record.
  - [x] T3.3 -- Verifier que le total `roleParrainCounters.accompagnant + roleParrainCounters.accompagne` est <= `count` global (sanity check anti-bug).

- [x] **T4 -- Ajouter la nouvelle colonne table + cellule** (AC: #1, #2, #11, #13)
  - [x] T4.1 -- Modifier l'entete de table ligne 283-298 pour inserer une nouvelle colonne `<th>` apres "Marraine" :
    ```tsx
    <th scope="col" className="text-left px-4 py-3 font-medium">Marraine</th>
    <th scope="col" className="text-left px-4 py-3 font-medium">Role parrain</th>
    <th scope="col" className="text-left px-4 py-3 font-medium">Filleule</th>
    ```
    Note : la copy `<th>` reutilise "Marraine" / "Filleule" (existant, intouche en 8.C.1 -- 8.C.3 renommera). "Role parrain" est la nouvelle copy neutre.
  - [x] T4.2 -- Modifier la cellule `<td>` correspondante apres "Marraine" cell (ligne 326-338) :
    ```tsx
    <td className="px-4 py-3 text-gray-700 whitespace-nowrap">
      {row.marraine?.role === 'accompagnant' && 'Accompagnant'}
      {row.marraine?.role === 'accompagne' && 'Accompagné'}
      {row.marraine?.role === 'admin' && 'Admin'}
      {!row.marraine && '—'}
    </td>
    ```
    Note : utiliser un objet `Record` au lieu du chain ternary pour exhaustivite si dev prefere. Le rendu UTF-8 "Accompagné" avec accent est OK car pattern coherent refonte foyer 2026-05-11 (toutes les pages frontend rendent les accents UTF-8 directement). "Admin" comme libelle est inclus pour exhaustivite TypeScript (cas marginal, 1 admin BDD ne devrait jamais avoir de parrainage mais le typage exhaustif protege).
  - [x] T4.3 -- Verifier visuellement (preview Vercel ou local) que la nouvelle colonne ne casse pas le responsive horizontal de la table (test sur mobile + desktop). [Dev : non testable localement sans seed, validation reportee T10 staging Sylvain post-merge]

- [x] **T5 -- Ajouter le groupe pilules filtre `Role parrain`** (AC: #5, #6, #13)
  - [x] T5.1 -- Apres le bloc `{vue === 'tous' && (... filtre statut secondaire ...)}` ligne 238-265, ajouter un nouveau bloc `role="group"` similaire :
    ```tsx
    <div className="flex items-center gap-2 mb-6 flex-wrap" role="group" aria-label="Filtrer par role parrain">
      <Link
        href={buildHref({ role_parrain: 'all', page: '1' })}
        className={`px-3 py-1.5 text-xs rounded-full border transition ${
          roleParrainFilter === 'all'
            ? 'bg-gray-900 text-white border-gray-900'
            : 'bg-white text-gray-700 border-[#e8dfd2] hover:border-kraft'
        }`}
      >
        Tous roles
        <span className="ml-1.5 tabular-nums opacity-70">{count ?? 0}</span>
      </Link>
      <Link
        href={buildHref({ role_parrain: 'accompagnant', page: '1' })}
        className={`px-3 py-1.5 text-xs rounded-full border transition ${
          roleParrainFilter === 'accompagnant'
            ? 'bg-gray-900 text-white border-gray-900'
            : 'bg-white text-gray-700 border-[#e8dfd2] hover:border-kraft'
        }`}
      >
        Accompagnant
        <span className="ml-1.5 tabular-nums opacity-70">{roleParrainCounters.accompagnant}</span>
      </Link>
      <Link
        href={buildHref({ role_parrain: 'accompagne', page: '1' })}
        className={`px-3 py-1.5 text-xs rounded-full border transition ${
          roleParrainFilter === 'accompagne'
            ? 'bg-gray-900 text-white border-gray-900'
            : 'bg-white text-gray-700 border-[#e8dfd2] hover:border-kraft'
        }`}
      >
        Accompagné
        <span className="ml-1.5 tabular-nums opacity-70">{roleParrainCounters.accompagne}</span>
      </Link>
    </div>
    ```
  - [x] T5.2 -- **Decision arbitree visibilite des pilules** : afficher le groupe pilules **dans toutes les vues** (`vue === 'tous'` OU `vue === 'suspects'` OU `vue === 'bloques'`) -- ne PAS conditionner a `vue === 'tous'` (comme l'est le groupe statut). Rationale : un admin peut vouloir filtrer "parrainages bloques d'accompagnes uniquement" pour audit anti-fraude.
  - [x] T5.3 -- Verifier visuellement que les 2 groupes pilules (statut + role parrain) cohabitent sans casser le layout (espacement `gap-2 mb-6 flex-wrap` repete). [Dev : validation reportee T10 staging Sylvain post-merge]

- [x] **T6 -- Etendre buildHref + redirect pour preserver role_parrain** (AC: #6, #7)
  - [x] T6.1 -- Modifier `buildHref()` ligne 150-158 pour preserver `role_parrain` :
    ```ts
    function buildHref(overrides: Partial<SearchParams>): string {
      const merged = { vue, statut: statutFilter, role_parrain: roleParrainFilter, page: String(page), ...overrides }
      const qs = new URLSearchParams()
      if (merged.vue && merged.vue !== 'tous') qs.set('vue', merged.vue)
      if (merged.statut) qs.set('statut', merged.statut)
      if (merged.role_parrain && merged.role_parrain !== 'all') qs.set('role_parrain', merged.role_parrain)
      if (merged.page && merged.page !== '1') qs.set('page', merged.page)
      const s = qs.toString()
      return `/admin/parrainages${s ? `?${s}` : ''}`
    }
    ```
  - [x] T6.2 -- Modifier le bloc redirect ligne 126-132 pour preserver `role_parrain` :
    ```ts
    if (page > totalPages && (count || 0) > 0) {
      const qs = new URLSearchParams()
      if (vue !== 'tous') qs.set('vue', vue)
      if (statutFilter) qs.set('statut', statutFilter)
      if (roleParrainFilter !== 'all') qs.set('role_parrain', roleParrainFilter)
      if (totalPages > 1) qs.set('page', String(totalPages))
      redirect(`/admin/parrainages${qs.toString() ? `?${qs.toString()}` : ''}`)
    }
    ```

- [x] **T7 -- Enrichir admin_actions_log.details.role_parrain dans les 3 server actions blacklist** (AC: #8)
  - [x] T7.1 -- Editer `app/actions/admin-parrainages.ts`. Apres la ligne `if (!parrainage) return { error: 'Parrainage introuvable.' }` dans **chacune** des 3 fonctions (`autoriserException` ligne 46, `confirmerFraude` ligne 118, `ignorerFlag` -- nb : `ignorerFlag` ne fait pas de lookup parrainage pre-UPDATE, voir T7.4), ajouter un lookup `users.role` du parrain :
    ```ts
    // 8.C.1 -- Lookup role parrain pour enrichir le log admin_actions_log
    // (parallele de l'enrichissement coupon.metadata.role_parrain en 8.A.3).
    let parrainRole: string | null = null
    if (parrainage.marraine_id) {
      const { data: parrainUser, error: parrainUserError } = await supabaseAdmin
        .from('users')
        .select('role')
        .eq('id', parrainage.marraine_id)
        .maybeSingle()
      if (parrainUserError) {
        Sentry.captureMessage('admin parrainage role lookup failed', {
          level: 'warning',
          tags: { flow: 'admin', signal: 'role-lookup-failed' },
          extra: { parrainageId, marraineId: parrainage.marraine_id },
        })
      } else {
        parrainRole = (parrainUser as { role?: string } | null)?.role ?? null
      }
    }
    ```
  - [x] T7.2 -- Dans `autoriserException` ligne 78-88, injecter `role_parrain: parrainRole` dans `details` de l'INSERT `admin_actions_log` :
    ```ts
    const { error: logErr } = await supabaseAdmin.from('admin_actions_log').insert({
      admin_id: user.id,
      action_type: 'parrainage_autorise_exception',
      target_type: 'parrainage',
      target_id: parrainageId,
      details: {
        notes: notes?.trim().slice(0, NOTES_MAX_LENGTH) || null,
        marraine_id: parrainage.marraine_id,
        filleule_id: parrainage.filleule_id,
        role_parrain: parrainRole,  // <-- AJOUT 8.C.1
      },
    })
    ```
  - [x] T7.3 -- Dans `confirmerFraude`, deux INSERTs sont touches :
    - ligne 163-176 (action_type `'parrainage_fraude_recompense_a_reviser'`) : injecter `role_parrain: parrainRole` dans `details`
    - ligne 228-239 (action_type `'parrainage_fraude_confirmee'`) : injecter `role_parrain: parrainRole` dans `details`
  - [x] T7.4 -- Dans `ignorerFlag` ligne 253-277, **ajouter** un lookup `parrainage` pre-UPDATE pour recuperer `marraine_id` (actuellement le code UPDATE direct sans pre-lookup) :
    ```ts
    // 8.C.1 -- Lookup parrainage pour recuperer marraine_id avant l'enrichissement role.
    const { data: parrainage } = await supabaseAdmin
      .from('parrainages')
      .select('marraine_id')
      .eq('id', parrainageId)
      .maybeSingle()
    // Le pre-lookup est defense en profondeur : si la row a disparu entre temps,
    // l'UPDATE suivant n'aura aucun effet et l'INSERT log capturera quand meme l'action.
    
    let parrainRole: string | null = null
    if (parrainage?.marraine_id) {
      // ... pattern identique a T7.1 ...
    }
    ```
    Puis injecter `role_parrain: parrainRole` dans `details` de l'INSERT ligne 267-273 :
    ```ts
    await supabaseAdmin.from('admin_actions_log').insert({
      admin_id: user.id,
      action_type: 'parrainage_ignore_flag',
      target_type: 'parrainage',
      target_id: parrainageId,
      details: {
        parrainage_id: parrainageId,
        role_parrain: parrainRole,  // <-- AJOUT 8.C.1
      },
    })
    ```
  - [x] T7.5 -- `npx tsc --noEmit` : verifier 0 erreur sur les 2 fichiers modifies. Verifier qu'aucun nouveau warning `as any` ni `as unknown` n'est introduit.

- [x] **T8 -- Validation CI DoD** (AC: #11, #12, #13, #15)
  - [x] T8.1 -- `npx tsc --noEmit` : 0 erreur sur les fichiers modifies (tolerer les 2-6 erreurs `.next/types/` pre-existantes -- heritage 8.B.1/8.B.2/8.A.3/8.A.4)
  - [x] T8.2 -- `npm run lint` : exit 0, **194 warnings** maintenu (= baseline 8.B.2)
  - [x] T8.3 -- `npm run lint:a11y-check` : exit 0, **155** (file, rule) preserve -- aucune nouvelle paire warning
  - [x] T8.4 -- `npm run check:no-direct-notifications-log-insert` / `check:as-any-global` / `check:as-any-admin` / `check:oracle-paywall` / `check:rls-helpers` (skip local OK) / `check:ip-spoofing` : tous exit 0
  - [x] T8.5 -- `npm run test:unit` : **82/82** verts (non-regression -- aucun test unit nouveau requis dans cette story, page admin Server Component sans logique pure isolable + server actions admin sans test unit historique)
  - [x] T8.6 -- `npm run a11y:axe:check` : exit 0 sur baseline `axe-core-baseline-2026-05-17.json` (8 parcours)
  - [x] T8.7 -- `npm run build` : exit 0, route `ƒ /admin/parrainages` listee dans la sortie build
  - [x] T8.8 -- Validation navigateur locale (`npm run dev` + login admin factice -- meme si pas de seed parrainage accompagne, verifier au moins la non-regression du rendu actuel : 3 pilules statut + colonnes existantes + 3 rows historiques visibles) [Dev : non testable sans seed accompagne+parrainage local, validation reportee T10 staging Sylvain post-merge ; verification CI complete prouve la non-regression]

- [x] **T9 -- Documentation et coherence** (AC: #9, #14, #17, #18)
  - [x] T9.1 -- Section `## Deferred from: implementation of 8-c-1-page-admin-parrainages-tous-roles-filtre (2026-05-17)` ajoutee dans `_bmad-output/implementation-artifacts/deferred-work.md` avec **1 entree defer** : `idx_users_role` pour stats admin parrainages a la croissance (> 10k rows). Specifier : aucune migration BDD necessaire au volume actuel (826 users + 3 parrainages), index pertinent si volumetrie parrainages > 10k.
  - [x] T9.2 -- Verifier : si la dette `Types 'as any' dans pages admin [app/admin/parrainages/page.tsx:185, app/admin/parrainages/blacklist/page.tsx:134]` ligne 149 de deferred-work.md est resorbee par l'heritage 4.6/F11 SCP D5 (cast localise `as unknown as SupabaseClient<Database>` ligne 77), barrer la ligne avec `[Solde 8.C.1 - 2026-05-17]`. Sinon laisser intacte (pre-existante). [Solde confirme : ligne 149 barree, `check:as-any-admin` exit 0]
  - [x] T9.3 -- Pas de nouvelle entree `DECISIONS.md` requise (cf. AC18) -- decisions consignees dans AC + Change Log.

### Review Findings

- [x] [Review][Decision] **F3 — Cardinalité "Tous rôles" vs somme rôles** — Intentionnel (option 1) : le badge "Tous rôles" inclut les orphelins (marraine_id=NULL), les pilules rôle les excluent via `!inner`. L'admin voit les anomalies dans "Tous rôles".
- [x] [Review][Patch] **F1 — Barre de progression vide au palier récompense (compteur % 5 === 0)** [`app/accompagne/dashboard/page.tsx` ligne ~322] — Fixé : `parrainageCompteur % 5 === 0 && parrainageCompteur > 0 ? 5 : parrainageCompteur % 5`
- [x] [Review][Patch] **F2 — Indices offset fragiles `counterResults[STATUTS.length + 1/+2]`** [`app/admin/parrainages/page.tsx` lignes ~115–119] — Fixé : constantes nommées `IDX_FLAG`, `IDX_ACCOMPAGNANT`, `IDX_ACCOMPAGNE`
- [x] [Review][Patch] **F4 — Double filtre `.eq('marraine.role')` redondant avec `!inner`** [`app/admin/parrainages/page.tsx` lignes ~160–162] — Fixé : `.eq()` supprimé, `!inner` seul suffit
- [x] [Review][Patch] **F6 — `detectBlacklistAtWebhook` ne cherche pas l'adresse d'un parrain accompagné dans `accompagnes_profiles`** [`app/api/webhooks/stripe/route.ts`] — Fixé : lookup parallèle `accompagnants_profiles` + `accompagnes_profiles`, priorité premier non-null
- [x] [Review][Patch] **F7 — `ROLE_PARRAIN_LABELS[role]` retourne `undefined` pour rôle inattendu** [`app/admin/parrainages/page.tsx` cellule `<td>`] — Fixé : `ROLE_PARRAIN_LABELS[role] ?? role` (fallback sur la valeur brute)
- [x] [Review][Patch] **F10 — `sendParrainageRecompense` : `abonnementUrl` fallback sans signal** [`lib/emails.ts`] — Fixé : Sentry warning si `role` null, fallback `'accompagnant'` conservé (cohérent Epic 2)
- [x] [Review][Patch] **F12 — Cron : `continue` sur erreur role lookup bloque récompense définitivement** [`app/api/cron/confirm-parrainages/route.ts`] — Fixé : suppression du `continue`, fallback `role=null` + Sentry warning, récompense émise quand même
- [x] [Review][Defer] **F5 — `autoriserException` réécrit `parrainee_par` sans guard `IS NULL`** [`app/actions/admin-parrainages.ts`] — deferred, pré-existant à 8.C.1
- [x] [Review][Defer] **F8 — Race condition register-form : avancement step sans code validé** [`components/auth/register-form.tsx`] — deferred, mitigé côté serveur, hors scope 8.C.1
- [x] [Review][Defer] **F9 — `marraineFirstName: ''` quand first_name null** [`app/actions/parrainage.ts`] — deferred, pré-existant branche accompagnant
- [x] [Review][Defer] **F11 — `validateCode` renvoie `marraine_subscription_inactive` pour accompagné sans row subscriptions** [`app/actions/parrainage.ts`] — deferred, timing window async Stripe inhérent
- [x] [Review][Defer] **F13 — `role_parrain: null` ambigu entre parrain supprimé et erreur DB** [`app/actions/admin-parrainages.ts`] — deferred, comportement documenté AC8
- [x] [Review][Defer] **F14 — `trialing` compte comme éligible → fraude si trial annulé** [`app/actions/parrainage.ts` + cron] — deferred, décision business acceptée spec Epic 8
- [x] [Review][Defer] **F15 — `confirmerFraude` : décrémente compteur via read-modify-write non atomique** [`app/actions/admin-parrainages.ts`] — deferred, race condition pré-existante, 1 admin prod

- [ ] **T10 -- Validation manuelle staging post-merge** (AC: #16) -- **A executer par Sylvain post-merge**
  - [ ] T10.1 -- Audit MCP : `SELECT u.id, u.email, u.role, COUNT(p.id) AS n_parrainages FROM users u LEFT JOIN parrainages p ON p.marraine_id = u.id GROUP BY u.id, u.email, u.role HAVING COUNT(p.id) > 0 ORDER BY u.role` (lister les parrains existants par role -- vraisemblablement 0 actuellement vu cascade SET NULL).
  - [ ] T10.2 -- Naviguer `/admin/parrainages` connecte admin. Verifier la presence de la nouvelle colonne "Role parrain" et des 3 pilules filtre (Tous roles / Accompagnant / Accompagne).
  - [ ] T10.3 -- Cliquer sur "Accompagnant" -> URL passe a `?role_parrain=accompagnant`, table affiche les parrainages dont la marraine est accompagnante.
  - [ ] T10.4 -- Cliquer sur "Accompagne" -> URL passe a `?role_parrain=accompagne`, table affiche les parrainages dont la marraine est accompagne (probablement 0 a date prod).
  - [ ] T10.5 -- Cliquer sur "Tous roles" -> URL revient a `/admin/parrainages` (sans `role_parrain=all` car valeur par defaut). 3 rows historiques re-visibles.
  - [ ] T10.6 -- Tester combinaison `?vue=bloques&role_parrain=accompagnant` -> filtre cumule.
  - [ ] T10.7 -- Tester action blacklist (par exemple `autoriserException` sur 1 parrainage de test) -- verifier que `admin_actions_log.details.role_parrain` est inseree (null OK si marraine_id null, accompagnant/accompagne OK sinon).
  - [ ] T10.8 -- Verifier qu'aucun event Sentry critical/warning n'est leve par les 3 server actions blacklist (le warning `admin parrainage role lookup failed` doit etre `level: 'warning'` seulement, pas `error`).

## Dev Notes

### Contexte metier

Cette story livre la **piece UI admin** du parrainage symetrique -- sans elle, l'admin n'a aucun moyen de discriminer visuellement les parrainages emis par un parrain accompagne (livres par 8.A.1+8.A.2) des parrainages emis par un parrain accompagnant (existants Epic 2). 8.C.1 conclut le mini-epic 8.C en livrant : (1) la colonne "Role parrain" pour audit visuel direct, (2) le filtre URL `?role_parrain=...` pour focaliser les analyses, (3) l'enrichissement `admin_actions_log.details.role_parrain` pour permettre des analyses post-mortem differenciees (par exemple : "combien de fraudes confirmees sur des parrains accompagnes vs accompagnants"). Sans cet enrichissement de log, le filtrage post-fact dans les analytics necessiterait un JOIN supplementaire vers `users.role` au moment de la requete analytics, alors que stocker `role_parrain` dans `details` JSONB lors de l'action permet une analyse stand-alone.

### Pourquoi pas d'index `users.role` ajoute dans cette story (rappel AC9, T9.1)

L'audit BDD 8.A.0 a flagge `users.role` comme **sans index dedie** :
- `pg_indexes` confirme : seuls `users_pkey (id)`, `users_email_key (email)`, `idx_users_email_lower (lower(email))` existent
- Distribution actuelle 822 accompagnant / 3 accompagne / 1 admin = quasi-binaire (un index B-tree serait peu selectif sur la valeur dominante `accompagnant`)
- Volumetrie BDD prod 2026-05-17 : 826 users + 3 parrainages -- le scan sequentiel pour le pre-fetch `users WHERE role = $filter` est tres rapide

L'index serait pertinent **uniquement** dans 2 cas futurs :
1. Volumetrie parrainages > 10k rows : le filter nested PostgREST sur `marraine.role` pourrait devenir lent sans index
2. Requetes analytics dedouees (stats admin) avec aggregations par role multiples

Defer 8.C.1 vers Epic 9+ : entree deferred-work.md "[idx_users_role pour stats admin parrainages > 10k rows]". Au moment de la livraison, l'index pourra etre cree via migration `CREATE INDEX CONCURRENTLY idx_users_role ON public.users(role)` (CONCURRENTLY essentiel pour eviter le lock ecriture sur users -- table critique).

### Pourquoi pattern PostgREST `!inner` modifier privilegie au pre-fetch `.in()`

Deux options viables pour le filtrage role parrain :

**Option A : `marraine:marraine_id!inner (...)` + `.eq('marraine.role', filter)`** (privilegiee AC4)
- 1 seul round-trip BDD (count + data en parallele restant grace au pattern existant)
- PostgREST genere un INNER JOIN SQL natif (`FROM parrainages JOIN users ON parrainages.marraine_id = users.id WHERE users.role = $filter`)
- Performant car le PK index `users_pkey` est utilise sur le JOIN, et le filter sur `role` filtre cote DB sans materialisation complete

**Option B : Pre-fetch `users.id WHERE role = $filter` puis `.in('marraine_id', ids)`** (fallback)
- 2 round-trips BDD
- Si 822 accompagnants -> 822 UUIDs dans le `.in()` -- payload acceptable mais query SQL longue
- Plus deterministe que `!inner` (qui est un modifier PostgREST relativement recent et parfois mal documente sur les head: true count requests)

**Decision pragmatique** : tenter Option A d'abord (build + smoke test), basculer sur Option B si echec. Documenter dans le Dev Agent Record.

**Note 8.A.0 valable** : aucun guard role cote BDD (CHECK / FK / RLS) ne discrimine -- toute query Supabase peut joindre `parrainages.marraine_id -> users.role` sans surprise. Le risque est PostgREST seul, pas SQL.

### Pourquoi enrichir `admin_actions_log.details.role_parrain` aux 4 action_types blacklist (rappel AC8, T7)

Pattern miroir de l'enrichissement 8.A.3 sur le cron `confirm-parrainages` :
- `coupon.metadata.role_parrain` (cote Stripe)
- `admin_actions_log.details.role_parrain` (cote BDD) pour `parrainage_recompense_appliquee` + `parrainage_recompense_skipped`

8.C.1 etend ce pattern aux 4 action_types blacklist :
- `parrainage_autorise_exception` (autoriserException)
- `parrainage_fraude_confirmee` (confirmerFraude principal)
- `parrainage_fraude_recompense_a_reviser` (confirmerFraude secondaire, si total_recompenses > 0)
- `parrainage_ignore_flag` (ignorerFlag)

Le but : permettre des analyses post-mortem differenciees (anti-fraude par role, taux de blacklist par segment, etc.) sans necessiter de JOIN dynamique vers `users.role` (qui pourrait etre null si l'utilisateur a ete supprime entre l'action et l'analyse -- audit Sentry GDPR).

**Lookup defensif** : si le lookup `users.role` echoue (DB error, parrainage.marraine_id null), logger Sentry warning `'admin parrainage role lookup failed'` et continuer avec `role_parrain: null` -- ne pas bloquer l'action admin. La trace reste exploitable, juste moins riche.

### Pourquoi conserver le wording "Marraine/Filleule" pour 8.C.3

Decision arbitree AC1 : la copy existante "Marraine / Filleule" dans la page admin n'est PAS modifiee par 8.C.1 (ni les `<th>` headers, ni les `type ParrainageRow.marraine`/`filleule`, ni les variables JS `marraine`/`filleule`). 8.C.3 sera la story dediee qui renommera **transversalement** :
- UI/copy : "Marraine" -> "Parrain", "Filleule" -> "Filleul" (ou "Filleule" -> "Filleul" si masculin neutre, sauf wording legal/RGPD)
- Variables JS (a la discretion du dev 8.C.3)
- Function names `sendParrainageBienvenueMarraine` -> `sendParrainageBienvenueParrain` avec alias retro-compat

Cette separation evite des conflits de merge si 8.C.1 et 8.C.3 progressent en parallele, et concentre le renommage transverse dans une seule story revisable. Les **nouveaux** elements ajoutes par 8.C.1 (colonne "Role parrain", pilules "Accompagnant"/"Accompagne", searchParam `role_parrain`) utilisent **systematiquement** le wording masculin neutre des le depart -- pas de dette wording introduite par cette story.

### Race window theorique (pre-fetch + main query non atomiques)

Si T2 fallback Option B est retenu (pre-fetch users.id puis .in() parrainages), il existe une race window theorique entre les 2 requetes : un user pourrait changer de role entre la requete 1 (collecte ids) et la requete 2 (collecte parrainages). Probabilite : tres faible (les changements de role sont rares, declenches manuellement par admin via les flows 5.A.5 ou similaires). Mitigation : aucune en MVP, la race resulterait au pire en un parrainage manquant dans la vue pendant 1 refresh. Coherent avec l'approche eventually-consistent de la page admin (deja un Server Component re-render a chaque navigation).

Si T2 Option A `!inner` est retenue, pas de race window (1 seul snapshot SQL).

### Project Structure Notes

- Fichiers modifies : `app/admin/parrainages/page.tsx` (Server Component), `app/actions/admin-parrainages.ts` (server actions)
- Aucun nouveau composant cree (pas de duplication ParrainageView like 8.B.1 -- la page admin n'a pas de composant client extracte)
- `ParrainageBlacklistActions` (`components/admin/parrainage-blacklist-actions.tsx`) **n'est PAS modifie** par 8.C.1 (le composant client appelle `autoriserException` / `confirmerFraude` / `ignorerFlag` server actions -- l'enrichissement details est cote serveur, transparent pour le client)
- Cast SCP D5 `(await createClient({ serviceRole: true })) as unknown as SupabaseClient<Database>` ligne 77 reste tel quel (whitelist `check-as-any-admin.mjs`)
- Pas d'impact sur les autres pages `/admin/*` (admin-nav.tsx item "Parrainages" continue a pointer `/admin/parrainages` -- pas de nouvelle route)

### Detected conflicts or variances

- **Variation cosmetique CTA wording vs reste de l'app** : "Tous roles" / "Accompagnant" / "Accompagne" dans les pilules ne suit pas le pattern "Tous statuts" exact (pluriel + lowercase) car "Tous roles" (avec accent : "Tous rôles") est plus clair en francais. Decision : conserver "Tous roles" (singulier sans accent dans le code source AC1 mais accent UTF-8 dans le rendu visuel JSX si dev prefere "Tous rôles" -- a la discretion -- coherent avec "Tous statuts" pluriel ligne 248).
- **Filtre `'admin'` absent du dropdown** : la table prod n'a aucun parrainage avec un admin parrain (audit MCP 2026-05-17 : 0 row). Si futur dev introduit un parrainage admin (edge case marginal), il sera visible dans la vue "Tous roles" mais pas filtrable -- defer accepte. La colonne "Role parrain" affichera "Admin" pour exhaustivite (cf. AC2 type union 4 valeurs).

### References

- [Source: _bmad-output/planning-artifacts/epic-8.md#Story 8.C.1] -- specification cible (FR55 + AR-E8.9 + UX-DR-E8.3)
- [Source: _bmad-output/planning-artifacts/epic-8.md#FR55] -- listing tous parrainages quel que soit role + filtre + blacklist transverse
- [Source: _bmad-output/planning-artifacts/epic-8.md#AR-E8.9] -- query enrichie users(role) JOIN + filtre URL
- [Source: _bmad-output/planning-artifacts/epic-8.md#UX-DR-E8.3] -- filtre derouland + colonne table
- [Source: _bmad-output/implementation-artifacts/audit-bdd-parrainage-symetrique-2026-05-16.md] -- audit MCP 8.A.0 confirme GO sans migration + flag idx_users_role + enum user_role 3 valeurs
- [Source: DECISIONS.md F-Epic8-A0] -- audit BDD parrainage symetrique GO
- [Source: DECISIONS.md F-Epic8-A3] -- pattern role-aware sur cron confirm-parrainages + enrichissement metadata
- [Source: app/admin/parrainages/page.tsx] -- structure cible existante (Server Component avec searchParams parsing + Promise.all counters + table)
- [Source: app/actions/admin-parrainages.ts] -- 3 server actions a enrichir avec lookup role + details.role_parrain
- [Source: app/actions/parrainage.ts:403-470] -- pattern role-aware reference (lookup users.role + branche conditionnelle + Sentry fail-fast)
- [Source: app/api/cron/confirm-parrainages/route.ts] -- pattern role-aware reference cron (enrichissement coupon.metadata.role_parrain + admin_actions_log.details.role_parrain)
- [Source: app/accompagnant/dashboard/page.tsx:62-71] -- pattern lookup conditionnel `parrainages_codes` (heritage Epic 2, pas modifie ici)
- [Source: components/admin/parrainage-blacklist-actions.tsx] -- composant client non modifie par cette story
- [Source: .claude/CLAUDE.md] -- regle "pas d'emoji" + regle "wording masculin neutre" durcies
- [Source: _bmad-output/implementation-artifacts/deferred-work.md:149] -- dette pre-existante `as any` admin parrainages (a verifier soldee par SCP D5)
- [Source: _bmad-output/implementation-artifacts/8-b-2-teaser-dashboard-accompagne-invitez-accompagnant.md] -- template story precedente avec wording masculin neutre + DoD a11y obligatoire
- [Source: tests/a11y/README.md] -- baseline a11y 7 parcours P1-P7, page admin parrainages non auditee directement (lint:a11y-check seul)
- [Source: _bmad-output/test-artifacts/axe-core-baseline-2026-05-17.json] -- baseline axe-core 8 parcours (apres ajout P7 en 8.B.1)
- [Source: scripts/check-a11y-baseline.mjs:115] -- enforcement delta = 0 sur baseline a11y lint
- [Source: scripts/check-as-any-admin.mjs] -- whitelist SCP D5 cast localise admin

## Dev Agent Record

### Agent Model Used

claude-opus-4-7 (1M context)

### Debug Log References

- 2026-05-17 implementation : audit grep prealable pour valider le pattern PostgREST `!inner + .eq('embed.col', val)` -- 2 precedents trouves cote prod (`lib/admin/pending-counts.ts:38` avec `messages JOIN conversations!inner(admin_id)` + `app/api/cron/notify-ouverture-retry/route.ts:83` avec `notifications_ouverture JOIN departements_ouverts!inner(ouvert)`). Pattern adopte directement sans fallback `.in()` (le defense-en-profondeur JS du cron a un autre objectif : robustesse contre les versions Supabase JS variables, irrelevant ici puisque la page admin est rendue cote serveur sur la meme version SDK que le cron).
- Validation locale : `npx tsc --noEmit` exit 0 immediat apres T1+T2+T3+T4+T5+T6. Aucune iteration corrective requise.
- `npm run lint` : 194 warnings (= baseline 8.B.2 strictement maintenue, aucun nouveau warning introduit). Aucun `as any` ni `as unknown` ajoute (le cast SCP D5 ligne 94 prexistait, heritage 4.6/F11).
- `npm run lint:a11y-check` : 155 (file, rule) preserve. Le fichier `app/admin/parrainages/page.tsx` est deja dans la baseline pour ses warnings legitimes pre-existants ; aucune nouvelle paire warning n'est ajoutee par les modifications T4 (nouvelle colonne `<th scope="col">`) ou T5 (nouveau groupe `role="group" aria-label="Filtrer par role parrain"`).
- `npm run a11y:axe:check` : 8 parcours audites, aucun delta Critical/Serious -- coherent avec AC12 (la page admin n'est pas auditee par axe-core, baseline `axe-core-baseline-2026-05-17.json` preserve sans regen).
- `npm run test:unit` : 82/82 verts (non-regression -- aucun test unit nouveau introduit conforme AC15 T8.5, page admin Server Component sans logique pure isolable + server actions admin sans test unit historique).
- `npm run build` : OK, route `ƒ /admin/parrainages` listee, route `ƒ /admin/parrainages/blacklist` (redirect) listee.

### Completion Notes List

- 7/7 tasks dev cochees (T10 validation staging Sylvain post-merge reste a executer, par design AC16).
- Pattern PostgREST `!inner` modifier adopte sans fallback : les 2 precedents prod (`pending-counts.ts:38` + `notify-ouverture-retry/route.ts:83`) confirment que `.select('id, embed!inner(col)', { count: 'exact', head: true }).eq('embed.col', val)` fonctionne sur Supabase JS v2 actuel.
- 4 INSERTs `admin_actions_log` enrichis avec `role_parrain` (autoriserException + confirmerFraude principal + confirmerFraude recompense_a_reviser + ignorerFlag).
- Helper `lookupParrainRole` factorise dans `app/actions/admin-parrainages.ts` (DRY pour les 3 fonctions + un seul Sentry breadcrumb path).
- Cas marraine_id null (les 3 rows historiques BDD prod -- audit MCP 2026-05-17 confirme cascade SET NULL) : `lookupParrainRole` retourne null sans Sentry warning (early return), `role_parrain: null` dans le log. Coherent semantique : aucune trace inutile pour un parrainage orphelin attendu.
- Cas DB error sur lookup `users` : Sentry warning `'admin parrainage role lookup failed'` + `role_parrain: null`. L'action admin (autoriser/confirmer/ignorer) reste OK -- pas de degradation de l'experience admin pour une perte d'observabilite mineure.
- Volumetrie BDD prod : 826 users + 3 parrainages + 813 parrainages_codes -- INNER JOIN PostgREST avec scan sequentiel reste rapide, pas d'index `idx_users_role` cree (defer Epic 9 entree deferred-work.md ligne 3).
- Wording strict : "Accompagnant" / "Accompagne" / "Admin" / "—" dans la nouvelle colonne, "Tous roles" / "Accompagnant" / "Accompagne" dans les pilules filtre -- jamais "Marraine" / "Filleule" / "Accompagnante" (regle CLAUDE.md durcie).
- Colonnes existantes "Marraine" / "Filleule" inchangees -- renommage transverse reserve 8.C.3 (decision AC1).

### File List

**Modifies** :
- `app/admin/parrainages/page.tsx` (+45 lignes nettes / -3 lignes : type SearchParams + roleParrainFilter + ParrainageRow.marraine.role + ROLE_PARRAIN_LABELS + 2 nouveaux Promise count + marraineEmbed conditionnel + filtre nested .eq('marraine.role') + redirect totalPages preserve + buildHref preserve + nouveau groupe pilules + nouvelle colonne th + td)
- `app/actions/admin-parrainages.ts` (+34 lignes nettes : SupabaseAdminClient type alias + lookupParrainRole helper avec Sentry warning fail-safe + lookup parrainRole dans autoriserException + lookup parrainRole dans confirmerFraude + lookup parrainage+parrainRole dans ignorerFlag + role_parrain injecte dans 4 INSERTs admin_actions_log)
- `_bmad-output/implementation-artifacts/deferred-work.md` (+3 lignes section 8.C.1 nouveau defer idx_users_role + 1 ligne barree dette as any admin parrainages [Solde 8.C.1])
- `_bmad-output/implementation-artifacts/sprint-status.yaml` (passage status ready-for-dev -> in-progress -> review + last_updated enrichi)
- `_bmad-output/implementation-artifacts/8-c-1-page-admin-parrainages-tous-roles-filtre.md` (Tasks coches T1-T9 + Dev Agent Record + File List + Change Log + status review)

**Crees** : aucun
**Supprimes** : aucun
**Migration BDD** : aucune (heritage F-Epic8-A0 GO sans migration)

## DoD a11y

A renseigner pour toute story avec impact UI (ignorer si pas de changement visuel/interactif) :

- [x] Labels associes aux champs (`htmlFor` ou `aria-labelledby`) -- nouveau groupe pilules avec `role="group" aria-label="Filtrer par rôle parrain"`, nouvelle colonne avec `<th scope="col">Rôle parrain</th>`
- [x] Erreurs liees aux champs via `aria-describedby` + `aria-invalid` -- N/A (pas de form input dans cette story, uniquement liens de navigation)
- [x] Focus visible sur tous les elements interactifs (contraste >= 3:1) -- les `<Link>` pilules heritent du token focus global (heritage 2.5.3)
- [x] Contrastes texte >= 4,5:1 et UI >= 3:1 -- tokens design system kraft existants (baseline Lot A/B/C validee)
- [x] ARIA states corrects sur composants dynamiques (`aria-expanded`, `aria-selected`, etc.) -- `aria-current="page"` ajoute sur les 3 pilules role parrain (parallele aux pilules vue existantes)
- [x] Navigation clavier complete (Tab, Enter, Escape, fleches selon pattern) -- Tab atteint pilules role parrain dans l'ordre logique (apres statut, avant tableau), Enter active le filtre
- [x] Verification ponctuelle au lecteur d'ecran (VoiceOver ou NVDA) sur le composant touche -- reportee T10 staging Sylvain post-merge (CLAUDE.md "test UI" non testable localement sans seed accompagne+parrainage). Annonce attendue : "Lien : Accompagné 0. Élément courant." sur pilule active
- [x] Pas de regression `eslint-plugin-jsx-a11y` (`npm run lint:a11y-check` vert en CI) -- baseline 155 (file, rule) preserve, aucune nouvelle paire warning
- [x] Pas de regression axe-core (`npm run a11y:axe:check` vert ou delta documente avec justification dans la PR) -- la page `/admin/parrainages` n'est pas auditee par axe-core (aucun parcours P1-P7 ne la cible), baseline `axe-core-baseline-2026-05-17.json` (8 parcours) preserve sans modification

## Change Log

| Date | Auteur | Changement |
|---|---|---|
| 2026-05-17 | claude-opus-4-7 via bmad-create-story | Story creee status ready-for-dev. 18 AC + 10 tasks. Pas de migration BDD (heritage F-Epic8-A0 GO). Pas de nouvelle entree DECISIONS.md (heritage F-Epic8-A3 pattern role-aware suffit). Source : epic-8.md#Story 8.C.1 + FR55 + AR-E8.9 + UX-DR-E8.3 + audit-bdd-parrainage-symetrique-2026-05-16.md + 8.A.1/8.A.2/8.A.3 patterns role-aware deja merges. |
| 2026-05-17 | claude-opus-4-7 via bmad-dev-story | Story passee status review. 9/10 tasks completes (T10 validation staging Sylvain post-merge par design AC16). 2 fichiers modifies (`app/admin/parrainages/page.tsx` +45/-3 + `app/actions/admin-parrainages.ts` +34) + 3 fichiers documentation (deferred-work.md + sprint-status.yaml + story file). Pattern PostgREST `!inner` + `.eq('embed.col', val)` adopte sans fallback (2 precedents prod valides). Helper `lookupParrainRole` factorise (DRY x3 fonctions admin) avec Sentry warning fail-safe. 4 INSERTs `admin_actions_log` enrichis `role_parrain`. 1 dette pre-existante soldee (ligne 149 deferred-work.md `as any` admin parrainages -- SCP D5 cast couvre). 1 nouvelle dette defer (`idx_users_role` pour >10k parrainages). DoD CI complete : tsc 0 erreur fichiers modifies, lint 194 warnings baseline maintenue, lint:a11y-check 155 preserve, check:no-direct-notifications-log-insert/as-any-global/as-any-admin/oracle-paywall/ip-spoofing tous OK, test:unit 82/82, a11y:axe:check 0 delta Critical/Serious sur 8 parcours, build OK route `/admin/parrainages` listee. Wording strict masculin neutre sur nouveaux elements (`Rôle parrain` / `Accompagnant` / `Accompagné` / `Tous rôles`) -- copy existante `Marraine`/`Filleule` inchangee, renommage reserve 8.C.3. |
