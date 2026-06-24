CREATE OR REPLACE FUNCTION public.recalcular_comissoes_representantes(p_mes integer DEFAULT NULL::integer, p_ano integer DEFAULT NULL::integer)
 RETURNS TABLE(nfe_id uuid, nfe text, representante text, percentual numeric, valor_comissao numeric)
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
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
    SELECT cc.percentual INTO v_pct
    FROM public.comissao_config cc
    WHERE cc.cliente_id = v_nfe.cliente_id
      AND cc.representante_id = v_nfe.representante_id
    LIMIT 1;

    IF v_pct IS NULL THEN
      v_pct := COALESCE(v_nfe.percentual_padrao, 5.0);
    END IF;

    DELETE FROM public.comissoes c
    WHERE c.nfe_id = v_nfe.id AND c.tipo = 'externo';

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
      DELETE FROM public.comissoes c
      WHERE c.nfe_id = v_nfe.id AND c.tipo = 'interno_sobre_rep';

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

    nfe_id := v_nfe.id;
    nfe := v_nfe.numero_nfe;
    representante := v_nfe.rep_nome;
    percentual := v_pct;
    valor_comissao := ROUND(v_nfe.valor_produtos * v_pct / 100, 2);
    RETURN NEXT;
  END LOOP;
END;
$function$;