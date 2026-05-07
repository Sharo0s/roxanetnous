DROP POLICY users_select_own ON users;
CREATE POLICY users_select_own ON users FOR SELECT USING (
  id = auth.uid()
  OR is_admin()
  OR auth.uid() IS NOT NULL
);
