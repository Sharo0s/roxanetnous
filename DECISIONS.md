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
