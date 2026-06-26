import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import type { Session } from "@supabase/supabase-js";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { PasswordStrengthMeter, isPasswordOk } from "@/components/password-strength-meter";
import { toast } from "sonner";

export const Route = createFileRoute("/trocar-senha")({
  ssr: false,
  component: TrocarSenhaPage,
});

function TrocarSenhaPage() {
  const navigate = useNavigate();
  const [senha, setSenha] = useState("");
  const [confirma, setConfirma] = useState("");
  const [busy, setBusy] = useState(false);
  const [authReady, setAuthReady] = useState(false);
  const [session, setSession] = useState<Session | null>(null);

  useEffect(() => {
    let settled = false;
    const finish = (s: Session | null) => {
      setSession(s);
      setAuthReady(true);
      settled = true;
    };

    const { data: sub } = supabase.auth.onAuthStateChange((event, s) => {
      // PASSWORD_RECOVERY / SIGNED_IN podem chegar após o getSession inicial,
      // quando o supabase-js termina de processar o hash (#access_token=...)
      // ou o ?code= do link de recuperação enviado por e-mail.
      if (s) finish(s);
      else if (event === "SIGNED_OUT") finish(null);
    });

    // Se a URL traz tokens de recuperação, dá tempo do supabase-js processar
    // antes de decidir que não há sessão.
    const hasRecoveryHash =
      typeof window !== "undefined" &&
      (window.location.hash.includes("access_token") ||
        window.location.hash.includes("type=recovery") ||
        window.location.search.includes("code="));

    supabase.auth
      .getSession()
      .then(({ data }) => {
        if (settled) return;
        if (data.session) {
          finish(data.session);
        } else if (!hasRecoveryHash) {
          finish(null);
        } else {
          // aguarda onAuthStateChange; fallback de 5s
          setTimeout(() => {
            if (!settled) finish(null);
          }, 5000);
        }
      })
      .catch(() => {
        if (!settled) finish(null);
      });

    return () => sub.subscription.unsubscribe();
  }, []);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!isPasswordOk(senha)) {
      toast.error("A senha não atende aos requisitos mínimos de segurança.");
      return;
    }
    if (senha !== confirma) {
      toast.error("A confirmação não confere.");
      return;
    }
    setBusy(true);
    try {
      const { error } = await supabase.auth.updateUser({ password: senha });
      if (error) throw error;

      try {
        const { data: u } = await supabase.auth.getUser();
        if (u?.user) {
          await supabase
            .from("profiles")
            .update({ must_change_password: false })
            .eq("id", u.user.id);
        }
      } catch {
        // não bloqueia se o profile update falhar
      }

      toast.success("Senha atualizada!");
      window.location.replace("/");
    } catch (err: any) {
      toast.error(err?.message ?? "Erro ao atualizar a senha.");
    } finally {
      setBusy(false);
    }
  };

  const sair = async () => {
    try {
      await supabase.auth.signOut();
    } catch {
      /* ignore */
    }
    navigate({ to: "/login", replace: true });
  };

  if (!authReady) {
    return (
      <div className="min-h-screen flex items-center justify-center text-muted-foreground">
        Carregando…
      </div>
    );
  }

  if (!session) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-muted/30 p-4">
        <Card className="w-full max-w-md">
          <CardHeader>
            <CardTitle>Sessão expirada</CardTitle>
            <CardDescription>
              Para definir uma nova senha, faça login novamente ou utilize o link de
              recuperação enviado para seu e-mail.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Button onClick={() => navigate({ to: "/login", replace: true })} className="w-full">
              Ir para o login
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-muted/30 p-4">
      <Card className="w-full max-w-md">
        <CardHeader>
          <CardTitle>Defina uma nova senha</CardTitle>
          <CardDescription>
            Por segurança, é necessário trocar a senha provisória antes de continuar.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={submit} className="space-y-3 mt-2">
            <div>
              <Label>Nova senha</Label>
              <Input
                type="password"
                value={senha}
                onChange={(e) => setSenha(e.target.value)}
                required
                minLength={10}
                autoComplete="new-password"
              />
              <PasswordStrengthMeter value={senha} />
            </div>
            <div>
              <Label>Confirmar nova senha</Label>
              <Input
                type="password"
                value={confirma}
                onChange={(e) => setConfirma(e.target.value)}
                required
                autoComplete="new-password"
              />
            </div>
            <Button type="submit" disabled={busy} className="w-full">
              {busy ? "Salvando…" : "Salvar nova senha"}
            </Button>
            <Button type="button" variant="ghost" onClick={sair} className="w-full">
              Sair
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
