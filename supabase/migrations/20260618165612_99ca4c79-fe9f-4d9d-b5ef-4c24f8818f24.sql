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
  v_pct_int       NUMERIC;
  v_tipo_int      public.comissao_tipo;
  v_dias          INTEGER;
  v_jefferson_id  UUID;
BEGIN
  SELECT p.*, c.ultima_compra_at, c.id AS cid
  INTO v_pedido
  FROM public.pedidos p
  JOIN public.clientes c ON c.id = p.cliente_id
  WHERE p.id = NEW.pedido_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Pedido % não encontrado', NEW.pedido_id;
  END IF;

  SELECT * INTO v_rep FROM public.representantes WHERE id = v_pedido.representante_id;

  SELECT percentual INTO v_pct_ext
  FROM public.comissao_config
  WHERE cliente_id = v_pedido.cliente_id
    AND representante_id = v_pedido.representante_id
  LIMIT 1;

  IF v_pct_ext IS NULL THEN
    v_pct_ext := v_rep.percentual_padrao;
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

  IF v_pedido.jefferson_participou THEN
    IF v_pedido.ultima_compra_at IS NULL THEN
      v_dias := 999;
    ELSE
      v_dias := EXTRACT(DAY FROM (NEW.data_nfe::TIMESTAMP - v_pedido.ultima_compra_at::TIMESTAMP));
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

    SELECT id INTO v_jefferson_id
    FROM public.representantes
    WHERE tipo = 'interno'
    ORDER BY criado_em
    LIMIT 1;

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

  SELECT id INTO v_jefferson_id
  FROM public.representantes
  WHERE tipo = 'interno'
  ORDER BY criado_em
  LIMIT 1;

  IF v_jefferson_id IS NOT NULL AND v_rep.tipo = 'externo' THEN
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

  UPDATE public.clientes
  SET ultima_compra_at = NEW.data_nfe
  WHERE id = v_pedido.cliente_id;

  UPDATE public.pedidos
  SET status = 'faturado'
  WHERE id = NEW.pedido_id
    AND status NOT IN ('faturado', 'entregue', 'cancelado');

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_calcular_comissoes ON public.nfe;
DROP TRIGGER IF EXISTS calc_comissoes_on_nfe_trigger ON public.nfe;

CREATE TRIGGER trg_calcular_comissoes
  AFTER INSERT ON public.nfe
  FOR EACH ROW
  EXECUTE FUNCTION public.calcular_comissoes_nfe();

ALTER TABLE public.comissao_config
  DROP CONSTRAINT IF EXISTS comissao_config_cliente_rep_unique;
ALTER TABLE public.comissao_config
  ADD CONSTRAINT comissao_config_cliente_rep_unique
  UNIQUE (cliente_id, representante_id);

ALTER TABLE public.metas
  DROP CONSTRAINT IF EXISTS metas_mes_ano_rep_unique;
ALTER TABLE public.metas
  ADD CONSTRAINT metas_mes_ano_rep_unique
  UNIQUE (mes, ano, representante_id);