# Stratégie auth — suite a11y axe-core (Lot B)

## Décision (Story 2.6.1)

Pour les parcours **P1 (onboarding accompagnante)**, **P3 (messagerie)** et **P6 (suppression RGPD)**
qui nécessitent un compte authentifié, la suite Playwright Lot B **n'instancie pas
de compte de test**. Les specs auditent à la place la **page d'entrée publique
équivalente** (typiquement `/login` ou la landing) comme proxy d'audit indirect.

## Justification

1. **Pas d'environnement Supabase local** dans le repo : créer un compte test
   impliquerait soit d'écrire dans la prod Supabase, soit de provisionner un projet
   Supabase de test (hors scope Lot B, calendrier serré).
2. **Pas de bypass d'auth runtime** : on refuse d'introduire une porte dérobée
   (`?test_user=…`) dans le code applicatif pour les besoins des tests, par principe
   de sécurité.
3. **Couverture Lot A préservée** : le scan statique `eslint-plugin-jsx-a11y` continue
   d'auditer les composants des pages auth-required (Input, formulaires, dialogs).
   La couche dynamique axe-core n'est qu'**un complément** sur les parcours publics.

## Couverture par parcours

| Parcours | Cible audit Lot B                                      | Note                                                   |
| -------- | ------------------------------------------------------ | ------------------------------------------------------ |
| P1       | `/login` (proxy)                                       | Onboarding réel reporté Lot C                          |
| P2       | `/recherche` (public)                                  | Audit complet hors `<div class="leaflet-container">`   |
| P3       | `/login` (proxy)                                       | Messagerie temps réel reporté Lot C                    |
| P4       | `/register?role=accompagnante` puis `/login` (publics) | Audit complet (champs Input refonte 2.5.5)             |
| P5       | `/` (public)                                           | Audit complet hors carte SVG hero (story 2.6.5 dédiée) |
| P6       | `/login` (proxy)                                       | Suppression compte reporté Lot C                       |

## Re-évaluation Lot C

La story tests manuels VoiceOver / NVDA du Lot C devra :

- Provisionner un compte test isolé (Supabase project « roxanetnous-test ») OU
- Implémenter un bypass d'auth chiffré, scopé au mode `NODE_ENV=test`.

Cette décision sera prise en début de Lot C en fonction du calendrier et du
risque (la création d'un projet Supabase test a un coût mensuel non nul).

## Référence

- Story 2.6.1 AC #5, AC #8 — outillage axe-core/Playwright et baseline parcours critiques.
- Mini-épic 2.5 retro — AI-1 axe-core en CI.
- PRD `Accessibilite-NFR-transverse` — couverture auth-required reportée Lot C.
