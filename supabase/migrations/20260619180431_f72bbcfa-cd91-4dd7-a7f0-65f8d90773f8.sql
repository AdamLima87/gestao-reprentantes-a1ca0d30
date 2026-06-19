ALTER TABLE public.representantes
  ADD COLUMN IF NOT EXISTS tipo_pessoa text NOT NULL DEFAULT 'juridica',
  ADD COLUMN IF NOT EXISTS cpf text,
  ADD COLUMN IF NOT EXISTS nome_completo text,
  ADD COLUMN IF NOT EXISTS rg text,
  ADD COLUMN IF NOT EXISTS data_nascimento date;

ALTER TABLE public.representantes
  DROP CONSTRAINT IF EXISTS representantes_tipo_pessoa_check;
ALTER TABLE public.representantes
  ADD CONSTRAINT representantes_tipo_pessoa_check CHECK (tipo_pessoa IN ('juridica','fisica'));