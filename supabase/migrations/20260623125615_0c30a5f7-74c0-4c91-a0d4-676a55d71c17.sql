-- Adiciona perfil 'gestor' e flag de troca obrigatória de senha
ALTER TYPE public.app_role ADD VALUE IF NOT EXISTS 'gestor';

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS must_change_password boolean NOT NULL DEFAULT false;