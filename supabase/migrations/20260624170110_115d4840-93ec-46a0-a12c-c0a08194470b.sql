
-- Bloco 2: Recálculo representantes externos
CREATE OR REPLACE FUNCTION public.recalcular_comissoes_representantes(
  p_mes integer DEFAULT NULL,
  p_ano integer DEFAULT NULL
)
RETURNS TABLE(nfe_id uuid, nfe text, representante text, percentual numeric, valor_comissao numeric)
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_nfe RECORD;
  v_pct NUMERIC;
BEGIN
  FOR v_nfe IN
    SELECT
      n.id, n.numero_nfe, n.mes_ref, n.ano_ref,
      n.pedido_id, p.valor_produtos,
      p.representante_id, p.jefferson_participou,
      r.percentual_padrao, r.nome AS rep_nome,
      p.cliente_id
    FROM public.nfe n
    JOIN public.pedidos p ON p.id = n.pedido_id
    JOIN public.representantes r ON r.id = p.representante_id
    WHERE p.representante_id IS NOT NULL
      AND (p_mes IS NULL OR n.mes_ref = p_mes)
      AND (p_ano IS NULL OR n.ano_ref = p_ano)
    ORDER BY n.data_nfe
  LOOP
    SELECT percentual INTO v_pct
    FROM public.comissao_config
    WHERE cliente_id = v_nfe.cliente_id
      AND representante_id = v_nfe.representante_id
    LIMIT 1;

    IF v_pct IS NULL THEN
      v_pct := COALESCE(v_nfe.percentual_padrao, 5.0);
    END IF;

    DELETE FROM public.comissoes
    WHERE nfe_id = v_nfe.id AND tipo = 'externo';

    INSERT INTO public.comissoes (
      nfe_id, pedido_id, representante_id,
      tipo, percentual_aplicado, base_calculo, valor_comissao,
      mes_ref, ano_ref
    ) VALUES (
      v_nfe.id, v_nfe.pedido_id, v_nfe.representante_id,
      'externo', v_pct, v_nfe.valor_produtos,
      ROUND(v_nfe.valor_produtos * v_pct / 100, 2),
      v_nfe.mes_ref, v_nfe.ano_ref
    );

    IF v_nfe.jefferson_participou THEN
      DELETE FROM public.comissoes
      WHERE nfe_id = v_nfe.id AND tipo = 'interno_sobre_rep';

      INSERT INTO public.comissoes (
        nfe_id, pedido_id, representante_id,
        tipo, percentual_aplicado, base_calculo, valor_comissao,
        mes_ref, ano_ref
      )
      SELECT
        v_nfe.id, v_nfe.pedido_id, r.id,
        'interno_sobre_rep', 0.5, v_nfe.valor_produtos,
        ROUND(v_nfe.valor_produtos * 0.5 / 100, 2),
        v_nfe.mes_ref, v_nfe.ano_ref
      FROM public.representantes r WHERE r.tipo = 'interno' LIMIT 1;
    END IF;

    RETURN QUERY SELECT
      v_nfe.id, v_nfe.numero_nfe,
      v_nfe.rep_nome, v_pct,
      ROUND(v_nfe.valor_produtos * v_pct / 100, 2);
  END LOOP;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.recalcular_comissoes_representantes(integer, integer) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.recalcular_comissoes_representantes(integer, integer) TO authenticated;

-- Bloco 3: Recálculo gestor
CREATE OR REPLACE FUNCTION public.recalcular_comissoes_gestor(
  p_mes integer DEFAULT NULL,
  p_ano integer DEFAULT NULL
)
RETURNS TABLE(nfe_id uuid, nfe text, valor_base numeric, gestor_nome text, percentual numeric, valor_comissao numeric)
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_nfe    RECORD;
  v_gestor RECORD;
BEGIN
  FOR v_nfe IN
    SELECT n.id, n.numero_nfe, n.mes_ref, n.ano_ref,
           n.pedido_id, p.valor_produtos
    FROM public.nfe n
    JOIN public.pedidos p ON p.id = n.pedido_id
    WHERE (p_mes IS NULL OR n.mes_ref = p_mes)
      AND (p_ano IS NULL OR n.ano_ref = p_ano)
    ORDER BY n.data_nfe
  LOOP
    DELETE FROM public.comissoes
    WHERE nfe_id = v_nfe.id AND tipo = 'gestor';

    FOR v_gestor IN
      SELECT pr.id AS user_id, pr.percentual_comissao, pr.nome
      FROM public.profiles pr
      JOIN public.user_roles ur ON ur.user_id = pr.id
      WHERE ur.role = 'gestor' AND pr.percentual_comissao > 0
    LOOP
      INSERT INTO public.comissoes (
        nfe_id, pedido_id, representante_id, gestor_user_id,
        tipo, percentual_aplicado, base_calculo, valor_comissao,
        mes_ref, ano_ref
      ) VALUES (
        v_nfe.id, v_nfe.pedido_id, NULL, v_gestor.user_id,
        'gestor', v_gestor.percentual_comissao, v_nfe.valor_produtos,
        ROUND(v_nfe.valor_produtos * v_gestor.percentual_comissao / 100, 2),
        v_nfe.mes_ref, v_nfe.ano_ref
      );

      RETURN QUERY SELECT
        v_nfe.id, v_nfe.numero_nfe, v_nfe.valor_produtos,
        v_gestor.nome, v_gestor.percentual_comissao,
        ROUND(v_nfe.valor_produtos * v_gestor.percentual_comissao / 100, 2);
    END LOOP;
  END LOOP;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.recalcular_comissoes_gestor(integer, integer) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.recalcular_comissoes_gestor(integer, integer) TO authenticated;

-- Bloco 4: Atualizar trigger principal incluindo gestor
CREATE OR REPLACE FUNCTION public.calcular_comissoes_nfe()
RETURNS TRIGGER
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_pedido        RECORD;
  v_rep           RECORD;
  v_pct_ext       NUMERIC := 5.0;
  v_pct_int       NUMERIC := 1.5;
  v_tipo_int      public.comissao_tipo := 'interno_novo';
  v_dias          INTEGER := 999;
  v_jefferson_id  UUID;
  v_gestor        RECORD;
BEGIN
  SELECT p.*, c.ultima_compra_at
  INTO v_pedido
  FROM public.pedidos p
  JOIN public.clientes c ON c.id = p.cliente_id
  WHERE p.id = NEW.pedido_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Pedido % nao encontrado', NEW.pedido_id;
  END IF;

  SELECT id INTO v_jefferson_id
  FROM public.representantes
  WHERE tipo = 'interno' ORDER BY criado_em LIMIT 1;

  IF v_pedido.representante_id IS NOT NULL THEN
    SELECT * INTO v_rep FROM public.representantes WHERE id = v_pedido.representante_id;

    SELECT percentual INTO v_pct_ext
    FROM public.comissao_config
    WHERE cliente_id = v_pedido.cliente_id
      AND representante_id = v_pedido.representante_id LIMIT 1;

    IF v_pct_ext IS NULL THEN v_pct_ext := COALESCE(v_rep.percentual_padrao, 5.0); END IF;

    INSERT INTO public.comissoes (nfe_id, pedido_id, representante_id, tipo, percentual_aplicado, base_calculo, valor_comissao, mes_ref, ano_ref)
    VALUES (NEW.id, NEW.pedido_id, v_pedido.representante_id, 'externo', v_pct_ext, NEW.valor_nfe, ROUND(NEW.valor_nfe * v_pct_ext / 100, 2), NEW.mes_ref, NEW.ano_ref);

    IF v_pedido.jefferson_participou AND v_jefferson_id IS NOT NULL THEN
      INSERT INTO public.comissoes (nfe_id, pedido_id, representante_id, tipo, percentual_aplicado, base_calculo, valor_comissao, mes_ref, ano_ref)
      VALUES (NEW.id, NEW.pedido_id, v_jefferson_id, 'interno_sobre_rep', 0.5, NEW.valor_nfe, ROUND(NEW.valor_nfe * 0.5 / 100, 2), NEW.mes_ref, NEW.ano_ref);
    END IF;

  ELSE
    IF v_jefferson_id IS NOT NULL THEN
      IF v_pedido.ultima_compra_at IS NULL THEN v_dias := 999;
      ELSE v_dias := EXTRACT(DAY FROM (NEW.data_nfe::TIMESTAMP - v_pedido.ultima_compra_at::TIMESTAMP))::INTEGER;
      END IF;

      IF v_dias > 120 THEN
        v_tipo_int := CASE WHEN v_pedido.ultima_compra_at IS NULL THEN 'interno_novo'::public.comissao_tipo ELSE 'interno_reativacao'::public.comissao_tipo END;
        v_pct_int := 1.5;
      ELSE
        v_tipo_int := 'interno_recorrente'; v_pct_int := 1.0;
      END IF;

      INSERT INTO public.comissoes (nfe_id, pedido_id, representante_id, tipo, percentual_aplicado, base_calculo, valor_comissao, mes_ref, ano_ref)
      VALUES (NEW.id, NEW.pedido_id, v_jefferson_id, v_tipo_int, v_pct_int, NEW.valor_nfe, ROUND(NEW.valor_nfe * v_pct_int / 100, 2), NEW.mes_ref, NEW.ano_ref);
    END IF;
  END IF;

  FOR v_gestor IN
    SELECT pr.id AS user_id, pr.percentual_comissao, pr.nome
    FROM public.profiles pr
    JOIN public.user_roles ur ON ur.user_id = pr.id
    WHERE ur.role = 'gestor' AND pr.percentual_comissao > 0
  LOOP
    INSERT INTO public.comissoes (
      nfe_id, pedido_id, representante_id, gestor_user_id,
      tipo, percentual_aplicado, base_calculo, valor_comissao,
      mes_ref, ano_ref
    ) VALUES (
      NEW.id, NEW.pedido_id, NULL, v_gestor.user_id,
      'gestor', v_gestor.percentual_comissao, NEW.valor_nfe,
      ROUND(NEW.valor_nfe * v_gestor.percentual_comissao / 100, 2),
      NEW.mes_ref, NEW.ano_ref
    );
  END LOOP;

  UPDATE public.clientes SET ultima_compra_at = NEW.data_nfe WHERE id = v_pedido.cliente_id;
  UPDATE public.pedidos SET status = 'faturado' WHERE id = NEW.pedido_id AND status NOT IN ('faturado','entregue','cancelado');

  RETURN NEW;
END;
$$;

-- Bloco 5: garantir trigger
DROP TRIGGER IF EXISTS trg_calcular_comissoes ON public.nfe;
CREATE TRIGGER trg_calcular_comissoes
  AFTER INSERT ON public.nfe
  FOR EACH ROW
  EXECUTE FUNCTION public.calcular_comissoes_nfe();
