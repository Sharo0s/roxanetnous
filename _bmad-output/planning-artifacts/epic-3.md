---
stepsCompleted: []
inputDocuments:
  - prd.md
  - ../../DECISIONS.md
  - ../../docs/mvp-coverage.md
  - ../../docs/epic-3-candidates.md
  - ../../_bmad-output/implementation-artifacts/epic-2-retro-2026-05-04.md
workflowType: 'epic'
classification:
  projectType: web_app
  domain: general
  complexity: medium
epicNumber: 3
epicTheme: 'Lancement Bretagne'
created: '2026-05-06'
status: 'à cadrer formellement (sprint planning suivant)'
---

# Epic 3 : Lancement Bretagne

## Vision

Préparer le lancement réel du produit en zone pilote Bretagne historique (5 départements : 29 Finistère, 22 Côtes-d'Armor, 56 Morbihan, 35 Ille-et-Vilaine, 44 Loire-Atlantique). Implémenter techniquement la décision **F** (déploiement progressif géographique) et clarifier la décision **A** (soft paywall). Les autres trous identifiés dans `docs/epic-3-candidates.md` sont reportés à un futur Epic 4 "Hardening".

**Décisions de référence** : `DECISIONS.md` 2026-05-06 (A : soft paywall, F : déploiement progressif Bretagne 5 dpt).

**FR couverts** : FR16 (paywall), FR45, FR46, FR47, FR48 (couverture géographique), FR6 (RGPD consentements — audit).

**Trous candidats reportés** : B (matching UI), D (OCR perfectionnement), E (visio intégration), G (tests métier — Epic 4 Hardening), I (`as any`), J (seeds).

## Pré-requis avant démarrage sprint

- Décision F2 actée dans `DECISIONS.md` (fait 2026-05-06).
- Décision A2 actée dans `DECISIONS.md` (fait 2026-05-06).
- PRD à jour : FR16 reformulé, FR45-48 ajoutés, résumé exécutif et Stratégie MVP alignés (fait 2026-05-06).
- Migration `20260502120000_departements_ouverts` en place (fait, à activer en prod via story 3.1).

## Story List

| # | Titre | Statut | FR principal |
|---|---|---|---|
| 3.1 | Activation whitelist `departements_ouverts` et filtrage requêtes | à faire | FR45 |
| 3.2 | Blocage inscription auxiliaire hors zone | à faire | FR47 |
| 3.3 | Affichage landing "Disponible en Bretagne" depuis BDD | à faire | FR48 |
| 3.4 | Waitlist hors zone bénéficiaire (table + formulaire + email confirmation) | à faire | FR46 |
| 3.5 | Notification automatique waitlist à l'ouverture département | à faire | FR46 (extension) |
| 3.6 | Audit soft paywall et corrections d'alignement code/PRD | à faire | FR16 |
| 3.7 | Audit cookies/scripts tiers et décision granularité bandeau RGPD | à faire | FR6 |
| 3.8 | Notifications admin parrainage robustes (warning si env var manquante) | à faire | — (candidat H) |

---

## Story 3.1 : Activation whitelist `departements_ouverts` et filtrage requêtes

As an utilisateur (visiteur ou abonné),
I want que la plateforme ne montre que les profils et annonces des 5 départements Bretagne historique,
So that je ne vois pas de profils hors zone qui créeraient une fausse promesse de service.

**Acceptance Criteria :**

**Given** la table `departements_ouverts` est alimentée en production avec exactement les 5 codes (29, 22, 56, 35, 44),
**When** un visiteur ou un utilisateur connecté lance une recherche, ouvre la page recherche, ou consulte la liste des annonces,
**Then** seuls les profils auxiliaires et annonces dont le département est dans la whitelist sont retournés,
**And** aucun profil hors zone n'apparaît même si l'algorithme de matching le calculerait pertinent.

**Given** un département est ajouté à la whitelist en BDD (extension future),
**When** l'utilisateur recharge la page,
**Then** les profils de ce nouveau département apparaissent immédiatement sans redéploiement.

**Given** la migration `20260502120000_departements_ouverts` existe,
**When** la story est implémentée,
**Then** les 5 codes sont insérés via une migration de seed dédiée (idempotente, `INSERT ... ON CONFLICT DO NOTHING`),
**And** un test d'intégration vérifie que la requête de recherche filtre bien (cf. dette tests Epic 4 — story scope minimal : assertion manuelle documentée pour cette story, test automatisé reporté).

**Notes implémentation** :
- Filtrage à appliquer dans : `lib/matching.ts`, `app/recherche/page.tsx`, server actions `app/actions/annonces.ts`.
- Vérifier que les pages admin (`app/admin/`) ne sont **pas** filtrées (admin doit pouvoir voir tout, hors zone inclus).
- Côté géocodage : `lib/geocoding.ts` retourne déjà un code département depuis l'adresse — réutiliser.

---

## Story 3.2 : Blocage inscription auxiliaire hors zone

As une auxiliaire de vie résidant hors Bretagne,
I want voir un message clair m'indiquant que le service n'est pas encore disponible chez moi,
So that je ne perde pas de temps à remplir un formulaire qui ne peut pas aboutir.

**Acceptance Criteria :**

**Given** une auxiliaire commence l'inscription depuis `/register` et choisit le rôle "accompagnante",
**When** elle saisit son adresse de résidence ou téléverse son justificatif d'identité,
**Then** le département est extrait (de l'adresse via `lib/geocoding.ts`, ou du justificatif via OCR),
**And** si le département est hors `departements_ouverts`, le formulaire est bloqué avec le message "Service pas encore disponible dans votre département. Inscrivez-vous à la waitlist pour être averti à l'ouverture",
**And** un lien actif redirige vers le formulaire waitlist (story 3.4).

**Given** une auxiliaire saisit une adresse en Bretagne (un des 5 dpt),
**When** elle complète l'inscription,
**Then** le formulaire suit le flux normal sans interruption.

**Given** le blocage est déclenché,
**When** l'auxiliaire est redirigée vers la waitlist,
**Then** son email et son département cible sont pré-remplis dans le formulaire waitlist.

**Notes implémentation** :
- Côté server action `app/actions/auth.ts` (signup) : check `departements_ouverts` après extraction département.
- Côté UI : composant message d'erreur cohérent avec `role="alert"` (Lot B story 2.6.4).
- Pas de blocage côté bénéficiaire — un bénéficiaire peut s'inscrire de partout, la restriction porte sur la recherche (story 3.1).

---

## Story 3.3 : Affichage landing "Disponible en Bretagne" depuis BDD

As un visiteur de la landing page,
I want voir clairement les départements actuellement couverts par roxanetnous,
So that je sache si le service est disponible chez moi avant de m'inscrire.

**Acceptance Criteria :**

**Given** la landing page (`app/page.tsx`) est rendue côté serveur,
**When** la page se charge,
**Then** un bloc visible affiche "Disponible actuellement en Bretagne : Finistère (29), Côtes-d'Armor (22), Morbihan (56), Ille-et-Vilaine (35), Loire-Atlantique (44)",
**And** les noms et codes sont lus depuis la table `departements_ouverts` (pas hard-codés),
**And** si la whitelist est étendue, le bloc affiche automatiquement les nouveaux départements au prochain rendu.

**Given** la liste affichée,
**When** un visiteur cherche son département dans la liste,
**Then** un bouton ou lien "Mon département n'est pas listé" mène au formulaire waitlist (story 3.4).

**Given** la table `departements_ouverts` est vide (cas dégradé improbable),
**When** la landing page se charge,
**Then** un message neutre s'affiche ("Lancement imminent — laissez votre email pour être informé") sans planter le rendu.

**Notes implémentation** :
- Composant `components/landing/DepartementsOuverts.tsx` à créer.
- Récupération en Server Component (cohérent avec Lot C 2.7.1).
- A11y : respecter heading-order Lot C (probablement `<h2>` ou `<h3>` selon position).
- Inclure éventuellement la carte SVG (cf. mémoire `project_hero_carte`).

---

## Story 3.4 : Waitlist hors zone bénéficiaire (table + formulaire + email)

As un visiteur ou utilisateur souhaitant utiliser roxanetnous mais habitant hors Bretagne,
I want pouvoir laisser mon email et mon département pour être notifié à l'ouverture,
So that je sois informé dès que le service arrive chez moi sans avoir à revenir sur le site.

**Acceptance Criteria :**

**Given** une nouvelle table `waitlist_departements` est créée,
**When** la migration s'applique,
**Then** la table contient au minimum : `id (uuid)`, `email (text, validé)`, `code_departement (text, 2-3 chars)`, `nom_departement (text)`, `role (text — "accompagnante" ou "accompagne" ou "visiteur")`, `created_at (timestamptz default now())`, `notified_at (timestamptz nullable)`,
**And** une RLS policy interdit toute lecture hors `service_role`,
**And** un index unique sur `(email, code_departement)` empêche les doublons.

**Given** un visiteur ou utilisateur arrive sur le formulaire waitlist (`/waitlist` ou modale depuis recherche/inscription bloquée),
**When** il saisit email + département + (optionnel) rôle,
**Then** une nouvelle ligne est insérée dans `waitlist_departements`,
**And** un email de confirmation immédiat est envoyé via Resend ("Merci, nous vous préviendrons à l'ouverture de [département]"),
**And** le formulaire affiche un message de succès accessible (`role="status"` ou `aria-live="polite"`).

**Given** un email est déjà inscrit pour ce département (doublon),
**When** le formulaire est resoumis,
**Then** la server action retourne un succès idempotent ("Vous êtes déjà sur la waitlist pour ce département") sans dupliquer ni renvoyer d'email.

**Given** un email invalide ou un département inexistant en France,
**When** le formulaire est soumis,
**Then** une erreur inline `role="alert"` s'affiche et la requête n'est pas envoyée.

**Notes implémentation** :
- Server action dans `app/actions/waitlist.ts` (à créer).
- Template email dans `lib/emails.ts` (`sendWaitlistConfirmationEmail`).
- Page dédiée `app/waitlist/page.tsx` accessible publiquement (pas de login requis).
- Référencement landing (story 3.3) et inscription bloquée (story 3.2).

---

## Story 3.5 : Notification automatique waitlist à l'ouverture département

As Sylvain (admin),
I want pouvoir ouvrir un nouveau département et que les utilisateurs en waitlist soient automatiquement notifiés par email,
So that l'extension géographique se traduise en conversions sans action manuelle de ma part.

**Acceptance Criteria :**

**Given** une page admin `/admin/departements/` (déjà existante au scan code) liste la whitelist `departements_ouverts`,
**When** je clique "Ouvrir un nouveau département" et saisis un code (ex : `75 Paris`),
**Then** le département est ajouté à `departements_ouverts`,
**And** une server action lance immédiatement (ou en cron `app/api/cron/`) un envoi d'email à toutes les lignes `waitlist_departements` correspondantes dont `notified_at IS NULL`,
**And** chaque ligne notifiée passe son `notified_at = now()`,
**And** chaque email contient un CTA "Découvrir roxanetnous dans [département]" pointant vers `/recherche` pré-filtrée.

**Given** un utilisateur a été notifié (`notified_at NOT NULL`),
**When** un nouveau département est ajouté à la whitelist,
**Then** il n'est notifié que pour les nouvelles ouvertures (pas re-notifié pour les anciennes).

**Given** un département est ré-ajouté après suppression (cas dégradé),
**When** la séquence add → remove → add a lieu,
**Then** les utilisateurs `notified_at NOT NULL` pour ce département ne sont pas re-notifiés (idempotence sur `notified_at`).

**Given** Resend retourne une erreur d'envoi,
**When** un email échoue,
**Then** l'erreur est tracée dans `notifications_log` (table existante)
**And** la ligne `waitlist_departements` reste avec `notified_at IS NULL` (re-tentative possible via cron).

**Notes implémentation** :
- Cron `app/api/cron/notify-waitlist/` (nouveau) ou trigger immédiat depuis la server action admin.
- Préférer trigger immédiat avec retry via cron secondaire (pattern cohérent avec `confirm-parrainages`).
- Email template `sendWaitlistOpeningNotificationEmail` dans `lib/emails.ts`.
- Logger admin action (`admin_actions_log` — table existante) avec `action_type = "departement_open"`.

---

## Story 3.6 : Audit soft paywall et corrections d'alignement code/PRD

As Sylvain (Project Lead),
I want vérifier que le code applique exactement la matrice paywall décidée (DECISIONS A 2026-05-06),
So that le PRD FR16 et le code livré restent cohérents et qu'aucune action de mise en relation ne soit accidentellement gratuite.

**Acceptance Criteria :**

**Given** la matrice de comportement définie dans FR16 et `DECISIONS.md` (lecture libre + paywall sur envoi message / publication annonce auxiliaire / publication annonce bénéficiaire),
**When** un audit code par grep + tests manuels est mené sur les server actions de mise en relation,
**Then** un rapport `_bmad-output/implementation-artifacts/3-6-audit-paywall.md` liste pour chaque action critique : (1) check `hasActiveSubscription()` présent oui/non, (2) si non présent : décision (ajouter / accepter / requalifier), (3) test manuel passé.

**Given** une action critique (envoi message via `app/actions/messages.ts`, publication annonce via `app/actions/annonces.ts`) ne vérifie pas l'abonnement,
**When** la story est en cours,
**Then** la vérification `hasActiveSubscription()` est ajoutée en début de fonction,
**And** un utilisateur connecté sans abonnement reçoit une erreur explicite ("Abonnement requis pour cette action") plutôt qu'une erreur générique,
**And** côté UI, le bouton est désactivé ou redirige vers `/abonnement` avant même l'appel server action.

**Given** une page lecture (`/recherche`, `/messages` lecture, `/favoris` lecture) déclenche actuellement un check abonnement bloquant,
**When** l'audit le détecte,
**Then** le check est retiré (alignement DECISIONS A2),
**And** un test manuel confirme qu'un visiteur non abonné peut bien lire.

**Given** des routes protégées doivent rester protégées (création annonce auxiliaire, dashboard payant accompagnante),
**When** l'audit les vérifie,
**Then** elles continuent de bloquer correctement.

**Notes implémentation** :
- Pas de refactor architectural (pas de middleware global). On reste sur le pattern actuel "check par route/action".
- Utiliser `grep "hasActiveSubscription"` pour inventorier les points de vérif.
- Cibler en priorité : `app/actions/messages.ts`, `app/actions/annonces.ts`, `app/accompagnante/annonces/page.tsx`, `app/accompagne/annonces/page.tsx`.

---

## Story 3.7 : Audit cookies/scripts tiers et décision granularité bandeau RGPD

As Sylvain (responsable RGPD du projet),
I want savoir précisément quels cookies et scripts tiers sont posés en production,
So that je décide si le bandeau binaire actuel est conforme ou si un consent management granulaire est nécessaire.

**Acceptance Criteria :**

**Given** la production est accessible (URL roxanetnous.fr ou équivalent),
**When** une session de browser DevTools (Application > Cookies + Network) est ouverte sur landing + une page authentifiée + une page Stripe Checkout,
**Then** un rapport `_bmad-output/planning-artifacts/audit-cookies-2026-MM-DD.md` liste : (1) tous les cookies posés (nom, domaine, durée, http-only, secure), (2) tous les scripts tiers chargés (Stripe, Resend tracking, Vercel Analytics, fonts, etc.), (3) classification RGPD pour chacun (essentiel / mesure d'audience exemptée / non essentiel).

**Given** le rapport,
**When** la classification est validée,
**Then** une décision est ajoutée à `DECISIONS.md` :
- Soit "bandeau binaire conforme — tous cookies essentiels ou mesure d'audience exemptée CNIL", la politique de confidentialité reste alignée et le composant `cookie-banner.tsx` ne change pas,
- Soit "consent granulaire requis", auquel cas une story dédiée est ajoutée à un futur Epic 4 (CMP minimal).

**Given** un script tiers non essentiel est détecté (ex : analytics non exempté),
**When** la décision est de rester en bandeau binaire,
**Then** le script doit être désactivé (et la décision documentée),
**Otherwise** la story bascule en blocage et nécessite l'Epic 4 CMP avant lancement Bretagne.

**Notes implémentation** :
- Audit manuel suffisant — pas d'outillage automatisé requis pour cette story.
- Si analyse révèle Vercel Analytics actif : vérifier statut RGPD (Vercel Analytics serait classé exempté CNIL en mode anonymisé — à confirmer dans l'audit).
- Politique de confidentialité (`app/politique-de-confidentialite/page.tsx`) à mettre à jour si la décision change.

---

## Story 3.8 : Notifications admin parrainage robustes

As Sylvain (admin),
I want être alerté de manière fiable quand le système détecte un flag anti-fraude parrainage,
So that je ne rate aucun signal y compris sur staging/preview où la variable d'env `ADMIN_NOTIFICATIONS_EMAIL` peut manquer.

**Acceptance Criteria :**

**Given** la fonction `sendAdminParrainageFlag()` dans `lib/emails.ts` (ou équivalent),
**When** la variable d'environnement `ADMIN_NOTIFICATIONS_EMAIL` est absente ou vide,
**Then** un `console.warn` explicite est émis ("ADMIN_NOTIFICATIONS_EMAIL manquant — alerte parrainage non envoyée par email, voir admin_actions_log"),
**And** le warning apparaît dans Vercel logs visibles côté admin,
**And** l'alerte reste tracée dans `admin_actions_log` (comportement actuel inchangé).

**Given** la variable est définie correctement,
**When** un flag anti-fraude est déclenché,
**Then** l'email est envoyé normalement (comportement actuel inchangé).

**Given** un déploiement preview Vercel,
**When** la CI vérifie les variables d'environnement requises,
**Then** une alerte CI est levée si `ADMIN_NOTIFICATIONS_EMAIL` manque dans le scope production (preview accepté avec warning).

**Notes implémentation** :
- Une seule modification ciblée dans `lib/emails.ts` (ajout du `console.warn` conditionnel).
- Vérifier que `NEXT_STEPS.md` mentionne bien cette variable comme requise en production (sinon l'ajouter).
- Pas de refactor de l'architecture des notifications.

---

## Hors scope Epic 3 — reportés Epic 4 "Hardening"

Ces candidats de `docs/epic-3-candidates.md` sont reportés pour ne pas alourdir le lancement Bretagne :

- **Candidat B — Matching UI** : pas de page "mes matchings". Décision : la recherche manuelle + emails suffisent au pilote. Re-évaluer après 3 mois de données utilisateur.
- **Candidat D — OCR perfectionnement** : suffisant à 5-25 auxiliaires (charge admin gérable). Re-évaluer si croissance > 25 ou si délai validation dépasse 24h.
- **Candidat E — Visio intégration technique** : par design hors plateforme (sprint-change-proposal-2026-04-18-visio-validation). Pas de re-évaluation prévue.
- **Candidat G — Tests métier** : Epic 4 Hardening dédié. Priorité ordre risque : Stripe webhook > parrainage anti-fraude > matching > RGPD cascade > paywall.
- **Candidat I — Types `as any`** : pas une story, à intégrer dans la DoD ("interdire `as any` introduit, résorber au passage").
- **Candidat J — Seeds Supabase** : différable jusqu'à Epic 4 tests intégration.

## Définition de "Done" Epic 3

Epic 3 est clôturé quand :

1. Les 8 stories sont en statut `done` (commits livraison + clôture après CI verte selon convention Lot C).
2. Au moins un département Bretagne est ouvert et **fonctionnellement testé en production** : recherche d'un profil, inscription auxiliaire en zone, blocage hors zone, waitlist hors zone, email de confirmation reçu.
3. Décision RGPD (story 3.7) actée dans `DECISIONS.md`.
4. Audit paywall (story 3.6) sans écart critique restant ou écarts documentés.
5. Rétrospective Epic 3 livrée (`epic-3-retro-YYYY-MM-DD.md`).

## Indicateurs de succès post-lancement Bretagne (à mesurer 30 jours après go-live)

- Inscriptions auxiliaires Bretagne / mois (cible : 5+).
- Inscriptions waitlist hors zone / mois (cible : 20+).
- Taux de rebond landing après affichage "Disponible en Bretagne" (à instrumenter ou estimer).
- Conversions abonnement bénéficiaires Bretagne / mois (cible : 10+).
- Aucun bypass paywall détecté lors de l'audit story 3.6.
