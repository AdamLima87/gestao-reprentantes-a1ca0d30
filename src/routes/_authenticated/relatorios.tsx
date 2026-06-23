import { createFileRoute } from "@tanstack/react-router";
import { formatarData } from "@/lib/utils";
import { useQuery } from "@tanstack/react-query";
import { useEffect, useMemo, useRef, useState } from "react";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from "recharts";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { usePermissions } from "@/hooks/use-permissions";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Download, FileText } from "lucide-react";
import { fmtBRL, exportCSV, exportPDF } from "@/lib/export-utils";

export const Route = createFileRoute("/_authenticated/relatorios")({
  component: RelatoriosPage,
});

const TIPO_LABEL: Record<string, string> = {
  externo: "Representante",
  interno_sobre_rep: "Vend. Interno 0,5%",
  interno_novo: "Vend. Interno - Cliente Novo",
  interno_reativacao: "Vend. Interno - Reativação",
  interno_recorrente: "Vend. Interno - Recorrente",
};

const MESES = [
  "Jan", "Fev", "Mar", "Abr", "Mai", "Jun",
  "Jul", "Ago", "Set", "Out", "Nov", "Dez",
];

function RelatoriosPage() {
  const { roles } = useAuth();
  const { can } = usePermissions();
  const allowed = can("exportar_relatorios") || roles.some((r) => ["admin", "vendedor_interno", "financeiro", "gestor"].includes(r));
  const now = new Date();
  const [mes, setMes] = useState(now.getMonth() + 1);
  const [ano, setAno] = useState(now.getFullYear());

  if (!allowed) {
    return <p className="text-muted-foreground">Sem acesso aos relatórios.</p>;
  }

  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-bold">Relatórios</h1>

      <Card>
        <CardContent className="pt-6 flex flex-wrap gap-3 items-end">
          <div className="w-28">
            <Label className="text-xs">Mês</Label>
            <Select value={String(mes)} onValueChange={(v) => setMes(Number(v))}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {Array.from({ length: 12 }, (_, i) => i + 1).map((m) => (
                  <SelectItem key={m} value={String(m)}>
                    {String(m).padStart(2, "0")} - {MESES[m - 1]}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="w-32">
            <Label className="text-xs">Ano</Label>
            <Select value={String(ano)} onValueChange={(v) => setAno(Number(v))}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {Array.from({ length: 5 }, (_, i) => now.getFullYear() - 2 + i).map((a) => (
                  <SelectItem key={a} value={String(a)}>{a}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      <Tabs defaultValue="comissoes">
        <TabsList>
          <TabsTrigger value="comissoes">Comissões</TabsTrigger>
          <TabsTrigger value="vendas">Vendas</TabsTrigger>
          <TabsTrigger value="pedidos">Pedidos</TabsTrigger>
          <TabsTrigger value="clientes">Clientes</TabsTrigger>
        </TabsList>

        <TabsContent value="comissoes" className="space-y-4 mt-4">
          <ComissoesTab mes={mes} ano={ano} />
        </TabsContent>
        <TabsContent value="vendas" className="space-y-4 mt-4">
          <VendasTab mes={mes} ano={ano} />
        </TabsContent>
        <TabsContent value="pedidos" className="space-y-4 mt-4">
          <PedidosTab mes={mes} ano={ano} />
        </TabsContent>
        <TabsContent value="clientes" className="space-y-4 mt-4">
          <ClientesTab mes={mes} ano={ano} />
        </TabsContent>
      </Tabs>
    </div>
  );
}

function ExportButtons({ onCSV, onPDF }: { onCSV: () => void; onPDF: () => void }) {
  const { can } = usePermissions();
  if (!can("exportar_relatorios")) return null;
  return (
    <div className="flex gap-2">
      <Button variant="outline" size="sm" onClick={onCSV}>
        <Download className="h-4 w-4 mr-1" /> CSV
      </Button>
      <Button variant="outline" size="sm" onClick={onPDF}>
        <FileText className="h-4 w-4 mr-1" /> PDF
      </Button>
    </div>
  );
}

/* ============ COMISSÕES ============ */
type Visao = "todos" | "externos" | "interno";

function ComissoesTab({ mes, ano }: { mes: number; ano: number }) {
  const [visao, setVisao] = useState<Visao>("todos");
  const [repFiltro, setRepFiltro] = useState<string>("todos");

  const { data, isLoading } = useQuery({
    queryKey: ["rel-comissoes", mes, ano],
    queryFn: async () => {
      const res = await supabase
        .from("comissoes")
        .select(
          "tipo, base_calculo, valor_comissao, percentual_aplicado, nfe_id, representante_id, representantes(nome, tipo), nfe(numero_nfe, data_nfe, data_entrega, pedidos(clientes(nome)))",
        )
        .eq("mes_ref", mes)
        .eq("ano_ref", ano);
      return res.data ?? [];
    },
  });

  const periodo = `${String(mes).padStart(2, "0")}/${ano}`;
  const mostraRepFiltro = visao === "todos" || visao === "externos";

  const repsOptions = useMemo(() => {
    const m = new Map<string, string>();
    for (const c of (data ?? []) as ComissaoRow[]) {
      if (c.tipo === "externo" && c.representante_id) {
        m.set(c.representante_id, c.representantes?.nome ?? "—");
      }
    }
    return [...m.entries()].map(([id, nome]) => ({ id, nome })).sort((a, b) => a.nome.localeCompare(b.nome));
  }, [data]);

  return (
    <div className="space-y-4">
      <Card>
        <CardContent className="pt-6 flex flex-wrap items-end gap-4">
          <div className="w-64">
            <Label className="text-xs">Visualizar</Label>
            <Select value={visao} onValueChange={(v) => setVisao(v as Visao)}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="todos">Todos</SelectItem>
                <SelectItem value="externos">Representantes externos</SelectItem>
                <SelectItem value="interno">Vendedor interno</SelectItem>
              </SelectContent>
            </Select>
          </div>
          {mostraRepFiltro && (
            <div className="w-72">
              <Label className="text-xs">Representante</Label>
              <Select value={repFiltro} onValueChange={setRepFiltro}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="todos">Todos os representantes</SelectItem>
                  {repsOptions.map((r) => (
                    <SelectItem key={r.id} value={r.id}>{r.nome}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}
        </CardContent>
      </Card>

      {isLoading ? (
        <p className="text-muted-foreground">Carregando…</p>
      ) : (
        <>
          {(visao === "todos" || visao === "externos") && (
            <ExternosTable
              data={data ?? []}
              periodo={periodo}
              mes={mes}
              ano={ano}
              repFiltro={repFiltro}
              repsOptions={repsOptions}
            />
          )}
          {(visao === "todos" || visao === "interno") && (
            <InternoTable data={data ?? []} periodo={periodo} mes={mes} ano={ano} />
          )}
        </>
      )}
    </div>
  );
}

type ComissaoRow = {
  tipo: string;
  base_calculo: number | string;
  valor_comissao: number | string;
  percentual_aplicado: number | string;
  nfe_id: string;
  representante_id: string | null;
  representantes: { nome?: string; tipo?: string } | null;
  nfe: {
    numero_nfe?: string;
    data_nfe?: string;
    data_entrega?: string | null;
    pedidos?: { clientes?: { nome?: string } | null } | null;
  } | null;
};

function ExternosTable({
  data,
  periodo,
  mes,
  ano,
  repFiltro,
  repsOptions,
}: {
  data: ComissaoRow[];
  periodo: string;
  mes: number;
  ano: number;
  repFiltro: string;
  repsOptions: { id: string; nome: string }[];
}) {
  const cardRef = useRef<HTMLDivElement>(null);

  const externos = useMemo(() => data.filter((c) => c.tipo === "externo"), [data]);

  const rows = useMemo(() => {
    const map = new Map<string, { rep: string; tipo: string; nfes: Set<string>; base: number; valor: number }>();
    for (const c of externos) {
      const key = `${c.representante_id}|${c.tipo}`;
      const r = map.get(key) ?? {
        rep: c.representantes?.nome ?? "—",
        tipo: TIPO_LABEL[c.tipo] ?? c.tipo,
        nfes: new Set<string>(),
        base: 0,
        valor: 0,
      };
      r.nfes.add(c.nfe_id);
      r.base += Number(c.base_calculo);
      r.valor += Number(c.valor_comissao);
      map.set(key, r);
    }
    return [...map.values()].sort((a, b) => a.rep.localeCompare(b.rep));
  }, [externos]);

  const detailRows = useMemo(() => {
    if (repFiltro === "todos") return [];
    return externos
      .filter((c) => c.representante_id === repFiltro)
      .map((c) => ({
        numero: c.nfe?.numero_nfe ?? "—",
        emissao: c.nfe?.data_nfe ?? "",
        cliente: c.nfe?.pedidos?.clientes?.nome ?? "—",
        valor: Number(c.base_calculo),
        pct: Number(c.percentual_aplicado),
        comissao: Number(c.valor_comissao),
      }))
      .sort((a, b) => (a.emissao || "").localeCompare(b.emissao || ""));
  }, [externos, repFiltro]);

  const totalBase = rows.reduce((s, r) => s + r.base, 0);
  const totalVal = rows.reduce((s, r) => s + r.valor, 0);
  const totalNfe = rows.reduce((s, r) => s + r.nfes.size, 0);
  const detTotalBase = detailRows.reduce((s, r) => s + r.valor, 0);
  const detTotalCom = detailRows.reduce((s, r) => s + r.comissao, 0);
  const repNome = repsOptions.find((r) => r.id === repFiltro)?.nome ?? "";

  const isDetail = repFiltro !== "todos";

  useEffect(() => {
    if (isDetail && cardRef.current) {
      cardRef.current.scrollIntoView({ behavior: "smooth", block: "start" });
    }
  }, [repFiltro, isDetail]);

  const handleCSV = () => {
    if (!isDetail) {
      exportCSV(
        `comissoes-externos-${ano}-${String(mes).padStart(2, "0")}`,
        ["Representante", "Tipo", "Qtd NF-e", "Base de Cálculo", "Comissão"],
        [
          ...rows.map((r) => [r.rep, r.tipo, r.nfes.size, r.base.toFixed(2), r.valor.toFixed(2)]),
          ["TOTAL", "", totalNfe, totalBase.toFixed(2), totalVal.toFixed(2)],
        ],
      );
    } else {
      exportCSV(
        `comissoes-${repNome}-${ano}-${String(mes).padStart(2, "0")}`,
        ["NF", "Data Emissão", "Cliente", "Valor Produto", "%", "Comissão"],
        [
          ...detailRows.map((r) => [r.numero, formatarData(r.emissao), r.cliente, r.valor.toFixed(2), r.pct.toFixed(2), r.comissao.toFixed(2)]),
          ["TOTAL", "", "", detTotalBase.toFixed(2), "", detTotalCom.toFixed(2)],
        ],
      );
    }
  };
  const handlePDF = () => {
    if (!isDetail) {
      exportPDF(
        `comissoes-externos-${ano}-${String(mes).padStart(2, "0")}`,
        `Comissões por Representante - ${periodo}`,
        ["Representante", "Tipo", "Qtd NF-e", "Base de Cálculo", "Comissão"],
        [
          ...rows.map((r) => [r.rep, r.tipo, r.nfes.size, fmtBRL(r.base), fmtBRL(r.valor)]),
          ["TOTAL", "", totalNfe, fmtBRL(totalBase), fmtBRL(totalVal)],
        ],
      );
    } else {
      exportPDF(
        `comissoes-${repNome}-${ano}-${String(mes).padStart(2, "0")}`,
        `Comissões - ${repNome} - ${periodo}`,
        ["NF", "Data Emissão", "Cliente", "Valor Produto", "%", "Comissão"],
        [
          ...detailRows.map((r) => [r.numero, formatarData(r.emissao), r.cliente, fmtBRL(r.valor), `${r.pct.toFixed(2)}%`, fmtBRL(r.comissao)]),
          ["TOTAL", "", "", fmtBRL(detTotalBase), "", fmtBRL(detTotalCom)],
        ],
      );
    }
  };

  const modoLabel = isDetail
    ? `Detalhamento — ${repNome} — ${periodo}`
    : "Visão geral — agrupado por representante";

  return (
    <Card ref={cardRef}>
      <CardHeader className="flex flex-row items-center justify-between">
        <CardTitle>Comissões por Representante</CardTitle>
        <ExportButtons onCSV={handleCSV} onPDF={handlePDF} />
      </CardHeader>
      <CardContent className="space-y-4">
        <p className="text-sm font-medium text-muted-foreground">{modoLabel}</p>



        {!isDetail && (rows.length === 0 ? (
          <p className="text-muted-foreground">Sem comissões externas no período.</p>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Representante</TableHead>
                <TableHead>Tipo</TableHead>
                <TableHead className="text-right">Qtd NF-e</TableHead>
                <TableHead className="text-right">Base de Cálculo</TableHead>
                <TableHead className="text-right">Comissão</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.map((r, i) => (
                <TableRow key={i}>
                  <TableCell className="font-medium">{r.rep}</TableCell>
                  <TableCell>{r.tipo}</TableCell>
                  <TableCell className="text-right">{r.nfes.size}</TableCell>
                  <TableCell className="text-right">{fmtBRL(r.base)}</TableCell>
                  <TableCell className="text-right font-medium">{fmtBRL(r.valor)}</TableCell>
                </TableRow>
              ))}
              <TableRow className="bg-muted/50 font-bold">
                <TableCell colSpan={2}>TOTAL</TableCell>
                <TableCell className="text-right">{totalNfe}</TableCell>
                <TableCell className="text-right">{fmtBRL(totalBase)}</TableCell>
                <TableCell className="text-right">{fmtBRL(totalVal)}</TableCell>
              </TableRow>
            </TableBody>
          </Table>
        ))}

        {isDetail && (detailRows.length === 0 ? (
          <p className="text-muted-foreground">Sem NF-e desse representante no período.</p>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>NF</TableHead>
                <TableHead>Data Emissão</TableHead>
                <TableHead>Cliente</TableHead>
                <TableHead className="text-right">Valor Produto</TableHead>
                <TableHead className="text-right">%</TableHead>
                <TableHead className="text-right">Comissão</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {detailRows.map((r, i) => (
                <TableRow key={i}>
                  <TableCell className="font-medium">{r.numero}</TableCell>
                  <TableCell>{formatarData(r.emissao)}</TableCell>
                  <TableCell>{r.cliente}</TableCell>
                  <TableCell className="text-right">{fmtBRL(r.valor)}</TableCell>
                  <TableCell className="text-right">{r.pct.toFixed(2)}%</TableCell>
                  <TableCell className="text-right font-medium">{fmtBRL(r.comissao)}</TableCell>
                </TableRow>
              ))}
              <TableRow className="bg-muted/50 font-bold">
                <TableCell colSpan={3}>TOTAL</TableCell>
                <TableCell className="text-right">{fmtBRL(detTotalBase)}</TableCell>
                <TableCell></TableCell>
                <TableCell className="text-right">{fmtBRL(detTotalCom)}</TableCell>
              </TableRow>
            </TableBody>
          </Table>
        ))}
      </CardContent>
    </Card>
  );
}

const TIPOS_INTERNO = ["interno_novo", "interno_reativacao", "interno_recorrente", "interno_sobre_rep"] as const;


function InternoTable({
  data,
  periodo,
  mes,
  ano,
}: {
  data: ComissaoRow[];
  periodo: string;
  mes: number;
  ano: number;
}) {
  const internas = useMemo(
    () => data.filter((c) => (TIPOS_INTERNO as readonly string[]).includes(c.tipo)),
    [data],
  );

  const vendedorNome = useMemo(() => {
    const rep = internas.find((c) => c.representantes?.tipo === "interno")?.representantes?.nome;
    return rep ?? "Vendedor Interno";
  }, [internas]);

  // Agrupar por NF-e
  const rows = useMemo(() => {
    type R = {
      nfeId: string;
      numero: string;
      emissao: string;
      empresa: string;
      entrega: string;
      valor: number;
      c15: number | null;
      c1: number | null;
      c05: number | null;
    };
    const map = new Map<string, R>();
    for (const c of internas) {
      const r = map.get(c.nfe_id) ?? {
        nfeId: c.nfe_id,
        numero: c.nfe?.numero_nfe ?? "—",
        emissao: c.nfe?.data_nfe ?? "",
        empresa: c.nfe?.pedidos?.clientes?.nome ?? "—",
        entrega: c.nfe?.data_entrega ?? "",
        valor: Number(c.base_calculo),
        c15: null,
        c1: null,
        c05: null,
      };
      const valor = Number(c.valor_comissao);
      if (c.tipo === "interno_novo" || c.tipo === "interno_reativacao") {
        r.c15 = (r.c15 ?? 0) + valor;
      } else if (c.tipo === "interno_recorrente") {
        r.c1 = (r.c1 ?? 0) + valor;
      } else if (c.tipo === "interno_sobre_rep") {
        r.c05 = (r.c05 ?? 0) + valor;
      }
      map.set(c.nfe_id, r);
    }
    return [...map.values()].sort((a, b) => (a.emissao || "").localeCompare(b.emissao || ""));
  }, [internas]);

  const totals = useMemo(() => {
    return rows.reduce(
      (acc, r) => ({
        valor: acc.valor + r.valor,
        c15: acc.c15 + (r.c15 ?? 0),
        c1: acc.c1 + (r.c1 ?? 0),
        c05: acc.c05 + (r.c05 ?? 0),
      }),
      { valor: 0, c15: 0, c1: 0, c05: 0 },
    );
  }, [rows]);

  const headers = ["NF", "EMISSÃO", "EMPRESA", "ENTREGA", "$ PRODUTO", "COMISSÃO 1,5%", "COMISSÃO 1%", "COMISSÃO 0,5%", "TOTAL COMISSÃO"];

  const totalGeral = totals.c15 + totals.c1 + totals.c05;
  const summaryLine = `Total 1,5% (novo/reativação): ${fmtBRL(totals.c15)}  |  Total 1% (recorrente): ${fmtBRL(totals.c1)}  |  Total 0,5% (sobre rep): ${fmtBRL(totals.c05)}  |  Total geral: ${fmtBRL(totalGeral)}`;

  const handleCSV = () =>
    exportCSV(
      `comissoes-interno-${ano}-${String(mes).padStart(2, "0")}`,
      headers,
      [
        ...rows.map((r) => {
          const tot = (r.c15 ?? 0) + (r.c1 ?? 0) + (r.c05 ?? 0);
          return [
            r.numero,
            formatarData(r.emissao),
            r.empresa,
            formatarData(r.entrega),
            r.valor.toFixed(2),
            r.c15 == null ? "—" : r.c15.toFixed(2),
            r.c1 == null ? "—" : r.c1.toFixed(2),
            r.c05 == null ? "—" : r.c05.toFixed(2),
            tot.toFixed(2),
          ];
        }),
        [
          "TOTAL",
          "",
          "",
          "",
          totals.valor.toFixed(2),
          totals.c15.toFixed(2),
          totals.c1.toFixed(2),
          totals.c05.toFixed(2),
          totalGeral.toFixed(2),
        ],
      ],
    );

  const handlePDF = () =>
    exportPDF(
      `comissoes-interno-${ano}-${String(mes).padStart(2, "0")}`,
      `BRAZIL AMORTECEDORES - CÁLCULO DE COMISSÃO POR REPRESENTANTE - ${vendedorNome.toUpperCase()}`,
      headers,
      [
        ...rows.map((r) => {
          const tot = (r.c15 ?? 0) + (r.c1 ?? 0) + (r.c05 ?? 0);
          return [
            r.numero,
            formatarData(r.emissao),
            r.empresa,
            formatarData(r.entrega),
            fmtBRL(r.valor),
            r.c15 == null ? "—" : fmtBRL(r.c15),
            r.c1 == null ? "—" : fmtBRL(r.c1),
            r.c05 == null ? "—" : fmtBRL(r.c05),
            fmtBRL(tot),
          ];
        }),
        [
          "TOTAL",
          "",
          "",
          "",
          fmtBRL(totals.valor),
          fmtBRL(totals.c15),
          fmtBRL(totals.c1),
          fmtBRL(totals.c05),
          fmtBRL(totalGeral),
        ],
      ],
      `Período: ${periodo}  |  ${summaryLine}`,
    );

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <CardTitle>Cálculo de Comissão — Vendedor Interno</CardTitle>
        <ExportButtons onCSV={handleCSV} onPDF={handlePDF} />
      </CardHeader>
      <CardContent className="space-y-4">
        {rows.length === 0 ? (
          <p className="text-muted-foreground">Sem comissões internas no período.</p>
        ) : (
          <>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
              <div className="rounded-md border p-3">
                <div className="text-xs text-muted-foreground">Total 1,5% (novo/reativação)</div>
                <div className="text-lg font-bold">{fmtBRL(totals.c15)}</div>
              </div>
              <div className="rounded-md border p-3">
                <div className="text-xs text-muted-foreground">Total 1% (recorrente)</div>
                <div className="text-lg font-bold">{fmtBRL(totals.c1)}</div>
              </div>
              <div className="rounded-md border p-3">
                <div className="text-xs text-muted-foreground">Total 0,5% (sobre rep)</div>
                <div className="text-lg font-bold">{fmtBRL(totals.c05)}</div>
              </div>
              <div className="rounded-md border p-3 bg-green-50 dark:bg-green-950/30 border-green-600/40">
                <div className="text-xs text-green-700 dark:text-green-400">Total geral</div>
                <div className="text-lg font-bold text-green-700 dark:text-green-400">{fmtBRL(totalGeral)}</div>
              </div>
            </div>

            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>NF</TableHead>
                  <TableHead>Emissão</TableHead>
                  <TableHead>Empresa</TableHead>
                  <TableHead>Entrega</TableHead>
                  <TableHead className="text-right">Valor Produto</TableHead>
                  <TableHead className="text-right">Comissão 1,5%</TableHead>
                  <TableHead className="text-right">Comissão 1%</TableHead>
                  <TableHead className="text-right">Comissão 0,5%</TableHead>
                  <TableHead className="text-right">Total Comissão</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {rows.map((r) => {
                  const tot = (r.c15 ?? 0) + (r.c1 ?? 0) + (r.c05 ?? 0);
                  return (
                    <TableRow key={r.nfeId}>
                      <TableCell className="font-medium">{r.numero}</TableCell>
                      <TableCell>{formatarData(r.emissao)}</TableCell>
                      <TableCell>{r.empresa}</TableCell>
                      <TableCell>{formatarData(r.entrega)}</TableCell>
                      <TableCell className="text-right">{fmtBRL(r.valor)}</TableCell>
                      <TableCell className="text-right">{r.c15 == null ? "—" : fmtBRL(r.c15)}</TableCell>
                      <TableCell className="text-right">{r.c1 == null ? "—" : fmtBRL(r.c1)}</TableCell>
                      <TableCell className="text-right">{r.c05 == null ? "—" : fmtBRL(r.c05)}</TableCell>
                      <TableCell className="text-right font-medium">{fmtBRL(tot)}</TableCell>
                    </TableRow>
                  );
                })}
                <TableRow className="bg-muted/50 font-bold">
                  <TableCell colSpan={4}>TOTAL</TableCell>
                  <TableCell className="text-right">{fmtBRL(totals.valor)}</TableCell>
                  <TableCell className="text-right">{fmtBRL(totals.c15)}</TableCell>
                  <TableCell className="text-right">{fmtBRL(totals.c1)}</TableCell>
                  <TableCell className="text-right">{fmtBRL(totals.c05)}</TableCell>
                  <TableCell className="text-right text-green-700 dark:text-green-400">{fmtBRL(totalGeral)}</TableCell>
                </TableRow>
              </TableBody>
            </Table>
          </>
        )}
      </CardContent>
    </Card>
  );
}

// Badge import kept for other tabs that may use it later
void Badge;

/* ============ VENDAS ============ */
function VendasTab({ mes, ano }: { mes: number; ano: number }) {
  const { data, isLoading } = useQuery({
    queryKey: ["rel-vendas", mes, ano],
    queryFn: async () => {
      const [nfeMes, nfeAno, pedidos, metas, reps] = await Promise.all([
        supabase.from("nfe").select("valor_nfe, pedido_id").eq("mes_ref", mes).eq("ano_ref", ano),
        supabase.from("nfe").select("valor_nfe, mes_ref").eq("ano_ref", ano),
        supabase.from("pedidos").select("id, representante_id"),
        supabase.from("metas").select("valor, representante_id").eq("mes", mes).eq("ano", ano),
        supabase.from("representantes").select("id, nome"),
      ]);
      return {
        nfeMes: nfeMes.data ?? [],
        nfeAno: nfeAno.data ?? [],
        pedidos: pedidos.data ?? [],
        metas: metas.data ?? [],
        reps: reps.data ?? [],
      };
    },
  });

  const periodo = `${String(mes).padStart(2, "0")}/${ano}`;

  const stats = useMemo(() => {
    if (!data) return null;
    const totalMes = data.nfeMes.reduce((s, n) => s + Number(n.valor_nfe), 0);
    const numNotas = data.nfeMes.length;
    const ticketMedio = numNotas ? totalMes / numNotas : 0;
    const meta = Number(data.metas.find((m) => !m.representante_id)?.valor ?? 0);
    const pctMeta = meta > 0 ? (totalMes / meta) * 100 : 0;
    const pedidoIds = new Set(data.nfeMes.map((n) => n.pedido_id));
    return { totalMes, numNotas, ticketMedio, meta, pctMeta, numPedidos: pedidoIds.size };
  }, [data]);

  const chart = useMemo(() => {
    if (!data) return [];
    const by: Record<number, number> = {};
    for (const n of data.nfeAno) {
      by[n.mes_ref] = (by[n.mes_ref] ?? 0) + Number(n.valor_nfe);
    }
    return Array.from({ length: 12 }, (_, i) => ({ mes: MESES[i], total: by[i + 1] ?? 0 }));
  }, [data]);

  const ranking = useMemo(() => {
    if (!data) return [];
    const pedRep = new Map(data.pedidos.map((p) => [p.id, p.representante_id]));
    const repAgg = new Map<string, { total: number; pedidos: Set<string> }>();
    for (const n of data.nfeMes) {
      const rid = pedRep.get(n.pedido_id) ?? "—";
      const agg = repAgg.get(rid) ?? { total: 0, pedidos: new Set<string>() };
      agg.total += Number(n.valor_nfe);
      agg.pedidos.add(n.pedido_id);
      repAgg.set(rid, agg);
    }
    const totalGeral = [...repAgg.values()].reduce((s, r) => s + r.total, 0);
    return [...repAgg.entries()]
      .map(([rid, v]) => ({
        nome: data.reps.find((r) => r.id === rid)?.nome ?? "—",
        total: v.total,
        pedidos: v.pedidos.size,
        ticket: v.pedidos.size ? v.total / v.pedidos.size : 0,
        pct: totalGeral ? (v.total / totalGeral) * 100 : 0,
      }))
      .sort((a, b) => b.total - a.total);
  }, [data]);

  const handleCSV = () =>
    exportCSV(
      `vendas-${ano}-${String(mes).padStart(2, "0")}`,
      ["Posição", "Representante", "Total Vendido", "Pedidos", "Ticket Médio", "% do Total"],
      ranking.map((r, i) => [i + 1, r.nome, r.total.toFixed(2), r.pedidos, r.ticket.toFixed(2), r.pct.toFixed(1) + "%"]),
    );
  const handlePDF = () =>
    exportPDF(
      `vendas-${ano}-${String(mes).padStart(2, "0")}`,
      `Relatório de Vendas - ${periodo}`,
      ["Posição", "Representante", "Total Vendido", "Pedidos", "Ticket Médio", "% do Total"],
      ranking.map((r, i) => [i + 1, r.nome, fmtBRL(r.total), r.pedidos, fmtBRL(r.ticket), r.pct.toFixed(1) + "%"]),
      stats ? `Faturado: ${fmtBRL(stats.totalMes)} • Meta: ${stats.pctMeta.toFixed(1)}% • Ticket médio: ${fmtBRL(stats.ticketMedio)} • Pedidos: ${stats.numPedidos}` : undefined,
    );

  if (isLoading || !data || !stats) return <p className="text-muted-foreground">Carregando…</p>;

  return (
    <>
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <Card><CardHeader className="pb-2"><CardTitle className="text-sm">Total faturado</CardTitle></CardHeader>
          <CardContent><div className="text-xl font-bold">{fmtBRL(stats.totalMes)}</div></CardContent></Card>
        <Card><CardHeader className="pb-2"><CardTitle className="text-sm">% da meta</CardTitle></CardHeader>
          <CardContent>
            <div className="text-xl font-bold">{stats.pctMeta.toFixed(1)}%</div>
            <p className="text-xs text-muted-foreground">Meta: {fmtBRL(stats.meta)}</p>
          </CardContent></Card>
        <Card><CardHeader className="pb-2"><CardTitle className="text-sm">Ticket médio</CardTitle></CardHeader>
          <CardContent><div className="text-xl font-bold">{fmtBRL(stats.ticketMedio)}</div></CardContent></Card>
        <Card><CardHeader className="pb-2"><CardTitle className="text-sm">Pedidos faturados</CardTitle></CardHeader>
          <CardContent><div className="text-xl font-bold">{stats.numPedidos}</div></CardContent></Card>
      </div>

      <Card>
        <CardHeader><CardTitle>Evolução mensal {ano}</CardTitle></CardHeader>
        <CardContent style={{ height: 280 }}>
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={chart}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="mes" />
              <YAxis tickFormatter={(v) => (v >= 1000 ? `${(v / 1000).toFixed(0)}k` : v)} />
              <Tooltip formatter={(v: number) => fmtBRL(v)} />
              <Line type="monotone" dataKey="total" stroke="hsl(var(--primary))" strokeWidth={2} />
            </LineChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle>Ranking de representantes</CardTitle>
          <ExportButtons onCSV={handleCSV} onPDF={handlePDF} />
        </CardHeader>
        <CardContent>
          {ranking.length === 0 ? (
            <p className="text-muted-foreground">Sem vendas no período.</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>#</TableHead>
                  <TableHead>Representante</TableHead>
                  <TableHead className="text-right">Total Vendido</TableHead>
                  <TableHead className="text-right">Pedidos</TableHead>
                  <TableHead className="text-right">Ticket Médio</TableHead>
                  <TableHead className="text-right">% do Total</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {ranking.map((r, i) => (
                  <TableRow key={i}>
                    <TableCell>{i + 1}</TableCell>
                    <TableCell className="font-medium">{r.nome}</TableCell>
                    <TableCell className="text-right">{fmtBRL(r.total)}</TableCell>
                    <TableCell className="text-right">{r.pedidos}</TableCell>
                    <TableCell className="text-right">{fmtBRL(r.ticket)}</TableCell>
                    <TableCell className="text-right">{r.pct.toFixed(1)}%</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </>
  );
}

/* ============ PEDIDOS ============ */
const STATUS_LIST = ["pedido", "producao", "faturado", "entregue", "cancelado"] as const;

function PedidosTab({ mes, ano }: { mes: number; ano: number }) {
  const [statusFilter, setStatusFilter] = useState<string>("todos");

  const { data, isLoading } = useQuery({
    queryKey: ["rel-pedidos", mes, ano],
    queryFn: async () => {
      const res = await supabase
        .from("pedidos")
        .select("numero_pedido, data_pedido, prazo_entrega, valor_produtos, status, clientes(nome), representantes(nome)")
        .eq("mes_ref", mes).eq("ano_ref", ano)
        .order("data_pedido", { ascending: false });
      return res.data ?? [];
    },
  });

  const pedidos = data ?? [];
  const filtered = statusFilter === "todos" ? pedidos : pedidos.filter((p) => p.status === statusFilter);

  const porStatus = STATUS_LIST.map((s) => ({
    status: s,
    count: pedidos.filter((p) => p.status === s).length,
    total: pedidos.filter((p) => p.status === s).reduce((sum, p) => sum + Number(p.valor_produtos), 0),
  }));

  const periodo = `${String(mes).padStart(2, "0")}/${ano}`;

  const handleCSV = () =>
    exportCSV(
      `pedidos-${ano}-${String(mes).padStart(2, "0")}`,
      ["Nº Pedido", "Cliente", "Representante", "Data", "Prazo", "Valor", "Status"],
      filtered.map((p) => [
        p.numero_pedido,
        (p.clientes as { nome?: string } | null)?.nome ?? "—",
        (p.representantes as { nome?: string } | null)?.nome ?? "—",
        formatarData(p.data_pedido),
        formatarData(p.prazo_entrega),
        Number(p.valor_produtos).toFixed(2),
        p.status,
      ]),
    );
  const handlePDF = () =>
    exportPDF(
      `pedidos-${ano}-${String(mes).padStart(2, "0")}`,
      `Relatório de Pedidos - ${periodo}`,
      ["Nº", "Cliente", "Representante", "Data", "Prazo", "Valor", "Status"],
      filtered.map((p) => [
        p.numero_pedido,
        (p.clientes as { nome?: string } | null)?.nome ?? "—",
        (p.representantes as { nome?: string } | null)?.nome ?? "—",
        formatarData(p.data_pedido),
        formatarData(p.prazo_entrega),
        fmtBRL(p.valor_produtos),
        p.status,
      ]),
    );

  return (
    <>
      <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
        {porStatus.map((s) => (
          <Card key={s.status}>
            <CardHeader className="pb-2"><CardTitle className="text-xs uppercase">{s.status}</CardTitle></CardHeader>
            <CardContent>
              <div className="text-lg font-bold">{s.count}</div>
              <p className="text-xs text-muted-foreground">{fmtBRL(s.total)}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between gap-3 flex-wrap">
          <div className="flex items-center gap-3">
            <CardTitle>Pedidos do período</CardTitle>
            <div className="w-44">
              <Select value={statusFilter} onValueChange={setStatusFilter}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="todos">Todos os status</SelectItem>
                  {STATUS_LIST.map((s) => <SelectItem key={s} value={s}>{s}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
          </div>
          <ExportButtons onCSV={handleCSV} onPDF={handlePDF} />
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <p className="text-muted-foreground">Carregando…</p>
          ) : filtered.length === 0 ? (
            <p className="text-muted-foreground">Nenhum pedido no período.</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Nº Pedido</TableHead>
                  <TableHead>Cliente</TableHead>
                  <TableHead>Representante</TableHead>
                  <TableHead>Data</TableHead>
                  <TableHead>Prazo</TableHead>
                  <TableHead className="text-right">Valor</TableHead>
                  <TableHead>Status</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filtered.map((p, i) => (
                  <TableRow key={i}>
                    <TableCell className="font-medium">{p.numero_pedido}</TableCell>
                    <TableCell>{(p.clientes as { nome?: string } | null)?.nome ?? "—"}</TableCell>
                    <TableCell>{(p.representantes as { nome?: string } | null)?.nome ?? "—"}</TableCell>
                    <TableCell>{formatarData(p.data_pedido)}</TableCell>
                    <TableCell>{formatarData(p.prazo_entrega)}</TableCell>
                    <TableCell className="text-right">{fmtBRL(p.valor_produtos)}</TableCell>
                    <TableCell><Badge variant="outline">{p.status}</Badge></TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </>
  );
}

/* ============ CLIENTES ============ */
function ClientesTab({ mes, ano }: { mes: number; ano: number }) {
  const { data, isLoading } = useQuery({
    queryKey: ["rel-clientes", mes, ano],
    queryFn: async () => {
      const [clientes, pedidosTodos, pedidosMes, reps] = await Promise.all([
        supabase.from("clientes").select("id, nome, ultima_compra_at, representante_id"),
        supabase.from("pedidos").select("id, cliente_id, data_pedido, valor_produtos"),
        supabase.from("pedidos").select("id, cliente_id, valor_produtos").eq("mes_ref", mes).eq("ano_ref", ano),
        supabase.from("representantes").select("id, nome"),
      ]);
      return {
        clientes: clientes.data ?? [],
        pedidosTodos: pedidosTodos.data ?? [],
        pedidosMes: pedidosMes.data ?? [],
        reps: reps.data ?? [],
      };
    },
  });

  const periodo = `${String(mes).padStart(2, "0")}/${ano}`;

  const inativos = useMemo(() => {
    if (!data) return [];
    const limite = Date.now() - 120 * 86400 * 1000;
    return data.clientes
      .filter((c) => !c.ultima_compra_at || new Date(c.ultima_compra_at).getTime() < limite)
      .map((c) => ({
        nome: c.nome,
        rep: data.reps.find((r) => r.id === c.representante_id)?.nome ?? "—",
        ultima: c.ultima_compra_at ? formatarData(c.ultima_compra_at) : "Nunca",
      }))
      .sort((a, b) => a.nome.localeCompare(b.nome));
  }, [data]);

  const novos = useMemo(() => {
    if (!data) return [];
    const firstByCliente = new Map<string, string>();
    for (const p of [...data.pedidosTodos].sort((a, b) => a.data_pedido.localeCompare(b.data_pedido))) {
      if (!firstByCliente.has(p.cliente_id)) firstByCliente.set(p.cliente_id, p.data_pedido);
    }
    const mm = String(mes).padStart(2, "0");
    return data.clientes
      .filter((c) => {
        const f = firstByCliente.get(c.id);
        return f && f.startsWith(`${ano}-${mm}`);
      })
      .map((c) => ({
        nome: c.nome,
        rep: data.reps.find((r) => r.id === c.representante_id)?.nome ?? "—",
        primeira: firstByCliente.get(c.id) ?? "",
      }));
  }, [data, mes, ano]);

  const ranking = useMemo(() => {
    if (!data) return [];
    const agg = new Map<string, { total: number; pedidos: number }>();
    for (const p of data.pedidosMes) {
      const r = agg.get(p.cliente_id) ?? { total: 0, pedidos: 0 };
      r.total += Number(p.valor_produtos);
      r.pedidos += 1;
      agg.set(p.cliente_id, r);
    }
    return [...agg.entries()]
      .map(([cid, v]) => {
        const cli = data.clientes.find((c) => c.id === cid);
        return {
          nome: cli?.nome ?? "—",
          rep: data.reps.find((r) => r.id === cli?.representante_id)?.nome ?? "—",
          total: v.total,
          pedidos: v.pedidos,
        };
      })
      .sort((a, b) => b.total - a.total);
  }, [data]);

  const handleCSV = () => {
    exportCSV(
      `clientes-${ano}-${String(mes).padStart(2, "0")}`,
      ["Seção", "Cliente", "Representante", "Info1", "Info2"],
      [
        ...inativos.map((c) => ["Inativo", c.nome, c.rep, `Última: ${c.ultima}`, ""]),
        ...novos.map((c) => ["Novo no período", c.nome, c.rep, `Primeira: ${c.primeira}`, ""]),
        ...ranking.map((c) => ["Ranking", c.nome, c.rep, c.total.toFixed(2), c.pedidos]),
      ],
    );
  };
  const handlePDF = () => {
    exportPDF(
      `clientes-${ano}-${String(mes).padStart(2, "0")}`,
      `Relatório de Clientes - ${periodo}`,
      ["Seção", "Cliente", "Representante", "Detalhe", "Pedidos"],
      [
        ...inativos.map((c) => ["Inativo", c.nome, c.rep, `Última: ${c.ultima}`, ""]),
        ...novos.map((c) => ["Novo", c.nome, c.rep, `Primeira: ${c.primeira}`, ""]),
        ...ranking.map((c) => ["Ranking", c.nome, c.rep, fmtBRL(c.total), c.pedidos]),
      ],
    );
  };

  if (isLoading || !data) return <p className="text-muted-foreground">Carregando…</p>;

  return (
    <>
      <div className="flex justify-end">
        <ExportButtons onCSV={handleCSV} onPDF={handlePDF} />
      </div>

      <Card>
        <CardHeader><CardTitle>Clientes inativos (mais de 120 dias)</CardTitle></CardHeader>
        <CardContent>
          {inativos.length === 0 ? (
            <p className="text-muted-foreground">Nenhum cliente inativo.</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Cliente</TableHead>
                  <TableHead>Representante</TableHead>
                  <TableHead>Última compra</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {inativos.map((c, i) => (
                  <TableRow key={i}>
                    <TableCell className="font-medium">{c.nome}</TableCell>
                    <TableCell>{c.rep}</TableCell>
                    <TableCell>{c.ultima}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle>Clientes novos no período</CardTitle></CardHeader>
        <CardContent>
          {novos.length === 0 ? (
            <p className="text-muted-foreground">Nenhum cliente novo no período.</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Cliente</TableHead>
                  <TableHead>Representante</TableHead>
                  <TableHead>Primeira compra</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {novos.map((c, i) => (
                  <TableRow key={i}>
                    <TableCell className="font-medium">{c.nome}</TableCell>
                    <TableCell>{c.rep}</TableCell>
                    <TableCell>{c.primeira}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle>Ranking por volume no período</CardTitle></CardHeader>
        <CardContent>
          {ranking.length === 0 ? (
            <p className="text-muted-foreground">Sem compras no período.</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Cliente</TableHead>
                  <TableHead>Representante</TableHead>
                  <TableHead className="text-right">Total Comprado</TableHead>
                  <TableHead className="text-right">Pedidos</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {ranking.map((c, i) => (
                  <TableRow key={i}>
                    <TableCell className="font-medium">{c.nome}</TableCell>
                    <TableCell>{c.rep}</TableCell>
                    <TableCell className="text-right">{fmtBRL(c.total)}</TableCell>
                    <TableCell className="text-right">{c.pedidos}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </>
  );
}
