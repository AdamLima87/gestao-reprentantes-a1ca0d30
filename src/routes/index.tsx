import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect } from "react";
import { useAuth } from "@/hooks/use-auth";

export const Route = createFileRoute("/")({
  head: () => ({ meta: [{ title: "Gestão de Representantes" }] }),
  component: IndexRedirect,
});

function IndexRedirect() {
  const { loading, session } = useAuth();
  const navigate = useNavigate();
  useEffect(() => {
    if (loading) return;
    navigate({ to: session ? "/dashboard" : "/auth", replace: true });
  }, [loading, session, navigate]);
  return <div className="min-h-screen flex items-center justify-center text-muted-foreground">Carregando…</div>;
}
