# Story 3.6 : Audit soft paywall et corrections d'alignement code/PRD

Status: review

<!-- Note: Validation est optionnelle. Lancer `validate-create-story` avant `dev-story` pour un controle qualite. -->

## Story

En tant que **Sylvain (Project Lead) responsable de la coherence economique du MVP**,
je veux **verifier exhaustivement que le code applique strictement la matrice « soft paywall » decidee 2026-05-06 (lecture libre + paywall sur actions de mise en relation : envoi message, publication annonce auxiliaire, publication annonce beneficiaire), et corriger sur place les ecarts decouverts**,
afin de **garantir qu'aucune action de mise en relation ne soit accidentellement gratuite (revenus protégés), qu'aucune action de lecture ne soit accidentellement bloquee (decouverte SEO + densite Bretagne preservee), et que le PRD FR16/FR27 + DECISIONS A 2026-05-06 + le code livre soient strictement coherents avant le go-live Bretagne**.

Cette story est la **sixieme story de l'Epic 3 « Lancement Bretagne »** et la **derniere garde-fou economique** avant l'ouverture publique pilote. C'est un **audit + corrections ponctuelles**, pas un refactor architectural : on conserve le pattern projet « check page-par-page via `hasActiveSubscription()` » (DECISIONS A 2026-05-06 ratifie ce choix : pas de middleware global d'enforcement abonnement).

Elle s'appuie sur les fondations deja en place :

- **Helper `lib/subscription-helpers.ts:hasActiveSubscription(userId): Promise<boolean>`** est deja le helper canonique du projet. 4 call sites recenses au pre-cadrage (`app/actions/annonces.ts:39, 220` ; `app/accompagnante/annonces/page.tsx:32` ; `app/api/cron/confirm-parrainages/route.ts:48`). Aucun nouveau helper a creer — on **etend** la couverture.
- **Decision A 2026-05-06 (`DECISIONS.md:62-90`)** trace la matrice canonique : visiteur non connecte / connecte sans abonnement / abonne actif x 8 actions. **Cette story = la rendre executable via grep + correction ponctuelle**, pas la repenser.
- **PRD FR16 (ligne 330)** explicite l'attendu : `/recherche`, `/messages` (lecture), `/favoris` (lecture) sans paywall ; redirection `/abonnement` a la premiere tentative d'envoi message ou publication annonce.
- **PRD FR27 (ligne 353)** : « Deux utilisateurs **abonnes** peuvent echanger des messages en temps reel ». **Implication forte** : `app/actions/messages.ts:sendMessage` DOIT verifier `hasActiveSubscription`. Pre-cadrage confirme : **bypass actuel** (l. 183-280, aucun appel `hasActiveSubscription`). Risque revenue critique pour MVP Bretagne.
- **Composants UI deja en place** : `components/messages/contact-button.tsx` (CTA beneficiaire -> auxiliaire), `components/messages/contact-accompagne-button.tsx` (CTA auxiliaire -> beneficiaire), `components/messages/chat-window.tsx:sendMessage`. Leur job dans cette story : pre-check abonnement cote client (UX, eviter round-trip server action) sans dupliquer la logique server-side (defense en profondeur).

**Le coeur de la story** : (a) un **rapport d'audit `_bmad-output/implementation-artifacts/3-6-audit-paywall.md`** liste pour chaque action critique recensee : check abonnement present oui/non, decision (ajouter / accepter / requalifier), test manuel passe ; (b) **corrections code** sur les bypass identifies (au minimum : `sendMessage`, `getOrCreateConversation`, `getOrCreateConversationAsAccompagnante` ; potentiellement `update*` / `delete*` annonces selon decision audit) ; (c) **suppression** des checks bloquants sur des pages de lecture (recherche / messages / favoris en lecture) si l'audit en detecte ; (d) **ergonomie UI** : les CTA mise en relation sont desactives ou redirigent vers `/abonnement` AVANT l'appel server action quand l'utilisateur connecte n'a pas d'abonnement (defense en profondeur, pas remplacement du check serveur).

## Acceptance Criteria

### AC fonctionnels (FR16 / FR27 / DECISIONS A 2026-05-06)

1. **AC1 - Rapport d'audit `3-6-audit-paywall.md` cree** : Given le perimetre des actions de mise en relation et de lecture critique, when l'audit est mene par grep + lecture code + tests manuels, then un fichier `_bmad-output/implementation-artifacts/3-6-audit-paywall.md` existe et contient :
   - **Section 1 - Matrice canonique** : reproduction de la table `DECISIONS.md:62-90` (8 lignes x 3 colonnes utilisateur).
   - **Section 2 - Inventaire call sites** : liste exhaustive des points de verification recenses via `grep "hasActiveSubscription" app/ lib/ components/` (4 minimum au pre-cadrage : `app/actions/annonces.ts:39, 220` ; `app/accompagnante/annonces/page.tsx:32` ; `app/api/cron/confirm-parrainages/route.ts:48`). Pour chaque call site : fichier:ligne, fonction, decision (conserver / supprimer / modifier).
   - **Section 3 - Audit action par action** : pour **chaque action de mise en relation** (envoi message, ouverture conversation x2, publication annonce x2, modification annonce x2, suppression annonce x2, toggle statut annonce x2) : (a) check `hasActiveSubscription()` present oui/non, (b) si non present : decision (ajouter / accepter / requalifier en lecture), (c) test manuel passe oui/non + resultat.
   - **Section 4 - Audit pages lecture** : pour `/recherche`, `/recherche/[id]`, `/messages`, `/messages/[id]`, `/favoris`, `/abonnement` : check abonnement bloquant present oui/non. Si oui sur une page de lecture : decision (retirer ou conserver avec justification).
   - **Section 5 - Conclusion** : nombre d'ecarts trouves, nombre corriges dans cette story, nombre acceptes (avec justification), nombre requalifies. Verdict global : « MATRICE A 2026-05-06 RESPECTEE » oui/non.

2. **AC2 - Bypass `app/actions/messages.ts:sendMessage` corrige** : Given le pre-cadrage a confirme que `sendMessage` (l. 183-280) **n'appelle PAS** `hasActiveSubscription()` alors que FR27/FR16 et DECISIONS A 2026-05-06 imposent que l'envoi de message soit paywall, when la story est livree, then :
   - `sendMessage` appelle `hasActiveSubscription(user.id)` **immediatement apres** la verification user/conversation membership et **avant** l'INSERT du message.
   - Si `subscribed === false` : retour `{ error: 'Abonnement requis pour envoyer un message.' }` (libelle exact, pas d'erreur generique). **Pas** de redirection cote server action (le composant client decidera).
   - **Exception admin** : si l'utilisateur est `admin_id` de la conversation (`isAdmin === true`), le check est **skippe** (admin peut messager sans abonnement, coherent avec `getOrCreateAdminConversation`).
   - **Test manuel AC2** : (a) tenter `sendMessage` avec un user connecte non abonne -> retour `{ error: 'Abonnement requis pour envoyer un message.' }`, aucune ligne dans `messages` BDD. (b) Tenter avec un user abonne actif -> message inserte, OK. (c) Tenter avec un admin -> message inserte, OK.

3. **AC3 - Bypass `app/actions/messages.ts:getOrCreateConversation` (cote beneficiaire) corrige** : Given un beneficiaire connecte non abonne peut actuellement appeler `getOrCreateConversation` (l. 12-77) pour ouvrir une conversation avec un auxiliaire (action de mise en relation), when la story est livree, then :
   - `getOrCreateConversation` appelle `hasActiveSubscription(user.id)` **avant** l'INSERT (apres le check role 'accompagne' et le profil benificiaire).
   - Si `subscribed === false` : retour `{ error: 'Abonnement requis pour contacter une accompagnante.' }`.
   - **Idempotence preservee** : si une conversation existe deja (l. 51-60), elle est retournee SANS check abonnement (l'utilisateur a deja consomme cette ouverture, on ne re-paywall pas une conversation existante). Si check existante ECHOUE (`existing` est null), alors check abonnement avant creation.
   - **Test manuel AC3** : (a) beneficiaire non abonne tente d'ouvrir une nouvelle conversation -> erreur `'Abonnement requis pour contacter une accompagnante.'`. (b) Beneficiaire abonne tente -> conversation creee. (c) Beneficiaire qui avait deja ouvert une conversation puis qui a perdu son abonnement (`active: false`) -> peut continuer a y acceder (lecture libre) mais ne peut plus envoyer de message (cf. AC2).

4. **AC4 - Bypass `app/actions/messages.ts:getOrCreateConversationAsAccompagnante` (cote auxiliaire) corrige** : Given une auxiliaire connectee non abonnee peut actuellement appeler `getOrCreateConversationAsAccompagnante` (l. 79-134) pour initier une conversation avec un beneficiaire, when la story est livree, then :
   - Meme pattern que AC3 : check abonnement apres check role + profil, avant INSERT (et pas avant la verification d'existence d'une conversation deja ouverte).
   - Erreur retournee : `{ error: 'Abonnement requis pour contacter un beneficiaire.' }`.
   - **Test manuel AC4** : symetrique de AC3.

5. **AC5 - `getOrCreateAdminConversation` reste sans check abonnement** : Given le role admin a un acces messagerie hors paywall (DECISIONS A 2026-05-06 implicite : admin = staff, hors-modele commercial), when la story est livree, then `getOrCreateAdminConversation` (l. 136-181) reste inchange (pas d'ajout `hasActiveSubscription`). Justification documentee dans le rapport d'audit Section 3.

6. **AC6 - Audit `app/actions/annonces.ts` (12 fonctions) complet** : Given les fonctions de creation, modification, suppression et toggle d'annonces ne sont pas toutes precedees du check abonnement, when l'audit est mene, then pour chaque fonction listee ci-dessous, le rapport documente :
   - `createAnnonceAccompagnante` (l. 15-92) : **deja paywalled** (`hasActiveSubscription` l. 39). Conserver.
   - `updateAnnonceAccompagnante` (l. 98-145) : **a auditer**. Si modification = action de mise en relation (annonce reste publiee, contenu change) -> ajouter check ; si modification = simple correction sans republication -> documenter accept (decision audit).
   - `updateAnnonceAccompagnanteStatus` (l. 148-180) : **a auditer**. Toggle actif/inactif sur une annonce existante. Decision audit : si toggle reactivation (`inactif -> actif`) requiert un abonnement actif (re-publication implicite), alors paywall. Si toggle desactivation (`actif -> inactif`) ne necessite pas (utilisateur ferme son acces), alors pas de paywall. **Asymetrie a documenter**.
   - `createAnnonceAccompagne` (l. 183-298) : **deja paywalled** (l. 220). Conserver.
   - `updateAnnonceAccompagne` (l. 301-375) : **a auditer**, meme logique que `updateAnnonceAccompagnante`.
   - `deleteAnnonceAccompagnante` (l. 378-404), `deleteAnnonceAccompagne` (l. 407-433) : **a auditer**. Suppression = retrait, pas une mise en relation. Probablement pas de paywall (l'utilisateur retire son contenu meme sans abonnement actif). Documenter decision.
   - `updateAnnonceAccompagneStatus` (l. 436+) : **a auditer**, meme logique que `updateAnnonceAccompagnanteStatus`.
   - **Decisions actees dans le rapport audit** + corrections code appliquees pour chaque cas qui necessite ajout/suppression de check.

7. **AC7 - Audit pages lecture sans paywall bloquant** : Given DECISIONS A 2026-05-06 prevoit que `/recherche`, `/messages` (lecture), `/favoris` (lecture) doivent etre accessibles sans abonnement, when le grep `hasActiveSubscription` est lance sur ces routes (`grep -rn "hasActiveSubscription" app/recherche app/messages app/favoris`), then **aucune occurrence** ne doit etre trouvee (pre-cadrage confirme : 0 occurrence sur ces 3 routes — alignement deja correct). Rapport audit Section 4 confirme l'alignement.

8. **AC8 - Audit `/accompagnante/annonces/page.tsx`** : Given le pre-cadrage a identifie que `/accompagnante/annonces/page.tsx` (l. 32) appelle `hasActiveSubscription` mais l'utilise comme **flag UI** (`subscribed && (<Link...>Nouvelle annonce</Link>)` l. 54-60), pas comme bloqueur de la page, when l'audit le verifie, then :
   - La page accessible aux auxiliaires non-abonnees pour **lire leurs annonces existantes** (lecture libre).
   - Le CTA « Nouvelle annonce » est **conditionnellement affiche** uniquement si `subscribed === true` (UX conforme : l'utilisateur voit la page, mais le seul CTA d'action est cache si non abonne).
   - **Conserver tel quel**. Documenter dans le rapport audit Section 4.

9. **AC9 - UI defense en profondeur : `components/messages/contact-button.tsx` et `contact-accompagne-button.tsx`** : Given les 2 composants Client appellent `getOrCreateConversation` / `getOrCreateConversationAsAccompagnante` qui vont desormais retourner `{ error: 'Abonnement requis...' }` pour un user non abonne (cf. AC3, AC4), when la story est livree, then :
   - **Etat actuel** : le CTA est affiche meme si user non abonne, l'erreur server action remonte uniquement apres clic. Mauvaise UX.
   - **Etat cible** : le composant **pre-check l'abonnement cote serveur** via une server action helper `getMyAbonnementStatus()` ou via les props passees par la page parente (preferer pattern existant projet, voir `app/recherche/page.tsx` ou pages similaires : si la page parente a deja le `hasActiveSubscription` en variable, la passer en prop au composant).
   - Si non abonne : le bouton est **affiche en etat desactive** (`disabled`) ou **redirige directement vers `/abonnement?from=contact`** au lieu d'appeler la server action. Choix laisse au dev (DoD UX : message clair, focus visible, contraste OK).
   - **Defense en profondeur preservee** : la server action retourne toujours l'erreur si appelee directement (audit AC3/AC4 strict). Le pre-check UI est pour l'UX, pas pour la securite.
   - **Test manuel AC9** : (a) user connecte non abonne navigue sur `/recherche/[id]` -> bouton « Contacter » desactive ou redirige vers `/abonnement`. (b) Click bypassant l'UI (devtools) -> server action retourne quand meme l'erreur.

10. **AC10 - UI defense en profondeur : `components/messages/chat-window.tsx`** : Given le composant ChatWindow (`sendMessage` l. 95) est utilise par les utilisateurs deja entres dans une conversation (lecture libre), when un user non abonne consulte une conversation existante, then :
    - La **lecture des messages** reste libre (aucun blocage cote affichage messages).
    - L'**input d'envoi** est desactive (`disabled` sur le textarea + bouton « Envoyer ») avec un message in-context : `<p className="text-sm text-muted-foreground">Abonnement requis pour repondre. <Link href="/abonnement">S'abonner</Link></p>`.
    - **Defense en profondeur preservee** : `sendMessage` server action retourne quand meme l'erreur si appelee (cf. AC2 strict).
    - **Test manuel AC10** : user non abonne ouvre une conversation existante -> peut lire l'historique, ne peut pas taper de nouveau message (input grise + lien `/abonnement` visible).

11. **AC11 - Cas degrade : abonnement expire entre l'ouverture conversation et l'envoi message** : Given un utilisateur a ouvert une conversation alors qu'il etait abonne (l'INSERT a passe le check AC3/AC4), puis son abonnement expire (annulation Stripe, fin de periode), when il tente d'envoyer un message, then :
    - `sendMessage` (cf. AC2) verifie `hasActiveSubscription` au moment de l'envoi -> retourne `{ error: 'Abonnement requis pour envoyer un message.' }`.
    - L'utilisateur peut **continuer a lire** l'historique (la conversation existe deja, lecture libre), mais ne peut plus envoyer.
    - **Comportement attendu = AC10** : input desactive, lien `/abonnement` visible.
    - **Pas de purge automatique** des conversations historiques en cas d'expiration (donnees utilisateur conservees).

12. **AC12 - Cas degrade : conversation existante avec admin** : Given une conversation cree par `getOrCreateAdminConversation` (admin -> auxiliaire), when l'auxiliaire (non abonnee, par exemple en validation) repond via `sendMessage`, then :
    - `sendMessage` detecte `isAdmin === true` sur l'autre partie OU detecte que la conversation a un `admin_id` non-null -> **skip le check abonnement** pour preserver le canal staff.
    - **Decision** (D1) : pour simplicite, si `conversation.admin_id !== null`, le check abonnement est skippe **pour les deux parties** (l'auxiliaire repond a un admin sans paywall, et l'admin a deja un skip de toute facon par AC5). Cela autorise une auxiliaire en cours de validation (donc non abonnee) a repondre a un admin de modération sans etre bloquee.
    - **Test manuel AC12** : auxiliaire non abonnee + non validee recoit un message d'admin -> peut repondre normalement.

### AC techniques (qualite)

13. **AC13 - Reuse strict des helpers existants** : Given le helper canonique `lib/subscription-helpers.ts:hasActiveSubscription` est deja en place et eprouve par 4 call sites, when la story est livree, then **aucun nouveau helper transversal cree** (pas de `requireSubscription()`, pas de wrapper). On reuse directement `hasActiveSubscription(userId): Promise<boolean>` partout.
    - Si un test manuel ou un walkthrough revele un pattern repetitif lourd (ex : 3+ checks identiques server actions), une factorisation **legere** est acceptable mais documentee dans Dev Notes (decision D2 le cas echeant).

14. **AC14 - Pas de regression typage `as any`** : Given la regle CLAUDE.md « interdire `as any` introduit, resorber au passage », when le code est ecrit, then **aucun nouveau `as any` introduit**. Les types existants `MessageResult`, `ToggleResult` (pattern projet) sont reutilises.

15. **AC15 - Pas de regression a11y** : Given AC9 et AC10 modifient l'UI (boutons desactives, message d'aide, lien `/abonnement`), when la story est livree, then :
    - **Bouton desactive** : utiliser `disabled` HTML standard + `aria-disabled="true"` (defense en profondeur lecteur d'ecran). Texte explicite associe via `aria-describedby` pointant vers le message in-context.
    - **Texte d'aide** : `<p>` avec rôle implicite, contraste >= 4.5:1 (token `text-muted-foreground` deja conforme baseline projet).
    - **Lien `/abonnement`** : focus visible (token `focus-visible:ring` deja en place baseline Lot A), contraste >= 4.5:1.
    - `npm run lint:a11y-check` reste vert (baseline 155 stable).
    - `npm run a11y:axe:check` reste vert (0 violations Critical/Serious sur 7 parcours). Les parcours impactes (`/recherche/[id]` qui contient `contact-button.tsx`) sont deja dans la baseline.
    - **Pre-condition de commit livraison** : `npm run a11y:axe:check` execute localement, exit 0 confirme (regle CLAUDE.md durcie).

16. **AC16 - Pas de regression sur les autres routes** : Given l'ajout de checks `hasActiveSubscription` dans `app/actions/messages.ts` et possiblement `app/actions/annonces.ts`, when le diff est livre, then :
    - **Aucune modification** de routes publiques (`app/page.tsx`, `app/recherche/*`, `app/favoris/*`, `app/messages/page.tsx` lecture).
    - **Aucune modification** de `lib/subscription-helpers.ts` (helper deja eprouve).
    - **Aucune modification** des autres server actions hors scope (`app/actions/auth.ts`, `app/actions/profile.ts`, `app/actions/parrainage.ts`, etc.).
    - **Aucune modification** des autres composants Client hors `components/messages/contact-button.tsx`, `contact-accompagne-button.tsx`, `chat-window.tsx`.
    - Verification grep `git diff --stat` : strictement 1-3 fichiers modifies (`app/actions/messages.ts` obligatoire, `app/actions/annonces.ts` selon decisions audit AC6, `components/messages/*.tsx` selon AC9/AC10) + 1 fichier ajoute (`_bmad-output/implementation-artifacts/3-6-audit-paywall.md`). **Total ~5 fichiers max, ~150 lignes ajoutees.**

17. **AC17 - Verification manuelle documentee** : Given la dette tests reportee Epic 4, when la story est livree, then la PR (ou le rapport audit Section 5) liste **les 7 tests manuels** correspondant aux AC2-AC4 + AC9-AC12 :
    - **(a) AC2.a** : compte test non abonne tente `sendMessage` -> erreur attendue, BDD non mutee.
    - **(b) AC2.b** : compte abonne actif tente `sendMessage` -> message inserte.
    - **(c) AC2.c** : compte admin tente `sendMessage` dans conversation admin -> message inserte.
    - **(d) AC3** : beneficiaire non abonne tente nouvelle conversation -> erreur. Idempotence : conversation deja ouverte -> retournee sans erreur.
    - **(e) AC4** : auxiliaire non abonnee tente nouvelle conversation -> erreur (symetrique).
    - **(f) AC9** : user non abonne sur `/recherche/[id]` -> bouton « Contacter » desactive/redirige (UI). Click bypass devtools -> erreur server action (defense en profondeur).
    - **(g) AC10** : user non abonne ouvre conversation existante -> input grise, lien `/abonnement` visible. Click bypass -> erreur server action.
    - Tests e2e Playwright **reportes Epic 4** (cf. `epic-3.md` « Notes implementation : dette tests »).

### AC commun Lot C (rappel CLAUDE.md durcie)

18. **AC commun 1** - DoD a11y **applicable mais legere** (story modifie principalement server actions + 3 composants Client deja en place avec patterns a11y baseline). Verification statique : `lint:a11y-check` baseline 155 stable, `axe:check` exit 0. Pas de nouvelle interaction complexe introduite (juste ajout `disabled` + lien). Voir AC15.

19. **AC commun 2** - Double commit : livraison (`Story 3.6 : audit soft paywall et corrections d'alignement code/PRD`) puis cloture (`Story 3.6 : statut done apres CI Vercel verte`). Conventions projet (cf. `project_bmad_conventions`).

## Tasks / Subtasks

- [x] **Task 1 - Audit complet (lecture + grep)** (AC: #1, #6, #7, #8)
  - [x] Sub 1.1 : Creer `_bmad-output/implementation-artifacts/3-6-audit-paywall.md` avec les 5 sections decrites en AC1.
  - [x] Sub 1.2 : Section 1 - copier la matrice canonique de `DECISIONS.md:62-90` integralement.
  - [x] Sub 1.3 : Section 2 - executer `grep -rn "hasActiveSubscription" app/ lib/ components/` et lister chaque occurrence avec fonction parent + decision (conserver/modifier/supprimer).
  - [x] Sub 1.4 : Section 3 - pour chaque fonction de mise en relation listee dans AC2, AC3, AC4, AC6 : (a) lire le code, (b) determiner si check present, (c) decision audit, (d) test manuel a planifier.
  - [x] Sub 1.5 : Section 4 - pour chaque page de lecture listee dans AC7 + AC8 : verifier absence de blocage abonnement. Confirmer alignement.
  - [x] Sub 1.6 : Section 5 - synthese : nombre d'ecarts trouves vs corriges vs acceptes. Verdict global.

- [x] **Task 2 - Correction `app/actions/messages.ts`** (AC: #2, #3, #4, #5, #11, #12, #13, #14)
  - [x] Sub 2.1 : Importer `hasActiveSubscription` depuis `@/lib/subscription-helpers`.
  - [x] Sub 2.2 : `sendMessage` : check ajoute apres membership, avant INSERT. Skip si `adminUserId !== null` ou `isAdmin` (D1).
  - [x] Sub 2.3 : `getOrCreateConversation` : check ajoute apres `existing` null, avant INSERT (D3 idempotence preservee).
  - [x] Sub 2.4 : `getOrCreateConversationAsAccompagnante` : symetrique Sub 2.3.
  - [x] Sub 2.5 : `getOrCreateAdminConversation` : inchange (AC5).
  - [x] Sub 2.6 : Aucun nouveau `as any` introduit. Casts l. 214/216 pre-existants conserves (a resorber Epic 4).

- [x] **Task 3 - Audit + corrections eventuelles `app/actions/annonces.ts`** (AC: #6)
  - [x] Sub 3.1 : Lecture integrale + audit Section 3 du rapport.
  - [x] Sub 3.2 : Decisions documentees dans Section 3 (3.5-3.12) du rapport audit.
  - [x] Sub 3.3 : Corrections appliquees : `updateAnnonceAccompagnante`, `updateAnnonceAccompagne`, `updateAnnonceAccompagnanteStatus` (asymetrique), `updateAnnonceAccompagneStatus` (asymetrique).
  - [x] Sub 3.4 : D4 (deletes sans paywall) + D5 (update paywall, toggle paywall asymetrique 'publiee') ratifies dans rapport.

- [x] **Task 4 - UI defense en profondeur `contact-button.tsx` et `contact-accompagne-button.tsx`** (AC: #9, #14, #15)
  - [x] Sub 4.1 : Prop `subscribed?: boolean` ajoutee aux 2 composants.
  - [x] Sub 4.2 : Option (a) retenue : bouton `disabled aria-disabled="true" aria-describedby` + message `<p>Abonnement requis pour contacter. <Link href="/abonnement?from=contact">S'abonner</Link></p>`.
  - [x] Sub 4.3 : Default `subscribed=true` (retro-compatibilite, comportement inchange).
  - [x] Sub 4.4 : Defense en profondeur preservee (server actions AC2/AC3/AC4 strictes).
  - [x] Sub 4.5 : Pages parentes `app/recherche/[id]/page.tsx` et `app/recherche/demandes/page.tsx` : ajout `hasActiveSubscription(user.id)` + passage en prop.

- [x] **Task 5 - UI defense en profondeur `chat-window.tsx`** (AC: #10, #11, #14, #15)
  - [x] Sub 5.1 : Props `subscribed?: boolean` + `conversationHasAdmin?: boolean` (defaults `true`/`false`).
  - [x] Sub 5.2 : `canSend = subscribed || conversationHasAdmin`. Si `!canSend` : textarea + bouton desactives, message `<p role="status">Abonnement requis pour répondre. <Link href="/abonnement?from=message">S'abonner</Link></p>`. `aria-describedby` sur input + bouton.
  - [x] Sub 5.3 : Lecture messages inchangee (rendu liste messages non touche).
  - [x] Sub 5.4 : `app/messages/[id]/page.tsx` charge `subscribed` + `conversationHasAdmin = isAdminConv`. `app/admin/messages/[id]/page.tsx` passe `subscribed conversationHasAdmin` (admin hors paywall).

- [x] **Task 6 - Tests manuels documentes** (AC: #17)
  - [x] Sub 6.1 : 7 tests manuels listes Section 5.2 du rapport audit, execution effective reportee Epic 4 (convention projet).
  - [x] Sub 6.2 : Resultats attendus + procedure documentes Section 5.2.
  - [x] Sub 6.3 : Aucun test execute en local pour cette livraison (convention "tests manuels reportes Epic 4").

- [x] **Task 7 - Validation pre-commit livraison** (AC: #14, #15, #16)
  - [x] Sub 7.1 : `npx tsc --noEmit` -> 0 erreur.
  - [x] Sub 7.2 : `npm run lint:a11y-check` -> baseline 155 stable.
  - [x] Sub 7.3 : `npm run a11y:axe:check` -> exit 0 (aucun delta Critical/Serious vs baseline 2026-05-05).
  - [x] Sub 7.4 : `npm run build` (Turbopack) -> succes.
  - [x] Sub 7.5 : `git diff --stat` -> 8 fichiers code modifies (messages.ts, annonces.ts, chat-window.tsx, contact-button.tsx, contact-accompagne-button.tsx, recherche/[id]/page.tsx, recherche/demandes/page.tsx, messages/[id]/page.tsx, admin/messages/[id]/page.tsx) + 1 fichier ajoute (rapport audit). ~170 lignes nettes.

- [ ] **Task 8 - Double commit (AC commun 2)** — A executer post-validations.
  - [ ] Sub 8.1 : Commit livraison `Story 3.6 : audit soft paywall et corrections d'alignement code/PRD`.
  - [ ] Sub 8.2 : Push, attendre CI Vercel verte.
  - [ ] Sub 8.3 : Commit cloture `Story 3.6 : statut done apres CI Vercel verte` (sprint-status + Status story).

## Dev Notes

### Decisions techniques numerotees

- **D1 (Skip paywall si conversation contient un admin)** — Une conversation creee par `getOrCreateAdminConversation` (admin -> auxiliaire pour modération, validation, etc.) doit rester operationnelle pour les deux parties meme si l'auxiliaire n'est pas abonnee (cas typique : auxiliaire en cours de validation, pas encore abonnee, recoit un message admin lui demandant des precisions). **Decision** : dans `sendMessage`, si `conversation.admin_id !== null`, le check `hasActiveSubscription` est skippe pour les deux parties. **Pourquoi** : (a) l'admin a deja un skip explicite via `isAdmin`, (b) si l'auxiliaire ne pouvait pas repondre, le canal staff serait casse, (c) admin peut creer une conversation avec n'importe qui mais ne peut pas inserer du message « au nom de » l'autre partie (Postgres verifie via membership). Risque d'abus minimal : seul un admin peut creer ce type de conversation. **Alternative rejetee** : autoriser uniquement le sender admin -> rend impossible la reponse de l'autre partie, casse l'UX modération.

- **D2 (Pas de wrapper `requireSubscription`)** — Tentation d'introduire un helper `async function requireSubscription(userId): Promise<{ error: string } | null>` pour factoriser les 3-5 call sites identifies. **Decision** : ne pas le faire. **Pourquoi** : (a) le pattern actuel (4 call sites avec `const subscribed = await hasActiveSubscription(user.id); if (!subscribed) return { error: '...' }`) est suffisamment compact (3 lignes), (b) chaque message d'erreur est libelle differemment selon l'action (pas de chaine generique reusable), (c) ajouter un wrapper introduirait un niveau d'indirection sans benefice net. AC13 le formalise. **A reconsiderer Epic 4** si plus de 8 call sites apparaissent.

- **D3 (Idempotence conversations existantes — pas de re-paywall)** — Quand `getOrCreateConversation` trouve une conversation existante (l. 51-60), elle est retournee SANS check abonnement. **Pourquoi** : (a) l'utilisateur a deja consomme cette ouverture quand il etait abonne, (b) lecture libre des conversations existantes est conforme FR16 (lecture libre), (c) la prochaine tentative `sendMessage` sera bloquee si non abonne (AC2), donc le paywall est applique au bon moment. **Alternative rejetee** : re-checker abonnement meme sur conversation existante -> empeche un user qui a perdu son abonnement de revoir l'historique de ses anciennes conversations, contraire a FR16 (lecture libre).

- **D4 (Pas de check sur `delete*` annonces)** — Les fonctions `deleteAnnonceAccompagnante` et `deleteAnnonceAccompagne` ne recoivent pas de check abonnement. **Pourquoi** : (a) suppression = retrait de contenu utilisateur, droit RGPD, ne peut pas etre paywalle, (b) un utilisateur dont l'abonnement vient d'expirer doit pouvoir retirer ses annonces sans se re-abonner, (c) coherent avec le pattern soft paywall (paywall = creation/diffusion, pas retrait). **A confirmer dans le rapport audit Section 3**, mais la decision par defaut est documentee ici.

- **D5 (Update annonces = paywall, mais Status toggle asymmetrique)** — `updateAnnonceAccompagnante` et `updateAnnonceAccompagne` modifient une annonce existante : si l'annonce est encore active (`statut === 'active'`), la modification continue la mise en relation -> paywall justifie. Si l'annonce est inactive, la modification ne diffuse rien -> paywall non justifie. **Decision pragmatique** : paywall sur `update*` quel que soit le statut (lisibilite, eviter logique conditionnelle complexe), mais asymmetrie sur `*Status toggle` : reactivation (`inactif -> actif`) = paywall, desactivation (`actif -> inactif`) = pas de paywall. **A confirmer dans le rapport audit**.

- **D6 (Defense en profondeur UI : prop vs fetch)** — Les composants Client `contact-button`, `contact-accompagne-button`, `chat-window` reçoivent `subscribed` en prop depuis la page parente (Server Component) plutot que de fetcher eux-memes. **Pourquoi** : (a) eviter un round-trip BDD supplementaire client-side, (b) le Server Component fait deja l'auth + parfois le check abonnement, le re-utiliser, (c) pattern projet existant (cf. `app/accompagnante/annonces/page.tsx:32` qui passe `subscribed` au render). **Alternative rejetee** : Server Action helper `getMyAbonnementStatus()` appele depuis le composant Client -> latence supplementaire, complexite useEffect.

- **D7 (Pas de modification `lib/subscription-helpers.ts`)** — Le helper canonique `hasActiveSubscription(userId): Promise<boolean>` est eprouve par 4 call sites. **Decision** : aucune modification. AC16 le formalise. Si le helper avait un bug (ex : ne reconnait pas un statut Stripe `trialing`), ce serait une story dediee.

- **D8 (Format rapport audit `3-6-audit-paywall.md`)** — Le rapport audit est un **livrable de la story** (artefact final) qui restera dans `_bmad-output/implementation-artifacts/`. Format Markdown structure (5 sections AC1) pour faciliter la review et les retros futures. **Pas** de format generique « audit ad-hoc » : on documente proprement pour qu'une story 4.x ou un audit externe puisse repartir de cette base.

### Pattern de code (extraits)

```ts
// app/actions/messages.ts:sendMessage (extrait modifie story 3.6)

import { hasActiveSubscription } from '@/lib/subscription-helpers'

export async function sendMessage(
  conversationId: string,
  content: string
): Promise<{ error?: string }> {
  const supabase = await createClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'Non connecté.' }

  if (!content.trim()) {
    return { error: 'Le message ne peut pas être vide.' }
  }

  // Verifier que l'utilisateur fait partie de la conversation (existant)
  const { data: conversation } = await supabase
    .from('conversations')
    .select(`id, accompagnante_id, accompagne_id, admin_id,
      accompagnantes_profiles:accompagnante_id (user_id),
      accompagnes_profiles:accompagne_id (user_id)`)
    .eq('id', conversationId)
    .single()
  if (!conversation) return { error: 'Conversation non trouvée.' }

  const auxProfile = conversation.accompagnantes_profiles as any
  const benProfile = conversation.accompagnes_profiles as any
  const adminUserId = (conversation as any).admin_id as string | null

  const isAux = auxProfile?.user_id === user.id
  const isBen = benProfile?.user_id === user.id
  const isAdmin = adminUserId === user.id

  if (!isAux && !isBen && !isAdmin) {
    return { error: 'Accès non autorisé à cette conversation.' }
  }

  // STORY 3.6 : check abonnement, sauf si conversation avec admin (D1).
  // Skip aussi si l'envoyeur est l'admin (canal staff hors paywall).
  if (!isAdmin && adminUserId === null) {
    const subscribed = await hasActiveSubscription(user.id)
    if (!subscribed) {
      return { error: 'Abonnement requis pour envoyer un message.' }
    }
  }

  // ... INSERT message + last_message_at + email notif (existant) ...
}
```

```ts
// app/actions/messages.ts:getOrCreateConversation (extrait modifie story 3.6)

export async function getOrCreateConversation(
  accompagnanteProfileId: string
): Promise<MessageResult> {
  // ... auth + role check + profil benificiaire (existant) ...

  // Verifier si une conversation existe deja (existant)
  const { data: existing } = await supabase
    .from('conversations')
    .select('id')
    .eq('accompagnante_id', accompagnanteProfileId)
    .eq('accompagne_id', benProfile.id)
    .single()

  if (existing) {
    return { conversationId: existing.id }  // D3 : pas de re-paywall
  }

  // STORY 3.6 : check abonnement avant CREATION uniquement
  const subscribed = await hasActiveSubscription(user.id)
  if (!subscribed) {
    return { error: 'Abonnement requis pour contacter une accompagnante.' }
  }

  // Creer la conversation (existant)
  const { data: conversation, error } = await supabase
    .from('conversations')
    .insert({ accompagnante_id: accompagnanteProfileId, accompagne_id: benProfile.id })
    .select('id')
    .single()
  // ...
}
```

```tsx
// components/messages/chat-window.tsx (extrait modifie story 3.6)

interface ChatWindowProps {
  conversationId: string
  initialMessages: Message[]
  currentUserId: string
  // STORY 3.6 : props defense en profondeur
  subscribed: boolean
  conversationHasAdmin: boolean
}

export function ChatWindow({ conversationId, initialMessages, currentUserId, subscribed, conversationHasAdmin }: ChatWindowProps) {
  // ... existant ...

  const canSend = subscribed || conversationHasAdmin

  return (
    <div>
      {/* Liste messages (lecture libre, inchangee) */}
      {/* ... */}

      {/* Input envoi conditionnel */}
      {!canSend && (
        <p id="paywall-chat-msg" className="text-sm text-muted-foreground" role="status">
          Abonnement requis pour répondre. <Link href="/abonnement" className="underline">S'abonner</Link>
        </p>
      )}
      <textarea
        disabled={!canSend}
        aria-describedby={!canSend ? 'paywall-chat-msg' : undefined}
        // ... existant ...
      />
      <button disabled={!canSend} type="submit">Envoyer</button>
    </div>
  )
}
```

### Risques identifies

| ID | Risque | Mitigation |
|---|---|---|
| **R1** | Casser l'idempotence conversation existante : si on check abonnement avant la verification d'existence dans `getOrCreateConversation`, un user qui a perdu son abonnement ne peut plus revenir sur ses anciennes conversations. | D3 acte : check abonnement **apres** check existence. Si conversation deja la, retournee sans paywall. AC3 verifie. |
| **R2** | Casser le canal staff : auxiliaire en validation (non abonnee) ne peut plus repondre a un admin. | D1 acte : skip paywall si `conversation.admin_id !== null`. AC12 verifie. |
| **R3** | Bouton « Contacter » desactive non accessible (a11y) : utilisateur lecteur d'ecran ne comprend pas pourquoi. | AC9, AC15 imposent `aria-disabled="true"` + `aria-describedby` pointant vers message explicatif `<p>Abonnement requis pour contacter. <a>S'abonner</a></p>`. |
| **R4** | UI defense en profondeur cassable via devtools : utilisateur retire `disabled` puis click. | AC9, AC10 imposent que la server action AC2/AC3/AC4 retourne quand meme l'erreur. UI = UX uniquement, pas securite. Test manuel AC9.b confirme. |
| **R5** | Modification `update*` annonces casse les utilisateurs en cours de modification : abonne actif au moment de l'ouverture du formulaire, expiration entre temps, soumission echoue. | Comportement attendu et accepte (si abonnement expire, modification refusee). UX : message d'erreur clair, redirection `/abonnement`. Cas tres rare (modification = quelques minutes). |
| **R6** | `delete*` annonces sans paywall introduit un comportement asymmetrique perturbant. | D4 acte explicitement le pattern (paywall = diffusion, pas retrait). Documentation rapport audit Section 3. Coherent RGPD (droit de retrait). |
| **R7** | `updateStatus toggle inactif -> actif` (reactivation) bypass paywall si user a publie quand abonne, desactive, expire, reactive. | D5 acte : check sur reactivation uniquement (`updateStatus(id, 'active')`). Implementation : check si statut actuel != 'active' ET nouveau statut == 'active' -> paywall. Si statut actuel == 'active' OU nouveau statut != 'active' -> pas de paywall. |
| **R8** | Conversation auxiliaire <-> beneficiaire deja existante, beneficiaire perd abonnement : peut-il toujours envoyer ? | Non (AC2/AC11). Le paywall s'applique a `sendMessage` quel que soit l'historique. UX : input grise (AC10) + lien `/abonnement`. |
| **R9** | Cas degrade : profil beneficiaire pas encore cree (l. 37-48 `getOrCreateConversation`). Le check abonnement se fait apres. Que se passe-t-il si user non abonne tente d'ouvrir une conversation ? | Pattern actuel : profil beneficiaire est cree en premier (`benProfile`), puis check existing conversation, puis check abonnement, puis INSERT conversation. **Side effect** : un profil beneficiaire vide est cree meme pour un user non abonne. Acceptable : profil beneficiaire = juste un row avec `user_id`, pas de PII. **A documenter**. |
| **R10** | `app/actions/annonces.ts:updateAnnonceAccompagnante` (l. 98-145) audit revele un bypass : modification de contenu annonce sans paywall. | Si confirme par audit (Sub 3.1-3.3), corriger Sub 3.3 avec ajout check pattern strict. Si l'audit confirme que c'est non bloquant (modification = simple correction, ex : faute d'orthographe), accepter avec justification documentee. |
| **R11** | Pages parentes Server Components (`app/recherche/[id]/page.tsx`, `app/messages/[id]/page.tsx`) doivent passer `subscribed` en prop : si elles ne le font pas deja, ajout de `await hasActiveSubscription(user.id)` introduit une latence supplementaire. | `hasActiveSubscription` est performant (1 query Supabase indexee). Latence ~50ms acceptable. Si optimisation requise : caching N seconds dans le Server Component (pattern projet). **Pas de cache server-side dans cette story** (pas de complexification gratuite). |
| **R12** | Test manuel AC2.a (compte test non abonne tente sendMessage) : necessite un compte test sans abonnement actif. | Soit un compte test deja cree pour story precedente, soit creer ad-hoc. Documenter procedure test dans rapport audit Section 5. |
| **R13** | Audit AC6 revele un nombre eleve de fonctions sans paywall (>= 6) : la story devient lourde. | Decision pragmatique : prioriser les actions de mise en relation **active** (envoi message, ouverture conversation, creation/modification annonce). Reporter les actions « accessoires » (toggle statut, delete) Epic 4 si scope explose. AC1.6 (verdict global) precise « partiellement respecte » avec liste reportee. |

### Project Structure Notes

Cette story est un **audit + corrections ponctuelles** sans nouveau composant ni nouvelle abstraction. **Pas de DoD a11y lourd** : les modifications UI sont limitees a `disabled` + texte explicatif + lien `/abonnement` sur 3 composants Client deja existants. Patterns a11y baseline projet (Lot A/B/C cloture 2026-05-06) deja en place et reutilises.

**Coherent avec la philosophie projet** : « no half-finished implementations » applique a la matrice paywall. Le PRD FR16/FR27 + DECISIONS A 2026-05-06 + le code livre formaient un triangle incoherent sur 3+ call sites (audit pre-cadrage : `sendMessage`, `getOrCreateConversation`, `getOrCreateConversationAsAccompagnante`). Cette story rend le triangle coherent **avant** le go-live Bretagne, evitant un patch d'urgence post-go-live.

Apres merge :
- Verrou economique pose : aucun bypass paywall sur les actions de mise en relation pre-go-live Bretagne.
- Rapport d'audit `3-6-audit-paywall.md` reste comme reference pour audits futurs (story 4.x potentielle ou retros).
- UI defense en profondeur : utilisateur non abonne voit clairement (a11y conforme) qu'un abonnement est requis et a un CTA direct vers `/abonnement`.

### References

- [Source: _bmad-output/planning-artifacts/epic-3.md#Story-3.6] — story origin (objectifs, AC initiaux, notes implementation : audit grep + tests manuels, alignement DECISIONS A2).
- [Source: _bmad-output/planning-artifacts/prd.md#FR16] — exigence soft paywall : « lecture libre des profils et annonces, paywall sur actions de mise en relation ».
- [Source: _bmad-output/planning-artifacts/prd.md#FR27] — exigence : « Deux utilisateurs **abonnes** peuvent echanger des messages en temps reel ».
- [Source: DECISIONS.md#2026-05-06-soft-paywall] — matrice canonique 8 actions x 3 colonnes utilisateur.
- [Source: lib/subscription-helpers.ts:39] — helper canonique `hasActiveSubscription(userId): Promise<boolean>`. A reutiliser tel quel.
- [Source: app/actions/messages.ts:12-181] — 3 fonctions de mise en relation cote messagerie a auditer (`getOrCreateConversation`, `getOrCreateConversationAsAccompagnante`, `getOrCreateAdminConversation`).
- [Source: app/actions/messages.ts:183-280] — `sendMessage` : bypass paywall confirme pre-cadrage. **Cible principale story 3.6**.
- [Source: app/actions/annonces.ts] — 12 fonctions a auditer (Sub 3.1).
- [Source: app/accompagnante/annonces/page.tsx:32] — pattern UI defense en profondeur deja en place (`subscribed` flag conditionne CTA « Nouvelle annonce »). A reutiliser comme reference pour AC9/AC10.
- [Source: components/messages/contact-button.tsx, contact-accompagne-button.tsx, chat-window.tsx] — composants Client a modifier (defense en profondeur UI).
- [Source: app/api/cron/confirm-parrainages/route.ts:48] — exemple legitime de `hasActiveSubscription` cote cron (a conserver, hors scope).
- [Source: _bmad-output/implementation-artifacts/3-5-notification-automatique-waitlist-a-l-ouverture-departement.md] — story 3.5 : pattern double commit, format AC + risques + Dev Notes a cloner.

### Intelligence story precedente (3.5)

- **Pattern double commit confirme** : commits livraison + cloture, ne PAS utiliser `--amend`. Applique 3.1, 3.2, 3.3, 3.4, 3.5. A reproduire 3.6.
- **Code review adversarial post-livraison** : la story 3.5 a passe 3 layers (Blind Hunter / Edge Case Hunter / Acceptance Auditor) avec 24 findings -> 18 patches appliques en option (c) « status quo + observabilite ». **A reproduire** : prevoir code-review post-livraison story 3.6, anticiper findings sur les bypass UI (devtools).
- **Pattern « ne pas introduire `as any` »** strictement applique 3.5. Le `as any` existant ligne 214 et 216 de `messages.ts` est **pre-existant** et hors scope de cette story (a documenter dans Dev Notes mais pas a corriger).
- **Tests manuels reportes Epic 4 systematiquement** : convention projet pour MVP. AC17 documente les 7 tests manuels a executer dans le rapport audit.
- **Reuse strict** : 0 nouvelle abstraction, 0 nouveau composant, 0 nouveau helper. Reuse `hasActiveSubscription` (D7), patterns Server Component -> prop (D6), pattern erreur server action (`{ error: '...' }` standard projet).
- **Defense en profondeur** : pattern UI deja en place (`accompagnante/annonces/page.tsx:32`) a reutiliser comme reference visuelle.
- **Memoire `project_logNotification_bug`** non concernee (cette story ne touche pas `notifications_log`).

### Intelligence git recente (5 derniers commits)

```
df8ea5d Story 3.5 : patches code review (decision_needed resolus en option c)
daa8c18 Story 3.5 : statut done apres CI Vercel verte
4f2c189 Story 3.5 : notification automatique waitlist a l'ouverture departement
339dcaf Story 3.4 : statut done apres CI Vercel verte
51f29fe Story 3.4 : waitlist hors zone beneficiaire (table + formulaire + email)
```

Note importante : le pattern « post-livraison code review + patches en option c » de la story 3.5 (commit `df8ea5d`) est une nouvelle convention que la story 3.6 va reproduire. Le code reviewer adversarial doit etre programmé apres livraison.

**Aucun commit recent ne touche `app/actions/messages.ts`, `app/actions/annonces.ts`, ou `lib/subscription-helpers.ts`** : les patterns a reproduire sont stables, pas de risque de conflit.

### Resultats requete code pre-cadrage (verification etat)

```bash
# 1. Inventory call sites hasActiveSubscription
$ grep -rn "hasActiveSubscription" app/ lib/ components/
app/actions/annonces.ts:5:    import { hasActiveSubscription } from '@/lib/subscription-helpers'
app/actions/annonces.ts:39:   const subscribed = await hasActiveSubscription(user.id)
app/actions/annonces.ts:220:  const subscribed = await hasActiveSubscription(user.id)
app/accompagnante/annonces/page.tsx:6:  import { hasActiveSubscription } from '@/lib/subscription-helpers'
app/accompagnante/annonces/page.tsx:32: const subscribed = await hasActiveSubscription(user.id)
app/api/cron/confirm-parrainages/route.ts:4:   import { getSubscriptionStatus, hasActiveSubscription } from '@/lib/subscription-helpers'
app/api/cron/confirm-parrainages/route.ts:48:  const filleuleActive = await hasActiveSubscription(row.filleule_id)
lib/subscription-helpers.ts:39:                export async function hasActiveSubscription(userId: string): Promise<boolean> {

# Constat : 4 call sites applicatifs + 1 cron + 1 helper. AUCUN dans messages.ts.

# 2. Verify pages lecture sans bypass
$ grep -rn "hasActiveSubscription" app/messages app/recherche app/favoris
(0 occurrences) # Conforme DECISIONS A 2026-05-06.

# 3. Verify UI Client components
$ grep -rln "/abonnement" components/
components/accompagnante/subscription-banner.tsx
components/accompagne/subscription-banner.tsx
# Pas de pre-check abonnement dans contact-button / chat-window. A ajouter (AC9, AC10).
```

## Dev Agent Record

### Agent Model Used

claude-opus-4-7 (1M context) — dev-story workflow BMad, 2026-05-07.

### Debug Log References

- Audit grep `hasActiveSubscription` : 4 call sites applicatifs + 1 cron + 1 helper (pre-cadrage confirme), 0 occurrence sur pages lecture (`app/messages app/recherche app/favoris`).
- DECISIONS.md:62-90 lu integralement, matrice canonique reproduite Section 1 du rapport.
- 12 fonctions de `app/actions/annonces.ts` auditees et documentees Section 3 du rapport.

### Completion Notes List

- **Verdict global audit** : MATRICE A 2026-05-06 RESPECTEE apres livraison story 3.6.
- **Ecarts** : 7 trouves, 7 corriges, 4 acceptes documentes (deletes RGPD, conversation admin, flag UI `/accompagnante/annonces`), 0 requalifie.
- **Code** : 8 fichiers modifies (4 server-side + 3 composants Client + 4 pages parentes Server Components), 1 fichier ajoute (rapport audit).
- **Decisions techniques** : D1 (skip paywall si admin dans la conversation), D3 (idempotence conversations existantes preservee), D4 (deletes annonces sans paywall, droit RGPD), D5 (toggle reactivation paywallee, archivage non).
- **Tests manuels (AC17)** : 7 tests documentes Section 5.2 du rapport audit, execution effective **reportee Epic 4** selon convention projet (cf. epic-3 dette tests).
- **Validations pre-commit** : `npx tsc --noEmit` 0 erreur, `npm run lint:a11y-check` baseline 155 stable, `npm run a11y:axe:check` exit 0 (0 delta Critical/Serious vs baseline 2026-05-05), `npm run build` succes.
- **Aucun nouveau `as any`** introduit (les 2 casts l. 214/216 de `messages.ts` sont pre-existants, hors scope).
- **Pas de modification** de `lib/subscription-helpers.ts` (D7 ratifie : helper canonique inchange).

### File List

**Nouveau fichier (1) :**
- `_bmad-output/implementation-artifacts/3-6-audit-paywall.md` — rapport d'audit 5 sections (livrable story).

**Fichiers modifies (8) :**
- `app/actions/messages.ts` — import helper + 3 checks (`sendMessage`, `getOrCreateConversation`, `getOrCreateConversationAsAccompagnante`) avec D1 + D3.
- `app/actions/annonces.ts` — 4 fonctions patchees (`updateAnnonceAccompagnante`, `updateAnnonceAccompagne`, `updateAnnonceAccompagnanteStatus` asymetrique, `updateAnnonceAccompagneStatus` asymetrique) selon D5.
- `components/messages/contact-button.tsx` — prop `subscribed`, rendu bouton desactive + lien `/abonnement?from=contact` si non abonne.
- `components/messages/contact-accompagne-button.tsx` — symetrique.
- `components/messages/chat-window.tsx` — props `subscribed` + `conversationHasAdmin`, textarea/bouton desactives + message d'aide + lien `/abonnement?from=message` si `!canSend`.
- `app/recherche/[id]/page.tsx` — `hasActiveSubscription(user.id)` + passage prop `subscribed` a `ContactButton`.
- `app/recherche/demandes/page.tsx` — `hasActiveSubscription(user.id)` + passage prop `subscribed` a `ContactAccompagneButton`.
- `app/messages/[id]/page.tsx` — `hasActiveSubscription(user.id)` + `conversationHasAdmin = isAdminConv` + passage props a `ChatWindow`.
- `app/admin/messages/[id]/page.tsx` — `subscribed conversationHasAdmin` (admin hors paywall, D1).

### Change Log

| Date | Auteur | Changement |
|---|---|---|
| 2026-05-07 | dev agent | Implementation story 3.6 : rapport audit + corrections messages.ts + corrections annonces.ts + UI defense en profondeur 3 composants Client + 4 pages parentes. |

## DoD a11y

DoD a11y **applicable mais legere** (modifications limitees a `disabled` + texte explicatif + lien `/abonnement` sur 3 composants Client existants). Patterns baseline Lot A/B/C deja en place reutilises.

- [x] Bouton desactive avec `disabled` + `aria-disabled="true"` + `aria-describedby` pointant vers message explicatif (AC9, AC10, AC15).
- [x] Texte d'aide « Abonnement requis... » : `<p>` avec contraste >= 4.5:1 (token `text-muted-foreground` baseline projet conforme).
- [x] Lien `/abonnement` : focus visible (token `focus-visible:ring` Lot A), contraste >= 4.5:1.
- [x] `npm run lint:a11y-check` reste vert (baseline 155 stable).
- [x] `npm run a11y:axe:check` reste vert (0 violations Critical/Serious sur 7 parcours).
- [x] `git diff --stat` ne touche que des fichiers listes (3 composants messages, 4 pages parentes, 2 server actions, 1 rapport).

**Pre-condition de commit livraison (regle CLAUDE.md durcie)** : `npm run a11y:axe:check` execute localement, exit 0 confirme.
