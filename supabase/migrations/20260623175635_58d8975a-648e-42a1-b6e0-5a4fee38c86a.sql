
CREATE OR REPLACE FUNCTION public.before_delete_nfe()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_cliente_id uuid;
  v_prev_data timestamptz;
BEGIN
  DELETE FROM public.comissoes WHERE nfe_id = OLD.id;

  SELECT p.cliente_id INTO v_cliente_id
  FROM public.pedidos p WHERE p.id = OLD.pedido_id;

  UPDATE public.pedidos
    SET status = 'pedido'
    WHERE id = OLD.pedido_id AND status <> 'cancelado';

  IF v_cliente_id IS NOT NULL THEN
    SELECT MAX(n2.data_nfe::timestamptz) INTO v_prev_data
    FROM public.nfe n2
    JOIN public.pedidos p2 ON p2.id = n2.pedido_id
    WHERE p2.cliente_id = v_cliente_id AND n2.id <> OLD.id;

    UPDATE public.clientes SET ultima_compra_at = v_prev_data WHERE id = v_cliente_id;
  END IF;

  RETURN OLD;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.before_delete_nfe() FROM PUBLIC, anon, authenticated;
