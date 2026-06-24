DROP POLICY IF EXISTS "comissoes_read" ON public.comissoes;

CREATE POLICY "comissoes_read" ON public.comissoes
  FOR SELECT TO authenticated
  USING (
    public.has_role(auth.uid(), 'admin')
    OR public.has_role(auth.uid(), 'gestor')
    OR public.has_role(auth.uid(), 'vendedor_interno')
    OR public.has_role(auth.uid(), 'financeiro')
    OR public.has_permission(auth.uid(), 'ver_todas_comissoes')
    OR representante_id = public.current_representante_id()
    OR gestor_user_id = auth.uid()
  );