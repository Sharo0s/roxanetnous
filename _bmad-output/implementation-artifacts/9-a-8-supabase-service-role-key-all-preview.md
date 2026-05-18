# Story 9.A.8 : SUPABASE_SERVICE_ROLE_KEY scopée "all Preview" Vercel

Status: ready-for-dev

<!-- Note: Validation is optional. Run validate-create-story for quality check before dev-story. -->

## Story

As a **responsable infrastructure du projet roxanetnous**,
I want **garantir que `SUPABASE_SERVICE_ROLE_KEY` soit définie sur Vercel pour l'environnement Preview au scope "all Preview branches" (pas par branche individuelle), de sorte que toute PR future déclenche un déploiement Preview Vercel buildable sans intervention manuelle préalable**,
so that **on solde la dette latente découverte 2026-05-18 pendant la story 9.A.6 (PR #11), où le build Preview a échoué 3 fois consécutives avec `Error: supabaseKey is required` au prerender SSG de `/` (`app/page.tsx:15` consomme `createClient({ serviceRole: true })`), résolu in extremis par ajout d'un override scopé à la branche `story/9-a-6-audit-sentry-epic-7-8` via API REST Vercel — solution non pérenne car toute future PR Preview qui prerender la landing cassera identiquement tant que la var n'est pas portée à "all Preview"**.

## Contexte

**Origine** : découverte 2026-05-18 pendant la livraison de la story 9.A.6 (cf. mémoire `project_epic_9_cadrage` et Change Log story 9.A.6).

**Symptôme observé sur 3 déploiements Vercel consécutifs PR #11 (`dpl_6AbuYn5Kp...`, `dpl_2mcx84P...`, `dpl_9yuZA7Z...`)** :
```
Error occurred prerendering page "/". Read more: https://nextjs.org/docs/messages/prerender-error
Error: supabaseKey is required.
    at new cE (.next/server/chunks/ssr/_0ltbyqh._.js:38:45722)
    ...
Export encountered an error on /page: /, exiting the build.
```

**Cause racine** : `app/page.tsx:15` instancie `await createClient({ serviceRole: true })` au moment du prerender SSG (page est statique avec `export const revalidate = 120`). Au build Preview, le code lit `process.env.SUPABASE_SERVICE_ROLE_KEY` qui est **undefined** car la var **n'existe que pour l'environnement Production sur Vercel** (audit `vercel env ls production` 2026-05-18 confirme 1 occurrence Production type=sensitive + 1 occurrence Development type=encrypted, **zéro occurrence Preview**).

**Audit Vercel API REST 2026-05-18 (token CLI local)** :
```
GET https://api.vercel.com/v9/projects/prj_p731Z29MnX3ziZoJwLJlJF2SmQyw/env?teamId=team_Y5nPTlpiOys5tHTRqHIHXkKq
→ SUPABASE_SERVICE_ROLE_KEY :
  - id=SqTmD4qDnwhvhwnT type=encrypted target=["development"] branch=none
  - id=4fvzqKTZlq6INlUw type=sensitive  target=["production"]  branch=none
  - id=BnSigPw679WwCk3Q type=sensitive  target=["preview"]     branch=story/9-a-6-audit-sentry-epic-7-8  ← override 9.A.6, créé 2026-05-18, à promouvoir "all Preview"
```

**Fix temporaire 9.A.6** : ajout d'un override `type=sensitive target=["preview"] gitBranch=story/9-a-6-audit-sentry-epic-7-8` via `POST https://api.vercel.com/v10/projects/{id}/env` (CLI `vercel env add` bug v54 mode agent, cf. note). Valeur identique à Production (JWT legacy `eyJhbGci...rNw`, 219 chars). Le redeploy `GRbWW1XKRApTdZXbpZaWoJsPwzZx` post-fix a passé Ready, PR #11 mergée commit `95143a3`.

**Conséquence si non corrigé** : la **prochaine PR** ouverte par Sylvain qui modifie n'importe quel fichier source `.ts/.tsx/.css/.js` déclenchera un nouveau Vercel Preview build sur une nouvelle branche (ex. `story/9-b-1-...`) qui **n'aura pas l'override SRK** et **échouera identiquement** au prerender de `/`. Sylvain devra reproduire l'enchaînement de 1h+ debug + 4-5 redeploys pour chaque nouvelle PR Preview tant que la var n'est pas à "all Preview".

**Bug CLI Vercel v54.0.0 (workaround documenté)** : `vercel env add --value <val>` en mode "agent detected" (auto-activé quand un agent CLI invoque la commande) stocke silencieusement `""` (chaîne vide) au lieu de la valeur passée. 3 tentatives reproduites 2026-05-18 (avec `--value`, avec stdin pipe `< file`, avec heredoc). La CLI affiche `"Added Environment Variable NEXT_PUBLIC_SUPABASE_URL to Project roxanetnous"` mais `vercel env pull` retourne `""`. **Workaround** : appel direct `POST /v10/projects/{id}/env` via curl + token extrait depuis `~/Library/Application Support/com.vercel.cli/auth.json`. À reporter à Vercel (mais hors-scope cette story).

**Périmètre strict (story 100% infra/observabilité, 0 fichier source)** :
- **1 modification env vars Vercel** via API REST :
  - SUPPRESSION de l'override `BnSigPw679WwCk3Q` (target=preview, gitBranch=story/9-a-6-...).
  - AJOUT d'une nouvelle entrée `target=["preview"] gitBranch=null` (= all Preview branches) avec la même valeur que Production (JWT legacy 219 chars, type=sensitive).
- **0 modification de code** (zéro fichier `.ts/.tsx/.sql/.css/.js`).
- **0 migration BDD** (zéro fichier `supabase/migrations/`).
- **0 nouveau parcours UI**.
- **1 entrée DECISIONS.md** (`F-Epic9-A8 hygiène env vars Vercel — SRK all Preview` + note bug CLI v54).
- **Update sprint-status.yaml** (`9-a-8-supabase-service-role-key-all-preview: ready-for-dev → in-progress → review → done`).
- Update story file `_bmad-output/implementation-artifacts/9-a-8-supabase-service-role-key-all-preview.md` (Dev Agent Record + File List + Change Log + Status).

**Pré-requis** : aucun (la story 9.A.6 est DONE, l'override branche est en place et fonctionnel, on le remplace par l'équivalent "all Preview" en une transaction API REST).

**Why** : (a) éviter la répétition systématique du bug sur chaque future PR Preview, (b) acter la dette dans DECISIONS.md pour traçabilité, (c) documenter le workaround CLI v54 pour les futures interventions.

**How to apply** : exécuter pendant un créneau où aucune PR Preview active ne dépend de l'override branche `story/9-a-6-...` (vrai post-merge PR #11). Le seul risque est une race avec une PR active sur la même branche, neutralisé puisque la branche `story/9-a-6-...` a été supprimée par `gh pr merge --delete-branch`.

## Acceptance Criteria

1. **AC1 — Audit API REST pré-fix obligatoire** : exécuter `GET https://api.vercel.com/v9/projects/prj_p731Z29MnX3ziZoJwLJlJF2SmQyw/env?teamId=team_Y5nPTlpiOys5tHTRqHIHXkKq` avec token CLI local (`jq -r '.token' ~/Library/Application\ Support/com.vercel.cli/auth.json`). Documenter dans Dev Agent Record > Debug Log > T1 :
   - Confirmer présence de l'override branche (id `BnSigPw679WwCk3Q`, target=preview, gitBranch=story/9-a-6-audit-sentry-epic-7-8, type=sensitive).
   - Confirmer présence Production (id `4fvzqKTZlq6INlUw`, target=production, type=sensitive).
   - Confirmer **absence** d'une autre entrée Preview "all branches" (gitBranch=null target=preview).

2. **AC2 — Récupération valeur Production** : la valeur Production `SUPABASE_SERVICE_ROLE_KEY` étant `type=sensitive`, elle est **inaccessible via `vercel env pull` et l'API REST** (retournée vide ou blob crypté). Deux sources alternatives possibles :
   - (a) Dashboard Supabase : `https://supabase.com/dashboard/project/fdmyurhfyfbfysuwotjx/settings/api` → section "Project API keys" → ligne `service_role` (cliquer "Reveal").
   - (b) Dashboard Vercel : `https://vercel.com/roxanetnous/roxanetnous/settings/environment-variables` → chercher `SUPABASE_SERVICE_ROLE_KEY` ligne Production → "Show value" (peut être bloqué selon flag sensitive).
   - (c) Demander à Sylvain qui détient la clé en local (cf. session 2026-05-18, valeur connue commençant par `eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIs...` JWT legacy 219 chars).
   - **Ne PAS écrire la valeur en clair dans le repo, ni dans Dev Agent Record, ni dans le rapport**. Seuls les méta-données (longueur, format prefix `eyJhbGci...`, type=JWT) sont admissibles dans la story.

3. **AC3 — POST API REST pour créer entrée "all Preview"** : exécuter `POST https://api.vercel.com/v10/projects/prj_p731Z29MnX3ziZoJwLJlJF2SmQyw/env?teamId=team_Y5nPTlpiOys5tHTRqHIHXkKq` avec body :
   ```json
   {
     "key": "SUPABASE_SERVICE_ROLE_KEY",
     "value": "<JWT_VALUE_FROM_AC2>",
     "type": "sensitive",
     "target": ["preview"],
     "gitBranch": null
   }
   ```
   La valeur doit être passée **sans guillemets enveloppants** (la chaîne stockée Vercel doit être exactement le JWT, longueur 219 chars). Vérifier le retour API contient `"created": [{...id: ..., key: SUPABASE_SERVICE_ROLE_KEY, target: ["preview"], gitBranch: null, type: sensitive...}]`. Documenter l'id nouveau dans Dev Agent Record > Debug Log > T2.

4. **AC4 — Audit post-fix** : ré-exécuter `GET /v9/projects/{id}/env` et confirmer :
   - Nouvelle entrée Preview "all branches" présente (gitBranch=null target=preview type=sensitive).
   - Override branche `BnSigPw679WwCk3Q` toujours présent (pas encore supprimé, on le garde 24h pour rollback safe au cas où).
   - Production `4fvzqKTZlq6INlUw` inchangée.
   Documenter dans Dev Agent Record > Debug Log > T3.

5. **AC5 — Test redeploy sans override branche (validation fonctionnelle)** : pour valider que l'entrée "all Preview" est bien utilisée :
   - (a) Créer une nouvelle branche éphémère `test/9-a-8-srk-validation` depuis main (1 commit vide `chore: test SRK all preview`).
   - (b) Push → Vercel déclenche automatiquement un Preview build sur cette nouvelle branche **sans override** (puisque l'override est scopé à `story/9-a-6-...`).
   - (c) Confirmer le build passe Ready (= le SRK "all Preview" est bien lu par le prerender de `/`).
   - (d) Supprimer la branche `test/9-a-8-srk-validation` (locale + remote) une fois validation OK.
   Documenter dans Dev Agent Record > Debug Log > T4 : URL du deploy + status terminal.

6. **AC6 — Suppression de l'override branche 9.A.6 (cleanup)** : après validation AC5 vert, exécuter `DELETE https://api.vercel.com/v9/projects/{id}/env/BnSigPw679WwCk3Q?teamId={team}` pour supprimer l'override historique (id `BnSigPw679WwCk3Q`, scope `story/9-a-6-...`). Confirmer status 200 OK et absence dans `vercel env ls preview story/9-a-6-...`. **Hors-scope safety** : si AC5 échoue, conserver l'override (rollback) et HALT pour investigation.

7. **AC7 — Entrée `DECISIONS.md`** : ajouter `## F-Epic9-A8 -- hygiene env vars Vercel - SUPABASE_SERVICE_ROLE_KEY all Preview + bug CLI v54 -- {YYYY-MM-DD}` en fin de fichier. Contenu attendu (format inspiré F-Epic9-A6) :
   - Header date + résumé (1 ligne).
   - Paragraphe contexte (3-5 lignes : découverte 9.A.6 PR #11, 3 deploys échec, override branche temporaire, promotion all Preview pérenne).
   - Paragraphe bug CLI v54 (3-5 lignes : reproduction stdin/--value silencieusement stocke "", workaround API REST direct, à reporter Vercel).
   - 1 ligne "Impact" : "Toute future PR Preview prerender `/` build OK sans intervention manuelle".
   - Source : `9.A.6` PR #11, `app/page.tsx:15`, audit API REST 2026-05-18.

8. **AC8 — Update `sprint-status.yaml`** : transitions normales `9-a-8-supabase-service-role-key-all-preview: backlog → ready-for-dev (cette story créée) → in-progress (début T1) → review (post-AC5 vert) → done (post-merge PR)`. Mettre à jour `last_updated` haut de fichier.

9. **AC9 — DoD CI light** : la story ne modifie pas de code source. DoD CI minimale :
   - `git diff --name-only main HEAD` retourne **uniquement** : 1 modification `DECISIONS.md` + 1 modification `sprint-status.yaml` + 1 modification de cette story file. **Aucune autre modification**.
   - `npm run build` non requis (zéro fichier `.ts/.tsx/.css/.js` modifié).
   - `npm run lint`, `lint:a11y-check`, `a11y:axe:check`, `test:unit`, `test:integration` non requis (zéro impact code).
   - Si CI déclenche l'un de ces checks automatiquement sur la PR, leur réussite est attendue par construction (zéro fichier source touché).

10. **AC10 — Zero PII / secrets dans le repo** : la valeur JWT `SUPABASE_SERVICE_ROLE_KEY` ne doit **jamais** apparaître en clair dans : story file, DECISIONS.md, sprint-status.yaml, Dev Agent Record, Change Log, commit message, PR body. Seules les méta-données admissibles : longueur (`219 chars`), format prefix masqué (`eyJhbGci...`), type (`JWT legacy HS256 role=service_role`), ID Vercel de l'entrée (`xxxxxxxx`). Pré-commit : `git diff --cached | grep -iE 'eyJhbGci|sb_secret_|service.role.*=.*[A-Za-z0-9]{20,}'` doit retourner zéro match.

11. **AC11 — Idempotence** : NFR-Epic9-5 — la story est ré-exécutable sans effet de bord (modulo état Vercel cible déjà conforme). Si Sylvain relance par accident :
    - AC3 retournera `409 ENV_CONFLICT` car l'entrée "all Preview" existe déjà → comportement attendu, pas une erreur.
    - AC6 retournera `404 NOT_FOUND` car l'override branche est déjà supprimé → comportement attendu, pas une erreur.
    Documenter ces 2 cas dans Dev Agent Record si rencontrés.

## Tasks / Subtasks

- [ ] **T1 — Audit API REST pré-fix** (AC1)
  - [ ] T1.1 Extraire token : `TOKEN=$(jq -r '.token' ~/Library/Application\ Support/com.vercel.cli/auth.json)`.
  - [ ] T1.2 `curl -s "https://api.vercel.com/v9/projects/prj_p731Z29MnX3ziZoJwLJlJF2SmQyw/env?teamId=team_Y5nPTlpiOys5tHTRqHIHXkKq" -H "Authorization: Bearer $TOKEN" | jq '.envs[] | select(.key=="SUPABASE_SERVICE_ROLE_KEY")'`.
  - [ ] T1.3 Documenter dans Debug Log les 3 entrées attendues (dev / preview-branch-9.A.6 / production).

- [ ] **T2 — Récupération valeur Production + POST API REST** (AC2, AC3)
  - [ ] T2.1 Récupérer valeur JWT depuis Supabase Studio OU Vercel dashboard Production OU demander Sylvain (cf. AC2). Stocker dans variable shell `$SRK` (pas dans fichier disque).
  - [ ] T2.2 Vérifier `${#SRK} == 219` et `echo "$SRK" | head -c 8` == `eyJhbGci`.
  - [ ] T2.3 POST `curl -X POST "https://api.vercel.com/v10/projects/{id}/env?teamId={team}" -H "Authorization: Bearer $TOKEN" -H "Content-Type: application/json" -d "{\"key\":\"SUPABASE_SERVICE_ROLE_KEY\",\"value\":\"${SRK}\",\"type\":\"sensitive\",\"target\":[\"preview\"],\"gitBranch\":null}"`.
  - [ ] T2.4 Confirmer retour API : `"created": [{...id: <NEW_ID>, gitBranch: null...}]`. Capturer `<NEW_ID>` pour Debug Log.
  - [ ] T2.5 `unset SRK` immédiatement après le POST.

- [ ] **T3 — Audit post-fix** (AC4)
  - [ ] T3.1 Re-run audit `GET /v9/projects/{id}/env` et confirmer 4 entrées `SUPABASE_SERVICE_ROLE_KEY` (dev + preview-branch-9.A.6 + preview-all + production).
  - [ ] T3.2 Documenter Debug Log T3 : 4 IDs + targets + gitBranches + types.

- [ ] **T4 — Test validation fonctionnelle redeploy sans override** (AC5)
  - [ ] T4.1 Créer branche `git checkout -b test/9-a-8-srk-validation`.
  - [ ] T4.2 Commit vide `git commit --allow-empty -m "chore: test SRK all preview"`.
  - [ ] T4.3 Push `git push -u origin test/9-a-8-srk-validation`.
  - [ ] T4.4 Attendre Vercel Preview build (monitoring via `gh pr checks` ou `vercel inspect`).
  - [ ] T4.5 Confirmer build status = Ready (= SRK "all Preview" bien lu).
  - [ ] T4.6 Cleanup : `git checkout main && git branch -D test/9-a-8-srk-validation && git push origin --delete test/9-a-8-srk-validation`.
  - [ ] T4.7 Documenter Debug Log T4 : URL deploy + status terminal + temps build.

- [ ] **T5 — Cleanup override branche 9.A.6** (AC6)
  - [ ] T5.1 `curl -X DELETE "https://api.vercel.com/v9/projects/{id}/env/BnSigPw679WwCk3Q?teamId={team}" -H "Authorization: Bearer $TOKEN"`.
  - [ ] T5.2 Confirmer status 200 OK.
  - [ ] T5.3 Re-run audit `GET /v9/projects/{id}/env` et confirmer 3 entrées restantes (dev + preview-all + production).
  - [ ] T5.4 Documenter Debug Log T5.

- [ ] **T6 — Update gouvernance** (AC7)
  - [ ] T6.1 Ajouter entrée `F-Epic9-A8` dans `DECISIONS.md` (format inspiré F-Epic9-A6 ligne 1036).
  - [ ] T6.2 Vérifier zero PII dans le contenu (cf. AC10).

- [ ] **T7 — Update sprint-status + story file** (AC8)
  - [ ] T7.1 `sprint-status.yaml` : ajouter ligne `9-a-8-supabase-service-role-key-all-preview: ready-for-dev` puis transitions in-progress/review/done.
  - [ ] T7.2 Story file : Dev Agent Record + File List + Change Log + Status.

- [ ] **T8 — DoD CI light + sanity diff** (AC9, AC10)
  - [ ] T8.1 `git status` : confirmer **uniquement** 3 fichiers modifiés (DECISIONS + sprint-status + story file).
  - [ ] T8.2 `git diff --cached | grep -iE 'eyJhbGci|sb_secret_'` : zéro match (AC10).
  - [ ] T8.3 Aucun lint/test/build à exécuter (story 100% gouvernance/infra).

- [ ] **T9 — Commit + PR** (heritage 9.A.6 commit `35b231a`)
  - [ ] T9.1 Branche dédiée `story/9-a-8-srk-all-preview`.
  - [ ] T9.2 1 commit principal : `Story 9.A.8 : infra(vercel) SUPABASE_SERVICE_ROLE_KEY scopee all Preview + cleanup override 9.A.6`.
  - [ ] T9.3 PR title `Story 9.A.8 — SUPABASE_SERVICE_ROLE_KEY all Preview + doc bug CLI Vercel v54`.
  - [ ] T9.4 PR body : résumé fix + lien DECISIONS.md F-Epic9-A8 + lien deploy validation T4.
  - [ ] T9.5 Merge sans review obligatoire (story infra/gouvernance, pas de code).

- [ ] **T10 — Post-merge `review → done`** (heritage 9.A.6 commit `879e197`)
  - [ ] T10.1 Chore commit séparé : `sprint-status.yaml` `9-a-8-...: review → done` + Story file Status: `review → done` + Change Log final.
  - [ ] T10.2 Mémoire `project_epic_9_cadrage` : noter 9.A.8 DONE.

## Dev Notes

### Architecture & patterns

- **Pattern env vars Vercel par scope** : Vercel supporte 3 niveaux de scoping pour les env vars :
  1. **Global env** : `target=["preview"] gitBranch=null` (applique à toutes les branches Preview).
  2. **Branch override** : `target=["preview"] gitBranch="story/xxx"` (override spécifique à 1 branche, prend précédence sur le global).
  3. **Per-environment** : `target=["production"|"development"]` (Production / Dev local via `vercel dev`).
- **Conséquence pour cette story** : on veut convertir le niveau (2) historique 9.A.6 → niveau (1) global pérenne. Le passage de (2) à (1) ne peut pas se faire en édition simple via API REST (pas d'endpoint PATCH gitBranch), il faut donc CREATE + DELETE.
- **Type `sensitive` vs `encrypted`** : Production utilise `type=sensitive` (valeur jamais déchiffrable via CLI/API REST, security feature Vercel). On reproduit `type=sensitive` pour Preview "all" pour cohérence + ne pas exposer le JWT dans `vercel env pull` futurs.

### Sources autoritaires

- `_bmad-output/implementation-artifacts/9-a-6-audit-sentry-7j-post-deploy-epic-7-8.md` (Change Log section) — historique des 3 deploys Vercel échec + fix override.
- `DECISIONS.md` F-Epic9-A6 (entrée 2026-05-18) — verdict story 9.A.6 + mention dette env vars latente.
- `app/page.tsx:10-30` — usage `createClient({ serviceRole: true })` au prerender SSG.
- Audit API REST Vercel 2026-05-18 (snapshot pré-fix, cf. AC1).
- Mémoire `project_rotation_secrets_2026_05_16` — rotation `anon_key` legacy JWT → `sb_publishable_*` mais `service_role` reste JWT legacy.
- Mémoire `project_epic_9_cadrage` — état Epic 9 7/16 DONE 2026-05-18.

### API REST Vercel — endpoints nécessaires

- `GET /v9/projects/{id}/env?teamId={team}` (T1, T3, T5.3 — audits).
- `POST /v10/projects/{id}/env?teamId={team}` (T2.3 — création entrée all Preview).
- `DELETE /v9/projects/{id}/env/{envId}?teamId={team}` (T5.1 — suppression override branche).

**Authentification** : token CLI extrait depuis `~/Library/Application Support/com.vercel.cli/auth.json` clé `.token` (60 chars `vca_xxx`). Validité : indéfinie jusqu'à rotation manuelle. Scopes inclus : project read/write env.

### Hors-scope explicite (à NE PAS traiter dans 9.A.8)

- Strip des guillemets dans `NEXT_PUBLIC_SUPABASE_URL` Production (`"https://..."` → `https://...`). Risque MOYEN cosmétique, à traiter dans une story d'hygiène ultérieure si la liste de dettes env vars s'allonge.
- Patch défensif `app/page.tsx` pour gracefuly handle `SUPABASE_SERVICE_ROLE_KEY` undefined. Touche du code source, viole le périmètre "0 fichier source" de cette story, à traiter ailleurs si justifié.
- Migration `service_role_key` JWT legacy → `sb_secret_*` format moderne. Demande rotation côté Supabase + maj Vercel x3 (Prod + Preview + Dev) + `.env.local` Sylvain. Fenêtre incident potentielle non négligeable, à planifier en story dédiée hors Epic 9.
- Reporting du bug CLI Vercel v54 à l'équipe Vercel (issue GitHub `vercel/vercel`). Démarche externe non bloquante.

### Project Structure Notes

- Aucun fichier dans `app/`, `lib/`, `components/`, `supabase/migrations/`, `tests/`, `scripts/`, `types/`. Story 100% infra/gouvernance.
- 3 fichiers modifiés : `DECISIONS.md` + `_bmad-output/implementation-artifacts/sprint-status.yaml` + cette story file.
- Aucun nouveau fichier rapport (contrairement à 9.A.6) — la story est uniquement opérationnelle, pas observabilité.

### References

- [Source: `_bmad-output/implementation-artifacts/9-a-6-audit-sentry-7j-post-deploy-epic-7-8.md` Change Log section] — historique 3 deploys échec + fix override 2026-05-18.
- [Source: `DECISIONS.md` F-Epic9-A6 entrée 2026-05-18] — verdict story 9.A.6 + mention dette latente env vars.
- [Source: `app/page.tsx:10-30`] — usage `createClient({ serviceRole: true })` au prerender SSG, point de défaillance build Preview.
- [Source: `https://vercel.com/docs/projects/environment-variables`] — doc Vercel scoping env vars per branch vs global preview.
- [Source: `https://vercel.com/docs/rest-api/reference/endpoints/projects/create-one-or-more-environment-variables`] — endpoint API REST POST /v10/projects/{id}/env.
- [Source: mémoire `project_epic_9_cadrage`] — Epic 9 7/16 DONE 2026-05-18, 9.A.8 ajoutée Ordre 1 bloquante.
- [Source: mémoire `project_rotation_secrets_2026_05_16`] — rotation clés Supabase 2026-05-16, anon en `sb_publishable_*` mais service_role JWT legacy conservé.
- [Source: mémoire `feedback_test_local_supabase`] — N/A pour cette story (pas de code à tester).

## Dev Agent Record

### Agent Model Used

claude-opus-4-7[1m] (Opus 4.7, 1M context) ou équivalent (story exécutable par tout LLM ayant accès API REST Vercel via token CLI local).

### Debug Log References

(À remplir lors de l'exécution)

**T1 audit API REST pré-fix ({YYYY-MM-DD HH:MM UTC}) :**
- T1.1 Token extracted : `vca_xxx...` (60 chars).
- T1.2 GET /v9/projects/{id}/env → 3 entrées `SUPABASE_SERVICE_ROLE_KEY` confirmées :
  - id=SqTmD4qDnwhvhwnT type=encrypted target=["development"] branch=none.
  - id=BnSigPw679WwCk3Q type=sensitive  target=["preview"]     branch=story/9-a-6-audit-sentry-epic-7-8.
  - id=4fvzqKTZlq6INlUw type=sensitive  target=["production"]  branch=none.
- T1.3 Absence confirmée d'une entrée preview-all (gitBranch=null target=preview) : ✅.

**T2 récupération valeur + POST API REST ({YYYY-MM-DD HH:MM UTC}) :**
- T2.1 Source valeur : ... (Supabase Studio / Vercel Dashboard / Sylvain).
- T2.2 Validation : length=219 ✅, prefix=`eyJhbGci` ✅.
- T2.3 POST /v10/projects/{id}/env → status 200, response : `{"created": [{"id": "<NEW_ID>", ...}]}`.
- T2.4 NEW_ID = `xxxxxxxxxxxxxxxx`.
- T2.5 `unset SRK` ✅.

**T3 audit post-fix ({YYYY-MM-DD HH:MM UTC}) :**
- T3.1 GET /v9/projects/{id}/env → 4 entrées `SUPABASE_SERVICE_ROLE_KEY` :
  - dev + preview-branch-9.A.6 + preview-all (NEW) + production.
- T3.2 Confirmation NEW entry : id=NEW_ID, gitBranch=null, target=["preview"], type=sensitive ✅.

**T4 test redeploy validation ({YYYY-MM-DD HH:MM UTC}) :**
- T4.1-T4.3 Branche `test/9-a-8-srk-validation` créée + push.
- T4.4 Vercel Preview build URL : ...
- T4.5 Status terminal : Ready ✅ (temps build : ~Xs).
- T4.6 Cleanup branche locale + remote : ✅.

**T5 cleanup override branche 9.A.6 ({YYYY-MM-DD HH:MM UTC}) :**
- T5.1 DELETE /v9/projects/{id}/env/BnSigPw679WwCk3Q → status 200.
- T5.3 Re-audit : 3 entrées restantes (dev + preview-all + production), pas de preview-branch.

### Completion Notes List

(À remplir lors de l'exécution)

- ✅/⚠️ Token CLI Vercel extrait et POST API REST réussi : ...
- ✅/⚠️ Valeur SRK confirmée 219 chars JWT (méta uniquement, pas la valeur) : ...
- ✅/⚠️ Build Preview branche test réussi sans override : ...
- ✅/⚠️ Override branche 9.A.6 supprimé proprement : ...
- ✅/⚠️ F-Epic9-A8 entrée DECISIONS.md ajoutée : ...
- ✅/⚠️ Zero PII / secret dans le repo (grep AC10 vide) : ...

### File List

(À remplir lors de l'exécution)

**Fichiers créés (0).**

**Fichiers modifiés (3) :**
- `DECISIONS.md` (1 entrée F-Epic9-A8 ajoutée ~15-20 lignes : décision + contexte + bug CLI v54 + impact).
- `_bmad-output/implementation-artifacts/sprint-status.yaml` (transitions statut 9.A.8).
- `_bmad-output/implementation-artifacts/9-a-8-supabase-service-role-key-all-preview.md` (cette story : tasks cochés, Dev Agent Record, File List, Change Log, Status → done).

**0 fichier source modifié** (`app/`, `lib/`, `components/`, `supabase/migrations/`, `tests/`, `scripts/`, `types/`).

**0 fichier supprimé.**

### Change Log

(À remplir lors de l'exécution)

| Date | Auteur | Action |
| --- | --- | --- |
| {YYYY-MM-DD} | dev (claude-opus-4-7) | Story 9.A.8 — Audit API REST pré-fix (T1) : 3 entrées SRK confirmées (dev + preview-branch + production), absence preview-all confirmée. |
| {YYYY-MM-DD} | dev (claude-opus-4-7) | Story 9.A.8 — POST API REST création entrée SRK preview-all (T2) : id=NEW_ID, gitBranch=null, type=sensitive. |
| {YYYY-MM-DD} | dev (claude-opus-4-7) | Story 9.A.8 — Test validation redeploy sans override (T4) : Vercel Preview build branche éphémère `test/9-a-8-srk-validation` status Ready ✅, SRK preview-all bien lu. |
| {YYYY-MM-DD} | dev (claude-opus-4-7) | Story 9.A.8 — Cleanup override branche 9.A.6 (T5) : DELETE /v9/projects/{id}/env/BnSigPw679WwCk3Q status 200. |
| {YYYY-MM-DD} | dev (claude-opus-4-7) | Story 9.A.8 — `DECISIONS.md` F-Epic9-A8 ajouté (hygiène env vars + bug CLI v54 documenté). |
| {YYYY-MM-DD} | dev (claude-opus-4-7) | Story 9.A.8 — DoD CI light vert (0 source touché, 0 PII repo). Story passée en `review`. |
| {YYYY-MM-DD} | dev (claude-opus-4-7) | Story 9.A.8 — chore post-merge PR #{N} : `review → done`. |

## DoD a11y

Story **sans impact UI** : 100% infrastructure / gouvernance. Aucun composant React, page rendue, parcours utilisateur, CSS / Tailwind, libellé visible, ou élément interactif touché. Le seul "livrable visible" est une modification d'env var côté Vercel + 1 entrée DECISIONS.md (artefact projet, jamais rendu côté app).

- [ ] Labels associes aux champs (`htmlFor` ou `aria-labelledby`) — **N/A** : zéro nouveau champ form.
- [ ] Erreurs liees aux champs via `aria-describedby` + `aria-invalid` — **N/A** : zéro nouvelle erreur inline.
- [ ] Focus visible sur tous les elements interactifs (contraste >= 3:1) — **N/A** : zéro élément interactif.
- [ ] Contrastes texte >= 4,5:1 et UI >= 3:1 — **N/A** : zéro modification CSS / Tailwind.
- [ ] ARIA states corrects sur composants dynamiques (`aria-expanded`, `aria-selected`, etc.) — **N/A** : aucun composant dynamique touché.
- [ ] Navigation clavier complete (Tab, Enter, Escape, fleches selon pattern) — **N/A** : aucun flux focus modifié.
- [ ] Verification ponctuelle au lecteur d'ecran (VoiceOver ou NVDA) sur le composant touche — **N/A** : zéro modification rendu visible.
- [x] Pas de regression `eslint-plugin-jsx-a11y` (`npm run lint:a11y-check` vert en CI) — baseline 155 préservée par construction (zéro JSX touché). Check non requis pour cette story (AC9), mais réussite attendue si déclenché automatiquement sur la PR.
- [x] Pas de regression axe-core (`npm run a11y:axe:check` vert ou delta documente avec justification dans la PR) — baseline 0 violations Critical/Serious préservée par construction (zéro JSX touché). Check non requis pour cette story (AC9), mais réussite attendue si déclenché automatiquement sur la PR.
