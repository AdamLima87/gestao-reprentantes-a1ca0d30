import { createFileRoute, useNavigate } from "@tanstack/react-router";
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
  useEffect(() => {
    if (loading) return;
    if (!session) {
      navigate({ to: "/login", replace: true });
      return;
    }
    if (mustChangePassword) {
      navigate({ to: "/trocar-senha", replace: true });
    }
  }, [loading, session, mustChangePassword, navigate]);
  if (loading || !session || mustChangePassword) {
    return <div className="min-h-screen flex items-center justify-center text-muted-foreground">Carregando…</div>;
  }
  return <AppLayout />;
}
