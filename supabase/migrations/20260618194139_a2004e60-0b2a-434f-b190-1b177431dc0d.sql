CREATE OR REPLACE FUNCTION public.ensure_vendedor_interno_representante()
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_rep_id uuid;
  v_profile_id uuid;
  v_nome text;
BEGIN
  SELECT r.id
  INTO v_rep_id
  FROM public.representantes r
  WHERE r.tipo = 'interno'
  ORDER BY r.criado_em ASC
  LIMIT 1;

  IF v_rep_id IS NOT NULL THEN
    UPDATE public.profiles p
    SET representante_id = v_rep_id
    WHERE p.representante_id IS NULL
      AND EXISTS (
        SELECT 1
        FROM public.user_roles ur
        WHERE ur.user_id = p.id
          AND ur.role = 'vendedor_interno'
      );

    RETURN v_rep_id;
  END IF;

  SELECT p.id, NULLIF(TRIM(p.nome), '')
  INTO v_profile_id, v_nome
  FROM public.profiles p
  JOIN public.user_roles ur ON ur.user_id = p.id
  WHERE ur.role = 'vendedor_interno'
  ORDER BY p.criado_em ASC
  LIMIT 1;

  IF v_profile_id IS NULL THEN
    RETURN NULL;
  END IF;

  INSERT INTO public.representantes (nome, tipo, percentual_padrao, ativo)
  VALUES (COALESCE(v_nome, 'Vendedor Interno'), 'interno', 1.5, true)
  RETURNING id INTO v_rep_id;

  UPDATE public.profiles p
  SET representante_id = v_rep_id
  WHERE p.id = v_profile_id
     OR (
       p.representante_id IS NULL
       AND EXISTS (
         SELECT 1
         FROM public.user_roles ur
         WHERE ur.user_id = p.id
           AND ur.role = 'vendedor_interno'
       )
     );

  RETURN v_rep_id;
END;
$function$;

REVOKE EXECUTE ON FUNCTION public.ensure_vendedor_interno_representante() FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.ensure_vendedor_interno_representante() FROM anon;
GRANT EXECUTE ON FUNCTION public.ensure_vendedor_interno_representante() TO authenticated;
GRANT EXECUTE ON FUNCTION public.ensure_vendedor_interno_representante() TO service_role;

CREATE OR REPLACE FUNCTION public.calcular_comissoes_nfe()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_pedido        RECORD;
  v_rep           RECORD;
  v_pct_ext       NUMERIC;
  v_pct_int       NUMERIC := 1.5;
  v_tipo_int      public.comissao_tipo := 'interno_novo';
  v_dias          INTEGER := 999;
  v_jefferson_id  UUID;
  v_internal_id   UUID;
  v_ultima        TIMESTAMPTZ;
BEGIN
  SELECT p.*, c.ultima_compra_at
  INTO v_pedido
  FROM public.pedidos p
  JOIN public.clientes c ON c.id = p.cliente_id
  WHERE p.id = NEW.pedido_id;

  IF NOT FOUND THEN
    RETURN NEW;
  END IF;

  UPDATE public.pedidos
  SET status = 'faturado'
  WHERE id = NEW.pedido_id
    AND status NOT IN ('faturado','entregue','cancelado');

  SELECT * INTO v_rep
  FROM public.representantes
  WHERE id = v_pedido.representante_id;

  v_jefferson_id := public.ensure_vendedor_interno_representante();
  v_internal_id := COALESCE(CASE WHEN v_rep.tipo = 'interno' THEN v_rep.id END, v_jefferson_id);
  v_pct_ext := COALESCE(v_rep.percentual_padrao, 5.0);

  IF v_rep.id IS NOT NULL AND v_rep.tipo = 'externo' THEN
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
  ELSIF (v_rep.id IS NOT NULL AND v_rep.tipo = 'interno') OR COALESCE(v_pedido.jefferson_participou, false) THEN
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

    IF v_internal_id IS NOT NULL THEN
      INSERT INTO public.comissoes (
        nfe_id, pedido_id, representante_id,
        tipo, percentual_aplicado, base_calculo, valor_comissao,
        mes_ref, ano_ref
      ) VALUES (
        NEW.id, NEW.pedido_id, v_internal_id,
        v_tipo_int, v_pct_int, NEW.valor_nfe,
        ROUND(NEW.valor_nfe * v_pct_int / 100, 2),
        NEW.mes_ref, NEW.ano_ref
      );
    END IF;
  END IF;

  UPDATE public.clientes
  SET ultima_compra_at = now()
  WHERE id = v_pedido.cliente_id;

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
  v_nfe           RECORD;
  v_pedido        RECORD;
  v_rep           RECORD;
  v_pct_ext       NUMERIC;
  v_pct_int       NUMERIC;
  v_tipo_int      public.comissao_tipo;
  v_dias          INTEGER;
  v_jefferson_id  UUID;
  v_internal_id   UUID;
  v_count         INTEGER := 0;
BEGIN
  v_jefferson_id := public.ensure_vendedor_interno_representante();

  DELETE FROM public.comissoes WHERE id IS NOT NULL;

  FOR v_nfe IN SELECT * FROM public.nfe ORDER BY criado_em LOOP
    SELECT p.*, c.ultima_compra_at
    INTO v_pedido
    FROM public.pedidos p
    JOIN public.clientes c ON c.id = p.cliente_id
    WHERE p.id = v_nfe.pedido_id;

    IF NOT FOUND THEN
      CONTINUE;
    END IF;

    SELECT * INTO v_rep
    FROM public.representantes
    WHERE id = v_pedido.representante_id;

    v_internal_id := COALESCE(CASE WHEN v_rep.tipo = 'interno' THEN v_rep.id END, v_jefferson_id);
    v_pct_ext := COALESCE(v_rep.percentual_padrao, 5.0);

    IF v_rep.id IS NOT NULL AND v_rep.tipo = 'externo' THEN
      INSERT INTO public.comissoes (nfe_id, pedido_id, representante_id, tipo, percentual_aplicado, base_calculo, valor_comissao, mes_ref, ano_ref)
      VALUES (v_nfe.id, v_nfe.pedido_id, v_rep.id, 'externo', v_pct_ext, v_nfe.valor_nfe,
              ROUND(v_nfe.valor_nfe * v_pct_ext / 100, 2), v_nfe.mes_ref, v_nfe.ano_ref);
      v_count := v_count + 1;

      IF v_jefferson_id IS NOT NULL THEN
        INSERT INTO public.comissoes (nfe_id, pedido_id, representante_id, tipo, percentual_aplicado, base_calculo, valor_comissao, mes_ref, ano_ref)
        VALUES (v_nfe.id, v_nfe.pedido_id, v_jefferson_id, 'interno_sobre_rep', 0.5, v_nfe.valor_nfe,
                ROUND(v_nfe.valor_nfe * v_pct_ext / 100 * 0.5 / 100, 2), v_nfe.mes_ref, v_nfe.ano_ref);
        v_count := v_count + 1;
      END IF;
    ELSIF (v_rep.id IS NOT NULL AND v_rep.tipo = 'interno') OR COALESCE(v_pedido.jefferson_participou, false) THEN
      IF v_pedido.ultima_compra_at IS NULL THEN
        v_tipo_int := 'interno_novo';
        v_pct_int := 1.5;
      ELSE
        v_dias := EXTRACT(DAY FROM (now() - v_pedido.ultima_compra_at))::INTEGER;
        IF v_dias > 180 THEN
          v_tipo_int := 'interno_reativacao';
          v_pct_int := 1.5;
        ELSE
          v_tipo_int := 'interno_recorrente';
          v_pct_int := 1.0;
        END IF;
      END IF;

      IF v_internal_id IS NOT NULL THEN
        INSERT INTO public.comissoes (nfe_id, pedido_id, representante_id, tipo, percentual_aplicado, base_calculo, valor_comissao, mes_ref, ano_ref)
        VALUES (v_nfe.id, v_nfe.pedido_id, v_internal_id, v_tipo_int, v_pct_int, v_nfe.valor_nfe,
                ROUND(v_nfe.valor_nfe * v_pct_int / 100, 2), v_nfe.mes_ref, v_nfe.ano_ref);
        v_count := v_count + 1;
      END IF;
    END IF;
  END LOOP;

  RETURN jsonb_build_object('comissoes_geradas', v_count);
END;
$function$;

REVOKE EXECUTE ON FUNCTION public.recalcular_comissoes_sem_auth() FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.recalcular_comissoes_sem_auth() FROM anon;
REVOKE EXECUTE ON FUNCTION public.recalcular_comissoes_sem_auth() FROM authenticated;
GRANT EXECUTE ON FUNCTION public.recalcular_comissoes_sem_auth() TO service_role;

CREATE OR REPLACE FUNCTION public.reprocessar_comissoes()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
BEGIN
  IF NOT public.has_role(auth.uid(), 'admin') THEN
    RAISE EXCEPTION 'Apenas administradores podem reprocessar comissoes';
  END IF;

  RETURN public.recalcular_comissoes_sem_auth();
END;
$function$;

REVOKE EXECUTE ON FUNCTION public.reprocessar_comissoes() FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.reprocessar_comissoes() FROM anon;
GRANT EXECUTE ON FUNCTION public.reprocessar_comissoes() TO authenticated;
GRANT EXECUTE ON FUNCTION public.reprocessar_comissoes() TO service_role;

SELECT public.recalcular_comissoes_sem_auth();