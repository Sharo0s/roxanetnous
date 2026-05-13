---
story: 5.A.2
created: '2026-05-13'
purpose: 'Snapshot pre-cutover migration BDD renommage accompagnante -> accompagnant. Artefact de rollback canonical pour modes 1, 2, 3 (DECISIONS.md F12).'
---

# Snapshot pre-cutover 5.A.2

Snapshot realise via MCP `execute_sql` avant la migration 5.A.2 (cutover atomique).

## Enum user_role (3 valeurs)

```
accompagnante
accompagne
admin
```

## Counts users par role (total 822)

| role | cnt |
|---|---|
| accompagnante | 818 |
| accompagne | 3 |
| admin | 1 |

## Helpers RLS public.is_*

```sql
CREATE OR REPLACE FUNCTION public.is_accompagnante() RETURNS boolean
LANGUAGE sql STABLE AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.users
    WHERE id = auth.uid() AND role = 'accompagnante'
  );
$$;

CREATE OR REPLACE FUNCTION public.is_accompagne() RETURNS boolean
LANGUAGE sql STABLE AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.users
    WHERE id = auth.uid() AND role = 'accompagne'
  );
$$;

CREATE OR REPLACE FUNCTION public.is_admin() RETURNS boolean
LANGUAGE sql STABLE AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.users
    WHERE id = auth.uid() AND role = 'admin'
  );
$$;
```

## 23 policies a recreer en cas de rollback

Reference complete (qual + with_check + cmd + permissive + roles) capturee
2026-05-13 15:30 UTC via `pg_policies`. Snapshot integral disponible si
necessaire en reexecutant la query suivante :

```sql
SELECT schemaname || '.' || tablename || ':' || policyname AS policy_key,
       cmd, permissive, roles, qual, with_check
FROM pg_policies
WHERE qual LIKE '%accompagn%' OR qual LIKE '%is_accompagn%'
   OR with_check LIKE '%accompagn%' OR with_check LIKE '%is_accompagn%'
ORDER BY schemaname, tablename, policyname;
```

Liste des 23 policies (ordre alphabetique, key = schemaname.tablename:policyname) :

1. `public.accompagne_accompagnantes:Accompagnante reads own assignments` (SELECT)
2. `public.accompagne_accompagnantes:Accompagne manages own team` (ALL)
3. `public.annonces_accompagnantes:ann_acc_delete` (DELETE)
4. `public.annonces_accompagnantes:ann_acc_insert` (INSERT)
5. `public.annonces_accompagnantes:ann_acc_select` (SELECT)
6. `public.annonces_accompagnantes:ann_acc_update` (UPDATE)
7. `public.annonces_accompagnes:ann_acg_delete` (DELETE)
8. `public.annonces_accompagnes:ann_acg_insert` (INSERT)
9. `public.annonces_accompagnes:ann_acg_select` (SELECT)
10. `public.annonces_accompagnes:ann_acg_update` (UPDATE)
11. `public.conversations:conv_insert_own` (INSERT)
12. `public.conversations:conv_select_own` (SELECT)
13. `public.conversations:conv_update_own` (UPDATE)
14. `public.messages:msg_insert_own` (INSERT)
15. `public.messages:msg_select_own` (SELECT)
16. `public.messages:msg_update_read` (UPDATE)
17. `public.planning_document_assignments:Accompagnante reads own document assignments` (SELECT)
18. `public.planning_document_reads:Accompagne reads document reads` (SELECT)
19. `public.planning_documents:Accompagne manages own documents` (ALL)
20. `public.planning_documents:Assigned accompagnantes read documents` (SELECT)
21. `public.planning_shifts:Accompagnante reads own shifts` (SELECT)
22. `public.planning_shifts:Accompagne manages own shifts` (ALL)
23. `storage.objects:Planning document readers can download` (SELECT)

## 15 colonnes BDD impactees

Cf. tech-spec-5-a-renommage.md section Inventaire factuel BDD prod.

## Procedure de rollback enum

Si la migration cutover doit etre annulee :

```sql
-- 1. Reverter le backfill role
UPDATE users SET role = 'accompagnante' WHERE role = 'accompagnant';

-- 2. Si DROP COLUMN ou RENAME COLUMN realise : RENAME inverse
-- ALTER TABLE conversations RENAME COLUMN accompagnant_id TO accompagnante_id;
-- ... (15 inversions)

-- 3. Si helpers RLS renommes : DROP FUNCTION is_accompagnant + recreation is_accompagnante
-- (cf. body capture ci-dessus).

-- 4. Si policies droppees : recreation depuis snapshot pg_policies ci-dessus.

-- Note Postgres 17.6 : la valeur enum 'accompagnant' ajoutee ne peut pas etre
-- DROP nativement. Elle restera dans le type user_role en valeur orpheline
-- post-rollback (sans utilisation). Aucun impact applicatif.
```
