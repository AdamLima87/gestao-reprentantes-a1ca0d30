import { createFileRoute } from "@tanstack/react-router";
import { motion } from "framer-motion";
import { MotionTableRow, rowMotionProps } from "@/components/MotionTableRow";
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
import { SortableTableHead } from "@/components/ui/sortable-table-head";
import { useSortableData } from "@/hooks/use-sortable-data";
import { Badge } from "@/components/ui/badge";
import { StatusBadge } from "@/lib/status-badge";
import { Download, FileText, MessageSquareText, Mail } from "lucide-react";
import {
  Tooltip as UiTooltip,
  TooltipContent as UiTooltipContent,
  TooltipProvider as UiTooltipProvider,
  TooltipTrigger as UiTooltipTrigger,
} from "@/components/ui/tooltip";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { toast } from "sonner";
import { fmtBRL, exportCSV, exportPDF } from "@/lib/export-utils";
import * as XLSX from "xlsx";

export const Route = createFileRoute("/_authenticated/relatorios")({
  component: RelatoriosPage,
});

const TIPO_LABEL: Record<string, string> = {
  externo: "Representante",
  interno_sobre_rep: "Vend. Interno — Sobre Rep.",
  interno_novo: "Vend. Interno - Cliente Novo",
  interno_reativacao: "Vend. Interno - Reativação",
  interno_recorrente: "Vend. Interno - Recorrente",
};

const MESES = [
  "Jan", "Fev", "Mar", "Abr", "Mai", "Jun",
  "Jul", "Ago", "Set", "Out", "Nov", "Dez",
];

function RelatoriosPage() {
  
  const { can } = usePermissions();
  const canVer = can("ver_relatorios");
  const now = new Date();
  const [mes, setMes] = useState(now.getMonth() + 1);
  const [ano, setAno] = useState(now.getFullYear());

  if (!canVer) {
    return <p className="text-muted-foreground">Você não tem permissão para acessar relatórios.</p>;
  }


  return (
    <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.3, ease: "easeOut" }} className="space-y-4">
      <h1 className="text-2xl font-bold border-l-4 border-[#d97706] pl-3">Relatórios</h1>

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

      <Tabs defaultValue="geral">
        <TabsList>
          <TabsTrigger value="geral">Comissões Geral</TabsTrigger>
          <TabsTrigger value="comissoes">Comissões</TabsTrigger>
          <TabsTrigger value="vendas">Vendas</TabsTrigger>
          <TabsTrigger value="pedidos">Pedidos</TabsTrigger>
          <TabsTrigger value="nfe">NF-e</TabsTrigger>
          <TabsTrigger value="clientes">Clientes</TabsTrigger>
        </TabsList>

        <TabsContent value="geral" className="space-y-4 mt-4">
          <ComissoesGeralTab mes={mes} ano={ano} />
        </TabsContent>
        <TabsContent value="comissoes" className="space-y-4 mt-4">
          <ComissoesTab mes={mes} ano={ano} />
        </TabsContent>
        <TabsContent value="vendas" className="space-y-4 mt-4">
          <VendasTab mes={mes} ano={ano} />
        </TabsContent>
        <TabsContent value="pedidos" className="space-y-4 mt-4">
          <PedidosTab mes={mes} ano={ano} />
        </TabsContent>
        <TabsContent value="nfe" className="space-y-4 mt-4">
          <NfeTab mes={mes} ano={ano} />
        </TabsContent>
        <TabsContent value="clientes" className="space-y-4 mt-4">
          <ClientesTab mes={mes} ano={ano} />
        </TabsContent>
      </Tabs>
    </motion.div>
  );
}

type EmailExtratoPayload = {
  destinatarioNome: string;
  destinatarioEmail: string | null;
  mes: number;
  ano: number;
  buildPdfBase64: () => Promise<string>;
  target: { representante_id?: string; gestor_user_id?: string };
};

function ExportButtons({
  onCSV,
  onPDF,
  email,
}: {
  onCSV: () => void;
  onPDF: () => void;
  email?: EmailExtratoPayload | null;
}) {
  const { can } = usePermissions();
  const canExport = can("exportar_relatorios");
  const canEmail = can("enviar_extrato_email");
  const [open, setOpen] = useState(false);
  const [enviando, setEnviando] = useState(false);

  if (!canExport && !(canEmail && email)) return null;

  return (
    <div className="flex gap-2">
      {canExport && (
        <>
          <Button variant="outline" size="sm" onClick={onCSV}>
            <Download className="h-4 w-4 mr-1" /> CSV
          </Button>
          <Button variant="outline" size="sm" onClick={onPDF}>
            <FileText className="h-4 w-4 mr-1" /> PDF
          </Button>
        </>
      )}
      {canEmail && email && (
        <>
          <Button variant="outline" size="sm" onClick={() => setOpen(true)}>
            <Mail className="h-4 w-4 mr-1" /> Enviar por e-mail
          </Button>
          <Dialog open={open} onOpenChange={(o) => !enviando && setOpen(o)}>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Enviar extrato por e-mail</DialogTitle>
              </DialogHeader>
              <div className="space-y-2 text-sm">
                <p>
                  <span className="text-muted-foreground">Destinatário:</span>{" "}
                  <span className="font-medium">{email.destinatarioNome}</span>
                </p>
                <p>
                  <span className="text-muted-foreground">E-mail:</span>{" "}
                  <span className="font-medium">
                    {email.destinatarioEmail ?? (
                      email.target.gestor_user_id ? (
                        <em className="text-muted-foreground">será obtido do cadastro do gestor</em>
                      ) : (
                        <em className="text-red-600">não cadastrado</em>
                      )
                    )}
                  </span>
                </p>
                <p>
                  <span className="text-muted-foreground">Mês/Ano:</span>{" "}
                  <span className="font-medium">
                    {String(email.mes).padStart(2, "0")}/{email.ano}
                  </span>
                </p>
                <p className="text-xs text-muted-foreground pt-2">
                  O PDF do extrato será gerado e enviado em anexo.
                </p>
              </div>
              <DialogFooter>
                <Button variant="ghost" onClick={() => setOpen(false)} disabled={enviando}>
                  Cancelar
                </Button>
                <Button
                  disabled={enviando || (!email.destinatarioEmail && !email.target.gestor_user_id)}
                  onClick={async () => {
                    setEnviando(true);
                    try {
                      const pdf_base64 = await email.buildPdfBase64();
                      const { data: sess } = await supabase.auth.getSession();
                      const token = sess.session?.access_token;
                      const resp = await supabase.functions.invoke("enviar-extrato-email", {
                        body: {
                          ...email.target,
                          pdf_base64,
                          mes: email.mes,
                          ano: email.ano,
                        },
                        headers: token ? { Authorization: `Bearer ${token}` } : undefined,
                      });
                      if (resp.error) throw new Error(resp.error.message || "Falha ao enviar");
                      if ((resp.data as any)?.error) throw new Error((resp.data as any).error);
                      toast.success(`Extrato enviado para ${email.destinatarioEmail ?? email.destinatarioNome}`);
                      setOpen(false);
                    } catch (e: any) {
                      toast.error(e?.message ?? "Erro ao enviar e-mail");
                    } finally {
                      setEnviando(false);
                    }
                  }}
                >
                  {enviando ? "Enviando…" : "Confirmar envio"}
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </>
      )}
    </div>
  );
}

/* ============ COMISSÕES ============ */
type Visao = "todos" | "externos" | "interno" | "gestor";



function ComissoesGeralTab({ mes, ano }: { mes: number; ano: number }) {
  const [gerado, setGerado] = useState<{ mes: number; ano: number } | null>({ mes, ano });

  const mesRef = gerado?.mes ?? mes;
  const anoRef = gerado?.ano ?? ano;
  const periodo = `${String(mesRef).padStart(2, "0")}/${anoRef}`;

  const { data: logoBase64 } = useQuery({
    queryKey: ["empresa-logo"],
    queryFn: async () => {
      const res = await supabase.from("configuracoes_empresa").select("logo_base64").maybeSingle();
      return res.data?.logo_base64 ?? null;
    },
    staleTime: 5 * 60 * 1000,
  });

  const { data, isLoading } = useQuery({
    queryKey: ["rel-comissoes-geral", mesRef, anoRef, !!gerado],
    enabled: !!gerado,
    queryFn: async () => {
      const res = await supabase
        .from("comissoes")
        .select(
          "tipo, valor_comissao, percentual_aplicado, pago_em, representante_id, gestor_user_id, representantes(nome, tipo)",
        )
        .eq("mes_ref", mesRef)
        .eq("ano_ref", anoRef);
      return (res.data ?? []) as Array<{
        tipo: string;
        valor_comissao: number | string;
        percentual_aplicado: number | string;
        pago_em: string | null;
        representante_id: string | null;
        gestor_user_id: string | null;
        representantes: { nome?: string; tipo?: string } | null;
      }>;
    },
  });

  const gestorIds = useMemo(() => {
    const s = new Set<string>();
    for (const c of data ?? []) if (c.gestor_user_id) s.add(c.gestor_user_id);
    return [...s];
  }, [data]);

  const { data: gestores } = useQuery({
    queryKey: ["rel-comissoes-geral-gestores", gestorIds.sort().join(",")],
    enabled: gestorIds.length > 0,
    queryFn: async () => {
      const res = await supabase
        .from("profiles")
        .select("id, nome, percentual_comissao")
        .in("id", gestorIds);
      return (res.data ?? []) as { id: string; nome: string | null; percentual_comissao: number | null }[];
    },
  });

  type Linha = { nome: string; percentual: string; valor: number; pagos: number; pendentes: number };

  const linhas = useMemo<Linha[]>(() => {
    if (!data) return [];
    const externos = new Map<string, Linha>();
    const internoAcc: Linha = { nome: "Vendedor Interno", percentual: "—", valor: 0, pagos: 0, pendentes: 0 };
    const gestorMap = new Map<string, Linha>();

    for (const c of data) {
      const v = Number(c.valor_comissao ?? 0);
      const pago = !!c.pago_em;
      if (c.tipo === "externo" && c.representante_id) {
        const l = externos.get(c.representante_id) ?? {
          nome: c.representantes?.nome ?? "—",
          percentual: `${Number(c.percentual_aplicado ?? 0).toFixed(2)}%`,
          valor: 0,
          pagos: 0,
          pendentes: 0,
        };
        l.valor += v;
        if (pago) l.pagos += v; else l.pendentes += v;
        externos.set(c.representante_id, l);
      } else if (c.tipo?.startsWith("interno")) {
        if (c.representantes?.nome) internoAcc.nome = `Vendedor Interno — ${c.representantes.nome}`;
        internoAcc.valor += v;
        if (pago) internoAcc.pagos += v; else internoAcc.pendentes += v;
      } else if (c.tipo === "gestor" && c.gestor_user_id) {
        const g = gestores?.find((x) => x.id === c.gestor_user_id);
        const l = gestorMap.get(c.gestor_user_id) ?? {
          nome: `Gestor — ${g?.nome ?? "—"}`,
          percentual: `${Number(g?.percentual_comissao ?? c.percentual_aplicado ?? 0).toFixed(2)}%`,
          valor: 0,
          pagos: 0,
          pendentes: 0,
        };
        l.valor += v;
        if (pago) l.pagos += v; else l.pendentes += v;
        gestorMap.set(c.gestor_user_id, l);
      }
    }

    const arr: Linha[] = [];
    arr.push(...[...externos.values()].sort((a, b) => a.nome.localeCompare(b.nome)));
    if (internoAcc.valor > 0) arr.push(internoAcc);
    arr.push(...[...gestorMap.values()].sort((a, b) => a.nome.localeCompare(b.nome)));
    return arr;
  }, [data, gestores]);

  const totais = useMemo(() => {
    const t = linhas.reduce(
      (acc, l) => ({ valor: acc.valor + l.valor, pago: acc.pago + l.pagos, pendente: acc.pendente + l.pendentes }),
      { valor: 0, pago: 0, pendente: 0 },
    );
    return t;
  }, [linhas]);

  const statusOf = (l: Linha): { label: "Pago" | "Pendente" | "Parcial"; className: string } => {
    if (l.pagos > 0 && l.pendentes === 0) return { label: "Pago", className: "bg-green-100 text-green-800 border-green-300" };
    if (l.pendentes > 0 && l.pagos === 0) return { label: "Pendente", className: "bg-yellow-100 text-yellow-800 border-yellow-300" };
    return { label: "Parcial", className: "bg-orange-100 text-orange-800 border-orange-300" };
  };

  const handleExportPDF = async () => {
    const headers = ["Representante", "%", "Valor Comissão", "Status"];
    const rows: (string | number)[][] = linhas.map((l) => [l.nome, l.percentual, fmtBRL(l.valor), statusOf(l).label]);
    rows.push(["TOTAL GERAL", "", fmtBRL(totais.valor), `Pago ${fmtBRL(totais.pago)} • Pendente ${fmtBRL(totais.pendente)}`]);
    await exportPDF(
      `comissoes-geral-${mesRef}-${anoRef}`,
      "Relatório Geral de Comissões",
      headers,
      rows,
      `Período: ${periodo}`,
      { brand: true, logoBase64: logoBase64 ?? null },
    );
  };

  const handleExportXLSX = () => {
    const aoa: (string | number)[][] = [
      ["Relatório Geral de Comissões"],
      [`Período: ${periodo}`],
      [],
      ["Representante", "%", "Valor Comissão", "Status"],
    ];
    linhas.forEach((l) => aoa.push([l.nome, l.percentual, l.valor, statusOf(l).label]));
    aoa.push([]);
    aoa.push(["TOTAL GERAL", "", totais.valor, ""]);
    aoa.push(["Total Pago", "", totais.pago, ""]);
    aoa.push(["Total Pendente", "", totais.pendente, ""]);

    const ws = XLSX.utils.aoa_to_sheet(aoa);
    ws["!cols"] = [{ wch: 40 }, { wch: 10 }, { wch: 20 }, { wch: 14 }];
    const money = 'R$ #,##0.00;[Red]-R$ #,##0.00';
    const dataStart = 5;
    const dataEnd = dataStart + linhas.length - 1;
    for (let r = dataStart; r <= dataEnd; r++) {
      const cell = ws[XLSX.utils.encode_cell({ r: r - 1, c: 2 })];
      if (cell) cell.z = money;
    }
    const totalRow = dataEnd + 2;
    for (const rr of [totalRow, totalRow + 1, totalRow + 2]) {
      const cell = ws[XLSX.utils.encode_cell({ r: rr, c: 2 })];
      if (cell) cell.z = money;
    }
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Comissões");
    XLSX.writeFile(wb, `comissoes-geral-${mesRef}-${anoRef}.xlsx`);
  };

  return (
    <div className="space-y-4">
      <Card>
        <CardContent className="pt-6 flex flex-wrap items-end gap-3">
          <p className="text-sm text-muted-foreground">
            Use os filtros de <strong>Mês</strong> e <strong>Ano</strong> no topo da página e clique em Gerar relatório.
          </p>
          <div className="ml-auto flex gap-2">
            <Button onClick={() => setGerado({ mes, ano })}>Gerar relatório</Button>
            <Button variant="outline" onClick={handleExportPDF} disabled={!linhas.length}>
              <FileText className="w-4 h-4 mr-1" /> Exportar PDF
            </Button>
            <Button variant="outline" onClick={handleExportXLSX} disabled={!linhas.length}>
              <Download className="w-4 h-4 mr-1" /> Exportar Excel
            </Button>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Comissões — {periodo}</CardTitle>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <p className="text-muted-foreground">Carregando…</p>
          ) : linhas.length === 0 ? (
            <p className="text-muted-foreground">Nenhuma comissão encontrada para o período.</p>
          ) : (
            <>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Representante</TableHead>
                    <TableHead className="w-24">%</TableHead>
                    <TableHead className="w-40">Valor Comissão</TableHead>
                    <TableHead className="w-32">Status</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {linhas.map((l, i) => {
                    const s = statusOf(l);
                    return (
                      <MotionTableRow key={i} {...rowMotionProps(i)}>
                        <TableCell className="font-medium">{l.nome}</TableCell>
                        <TableCell>{l.percentual}</TableCell>
                        <TableCell>{fmtBRL(l.valor)}</TableCell>
                        <TableCell>
                          <Badge variant="outline" className={s.className}>{s.label}</Badge>
                        </TableCell>
                      </MotionTableRow>
                    );
                  })}
                  <TableRow className="bg-muted/60 font-bold">
                    <TableCell>TOTAL GERAL</TableCell>
                    <TableCell />
                    <TableCell>{fmtBRL(totais.valor)}</TableCell>
                    <TableCell />
                  </TableRow>
                </TableBody>
              </Table>

              <div className="mt-4 grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div className="rounded-lg border p-3">
                  <div className="text-xs text-muted-foreground">Total do mês</div>
                  <div className="text-lg font-bold">{fmtBRL(totais.valor)}</div>
                </div>
                <div className="rounded-lg border p-3 bg-green-50 dark:bg-green-950/20">
                  <div className="text-xs text-muted-foreground">Total Pago</div>
                  <div className="text-lg font-bold text-green-700 dark:text-green-400">{fmtBRL(totais.pago)}</div>
                </div>
                <div className="rounded-lg border p-3 bg-yellow-50 dark:bg-yellow-950/20">
                  <div className="text-xs text-muted-foreground">Total Pendente</div>
                  <div className="text-lg font-bold text-yellow-700 dark:text-yellow-400">{fmtBRL(totais.pendente)}</div>
                </div>
              </div>
            </>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

function ComissoesTab({ mes, ano }: { mes: number; ano: number }) {
  const [visao, setVisao] = useState<Visao>("todos");
  const [repFiltro, setRepFiltro] = useState<string>("todos");

  const { data, isLoading } = useQuery({
    queryKey: ["rel-comissoes", mes, ano],
    queryFn: async () => {
      const res = await supabase
        .from("comissoes")
        .select(
          "tipo, base_calculo, valor_comissao, percentual_aplicado, nfe_id, representante_id, gestor_user_id, representantes(nome, tipo), nfe(numero_nfe, data_nfe, data_entrega, pedidos(numero_pedido_cliente, clientes(nome)))",
        )
        .eq("mes_ref", mes)
        .eq("ano_ref", ano);
      return res.data ?? [];
    },
  });

  const { data: logoBase64 } = useQuery({
    queryKey: ["empresa-logo"],
    queryFn: async () => {
      const res = await supabase.from("configuracoes_empresa").select("logo_base64").maybeSingle();
      return res.data?.logo_base64 ?? null;
    },
    staleTime: 5 * 60 * 1000,
  });

  const { data: repsFull } = useQuery({
    queryKey: ["rel-comissoes-reps"],
    queryFn: async () => {
      const res = await supabase.from("representantes").select("id, nome, email, tipo");
      return (res.data ?? []) as { id: string; nome: string; email: string | null; tipo: string }[];
    },
    staleTime: 60_000,
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

  const internoRep = useMemo(
    () => (repsFull ?? []).find((r) => r.tipo === "interno") ?? null,
    [repsFull],
  );
  const emailByRepId = useMemo(() => {
    const m = new Map<string, string | null>();
    for (const r of repsFull ?? []) m.set(r.id, r.email);
    return m;
  }, [repsFull]);

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
                <SelectItem value="gestor">Gestor</SelectItem>
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
              emailByRepId={emailByRepId}
              logoBase64={logoBase64 ?? null}
            />
          )}
          {(visao === "todos" || visao === "interno") && (
            <InternoTable
              data={data ?? []}
              periodo={periodo}
              mes={mes}
              ano={ano}
              logoBase64={logoBase64 ?? null}
              internoRep={internoRep}
            />
          )}
          {(visao === "todos" || visao === "gestor") && (
            <GestorTable data={data ?? []} periodo={periodo} mes={mes} ano={ano} logoBase64={logoBase64 ?? null} />
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
  gestor_user_id?: string | null;
  representantes: { nome?: string; tipo?: string } | null;

  nfe: {
    numero_nfe?: string;
    data_nfe?: string;
    data_entrega?: string | null;
    pedidos?: { numero_pedido_cliente?: string | null; clientes?: { nome?: string } | null } | null;
  } | null;
};

function ExternosTable({
  data,
  periodo,
  mes,
  ano,
  repFiltro,
  repsOptions,
  emailByRepId,
  logoBase64,
}: {
  data: ComissaoRow[];
  periodo: string;
  mes: number;
  ano: number;
  repFiltro: string;
  repsOptions: { id: string; nome: string }[];
  emailByRepId: Map<string, string | null>;
  logoBase64: string | null;
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
        pedidoCliente: c.nfe?.pedidos?.numero_pedido_cliente ?? "—",
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

  const rowsSort = useSortableData(rows, {
    accessors: {
      rep: (r: any) => r.rep,
      tipo: (r: any) => r.tipo,
      nfes: (r: any) => r.nfes.size,
      base: (r: any) => r.base,
      valor: (r: any) => r.valor,
    },
  });
  const detailSort = useSortableData(detailRows, {
    accessors: {
      numero: (r: any) => r.numero,
      pedidoCliente: (r: any) => r.pedidoCliente,
      emissao: (r: any) => r.emissao,
      cliente: (r: any) => r.cliente,
      valor: (r: any) => r.valor,
      pct: (r: any) => r.pct,
      comissao: (r: any) => r.comissao,
    },
  });

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
        ["NF", "Nº Pedido Cliente", "Data Emissão", "Cliente", "Valor Produto", "%", "Comissão"],
        [
          ...detailRows.map((r) => [r.numero, r.pedidoCliente, formatarData(r.emissao), r.cliente, r.valor.toFixed(2), r.pct.toFixed(2), r.comissao.toFixed(2)]),
          ["TOTAL", "", "", "", detTotalBase.toFixed(2), "", detTotalCom.toFixed(2)],
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
        undefined,
        { brand: true, logoBase64 },
      );
    } else {
      exportPDF(
        `comissoes-${repNome}-${ano}-${String(mes).padStart(2, "0")}`,
        `Comissões - ${repNome} - ${periodo}`,
        ["NF", "Nº Pedido Cliente", "Data Emissão", "Cliente", "Valor Produto", "%", "Comissão"],
        [
          ...detailRows.map((r) => [r.numero, r.pedidoCliente, formatarData(r.emissao), r.cliente, fmtBRL(r.valor), `${r.pct.toFixed(2)}%`, fmtBRL(r.comissao)]),
          ["TOTAL", "", "", "", fmtBRL(detTotalBase), "", fmtBRL(detTotalCom)],
        ],
        undefined,
        { brand: true, logoBase64 },
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
        <ExportButtons
          onCSV={handleCSV}
          onPDF={handlePDF}
          email={
            isDetail && repFiltro
              ? {
                  destinatarioNome: repNome,
                  destinatarioEmail: emailByRepId.get(repFiltro) ?? null,
                  mes,
                  ano,
                  target: { representante_id: repFiltro },
                  buildPdfBase64: async () =>
                    (await exportPDF(
                      `comissoes-${repNome}-${ano}-${String(mes).padStart(2, "0")}`,
                      `Comissões - ${repNome} - ${periodo}`,
                      ["NF", "Nº Pedido Cliente", "Data Emissão", "Cliente", "Valor Produto", "%", "Comissão"],
                      [
                        ...detailRows.map((r) => [r.numero, r.pedidoCliente, formatarData(r.emissao), r.cliente, fmtBRL(r.valor), `${r.pct.toFixed(2)}%`, fmtBRL(r.comissao)]),
                        ["TOTAL", "", "", "", fmtBRL(detTotalBase), "", fmtBRL(detTotalCom)],
                      ],
                      undefined,
                      { brand: true, logoBase64, returnBase64: true },
                    )) as string,
                }
              : null
          }
        />
      </CardHeader>
      <CardContent className="space-y-4">
        <p className="text-sm font-medium text-muted-foreground">{modoLabel}</p>



        {!isDetail && (rows.length === 0 ? (
          <p className="text-muted-foreground">Sem comissões externas no período.</p>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <SortableTableHead sortKey="rep" sortConfig={rowsSort.sortConfig} onSort={rowsSort.requestSort}>Representante</SortableTableHead>
                <SortableTableHead sortKey="tipo" sortConfig={rowsSort.sortConfig} onSort={rowsSort.requestSort}>Tipo</SortableTableHead>
                <SortableTableHead sortKey="nfes" sortConfig={rowsSort.sortConfig} onSort={rowsSort.requestSort} className="text-right">Qtd NF-e</SortableTableHead>
                <SortableTableHead sortKey="base" sortConfig={rowsSort.sortConfig} onSort={rowsSort.requestSort} className="text-right">Base de Cálculo</SortableTableHead>
                <SortableTableHead sortKey="valor" sortConfig={rowsSort.sortConfig} onSort={rowsSort.requestSort} className="text-right">Comissão</SortableTableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {rowsSort.sortedData.map((r, i) => (
                <MotionTableRow key={i} {...rowMotionProps(i)}>
                  <TableCell className="font-medium">{r.rep}</TableCell>
                  <TableCell>{r.tipo}</TableCell>
                  <TableCell className="text-right">{r.nfes.size}</TableCell>
                  <TableCell className="text-right">{fmtBRL(r.base)}</TableCell>
                  <TableCell className="text-right font-medium">{fmtBRL(r.valor)}</TableCell>
                </MotionTableRow>
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
                <SortableTableHead sortKey="numero" sortConfig={detailSort.sortConfig} onSort={detailSort.requestSort}>NF</SortableTableHead>
                <SortableTableHead sortKey="pedidoCliente" sortConfig={detailSort.sortConfig} onSort={detailSort.requestSort}>Nº Pedido Cliente</SortableTableHead>
                <SortableTableHead sortKey="emissao" sortConfig={detailSort.sortConfig} onSort={detailSort.requestSort}>Data Emissão</SortableTableHead>
                <SortableTableHead sortKey="cliente" sortConfig={detailSort.sortConfig} onSort={detailSort.requestSort}>Cliente</SortableTableHead>
                <SortableTableHead sortKey="valor" sortConfig={detailSort.sortConfig} onSort={detailSort.requestSort} className="text-right">Valor Produto</SortableTableHead>
                <SortableTableHead sortKey="pct" sortConfig={detailSort.sortConfig} onSort={detailSort.requestSort} className="text-right">%</SortableTableHead>
                <SortableTableHead sortKey="comissao" sortConfig={detailSort.sortConfig} onSort={detailSort.requestSort} className="text-right">Comissão</SortableTableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {detailSort.sortedData.map((r, i) => (
                <MotionTableRow key={i} {...rowMotionProps(i)}>
                  <TableCell className="font-medium">{r.numero}</TableCell>
                  <TableCell>{r.pedidoCliente}</TableCell>
                  <TableCell>{formatarData(r.emissao)}</TableCell>
                  <TableCell>{r.cliente}</TableCell>
                  <TableCell className="text-right">{fmtBRL(r.valor)}</TableCell>
                  <TableCell className="text-right">{r.pct.toFixed(2)}%</TableCell>
                  <TableCell className="text-right font-medium">{fmtBRL(r.comissao)}</TableCell>
                </MotionTableRow>
              ))}
              <TableRow className="bg-muted/50 font-bold">
                <TableCell colSpan={4}>TOTAL</TableCell>
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
  logoBase64,
  internoRep,
}: {
  data: ComissaoRow[];
  periodo: string;
  mes: number;
  ano: number;
  logoBase64: string | null;
  internoRep: { id: string; nome: string; email: string | null } | null;
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
      pedidoCliente: string;
      emissao: string;
      empresa: string;
      entrega: string;
      valor: number;
      c15: number | null;
      c1: number | null;
      c05: number | null;
      p15: number | null;
      p1: number | null;
      p05: number | null;
    };
    const map = new Map<string, R>();
    for (const c of internas) {
      const r = map.get(c.nfe_id) ?? {
        nfeId: c.nfe_id,
        numero: c.nfe?.numero_nfe ?? "—",
        pedidoCliente: c.nfe?.pedidos?.numero_pedido_cliente ?? "—",
        emissao: c.nfe?.data_nfe ?? "",
        empresa: c.nfe?.pedidos?.clientes?.nome ?? "—",
        entrega: c.nfe?.data_entrega ?? "",
        valor: Number(c.base_calculo),
        c15: null,
        c1: null,
        c05: null,
        p15: null,
        p1: null,
        p05: null,
      };
      const valor = Number(c.valor_comissao);
      const pct = Number(c.percentual_aplicado);
      // Bucket pelo percentual aplicado (1,5% / 1% / 0,5%), independente do tipo
      if (pct >= 1.25) {
        r.c15 = (r.c15 ?? 0) + valor;
        r.p15 = pct;
      } else if (pct >= 0.75) {
        r.c1 = (r.c1 ?? 0) + valor;
        r.p1 = pct;
      } else {
        r.c05 = (r.c05 ?? 0) + valor;
        r.p05 = pct;
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

  const fmtPct = (n: number) => {
    const s = n.toFixed(2).replace(/\.?0+$/, "");
    return `${s.replace(".", ",")}%`;
  };
  const pctLabel = (key: "p15" | "p1" | "p05") => {
    const set = new Set<number>();
    for (const r of rows) {
      const v = r[key];
      if (v != null) set.add(Number(v));
    }
    if (set.size === 0) return "—";
    if (set.size === 1) return fmtPct([...set][0]);
    const arr = [...set].sort((a, b) => a - b);
    return `${fmtPct(arr[0])}–${fmtPct(arr[arr.length - 1])}`;
  };
  const hdrNovo = `Novo/Reativação (${pctLabel("p15")})`;
  const hdrRec = `Recorrente (${pctLabel("p1")})`;
  const hdrSobre = `Sobre Rep. (${pctLabel("p05")})`;

  const internoSort = useSortableData(rows, {
    accessors: {
      numero: (r: any) => r.numero,
      pedidoCliente: (r: any) => r.pedidoCliente,
      emissao: (r: any) => r.emissao,
      empresa: (r: any) => r.empresa,
      entrega: (r: any) => r.entrega,
      valor: (r: any) => r.valor,
      c15: (r: any) => r.c15 ?? -Infinity,
      c1: (r: any) => r.c1 ?? -Infinity,
      c05: (r: any) => r.c05 ?? -Infinity,
      total: (r: any) => (r.c15 ?? 0) + (r.c1 ?? 0) + (r.c05 ?? 0),
    },
  });

  const headers = ["NF", "Nº PEDIDO CLIENTE", "EMISSÃO", "EMPRESA", "ENTREGA", "$ PRODUTO", `COMISSÃO ${hdrNovo.toUpperCase()}`, `COMISSÃO ${hdrRec.toUpperCase()}`, `COMISSÃO ${hdrSobre.toUpperCase()}`, "TOTAL COMISSÃO"];


  const totalGeral = totals.c15 + totals.c1 + totals.c05;
  const summaryLine = `Total novo/reativação: ${fmtBRL(totals.c15)}  |  Total recorrente: ${fmtBRL(totals.c1)}  |  Total sobre representante: ${fmtBRL(totals.c05)}  |  Total geral: ${fmtBRL(totalGeral)}`;

  const handleCSV = () =>
    exportCSV(
      `comissoes-interno-${ano}-${String(mes).padStart(2, "0")}`,
      headers,
      [
        ...rows.map((r) => {
          const tot = (r.c15 ?? 0) + (r.c1 ?? 0) + (r.c05 ?? 0);
          return [
            r.numero,
            r.pedidoCliente,
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
            r.pedidoCliente,
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
          "",
          fmtBRL(totals.valor),
          fmtBRL(totals.c15),
          fmtBRL(totals.c1),
          fmtBRL(totals.c05),
          fmtBRL(totalGeral),
        ],
      ],
      `Período: ${periodo}  |  ${summaryLine}`,
      { brand: true, logoBase64 },
    );

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <CardTitle>Cálculo de Comissão — Vendedor Interno</CardTitle>
        <ExportButtons
          onCSV={handleCSV}
          onPDF={handlePDF}
          email={
            internoRep && rows.length > 0
              ? {
                  destinatarioNome: internoRep.nome,
                  destinatarioEmail: internoRep.email,
                  mes,
                  ano,
                  target: { representante_id: internoRep.id },
                  buildPdfBase64: async () =>
                    (await exportPDF(
                      `comissoes-interno-${ano}-${String(mes).padStart(2, "0")}`,
                      `BRAZIL AMORTECEDORES - CÁLCULO DE COMISSÃO POR REPRESENTANTE - ${vendedorNome.toUpperCase()}`,
                      headers,
                      [
                        ...rows.map((r) => {
                          const tot = (r.c15 ?? 0) + (r.c1 ?? 0) + (r.c05 ?? 0);
                          return [
                            r.numero,
                            r.pedidoCliente,
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
                          "",
                          fmtBRL(totals.valor),
                          fmtBRL(totals.c15),
                          fmtBRL(totals.c1),
                          fmtBRL(totals.c05),
                          fmtBRL(totalGeral),
                        ],
                      ],
                      `Período: ${periodo}  |  ${summaryLine}`,
                      { brand: true, logoBase64, returnBase64: true },
                    )) as string,
                }
              : null
          }
        />
      </CardHeader>
      <CardContent className="space-y-4">
        {rows.length === 0 ? (
          <p className="text-muted-foreground">Sem comissões internas no período.</p>
        ) : (
          <>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
              <div className="rounded-md border p-3">
                <div className="text-xs text-muted-foreground">Total novo/reativação</div>
                <div className="text-lg font-bold">{fmtBRL(totals.c15)}</div>
              </div>
              <div className="rounded-md border p-3">
                <div className="text-xs text-muted-foreground">Total recorrente</div>
                <div className="text-lg font-bold">{fmtBRL(totals.c1)}</div>
              </div>
              <div className="rounded-md border p-3">
                <div className="text-xs text-muted-foreground">Total sobre representante</div>
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
                  <SortableTableHead sortKey="numero" sortConfig={internoSort.sortConfig} onSort={internoSort.requestSort}>NF</SortableTableHead>
                  <SortableTableHead sortKey="pedidoCliente" sortConfig={internoSort.sortConfig} onSort={internoSort.requestSort}>Nº Pedido Cliente</SortableTableHead>
                  <SortableTableHead sortKey="emissao" sortConfig={internoSort.sortConfig} onSort={internoSort.requestSort}>Emissão</SortableTableHead>
                  <SortableTableHead sortKey="empresa" sortConfig={internoSort.sortConfig} onSort={internoSort.requestSort}>Empresa</SortableTableHead>
                  <SortableTableHead sortKey="entrega" sortConfig={internoSort.sortConfig} onSort={internoSort.requestSort}>Entrega</SortableTableHead>
                  <SortableTableHead sortKey="valor" sortConfig={internoSort.sortConfig} onSort={internoSort.requestSort} className="text-right">Valor Produto</SortableTableHead>
                  <SortableTableHead sortKey="c15" sortConfig={internoSort.sortConfig} onSort={internoSort.requestSort} className="text-right">{hdrNovo}</SortableTableHead>
                  <SortableTableHead sortKey="c1" sortConfig={internoSort.sortConfig} onSort={internoSort.requestSort} className="text-right">{hdrRec}</SortableTableHead>
                  <SortableTableHead sortKey="c05" sortConfig={internoSort.sortConfig} onSort={internoSort.requestSort} className="text-right">{hdrSobre}</SortableTableHead>
                  <SortableTableHead sortKey="total" sortConfig={internoSort.sortConfig} onSort={internoSort.requestSort} className="text-right">Total Comissão</SortableTableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {internoSort.sortedData.map((r, i) => {
                  const tot = (r.c15 ?? 0) + (r.c1 ?? 0) + (r.c05 ?? 0);
                  const cellPct = (v: number | null, p: number | null) =>
                    v == null ? "—" : (
                      <>
                        {fmtBRL(v)}
                        {p != null && <span className="text-xs text-muted-foreground ml-1">({fmtPct(p)})</span>}
                      </>
                    );
                  return (
                    <MotionTableRow key={r.nfeId} {...rowMotionProps(i)}>
                      <TableCell className="font-medium">{r.numero}</TableCell>
                      <TableCell>{r.pedidoCliente}</TableCell>
                      <TableCell>{formatarData(r.emissao)}</TableCell>
                      <TableCell>{r.empresa}</TableCell>
                      <TableCell>{formatarData(r.entrega)}</TableCell>
                      <TableCell className="text-right">{fmtBRL(r.valor)}</TableCell>
                      <TableCell className="text-right">{cellPct(r.c15, r.p15)}</TableCell>
                      <TableCell className="text-right">{cellPct(r.c1, r.p1)}</TableCell>
                      <TableCell className="text-right">{cellPct(r.c05, r.p05)}</TableCell>
                      <TableCell className="text-right font-medium">{fmtBRL(tot)}</TableCell>
                    </MotionTableRow>
                  );
                })}

                <TableRow className="bg-muted/50 font-bold">
                  <TableCell colSpan={5}>TOTAL</TableCell>
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

function GestorTable({
  data,
  periodo,
  mes,
  ano,
  logoBase64,
}: {
  data: ComissaoRow[];
  periodo: string;
  mes: number;
  ano: number;
  logoBase64: string | null;
}) {
  const gestorRows = useMemo(() => data.filter((c) => c.tipo === "gestor"), [data]);

  const { data: gestores } = useQuery({
    queryKey: ["gestores-profiles"],
    queryFn: async () => {
      const { data: roles } = await supabase.from("user_roles").select("user_id").eq("role", "gestor");
      const ids = (roles ?? []).map((r: any) => r.user_id);
      if (ids.length === 0) return [] as { id: string; nome: string }[];
      const { data: profs } = await supabase.from("profiles").select("id, nome").in("id", ids);
      return (profs ?? []) as { id: string; nome: string }[];
    },
    staleTime: 60_000,
  });

  const nomeOf = (id?: string | null) =>
    (gestores ?? []).find((g) => g.id === id)?.nome ?? "Gestor";

  const grupos = useMemo(() => {
    const map = new Map<string, ComissaoRow[]>();
    for (const r of gestorRows) {
      const key = r.gestor_user_id ?? "—";
      const list = map.get(key) ?? [];
      list.push(r);
      map.set(key, list);
    }
    return [...map.entries()].map(([id, rows]) => ({ id, nome: nomeOf(id), rows }));
  }, [gestorRows, gestores]);

  const totalGeral = gestorRows.reduce((s, r) => s + Number(r.valor_comissao), 0);
  const totalProdutos = gestorRows.reduce((s, r) => s + Number(r.base_calculo), 0);

  const handleCSV = () => {
    const linhas: (string | number)[][] = [];
    for (const g of grupos) {
      linhas.push([`Gestor: ${g.nome}`, "", "", "", "", ""]);
      for (const c of g.rows) {
        linhas.push([
          c.nfe?.numero_nfe ?? "—",
          formatarData(c.nfe?.data_nfe ?? ""),
          c.nfe?.pedidos?.clientes?.nome ?? "—",
          Number(c.base_calculo).toFixed(2),
          Number(c.percentual_aplicado).toFixed(2),
          Number(c.valor_comissao).toFixed(2),
        ]);
      }
      const sub = g.rows.reduce((s, r) => s + Number(r.valor_comissao), 0);
      const subProd = g.rows.reduce((s, r) => s + Number(r.base_calculo), 0);
      linhas.push([`Subtotal ${g.nome}`, "", "", subProd.toFixed(2), "", sub.toFixed(2)]);
    }
    linhas.push(["TOTAL GERAL", "", "", totalProdutos.toFixed(2), "", totalGeral.toFixed(2)]);
    exportCSV(
      `comissao-gestor-${ano}-${String(mes).padStart(2, "0")}`,
      ["NF-e", "Data", "Cliente", "Valor Produtos", "%", "Comissão"],
      linhas,
    );
  };

  const handlePDF = () => {
    const linhas: (string | number)[][] = [];
    for (const g of grupos) {
      linhas.push([{ content: `Gestor: ${g.nome}`, colSpan: 6, styles: { fontStyle: "bold", fillColor: [255, 248, 225] } } as any]);
      for (const c of g.rows) {
        linhas.push([
          c.nfe?.numero_nfe ?? "—",
          formatarData(c.nfe?.data_nfe ?? ""),
          c.nfe?.pedidos?.clientes?.nome ?? "—",
          fmtBRL(c.base_calculo),
          `${Number(c.percentual_aplicado).toFixed(2)}%`,
          fmtBRL(c.valor_comissao),
        ]);
      }
      const sub = g.rows.reduce((s, r) => s + Number(r.valor_comissao), 0);
      const subProd = g.rows.reduce((s, r) => s + Number(r.base_calculo), 0);
      linhas.push([
        { content: `Subtotal ${g.nome}`, colSpan: 3, styles: { fontStyle: "bold", halign: "right" } } as any,
        { content: fmtBRL(subProd), styles: { fontStyle: "bold" } } as any,
        "",
        { content: fmtBRL(sub), styles: { fontStyle: "bold" } } as any,
      ]);
    }
    linhas.push([
      { content: "TOTAL GERAL", colSpan: 3, styles: { fontStyle: "bold", halign: "right", fillColor: [232, 245, 233] } } as any,
      { content: fmtBRL(totalProdutos), styles: { fontStyle: "bold", fillColor: [232, 245, 233] } } as any,
      { content: "", styles: { fillColor: [232, 245, 233] } } as any,
      { content: fmtBRL(totalGeral), styles: { fontStyle: "bold", fillColor: [232, 245, 233] } } as any,
    ]);
    const tituloPrimario = grupos.length === 1 ? grupos[0].nome : "TODOS OS GESTORES";
    exportPDF(
      `comissao-gestor-${ano}-${String(mes).padStart(2, "0")}`,
      `BRAZIL AMORTECEDORES — COMISSÃO DO GESTOR — ${tituloPrimario} — ${periodo}`,
      ["NF-e", "Data", "Cliente", "Valor Produtos", "%", "Comissão"],
      linhas,
      undefined,
      { brand: true, logoBase64 },
    );
  };

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <CardTitle>Comissão do Gestor</CardTitle>
        <ExportButtons
          onCSV={handleCSV}
          onPDF={handlePDF}
          email={
            grupos.length === 1 && grupos[0].id !== "—"
              ? {
                  destinatarioNome: grupos[0].nome,
                  destinatarioEmail: null,
                  mes,
                  ano,
                  target: { gestor_user_id: grupos[0].id },
                  buildPdfBase64: async () => {
                    const linhas: (string | number)[][] = [];
                    for (const g of grupos) {
                      linhas.push([{ content: `Gestor: ${g.nome}`, colSpan: 6, styles: { fontStyle: "bold", fillColor: [255, 248, 225] } } as any]);
                      for (const c of g.rows) {
                        linhas.push([
                          c.nfe?.numero_nfe ?? "—",
                          formatarData(c.nfe?.data_nfe ?? ""),
                          c.nfe?.pedidos?.clientes?.nome ?? "—",
                          fmtBRL(c.base_calculo),
                          `${Number(c.percentual_aplicado).toFixed(2)}%`,
                          fmtBRL(c.valor_comissao),
                        ]);
                      }
                      const sub = g.rows.reduce((s, r) => s + Number(r.valor_comissao), 0);
                      const subProd = g.rows.reduce((s, r) => s + Number(r.base_calculo), 0);
                      linhas.push([
                        { content: `Subtotal ${g.nome}`, colSpan: 3, styles: { fontStyle: "bold", halign: "right" } } as any,
                        { content: fmtBRL(subProd), styles: { fontStyle: "bold" } } as any,
                        "",
                        { content: fmtBRL(sub), styles: { fontStyle: "bold" } } as any,
                      ]);
                    }
                    linhas.push([
                      { content: "TOTAL GERAL", colSpan: 3, styles: { fontStyle: "bold", halign: "right", fillColor: [232, 245, 233] } } as any,
                      { content: fmtBRL(totalProdutos), styles: { fontStyle: "bold", fillColor: [232, 245, 233] } } as any,
                      { content: "", styles: { fillColor: [232, 245, 233] } } as any,
                      { content: fmtBRL(totalGeral), styles: { fontStyle: "bold", fillColor: [232, 245, 233] } } as any,
                    ]);
                    return (await exportPDF(
                      `comissao-gestor-${ano}-${String(mes).padStart(2, "0")}`,
                      `BRAZIL AMORTECEDORES — COMISSÃO DO GESTOR — ${grupos[0].nome} — ${periodo}`,
                      ["NF-e", "Data", "Cliente", "Valor Produtos", "%", "Comissão"],
                      linhas,
                      undefined,
                      { brand: true, logoBase64, returnBase64: true },
                    )) as string;
                  },
                }
              : null
          }
        />
      </CardHeader>
      <CardContent className="space-y-4">
        <p className="text-sm font-medium text-muted-foreground">Período: {periodo}</p>
        {gestorRows.length === 0 ? (
          <p className="text-muted-foreground">Sem comissões de gestor no período.</p>
        ) : (
          <>
            {grupos.map((g, gi) => (
              <GestorRelGroup key={gi} nome={g.nome} rows={g.rows} />
            ))}
            <div className="rounded-md border p-3 bg-[#fff8e1] flex flex-wrap gap-4 justify-between items-center">
              <span className="font-semibold">Total Geral</span>
              <div className="flex gap-6 items-center">
                <div className="text-right">
                  <div className="text-xs uppercase tracking-wide text-[#92400e]/70">Valor Produtos</div>
                  <div className="text-lg font-bold text-[#92400e]">{fmtBRL(totalProdutos)}</div>
                </div>
                <div className="text-right">
                  <div className="text-xs uppercase tracking-wide text-[#92400e]/70">Comissão</div>
                  <div className="text-xl font-bold text-[#92400e]">{fmtBRL(totalGeral)}</div>
                </div>
              </div>
            </div>
          </>
        )}
      </CardContent>
    </Card>
  );
}

function GestorRelGroup({ nome, rows }: { nome: string; rows: any[] }) {
  const sort = useSortableData(rows, {
    accessors: {
      nfe: (c: any) => c.nfe?.numero_nfe ?? "",
      data: (c: any) => c.nfe?.data_nfe ?? "",
      cliente: (c: any) => c.nfe?.pedidos?.clientes?.nome ?? "",
      base_calculo: (c: any) => Number(c.base_calculo),
      percentual_aplicado: (c: any) => Number(c.percentual_aplicado),
      valor_comissao: (c: any) => Number(c.valor_comissao),
    },
  });
  const sub = rows.reduce((s, r) => s + Number(r.valor_comissao), 0);
  const subProd = rows.reduce((s, r) => s + Number(r.base_calculo), 0);
  return (
    <div className="space-y-2">
      <h3 className="text-sm font-semibold">{nome}</h3>
      <Table>
        <TableHeader>
          <TableRow>
            <SortableTableHead sortKey="nfe" sortConfig={sort.sortConfig} onSort={sort.requestSort}>NF-e</SortableTableHead>
            <SortableTableHead sortKey="data" sortConfig={sort.sortConfig} onSort={sort.requestSort}>Data</SortableTableHead>
            <SortableTableHead sortKey="cliente" sortConfig={sort.sortConfig} onSort={sort.requestSort}>Cliente</SortableTableHead>
            <SortableTableHead sortKey="base_calculo" sortConfig={sort.sortConfig} onSort={sort.requestSort} className="text-right">Valor Produtos</SortableTableHead>
            <SortableTableHead sortKey="percentual_aplicado" sortConfig={sort.sortConfig} onSort={sort.requestSort} className="text-right">%</SortableTableHead>
            <SortableTableHead sortKey="valor_comissao" sortConfig={sort.sortConfig} onSort={sort.requestSort} className="text-right">Comissão</SortableTableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {sort.sortedData.map((c: any, i: number) => (
            <MotionTableRow key={i} {...rowMotionProps(i)}>
              <TableCell className="font-mono text-xs">{c.nfe?.numero_nfe ?? "—"}</TableCell>
              <TableCell>{formatarData(c.nfe?.data_nfe ?? "")}</TableCell>
              <TableCell>{c.nfe?.pedidos?.clientes?.nome ?? "—"}</TableCell>
              <TableCell className="text-right">{fmtBRL(c.base_calculo)}</TableCell>
              <TableCell className="text-right">{Number(c.percentual_aplicado).toFixed(2)}%</TableCell>
              <TableCell className="text-right font-medium">{fmtBRL(c.valor_comissao)}</TableCell>
            </MotionTableRow>
          ))}
          <TableRow className="bg-muted/50 font-bold">
            <TableCell colSpan={3} className="text-right">Subtotal {nome}</TableCell>
            <TableCell className="text-right">{fmtBRL(subProd)}</TableCell>
            <TableCell />
            <TableCell className="text-right">{fmtBRL(sub)}</TableCell>
          </TableRow>
        </TableBody>
      </Table>
    </div>
  );
}





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

  const rankingSort = useSortableData(ranking, {
    accessors: {
      nome: (r: any) => r.nome,
      total: (r: any) => r.total,
      pedidos: (r: any) => r.pedidos,
      ticket: (r: any) => r.ticket,
      pct: (r: any) => r.pct,
    },
  });

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
                  <SortableTableHead sortKey="nome" sortConfig={rankingSort.sortConfig} onSort={rankingSort.requestSort}>Representante</SortableTableHead>
                  <SortableTableHead sortKey="total" sortConfig={rankingSort.sortConfig} onSort={rankingSort.requestSort} className="text-right">Total Vendido</SortableTableHead>
                  <SortableTableHead sortKey="pedidos" sortConfig={rankingSort.sortConfig} onSort={rankingSort.requestSort} className="text-right">Pedidos</SortableTableHead>
                  <SortableTableHead sortKey="ticket" sortConfig={rankingSort.sortConfig} onSort={rankingSort.requestSort} className="text-right">Ticket Médio</SortableTableHead>
                  <SortableTableHead sortKey="pct" sortConfig={rankingSort.sortConfig} onSort={rankingSort.requestSort} className="text-right">% do Total</SortableTableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {rankingSort.sortedData.map((r, i) => (
                  <MotionTableRow key={i} {...rowMotionProps(i)}>
                    <TableCell>{i + 1}</TableCell>
                    <TableCell className="font-medium">{r.nome}</TableCell>
                    <TableCell className="text-right">{fmtBRL(r.total)}</TableCell>
                    <TableCell className="text-right">{r.pedidos}</TableCell>
                    <TableCell className="text-right">{fmtBRL(r.ticket)}</TableCell>
                    <TableCell className="text-right">{r.pct.toFixed(1)}%</TableCell>
                  </MotionTableRow>
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

  const pedidosSort = useSortableData(filtered, {
    accessors: {
      numero_pedido: (p: any) => p.numero_pedido ?? "",
      cliente: (p: any) => p.clientes?.nome ?? "",
      representante: (p: any) => p.representantes?.nome ?? "",
      data_pedido: (p: any) => p.data_pedido ?? "",
      prazo_entrega: (p: any) => p.prazo_entrega ?? "",
      valor_produtos: (p: any) => Number(p.valor_produtos),
      status: (p: any) => p.status ?? "",
    },
  });

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
                  <SortableTableHead sortKey="numero_pedido" sortConfig={pedidosSort.sortConfig} onSort={pedidosSort.requestSort}>Nº Pedido</SortableTableHead>
                  <SortableTableHead sortKey="cliente" sortConfig={pedidosSort.sortConfig} onSort={pedidosSort.requestSort}>Cliente</SortableTableHead>
                  <SortableTableHead sortKey="representante" sortConfig={pedidosSort.sortConfig} onSort={pedidosSort.requestSort}>Representante</SortableTableHead>
                  <SortableTableHead sortKey="data_pedido" sortConfig={pedidosSort.sortConfig} onSort={pedidosSort.requestSort}>Data</SortableTableHead>
                  <SortableTableHead sortKey="prazo_entrega" sortConfig={pedidosSort.sortConfig} onSort={pedidosSort.requestSort}>Prazo</SortableTableHead>
                  <SortableTableHead sortKey="valor_produtos" sortConfig={pedidosSort.sortConfig} onSort={pedidosSort.requestSort} className="text-right">Valor</SortableTableHead>
                  <SortableTableHead sortKey="status" sortConfig={pedidosSort.sortConfig} onSort={pedidosSort.requestSort}>Status</SortableTableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {pedidosSort.sortedData.map((p, i) => (
                  <MotionTableRow key={i} {...rowMotionProps(i)}>
                    <TableCell className="font-medium">{p.numero_pedido}</TableCell>
                    <TableCell>{(p.clientes as { nome?: string } | null)?.nome ?? "—"}</TableCell>
                    <TableCell>{(p.representantes as { nome?: string } | null)?.nome ?? "—"}</TableCell>
                    <TableCell>{formatarData(p.data_pedido)}</TableCell>
                    <TableCell>{formatarData(p.prazo_entrega)}</TableCell>
                    <TableCell className="text-right">{fmtBRL(p.valor_produtos)}</TableCell>
                    <TableCell><StatusBadge status={p.status} /></TableCell>
                  </MotionTableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </>
  );
}

/* ============ NF-e ============ */
function formatCNPJ(cnpj?: string | null) {
  if (!cnpj) return "—";
  const d = String(cnpj).replace(/\D/g, "");
  if (d.length !== 14) return cnpj;
  return `${d.slice(0, 2)}.${d.slice(2, 5)}.${d.slice(5, 8)}/${d.slice(8, 12)}-${d.slice(12)}`;
}

function NfeTab({ mes, ano }: { mes: number; ano: number }) {
  const { data: logoBase64 } = useQuery({
    queryKey: ["empresa-logo"],
    queryFn: async () => {
      const res = await supabase.from("configuracoes_empresa").select("logo_base64").maybeSingle();
      return (res.data as { logo_base64?: string | null } | null)?.logo_base64 ?? null;
    },
  });

  const { data, isLoading } = useQuery({
    queryKey: ["rel-nfe", mes, ano],
    queryFn: async () => {
      const res = await supabase
        .from("nfe")
        .select("numero_nfe, data_nfe, valor_nfe, mes_ref, ano_ref, observacao, pedidos(valor_produtos, clientes(nome, cnpj))")
        .eq("mes_ref", mes).eq("ano_ref", ano)
        .order("data_nfe", { ascending: true });
      return res.data ?? [];
    },
  });

  const notas = data ?? [];
  const periodo = `${String(mes).padStart(2, "0")}/${ano}`;

  const totalCount = notas.length;
  const totalProdutos = notas.reduce(
    (s, n) => s + Number((n.pedidos as { valor_produtos?: number } | null)?.valor_produtos ?? 0),
    0,
  );
  const totalNfe = notas.reduce((s, n) => s + Number(n.valor_nfe ?? 0), 0);
  const diferenca = totalNfe - totalProdutos;

  const notasSort = useSortableData(notas, {
    accessors: {
      numero_nfe: (n: any) => n.numero_nfe ?? "",
      data_nfe: (n: any) => n.data_nfe ?? "",
      cnpj: (n: any) => n.pedidos?.clientes?.cnpj ?? "",
      cliente: (n: any) => n.pedidos?.clientes?.nome ?? "",
      valor_produtos: (n: any) => Number(n.pedidos?.valor_produtos ?? 0),
      valor_nfe: (n: any) => Number(n.valor_nfe ?? 0),
      observacao: (n: any) => n.observacao ?? "",
    },
  });

  const handleCSV = () =>
    exportCSV(
      `nfe-${ano}-${String(mes).padStart(2, "0")}`,
      ["Nº NF-e", "Data Emissão", "CNPJ", "Cliente", "Valor Produtos", "Valor NF-e", "Observação"],
      [
        ...notas.map((n) => {
          const ped = n.pedidos as { valor_produtos?: number; clientes?: { nome?: string; cnpj?: string } | null } | null;
          return [
            n.numero_nfe,
            formatarData(n.data_nfe),
            formatCNPJ(ped?.clientes?.cnpj),
            ped?.clientes?.nome ?? "—",
            Number(ped?.valor_produtos ?? 0).toFixed(2),
            Number(n.valor_nfe ?? 0).toFixed(2),
            n.observacao ?? "",
          ];
        }),
        ["TOTAL", String(totalCount), "", "", totalProdutos.toFixed(2), totalNfe.toFixed(2), ""],
      ],
    );

  const handlePDF = () =>
    exportPDF(
      `nfe-${ano}-${String(mes).padStart(2, "0")}`,
      `Relatório de NF-es — ${periodo}`,
      ["Nº NF-e", "Data Emissão", "CNPJ", "Cliente", "Valor Produtos", "Valor NF-e", "Obs"],
      [
        ...notas.map((n) => {
          const ped = n.pedidos as { valor_produtos?: number; clientes?: { nome?: string; cnpj?: string } | null } | null;
          return [
            n.numero_nfe,
            formatarData(n.data_nfe),
            formatCNPJ(ped?.clientes?.cnpj),
            ped?.clientes?.nome ?? "—",
            fmtBRL(ped?.valor_produtos ?? 0),
            fmtBRL(n.valor_nfe ?? 0),
            n.observacao ? "Sim" : "",
          ];
        }),
        ["TOTAL", String(totalCount), "", "", fmtBRL(totalProdutos), fmtBRL(totalNfe), ""],
      ],
      undefined,
      { brand: true, logoBase64 : logoBase64 ?? null },
    );

  return (
    <UiTooltipProvider>
      <div className={`grid grid-cols-1 gap-3 ${Math.abs(diferenca) > 0.005 ? "md:grid-cols-4" : "md:grid-cols-3"}`}>
        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-xs uppercase">Total de NF-es emitidas</CardTitle></CardHeader>
          <CardContent><div className="text-2xl font-bold">{totalCount}</div></CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-xs uppercase">Total Valor Produtos</CardTitle></CardHeader>
          <CardContent><div className="text-2xl font-bold">{fmtBRL(totalProdutos)}</div></CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-xs uppercase">Total Valor NF-e</CardTitle></CardHeader>
          <CardContent><div className="text-2xl font-bold">{fmtBRL(totalNfe)}</div></CardContent>
        </Card>
        {Math.abs(diferenca) > 0.005 && (
          <Card className="border-yellow-500 bg-yellow-50 dark:bg-yellow-950/30">
            <CardHeader className="pb-2"><CardTitle className="text-xs uppercase text-yellow-700 dark:text-yellow-400">Diferença (NF-e vs Produtos)</CardTitle></CardHeader>
            <CardContent><div className="text-2xl font-bold text-yellow-700 dark:text-yellow-400">{fmtBRL(diferenca)}</div></CardContent>
          </Card>
        )}
      </div>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between gap-3 flex-wrap">
          <CardTitle>NF-es do período</CardTitle>
          <ExportButtons onCSV={handleCSV} onPDF={handlePDF} />
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <p className="text-muted-foreground">Carregando…</p>
          ) : notas.length === 0 ? (
            <p className="text-muted-foreground">Nenhuma NF-e no período.</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <SortableTableHead sortKey="numero_nfe" sortConfig={notasSort.sortConfig} onSort={notasSort.requestSort}>Nº NF-e</SortableTableHead>
                  <SortableTableHead sortKey="data_nfe" sortConfig={notasSort.sortConfig} onSort={notasSort.requestSort}>Data Emissão</SortableTableHead>
                  <SortableTableHead sortKey="cnpj" sortConfig={notasSort.sortConfig} onSort={notasSort.requestSort}>CNPJ</SortableTableHead>
                  <SortableTableHead sortKey="cliente" sortConfig={notasSort.sortConfig} onSort={notasSort.requestSort}>Cliente</SortableTableHead>
                  <SortableTableHead sortKey="valor_produtos" sortConfig={notasSort.sortConfig} onSort={notasSort.requestSort} className="text-right">Valor Produtos</SortableTableHead>
                  <SortableTableHead sortKey="valor_nfe" sortConfig={notasSort.sortConfig} onSort={notasSort.requestSort} className="text-right">Valor NF-e</SortableTableHead>
                  <SortableTableHead sortKey="observacao" sortConfig={notasSort.sortConfig} onSort={notasSort.requestSort}>Obs</SortableTableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {notasSort.sortedData.map((n, i) => {
                  const ped = n.pedidos as { valor_produtos?: number; clientes?: { nome?: string; cnpj?: string } | null } | null;
                  return (
                    <MotionTableRow key={i} {...rowMotionProps(i)}>
                      <TableCell className="font-medium">{n.numero_nfe}</TableCell>
                      <TableCell>{formatarData(n.data_nfe)}</TableCell>
                      <TableCell>{formatCNPJ(ped?.clientes?.cnpj)}</TableCell>
                      <TableCell>{ped?.clientes?.nome ?? "—"}</TableCell>
                      <TableCell className="text-right">{fmtBRL(ped?.valor_produtos ?? 0)}</TableCell>
                      <TableCell className="text-right">{fmtBRL(n.valor_nfe ?? 0)}</TableCell>
                      <TableCell>
                        {n.observacao ? (
                          <UiTooltip>
                            <UiTooltipTrigger asChild>
                              <button type="button" className="text-muted-foreground hover:text-foreground">
                                <MessageSquareText className="h-4 w-4" />
                              </button>
                            </UiTooltipTrigger>
                            <UiTooltipContent className="max-w-xs whitespace-pre-wrap">{n.observacao}</UiTooltipContent>
                          </UiTooltip>
                        ) : null}
                      </TableCell>
                    </MotionTableRow>
                  );
                })}
                <TableRow className="font-bold bg-muted/50">
                  <TableCell>TOTAL</TableCell>
                  <TableCell>{totalCount} NF-e</TableCell>
                  <TableCell />
                  <TableCell />
                  <TableCell className="text-right">{fmtBRL(totalProdutos)}</TableCell>
                  <TableCell className="text-right">{fmtBRL(totalNfe)}</TableCell>
                  <TableCell />
                </TableRow>
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </UiTooltipProvider>
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

  const inativosSort = useSortableData(inativos, {
    accessors: { nome: (c: any) => c.nome, rep: (c: any) => c.rep, ultima: (c: any) => c.ultima },
  });
  const novosSort = useSortableData(novos, {
    accessors: { nome: (c: any) => c.nome, rep: (c: any) => c.rep, primeira: (c: any) => c.primeira },
  });
  const rankingSort = useSortableData(ranking, {
    accessors: { nome: (c: any) => c.nome, rep: (c: any) => c.rep, total: (c: any) => c.total, pedidos: (c: any) => c.pedidos },
  });

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
                  <SortableTableHead sortKey="nome" sortConfig={inativosSort.sortConfig} onSort={inativosSort.requestSort}>Cliente</SortableTableHead>
                  <SortableTableHead sortKey="rep" sortConfig={inativosSort.sortConfig} onSort={inativosSort.requestSort}>Representante</SortableTableHead>
                  <SortableTableHead sortKey="ultima" sortConfig={inativosSort.sortConfig} onSort={inativosSort.requestSort}>Última compra</SortableTableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {inativosSort.sortedData.map((c, i) => (
                  <MotionTableRow key={i} {...rowMotionProps(i)}>
                    <TableCell className="font-medium">{c.nome}</TableCell>
                    <TableCell>{c.rep}</TableCell>
                    <TableCell>{c.ultima}</TableCell>
                  </MotionTableRow>
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
                  <SortableTableHead sortKey="nome" sortConfig={novosSort.sortConfig} onSort={novosSort.requestSort}>Cliente</SortableTableHead>
                  <SortableTableHead sortKey="rep" sortConfig={novosSort.sortConfig} onSort={novosSort.requestSort}>Representante</SortableTableHead>
                  <SortableTableHead sortKey="primeira" sortConfig={novosSort.sortConfig} onSort={novosSort.requestSort}>Primeira compra</SortableTableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {novosSort.sortedData.map((c, i) => (
                  <MotionTableRow key={i} {...rowMotionProps(i)}>
                    <TableCell className="font-medium">{c.nome}</TableCell>
                    <TableCell>{c.rep}</TableCell>
                    <TableCell>{c.primeira}</TableCell>
                  </MotionTableRow>
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
                  <SortableTableHead sortKey="nome" sortConfig={rankingSort.sortConfig} onSort={rankingSort.requestSort}>Cliente</SortableTableHead>
                  <SortableTableHead sortKey="rep" sortConfig={rankingSort.sortConfig} onSort={rankingSort.requestSort}>Representante</SortableTableHead>
                  <SortableTableHead sortKey="total" sortConfig={rankingSort.sortConfig} onSort={rankingSort.requestSort} className="text-right">Total Comprado</SortableTableHead>
                  <SortableTableHead sortKey="pedidos" sortConfig={rankingSort.sortConfig} onSort={rankingSort.requestSort} className="text-right">Pedidos</SortableTableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {rankingSort.sortedData.map((c, i) => (
                  <MotionTableRow key={i} {...rowMotionProps(i)}>
                    <TableCell className="font-medium">{c.nome}</TableCell>
                    <TableCell>{c.rep}</TableCell>
                    <TableCell className="text-right">{fmtBRL(c.total)}</TableCell>
                    <TableCell className="text-right">{c.pedidos}</TableCell>
                  </MotionTableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </>
  );
}
