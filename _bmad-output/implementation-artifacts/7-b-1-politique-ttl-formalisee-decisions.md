# Story 7.B.1 : Politique TTL formalisee DECISIONS.md

Status: done

<!-- Note: Validation is optional. Run validate-create-story for quality check before dev-story. -->

## Story

As a responsable conformite roxanetnous (Sylvain en tant que DPO de fait pre-trafic),
I want **formaliser noir-sur-blanc la politique de retention des donnees personnelles** dans `DECISIONS.md` (entree `F-Epic7-B1`) + aligner la page publique `politique-de-confidentialite/page.tsx` avec les durees retenues + documenter le mode de purge par table (anonymisation in-place vs DELETE hard) + la procedure droit a l'oubli visiteur anonyme (qui n'est PAS couverte par les cascades FK existantes),
so that les crons de purge `7.B.2` (notifications_log >18 mois) et `7.B.3` (anonymisation IP parrainages/notifications_ouverture) puissent etre implementes sur une **base de decision contractualisee** plutot qu'au feeling du dev, **avant prise de trafic significative** (822 users beta, 24 notifications_log dont 23 < 6 mois, 0 waitlist, 3 parrainages anciens) et **avant que la page publique n'engage juridiquement la plateforme sur des durees fausses** (regression discrete actuelle : la page publique annonce "Logs de notification : 12 mois" alors qu'aucun cron de purge n'existe et que l'epic propose 18 mois). C'est aussi le pre-requis aux stories 7.B.2 et 7.B.3 (estimation epic-7 : `Pre-requis Stories 7.B.2 et 7.B.3`, ligne 370 de `epic-7.md`).

## Acceptance Criteria

1. **AC1 - Entree dediee dans `DECISIONS.md` ajoutee a la fin du fichier** avec exactement le header `## 2026-05-14 : Politique de retention donnees personnelles (decision F-Epic7-B1)` (date du jour selon contexte session, ajuster si la livraison se decale d'un jour). Suivre la structure de `DECISIONS.md:228-244` (decision F5 idempotence) : sections **Decision** / **Motivation** / **Implications techniques** / **Regle**. Les durees retenues sont celles de l'epic (ligne 360-364) **sauf justification ecrite** dans la section Motivation si un ecart est decide en cours de redaction.

2. **AC2 - Tableau des TTL par table** dans la section **Decision** de la nouvelle entree DECISIONS, format Markdown table :

   | Table | Colonnes PII | TTL retenu | Methode purge | Justification |
   |---|---|---|---|---|
   | `notifications_log` | `email` (NOT NULL), `subject`, `data` jsonb (peut contenir nom dpt sensible cote contact form) | **18 mois** | DELETE hard | trace operationnelle email transactionnel, post-delai prescription opposabilite contractuelle (art. 2224 Code civil = 5 ans pour obligations contractuelles MAIS notifications_log ne sert pas de preuve contractuelle, c'est un audit operationnel court terme -- 18 mois couvre largement le cycle qualite/incident) |
   | `parrainages.ip_inscription` | `ip_inscription` (TEXT nullable) | **2 ans** | Anonymisation in-place (`UPDATE ... SET ip_inscription = NULL`) | recommandation CNIL anti-fraude paiement / inscription, preserve la row pour historique parrainage (`marraine_id` reste apres anonymisation, audit anti-fraude croisee `stripe_fingerprint` toujours possible) |
   | `notifications_ouverture.ip_inscription` (ancienne `waitlist_departements`) | `ip_inscription` (TEXT nullable) | **6 mois** | Anonymisation in-place | anti-spam waitlist + delai bien plus court car risque IP-fraude faible (visiteur anonyme s'inscrivant sur waitlist, pas de paiement) ; l'`email` et `code_departement` sont preserves pour le cron de notification a l'ouverture (sans ces colonnes le service ne fonctionne plus) |
   | `admin_actions_log` | `target_id` UUID + `target_id_text`, `details` jsonb | **Conservation indefinie** | Aucune purge | art. 5.1.f RGPD (integrite/confidentialite) + obligation d'audit trail pour actions admin (parrainage validations, blacklist, toggles dpt). N'est pas une PII utilisateur (logs d'actions admins, pas d'attributs personnels primaires). Reevaluation si volume > 100k rows ou tag legal nouveau |

   **Note BDD critique** (audit MCP 2026-05-14, **a citer dans la section Motivation**) : la table `waitlist_departements` mentionnee dans `epic-7.md:88, 363, 405` a ete **renommee `notifications_ouverture`** par la migration `20260511180234_rename_waitlist_departements_to_notifications_ouverture.sql` (Epic 6 mini-epic 6.C). Toute la story 7.B.1 + livrables 7.B.2/7.B.3 doivent utiliser le **nouveau nom**. Volumetrie prod actuelle (audit MCP `2026-05-14`) : `notifications_log` 24 rows (oldest 2026-02-25 = 2,5 mois, **aucune row n'est encore eligible a la purge 18 mois**), `parrainages` 3 rows (oldest 2026-04-28 = 0,5 mois, **3/3 ont ip_inscription NOT NULL, aucune > 2 ans**), `notifications_ouverture` 0 rows, `admin_actions_log` 121 rows.

3. **AC3 - Section "Methode de purge documentee" dans DECISIONS** justifie par table pourquoi DELETE hard vs anonymisation :
   - `notifications_log` : DELETE hard car aucune valeur d'audit a 18 mois (la row entiere est PII operationnelle, anonymiser equivaut a tout vider sauf timestamps -> autant supprimer). Choix conforme au principe de minimisation (art. 5.1.c RGPD).
   - `parrainages.ip_inscription` : anonymisation in-place (UPDATE SET NULL) car la row entiere a une valeur metier durable (historique parrainage, lien marraine/filleule via FK SET NULL si compte supprime, audit anti-fraude `stripe_fingerprint`). Seule la colonne PII IP est purgee. Statut nullable confirme via audit MCP.
   - `notifications_ouverture.ip_inscription` : anonymisation in-place pour la meme raison (la row entiere sert au cron de notification a l'ouverture du dpt -- DELETE casserait le service). `ip_inscription TEXT NULLABLE` confirme via audit MCP.
   - `admin_actions_log` : aucune purge planifiee actuellement, **mais** documenter la revue obligatoire si volume > 100k rows (le seuil ouvre alors une story Epic 9+).

4. **AC4 - Section "Procedure droit a l'oubli" dans DECISIONS**, deux cas distincts :
   - **Utilisateur authentifie (`users.id` existant)** : la cascade FK existante traite automatiquement la PII liee. Audit MCP confirme les cascades :
     - `notifications_log.user_id` -> `users(id)` **ON DELETE CASCADE** : suppression user efface ses rows notifications_log.
     - `admin_actions_log.admin_id` -> `users(id)` **ON DELETE CASCADE** (rare, applicable uniquement aux admins supprimes).
     - `parrainages.marraine_id` / `parrainages.filleule_id` -> `users(id)` **ON DELETE SET NULL** (decision deliberee, preserve historique anonymise sans la PII utilisateur).
     - `notifications_ouverture.code_departement` -> `departements_ouverts(code)` **ON DELETE CASCADE** (pas une cascade user, mais a documenter).
   - **Visiteur anonyme** (`notifications_log` avec `user_id IS NULL`, `notifications_ouverture` row avec email + ip mais sans `user_id` car la table n'a pas cette colonne) : **aucune cascade possible**, l'utilisateur ne possede pas de compte. La procedure documentee est : (a) reception d'une demande email a `roxanetnous@outlook.com` (canal cite politique-de-confidentialite/page.tsx:82), (b) traitement manuel par Sylvain via Supabase Studio (`DELETE FROM notifications_log WHERE lower(email) = lower($1)` + `DELETE FROM notifications_ouverture WHERE lower(email) = lower($1)`), (c) trace dans `admin_actions_log` (action_type `rgpd_oubli_visiteur_anonyme`, `target_id_text = email_anonymise` -- compatible mutex XOR cf. story 7.A.7). **Pas de endpoint `delete-pii` admin a creer dans cette story** (epic-7.md:367 le mentionnait, mais l'audit MCP montre 0 row notifications_ouverture et 0 row notifications_log avec user_id NULL -> creer un endpoint serait premature, le traitement manuel suffit jusqu'a Epic 9+). Documenter dans la section **Implications techniques** que la creation d'un endpoint deviendra necessaire si > 5 demandes / an (seuil arbitraire mais signal d'industrialisation).

5. **AC5 - Mise a jour `app/politique-de-confidentialite/page.tsx`** (section "Duree de conservation", lignes 63-72) : remplacer le bullet **"Logs de notification : 12 mois"** par les bullets alignes avec AC2 :
   - `<li>Logs de notification email (`notifications_log`) : 18 mois maximum, puis suppression definitive</li>`
   - `<li>Adresses IP d'inscription (parrainages) : anonymisees apres 2 ans</li>`
   - `<li>Adresses IP des demandes d'alerte d'ouverture departementale : anonymisees apres 6 mois</li>`
   - `<li>Journal d'actions administratives : conservation indefinie a fin d'audit conformite</li>`
   
   Conserver les bullets pre-existants ("Donnees de compte", "Documents justificatifs", "Donnees de paiement", "Apres suppression du compte"). **Veille editoriale** : la copy doit etre cohibitive avec la regle CLAUDE.md "accompagnant masculin neutre" (rien a modifier cote genre dans cette section, neutre par defaut). Pas d'emoji.

6. **AC6 - Pas de migration BDD dans cette story** : la story 7.B.1 est documentaire et editoriale, pas DDL. Les crons et migrations ON DELETE/UPDATE sont stories 7.B.2 et 7.B.3. **Verifier explicitement dans `Completion Notes` que `supabase/migrations/` n'a recu aucun nouveau fichier**.

7. **AC7 - Audit MCP de cloture story** (a executer **pre-commit** par le dev agent) :
   ```sql
   SELECT 'notifications_log' AS tbl, COUNT(*) AS rows, MIN(sent_at) AS oldest,
          COUNT(*) FILTER (WHERE sent_at < now() - interval '18 months') AS rows_purgeables_18m,
          COUNT(*) FILTER (WHERE user_id IS NULL) AS anonymes
   FROM notifications_log
   UNION ALL
   SELECT 'parrainages', COUNT(*), MIN(created_at),
          COUNT(*) FILTER (WHERE created_at < now() - interval '2 years' AND ip_inscription IS NOT NULL),
          COUNT(*) FILTER (WHERE ip_inscription IS NOT NULL)
   FROM parrainages
   UNION ALL
   SELECT 'notifications_ouverture', COUNT(*), MIN(created_at),
          COUNT(*) FILTER (WHERE created_at < now() - interval '6 months' AND ip_inscription IS NOT NULL),
          COUNT(*) FILTER (WHERE ip_inscription IS NOT NULL)
   FROM notifications_ouverture
   UNION ALL
   SELECT 'admin_actions_log', COUNT(*), MIN(created_at), 0, 0 FROM admin_actions_log;
   ```
   Coller le resultat dans `Dev Agent Record > Debug Log References`. **Si `rows_purgeables_*` > 0** pour notifications_log ou parrainages ou notifications_ouverture (donc une row deja eligible des aujourd'hui), **rajouter une mention explicite dans DECISIONS section Motivation** pour signaler que la story 7.B.2/7.B.3 devra traiter ces rows historiques en premier run, sinon la confidentialite RGPD reste theorique. Au 2026-05-14, l'audit est cense renvoyer 0 partout (oldest notifications_log = 2026-02-25 < 3 mois, oldest parrainages = 2026-04-28 < 1 mois).

8. **AC8 - Validation pre-commit livraison + DoD** :
   - `npm run lint` exit 0 (la page tsx modifiee doit rester lint-clean).
   - `npm run lint:a11y-check` exit 0 (modification UI minime sur page publique, baseline preservee).
   - `npm run a11y:axe:check` exit 0 (regle CLAUDE.md durcie 2026-05-06 : obligatoire pour tout commit livraison story). Page `/politique-de-confidentialite` est dans les 7 parcours critiques baseline -- verifier 0 violation Critical/Serious apres modif. **Si la commande baisse de baseline a 0 violations Critical/Serious, OK. Si elle leve une nouvelle violation due au markup ajoute (ex : `<li>` orphelin hors `<ul>`), corriger dans la PR -- ne pas updater le baseline**.
   - `npm run test:unit` exit 0 (aucun test unit n'est cense exister sur cette page, mais le suite globale doit rester verte).
   - `npm run check:no-direct-notifications-log-insert` exit 0 (garde-fou 7.A.11, story documentaire ne touche pas notifications_log mais le check tourne dans buildCommand).
   - `npm run build` exit 0 (la page rebuilde sans warning).
   - **Pas de regression visuelle attendue** : la modification est strictement textuelle dans `<ul>` existante. Pas d'utilisation du flag visual regression.

9. **AC9 - Solde dette + mise a jour artefacts BMad** :
   - `_bmad-output/implementation-artifacts/deferred-work.md` : barrer (markdown `~~...~~`) les **deux** lignes suivantes avec prefixe `[Solde 7.B.1 - 2026-05-14]` :
     - Ligne 200 (`Stockage IP brut sans TTL ni purge -- RGPD`).
     - Ligne 247 (`notifications_log retention indefinie / RGPD pour visiteurs anonymes`).
   - `_bmad-output/implementation-artifacts/sprint-status.yaml` : passer `7-b-1-politique-ttl-formalisee-decisions` de `backlog` a `ready-for-dev` (fait par ce workflow create-story), puis `review` post-implementation (par le dev agent), puis `done` post-merge selon `project_bmad_conventions`. **Pas de transition sur 7.B.2 / 7.B.3** : elles restent `backlog`, le dev agent decidera apres review 7.B.1 s'il enchaine ou s'il bascule sur autre chose.
   - Memoire utilisateur : la story livre une decision F-Epic7-B1 mais **ne** met **pas** a jour `MEMORY.md` -- la memoire `project_epic_7_cadrage` couvre deja l'epic, et F-Epic7-B1 est inscrite dans DECISIONS.md (source canonique). Ne pas creer de memoire dediee a F-Epic7-B1 (cf. instructions globales "Anything already documented in CLAUDE.md files / DECISIONS.md").
   - **Pas de mise a jour `NEXT_STEPS.md`** : la story est documentaire pure, pas de variable env ni operationnelle qui change.

10. **AC10 - Hors-scope explicitement liste dans `Dev Agent Record > Completion Notes`** (a ne pas faire dans cette story) :
    - Aucune migration BDD (DDL ON DELETE / triggers / CHECK).
    - Aucun cron `app/api/cron/purge-*` (stories 7.B.2 / 7.B.3).
    - Aucun endpoint `app/api/admin/delete-pii` (decision AC4 : pas avant 5 demandes/an).
    - Aucun changement de FK `ON DELETE` (les cascades actuelles sont conformes a la decision, AC4).
    - Aucune modification de `_bmad-output/planning-artifacts/audit-cookies-2026-05-07.md` (audit fige).
    - Aucune migration du nom `waitlist_departements` dans epic-7.md (epic est fige post-cadrage, la note BDD AC2 suffit pour signaler la divergence au dev agent + reviewer).

## Review Findings

- [x] [Review][Decision] **F3 — `email_anonymise` dans `admin_actions_log` (TTL indéfini) → résolu : email tronqué** — Décision B : `target_id_text` reçoit l'email tronqué (ex: `f***@domain.com`) + `target_type = 'rgpd_request'` ajouté. Minimisation PII préservée, trace exploitable. [DECISIONS.md - section Implications techniques]

- [x] [Review][Decision] **F4 — Procédure droit-à-l'oubli `notifications_ouverture` : DELETE → UPDATE anonymisation** — Décision B : remplacé par `UPDATE notifications_ouverture SET ip_inscription = NULL WHERE lower(email) = lower($1)`. Cohérent avec la politique in-place, préserve email/code_departement pour le cron de notification. [DECISIONS.md - section Implications techniques]

- [x] [Review][Decision] **F5 — Modification 12→18 mois prospective** — Décision A : annoté dans DECISIONS section Motivation. Aucune row > 12 mois au 2026-05-14, impact nul. [DECISIONS.md - section Motivation]

- [x] [Review][Decision] **F6 — `<code>notifications_log</code>` retiré de la page publique** — Décision A : texte brut "Logs de notification email". [app/politique-de-confidentialite/page.tsx:69]

- [x] [Review][Patch] **F1 — Pattern cron 7.B.2 corrigé pour inclure les rows `sent_at IS NULL`** — Pattern mis à jour dans DECISIONS.md. [DECISIONS.md - section Implications techniques]

- [x] [Review][Patch] **F2 — `target_type = 'rgpd_request'` ajouté à la procédure trace** — Colonne NOT NULL désormais documentée dans la procédure manuelle. [DECISIONS.md - section Implications techniques]

- [x] [Review][Patch] **F7 — Section "Méthode de purge par table" ajoutée dans DECISIONS.md** — Section dédiée ajoutée entre Decision et Motivation avec 4 bullets par table. [DECISIONS.md - decision F-Epic7-B1]

- [x] [Review][Patch] **F9 — Annotation interne reformulée en prose finale** — `(pas une cascade user, mais a documenter)` remplacé par la prose finale. [DECISIONS.md - section Implications techniques]

- [x] [Review][Defer] **F11 — Cascade `departements_ouverts → notifications_ouverture` peut détruire les IPs avant le TTL 6 mois** [supabase/migrations/20260506120000_waitlist_departements.sql:9] — pré-existant, hors scope 7.B.1 ; à documenter dans deferred-work si le volume waitlist devient significatif

## Tasks / Subtasks

- [x] **T1 - Recolter et confirmer la volumetrie BDD** (AC: #2, #7)
  - [x] T1.1 - Executer la requete d'audit AC7 via MCP Supabase (`mcp__supabase__execute_sql`). Capturer la sortie JSON brute dans `Dev Agent Record > Debug Log References`.
  - [x] T1.2 - Verifier que les 4 tables existent (notifications_log, parrainages, notifications_ouverture, admin_actions_log). **Verification critique** : le nom de table `waitlist_departements` mentionne dans epic-7.md est obsolete (renomme par 6.C en `notifications_ouverture`). Confirmer via `SELECT table_name FROM information_schema.tables WHERE table_schema='public' AND table_name='waitlist_departements'` -> doit retourner 0 lignes.
  - [x] T1.3 - Si `rows_purgeables_*` retourne > 0 sur n'importe quelle table, lever immediatement le drapeau dans la section Motivation de DECISIONS (AC7). **0 row purgeable a date, drapeau non leve.**

- [x] **T2 - Rediger l'entree F-Epic7-B1 dans `DECISIONS.md`** (AC: #1, #2, #3, #4)
  - [x] T2.1 - Localiser la fin du fichier `DECISIONS.md` (derniere entree datee). Ouvrir le fichier en lecture pour identifier exactement la derniere section (`grep -n "^## 2026-" DECISIONS.md | tail -1`).
  - [x] T2.2 - Append a la fin une nouvelle section `## 2026-05-14 : Politique de retention donnees personnelles (decision F-Epic7-B1)` separee par `---` du contenu precedent. Structure obligatoire : **Decision** (avec le tableau AC2 + note BDD critique), **Motivation** (justification CNIL + reference audit MCP volumetrie + reference page publique 12 mois divergence resolue), **Implications techniques** (cascades FK confirmees + procedure droit a l'oubli visiteur anonyme + seuil 5 demandes/an pour endpoint admin), **Regle** (resume actionnable en 3-4 lignes pour future story / refactor).
  - [x] T2.3 - Citer explicitement les sources : `notifications_log.user_id ON DELETE CASCADE` (audit MCP), `parrainages.marraine_id ON DELETE SET NULL` (audit MCP + commentaire colonne BDD), `epic-7.md:349-370`, `deferred-work.md:200,247`, `politique-de-confidentialite/page.tsx:64-72`.
  - [x] T2.4 - Ne PAS modifier les sections DECISIONS pre-existantes (heritage F1 a F-Epic7-A11). Append-only.

- [x] **T3 - Aligner la page publique `politique-de-confidentialite/page.tsx`** (AC: #5, #8)
  - [x] T3.1 - Lire `app/politique-de-confidentialite/page.tsx:63-72` (section `<h2>Duree de conservation</h2>`).
  - [x] T3.2 - Remplacer le bullet `<li>Logs de notification : 12 mois</li>` par les 4 bullets AC5. Preserver l'ordre des autres bullets pre-existants (`Donnees de compte` / `Documents justificatifs` / `Donnees de paiement` / `Apres suppression du compte`).
  - [x] T3.3 - Verifier `<ul>` reste bien formee (pas de `<li>` orphelin). Indentation TSX coherente avec la convention du fichier (4 espaces, pas tab).
  - [x] T3.4 - Pas d'emoji dans le texte. Genre neutre (rien a changer cote "accompagnant" car la section ne mentionne pas le role).

- [x] **T4 - Solder la dette `deferred-work.md`** (AC: #9)
  - [x] T4.1 - Editer `_bmad-output/implementation-artifacts/deferred-work.md`.
  - [x] T4.2 - Sur la ligne 200 (`Stockage IP brut sans TTL ni purge -- RGPD`) : envelopper le bullet entier par `~~...~~` et suffixer ` [Solde 7.B.1 - 2026-05-14]` (apres le `~~` fermant, pour suivre le pattern utilise par 7.A.11 ligne 248).
  - [x] T4.3 - Sur la ligne 247 (`notifications_log retention indefinie / RGPD pour visiteurs anonymes`) : meme traitement.
  - [x] T4.4 - Verifier qu'aucune autre ligne du fichier n'a ete deplacee accidentellement (diff doit etre exactement 2 lignes modifiees).

- [x] **T5 - Validation pre-commit livraison** (AC: #8)
  - [x] T5.1 - `npm run lint` -> exit 0. **193 warnings, sous baseline 195/196 (beneficiaire 2-3 warnings cumules sur 7.A.10/7.A.11).**
  - [x] T5.2 - `npm run lint:a11y-check` -> exit 0. **155 baseline preserve, "No regression".**
  - [x] T5.3 - `npm run a11y:axe:check` -> exit 0 (baseline 0 violations Critical/Serious sur 7 parcours, page politique-de-confidentialite incluse). **"aucun delta Critical/Serious au-dela du baseline" confirme.**
  - [x] T5.4 - `npm run test:unit` -> exit 0. **59/59 verts en 1.07s, 5 fichiers, regression 7.A.11 preservee.**
  - [x] T5.5 - `npm run check:no-direct-notifications-log-insert` -> exit 0. **"aucun INSERT direct sur notifications_log hors du helper autorise" confirme.**
  - [x] T5.6 - `npm run build` -> exit 0. **Page /politique-de-confidentialite rebuild static prerendered (○), pas de warning.**
  - [x] T5.7 - Capturer la sortie des 6 commandes dans `Dev Agent Record > Debug Log References`.

- [x] **T6 - Update sprint-status.yaml + completion notes** (AC: #9, #10)
  - [x] T6.1 - Editer `_bmad-output/implementation-artifacts/sprint-status.yaml` : passer `7-b-1-politique-ttl-formalisee-decisions` de `ready-for-dev` (state set par create-story) a `review`. Mettre a jour `last_updated` au jour de livraison.
  - [x] T6.2 - Renseigner `Dev Agent Record > Completion Notes` avec la liste explicite hors-scope (AC10) + le pointeur sur F-Epic7-B1 (`Voir DECISIONS.md ## 2026-05-14`) + le rappel "stories 7.B.2 et 7.B.3 deverrouillees".
  - [x] T6.3 - Renseigner `Dev Agent Record > File List` avec les fichiers touches : `DECISIONS.md`, `app/politique-de-confidentialite/page.tsx`, `_bmad-output/implementation-artifacts/deferred-work.md`, `_bmad-output/implementation-artifacts/sprint-status.yaml`. **Aucun fichier sous `supabase/migrations/`** (sinon AC6 viole).

- [x] **T7 - Commit livraison** (AC: #8, #9)
  - [x] T7.1 - Stage explicite des fichiers de la File List uniquement (pas de `git add .`). 5 fichiers staged.
  - [x] T7.2 - Commit message format heritage Epic 7 : `docs(rgpd): formalise politique TTL retention donnees personnelles (story 7.B.1)`. Pre-requis CLAUDE.md respecte (`npm run a11y:axe:check` exit 0 confirme en T5.3). Commit `3c94ae3` sur `main` (ahead 1).
  - [ ] T7.3 - Pas de `git push` ni `gh pr create` sans validation explicite Sylvain. **En attente decision Sylvain post-review.**

## Dev Notes

### Contexte projet (a relire avant de coder)

- **Memoire `project_epic_7_cadrage`** : Epic 7 cadre 2026-05-13, mini-epic 7.B = 3 stories RGPD (1,5j-dev), aucun bloquant go-live Bretagne (deja confirme Epic 5/6). Story 7.B.1 est **pre-requis** 7.B.2 et 7.B.3.
- **Memoire `project_a11y_lot_c`** : regle CLAUDE.md durcie 2026-05-06 = `npm run a11y:axe:check` obligatoire pre-commit livraison story (`Story X.Y.Z : ...`). Cette story DOIT respecter cette regle meme si l'impact UI est minime (modification 1 `<ul>` dans page publique).
- **Memoire `feedback_genre_accompagnant`** : copy nouvelle au masculin neutre. La page politique-de-confidentialite n'utilise pas le role dans la section modifiee, neutre par defaut.
- **Memoire `feedback_test_local_supabase`** : Sylvain ne lance pas `supabase start` localement. Validation BDD via MCP Supabase (deja fait dans le workflow create-story, et a refaire dans T1.1). Pas de `npm run test:integration` requis pour cette story (purement documentaire, pas de seed BDD).
- **Memoire `project_bmad_conventions`** : statut `done` apres merge, format commit `docs(rgpd):` ou `feat(...)`, **PAS** `Story 7.B.1 :` en sujet (heritage Epic 4 a corriger -- preferer format Conventional Commits canonique cf. derniers commits Epic 7).
- **Heritage F5 (DECISIONS.md:228)** : pattern idempotence BDD = la story 7.B.2 (cron purge `notifications_log`) DEVRA utiliser `DELETE ... WHERE sent_at < now() - interval '18 months'` (idempotent par construction : si rien a purger = no-op, pas d'erreur). Documenter cet acquis dans la section **Implications techniques** de F-Epic7-B1 pour signaler au dev 7.B.2 que le pattern est deja figure.
- **Heritage F6 (DECISIONS.md:248)** : schema `notifications_log.user_id NULLABLE` + FK CASCADE = la procedure droit a l'oubli utilisateur authentifie est automatiquement traitee. Aucune action a livrer pour ce cas, juste a documenter dans AC4.

### Source tree components touches

- **Code** : `app/politique-de-confidentialite/page.tsx` (1 section modifiee, lignes 63-72).
- **Documentation** : `DECISIONS.md` (append 1 section a la fin, ~80 lignes de prose).
- **Artefacts BMad** : `_bmad-output/implementation-artifacts/deferred-work.md` (2 lignes barrees) + `_bmad-output/implementation-artifacts/sprint-status.yaml` (1 transition statut).
- **NON touches** : `supabase/migrations/**` (DDL = stories 7.B.2/7.B.3), `app/api/cron/**` (idem), `lib/notifications-log.ts` (story 7.A.11 livree, ne pas regresser), `lib/emails.ts`, `types/supabase.ts`, `package.json`, `vercel.json`.

### Testing standards summary

- **Aucun nouveau test unit** : la story est documentaire (DECISIONS + politique-confidentialite). Pas de logique a tester.
- **Aucun nouveau test integration** : pas de migration BDD ni de Server Action.
- **Tests existants preserves** : `npm run test:unit` (suite globale verte = 59/59 actuels apres 7.A.11) doit rester verte.
- **A11y** : `npm run a11y:axe:check` doit rester vert (page `/politique-de-confidentialite` est dans les 7 parcours baseline). Audit Lot C 2026-05-05.

### Project Structure Notes

- **Convention Markdown DECISIONS.md** : format `## YYYY-MM-DD : <titre humain> (decision F<numero/code>)`, separateur `---` avant chaque section. Le code F est sequentiel par epic apres restructuration 2026-05-13 (`F-Epic5-*`, `F-Epic6-*`, `F-Epic7-*`). Cette story livre `F-Epic7-B1` (premiere du mini-epic 7.B).
- **Convention citations sources** : `[Source: <path>:<line>]` ou `[Source: <path>#<section>]` dans le corps de la prose technique (DECISIONS.md et story files). A respecter dans la nouvelle entree DECISIONS pour les references aux migrations / lignes de page TSX.
- **Convention nommage table BDD** : `notifications_ouverture` est le nom canonique post-6.C (renommage 2026-05-11). L'epic-7 contient encore `waitlist_departements` (genre de typo cadrage, prevenir le dev agent en T2.2 + AC2 note critique).

### References

- [Source: _bmad-output/planning-artifacts/epic-7.md#349-370] -- Mini-epic 7.B Story 7.B.1 cadrage initial (AC + sources reviews 3.4 / 4.2).
- [Source: _bmad-output/implementation-artifacts/deferred-work.md:200] -- Item RGPD IP brut (a solder).
- [Source: _bmad-output/implementation-artifacts/deferred-work.md:247] -- Item RGPD `notifications_log` visiteur anonyme (a solder).
- [Source: DECISIONS.md:228-244] -- F5 idempotence BDD (heritage a citer dans Motivation F-Epic7-B1 pour le pattern DELETE ... WHERE de 7.B.2).
- [Source: DECISIONS.md:248-268] -- F6 schema `notifications_log` etendu (heritage : user_id NULLABLE + FK CASCADE -> AC4).
- [Source: app/politique-de-confidentialite/page.tsx:63-72] -- Section "Duree de conservation" actuelle, divergence "12 mois" a corriger.
- [Source: supabase/migrations/20260511180234_rename_waitlist_departements_to_notifications_ouverture.sql] -- Renommage table audit MCP, contexte AC2 note BDD critique.
- [Source: supabase/migrations/20260506120000_waitlist_departements.sql] -- Migration originale table `waitlist_departements` (CASCADE volontaire `code_departement`).
- [Source: _bmad-output/planning-artifacts/audit-cookies-2026-05-07.md] -- Audit RGPD anterieur (a citer dans AC6 / Motivation : alignement avec audit cookies).
- [Source: CLAUDE.md] -- regles strictes accessibilite + genre accompagnant + pas d'emojis (a respecter).
- Audit MCP execute 2026-05-14 par le workflow create-story (volumetrie / FK / colonnes / nullable) : capture dans Debug Log References + reference dans Motivation de F-Epic7-B1.

### Previous story intelligence (7.A.11 done 2026-05-14)

- **Pattern commit Epic 7** : 7.A.11 a livre `fix(rgpd):` / `feat(ci):` (Conventional Commits). Suivre pour 7.B.1 (`docs(rgpd):`).
- **Pattern File List** : 7.A.11 a livre File List explicite + Debug Log References capturees -> formaliser pareil en T6.2/T6.3.
- **Garde-fou 7.A.11** : `npm run check:no-direct-notifications-log-insert` tourne dans `vercel.json` buildCommand. La story 7.B.1 ne touche pas notifications_log cote code, donc le check reste vert -- mais le verifier explicitement en T5.5.
- **Idempotence helper `logNotification` (story 7.A.6)** : pertinent pour la prose F-Epic7-B1 -- la purge 18 mois sera idempotente "naturellement" (`DELETE ... WHERE sent_at < cutoff` = no-op si rien a purger). A signaler dans la section Implications techniques de F-Epic7-B1.

### Git intelligence summary

- 5 commits Epic 7 recents (7.A.7 -> 7.A.11) montrent une cadence rapide (1-2 stories / jour). Style commit : Conventional Commits FR. Eviter le format heritage `Story X.Y.Z :` qui pollue git log.
- Aucun commit Epic 7.B encore : la story 7.B.1 ouvre le mini-epic. Le sprint-status confirme `epic-7: in-progress` (heritage 7.A.* done).
- Pas de fichier de migration BDD touche par les 5 derniers commits sauf garde-fou CI -- coherent avec un mini-epic 7.A purement applicatif. La story 7.B.1 documentaire ne casse pas cette streak.

### Latest tech information

- **Postgres `interval` arithmetic** (pre-requis aux crons 7.B.2/7.B.3 mais a annoncer dans 7.B.1) : `now() - interval '18 months'` est portable et stable Postgres >= 9. Comportement bissextile geree par Postgres (un `interval '18 months'` = 18 mois calendaires, pas 18*30 jours).
- **Cron Vercel** (pre-info 7.B.2) : `crons` array dans `vercel.json` + endpoint `app/api/cron/<name>/route.ts` + `Authorization: Bearer ${CRON_SECRET}` (pattern heritage cron retry waitlist Epic 5). A reprendre en 7.B.2.
- **CNIL recommandations 2026** : IP de connexion ou inscription = duree max 1 an (recommandation generale), mais le RGPD ne fixe pas de duree precise. Le choix 2 ans pour `parrainages.ip_inscription` (anti-fraude paiement) est defendable (delai d'instruction d'une plainte fraude). Le choix 6 mois pour `notifications_ouverture.ip_inscription` (anti-spam waitlist) est conservateur. Citer ces references dans la Motivation **sans pretendre que ces durees sont prescrites legalement** -- elles sont des choix internes documentes.

### Project context reference

- `_bmad-output/planning-artifacts/audit-cookies-2026-05-07.md` (audit RGPD anterieur) : ne mentionne pas explicitement la retention notifications_log. F-Epic7-B1 vient combler ce trou.
- `_bmad-output/planning-artifacts/prd.md` : NFR a11y, NFR securite, mais pas de NFR RGPD retention explicite. F-Epic7-B1 sert de reference pour les futures stories qui devront referencer une politique de retention (story Epic 8+ si ajout d'une nouvelle table PII).
- `_bmad-output/planning-artifacts/architecture-technique-roxanetnous-2026-02-09.md` : pas de section dediee RGPD. Hors scope de mise a jour pour cette story (architecture est un document fige).

## Dev Agent Record

### Agent Model Used

claude-opus-4-7 (1M context) via bmad-dev-story workflow.

### Debug Log References

**T1.1 - Audit MCP volumetrie 2026-05-14** (via `mcp__supabase__execute_sql`) :

```json
[
  {"tbl":"notifications_log","rows":24,"oldest":"2026-02-25 18:39:12.072+00","rows_purgeables_18m":0,"anonymes":0},
  {"tbl":"parrainages","rows":3,"oldest":"2026-04-28 17:35:39.466827+00","rows_purgeables_18m":0,"anonymes":3},
  {"tbl":"notifications_ouverture","rows":0,"oldest":null,"rows_purgeables_18m":0,"anonymes":0},
  {"tbl":"admin_actions_log","rows":121,"oldest":"2026-02-17 15:22:20.820024+00","rows_purgeables_18m":0,"anonymes":0}
]
```

**T1.2 - Verification renommage `waitlist_departements`** :

```sql
SELECT table_name FROM information_schema.tables WHERE table_schema='public' AND table_name='waitlist_departements';
-- []
```

Resultat vide -> renommage 6.C confirme. Note : la contrainte FK `waitlist_departements_code_departement_fkey` (sur `notifications_ouverture.code_departement`) conserve son nom historique (non renomme par 6.C) mais reste fonctionnelle.

**T1.2 bis - Audit cascades FK (4 tables PII)** :

```json
[
  {"constraint_name":"admin_actions_log_admin_id_fkey","column_name":"admin_id","foreign_table":"users","foreign_column":"id","delete_rule":"CASCADE"},
  {"constraint_name":"notifications_log_user_id_fkey","column_name":"user_id","foreign_table":"users","foreign_column":"id","delete_rule":"CASCADE"},
  {"constraint_name":"waitlist_departements_code_departement_fkey","column_name":"code_departement","foreign_table":"departements_ouverts","foreign_column":"code","delete_rule":"CASCADE"},
  {"constraint_name":"parrainages_filleule_id_fkey","column_name":"filleule_id","foreign_table":"users","foreign_column":"id","delete_rule":"SET NULL"},
  {"constraint_name":"parrainages_marraine_id_fkey","column_name":"marraine_id","foreign_table":"users","foreign_column":"id","delete_rule":"SET NULL"}
]
```

**T1.2 ter - Verification nullable `ip_inscription`** :

```json
[
  {"table_name":"notifications_ouverture","column_name":"ip_inscription","data_type":"text","is_nullable":"YES"},
  {"table_name":"parrainages","column_name":"ip_inscription","data_type":"text","is_nullable":"YES"}
]
```

Toutes les preconditions methode anonymisation in-place (`UPDATE ... SET ip_inscription = NULL`) confirmees.

**T1.3 - Drapeau Motivation** : non leve (`rows_purgeables_*` = 0 sur les 4 tables, dataset vierge pour stories 7.B.2/7.B.3).

**T5.1 - `npm run lint`** : exit 0, 0 errors, 193 warnings (sous baseline 195/196 herite 7.A.10/7.A.11 -> beneficiaire 2-3 warnings cumules).

**T5.2 - `npm run lint:a11y-check`** : exit 0. `OK: 155 jsx-a11y violations across 56 (file, rule) pair(s). Baseline total: 155. No regression.`

**T5.3 - `npm run a11y:axe:check`** : exit 0. `Parcours audites: 7 / OK: aucun delta Critical/Serious au-dela du baseline.` Baseline `_bmad-output/test-artifacts/axe-core-baseline-2026-05-05.json` (commit a0cdb8a). Page `/politique-de-confidentialite` incluse dans les 7 parcours, regle CLAUDE.md durcie 2026-05-06 respectee.

**T5.4 - `npm run test:unit`** : exit 0. `Test Files 5 passed (5) / Tests 59 passed (59) / Duration 1.07s.` Regression 7.A.11 preservee.

**T5.5 - `npm run check:no-direct-notifications-log-insert`** : exit 0. `OK : aucun INSERT direct sur notifications_log hors du helper autorise.` Garde-fou 7.A.11 vert (story documentaire ne touche pas `lib/notifications-log.ts` ni les call-sites).

**T5.6 - `npm run build`** : exit 0. Page `/politique-de-confidentialite` rebuild static prerendered (○), pas de warning.

### Completion Notes List

**Livre :**

- Section `## 2026-05-14 : Politique de retention donnees personnelles (decision F-Epic7-B1)` appendee a `DECISIONS.md` (~85 lignes) avec structure Decision / Motivation / Implications techniques / Regle.
- Tableau TTL 4 tables : `notifications_log` 18 mois DELETE / `parrainages.ip_inscription` 2 ans anonymisation / `notifications_ouverture.ip_inscription` 6 mois anonymisation / `admin_actions_log` conservation indefinie.
- Note BDD critique sur le renommage `waitlist_departements` -> `notifications_ouverture` (epic-7.md non corrige, divergence flaguee dans DECISIONS).
- Audit MCP volumetrie 2026-05-14 cite dans la section Motivation (0 row eligible a la purge, drapeau non leve).
- Cascades FK confirmees par audit MCP : `notifications_log.user_id CASCADE`, `admin_actions_log.admin_id CASCADE`, `parrainages.marraine_id+filleule_id SET NULL`, `notifications_ouverture.code_departement CASCADE`.
- Procedure droit a l'oubli **visiteur anonyme** documentee (DELETE manuel Supabase Studio + trace `admin_actions_log` action_type `rgpd_oubli_visiteur_anonyme`, `target_id_text = email_anonymise` conforme CHECK XOR 7.A.7). Endpoint admin diffe au-dela de 5 demandes/an.
- Heritage F5 (idempotence DELETE/UPDATE WHERE) + F6 (notifications_log.user_id NULLABLE) cite dans Implications techniques pour deverrouiller 7.B.2/7.B.3.
- Page publique `app/politique-de-confidentialite/page.tsx` alignee : 1 bullet "Logs de notification : 12 mois" remplace par 4 bullets (notifications_log 18 mois / IP parrainages 2 ans / IP waitlist 6 mois / journal admin indefini).
- 2 dettes barrees `deferred-work.md` : ligne 200 (`Stockage IP brut sans TTL ni purge -- RGPD`) + ligne 247 (`notifications_log retention indefinie / RGPD pour visiteurs anonymes`), pattern `~~...~~ [Solde 7.B.1 - 2026-05-14]` avec commentaire explicatif.
- `sprint-status.yaml` : transition `ready-for-dev` -> `in-progress` -> `review` + `last_updated` mis a jour avec resume detaille.

**Pointeur de reference :** Voir `DECISIONS.md` section `## 2026-05-14 : Politique de retention donnees personnelles (decision F-Epic7-B1)` (source canonique).

**Stories deverrouillees :** 7.B.2 (cron purge `notifications_log` >18 mois) et 7.B.3 (cron purge/anonymisation IP `parrainages` + `notifications_ouverture`) peuvent demarrer sur la base d'une politique contractualisee. Le dataset BDD est vierge (0 row purgeable a date) : les premiers runs des crons seront des no-op idempotents, validation en preview Vercel suffisante avant prod.

**Hors-scope explicite (AC10) - confirme NON livre dans cette story :**

- Aucune migration BDD (DDL `ON DELETE` / triggers / CHECK). Verifie par `git status` : 0 fichier sous `supabase/migrations/`.
- Aucun cron `app/api/cron/purge-*` (stories 7.B.2 / 7.B.3 livreront).
- Aucun endpoint `app/api/admin/delete-pii` (decision AC4 : pas avant 5 demandes/an, seuil documente dans F-Epic7-B1).
- Aucun changement de FK `ON DELETE` (les cascades actuelles sont conformes a la decision F-Epic7-B1, AC4).
- Aucune modification de `_bmad-output/planning-artifacts/audit-cookies-2026-05-07.md` (audit fige).
- Aucune migration du nom `waitlist_departements` dans `epic-7.md` (epic fige post-cadrage, la note BDD AC2 dans F-Epic7-B1 suffit pour signaler la divergence au dev agent + reviewer).

**Audit pre-commit AC7 - aucune row eligible** : `notifications_log` 24 rows oldest 2026-02-25 (< 3 mois, premiere row purgeable ~2027-08-25), `parrainages` 3 rows oldest 2026-04-28 (< 1 mois, premiere row purgeable ~2028-04-28), `notifications_ouverture` 0 row, `admin_actions_log` 121 rows mais conservation indefinie. Drapeau Motivation non leve.

### File List

- `DECISIONS.md` (modifie : append section F-Epic7-B1 ~85 lignes a la fin)
- `app/politique-de-confidentialite/page.tsx` (modifie : 1 bullet "12 mois" remplace par 4 bullets, lignes 69-72)
- `_bmad-output/implementation-artifacts/deferred-work.md` (modifie : 2 lignes barrees L200 + L247 avec suffixe `[Solde 7.B.1 - 2026-05-14]`)
- `_bmad-output/implementation-artifacts/sprint-status.yaml` (modifie : transition 7-b-1 `ready-for-dev` -> `review` + `last_updated` resume detaille)
- `_bmad-output/implementation-artifacts/7-b-1-politique-ttl-formalisee-decisions.md` (modifie : tasks cochees + Status `review` + Dev Agent Record + Change Log + DoD a11y)

**Aucun fichier sous `supabase/migrations/`** (AC6 valide).

## Change Log

- **2026-05-14** : Story livree (Status `review`), commit `3c94ae3` sur `main`. 5 fichiers : DECISIONS.md (append F-Epic7-B1 ~85 lignes), app/politique-de-confidentialite/page.tsx (1 bullet -> 4 bullets alignes), deferred-work.md (2 lignes barrees L200+L247), sprint-status.yaml (transition ready-for-dev -> review), story file (tasks cochees + Dev Agent Record + Change Log + DoD a11y). 0 fichier sous supabase/migrations/. Audit MCP volumetrie 4 tables PII (0 row purgeable a date). Validations locales : lint 193 warnings (sous baseline) / lint:a11y-check 155 baseline preserve / a11y:axe:check 0 delta Critical/Serious / test:unit 59/59 verts / check:no-direct-notifications-log-insert OK / build OK. Stories 7.B.2 et 7.B.3 deverrouillees.

## DoD a11y

A renseigner pour toute story avec impact UI (ignorer si pas de changement visuel/interactif) :

- [x] Labels associes aux champs (`htmlFor` ou `aria-labelledby`) -- N/A (pas de champ ajoute).
- [x] Erreurs liees aux champs via `aria-describedby` + `aria-invalid` -- N/A.
- [x] Focus visible sur tous les elements interactifs (contraste >= 3:1) -- N/A (pas d'element interactif ajoute).
- [x] Contrastes texte >= 4,5:1 et UI >= 3:1 -- les 4 bullets restent dans le `<ul>` conteneur, classe `list-disc pl-5 space-y-1` preservee, palette noir/blanc heritee.
- [x] ARIA states corrects sur composants dynamiques (`aria-expanded`, `aria-selected`, etc.) -- N/A.
- [x] Navigation clavier complete (Tab, Enter, Escape, fleches selon pattern) -- N/A (pas d'interactif).
- [ ] Verification ponctuelle au lecteur d'ecran (VoiceOver ou NVDA) sur le composant touche -- recommande mais non bloquant ; deleguee au reviewer humain.
- [x] Pas de regression `eslint-plugin-jsx-a11y` (`npm run lint:a11y-check` vert en CI) -- T5.2 confirme 155 baseline preserve.
- [x] Pas de regression axe-core (`npm run a11y:axe:check` vert ou delta documente avec justification dans la PR) -- T5.3 confirme 0 delta Critical/Serious sur 7 parcours dont /politique-de-confidentialite.
