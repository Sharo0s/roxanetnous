# Story 2.2 : UI ParrainageCard dashboard marraine + capture stripe_fingerprint

Status: done

<!-- Note: Validation est optionnelle. Lancer `validate-create-story` avant `dev-story` pour un contrôle qualité. -->

## Story

En tant qu'**accompagnante validée** (marraine),
je veux **voir mon code de parrainage sur mon dashboard et pouvoir le partager facilement** (copier le code, copier le lien d'invitation pré-rempli),
afin de **diffuser le code à mon réseau professionnel sans devoir aller chercher l'email de bienvenue à chaque fois**, et que la plateforme **capture le fingerprint de la carte au paiement de la filleule** pour préparer la détection anti-fraude (Story 2.3).

## Acceptance Criteria

1. **AC1 — Composant `ParrainageCard` créé**
   `components/accompagnante/parrainage-card.tsx` est un client component (`'use client'`) qui prend en props `{ code: string, baseUrl: string }` et affiche :
   - Un titre « Votre code de parrainage » (h2 ou h3, cohérent avec les autres cards du dashboard, marge inférieure `mb-2`).
   - Le code en grand format (32px, bold, letter-spacing 4px, sans-serif gras) — design noir/blanc cohérent avec `bg-accent/30` (atténué pour lisibilité du bloc plein) / `text-black`.
   - Un bouton **Copier le code** qui copie la valeur brute (8 caractères) dans le presse-papiers via `navigator.clipboard.writeText`. Feedback visuel pendant 2 secondes (texte « Copié ! » ou icône check) puis retour à l'état normal.
   - Un bouton **Copier le lien d'invitation** qui copie la valeur `${NEXT_PUBLIC_BASE_URL}/register?role=accompagnante&parrainage_code=<CODE>` dans le presse-papiers, avec le même feedback visuel 2s.
   - Une phrase explicative courte sous les boutons : « Partagez ce code ou ce lien avec une accompagnante de votre réseau. À son inscription, elle évite la visio et est validée automatiquement dès qu'elle souscrit son abonnement. »
   - **Pas de compteur** (`compteur_confirmes`), **pas de liste des filleules**, **pas de mention "5 parrainages = 6 mois"** (reportés Story 2.4).

2. **AC2 — Intégration dans le dashboard marraine**
   `app/accompagnante/dashboard/page.tsx` (server component) :
   - Charge le code via `supabase.from('parrainages_codes').select('code').eq('user_id', user.id).maybeSingle()` (la marraine peut lire sa propre ligne via la policy RLS `parrainages_codes_owner_read`).
   - Si la marraine est `validation_status === 'valide'` ET que `code` est non null, affiche `<ParrainageCard code={...} />` dans la grille de cards (préférablement avant ou après la card "Mon abonnement"). Sinon, n'affiche rien.
   - Le composant ne casse pas la grille `grid grid-cols-1 md:grid-cols-2` existante (peut s'étaler sur 2 colonnes ou occuper une cellule, au choix UX).

3. **AC3 — Pas de UI ailleurs**
   Aucune autre page (profil, onboarding, etc.) n'affiche le code dans cette story. Reportée à Story 2.4 pour le profil / autres emplacements éventuels.

4. **AC4 — Webhook Stripe capture `stripe_fingerprint`**
   Dans `app/api/webhooks/stripe/route.ts`, dans le case `checkout.session.completed`, **après** la mise à jour de `subscriptions` existante :
   - Si `session.metadata?.parrainage_code` est présent ET `userId` (déjà extrait du metadata) est présent :
     1. Récupérer le `payment_method` via la subscription Stripe (`stripe.subscriptions.retrieve(sub.id)` puis `default_payment_method`, fallback sur `session.payment_method` si `default` absent — Stripe Checkout en mode subscription expose le payment_method via la subscription, pas directement sur la session).
     2. Si un `payment_method_id` est récupéré, faire `stripe.paymentMethods.retrieve(pmId)` et lire `pm.card?.fingerprint`.
     3. Faire un `UPDATE parrainages SET stripe_fingerprint=<fingerprint or null> WHERE code=<parrainage_code> AND filleule_id=<userId>` (pas de filtre statut, car la transition `inscrite → abonnee` est déjà faite côté `confirmParrainageOnSuccess`, AC9 Story 2.1 — on ne veut pas court-circuiter ça).
   - Erreurs Stripe ou Supabase silencieuses (`try/catch`) — ne pas bloquer le flow webhook principal qui doit toujours retourner 200.

5. **AC5 — Idempotence du webhook fingerprint**
   Si le webhook `checkout.session.completed` est rejoué (Stripe garantit at-least-once), le `UPDATE parrainages` doit pouvoir être appliqué plusieurs fois sans effet de bord :
   - L'UPDATE écrase la valeur précédente (acceptable car même fingerprint si même carte).
   - Pas de doublon, pas de log additionnel.

6. **AC6 — Sécurité**
   - Le webhook continue de valider la signature Stripe (`stripe.webhooks.constructEvent`).
   - L'extension AC4 utilise toujours le client `getSupabaseAdmin` (service role) déjà en place dans le webhook — RLS bypass légitime.
   - Aucune donnée sensible (numéro de carte) loggée côté serveur. Seul le `fingerprint` (hash opaque Stripe) est persisté.

7. **AC7 — Tests**
   - `npx tsc --noEmit` : 0 erreur.
   - `npm run build` : succès, toutes routes générées.
   - Test manuel UI : marraine validée voit la card sur son dashboard, les 2 boutons copient effectivement (vérifier `navigator.clipboard` dans la console DevTools ou par paste manuel).
   - Test bout en bout webhook : déclencher un paiement filleule en preview Vercel, vérifier en base `SELECT stripe_fingerprint FROM parrainages WHERE filleule_id=<id>` ; valeur non null.

## Tasks / Subtasks

- [x] **Task 1 — Créer `ParrainageCard` (AC: 1)**
  - [x] Nouveau fichier `components/accompagnante/parrainage-card.tsx` avec `'use client'`.
  - [x] Props : `{ code: string, baseUrl: string }` (baseUrl passée par le server component pour rester explicite, même si `NEXT_PUBLIC_*` serait inlinée au build).
  - [x] Layout cohérent avec les autres cards du dashboard (`bg-white rounded-xl border p-6 md:col-span-2`).
  - [x] 2 boutons avec `useState<'code' | 'link' | null>` pour le feedback "Copié" + `setTimeout(2000)`.
  - [x] try/catch silencieux autour de `navigator.clipboard.writeText` (HTTP non-secure → no-op gracieux).
  - [x] Pas d'emojis. Code en bloc 32px / letter-spacing 4px / `bg-accent/30`.

- [x] **Task 2 — Intégrer dans le dashboard (AC: 2, 3)**
  - [x] `app/accompagnante/dashboard/page.tsx` : import + chargement de `parrainages_codes.code` via le client utilisateur (`maybeSingle`) uniquement si `validation_status === 'valide'`.
  - [x] Affichage de `<ParrainageCard code={parrainageCode} baseUrl={baseUrl} />` uniquement si `parrainageCode` non null, placé dans la grille de cards juste avant "Mon abonnement".
  - [x] `baseUrl = process.env.NEXT_PUBLIC_BASE_URL || ''` passée en prop.
  - [x] Aucune autre page touchée (AC3).

- [x] **Task 3 — Étendre le webhook Stripe (AC: 4, 5, 6)**
  - [x] `app/api/webhooks/stripe/route.ts`, case `checkout.session.completed` : bloc parrainage ajouté **après** l'upsert subscriptions et **avant** l'envoi de l'email de confirmation.
  - [x] Lecture de `subscriptionResponse.default_payment_method` (chaîne ou objet), pas de fallback `session.payment_method` (champ inexistant sur l'API Stripe `2026-03-25.dahlia` côté Session — le default_payment_method de la subscription couvre le mode subscription).
  - [x] `stripe.paymentMethods.retrieve(pmId)` pour lire `pm.card?.fingerprint`. Si pas de payment_method (cas trial), `fingerprint = null`.
  - [x] `UPDATE parrainages SET stripe_fingerprint=... WHERE code=... AND filleule_id=...` via `supabase` (service role déjà actif). Pas de filtre statut.
  - [x] try/catch silencieux englobant tout le bloc — ne casse jamais le 200 du webhook.

- [x] **Task 4 — Vérifications (AC: 7)**
  - [x] `npx tsc --noEmit` : 0 erreur (après suppression du fallback `session.payment_method` non typé).
  - [x] `npm run build` : succès, 40 routes générées.
  - [x] Smoke local : home page HTTP 200, dashboard HTTP 307 → /login (comportement attendu non-auth, pas de crash de rendu).
  - [ ] Test bout en bout webhook : à exécuter en preview Vercel par l'utilisateur (paiement filleule, vérification SQL `stripe_fingerprint`). Hors contrôle agent (signature Stripe).
  - [ ] Test bout en bout UI : connexion en tant que marraine validée, vérifier l'affichage de la card et le copy/paste effectif des deux boutons. Hors contrôle agent (compte marraine validée non disponible en local).

## Dev Notes

### Source d'autorité

**Sprint Change Proposal du 2026-04-18 parrainage** ([Source: _bmad-output/planning-artifacts/sprint-change-proposal-2026-04-18-parrainage.md]) — sections clés pour cette story :
- §4.2.g : extension webhook Stripe (capture fingerprint + transition `abonnee`). **NB** : Story 2.1 a déjà fait la transition `abonnee` côté `confirmParrainageOnSuccess` (AC9), donc l'extension webhook ici ne fait QUE capturer le fingerprint. Pas de double UPDATE statut.
- §4.7.d : composant `parrainage-card.tsx` — **simplifié** dans cette story 2.2 : pas de compteur, pas de liste filleules (reportés Story 2.4).

### Story précédente

[Source: _bmad-output/implementation-artifacts/2-1-validation-automatique-filleule.md] — Story 2.1 a livré :
- Migration appliquée (tables `parrainages_codes`, `parrainages` avec colonne `stripe_fingerprint TEXT NULL`, colonnes `users.parrainee_par`, `accompagnantes_profiles.validation_source`).
- 4 RLS policies actives, dont `parrainages_codes_owner_read` qui permet à la marraine de lire SA ligne avec un client utilisateur (`auth.uid() = user_id`).
- `confirmParrainageOnSuccess` côté success page (AC9) — fait déjà la transition `parrainages.statut='abonnee'`. **Le webhook NE doit PAS refaire cette transition**, seulement ajouter le fingerprint.
- Dette technique reportée à Story 2.2 (cf. table dans Dev Notes story 2.1) : **capture stripe_fingerprint au paiement** (pris ici), compteur et cron J+30 (reportés Story 2.4).
- 24 patches post-revue appliqués, build vert, tsc 0 erreur, tests pure-functions 9/9 PASS.
- Migration corrective `20260428153210_parrainee_par_on_delete_set_null.sql` appliquée.

### Stack et conventions projet

- **Next.js 16** App Router, React 19, TypeScript 6, ESM (`type: module`). [Source: package.json]
- **Supabase SSR** via `@/lib/supabase/server` avec deux modes : anon par défaut, service role via `createClient({ serviceRole: true })`. [Source: lib/supabase/server.ts]
- **Webhook Stripe** existant utilise déjà `getSupabaseAdmin()` (service role direct via `createServerClient`). [Source: app/api/webhooks/stripe/route.ts:7-18]
- **Stripe** via `@/lib/stripe` (instance préconfigurée), API version `2026-03-25.dahlia`. [Source: lib/stripe.ts]
- **Pas d'emojis** dans le code ni les UI (règle stricte projet). [Source: .claude/CLAUDE.md, DECISIONS.md]
- **Design noir et blanc** : pas de classes `green-*`, `blue-*`, `primary-*` non grises. Utiliser `gray-*`, `black`, `white`, `bg-accent`. [Source: DECISIONS.md 2026-02-11]
- **Communication français**, accents complets (`é`, `è`, `à`, etc.). [Source: _bmad/bmm/config.yaml]
- **Cohérence cards dashboard** : `bg-white rounded-xl border p-6` avec `<h3 className="font-semibold text-lg mb-2">` pour le titre, `<p className="text-gray-600 mb-4">` pour le texte, et boutons `inline-flex items-center px-4 py-2 bg-accent text-black rounded-lg btn-hover transition text-sm font-medium`. [Source: app/accompagnante/dashboard/page.tsx:160-242]

### Pattern de copie au presse-papiers

Privilégier `navigator.clipboard.writeText` (HTTPS requis, OK en preview/prod Vercel). En dev local sur `http://localhost:3000`, le secure context est OK pour localhost mais à vérifier. Fallback non requis pour cette story (UX gracefully dégradée acceptable).

```tsx
const [copied, setCopied] = useState<'code' | 'link' | null>(null)
const handleCopy = async (value: string, kind: 'code' | 'link') => {
  try {
    await navigator.clipboard.writeText(value)
    setCopied(kind)
    setTimeout(() => setCopied(null), 2000)
  } catch {
    // silencieux
  }
}
```

### Récupération du payment_method dans le webhook

Stripe Checkout en mode `subscription` n'expose **pas** directement `payment_method` sur la session — il faut passer par la subscription :

```typescript
const subscriptionResponse = await stripe.subscriptions.retrieve(session.subscription as string)
// déjà chargée plus haut dans le webhook (ligne 98)
const pmId = typeof subscriptionResponse.default_payment_method === 'string'
  ? subscriptionResponse.default_payment_method
  : subscriptionResponse.default_payment_method?.id
  || (typeof session.payment_method === 'string' ? session.payment_method : null)
```

Dans le cas trial (`payment_status='no_payment_required'`), le payment_method peut être présent (carte enregistrée pour la fin du trial) ou absent. Si absent, on stocke `null` — ce n'est pas une erreur, juste une donnée manquante pour la blacklist (Story 2.3 devra gérer ce cas).

### Schéma actuel base de données

Table `parrainages` (créée par migration `20260428130104_add_parrainage_feature.sql`) contient déjà :
- `stripe_fingerprint TEXT NULL` (colonne disponible, pas d'écriture pour l'instant)
- `code TEXT NOT NULL` (indexé)
- `filleule_id UUID NULL REFERENCES users(id) ON DELETE SET NULL`

Table `parrainages_codes` :
- `user_id UUID PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE`
- `code TEXT NOT NULL UNIQUE` (indexé)
- `compteur_confirmes INTEGER NOT NULL DEFAULT 0` (pas modifié dans cette story)
- `total_recompenses INTEGER NOT NULL DEFAULT 0` (pas modifié)
- `derniere_recompense_at TIMESTAMPTZ NULL`
- `created_at TIMESTAMPTZ DEFAULT NOW()`

RLS active :
- `parrainages_codes_owner_read` : `auth.uid() = user_id` → la marraine peut lire SA ligne via le client utilisateur (pas besoin de service role pour le dashboard).
- `parrainages_codes_admin_full` : admin total.

### Project Structure Notes

- Components UI : `components/<domain>/<component>.tsx` → `components/accompagnante/parrainage-card.tsx`.
- Webhook unique : `app/api/webhooks/stripe/route.ts` (extension du case `checkout.session.completed` existant).
- `process.env.NEXT_PUBLIC_BASE_URL` est utilisé partout dans le codebase pour construire les URLs (`subscription.ts`, `auth.ts`, etc.) ; OK côté client component (préfixe `NEXT_PUBLIC_`).

### Testing Standards

- Pas de framework de tests automatisés dans le projet (pas de Jest/Vitest/Playwright).
- Tests manuels via `npm run dev` + browser.
- `npx tsc --noEmit` et `npm run build` font office de gate de qualité.
- Pour le webhook : test bout en bout impossible en local (signature Stripe), à exécuter en preview Vercel.

### Dette technique reportée

| Sujet | Reporté à | Pourquoi |
|-------|-----------|----------|
| Compteur `compteur_confirmes` incrémenté à J+30 | Story 2.4 (cycle récompense) | Découplage : valoriser ce qu'on capture ici dans une story dédiée |
| Cron J+30 (`/api/cron/confirm-parrainages`) | Story 2.4 | Idem |
| Coupon Stripe 100% / 6 mois pour la marraine | Story 2.4 | Idem |
| Liste des filleules dans `ParrainageCard` | Story 2.4 | Découplage UI |
| Email `sendParrainageRecompense` | Story 2.4 | Lié au compteur |
| Affichage du code dans `app/accompagnante/profil/page.tsx` | Story 2.4 | Pas critique pour le test bout-en-bout |
| Backfill rétroactif des codes pour les accompagnantes déjà `valide` | Hors story | Migration ou script ad-hoc, à décider |
| Détection blacklist (`detectBlacklist`, page `/admin/parrainages`) | Story 2.3 | Découplage clair |

### References

- [Source: _bmad-output/planning-artifacts/sprint-change-proposal-2026-04-18-parrainage.md#Section-4.2.g] — extension webhook Stripe (capture fingerprint, code prêt à copier ligne 421-448)
- [Source: _bmad-output/planning-artifacts/sprint-change-proposal-2026-04-18-parrainage.md#Section-4.7.d] — composant ParrainageCard (simplifié dans cette story 2.2)
- [Source: _bmad-output/implementation-artifacts/2-1-validation-automatique-filleule.md] — story précédente (références complètes du flow)
- [Source: app/api/webhooks/stripe/route.ts:88-131] — case `checkout.session.completed` à étendre
- [Source: app/accompagnante/dashboard/page.tsx:160-242] — grille de cards à enrichir
- [Source: supabase/migrations/20260428130104_add_parrainage_feature.sql] — schéma `parrainages` + RLS policies
- [Source: app/actions/parrainage.ts] — fonctions parrainage Story 2.1 (référence patterns serveur)
- [Source: DECISIONS.md] — règles design noir/blanc, pas d'emojis
- [Source: .claude/CLAUDE.md] — règles projet (pas d'emojis, ESM, Supabase MCP)

## Dev Agent Record

### Agent Model Used

Claude Opus 4.7 (1M context) — `claude-opus-4-7[1m]`

### Debug Log References

- TSC initial : 2 erreurs `TS2339: Property 'payment_method' does not exist on type 'Session'` sur l'API Stripe `2026-03-25.dahlia`. Fallback supprimé : seul `subscriptionResponse.default_payment_method` est utilisé. Couvre le mode `subscription` (la session Stripe Checkout en mode subscription expose le PM via la subscription, pas la session).
- Smoke local : `npm run dev` → curl /accompagnante/dashboard renvoie HTTP 307 (redirect /login attendu) ; / renvoie HTTP 200. Aucun crash de rendu.
- Test UI marraine et test bout en bout webhook nécessitent un compte marraine validée et la signature Stripe — exécution par l'utilisateur en preview Vercel.

### Completion Notes List

**Périmètre livré** (7/7 ACs côté agent) :
1. AC1 — `ParrainageCard` créé : code 32px / letter-spacing 4px / `bg-accent/30`, deux boutons (Copier le code / Copier le lien d'invitation) avec feedback "Copié" 2s, phrase explicative, design noir/blanc cohérent.
2. AC2 — Intégration dashboard : chargement RLS-friendly (`parrainages_codes_owner_read`), affichage conditionnel (`validation_status === 'valide'` ET `code` non null), placement avant "Mon abonnement" dans la grille (md:col-span-2 pour ne pas casser la grille 2 cols).
3. AC3 — Pas de UI ailleurs (profil, onboarding, autres pages : aucune modification).
4. AC4 — Webhook : capture du `pm.card.fingerprint` via `subscriptionResponse.default_payment_method` après l'upsert subscriptions, `UPDATE parrainages` filtré par `code` ET `filleule_id`. Pas de filtre statut (la transition `inscrite → abonnee` est faite par `confirmParrainageOnSuccess` côté success page Story 2.1, AC9).
5. AC5 — Idempotence : `UPDATE` simple avec écrasement de la même valeur, pas de log additionnel, rejouer le webhook = no-op effectif.
6. AC6 — Sécurité : signature Stripe toujours validée en amont (intacte), service role `getSupabaseAdmin()` réutilisé, seul le `fingerprint` (hash opaque Stripe) persisté.
7. AC7 — `npx tsc --noEmit` 0 erreur, `npm run build` succès (40 routes), smoke local OK.

**Choix techniques** :
- `baseUrl` passée en prop au lieu de `process.env.NEXT_PUBLIC_BASE_URL` directement dans le client component : sémantiquement plus propre (le composant ne dépend pas implicitement de l'env var) et facilite un éventuel test isolé.
- `try/catch` silencieux englobant **tout** le bloc parrainage du webhook (lecture default_payment_method, retrieve PM, UPDATE Supabase) — alignement strict avec AC4 « Erreurs Stripe ou Supabase silencieuses ».
- `default_payment_method` peut être absent (ex: trial sans carte enregistrée). Le code stocke alors `null` — comportement attendu pour la blacklist (Story 2.3 gérera le cas).
- Pas de `useEffect` de fetch côté client : tout est SSR via le server component dashboard.

**Tests à exécuter par l'utilisateur en preview Vercel** :
- Connexion comme marraine validée → la card apparaît avec le code, les 2 boutons copient effectivement (vérifier paste manuel ou DevTools).
- Lien d'invitation : copier-coller dans un autre onglet → /register doit pré-remplir le code dans le step parrainage (logique Story 2.1 déjà en place).
- Paiement filleule en mode test Stripe → vérifier en BDD :
  ```sql
  SELECT code, filleule_id, statut, stripe_fingerprint FROM parrainages WHERE filleule_id = '<id>';
  ```
  La colonne `stripe_fingerprint` doit être renseignée (sauf cas trial sans carte → null acceptable).
- Test idempotence : redéclencher le webhook depuis le dashboard Stripe → la valeur reste identique, pas de duplication.

**Dette technique reportée (inchangée par rapport à la story)** :
- Compteur `compteur_confirmes` + cron J+30 + coupon 6 mois + email récompense + liste filleules → Story 2.4.
- Affichage du code sur `/accompagnante/profil` → Story 2.4.
- Backfill rétroactif des codes pour accompagnantes déjà `valide` → décision hors story (script ou UI admin).
- Détection blacklist (`detectBlacklist`, page `/admin/parrainages`) → Story 2.3 (le `stripe_fingerprint` capturé ici est l'input de cette future détection).

### File List

**Composant (1 nouveau)** :
- `components/accompagnante/parrainage-card.tsx`

**Pages / actions (2 modifiés)** :
- `app/accompagnante/dashboard/page.tsx` (import + chargement `parrainages_codes` + affichage conditionnel)
- `app/api/webhooks/stripe/route.ts` (capture `stripe_fingerprint` dans le case `checkout.session.completed`)

## Change Log

| Date | Auteur | Changement |
|------|--------|-----------|
| 2026-04-28 | Claude Opus 4.7 (1M) via bmad-create-story | Création de la story 2.2 — périmètre A+B (UI ParrainageCard simplifiée + capture stripe_fingerprint webhook). Cycle récompense (compteur, cron J+30, coupon, liste filleules) reporté à Story 2.4. |
| 2026-04-28 | Claude Opus 4.7 (1M) via bmad-dev-story | Implémentation Story 2.2 : ParrainageCard + intégration dashboard + extension webhook capture fingerprint. tsc 0 erreur, build vert (40 routes). Tests UI/webhook bout en bout à exécuter en preview Vercel. Statut → review. |
| 2026-04-28 | Claude Opus 4.7 (1M) via bmad-code-review | Revue adversariale (Blind Hunter + Edge Case Hunter + Acceptance Auditor). 16 findings retenus (5 dismissed). 4 decision-needed (capture fingerprint en mode trial, scoping UPDATE par statut, opacité bg-accent), 9 patches actionnables, 2 defer. Voir section Review Findings. |
| 2026-04-28 | Claude Opus 4.7 (1M) via bmad-code-review (post-decisions) | 12 patches appliqués : fallback `session.setup_intent` + handler `customer.subscription.updated` pour rattrapage trial (helper `captureParrainageFingerprint`), UPDATE scopé `statut='inscrite' AND stripe_fingerprint IS NULL`, court-circuit, normalisation code, telemetry `console.error`, `revalidatePath` dashboard, propagation metadata `subscription_data`, fallback BASE_URL, `useRef`/cleanup setTimeout, `encodeURIComponent`, h3 `mb-2`, Unicode JSX. AC1 amendé. tsc 0 erreur, build vert (40 routes). Statut → done. |

### File List (mise à jour post-revue)

**Composant (1 nouveau)** :
- `components/accompagnante/parrainage-card.tsx`

**Pages / actions (4 modifiés)** :
- `app/accompagnante/dashboard/page.tsx`
- `app/api/webhooks/stripe/route.ts`
- `app/actions/parrainage.ts` (revalidatePath ajouté)
- `app/actions/subscription.ts` (propagation metadata via `subscription_data`)

## Review Findings

### Decision-needed (résolues)

- [x] [Review][Decision] **Trial 30j : `default_payment_method` souvent NULL → fingerprint jamais capturé** — Résolue 2026-04-28 : option (b) — fallback `session.setup_intent` PLUS handler `customer.subscription.updated` pour rattrapage post-trial. Devient patch.
- [x] [Review][Decision] **Pas de handler `customer.subscription.updated` / `setup_intent.succeeded` pour rattraper le fingerprint** — Résolue 2026-04-28 : absorbée dans le patch ci-dessus.
- [x] [Review][Decision] **UPDATE non scopé par statut/fingerprint NULL → réécriture en cas de changement de carte** — Résolue 2026-04-28 : option (a) — préserver le fingerprint d'inscription via `WHERE stripe_fingerprint IS NULL`. Devient patch.
- [x] [Review][Decision] **`bg-accent/30` au lieu de `bg-accent`** — Résolue 2026-04-28 : option (a) — conserver `/30` (choix UX assumé pour lisibilité du bloc 32px), AC1 à amender pour refléter l'atténuation.

### Patch (tous appliqués 2026-04-28)

- [x] [Review][Patch] **Filtre statut + WHERE stripe_fingerprint IS NULL sur l'UPDATE** [`app/api/webhooks/stripe/route.ts`] — UPDATE désormais scopé par `.eq('statut', 'inscrite').is('stripe_fingerprint', null)`. Préserve le fingerprint d'inscription, idempotent par construction, immunise contre les rows `fraude`/`bloque` coexistantes. Couvre simultanément la decision-needed sur scoping.

- [x] [Review][Patch] **`console.error` dans le `catch`** [`app/api/webhooks/stripe/route.ts`] — Logs `[parrainage_fingerprint][checkout]` et `[parrainage_fingerprint][subscription_updated]` ajoutés pour traçabilité Vercel.

- [x] [Review][Patch] **Fallback `NEXT_PUBLIC_BASE_URL || 'https://roxanetnous.fr'`** [`app/accompagnante/dashboard/page.tsx:46`] — Aligné sur la convention du codebase.

- [x] [Review][Patch] **Court-circuit si `stripe_fingerprint` déjà non-null** [`app/api/webhooks/stripe/route.ts`] — SELECT préalable avec filtre `is('stripe_fingerprint', null)` ; les appels Stripe ne sont faits que si nécessaire.

- [x] [Review][Patch] **Normalisation de `parrainage_code` côté webhook** [`app/api/webhooks/stripe/route.ts`] — Helper `normalizeParrainageCode()` aligné sur `normalizeCode` (uppercase + suppression espaces/tirets).

- [x] [Review][Patch] **`revalidatePath('/accompagnante/dashboard')` dans `confirmParrainageOnSuccess`** [`app/actions/parrainage.ts`] — Ajouté avant le `return { ok: true }`.

- [x] [Review][Patch] **`setTimeout` clearé via `useRef` + cleanup** [`components/accompagnante/parrainage-card.tsx`] — Race double-click éliminée, cleanup `useEffect` au démontage.

- [x] [Review][Patch] **`encodeURIComponent(code)` dans le lien d'invitation** [`components/accompagnante/parrainage-card.tsx`].

- [x] [Review][Patch] **h3 `mb-2`** [`components/accompagnante/parrainage-card.tsx`] — Cohérence avec convention dashboard.

- [x] [Review][Patch] **Entités HTML → Unicode dans le JSX** [`components/accompagnante/parrainage-card.tsx`] — `&rsquo;`/`&eacute;`/`&Agrave;` remplacés par `’`/`é`/`À` directement.

- [x] [Review][Patch] **Fallback `session.setup_intent.payment_method` + handler `customer.subscription.updated`** [`app/api/webhooks/stripe/route.ts` + `app/actions/subscription.ts`] — Gère le cas trial où `default_payment_method` est null au moment du `checkout.session.completed`. Helper extrait `captureParrainageFingerprint(supabase, subscription)` appelé à la fois sur checkout (avec fallback setup_intent) et sur subscription.updated (rattrapage post-trial). Metadata propagée au niveau subscription via `subscription_data: { metadata }` pour rester accessible aux handlers ultérieurs.

- [x] [Review][Patch] **AC1 amendé pour refléter `bg-accent/30`** — choix UX assumé pour lisibilité du bloc 32px.

### Defer

- [x] [Review][Defer] **Marraine `valide` sans row `parrainages_codes`** [`app/accompagnante/dashboard/page.tsx:37-45`] — deferred, pré-existant : si les 3 retries de génération de code échouent (`app/actions/parrainage.ts:113-134`) ou si la marraine a été validée AVANT le déploiement de la migration parrainage (backfill rétroactif déjà listé hors story), la card disparaît silencieusement. Pas de fallback "Générer mon code". À traiter dans le ticket de backfill listé en Dette technique reportée.

- [x] [Review][Defer] **`navigator.clipboard.writeText` rejet silencieux sans fallback visible** [`components/accompagnante/parrainage-card.tsx:16-22`] — deferred, accepté par spec : Dev Notes mentionnent « Fallback non requis pour cette story (UX gracefully dégradée acceptable) ». À reconsidérer si retours utilisateurs.

### Dismissed (non écrits ailleurs, archivés ici pour traçabilité)

- AC6 service role pour UPDATE — vérifié : `app/api/webhooks/stripe/route.ts:85` utilise bien `getSupabaseAdmin()`. Conforme.
- Prop `baseUrl` ajoutée hors AC1 — déviation consciente documentée dans Tasks et Dev Notes (sémantique propre, server component → client component). AC obsolète, pas le code.
- Race "row n'existe pas avant webhook" — `createParrainageRelation` est appelé à l'inscription (Story 2.1), bien avant le checkout. Le row existe avec `statut='inscrite'` au moment du webhook.
- Re-vérifier `validation_status` au render — défensive non nécessaire ; la fetch est gardée par le check serveur.
- Précédence `defaultPm?.id ?? null` — fonctionnellement correct, NIT.
- Rôle `accompagnante` codé en dur dans l'invite link — couplage acceptable, parrainage limité aux accompagnantes par design produit.
