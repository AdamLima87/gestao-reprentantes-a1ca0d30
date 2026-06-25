
ALTER TABLE public.extratos_enviados ALTER COLUMN representante_id DROP NOT NULL;
ALTER TABLE public.extratos_enviados ADD COLUMN IF NOT EXISTS gestor_user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL;
ALTER TABLE public.extratos_enviados DROP CONSTRAINT IF EXISTS extratos_enviados_dest_check;
ALTER TABLE public.extratos_enviados ADD CONSTRAINT extratos_enviados_dest_check CHECK (representante_id IS NOT NULL OR gestor_user_id IS NOT NULL);
