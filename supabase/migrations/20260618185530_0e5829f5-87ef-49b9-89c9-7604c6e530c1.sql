
REVOKE EXECUTE ON FUNCTION public.calcular_comissoes_nfe() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.calc_comissoes_on_nfe() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.handle_new_user() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.has_role(uuid, public.app_role) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.is_representante_interno(uuid) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.current_representante_id() FROM PUBLIC, anon;
