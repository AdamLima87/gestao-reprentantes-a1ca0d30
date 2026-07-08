DROP POLICY IF EXISTS empresa_read_privileged ON public.configuracoes_empresa;

CREATE POLICY empresa_read_privileged ON public.configuracoes_empresa
FOR SELECT TO authenticated
USING (
  public.has_role(auth.uid(), 'admin'::public.app_role)
  OR public.has_role(auth.uid(), 'gestor'::public.app_role)
  OR public.has_role(auth.uid(), 'vendedor_interno'::public.app_role)
  OR public.has_role(auth.uid(), 'financeiro'::public.app_role)
  OR public.has_permission(auth.uid(), 'gerar_contrato_pdf')
  OR public.has_permission(auth.uid(), 'enviar_contrato_assinatura')
  OR public.has_permission(auth.uid(), 'visualizar_contratos_assinatura')
);