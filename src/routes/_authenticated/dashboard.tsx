import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  CheckCircle2,
  DollarSign,
  TrendingUp,
  Percent,
  AlertTriangle,
  ShoppingCart,
  ArrowUpRight,
  ArrowDownRight,
} from "lucide-react";
import { useAuth } from "@/hooks/use-auth";
import { usePermissions } from "@/hooks/use-permissions";
import { BrasilMap } from "@/components/BrasilMap";
import { NOME_TO_UF } from "@/lib/estados-brasil";
import { MotionPage } from "@/components/MotionPage";
import { motion } from "framer-motion";
import CountUp from "react-countup";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  Cell,
} from "recharts";
import { useMemo, useState } from "react";

export const Route = createFileRoute("/_authenticated/dashboard")({
  component: Dashboard,
});

const fmtBRL = (n: number) =>
  n.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

const MESES_ABREV = ["Jan", "Fev", "Mar", "Abr", "Mai", "Jun", "Jul", "Ago", "Set", "Out", "Nov", "Dez"];

function getLast6Months(now: Date) {
  const arr: { mes: number; ano: number; label: string }[] = [];
  for (let i = 5; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    arr.push({ mes: d.getMonth() + 1, ano: d.getFullYear(), label: MESES_ABREV[d.getMonth()] });
  }
  return arr;
}

function Sparkline({ data, color }: { data: number[]; color: string }) {
  const max = Math.max(...data, 1);
  return (
    <div className="flex items-end gap-0.5 h-8 mt-2">
      {data.map((v, i) => (
        <div
          key={i}
          className="flex-1 rounded-sm transition-all"
          style={{
            height: `${Math.max(8, (v / max) * 100)}%`,
            backgroundColor: color,
            opacity: i === data.length - 1 ? 1 : 0.45,
          }}
        />
      ))}
    </div>
  );
}

function IndicatorCard({
  index,
  barColor,
  icon: Icon,
  label,
  value,
  valueColor,
  money,
  subtitle,
  sparkData,
  children,
}: {
  index: number;
  barColor: string;
  icon: any;
  label: string;
  value: number;
  valueColor: string;
  money?: boolean;
  subtitle?: React.ReactNode;
  sparkData?: number[];
  children?: React.ReactNode;
}) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: index * 0.08, duration: 0.35, ease: "easeOut" }}
    >
      <Card className="overflow-hidden relative">
        <div className="absolute left-0 top-0 bottom-0 w-[3px]" style={{ backgroundColor: barColor }} />
        <CardContent className="pl-5 pr-4 py-4">
          <div className="flex items-center gap-2 text-xs font-medium text-muted-foreground uppercase tracking-wide">
            <Icon className="h-3.5 w-3.5" style={{ color: barColor }} />
            <span>{label}</span>
          </div>
          <div className="text-2xl font-bold mt-2" style={{ color: valueColor }}>
            {money ? (
              <CountUp end={value} duration={1.1} separator="." decimal="," decimals={2} prefix="R$ " />
            ) : (
              <CountUp end={value} duration={1} separator="." />
            )}
          </div>
          {subtitle && <div className="text-xs text-muted-foreground mt-1">{subtitle}</div>}
          {sparkData && <Sparkline data={sparkData} color={barColor} />}
          {children}
        </CardContent>
      </Card>
    </motion.div>
  );
}

function Dashboard() {
  const { roles, representanteId } = useAuth();
  const { can } = usePermissions();
  const allowed = can("ver_dashboard");
  const isRepOnly = roles.includes("representante") && !allowed;
  const now = new Date();
  const [mes, setMes] = useState<number>(now.getMonth() + 1);
  const [ano, setAno] = useState<number>(now.getFullYear());
  const refDate = useMemo(() => new Date(ano, mes - 1, 1), [mes, ano]);
  const last6 = useMemo(() => getLast6Months(refDate), [mes, ano]);

  const { data, isLoading } = useQuery({
    queryKey: ["dashboard", mes, ano],
    enabled: allowed,
    queryFn: async () => {
      const prevDate = new Date(ano, mes - 2, 1);
      const prevMes = prevDate.getMonth() + 1;
      const prevAno = prevDate.getFullYear();

      const sixStart = new Date(ano, mes - 6, 1).toISOString().slice(0, 10);

      const [pedidosRes, nfeMesRes, nfePrevRes, nfe6Res, comissoes6Res, metasRes, repsRes] = await Promise.all([
        supabase.from("pedidos").select("id, status, prazo_entrega, valor_produtos, representante_id"),
        supabase.from("nfe").select("valor_nfe, mes_ref, ano_ref, pedido_id").eq("mes_ref", mes).eq("ano_ref", ano),
        supabase.from("nfe").select("valor_nfe").eq("mes_ref", prevMes).eq("ano_ref", prevAno),
        supabase.from("nfe").select("valor_nfe, mes_ref, ano_ref, data_nfe").gte("data_nfe", sixStart),
        supabase.from("comissoes").select("valor_comissao, mes_ref, ano_ref"),
        supabase.from("metas").select("valor, mes, ano, representante_id").eq("mes", mes).eq("ano", ano),
        supabase.from("representantes").select("id, nome, regiao, estados, tipo, ativo"),
      ]);

      return {
        pedidos: pedidosRes.data ?? [],
        nfe: nfeMesRes.data ?? [],
        nfePrev: nfePrevRes.data ?? [],
        nfe6: nfe6Res.data ?? [],
        comissoes6: comissoes6Res.data ?? [],
        metas: metasRes.data ?? [],
        reps: repsRes.data ?? [],
      };
    },
  });

  if (!allowed) return <p className="text-muted-foreground">Sem acesso ao dashboard.</p>;
  if (isLoading || !data) return <p className="text-muted-foreground">Carregando…</p>;

  const totalMes = data.nfe.reduce((s, n) => s + Number(n.valor_nfe), 0);
  const totalPrev = data.nfePrev.reduce((s: number, n: any) => s + Number(n.valor_nfe), 0);
  const variacao = totalPrev > 0 ? ((totalMes - totalPrev) / totalPrev) * 100 : 0;
  const ticketMedio = data.nfe.length ? totalMes / data.nfe.length : 0;
  const metaEmpresa = data.metas.find((m) => !m.representante_id)?.valor ?? 0;

  // Comissões do mês atual
  const comissoesMes = data.comissoes6
    .filter((c: any) => c.mes_ref === mes && c.ano_ref === ano)
    .reduce((s: number, c: any) => s + Number(c.valor_comissao), 0);

  // Sparklines - últimos 6 meses
  const sparkFat = last6.map(({ mes: m, ano: a }) =>
    data.nfe6
      .filter((n: any) => n.mes_ref === m && n.ano_ref === a)
      .reduce((s: number, n: any) => s + Number(n.valor_nfe), 0)
  );
  const sparkTicket = last6.map(({ mes: m, ano: a }) => {
    const arr = data.nfe6.filter((n: any) => n.mes_ref === m && n.ano_ref === a);
    return arr.length ? arr.reduce((s: number, n: any) => s + Number(n.valor_nfe), 0) / arr.length : 0;
  });
  const sparkComissoes = last6.map(({ mes: m, ano: a }) =>
    data.comissoes6
      .filter((c: any) => c.mes_ref === m && c.ano_ref === a)
      .reduce((s: number, c: any) => s + Number(c.valor_comissao), 0)
  );

  // Pedidos ativos
  const pedidosAtivos = data.pedidos.filter((p) => !["entregue", "cancelado"].includes(p.status)).length;

  // Atrasados
  const hoje = new Date().toISOString().slice(0, 10);
  const atrasados = data.pedidos.filter(
    (p) => p.prazo_entrega && p.prazo_entrega < hoje && !["entregue", "cancelado"].includes(p.status)
  );
  const atrasadosPorStatus = {
    pedido: atrasados.filter((p) => p.status === "pedido").length,
    producao: atrasados.filter((p) => p.status === "producao").length,
    faturado: atrasados.filter((p) => p.status === "faturado").length,
  };

  // Próximo mês para "a pagar"
  const proxData = new Date(ano, mes, 1);
  const proxMesLabel = MESES_ABREV[proxData.getMonth()];

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
  const rankingTop = ranking[0]?.total ?? 0;

  // Faturamento mensal ano atual
  const fatAnoMes = MESES_ABREV.map((label, i) => {
    const m = i + 1;
    const total = data.nfe6
      .filter((n: any) => n.mes_ref === m && n.ano_ref === ano)
      .reduce((s: number, n: any) => s + Number(n.valor_nfe), 0);
    return { mes: label, total, isCurrent: m === mes };
  });

  // Cobertura por Estado
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

  const variacaoPositiva = variacao >= 0;

  return (
    <MotionPage className="space-y-6">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3">
        <h1 className="text-2xl font-bold border-l-4 border-[#34a85a] pl-3">
          Dashboard <span className="text-muted-foreground font-normal text-lg">— {String(mes).padStart(2, "0")}/{ano}</span>
        </h1>
        <div className="flex items-center gap-2 flex-wrap">
          <Select value={String(mes)} onValueChange={(v) => setMes(Number(v))}>
            <SelectTrigger className="h-9 w-[130px]"><SelectValue /></SelectTrigger>
            <SelectContent>
              {MESES_ABREV.map((label, i) => (
                <SelectItem key={i + 1} value={String(i + 1)}>{label}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select value={String(ano)} onValueChange={(v) => setAno(Number(v))}>
            <SelectTrigger className="h-9 w-[100px]"><SelectValue /></SelectTrigger>
            <SelectContent>
              {Array.from({ length: 5 }, (_, i) => now.getFullYear() - i).map((y) => (
                <SelectItem key={y} value={String(y)}>{y}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Badge
            className="gap-1 px-3 py-1.5 text-sm font-semibold"
            style={{
              backgroundColor: variacaoPositiva ? "#1a6b3a" : "#c0392b",
              color: "white",
            }}
          >
            {variacaoPositiva ? <ArrowUpRight className="h-3.5 w-3.5" /> : <ArrowDownRight className="h-3.5 w-3.5" />}
            {variacao.toFixed(1)}% vs mês anterior
          </Badge>
          <Badge
            className="gap-1 px-3 py-1.5 text-sm font-semibold"
            style={{ backgroundColor: "#1d6fa4", color: "white" }}
          >
            <ShoppingCart className="h-3.5 w-3.5" />
            {pedidosAtivos} pedidos ativos
          </Badge>
        </div>
      </div>

      {/* 4 Indicator cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <IndicatorCard
          index={0}
          barColor="#1a6b3a"
          icon={DollarSign}
          label="Total faturado"
          value={totalMes}
          valueColor="#1a6b3a"
          money
          subtitle={metaEmpresa > 0 ? `Meta: ${fmtBRL(Number(metaEmpresa))} (${((totalMes / Number(metaEmpresa)) * 100).toFixed(1)}%)` : "no mês atual"}
          sparkData={sparkFat}
        />
        <IndicatorCard
          index={1}
          barColor="#1d6fa4"
          icon={TrendingUp}
          label="Ticket médio"
          value={ticketMedio}
          valueColor="#1d6fa4"
          money
          subtitle={`${data.nfe.length} NF-es no mês`}
          sparkData={sparkTicket}
        />
        <IndicatorCard
          index={2}
          barColor="#6b46c1"
          icon={Percent}
          label="Comissões geradas"
          value={comissoesMes}
          valueColor="#6b46c1"
          money
          subtitle={`a pagar em ${proxMesLabel}`}
          sparkData={sparkComissoes}
        />
        <IndicatorCard
          index={3}
          barColor="#c0392b"
          icon={AlertTriangle}
          label="Pedidos em atraso"
          value={atrasados.length}
          valueColor="#c0392b"
        >
          <div className="flex gap-1.5 mt-3 flex-wrap">
            <Badge variant="outline" className="text-xs">Pedido: {atrasadosPorStatus.pedido}</Badge>
            <Badge variant="outline" className="text-xs">Produção: {atrasadosPorStatus.producao}</Badge>
            <Badge variant="outline" className="text-xs">Faturado: {atrasadosPorStatus.faturado}</Badge>
          </div>
        </IndicatorCard>
      </div>

      {/* Bar chart + Ranking */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.32, duration: 0.35 }}
          className="lg:col-span-2"
        >
          <Card>
            <CardContent className="pt-6">
              <h3 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground mb-4">
                Faturamento mensal — {ano}
              </h3>
              <ResponsiveContainer width="100%" height={260}>
                <BarChart data={fatAnoMes}>
                  <XAxis dataKey="mes" tick={{ fontSize: 12 }} axisLine={false} tickLine={false} />
                  <YAxis
                    tick={{ fontSize: 11 }}
                    axisLine={false}
                    tickLine={false}
                    tickFormatter={(v) => (v >= 1000 ? `R$ ${(v / 1000).toFixed(0)}k` : `R$ ${v}`)}
                  />
                  <Tooltip
                    cursor={{ fill: "rgba(52,168,90,0.08)" }}
                    content={({ active, payload }) => {
                      if (!active || !payload?.length) return null;
                      const p: any = payload[0].payload;
                      return (
                        <div className="bg-card border border-border rounded-md shadow-md px-3 py-2 text-sm">
                          <div className="font-semibold">{p.mes}/{ano}</div>
                          <div style={{ color: p.isCurrent ? "#34a85a" : "#1a6b3a" }}>{fmtBRL(p.total)}</div>
                        </div>
                      );
                    }}
                  />
                  <Bar dataKey="total" radius={[4, 4, 0, 0]}>
                    {fatAnoMes.map((d, i) => (
                      <Cell key={i} fill={d.isCurrent ? "#34a85a" : "#1a6b3a"} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.4, duration: 0.35 }}
        >
          <Card>
            <CardContent className="pt-6">
              <h3 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground mb-4">
                Ranking — representantes
              </h3>
              {ranking.length === 0 ? (
                <p className="text-sm text-muted-foreground">Sem faturamento no mês ainda.</p>
              ) : (
                <ul className="space-y-3">
                  {ranking.map((r, i) => {
                    const medalColors = ["#d4af37", "#c0c0c0", "#cd7f32"];
                    const bg = medalColors[i] ?? "hsl(var(--muted))";
                    const pct = rankingTop > 0 ? (r.total / rankingTop) * 100 : 0;
                    return (
                      <li key={i} className="space-y-1">
                        <div className="flex items-center gap-2 text-sm">
                          <span
                            className="flex items-center justify-center w-6 h-6 rounded-full text-xs font-bold text-white shrink-0"
                            style={{ backgroundColor: bg, color: i < 3 ? "#1a1a1a" : "white" }}
                          >
                            {i + 1}
                          </span>
                          <span className="flex-1 truncate">{r.nome}</span>
                          <span className="font-semibold text-xs">{fmtBRL(r.total)}</span>
                        </div>
                        <div className="h-1.5 w-full rounded-full bg-muted overflow-hidden">
                          <div
                            className="h-full transition-all"
                            style={{ width: `${pct}%`, backgroundColor: i < 3 ? bg : "#1a6b3a" }}
                          />
                        </div>
                      </li>
                    );
                  })}
                </ul>
              )}
            </CardContent>
          </Card>
        </motion.div>
      </div>

      {/* Mapa + Clientes */}
      <div className="grid grid-cols-1 lg:grid-cols-5 gap-4">
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.48, duration: 0.35 }}
          className="lg:col-span-3"
        >
          <Card>
            <CardContent className="pt-6">
              <h3 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground mb-4">
                Cobertura por Estado
              </h3>
              <BrasilMap counts={counts} />
            </CardContent>
          </Card>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.56, duration: 0.35 }}
          className="lg:col-span-2"
        >
          <ClientesPanel representanteId={isRepOnly ? representanteId : null} restringir={isRepOnly} />
        </motion.div>
      </div>
    </MotionPage>
  );
}

function ClientesPanel({ representanteId, restringir }: { representanteId: string | null; restringir: boolean }) {
  const { data: emRisco, isLoading } = useQuery({
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

  const { data: counts } = useQuery({
    queryKey: ["clientes-counts", restringir ? representanteId : "all"],
    queryFn: async () => {
      let q = supabase.from("clientes").select("id, ativo, ultima_compra_at");
      if (restringir && representanteId) q = q.eq("representante_id", representanteId);
      const rows = (await q).data ?? [];
      const limRisco = new Date(); limRisco.setDate(limRisco.getDate() - 90);
      const ativos = rows.filter((r: any) => r.ativo).length;
      const inativos = rows.filter((r: any) => !r.ativo).length;
      const emRiscoCount = rows.filter(
        (r: any) => r.ativo && r.ultima_compra_at && new Date(r.ultima_compra_at) < limRisco
      ).length;
      return { ativos, inativos, emRisco: emRiscoCount };
    },
  });

  const riscoCount = (emRisco ?? []).length;

  return (
    <Card className="h-full">
      <CardContent className="pt-6 space-y-4">
        <h3 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">Clientes</h3>

        {/* Seção a: status */}
        <div className="flex items-center gap-3 pb-4 border-b border-border">
          <div
            className="flex items-center justify-center w-10 h-10 rounded-full"
            style={{ backgroundColor: riscoCount === 0 ? "rgba(26,107,58,0.15)" : "rgba(217,119,6,0.15)" }}
          >
            {riscoCount === 0 ? (
              <CheckCircle2 className="h-5 w-5" style={{ color: "#1a6b3a" }} />
            ) : (
              <AlertTriangle className="h-5 w-5" style={{ color: "#d97706" }} />
            )}
          </div>
          <div className="text-sm">
            {riscoCount === 0
              ? "Nenhum cliente em risco no momento."
              : `${riscoCount} cliente${riscoCount > 1 ? "s" : ""} em risco de inatividade.`}
          </div>
        </div>

        {/* Seção b: métricas */}
        <div className="grid grid-cols-3 gap-2 pb-4 border-b border-border">
          <div>
            <div className="text-xs text-muted-foreground uppercase tracking-wide">Ativos</div>
            <div className="text-xl font-bold text-foreground">{counts?.ativos ?? 0}</div>
          </div>
          <div>
            <div className="text-xs text-muted-foreground uppercase tracking-wide">Em risco</div>
            <div className="text-xl font-bold" style={{ color: "#d97706" }}>{counts?.emRisco ?? 0}</div>
          </div>
          <div>
            <div className="text-xs text-muted-foreground uppercase tracking-wide">Inativos</div>
            <div className="text-xl font-bold text-muted-foreground">{counts?.inativos ?? 0}</div>
          </div>
        </div>

        {/* Seção c: lista de risco */}
        <div>
          {isLoading ? (
            <p className="text-sm text-muted-foreground">Carregando…</p>
          ) : riscoCount === 0 ? (
            <p className="text-xs text-muted-foreground">Todos os clientes ativos estão em dia.</p>
          ) : (
            <ul className="divide-y divide-border max-h-64 overflow-y-auto">
              {(emRisco ?? []).map((c: any) => {
                const ultima = new Date(c.ultima_compra_at);
                const dias = Math.floor((Date.now() - ultima.getTime()) / 86400000);
                const restantes = Math.max(0, 120 - dias);
                const pct = Math.min(100, (dias / 120) * 100);
                const cor = dias < 100 ? "#1a6b3a" : dias < 110 ? "#d97706" : "#c0392b";
                return (
                  <li key={c.id} className="py-2.5 flex flex-col gap-1">
                    <div className="flex justify-between text-sm">
                      <span className="font-medium truncate">{c.nome}</span>
                      <span className="text-xs text-muted-foreground shrink-0 ml-2">
                        {restantes} {restantes === 1 ? "dia" : "dias"}
                      </span>
                    </div>
                    <div className="flex justify-between text-xs text-muted-foreground">
                      <span className="truncate">Rep: {c.representantes?.nome ?? "—"}</span>
                      <span className="shrink-0 ml-2">{ultima.toLocaleDateString("pt-BR")}</span>
                    </div>
                    <div className="relative h-1.5 w-full overflow-hidden rounded-full bg-muted">
                      <div className="h-full transition-all" style={{ width: `${pct}%`, backgroundColor: cor }} />
                    </div>
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
