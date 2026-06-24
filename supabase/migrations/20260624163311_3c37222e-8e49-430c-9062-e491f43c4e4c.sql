-- 1. Add enum value first (must be its own statement before being used)
ALTER TYPE public.comissao_tipo ADD VALUE IF NOT EXISTS 'gestor';

-- 2. Profile fields for gestor commission + bank info
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS percentual_comissao numeric NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS banco text,
  ADD COLUMN IF NOT EXISTS agencia text,
  ADD COLUMN IF NOT EXISTS conta text,
  ADD COLUMN IF NOT EXISTS pix text;

-- 3. Track which gestor a comissao row belongs to
ALTER TABLE public.comissoes
  ADD COLUMN IF NOT EXISTS gestor_user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL;
