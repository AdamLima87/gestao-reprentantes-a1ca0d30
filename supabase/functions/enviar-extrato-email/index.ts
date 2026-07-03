// @ts-nocheck
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const MESES = [
  "Janeiro", "Fevereiro", "Março", "Abril", "Maio", "Junho",
  "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro",
];

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const authHeader = req.headers.get("Authorization") ?? "";
    if (!authHeader) {
      return new Response(JSON.stringify({ error: "Não autenticado" }), {
        status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
    const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const ANON = Deno.env.get("SUPABASE_ANON_KEY")!;
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY");

    if (!LOVABLE_API_KEY || !RESEND_API_KEY) {
      return new Response(JSON.stringify({ error: "Configuração de e-mail ausente" }), {
        status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const userClient = createClient(SUPABASE_URL, ANON, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: userData, error: userErr } = await userClient.auth.getUser();
    if (userErr || !userData?.user) {
      return new Response(JSON.stringify({ error: "Sessão inválida" }), {
        status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    const userId = userData.user.id;

    const body = await req.json();
    const { representante_id, gestor_user_id, pdf_base64, mes, ano } = body ?? {};
    if ((!representante_id && !gestor_user_id) || !pdf_base64 || !mes || !ano) {
      return new Response(JSON.stringify({ error: "Parâmetros inválidos" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const admin = createClient(SUPABASE_URL, SERVICE_KEY);

    const [{ data: isAdmin }, { data: isGestor }] = await Promise.all([
      admin.rpc("has_role", { _user_id: userId, _role: "admin" }),
      admin.rpc("has_role", { _user_id: userId, _role: "gestor" }),
    ]);
    if (!isAdmin && !isGestor) {
      return new Response(JSON.stringify({ error: "Sem permissão" }), {
        status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    let destNome = "";
    let destEmail = "";

    if (representante_id) {
      const { data: rep, error: repErr } = await admin
        .from("representantes")
        .select("id, nome, email")
        .eq("id", representante_id)
        .maybeSingle();
      if (repErr || !rep) {
        return new Response(JSON.stringify({ error: "Representante não encontrado" }), {
          status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      if (!rep.email) {
        return new Response(JSON.stringify({ error: "Representante não possui e-mail cadastrado" }), {
          status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      destNome = rep.nome;
      destEmail = rep.email;
    } else {
      const { data: prof } = await admin
        .from("profiles")
        .select("id, nome")
        .eq("id", gestor_user_id)
        .maybeSingle();
      const { data: authUser, error: authErr } = await admin.auth.admin.getUserById(gestor_user_id);
      if (authErr || !authUser?.user?.email) {
        return new Response(JSON.stringify({ error: "Gestor sem e-mail cadastrado" }), {
          status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      destNome = prof?.nome ?? authUser.user.email;
      destEmail = authUser.user.email;
    }

    const slug = destNome.normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^a-zA-Z0-9]+/g, "_");
    const nomeArquivo = `Extrato_${slug}_${String(mes).padStart(2, "0")}_${ano}.pdf`;
    const mesNome = MESES[Number(mes) - 1] ?? String(mes);
    const periodo = `${mesNome}/${ano}`;

    const EMAIL_FROM = Deno.env.get("EMAIL_FROM") || "Brazil Amortecedores <onboarding@resend.dev>";

    const resp = await fetch("https://connector-gateway.lovable.dev/resend/emails", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "X-Connection-Api-Key": RESEND_API_KEY,
      },
      body: JSON.stringify({
        from: EMAIL_FROM,
        to: [destEmail],
        subject: `Extrato de Comissões — ${periodo} — Brazil Amortecedores`,
        text:
`Olá ${destNome},

Segue em anexo o seu extrato de comissões referente a ${periodo}.

Em caso de dúvidas, responda este e-mail.

Brazil Amortecedores`,
        attachments: [
          { filename: nomeArquivo, content: pdf_base64 },
        ],
      }),
    });

    if (!resp.ok) {
      const errTxt = await resp.text();
      console.error("Resend gateway error:", resp.status, errTxt);

      const isDomainNotVerified =
        resp.status === 403 &&
        /verify a domain|testing emails to your own/i.test(errTxt);

      const friendly = isDomainNotVerified
        ? "Para enviar e-mails para outros destinatários é preciso verificar um domínio no Resend (resend.com/domains) e definir o remetente na variável EMAIL_FROM. Sem isso, o Resend só entrega no e-mail da conta usada na conexão."
        : "Falha ao enviar e-mail pelo Resend. Verifique a conexão do Resend nos conectores.";

      return new Response(
        JSON.stringify({
          ok: false,
          error: friendly,
          code: isDomainNotVerified ? "RESEND_DOMAIN_NOT_VERIFIED" : "RESEND_SEND_FAILED",
          detail: errTxt,
          status: resp.status,
        }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    await admin.from("extratos_enviados").insert({
      representante_id: representante_id ?? null,
      gestor_user_id: gestor_user_id ?? null,
      mes: Number(mes),
      ano: Number(ano),
      enviado_por: userId,
      email_destino: destEmail,
    });

    return new Response(JSON.stringify({ ok: true, email: destEmail }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error(e);
    return new Response(JSON.stringify({ error: e?.message ?? "Erro inesperado" }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
