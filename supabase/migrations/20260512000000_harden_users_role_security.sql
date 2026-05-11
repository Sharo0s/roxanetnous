-- Durcissement securite des roles utilisateurs (defense en profondeur)
--
-- Deux vulnerabilites pre-existantes corrigees :
--
-- 1. handle_new_user() acceptait raw_user_meta_data->>'role' brut, donc une
--    valeur 'admin' passee au signup (TypeScript cast pur sans validation)
--    aurait insere directement role='admin' dans public.users.
--    Correction : forcer role IN ('accompagnante','accompagne'), fallback
--    'accompagne' en cas de valeur invalide.
--
-- 2. La policy users_update_own avait WITH CHECK = NULL, donc un utilisateur
--    authentifie pouvait UPDATE sa propre ligne (id = auth.uid()) et changer
--    n'importe quelle colonne, y compris 'role' = 'admin'.
--    Correction : ajouter WITH CHECK qui interdit a un non-admin de modifier
--    sa propre colonne role.

-- 1. Durcissement du trigger handle_new_user
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
DECLARE
  v_role public.user_role;
  v_role_text text;
BEGIN
  v_role_text := NEW.raw_user_meta_data->>'role';

  IF v_role_text IN ('accompagnante', 'accompagne') THEN
    v_role := v_role_text::public.user_role;
  ELSE
    -- Toute valeur hors whitelist (NULL, 'admin', autre) -> fallback sur
    -- 'accompagne'. Aucune escalade possible via raw_user_meta_data.
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
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- 2. Ajout d'un WITH CHECK sur users_update_own
-- Un utilisateur peut mettre a jour son propre row mais ne peut pas modifier
-- sa colonne role (sauf admin). Le SELECT dans le WITH CHECK est evalue par
-- rapport a l'etat AVANT update, donc compare NEW.role a l'ancien role.
DROP POLICY IF EXISTS users_update_own ON public.users;

CREATE POLICY users_update_own ON public.users
  FOR UPDATE
  USING ((id = auth.uid()) OR public.is_admin())
  WITH CHECK (
    public.is_admin()
    OR (
      id = auth.uid()
      AND role = (SELECT u.role FROM public.users u WHERE u.id = auth.uid())
    )
  );
