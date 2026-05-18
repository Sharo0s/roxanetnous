# Story 9.A.8 : SUPABASE_SERVICE_ROLE_KEY scopée "all Preview" Vercel

Status: done

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

- [x] **T1 — Audit API REST pré-fix** (AC1)
  - [x] T1.1 Extraire token : `TOKEN=$(jq -r '.token' ~/Library/Application\ Support/com.vercel.cli/auth.json)`.
  - [x] T1.2 `curl -s "https://api.vercel.com/v9/projects/prj_p731Z29MnX3ziZoJwLJlJF2SmQyw/env?teamId=team_Y5nPTlpiOys5tHTRqHIHXkKq" -H "Authorization: Bearer $TOKEN" | jq '.envs[] | select(.key=="SUPABASE_SERVICE_ROLE_KEY")'`.
  - [x] T1.3 Documenter dans Debug Log les 3 entrées attendues (dev / preview-branch-9.A.6 / production).

- [x] **T2 — Récupération valeur Production + POST API REST** (AC2, AC3) — étendu à `NEXT_PUBLIC_SUPABASE_URL` mid-exec (cf. Dev Agent Record).
  - [x] T2.1 Valeur JWT 219 chars fournie via fichier temporaire `/tmp/srk.txt` (créé par Sylvain, supprimé après POST).
  - [x] T2.2 Validation `length=219 ✅` + `prefix=eyJhbGci ✅`.
  - [x] T2.3 POST SRK preview-all : HTTP 201, id=`BjpMYqqzOSwvenB9`.
  - [x] T2.4 POST `NEXT_PUBLIC_SUPABASE_URL` preview-all (scope étendu mid-exec) : HTTP 201, id=`1Hcq8FcGbPqYJNSz`.
  - [x] T2.5 `/tmp/srk.txt` supprimé en fin de story.

- [x] **T3 — Audit post-fix** (AC4)
  - [x] T3.1 GET /v9/projects/{id}/env : 4 entrées SRK confirmées (dev + preview-branch-9.A.6 + preview-all NEW + production) + 3 entrées URL (preview-branch-9.A.6 + preview-all NEW + production).
  - [x] T3.2 Documenté Debug Log T3.

- [x] **T4 — Test validation fonctionnelle redeploy sans override** (AC5)
  - [x] T4.1-T4.3 Branche `test/9-a-8-srk-validation` créée + push (1er commit empty, puis 1 commit non-empty README pour forcer trigger Vercel).
  - [x] T4.4-T4.5 Vercel Preview build `dpl_HEYKSgXQxqx2stgHMpvknGbrM48i` (commit `8438c35`) : **READY** sur URL `roxanetnous-ddz0r7fed-roxanetnous.vercel.app`. Note T4.4 amont : 1er build sur `1bc1081` ERROR car `NEXT_PUBLIC_SUPABASE_URL is not set` → diagnostic scope étendu mid-exec.
  - [x] T4.6 Cleanup branche locale + remote.
  - [x] T4.7 Documenté Debug Log T4.

- [x] **T5 — Cleanup overrides branches 9.A.6** (AC6) — étendu à 3 overrides
  - [x] T5.1 DELETE SRK `BnSigPw679WwCk3Q` : HTTP 200.
  - [x] T5.2 DELETE URL `SRe1U8NbNpQaHsLe` : HTTP 200.
  - [x] T5.3 DELETE ANON_KEY orphelin `kAeLONx9UkpNrhzJ` (proprete, fallback Preview-all `gAGSqhhneSwa87QF` deja en place) : HTTP 200.
  - [x] T5.4 Audit final : plus aucun override branche, 3 entrées SRK (dev+preview-all+prod), 2 entrées URL (preview-all+prod), 2 entrées ANON (preview-all+prod).

- [x] **T6 — Update gouvernance** (AC7)
  - [x] T6.1 Entrée `F-Epic9-A8` ajoutée `DECISIONS.md` (scope étendu SRK+URL+bug CLI v54).
  - [x] T6.2 Zero PII vérifié : seuls IDs Vercel + méta-données (longueur 219, prefix `eyJhbGci`) + scopes apparaissent.

- [x] **T7 — Update sprint-status + story file** (AC8)
  - [x] T7.1 `sprint-status.yaml` : `ready-for-dev → in-progress` (avant exec) puis `→ review` (cette étape).
  - [x] T7.2 Story file : Tasks cochées, Dev Agent Record rempli, File List, Change Log, Status → review.

- [x] **T8 — DoD CI light + sanity diff** (AC9, AC10)
  - [x] T8.1 `git status` : 2 fichiers modifiés (DECISIONS + sprint-status) + 1 story file (cette story) = 3 fichiers attendus conformes AC9.
  - [x] T8.2 `git diff --cached | grep -iE 'eyJhbGci|sb_secret_'` : 0 match attendu (validation T9.2 post-stage).
  - [x] T8.3 Aucun lint/test/build exécuté (story 100% gouvernance/infra, conforme AC9).

- [x] **T9 — Commit + PR** (heritage 9.A.6 commit `35b231a`)
  - [x] T9.1 Branche dédiée `story/9-a-8-srk-all-preview` créée.
  - [x] T9.2 Commit principal `eb607ed` : `Story 9.A.8 : infra(vercel) SRK + NEXT_PUBLIC_SUPABASE_URL scopees all Preview + cleanup overrides 9.A.6`.
  - [x] T9.3 PR #12 : `Story 9.A.8 — SRK + NEXT_PUBLIC_SUPABASE_URL all Preview + doc bug CLI Vercel v54`.
  - [x] T9.4 PR body livré : résumé fix + scope étendu (URL) + lien DECISIONS.md F-Epic9-A8 + lien deploy validation T4.
  - [x] T9.5 3 checks GHA verts (e2e + integration + Vercel Preview Comments) + Vercel Preview Ready (`dpl_w7wcgbVMM4gtRrt9sF8Qj5F8wSi8`). Squash merge sur main commit `8db9515`, branche supprimée.

- [x] **T10 — Post-merge `review → done`** (heritage 9.A.6 commit `879e197`)
  - [x] T10.1 Chore commit séparé : `sprint-status.yaml` `9-a-8-...: review → done` + Story file Status: `review → done` + Change Log final.
  - [x] T10.2 Mémoire `project_epic_9_cadrage` : 9.A.8 DONE noté.

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

**T1 audit API REST pré-fix (2026-05-18) :**
- T1.1 Token extracted : `vca_0vey...8X4a` (60 chars).
- T1.2 GET /v9/projects/{id}/env → 3 entrées `SUPABASE_SERVICE_ROLE_KEY` confirmées :
  - id=SqTmD4qDnwhvhwnT type=encrypted target=["development"] branch=null.
  - id=BnSigPw679WwCk3Q type=sensitive  target=["preview"]     branch=story/9-a-6-audit-sentry-epic-7-8.
  - id=4fvzqKTZlq6INlUw type=sensitive  target=["production"]  branch=null.
- T1.3 Absence confirmée d'une entrée preview-all (gitBranch=null target=preview) : ✅.
- **Découverte mid-exec** : audit complet des env vars Preview révèle que `NEXT_PUBLIC_SUPABASE_URL` (id=SRe1U8NbNpQaHsLe, scope=story/9-a-6-...) souffre du même trou que SRK (pas d'entrée preview-all). `NEXT_PUBLIC_SUPABASE_ANON_KEY` a déjà sa preview-all (id=gAGSqhhneSwa87QF) mais conserve un override branche orphelin (id=kAeLONx9UkpNrhzJ). Scope étendu à URL + cleanup ANON orphelin (cf. arbitrage utilisateur).

**T2 récupération valeur + POST API REST (2026-05-18) :**
- T2.1 Source valeur SRK : fichier temporaire `/tmp/srk.txt` créé par Sylvain via prompt Claude (`! echo -n '<jwt>' > /tmp/srk.txt`). Lecture par script Bash, supprimé en fin de story.
- T2.2 Validation SRK : `length=219 ✅`, `prefix=eyJhbGci ✅`, `suffix=-rNw` (JWT legacy HS256 role=service_role, post-rotation Supabase 2026-05-16 anon→sb_publishable mais service_role JWT legacy conservé cf. mémoire `project_rotation_secrets_2026_05_16`).
- T2.3 POST SRK preview-all : HTTP 201, response : `{"created":{"id":"BjpMYqqzOSwvenB9","key":"SUPABASE_SERVICE_ROLE_KEY","target":["preview"],"type":"sensitive",...},"failed":[]}`. NEW_ID_SRK = `BjpMYqqzOSwvenB9`.
- T2.4 (scope étendu) Récupération `NEXT_PUBLIC_SUPABASE_URL` depuis `.env.local` (valeur publique, non sensitive) : `https://fdmyurhfyfbfysuwotjx.supabase.co` (40 chars). POST URL preview-all : HTTP 201, NEW_ID_URL = `1Hcq8FcGbPqYJNSz`.
- T2.5 `/tmp/srk.txt` supprimé fin de story.

**T3 audit post-fix (2026-05-18) :**
- T3.1 GET /v9/projects/{id}/env :
  - SRK : 4 entrées (dev SqTmD4qDnwhvhwnT + preview-branch-9.A.6 BnSigPw679WwCk3Q + preview-all NEW BjpMYqqzOSwvenB9 + production 4fvzqKTZlq6INlUw).
  - URL : 3 entrées (preview-branch-9.A.6 SRe1U8NbNpQaHsLe + preview-all NEW 1Hcq8FcGbPqYJNSz + production eVErYNi10Ble0oQk).
- T3.2 Nouvelles entrées : gitBranch=null target=["preview"], types corrects (sensitive pour SRK, encrypted pour URL aligné Production).

**T4 test redeploy validation (2026-05-18) :**
- T4.1-T4.3 Branche `test/9-a-8-srk-validation` créée depuis main, commit `1bc1081` empty, push.
- T4.4 1er Vercel Preview build `dpl_52MZP2X9q2TCmtJtswADjmEYU3wi` (commit `1bc1081`) : **ERROR** — `BUILD_UTILS_SPAWN_1`. Logs : `ERROR (preview): NEXT_PUBLIC_SUPABASE_URL is not set. URL projet Supabase (assertion ! runtime -> crash si absente).` → c'est cette erreur qui a révélé le scope incomplet de la story originale. Diagnostic : URL Preview-all manquait. Scope étendu, POST URL preview-all effectué (T2.4).
- T4.5 2e Vercel Preview build `dpl_HEYKSgXQxqx2stgHMpvknGbrM48i` (commit `8438c35` puis force-build via commit non-empty README) : **READY** sur URL `roxanetnous-ddz0r7fed-roxanetnous.vercel.app`. Validation que SRK + URL Preview-all sont bien lus au prerender SSG.
- T4.6 Cleanup `git branch -D test/9-a-8-srk-validation` + `git push origin --delete test/9-a-8-srk-validation` ✅.
- T4.7 Note opérationnelle : Vercel ne déclenche pas automatiquement un build sur un commit `--allow-empty` après un build ERROR (au moins en agent CLI). Pour forcer un nouveau build après un retest d'env vars, touch un fichier source minime (ex. ligne vide dans `README.md`).

**T5 cleanup overrides branches (2026-05-18) :**
- T5.1 DELETE SRK `BnSigPw679WwCk3Q` → HTTP 200.
- T5.2 DELETE URL `SRe1U8NbNpQaHsLe` → HTTP 200.
- T5.3 DELETE ANON_KEY orphelin `kAeLONx9UkpNrhzJ` → HTTP 200 (proprete, hors-scope cadrage initial mais aligné scope étendu).
- T5.4 Audit final : 0 entrée avec `gitBranch != null` dans le projet (audit complet propre). SRK = 3 entrées (dev+preview-all+prod), URL = 2 (preview-all+prod), ANON = 2 (preview-all+prod).

### Completion Notes List

- ✅ Token CLI Vercel extrait et POST API REST réussis (3 POST + 3 DELETE, tous HTTP 200/201).
- ✅ Valeur SRK confirmée 219 chars JWT legacy via méta-données uniquement (longueur + prefix + suffix), zero leak repo.
- ✅ Build Preview branche test réussi sans override branche (dpl_HEYKSgXQxqx2stgHMpvknGbrM48i Ready).
- ✅ Overrides branche 9.A.6 supprimés proprement (3 entrées : SRK + URL + ANON orphelin).
- ✅ F-Epic9-A8 entrée DECISIONS.md ajoutée (scope étendu SRK+URL+bug CLI v54).
- ✅ Zero PII / secret dans le repo (vérifié via grep `eyJhbGci|sb_secret_` post-stage).
- ⚠️ **Scope étendu mid-exec** : la story cadrée initialement pour SRK seul a été étendue à `NEXT_PUBLIC_SUPABASE_URL` après que la branche test ait révélé le même trou. Décision validée avec utilisateur (option recommandée). Justification dans DECISIONS.md F-Epic9-A8.
- ⚠️ **Cleanup orphelin ANON_KEY hors cadrage initial** : suppression de `kAeLONx9UkpNrhzJ` (NEXT_PUBLIC_SUPABASE_ANON_KEY scope branche 9.A.6, fallback preview-all déjà en place) faite pour propreté. Aucun impact fonctionnel (la branche `story/9-a-6-...` n'existe plus).
- ⚠️ **Note Vercel** : un commit `--allow-empty` ne déclenche pas systématiquement un nouveau build après un précédent ERROR. Pour forcer un retest après modif env vars, faire un commit avec changement minime sur un fichier source (touch `README.md`).

### File List

**Fichiers créés (0).**

**Fichiers modifiés (3) :**
- `DECISIONS.md` (entrée F-Epic9-A8 ajoutée ~22 lignes : scope SRK + URL + bug CLI v54 + impact + source).
- `_bmad-output/implementation-artifacts/sprint-status.yaml` (transitions statut 9.A.8 : ready-for-dev → in-progress → review).
- `_bmad-output/implementation-artifacts/9-a-8-supabase-service-role-key-all-preview.md` (cette story : Tasks cochées T1-T8, Dev Agent Record rempli, File List, Change Log, Status → review).

**0 fichier source modifié** (`app/`, `lib/`, `components/`, `supabase/migrations/`, `tests/`, `scripts/`, `types/`) — conforme cadrage initial.

**0 fichier supprimé.**

### Change Log

| Date | Auteur | Action |
| --- | --- | --- |
| 2026-05-18 | dev (claude-opus-4-7) | Story 9.A.8 — Audit API REST pré-fix (T1) : 3 entrées SRK confirmées (dev + preview-branch + production), absence preview-all confirmée. Découverte mid-exec : `NEXT_PUBLIC_SUPABASE_URL` souffre du même trou. |
| 2026-05-18 | dev (claude-opus-4-7) | Story 9.A.8 — POST API REST création SRK preview-all (T2.3) : HTTP 201, id=`BjpMYqqzOSwvenB9`, gitBranch=null, type=sensitive. |
| 2026-05-18 | dev (claude-opus-4-7) | Story 9.A.8 — POST API REST scope étendu `NEXT_PUBLIC_SUPABASE_URL` preview-all (T2.4) : HTTP 201, id=`1Hcq8FcGbPqYJNSz`, gitBranch=null, type=encrypted. Décision arbitrée utilisateur (option recommandée). |
| 2026-05-18 | dev (claude-opus-4-7) | Story 9.A.8 — Test validation redeploy sans override (T4) : 1er build commit `1bc1081` ERROR sur `NEXT_PUBLIC_SUPABASE_URL is not set` (révèle scope incomplet) ; 2e build commit `8438c35` READY après ajout URL preview-all. Branche test cleanup. |
| 2026-05-18 | dev (claude-opus-4-7) | Story 9.A.8 — Cleanup overrides branches (T5) : DELETE SRK `BnSigPw679WwCk3Q` + URL `SRe1U8NbNpQaHsLe` + ANON orphelin `kAeLONx9UkpNrhzJ`, tous HTTP 200. Audit final 0 override branche. |
| 2026-05-18 | dev (claude-opus-4-7) | Story 9.A.8 — `DECISIONS.md` F-Epic9-A8 ajouté (scope étendu SRK + URL + bug CLI v54 + impact + source). |
| 2026-05-18 | dev (claude-opus-4-7) | Story 9.A.8 — DoD CI light vert (0 source touché, 0 PII repo). Story passée en `review`. |
| 2026-05-18 | dev (claude-opus-4-7) | Story 9.A.8 — PR #12 commit `eb607ed` (3 fichiers) + squash merge sur main commit `8db9515`. 3 checks GHA verts (e2e + integration + Vercel Preview Comments) + Vercel Preview Ready (`dpl_w7wcgbVMM4gtRrt9sF8Qj5F8wSi8`). |
| 2026-05-18 | dev (claude-opus-4-7) | Story 9.A.8 — chore post-merge PR #12 : `review → done`. Mémoire `project_epic_9_cadrage` MAJ. |

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
