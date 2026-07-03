
ALTER TABLE public.representantes
  ADD COLUMN IF NOT EXISTS percentual_recorrente NUMERIC(5,2) NOT NULL DEFAULT 1.0,
  ADD COLUMN IF NOT EXISTS percentual_sobre_rep NUMERIC(5,2) NOT NULL DEFAULT 0.5;

CREATE OR REPLACE FUNCTION public.calcular_comissoes_nfe()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_pedido        RECORD;
  v_rep           RECORD;
  v_pct_ext       NUMERIC := 5.0;
  v_pct_int       NUMERIC := 1.5;
  v_tipo_int      public.comissao_tipo := 'interno_novo';
  v_dias          INTEGER := 999;
  v_interno       RECORD;
  v_pct_recorrente NUMERIC := 1.0;
  v_pct_sobre_rep  NUMERIC := 0.5;
  v_pct_novo       NUMERIC := 1.5;
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

  SELECT * INTO v_interno
  FROM public.representantes
  WHERE tipo = 'interno' ORDER BY criado_em LIMIT 1;

  IF v_interno.id IS NOT NULL THEN
    v_pct_novo       := COALESCE(v_interno.percentual_padrao, 1.5);
    v_pct_recorrente := COALESCE(v_interno.percentual_recorrente, 1.0);
    v_pct_sobre_rep  := COALESCE(v_interno.percentual_sobre_rep, 0.5);
  END IF;

  IF v_pedido.representante_id IS NOT NULL THEN
    SELECT * INTO v_rep FROM public.representantes WHERE id = v_pedido.representante_id;

    SELECT percentual INTO v_pct_ext
    FROM public.comissao_config
    WHERE cliente_id = v_pedido.cliente_id
      AND representante_id = v_pedido.representante_id LIMIT 1;

    IF v_pct_ext IS NULL THEN v_pct_ext := COALESCE(v_rep.percentual_padrao, 5.0); END IF;

    INSERT INTO public.comissoes (nfe_id, pedido_id, representante_id, tipo, percentual_aplicado, base_calculo, valor_comissao, mes_ref, ano_ref)
    VALUES (NEW.id, NEW.pedido_id, v_pedido.representante_id, 'externo', v_pct_ext, NEW.valor_nfe, ROUND(NEW.valor_nfe * v_pct_ext / 100, 2), NEW.mes_ref, NEW.ano_ref);

    IF v_pedido.jefferson_participou AND v_interno.id IS NOT NULL THEN
      INSERT INTO public.comissoes (nfe_id, pedido_id, representante_id, tipo, percentual_aplicado, base_calculo, valor_comissao, mes_ref, ano_ref)
      VALUES (NEW.id, NEW.pedido_id, v_interno.id, 'interno_sobre_rep', v_pct_sobre_rep, NEW.valor_nfe, ROUND(NEW.valor_nfe * v_pct_sobre_rep / 100, 2), NEW.mes_ref, NEW.ano_ref);
    END IF;

  ELSE
    IF v_interno.id IS NOT NULL THEN
      IF v_pedido.ultima_compra_at IS NULL THEN v_dias := 999;
      ELSE v_dias := EXTRACT(DAY FROM (NEW.data_nfe::TIMESTAMP - v_pedido.ultima_compra_at::TIMESTAMP))::INTEGER;
      END IF;

      IF v_dias > 120 THEN
        v_tipo_int := CASE WHEN v_pedido.ultima_compra_at IS NULL THEN 'interno_novo'::public.comissao_tipo ELSE 'interno_reativacao'::public.comissao_tipo END;
        v_pct_int := v_pct_novo;
      ELSE
        v_tipo_int := 'interno_recorrente'; v_pct_int := v_pct_recorrente;
      END IF;

      INSERT INTO public.comissoes (nfe_id, pedido_id, representante_id, tipo, percentual_aplicado, base_calculo, valor_comissao, mes_ref, ano_ref)
      VALUES (NEW.id, NEW.pedido_id, v_interno.id, v_tipo_int, v_pct_int, NEW.valor_nfe, ROUND(NEW.valor_nfe * v_pct_int / 100, 2), NEW.mes_ref, NEW.ano_ref);
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
  v_ultima          TIMESTAMPTZ;
  v_ref_date        TIMESTAMPTZ;
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

  FOR v_nfe IN SELECT * FROM public.nfe ORDER BY data_nfe, criado_em LOOP
    SELECT p.*, c.ultima_compra_at INTO v_pedido
    FROM public.pedidos p JOIN public.clientes c ON c.id = p.cliente_id
    WHERE p.id = v_nfe.pedido_id;

    IF NOT FOUND OR v_pedido.status = 'cancelado' THEN CONTINUE; END IF;

    v_base := COALESCE(v_pedido.valor_produtos, 0);
    v_ref_date := COALESCE(v_nfe.data_nfe::timestamptz, v_nfe.criado_em);

    SELECT * INTO v_rep FROM public.representantes WHERE id = v_pedido.representante_id;
    v_internal_id := COALESCE(CASE WHEN v_rep.tipo = 'interno' THEN v_rep.id END, v_interno_id);
    v_pct_ext := COALESCE(v_rep.percentual_padrao, 5.0);

    IF v_rep.id IS NOT NULL AND v_rep.tipo = 'externo' THEN
      INSERT INTO public.comissoes (nfe_id, pedido_id, representante_id, tipo, percentual_aplicado, base_calculo, valor_comissao, mes_ref, ano_ref)
      VALUES (v_nfe.id, v_nfe.pedido_id, v_rep.id, 'externo', v_pct_ext, v_base,
              ROUND(v_base * v_pct_ext / 100, 2), v_nfe.mes_ref, v_nfe.ano_ref);
      v_count := v_count + 1;

      IF v_interno_id IS NOT NULL AND COALESCE(v_pedido.jefferson_participou, false) THEN
        INSERT INTO public.comissoes (nfe_id, pedido_id, representante_id, tipo, percentual_aplicado, base_calculo, valor_comissao, mes_ref, ano_ref)
        VALUES (v_nfe.id, v_nfe.pedido_id, v_interno_id, 'interno_sobre_rep', v_pct_sobre_rep, v_base,
                ROUND(v_base * v_pct_sobre_rep / 100, 2), v_nfe.mes_ref, v_nfe.ano_ref);
        v_count := v_count + 1;
      END IF;
    ELSIF (v_rep.id IS NOT NULL AND v_rep.tipo = 'interno') OR COALESCE(v_pedido.jefferson_participou, false) THEN
      v_ultima := v_pedido.ultima_compra_at;
      IF v_ultima IS NULL THEN
        v_tipo_int := 'interno_novo'; v_pct_int := v_pct_novo;
      ELSE
        v_dias := EXTRACT(DAY FROM (v_ref_date - v_ultima))::INTEGER;
        IF v_dias > 120 THEN v_tipo_int := 'interno_reativacao'; v_pct_int := v_pct_novo;
        ELSE v_tipo_int := 'interno_recorrente'; v_pct_int := v_pct_recorrente; END IF;
      END IF;

      IF v_internal_id IS NOT NULL THEN
        INSERT INTO public.comissoes (nfe_id, pedido_id, representante_id, tipo, percentual_aplicado, base_calculo, valor_comissao, mes_ref, ano_ref)
        VALUES (v_nfe.id, v_nfe.pedido_id, v_internal_id, v_tipo_int, v_pct_int, v_base,
                ROUND(v_base * v_pct_int / 100, 2), v_nfe.mes_ref, v_nfe.ano_ref);
        v_count := v_count + 1;
      END IF;
    END IF;

    UPDATE public.clientes SET ultima_compra_at = v_ref_date
    WHERE id = v_pedido.cliente_id
      AND (ultima_compra_at IS NULL OR ultima_compra_at < v_ref_date);
  END LOOP;

  RETURN jsonb_build_object('comissoes_geradas', v_count);
END;
$function$;
