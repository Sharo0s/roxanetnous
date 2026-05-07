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
