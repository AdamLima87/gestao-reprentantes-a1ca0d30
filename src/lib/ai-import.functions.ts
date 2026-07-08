import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

export type AIImportNfe = {
  numero_nfe?: string | null;
  valor_nfe?: number | null;
  data_nfe?: string | null;
  data_entrega?: string | null;
};

export type AIImportPedido = {
  numero_pedido?: string | null;
  numero_pedido_cliente?: string | null;
  cnpj_cliente?: string | null;
  nome_cliente?: string | null;
  nome_representante?: string | null;
  data_pedido?: string | null;
  prazo_entrega?: string | null;
  valor_produtos?: number | null;
  status?: string | null;
  vendedor_interno_participou?: boolean | null;
};

export type AIImportRow = {
  row: number;
  sheet?: string | null;
  status: "ok" | "warning" | "error";
  errors: string[];
  warnings: string[];
  pedido: AIImportPedido;
  nfe?: AIImportNfe | null;
};

export type AIImportResult = {
  rows: AIImportRow[];
  summary: string;
};

const SYSTEM_PROMPT = `Você é um assistente especialista em interpretar planilhas de pedidos comerciais da Brazil Amortecedores e convertê-las em JSON estruturado.

Para cada linha relevante das planilhas recebidas (ignore linhas de cabeçalho, totais, em branco ou notas), extraia um pedido. Tente identificar automaticamente as colunas mesmo quando os nomes variarem (sinônimos, abreviações, idiomas).

Retorne SEMPRE um objeto JSON com a estrutura:
{
  "rows": [
    {
      "row": <número da linha na planilha original, começando em 1>,
      "sheet": <nome da aba/planilha ou null>,
      "status": "ok" | "warning" | "error",
      "errors": [<strings descrevendo erros que impedem a importação>],
      "warnings": [<strings descrevendo dúvidas, formatos suspeitos ou ajustes feitos>],
      "pedido": {
        "numero_pedido": string|null,
        "numero_pedido_cliente": string|null,
        "cnpj_cliente": string|null,            // só dígitos quando possível
        "nome_cliente": string|null,
        "nome_representante": string|null,
        "data_pedido": "YYYY-MM-DD"|null,
        "prazo_entrega": "YYYY-MM-DD"|null,
        "valor_produtos": number|null,           // em reais, ponto como separador decimal
        "status": "pedido"|"producao"|"faturado"|"entregue"|"cancelado"|null,
        "vendedor_interno_participou": boolean|null
      },
      "nfe": null | {
        "numero_nfe": string|null,
        "valor_nfe": number|null,
        "data_nfe": "YYYY-MM-DD"|null,
        "data_entrega": "YYYY-MM-DD"|null
      }
    }
  ],
  "summary": <breve resumo em português>
}

Regras:
- Datas SEMPRE no formato YYYY-MM-DD. Converta datas brasileiras (dd/mm/aaaa) e seriais Excel.
- Valores monetários em number puro (sem "R$", sem separador de milhar).
- Marque status="error" quando faltar nome_cliente OU numero_pedido OU valor_produtos OU data_pedido.
- Marque status="warning" quando houver suspeitas (CNPJ inválido, status desconhecido, datas duvidosas).
- Inclua "nfe" apenas se a linha indicar emissão de NF-e (coluna nfe_emitida=sim ou existirem dados de NF-e).
- NÃO invente dados. Quando não houver valor, use null.
- Retorne APENAS JSON válido, sem markdown.`;

export const interpretarPlanilhas = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(
    (input: { sheets: { name: string; rows: Record<string, unknown>[] }[]; model?: string }) => {
      if (!input || !Array.isArray(input.sheets)) throw new Error("sheets inválido");
      if (input.sheets.length > 20) throw new Error("Máximo de 20 abas por importação.");
      return input;
    },
  )
  .handler(async ({ data, context }): Promise<AIImportResult> => {
    // Autorização: apenas quem tem permissão de importar planilhas pode consumir créditos de IA
    const { data: isAdmin } = await context.supabase.rpc("has_role", {
      _user_id: context.userId,
      _role: "admin",
    });
    let autorizado = Boolean(isAdmin);
    if (!autorizado) {
      const { data: temPerm } = await context.supabase.rpc("has_permission", {
        uid: context.userId,
        perm: "importar_planilhas",
      });
      autorizado = Boolean(temPerm);
    }
    if (!autorizado) {
      throw new Error("Sem permissão para importar planilhas.");
    }

    const key = process.env.LOVABLE_API_KEY;
    if (!key) throw new Error("LOVABLE_API_KEY não configurada.");

    const model = data.model || "google/gemini-2.5-pro";

    const totalRows = data.sheets.reduce((acc, s) => acc + s.rows.length, 0);
    if (totalRows === 0) throw new Error("Planilhas vazias.");
    if (totalRows > 800) throw new Error("Limite de 800 linhas por importação. Divida em arquivos menores.");

    const userContent =
      "Planilhas recebidas (cada aba é um array de objetos onde a chave é o cabeçalho original):\n\n" +
      JSON.stringify(data.sheets, null, 2);

    const resp = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Lovable-API-Key": key,
        "X-Lovable-AIG-SDK": "raw",
      },
      body: JSON.stringify({
        model,
        messages: [
          { role: "system", content: SYSTEM_PROMPT },
          { role: "user", content: userContent },
        ],
        response_format: { type: "json_object" },
      }),
    });

    if (!resp.ok) {
      const txt = await resp.text();
      if (resp.status === 429) throw new Error("Limite de requisições da IA atingido. Tente novamente em instantes.");
      if (resp.status === 402) throw new Error("Créditos de IA esgotados. Adicione créditos na workspace.");
      throw new Error(`Falha na IA (${resp.status}): ${txt.slice(0, 300)}`);
    }

    const json = (await resp.json()) as { choices?: { message?: { content?: string } }[] };
    const content = json.choices?.[0]?.message?.content ?? "";
    let parsed: AIImportResult;
    try {
      parsed = JSON.parse(content) as AIImportResult;
    } catch {
      const m = content.match(/\{[\s\S]*\}/);
      if (!m) throw new Error("IA retornou conteúdo inválido.");
      parsed = JSON.parse(m[0]) as AIImportResult;
    }

    if (!Array.isArray(parsed.rows)) parsed.rows = [];
    parsed.rows = parsed.rows.map((r, i) => ({
      row: r.row ?? i + 1,
      sheet: r.sheet ?? null,
      status: (r.status as AIImportRow["status"]) ?? "error",
      errors: Array.isArray(r.errors) ? r.errors : [],
      warnings: Array.isArray(r.warnings) ? r.warnings : [],
      pedido: r.pedido ?? {},
      nfe: r.nfe ?? null,
    }));
    return parsed;
  });
