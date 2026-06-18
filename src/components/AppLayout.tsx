import { Link, Outlet, useNavigate, useRouterState } from "@tanstack/react-router";
import { useAuth, type AppRole } from "@/hooks/use-auth";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { LayoutDashboard, FileText, Receipt, DollarSign, Settings, LogOut, BarChart3 } from "lucide-react";
import { cn } from "@/lib/utils";

interface NavItem {
  to: string;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  allow: AppRole[];
}

const NAV: NavItem[] = [
  { to: "/dashboard", label: "Dashboard", icon: LayoutDashboard, allow: ["admin", "vendedor_interno", "financeiro"] },
  { to: "/pedidos", label: "Pedidos", icon: FileText, allow: ["admin", "vendedor_interno", "representante", "financeiro"] },
  { to: "/nfe", label: "NF-e", icon: Receipt, allow: ["admin", "vendedor_interno", "financeiro"] },
  { to: "/comissoes", label: "Comissões", icon: DollarSign, allow: ["admin", "vendedor_interno", "representante", "financeiro"] },
  { to: "/relatorios", label: "Relatórios", icon: BarChart3, allow: ["admin", "vendedor_interno", "financeiro"] },
  { to: "/cadastros", label: "Cadastros", icon: Settings, allow: ["admin"] },
];

export function AppLayout() {
  const { roles, nome, user } = useAuth();
  const navigate = useNavigate();
  const pathname = useRouterState({ select: (s) => s.location.pathname });

  const signOut = async () => {
    await supabase.auth.signOut();
    navigate({ to: "/login", replace: true });
  };

  const visible = NAV.filter((n) => roles.some((r) => n.allow.includes(r)));
  const roleLabel = roles[0] ?? "—";

  return (
    <div className="flex min-h-screen bg-muted/20">
      <aside className="w-64 border-r bg-card flex flex-col">
        <div className="p-5 border-b">
          <h1 className="font-bold text-lg">Gestão Repr.</h1>
          <p className="text-xs text-muted-foreground mt-1 capitalize">{roleLabel.replace("_", " ")}</p>
        </div>
        <nav className="flex-1 p-3 space-y-1">
          {visible.map((n) => {
            const Icon = n.icon;
            const active = pathname === n.to || pathname.startsWith(n.to + "/");
            return (
              <Link
                key={n.to}
                to={n.to}
                className={cn(
                  "flex items-center gap-3 px-3 py-2 rounded-md text-sm transition-colors",
                  active ? "bg-primary text-primary-foreground" : "hover:bg-muted text-foreground/80"
                )}
              >
                <Icon className="h-4 w-4" />
                {n.label}
              </Link>
            );
          })}
        </nav>
        <div className="p-3 border-t">
          <div className="text-xs mb-2 px-2">
            <div className="font-medium truncate">{nome || user?.email}</div>
            <div className="text-muted-foreground truncate">{user?.email}</div>
          </div>
          <Button variant="ghost" size="sm" className="w-full justify-start" onClick={signOut}>
            <LogOut className="h-4 w-4 mr-2" /> Sair
          </Button>
        </div>
      </aside>
      <main className="flex-1 overflow-auto">
        <div className="p-6 max-w-7xl mx-auto">
          <Outlet />
        </div>
      </main>
    </div>
  );
}
