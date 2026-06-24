CREATE OR REPLACE FUNCTION public.recalcular_comissoes_gestor(p_mes integer DEFAULT NULL::integer, p_ano integer DEFAULT NULL::integer)
 RETURNS TABLE(nfe_id uuid, nfe text, valor_base numeric, gestor_nome text, percentual numeric, valor_comissao numeric)
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
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
    DELETE FROM public.comissoes c
    WHERE c.nfe_id = v_nfe.id AND c.tipo = 'gestor';

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

      nfe_id := v_nfe.id;
      nfe := v_nfe.numero_nfe;
      valor_base := v_nfe.valor_produtos;
      gestor_nome := v_gestor.nome;
      percentual := v_gestor.percentual_comissao;
      valor_comissao := ROUND(v_nfe.valor_produtos * v_gestor.percentual_comissao / 100, 2);
      RETURN NEXT;
    END LOOP;
  END LOOP;
END;
$function$;