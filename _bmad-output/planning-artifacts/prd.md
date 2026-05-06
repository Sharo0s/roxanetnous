---
stepsCompleted: [step-01-init, step-02-discovery, step-03-success, step-04-journeys, step-05-domain, step-06-innovation, step-07-project-type, step-08-scoping, step-09-functional, step-10-nonfunctional, step-11-polish, step-e-01-discovery, step-e-02-review, step-e-03-edit]
inputDocuments:
  - product-brief-roxanetnous-2026-02-09.md
  - architecture-technique-roxanetnous-2026-02-09.md
  - audit-a11y-2026-05-04.md
  - ../test-artifacts/nfr-assessment-a11y-2026-05-04.md
workflowType: 'prd'
classification:
  projectType: web_app
  domain: general
  complexity: medium
  projectContext: greenfield
lastEdited: '2026-05-06'
editHistory:
  - date: '2026-05-04'
    changes: 'NFR Accessibilité (WCAG 2.2 AA / RGAA / EAA) — remplacement intégral de la sous-section Accessibilité dans Exigences Non-Fonctionnelles. Ajout des 6 parcours critiques, critères mesurables, calendrier en 3 lots (A/B/C), DoD a11y par story, page de déclaration publique.'
  - date: '2026-05-06'
    changes: 'NFR Accessibilité — mise à jour post-Lot C suite re-run NFR AI-13 (cf. nfr-assessment-a11y-2026-05-04.md section R). Calendrier passé en mode livré (Lots A/B/C, 12,25 j-dev cumulés, 21 stories). Statut courant ✅ conforme avec réserves (18/22 critères PASS, 0 bloqueur). Périmètre précisé 7 parcours (entrées baseline @axe-core/playwright) avec note de réconciliation 6 vs 7 (couvre AI-12 partiellement pour ce fichier). Lot D conditionnel ajouté (déclencheur externe). Règle CLAUDE.md ligne 6 mentionnée (durcissement 2.7.4).'
  - date: '2026-05-06'
    changes: 'Décisions A et F (DECISIONS.md 2026-05-06) reportées dans le PRD. (1) Soft paywall : résumé exécutif (modèle), Stratégie MVP item 4, FR16 reformulés — lecture libre, paywall sur actions de mise en relation uniquement (envoi message FR27, publication annonce FR18/FR19). (2) Couverture géographique progressive Bretagne 5 dpt (29, 22, 56, 35, 44) : résumé exécutif (cible), table critères de succès (ligne 65), Stratégie MVP item 15, ajout sous-section "Couverture géographique" avec FR45–FR48 (whitelist departements_ouverts, waitlist hors zone bénéficiaire, blocage inscription auxiliaire hors zone, affichage landing).'
---

# Product Requirements Document - roxanetnous

**Author:** Sylvain
**Date:** 2026-02-10

## Résumé Exécutif

**roxanetnous** est une plateforme web de mise en relation directe entre auxiliaires de vie vérifiés et bénéficiaires (personnes âgées/dépendantes et leurs proches).

**Différenciateur :** Vérification manuelle obligatoire de chaque auxiliaire avant publication. Tous les profils sont contrôlés — la confiance est le pilier de la plateforme.

**Modèle :** Abonnement symétrique (auxiliaires et bénéficiaires) — mensuel 4,99€ / annuel 49,99€. **Soft paywall** : lecture libre des profils et annonces, paywall déclenché sur les actions de mise en relation (envoi de message, publication d'annonce auxiliaire). Détail dans FR16 et `DECISIONS.md` (2026-05-06).

**Cible :** Auxiliaires de vie indépendantes cherchant des clients sans intermédiaire. Bénéficiaires (personnes âgées/dépendantes) et leurs proches cherchant une aide à domicile vérifiée.

**Couverture géographique :** **Déploiement progressif département par département**. Pilote au lancement = **Bretagne historique 5 départements** (29 Finistère, 22 Côtes-d'Armor, 56 Morbihan, 35 Ille-et-Vilaine, 44 Loire-Atlantique). Hors zone : capture email waitlist côté bénéficiaire, inscription bloquée côté auxiliaire. Détail dans FR45–FR48 et `DECISIONS.md` (2026-05-06).

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
| Couverture | Bretagne 5 dpt (29, 22, 56, 35, 44) | Bretagne 5 dpt + extension conditionnelle |

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
4. Soft paywall : lecture libre des profils et annonces, paywall sur actions de mise en relation (envoi de message, publication d'annonce auxiliaire) — voir FR16
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
15. Couverture géographique : déploiement progressif département par département. Pilote = Bretagne historique 5 dpt (29, 22, 56, 35, 44). Waitlist hors zone côté bénéficiaire, inscription bloquée hors zone côté auxiliaire — voir FR45–FR48

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
- **Validation :** Notification "3 nouvelles demandes de validation". Il ouvre la queue. Pour chaque auxiliaire : profil structuré + justificatifs + résultat OCR pré-validation. L'OCR a détecté "Diplôme d'État aide-soignante" sur le document de Sophie — cohérence avec le diplôme déclaré. Il vérifie la pièce d'identité, tout est conforme. Il clique "Passer en attente de visio". Sophie reçoit un email de convocation. Deux jours plus tard, Sylvain la rencontre en visio, échange 20 minutes, rentre ses notes ("Parcours cohérent, discours clair, disponible dès la semaine prochaine"), puis clique "Valider". Chaque étape est tracée dans le log admin.
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

### Accessibilité (NFR transverse)

**Standard cible :** WCAG 2.2 niveau AA, aligné RGAA 4.1, anticipant la conformité à l'Acte européen sur l'accessibilité (EAA, en vigueur depuis le 28 juin 2025).

**Périmètre de conformité :** la conformité AA est exigée sur les **7 parcours critiques** suivants au sens des entrées de baseline `@axe-core/playwright` (cf. `tests/a11y/`) : (1) onboarding auxiliaire, (2) recherche bénéficiaire et favoris, (3) messagerie temps réel, (4-login) connexion, (4-register) inscription et checkout Stripe, (5) landing page publique, (6) suppression compte / export RGPD. Note de réconciliation : le NFR initial 2026-05-04 et certains documents en aval mentionnent **« 6 parcours »** (parcours métier consolidés) — l'écart vient du parcours P4 « inscription + checkout Stripe » splité en 2 entrées baseline distinctes (`p4-login` couvre `/login` en proxy authentifié + `p4-register` couvre `/register`), conformément au choix d'outillage 2.6.1 (story Lot B). Les autres pages doivent respecter les exigences de base (sémantique HTML, contrastes, focus, labels) sans audit exhaustif obligatoire.

**Critères d'acceptation mesurables :**

- **Contrastes :** texte normal ≥ 4,5:1 ; éléments d'interface (bordures, focus, icônes informatives) ≥ 3:1.
- **Navigation clavier :** 100 % des parcours critiques complétables au clavier seul, focus visible en permanence (ring contrasté ≥ 3:1, épaisseur ≥ 2 px), skip-link « Aller au contenu » fonctionnel sur toutes les pages.
- **Formulaires :** chaque champ a un `<label>` associé via `htmlFor` ou `aria-labelledby` ; erreurs liées au champ (`aria-describedby` + `aria-invalid`) ; champs requis annoncés textuellement (pas uniquement par couleur).
- **Composants dynamiques :** ARIA states corrects sur burger, modales, progressbars (`aria-expanded`, `aria-controls`, `aria-modal`, `role="progressbar"`).
- **Régions live :** messagerie en `role="log"` + `aria-live="polite"` ; toasts en `aria-live`.
- **Mouvement :** respect de `prefers-reduced-motion: reduce` (animations désactivables).
- **Alternatives textuelles :** 100 % des images informatives ont un `alt` ; carte hero SVG accompagnée d'un équivalent textuel.
- **Outillage :** `eslint-plugin-jsx-a11y` en CI (build rouge sur nouvelle violation) ; tests automatisés `@axe-core/playwright` sur les 7 parcours critiques (objectif : 0 violation Critical/Serious) ; tests manuels VoiceOver et NVDA documentés sur les parcours onboarding auxiliaire et messagerie, exécutés avant chaque release majeure.
- **Process :** chaque story future avec impact UI inclut une definition-of-done a11y (labels, focus, contrastes, ARIA, clavier, vérification ponctuelle au lecteur d'écran). Une story ne peut être marquée Done sans validation explicite de cette checklist. Règle CLAUDE.md ligne 6 durcie 2026-05-06 (Lot C 2.7.4) : `npm run a11y:axe:check` exit 0 obligatoire avant tout commit livraison story (Option 1 audit local discipline retenue).
- **Déclaration publique :** page `/accessibilite` publiée depuis le 2026-05-06, accessible depuis le footer (4ème entrée nav légale) et le sitemap, indiquant le niveau de conformité, la méthode d'évaluation, la date de mise à jour et un contact dédié (`roxanetnous@outlook.com`).

**Calendrier de mise en conformité (livré) :**

- **Lot A — Quick wins (3,5 j-dev livrés sur 3-4 j-dev estimés) :** mini-épic 2.5 livré **2026-05-05**, 6 stories. Couvre le minimum sémantique : skip-link (2.5.2), focus global conforme + palette contrastes (2.5.3), `prefers-reduced-motion` (2.5.4), refactor du composant `Input` accessible labels + erreurs (2.5.5), ARIA burger (2.5.6), installation `eslint-plugin-jsx-a11y` baseline 158 (2.5.1).
- **Lot B — Conformité fonctionnelle (6,25 j-dev livrés sur 5-7 j-dev estimés) :** mini-épic 2.6 livré **2026-05-06**, 9 stories. Couvre les parcours critiques : axe-core/Playwright outillage + baseline 7 parcours (2.6.1), régions live messagerie (2.6.2), ARIA progressbar + focus management onboarding aux (2.6.3), erreurs inline `role="alert"` 24 occurrences (2.6.4), alternative textuelle carte hero (2.6.5), audit Leaflet + alternative non-visuelle + résorption dette `select-name` (2.6.6), h1 unique sur 47 pages applicatives (2.6.7-A/B/C). Baseline axe-core 1 → 0 Critical/Serious.
- **Lot C — Excellence et verrouillage (~2,5 j-dev livrés sur 3-5 j-dev estimés, cadrage minimaliste) :** mini-épic 2.7 livré **2026-05-06**, 6 stories. Refactor `<main>` Server Component pages auth (2.7.1, 2.7.6), heading-order strict cards `<h3>` → `<h2>` (2.7.2), page publique `/accessibilite` (2.7.3), bascule `a11y:axe:check` bloquant code review via règle CLAUDE.md (2.7.4), rétrospective Lot B documentée (2.7.5).
- **Lot D — Excellence avancée (6-8 j-dev, conditionnel) :** non cadré, déclencheur externe requis (audit RGAA externe / certification / levée de fonds). Couvre les action items reportés : VoiceOver/NVDA formels sur 7 parcours (AI-9), cible tactile 44×44 px (AI-10), bascule `eslint-plugin-jsx-a11y` `warn` → `error` quand baseline = 0 (AI-11), audit admin a11y, audit Stripe Checkout délégué éditeur, tests scénarios complets.

**Statut actuel (re-run NFR 2026-05-06, AI-13) :** ✅ **conforme avec réserves** sur les 7 parcours critiques. **0 violation Critical/Serious axe-core** (baseline `91d1e5f`), **baseline `lint:a11y-check` 155** stable, **18/22 critères PASS, 4 CONCERNS** (B4 cibles tactiles 44×44 px, D4 partiel Leaflet neutralisé via `aria-hidden`+`inert` avec alternative non-visuelle, E3 tests manuels VoiceOver/NVDA formels sur 7 parcours). **0 bloqueur critique** (5 initiaux résolus : B1 skip-link, B2 focus visible, C1 labels, C2 erreurs, D3 régions live). Gate épic 3 levé. **Effort cumulé livré : 12,25 j-dev sur 21 stories** Lots A/B/C, dans la fourchette initiale 11-16 j-dev. Voir audit initial : `_bmad-output/planning-artifacts/audit-a11y-2026-05-04.md` ; NFR + re-run consolidé : `_bmad-output/test-artifacts/nfr-assessment-a11y-2026-05-04.md` ; rétros : `_bmad-output/implementation-artifacts/mini-epic-2-5-retro-2026-05-05.md`, `mini-epic-2-6-retro-2026-05-06.md`, `mini-epic-2-7-retro-2026-05-06.md` ; bilan quantitatif : `_bmad-output/implementation-artifacts/lot-b-bilan-axe-core-2026-05-06.md`.

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
- **FR11bis :** Un admin réalise une visioconférence avec chaque auxiliaire avant la validation définitive du profil. La visio est consignée dans le log admin avec date, heure et notes optionnelles.
- **FR11ter :** L'interface admin matérialise deux statuts intermédiaires — `visio_a_planifier` (après revue documentaire) et `visio_realisee` (après tenue de la visio). Le bouton « Valider » n'est actif que si le statut courant est `visio_realisee`.
- **FR11quater :** L'auxiliaire reçoit un email de convocation visio lorsque son profil passe au statut `visio_a_planifier`.
- **FR12 :** Une auxiliaire non vérifiée ne peut pas publier d'annonce ni accéder aux fonctionnalités payantes

### Abonnements & Paiement

- **FR13 :** Un utilisateur validé peut souscrire un abonnement (mensuel 4,99€ ou annuel 49,99€)
- **FR14 :** Le système applique les offres de lancement (mois offerts)
- **FR15 :** Un abonné peut gérer son abonnement (modifier, annuler) via le portail client
- **FR16 :** Le système applique un **soft paywall**. Lecture libre (recherche, profils, annonces, pages légales) sans authentification ni abonnement. **Paywall déclenché uniquement sur les actions de mise en relation** : envoi de message (FR27), publication d'annonce auxiliaire (FR18), publication d'annonce bénéficiaire (FR19). Décision actée 2026-05-06 (`DECISIONS.md`). Acceptation : un visiteur non abonné accède à `/recherche`, `/messages` (lecture seule), `/favoris` (login requis pour ajouter, lecture sans abonnement) ; il est redirigé vers `/abonnement` à la première tentative d'envoi de message ou de publication d'annonce.
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

### Couverture géographique

Décision actée 2026-05-06 dans `DECISIONS.md` : déploiement progressif département par département. Pilote = Bretagne historique 5 départements (29 Finistère, 22 Côtes-d'Armor, 56 Morbihan, 35 Ille-et-Vilaine, 44 Loire-Atlantique). Whitelist technique : table `departements_ouverts` (migration `20260502120000`).

- **FR45 :** Le système restreint la visibilité des profils auxiliaires et des annonces aux départements présents dans la whitelist `departements_ouverts`. Les requêtes de recherche, matching et listing d'annonces filtrent sur cette whitelist. Acceptation : une recherche avec `ville` située hors zone retourne 0 résultat de profils/annonces de cette zone et affiche un message explicite (cf. FR46) au lieu d'un état vide silencieux.
- **FR46 :** Un visiteur ou utilisateur dont le département de recherche est hors zone peut s'inscrire à une **waitlist** pour être notifié à l'ouverture de son département. Capture : email + département cible + horodatage. Acceptation : le formulaire est accessible depuis tout résultat de recherche hors zone et depuis la landing page ; un email de confirmation est envoyé immédiatement ; un email de notification est envoyé automatiquement à l'ouverture du département concerné. Stockage en table dédiée (à créer : `waitlist_departements`).
- **FR47 :** Le système bloque l'inscription auxiliaire si le département déclaré (adresse de résidence ou justificatif d'identité) est hors zone. Acceptation : le formulaire d'inscription auxiliaire valide la whitelist `departements_ouverts` et affiche un message explicatif "Service pas encore disponible dans votre département. Inscrivez-vous à la waitlist pour être averti à l'ouverture" avec lien vers le formulaire FR46.
- **FR48 :** La landing page affiche explicitement les départements actuellement ouverts ("Disponible en Bretagne : Finistère, Côtes-d'Armor, Morbihan, Ille-et-Vilaine, Loire-Atlantique"). Acceptation : la liste est rendue côté serveur depuis `departements_ouverts` (pas de hard-coding) pour rester synchronisée à toute extension future.

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
