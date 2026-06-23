
CREATE OR REPLACE FUNCTION public.marcar_pedido_entregue_on_nfe()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.data_entrega IS NOT NULL
     AND (TG_OP = 'INSERT' OR OLD.data_entrega IS DISTINCT FROM NEW.data_entrega)
  THEN
    UPDATE public.pedidos
       SET status = 'entregue'
     WHERE id = NEW.pedido_id
       AND status <> 'cancelado';
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_marcar_pedido_entregue ON public.nfe;
CREATE TRIGGER trg_marcar_pedido_entregue
AFTER INSERT OR UPDATE OF data_entrega ON public.nfe
FOR EACH ROW
EXECUTE FUNCTION public.marcar_pedido_entregue_on_nfe();
