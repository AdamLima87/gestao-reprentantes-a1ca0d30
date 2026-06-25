
CREATE POLICY "Admin/gestor leem contratos assinados"
ON storage.objects FOR SELECT
TO authenticated
USING (
  bucket_id = 'contratos-assinados'
  AND (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'gestor'))
);
