UPDATE public.nfe
SET mes_ref = EXTRACT(MONTH FROM data_nfe)::int,
    ano_ref = EXTRACT(YEAR FROM data_nfe)::int
WHERE mes_ref <> EXTRACT(MONTH FROM data_nfe)::int
   OR ano_ref <> EXTRACT(YEAR FROM data_nfe)::int;

UPDATE public.pedidos
SET mes_ref = EXTRACT(MONTH FROM data_pedido)::int,
    ano_ref = EXTRACT(YEAR FROM data_pedido)::int
WHERE mes_ref <> EXTRACT(MONTH FROM data_pedido)::int
   OR ano_ref <> EXTRACT(YEAR FROM data_pedido)::int;

SELECT public.recalcular_comissoes_sem_auth();