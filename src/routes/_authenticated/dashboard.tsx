import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

import { CheckCircle2 } from "lucide-react";
import { useAuth } from "@/hooks/use-auth";
import { BrasilMap } from "@/components/BrasilMap";
import { NOME_TO_UF } from "@/lib/estados-brasil";
import { MotionPage } from "@/components/MotionPage";
import { motion } from "framer-motion";
import CountUp from "react-countup";

export const Route = createFileRoute("/_authenticated/dashboard")({
  component: Dashboard,
});

const fmtBRL = (n: number) =>
  n.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

function Dashboard() {
  const { roles, representanteId } = useAuth();
  const allowed = roles.some((r) => ["admin", "vendedor_interno", "financeiro"].includes(r));
  const isRepOnly = roles.includes("representante") && !allowed;
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
        supabase.from("representantes").select("id, nome, regiao, estados, tipo, ativo"),
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

  const moneyCards = [
    {
      title: "Total faturado no mês",
      value: totalMes,
      money: true,
      extra:
        metaEmpresa > 0 ? (
          <p className="text-xs text-muted-foreground mt-1">
            Meta: {fmtBRL(Number(metaEmpresa))} ({((totalMes / Number(metaEmpresa)) * 100).toFixed(1)}%)
          </p>
        ) : null,
    },
    { title: "Ticket médio", value: ticketMedio, money: true },
    { title: "Pedidos em atraso", value: atrasados.length, money: false, danger: true },
  ];

  return (
    <MotionPage className="space-y-6">
      <h1 className="text-2xl font-bold">Dashboard — {String(mes).padStart(2, "0")}/{ano}</h1>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {moneyCards.map((c, i) => (
          <motion.div
            key={c.title}
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: i * 0.08, duration: 0.3, ease: "easeOut" }}
          >
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium">{c.title}</CardTitle>
              </CardHeader>
              <CardContent>
                <div className={`text-2xl font-bold ${c.danger ? "text-destructive" : ""}`}>
                  {c.money ? (
                    <CountUp
                      end={c.value}
                      duration={1.1}
                      separator="."
                      decimal=","
                      decimals={2}
                      prefix="R$ "
                    />
                  ) : (
                    <CountUp end={c.value} duration={1} separator="." />
                  )}
                </div>
                {c.extra}
              </CardContent>
            </Card>
          </motion.div>
        ))}
      </div>


      <ClientesEmRiscoCard representanteId={isRepOnly ? representanteId : null} restringir={isRepOnly} />


      <Card>
        <CardHeader><CardTitle>Pedidos por status</CardTitle></CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
            {porStatus.map((s) => {
              const labels: Record<string, string> = {
                pedido: "Pedido",
                producao: "Produção",
                faturado: "Faturado",
                entregue: "Entregue",
                cancelado: "Cancelado",
              };
              return (
                <div key={s.status} className="border rounded-md p-3">
                  <div className="text-xs text-muted-foreground">{labels[s.status] ?? s.status}</div>
                  <div className="text-xl font-semibold">{s.count}</div>
                </div>
              );
            })}
          </div>
        </CardContent>
      </Card>

      {(() => {
        const counts: Record<string, number> = {};
        for (const r of data.reps as any[]) {
          if (r.tipo !== "externo" || !r.ativo) continue;
          const lista: string[] = Array.isArray(r.estados) && r.estados.length > 0
            ? r.estados
            : (r.regiao ? [String(r.regiao)] : []);
          const ufs = new Set<string>();
          for (const item of lista) {
            const raw = String(item).trim();
            if (!raw) continue;
            const uf = raw.length === 2 ? raw.toUpperCase() : (NOME_TO_UF[raw.toLowerCase()] ?? raw.toUpperCase());
            ufs.add(uf);
          }
          for (const uf of ufs) counts[uf] = (counts[uf] ?? 0) + 1;
        }

        return (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            <Card>
              <CardHeader><CardTitle>Cobertura por Estado</CardTitle></CardHeader>
              <CardContent><BrasilMap counts={counts} /></CardContent>
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
      })()}
    </MotionPage>
  );
}

function ClientesEmRiscoCard({ representanteId, restringir }: { representanteId: string | null; restringir: boolean }) {
  const { data, isLoading } = useQuery({
    queryKey: ["clientes-em-risco", restringir ? representanteId : "all"],
    queryFn: async () => {
      const limMax = new Date(); limMax.setDate(limMax.getDate() - 90);
      const limMin = new Date(); limMin.setDate(limMin.getDate() - 120);
      let q = supabase
        .from("clientes")
        .select("id, nome, ultima_compra_at, representante_id, representantes(nome)")
        .eq("ativo", true)
        .not("ultima_compra_at", "is", null)
        .gte("ultima_compra_at", limMin.toISOString())
        .lte("ultima_compra_at", limMax.toISOString())
        .order("ultima_compra_at", { ascending: true });
      if (restringir && representanteId) q = q.eq("representante_id", representanteId);
      return (await q).data ?? [];
    },
  });

  return (
    <Card>
      <CardHeader>
        <CardTitle>Clientes em risco de inatividade</CardTitle>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <p className="text-sm text-muted-foreground">Carregando…</p>
        ) : (data ?? []).length === 0 ? (
          <div className="flex items-center gap-2 text-sm text-green-700">
            <CheckCircle2 className="h-5 w-5" />
            Nenhum cliente em risco de inatividade no momento.
          </div>
        ) : (
          <ul className="divide-y">
            {(data ?? []).map((c: any) => {
              const ultima = new Date(c.ultima_compra_at);
              const dias = Math.floor((Date.now() - ultima.getTime()) / 86400000);
              const restantes = Math.max(0, 120 - dias);
              const pct = Math.min(100, (dias / 120) * 100);
              const cor = dias < 100 ? "bg-green-500" : dias < 110 ? "bg-yellow-500" : "bg-red-500";
              return (
                <li key={c.id} className="py-3 flex flex-col gap-1">
                  <div className="flex justify-between text-sm">
                    <span className="font-medium">{c.nome}</span>
                    <span className="text-muted-foreground">{restantes} {restantes === 1 ? "dia" : "dias"} restantes</span>
                  </div>
                  <div className="flex justify-between text-xs text-muted-foreground">
                    <span>Rep: {c.representantes?.nome ?? "—"}</span>
                    <span>Última compra: {ultima.toLocaleDateString("pt-BR")}</span>
                  </div>
                  <div className="relative h-2 w-full overflow-hidden rounded-full bg-secondary">
                    <div className={`h-full ${cor} transition-all`} style={{ width: `${pct}%` }} />
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </CardContent>
    </Card>
  );
}
