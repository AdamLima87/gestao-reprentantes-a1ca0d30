
CREATE OR REPLACE FUNCTION public.remover_comissoes_pedido_cancelado()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.status = 'cancelado' AND (OLD.status IS DISTINCT FROM 'cancelado'::public.pedido_status) THEN
    DELETE FROM public.comissoes WHERE pedido_id = NEW.id;
    DELETE FROM public.nfe WHERE pedido_id = NEW.id;
  END IF;
  RETURN NEW;
END;
$$;
