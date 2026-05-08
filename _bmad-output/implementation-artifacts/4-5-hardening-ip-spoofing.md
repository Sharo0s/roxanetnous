# Story 4.5 : Hardening IP spoofing

Status: review

<!-- Note : Validation est optionnelle. Lancer `validate-create-story` avant `dev-story` pour un controle qualite. -->

## Story

En tant que **developpeur du projet roxanetnous**,
je veux **migrer les 3 call-sites qui lisent `x-forwarded-for` (`app/actions/parrainage.ts:338-342` rate-limit `validateCode`, `app/actions/auth.ts:93-97` `ipInscription` parrainage signup, `app/actions/waitlist.ts:41-45` `ip_inscription` + rate-limit waitlist) vers un helper unique `lib/get-client-ip.ts` qui s'appuie sur `ipAddress(headers)` du package `@vercel/functions` (deja installe en transitif `node_modules/@vercel/functions@3.5.0`, lit le header `x-real-ip` sanitise par Vercel Proxy)**,
afin de **lever la dette AI-3.5 retro Epic 3 (acquittement TODO `parrainage.ts:332` « story 4.5 : remplacer x-forwarded-for par x-vercel-forwarded-for ») et neutraliser le risque de spoofing du header `x-forwarded-for` qui (1) permettrait a un attaquant d'esquiver le rate-limit `validateCode` parrainage (8 chars 31^31 = ~10^12 keyspace, 5 tentatives/min/IP en place story 4.1) en falsifiant son IP a chaque requete pour reset le compteur, (2) corromprait l'analyse anti-fraude `meme_ip` parrainage (story 2.3 `parrainages.ip_inscription` exploite par detection blacklist) en injectant l'IP d'une marraine connue pour declencher des faux positifs ou en masquant son IP pour echapper a la detection, (3) empoisonnerait le rate-limit waitlist 5 inscriptions/10min/IP (story 3.4) avec le meme bypass, et (4) etablirait le pattern reutilisable pour les futures stories Epic 5+ qui auront besoin d'IP cliente verifiee (alerting Sentry granular IP, analytics, future detection abuse messaging)**.

C'est la **cinquieme story de l'Epic 4 « Hardening pre-go-live Bretagne »** et la **premiere des 5 stories ordre 2 differees** non bloquantes go-live (cf. `epic-4.md` Story List ordre 2). Les 4 stories ordre 1 + 4.7 sont livrees (`sprint-status.yaml:147-150`), le toggle admin du premier dpt Bretagne en production est **deja autorise**. Cette story 4.5 est livrable apres go-live ou en parallele. Sequencage dans l'epic : 4.1 done -> 4.2 done -> 4.3 done -> 4.4 done -> 4.7 done -> 4.8 done -> **4.5 (cette story)** -> 4.6 backlog -> 4.9 backlog.

Elle s'appuie sur les fondations existantes :

- **`@vercel/functions@3.5.0` deja installe** (transitif via `next@^16.1.6` et/ou `@workflow/next@^4.0.5`). Verification : `cat node_modules/@vercel/functions/package.json | grep version` -> `"version": "3.5.0"`. **API publique exposee** : `ipAddress(input: Request | Headers): string | undefined` (`node_modules/@vercel/functions/headers.d.ts:95`) — lit le header `x-real-ip` (constante `IP_HEADER_NAME = "x-real-ip"` en interne, voir `headers.js:36`). Decision : ajouter `@vercel/functions` en `dependencies` explicite plutot que de dependre du transitif (D1).
- **`request.ip` n'existe plus dans Next.js 16** (deprecie depuis Next.js 13.4, retire definitivement dans Next.js 15+). L'architecture-technique-roxanetnous-2026-02-09.md ligne 3856 reference `request.ip` mais c'est un artefact de spec datant du cadrage initial 2026-02-09, **non implemente** dans le code actuel et **inutilisable** en l'etat (Next.js 16 ne fournit plus cette propriete sur `NextRequest`). Le pattern moderne Next.js 16 + Vercel pour les server actions est `headers()` puis `ipAddress(<headers>)` du SDK `@vercel/functions`.
- **Header `x-real-ip` sanitise par Vercel Proxy** : sur Vercel, le header `x-real-ip` est **toujours** le client IP veritable, recalcule par le Proxy a partir du tunnel TLS. Le client ne peut pas l'injecter (Vercel ecrase systematiquement la valeur a l'arrivee). Source : `https://vercel.com/docs/edge-network/headers#x-real-ip` + skill `vercel:routing-middleware` confirme « `ipAddress(request)` get client IP address » fiable plateforme. Hors-prod (`localhost`, `npm run dev`), le header n'est pas present -> fallback `null` ou `'unknown'` selon le call-site (comportement actuel preserve).
- **Header `x-forwarded-for` non sanitise** : c'est le header HTTP standard qu'un client peut emettre directement et qu'un proxy peut concatener. Sur Vercel, Vercel **prepend** sa valeur calculee mais **conserve** la chaine cliente derriere (format `<vercel-ip>, <client-injected-ip>, ...`). Le pattern actuel `h.get('x-forwarded-for')?.split(',')[0]?.trim()` lit le **premier element** = la valeur Vercel (donc fiable par chance sur Vercel prod). MAIS le pattern est **trompeur** : (a) il documente la mauvaise primitive (le code ressemble a une lecture XFF generique sujette au spoofing), (b) il echoue silencieusement hors Vercel (Cloudflare, AWS, dev local) car la convention « premier element = trusted proxy » n'est pas universelle, (c) le commentaire TODO `parrainage.ts:332` documente explicitement la dette « OK pour MVP ». La migration vers `ipAddress(headers)` (i) supprime l'ambiguite, (ii) centralise la logique, (iii) prepare les futures plateformes d'hebergement (changement de cloud provider).
- **Pattern `headers()` de `next/headers`** : Next.js 16 server actions utilisent `await headers()` qui retourne un `ReadonlyHeaders` (interface compatible `{ get(name: string): string | null }`). `ipAddress()` accepte directement cette forme via son interface `Headers` (`headers.d.ts:42` `interface Headers { get(name: string): string | null }`). Pas de cast ni adapter requis.
- **3 call-sites identifies** par grep `x-forwarded-for` sur `app/`, `lib/`, `scripts/` (zero match dans les autres dossiers, hors `node_modules` et `.next`) :
  - **`app/actions/parrainage.ts:338-342`** : rate-limit `validateCode` parrainage (story 4.1 AC4 + story 3.4). Pattern : `headers()` -> XFF first -> XRI -> 'unknown'. Resultat utilise comme `key = validate_code:<ip>` pour `try_consume_rate_limit` RPC + Sentry tag `signal:rate-limit-validate-code`.
  - **`app/actions/auth.ts:93-97`** : `ipInscription` passe a `createParrainageRelation` lors du signup `accompagnante` avec code parrainage. Pattern : `headers()` -> XFF first -> XRI -> `null`. Resultat persiste en BDD `parrainages.ip_inscription` (TEXT NULL, migration `20260428130104_add_parrainage_feature.sql:31`).
  - **`app/actions/waitlist.ts:41-45`** : `ip_inscription` waitlist + rate-limit `waitlist:<ip>` (5/10min). Pattern : `headers()` -> XFF first -> XRI -> `null`. Resultat persiste BDD `waitlist_departements.ip_inscription` ET sert de `key` rate-limit RPC.
- **Aucun autre helper IP existant** : verification `grep -l "client-ip\|getClientIp\|get-client-ip" lib/ app/ -r` retourne 0 fichier. Greenfield helper.
- **Pattern Sentry deja en place** (`lib/rate-limit-hash.ts`) : `hashRateLimitKey(key)` HMAC-SHA-256 sale (RATE_LIMIT_HASH_SALT) -> 16 hex chars. Reutilise sans modification — l'IP brute n'est jamais envoyee a Sentry, seul le keyHash l'est.
- **Tests integration backend disponibles** (story 4.4 done) : Vitest + `tests/integration/_lib/` + helpers fixtures + `vi.mock('@sentry/nextjs', ...)`. Les tests de cette story 4.5 utilisent ce framework existant **sans** ajouter de nouveau tooling.

**Le coeur de la story** :

- (a) **Helper centralise `lib/get-client-ip.ts`** (greenfield, ~30 lignes) qui expose **deux** fonctions :
  - `getClientIp(headers: Headers | ReadonlyHeaders): string | null` — version utilisable cote server actions Next.js + middleware. Retourne le resultat de `ipAddress({ headers })` du SDK `@vercel/functions`, ou `null` si le header `x-real-ip` est absent (cas dev local ou hors-Vercel). **Ne lit JAMAIS** `x-forwarded-for` ni `x-real-ip` directement -> toute lecture passe par `ipAddress()` pour beneficier de la stabilite future de l'API SDK (si Vercel etend la liste de headers fiables — ex : `cf-connecting-ip` Cloudflare — l'helper en herite gratuitement).
  - `getClientIpOrUnknown(headers: Headers | ReadonlyHeaders): string` — version qui retourne `'unknown'` au lieu de `null`. Utilisable pour les keys de rate-limit ou un fallback string non-null est requis (pattern `validate_code:${ip}`). Note D2 : decision faite de NE PAS recombiner `getClientIp() ?? 'unknown'` au call-site pour eviter la duplication string `'unknown'` (3 occurrences actuelles).
- (b) **3 migrations chirurgicales** (`parrainage.ts:338-342`, `auth.ts:93-97`, `waitlist.ts:41-45`) qui suppriment le bloc `h.get('x-forwarded-for')?.split(',')[0]?.trim() || h.get('x-real-ip') || ...` (5 lignes chacune) et le remplacent par un appel unique `getClientIp(h)` ou `getClientIpOrUnknown(h)`. **Le commentaire TODO `parrainage.ts:332-333` est supprime** (dette acquittee). Aucun changement de logique : le rate-limit reste 5 tentatives/min, le format de cle reste identique, l'INSERT BDD reste compatible (le helper retourne soit un string IPv4/IPv6 soit `null`/`'unknown'`).
- (c) **Tests unitaires `tests/unit/get-client-ip.test.ts`** (greenfield repertoire `tests/unit/` — premier test unitaire pur du projet). Vitest sans mock Supabase (pas besoin), 5 cas :
  - **U1** : `Headers` avec `x-real-ip: '1.2.3.4'` -> `getClientIp` retourne `'1.2.3.4'`.
  - **U2** : `Headers` sans `x-real-ip` -> `getClientIp` retourne `null`.
  - **U3** : `Headers` sans `x-real-ip` -> `getClientIpOrUnknown` retourne `'unknown'`.
  - **U4** : `Headers` avec **uniquement** `x-forwarded-for: '1.2.3.4'` (pas `x-real-ip`) -> `getClientIp` retourne `null`. **Garantit que l'helper N'utilise PAS `x-forwarded-for` directement** (test de non-regression du contrat anti-spoofing).
  - **U5** : `Headers` avec `x-real-ip: '1.2.3.4'` ET `x-forwarded-for: '5.6.7.8'` -> `getClientIp` retourne `'1.2.3.4'` (priorite stricte au header sanitise). Le `x-forwarded-for` est ignore.
- (d) **Audit grep post-migration** : la story livre une commande de verification `npm run check:ip-spoofing` (script `package.json`) qui execute `grep -rEn "x-forwarded-for|x-real-ip" --include='*.ts' --include='*.tsx' --include='*.mjs' app/ lib/ scripts/ tests/` et exit 1 si **plus d'1 ligne** est retournee (la seule ligne autorisee est l'`import { ipAddress } from '@vercel/functions'` dans `lib/get-client-ip.ts` — exclu par le grep car la chaine litterale `x-forwarded-for` ou `x-real-ip` n'y apparait pas). Les fichiers de tests `tests/unit/get-client-ip.test.ts` qui CONSTRUIT des `Headers` avec `x-real-ip: ...` sont autorises (le grep cible les sources de prod, pas les tests). Decision D3 : pattern allowlist par exclusion du dossier `tests/`.
- (e) **DECISIONS.md F10 ajoutee** : section datee de la livraison, intitulee « Detection IP cliente - centralisee via `lib/get-client-ip.ts` (decision F10) ». Pattern interdit : tout nouveau fichier qui lit `x-forwarded-for` ou `x-real-ip` directement (sauf `lib/get-client-ip.ts`). Garde-fou : `npm run check:ip-spoofing` integre au `buildCommand` Vercel apres `lint:a11y-check` et avant `next build`.

**Hors scope explicite** :

1. **Migration vers `ipAddress(request)` cote middleware/route handlers** : actuellement le projet n'a pas de `middleware.ts` lisant l'IP (verification `cat middleware.ts | grep -i 'ip\|forward'` -> match uniquement Supabase auth). Si Epic 5+ ajoute un middleware route protection, il consommera l'helper `getClientIp` cote Edge — pas dans cette story.
2. **Sanitisation IPv6** : le helper retourne le string brut. Pas de normalisation IPv4-mapped IPv6 (`::ffff:1.2.3.4` -> `1.2.3.4`), pas de canonicalisation. Acceptable car la cle rate-limit utilise `key:<string>` opaque (pas de comparaison semantique), et `ip_inscription` BDD est TEXT (pas INET).
3. **Geolocation `geolocation(request)`** : disponible dans `@vercel/functions` (`headers.d.ts:125`) mais hors scope (pas de besoin metier identifie).
4. **Tests d'integration end-to-end avec Vercel Proxy reel** : impossibles en GHA local. Validation prod = audit Sentry post-deploy : si `signal:rate-limit-validate-code` continue de remonter avec des keyHash distincts pour des attaquants connus, le hardening fonctionne. Pas d'AC bloquant.
5. **Modification du schema BDD** : `parrainages.ip_inscription` et `waitlist_departements.ip_inscription` restent TEXT NULL. Aucune migration.
6. **Resorption des `as any`** : story 4.6 separee. Si l'helper `getClientIp` introduit un type genant en TypeScript strict, prefere `as unknown as Headers` chirurgical avec commentaire de justification (interdit `as any`).
7. **Hardening IP cote `app/api/webhooks/stripe/route.ts`** : le webhook Stripe ne lit pas l'IP cliente (signature Stripe garantit l'origine). Aucune migration requise.
8. **Migration vers un helper `@/lib/get-client-ip` dans `app/api/cron/...`** : les cron Vercel sont declenches par Vercel Proxy interne, pas par un client externe. Pas de besoin de detection IP. Aucune migration requise.
9. **Bibliotheque `forwarded`** (npm) : utilisee en transitif (`node_modules/forwarded/index.js` existe) mais **pas** consommee directement par le projet. Pas de migration requise.
10. **Pattern Cloudflare `cf-connecting-ip` ou AWS `x-amz-cf-id`** : le projet est strictement Vercel-deploy. Si une migration de plateforme est decidee Epic 6+, l'helper sera etendu via une seule modification dans `lib/get-client-ip.ts`.

## Acceptance Criteria

### AC fonctionnels (AI-3.5 retro Epic 3)

1. **AC1 — Helper `lib/get-client-ip.ts` cree** : Given le projet n'a aucun helper IP centralise (verification `grep -l "client-ip\|getClientIp\|get-client-ip" lib/ app/ -r` -> 0 match), when la story est livree, then :
   - **Fichier `lib/get-client-ip.ts` cree** avec exactement deux exports :
     ```ts
     // lib/get-client-ip.ts
     // Story 4.5 : helper centralise pour la detection IP cliente.
     // Pourquoi : le pattern `headers().get('x-forwarded-for')?.split(',')[0]` etait
     // sujet au spoofing hors Vercel et trompeur en lecture (le commentaire TODO
     // historique `parrainage.ts:332` documentait la dette). On bascule sur
     // `ipAddress()` du SDK `@vercel/functions` qui lit le header `x-real-ip`
     // sanitise par Vercel Proxy (cf. https://vercel.com/docs/edge-network/headers).
     // Pattern interdit : lecture directe de `x-forwarded-for` ou `x-real-ip`
     // dans le code metier. Garde-fou `npm run check:ip-spoofing`.
     import { ipAddress } from '@vercel/functions'

     export type RequestHeaders = { get(name: string): string | null }

     export function getClientIp(headers: RequestHeaders): string | null {
       return ipAddress({ headers }) ?? null
     }

     export function getClientIpOrUnknown(headers: RequestHeaders): string {
       return ipAddress({ headers }) ?? 'unknown'
     }
     ```
   - **Le type `RequestHeaders`** est exporte pour reutilisation par les call-sites (sans `as any`). Compatible `ReadonlyHeaders` de `next/headers` (qui implemente `get(name: string): string | null`).
   - **Aucune dependance Next.js** : l'helper est portable (utilisable cote middleware Edge, server actions Node, route handlers, futurs workers Vercel Workflow).
   - **Aucune lecture directe** des headers `x-forwarded-for`, `x-real-ip`, `cf-connecting-ip`, `true-client-ip`. **Tout** passe par `ipAddress()` (delegation totale au SDK Vercel).

2. **AC2 — `package.json` declare `@vercel/functions` en `dependencies` explicite** : Given `@vercel/functions@3.5.0` est actuellement transitif (verification `cat node_modules/@vercel/functions/package.json | grep version` -> match 3.5.0, mais `grep '"@vercel/functions"' package.json` -> 0 match), when la story est livree, then :
   - **`package.json:dependencies` ajoute** : `"@vercel/functions": "^3.5.0"` (range caret pour permettre les patchs sans bump major). **Pas dans `devDependencies`** (utilise en runtime production).
   - **`package-lock.json` regenere** via `npm install @vercel/functions@^3.5.0` (le lock peut deja contenir l'entry transitive — verifier que la modification est minimale). **Pattern d'amendement de review story 4.4 P2 transposable** : si l'install genere un drift majeur du lock, isoler en commit dedie pour faciliter le review.
   - **Verification** : `npm ls @vercel/functions` retourne `roxanetnous@<version> -> @vercel/functions@^3.5.0` (et plus comme transitive seulement).

3. **AC3 — Migration `app/actions/parrainage.ts:338-342` (rate-limit `validateCode`)** : Given le bloc actuel lignes 332-342 contient le commentaire TODO + 5 lignes de detection IP, when la story est livree, then :
   - **Lignes 332-333** (commentaire TODO `// TODO story 4.5 : remplacer x-forwarded-for ...`) **supprimees** (dette acquittee).
   - **Lignes 338-342** :
     ```ts
     const h = await headers()
     const ip =
       h.get('x-forwarded-for')?.split(',')[0]?.trim() ||
       h.get('x-real-ip') ||
       'unknown'
     ```
     **remplacees** par :
     ```ts
     const h = await headers()
     const ip = getClientIpOrUnknown(h)
     ```
   - **Import ajoute** ligne ~21 (apres `import { hashRateLimitKey } from '@/lib/rate-limit-hash'`) : `import { getClientIpOrUnknown } from '@/lib/get-client-ip'`.
   - **`rateLimitKey = `validate_code:${ip}`** reste inchange (le format est preserve, les rate-limits actifs en prod ne sont pas invalidees par la migration : meme `key` -> meme entry BDD `rate_limit_tracker`).
   - **Tests integration story 4.1 / 4.4** restent verts (aucun test ne mocke directement `x-forwarded-for` au niveau de la requete — ils utilisent les helpers de fixture).

4. **AC4 — Migration `app/actions/auth.ts:93-97` (`ipInscription` parrainage signup)** : Given le bloc actuel lignes 92-97 contient 5 lignes de detection IP, when la story est livree, then :
   - **Lignes 93-97** :
     ```ts
     const h = await headers()
     const ip =
       h.get('x-forwarded-for')?.split(',')[0]?.trim() ||
       h.get('x-real-ip') ||
       null
     ```
     **remplacees** par :
     ```ts
     const h = await headers()
     const ip = getClientIp(h)
     ```
   - **Import ajoute** ligne ~9 (apres `import { createParrainageRelation } from '@/app/actions/parrainage'`) : `import { getClientIp } from '@/lib/get-client-ip'`.
   - **Le `ip` est passe a `createParrainageRelation({ ipInscription: ip, ... })`** : compatible (`ipInscription: string | null | undefined` cf. `parrainage.ts:39`). Aucun changement de signature.
   - **Comportement preserve** : si `x-real-ip` absent (dev local), `ip = null` -> `parrainages.ip_inscription = NULL` (idem qu'avant). Aucune regression sur la detection anti-fraude `meme_ip` (story 2.3) car le mecanisme existant `if (params.ipInscription && params.ipInscription.trim())` (`parrainage.ts:86`) gere deja le cas null.

5. **AC5 — Migration `app/actions/waitlist.ts:41-45` (`ip_inscription` + rate-limit waitlist)** : Given le bloc actuel lignes 41-45 contient 5 lignes de detection IP, when la story est livree, then :
   - **Lignes 41-45** :
     ```ts
     const headersList = await headers()
     const ip =
       headersList.get('x-forwarded-for')?.split(',')[0]?.trim() ||
       headersList.get('x-real-ip') ||
       null
     ```
     **remplacees** par :
     ```ts
     const headersList = await headers()
     const ip = getClientIp(headersList)
     ```
   - **Import ajoute** ligne ~5 (apres `import { enqueueWaitlistConfirmationEmail } from '@/lib/emails'`) : `import { getClientIp } from '@/lib/get-client-ip'`.
   - **Note rate-limit** : la cle `waitlist:${ip ?? 'unknown'}` (`waitlist.ts:55`) reste **inchangee** (le `?? 'unknown'` cote rate-limit est conserve pour preserver le fallback). Decision D2 : on n'utilise PAS `getClientIpOrUnknown` ici parce que le `null` est utile pour le INSERT BDD (`ip_inscription: null` au lieu de `'unknown'`). Le `?? 'unknown'` reste local au call-site rate-limit.
   - **Comportement preserve** : INSERT `ip_inscription = NULL` si pas d'IP, INSERT `ip_inscription = '1.2.3.4'` sinon.

6. **AC6 — Tests unitaires `tests/unit/get-client-ip.test.ts`** : Given le projet n'a pas encore de repertoire `tests/unit/` (verification `ls tests/` -> `a11y/`, `integration/`, pas de `unit/`), when la story est livree, then :
   - **Fichier `tests/unit/get-client-ip.test.ts`** cree avec 5 tests Vitest minimum :
     ```ts
     // tests/unit/get-client-ip.test.ts
     import { describe, it, expect } from 'vitest'
     import { getClientIp, getClientIpOrUnknown } from '@/lib/get-client-ip'

     function makeHeaders(entries: Record<string, string>): { get(name: string): string | null } {
       return {
         get(name: string) {
           return entries[name.toLowerCase()] ?? null
         },
       }
     }

     describe('getClientIp', () => {
       it('U1 : retourne x-real-ip quand present', () => {
         const h = makeHeaders({ 'x-real-ip': '1.2.3.4' })
         expect(getClientIp(h)).toBe('1.2.3.4')
       })

       it('U2 : retourne null quand x-real-ip absent', () => {
         const h = makeHeaders({})
         expect(getClientIp(h)).toBeNull()
       })

       it('U4 : ignore x-forwarded-for (anti-spoofing contract)', () => {
         const h = makeHeaders({ 'x-forwarded-for': '1.2.3.4' })
         expect(getClientIp(h)).toBeNull()
       })

       it('U5 : priorite stricte a x-real-ip vs x-forwarded-for', () => {
         const h = makeHeaders({ 'x-real-ip': '1.2.3.4', 'x-forwarded-for': '5.6.7.8' })
         expect(getClientIp(h)).toBe('1.2.3.4')
       })
     })

     describe('getClientIpOrUnknown', () => {
       it('U3 : retourne "unknown" quand x-real-ip absent', () => {
         const h = makeHeaders({})
         expect(getClientIpOrUnknown(h)).toBe('unknown')
       })
     })
     ```
   - **Configuration `vitest.config.ts`** : etendre `test.include` pour inclure `tests/unit/**/*.test.ts` en plus de `tests/integration/**/*.test.ts` deja present (story 4.4 AC1). Pattern :
     ```ts
     test: {
       // ...
       include: ['tests/integration/**/*.test.ts', 'tests/unit/**/*.test.ts'],
     }
     ```
     **Pas de nouveau fichier de config Vitest** — extension de l'existant.
   - **Verification** : `npm run test:integration -- tests/unit/get-client-ip.test.ts` (ou un nouveau script dedie `npm run test:unit` voir AC9) execute les 5 tests verts en <1 s (pas de Supabase, pas de mocks lourds).

7. **AC7 — Garde-fou `npm run check:ip-spoofing`** : Given une regression future pourrait reintroduire `h.get('x-forwarded-for')` dans un nouveau call-site, when la story est livree, then :
   - **Script `scripts/check-ip-spoofing.mjs`** cree (~30 lignes) qui :
     - Execute le grep : `grep -rEn "x-forwarded-for|x-real-ip" --include='*.ts' --include='*.tsx' --include='*.mjs' app/ lib/ scripts/`.
     - Exit 0 si zero match (le helper `lib/get-client-ip.ts` ne contient ni `x-forwarded-for` ni `x-real-ip` en string litteral — il importe `ipAddress` qui les utilise en interne).
     - Exit 1 + message d'erreur explicite si match : `ERREUR : detection directe de x-forwarded-for / x-real-ip detectee. Utiliser lib/get-client-ip.ts (story 4.5).` + liste des fichiers/lignes en cause.
   - **`package.json:scripts`** ajoute : `"check:ip-spoofing": "node scripts/check-ip-spoofing.mjs"`.
   - **`vercel.json:6` `buildCommand`** etendu apres `lint:a11y-check` : `"npm run check:env && npm run lint:a11y-check && npm run check:ip-spoofing && (test \"$SKIP_E2E_TESTS\" = \"true\" || npm run test:integration) && next build"`. Le check est rapide (<100 ms grep) -> impact build negligeable.
   - **Documentation** : commentaire en tete du script renvoyant a `DECISIONS.md F10` + cette story 4.5.

8. **AC8 — DECISIONS.md F10 ajoutee** : Given cette story etablit un pattern transverse (detection IP centralisee), when la story est livree, then :
   - **Section datee de la livraison** ajoutee dans `DECISIONS.md` apres F9 (story 4.7 + 4.8), intitulee « Detection IP cliente - centralisee via `lib/get-client-ip.ts` (decision F10) ».
   - **Contenu attendu** :
     - **Decision** : tout code qui a besoin de l'IP cliente passe par `lib/get-client-ip.ts` (`getClientIp` ou `getClientIpOrUnknown`). Lecture directe de `x-forwarded-for`, `x-real-ip`, `cf-connecting-ip`, `true-client-ip` dans le code metier interdite.
     - **Motivation** : (a) anti-spoofing (XFF est manipulable hors Vercel), (b) portabilite (changement futur de plateforme = 1 fichier a modifier), (c) clarte (pattern unique vs 3 occurrences divergentes), (d) levee dette TODO `parrainage.ts:332` (acquit AI-3.5 retro Epic 3).
     - **Implementation** : `lib/get-client-ip.ts` delegue a `ipAddress()` du SDK `@vercel/functions@^3.5.0` qui lit `x-real-ip` sanitise par Vercel Proxy.
     - **Pattern interdit** : `headers().get('x-forwarded-for')`, `headers().get('x-real-ip')`, `request.ip` (n'existe plus dans Next.js 16). Garde-fou : `npm run check:ip-spoofing` au `buildCommand` Vercel.
     - **Regle pour les futures stories** : tout nouveau call-site qui a besoin de l'IP cliente doit utiliser le helper. Si une nouvelle plateforme d'hebergement est introduite (Cloudflare, AWS), l'extension passe par modification de `lib/get-client-ip.ts` et non par le call-site.
     - **Pattern fail-loud** : `getClientIp` retourne `null` si IP indeterminee (au lieu de fallback string trompeur `'unknown'`). Les call-sites doivent gerer explicitement le cas null (cf. `parrainage.ts:86` `if (params.ipInscription && params.ipInscription.trim())`).

9. **AC9 — Scripts `package.json` (optionnel `test:unit`)** : Given la story introduit un nouveau type de test (unitaires purs) distinct de l'integration backend (story 4.4), when la story est livree, then :
   - **Decision D4** : la story livre **soit** un nouveau script `"test:unit": "vitest run --include 'tests/unit/**/*.test.ts'"` distinct, **soit** etend simplement `test:integration` pour inclure `tests/unit/`. **Recommandation** : etendre `test:integration` (un seul runner Vitest, configuration unique) et **renommer** le script en `"test": "vitest run"` + alias `"test:integration": "vitest run --include 'tests/integration/**/*.test.ts'"` + nouveau `"test:unit": "vitest run --include 'tests/unit/**/*.test.ts'"`. **A trancher en Subtask 1.6** selon retours review.
   - **Verification** : `npm test` execute ~10 tests integration + 5 tests unitaires en <60 s. **Pas de nouveau workflow GitHub Actions** : l'existant `.github/workflows/integration-tests.yml` (story 4.4) execute `npm run test:integration` qui inclut maintenant les unitaires (ou un job dedie `test:unit` rapide en <5 s).

10. **AC10 — Audit grep post-migration** : Given la story doit garantir zero residu `x-forwarded-for` / `x-real-ip` dans le code de production, when la story est livree, then :
    - **`grep -rEn "x-forwarded-for|x-real-ip" --include='*.ts' --include='*.tsx' --include='*.mjs' app/ lib/ scripts/`** retourne **0 ligne** (apres exclusion automatique des dossiers `tests/` et `node_modules/`).
    - **Verification dans la PR description** : Sylvain copie/colle le resultat du grep + sortie `npm run check:ip-spoofing` (exit 0).
    - **Verification dans les Completion Notes** : la story documente le resultat post-migration + un timestamp.

### AC techniques (qualite et non-regression)

11. **AC11 — Aucune regression rate-limit ni anti-fraude** : Given les rate-limits `validateCode` (5/min/IP) et `waitlist` (5/10min/IP) actifs en prod sont sensibles aux changements de format de cle, when la story est livree, then :
    - **Format cle inchange** : `validate_code:${ip}` reste identique (avant : `'1.2.3.4'` ou `'unknown'` ; apres : meme valeurs via `getClientIpOrUnknown`).
    - **Format cle waitlist inchange** : `waitlist:${ip ?? 'unknown'}` reste identique (le `?? 'unknown'` est conserve).
    - **Comportement detection anti-fraude `meme_ip`** preserve : `parrainages.ip_inscription = NULL` ou `'1.2.3.4'` selon disponibilite. Le `if (params.ipInscription && params.ipInscription.trim())` deja en place gere les deux cas.
    - **Verification manuelle Sylvain** : `mcp__supabase__execute_sql` `SELECT key, count, window_start FROM rate_limit_tracker WHERE key LIKE 'validate_code:%' OR key LIKE 'waitlist:%' ORDER BY window_start DESC LIMIT 20;` avant/apres migration -> **les keys generees apres deploy doivent suivre le meme format**.

12. **AC12 — Pas de regression typage strict** : Given la convention projet (`tsconfig.json` strict mode, regle CLAUDE.md « pas de `as any` introduit »), when la story est livree, then :
    - **Aucun nouveau `as any`** dans le diff. Verification : `git diff <PR base>...HEAD -- '*.ts' '*.tsx' | grep -E "as any"` -> 0 match.
    - **`npx tsc --noEmit`** exit 0 sur tous les fichiers nouveaux : `lib/get-client-ip.ts`, `tests/unit/get-client-ip.test.ts`, `scripts/check-ip-spoofing.mjs` (mjs : pas de tsc, mais lint OK).
    - **Aucun `@ts-ignore` / `@ts-expect-error`** ajoute. Si `ipAddress()` du SDK Vercel exige un type incompatible, prefere `as unknown as { headers: { get(name: string): string | null } }` chirurgical avec commentaire.

13. **AC13 — Build, lint, a11y verts** : Given les conventions projet (`npm run build`, `npm run lint`, `npm run lint:a11y-check`, `npm run a11y:axe:check`), when la story est livree, then :
    - **`npm run build`** : exit 0 (Next.js 16, nouveaux fichiers inclus dans `tsconfig.json` glob `**/*.ts`).
    - **`npm run lint`** : 0 nouvelles erreurs ESLint. Les warnings preexistants (~226 baseline) restent inchanges.
    - **`npm run lint:a11y-check`** : exit 0, baseline preservee (story strictement backend / tooling).
    - **`npm run a11y:axe:check`** : exit 0, **0 violations Critical/Serious sur 7 parcours**. **Obligation absolue CLAUDE.md** (regle durcie 2026-05-06). A executer localement avant le commit livraison.
    - **`npm run check:env`** : exit 0. Aucune nouvelle variable d'env introduite.
    - **`npm run check:ip-spoofing`** : exit 0 (nouveau check ajoute dans cette story).

14. **AC14 — Pas de modification UI** : Given cette story est strictement backend / tooling, when la story est livree, then :
    - **`git diff --stat`** ne touche AUCUN fichier `.tsx` cote `components/`, `app/(non-admin)/page.tsx`, ni les pages admin.
    - **DoD a11y** : N/A pour les sections UI mais lints + axe-core obligatoires (cf. AC13).
    - **Aucun nouveau composant client** introduit.

15. **AC15 — Periphrase des fichiers touches** : Given le scope est borne, when le diff est livre, then **strictement** les fichiers suivants sont attendus :
    - **Nouveaux fichiers** :
      - `lib/get-client-ip.ts` (helper centralise).
      - `tests/unit/get-client-ip.test.ts` (5 tests unitaires).
      - `scripts/check-ip-spoofing.mjs` (garde-fou grep).
    - **Fichiers modifies** :
      - `package.json` + `package-lock.json` : ajout `@vercel/functions@^3.5.0` en `dependencies` + script `check:ip-spoofing` + (optionnel) script `test:unit`.
      - `vercel.json` : `buildCommand` etendu avec `npm run check:ip-spoofing`.
      - `vitest.config.ts` : `test.include` etendu avec `tests/unit/**/*.test.ts`.
      - `app/actions/parrainage.ts` : suppression TODO + 5 lignes -> 1 ligne, ajout import.
      - `app/actions/auth.ts` : 5 lignes -> 1 ligne, ajout import.
      - `app/actions/waitlist.ts` : 5 lignes -> 1 ligne, ajout import.
      - `DECISIONS.md` : ajout section F10.
      - `_bmad-output/implementation-artifacts/sprint-status.yaml` : `4-5-hardening-ip-spoofing` ready-for-dev -> in-progress -> review -> done.
      - `_bmad-output/implementation-artifacts/4-5-hardening-ip-spoofing.md` : checkboxes Tasks/Subtasks + Dev Agent Record + Change Log + DoD a11y.
    - **Total estimation** : 3 fichiers nouveaux + 8 fichiers modifies, ~100-150 lignes ajoutees (dont ~80 tests + helper), ~15 lignes supprimees (3 blocs XFF de 5 lignes).

16. **AC16 — Verifications manuelles documentees dans la PR** : Given la dette est livree, when la story est livree, then la PR contient une section « Verifications manuelles » listant :
    - (a) `npm run test:integration -- tests/unit/get-client-ip.test.ts` -> 5 tests verts en <1 s.
    - (b) `npm run check:ip-spoofing` -> exit 0 + message « OK : aucune lecture directe x-forwarded-for/x-real-ip detectee ».
    - (c) `grep -rEn "x-forwarded-for|x-real-ip" --include='*.ts' --include='*.tsx' --include='*.mjs' app/ lib/ scripts/` -> 0 ligne.
    - (d) `git diff --stat` borne aux fichiers AC15.
    - (e) `npm run build` exit 0 + `npm run lint` 0 nouvelle erreur + `npm run a11y:axe:check` 0 violations.
    - (f) Test regression rate-limit : avant/apres deploy preview, `validateCode` avec 6 tentatives consecutives -> 6e tentative bloquee (`{ valid: false, reason: 'rate_limited' }`).
    - (g) Test regression waitlist : POST `/api/waitlist` 6 fois en <10 min depuis meme IP -> 6e tentative bloquee.
    - (h) Audit BDD post-deploy preview : `mcp__supabase__execute_sql` `SELECT ip_inscription FROM waitlist_departements ORDER BY created_at DESC LIMIT 5;` -> les nouvelles inscriptions ont `ip_inscription` rempli (sur Vercel preview, `x-real-ip` est present).
    - (i) Verifier qu'un `console.log(headers().get('x-real-ip'))` ajoute temporairement dans une route Vercel preview retourne bien une IP non-`null` -> confirme que le mecanisme Vercel Proxy fonctionne en preview ET prod (ne PAS commit ce console.log).

17. **AC17 — Plan suivi 7 jours post-merge** : Given la story modifie le mecanisme de detection IP qui sert au rate-limit + anti-fraude prod, when la story est livree, then :
    - **Action manuelle Sylvain** : audit Sentry 7 jours apres merge sur les signaux :
      - `signal:rate-limit-validate-code` : verifier que la frequence des declenchements ne chute pas anormalement (`null` -> rate-limit toujours actif).
      - `signal:rate-limit-rpc-error` : verifier zero pic.
      - Nouveaux events `flow:parrainage` non-attendus apparues post-deploy.
    - **Audit BDD** : `SELECT count(*) FROM parrainages WHERE ip_inscription IS NULL AND created_at > <merge_date>;` vs avant. Si la proportion chute drastiquement de >80% NULL a <20% NULL c'est suspect (mais en realite Vercel Proxy injecte toujours `x-real-ip` -> on s'attend a ce que la proportion baisse). Documenter le delta.
    - **Si regression detectee** -> hotfix story 4.5.b ouverte (rollback de l'helper + reintroduire le `getClientIp` avec fallback `x-forwarded-for` strictement Vercel-only). Pas attendu.

## Tasks / Subtasks

- [x] **Task 1 (AC: #1, #2, #6) — Bootstrap helper + tests unitaires** (phase 1)
  - [x] Subtask 1.1 : Verifier que `@vercel/functions` est present transitif (`cat node_modules/@vercel/functions/package.json | grep version`).
  - [x] Subtask 1.2 : `npm install @vercel/functions@^3.5.0` (passe en dependency directe — generer le lock).
  - [x] Subtask 1.3 : Creer `lib/get-client-ip.ts` avec `getClientIp` + `getClientIpOrUnknown` + commentaire d'entete (cf. AC1).
  - [x] Subtask 1.4 : Creer `tests/unit/` (greenfield repertoire) + `tests/unit/get-client-ip.test.ts` avec 5 tests U1-U5 (cf. AC6).
  - [x] Subtask 1.5 : Etendre `vitest.config.ts` `test.include` pour inclure `tests/unit/**/*.test.ts` (cf. AC6 + AC9).
  - [x] Subtask 1.6 : Decision D4 tranchee — `vitest.config.ts` introduit deux projets (`integration` + `unit`) via `test.projects`. Scripts `test`, `test:unit`, `test:integration` distincts. Justification : le setup integration mock Supabase/Sentry/Resend/Stripe, inutile et confondant pour des tests unitaires purs.
  - [x] Subtask 1.7 : Verifier `npm run test:unit` (ou equivalent) -> 5 tests verts en <1 s.

- [x] **Task 2 (AC: #3, #4, #5, #11) — Migration des 3 call-sites** (phase 2)
  - [x] Subtask 2.1 : `app/actions/parrainage.ts` — supprimer commentaire TODO lignes 332-333, remplacer detection IP lignes 338-342 par `getClientIpOrUnknown(h)`, ajouter import (cf. AC3).
  - [x] Subtask 2.2 : `app/actions/auth.ts` — remplacer detection IP lignes 93-97 par `getClientIp(h)`, ajouter import (cf. AC4).
  - [x] Subtask 2.3 : `app/actions/waitlist.ts` — remplacer detection IP lignes 41-45 par `getClientIp(headersList)`, ajouter import. **Conserver** le `?? 'unknown'` local au call-site rate-limit ligne 55 (cf. AC5).
  - [x] Subtask 2.4 : Verifier que `tests/integration/paywall/*` et `tests/integration/stripe-webhook/*` (story 4.4) restent verts -> aucun mock direct de `x-forwarded-for` n'a besoin de migration. **Validation deferee au workflow GHA** (Sylvain ne lance pas Supabase local — comportement attendu, cf. memoire `feedback_test_local_supabase.md`). Verification locale : aucun changement de signature `createParrainageRelation`, aucun mock XFF dans `tests/integration/_lib/`.
  - [x] Subtask 2.5 : `npx tsc --noEmit` exit 0 (apres `rm -rf .next` pour nettoyer artefacts macOS dupliques `cache-life.d 2.ts` non lies a la story).

- [x] **Task 3 (AC: #7, #10) — Garde-fou grep + audit** (phase 3)
  - [x] Subtask 3.1 : Creer `scripts/check-ip-spoofing.mjs` avec grep + exit code (cf. AC7). Pattern aligne sur `scripts/check-required-env.mjs` (story 4.8).
  - [x] Subtask 3.2 : Ajouter script `package.json:scripts.check:ip-spoofing`.
  - [x] Subtask 3.3 : Etendre `vercel.json:6` `buildCommand` -> ajouter `npm run check:ip-spoofing` apres `lint:a11y-check`.
  - [x] Subtask 3.4 : Verifier en local `npm run check:ip-spoofing` exit 0 apres migration des 3 call-sites.
  - [x] Subtask 3.5 : Audit grep manuel `grep -rEn "x-forwarded-for|x-real-ip" --include='*.ts' --include='*.tsx' --include='*.mjs' app/ lib/ scripts/` -> 2 lignes en allowlist (helper + script), 0 ligne hors allowlist.

- [x] **Task 4 (AC: #8) — DECISIONS.md F10** (phase 4)
  - [x] Subtask 4.1 : Ouvrir `DECISIONS.md`, ajouter section apres F9 (story 4.7 + 4.8).
  - [x] Subtask 4.2 : Sections obligatoires : decision, motivation (anti-spoofing + portabilite + clarte + levee dette), implementation, pattern interdit, regle futures stories, pattern fail-loud (cf. AC8).
  - [x] Subtask 4.3 : Datage : 2026-05-09.

- [x] **Task 5 (AC: #13, #14, #16, #17) — Validation finale + PR** (phase 5)
  - [x] Subtask 5.1 : `npm run build` exit 0 (avec `SKIP_E2E_TESTS=true`) + `npm run lint` 0 erreur (226 warnings preexistants inchanges, baseline) + `npm run lint:a11y-check` exit 0 (155 violations baseline, 0 regression).
  - [x] Subtask 5.2 : `npm run a11y:axe:check` exit 0 (0 violations Critical/Serious sur 7 parcours, baseline 2026-05-05 preservee).
  - [x] Subtask 5.3 : `npm run test:unit` -> 5/5 verts en 119 ms. `npm run test:integration` valide via workflow GHA `Integration Tests` (Sylvain ne lance pas Supabase local — comportement attendu memoire `feedback_test_local_supabase.md`).
  - [ ] Subtask 5.4 : Tests manuels regression rate-limit + waitlist sur deploy preview Vercel (cf. AC16 (f) + (g)) — **a executer apres ouverture PR**, avant merge main.
  - [ ] Subtask 5.5 : Audit BDD `parrainages.ip_inscription` + `waitlist_departements.ip_inscription` post-deploy preview (cf. AC16 (h)) — **a executer apres deploy preview**, avant merge main.
  - [x] Subtask 5.6 : Plan de suivi 7 jours documente en Completion Notes ci-dessous.
  - [ ] Subtask 5.7 : Update sprint-status.yaml `4-5-hardening-ip-spoofing` -> `done` apres CI Vercel verte 2026-05-09 (action post-merge).

## Dev Notes

### Patterns architecturaux et contraintes

- **Next.js 16 server actions** : `headers()` est asynchrone (`await headers()`) et retourne `ReadonlyHeaders` (interface `{ get(name: string): string | null }`). Compatible avec `ipAddress({ headers })` du SDK Vercel sans cast.
- **Pattern d'import** : alias `@/` configure dans `tsconfig.json` (`paths: { "@/*": ["./*"] }`) -> `import { getClientIp } from '@/lib/get-client-ip'` partout.
- **Pas de circular dep** : `lib/get-client-ip.ts` importe **uniquement** `@vercel/functions` (pas de Supabase, pas de Sentry, pas de Next.js types — pour rester portable middleware/Edge/Node).
- **Sentry tags** : la story 4.1 emet `flow:parrainage`, `signal:rate-limit-validate-code`. **Aucune modification Sentry** dans cette story 4.5 — les events emis continueront d'inclure `keyHash` (pas l'IP brute) via `hashRateLimitKey(rateLimitKey)`.

### Source tree components a toucher

```
lib/
  get-client-ip.ts                  [NOUVEAU — helper centralise]
  rate-limit-hash.ts                [INCHANGE — story 4.1]
app/
  actions/
    parrainage.ts                   [MODIFIE — lignes 332-342]
    auth.ts                         [MODIFIE — lignes 93-97]
    waitlist.ts                     [MODIFIE — lignes 41-45]
tests/
  unit/                             [NOUVEAU REPERTOIRE]
    get-client-ip.test.ts           [NOUVEAU — 5 tests U1-U5]
  integration/                      [INCHANGE — story 4.4]
    setup.ts                        [INCHANGE]
scripts/
  check-ip-spoofing.mjs             [NOUVEAU — garde-fou grep]
  check-required-env.mjs            [INCHANGE — story 4.8]
package.json                        [MODIFIE — dependency + scripts]
package-lock.json                   [MODIFIE — lock regen]
vercel.json                         [MODIFIE — buildCommand etendu]
vitest.config.ts                    [MODIFIE — test.include etendu]
DECISIONS.md                        [MODIFIE — F10 ajoutee]
_bmad-output/implementation-artifacts/sprint-status.yaml  [MODIFIE]
_bmad-output/implementation-artifacts/4-5-hardening-ip-spoofing.md  [MODIFIE — checkboxes + Dev Agent Record]
```

### Testing standards summary

- **Tests unitaires Vitest** : nouveau repertoire `tests/unit/`. Pattern : pas de Supabase, pas de mocks lourds, juste `describe/it/expect`. Pattern `makeHeaders(entries: Record<string, string>)` factory pour eviter `as any`.
- **Tests integration story 4.4** : restent verts sans modification (les helpers `tests/integration/_lib/` n'ont pas besoin d'IP cliente).
- **Plan stabilisation 7 jours** : audit Sentry + BDD post-merge (cf. AC17).

### Project Structure Notes

- **Alignement convention `lib/`** : helpers purs sans dependance metier dans `lib/` (`rate-limit-hash.ts`, `parrainage-detection.ts`, `code-postal.ts`). `lib/get-client-ip.ts` suit ce pattern.
- **Alignement convention `tests/`** : (i) `tests/a11y/` (Playwright + axe-core), (ii) `tests/integration/` (Vitest backend story 4.4), (iii) **NOUVEAU** `tests/unit/` (Vitest unitaires purs). Decision : utiliser Vitest unique runner (pas de Jest, pas de Mocha).
- **Detected conflicts** : aucun. Le repertoire `tests/unit/` n'existe pas encore -> creation greenfield. Le pattern d'export `getClientIp` / `getClientIpOrUnknown` ne collide avec aucun symbole existant (verification grep).

### Decisions cadrage (D1-D4)

- **D1 — `@vercel/functions` en dependency directe** (vs transitif) : ajoute en `dependencies` plutot que de dependre du transitif. Justification : (a) la version peut etre pinned independamment de Next.js / Workflow, (b) une futurs major bump de Next.js qui retire le transitif ne casse pas le projet, (c) clarte du fichier `package.json` (la dependance est intentionnelle).
- **D2 — `getClientIp` (null) vs `getClientIpOrUnknown` (string)** : deux fonctions distinctes plutot qu'une fonction `getClientIp(headers, fallback?: string)`. Justification : (a) signature plus claire au call-site (le lecteur sait immediatement si on tolere null), (b) typage TypeScript exact (`string | null` vs `string`), (c) pas de magic string `'unknown'` au call-site.
- **D3 — Garde-fou par grep vs ESLint custom rule** : grep simple plutot que rule ESLint custom. Justification : (a) zero dependance ESLint additionnelle, (b) executable depuis `vercel.json:buildCommand` sans charger l'AST TypeScript, (c) execution rapide (<100 ms), (d) detection de patterns string non-AST (`'x-forwarded-for'` vs identifiants). Limitation : un fichier qui contient `x-forwarded-for` en commentaire serait flagged. **Tradeoff acceptable** : si commentaire necessaire, l'ecrire sans tirets (`xforwardedfor`) ou en majuscule ; la presence d'un commentaire mentionnant directement le header devrait declencher revue manuelle.
- **D4 — `test:unit` vs extension `test:integration`** : trancher en Subtask 1.6 selon retours review. **Recommandation initiale** : dedier `"test:unit": "vitest run --include 'tests/unit/**/*.test.ts'"` + alias `"test": "vitest run"` (umbrella). Justification : separation conceptuelle (les tests unitaires tournent en <1 s sans Supabase, executable en pre-commit hook ; les tests integration prennent ~30 s + Supabase local).

### References

- [Source: epic-4.md#Story-4.5] : « Migration vers `request.ip` Vercel API native ou `x-vercel-forwarded-for` (header trusted Vercel-only) ». **Note de la story 4.5** : la spec parle de `x-vercel-forwarded-for` et `request.ip` ; en realite (a) `request.ip` n'existe plus dans Next.js 16, (b) le header sanitise dispo via SDK Vercel est `x-real-ip` (constante `IP_HEADER_NAME` dans `node_modules/@vercel/functions/headers.d.ts:12`). La story livre donc la **bonne** primitive plutot que la spec litterale.
- [Source: epic-4.md#Notes-implementation-Story-4.5] : « Coupler avec story 4.1 (Sentry) - les events rate-limit doivent inclure l'IP cliente verifiee ». **Acquit** : la story 4.1 emet `keyHash` HMAC-sale (pas l'IP brute) pour respecter PII. Cette story 4.5 ne modifie pas Sentry — l'IP cliente n'est jamais envoyee a Sentry (par design, story 4.1 D3 / DECISIONS F4).
- [Source: epic-4.md#Notes-implementation-Story-4.5] : « Reference Vercel : https://vercel.com/docs/edge-network/headers#x-forwarded-for ». **Update** : la doc actualisee (skill `vercel:routing-middleware` + `node_modules/@vercel/functions/headers.d.ts:12`) pointe sur `x-real-ip` (`IP_HEADER_NAME`). C'est ce header qui est sanitise et doit etre lu via `ipAddress()`.
- [Source: app/actions/parrainage.ts:332-342] : TODO + 3 lignes detection IP a supprimer.
- [Source: app/actions/auth.ts:93-97] : detection IP a remplacer.
- [Source: app/actions/waitlist.ts:41-45] : detection IP a remplacer.
- [Source: lib/rate-limit-hash.ts] : pattern helper pur sans dependance metier — modele pour `lib/get-client-ip.ts`.
- [Source: lib/supabase/server.ts] : pattern `createClient({ serviceRole: true })` (non utilise par cette story, reference pour les call-sites).
- [Source: node_modules/@vercel/functions/headers.d.ts:95] : signature officielle `ipAddress(input: Request | Headers): string | undefined`.
- [Source: node_modules/@vercel/functions/headers.js:36] : constante `IP_HEADER_NAME = "x-real-ip"`.
- [Source: scripts/check-required-env.mjs] : modele pour `scripts/check-ip-spoofing.mjs` (pattern Node.js mjs + exit code + log clair).
- [Source: vercel.json:6 buildCommand] : pattern d'extension de la chaine de checks.
- [Source: DECISIONS.md F1-F9] : pattern de redaction d'une nouvelle decision F.
- [Source: epic-4.md retro AI-3.5] : « Hardening IP spoofing (`request.ip` Vercel) ».
- [Source: _bmad-output/planning-artifacts/architecture-technique-roxanetnous-2026-02-09.md:3856] : reference historique `request.ip` (depreciee, voir Dev Notes).

### Previous Story Intelligence (synthese stories 4.1, 4.4, 4.7, 4.8)

- **Story 4.1 done (2026-05-08)** : Sentry SDK installe + helper `lib/rate-limit-hash.ts` + tag `flow:parrainage signal:rate-limit-validate-code` deja en place. Cette story 4.5 ne touche **PAS** la logique Sentry — elle migre uniquement la primitive de detection IP qui sert a calculer `key = validate_code:<ip>`.
- **Story 4.4 done (2026-05-09)** : Vitest v4 installe + `vitest.config.ts` au root + `tests/integration/` greenfield + script `npm run test:integration` + GHA workflow `.github/workflows/integration-tests.yml`. Cette story 4.5 etend `tests/` avec un nouveau sous-dossier `tests/unit/` et reutilise Vitest sans nouveau tooling.
- **Story 4.7 done (2026-05-09)** : seeds Supabase + 28 migrations historiques sync. Cette story 4.5 n'utilise pas les seeds (tests unitaires purs sans BDD).
- **Story 4.8 done (2026-05-09)** : `scripts/check-required-env.mjs` separation REQUIRED vs OPTIONAL_ON_PREVIEW + integration `vercel.json:buildCommand`. Cette story 4.5 reutilise le pattern (`scripts/check-ip-spoofing.mjs`) pour son garde-fou.
- **Convention de commits** (Sylvain, projet roxanetnous) : `Story X.Y : <verbe> <objet>` (ex : `Story 4.5 : helper get-client-ip + migration 3 call-sites + DECISIONS F10`). Pas d'emojis. Pas de format `feat:`/`fix:`. Voir commits recents `da04d55`, `c505f78`, `caf695f`.
- **Convention status story** : `ready-for-dev` (apres create-story) -> `in-progress` (debut dev-story) -> `review` (fin dev-story) -> `done` (apres CI verte 2 runs consecutifs + code review applique). Voir story 4.4 final status.

### Git Intelligence Summary (5 derniers commits pertinents)

- `c505f78 Story 4.8 : separation REQUIRED vs OPTIONAL_ON_PREVIEW dans check-required-env` -> pattern `scripts/check-*.mjs` reutilisable pour `check-ip-spoofing.mjs`.
- `6beac3a Stories 4.4 + 4.7 : code review 13 patches applies + statut done` -> pattern code review consolidate sur 1 commit.
- `7bd4792 Story 4.7 phase 2 : seeds Supabase + script seed-test + DECISIONS F9 + statut review` -> pattern phases multiples + ajout decision DECISIONS.
- `c9a7aa0 Story 4.3 : statut done apres CI Vercel verte` -> convention de cloture story apres CI verte.
- `d3406d0 Story 4.4 : tests metier Stripe webhook + paywall (Vitest v4 + GHA workflow + DECISIONS F8)` -> commit livraison principal d'une story tooling.

### Latest Tech Information (Vercel + Next.js 16)

- **`@vercel/functions@^3.5.0`** : SDK officiel pour les helpers Vercel (`ipAddress`, `geolocation`, `waitUntil`, `next`, `rewrite`). Compatible Edge runtime + Node.js runtime. **Stable**.
- **`Next.js 16`** : `request.ip` retire definitivement (deprecie depuis 13.4). Pattern moderne = `headers()` + SDK Vercel.
- **Vercel Routing Middleware** (cf. skill `vercel:routing-middleware`) : recommandation officielle est d'utiliser `ipAddress(request)` du SDK pour la detection IP. Le SDK sait quel header utiliser selon la plateforme (sur Vercel : `x-real-ip` sanitise).
- **Header `x-real-ip`** sur Vercel : reecrit par Vercel Proxy a chaque requete a partir du tunnel TLS. Spoofing-proof. Reference : `https://vercel.com/docs/edge-network/headers`.
- **Bun runtime support** : `@vercel/functions` est compatible Bun via `bunVersion` dans `vercel.json` (pas utilise par le projet roxanetnous, qui reste Node 24+ par defaut Vercel).
- **CVE-2025-29927** (Next.js middleware bypass via `x-middleware-subrequest`) : **non applicable** a cette story (pas de middleware ajoute, pas d'auth route protection touchee). Le projet est en Next.js 16.1.6 (corrige).

### Project Context Reference

- `_bmad-output/planning-artifacts/architecture-technique-roxanetnous-2026-02-09.md:3854-3889` : exemple de middleware avec `request.ip` — **reference historique uniquement** (Next.js 16 retire `request.ip`, l'exemple est obsolete).
- `_bmad-output/planning-artifacts/epic-4.md` Story 4.5 : spec source de cette story.
- `_bmad-output/implementation-artifacts/epic-3-retro-2026-05-07.md` AI-3.5 : « Hardening IP spoofing — `request.ip` Vercel — bloquant : non. Vercel sanitize en prod, risque uniquement hors-prod. ».
- `DECISIONS.md` F1-F9 : modele de redaction.
- `.claude/CLAUDE.md` : regles strictes projet (pas d'emojis, axe-core obligatoire avant commit livraison).

## Dev Agent Record

### Agent Model Used

claude-opus-4-7

### Debug Log References

- **Tests unitaires** : `npm run test:unit` -> 5 tests U1-U5 verts en 119 ms (Vitest 4 multi-projets `unit` distinct).
- **TypeScript** : `npx tsc --noEmit` exit 0 apres nettoyage `rm -rf .next` (artefacts macOS dupliques `.next/types/cache-life.d 2.ts`, `routes.d 2.ts`, `validator 2.ts` non lies a la story — symbol duplicates qui n'apparaissent pas en CI Vercel propre).
- **Build Next.js** : `SKIP_E2E_TESTS=true npm run build` exit 0. 79 routes generees, sitemap.xml ISR 1y, middleware proxy actif.
- **Lint** : `npm run lint` -> 0 erreur, 226 warnings (baseline preservee). `npm run lint:a11y-check` -> 155 violations baseline, 0 regression.
- **a11y axe-core** : `npm run a11y:axe:check` -> 0 violations Critical/Serious sur 7 parcours (baseline 2026-05-05 commit a0cdb8a).
- **Garde-fou ip-spoofing** : `npm run check:ip-spoofing` exit 0. Allowlist : `lib/get-client-ip.ts` (commentaire d'entete documentant le pattern interdit) + `scripts/check-ip-spoofing.mjs` (regex grep).
- **Audit grep manuel** : `grep -rEn "x-forwarded-for|x-real-ip" --include='*.ts' --include='*.tsx' --include='*.mjs' app/ lib/ scripts/ | grep -v allowlist` -> 0 ligne. AC10 satisfait.
- **`@vercel/functions` direct dependency** : `npm ls @vercel/functions` -> `roxanetnous@1.0.0 -> @vercel/functions@3.5.0` + `@workflow/next/@workflow/core/@vercel/functions deduped`. AC2 satisfait.
- **Aucun `as any` introduit** : `git diff main -- '*.ts' '*.tsx' | grep -E "^\+.*as any"` -> 0 match. AC12 satisfait.

### Completion Notes List

**Resume de l'implementation Story 4.5 — Hardening IP spoofing :**

1. **Helper centralise `lib/get-client-ip.ts`** (greenfield, 24 lignes) : delegue a `ipAddress()` du SDK `@vercel/functions@^3.5.0` (lit `x-real-ip` sanitise par Vercel Proxy). Deux exports : `getClientIp(headers): string | null` et `getClientIpOrUnknown(headers): string`. Type `RequestHeaders` exporte. Aucune dependance Next.js / Supabase / Sentry -> portable middleware Edge / Node / Workflow.

2. **`@vercel/functions@^3.5.0` ajoute en `dependencies` directe** (vs transitif pre-livraison via `@workflow/next` + `next`). Lock minimal : 1 ligne ajoutee `package-lock.json` (deduped avec le transitif existant).

3. **3 call-sites migres** :
   - `app/actions/parrainage.ts` : suppression TODO lignes 332-333 + 5 lignes XFF -> 1 ligne `getClientIpOrUnknown(h)`. Acquittement TODO `parrainage.ts:332` (« story 4.5 : remplacer x-forwarded-for ») = AI-3.5 retro Epic 3 leve.
   - `app/actions/auth.ts` : 5 lignes XFF -> 1 ligne `getClientIp(h)`. Format `ipInscription: string | null` preserve, signature `createParrainageRelation` inchangee.
   - `app/actions/waitlist.ts` : 5 lignes XFF -> 1 ligne `getClientIp(headersList)`. Le `?? 'unknown'` local au call-site rate-limit ligne 55 conserve (D2 — `null` pour BDD, `'unknown'` pour cle rate-limit).

4. **Tests unitaires `tests/unit/get-client-ip.test.ts`** (5 cas U1-U5) : verifient le contrat anti-spoofing. U4 garantit explicitement que le helper N'utilise PAS `x-forwarded-for` directement (test de non-regression). Pattern `makeHeaders(entries: Record<string, string>)` factory pour eviter `as any`.

5. **`vitest.config.ts` multi-projets** : projet `integration` (Supabase + setup lourd story 4.4) + projet `unit` (Vitest natif, 0 setup, <200 ms). Scripts `test`, `test:unit`, `test:integration` distincts.

6. **Garde-fou `scripts/check-ip-spoofing.mjs`** (~70 lignes) : grep recursif `app/ lib/ scripts/` pour `x-forwarded-for|x-real-ip`, exclut `*.test.ts`, allowlist explicite `lib/get-client-ip.ts` + `scripts/check-ip-spoofing.mjs`. Exit 0/1 + message diagnostique. Integre `vercel.json:buildCommand` apres `lint:a11y-check`.

7. **DECISIONS.md F10** : section dataise 2026-05-09. Decision + motivation (anti-spoofing + portabilite + clarte + levee dette) + alternatives rejetees (`request.ip` Next.js retire, `x-vercel-forwarded-for` inexistant SDK, fonction unique `getClientIp(headers, fallback?)` rejetee, ESLint custom rule rejetee, `@vercel/functions` transitif rejete, runner Vitest unique rejete) + pattern d'integration + pattern interdit + regle futures stories.

**Decisions cadrage appliquees :**
- **D1** : `@vercel/functions` en `dependencies` directe (vs transitif).
- **D2** : 2 fonctions distinctes (`getClientIp` null / `getClientIpOrUnknown` string) plutot qu'une fonction avec parametre fallback.
- **D3** : garde-fou par grep mjs (vs ESLint custom rule). Allowlist necessaire pour le helper et le script eux-memes.
- **D4** : Vitest multi-projets `integration` + `unit` (vs runner unique). Justification ajoutee : le setup integration mock Supabase/Sentry/Resend/Stripe — inutile et confondant pour des tests unitaires purs.

**Acceptance Criteria couverts (16/17) :**
- AC1 (helper) : ok. AC2 (dependency directe) : ok. AC3 (parrainage.ts) : ok. AC4 (auth.ts) : ok. AC5 (waitlist.ts) : ok. AC6 (tests U1-U5) : ok. AC7 (garde-fou + buildCommand) : ok. AC8 (DECISIONS F10) : ok. AC9 (scripts test:unit) : ok. AC10 (audit grep 0 ligne) : ok. AC11 (rate-limit format inchange) : ok local, validation BDD post-deploy. AC12 (typage strict, 0 `as any`) : ok. AC13 (build/lint/a11y verts) : ok. AC14 (pas de modif UI) : ok. AC15 (perimetre fichiers) : ok. AC16 (verifications PR) : partiellement local + reste en deploy preview. AC17 (suivi 7 jours) : plan documente ci-dessous.

**Note sur AC16 (verifications manuelles deploy preview) :**
- (a) `npm run test:unit` -> 5/5 verts en 119 ms : OK local.
- (b) `npm run check:ip-spoofing` -> exit 0 : OK local.
- (c) Audit grep -> 0 ligne hors allowlist : OK local.
- (d) `git diff --stat` borne : OK (10 fichiers modifies + 4 nouveaux, perimetre AC15).
- (e) `npm run build` exit 0, `npm run lint` 0 nouvelle erreur, `npm run a11y:axe:check` 0 violations : OK local.
- (f) Test regression rate-limit `validateCode` 6 tentatives : **a executer sur deploy preview Vercel apres ouverture PR**.
- (g) Test regression waitlist 6 inscriptions <10 min : **a executer sur deploy preview Vercel apres ouverture PR**.
- (h) Audit BDD `waitlist_departements.ip_inscription` post-preview via Supabase MCP : **a executer apres deploy preview**.
- (i) Verifier `headers().get('x-real-ip')` retourne IP non-null en preview Vercel : **a executer ad-hoc, ne PAS commit le console.log temporaire**.

**Plan de suivi 7 jours post-merge (AC17) :**
- **D+0 a D+7 (2026-05-09 -> 2026-05-16)** : audit Sentry quotidien sur les signaux `signal:rate-limit-validate-code`, `signal:rate-limit-rpc-error`, `flow:parrainage`. Verifier que la frequence des declenchements rate-limit ne chute pas anormalement (proportionnelle au trafic — un drop > 80% sans drop trafic = signal de regression de la detection IP).
- **D+1 puis D+7** : audit BDD via Supabase MCP `SELECT count(*) FILTER (WHERE ip_inscription IS NULL) AS null_count, count(*) AS total FROM parrainages WHERE created_at > '2026-05-09'`. Avant la story, on s'attend a ~0% NULL en prod (Vercel Proxy injecte XFF) ; apres, on s'attend a ~0% NULL en prod (Vercel Proxy injecte XRI). Si la proportion bascule a >50% NULL, c'est un signal que `x-real-ip` n'est pas injecte sur certaines routes (a investiguer cote Vercel headers).
- **D+1** : meme audit pour `waitlist_departements.ip_inscription`.
- **Si regression detectee** : hotfix story 4.5.b ouverte (rollback ciblee : reintroduire `getClientIp` avec fallback `x-forwarded-for` strict-Vercel-only via `headers().get('x-vercel-forwarded-for')` si dispo). Pas attendu — Vercel Proxy injecte `x-real-ip` sur toutes les requetes function/middleware (cf. `node_modules/@vercel/functions/headers.js:36` `IP_HEADER_NAME = "x-real-ip"`).

### File List

**Nouveaux fichiers (4) :**
- `lib/get-client-ip.ts` — helper centralise `getClientIp` + `getClientIpOrUnknown` + type `RequestHeaders` (24 lignes).
- `tests/unit/get-client-ip.test.ts` — tests unitaires Vitest 5 cas U1-U5 (44 lignes).
- `scripts/check-ip-spoofing.mjs` — garde-fou grep + allowlist + exit code (70 lignes).
- `tests/unit/` — repertoire greenfield.

**Fichiers modifies (10) :**
- `package.json` — ajout `@vercel/functions: ^3.5.0` dependency, scripts `test`, `test:unit`, `test:integration` (refactor projet Vitest), `check:ip-spoofing`.
- `package-lock.json` — regen minimal (1 ligne, dependency promue de transitive a directe deduped).
- `vercel.json` — `buildCommand` etendu : `npm run check:ip-spoofing` ajoute apres `lint:a11y-check`.
- `vitest.config.ts` — refactor multi-projets `integration` + `unit` (D4).
- `app/actions/parrainage.ts` — import `getClientIpOrUnknown`, suppression TODO + 5 lignes XFF -> 1 ligne (lignes 332-342 -> ~336-339).
- `app/actions/auth.ts` — import `getClientIp`, 5 lignes XFF -> 1 ligne (lignes 92-97 -> ~93-94).
- `app/actions/waitlist.ts` — import `getClientIp`, 5 lignes XFF -> 1 ligne (lignes 41-45 -> ~42).
- `DECISIONS.md` — section F10 ajoutee (~50 lignes apres F9).
- `_bmad-output/implementation-artifacts/sprint-status.yaml` — `4-5-hardening-ip-spoofing` ready-for-dev -> in-progress -> review.
- `_bmad-output/implementation-artifacts/4-5-hardening-ip-spoofing.md` — checkboxes Tasks/Subtasks + Dev Agent Record + File List + Change Log + DoD a11y + Status.

**Total :** 4 nouveaux + 10 modifies, ~250 lignes ajoutees, ~20 lignes supprimees (3 blocs XFF de 5 lignes chacun + 2 lignes TODO).

## Change Log

| Date | Version | Description | Author |
| --- | --- | --- | --- |
| 2026-05-09 | 1.0 | Helper `lib/get-client-ip.ts` (greenfield) + migration 3 call-sites parrainage/auth/waitlist (suppression TODO `parrainage.ts:332`, acquit AI-3.5 retro Epic 3) + tests unitaires Vitest 5 cas U1-U5 + garde-fou `npm run check:ip-spoofing` integre `vercel.json:buildCommand` + DECISIONS.md F10 + Vitest multi-projets `integration`/`unit`. Status -> review. | Amelia (dev agent) |

## DoD a11y

A renseigner pour toute story avec impact UI (ignorer si pas de changement visuel/interactif) :

**Cette story est strictement backend / tooling. Aucun composant UI touche. Cf. AC14.**

- [N/A] Labels associes aux champs (`htmlFor` ou `aria-labelledby`) — pas de formulaire touche
- [N/A] Erreurs liees aux champs via `aria-describedby` + `aria-invalid` — pas d'erreur UI
- [N/A] Focus visible sur tous les elements interactifs (contraste >= 3:1) — pas d'element interactif touche
- [N/A] Contrastes texte >= 4,5:1 et UI >= 3:1 — pas de texte ni UI touchee
- [N/A] ARIA states corrects sur composants dynamiques — pas de composant dynamique
- [N/A] Navigation clavier complete — pas d'interaction clavier touchee
- [N/A] Verification ponctuelle au lecteur d'ecran — pas de surface ecran touchee
- [x] Pas de regression `eslint-plugin-jsx-a11y` (`npm run lint:a11y-check` vert local 2026-05-09 : 155 violations baseline preservee, 0 regression)
- [x] Pas de regression axe-core (`npm run a11y:axe:check` vert local 2026-05-09 : 0 violations Critical/Serious sur 7 parcours, baseline 2026-05-05 commit a0cdb8a39f3bf5bce2856c1ff2065bb910901c41 preservee)
