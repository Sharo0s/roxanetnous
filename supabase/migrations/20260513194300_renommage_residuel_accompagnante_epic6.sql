-- Story 6.A.2 : Renommage BDD residuel accompagnante -> accompagnant
-- Spec : _bmad-output/planning-artifacts/tech-spec-6-a-renommage.md
-- Snapshot : _bmad-output/implementation-artifacts/snapshot-6-a-2-pre-cutover.md
-- Rollback : _bmad-output/implementation-artifacts/rollback-6-a-2.sql
--
-- Cette migration execute dans l'ordre :
--   0. Guard : refus si users.role = 'accompagnante' existe encore
--   1. RENAME 3 tables (accompagnantes_profiles -> accompagnants_profiles, etc.)
--   2. RENAME 14 contraintes historiques (PK/UNIQUE/FK/CHECK)
--   3. DROP + CREATE 11 policies RLS (cosmetique : rafraichir texte SQL)
--   4. Pattern recreate-enum (Postgres 17 ne supporte pas DROP VALUE)
--   5. CREATE OR REPLACE handle_new_user (fix bug latent + pointer nouvelles tables)
--   6. DROP FUNCTION get_or_create_conversation (RPC orpheline)
--
-- Estimation cutover : < 5 secondes (ALTER COLUMN TYPE 822 lignes est le seul cout non-metadata).

BEGIN;

SET lock_timeout = '5s';

-- ===========================================================================
-- Etape 0 : Guard
-- ===========================================================================

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM public.users WHERE role::text = 'accompagnante') THEN
    RAISE EXCEPTION 'Refus migration : au moins 1 user a encore role=accompagnante (race condition entre audit et migration)';
  END IF;
END $$;

-- ===========================================================================
-- Etape 1 : RENAME des 3 tables
-- ===========================================================================

ALTER TABLE public.accompagnantes_profiles RENAME TO accompagnants_profiles;
ALTER TABLE public.annonces_accompagnantes RENAME TO annonces_accompagnants;
ALTER TABLE public.accompagne_accompagnantes RENAME TO accompagne_accompagnants;

-- ===========================================================================
-- Etape 2 : RENAME des 14 contraintes historiques
-- ===========================================================================

-- accompagnants_profiles (ex-accompagnantes_profiles)
ALTER TABLE public.accompagnants_profiles
  RENAME CONSTRAINT auxiliaires_profiles_pkey TO accompagnants_profiles_pkey;
ALTER TABLE public.accompagnants_profiles
  RENAME CONSTRAINT auxiliaires_profiles_user_id_key TO accompagnants_profiles_user_id_key;
ALTER TABLE public.accompagnants_profiles
  RENAME CONSTRAINT auxiliaires_profiles_user_id_fkey TO accompagnants_profiles_user_id_fkey;
ALTER TABLE public.accompagnants_profiles
  RENAME CONSTRAINT auxiliaires_profiles_validated_by_fkey TO accompagnants_profiles_validated_by_fkey;
ALTER TABLE public.accompagnants_profiles
  RENAME CONSTRAINT accompagnantes_profiles_completion_check TO accompagnants_profiles_completion_check;
ALTER TABLE public.accompagnants_profiles
  RENAME CONSTRAINT accompagnantes_profiles_validation_source_check TO accompagnants_profiles_validation_source_check;

-- annonces_accompagnants (ex-annonces_accompagnantes)
ALTER TABLE public.annonces_accompagnants
  RENAME CONSTRAINT annonces_auxiliaires_pkey TO annonces_accompagnants_pkey;
ALTER TABLE public.annonces_accompagnants
  RENAME CONSTRAINT annonces_auxiliaires_auxiliaire_id_fkey TO annonces_accompagnants_accompagnant_id_fkey;

-- accompagne_accompagnants (ex-accompagne_accompagnantes)
ALTER TABLE public.accompagne_accompagnants
  RENAME CONSTRAINT beneficiaire_auxiliaires_pkey TO accompagne_accompagnants_pkey;
ALTER TABLE public.accompagne_accompagnants
  RENAME CONSTRAINT beneficiaire_auxiliaires_beneficiaire_id_auxiliaire_user_id_key
  TO accompagne_accompagnants_accompagne_id_accompagnant_user_id_key;
ALTER TABLE public.accompagne_accompagnants
  RENAME CONSTRAINT beneficiaire_auxiliaires_auxiliaire_user_id_fkey
  TO accompagne_accompagnants_accompagnant_user_id_fkey;
ALTER TABLE public.accompagne_accompagnants
  RENAME CONSTRAINT beneficiaire_auxiliaires_beneficiaire_id_fkey
  TO accompagne_accompagnants_accompagne_id_fkey;

-- FK externes (les contraintes restent attachees a leur table d'origine)
ALTER TABLE public.conversations
  RENAME CONSTRAINT conversations_auxiliaire_id_fkey TO conversations_accompagnant_id_fkey;
ALTER TABLE public.favoris
  RENAME CONSTRAINT favoris_annonce_auxiliaire_id_fkey TO favoris_annonce_accompagnant_id_fkey;

-- ===========================================================================
-- Etape 3 : DROP + CREATE des 11 policies RLS (cosmetique : rafraichir texte SQL)
-- ===========================================================================

-- accompagnants_profiles (4 policies, le qual referait deja les nouveaux noms via OID, mais
-- le texte SQL stocke continue de montrer l'ancien nom. On recree pour coherence.)
DROP POLICY IF EXISTS aux_select_own ON public.accompagnants_profiles;
DROP POLICY IF EXISTS aux_insert_own ON public.accompagnants_profiles;
DROP POLICY IF EXISTS aux_update_own ON public.accompagnants_profiles;
DROP POLICY IF EXISTS aux_delete_own ON public.accompagnants_profiles;

CREATE POLICY aux_select_own ON public.accompagnants_profiles
  FOR SELECT TO public
  USING ((user_id = auth.uid()) OR is_admin() OR (validation_status = 'valide'::validation_status));

CREATE POLICY aux_insert_own ON public.accompagnants_profiles
  FOR INSERT TO public
  WITH CHECK (user_id = auth.uid());

CREATE POLICY aux_update_own ON public.accompagnants_profiles
  FOR UPDATE TO public
  USING ((user_id = auth.uid()) OR is_admin());

CREATE POLICY aux_delete_own ON public.accompagnants_profiles
  FOR DELETE TO public
  USING ((user_id = auth.uid()) OR is_admin());

-- accompagne_accompagnants (3 policies)
DROP POLICY IF EXISTS "Accompagnant reads own assignments" ON public.accompagne_accompagnants;
DROP POLICY IF EXISTS "Accompagne manages own team" ON public.accompagne_accompagnants;
DROP POLICY IF EXISTS "Admins read all teams" ON public.accompagne_accompagnants;

CREATE POLICY "Accompagnant reads own assignments" ON public.accompagne_accompagnants
  FOR SELECT TO public
  USING (accompagnant_user_id = auth.uid());

CREATE POLICY "Accompagne manages own team" ON public.accompagne_accompagnants
  FOR ALL TO public
  USING (accompagne_id IN (
    SELECT accompagnes_profiles.id
    FROM accompagnes_profiles
    WHERE accompagnes_profiles.user_id = auth.uid()
  ));

CREATE POLICY "Admins read all teams" ON public.accompagne_accompagnants
  FOR SELECT TO public
  USING (is_admin());

-- annonces_accompagnants (4 policies)
DROP POLICY IF EXISTS ann_acc_select ON public.annonces_accompagnants;
DROP POLICY IF EXISTS ann_acc_insert ON public.annonces_accompagnants;
DROP POLICY IF EXISTS ann_acc_update ON public.annonces_accompagnants;
DROP POLICY IF EXISTS ann_acc_delete ON public.annonces_accompagnants;

CREATE POLICY ann_acc_select ON public.annonces_accompagnants
  FOR SELECT TO public
  USING (is_admin() OR (accompagnant_id IN (
    SELECT accompagnants_profiles.id
    FROM accompagnants_profiles
    WHERE accompagnants_profiles.user_id = auth.uid()
  )) OR (status = 'publiee'::annonce_status));

CREATE POLICY ann_acc_insert ON public.annonces_accompagnants
  FOR INSERT TO public
  WITH CHECK (accompagnant_id IN (
    SELECT accompagnants_profiles.id
    FROM accompagnants_profiles
    WHERE accompagnants_profiles.user_id = auth.uid()
  ));

CREATE POLICY ann_acc_update ON public.annonces_accompagnants
  FOR UPDATE TO public
  USING ((accompagnant_id IN (
    SELECT accompagnants_profiles.id
    FROM accompagnants_profiles
    WHERE accompagnants_profiles.user_id = auth.uid()
  )) OR is_admin());

CREATE POLICY ann_acc_delete ON public.annonces_accompagnants
  FOR DELETE TO public
  USING ((accompagnant_id IN (
    SELECT accompagnants_profiles.id
    FROM accompagnants_profiles
    WHERE accompagnants_profiles.user_id = auth.uid()
  )) OR is_admin());

-- ===========================================================================
-- Etape 4 : Pattern recreate-enum (Postgres 17 ne supporte pas DROP VALUE)
-- ===========================================================================

-- 4.1 : Creer le nouveau type sans la valeur orpheline
CREATE TYPE public.user_role_v2 AS ENUM ('accompagnant', 'accompagne', 'admin');

-- 4.2 : Drop les policies RLS qui referencent users.role textuellement
--       (Postgres refuse ALTER COLUMN TYPE tant que des policies referencent la colonne).
--       Decouvert en pratique 2026-05-13 : 3 policies bloquantes hors scope tech-spec D8.
DROP POLICY IF EXISTS parrainages_codes_admin_full ON public.parrainages_codes;
DROP POLICY IF EXISTS parrainages_admin_full ON public.parrainages;
DROP POLICY IF EXISTS users_update_own ON public.users;

-- 4.3 : Drop les helpers RLS qui referencent l'ancien type (verifie safe : aucune policy ne les utilise)
DROP FUNCTION IF EXISTS public.is_accompagnant();
DROP FUNCTION IF EXISTS public.is_accompagne();

-- 4.4 : Reecrire la colonne users.role (seule colonne typee user_role)
ALTER TABLE public.users
  ALTER COLUMN role TYPE public.user_role_v2
  USING role::text::public.user_role_v2;

-- 4.5 : Drop l'ancien type, rename le nouveau
DROP TYPE public.user_role;
ALTER TYPE public.user_role_v2 RENAME TO user_role;

-- 4.6 : Recreer les helpers RLS (corps preserves a l'identique, cf. snapshot 7)
CREATE FUNCTION public.is_accompagnant()
RETURNS boolean
LANGUAGE sql
STABLE
AS $function$
  SELECT EXISTS (
    SELECT 1 FROM public.users
    WHERE id = auth.uid() AND role = 'accompagnant'
  );
$function$;

CREATE FUNCTION public.is_accompagne()
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

-- 4.7 : Recreer les 3 policies droppees en 4.2 (texte SQL identique, references vers le nouveau type user_role)
CREATE POLICY parrainages_codes_admin_full ON public.parrainages_codes
  FOR ALL TO public
  USING (EXISTS (
    SELECT 1 FROM users
    WHERE users.id = auth.uid() AND users.role = 'admin'::user_role
  ));

CREATE POLICY parrainages_admin_full ON public.parrainages
  FOR ALL TO public
  USING (EXISTS (
    SELECT 1 FROM users
    WHERE users.id = auth.uid() AND users.role = 'admin'::user_role
  ));

CREATE POLICY users_update_own ON public.users
  FOR UPDATE TO public
  USING ((id = auth.uid()) OR is_admin())
  WITH CHECK (
    is_admin()
    OR ((id = auth.uid()) AND (role = (SELECT u.role FROM users u WHERE u.id = auth.uid())))
  );

-- ===========================================================================
-- Etape 5 : Fix trigger handle_new_user (bug latent + pointer nouvelle table)
-- ===========================================================================

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

  IF v_role_text IN ('accompagnant', 'accompagne') THEN
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

  IF v_role = 'accompagnant' THEN
    INSERT INTO public.accompagnants_profiles (user_id) VALUES (NEW.id);
  ELSE
    INSERT INTO public.accompagnes_profiles (user_id) VALUES (NEW.id);
  END IF;

  RETURN NEW;
END;
$function$;

-- ===========================================================================
-- Etape 6 : DROP RPC orpheline get_or_create_conversation
-- ===========================================================================

DROP FUNCTION IF EXISTS public.get_or_create_conversation(uuid, uuid);

COMMIT;

-- ===========================================================================
-- Validation post-cutover (a executer manuellement apres COMMIT)
-- ===========================================================================
-- 1. SELECT enumlabel FROM pg_enum WHERE enumtypid = 'user_role'::regtype ORDER BY enumsortorder;
--    Attendu : ['accompagnant','accompagne','admin'] (3 valeurs, plus de 'accompagnante')
--
-- 2. SELECT role, COUNT(*) FROM users GROUP BY role ORDER BY role;
--    Attendu : accompagnant=818, accompagne=4, admin=1 (inchange)
--
-- 3. SELECT 'accompagnants_profiles' tbl, COUNT(*) FROM accompagnants_profiles
--    UNION ALL SELECT 'annonces_accompagnants', COUNT(*) FROM annonces_accompagnants
--    UNION ALL SELECT 'accompagne_accompagnants', COUNT(*) FROM accompagne_accompagnants;
--    Attendu : 818, 796, 0
--
-- 4. SELECT proname FROM pg_proc WHERE proname = 'get_or_create_conversation';
--    Attendu : 0 ligne (DROP applique)
--
-- 5. Test signup sandbox (verifie F-Epic6-A1-e) :
--    INSERT INTO auth.users (id, email, raw_user_meta_data) VALUES (
--      gen_random_uuid(), 'test-sandbox-acc@test.local',
--      '{"role":"accompagnant","first_name":"T","last_name":"T"}'::jsonb
--    );
--    Puis verifier que l'INSERT a propage dans accompagnants_profiles (PAS accompagnes_profiles).
--    Cleanup : DELETE FROM auth.users WHERE email = 'test-sandbox-acc@test.local';
