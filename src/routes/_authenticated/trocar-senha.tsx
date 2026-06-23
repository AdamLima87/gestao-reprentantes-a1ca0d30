import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { PasswordStrengthMeter, isPasswordOk } from "@/components/password-strength-meter";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/trocar-senha")({
  component: TrocarSenhaPage,
});

function TrocarSenhaPage() {
  const navigate = useNavigate();
  const [senha, setSenha] = useState("");
  const [confirma, setConfirma] = useState("");
  const [busy, setBusy] = useState(false);

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

      const { data: u } = await supabase.auth.getUser();
      if (u.user) {
        const { error: pErr } = await supabase
          .from("profiles")
          .update({ must_change_password: false })
          .eq("id", u.user.id);
        if (pErr) throw pErr;
      }

      toast.success("Senha atualizada!");
      // Recarrega para que o useAuth releia o profile e libere a navegação.
      window.location.replace("/");
    } catch (err: any) {
      toast.error(err?.message ?? "Erro ao atualizar a senha.");
    } finally {
      setBusy(false);
    }
  };

  const sair = async () => {
    await supabase.auth.signOut();
    navigate({ to: "/login", replace: true });
  };

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
              <Input type="password" value={senha} onChange={(e) => setSenha(e.target.value)} required minLength={10} />
              <PasswordStrengthMeter value={senha} />
            </div>
            <div>
              <Label>Confirmar nova senha</Label>
              <Input type="password" value={confirma} onChange={(e) => setConfirma(e.target.value)} required />
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
