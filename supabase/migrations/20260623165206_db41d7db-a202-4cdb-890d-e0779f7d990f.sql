CREATE OR REPLACE FUNCTION public.has_permission(uid uuid, perm text)
RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_permissions
    WHERE user_id = uid AND permissao = perm AND concedida = true
  );
$$;

DROP POLICY IF EXISTS "pedidos_insert" ON public.pedidos;
CREATE POLICY "pedidos_insert" ON public.pedidos
  FOR INSERT TO authenticated WITH CHECK (
    public.has_role(auth.uid(), 'admin')
    OR public.has_role(auth.uid(), 'vendedor_interno')
    OR public.has_permission(auth.uid(), 'criar_pedidos')
    OR representante_id = public.current_representante_id()
  );

DROP POLICY IF EXISTS "pedidos_update" ON public.pedidos;
CREATE POLICY "pedidos_update" ON public.pedidos
  FOR UPDATE TO authenticated USING (
    public.has_role(auth.uid(), 'admin')
    OR public.has_role(auth.uid(), 'vendedor_interno')
    OR public.has_permission(auth.uid(), 'editar_pedidos')
    OR representante_id = public.current_representante_id()
  );

DROP POLICY IF EXISTS "pedidos_read" ON public.pedidos;
CREATE POLICY "pedidos_read" ON public.pedidos
  FOR SELECT TO authenticated USING (
    public.has_role(auth.uid(), 'admin')
    OR public.has_role(auth.uid(), 'vendedor_interno')
    OR public.has_role(auth.uid(), 'financeiro')
    OR public.has_permission(auth.uid(), 'criar_pedidos')
    OR public.has_permission(auth.uid(), 'editar_pedidos')
    OR representante_id = public.current_representante_id()
  );

DROP POLICY IF EXISTS "clientes_read" ON public.clientes;
CREATE POLICY "clientes_read" ON public.clientes
  FOR SELECT TO authenticated USING (
    public.has_role(auth.uid(), 'admin')
    OR public.has_role(auth.uid(), 'vendedor_interno')
    OR public.has_role(auth.uid(), 'financeiro')
    OR public.has_permission(auth.uid(), 'criar_pedidos')
    OR public.has_permission(auth.uid(), 'cadastrar_clientes')
    OR representante_id = public.current_representante_id()
  );

DROP POLICY IF EXISTS "clientes_insert" ON public.clientes;
CREATE POLICY "clientes_insert" ON public.clientes
  FOR INSERT TO authenticated WITH CHECK (
    public.has_role(auth.uid(), 'admin')
    OR public.has_role(auth.uid(), 'vendedor_interno')
    OR public.has_permission(auth.uid(), 'cadastrar_clientes')
  );

DROP POLICY IF EXISTS "nfe_insert" ON public.nfe;
CREATE POLICY "nfe_insert" ON public.nfe
  FOR INSERT TO authenticated WITH CHECK (
    public.has_role(auth.uid(), 'admin')
    OR public.has_role(auth.uid(), 'vendedor_interno')
    OR public.has_role(auth.uid(), 'financeiro')
    OR public.has_permission(auth.uid(), 'registrar_nfe')
  );

DROP POLICY IF EXISTS "comissoes_financeiro_update" ON public.comissoes;
CREATE POLICY "comissoes_financeiro_update" ON public.comissoes
  FOR UPDATE TO authenticated USING (
    public.has_role(auth.uid(), 'admin')
    OR public.has_role(auth.uid(), 'financeiro')
    OR public.has_permission(auth.uid(), 'marcar_comissao_paga')
  );

DROP POLICY IF EXISTS "rep_read_all" ON public.representantes;
CREATE POLICY "rep_read_all" ON public.representantes
  FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS "rep_admin_all" ON public.representantes;
DROP POLICY IF EXISTS "rep_write" ON public.representantes;
CREATE POLICY "rep_write" ON public.representantes
  FOR ALL TO authenticated USING (
    public.has_role(auth.uid(), 'admin')
    OR public.has_permission(auth.uid(), 'cadastrar_representantes')
  ) WITH CHECK (
    public.has_role(auth.uid(), 'admin')
    OR public.has_permission(auth.uid(), 'cadastrar_representantes')
  );