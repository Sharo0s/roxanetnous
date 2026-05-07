# Audit cookies et scripts tiers — roxanetnous — 2026-05-07

**Type d'audit** : audit partiel par analyse code statique (DevTools live à confirmer pré-go-live Bretagne).
**Auteur** : audit guidé Claude (mode `bmad-dev-story`, story 3.7).
**Branche** : `main`, dernier commit `7b3a8c7` (Story 3.6 patches code review).
**Référentiels** : Délibération CNIL n°2020-091 du 17 septembre 2020 (lignes directrices cookies) + Recommandation cookies CNIL.

---

## Section 1 - Méthodologie

### Approche retenue

**Audit partiel par analyse code statique** : l'environnement de production roxanetnous.fr n'étant pas encore live au moment de cet audit, et faute de session DevTools utilisateur disponible, l'inventaire des cookies posés et des scripts tiers chargés est reconstitué **à partir des sources** (greps, lecture des points de chargement, lecture des dépendances `package.json`, configuration `next.config.mjs`, configuration Supabase `lib/supabase/`).

Cette approche est suffisante pour conclure sur la **classification CNIL** parce que (a) le projet n'a aucun script analytics/tracking client-side (cf. Section 5 grep AC7 : 0 occurrence), (b) la stack tiers identifiée (Supabase auth, Stripe redirection serveur, tuiles OSM, fonts self-hosted Next.js) est **entièrement documentée par le code**, (c) aucun script tiers ne peut être chargé en production sans apparaître dans le code source ou dans `next.config.mjs`.

### Contextes audités (3 cibles AC1)

1. **Contexte 1 — Landing publique non connectée** (`/`).
2. **Contexte 2 — Page authentifiée bénéficiaire** (`/recherche`, `/messages`, `/favoris`, `/abonnement`).
3. **Contexte 3 — Page Stripe Checkout** (`checkout.stripe.com` lancée depuis `/abonnement`).

### Limitations (à lever pré-go-live)

- **Pas d'inspection DevTools live** : les attributs `httpOnly`, `secure`, `sameSite`, `expiration` des cookies Supabase auth ne sont pas vérifiés visuellement. Ils sont **confirmés par contrat** côté `@supabase/ssr` (cookies session sécurisés, httpOnly côté serveur, sameSite=lax par défaut conformément au standard `@supabase/ssr` 0.10.x), mais doivent être contrôlés en mode invité Chrome/Firefox **avant ouverture publique département Bretagne** (cf. R5/R11 du story file 3.7).
- **Pas de vérification visuelle Stripe Checkout** : la confirmation que Stripe ne pose pas de cookie cross-domain sur roxanetnous.fr au retour annulation du checkout repose sur le fait que (a) `app/actions/subscription.ts` redirige via `session.url` Stripe (redirection HTTP simple, pas un iframe/embed), (b) le grep `loadStripe`/`@stripe/stripe-js` côté `app/`, `components/`, `lib/` retourne 0 occurrence, donc aucun script Stripe.js n'est exécuté sur notre domaine.
- **Re-audit obligatoire** : un audit DevTools live sur 3 contextes doit être mené **avant l'ouverture département Bretagne**. Ajouter cette dépendance à la « Définition de Done Epic 3 » dans `_bmad-output/planning-artifacts/epic-3.md` si pas déjà mentionnée.

---

## Section 2 - Cookies posés (par contexte)

### Contexte 1 — Landing publique non connectée

| Nom | Domaine | Expiration | httpOnly | secure | sameSite | Émetteur | Finalité | Classification CNIL |
|---|---|---|---|---|---|---|---|---|
| (aucun cookie HTTP attendu) | — | — | — | — | — | — | — | — |

**Justification analyse code** : le middleware Supabase (`lib/supabase/middleware.ts:35-37`) **court-circuite explicitement** toutes les routes publiques (`/`, `/login`, `/register`, `/forgot-password`, `/reset-password`, `/mentions-legales`, `/politique-de-confidentialite`, `/cgu`, `/sitemap.xml`, `/robots.txt`, `/recherche`, `/auth/*`, `/api/*`, `/landing-*`) avant d'instancier `createServerClient`. Aucun cookie Supabase n'est donc posé tant que l'utilisateur n'est pas connecté. La page d'accueil `app/page.tsx:14` instancie un client Supabase **service-role côté serveur** pour les compteurs, ce qui n'expose pas de cookie au navigateur.

Le composant `<CookieBanner />` (`components/cookie-banner.tsx:9, 16`) utilise `localStorage` (clé `cookies-accepted`), **pas** de cookie HTTP — voir Section 4.

### Contexte 2 — Page authentifiée bénéficiaire (post-login)

| Nom | Domaine | Expiration | httpOnly | secure | sameSite | Émetteur | Finalité | Classification CNIL |
|---|---|---|---|---|---|---|---|---|
| `sb-<project-ref>-auth-token` | `roxanetnous.fr` | session (~7j renouvelable) | true (par défaut `@supabase/ssr` côté serveur) | true (en HTTPS prod) | `lax` | Supabase (`@supabase/ssr` 0.10.x) | Authentification utilisateur, session sécurisée | **Essentiel** — base légale art. 6.1.b RGPD (exécution du contrat) |

**Justification analyse code** : `lib/supabase/server.ts:21-40` et `lib/supabase/middleware.ts:39-60` utilisent `createServerClient` avec un adaptateur `cookies` qui délègue à `cookieStore.getAll()` / `cookieStore.set(name, value, options)`. Les `options` (httpOnly, secure, sameSite, expires) sont gérées par `@supabase/ssr` lui-même (pas surchargées côté projet), donc respectent les valeurs par défaut sécurisées de la librairie Supabase. **Aucun autre cookie HTTP applicatif** posé sur le domaine roxanetnous (grep code projet : seuls `cookieStore.set` Supabase, aucune autre écriture `Set-Cookie`).

### Contexte 3 — Page Stripe Checkout (sous-domaine Stripe)

**Mention** : « Cookies tiers Stripe sur sous-domaine `checkout.stripe.com` (hors périmètre bandeau roxanetnous, traitement Stripe Payments Europe Ltd. comme sous-traitant — cf. `app/mentions-legales/page.tsx:45`). »

**Justification analyse code** : `app/actions/subscription.ts:95` crée une session via `stripe.checkout.sessions.create({...})` puis redirige vers `session.url` (sous-domaine `checkout.stripe.com`). Cette redirection est une **redirection HTTP serveur 1ère partie** (pas un iframe Stripe Elements). Les cookies posés sur `checkout.stripe.com` le sont donc **uniquement sur le domaine Stripe**, sous la responsabilité de Stripe Payments Europe Ltd. en tant que sous-traitant RGPD au sens art. 28.

Aucune fonction `loadStripe` ni aucun import `@stripe/stripe-js` n'est présent dans `app/`, `components/`, `lib/` (grep AC7 confirmé : 0 occurrence). Le SDK Stripe utilisé est le SDK Node serveur (`stripe` package, `app/api/webhooks/stripe/route.ts`). **Aucun script Stripe.js client-side ne s'exécute sur roxanetnous.fr.**

---

## Section 3 - Scripts tiers chargés

### Contexte 1 — Landing publique non connectée

| URL/domaine | Émetteur | Pages | Finalité | Tracking ? | Classification CNIL |
|---|---|---|---|---|---|
| (aucun) | — | — | — | — | — |

**Justification analyse code** :
- `next.config.mjs` ne déclare aucun `<Script>` tiers (`reactStrictMode + remotePatterns Supabase` uniquement).
- `app/layout.tsx` charge `<CookieBanner />` (composant local) et `<LastSeenTracker />` (composant local) ; aucun `<script src=...>` externe.
- Les fonts `Inter` et `Playfair Display` (`app/layout.tsx:2`) sont importées via `next/font/google` qui les **self-host au build** (Next.js 16 rapatrie les fichiers `.woff2` lors du build, aucun appel runtime à `fonts.googleapis.com` / `fonts.gstatic.com`).
- Grep AC7 (Section 5) : 0 occurrence d'analytics/tracking/CMP tiers sur le projet entier.
- Le composant `<LastSeenTracker />` (`components/last-seen-tracker.tsx:9-16`) appelle la **server action** `updateLastSeen()` depuis `useEffect`. Une server action = POST same-origin invisible au tab `Application/Cookies` côté navigateur. La server action côté serveur (`app/actions/profile.ts:137-146`) **retourne immédiatement** si pas d'utilisateur authentifié (`if (!user) return`). Pas de risque RGPD ; observation perf documentée Section 4.

### Contexte 2 — Page authentifiée bénéficiaire

| URL/domaine | Émetteur | Pages | Finalité | Tracking ? | Classification CNIL |
|---|---|---|---|---|---|
| `<project-ref>.supabase.co` | Supabase | `/messages` (chat-window WS), `/`* via header (unread-badge) | API base de données + realtime websocket pour notifications + messagerie | Non (logs serveur Supabase, pas de tracking commercial) | **Essentiel** — base légale art. 6.1.b RGPD |

**Justification analyse code** : seuls deux composants client browser instancient `createBrowserClient` (`@supabase/ssr` `lib/supabase/client.ts`) :
- `components/messages/chat-window.tsx:5` (page `/messages` connectée).
- `components/layout/unread-badge.tsx:4` (badge messages non lus dans header authentifié).

Aucun appel à un domaine tiers commercial (analytics, ads, retargeting). La page `/abonnement` ne charge **pas** Stripe.js (cf. Section 2 Contexte 3).

### Contexte 2 bis — Pages avec carte Leaflet (auxiliaire et bénéficiaire authentifiées)

| URL/domaine | Émetteur | Pages (call-sites) | Finalité | Tracking ? | Classification CNIL |
|---|---|---|---|---|---|
| `{a,b,c}.tile.openstreetmap.org` | OpenStreetMap Foundation | `components/accompagnante/profile-form.tsx:401`, `components/accompagnante/nouvelle-annonce-form.tsx:114`, `components/accompagnante/modifier-annonce-form.tsx:120`, `components/accompagnante/step-localisation.tsx:65`, `components/accompagne/nouvelle-annonce-form.tsx:284` | Tuiles cartographiques pour configurer le rayon d'intervention (auxiliaire) ou visualiser une zone (bénéficiaire) | Non (OSM Foundation = fondation à but non lucratif, logs serveur < 7 jours selon leur politique) | **Essentiel** — base légale art. 6.1.b RGPD (fonction métier authentifiée + acceptation CGU pré-requise) |

**Note importante** : le pré-cadrage AC5 mentionnait **3 contextes auxiliaire** pour `MapRadius`. L'analyse code révèle **5 call-sites** au total (4 côté auxiliaire incluant `modifier-annonce-form.tsx` ; 1 côté bénéficiaire dans `app/accompagne/annonces/nouvelle/page.tsx` via `components/accompagne/nouvelle-annonce-form.tsx:284`). Cette précision élargit le périmètre OSM mais **ne change pas la classification** : tous les call-sites sont sur des routes authentifiées (vérifié `app/accompagne/annonces/nouvelle/page.tsx:11-20` : redirect `/login` si pas user, redirect `/` si role ≠ `accompagne`). Donc la base légale art. 6.1.b RGPD reste applicable (publier ou éditer une annonce/profil = exécution du contrat).

`components/ui/map-radius-inner.tsx:49` charge les tuiles via `<TileLayer url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" />` (composant `react-leaflet`). Le wrapper `components/ui/map-radius.tsx:12` charge `MapRadiusInner` en `dynamic({ ssr: false })`, donc les tuiles ne sont chargées que côté client après hydratation, **uniquement** sur les pages contenant `<MapRadius />`.

### Contexte 3 — Page Stripe Checkout

Hors périmètre (cf. Section 2 Contexte 3).

---

## Section 4 - Storage navigateur

| Type | Clé | Émetteur | Finalité | Persistance | Note |
|---|---|---|---|---|---|
| `localStorage` | `cookies-accepted` | `components/cookie-banner.tsx:9, 16` | Préférence locale : ne pas réafficher le bandeau information cookies à chaque visite | Persistant (jusqu'à effacement navigateur) | **Pas un cookie HTTP** — stockage côté navigateur uniquement, jamais transmis dans une requête HTTP. La rédaction actuelle de `politique-de-confidentialite/page.tsx:91` (« Préférence cookies (acceptation de la bannière) ») et de `cookie-banner.tsx:27` (« cookies essentiels … préférences ») est techniquement imprécise. **Action corrective Scénario B**. |
| `sessionStorage` | `last_seen_updated` | `components/last-seen-tracker.tsx:11, 14` | Throttle : éviter d'appeler la server action `updateLastSeen()` plus d'une fois toutes les 10 minutes par session | Session uniquement (effacé fermeture onglet) | Bonne pratique perf. Pas un cookie HTTP. **Observation R7 du story file** : `useEffect` est inconditionnel dans `LastSeenTracker`, donc la server action est appelée même non connecté ; mais `updateLastSeen` retourne early (`app/actions/profile.ts:140`) si `auth.getUser()` retourne null. **Pas de risque RGPD**, juste un appel POST same-origin no-op. Candidat optimisation Epic 4. |

---

## Section 5 - Vérification grep code

### 5.1 — Absence d'analytics / tracking / CMP client-side

```bash
$ grep -rnE "next/script|<Script|@vercel/analytics|@vercel/speed-insights|gtag|fbq|googletagmanager|google-analytics|plausible|posthog|hotjar|matomo|mixpanel|datadog|sentry|loadStripe|@stripe/stripe-js" app/ components/ lib/
(0 occurrence applicative)
```

Confirme l'absence totale de tracking/analytics côté client. Aucun import `@stripe/stripe-js` ni appel `loadStripe` malgré la présence de la dépendance dans `package.json`.

### 5.2 — Inventaire usages Leaflet / tuiles OSM

```bash
$ grep -rnE "tile.openstreetmap|TileLayer" app/ components/
components/ui/map-radius-inner.tsx:4:  import { MapContainer, TileLayer, Circle, useMap } from 'react-leaflet'
components/ui/map-radius-inner.tsx:47: <TileLayer
components/ui/map-radius-inner.tsx:49: url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"

$ grep -rnE "MapRadius|map-radius-inner" app/ components/
components/ui/map-radius.tsx:6:    type MapRadiusProps = {
components/ui/map-radius.tsx:12:   const MapInner = dynamic(() => import('./map-radius-inner'), { ssr: false })
components/ui/map-radius-inner.tsx:31: export default function MapRadiusInner(...)
components/accompagnante/profile-form.tsx:9:    import { MapRadius } from '@/components/ui/map-radius'
components/accompagnante/profile-form.tsx:401: <MapRadius ... />
components/accompagnante/nouvelle-annonce-form.tsx:7:  import { MapRadius } from '@/components/ui/map-radius'
components/accompagnante/nouvelle-annonce-form.tsx:114: <MapRadius ... />
components/accompagnante/step-localisation.tsx:3:  import { MapRadius } from '@/components/ui/map-radius'
components/accompagnante/step-localisation.tsx:65:  <MapRadius ... />
components/accompagnante/modifier-annonce-form.tsx:7:  import { MapRadius } from '@/components/ui/map-radius'
components/accompagnante/modifier-annonce-form.tsx:120: <MapRadius ... />
components/accompagne/nouvelle-annonce-form.tsx:8:  import { MapRadius } from '@/components/ui/map-radius'
components/accompagne/nouvelle-annonce-form.tsx:284: <MapRadius ... />
```

Constat : 5 call-sites `<MapRadius />` (4 auxiliaire + 1 bénéficiaire), tous sur routes authentifiées. **Aucune utilisation publique non connectée** (la carte hero landing est un SVG statique `components/landing/hero-carte.tsx`, pas Leaflet — confirmé story 2.6.5).

### 5.3 — Inventaire usages localStorage / sessionStorage

```bash
$ grep -rnE "localStorage|sessionStorage" app/ components/ lib/
components/cookie-banner.tsx:9:    const accepted = localStorage.getItem('cookies-accepted')
components/cookie-banner.tsx:16:   localStorage.setItem('cookies-accepted', 'true')
components/last-seen-tracker.tsx:11: const last = sessionStorage.getItem(THROTTLE_KEY)
components/last-seen-tracker.tsx:14: sessionStorage.setItem(THROTTLE_KEY, String(Date.now()))
```

Constat : 2 usages, déjà documentés Section 4.

### 5.4 — Vérification dépendances `package.json`

```
dependencies (runtime client-side potentiel) :
  @stripe/stripe-js: ^9.2.0          # PRÉSENT mais NON IMPORTÉ (cf. 5.1). Dette technique : à nettoyer Epic 4 si non utilisé à terme.
  @supabase/ssr: ^0.10.2             # Auth + cookies — essentiel
  @supabase/supabase-js: ^2.95.3     # Client BDD — essentiel
  leaflet: ^1.9.4                    # Bibliothèque carte (chargée tuiles OSM, voir 5.2) — essentiel
  react-leaflet: ^5.0.0              # Wrapper React — essentiel
  resend: ^6.9.2                     # Email server-side uniquement, jamais importé client
  stripe: ^22.0.2                    # SDK Node server-side uniquement
  next, react, react-dom, tailwind, postcss, autoprefixer  # Runtime framework
devDependencies :
  Aucune lib de tracking/analytics. Outils a11y et tests uniquement.
```

**Aucune lib analytics, retargeting, CMP, session replay, A/B testing, error tracking client.** Stack RGPD-clean.

### 5.5 — Vérification `next.config.mjs`

```js
/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  images: {
    remotePatterns: [{ protocol: 'https', hostname: '**.supabase.co' }],
  },
}
```

Aucun `<Script>` tiers configuré. Aucun rewrites/redirects vers domaine tiers. Single remote pattern image = Supabase Storage.

### 5.6 — Vérification `next/font` (self-host fonts)

```bash
$ grep -n "next/font" app/layout.tsx
2: import { Inter, Playfair_Display } from 'next/font/google'
```

Next.js 16 rapatrie les `.woff2` au build time. Aucun appel runtime à `fonts.googleapis.com` ni `fonts.gstatic.com`. Pas de transfert IP utilisateur à Google Fonts en prod.

---

## Section 6 - Conclusion et décision

### Synthèse factuelle

- **Tous cookies posés sur le domaine roxanetnous : essentiels OUI** (uniquement `sb-*-auth-token` Supabase, base légale art. 6.1.b RGPD).
- **Tous scripts tiers chargés : essentiels ou hors périmètre OUI** :
  - Supabase API : essentiel (authentification + données métier).
  - Tuiles OSM : essentiel (fonction métier rayon d'intervention auxiliaire / localisation bénéficiaire), accès post-authentification + acceptation CGU, transmission IP minimale à OSM Foundation (pas de tracking commercial).
  - Stripe Checkout : sous-domaine Stripe, hors périmètre bandeau roxanetnous (sous-traitant RGPD).
  - Fonts Google : self-hostées au build par Next.js, aucun appel runtime.
- **Aucun cookie ni script tiers de tracking/analytics/retargeting/publicité** sur notre domaine.
- **Préférence bandeau** stockée en `localStorage` (`cookies-accepted`) — **pas un cookie HTTP**, donc rédaction actuelle imprécise dans `cookie-banner.tsx:27` (« préférences ») et `politique-de-confidentialite/page.tsx:91` (« Préférence cookies (acceptation de la bannière) »).

### Décision proposée : **Scénario B — bandeau binaire conforme + correction libellés**

Le bandeau actuel `components/cookie-banner.tsx` (un seul bouton « Compris », pas de catégorisation) est **conforme RGPD** car tous les cookies posés sur notre domaine sont strictement essentiels (art. 6.1.b RGPD). Aucun consentement granulaire n'est requis. La Délibération CNIL n°2020-091 admet un bandeau cookies purement informatif pour les sites où tous les cookies posés sont strictement essentiels OU exemptés au titre de la mesure d'audience.

**Toutefois**, deux désalignements factuels mineurs sont identifiés :
1. `cookie-banner.tsx:26-28` mentionne « cookies essentiels au fonctionnement (authentification, **préférences**) » — la « préférence » est en réalité du `localStorage`, pas un cookie HTTP.
2. `politique-de-confidentialite/page.tsx:84-96` Section « Cookies » liste 2 entrées dont une (« Préférence cookies (acceptation de la bannière) ») confond cookie HTTP et `localStorage`.

Ces désalignements **n'introduisent pas de non-conformité bloquante** (le libellé reste véridique sur l'absence totale de tracking, et le `localStorage` est plus respectueux qu'un cookie HTTP du point de vue RGPD), mais leur correction renforce la transparence vis-à-vis de la CNIL en cas de contrôle.

### Actions correctives appliquées dans cette story

1. **`components/cookie-banner.tsx`** : libellé `<p>` ligne 26-28 réécrit pour refléter factuellement l'inventaire :
   - Mention claire du cookie d'authentification Supabase (`sb-*-auth-token`).
   - Mention que la préférence bandeau est stockée localement (et non en cookie HTTP).
   - Conservation de l'affirmation négative (« aucun cookie publicitaire ou de suivi ») désormais factuellement vérifiée.

2. **`app/politique-de-confidentialite/page.tsx`** :
   - Section « Cookies » (l. 84-96) : liste `<ul><li>` précisée — un seul cookie HTTP listé (`sb-*-auth-token` Supabase), ajout d'une mention séparée sur le `localStorage` `cookies-accepted` au titre de la transparence.
   - Section « Transferts de données » (l. 98-105) : ajout d'une phrase informative sur les tuiles OpenStreetMap (art. 6.1.b RGPD, fonction métier authentifiée).
   - Date de dernière mise à jour (l. 122) : « février 2026 » → « mai 2026 ».

3. **`DECISIONS.md`** : entrée chronologique 2026-05-07 « Granularité bandeau RGPD — bandeau binaire conforme » ajoutée (cf. Section « Décision actée » du story file).

### Actions reportées Epic 4

- **Re-audit DevTools live** sur 3 contextes avant ouverture département Bretagne (vérification `httpOnly`/`secure`/`sameSite`/expiration des cookies Supabase, confirmation absence cookie cross-domain Stripe au retour annulation checkout). Bloquant pour go-live.
- **Test e2e Playwright cookies** : automatiser l'inventaire à chaque PR pour détecter une introduction accidentelle d'analytics. Hors scope MVP, candidat hardening Epic 4.
- **Nettoyage `@stripe/stripe-js`** dans `package.json` : présence inutilisée. À retirer ou justifier (Stripe Elements futur ?).
- **Correction placeholders politique de confidentialité** : `[Nom de la société]` (l. 18) et `[roxanetnous@outlook.com]` (l. 19, 75, 79). Hors scope cette story (correction legal indépendante).
- **Optimisation `LastSeenTracker`** : conditionner le `useEffect` à un user authentifié pour éviter l'appel server action no-op. Pas un risque RGPD, juste une optimisation perf.

### Verdict global

**MATRICE BANDEAU CONFORME RGPD : OUI** — sous réserve du re-audit DevTools live pré-go-live Bretagne pour confirmer les attributs cookies Supabase et l'absence de cookie cross-domain Stripe. Le projet roxanetnous remplit les conditions de la Délibération CNIL n°2020-091 pour un bandeau informatif sans consent granulaire.

---

## Annexe — Référentiels CNIL

- **Délibération n°2020-091 du 17 septembre 2020** portant adoption de lignes directrices relatives à l'application de l'article 82 de la loi du 6 janvier 1978 modifiée aux opérations de lecture et écriture dans le terminal d'un utilisateur (notamment aux cookies et autres traceurs).
- **Recommandation cookies CNIL** : guide pratique d'implémentation des bandeaux cookies (admis : bandeau informatif sans consentement si cookies strictement essentiels uniquement).
- **Article 6.1.b RGPD** : « le traitement est nécessaire à l'exécution d'un contrat auquel la personne concernée est partie ou à l'exécution de mesures précontractuelles prises à la demande de celle-ci » — base légale retenue pour les cookies Supabase auth (utilisateur connecté = exécution du contrat de service plateforme) et les tuiles OSM (fonction métier auxiliaire/bénéficiaire authentifiée).
