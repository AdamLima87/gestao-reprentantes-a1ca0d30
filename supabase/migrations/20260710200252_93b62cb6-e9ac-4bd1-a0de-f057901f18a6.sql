
-- Signed contracts bucket: allow admin/gestor to manage files
CREATE POLICY "Admin/gestor inserem contratos assinados"
ON storage.objects FOR INSERT TO authenticated
WITH CHECK (
  bucket_id = 'contratos-assinados'
  AND (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'gestor'::app_role))
);

CREATE POLICY "Admin/gestor atualizam contratos assinados"
ON storage.objects FOR UPDATE TO authenticated
USING (
  bucket_id = 'contratos-assinados'
  AND (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'gestor'::app_role))
)
WITH CHECK (
  bucket_id = 'contratos-assinados'
  AND (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'gestor'::app_role))
);

CREATE POLICY "Admin/gestor removem contratos assinados"
ON storage.objects FOR DELETE TO authenticated
USING (
  bucket_id = 'contratos-assinados'
  AND (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'gestor'::app_role))
);

-- login_attempts: explicitly block client-side inserts. Server writes use service_role which bypasses RLS.
CREATE POLICY "Bloqueia inserts de clientes em login_attempts"
ON public.login_attempts FOR INSERT TO anon, authenticated
WITH CHECK (false);

CREATE POLICY "Bloqueia updates de clientes em login_attempts"
ON public.login_attempts FOR UPDATE TO anon, authenticated
USING (false) WITH CHECK (false);

CREATE POLICY "Bloqueia deletes de clientes em login_attempts"
ON public.login_attempts FOR DELETE TO anon, authenticated
USING (false);
