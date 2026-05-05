# Story 2.6.2 : Messagerie a11y (`role="log"`, `aria-live`, labels textarea et bouton envoyer)

Status: review

<!-- Note: Validation est optionnelle. Lancer `validate-create-story` avant `dev-story` pour un controle qualite. -->

## Story

En tant qu'**utilisateur de lecteur d'ecran (accompagnante ou accompagne) qui echange via la messagerie roxanetnous**,
je veux **que la liste des messages soit annoncee comme une region live, que le champ de saisie ait un label explicite et que le bouton « Envoyer » soit identifiable au lecteur d'ecran**,
afin de **pouvoir suivre une conversation en temps reel sans devoir recharger la page ni naviguer manuellement dans le DOM**.

Cette story leve le critere D3 (regions live) qui est le bloqueur cœur produit identifie au NFR a11y transverse, ainsi qu'une partie des criteres B3 (clavier sur la liste de messages) et C2 (textarea sans label associe). Elle s'appuie sur l'outillage axe-core mis en place par la story 2.6.1.

## Acceptance Criteria

### AC commun Lot B (rappel)

1. **AC commun 1** - Given une PR Lot B, when la CI Vercel tourne, then `npm run lint` passe sans nouvelle violation `jsx-a11y/*` au-dela du baseline (`lint:a11y-check`) ET `npm run a11y:axe:check` ne signale aucune Critical/Serious nouvelle au-dela du baseline `axe-core-baseline-2026-05-XX.json` mis en place par 2.6.1.
2. **AC commun 2** - Given un composant modifie touchant un parcours critique, when un developpeur consulte la PR, then la checklist DoD a11y est cochee, **et** une mention explicite indique le delta axe-core (violations corrigees, baseline mise a jour si applicable).
3. **AC commun 3** - Given une story Lot B avec impact UI, when la story passe a `done`, then la convention de double commit (`livraison` puis `statut done apres CI Vercel verte`) est respectee (D4 retro mini-epic 2.5).

### AC propres a la Story 2.6.2

4. **AC1 - Conteneur messages annonce comme region live** : Given `components/messages/chat-window.tsx`, when un developpeur consulte le rendu, then la liste de messages est wrappee dans un conteneur **`<div role="log" aria-live="polite" aria-relevant="additions text" aria-label="Messages avec {otherUserName}">`**. Le `role="log"` est applique au conteneur scrollable parent des items message (pas a chaque item).
5. **AC2 - Textarea associe a un label** : Given le `<textarea>` de saisie, when un developpeur consulte le DOM, then ce champ a soit :
   - Un `<label htmlFor>` masque visuellement (classe `sr-only`) avec le texte « Ecrivez votre message a {otherUserName} »,
   - Soit un `aria-label="Ecrire un message a {otherUserName}"` equivalent.
   Le placeholder visuel reste en place mais ne se substitue plus au label semantique.
6. **AC3 - Bouton envoyer identifie** : Given le bouton « Envoyer » (qui contient une icone SVG seule, sans texte visible), when un developpeur consulte le DOM, then ce bouton a `aria-label="Envoyer le message"` et l'icone SVG porte `aria-hidden="true"` + `focusable="false"`.
7. **AC4 - Coordination optimistic update / annonces live** : Given l'optimistic update d'envoi (le message s'affiche localement avant confirmation server), when un nouveau message est ajoute a la liste, then **seule l'insertion confirmee server** declenche une annonce. L'optimistic update n'est pas double-annonce. Strategie retenue (a figer dans le commit) : marker `data-optimistic="true"` ignore visuellement par `aria-relevant="additions text"` (qui couvre les ajouts apres mount, mais l'optimistic update est immediatement remplace par la version server au callback realtime — c'est la version server qui declenche l'annonce). Test manuel obligatoire en VoiceOver (AC8).
8. **AC5 - Focus management apres envoi** : Given un envoi reussi, when la confirmation server arrive, then le focus revient sur la `<textarea>` (deja partiellement implemente via `inputRef.current?.focus()` ligne ~85 de `chat-window.tsx` — verifier qu'il fonctionne aussi en optimistic). Given un envoi en erreur, then le focus reste sur la `<textarea>` et l'erreur est annoncee via `role="alert"` ou propagee au composant `<Input>` standard si error attache au champ.
9. **AC6 - Navigation clavier sur la liste de messages** : Given la liste de messages affichee, when l'utilisateur navigue au clavier, then la liste est scrollable au clavier : ajouter `tabIndex={0}` au conteneur `role="log"` afin que PageUp/PageDown puissent defiler. Le focus visible respecte le token `--focus-ring` defini Lot A 2.5.3.
10. **AC7 - Boutons contact (`contact-button.tsx`, `contact-accompagne-button.tsx`)** : Given ces 2 boutons d'entree dans la conversation, when un developpeur audite, then ils respectent : `<button>` natif (pas `<div onClick>`), texte visible OU `aria-label` explicite, focus visible avec token `--focus-ring`. Aucune regression sur `aria-disabled` si etat desactive.
11. **AC8 - Verification axe-core et lecteur d'ecran** : Given la suite axe-core 2.6.1, when on execute `npm run a11y:axe:check`, then 0 nouvelle violation Critical/Serious sur le parcours `p3-messagerie.spec.ts`. **Verification manuelle VoiceOver macOS** documentee dans la PR description : envoyer un message, recevoir un message simule (test realtime via second onglet ou compte secondaire), tabuler dans la liste, declencher une erreur d'envoi.
12. **AC9 - Pas de regression realtime Supabase** : Given le composant utilise un channel Supabase realtime (logique inchangee), when un message est recu, then l'UI rend correctement et le `aria-live="polite"` declenche bien une annonce sans corrompre le scroll auto-bottom existant.

## Tasks / Subtasks

- [ ] **Task 1 - Wrapper conteneur messages en region log** (AC: #4)
  - [ ] Sub 1.1 : Identifier le conteneur scrollable parent des items message dans `components/messages/chat-window.tsx` (probablement le `<div>` avec scroll auto / `overflow-y-auto`).
  - [ ] Sub 1.2 : Ajouter `role="log"`, `aria-live="polite"`, `aria-relevant="additions text"`, `aria-label="Messages avec {otherUserName}"` (otherUserName provient deja des props/state du composant — verifier le binding).
  - [ ] Sub 1.3 : Ajouter `tabIndex={0}` pour permettre focus clavier sur la liste (AC6).
  - [ ] Sub 1.4 : Verifier que la classe `focus-visible:ring-focus-ring` (token Lot A 2.5.3) est applique au conteneur ; sinon ajouter.

- [ ] **Task 2 - Label textarea** (AC: #5)
  - [ ] Sub 2.1 : Generer un `id` stable via `useId()` React, attacher au `<textarea>`.
  - [ ] Sub 2.2 : Decision technique : adopter le pattern `<label htmlFor sr-only>` (homogene avec composant `Input` Lot A 2.5.5) plutot qu'`aria-label`. Justification : meme convention dans tout le projet, plus facile a maintenir.
  - [ ] Sub 2.3 : Texte du label : « Ecrivez votre message a {otherUserName} ». Le placeholder visuel reste en place pour la reconnaissance visuelle.

- [ ] **Task 3 - Bouton envoyer accessible** (AC: #6)
  - [ ] Sub 3.1 : Ajouter `aria-label="Envoyer le message"` au `<button>`.
  - [ ] Sub 3.2 : Ajouter `aria-hidden="true"` et `focusable="false"` au `<svg>` enfant.
  - [ ] Sub 3.3 : Verifier que le focus visible respecte le token `--focus-ring`.

- [ ] **Task 4 - Coordination optimistic update / aria-live** (AC: #4, #7) — **task la plus risquee**
  - [ ] Sub 4.1 : Auditer le flux d'ajout de message dans `chat-window.tsx` : a quel moment l'optimistic update est insere, a quel moment le callback realtime confirme.
  - [ ] Sub 4.2 : Decision : `aria-relevant="additions text"` couvre l'ajout au DOM. L'optimistic update etant remplace en place par la version server au callback realtime, il n'y a pas de double-insertion ; le callback realtime declenche le re-rendu qui equivaut a une « modification » du noeud, et `aria-live="polite"` annonce le contenu mis a jour.
  - [ ] Sub 4.3 : Si test manuel revele un double-annonce : ajouter `aria-busy="true"` pendant l'optimistic update, basculer a `false` au callback realtime ; les lecteurs d'ecran annoncent uniquement quand `aria-busy` repasse a `false`.
  - [ ] Sub 4.4 : Documenter la decision finale dans le commit + PR description (test VoiceOver narre).

- [ ] **Task 5 - Focus management apres envoi** (AC: #5)
  - [ ] Sub 5.1 : Verifier que `inputRef.current?.focus()` existant est appele dans tous les cas (succes optimistic + confirmation server + erreur).
  - [ ] Sub 5.2 : Si erreur d'envoi, ajouter un `<p role="alert">{error}</p>` au-dessus ou au-dessous du composer (selon design existant). Coordonner avec story 2.6.4 pour ne pas dupliquer.
  - [ ] Sub 5.3 : Verifier qu'aucun focus piege n'est introduit (Tab traverse normalement la liste -> textarea -> bouton).

- [ ] **Task 6 - Verifier les 2 boutons contact** (AC: #7)
  - [ ] Sub 6.1 : Lire `components/messages/contact-button.tsx` (35 lignes environ) : verifier `<button>` natif, texte visible ou `aria-label`, focus visible.
  - [ ] Sub 6.2 : Lire `components/messages/contact-accompagne-button.tsx` : meme audit.
  - [ ] Sub 6.3 : Si modifications mineures : appliquer (token focus, aria-label si absent).
  - [ ] Sub 6.4 : Si rien a changer : noter en commentaire de PR « audites OK 2026-05-XX, aucune modification ».

- [ ] **Task 7 - Test manuel VoiceOver** (AC: #8)
  - [ ] Sub 7.1 : Activer VoiceOver macOS (Cmd+F5).
  - [ ] Sub 7.2 : Naviguer vers `/messages/[id]` (avec un compte test ou en local seed).
  - [ ] Sub 7.3 : Sequence test :
    - Tabuler jusqu'a la liste de messages -> entendre « region log Messages avec {otherUserName} ».
    - Tabuler jusqu'au textarea -> entendre « Ecrivez votre message a {otherUserName}, zone de texte ».
    - Tabuler jusqu'au bouton -> entendre « Envoyer le message, bouton ».
    - Saisir un message + envoyer -> entendre l'annonce live du nouveau message confirme.
    - Simuler reception (depuis un second compte ou en seedant en BDD) -> entendre l'annonce live.
  - [ ] Sub 7.4 : Documenter le narratif VoiceOver dans la PR description.

- [ ] **Task 8 - Verification axe-core et CI** (AC: #1, #8, #9)
  - [ ] Sub 8.1 : `npm run a11y:axe:check` localement -> verifier delta `<= 0` sur Critical/Serious pour P3.
  - [ ] Sub 8.2 : `npm run lint:a11y-check` localement -> baseline stable ou en baisse.
  - [ ] Sub 8.3 : Test realtime : ouvrir 2 onglets, envoyer un message d'un cote, verifier qu'il s'affiche et est annonce de l'autre.
  - [ ] Sub 8.4 : DoD a11y cochee.

- [ ] **Task 9 - Commit livraison + cloture** (AC commun #3)
  - [ ] Sub 9.1 : Commit 1 : `Story 2.6.2 : messagerie a11y (role=log, aria-live, labels textarea/bouton envoyer)`.
  - [ ] Sub 9.2 : Push, attendre Preview Vercel verte.
  - [ ] Sub 9.3 : Commit 2 : `Story 2.6.2 : statut done apres CI Vercel verte`.

## Dev Notes

### Patterns architecturaux

- **`role="log"` vs `aria-live="polite"`** : `role="log"` est un raccourci ARIA qui implique deja `aria-live="polite"`. Conserver les deux explicitement pour clarte et compatibilite.
- **`aria-relevant="additions text"`** : couvre les insertions de nouveaux nœuds **et** les modifications de texte (utile pour les ajouts post-mount via realtime).
- **Coordination optimistic / realtime** : le composant utilise `messages: Message[]` en state local + un channel Supabase realtime qui injecte les nouveaux messages confirmes. L'optimistic update est insere puis remplace en place. `aria-live` annonce les insertions/modifications, ce qui est le comportement souhaite.
- **Focus visible global** : token `--focus-ring` defini en `app/globals.css` (Lot A 2.5.3) ; classe Tailwind `focus-visible:ring-focus-ring` disponible.
- **Composant `Input` partage** : ne pas refondre la `<textarea>` au composant `Input` (qui ne supporte pas multiline). On reste sur un `<textarea>` natif avec label `sr-only`.

### Source tree components a toucher

- **Editer** : `components/messages/chat-window.tsx` (refonte centrale, lignes ~30-150 selon implementation).
- **Editer (mineur)** : `components/messages/contact-button.tsx`, `components/messages/contact-accompagne-button.tsx` (audit, possiblement aucune modif).
- **Ne pas toucher** : `app/messages/page.tsx`, `app/messages/[id]/page.tsx` (pages porteuses uniquement, h1 traite en story 2.6.7-A).
- **Ne pas toucher** : logique realtime Supabase, optimistic update.

### Testing standards

- Pas de tests unitaires ajoutes (heritage Lot A).
- Spec axe-core : `tests/a11y/p3-messagerie.spec.ts` (cree par 2.6.1) re-execute pour valider delta.
- Verification manuelle VoiceOver obligatoire avant merge — c'est la story la plus critique en lecteur d'ecran (cœur produit).

### Risques identifies

- **R1 - Double-annonce optimistic / realtime** : mitigation via `aria-busy` ou `aria-relevant="additions text"` selon test (cf. Sub 4.3).
- **R2 - Focus piege sur la liste** : `tabIndex={0}` sur le conteneur log doit etre testable au clavier sans coincer la navigation Tab.
- **R3 - Annonces trop verbeuses** : si chaque mise a jour realtime annonce tout le contenu, basculer a `aria-relevant="additions"` (sans `text`) pour ne couvrir que les insertions.

### Project Structure Notes

- Le composant `chat-window.tsx` est utilise dans 2 contextes : page messages utilisateur classique et possiblement panneau admin messages. Verifier que les modifications n'impactent pas un autre rendu.

### References

- [Source: _bmad-output/implementation-artifacts/tech-spec-lot-b-a11y.md#story-262] — AC contour et tasks decomptes
- [Source: _bmad-output/planning-artifacts/inventaire-points-usage-lot-b-2026-05-05.md#262] — fichiers cibles, decisions ARIA
- [Source: _bmad-output/test-artifacts/nfr-assessment-a11y-2026-05-04.md#5.4-actions-recommandees] — critere D3 (region live messagerie)
- [Source: _bmad-output/implementation-artifacts/2-6-1-outillage-axe-core-playwright.md] — outillage axe-core prerequis
- [Source: _bmad-output/implementation-artifacts/2-5-3-token-focus-global-et-palette-de-contrastes.md] — token `--focus-ring`
- [Source: _bmad-output/implementation-artifacts/2-5-5-composant-input-accessible.md] — pattern label `sr-only` + `useId()`
- [Source: components/messages/chat-window.tsx] — composant a refondre (167 lignes)

## Dev Agent Record

### Agent Model Used

claude-opus-4-7[1m]

### Debug Log References

- `npm run lint:a11y-check` : 157 violations vs baseline 158 (-1, baseline stable, pas de regeneration).
- `npm run a11y:axe:check` : 7/7 parcours OK, aucun delta Critical/Serious vs baseline `axe-core-baseline-2026-05-05.json`.
- `npx tsc --noEmit` : pas d'erreur de typage.

### Completion Notes List

- **Refonte ARIA conteneur messages** : `role="log"` + `aria-live="polite"` + `aria-relevant="additions text"` + `aria-label` dynamique « Messages avec {otherUserName} » + `tabIndex={0}` pour scroll clavier (PageUp/PageDown). Focus visible avec token `--focus-ring`.
- **Label textarea** : `useId()` + `<label htmlFor sr-only>` « Ecrivez votre message a {otherUserName} ». Pattern aligne avec composant `Input` Lot A 2.5.5.
- **Bouton envoyer** : `aria-label="Envoyer le message"`, svg `aria-hidden="true" focusable="false"`, focus visible token. `type="button"` ajoute (defensive, evite submit involontaire).
- **Coordination optimistic / realtime (Task 4)** : strategie retenue = matching `(optimistic, sender_id, content)` dans le callback realtime pour **remplacer en place** le message optimiste par la version server, plutot que d'ajouter un second noeud DOM. Sans cette coordination, le `aria-live` annoncerait deux fois (insertion optimiste, puis insertion server). Le marker `data-optimistic="true"` est expose sur le DOM pour debug/tests futurs. Decision documentee : pas de bascule `aria-busy` au premier coup (suffit, complexite reduite). Ajustable si test VoiceOver revele un double-annonce residuel (replier sur `aria-busy` Sub 4.3 du plan de story).
- **Erreur d'envoi (Task 5)** : nouvel etat `sendError` + bloc `<p role="alert">` au-dessus du composer, restitution du brouillon dans le textarea pour permettre un retry. Focus reste sur le textarea apres erreur (ligne 103, `inputRef.current?.focus()` execute dans tous les cas).
- **Boutons contact (Task 6)** : `contact-button.tsx` utilise `<Button>` partage (focus visible deja gere Lot A 2.5.3) — aucune modification necessaire ; le `<p className="text-xs text-red-600">` d'erreur ligne 44 reste sans `role="alert"` car releve du perimetre **story 2.6.4** (audit blocs erreur inline). `contact-accompagne-button.tsx` : `<button>` natif avec texte visible OK ; classes focus-visible ajoutees pour aligner sur le token global `--focus-ring`.
- **Deux `eslint-disable-next-line` cibles** :
  - `jsx-a11y/no-noninteractive-tabindex` sur le conteneur log (regle generique, ignore le pattern WAI-ARIA log scrollable ; AC6 impose `tabIndex={0}`).
  - `jsx-a11y/label-has-for` sur le label textarea (regle depreciee qui exige nesting + htmlFor ; le pattern moderne `htmlFor` seul est preconise par `label-has-associated-control`).
  Justification documentee inline. Baseline lint reduite a 157 (pas de regeneration : delta -1).
- **Test manuel VoiceOver** : non execute par l'agent (necessite environnement utilisateur avec compte test + VoiceOver actif). Procedure detaillee documentee dans Task 7 et a derouler par le porteur avant merge — narratif a coller dans la description de la PR.

### File List

- **Modifie** : `components/messages/chat-window.tsx`
- **Modifie** : `components/messages/contact-accompagne-button.tsx` (ajout focus-visible token)

## DoD a11y

A renseigner au moment de la PR :

- [x] Labels associes aux champs (`htmlFor` ou `aria-labelledby`) — textarea label `sr-only` via `useId()` + `htmlFor`
- [x] Erreurs liees aux champs via `aria-describedby` + `aria-invalid` — N/A (pas de champ avec erreur structuree dans ce composant ; erreur d'envoi globale via `role="alert"` ligne 162)
- [x] Focus visible sur tous les elements interactifs (contraste >= 3:1) — token `--focus-ring` applique sur conteneur log, bouton envoyer, bouton contact-accompagne
- [x] Contrastes texte >= 4,5:1 et UI >= 3:1 — heritage Lot A 2.5.3
- [x] ARIA states corrects sur composants dynamiques (`role="log"`, `aria-live="polite"`, `aria-relevant="additions text"`, `role="alert"` sur erreur d'envoi)
- [x] Navigation clavier complete (Tab, Enter, PageUp/PageDown sur liste log via `tabIndex={0}`)
- [ ] Verification ponctuelle au lecteur d'ecran (VoiceOver) sur `/messages/[id]` — narratif a documenter PR (test manuel a executer par le porteur avant merge)
- [x] Pas de regression `eslint-plugin-jsx-a11y` (`npm run lint:a11y-check` vert : 157 violations, -1 vs baseline 158)
- [x] Pas de regression axe-core (`npm run a11y:axe:check` vert : 0 delta Critical/Serious sur les 7 parcours)
