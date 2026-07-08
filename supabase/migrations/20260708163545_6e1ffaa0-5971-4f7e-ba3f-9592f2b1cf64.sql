
-- Fix 1: Prevent non-admin users from modifying their own compensation/banking fields
CREATE OR REPLACE FUNCTION public.prevent_profile_sensitive_self_update()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF public.has_role(auth.uid(), 'admin'::app_role) THEN
    RETURN NEW;
  END IF;
  IF NEW.percentual_comissao IS DISTINCT FROM OLD.percentual_comissao
     OR NEW.representante_id IS DISTINCT FROM OLD.representante_id
     OR NEW.banco IS DISTINCT FROM OLD.banco
     OR NEW.agencia IS DISTINCT FROM OLD.agencia
     OR NEW.conta IS DISTINCT FROM OLD.conta
     OR NEW.pix IS DISTINCT FROM OLD.pix THEN
    RAISE EXCEPTION 'Apenas administradores podem alterar dados de comissao, banco, agencia, conta ou pix';
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS profiles_prevent_sensitive_self_update ON public.profiles;
CREATE TRIGGER profiles_prevent_sensitive_self_update
BEFORE UPDATE ON public.profiles
FOR EACH ROW
EXECUTE FUNCTION public.prevent_profile_sensitive_self_update();

DROP POLICY IF EXISTS profiles_self_update ON public.profiles;
CREATE POLICY profiles_self_update ON public.profiles
FOR UPDATE TO authenticated
USING ((id = auth.uid()) OR has_role(auth.uid(), 'admin'::app_role))
WITH CHECK ((id = auth.uid()) OR has_role(auth.uid(), 'admin'::app_role));

-- Fix 2: Allow representantes to view their own contract signature status
CREATE POLICY contratos_assinatura_own_representante_read
ON public.contratos_assinatura
FOR SELECT TO authenticated
USING (representante_id = public.current_representante_id());
