
ALTER TYPE public.comissao_tipo ADD VALUE IF NOT EXISTS 'gestor';

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS percentual_comissao numeric DEFAULT 0;

ALTER TABLE public.comissoes
  ADD COLUMN IF NOT EXISTS gestor_user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL;
