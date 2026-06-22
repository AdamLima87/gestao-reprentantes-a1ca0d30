
ALTER TABLE public.comissoes
  ADD COLUMN IF NOT EXISTS pago_em date,
  ADD COLUMN IF NOT EXISTS observacao_pagamento text,
  ADD COLUMN IF NOT EXISTS comprovante_url text;

CREATE OR REPLACE FUNCTION public.delete_comissoes_on_pedido_cancel()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.status = 'cancelado' AND (OLD.status IS DISTINCT FROM 'cancelado'::public.pedido_status) THEN
    DELETE FROM public.comissoes WHERE pedido_id = NEW.id;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_delete_comissoes_on_pedido_cancel ON public.pedidos;
CREATE TRIGGER trg_delete_comissoes_on_pedido_cancel
AFTER UPDATE OF status ON public.pedidos
FOR EACH ROW
EXECUTE FUNCTION public.delete_comissoes_on_pedido_cancel();
