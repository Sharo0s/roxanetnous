# Decisions projet roxanetnous

Ce fichier documente les decisions prises pendant le developpement.
Il fait autorite sur les documents bmad en cas de contradiction.

---

## 2026-02-11 : Suppression tarif horaire, PCH et APA

**Decision :** Tout ce qui concerne le tarif horaire, la modulation tarifaire PCH, la modulation tarifaire APA et le type aide_sociale est supprime du projet.

**Perimetre supprime :**
- Colonnes BDD : tarif_horaire, modulation_pch, modulation_apa (accompagnantes_profiles), tarif_min, tarif_max (annonces_accompagnantes), tarif_max, aide_sociale (annonces_accompagnes), tarif (contrats), tarif_modulable_pch, tarif_modulable_apa (badges_cache)
- Type ENUM : aide_sociale_type
- Trigger : trigger_update_badge_modulation + fonction update_badge_modulation_tarifaire()
- Composant : step-tarification.tsx
- Etape "Tarification" du formulaire onboarding accompagnante

**Regle :** Ne jamais reintroduire ces elements sauf demande explicite du client.

---

## 2026-02-11 : Design noir et blanc

**Decision :** Toute l'interface est en noir et blanc (pas de couleurs primaires vertes ni autres). Le client n'a pas encore choisi les couleurs.

**Regle :** Ne jamais ajouter de couleurs (primary-600, green, blue, etc.) sauf gris, noir et blanc. Pas d'emojis dans le code.

---

## 2026-02-11 : Suppression bloc "Engagement social" de la landing page

**Decision :** Le bloc "Badges PCH/APA pour faciliter l'acces aux aides sociales" est supprime de la landing page.

---

## 2026-02-15 : Suppression fonctionnalite contrats PDF

**Decision :** La generation automatique de contrats PDF entre accompagnante et accompagne est supprimee du projet.

**Perimetre supprime :**
- Table BDD : contrats (supprimee, etait vide)

**Regle :** Ne jamais reintroduire sauf demande explicite du client.

---

## 2026-02-12 : TODO avant mise en production

**A faire avant de passer en production :**
- Reactiver la confirmation email dans Supabase (Authentication > Settings > Enable email confirmations)
- Personnaliser les templates d'email Supabase en francais avec le branding roxanetnous
- Remplacer les cles Stripe test par les cles live (pk_live, sk_live)
- Recreer le produit/prix Stripe en mode live et mettre a jour les STRIPE_PRICE_* dans Vercel
- Recreer le webhook Stripe avec l'URL de production
- Configurer Resend avec un vrai domaine pour l'envoi d'emails
- Mettre a jour NEXT_PUBLIC_BASE_URL avec le domaine final
- Definir la date exacte de LAUNCH_OFFER_END (offre de lancement 1 mois)

---

## 2026-05-06 : Soft paywall (lecture libre, action de mise en relation payante)

**Decision :** Le PRD FR16 mentionne un "hard paywall" mais le code livre depuis le debut une lecture libre. On acte le **soft paywall** comme modele economique definitif. Lecture des profils et annonces accessible sans abonnement, paywall declenche uniquement au moment de la **mise en relation**.

**Comportement par action :**

| Action | Visiteur non connecte | Connecte sans abonnement | Abonne actif |
|---|---|---|---|
| Voir landing page | OK | OK | OK |
| Recherche + filtres | OK | OK | OK |
| Voir un profil auxiliaire | OK | OK | OK |
| Voir favoris | login requis | OK | OK |
| Ajouter aux favoris | login requis | OK | OK |
| **Envoyer un message** | login requis | **paywall** | OK |
| **Publier annonce auxiliaire** | login requis | **paywall** | OK |
| Pages legales (CGU, RGPD, accessibilite) | OK | OK | OK |

**Motivation :**
- Aligne avec l'investissement SEO deja realise (sitemap, meta, indexabilite des profils).
- Standard du secteur marketplaces de mise en relation (Malt, Yoopies, Click&Care).
- Densite faible en zone pilote Bretagne (cf. decision F) impose de minimiser la friction de decouverte.
- Pas de risque scrape critique : coordonnees personnelles auxiliaires non exposees publiquement, contact passe par messagerie in-app payante.

**Implications techniques :**
- Aucun middleware global d'enforcement abonnement a ajouter. Le pattern actuel (verification page par page via `hasActiveSubscription()`) est correct et conserve.
- Toute nouvelle action de mise en relation doit appeler `hasActiveSubscription()` cote server action ou page protegee.
- Le PRD FR16 doit etre reformule de "Hard paywall" vers "Paywall sur actions de mise en relation".

**Regle :** Ne jamais ajouter d'enforcement bloquant sur la lecture (recherche, profils, annonces, favoris). Ne jamais retirer l'enforcement existant sur l'envoi de message ni la publication d'annonce auxiliaire.

---

## 2026-05-06 : Deploiement geographique progressif - pilote Bretagne historique

**Decision :** Le PRD mentionne "Couverture : toutes les villes de France" mais la plateforme adopte un **deploiement progressif departement par departement**. Pilote au lancement = **Bretagne historique 5 departements** :

- **29** Finistere
- **22** Cotes-d'Armor
- **56** Morbihan
- **35** Ille-et-Vilaine
- **44** Loire-Atlantique

Migration support : `20260502120000_departements_ouverts` (table whitelist deja en place, a alimenter avec les 5 codes).

**Comportement hors zone (departements non ouverts) :**

- **Visiteur cote beneficiaire** : capture email "prevenez-moi quand vous arrivez dans mon departement" (composant a creer + table waitlist + email confirmation). C'est une story dediee a inclure dans l'epic 3.
- **Auxiliaire** : **inscription bloquee** avec message explicatif. Plus simple, evite de gerer un pool d'auxiliaires invisibles. Trade-off accepte : on perd des inscriptions potentielles hors zone, mais le compromis simplicite l'emporte au stade pilote.
- **Landing page** : afficher explicitement "Disponible actuellement en Bretagne (5 departements)" + invitation waitlist hors zone.

**Motivation :**
- Densite controlee par zone evite l'effet "0 resultat" qui plombe la premiere impression.
- Bretagne historique = bassin culturel coherent geographiquement et identitairement, communication marketing plus efficace.
- 5 departements = volume suffisant pour valider le modele (auxiliaires + beneficiaires) sans diluer le marketing sur la France entiere.
- Validation manuelle Sylvain (5-25 auxiliaires gerable) coherente avec une zone restreinte.

**Implications techniques :**
- Activer la whitelist `departements_ouverts` en production avec les 5 codes a l'ouverture.
- Filtrer toutes les requetes de recherche / matching / annonces sur cette whitelist.
- Bloquer le formulaire d'inscription auxiliaire si `departement` du justificatif d'identite ou de l'adresse declaree est hors whitelist.
- Composant + table waitlist a developper (story epic 3).
- Le PRD FR15 et le resume executif doivent etre reformules pour refleter le deploiement progressif.

**Strategie d'expansion future :**
- L'ouverture d'un nouveau departement se fait par ajout dans la whitelist + email de notification a la waitlist du departement concerne.
- Pas de calendrier fige : ouverture conditionnelle a l'atteinte de seuils a definir (densite auxiliaires, demande beneficiaires) ou a une decision business.

**Regle :** Toute nouvelle feature touchant la geographie (matching, recherche, annonces, inscription) doit respecter la whitelist `departements_ouverts`. Toute communication publique (landing, marketing, presse) doit mentionner le perimetre Bretagne actuel sans laisser entendre une couverture France entiere.

---

## 2026-05-07 : Granularite bandeau RGPD - bandeau binaire conforme

**Decision :** Le bandeau cookies actuel `components/cookie-banner.tsx` (un seul bouton "Compris", bandeau informatif sans categorisation) est conforme RGPD/ePrivacy car **tous les traceurs poses sur le domaine roxanetnous sont strictement necessaires au fonctionnement du service**, donc exemptes de consentement au titre de l'**article 82 de la loi Informatique et Libertes** (transposition de la Directive ePrivacy 2002/58) et de la Deliberation CNIL n°2020-091 (categorie "strictement necessaires"). Le **traitement** des donnees ainsi collectees repose en outre sur l'**article 6.1.b RGPD** (execution du contrat).

**Inventaire des traceurs poses sur le domaine roxanetnous :**
- **Famille de cookies Supabase auth** (`sb-<project-ref>-auth-token*`) : un ou plusieurs cookies HTTP peuvent etre poses (chunking si le token depasse 4096 octets, code-verifier transitoire en cas de flux OAuth/PKCE). Finalite : authentification. Strictement necessaire au fonctionnement du service.
- **Preference locale de bandeau** (`localStorage` cle `cookies-accepted`) : assimilee a un traceur par la CNIL au sens de la Deliberation 2020-091, mais **exemptee de consentement** car strictement necessaire a l'ergonomie du bandeau d'information.

**Aucun cookie tiers** (analytics, publicite, tracking, retargeting, session replay) n'est pose sur le domaine roxanetnous. Aucun script tiers de tracking/analytics/CMP n'est charge cote client (verification grep code Section 5 du rapport audit : 0 occurrence sur `app/`, `components/`, `lib/`).

Les **cookies poses par Stripe sur son sous-domaine `checkout.stripe.com`** lors d'une session de paiement relevent du double role RGPD de Stripe Payments Europe Ltd. : (a) **sous-traitant** au sens de l'article 28 RGPD pour le traitement de paiement contractualise avec roxanetnous, et (b) **responsable de traitement autonome** pour ses finalites propres (anti-fraude Radar, conformite KYC, obligations legales propres aux PSP). Hors perimetre du bandeau roxanetnous quel que soit le role retenu (cookies poses sur leur propre domaine, pas le notre). Le SDK Stripe.js client n'est pas charge sur notre domaine (`@stripe/stripe-js` present en dependance mais 0 import applicatif - dette technique a traiter Epic 4).

Les **tuiles cartographiques OpenStreetMap** chargees par Leaflet sur les pages authentifiees configurant une zone geographique (5 call-sites au total : profil et nouvelle annonce auxiliaire, onboarding initial auxiliaire, modifier annonce auxiliaire, nouvelle annonce beneficiaire) transmettent l'IP utilisateur a OSM Foundation, fondation a but non lucratif. Cette transmission est couverte par la base legale art. 6.1.b RGPD (fonction metier essentielle, acces uniquement post-authentification). Mention informative ajoutee dans la politique de confidentialite Section "Transferts de donnees".

**Motivation :** Deliberation CNIL n°2020-091 du 17 septembre 2020 (lignes directrices cookies) precise les conditions d'application de l'article 82 LIL : un bandeau cookies purement informatif (sans recueil de consentement) est admis pour les sites ou **tous** les traceurs poses sont strictement necessaires au fonctionnement OU exemptes au titre de la mesure d'audience. Le projet roxanetnous remplit cette condition pre-go-live Bretagne (cf. rapport `_bmad-output/planning-artifacts/audit-cookies-2026-05-07.md`).

**Implications techniques :**
- `components/cookie-banner.tsx` : libelle court qui delegue le detail factuel a la politique de confidentialite via lien explicite. Aucun consentement recueilli (le bouton "Compris" ferme un bandeau informatif, ne consent rien).
- `app/politique-de-confidentialite/page.tsx` : section "Cookies et traceurs" precisee (famille Supabase + localStorage exempte traceur, citation art. 82 LIL + 6.1.b RGPD) + section "Transferts de donnees" completee (mention OSM Foundation, sous-domaines `{a,b,c}.tile.openstreetmap.org`, perimetre auxiliaire-beneficiaire authentifie precise).
- **Cle `localStorage cookies-accepted` non bumpee** malgre la modification du libelle : la modification est une correction cosmetique-precision (clarification localStorage vs cookie HTTP, ajout art. 82 LIL), pas un changement de fond du consentement (qui reste : aucun consentement recueilli car aucun traceur non-essentiel). Les utilisateurs ayant deja clique "Compris" avant 2026-05-07 conservent donc leur preference. Choix pragmatique pre-go-live : base utilisateur reduite, pas de regression d'experience.
- **Affirmations sur les attributs des cookies Supabase** (`httpOnly`, `secure`, `sameSite`) **non publiees** dans la politique de confidentialite tant que le re-audit DevTools live n'a pas ete realise. La politique decrit la finalite et la base legale, pas les attributs techniques non encore verifies en environnement live.
- **Aucun CMP requis** au stade MVP Bretagne. Decision a reconsiderer si introduction future d'analytics, retargeting, ou partenaires tiers a finalite commerciale.
- **Re-audit DevTools live** sur 3 contextes (landing publique, beneficiaire authentifie, Stripe Checkout) **obligatoire avant ouverture publique du premier departement Bretagne** : verification visuelle des attributs `httpOnly`/`secure`/`sameSite`/expiration des cookies Supabase, comptage exact de la famille `sb-*-auth-token*`, confirmation absence cookie cross-domain Stripe au retour annulation checkout. Cet audit code-only ne dispense pas d'une verification live.
- **Pre-condition** d'introduction d'un nouveau script ou cookie tiers : audit RGPD prealable + classification CNIL + mise a jour de cette decision si la classification est non-essentiel/non-exempte (ouvre alors une story Epic 4 CMP).

**Regle :** Tout nouveau cookie ou script tiers ajoute au projet doit (a) etre classe essentiel/exempte/soumis-a-consentement avant merge, (b) si soumis a consentement, ouvrir une story Epic 4 CMP prealable. Aucun ajout direct de tracking/analytics/retargeting/session-replay sans audit RGPD prealable et mise a jour de cette decision. Voir `_bmad-output/planning-artifacts/audit-cookies-2026-05-07.md`.

---

## 2026-05-07 : Extension Epic 3 - Whitelist `departements_ouverts` + FK CASCADE waitlist + tag-based cache (decision F1)

**Decision :** Extension de la decision 2026-05-06 deploiement geographique progressif. Les modalites techniques d'implementation Epic 3 sont actees comme references projet :

- **Whitelist `departements_ouverts`** est la source unique de verite pour la geographie. Toute nouvelle feature touchant la geographie (filtrage lecture, blocage inscription, calculs matching, etc.) doit lire cette table.
- **FK CASCADE sur `waitlist_departements.code_departement`** -> purge automatique des inscriptions waitlist si un departement est supprime de la whitelist. Acceptable car data anonyme purpose-specific. Pas de retention legale au-dela du besoin de notification.
- **Cache tag-based via `unstable_cache` 30 s + `revalidateTag(DEPARTEMENTS_CACHE_TAG)`** : pattern oblige pour toute lecture de la whitelist (5 call-sites Epic 3 : `lib/matching.ts`, `app/recherche/`, `components/landing/DepartementsOuverts.tsx`, server action onboarding, server action waitlist). Invalidation immediate au toggle admin (pas de delai 30 s).
- **Extension geographique future** : ajouter regions/departements a `departements_ouverts` par migration ou via interface admin (existante). Maintien FK sans down-time.

**Motivation :** patterns valides en livraison Epic 3 (8/8 stories) sans incoherence. Code review adversarial 3-layers a couvert les races, idempotence et concurrence sans finding bloquant.

**Regle :** Toute nouvelle feature lisant la geographie doit (a) passer par `lib/departements.ts` (helpers `isDepartementOuvert()`, `getCodesDepartementsOuverts()`), (b) reutiliser le tag `DEPARTEMENTS_CACHE_TAG` cote cache, (c) declencher `revalidateTag()` cote ecriture admin. Aucun acces direct a la table sans passer par les helpers.

---

## 2026-05-07 : Extension Epic 3 - Soft paywall messaging granularite creation/lecture (decision F2)

**Decision :** Extension de la decision 2026-05-06 soft paywall. Les modalites techniques de l'audit paywall story 3.6 sont actees :

- **`sendMessage`** : paywall obligatoire sauf conversation avec admin. Verification `hasActiveSubscription()` en debut de server action.
- **`getOrCreateConversation*`** : paywall sur **creation** de conversation, pas sur lecture historique. Un utilisateur qui a perdu son abonnement peut consulter ses conversations existantes (cas legitime : abonnement expire pendant un echange en cours, eviter perte UX brutale).
- **UI defense-en-profondeur** : button disabled cote client + redirection modale `/abonnement?from=contact` si non-abonne. Le client est UX, pas securite. Server action reste source de verite.
- **Pages lecture** (`/recherche`, `/messages` lecture, `/favoris` lecture) : aucun check abonnement bloquant. Audit story 3.6 a confirme zero ecart.

**Motivation :** audit code complet (matrice 12 actions x 3 roles) story 3.6 a documente chaque call-site. Le pattern "paywall sur creation, libre sur lecture" est coherent avec le soft paywall et evite la friction sur les utilisateurs en transition d'abonnement.

**Regle :** Toute nouvelle action de mise en relation doit choisir explicitement entre (a) paywall obligatoire (creation, modification, envoi) ou (b) lecture libre (consultation passive). Le choix doit etre documente dans la docstring de la server action. Audit matrice oblige avant merge si introduction d'une nouvelle entree dans la matrice paywall.

---

## 2026-05-07 : Schema `admin_actions_log` dual-target avec mutex applicatif (decision F3)

**Decision :** La table `admin_actions_log` accepte deux types de cible distincts :

- **`target_id UUID NULLABLE`** : pour actions sur entites avec UUID (utilisateurs, abonnements, parrainages, profils auxiliaires).
- **`target_id_text TEXT NULLABLE`** : pour actions sur entites identifiees par code TEXT (codes departements, codes regions, codes promo, etc.).

**Mutex applicatif** : exactement un des deux doit etre set par appel `logAdminAction()`. **Pas de CHECK BDD** pour preserver l'historique des appels precedents qui ont rempli `target_id` UUID. La regle est documentee en commentaire SQL sur la table + docstring du helper `logAdminAction()` dans `lib/admin-actions.ts`.

**Motivation :** bug latent debusque pre-cadrage story 3.5 - le toggle dpt admin appelait `logAdminAction({ target_id: code })` avec un code TEXT alors que `target_id` est UUID NOT NULL en BDD. Aucun toggle dpt n'avait jamais ete execute en prod (chemin de code non-exerce), donc bug dormant depuis Epic 2. Migration ajoutant `target_id_text TEXT NULLABLE` resoud le probleme sans toucher l'historique UUID.

**Implications techniques :**
- Tous les callers existants continuent d'utiliser `target_id` UUID sans modification.
- Nouveaux callers sur entites code TEXT : utiliser `target_id_text`.
- Lectures admin (`app/admin/historique/`) : afficher l'un OU l'autre selon `target_id IS NOT NULL`.

**Regle :** Toute nouvelle action admin loggee doit choisir explicitement `target_id` (UUID) ou `target_id_text` (TEXT) selon la nature de l'entite ciblee. Jamais les deux simultanement. Si une entite a a la fois un UUID et un code metier (cas hypothetique), preferer `target_id` UUID.

---

## 2026-05-07 : Notifications admin fail-loud + audit trail (decision F4)

**Decision :** La perte silencieuse d'un signal admin (alerte fraude parrainage, notification waitlist, notification critique BDD) est inacceptable. Pattern oblige :

- **Configuration absente** (env var manquante, recipient mal configure) : `console.warn` explicite avec message libelle metier + insertion `admin_actions_log` action_type=`<flow>_admin_alert_lost` (persistant) + libelle francais visible dans `/admin/historique`.
- **Vraie panne** (Resend timeout, BDD inaccessible) : `console.error` + insertion `admin_actions_log` action_type=`<flow>_admin_alert_failed` + retry capture par cron secondaire.
- **Build-time garde-fou** : `scripts/check-required-env.mjs` emet warning si variables admin critiques manquantes en `VERCEL_ENV=production`. Non-bloquant Epic 3, durcissement Epic 4 (separation REQUIRED vs OPTIONAL_ON_PREVIEW).

**Mapping libelles** : `lib/admin-actions.ts` maintient un `Record<action_type, libelle_fr>` synchronise avec les action_types insertes. Ajout d'une nouvelle action_type oblige mise a jour du mapping (sinon affichage code brut dans l'admin).

**Motivation :** patch H5 review post-livraison story 2.4 + raffinement story 3.8. Un signal anti-fraude perdu (`ADMIN_NOTIFICATIONS_EMAIL` non configuree en preview) est un risque metier critique non detectable sans audit trail. Le pattern fail-loud + audit trail est non-negociable sur tous les flows admin futurs.

**Regle :** Tout nouveau flow d'envoi de notification admin doit (a) gerer explicitement le cas config absente avec audit trail, (b) gerer explicitement le cas panne externe avec retry capture, (c) declarer son action_type dans le mapping `actionLabels`. Aucune notification admin ne peut echouer silencieusement.

---

## 2026-05-07 : Idempotence niveau BDD (UNIQUE INDEX + compare-and-swap) (decision F5)

**Decision :** Pour toute table avec exigence d'idempotence (waitlist, parrainages, notifications, etc.), l'idempotence est implementee **au niveau BDD** plutot qu'applicatif. Deux patterns composes obligatoires :

- **Insertion idempotente** : `UNIQUE INDEX` sur la cle metier (typiquement `(lower(email), code_departement)` pour les emails, `(user_id, action_type, target)` pour les actions admin, etc.) + `INSERT ... ON CONFLICT DO NOTHING` ou capture du code erreur PostgreSQL `23505` (unique violation) cote applicatif. Si conflit -> retourner `alreadyRegistered: true` (idempotent succes), pas erreur.
- **Mise a jour idempotente** : `UPDATE table SET <state-change> WHERE id = ? AND <invariant-not-already-set>` (compare-and-swap atomique). Verifier `rowCount === 1` cote applicatif. Si `rowCount === 0` -> action deja effectuee, idempotent succes.

**Anti-pattern explicitement interdit** : check-before-insert applicatif (`SELECT ... ; if (exists) return ; INSERT ...`). Cela ouvre une race window + leak PII (revele l'existence d'un email cote attaquant).

**Motivation :** pattern valide stories 3.4 (waitlist `INSERT ON CONFLICT (lower(email), code) DO NOTHING`) et 3.5 (compare-and-swap `UPDATE waitlist SET notified_at WHERE id = ? AND notified_at IS NULL`). Aucun doublon possible meme en concurrence admin + cron simultanee. Pattern naturellement extensible aux flows parrainage, notifications, paiements.

**Implications techniques :**
- Toute table avec idempotence requise doit declarer un UNIQUE INDEX sur la cle metier au moment de la migration (pas en after-thought).
- Les server actions appelant ces inserts doivent capturer `code === '23505'` explicitement.
- Les flows de mise a jour conditionnelle doivent inclure l'invariant dans le `WHERE` (jamais lire-puis-update separes).

**Regle :** Toute nouvelle table avec exigence d'idempotence doit avoir son UNIQUE INDEX declare en migration. Toute nouvelle server action sur table idempotente doit appliquer le pattern `INSERT ON CONFLICT` ou compare-and-swap. Aucun check-before-insert applicatif autorise sur une table avec contrainte d'unicite metier.

---

## 2026-05-07 : Schema `notifications_log` etendu - `user_id NULLABLE` + `status` etendu sept valeurs (decision F6)

**Decision :** Le schema `public.notifications_log` est modifie de maniere transverse pour accommoder les flows email visiteurs anonymes et les statuts operationnels enrichis :

- **`user_id UUID NULLABLE`** (auparavant `NOT NULL` + FK `users(id)`). La FK est preservee : si non-null, doit pointer vers une row existante. Le `NULL` est autorise pour visiteurs hors-table `users` (waitlist visiteur, formulaire de contact, alertes admin transverses).
- **CHECK `status` etendu de 3 a 7 valeurs** : `pending` (defaut), `sent` (Resend ok), `failed` (envoi rate, retry possible), `error` (exception applicative pre-Resend), `lost` (config absente, signal perdu), `retry-scheduled` (queue durable story 4.3), `retry-exhausted` (queue durable, 3 retries fail).
- **`type TEXT libre`** (decision adjacente) : pas de CHECK ni d'ENUM Postgres. Convention de nommage `<flow>_<event>` documentee dans le commentaire SQL de la colonne. Justification : les types metier evoluent rapidement (chaque story produit son type) ; un ENUM exigerait un `ALTER TYPE ADD VALUE` a chaque nouvelle story email -> friction inacceptable.

**Anti-pattern explicitement interdit** : INSERT direct dans `notifications_log` depuis une autre source que le helper centralise `lib/emails.ts:logNotification`. Cela duplique la logique de mapping (`userId -> user_id || null`, `sent_at` conditionnel) et risque de diverger lors d'une evolution future du schema.

**Motivation :** bug latent decouvert review story 3.4 (2026-05-06) puis acte AI-3.1 retro Epic 3 (2026-05-07). Constat empirique avant fix : 50 lignes en BDD au 2026-05-07, toutes `status='sent'` + `user_id NOT NULL`. Aucun chemin error/anonyme n'a jamais ete persiste depuis Epic 1 (echecs silencieux NOT NULL et CHECK). 4 flows etaient impactes (visiteur anonyme waitlist x2, contact form, admin alertes hors users.id) + toutes les branches catch des 17+ helpers email (`status='error'` rejete par CHECK).

**Implications techniques :**
- Le helper `logNotification` est exporte depuis `lib/emails.ts` et accepte `userId?: string` (undefined autorise). Le mapping en BDD est `params.userId || null`.
- Le type TS `NotificationLogStatus` est exporte depuis `lib/emails.ts` et utilise par `app/actions/contact.ts`. Tout futur call-site externe doit l'importer plutot que dupliquer l'union.
- Les statuts `retry-scheduled` et `retry-exhausted` sont introduits par cette story 4.2 mais ne sont pas encore emis par le code applicatif au merge. Story 4.3 (queue durable) sera la premiere a les utiliser via `sendEmailWorkflow`.
- Migration idempotente via `DROP CONSTRAINT IF EXISTS` + guard `duplicate_object` autour de l'`ADD CONSTRAINT`. Pattern reutilise de `20260506130000_admin_actions_log_target_id_text.sql`.

**Regle :** Toute future fonction email metier doit appeler `logNotification` (helper exporte de `lib/emails.ts`) plutot qu'un INSERT direct. Toute extension du set de statuts `notifications_log.status` doit (a) etendre le CHECK BDD via migration et (b) etendre simultanement le type TS `NotificationLogStatus` pour preserver l'alignement. Tout INSERT direct dans `notifications_log` depuis un autre fichier que `lib/emails.ts` est rejete au code review.

## 2026-05-08 : Queue email durable - Vercel Workflow DevKit + at-least-once + fallback synchrone (decision F7)

**Decision :** Les flows email critiques en chemin go-live Bretagne (`waitlist_confirmation` et `waitlist_opening`) basculent sur une queue durable basee sur Vercel Workflow DevKit (`workflow` + `@workflow/next`). Le pattern est :

- **`sendEmailWorkflow` (`"use workflow"`)** orchestre 2 steps : un step `logEmailStatusStep` (persistance BDD `pending` -> `sent` ou `retry-scheduled` -> `retry-exhausted`) et un step `sendEmailViaResend` (envoi Resend avec `idempotencyKey = stepId` + classification erreur en `RetryableError` ou `FatalError`).
- **`enqueueEmail(payload)` (`lib/email-queue.ts`)** est le helper neutre qui invoque `start(sendEmailWorkflow, [payload])`. Il tag Sentry `signal:queue-start-failed` en cas d'indisponibilite runtime.
- **`enqueueWaitlistConfirmationEmail` / `enqueueWaitlistOpeningNotificationEmail` (`lib/emails.ts`)** sont les fonctions exposees aux call-sites. Elles **encapsulent le fallback synchrone** : si la queue throw au start, elles basculent sur `sendWaitlistConfirmationEmail` / `sendWaitlistOpeningNotificationEmail` synchrones (Sentry tag `signal:queue-fallback-sync`) afin de ne JAMAIS perdre l'email.
- **3 call-sites prioritaires migres** : `submitWaitlist` (server action), `notifyWaitlistForCode` (admin trigger via toggleDepartement/toggleRegion), cron `notify-waitlist-retry` (safety net 30 jours).
- **Cron retry conserve 30 jours** post-merge en mode safety net (Sentry alerte `signal:queue-cron-fallback-active` si lignes `notified_at IS NULL` AGED >24h sont detectees). Suppression via story 4.3.b prevue 2026-06-07 si zero alerte.
- **`BATCH_LIMIT=200`** conserve cote query SELECT (defense en profondeur anti-runaway). Le `console.warn('batch_limit_reached')` bascule en `Sentry.captureMessage` tag `signal:queue-batch-saturation`.

**Motivation :** AI-3.3 retro Epic 3 (queue durable bloquante go-live Bretagne). Latence server actions `toggleRegion('Bretagne')` ramenee de ~75 s pire cas (5 dpt x 50 emails x 300 ms Resend) a `<1 s` (fire-and-forget durable). Suppression de la classe de bug « ligne notified_at swappee mais email perdu si Resend timeout » (D5 story 3.5 risque accepte). Preparation a la montee en charge ouverture massive Bretagne post-pilote (>200 inscrits/dpt en burst).

**Alternatives rejetees :**
- **Vercel KV polling + cron** : Vercel KV deprecated 2026-02-27.
- **BullMQ + Upstash Redis** : friction provisioning + duplication observabilite (Upstash + Sentry + Vercel) + tests preview environments necessitent une instance Redis distincte.
- **Vercel Queues** : encore en public beta. Workflow DevKit (Vercel World GA) prefere pour zero-config production.

**Pattern d'integration :**
- **`at-least-once delivery` accepte cote queue** (Vercel Workflow DevKit). Mitigation cote Resend via `idempotencyKey = stepId` retourne par `getStepMetadata()` — Resend deduplique cote serveur les requetes partageant la meme cle. Cote `notifications_log`, accept double-line `status='sent'` (deja accepte deferred-work, helper deduplique candidat Epic 5+).
- **`retry-scheduled`** emis cote step quand `getStepMetadata().attempt > 1` (pattern doc bundled `node_modules/workflow/docs/foundations/idempotency.mdx`). `retry-exhausted` emis cote workflow function dans le catch global UNIQUEMENT pour les `RetryableError` epuises (Sentry tag `signal:queue-retry-exhausted`). **Code review 2026-05-08 P11** : les `FatalError` (validation, recipient invalide, erreur Resend permanente) sont logues `failed` (statut deja accepte par CHECK BDD story 4.2) sans re-emission Sentry duplicate (le step a deja emis le tag dedie `queue-invalid-nom` ou `queue-fatal-error`).
- **Grammaire des statuts cycle queue** : `pending` (start) -> `retry-scheduled` (attempt > 1) -> `sent` (succes) ou `failed` (FatalError pas-de-retry) ou `retry-exhausted` (RetryableError x4 epuises). Audit BDD propre via `SELECT status, count(*) GROUP BY status`.
- **Contrat re-throw fallback synchrone (Code review 2026-05-08 P12)** : `sendWaitlistConfirmationEmail` et `sendWaitlistOpeningNotificationEmail` re-throw apres avoir logue `failed`. Les wrappers `enqueueWaitlist*Email` enveloppent l'appel fallback dans un try imbrique : si le fallback throw a son tour (double incident infra : queue down + Resend down), Sentry critical `signal:queue-fallback-sync-failed` + re-throw au call-site qui incremente `errors++` au lieu de `sent++`. Pas d'email perdu silencieusement.
- **Endpoint Workflow runtime** : pas de `app/api/workflow/route.ts` manuel. `withWorkflow(nextConfig)` dans `next.config.mjs` cree automatiquement les routes `/.well-known/workflow/v1/{flow,step,webhook}` au build (verifie via `npm run build`).
- **Portee du cron `notify-waitlist-retry` (Code review 2026-05-08 P13)** : safety net partiel. Couvre (a) inscriptions tardives apres ouverture dpt, (b) echecs admin trigger AVANT swap (queryErr Supabase). NE COUVRE PAS (c) les pannes runtime Workflow apres swap (ces cas sont detectes uniquement via `signal:queue-retry-exhausted` cote Sentry workflow function). La decision suppression J+30 repose sur la combinaison `queue-cron-fallback-active` (ce cron) ET `queue-retry-exhausted` (workflow), les deux signaux couvrant des chemins disjoints.

**Pattern interdit :**
- **`start(sendEmailWorkflow)` directement dans un call-site** (server action, cron, etc.). Toujours passer par `enqueueEmail` ou par un wrapper `enqueueXxxEmail` dans `lib/emails.ts` qui encapsule le fallback synchrone et le Sentry tagging.
- **INSERT direct dans `notifications_log` depuis le workflow function ou un step custom** : passer par le helper neutre `logNotification` (lib/notifications-log.ts) appele depuis le step. Code review 2026-05-08 P3/P6 : pas de step imbrique pour le INSERT BDD, pas de duplication entre `lib/emails.ts` et le module workflow.

**Regle :** Tout futur flow email differe (Epic 5+) suit le pattern (a) ajouter un nouveau template au type union `SendEmailTemplate`, (b) etendre le step `sendEmailViaResend` avec le rendu HTML correspondant, (c) ajouter une fonction `enqueueXxxEmail` dans `lib/emails.ts` qui inclut le fallback synchrone vers la fonction historique. Migration big-bang explicitement rejetee : la migration des 16 autres helpers email (welcome, validation, parrainage, admin, contact, etc.) reste pilotee par signal Sentry au cas par cas.

## 2026-05-09 : Tests d'integration backend - Vitest + Supabase local + mocking Resend/Sentry/Workflow (decision F8)

**Decision :** Le projet roxanetnous adopte un pattern de tests d'integration backend dedie aux invariants metier critiques (signature webhook Stripe + paywall server actions). Le runner est **Vitest v4** (et non Playwright comme suggere `epic-4.md` AC1). La structure est :

- **`tests/integration/`** : dossier dedie, parallele a `tests/a11y/` (axe-core Playwright). Sous-dossiers `stripe-webhook/` (5 tests AC2), `paywall/` (5 tests AC3), `_lib/` (helpers).
- **`vitest.config.ts`** au root : `pool: 'forks'`, `fileParallelism: false`, `testTimeout: 15_000`, `setupFiles: ['tests/integration/setup.ts']`. `resolve.tsconfigPaths: true` (plugin natif Vite/Vitest 4).
- **`tests/integration/setup.ts`** : mocks globaux + garde-fou anti-prod. Refus categorique d'executer si `SUPABASE_URL` ne pointe pas `localhost`/`127.0.0.1`.
- **CI** : execution dans GitHub Actions (`.github/workflows/integration-tests.yml`) avec `supabase/setup-cli@v1` + `supabase start`. Vercel build skip via `SKIP_E2E_TESTS=true` (pas de Docker dans le runner Vercel). Branch protection rules `Require status checks: integration-tests / integration` sur main (action manuelle Sylvain).

**Motivation :** AI-3.2 retro Epic 3 (« tests metier critiques bloquants go-live Bretagne »). Couverture explicite des 5 cas Stripe (T1 checkout valide, T2 parrainage anti-fraude `meme_carte`, T3 invoice failed, T4 subscription deleted, T5 signature invalide) + 5 cas paywall (T6 visiteur, T7 sans abo, T8 abonne, T9 expire mid-conversation, T10 admin bypass). Filet de securite contre les regressions de la classe « event Stripe perdu = utilisateur sans abonnement malgre carte debitee » et « paywall contourne = perte de revenu ».

**Alternatives rejetees :**
- **Playwright pour tests integration backend (suggere epic-4.md AC1)** : sur-dimensionne. Les 10 tests n'ont pas besoin de browser. Playwright impose `webServer: { command: 'npm run dev' }` qui ajoute 10-30 s par run. Vitest tourne en process Node natif en quelques secondes. Playwright reste reserve aux tests UI a11y existants (`tests/a11y/`).
- **Jest** : friction ESM bien connue dans Next.js 16 + `"type": "module"`. Vitest est ESM-native, pas de `babel-jest` ni `--experimental-vm-modules`.
- **supertest + serveur HTTP demarre via `next start`** : redondant. Un endpoint Next.js App Router est testable en l'important directement (`import { POST } from '@/app/api/webhooks/stripe/route'`) avec un `NextRequest` mocke.
- **`stripe-mock` Docker container** : ajoute dependance Docker dans le workflow GHA + certains endpoints obsoletes vs api_version `2026-03-25.dahlia`. Mock inline `vi.mock('@/lib/stripe', ...)` retenu (D7).
- **Tests contre Supabase staging** : risque de pollution staging avec rows de tests, latence reseau 100-300 ms x N queries, tests non-reproductibles si plusieurs PR tournent en parallele. Garde-fou code-level dans `setup.ts`.
- **Couplage avec story 4.7 (seeds Supabase)** : 4.7 est ordre 2. 4.4 est ordre 1. Bloquer 4.4 sur 4.7 = report go-live. Fixtures inline minimales livrees ; refactor mecanique vers seeds 4.7 quand celle-ci livre (D2).

**Pattern d'integration :**
- **Helper Stripe webhook (`tests/integration/_lib/stripe-webhook-helper.ts`)** : `createStripeEvent(type, data)` + `signStripeEvent(event, secret)` (utilise `Stripe.webhooks.generateTestHeaderString` reel) + `postWebhookEvent(event)` (NextRequest mocke + appel direct POST handler). Pas de serveur HTTP.
- **Helper fixtures BDD (`tests/integration/_lib/fixtures.ts`)** : `createTestUser(role)`, `createTestSubscription(userId, opts)`, `createTestAccompagnanteProfile`, `createTestAccompagneProfile`, `createTestConversation`, `createTestMessage`, `createTestParrainage`. Tracker `Array<{ table, id }>` global. `cleanupAllFixtures()` DELETE en ordre FK-safe + balayage `auth.users`.
- **Helper session paywall (`tests/integration/_lib/supabase-session-mock.ts`)** : `mockSupabaseSession(userId)` surcharge `vi.mocked(createClient)` pour fournir un client admin avec `auth.getUser()` simule. Indispensable pour tester les server actions sans cookies reels.
- **Mocks globaux** : `@sentry/nextjs` no-op, `resend` (classe `FakeResend`), `@/lib/email-queue.enqueueEmail`, `@/lib/emails.send*` (synchrones du webhook), `@/lib/stripe.{subscriptions,paymentMethods,checkout,customers}`, `next/headers.cookies()`, `@/lib/supabase/server.createClient`. Surcharges per-test via `vi.mocked(...).mockResolvedValueOnce(...)`.
- **Idempotence cross-tests** : chaque event Stripe genere un `event.id` UUID v4 unique pour eviter collisions sur `stripe_events_processed`.

**Pattern interdit :**
- **`INSERT/UPDATE/DELETE` direct dans une table BDD prod depuis `tests/integration/`** : tous les tests doivent tourner contre Supabase local (`SUPABASE_URL=http://localhost:54321`). Garde-fou code-level dans `setup.ts` rejete tout autre URL au demarrage.
- **Lancer un vrai serveur Resend / Workflow / Sentry depuis les tests** : tous les SDK externes doivent rester mockes globalement.
- **Skipper le cleanup** : `cleanupAllFixtures` doit etre appele dans `afterAll` (et `beforeAll` defense en profondeur) pour eviter les rows orphelines en BDD entre runs.
- **Modifier le schema BDD via migration depuis les tests** : les tests utilisent les tables existantes telles quelles. Les migrations restent gerees via `supabase/migrations/`.

**Regle :** Toute future story metier introduisant une server action sensible (paywall, signature externe, idempotence cross-system, calcul tarifaire) doit ajouter au moins **un test d'integration** dans `tests/integration/<flow>/`. Le test doit (a) utiliser les helpers existants `createTestUser`/`createTestSubscription` quand applicable, (b) mocker tout SDK externe via les patterns deja en place dans `setup.ts`, (c) cleanup ses fixtures via le tracker global. Le code review rejette toute extension de logique Stripe webhook ou paywall server action sans test d'integration accompagnant.

## 2026-05-09 : Sync migrations historiques + seeds tests integration (decision F9)

**Decision :** Le projet roxanetnous capture l'historique COMPLET de ses migrations BDD dans `supabase/migrations/` (53 fichiers a la livraison story 4.7). Cela inclut 27 migrations brownfield (2026-02-16 -> 2026-04-09) recuperees via Supabase MCP le 2026-05-09 a partir de `supabase_migrations.schema_migrations` en prod. Un dossier `supabase/seeds/` est introduit avec 4 fichiers SQL minimaux (5 utilisateurs + 1 parrainage cours + 1 parrainage bloque + 5 waitlist + 2 subscriptions) appliques via `npm run seed:test` et `scripts/seed-test-supabase.mjs`.

**Motivation :** Au premier run du workflow GHA `Integration Tests` story 4.4 (run #25502322720), `supabase start` a echoue sur la migration `drop_avis_feature` qui presumait l'existence des tables `signalements` et `avis`. Cause : Epic 1 livre retroactivement avant adoption BMad formelle, schema initial jamais capture en migration formelle. Cette story 4.7 leve la dette brownfield, debloque la CI integration tests (run #25504890455 : 14/14 verts), et installe les fondations pour toute future story BDD reproductible (preview env, runner CI, onboarding nouveau dev).

**Alternatives rejetees :**
- **Ecrire une migration init synthetique via `pg_dump`** : reconstitue l'etat final mais perd l'historique des 52 migrations. Casse la traceabilite : impossible de comprendre pourquoi telle policy RLS existe ou pourquoi telle colonne a ete renommee.
- **Skip la migration `drop_avis_feature` en CI uniquement** (via guard `IF EXISTS` chirurgical) : creerait une divergence schema CI vs prod et masquerait la dette plutot que la lever.
- **Cluster Supabase staging dedie tests** : surcout permanent + risque de pollution + tests non-reproductibles si plusieurs PR tournent en parallele.
- **Couplage fort seeds <-> fixtures inline story 4.4** : aurait casse les 10 tests existants pour gain marginal. Coexistence retenue (fixtures inline souveraines pour les tests existants ; seeds pour futures stories Epic 5+).

**Pattern d'integration :**
- **Recuperation via Supabase MCP** : `mcp__supabase__execute_sql 'SELECT version, name, statements FROM supabase_migrations.schema_migrations WHERE version < ''20260418140024'' ORDER BY version'`. Le champ `statements` est un `TEXT[]` Postgres : un element = une instruction SQL. Le contenu est joint par `;\n` et ecrit fidelement dans `supabase/migrations/{version}_{name}.sql`.
- **Drift versioning prod vs local** : la prod utilise des versions Supabase Cloud (`20260418140024_drop_avis_feature`), le repo local utilise un schema custom anterieur (`20260418135719_drop_avis_feature`). Alignement par **nom**, pas par version. Le diff `supabase migration list` retourne donc des differences attendues sur les 27 migrations brownfield. Documente dans `supabase/README.md`.
- **Seeds via auth.admin.createUser + UPDATE** : le trigger `handle_new_user` (migration brownfield `20260404134919_rename_*`) cree automatiquement la row `public.users` + le profil correspondant au `role` du metadata lors de l'INSERT dans `auth.users`. Les seeds UPDATE ensuite pour enrichir les champs metier (`validation_status`, `adresse`, etc.). Ne jamais faire `INSERT INTO public.users` direct -> conflit FK avec `auth.users` ou doublon trigger.
- **UUID fixes** `'00000000-0000-0000-0000-00000000000X'` pour reproductibilite cross-runs. Permet aux tests futurs de hard-coder un UUID admin/marraine sans creer de fixture.
- **Garde-fou anti-prod** : refus categorique si `SUPABASE_URL` ne contient pas `localhost`/`127.0.0.1`. Pattern aligne sur `tests/integration/setup.ts` D4 story 4.4. Pas d'override `--force`.
- **Workflow GHA** : step `Apply test seeds` ajoute apres `Capture Supabase keys` et avant `Run integration tests`. Recupere `ANON_KEY` + `SERVICE_ROLE_KEY` via `supabase status --output json | jq` + masquage `::add-mask::`.

**Pattern interdit :**
- **Modifier le SQL des migrations historiques** : pas de cleanup retroactif (pas d'ajout de `search_path`, pas de re-ecriture des policies RLS, pas de simplification stylistique). L'epoque 2026-02 -> 2026-04 est figee. Toute amelioration future passe par une nouvelle migration explicite.
- **`apply_migration` directement en prod sans migration formelle locale d'abord** : toute future story qui touche au schema BDD doit (a) creer une migration `supabase/migrations/{version}_{nom}.sql` dans le repo, (b) verifier que `supabase start` reussit en local apres ajout, (c) appliquer en prod via Supabase Cloud CLI/dashboard une fois review acceptee.
- **`INSERT INTO public.users` direct dans un seed ou un test** : utiliser `supabase.auth.admin.createUser({ id, user_metadata: { role } })` puis UPDATE, pour respecter le trigger `handle_new_user`.
- **Seeder le schema prod via `npm run seed:test`** : garde-fou code-level rejette tout SUPABASE_URL non local au demarrage.

**Regle :** Toute future story qui touche au schema BDD doit (a) creer une migration formelle dans `supabase/migrations/` AVANT toute modification prod, (b) verifier que `supabase start` reussit en local apres ajout (le repo doit toujours etre suffisant pour reconstruire la BDD vierge), (c) si la story introduit une nouvelle table que les futures stories voudront seeder pour leurs tests, ajouter un fichier `supabase/seeds/0X_<table>.sql` + etendre `scripts/seed-test-supabase.mjs`. Le code review rejette toute migration locale qui n'a pas ete testee via `supabase start` en local ou via le workflow GHA `Integration Tests`.

## 2026-05-09 : Detection IP cliente - centralisee via `lib/get-client-ip.ts` (decision F10)

**Decision :** Toute lecture de l'IP cliente dans le code metier passe par le helper `lib/get-client-ip.ts` qui expose deux fonctions :

- `getClientIp(headers): string | null` : retourne l'IP cliente sanitisee par Vercel Proxy ou `null` si indeterminee (cas dev local hors-Vercel).
- `getClientIpOrUnknown(headers): string` : meme contrat avec fallback string `'unknown'`. Reserve aux usages de cle (rate-limit) ou un string non-null est requis.

L'helper delegue a `ipAddress()` du SDK `@vercel/functions@^3.5.0` (ajoute en `dependencies` directe). En interne, `ipAddress()` lit le header `x-real-ip` (constante `IP_HEADER_NAME` du SDK) qui est sanitise par Vercel Proxy a chaque requete a partir du tunnel TLS et donc immune au spoofing cote client. Lecture directe de `x-forwarded-for`, `x-real-ip`, `cf-connecting-ip`, `true-client-ip` dans le code metier interdite. La propriete `request.ip` n'existe plus dans Next.js 16 (depreciee depuis 13.4) et ne doit pas etre reintroduite.

**Motivation :** AI-3.5 retro Epic 3 (« hardening IP spoofing »). Avant la story 4.5, trois call-sites lisaient `headers().get('x-forwarded-for')?.split(',')[0]?.trim() || headers().get('x-real-ip')` (`app/actions/parrainage.ts:332-342` rate-limit `validateCode`, `app/actions/auth.ts:93-97` `ipInscription` parrainage signup, `app/actions/waitlist.ts:41-45` rate-limit waitlist + `ip_inscription`). Ce pattern presentait quatre risques : (a) **anti-spoofing** : `x-forwarded-for` est manipulable cote client (un attaquant qui change son IP a chaque requete reset le compteur rate-limit `validate_code` 5/min/IP, story 4.1, et corrompt l'analyse anti-fraude `meme_ip` parrainage, story 2.3), (b) **portabilite** : le pattern « premier element XFF = trusted proxy » n'est pas universel (Cloudflare/AWS divergent), un changement futur de plateforme casse 3 fichiers, (c) **clarte** : 3 occurrences divergentes (fallback `'unknown'` vs `null`) qui derivent independamment, (d) **levee dette** : le commentaire TODO `parrainage.ts:332` (« story 4.5 : remplacer x-forwarded-for ») documentait explicitement l'engagement d'acquittement.

**Alternatives rejetees :**
- **`request.ip` Next.js (suggere `epic-4.md` AC1 + `architecture-technique-roxanetnous-2026-02-09.md:3856`)** : retire dans Next.js 15+. Inutilisable.
- **`x-vercel-forwarded-for` (suggere `epic-4.md` AC1)** : ce nom de header n'existe pas dans le SDK `@vercel/functions@3.5.0` (constantes : `IP_HEADER_NAME = "x-real-ip"` + `x-vercel-ip-*` pour geolocation). Le header sanitise officiel est `x-real-ip`, lu via `ipAddress()` pour beneficier de la stabilite future de l'API SDK.
- **Une seule fonction `getClientIp(headers, fallback?: string)`** : signature moins claire au call-site. Deux fonctions distinctes garantissent un typage TypeScript exact (`string | null` vs `string`) sans magic string `'unknown'` au call-site (D2).
- **Garde-fou par regle ESLint custom** : ajoute une dependance ESLint, charge l'AST TypeScript a chaque check. Grep simple via `scripts/check-ip-spoofing.mjs` (~30 lignes Node.js) execute en <100 ms, executable depuis `vercel.json:buildCommand` sans build TypeScript (D3). Tradeoff : pattern interdit en commentaire serait flagged. Allowlist `lib/get-client-ip.ts` + `scripts/check-ip-spoofing.mjs` qui documentent legitimement les strings.
- **`@vercel/functions` en transitif (via `next` + `@workflow/next`)** : depend du planning des bumps majors Next.js / Workflow. Ajout en `dependencies` directe (pinned `^3.5.0`) protege contre un retrait transitif eventuel et clarifie l'intention (D1).
- **Reutiliser le runner Vitest integration pour les tests unitaires purs** : aurait force le helper a charger `tests/integration/setup.ts` (mocks Supabase/Sentry/Resend/Stripe inutiles). Configuration Vitest 4 multi-projets (`projects: [integration, unit]`) introduite -> les tests unitaires tournent sans setup lourd en <200 ms (D4).

**Pattern d'integration :**
- **Helper portable** : `lib/get-client-ip.ts` n'importe que `@vercel/functions` (pas Next.js, pas Supabase, pas Sentry). Reutilisable cote middleware Edge, server actions Node, route handlers, futurs workers Workflow.
- **Type `RequestHeaders`** exporte (`{ get(name: string): string | null }`). Compatible `ReadonlyHeaders` de `next/headers` sans cast ni `as any`.
- **Garde-fou `npm run check:ip-spoofing`** : `scripts/check-ip-spoofing.mjs` execute `grep -rEn "x-forwarded-for|x-real-ip" --include='*.ts' --include='*.tsx' --include='*.mjs' --exclude='*.test.ts' app/ lib/ scripts/`. Allowlist explicite : `lib/get-client-ip.ts` + `scripts/check-ip-spoofing.mjs` (commentaire/regex documentant le pattern interdit). Integre au `vercel.json:buildCommand` apres `lint:a11y-check` et avant `test:integration`.
- **Tests unitaires (`tests/unit/`)** : nouveau projet Vitest distinct (`vitest.config.ts:projects.unit`). Pas de setup lourd, pas de Supabase. Pattern `makeHeaders(entries: Record<string, string>)` factory pour eviter `as any`.
- **Pattern fail-loud** : `getClientIp` retourne `null` (et non un fallback string trompeur) quand l'IP est indeterminee. Les call-sites doivent gerer explicitement le cas null. Ex : `parrainage.ts:86` `if (params.ipInscription && params.ipInscription.trim())` deja en place pour la detection anti-fraude.
- **Sentry et PII** : l'IP cliente n'est jamais envoyee a Sentry. Les events rate-limit incluent `keyHash = hashRateLimitKey('validate_code:<ip>')` HMAC-sale (`lib/rate-limit-hash.ts`, story 4.1 / DECISIONS F4). Cette story 4.5 ne modifie pas Sentry.

**Pattern interdit :**
- **`headers().get('x-forwarded-for')` ou `headers().get('x-real-ip')` dans le code metier** : utiliser `getClientIp(headers)` ou `getClientIpOrUnknown(headers)`. Le garde-fou `npm run check:ip-spoofing` rejette toute regression au build Vercel.
- **`request.ip`** : retire dans Next.js 16. Si reintroduit, casse au runtime.
- **Lecture de `cf-connecting-ip` / `true-client-ip` cote application** : pas Vercel-natif. Si une migration de plateforme est decidee Epic 6+, l'extension passe par modification de `lib/get-client-ip.ts` (un fichier) et non par les call-sites.
- **Envoi de l'IP brute dans un event Sentry / log structure / champ analytics tier** : passer par `hashRateLimitKey()` (HMAC-sale) ou stocker uniquement en BDD (`parrainages.ip_inscription`, `waitlist_departements.ip_inscription`) avec le helper.

**Regle :** Toute future story qui a besoin de l'IP cliente (alerting Sentry granular IP, analytics, detection abuse, geolocation) consomme `lib/get-client-ip.ts`. Si une nouvelle plateforme d'hebergement (Cloudflare, AWS) est introduite, l'extension passe par modification de `lib/get-client-ip.ts` -> automatiquement disponible aux 3 call-sites existants sans diff. Le code review rejette toute regression `x-forwarded-for` / `x-real-ip` dans `app/`, `lib/`, `scripts/` (le garde-fou CI Vercel exit 1 avant meme le code review).

## 2026-05-09 : Typage strict pages admin via `types/supabase.ts` MCP-genere + cast localise + garde-fou (decision F11)

Les pages admin Server Components (`app/admin/`) consomment Supabase via 7 fichiers (`page.tsx`, `historique/page.tsx`, `messages/page.tsx`, `messages/[id]/page.tsx`, `annonces/page.tsx`, `signalements/page.tsx`, `validation/[id]/page.tsx`). Avant la story 4.6, ces pages contenaient 8 occurrences `\bas any\b` reparties pour cast les jointures imbriquees Supabase (`users:user_id` / `accompagnantes_profiles:accompagnante_id`) et la colonne JSONB `admin_actions_log.details: Json | null`. Le projet adopte (1) un fichier `types/supabase.ts` (~1700 lignes) genere par le MCP `supabase__generate_typescript_types` (autoritaire pour les types BDD), (2) un cast localise au point d'appel `(await createClient({ serviceRole: true })) as unknown as SupabaseClient<Database>` dans chaque page admin Server Component (variante locale par rapport au plan initial qui generic-typait les 3 client factories `lib/supabase/{client,server,middleware}.ts`), (3) un garde-fou `npm run check:as-any-admin` integre `vercel.json:buildCommand` qui rejette tout `\bas any\b` dans `app/admin/`.

**Motivation :** AI-3.6 retro Epic 3 (« Types `as any` pages admin - candidat I severite jaune ») et candidat I deferred-work Epic 2. Avant la story 4.6, le `as any` neutralisait toute detection schema drift a la compilation TypeScript : un renommage de colonne BDD (`users.first_name` -> `users.firstName`) ou la suppression d'une jointure FK produirait un crash runtime silencieux dans `app/admin/page.tsx:121` `{u?.first_name}` plutot qu'une erreur `tsc --noEmit`. Le typage `<Database>` apporte (a) detection schema drift a la compilation, (b) autocompletion editor (LSP) sur les jointures, (c) acquittement dette retro Epic 3, (d) pattern reutilisable pour Epic 5+.

**Pattern interdit :**
- **Tout nouveau `\bas any\b` dans `app/admin/`** : rejete par `npm run check:as-any-admin` (exit 1) integre `vercel.json:buildCommand` avant `next build`.
- Si un cast genuinement justifie est necessaire : prefere un type local (cf. `AdminLogDetails` dans `app/admin/historique/page.tsx`) ou commente `// eslint-disable-next-line @typescript-eslint/no-explicit-any -- justification`.

**Procedure de regeneration :** apres chaque migration BDD modifiant le schema public, lancer le MCP `supabase__generate_typescript_types` et copier le retour integralement dans `types/supabase.ts` (conserver le header 4 lignes). Verifier `npm run check:types:supabase` exit 0 (script documentaire + check-presence ; renomme depuis `gen:types:supabase` au review patch 4 story 4.6 pour refleter le fait qu'il verifie sans generer) puis `npx tsc --noEmit` exit 0.

**Cast localise (variante SCP, decision D5 story 4.6) :** Le plan initial genericisait les 3 client factories `lib/supabase/{client,server,middleware}.ts` via `<Database>`. Implementation concrete revele 48 nouvelles erreurs TypeScript reparties sur 17 fichiers hors-admin (`lib/ocr.ts`, `app/api/cron/confirm-parrainages/route.ts`, `app/actions/parrainage.ts`, `app/actions/admin-parrainages.ts`, `lib/matching-notifications.ts`, etc.) car le typage strict expose des nullable narrowing pre-existants (`marraine_id: string | null`) et un schema drift sur `lib/ocr.ts` qui reference une table `ocr_results` absente du schema. La directive D5 de la story prevoit STOP+SCP au-dela de 5 fichiers hors-admin impactes. Decision SCP : factories restent `unknown` typees, cast localise au point d'appel uniquement dans les 7 pages admin via `(await createClient({ serviceRole: true })) as unknown as SupabaseClient<Database>`. Bilan : 0 fichier hors-admin modifie, AC15 perimetre fichiers respecte, 8 `\bas any\b` resorbes via le typage local. Les 48 erreurs TypeScript hors-admin restent un candidat differe (story 4.6.b ulterieure ou Epic 5+).

**Desambiguisation FK Supabase :** plusieurs jointures admin utilisaient la syntaxe `users:user_id` qui ne compile plus avec `<Database>` strict quand la table source a 2+ FK vers `users` (ex : `signalements` a `auteur_id` et `traite_par`, `accompagnantes_profiles` a `user_id` et `validated_by`, `conversations` a 3 FK admin/aux/ben). Migration vers la syntaxe `users!user_id` (force-foreign-key par nom de colonne FK) qui desambigue explicitement et compile clean. Sementiquement equivalent a runtime : Supabase resout la FK via le nom de colonne plutot que par convention.

**Alternatives rejetees :**
- **CLI Supabase `npx supabase gen types`** : rejetee (binaire ~50 Mo en devDependency pour usage rare ; le MCP est autoritaire pour ce projet, cf. `.claude/CLAUDE.md`).
- **ESLint custom rule `@typescript-eslint/no-explicit-any` (block au lieu de warn)** : rejetee (pas de scope `app/admin/` only, casserait le baseline 213 warnings preexistants hors-admin).
- **Generic-typage des 3 client factories `<Database>`** : explore puis rejetee post-SCP. Genere 48 erreurs hors-admin sur 17 fichiers (>5 fichiers limite D5). Reportee story 4.6.b ulterieure.
- **Migration manuelle des `as any` hors `app/admin/`** : reportee story 4.6.b ulterieure (cf. `epic-4.md` hors scope §1).
- **Helpers `Tables<>`, `TablesInsert<>` systematiques au lieu d'inference fluide** : non requis pour les pages admin (l'inference Supabase via `<Database>` post-cast suffit). Disponibles dans `types/supabase.ts` pour futures stories.

**Pattern d'integration :**
- **`types/supabase.ts`** : header 5 lignes documentant la procedure de regeneration. Greenfield (premier fichier `types/`). Schema source : `public` (25 tables, 1 view, 6 enums, 12 RPC functions).
- **Cast localise** : chaque page admin Server Component importe `import type { SupabaseClient } from '@supabase/supabase-js'` + `import type { Database } from '@/types/supabase'`, puis caste `(await createClient({ serviceRole: true })) as unknown as SupabaseClient<Database>`. Le `as unknown as` est un pattern TypeScript classique pour le typage cross-boundary quand la fonction source retourne un type que TypeScript ne peut pas narrow automatiquement. Pas de modification de la signature publique de `createClient`.
- **Type `AdminLogDetails`** : alias type local au fichier `historique/page.tsx` qui documente la forme attendue cote frontend pour le narrowing de `admin_actions_log.details: Json | null`. Pas exporte vers `types/` (forme specifique au pattern admin, pas une primitive metier reutilisable).
- **Type `RawAnnonceWithProfile`** : helper type local au fichier `annonces/page.tsx` pour reconcilier l'union des 2 retours Supabase (annonce_aux / annonce_ben) avant le `.map()`. Pattern D7 (cast type concret tolere, pas une elision `as any`).
- **`scripts/check-as-any-admin.mjs`** : calque exact `scripts/check-ip-spoofing.mjs` (story 4.5). Grep recursif `\bas any\b` sur `app/admin/` *.ts/*.tsx. Exit codes 0/1/2. Allowlist vide (la story livre 0 occurrence).
- **Integration `vercel.json:buildCommand`** : `npm run check:env && npm run lint:a11y-check && npm run check:ip-spoofing && npm run check:as-any-admin && (test "$SKIP_E2E_TESTS" = "true" || npm run test:integration) && next build`.
- **`scripts/check-types-supabase.mjs`** (renomme depuis `gen-types-supabase.mjs` au review patch 4 story 4.6) : procedure documentaire + check-presence (~50 lignes). Verifie que `types/supabase.ts` existe + contient `export type Database`. Affiche systematiquement la procedure MCP au stdout pour rappeler "verifie, ne regenere pas". Pas d'auto-regeneration (le MCP requiert une session Claude Code interactive). Script npm associe : `npm run check:types:supabase`.

**Regle :** Toute future story qui touche `app/admin/` ne peut introduire un nouveau `\bas any\b`. Le garde-fou `npm run check:as-any-admin` rejette la regression au build Vercel avant meme le code review. Si une migration BDD modifie le schema public, regenerer `types/supabase.ts` via le MCP avant de livrer la story metier (cf. procedure de regeneration). La levee du `as unknown as SupabaseClient<Database>` cast localise vers un typage natif des factories est candidate Epic 5+ (story 4.6.b) qui devra adresser les 48 erreurs TypeScript hors-admin (nullable narrowing + schema drift `ocr_results`).

---

## 2026-05-13 : Sprint Epic 5 demarre en parallele du go-live Bretagne (decision F-Epic5-0)

**Decision :** Le sprint Epic 5 demarre des le 2026-05-13, en parallele du go-live Bretagne prevu lundi 2026-05-18 (toggle admin premier departement). Les 3 audits 7j herites Epic 4 (AI-4.1 Sentry, AI-4.2 GHA, AI-4.3 toggle admin) passent du statut "bloquants" au statut "observation passive en parallele".

**Motivation :** Epic 5 est un chantier d'hardening transverse independant fonctionnellement du go-live Bretagne :
- Mini-epics 5.C (hardening typage / nettoyage CI) et 5.E (observabilite oncall) n'ont aucune surface commune avec les flux critiques Epic 4 sous observation.
- Mini-epic 5.A demarre par une architecture review (5.A.1) sans impact code/BDD.
- L'ajout d'une observabilite oncall (5.E.1) est meme un benefice direct pour la fenetre go-live (notification active Slack vs consultation passive dashboard Sentry).
- Le cadrage initial 2026-05-13 (`epic-5.md`) marquait les 3 AI comme "pre-requis bloquants" par heritage mecanique de la retrospective Epic 4, sans interroger la pertinence pour Epic 5 specifiquement.

**Conditions d'observation parallele (non-bloquantes mais surveillees) :**
- **AI-4.1 Sentry** : si exception critique non-attendue emerge pendant Epic 5, declencher `bmad-correct-course` avant d'embrayer une nouvelle story.
- **AI-4.2 GHA** : si CI redevient instable sur 4.4/4.7, prioriser le fix avant les stories Epic 5 qui touchent la CI (5.C.4 notamment).
- **AI-4.3 toggle admin** : geste manuel independant, peut etre fait avant/pendant/apres le sprint Epic 5.

**Ordre de demarrage retenu :**
1. **5.E.1 coupling Sentry -> Slack** en premier (livre avant go-live lundi = monitoring actif pendant la fenetre critique).
2. **5.A.1 architecture review renommage** ensuite (tech-spec, sans impact code/BDD).
3. **5.C.x** en parallele opportuniste (4 stories Verte/Orange independantes).
4. **5.A.2-5.A.6** chaine sequentielle apres stabilisation go-live.
5. **5.B.x** apres 5.A merged.
6. **5.D.x** differe naturellement >= 2026-06-08.

**Regle :** Le sprint Epic 5 peut etre interrompu a tout moment par `bmad-correct-course` si un incident Epic 4 emerge. Aucune story 5.A.2+ (impact BDD) ne sera lancee pendant la fenetre 5j entourant le go-live lundi (du vendredi 2026-05-16 au mercredi 2026-05-21 inclus).

---

## 2026-05-13 : Canal oncall = Email Sentry + push notifs iPhone Mail (decision F-Epic5-E1, revisee 2 fois)

**Decision :** Pour le canal d'alertes oncall livre par story 5.E.1, le canal retenu est l'**email Sentry standard** avec **push notifications natives activees sur l'app Mail / Gmail de l'iPhone** de Sylvain.

**Historique decision (3 revisions le 2026-05-13) :**

1. **Decision initiale matin** : Slack. Annulee (Sylvain n'utilise pas Slack).
2. **Decision revisee apres-midi** : Sentry mobile app native. **Annulee : l'app mobile Sentry n'existe pas** (verification web search 2026-05-13). C'etait une erreur de Claude qui aurait du verifier l'existence du produit avant de le recommander.
3. **Decision finale** : email + push notifs systeme. Aligne sur le canal email Sentry deja actif depuis Epic 4 story 4.1.

**Motivation finale :**
- Sylvain est seul oncall : pas de besoin de plateforme tierce.
- L'email Sentry est deja configure et envoie deja les alertes (Epic 4 story 4.1).
- Push notifications iOS sur app Mail = equivalent fonctionnel a un canal push dedie, avec son + banniere + badge.
- Zero integration tierce a maintenir : pas d'OAuth, pas d'app supplementaire, pas de webhook.
- Setup minimal (~2 min) : verifier push notifs systeme iOS sur l'app Mail / Gmail.
- Compatible offline / changement de phone : les emails restent accessibles meme apres factory reset, pas de re-configuration push tier.

**Alternatives rejetees :**
- **Slack** : non utilise.
- **Sentry mobile app native** : n'existe pas (Sentry est un service web, pas une app dev mobile).
- **PagerDuty / Opsgenie** : payants, surdimensionnes solo.
- **Discord / Telegram** : surfacage OAuth sans benefice si email natif suffit.
- **ntfy.sh / Pushover** : push pur via webhook, plus flexible mais surcharge setup pour un cas d'usage simple.
- **SMS via Twilio** : cout par message.

**Pattern d'integration :**
- **Email Sentry** : deja actif. Verifier que `roxanetnous@outlook.com` est bien l'email destinataire dans Sentry Settings -> Account -> Notifications.
- **Push notifs iPhone** : iOS Reglages -> Notifications -> Mail (ou Gmail) -> activer "Autoriser les notifications", "Sons", "Bannieres", "Badges". Si plusieurs comptes email, activer specifiquement pour le compte `roxanetnous@outlook.com`.
- **Regles d'alerte Sentry** (Settings -> Alerts -> Create Alert Rule) :
  1. Toute nouvelle exception non-resolved + tag `severity: 'critical'` -> Action : Send Email a `roxanetnous@outlook.com`. Frequency : immediate (5 min cooldown).
  2. Seuil frequence > 10 exceptions/min sur n'importe quel tag -> Send Email immediate.
  3. Erreur dans chemins critiques (`flow: 'webhook-stripe' | 'paywall' | 'parrainage' | 'email'`) non-resolved depuis > 5 min -> Send Email immediate.
  4. Alertes non-critical (`severity: 'warning'`) -> Daily digest 9h00 (un seul email aggrege par jour, pas de push push individuel).
- **Subject lines explicites** : utiliser dans le template Sentry des prefixes type `[CRITICAL]`, `[BURST]`, `[WEBHOOK]` pour identification rapide via banniere iPhone sans ouvrir l'email.
- **Test de bout en bout 5.E.1** : declencher exception intentionnelle taggee `severity: 'critical'` en preview env via une route metier reelle, mesurer delai reception push notification iPhone (cible < 2 min).

**Regle :** L'integrite du canal email est consideree infrastructure critique. Verifier (a) que `roxanetnous@outlook.com` reste accessible (pas de spam folder Sentry), (b) que les push notifs iPhone restent actives apres mises a jour iOS, (c) que les alertes Sentry arrivent bien dans la boite principale (configurer une regle Outlook pour les marquer prioritaires si necessaire). Documente dans `architecture-technique-roxanetnous-2026-02-09.md` section Observabilite & Monitoring a la livraison 5.E.1.

**Lecon apprise :** verifier l'existence d'un produit avant de le recommander dans un cadrage. Le ping-pong Slack -> Sentry mobile -> Email aurait pu etre evite avec un audit en amont (questions : "quelle plateforme de chat utilises-tu ?", "quelle est ta tolerance push notif vs email ?").

**Resultat livraison 2026-05-13 (test bout-en-bout reussi)** :
- 4 alert rules creees dans Sentry web (critical immediate, burst >10/min, chemins critiques flow, daily digest warnings).
- Push notifications iOS Mail activees sur le compte `roxanetnous@outlook.com`.
- Test bout-en-bout : declenchement exception preview env -> email Sentry recu -> banniere iPhone Mail affichee. Delai < 2 min conforme.
- Story 5.E.1 cloturee `done` dans sprint-status.yaml.
- Mini-epic 5.E entierement livre (1/1 story done).

---

## 2026-05-13 : Strategie migration enum role `accompagnante` -> `accompagnant` = cutover atomique avec valeur orpheline differee (decision F12)

**Decision :** Le renommage du metier feminin `accompagnante` vers le masculin neutre `accompagnant` (Epic 5 mini-epic 5.A) suit une **strategie de cutover atomique** dans une seule migration BDD transactionnelle (story 5.A.2). La valeur enum orpheline `'accompagnante'` est conservee en BDD post-migration (0 ligne) et sa suppression est reportee Epic 6.

**Motivation :** Audit MCP BDD prod 2026-05-13 revele :
- **Postgres 17.6** : `ALTER TYPE ... DROP VALUE` indisponible nativement (requiert recreation enum complete, downtime supplementaire).
- **Volumetrie faible** : 822 users, 818 accompagnantes_profiles, 796 annonces_accompagnantes ; 9 autres tables a 0 ligne. Risque cutover minime.
- **15 colonnes BDD impactees dans 8 tables, 23 RLS policies dependantes sur 10 tables, 3 helpers RLS impactes** (`is_accompagnante`, `is_accompagne`, `is_document_owner`).
- **2 tables nommees apres le role feminin** (`accompagne_accompagnantes`, `annonces_accompagnantes`) : renommage de table casse 6 policies, propage dans types Supabase et code TS.

**Alternatives rejetees :**
- **Expand-contract dual-write** : surcout d'orchestration injustifie pour 822 lignes prod et 0 utilisateur en messagerie active. Helpers RLS dual `IN ('accompagnante', 'accompagnant')` apportent une dette transitoire sans benefice.
- **Alias via fonction SQL** : patch superficiel, ne resout pas la dette enum source.
- **Renommage des 2 tables** : out-of-scope 5.A. Casse 6 policies + types Supabase + code TS sans benefice utilisateur (noms tables invisibles dans l'UI). Reporte Epic 6.
- **Drop de la valeur enum orpheline `'accompagnante'`** dans 5.A.2 : impose recreation enum complete + `ALTER COLUMN TYPE` qui reecrit la table users. Cout/benefice negatif puisque la valeur orpheline a 0 ligne n'a aucun impact applicatif. Reporte Epic 6.

**Pattern d'integration retenu (story 5.A.2 - migration cutover atomique) :**

1. **Snapshot pre-cutover** : enum, 23 policies (DDL), counts users par role, body helpers. Persiste dans `_bmad-output/implementation-artifacts/snapshot-5-a-2-pre-cutover.md`.
2. **ADD VALUE enum** : `ALTER TYPE user_role ADD VALUE 'accompagnant' BEFORE 'accompagne'`.
3. **UPDATE backfill** : `UPDATE users SET role = 'accompagnant' WHERE role = 'accompagnante'` (~100 ms pour 822 lignes).
4. **RENAME COLUMN x 15** : operations metadata, < 10 ms par colonne.
5. **DROP FUNCTION** `is_accompagnante` (sans CASCADE pour controle explicite).
6. **CREATE FUNCTION** `is_accompagnant()` avec body `role = 'accompagnant'`.
7. **CREATE POLICY x 23** : recreation explicite des 23 policies inventoriees (DDL detaille dans tech-spec 5.A.1).

Fenetre cutover estimee : < 5 secondes.

**Plan rollback par mode de defaillance (5 modes documentes tech-spec 5.A.1) :**

1. Backfill UPDATE incorrect -> `UPDATE` inverse + investigation race condition.
2. Policies RLS cassees -> DROP + recreation depuis snapshot DDL.
3. Helper renomme orphelin (call site oublie) -> creer `is_accompagnante` comme alias vers `is_accompagnant`.
4. Code TS post-merge rouge -> revert commit 5.A.3.
5. Regression UX visible -> revert commit 5.A.4 ou 5.A.5.

**Regle :** Aucune story 5.A.2+ ne peut etre executee sans le snapshot pre-cutover prealable. Le snapshot est l'artefact de rollback canonical pour les modes 1, 2 et 3. La fenetre 5j entourant le go-live Bretagne (du vendredi 2026-05-16 au mercredi 2026-05-21 inclus) est exclue de l'execution 5.A.2 (cf. F-Epic5-0).

---

## 2026-05-13 : Cloture mini-epic 5.A - Renommage `accompagnante` -> `accompagnant` execute (decision F12bis)

**Decision :** Le mini-epic 5.A (renommage `accompagnante` -> `accompagnant`) est livre integralement le **2026-05-13** en assumant l'ecart F-Epic5-0/F12 (execution dans la fenetre 5j entourant le go-live Bretagne, lundi 2026-05-18).

**Justification de l'ecart :** Sylvain a choisi de derouler la chaine complete 5.A.2 -> 5.A.6 le 2026-05-13 plutot que d'attendre le 2026-05-21. Le risque cutover BDD a ete juge faible compte tenu :
- Volumetrie prod minimale (822 users, 9 tables a 0 ligne).
- Strategie cutover atomique (downtime mesure < 1 sec).
- Pas de coexistence simultanee avec une activation departement Bretagne (le toggle reste prevu lundi).
- Audits 7j Sentry / GHA en observation passive (non bloquants).

**Resultat execution :**

| Story | Commit | Resultat |
|---|---|---|
| 5.A.2 | (a venir) | Migration enum + 15 colonnes + 3 helpers RLS + 23 policies recreees en 2 parts (Postgres < 18 ADD VALUE limitation). 818 users migres `accompagnante` -> `accompagnant`. Sentry verifie zero exception post-cutover. |
| 5.A.3 | (a venir) | Regeneration types/supabase.ts via MCP (~1670 lignes). Find-replace 45 occurrences `role === 'accompagnante'` -> `'accompagnant'` dans 17 fichiers + 8 unions de type. tsc exit 0. |
| 5.A.4 | (a venir) | `git mv app/accompagnante app/accompagnant` (6 dossiers routes) + `git mv components/accompagnante components/accompagnant`. Redirect 301 `/accompagnante/:path*` -> `/accompagnant/:path*` dans next.config.mjs. Middleware `lib/supabase/middleware.ts` mis a jour. |
| 5.A.5 | (a venir) | Copy UI deja au masculin neutre (heritage refonte foyer 2026-05-11). Seulement 2 bugs role utilisateur corriges (`role="accompagnante"` -> `'accompagnant'`). |
| 5.A.6 | (a venir) | Validations CI completes : tsc, lint:a11y-check 155 baseline, check:as-any-admin/global, check:oracle-paywall, check:ip-spoofing, test:unit 25/25. a11y:axe:check differe a preview Vercel. |

**Hors scope 5.A confirme :**

- **Valeur enum orpheline `'accompagnante'`** : conservee en BDD (Postgres < 18 DROP VALUE indisponible). 0 ligne en prod post-cutover. Suppression reportee Epic 6.
- **Renommage 2 tables `accompagne_accompagnantes` + `annonces_accompagnantes`** : conservees au feminin (decision F12 D3). Dette technique acceptee.
- **Renommage `components/layout/accompagnante-dashboard-header.tsx`** : conserve au feminin. Renommage de classe React possible Epic 6 si necessaire.

**Tracabilite :**

- Snapshot pre-cutover : `_bmad-output/implementation-artifacts/snapshot-5-a-2-pre-cutover.md`.
- Migrations Supabase : `supabase/migrations/20260513150000_renommage_accompagnante_part1_enum_value.sql` + `..._part2_backfill_rename_rls.sql`.
- Tech-spec source : `_bmad-output/planning-artifacts/tech-spec-5-a-renommage.md` (story 5.A.1).
- Baseline a11y regeneree : `_bmad-output/test-artifacts/a11y-lint-baseline-2026-05-13.txt` (155 violations, identique au total prod precedent).

**Regle :** La memoire projet `project_renommage_accompagnante_todo` peut etre marquee `done` ou supprimee. La regle CLAUDE.md ligne 6 (interdiction `accompagnante` dans la copy nouvelle) reste applicable et durcie. Le code metier historique au feminin (noms de tables `*_accompagnantes`, helpers components/layout) reste en place jusqu'a une story Epic 6 dediee si justifiee.

---

## 2026-05-13 : Plan migration BDD residuel Epic 6 mini-epic 6.A (decisions F-Epic6-A1-a/b/c)

**Contexte :** Story 6.A.1 produit le tech-spec `_bmad-output/planning-artifacts/tech-spec-6-a-renommage.md` qui detaille la migration BDD residuelle Epic 6 (3 tables encore au feminin + 1 enum value orpheline + 1 RPC orpheline + 14 contraintes historiques).

**Re-audit MCP BDD prod 2026-05-13** confirme l'inventaire et **revele deux corrections critiques** :

- **Postgres prod = 17.6 mais `ALTER TYPE ... DROP VALUE` n'est PAS implementee** (test BEGIN/ROLLBACK = `ERROR: 0A000: dropping an enum value is not implemented`). Le pattern recreate-enum d'Epic 5 D2 reste obligatoire (decision F-Epic6-A1-d).
- **Bug latent decouvert dans le trigger `handle_new_user`** : reference encore `'accompagnante'` + insere dans `accompagnantes_profiles`. Tout signup d'accompagnant depuis Epic 5 cutover devrait etre mal route. 0 cas observe en prod (aucun signup accompagnant en 1 jour) mais bug arme. Fix integre dans 6.A.2 (decision F-Epic6-A1-e).
- 3 tables a renommer : `accompagnantes_profiles` (818 lignes), `annonces_accompagnantes` (796 lignes), `accompagne_accompagnantes` (0 ligne).
- Enum value orpheline : `'accompagnante'` (0 user actif, 818 users sur `'accompagnant'`).
- RPC orpheline : `get_or_create_conversation(p_accompagnante_id uuid, p_accompagne_id uuid)` (0 caller TS).
- 11 policies RLS sur les 3 tables (vs 10 annoncees epic-6.md) - les references aux tables sont par OID donc RENAME TABLE preserve la fonctionnalite ; recreation cosmetique pour rafraichir le texte SQL.
- 14 contraintes historiques (PK + UNIQUE + FK + CHECK) portent encore les anciens noms `auxiliaires_*` / `beneficiaire_*` / `accompagnantes_*`.
- Aucune policy RLS ne reference `is_accompagnant()` ni `is_accompagne()` (verifie via pg_policies). DROP/CREATE de ces helpers safe.
- Une seule colonne typee `user_role` : `users.role` (verifie information_schema.columns). Recreate-enum reste contenu sur cette colonne (822 lignes a reecrire, ~200 ms).

### Decision F-Epic6-A1-a : Embarquer le rename de `accompagne_accompagnantes` (table vide) dans 6.A.2

**Choix :** rename inclus dans la meme migration unique 6.A.2.

**Justification :** table vide (0 ligne) -> operation triviale (sub-seconde, metadata pure). Embarquer coute negligeable et evite un report Epic 7+ pour une operation ridiculement petite. Coherence terminologique totale post-Epic 6 = zero residu feminin BDD.

### Decision F-Epic6-A1-b : Renommer toutes les contraintes BDD historiques (14 contraintes)

**Choix :** renommer les 14 contraintes PK + UNIQUE + FK + CHECK qui portent encore les anciens noms `auxiliaires_*` / `beneficiaire_*` / `accompagnantes_*` dans la migration 6.A.2.

**Justification :** operation metadata pure (< 100 ms cumule). Aligne le schema BDD avec la terminologie cible. Eclaircit les messages d'erreur runtime (`auxiliaires_profiles_user_id_fkey violated` n'est plus deroutant). Aligne avec l'esprit Epic 6 = solder la dette terminologique residuelle.

### Decision F-Epic6-A1-c : Migration directe en prod, sans branche Supabase preview

**Choix :** `apply_migration` directement sur la BDD prod dans une fenetre hors heures de pointe (nuit FR ou matin tres tot, pas dimanche soir).

**Justification :** toutes les operations de la migration sont du DDL metadata pur (RENAME table/contraintes, DROP VALUE Postgres 17 natif, DROP FUNCTION, DROP/CREATE policies cosmetiques). Cutover estime < 1 seconde. Postgres 17 garantit la transactionnalite DDL (tout passe ou tout roule). Le snapshot pre-cutover (snapshot-6-a-2-pre-cutover.md) + le rollback explicite (rollback-6-a-2.sql) couvrent le risque residuel. Pattern Epic 5 (cutover < 5 sec sans branche preview) deja eprouve avec succes.

### Decision F-Epic6-A1-d : Pattern recreate-enum (Postgres 17 ne supporte PAS DROP VALUE)

**Choix :** recreate-enum complet (CREATE TYPE v2 + DROP helpers + ALTER COLUMN + DROP TYPE v1 + RENAME v2 + CREATE helpers) pour supprimer la valeur orpheline `'accompagnante'`.

**Justification :** test 2026-05-13 confirme que Postgres 17.6 leve `ERROR: 0A000: dropping an enum value is not implemented` sur `ALTER TYPE user_role DROP VALUE 'accompagnante'`. Le pattern d'Epic 5 D2 reste obligatoire. 822 lignes a reecrire sur `users.role` (seule colonne typee user_role), estime < 200 ms. Operation transactionnelle (tout passe ou tout roule).

### Decision F-Epic6-A1-e : Fix trigger `handle_new_user` dans la meme migration 6.A.2

**Choix :** `CREATE OR REPLACE FUNCTION public.handle_new_user()` integre dans la migration 6.A.2 avec body corrige (`IF v_role_text IN ('accompagnant', 'accompagne')` + INSERT INTO `accompagnants_profiles`).

**Justification :** la migration 6.A.2 renomme `accompagnantes_profiles` -> `accompagnants_profiles`, donc le trigger actuel se casserait immediatement post-rename (insert dans une table inexistante). Le fix est indispensable au moment du cutover, pas optionnel. En plus, le trigger actuel route mal les signups d'accompagnant (bug latent depuis Epic 5, 0 cas observe en prod mais arme).

**Pas de re-routing data necessaire** : audit 2026-05-13 confirme 0 user mal route en prod.

**Strategie cutover atomique** unique migration transactionnelle qui execute dans l'ordre :

1. Guard explicite : refus si `users.role = 'accompagnante'` existe encore (race condition improbable).
2. RENAME 3 tables (`accompagnantes_profiles` -> `accompagnants_profiles`, etc.).
3. RENAME 14 contraintes historiques.
4. DROP + CREATE des 11 policies RLS (cosmetique : rafraichir le texte SQL des `qual`/`with_check`).
5. Pattern recreate-enum (decision F-Epic6-A1-d) :
   - CREATE TYPE user_role_v2 AS ENUM ('accompagnant','accompagne','admin')
   - DROP FUNCTION is_accompagnant + is_accompagne (verifies safe : aucune dependance pg_depend ni policy RLS)
   - ALTER TABLE users ALTER COLUMN role TYPE user_role_v2 USING role::text::user_role_v2 (~200 ms)
   - DROP TYPE user_role + ALTER TYPE user_role_v2 RENAME TO user_role
   - CREATE FUNCTION is_accompagnant + is_accompagne (corps preserves a l'identique, cf. audit pg_get_functiondef)
6. CREATE OR REPLACE FUNCTION handle_new_user avec body corrige (decision F-Epic6-A1-e).
7. `DROP FUNCTION public.get_or_create_conversation(uuid, uuid)`.

Fenetre cutover estimee < 5 secondes (l'ALTER COLUMN TYPE sur 822 lignes est le seul cout non-metadata).

**Plan rollback par mode de defaillance** (7 modes documentes tech-spec 6.A.1 section D9) :

1. Guard refuse -> transaction rollback automatique, investigation.
2. RENAME TABLE lock contention -> lock_timeout 5s + retry hors heures pointe.
3. Policy recreation incorrecte -> revert via migration inverse depuis snapshot DDL.
4. Types Supabase regen casse build TS (6.A.3) -> revert commit 6.A.3, BDD reste migree.
5. DROP FUNCTION RPC casse un caller insoupconne -> recreer depuis snapshot D8.6.
6. ALTER COLUMN TYPE echoue (row pathologique) -> transaction rollback, investiguer row.
7. Trigger `handle_new_user` recree incorrectement -> CREATE OR REPLACE depuis snapshot D8.7 + re-pointer vers la nouvelle table.

**Snapshot pre-cutover obligatoire** : `_bmad-output/implementation-artifacts/snapshot-6-a-2-pre-cutover.md` doit etre cree avant `apply_migration` 6.A.2 (DDL replay-able pour les 11 policies + 14 contraintes + RPC body + enum + counts).

**Hors scope 6.A confirme :**

- Renommage des noms de policies `aux_*` -> `acc_*` : reporte Epic 7 si volonte de coherence accrue (faible valeur).
- Libelles diplomes `accompagnante en gerontologie` / `accompagnante de vie` : **JAMAIS renommes** (terminologie metier officielle figee).
- Renommage `is_accompagne()` : deja masculin, hors scope.

**Regle :** Stories 6.A.2 a 6.A.5 ne peuvent demarrer qu'apres validation Sylvain du tech-spec et apres snapshot pre-cutover persiste. 6.B.1 (fix tests integration paywall) doit etre execute apres 6.A.2 et avant 6.A merge final pour ne pas casser la CI integration.



---

## 2026-05-13 : Confirmation rejet centralisation helpers email (decision F-Epic6-C4)

**Contexte :** Story 6.C.4 (Epic 6) re-evalue la decision Epic 4 4.3 D9 de ne pas centraliser les helpers email. Audit factuel 2026-05-13 :

- `lib/emails.ts` monolithe : 1243 lignes, 20 helpers `sendXxxEmail` (vs 18 annonces Epic 4 D9). +2 helpers ajoutes Epic 4-6 : `sendOuvertureConfirmationEmail`, `sendOuvertureNotificationEmail`, `sendParrainageVerificationEmail`.
- Pattern uniforme par helper : ~62 lignes, try/catch + 2 `logNotification` (success/error) + HTML template inline + signature parametree.
- 19 appels `resend.emails.send` au total, 39 `logNotification`, 19 blocs try/catch.

**Decision :** confirmer le rejet historique. Pas de centralisation Epic 6.

**Justification :**
- Le pattern actuel est uniforme et lisible : chaque helper est self-contained, facile a auditer en isolation.
- Centraliser le boilerplate (try/catch + logNotification) reduirait ~300 lignes mais introduirait un wrapper qui couplerait 20 callers a son interface. Churn de refactor disproportionne par rapport au gain de maintenabilite.
- Le HTML template inline (le gros de chaque helper) ne peut pas etre centralise sans introduire un systeme de templates (jsx-email, react-email, mjml...) qui depasse largement le scope Epic 6.
- Apres 1 mois de Epic 4-5-6, aucun bug de coherence rapporte entre helpers (Sentry oncall).

**Regle :** la centralisation reste candidate Epic 7+ si :
1. Le nombre de helpers depasse 30 (seuil arbitraire de complexite),
2. OU un bug de coherence (ex : log non genere par un helper) est detecte en prod,
3. OU une refonte des templates email passe par un systeme de composants (react-email).


---

## 2026-05-13 : Cloture 6.C.2 conditionnelle - switch domaine Supabase reste differe (decision F-Epic6-C2)

**Contexte :** Story 6.C.2 (Epic 6) demande de mettre a jour Supabase Auth + Vercel env vars + Resend DKIM quand le vrai domaine remplacera roxanetnous.vercel.app. AC1 a un declencheur formel : achat du vrai domaine effectif.

**Etat 2026-05-13 :** Le domaine roxanetnous.fr n est PAS encore achete/branche. Le declencheur AC1 n est pas advenu.

**Decision :** AC1 differe, AC2 livre.

- **AC1 (switch effectif) :** reporte. La story reste conditionnelle. Sera reactivee quand le domaine sera DNS-up.
- **AC2 (checklist documentee) :** memoire `project_go_live_supabase_domain_switch` enrichie 2026-05-13 avec checklist exhaustive 6 etapes (pre-bascule DNS, env vars Vercel, Supabase Auth Dashboard, Resend DKIM/SPF, test E2E 5 points, clean-up J+7). Audit des 8 fichiers code utilisant NEXT_PUBLIC_BASE_URL (app/robots, app/sitemap, app/layout, app/actions/subscription x3, app/actions/auth x3, app/page, lib/emails) inclus dans la memoire pour reference future.
- **AC3 (test E2E) :** non execute (depend AC1).

**Regle :** Au jour J (achat domaine), suivre la checklist memoire. Ne pas tenter de modifier `NEXT_PUBLIC_BASE_URL` avant que Resend ait valide le domaine sinon tous les emails partiront en erreur.


---

## 2026-05-13 : Cloture 6.D Playwright reportee Epic 7+ avec scope clarifie (decision F-Epic6-D)

**Contexte :** Mini-epic 6.D (3 stories Playwright : 6.D.1 anti-fraude parrainage, 6.D.2 RGPD cascade, 6.D.3 matching) etait cadre comme "extension de la suite Playwright story 4.4".

**Decouverte 2026-05-13 audit :** La story 4.4 (Epic 4) a livre des **tests Vitest integration**, PAS une suite Playwright fonctionnelle. Le seul code Playwright en place est `tests/a11y/` (6 specs axe-core scannant les violations a11y sur 7 parcours critiques). Aucune infra E2E (helpers login session, fixtures DB, page objects, config dedie) n existe.

**Implication :** Le scope reel de 6.D est :
1. Creer l infra E2E Playwright (config separee de a11y, helpers session, fixtures Supabase reset entre tests, seed parrainages/RGPD/matching).
2. Ecrire les 3 scenarios applicatifs avec assertions BDD + UI.
3. Integrer en CI GHA.

Estimation realiste : **2-3 jours-dev**, pas "extension" comme le tech-spec le suggerait. Hors envergure d une soiree Epic 6.

**Decision :** Reporter 6.D Epic 7+ avec scope clarifie.

- **6.D.1 / 6.D.2 / 6.D.3** : reportees Epic 7+ comme un mini-epic dedie (creation infra + 3 scenarios). A reprioriser selon trafic prod : si peu d incidents anti-fraude/RGPD/matching observes 30j, peut etre encore reporte.
- **Mitigation interim :** la couverture Vitest integration (story 4.4) couvre deja les flux paywall + Stripe webhook idempotence. Les flux 6.D ne sont pas non-couverts -- ils sont juste moins automatises a haut niveau.
- **AI-4.11 / AI-4.12 / AI-4.13** restent ouverts comme action items deferes Epic 5 retro + Epic 6 retro.

**Regle :** au moment ou Epic 7 reactive 6.D, prevoir explicitement le temps de l infra (1j) avant les scenarios applicatifs (0.5j par scenario). Ne pas le sous-estimer comme "extension".


---

## 2026-05-14 : RPC `get_admin_conversations_with_unread` pour eliminer N+1 admin messages (decision F-Epic7-A4)

**Contexte :** Story 7.A.4 (mini-epic 7.A hardening securite). La page `app/admin/messages/page.tsx` boucle `for (const conv of conversations)` avec 1 requete COUNT par conversation -> 1 LIST + N COUNT round-trips. Avec 50+ conversations admin, latence p50 estimee >2s, p95 timeout Vercel possible. Pre-existant a story 4.6 (boucle non touchee par le diff, revelee par le typage propre post-resorption `as any`). Volumetrie prod actuelle : 0 conversation admin (audit MCP 2026-05-14), donc story preventive avant prise de trafic.

**Decision :** nouvelle RPC `public.get_admin_conversations_with_unread(p_current_user_id uuid, p_limit int, p_offset int)` SECURITY DEFINER + check `is_admin()` upfront.

- **Rationale** : pattern projet etabli (`try_consume_rate_limit`, `merge_parrainage_flag_suspicion`, 4 RPC parrainage), typage strict via `types/supabase.ts` regenere, gain p50 attendu >70% sur 50+ conv (mesure preview Vercel avec dataset seed).
- **Defense en profondeur** : check `is_admin()` interne empeche un futur appel accidentel depuis un client `authenticated` non-admin (test integration cas (e) couvre exception 42501).
- **Alternative consideree** : aggregation PostgREST `messages!conversation_id(count)` avec filtres embedded - rejetee car comportement count + filtres embedded non-deterministe selon version PostgREST (cf. story 7.A.4 Dev Notes AC5), risque de typage `as any` casse les garde-fous `check:as-any-global`.
- **Verrou** : `check:as-any-global` bloque toute regression `as any` autour du nouveau RPC call (script integre vercel.json buildCommand depuis story 5.C.1).

**Migration :** `20260513230753_admin_messages_rpc_unread_aggregation.sql` (CREATE OR REPLACE FUNCTION + REVOKE PUBLIC/anon + GRANT authenticated). Apply via MCP. BDD prod vide, idempotent, pas de cutover risque.

**Tests :** `tests/integration/admin-messages/liste-conversations-avec-unread.test.ts` couvre 5 cas (a-e) : visibilite admin + filtre admin_id IS NOT NULL + pagination + unread=0 + garde-fou is_admin.

**Regle :** tout futur agregation admin ou multi-row (planning, signalements, etc.) qui generera un N+1 doit suivre ce pattern (RPC SECURITY DEFINER + check role + REVOKE PUBLIC/anon + GRANT authenticated + types regen MCP) au lieu de boucles applicatives.
