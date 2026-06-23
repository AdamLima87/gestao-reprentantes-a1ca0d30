import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth, type AppRole } from "@/hooks/use-auth";

export const PERMISSION_KEYS = [
  "criar_pedidos",
  "editar_pedidos",
  "cancelar_pedidos",
  "registrar_nfe",
  "marcar_comissao_paga",
  "exportar_relatorios",
  "importar_planilhas",
  "gerar_contrato_pdf",
  "editar_percentual_cliente",
  "cadastrar_clientes",
  "cadastrar_representantes",
  "criar_usuarios",
] as const;

export type PermissionKey = (typeof PERMISSION_KEYS)[number];

export const PERMISSION_LABELS: Record<PermissionKey, { titulo: string; descricao: string }> = {
  criar_pedidos: { titulo: "Criar pedidos", descricao: "Pode cadastrar novos pedidos no sistema." },
  editar_pedidos: { titulo: "Editar pedidos", descricao: "Pode alterar dados de pedidos existentes." },
  cancelar_pedidos: { titulo: "Cancelar pedidos", descricao: "Pode cancelar pedidos já registrados." },
  registrar_nfe: { titulo: "Registrar NF-e", descricao: "Pode emitir/registrar notas fiscais eletrônicas." },
  marcar_comissao_paga: { titulo: "Marcar comissão como paga", descricao: "Pode dar baixa em comissões com comprovante." },
  exportar_relatorios: { titulo: "Exportar relatórios", descricao: "Pode baixar relatórios em PDF/CSV." },
  importar_planilhas: { titulo: "Importar planilhas", descricao: "Pode acessar a aba de importação de dados." },
  gerar_contrato_pdf: { titulo: "Gerar contrato PDF", descricao: "Pode gerar o contrato de representação." },
  editar_percentual_cliente: { titulo: "Editar % por cliente", descricao: "Pode alterar percentuais específicos por cliente." },
  cadastrar_clientes: { titulo: "Cadastrar clientes", descricao: "Pode criar novos clientes." },
  cadastrar_representantes: { titulo: "Cadastrar representantes", descricao: "Pode criar novos representantes." },
  criar_usuarios: { titulo: "Criar usuários", descricao: "Pode convidar/cadastrar novos usuários do sistema." },
};

export const ROLE_DEFAULTS: Record<AppRole, ReadonlySet<PermissionKey>> = {
  admin: new Set(PERMISSION_KEYS),
  gestor: new Set(PERMISSION_KEYS),
  vendedor_interno: new Set([
    "criar_pedidos",
    "editar_pedidos",
    "registrar_nfe",
    "exportar_relatorios",
    "cadastrar_clientes",
  ]),
  financeiro: new Set([
    "marcar_comissao_paga",
    "exportar_relatorios",
    "registrar_nfe",
  ]),
  representante: new Set(["criar_pedidos", "exportar_relatorios"]),
};

export function roleDefault(roles: AppRole[], perm: PermissionKey): boolean {
  return roles.some((r) => ROLE_DEFAULTS[r]?.has(perm));
}

export interface PermissionsState {
  loading: boolean;
  overrides: Record<string, boolean>; // permissao -> concedida
  can: (perm: PermissionKey | string) => boolean;
}

export function usePermissions(userId?: string | null): PermissionsState {
  const auth = useAuth();
  const uid = userId ?? auth.user?.id ?? null;
  const [overrides, setOverrides] = useState<Record<string, boolean>>({});
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!uid) {
      setOverrides({});
      setLoading(false);
      return;
    }
    let active = true;
    setLoading(true);
    supabase
      .from("user_permissions" as any)
      .select("permissao, concedida")
      .eq("user_id", uid)
      .then(({ data }) => {
        if (!active) return;
        const map: Record<string, boolean> = {};
        for (const row of (data ?? []) as Array<{ permissao: string; concedida: boolean }>) {
          map[row.permissao] = row.concedida;
        }
        setOverrides(map);
        setLoading(false);
      });
    return () => { active = false; };
  }, [uid]);

  const can = (perm: PermissionKey | string) => {
    if (perm in overrides) return overrides[perm];
    return roleDefault(auth.roles, perm as PermissionKey);
  };

  return { loading, overrides, can };
}
