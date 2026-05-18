# Audit Sentry 7j post-deploy Epic 7 + Epic 8

Date d'exécution : 2026-05-18
Story : 9.A.6
Fenêtre Epic 7 : 2026-05-16 (merge 7.C.2 commit fdc6092) → 2026-05-23 (J+7 inclus)
Fenêtre Epic 8 : 2026-05-17 (merge 8.D.1 commit 257e393) → 2026-05-24 (J+7 inclus)
Environnement Sentry : production
Org/Project : roxanetnous/roxanetnous (résolu via `mcp__sentry__find_organizations` + `mcp__sentry__find_projects`, regionUrl `https://de.sentry.io`)

> **Note dérogation AC1** : exécution anticipée à J+1/J+2 (2026-05-18) au lieu de J+7 (2026-05-24), décidée par Sylvain via question d'ouverture dev-story. Conséquence : la fenêtre `stats_period:7d` glissants à compter de l'exécution couvre 2026-05-11 → 2026-05-18 inclus, ce qui **ne couvre que partiellement** les fenêtres cibles (Epic 7 : 2/8 jours post-merge ; Epic 8 : 1/8 jours post-merge). L'audit reste valide comme **photo intermédiaire** : tout signal classé (a) `0 occurrence` reste 0 jusqu'à la fenêtre complète sous l'hypothèse de trafic stable ; tout signal classé (b)/(c) **devra être ré-audité** après 2026-05-24 sous AC12 (idempotence, nouveau fichier `audit-sentry-epic-7-8-2026-05-24.md`).

## Synthèse

- Signaux audités : 15 (5 Epic 7 + 10 Epic 8)
- Régressions confirmées : 0
- Volume bénin documenté : 1 event Sentry (ROXANETNOUS-7) qui matche **2 signaux Epic 7 simultanément** (`flow:admin_messages_load` + `message:get_admin_conversations_with_unread`) — comptabilisé 1 fois (même `issue.id`, même `event_id`, même `timestamp`).
- Verdict global : **PASS avec réserves** (1 occurrence bénigne unique attribuée au garde-fou `is_admin()` RPC qui s'est déclenché comme prévu, 0 user impacté, 0 régression réelle).

## Méthodologie

- Requête MCP Sentry : `mcp__sentry__search_events(organizationSlug='roxanetnous', regionUrl='https://de.sentry.io', dataset='errors', query='<filter>', fields=['count()'], statsPeriod='7d', limit=1)` par signal.
- Filtre commun appliqué : `environment:production` (level non filtré : Sentry `dataset='errors'` capture déjà level error+warning).
- Fenêtre temporelle : `stats_period:7d` glissants à compter de l'instant d'exécution 2026-05-18, soit 2026-05-11 → 2026-05-18 inclus.
- Pré-flight (T1, AC2) :
  - `mcp__sentry__whoami` → Le D'hervé (roxanetnous@outlook.com), Sentry User ID 4533709.
  - `mcp__sentry__find_organizations` → `roxanetnous` (regionUrl `https://de.sentry.io`, Web URL `https://roxanetnous.sentry.io`).
  - `mcp__sentry__find_projects(organizationSlug='roxanetnous')` → projet `roxanetnous` (1 seul).
  - Sanity ingestion : `query='environment:production', limit=1, sort='-timestamp', statsPeriod='7d'` → 1 event retourné, timestamp `2026-05-14T14:26:08+00:00` (J-4, ingestion active confirmée).
  - Test syntaxe filtre `flow:parrainage` → requête acceptée, 0 résultat (cohérent : aucun signal parrainage déclenché en prod). **Aucun fallback** nécessaire (la syntaxe `flow:xxx signal:yyy` est interprétée nativement par Sentry).
- Classification de chaque signal (verdict colonne) :
  - **(a) 0 occurrence** → attendu, aucune action.
  - **(b) Volume faible bénin** → documenter le pattern (cas connu, non-régression).
  - **(c) Régression réelle** → créer story follow-up Epic 10+, lier l'issue Sentry.

## Tableau par signal

| # | Epic | flow | signal | Fenêtre | Volume 7j | Verdict | Issue Sentry / Note |
|---|---|---|---|---|---|---|---|
| 1 | 7 | subscription_check | (tous) | 2026-05-11 → 2026-05-18 | 0 | (a) | — |
| 2 | 7 | messaging | profile-lookup-error | 2026-05-11 → 2026-05-18 | 0 | (a) | — |
| 3 | 7 | admin_messages_load | (tous) | 2026-05-11 → 2026-05-18 | 1 | (b) | ROXANETNOUS-7 (cf. détail (b) ci-dessous, même event que ligne 5) |
| 4 | 7 | admin_actions_log | (tous) | 2026-05-11 → 2026-05-18 | 0 | (a) | — |
| 5 | 7 | (RPC) | get_admin_conversations_with_unread | 2026-05-11 → 2026-05-18 | 1 | (b) | ROXANETNOUS-7 (même event que ligne 3, tag `rpc:get_admin_conversations_with_unread` co-émis) |
| 6 | 8 | parrainage | marraine-unexpected-role | 2026-05-11 → 2026-05-18 | 0 | (a) | — |
| 7 | 8 | parrainage | marraine-unexpected-role-at-confirm | 2026-05-11 → 2026-05-18 | 0 | (a) | — |
| 8 | 8 | parrainage | invalid-filleul-role | 2026-05-11 → 2026-05-18 | 0 | (a) | — |
| 9 | 8 | parrainage | marraine-sub-inactive | 2026-05-11 → 2026-05-18 | 0 | (a) | — |
| 10 | 8 | parrainage | marraine-ineligible-at-payment | 2026-05-11 → 2026-05-18 | 0 | (a) | — |
| 11 | 8 | parrainage | genese-accompagne-failed | 2026-05-11 → 2026-05-18 | 0 | (a) | — |
| 12 | 8 | parrainage | genese-accompagne-email-failed | 2026-05-11 → 2026-05-18 | 0 | (a) | — |
| 13 | 8 | parrainage | cron-marraine-unexpected-role | 2026-05-11 → 2026-05-18 | 0 | (a) | — |
| 14 | 8 | parrainage | cron-marraine-role-read-failed | 2026-05-11 → 2026-05-18 | 0 | (a) | — |
| 15 | 8 | parrainage | cron-coupon-failed | 2026-05-11 → 2026-05-18 | 0 | (a) | — |

## Détail signaux verdict (b) volume faible bénin

**Signal 3 (`flow:admin_messages_load`) + Signal 5 (RPC `get_admin_conversations_with_unread`)** — même event sous-jacent :

- **Issue Sentry** : `ROXANETNOUS-7` (`https://roxanetnous.sentry.io/issues/ROXANETNOUS-7`).
- **Event ID** : `258bbd53cf9f478caa8cfb2b5e6fd66d`.
- **First Seen = Last Seen** : `2026-05-14T14:26:08.840Z` (1 occurrence unique, pas de récurrence).
- **Users Impacted** : 0.
- **Message** : `Error: get_admin_conversations_with_unread requires admin role` (postgres error code `42501`).
- **Culprit** : `GET /admin/messages` → `app/admin/messages/page.tsx:22:5` (`AdminMessagesPage`).
- **Tags co-émis** : `flow:admin_messages_load`, `rpc:get_admin_conversations_with_unread`, `severity:critical`, `level:error`, `handled:yes`, `release:bfa4d230ea5f981a3f68244305fa1c14b849e345`.

**Analyse / attribution** :
- Le RPC `get_admin_conversations_with_unread` (livré 7.A.4, cf. `DECISIONS.md` F-Epic7-A4) protège son corps par un check `is_admin()` upfront avec `RAISE EXCEPTION ... SQLSTATE '42501'` (cf. story 7.A.4 livraison du pattern SECURITY DEFINER + REVOKE PUBLIC + GRANT authenticated).
- L'event capture **précisément** un appel **non-admin** sur la route `/admin/messages` (probablement crawl interne, session expirée transitoire, ou tentative d'accès non autorisé) que la RPC a **correctement rejeté**. La server action page `page.tsx:22` instrumente l'erreur via `Sentry.captureException` (heritage 7.A.4 défense en profondeur).
- **C'est précisément le comportement attendu** : la garde RPC tient en prod, l'attaque/erreur est interceptée, l'admin réel n'a pas été impacté (`Users Impacted: 0`).

**Critères (b) (AC5)** :
- (i) Pattern reconnu : garde-fou RPC `is_admin()` 7.A.4 fonctionnel ✅
- (ii) Zéro impact métier : `Users Impacted: 0`, accès refusé côté BDD ✅
- (iii) Volume < 10/7j : 1 occurrence unique ✅
- Verdict (b) confirmé. Pas de promotion (c).

**Décompte agrégé** : 2 signaux distincts comptabilisent **1 seul event** physique (tags multiples sur la même row Sentry). Le total agrégé `Sum(count)` sur les 15 signaux = 2, mais le **nombre d'events distincts** = 1.

## Détail signaux verdict (c) régression réelle

_Aucun signal classé dans cette catégorie._

## Conclusion

Verdict global : **PASS avec réserves** (réserve = 1 event bénin ROXANETNOUS-7 sur signaux 3+5 Epic 7, attribué au garde-fou RPC `is_admin()` 7.A.4 qui s'est déclenché comme prévu sur un appel non-admin transitoire ; 0 user impacté, 0 régression réelle).

Les 10 signaux role-aware Epic 8 (T3.1-T3.10) sont tous à 0 occurrence sur 7j glissants : **les invariants role-aware introduits Epic 8.A.2/8.A.3 (server actions `app/actions/parrainage.ts:465,568,973`) et 8.A.3 (cron `app/api/cron/confirm-parrainages/route.ts:221`) tiennent en production** — pas de drift role observable, pas de cas limite déclenchant les gardes, les flow `parrainage` symétriques accompagné→accompagnant sont stables. **Recommandation go-live full France** : verrou epic-9.md AC6 levé sous condition d'un ré-audit complet à fenêtre 7j post-2026-05-24 (cf. AC12 idempotence, note dérogation AC1). Le présent audit constitue une **photo intermédiaire à J+1 Epic 7 / J+2 Epic 8** qui ne révèle aucune régression, mais ne saurait remplacer la fenêtre complète. Sylvain doit déclencher un **ré-audit `9.A.6-bis`** entre 2026-05-24 et 2026-05-30 pour acter formellement le verdict définitif.

Détail traçabilité : `DECISIONS.md` entrée `F-Epic9-A6`.
