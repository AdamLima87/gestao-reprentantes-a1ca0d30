CREATE TABLE public.extratos_enviados (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  representante_id uuid NOT NULL REFERENCES public.representantes(id) ON DELETE CASCADE,
  mes int NOT NULL,
  ano int NOT NULL,
  enviado_por uuid REFERENCES auth.users(id),
  email_destino text,
  enviado_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT ON public.extratos_enviados TO authenticated;
GRANT ALL ON public.extratos_enviados TO service_role;

ALTER TABLE public.extratos_enviados ENABLE ROW LEVEL SECURITY;

CREATE POLICY "extratos_enviados_select_admin_gestor"
ON public.extratos_enviados FOR SELECT
TO authenticated
USING (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'gestor'));

CREATE POLICY "extratos_enviados_insert_admin_gestor"
ON public.extratos_enviados FOR INSERT
TO authenticated
WITH CHECK (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'gestor'));

CREATE INDEX idx_extratos_enviados_rep_periodo ON public.extratos_enviados(representante_id, ano, mes);