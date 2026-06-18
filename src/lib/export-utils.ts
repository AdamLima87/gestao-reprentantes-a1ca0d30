import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";

export const fmtBRL = (n: number | string) =>
  Number(n || 0).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

export function exportCSV(filename: string, headers: string[], rows: (string | number)[][]) {
  const escape = (v: string | number) => {
    const s = String(v ?? "");
    return /[",;\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  };
  const csv = [headers.map(escape).join(";"), ...rows.map((r) => r.map(escape).join(";"))].join("\n");
  const blob = new Blob(["\ufeff" + csv], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename.endsWith(".csv") ? filename : `${filename}.csv`;
  a.click();
  URL.revokeObjectURL(url);
}

export function exportPDF(
  filename: string,
  title: string,
  headers: string[],
  rows: (string | number)[][],
  subtitle?: string,
) {
  const doc = new jsPDF({ orientation: "landscape" });
  doc.setFontSize(14);
  doc.text(title, 14, 15);
  if (subtitle) {
    doc.setFontSize(10);
    doc.setTextColor(100);
    doc.text(subtitle, 14, 22);
    doc.setTextColor(0);
  }
  autoTable(doc, {
    head: [headers],
    body: rows.map((r) => r.map((c) => String(c ?? ""))),
    startY: subtitle ? 26 : 20,
    styles: { fontSize: 8 },
    headStyles: { fillColor: [40, 40, 40] },
  });
  doc.save(filename.endsWith(".pdf") ? filename : `${filename}.pdf`);
}
