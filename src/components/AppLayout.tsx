import { Link, Outlet, useNavigate, useRouterState } from "@tanstack/react-router";
import { useAuth, type AppRole } from "@/hooks/use-auth";
import { usePermissions } from "@/hooks/use-permissions";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { LayoutDashboard, FileText, Receipt, DollarSign, Settings, LogOut, BarChart3 } from "lucide-react";
import { cn } from "@/lib/utils";
import { motion, AnimatePresence } from "framer-motion";
import { ThemeSwitcher } from "@/components/ThemeSwitcher";

interface NavItem {
  to: string;
  label: string;
  icon: React.ComponentType<{ className?: string; style?: React.CSSProperties }>;
  allow: AppRole[];
  colorVar: string;
}

const NAV: NavItem[] = [
  { to: "/dashboard", label: "Dashboard", icon: LayoutDashboard, allow: ["admin", "vendedor_interno", "financeiro"], colorVar: "var(--color-comissoes)" },
  { to: "/pedidos", label: "Pedidos", icon: FileText, allow: ["admin", "vendedor_interno", "representante", "financeiro"], colorVar: "var(--color-pedidos)" },
  { to: "/nfe", label: "NF-e", icon: Receipt, allow: ["admin", "vendedor_interno", "financeiro"], colorVar: "var(--color-nfe)" },
  { to: "/comissoes", label: "Comissões", icon: DollarSign, allow: ["admin", "vendedor_interno", "representante", "financeiro"], colorVar: "var(--color-comissoes)" },
  { to: "/relatorios", label: "Relatórios", icon: BarChart3, allow: ["admin", "vendedor_interno", "financeiro"], colorVar: "var(--color-relatorios)" },
  { to: "/cadastros", label: "Cadastros", icon: Settings, allow: ["admin"], colorVar: "var(--color-cadastros)" },
];

export function AppLayout() {
  const { roles, nome, user } = useAuth();
  const { can } = usePermissions();
  const navigate = useNavigate();
  const pathname = useRouterState({ select: (s) => s.location.pathname });

  const signOut = async () => {
    await supabase.auth.signOut();
    navigate({ to: "/login", replace: true });
  };

  const isAdmin = roles.includes("admin");
  const podeVerCadastros =
    isAdmin ||
    can("cadastrar_clientes") ||
    can("cadastrar_representantes") ||
    can("importar_planilhas") ||
    can("criar_usuarios");

  const podeVerRota = (n: NavItem) => {
    if (isAdmin) return true;
    switch (n.to) {
      case "/dashboard":
        return can("ver_dashboard") || roles.some((r) => ["vendedor_interno", "financeiro"].includes(r));
      case "/pedidos":
        return (
          can("criar_pedidos") ||
          can("editar_pedidos") ||
          can("cancelar_pedidos") ||
          can("ver_todos_pedidos") ||
          roles.some((r) => ["vendedor_interno", "representante", "financeiro"].includes(r))
        );
      case "/nfe":
        return can("ver_nfe") || can("registrar_nfe") || roles.some((r) => ["vendedor_interno", "financeiro"].includes(r));
      case "/comissoes":
        return (
          can("ver_comissoes") ||
          can("marcar_comissao_paga") ||
          can("exportar_relatorios") ||
          roles.some((r) => ["vendedor_interno", "representante", "financeiro"].includes(r))
        );
      case "/relatorios":
        return can("ver_relatorios") || can("exportar_relatorios") || roles.some((r) => ["vendedor_interno", "financeiro"].includes(r));
      case "/cadastros":
        return podeVerCadastros;
      default:
        return roles.some((r) => n.allow?.includes(r));
    }
  };
  const visible = NAV.filter(podeVerRota);
  const roleLabel = roles[0] ?? "—";

  const initials = (nome || user?.email || "?")
    .split(/\s+/)
    .map((s) => s[0])
    .filter(Boolean)
    .slice(0, 2)
    .join("")
    .toUpperCase();

  return (
    <div className="flex min-h-screen bg-muted/20">
      <aside className="w-64 flex flex-col bg-sidebar text-sidebar-foreground border-r border-sidebar-border [&_*::-webkit-scrollbar]:w-1.5 [&_*::-webkit-scrollbar-track]:bg-transparent [&_*::-webkit-scrollbar-thumb]:bg-green-800 [&_*::-webkit-scrollbar-thumb]:rounded-full">
        <div className="px-5 py-4 border-b border-green-800">
          <h1 className="font-bold text-2xl leading-tight text-green-100 tracking-tight">Brazil</h1>
          <p className="text-sm text-green-300 -mt-0.5">Amortecedores</p>
          <p className="text-[10px] text-green-400 mt-2 capitalize tracking-wide">{roleLabel.replace("_", " ")}</p>
        </div>
        <nav className="flex-1 p-3 space-y-1 overflow-y-auto">
          {visible.map((n) => {
            const Icon = n.icon;
            const active = pathname === n.to || pathname.startsWith(n.to + "/");
            return (
              <Link
                key={n.to}
                to={n.to}
                className={cn(
                  "relative group flex items-center gap-3 px-3 py-2 rounded-md text-sm transition-all duration-200 border-l-2 hover:translate-x-1",
                  active
                    ? "text-white border-primary"
                    : "text-green-200 border-transparent hover:bg-sidebar-primary/30 hover:text-white"
                )}
              >
                {active && (
                  <motion.div
                    layoutId="activeNav"
                    className="absolute inset-0 rounded-md bg-sidebar-primary -z-0"
                    transition={{ type: "spring", stiffness: 380, damping: 32 }}
                  />
                )}
                <Icon
                  className="relative z-10 h-4 w-4 transition-colors"
                  style={{ color: n.colorVar }}
                />
                <span className="relative z-10">{n.label}</span>
              </Link>
            );
          })}
        </nav>
        <div className="p-4 bg-green-950 border-t border-green-800 space-y-3">
          <ThemeSwitcher />
          <div className="flex items-center gap-3">
            <div className="h-9 w-9 rounded-full bg-green-700 text-white flex items-center justify-center text-xs font-semibold shrink-0">
              {initials}
            </div>
            <div className="min-w-0 text-xs">
              <div className="font-medium text-white truncate">{nome || user?.email}</div>
              <div className="text-green-300 truncate capitalize">{roleLabel.replace("_", " ")}</div>
            </div>
          </div>
          <Button
            variant="ghost"
            size="sm"
            className="w-full justify-start text-green-200 hover:bg-sidebar-primary/30 hover:text-white transition-all duration-200"
            onClick={signOut}
          >
            <LogOut className="h-4 w-4 mr-2" /> Sair
          </Button>
        </div>
      </aside>
      <main className="flex-1 overflow-auto">
        <div className="p-6 max-w-7xl mx-auto">
          <AnimatePresence mode="wait">
            <motion.div
              key={pathname}
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -8 }}
              transition={{ duration: 0.2, ease: "easeOut" }}
            >
              <Outlet />
            </motion.div>
          </AnimatePresence>
        </div>
      </main>
    </div>
  );
}
