# Audit GHA stabilisation 7 jours — Story 4.4 + 4.7

**Periode :** 2026-05-09 -> 2026-05-16

**Source de verite CI :** workflow `Integration Tests` (`.github/workflows/integration-tests.yml`).

**Critere succes :** zero flaky observe (faux echec puis re-run vert) sur 7 jours. Si > 5 % flaky -> ouvrir story 4.4.b stabilisation.

## Baseline initiale (post-livraison)

| Run ID | Date | Trigger | Conclusion | Notes |
| --- | --- | --- | --- | --- |
| 25502322720 | 2026-05-07 14:32 | workflow_dispatch | failure | Iter 1 : `supabase start` crash signalements (debloquage 4.7) |
| 25504037262 | 2026-05-07 15:02 | workflow_dispatch | failure | Iter 2 : collision policy rate_limit_tracker_deny_all |
| 25504254229 | 2026-05-07 15:06 | workflow_dispatch | failure | Iter 3 : createTestUser duplicate key (trigger handle_new_user) |
| 25504550400 | 2026-05-07 15:12 | workflow_dispatch | failure | Iter 4 : 12/14 verts (T2 anon key + T10 XOR) |
| 25504890455 | 2026-05-07 15:18 | workflow_dispatch | **success** | **14/14 verts (sans seeds)** |
| 25505618623 | 2026-05-07 15:31 | workflow_dispatch | **success** | **14/14 verts (avec seeds)** |
| 25507176496 | 2026-05-07 16:00 | workflow_dispatch | **success** | **14/14 verts (post code review patches)** |

**Stabilisation atteinte au run 25504890455. Baseline : 3 runs consecutifs verts.**

## Audit quotidien 7 jours

Commande pour lister les runs du jour :
```bash
gh run list --workflow=integration-tests.yml --limit=10 --json databaseId,conclusion,createdAt,event,headSha
```

Critere flaky : run echoue sur un commit qui a ensuite passe vert sans modification (re-run vert sur meme SHA).

### Jour 1 — 2026-05-10

- [x] Audit runs : 1 total / 1 success / 0 failure
- [x] Flaky observe : non
- **Run heartbeat manuel** : `25633979881` 2026-05-10 16:34 UTC (success en ~3 min, SHA `3036588a2f9ffb1dd0a7a911f5bcc1cccd24d397` = HEAD main post-retro Epic 4). Tous les steps verts dont `Apply test seeds` et `Run integration tests`.
- **Observation methodologique** : le workflow `integration-tests.yml` se declenche uniquement sur `pull_request` (branches main) ou `workflow_dispatch` manuel. Les commits Epic 4 ont ete pousses directement sur main sans PR (`gh pr list --state all` -> 0 PR), donc aucune execution automatique. Strategie d'audit retenue : **heartbeat manuel jours 1/3/5/7** via `gh workflow run integration-tests.yml --ref main` pour produire 4 points de mesure independants sur la fenetre.
- Prochain heartbeat : Jour 3 = 2026-05-12.
- Derniere baseline reference : run `25507176496` 2026-05-07 16:00 UTC (success) sur SHA `6beac3a4969d839ff755eb72712993c6c07a5917`.

### Jour 2 — 2026-05-11

- [ ] Audit runs : ___ total / ___ success / ___ failure
- [ ] Flaky observe : oui/non

### Jour 3 — 2026-05-12

- [ ] Audit runs : ___ total / ___ success / ___ failure
- [ ] Flaky observe : oui/non

### Jour 4 — 2026-05-13

- [ ] Audit runs : ___ total / ___ success / ___ failure
- [ ] Flaky observe : oui/non

### Jour 5 — 2026-05-14

- [ ] Audit runs : ___ total / ___ success / ___ failure
- [ ] Flaky observe : oui/non

### Jour 6 — 2026-05-15

- [ ] Audit runs : ___ total / ___ success / ___ failure
- [ ] Flaky observe : oui/non

### Jour 7 — 2026-05-16

- [ ] Audit runs : ___ total / ___ success / ___ failure
- [ ] Flaky observe : oui/non
- [ ] **Decision finale** : zero flaky -> succes, branch protection rule durcie au max ; > 5 % flaky -> story 4.4.b ouverte

## Echappatoire disponible

Si un test critique flaky bloque un merge urgence, le workflow expose `workflow_dispatch.inputs.skip='true'` pour bypasser temporairement :
```bash
gh workflow run integration-tests.yml --ref <branch> -f skip=true
```
A documenter sur la PR concernee (raison + commit du re-run sans skip apres fix).

## Resultat final (a remplir 2026-05-16)

- **Total runs sur 7j :** ___
- **Success rate :** ___ %
- **Flaky rate :** ___ %
- **Decision :** [ ] Stabilise (succes) / [ ] Story 4.4.b ouverte (echec)
