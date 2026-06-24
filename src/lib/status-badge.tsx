import { motion } from "framer-motion";

type Style = { label: string; bg: string; text: string; border: string };

const pedidoStatusMap: Record<string, Style> = {
  pedido:    { label: "Pedido",    bg: "#f1f3f5", text: "#495057", border: "#dee2e6" },
  producao:  { label: "Produção",  bg: "#fff8e1", text: "#b45309", border: "#fcd34d" },
  faturado:  { label: "Faturado",  bg: "#e8f4fd", text: "#1d6fa4", border: "#93c5fd" },
  entregue:  { label: "Entregue",  bg: "#e8f5ee", text: "#1a6b3a", border: "#34a85a" },
  cancelado: { label: "Cancelado", bg: "#fdecea", text: "#c0392b", border: "#f87171" },
};

const baseChipStyle = (s: Style): React.CSSProperties => ({
  background: s.bg,
  color: s.text,
  border: `1px solid ${s.border}`,
  fontSize: 11,
  fontWeight: 500,
  padding: "3px 10px",
  borderRadius: 20,
  whiteSpace: "nowrap",
  display: "inline-block",
  lineHeight: 1.4,
});

export function StatusBadge({ status }: { status: string }) {
  const s = pedidoStatusMap[status] ?? { label: status, bg: "#f1f3f5", text: "#495057", border: "#dee2e6" };
  return <span style={baseChipStyle(s)}>{s.label}</span>;
}

const tipoComissaoMap: Record<string, Style> = {
  externo:            { label: "Representante",            bg: "#e8f4fd", text: "#1d6fa4", border: "#93c5fd" },
  interno_novo:       { label: "Vend. Interno — Novo",     bg: "#e6f4f1", text: "#0f7b6c", border: "#5eead4" },
  interno_reativacao: { label: "Vend. Interno — Reativ.",  bg: "#fff8e1", text: "#b45309", border: "#fcd34d" },
  interno_recorrente: { label: "Vend. Interno — Recorr.",  bg: "#e8f5ee", text: "#1a6b3a", border: "#34a85a" },
  interno_sobre_rep:  { label: "Vend. Interno 0,5%",       bg: "#f3eeff", text: "#6b46c1", border: "#c4b5fd" },
  gestor:             { label: "Gestor",                   bg: "#fff8e1", text: "#92400e", border: "#fcd34d" },
};


export function TipoComissaoBadge({ tipo }: { tipo: string }) {
  const s = tipoComissaoMap[tipo] ?? { label: tipo, bg: "#f1f3f5", text: "#495057", border: "#dee2e6" };
  return <span style={baseChipStyle(s)}>{s.label}</span>;
}

const pago: Style = { label: "Pago",     bg: "#e8f5ee", text: "#1a6b3a", border: "#34a85a" };
const pendente: Style = { label: "Pendente", bg: "#fff8e1", text: "#b45309", border: "#fcd34d" };

export function PagamentoBadge({ pago: isPago }: { pago: boolean }) {
  if (isPago) return <span style={baseChipStyle(pago)}>{pago.label}</span>;
  return (
    <motion.span
      animate={{ scale: [1, 1.06, 1] }}
      transition={{ repeat: Infinity, duration: 2, ease: "easeInOut" }}
      style={baseChipStyle(pendente)}
    >
      {pendente.label}
    </motion.span>
  );
}

const clienteStatusMap: Record<string, Style> = {
  ativo:               { label: "Ativo",                bg: "#e8f4fd", text: "#1d6fa4", border: "#93c5fd" },
  inativo:             { label: "Inativo",              bg: "#f1f3f5", text: "#495057", border: "#dee2e6" },
  atendimento_interno: { label: "Atendimento interno",  bg: "#e6f4f1", text: "#0f7b6c", border: "#5eead4" },
  risco:               { label: "Risco de inatividade", bg: "#fdecea", text: "#c0392b", border: "#f87171" },
};

export function ClienteStatusBadge({ status }: { status: keyof typeof clienteStatusMap | string }) {
  const s = clienteStatusMap[status] ?? clienteStatusMap.inativo;
  return <span style={baseChipStyle(s)}>{s.label}</span>;
}
