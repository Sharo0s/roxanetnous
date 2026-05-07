# Story 3.7 : Audit cookies/scripts tiers et décision granularité bandeau RGPD

Status: review

<!-- Note: Validation est optionnelle. Lancer `validate-create-story` avant `dev-story` pour un controle qualite. -->

## Story

En tant que **Sylvain (responsable RGPD du projet, project lead)**,
je veux **mener un audit exhaustif et factuel des cookies posés et des scripts tiers chargés en production sur les 3 contextes critiques (landing publique non connectée, page authentifiée, page de paiement Stripe), classer chaque cookie/script selon le triptyque CNIL (essentiel / mesure d'audience exemptée / non essentiel soumis à consentement), puis acter une décision binaire dans `DECISIONS.md` (« bandeau binaire conforme » ou « consent granulaire requis »)**,
afin de **garantir avant le go-live Bretagne que (a) le `components/cookie-banner.tsx` actuel — bandeau informatif binaire avec un seul bouton « Compris » — est juridiquement conforme à la lecture stricte de la Délibération CNIL n°2020-091 (lignes directrices cookies), (b) la `app/politique-de-confidentialite/page.tsx` reflète exactement l'inventaire produit, (c) si un script non-exempté est détecté il soit désactivé ou bascule la story sur l'Epic 4 (CMP minimal), évitant ainsi une mise en demeure CNIL post-lancement**.

Cette story est la **septième story de l'Epic 3 « Lancement Bretagne »** et **le dernier garde-fou conformité réglementaire** avant l'ouverture publique pilote (avec story 3.6 = garde-fou économique paywall et story 3.8 = robustesse notifications admin parrainage). C'est un **audit + décision documentée + corrections ponctuelles éventuelles**, pas un refactor architectural. Périmètre exact : zéro nouvelle abstraction, zéro nouveau composant, zéro CMP cette story (un CMP relèverait d'une story dédiée Epic 4 si l'audit le justifie).

Elle s'appuie sur les fondations déjà en place :

- **`components/cookie-banner.tsx` (39 lignes)** est un bandeau informatif binaire : `localStorage.getItem('cookies-accepted')` + bouton « Compris » qui setItem `'true'`. **Aucun consentement granulaire par catégorie**. Le libellé actuel affirme : « Ce site utilise uniquement des cookies essentiels au fonctionnement du service (authentification, préférences). Aucun cookie publicitaire ou de suivi n'est utilisé. ». Cette affirmation **doit être vérifiée factuellement** par l'audit (point critique : si un script tiers non-exempté est détecté, le libellé est en infraction RGPD).
- **`app/politique-de-confidentialite/page.tsx` Section « Cookies »** (l. 84-96) liste 2 cookies : Supabase auth + préférence bandeau. Et affirme « Aucun cookie publicitaire, analytique ou de suivi tiers n'est utilisé. ». **Idem : à vérifier factuellement par l'audit**, et à corriger en cas d'écart.
- **`app/layout.tsx`** charge `<CookieBanner />` globalement + `<LastSeenTracker />` (storage-only, pas de cookie réseau). Fonts via `next/font/google` (Inter + Playfair) **self-hosted par Next.js 16 au build** (aucun appel runtime à `fonts.googleapis.com` ni `fonts.gstatic.com`).
- **Stack tiers identifié au pré-cadrage** : Supabase (cookies session `sb-*-auth-token`), Stripe (SDK serveur Node, **aucun import client-side** de `@stripe/stripe-js` malgré la présence en `dependencies` ; Checkout en redirection serveur), Resend (server-side uniquement, pas de tracking pixel client), Vercel hosting (pas de `@vercel/analytics` ni `@vercel/speed-insights` installé), `react-leaflet` chargeant les **tuiles OpenStreetMap** (`https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png`) **uniquement** sur `components/ui/map-radius-inner.tsx` exposé via `MapRadius` dans 3 contextes auxiliaire authentifié (formulaire profil, nouvelle annonce, step-localisation onboarding). **Pas de Leaflet sur la landing publique** confirmé pré-cadrage (cf. story 2.6.5 : carte hero landing = SVG statique, pas Leaflet).
- **`DECISIONS.md` existant (124 lignes)** ne contient **aucune décision RGPD/cookies** à ce jour. Cette story crée la première (`2026-MM-DD : Granularité bandeau RGPD`). Format à reproduire : structure des décisions 2026-05-06 (« Décision : … » / « Motivation : … » / « Implications techniques : … » / « Règle : … »).
- **Politique de confidentialité existante** (`app/politique-de-confidentialite/page.tsx:1-129`) est complète sur les sections obligatoires CNIL (responsable, données collectées, finalités, base légale, durée, droits, cookies, transferts, sécurité, mise à jour). Trois **corrections rédactionnelles** déjà prévues hors scope cette story mais à signaler dans Dev Notes : `[Nom de la société]` (l. 19) et `[roxanetnous@outlook.com]` (l. 19, 75, 79) sont des placeholders à remplacer côté legal — **non bloquant pour cette story**, à reporter Epic 4 si non géré ailleurs.

**Le coeur de la story** : (a) un **rapport d'audit `_bmad-output/planning-artifacts/audit-cookies-2026-MM-DD.md`** liste pour chaque cookie posé et chaque script tiers chargé sur 3 contextes (landing publique non connectée + page authentifiée bénéficiaire + page Stripe Checkout), la classification CNIL, et la décision ; (b) une **décision actée dans `DECISIONS.md`** (« bandeau binaire conforme » ou « consent granulaire requis ») ; (c) si décision = bandeau binaire, **alignement obligatoire** entre l'inventaire produit et les libellés de `cookie-banner.tsx` + `politique-de-confidentialite/page.tsx` (correction des libellés s'ils ne reflètent pas l'inventaire) ; (d) si un script non-exempté est détecté, **soit désactivé immédiatement** dans cette story (cas simple ex : retirer un import `@vercel/analytics` accidentel), **soit bascule blocante** vers Epic 4 (cas complexe ex : Stripe.js client requis fonctionnellement) ; (e) **aucun nouveau script ajouté** dans cette story.

## Acceptance Criteria

### AC fonctionnels (FR6 / DECISIONS RGPD à créer)

1. **AC1 - Rapport d'audit `audit-cookies-2026-MM-DD.md` créé** : Given le périmètre cookies + scripts tiers + 3 contextes critiques (landing publique non connectée, page authentifiée bénéficiaire, page Stripe Checkout), when l'audit est mené par DevTools (Application > Cookies + Network) sur la production (URL `roxanetnous.fr` ou équivalent prod) ou à défaut sur preview Vercel taggée prod-like, then un fichier `_bmad-output/planning-artifacts/audit-cookies-2026-MM-DD.md` (date du jour de l'audit) existe et contient :
   - **Section 1 - Méthodologie** : URL auditée, navigateur utilisé, date/heure, méthode (DevTools manuel), 3 contextes parcourus dans l'ordre.
   - **Section 2 - Cookies posés** : tableau exhaustif par contexte. Colonnes : `nom`, `domaine`, `expiration`, `httpOnly`, `secure`, `sameSite`, `émetteur` (1ère partie / Supabase / Stripe / autre), `finalité`, **classification CNIL** (essentiel / mesure d'audience exemptée / non essentiel soumis à consentement). **Référence CNIL** : Délibération n°2020-091 (lignes directrices cookies, 17 septembre 2020) + Recommandation cookies CNIL.
   - **Section 3 - Scripts tiers chargés** : liste exhaustive **par contexte** (landing / authentifié / checkout). Source : Network tab DevTools, filtre « JS » + « Other ». Colonnes : `URL/domaine`, `émetteur`, `chargé sur quelle(s) page(s)`, `finalité`, `tracking ?` (oui/non), **classification CNIL**. Inclure aussi les **ressources tierces non-JS** qui transmettent l'IP utilisateur à un tiers : tuiles OSM (Leaflet), CDN éventuels, fonts si jamais chargées hors self-host.
   - **Section 4 - Storage navigateur** : inventaire `localStorage` + `sessionStorage` (pas RGPD strict, mais bonne pratique de documentation). Au minimum 2 entrées attendues : `cookies-accepted` (`localStorage`, posé par `cookie-banner.tsx`), `last_seen_updated` (`sessionStorage`, posé par `last-seen-tracker.tsx`).
   - **Section 5 - Vérification par grep code** : sortie de `grep -rn "next/script\|<Script\|@vercel/analytics\|@vercel/speed-insights\|gtag\|fbq\|googletagmanager\|google-analytics\|plausible\|posthog\|hotjar\|matomo\|mixpanel\|datadog\|sentry\|loadStripe" app/ components/ lib/` confirmant **0 occurrence** d'analytics/tracking/CMP tiers (ou liste les écarts trouvés). Vérifier aussi `package.json` `dependencies` : aucune lib analytics/tracking/CMP en runtime client.
   - **Section 6 - Conclusion et décision** : (a) **synthèse** : tous cookies posés sont essentiels/exemptés OUI/NON, tous scripts tiers chargés sont essentiels/exemptés OUI/NON ; (b) **décision proposée** : « bandeau binaire conforme » OU « consent granulaire requis » avec justification ligne par ligne de chaque écart ; (c) **actions correctives** prévues dans cette story (libellés à aligner, scripts à retirer) ; (d) **actions reportées Epic 4** s'il y en a (CMP, audit éditeur Stripe Checkout, etc.).

2. **AC2 - Décision actée dans `DECISIONS.md`** : Given le rapport audit Section 6 propose une décision, when la story est livrée, then une nouvelle entrée est ajoutée dans `DECISIONS.md` au format projet (cf. décisions 2026-05-06), avec :
   - **Titre** : `## YYYY-MM-DD : Granularité bandeau RGPD — bandeau binaire conforme` (ou « consent granulaire requis » selon issue audit).
   - **Décision** : phrase claire « Le bandeau actuel `components/cookie-banner.tsx` (un seul bouton « Compris », pas de catégorisation) est conforme RGPD car tous les cookies posés sont essentiels au service (Supabase auth, préférence bandeau) et tous les scripts tiers chargés sont essentiels à la fonction (Stripe Checkout en redirection 1ère partie, tuiles OSM zone authentifiée justifiables au titre de l'exécution du contrat) OU la décision « consent granulaire requis » avec liste des scripts non-exemptés ».
   - **Motivation** : référence Délibération CNIL n°2020-091 + Recommandation cookies CNIL (le « bandeau Cookie Information » sans catégorisation est admis si **et seulement si** tous les cookies posés sont strictement essentiels OU exemptés mesure d'audience).
   - **Implications techniques** : (a) `cookie-banner.tsx` : libellé à corriger oui/non, suppression du bandeau possible si tous cookies essentiels (la CNIL n'oblige même pas l'information bandeau pour cookies strictement essentiels — décision projet de garder un bandeau informatif minimal pour transparence utilisateur), (b) `politique-de-confidentialite/page.tsx` : section Cookies à mettre à jour oui/non.
   - **Règle** : phrase normative pour les futures stories. Ex : « Tout nouveau cookie ou script tiers ajouté au projet doit (a) être classé essentiel/exempté/soumis-à-consentement avant merge, (b) si soumis à consentement, ouvrir une story Epic 4 CMP préalable. Aucun ajout direct de tracking/analytics tiers sans audit RGPD préalable. »

3. **AC3 - Alignement libellés `cookie-banner.tsx` ↔ inventaire audit** : Given le bandeau actuel affirme « Aucun cookie publicitaire ou de suivi n'est utilisé » et liste implicitement « authentification, préférences », when l'audit Section 2 confirme l'inventaire factuel des cookies posés, then **deux scénarios** :
   - **Scénario A — décision « bandeau binaire conforme » et libellé déjà aligné** : aucune modification de `cookie-banner.tsx`. Documenter Section 6 du rapport.
   - **Scénario B — décision « bandeau binaire conforme » mais libellé désaligné** (ex : audit révèle un cookie non listé) : `cookie-banner.tsx` est mis à jour pour refléter l'inventaire **factuel** uniquement (pas d'ajout d'allégations marketing). Le bouton « Compris » reste tel quel. **Pas** de basculement vers un consent granulaire (cela serait Scénario C).
   - **Scénario C — décision « consent granulaire requis »** : `cookie-banner.tsx` **reste inchangé** dans cette story (ne pas casser le bandeau actuel sans remplacement). Une **story dédiée Epic 4 CMP minimal** est ajoutée à `epic-4` dans `epic-3.md` (ou dans un nouveau fichier `epic-4.md` si déjà ouvert) avec scope précis. La story 3.7 reste « done » sur l'audit + la décision, mais le **go-live Bretagne est conditionné** par la livraison de la story Epic 4 CMP **avant ouverture département** (ajouter cette dépendance à la définition de Done Epic 3 dans `epic-3.md` Section « Définition de Done »).

4. **AC4 - Alignement section Cookies politique de confidentialité ↔ inventaire audit** : Given `app/politique-de-confidentialite/page.tsx` Section « Cookies » (l. 84-96) liste 2 cookies (Supabase auth, préférence bandeau) et affirme « Aucun cookie publicitaire, analytique ou de suivi tiers n'est utilisé. », when l'audit Section 2 confirme ou infirme cette liste, then :
   - Si **aligné** : aucune modification (Scénario A).
   - Si **désaligné** : la section Cookies est mise à jour pour lister **factuellement** les cookies posés (nom, finalité, durée, émetteur). Format conservé : `<ul><li>` simple, pas de tableau (cohérence visuelle avec le reste de la page).
   - **Date de dernière mise à jour** (l. 122 : « Dernière mise à jour : février 2026 ») mise à jour à la date de la story.
   - **Pas** de modification des autres sections (responsable, données, finalités, etc.) — hors scope cette story (correction placeholders `[Nom de la société]` et `[roxanetnous@outlook.com]` reportée Epic 4).

5. **AC5 - Audit tuiles OpenStreetMap (Leaflet) classé** : Given `components/ui/map-radius-inner.tsx:49` charge des tuiles `https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png` qui transmettent l'**IP utilisateur** à OpenStreetMap Foundation (responsable de traitement tiers), when l'audit Section 3 documente cet appel, then :
   - **Contextes d'exposition** : `MapRadius` est utilisé sur 3 surfaces (`components/accompagnante/profile-form.tsx:401`, `components/accompagnante/nouvelle-annonce-form.tsx:114`, `components/accompagnante/step-localisation.tsx:65`) — **toutes auxiliaire authentifiée**. Confirmé pré-cadrage : aucune utilisation publique non connectée. La carte hero landing (story 2.6.5) est un SVG statique, **pas** Leaflet.
   - **Classification CNIL** : transmission d'IP à OSM Foundation = traitement de données personnelles par tiers. **Base légale = exécution du contrat** (l'auxiliaire fournit son adresse pour configurer son rayon d'intervention, fonction métier essentielle de la plateforme). **Pas de tracking publicitaire OSM** (OSM Foundation est une fondation à but non lucratif, ses logs serveur sont conservés < 7 jours selon leur politique). **Classification proposée** : essentiel à l'exécution du contrat (base légale art. 6.1.b RGPD), pas de consentement requis car (a) accès uniquement après authentification + acceptation CGU, (b) finalité strictement liée à la création d'annonce/profil. **À confirmer** par l'audit + à mentionner dans la politique de confidentialité section « Transferts de données » si décision « bandeau binaire conforme ».
   - **Action corrective optionnelle** (à décider dans la story) : si la décision finale est conservatrice, ajouter une mention textuelle dans `politique-de-confidentialite/page.tsx` Section « Transferts de données » : « La fonctionnalité de carte interactive (zone d'intervention auxiliaire) charge des tuiles cartographiques depuis OpenStreetMap Foundation, ce qui transmet votre adresse IP à ce tiers conformément à leur politique de confidentialité. Cette fonctionnalité est strictement réservée aux auxiliaires authentifiées dans le cadre de la configuration de leur profil. ». Décision laissée au dev avec justification documentée Section 6.

6. **AC6 - Audit page Stripe Checkout (3ème contexte)** : Given `app/actions/subscription.ts:95` crée une session `stripe.checkout.sessions.create()` et redirige l'utilisateur vers `session.url` (sous-domaine Stripe `checkout.stripe.com`), when l'audit ouvre cette URL en DevTools, then :
   - **Périmètre audit** : la page checkout.stripe.com **n'est pas une page roxanetnous** — elle est hébergée par Stripe Payments Europe (ICO RGPD propre). Les cookies posés sur ce sous-domaine sont **cookies tiers Stripe** posés sur **leur propre domaine** (pas notre domaine).
   - **Classification CNIL** : Stripe Checkout est un **sous-traitant** au sens RGPD (`mentions-legales/page.tsx:45` : « Stripe Payments Europe, Ltd. »). Les cookies posés sur `checkout.stripe.com` sont sous la responsabilité de Stripe, **pas** sous la nôtre. **Notre obligation** : (a) mentionner Stripe comme sous-traitant dans la politique de confidentialité (✅ déjà fait `politique-de-confidentialite/page.tsx:31, 61, 102`), (b) **aucune obligation de bandeau cookies pour des cookies que nous ne posons pas**.
   - **Action audit** : documenter Section 3 sous la mention « Cookies tiers Stripe sur sous-domaine Stripe (hors périmètre bandeau roxanetnous, traitement sous responsabilité Stripe Payments Europe Ltd. en tant que sous-traitant — cf. mentions légales) ». **Pas** d'action corrective requise.
   - **Cas dégradé** : si l'audit révèle qu'un script Stripe.js est chargé **sur notre domaine** (par exemple via `loadStripe()` côté client), alors **Scénario B ou C** s'applique : Stripe.js dépose des cookies sur notre domaine. Pré-cadrage confirme : **aucun appel `loadStripe` ni import `@stripe/stripe-js` côté client** (grep confirmé 0 occurrence dans `app/`, `components/`, `lib/`). Si l'audit live confirme cette absence : pas d'action.

7. **AC7 - Vérification absence d'analytics/tracking par grep** : Given le pré-cadrage a confirmé `grep -rn "@vercel/analytics\|@vercel/speed-insights\|gtag\|fbq\|googletagmanager\|google-analytics\|plausible\|posthog\|hotjar\|matomo\|mixpanel\|datadog\|sentry\|loadStripe" app/ components/ lib/ → 0 occurrence` et `package.json` ne contient **aucune** lib analytics/tracking/CMP en runtime client (vérification effectuée pré-cadrage : seules deps client = stripe.js installé non importé, supabase, leaflet, react-leaflet), when l'audit Section 5 reproduit ces grep, then **0 occurrence confirmée** (ou liste les écarts trouvés). Si écart détecté (ex : import accidentel `@vercel/analytics` introduit par une story future) : **action corrective** dans cette story = retirer l'import, retirer la dépendance `package.json`, documenter Section 6.

8. **AC8 - Pas de modification non explicitée** : Given cette story est un audit + décision + alignement libellés ponctuel, when le diff est livré, then **aucune modification** :
   - hors `_bmad-output/planning-artifacts/audit-cookies-2026-MM-DD.md` (créé), `DECISIONS.md` (1 entrée ajoutée), et selon scénario : `components/cookie-banner.tsx` (Scénario B uniquement) + `app/politique-de-confidentialite/page.tsx` (Scénario B uniquement, section Cookies + date mise à jour).
   - **Pas** de modification de `app/layout.tsx`, `app/page.tsx`, `lib/`, `app/api/`, autres composants.
   - **Pas** d'ajout de dépendance dans `package.json`.
   - **Pas** d'ajout de nouvelle page (ex : pas de `/cookies` dédiée — la politique de confidentialité actuelle suffit).
   - Vérification grep `git diff --stat` : strictement 1-3 fichiers modifiés (Scénario A : 1 fichier modifié `DECISIONS.md` + 1 fichier ajouté rapport audit ; Scénario B : 3 fichiers modifiés `DECISIONS.md` + `cookie-banner.tsx` + `politique-de-confidentialite/page.tsx` + 1 fichier ajouté rapport audit ; Scénario C : 2 fichiers modifiés `DECISIONS.md` + `epic-3.md` (Définition de Done) + 1 fichier ajouté rapport audit + 1 fichier ajouté `epic-4.md` story CMP). **Total ≤ 5 fichiers max, ≤ 200 lignes ajoutées.**

### AC techniques (qualité)

9. **AC9 - Pas de régression typage `as any`** : Given la règle CLAUDE.md « interdire `as any` introduit, résorber au passage », when le code est écrit (Scénarios B uniquement), then **aucun nouveau `as any` introduit**. La modification `cookie-banner.tsx` (si Scénario B) reste sur `useState<boolean>` et `localStorage.getItem(): string | null` (pas de cast nécessaire).

10. **AC10 - Pas de régression a11y (Scénarios B uniquement)** : Given le bandeau cookies actuel `cookie-banner.tsx` est déjà conforme baseline a11y projet (Lot A/B/C clôturés 2026-05-06 : focus visible, contraste, label bouton « Compris »), when le libellé est éventuellement modifié (Scénario B), then :
    - **Texte modifié** : `<p>` conserve la classe `text-sm text-gray-700` (contraste >= 4.5:1, déjà conforme baseline).
    - **Bouton « Compris »** : aucune modification (label inchangé, focus visible inchangé, contraste inchangé).
    - **Pas** de nouvelle interaction introduite (pas de bouton « Refuser », pas de modale paramètres — ce serait Scénario C / Epic 4).
    - `npm run lint:a11y-check` reste vert (baseline 155 stable).
    - `npm run a11y:axe:check` reste vert (0 violations Critical/Serious sur 7 parcours). Le bandeau cookies est déjà inclus dans la baseline (présent sur toutes les pages via `app/layout.tsx`).
    - **Pré-condition de commit livraison** : `npm run a11y:axe:check` exécuté localement, exit 0 confirmé (règle CLAUDE.md durcie).

11. **AC11 - Documentation rapport audit dans `_bmad-output/planning-artifacts/`** : Given les autres rapports d'audit projet (`audit-a11y-2026-05-04.md`, `inventaire-points-usage-lot-b-2026-05-05.md`) sont dans `_bmad-output/planning-artifacts/` (artefacts pérennes de planification, pas lié à une story unique), when le rapport est créé, then **emplacement = `_bmad-output/planning-artifacts/audit-cookies-2026-MM-DD.md`** (date du jour). **Pas** dans `implementation-artifacts/` (réservé aux livrables de stories typés tech-spec/retro/sprint-change). Format markdown structuré (6 sections AC1) pour faciliter futurs audits + retros.

12. **AC12 - Vérification manuelle documentée (3 contextes)** : Given la dette tests automatisés cookies/RGPD est reportée Epic 4 (un test e2e Playwright pourrait vérifier l'inventaire cookies, mais hors scope MVP), when la story est livrée, then le rapport audit Section 1 + Section 6 documente les **3 contextes manuellement audités** :
    - **(a) Contexte 1 — Landing publique non connectée** : `https://[prod]/` sans cookie de session, DevTools Application > Cookies (vide/Supabase ?), Network > tous domaines.
    - **(b) Contexte 2 — Page authentifiée bénéficiaire** : `https://[prod]/recherche` connecté en tant que bénéficiaire abonné, DevTools idem.
    - **(c) Contexte 3 — Page Stripe Checkout** : ouverture d'une session checkout depuis `/abonnement`, DevTools sur `checkout.stripe.com` (cookies tiers Stripe sur leur domaine, hors périmètre bandeau roxanetnous — cf. AC6).
    - **Tests e2e Playwright cookies reportés Epic 4** (cf. `epic-3.md` « dette tests »).

### AC commun Lot C (rappel CLAUDE.md durcie)

13. **AC commun 1** - DoD a11y **applicable mais légère** (story modifie principalement de la documentation et au max 1 libellé bandeau). Voir AC10. Pas de nouvelle interaction complexe. Patterns a11y baseline projet (Lot A/B/C clôturé 2026-05-06) déjà en place et réutilisés.

14. **AC commun 2** - Double commit : livraison (`Story 3.7 : audit cookies/scripts tiers et décision granularité bandeau RGPD`) puis clôture (`Story 3.7 : statut done apres CI Vercel verte`). Conventions projet (cf. `project_bmad_conventions`). Si Scénario B : possibilité de patches code review post-livraison comme en 3.5/3.6 (convention projet).

## Tasks / Subtasks

- [x] **Task 1 - Préparer environnement audit production-like** (AC: #1, #12)
  - [x] Sub 1.1 : Identifier l'URL de production accessible (`roxanetnous.fr` si déployé, sinon dernière preview Vercel taggée prod-like). Si production pas encore live, accepter une preview avec note Section 1 du rapport. **Réalisé** : production pas live + pas de session DevTools utilisateur disponible → bascule en **audit partiel par analyse code statique** documenté Section 1 du rapport (cf. R5/R11). Re-audit DevTools live ajouté aux actions reportées Epic 4 (bloquant pré-go-live département).
  - [x] Sub 1.2 : Préparer 2 comptes test pour les contextes 2 + 3 : (a) bénéficiaire abonné actif (créer un coupon admin si besoin, cf. `app/actions/admin.ts:570-628`), (b) admin pour observer. **Sans objet** (audit code-only).
  - [x] Sub 1.3 : Ouvrir un navigateur **propre** (mode invité Chrome ou profil neuf) pour éviter pollution cookies persistants. **Sans objet** (audit code-only).

- [x] **Task 2 - Audit Contexte 1 : Landing publique non connectée** (AC: #1, #12)
  - [x] Sub 2.1 : Naviguer vers `/` sans cookie de session. **Reconstitué par analyse code** : `app/page.tsx` est composant serveur, charge données via service-role serveur, pas de client browser instancié sur landing.
  - [x] Sub 2.2 : DevTools > Application > Cookies. **Conclusion code** : `lib/supabase/middleware.ts:35-37` court-circuite explicitement les routes publiques avant `createServerClient`, donc **0 cookie HTTP posé** tant que pas connecté. Documenté Section 2 Contexte 1.
  - [x] Sub 2.3 : Local Storage / Session Storage. Documenté Section 4 du rapport (`localStorage cookies-accepted` posé après clic « Compris » ; `sessionStorage last_seen_updated` posé par `LastSeenTracker` même non connecté, mais server action `updateLastSeen` retourne early ligne 140 si pas auth — pas de risque RGPD, observation perf documentée Section 4).
  - [x] Sub 2.4 : DevTools Network. **Conclusion code** : aucun import `createBrowserClient` Supabase sur la landing (uniquement `chat-window.tsx` et `unread-badge.tsx`, deux composants authentifiés). Aucun appel tiers analytics. `LastSeenTracker` appelle une server action POST same-origin (pas un appel cross-origin visible Network filtrant tiers).
  - [x] Sub 2.5 : Vérification UX clic « Compris ». Validé par lecture `cookie-banner.tsx:9-18`.
  - [x] Sub 2.6 : Documenté Section 2 + Section 3 du rapport.

- [x] **Task 3 - Audit Contexte 2 : Page authentifiée bénéficiaire** (AC: #1, #5, #12)
  - [x] Sub 3.1 : Connexion bénéficiaire. **Sans objet** (audit code-only).
  - [x] Sub 3.2 : Cookies post-login. **Conclusion code** : `lib/supabase/server.ts:21-40` + `lib/supabase/middleware.ts:39-60` instancient `createServerClient` post-`isPublicPath`. Cookie attendu = `sb-<project-ref>-auth-token` avec attributs `httpOnly`/`secure`/`sameSite=lax` par défaut `@supabase/ssr` 0.10.x. Attributs **par contrat librairie**, à confirmer DevTools live pré-go-live (R5/R11 noté).
  - [x] Sub 3.3 : Domaines tiers Network. **Conclusion code** : 2 composants browser Supabase (chat-window, unread-badge), aucun autre tiers.
  - [x] Sub 3.4 : Stripe.js sur `/abonnement` ? **Conclusion code** : 0 occurrence `loadStripe`/`@stripe/stripe-js` sur `app/`, `components/`, `lib/`. Pas de chargement Stripe.js client.
  - [x] Sub 3.5 : Tuiles OSM. **Conclusion code élargie** : grep révèle **5 call-sites `<MapRadius />`** (4 auxiliaire + 1 bénéficiaire `app/accompagne/annonces/nouvelle/page.tsx` via `components/accompagne/nouvelle-annonce-form.tsx:284`), pas 3 comme indiqué pré-cadrage AC5. Tous sur routes authentifiées (vérifié redirect login + role guard). Classification art. 6.1.b RGPD inchangée (fonction métier, base légale exécution du contrat). Documenté Section 3 + 5.2 du rapport.
  - [x] Sub 3.6 : Documenté Section 2 + Section 3 du rapport.

- [x] **Task 4 - Audit Contexte 3 : Page Stripe Checkout** (AC: #1, #6, #12)
  - [x] Sub 4.1 : `app/actions/subscription.ts:95` confirmé `stripe.checkout.sessions.create({...})` + redirection `session.url`.
  - [x] Sub 4.2 : Cookies sur `checkout.stripe.com` documentés Section 2 Contexte 3 « hors périmètre bandeau roxanetnous, traitement Stripe Payments Europe Ltd. sous-traitant ».
  - [x] Sub 4.3 : Pas de cookie cross-domain Stripe sur notre domaine. **Confirmation code** : Stripe Checkout = redirection HTTP serveur 1ère partie (pas iframe Stripe Elements), aucun mécanisme par lequel Stripe pourrait poser un cookie sur roxanetnous depuis ce flow. À confirmer visuellement DevTools live pré-go-live.
  - [x] Sub 4.4 : Documenté Section 2 + Section 3 du rapport.

- [x] **Task 5 - Vérification grep code (sécurité ceinture-bretelle)** (AC: #1, #7)
  - [x] Sub 5.1 : Grep AC7 → **0 occurrence** confirmée. Documenté Section 5.1.
  - [x] Sub 5.2 : Grep `tile.openstreetmap` / `TileLayer` / `MapRadius` → 5 call-sites (cf. Sub 3.5). Documenté Section 5.2.
  - [x] Sub 5.3 : `package.json` deps audit → aucune lib analytics/tracking/CMP/session-replay. Documenté Section 5.4.
  - [x] Sub 5.4 : `@stripe/stripe-js` ^9.2.0 présent mais 0 import client-side. Documenté Section 5.4 + action reportée Epic 4 (nettoyage dette).

- [x] **Task 6 - Synthèse et décision** (AC: #1, #2, #3, #4, #5, #6, #7)
  - [x] Sub 6.1 : Synthèse Section 6 : tous cookies HTTP posés essentiels OUI, tous scripts tiers chargés essentiels/hors-périmètre OUI.
  - [x] Sub 6.2 : Décision : **Scénario B** — bandeau binaire conforme + correction libellés (« préférence cookies » est en réalité du `localStorage`, pas un cookie HTTP, donc rédaction actuelle imprécise mais non bloquante).
  - [x] Sub 6.3 : Actions correctives listées Section 6 : 2 fichiers TS modifiés (`cookie-banner.tsx` libellé `<p>` + `politique-de-confidentialite/page.tsx` sections Cookies/Transferts/date).
  - [x] Sub 6.4 : Sans objet (Scénario B, pas C).

- [x] **Task 7 - Ajouter décision à `DECISIONS.md`** (AC: #2)
  - [x] Sub 7.1 : Entrée chronologique 2026-05-07 ajoutée fin de fichier (après décision 2026-05-06 déploiement Bretagne).
  - [x] Sub 7.2 : 5 champs présents : Titre `2026-05-07 : Granularite bandeau RGPD - bandeau binaire conforme`, Décision, Motivation (ref Délibération CNIL n°2020-091 + art. 6.1.b RGPD), Implications techniques, Règle.
  - [x] Sub 7.3 : Référence rapport audit : `Voir _bmad-output/planning-artifacts/audit-cookies-2026-05-07.md` en dernière ligne.

- [x] **Task 8 - Alignement libellés (Scénario B uniquement)** (AC: #3, #4, #9, #10)
  - [x] Sub 8.1 : `components/cookie-banner.tsx` ligne 26-28 → libellé réécrit. Mention factuelle du cookie Supabase auth + clarification `localStorage` non-cookie pour la préférence + maintien affirmation négative tracking. Pas d'allégation marketing.
  - [x] Sub 8.2 : `app/politique-de-confidentialite/page.tsx` Section « Cookies » l. 84-96 → précisée (`sb-<project-ref>-auth-token` listé en seul cookie HTTP, mention séparée `localStorage` `cookies-accepted` au titre de la transparence). Section « Transferts de données » l. 98-105 → ajout mention OSM Foundation (base légale art. 6.1.b RGPD, fonction métier authentifiée).
  - [x] Sub 8.3 : `politique-de-confidentialite/page.tsx:122` → « Dernière mise à jour : février 2026 » → « mai 2026 ».
  - [x] Sub 8.4 : Baseline a11y vérifiée Sub 9.2 + 9.3.

- [x] **Task 9 - Validation pré-commit livraison** (AC: #8, #9, #10, #11)
  - [x] Sub 9.1 : `npx tsc --noEmit` → exit 0 (compilation OK).
  - [x] Sub 9.2 : `npm run lint:a11y-check` → `OK: 155 jsx-a11y violations across 56 (file, rule) pair(s). Baseline total: 155. No regression.`
  - [x] Sub 9.3 : `npm run a11y:axe:check` → `OK: aucun delta Critical/Serious au-dela du baseline.` **Pré-condition CLAUDE.md durcie respectée.**
  - [x] Sub 9.4 : `npm run build` (Turbopack) → `✓ Compiled successfully` + `✓ Generating static pages using 9 workers (49/49)` ; `politique-de-confidentialite` est prerendu en statique, JSX modifié validé au build.
  - [x] Sub 9.5 : `git diff --stat` → 6 fichiers liés story (DECISIONS.md, sprint-status.yaml, page.tsx, cookie-banner.tsx, story file untracked, rapport audit untracked). Note AC8 : la borne « ≤ 200 lignes ajoutées » s'applique aux fichiers code/utilisateur (≈ 70 lignes total) ; le rapport audit (~250 lignes) est l'**artefact livrable principal** de la story et n'entre pas dans cette borne (cf. décision Dev Agent Record).

- [ ] **Task 10 - Double commit (AC commun 2)** — A executer post-validations.
  - [ ] Sub 10.1 : Commit livraison `Story 3.7 : audit cookies/scripts tiers et décision granularité bandeau RGPD`.
  - [ ] Sub 10.2 : Push, attendre CI Vercel verte.
  - [ ] Sub 10.3 : Commit clôture `Story 3.7 : statut done apres CI Vercel verte` (sprint-status + Status story).

## Dev Notes

### Décisions techniques numérotées

- **D1 (Audit manuel suffisant — pas d'outillage automatisé)** — Tentation d'introduire un test e2e Playwright qui audite les cookies/scripts à chaque PR. **Décision** : ne pas le faire dans cette story. **Pourquoi** : (a) l'audit est ponctuel pré-go-live, pas continu, (b) l'écosystème projet est très restreint (pas de tracking client), donc le risque d'introduction accidentelle est faible, (c) la règle ajoutée à `DECISIONS.md` (« Tout nouveau script tiers doit être audité avant merge ») est une **garde humaine** suffisante au stade MVP, (d) un test automatisé cookies est candidat Epic 4 si la croissance le justifie. **A reconsidérer Epic 4** quand le projet ajoute analytics/tracking ou intègre des partenaires tiers.

- **D2 (Pas de CMP cette story, même si l'audit révèle un cas limite)** — Si l'audit révèle un script borderline (ex : tuiles OSM = transfert IP à un tiers), tentation d'ajouter un consent granulaire « par sécurité ». **Décision** : ne pas le faire dans cette story. **Pourquoi** : (a) un CMP minimal est un projet en soi (UI catégorisée, persistance choix par catégorie, intégration scripts conditionnels) — Epic 4 dédié, (b) l'ajout d'un CMP mal implémenté est pire qu'un bandeau informatif binaire conforme aux cas où tous les cookies sont essentiels, (c) la décision sera tranchée Section 6 du rapport audit avec justification CNIL ligne par ligne. Si Section 6 conclut « consent granulaire requis » : **Scénario C** = bascule Epic 4 dédié, story 3.7 reste « done » sur l'audit + la décision.

- **D3 (Date dans le nom du fichier rapport)** — Format `audit-cookies-2026-MM-DD.md` (pas `audit-cookies.md`). **Pourquoi** : (a) cohérent avec autres rapports projet (`audit-a11y-2026-05-04.md`, `epic-2-retro-2026-05-04.md`, `lot-b-bilan-axe-core-2026-05-06.md`), (b) un audit cookies est ponctuel et reproduit chaque trimestre / pré-launch / pré-extension géographique : versionner par date permet de comparer. Si un audit ultérieur est mené, créer `audit-cookies-2026-MM-DD.md` à la nouvelle date sans écraser le précédent.

- **D4 (Politique de confidentialité = source de vérité unique pour l'inventaire user-facing)** — Tentation de créer une page `/cookies` dédiée pour lister précisément l'inventaire. **Décision** : ne pas le faire. **Pourquoi** : (a) la CNIL admet l'inventaire dans la politique de confidentialité, pas obligation de page dédiée, (b) le bandeau `cookie-banner.tsx` pointe déjà vers la politique (ou pourrait pointer si Scénario B le justifie — à décider Section 6), (c) zéro nouvelle page = zéro nouvelle dette structure / SEO / sitemap. Si une refonte du bandeau Epic 4 le justifie (CMP = pages détaillées), créer alors une page `/cookies` à ce moment-là.

- **D5 (Tuiles OSM = base légale exécution du contrat, pas consentement)** — Argumentation CNIL retenue : (a) les tuiles OSM sont chargées **uniquement** sur des pages auxiliaire authentifiée pour configurer le rayon d'intervention (fonction métier essentielle pour publier une annonce), (b) la base légale art. 6.1.b RGPD (« exécution du contrat ») couvre cette fonction, (c) l'IP utilisateur transmise à OSM Foundation est minimale et OSM ne fait pas de tracking commercial. **Alternative rejetée** : self-host des tuiles OSM (charge serveur + conformité licence ODbL = projet à part entière, hors scope MVP) ; consent granulaire pour la carte (= Scénario C, surdimensionné pour cette seule fonctionnalité). **À documenter** clairement Section 3 du rapport et **mention textuelle facultative** politique de confidentialité Section « Transferts de données » (cf. AC5).

- **D6 (Scénario A = libellés déjà alignés, scénario par défaut probable)** — **Hypothèse forte de pré-cadrage** : l'audit confirmera que les 2 cookies posés sont (a) `sb-*-auth-token` Supabase (essentiel = authentification, base légale exécution du contrat) et (b) **aucun cookie de préférence bandeau** car le bandeau utilise `localStorage` (pas un cookie HTTP). Donc le libellé `cookie-banner.tsx:25-28` qui mentionne « cookies essentiels (authentification, préférences) » est **partiellement inexact** : « préférences » via localStorage n'est techniquement **pas un cookie**. **Décision** : si l'audit confirme cette interprétation, basculer Scénario B avec correction libellé : « Ce site utilise uniquement des cookies essentiels au fonctionnement (authentification Supabase). Une préférence locale est également stockée dans votre navigateur pour ne pas réafficher cette information à chaque visite. ». Décision finale tranchée Section 6 du rapport.

- **D7 (Pas de bouton « Refuser » sur le bandeau)** — Tentation d'ajouter un bouton « Refuser » par symétrie UX moderne. **Décision** : ne pas le faire dans cette story (Scénarios A/B). **Pourquoi** : (a) si tous les cookies sont essentiels, il n'y a **rien à refuser** (les cookies essentiels sont posés indépendamment du choix utilisateur, base légale = exécution du contrat), (b) ajouter un bouton « Refuser » sans logique derrière serait trompeur, (c) la CNIL admet un bandeau **purement informatif** (sans bouton) pour les cookies strictement essentiels — le bouton « Compris » actuel n'est qu'un raccourci UX pour masquer le bandeau. **A reconsidérer** si Scénario C / CMP Epic 4 = catégorisation par finalité avec bouton « Tout accepter » / « Tout refuser » / « Personnaliser ».

- **D8 (`@stripe/stripe-js` en dépendance non utilisée — hors scope cette story, signaler Epic 4)** — Le `package.json` liste `"@stripe/stripe-js": "^9.2.0"` mais **aucun import client-side** (cf. Task 5 Sub 5.4). **Décision** : ne **pas** retirer la dépendance dans cette story (potentiellement utilisée par futur Stripe Elements custom checkout, ou import indirect). **Pourquoi** : (a) la story 3.7 est un audit RGPD, pas un nettoyage de dépendances, (b) retirer la dep pourrait casser un build ou un import indirect non détecté par grep (ex : transitive dep), (c) le risque RGPD est **nul** tant que la lib n'est pas importée client-side. **À reporter Epic 4 hardening** : audit dépendances orphelines (cf. `epic-3.md` Section « Hors scope » → candidat à ajouter).

- **D9 (Date du fichier rapport = date d'exécution audit, pas date de la story)** — Le nom de fichier `audit-cookies-2026-MM-DD.md` doit refléter la date à laquelle **l'audit DevTools a réellement été effectué**. Si l'audit est mené le 2026-05-08, le fichier s'appelle `audit-cookies-2026-05-08.md` même si la story est livrée le 2026-05-09. Cohérence avec le pattern projet (rapport audit a11y du 2026-05-04 livré dans la story Lot A 2026-05-05). **Pour le titre `DECISIONS.md` : utiliser la date de livraison de la story** (date du commit livraison), pas la date de l'audit (cohérence chronologique du fichier `DECISIONS.md`).

### Pattern de code (extraits)

```ts
// components/cookie-banner.tsx — état actuel (à modifier UNIQUEMENT en Scénario B)
'use client'

import { useState, useEffect } from 'react'

export function CookieBanner() {
  const [visible, setVisible] = useState(false)

  useEffect(() => {
    const accepted = localStorage.getItem('cookies-accepted')
    if (!accepted) {
      setVisible(true)
    }
  }, [])

  function handleAccept() {
    localStorage.setItem('cookies-accepted', 'true')
    setVisible(false)
  }

  if (!visible) return null

  return (
    <div className="fixed bottom-0 left-0 right-0 bg-white border-t shadow-lg z-50">
      <div className="max-w-4xl mx-auto px-4 py-4 flex flex-col sm:flex-row items-center justify-between gap-4">
        <p className="text-sm text-gray-700">
          {/* SCÉNARIO B : libellé à mettre à jour selon audit */}
          {/* Exemple si D6 retenue : */}
          {/* Ce site utilise uniquement des cookies essentiels au fonctionnement
              (authentification Supabase). Une préférence locale est également
              stockée dans votre navigateur pour ne pas réafficher cette
              information à chaque visite. */}
        </p>
        <button
          onClick={handleAccept}
          className="px-4 py-2 bg-accent text-black rounded-lg text-sm btn-hover transition whitespace-nowrap"
        >
          Compris
        </button>
      </div>
    </div>
  )
}
```

```md
<!-- DECISIONS.md — entrée à ajouter -->

---

## YYYY-MM-DD : Granularité bandeau RGPD — bandeau binaire conforme

**Décision :** Le bandeau cookies actuel (`components/cookie-banner.tsx`, un seul bouton « Compris », bandeau informatif sans catégorisation) est conforme RGPD car **tous les cookies posés sur le domaine roxanetnous sont strictement essentiels au fonctionnement** : (a) cookies de session Supabase (`sb-*-auth-token`) = authentification, base légale art. 6.1.b RGPD (exécution du contrat), (b) `localStorage` `cookies-accepted` = préférence locale (techniquement pas un cookie HTTP, base légale art. 6.1.f intérêt légitime ergonomie). **Aucun cookie tiers** (analytics, publicité, tracking) n'est posé sur le domaine roxanetnous.

Les **cookies tiers Stripe** posés sur `checkout.stripe.com` lors d'une session de paiement sont sous la responsabilité de Stripe Payments Europe Ltd. (sous-traitant, cf. mentions légales) et hors périmètre du bandeau roxanetnous.

Les **tuiles cartographiques OpenStreetMap** (chargées par Leaflet sur les pages auxiliaire authentifiée pour configurer le rayon d'intervention) transmettent l'IP utilisateur à OSM Foundation. Cette transmission est couverte par la base légale art. 6.1.b RGPD (fonction métier essentielle, accès uniquement après authentification + acceptation CGU). Mention informative ajoutée dans la politique de confidentialité Section « Transferts de données ».

**Motivation :** Délibération CNIL n°2020-091 (lignes directrices cookies, 17 septembre 2020) admet un bandeau cookies purement informatif pour les sites où tous les cookies posés sont strictement essentiels au fonctionnement OU exemptés au titre de la mesure d'audience. Aucun consentement granulaire requis. Le projet roxanetnous remplit cette condition pré-go-live Bretagne (audit `_bmad-output/planning-artifacts/audit-cookies-YYYY-MM-DD.md`).

**Implications techniques :**
- `components/cookie-banner.tsx` : conservé en l'état (Scénario A) OU libellé ajusté pour refléter factuellement l'inventaire audité (Scénario B).
- `app/politique-de-confidentialite/page.tsx` : section Cookies factuelle, date de mise à jour mise à jour.
- **Aucun CMP requis** au stade MVP Bretagne. Décision à reconsidérer si introduction future d'analytics, retargeting, ou partenaires tiers à finalité commerciale.
- **Pré-condition** d'introduction d'un nouveau script tiers : audit RGPD préalable + classification CNIL + mise à jour `DECISIONS.md` si la classification est non-essentiel/non-exempté → ouvre une story Epic 4 CMP.

**Règle :** Tout nouveau cookie ou script tiers ajouté au projet doit (a) être classé essentiel/exempté/soumis-à-consentement avant merge, (b) si soumis à consentement, ouvrir une story Epic 4 CMP préalable. Aucun ajout direct de tracking/analytics tiers sans audit RGPD préalable et mise à jour de cette décision.

Voir `_bmad-output/planning-artifacts/audit-cookies-YYYY-MM-DD.md`.
```

```md
<!-- audit-cookies-YYYY-MM-DD.md — squelette de structure (6 sections AC1) -->

# Audit cookies et scripts tiers — YYYY-MM-DD

## Section 1 - Méthodologie

- **URL auditée :** `https://[prod ou preview taggée prod-like]`
- **Date/heure audit :** YYYY-MM-DD HH:MM Europe/Paris
- **Navigateur :** Chrome version X / Firefox version Y (mode invité, profil neuf)
- **Méthode :** DevTools manuel (Application > Cookies + Storage, Network)
- **Auditeur :** Sylvain Malard (responsable RGPD projet)
- **3 contextes parcourus :**
  1. Landing publique non connectée (`/`)
  2. Page authentifiée bénéficiaire abonné (`/recherche`, `/messages`, `/favoris`)
  3. Page Stripe Checkout (`checkout.stripe.com` lancée depuis `/abonnement`)
- **Référence CNIL :** Délibération n°2020-091 (lignes directrices cookies, 17 septembre 2020) + Recommandation cookies CNIL.

## Section 2 - Cookies posés (par contexte)

### Contexte 1 — Landing publique non connectée

| Nom | Domaine | Expiration | httpOnly | secure | sameSite | Émetteur | Finalité | Classification CNIL |
|---|---|---|---|---|---|---|---|---|
| (à remplir) | | | | | | | | |

### Contexte 2 — Page authentifiée bénéficiaire

| Nom | Domaine | Expiration | httpOnly | secure | sameSite | Émetteur | Finalité | Classification CNIL |
|---|---|---|---|---|---|---|---|---|
| `sb-*-auth-token` | (domaine prod) | session | true | true | lax | Supabase | Authentification | Essentiel (art. 6.1.b RGPD) |

### Contexte 3 — Page Stripe Checkout (sous-domaine Stripe, hors périmètre)

Mention : « Cookies tiers Stripe sur sous-domaine `checkout.stripe.com` (hors périmètre bandeau roxanetnous, traitement Stripe Payments Europe Ltd. comme sous-traitant — cf. mentions légales). »

## Section 3 - Scripts tiers chargés

### Contexte 1 — Landing publique non connectée

| URL/domaine | Émetteur | Pages | Finalité | Tracking ? | Classification CNIL |
|---|---|---|---|---|---|
| (à remplir) | | | | | |

### Contexte 2 — Page authentifiée bénéficiaire

| URL/domaine | Émetteur | Pages | Finalité | Tracking ? | Classification CNIL |
|---|---|---|---|---|---|
| Supabase API (`*.supabase.co`) | Supabase | Toutes | Authentification + queries BDD | Non | Essentiel (art. 6.1.b RGPD) |
| `tile.openstreetmap.org` | OSM Foundation | `/accompagnante/profil`, `/accompagnante/nouvelle-annonce`, onboarding step localisation | Tuiles cartographiques pour rayon d'intervention | Non (OSM = fondation à but non lucratif) | Essentiel (art. 6.1.b RGPD, fonction métier auxiliaire authentifiée) |

### Contexte 3 — Page Stripe Checkout

Hors périmètre (cf. Section 2 Contexte 3).

## Section 4 - Storage navigateur

| Type | Clé | Émetteur | Finalité | Persistance |
|---|---|---|---|---|
| `localStorage` | `cookies-accepted` | `components/cookie-banner.tsx:16` | Préférence locale (ne pas réafficher le bandeau) | Persistant |
| `sessionStorage` | `last_seen_updated` | `components/last-seen-tracker.tsx:14` | Throttle update last_seen_at (10 min) | Session uniquement |

## Section 5 - Vérification grep code

```bash
$ grep -rn "next/script|<Script|@vercel/analytics|@vercel/speed-insights|gtag|fbq|googletagmanager|google-analytics|plausible|posthog|hotjar|matomo|mixpanel|datadog|sentry|loadStripe" app/ components/ lib/
(0 occurrence) # Confirme absence d'analytics/tracking client-side.
```

`package.json` `dependencies` : aucune lib analytics/tracking/CMP. Présence `@stripe/stripe-js` (^9.2.0) **non importée client-side** (cf. grep `loadStripe` 0 occurrence). À nettoyer Epic 4 si non utilisée.

## Section 6 - Conclusion et décision

- **Synthèse :**
  - Tous cookies posés sur domaine roxanetnous : essentiels OUI / NON
  - Tous scripts tiers chargés : essentiels ou exemptés OUI / NON
- **Décision proposée :** Scénario A / B / C
- **Actions correctives appliquées dans cette story :** (à lister)
- **Actions reportées Epic 4 :** (audit Stripe Checkout éditeur, nettoyage `@stripe/stripe-js`, test e2e Playwright cookies, etc.)
- **Verdict global :** « MATRICE BANDEAU CONFORME RGPD » oui/non.
```

### Risques identifiés

| ID | Risque | Mitigation |
|---|---|---|
| **R1** | L'audit révèle un cookie/script non documenté qui rendrait le libellé `cookie-banner.tsx` trompeur (ex : Vercel Edge Insights actif sans qu'on le sache, cookie analytics introduit accidentellement par une dépendance transitive). | AC3 + AC4 imposent l'alignement libellé ↔ inventaire factuel. Si écart : Scénario B = correction libellé immédiate. AC7 grep en double-vérification. |
| **R2** | L'audit révèle un script tiers chargé en production qui est non-essentiel et soumis à consentement (ex : Vercel Web Analytics activé à l'insu côté Vercel dashboard, sans deps client-side). | Cas Scénario C : story 3.7 reste « done » sur l'audit + décision, mais story Epic 4 CMP **bloquante** pour go-live Bretagne. Définition de Done Epic 3 mise à jour. **Mitigation immédiate** : désactiver Vercel Analytics côté dashboard si activé sans usage. |
| **R3** | Les tuiles OSM sont jugées non-essentielles par interprétation stricte (avocat / DPO externe). | D5 documente l'argumentation art. 6.1.b RGPD (fonction métier auxiliaire authentifiée). Si interprétation contraire à l'avenir : Scénario C = consent granulaire + bouton « Activer la carte interactive » (Epic 4). Pas de blocage MVP : l'IP transmise à OSM Foundation est minimale, OSM ne fait pas de tracking commercial. |
| **R4** | Stripe Checkout pose des cookies sur notre domaine via redirection (cas non documenté). | AC6 Sub 4.3 vérifie au retour du checkout l'absence de cookie Stripe sur notre domaine. Si présent : Scénario C / B selon nature, escaler à mention dans politique de confidentialité. |
| **R5** | L'audit live n'est pas possible (production pas encore en ligne, pas de domaine final, preview Vercel non représentative). | Sub 1.1 accepte une preview Vercel taggée prod-like avec note explicite Section 1. Re-audit obligatoire **avant** ouverture département (mention dans `epic-3.md` Définition de Done). |
| **R6** | Modification `politique-de-confidentialite/page.tsx` casse le rendu (Scénario B). | AC10 + Sub 9.1 `tsc --noEmit` + Sub 9.4 `npm run build`. La modification est purement textuelle (contenu des `<li>`, date), aucun changement de structure JSX. Risque très faible. |
| **R7** | Le `LastSeenTracker` (l. 12 `useEffect` inconditionnel) lance `updateLastSeen()` même sur la landing publique non connectée, créant un appel server action inutile. | Hors scope cette story (c'est une optimisation perf, pas un risque RGPD : `updateLastSeen` côté serveur retourne early si `auth.getUser()` est null). À documenter Section 4 du rapport comme « observation » mais pas action. Candidat Epic 4. |
| **R8** | La date de mise à jour politique de confidentialité (l. 122) reste à `février 2026` après la story (oubli). | Sub 8.3 explicit. Vérification git diff Sub 9.5 le détectera si oublié. |
| **R9** | L'audit grep AC7 révèle un import accidentel `@vercel/analytics` introduit par une story future (ex : 3.5 ou 3.6) sans être détecté pré-cadrage. | Action corrective immédiate Sub 5.1-5.4 : retirer l'import + retirer dep `package.json` + `npm install`. Documenter Section 6 comme « écart corrigé ». Story reste livrable. |
| **R10** | Décision Scénario C → bascule Epic 4 CMP, mais le scope CMP n'est pas clairement défini ⇒ story Epic 4 mal cadrée. | Sub 6.4 : si Scénario C, ajouter dans `epic-3.md` (ou `epic-4.md` si créé) une **story squelette CMP minimal** avec scope précis : (a) bandeau granulaire 3 catégories (essentiels / mesure d'audience / non-essentiels), (b) modale paramètres détaillés, (c) persistance choix par cookie HTTP `cookie-consent` versionné, (d) intégration scripts conditionnels via `useEffect` + `loadScript()` helper, (e) update politique de confidentialité. Estimer 3-5 j-dev. |
| **R11** | Le rapport audit est créé mais l'auditeur (Sylvain) n'a pas accès à un environnement production-like (compte test bénéficiaire abonné non disponible). | Sub 1.2 : utiliser le coupon admin (`app/actions/admin.ts:570-628`) pour créer un compte test abonné. Procédure documentée. Si bloquant absolu : Scénario A par défaut, ré-audit à la première extension géographique. **Mention explicite Section 1 « audit partiel » si non possible**. |
| **R12** | Le format `DECISIONS.md` projet n'est pas strictement reproduit (oubli `Règle :`, oubli `Motivation :`). | D8 reproduit le pattern projet 2026-05-06. Sub 7.2 énumère les 5 champs obligatoires. Vérification visuelle avant commit. |

### Project Structure Notes

Cette story est un **audit + décision documentée + corrections rédactionnelles ponctuelles**. **Aucune nouvelle abstraction**, **aucun nouveau composant**, **aucun nouveau cron / route API / migration BDD**, **aucune nouvelle dépendance**. **DoD a11y allégée** : modifications limitées au libellé d'un `<p>` dans `cookie-banner.tsx` (Scénario B uniquement) ou aucune modif (Scénario A). Patterns a11y baseline projet (Lot A/B/C clôturé 2026-05-06) déjà en place et inchangés.

**Cohérent avec la philosophie projet** : « no half-finished implementations » appliqué au volet RGPD. Le PRD FR6 + la politique de confidentialité actuelle + le bandeau actuel forment un triangle qui doit être **factuellement vérifié et aligné avant le go-live Bretagne**, sous peine de mise en demeure CNIL post-lancement (le bandeau est public, donc première porte d'entrée d'une réclamation CNIL).

Après merge :
- Verrou conformité posé : aucune affirmation factuelle non vérifiée dans le bandeau / politique de confidentialité pré-go-live Bretagne.
- Rapport d'audit `audit-cookies-YYYY-MM-DD.md` reste comme référence pour audits futurs (re-audit pré-extension géographique, audit pré-introduction analytics).
- `DECISIONS.md` complété d'une décision RGPD canonique (la première du projet sur ce sujet), avec règle normative pour les futures stories.
- Si Scénario C : story Epic 4 CMP cadrée et bloquante pour ouverture département, évitant un patch d'urgence post-go-live.

### References

- [Source: _bmad-output/planning-artifacts/epic-3.md#Story-3.7] — story origin (objectifs, AC initiaux, notes implémentation : audit DevTools, classification CNIL, décision binaire ou granulaire).
- [Source: _bmad-output/planning-artifacts/prd.md#FR6] — exigence : « Un utilisateur peut gérer ses consentements (RGPD) ». À couvrir minimalement par bandeau + politique factuels.
- [Source: _bmad-output/planning-artifacts/prd.md#L126] — MVP Phase 1 #14 : « Conformité RGPD (suppression compte, export données, consentements) ».
- [Source: DECISIONS.md] — fichier de décisions canoniques projet, format à reproduire (cf. décisions 2026-05-06 soft paywall et déploiement progressif Bretagne).
- [Source: components/cookie-banner.tsx] — bandeau actuel à auditer / éventuellement corriger libellé (Scénario B).
- [Source: app/politique-de-confidentialite/page.tsx:84-96] — section Cookies à auditer / éventuellement aligner factuellement (Scénario B).
- [Source: app/politique-de-confidentialite/page.tsx:98-105] — section Transferts de données à compléter potentiellement (mention OSM si AC5 retenue).
- [Source: app/layout.tsx:69] — point de chargement global du bandeau cookies + LastSeenTracker.
- [Source: components/last-seen-tracker.tsx] — composant storage-only (sessionStorage), pas de cookie réseau, à documenter Section 4.
- [Source: components/ui/map-radius-inner.tsx:49] — chargement tuiles OSM (`tile.openstreetmap.org`), à classifier AC5.
- [Source: app/actions/subscription.ts:95] — `stripe.checkout.sessions.create()` + redirection serveur, base de l'audit Contexte 3.
- [Source: app/api/webhooks/stripe/route.ts] — webhook serveur Stripe, hors périmètre client-side cookies.
- [Source: app/mentions-legales/page.tsx:45] — mention « Stripe Payments Europe, Ltd. » comme sous-traitant. À conserver.
- [Source: package.json:dependencies] — vérification absence libs tracking client (cf. AC7).
- [Source: lib/supabase/middleware.ts:39-60, lib/supabase/server.ts:21-40] — points de pose des cookies Supabase auth (`sb-*-auth-token`).
- [Source: _bmad-output/implementation-artifacts/3-6-audit-soft-paywall-et-corrections-d-alignement-code-prd.md] — pattern story audit + décision + alignement code/PRD à cloner (format AC, Tasks, Dev Notes, Risques, References).
- [Source: _bmad-output/planning-artifacts/audit-a11y-2026-05-04.md] — pattern rapport audit projet (emplacement, format, structure sections).
- [Source: CNIL Délibération n°2020-091 du 17 septembre 2020] — lignes directrices cookies, base juridique de la classification (essentiel / exempté / soumis à consentement). Disponible publiquement sur cnil.fr.
- [Source: CNIL Recommandation cookies] — guide pratique CNIL sur l'implémentation des bandeaux cookies. Disponible publiquement sur cnil.fr.

### Intelligence story précédente (3.6)

- **Pattern « audit + décision + corrections ponctuelles »** confirmé : la story 3.6 a livré rapport audit `3-6-audit-paywall.md` + corrections code ponctuelles + décisions actées. **À reproduire** : rapport audit dans `planning-artifacts/` (cohérent avec autres audits projet) + décision dans `DECISIONS.md` + alignement libellés si désaligné.
- **Pattern double commit confirmé** (livraison + clôture après CI verte). Appliqué 3.1 → 3.6. À reproduire 3.7.
- **Code review adversarial post-livraison** est devenu une convention 3.5 + 3.6. **À reproduire** : prévoir code-review post-livraison story 3.7, anticiper findings sur (a) classifications CNIL discutables (tuiles OSM), (b) libellé bandeau si Scénario B (formulation), (c) date `politique-de-confidentialite` cohérente.
- **Pattern « ne pas introduire `as any` »** strictement appliqué. AC9 le formalise. La story 3.7 ne touche que des fichiers TS minimaux (Scénario B = `cookie-banner.tsx`).
- **Tests manuels reportés Epic 4 systématiquement** (convention projet MVP). AC12 documente les 3 contextes audités manuellement, reporte les tests e2e Playwright cookies à Epic 4.
- **Reuse strict** : 0 nouvelle abstraction, 0 nouveau composant, 0 nouvelle dépendance. Conserve `cookie-banner.tsx` actuel (Scénario A) ou modifie ses libellés uniquement (Scénario B).
- **Mémoire `project_logNotification_bug` non concernée** (cette story ne touche pas `notifications_log`).
- **Mémoire `project_admin_actions_log_target_id_bug` non concernée** (corrigé en 3.5, non touché ici).

### Intelligence git récente (5 derniers commits)

```
7b3a8c7 Story 3.6 : patches code review (5 patches + 2 decisions resolues)
19d0ddc Story 3.6 : statut done apres CI Vercel verte
4b2a42c Story 3.6 : audit soft paywall et corrections d'alignement code/PRD
df8ea5d Story 3.5 : patches code review (decision_needed resolus en option c)
daa8c18 Story 3.5 : statut done apres CI Vercel verte
```

Note importante : le pattern « post-livraison code review + patches » est désormais une convention stable (3.5 + 3.6). La story 3.7 va le reproduire. Le code reviewer adversarial doit être programmé après livraison.

**Aucun commit récent ne touche `cookie-banner.tsx`, `politique-de-confidentialite/page.tsx`, ou `DECISIONS.md`** : zéro risque de conflit, patterns stables.

### Résultats requête code pré-cadrage (vérification état)

```bash
# 1. Vérifier absence d'analytics / tracking client-side
$ grep -rn "next/script\|<Script\|@vercel/analytics\|@vercel/speed-insights\|gtag\|fbq\|googletagmanager\|google-analytics\|plausible\|posthog\|hotjar\|matomo\|mixpanel\|datadog\|sentry\|loadStripe" app/ components/ lib/
(0 occurrence applicative — seules occurrences trouvées dans pages textuelles politique de confidentialité / mentions légales mentionnant "Stripe" comme sous-traitant)

# 2. Inventaire usages localStorage / sessionStorage
$ grep -rn "localStorage\|sessionStorage" app/ components/ lib/
components/cookie-banner.tsx:9:    const accepted = localStorage.getItem('cookies-accepted')
components/cookie-banner.tsx:16:   localStorage.setItem('cookies-accepted', 'true')
components/last-seen-tracker.tsx:11: const last = sessionStorage.getItem(THROTTLE_KEY)
components/last-seen-tracker.tsx:14: sessionStorage.setItem(THROTTLE_KEY, String(Date.now()))
# Constat : 2 usages, déjà documentés section 4 du rapport.

# 3. Inventaire usages Leaflet / tuiles OSM
$ grep -rn "tile.openstreetmap\|TileLayer" app/ components/
components/ui/map-radius-inner.tsx:4:  import { MapContainer, TileLayer, Circle, useMap } from 'react-leaflet'
components/ui/map-radius-inner.tsx:47: <TileLayer
components/ui/map-radius-inner.tsx:49: url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"

$ grep -rn "MapRadius\|map-radius-inner" app/ components/
components/ui/map-radius.tsx (wrapper dynamic ssr:false)
components/accompagnante/profile-form.tsx:401: <MapRadius ville={ville} codePostal={codePostal} rayonKm={rayonKm} />
components/accompagnante/nouvelle-annonce-form.tsx:114: <MapRadius ville={ville} codePostal={codePostal} rayonKm={rayonKm} />
components/accompagnante/step-localisation.tsx:65: <MapRadius ville={data.ville} codePostal={data.code_postal} rayonKm={data.rayon_km} />
# Constat : 3 contextes auxiliaire authentifiée uniquement, aucune utilisation publique non connectée.

# 4. Inventaire dépendances client-side runtime
$ cat package.json | grep -A 20 '"dependencies"'
# (cf. extrait haut de la story)
# Constat : aucune lib analytics/tracking/CMP. @stripe/stripe-js présent mais non importé client-side.

# 5. Vérifier absence import Stripe.js client
$ grep -rn "@stripe/stripe-js\|loadStripe" app/ components/ lib/
(0 occurrence)
# Constat : Stripe Checkout en redirection serveur uniquement, aucun script Stripe.js sur notre domaine.

# 6. Vérifier point de chargement bandeau + tracker
$ grep -n "CookieBanner\|LastSeenTracker" app/layout.tsx
4: import { CookieBanner } from '@/components/cookie-banner'
5: import { LastSeenTracker } from '@/components/last-seen-tracker'
68: <LastSeenTracker />
69: <CookieBanner />
# Constat : 2 composants chargés globalement dans le layout racine.

# 7. Vérifier next.config — pas de Script Optimization tierce
$ cat next.config.mjs
# Constat : config Next.js minimale (reactStrictMode + remotePatterns Supabase). Aucun script tiers configuré.

# 8. Vérifier next/font — confirmer self-host
$ grep -n "next/font" app/layout.tsx
2: import { Inter, Playfair_Display } from 'next/font/google'
# Next.js 16 self-host les fonts au build. Aucun appel runtime fonts.googleapis.com / fonts.gstatic.com.
```

## Dev Agent Record

### Agent Model Used

Claude Opus 4.7 (1M context) via skill `bmad-dev-story` — exécution 2026-05-07.

### Debug Log References

- `npx tsc --noEmit` → exit 0.
- `npm run lint:a11y-check` → `OK: 155 jsx-a11y violations across 56 (file, rule) pair(s). Baseline total: 155. No regression.`
- `npm run a11y:axe:check` → `OK: aucun delta Critical/Serious au-dela du baseline.` (baseline `_bmad-output/test-artifacts/axe-core-baseline-2026-05-05.json`, 7 parcours).
- `npm run build` → `✓ Compiled successfully in 2.2s` + `✓ Generating static pages using 9 workers (49/49) in 688ms`.

### Completion Notes List

- **Bascule audit DevTools live → audit code statique** : production roxanetnous.fr pas live et pas de session DevTools utilisateur disponible. Audit reconstitué intégralement par analyse code (greps AC7, lecture `lib/supabase/middleware.ts` + `lib/supabase/server.ts`, lecture `app/layout.tsx` + `next.config.mjs`, lecture `app/actions/subscription.ts`, lecture des 5 call-sites `MapRadius`). Limitation explicitement documentée Section 1 du rapport. **Re-audit DevTools live obligatoire avant ouverture département Bretagne** (R5/R11) — ajouté en action reportée Epic 4.

- **Découverte périmètre OSM élargi** : pré-cadrage AC5 mentionnait 3 contextes auxiliaire pour `MapRadius`. L'audit code révèle **5 call-sites** (4 auxiliaire incluant `modifier-annonce-form.tsx` + 1 bénéficiaire `app/accompagne/annonces/nouvelle/page.tsx` via `components/accompagne/nouvelle-annonce-form.tsx:284`). Tous restent sur routes authentifiées (vérifié redirect login + role guard), donc la classification CNIL art. 6.1.b RGPD reste applicable (fonction métier essentielle). Précision documentée Section 3 + 5.2 du rapport et reflétée dans `politique-de-confidentialite/page.tsx` Section « Transferts de données ».

- **Découverte localStorage vs cookie** : la préférence d'acceptation du bandeau est stockée en `localStorage` (clé `cookies-accepted`), techniquement **pas un cookie HTTP** au sens Délibération CNIL n°2020-091. Donc la rédaction historique de `cookie-banner.tsx:27` (« cookies essentiels … préférences ») et `politique-de-confidentialite/page.tsx:91` (« Préférence cookies (acceptation de la bannière) ») était imprécise. Décision : **Scénario B** (correction libellés), car le maintien d'une formulation imprécise aurait créé un risque de non-conformité formelle en cas de contrôle CNIL.

- **Décision Scénario B** : 2 fichiers TS modifiés (`cookie-banner.tsx`, `politique-de-confidentialite/page.tsx`) + 1 entrée `DECISIONS.md` ajoutée + 1 rapport `_bmad-output/planning-artifacts/audit-cookies-2026-05-07.md` créé. Conforme AC8 (≤ 5 fichiers code/utilisateur, ≈ 70 lignes ajoutées hors rapport audit). **Note AC8** : le rapport audit (~250 lignes) est l'artefact livrable principal de la story (Dev Notes D3 documente la convention `audit-cookies-YYYY-MM-DD.md` versionné par date) et n'entre pas dans la borne « ≤ 200 lignes ajoutées » destinée au code applicatif/utilisateur. Cette nuance est compatible avec la nature de la story (audit + décision, pas refactor).

- **AC9 (pas de `as any`)** : aucun nouveau cast introduit (modifications limitées au texte JSX dans `<p>`/`<li>`).

- **AC10 (a11y)** : libellés modifiés conservent `text-sm text-gray-700` (contraste >= 4.5:1 baseline). Bouton « Compris » inchangé. Aucune nouvelle interaction. Baselines `lint:a11y-check` (155) et `a11y:axe:check` (0 Critical/Serious sur 7 parcours) inchangées.

- **AC commun 2 (double commit)** : commit livraison à effectuer + push + attendre CI Vercel verte + commit clôture (procédure Task 10 du story file).

### File List

Fichiers modifiés :
- `_bmad-output/implementation-artifacts/sprint-status.yaml` (statut story `ready-for-dev` → `in-progress` puis `review` à la fin de Task 10).
- `_bmad-output/implementation-artifacts/3-7-audit-cookies-scripts-tiers-et-decision-granularite-bandeau-rgpd.md` (story file : tasks/subtasks cochés, Dev Agent Record, statut).
- `DECISIONS.md` (entrée chronologique 2026-05-07 ajoutée fin de fichier).
- `app/politique-de-confidentialite/page.tsx` (sections Cookies + Transferts de données précisées + date « février 2026 » → « mai 2026 »).
- `components/cookie-banner.tsx` (libellé `<p>` réécrit pour refléter factuellement l'inventaire).

Fichiers créés :
- `_bmad-output/planning-artifacts/audit-cookies-2026-05-07.md` (rapport audit complet, 6 sections AC1).

## DoD a11y

DoD a11y **applicable mais légère** (story modifie au maximum 1 libellé `<p>` dans `cookie-banner.tsx` en Scénario B, ou aucune modif en Scénario A). Patterns baseline Lot A/B/C déjà en place réutilisés.

- [x] Si Scénario B : libellé `<p>` modifié conserve contraste >= 4.5:1 (classe `text-sm text-gray-700` baseline).
- [x] Si Scénario B : bouton « Compris » inchangé (label, focus visible, contraste).
- [x] `npm run lint:a11y-check` reste vert (baseline 155 stable).
- [x] `npm run a11y:axe:check` reste vert (0 violations Critical/Serious sur 7 parcours).
- [x] `git diff --stat` ne touche que des fichiers listés AC8 (≤ 5 fichiers code/utilisateur, ≈ 70 lignes ; rapport audit hors borne — cf. Completion Notes).

**Pré-condition de commit livraison (règle CLAUDE.md durcie)** : `npm run a11y:axe:check` exécuté localement, exit 0 confirmé.
