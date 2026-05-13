---
story: 6.A.2
captured: '2026-05-13'
purpose: 'Snapshot DDL pre-cutover BDD prod avant migration 6.A.2 (renommage residuel accompagnante->accompagnant). Sert de source de verite rollback pour les modes 1-7 de tech-spec 6.A.1 section D9.'
source: 'mcp__supabase__execute_sql (audit re-run 2026-05-13)'
postgres_version: '17.6'
---

# Snapshot pre-cutover BDD prod 6.A.2 (2026-05-13)

Capture exhaustive de l'etat BDD prod avant `apply_migration` 6.A.2. Tous les DDL ci-dessous sont replay-ables pour rollback en cas d'echec.

## 1. Enum `user_role` (avant)

| enumlabel | enumsortorder |
|---|---|
| `accompagnante` | 1 |
| `accompagnant` | 1.5 |
| `accompagne` | 2 |
| `admin` | 3 |

**Note** : `enumsortorder = 1.5` confirme un `ALTER TYPE ADD VALUE BEFORE` historique Epic 5.

## 2. Count users par role (avant)

| role | count |
|---|---|
| `accompagnant` | 818 |
| `accompagne` | 4 |
| `admin` | 1 |

**Total** : 823 users. **0 user sur `accompagnante`** (orpheline, safe a recreate-enum).

## 3. Count lignes 3 tables a renommer (avant)

| Table | Lignes |
|---|---|
| `accompagnantes_profiles` | 818 |
| `annonces_accompagnantes` | 796 |
| `accompagne_accompagnantes` | 0 |

## 4. Policies RLS sur les 3 tables (11 policies, DDL replay-able)

```sql
-- accompagnantes_profiles : 4 policies
CREATE POLICY aux_select_own ON public.accompagnantes_profiles
  FOR SELECT TO public
  USING ((user_id = auth.uid()) OR is_admin() OR (validation_status = 'valide'::validation_status));

CREATE POLICY aux_insert_own ON public.accompagnantes_profiles
  FOR INSERT TO public
  WITH CHECK (user_id = auth.uid());

CREATE POLICY aux_update_own ON public.accompagnantes_profiles
  FOR UPDATE TO public
  USING ((user_id = auth.uid()) OR is_admin());

CREATE POLICY aux_delete_own ON public.accompagnantes_profiles
  FOR DELETE TO public
  USING ((user_id = auth.uid()) OR is_admin());

-- accompagne_accompagnantes : 3 policies
CREATE POLICY "Accompagnant reads own assignments" ON public.accompagne_accompagnantes
  FOR SELECT TO public
  USING (accompagnant_user_id = auth.uid());

CREATE POLICY "Accompagne manages own team" ON public.accompagne_accompagnantes
  FOR ALL TO public
  USING (accompagne_id IN (
    SELECT accompagnes_profiles.id FROM accompagnes_profiles
    WHERE accompagnes_profiles.user_id = auth.uid()
  ));

CREATE POLICY "Admins read all teams" ON public.accompagne_accompagnantes
  FOR SELECT TO public
  USING (is_admin());

-- annonces_accompagnantes : 4 policies
CREATE POLICY ann_acc_select ON public.annonces_accompagnantes
  FOR SELECT TO public
  USING (is_admin() OR (accompagnant_id IN (
    SELECT accompagnantes_profiles.id FROM accompagnantes_profiles
    WHERE accompagnantes_profiles.user_id = auth.uid()
  )) OR (status = 'publiee'::annonce_status));

CREATE POLICY ann_acc_insert ON public.annonces_accompagnantes
  FOR INSERT TO public
  WITH CHECK (accompagnant_id IN (
    SELECT accompagnantes_profiles.id FROM accompagnantes_profiles
    WHERE accompagnantes_profiles.user_id = auth.uid()
  ));

CREATE POLICY ann_acc_update ON public.annonces_accompagnantes
  FOR UPDATE TO public
  USING ((accompagnant_id IN (
    SELECT accompagnantes_profiles.id FROM accompagnantes_profiles
    WHERE accompagnantes_profiles.user_id = auth.uid()
  )) OR is_admin());

CREATE POLICY ann_acc_delete ON public.annonces_accompagnantes
  FOR DELETE TO public
  USING ((accompagnant_id IN (
    SELECT accompagnantes_profiles.id FROM accompagnantes_profiles
    WHERE accompagnantes_profiles.user_id = auth.uid()
  )) OR is_admin());
```

## 5. Contraintes des 3 tables et FK externes (14 contraintes)

| Nom actuel | Table | Type | Definition |
|---|---|---|---|
| `accompagnantes_profiles_completion_check` | accompagnantes_profiles | CHECK | `CHECK (((validation_status = 'a_completer'::validation_status) OR ((ville IS NOT NULL) AND (code_postal IS NOT NULL) AND (experience IS NOT NULL) AND (specialites IS NOT NULL) AND (array_length(specialites, 1) > 0) AND (diplomes IS NOT NULL) AND (array_length(diplomes, 1) > 0))))` |
| `accompagnantes_profiles_validation_source_check` | accompagnantes_profiles | CHECK | `CHECK ((validation_source = ANY (ARRAY['manuelle'::text, 'parrainage'::text])))` |
| `auxiliaires_profiles_pkey` | accompagnantes_profiles | PK | `PRIMARY KEY (id)` |
| `auxiliaires_profiles_user_id_fkey` | accompagnantes_profiles | FK | `FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE` |
| `auxiliaires_profiles_user_id_key` | accompagnantes_profiles | UNIQUE | `UNIQUE (user_id)` |
| `auxiliaires_profiles_validated_by_fkey` | accompagnantes_profiles | FK | `FOREIGN KEY (validated_by) REFERENCES users(id)` |
| `beneficiaire_auxiliaires_auxiliaire_user_id_fkey` | accompagne_accompagnantes | FK | `FOREIGN KEY (accompagnant_user_id) REFERENCES users(id) ON DELETE CASCADE` |
| `beneficiaire_auxiliaires_beneficiaire_id_auxiliaire_user_id_key` | accompagne_accompagnantes | UNIQUE | `UNIQUE (accompagne_id, accompagnant_user_id)` |
| `beneficiaire_auxiliaires_beneficiaire_id_fkey` | accompagne_accompagnantes | FK | `FOREIGN KEY (accompagne_id) REFERENCES accompagnes_profiles(id) ON DELETE CASCADE` |
| `beneficiaire_auxiliaires_pkey` | accompagne_accompagnantes | PK | `PRIMARY KEY (id)` |
| `annonces_auxiliaires_auxiliaire_id_fkey` | annonces_accompagnantes | FK | `FOREIGN KEY (accompagnant_id) REFERENCES accompagnantes_profiles(id) ON DELETE CASCADE` |
| `annonces_auxiliaires_pkey` | annonces_accompagnantes | PK | `PRIMARY KEY (id)` |
| `conversations_auxiliaire_id_fkey` | conversations | FK ext | `FOREIGN KEY (accompagnant_id) REFERENCES accompagnantes_profiles(id) ON DELETE CASCADE` |
| `favoris_annonce_auxiliaire_id_fkey` | favoris | FK ext | `FOREIGN KEY (annonce_accompagnant_id) REFERENCES annonces_accompagnantes(id) ON DELETE CASCADE` |

## 6. Fonction RPC orpheline `get_or_create_conversation`

```sql
CREATE OR REPLACE FUNCTION public.get_or_create_conversation(
  p_accompagnante_id uuid,
  p_accompagne_id uuid
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
AS $function$
DECLARE
  v_conversation_id UUID;
BEGIN
  SELECT id INTO v_conversation_id
  FROM conversations
  WHERE accompagnante_id = p_accompagnante_id AND accompagne_id = p_accompagne_id;

  IF v_conversation_id IS NULL THEN
    INSERT INTO conversations (accompagnante_id, accompagne_id)
    VALUES (p_accompagnante_id, p_accompagne_id)
    ON CONFLICT (accompagnante_id, accompagne_id) DO NOTHING
    RETURNING id INTO v_conversation_id;

    IF v_conversation_id IS NULL THEN
      SELECT id INTO v_conversation_id
      FROM conversations
      WHERE accompagnante_id = p_accompagnante_id AND accompagne_id = p_accompagne_id;
    END IF;
  END IF;

  RETURN v_conversation_id;
END;
$function$;
```

**Note** : 0 caller TS (verifie `grep -rn get_or_create_conversation` repo = 0 match Epic 5+). RPC orpheline candidate au DROP en 6.A.2.

## 7. Trigger `handle_new_user` + helpers RLS (body original avant 6.A.2)

### handle_new_user (a corriger en 6.A.2)

```sql
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_role public.user_role;
  v_role_text text;
BEGIN
  v_role_text := NEW.raw_user_meta_data->>'role';

  IF v_role_text IN ('accompagnante', 'accompagne') THEN
    v_role := v_role_text::public.user_role;
  ELSE
    v_role := 'accompagne'::public.user_role;
  END IF;

  INSERT INTO public.users (id, email, role, first_name, last_name)
  VALUES (
    NEW.id,
    NEW.email,
    v_role,
    COALESCE(NEW.raw_user_meta_data->>'first_name', ''),
    COALESCE(NEW.raw_user_meta_data->>'last_name', '')
  );

  IF v_role = 'accompagnante' THEN
    INSERT INTO public.accompagnantes_profiles (user_id) VALUES (NEW.id);
  ELSE
    INSERT INTO public.accompagnes_profiles (user_id) VALUES (NEW.id);
  END IF;

  RETURN NEW;
END;
$function$;
```

**Bug** : `IF v_role_text IN ('accompagnante', 'accompagne')` ne matche pas le terme actuel `'accompagnant'` envoye par `app/actions/auth.ts:20`. Tout signup avec `role='accompagnant'` tombe dans le ELSE -> route vers `accompagne` + `accompagnes_profiles`. **0 cas observe en prod 2026-05-13** mais bug arme.

### is_accompagnant (corps preserve a l'identique en 6.A.2)

```sql
CREATE OR REPLACE FUNCTION public.is_accompagnant()
RETURNS boolean
LANGUAGE sql
STABLE
AS $function$
  SELECT EXISTS (
    SELECT 1 FROM public.users
    WHERE id = auth.uid() AND role = 'accompagnant'
  );
$function$;
```

**Note** : `is_accompagnant` n'est **PAS** `SECURITY DEFINER` (contrairement a `is_accompagne` et `is_admin`). Incoherence Epic 5 a signaler Epic 7+ mais hors scope 6.A.

### is_accompagne (corps preserve a l'identique en 6.A.2)

```sql
CREATE OR REPLACE FUNCTION public.is_accompagne()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
AS $function$
  SELECT EXISTS (
    SELECT 1 FROM public.users
    WHERE id = auth.uid() AND role = 'accompagne'
  );
$function$;
```

## 8. Dependances helpers RLS (verifie : aucune)

Query :
```sql
SELECT p.polname, c.relname,
       pg_get_expr(p.polqual, p.polrelid) AS qual,
       pg_get_expr(p.polwithcheck, p.polrelid) AS with_check
FROM pg_policy p
JOIN pg_class c ON c.oid = p.polrelid
WHERE pg_get_expr(p.polqual, p.polrelid) LIKE '%is_accompagn%'
   OR pg_get_expr(p.polwithcheck, p.polrelid) LIKE '%is_accompagn%';
```

**Resultat : 0 ligne** -> aucune policy RLS ne reference `is_accompagnant()` ni `is_accompagne()`. **DROP/CREATE de ces helpers est safe** sans cascade sur policies.

## 9. Comptes attendus apres migration 6.A.2 (validation post-cutover)

| Verification | Attendu |
|---|---|
| `SELECT enumlabel FROM pg_enum WHERE enumtypid = 'user_role'::regtype` | `['accompagnant','accompagne','admin']` (exactement 3 valeurs, plus de `'accompagnante'`) |
| `SELECT role, COUNT(*) FROM users GROUP BY role` | `accompagnant=818, accompagne=4, admin=1` (inchange) |
| `SELECT COUNT(*) FROM accompagnants_profiles` | 818 |
| `SELECT COUNT(*) FROM annonces_accompagnants` | 796 |
| `SELECT COUNT(*) FROM accompagne_accompagnants` | 0 |
| `SELECT 1 FROM accompagnantes_profiles LIMIT 1` (ancienne table) | ERROR : relation does not exist |
| `SELECT proname FROM pg_proc WHERE proname = 'get_or_create_conversation'` | 0 ligne (DROP applique) |
| Test signup sandbox `INSERT INTO auth.users ... role='accompagnant'` | INSERT dans `accompagnants_profiles` (PAS `accompagnes_profiles`) |

## 10. Strategie rollback

Si la migration 6.A.2 echoue partiellement ou si une regression est detectee post-cutover, executer le fichier `rollback-6-a-2.sql` (en parallele de ce snapshot) qui contient la sequence inverse.

**Important** : ce snapshot est l'artefact canonical pour replay manuel des DDL si le rollback automatique echoue lui aussi.
