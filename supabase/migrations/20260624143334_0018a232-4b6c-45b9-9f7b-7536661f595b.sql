-- Update SELECT policies on nfe and comissoes to respect the new
-- per-user "ver_todas_nfe" and "ver_todas_comissoes" permissions.

DROP POLICY IF EXISTS nfe_read ON public.nfe;
CREATE POLICY nfe_read ON public.nfe
FOR SELECT
USING (
  public.has_role(auth.uid(), 'admin')
  OR public.has_permission(auth.uid(), 'ver_todas_nfe')
  OR (
    public.has_permission(auth.uid(), 'ver_nfe')
    AND EXISTS (
      SELECT 1 FROM public.pedidos p
      WHERE p.id = nfe.pedido_id
        AND p.representante_id = public.current_representante_id()
    )
  )
  OR EXISTS (
    SELECT 1 FROM public.pedidos p
    WHERE p.id = nfe.pedido_id
      AND p.representante_id = public.current_representante_id()
  )
);

DROP POLICY IF EXISTS comissoes_read ON public.comissoes;
CREATE POLICY comissoes_read ON public.comissoes
FOR SELECT
USING (
  public.has_role(auth.uid(), 'admin')
  OR public.has_permission(auth.uid(), 'ver_todas_comissoes')
  OR (
    public.has_permission(auth.uid(), 'ver_comissoes')
    AND representante_id = public.current_representante_id()
  )
  OR representante_id = public.current_representante_id()
);
