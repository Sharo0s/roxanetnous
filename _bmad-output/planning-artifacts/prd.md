---
stepsCompleted: [step-01-init, step-02-discovery, step-03-success, step-04-journeys, step-05-domain, step-06-innovation, step-07-project-type, step-08-scoping, step-09-functional, step-10-nonfunctional, step-11-polish]
inputDocuments:
  - product-brief-roxanetnous-2026-02-09.md
  - architecture-technique-roxanetnous-2026-02-09.md
workflowType: 'prd'
classification:
  projectType: web_app
  domain: general
  complexity: medium
  projectContext: greenfield
---

# Product Requirements Document - roxanetnous

**Author:** Sylvain
**Date:** 2026-02-10

## Résumé Exécutif

**roxanetnous** est une plateforme web de mise en relation directe entre auxiliaires de vie vérifiés et bénéficiaires (personnes âgées/dépendantes et leurs proches).

**Différenciateur :** Vérification manuelle obligatoire de chaque auxiliaire avant publication. Tous les profils sont contrôlés — la confiance est le pilier de la plateforme.

**Modèle :** Abonnement symétrique (auxiliaires et bénéficiaires) — mensuel 4,99€ / annuel 49,99€. Hard paywall.

**Cible :** Auxiliaires de vie indépendantes cherchant des clients sans intermédiaire. Bénéficiaires (personnes âgées/dépendantes) et leurs proches cherchant une aide à domicile vérifiée. Couverture : toutes les villes de France.

## Critères de Succès

### Succès Utilisateur

**Auxiliaires de vie :**
- Premier contact reçu d'un bénéficiaire dans les **7 jours** suivant la publication d'annonce
- Au moins **1 mission obtenue** via la plateforme dans les **30 premiers jours**
- Planning stabilisé à **80%+** de remplissage grâce à roxanetnous (objectif long terme)
- Connexion régulière : **2-3 fois par semaine** minimum
- Réactivité : réponse aux messages en moins de **24h**
- Moment "aha!" : "Je contrôle mon image et les clients me trouvent sans intermédiaire"

**Bénéficiaires :**
- **3-5 profils** d'auxiliaires correspondants en moins de **24h** après abonnement
- Premier contact avec une auxiliaire en moins de **48h**
- Collaboration établie dans les **7-14 jours**
- Consultation régulière : **1-2 fois par semaine** minimum
- Moment "aha!" : "Tous les profils sont vérifiés, je peux avoir confiance"

### Succès Business

**Croissance :**

| Métrique | 3 mois | 12 mois |
|----------|--------|---------|
| Utilisateurs totaux | 20 | 100 |
| Auxiliaires vérifiés | 5 | 25 |
| Bénéficiaires abonnés | 15 | 75 |
| Couverture | Toutes villes de France | Toutes villes de France |

**Engagement & Rétention :**
- Rétention 1 mois >= **50%** (progression vers 70%+)
- 80%+ auxiliaires validés publient au moins 1 annonce
- 70%+ bénéficiaires envoient au moins 1 message en 7 jours
- 40%+ démarrent une collaboration effective en 30 jours

**Financier :**
- MRR : ~100€ à 3 mois → ~500€ à 12 mois
- Churn mensuel < **15%** (objectif < 10% à 12 mois)
- Feedback positif qualitatif des utilisateurs (retours directs par email/messagerie)

### Succès Technique

- Processus de vérification bout en bout fonctionnel (48h respecté à 50%+)
- **Zéro tolérance** : 0% d'auxiliaires non vérifiés ne publient
- Abonnements Stripe sans friction (checkout + webhooks + customer portal)
- Chat temps réel stable, rapide, sans perte de messages
- OCR pré-validation documents >80% précision
- RLS Supabase : aucune fuite de données entre utilisateurs
- Notifications email de matching envoyées correctement

### Résultats Mesurables

- Auxiliaires disent : "Je trouve des clients sans intermédiaire"
- Bénéficiaires disent : "Je trouve des auxiliaires de confiance rapidement, je suis rassuré"
- La vérification manuelle est perçue comme un **gage de qualité**, pas comme un frein
- Signalements < 5% des profils, 100% traités < 72h

## Périmètre Produit

### Stratégie MVP

**Approche :** MVP Plateforme — mise en relation directe avec confiance (vérification manuelle obligatoire).

**Philosophie :** Lancement complet avec toutes les fonctionnalités core. Pas de compromis sur l'expérience utilisateur — la confiance et la fluidité sont les différenciateurs.

**Ressources :** Sylvain seul (fondateur/admin/dev). Validation manuelle viable jusqu'à ~25 auxiliaires.

**Parcours utilisateurs supportés :** Les 4 parcours complets (Sophie, Marie, Jean, Sylvain).

### MVP — 15 Fonctionnalités (Phase 1)

1. Authentification multi-rôles (auxiliaire / bénéficiaire / admin)
2. Vérification manuelle obligatoire des auxiliaires (justificatifs + OCR pré-validation)
3. Abonnements Stripe (mensuel 4,99€ / annuel 49,99€ + offres de lancement)
4. Hard paywall : tout bloqué sans abonnement actif
5. Annonces bidirectionnelles (auxiliaires publient + bénéficiaires publient)
6. Badges automatiques (annonce active, ancienneté)
7. Matching intelligent 5 critères (spécialités, zone, disponibilités, diplôme, expérience)
8. Recherche avancée avec filtres multiples + favoris
9. Messagerie temps réel (WebSocket via Supabase Realtime)
10. Notifications email intelligentes (matching, validation, messages)
11. Dashboards (auxiliaire, bénéficiaire, admin avec métriques)
12. Landing page avec preuves sociales, FAQ, formulaire de contact
13. Modération & signalements
14. Conformité RGPD (suppression compte, export données, consentements)
15. Couverture : toutes les villes de France

### Post-MVP (Phase 2 — Growth)

- Recommandation avancée ML/IA (au-delà du matching par critères)
- Application mobile native (iOS/Android) avec notifications push
- Intégrations outils externes
- Analytics avancés (parcours utilisateurs, A/B testing, heatmaps)

### Vision Future (Phase 3 — Expansion)

- Calendrier partagé pour gestion RDV et plannings
- Multi-langue (anglais, puis autres langues européennes)
- Formation/certification en ligne pour auxiliaires
- Programme de parrainage
- Expansion services connexes (aide-ménagère, garde d'enfants, soins infirmiers)
- Partenariats B2B (mutuelles, CCAS, hôpitaux)
- Tiers premium (abonnements différenciés)

### Mitigation des Risques

**Risque marché (poule et l'œuf) :** Recruter d'abord 5 auxiliaires vérifiées avant le lancement commercial auprès des bénéficiaires.

**Risque technique (matching géographique) :** Haversine avec lat/lng dès le MVP (défini dans l'architecture). Fallback par ville/code postal si problème.

**Risque ressource (Sylvain seul) :** Validation manuelle viable à l'échelle MVP (5-25 auxiliaires). OCR pré-validation réduit le temps de vérification. Customer portal Stripe réduit le support abonnements.

## Parcours Utilisateurs

### Parcours 1 : Sophie, Auxiliaire de Vie Indépendante (35 ans)

**Scène d'ouverture :** Sophie a quitté son agence il y a 3 ans pour travailler en indépendante. Elle a quelques clients réguliers trouvés par bouche-à-oreille, mais son planning a des trous. Elle passe ses soirées à chercher sur Google "comment trouver des clients auxiliaire de vie". Elle tombe sur une pub Facebook de roxanetnous.

**Action montante :**
- Elle arrive sur la landing page. Le message est clair : "Auxiliaires de vie vérifiés, en direct avec les bénéficiaires". Elle voit "X auxiliaires vérifiés" et se dit que c'est sérieux.
- Elle s'inscrit, remplit son profil structuré (diplôme d'État aide-soignante, 3-10 ans d'expérience, 7 spécialités). Elle uploade sa pièce d'identité et son diplôme.
- Statut : "En attente de validation". Elle prépare déjà son annonce en mode brouillon pendant qu'elle attend.
- 36h plus tard : email "Votre profil a été validé !" avec un lien vers le checkout Stripe.
- Elle choisit l'abonnement mensuel à 4,99€ (2 mois offerts au lancement). Paiement en 30 secondes.
- Elle publie son annonce immédiatement. Badge affiché : "Annonce active".

**Climax :**
- 3 jours après la publication, elle reçoit un email : "Un bénéficiaire dans votre zone recherche vos compétences". Elle consulte l'annonce, le profil correspond. Elle envoie un message via la messagerie.
- Réponse en 2h. Échange fluide. Rendez-vous fixé.

**Résolution :**
- Sophie a trouvé sa première mission via roxanetnous en moins d'une semaine. Elle se connecte 3 fois par semaine pour consulter les nouvelles annonces de bénéficiaires. En 2 mois, elle a 3 nouveaux clients. Son planning est rempli à 70%.

**Scénario d'échec :**
- Si Sophie ne reçoit aucun contact après 2 semaines, il n'y a pas de mécanisme automatique de relance. Elle devra être patiente et attendre que des bénéficiaires s'inscrivent dans sa zone.

---

### Parcours 2 : Marie, Bénéficiaire (78 ans) — Inscription assistée par un proche

**Scène d'ouverture :** Marie, 78 ans, vit seule à Paris 18e. Elle a besoin d'aide pour les repas, le ménage et l'accompagnement médical 3 matins par semaine. Son neveu Thomas, 42 ans, lui a parlé de roxanetnous après l'avoir vu en ligne. Il vient chez elle un samedi pour l'aider à s'inscrire.

**Action montante :**
- Thomas ouvre le site sur la tablette de Marie. Landing page sobre, texte gros, navigation simple.
- Il crée le compte pour Marie (email de Marie, mais c'est Thomas qui tape). Choix du rôle : bénéficiaire.
- Thomas choisit l'abonnement annuel à 49,99€ (3 mois offerts au lancement) avec la carte de Marie. Paiement rapide via Stripe Checkout.
- Accès immédiat. Thomas montre à Marie comment naviguer : "Tu vois, là tu as les auxiliaires de vie, elles sont toutes vérifiées."
- Ensemble, ils publient une annonce de recherche : aide au repas + entretien du logement + accompagnement RDV, Paris 18e, dépendance modérée, lundi/mercredi/vendredi matin.

**Climax :**
- Le lendemain, Marie reçoit une notification email (que Thomas lui lit au téléphone) : "Une auxiliaire correspondant à vos critères". Profil de Sophie, vérifiée.
- Thomas aide Marie à envoyer un premier message : "Bonjour, je cherche quelqu'un de doux et patient." Réponse de Sophie le jour même.
- Marie et Sophie se rencontrent le mercredi suivant. Le courant passe.

**Résolution :**
- Marie a trouvé Sophie en 5 jours. Thomas est rassuré. Marie consulte la plateforme avec l'aide de Thomas quand il passe, mais la relation avec Sophie est établie et fonctionne en direct.

---

### Parcours 3 : Jean, Bénéficiaire/Famille (50 ans) — Recherche à distance

**Scène d'ouverture :** Jean vit à Paris, sa mère Madeleine, 82 ans, vit seule à Lyon 3e depuis 6 mois (après le décès de son père). Madeleine a besoin d'aide quotidienne mais est réticente. Jean cherche "aide à domicile Lyon vérifiée" sur Google et trouve roxanetnous.

**Action montante :**
- Jean s'inscrit depuis son bureau à Paris. Rôle : bénéficiaire. Abonnement mensuel 4,99€.
- Il publie une annonce détaillée : aide à la toilette + préparation repas + présence de nuit, Lyon 3e, dépendance forte, horaires flexibles, "Ma mère peut être réticente au début".
- Il consulte aussi directement les profils d'auxiliaires à Lyon 3e. 4 auxiliaires vérifiées dans la zone. Il en met 2 en favoris.

**Climax :**
- Il contacte les 2 auxiliaires favorites via la messagerie. L'une répond en 3h avec un message chaleureux et une expérience avec des personnes réticentes. Jean est convaincu.
- Il organise un appel entre sa mère et l'auxiliaire (en dehors de la plateforme). Première rencontre réussie.

**Résolution :**
- En 10 jours, Jean a trouvé une auxiliaire expérimentée pour sa mère. Il est à 300 km mais serein. Il consulte roxanetnous 1 fois par semaine pour voir si de nouvelles auxiliaires s'inscrivent dans la zone.

---

### Parcours 4 : Sylvain, Admin/Fondateur

**Scène d'ouverture :** Sylvain lance roxanetnous. Il est seul à gérer la plateforme. Chaque matin, il ouvre le dashboard admin.

**Action montante :**
- **Validation :** Notification "3 nouvelles demandes de validation". Il ouvre la queue. Pour chaque auxiliaire : profil structuré + justificatifs + résultat OCR pré-validation. L'OCR a détecté "Diplôme d'État aide-soignante" sur le document de Sophie — cohérence avec le diplôme déclaré. Il vérifie la pièce d'identité, tout est conforme. Il clique "Valider". L'action est tracée dans le log admin.
- Pour un autre profil, l'OCR n'a rien détecté (document illisible). Il clique "À compléter" avec le motif : "Diplôme illisible, merci de re-scanner en meilleure qualité."
- **Modération :** 1 signalement en attente. Un bénéficiaire a signalé un message inapproprié. Sylvain consulte la conversation, constate le problème, suspend le compte avec avertissement.
- **Métriques :** Il consulte le dashboard : 12 utilisateurs actifs, 3 auxiliaires vérifiés, 9 bénéficiaires. MRR : 60€. Délai moyen de validation : 31h. Taux de validation : 85%.

**Climax :**
- Sylvain voit la première collaboration démarrée via la plateforme. Il reçoit un email de remerciement spontané du bénéficiaire et de l'auxiliaire — signal positif direct.

**Résolution :**
- La plateforme fonctionne. Les validations sont faites en moins de 48h. Les métriques progressent. Sylvain peut se concentrer sur l'acquisition.

---

### Résumé des capacités révélées par les parcours

| Parcours | Capacités requises |
|----------|-------------------|
| **Sophie (Auxiliaire)** | Inscription structurée, upload justificatifs, validation admin, checkout Stripe, création/publication annonces, badges automatiques, notifications matching, messagerie temps réel |
| **Marie (Bénéficiaire assistée)** | Interface accessible/sobre, inscription simple, checkout Stripe, publication annonce recherche, notifications matching, messagerie, favoris |
| **Jean (Bénéficiaire à distance)** | Recherche avancée avec filtres, favoris, messagerie, annonces de recherche détaillées, notifications email |
| **Sylvain (Admin)** | Queue validation avec OCR, modération signalements, dashboard métriques, gestion utilisateurs, traçabilité actions |

## Exigences Techniques Web App

### Architecture Web

- Next.js 15 App Router — hybride SSR/RSC + navigation côté client

### Compatibilité Navigateurs

| Navigateur | Version | Support |
|------------|---------|---------|
| Chrome | Dernière version | Complet |
| Firefox | Dernière version | Complet |
| Safari | Dernière version | Complet |

- Responsive : desktop + tablette
- Pas de support navigateurs anciens

### Stratégie SEO

- **Priorité haute** — acquisition organique essentielle
- Moteurs ciblés : Google, Bing, Yahoo, Qwant, DuckDuckGo, Ecosia
- Landing page SSR avec meta tags, Open Graph, Schema.org (LocalBusiness + Service)
- Pages publiques indexables : landing, pages informatives
- Pages derrière paywall : non indexées (noindex)
- Sitemap.xml + robots.txt
- Balises sémantiques HTML5
- URLs propres et descriptives

### Accessibilité

- Pas de conformité WCAG formelle visée
- Bonne pratique UX : texte lisible, contraste suffisant, navigation simple

## Exigences Fonctionnelles

### Gestion des Utilisateurs & Authentification

- **FR1 :** Un visiteur peut créer un compte en choisissant son rôle (auxiliaire ou bénéficiaire)
- **FR2 :** Un utilisateur peut se connecter et se déconnecter de son compte
- **FR3 :** Un utilisateur peut réinitialiser son mot de passe
- **FR4 :** Un utilisateur peut supprimer son compte et ses données (RGPD)
- **FR5 :** Un utilisateur peut exporter ses données personnelles (RGPD)
- **FR6 :** Un utilisateur peut gérer ses consentements (RGPD)

### Vérification des Auxiliaires

- **FR7 :** Une auxiliaire peut remplir son profil structuré (diplôme, expérience, spécialités, zones, disponibilités)
- **FR8 :** Une auxiliaire peut uploader ses justificatifs (pièce d'identité, diplôme)
- **FR9 :** Le système pré-analyse les justificatifs via OCR et vérifie la cohérence avec le profil déclaré
- **FR10 :** Un admin peut consulter la queue de validation avec les résultats OCR
- **FR11 :** Un admin peut valider, refuser ou demander des compléments pour un profil auxiliaire
- **FR11bis :** Un admin rencontre physiquement chaque auxiliaire avant la validation définitive du profil (rencontre consignée dans le log admin)
- **FR12 :** Une auxiliaire non vérifiée ne peut pas publier d'annonce ni accéder aux fonctionnalités payantes

### Abonnements & Paiement

- **FR13 :** Un utilisateur validé peut souscrire un abonnement (mensuel 4,99€ ou annuel 49,99€)
- **FR14 :** Le système applique les offres de lancement (mois offerts)
- **FR15 :** Un abonné peut gérer son abonnement (modifier, annuler) via le portail client
- **FR16 :** Le système bloque l'accès aux fonctionnalités sans abonnement actif (hard paywall)
- **FR17 :** Le système gère les webhooks Stripe (renouvellement, échec de paiement, annulation)

### Annonces

- **FR18 :** Une auxiliaire vérifiée et abonnée peut créer, modifier et supprimer ses annonces de service
- **FR19 :** Un bénéficiaire abonné peut créer, modifier et supprimer ses annonces de recherche
- **FR20 :** Une auxiliaire peut préparer une annonce en brouillon avant validation

### Matching & Découverte

- **FR21 :** Le système calcule un score de matching entre auxiliaires et bénéficiaires sur 5 critères (spécialités, zone géographique, disponibilités, diplôme, expérience)
- **FR22 :** Un utilisateur abonné peut rechercher des profils avec filtres multiples (spécialités, zone, disponibilités)
- **FR23 :** Un utilisateur abonné peut ajouter des profils en favoris
- **FR24 :** Le système notifie par email les utilisateurs lorsqu'un profil correspondant à leurs critères est publié

### Badges

- **FR25 :** Le système attribue automatiquement des badges aux auxiliaires (annonce active, ancienneté 1/3/5 ans)
- **FR26 :** Les badges sont visibles sur le profil et les annonces de l'auxiliaire

### Messagerie

- **FR27 :** Deux utilisateurs abonnés peuvent échanger des messages en temps réel
- **FR28 :** Un utilisateur reçoit une notification email lorsqu'il reçoit un nouveau message
- **FR29 :** Un utilisateur peut consulter l'historique de ses conversations

### Modération & Signalements

- **FR33 :** Un utilisateur peut signaler un profil ou un message inapproprié
- **FR34 :** Un admin peut consulter les signalements en attente
- **FR35 :** Un admin peut suspendre ou avertir un utilisateur suite à un signalement
- **FR36 :** Le système trace toutes les actions admin (logs d'audit)

### Dashboards

- **FR37 :** Une auxiliaire peut consulter son tableau de bord (annonces, messages, statistiques)
- **FR38 :** Un bénéficiaire peut consulter son tableau de bord (annonces, messages, favoris)
- **FR39 :** Un admin peut consulter le dashboard avec métriques (utilisateurs actifs, MRR, délai validation, taux validation, signalements)

### Landing Page & Acquisition

- **FR40 :** Un visiteur peut consulter la landing page avec proposition de valeur et preuves sociales
- **FR41 :** La landing page affiche des compteurs dynamiques (nombre d'auxiliaires vérifiés)
- **FR42 :** Un visiteur peut consulter une FAQ sur la landing page
- **FR43 :** Un visiteur peut envoyer un message via un formulaire de contact
- **FR44 :** Un visiteur peut choisir son parcours via des boutons d'orientation ("Je suis aidant" / "Je recherche un aidant")

## Exigences Non-Fonctionnelles

### Performance

- Pages publiques (landing, SSR) : chargement < **2.5s** (LCP)
- Actions utilisateur (recherche, filtres, navigation) : réponse < **1s**
- Messagerie temps réel : latence < **500ms**
- Core Web Vitals : LCP < 2.5s, FID < 100ms, CLS < 0.1
- Images optimisées (next/image, WebP)

### Sécurité

- Données chiffrées en transit (HTTPS) et au repos (Supabase)
- Justificatifs stockés dans un bucket privé, URLs signées temporaires
- RLS Supabase : isolation stricte des données entre utilisateurs
- Données personnelles sensibles chiffrées (téléphone)
- Conformité RGPD : suppression compte, export données, consentements
- Webhooks Stripe vérifiés par signature

### Scalabilité

- MVP : 20 utilisateurs à 3 mois, 100 à 12 mois
- Architecture serverless (Vercel + Supabase) — scale automatique
- Pas de contrainte de scalabilité critique au MVP

### Intégrations

- Stripe : paiements, abonnements, webhooks, portail client
- Supabase : Auth, Database, Storage, Realtime
- Google Cloud Vision : OCR pré-validation documents
- Service email transactionnel : notifications (Resend ou similaire)

### Fiabilité

- Disponibilité cible : **99.5%**
- Pas de perte de messages dans le chat (persistance avant notification)
- Webhooks Stripe : retry automatique en cas d'échec
