import { createFileRoute } from "@tanstack/react-router";
import { formatarData } from "@/lib/utils";
import { useQuery, useQueryClient, useMutation } from "@tanstack/react-query";
import { useState, useMemo } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { toast } from "sonner";
import { useAuth } from "@/hooks/use-auth";
import { usePermissions } from "@/hooks/use-permissions";
import { useServerFn } from "@tanstack/react-start";
import { reprocessarComissoes } from "@/lib/comissoes.functions";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import { fmtBRL as fmtBRLUtil } from "@/lib/export-utils";

export const Route = createFileRoute("/_authenticated/comissoes")({
  component: ComissoesPage,
});

const fmtBRL = (n: number | string) =>
  Number(n).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

const TIPO_LABEL: Record<string, string> = {
  externo: "Representante",
  interno_sobre_rep: "Vend. Interno 0,5%",
  interno_novo: "Vend. Interno - Cliente Novo",
  interno_reativacao: "Vend. Interno - Reativação",
  interno_recorrente: "Vend. Interno - Recorrente",
};

async function gerarExtratoPDF(
  repNome: string,
  mes: number,
  ano: number,
  rows: any[],
  totalPendente: number,
  totalPago: number,
) {
  const { data: empresa } = await supabase
    .from("configuracoes_empresa")
    .select("razao_social, logo_base64")
    .limit(1)
    .maybeSingle();

  const doc = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4" });
  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
  const margin = 20;
  doc.setFont("helvetica", "normal");
  doc.setFontSize(11);

  // Cabeçalho — logo + nome empresa
  let cursorY = margin;
  let textX = margin;
  if (empresa?.logo_base64) {
    try {
      const fmt = empresa.logo_base64.startsWith("data:image/png") ? "PNG" : "JPEG";
      doc.addImage(empresa.logo_base64, fmt, margin, cursorY, 20, 20);
      textX = margin + 25;
    } catch {
      /* ignora logo inválido */
    }
  }
  doc.setFont("helvetica", "bold");
  doc.setFontSize(14);
  doc.text(empresa?.razao_social ?? "Brazil Amortecedores", textX, cursorY + 7);
  doc.setFontSize(13);
  doc.text("EXTRATO DE COMISSÕES", textX, cursorY + 15);

  cursorY += 24;
  doc.setFont("helvetica", "normal");
  doc.setFontSize(11);
  doc.text(`Representante: ${repNome}`, margin, cursorY);
  const periodo = `Período: ${String(mes).padStart(2, "0")}/${ano}`;
  doc.text(periodo, pageWidth - margin, cursorY, { align: "right" });

  cursorY += 4;
  doc.setDrawColor(200);
  doc.line(margin, cursorY, pageWidth - margin, cursorY);

  // Tabela
  const totalBase = rows.reduce((s, c: any) => s + Number(c.base_calculo || 0), 0);
  const totalComissao = rows.reduce((s, c: any) => s + Number(c.valor_comissao || 0), 0);

  autoTable(doc, {
    startY: cursorY + 4,
    margin: { left: margin, right: margin },
    head: [["Nº Pedido", "Cliente", "Nº NF-e", "Data NF-e", "Base (R$)", "Tipo", "%", "Comissão (R$)"]],
    body: rows.map((c: any) => [
      c.pedidos?.numero_pedido ?? "—",
      c.pedidos?.clientes?.nome ?? "—",
      c.nfe?.numero_nfe ?? "—",
      formatarData(c.nfe?.data_emissao ?? c.criado_em),
      fmtBRLUtil(c.base_calculo),
      TIPO_LABEL[c.tipo] ?? c.tipo,
      `${Number(c.percentual_aplicado).toFixed(2)}%`,
      fmtBRLUtil(c.valor_comissao),
    ]),
    foot: [[
      { content: `Total de NF-es: ${rows.length}`, colSpan: 4, styles: { halign: "left", fontStyle: "bold" } },
      { content: fmtBRLUtil(totalBase), styles: { fontStyle: "bold" } },
      "",
      "",
      { content: fmtBRLUtil(totalComissao), styles: { fontStyle: "bold" } },
    ]],
    styles: { font: "helvetica", fontSize: 9, cellPadding: 2 },
    headStyles: { fillColor: [40, 40, 40], textColor: 255 },
    footStyles: { fillColor: [240, 240, 240], textColor: 20 },
    alternateRowStyles: { fillColor: [245, 245, 245] },
  });

  let afterTableY = (doc as any).lastAutoTable?.finalY ?? cursorY + 10;
  afterTableY += 8;

  // Blocos de totais
  const blockWidth = (pageWidth - margin * 2 - 6) / 2;
  doc.setDrawColor(180);
  doc.setFillColor(255, 247, 230);
  doc.rect(margin, afterTableY, blockWidth, 14, "FD");
  doc.setTextColor(180, 90, 0);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(11);
  doc.text(`Total pendente: ${fmtBRLUtil(totalPendente)}`, margin + 4, afterTableY + 9);

  doc.setFillColor(232, 245, 233);
  doc.rect(margin + blockWidth + 6, afterTableY, blockWidth, 14, "FD");
  doc.setTextColor(30, 110, 50);
  doc.text(`Total pago: ${fmtBRLUtil(totalPago)}`, margin + blockWidth + 10, afterTableY + 9);
  doc.setTextColor(0);

  // Rodapé
  doc.setFont("helvetica", "normal");
  doc.setFontSize(9);
  doc.setTextColor(120);
  const geradoEm = new Date().toLocaleString("pt-BR");
  doc.text(`Documento gerado em ${geradoEm}`, margin, pageHeight - margin + 5);
  doc.text("Brazil Amortecedores — gestao-reprentantes.lovable.app", pageWidth - margin, pageHeight - margin + 5, { align: "right" });

  const slug = repNome.normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^a-zA-Z0-9]+/g, "_");
  doc.save(`extrato_${slug}_${String(mes).padStart(2, "0")}_${ano}.pdf`);
}

function previsaoPagamento(mes: number, ano: number) {
  const next = mes === 12 ? { m: 1, a: ano + 1 } : { m: mes + 1, a: ano };
  return `${String(next.m).padStart(2, "0")}/${next.a}`;
}

function StatusBadge({ pago }: { pago: boolean }) {
  return pago ? (
    <Badge className="bg-green-600 hover:bg-green-700 text-white">Pago</Badge>
  ) : (
    <Badge className="bg-yellow-500 hover:bg-yellow-600 text-white">Pendente</Badge>
  );
}

function MarcarPagoDialog({ comissao, onDone }: { comissao: any; onDone: () => void }) {
  const [open, setOpen] = useState(false);
  const [data, setData] = useState(new Date().toISOString().slice(0, 10));
  const [obs, setObs] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [saving, setSaving] = useState(false);

  const submit = async () => {
    setSaving(true);
    try {
      let comprovante_url: string | null = null;
      if (file) {
        const path = `${comissao.id}/${Date.now()}-${file.name}`;
        const up = await supabase.storage.from("comprovantes-comissoes").upload(path, file, { upsert: false });
        if (up.error) throw up.error;
        comprovante_url = up.data.path;
      }
      const { error } = await supabase
        .from("comissoes")
        .update({ pago_em: data, observacao_pagamento: obs || null, comprovante_url })
        .eq("id", comissao.id);
      if (error) throw error;
      toast.success("Comissão marcada como paga.");
      setOpen(false);
      onDone();
    } catch (e: any) {
      toast.error(e.message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <Button size="sm" variant="outline" onClick={() => setOpen(true)}>Marcar como pago</Button>
      <DialogContent>
        <DialogHeader><DialogTitle>Marcar comissão como paga</DialogTitle></DialogHeader>
        <div className="space-y-3">
          <div>
            <Label>Data de pagamento</Label>
            <Input type="date" value={data} onChange={(e) => setData(e.target.value)} />
          </div>
          <div>
            <Label>Observação (opcional)</Label>
            <Textarea value={obs} onChange={(e) => setObs(e.target.value)} />
          </div>
          <div>
            <Label>Comprovante (PDF ou imagem, opcional)</Label>
            <Input type="file" accept="application/pdf,image/*" onChange={(e) => setFile(e.target.files?.[0] ?? null)} />
          </div>
        </div>
        <DialogFooter>
          <Button variant="ghost" onClick={() => setOpen(false)} disabled={saving}>Cancelar</Button>
          <Button onClick={submit} disabled={saving}>{saving ? "Salvando…" : "Confirmar pagamento"}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function ComprovanteLink({ path }: { path: string }) {
  const [loading, setLoading] = useState(false);
  const open = async () => {
    setLoading(true);
    const { data } = await supabase.storage.from("comprovantes-comissoes").createSignedUrl(path, 60);
    setLoading(false);
    if (data?.signedUrl) window.open(data.signedUrl, "_blank");
  };
  return <Button size="sm" variant="link" className="h-auto p-0" onClick={open} disabled={loading}>Ver comprovante</Button>;
}

function ComissoesPage() {
  const { roles, representanteId } = useAuth();
  const { can } = usePermissions();
  const isAdmin = roles.includes("admin");
  const isRepOnly =
    roles.includes("representante") &&
    !roles.some((r) => ["admin", "vendedor_interno", "financeiro"].includes(r));

  if (isRepOnly) return <PainelRepresentante representanteId={representanteId} />;

  const qc = useQueryClient();
  const callReprocessar = useServerFn(reprocessarComissoes);

  const reprocessar = useMutation({
    mutationFn: async () => callReprocessar(),
    onSuccess: (res: any) => {
      toast.success(`Reprocessado: ${res?.comissoes_geradas ?? 0} comissões geradas.`);
      qc.invalidateQueries({ queryKey: ["comissoes"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const now = new Date();
  const [mes, setMes] = useState(now.getMonth() + 1);
  const [ano, setAno] = useState(now.getFullYear());
  const [repFilter, setRepFilter] = useState<string>("todos");
  const [statusFilter, setStatusFilter] = useState<"todas" | "pendentes" | "pagas">("todas");

  const { data: reps } = useQuery({
    queryKey: ["reps"],
    queryFn: async () => (await supabase.from("representantes").select("id, nome").order("nome")).data ?? [],
  });

  const { data, isLoading } = useQuery({
    queryKey: ["comissoes", mes, ano, repFilter],
    queryFn: async () => {
      let q = supabase
        .from("comissoes")
        .select("*, representantes(nome), pedidos(numero_pedido, clientes(nome)), nfe(numero_nfe, valor_nfe)")
        .eq("mes_ref", mes).eq("ano_ref", ano)
        .order("criado_em", { ascending: false });
      if (repFilter !== "todos") q = q.eq("representante_id", repFilter);
      return (await q).data ?? [];
    },
  });

  const filtered = useMemo(() => {
    const rows = data ?? [];
    if (statusFilter === "pendentes") return rows.filter((c: any) => !c.pago_em);
    if (statusFilter === "pagas") return rows.filter((c: any) => c.pago_em);
    return rows;
  }, [data, statusFilter]);

  const totalPendente = (data ?? []).filter((c: any) => !c.pago_em).reduce((s, c: any) => s + Number(c.valor_comissao), 0);
  const totalPago = (data ?? []).filter((c: any) => c.pago_em).reduce((s, c: any) => s + Number(c.valor_comissao), 0);
  const totalVisivel = filtered.reduce((s: number, c: any) => s + Number(c.valor_comissao), 0);

  const canMarcarPago = can("marcar_comissao_paga");
  const canExportar = can("exportar_relatorios");

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Comissões</h1>
        {isAdmin && (
          <Button
            variant="outline"
            onClick={() => {
              if (confirm("Isso apaga todas as comissões e recalcula a partir das NF-e existentes. Continuar?")) {
                reprocessar.mutate();
              }
            }}
            disabled={reprocessar.isPending}
          >
            {reprocessar.isPending ? "Reprocessando…" : "Reprocessar comissões"}
          </Button>
        )}
      </div>

      <Card>
        <CardContent className="pt-6 flex flex-wrap gap-3">
          <div className="w-28"><Label className="text-xs">Mês</Label>
            <Select value={String(mes)} onValueChange={(v) => setMes(Number(v))}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>{Array.from({ length: 12 }, (_, i) => i + 1).map((m) => <SelectItem key={m} value={String(m)}>{String(m).padStart(2, "0")}</SelectItem>)}</SelectContent>
            </Select>
          </div>
          <div className="w-32"><Label className="text-xs">Ano</Label>
            <Select value={String(ano)} onValueChange={(v) => setAno(Number(v))}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>{[ano - 1, ano, ano + 1].map((a) => <SelectItem key={a} value={String(a)}>{a}</SelectItem>)}</SelectContent>
            </Select>
          </div>
          <div className="w-56"><Label className="text-xs">Representante</Label>
            <Select value={repFilter} onValueChange={setRepFilter}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="todos">Todos</SelectItem>
                {(reps ?? []).map((r) => <SelectItem key={r.id} value={r.id}>{r.nome}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div className="w-44"><Label className="text-xs">Status pagamento</Label>
            <Select value={statusFilter} onValueChange={(v) => setStatusFilter(v as any)}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="todas">Todas</SelectItem>
                <SelectItem value="pendentes">Pendentes</SelectItem>
                <SelectItem value="pagas">Pagas</SelectItem>
              </SelectContent>
            </Select>
          </div>
          {repFilter !== "todos" && canExportar && (
            <div className="flex items-end">
              <Button
                variant="outline"
                onClick={() => {
                  const repNome = (reps ?? []).find((r) => r.id === repFilter)?.nome ?? "Representante";
                  gerarExtratoPDF(repNome, mes, ano, filtered, totalPendente, totalPago);
                }}
                disabled={filtered.length === 0}
              >
                Extrato PDF
              </Button>
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle>Extrato — {String(mes).padStart(2, "0")}/{ano}</CardTitle></CardHeader>
        <CardContent>
          {isLoading ? <p>Carregando…</p> : (
            <>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Rep</TableHead><TableHead>Pedido</TableHead><TableHead>Cliente</TableHead>
                    <TableHead>NF-e</TableHead><TableHead>Valor NF-e</TableHead><TableHead>Tipo</TableHead>
                    <TableHead>%</TableHead><TableHead>Comissão</TableHead>
                    <TableHead>Status pagamento</TableHead>
                    <TableHead>Ações</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filtered.map((c: any) => (
                    <TableRow key={c.id}>
                      <TableCell>{c.representantes?.nome}</TableCell>
                      <TableCell className="font-mono text-xs">{c.pedidos?.numero_pedido}</TableCell>
                      <TableCell>{c.pedidos?.clientes?.nome}</TableCell>
                      <TableCell className="font-mono text-xs">{c.nfe?.numero_nfe}</TableCell>
                      <TableCell>{fmtBRL(c.base_calculo)}</TableCell>
                      <TableCell><Badge variant="outline">{TIPO_LABEL[c.tipo] ?? c.tipo}</Badge></TableCell>
                      <TableCell>{Number(c.percentual_aplicado).toFixed(2)}%</TableCell>
                      <TableCell className="font-semibold">{fmtBRL(c.valor_comissao)}</TableCell>
                      <TableCell>
                        <div className="flex flex-col gap-1">
                          <StatusBadge pago={!!c.pago_em} />
                          {c.pago_em && <span className="text-xs text-muted-foreground">em {c.pago_em}</span>}
                          {c.comprovante_url && <ComprovanteLink path={c.comprovante_url} />}
                        </div>
                      </TableCell>
                      <TableCell>
                        {!c.pago_em && canMarcarPago && (
                          <MarcarPagoDialog comissao={c} onDone={() => qc.invalidateQueries({ queryKey: ["comissoes"] })} />
                        )}
                      </TableCell>
                    </TableRow>
                  ))}
                  {filtered.length === 0 && (
                    <TableRow><TableCell colSpan={10} className="text-center text-muted-foreground py-6">Sem comissões no período.</TableCell></TableRow>
                  )}
                </TableBody>
              </Table>
              <div className="mt-4 grid grid-cols-1 md:grid-cols-3 gap-3">
                <div className="border rounded-md p-3">
                  <div className="text-xs text-muted-foreground">Total pendente no período</div>
                  <div className="text-xl font-bold text-yellow-600">{fmtBRL(totalPendente)}</div>
                </div>
                <div className="border rounded-md p-3">
                  <div className="text-xs text-muted-foreground">Total pago no período</div>
                  <div className="text-xl font-bold text-green-600">{fmtBRL(totalPago)}</div>
                </div>
                <div className="border rounded-md p-3">
                  <div className="text-xs text-muted-foreground">Total exibido</div>
                  <div className="text-xl font-bold">{fmtBRL(totalVisivel)}</div>
                </div>
              </div>
            </>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

function PainelRepresentante({ representanteId }: { representanteId: string | null }) {
  const now = new Date();
  const [mes, setMes] = useState(now.getMonth() + 1);
  const [ano, setAno] = useState(now.getFullYear());

  const { data: doMes } = useQuery({
    queryKey: ["rep-comissoes-mes", representanteId, mes, ano],
    enabled: !!representanteId,
    queryFn: async () => {
      const { data } = await supabase
        .from("comissoes")
        .select("*, pedidos(numero_pedido, clientes(nome)), nfe(numero_nfe)")
        .eq("representante_id", representanteId!)
        .eq("mes_ref", mes).eq("ano_ref", ano)
        .order("criado_em", { ascending: false });
      return data ?? [];
    },
  });

  const { data: pendentesTotais } = useQuery({
    queryKey: ["rep-comissoes-acumulado", representanteId],
    enabled: !!representanteId,
    queryFn: async () => {
      const { data } = await supabase
        .from("comissoes")
        .select("valor_comissao, mes_ref, ano_ref, pago_em")
        .eq("representante_id", representanteId!)
        .is("pago_em", null);
      return data ?? [];
    },
  });

  if (!representanteId) {
    return <p className="text-muted-foreground">Seu usuário ainda não está vinculado a um representante.</p>;
  }

  const totalPendenteMes = (doMes ?? []).filter((c: any) => !c.pago_em).reduce((s, c: any) => s + Number(c.valor_comissao), 0);
  const totalPagoMes = (doMes ?? []).filter((c: any) => c.pago_em).reduce((s, c: any) => s + Number(c.valor_comissao), 0);
  const totalAcumuladoPendente = (pendentesTotais ?? []).reduce((s, c: any) => s + Number(c.valor_comissao), 0);

  const previsao = previsaoPagamento(mes, ano);

  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-bold">Minhas comissões</h1>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-sm">A receber no mês</CardTitle></CardHeader>
          <CardContent><div className="text-2xl font-bold text-yellow-600">{fmtBRL(totalPendenteMes)}</div></CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-sm">Já recebido no mês</CardTitle></CardHeader>
          <CardContent><div className="text-2xl font-bold text-green-600">{fmtBRL(totalPagoMes)}</div></CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-sm">Acumulado pendente</CardTitle></CardHeader>
          <CardContent><div className="text-2xl font-bold">{fmtBRL(totalAcumuladoPendente)}</div></CardContent>
        </Card>
      </div>

      <div className="rounded-md border border-yellow-300 bg-yellow-50 px-4 py-3 text-sm text-yellow-900">
        Comissões do mês {String(mes).padStart(2, "0")}/{ano} serão pagas até dia 10/{previsao}.
      </div>

      <Card>
        <CardContent className="pt-6 flex flex-wrap gap-3">
          <div className="w-28"><Label className="text-xs">Mês</Label>
            <Select value={String(mes)} onValueChange={(v) => setMes(Number(v))}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>{Array.from({ length: 12 }, (_, i) => i + 1).map((m) => <SelectItem key={m} value={String(m)}>{String(m).padStart(2, "0")}</SelectItem>)}</SelectContent>
            </Select>
          </div>
          <div className="w-32"><Label className="text-xs">Ano</Label>
            <Select value={String(ano)} onValueChange={(v) => setAno(Number(v))}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>{[ano - 1, ano, ano + 1].map((a) => <SelectItem key={a} value={String(a)}>{a}</SelectItem>)}</SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle>Extrato — {String(mes).padStart(2, "0")}/{ano}</CardTitle></CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Pedido</TableHead><TableHead>Cliente</TableHead><TableHead>NF-e</TableHead>
                <TableHead>Mês ref</TableHead><TableHead>Tipo</TableHead>
                <TableHead>Base</TableHead><TableHead>%</TableHead><TableHead>Comissão</TableHead>
                <TableHead>Status</TableHead><TableHead>Pago em</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {(doMes ?? []).map((c: any) => (
                <TableRow key={c.id}>
                  <TableCell className="font-mono text-xs">{c.pedidos?.numero_pedido}</TableCell>
                  <TableCell>{c.pedidos?.clientes?.nome}</TableCell>
                  <TableCell className="font-mono text-xs">{c.nfe?.numero_nfe}</TableCell>
                  <TableCell>{String(c.mes_ref).padStart(2, "0")}/{c.ano_ref}</TableCell>
                  <TableCell><Badge variant="outline">{TIPO_LABEL[c.tipo] ?? c.tipo}</Badge></TableCell>
                  <TableCell>{fmtBRL(c.base_calculo)}</TableCell>
                  <TableCell>{Number(c.percentual_aplicado).toFixed(2)}%</TableCell>
                  <TableCell className="font-semibold">{fmtBRL(c.valor_comissao)}</TableCell>
                  <TableCell><StatusBadge pago={!!c.pago_em} /></TableCell>
                  <TableCell>{c.pago_em ?? "—"}</TableCell>
                </TableRow>
              ))}
              {(doMes ?? []).length === 0 && (
                <TableRow><TableCell colSpan={10} className="text-center text-muted-foreground py-6">Sem comissões no período.</TableCell></TableRow>
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
