-- Restringe execução de funções administrativas SECURITY DEFINER
-- Estas funções manipulam comissões em massa e não devem ser expostas ao PostgREST.
REVOKE EXECUTE ON FUNCTION public.recalcular_comissoes_sem_auth() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.recalcular_comissoes_representantes(integer, integer) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.recalcular_comissoes_gestor(integer, integer) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.recalcular_comissoes_interno(integer, integer) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.ensure_vendedor_interno_representante() FROM PUBLIC, anon, authenticated;

GRANT EXECUTE ON FUNCTION public.recalcular_comissoes_sem_auth() TO service_role;
GRANT EXECUTE ON FUNCTION public.recalcular_comissoes_representantes(integer, integer) TO service_role;
GRANT EXECUTE ON FUNCTION public.recalcular_comissoes_gestor(integer, integer) TO service_role;
GRANT EXECUTE ON FUNCTION public.recalcular_comissoes_interno(integer, integer) TO service_role;
GRANT EXECUTE ON FUNCTION public.ensure_vendedor_interno_representante() TO service_role;

-- reprocessar_comissoes já checa admin internamente e pode continuar acessível
-- aos autenticados (será usada pelo botão administrativo).