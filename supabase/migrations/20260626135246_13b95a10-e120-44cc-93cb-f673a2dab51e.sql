
ALTER TABLE public.contratos_assinatura
  ADD COLUMN IF NOT EXISTS tipo text NOT NULL DEFAULT 'd4sign',
  ADD COLUMN IF NOT EXISTS observacao text;

ALTER TABLE public.contratos_assinatura
  DROP CONSTRAINT IF EXISTS contratos_assinatura_tipo_check;
ALTER TABLE public.contratos_assinatura
  ADD CONSTRAINT contratos_assinatura_tipo_check CHECK (tipo IN ('d4sign','externo'));

-- Storage policies for bucket "contratos" (admin/gestor only)
DROP POLICY IF EXISTS "contratos_admin_gestor_select" ON storage.objects;
CREATE POLICY "contratos_admin_gestor_select" ON storage.objects
  FOR SELECT TO authenticated
  USING (
    bucket_id = 'contratos'
    AND (public.has_role(auth.uid(), 'admin'::public.app_role)
      OR public.has_role(auth.uid(), 'gestor'::public.app_role))
  );

DROP POLICY IF EXISTS "contratos_admin_gestor_insert" ON storage.objects;
CREATE POLICY "contratos_admin_gestor_insert" ON storage.objects
  FOR INSERT TO authenticated
  WITH CHECK (
    bucket_id = 'contratos'
    AND (public.has_role(auth.uid(), 'admin'::public.app_role)
      OR public.has_role(auth.uid(), 'gestor'::public.app_role))
  );

DROP POLICY IF EXISTS "contratos_admin_gestor_update" ON storage.objects;
CREATE POLICY "contratos_admin_gestor_update" ON storage.objects
  FOR UPDATE TO authenticated
  USING (
    bucket_id = 'contratos'
    AND (public.has_role(auth.uid(), 'admin'::public.app_role)
      OR public.has_role(auth.uid(), 'gestor'::public.app_role))
  );

DROP POLICY IF EXISTS "contratos_admin_gestor_delete" ON storage.objects;
CREATE POLICY "contratos_admin_gestor_delete" ON storage.objects
  FOR DELETE TO authenticated
  USING (
    bucket_id = 'contratos'
    AND (public.has_role(auth.uid(), 'admin'::public.app_role)
      OR public.has_role(auth.uid(), 'gestor'::public.app_role))
  );
