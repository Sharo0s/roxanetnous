# Cartographie MVP livré vs PRD

**Date** : 2026-05-06
**Auteur** : généré par état des lieux pré-épic 3
**Source de vérité** : code livré (`app/`, `lib/`, `components/`, `supabase/migrations/`).
**Périmètre** : les 15 fonctionnalités MVP listées dans le PRD section "MVP — 15 Fonctionnalités (Phase 1)".

## Comment lire ce document

Pour chaque fonctionnalité PRD :

- **Statut** : `Livré` / `Partiel` / `Absent`. Le statut reflète le code observé, pas l'historique BMad. En cas de conflit entre une story marquée `done` et le code, le code l'emporte.
- **Points d'ancrage** : fichiers et tables clés. Pas exhaustif, juste les points d'entrée.
- **Couverture FR** : exigences fonctionnelles du PRD couvertes (FR1–FR44).
- **Renvois** : ne re-narre pas le PRD/DECISIONS/tech-specs. Renvoie. Voir l'index croisé en fin de document.

## Tableau de synthèse

| # | Fonctionnalité PRD | Statut | FR couverts | Réserves |
|---|---|---|---|---|
| 1 | Authentification multi-rôles | Livré | FR1–FR3 | — |
| 2 | Vérification manuelle + OCR | Livré | FR7–FR11quater | OCR sans re-scan ni rejet auto |
| 3 | Abonnements Stripe | Livré | FR13–FR15, FR17 | — |
| 4 | Hard paywall | Partiel | FR16 | Pas de middleware global, vérif déportée page par page |
| 5 | Annonces bidirectionnelles | Livré | FR18–FR20 | — |
| 6 | Badges automatiques | Livré | FR25–FR26 | Cron `update-badges` actif |
| 7 | Matching 5 critères | Livré | FR21, FR24 | Pas de page UI "mes matchings", seuil 50/100 hard-codé |
| 8 | Recherche + filtres + favoris | Livré | FR22–FR23 | Recherche accessible aux non-abonnés (paywall #4) |
| 9 | Messagerie temps réel | Livré | FR27–FR29 | — |
| 10 | Emails transactionnels | Livré | FR24, FR28 | 18 types via Resend |
| 11 | Dashboards (aux/bénéf/admin) | Livré | FR37–FR39 | — |
| 12 | Landing page (preuves, FAQ, contact) | Livré | FR40–FR44 | — |
| 13 | Modération & signalements | Livré | FR33–FR36 | — |
| 14 | Conformité RGPD | Partiel | FR4–FR5, partiel FR6 | Consentements granulaires absents |
| 15 | Couverture géographique France | Partiel | — | Migration `departements_ouverts` introduit restriction progressive |

## Détail par fonctionnalité

### 1. Authentification multi-rôles — Livré

- **Provider** : Supabase Auth (JWT, SSR via `@supabase/ssr`).
- **Rôles** : `accompagnante`, `accompagne`, `admin` (colonne `role` table `users`).
- **Pages** : `app/login/`, `app/register/`, `app/forgot-password/`, `app/reset-password/`, `app/auth/callback/`.
- **Middleware session** : `proxy.ts` → `lib/supabase/middleware.ts` (refresh token).
- **Couverture FR** : FR1, FR2, FR3.

### 2. Vérification manuelle + OCR — Livré (avec réserves)

- **Onboarding auxiliaire** : `app/accompagnante/onboarding/`, server actions `app/actions/profile.ts`.
- **Upload justificatifs** : Supabase Storage (bucket privé, URL signées).
- **OCR** : `lib/ocr.ts` (Google Cloud Vision). Table `ocr_results`.
- **Workflow validation** : statuts `validation_status` ENUM avec étapes intermédiaires `visio_a_planifier` et `visio_realisee` (migrations `20260418143626/727`).
- **Visio** : tracée en BDD (`visio_date`, `visio_notes`, table `admin_conversations`) mais **pas d'intégration technique** (Daily.co, Whereby ou autre absent). Processus admin manuel : voir tech-spec sprint-change visio-validation 2026-04-18.
- **Email convocation** : `sendValidationResultEmail` dans `lib/emails.ts`.
- **Couverture FR** : FR7, FR8, FR9, FR10, FR11, FR11bis, FR11ter, FR11quater, FR12.
- **Réserves** : voir `docs/epic-3-candidates.md` section "OCR".

### 3. Abonnements Stripe — Livré

- **Helpers** : `lib/stripe.ts`, `lib/subscription-helpers.ts`.
- **Server actions** : `app/actions/subscription.ts` (createCheckoutSession, updatePlan, cancelSubscription).
- **Webhook** : `app/api/webhooks/stripe/route.ts` (~700 lignes, 4 événements traités).
- **Idempotence webhook** : table `stripe_events_processed` (migration `20260428162905`, RLS service_role uniquement).
- **Offre de lancement** : `LAUNCH_OFFER_END` env var, helpers `getTrialDays/isLaunchOffer`.
- **Restriction paiement** : `payment_method_types: ['card']` (anti-fraude parrainage via fingerprint).
- **Couverture FR** : FR13, FR14, FR15, FR17.

### 4. Hard paywall — Partiel

- **Architecture observée** : pas de middleware global qui rejette les routes selon abonnement. `proxy.ts` ne fait que rafraîchir la session Supabase.
- **Vérification déportée** : `hasActiveSubscription()` dans `lib/subscription-helpers.ts`, appelée page par page.
- **Routes confirmées protégées** : `app/accompagnante/annonces/page.tsx` (création/gestion annonces).
- **Routes accessibles sans abonnement actif** observées au scan : `app/recherche/`, `app/messages/`, `app/favoris/`. À confirmer si design intentionnel (lecture libre, action payante) ou trou.
- **Couverture FR** : FR16 *partiellement*.
- **Voir** : `docs/epic-3-candidates.md` section "Hard paywall — clarifier le périmètre".

### 5. Annonces bidirectionnelles — Livré

- **Tables** : `annonces_accompagnantes` (publication auxiliaire), `annonces_accompagnes` (recherche bénéficiaire).
- **Server actions** : `app/actions/annonces.ts` (CRUD + toggle status).
- **Pages** : `app/accompagnante/annonces/`, `app/recherche/demandes/` (côté bénéficiaire).
- **Brouillon** : champ statut sur `annonces_accompagnantes`, support FR20.
- **Couverture FR** : FR18, FR19, FR20.

### 6. Badges automatiques — Livré

- **Table cache** : `badges_cache`.
- **Cron** : `app/api/cron/update-badges/`.
- **Affichage** : composants dans `components/accompagnante/`.
- **Note historique** : badges PCH/APA supprimés (DECISIONS.md 2026-02-11). Badges actuels = annonce active + ancienneté.
- **Couverture FR** : FR25, FR26.

### 7. Matching intelligent 5 critères — Livré (avec réserves)

- **Algorithme** : `lib/matching.ts` (scoring sur 100). Pondération : spécialités 40, localisation 25, expérience 15, diplôme 10, disponibilités 10.
- **Géocodage** : `lib/geocoding.ts` (Haversine + api-adresse.data.gouv.fr).
- **Notifications** : `lib/matching-notifications.ts`. Déclenchement à la création d'annonce, seuil score ≥ 50/100 (hard-codé).
- **Pas de page UI** : aucune route `/matching/` ni "mes matchings". Le matching est exclusivement consommé via emails.
- **Couverture FR** : FR21, FR24.
- **Voir** : `docs/epic-3-candidates.md` section "Matching".

### 8. Recherche avancée + favoris — Livré

- **Page recherche** : `app/recherche/page.tsx` (filtres multiples, infinite scroll).
- **Filtres** : `components/recherche/SearchFilters`.
- **Favoris** : table `favoris`, server actions `app/actions/favoris.ts`, composant `FavoriButton`.
- **Couverture FR** : FR22, FR23.
- **Réserve transverse** : voir #4 paywall — recherche accessible visiteurs non connectés.

### 9. Messagerie temps réel — Livré

- **Tables** : `conversations`, `messages`.
- **Realtime** : Supabase Realtime (WebSocket).
- **Pages** : `app/messages/`, `app/messages/[id]/`.
- **Server actions** : `app/actions/messages.ts`.
- **A11y** : `role="log"` + `aria-live="polite"` (Lot B story 2.6.2).
- **Couverture FR** : FR27, FR28, FR29.

### 10. Notifications email transactionnelles — Livré

- **Provider** : Resend (`@resend/resend@6.9.2`).
- **Templates** : `lib/emails.ts`, 15 fonctions exportées, 18 types tracés dans `notifications_log`. HTML inline avec escape XSS, en français.
- **Déclencheurs PRD couverts** :
  - Validation profil → `sendValidationResultEmail`, `sendWelcomeEmail`.
  - Nouveau message → `sendNewMessageEmail`.
  - Matching → `sendMatchingNotificationEmail`.
- **Déclencheurs additionnels** : abonnement (5 types), parrainage (4 types), disponibilité (2 types), admin alerts.
- **Logging** : table `notifications_log` (status, error, sent_at).
- **Couverture FR** : FR24, FR28.

### 11. Dashboards — Livré

- **Auxiliaire** : `app/accompagnante/dashboard/page.tsx`.
- **Bénéficiaire** : `app/accompagne/dashboard/page.tsx`.
- **Admin** : `app/admin/` (12 pages : utilisateurs, validation, annonces, parrainages, signalements, historique, messages, etc.).
- **Métriques admin** : page principale `/admin/` avec MRR, délai validation, taux validation.
- **Couverture FR** : FR37, FR38, FR39.

### 12. Landing page — Livré

- **Page** : `app/page.tsx` + composants `components/landing/` (présumé).
- **Carte hero** : SVG avec alternative textuelle (Lot B story 2.6.5).
- **Compteurs dynamiques** : nombre d'auxiliaires vérifiés.
- **FAQ** : composant intégré.
- **Formulaire de contact** : `app/actions/contact.ts` (envoi email via Resend).
- **Boutons orientation** : "Je suis aidant" / "Je recherche un aidant".
- **Couverture FR** : FR40, FR41, FR42, FR43, FR44.

### 13. Modération & signalements — Livré

- **Server actions** : `app/actions/signalements.ts` (côté utilisateur), `app/actions/admin-signalements.ts` (côté admin), `app/actions/admin.ts` (suspendre/avertir).
- **Page admin** : `app/admin/signalements/`.
- **Logs d'audit** : table `admin_actions_log` (toutes actions admin tracées).
- **Couverture FR** : FR33, FR34, FR35, FR36.

### 14. Conformité RGPD — Partiel

- **Suppression compte (FR4)** : `app/actions/auth.ts:225-290` (`deleteAccount`). Cascade : Stripe → Storage → DB user → auth.users. Composant `DeleteAccountButton` avec confirmation textuelle.
- **Export données (FR5)** : `app/actions/rgpd.ts:6-65` (`exportUserData`). Format JSON structuré (user, profils, annonces, messages, abonnement, favoris). Composant `ExportDataButton`.
- **Consentements (FR6)** : composant `CookieBanner` minimal — localStorage `cookies-accepted` binaire. Pas de distinction essentiels / analytics / marketing. Pas de retrait après acceptation.
- **Pages légales** : `app/cgu/`, `app/mentions-legales/`, `app/politique-de-confidentialite/`, `app/accessibilite/`.
- **Couverture FR** : FR4, FR5 livrés ; FR6 partiel.
- **Voir** : `docs/epic-3-candidates.md` section "RGPD".

### 15. Couverture géographique France — Partiel

- **Géocodage** : couverture France complète via api-adresse.data.gouv.fr.
- **Restriction progressive** : migration `20260502120000_departements_ouverts` introduit une whitelist de départements. Implication : couverture *technique* France entière mais *exposition produit* limitée par département au lancement.
- **Statut PRD vs livré** : à clarifier — le PRD dit "toutes villes de France", le code prépare un déploiement progressif. Décision produit à formaliser.
- **Voir** : `docs/epic-3-candidates.md` section "Couverture départements".

## Stack technique observée

- **Front** : Next.js 16.1.6, React 19.2.4, TailwindCSS 4.1.18.
- **Backend** : Supabase (Auth + DB + Storage + Realtime), 22 migrations.
- **Paiement** : Stripe 22.0.2.
- **Email** : Resend 6.9.2.
- **Cartes** : Leaflet 1.9.4 + react-leaflet 5.0.0.
- **OCR** : Google Cloud Vision API.
- **Tests** : Playwright 1.59.1 + axe-core/playwright 4.11.3 (a11y uniquement).
- **Crons** : 5 endpoints `app/api/cron/` (sweep-stripe-events, confirm-parrainages, reactivate-disponible, expiration-reminder, update-badges).

## Tests — état réel

- **A11y** : 6 specs Playwright dans `tests/a11y/` (couvrant les 7 entrées baseline des 6 parcours métier consolidés). Baseline axe-core 0 violations Critical/Serious. Bloquant en CI Vercel et localement (règle CLAUDE.md durcie 2.7.4).
- **Unit** : aucun fichier `*.test.ts` ou `*.spec.ts` hors a11y.
- **Intégration** : aucun.
- **Métier non couvert par tests automatisés** : matching (algorithme + seuils), emails (déclencheurs), RGPD (cascade delete, export), paywall, anti-fraude parrainage, webhooks Stripe.
- **Voir** : `docs/epic-3-candidates.md` section "Dette de tests".

## Index croisé — où trouver quoi

### Décisions et contraintes produit

- `DECISIONS.md` (racine) — fait autorité. Décisions actives : suppression tarif horaire/PCH/APA, design noir et blanc, suppression contrats PDF, TODO production.

### Spec produit et architecture

- `_bmad-output/planning-artifacts/prd.md` — PRD complet (4 parcours, 44 FR, NFR a11y, roadmap Phase 2/3).
- `_bmad-output/planning-artifacts/architecture-technique-roxanetnous-2026-02-09.md` — architecture initiale.
- `_bmad-output/planning-artifacts/product-brief-roxanetnous-2026-02-09.md` — brief initial.
- `_bmad-output/planning-artifacts/ux-design-specification.md` — UX.
- `_bmad-output/planning-artifacts/audit-a11y-2026-05-04.md` — audit a11y initial.
- `_bmad-output/planning-artifacts/sprint-change-proposal-2026-04-18-parrainage.md` — pivot parrainage.
- `_bmad-output/planning-artifacts/sprint-change-proposal-2026-04-18-visio-validation.md` — pivot visio admin.
- `_bmad-output/planning-artifacts/sprint-change-proposal-2026-04-18.md` — pivot global.

### Tech-specs et stories

- `_bmad-output/implementation-artifacts/tech-spec-amelioration-gestion-abonnements.md` — Stripe / abonnements.
- `_bmad-output/implementation-artifacts/tech-spec-lot-a-a11y.md` — Lot A.
- `_bmad-output/implementation-artifacts/tech-spec-lot-b-a11y.md` — Lot B.
- `_bmad-output/implementation-artifacts/tech-spec-lot-c-a11y.md` — Lot C.
- Stories individuelles : `_bmad-output/implementation-artifacts/2-1-*.md` à `2-7-6-*.md` (parrainage 2.1–2.4, a11y 2.5.x à 2.7.x).

### Rétrospectives

- `_bmad-output/implementation-artifacts/epic-2-retro-2026-05-04.md` — épic 2 (recommande cadrage formel avant épic 3).
- `_bmad-output/implementation-artifacts/mini-epic-2-5-retro-2026-05-05.md` — Lot A.
- `_bmad-output/implementation-artifacts/mini-epic-2-6-retro-2026-05-06.md` — Lot B.
- `_bmad-output/implementation-artifacts/mini-epic-2-7-retro-2026-05-06.md` — Lot C.
- `_bmad-output/implementation-artifacts/lot-b-bilan-axe-core-2026-05-06.md` — bilan axe-core Lot B.
- `_bmad-output/implementation-artifacts/deferred-work.md` — travaux différés.

### Tests et qualité

- `tests/a11y/README.md` — protocole baseline et exécution.
- `_bmad-output/test-artifacts/nfr-assessment-a11y-2026-05-04.md` — NFR a11y consolidé (re-run 2026-05-06 PASS avec réserves).

### Onboarding rapide

- `README.md` (racine) — installation, lancement local.
- `QUICKSTART.md` (racine) — démarrage rapide.
- `NEXT_STEPS.md` (racine) — pré-prod TODO complémentaire à DECISIONS.md.
