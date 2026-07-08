DROP POLICY IF EXISTS empresa_read_privileged ON public.configuracoes_empresa;
CREATE POLICY empresa_read_privileged ON public.configuracoes_empresa
FOR SELECT TO authenticated
USING (
  has_role(auth.uid(), 'admin'::app_role)
  OR has_role(auth.uid(), 'gestor'::app_role)
  OR has_role(auth.uid(), 'vendedor_interno'::app_role)
  OR has_role(auth.uid(), 'financeiro'::app_role)
);

DROP POLICY IF EXISTS empresa_admin_all ON public.configuracoes_empresa;
CREATE POLICY empresa_write_admin_gestor ON public.configuracoes_empresa
FOR ALL TO authenticated
USING (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'gestor'::app_role))
WITH CHECK (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'gestor'::app_role));