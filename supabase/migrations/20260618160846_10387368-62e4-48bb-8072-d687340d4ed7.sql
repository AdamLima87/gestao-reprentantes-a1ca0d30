
DROP POLICY IF EXISTS metas_read ON public.metas;
CREATE POLICY metas_read ON public.metas FOR SELECT TO authenticated
USING (
  has_role(auth.uid(), 'admin'::app_role)
  OR representante_id = public.current_representante_id()
  OR EXISTS (
    SELECT 1 FROM public.representantes r
    WHERE r.id = public.current_representante_id() AND r.tipo = 'interno'
  )
);

DROP POLICY IF EXISTS rep_read_all ON public.representantes;
CREATE POLICY rep_read_own_or_internal ON public.representantes FOR SELECT TO authenticated
USING (
  has_role(auth.uid(), 'admin'::app_role)
  OR id = public.current_representante_id()
  OR EXISTS (
    SELECT 1 FROM public.representantes r
    WHERE r.id = public.current_representante_id() AND r.tipo = 'interno'
  )
);

CREATE OR REPLACE FUNCTION public.current_representante_id()
RETURNS uuid
LANGUAGE sql
STABLE
SECURITY INVOKER
SET search_path TO 'public'
AS $$
  SELECT representante_id FROM public.profiles WHERE id = auth.uid()
$$;
