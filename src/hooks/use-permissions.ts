import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth, type AppRole } from "@/hooks/use-auth";

export const PERMISSION_KEYS = [
  // Visibilidade geral
  "ver_dashboard",
  "ver_pedidos",
  "ver_nfe",
  "ver_comissoes",
  "ver_relatorios",
  "ver_clientes",
  "ver_representantes",
  // Escopo de dados
  "ver_todos_pedidos",
  "ver_todas_nfe",
  "ver_todas_comissoes",
  // Pedidos
  "criar_pedidos",
  "editar_pedidos",
  "cancelar_pedidos",
  "excluir_pedidos",
  // NF-e
  "registrar_nfe",
  "registrar_entrega",
  "excluir_nfe",
  // Comissões
  "marcar_comissao_paga",
  "recalcular_comissoes",
  // Cadastros
  "cadastrar_clientes",
  "cadastrar_representantes",
  "criar_usuarios",
  "editar_percentual_cliente",
  "gerar_contrato_pdf",
  "enviar_contrato_assinatura",
  "visualizar_contratos_assinatura",
  "importar_planilhas",
  // Relatórios
  "exportar_relatorios",
  "enviar_extrato_email",
  "ver_comissao_gestor",
  "ver_faturamento_total",
  // Overrides financeiros
  "editar_percentual_pedido",
] as const;


export type PermissionKey = (typeof PERMISSION_KEYS)[number];

export const PERMISSION_CATEGORIES: { categoria: string; chaves: PermissionKey[] }[] = [
  { categoria: "Visibilidade geral", chaves: ["ver_dashboard", "ver_pedidos", "ver_nfe", "ver_comissoes", "ver_relatorios", "ver_clientes", "ver_representantes"] },
  { categoria: "Escopo de dados", chaves: ["ver_todos_pedidos", "ver_todas_nfe", "ver_todas_comissoes"] },
  { categoria: "Pedidos", chaves: ["criar_pedidos", "editar_pedidos", "cancelar_pedidos", "excluir_pedidos"] },
  { categoria: "NF-e", chaves: ["registrar_nfe", "registrar_entrega", "excluir_nfe"] },
  { categoria: "Comissões", chaves: ["marcar_comissao_paga", "recalcular_comissoes"] },
  { categoria: "Cadastros", chaves: ["cadastrar_clientes", "cadastrar_representantes", "gerar_contrato_pdf", "enviar_contrato_assinatura", "visualizar_contratos_assinatura", "editar_percentual_cliente", "editar_percentual_pedido", "importar_planilhas", "criar_usuarios"] },
  { categoria: "Relatórios", chaves: ["exportar_relatorios", "enviar_extrato_email", "ver_comissao_gestor", "ver_faturamento_total"] },
];

export const PERMISSION_LABELS: Record<PermissionKey, { titulo: string; descricao: string }> = {
  ver_dashboard: { titulo: "Ver dashboard", descricao: "Pode acessar o painel inicial com indicadores." },
  ver_pedidos: { titulo: "Ver pedidos", descricao: "Pode acessar a tela de pedidos." },
  ver_nfe: { titulo: "Ver NF-e", descricao: "Pode acessar a tela de notas fiscais." },
  ver_comissoes: { titulo: "Ver comissões", descricao: "Pode acessar a tela de comissões." },
  ver_relatorios: { titulo: "Ver relatórios", descricao: "Pode acessar a tela de relatórios." },
  ver_clientes: { titulo: "Ver clientes", descricao: "Pode visualizar a lista de clientes." },
  ver_representantes: { titulo: "Ver representantes", descricao: "Pode visualizar a lista de representantes." },
  ver_todos_pedidos: { titulo: "Ver todos os pedidos", descricao: "Quando desligado, vê apenas os próprios pedidos." },
  ver_todas_nfe: { titulo: "Ver todas as NF-es", descricao: "Quando desligado, vê apenas NF-es vinculadas a si." },
  ver_todas_comissoes: { titulo: "Ver todas as comissões", descricao: "Quando desligado, vê apenas as próprias comissões." },
  criar_pedidos: { titulo: "Criar pedidos", descricao: "Pode cadastrar novos pedidos no sistema." },
  editar_pedidos: { titulo: "Editar pedidos", descricao: "Pode alterar dados de pedidos existentes." },
  cancelar_pedidos: { titulo: "Cancelar pedidos", descricao: "Pode cancelar pedidos já registrados." },
  excluir_pedidos: { titulo: "Excluir pedidos", descricao: "Pode excluir pedidos do sistema." },
  registrar_nfe: { titulo: "Registrar NF-e", descricao: "Pode emitir/registrar notas fiscais eletrônicas." },
  registrar_entrega: { titulo: "Registrar entrega", descricao: "Pode marcar a data de entrega de uma NF-e." },
  excluir_nfe: { titulo: "Excluir NF-e", descricao: "Pode excluir notas fiscais eletrônicas." },
  marcar_comissao_paga: { titulo: "Marcar comissão como paga", descricao: "Pode dar baixa em comissões com comprovante." },
  recalcular_comissoes: { titulo: "Recalcular comissões", descricao: "Pode acionar o recálculo de comissões." },
  cadastrar_clientes: { titulo: "Cadastrar clientes", descricao: "Pode criar novos clientes." },
  cadastrar_representantes: { titulo: "Cadastrar representantes", descricao: "Pode criar novos representantes." },
  criar_usuarios: { titulo: "Criar usuários", descricao: "Pode convidar/cadastrar novos usuários do sistema." },
  editar_percentual_cliente: { titulo: "Editar % por cliente", descricao: "Pode alterar percentuais específicos por cliente." },
  gerar_contrato_pdf: { titulo: "Gerar contrato PDF", descricao: "Pode gerar o contrato de representação." },
  enviar_contrato_assinatura: { titulo: "Enviar contrato para assinatura", descricao: "Pode enviar o contrato de representação para assinatura via D4Sign." },
  visualizar_contratos_assinatura: { titulo: "Visualizar contratos enviados", descricao: "Pode ver o status e o histórico de contratos enviados para assinatura." },
  importar_planilhas: { titulo: "Importar planilhas", descricao: "Pode acessar a aba de importação de dados." },
  exportar_relatorios: { titulo: "Exportar relatórios", descricao: "Pode baixar relatórios em PDF/CSV." },
  enviar_extrato_email: { titulo: "Enviar extrato por e-mail", descricao: "Pode enviar o extrato de comissões do representante por e-mail." },
  ver_comissao_gestor: { titulo: "Ver comissão do gestor", descricao: "Exibe a linha de comissão do gestor no relatório geral e nas exportações." },
  ver_faturamento_total: { titulo: "Ver faturamento total", descricao: "Exibe o faturamento do mês no relatório geral e nas exportações." },
  editar_percentual_pedido: { titulo: "Editar % de comissão no pedido", descricao: "Permite sobrescrever o percentual do representante e do vendedor interno em cada pedido." },
};

export const ROLE_DEFAULTS: Record<AppRole, ReadonlySet<PermissionKey>> = {
  admin: new Set(PERMISSION_KEYS),
  gestor: new Set(PERMISSION_KEYS),
  vendedor_interno: new Set([
    "ver_dashboard",
    "ver_pedidos", "ver_todos_pedidos",
    "criar_pedidos", "editar_pedidos",
    "ver_nfe", "ver_todas_nfe", "registrar_nfe", "registrar_entrega",
    "ver_comissoes", "ver_todas_comissoes",
    "ver_relatorios", "exportar_relatorios",
    "ver_clientes", "cadastrar_clientes",
    "ver_representantes",
    "ver_faturamento_total",
  ]),
  financeiro: new Set([
    "ver_dashboard",
    "ver_pedidos", "ver_todos_pedidos",
    "ver_nfe", "ver_todas_nfe",
    "ver_comissoes", "ver_todas_comissoes", "marcar_comissao_paga",
    "ver_relatorios", "exportar_relatorios",
    "ver_clientes",
    "ver_representantes",
    "ver_comissao_gestor", "ver_faturamento_total",
  ]),
  representante: new Set([
    "ver_pedidos",
    "criar_pedidos",
    "ver_nfe",
    "ver_comissoes",
    "exportar_relatorios",
  ]),
};

export function roleDefault(roles: AppRole[], perm: PermissionKey): boolean {
  return roles.some((r) => ROLE_DEFAULTS[r]?.has(perm));
}

export interface PermissionsState {
  loading: boolean;
  overrides: Record<string, boolean>;
  can: (perm: PermissionKey | string) => boolean;
}

export function usePermissions(userId?: string | null): PermissionsState {
  const auth = useAuth();
  const uid = userId ?? auth.user?.id ?? null;

  const { data: overrides = {}, isLoading } = useQuery({
    queryKey: ["user-permissions", uid],
    enabled: !!uid,
    queryFn: async () => {
      const { data } = await supabase
        .from("user_permissions" as any)
        .select("permissao, concedida")
        .eq("user_id", uid as string);
      const map: Record<string, boolean> = {};
      for (const row of (data ?? []) as unknown as Array<{ permissao: string; concedida: boolean }>) {
        map[row.permissao] = row.concedida;
      }
      return map;
    },
  });

  const can = (perm: PermissionKey | string) => {
    if (perm in overrides) return overrides[perm];
    return roleDefault(auth.roles, perm as PermissionKey);
  };

  return { loading: !!uid && isLoading, overrides, can };
}
