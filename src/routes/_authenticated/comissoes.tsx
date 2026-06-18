import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { useAuth } from "@/hooks/use-auth";

export const Route = createFileRoute("/_authenticated/comissoes")({
  component: ComissoesPage,
});

const fmtBRL = (n: number | string) => Number(n).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

const TIPO_LABEL: Record<string, string> = {
  externo: "Representante",
  interno_sobre_rep: "Vend. Interno 0,5%",
  interno_novo: "Vend. Interno - Cliente Novo",
  interno_reativacao: "Vend. Interno - Reativação",
  interno_recorrente: "Vend. Interno - Recorrente",
};

function ComissoesPage() {
  const { roles, representanteId } = useAuth();
  const isRepOnly = roles.includes("representante") && !roles.some((r) => ["admin", "vendedor_interno", "financeiro"].includes(r));

  const now = new Date();
  const [mes, setMes] = useState(now.getMonth() + 1);
  const [ano, setAno] = useState(now.getFullYear());
  const [repFilter, setRepFilter] = useState<string>(isRepOnly && representanteId ? representanteId : "todos");

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

  const total = (data ?? []).reduce((s, c) => s + Number(c.valor_comissao), 0);

  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-bold">Comissões</h1>

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
          {!isRepOnly && (
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
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {(data ?? []).map((c) => (
                    <TableRow key={c.id}>
                      <TableCell>{c.representantes?.nome}</TableCell>
                      <TableCell className="font-mono text-xs">{c.pedidos?.numero_pedido}</TableCell>
                      <TableCell>{c.pedidos?.clientes?.nome}</TableCell>
                      <TableCell className="font-mono text-xs">{c.nfe?.numero_nfe}</TableCell>
                      <TableCell>{fmtBRL(c.base_calculo)}</TableCell>
                      <TableCell><Badge variant="outline">{TIPO_LABEL[c.tipo] ?? c.tipo}</Badge></TableCell>
                      <TableCell>{Number(c.percentual_aplicado).toFixed(2)}%</TableCell>
                      <TableCell className="font-semibold">{fmtBRL(c.valor_comissao)}</TableCell>
                    </TableRow>
                  ))}
                  {(data ?? []).length === 0 && <TableRow><TableCell colSpan={8} className="text-center text-muted-foreground py-6">Sem comissões no período.</TableCell></TableRow>}
                </TableBody>
              </Table>
              <div className="mt-4 flex justify-end text-lg">
                <span className="mr-3 text-muted-foreground">Total a pagar:</span>
                <span className="font-bold">{fmtBRL(total)}</span>
              </div>
            </>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
