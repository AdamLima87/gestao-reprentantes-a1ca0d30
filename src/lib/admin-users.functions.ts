import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

type AppRole = "admin" | "vendedor_interno" | "representante" | "financeiro" | "gestor";

async function assertAdmin(context: { supabase: any; userId: string }) {
  const { data: isAdmin } = await context.supabase.rpc("has_role", {
    _user_id: context.userId,
    _role: "admin",
  });
  if (!isAdmin) throw new Error("Apenas administradores podem executar esta ação.");
}

function validarSenhaProvisoria(senha: string) {
  // A senha provisória pode ser livre, mas precisa ter ao menos 6 caracteres
  // para evitar erros do Supabase Auth. O usuário será obrigado a trocá-la
  // no primeiro acesso, atendendo aos requisitos fortes de segurança.
  if (!senha || senha.length < 6) {
    throw new Error("Senha provisória deve ter ao menos 6 caracteres.");
  }
}

export const createUser = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(
    (input: {
      nome: string;
      email: string;
      senha: string;
      role: AppRole;
      representante_id?: string | null;
      percentual_comissao?: number | null;
      banco?: string | null;
      agencia?: string | null;
      conta?: string | null;
      pix?: string | null;
    }) => {
      if (!input.email || !input.senha || !input.nome || !input.role) {
        throw new Error("Campos obrigatórios faltando.");
      }
      const emailNorm = String(input.email).trim().toLowerCase();
      if (!/^[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}$/i.test(emailNorm)) {
        throw new Error("E-mail inválido.");
      }
      const nomeNorm = String(input.nome).replace(/\s+/g, " ").trim();
      if (!nomeNorm) throw new Error("Nome inválido.");
      validarSenhaProvisoria(input.senha);
      return { ...input, email: emailNorm, nome: nomeNorm };
    },
  )
  .handler(async ({ data, context }) => {
    await assertAdmin(context);

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
        must_change_password: true,
        percentual_comissao: data.percentual_comissao ?? 0,
        banco: data.banco ?? null,
        agencia: data.agencia ?? null,
        conta: data.conta ?? null,
        pix: data.pix ?? null,
      } as any)
      .eq("id", userId);
    if (profErr) throw new Error(profErr.message);

    return { ok: true, userId };
  });


export const listUsers = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await assertAdmin(context);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const { data: profiles, error: pErr } = await supabaseAdmin
      .from("profiles")
      .select("id, nome, representante_id, criado_em, percentual_comissao, banco, agencia, conta, pix, representantes(nome)")
      .order("criado_em", { ascending: false });

    if (pErr) throw new Error(pErr.message);

    const { data: roles, error: rErr } = await supabaseAdmin
      .from("user_roles")
      .select("user_id, role");
    if (rErr) throw new Error(rErr.message);

    // Fetch emails via auth admin (paginated)
    const emails = new Map<string, string>();
    let page = 1;
    while (true) {
      const { data: list, error } = await supabaseAdmin.auth.admin.listUsers({ page, perPage: 200 });
      if (error) throw new Error(error.message);
      for (const u of list.users) emails.set(u.id, u.email ?? "");
      if (list.users.length < 200) break;
      page += 1;
      if (page > 50) break;
    }

    return (profiles ?? []).map((p: any) => ({
      id: p.id,
      nome: p.nome,
      email: emails.get(p.id) ?? "",
      representante_id: p.representante_id,
      representante_nome: p.representantes?.nome ?? null,
      criado_em: p.criado_em,
      percentual_comissao: p.percentual_comissao ?? 0,
      banco: p.banco ?? null,
      agencia: p.agencia ?? null,
      conta: p.conta ?? null,
      pix: p.pix ?? null,
      roles: (roles ?? []).filter((r: any) => r.user_id === p.id).map((r: any) => r.role),
    }));
  });


export const updateUser = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(
    (input: {
      userId: string;
      nome?: string;
      email?: string;
      senha?: string | null;
      role?: AppRole;
      representante_id?: string | null;
      percentual_comissao?: number | null;
      banco?: string | null;
      agencia?: string | null;
      conta?: string | null;
      pix?: string | null;
    }) => {
      if (!input.userId) throw new Error("userId obrigatório.");
      if (input.senha) validarSenhaProvisoria(input.senha);
      const out: any = { ...input };
      if (input.email !== undefined) {
        const emailNorm = String(input.email).trim().toLowerCase();
        if (!/^[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}$/i.test(emailNorm)) {
          throw new Error("E-mail inválido.");
        }
        out.email = emailNorm;
      }
      if (input.nome !== undefined) {
        const nomeNorm = String(input.nome).replace(/\s+/g, " ").trim();
        if (!nomeNorm) throw new Error("Nome inválido.");
        out.nome = nomeNorm;
      }
      return out;
    },
  )
  .handler(async ({ data, context }) => {
    await assertAdmin(context);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const authPatch: { email?: string; password?: string; user_metadata?: any } = {};
    if (data.email) authPatch.email = data.email;
    if (data.senha) authPatch.password = data.senha;
    if (data.nome) authPatch.user_metadata = { nome: data.nome };
    if (Object.keys(authPatch).length > 0) {
      const { error } = await supabaseAdmin.auth.admin.updateUserById(data.userId, authPatch);
      if (error) throw new Error(error.message);
    }

    const profPatch: Record<string, unknown> = {};
    if (data.nome !== undefined) profPatch.nome = data.nome;
    if (data.representante_id !== undefined)
      profPatch.representante_id = data.representante_id || null;
    if (data.percentual_comissao !== undefined && data.percentual_comissao !== null)
      profPatch.percentual_comissao = data.percentual_comissao;
    if (data.banco !== undefined) profPatch.banco = data.banco;
    if (data.agencia !== undefined) profPatch.agencia = data.agencia;
    if (data.conta !== undefined) profPatch.conta = data.conta;
    if (data.pix !== undefined) profPatch.pix = data.pix;
    if (data.senha) profPatch.must_change_password = true;
    if (Object.keys(profPatch).length > 0) {
      const { error: profErr } = await supabaseAdmin.from("profiles").update(profPatch as any).eq("id", data.userId);
      if (profErr) {
        console.error("[updateUser] profiles error:", profErr);
        throw new Error("Erro ao atualizar perfil: " + profErr.message);
      }
    }


    if (data.role) {
      await supabaseAdmin.from("user_roles").delete().eq("user_id", data.userId);
      const { error } = await supabaseAdmin
        .from("user_roles")
        .insert({ user_id: data.userId, role: data.role });
      if (error) throw new Error(error.message);
    }

    return { ok: true };
  });

export const deleteUser = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { userId: string }) => {
    if (!input.userId) throw new Error("userId obrigatório.");
    return input;
  })
  .handler(async ({ data, context }) => {
    await assertAdmin(context);
    if (data.userId === context.userId) {
      throw new Error("Você não pode excluir o próprio usuário.");
    }
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { error } = await supabaseAdmin.auth.admin.deleteUser(data.userId);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

function gerarSenhaTemporaria(): string {
  const upper = "ABCDEFGHJKLMNPQRSTUVWXYZ";
  const lower = "abcdefghijkmnpqrstuvwxyz";
  const digits = "23456789";
  const all = upper + lower + digits;
  const pick = (s: string) => s[Math.floor(Math.random() * s.length)];
  let pwd = pick(upper) + pick(lower) + pick(digits);
  for (let i = 3; i < 12; i++) pwd += pick(all);
  return pwd.split("").sort(() => Math.random() - 0.5).join("");
}

export const resetUserPassword = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { userId: string; redirectTo?: string }) => {
    if (!input.userId) throw new Error("userId obrigatório.");
    return input;
  })
  .handler(async ({ data, context }) => {
    await assertAdmin(context);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    // 1. Recupera o email do usuário-alvo
    const { data: userData, error: getErr } = await supabaseAdmin.auth.admin.getUserById(data.userId);
    if (getErr) throw new Error(getErr.message);
    const email = userData?.user?.email;
    if (!email) throw new Error("Usuário não possui email cadastrado.");

    // 2. Marca o perfil para forçar troca de senha após o login
    const { error: pErr } = await supabaseAdmin
      .from("profiles")
      .update({ must_change_password: true } as any)
      .eq("id", data.userId);
    if (pErr) throw new Error(pErr.message);

    // 3. Dispara o email de recuperação padrão do Lovable Cloud.
    // O usuário clica no link, define a nova senha e é redirecionado.
    const redirectTo = data.redirectTo || undefined;
    const { error: mailErr } = await supabaseAdmin.auth.resetPasswordForEmail(
      email,
      redirectTo ? { redirectTo } : undefined,
    );
    if (mailErr) throw new Error(mailErr.message);

    return { ok: true as const, email };
  });

export const listAllPermissions = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await assertAdmin(context);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data, error } = await supabaseAdmin
      .from("user_permissions")
      .select("user_id, permissao, concedida");
    if (error) throw new Error(error.message);
    return (data ?? []) as Array<{ user_id: string; permissao: string; concedida: boolean }>;
  });
