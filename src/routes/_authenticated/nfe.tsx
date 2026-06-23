import { createFileRoute } from "@tanstack/react-router";
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
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { MessageSquareText } from "lucide-react";
import { useAuth } from "@/hooks/use-auth";
import { usePermissions } from "@/hooks/use-permissions";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/nfe")({
  component: NfePage,
});

const fmtBRL = (n: number | string) => Number(n).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

function NfePage() {
  useAuth();
  const { can } = usePermissions();
  const canCreate = can("registrar_nfe");
  const qc = useQueryClient();

  const { data: nfes, isLoading } = useQuery({
    queryKey: ["nfes"],
    queryFn: async () => (await supabase.from("nfe").select("*, pedidos(numero_pedido, clientes(nome), representantes(nome))").order("criado_em", { ascending: false })).data ?? [],
  });
  const { data: pedidos } = useQuery({
    queryKey: ["pedidos-disponiveis"],
    enabled: canCreate,
    queryFn: async () => (await supabase.from("pedidos").select("id, numero_pedido, valor_produtos, clientes(nome)").in("status", ["pedido", "producao", "faturado"]).order("criado_em", { ascending: false })).data ?? [],
  });

  return (
    <TooltipProvider>
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
                    <TableHead>Cliente</TableHead><TableHead>Rep</TableHead><TableHead>Valor</TableHead><TableHead>Mês/Ano ref</TableHead><TableHead>Entrega</TableHead><TableHead>Obs.</TableHead><TableHead></TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {(nfes ?? []).map((n) => (
                    <TableRow key={n.id}>
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
                        {!n.data_entrega && canCreate && (
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
                      </TableCell>
                    </TableRow>
                  ))}
                  {(nfes ?? []).length === 0 && <TableRow><TableCell colSpan={10} className="text-center text-muted-foreground py-6">Nenhuma NF-e ainda.</TableCell></TableRow>}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>
      </div>
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
    if (valoresIguais && form.valor_produtos !== form.valor_nfe) {
      setForm((f) => ({ ...f, valor_nfe: f.valor_produtos }));
    }
  }, [valoresIguais, form.valor_produtos, form.valor_nfe]);

  const valoresDiferem = !valoresIguais && Number(form.valor_nfe) !== Number(form.valor_produtos);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.pedido_id || !form.numero_nfe || !form.valor_nfe) {
      toast.error("Preencha os campos obrigatórios.");
      return;
    }
    if (valoresDiferem && !form.observacao.trim()) {
      toast.error("Informe a observação explicando a diferença entre os valores.");
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
      observacao: valoresDiferem ? form.observacao.trim() : null,
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
          {!valoresIguais && (
            <div>
              <Label>Observação (obrigatória)</Label>
              <Textarea
                value={form.observacao}
                onChange={(e) => setForm({ ...form, observacao: e.target.value })}
                placeholder="Explique a diferença entre o valor dos produtos e o valor da nota (ex: frete incluso, desconto comercial, ajuste fiscal...)"
                rows={3}
                required={valoresDiferem}
              />
              {valoresDiferem && !form.observacao.trim() && (
                <p className="text-xs text-destructive mt-1">Observação obrigatória quando o valor da nota difere do valor dos produtos.</p>
              )}
            </div>
          )}
          <div><Label>Data entrega</Label><Input type="date" value={form.data_entrega} onChange={(e) => setForm({ ...form, data_entrega: e.target.value })} /></div>
          <DialogFooter>
            <Button type="submit" disabled={valoresDiferem && !form.observacao.trim()}>Salvar e calcular comissões</Button>
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
