import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const D4SIGN_BASE = "https://sandbox.d4sign.com.br/api/v1";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  if (req.method !== "POST") return new Response("Method not allowed", { status: 405, headers: corsHeaders });

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) return json({ error: "Unauthorized" }, 401);

    const supabaseUser = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_ANON_KEY")!,
      { global: { headers: { Authorization: authHeader } } }
    );

    const { data: { user } } = await supabaseUser.auth.getUser();
    if (!user) return json({ error: "Unauthorized" }, 401);

    const { data: roles } = await supabaseUser
      .from("user_roles")
      .select("role")
      .eq("user_id", user.id);

    const rolesList = (roles ?? []).map((r: any) => r.role);
    if (!rolesList.includes("admin") && !rolesList.includes("gestor")) {
      return json({ error: "Forbidden" }, 403);
    }

    const { representante_id, pdf_base64, nome_rep, email_rep } = await req.json();
    if (!representante_id || !pdf_base64 || !nome_rep || !email_rep) {
      return json({ error: "Campos obrigatórios: representante_id, pdf_base64, nome_rep, email_rep" }, 400);
    }

    const TOKEN = Deno.env.get("D4SIGN_TOKEN");
    const SAFE_UUID = Deno.env.get("D4SIGN_SAFE_UUID");
    if (!TOKEN || !SAFE_UUID) return json({ error: "D4SIGN_TOKEN/SAFE_UUID não configurados" }, 500);

    const cryptKey = Deno.env.get("D4SIGN_CRYPT_KEY") ?? "";
    const qs = `?tokenAPI=${encodeURIComponent(TOKEN)}${cryptKey ? `&cryptKey=${encodeURIComponent(cryptKey)}` : ""}`;

    const safeName = String(nome_rep).replace(/\s+/g, "_");
    // 1. Upload via base64
    const uploadRes = await fetch(`${D4SIGN_BASE}/documents/${SAFE_UUID}/uploadbinary${qs}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        base64_binary_file: `data:application/pdf;base64,${pdf_base64}`,
        name: `Contrato_${safeName}.pdf`,
      }),
    });
    const uploadData = await uploadRes.json();
    const docUuid = uploadData?.uuid;
    if (!docUuid) return json({ error: "Falha no upload D4Sign", detail: uploadData }, 500);

    // 2. Signatário
    const listRes = await fetch(`${D4SIGN_BASE}/documents/${docUuid}/createlist${qs}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        signers: [{
          email: email_rep,
          act: "1",
          foreign: "0",
          certificadoicpbr: "0",
          assinatura_presencial: "0",
          embed_methodauth: "email",
          embed_smsnumber: "",
        }],
      }),
    });
    const listData = await listRes.json();

    // 3. Enviar para assinatura
    const sendRes = await fetch(`${D4SIGN_BASE}/documents/${docUuid}/sendtosigner${qs}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        message: "Por favor, assine o contrato de representação comercial da Brazil Amortecedores.",
        workflow: "0",
        skip_email: "0",
      }),
    });
    const sendData = await sendRes.json();

    // 4. Persistir
    const supabaseAdmin = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    const { error: insertErr } = await supabaseAdmin.from("contratos_assinatura").insert({
      representante_id,
      d4sign_document_uuid: docUuid,
      status: "enviado",
      enviado_por: user.id,
      enviado_at: new Date().toISOString(),
    });
    if (insertErr) return json({ error: "Falha ao registrar", detail: insertErr.message }, 500);

    return json({ success: true, doc_uuid: docUuid, list: listData, send: sendData });
  } catch (e: any) {
    return json({ error: e?.message ?? "Erro inesperado" }, 500);
  }
});

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}
