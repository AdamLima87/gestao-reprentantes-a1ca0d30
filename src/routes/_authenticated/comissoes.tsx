import { createFileRoute, Link } from "@tanstack/react-router";
import { motion } from "framer-motion";
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
import { SortableTableHead } from "@/components/ui/sortable-table-head";
import { useSortableData } from "@/hooks/use-sortable-data";
import { MotionTableRow, rowMotionProps } from "@/components/MotionTableRow";
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
import { Mail, ChevronDown, CheckCircle2, FileDown } from "lucide-react";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { fmtBRL as fmtBRLUtil } from "@/lib/export-utils";

export const Route = createFileRoute("/_authenticated/comissoes")({
  component: ComissoesPage,
});

const fmtBRL = (n: number | string) =>
  Number(n).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

const TIPO_LABEL: Record<string, string> = {
  externo: "Representante",
  interno_sobre_rep: "Vend. Interno — Sobre Rep.",
  interno_novo: "Vend. Interno - Cliente Novo",
  interno_reativacao: "Vend. Interno - Reativação",
  interno_recorrente: "Vend. Interno - Recorrente",
  gestor: "Gestor",
};


async function gerarExtratoPDF(
  repNome: string,
  mes: number,
  ano: number,
  rows: any[],
  totalPendente: number,
  totalPago: number,
  rep?: any,
  opts?: { returnBase64?: boolean },
): Promise<string | void> {
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
  let headerBottom = cursorY + 24;
  if (empresa?.logo_base64) {
    try {
      const fmt = empresa.logo_base64.startsWith("data:image/png") ? "PNG" : "JPEG";
      const props = (doc as any).getImageProperties?.(empresa.logo_base64);
      const ratio = props && props.width && props.height ? props.height / props.width : 0.5;
      const MAX_W = 45;
      const MAX_H = 20;
      let logoW = MAX_W;
      let logoH = logoW * ratio;
      if (logoH > MAX_H) {
        logoH = MAX_H;
        logoW = logoH / ratio;
      }
      doc.addImage(empresa.logo_base64, fmt, margin, cursorY, logoW, logoH);
      textX = margin + logoW + 5;
      headerBottom = Math.max(headerBottom, cursorY + logoH + 4);
    } catch {
      /* ignora logo inválido */
    }
  }
  doc.setFont("helvetica", "bold");
  doc.setFontSize(14);
  doc.text(empresa?.razao_social ?? "Brazil Amortecedores", textX, cursorY + 7);
  doc.setFontSize(13);
  doc.text("EXTRATO DE COMISSÕES", textX, cursorY + 15);

  cursorY = headerBottom;

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

  // Dados de pagamento (se informados no cadastro do representante)
  let pagamentoY = afterTableY + 14 + 8;
  if (rep) {
    const linhas: string[] = [];
    if (rep.chave_pix) {
      linhas.push(`PIX: ${rep.chave_pix}`);
      if (rep.titular_conta) linhas.push(`Titular: ${rep.titular_conta}${rep.cpf_cnpj_titular ? ` — CPF/CNPJ: ${rep.cpf_cnpj_titular}` : ""}`);
    } else if (rep.banco || rep.agencia || rep.conta_digito || rep.titular_conta) {
      const partes: string[] = [];
      if (rep.banco) partes.push(`Pagamento via: ${rep.banco}`);
      if (rep.agencia) partes.push(`Ag: ${rep.agencia}`);
      if (rep.conta_digito) partes.push(`Conta: ${rep.conta_digito}`);
      if (rep.titular_conta) partes.push(`Titular: ${rep.titular_conta}`);
      linhas.push(partes.join(" — "));
      if (rep.cpf_cnpj_titular) linhas.push(`CPF/CNPJ do titular: ${rep.cpf_cnpj_titular}`);
      if (rep.tipo_conta) {
        const tipoLbl = rep.tipo_conta === "corrente" ? "Conta Corrente" : rep.tipo_conta === "poupanca" ? "Conta Poupança" : rep.tipo_conta === "pagamento" ? "Conta de Pagamento" : rep.tipo_conta;
        linhas.push(`Tipo: ${tipoLbl}`);
      }
    }
    if (linhas.length > 0) {
      doc.setDrawColor(180);
      doc.setFillColor(245, 250, 245);
      const boxH = 8 + linhas.length * 5;
      doc.rect(margin, pagamentoY, pageWidth - margin * 2, boxH, "FD");
      doc.setFont("helvetica", "bold");
      doc.setFontSize(10);
      doc.setTextColor(40, 80, 40);
      doc.text("Dados de pagamento", margin + 4, pagamentoY + 6);
      doc.setFont("helvetica", "normal");
      doc.setFontSize(9);
      doc.setTextColor(40);
      linhas.forEach((l, i) => doc.text(l, margin + 4, pagamentoY + 12 + i * 5));
      doc.setTextColor(0);
    }
  }


  // Rodapé
  doc.setFont("helvetica", "normal");
  doc.setFontSize(9);
  doc.setTextColor(120);
  const geradoEm = new Date().toLocaleString("pt-BR");
  doc.text(`Documento gerado em ${geradoEm}`, margin, pageHeight - margin + 5);
  doc.text("Brazil Amortecedores — gestao-reprentantes.lovable.app", pageWidth - margin, pageHeight - margin + 5, { align: "right" });

  const slug = repNome.normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^a-zA-Z0-9]+/g, "_");
  if (opts?.returnBase64) {
    const dataUri = doc.output("datauristring");
    return dataUri.split(",")[1] ?? "";
  }
  doc.save(`extrato_${slug}_${String(mes).padStart(2, "0")}_${ano}.pdf`);
}

async function gerarExtratoGestorPDF(
  gestorNome: string,
  mes: number,
  ano: number,
  rows: any[],
  gestor?: { banco?: string | null; agencia?: string | null; conta?: string | null; pix?: string | null } | null,
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

  // Cabeçalho verde escuro
  doc.setFillColor(26, 107, 58);
  doc.rect(0, 0, pageWidth, 28, "F");
  let textX = margin;
  if (empresa?.logo_base64) {
    try {
      const fmt = empresa.logo_base64.startsWith("data:image/png") ? "PNG" : "JPEG";
      const props = (doc as any).getImageProperties?.(empresa.logo_base64);
      const ratio = props && props.width && props.height ? props.height / props.width : 0.5;
      const MAX_W = 40;
      const MAX_H = 18;
      let logoW = MAX_W;
      let logoH = logoW * ratio;
      if (logoH > MAX_H) {
        logoH = MAX_H;
        logoW = logoH / ratio;
      }
      doc.addImage(empresa.logo_base64, fmt, margin, 5, logoW, logoH);
      textX = margin + logoW + 6;
    } catch {/* ignore */}
  }
  doc.setTextColor(255);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(13);
  doc.text("BRAZIL AMORTECEDORES", textX, 12);
  doc.setFontSize(11);
  doc.text("EXTRATO DE COMISSÃO — GESTOR", textX, 19);
  doc.setFontSize(9);
  doc.setFont("helvetica", "normal");
  doc.text(`Período ${String(mes).padStart(2, "0")}/${ano}`, pageWidth - margin, 12, { align: "right" });
  doc.text(`Gestor: ${gestorNome}`, pageWidth - margin, 19, { align: "right" });
  doc.setTextColor(0);

  let cursorY = 36;

  const totalBase = rows.reduce((s, c: any) => s + Number(c.base_calculo || 0), 0);
  const totalComissao = rows.reduce((s, c: any) => s + Number(c.valor_comissao || 0), 0);

  autoTable(doc, {
    startY: cursorY,
    margin: { left: margin, right: margin },
    head: [["NF-e", "Data", "Cliente", "Valor Produtos", "%", "Comissão"]],
    body: rows.map((c: any) => [
      c.nfe?.numero_nfe ?? "—",
      formatarData(c.nfe?.data_nfe ?? c.criado_em),
      c.pedidos?.clientes?.nome ?? "—",
      fmtBRLUtil(c.base_calculo),
      `${Number(c.percentual_aplicado).toFixed(2)}%`,
      fmtBRLUtil(c.valor_comissao),
    ]),
    foot: [[
      { content: `Total de NF-es: ${rows.length}`, colSpan: 3, styles: { halign: "left", fontStyle: "bold" } },
      { content: fmtBRLUtil(totalBase), styles: { fontStyle: "bold" } },
      "",
      { content: fmtBRLUtil(totalComissao), styles: { fontStyle: "bold" } },
    ]],
    styles: { font: "helvetica", fontSize: 9, cellPadding: 2 },
    headStyles: { fillColor: [26, 107, 58], textColor: 255 },
    footStyles: { fillColor: [232, 245, 233], textColor: 20 },
    alternateRowStyles: { fillColor: [245, 250, 247] },
  });

  let afterY = (doc as any).lastAutoTable?.finalY ?? cursorY + 10;
  afterY += 10;

  // Bloco total comissão
  doc.setFillColor(255, 248, 225);
  doc.setDrawColor(180);
  doc.rect(margin, afterY, pageWidth - margin * 2, 14, "FD");
  doc.setFont("helvetica", "bold");
  doc.setFontSize(12);
  doc.setTextColor(146, 64, 14);
  doc.text(`Total da comissão: ${fmtBRLUtil(totalComissao)}`, margin + 4, afterY + 9);
  doc.setTextColor(0);

  // Dados bancários do gestor
  if (gestor && (gestor.banco || gestor.agencia || gestor.conta || gestor.pix)) {
    const linhas: string[] = [];
    if (gestor.pix) linhas.push(`PIX: ${gestor.pix}`);
    const partes: string[] = [];
    if (gestor.banco) partes.push(`Banco: ${gestor.banco}`);
    if (gestor.agencia) partes.push(`Ag: ${gestor.agencia}`);
    if (gestor.conta) partes.push(`Conta: ${gestor.conta}`);
    if (partes.length) linhas.push(partes.join(" — "));

    if (linhas.length) {
      const boxY = afterY + 18;
      const boxH = 8 + linhas.length * 5;
      doc.setFillColor(245, 250, 245);
      doc.rect(margin, boxY, pageWidth - margin * 2, boxH, "FD");
      doc.setFont("helvetica", "bold");
      doc.setFontSize(10);
      doc.setTextColor(40, 80, 40);
      doc.text("Dados bancários", margin + 4, boxY + 6);
      doc.setFont("helvetica", "normal");
      doc.setFontSize(9);
      doc.setTextColor(40);
      linhas.forEach((l, i) => doc.text(l, margin + 4, boxY + 12 + i * 5));
      doc.setTextColor(0);
    }
  }

  // Rodapé
  doc.setFont("helvetica", "normal");
  doc.setFontSize(9);
  doc.setTextColor(120);
  const geradoEm = new Date().toLocaleString("pt-BR");
  doc.text(`Documento gerado em ${geradoEm}`, margin, pageHeight - margin + 5);
  doc.text("Brazil Amortecedores — gestao-reprentantes.lovable.app", pageWidth - margin, pageHeight - margin + 5, { align: "right" });

  const slug = gestorNome.normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^a-zA-Z0-9]+/g, "_");
  doc.save(`extrato_gestor_${slug}_${String(mes).padStart(2, "0")}_${ano}.pdf`);
}




function previsaoPagamento(mes: number, ano: number) {
  const next = mes === 12 ? { m: 1, a: ano + 1 } : { m: mes + 1, a: ano };
  return `${String(next.m).padStart(2, "0")}/${next.a}`;
}

import { PagamentoBadge as StatusBadge, TipoComissaoBadge } from "@/lib/status-badge";
void motion;

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
  const { representanteId, roles, user } = useAuth();
  const { can } = usePermissions();
  const canVer = can("ver_comissoes");
  const verTodas = can("ver_todas_comissoes");
  const canMarcarPago = can("marcar_comissao_paga");
  const canRecalcular = can("recalcular_comissoes");
  const canExportar = can("exportar_relatorios");
  const canEnviarExtrato = can("enviar_extrato_email");

  const isAdmin = roles.includes("admin");
  const isGestor = roles.includes("gestor");
  const podeVerGestor = isAdmin || isGestor;

  const isRepOnly = canVer && !verTodas && !isGestor;

  if (isRepOnly) return <PainelRepresentante representanteId={representanteId} />;


  const qc = useQueryClient();
  const callReprocessar = useServerFn(reprocessarComissoes);


  const [recalcOpen, setRecalcOpen] = useState(false);
  const recalcular = useMutation({
    mutationFn: async () => {
      // reprocessarComissoes já apaga tudo e recria as comissões honrando:
      // - percentual_padrao / percentual_recorrente / percentual_sobre_rep do vendedor interno
      // - percentual_interno_override por pedido
      // - comissão do gestor
      // Não chamar as RPCs legadas (recalcular_comissoes_representantes/interno/gestor),
      // pois elas sobrescreviam com percentuais fixos antigos, ignorando os overrides.
      await callReprocessar();
      return { ok: true };
    },
    onSuccess: () => {
      toast.success("Comissões recalculadas com sucesso.");
      qc.invalidateQueries({ queryKey: ["comissoes"] });
      qc.invalidateQueries({ queryKey: ["rel-comissoes"] });
      qc.invalidateQueries({ queryKey: ["rel-comissoes-geral"] });
      qc.invalidateQueries({ queryKey: ["rel-comissoes-reps"] });
      qc.invalidateQueries({ queryKey: ["relatorios"] });
      qc.invalidateQueries({ queryKey: ["dashboard"] });
      setRecalcOpen(false);
    },
    onError: (e: Error) => toast.error(e.message),
  });


  const now = new Date();
  const [mes, setMes] = useState(now.getMonth() + 1);
  const [ano, setAno] = useState(now.getFullYear());
  const [repFilter, setRepFilter] = useState<string>("todos");
  const [statusFilter, setStatusFilter] = useState<"todas" | "pendentes" | "pagas">("todas");
  const [emailDialogOpen, setEmailDialogOpen] = useState(false);
  const [enviandoEmail, setEnviandoEmail] = useState(false);

  const { data: reps } = useQuery({
    queryKey: ["reps"],
    queryFn: async () => (await supabase.from("representantes").select("id, nome, email, tipo, banco, tipo_conta, agencia, conta_digito, chave_pix, titular_conta, cpf_cnpj_titular").order("nome")).data ?? [],
  });

  const { data: gestoresProfiles } = useQuery({
    queryKey: ["gestores-profiles-full"],
    enabled: podeVerGestor,
    queryFn: async () => {
      const { data: gr } = await supabase.from("user_roles").select("user_id").eq("role", "gestor");
      const ids = (gr ?? []).map((r: any) => r.user_id);
      if (ids.length === 0) return [] as any[];
      const { data: profs } = await supabase.from("profiles").select("id, nome, banco, agencia, conta, pix").in("id", ids);
      return (profs ?? []) as any[];
    },
  });

  const { data: gestorComissoes } = useQuery({
    queryKey: ["comissoes-gestor", mes, ano, isAdmin, user?.id],
    enabled: podeVerGestor,
    queryFn: async () => {
      let q = supabase
        .from("comissoes")
        .select("*, pedidos(numero_pedido, clientes(nome)), nfe(numero_nfe, valor_nfe, data_nfe)")
        .eq("tipo", "gestor" as any)
        .eq("mes_ref", mes)
        .eq("ano_ref", ano)
        .order("criado_em", { ascending: false });
      if (!isAdmin && user?.id) q = q.eq("gestor_user_id", user.id);
      return (await q).data ?? [];
    },
  });

  const { data, isLoading } = useQuery({
    queryKey: ["comissoes", mes, ano, repFilter, verTodas, representanteId],
    enabled: canVer,
    queryFn: async () => {
      let q = supabase
        .from("comissoes")
        .select("*, representantes(nome), pedidos(numero_pedido, clientes(nome)), nfe(numero_nfe, valor_nfe)")
        .eq("mes_ref", mes).eq("ano_ref", ano)
        .order("criado_em", { ascending: false });
      if (!verTodas && representanteId) q = q.eq("representante_id", representanteId);
      else if (repFilter !== "todos") q = q.eq("representante_id", repFilter);
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

  const comissoesSort = useSortableData(filtered, {
    accessors: {
      rep: (c: any) => c.representantes?.nome ?? "",
      pedido: (c: any) => c.pedidos?.numero_pedido ?? "",
      cliente: (c: any) => c.pedidos?.clientes?.nome ?? "",
      nfe: (c: any) => c.nfe?.numero_nfe ?? "",
      valor_nfe: (c: any) => Number(c.nfe?.valor_nfe ?? 0),
      tipo: (c: any) => c.tipo ?? "",
      percentual: (c: any) => Number(c.percentual_aplicado ?? 0),
      valor_comissao: (c: any) => Number(c.valor_comissao),
      status: (c: any) => c.pago_em ? "pago" : "pendente",
    },
  });




  if (!canVer) {
    return <p className="text-muted-foreground">Você não tem permissão para ver comissões.</p>;
  }

  return (
    <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.3, ease: "easeOut" }} className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold border-l-4 border-[#1a6b3a] pl-3">Comissões</h1>
        <div className="flex gap-2">
          <Button variant="outline" asChild>
            <Link to="/relatorios"><FileDown className="w-4 h-4 mr-1" /> Relatório Geral</Link>
          </Button>
          {canRecalcular && (
            <Button
              variant="outline"
              onClick={() => setRecalcOpen(true)}
              disabled={recalcular.isPending}
            >
              {recalcular.isPending ? "Recalculando…" : "Recalcular comissões"}
            </Button>
          )}
        </div>
      </div>


      <Dialog open={recalcOpen} onOpenChange={setRecalcOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>Recalcular comissões</DialogTitle></DialogHeader>
          <p className="text-sm text-muted-foreground">
            Esta ação irá reanalisar todas as comissões do vendedor interno com base no histórico
            cronológico real de cada cliente, corrigindo classificações incorretas. Deseja continuar?
          </p>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setRecalcOpen(false)} disabled={recalcular.isPending}>
              Cancelar
            </Button>
            <Button onClick={() => recalcular.mutate()} disabled={recalcular.isPending}>
              {recalcular.isPending ? "Recalculando…" : "Recalcular"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

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
          {verTodas && (
            <div className="w-56"><Label className="text-xs">Representante</Label>
              <Select value={repFilter} onValueChange={setRepFilter}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="todos">Todos</SelectItem>
                  {(reps ?? []).map((r) => <SelectItem key={r.id} value={r.id}>{r.nome}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
          )}

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
                  const rep = (reps ?? []).find((r) => r.id === repFilter);
                  const repNome = rep?.nome ?? "Representante";
                  gerarExtratoPDF(repNome, mes, ano, filtered, totalPendente, totalPago, rep);
                }}
                disabled={filtered.length === 0}
              >
                Extrato PDF
              </Button>
            </div>
          )}
          {repFilter !== "todos" && canEnviarExtrato && (
            <div className="flex items-end">
              <Button
                variant="outline"
                onClick={() => setEmailDialogOpen(true)}
                disabled={filtered.length === 0}
              >
                <Mail className="h-4 w-4 mr-2" />
                Enviar por e-mail
              </Button>
            </div>
          )}
        </CardContent>
      </Card>

      <GruposComissoes
        isLoading={isLoading}
        rowsRep={filtered}
        rowsGestor={(gestorComissoes ?? []).filter((c: any) => {
          if (statusFilter === "pendentes") return !c.pago_em;
          if (statusFilter === "pagas") return !!c.pago_em;
          return true;
        })}
        reps={reps ?? []}
        gestoresProfiles={gestoresProfiles ?? []}
        mes={mes}
        ano={ano}
        repFilter={repFilter}
        totalPendente={totalPendente}
        totalPago={totalPago}
        totalVisivel={totalVisivel}
        canMarcarPago={canMarcarPago}
        canExportar={canExportar}
        canEnviarExtrato={canEnviarExtrato}
        onChanged={() => {
          qc.invalidateQueries({ queryKey: ["comissoes"] });
          qc.invalidateQueries({ queryKey: ["comissoes-gestor"] });
        }}
      />


      <Dialog open={emailDialogOpen} onOpenChange={(o) => !enviandoEmail && setEmailDialogOpen(o)}>
        <DialogContent>
          <DialogHeader><DialogTitle>Enviar extrato por e-mail</DialogTitle></DialogHeader>
          {(() => {
            const rep = (reps ?? []).find((r) => r.id === repFilter);
            const repNome = rep?.nome ?? "—";
            const repEmail = (rep as any)?.email ?? null;
            return (
              <div className="space-y-2 text-sm">
                <p><span className="text-muted-foreground">Representante:</span> <span className="font-medium">{repNome}</span></p>
                <p><span className="text-muted-foreground">E-mail de destino:</span> <span className="font-medium">{repEmail ?? <em className="text-red-600">não cadastrado</em>}</span></p>
                <p><span className="text-muted-foreground">Mês/Ano:</span> <span className="font-medium">{String(mes).padStart(2, "0")}/{ano}</span></p>
                <p className="text-xs text-muted-foreground pt-2">O PDF do extrato será gerado e enviado em anexo.</p>
              </div>
            );
          })()}
          <DialogFooter>
            <Button variant="ghost" onClick={() => setEmailDialogOpen(false)} disabled={enviandoEmail}>Cancelar</Button>
            <Button
              onClick={async () => {
                const rep = (reps ?? []).find((r) => r.id === repFilter);
                if (!rep) return;
                const repEmail = (rep as any).email;
                if (!repEmail) { toast.error("Representante sem e-mail cadastrado."); return; }
                setEnviandoEmail(true);
                try {
                  const pdf_base64 = (await gerarExtratoPDF(rep.nome, mes, ano, filtered, totalPendente, totalPago, rep, { returnBase64: true })) as string;
                  const { data: sess } = await supabase.auth.getSession();
                  const token = sess.session?.access_token;
                  const resp = await supabase.functions.invoke("enviar-extrato-email", {
                    body: { representante_id: rep.id, pdf_base64, mes, ano },
                    headers: token ? { Authorization: `Bearer ${token}` } : undefined,
                  });
                  if (resp.error) throw new Error(resp.error.message || "Falha ao enviar");
                  if ((resp.data as any)?.error) throw new Error((resp.data as any).error);
                  toast.success(`Extrato enviado para ${repEmail}`);
                  setEmailDialogOpen(false);
                } catch (e: any) {
                  toast.error(e?.message ?? "Erro ao enviar e-mail");
                } finally {
                  setEnviandoEmail(false);
                }
              }}
              disabled={enviandoEmail}
            >
              {enviandoEmail ? "Enviando…" : "Confirmar envio"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </motion.div>
  );
}

type GrupoKind = "externo" | "interno" | "gestor";

interface Grupo {
  key: string;
  nome: string;
  kind: GrupoKind;
  rep?: any;
  gestorProfile?: any;
  rows: any[];
}

function GruposComissoes({
  isLoading,
  rowsRep,
  rowsGestor,
  reps,
  gestoresProfiles,
  mes,
  ano,
  repFilter,
  totalPendente,
  totalPago,
  totalVisivel,
  canMarcarPago,
  canExportar,
  canEnviarExtrato,
  onChanged,
}: {
  isLoading: boolean;
  rowsRep: any[];
  rowsGestor: any[];
  reps: any[];
  gestoresProfiles: any[];
  mes: number;
  ano: number;
  repFilter: string;
  totalPendente: number;
  totalPago: number;
  totalVisivel: number;
  canMarcarPago: boolean;
  canExportar: boolean;
  canEnviarExtrato: boolean;
  onChanged: () => void;
}) {
  const grupos = useMemo<Grupo[]>(() => {
    const map = new Map<string, Grupo>();

    for (const c of rowsRep) {
      const repId: string | null = c.representante_id ?? null;
      if (!repId) continue;
      const rep = reps.find((r) => r.id === repId);
      const kind: GrupoKind = rep?.tipo === "interno" ? "interno" : "externo";
      const key = `rep:${repId}`;
      const g = map.get(key) ?? {
        key,
        nome: rep?.nome ?? c.representantes?.nome ?? "Representante",
        kind,
        rep,
        rows: [] as any[],
      };
      g.rows.push(c);
      map.set(key, g);
    }

    for (const c of rowsGestor) {
      const gid: string = c.gestor_user_id ?? "sem-gestor";
      const key = `gestor:${gid}`;
      const profile = gestoresProfiles.find((p) => p.id === gid);
      const g = map.get(key) ?? {
        key,
        nome: profile?.nome ?? "Gestor",
        kind: "gestor" as const,
        gestorProfile: profile,
        rows: [] as any[],
      };
      g.rows.push(c);
      map.set(key, g);
    }

    let arr = [...map.values()];
    if (repFilter !== "todos") arr = arr.filter((g) => g.key === `rep:${repFilter}`);

    const order: Record<GrupoKind, number> = { externo: 0, interno: 1, gestor: 2 };
    arr.sort((a, b) => {
      if (order[a.kind] !== order[b.kind]) return order[a.kind] - order[b.kind];
      return a.nome.localeCompare(b.nome, "pt-BR");
    });
    return arr;
  }, [rowsRep, rowsGestor, reps, gestoresProfiles, repFilter]);

  return (
    <div className="space-y-4">
      {isLoading ? (
        <Card><CardContent className="pt-6"><p>Carregando…</p></CardContent></Card>
      ) : grupos.length === 0 ? (
        <Card><CardContent className="pt-6 text-center text-muted-foreground">Sem comissões no período.</CardContent></Card>
      ) : (
        grupos.map((g) => (
          <GrupoComissaoCard
            key={g.key}
            grupo={g}
            mes={mes}
            ano={ano}
            canMarcarPago={canMarcarPago}
            canExportar={canExportar}
            canEnviarExtrato={canEnviarExtrato}
            onChanged={onChanged}
          />
        ))
      )}

      <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
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
    </div>
  );
}

const KIND_LABEL: Record<GrupoKind, { label: string; className: string }> = {
  externo: { label: "Externo", className: "bg-blue-100 text-blue-800 border-blue-200" },
  interno: { label: "Interno", className: "bg-teal-100 text-teal-800 border-teal-200" },
  gestor:  { label: "Gestor",  className: "bg-amber-100 text-amber-800 border-amber-200" },
};

function GrupoComissaoCard({
  grupo,
  mes,
  ano,
  canMarcarPago,
  canExportar,
  canEnviarExtrato,
  onChanged,
}: {
  grupo: Grupo;
  mes: number;
  ano: number;
  canMarcarPago: boolean;
  canExportar: boolean;
  canEnviarExtrato: boolean;
  onChanged: () => void;
}) {
  const [open, setOpen] = useState(false);
  const [markOpen, setMarkOpen] = useState(false);
  const [emailOpen, setEmailOpen] = useState(false);
  const [enviando, setEnviando] = useState(false);

  const total = grupo.rows.reduce((s, c: any) => s + Number(c.valor_comissao || 0), 0);
  const totalPend = grupo.rows.filter((c: any) => !c.pago_em).reduce((s, c: any) => s + Number(c.valor_comissao || 0), 0);
  const totalPago = total - totalPend;
  const temPendente = grupo.rows.some((c: any) => !c.pago_em);
  const pendentes = grupo.rows.filter((c: any) => !c.pago_em);

  const kindMeta = KIND_LABEL[grupo.kind];

  const gerarPDF = async () => {
    if (grupo.kind === "gestor") {
      await gerarExtratoGestorPDF(grupo.nome, mes, ano, grupo.rows, grupo.gestorProfile ?? null);
    } else {
      await gerarExtratoPDF(grupo.nome, mes, ano, grupo.rows, totalPend, totalPago, grupo.rep);
    }
  };

  const enviarEmail = async () => {
    if (grupo.kind === "gestor") { toast.error("Envio por e-mail disponível apenas para representantes."); return; }
    const rep = grupo.rep;
    if (!rep?.email) { toast.error("Representante sem e-mail cadastrado."); return; }
    setEnviando(true);
    try {
      const pdf_base64 = (await gerarExtratoPDF(rep.nome, mes, ano, grupo.rows, totalPend, totalPago, rep, { returnBase64: true })) as string;
      const { data: sess } = await supabase.auth.getSession();
      const token = sess.session?.access_token;
      const resp = await supabase.functions.invoke("enviar-extrato-email", {
        body: { representante_id: rep.id, pdf_base64, mes, ano },
        headers: token ? { Authorization: `Bearer ${token}` } : undefined,
      });
      if (resp.error) throw new Error(resp.error.message || "Falha ao enviar");
      if ((resp.data as any)?.error) throw new Error((resp.data as any).error);
      toast.success(`Extrato enviado para ${rep.email}`);
      setEmailOpen(false);
    } catch (e: any) {
      toast.error(e?.message ?? "Erro ao enviar e-mail");
    } finally {
      setEnviando(false);
    }
  };

  return (
    <Card>
      <Collapsible open={open} onOpenChange={setOpen}>
        <CardContent className="pt-4 pb-3">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-3 min-w-0">
              <div className="min-w-0">
                <div className="flex items-center gap-2">
                  <h3 className="font-semibold truncate">{grupo.nome}</h3>
                  <span className={`inline-flex items-center rounded-md border px-2 py-0.5 text-[10px] font-semibold ${kindMeta.className}`}>
                    {kindMeta.label}
                  </span>
                </div>
                <div className="text-xs text-muted-foreground">
                  {grupo.rows.length} comissão(ões) — Pendente: <span className="font-medium text-yellow-700">{fmtBRL(totalPend)}</span> · Pago: <span className="font-medium text-green-700">{fmtBRL(totalPago)}</span>
                </div>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <div className="text-right">
                <div className="text-xs text-muted-foreground">Total do mês</div>
                <div className="text-lg font-bold">{fmtBRL(total)}</div>
              </div>
              {temPendente ? (
                <span className="inline-flex items-center rounded-md border border-yellow-300 bg-yellow-100 px-2 py-1 text-xs font-semibold text-yellow-800">Pendente</span>
              ) : (
                <span className="inline-flex items-center rounded-md border border-green-300 bg-green-100 px-2 py-1 text-xs font-semibold text-green-800">
                  <CheckCircle2 className="h-3 w-3 mr-1" /> Pago
                </span>
              )}
            </div>
          </div>

          <div className="mt-3 flex flex-wrap gap-2">
            {canMarcarPago && temPendente && (
              <Button size="sm" onClick={() => setMarkOpen(true)}>
                <CheckCircle2 className="h-4 w-4 mr-1" /> Marcar tudo como pago
              </Button>
            )}
            {canExportar && (
              <Button size="sm" variant="outline" onClick={gerarPDF}>
                <FileDown className="h-4 w-4 mr-1" /> Extrato PDF
              </Button>
            )}
            {canEnviarExtrato && grupo.kind !== "gestor" && grupo.rep?.email && (
              <Button size="sm" variant="outline" onClick={() => setEmailOpen(true)}>
                <Mail className="h-4 w-4 mr-1" /> Enviar por e-mail
              </Button>
            )}
            <CollapsibleTrigger asChild>
              <Button size="sm" variant="ghost">
                Ver detalhes
                <ChevronDown className={`h-4 w-4 ml-1 transition-transform ${open ? "rotate-180" : ""}`} />
              </Button>
            </CollapsibleTrigger>
          </div>

          <CollapsibleContent className="mt-3">
            <div className="border rounded-md overflow-hidden">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Pedido</TableHead>
                    <TableHead>Cliente</TableHead>
                    <TableHead>NF-e</TableHead>
                    <TableHead>Data</TableHead>
                    <TableHead>Base</TableHead>
                    <TableHead>Tipo</TableHead>
                    <TableHead>%</TableHead>
                    <TableHead>Comissão</TableHead>
                    <TableHead>Status</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {grupo.rows.map((c: any, i: number) => (
                    <MotionTableRow key={c.id} {...rowMotionProps(i)}>
                      <TableCell className="font-mono text-xs">{c.pedidos?.numero_pedido ?? "—"}</TableCell>
                      <TableCell>{c.pedidos?.clientes?.nome ?? "—"}</TableCell>
                      <TableCell className="font-mono text-xs">{c.nfe?.numero_nfe ?? "—"}</TableCell>
                      <TableCell>{formatarData(c.nfe?.data_nfe ?? c.criado_em)}</TableCell>
                      <TableCell>{fmtBRL(c.base_calculo)}</TableCell>
                      <TableCell><TipoComissaoBadge tipo={c.tipo} /></TableCell>
                      <TableCell>{Number(c.percentual_aplicado).toFixed(2)}%</TableCell>
                      <TableCell className="font-semibold">{fmtBRL(c.valor_comissao)}</TableCell>
                      <TableCell>
                        <div className="flex flex-col gap-1">
                          <StatusBadge pago={!!c.pago_em} />
                          {c.pago_em && <span className="text-xs text-muted-foreground">em {formatarData(c.pago_em)}</span>}
                          {c.comprovante_url && <ComprovanteLink path={c.comprovante_url} />}
                        </div>
                      </TableCell>
                    </MotionTableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </CollapsibleContent>
        </CardContent>
      </Collapsible>

      <MarcarTudoPagoDialog
        open={markOpen}
        onOpenChange={setMarkOpen}
        nomeGrupo={grupo.nome}
        pendentes={pendentes}
        totalPendente={totalPend}
        onDone={() => { setMarkOpen(false); onChanged(); }}
      />

      <Dialog open={emailOpen} onOpenChange={(o) => !enviando && setEmailOpen(o)}>
        <DialogContent>
          <DialogHeader><DialogTitle>Enviar extrato por e-mail</DialogTitle></DialogHeader>
          <div className="space-y-2 text-sm">
            <p><span className="text-muted-foreground">Representante:</span> <span className="font-medium">{grupo.nome}</span></p>
            <p><span className="text-muted-foreground">E-mail de destino:</span> <span className="font-medium">{grupo.rep?.email ?? "—"}</span></p>
            <p><span className="text-muted-foreground">Mês/Ano:</span> <span className="font-medium">{String(mes).padStart(2, "0")}/{ano}</span></p>
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setEmailOpen(false)} disabled={enviando}>Cancelar</Button>
            <Button onClick={enviarEmail} disabled={enviando}>{enviando ? "Enviando…" : "Confirmar envio"}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Card>
  );
}

function MarcarTudoPagoDialog({
  open,
  onOpenChange,
  nomeGrupo,
  pendentes,
  totalPendente,
  onDone,
}: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  nomeGrupo: string;
  pendentes: any[];
  totalPendente: number;
  onDone: () => void;
}) {
  const [data, setData] = useState(new Date().toISOString().slice(0, 10));
  const [obs, setObs] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [saving, setSaving] = useState(false);

  const submit = async () => {
    if (pendentes.length === 0) return;
    setSaving(true);
    try {
      let comprovante_url: string | null = null;
      if (file) {
        const path = `lote/${Date.now()}-${file.name}`;
        const up = await supabase.storage.from("comprovantes-comissoes").upload(path, file, { upsert: false });
        if (up.error) throw up.error;
        comprovante_url = up.data.path;
      }
      const ids = pendentes.map((c) => c.id);
      const payload: any = { pago_em: data, observacao_pagamento: obs || null };
      if (comprovante_url) payload.comprovante_url = comprovante_url;
      const { error } = await supabase.from("comissoes").update(payload).in("id", ids);
      if (error) throw error;
      toast.success(`Comissões de ${nomeGrupo} marcadas como pagas`);
      onDone();
    } catch (e: any) {
      toast.error(e.message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader><DialogTitle>Marcar comissões como pagas — {nomeGrupo}</DialogTitle></DialogHeader>
        <div className="space-y-3">
          <div className="rounded-md border bg-muted/40 p-3">
            <div className="text-xs text-muted-foreground">Total a marcar como pago ({pendentes.length} comissões)</div>
            <div className="text-2xl font-bold text-yellow-700">{fmtBRL(totalPendente)}</div>
          </div>
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
          <Button variant="ghost" onClick={() => onOpenChange(false)} disabled={saving}>Cancelar</Button>
          <Button onClick={submit} disabled={saving}>{saving ? "Salvando…" : "Confirmar pagamento"}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}


function ComissaoGestorSection({
  mes,
  ano,
  isAdmin,
  currentUserId,
}: {
  mes: number;
  ano: number;
  isAdmin: boolean;
  currentUserId: string | null;
}) {
  const { data, isLoading } = useQuery({
    queryKey: ["comissoes-gestor", mes, ano, isAdmin, currentUserId],
    enabled: isAdmin || !!currentUserId,
    queryFn: async () => {
      let q = supabase
        .from("comissoes")
        .select("*, pedidos(numero_pedido, clientes(nome)), nfe(numero_nfe, valor_nfe, data_nfe)")
        .eq("tipo", "gestor" as any)
        .eq("mes_ref", mes)
        .eq("ano_ref", ano)
        .order("criado_em", { ascending: false });
      if (!isAdmin && currentUserId) q = q.eq("gestor_user_id", currentUserId);
      return (await q).data ?? [];
    },
  });

  const { data: gestores } = useQuery({
    queryKey: ["gestores-profiles-full"],
    queryFn: async () => {
      const { data: roles } = await supabase
        .from("user_roles")
        .select("user_id")
        .eq("role", "gestor");
      const ids = (roles ?? []).map((r: any) => r.user_id);
      if (ids.length === 0) return [] as any[];
      const { data: profs } = await supabase
        .from("profiles")
        .select("id, nome, banco, agencia, conta, pix")
        .in("id", ids);
      return (profs ?? []) as any[];
    },
  });


  const grupos = useMemo(() => {
    const rows = (data ?? []) as any[];
    if (!isAdmin) return [{ id: currentUserId ?? "", nome: "Minha comissão", rows }];
    const byId = new Map<string, any[]>();
    for (const r of rows) {
      const key = r.gestor_user_id ?? "—";
      const list = byId.get(key) ?? [];
      list.push(r);
      byId.set(key, list);
    }
    const nomeOf = (id: string) =>
      (gestores ?? []).find((g) => g.id === id)?.nome ?? "Gestor";
    return [...byId.entries()].map(([id, rows]) => ({
      id,
      nome: id === "—" ? "Gestor" : nomeOf(id),
      rows,
    }));
  }, [data, isAdmin, gestores, currentUserId]);


  const totalGeral = (data ?? []).reduce(
    (s: number, c: any) => s + Number(c.valor_comissao || 0),
    0,
  );

  return (
    <Card>
      <CardHeader>
        <CardTitle>Comissão do Gestor — {String(mes).padStart(2, "0")}/{ano}</CardTitle>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <p className="text-muted-foreground">Carregando…</p>
        ) : (data ?? []).length === 0 ? (
          <p className="text-muted-foreground">Sem comissões de gestor no período.</p>
        ) : (
          <div className="space-y-6">
            {grupos.map((g, gi) => {
              const gestorProfile = (gestores ?? []).find((p: any) => p.id === g.id);
              return (
                <GestorGroup
                  key={gi}
                  groupName={isAdmin ? g.nome : "Minha comissão"}
                  rows={g.rows}
                  mes={mes}
                  ano={ano}
                  gestorProfile={gestorProfile ?? null}
                  isAdmin={isAdmin}
                />
              );
            })}
            <div className="rounded-md border p-3 bg-[#fff8e1] flex justify-between items-center">
              <span className="font-semibold">Total Comissão Gestor — {String(mes).padStart(2, "0")}/{ano}</span>
              <span className="text-xl font-bold text-[#92400e]">{fmtBRL(totalGeral)}</span>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}


function GestorGroup({
  groupName,
  rows,
  mes,
  ano,
  gestorProfile,
  isAdmin,
}: {
  groupName: string;
  rows: any[];
  mes: number;
  ano: number;
  gestorProfile: any | null;
  isAdmin: boolean;
}) {
  const sort = useSortableData(rows, {
    accessors: {
      nfe: (c: any) => c.nfe?.numero_nfe ?? "",
      data: (c: any) => c.nfe?.data_nfe ?? "",
      cliente: (c: any) => c.pedidos?.clientes?.nome ?? "",
      base_calculo: (c: any) => Number(c.base_calculo),
      percentual_aplicado: (c: any) => Number(c.percentual_aplicado),
      valor_comissao: (c: any) => Number(c.valor_comissao),
    },
  });
  const subtotal = rows.reduce((s: number, c: any) => s + Number(c.valor_comissao || 0), 0);
  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold">{groupName}</h3>
        <Button
          size="sm"
          variant="outline"
          onClick={() =>
            gerarExtratoGestorPDF(
              isAdmin ? groupName : (gestorProfile?.nome ?? "Gestor"),
              mes,
              ano,
              rows,
              gestorProfile,
            )
          }
        >
          Extrato PDF
        </Button>
      </div>
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
            <MotionTableRow key={c.id} {...rowMotionProps(i)}>
              <TableCell className="font-mono text-xs">{c.nfe?.numero_nfe ?? "—"}</TableCell>
              <TableCell>{formatarData(c.nfe?.data_nfe)}</TableCell>
              <TableCell>{c.pedidos?.clientes?.nome ?? "—"}</TableCell>
              <TableCell className="text-right">{fmtBRL(c.base_calculo)}</TableCell>
              <TableCell className="text-right">{Number(c.percentual_aplicado).toFixed(2)}%</TableCell>
              <TableCell className="text-right font-semibold">{fmtBRL(c.valor_comissao)}</TableCell>
            </MotionTableRow>
          ))}
          <TableRow className="bg-muted/50 font-bold">
            <TableCell colSpan={5} className="text-right">Subtotal</TableCell>
            <TableCell className="text-right text-[#1a6b3a]">{fmtBRL(subtotal)}</TableCell>
          </TableRow>
        </TableBody>
      </Table>
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

  const repSort = useSortableData((doMes ?? []) as any[], {
    accessors: {
      pedido: (c: any) => c.pedidos?.numero_pedido ?? "",
      cliente: (c: any) => c.pedidos?.clientes?.nome ?? "",
      nfe: (c: any) => c.nfe?.numero_nfe ?? "",
      mes_ref: (c: any) => c.ano_ref * 100 + c.mes_ref,
      tipo: (c: any) => c.tipo ?? "",
      base_calculo: (c: any) => Number(c.base_calculo),
      percentual_aplicado: (c: any) => Number(c.percentual_aplicado),
      valor_comissao: (c: any) => Number(c.valor_comissao),
      status: (c: any) => (c.pago_em ? "pago" : "pendente"),
      pago_em: (c: any) => c.pago_em ?? "",
    },
  });

  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-bold border-l-4 border-[#1a6b3a] pl-3">Minhas comissões</h1>

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
                <SortableTableHead sortKey="pedido" sortConfig={repSort.sortConfig} onSort={repSort.requestSort}>Pedido</SortableTableHead>
                <SortableTableHead sortKey="cliente" sortConfig={repSort.sortConfig} onSort={repSort.requestSort}>Cliente</SortableTableHead>
                <SortableTableHead sortKey="nfe" sortConfig={repSort.sortConfig} onSort={repSort.requestSort}>NF-e</SortableTableHead>
                <SortableTableHead sortKey="mes_ref" sortConfig={repSort.sortConfig} onSort={repSort.requestSort}>Mês ref</SortableTableHead>
                <SortableTableHead sortKey="tipo" sortConfig={repSort.sortConfig} onSort={repSort.requestSort}>Tipo</SortableTableHead>
                <SortableTableHead sortKey="base_calculo" sortConfig={repSort.sortConfig} onSort={repSort.requestSort}>Base</SortableTableHead>
                <SortableTableHead sortKey="percentual_aplicado" sortConfig={repSort.sortConfig} onSort={repSort.requestSort}>%</SortableTableHead>
                <SortableTableHead sortKey="valor_comissao" sortConfig={repSort.sortConfig} onSort={repSort.requestSort}>Comissão</SortableTableHead>
                <SortableTableHead sortKey="status" sortConfig={repSort.sortConfig} onSort={repSort.requestSort}>Status</SortableTableHead>
                <SortableTableHead sortKey="pago_em" sortConfig={repSort.sortConfig} onSort={repSort.requestSort}>Pago em</SortableTableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {repSort.sortedData.map((c: any, index: number) => (
                <MotionTableRow key={c.id} {...rowMotionProps(index)}>
                  <TableCell className="font-mono text-xs">{c.pedidos?.numero_pedido}</TableCell>
                  <TableCell>{c.pedidos?.clientes?.nome}</TableCell>
                  <TableCell className="font-mono text-xs">{c.nfe?.numero_nfe}</TableCell>
                  <TableCell>{String(c.mes_ref).padStart(2, "0")}/{c.ano_ref}</TableCell>
                  <TableCell><TipoComissaoBadge tipo={c.tipo} /></TableCell>
                  <TableCell>{fmtBRL(c.base_calculo)}</TableCell>
                  <TableCell>{Number(c.percentual_aplicado).toFixed(2)}%</TableCell>
                  <TableCell className="font-semibold">{fmtBRL(c.valor_comissao)}</TableCell>
                  <TableCell><StatusBadge pago={!!c.pago_em} /></TableCell>
                  <TableCell>{formatarData(c.pago_em)}</TableCell>
                </MotionTableRow>
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
