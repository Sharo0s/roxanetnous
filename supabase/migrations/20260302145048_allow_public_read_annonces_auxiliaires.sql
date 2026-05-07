DROP POLICY IF EXISTS "ann_aux_select" ON annonces_auxiliaires;

CREATE POLICY "ann_aux_select" ON annonces_auxiliaires
  FOR SELECT
  USING (
    is_admin()
    OR (auxiliaire_id IN (
      SELECT id FROM auxiliaires_profiles WHERE user_id = auth.uid()
    ))
    OR (status = 'publiee')
  );
