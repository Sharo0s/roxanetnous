# Story 8.B.2 : Teaser dashboard accompagne -- "Invitez un accompagnant"

Status: done

<!-- Note: Validation is optional. Run validate-create-story for quality check before dev-story. -->

## Story

As a accompagne avec abonnement actif et code parrainage genere,
I want voir un teaser sur mon dashboard `/accompagne/dashboard` qui m'invite a inviter un accompagnant et qui suit ma progression vers les 6 mois offerts,
so that je decouvre la fonctionnalite parrainage sans avoir a chercher la page dediee `/accompagne/parrainage` -- en respectant les regles CLAUDE.md durcies (wording masculin neutre, pas d'emoji, DoD a11y obligatoire) et le design system "foyer" (refonte 2026-05-11) et le pattern teaser deja en place sur `/accompagnant/dashboard:469-492` (Epic 2).

## Acceptance Criteria

1. **AC1 -- Teaser visible si `subscribed && parrainageCode`** : sur la page `/accompagne/dashboard` (`app/accompagne/dashboard/page.tsx`), un bloc teaser parrainage est rendu **uniquement** quand l'utilisateur a (a) un abonnement actif (`subscribed === true`, deja calcule ligne 28) ET (b) une row `parrainages_codes` avec `code` non null (le code est genere par 8.A.1 a la 1ere transition `subscription.status='active'/'trialing'`). Si l'une des conditions manque, le teaser n'est PAS rendu (pas de fausse promesse, coherence UX-DR-E8.2 + AC2 redirect de 8.B.1).

2. **AC2 -- Lookup `parrainages_codes` ajoute dans le Server Component** : `app/accompagne/dashboard/page.tsx` ajoute apres le bloc `getSubscriptionStatus` (ligne 27) une nouvelle requete Supabase :
   ```ts
   let parrainageCode: string | null = null
   let parrainageCompteur = 0
   let parrainageTotalRecompenses = 0

   if (subscribed) {
     const { data: parrainageRow } = await supabase
       .from('parrainages_codes')
       .select('code, compteur_confirmes, total_recompenses')
       .eq('user_id', user.id)
       .maybeSingle()
     parrainageCode = parrainageRow?.code ?? null
     parrainageCompteur = parrainageRow?.compteur_confirmes ?? 0
     parrainageTotalRecompenses = parrainageRow?.total_recompenses ?? 0
   }
   ```
   **Patron strict** : meme code que `app/accompagnant/dashboard/page.tsx:58-71` mais avec condition `subscribed` (au lieu de `profile?.validation_status === 'valide'` qui n'a pas de sens pour un accompagne -- l'accompagne ne passe pas par OCR/visio). Utiliser `.maybeSingle()` pour gerer le cas "abonnement active depuis < 1 polling cycle webhook" (race window theorique, code pas encore cree -> teaser pas affiche, OK).

3. **AC3 -- Bloc teaser positionne dans la section `Mon espace`** : le bloc est ajoute dans la branche `subscribed === true` (lignes 170-306 actuelles) **dans la section secondaire `Mon espace`** (lignes 265-304), comme **3eme carte du grid** (entre "Mes favoris" et "Mon abonnement"), **uniquement si `parrainageCode` est non null**. Le grid passe de `md:grid-cols-3` (3 cartes : profil/favoris/abonnement) a `md:grid-cols-3` (4 cartes mais positionnement responsive avec `md:grid-cols-3` -> en pratique le grid se reflowe sur 2 lignes desktop avec 4 cartes ; **decision arbitree** : conserver `md:grid-cols-3` et accepter qu'en desktop on a 3 cartes sur la 1ere ligne + 1 sur la 2eme, ou alternativement passer a `md:grid-cols-4` pour les avoir tous sur une ligne -- **a trancher au dev selon rendu visuel** -- recommandation : conserver `md:grid-cols-3` car coherent avec le path accompagnant qui n'augmente pas le grid quand la carte parrainage apparait, cf. `app/accompagnant/dashboard/page.tsx:457-505`). **Ne PAS** creer une section dediee `aria-labelledby="parrainage-title"` separee : on reutilise le contexte semantique `Mon espace` (heading H2 deja en place ligne 266-268), coherence transverse path accompagnant.

4. **AC4 -- Wording masculin neutre obligatoire** (regle CLAUDE.md durcie + UX-DR-E8.4) : le bloc teaser utilise **systematiquement** parrain/filleul/accompagnant, jamais marraine/filleule/accompagnante. Wording strict aligne sur le teaser accompagnant `app/accompagnant/dashboard/page.tsx:469-492` (deja masculin neutre) :
   - Titre H3 : `"Mon parrainage"` (identique path accompagnant)
   - Phrase **etat zero** (`parrainageCompteur === 0 && parrainageTotalRecompenses === 0`) : `"Partagez votre code, 6 mois offerts tous les 5 parrainages."` (identique path accompagnant -- deja neutre, "parrainages" est genre masculin)
   - Phrase **etat progression** (`parrainageCompteur > 0 || parrainageTotalRecompenses > 0`) : `<><strong className="text-gray-900 font-medium">{parrainageCompteur} / 5</strong> parrainages confirmes.</>` (identique path accompagnant)
   - Phrase **micro-copy bas** (visible si `parrainageCompteur < 5`) : `"6 mois offerts a 5 parrainages."` (identique path accompagnant)
   - **Aucune mention du genre "accompagnante" / "marraine" / "filleule"**, meme si le destinataire du parrainage est un accompagnant (l'invitation cible un accompagnant, mais le wording reste neutre).
   - **Pas d'emoji** (regle CLAUDE.md projet).

5. **AC5 -- Barre de progression visuelle 5 segments + a11y `role="group"`** : sous la phrase de progression, une barre de 5 segments `[0, 1, 2, 3, 4]` est rendue identiquement au path accompagnant (`flex gap-1 mt-2 mb-1`, chaque segment `h-1 flex-1 rounded-full bg-kraft` si `i < (parrainageCompteur % 5)` sinon `bg-gray-200`). **L'attribut `aria-hidden="true"` est conserve sur le conteneur** (decoratif uniquement -- la valeur exacte est deja annoncee par le texte de progression). **PAS de `role="progressbar"` sur ce mini-indicateur** (decision : le `role="progressbar"` est reserve a la barre principale de la page `/accompagne/parrainage` -- cf. AC8bis story 8.B.1 -- car le mini-indicateur du dashboard est redondant avec le texte adjacent et un `role="progressbar"` sur un indicateur decoratif sans valeur ajoutee semantique alourdirait l'annonce lecteur d'ecran).

6. **AC6 -- Lien `Link href="/accompagne/parrainage"`** : le bloc teaser entier est wrappe dans un `<Link href="/accompagne/parrainage">` avec les memes classes Tailwind que les autres cartes "Mon espace" :
   ```tsx
   <Link
     href="/accompagne/parrainage"
     className="bg-white rounded-2xl border border-[#e8dfd2] p-6 hover:border-kraft transition flex flex-col"
   >
     {/* contenu */}
   </Link>
   ```
   **Important** : utiliser `rounded-2xl` (pattern accompagne ligne 273) et **pas** `rounded-xl` (pattern accompagnant ligne 472 -- pre-refonte foyer). Cette divergence est intentionnelle : le path accompagne suit le design system foyer (cartes `rounded-2xl` partout, refonte 2026-05-11 commit 8387e40), le path accompagnant est encore sur `rounded-xl` (a aligner en 8.C.X ou epic suivant -- defer accepte ici).

7. **AC7 -- Pas de modification du teaser accompagnant existant** : `app/accompagnant/dashboard/page.tsx` lignes 469-492 ne sont **pas** modifiees par cette story. Le teaser accompagnant Epic 2 reste tel quel (`rounded-xl`, condition `validation_status === 'valide'`). L'alignement (`rounded-xl` -> `rounded-2xl` + autres polishings cosmetiques) est defer Epic 9 ou story dediee cleanup -- ouvrir une entree `deferred-work.md`.

8. **AC8 -- DoD a11y obligatoire** (regle CLAUDE.md durcie + NFR-A11y-E8.1) :
   - **Pas de regression `lint:a11y-check`** : baseline 155 (file, rule) pairs (cf. `_bmad-output/test-artifacts/a11y-lint-baseline-2026-05-13.txt`) **preserve** -- delta tolere = 0 (cf. `scripts/check-a11y-baseline.mjs:115`). Le bloc teaser est ajoute dans une page existante `/accompagne/dashboard` qui est deja auditee, donc aucun nouveau fichier n'est introduit dans la baseline.
   - **Pas de regression `a11y:axe:check`** : le dashboard accompagne n'est PAS audite directement par axe-core (aucun parcours P[N] ne cible `/accompagne/dashboard` -- les parcours auth-required utilisent `/login` comme proxy, cf. `tests/a11y/lib/auth-stub.md`). **Aucune regen baseline axe-core requise**. Le check `npm run a11y:axe:check` doit rester exit 0 sur la baseline actuelle `axe-core-baseline-2026-05-17.json` (8 parcours).
   - **Heading hierarchy preserve** : le bloc teaser reutilise `<h3>` (carte secondaire) sous le `<h2 id="mon-espace-title">` existant (ligne 266). Pas de saut de niveau, hierarchie H1 (sr-only ligne 71) -> H2 (`Mon espace`) -> H3 (`Mon parrainage`) coherente.
   - **Focus visible** : `<Link>` herite du token focus global (heritage 2.5.3) -- pas d'override `focus:outline-none` ; les cartes ont deja `hover:border-kraft transition` qui s'applique aussi au focus visuel.
   - **Contrastes** : `text-gray-600` sur `bg-white` ratio >= 4.5:1 (token design system foyer, deja valide Lot A baseline) ; `text-gray-900` strong/font-medium sur `bg-white` OK ; `text-xs text-gray-500` micro-copy `>= 18pt equivalent` borderline mais conforme italic + petit (heritage path accompagnant). Le segment `bg-kraft` (rempli) vs `bg-gray-200` (vide) est decoratif (`aria-hidden="true"`), pas de contrainte contraste WCAG.
   - **Navigation clavier** : Tab atteint le `<Link>` dans l'ordre logique (apres "Mon profil", "Mes favoris", avant "Mon abonnement") ; Enter active la navigation vers `/accompagne/parrainage` ; pas de modal / pas de Escape requis.
   - **Lecteur d'ecran** : annonce attendue (en mode etat zero) : "Lien : Mon parrainage. Partagez votre code, 6 mois offerts tous les 5 parrainages. 6 mois offerts a 5 parrainages." (la barre `aria-hidden` ne sera pas annoncee, ce qui est voulu pour eviter "vide vide vide rempli rempli" sans contexte de progression). En mode etat progression : "Lien : Mon parrainage. **2 / 5** parrainages confirmes. 6 mois offerts a 5 parrainages." (le `<strong>` est annonce comme accentuation par NVDA/VoiceOver). 
   - **Pas de touche emoji** : regle CLAUDE.md projet (pas d'emojis dans code/interfaces).

9. **AC9 -- Test ponctuel sans seed accompagne local accepte (defer T7)** : la validation manuelle navigateur (regle CLAUDE.md "test UI") est limitee par l'absence de seed local accompagne+abo+code (heritage `feedback_test_local_supabase` Sylvain pas de Docker). Le dev verifie ce qui est testable localement (rendu visuel via account accompagne factice ou story HTML standalone) ; la validation reelle sur 1 des 3 accompagnes prod est defer T7 staging post-merge par Sylvain. La page hote `/accompagne/dashboard` est deja en prod (refonte foyer 2026-05-11 commit 8387e40), la nouveaute est limitee a 1 carte conditionnelle dans la grid `Mon espace`.

10. **AC10 -- Pas de modification backend / pas de migration BDD / pas de nouveau composant** : zero modification sur `app/actions/parrainage.ts`, `app/api/cron/confirm-parrainages/route.ts`, `app/api/webhooks/stripe/route.ts`, `lib/parrainage-codes.ts`, `lib/emails.ts`, `lib/subscription-helpers.ts`, `components/accompagne/parrainage-view.tsx` (livre 8.B.1), `app/accompagne/parrainage/page.tsx` (livre 8.B.1), `components/layout/accompagne-dashboard-header.tsx` (deja etendu 8.B.1). **Pas de nouveau composant cree** : le teaser est inline dans `app/accompagne/dashboard/page.tsx` (pattern miroir du path accompagnant qui inline le bloc). La story est strictement additive : 1 lookup BDD + 1 bloc JSX conditionnel.

11. **AC11 -- Audit `git diff --stat` final attendu** :
    - **Crees** : aucun
    - **Modifies** : `app/accompagne/dashboard/page.tsx` (~30 lignes nettes : 1 lookup `parrainages_codes` ~12 lignes + 1 carte teaser conditionnelle ~22 lignes)
    - **Documentation** : `_bmad-output/implementation-artifacts/deferred-work.md` (entree defer "alignement teaser accompagnant `rounded-xl` -> `rounded-2xl`" si confirme cosmetique restant + entrees si applicable), `_bmad-output/implementation-artifacts/sprint-status.yaml` (passage status backlog -> ready-for-dev -> in-progress -> review -> done), `_bmad-output/implementation-artifacts/8-b-2-teaser-dashboard-accompagne-invitez-accompagnant.md` (Tasks coches + Dev Agent Record final)

12. **AC12 -- Validations CI obligatoires avant livraison** (DoD pre-commit story livraison) :
    - `npx tsc --noEmit` : 0 erreur sur les fichiers modifies (2 erreurs `.next/types/` pre-existantes tolerees -- heritage 8.A.3/8.A.4/8.B.1)
    - `npm run lint` : exit 0, baseline <= 194 warnings (heritage 8.B.1 -- aucun nouveau `as any`, aucun warning custom)
    - `npm run lint:a11y-check` : exit 0, baseline 155 (file, rule) preserve -- aucune nouvelle paire warning (le fichier `app/accompagne/dashboard/page.tsx` est deja dans la baseline pour ses warnings legitimes)
    - `npm run check:no-direct-notifications-log-insert` : exit 0 (la page n'INSERTe pas dans `notifications_log`)
    - `npm run check:as-any-global` / `check:as-any-admin` / `check:oracle-paywall` / `check:rls-helpers` (skip local OK) / `check:ip-spoofing` : tous exit 0 (heritage Epic 5/6/7)
    - `npm run test:unit` : 82/82 verts (non-regression -- aucun test unitaire nouveau requis car aucune logique pure ajoutee -- defer T8 ci-dessous accepte)
    - `npm run a11y:axe:check` : exit 0 sur baseline `axe-core-baseline-2026-05-17.json` (8 parcours, aucun nouveau parcours requis -- la page `/accompagne/dashboard` n'est pas auditee directement, cf. AC8)
    - `npm run build` : exit 0, route `ƒ /accompagne/dashboard` listee dans la sortie build (deja en place avant cette story, juste verifier non-regression)
    - **Validation manuelle navigateur** (regle CLAUDE.md "test UI") : voir AC9 -- testable localement uniquement avec compte factice ou skip vers T7 staging

13. **AC13 -- Coherence cross-story 8.A.* + 8.B.1** :
    - **8.A.1 deja merge** : le code parrainage est genere par le webhook Stripe a la 1ere transition `status='active'`/`'trialing'` ; le teaser 8.B.2 lit donc une row deja existante via Supabase Server Component (`maybeSingle()` gere la race window theorique).
    - **8.B.1 deja merge** : la page cible `/accompagne/parrainage` existe en prod, le lien du teaser navigue vers une route fonctionnelle. Le `AccompagneDashboardHeader currentPage="dashboard"` (deja en place) ne change pas (le teaser est dans le contenu de la page, pas dans le header).
    - **8.C.3 (wording neutre cross-codebase)** : la story 8.B.2 livre un bloc teaser **deja neutre** -- 8.C.3 alignera le teaser accompagnant historique (qui est deja neutre cote phrases mais reste sur `rounded-xl` -- alignement cosmetique).
    - **AC15 cross-story 8.B.1** : 8.B.1 mentionnait "8.B.2 ajoutera un bloc teaser conditionnel `subscribed && code`" -- AC1 ci-dessus respecte strictement cette specification.

14. **AC14 -- Pas d'impact PROD avant deploy** : la story s'execute en preview Vercel sans risque puisque :
    - pas de migration BDD (heritage F-Epic8-A0 GO)
    - pas de nouvelle env var requise
    - pas de modification webhook / cron / server actions
    - le teaser est strictement additif : la page `/accompagne/dashboard` existe deja en prod (refonte foyer 2026-05-11 commit 8387e40), avec 3 cartes "Mon espace". 8.B.2 ajoute 1 carte conditionnelle (4eme) entre la 2eme et la 3eme.
    - les 3 accompagnes en prod actuels (audit BDD 2026-05-16 -- 822 accompagnant / 3 accompagne / 1 admin) verront le teaser **uniquement** si (a) ils ont un abonnement actif ET (b) le webhook Stripe 8.A.1 a deja cree leur code parrainage (audit MCP post-merge a faire pour Sylvain : `SELECT u.id, u.email, s.status, pc.code FROM users u LEFT JOIN subscriptions s ON s.user_id = u.id LEFT JOIN parrainages_codes pc ON pc.user_id = u.id WHERE u.role = 'accompagne'`)

15. **AC15 -- Pas de nouvelle entree DECISIONS.md requise** : les decisions arbitrees (positionnement dans `Mon espace` en 4eme carte, pas de `role="progressbar"` sur le mini-indicateur, pas de touche au teaser accompagnant existant, divergence `rounded-2xl`/`rounded-xl` assumee) sont consignees dans les AC3/AC5/AC7 et dans le Change Log. **Pas de nouvelle entree F-Epic8-B2 dans DECISIONS.md** -- la story est UI pure additive, sans decision architecturale nouvelle.

## Tasks / Subtasks

- [x] **T1 -- Ajouter le lookup `parrainages_codes` au Server Component** (AC: #1, #2)
  - [x] T1.1 -- Editer `app/accompagne/dashboard/page.tsx`. Apres le calcul de `subscribed` (ligne 28), ajouter le bloc :
    ```ts
    let parrainageCode: string | null = null
    let parrainageCompteur = 0
    let parrainageTotalRecompenses = 0

    if (subscribed) {
      const { data: parrainageRow } = await supabase
        .from('parrainages_codes')
        .select('code, compteur_confirmes, total_recompenses')
        .eq('user_id', user.id)
        .maybeSingle()
      parrainageCode = parrainageRow?.code ?? null
      parrainageCompteur = parrainageRow?.compteur_confirmes ?? 0
      parrainageTotalRecompenses = parrainageRow?.total_recompenses ?? 0
    }
    ```
  - [x] T1.2 -- Verifier que le lookup est conditionnel `if (subscribed)` (evite un round-trip Supabase inutile pour les accompagnes sans abo). Si non-subscribed, les 3 variables restent a leur valeur initiale (`null`, `0`, `0`) -- la condition d'affichage AC1 sera `subscribed && parrainageCode` qui retournera false correctement.
  - [x] T1.3 -- `npx tsc --noEmit` : verifier 0 erreur.

- [x] **T2 -- Ajouter la carte teaser dans la section `Mon espace`** (AC: #3, #4, #5, #6)
  - [x] T2.1 -- Localiser la section `Mon espace` dans la branche `subscribed === true` (`app/accompagne/dashboard/page.tsx:265-304`).
  - [x] T2.2 -- Apres la carte "Mes favoris" (ligne 281-291) et **avant** la carte "Mon abonnement" (ligne 293-301), ajouter la carte teaser conditionnelle :
    ```tsx
    {parrainageCode && (
      <Link
        href="/accompagne/parrainage"
        className="bg-white rounded-2xl border border-[#e8dfd2] p-6 hover:border-kraft transition flex flex-col"
      >
        <h3 className="italic text-lg mb-2">Mon parrainage</h3>
        <p className="text-gray-600 text-sm">
          {parrainageCompteur > 0 || parrainageTotalRecompenses > 0
            ? <><strong className="text-gray-900 font-medium">{parrainageCompteur} / 5</strong> parrainages confirmes.</>
            : 'Partagez votre code, 6 mois offerts tous les 5 parrainages.'}
        </p>
        <div className="flex gap-1 mt-2 mb-1" aria-hidden="true">
          {[0, 1, 2, 3, 4].map((i) => (
            <span
              key={i}
              className={`h-1 flex-1 rounded-full ${i < (parrainageCompteur % 5) ? 'bg-kraft' : 'bg-gray-200'}`}
            />
          ))}
        </div>
        {parrainageCompteur < 5 && (
          <p className="text-xs text-gray-500 mt-2">6 mois offerts a 5 parrainages.</p>
        )}
      </Link>
    )}
    ```
  - [x] T2.3 -- Verifier wording masculin neutre : "parrainages" (pluriel), "confirmes" (masculin), pas de "marraine"/"filleule"/"accompagnante", pas d'emoji.
  - [x] T2.4 -- Conserver `rounded-2xl` (coherence design system foyer accompagne, refonte 2026-05-11) -- divergence assumee avec path accompagnant qui reste sur `rounded-xl` (alignement defer 8.C.X ou epic suivant).
  - [x] T2.5 -- Conserver `aria-hidden="true"` sur le conteneur de la barre de progression (decoratif, valeur exacte annoncee par le texte adjacent -- decision AC5).

- [x] **T3 -- Validation CI DoD** (AC: #12)
  - [x] T3.1 -- `npx tsc --noEmit` : 0 erreur sur les fichiers modifies (tolerer les 6 erreurs `.next/types/` pre-existantes -- heritage 8.A.3/8.A.4/8.B.1).
  - [x] T3.2 -- `npm run lint` : exit 0, **194 warnings** (= baseline 8.B.1 maintenue).
  - [x] T3.3 -- `npm run lint:a11y-check` : exit 0, **155** (file, rule) preserve, aucune nouvelle paire warning sur `app/accompagne/dashboard/page.tsx` (deja dans la baseline).
  - [x] T3.4 -- `check:no-direct-notifications-log-insert` / `check:as-any-global` / `check:as-any-admin` / `check:oracle-paywall` / `check:rls-helpers` (skip local SUPABASE_URL absent) / `check:ip-spoofing` : tous exit 0.
  - [x] T3.5 -- `npm run test:unit` : **82/82** verts (non-regression).
  - [x] T3.6 -- `npm run a11y:axe:check` : exit 0 sur baseline `axe-core-baseline-2026-05-17.json` (8 parcours, 0 delta Critical/Serious).
  - [x] T3.7 -- `npm run build` : exit 0, route `ƒ /accompagne/dashboard` listee dans la sortie build.
  - [x] T3.8 -- Validation navigateur reportee a T5 staging Sylvain (heritage `feedback_test_local_supabase` Sylvain pas de Docker, pas de seed accompagne+abo+code local).

- [x] **T4 -- Documentation et coherence** (AC: #7, #11, #13)
  - [x] T4.1 -- Section `## Deferred from: implementation of 8-b-2-teaser-dashboard-accompagne-invitez-accompagnant (2026-05-17)` ajoutee dans `_bmad-output/implementation-artifacts/deferred-work.md` avec 1 entree defer : alignement teaser parrainage accompagnant `rounded-xl` -> `rounded-2xl` (`app/accompagnant/dashboard/page.tsx:472`).
  - [x] T4.2 -- Verifie : aucune entree existante barree par 8.B.2 (story livrant une nouveaute UI pure, pas une dette pre-existante).
  - [x] T4.3 -- Pas de nouvelle entree `DECISIONS.md` requise (cf. AC15) -- decisions consignees dans AC + Change Log.

- [ ] **T5 -- Validation manuelle staging post-merge** (AC: #9, #14) -- **A executer par Sylvain post-merge**
  - [ ] T5.1 -- Audit MCP : `SELECT u.id, u.email, s.status, pc.code, pc.compteur_confirmes FROM users u LEFT JOIN subscriptions s ON s.user_id = u.id LEFT JOIN parrainages_codes pc ON pc.user_id = u.id WHERE u.role = 'accompagne'` (verifier les 3 accompagnes prod : combien ont un code genere, combien ont sub active).
  - [ ] T5.2 -- Naviguer `/accompagne/dashboard` connecte comme un accompagne avec sub active + code (test session reelle). Verifier la presence du teaser dans la section "Mon espace" avec la phrase "Partagez votre code, 6 mois offerts tous les 5 parrainages." (etat zero).
  - [ ] T5.3 -- Verifier la navigation clavier : Tab atteint le lien teaser dans l'ordre logique, Enter navigue vers `/accompagne/parrainage`.
  - [ ] T5.4 -- Verifier qu'un accompagne **sans abonnement actif** (ou sans code -- race theorique) ne voit PAS le teaser (le bandeau `AccompagneSubscriptionBanner` reste affiche dans la branche non-subscribed).

## Dev Notes

### Contexte metier

Cette story livre la **piece UI de decouverte** du parrainage accompagne -- sans elle, la page `/accompagne/parrainage` (livree 8.B.1) reste accessible uniquement par URL directe ou via un futur item nav (defer). Le teaser rend la fonctionnalite **visible** depuis le dashboard, dans la section "Mon espace" deja designee comme zone d'agregation des entrees secondaires (profil, favoris, abonnement). 8.B.2 boucle ainsi le mini-epic 8.B avec une UX naturelle : l'accompagne voit son code mentionne, son compteur de progression, et un CTA implicite (clic sur la carte) qui ouvre `/accompagne/parrainage` pour les details (code grand format, lien d'invitation, liste filleuls).

### Pourquoi un lookup conditionnel `if (subscribed)` (rappel AC1, T1.2)

Le lookup `parrainages_codes` ne fait sens que pour les accompagnes avec abonnement actif :
1. **Garantie metier 8.A.1** : le code n'est genere QUE par le webhook Stripe a la 1ere transition `subscription.status='active'/'trialing'`. Avant ca, `parrainages_codes` est vide pour cet utilisateur.
2. **Economie de round-trip BDD** : sans la garde `if (subscribed)`, on ferait une requete Supabase systematique pour des accompagnes sans abo (la majorite jusqu'a un go-live large), tous retournant null. Pattern aligne sur le path accompagnant qui n'execute le lookup que si `validation_status === 'valide'` (`app/accompagnant/dashboard/page.tsx:62`).
3. **Race window theorique** : si webhook 8.A.1 a un delai (queue, retry), un accompagne peut etre `subscribed === true` AVANT que `parrainages_codes` ne contienne sa row. Le `.maybeSingle()` retourne alors `null`, `parrainageCode` reste `null`, le teaser n'est pas affiche -- l'utilisateur ne voit "rien" plutot que "Mon parrainage avec code vide". Le teaser apparaitra au prochain refresh apres reception du webhook (delta typique : secondes).

### Pourquoi pas de `role="progressbar"` sur la mini-barre 5 segments (rappel AC5)

Le `role="progressbar"` est livre par 8.B.1 sur la barre principale de `/accompagne/parrainage` (AC8bis story 8.B.1) car c'est l'**indicateur principal** de progression sur la page dediee (focus utilisateur sur cet element). Sur le dashboard, la mini-barre 5 segments est :
- **decorative** : la valeur exacte est deja annoncee par le texte adjacent ("2 / 5 parrainages confirmes")
- **synthetique** : 5 segments discrets ne se pretent pas a `aria-valuenow/min/max` continu (un user lecteur d'ecran entendrait "barre de progression 2 sur 5" doublonnant le texte qui dit deja "2 / 5")
- **redondante** : entendre "barre de progression 2 sur 5, valeur 2 sur 5" est verbose et n'apporte aucune information nouvelle

**Decision** : conserver `aria-hidden="true"` comme le path accompagnant historique (heritage Epic 2). Si retour utilisateur futur signale un manque, evaluer en 8.C.X ou epic 9 (mais peu probable -- le pattern actuel respecte WCAG 2.2 et est l'option recommandee pour les indicateurs purement decoratifs).

### Pourquoi pas de modification du teaser accompagnant existant (rappel AC7)

Le teaser accompagnant (`app/accompagnant/dashboard/page.tsx:469-492`) est en production depuis Epic 2 (2026-04-29). Il fonctionne, il est conforme. Les seules differences cosmetiques visibles entre les 2 versions :
- `rounded-xl` (accompagnant pre-refonte foyer) vs `rounded-2xl` (accompagne, refonte foyer 2026-05-11)
- Le composant `SubscriptionBanner` lateral n'existe pas cote accompagne (le banner est rendu directement dans la branche `!subscribed`)

**Decision** : ne pas toucher le path accompagnant -- la story 8.B.2 est strictement additive cote accompagne, et l'alignement cosmetique est reportable a une story dediee "polish design system cross-roles" (epic 9 ou 8.C.X). Risque regression nul.

### Patterns hérites et a réutiliser

| Pattern | Source | Application 8.B.2 |
|---|---|---|
| Lookup `parrainages_codes` + `maybeSingle()` + variables `code`/`compteur`/`totalRecompenses` | `app/accompagnant/dashboard/page.tsx:58-71` | T1 (adapter condition `subscribed` au lieu de `validation_status==='valide'`) |
| Carte teaser `Link` avec H3 + paragraphe conditionnel + 5 segments + micro-copy | `app/accompagnant/dashboard/page.tsx:469-492` | T2 (adapter `rounded-2xl` + `href="/accompagne/parrainage"`) |
| Container cartes "Mon espace" `grid grid-cols-1 md:grid-cols-3 gap-4` | `app/accompagne/dashboard/page.tsx:269` | T2 (insertion dans le grid existant) |
| `<strong className="text-gray-900 font-medium">` accentuation dans paragraphe | `app/accompagnant/dashboard/page.tsx:477` | T2 (copy strict) |
| `aria-hidden="true"` sur mini-barre decorative 5 segments | `app/accompagnant/dashboard/page.tsx:480` | T2 (pattern miroir) |

### Wording masculin neutre dans le bloc teaser (rappel AC4)

Liste exhaustive des chaines a respecter strictement :

| Chaine | Mode | Statut genre |
|---|---|---|
| `"Mon parrainage"` | titre H3 | neutre (le mot "parrainage" est masculin) |
| `"Partagez votre code, 6 mois offerts tous les 5 parrainages."` | etat zero | neutre (parrainages = masculin pluriel) |
| `{parrainageCompteur} / 5` | accentuation `<strong>` | numerique (pas de genre) |
| `" parrainages confirmes."` | etat progression | neutre (confirmes = masculin pluriel, OK car "parrainages" est masculin) |
| `"6 mois offerts a 5 parrainages."` | micro-copy bas | neutre |

**Aucune** mention "marraine"/"filleule"/"accompagnante"/"filleules"/"marraines" ne doit apparaitre. Le mot "accompagnant" pourrait theoriquement apparaitre (cible de l'invitation), mais le wording propose ne le mentionne pas -- l'invitation cible un accompagnant mais le copy reste sur la progression du parrain, pas sur le destinataire.

### Pieges TypeScript

- Le typage de la requete `parrainages_codes.select('code, compteur_confirmes, total_recompenses')` retourne un `{ code: string | null, compteur_confirmes: number | null, total_recompenses: number | null } | null` -- les `?? null` et `?? 0` dans T1.1 gerent les nullability strictement.
- Pas de cast `as` necessaire (heritage 5.C.1 `check-as-any-global` -- zero `as any` introduit par cette story).
- Le `Link` de `next/link` est deja importe (`app/accompagne/dashboard/page.tsx:3`), pas de nouvel import requis.

### Pieges a11y

- **NE PAS** ajouter `role="progressbar"` sur le conteneur de la mini-barre (decision AC5). L'attribut serait redondant avec le texte adjacent et alourdirait l'annonce lecteur d'ecran.
- **NE PAS** retirer `aria-hidden="true"` du conteneur de la mini-barre -- les 5 spans `<span>` non-text sans aria seraient annonces comme "groupe de 5 elements" sans contexte, ce qui est plus verbose que la decision actuelle (heritage Epic 2).
- **NE PAS** wrapper le `<h3>` dans un `<header>` -- la section "Mon espace" a deja son H2 (ligne 266), un `<header>` autour de la carte ajouterait un landmark `banner` parasite.
- **NE PAS** override le `focus:outline-none` du `<Link>` sans equivalent `focus:ring-*` -- le token focus global (heritage 2.5.3) doit etre preserve.

### Pieges design system "foyer"

- Bg carte : `bg-white` (pas `bg-[#fefaf8]` qui est le bg page)
- Bordure carte : `border border-[#e8dfd2]` (token kraft clair)
- Hover : `hover:border-kraft transition` (pas de translation `translate-y` ici -- coherence avec les autres cartes "Mon espace" qui n'utilisent pas la translation)
- Rounded : `rounded-2xl` (pas `rounded-xl` -- divergence assumee path accompagnant)
- Texte H3 : `italic text-lg mb-2` (token editorial)
- Texte paragraphe : `text-gray-600 text-sm`
- Texte micro-copy : `text-xs text-gray-500 mt-2`
- Strong : `text-gray-900 font-medium` (pas `font-bold` pour rester elegant)
- Barre vide : `bg-gray-200` ; remplie : `bg-kraft`

### Localisation des fichiers a modifier (recap)

| Fichier | Statut | Lignes attendues |
|---|---|---|
| `app/accompagne/dashboard/page.tsx` | MODIFIE | +~30 lignes (1 bloc lookup ~12L + 1 carte teaser ~22L conditionnelle) |
| `_bmad-output/implementation-artifacts/deferred-work.md` | MODIFIE | +1 section + 1 entree defer |
| `_bmad-output/implementation-artifacts/sprint-status.yaml` | MODIFIE | ready-for-dev -> in-progress -> review -> done |
| `_bmad-output/implementation-artifacts/8-b-2-teaser-dashboard-accompagne-invitez-accompagnant.md` | MODIFIE | Tasks coches + Dev Agent Record |

### Fichiers a NE PAS toucher (audit zero diff attendu)

- `app/actions/parrainage.ts` (server actions deja role-aware via 8.A.2)
- `app/api/cron/confirm-parrainages/route.ts` (cron deja role-aware via 8.A.3)
- `app/api/webhooks/stripe/route.ts` (webhook deja role-aware via 8.A.1)
- `lib/parrainage-codes.ts` (helper deja en place via 8.A.1)
- `lib/emails.ts` (rien a changer ici)
- `lib/subscription-helpers.ts` (`getSubscriptionStatus` deja utilise dans le dashboard)
- `components/accompagne/parrainage-view.tsx` (livre 8.B.1, pas touche)
- `app/accompagne/parrainage/page.tsx` (livree 8.B.1, le teaser linke vers elle)
- `components/layout/accompagne-dashboard-header.tsx` (deja etendu 8.B.1 -- union `currentPage` contient `'parrainage'`, mais on reste `currentPage="dashboard"` ici)
- `app/accompagnant/dashboard/page.tsx` (path accompagnant intact, defer 8.C.X)
- `components/accompagnant/parrainage-view.tsx` (composant Epic 2 -- alignement 8.C.3)
- `components/accompagne/subscription-banner.tsx` (banner deja en place pour branche `!subscribed`)
- Tests a11y `tests/a11y/p*-*.spec.ts` (aucun nouveau parcours requis -- le dashboard n'est pas audite directement)
- Tests unit `tests/unit/` (aucun test pure logic ajoute par cette story)
- Toutes les migrations BDD (heritage F-Epic8-A0 GO)

### Structure suggeree du bloc teaser (extrait JSX a inserer)

```tsx
{/* Carte teaser parrainage -- inseree entre "Mes favoris" et "Mon abonnement"
    dans la section "Mon espace", uniquement si subscribed && parrainageCode */}
{parrainageCode && (
  <Link
    href="/accompagne/parrainage"
    className="bg-white rounded-2xl border border-[#e8dfd2] p-6 hover:border-kraft transition flex flex-col"
  >
    <h3 className="italic text-lg mb-2">Mon parrainage</h3>
    <p className="text-gray-600 text-sm">
      {parrainageCompteur > 0 || parrainageTotalRecompenses > 0
        ? <><strong className="text-gray-900 font-medium">{parrainageCompteur} / 5</strong> parrainages confirmes.</>
        : 'Partagez votre code, 6 mois offerts tous les 5 parrainages.'}
    </p>
    <div className="flex gap-1 mt-2 mb-1" aria-hidden="true">
      {[0, 1, 2, 3, 4].map((i) => (
        <span
          key={i}
          className={`h-1 flex-1 rounded-full ${i < (parrainageCompteur % 5) ? 'bg-kraft' : 'bg-gray-200'}`}
        />
      ))}
    </div>
    {parrainageCompteur < 5 && (
      <p className="text-xs text-gray-500 mt-2">6 mois offerts a 5 parrainages.</p>
    )}
  </Link>
)}
```

### Coupures securite / sentinelles

- **Pas de session Supabase exposee cote client** : la page est Server Component, l'`access_token` reste dans le cookie HttpOnly. Le teaser recoit uniquement des donnees serialisees safe (code 8 chars + compteurs entiers).
- **Pas de leak du `user.id` cote client** : seuls le code parrainage (8 chars alphanumeriques) et les compteurs entiers sont rendus dans le HTML.
- **Pas de bypass auth runtime** : la page est protegee par `supabase.auth.getUser()` + role check `accompagne` (deja en place, lignes 13-22).
- **Lookup conditionnel `if (subscribed)`** : evite tout round-trip BDD pour les accompagnes sans abo, reduit la surface d'attaque DoS.

### Liens stories suivantes

- **8.C.1 (page admin tous roles + filtre)** : la page admin lit `parrainages` toutes roles confondues -- 8.B.2 n'a aucun impact admin.
- **8.C.3 (wording neutre cross-codebase + rename email)** : pourrait reprendre l'alignement cosmetique `rounded-xl` -> `rounded-2xl` du teaser accompagnant historique (defer ouvert par 8.B.2).
- **8.D.1 (E2E Playwright golden path)** : pourrait inclure la verification du teaser dashboard dans le scenario complet (signup accompagne -> souscription -> visite dashboard -> verif teaser visible -> clic -> arrivee `/accompagne/parrainage`).

### References

- [Source: _bmad-output/planning-artifacts/epic-8.md#Story 8.B.2] -- spec AC originale (teaser dashboard)
- [Source: _bmad-output/planning-artifacts/epic-8.md#UX-DR-E8.2] -- dashboard accompagne affiche un teaser "Invitez un accompagnant et gagnez 6 mois" visible uniquement si abonnement actif
- [Source: _bmad-output/planning-artifacts/epic-8.md#UX-DR-E8.4] -- wording UI neutre (parrain/filleul/accompagnant)
- [Source: _bmad-output/planning-artifacts/epic-8.md#FR49] -- code parrainage 8 caracteres pour accompagne abonne (prerequis 8.A.1)
- [Source: _bmad-output/implementation-artifacts/8-b-1-page-accompagne-parrainage-code-filleuls-a11y.md#AC15] -- 8.B.2 ajoutera un bloc teaser conditionnel "Invitez un accompagnant" sous condition `subscribed && code`
- [Source: _bmad-output/implementation-artifacts/8-a-1-webhook-stripe-genese-code-parrainage-accompagne.md] -- code parrainage genere a la 1ere transition `status='active'`/`'trialing'` (prerequis pour 8.B.2 lookup)
- [Source: _bmad-output/implementation-artifacts/audit-bdd-parrainage-symetrique-2026-05-16.md] -- invariants BDD (`parrainages_codes.user_id` UNIQUE, `parrainages_codes.code` UNIQUE, RLS owner read OK pour accompagne)
- [Source: app/accompagne/dashboard/page.tsx:1-312] -- page hote a modifier (Server Component + branche subscribed/non-subscribed)
- [Source: app/accompagnant/dashboard/page.tsx:58-71,469-492] -- patron de reference (lookup conditionnel + bloc teaser inline)
- [Source: components/layout/accompagne-dashboard-header.tsx:11] -- union type `currentPage` deja etendue par 8.B.1 (contient `'parrainage'`, mais 8.B.2 reste sur `currentPage="dashboard"`)
- [Source: components/accompagne/subscription-banner.tsx:1-19] -- composant "Abonnement requis" deja en place pour branche `!subscribed` (NON modifie par 8.B.2)
- [Source: lib/subscription-helpers.ts:73-115] -- `getSubscriptionStatus` deja appele ligne 26 (variable `subscription` reutilisee pour `subscribed`)
- [Source: tests/a11y/README.md] -- documentation suite axe-core (aucun parcours requis pour le dashboard)
- [Source: scripts/check-a11y-baseline.mjs:113-149] -- garde-fou par paire (file, rule) -- delta tolere = 0
- [Source: _bmad-output/test-artifacts/a11y-lint-baseline-2026-05-13.txt] -- baseline lint a11y 155 paires
- [Source: _bmad-output/test-artifacts/axe-core-baseline-2026-05-17.json] -- baseline axe-core 8 parcours 0 violations
- [Source: .claude/CLAUDE.md] -- regle a11y obligatoire + regle genre masculin neutre + regle pas d'emojis
- [Source: DECISIONS.md#F-Epic8-A0] -- GO sans migration BDD pour Epic 8

## Dev Agent Record

### Agent Model Used

claude-opus-4-7[1m] (Opus 4.7 1M context)

### Debug Log References

- `npx tsc --noEmit` : 6 erreurs `.next/types/` pre-existantes tolerees (heritage 8.A.3/8.A.4/8.B.1), 0 erreur sur les fichiers modifies.
- `npm run lint` : 194 warnings (= baseline 8.B.1 maintenue, aucun nouveau warning introduit).
- `npm run lint:a11y-check` : OK 155 jsx-a11y violations across 56 (file, rule) pair(s). Baseline total: 155. No regression.
- `npm run check:no-direct-notifications-log-insert` : OK aucun INSERT direct.
- `npm run check:as-any-global` : OK aucune occurrence `as any` hors `app/admin/`.
- `npm run check:as-any-admin` : OK aucune occurrence `as any` dans `app/admin/`.
- `npm run check:oracle-paywall` : OK aucun message paywall messagerie expose le role cible.
- `npm run check:rls-helpers` : skip legitime (SUPABASE_URL absent local, heritage `feedback_test_local_supabase`).
- `npm run check:ip-spoofing` : OK aucune lecture directe x-forwarded-for / x-real-ip.
- `npm run test:unit` : 82/82 verts en 1.13s, Test Files 9 passed (9).
- `npm run a11y:axe:check` : 8 parcours audites, aucun delta Critical/Serious au-dela du baseline.
- `npm run build` : OK, route `ƒ /accompagne/dashboard` listee dans la sortie build (non-regression).

### Completion Notes List

- **Story strictement additive** : 1 fichier source modifie (`app/accompagne/dashboard/page.tsx`), 30 lignes nettes ajoutees (12L lookup `parrainages_codes` apres `subscribed` ligne 28 + 25L bloc JSX conditionnel `{parrainageCode && (...)}` insere entre la carte "Mes favoris" (ligne 281-291) et la carte "Mon abonnement" (ligne 293-301)).
- **4 decisions arbitrees du cadrage honorees** : (a) lookup `parrainages_codes` conditionnel `if (subscribed)` pour eviter round-trip BDD inutile + coherence pattern accompagnant `app/accompagnant/dashboard/page.tsx:62-71`, (b) positionnement carte teaser en 4eme position de la section "Mon espace" (entre Favoris et Abonnement) sans reflowage du grid `md:grid-cols-3` -- 4 cartes en 2 lignes sur desktop (3+1), coherent avec le path accompagnant, (c) `aria-hidden="true"` conserve sur le conteneur de la mini-barre 5 segments (decoratif, valeur exacte annoncee par texte adjacent -- pas de `role="progressbar"` redondant), (d) `rounded-2xl` aligne sur design system foyer accompagne (refonte 2026-05-11 commit 8387e40), divergence assumee avec `rounded-xl` accompagnant (defer 8.C.X).
- **Wording masculin neutre strict** : "Mon parrainage" (titre H3), "Partagez votre code, 6 mois offerts tous les 5 parrainages." (etat zero), `{X} / 5 parrainages confirmés.` (etat progression avec accent UTF-8 coherent codebase), "6 mois offerts à 5 parrainages." (micro-copy bas avec accent UTF-8). Le path accompagnant `app/accompagnant/dashboard/page.tsx:477,489` utilise deja les accents UTF-8 ("confirmés", "à") -- coherence cross-roles preservee, regle CLAUDE.md durcie genre masculin neutre + pas d'emoji respectee.
- **Race window theorique geree** : `.maybeSingle()` retourne `null` si `parrainages_codes` n'a pas encore ete cree par le webhook 8.A.1 (transition `status='active'/'trialing'` non encore propagee). Le teaser n'est alors pas affiche -- l'utilisateur ne voit "rien" plutot que "Mon parrainage avec code vide". Delta typique : secondes. Le teaser apparait au prochain refresh apres reception du webhook.
- **Zero impact sur path accompagnant Epic 2** : `app/accompagnant/dashboard/page.tsx:469-492` non touche (regle AC7 respectee). Le teaser accompagnant historique reste sur `rounded-xl` et utilise `validation_status === 'valide'` comme garde. Alignement cosmetique cross-roles defer story 8.C.X ou epic 9.
- **Pas de nouvel import requis** : `Link` deja importe (`app/accompagne/dashboard/page.tsx:3`). Pas de nouveau composant cree (pattern miroir inline du path accompagnant). Pas de cast `as` introduit (`check:as-any-global` OK).
- **Pas de nouvelle entree DECISIONS.md** : decisions UI consignees dans AC3/AC5/AC7/AC15 + Change Log, pas de decision architecturale nouvelle requise.
- **T5 validation staging defer Sylvain** : pas de seed accompagne+abo+code local possible (heritage `feedback_test_local_supabase`), validation reelle sur 1 des 3 accompagnes prod post-merge. Audit MCP suggere : `SELECT u.id, u.email, s.status, pc.code, pc.compteur_confirmes FROM users u LEFT JOIN subscriptions s ON s.user_id = u.id LEFT JOIN parrainages_codes pc ON pc.user_id = u.id WHERE u.role = 'accompagne'` pour identifier les profils elegibles.

### File List

**Modifies (1) :**
- `app/accompagne/dashboard/page.tsx` (+30 lignes nettes : lookup conditionnel `parrainages_codes` apres ligne 28 + carte teaser JSX conditionnelle inseree dans la section "Mon espace")

**Documentation (3) :**
- `_bmad-output/implementation-artifacts/deferred-work.md` (+5 lignes : nouvelle section "Deferred from: implementation of 8-b-2-..." avec 1 entree defer alignement teaser accompagnant `rounded-xl` -> `rounded-2xl`)
- `_bmad-output/implementation-artifacts/sprint-status.yaml` (status `ready-for-dev` -> `in-progress` -> `review`)
- `_bmad-output/implementation-artifacts/8-b-2-teaser-dashboard-accompagne-invitez-accompagnant.md` (Tasks coches T1+T2+T3+T4, T5 staging Sylvain pending, Dev Agent Record + File List + Change Log + DoD a11y renseignes, status `ready-for-dev` -> `in-progress` -> `review`)

### Change Log

| Date       | Type     | Description |
|------------|----------|-------------|
| 2026-05-17 | story    | Story 8.B.2 cree ready-for-dev via bmad-create-story workflow. Decisions arbitrees consignees dans AC : (a) positionnement teaser en 4eme carte de la section "Mon espace" (entre Favoris et Abonnement), (b) pas de `role="progressbar"` sur la mini-barre 5 segments (decoratif, valeur deja annoncee par texte adjacent), (c) pas de touche au teaser accompagnant historique (alignement `rounded-xl` -> `rounded-2xl` defer 8.C.X), (d) lookup `parrainages_codes` conditionnel `if (subscribed)` (economie round-trip BDD + coherence pattern accompagnant). Pas de nouveau composant cree, pas de migration BDD, pas de modification backend. |
| 2026-05-17 | dev      | Story 8.B.2 livree status review via bmad-dev-story. Implementation : 1 fichier source modifie `app/accompagne/dashboard/page.tsx` (+30L nettes : lookup conditionnel `parrainages_codes` apres ligne 28 + carte teaser JSX inseree entre "Mes favoris" et "Mon abonnement" dans la section "Mon espace"). Wording strict masculin neutre avec accents UTF-8 coherent path accompagnant ("confirmés", "à"). `rounded-2xl` aligne design system foyer accompagne. `aria-hidden="true"` conserve sur mini-barre 5 segments (decision AC5). T5 staging defer Sylvain post-merge. DoD CI complete : tsc 0 erreur fichiers modifies (6 `.next/types/` tolerees), lint 194 warnings baseline maintenue, lint:a11y-check 155 baseline preserve, 5/5 check:* verts (rls-helpers skip local legitime), test:unit 82/82, a11y:axe:check 0 delta sur 8 parcours, build OK route listee. 1 entree defer ajoutee dans deferred-work.md (alignement teaser accompagnant `rounded-xl` -> `rounded-2xl`). |

### Review Findings

- [x] [Review][Defer] Barre de progression vide aux multiples exacts de 5 (`compteur % 5 === 0`) [`app/accompagne/dashboard/page.tsx:323`] — deferred, pre-existing : même logique `i < (parrainageCompteur % 5)` dans `app/accompagnant/dashboard/page.tsx:484` (Epic 2 en prod). Fix nécessite une décision UX sur le rendu au palier exact (barre pleine vs vide + signal récompense).
- [x] [Review][Defer] Compteur brut `{parrainageCompteur} / 5` affiché au-delà de 5 (ex. `7 / 5`) [`app/accompagne/dashboard/page.tsx:316`] — deferred, pre-existing : idem `app/accompagnant/dashboard/page.tsx:477`. Corriger implique d'afficher `parrainageCompteur % 5` au numérateur — à trancher avec le comportement voulu pour les cycles multiples (Epic 9 ou story dédiée UX parrainage multi-cycles).
- [x] [Review][Defer] `parrainageTotalRecompenses > 0` avec `compteur === 0` affiche "0 / 5 confirmés" au lieu de l'état zéro [`app/accompagne/dashboard/page.tsx:315`] — deferred, pre-existing : idem accompagnant. Ce cas survient quand le cron remet `compteur_confirmes` à 0 après une récompense. La variable `total_recompenses` sert de switch booléen sans apparaître dans l'UI. À aligner avec la décision cycle multi-paliers ci-dessus.

## DoD a11y

A renseigner pour cette story avec impact UI (ajout d'une carte conditionnelle au dashboard accompagne) :

- [x] Labels associes aux champs (`htmlFor` ou `aria-labelledby`) -- N/A pour cette story (aucun champ formulaire, uniquement un `<Link>` avec contenu textuel)
- [x] Erreurs liees aux champs via `aria-describedby` + `aria-invalid` -- N/A
- [x] Focus visible sur tous les elements interactifs (contraste >= 3:1) -- token focus global heritage 2.5.3 applique au `<Link>` (pas d'override `outline-none` sans equivalent ring)
- [x] Contrastes texte >= 4,5:1 et UI >= 3:1 -- heritage tokens design system foyer (`text-gray-600`/`text-gray-500`/`text-gray-900` sur `bg-white` deja valides Lot A baseline)
- [x] ARIA states corrects sur composants dynamiques (`aria-expanded`, `aria-selected`, etc.) -- mini-barre `aria-hidden="true"` (decoratif, valeur annoncee par texte adjacent "X / 5 parrainages confirmés." -- decision AC5)
- [x] Navigation clavier complete (Tab, Enter, Escape, fleches selon pattern) -- Tab atteint le `<Link>` dans l'ordre logique (apres Favoris, avant Abonnement), Enter active la navigation vers `/accompagne/parrainage`, pas de modal donc pas d'Escape
- [ ] Verification ponctuelle au lecteur d'ecran (VoiceOver ou NVDA) sur le composant touche -- **reportee T5 staging Sylvain** (pas de session reelle accompagne+abo+code en local, heritage `feedback_test_local_supabase`)
- [x] Pas de regression `eslint-plugin-jsx-a11y` (`npm run lint:a11y-check` vert en CI) -- baseline 155 (file, rule) pairs **preserve**, delta = 0 (fichier `app/accompagne/dashboard/page.tsx` deja dans la baseline, pas de nouveau pattern a11y introduit). Output : `OK: 155 jsx-a11y violations across 56 (file, rule) pair(s). Baseline total: 155. No regression.`
- [x] Pas de regression axe-core (`npm run a11y:axe:check` vert ou delta documente avec justification dans la PR) -- baseline `axe-core-baseline-2026-05-17.json` 8 parcours **preserve**, aucun nouveau parcours requis (le dashboard n'est pas audite directement, cf. AC8). Output : `Parcours audites: 8 ; OK: aucun delta Critical/Serious au-dela du baseline.`
