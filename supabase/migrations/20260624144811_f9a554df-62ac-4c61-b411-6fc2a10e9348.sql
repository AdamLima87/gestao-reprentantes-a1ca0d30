DROP POLICY IF EXISTS "nfe_read" ON public.nfe;
CREATE POLICY "nfe_read" ON public.nfe
  FOR SELECT TO authenticated
  USING (
    public.has_role(auth.uid(), 'admin')
    OR public.has_role(auth.uid(), 'vendedor_interno')
    OR public.has_role(auth.uid(), 'financeiro')
    OR public.has_permission(auth.uid(), 'ver_todas_nfe')
    OR EXISTS (
      SELECT 1 FROM public.pedidos p
      WHERE p.id = nfe.pedido_id
        AND p.representante_id = public.current_representante_id()
    )
  );

DROP POLICY IF EXISTS "comissoes_read" ON public.comissoes;
CREATE POLICY "comissoes_read" ON public.comissoes
  FOR SELECT TO authenticated
  USING (
    public.has_role(auth.uid(), 'admin')
    OR public.has_role(auth.uid(), 'vendedor_interno')
    OR public.has_role(auth.uid(), 'financeiro')
    OR public.has_permission(auth.uid(), 'ver_todas_comissoes')
    OR representante_id = public.current_representante_id()
  );
