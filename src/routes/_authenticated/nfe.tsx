import { createFileRoute } from "@tanstack/react-router";
import { motion } from "framer-motion";
import { formatarData } from "@/lib/utils";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { SortableTableHead } from "@/components/ui/sortable-table-head";
import { useSortableData } from "@/hooks/use-sortable-data";
import { MotionTableRow, rowMotionProps } from "@/components/MotionTableRow";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { MessageSquareText } from "lucide-react";
import { useAuth } from "@/hooks/use-auth";
import { usePermissions } from "@/hooks/use-permissions";
import { toast } from "sonner";
import { Pencil, Trash2 } from "lucide-react";

export const Route = createFileRoute("/_authenticated/nfe")({
  component: NfePage,
});

const fmtBRL = (n: number | string) => Number(n).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

function NfePage() {
  const { representanteId } = useAuth();
  const { can } = usePermissions();
  const canVer = can("ver_nfe");
  const canCreate = can("registrar_nfe");
  const canEntrega = can("registrar_entrega");
  const canExcluir = can("excluir_nfe");
  const verTodas = can("ver_todas_nfe");
  const canEdit = canCreate;
  const qc = useQueryClient();
  const [editing, setEditing] = useState<any | null>(null);

  const { data: nfes, isLoading } = useQuery({
    queryKey: ["nfes", verTodas, representanteId],
    enabled: canVer,
    queryFn: async () => {
      let q = supabase.from("nfe").select("*, pedidos!inner(numero_pedido, representante_id, clientes(nome), representantes(nome))").order("criado_em", { ascending: false });
      if (!verTodas && representanteId) q = q.eq("pedidos.representante_id", representanteId);
      return (await q).data ?? [];
    },
  });
  const { data: pedidos } = useQuery({
    queryKey: ["pedidos-para-nfe"],
    enabled: canCreate,
    queryFn: async () => (await supabase.from("pedidos").select("id, numero_pedido, valor_produtos, clientes(nome)").not("status", "in", '("cancelado","entregue")').order("criado_em", { ascending: false })).data ?? [],
  });

  const nfeSort = useSortableData(nfes ?? [], {
    accessors: {
      pedido: (n: any) => n.pedidos?.numero_pedido,
      cliente: (n: any) => n.pedidos?.clientes?.nome,
      rep: (n: any) => n.pedidos?.representantes?.nome,
      valor_nfe: (n: any) => Number(n.valor_nfe),
      mes_ano: (n: any) => `${n.ano_ref}-${String(n.mes_ref).padStart(2, "0")}`,
      observacao: (n: any) => n.observacao ?? "",
    },
  });

  if (!canVer) {
    return <p className="text-muted-foreground">Você não tem permissão para ver NF-es.</p>;
  }


  return (
    <TooltipProvider>
      <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.3, ease: "easeOut" }} className="space-y-4">
        <div className="flex items-center justify-between">
          <h1 className="text-2xl font-bold border-l-4 border-[#6b46c1] pl-3">NF-e</h1>
          {canCreate && <NovaNfeDialog pedidos={pedidos ?? []} onDone={() => {
            qc.invalidateQueries({ queryKey: ["nfes"] });
            qc.invalidateQueries({ queryKey: ["pedidos"] });
            qc.invalidateQueries({ queryKey: ["comissoes"] });
            qc.invalidateQueries({ queryKey: ["dashboard"] });
          }} />}
        </div>

        <Card>
          <CardHeader><CardTitle>Notas emitidas</CardTitle></CardHeader>
          <CardContent>
            {isLoading ? <p>Carregando…</p> : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <SortableTableHead sortKey="numero_nfe" sortConfig={nfeSort.sortConfig} onSort={nfeSort.requestSort}>Nº NF-e</SortableTableHead>
                    <SortableTableHead sortKey="data_nfe" sortConfig={nfeSort.sortConfig} onSort={nfeSort.requestSort}>Data</SortableTableHead>
                    <SortableTableHead sortKey="pedido" sortConfig={nfeSort.sortConfig} onSort={nfeSort.requestSort}>Pedido</SortableTableHead>
                    <SortableTableHead sortKey="cliente" sortConfig={nfeSort.sortConfig} onSort={nfeSort.requestSort}>Cliente</SortableTableHead>
                    <SortableTableHead sortKey="rep" sortConfig={nfeSort.sortConfig} onSort={nfeSort.requestSort}>Rep</SortableTableHead>
                    <SortableTableHead sortKey="valor_nfe" sortConfig={nfeSort.sortConfig} onSort={nfeSort.requestSort}>Valor</SortableTableHead>
                    <SortableTableHead sortKey="mes_ano" sortConfig={nfeSort.sortConfig} onSort={nfeSort.requestSort}>Mês/Ano ref</SortableTableHead>
                    <SortableTableHead sortKey="data_entrega" sortConfig={nfeSort.sortConfig} onSort={nfeSort.requestSort}>Entrega</SortableTableHead>
                    <SortableTableHead sortKey="observacao" sortConfig={nfeSort.sortConfig} onSort={nfeSort.requestSort}>Obs.</SortableTableHead>
                    <TableHead></TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {nfeSort.sortedData.map((n: any, index: number) => (
                    <MotionTableRow key={n.id} {...rowMotionProps(index)}>

                      <TableCell className="font-mono text-xs">{n.numero_nfe}</TableCell>
                      <TableCell>{formatarData(n.data_nfe)}</TableCell>
                      <TableCell>{n.pedidos?.numero_pedido}</TableCell>
                      <TableCell>{n.pedidos?.clientes?.nome}</TableCell>
                      <TableCell>{n.pedidos?.representantes?.nome}</TableCell>
                      <TableCell>{fmtBRL(n.valor_nfe)}</TableCell>
                      <TableCell>{String(n.mes_ref).padStart(2, "0")}/{n.ano_ref}</TableCell>
                      <TableCell>{formatarData(n.data_entrega)}</TableCell>
                      <TableCell>
                        {n.observacao ? (
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <button type="button" className="text-muted-foreground hover:text-foreground">
                                <MessageSquareText className="h-4 w-4" />
                              </button>
                            </TooltipTrigger>
                            <TooltipContent className="max-w-xs whitespace-pre-wrap">{n.observacao}</TooltipContent>
                          </Tooltip>
                        ) : null}
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex justify-end gap-2">
                          {!n.data_entrega && canEntrega && (
                            <RegistrarEntregaDialog
                              nfeId={n.id}
                              pedidoId={n.pedido_id}
                              onDone={() => {
                                qc.invalidateQueries({ queryKey: ["nfes"] });
                                qc.invalidateQueries({ queryKey: ["pedidos"] });
                                qc.invalidateQueries({ queryKey: ["dashboard"] });
                              }}
                            />
                          )}
                          {canExcluir && (
                            <ExcluirNfeDialog
                              nfeId={n.id}
                              numeroNfe={n.numero_nfe}
                              onDone={() => {
                                qc.invalidateQueries({ queryKey: ["nfes"] });
                                qc.invalidateQueries({ queryKey: ["pedidos"] });
                                qc.invalidateQueries({ queryKey: ["comissoes"] });
                                qc.invalidateQueries({ queryKey: ["dashboard"] });
                                qc.refetchQueries({ queryKey: ["pedidos-para-nfe"] });
                              }}
                            />
                          )}
                        </div>
                      </TableCell>
                    </MotionTableRow>
                  ))}
                  {(nfes ?? []).length === 0 && <TableRow><TableCell colSpan={10} className="text-center text-muted-foreground py-6">Nenhuma NF-e ainda.</TableCell></TableRow>}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>
      </motion.div>
    </TooltipProvider>
  );
}


function NovaNfeDialog({ pedidos, onDone }: { pedidos: any[]; onDone: () => void }) {
  const [open, setOpen] = useState(false);
  const [valoresIguais, setValoresIguais] = useState(true);
  const [form, setForm] = useState({
    pedido_id: "",
    numero_nfe: "",
    data_nfe: new Date().toISOString().slice(0, 10),
    valor_nfe: "",
    valor_produtos: "",
    data_entrega: "",
    observacao: "",
  });

  // Mantém valor_nfe sincronizado com valor_produtos quando toggle ativo
  useEffect(() => {
    if (valoresIguais && (form.valor_produtos !== form.valor_nfe || form.observacao)) {
      setForm((f) => ({ ...f, valor_nfe: f.valor_produtos, observacao: "" }));
    }
  }, [valoresIguais, form.valor_produtos, form.valor_nfe, form.observacao]);

  const vNfe = Number(form.valor_nfe) || 0;
  const vProd = Number(form.valor_produtos) || 0;
  const obsObrigatoria = !valoresIguais && vNfe > 0 && vProd > 0 && vNfe < vProd;
  const obsOpcional = !valoresIguais && vNfe > 0 && vProd > 0 && vNfe > vProd;

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.pedido_id || !form.numero_nfe || !form.valor_nfe) {
      toast.error("Preencha os campos obrigatórios.");
      return;
    }
    if (obsObrigatoria && !form.observacao.trim()) {
      toast.error("Observação obrigatória quando o valor da nota for menor que o valor dos produtos.");
      return;
    }
    const d = new Date(form.data_nfe);
    const { error } = await supabase.from("nfe").insert({
      pedido_id: form.pedido_id,
      numero_nfe: form.numero_nfe,
      data_nfe: form.data_nfe,
      valor_nfe: Number(form.valor_nfe),
      mes_ref: d.getMonth() + 1,
      ano_ref: d.getFullYear(),
      data_entrega: form.data_entrega || null,
      observacao: form.observacao.trim() ? form.observacao.trim() : null,
    });
    if (error) return toast.error(error.message);
    if (form.data_entrega) {
      const { error: errPed } = await supabase
        .from("pedidos")
        .update({ status: "entregue" })
        .eq("id", form.pedido_id)
        .neq("status", "cancelado");
      if (errPed) toast.error("NF-e salva, mas falha ao marcar pedido como entregue: " + errPed.message);
    }
    toast.success("NF-e registrada! Comissões calculadas automaticamente.");
    setOpen(false);
    await new Promise((resolve) => setTimeout(resolve, 1000));
    onDone();
  };

  return (
    <Dialog open={open} onOpenChange={(o) => {
      setOpen(o);
      if (!o) {
        setValoresIguais(true);
        setForm({ pedido_id: "", numero_nfe: "", data_nfe: new Date().toISOString().slice(0, 10), valor_nfe: "", valor_produtos: "", data_entrega: "", observacao: "" });
      }
    }}>
      <DialogTrigger asChild><Button>+ Nova NF-e</Button></DialogTrigger>
      <DialogContent className="max-w-lg">
        <DialogHeader><DialogTitle>Registrar NF-e</DialogTitle></DialogHeader>
        <form onSubmit={submit} className="space-y-3">
          <div><Label>Pedido *</Label>
            <Select value={form.pedido_id} onValueChange={(v) => {
              const p = pedidos.find((x) => x.id === v);
              const vp = String(p?.valor_produtos ?? "");
              setForm({ ...form, pedido_id: v, valor_produtos: vp, valor_nfe: valoresIguais ? vp : form.valor_nfe });
            }}>
              <SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger>
              <SelectContent>
                {pedidos.map((p) => <SelectItem key={p.id} value={p.id}>{p.numero_pedido} — {p.clientes?.nome}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div><Label>Nº NF-e *</Label><Input value={form.numero_nfe} onChange={(e) => setForm({ ...form, numero_nfe: e.target.value })} required /></div>
            <div><Label>Data emissão *</Label><Input type="date" value={form.data_nfe} onChange={(e) => setForm({ ...form, data_nfe: e.target.value })} required /></div>
          </div>
          <div><Label>Valor produtos (R$)</Label><Input type="number" step="0.01" value={form.valor_produtos} disabled readOnly /></div>
          <div className="flex items-center gap-2">
            <Switch id="valores-iguais" checked={valoresIguais} onCheckedChange={setValoresIguais} />
            <Label htmlFor="valores-iguais" className="cursor-pointer">Valor da nota igual ao valor dos produtos</Label>
          </div>
          <div>
            <Label>Valor da nota (R$) *</Label>
            <Input
              type="number"
              step="0.01"
              value={form.valor_nfe}
              onChange={(e) => setForm({ ...form, valor_nfe: e.target.value })}
              disabled={valoresIguais}
              readOnly={valoresIguais}
              required
            />
          </div>
          {(obsObrigatoria || obsOpcional) && (
            <div>
              <Label>{obsObrigatoria ? "Observação (obrigatória)" : "Observação (opcional)"}</Label>
              <Textarea
                value={form.observacao}
                onChange={(e) => setForm({ ...form, observacao: e.target.value })}
                placeholder={obsObrigatoria
                  ? "Explique por que o valor da nota é menor que o valor dos produtos (ex: desconto comercial, ajuste fiscal...)"
                  : "Observação (opcional)"}
                rows={3}
                required={obsObrigatoria}
              />
              {obsObrigatoria && !form.observacao.trim() && (
                <p className="text-xs text-destructive mt-1">Observação obrigatória quando o valor da nota for menor que o valor dos produtos.</p>
              )}
            </div>
          )}
          <div><Label>Data entrega</Label><Input type="date" value={form.data_entrega} onChange={(e) => setForm({ ...form, data_entrega: e.target.value })} /></div>
          <DialogFooter>
            <Button type="submit" disabled={obsObrigatoria && !form.observacao.trim()}>Salvar e calcular comissões</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function RegistrarEntregaDialog({ nfeId, pedidoId, onDone }: { nfeId: string; pedidoId: string; onDone: () => void }) {
  const [open, setOpen] = useState(false);
  const [data, setData] = useState(new Date().toISOString().slice(0, 10));
  const [saving, setSaving] = useState(false);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!data) {
      toast.error("Informe a data de entrega.");
      return;
    }
    setSaving(true);
    const { error } = await supabase.from("nfe").update({ data_entrega: data }).eq("id", nfeId);
    if (error) {
      setSaving(false);
      return toast.error(error.message);
    }
    const { error: errPed } = await supabase
      .from("pedidos")
      .update({ status: "entregue" })
      .eq("id", pedidoId)
      .neq("status", "cancelado");
    setSaving(false);
    if (errPed) return toast.error("Entrega salva, mas falha ao atualizar pedido: " + errPed.message);
    toast.success("Entrega registrada!");
    setOpen(false);
    onDone();
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm">Registrar entrega</Button>
      </DialogTrigger>
      <DialogContent className="max-w-sm">
        <DialogHeader><DialogTitle>Registrar entrega</DialogTitle></DialogHeader>
        <form onSubmit={submit} className="space-y-3">
          <div>
            <Label>Data de entrega *</Label>
            <Input type="date" value={data} onChange={(e) => setData(e.target.value)} required />
          </div>
          <DialogFooter>
            <Button type="submit" disabled={saving}>Confirmar entrega</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function ExcluirNfeDialog({ nfeId, numeroNfe, onDone }: { nfeId: string; numeroNfe: string; onDone: () => void }) {
  const [open, setOpen] = useState(false);
  const [deleting, setDeleting] = useState(false);

  const confirmar = async () => {
    setDeleting(true);
    const { error } = await supabase.from("nfe").delete().eq("id", nfeId);
    setDeleting(false);
    if (error) return toast.error("Erro ao excluir NF-e: " + error.message);
    toast.success("NF-e excluída. Pedido disponível para edição novamente.");
    setOpen(false);
    onDone();
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="ghost" size="icon" className="text-destructive hover:text-destructive" title="Excluir NF-e">
          <Trash2 className="h-4 w-4" />
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-md">
        <DialogHeader><DialogTitle>Excluir NF-e {numeroNfe}</DialogTitle></DialogHeader>
        <p className="text-sm text-muted-foreground">
          Ao excluir esta NF-e, o pedido voltará para o status anterior e as comissões geradas por ela serão removidas automaticamente. Esta ação não pode ser desfeita.
        </p>
        <DialogFooter>
          <Button variant="outline" onClick={() => setOpen(false)} disabled={deleting}>Cancelar</Button>
          <Button variant="destructive" onClick={confirmar} disabled={deleting}>
            {deleting ? "Excluindo…" : "Confirmar exclusão"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
