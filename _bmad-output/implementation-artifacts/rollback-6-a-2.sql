-- ROLLBACK Story 6.A.2 : Renommage BDD residuel accompagnante -> accompagnant
-- A executer UNIQUEMENT en cas de regression post-cutover (cf. modes 1-7 tech-spec D9).
--
-- Important : ce script suppose que la migration 6.A.2 a commit. Si la transaction
-- a roll back automatiquement (mode 1, 2, 6), aucun rollback n'est necessaire.
--
-- Source de verite : snapshot-6-a-2-pre-cutover.md (DDL replay-able pre-migration).

BEGIN;

SET lock_timeout = '5s';

-- ===========================================================================
-- Etape 1 inverse : DROP + CREATE policies RLS avec anciens textes
-- ===========================================================================

DROP POLICY IF EXISTS aux_select_own ON public.accompagnants_profiles;
DROP POLICY IF EXISTS aux_insert_own ON public.accompagnants_profiles;
DROP POLICY IF EXISTS aux_update_own ON public.accompagnants_profiles;
DROP POLICY IF EXISTS aux_delete_own ON public.accompagnants_profiles;

DROP POLICY IF EXISTS "Accompagnant reads own assignments" ON public.accompagne_accompagnants;
DROP POLICY IF EXISTS "Accompagne manages own team" ON public.accompagne_accompagnants;
DROP POLICY IF EXISTS "Admins read all teams" ON public.accompagne_accompagnants;

DROP POLICY IF EXISTS ann_acc_select ON public.annonces_accompagnants;
DROP POLICY IF EXISTS ann_acc_insert ON public.annonces_accompagnants;
DROP POLICY IF EXISTS ann_acc_update ON public.annonces_accompagnants;
DROP POLICY IF EXISTS ann_acc_delete ON public.annonces_accompagnants;

-- ===========================================================================
-- Etape 2 inverse : Pattern recreate-enum pour restaurer la valeur 'accompagnante'
-- ===========================================================================

-- Drop les 3 policies dependant de users.role (idem migration etape 4.2)
DROP POLICY IF EXISTS parrainages_codes_admin_full ON public.parrainages_codes;
DROP POLICY IF EXISTS parrainages_admin_full ON public.parrainages;
DROP POLICY IF EXISTS users_update_own ON public.users;

-- Drop les helpers RLS (a recreer apres ALTER COLUMN TYPE)
DROP FUNCTION IF EXISTS public.is_accompagnant();
DROP FUNCTION IF EXISTS public.is_accompagne();

-- Recreer l'enum avec la valeur orpheline restauree
CREATE TYPE public.user_role_rollback AS ENUM ('accompagnante', 'accompagnant', 'accompagne', 'admin');

-- Reecrire la colonne users.role vers le type rollback
ALTER TABLE public.users
  ALTER COLUMN role TYPE public.user_role_rollback
  USING role::text::public.user_role_rollback;

-- Drop l'ancien type, rename le nouveau
DROP TYPE public.user_role;
ALTER TYPE public.user_role_rollback RENAME TO user_role;

-- Recreer les helpers RLS
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

-- Recreer les 3 policies users.role (texte SQL identique pre/post-migration)
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
-- Etape 3 inverse : RENAME des 3 tables vers les anciens noms feminins
-- ===========================================================================

ALTER TABLE public.accompagnants_profiles RENAME TO accompagnantes_profiles;
ALTER TABLE public.annonces_accompagnants RENAME TO annonces_accompagnantes;
ALTER TABLE public.accompagne_accompagnants RENAME TO accompagne_accompagnantes;

-- ===========================================================================
-- Etape 4 inverse : RENAME des 14 contraintes vers les anciens noms historiques
-- ===========================================================================

ALTER TABLE public.accompagnantes_profiles
  RENAME CONSTRAINT accompagnants_profiles_pkey TO auxiliaires_profiles_pkey;
ALTER TABLE public.accompagnantes_profiles
  RENAME CONSTRAINT accompagnants_profiles_user_id_key TO auxiliaires_profiles_user_id_key;
ALTER TABLE public.accompagnantes_profiles
  RENAME CONSTRAINT accompagnants_profiles_user_id_fkey TO auxiliaires_profiles_user_id_fkey;
ALTER TABLE public.accompagnantes_profiles
  RENAME CONSTRAINT accompagnants_profiles_validated_by_fkey TO auxiliaires_profiles_validated_by_fkey;
ALTER TABLE public.accompagnantes_profiles
  RENAME CONSTRAINT accompagnants_profiles_completion_check TO accompagnantes_profiles_completion_check;
ALTER TABLE public.accompagnantes_profiles
  RENAME CONSTRAINT accompagnants_profiles_validation_source_check TO accompagnantes_profiles_validation_source_check;

ALTER TABLE public.annonces_accompagnantes
  RENAME CONSTRAINT annonces_accompagnants_pkey TO annonces_auxiliaires_pkey;
ALTER TABLE public.annonces_accompagnantes
  RENAME CONSTRAINT annonces_accompagnants_accompagnant_id_fkey TO annonces_auxiliaires_auxiliaire_id_fkey;

ALTER TABLE public.accompagne_accompagnantes
  RENAME CONSTRAINT accompagne_accompagnants_pkey TO beneficiaire_auxiliaires_pkey;
ALTER TABLE public.accompagne_accompagnantes
  RENAME CONSTRAINT accompagne_accompagnants_accompagne_id_accompagnant_user_id_key
  TO beneficiaire_auxiliaires_beneficiaire_id_auxiliaire_user_id_key;
ALTER TABLE public.accompagne_accompagnantes
  RENAME CONSTRAINT accompagne_accompagnants_accompagnant_user_id_fkey
  TO beneficiaire_auxiliaires_auxiliaire_user_id_fkey;
ALTER TABLE public.accompagne_accompagnantes
  RENAME CONSTRAINT accompagne_accompagnants_accompagne_id_fkey
  TO beneficiaire_auxiliaires_beneficiaire_id_fkey;

ALTER TABLE public.conversations
  RENAME CONSTRAINT conversations_accompagnant_id_fkey TO conversations_auxiliaire_id_fkey;
ALTER TABLE public.favoris
  RENAME CONSTRAINT favoris_annonce_accompagnant_id_fkey TO favoris_annonce_auxiliaire_id_fkey;

-- ===========================================================================
-- Etape 5 inverse : Recreer policies RLS avec anciens noms de tables references
-- ===========================================================================

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

-- ===========================================================================
-- Etape 6 inverse : Restaurer handle_new_user body original
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

-- ===========================================================================
-- Etape 7 inverse : Restaurer RPC orpheline get_or_create_conversation
-- ===========================================================================

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

COMMIT;

-- ===========================================================================
-- Note importante : ce rollback ne tient PAS compte du fait que la columne
-- conversations.accompagnante_id et conversations.accompagne_id peuvent ne pas
-- exister au moment du rollback (renommees Epic 5). La RPC restaure peut donc
-- planter au prochain appel, mais comme elle a 0 caller, c'est sans impact.
-- Si la RPC est reactivee post-rollback, ses parametres et corps devront etre
-- re-alignes manuellement.
