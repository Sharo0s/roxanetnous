# Supabase local roxanetnous

Stack Supabase locale pour developpement + tests d'integration backend (story 4.4 / DECISIONS F8) + seeds reproductibles (story 4.7 / DECISIONS F9).

## Setup local

```bash
brew install supabase/tap/supabase
supabase start
npm run seed:test
```

Apres `supabase start` :
- Postgres : `localhost:54322`
- API REST : `http://localhost:54321`
- Studio : `http://localhost:54323`

Pour recuperer les cles : `supabase status --output json | jq '.SERVICE_ROLE_KEY, .ANON_KEY'`.

## Architecture migrations

53 fichiers `.sql` dans `supabase/migrations/`. Couvre l'historique complet du projet :

- **2026-02-16 -> 2026-04-09** : 27 migrations brownfield Epic 1 (recuperees via Supabase MCP story 4.7 le 2026-05-09 ; le projet a ete livre retroactivement avant adoption BMad formelle, le schema initial n'avait jamais ete capture en migration formelle).
- **2026-04-18 -> 2026-04-29** : Epic 2 (parrainage + a11y + admin conversations).
- **2026-05-02 -> 2026-05-07** : Epic 3 (departements_ouverts + waitlist) + Epic 4.2 (notifications_log schema).

Drift versioning vs prod connu : la prod utilise des versions Supabase Cloud (`20260418140024_drop_avis_feature`), le repo local utilise un schema custom (`20260418135719_drop_avis_feature`). Les noms et le contenu sont alignes ; le drift est documente dans DECISIONS.md F9.

## Seeds

`supabase/seeds/` contient 4 fichiers SQL avec UUID fixes pour reproductibilite cross-runs :

- `01_users.sql` : 5 users (admin + accompagnante validee + accompagne + marraine + filleule).
- `02_parrainages.sql` : code marraine + 1 parrainage en cours + 1 parrainage bloque (anti-fraude `meme_carte`).
- `03_waitlist.sql` : 5 inscriptions Bretagne (29/22/35/56).
- `04_subscriptions.sql` : 1 active future + 1 active expiree (T8/T9 paywall).

Le script `scripts/seed-test-supabase.mjs` orchestre :
1. Cree les users dans `auth.users` via `supabase.auth.admin.createUser({ id, user_metadata: { role } })` (le trigger `handle_new_user` cree auto les rows `public.users` + profil correspondant).
2. Applique les 4 fichiers SQL via `pg` client (UPDATE pour enrichir les champs metier + INSERT pour les rows annexes).

```bash
npm run seed:test          # Apply (idempotent ON CONFLICT DO NOTHING)
npm run seed:test:reset    # Cleanup avant re-apply (FK-safe)
```

## Convention seeds

- **UUID fixes** `'00000000-0000-0000-0000-00000000000X'` pour les users + ranges `aaaX/bbbX/cccX` pour les rows annexes. Reproductible cross-runs.
- **Garde-fou anti-prod** : refus categorique si `SUPABASE_URL` n'est pas `localhost`/`127.0.0.1` (pattern aligne sur `tests/integration/setup.ts` D4).
- **Idempotence** : tous les seeds utilisent `ON CONFLICT DO NOTHING` pour permettre re-runs sans casse.
- **Distinction seeds vs fixtures** : les **fixtures inline** (`tests/integration/_lib/fixtures.ts`) sont souveraines pour les 14 tests story 4.4 (controle precis row-by-row + cleanup tracker). Les **seeds** servent les futures stories Epic 5+ qui voudront un dataset stable sans dupliquer des fixtures.

## Troubleshooting

### `supabase start` echoue avec ports en conflit
```bash
supabase stop --no-backup
supabase start
```

### Les tests d'integration crashent avec "users_pkey duplicate"
Le trigger `handle_new_user` cree deja une row `public.users` lors de `auth.admin.createUser`. Les helpers `createTestUser` (story 4.4) doivent UPDATE et non INSERT. Pattern documente dans `tests/integration/_lib/fixtures.ts` (commentaire D5).

### Cleanup BDD apres run echoue
`npm run seed:test:reset` ou via SQL :
```sql
DELETE FROM public.parrainages WHERE id LIKE '00000000-0000-0000-0000-00000000aaa%';
DELETE FROM public.parrainages_codes WHERE code = 'TESTSEED1';
DELETE FROM public.waitlist_departements WHERE email LIKE 'seed-waitlist-%@test.local';
DELETE FROM public.subscriptions WHERE id LIKE '00000000-0000-0000-0000-00000000ccc%';
-- auth.users : utiliser supabase.auth.admin.deleteUser pour cascade public.users
```

### Drift versioning local vs prod
Si `supabase migration list --local` ne correspond pas a `--remote`, c'est attendu : 27 migrations brownfield ont des versions locales differentes (alignement par nom, pas par version). Voir DECISIONS F9.

## Extension future

- **Nouvelle migration** : `supabase migration new <nom>` puis ecrire le SQL. Verifier `supabase start` reussit en local avant push.
- **Nouveau seed** : ajouter un fichier `supabase/seeds/05_xxx.sql`, l'inclure dans `SEED_FILES` de `scripts/seed-test-supabase.mjs`, ajouter le DELETE correspondant dans la fonction `reset` du script.
- **Pattern interdit** : modifier le SQL des migrations historiques (pas de cleanup retroactif). Modifier le schema prod via `apply_migration` (toute future story BDD doit creer migration formelle locale d'abord, puis appliquer en prod via Supabase Cloud dashboard ou CLI une fois review). Voir DECISIONS F9.
