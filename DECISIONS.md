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

**Decision :** Le bandeau cookies actuel `components/cookie-banner.tsx` (un seul bouton "Compris", bandeau informatif sans categorisation) est conforme RGPD car **tous les cookies HTTP poses sur le domaine roxanetnous sont strictement essentiels au fonctionnement du service** : (a) cookies de session Supabase (`sb-<project-ref>-auth-token`) = authentification, base legale art. 6.1.b RGPD (execution du contrat). **Aucun autre cookie HTTP applicatif** n'est pose sur notre domaine. La preference d'acceptation du bandeau est stockee en `localStorage` (cle `cookies-accepted`), donc techniquement **pas un cookie HTTP** au sens de la Deliberation CNIL n°2020-091.

**Aucun cookie tiers** (analytics, publicite, tracking, retargeting, session replay) n'est pose sur le domaine roxanetnous. Aucun script tiers de tracking/analytics/CMP n'est charge cote client (verification grep code Section 5 du rapport audit : 0 occurrence sur `app/`, `components/`, `lib/`).

Les **cookies tiers Stripe** poses sur `checkout.stripe.com` lors d'une session de paiement sont sous la responsabilite de Stripe Payments Europe Ltd. (sous-traitant RGPD au sens art. 28, cf. mentions legales). Hors perimetre du bandeau roxanetnous. Le SDK Stripe.js client n'est pas charge sur notre domaine (`@stripe/stripe-js` present en dependance mais 0 import applicatif - dette technique a traiter Epic 4).

Les **tuiles cartographiques OpenStreetMap** chargees par Leaflet sur les pages auxiliaire et beneficiaire authentifiees (5 call-sites au total : 4 auxiliaire + 1 beneficiaire, configuration rayon d'intervention ou zone d'annonce) transmettent l'IP utilisateur a OSM Foundation. Cette transmission est couverte par la base legale art. 6.1.b RGPD (fonction metier essentielle, acces uniquement post-authentification + acceptation CGU). Mention informative ajoutee dans la politique de confidentialite Section "Transferts de donnees".

**Motivation :** Deliberation CNIL n°2020-091 du 17 septembre 2020 (lignes directrices cookies) admet un bandeau cookies purement informatif pour les sites ou tous les cookies poses sont strictement essentiels au fonctionnement OU exemptes au titre de la mesure d'audience. Aucun consentement granulaire requis. Le projet roxanetnous remplit cette condition pre-go-live Bretagne (cf. rapport `_bmad-output/planning-artifacts/audit-cookies-2026-05-07.md`).

**Implications techniques :**
- `components/cookie-banner.tsx` : libelle ajuste pour refleter factuellement l'inventaire (un cookie HTTP `sb-*-auth-token` Supabase + stockage local non-cookie pour la preference de bandeau).
- `app/politique-de-confidentialite/page.tsx` : section "Cookies" precisee (un seul cookie HTTP liste, mention separee `localStorage` pour transparence) + section "Transferts de donnees" completee (mention OSM Foundation) + date de mise a jour rafraichie.
- **Aucun CMP requis** au stade MVP Bretagne. Decision a reconsiderer si introduction future d'analytics, retargeting, ou partenaires tiers a finalite commerciale.
- **Re-audit DevTools live** sur 3 contextes (landing publique, beneficiaire authentifie, Stripe Checkout) **obligatoire avant ouverture publique du premier departement Bretagne** : verification visuelle des attributs `httpOnly`/`secure`/`sameSite`/expiration des cookies Supabase, confirmation absence cookie cross-domain Stripe au retour annulation checkout. Cet audit code-only ne dispense pas d'une verification live.
- **Pre-condition** d'introduction d'un nouveau script ou cookie tiers : audit RGPD prealable + classification CNIL + mise a jour de cette decision si la classification est non-essentiel/non-exempte (ouvre alors une story Epic 4 CMP).

**Regle :** Tout nouveau cookie ou script tiers ajoute au projet doit (a) etre classe essentiel/exempte/soumis-a-consentement avant merge, (b) si soumis a consentement, ouvrir une story Epic 4 CMP prealable. Aucun ajout direct de tracking/analytics/retargeting/session-replay sans audit RGPD prealable et mise a jour de cette decision. Voir `_bmad-output/planning-artifacts/audit-cookies-2026-05-07.md`.
