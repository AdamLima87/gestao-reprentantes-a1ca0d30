ALTER TABLE public.representantes
  ADD COLUMN IF NOT EXISTS banco text,
  ADD COLUMN IF NOT EXISTS tipo_conta text,
  ADD COLUMN IF NOT EXISTS agencia text,
  ADD COLUMN IF NOT EXISTS conta_digito text,
  ADD COLUMN IF NOT EXISTS chave_pix text,
  ADD COLUMN IF NOT EXISTS titular_conta text,
  ADD COLUMN IF NOT EXISTS cpf_cnpj_titular text;