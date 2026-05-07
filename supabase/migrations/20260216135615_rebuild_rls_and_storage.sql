
-- =============================================
-- Part 2: RLS Policies + Storage
-- =============================================

-- Enable RLS on all tables
ALTER TABLE users ENABLE ROW LEVEL SECURITY;
ALTER TABLE auxiliaires_profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE beneficiaires_profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE subscriptions ENABLE ROW LEVEL SECURITY;
ALTER TABLE annonces_auxiliaires ENABLE ROW LEVEL SECURITY;
ALTER TABLE annonces_beneficiaires ENABLE ROW LEVEL SECURITY;
ALTER TABLE favoris ENABLE ROW LEVEL SECURITY;
ALTER TABLE conversations ENABLE ROW LEVEL SECURITY;
ALTER TABLE messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE avis ENABLE ROW LEVEL SECURITY;
ALTER TABLE signalements ENABLE ROW LEVEL SECURITY;
ALTER TABLE notifications_log ENABLE ROW LEVEL SECURITY;
ALTER TABLE badges_cache ENABLE ROW LEVEL SECURITY;
ALTER TABLE admin_actions_log ENABLE ROW LEVEL SECURITY;
ALTER TABLE ocr_results ENABLE ROW LEVEL SECURITY;

-- USERS policies
CREATE POLICY "users_select_own" ON users FOR SELECT USING (id = auth.uid() OR public.is_admin());
CREATE POLICY "users_insert_own" ON users FOR INSERT WITH CHECK (id = auth.uid());
CREATE POLICY "users_update_own" ON users FOR UPDATE USING (id = auth.uid() OR public.is_admin());
CREATE POLICY "users_delete_own" ON users FOR DELETE USING (id = auth.uid() OR public.is_admin());

-- AUXILIAIRES_PROFILES policies
CREATE POLICY "aux_select_own" ON auxiliaires_profiles FOR SELECT USING (
  user_id = auth.uid()
  OR public.is_admin()
  OR (validation_status = 'valide' AND public.has_active_subscription())
);
CREATE POLICY "aux_insert_own" ON auxiliaires_profiles FOR INSERT WITH CHECK (user_id = auth.uid());
CREATE POLICY "aux_update_own" ON auxiliaires_profiles FOR UPDATE USING (user_id = auth.uid() OR public.is_admin());
CREATE POLICY "aux_delete_own" ON auxiliaires_profiles FOR DELETE USING (user_id = auth.uid() OR public.is_admin());

-- BENEFICIAIRES_PROFILES policies
CREATE POLICY "ben_select_own" ON beneficiaires_profiles FOR SELECT USING (
  user_id = auth.uid() OR public.is_admin()
);
CREATE POLICY "ben_insert_own" ON beneficiaires_profiles FOR INSERT WITH CHECK (user_id = auth.uid());
CREATE POLICY "ben_update_own" ON beneficiaires_profiles FOR UPDATE USING (user_id = auth.uid() OR public.is_admin());
CREATE POLICY "ben_delete_own" ON beneficiaires_profiles FOR DELETE USING (user_id = auth.uid() OR public.is_admin());

-- SUBSCRIPTIONS policies
CREATE POLICY "sub_select_own" ON subscriptions FOR SELECT USING (user_id = auth.uid() OR public.is_admin());
CREATE POLICY "sub_insert_service" ON subscriptions FOR INSERT WITH CHECK (public.is_admin() OR user_id = auth.uid());
CREATE POLICY "sub_update_service" ON subscriptions FOR UPDATE USING (public.is_admin());
CREATE POLICY "sub_delete_service" ON subscriptions FOR DELETE USING (public.is_admin());

-- ANNONCES_AUXILIAIRES policies
CREATE POLICY "ann_aux_select" ON annonces_auxiliaires FOR SELECT USING (
  public.is_admin()
  OR auxiliaire_id IN (SELECT id FROM auxiliaires_profiles WHERE user_id = auth.uid())
  OR (status = 'publiee' AND public.has_active_subscription())
);
CREATE POLICY "ann_aux_insert" ON annonces_auxiliaires FOR INSERT WITH CHECK (
  auxiliaire_id IN (SELECT id FROM auxiliaires_profiles WHERE user_id = auth.uid())
);
CREATE POLICY "ann_aux_update" ON annonces_auxiliaires FOR UPDATE USING (
  auxiliaire_id IN (SELECT id FROM auxiliaires_profiles WHERE user_id = auth.uid()) OR public.is_admin()
);
CREATE POLICY "ann_aux_delete" ON annonces_auxiliaires FOR DELETE USING (
  auxiliaire_id IN (SELECT id FROM auxiliaires_profiles WHERE user_id = auth.uid()) OR public.is_admin()
);

-- ANNONCES_BENEFICIAIRES policies
CREATE POLICY "ann_ben_select" ON annonces_beneficiaires FOR SELECT USING (
  public.is_admin()
  OR beneficiaire_id IN (SELECT id FROM beneficiaires_profiles WHERE user_id = auth.uid())
  OR (status = 'publiee' AND public.has_active_subscription())
);
CREATE POLICY "ann_ben_insert" ON annonces_beneficiaires FOR INSERT WITH CHECK (
  beneficiaire_id IN (SELECT id FROM beneficiaires_profiles WHERE user_id = auth.uid())
);
CREATE POLICY "ann_ben_update" ON annonces_beneficiaires FOR UPDATE USING (
  beneficiaire_id IN (SELECT id FROM beneficiaires_profiles WHERE user_id = auth.uid()) OR public.is_admin()
);
CREATE POLICY "ann_ben_delete" ON annonces_beneficiaires FOR DELETE USING (
  beneficiaire_id IN (SELECT id FROM beneficiaires_profiles WHERE user_id = auth.uid()) OR public.is_admin()
);

-- FAVORIS policies
CREATE POLICY "fav_select_own" ON favoris FOR SELECT USING (user_id = auth.uid() OR public.is_admin());
CREATE POLICY "fav_insert_own" ON favoris FOR INSERT WITH CHECK (user_id = auth.uid());
CREATE POLICY "fav_delete_own" ON favoris FOR DELETE USING (user_id = auth.uid());

-- CONVERSATIONS policies
CREATE POLICY "conv_select_own" ON conversations FOR SELECT USING (
  public.is_admin()
  OR auxiliaire_id IN (SELECT id FROM auxiliaires_profiles WHERE user_id = auth.uid())
  OR beneficiaire_id IN (SELECT id FROM beneficiaires_profiles WHERE user_id = auth.uid())
);
CREATE POLICY "conv_insert_own" ON conversations FOR INSERT WITH CHECK (
  auxiliaire_id IN (SELECT id FROM auxiliaires_profiles WHERE user_id = auth.uid())
  OR beneficiaire_id IN (SELECT id FROM beneficiaires_profiles WHERE user_id = auth.uid())
);
CREATE POLICY "conv_update_own" ON conversations FOR UPDATE USING (
  public.is_admin()
  OR auxiliaire_id IN (SELECT id FROM auxiliaires_profiles WHERE user_id = auth.uid())
  OR beneficiaire_id IN (SELECT id FROM beneficiaires_profiles WHERE user_id = auth.uid())
);

-- MESSAGES policies
CREATE POLICY "msg_select_own" ON messages FOR SELECT USING (
  public.is_admin()
  OR conversation_id IN (
    SELECT id FROM conversations
    WHERE auxiliaire_id IN (SELECT id FROM auxiliaires_profiles WHERE user_id = auth.uid())
       OR beneficiaire_id IN (SELECT id FROM beneficiaires_profiles WHERE user_id = auth.uid())
  )
);
CREATE POLICY "msg_insert_own" ON messages FOR INSERT WITH CHECK (
  sender_id = auth.uid()
  AND conversation_id IN (
    SELECT id FROM conversations
    WHERE auxiliaire_id IN (SELECT id FROM auxiliaires_profiles WHERE user_id = auth.uid())
       OR beneficiaire_id IN (SELECT id FROM beneficiaires_profiles WHERE user_id = auth.uid())
  )
);
CREATE POLICY "msg_update_read" ON messages FOR UPDATE USING (
  public.is_admin()
  OR conversation_id IN (
    SELECT id FROM conversations
    WHERE auxiliaire_id IN (SELECT id FROM auxiliaires_profiles WHERE user_id = auth.uid())
       OR beneficiaire_id IN (SELECT id FROM beneficiaires_profiles WHERE user_id = auth.uid())
  )
);

-- AVIS policies
CREATE POLICY "avis_select_all" ON avis FOR SELECT USING (masque = false OR public.is_admin());
CREATE POLICY "avis_insert_own" ON avis FOR INSERT WITH CHECK (auteur_id = auth.uid());
CREATE POLICY "avis_update_own" ON avis FOR UPDATE USING (auteur_id = auth.uid() OR public.is_admin());
CREATE POLICY "avis_delete_own" ON avis FOR DELETE USING (auteur_id = auth.uid() OR public.is_admin());

-- SIGNALEMENTS policies
CREATE POLICY "sig_select" ON signalements FOR SELECT USING (auteur_id = auth.uid() OR public.is_admin());
CREATE POLICY "sig_insert" ON signalements FOR INSERT WITH CHECK (auteur_id = auth.uid());
CREATE POLICY "sig_update" ON signalements FOR UPDATE USING (public.is_admin());

-- NOTIFICATIONS_LOG policies
CREATE POLICY "notif_select_own" ON notifications_log FOR SELECT USING (user_id = auth.uid() OR public.is_admin());
CREATE POLICY "notif_insert" ON notifications_log FOR INSERT WITH CHECK (public.is_admin() OR user_id = auth.uid());

-- BADGES_CACHE policies
CREATE POLICY "badge_select" ON badges_cache FOR SELECT USING (true);
CREATE POLICY "badge_upsert" ON badges_cache FOR INSERT WITH CHECK (public.is_admin() OR user_id = auth.uid());
CREATE POLICY "badge_update" ON badges_cache FOR UPDATE USING (public.is_admin() OR user_id = auth.uid());

-- ADMIN_ACTIONS_LOG policies
CREATE POLICY "admin_log_select" ON admin_actions_log FOR SELECT USING (public.is_admin());
CREATE POLICY "admin_log_insert" ON admin_actions_log FOR INSERT WITH CHECK (public.is_admin());

-- OCR_RESULTS policies
CREATE POLICY "ocr_select" ON ocr_results FOR SELECT USING (public.is_admin());
CREATE POLICY "ocr_insert" ON ocr_results FOR INSERT WITH CHECK (public.is_admin());
CREATE POLICY "ocr_update" ON ocr_results FOR UPDATE USING (public.is_admin());

-- STORAGE BUCKET
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'justificatifs',
  'justificatifs',
  false,
  5242880,
  ARRAY['image/jpeg', 'image/png', 'image/webp', 'application/pdf']
)
ON CONFLICT (id) DO NOTHING;

-- Storage policies for justificatifs
CREATE POLICY "justificatifs_select" ON storage.objects FOR SELECT USING (
  bucket_id = 'justificatifs' AND (
    public.is_admin()
    OR (storage.foldername(name))[1] = auth.uid()::text
  )
);
CREATE POLICY "justificatifs_insert" ON storage.objects FOR INSERT WITH CHECK (
  bucket_id = 'justificatifs' AND (
    public.is_admin()
    OR (storage.foldername(name))[1] = auth.uid()::text
  )
);
CREATE POLICY "justificatifs_update" ON storage.objects FOR UPDATE USING (
  bucket_id = 'justificatifs' AND (
    public.is_admin()
    OR (storage.foldername(name))[1] = auth.uid()::text
  )
);
CREATE POLICY "justificatifs_delete" ON storage.objects FOR DELETE USING (
  bucket_id = 'justificatifs' AND (
    public.is_admin()
    OR (storage.foldername(name))[1] = auth.uid()::text
  )
);
