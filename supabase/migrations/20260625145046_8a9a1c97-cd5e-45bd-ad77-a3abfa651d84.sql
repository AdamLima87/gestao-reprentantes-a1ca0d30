-- Adiciona email ao representante (necessário para envio do contrato)
ALTER TABLE public.representantes ADD COLUMN IF NOT EXISTS email TEXT;

-- Tabela de contratos de assinatura
CREATE TABLE IF NOT EXISTS public.contratos_assinatura (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  representante_id UUID NOT NULL REFERENCES public.representantes(id) ON DELETE CASCADE,
  d4sign_document_uuid TEXT,
  status TEXT NOT NULL DEFAULT 'pendente',
  enviado_por UUID REFERENCES auth.users(id),
  enviado_at TIMESTAMPTZ,
  assinado_at TIMESTAMPTZ,
  url_download TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.contratos_assinatura TO authenticated;
GRANT ALL ON public.contratos_assinatura TO service_role;

ALTER TABLE public.contratos_assinatura ENABLE ROW LEVEL SECURITY;

CREATE POLICY "contratos_assinatura_admin_gestor_all" ON public.contratos_assinatura
  FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'gestor'))
  WITH CHECK (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'gestor'));

CREATE INDEX IF NOT EXISTS idx_contratos_assinatura_representante ON public.contratos_assinatura(representante_id);
CREATE INDEX IF NOT EXISTS idx_contratos_assinatura_doc_uuid ON public.contratos_assinatura(d4sign_document_uuid);

CREATE TRIGGER set_updated_at_contratos_assinatura
  BEFORE UPDATE ON public.contratos_assinatura
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();