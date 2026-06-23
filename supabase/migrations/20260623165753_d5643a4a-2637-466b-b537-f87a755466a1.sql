
-- Remove overly permissive read policy on representantes; rely on rep_read_own_or_internal
DROP POLICY IF EXISTS "rep_read_all" ON public.representantes;

-- Revoke public/anon execute on has_permission (SECURITY DEFINER must not be callable by anon)
REVOKE EXECUTE ON FUNCTION public.has_permission(uuid, text) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.has_permission(uuid, text) FROM anon;
GRANT EXECUTE ON FUNCTION public.has_permission(uuid, text) TO authenticated, service_role;
