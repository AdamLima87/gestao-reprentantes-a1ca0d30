
-- Recreate NF-e trigger: update order to faturado + calculate commissions

CREATE OR REPLACE FUNCTION public.calcular_comissoes_nfe()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_pedido        RECORD;
  v_rep           RECORD;
  v_pct_ext       NUMERIC;
  v_pct_int       NUMERIC := 1.5;
  v_tipo_int      public.comissao_tipo := 'interno_novo';
  v_dias          INTEGER := 999;
  v_jefferson_id  UUID;
  v_ultima        TIMESTAMPTZ;
BEGIN
  -- Load pedido + cliente
  SELECT p.*, c.ultima_compra_at
  INTO v_pedido
  FROM public.pedidos p
  JOIN public.clientes c ON c.id = p.cliente_id
  WHERE p.id = NEW.pedido_id;

  IF NOT FOUND THEN
    RETURN NEW;
  END IF;

  -- 1) Update pedido status to faturado
  UPDATE public.pedidos
    SET status = 'faturado'
    WHERE id = NEW.pedido_id
      AND status NOT IN ('faturado','entregue','cancelado');

  -- 2) Load representante
  SELECT * INTO v_rep
  FROM public.representantes
  WHERE id = v_pedido.representante_id;

  v_pct_ext := COALESCE(v_rep.percentual_padrao, 5.0);

  -- 3) Comissão do representante externo (se for externo)
  IF v_rep.tipo = 'externo' THEN
    INSERT INTO public.comissoes (
      nfe_id, pedido_id, representante_id,
      tipo, percentual_aplicado, base_calculo, valor_comissao,
      mes_ref, ano_ref
    ) VALUES (
      NEW.id, NEW.pedido_id, v_rep.id,
      'externo', v_pct_ext, NEW.valor_nfe,
      ROUND(NEW.valor_nfe * v_pct_ext / 100, 2),
      NEW.mes_ref, NEW.ano_ref
    );

    -- 0,5% para Jefferson sobre a comissão do externo
    SELECT r.id INTO v_jefferson_id
    FROM public.representantes r
    WHERE r.tipo = 'interno'
    ORDER BY r.criado_em ASC
    LIMIT 1;

    IF v_jefferson_id IS NOT NULL THEN
      INSERT INTO public.comissoes (
        nfe_id, pedido_id, representante_id,
        tipo, percentual_aplicado, base_calculo, valor_comissao,
        mes_ref, ano_ref
      ) VALUES (
        NEW.id, NEW.pedido_id, v_jefferson_id,
        'interno_sobre_rep', 0.5, NEW.valor_nfe,
        ROUND(NEW.valor_nfe * v_pct_ext / 100 * 0.5 / 100, 2),
        NEW.mes_ref, NEW.ano_ref
      );
    END IF;

  -- 4) Pedido feito direto pelo interno (Jefferson)
  ELSIF v_rep.tipo = 'interno' OR COALESCE(v_pedido.jefferson_participou, false) THEN
    SELECT r.id INTO v_jefferson_id
    FROM public.representantes r
    WHERE r.tipo = 'interno'
    ORDER BY r.criado_em ASC
    LIMIT 1;

    v_ultima := v_pedido.ultima_compra_at;
    IF v_ultima IS NOT NULL THEN
      v_dias := EXTRACT(DAY FROM (now() - v_ultima))::INTEGER;
    END IF;

    IF v_ultima IS NULL THEN
      v_tipo_int := 'interno_novo';
      v_pct_int := 1.5;
    ELSIF v_dias > 180 THEN
      v_tipo_int := 'interno_reativacao';
      v_pct_int := 1.5;
    ELSE
      v_tipo_int := 'interno_recorrente';
      v_pct_int := 1.0;
    END IF;

    IF v_jefferson_id IS NOT NULL THEN
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

  -- 5) Atualiza última compra do cliente
  UPDATE public.clientes
    SET ultima_compra_at = now()
    WHERE id = v_pedido.cliente_id;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_calcular_comissoes ON public.nfe;
CREATE TRIGGER trg_calcular_comissoes
  AFTER INSERT ON public.nfe
  FOR EACH ROW
  EXECUTE FUNCTION public.calcular_comissoes_nfe();
