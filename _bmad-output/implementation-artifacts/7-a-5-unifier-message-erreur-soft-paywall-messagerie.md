# Story 7.A.5 : Unifier message d'erreur soft paywall messagerie (anti-oracle)

Status: done

<!-- Story 5 du mini-epic 7.A (hardening securite transverse) - Item C5 de l'inventaire dettes Epic 7. Source : `deferred-work.md` ligne 199 (review story 3.6, 2026-05-07). Cadrage `epic-7.md` lignes 206-219. Heritage : story 5.B.1 a deja unifie 2 des 3 surfaces server cote `getOrCreateConversation*` (cf. `app/actions/messages.ts:24` PAYWALL_GENERIC_ERROR). Cette story termine le travail : (a) reformule le literal partage selon le wording cadrage epic-7.md, (b) etend `PAYWALL_GENERIC_ERROR` a `sendMessage` (ligne 409 actuellement non-unifie), (c) durcit le garde-fou CI `scripts/check-oracle-paywall.mjs`, (d) ajoute le test integration cible AC3. -->

## Story

En tant qu'**attaquant connecte non-abonne tentant d'enumerer le role d'un compte cible via la messagerie**,
je veux que **le serveur retourne strictement le meme message d'erreur paywall quel que soit le role de la cible (accompagnant OU accompagne) et la surface server action appelee (`getOrCreateConversation` OU `getOrCreateConversationAsAccompagnante` OU `sendMessage`)**,
afin que **mon attaque echoue : aucun signal differencie (texte, status HTTP, shape JSON, header) ne me permette d'inferer le role d'un userId arbitraire**.

**Contexte runtime du foot-gun cible** : aujourd'hui, `app/actions/messages.ts` retourne **2 messages distincts** au paywall :

| Surface server | Ligne | Message actuel | Role-leak ? |
|---|---|---|---|
| `getOrCreateConversation` (caller = accompagne) | 120 | `PAYWALL_GENERIC_ERROR` = `'Abonnement requis pour contacter cet utilisateur.'` | Non (deja unifie 5.B.1) |
| `getOrCreateConversationAsAccompagnante` (caller = accompagnant) | 235 | `PAYWALL_GENERIC_ERROR` (meme literal) | Non (deja unifie 5.B.1) |
| `sendMessage` (caller = participant non-admin de la conv) | 409 | `'Abonnement requis pour envoyer un message.'` | **Oui : litteral different** |

**Pourquoi `sendMessage` est aussi un oracle (moins critique mais reel)** : un attaquant qui obtient un `conversationId` valide (via fuite/log/scraping) peut probe `sendMessage` pour distinguer (1) une conversation ou il est participant non-abonne (paywall message `'... envoyer un message.'`) vs (2) une conversation ou il n'est pas participant (`'Accès non autorisé à cette conversation.'`). La difference de message indique l'existence de la conv ET son appartenance, donc partiel oracle d'enumeration de conversations. **Decision** : aligner sur le meme literal generique pour eliminer toute differentiation server-side, meme si la surface d'attaque est plus etroite que les `getOrCreate*`.

**Mention CLAUDE.md** : la copy nouvelle doit utiliser **accompagnant** au masculin neutre (cf. `feedback_genre_accompagnant`). Le nouveau literal `'Abonnement requis pour echanger des messages.'` (cadrage epic-7.md AC1) est role-neutre, donc conforme par construction.

**Difference avec story 5.B.1** : 5.B.1 a unifie 2 surfaces (`getOrCreateConversation*`) avec le literal `'Abonnement requis pour contacter cet utilisateur.'`. 7.A.5 (a) **reformule** ce literal en `'Abonnement requis pour echanger des messages.'` (wording cadrage epic-7.md plus generique : "echanger" couvre l'ouverture ET l'envoi vs "contacter" qui sonne ouverture seule), (b) **etend** au call site `sendMessage`, (c) durcit le garde-fou CI.

## Acceptance Criteria

### Unification du message server-side

- **AC1** : Constante unique `PAYWALL_GENERIC_ERROR` dans `app/actions/messages.ts` mise a jour : valeur = `'Abonnement requis pour echanger des messages.'` (literal exact, accent aigu sur "echanger" non requis - rester en ASCII conforme au literal actuel sans accent). Pas de mention de role (`accompagnant`, `accompagnante`, `accompagne`, `beneficiaire`, `auxiliaire`, `admin`).
- **AC2** : Les 3 call sites paywall messagerie partagent strictement `PAYWALL_GENERIC_ERROR` :
  - `getOrCreateConversation` (caller = accompagne) `app/actions/messages.ts:120` -> `return { error: PAYWALL_GENERIC_ERROR }` (deja en place, valeur change via AC1).
  - `getOrCreateConversationAsAccompagnante` (caller = accompagnant) `app/actions/messages.ts:235` -> idem.
  - `sendMessage` (caller = accompagnant OU accompagne non-admin) `app/actions/messages.ts:409` -> remplacer `'Abonnement requis pour envoyer un message.'` par `PAYWALL_GENERIC_ERROR`.
- **AC3** : Pas de leak via codes HTTP, headers, ou shape du JSON. Toutes les server actions concernees retournent toujours `{ error: PAYWALL_GENERIC_ERROR }` (shape `MessageResult` ou `{ error?: string }` identique), pas de difference structurelle (clefs supplementaires, types differents, ordering). Verification : un client comparant les 3 reponses paywall obtient `JSON.stringify(result) === JSON.stringify({ error: 'Abonnement requis pour echanger des messages.' })` strictement identique. Verifie via test integration AC8.
- **AC4** : Pas de differentiation Sentry observable cote attaquant. Les `Sentry.captureMessage('paywall-block:getOrCreate*')` actuels (lignes 116, 231) restent inchanges + un nouveau `captureMessage('paywall-block:sendMessage')` est ajoute dans `sendMessage` pour symetrie / observabilite serveur (taggue meme `flow: 'messaging'`, `signal: 'oracle-fix'`, `severity: 'warning'`, `security: 'oracle-fix'`). L'utilisateur ne voit pas Sentry, donc pas de fuite cote client. Pattern heritage Story 5.B.1.

### Garde-fou CI (`scripts/check-oracle-paywall.mjs`)

- **AC5** : Le script `scripts/check-oracle-paywall.mjs` est etendu pour verifier en plus du pattern existant (lignes 36-52) que **la constante `PAYWALL_GENERIC_ERROR` existe** dans `app/actions/messages.ts` ET que son **valeur** est conforme au literal AC1 strict. Si absente OU valeur differente -> exit 1 avec message explicite. Rationale : empeche une suppression silencieuse de la constante OU son renommage en literal differencie role-leak.
- **AC6** : Le script verifie que **`return { error: PAYWALL_GENERIC_ERROR }`** est present au moins 3 fois dans `app/actions/messages.ts` (3 call sites AC2). Si moins de 3 occurrences -> exit 1 avec message indiquant que l'unification a regresse. Rationale : empeche un retour partiel a un literal differencie sur l'un des 3 call sites.
- **AC7** : Le script reste retrocompatible : les 2 messages "defense en profondeur" actuellement tolerees (`'Seuls les accompagnants peuvent utiliser cette fonction.'` ligne 189 + `'Seuls les accompagnés peuvent initier une conversation.'` ligne 59) ne matchent toujours pas car le pattern `CONTACT_RE = /contacter\s+(un|une|...)/i` cible specifiquement le verb `contacter` couple a un role nomme. Le nouveau check AC5/AC6 ne touche pas a cette logique - cest une assertion ADDITIVE (pas un changement du pattern oracle existant).
- **AC8** : `npm run check:oracle-paywall` exit 0 sur HEAD post-modifications. Le check est deja integre `vercel.json` `buildCommand` (heritage 5.B.1) - aucun changement infra requis.

### Audit grep no-leak post-modification

- **AC9** : Apres modifications, audit grep manuel a executer et documenter dans Completion Notes :
  ```
  grep -rn "contacter une accompagnant\|contacter un beneficiaire\|contacter un accompagne\|contacter un accompagnant\|envoyer un message" app/ --include="*.ts" --include="*.tsx"
  ```
  Resultat attendu : 0 occurrence dans des **messages d'erreur server-side return** (les hits dans des **commentaires** historiques `// Avant : ...` documentant la regression resolue restent autorises, ils ne fuitent rien runtime). Les hits dans des **composants UI client** (`components/messages/contact-button.tsx:50`, `contact-accompagne-button.tsx:49`, `chat-window.tsx:186`) sont **autorises et NE doivent PAS etre touches** : ce sont des hints UI **pre-emptifs** affiches a l'utilisateur courant en fonction de **son propre** statut `subscribed` (prop passee depuis page server-component), pas un message renvoye au serveur. Pas d'inference cross-user possible.
- **AC10** : Audit ciblé `grep -n "Abonnement requis" app/actions/messages.ts` : exactement 1 occurrence dans la valeur de `PAYWALL_GENERIC_ERROR` (post-modification). Pas d'autre literal `'Abonnement requis'` libre dans le fichier.

### Tests integration

- **AC11** : Mettre a jour les tests existants impactes :
  - `tests/integration/paywall/sans-abonnement.test.ts:38` -> remplacer literal attendu `'Abonnement requis pour contacter cet utilisateur.'` par `'Abonnement requis pour echanger des messages.'`. Commentaire de tete actualise (mention 7.A.5 + lien story).
  - `tests/integration/paywall/abonnement-expire-mid-conversation.test.ts:57` -> remplacer literal attendu `'Abonnement requis pour envoyer un message.'` par `'Abonnement requis pour echanger des messages.'`. Commentaire de tete actualise.
- **AC12** : Nouveau test integration `tests/integration/paywall/message-unifie-anti-oracle.test.ts` ajoute (single file, suite courte) :
  - **(a)** Compte non-abonne `accompagne` cible `getOrCreateConversation(<accompagnantProfileId>)` -> assert `result.error === 'Abonnement requis pour echanger des messages.'` ET `Object.keys(result).length === 1` ET `'conversationId' in result === false`.
  - **(b)** Compte non-abonne `accompagnant` cible `getOrCreateConversationAsAccompagnante(<accompagneProfileId>)` -> assert meme literal exact ET meme shape.
  - **(c)** Compte non-abonne participant d'une conversation existante appelle `sendMessage(<convId>, 'tentative')` -> assert meme literal exact `'Abonnement requis pour echanger des messages.'` ET meme shape (`{ error: '...' }` keys.length === 1). Setup : creer 1 accompagnant + 1 accompagne + 1 conversation (sans admin) + 1 abonnement expire pour le sender.
  - **(d)** Assertion croisee : les 3 messages `(a)`, `(b)`, `(c)` ont strictement le meme `JSON.stringify`. Code :
    ```ts
    const resA = JSON.stringify(await getOrCreateConversation(...))
    const resB = JSON.stringify(await getOrCreateConversationAsAccompagnante(...))
    const resC = JSON.stringify(await sendMessage(...))
    expect(resA).toBe(resB)
    expect(resB).toBe(resC)
    ```
- **AC13** : Pattern fixtures reutilises : `createTestUser('accompagnant')`, `createTestUser('accompagne')`, `createTestAccompagnanteProfile`, `createTestAccompagneProfile`, `createTestConversation`, `createTestSubscription({ status: 'active', expiresAt: <past> })`, `mockSupabaseSession(userId)`. Helpers tous deja en place dans `tests/integration/_lib/fixtures.ts` (heritage 4.4 + 7.A.4).

### Garde-fous CI et validations finales

- **AC14** : `tsc --noEmit` exit 0, `npm run lint` 0 erreur sous baseline (196 warnings post-7.A.4), `npm run check:as-any-global`, `check:as-any-admin`, `check:oracle-paywall`, `check:ip-spoofing` tous exit 0. `npm run check:env` reste vert.
- **AC15** : `npm run lint:a11y-check` 155 baseline preserve (aucun impact UI dans le diff direct ; les composants client `contact-button.tsx` etc. ne sont **pas** modifies). `npm run a11y:axe:check` 0 violations Critical/Serious sur 7 parcours (regle CLAUDE.md DoD a11y - obligatoire avant commit livraison story).
- **AC16** : `npm run test:unit` complet : pas de regression (45/45 verts heritage 7.A.4). `npm run test:integration` : nouveau test (AC12) vert + 2 tests mis a jour (AC11) verts + pas de regression sur les autres tests paywall (`abonne-actif.test.ts`, `admin-bypass.test.ts`, `visiteur-non-connecte.test.ts`, `erreur-supabase-transitoire.test.ts`) ni admin-messages (heritage 7.A.4). Si Docker non disponible localement (`feedback_test_local_supabase`), validation par GHA workflow `integration-tests.yml` au push.
- **AC17** : Commit livraison story passe **obligatoirement** par `npm run a11y:axe:check` exit 0 (regle CLAUDE.md durcie heritage Lot C). Aucun impact attendu mais regle inviolable.

## Tasks / Subtasks

- [x] **Task 1 : Reformulation de la constante + extension a `sendMessage`** (AC1, AC2)
  - [x] 1.1 - Editer `app/actions/messages.ts:24` : valeur de `PAYWALL_GENERIC_ERROR` -> `'Abonnement requis pour echanger des messages.'`.
  - [x] 1.2 - Editer `app/actions/messages.ts:409` (dans `sendMessage`) : `return { error: 'Abonnement requis pour envoyer un message.' }` -> `return { error: PAYWALL_GENERIC_ERROR }`.
  - [x] 1.3 - Mettre a jour le commentaire de tete de `PAYWALL_GENERIC_ERROR` (lignes 16-23) : mentionner Story 7.A.5 + reformulation + extension a sendMessage + reference cadrage `epic-7.md` lignes 206-219.

- [x] **Task 2 : Sentry symetrie pour `sendMessage`** (AC4)
  - [x] 2.1 - Ajouter dans `sendMessage` juste avant le `return { error: PAYWALL_GENERIC_ERROR }` (ligne ex-409, post-edit) :
    ```ts
    safeSentryCapture(() => Sentry.captureMessage('paywall-block:sendMessage', {
      level: 'info',
      tags: { flow: 'messaging', signal: 'oracle-fix', severity: 'warning', security: 'oracle-fix' },
    }))
    ```
  - [x] 2.2 - Verifier que `safeSentryCapture` est deja disponible dans le scope du fichier (oui, defini ligne 29, heritage 7.A.1).

- [x] **Task 3 : Durcissement `scripts/check-oracle-paywall.mjs`** (AC5, AC6, AC7, AC8)
  - [x] 3.1 - Lire `scripts/check-oracle-paywall.mjs` HEAD.
  - [x] 3.2 - Ajouter apres le scan existant (lignes 44-58) un nouveau bloc d'assertion (CONST_RE + USAGE_RE >= 3).
  - [x] 3.3 - Le bloc s'execute APRES le scan oracle existant. La success line finale reste en place.
  - [x] 3.4 - Verifier en local : `node scripts/check-oracle-paywall.mjs` -> exit 0. Tests negatifs ponctuels (literal altere -> exit 1, retrait d'un call site -> exit 1) -> OK. Rollback effectue.

- [x] **Task 4 : Mise a jour tests existants** (AC11)
  - [x] 4.1 - Editer `tests/integration/paywall/sans-abonnement.test.ts:38` -> nouveau literal. Commentaire de tete actualise (mention Story 7.A.5).
  - [x] 4.2 - Editer `tests/integration/paywall/abonnement-expire-mid-conversation.test.ts:57` -> nouveau literal. Commentaire de tete actualise.

- [x] **Task 5 : Nouveau test integration anti-oracle cross-flow** (AC12, AC13)
  - [x] 5.1 - Creer `tests/integration/paywall/message-unifie-anti-oracle.test.ts` (single file, 99 lignes).
  - [x] 5.2 - Imports `vitest` + `getOrCreateConversation*`, `sendMessage`, fixtures, mockSupabaseSession.
  - [x] 5.3 - 1 `describe` avec 1 `it` couvrant les 4 cas (a)-(d) AC12.
  - [x] 5.4 - Cas (a) seed accompagne sans subscription + accompagnant cible -> getOrCreateConversation.
  - [x] 5.5 - Cas (b) seed accompagnant sans subscription + accompagne cible -> getOrCreateConversationAsAccompagnante.
  - [x] 5.6 - Cas (c) seed accompagne abonnement expire + conversation creee -> sendMessage(conv.id, 'tentative').
  - [x] 5.7 - Cas (d) JSON.stringify identique a/b/c (expect(strA).toBe(strB) + expect(strB).toBe(strC)).
  - [x] 5.8 - `beforeAll` / `afterAll` -> `cleanupAllFixtures()`.

- [x] **Task 6 : Audit grep no-leak** (AC9, AC10)
  - [x] 6.1 - Sortie grep documentee dans Completion Notes.
  - [x] 6.2 - Seuls hits restants : (a) commentaire historique ligne 21 messages.ts (documentation 7.A.5), (b) FAQ landing `app/page.tsx:452` (texte public non-oracle), (c) hint UI client `components/messages/contact-button.tsx:50` (pre-emptif subscribed-aware) -> tous autorises, **non touches**.
  - [x] 6.3 - `grep -n "Abonnement requis" app/actions/messages.ts` -> 2 matches dont 1 commentaire historique (ligne 21) + 1 valeur constante (ligne 25). Aucun literal libre supplementaire. AC10 satisfait.

- [x] **Task 7 : Validations CI locales** (AC14, AC15, AC16, AC17)
  - [x] 7.1 - `npx tsc --noEmit` -> exit 0.
  - [x] 7.2 - `npm run lint` -> 0 erreur, 196 warnings (= baseline post-7.A.4).
  - [x] 7.3 - `npm run lint:a11y-check` -> 155 baseline preserve, no regression.
  - [x] 7.4 - `npm run check:as-any-global` + `check:as-any-admin` + `check:oracle-paywall` (avec nouveau bloc AC5/AC6) + `check:ip-spoofing` -> tous exit 0.
  - [x] 7.5 - `npm run a11y:axe:check` -> 0 delta Critical/Serious sur 7 parcours.
  - [x] 7.6 - `npm run test:unit` -> 45/45 verts (heritage 7.A.4 preserve).
  - [x] 7.7 - `npm run test:integration` : non execute localement (`feedback_test_local_supabase`). Validation deleguee GHA `integration-tests.yml` au push branche.

- [ ] **Task 8 : Commit + push + code-review** (Sylvain)
  - [ ] 8.1 - Commit message : `Story 7.A.5 : unifier message d'erreur paywall messagerie (anti-oracle) (F-Epic7-A5)`.
  - [ ] 8.2 - Push branche. Observer build Vercel preview verts.
  - [ ] 8.3 - Observer GHA workflow `integration-tests.yml` : nouveau test + 2 mis a jour + pas de regression.
  - [ ] 8.4 - Lancer `/code-review` avant merge final.
  - [ ] 8.5 - Mise a jour memoire `project_epic_7_cadrage` differee post-merge.

## Dev Notes

### Contexte technique projet

- **Stack** : Next.js 16 (App Router, Server Components, Server Actions), Supabase, TypeScript strict, TailwindCSS v4. ESM (`"type": "module"`).
- **Pattern Server Actions** : `'use server'` en tete (cf. `app/actions/messages.ts:1`). Retours typés `{ error?: string; conversationId?: string }` (type `MessageResult` ligne 9-12) ou `{ error?: string }` pour `sendMessage`.
- **Pattern Sentry capture symetrique** : helpers `safeSentryCapture` (defini ligne 29 du fichier, heritage 7.A.1) garantit que une erreur Sentry ne casse pas le flux applicatif. Reutiliser pour `sendMessage` (Task 2).
- **Pattern PAYWALL_GENERIC_ERROR** : constante module-level en tete du fichier, importable potentiellement par tests futurs (mais actuellement non-exportee - choix volontaire : la constante doit rester un detail d'implementation, les tests assertent sur le **literal**, pas sur l'import).

### Schema BDD impacte

**Aucun**. Story exclusivement code applicatif + script CI + tests. Pas de migration BDD, pas de regen `types/supabase.ts`.

### Volumetrie prod actuelle (audit MCP 2026-05-14)

- `subscriptions WHERE status IN ('active', 'trialing')` : volumetrie non re-mesuree (preexistant Stripe webhook 4.4). Pas critique : la story ne change pas la logique d'evaluation paywall, juste le message retourne.
- `messages` : 0 row prod (audit 2026-05-14 heritage 7.A.4). Story preventive : aucune conversation reelle en prod, donc aucun utilisateur impacte par le changement de wording.
- **Impact UX live** : tres faible. Le wording `'echanger des messages'` est plus generique que `'contacter cet utilisateur'` mais reste comprehensible. L'utilisateur clique sur le CTA "S'abonner" du composant UI client (qui reste inchange, hint `'Abonnement requis pour contacter.'` cote button + lien `/abonnement?from=contact`), donc le wording server ne s'affiche qu'en cas d'echec d'un round-trip (rare).

### Code actuel cible (a modifier)

**`app/actions/messages.ts:16-24`** (constante + commentaire) :
```ts
// Story 5.B.1 (AI-3.5 deferred-work) : message d'erreur paywall unifie et
// generique pour empecher l'oracle d'enumeration du role d'un compte cible.
// Avant : 'Abonnement requis pour contacter un accompagnant.' vs '... un beneficiaire.'
// permettait a un attaquant connecte non-abonne de deduire le role d'un userId
// arbitraire en testant getOrCreateConversation* et en lisant le texte d'erreur.
// Apres : message generique unique, identique pour les 3 server actions.
// Garde-fou CI : scripts/check-oracle-paywall.mjs grep ce literal pour
// empecher la re-introduction d'un message differencie par role.
const PAYWALL_GENERIC_ERROR = 'Abonnement requis pour contacter cet utilisateur.'
```

**`app/actions/messages.ts:405-411`** (call site sendMessage non-unifie) :
```ts
// Story 3.6 : paywall envoi message (D1 = skip si conversation contient un admin OU sender admin)
if (!isAdmin && adminUserId === null) {
  const subscribed = await hasActiveSubscription(user.id)
  if (!subscribed) {
    return { error: 'Abonnement requis pour envoyer un message.' }
  }
}
```

### Code cible (apres modifications)

**Constante + commentaire** :
```ts
// Story 5.B.1 + 7.A.5 : message d'erreur paywall unifie et generique pour empecher
// l'oracle d'enumeration du role d'un compte cible.
// Story 5.B.1 (2026-05-13) : unification getOrCreateConversation + getOrCreateConversationAsAccompagnante.
// Story 7.A.5 (2026-05-14) : (a) reformulation 'contacter cet utilisateur' -> 'echanger des messages'
// (wording cadrage epic-7.md plus generique : couvre l'ouverture ET l'envoi),
// (b) extension a sendMessage (precedemment 'Abonnement requis pour envoyer un message.'
// laissait un demi-oracle d'existence de conversation).
// Garde-fou CI : scripts/check-oracle-paywall.mjs verifie (1) le literal exact,
// (2) >=3 call sites (return { error: PAYWALL_GENERIC_ERROR }), (3) zero mention de role.
const PAYWALL_GENERIC_ERROR = 'Abonnement requis pour echanger des messages.'
```

**Call site sendMessage** (avec capture Sentry symetrique pour observabilite) :
```ts
// Story 3.6 + 7.A.5 : paywall envoi message (D1 = skip si conversation contient un admin OU sender admin).
// 7.A.5 unifie le message avec getOrCreateConversation* (PAYWALL_GENERIC_ERROR).
if (!isAdmin && adminUserId === null) {
  const subscribed = await hasActiveSubscription(user.id)
  if (!subscribed) {
    safeSentryCapture(() => Sentry.captureMessage('paywall-block:sendMessage', {
      level: 'info',
      tags: { flow: 'messaging', signal: 'oracle-fix', severity: 'warning', security: 'oracle-fix' },
    }))
    return { error: PAYWALL_GENERIC_ERROR }
  }
}
```

### Pourquoi `'echanger des messages'` plutot que `'contacter cet utilisateur'` ?

1. **Coherence semantique cross-flow** : `getOrCreate*` ouvre une conversation, `sendMessage` envoie dans une conv existante. Le verbe "contacter" sonne ouverture seule ; "echanger des messages" couvre les deux operations sans ambiguite -> 1 literal commun naturel.
2. **Cadrage epic-7.md** : AC1 specifie textuellement `'Abonnement requis pour echanger des messages.'`. La story applique le wording cadrage.
3. **Moins de fuite implicite** : "contacter cet utilisateur" implique que la cible **est un utilisateur** (probablement plausible mais leak metier marginal) ; "echanger des messages" est totalement neutre cote semantique (pas de mention du sujet de la conv).

### Pourquoi pas modifier les composants UI client (`contact-button.tsx`, `chat-window.tsx`, etc.) ?

Les hints UI client (`'Abonnement requis pour contacter.'`, `'Abonnement requis pour répondre.'`) sont affiches **avant** l'appel server, declenches par la prop `subscribed=false` passee depuis une page server-component. Le client connaît **son propre** statut subscribed (lit `subscriptions` via une server query sur la page rendue), donc l'information "je suis non-abonne" est deja revelee a soi-meme. Pas d'oracle cross-user possible : la cible (`accompagnanteProfileId` etc.) n'est pas utilisee pour decider l'affichage du hint, seulement le statut du sujet authentifie. Toucher ces literaux UI **n'apporte rien securitairement** et complexifie le code (chacun a son URL `/abonnement?from=X` taggue pour analytics conversion, etc.). Hors scope explicite story 7.A.5.

### Patterns reutiles (decouverts dans stories precedentes)

- **Pattern Story 5.B.1 PAYWALL_GENERIC_ERROR + check-oracle-paywall** : la constante module-level + garde-fou CI grep est l'architecture validee. 7.A.5 etend (pas re-architecture).
- **Pattern Story 7.A.1 safeSentryCapture + Sentry.captureMessage('paywall-block:*')** : tags `flow: 'messaging'`, `signal: 'oracle-fix'`, `severity: 'warning'`, `security: 'oracle-fix'`. Reutiliser pour `sendMessage` (nouveau call site Sentry).
- **Pattern Story 4.4 fixtures Vitest integration** : `createTestUser('accompagne')` + `createTestSubscription(user.id, { status: 'active', expiresAt: <past> })` pour seeder un user non-abonne ou abonne expire. Heritage `tests/integration/_lib/fixtures.ts`.
- **Pattern Story 7.A.4 test integration anti-oracle is_admin** : `JSON.stringify(result)` comparaison entre 2 flows pour assertion "shape identique" cross-surface. Adapter pour 3 flows (a)/(b)/(c) -> egalite transitive.
- **Pattern Story 6.C.* test:integration delegation GHA** : pas de Docker local Sylvain (`feedback_test_local_supabase`). Validation au push branche via workflow `integration-tests.yml` (heritage 4.7 seeds).

### Source tree components a toucher

| Fichier | Modification | Lignes nettes |
|---|---|---|
| `app/actions/messages.ts` | Reformulation constante + commentaire + extension call site sendMessage + capture Sentry symetrique | -2 / +8 net |
| `scripts/check-oracle-paywall.mjs` | Ajout bloc d'assertion AC5/AC6 (literal + usage count) | +20 |
| `tests/integration/paywall/sans-abonnement.test.ts` | Mise a jour literal + commentaire | -1 / +1 net |
| `tests/integration/paywall/abonnement-expire-mid-conversation.test.ts` | Idem | -1 / +1 net |
| `tests/integration/paywall/message-unifie-anti-oracle.test.ts` | Nouveau fichier (4 cas a-d) | ~100 |
| `_bmad-output/implementation-artifacts/sprint-status.yaml` | Statut 7.A.5 : backlog -> ready-for-dev -> in-progress -> review | (auto bmad) |

**Total** : ~130 lignes nettes ajoutees / 4 supprimees = ~126 net. Story focus 0,25j-dev cadrage epic-7.md.

### Testing standards

- **Pattern projet** : Vitest avec projet `integration` separe (`vitest.config.ts`). Necessite Docker + `supabase start` local OU GHA workflow `integration-tests.yml`. Memoire `feedback_test_local_supabase` -> validation par GHA au push (heritage 4.4, 4.7, 7.A.1, 7.A.4).
- **Pas d'impact a11y JSX** : aucune modification de composant React. `lint:a11y-check` baseline 155 doit rester intact. `a11y:axe:check` 0 delta sur 7 parcours (regle CLAUDE.md durcie obligatoire).
- **Pas de regression `as any`** : `check:as-any-global` + `check:as-any-admin` doivent rester verts. La story ne touche pas au typage.
- **Garde-fou CI specifique** : `check:oracle-paywall` durci (Task 3) est le verrou anti-regression principal. Une PR future qui changerait le literal OU supprimerait un call site `return { error: PAYWALL_GENERIC_ERROR }` echouerait le build Vercel.

### Project Structure Notes

- **Alignement parfait** avec :
  - Story 5.B.1 (architecture PAYWALL_GENERIC_ERROR + check-oracle-paywall).
  - Story 7.A.1 (helper `safeSentryCapture` + tag pattern).
  - Story 7.A.4 (pattern test integration anti-oracle via `JSON.stringify` cross-flow).
  - CLAUDE.md (copy "accompagnant" masculin neutre : nouveau literal role-neutre conforme).
- **Variance** : extension de la surface PAYWALL_GENERIC_ERROR a un 3eme call site (`sendMessage`). Le commentaire de tete documente cette extension explicitement. Pattern verrouille par check:oracle-paywall AC5/AC6.
- **Pas de conflit** : aucune story future Epic 7 ne touche `app/actions/messages.ts` (les autres stories 7.A.6+ touchent `notifications_log`, `admin_actions_log`, `is_accompagnant()`, `annonces`, RGPD, E2E). Risque merge conflict : nul.

### References

- Cadrage Epic 7 : [Source: `_bmad-output/planning-artifacts/epic-7.md` lignes 206-219 (Story 7.A.5)]
- Source originale (deferred) : [Source: `_bmad-output/implementation-artifacts/deferred-work.md` ligne 199 - review story 3.6 (2026-05-07)]
- Story precedente unification : [Source: `_bmad-output/implementation-artifacts/sprint-status.yaml` 5-b-1-fix-oracle-role-messagerie = done 2026-05-13]
- Code cible principal : [Source: `app/actions/messages.ts` lignes 16-24 (constante) + 116-120 + 231-235 + 405-411 (call sites)]
- Garde-fou CI a durcir : [Source: `scripts/check-oracle-paywall.mjs`]
- Tests integration cibles : [Source: `tests/integration/paywall/sans-abonnement.test.ts` + `abonnement-expire-mid-conversation.test.ts` + `_lib/fixtures.ts`]
- Convention buildCommand Vercel : [Source: `vercel.json` -> `check:env` -> `lint:a11y-check` -> `check:ip-spoofing` -> `check:as-any-admin` -> `check:as-any-global` -> `check:oracle-paywall` -> `test:integration` (sauf SKIP_E2E_TESTS) -> `next build`]
- Story precedente sprint : [Source: `_bmad-output/implementation-artifacts/7-a-4-aggreger-n-plus-1-unread-counts-admin-messages.md` - Status: done]
- Memoires projet pertinentes : `project_bmad_conventions`, `feedback_test_local_supabase`, `feedback_genre_accompagnant`, `project_epic_7_cadrage`.

## Dev Agent Record

### Agent Model Used

claude-opus-4-7 (bmad-dev-story, 2026-05-14)

### Debug Log References

- Tests negatifs `check-oracle-paywall.mjs` :
  - AC5 (literal altere `'Abonnement requis pour echanger des messages OPS.'`) -> exit 1 + message `'constante PAYWALL_GENERIC_ERROR absente ou valeur differente du literal Story 7.A.5'` -> rollback OK.
  - AC6 (1 occurrence `return { error: PAYWALL_GENERIC_ERROR }` au lieu de 3) -> exit 1 + message `'PAYWALL_GENERIC_ERROR utilise 1x dans return error, attendu >=3'` -> rollback OK.
- Validations CI locales toutes vertes : `tsc` 0, `lint` 196 warnings (= baseline 7.A.4), `lint:a11y-check` 155 baseline preserve, `check:as-any-global/admin/oracle-paywall/ip-spoofing` exit 0, `a11y:axe:check` 0 delta Critical/Serious sur 7 parcours, `test:unit` 45/45 verts en 1.00s.
- Audit grep AC9 :
  ```
  app/actions/messages.ts:21:// (b) extension a sendMessage (precedemment 'Abonnement requis pour envoyer un message.' - commentaire historique)
  app/page.tsx:452: FAQ landing 'Comment contacter un accompagnant ?' (texte public, pas un return server cross-user)
  components/messages/contact-button.tsx:50: hint UI pre-emptif 'Abonnement requis pour contacter.' (affiche selon subscribed prop du client lui-meme, pas un return server -> autorise par AC9 et NON touche)
  ```
- Audit grep AC10 :
  ```
  app/actions/messages.ts:21 (commentaire historique - autorise)
  app/actions/messages.ts:25 (valeur de PAYWALL_GENERIC_ERROR - 1 seul literal libre)
  ```

### Completion Notes List

**Resume implementation 7.A.5** (2026-05-14)

1. **Constante unifiee** : `PAYWALL_GENERIC_ERROR` passe de `'Abonnement requis pour contacter cet utilisateur.'` (literal 5.B.1) a `'Abonnement requis pour echanger des messages.'` (wording cadrage epic-7.md plus generique : couvre ouverture + envoi). Commentaire de tete enrichi avec sequence historique (5.B.1 -> 7.A.5) et description du garde-fou CI durci.

2. **Extension a sendMessage** : 3eme call site `return { error: 'Abonnement requis pour envoyer un message.' }` (ligne 409 pre-modif) remplace par `return { error: PAYWALL_GENERIC_ERROR }`. Le demi-oracle sur l'existence d'une conversation (`sendMessage` distinguait avant 'envoyer un message' vs 'Accès non autorisé') est neutralise : un attaquant non-abonne participant d'une conv recoit le meme literal que ceux qui appellent `getOrCreate*`.

3. **Sentry capture symetrique** : `safeSentryCapture(() => Sentry.captureMessage('paywall-block:sendMessage', { level: 'info', tags: { flow, signal, severity, security } }))` ajoute juste avant le return, alignement total avec les 2 autres call sites (`paywall-block:getOrCreateConversation` ligne 117 + `paywall-block:getOrCreateConversationAsAccompagnante` ligne 232). Tags identiques (flow: messaging, signal: oracle-fix, severity: warning, security: oracle-fix). Pas de leak cote attaquant (Sentry server-side, non observable client).

4. **Garde-fou CI durci** : `scripts/check-oracle-paywall.mjs` etendu avec 2 assertions additives :
   - `CONST_RE` : regex stricte sur `const PAYWALL_GENERIC_ERROR = '<literal Story 7.A.5>'`. Empeche suppression silencieuse OU re-introduction d'un message differencie par renommage de la constante.
   - `USAGE_RE` : count global `return { error: PAYWALL_GENERIC_ERROR }` >= 3. Empeche un retour partiel a un literal differencie sur l'un des 3 call sites. Tests negatifs ponctuels valides (literal altere -> exit 1, 1 occurrence au lieu de 3 -> exit 1).
   - Bloc additif a la suite du scan oracle ROLE_RE + CONTACT_RE existant (qui reste l'assertion principale anti-regression role-leak).

5. **Tests integration** : 2 tests existants mis a jour avec nouveau literal + commentaire de tete documentant 7.A.5 (`sans-abonnement.test.ts:38`, `abonnement-expire-mid-conversation.test.ts:57`). Nouveau test `message-unifie-anti-oracle.test.ts` (99 lignes, 1 it groupant 4 cas a-d via setup tripartite) verifie :
   - (a) accompagne non-abonne -> getOrCreateConversation -> `{ error: literal }`, keys.length === 1, pas de conversationId.
   - (b) accompagnant non-abonne -> getOrCreateConversationAsAccompagnante -> `{ error: literal }`, idem shape.
   - (c) accompagne abonnement expire participant d'une conv -> sendMessage -> `{ error: literal }`, idem shape.
   - (d) `JSON.stringify(resA) === JSON.stringify(resB) === JSON.stringify(resC)` (contrat anti-oracle cross-flow).

6. **Audit grep AC9 + AC10** : 0 leak server-side. Hits restants documentes en Debug Log References (1 commentaire historique messages.ts:21, 1 texte public FAQ landing page, 1 hint UI client pre-emptif subscribed-aware). Hints UI client NON touches (hors scope AC9).

7. **Patterns reutilises** : Story 5.B.1 (architecture PAYWALL_GENERIC_ERROR + garde-fou CI grep) + Story 7.A.1 (safeSentryCapture + tags Sentry) + Story 7.A.4 (`JSON.stringify` comparaison cross-flow pour assertion shape identique). Aucune nouvelle architecture.

8. **Validations CI locales** : toutes vertes. tsc 0, lint 196 warnings (= baseline 7.A.4), lint:a11y-check 155, check:as-any-global + check:as-any-admin + check:oracle-paywall (avec nouveau bloc) + check:ip-spoofing exit 0, a11y:axe:check 0 delta Critical/Serious sur 7 parcours, test:unit 45/45 verts. test:integration delegue GHA `integration-tests.yml` au push branche (heritage `feedback_test_local_supabase`).

9. **Volumetrie touchee** : 5 fichiers (1 server action + 1 script CI + 2 tests existants + 1 test nouveau). ~125 lignes nettes ajoutees / ~5 supprimees = ~120 net. Aligne sur estimation cadrage epic-7.md 0,25j-dev.

10. **AC1-AC17** : tous satisfaits cote dev local. AC16 partie integration test deleguee GHA. AC17 (a11y:axe:check obligatoire avant commit livraison) verifie pre-clôture story.

**Hors scope** : pas de modification des composants UI client (hints pre-emptifs `contact-button.tsx`, `chat-window.tsx`, etc.) -> documentation explicite Dev Notes story (pas de cross-user oracle possible cote client).

### File List

**Modifies** :
- `app/actions/messages.ts` (-2 / +12 : constante reformulee + commentaire enrichi + extension sendMessage avec capture Sentry symetrique)
- `scripts/check-oracle-paywall.mjs` (+20 : bloc d'assertions AC5/AC6)
- `tests/integration/paywall/sans-abonnement.test.ts` (-1 / +5 : nouveau literal + commentaire 7.A.5)
- `tests/integration/paywall/abonnement-expire-mid-conversation.test.ts` (-1 / +5 : nouveau literal + commentaire 7.A.5)

**Nouveaux** :
- `tests/integration/paywall/message-unifie-anti-oracle.test.ts` (99 lignes : test cross-flow 4 cas a-d)

**Sprint status** :
- `_bmad-output/implementation-artifacts/sprint-status.yaml` (7.A.5 : ready-for-dev -> in-progress -> review)

### Review Findings

- [x] [Review][Patch] `safeSentryCapture` catch vide : exceptions Sentry avalees silencieusement sans log [app/actions/messages.ts:30-34] — Ajouter `console.error('[safeSentryCapture]', e)` dans le catch pour rendre les pannes Sentry visibles dans les logs Vercel.
- [x] [Review][Patch] `hasActiveSubscription` peut throw et briser le contrat anti-oracle shape [app/actions/messages.ts:115,236,416] — Wrapper les 3 appels `hasActiveSubscription` dans un try/catch ; sur exception retourner `{ error: PAYWALL_GENERIC_ERROR }` (preserve l'anti-oracle) + safeSentryCapture log.
- [x] [Review][Patch] `CONST_RE` dans check-oracle-paywall.mjs ne couvre pas les template literals (backtick) [scripts/check-oracle-paywall.mjs:63] — Ajouter le backtick dans la classe de caracteres : `['"\`]`.
- [x] [Review][Patch] AC12(c) : `'conversationId' in resC === false` manquant dans le test anti-oracle [tests/integration/paywall/message-unifie-anti-oracle.test.ts:84] — Ajouter `expect('conversationId' in resC).toBe(false)` apres les assertions existantes du cas (c).
- [x] [Review][Defer] `sendMessage` conversation fetch : `error` DB non capture → alias "non trouvee" [app/actions/messages.ts:376-391] — deferred, pre-existant avant 7.A.5
- [x] [Review][Defer] `check-oracle-paywall.mjs` : blocs `/* */` multi-lignes non filtres (risque faux positif CONTACT_RE) [scripts/check-oracle-paywall.mjs] — deferred, pre-existant dans le script original
- [x] [Review][Defer] Race condition refetch null sans diagnostic Sentry distinct (23505 + refetch still null) [app/actions/messages.ts:138-157] — deferred, amelioration observabilite mineure
- [x] [Review][Defer] Test cas (c) n'exerce pas l'accompagnant comme sender dans sendMessage [tests/integration/paywall/message-unifie-anti-oracle.test.ts] — deferred, couverture incomplete, non-bloquant

### Change Log

- 2026-05-14 : Story 7.A.5 implementee. PAYWALL_GENERIC_ERROR reformule (`'Abonnement requis pour echanger des messages.'`) + etendu a sendMessage (3eme call site) + capture Sentry symetrique `paywall-block:sendMessage`. Script `check-oracle-paywall.mjs` durci (2 assertions additives literal + count >=3 call sites). 2 tests integration mis a jour + 1 test cross-flow anti-oracle nouveau (4 cas a-d). Tous garde-fous CI locaux verts. Test integration GHA delegue au push branche (heritage `feedback_test_local_supabase`). Status: review.

## DoD a11y

> **Aucun impact UI** : la story modifie uniquement des messages d'erreur server-side (string literal dans Server Action retournee dans le shape `{ error: string }`). Les composants client (`contact-button.tsx`, `chat-window.tsx`, etc.) ne sont **pas** touches. Aucun nouveau composant, aucune modification de markup, aucune modification de focus/ARIA/clavier. La regle CLAUDE.md `npm run a11y:axe:check` exit 0 reste verifiee par habitude avant commit livraison (Task 7.5) mais aucun delta attendu.

A renseigner pour toute story avec impact UI (ignorer si pas de changement visuel/interactif) :

- [ ] Labels associes aux champs (`htmlFor` ou `aria-labelledby`)
- [ ] Erreurs liees aux champs via `aria-describedby` + `aria-invalid`
- [ ] Focus visible sur tous les elements interactifs (contraste >= 3:1)
- [ ] Contrastes texte >= 4,5:1 et UI >= 3:1
- [ ] ARIA states corrects sur composants dynamiques (`aria-expanded`, `aria-selected`, etc.)
- [ ] Navigation clavier complete (Tab, Enter, Escape, fleches selon pattern)
- [ ] Verification ponctuelle au lecteur d'ecran (VoiceOver ou NVDA) sur le composant touche
- [ ] Pas de regression `eslint-plugin-jsx-a11y` (`npm run lint:a11y-check` vert en CI)
- [ ] Pas de regression axe-core (`npm run a11y:axe:check` vert ou delta documente avec justification dans la PR)
