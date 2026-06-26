import { useState } from "react";
import { Link, Outlet, useNavigate, useRouterState } from "@tanstack/react-router";
import { useAuth, type AppRole } from "@/hooks/use-auth";
import { usePermissions } from "@/hooks/use-permissions";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { LayoutDashboard, FileText, Receipt, DollarSign, Settings, LogOut, BarChart3 } from "lucide-react";
import { cn } from "@/lib/utils";
import { motion, AnimatePresence } from "framer-motion";
import { ThemeSwitcher } from "@/components/ThemeSwitcher";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { useIsMobile } from "@/hooks/use-mobile";

interface NavItem {
  to: string;
  label: string;
  icon: React.ComponentType<{ className?: string; style?: React.CSSProperties }>;
  allow: AppRole[];
  colorVar: string;
}

const NAV: NavItem[] = [
  { to: "/dashboard", label: "Dashboard", icon: LayoutDashboard, allow: ["admin", "gestor", "vendedor_interno", "financeiro"], colorVar: "var(--color-comissoes)" },
  { to: "/pedidos", label: "Pedidos", icon: FileText, allow: ["admin", "gestor", "vendedor_interno", "representante", "financeiro"], colorVar: "var(--color-pedidos)" },
  { to: "/nfe", label: "NF-e", icon: Receipt, allow: ["admin", "gestor", "vendedor_interno", "financeiro"], colorVar: "var(--color-nfe)" },
  { to: "/comissoes", label: "Comissões", icon: DollarSign, allow: ["admin", "gestor", "vendedor_interno", "representante", "financeiro"], colorVar: "var(--color-comissoes)" },
  { to: "/relatorios", label: "Relatórios", icon: BarChart3, allow: ["admin", "gestor", "vendedor_interno", "financeiro"], colorVar: "var(--color-relatorios)" },
  { to: "/cadastros", label: "Cadastros", icon: Settings, allow: ["admin", "gestor"], colorVar: "var(--color-cadastros)" },
];

export function AppLayout() {
  const { roles, nome, user } = useAuth();
  const { can } = usePermissions();
  const navigate = useNavigate();
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const isMobile = useIsMobile();
  const [hovered, setHovered] = useState(false);
  const expanded = isMobile ? true : hovered;

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
    if (roles.some((r) => n.allow?.includes(r))) return true;
    switch (n.to) {
      case "/dashboard":
        return can("ver_dashboard");
      case "/pedidos":
        return can("ver_pedidos");
      case "/nfe":
        return can("ver_nfe");
      case "/comissoes":
        return can("ver_comissoes");
      case "/relatorios":
        return can("ver_relatorios");
      case "/cadastros":
        return podeVerCadastros;
      default:
        return false;
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

  const sidebarWidth = isMobile ? 240 : expanded ? 240 : 64;
  const spacerWidth = isMobile ? 0 : 64;

  return (
    <TooltipProvider delayDuration={300}>
      <div className="flex min-h-screen bg-muted/20">
        {!isMobile && expanded && (
          <div
            className="fixed inset-0 z-20 bg-black/30 backdrop-blur-[1px] transition-opacity duration-300"
            aria-hidden
          />
        )}
        <aside
          onMouseEnter={() => setHovered(true)}
          onMouseLeave={() => setHovered(false)}
          style={{ width: sidebarWidth }}
          className={cn(
            "flex flex-col bg-sidebar text-sidebar-foreground border-r border-sidebar-border shrink-0",
            "transition-all duration-300 ease-in-out overflow-hidden",
            "[&_*::-webkit-scrollbar]:w-1.5 [&_*::-webkit-scrollbar-track]:bg-transparent [&_*::-webkit-scrollbar-thumb]:bg-green-800 [&_*::-webkit-scrollbar-thumb]:rounded-full",
            !isMobile && "fixed inset-y-0 left-0 z-30 shadow-xl"
          )}
        >
          <div
            className={cn(
              "border-b border-green-800 h-[72px] flex items-center",
              expanded ? "px-5" : "px-0 justify-center"
            )}
          >
            {expanded ? (
              <div className="min-w-0">
                <h1 className="font-bold text-2xl leading-tight text-green-100 tracking-tight whitespace-nowrap">Brazil</h1>
                <p className="text-sm text-green-300 -mt-0.5 whitespace-nowrap">Amortecedores</p>
                <p className="text-[10px] text-green-400 mt-1 capitalize tracking-wide whitespace-nowrap">{roleLabel.replace("_", " ")}</p>
              </div>
            ) : (
              <div className="h-9 w-9 rounded-md bg-green-700 text-white flex items-center justify-center font-bold text-lg">
                B
              </div>
            )}
          </div>

          <nav className={cn("flex-1 py-3 space-y-1 overflow-y-auto overflow-x-hidden", expanded ? "px-3" : "px-2")}>
            {visible.map((n) => {
              const Icon = n.icon;
              const active = pathname === n.to || pathname.startsWith(n.to + "/");
              const link = (
                <Link
                  to={n.to}
                  className={cn(
                    "relative group flex items-center gap-3 rounded-md text-sm transition-all duration-200 border-l-2",
                    expanded ? "px-3 py-2 hover:translate-x-1" : "px-0 py-2 justify-center",
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
                  <Icon className="relative z-10 h-4 w-4 shrink-0 transition-colors" style={{ color: n.colorVar }} />
                  {expanded && <span className="relative z-10 whitespace-nowrap">{n.label}</span>}
                </Link>
              );
              return (
                <div key={n.to}>
                  {!expanded && !isMobile ? (
                    <Tooltip>
                      <TooltipTrigger asChild>{link}</TooltipTrigger>
                      <TooltipContent side="right">{n.label}</TooltipContent>
                    </Tooltip>
                  ) : (
                    link
                  )}
                </div>
              );
            })}
          </nav>

          <div className={cn("bg-green-950 border-t border-green-800 space-y-3", expanded ? "p-4" : "p-2")}>
            {expanded ? (
              <>
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
              </>
            ) : (
              <div className="flex flex-col items-center gap-2">
                <div className="h-9 w-9 rounded-full bg-green-700 text-white flex items-center justify-center text-xs font-semibold">
                  {initials}
                </div>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-9 w-9 text-green-200 hover:bg-sidebar-primary/30 hover:text-white"
                      onClick={signOut}
                    >
                      <LogOut className="h-4 w-4" />
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent side="right">Sair</TooltipContent>
                </Tooltip>
              </div>
            )}
          </div>
        </aside>

        {!isMobile && (
          <div
            style={{ width: spacerWidth }}
            className="shrink-0"
            aria-hidden
          />
        )}


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
    </TooltipProvider>
  );
}
