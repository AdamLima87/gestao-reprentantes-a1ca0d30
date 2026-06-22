import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

type AppRole = "admin" | "vendedor_interno" | "representante" | "financeiro";

export const createUser = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(
    (input: {
      nome: string;
      email: string;
      senha: string;
      role: AppRole;
      representante_id?: string | null;
    }) => {
      if (!input.email || !input.senha || !input.nome || !input.role) {
        throw new Error("Campos obrigatórios faltando.");
      }
      if (input.senha.length < 10) throw new Error("Senha deve ter ao menos 10 caracteres.");
      if (!/[A-Z]/.test(input.senha)) throw new Error("Senha deve conter ao menos uma letra maiúscula.");
      if (!/[a-z]/.test(input.senha)) throw new Error("Senha deve conter ao menos uma letra minúscula.");
      if (!/[0-9]/.test(input.senha)) throw new Error("Senha deve conter ao menos um número.");
      return input;
    },
  )
  .handler(async ({ data, context }) => {
    const { data: isAdmin } = await context.supabase.rpc("has_role", {
      _user_id: context.userId,
      _role: "admin",
    });
    if (!isAdmin) throw new Error("Apenas administradores podem criar usuários.");

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const { data: created, error: createErr } = await supabaseAdmin.auth.admin.createUser({
      email: data.email,
      password: data.senha,
      email_confirm: true,
      user_metadata: { nome: data.nome },
    });
    if (createErr || !created.user) {
      throw new Error(createErr?.message ?? "Falha ao criar usuário.");
    }

    const userId = created.user.id;

    // handle_new_user trigger creates profile + default role; overwrite with chosen ones.
    await supabaseAdmin.from("user_roles").delete().eq("user_id", userId);
    const { error: roleErr } = await supabaseAdmin
      .from("user_roles")
      .insert({ user_id: userId, role: data.role });
    if (roleErr) throw new Error(roleErr.message);

    const { error: profErr } = await supabaseAdmin
      .from("profiles")
      .update({
        nome: data.nome,
        representante_id: data.representante_id || null,
      })
      .eq("id", userId);
    if (profErr) throw new Error(profErr.message);

    return { ok: true, userId };
  });
