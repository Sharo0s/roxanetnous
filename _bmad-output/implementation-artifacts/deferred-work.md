# Deferred Work

## Deferred from: code review of 2-1-validation-automatique-filleule (2026-04-28)

- Quota marraine illimité (parrainages × N infini) [app/actions/parrainage.ts] — reporté Story 2.2 (compteur récompense + plafond éventuel)
- Pas de contrainte CHECK sur format `code` en base [migration:9-16] — robustesse uniquement, pas de bug actuel car `normalizeCode` est single-source
- Asymétrie FK : `parrainages.marraine_id ON DELETE CASCADE` vs `parrainages.filleule_id ON DELETE SET NULL` — si la marraine supprime son compte entre l'inscription et le paiement de la filleule, la filleule reste en limbo (`parrainee_par` non null mais relation parrainage disparue) → à documenter Story 2.3
- `admin_actions_log.admin_id` accepte NULL sans contrainte CHECK qui restreint cela à `action_type = 'validation_par_parrainage'` — accepté pour MVP, à doc opérationnelle
- Pas de fallback webhook si la filleule paie mais ne revient jamais sur `/accompagnante/abonnement/success` (onglet fermé, retour navigateur, paiement asynchrone SEPA) — reporté Story 2.2 (webhook dédié), mais le risque opérationnel concret doit être mentionné dans `TODO-LAUNCH.md` pour la phase de tests preview
- Header `x-forwarded-for` non sanitizé : potentiel spoof si l'app n'est pas systématiquement derrière un reverse proxy de confiance [app/actions/auth.ts:88-96] — Vercel sanitize en prod, à doc Story 2.3 anti-fraude
- Step parrainage du `RegisterForm` non visité si l'utilisateur arrive avec un `email` déjà pré-rempli via URL [components/auth/register-form.tsx:73-77] — UX rare, fix sans gain immédiat
- Race au signup rapide : deux inscriptions simultanées avec le même code valide (pas de UNIQUE `(filleule_id)` sur `parrainages`) — Story 2.3 blacklist couvrira partiellement
- `users.single()` dans `onboarding/page.tsx` peut théoriquement crash si la création de la ligne `users` par `handle_new_user` n'a pas encore eu lieu pour un user fraîchement créé — `handle_new_user` est synchrone Postgres, cas non reproductible mais à surveiller

## Deferred from: code review of 2-2-ui-parrainage-card-et-fingerprint-stripe (2026-04-28)

- Marraine `valide` sans row `parrainages_codes` (échec retry x3 ou backfill rétroactif manquant) [app/accompagnante/dashboard/page.tsx:37-45] — la card disparaît silencieusement, pas de fallback "Générer mon code". À traiter dans le ticket de backfill rétroactif déjà listé en Dette technique de la Story 2.2.
- `navigator.clipboard.writeText` rejet silencieux sans fallback visible [components/accompagnante/parrainage-card.tsx:16-22] — accepté par Dev Notes (« UX gracefully dégradée acceptable »). À reconsidérer si retours utilisateurs.

## Deferred from: implementation of 2-3-blacklist-admin-anti-fraude (2026-04-28)

- Détection `meme_telephone` non implémentée : `users.phone_hash` n'est jamais peuplé par le code applicatif et `users.phone` n'est pas demandé au signup (formulaire 4 champs). À traiter quand le téléphone deviendra obligatoire au signup ou via un cron quotidien qui re-évalue les parrainages ouverts en croisant `users.phone`.
- Suspension automatique de la marraine en cas de fraude confirmée non implémentée : décision MVP pour éviter les faux positifs (la filleule peut avoir tenté une fraude unilatérale). L'admin tranche manuellement via la page utilisateurs.
- Normalisation avancée d'adresse (gestion accents, géocodage, abréviations rue/avenue/bd) : V2 anti-fraude. MVP : comparaison littérale + flag pour revue admin suffisant.
- Masque /24 ou géolocation IP non implémenté : MVP : comparaison littérale `ip_inscription`. Cas IP partagée (NAT, opérateur mobile) = faux positif acceptable côté flag (l'admin tranche).
- Cron de re-évaluation périodique des parrainages ouverts (rattrapage signaux différés type changement de carte ou modif adresse profil) non implémenté : webhook capture déjà les signaux post-paiement. Cas marginaux non couverts.
- Backfill historique : la détection ne s'applique pas rétroactivement aux parrainages existants pré-Story-2.3. Probablement aucun parrainage en prod à date (table 0 rows).
- Pas de UNIQUE constraint sur `parrainages(filleule_id)` ou `(marraine_id, filleule_id)` : la détection blacklist limite déjà le risque pratique d'une race au signup rapide.

## Deferred from: code review of 2-3-blacklist-admin-anti-fraude (2026-04-28)

- Migration `idx_users_email_lower` / `idx_parrainages_blacklist` sans `CONCURRENTLY` [supabase/migrations/20260428144601_parrainage_blacklist_constraints.sql] — lock écriture sur `users` pendant la création. Volume actuel ~320 users négligeable, à refactorer si la table grossit (>10k rows).
- `normalizeAddress` sans gestion accents [lib/parrainage-detection.ts] — décision MVP documentée Dev Notes (`8 rue Albéric` ≠ `8 rue Alberic`). Faux négatifs assumés.
- `normalizeEmail` sans gestion `+suffix` Gmail / IDN punycode [lib/parrainage-detection.ts] — décision MVP documentée Dev Notes. Faux négatifs assumés.
- Détection IP sans normalisation IPv6/IPv4-mapped (`::ffff:1.2.3.4` vs `1.2.3.4`) [app/actions/parrainage.ts:60-72] — signal flag uniquement, faux négatifs acceptables.
- Stripe `paymentMethods.list` sans pagination (limit 10) [app/api/webhooks/stripe/route.ts:97] — faux négatif si la marraine a >10 cartes attachées (cas marginal).
- Pas de pagination sur `/admin/parrainages/blacklist` [app/admin/parrainages/blacklist/page.tsx] — charge tous les rows blacklistés en mémoire. OK MVP volume faible, à risque si volume grossit.
- `notes` admin sans cap longueur [app/actions/admin-parrainages.ts] — `details: { notes }` jsonb peut grossir. Cap à 5000 chars à ajouter si abus.
- Email admin fallback silencieux sur `RESEND_FROM_EMAIL` [lib/emails.ts:2023-2030] — si `ADMIN_NOTIFICATIONS_EMAIL` non configurée, email part vers l'adresse `from` (no-reply). À documenter ou fail loud plus tard.

## Deferred from: code review of 2-3-blacklist-admin-anti-fraude (2026-05-04)

- `validateCode` exposé sans rate-limit (oracle d'énumération de codes 8 chars) [app/actions/parrainage.ts:255-298] — reconnu dans la spec comme « à traiter séparément ». Combiner avec rate-limit IP global et/ou refondre en route API protégée.
- `console.error` sans alerting/Sentry partout dans les chemins fraude/email/blacklist — dette pré-existante de toute la stack, pas spécifique à 2-3. À traiter de façon transverse (Sentry + alertes côté monitoring).
- Types `as any` dans pages admin [app/admin/parrainages/page.tsx:185, app/admin/parrainages/blacklist/page.tsx:134] — dette TS pré-existante. À typer proprement quand la BDD aura des types Supabase générés stables.
- `escapeHtml` dans `lib/emails.ts` non visible dans le diff — dépendance externe utilisée intensivement, à valider hors review (test XSS dédié sur les templates email).

## Deferred from: code review of 2-5-1-outillage-a11y-baseline-lint (2026-05-04)

- `npm run lint` retourne exit 0 avec 231 warnings (160 a11y + 71 tseslint) -- faux signal "tout clean" en local. Decision tech-spec assumee (mode warn au demarrage), bascule en `error` planifiee post-Lot A complet (toutes les stories 2.5.x livrees).
- `downgradeErrorsToWarn` masque toutes les erreurs ESLint critiques au-dela d'a11y (`no-undef`, `no-unused-vars`, `@typescript-eslint/no-explicit-any`...) -- intentionnel pour bootstrap, a reverser post-Lot A complet.
- `lint:fix` peut modifier `scripts/build-a11y-baseline.mjs` lui-meme (autofix `} catch {}` -> `/* empty */`) -- pollution diff potentielle. Fix : ajouter `scripts/` aux ignores du flat config ou corriger la directive `} catch {}` source.
- `findLatestBaseline()` trie par nom (date ISO) -- un baseline genere avec clock skew futur (CI runner desynchronise) sera selectionne indefiniment, masquant des regressions massives jusqu'a la date reelle. Ajouter une validation `date <= today` dans le wrapper.
- Position de la section "## DoD a11y" dans le template `bmad-create-story` -- placee apres `## Dev Agent Record / ### File List`, descend sous le fold sur stories volumineuses. Risque de DoD oubliee. Deplacer plus haut si necessaire.

## Deferred from: code review of 2-5-4-prefers-reduced-motion (2026-05-05)

- Pas de cleanup des `setTimeout` cascade au unmount [components/landing/hero-carte.tsx:179-185] -- pre-existant avant cette story (la cascade existait deja). Le `setTimeout` outer 1800ms et les inners 150ms*N ne sont pas clear au demontage. Strict Mode peut produire des indices doublons dans `visibleCities`. A traiter dans une story future de hardening hero-carte.
- Toggle reduce -> normal asymetrique sur le path stroke [components/landing/hero-carte.tsx:165-173] -- tolerance acceptable per spec (AC8). Si l'utilisateur arrive avec `reduce` actif puis le desactive, le contour Bretagne reste statique, pas de re-trace. Documente.

## Deferred from: code review of 2-5-5-composant-input-accessible (2026-05-05)

- Violations baseline `label-has-for (1) + label-has-associated-control (1)` sur `register-form.tsx` [components/auth/register-form.tsx:233] -- pre-existantes, viennent d'un autre label orphelin (step `Role` qui groupe des boutons radio non-input « Vous etes »), pas du label `parrainage_code`. Decouvert post-application D2. La spec story Dev Notes ligne 235 attribuait incorrectement les 3 violations au label `parrainage_code`. Reel split : 1 du `parrainage_code` (resorbe par D2) + 2 du step `Role` (ce defer). A traiter dans une story dediee Lot B (refactor des labels groupant des controles non-input via fieldset/legend ou `role="radiogroup"` + `aria-labelledby`).
- Violations baseline `jsx-a11y/no-autofocus x4` sur `register-form.tsx` + `x1` sur `app/login/page.tsx` -- hors scope explicite story 2.5.5 (Dev Notes ligne 235). A traiter Lot B ou story dediee.
- Test manuel VoiceOver `/forgot-password` ET `/register?role=accompagnante` (Task 3 cochee `[ ]`) -- bloqueur pour passage en `done`, hors revue de code statique. A executer par Sylvain avant merge.

## Deferred from: code review of 2-6-1-outillage-axe-core-playwright (2026-05-05)

- Nouveau parcours avec 0 violation passe silencieusement jusqu'a regen manuelle [scripts/check-axe-baseline.mjs:126-135] -- comportement acceptable, le warning explicite suffit, regen baseline = process documente dans tests/a11y/README.md.
- Pas de garde explicite si port 3000 deja occupe en CI [playwright.config.ts:27-28] -- message Playwright standard suffit, audit local pour l'instant. A revoir avec la bascule CI Lot C.
- Webserver timeout 120s peut etre court en CI cold cache [playwright.config.ts:27] -- pas de CI Vercel actuellement pour la suite Playwright, a revoir avec la bascule CI Lot C.
- `PLAYWRIGHT_JSON_OUTPUT_NAME` et `reportFile` hardcodes en sync dans build/check-axe-baseline.mjs [scripts/build-axe-baseline.mjs:44-55] -- pas un bug actuel, latent si refacto. A documenter en commentaire si modification.

## Deferred from: code review of 2-7-1-refactor-main-pages-client (2026-05-06)

- `kraft bg-kraft` redondant repete sur les 2 wrappers `<main>` (`app/register/page.tsx`, `app/accompagnante/onboarding/page.tsx`) -- pre-existant, present avant le refactor sur les composants. Si `kraft` definit deja `background-color`, `bg-kraft` est doublon ou override silencieux. Hors scope story 2.7.1 (refactor structurel `<main>`). A clarifier dans une story de hardening Tailwind.
- `<Suspense>` sans `fallback` dans `app/register/page.tsx` -- pre-existant, hors scope refactor structurel `<main>`. Surface d'ecran blanc theorique pendant l'hydratation cote client (si SSR ne pre-rend pas le formulaire). A traiter si UX percue.
- Skip-link `/accompagnante/onboarding` non couvert par axe-check automatise -- documente dans la spec story 2.7.1 AC7 Note explicite : page hors 7 parcours critiques. Couverture statique uniquement (lint a11y + DOM grep). Decision Lot C de ne pas etendre la suite axe-core a cette page.
- Parite `animate-fade-in` au mount non validee visuellement post-refactor -- risque theorique mineur, React diffing preserve normalement l'identite des nodes (pas de remount lors du changement de wrapper externe `<main>` -> `<div>`). Couvert par DoD a11y manuelle (Sub 2.3, 2.4, 3.3 marquees a executer par l'utilisateur).
- Pas de `.editorconfig` ni `.prettierrc` dans le projet -- la reindentation -2 espaces sur ~200 lignes (`register-form.tsx`) ne sera pas validee par un formatter automatique. Risque d'incoherence si un dev futur lance Prettier avec des defauts differents. A traiter en story d'outillage dev-experience.

## Deferred from: code review of 2-7-6-refactor-main-pages-auth-jumelles (2026-05-06)

Tous ces findings concernent du code **strictement preserve** depuis HEAD (verifie via `git show HEAD:app/{login,forgot-password,reset-password}/page.tsx`). Aucune regression introduite par 2.7.6 — ce sont des dettes anterieures relevees par les reviews adversariales sur le code migre tel quel.

- Enumeration de comptes via `checkEmailExists` (login-form.tsx:25-29) -- le flux distingue publiquement compte existant (step password) vs absent (redirect `/register?email=...`). Contradiction avec la convention `/forgot-password` qui masque l'existence. Securite auth, story dediee.
- `autoFocus` sur input password (login-form.tsx:104) -- pratique a11y discutable (focus deplace sans annonce AT). Accepte en baseline jsx-a11y/no-autofocus, hors scope refactor structurel.
- `formData.set('email', email)` overwrite cote client sans hidden input ni revalidation serveur visible (login-form.tsx:41) -- audit securite a faire dans une story dediee Server Actions.
- Race condition : submit pendant qu'un submit precedent est en cours (3 forms) -- pas de garde `if (loading) return` en debut de handler. Double appel possible si user clique vite ou Enter+clic.
- Server Action throw vs `{error}` non gere (3 forms) -- `await login/resetPassword/updatePassword` sans `try/catch`. Si l'action throw (network, timeout), `loading` reste true, UI gelee.
- `setLoading(false)` manquant apres succes `login()` (login-form.tsx:43-46) -- le code repose sur la redirection serveur pour unmount. Si la redirection echoue silencieusement, bouton reste desactive sans recours.
- setState apres unmount sur navigation pendant submit (3 forms) -- pas de `mountedRef`. Warning React possible, fuite memoire mineure.
- `role="alert"` rendu conditionnel non annonce par certains AT (3 forms) -- le role doit etre present au montage pour annoncer le contenu inseré apres. Conteneur live persistant manquant.
- Region succes non `aria-live`/`role="status"` (forgot-password-form.tsx:36-48, reset-password-form.tsx:36-48) -- les blocs "Email envoye" / "Mot de passe mis a jour" remplacent le formulaire sans annonce auditive.
- Hierarchie de titres cassee : `<p className="font-semibold">` au lieu de `<h2>` pour "Email envoye", "Mot de passe mis a jour", "Reinitialiser votre mot de passe" (forgot/reset). Pas de structure de titres exploitable au lecteur d'ecran.
- Lien "Retour a la connexion" duplique sur forgot-password (forgot-password-form.tsx, 2 occurrences en cas de succes) -- anti-pattern a11y (2 liens identiques meme destination).
- Token reset non verifie cote page (reset-password) -- la page affiche le formulaire sans verifier la presence d'une session reset valide via Supabase. Acces direct URL produit erreur generique au submit. Securite/UX, story dediee.
- Validation client `email.trim()` insuffisante (login-form.tsx:20) -- accepte `"a"`. Pas de regex format avant round-trip serveur. `e.preventDefault()` court-circuite la validation HTML5 native.
- `relative z-10` dead style sur les 3 wrappers `<div className="w-full max-w-md relative z-10">` -- aucun element en `absolute` derriere dans la nouvelle structure. Heritage copier-coller du pre-refactor.
- Refactor manque : 3 composants dupliquent `<div className="text-center mb-8"><Link href="/">roxanetnous</Link>...</div>` + carte blanche + alerte erreur. Opportunite `AuthCard` partage hors scope 2.7.6 (centre sur l'extraction Server/Client, pas sur la factorisation visuelle).
