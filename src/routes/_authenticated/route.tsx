import { createFileRoute, useNavigate, useLocation, Outlet } from "@tanstack/react-router";
import { useEffect } from "react";
import { useAuth } from "@/hooks/use-auth";
import { AppLayout } from "@/components/AppLayout";

export const Route = createFileRoute("/_authenticated")({
  ssr: false,
  component: AuthGate,
});

function AuthGate() {
  const { loading, session, mustChangePassword } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const onTrocarSenha = location.pathname === "/trocar-senha";
  useEffect(() => {
    if (loading) return;
    if (!session) {
      navigate({ to: "/login", replace: true });
      return;
    }
    if (mustChangePassword && !onTrocarSenha) {
      navigate({ to: "/trocar-senha", replace: true });
    }
  }, [loading, session, mustChangePassword, onTrocarSenha, navigate]);
  if (loading || !session) {
    return <div className="min-h-screen flex items-center justify-center text-muted-foreground">Carregando…</div>;
  }
  // Em /trocar-senha (ou quando a troca é obrigatória) renderizamos só a página,
  // sem montar o AppLayout — evita queries pesadas/loop de redirect que travavam a aba.
  if (onTrocarSenha || mustChangePassword) {
    return <Outlet />;
  }
  return <AppLayout />;
}
