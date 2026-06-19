import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useAuth } from "@/hooks/use-auth";
import { BrasilMap } from "@/components/BrasilMap";
import { NOME_TO_UF } from "@/lib/estados-brasil";

export const Route = createFileRoute("/_authenticated/dashboard")({
  component: Dashboard,
});

const fmtBRL = (n: number) =>
  n.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

function Dashboard() {
  const { roles } = useAuth();
  const allowed = roles.some((r) => ["admin", "vendedor_interno", "financeiro"].includes(r));
  const now = new Date();
  const mes = now.getMonth() + 1;
  const ano = now.getFullYear();

  const { data, isLoading } = useQuery({
    queryKey: ["dashboard", mes, ano],
    enabled: allowed,
    queryFn: async () => {
      const [pedidosRes, nfeRes, metasRes, repsRes] = await Promise.all([
        supabase.from("pedidos").select("id, status, prazo_entrega, valor_produtos, representante_id"),
        supabase.from("nfe").select("valor_nfe, mes_ref, ano_ref, pedido_id").eq("mes_ref", mes).eq("ano_ref", ano),
        supabase.from("metas").select("valor, mes, ano, representante_id").eq("mes", mes).eq("ano", ano),
        supabase.from("representantes").select("id, nome, regiao, tipo, ativo"),
      ]);
      return {
        pedidos: pedidosRes.data ?? [],
        nfe: nfeRes.data ?? [],
        metas: metasRes.data ?? [],
        reps: repsRes.data ?? [],
      };
    },
  });

  if (!allowed) return <p className="text-muted-foreground">Sem acesso ao dashboard.</p>;
  if (isLoading || !data) return <p className="text-muted-foreground">Carregando…</p>;

  const totalMes = data.nfe.reduce((s, n) => s + Number(n.valor_nfe), 0);
  const ticketMedio = data.nfe.length ? totalMes / data.nfe.length : 0;
  const metaEmpresa = data.metas.find((m) => !m.representante_id)?.valor ?? 0;

  // Pedidos por status
  const statusList = ["pedido", "producao", "faturado", "entregue", "cancelado"];
  const porStatus = statusList.map((s) => ({
    status: s,
    count:
      s === "faturado"
        ? data.pedidos.filter((p) => p.status === "faturado" || p.status === "entregue").length
        : data.pedidos.filter((p) => p.status === s).length,
  }));

  // Atrasados
  const hoje = new Date().toISOString().slice(0, 10);
  const atrasados = data.pedidos.filter(
    (p) => p.prazo_entrega && p.prazo_entrega < hoje && !["entregue", "cancelado"].includes(p.status)
  );

  // Ranking reps por faturamento no mês
  const pedIds = new Map(data.pedidos.map((p) => [p.id, p.representante_id]));
  const repFat = new Map<string, number>();
  for (const n of data.nfe) {
    const rid = pedIds.get(n.pedido_id);
    if (!rid) continue;
    repFat.set(rid, (repFat.get(rid) ?? 0) + Number(n.valor_nfe));
  }
  const ranking = [...repFat.entries()]
    .map(([rid, total]) => ({ nome: data.reps.find((r) => r.id === rid)?.nome ?? "—", total }))
    .sort((a, b) => b.total - a.total);

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">Dashboard — {String(mes).padStart(2, "0")}/{ano}</h1>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-sm font-medium">Total faturado no mês</CardTitle></CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{fmtBRL(totalMes)}</div>
            {metaEmpresa > 0 && (
              <p className="text-xs text-muted-foreground mt-1">
                Meta: {fmtBRL(Number(metaEmpresa))} ({((totalMes / Number(metaEmpresa)) * 100).toFixed(1)}%)
              </p>
            )}
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-sm font-medium">Ticket médio</CardTitle></CardHeader>
          <CardContent><div className="text-2xl font-bold">{fmtBRL(ticketMedio)}</div></CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-sm font-medium">Pedidos em atraso</CardTitle></CardHeader>
          <CardContent><div className="text-2xl font-bold text-destructive">{atrasados.length}</div></CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader><CardTitle>Pedidos por status</CardTitle></CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
            {porStatus.map((s) => (
              <div key={s.status} className="border rounded-md p-3">
                <div className="text-xs uppercase text-muted-foreground">{s.status}</div>
                <div className="text-xl font-semibold">{s.count}</div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle>Ranking de representantes (mês)</CardTitle></CardHeader>
        <CardContent>
          {ranking.length === 0 ? (
            <p className="text-sm text-muted-foreground">Sem faturamento no mês ainda.</p>
          ) : (
            <ul className="divide-y">
              {ranking.map((r, i) => (
                <li key={i} className="py-2 flex justify-between text-sm">
                  <span><span className="text-muted-foreground mr-2">#{i + 1}</span>{r.nome}</span>
                  <span className="font-medium">{fmtBRL(r.total)}</span>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
