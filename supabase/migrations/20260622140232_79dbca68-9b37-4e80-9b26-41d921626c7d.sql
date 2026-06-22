
CREATE POLICY "auth can upload comprovantes" ON storage.objects
  FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'comprovantes-comissoes');

CREATE POLICY "auth can read comprovantes" ON storage.objects
  FOR SELECT TO authenticated
  USING (bucket_id = 'comprovantes-comissoes');

CREATE POLICY "admin/financeiro can update comprovantes" ON storage.objects
  FOR UPDATE TO authenticated
  USING (bucket_id = 'comprovantes-comissoes' AND (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'financeiro')));

CREATE POLICY "admin/financeiro can delete comprovantes" ON storage.objects
  FOR DELETE TO authenticated
  USING (bucket_id = 'comprovantes-comissoes' AND (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'financeiro')));
