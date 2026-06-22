CREATE TABLE public.login_attempts (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  email text NOT NULL,
  ip text,
  sucesso boolean NOT NULL,
  user_agent text,
  criado_em timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX login_attempts_email_criado_idx ON public.login_attempts (email, criado_em DESC);
GRANT SELECT ON public.login_attempts TO authenticated;
GRANT ALL ON public.login_attempts TO service_role;
ALTER TABLE public.login_attempts ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Admins podem ler tentativas de login"
  ON public.login_attempts FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));