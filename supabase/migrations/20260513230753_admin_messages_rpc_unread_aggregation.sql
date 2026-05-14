-- Story 7.A.4 : aggregation 1-round-trip de la liste admin/accompagnant + unread count
-- par conversation. Remplace la boucle N+1 cote `app/admin/messages/page.tsx`.
-- Pattern projet : SECURITY DEFINER + check is_admin() upfront + REVOKE PUBLIC + GRANT
-- authenticated, aligne sur try_consume_rate_limit / merge_parrainage_flag_suspicion.

CREATE OR REPLACE FUNCTION public.get_admin_conversations_with_unread(
  p_current_user_id uuid,
  p_limit int DEFAULT 100,
  p_offset int DEFAULT 0
)
RETURNS TABLE (
  conversation_id uuid,
  last_message_at timestamptz,
  accompagnant_user_id uuid,
  accompagnant_first_name text,
  accompagnant_last_name text,
  accompagnant_email text,
  unread_count bigint
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT public.is_admin() THEN
    RAISE EXCEPTION 'get_admin_conversations_with_unread requires admin role' USING ERRCODE = '42501';
  END IF;

  RETURN QUERY
  SELECT
    c.id AS conversation_id,
    c.last_message_at,
    u.id AS accompagnant_user_id,
    u.first_name AS accompagnant_first_name,
    u.last_name AS accompagnant_last_name,
    u.email AS accompagnant_email,
    COALESCE((
      SELECT COUNT(*) FROM public.messages m
      WHERE m.conversation_id = c.id
        AND p_current_user_id IS NOT NULL
        AND m.sender_id IS DISTINCT FROM p_current_user_id
        AND m.read_at IS NULL
    ), 0)::bigint AS unread_count
  FROM public.conversations c
  JOIN public.accompagnants_profiles ap ON ap.id = c.accompagnant_id
  JOIN public.users u ON u.id = ap.user_id
  WHERE c.admin_id IS NOT NULL
  ORDER BY c.last_message_at DESC NULLS LAST
  LIMIT p_limit OFFSET p_offset;
END;
$$;

REVOKE ALL ON FUNCTION public.get_admin_conversations_with_unread(uuid, int, int) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.get_admin_conversations_with_unread(uuid, int, int) FROM anon;
GRANT EXECUTE ON FUNCTION public.get_admin_conversations_with_unread(uuid, int, int) TO authenticated;

COMMENT ON FUNCTION public.get_admin_conversations_with_unread(uuid, int, int) IS
  'Story 7.A.4 : aggregation 1-round-trip de la liste admin/accompagnant + unread count par conversation. Check is_admin() interne (defense en profondeur, attendu deja garanti par la page Next.js). Ordre : last_message_at DESC NULLS LAST.';
