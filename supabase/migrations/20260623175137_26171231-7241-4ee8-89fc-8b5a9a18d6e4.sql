
-- Função BEFORE DELETE para garantir consistência ao excluir uma NF-e
CREATE OR REPLACE FUNCTION public.before_delete_nfe()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_status public.pedido_status;
  v_new_status public.pedido_status;
  v_cliente_id uuid;
  v_prev_data timestamptz;
BEGIN
  -- 1. Remover comissões vinculadas
  DELETE FROM public.comissoes WHERE nfe_id = OLD.id;

  -- 2. Regredir o status do pedido
  SELECT p.status, p.cliente_id INTO v_status, v_cliente_id
  FROM public.pedidos p WHERE p.id = OLD.pedido_id;

  IF v_status = 'entregue' THEN
    v_new_status := 'faturado';
  ELSIF v_status = 'faturado' THEN
    v_new_status := 'producao';
  ELSE
    v_new_status := NULL;
  END IF;

  IF v_new_status IS NOT NULL THEN
    UPDATE public.pedidos SET status = v_new_status WHERE id = OLD.pedido_id;
  END IF;

  -- Limpar data_entrega de outras NF-es do mesmo pedido se voltamos pra 'faturado'? Não — apenas regride status.

  -- 3. Atualizar ultima_compra_at do cliente
  IF v_cliente_id IS NOT NULL THEN
    SELECT MAX(n2.data_nfe::timestamptz) INTO v_prev_data
    FROM public.nfe n2
    JOIN public.pedidos p2 ON p2.id = n2.pedido_id
    WHERE p2.cliente_id = v_cliente_id
      AND n2.id <> OLD.id;

    UPDATE public.clientes SET ultima_compra_at = v_prev_data WHERE id = v_cliente_id;
  END IF;

  RETURN OLD;
END;
$$;

DROP TRIGGER IF EXISTS trg_before_delete_nfe ON public.nfe;
CREATE TRIGGER trg_before_delete_nfe
  BEFORE DELETE ON public.nfe
  FOR EACH ROW EXECUTE FUNCTION public.before_delete_nfe();

-- Política RLS: apenas admin pode deletar nfe
DROP POLICY IF EXISTS "nfe_admin_delete" ON public.nfe;
CREATE POLICY "nfe_admin_delete" ON public.nfe
  FOR DELETE TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));
