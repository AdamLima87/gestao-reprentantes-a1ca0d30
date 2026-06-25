const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const D4SIGN_BASE_URL = "https://secure.d4sign.com.br/api/v1";

type JsonObject = Record<string, unknown>;

type RequestBody = {
  representante_id?: string;
  pdf_base64?: string;
  nome_rep?: string;
  email_rep?: string;
};

type AppUser = {
  id: string;
  email?: string;
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  if (req.method !== "POST") return new Response("Method not allowed", { status: 405, headers: corsHeaders });

  try {
    const supabaseUrl = requiredEnv("SUPABASE_URL");
    const supabaseAnonKey = requiredEnv("SUPABASE_ANON_KEY");

    const authHeader = req.headers.get("Authorization");
    if (!authHeader) return json({ error: "Unauthorized" }, 401);

    const user = await getAuthenticatedUser(supabaseUrl, supabaseAnonKey, authHeader);
    if (!user) return json({ error: "Unauthorized" }, 401);

    const rolesList = await getUserRoles(supabaseUrl, supabaseAnonKey, authHeader, user.id);
    if (!rolesList.includes("admin") && !rolesList.includes("gestor")) {
      return json({ error: "Forbidden" }, 403);
    }

    const { representante_id, pdf_base64, nome_rep, email_rep } = await req.json() as RequestBody;
    if (!representante_id || !pdf_base64 || !nome_rep || !email_rep) {
      return json({ error: "Campos obrigatórios: representante_id, pdf_base64, nome_rep, email_rep" }, 400);
    }

    const TOKEN = requiredEnv("D4SIGN_TOKEN");
    const SAFE_UUID = requiredEnv("D4SIGN_SAFE_UUID");
    const CRYPT_KEY = Deno.env.get("D4SIGN_CRYPT_KEY") ?? "";

    const qs = `?tokenAPI=${encodeURIComponent(TOKEN)}&cryptKey=${encodeURIComponent(CRYPT_KEY)}`;
    const safeName = String(nome_rep)
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .replace(/[^a-zA-Z0-9_-]+/g, "_")
      .replace(/^_+|_+$/g, "") || "representante";
    const normalizedPdfBase64 = normalizePdfBase64(pdf_base64);

    // 1. Upload
    const uploadData = await d4signFetch(`${D4SIGN_BASE_URL}/documents/${SAFE_UUID}/uploadbinary${qs}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        base64_binary_file: normalizedPdfBase64,
        mime_type: "application/pdf",
        name: `Contrato_${safeName}.pdf`,
      }),
    }, "Falha no upload D4Sign");
    const docUuid = typeof uploadData?.uuid === "string" ? uploadData.uuid : undefined;
    if (!docUuid) return json({ error: "Falha no upload D4Sign", detail: uploadData }, 500);

    // 2. Signatário
    await d4signFetch(`${D4SIGN_BASE_URL}/documents/${docUuid}/createlist${qs}`, {
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
    }, "Falha ao adicionar signatário D4Sign");

    // 3. Registrar webhook (para receber notificações de assinatura)
    const webhookUrl = `${supabaseUrl}/functions/v1/d4sign-webhook`;
    try {
      await d4signFetch(`${D4SIGN_BASE_URL}/documents/${docUuid}/webhooks${qs}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url: webhookUrl }),
      }, "Falha ao registrar webhook D4Sign");
    } catch (_e) {
      // não bloqueia o envio se o webhook falhar
    }

    // 4. Enviar para assinatura
    await d4signFetch(`${D4SIGN_BASE_URL}/documents/${docUuid}/sendtosigner${qs}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        message: "Por favor, assine o contrato de representação comercial da Brazil Amortecedores.",
        workflow: "0",
        skip_email: "0",
      }),
    }, "Falha ao enviar contrato D4Sign");

    // 4. Salvar no banco
    const insertData = await supabaseRestFetch<JsonObject[]>(supabaseUrl, supabaseAnonKey, authHeader, "/rest/v1/contratos_assinatura", {
      method: "POST",
      headers: { "Content-Type": "application/json", "Prefer": "return=representation" },
      body: JSON.stringify({
        representante_id,
        d4sign_document_uuid: docUuid,
        status: "enviado",
        enviado_por: user.id,
        enviado_at: new Date().toISOString(),
      }),
    });

    return json({
      success: true,
      doc_uuid: docUuid,
      contrato_id: Array.isArray(insertData) ? insertData[0]?.id : undefined,
    });

  } catch (e: unknown) {
    const raw = e instanceof Error ? e.message : "Erro inesperado";
    const message = maskSecrets(raw);
    console.error("[d4sign-enviar-contrato]", message);
    return json({ error: message }, 500);
  }
});

function requiredEnv(name: string): string {
  const value = Deno.env.get(name);
  if (!value) throw new Error(`${name} não configurado`);
  return value;
}

async function getAuthenticatedUser(supabaseUrl: string, supabaseAnonKey: string, authHeader: string): Promise<AppUser | null> {
  const response = await fetch(`${supabaseUrl}/auth/v1/user`, {
    method: "GET",
    headers: {
      apikey: supabaseAnonKey,
      Authorization: authHeader,
      Accept: "application/json",
    },
  });

  if (response.status === 401 || response.status === 403) return null;
  if (!response.ok) {
    const detail = await readResponseBody(response);
    throw new Error(`Falha ao validar usuário: ${detail}`);
  }

  const user = await response.json();
  return user?.id ? { id: String(user.id), email: user.email } : null;
}

async function getUserRoles(supabaseUrl: string, supabaseAnonKey: string, authHeader: string, userId: string): Promise<string[]> {
  const roles = await supabaseRestFetch<Array<{ role?: string; app_role?: string }>>(
    supabaseUrl,
    supabaseAnonKey,
    authHeader,
    `/rest/v1/user_roles?select=role&user_id=eq.${encodeURIComponent(userId)}`,
  );

  return roles
    .map((roleRow) => roleRow.role ?? roleRow.app_role)
    .filter((role): role is string => typeof role === "string" && role.length > 0);
}

async function supabaseRestFetch<T>(supabaseUrl: string, supabaseAnonKey: string, authHeader: string, path: string, init: RequestInit = {}): Promise<T> {
  const response = await fetch(`${supabaseUrl}${path}`, {
    ...init,
    headers: {
      apikey: supabaseAnonKey,
      Authorization: authHeader,
      Accept: "application/json",
      ...(init.headers ?? {}),
    },
  });

  if (!response.ok) {
    const detail = await readResponseBody(response);
    throw new Error(`Falha na API do banco: ${detail}`);
  }

  if (response.status === 204) return null as T;
  return await response.json() as T;
}

async function d4signFetch(url: string, init: RequestInit, fallbackMessage: string): Promise<JsonObject> {
  const response = await fetch(url, init);
  const detail = await readResponseBody(response);

  if (!response.ok) {
    throw new Error(`${fallbackMessage}: ${detail}`);
  }

  if (!detail) return {};
  try {
    return JSON.parse(detail) as JsonObject;
  } catch {
    return { raw: detail };
  }
}

async function readResponseBody(response: Response): Promise<string> {
  const text = await response.text();
  if (!text) return `${response.status} ${response.statusText}`.trim();

  try {
    return JSON.stringify(JSON.parse(text));
  } catch {
    return text;
  }
}

function normalizePdfBase64(pdfBase64: string): string {
  return pdfBase64
    .replace(/^data:application\/pdf;base64,/i, "")
    .replace(/\s/g, "");
}

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}
