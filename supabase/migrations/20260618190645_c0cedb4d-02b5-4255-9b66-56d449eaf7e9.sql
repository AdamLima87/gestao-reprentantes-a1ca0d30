
DROP TRIGGER IF EXISTS trg_calcular_comissoes ON public.nfe;
DROP TRIGGER IF EXISTS calc_comissoes_on_nfe_trigger ON public.nfe;
DROP FUNCTION IF EXISTS public.calcular_comissoes_nfe() CASCADE;
DROP FUNCTION IF EXISTS public.calc_comissoes_on_nfe() CASCADE;
