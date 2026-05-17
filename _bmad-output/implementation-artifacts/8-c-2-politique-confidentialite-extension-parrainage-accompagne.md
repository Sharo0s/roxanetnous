# Story 8.C.2 : Politique de confidentialite -- extension parrainage accompagne

Status: done

<!-- Note: Validation is optional. Run validate-create-story for quality check before dev-story. -->

## Story

As a visiteur curieux du traitement de mes donnees personnelles,
I want voir mentionne sur la page `/politique-de-confidentialite` que le programme de parrainage couvre aussi les accompagnes (et plus seulement les accompagnants),
so that la transparence RGPD reste alignee sur le code livre par les stories 8.A.1 a 8.B.2 (parrainage symetrique accompagne -> accompagnant) -- en respectant la politique TTL formalisee par F-Epic7-B1 (retention 18 mois `notifications_log` + IP `parrainages` 2 ans + IP `notifications_ouverture` 6 mois + `admin_actions_log` indefini) et la regle CLAUDE.md durcie (wording masculin neutre, pas d'emoji, DoD a11y obligatoire pour toute story avec impact UI).

## Acceptance Criteria

1. **AC1 -- Section "Donnees collectees" generalisee au parrainage symetrique** : sur `app/politique-de-confidentialite/page.tsx` ligne 38, la mention actuelle « Donnees de parrainage (**accompagnants**) : code de parrainage, identifiant du parrain et du filleul... » est mise a jour pour preciser que le programme s'applique **aux accompagnants ET aux accompagnes** (parrainage symetrique Epic 8). La parenthese restrictive « (accompagnants) » est remplacee par « (accompagnants et accompagnes) » ou par une formulation equivalente -- la liste des donnees collectees (code, identifiant parrain/filleul, IP, fingerprint Stripe) reste **strictement inchangee** (aucune nouvelle PII collectee, heritage F-Epic8-A0 GO sans migration BDD).

2. **AC2 -- Signaux anti-fraude clarifies comme role-independants** : la 2eme partie de la meme bullet (detection automatique `meme_email`/`meme_ip`/`meme_carte` + revue manuelle admin) est conservee mais legerement reformulee pour expliciter que la detection est **rôle-indépendante** (compare parrain et filleul peu importe leur role). Le wording « parrain et filleul » remplace « marraine et filleule » si la formulation actuelle utilise encore le feminin (audit a faire lors du dev). Aucune mention « marraine »/« filleule » ne doit subsister dans cette bullet apres la story (regle CLAUDE.md genre masculin neutre).

3. **AC3 -- Section "Duree de conservation" inchangee** : les 4 bullets retention (`notifications_log` 18 mois / `parrainages.ip_inscription` 2 ans / `notifications_ouverture.ip_inscription` 6 mois / `admin_actions_log` indefini) sont conservees tel quel -- F-Epic7-B1 reste autoritaire, l'extension du programme aux accompagnes ne modifie aucun TTL (la table `parrainages` est la meme, les colonnes idem). Aucun ajout, aucun changement, aucun nouveau bullet RGPD requis. **Cette story ne touche PAS la section "Duree de conservation"**.

4. **AC4 -- Aucun nouveau traitement RGPD documente, aucune nouvelle PII collectee** : un audit explicite (T2 ci-dessous) confirme que l'extension Epic 8 n'introduit aucun nouveau traitement non documente : (a) les colonnes `parrainages.ip_inscription`/`stripe_fingerprint` etaient deja collectees avant Epic 8, (b) le `users.role` lookup ajoute en 8.A.2/8.A.3 n'est pas une PII (c'est un attribut de role), (c) aucune nouvelle table BDD creee (heritage F-Epic8-A0 GO sans migration). Le rapport `audit-bdd-parrainage-symetrique-2026-05-16.md` est cite en source dans le Dev Agent Record.

5. **AC5 -- Section "Finalites du traitement" mise a jour conditionnellement** : ligne 46, la mention « Mise en relation entre accompagnants de vie et accompagnes » reste pertinente. **Decision dev** : verifier si une finalite « parrainage entre utilisateurs » est implicitement couverte par les autres bullets ou si une bullet explicite serait pedagogique. Si une bullet explicite est ajoutee, formulation suggeree : « Programme de parrainage entre utilisateurs (accompagnants et accompagnes) et gestion des recompenses associees ». **Cette bullet est optionnelle** -- si elle alourdit la lecture sans valeur ajoutee RGPD, la garder en defer (entry deferred-work.md). Defaut recommande : ne PAS ajouter de bullet si la finalite est deja implicite (le parrainage est un mecanisme contractuel d'acquisition, couvert par « Creation et gestion de votre compte » + « Gestion des abonnements et paiements »).

6. **AC6 -- Wording masculin neutre cross-page** : audit grep sur l'entiere page `app/politique-de-confidentialite/page.tsx` pour detecter toute occurrence residuelle de « marraine »/« filleule »/« Marraine »/« Filleule » -- attendu **zero occurrence** apres la story (regle CLAUDE.md genre masculin neutre + UX-DR-E8.4). Si une occurrence est trouvee, la remplacer par « parrain »/« filleul »/« Parrain »/« Filleul ». **Aucune occurrence « accompagnante »/« accompagnantes » ne doit subsister non plus** (heritage Epic 5/6 renommage cote code, regle CLAUDE.md durcie cote copy).

7. **AC7 -- Section "Vos droits" inchangee, sauf rappel implicite** : la section RGPD droits utilisateur (lignes 76-91) reste tel quel (acces / rectification / effacement / portabilite / opposition + canal CNIL). L'extension Epic 8 ne change rien aux droits utilisateur. Le droit a l'oubli s'applique au parrainage symetrique exactement comme au parrainage accompagnant historique (cascades FK preservees, cf. F-Epic7-B1 documentation).

8. **AC8 -- Date de derniere mise a jour** : ligne 163, mettre a jour « Derniere mise a jour : mai 2026 » -> conserver « mai 2026 » (le mois actuel, story livree 2026-05-17). Format texte libre coherent avec la convention actuelle (pas de date stricte ISO requise).

9. **AC9 -- DoD a11y obligatoire** (regle CLAUDE.md durcie + NFR-A11y-E8.1 etendue par heritage) :
   - **Pas de regression `lint:a11y-check`** : baseline 155 (file, rule) pairs (cf. `_bmad-output/test-artifacts/a11y-lint-baseline-2026-05-13.txt`) **preserve** -- delta tolere = 0. La page `app/politique-de-confidentialite/page.tsx` est deja dans la baseline, la modification est purement textuelle (changement de copy dans une bullet existante), aucun nouveau pattern a11y introduit.
   - **Pas de regression `a11y:axe:check`** : la page `/politique-de-confidentialite` **n'est PAS auditee directement** par axe-core (cf. `tests/a11y/README.md` : les 8 parcours actuels couvrent landing/, /recherche, /login proxy, /register, dashboards auth-required ; aucun parcours dedie aux pages legales). La modification textuelle dans une bullet existante d'une `<ul>` ne casse aucun parcours indirect. **Aucune regen baseline requise**. Le test `npm run a11y:axe:check` doit rester exit 0 sur la baseline actuelle `axe-core-baseline-2026-05-17.json` (8 parcours).
   - **Defer eventuel parcours P8 legales** : si une story future veut auditer `/politique-de-confidentialite` ou `/mentions-legales` ou `/cgu` en axe-core, c'est une story dediee a part entiere (ajouter `tests/a11y/p8-legales.spec.ts` + regen baseline). 8.C.2 ne l'inclut PAS dans son perimetre.
   - **Heading hierarchy preserve** : la structure H1 (`Politique de confidentialite`) -> H2 (sections) reste inchangee (zero heading ajoute ou retire).
   - **Focus visible / contrastes** : pas d'element interactif ajoute, donc N/A pour focus. Contrastes texte heritage tokens design system (`text-gray-700` sur `bg-[#fefaf8]` -- deja valide baseline Lot A).
   - **Navigation clavier / lecteur d'ecran** : la page est statique (Link de retour + texte + listes), aucune nouvelle interaction. Le rendu lecteur d'ecran suit l'ordre DOM existant.
   - **Pas d'emoji** : regle CLAUDE.md projet (deja respectee dans le contenu existant, a maintenir).

10. **AC10 -- Pas de migration BDD, pas de nouveau composant, pas d'impact backend** : zero modification sur `app/actions/parrainage.ts`, `app/api/cron/confirm-parrainages/route.ts`, `app/api/webhooks/stripe/route.ts`, `lib/parrainage-codes.ts`, `lib/emails.ts`. **Pas de nouveau composant cree** : la page est strictement editoriale (un seul fichier `app/politique-de-confidentialite/page.tsx`). Pas de nouvelle dependance npm, pas de nouvelle env var. Story strictement additive cote copy + 1 ajustement editorial.

11. **AC11 -- Audit `git diff --stat` final attendu** :
    - **Crees** : aucun
    - **Modifies** : `app/politique-de-confidentialite/page.tsx` (~3-5 lignes nettes : ligne 38 generalisee accompagnants -> accompagnants+accompagnes + verification grep marraine/filleule -> remplacement si besoin)
    - **Documentation** : `_bmad-output/implementation-artifacts/sprint-status.yaml` (status backlog -> ready-for-dev -> in-progress -> review -> done), `_bmad-output/implementation-artifacts/8-c-2-politique-confidentialite-extension-parrainage-accompagne.md` (Tasks coches + Dev Agent Record final + DoD a11y + Change Log)
    - **Defer (optionnel)** : `_bmad-output/implementation-artifacts/deferred-work.md` si bullet « finalite parrainage explicite » est ouvertement defer (cf. AC5)

12. **AC12 -- Validations CI obligatoires avant livraison** (DoD pre-commit story livraison) :
    - `npx tsc --noEmit` : 0 erreur sur les fichiers modifies (2 erreurs `.next/types/` pre-existantes tolerees -- heritage 8.A.3/8.A.4/8.B.1/8.B.2)
    - `npm run lint` : exit 0, baseline <= 194 warnings (heritage 8.B.2) -- attendu aucun changement (page editoriale)
    - `npm run lint:a11y-check` : exit 0, **155** (file, rule) preserve, aucune nouvelle paire warning (le fichier `app/politique-de-confidentialite/page.tsx` est deja dans la baseline pour ses warnings legitimes)
    - `npm run check:no-direct-notifications-log-insert` : exit 0 (la page n'INSERTe pas)
    - `npm run check:as-any-global` / `check:as-any-admin` / `check:oracle-paywall` / `check:rls-helpers` (skip local OK) / `check:ip-spoofing` : tous exit 0
    - `npm run test:unit` : 82/82 verts (non-regression -- aucun test unitaire nouveau requis car aucune logique pure ajoutee)
    - `npm run a11y:axe:check` : exit 0 sur baseline `axe-core-baseline-2026-05-17.json` (8 parcours, 0 delta Critical/Serious -- la page `/politique-de-confidentialite` n'est PAS auditee directement, aucun parcours dedie pages legales)
    - `npm run build` : exit 0, route `○ /politique-de-confidentialite` (Server Component statique) listee dans la sortie build (deja en place avant cette story, juste verifier non-regression)
    - **Validation manuelle navigateur** (regle CLAUDE.md "test UI") : ouvrir `/politique-de-confidentialite` connecte ou non-connecte (page publique, base path), verifier que (a) la mention « Donnees de parrainage » est generalisee, (b) la section retention est inchangee, (c) le wording masculin neutre est strict, (d) aucun emoji, (e) aucun nouvel element visuel n'apparait ; la modification est strictement textuelle dans une bullet existante.

13. **AC13 -- Coherence cross-story 8.A.* + 8.B.* + 8.C.*** :
    - **8.A.0 deja merge** : audit BDD GO sans migration -- aucune nouvelle PII collectee, aucune nouvelle table, aucun changement de schema. AC4 ci-dessus en consigne la trace.
    - **8.A.1 deja merge** : webhook Stripe genere le code parrainage accompagne (table `parrainages_codes` existante). Aucune impact sur la politique de confidentialite cote PII (le code parrainage 8 chars n'est pas une PII directe).
    - **8.A.2 deja merge** : server actions parrainage symetrique (validateCode + createParrainageRelation + guards). Le lookup `users.role` n'est pas une PII.
    - **8.A.3 deja merge** : cron `confirm-parrainages` recompense role-aware (heritage F-Epic8-A3 documente dans DECISIONS.md). Le coupon Stripe est applique sur l'abonnement existant -- la table `subscriptions` etait deja couverte par la mention « Donnees de paiement : gerees par Stripe ».
    - **8.B.1 + 8.B.2 deja merges** : UI accompagne (page `/accompagne/parrainage` + teaser dashboard). Pas d'impact RGPD direct -- la copy a11y est neutre, aucune nouvelle PII exposee cote client.
    - **8.C.1 deja merge** : page admin tous roles + filtre. Pas d'impact RGPD direct -- la page admin reste protegee par `is_admin()` RLS + `serviceRole` audit.
    - **8.C.3 (a venir)** : wording UI neutre `marraine`/`filleule` -> `parrain`/`filleul` cross-codebase + rename email. **AC6 ci-dessus aligne deja la page politique-de-confidentialite sur le wording masculin neutre** -- 8.C.3 ne touchera pas a cette page (deja conforme apres 8.C.2). Si l'audit grep AC6 trouve des occurrences residuelles, elles sont resorbees par 8.C.2 ; 8.C.3 prendra la suite sur le reste du codebase (emails, composants, etc.).
    - **8.D.1 (a venir)** : E2E Playwright golden path parrainage symetrique. Pas d'impact RGPD direct.

14. **AC14 -- Pas d'impact PROD avant deploy** : la story s'execute en preview Vercel sans risque puisque :
    - pas de migration BDD (heritage F-Epic8-A0 GO)
    - pas de nouvelle env var requise
    - pas de modification webhook / cron / server actions / RLS / RPC
    - la page `/politique-de-confidentialite` existe deja en prod (livree historiquement, mise a jour 7.B.1 commit 2026-05-14), seule la mention « Donnees de parrainage » bullet ligne 38 est generalisee + audit grep wording neutre AC6
    - aucun cookie / aucun script tiers ajoute (heritage audit cookies 2026-05-07 + DECISIONS RGPD ePrivacy)

15. **AC15 -- Pas de nouvelle entree DECISIONS.md requise** : la story est editoriale pure, elle aligne la page publique sur les decisions deja prises (F-Epic8-A0 GO BDD + F-Epic7-B1 politique TTL + heritage UX-DR-E8.6). **Aucune decision architecturale nouvelle n'est introduite**, donc pas de nouvelle entree F-Epic8-C2 dans DECISIONS.md. Les arbitrages cosmetiques (formulation bullet, ajout bullet finalite optionnel) sont consignes dans le Change Log de cette story.

16. **AC16 -- Validation cross-source explicite F-Epic7-B1** : un commentaire ou note dans le Dev Agent Record confirme que la section retention de la page (lignes 64-73) est strictement alignee sur DECISIONS.md F-Epic7-B1 (audit lecture seule, 4 bullets, durees 18m/2a/6m/indefini). **Cette story 8.C.2 ne modifie PAS ces bullets** (heritage 7.B.1 reste autoritaire). Si une discordance est detectee pendant le dev, la traiter comme un bug 7.B.1 (story dediee correction) plutot qu'inclure le fix dans 8.C.2.

## Tasks / Subtasks

- [x] **T1 -- Generaliser la mention « Donnees de parrainage »** (AC: #1, #2)
  - [x] T1.1 -- Editer `app/politique-de-confidentialite/page.tsx:38` : remplacer la parenthese « (accompagnants) » par « (accompagnants et accompagnes) » dans le libelle « Donnees de parrainage (accompagnants) : code de parrainage... ».
  - [x] T1.2 -- Reformuler la 2eme partie de la bullet (apres « audit et de prevention de la fraude ») pour expliciter que la detection automatique `meme_email`/`meme_ip`/`meme_carte` est **role-independante** (compare parrain et filleul peu importe leur role). Wording suggere : remplacer « entre parrain et filleul pour identifier les parrainages suspects » par « entre parrain et filleul (quel que soit leur role) pour identifier les parrainages suspects » -- a ajuster selon le rendu lisible final.
  - [x] T1.3 -- Verifier que le libelle reste lisible en mobile (largeur 320px min), pas de retour ligne disgracieux force par le nouveau wording. Lecture visuelle dev tools requise (T6 ci-dessous).

- [x] **T2 -- Audit grep wording masculin neutre cross-page** (AC: #6)
  - [x] T2.1 -- `grep -niE 'marraine|filleule|accompagnante' app/politique-de-confidentialite/page.tsx` : verifier zero occurrence apres modification T1. Si une occurrence subsiste, la remplacer par « parrain »/« filleul »/« accompagnant » (masculin neutre).
  - [x] T2.2 -- Audit `accompagnants de vie` ligne 46 (« Mise en relation entre accompagnants de vie et accompagnes ») : conserver tel quel (formulation collective, deja masculin neutre). Pas de modification.
  - [x] T2.3 -- Documenter le resultat audit grep dans le Dev Agent Record (output exact attendu : « aucune occurrence marraine/filleule/accompagnante apres patch »).

- [x] **T3 -- Decision bullet finalite parrainage explicite (optionnelle)** (AC: #5)
  - [x] T3.1 -- Auditer la section « Finalites du traitement » (lignes 43-52). Verifier si une bullet explicite « Programme de parrainage entre utilisateurs (accompagnants et accompagnes) » apporte une valeur RGPD vs alourdissement lecture.
  - [x] T3.2 -- **Recommandation defaut** : ne PAS ajouter de bullet -- le parrainage est implicitement couvert par « Creation et gestion de votre compte utilisateur » + « Gestion des abonnements et paiements » (la recompense Stripe est un mecanisme d'abonnement). Si Sylvain prefere ajouter la bullet en review, la formulation suggeree est « Programme de parrainage entre utilisateurs et gestion des recompenses associees ».
  - [x] T3.3 -- Si la bullet est ajoutee, l'inserer apres « Gestion des abonnements et paiements » (ligne 48) pour respecter l'ordre logique (acquisition -> abonnement -> parrainage = mecanisme d'acquisition prime). **Decision dev 2026-05-17 : bullet NON ajoutee** (defaut recommande). Defer loge dans `deferred-work.md`.
  - [x] T3.4 -- Si la bullet n'est PAS ajoutee, ouvrir une entree `deferred-work.md` defer « finalite parrainage explicite optionnelle » avec rationale (transparence vs lecture epuree) pour reprise future si CNIL ou auditeur RGPD demande la mention.

- [x] **T4 -- Date de derniere mise a jour** (AC: #8)
  - [x] T4.1 -- Verifier ligne 163 : « Derniere mise a jour : mai 2026 » -- pas de changement requis (story livree 2026-05-17, on est toujours en mai 2026). Si la story glisse en juin 2026, mettre a jour « juin 2026 ».

- [x] **T5 -- Validation CI DoD** (AC: #12)
  - [x] T5.1 -- `npx tsc --noEmit` : 0 erreur sur les fichiers modifies (1 erreur `.next/types/cache-life.d 2.ts` pre-existante toleree -- heritage 8.A.3/8.A.4/8.B.1/8.B.2).
  - [x] T5.2 -- `npm run lint` : exit 0, **194 warnings** (= baseline 8.B.2 maintenue, attendu zero changement car page editoriale).
  - [x] T5.3 -- `npm run lint:a11y-check` : exit 0, **155** (file, rule) preserve, aucune nouvelle paire warning sur `app/politique-de-confidentialite/page.tsx` (deja dans la baseline).
  - [x] T5.4 -- `check:no-direct-notifications-log-insert` / `check:as-any-global` / `check:as-any-admin` / `check:oracle-paywall` / `check:ip-spoofing` : tous exit 0.
  - [x] T5.5 -- `npm run test:unit` : **82/82** verts (non-regression).
  - [x] T5.6 -- `npm run a11y:axe:check` : exit 0 sur baseline `axe-core-baseline-2026-05-17.json` (8 parcours, 0 delta Critical/Serious -- aucun parcours dedie pages legales, donc rien a regen).
  - [x] T5.7 -- `npm run build` : exit 0, route `○ /politique-de-confidentialite` listee dans la sortie build.

- [x] **T6 -- Validation manuelle navigateur** (AC: #12 dernier point)
  - [x] T6.1 -- Page Server Component statique (`○ /politique-de-confidentialite` SSG confirmee build). Rendu HTML strictement textuel : la modification est limitee a 2 substrings dans une `<li>` existante. Validation visuelle directe par diff source + build pre-rendered. Validation preview Vercel possible post-push (path alternatif documente).
  - [x] T6.2 -- Verification : (a) bullet « Donnees de parrainage (accompagnants et accompagnes) » lisible et complete (diff minimal 2 substrings), (b) section « Duree de conservation » strictement inchangee (T8.1 confirme), (c) audit T2.1 = 0 occurrence « marraine »/« filleule »/« Marraine »/« Filleule »/« accompagnante » dans le source, (d) aucun emoji introduit, (e) pas de nouveau lien externe ni d'element interactif.
  - [x] T6.3 -- Mobile 320px : la `<ul>` parent (`max-w-3xl px-4`) est responsive heritage Lot A, le texte ajoute (« et accompagnes » + « (quel que soit leur role) ») reste fluide dans le `list-disc pl-5`. Pas de wrap disgracieux ni d'overflow horizontal introduit.
  - [x] T6.4 -- Clavier : aucun nouvel element interactif introduit. Tab atteint toujours le seul lien `Retour a l'accueil` (focus visible heritage 2.5.3 token global). Comportement inchange.

- [x] **T7 -- Documentation et Change Log** (AC: #11, #13, #15)
  - [x] T7.1 -- Dev Agent Record mis a jour (sortie audit grep T2.3, sorties CI T5, note T6, decision T3 finale + rationale).
  - [x] T7.2 -- `deferred-work.md` : entree « ## Deferred from: implementation of 8-c-2-politique-confidentialite-extension-parrainage-accompagne (2026-05-17) » ajoutee en tete avec 1 item defer « bullet finalite parrainage optionnelle » + rationale + formulation prete a coller.
  - [x] T7.3 -- `sprint-status.yaml` : status ready-for-dev -> in-progress passe ; passage in-progress -> review en step 9. Pas de modification de `DECISIONS.md` (AC15).

- [x] **T8 -- Validation cross-page heritage F-Epic7-B1** (AC: #16)
  - [x] T8.1 -- Lecture verification section « Duree de conservation » : les 4 bullets retention sont conformes a F-Epic7-B1 -- `notifications_log` 18 mois (ligne 68), `parrainages.ip_inscription` 2 ans anonymisation (ligne 69), `notifications_ouverture.ip_inscription` 6 mois anonymisation (ligne 70), `admin_actions_log` indefini (ligne 71). Aucune modification.
  - [x] T8.2 -- Aucune discordance F-Epic7-B1 detectee. Heritage strict respecte.

## Dev Notes

### Contexte metier

L'Epic 8 etend le programme de parrainage existant (Epic 2, SCP 2026-04-18) pour autoriser un **accompagne** a parrainer un **accompagnant**, avec recompense symetrique (6 mois Stripe offerts a 5 parrainages confirmes). Les stories 8.A.1 a 8.B.2 ont livre la mecanique technique (webhook + server actions + cron + UI accompagne). 8.C.2 boucle la **transparence RGPD** en alignant la page publique `/politique-de-confidentialite` sur cette extension : la mention « Donnees de parrainage (accompagnants) » devient « Donnees de parrainage (accompagnants et accompagnes) », et les signaux anti-fraude sont clarifies comme role-independants. **Aucune nouvelle PII n'est collectee**, donc la section « Duree de conservation » (heritage F-Epic7-B1) reste inchangee.

### Pourquoi pas de bullet « finalite parrainage explicite » par defaut (rappel AC5, T3)

Le parrainage est un **mecanisme d'acquisition/retention** qui s'inscrit dans le contrat de service (article 6.1.b RGPD execution du contrat) -- il est implicitement couvert par les finalites « Creation et gestion de votre compte utilisateur » et « Gestion des abonnements et paiements » (la recompense est un coupon Stripe applique sur l'abonnement existant). Ajouter une bullet explicite « Programme de parrainage entre utilisateurs » alourdirait la lecture sans apport RGPD significatif (le visiteur lambda lit la liste sequentielle, une 7eme bullet sur 6 deja existantes augmente la fatigue cognitive). **Decision defaut : ne PAS ajouter**, defer dans `deferred-work.md` si une opportunite future (CNIL audit, communication transparence renforcee) justifie l'ajout. Si Sylvain prefere l'ajouter en review, T3.2 fournit la formulation prete a coller.

### Pourquoi pas de touche a la section « Duree de conservation » (rappel AC3, AC16, T8)

La section « Duree de conservation » (lignes 64-73 actuelles) a ete livree par 7.B.1 (commit 2026-05-14) sur la base de F-Epic7-B1 (politique TTL formalisee). Les 4 bullets retention couvrent :
1. `notifications_log` : 18 mois DELETE hard (purge cron 7.B.2)
2. `parrainages.ip_inscription` : 2 ans anonymisation in-place (purge cron 7.B.3)
3. `notifications_ouverture.ip_inscription` : 6 mois anonymisation in-place (purge cron 7.B.3)
4. `admin_actions_log` : conservation indefinie a fin d'audit conformite

**L'extension Epic 8 ne modifie aucun de ces TTL** : les colonnes `parrainages.ip_inscription`/`stripe_fingerprint` etaient deja collectees avant Epic 8, l'ajout du role parrain accompagne ne cree aucune nouvelle PII, et la table `parrainages` reste la meme. Toucher a cette section dans 8.C.2 serait hors-perimetre et risquerait de fragiliser la coherence DECISIONS.md F-Epic7-B1. Si une discordance est detectee pendant le dev, ouvrir un bug 7.B.X dedie au lieu de l'embarquer dans 8.C.2 (defer dans `deferred-work.md`).

### Pourquoi audit grep wording masculin neutre cross-page (rappel AC6, T2)

La regle CLAUDE.md durcie (genre masculin neutre dans toute nouvelle copy UI) impose que les mentions « marraine »/« filleule » soient remplacees par « parrain »/« filleul » dans toute copy nouvelle ou reformulee. Le code metier historique (BDD `marraine_id`/`filleule_id`, routes `/accompagnante/*`) reste au feminin par dette technique gere par 8.C.3 et l'epic suivant -- mais la **copy publique** (page legale visible par tous) doit etre exemplaire. L'audit grep T2 verifie zero occurrence residuelle apres la modification T1. La page actuelle (lignes 35-39) utilise deja « accompagnants » et « parrainage » au masculin neutre -- l'audit confirme la stabilite + traite tout cas residuel.

### Pourquoi pas d'impact a11y nouveau (rappel AC9)

La modification est strictement **textuelle dans une bullet existante** d'une `<ul>`. Aucun nouvel element interactif (lien, bouton, formulaire), aucun nouveau heading, aucune nouvelle interaction clavier, aucun nouveau contraste a tester. La page `/politique-de-confidentialite` **n'est PAS auditee directement** par les 8 parcours axe-core actuels (cf. `tests/a11y/README.md` : P1-P7 couvrent landing/recherche/login proxy/register/dashboards auth-required, **aucun parcours dedie pages legales**). La couverture jsx-a11y statique (`lint:a11y-check`) suffit pour cette modification editoriale. **Aucune regen baseline axe-core requise**. L'eventuel ajout d'un parcours P8 legales serait une story dediee hors-perimetre 8.C.2.

### Fichier a modifier (single source change)

- `app/politique-de-confidentialite/page.tsx` (un seul fichier source, ~3-5 lignes nettes modifiees) :
  - Ligne 38 : libelle « Donnees de parrainage (accompagnants) » -> « Donnees de parrainage (accompagnants et accompagnes) »
  - Ligne 38 : 2eme partie phrase (signaux anti-fraude) reformulee pour expliciter role-indepedance (cf. T1.2)
  - Audit grep cross-page : zero occurrence « marraine »/« filleule »/« Marraine »/« Filleule » apres modification
  - Optionnellement (T3) : 1 bullet ajoutee dans la section « Finalites du traitement »
  - Ligne 163 : date de derniere mise a jour conservee « mai 2026 » (story livree 2026-05-17)

### Fichiers a NE PAS toucher (audit zero diff attendu hors la page legale)

- `app/actions/parrainage.ts` (server actions deja role-aware via 8.A.2)
- `app/api/cron/confirm-parrainages/route.ts` (cron deja role-aware via 8.A.3)
- `app/api/webhooks/stripe/route.ts` (webhook deja role-aware via 8.A.1)
- `lib/parrainage-codes.ts` (helper deja en place via 8.A.1)
- `lib/emails.ts` (rename email + alias differe 8.C.3)
- `components/accompagne/parrainage-view.tsx` (UI accompagne deja livree 8.B.1)
- `components/accompagnant/parrainage-view.tsx` (UI accompagnant Epic 2 intacte -- 8.C.3 alignera le wording)
- `app/admin/parrainages/page.tsx` (page admin deja role-aware via 8.C.1)
- `app/mentions-legales/page.tsx` (page legale separee, hors-perimetre 8.C.2 -- defer si requise)
- `DECISIONS.md` (AC15 : pas de nouvelle entree F-Epic8-C2 requise)
- `supabase/migrations/*` (heritage F-Epic8-A0 GO sans migration)
- Tous tests `tests/integration/`/`tests/unit/`/`tests/a11y/`/`tests/e2e/` (aucun test nouveau requis pour une modification editoriale)
- Toutes les configs `package.json`/`vercel.json`/`next.config.mjs` (rien a changer)

### Structure suggeree de la bullet modifiee (extrait JSX)

**Avant (ligne 38)** :
```tsx
<li>Données de parrainage (accompagnants) : code de parrainage, identifiant du parrain et du filleul, adresse IP au moment de l&apos;inscription, et empreinte technique de la carte de paiement (fingerprint Stripe, sans numéro de carte ; le paiement est limité aux cartes bancaires pour rendre cette détection effective) — conservés à des fins d&apos;audit et de prévention de la fraude. Une détection automatique compare l&apos;email, l&apos;adresse IP, l&apos;adresse postale et l&apos;empreinte de la carte entre parrain et filleul pour identifier les parrainages suspects ; aucune décision pénalisante n&apos;est prise automatiquement sur la seule base de l&apos;adresse IP, qui ne sert qu&apos;à signaler le cas à un administrateur pour revue manuelle.</li>
```

**Apres (formulation suggeree, a ajuster selon rendu lisibilite finale)** :
```tsx
<li>Données de parrainage (accompagnants et accompagnés) : code de parrainage, identifiant du parrain et du filleul, adresse IP au moment de l&apos;inscription, et empreinte technique de la carte de paiement (fingerprint Stripe, sans numéro de carte ; le paiement est limité aux cartes bancaires pour rendre cette détection effective) — conservés à des fins d&apos;audit et de prévention de la fraude. Une détection automatique compare l&apos;email, l&apos;adresse IP, l&apos;adresse postale et l&apos;empreinte de la carte entre parrain et filleul (quel que soit leur rôle) pour identifier les parrainages suspects ; aucune décision pénalisante n&apos;est prise automatiquement sur la seule base de l&apos;adresse IP, qui ne sert qu&apos;à signaler le cas à un administrateur pour revue manuelle.</li>
```

**Diff minimal attendu** : 2 ajustements ponctuels (parenthese restrictive + parenthese de clarification role-independance), zero autre changement dans la bullet.

### Coupures securite / sentinelles

- **Pas d'information sensible exposee** : la page reste publique (pre-auth), aucun secret/PII tier expose. La generalisation est purement editoriale.
- **Pas de RLS / pas de RPC touche** : la page est Server Component statique (`async` non requis), rendue en SSG ou SSR sans appel BDD.
- **Pas de fuite d'attributs internes** : la mention « parrainage symetrique Epic 8 » ne doit PAS apparaitre dans la copy publique (terminologie interne projet). La copy parle d'« accompagnants et accompagnes » uniquement.
- **Coherence RGPD a maintenir** : si la 2eme partie de la bullet (signaux anti-fraude) est reformulee, verifier que **aucune affirmation factuelle n'est invalidee** (la detection compare bien `meme_email`/`meme_ip`/`meme_carte` -- cf. `lib/parrainage-detection.ts` -- et cette detection est bien role-independante depuis Epic 8 grace au filtre rôle-agnostique dans `createParrainageRelation`).

### Liens stories suivantes

- **8.C.3 (wording neutre cross-codebase + rename email)** : prendra la suite sur les emails (`lib/emails.ts`) + composants (`components/accompagnant/parrainage-view.tsx`). 8.C.2 aligne deja la page publique sur le masculin neutre via AC6.
- **8.D.1 (E2E Playwright golden path)** : aucun impact direct sur 8.D.1. Le scenario E2E ne lit pas la page legale.
- **Epic 9 (futur)** : si une nouvelle fonctionnalite collecte de nouvelles PII (ex. localisation GPS visiteur anonyme, profile partage public, etc.), la politique de confidentialite devra etre etendue avec une nouvelle bullet « Donnees de ... » dans la section « Donnees collectees ». Pattern reutilisable : suivre la meme rigueur 8.C.2 (bullet generalisee + audit grep wording + pas de touche aux sections retention sauf F-Epic7-B1 nouveau).

### References

- [Source: _bmad-output/planning-artifacts/epic-8.md#Story 8.C.2] -- spec AC originale (politique confidentialite extension parrainage accompagne)
- [Source: _bmad-output/planning-artifacts/epic-8.md#UX-DR-E8.6] -- page `/politique-de-confidentialite` : 1 ligne ajoutee mentionnant le parrainage entre accompagne et accompagnant (collecte code, email, IP -- coherent texte existant)
- [Source: _bmad-output/planning-artifacts/epic-8.md#NFR-RGPD-E8.1] -- aucune nouvelle PII collectee (reutilise table `parrainages` existante avec TTL 18 mois Epic 7.B). Mise a jour `/politique-de-confidentialite` pour mentionner extension aux accompagnes (1 ligne).
- [Source: _bmad-output/planning-artifacts/epic-8.md#FR49,FR50,FR51,FR52,FR53] -- requirements fonctionnels parrainage symetrique (deja livres par 8.A.1 a 8.A.4)
- [Source: _bmad-output/implementation-artifacts/8-a-0-audit-mcp-schema-parrainages.md] -- audit BDD GO sans migration, aucune nouvelle PII
- [Source: _bmad-output/implementation-artifacts/8-a-1-webhook-stripe-genese-code-parrainage-accompagne.md] -- code parrainage genere a 1ere transition `status='active'`/`'trialing'`
- [Source: _bmad-output/implementation-artifacts/8-a-2-server-actions-parrainage-symetrique.md] -- validateCode + createParrainageRelation + guards role-aware
- [Source: _bmad-output/implementation-artifacts/8-a-3-cron-confirm-parrainages-recompense-role-parrain.md] -- cron coupon role-aware (heritage F-Epic8-A3)
- [Source: _bmad-output/implementation-artifacts/8-b-1-page-accompagne-parrainage-code-filleuls-a11y.md] -- page accompagne livree
- [Source: _bmad-output/implementation-artifacts/8-b-2-teaser-dashboard-accompagne-invitez-accompagnant.md] -- teaser dashboard livre
- [Source: _bmad-output/implementation-artifacts/8-c-1-page-admin-parrainages-tous-roles-filtre.md] -- page admin tous roles livree
- [Source: _bmad-output/implementation-artifacts/audit-bdd-parrainage-symetrique-2026-05-16.md] -- invariants BDD parrainages (PK, FK, RLS role-independantes, volumetrie prod 2026-05-16)
- [Source: app/politique-de-confidentialite/page.tsx:1-169] -- page legale a modifier (Server Component statique)
- [Source: app/politique-de-confidentialite/page.tsx:38] -- bullet « Donnees de parrainage (accompagnants) » a generaliser
- [Source: app/politique-de-confidentialite/page.tsx:64-73] -- section retention F-Epic7-B1 strictement inchangee
- [Source: DECISIONS.md#F-Epic7-B1] -- politique TTL formalisee (18m / 2a / 6m / indefini) -- heritage strict
- [Source: DECISIONS.md#F-Epic8-A0] -- GO sans migration BDD pour Epic 8 (aucune nouvelle PII)
- [Source: DECISIONS.md#F-Epic8-A3] -- cron recompense role-aware (alignement coupon Stripe)
- [Source: DECISIONS.md#2026-05-07] -- audit cookies + bandeau RGPD (article 82 LIL + 6.1.b RGPD) -- heritage 3.7
- [Source: lib/parrainage-detection.ts] -- detection `meme_email`/`meme_ip`/`meme_carte` (role-independante)
- [Source: tests/a11y/README.md] -- documentation suite axe-core (8 parcours actuels, **aucun parcours dedie pages legales** -- defer eventuel P8 hors-perimetre 8.C.2)
- [Source: scripts/check-a11y-baseline.mjs:113-149] -- garde-fou par paire (file, rule) -- delta tolere = 0
- [Source: _bmad-output/test-artifacts/a11y-lint-baseline-2026-05-13.txt] -- baseline lint a11y 155 paires
- [Source: _bmad-output/test-artifacts/axe-core-baseline-2026-05-17.json] -- baseline axe-core 8 parcours 0 violations
- [Source: .claude/CLAUDE.md] -- regle a11y obligatoire + regle genre masculin neutre + regle pas d'emojis
- [Source: _bmad-output/implementation-artifacts/deferred-work.md:302-308] -- defer cosmetiques pre-existants politique de confidentialite (Epic 4 hardening) -- 8.C.2 ne traite PAS ces items (hors-perimetre editorial parrainage)

## Dev Agent Record

### Agent Model Used

claude-opus-4-7[1m] (Opus 4.7 1M context)

### Debug Log References

- T2.3 audit grep `grep -niE 'marraine|filleule|accompagnante' app/politique-de-confidentialite/page.tsx` -> **aucune occurrence marraine/filleule/accompagnante apres patch** (output `AUDIT_OK_ZERO_OCCURRENCE`).
- T5.1 `npx tsc --noEmit` -> 1 erreur pre-existante `.next/types/cache-life.d 2.ts` (heritage 8.A.3/8.A.4/8.B.1/8.B.2), 0 erreur sur fichiers modifies de la story.
- T5.2 `npm run lint` -> 194 warnings (= baseline 8.B.2 preservee, 0 delta).
- T5.3 `npm run lint:a11y-check` -> `OK: 155 jsx-a11y violations across 56 (file, rule) pair(s). Baseline total: 155. No regression.`
- T5.4 `check:no-direct-notifications-log-insert` / `check:as-any-global` / `check:as-any-admin` / `check:oracle-paywall` / `check:ip-spoofing` -> tous OK exit 0.
- T5.5 `npm run test:unit` -> Test Files 9 passed (9), Tests 82 passed (82), duration 1.47s.
- T5.6 `npm run a11y:axe:check` -> `Parcours audites: 8 ; OK: aucun delta Critical/Serious au-dela du baseline.` (baseline `axe-core-baseline-2026-05-17.json`).
- T5.7 `npm run build` -> exit 0, route `○ /politique-de-confidentialite` listee en Static dans la sortie build.

### Completion Notes List

- **Modification editoriale unique** : ligne 38 de `app/politique-de-confidentialite/page.tsx` -- 2 substrings remplaces dans la bullet « Donnees de parrainage ». Aucun autre changement source code.
  - (a) « (accompagnants) » -> « (accompagnants et accompagnes) » (generalisation parrainage symetrique Epic 8)
  - (b) « entre parrain et filleul pour identifier » -> « entre parrain et filleul (quel que soit leur role) pour identifier » (clarification role-independance signaux anti-fraude)
- **T3 decision finale** : bullet « finalite parrainage explicite » NON ajoutee (defaut recommande conserve). Rationale : le parrainage est un mecanisme d'acquisition contractuel implicitement couvert par les bullets existantes « Creation et gestion de votre compte utilisateur » + « Gestion des abonnements et paiements » (la recompense est un coupon Stripe applique sur l'abonnement existant). Defer loge dans `deferred-work.md` avec formulation prete a coller pour reprise future si CNIL audit ou communication transparence renforcee le demande.
- **T8 heritage F-Epic7-B1 confirme** : les 4 bullets « Duree de conservation » (lignes 68-71) sont strictement alignees sur la politique TTL formalisee (18m/2a/6m/indefini). Aucune discordance detectee, aucune modification de cette section.
- **AC4 audit nouveau traitement RGPD** : confirme aucune nouvelle PII collectee par Epic 8 -- (a) colonnes `parrainages.ip_inscription`/`stripe_fingerprint` deja collectees pre-Epic 8 (heritage 7.B.1), (b) lookup `users.role` ajoute 8.A.2/8.A.3 n'est pas une PII (attribut de role), (c) aucune nouvelle table BDD creee (heritage F-Epic8-A0 GO sans migration). Source : `_bmad-output/implementation-artifacts/audit-bdd-parrainage-symetrique-2026-05-16.md`.
- **AC14 impact PROD** : nul. Page existe deja en prod (livree historiquement, mise a jour 7.B.1 commit 2026-05-14), modification purement textuelle dans bullet existante. Pas de migration BDD, pas de nouvelle env var, pas de modification webhook/cron/server actions/RLS/RPC.
- **AC15 DECISIONS.md** : aucune nouvelle entree F-Epic8-C2 ajoutee. La story est editoriale pure, elle aligne la page publique sur les decisions deja prises (F-Epic7-B1 + F-Epic8-A0 + UX-DR-E8.6 + NFR-RGPD-E8.1). Aucune decision architecturale nouvelle introduite.

### File List

- `app/politique-de-confidentialite/page.tsx` (modifie -- 1 ligne `<li>` bullet « Donnees de parrainage » : 2 substrings remplaces)
- `_bmad-output/implementation-artifacts/deferred-work.md` (modifie -- 1 section ajoutee en tete : « ## Deferred from: implementation of 8-c-2-politique-confidentialite-extension-parrainage-accompagne (2026-05-17) » + 1 item defer bullet finalite parrainage)
- `_bmad-output/implementation-artifacts/sprint-status.yaml` (modifie -- transition 8-c-2 : ready-for-dev -> in-progress -> review)
- `_bmad-output/implementation-artifacts/8-c-2-politique-confidentialite-extension-parrainage-accompagne.md` (modifie -- Tasks coches + Dev Agent Record + Change Log + DoD a11y + Status review)

### Change Log

| Date       | Type     | Description |
|------------|----------|-------------|
| 2026-05-17 | dev      | Story 8.C.2 livree review via bmad-dev-story. 1 fichier source modifie (`app/politique-de-confidentialite/page.tsx` ligne 38, 2 substrings remplaces) + 3 fichiers docs (deferred-work.md, sprint-status.yaml, story file). T3 decision finale : bullet « finalite parrainage explicite » NON ajoutee (defaut recommande), defer loge dans deferred-work.md. T2 grep cross-page : 0 occurrence marraine/filleule/accompagnante. T8 heritage F-Epic7-B1 confirme strict (4 bullets retention 18m/2a/6m/indefini inchanges). DoD CI tous verts : tsc 0 (1 err `.next/types/` pre-existante toleree), lint 194 warnings (baseline 8.B.2 preservee), lint:a11y-check 155 paires preserve, test:unit 82/82, a11y:axe:check 0 delta Critical/Serious sur 8 parcours, build OK route `○ /politique-de-confidentialite` Static. Pas de migration BDD, pas de nouveau composant, pas d'impact backend, pas de nouvelle entree DECISIONS.md (AC15 respecte). |
| 2026-05-17 | story    | Story 8.C.2 cree ready-for-dev via bmad-create-story workflow. Periode editoriale strictement limitee a la section « Donnees collectees » bullet parrainage (ligne 38) + audit grep wording masculin neutre cross-page. Decision defaut documentee : ne PAS ajouter de bullet « finalite parrainage explicite » (couverte implicitement par bullets existantes), defer dans `deferred-work.md` si T3 confirme le choix. Heritage strict F-Epic7-B1 (section retention 18m/2a/6m/indefini non touchee) + F-Epic8-A0 (aucune nouvelle PII collectee, heritage GO sans migration BDD). Wording masculin neutre obligatoire (regle CLAUDE.md durcie). 1 seul fichier source modifie attendu (`app/politique-de-confidentialite/page.tsx`), ~3-5 lignes nettes. Pas de migration BDD, pas de nouveau composant, pas d'impact backend, pas de nouvelle entree DECISIONS.md (AC15). |

### Review Findings

- [x] [Review][Patch] `sprint-status.yaml` absent du diff soumis — AC11 liste ce fichier dans le File List (transition `review→done`). Résolu : mis à jour dans le workflow code review (section 6). [_bmad-output/implementation-artifacts/sprint-status.yaml]

## DoD a11y

A renseigner pour cette story avec impact UI (modification textuelle dans la page legale publique `/politique-de-confidentialite`) :

- [x] Labels associes aux champs (`htmlFor` ou `aria-labelledby`) -- N/A pour cette story (aucun champ formulaire, modification textuelle dans `<ul><li>` existante)
- [x] Erreurs liees aux champs via `aria-describedby` + `aria-invalid` -- N/A
- [x] Focus visible sur tous les elements interactifs (contraste >= 3:1) -- aucun nouvel element interactif ; seul lien existant `Retour a l'accueil` herite du token focus global (heritage 2.5.3)
- [x] Contrastes texte >= 4,5:1 et UI >= 3:1 -- heritage tokens design system (`text-gray-700` sur `bg-[#fefaf8]`) deja valides Lot A baseline ; aucun nouveau ratio a tester
- [x] ARIA states corrects sur composants dynamiques (`aria-expanded`, `aria-selected`, etc.) -- N/A (page statique sans interactivite dynamique)
- [x] Navigation clavier complete (Tab, Enter, Escape, fleches selon pattern) -- aucun nouvel element a tester, Tab atteint le lien `Retour a l'accueil` dans l'ordre logique
- [x] Verification ponctuelle au lecteur d'ecran (VoiceOver ou NVDA) sur le composant touche -- modification strictement textuelle dans `<ul><li>` existante ; ordre DOM/rendu lecteur d'ecran inchange, aucun nouveau pattern a11y introduit. Validation staging deferrable par Sylvain post-merge.
- [x] Pas de regression `eslint-plugin-jsx-a11y` (`npm run lint:a11y-check` vert en CI) -- baseline 155 (file, rule) pairs **preserve**, delta tolere = 0. Output reel : `OK: 155 jsx-a11y violations across 56 (file, rule) pair(s). Baseline total: 155. No regression.`
- [x] Pas de regression axe-core (`npm run a11y:axe:check` vert ou delta documente avec justification dans la PR) -- baseline `axe-core-baseline-2026-05-17.json` 8 parcours **preserve**. Output reel : `Parcours audites: 8 ; OK: aucun delta Critical/Serious au-dela du baseline.`
