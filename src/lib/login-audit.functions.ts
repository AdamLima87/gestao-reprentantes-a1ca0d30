import { createServerFn } from "@tanstack/react-start";
import { getRequestHeader, getRequestIP } from "@tanstack/react-start/server";

export const verificarRateLimitLogin = createServerFn({ method: "POST" })
  .inputValidator((input: { email: string }) => {
    if (typeof input?.email !== "string") throw new Error("E-mail inválido.");
    return { email: input.email.trim().toLowerCase().slice(0, 255) };
  })
  .handler(async ({ data }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: res, error } = await supabaseAdmin.rpc(
      "verificar_rate_limit_login" as any,
      { p_email: data.email },
    );
    if (error) return { bloqueado: false as boolean };
    return (res ?? { bloqueado: false }) as {
      bloqueado: boolean;
      falhas?: number;
      liberar_em?: string;
      restantes?: number;
    };
  });


export const registrarTentativaLogin = createServerFn({ method: "POST" })
  .inputValidator((input: { email: string; sucesso: boolean }) => {
    if (typeof input?.email !== "string" || typeof input?.sucesso !== "boolean") {
      throw new Error("Parâmetros inválidos.");
    }
    return {
      email: input.email.trim().toLowerCase().slice(0, 255),
      sucesso: input.sucesso,
    };
  })
  .handler(async ({ data }) => {
    let ip: string | null = null;
    let userAgent: string | null = null;
    try {
      ip = getRequestIP({ xForwardedFor: true }) ?? null;
      userAgent = getRequestHeader("user-agent") ?? null;
    } catch {
      // request context indisponível — ignora
    }
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    await supabaseAdmin.from("login_attempts").insert({
      email: data.email,
      sucesso: data.sucesso,
      ip,
      user_agent: userAgent ? userAgent.slice(0, 500) : null,
    });
    return { ok: true };
  });
