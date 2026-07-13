CREATE OR REPLACE FUNCTION public.sync_nfe_mes_ano_ref()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  IF NEW.data_nfe IS NOT NULL THEN
    NEW.mes_ref := EXTRACT(MONTH FROM NEW.data_nfe)::int;
    NEW.ano_ref := EXTRACT(YEAR FROM NEW.data_nfe)::int;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_sync_nfe_mes_ano_ref ON public.nfe;
CREATE TRIGGER trg_sync_nfe_mes_ano_ref
BEFORE INSERT OR UPDATE OF data_nfe, mes_ref, ano_ref ON public.nfe
FOR EACH ROW EXECUTE FUNCTION public.sync_nfe_mes_ano_ref();

CREATE OR REPLACE FUNCTION public.sync_pedidos_mes_ano_ref()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  IF NEW.data_pedido IS NOT NULL THEN
    NEW.mes_ref := EXTRACT(MONTH FROM NEW.data_pedido)::int;
    NEW.ano_ref := EXTRACT(YEAR FROM NEW.data_pedido)::int;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_sync_pedidos_mes_ano_ref ON public.pedidos;
CREATE TRIGGER trg_sync_pedidos_mes_ano_ref
BEFORE INSERT OR UPDATE OF data_pedido, mes_ref, ano_ref ON public.pedidos
FOR EACH ROW EXECUTE FUNCTION public.sync_pedidos_mes_ano_ref();