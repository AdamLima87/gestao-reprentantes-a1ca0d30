CREATE OR REPLACE FUNCTION public.marcar_comissoes_pagas_lote(
  p_ids uuid[],
  p_data date,
  p_observacao text DEFAULT NULL,
  p_comprovante_url text DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_uid uuid := auth.uid();
  v_can boolean;
  v_total int;
  v_ja_pagas int;
  v_atualizadas int;
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'Nao autenticado';
  END IF;

  v_can := public.has_role(v_uid, 'admin')
        OR public.has_role(v_uid, 'gestor')
        OR public.has_permission(v_uid, 'marcar_comissao_paga');

  IF NOT v_can THEN
    RAISE EXCEPTION 'Sem permissao para marcar comissoes como pagas';
  END IF;

  IF p_ids IS NULL OR array_length(p_ids, 1) IS NULL THEN
    RAISE EXCEPTION 'Nenhuma comissao informada';
  END IF;

  -- Lock rows and validate atomically
  PERFORM 1 FROM public.comissoes WHERE id = ANY(p_ids) FOR UPDATE;

  SELECT count(*) INTO v_total FROM public.comissoes WHERE id = ANY(p_ids);
  IF v_total <> array_length(p_ids, 1) THEN
    RAISE EXCEPTION 'Uma ou mais comissoes nao foram encontradas';
  END IF;

  SELECT count(*) INTO v_ja_pagas FROM public.comissoes
   WHERE id = ANY(p_ids) AND pago_em IS NOT NULL;
  IF v_ja_pagas > 0 THEN
    RAISE EXCEPTION 'Existem % comissoes ja marcadas como pagas', v_ja_pagas;
  END IF;

  UPDATE public.comissoes
     SET pago_em = p_data,
         observacao_pagamento = p_observacao,
         comprovante_url = COALESCE(p_comprovante_url, comprovante_url)
   WHERE id = ANY(p_ids);

  GET DIAGNOSTICS v_atualizadas = ROW_COUNT;

  RETURN jsonb_build_object('atualizadas', v_atualizadas);
END;
$$;

GRANT EXECUTE ON FUNCTION public.marcar_comissoes_pagas_lote(uuid[], date, text, text) TO authenticated;