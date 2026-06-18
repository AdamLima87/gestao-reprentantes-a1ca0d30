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
import { useAuth } from "@/hooks/use-auth";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/nfe")({
  component: NfePage,
});

const fmtBRL = (n: number | string) => Number(n).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

function NfePage() {
  const { roles } = useAuth();
  const canCreate = roles.includes("admin") || roles.includes("vendedor_interno");
  const qc = useQueryClient();

  const { data: nfes, isLoading } = useQuery({
    queryKey: ["nfes"],
    queryFn: async () => (await supabase.from("nfe").select("*, pedidos(numero_pedido, clientes(nome), representantes(nome))").order("criado_em", { ascending: false })).data ?? [],
  });
  const { data: pedidos } = useQuery({
    queryKey: ["pedidos-disponiveis"],
    enabled: canCreate,
    queryFn: async () => (await supabase.from("pedidos").select("id, numero_pedido, valor_produtos, clientes(nome)").not("status", "in", "(cancelado)").order("criado_em", { ascending: false })).data ?? [],
  });

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">NF-e</h1>
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
                  <TableHead>Nº NF-e</TableHead><TableHead>Data</TableHead><TableHead>Pedido</TableHead>
                  <TableHead>Cliente</TableHead><TableHead>Rep</TableHead><TableHead>Valor</TableHead><TableHead>Mês/Ano ref</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {(nfes ?? []).map((n) => (
                  <TableRow key={n.id}>
                    <TableCell className="font-mono text-xs">{n.numero_nfe}</TableCell>
                    <TableCell>{n.data_nfe}</TableCell>
                    <TableCell>{n.pedidos?.numero_pedido}</TableCell>
                    <TableCell>{n.pedidos?.clientes?.nome}</TableCell>
                    <TableCell>{n.pedidos?.representantes?.nome}</TableCell>
                    <TableCell>{fmtBRL(n.valor_nfe)}</TableCell>
                    <TableCell>{String(n.mes_ref).padStart(2, "0")}/{n.ano_ref}</TableCell>
                  </TableRow>
                ))}
                {(nfes ?? []).length === 0 && <TableRow><TableCell colSpan={7} className="text-center text-muted-foreground py-6">Nenhuma NF-e ainda.</TableCell></TableRow>}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

function NovaNfeDialog({ pedidos, onDone }: { pedidos: any[]; onDone: () => void }) {
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({
    pedido_id: "",
    numero_nfe: "",
    data_nfe: new Date().toISOString().slice(0, 10),
    valor_nfe: "",
    data_entrega: "",
  });

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.pedido_id || !form.numero_nfe || !form.valor_nfe) {
      toast.error("Preencha os campos obrigatórios.");
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
    });
    if (error) return toast.error(error.message);
    toast.success("NF-e registrada! Comissões calculadas automaticamente.");
    setOpen(false);
    await new Promise((resolve) => setTimeout(resolve, 800));
    onDone();
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild><Button>+ Nova NF-e</Button></DialogTrigger>
      <DialogContent className="max-w-lg">
        <DialogHeader><DialogTitle>Registrar NF-e</DialogTitle></DialogHeader>
        <form onSubmit={submit} className="space-y-3">
          <div><Label>Pedido *</Label>
            <Select value={form.pedido_id} onValueChange={(v) => {
              const p = pedidos.find((x) => x.id === v);
              setForm({ ...form, pedido_id: v, valor_nfe: form.valor_nfe || String(p?.valor_produtos ?? "") });
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
          <div className="grid grid-cols-2 gap-3">
            <div><Label>Valor NF-e (R$) *</Label><Input type="number" step="0.01" value={form.valor_nfe} onChange={(e) => setForm({ ...form, valor_nfe: e.target.value })} required /></div>
            <div><Label>Data entrega</Label><Input type="date" value={form.data_entrega} onChange={(e) => setForm({ ...form, data_entrega: e.target.value })} /></div>
          </div>
          <DialogFooter><Button type="submit">Salvar e calcular comissões</Button></DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
