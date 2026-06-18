
CREATE OR REPLACE FUNCTION public.calcular_comissoes_nfe()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_pedido        RECORD;
  v_rep           RECORD;
  v_pct_ext       NUMERIC := 5.0;
  v_pct_int       NUMERIC := 1.5;
  v_tipo_int      public.comissao_tipo := 'interno_novo';
  v_dias          INTEGER := 999;
  v_jefferson_id  UUID;
BEGIN
  SELECT p.*, c.ultima_compra_at
  INTO v_pedido
  FROM public.pedidos p
  JOIN public.clientes c ON c.id = p.cliente_id
  WHERE p.id = NEW.pedido_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Pedido % não encontrado', NEW.pedido_id;
  END IF;

  SELECT id INTO v_jefferson_id
  FROM public.representantes
  WHERE tipo = 'interno'
  ORDER BY criado_em
  LIMIT 1;

  IF v_pedido.representante_id IS NOT NULL THEN
    SELECT * INTO v_rep FROM public.representantes WHERE id = v_pedido.representante_id;

    SELECT percentual INTO v_pct_ext
    FROM public.comissao_config
    WHERE cliente_id = v_pedido.cliente_id
      AND representante_id = v_pedido.representante_id
    LIMIT 1;

    IF v_pct_ext IS NULL THEN
      v_pct_ext := COALESCE(v_rep.percentual_padrao, 5.0);
    END IF;

    INSERT INTO public.comissoes (
      nfe_id, pedido_id, representante_id,
      tipo, percentual_aplicado, base_calculo, valor_comissao,
      mes_ref, ano_ref
    ) VALUES (
      NEW.id, NEW.pedido_id, v_pedido.representante_id,
      'externo', v_pct_ext, NEW.valor_nfe,
      ROUND(NEW.valor_nfe * v_pct_ext / 100, 2),
      NEW.mes_ref, NEW.ano_ref
    );

    IF v_pedido.jefferson_participou AND v_jefferson_id IS NOT NULL THEN
      INSERT INTO public.comissoes (
        nfe_id, pedido_id, representante_id,
        tipo, percentual_aplicado, base_calculo, valor_comissao,
        mes_ref, ano_ref
      ) VALUES (
        NEW.id, NEW.pedido_id, v_jefferson_id,
        'interno_sobre_rep', 0.5, NEW.valor_nfe,
        ROUND(NEW.valor_nfe * 0.5 / 100, 2),
        NEW.mes_ref, NEW.ano_ref
      );
    END IF;
  ELSE
    IF v_jefferson_id IS NOT NULL THEN
      IF v_pedido.ultima_compra_at IS NULL THEN
        v_dias := 999;
      ELSE
        v_dias := EXTRACT(DAY FROM (
          NEW.data_nfe::TIMESTAMP - v_pedido.ultima_compra_at::TIMESTAMP
        ))::INTEGER;
      END IF;

      IF v_dias > 120 THEN
        IF v_pedido.ultima_compra_at IS NULL THEN
          v_tipo_int := 'interno_novo';
        ELSE
          v_tipo_int := 'interno_reativacao';
        END IF;
        v_pct_int := 1.5;
      ELSE
        v_tipo_int := 'interno_recorrente';
        v_pct_int := 1.0;
      END IF;

      INSERT INTO public.comissoes (
        nfe_id, pedido_id, representante_id,
        tipo, percentual_aplicado, base_calculo, valor_comissao,
        mes_ref, ano_ref
      ) VALUES (
        NEW.id, NEW.pedido_id, v_jefferson_id,
        v_tipo_int, v_pct_int, NEW.valor_nfe,
        ROUND(NEW.valor_nfe * v_pct_int / 100, 2),
        NEW.mes_ref, NEW.ano_ref
      );
    END IF;
  END IF;

  UPDATE public.clientes SET ultima_compra_at = NEW.data_nfe WHERE id = v_pedido.cliente_id;

  UPDATE public.pedidos
  SET status = 'faturado'
  WHERE id = NEW.pedido_id
    AND status NOT IN ('faturado', 'entregue', 'cancelado');

  RETURN NEW;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.calcular_comissoes_nfe() FROM PUBLIC, anon, authenticated;
