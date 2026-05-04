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
