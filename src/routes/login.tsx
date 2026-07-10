import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { toast } from "sonner";
import { registrarTentativaLogin, verificarRateLimitLogin } from "@/lib/login-audit.functions";

export const Route = createFileRoute("/login")({
  head: () => ({ meta: [{ title: "Entrar — Gestão de Representantes" }] }),
  component: AuthPage,
});

const STORAGE_KEY = "login-attempts";
const MAX_ATTEMPTS = 5;
const WINDOW_MS = 2 * 60 * 1000;
const LOCK_MS = 2 * 60 * 1000;

type AttemptsState = { count: number; firstAt: number; lockedUntil: number };

function readState(): AttemptsState {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return { count: 0, firstAt: 0, lockedUntil: 0 };
    return JSON.parse(raw);
  } catch {
    return { count: 0, firstAt: 0, lockedUntil: 0 };
  }
}

function writeState(s: AttemptsState) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(s));
}

function AuthPage() {
  const navigate = useNavigate();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [remaining, setRemaining] = useState(0);

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      if (data.session) navigate({ to: "/" });
    });
  }, [navigate]);

  useEffect(() => {
    const tick = () => {
      const s = readState();
      const rem = Math.max(0, s.lockedUntil - Date.now());
      setRemaining(rem);
      if (rem === 0 && s.lockedUntil > 0) {
        writeState({ count: 0, firstAt: 0, lockedUntil: 0 });
      }
    };
    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, []);

  const formatRemaining = (ms: number) => {
    const total = Math.ceil(ms / 1000);
    const m = Math.floor(total / 60);
    const sec = total % 60;
    return `${m}:${String(sec).padStart(2, "0")}`;
  };

  const registerFailure = () => {
    const now = Date.now();
    const s = readState();
    const withinWindow = s.firstAt && now - s.firstAt < WINDOW_MS;
    const next: AttemptsState = withinWindow
      ? { ...s, count: s.count + 1 }
      : { count: 1, firstAt: now, lockedUntil: 0 };
    if (next.count >= MAX_ATTEMPTS) {
      next.lockedUntil = now + LOCK_MS;
    }
    writeState(next);
    setRemaining(Math.max(0, next.lockedUntil - now));
  };

  const signIn = async (e: React.FormEvent) => {
    e.preventDefault();
    if (remaining > 0) return;
    setBusy(true);
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    setBusy(false);
    registrarTentativaLogin({ data: { email, sucesso: !error } }).catch(() => {});
    if (error) {
      registerFailure();
      return toast.error(error.message);
    }
    writeState({ count: 0, firstAt: 0, lockedUntil: 0 });
    setRemaining(0);
    toast.success("Bem-vindo!");
    navigate({ to: "/" });
  };

  const locked = remaining > 0;

  return (
    <div className="min-h-screen flex items-center justify-center bg-muted/30 p-4">
      <Card className="w-full max-w-md">
        <CardHeader>
          <CardTitle>Gestão de Representantes</CardTitle>
          <CardDescription>Acesse sua conta para continuar</CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={signIn} className="space-y-3 mt-2">
            <div><Label>E-mail</Label><Input type="email" value={email} onChange={(e) => setEmail(e.target.value)} required disabled={locked} /></div>
            <div><Label>Senha</Label><Input type="password" value={password} onChange={(e) => setPassword(e.target.value)} required disabled={locked} /></div>
            <Button type="submit" disabled={busy || locked} className="w-full">
              {locked ? `Aguarde ${formatRemaining(remaining)} para tentar novamente` : "Entrar"}
            </Button>
            {locked && (
              <p className="text-xs text-muted-foreground text-center">
                Muitas tentativas falhadas. Login temporariamente bloqueado.
              </p>
            )}
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
