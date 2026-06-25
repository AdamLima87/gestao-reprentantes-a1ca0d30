import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

Deno.serve(async (req) => {
  if (req.method !== "POST") return new Response("OK", { status: 200 });

  let body: any = {};
  try {
    body = await req.json();
  } catch {
    try { body = Object.fromEntries(await req.formData()); } catch { /* ignore */ }
  }

  // D4Sign envia uuid + type_post (ou type)
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
  if (novoStatus === "assinado") updateData.assinado_at = new Date().toISOString();

  await supabase.from("contratos_assinatura").update(updateData).eq("d4sign_document_uuid", docUuid);

  return new Response("OK", { status: 200 });
});
