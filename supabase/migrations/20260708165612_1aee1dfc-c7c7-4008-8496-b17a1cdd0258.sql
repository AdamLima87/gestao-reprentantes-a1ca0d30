
-- 1) Reforça WITH CHECK em policies write-scoped

-- nfe_update_admin: adicionar WITH CHECK
DROP POLICY IF EXISTS nfe_update_admin ON public.nfe;
CREATE POLICY nfe_update_admin ON public.nfe
FOR UPDATE TO authenticated
USING (has_role(auth.uid(), 'admin'::app_role))
WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

-- comissoes_financeiro_update: adicionar WITH CHECK espelhando USING
DROP POLICY IF EXISTS comissoes_financeiro_update ON public.comissoes;
CREATE POLICY comissoes_financeiro_update ON public.comissoes
FOR UPDATE TO authenticated
USING (
  has_role(auth.uid(), 'admin'::app_role)
  OR has_role(auth.uid(), 'financeiro'::app_role)
  OR has_permission(auth.uid(), 'marcar_comissao_paga'::text)
)
WITH CHECK (
  has_role(auth.uid(), 'admin'::app_role)
  OR has_role(auth.uid(), 'financeiro'::app_role)
  OR has_permission(auth.uid(), 'marcar_comissao_paga'::text)
);

-- pedidos_update: adicionar WITH CHECK espelhando USING (impede escapar do escopo do representante)
DROP POLICY IF EXISTS pedidos_update ON public.pedidos;
CREATE POLICY pedidos_update ON public.pedidos
FOR UPDATE TO authenticated
USING (
  has_role(auth.uid(), 'admin'::app_role)
  OR has_role(auth.uid(), 'vendedor_interno'::app_role)
  OR has_permission(auth.uid(), 'editar_pedidos'::text)
  OR (representante_id = current_representante_id())
)
WITH CHECK (
  has_role(auth.uid(), 'admin'::app_role)
  OR has_role(auth.uid(), 'vendedor_interno'::app_role)
  OR has_permission(auth.uid(), 'editar_pedidos'::text)
  OR (representante_id = current_representante_id())
);

-- 2) Revoga EXECUTE público de função SECURITY DEFINER (é trigger, não deve ser chamável)
REVOKE EXECUTE ON FUNCTION public.prevent_profile_sensitive_self_update() FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.prevent_profile_sensitive_self_update() FROM anon;
REVOKE EXECUTE ON FUNCTION public.prevent_profile_sensitive_self_update() FROM authenticated;
