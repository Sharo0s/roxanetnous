# Candidats épic 3 — zones grises et trous identifiés

**Date** : 2026-05-06
**Objectif** : matière première brute pour cadrage formel d'un épic 3 (recommandation rétro épic 2). Ce document **n'est pas un PRD** ni un plan de stories. Il liste des constats argumentés, à arbitrer.

**Source de vérité** : code livré au 2026-05-06 + PRD `_bmad-output/planning-artifacts/prd.md`.

**Méthode** : pour chaque trou, on donne le constat (factuel, code-ancré), l'impact, et une question de cadrage. Pas de chiffrage j-dev. Pas de priorisation. C'est le travail du cadrage formel.

---

## A. Hard paywall — clarifier le périmètre (FR16)

### Constat

Le PRD section "Périmètre Produit" et FR16 disent : *"Hard paywall — tout bloqué sans abonnement actif"*. Le code observé n'a **pas** de middleware global d'enforcement. La vérification d'abonnement est faite page par page via `hasActiveSubscription()` (`lib/subscription-helpers.ts`).

Routes confirmées qui appliquent le check :

- `app/accompagnante/annonces/page.tsx:32` — création/gestion d'annonces auxiliaire.

Routes accessibles **sans abonnement actif** observées au scan code :

- `app/recherche/` (recherche + filtres + favoris).
- `app/messages/` (messagerie).
- `app/favoris/` (consultation favoris).

`proxy.ts` ne fait que rafraîchir la session Supabase, pas d'enforcement abonnement.

### Impact

Deux scénarios possibles :

1. **Design intentionnel** : lecture gratuite, action payante. Dans ce cas le PRD est imprécis et "hard paywall" est une formulation trompeuse — c'est plutôt un *paywall sur les actions de mise en relation*. À documenter dans DECISIONS.md.
2. **Trou de couverture** : intention initiale "hard" mais implémentation incomplète, des bénéficiaires non abonnés peuvent contourner le modèle économique en lisant les profils sans payer.

### Questions de cadrage

- Quelle est la décision produit : hard paywall vrai (tout bloqué) ou soft paywall (action payante seulement) ?
- Si hard : où placer l'enforcement (middleware global vs check par route) ? Quelles routes whitelistées (landing, login, register, RGPD, /accessibilite) ?
- Si soft : quelles actions exactement déclenchent le paywall (premier message envoyé, ajout favori, contact direct) ?

---

## B. Matching — manque l'expérience utilisateur (FR21, FR24)

### Constat

L'algorithme de matching est livré et opérationnel : `lib/matching.ts` (scoring 100 points sur 5 critères), `lib/geocoding.ts` (Haversine), `lib/matching-notifications.ts` (déclenchement à la création d'annonce). Le seuil de notification est **`>= 50/100`** *hard-codé* dans le code.

**Aucune page UI** n'expose les matchings à l'utilisateur. Pas de route `/matching/` ni section "mes correspondances" dans les dashboards. Le matching est exclusivement consommé via emails sortants.

### Impact

- **Découverte aveugle** : l'utilisateur ne voit que les profils qu'il trouve via la recherche manuelle (filtres) ou via email. Il n'a aucune vue agrégée des compatibilités calculées.
- **Pas de feedback loop** : impossible de savoir si l'algorithme produit de bons résultats côté utilisateur. Pas de "non pertinent" cliquable.
- **Seuil opaque** : `50/100` non documenté en config, non ajustable par utilisateur (préférences) ni par admin (tuning produit).
- **PRD FR21** dit *"Le système calcule un score de matching"* — livré. **FR24** dit *"notifie par email"* — livré. Mais aucune FR PRD ne demande explicitement une page UI de matching. C'est une zone grise du PRD lui-même.

### Questions de cadrage

- Une page "mes matchings" ou "profils suggérés" est-elle nécessaire au modèle économique, ou la recherche manuelle + emails suffit-elle ?
- Le seuil 50/100 doit-il être configurable (utilisateur, admin) ou rester un constante produit ?
- Faut-il instrumenter les matchings (acceptation, refus, contact entamé) pour mesurer la pertinence ?

---

## C. RGPD — consentements granulaires absents (FR6)

### Constat

FR4 (suppression compte) : **livré**. Cascade complète Stripe → Storage → DB → auth.users (`app/actions/auth.ts:225-290`).

FR5 (export données) : **livré**. JSON structuré (`app/actions/rgpd.ts:6-65`).

FR6 (consentements) : **partiellement livré**.

- `components/cookie-banner.tsx` existe.
- Stockage : `localStorage['cookies-accepted']` binaire (oui/non).
- Pas de distinction cookies essentiels / analytics / marketing.
- Pas de mécanisme de retrait après acceptation.
- Politique de confidentialité (`app/politique-de-confidentialite/page.tsx`, 7,2K) affirme "aucun cookie publicitaire ou de suivi" — cohérent avec un bandeau binaire si vrai.

### Impact

- **Risque conformité** : la CNIL exige un consentement granulaire **uniquement** si des cookies tiers analytics/marketing sont posés. Si le site ne pose effectivement aucun cookie non essentiel (ce qu'affirme la politique), le bandeau binaire actuel peut être suffisant. **À auditer concrètement** : quels cookies/scripts tiers sont posés au chargement (Stripe Checkout, Resend tracking, Vercel Analytics, GA, etc.) ?
- **Risque produit** : si le projet introduit plus tard analytics ou tracking (mesure d'attribution, A/B testing — Phase 2 du PRD), le bandeau actuel devient non conforme et bloque le déploiement.

### Questions de cadrage

- Audit factuel des cookies/scripts tiers posés en production : quels acteurs, quel statut RGPD ?
- Si tout est essentiel : mettre à jour la politique pour le formaliser et ne rien faire d'autre.
- Si non : faut-il un consent management complet (CMP minimal) maintenant ou seulement quand un service non essentiel sera ajouté ?

---

## D. OCR — pré-validation incomplète (FR9)

### Constat

`lib/ocr.ts` intègre Google Cloud Vision pour pré-analyser les justificatifs. Table `ocr_results` stocke les résultats. Cohérence diplôme déclaré vs OCR détecté : amorce présente.

Limites observées :

- Pas de fonction de **re-scan** ou de correction manuelle d'OCR (admin doit accepter le résultat brut ou ignorer).
- Pas d'utilisation du **score de confiance** pour rejet automatique de documents illisibles (admin doit le détecter à l'œil).
- PDF non parsés (commentaire `"analyse manuelle requise"`).
- Pas de comparaison automatisée nom OCR ↔ nom déclaré sur la pièce d'identité (ce que le parcours 4 du PRD décrit comme attendu).

### Impact

- Le PRD critère succès technique vise *"OCR pré-validation documents > 80% précision"*. Pas de métrique observable actuellement (aucun script de mesure).
- Plus de friction admin que prévu : OCR allègent peu, admin re-fait quand même la majorité du travail.
- Pas critique pour 5–25 auxiliaires (charge gérable). Le devient si croissance > 25.

### Questions de cadrage

- L'OCR actuel est-il "assez bon" pour le volume MVP (5–25 auxiliaires) ou faut-il investir maintenant ?
- Si épic 3 vise la croissance, automatiser plus l'OCR est un levier ; si épic 3 vise autre chose, c'est différable.
- Mesure : peut-on instrumenter le taux de validation OCR auto vs override admin sur les 30 prochaines validations pour décider en data ?

---

## E. Visio admin — pas d'intégration technique (FR11bis–FR11quater)

### Constat

Les 3 FR visio sont livrées **côté tracabilité administrative** :

- Statuts intermédiaires `visio_a_planifier` et `visio_realisee` (migrations).
- Colonnes `visio_date`, `visio_notes` sur `accompagnantes_profiles`.
- Email convocation envoyé (`sendValidationResultEmail`).
- Bouton "Valider" actif uniquement si `visio_realisee`.

**Aucune intégration technique** : pas de Daily.co, Whereby, Jitsi, ou autre. Pas de `visio_url` ni `call_token` en BDD. Pas de composant front `app/visio/`.

### Impact

- Conforme aux 3 FR : elles ne demandent **pas** de visio in-app, juste la tracabilité administrative et l'email de convocation.
- Friction admin : Sylvain doit organiser la visio hors-plateforme (Zoom, Meet, téléphone), copier la date dans `visio_date`, prendre des notes, marquer `visio_realisee`. C'est par design (DECISIONS implicite via sprint-change-proposal-2026-04-18-visio-validation).

### Questions de cadrage

- Cette friction est-elle acceptable au volume MVP ou justifie-t-elle un investissement intégration ?
- Cas particulier : bypass filleule via parrainage (DECISIONS parrainage 2026-04-18) — la visio peut être bypassée pour les parrainages réussis. Cela amortit la friction.
- Pas une priorité épic 3 sauf si la rétro post-25 auxiliaires révèle un blocage.

---

## F. Couverture départements — restriction progressive non documentée (FR15)

### Constat

PRD : *"Couverture : toutes les villes de France"* (résumé exécutif et FR15).

Migration `20260502120000_departements_ouverts` introduit une **whitelist** de départements. Implication : la plateforme prépare un déploiement progressif géographique.

Pas de DECISIONS.md sur ce sujet. Pas de mention dans les rétros lues.

### Impact

- **Conflit doc/code** : le PRD vend "toutes villes de France" ; le code prévoit un déploiement département par département.
- **Risque communication** : la landing page dit-elle quelque chose ? Si oui, faut-il aligner le discours (lancement progressif) ?
- **Question tactique** : si lancement progressif assumé, l'épic 3 devrait inclure une UX pour expliquer les départements non couverts (pas de profil = "pas encore lancé chez vous, prévenez-moi") plutôt que zéro résultat silencieux.

### Questions de cadrage

- La restriction `departements_ouverts` est-elle activée en production ou dormante ?
- Quel est le département pilote de lancement ?
- DECISIONS.md à créer pour formaliser la stratégie déploiement progressif si c'est bien la décision.

---

## G. Dette de tests — couverture métier nulle

### Constat

État réel des tests :

- **A11y** : 6 specs Playwright + axe-core. Baseline 0 violations Critical/Serious. Bloquant CI + commit (règle CLAUDE.md).
- **Unit** : aucun fichier `*.test.ts` / `*.spec.ts` hors a11y.
- **Intégration** : aucun.

Logiques **non couvertes** par tests automatisés :

- Algorithme de matching (calcul scores, distance, seuil).
- Anti-fraude parrainage (détection email/carte/IP/adresse).
- Cascade RGPD (suppression compte + storage + Stripe).
- Paywall enforcement (quand il sera clarifié, cf. A).
- Webhooks Stripe (idempotence, ordre des événements, échec paiement).
- Server actions critiques (auth, subscription, parrainage).

La rétro épic 2 mentionne *"Tests purs 18 PASS"* mais aucun fichier `*.test.ts` n'existe — soit ce sont des tests historiques supprimés, soit une référence à du test exploratoire manuel. À clarifier auprès de Sylvain (mémoire).

### Impact

- **Risque régression silencieuse** : un refactor matching ou parrainage peut casser sans alerte CI.
- **Risque Stripe** : le webhook traite 4 événements + idempotence + anti-fraude. Une régression peut produire des doubles facturations ou bypass anti-fraude sans détection immédiate.
- **Coût technique futur** : plus la base grandit sans tests, plus il devient cher d'en ajouter (faut alors auditer + couvrir simultanément).

### Questions de cadrage

- Politique de tests pour épic 3 : opportuniste (couvre ce que tu modifies) ou systématique (rattrapage de la dette) ?
- Si systématique, prioriser : Stripe webhook > parrainage anti-fraude > matching > RGPD > paywall (par ordre de risque financier/conformité).
- Outillage : Vitest ou Jest pour unit ? Playwright "tout-Inclus" pour intégration ? À trancher.

---

## H. Notifications admin parrainage — silencieux si env var absente

### Constat

`sendAdminParrainageFlag()` envoie une alerte à `ADMIN_NOTIFICATIONS_EMAIL`. Si la variable d'env n'est pas définie :

- L'alerte est tracée dans `admin_actions_log` (visible UI admin /admin/historique).
- **Aucun email envoyé**.

Risque : sur une preview Vercel ou un staging incomplet, les flags anti-fraude passent inaperçus.

### Impact

- Faible si la production a bien la variable.
- Moyen sur staging/preview où Sylvain ferait des tests parrainage et perdrait les signaux.

### Questions de cadrage

- Vérifier production a bien la variable. C'est dans le NEXT_STEPS.md TODO ? À auditer.
- Décision : doit-on logger un warning serveur si la variable manque (au moins le voir dans Vercel logs) ?

---

## I. Types `any` et coercions Supabase

### Constat

Plusieurs pages utilisent `as any` pour gérer les relations imbriquées Supabase mal typées :

- `app/messages/page.tsx:133` et `:137` (relations `accompagnes_profiles` / `accompagnantes_profiles`)
- `app/admin/historique/page.tsx`
- D'autres occurrences à recenser via `grep "as any"`.

### Impact

- Risque de régression silencieuse au refactor : un changement de schéma BDD ne déclenche pas d'erreur TypeScript là où `any` est utilisé.
- Pas critique en MVP mais grossit avec la base. Hygiène plus que feature.

### Questions de cadrage

- Pas un sujet d'épic 3 en soi. Plutôt un thème transverse à intégrer dans la DoD : "interdire `as any` introduit dans les nouvelles stories" + résorber au passage les occurrences existantes touchées par le code modifié.

---

## J. Seeds et fixtures absents

### Constat

`supabase/migrations/` ne contient que des DDL et RLS. Pas de `supabase/seed.sql`. Pas de scripts de génération de données de test (`scripts/seed-*.ts`).

### Impact

- Onboarding nouveau dev / reset environnement : pas de jeu de données de référence.
- Tests d'intégration futurs (cf. G) auront besoin d'un seeding minimal — il faudra le créer.

### Questions de cadrage

- Prioritaire seulement si épic 3 introduit des tests d'intégration. Sinon différable.

---

## Ce que ce document n'aborde pas (volontairement)

- **Parrainage** : déjà documenté à fond (3 tech-specs 2.1–2.4 + rétro). Si épic 3 le touche, partir de ces sources.
- **A11y** : Lots A/B/C livrés. Réserves restantes documentées dans `_bmad-output/test-artifacts/nfr-assessment-a11y-2026-05-04.md` (B4 cibles tactiles 44px, D4 Leaflet, E3 tests manuels VoiceOver/NVDA). Lot D conditionnel, déclencheur externe.
- **Phase 2 / Phase 3 PRD** : ML matching, mobile native, multi-langue, etc. Hors périmètre MVP, non listés ici.

## Recommandation pour le cadrage formel épic 3

Avant `bmad-create-epics-and-stories`, exécuter `bmad-product-brief` ou `bmad-correct-course` pour :

1. Trancher A (paywall) et F (départements) — ce sont des **décisions produit**, pas des trous techniques. Mettre à jour DECISIONS.md.
2. Décider si C (consent RGPD) et G (tests) sont dans le périmètre épic 3 ou non.
3. Décider du **thème** de l'épic 3 (croissance, conformité, qualité technique, expérience découverte) avant de choisir les stories. Les trous ci-dessus se regroupent naturellement :
   - Thème **conformité** : A + C + F + G partiel.
   - Thème **expérience découverte** : B (matching UI) + A (paywall) si soft.
   - Thème **fiabilité technique** : G + D + H + I + J.
