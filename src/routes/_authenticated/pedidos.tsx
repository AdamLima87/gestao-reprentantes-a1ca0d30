import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { useAuth } from "@/hooks/use-auth";
import { toast } from "sonner";

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
  const isAdmin = roles.includes("admin");
  const isInterno = roles.includes("vendedor_interno");
  const isFinanceiro = roles.includes("financeiro");
  const canCreate = isAdmin || isInterno || roles.includes("representante");
  const canToggleJeff = isAdmin || isInterno;
  const qc = useQueryClient();

  const [filterStatus, setFilterStatus] = useState<string>("todos");
  const [filterRep, setFilterRep] = useState<string>("todos");

  const { data: reps } = useQuery({
    queryKey: ["reps"],
    queryFn: async () => (await supabase.from("representantes").select("*").order("nome")).data ?? [],
  });
  const { data: clientes } = useQuery({
    queryKey: ["clientes"],
    queryFn: async () => (await supabase.from("clientes").select("*").order("nome")).data ?? [],
  });
  const { data: pedidos, isLoading } = useQuery({
    queryKey: ["pedidos", filterStatus, filterRep],
    queryFn: async () => {
      let q = supabase.from("pedidos").select("*, clientes(nome), representantes(nome)").order("criado_em", { ascending: false });
      if (filterStatus !== "todos") q = q.eq("status", filterStatus as typeof STATUS[number]);
      if (filterRep !== "todos") q = q.eq("representante_id", filterRep);
      return (await q).data ?? [];
    },
  });

  const advance = async (id: string, current: string) => {
    const next = NEXT_STATUS[current];
    if (!next) return;
    if (next === "faturado") {
      toast.info("Para marcar como faturado, registre uma NF-e.");
      return;
    }
    const { error } = await supabase.from("pedidos").update({ status: next as typeof STATUS[number] }).eq("id", id);
    if (error) return toast.error(error.message);
    qc.invalidateQueries({ queryKey: ["pedidos"] });
  };

  const cancel = async (id: string) => {
    if (!confirm("Cancelar este pedido?")) return;
    const { error } = await supabase.from("pedidos").update({ status: "cancelado" }).eq("id", id);
    if (error) return toast.error(error.message);
    qc.invalidateQueries({ queryKey: ["pedidos"] });
  };

  const toggleJeff = async (id: string, v: boolean) => {
    const { error } = await supabase.from("pedidos").update({ jefferson_participou: v }).eq("id", id);
    if (error) return toast.error(error.message);
    qc.invalidateQueries({ queryKey: ["pedidos"] });
  };

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
                {(pedidos ?? []).map((p) => (
                  <TableRow key={p.id}>
                    <TableCell className="font-mono text-xs">{p.numero_pedido}</TableCell>
                    <TableCell>{p.clientes?.nome ?? "—"}</TableCell>
                    <TableCell>{p.representantes?.nome ?? "—"}</TableCell>
                    <TableCell>{p.data_pedido}</TableCell>
                    <TableCell>{p.prazo_entrega ?? "—"}</TableCell>
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
                      {isAdmin && p.status !== "cancelado" && (
                        <Button size="sm" variant="destructive" onClick={() => cancel(p.id)}>Cancelar</Button>
                      )}
                    </TableCell>
                  </TableRow>
                ))}
                {(pedidos ?? []).length === 0 && (
                  <TableRow><TableCell colSpan={9} className="text-center text-muted-foreground py-6">Nenhum pedido.</TableCell></TableRow>
                )}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

function NovoPedidoDialog({ reps, clientes, myRepId, onDone }: {
  reps: any[]; clientes: any[]; myRepId: string | null; onDone: () => void;
}) {
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({
    numero_pedido: "",
    numero_pedido_cliente: "",
    cliente_id: "",
    representante_id: myRepId ?? "",
    data_pedido: new Date().toISOString().slice(0, 10),
    prazo_entrega: "",
    valor_produtos: "",
    jefferson_participou: false,
  });

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.cliente_id || !form.representante_id || !form.numero_pedido) {
      toast.error("Preencha os campos obrigatórios.");
      return;
    }
    const d = new Date(form.data_pedido);
    const { error } = await supabase.from("pedidos").insert({
      numero_pedido: form.numero_pedido,
      numero_pedido_cliente: form.numero_pedido_cliente || null,
      cliente_id: form.cliente_id,
      representante_id: form.representante_id,
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
          <div><Label>Representante *</Label>
            <Select value={form.representante_id} onValueChange={(v) => setForm({ ...form, representante_id: v })}>
              <SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger>
              <SelectContent>{reps.map((r) => <SelectItem key={r.id} value={r.id}>{r.nome}</SelectItem>)}</SelectContent>
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
          <DialogFooter><Button type="submit">Salvar</Button></DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
