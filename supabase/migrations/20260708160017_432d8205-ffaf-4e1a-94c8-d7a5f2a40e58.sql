DO $$
DECLARE
  v_keep_id uuid;
  v_target_id uuid := '00000000-0000-0000-0000-000000000001'::uuid;
BEGIN
  SELECT id INTO v_keep_id
  FROM public.configuracoes_empresa
  ORDER BY
    CASE WHEN NULLIF(TRIM(COALESCE(razao_social, '')), '') IS NOT NULL THEN 0 ELSE 1 END,
    updated_at DESC NULLS LAST,
    created_at DESC NULLS LAST
  LIMIT 1;

  IF v_keep_id IS NOT NULL THEN
    DELETE FROM public.configuracoes_empresa
    WHERE id <> v_keep_id;

    UPDATE public.configuracoes_empresa
    SET id = v_target_id
    WHERE id = v_keep_id
      AND NOT EXISTS (
        SELECT 1 FROM public.configuracoes_empresa WHERE id = v_target_id
      );
  END IF;
END $$;

CREATE UNIQUE INDEX IF NOT EXISTS configuracoes_empresa_singleton_idx
ON public.configuracoes_empresa ((true));

DROP POLICY IF EXISTS empresa_write_admin_gestor ON public.configuracoes_empresa;
DROP POLICY IF EXISTS empresa_admin_all ON public.configuracoes_empresa;

CREATE POLICY empresa_admin_all ON public.configuracoes_empresa
FOR ALL TO authenticated
USING (public.has_role(auth.uid(), 'admin'::public.app_role))
WITH CHECK (public.has_role(auth.uid(), 'admin'::public.app_role));