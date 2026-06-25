import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const D4SIGN_BASE_URL = "https://secure.d4sign.com.br/api/v1";

Deno.serve(async (req) => {
  if (req.method !== "POST") return new Response("OK", { status: 200 });

  let body: any = {};
  try {
    body = await req.json();
  } catch {
    try { body = Object.fromEntries(await req.formData()); } catch { /* ignore */ }
  }

  const docUuid: string | undefined = body?.uuid ?? body?.document_uuid;
  const evento: string = (body?.type_post ?? body?.type ?? body?.status ?? "").toString().toLowerCase();

  if (!docUuid) return new Response("OK", { status: 200 });

  const statusMap: Record<string, string> = {
    signed: "assinado",
    "1": "assinado",
    finished: "assinado",
    viewed: "visualizado",
    refused: "recusado",
    canceled: "cancelado",
    cancelled: "cancelado",
  };
  const novoStatus = statusMap[evento] ?? "pendente";

  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
  );

  const updateData: Record<string, unknown> = {
    status: novoStatus,
    updated_at: new Date().toISOString(),
  };

  if (novoStatus === "assinado") {
    updateData.assinado_at = new Date().toISOString();

    // Baixar PDF assinado do D4Sign e salvar no storage
    try {
      const TOKEN = Deno.env.get("D4SIGN_TOKEN")!;
      const CRYPT = Deno.env.get("D4SIGN_CRYPT_KEY") ?? "";
      const qs = `?tokenAPI=${encodeURIComponent(TOKEN)}&cryptKey=${encodeURIComponent(CRYPT)}`;

      const dlResp = await fetch(`${D4SIGN_BASE_URL}/documents/${docUuid}/download${qs}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ type: "PDF" }),
      });
      const dlJson = await dlResp.json().catch(() => ({}));
      const fileUrl: string | undefined = dlJson?.url;

      if (fileUrl) {
        const pdfResp = await fetch(fileUrl);
        const pdfBytes = new Uint8Array(await pdfResp.arrayBuffer());
        const path = `${docUuid}.pdf`;

        const { error: upErr } = await supabase
          .storage.from("contratos-assinados")
          .upload(path, pdfBytes, { contentType: "application/pdf", upsert: true });

        if (!upErr) updateData.url_download = path;
      }
    } catch (_e) { /* ignora; status já será atualizado */ }
  }

  await supabase.from("contratos_assinatura").update(updateData).eq("d4sign_document_uuid", docUuid);

  return new Response("OK", { status: 200 });
});
