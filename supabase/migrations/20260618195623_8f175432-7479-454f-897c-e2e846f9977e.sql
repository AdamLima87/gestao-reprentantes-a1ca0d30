
DELETE FROM public.comissoes WHERE pedido_id IN (SELECT id FROM public.pedidos WHERE status = 'cancelado');
DELETE FROM public.nfe WHERE pedido_id IN (SELECT id FROM public.pedidos WHERE status = 'cancelado');

CREATE OR REPLACE FUNCTION public.recalcular_comissoes_sem_auth()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
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

    IF NOT FOUND OR v_pedido.status = 'cancelado' THEN
      CONTINUE;
    END IF;

    SELECT * INTO v_rep FROM public.representantes WHERE id = v_pedido.representante_id;

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
        v_tipo_int := 'interno_novo'; v_pct_int := 1.5;
      ELSE
        v_dias := EXTRACT(DAY FROM (now() - v_pedido.ultima_compra_at))::INTEGER;
        IF v_dias > 180 THEN v_tipo_int := 'interno_reativacao'; v_pct_int := 1.5;
        ELSE v_tipo_int := 'interno_recorrente'; v_pct_int := 1.0; END IF;
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
$$;
