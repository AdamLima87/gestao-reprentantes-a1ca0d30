CREATE OR REPLACE FUNCTION public.recalcular_comissoes_interno(
  p_mes integer DEFAULT NULL,
  p_ano integer DEFAULT NULL
)
RETURNS TABLE(nfe_id uuid, cliente text, nfe text, tipo_antigo text, tipo_novo text, valor_antigo numeric, valor_novo numeric)
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_rec RECORD;
  v_ultima_compra timestamptz;
  v_dias integer;
  v_tipo_novo text;
  v_pct_novo numeric;
  v_jefferson_id uuid;
BEGIN
  SELECT id INTO v_jefferson_id FROM representantes WHERE tipo = 'interno' ORDER BY criado_em LIMIT 1;

  FOR v_rec IN
    SELECT
      n.id AS nfe_id,
      n.numero_nfe,
      n.data_nfe,
      n.valor_nfe,
      n.mes_ref,
      n.ano_ref,
      p.cliente_id,
      p.valor_produtos,
      cl.nome AS cliente_nome,
      c.id AS comissao_id,
      c.tipo AS tipo_atual,
      c.percentual_aplicado,
      c.valor_comissao
    FROM nfe n
    JOIN pedidos p ON p.id = n.pedido_id
    JOIN clientes cl ON cl.id = p.cliente_id
    JOIN comissoes c ON c.nfe_id = n.id AND c.representante_id = v_jefferson_id
      AND c.tipo IN ('interno_novo', 'interno_reativacao', 'interno_recorrente')
    WHERE (p_mes IS NULL OR n.mes_ref = p_mes)
      AND (p_ano IS NULL OR n.ano_ref = p_ano)
    ORDER BY n.data_nfe ASC, n.id ASC
  LOOP
    SELECT MAX(n2.data_nfe) INTO v_ultima_compra
    FROM nfe n2
    JOIN pedidos p2 ON p2.id = n2.pedido_id
    WHERE p2.cliente_id = v_rec.cliente_id
      AND n2.data_nfe < v_rec.data_nfe
      AND n2.id != v_rec.nfe_id;

    IF v_ultima_compra IS NULL THEN
      v_dias := 999;
    ELSE
      v_dias := EXTRACT(DAY FROM (v_rec.data_nfe::timestamptz - v_ultima_compra))::integer;
    END IF;

    IF v_dias > 120 THEN
      IF v_ultima_compra IS NULL THEN
        v_tipo_novo := 'interno_novo';
      ELSE
        v_tipo_novo := 'interno_reativacao';
      END IF;
      v_pct_novo := 1.5;
    ELSE
      v_tipo_novo := 'interno_recorrente';
      v_pct_novo := 1.0;
    END IF;

    IF v_rec.tipo_atual::text != v_tipo_novo THEN
      UPDATE comissoes SET
        tipo = v_tipo_novo::public.comissao_tipo,
        percentual_aplicado = v_pct_novo,
        base_calculo = v_rec.valor_produtos,
        valor_comissao = ROUND(v_rec.valor_produtos * v_pct_novo / 100, 2)
      WHERE id = v_rec.comissao_id;

      nfe_id := v_rec.nfe_id;
      cliente := v_rec.cliente_nome;
      nfe := v_rec.numero_nfe;
      tipo_antigo := v_rec.tipo_atual::text;
      tipo_novo := v_tipo_novo;
      valor_antigo := v_rec.valor_comissao;
      valor_novo := ROUND(v_rec.valor_produtos * v_pct_novo / 100, 2);
      RETURN NEXT;
    END IF;

    UPDATE clientes SET ultima_compra_at = v_rec.data_nfe
    WHERE id = v_rec.cliente_id
      AND (ultima_compra_at IS NULL OR ultima_compra_at < v_rec.data_nfe);
  END LOOP;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.recalcular_comissoes_interno(integer, integer) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.recalcular_comissoes_interno(integer, integer) TO authenticated;