REVOKE EXECUTE ON FUNCTION public.verificar_rate_limit_login(text) FROM PUBLIC, anon, authenticated;

REVOKE EXECUTE ON FUNCTION public.marcar_comissoes_pagas_lote(uuid[], date, text, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.marcar_comissoes_pagas_lote(uuid[], date, text, text) TO authenticated;