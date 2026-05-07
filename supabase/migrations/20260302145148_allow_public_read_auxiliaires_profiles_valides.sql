DROP POLICY IF EXISTS "aux_select_own" ON auxiliaires_profiles;

CREATE POLICY "aux_select_own" ON auxiliaires_profiles
  FOR SELECT
  USING (
    (user_id = auth.uid())
    OR is_admin()
    OR (validation_status = 'valide')
  );
