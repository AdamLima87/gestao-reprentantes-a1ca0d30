
-- Trigger-only functions: revoke from everyone (only triggers invoke them)
REVOKE EXECUTE ON FUNCTION public.handle_new_user() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.calcular_comissoes_nfe() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.remover_comissoes_pedido_cancelado() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.remover_comissoes_nfe_excluida() FROM PUBLIC, anon, authenticated;

-- Internal helpers (called by other SECURITY DEFINER fns / migrations): revoke from anon
REVOKE EXECUTE ON FUNCTION public.ensure_vendedor_interno_representante() FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.recalcular_comissoes_sem_auth() FROM PUBLIC, anon, authenticated;

-- Functions used in RLS policies and by signed-in users: revoke from anon only
REVOKE EXECUTE ON FUNCTION public.has_role(uuid, public.app_role) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.is_representante_interno(uuid) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.current_representante_id() FROM PUBLIC, anon;

-- Admin-only RPC: revoke from anon (function itself checks admin role)
REVOKE EXECUTE ON FUNCTION public.reprocessar_comissoes() FROM PUBLIC, anon;
