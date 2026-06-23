CREATE TABLE public.user_permissions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  permissao text NOT NULL,
  concedida boolean NOT NULL DEFAULT true,
  criado_em timestamptz DEFAULT now(),
  UNIQUE (user_id, permissao)
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.user_permissions TO authenticated;
GRANT ALL ON public.user_permissions TO service_role;

ALTER TABLE public.user_permissions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "perm_admin_all" ON public.user_permissions
  FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "perm_self_read" ON public.user_permissions
  FOR SELECT TO authenticated
  USING (user_id = auth.uid());

REVOKE ALL ON public.user_permissions FROM anon;