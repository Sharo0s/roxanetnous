DROP POLICY IF EXISTS ben_select_own ON beneficiaires_profiles;
CREATE POLICY ben_select_own ON beneficiaires_profiles
  FOR SELECT
  USING (auth.uid() IS NOT NULL);
