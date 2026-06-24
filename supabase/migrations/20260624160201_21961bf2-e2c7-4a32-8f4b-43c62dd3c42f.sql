DROP POLICY IF EXISTS "rep_read_all" ON public.representantes;
DROP POLICY IF EXISTS "rep_read_own_or_internal" ON public.representantes;

CREATE POLICY "rep_read_scoped" ON public.representantes
  FOR SELECT TO authenticated
  USING (
    public.has_role(auth.uid(), 'admin'::public.app_role)
    OR public.has_role(auth.uid(), 'gestor'::public.app_role)
    OR public.has_role(auth.uid(), 'vendedor_interno'::public.app_role)
    OR public.has_role(auth.uid(), 'financeiro'::public.app_role)
    OR public.is_representante_interno(auth.uid())
    OR id = public.current_representante_id()
  );