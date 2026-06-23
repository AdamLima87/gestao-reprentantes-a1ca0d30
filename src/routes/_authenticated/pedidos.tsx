import { createFileRoute } from "@tanstack/react-router";
import { formatarData } from "@/lib/utils";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { addBusinessDays } from "@/lib/business-days";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from "@/components/ui/dialog";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { useAuth } from "@/hooks/use-auth";
import { usePermissions } from "@/hooks/use-permissions";
import { toast } from "sonner";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { MoreVertical, Pencil, X as XIcon, Trash2 } from "lucide-react";

export const Route = createFileRoute("/_authenticated/pedidos")({
  component: PedidosPage,
});

const STATUS = ["pedido", "producao", "faturado", "entregue", "cancelado"] as const;
const NEXT_STATUS: Record<string, string | null> = {
  pedido: "producao",
  producao: "faturado",
  faturado: "entregue",
  entregue: null,
  cancelado: null,
};
const fmtBRL = (n: number | string) => Number(n).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

function PedidosPage() {
  const { roles, representanteId } = useAuth();
  const { can } = usePermissions();
  const isAdmin = roles.includes("admin");
  const isInterno = roles.includes("vendedor_interno");
  const isFinanceiro = roles.includes("financeiro");
  const canCreate = can("criar_pedidos");
  const canToggleJeff = isAdmin || isInterno;
  const canEdit = can("editar_pedidos");
  const canCancel = can("cancelar_pedidos");
  const qc = useQueryClient();

  const now = new Date();
  const [filterStatus, setFilterStatus] = useState<string>("todos");
  const [filterRep, setFilterRep] = useState<string>("todos");
  const [filterMes, setFilterMes] = useState<string>("todos");
  const [filterAno, setFilterAno] = useState<string>(String(now.getFullYear()));

  const [editing, setEditing] = useState<any | null>(null);
  const [cancelingId, setCancelingId] = useState<string | null>(null);

  const { data: reps } = useQuery({
    queryKey: ["reps"],
    queryFn: async () => (await supabase.from("representantes").select("*").order("nome")).data ?? [],
  });
  const { data: clientes } = useQuery({
    queryKey: ["clientes"],
    queryFn: async () => (await supabase.from("clientes").select("*").order("nome")).data ?? [],
  });
  const { data: pedidos, isLoading } = useQuery({
    queryKey: ["pedidos", filterStatus, filterRep, filterMes, filterAno],
    refetchOnWindowFocus: true,
    queryFn: async () => {
      let q = supabase.from("pedidos").select("*, clientes(nome), representantes(nome)").order("criado_em", { ascending: false });
      if (filterStatus !== "todos") q = q.eq("status", filterStatus as typeof STATUS[number]);
      if (filterRep !== "todos") q = q.eq("representante_id", filterRep);
      if (filterMes !== "todos") q = q.eq("mes_ref", Number(filterMes));
      if (filterAno !== "todos") q = q.eq("ano_ref", Number(filterAno));
      return (await q).data ?? [];
    },
  });

  const advance = async (id: string, current: string) => {
    const next = NEXT_STATUS[current];
    if (!next) return;
    if (next === "faturado") {
      toast.warning("Status atualizado via NF-e. Registre uma NF-e para este pedido na aba NF-e.");
      return;
    }
    const { error } = await supabase.from("pedidos").update({ status: next as typeof STATUS[number] }).eq("id", id);
    if (error) return toast.error(error.message);
    qc.invalidateQueries({ queryKey: ["pedidos"] });
  };

  const confirmCancel = async () => {
    if (!cancelingId) return;
    const id = cancelingId;
    setCancelingId(null);
    const { error } = await supabase.from("pedidos").update({ status: "cancelado" }).eq("id", id);
    if (error) return toast.error(error.message);
    toast.success("Pedido cancelado. Comissões vinculadas foram removidas.");
    qc.invalidateQueries({ queryKey: ["pedidos"] });
    qc.invalidateQueries({ queryKey: ["comissoes"] });
  };

  const toggleJeff = async (id: string, v: boolean) => {
    const { error } = await supabase.from("pedidos").update({ jefferson_participou: v }).eq("id", id);
    if (error) return toast.error(error.message);
    qc.invalidateQueries({ queryKey: ["pedidos"] });
  };

  const remove = async (id: string) => {
    if (!confirm("Excluir este pedido? Esta ação não pode ser desfeita e removerá NF-es e comissões vinculadas.")) return;
    await supabase.from("comissoes").delete().eq("pedido_id", id);
    await supabase.from("nfe").delete().eq("pedido_id", id);
    const { error } = await supabase.from("pedidos").delete().eq("id", id);
    if (error) return toast.error(error.message);
    toast.success("Pedido excluído.");
    qc.invalidateQueries({ queryKey: ["pedidos"] });
    qc.invalidateQueries({ queryKey: ["nfes"] });
    qc.invalidateQueries({ queryKey: ["comissoes"] });
    qc.invalidateQueries({ queryKey: ["dashboard"] });
  };

  const anoAtual = now.getFullYear();
  const anos = [anoAtual - 2, anoAtual - 1, anoAtual, anoAtual + 1];

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Pedidos</h1>
        {canCreate && <NovoPedidoDialog reps={reps ?? []} clientes={clientes ?? []} myRepId={representanteId} onDone={() => qc.invalidateQueries({ queryKey: ["pedidos"] })} />}
      </div>

      <Card>
        <CardContent className="pt-6 flex flex-wrap gap-3">
          <div className="w-44">
            <Label className="text-xs">Status</Label>
            <Select value={filterStatus} onValueChange={setFilterStatus}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="todos">Todos</SelectItem>
                {STATUS.map((s) => <SelectItem key={s} value={s}>{s}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          {(isAdmin || isInterno || isFinanceiro) && (
            <div className="w-56">
              <Label className="text-xs">Representante</Label>
              <Select value={filterRep} onValueChange={setFilterRep}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="todos">Todos</SelectItem>
                  {(reps ?? []).map((r) => <SelectItem key={r.id} value={r.id}>{r.nome}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
          )}
          <div className="w-40">
            <Label className="text-xs">Mês</Label>
            <Select value={filterMes} onValueChange={setFilterMes}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="todos">Todos os meses</SelectItem>
                {Array.from({ length: 12 }, (_, i) => i + 1).map((m) => (
                  <SelectItem key={m} value={String(m)}>{String(m).padStart(2, "0")}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="w-32">
            <Label className="text-xs">Ano</Label>
            <Select value={filterAno} onValueChange={setFilterAno}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="todos">Todos</SelectItem>
                {anos.map((a) => <SelectItem key={a} value={String(a)}>{a}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle>Lista</CardTitle></CardHeader>
        <CardContent>
          {isLoading ? <p>Carregando…</p> : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Nº Pedido</TableHead>
                  <TableHead>Cliente</TableHead>
                  <TableHead>Rep</TableHead>
                  <TableHead>Data</TableHead>
                  <TableHead>Prazo</TableHead>
                  <TableHead>Valor</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Vend. Interno</TableHead>
                  <TableHead>Ações</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {(pedidos ?? []).map((p) => {
                  const editable = canEdit && p.status !== "entregue" && p.status !== "cancelado";
                  return (
                    <TableRow key={p.id}>
                      <TableCell className="font-mono text-xs">{p.numero_pedido}</TableCell>
                      <TableCell>{p.clientes?.nome ?? "—"}</TableCell>
                      <TableCell>{p.representantes?.nome ?? "—"}</TableCell>
                      <TableCell>{formatarData(p.data_pedido)}</TableCell>
                      <TableCell>{formatarData(p.prazo_entrega)}</TableCell>
                      <TableCell>{fmtBRL(p.valor_produtos)}</TableCell>
                      <TableCell><Badge variant="outline">{p.status}</Badge></TableCell>
                      <TableCell>
                        <Switch
                          checked={p.jefferson_participou}
                          disabled={!canToggleJeff}
                          onCheckedChange={(v) => toggleJeff(p.id, v)}
                        />
                      </TableCell>
                      <TableCell className="space-x-1">
                        {NEXT_STATUS[p.status] && !isFinanceiro && (
                          <Button size="sm" variant="outline" onClick={() => advance(p.id, p.status)}>
                            → {NEXT_STATUS[p.status]}
                          </Button>
                        )}
                        {(() => {
                          const showEdit = editable;
                          const showCancel = canCancel && p.status !== "cancelado" && p.status !== "entregue";
                          const showDelete = isAdmin;
                          const hasAny = showEdit || showCancel || showDelete;
                          if (!hasAny) {
                             return null;
                           }
                          return (
                            <DropdownMenu>
                              <DropdownMenuTrigger asChild>
                                <Button size="sm" variant="ghost" aria-label="Ações">
                                  <MoreVertical className="h-4 w-4" />
                                </Button>
                              </DropdownMenuTrigger>
                              <DropdownMenuContent align="end">
                                {showEdit && (
                                  <DropdownMenuItem onClick={() => setEditing(p)}>
                                    <Pencil className="h-4 w-4 mr-2" /> Editar
                                  </DropdownMenuItem>
                                )}
                                {showEdit && (showCancel || showDelete) && <DropdownMenuSeparator />}
                                {showCancel && (
                                  <DropdownMenuItem onClick={() => setCancelingId(p.id)}>
                                    <XIcon className="h-4 w-4 mr-2" /> Cancelar pedido
                                  </DropdownMenuItem>
                                )}
                                {showDelete && (
                                  <DropdownMenuItem
                                    onClick={() => remove(p.id)}
                                    className="text-destructive focus:text-destructive"
                                  >
                                    <Trash2 className="h-4 w-4 mr-2" /> Excluir
                                  </DropdownMenuItem>
                                )}
                              </DropdownMenuContent>
                            </DropdownMenu>
                          );
                        })()}
                      </TableCell>
                    </TableRow>
                  );
                })}
                {(pedidos ?? []).length === 0 && (
                  <TableRow><TableCell colSpan={9} className="text-center text-muted-foreground py-6">Nenhum pedido.</TableCell></TableRow>
                )}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {editing && (
        <EditarPedidoDialog
          pedido={editing}
          reps={reps ?? []}
          clientes={clientes ?? []}
          onClose={() => setEditing(null)}
          onDone={() => {
            setEditing(null);
            qc.invalidateQueries({ queryKey: ["pedidos"] });
          }}
        />
      )}

      <AlertDialog open={!!cancelingId} onOpenChange={(o) => { if (!o) setCancelingId(null); }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Cancelar pedido?</AlertDialogTitle>
            <AlertDialogDescription>
              Ao cancelar este pedido, todas as comissões vinculadas serão removidas automaticamente. Esta ação não pode ser desfeita.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Voltar</AlertDialogCancel>
            <AlertDialogAction onClick={confirmCancel} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
              Confirmar cancelamento
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

function NovoPedidoDialog({ reps, clientes, myRepId, onDone }: {
  reps: any[]; clientes: any[]; myRepId: string | null; onDone: () => void;
}) {
  const [open, setOpen] = useState(false);
  const today = new Date().toISOString().slice(0, 10);
  const initialForm = {
    numero_pedido: "",
    numero_pedido_cliente: "",
    cliente_id: "",
    representante_id: myRepId ?? "",
    data_pedido: today,
    prazo_entrega: addBusinessDays(today, 15),
    valor_produtos: "",
    jefferson_participou: false,
  };
  const [form, setForm] = useState(initialForm);

  useEffect(() => {
    if (open) {
      const t = new Date().toISOString().slice(0, 10);
      setForm({ ...initialForm, data_pedido: t, prazo_entrega: addBusinessDays(t, 15), representante_id: myRepId ?? "" });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  useEffect(() => {
    if (form.data_pedido) {
      const novo = addBusinessDays(form.data_pedido, 15);
      if (novo !== form.prazo_entrega) setForm((f) => ({ ...f, prazo_entrega: novo }));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [form.data_pedido]);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.cliente_id || !form.numero_pedido) {
      toast.error("Preencha os campos obrigatórios.");
      return;
    }
    const d = new Date(form.data_pedido);
    const { error } = await supabase.from("pedidos").insert({
      numero_pedido: form.numero_pedido,
      numero_pedido_cliente: form.numero_pedido_cliente || null,
      cliente_id: form.cliente_id,
      representante_id: form.representante_id || null,
      data_pedido: form.data_pedido,
      prazo_entrega: form.prazo_entrega || null,
      valor_produtos: Number(form.valor_produtos || 0),
      mes_ref: d.getMonth() + 1,
      ano_ref: d.getFullYear(),
      jefferson_participou: form.jefferson_participou,
    });
    if (error) return toast.error(error.message);
    toast.success("Pedido criado!");
    setOpen(false);
    onDone();
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild><Button>+ Novo pedido</Button></DialogTrigger>
      <DialogContent className="max-w-lg">
        <DialogHeader><DialogTitle>Novo pedido</DialogTitle></DialogHeader>
        <form onSubmit={submit} className="space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <div><Label>Nº Pedido *</Label><Input value={form.numero_pedido} onChange={(e) => setForm({ ...form, numero_pedido: e.target.value })} required /></div>
            <div><Label>Nº Pedido cliente</Label><Input value={form.numero_pedido_cliente} onChange={(e) => setForm({ ...form, numero_pedido_cliente: e.target.value })} /></div>
          </div>
          <div><Label>Cliente *</Label>
            <Select value={form.cliente_id} onValueChange={(v) => setForm({ ...form, cliente_id: v })}>
              <SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger>
              <SelectContent>{clientes.map((c) => <SelectItem key={c.id} value={c.id}>{c.nome}</SelectItem>)}</SelectContent>
            </Select>
          </div>
          <div><Label>Representante</Label>
            <Select value={form.representante_id || "__none__"} onValueChange={(v) => setForm({ ...form, representante_id: v === "__none__" ? "" : v })}>
              <SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="__none__">— Venda interna (sem rep) —</SelectItem>
                {reps.map((r) => <SelectItem key={r.id} value={r.id}>{r.nome}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div><Label>Data pedido</Label><Input type="date" value={form.data_pedido} onChange={(e) => setForm({ ...form, data_pedido: e.target.value })} /></div>
            <div><Label>Prazo entrega <span className="text-xs text-muted-foreground">(15 dias úteis)</span></Label><Input type="date" value={form.prazo_entrega} readOnly className="bg-muted" /></div>
          </div>
          <div><Label>Valor produtos (R$)</Label><Input type="number" step="0.01" value={form.valor_produtos} onChange={(e) => setForm({ ...form, valor_produtos: e.target.value })} /></div>
          <div className="flex items-center gap-2">
            <Switch checked={form.jefferson_participou} onCheckedChange={(v) => setForm({ ...form, jefferson_participou: v })} />
            <Label className="!mt-0">Vendedor interno participou?</Label>
          </div>
          <DialogFooter><Button type="submit">Salvar</Button></DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function EditarPedidoDialog({ pedido, reps, clientes, onClose, onDone }: {
  pedido: any; reps: any[]; clientes: any[]; onClose: () => void; onDone: () => void;
}) {
  const [form, setForm] = useState({
    numero_pedido: pedido.numero_pedido ?? "",
    numero_pedido_cliente: pedido.numero_pedido_cliente ?? "",
    cliente_id: pedido.cliente_id ?? "",
    representante_id: pedido.representante_id ?? "",
    data_pedido: pedido.data_pedido ?? new Date().toISOString().slice(0, 10),
    prazo_entrega: pedido.prazo_entrega ?? "",
    valor_produtos: String(pedido.valor_produtos ?? ""),
    jefferson_participou: !!pedido.jefferson_participou,
  });

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.cliente_id || !form.numero_pedido) {
      toast.error("Preencha os campos obrigatórios.");
      return;
    }
    const d = new Date(form.data_pedido);
    const { error } = await supabase.from("pedidos").update({
      numero_pedido: form.numero_pedido,
      numero_pedido_cliente: form.numero_pedido_cliente || null,
      cliente_id: form.cliente_id,
      representante_id: form.representante_id || null,
      data_pedido: form.data_pedido,
      prazo_entrega: form.prazo_entrega || null,
      valor_produtos: Number(form.valor_produtos || 0),
      mes_ref: d.getMonth() + 1,
      ano_ref: d.getFullYear(),
      jefferson_participou: form.jefferson_participou,
    }).eq("id", pedido.id);
    if (error) return toast.error(error.message);
    toast.success("Pedido atualizado!");
    onDone();
  };

  return (
    <Dialog open onOpenChange={(o) => { if (!o) onClose(); }}>
      <DialogContent className="max-w-lg">
        <DialogHeader><DialogTitle>Editar pedido</DialogTitle></DialogHeader>
        <form onSubmit={submit} className="space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <div><Label>Nº Pedido *</Label><Input value={form.numero_pedido} onChange={(e) => setForm({ ...form, numero_pedido: e.target.value })} required /></div>
            <div><Label>Nº Pedido cliente</Label><Input value={form.numero_pedido_cliente} onChange={(e) => setForm({ ...form, numero_pedido_cliente: e.target.value })} /></div>
          </div>
          <div><Label>Cliente *</Label>
            <Select value={form.cliente_id} onValueChange={(v) => setForm({ ...form, cliente_id: v })}>
              <SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger>
              <SelectContent>{clientes.map((c) => <SelectItem key={c.id} value={c.id}>{c.nome}</SelectItem>)}</SelectContent>
            </Select>
          </div>
          <div><Label>Representante</Label>
            <Select value={form.representante_id || "__none__"} onValueChange={(v) => setForm({ ...form, representante_id: v === "__none__" ? "" : v })}>
              <SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="__none__">— Venda interna (sem rep) —</SelectItem>
                {reps.map((r) => <SelectItem key={r.id} value={r.id}>{r.nome}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div><Label>Data pedido</Label><Input type="date" value={form.data_pedido} onChange={(e) => setForm({ ...form, data_pedido: e.target.value })} /></div>
            <div><Label>Prazo entrega</Label><Input type="date" value={form.prazo_entrega} onChange={(e) => setForm({ ...form, prazo_entrega: e.target.value })} /></div>
          </div>
          <div><Label>Valor produtos (R$)</Label><Input type="number" step="0.01" value={form.valor_produtos} onChange={(e) => setForm({ ...form, valor_produtos: e.target.value })} /></div>
          <div className="flex items-center gap-2">
            <Switch checked={form.jefferson_participou} onCheckedChange={(v) => setForm({ ...form, jefferson_participou: v })} />
            <Label className="!mt-0">Vendedor interno participou?</Label>
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={onClose}>Cancelar</Button>
            <Button type="submit">Salvar</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
