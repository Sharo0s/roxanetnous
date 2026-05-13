-- Story 5.A.2 part 2 : backfill users.role + RENAME COLUMN x 15 + helpers RLS + recreation 23 policies
--
-- Pre-requis : migration part 1 appliquee (valeur enum 'accompagnant' presente).
-- Transaction unique, downtime mesure (cible < 5 sec).
-- Volumetrie : UPDATE 818 lignes users + 8 RENAME COLUMN (metadata) + 1 DROP/CREATE FUNCTION + 23 policies.

-- =====================================================================
-- 1. UPDATE backfill users.role
-- =====================================================================

UPDATE users SET role = 'accompagnant' WHERE role = 'accompagnante';

DO $$
DECLARE
  cnt_old INTEGER;
BEGIN
  SELECT COUNT(*) INTO cnt_old FROM users WHERE role = 'accompagnante';
  IF cnt_old > 0 THEN
    RAISE EXCEPTION 'Migration 5.A.2 part 2 : backfill incomplet, % users restent au feminin', cnt_old;
  END IF;
END $$;

-- =====================================================================
-- 2. RENAME COLUMN x 8 (operations metadata, ordre alphabetique tables)
-- =====================================================================

ALTER TABLE accompagne_accompagnantes RENAME COLUMN accompagnante_user_id TO accompagnant_user_id;
ALTER TABLE annonces_accompagnantes RENAME COLUMN accompagnante_id TO accompagnant_id;
ALTER TABLE annonces_accompagnes RENAME COLUMN message_accompagnantes TO message_accompagnants;
ALTER TABLE conversations RENAME COLUMN accompagnante_id TO accompagnant_id;
ALTER TABLE conversations RENAME COLUMN archived_by_accompagnante TO archived_by_accompagnant;
ALTER TABLE favoris RENAME COLUMN annonce_accompagnante_id TO annonce_accompagnant_id;
ALTER TABLE planning_document_assignments RENAME COLUMN accompagnante_user_id TO accompagnant_user_id;
ALTER TABLE planning_shifts RENAME COLUMN accompagnante_user_id TO accompagnant_user_id;

-- =====================================================================
-- 3. DROP 23 policies (deps de is_accompagnante)
-- =====================================================================

DROP POLICY IF EXISTS "Accompagnante reads own assignments" ON accompagne_accompagnantes;
DROP POLICY IF EXISTS "Accompagne manages own team" ON accompagne_accompagnantes;
DROP POLICY IF EXISTS "ann_acc_delete" ON annonces_accompagnantes;
DROP POLICY IF EXISTS "ann_acc_insert" ON annonces_accompagnantes;
DROP POLICY IF EXISTS "ann_acc_select" ON annonces_accompagnantes;
DROP POLICY IF EXISTS "ann_acc_update" ON annonces_accompagnantes;
DROP POLICY IF EXISTS "ann_acg_delete" ON annonces_accompagnes;
DROP POLICY IF EXISTS "ann_acg_insert" ON annonces_accompagnes;
DROP POLICY IF EXISTS "ann_acg_select" ON annonces_accompagnes;
DROP POLICY IF EXISTS "ann_acg_update" ON annonces_accompagnes;
DROP POLICY IF EXISTS "conv_insert_own" ON conversations;
DROP POLICY IF EXISTS "conv_select_own" ON conversations;
DROP POLICY IF EXISTS "conv_update_own" ON conversations;
DROP POLICY IF EXISTS "msg_insert_own" ON messages;
DROP POLICY IF EXISTS "msg_select_own" ON messages;
DROP POLICY IF EXISTS "msg_update_read" ON messages;
DROP POLICY IF EXISTS "Accompagnante reads own document assignments" ON planning_document_assignments;
DROP POLICY IF EXISTS "Accompagne reads document reads" ON planning_document_reads;
DROP POLICY IF EXISTS "Accompagne manages own documents" ON planning_documents;
DROP POLICY IF EXISTS "Assigned accompagnantes read documents" ON planning_documents;
DROP POLICY IF EXISTS "Accompagnante reads own shifts" ON planning_shifts;
DROP POLICY IF EXISTS "Accompagne manages own shifts" ON planning_shifts;
DROP POLICY IF EXISTS "Planning document readers can download" ON storage.objects;

-- =====================================================================
-- 4. DROP + CREATE helper is_accompagnant
-- =====================================================================

DROP FUNCTION IF EXISTS public.is_accompagnante();

CREATE OR REPLACE FUNCTION public.is_accompagnant() RETURNS boolean
LANGUAGE sql STABLE AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.users
    WHERE id = auth.uid() AND role = 'accompagnant'
  );
$$;

-- =====================================================================
-- 5. Recreation des 23 policies avec nouvelles colonnes / helpers
-- =====================================================================

-- accompagne_accompagnantes (table conservee au feminin, decision F12 D3)
CREATE POLICY "Accompagnant reads own assignments" ON accompagne_accompagnantes
  FOR SELECT USING (accompagnant_user_id = auth.uid());

CREATE POLICY "Accompagne manages own team" ON accompagne_accompagnantes
  FOR ALL USING (accompagne_id IN (
    SELECT accompagnes_profiles.id FROM accompagnes_profiles
    WHERE accompagnes_profiles.user_id = auth.uid()
  ));

-- annonces_accompagnantes (table conservee au feminin)
CREATE POLICY "ann_acc_select" ON annonces_accompagnantes FOR SELECT USING (
  is_admin()
  OR (accompagnant_id IN (
    SELECT accompagnantes_profiles.id FROM accompagnantes_profiles
    WHERE accompagnantes_profiles.user_id = auth.uid()
  ))
  OR (status = 'publiee'::annonce_status)
);

CREATE POLICY "ann_acc_insert" ON annonces_accompagnantes FOR INSERT
  WITH CHECK (accompagnant_id IN (
    SELECT accompagnantes_profiles.id FROM accompagnantes_profiles
    WHERE accompagnantes_profiles.user_id = auth.uid()
  ));

CREATE POLICY "ann_acc_update" ON annonces_accompagnantes FOR UPDATE USING (
  (accompagnant_id IN (
    SELECT accompagnantes_profiles.id FROM accompagnantes_profiles
    WHERE accompagnantes_profiles.user_id = auth.uid()
  )) OR is_admin()
);

CREATE POLICY "ann_acc_delete" ON annonces_accompagnantes FOR DELETE USING (
  (accompagnant_id IN (
    SELECT accompagnantes_profiles.id FROM accompagnantes_profiles
    WHERE accompagnantes_profiles.user_id = auth.uid()
  )) OR is_admin()
);

-- annonces_accompagnes (inchange logique, recreation pour idempotence du script)
CREATE POLICY "ann_acg_select" ON annonces_accompagnes FOR SELECT USING (
  is_admin()
  OR (accompagne_id IN (
    SELECT accompagnes_profiles.id FROM accompagnes_profiles
    WHERE accompagnes_profiles.user_id = auth.uid()
  ))
  OR ((status = 'publiee'::annonce_status) AND has_active_subscription())
);

CREATE POLICY "ann_acg_insert" ON annonces_accompagnes FOR INSERT
  WITH CHECK (accompagne_id IN (
    SELECT accompagnes_profiles.id FROM accompagnes_profiles
    WHERE accompagnes_profiles.user_id = auth.uid()
  ));

CREATE POLICY "ann_acg_update" ON annonces_accompagnes FOR UPDATE USING (
  (accompagne_id IN (
    SELECT accompagnes_profiles.id FROM accompagnes_profiles
    WHERE accompagnes_profiles.user_id = auth.uid()
  )) OR is_admin()
);

CREATE POLICY "ann_acg_delete" ON annonces_accompagnes FOR DELETE USING (
  (accompagne_id IN (
    SELECT accompagnes_profiles.id FROM accompagnes_profiles
    WHERE accompagnes_profiles.user_id = auth.uid()
  )) OR is_admin()
);

-- conversations (accompagnante_id -> accompagnant_id)
CREATE POLICY "conv_select_own" ON conversations FOR SELECT USING (
  is_admin()
  OR (accompagnant_id IN (
    SELECT accompagnantes_profiles.id FROM accompagnantes_profiles
    WHERE accompagnantes_profiles.user_id = auth.uid()
  ))
  OR (accompagne_id IN (
    SELECT accompagnes_profiles.id FROM accompagnes_profiles
    WHERE accompagnes_profiles.user_id = auth.uid()
  ))
);

CREATE POLICY "conv_insert_own" ON conversations FOR INSERT
  WITH CHECK (
    (accompagnant_id IN (
      SELECT accompagnantes_profiles.id FROM accompagnantes_profiles
      WHERE accompagnantes_profiles.user_id = auth.uid()
    ))
    OR (accompagne_id IN (
      SELECT accompagnes_profiles.id FROM accompagnes_profiles
      WHERE accompagnes_profiles.user_id = auth.uid()
    ))
    OR ((admin_id = auth.uid()) AND is_admin())
  );

CREATE POLICY "conv_update_own" ON conversations FOR UPDATE USING (
  is_admin()
  OR (accompagnant_id IN (
    SELECT accompagnantes_profiles.id FROM accompagnantes_profiles
    WHERE accompagnantes_profiles.user_id = auth.uid()
  ))
  OR (accompagne_id IN (
    SELECT accompagnes_profiles.id FROM accompagnes_profiles
    WHERE accompagnes_profiles.user_id = auth.uid()
  ))
);

-- messages (refere conversations.accompagnant_id apres renommage)
CREATE POLICY "msg_select_own" ON messages FOR SELECT USING (
  is_admin()
  OR (conversation_id IN (
    SELECT conversations.id FROM conversations
    WHERE (conversations.accompagnant_id IN (
      SELECT accompagnantes_profiles.id FROM accompagnantes_profiles
      WHERE accompagnantes_profiles.user_id = auth.uid()
    )) OR (conversations.accompagne_id IN (
      SELECT accompagnes_profiles.id FROM accompagnes_profiles
      WHERE accompagnes_profiles.user_id = auth.uid()
    ))
  ))
);

CREATE POLICY "msg_insert_own" ON messages FOR INSERT
  WITH CHECK (
    (sender_id = auth.uid())
    AND (conversation_id IN (
      SELECT c.id FROM conversations c
      WHERE (c.accompagnant_id IN (
        SELECT accompagnantes_profiles.id FROM accompagnantes_profiles
        WHERE accompagnantes_profiles.user_id = auth.uid()
      )) OR (c.accompagne_id IN (
        SELECT accompagnes_profiles.id FROM accompagnes_profiles
        WHERE accompagnes_profiles.user_id = auth.uid()
      )) OR ((c.admin_id = auth.uid()) AND is_admin())
    ))
  );

CREATE POLICY "msg_update_read" ON messages FOR UPDATE USING (
  is_admin()
  OR (conversation_id IN (
    SELECT conversations.id FROM conversations
    WHERE (conversations.accompagnant_id IN (
      SELECT accompagnantes_profiles.id FROM accompagnantes_profiles
      WHERE accompagnantes_profiles.user_id = auth.uid()
    )) OR (conversations.accompagne_id IN (
      SELECT accompagnes_profiles.id FROM accompagnes_profiles
      WHERE accompagnes_profiles.user_id = auth.uid()
    ))
  ))
);

-- planning_document_assignments (accompagnante_user_id -> accompagnant_user_id)
CREATE POLICY "Accompagnant reads own document assignments" ON planning_document_assignments
  FOR SELECT USING (accompagnant_user_id = auth.uid());

-- planning_document_reads (inchange)
CREATE POLICY "Accompagne reads document reads" ON planning_document_reads
  FOR SELECT USING (document_id IN (
    SELECT planning_documents.id FROM planning_documents
    WHERE planning_documents.accompagne_id IN (
      SELECT accompagnes_profiles.id FROM accompagnes_profiles
      WHERE accompagnes_profiles.user_id = auth.uid()
    )
  ));

-- planning_documents
CREATE POLICY "Accompagne manages own documents" ON planning_documents
  FOR ALL USING (accompagne_id IN (
    SELECT accompagnes_profiles.id FROM accompagnes_profiles
    WHERE accompagnes_profiles.user_id = auth.uid()
  ));

CREATE POLICY "Assigned accompagnants read documents" ON planning_documents
  FOR SELECT USING (id IN (
    SELECT planning_document_assignments.document_id FROM planning_document_assignments
    WHERE planning_document_assignments.accompagnant_user_id = auth.uid()
  ));

-- planning_shifts (accompagnante_user_id -> accompagnant_user_id)
CREATE POLICY "Accompagnant reads own shifts" ON planning_shifts
  FOR SELECT USING (accompagnant_user_id = auth.uid());

CREATE POLICY "Accompagne manages own shifts" ON planning_shifts
  FOR ALL USING (accompagne_id IN (
    SELECT accompagnes_profiles.id FROM accompagnes_profiles
    WHERE accompagnes_profiles.user_id = auth.uid()
  ));

-- storage.objects (planning-documents bucket, refere accompagnant_user_id)
CREATE POLICY "Planning document readers can download" ON storage.objects FOR SELECT
USING (
  bucket_id = 'planning-documents'::text
  AND (
    (storage.foldername(name))[1] = (auth.uid())::text
    OR auth.uid() IN (
      SELECT pda.accompagnant_user_id
      FROM planning_document_assignments pda
      JOIN planning_documents pd ON pd.id = pda.document_id
      WHERE pd.file_path = objects.name
    )
  )
);

-- =====================================================================
-- 6. Validation finale
-- =====================================================================

DO $$
DECLARE
  policies_count INTEGER;
  helper_exists BOOLEAN;
BEGIN
  SELECT COUNT(*) INTO policies_count FROM pg_policies
  WHERE qual LIKE '%accompagn%' OR with_check LIKE '%accompagn%'
    OR qual LIKE '%is_accompagn%' OR with_check LIKE '%is_accompagn%';
  IF policies_count < 22 THEN
    RAISE EXCEPTION 'Migration 5.A.2 part 2 : seulement % policies recreees (attendu >= 22)', policies_count;
  END IF;

  SELECT EXISTS (SELECT 1 FROM pg_proc WHERE proname = 'is_accompagnant') INTO helper_exists;
  IF NOT helper_exists THEN
    RAISE EXCEPTION 'Migration 5.A.2 part 2 : helper is_accompagnant absent';
  END IF;
END $$;
