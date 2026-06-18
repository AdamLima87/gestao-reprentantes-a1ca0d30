
-- ============ ENUMS ============
CREATE TYPE public.app_role AS ENUM ('admin','vendedor_interno','representante','financeiro');
CREATE TYPE public.rep_tipo AS ENUM ('externo','interno');
CREATE TYPE public.pedido_status AS ENUM ('pedido','producao','faturado','entregue','cancelado');
CREATE TYPE public.comissao_tipo AS ENUM ('externo','interno_novo','interno_reativacao','interno_recorrente','interno_sobre_rep');

-- ============ REPRESENTANTES ============
CREATE TABLE public.representantes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  nome text NOT NULL,
  regiao text,
  tipo public.rep_tipo NOT NULL DEFAULT 'externo',
  percentual_padrao numeric(5,2) NOT NULL DEFAULT 5.0,
  ativo boolean NOT NULL DEFAULT true,
  criado_em timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.representantes TO authenticated;
GRANT ALL ON public.representantes TO service_role;
ALTER TABLE public.representantes ENABLE ROW LEVEL SECURITY;

-- ============ PROFILES ============
CREATE TABLE public.profiles (
  id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  nome text NOT NULL DEFAULT '',
  representante_id uuid REFERENCES public.representantes(id) ON DELETE SET NULL,
  criado_em timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.profiles TO authenticated;
GRANT ALL ON public.profiles TO service_role;
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

-- ============ USER_ROLES ============
CREATE TABLE public.user_roles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role public.app_role NOT NULL,
  criado_em timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, role)
);
GRANT SELECT ON public.user_roles TO authenticated;
GRANT ALL ON public.user_roles TO service_role;
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;

-- has_role security definer
CREATE OR REPLACE FUNCTION public.has_role(_user_id uuid, _role public.app_role)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = _user_id AND role = _role)
$$;

CREATE OR REPLACE FUNCTION public.current_representante_id()
RETURNS uuid LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT representante_id FROM public.profiles WHERE id = auth.uid()
$$;

-- ============ CLIENTES ============
CREATE TABLE public.clientes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  nome text NOT NULL,
  cnpj text,
  regiao text,
  representante_id uuid REFERENCES public.representantes(id) ON DELETE SET NULL,
  ultima_compra_at timestamptz,
  ativo boolean NOT NULL DEFAULT true,
  criado_em timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.clientes TO authenticated;
GRANT ALL ON public.clientes TO service_role;
ALTER TABLE public.clientes ENABLE ROW LEVEL SECURITY;

-- ============ COMISSAO_CONFIG ============
CREATE TABLE public.comissao_config (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  cliente_id uuid NOT NULL REFERENCES public.clientes(id) ON DELETE CASCADE,
  representante_id uuid NOT NULL REFERENCES public.representantes(id) ON DELETE CASCADE,
  percentual numeric(5,2) NOT NULL,
  criado_em timestamptz NOT NULL DEFAULT now(),
  UNIQUE (cliente_id, representante_id)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.comissao_config TO authenticated;
GRANT ALL ON public.comissao_config TO service_role;
ALTER TABLE public.comissao_config ENABLE ROW LEVEL SECURITY;

-- ============ PEDIDOS ============
CREATE TABLE public.pedidos (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  numero_pedido text NOT NULL,
  numero_pedido_cliente text,
  cliente_id uuid NOT NULL REFERENCES public.clientes(id) ON DELETE RESTRICT,
  representante_id uuid NOT NULL REFERENCES public.representantes(id) ON DELETE RESTRICT,
  data_pedido date NOT NULL DEFAULT CURRENT_DATE,
  prazo_entrega date,
  valor_produtos numeric(14,2) NOT NULL DEFAULT 0,
  status public.pedido_status NOT NULL DEFAULT 'pedido',
  mes_ref integer NOT NULL DEFAULT EXTRACT(MONTH FROM CURRENT_DATE),
  ano_ref integer NOT NULL DEFAULT EXTRACT(YEAR FROM CURRENT_DATE),
  jefferson_participou boolean NOT NULL DEFAULT false,
  criado_em timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX ON public.pedidos (representante_id);
CREATE INDEX ON public.pedidos (cliente_id);
CREATE INDEX ON public.pedidos (status);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.pedidos TO authenticated;
GRANT ALL ON public.pedidos TO service_role;
ALTER TABLE public.pedidos ENABLE ROW LEVEL SECURITY;

-- ============ NFE ============
CREATE TABLE public.nfe (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  pedido_id uuid NOT NULL REFERENCES public.pedidos(id) ON DELETE CASCADE,
  numero_nfe text NOT NULL,
  data_nfe date NOT NULL,
  valor_nfe numeric(14,2) NOT NULL,
  mes_ref integer NOT NULL,
  ano_ref integer NOT NULL,
  data_entrega date,
  criado_em timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX ON public.nfe (pedido_id);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.nfe TO authenticated;
GRANT ALL ON public.nfe TO service_role;
ALTER TABLE public.nfe ENABLE ROW LEVEL SECURITY;

-- ============ COMISSOES ============
CREATE TABLE public.comissoes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  nfe_id uuid NOT NULL REFERENCES public.nfe(id) ON DELETE CASCADE,
  pedido_id uuid NOT NULL REFERENCES public.pedidos(id) ON DELETE CASCADE,
  representante_id uuid NOT NULL REFERENCES public.representantes(id) ON DELETE RESTRICT,
  tipo public.comissao_tipo NOT NULL,
  percentual_aplicado numeric(5,2) NOT NULL,
  base_calculo numeric(14,2) NOT NULL,
  valor_comissao numeric(14,2) NOT NULL,
  mes_ref integer NOT NULL,
  ano_ref integer NOT NULL,
  criado_em timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX ON public.comissoes (representante_id);
CREATE INDEX ON public.comissoes (mes_ref, ano_ref);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.comissoes TO authenticated;
GRANT ALL ON public.comissoes TO service_role;
ALTER TABLE public.comissoes ENABLE ROW LEVEL SECURITY;

-- ============ METAS ============
CREATE TABLE public.metas (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  mes integer NOT NULL,
  ano integer NOT NULL,
  representante_id uuid REFERENCES public.representantes(id) ON DELETE CASCADE,
  valor numeric(14,2) NOT NULL,
  criado_em timestamptz NOT NULL DEFAULT now(),
  UNIQUE (mes, ano, representante_id)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.metas TO authenticated;
GRANT ALL ON public.metas TO service_role;
ALTER TABLE public.metas ENABLE ROW LEVEL SECURITY;

-- ============ RLS POLICIES ============

-- profiles: own row read; admin reads all
CREATE POLICY "profiles_self_read" ON public.profiles FOR SELECT TO authenticated USING (id = auth.uid() OR public.has_role(auth.uid(), 'admin'));
CREATE POLICY "profiles_self_update" ON public.profiles FOR UPDATE TO authenticated USING (id = auth.uid() OR public.has_role(auth.uid(), 'admin'));
CREATE POLICY "profiles_admin_insert" ON public.profiles FOR INSERT TO authenticated WITH CHECK (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "profiles_admin_delete" ON public.profiles FOR DELETE TO authenticated USING (public.has_role(auth.uid(), 'admin'));

-- user_roles: read own; admin manage
CREATE POLICY "user_roles_self_read" ON public.user_roles FOR SELECT TO authenticated USING (user_id = auth.uid() OR public.has_role(auth.uid(), 'admin'));
CREATE POLICY "user_roles_admin_all" ON public.user_roles FOR ALL TO authenticated USING (public.has_role(auth.uid(), 'admin')) WITH CHECK (public.has_role(auth.uid(), 'admin'));

-- representantes: todos autenticados leem; admin gerencia
CREATE POLICY "rep_read_all" ON public.representantes FOR SELECT TO authenticated USING (true);
CREATE POLICY "rep_admin_all" ON public.representantes FOR ALL TO authenticated USING (public.has_role(auth.uid(), 'admin')) WITH CHECK (public.has_role(auth.uid(), 'admin'));

-- clientes: admin/vendedor_interno/financeiro vêem tudo; rep externo vê só os seus
CREATE POLICY "clientes_read" ON public.clientes FOR SELECT TO authenticated USING (
  public.has_role(auth.uid(), 'admin')
  OR public.has_role(auth.uid(), 'vendedor_interno')
  OR public.has_role(auth.uid(), 'financeiro')
  OR representante_id = public.current_representante_id()
);
CREATE POLICY "clientes_admin_all" ON public.clientes FOR ALL TO authenticated USING (public.has_role(auth.uid(), 'admin')) WITH CHECK (public.has_role(auth.uid(), 'admin'));

-- comissao_config: somente admin
CREATE POLICY "cconfig_admin_all" ON public.comissao_config FOR ALL TO authenticated USING (public.has_role(auth.uid(), 'admin')) WITH CHECK (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "cconfig_read" ON public.comissao_config FOR SELECT TO authenticated USING (
  public.has_role(auth.uid(), 'admin')
  OR public.has_role(auth.uid(), 'vendedor_interno')
  OR public.has_role(auth.uid(), 'financeiro')
  OR representante_id = public.current_representante_id()
);

-- pedidos: visibilidade por perfil
CREATE POLICY "pedidos_read" ON public.pedidos FOR SELECT TO authenticated USING (
  public.has_role(auth.uid(), 'admin')
  OR public.has_role(auth.uid(), 'vendedor_interno')
  OR public.has_role(auth.uid(), 'financeiro')
  OR representante_id = public.current_representante_id()
);
CREATE POLICY "pedidos_insert" ON public.pedidos FOR INSERT TO authenticated WITH CHECK (
  public.has_role(auth.uid(), 'admin')
  OR public.has_role(auth.uid(), 'vendedor_interno')
  OR representante_id = public.current_representante_id()
);
CREATE POLICY "pedidos_update" ON public.pedidos FOR UPDATE TO authenticated USING (
  public.has_role(auth.uid(), 'admin')
  OR public.has_role(auth.uid(), 'vendedor_interno')
  OR representante_id = public.current_representante_id()
);
CREATE POLICY "pedidos_delete_admin" ON public.pedidos FOR DELETE TO authenticated USING (public.has_role(auth.uid(), 'admin'));

-- nfe: mesma visibilidade do pedido pai
CREATE POLICY "nfe_read" ON public.nfe FOR SELECT TO authenticated USING (
  public.has_role(auth.uid(), 'admin')
  OR public.has_role(auth.uid(), 'vendedor_interno')
  OR public.has_role(auth.uid(), 'financeiro')
  OR EXISTS (SELECT 1 FROM public.pedidos p WHERE p.id = pedido_id AND p.representante_id = public.current_representante_id())
);
CREATE POLICY "nfe_insert" ON public.nfe FOR INSERT TO authenticated WITH CHECK (
  public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'vendedor_interno')
);
CREATE POLICY "nfe_update_admin" ON public.nfe FOR UPDATE TO authenticated USING (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "nfe_delete_admin" ON public.nfe FOR DELETE TO authenticated USING (public.has_role(auth.uid(), 'admin'));

-- comissoes: histórico, leitura conforme perfil
CREATE POLICY "comissoes_read" ON public.comissoes FOR SELECT TO authenticated USING (
  public.has_role(auth.uid(), 'admin')
  OR public.has_role(auth.uid(), 'vendedor_interno')
  OR public.has_role(auth.uid(), 'financeiro')
  OR representante_id = public.current_representante_id()
);
CREATE POLICY "comissoes_admin_write" ON public.comissoes FOR ALL TO authenticated USING (public.has_role(auth.uid(), 'admin')) WITH CHECK (public.has_role(auth.uid(), 'admin'));

-- metas: leitura todos autenticados; admin gerencia
CREATE POLICY "metas_read" ON public.metas FOR SELECT TO authenticated USING (true);
CREATE POLICY "metas_admin_all" ON public.metas FOR ALL TO authenticated USING (public.has_role(auth.uid(), 'admin')) WITH CHECK (public.has_role(auth.uid(), 'admin'));

-- ============ TRIGGER: handle_new_user ============
-- 1º usuário => admin. Demais => representante (sem rep vinculado; admin ajusta depois).
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_count int;
  v_role public.app_role;
BEGIN
  INSERT INTO public.profiles (id, nome) VALUES (NEW.id, COALESCE(NEW.raw_user_meta_data->>'nome', NEW.email));
  SELECT count(*) INTO v_count FROM public.user_roles;
  IF v_count = 0 THEN v_role := 'admin'; ELSE v_role := 'representante'; END IF;
  INSERT INTO public.user_roles (user_id, role) VALUES (NEW.id, v_role);
  RETURN NEW;
END;
$$;

CREATE TRIGGER on_auth_user_created
AFTER INSERT ON auth.users
FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- ============ TRIGGER: calcular comissões ao inserir NF-e ============
CREATE OR REPLACE FUNCTION public.calc_comissoes_on_nfe()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_pedido public.pedidos%ROWTYPE;
  v_cliente public.clientes%ROWTYPE;
  v_rep public.representantes%ROWTYPE;
  v_perc_ext numeric(5,2);
  v_valor_ext numeric(14,2);
  v_jeff_rep_id uuid;
  v_dias int;
  v_tipo_int public.comissao_tipo;
  v_perc_int numeric(5,2);
  v_valor_int numeric(14,2);
  v_valor_sobre_rep numeric(14,2);
BEGIN
  SELECT * INTO v_pedido FROM public.pedidos WHERE id = NEW.pedido_id;
  SELECT * INTO v_cliente FROM public.clientes WHERE id = v_pedido.cliente_id;
  SELECT * INTO v_rep FROM public.representantes WHERE id = v_pedido.representante_id;

  -- Comissão do representante externo (ou interno responsável pelo pedido)
  SELECT percentual INTO v_perc_ext
    FROM public.comissao_config
    WHERE cliente_id = v_cliente.id AND representante_id = v_rep.id;
  IF v_perc_ext IS NULL THEN v_perc_ext := v_rep.percentual_padrao; END IF;
  v_valor_ext := ROUND(NEW.valor_nfe * v_perc_ext / 100, 2);

  INSERT INTO public.comissoes (nfe_id, pedido_id, representante_id, tipo, percentual_aplicado, base_calculo, valor_comissao, mes_ref, ano_ref)
  VALUES (NEW.id, v_pedido.id, v_rep.id, 'externo', v_perc_ext, NEW.valor_nfe, v_valor_ext, NEW.mes_ref, NEW.ano_ref);

  -- Vendedor interno (Jefferson): primeiro rep com tipo='interno' e ativo
  SELECT id INTO v_jeff_rep_id FROM public.representantes WHERE tipo = 'interno' AND ativo = true ORDER BY criado_em LIMIT 1;

  IF v_jeff_rep_id IS NOT NULL AND v_pedido.jefferson_participou THEN
    IF v_cliente.ultima_compra_at IS NULL THEN
      v_tipo_int := 'interno_novo';
      v_perc_int := 1.5;
    ELSE
      v_dias := EXTRACT(DAY FROM (NEW.data_nfe::timestamptz - v_cliente.ultima_compra_at));
      IF v_dias > 120 THEN
        v_tipo_int := 'interno_reativacao';
        v_perc_int := 1.5;
      ELSE
        v_tipo_int := 'interno_recorrente';
        v_perc_int := 1.0;
      END IF;
    END IF;
    v_valor_int := ROUND(NEW.valor_nfe * v_perc_int / 100, 2);
    INSERT INTO public.comissoes (nfe_id, pedido_id, representante_id, tipo, percentual_aplicado, base_calculo, valor_comissao, mes_ref, ano_ref)
    VALUES (NEW.id, v_pedido.id, v_jeff_rep_id, v_tipo_int, v_perc_int, NEW.valor_nfe, v_valor_int, NEW.mes_ref, NEW.ano_ref);
  END IF;

  -- 0,5% sobre rep externo, sempre que o rep do pedido for externo (e existir Jefferson)
  IF v_jeff_rep_id IS NOT NULL AND v_rep.tipo = 'externo' THEN
    v_valor_sobre_rep := ROUND(NEW.valor_nfe * 0.5 / 100, 2);
    INSERT INTO public.comissoes (nfe_id, pedido_id, representante_id, tipo, percentual_aplicado, base_calculo, valor_comissao, mes_ref, ano_ref)
    VALUES (NEW.id, v_pedido.id, v_jeff_rep_id, 'interno_sobre_rep', 0.5, NEW.valor_nfe, v_valor_sobre_rep, NEW.mes_ref, NEW.ano_ref);
  END IF;

  -- Atualizar cliente.ultima_compra_at e pedido.status
  UPDATE public.clientes SET ultima_compra_at = NEW.data_nfe WHERE id = v_cliente.id;
  UPDATE public.pedidos SET status = 'faturado' WHERE id = v_pedido.id AND status NOT IN ('entregue','cancelado');

  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_calc_comissoes
AFTER INSERT ON public.nfe
FOR EACH ROW EXECUTE FUNCTION public.calc_comissoes_on_nfe();
