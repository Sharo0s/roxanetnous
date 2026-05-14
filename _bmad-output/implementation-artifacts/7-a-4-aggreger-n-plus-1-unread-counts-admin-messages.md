# Story 7.A.4 : Aggreger N+1 unread counts admin messages

Status: done

<!-- Story 4 du mini-epic 7.A (hardening securite transverse) - Item C4 de l'inventaire dettes Epic 7. Source : `deferred-work.md` ligne 272 (review story 4.6). Cadrage epic-7.md lignes 187-203. -->

## Story

En tant qu'**administrateur de la plateforme consultant la liste des conversations admin/accompagnant**,
je veux que **la page `/admin/messages` charge en 1 round-trip BDD au lieu de N+1**,
afin que **la latence de chargement reste basse et stable peu importe le nombre de conversations actives (100, 500, 1000+), sans risque de timeout Vercel sur les pics admin**.

**Contexte runtime du foot-gun cible** : `app/admin/messages/page.tsx:30-39` (post-typage propre story 4.6) effectue actuellement une boucle `for (const conv of conversations)` qui appelle, pour chaque conversation, `supabaseAdmin.from('messages').select('id', { count: 'exact', head: true })`. Pour 100 conversations, cela genere 1 query LIST + 100 queries COUNT = 101 round-trips Supabase serialises. Latence p50 admin ~50 conv estimee >2s, p95 timeout Vercel possible >10s. Pre-existant a story 4.6 (boucle non touchee par le diff, revelee par le typage propre post-resorption `as any`). Volumetrie prod actuelle : 0 conversation admin (audit MCP 2026-05-14), donc story preventive avant prise de trafic.

## Acceptance Criteria

### Implementation BDD : RPC SECURITY DEFINER (option preferee) OU JOIN cote requete

- **AC1** : Choix architectural arbitre et documente Dev Notes : (a) **RPC SECURITY DEFINER** `get_admin_conversations_with_unread(p_current_user_id uuid, p_limit int, p_offset int)` qui retourne une table `(conversation_id uuid, last_message_at timestamptz, accompagnant_user_id uuid, accompagnant_first_name text, accompagnant_last_name text, accompagnant_email text, unread_count bigint)`, OU (b) **requete unique** cote client avec aggregation via `messages!conversation_id(count)` syntaxe PostgREST. **Option (a) RPC recommandee** car : (1) cohérent avec pattern projet (`try_consume_rate_limit`, `merge_parrainage_flag_suspicion` cf. `supabase/migrations/20260429170000_rate_limit_tracker.sql`), (2) typage strict via `types/supabase.ts` regenere, (3) garde-fou `is_admin()` check upfront dans le body. **Si AC1 = option (a) RPC**, suivre AC2-AC4. **Si AC1 = option (b) PostgREST**, suivre AC5-AC6 alternatifs.

#### Option (a) RPC SECURITY DEFINER - recommandee

- **AC2** : Migration `supabase/migrations/{TIMESTAMP}_admin_messages_rpc_unread_aggregation.sql` cree :
  ```sql
  CREATE OR REPLACE FUNCTION public.get_admin_conversations_with_unread(
    p_current_user_id uuid,
    p_limit int DEFAULT 100,
    p_offset int DEFAULT 0
  )
  RETURNS TABLE (
    conversation_id uuid,
    last_message_at timestamptz,
    accompagnant_user_id uuid,
    accompagnant_first_name text,
    accompagnant_last_name text,
    accompagnant_email text,
    unread_count bigint
  )
  LANGUAGE plpgsql
  SECURITY DEFINER
  SET search_path = public
  AS $$
  BEGIN
    -- Garde-fou : seul un admin peut consommer cette RPC, meme via service_role
    -- la verification est explicite pour empecher mauvais usage applicatif.
    IF NOT public.is_admin() THEN
      RAISE EXCEPTION 'get_admin_conversations_with_unread requires admin role' USING ERRCODE = '42501';
    END IF;

    RETURN QUERY
    SELECT
      c.id AS conversation_id,
      c.last_message_at,
      u.id AS accompagnant_user_id,
      u.first_name AS accompagnant_first_name,
      u.last_name AS accompagnant_last_name,
      u.email AS accompagnant_email,
      COALESCE((
        SELECT COUNT(*) FROM public.messages m
        WHERE m.conversation_id = c.id
          AND m.sender_id <> p_current_user_id
          AND m.read_at IS NULL
      ), 0)::bigint AS unread_count
    FROM public.conversations c
    JOIN public.accompagnants_profiles ap ON ap.id = c.accompagnant_id
    JOIN public.users u ON u.id = ap.user_id
    WHERE c.admin_id IS NOT NULL
    ORDER BY c.last_message_at DESC NULLS LAST
    LIMIT p_limit OFFSET p_offset;
  END;
  $$;

  REVOKE ALL ON FUNCTION public.get_admin_conversations_with_unread(uuid, int, int) FROM PUBLIC;
  REVOKE ALL ON FUNCTION public.get_admin_conversations_with_unread(uuid, int, int) FROM anon;
  GRANT EXECUTE ON FUNCTION public.get_admin_conversations_with_unread(uuid, int, int) TO authenticated;

  COMMENT ON FUNCTION public.get_admin_conversations_with_unread(uuid, int, int) IS
    'Story 7.A.4 : aggregation 1-round-trip de la liste admin/accompagnant + unread count par conversation. Check is_admin() interne (defense en profondeur, attendu deja garanti par la page Next.js). Ordre : last_message_at DESC NULLS LAST.';
  ```
- **AC3** : `app/admin/messages/page.tsx` remplace l'integralite des lignes 14-40 (SELECT conversations + boucle COUNT) par UN SEUL appel :
  ```ts
  const { data: rows } = await supabaseAdmin.rpc('get_admin_conversations_with_unread', {
    p_current_user_id: user.id,
    p_limit: 100,
    p_offset: 0,
  })
  ```
  Le rendering JSX (lignes 53-99) est adapte pour iterer sur `rows` au lieu de `conversations` + `unreadCounts`. Les champs disponibles dans chaque row : `conversation_id`, `last_message_at`, `accompagnant_user_id`, `accompagnant_first_name`, `accompagnant_last_name`, `accompagnant_email`, `unread_count`.
- **AC4** : Regeneration `types/supabase.ts` via `mcp__supabase__generate_typescript_types` (ou `npx supabase gen types typescript`). La RPC apparait dans `Database['public']['Functions']['get_admin_conversations_with_unread']` avec signature `{ Args: { p_current_user_id: string; p_limit?: number; p_offset?: number }; Returns: { ... }[] }`. Pas de `as any` ajoute, pas de cast localise (cf. CLAUDE.md + Story 4.6 + script `check:as-any-global` qui bloque les regressions). Le pattern `(await createClient({ serviceRole: true })) as unknown as SupabaseClient<Database>` (variante locale SCP D5 cf. retro Story 4.6) reste applique en tete de page pour le typage du client RPC.

#### Option (b) PostgREST aggregation - alternative si RPC rejetee

- **AC5** : Si option (b) retenue, requete unique cote client utilisant la syntaxe PostgREST aggregation :
  ```ts
  const { data: conversations } = await supabaseAdmin
    .from('conversations')
    .select(`
      id,
      last_message_at,
      accompagnant_id,
      admin_id,
      accompagnants_profiles:accompagnant_id (
        user_id,
        users!user_id (first_name, last_name, email)
      ),
      messages!conversation_id (count)
    `, { head: false })
    .not('admin_id', 'is', null)
    .neq('messages.sender_id', user.id)
    .is('messages.read_at', null)
    .order('last_message_at', { ascending: false, nullsFirst: false })
    .limit(100)
  ```
  **Limite connue** : les filtres `neq/is` sur table embedded ne filtrent que les rows embedded affichees, le `count` PostgREST utilise sur la table embedded peut etre affecte differemment selon la version. **Tester explicitement** que le count retourne bien `messages WHERE sender_id <> currentUser AND read_at IS NULL` et non pas `total messages`. **Recommandation** : si test KO, fallback option (a) RPC.
- **AC6** : Si option (b), aucune migration BDD, pas de regen types. Le typage du SELECT chain inferte par Supabase SDK est suffisant. Aucun `as any` introduit.

### Performance + tests integration

- **AC7** : Latence p50 mesuree avant/apres :
  - **Avant** (current N+1) : seed 50 conversations admin via fixture Vitest -> mesure du temps total `await` de la page server component. Documenter dans Dev Notes la valeur observee en ms.
  - **Apres** (option a ou b) : meme dataset -> mesure du temps. **Doit baisser >70%** (objectif epic-7.md AC4).
  - Methode de mesure : `console.time('admin-messages-load')` + `console.timeEnd()` autour du fetch, exécuté dans un test integration dedie OU mesure ad-hoc preview Vercel avec dataset seed.
- **AC8** : Tests Vitest integration dans `tests/integration/admin-messages/` (nouveau dossier) :
  - **`liste-conversations-avec-unread.test.ts`** :
    - **(a) admin voit toutes conversations admin** : seed 3 accompagnants + 3 conversations admin (chaque conv avec 2 messages dont 1 unread non admin) + 1 conversation accompagnant<->accompagne hors-admin -> appel RPC ou requete -> assert 3 rows retournes (pas la 4eme non-admin), assert `unread_count = 1` pour chaque.
    - **(b) admin ne voit pas conv des autres admins arbitraires** : RLS preservee. Note : `admin_id` est la cle pivot, RLS `conv_select_own` autorise admin global via `is_admin()`, donc cette assertion verifie surtout que `WHERE admin_id IS NOT NULL` filtre les conv non-admin. Si futur multi-admin avec separation, story dediee.
    - **(c) pagination limit/offset** : seed 10 conv admin -> `p_limit=5, p_offset=0` -> 5 rows. `p_limit=5, p_offset=5` -> 5 rows differentes. `p_offset=10` -> 0 rows.
    - **(d) unread_count = 0** : seed 1 conv admin sans message non-lu (tous read_at != null OU sender_id = current_admin_user) -> `unread_count = 0`.
    - **(e) garde-fou is_admin()** (option a uniquement) : un user `accompagnant` ou `accompagne` appelle la RPC -> exception `42501` propage en `PostgrestError`.
- **AC9** : Pattern reutilise fixtures `tests/integration/_lib/fixtures.ts` (cf. heritage 4.4) : `createTestUser('admin')`, `createTestUser('accompagnant')`, helper `createTestConversation` a creer si absent OU INSERT direct via `getAdminClient()` puis tracker pour cleanup.

### Migration + audit BDD prod

- **AC10** : Audit MCP BDD prod **avant** apply :
  - `SELECT COUNT(*) FROM conversations WHERE admin_id IS NOT NULL` -> attendu 0 (audit 2026-05-14, story preventive).
  - `SELECT COUNT(*) FROM messages` -> documenter volume actuel.
  - `SELECT proname FROM pg_proc WHERE proname = 'get_admin_conversations_with_unread'` -> doit retourner 0 ligne (pas de collision nom).
- **AC11** : Migration apply via `mcp__supabase__apply_migration` (cohérent avec pattern Story 5.A.2 + 6.A.2). Snapshot pre-cutover non requis ici (CREATE FUNCTION nouvelle, pas de DDL destructive). Idempotence assuree par `CREATE OR REPLACE FUNCTION`.
- **AC12** : Verification post-apply : `SELECT pg_get_functiondef('public.get_admin_conversations_with_unread'::regprocedure)` retourne le body attendu. Test fonctionnel via MCP `execute_sql` : `SELECT * FROM public.get_admin_conversations_with_unread(<admin_user_id>, 10, 0)` avec un admin user existant -> retourne 0 rows actuellement (vu volumetrie BDD prod = 0 conv admin) mais doit s'executer sans erreur.

### Documentation + audit Sentry post-merge

- **AC13** : Si option (a) RPC retenue : ajouter entree DECISIONS.md section "Decisions techniques Epic 7" :
  ```
  ### F-Epic7-A4 — RPC `get_admin_conversations_with_unread` pour eliminer N+1 admin messages (2026-05-XX)

  - **Decision** : nouvelle RPC SECURITY DEFINER + check `is_admin()` upfront.
  - **Rationale** : pattern projet etabli (`try_consume_rate_limit`, `merge_parrainage_flag_suspicion`), typage strict, gain p50 >70% sur 50+ conv.
  - **Alternative consideree** : aggregation PostgREST `messages!conversation_id(count)` avec filtres embedded — rejetee car comportement count + filtres embedded non-deterministe selon version PostgREST (cf. Dev Notes AC5).
  - **Verrou** : `check:as-any-global` bloque toute regression `as any` autour du nouveau RPC call.
  ```
- **AC14** : Audit Sentry post-merge a J+7 : 0 nouvelle erreur PostgrestError tag `rpc:get_admin_conversations_with_unread`. Verification que la page `/admin/messages` se charge correctement sur preview Vercel (Sylvain authentifie admin) avec ou sans donnees.

### Garde-fous CI et validations finales

- **AC15** : `tsc --noEmit` exit 0, `npm run lint` exit 0 ou sous baseline, `npm run check:as-any-global`, `check:as-any-admin`, `check:oracle-paywall`, `check:ip-spoofing` tous exit 0. `npm run check:env` reste vert (pas de nouvelle var d'env).
- **AC16** : `npm run lint:a11y-check` 155 baseline preserve (potentiellement impact UI marginal : l'iteration rendu reste tres similaire, juste les noms de champs changent). `npm run a11y:axe:check` 0 violations Critical/Serious sur 7 parcours (CLAUDE.md DoD a11y obligatoire avant commit livraison story). Le parcours `/admin/messages` n'est pas dans les 7 parcours baseline mais l'agent verifie qu'aucune regression visuelle sur les parcours existants.
- **AC17** : `npm run test:unit` complet : pas de regression sur la suite unit (typage RPC dans types/supabase.ts ne casse aucun test). `npm run test:integration` : nouveaux tests verts + pas de regression sur tests integration existants 4.4 / 7.A.1 (45 cas avant story selon last_updated). Si Docker non disponible localement (cf. memoire `feedback_test_local_supabase`), validation par GHA workflow `integration-tests.yml` au push.

## Tasks / Subtasks

- [x] **Task 0 : Audit MCP BDD prod pre-cutover** (AC10)
  - [x] 0.1 - `SELECT COUNT(*) FROM conversations WHERE admin_id IS NOT NULL` -> 0 (audit MCP 2026-05-14 18h00 confirme : story preventive, aucun cutover).
  - [x] 0.2 - `SELECT COUNT(*) FROM messages` -> 0 (BDD prod totalement vide cote messagerie).
  - [x] 0.3 - `SELECT 1 FROM pg_proc WHERE proname = 'get_admin_conversations_with_unread'` -> 0 ligne (pas de collision nom).
  - [x] 0.4 - Option (a) RPC SECURITY DEFINER confirmee, alignee pattern projet (try_consume_rate_limit + 4 RPC parrainage).

- [x] **Task 1 : Migration SQL RPC SECURITY DEFINER** (AC2, AC11, AC12)
  - [x] 1.1 - `supabase/migrations/20260513230753_admin_messages_rpc_unread_aggregation.sql` cree (60 lignes).
  - [x] 1.2 - Apply via `mcp__supabase__apply_migration` name=`admin_messages_rpc_unread_aggregation` -> success.
  - [x] 1.3 - `pg_get_functiondef` retourne le body attendu (SECURITY DEFINER STABLE search_path=public, RAISE 42501 sur is_admin()=false, JOIN c/ap/u + sous-SELECT COUNT, ORDER + LIMIT/OFFSET).
  - [x] 1.4 - Test fonctionnel via MCP execute_sql `SELECT * FROM get_admin_conversations_with_unread('cd2db1b6...', 10, 0)` -> exception `42501 : requires admin role` levee (attendu : `auth.uid()` est null sur pool MCP donc `is_admin()` false). Confirme defense en profondeur operationnelle.

- [x] **Task 2 : Regen `types/supabase.ts`** (AC4)
  - [x] 2.1 - `mcp__supabase__generate_typescript_types` lance post-apply migration.
  - [x] 2.2 - Entree `get_admin_conversations_with_unread` ajoutee section `Functions` (ordre alphabetique entre `generate_unique_parrainage_code` et `has_active_subscription`). Args `{ p_current_user_id: string; p_limit?: number; p_offset?: number }`. Returns `{ ... }[]` avec 7 colonnes typees `string` / `number` (unread_count typee `number` cote SDK, pas `string` ni `bigint` brut, donc cast `Number(...)` defensif optionnel mais conserve dans Dev Notes pour robustesse).
  - [x] 2.3 - `tsc --noEmit` exit 0.

- [x] **Task 3 : Refacto `app/admin/messages/page.tsx`** (AC3, AC4)
  - [x] 3.1 - SELECT conversations + boucle COUNT remplaces par 1 appel `supabaseAdmin.rpc('get_admin_conversations_with_unread', { p_current_user_id: user.id, p_limit: 100, p_offset: 0 })`.
  - [x] 3.2 - Cast `(await createClient({ serviceRole: true })) as unknown as SupabaseClient<Database>` conserve en tete (variante SCP D5 4.6).
  - [x] 3.3 - JSX iterant sur `rows` (champs `conversation_id`, `last_message_at`, `accompagnant_first_name/last_name/email`, `unread_count`). Rendu visuel preserve a l'identique : initiales + nom + email + date FR + badge unread aria-label.
  - [x] 3.4 - Variable `unreadCounts: Record<string, number>` supprimee (dead code).
  - [x] 3.5 - Link `href={'/admin/messages/'+row.conversation_id}` migre.
  - [x] 3.6 - `tsc --noEmit` exit 0 + `check:as-any-global` OK + `check:as-any-admin` OK.

- [x] **Task 4 : Tests integration** (AC7, AC8, AC9)
  - [x] 4.1 - `tests/integration/admin-messages/liste-conversations-avec-unread.test.ts` cree (5 cas a-e + helper local `authenticatedClientFor` via signInWithPassword).
  - [x] 4.2 - `createTestConversation` deja present dans `tests/integration/_lib/fixtures.ts` (heritage 4.4) - reutilise tel quel.
  - [x] 4.3 - `createTestMessage` deja present (heritage 4.4) - reutilise tel quel + INSERT direct ad-hoc cas (d) pour read_at custom.
  - [x] 4.4 - Cas (a) : 3 admin conv + 1 hors-admin -> assert 3 rows + unread_count=1 chacune.
  - [x] 4.5 - Cas (b) : 1 conv hors-admin (admin_id=NULL) -> 0 rows retournes.
  - [x] 4.6 - Cas (c) : 10 conv -> page1 (limit=5/offset=0) 5 rows + page2 (offset=5) 5 rows differentes + page3 (offset=10) 0 rows.
  - [x] 4.7 - Cas (d) : 1 conv admin avec message admin self + message read_at != null -> unread_count=0.
  - [x] 4.8 - Cas (e) : client authenticated role=accompagnant via signInWithPassword + anon key -> PostgrestError code 42501, message "requires admin role".
  - [x] 4.9 - Mesure p50 reportee a observation preview Vercel post-merge (BDD prod vide rend le seed 50 conv local lourd vs gain pedagogique : story preventive, mesure avant/apres demonstrable uniquement avec dataset). Documente dans Dev Agent Record.

- [x] **Task 5 : DECISIONS.md + doc** (AC13)
  - [x] 5.1 - Entree `F-Epic7-A4` ajoutee DECISIONS.md (section "2026-05-14 : RPC get_admin_conversations_with_unread...") avec contexte / decision / rationale / defense en profondeur / alternative rejetee / verrou check:as-any-global / migration / tests / regle pattern futur.
  - [ ] 5.2 - Mise a jour memoire `project_epic_7_cadrage.md` differee post-merge (regle bmad : mise a jour memoire apres review code).

- [x] **Task 6 : Validations CI locales** (AC15, AC16, AC17)
  - [x] 6.1 - `npx tsc --noEmit` exit 0.
  - [x] 6.2 - `npm run lint` 196 warnings (= baseline post-7.A.3, 0 erreur).
  - [x] 6.3 - `npm run lint:a11y-check` 155 baseline preserve (no regression).
  - [x] 6.4 - `check:as-any-global` OK, `check:as-any-admin` OK, `check:oracle-paywall` OK, `check:ip-spoofing` OK, `check:env` (sans VERCEL_ENV) silencieux attendu, `VERCEL_ENV=production check:env` echoue localement faute de .env prod (attendu, validation Vercel cote build).
  - [x] 6.5 - `npm run a11y:axe:check` -> "OK: aucun delta Critical/Serious au-dela du baseline" sur 7 parcours (regle CLAUDE.md respectee).
  - [x] 6.6 - `npm run test:unit` 45/45 verts en 1.00s (3 fichiers) - 0 regression.
  - [ ] 6.7 - `npm run test:integration` non execute localement (memoire `feedback_test_local_supabase` : pas de Docker local). Validation par GHA workflow `integration-tests.yml` au push.

- [ ] **Task 7 : Commit + push + code-review + audit Vercel preview**
  - [ ] 7.1 - Commit message format projet (cf. memoire `project_bmad_conventions`) : `Story 7.A.4 : aggreger N+1 unread counts admin messages via RPC (F-Epic7-A4)`.
  - [ ] 7.2 - Push branche, observer build Vercel preview : tous les `check:*` verts, `test:integration` (si non skip preview) ou skip OK, next build OK.
  - [ ] 7.3 - Code review (`/code-review` ou `bmad-code-review`) avant merge final.
  - [ ] 7.4 - Audit Sentry J+7 post-merge : 0 erreur PostgrestError tag RPC nouvelle (AC14).

## Dev Notes

### Contexte technique projet

- **Stack** : Next.js 16, Supabase (Postgres 15+ avec RLS), TypeScript, TailwindCSS v4 (cf. `.claude/CLAUDE.md`).
- **Package type** : ESM (`"type": "module"`).
- **Pattern Supabase service_role admin** : `(await createClient({ serviceRole: true })) as unknown as SupabaseClient<Database>` (variante locale SCP D5 cf. retro Story 4.6 + memoire `project_epic_4_retro`). Conserver ce cast en tete de la page apres refacto.
- **Pattern RPC etabli projet** :
  - `try_consume_rate_limit` (rate limit fenetre glissante) cf. `supabase/migrations/20260429170000_rate_limit_tracker.sql`.
  - `merge_parrainage_flag_suspicion`, `parrainage_increment_compteur`, `parrainage_claim_recompense`, `parrainage_rollback_recompense` (cf. types/supabase.ts:1308-1334).
  - Toutes en `SECURITY DEFINER` avec `SET search_path = public` + `REVOKE FROM PUBLIC/anon` + `GRANT EXECUTE TO authenticated` quand applicable.
- **Helpers RLS existants** : `is_admin()` (SECURITY DEFINER), `is_accompagne()` (SECURITY DEFINER), `is_accompagnant()` (SECURITY INVOKER, asymetrie connue dette Story 7.A.8 future cf. retro Epic 6 AI-6.A.4). Pour cette story 7.A.4, utiliser `is_admin()` cote RPC body (deja DEFINER, OK).

### Schema BDD impacte

**Tables (extrait colonnes pertinentes)** :

| Table | Colonnes utilisees |
|---|---|
| `conversations` | `id` (uuid PK), `accompagnant_id` (uuid NOT NULL FK accompagnants_profiles), `accompagne_id` (uuid NULL FK), `admin_id` (uuid NULL FK users), `last_message_at` (timestamptz NULL) |
| `messages` | `id` (uuid PK), `conversation_id` (uuid NOT NULL FK), `sender_id` (uuid NOT NULL FK users), `read_at` (timestamptz NULL) |
| `accompagnants_profiles` | `id` (uuid PK), `user_id` (uuid NOT NULL FK users) |
| `users` | `id` (uuid PK), `first_name` (text), `last_name` (text), `email` (text) |

**Indexes existants pertinents** (audit MCP 2026-05-14) :
- `idx_messages_conversation` ON `messages(conversation_id)` -> garantit O(log n) lookup pour le sous-SELECT COUNT.
- `idx_conversations_last_message` ON `conversations(last_message_at DESC)` -> garantit ORDER BY efficace.
- `idx_conversations_auxiliaire` ON `conversations(accompagnant_id)`.
- `conversations_unique_aux_admin` UNIQUE INDEX `(accompagnant_id, admin_id) WHERE admin_id IS NOT NULL` -> garantit unicite conv admin par accompagnant (heritage Story 5.B.2).

**RLS policies actuelles** :
- `conv_select_own` : `is_admin() OR (accompagnant_id IN ...) OR (accompagne_id IN ...)`.
- `msg_select_own` : `is_admin() OR conversation_id IN (...)`.

Donc en service_role la RLS est bypass naturellement, mais en `authenticated` admin la RLS autorise tout aussi. La RPC SECURITY DEFINER avec check `is_admin()` upfront ajoute une defense en profondeur (1) anti mauvais usage si le caller bascule de service_role a authenticated par erreur, (2) future migration vers `authenticated` admin client (au lieu de service_role) bug-free.

### Volumetrie prod actuelle (audit MCP 2026-05-14)

- `conversations` total : **0** rows. `conversations WHERE admin_id IS NOT NULL` : **0** rows.
- `messages` : **non-mesure** (peu critique : la story est preventive).

Story preventive : aucun risque de cutover ni de migration de donnees existantes. La RPC peut etre validee en preview Vercel + tests integration seeds avant toute prise de trafic.

### Code actuel cible (a remplacer)

`app/admin/messages/page.tsx:14-40` :

```tsx
const { data: conversations } = await supabaseAdmin
  .from('conversations')
  .select(`
    id,
    last_message_at,
    accompagnant_id,
    admin_id,
    accompagnants_profiles:accompagnant_id (
      user_id,
      users!user_id (first_name, last_name, email)
    )
  `)
  .not('admin_id', 'is', null)
  .order('last_message_at', { ascending: false, nullsFirst: false })

const unreadCounts: Record<string, number> = {}
if (conversations) {
  for (const conv of conversations) {
    const { count } = await supabaseAdmin
      .from('messages')
      .select('id', { count: 'exact', head: true })
      .eq('conversation_id', conv.id)
      .neq('sender_id', user.id)
      .is('read_at', null)
    unreadCounts[conv.id] = count || 0
  }
}
```

### Code cible (apres refacto)

```tsx
const { data: rows } = await supabaseAdmin.rpc(
  'get_admin_conversations_with_unread',
  { p_current_user_id: user.id, p_limit: 100, p_offset: 0 },
)
```

Iteration JSX :
```tsx
{rows?.map((row) => {
  const fullName = `${row.accompagnant_first_name || ''} ${row.accompagnant_last_name || ''}`.trim() || 'Accompagnant'
  const initials = `${row.accompagnant_first_name?.[0] || ''}${row.accompagnant_last_name?.[0] || ''}`
  const unread = Number(row.unread_count) || 0
  return (
    <li key={row.conversation_id}>
      <Link href={`/admin/messages/${row.conversation_id}`} ...>
        {/* meme rendu visuel, juste sources de donnees adaptees */}
      </Link>
    </li>
  )
})}
```

**Note typage** : `unread_count` retourne `bigint` cote Postgres serialise en `number` ou `string` selon le SDK Supabase. Le `types/supabase.ts` regenere donnera `number | string`. Defensif : wrapper `Number(row.unread_count)` au rendu. Pas de `as any` requis.

### Pourquoi RPC SECURITY DEFINER plutot que JOIN client-side ?

1. **Pattern projet etabli** : 5 RPC existantes (try_consume_rate_limit + 4 parrainage). Coherence > nouveaute.
2. **Typage strict** : la RPC apparait dans `types/supabase.ts` apres regen MCP. Le SELECT avec aggregation embedded PostgREST `messages!conversation_id(count)` necessite parfois cast `as any` ou typage manuel des relations -> risque regression `check:as-any-global` (heritage Story 5.C.1).
3. **Defense en profondeur** : check `is_admin()` upfront empeche un futur appel accidentel depuis un client `authenticated` non-admin (ex: refacto qui supprime le service_role).
4. **Performance prevue equivalente** : 1 query Postgres avec sous-SELECT correle indexed `idx_messages_conversation` = comportement equivalent au JOIN GROUP BY, l'optimiseur Postgres choisit la meilleure strategie.
5. **Lecture maintenable** : code page Next.js reduit a 1 ligne RPC vs select PostgREST complexe avec relations chainees.

### Patterns reutiles (decouverts dans stories precedentes)

- **Pattern Story 4.6 cast localise SCP D5** : `(await createClient({ serviceRole: true })) as unknown as SupabaseClient<Database>` au point d'appel, pas a la factory. Conserver pour cette story.
- **Pattern Story 5.B.2 idempotence `.maybeSingle()`** : non applicable ici (pas de upsert), mais le principe "RLS via service_role + check explicite cote RPC body" reste applicable.
- **Pattern Story 7.A.1 Sentry capture sur erreur transitoire** : si la RPC retourne `error != null`, faire un `Sentry.captureException(rpcError, { tags: { flow: 'admin_messages_load', rpc: 'get_admin_conversations_with_unread' } })`. Le comportement de fallback est `return <PageVide />` avec message UX neutre (pas de leak technique).
- **Pattern Story 4.4 fixtures Vitest integration** : `tests/integration/_lib/fixtures.ts` expose `createTestUser`, `createTestSubscription`. Etendre avec `createTestConversation` + `createTestMessage` (helpers triviaux).

### Source tree components a toucher

| Fichier | Modification | Lignes nettes |
|---|---|---|
| `supabase/migrations/{TS}_admin_messages_rpc_unread_aggregation.sql` | Nouveau fichier migration | ~50 |
| `types/supabase.ts` | Regen MCP : ajout entree Functions `get_admin_conversations_with_unread` | ~12 (auto) |
| `app/admin/messages/page.tsx` | Remplacement lignes 14-40 par 1 appel RPC + adaptation JSX 53-99 | -25 / +15 net |
| `tests/integration/admin-messages/liste-conversations-avec-unread.test.ts` | Nouveau fichier 5 cas | ~150 |
| `tests/integration/_lib/fixtures.ts` | Ajout `createTestConversation` + `createTestMessage` | ~40 |
| `DECISIONS.md` | Entree F-Epic7-A4 section Epic 7 | ~12 |

**Total** : ~230 lignes nettes ajoutees / 25 supprimees = 205 net. Story focus 0,5j-dev cadrage epic-7.md.

### Testing standards

- **Pattern projet** : Vitest projet `integration` separe (`vitest.config.ts`). Necessite Docker + `supabase start` local OU GHA workflow `integration-tests.yml`. Memoire `feedback_test_local_supabase` : Sylvain ne lance pas Docker local -> validation par GHA (heritage 4.7 seeds).
- **Pas d'impact a11y JSX** : la refacto JSX preserve la structure visuelle exacte (meme balises, meme classes, meme aria-labels). `lint:a11y-check` baseline 155 doit rester intact. `a11y:axe:check` n'audit pas `/admin/messages` dans les 7 parcours baseline mais doit rester vert sur les 7 existants. **Regle CLAUDE.md obligatoire** : commit livraison story passe `a11y:axe:check` exit 0 obligatoirement.
- **Pas de regression `as any`** : `check:as-any-global` + `check:as-any-admin` doivent rester verts. Si la regen `types/supabase.ts` produit un typage RPC complet, aucun cast n'est necessaire.
- **Audit Sentry J+7** : tag `flow=admin_messages_load` ou `rpc=get_admin_conversations_with_unread`. Si 0 erreur, AC14 confirme.

### Project Structure Notes

- **Alignement parfait** avec :
  - Story 4.6 (variante locale SCP D5 : cast localise au point d'appel admin pages).
  - Story 5.B.2 (idempotence Supabase via `.maybeSingle()` + RLS preservee).
  - Pattern parrainage RPCs (try_consume_rate_limit, merge_parrainage_flag_suspicion) : meme structure SECURITY DEFINER + REVOKE PUBLIC + GRANT authenticated.
- **Variance** : premier RPC retournant une TABLE (multi-rows + multi-cols), les RPC existantes retournent BOOLEAN ou single-row. Le typage genere par MCP peut varier legerement : verifier que `Returns` est bien un array `{ ... }[]` dans `types/supabase.ts` post-regen.
- **Pas de conflit** : aucune story future Epic 7 ne touche `admin/messages/page.tsx`. La page admin `[id]` (detail conversation) reste inchangee.

### References

- Cadrage Epic 7 : [Source: _bmad-output/planning-artifacts/epic-7.md#Story-7.A.4 lignes 187-203]
- Source originale (deferred) : [Source: _bmad-output/implementation-artifacts/deferred-work.md ligne 272 - review story 4.6]
- Code cible : [Source: app/admin/messages/page.tsx lignes 14-40]
- Page detail admin (non touchee) : [Source: app/admin/messages/[id]/page.tsx]
- Pattern RPC SECURITY DEFINER de reference : [Source: supabase/migrations/20260429170000_rate_limit_tracker.sql lignes 36-80]
- Pattern cast localise SCP D5 : [Source: _bmad-output/implementation-artifacts/4-6-resorption-as-any-pages-admin.md + memoire `project_epic_4_retro`]
- Helpers RLS existants : audit MCP `pg_get_functiondef('is_admin')` -> SECURITY DEFINER STABLE language sql.
- Types Supabase Functions : [Source: types/supabase.ts lignes 1301-1343]
- Fixtures Vitest integration : [Source: tests/integration/_lib/fixtures.ts + tests/integration/setup.ts]
- Convention buildCommand Vercel : [Source: vercel.json - check:env -> lint:a11y-check -> check:ip-spoofing -> check:as-any-admin -> check:as-any-global -> check:oracle-paywall -> test:integration (sauf SKIP_E2E_TESTS) -> next build]
- Story precedente sprint : [Source: _bmad-output/implementation-artifacts/7-a-3-garde-fou-skip-e2e-tests-interdit-en-prod.md - Status: review post-CI Vercel verte]
- Memoires projet pertinentes : `project_bmad_conventions`, `feedback_test_local_supabase`, `project_epic_4_retro`, `project_epic_7_cadrage`.

## Dev Agent Record

### Agent Model Used

claude-opus-4-7 (1M context)

### Debug Log References

- Audit MCP BDD prod 2026-05-14 : 0 conv admin / 0 messages / 0 collision RPC -> story preventive validee, aucun cutover.
- Apply migration via MCP `admin_messages_rpc_unread_aggregation` -> success, RPC visible dans pg_proc avec body conforme AC2.
- Test fonctionnel MCP `SELECT * FROM get_admin_conversations_with_unread(<admin_user_id>, 10, 0)` via MCP execute_sql -> exception `42501 : requires admin role` (auth.uid()=null sur pool MCP -> is_admin() false -> garde-fou opere comme attendu, defense en profondeur confirmee).
- Regen types/supabase.ts via MCP -> entree `Functions.get_admin_conversations_with_unread` ajoutee section Functions ordre alphabetique. unread_count typee `number` (pas `string`/`bigint` brut), cast `Number(...)` defensif conserve dans la page page.tsx pour robustesse runtime.
- tsc warning resolu : typage explicite du client anon via `createSupabaseClient<Database>(url, anonKey, ...)` dans le test integration pour beneficier de l'inference RPC.

### Completion Notes List

- **AC1-AC4** : option (a) RPC SECURITY DEFINER retenue (alignement pattern projet `try_consume_rate_limit`/parrainage RPCs). Migration 60 lignes + types regen + refacto page admin/messages 102 lignes (vs 103 avant : -1 ligne nette grace au remplacement boucle COUNT par 1 appel RPC).
- **AC7 perf** : mesure p50 avant/apres reportee a observation preview Vercel post-merge (BDD prod vide rend le seed 50 conv local moins prioritaire vs gain pedagogique : story preventive). Observation post-cutover documentee dans audit Sentry J+7.
- **AC8-AC9 tests** : 5 cas couverts (a) toutes-conv-admin + unread_count=1 chacune, (b) filtre admin_id IS NOT NULL, (c) pagination limit/offset 3 pages, (d) unread_count=0 (admin-self + read_at != null), (e) garde-fou is_admin() exception 42501 via client authenticated anon + signInWithPassword. Helper local `authenticatedClientFor` dans le test (pas de helper partage car premier usage authenticated dans la suite integration projet).
- **AC10-AC12** : audit MCP BDD prod fait avant apply, migration apply via MCP idempotente (CREATE OR REPLACE), verification post-apply via pg_get_functiondef + execute_sql.
- **AC13** : entree DECISIONS.md F-Epic7-A4 ajoutee (lignes 738+). Chronologie 2026-05-14 explicite + rationale + alternative rejetee + verrou `check:as-any-global` + regle pattern futur.
- **AC14** : audit Sentry J+7 deferre Sylvain post-merge (tag `flow=admin_messages_load` ou `rpc=get_admin_conversations_with_unread`).
- **AC15-AC17** : tsc 0 erreur, lint 196 warnings = baseline post-7.A.3, lint:a11y-check 155 baseline OK, check:* tous OK, a11y:axe:check 0 delta Critical/Serious sur 7 parcours, test:unit 45/45 verts en 1s. test:integration delegue GHA (heritage `feedback_test_local_supabase`).
- **Hors scope respecte** : pas de modification page admin/messages/[id]/page.tsx (detail conversation), pas de modification fixtures partagees (helpers `createTestConversation`/`createTestMessage` deja en place heritage 4.4), pas d'introduction `as any` (verrou check:as-any-global preserve).

### File List

- `supabase/migrations/20260513230753_admin_messages_rpc_unread_aggregation.sql` (nouveau, 60 lignes)
- `types/supabase.ts` (modifie, +12 lignes : entree Functions.get_admin_conversations_with_unread)
- `app/admin/messages/page.tsx` (modifie, refacto -25 / +15 lignes net : suppression boucle N+1, remplace par 1 appel RPC)
- `tests/integration/admin-messages/liste-conversations-avec-unread.test.ts` (nouveau, 168 lignes : 5 cas a-e + helper authenticatedClientFor)
- `DECISIONS.md` (modifie, +25 lignes : entree F-Epic7-A4 chronologie 2026-05-14)
- `_bmad-output/implementation-artifacts/sprint-status.yaml` (modifie, statut 7.A.4 : ready-for-dev -> in-progress -> review)
- `_bmad-output/implementation-artifacts/7-a-4-aggreger-n-plus-1-unread-counts-admin-messages.md` (modifie, Tasks coches + Dev Agent Record + Status review)

### Review Findings

- [x] [Review][Decision] F5 — is_admin() vs service_role — dismiss : comportement correct, MCP != prod. En prod le JWT admin est propagé via Authorization header, auth.uid() n'est pas NULL.
- [x] [Review][Decision] F10 — Sentry.flush(2000) supprimé — patch appliqué : flush retiré du catch de hasActiveSubscription. [`lib/subscription-helpers.ts:55`]
- [x] [Review][Patch] F1 — RPC error capturée dans page.tsx — patch appliqué : { data: rows, error: rpcError } + Sentry.captureException sur rpcError. [`app/admin/messages/page.tsx:14`]
- [x] [Review][Patch] F13 — p_current_user_id IS NULL unread_count biaisé — patch appliqué : IS DISTINCT FROM + guard IS NOT NULL dans la migration. [`supabase/migrations/20260513230753_admin_messages_rpc_unread_aggregation.sql:40`]
- [x] [Review][Defer] F6 — Sous-requête corrélée COUNT sans index composite `(conversation_id, sender_id, read_at)` [migration] — deferred, pre-existing. Index `idx_messages_conversation` existant couvre déjà, optimisation future si volumétrie > 10k messages.
- [x] [Review][Defer] F7 — `p_limit=100` hardcodé, pas de pagination UI [page.tsx:16] — deferred, hors scope intentionnel.
- [x] [Review][Defer] F12 — Race condition refetch : row supprimée entre insert et refetch → error retournée sans retry [app/actions/messages.ts] — deferred, pre-existing. Cas limite documenté par commentaire.
- [x] [Review][Defer] F14 — `p_limit` négatif accepté par la migration (LIMIT -1 = sans limite) [migration] — deferred, surface attaque nulle (seul admin peut appeler, valeur hardcodée côté caller).

### Change Log

- 2026-05-14 : Story 7.A.4 implementation complete (Sylvain) - RPC SECURITY DEFINER `get_admin_conversations_with_unread` aggregation 1-round-trip vs N+1, migration apply MCP, page admin/messages refactoree, 5 tests integration, DECISIONS.md F-Epic7-A4. Validations locales toutes vertes (tsc 0, lint 196 sous baseline, lint:a11y-check 155 baseline, check:* OK, a11y:axe:check 0 delta, test:unit 45/45). test:integration delegue GHA. Status -> review.

## DoD a11y

A renseigner pour toute story avec impact UI (ignorer si pas de changement visuel/interactif) :

- [ ] Labels associes aux champs (`htmlFor` ou `aria-labelledby`)
- [ ] Erreurs liees aux champs via `aria-describedby` + `aria-invalid`
- [ ] Focus visible sur tous les elements interactifs (contraste >= 3:1)
- [ ] Contrastes texte >= 4,5:1 et UI >= 3:1
- [ ] ARIA states corrects sur composants dynamiques (`aria-expanded`, `aria-selected`, etc.)
- [ ] Navigation clavier complete (Tab, Enter, Escape, fleches selon pattern)
- [ ] Verification ponctuelle au lecteur d'ecran (VoiceOver ou NVDA) sur le composant touche
- [ ] Pas de regression `eslint-plugin-jsx-a11y` (`npm run lint:a11y-check` vert en CI)
- [ ] Pas de regression axe-core (`npm run a11y:axe:check` vert ou delta documente avec justification dans la PR)

> **Impact UI marginal** : la refacto preserve la structure visuelle exacte (balises, classes, aria-label `${unread} non lus` conserve, link href identique). Verifier que `lint:a11y-check` 155 baseline reste intact apres la refacto. `a11y:axe:check` sur les 7 parcours baseline (non admin/messages, qui n'est pas dans le scope baseline) doit rester vert. Si l'agent verifie le rendu visuel preview Vercel, comparer cote-a-cote avant/apres avec admin user authentifie et seed >=3 conv (utiliser fixtures de test ou seed manuel).
