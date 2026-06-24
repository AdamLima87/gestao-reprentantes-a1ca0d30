DROP POLICY IF EXISTS "pedidos_read" ON public.pedidos;
CREATE POLICY "pedidos_read" ON public.pedidos FOR SELECT TO authenticated USING (
  public.has_role(auth.uid(),'admin'::app_role) OR public.has_role(auth.uid(),'gestor'::app_role)
  OR public.has_role(auth.uid(),'vendedor_interno'::app_role) OR public.has_role(auth.uid(),'financeiro'::app_role)
  OR public.has_permission(auth.uid(),'ver_pedidos')
  OR representante_id = public.current_representante_id()
);

DROP POLICY IF EXISTS "nfe_read" ON public.nfe;
CREATE POLICY "nfe_read" ON public.nfe FOR SELECT TO authenticated USING (
  public.has_role(auth.uid(),'admin'::app_role) OR public.has_role(auth.uid(),'gestor'::app_role)
  OR public.has_role(auth.uid(),'vendedor_interno'::app_role) OR public.has_role(auth.uid(),'financeiro'::app_role)
  OR public.has_permission(auth.uid(),'ver_todas_nfe')
  OR EXISTS (SELECT 1 FROM public.pedidos p WHERE p.id = nfe.pedido_id AND p.representante_id = public.current_representante_id())
);

DROP POLICY IF EXISTS "comissoes_read" ON public.comissoes;
CREATE POLICY "comissoes_read" ON public.comissoes FOR SELECT TO authenticated USING (
  public.has_role(auth.uid(),'admin'::app_role) OR public.has_role(auth.uid(),'gestor'::app_role)
  OR public.has_role(auth.uid(),'vendedor_interno'::app_role) OR public.has_role(auth.uid(),'financeiro'::app_role)
  OR public.has_permission(auth.uid(),'ver_todas_comissoes')
  OR representante_id = public.current_representante_id()
);

DROP POLICY IF EXISTS "clientes_read" ON public.clientes;
CREATE POLICY "clientes_read" ON public.clientes FOR SELECT TO authenticated USING (
  public.has_role(auth.uid(),'admin'::app_role) OR public.has_role(auth.uid(),'gestor'::app_role)
  OR public.has_role(auth.uid(),'vendedor_interno'::app_role) OR public.has_role(auth.uid(),'financeiro'::app_role)
  OR public.has_permission(auth.uid(),'ver_clientes')
  OR representante_id = public.current_representante_id()
);

DROP POLICY IF EXISTS "rep_read_all" ON public.representantes;
CREATE POLICY "rep_read_all" ON public.representantes FOR SELECT TO authenticated USING (true);