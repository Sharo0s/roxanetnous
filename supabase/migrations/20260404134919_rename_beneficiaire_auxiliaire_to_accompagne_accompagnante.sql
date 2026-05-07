
-- =============================================
-- Migration: Renommer beneficiaire → accompagne, auxiliaire → accompagnante
-- =============================================

-- 1. RENOMMER LES TABLES
ALTER TABLE auxiliaires_profiles RENAME TO accompagnantes_profiles;
ALTER TABLE beneficiaires_profiles RENAME TO accompagnes_profiles;
ALTER TABLE annonces_auxiliaires RENAME TO annonces_accompagnantes;
ALTER TABLE annonces_beneficiaires RENAME TO annonces_accompagnes;
ALTER TABLE beneficiaire_auxiliaires RENAME TO accompagne_accompagnantes;

-- 2. RENOMMER LES COLONNES

-- conversations
ALTER TABLE conversations RENAME COLUMN auxiliaire_id TO accompagnante_id;
ALTER TABLE conversations RENAME COLUMN beneficiaire_id TO accompagne_id;
ALTER TABLE conversations RENAME COLUMN archived_by_auxiliaire TO archived_by_accompagnante;
ALTER TABLE conversations RENAME COLUMN archived_by_beneficiaire TO archived_by_accompagne;

-- annonces_accompagnantes (ex annonces_auxiliaires)
ALTER TABLE annonces_accompagnantes RENAME COLUMN auxiliaire_id TO accompagnante_id;

-- annonces_accompagnes (ex annonces_beneficiaires)
ALTER TABLE annonces_accompagnes RENAME COLUMN beneficiaire_id TO accompagne_id;
ALTER TABLE annonces_accompagnes RENAME COLUMN message_auxiliaires TO message_accompagnantes;

-- favoris
ALTER TABLE favoris RENAME COLUMN annonce_auxiliaire_id TO annonce_accompagnante_id;
ALTER TABLE favoris RENAME COLUMN annonce_beneficiaire_id TO annonce_accompagne_id;

-- accompagne_accompagnantes (ex beneficiaire_auxiliaires)
ALTER TABLE accompagne_accompagnantes RENAME COLUMN beneficiaire_id TO accompagne_id;
ALTER TABLE accompagne_accompagnantes RENAME COLUMN auxiliaire_user_id TO accompagnante_user_id;

-- planning_shifts
ALTER TABLE planning_shifts RENAME COLUMN beneficiaire_id TO accompagne_id;
ALTER TABLE planning_shifts RENAME COLUMN auxiliaire_user_id TO accompagnante_user_id;

-- planning_documents
ALTER TABLE planning_documents RENAME COLUMN beneficiaire_id TO accompagne_id;

-- planning_document_assignments
ALTER TABLE planning_document_assignments RENAME COLUMN auxiliaire_user_id TO accompagnante_user_id;

-- 3. RENOMMER L'ENUM user_role
ALTER TYPE user_role RENAME VALUE 'auxiliaire' TO 'accompagnante';
ALTER TYPE user_role RENAME VALUE 'beneficiaire' TO 'accompagne';

-- 4. METTRE A JOUR LA CONTRAINTE CHECK sur signalements
ALTER TABLE signalements DROP CONSTRAINT signalements_cible_type_check;
ALTER TABLE signalements ADD CONSTRAINT signalements_cible_type_check
  CHECK (cible_type = ANY (ARRAY['user'::text, 'annonce_accompagnante'::text, 'annonce_accompagne'::text, 'avis'::text, 'message'::text]));

-- 5. METTRE A JOUR LA CONTRAINTE CHECK sur favoris
ALTER TABLE favoris DROP CONSTRAINT favoris_one_fk;
ALTER TABLE favoris ADD CONSTRAINT favoris_one_fk
  CHECK (((annonce_accompagnante_id IS NOT NULL) AND (annonce_accompagne_id IS NULL)) OR ((annonce_accompagnante_id IS NULL) AND (annonce_accompagne_id IS NOT NULL)));

-- 6. REMPLACER LES FONCTIONS

-- Drop toutes les anciennes fonctions d'abord
DROP FUNCTION IF EXISTS is_auxiliaire();
DROP FUNCTION IF EXISTS is_beneficiaire();
DROP FUNCTION IF EXISTS get_or_create_conversation(uuid, uuid);

-- is_accompagnante (ex is_auxiliaire)
CREATE FUNCTION public.is_accompagnante()
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.users
    WHERE id = auth.uid() AND role = 'accompagnante'
  );
$$;

-- is_accompagne (ex is_beneficiaire)
CREATE FUNCTION public.is_accompagne()
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.users
    WHERE id = auth.uid() AND role = 'accompagne'
  );
$$;

-- get_or_create_conversation avec nouveaux noms de parametres
CREATE FUNCTION public.get_or_create_conversation(p_accompagnante_id uuid, p_accompagne_id uuid)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
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
$$;

-- handle_new_user
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  INSERT INTO public.users (id, email, role, first_name, last_name)
  VALUES (
    NEW.id,
    NEW.email,
    COALESCE((NEW.raw_user_meta_data->>'role')::public.user_role, 'accompagne'::public.user_role),
    COALESCE(NEW.raw_user_meta_data->>'first_name', ''),
    COALESCE(NEW.raw_user_meta_data->>'last_name', '')
  );

  IF COALESCE(NEW.raw_user_meta_data->>'role', 'accompagne') = 'accompagnante' THEN
    INSERT INTO public.accompagnantes_profiles (user_id)
    VALUES (NEW.id);
  ELSE
    INSERT INTO public.accompagnes_profiles (user_id)
    VALUES (NEW.id);
  END IF;

  RETURN NEW;
END;
$$;

-- is_document_owner
CREATE OR REPLACE FUNCTION public.is_document_owner(doc_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM planning_documents pd
    JOIN accompagnes_profiles bp ON bp.id = pd.accompagne_id
    WHERE pd.id = doc_id
      AND bp.user_id = auth.uid()
  );
$$;

-- 7. RECRÉER TOUTES LES RLS POLICIES

-- annonces_accompagnantes (ex annonces_auxiliaires)
DROP POLICY IF EXISTS ann_aux_select ON annonces_accompagnantes;
DROP POLICY IF EXISTS ann_aux_insert ON annonces_accompagnantes;
DROP POLICY IF EXISTS ann_aux_update ON annonces_accompagnantes;
DROP POLICY IF EXISTS ann_aux_delete ON annonces_accompagnantes;

CREATE POLICY ann_acc_select ON annonces_accompagnantes FOR SELECT USING (
  is_admin() OR
  (accompagnante_id IN (SELECT id FROM accompagnantes_profiles WHERE user_id = auth.uid())) OR
  (status = 'publiee'::annonce_status)
);
CREATE POLICY ann_acc_insert ON annonces_accompagnantes FOR INSERT WITH CHECK (
  accompagnante_id IN (SELECT id FROM accompagnantes_profiles WHERE user_id = auth.uid())
);
CREATE POLICY ann_acc_update ON annonces_accompagnantes FOR UPDATE USING (
  (accompagnante_id IN (SELECT id FROM accompagnantes_profiles WHERE user_id = auth.uid())) OR is_admin()
);
CREATE POLICY ann_acc_delete ON annonces_accompagnantes FOR DELETE USING (
  (accompagnante_id IN (SELECT id FROM accompagnantes_profiles WHERE user_id = auth.uid())) OR is_admin()
);

-- annonces_accompagnes (ex annonces_beneficiaires)
DROP POLICY IF EXISTS ann_ben_select ON annonces_accompagnes;
DROP POLICY IF EXISTS ann_ben_insert ON annonces_accompagnes;
DROP POLICY IF EXISTS ann_ben_update ON annonces_accompagnes;
DROP POLICY IF EXISTS ann_ben_delete ON annonces_accompagnes;

CREATE POLICY ann_acg_select ON annonces_accompagnes FOR SELECT USING (
  is_admin() OR
  (accompagne_id IN (SELECT id FROM accompagnes_profiles WHERE user_id = auth.uid())) OR
  ((status = 'publiee'::annonce_status) AND has_active_subscription())
);
CREATE POLICY ann_acg_insert ON annonces_accompagnes FOR INSERT WITH CHECK (
  accompagne_id IN (SELECT id FROM accompagnes_profiles WHERE user_id = auth.uid())
);
CREATE POLICY ann_acg_update ON annonces_accompagnes FOR UPDATE USING (
  (accompagne_id IN (SELECT id FROM accompagnes_profiles WHERE user_id = auth.uid())) OR is_admin()
);
CREATE POLICY ann_acg_delete ON annonces_accompagnes FOR DELETE USING (
  (accompagne_id IN (SELECT id FROM accompagnes_profiles WHERE user_id = auth.uid())) OR is_admin()
);

-- conversations
DROP POLICY IF EXISTS conv_select_own ON conversations;
DROP POLICY IF EXISTS conv_insert_own ON conversations;
DROP POLICY IF EXISTS conv_update_own ON conversations;

CREATE POLICY conv_select_own ON conversations FOR SELECT USING (
  is_admin() OR
  (accompagnante_id IN (SELECT id FROM accompagnantes_profiles WHERE user_id = auth.uid())) OR
  (accompagne_id IN (SELECT id FROM accompagnes_profiles WHERE user_id = auth.uid()))
);
CREATE POLICY conv_insert_own ON conversations FOR INSERT WITH CHECK (
  (accompagnante_id IN (SELECT id FROM accompagnantes_profiles WHERE user_id = auth.uid())) OR
  (accompagne_id IN (SELECT id FROM accompagnes_profiles WHERE user_id = auth.uid()))
);
CREATE POLICY conv_update_own ON conversations FOR UPDATE USING (
  is_admin() OR
  (accompagnante_id IN (SELECT id FROM accompagnantes_profiles WHERE user_id = auth.uid())) OR
  (accompagne_id IN (SELECT id FROM accompagnes_profiles WHERE user_id = auth.uid()))
);

-- messages
DROP POLICY IF EXISTS msg_select_own ON messages;
DROP POLICY IF EXISTS msg_insert_own ON messages;
DROP POLICY IF EXISTS msg_update_read ON messages;

CREATE POLICY msg_select_own ON messages FOR SELECT USING (
  is_admin() OR
  (conversation_id IN (
    SELECT id FROM conversations WHERE
      (accompagnante_id IN (SELECT id FROM accompagnantes_profiles WHERE user_id = auth.uid())) OR
      (accompagne_id IN (SELECT id FROM accompagnes_profiles WHERE user_id = auth.uid()))
  ))
);
CREATE POLICY msg_insert_own ON messages FOR INSERT WITH CHECK (
  (sender_id = auth.uid()) AND
  (conversation_id IN (
    SELECT id FROM conversations WHERE
      (accompagnante_id IN (SELECT id FROM accompagnantes_profiles WHERE user_id = auth.uid())) OR
      (accompagne_id IN (SELECT id FROM accompagnes_profiles WHERE user_id = auth.uid()))
  ))
);
CREATE POLICY msg_update_read ON messages FOR UPDATE USING (
  is_admin() OR
  (conversation_id IN (
    SELECT id FROM conversations WHERE
      (accompagnante_id IN (SELECT id FROM accompagnantes_profiles WHERE user_id = auth.uid())) OR
      (accompagne_id IN (SELECT id FROM accompagnes_profiles WHERE user_id = auth.uid()))
  ))
);

-- accompagne_accompagnantes (ex beneficiaire_auxiliaires)
DROP POLICY IF EXISTS "Beneficiaire manages own team" ON accompagne_accompagnantes;
DROP POLICY IF EXISTS "Auxiliaire reads own assignments" ON accompagne_accompagnantes;

CREATE POLICY "Accompagne manages own team" ON accompagne_accompagnantes FOR ALL USING (
  accompagne_id IN (SELECT id FROM accompagnes_profiles WHERE user_id = auth.uid())
);
CREATE POLICY "Accompagnante reads own assignments" ON accompagne_accompagnantes FOR SELECT USING (
  accompagnante_user_id = auth.uid()
);

-- planning_shifts
DROP POLICY IF EXISTS "Beneficiaire manages own shifts" ON planning_shifts;
DROP POLICY IF EXISTS "Auxiliaire reads own shifts" ON planning_shifts;

CREATE POLICY "Accompagne manages own shifts" ON planning_shifts FOR ALL USING (
  accompagne_id IN (SELECT id FROM accompagnes_profiles WHERE user_id = auth.uid())
);
CREATE POLICY "Accompagnante reads own shifts" ON planning_shifts FOR SELECT USING (
  accompagnante_user_id = auth.uid()
);

-- planning_documents
DROP POLICY IF EXISTS "Beneficiaire manages own documents" ON planning_documents;
DROP POLICY IF EXISTS "Assigned auxiliaires read documents" ON planning_documents;

CREATE POLICY "Accompagne manages own documents" ON planning_documents FOR ALL USING (
  accompagne_id IN (SELECT id FROM accompagnes_profiles WHERE user_id = auth.uid())
);
CREATE POLICY "Assigned accompagnantes read documents" ON planning_documents FOR SELECT USING (
  id IN (SELECT document_id FROM planning_document_assignments WHERE accompagnante_user_id = auth.uid())
);

-- planning_document_assignments
DROP POLICY IF EXISTS "Auxiliaire reads own document assignments" ON planning_document_assignments;
DROP POLICY IF EXISTS "Beneficiaire manages document assignments" ON planning_document_assignments;

CREATE POLICY "Accompagnante reads own document assignments" ON planning_document_assignments FOR SELECT USING (
  accompagnante_user_id = auth.uid()
);
CREATE POLICY "Accompagne manages document assignments" ON planning_document_assignments FOR ALL USING (
  is_document_owner(document_id)
) WITH CHECK (
  is_document_owner(document_id)
);

-- planning_document_reads
DROP POLICY IF EXISTS "Beneficiaire reads document reads" ON planning_document_reads;

CREATE POLICY "Accompagne reads document reads" ON planning_document_reads FOR SELECT USING (
  document_id IN (
    SELECT id FROM planning_documents WHERE accompagne_id IN (
      SELECT id FROM accompagnes_profiles WHERE user_id = auth.uid()
    )
  )
);
