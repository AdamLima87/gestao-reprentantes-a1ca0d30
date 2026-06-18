REVOKE EXECUTE ON FUNCTION public.ensure_vendedor_interno_representante() FROM authenticated;
REVOKE EXECUTE ON FUNCTION public.calcular_comissoes_nfe() FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.calcular_comissoes_nfe() FROM anon;
REVOKE EXECUTE ON FUNCTION public.calcular_comissoes_nfe() FROM authenticated;
REVOKE EXECUTE ON FUNCTION public.recalcular_comissoes_sem_auth() FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.recalcular_comissoes_sem_auth() FROM anon;
REVOKE EXECUTE ON FUNCTION public.recalcular_comissoes_sem_auth() FROM authenticated;