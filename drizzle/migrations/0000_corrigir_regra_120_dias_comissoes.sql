-- Usa o histórico real de NF-e do cliente para classificar novo, recorrente e reativação.
CREATE OR REPLACE FUNCTION public.calcular_comissoes_nfe()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_pedido          RECORD;
  v_rep             RECORD;
  v_pct_ext         NUMERIC := 5.0;
  v_pct_int         NUMERIC := 1.5;
  v_tipo_int        public.comissao_tipo := 'interno_novo';
  v_dias            INTEGER;
  v_interno         RECORD;
  v_pct_recorrente  NUMERIC := 1.0;
  v_pct_sobre_rep   NUMERIC := 0.5;
  v_pct_novo        NUMERIC := 1.5;
  v_gestor          RECORD;
  v_data_anterior   DATE;
  v_base             NUMERIC;
BEGIN
  SELECT p.*
  INTO v_pedido
  FROM public.pedidos p
  WHERE p.id = NEW.pedido_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Pedido % nao encontrado', NEW.pedido_id;
  END IF;

  v_base := COALESCE(v_pedido.valor_produtos, 0);

  SELECT * INTO v_interno
  FROM public.representantes
  WHERE tipo = 'interno'
  ORDER BY criado_em
  LIMIT 1;

  IF v_interno.id IS NOT NULL THEN
    v_pct_novo       := COALESCE(v_interno.percentual_padrao, 1.5);
    v_pct_recorrente := COALESCE(v_interno.percentual_recorrente, 1.0);
    v_pct_sobre_rep  := COALESCE(v_interno.percentual_sobre_rep, 0.5);
  END IF;

  SELECT * INTO v_rep
  FROM public.representantes
  WHERE id = v_pedido.representante_id;

  IF v_rep.id IS NOT NULL AND v_rep.tipo = 'externo' THEN
    SELECT percentual INTO v_pct_ext
    FROM public.comissao_config
    WHERE cliente_id = v_pedido.cliente_id
      AND representante_id = v_pedido.representante_id
    LIMIT 1;

    IF v_pct_ext IS NULL THEN
      v_pct_ext := COALESCE(v_rep.percentual_padrao, 5.0);
    END IF;
    v_pct_ext := COALESCE(v_pedido.percentual_representante_override, v_pct_ext);

    INSERT INTO public.comissoes
      (nfe_id, pedido_id, representante_id, tipo, percentual_aplicado, base_calculo, valor_comissao, mes_ref, ano_ref)
    VALUES
      (NEW.id, NEW.pedido_id, v_rep.id, 'externo', v_pct_ext, v_base,
       ROUND(v_base * v_pct_ext / 100, 2), NEW.mes_ref, NEW.ano_ref);

    IF COALESCE(v_pedido.jefferson_participou, false) AND v_interno.id IS NOT NULL THEN
      v_pct_int := COALESCE(v_pedido.percentual_interno_override, v_pct_sobre_rep);
      INSERT INTO public.comissoes
        (nfe_id, pedido_id, representante_id, tipo, percentual_aplicado, base_calculo, valor_comissao, mes_ref, ano_ref)
      VALUES
        (NEW.id, NEW.pedido_id, v_interno.id, 'interno_sobre_rep', v_pct_int, v_base,
         ROUND(v_base * v_pct_int / 100, 2), NEW.mes_ref, NEW.ano_ref);
    END IF;
  ELSIF v_interno.id IS NOT NULL THEN
    SELECT n.data_nfe
    INTO v_data_anterior
    FROM public.nfe n
    JOIN public.pedidos p_anterior ON p_anterior.id = n.pedido_id
    WHERE p_anterior.cliente_id = v_pedido.cliente_id
      AND p_anterior.status <> 'cancelado'
      AND n.id <> NEW.id
      AND (
        n.data_nfe < NEW.data_nfe
        OR (n.data_nfe = NEW.data_nfe AND (n.criado_em, n.id) < (NEW.criado_em, NEW.id))
      )
    ORDER BY n.data_nfe DESC, n.criado_em DESC, n.id DESC
    LIMIT 1;

    IF v_data_anterior IS NULL THEN
      v_tipo_int := 'interno_novo';
      v_pct_int := v_pct_novo;
    ELSE
      v_dias := NEW.data_nfe - v_data_anterior;
      IF v_dias > 120 THEN
        v_tipo_int := 'interno_reativacao';
        v_pct_int := v_pct_novo;
      ELSE
        v_tipo_int := 'interno_recorrente';
        v_pct_int := v_pct_recorrente;
      END IF;
    END IF;

    v_pct_int := COALESCE(v_pedido.percentual_interno_override, v_pct_int);

    INSERT INTO public.comissoes
      (nfe_id, pedido_id, representante_id, tipo, percentual_aplicado, base_calculo, valor_comissao, mes_ref, ano_ref)
    VALUES
      (NEW.id, NEW.pedido_id, COALESCE(CASE WHEN v_rep.tipo = 'interno' THEN v_rep.id END, v_interno.id),
       v_tipo_int, v_pct_int, v_base, ROUND(v_base * v_pct_int / 100, 2), NEW.mes_ref, NEW.ano_ref);
  END IF;

  FOR v_gestor IN
    SELECT pr.id AS user_id, pr.percentual_comissao
    FROM public.profiles pr
    JOIN public.user_roles ur ON ur.user_id = pr.id
    WHERE ur.role = 'gestor' AND pr.percentual_comissao > 0
  LOOP
    INSERT INTO public.comissoes
      (nfe_id, pedido_id, representante_id, gestor_user_id, tipo, percentual_aplicado,
       base_calculo, valor_comissao, mes_ref, ano_ref)
    VALUES
      (NEW.id, NEW.pedido_id, NULL, v_gestor.user_id, 'gestor', v_gestor.percentual_comissao,
       v_base, ROUND(v_base * v_gestor.percentual_comissao / 100, 2), NEW.mes_ref, NEW.ano_ref);
  END LOOP;

  UPDATE public.clientes
  SET ultima_compra_at = GREATEST(COALESCE(ultima_compra_at, NEW.data_nfe::timestamptz), NEW.data_nfe::timestamptz)
  WHERE id = v_pedido.cliente_id;

  UPDATE public.pedidos
  SET status = 'faturado'
  WHERE id = NEW.pedido_id AND status NOT IN ('faturado', 'entregue', 'cancelado');

  RETURN NEW;
END;
$function$;

CREATE OR REPLACE FUNCTION public.recalcular_comissoes_sem_auth()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_nfe             RECORD;
  v_pedido          RECORD;
  v_rep             RECORD;
  v_pct_ext         NUMERIC;
  v_pct_int         NUMERIC;
  v_tipo_int        public.comissao_tipo;
  v_dias            INTEGER;
  v_interno_id      UUID;
  v_pct_novo        NUMERIC := 1.5;
  v_pct_recorrente  NUMERIC := 1.0;
  v_pct_sobre_rep   NUMERIC := 0.5;
  v_internal_id     UUID;
  v_count           INTEGER := 0;
  v_base            NUMERIC;
  v_data_anterior   DATE;
  v_gestor          RECORD;
BEGIN
  v_interno_id := public.ensure_vendedor_interno_representante();

  SELECT
    COALESCE(percentual_padrao, 1.5),
    COALESCE(percentual_recorrente, 1.0),
    COALESCE(percentual_sobre_rep, 0.5)
  INTO v_pct_novo, v_pct_recorrente, v_pct_sobre_rep
  FROM public.representantes
  WHERE id = v_interno_id;

  DELETE FROM public.comissoes WHERE id IS NOT NULL;
  UPDATE public.clientes SET ultima_compra_at = NULL WHERE ultima_compra_at IS NOT NULL;

  FOR v_nfe IN
    SELECT * FROM public.nfe ORDER BY data_nfe, criado_em, id
  LOOP
    SELECT p.* INTO v_pedido
    FROM public.pedidos p
    WHERE p.id = v_nfe.pedido_id;

    IF NOT FOUND OR v_pedido.status = 'cancelado' THEN
      CONTINUE;
    END IF;

    v_base := COALESCE(v_pedido.valor_produtos, 0);
    SELECT * INTO v_rep
    FROM public.representantes
    WHERE id = v_pedido.representante_id;
    v_internal_id := COALESCE(CASE WHEN v_rep.tipo = 'interno' THEN v_rep.id END, v_interno_id);

    IF v_rep.id IS NOT NULL AND v_rep.tipo = 'externo' THEN
      v_pct_ext := NULL;
      SELECT percentual INTO v_pct_ext
      FROM public.comissao_config
      WHERE cliente_id = v_pedido.cliente_id
        AND representante_id = v_pedido.representante_id
      LIMIT 1;
      IF v_pct_ext IS NULL THEN
        v_pct_ext := COALESCE(v_rep.percentual_padrao, 5.0);
      END IF;
      v_pct_ext := COALESCE(v_pedido.percentual_representante_override, v_pct_ext);

      INSERT INTO public.comissoes
        (nfe_id, pedido_id, representante_id, tipo, percentual_aplicado, base_calculo, valor_comissao, mes_ref, ano_ref)
      VALUES
        (v_nfe.id, v_nfe.pedido_id, v_rep.id, 'externo', v_pct_ext, v_base,
         ROUND(v_base * v_pct_ext / 100, 2), v_nfe.mes_ref, v_nfe.ano_ref);
      v_count := v_count + 1;

      IF v_interno_id IS NOT NULL AND COALESCE(v_pedido.jefferson_participou, false) THEN
        v_pct_int := COALESCE(v_pedido.percentual_interno_override, v_pct_sobre_rep);
        INSERT INTO public.comissoes
          (nfe_id, pedido_id, representante_id, tipo, percentual_aplicado, base_calculo, valor_comissao, mes_ref, ano_ref)
        VALUES
          (v_nfe.id, v_nfe.pedido_id, v_interno_id, 'interno_sobre_rep', v_pct_int, v_base,
           ROUND(v_base * v_pct_int / 100, 2), v_nfe.mes_ref, v_nfe.ano_ref);
        v_count := v_count + 1;
      END IF;
    ELSE
      SELECT n_anterior.data_nfe
      INTO v_data_anterior
      FROM public.nfe n_anterior
      JOIN public.pedidos p_anterior ON p_anterior.id = n_anterior.pedido_id
      WHERE p_anterior.cliente_id = v_pedido.cliente_id
        AND p_anterior.status <> 'cancelado'
        AND (
          n_anterior.data_nfe < v_nfe.data_nfe
          OR (n_anterior.data_nfe = v_nfe.data_nfe
              AND (n_anterior.criado_em, n_anterior.id) < (v_nfe.criado_em, v_nfe.id))
        )
      ORDER BY n_anterior.data_nfe DESC, n_anterior.criado_em DESC, n_anterior.id DESC
      LIMIT 1;

      IF v_data_anterior IS NULL THEN
        v_tipo_int := 'interno_novo';
        v_pct_int := v_pct_novo;
      ELSE
        v_dias := v_nfe.data_nfe - v_data_anterior;
        IF v_dias > 120 THEN
          v_tipo_int := 'interno_reativacao';
          v_pct_int := v_pct_novo;
        ELSE
          v_tipo_int := 'interno_recorrente';
          v_pct_int := v_pct_recorrente;
        END IF;
      END IF;

      v_pct_int := COALESCE(v_pedido.percentual_interno_override, v_pct_int);
      IF v_internal_id IS NOT NULL THEN
        INSERT INTO public.comissoes
          (nfe_id, pedido_id, representante_id, tipo, percentual_aplicado, base_calculo, valor_comissao, mes_ref, ano_ref)
        VALUES
          (v_nfe.id, v_nfe.pedido_id, v_internal_id, v_tipo_int, v_pct_int, v_base,
           ROUND(v_base * v_pct_int / 100, 2), v_nfe.mes_ref, v_nfe.ano_ref);
        v_count := v_count + 1;
      END IF;
    END IF;

    FOR v_gestor IN
      SELECT pr.id AS user_id, pr.percentual_comissao
      FROM public.profiles pr
      JOIN public.user_roles ur ON ur.user_id = pr.id
      WHERE ur.role = 'gestor' AND pr.percentual_comissao > 0
    LOOP
      INSERT INTO public.comissoes
        (nfe_id, pedido_id, representante_id, gestor_user_id, tipo, percentual_aplicado,
         base_calculo, valor_comissao, mes_ref, ano_ref)
      VALUES
        (v_nfe.id, v_nfe.pedido_id, NULL, v_gestor.user_id, 'gestor', v_gestor.percentual_comissao,
         v_base, ROUND(v_base * v_gestor.percentual_comissao / 100, 2), v_nfe.mes_ref, v_nfe.ano_ref);
      v_count := v_count + 1;
    END LOOP;

    UPDATE public.clientes
    SET ultima_compra_at = GREATEST(COALESCE(ultima_compra_at, v_nfe.data_nfe::timestamptz), v_nfe.data_nfe::timestamptz)
    WHERE id = v_pedido.cliente_id;
  END LOOP;

  RETURN jsonb_build_object('comissoes_geradas', v_count);
END;
$function$;
