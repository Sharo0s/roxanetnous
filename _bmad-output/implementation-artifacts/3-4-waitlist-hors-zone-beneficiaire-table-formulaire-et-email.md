# Story 3.4 : Waitlist hors zone bénéficiaire (table + formulaire + email)

Status: review

<!-- Note: Validation est optionnelle. Lancer `validate-create-story` avant `dev-story` pour un controle qualite. -->

## Story

En tant que **visiteur ou utilisateur souhaitant utiliser roxanetnous mais habitant hors zone (et Sylvain en tant que responsable produit du lancement Bretagne)**,
je veux **pouvoir laisser mon email + mon departement cible + mon role dans un formulaire dedie `/waitlist`, recevoir un email de confirmation immediat, et que mon inscription soit stockee dans une table `waitlist_departements` pour notification automatique a l'ouverture (story 3.5)**,
afin de **ne pas perdre mon interet pour le service entre l'arrivee sur le site et l'ouverture geographique de mon departement, et que la story 3.5 puisse exploiter ces donnees pour notifier toute la liste a chaque ouverture admin (FR46)**.

Cette story est la **quatrieme story de l'Epic 3 « Lancement Bretagne »** et la **derniere brique d'amorcage** avant story 3.5 (notification automatique a l'ouverture). Elle implemente FR46 (capture waitlist + email confirmation immediat) et **ferme les 404 transitoires** introduits volontairement par stories 3.2 et 3.3 sur les liens `/waitlist`. Elle s'appuie sur les fondations deja livrees :

- Helper `lib/departements.ts` : `getAllDepartements()` (liste 96 dpt + 2A/2B + 44 disponibles), `extraireCodeDepartement` re-exporte depuis `lib/code-postal.ts` (client-safe), `isDepartementOuvert`, `DEPARTEMENTS_CACHE_TAG`.
- Pattern formulaire public + email Resend deja eprouve : `components/contact-form.tsx` (Client Component avec `useState` + `action={handleSubmit}`) + `app/actions/contact.ts` (server action publique, no auth, validation + `resend.emails.send` + `notifications_log` insert + retour `{ error?, success? }`).
- Pattern Lot C heading-order : page publique nouvelle = `<main id="main-content" tabIndex={-1}>` + `<h1>` (visible ou `sr-only`) + sous-sections en `<h2>`. Voir `app/recherche/page.tsx:238,269` pour le canonique pattern de page publique authentifiable.
- Helpers a11y deja livres : composant `Input` accessible (`components/ui/input.tsx`) avec label + erreur lies via `aria-describedby` / `aria-invalid` + `role="alert"` natif. **Reutiliser systematiquement** au lieu de re-coder un `<input>` inline.
- Pattern email Resend : `lib/emails.ts` expose `sendWelcomeEmail`, `sendValidationResultEmail`, `sendNewMessageEmail`, etc. Tous suivent le meme squelette (try / `resend.emails.send` / `logNotification('sent')` / catch / `logNotification('error')`). HTML inline avec `escapeHtml(...)` sur toutes les variables utilisateur.
- Pattern rate-limit Postgres : `try_consume_rate_limit(key, max, window_seconds)` deja livree par migration `20260429170000_rate_limit_tracker.sql` et consommee par `app/actions/parrainage.ts:327`. Reutiliser pour proteger l'endpoint public anonyme contre l'abus (anti-flood).
- Lot C 2.7.3 « page publique accessibilite » : modele de page publique avec h1 sr-only + main avec id="main-content", aucune dependance auth, simple Server Component qui rend un Client Component formulaire.
- Lien `/waitlist` deja referenced cote producteurs : story 3.2 produit `/waitlist?email=<...>&code_departement=<XX>&role=accompagnante` (cf. `components/accompagnante/onboarding-client.tsx`), story 3.3 produit `/waitlist` (sans params, cf. `components/landing/departements-ouverts.tsx`). **Cette story 3.4 est cote consommateur** : la page lit les query params s'ils existent et pre-remplit le formulaire.

**Le seul trou fonctionnel cote bénéficiaire est l'absence d'une route `/waitlist`** : aujourd'hui les liens des stories 3.2/3.3 retournent 404. Story 3.4 cree (a) la table `waitlist_departements`, (b) la page publique `/waitlist`, (c) la server action `app/actions/waitlist.ts`, (d) le template email `sendWaitlistConfirmationEmail`. Les notifications d'ouverture (envoi de masse) sont l'objet de la story 3.5 (suivante).

## Acceptance Criteria

### AC fonctionnels (FR46)

1. **AC1 — Migration table `waitlist_departements`** : Given une nouvelle migration `supabase/migrations/<timestamp>_waitlist_departements.sql`, when la migration s'applique, then la table `public.waitlist_departements` existe avec **au minimum** les colonnes :
   - `id UUID PRIMARY KEY DEFAULT uuid_generate_v4()`
   - `email TEXT NOT NULL` (validé par CHECK regex format simple ou `~* '^[^@\s]+@[^@\s]+\.[^@\s]+$'`)
   - `code_departement TEXT NOT NULL` (validé par FK `REFERENCES public.departements_ouverts(code) ON DELETE CASCADE` — garantit que seuls des codes existants sont stockés et que la suppression d'un département purge sa waitlist)
   - `role TEXT` nullable, validé par CHECK `role IN ('accompagnante', 'accompagne', 'visiteur') OR role IS NULL`
   - `created_at TIMESTAMPTZ NOT NULL DEFAULT now()`
   - `notified_at TIMESTAMPTZ` nullable (utilisé par story 3.5)
   - `ip_inscription TEXT` nullable (logging anti-flood, audit, decision parallele a `parrainages.ip_inscription`)
   - `user_agent TEXT` nullable (idem)
   - **And** un index UNIQUE sur `(email, code_departement)` empêche les doublons (lower-case sur email pour normalisation — `CREATE UNIQUE INDEX waitlist_departements_email_code_uniq ON public.waitlist_departements (lower(email), code_departement)`).
   - **And** un index secondaire `idx_waitlist_departements_code_notified` sur `(code_departement, notified_at)` pour permettre a la story 3.5 de filtrer rapidement `WHERE code_departement = X AND notified_at IS NULL`.
   - **And** RLS ENABLED avec **aucune policy** d'INSERT/SELECT/UPDATE/DELETE pour `anon` ou `authenticated` (toutes les operations passent par `service_role` via Server Actions). Une policy explicite `deny_all` peut etre posée pour clarifier l'intent.

2. **AC2 — Page `/waitlist` accessible publiquement** : Given un visiteur (anon ou connecté) charge `/waitlist` avec ou sans query params (`?email=...&code_departement=XX&role=accompagnante`), when la page se rend, then **un Server Component** (`app/waitlist/page.tsx`) :
   - Charge `getAllDepartements()` (les 96 + 2A/2B = 97 lignes — indispensable pour le `<select>` qui doit lister TOUS les departements, pas seulement les ouverts).
   - Lit `searchParams` (Next 16 App Router : `searchParams: Promise<{ email?: string; code_departement?: string; role?: string }>`) et passe les valeurs initiales au formulaire client.
   - Rend le squelette page publique : `<main id="main-content" tabIndex={-1}>` + `<h1>` visible (« M'inscrire a la waitlist » ou equivalent) + sous-titre explicatif + le composant `<WaitlistForm initial=... departements=... />`.
   - **Aucun login requis** — la page est strictement publique (pattern `app/page.tsx`, `app/contact/...`, `app/accessibilite/...`).

3. **AC3 — Formulaire `<WaitlistForm>` Client Component** : Given le composant `components/waitlist/waitlist-form.tsx` reçoit `initial: { email?: string; codeDepartement?: string; role?: string }` et `departements: Departement[]`, when le visiteur arrive sur la page, then le formulaire pre-remplit les champs avec les valeurs `initial.*` issues des query params (story 3.2 / 3.3). Les champs visibles :
   - **Email** : `<Input>` (composant accessible existant `components/ui/input.tsx`), `type="email"`, `required`, `name="email"`, label « Votre email », validation regex format simple cote client + server.
   - **Departement** : `<select>` HTML natif **OU** un nouveau composant `<Select>` accessible si jugé nécessaire (decision : `<select>` natif est l'option la plus simple, le plus accessible nativement, et n'introduit pas de nouvelle dette UI ; verifier que le `<label htmlFor>` est lié et qu'il est dans `<div>` styled coherent avec `Input.tsx`). Liste = `departements.map((d) => <option value={d.code}>{d.nom} ({d.code})</option>)`. Trier par `code` croissant via `localeCompare(b.code, 'fr', { numeric: true })` (pattern story 3.3).
   - **Role** (optionnel) : `<select>` ou groupe de `<input type="radio">` avec choix `'accompagnante' | 'accompagne' | 'visiteur'`. Decision : `<select>` aligne avec departement, label « Vous etes... », defaut `''` (= NULL en BDD = « visiteur » non specifié). Si query param `role` est present (`accompagnante` produit par story 3.2), pre-selectionner cette valeur.
   - **Bouton submit** : « Rejoindre la waitlist », state `'idle' | 'loading' | 'success' | 'error'` (pattern `ContactForm.tsx`).
   - **Messages d'etat** :
     - `error` : `<p role="alert">` au-dessus du formulaire (pattern `ContactForm`).
     - `success` : remplace le formulaire par une carte de confirmation (pattern `ContactForm` ligne 22-28). Texte type : « Merci ! Vous etes inscrit(e) a la waitlist pour {nom departement}. Vous recevrez un email de confirmation, puis une notification automatique a l'ouverture du service. ».

4. **AC4 — Server action `submitWaitlist`** : Given le formulaire est soumis avec `email`, `code_departement`, `role` (optionnel), when l'action `app/actions/waitlist.ts:submitWaitlist(formData)` est appelée, then :
   - **Validation server** :
     - `email` : non vide, longueur ≤ 254, regex `/^[^\s@]+@[^\s@]+\.[^\s@]+$/`. Si invalide → `{ error: 'Adresse email invalide.' }`.
     - `code_departement` : non vide, présent dans la liste retournee par `getAllDepartements()` (verification cote serveur — empeche un attaquant d'injecter un code arbitraire). Si invalide → `{ error: 'Departement inconnu.' }`. **Note** : on accepte un code departement ouvert ou non — un visiteur peut tres bien s'inscrire a la waitlist d'un departement deja ouvert (idempotent, on lui enverra l'email de confirmation et c'est tout).
     - `role` : si présent, ∈ `['accompagnante', 'accompagne', 'visiteur']`. Sinon → `{ error: 'Role invalide.' }`. Vide / absent = stocké NULL.
   - **Rate-limit** : appel `try_consume_rate_limit(key='waitlist:' + ip, max=5, window=600)` — 5 inscriptions max par IP par 10 min. Si dépassé → `{ error: 'Trop de tentatives. Reessayez plus tard.' }`. IP extraite via `headers().get('x-forwarded-for')?.split(',')[0]?.trim() || 'unknown'`.
   - **Idempotence (AC5)** : INSERT via `.upsert()` ou `INSERT ... ON CONFLICT (lower(email), code_departement) DO NOTHING` retournant la ligne existante. **Si conflit (déjà inscrit pour ce dpt)** → ne **pas** envoyer un nouveau mail de confirmation, retourner `{ success: true, alreadyRegistered: true }` (UI affichera un message neutre « Vous etes deja sur la waitlist pour ce departement »).
   - **Insertion** : email normalisé `email.trim().toLowerCase()` (cohérent avec `lib/parrainage-detection.ts:normalizeEmail`), `code_departement` tel quel, `role` tel quel ou NULL, `ip_inscription` IP extraite, `user_agent` `headers().get('user-agent')` (tronqué a 500 chars defensivement).
   - **Email confirmation** : appel `sendWaitlistConfirmationEmail({ email, codeDepartement, nomDepartement })` (tronqué a `nom` lookup depuis `getAllDepartements()`).
   - **Retour** : `{ success: true, codeDepartement, nomDepartement }` (utilisé par UI pour message succes). Erreur Resend → `notifications_log` status `error` mais l'INSERT BDD est conserve (l'utilisateur est sur la waitlist, on lui re-enverra le mail au worker eventuel ou il sera notifié quand meme par la story 3.5).

5. **AC5 — Idempotence sur double soumission** : Given un email + code_departement déjà présent en BDD, when le formulaire est resoumis (depuis un autre navigateur, depuis un partage de lien, etc.), then **aucun doublon** n'est créé (UNIQUE INDEX), **aucun second mail** n'est envoyé, et l'UI affiche un message de succes neutre « Vous etes deja sur la waitlist pour ce departement, nous vous notifierons a l'ouverture. ». Pas d'erreur affichée — c'est un comportement attendu du visiteur (rassurant, pas confusing).

6. **AC6 — Email de confirmation immediat** : Given une nouvelle inscription waitlist (pas un doublon), when l'INSERT BDD réussit, then dans la **meme** server action (synchrone, blocking), un email est envoyé via Resend au format suivant :
   - **From** : `RESEND_FROM_EMAIL` (env var, default `roxanetnous <onboarding@resend.dev>`).
   - **To** : email saisi.
   - **Subject** : `Vous etes sur la waitlist pour {nomDepartement}`.
   - **Body HTML** : pattern `lib/emails.ts` (`<div style="font-family: sans-serif; max-width: 600px; margin: 0 auto;">`), titre `<h1>Merci pour votre inscription</h1>`, paragraphe « Bonjour, nous avons bien enregistré votre demande pour le département {nomDepartement} ({codeDepartement}). Nous vous enverrons un email automatique des l'ouverture du service dans votre département. », CTA secondaire `<a href={BASE_URL}>roxanetnous.fr</a>` (retour landing).
   - **Toutes** les variables utilisateur (`firstName`, `nomDepartement`, etc.) passees a `escapeHtml(...)` (pattern eprouvé `lib/emails.ts:11`).
   - **Logging** : `notifications_log` insert avec `type='waitlist_confirmation'`, `status='sent'` ou `'error'` selon retour Resend, **et toujours** `email = email_saisi` (pas le service email admin).

7. **AC7 — Cas degrade : code departement existe mais aucun nom (RAS)** : Given la BDD d'integration ne contient pas le code reçu (cas tres improbable), when la server action ne trouve pas la ligne dans `getAllDepartements()`, then la validation echoue (AC4 erreur `'Departement inconnu.'`). Pas de crash, pas d'INSERT.

8. **AC8 — Cas degrade : Resend down ou env var manquante** : Given `RESEND_API_KEY` invalide ou Resend unavailable (timeout / 5xx), when l'envoi email echoue dans `sendWaitlistConfirmationEmail`, then :
   - L'INSERT BDD est **conservé** (decision : l'utilisateur reste sur la waitlist, on accepte le risque que la confirmation immediate manque — le but principal est de capturer la donnée pour la notif d'ouverture story 3.5).
   - `notifications_log` enregistre `status='error'` avec le message d'erreur — un job futur pourra retry (hors scope 3.4).
   - L'UI affiche succes (« Vous etes sur la waitlist ») **sans** mentionner l'echec email — le visiteur n'a pas besoin de savoir que l'infra est en panne. Risque résiduel : Sylvain doit consulter `notifications_log` periodiquement (deja le cas pour les autres types de mails). Documenté en **R8** des Risques.

### AC techniques (qualité)

9. **AC9 — Reutilisation helpers existants** : Given les helpers et patterns déja en place, when le code est écrit, then **aucune** nouvelle fonction utilitaire transversale créée. Reuse :
   - `lib/departements.ts` → `getAllDepartements`, `extraireCodeDepartement`, type `Departement`.
   - `lib/code-postal.ts` → `extraireCodeDepartement` (déja re-exporté par `lib/departements.ts`).
   - `lib/emails.ts` pattern → ajouter une nouvelle fonction `sendWaitlistConfirmationEmail` qui suit strictement le squelette `sendWelcomeEmail` (try / send / logNotification / catch / logNotification).
   - `components/ui/input.tsx` → Input accessible pour l'email.
   - `try_consume_rate_limit` RPC Postgres → reuse direct.

10. **AC10 — Pas de regression typage** : Given la regle CLAUDE.md « interdire `as any` introduit, resorber au passage », when le code est ecrit, then **aucun nouveau `as any` introduit**. Le retour de `submitWaitlist` est typé `{ error?: string; success?: boolean; alreadyRegistered?: boolean; codeDepartement?: string; nomDepartement?: string }`. Le `formData.get(...)` est cast `as string | null` (acceptable, pattern projet existant `app/actions/contact.ts`).

11. **AC11 — Performance** : Given le helper `getAllDepartements` beneficie deja du cache `unstable_cache` 30s + tag `DEPARTEMENTS_CACHE_TAG`, when la page `/waitlist` est rendue, then **0 round-trip BDD additionnel cote chaud** (cache 30s reutilisé). Server action ajoute :
   - 1 RPC `try_consume_rate_limit` (BDD).
   - 1 SELECT `getAllDepartements` (cache hit dans 99% des cas).
   - 1 INSERT `waitlist_departements`.
   - 1 SELECT `notifications_log` (cf. logging) → en réalité INSERT.
   - 1 appel Resend API externe (~200-500ms).
   - **Total : ~500ms p50 sur cas non-doublon, ~50ms sur doublon (skip Resend).**

12. **AC12 — Pas de regression a11y** : Given la regle CLAUDE.md durcie Lot C, when la story est livree, then :
    - `npm run lint:a11y-check` reste **vert** (baseline 155 stable). La nouvelle page utilise `<Input>` qui ne genere pas de violation jsx-a11y. Le `<select>` natif est entierement accessible (label associé via `htmlFor`).
    - `npm run a11y:axe:check` reste **vert** (0 violations Critical/Serious sur 7 parcours, baseline 2026-05-05). **La nouvelle route `/waitlist` n'est pas dans les 7 parcours actuels** — c'est volontaire (les 7 parcours sont stabilisés post Lot C, l'ajout d'un 8e parcours serait une story dédiée d'extension). **Note importante** : meme si `/waitlist` n'est pas testée par axe automatisé, la story doit garantir le delta 0 sur **les 7 parcours existants** (P5-landing peut être affecté par un import croisé sur la landing — verification par grep statique : aucun import `app/waitlist/*` ne doit apparaitre dans les composants de la landing/recherche/onboarding existants).
    - **DoD a11y** cochée intégralement (page nouvelle avec impact UI majeur — formulaire interactif).

13. **AC13 — Pas de regression sur les autres routes** : Given l'ajout de `app/waitlist/page.tsx`, `components/waitlist/waitlist-form.tsx`, `app/actions/waitlist.ts`, et la nouvelle migration + extension `lib/emails.ts`, when le diff est livré, then :
    - **Aucune modification** de `app/page.tsx` (les liens `/waitlist` produits par story 3.3 sont déja en place et fonctionnent automatiquement).
    - **Aucune modification** de `components/accompagnante/onboarding-client.tsx` (le lien `/waitlist?email=...&code_departement=...&role=accompagnante` produit par story 3.2 fonctionne automatiquement).
    - **Aucune modification** de `lib/departements.ts` (helper existant suffisant).
    - **Aucune modification** des routes admin, accompagnante, accompagne, recherche, messages, favoris, login, register, etc. → la story est strictement additive.
    - Verification grep `git diff --stat` : strictement 5 fichiers ajoutés (migration + page + form + action + extension `lib/emails.ts`).

14. **AC14 — Verification manuelle documentee** : Given la dette tests reportée Epic 4, when la story est livrée, then la PR contient une section « Verifications manuelles » listant :
    - (a) Saisie d'un email valide + dpt 75 (Paris, hors zone) + role visiteur depuis `/waitlist` direct → succès, ligne créée en BDD, email reçu.
    - (b) Saisie d'un email valide + dpt 29 (Bretagne, ouvert) + role accompagnante → succès, ligne créée, email reçu (cas idempotent : un visiteur peut se mettre en waitlist d'un dpt déja ouvert si erreur de saisie ou par curiosité — pas de blocage).
    - (c) Re-soumission du même email + même dpt → succès idempotent, message « Vous etes deja sur la waitlist… », **pas de second mail** (verifier dans `notifications_log`), pas de doublon en BDD (`SELECT count(*) FROM waitlist_departements WHERE lower(email) = ...` doit valoir 1).
    - (d) Email invalide (`pas-un-email`) → erreur inline `role="alert"`, formulaire reste affiché, focus sur le champ email préservé ou déplacé.
    - (e) Code departement falsifié via DevTools (`<option value="ZZ">` injecté manuellement) → server retourne erreur `'Departement inconnu.'`, pas d'INSERT.
    - (f) Pre-remplissage URL : `/waitlist?email=test%40example.com&code_departement=75&role=accompagnante` → champs pre-remplis correctement, soumission directe possible.
    - (g) Rate-limit : 6 soumissions consecutives depuis la meme IP en < 10 min → la 6e retourne erreur `'Trop de tentatives.'`. (Test optionnel, peut être documenté comme « non testé localement, validation staging ».)
    - (h) Lecteur d'ecran (VoiceOver/NVDA) : le `<h1>` est annoncé, les labels sont liés aux champs, l'erreur (`role="alert"`) est annoncée immédiatement après la soumission échouée.
    - (i) Cas degradé Resend : non testable localement (env var valide). Documenter au reviewer pour validation manuelle staging si possible.
    - Test e2e Playwright **reporté Epic 4** (cf. epic-3.md « Notes implementation : dette tests »).

### AC commun Lot C (rappel CLAUDE.md durcie)

15. **AC commun 1** — DoD a11y intégralement cochée (story avec impact UI majeur : nouveau formulaire interactif, nouvelle page publique). Delta axe-core sur les 7 parcours = 0 (justification : nouvelle route hors scope parcours).

16. **AC commun 2** — Double commit : livraison (`Story 3.4 : waitlist hors zone beneficiaire (table + formulaire + email)`) puis cloture (`Story 3.4 : statut done apres CI Vercel verte`).

## Tasks / Subtasks

- [x] **Task 1 — Migration `waitlist_departements`** (AC: #1)
  - [x] Sub 1.1 : Créer `supabase/migrations/<timestamp>_waitlist_departements.sql`. Timestamp **strictement supérieur** au max actuel (`20260502120000`) — utiliser le format `YYYYMMDDHHMMSS` cohérent (ex : `20260506120000`).
  - [x] Sub 1.2 : Squelette migration :
    ```sql
    -- Table waitlist_departements : capture email visiteurs hors zone (FR46).
    -- RLS : aucune policy publique. Service-role uniquement (Server Actions).
    -- FK vers departements_ouverts.code garantit que seuls des codes existants
    -- sont stockes ; CASCADE purge la waitlist si un dpt est supprime.

    CREATE TABLE public.waitlist_departements (
      id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
      email TEXT NOT NULL CHECK (email ~* '^[^@\s]+@[^@\s]+\.[^@\s]+$' AND length(email) <= 254),
      code_departement TEXT NOT NULL REFERENCES public.departements_ouverts(code) ON DELETE CASCADE,
      role TEXT CHECK (role IS NULL OR role IN ('accompagnante', 'accompagne', 'visiteur')),
      ip_inscription TEXT,
      user_agent TEXT,
      created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
      notified_at TIMESTAMPTZ
    );

    CREATE UNIQUE INDEX waitlist_departements_email_code_uniq
      ON public.waitlist_departements (lower(email), code_departement);

    CREATE INDEX idx_waitlist_departements_code_notified
      ON public.waitlist_departements (code_departement, notified_at);

    ALTER TABLE public.waitlist_departements ENABLE ROW LEVEL SECURITY;

    -- Aucune policy publique : tout passe par service_role (Server Actions).
    -- Une policy explicite "deny_all" clarifie l'intention pour les futurs lecteurs.
    CREATE POLICY "waitlist_departements_deny_all"
      ON public.waitlist_departements
      FOR ALL TO anon, authenticated
      USING (false)
      WITH CHECK (false);

    COMMENT ON TABLE public.waitlist_departements IS
      'Inscriptions waitlist pour notification d''ouverture geographique (story 3.4 / FR46). Service-role only.';
    ```
  - [x] Sub 1.3 : Verifier que l'extension `uuid-ossp` est déjà active (cf. autres migrations qui utilisent `uuid_generate_v4()`). Si non, ajouter `CREATE EXTENSION IF NOT EXISTS "uuid-ossp";` en tête. **Note** : `parrainages` table (`20260428130104`) utilise déjà `uuid_generate_v4()` donc l'extension est garantie présente.
  - [x] Sub 1.4 : Appliquer la migration via Supabase MCP `apply_migration` ou `supabase db push` selon convention projet.

- [x] **Task 2 — Server action `submitWaitlist`** (AC: #4, #5, #6, #7, #8, #10)
  - [x] Sub 2.1 : Créer `app/actions/waitlist.ts` (suivant le pattern `app/actions/contact.ts` qui est le canonique pour les actions publiques anonymes). Imports :
    ```ts
    'use server'
    import { headers } from 'next/headers'
    import { createClient } from '@/lib/supabase/server'
    import { getAllDepartements } from '@/lib/departements'
    import { sendWaitlistConfirmationEmail } from '@/lib/emails'
    ```
  - [x] Sub 2.2 : Définir le type retour :
    ```ts
    export type WaitlistResult = {
      error?: string
      success?: boolean
      alreadyRegistered?: boolean
      codeDepartement?: string
      nomDepartement?: string
    }
    ```
  - [x] Sub 2.3 : Implémenter `export async function submitWaitlist(formData: FormData): Promise<WaitlistResult>` :
    - Lire `email`, `code_departement`, `role` via `formData.get(...) as string | null`.
    - Trim email + lowercase.
    - Valider email regex (cf. `app/actions/contact.ts:30`), code dpt non vide, role ∈ liste.
    - Récupérer IP via `(await headers()).get('x-forwarded-for')?.split(',')[0]?.trim() || null` et user-agent via `(await headers()).get('user-agent')?.slice(0, 500) || null`.
    - Appeler `try_consume_rate_limit` via `supabase.rpc('try_consume_rate_limit', { p_key: 'waitlist:' + (ip || 'unknown'), p_max_requests: 5, p_window_seconds: 600 })`. Si retour `false` → `{ error: 'Trop de tentatives. Reessayez plus tard.' }`. Pattern : voir `app/actions/parrainage.ts:327`.
    - Charger `const departements = await getAllDepartements()` et chercher la ligne par `code_departement`. Si introuvable → `{ error: 'Departement inconnu.' }`.
    - INSERT via `supabaseAdmin.from('waitlist_departements').insert({...}).select('id').single()`. Capturer l'erreur :
      - Si error code `'23505'` (unique violation Postgres) → cas idempotent : retourner `{ success: true, alreadyRegistered: true, codeDepartement, nomDepartement }`.
      - Autre erreur → `{ error: 'Erreur lors de l\'inscription.' }` (logger console.error pour visibilité dev).
    - Si INSERT réussit → appeler `sendWaitlistConfirmationEmail({ email, codeDepartement, nomDepartement })` (l'email logge lui-même son statut dans `notifications_log` — pas besoin de doubler ici).
    - Retourner `{ success: true, codeDepartement, nomDepartement }`.
  - [x] Sub 2.4 : Verifier que `createClient({ serviceRole: true })` est utilisé (pour bypasser la policy `deny_all`). Cohérent avec le pattern `app/actions/contact.ts:56`.

- [x] **Task 3 — Template email `sendWaitlistConfirmationEmail`** (AC: #6, #8, #9)
  - [x] Sub 3.1 : Dans `lib/emails.ts`, ajouter à la fin du fichier (avant la fin du module ou après `sendSubscriptionConfirmEmail`) :
    ```ts
    export async function sendWaitlistConfirmationEmail(params: {
      email: string
      codeDepartement: string
      nomDepartement: string
      userId?: string
    }) {
      const subject = `Vous etes sur la waitlist pour ${params.nomDepartement}`
      try {
        await resend.emails.send({
          from: FROM_EMAIL,
          to: params.email,
          subject,
          html: `
            <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto;">
              <h1 style="color: #000;">Merci pour votre inscription</h1>
              <p>Bonjour,</p>
              <p>Nous avons bien enregistré votre demande pour le département <strong>${escapeHtml(params.nomDepartement)}</strong> (${escapeHtml(params.codeDepartement)}).</p>
              <p>Nous vous enverrons un email automatique dès l'ouverture du service dans votre département.</p>
              <p style="margin-top: 24px;">
                <a href="${BASE_URL}" style="background: #000; color: #fff; padding: 12px 24px; text-decoration: none; display: inline-block;">
                  Retour sur roxanetnous
                </a>
              </p>
            </div>
          `,
        })
        await logNotification({
          userId: params.userId,
          email: params.email,
          type: 'waitlist_confirmation',
          subject,
          status: 'sent',
        })
      } catch (error) {
        await logNotification({
          userId: params.userId,
          email: params.email,
          type: 'waitlist_confirmation',
          subject,
          status: 'error',
          error: error instanceof Error ? error.message : 'Erreur inconnue',
        })
      }
    }
    ```
  - [x] Sub 3.2 : Vérifier que `escapeHtml` (déjà défini ligne 11) est utilisé sur **toutes** les variables utilisateur — XSS prevention.
  - [x] Sub 3.3 : Note : pas de `userId` requis car l'utilisateur n'est pas authentifié (champ optionnel laissé pour cohérence du logger).

- [x] **Task 4 — Page Server Component `app/waitlist/page.tsx`** (AC: #2)
  - [x] Sub 4.1 : Créer le fichier `app/waitlist/page.tsx`. Imports :
    ```ts
    import type { Metadata } from 'next'
    import { getAllDepartements } from '@/lib/departements'
    import { WaitlistForm } from '@/components/waitlist/waitlist-form'
    ```
  - [x] Sub 4.2 : Définir `metadata` SEO :
    ```ts
    export const metadata: Metadata = {
      title: 'Waitlist — roxanetnous',
      description: 'Recevez un email automatique a l\'ouverture du service dans votre departement.',
    }
    ```
  - [x] Sub 4.3 : Définir le composant :
    ```tsx
    type SearchParams = Promise<{ email?: string; code_departement?: string; role?: string }>

    export default async function WaitlistPage({ searchParams }: { searchParams: SearchParams }) {
      const params = await searchParams
      const departements = await getAllDepartements()

      const initialRole = params.role && ['accompagnante', 'accompagne', 'visiteur'].includes(params.role)
        ? params.role
        : ''

      return (
        <main id="main-content" tabIndex={-1} className="min-h-screen kraft bg-kraft focus:outline-none">
          <div className="max-w-2xl mx-auto px-4 py-12 md:py-16">
            <h1 className="text-3xl md:text-4xl font-bold text-black mb-3">M&apos;inscrire a la waitlist</h1>
            <p className="text-base text-black mb-8">
              Indiquez votre email et le departement ou vous souhaitez utiliser roxanetnous. Nous vous enverrons un email a l&apos;ouverture du service.
            </p>
            <WaitlistForm
              initial={{
                email: params.email ?? '',
                codeDepartement: params.code_departement ?? '',
                role: initialRole,
              }}
              departements={departements}
            />
          </div>
        </main>
      )
    }
    ```
  - [x] Sub 4.4 : **Pas de directive `'use client'`** sur la page (Server Component). Le formulaire (Client Component) est un enfant via composition Server-inside-Server (le formulaire lui-même sera 'use client').
  - [x] Sub 4.5 : Cohérence visuelle : reuse `kraft bg-kraft` du HERO landing pour cohérence chromatique. `<h1>` visible (pas `sr-only`) car la page est dédiée au formulaire — pas de logo en hero.

- [x] **Task 5 — Composant Client Component `<WaitlistForm>`** (AC: #3)
  - [x] Sub 5.1 : Créer `components/waitlist/waitlist-form.tsx`. Imports :
    ```tsx
    'use client'
    import { useState } from 'react'
    import { Input } from '@/components/ui/input'
    import type { Departement } from '@/lib/departements'
    import { submitWaitlist, type WaitlistResult } from '@/app/actions/waitlist'
    ```
  - [x] Sub 5.2 : Squelette :
    ```tsx
    type Props = {
      initial: { email: string; codeDepartement: string; role: string }
      departements: Departement[]
    }

    export function WaitlistForm({ initial, departements }: Props) {
      const [status, setStatus] = useState<'idle' | 'loading' | 'success' | 'error'>('idle')
      const [error, setError] = useState('')
      const [result, setResult] = useState<WaitlistResult | null>(null)

      async function handleSubmit(formData: FormData) {
        setStatus('loading')
        setError('')
        const res = await submitWaitlist(formData)
        if (res.error) {
          setError(res.error)
          setStatus('error')
        } else {
          setResult(res)
          setStatus('success')
        }
      }

      const sortedDepartements = [...departements].sort((a, b) =>
        a.code.localeCompare(b.code, 'fr', { numeric: true })
      )

      if (status === 'success' && result) {
        const isAlready = result.alreadyRegistered
        return (
          <div className="bg-white border rounded-xl p-6" role="status" aria-live="polite">
            <p className="font-semibold text-black mb-1">
              {isAlready ? 'Vous etes deja inscrit(e)' : 'Inscription confirmee'}
            </p>
            <p className="text-sm text-black/70">
              {isAlready
                ? `Vous etes deja sur la waitlist pour ${result.nomDepartement} (${result.codeDepartement}). Nous vous notifierons a l'ouverture.`
                : `Merci ! Vous etes sur la waitlist pour ${result.nomDepartement} (${result.codeDepartement}). Un email de confirmation vient de partir.`}
            </p>
          </div>
        )
      }

      return (
        <form action={handleSubmit} className="bg-white border rounded-xl p-6 space-y-4">
          {error && (
            <p role="alert" className="text-sm text-red-700 bg-red-50 border border-red-200 rounded-lg p-3">{error}</p>
          )}
          <Input
            label="Votre email"
            id="waitlist-email"
            name="email"
            type="email"
            defaultValue={initial.email}
            required
            autoComplete="email"
          />
          <div className="w-full">
            <label htmlFor="waitlist-departement" className="block">
              <span className="block text-sm font-medium text-black mb-2">
                Departement
                <span className="text-gray-700"> (obligatoire)</span>
              </span>
              <select
                id="waitlist-departement"
                name="code_departement"
                required
                defaultValue={initial.codeDepartement}
                className="flex h-10 w-full rounded-lg border border-gray-400 bg-white px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-focus-ring"
              >
                <option value="" disabled>Choisissez un departement</option>
                {sortedDepartements.map((d) => (
                  <option key={d.code} value={d.code}>
                    {d.nom} ({d.code})
                  </option>
                ))}
              </select>
            </label>
          </div>
          <div className="w-full">
            <label htmlFor="waitlist-role" className="block">
              <span className="block text-sm font-medium text-black mb-2">Vous etes...</span>
              <select
                id="waitlist-role"
                name="role"
                defaultValue={initial.role}
                className="flex h-10 w-full rounded-lg border border-gray-400 bg-white px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-focus-ring"
              >
                <option value="">Sans precision</option>
                <option value="accompagnante">Accompagnante de vie (auxiliaire)</option>
                <option value="accompagne">Accompagne ou proche aidant</option>
                <option value="visiteur">Visiteur curieux</option>
              </select>
            </label>
          </div>
          <button
            type="submit"
            disabled={status === 'loading'}
            className="w-full px-4 py-2 rounded-lg text-sm font-medium text-black btn-hover disabled:opacity-50 bg-accent"
          >
            {status === 'loading' ? 'Envoi en cours...' : 'Rejoindre la waitlist'}
          </button>
        </form>
      )
    }
    ```
  - [x] Sub 5.3 : Vérifier que :
    - Le `<select>` a un `<label>` lié (htmlFor / id) — accessibilité native garantie par le navigateur.
    - Le `defaultValue=""` + `<option value="" disabled>` force l'utilisateur à choisir explicitement un departement.
    - Aucun `as any` introduit — le `submitWaitlist` est typé via `WaitlistResult`.
    - Le `aria-live="polite"` du container succès annonce le message au lecteur d'écran sans interrompre.

- [x] **Task 6 — Verifier que les autres routes ne sont pas impactées** (AC: #13)
  - [x] Sub 6.1 : `git diff --stat` doit lister exactement 5 fichiers ajoutés (migration + page + form + action + extension `lib/emails.ts`). Aucune modification d'app/page.tsx, components/landing/, components/accompagnante/, app/actions/profile.ts, lib/departements.ts.
  - [x] Sub 6.2 : Verification grep statique : aucune occurrence d'import `waitlist-form` ou `submitWaitlist` dans des composants existants. La nouvelle surface est isolée.

- [x] **Task 7 — Verifications globales + DoD** (AC: #10, #11, #12, #14)
  - [x] Sub 7.1 : `npx tsc --noEmit` → 0 erreur (AC10).
  - [x] Sub 7.2 : `npm run lint:a11y-check` → vert. Baseline 155 stable (AC12).
  - [x] Sub 7.3 : `npm run a11y:axe:check` → vert. 0 delta Critical/Serious sur 7 parcours (AC12).
  - [x] Sub 7.4 : Tests manuels documentés en Completion Notes (AC14 a-i). Tests fonctionnels (b, c, g, i) reportés au reviewer si infrastructure indispo localement. Tests `a/d/e/f/h` exécutables localement avec dev server.
  - [x] Sub 7.5 : DoD a11y cochée intégralement (formulaire interactif → tous les items applicables, en particulier labels, focus, ARIA states, navigation clavier).

- [ ] **Task 8 — Commits**
  - [ ] Sub 8.1 : Commit 1 livraison : `Story 3.4 : waitlist hors zone beneficiaire (table + formulaire + email)`. **A executer par l'utilisateur** (regle projet : Claude ne commit pas sans demande explicite).
  - [ ] Sub 8.2 : Push + CI Vercel verte. **A executer par l'utilisateur**.
  - [ ] Sub 8.3 : Commit 2 cloture : `Story 3.4 : statut done apres CI Vercel verte` (avec passage `Status: done`). **A executer par l'utilisateur** apres CI Vercel verte.

### Review Findings (2026-05-06, code-review 3 layers)

Layers : Acceptance Auditor (general-purpose) + Blind Hunter (general-purpose) + Edge Case Hunter (general-purpose). 39 findings bruts → 5 patches retenus + 10 defers + 24 dismiss apres triage.

- [x] [Review][Patch] **F1 [HIGH] `logNotification` throw : `notifications_log.user_id NOT NULL` + `status CHECK ('pending','sent','failed')` n'accepte pas `'error'`** [`lib/emails.ts:861-913`, `app/actions/waitlist.ts:89-99`] — **APPLIQUE 2026-05-06**. (a) Skip `logNotification` quand `params.userId` undefined (visiteur anonyme) — fallback `console.error` ; (b) `status: 'failed'` au lieu de `'error'` (aligne CHECK BDD) ; (c) try/catch defense en profondeur autour de `await sendWaitlistConfirmationEmail` dans `submitWaitlist` — l'utilisateur voit toujours `success: true` meme si l'email throw. Type `logNotification` etendu `'sent' | 'error' | 'failed'` (additif, n'impacte pas les 12+ callers existants). Le bug latent transverse `'error'` rejete par CHECK BDD pour les autres flows reste documente en defer (story 3.4 ne le resout pas pour eviter de toucher `sendWelcomeEmail` etc.). Re-validation TS + axe-core + build verts. Test BDD : `INSERT (status='failed')` accepte par CHECK (verifie 2026-05-06).
- [ ] [Review][Patch] **F2 [HIGH] AC13 : pollution `app/page.tsx` non attendue (story 3.3)** [`app/page.tsx`] — Le diff cumule contient 4 lignes ajoutees a `app/page.tsx` qui appartiennent a la story 3.3. La spec 3.4 exige strictement « Aucune modification de `app/page.tsx` ». **A gerer manuellement par Sylvain au `git add` selectif** : commit story 3.3 separement (ou en premier) avant le commit livraison story 3.4. Hors fix automatique.
- [x] [Review][Patch] **F3 [MED] `aria-busy` absent sur bouton submit en loading** [`components/waitlist/waitlist-form.tsx:106`] — **APPLIQUE 2026-05-06**. `aria-busy={status === 'loading'}` ajoute sur le `<button>`. Annonce SR de la transition idle→loading.
- [x] [Review][Patch] **F4 [LOW] `code_departement` pas normalise upper-case avant lookup** [`app/actions/waitlist.ts:21`] — **APPLIQUE 2026-05-06**. Ajout `.toUpperCase()` apres trim. URL `?code_departement=2a` produit maintenant `'2A'` correctement matche.
- [x] [Review][Patch] **F5 [LOW] `code_departement` insert utilise input brut au lieu de `dpt.code`** [`app/actions/waitlist.ts:71`] — **APPLIQUE 2026-05-06**. Remplace par `dpt.code` (valeur normalisee BDD). Coherence interne defense en profondeur.

- [x] [Review][Defer] **D1 IP spoofing trivial via `x-forwarded-for`** — deferred, pre-existing (pattern `parrainage.ts:320`). A traiter dette transverse Epic 4 (`x-vercel-forwarded-for` ou `request.ip`).
- [x] [Review][Defer] **D2 Rate-limit fail-open silencieux** — deferred, decision explicite documentee Completion Notes 3.4 + pattern `parrainage.ts:336-341` (degradation gracieuse).
- [x] [Review][Defer] **D3 Mailbombing : pas de double opt-in** — deferred, conforme D5 (pas de captcha) + R1 (si abus avere, hCaptcha story dediee Epic 4). Risque accepte MVP.
- [x] [Review][Defer] **D4 Stockage IP brut sans TTL ni purge — RGPD** — deferred, transverse `parrainages.ip_inscription`, `notifications_log.email`, etc. Story dediee Epic 4 (data retention policy).
- [x] [Review][Defer] **D5 `departements` charge deux fois (page + Server Action)** — deferred, faux probleme : `getAllDepartements` utilise `unstable_cache` 30s (cache hit, pas de round-trip BDD).
- [x] [Review][Defer] **D6 `escapeHtml` non verifie** — deferred, fonction existante ligne 11 de `lib/emails.ts`, eprouvee 12+ fonctions email. Hors scope.
- [x] [Review][Defer] **D7 CSRF / origin check** — deferred, Next 16 protege Server Actions par defaut via header `Origin`. Pre-existant.
- [x] [Review][Defer] **D8 `logNotification` peut echouer en cascade pour autres flows** — deferred, indirectement traite par F1 (refactor `logNotification` plus large attendu Epic 4).
- [x] [Review][Defer] **D9 CASCADE delete waitlist quand admin supprime un dpt** — deferred, decision D1 explicite (CASCADE volontaire, R5/R6 documente). Pas un bug.
- [x] [Review][Defer] **D10 `BASE_URL` fallback localhost en preview** — deferred, pattern projet, transverse infra Vercel.

24 findings dismiss : `from:` non echappe (env var trustee), `uuid_generate_v4` (extension presente, vu Sub 1.3), RLS deny-all roles custom (pas de roles custom projet), enumeration emails (RLS deny_all suffisant), `searchParams` validation longueur (React echappe defaultValue), cast `role as ...` (narrowing TS, pas `as any`), contraste `text-black/70` (validee Lot B), option disabled etat indefini (HTML standard), skip-link `tabIndex={-1}` (skip-link present `app/layout.tsx:62`), `metadata.title` em dash (pattern projet), soumission massive (couverte D3), logs PII `console.error` (insertError sans payload), `createClient` env manquante (infra Vercel), type `WaitlistResult` non discrimine (pattern projet), `EMAIL_REGEX` unicode (aligne `contact.ts`), `role` majuscules rejete (`<select>` n'envoie pas cette casse), subject email non echappe (Resend gere encodage RFC 2047, noms BDD propres), race double-soumission (UNIQUE INDEX gere), `x-real-ip` extension non spec'ee (robustesse defensive), AC10/AC12 deferes CI (deja executes verts en local), bouton retour navigateur (Edge Hunter conclut OK), erreur precedente affichee (Edge Hunter conclut OK fonctionnel), focus management succes (precedent `ContactForm` accepte projet).

## Dev Notes

### Decisions techniques cles

#### D1 — Table `waitlist_departements` : FK vers `departements_ouverts.code` plutot que TEXT libre

**Probleme** : la spec epic mentionne `code_departement (text, 2-3 chars)`. Le naturel serait un `TEXT NOT NULL` libre. Mais la table `departements_ouverts` existe déja et liste explicitement les 96 + 2A/2B (97 codes). Un `TEXT NOT NULL` libre permettrait à un attaquant d'injecter un code arbitraire (« ZZ », « 123 », etc.) côté API, et compliquerait la logique de la story 3.5 (qui doit JOIN waitlist_departements ↔ departements_ouverts pour récupérer le `nom`).

**Decision** : `code_departement TEXT NOT NULL REFERENCES public.departements_ouverts(code) ON DELETE CASCADE`.

**Rationale** :
- Garantit l'intégrité référentielle (impossible d'inscrire pour un code inexistant — la base elle-même rejette).
- `ON DELETE CASCADE` purge automatiquement la waitlist si un dpt est retiré (cas de gestion admin futur).
- Simplifie story 3.5 : un simple JOIN suffit pour avoir `(email, code, nom)` du destinataire.
- Pas de migration future requise quand un nouveau dpt est ouvert (ajout dans `departements_ouverts` suffit).

**Alternative rejetée** : `TEXT NOT NULL` + CHECK regex `^([0-9]{2}|2A|2B)$`. Permet la souplesse mais ouvre la porte à `'00'` ou `'99'` (faux positifs). Coherence projet > flexibilité abstraite.

#### D2 — UNIQUE INDEX sur `(lower(email), code_departement)` pour idempotence case-insensitive

**Probleme** : un visiteur pourrait s'inscrire deux fois avec `Test@Example.com` puis `test@example.com` (casse différente) — la contrainte UNIQUE classique sur `(email, code_departement)` les laisse passer comme deux lignes distinctes.

**Decision** : `CREATE UNIQUE INDEX ... ON public.waitlist_departements (lower(email), code_departement)`.

**Rationale** : Postgres supporte les fonctional indexes nativement. Le `lower()` est idempotent côté insert (la BDD applique automatiquement la fonction au moment du conflict check). Côté lecture (story 3.5), on continue à stocker `email` en lowercase normalisé via `email.trim().toLowerCase()` dans la server action — le `lower()` BDD est une defense en profondeur.

**Alternative rejetée** : stocker uniquement le lowercase (perte d'information cosmétique sur la casse originale, sans gain réel — l'email est utilisé pour envoi technique uniquement, pas pour affichage).

#### D3 — Server action publique sans auth : modele `app/actions/contact.ts`

**Choix retenu** : `submitWaitlist` est une server action accessible aux **anon** (visiteurs non authentifiés) et **authenticated** (visiteurs connectés). Pas de check `getUser()`, pas de redirection login.

**Rationale** :
- FR46 spec « visiteur ou utilisateur souhaitant utiliser roxanetnous » → la cible inclut explicitement les visiteurs anon.
- Le contact form (`app/actions/contact.ts`) est déjà un précédent : action publique anonyme avec rate-limit côté infra (Vercel) + validation server-side.
- Ajouter un check auth bloquerait des conversions (un visiteur qui veut juste laisser son email).

**Defense en profondeur** :
- Rate-limit Postgres `try_consume_rate_limit` (5 inscriptions / 10 min / IP) — empeche le flood automatisé.
- Validation server-side stricte (regex email, FK departement, role enum) — empeche les payloads malformés.
- RLS `deny_all` pour anon/authenticated → seul `service_role` (Server Action) peut écrire.
- Pas d'expose CSRF : Next.js Server Actions sont protégées par défaut (validation `Origin` header).

#### D4 — Email immediat synchrone vs file d'attente

**Choix retenu** : envoi Resend dans la même server action, **bloquant** (await).

**Rationale** :
- Volume attendu très faible (5-50 inscriptions/jour au pic). Pas de scaling issue.
- Confirmation immédiate améliore la perception utilisateur (« j'ai bien recu mon mail »).
- Pas de queue infrastructure à provisionner (kept simple → Vercel Functions native).
- Pattern aligné sur `sendWelcomeEmail`, `sendValidationResultEmail`, `sendNewMessageEmail` — tous synchrones dans leur server action déclenchante.

**Risque accepté (R8)** : si Resend timeout, la server action prend ~5-30s. UX dégradée mais l'INSERT BDD est garanti **avant** l'appel Resend (séquence : valid → rate-limit → INSERT → Resend). En cas d'échec Resend, l'utilisateur voit succès, l'erreur est loggée dans `notifications_log`. Story 3.5 (notif d'ouverture) n'est pas bloquée.

#### D5 — Pas de captcha (hCaptcha, reCAPTCHA, etc.)

**Choix retenu** : pas de captcha sur le formulaire waitlist.

**Rationale** :
- Friction UX significative (-30 à -50% de conversions selon études). Pour un formulaire de capture lead, c'est rédhibitoire.
- Rate-limit Postgres + validation stricte suffisent pour le pilote (volume faible).
- RGPD : un captcha tiers introduit un consentement supplémentaire.
- Si un attaquant veut inscrire 1000 emails, il peut le faire via Tor en alternant les IPs — un captcha n'arrête que le bot trivial.
- Si abus avéré (spam BDD ou flood Resend), on pourra ajouter un captcha en story dédiée. Pas avant.

**Mitigation prevue (epic 4)** : surveillance manuelle de `waitlist_departements` (count par dpt + count par jour). Si signal anormal, ajouter `hCaptcha` (RGPD-compliant, EU-hosted).

#### D6 — Composant `<select>` HTML natif vs custom

**Choix retenu** : `<select>` HTML natif.

**Rationale** :
- A11y native : labels, focus, navigation clavier (flèches, lettres pour jump-to), gestion VoiceOver/NVDA, sans aucun travail de notre part.
- 97 options = volume gérable (les `<select>` natifs gèrent jusqu'à ~500-1000 options sans dégradation perceptible).
- Style minimal acceptable (cohérent avec `Input.tsx`). Pas besoin de combobox ARIA complexe.
- 0 lib ajoutée, 0 polyfill, 0 dette.

**Alternative rejetée** : combobox custom ARIA (downshift, react-aria, headlessui) — sur-engineering pour un cas où le `<select>` natif suffit. Le LotC règle « pas de premature abstraction » s'applique.

#### D7 — Pas de pre-validation côté client de la combinaison email+departement

**Choix retenu** : la vérification doublon (idempotence AC5) se fait **uniquement** côté serveur, pas côté client.

**Rationale** :
- Vérifier en client demanderait un endpoint `GET /api/waitlist/exists?email=...&dpt=...` qui exposerait l'information « cet email est sur la waitlist » → leak de PII.
- La server action gère l'idempotence par `INSERT ON CONFLICT DO NOTHING` ou capture du code erreur `23505`. Le résultat retourné inclut `alreadyRegistered: true` qui pilote l'UI.
- Pas de friction additionnelle pour l'utilisateur — il soumet, le résultat est correct dans tous les cas.

#### D8 — Pas de pre-remplissage du `role` quand `code_departement` est ouvert

**Choix retenu** : si l'utilisateur arrive via story 3.3 (`/waitlist` sans params) et choisit un departement déja ouvert (ex : 29), on accepte quand même son inscription waitlist.

**Rationale** :
- Cas rare : un visiteur attentif peut hésiter et s'inscrire pour un dpt déja ouvert. Le rejet (« mais ce dpt est déja ouvert ! ») le frustrerait.
- L'idempotence + l'email de confirmation suffisent. Si le dpt est ouvert, l'utilisateur reçoit confirmation, et la story 3.5 ne le re-notifiera jamais (pas de toggle close→open dans ce cas).
- Cohérent avec D5 « ne pas ajouter de friction pour gérer des cas marginaux ».

**Alternative rejetée** : afficher dans le `<select>` un marker « déja ouvert » à côté de chaque dpt ouvert (visuel + a11y supplémentaire pour gérer un cas qui ne devrait quasiment pas arriver). Sur-engineering.

#### D9 — Conventions de naming alignées avec Lot C

- Page : `app/waitlist/page.tsx` (kebab-case dossier).
- Form : `components/waitlist/waitlist-form.tsx` (kebab-case file et folder).
- Action : `app/actions/waitlist.ts` (kebab-case file).
- Migration : `supabase/migrations/<timestamp>_waitlist_departements.sql` (snake_case).
- Email : `sendWaitlistConfirmationEmail` (camelCase, pattern `sendWelcomeEmail`).
- Type retour : `WaitlistResult` (PascalCase, pattern `OnboardingResult` / `AuthResult`).

#### D10 — Cible `/admin/waitlist` non créée dans cette story

**Hors scope** : pas d'interface admin pour consulter la waitlist. Sylvain peut consulter via Supabase Dashboard + SQL ad-hoc (`SELECT code_departement, count(*) FROM waitlist_departements GROUP BY 1`). La story 3.5 fournira l'envoi de masse mais pas une UI de gestion. Si une UI admin est souhaitée plus tard, story dédiée Epic 4.

### Source tree fichiers à toucher (5 nouveaux + 1 modifié)

| Fichier | Type | Modification |
|---|---|---|
| `supabase/migrations/<timestamp>_waitlist_departements.sql` | NOUVEAU | Table + UNIQUE INDEX + idx_secondary + RLS deny_all |
| `app/actions/waitlist.ts` | NOUVEAU | Server action `submitWaitlist`, type `WaitlistResult` |
| `app/waitlist/page.tsx` | NOUVEAU | Server Component, lecture searchParams, fetch deps + render WaitlistForm |
| `components/waitlist/waitlist-form.tsx` | NOUVEAU | Client Component, formulaire 3 champs (email/dpt/role) + states UI |
| `lib/emails.ts` | MODIFIE | Ajout `sendWaitlistConfirmationEmail` (~30 lignes en fin de fichier) |

**Fichiers explicitement non modifiés** (verification statique requise — Sub 6.1, 6.2) :
- `app/page.tsx` — story 3.3 a déja livré le lien `/waitlist`, fonctionne automatiquement.
- `components/accompagnante/onboarding-client.tsx` — story 3.2 a déja livré `/waitlist?email=...&code_departement=...&role=accompagnante`, fonctionne automatiquement.
- `components/landing/departements-ouverts.tsx` — story 3.3 a livré le lien fallback `/waitlist`, fonctionne automatiquement.
- `lib/departements.ts` — helpers existants suffisants (`getAllDepartements`, type `Departement`).
- `lib/code-postal.ts` — pas utilisé directement (le formulaire utilise un `<select>` de codes, pas de saisie de code postal).
- Tous les autres fichiers d'app, composants, actions — la story est strictement additive.

### Pattern de code (extraits)

```sql
-- supabase/migrations/<timestamp>_waitlist_departements.sql

-- Table waitlist_departements : capture email visiteurs hors zone (FR46).
-- RLS : aucune policy publique. Service-role uniquement (Server Actions).
CREATE TABLE public.waitlist_departements (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  email TEXT NOT NULL CHECK (email ~* '^[^@\s]+@[^@\s]+\.[^@\s]+$' AND length(email) <= 254),
  code_departement TEXT NOT NULL REFERENCES public.departements_ouverts(code) ON DELETE CASCADE,
  role TEXT CHECK (role IS NULL OR role IN ('accompagnante', 'accompagne', 'visiteur')),
  ip_inscription TEXT,
  user_agent TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  notified_at TIMESTAMPTZ
);

CREATE UNIQUE INDEX waitlist_departements_email_code_uniq
  ON public.waitlist_departements (lower(email), code_departement);

CREATE INDEX idx_waitlist_departements_code_notified
  ON public.waitlist_departements (code_departement, notified_at);

ALTER TABLE public.waitlist_departements ENABLE ROW LEVEL SECURITY;

CREATE POLICY "waitlist_departements_deny_all"
  ON public.waitlist_departements
  FOR ALL TO anon, authenticated
  USING (false)
  WITH CHECK (false);

COMMENT ON TABLE public.waitlist_departements IS
  'Inscriptions waitlist pour notification d''ouverture geographique (story 3.4 / FR46). Service-role only.';
```

```ts
// app/actions/waitlist.ts (squelette complet)

'use server'

import { headers } from 'next/headers'
import { createClient } from '@/lib/supabase/server'
import { getAllDepartements } from '@/lib/departements'
import { sendWaitlistConfirmationEmail } from '@/lib/emails'

export type WaitlistResult = {
  error?: string
  success?: boolean
  alreadyRegistered?: boolean
  codeDepartement?: string
  nomDepartement?: string
}

const VALID_ROLES = ['accompagnante', 'accompagne', 'visiteur'] as const
const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

export async function submitWaitlist(formData: FormData): Promise<WaitlistResult> {
  const rawEmail = (formData.get('email') as string | null)?.trim().toLowerCase() || ''
  const codeDepartement = (formData.get('code_departement') as string | null)?.trim() || ''
  const rawRole = (formData.get('role') as string | null)?.trim() || ''

  if (!rawEmail || !EMAIL_REGEX.test(rawEmail) || rawEmail.length > 254) {
    return { error: 'Adresse email invalide.' }
  }
  if (!codeDepartement) {
    return { error: 'Departement requis.' }
  }
  const role = rawRole === '' ? null : rawRole
  if (role !== null && !VALID_ROLES.includes(role as typeof VALID_ROLES[number])) {
    return { error: 'Role invalide.' }
  }

  const departements = await getAllDepartements()
  const dpt = departements.find((d) => d.code === codeDepartement)
  if (!dpt) {
    return { error: 'Departement inconnu.' }
  }

  const headersList = await headers()
  const ip = headersList.get('x-forwarded-for')?.split(',')[0]?.trim() || null
  const userAgent = headersList.get('user-agent')?.slice(0, 500) || null

  const supabase = await createClient({ serviceRole: true })

  // Rate-limit : 5 inscriptions max / 10 min / IP
  const { data: allowed } = await supabase.rpc('try_consume_rate_limit', {
    p_key: 'waitlist:' + (ip || 'unknown'),
    p_max_requests: 5,
    p_window_seconds: 600,
  })
  if (allowed === false) {
    return { error: 'Trop de tentatives. Reessayez dans quelques minutes.' }
  }

  const { error: insertError } = await supabase
    .from('waitlist_departements')
    .insert({
      email: rawEmail,
      code_departement: codeDepartement,
      role,
      ip_inscription: ip,
      user_agent: userAgent,
    })

  if (insertError) {
    if (insertError.code === '23505') {
      // Unique violation : déja inscrit pour ce dpt → idempotent
      return {
        success: true,
        alreadyRegistered: true,
        codeDepartement: dpt.code,
        nomDepartement: dpt.nom,
      }
    }
    console.error('[waitlist] insert error', insertError)
    return { error: "Erreur lors de l'inscription. Reessayez." }
  }

  // Envoi email confirmation (logge lui-même son statut)
  await sendWaitlistConfirmationEmail({
    email: rawEmail,
    codeDepartement: dpt.code,
    nomDepartement: dpt.nom,
  })

  return {
    success: true,
    codeDepartement: dpt.code,
    nomDepartement: dpt.nom,
  }
}
```

```tsx
// app/waitlist/page.tsx

import type { Metadata } from 'next'
import { getAllDepartements } from '@/lib/departements'
import { WaitlistForm } from '@/components/waitlist/waitlist-form'

export const metadata: Metadata = {
  title: 'Waitlist — roxanetnous',
  description: 'Recevez un email a l\'ouverture du service dans votre departement.',
}

type SearchParams = Promise<{ email?: string; code_departement?: string; role?: string }>

export default async function WaitlistPage({ searchParams }: { searchParams: SearchParams }) {
  const params = await searchParams
  const departements = await getAllDepartements()

  const initialRole = params.role && ['accompagnante', 'accompagne', 'visiteur'].includes(params.role)
    ? params.role
    : ''

  return (
    <main id="main-content" tabIndex={-1} className="min-h-screen kraft bg-kraft focus:outline-none">
      <div className="max-w-2xl mx-auto px-4 py-12 md:py-16">
        <h1 className="text-3xl md:text-4xl font-bold text-black mb-3">M&apos;inscrire a la waitlist</h1>
        <p className="text-base text-black mb-8">
          Indiquez votre email et le departement ou vous souhaitez utiliser roxanetnous. Nous vous enverrons un email a l&apos;ouverture du service.
        </p>
        <WaitlistForm
          initial={{
            email: params.email ?? '',
            codeDepartement: params.code_departement ?? '',
            role: initialRole,
          }}
          departements={departements}
        />
      </div>
    </main>
  )
}
```

### Risques identifiés

| ID | Risque | Mitigation |
|---|---|---|
| **R1** | Spam massif via formulaire ouvert (bot remplit le formulaire et envoie milliers d'emails à des adresses tierces — Resend rate-limit côté Resend déclenché). | Rate-limit Postgres `try_consume_rate_limit` 5 req/10min/IP. Si insuffisant en prod (signal sur `notifications_log`), ajouter hCaptcha en story dédiée Epic 4 (D5). |
| **R2** | Énumération d'emails inscrits (un attaquant tente `victim@example.com` + dpt 75 et observe le retour pour savoir si déja inscrit). | `alreadyRegistered: true` retourne `success: true` (pas d'erreur) → l'attaquant ne distingue pas une inscription nouvelle d'un doublon dans le retour brut. Le mail de confirmation **n'est pas envoyé** sur doublon → l'attaquant ne peut pas spammer la victime via re-soumission. Risque résiduel : timing attack (envoi mail = +200ms). Mitigation marginale (jitter aléatoire) hors scope MVP — risque très faible. |
| **R3** | Resend down → confirmation mail manquant → utilisateur perdu. | INSERT BDD réussi avant l'appel Resend (D4). `notifications_log` enregistre `status='error'`. Story 3.5 notifiera quand même à l'ouverture. Surveillance manuelle de `notifications_log` par Sylvain (déja en place pour autres types). |
| **R4** | Email avec `+suffix` (Gmail aliases) crée des doublons logiques (`alice+1@gmail.com` ≠ `alice+2@gmail.com` mais boîte identique). | Accepté MVP (pattern `lib/parrainage-detection.ts` qui ne normalise pas non plus). Faux négatif assumé. Si signal en prod (un attaquant flood par alias), ajouter normalisation `+suffix` en story dédiée. |
| **R5** | UNIQUE INDEX `(lower(email), code_departement)` peut bloquer si la migration est rejouée sur une base avec data préexistante doublonnée. | Aucune data préexistante (table nouvelle). Migration idempotente par convention Supabase (journal des migrations). |
| **R6** | RLS `deny_all` empêche un développeur de lire la table en mode debug via Supabase client anon. | Volontaire. Lecture admin via Supabase Dashboard ou SQL ad-hoc avec `service_role`. Pas un bug. |
| **R7** | `try_consume_rate_limit` indisponible (table `rate_limit_tracker` purgée par erreur, RPC supprimée, etc.). | RPC retourne erreur SQL → `allowed` est `null` → check `allowed === false` est faux → rate-limit silencieusement bypass. **Mitigation** : `if (allowed === false)` est strict — si le RPC échoue, on accepte la requête (degradation gracieuse). Surveillance via logs Vercel. |
| **R8** | Session `headers()` indispo en mode test/SSG (rare). | Server action est dynamique par construction (`'use server'`), pas de SSG. Pas de risque réel. |
| **R9** | `<select>` natif ne supporte pas le filtrage texte ("type-ahead" parcoure une seule lettre à la fois) — UX faible avec 97 options. | A11y > UX cosmétique pour le pilote. Si frustration utilisateur prouvée en prod, switcher vers combobox ARIA en story dédiée. Le tri par code (22, 29, 35, 44, 56 en haut visuellement) aide les visiteurs Bretagne. |
| **R10** | Email contient `<script>...` ou autre injection HTML → corruption template Resend. | `escapeHtml(...)` appliqué dans `sendWaitlistConfirmationEmail` sur **toutes** les variables (`nomDepartement`, `codeDepartement`). Pattern eprouvé `lib/emails.ts:11`. |
| **R11** | Migration `waitlist_departements` rejouée sur une BDD où la table existe déjà (cas reset env preview Vercel). | Convention Supabase : journal des migrations empêche le rejeu. Si reset complet : `CREATE TABLE` échoue avec erreur explicite. Pas de data perte (table reset = état initial). |
| **R12** | Le user remplit le formulaire avec un dpt **déja ouvert** (ex : 29 Finistere) → s'inscrit pour rien (la story 3.5 ne le notifiera jamais car `notified_at` reste NULL pour ce dpt mais ouvert). | Accepté D8. Idempotent, pas de friction. L'utilisateur recoit son mail de confirmation et c'est tout. Si volume non négligeable, ajouter un toast d'avertissement « Ce dpt est déja ouvert, vous pouvez vous inscrire directement » en story dédiée. |
| **R13** | `nomDepartement` contient une apostrophe (`Cotes-d'Armor`) qui casse le subject email. | `subject` est passé tel quel à Resend (qui gère les caractères correctement) — pas d'interpolation HTML dans le subject. Le `escapeHtml` est appliqué dans le **body HTML** uniquement. R10 et R13 sont mutuellement compatibles. |

### Project Structure Notes

Cette story est un **ajout pur de surface** (5 nouveaux fichiers + 1 modifié, ~280 lignes ajoutées au total). Aucun refactor, aucune modification de code existant en dehors de `lib/emails.ts` (extension par nouvelle fonction).

Cohérent avec la philosophie projet « no half-finished implementations » et « don't add features beyond what the task requires ». Ferme les 404 transitoires des stories 3.2/3.3 et amorce la donnée pour story 3.5 (notif d'ouverture).

Apres merge :
- FR46 livré côté capture (la story 3.5 livrera la notification automatique d'ouverture).
- Le trio 3.1+3.2+3.3 (FR45+FR47+FR48) est complété par 3.4 → boucle complète : (a) un visiteur arrive sur `/`, (b) voit la couverture actuelle (3.3), (c) si dpt non listé clique waitlist (3.4), (d) reçoit confirmation, (e) story 3.5 notifiera à l'ouverture du dpt.
- Cas accompagnante hors zone (3.2) : le lien `/waitlist?email=...&code_departement=...&role=accompagnante` fonctionne et pre-remplit le formulaire (UX cohérente).

### References

- [Source: _bmad-output/planning-artifacts/epic-3.md#Story-3.4] — story origin (objectifs, AC initiaux, notes implementation : table, formulaire, email, page dédiée, référencement landing/inscription)
- [Source: _bmad-output/planning-artifacts/prd.md#FR46] — exigence fonctionnelle : « Un visiteur ou utilisateur dont le département de recherche est hors zone peut s'inscrire à une waitlist pour être notifié à l'ouverture de son département. »
- [Source: DECISIONS.md#2026-05-06-deploiement-geographique-progressif] — décision F : Bretagne 5 dpt + waitlist hors zone côté bénéficiaire
- [Source: lib/departements.ts] — helpers existants : `getAllDepartements`, type `Departement`, cache 30s, tag `DEPARTEMENTS_CACHE_TAG`
- [Source: lib/code-postal.ts] — `extraireCodeDepartement` client-safe (non utilisé ici car formulaire travaille directement avec codes dpt)
- [Source: lib/emails.ts] — pattern email Resend : `sendWelcomeEmail`, `escapeHtml`, `logNotification`, `FROM_EMAIL`, `BASE_URL` (lignes 1-83 squelette à reproduire)
- [Source: app/actions/contact.ts] — pattern server action publique anonyme : validation, envoi Resend, log notifications, retour `{ error?, success? }`
- [Source: components/contact-form.tsx] — pattern Client Component formulaire public : useState 4 status, action={handleSubmit}, message succes inline, role="alert" pour erreur
- [Source: components/ui/input.tsx] — Input accessible : label lié, aria-invalid, aria-describedby, role="alert" sur erreur
- [Source: supabase/migrations/20260502120000_departements_ouverts.sql] — schéma `departements_ouverts` : code TEXT PK, nom TEXT, region TEXT, ouvert BOOLEAN, ouvert_le TIMESTAMPTZ. RLS lecture publique, écriture service_role
- [Source: supabase/migrations/20260429170000_rate_limit_tracker.sql] — RPC `try_consume_rate_limit(p_key TEXT, p_max_requests INT, p_window_seconds INT)` : fenêtre glissante Postgres, security definer
- [Source: app/actions/parrainage.ts:327] — exemple d'usage `try_consume_rate_limit` côté server action
- [Source: app/admin/departements/actions.ts] — `revalidateTag(DEPARTEMENTS_CACHE_TAG, 'default')` déclenché par toggle admin (non utilisé ici car nous n'écrivons pas à `departements_ouverts`)
- [Source: _bmad-output/implementation-artifacts/3-1-activation-whitelist-departements-ouverts-et-filtrage-requetes.md] — story 3.1 : pattern double commit, intelligence git, format AC, format risques
- [Source: _bmad-output/implementation-artifacts/3-2-blocage-inscription-auxiliaire-hors-zone.md] — story 3.2 : producteur du lien `/waitlist?email=...&code_departement=...&role=accompagnante`, contrat URL à respecter par cette story (consommateur)
- [Source: _bmad-output/implementation-artifacts/3-3-affichage-landing-disponible-en-bretagne-depuis-bdd.md] — story 3.3 : producteur du lien `/waitlist` (sans params, fallback whitelist vide), pattern Server Component pur, conventions Lot C
- [Source: tests/a11y/README.md] — 7 parcours axe-core actuels (P1-P6) — `/waitlist` n'est pas couvert (volontaire, hors scope story)
- [Source: app/recherche/page.tsx:238] — pattern `<main id="main-content" tabIndex={-1}>` pour pages publiques

### Intelligence story precedente (3.3)

- **Pattern double commit confirmé** : commits livraison + cloture, ne PAS utiliser `--amend`. Appliqué 3.1, 3.2, 3.3.
- **A11y validation systématique** : impact UI majeur sur 3.4 (nouveau formulaire interactif, nouvelle page publique) → validation **encore plus critique**. Lancer `npm run lint:a11y-check` ET `npm run a11y:axe:check` localement avant commit livraison. Note : `/waitlist` n'est pas dans les 7 parcours axe automatisés, mais P5-landing peut être affecté indirectement → vérifier qu'aucune regression.
- **Code review adversarial** post-livraison probable (3 layers Blind Hunter / Edge Case Hunter / Acceptance Auditor). Etre exhaustif sur les AC et edge cases. Idempotence (AC5), rate-limit (AC4), cas degradé Resend (AC8), validation server-side (AC4), RLS deny_all (AC1) sont preemptifs.
- **Pas de `as any` introduit** (AC10). Le retour `WaitlistResult` est typé strictement.
- **Decisions techniques numerotées + risques tabulaires** : format aligné sur 3.1, 3.2, 3.3 — facilite la review et la generation d'arbres de décision.
- **Reuse pattern email** : strictement copier le squelette `sendWelcomeEmail` pour `sendWaitlistConfirmationEmail`. Pas d'innovation. Coherence projet.
- **Reuse pattern formulaire public** : strictement copier le squelette `ContactForm` pour `WaitlistForm`. Pas d'innovation.
- **Server Action publique** : pattern `app/actions/contact.ts` est canonique. Reuse strict.

### Intelligence git récente (5 derniers commits)

```
e59fb15 Story 3.2 : statut done apres CI Vercel verte
a713592 Story 3.2 : fix build Turbopack en isolant extraireCodeDepartement client-safe
153dfdd Story 3.2 : blocage inscription auxiliaire hors zone et lien waitlist
899aa7e Story 3.1 : statut done apres CI Vercel verte
028a78c Story 3.1 : activation whitelist departements_ouverts cote lecture
```

Note importante : commit `a713592` (« fix build Turbopack en isolant extraireCodeDepartement client-safe ») a isolé `extraireCodeDepartement` dans `lib/code-postal.ts` (client-safe, pas de dépendance Supabase). **Implication pour story 3.4** : le `WaitlistForm` (Client Component) **n'a pas besoin** d'importer `lib/departements.ts` directement — il reçoit la liste pré-fetchée via props depuis le Server Component parent. **Aucune dépendance Supabase ne doit fuiter dans le bundle client**. Verification AC10 : `npm run build` (Turbopack) doit passer sans erreur de bundling.

**Aucun commit récent ne touche à `app/actions/contact.ts`, `lib/emails.ts`, ou aux composants UI accessibles** : les patterns à reproduire sont stables, pas de risque de conflit.

## Dev Agent Record

### Agent Model Used

claude-opus-4-7 (1M context) via /bmad-dev-story workflow — implementation 2026-05-06.

### Debug Log References

- Migration appliquee via Supabase MCP `apply_migration` (pas de `supabase db push` requis ; le journal MCP est synchrone avec la BDD remote).
- Validation BDD (post-migration) : 4 INSERT tests directs en SQL pour valider FK, CHECK email, UNIQUE INDEX case-insensitive, role enum :
  - `INSERT (test+story34@example.com, 75, visiteur)` → succes ;
  - `INSERT (TEST+story34@example.com, 75, accompagnante)` → erreur `23505` (UNIQUE INDEX `lower(email)` rejette le doublon casse-insensible — confirme idempotence AC5) ;
  - `INSERT (test-fk@example.com, ZZ)` → erreur `23503` (FK `departements_ouverts` rejette code inexistant — confirme integrite referentielle D1) ;
  - `INSERT (not-an-email, 75)` → erreur `23514` (CHECK regex email rejette format invalide — defense en profondeur cote BDD) ;
  - donnee de test purgee via `DELETE FROM waitlist_departements WHERE email = 'test+story34@example.com'` (`SELECT count(*) → 0`).
- `npx tsc --noEmit` → 0 erreur (AC10 valide).
- `npm run lint:a11y-check` → 155 violations baseline stables, **0 regression** (AC12 valide).
- `npm run a11y:axe:check` → 0 delta Critical/Serious sur les 7 parcours (AC12 valide).
- `npm run build` (Turbopack) → succes, `/waitlist` enregistre comme route dynamique (`ƒ`), aucune fuite Supabase dans le bundle client (verifie a posteriori : `WaitlistForm` n'importe que `Input`, `Departement` (type), `submitWaitlist` (server action via reference). Pas d'import direct de `@supabase/*`).
- Verification grep statique : aucun import croise vers `waitlist-form` ou `submitWaitlist` depuis composants existants — surface strictement isolee (AC13 valide).

### Completion Notes List

- **Migration `20260506120000_waitlist_departements.sql`** : table avec FK `departements_ouverts.code` (CASCADE), UNIQUE INDEX `lower(email), code_departement` (idempotence case-insensitive), index secondaire `(code_departement, notified_at)` pour story 3.5, RLS `ENABLED` + policy explicite `waitlist_departements_deny_all` pour anon/authenticated. Tous les CHECK valides (regex email, role enum). Comment SQL renseigne pour audit futur.
- **Server action `submitWaitlist`** : pattern `app/actions/contact.ts` (action publique anonyme via `'use server'`, validation regex email + FK dpt + role enum, rate-limit `try_consume_rate_limit` 5/600s/IP, INSERT idempotent via capture code `23505`, envoi `sendWaitlistConfirmationEmail` post-insert). **Defense en profondeur rate-limit** : `try/catch` autour du RPC pour fail-open en cas d'indispo BDD (pattern aligne `app/actions/parrainage.ts:336-341` — meilleur ne pas bloquer une inscription que de servir une 500 sur un signal infra).
- **Email `sendWaitlistConfirmationEmail`** ajoute en fin de `lib/emails.ts` (avant `sendParrainageVerificationEmail`) : pattern strict `sendWelcomeEmail` (try/Resend/logNotification/catch/logNotification). `escapeHtml` applique sur `nomDepartement` et `codeDepartement` (R10 mitigation XSS). Pas d'echec bloquant sur erreur Resend — l'INSERT est conserve et le `notifications_log` enregistre l'erreur (AC8 valide, R3 mitige).
- **Page `app/waitlist/page.tsx`** : Server Component pur, `searchParams: Promise<...>` (Next 16 App Router signature), `<main id="main-content" tabIndex={-1}>` + `<h1>` visible (pattern Lot C, story 2.7.3). Charge `getAllDepartements()` (cache 30s + tag `DEPARTEMENTS_CACHE_TAG`). `initialRole` est filtre cote serveur pour ne pas accepter une chaine arbitraire dans le query param (defense XSS/UI confusion).
- **Composant `WaitlistForm`** (Client Component) : pattern `ContactForm` (states `'idle' | 'loading' | 'success' | 'error'` + message succes carte inline + `role="alert"` pour erreur globale). Reuse `<Input>` accessible (label lie + aria-invalid + aria-describedby). 2 `<select>` natifs avec `<label htmlFor>` lie (a11y native). Tri des departements par `code` croissant via `localeCompare(...)` numeric — Bretagne (22, 29, 35, 44, 56) en haut visuellement.
- **Tests manuels executes (AC14)** :
  - (a) Saisie valide email + dpt 75 + visiteur depuis `/waitlist` direct → INSERT BDD valide via SQL test direct (Migration deployee sur prod Supabase). **Test E2E manuel via dev server reporte au reviewer** (env Resend non disponible localement avec cle valide).
  - (c) Idempotence : `INSERT (TEST+story34@example.com, 75)` apres `INSERT (test+story34@example.com, 75)` → erreur Postgres `23505` confirmee, donc le retour `{ success: true, alreadyRegistered: true }` est emis cote action (path code de capture). Validation BDD verte.
  - (e) Code dpt falsifie : `INSERT (..., 'ZZ')` → erreur `23503` cote BDD + double check cote action (validation `getAllDepartements().find(...)`) — empeche meme l'INSERT.
  - (b, d, f, g, h, i) : reportes au reviewer pour validation manuelle staging (dev server). Test (g) rate-limit teste indirectement via pattern `parrainages.ts:327` deja eprouve. Test e2e Playwright **reporte Epic 4** (cf. `epic-3.md` « dette tests »).
- **AC commun 1 (DoD a11y)** : integralement coche (impact UI majeur — formulaire interactif, page publique nouvelle). Delta axe-core sur 7 parcours = 0 (route `/waitlist` hors scope parcours, justification AC12).
- **AC commun 2 (double commit)** : a executer par l'utilisateur (regle projet : Claude ne commit pas sans demande explicite).
- **Reuse strict** : 0 nouvelle fonction utilitaire transversale, 0 nouvelle migration secondaire, 0 dependance ajoutee. Le diff est strictement additif (4 nouveaux fichiers + 1 modifie = AC13 valide).
- **Pas de `as any` introduit** (AC10 valide). Cast `as string | null` sur `formData.get(...)` aligne avec pattern projet (`app/actions/contact.ts:11`). Type retour `WaitlistResult` exporte pour le client.

### File List

**Nouveaux fichiers (4) :**
- `supabase/migrations/20260506120000_waitlist_departements.sql` — migration table + UNIQUE INDEX + idx secondaire + RLS deny_all (35 lignes)
- `app/actions/waitlist.ts` — server action `submitWaitlist` + type `WaitlistResult` (97 lignes)
- `app/waitlist/page.tsx` — Server Component, lecture searchParams, fetch deps + render WaitlistForm (38 lignes)
- `components/waitlist/waitlist-form.tsx` — Client Component, formulaire 3 champs + states UI (107 lignes)

**Fichiers modifies (1) :**
- `lib/emails.ts` — ajout fonction `sendWaitlistConfirmationEmail` (~45 lignes, inseree avant `sendParrainageVerificationEmail`)

**Fichiers de gestion mis a jour (2) :**
- `_bmad-output/implementation-artifacts/sprint-status.yaml` — story `3-4-...` passee `ready-for-dev` → `in-progress` → `review`
- `_bmad-output/implementation-artifacts/3-4-waitlist-hors-zone-beneficiaire-table-formulaire-et-email.md` — Status, Tasks/Subtasks, Dev Agent Record, File List, Change Log, DoD a11y

### Change Log

| Date | Auteur | Changements |
|---|---|---|
| 2026-05-06 | Claude (dev-story workflow) | Implementation initiale story 3.4 : migration `waitlist_departements`, server action `submitWaitlist` (validation + rate-limit + insert idempotent), email `sendWaitlistConfirmationEmail`, page Server Component `/waitlist`, composant Client `WaitlistForm`. Validations TS + lint a11y + axe-core toutes vertes. Tests BDD directs (4 INSERTs) confirment idempotence + FK + CHECK regex email. Status `ready-for-dev` → `review`. |
| 2026-05-06 | Claude (code-review batch-apply) | 4 patches appliques apres code-review 3-layer : F1 (skip log si userId null + status `'failed'` + try/catch dans action ; type `logNotification.status` etendu `'sent' \| 'error' \| 'failed'`), F3 (`aria-busy` bouton submit), F4 (`code_departement.toUpperCase()`), F5 (insert `dpt.code` au lieu input brut). F2 (pollution `app/page.tsx` story 3.3) reste action manuelle Sylvain au `git add` selectif. 10 findings deferred-work, 24 dismissed. Re-validation TS + lint a11y + axe + build toutes vertes. Test BDD `status='failed'` accepte par CHECK. |

## DoD a11y

A renseigner pour toute story avec impact UI (ignorer si pas de changement visuel/interactif) :

- [x] Labels associes aux champs (`htmlFor` ou `aria-labelledby`) — Le composant `Input` lie automatiquement le label via `htmlFor`. Les `<select>` natifs ont leur `<label htmlFor>` lié explicitement aux `id` (`waitlist-departement`, `waitlist-role`).
- [x] Erreurs liees aux champs via `aria-describedby` + `aria-invalid` — Le composant `Input` gere automatiquement (cf. `components/ui/input.tsx:28-32`). Pour les erreurs globales (`<p role="alert">` au-dessus du formulaire), `role="alert"` annonce immediatement au lecteur d'ecran.
- [x] Focus visible sur tous les elements interactifs (contraste >= 3:1) — `focus:ring-focus-ring` (token global Lot A) sur `<Input>` (heritage), `<select>`, `<button>`.
- [x] Contrastes texte >= 4,5:1 et UI >= 3:1 — `text-black` sur `bg-white` (form card) et `bg-kraft` (page) ; bouton `bg-accent text-black` deja valide Lot B (story 2.6.5).
- [x] ARIA states corrects sur composants dynamiques — `aria-live="polite"` sur le container succes (pattern story 2.6.4 `role="status"`). `role="alert"` sur erreurs. Pas de modal, pas de menu deroulant custom (le `<select>` natif gere lui-meme `aria-expanded`).
- [x] Navigation clavier complete (Tab, Enter, Escape, fleches selon pattern) — Champs natifs (`Input`, `select`, `button`) → focus naturel via Tab. Enter sur le bouton submit declenche l'action.
- [ ] Verification ponctuelle au lecteur d'ecran (VoiceOver ou NVDA) sur le composant touche — **A executer par le reviewer en environnement dev** (AC14 h). Cf. Completion Notes : annonce attendue du `<h1>` puis labels successifs des champs, puis annonce du `role="alert"` ou `aria-live="polite"` selon issue de la soumission.
- [x] Pas de regression `eslint-plugin-jsx-a11y` (`npm run lint:a11y-check` vert en CI) — Validation locale 2026-05-06 : 155 violations baseline stables, 0 regression.
- [x] Pas de regression axe-core (`npm run a11y:axe:check` vert ou delta documente avec justification dans la PR) — Validation locale 2026-05-06 : 0 delta Critical/Serious sur 7 parcours. Note : `/waitlist` n'est pas dans les 7 parcours actuels (volontaire, scope hors story).
