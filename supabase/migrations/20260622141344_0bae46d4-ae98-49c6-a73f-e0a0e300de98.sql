
-- 1) configuracoes_empresa: restrict SELECT to admin/vendedor_interno/financeiro
DROP POLICY IF EXISTS empresa_read_auth ON public.configuracoes_empresa;
CREATE POLICY empresa_read_privileged ON public.configuracoes_empresa
  FOR SELECT TO authenticated
  USING (
    public.has_role(auth.uid(), 'admin')
    OR public.has_role(auth.uid(), 'vendedor_interno')
    OR public.has_role(auth.uid(), 'financeiro')
  );

-- 2) Storage: comprovantes-comissoes — tighten SELECT/INSERT
DROP POLICY IF EXISTS "auth can read comprovantes" ON storage.objects;
DROP POLICY IF EXISTS "auth can upload comprovantes" ON storage.objects;

-- Path format used by the app: "<comissao_id>/<timestamp>-<filename>"
-- Reps can read only receipts for their own commissions; admin/financeiro read all.
CREATE POLICY "comprovantes read privileged or owner rep" ON storage.objects
  FOR SELECT TO authenticated
  USING (
    bucket_id = 'comprovantes-comissoes'
    AND (
      public.has_role(auth.uid(), 'admin')
      OR public.has_role(auth.uid(), 'financeiro')
      OR EXISTS (
        SELECT 1
        FROM public.comissoes c
        JOIN public.profiles p ON p.representante_id = c.representante_id
        WHERE p.id = auth.uid()
          AND c.id::text = split_part(storage.objects.name, '/', 1)
      )
    )
  );

-- Only admin/financeiro can upload receipts.
CREATE POLICY "comprovantes upload privileged" ON storage.objects
  FOR INSERT TO authenticated
  WITH CHECK (
    bucket_id = 'comprovantes-comissoes'
    AND (
      public.has_role(auth.uid(), 'admin')
      OR public.has_role(auth.uid(), 'financeiro')
    )
  );
