
CREATE OR REPLACE FUNCTION public.is_representante_interno(_user uuid)
RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.representantes r
    JOIN public.profiles p ON p.representante_id = r.id
    WHERE p.id = _user AND r.tipo = 'interno'
  )
$$;

DROP POLICY IF EXISTS rep_read_own_or_internal ON public.representantes;
CREATE POLICY rep_read_own_or_internal ON public.representantes
FOR SELECT TO authenticated
USING (
  public.has_role(auth.uid(), 'admin')
  OR id = public.current_representante_id()
  OR public.is_representante_interno(auth.uid())
);

DROP POLICY IF EXISTS metas_read ON public.metas;
CREATE POLICY metas_read ON public.metas
FOR SELECT TO authenticated
USING (
  public.has_role(auth.uid(), 'admin')
  OR representante_id = public.current_representante_id()
  OR public.is_representante_interno(auth.uid())
);
