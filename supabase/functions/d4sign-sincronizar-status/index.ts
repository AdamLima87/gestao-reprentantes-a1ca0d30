import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const D4SIGN_BASE_URL = "https://secure.d4sign.com.br/api/v1";

// Mapeia status D4Sign (statusId ou string) → status interno
function mapStatus(raw: string): string {
  const s = (raw ?? "").toString().toLowerCase();
  if (["4", "finalizado", "finished", "signed", "assinado"].includes(s)) return "assinado";
  if (["5", "cancelado", "canceled", "cancelled"].includes(s)) return "cancelado";
  if (["6", "refused", "recusado"].includes(s)) return "recusado";
  if (["2", "3", "processing", "aguardando", "enviado", "pendente"].includes(s)) return "enviado";
  return "enviado";
}

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  if (req.method !== "POST") return json({ error: "Method not allowed" }, 405);

  try {
    const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
    const ANON = Deno.env.get("SUPABASE_ANON_KEY")!;
    const SERVICE = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const TOKEN = Deno.env.get("D4SIGN_TOKEN");
    const CRYPT = Deno.env.get("D4SIGN_CRYPT_KEY") ?? "";
    if (!TOKEN) return json({ error: "D4SIGN_TOKEN não configurado" }, 500);

    // Auth: exige admin/gestor
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) return json({ error: "Unauthorized" }, 401);
    const userResp = await fetch(`${SUPABASE_URL}/auth/v1/user`, {
      headers: { apikey: ANON, Authorization: authHeader },
    });
    if (!userResp.ok) return json({ error: "Unauthorized" }, 401);
    const user = await userResp.json();

    const admin = createClient(SUPABASE_URL, SERVICE);
    const { data: roles } = await admin.from("user_roles").select("role").eq("user_id", user.id);
    const allowed = (roles ?? []).some((r) => r.role === "admin" || r.role === "gestor");
    if (!allowed) return json({ error: "Forbidden" }, 403);

    const body = await req.json().catch(() => ({}));
    const alvoUuid: string | undefined = body?.d4sign_document_uuid;

    // Busca contratos pendentes (ou o especificado)
    let q = admin
      .from("contratos_assinatura")
      .select("id, d4sign_document_uuid, status")
      .not("d4sign_document_uuid", "is", null);
    if (alvoUuid) q = q.eq("d4sign_document_uuid", alvoUuid);
    else q = q.in("status", ["enviado", "pendente", "visualizado"]);

    const { data: contratos, error: qErr } = await q;
    if (qErr) return json({ error: qErr.message }, 500);

    const qs = `?tokenAPI=${encodeURIComponent(TOKEN)}&cryptKey=${encodeURIComponent(CRYPT)}`;
    const results: Array<Record<string, unknown>> = [];

    for (const c of contratos ?? []) {
      const uuid = c.d4sign_document_uuid as string;
      try {
        const resp = await fetch(`${D4SIGN_BASE_URL}/documents/${uuid}${qs}`, {
          method: "GET",
          headers: { "Content-Type": "application/json" },
        });
        const raw = await resp.text();
        let info: any = {};
        try { info = JSON.parse(raw); } catch { /* ignore */ }
        // API pode retornar array ou objeto
        const doc = Array.isArray(info) ? info[0] : info;
        const statusRaw = doc?.statusId ?? doc?.status_id ?? doc?.status ?? doc?.statusName ?? "";
        const novoStatus = mapStatus(String(statusRaw));

        const update: Record<string, unknown> = {
          status: novoStatus,
          updated_at: new Date().toISOString(),
        };

        if (novoStatus === "assinado") {
          update.assinado_at = new Date().toISOString();
          // Baixar PDF assinado
          try {
            const dl = await fetch(`${D4SIGN_BASE_URL}/documents/${uuid}/download${qs}`, {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ type: "PDF" }),
            });
            const dlJson = await dl.json().catch(() => ({}));
            const fileUrl: string | undefined = dlJson?.url;
            if (fileUrl) {
              const pdfResp = await fetch(fileUrl);
              const pdfBytes = new Uint8Array(await pdfResp.arrayBuffer());
              const path = `${uuid}.pdf`;
              const { error: upErr } = await admin.storage
                .from("contratos-assinados")
                .upload(path, pdfBytes, { contentType: "application/pdf", upsert: true });
              if (!upErr) update.url_download = path;
            }
          } catch (_e) { /* segue mesmo se download falhar */ }
        }

        await admin.from("contratos_assinatura").update(update).eq("id", c.id);
        results.push({ uuid, status: novoStatus, statusRaw });
      } catch (e: any) {
        results.push({ uuid, error: e?.message ?? String(e) });
      }
    }

    return json({ success: true, sincronizados: results.length, results });
  } catch (e: any) {
    console.error("[d4sign-sincronizar-status]", e?.message ?? e);
    return json({ error: e?.message ?? "Erro inesperado" }, 500);
  }
});
