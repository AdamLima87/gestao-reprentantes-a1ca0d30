
CREATE OR REPLACE FUNCTION public.remover_comissoes_pedido_cancelado()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.status = 'cancelado' AND COALESCE(OLD.status, '') <> 'cancelado' THEN
    DELETE FROM public.comissoes WHERE pedido_id = NEW.id;
    DELETE FROM public.nfe WHERE pedido_id = NEW.id;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_remover_comissoes_pedido_cancelado ON public.pedidos;
CREATE TRIGGER trg_remover_comissoes_pedido_cancelado
AFTER UPDATE OF status ON public.pedidos
FOR EACH ROW
EXECUTE FUNCTION public.remover_comissoes_pedido_cancelado();

CREATE OR REPLACE FUNCTION public.remover_comissoes_nfe_excluida()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  DELETE FROM public.comissoes WHERE nfe_id = OLD.id;
  RETURN OLD;
END;
$$;

DROP TRIGGER IF EXISTS trg_remover_comissoes_nfe_excluida ON public.nfe;
CREATE TRIGGER trg_remover_comissoes_nfe_excluida
BEFORE DELETE ON public.nfe
FOR EACH ROW
EXECUTE FUNCTION public.remover_comissoes_nfe_excluida();
