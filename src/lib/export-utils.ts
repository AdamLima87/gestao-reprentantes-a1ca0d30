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

export type PdfBrandOptions = {
  brand?: boolean;
  logoBase64?: string | null;
  returnBase64?: boolean;
};

// Brazil Amortecedores brand palette
const BRAND = {
  headerFill: [26, 107, 58] as [number, number, number], // #1a6b3a
  totalFill: [15, 61, 32] as [number, number, number], // #0f3d20
  altRowFill: [240, 247, 243] as [number, number, number], // #f0f7f3
  borderColor: [52, 168, 90] as [number, number, number], // #34a85a
  titleColor: [26, 107, 58] as [number, number, number], // #1a6b3a
  footerColor: [110, 110, 110] as [number, number, number], // #6e6e6e
};

function detectImageFormat(b64: string): "PNG" | "JPEG" {
  if (b64.startsWith("data:image/jpeg") || b64.startsWith("data:image/jpg")) return "JPEG";
  return "PNG";
}

async function loadImageSize(src: string): Promise<{ w: number; h: number } | null> {
  return new Promise((resolve) => {
    const img = new Image();
    img.onload = () => resolve({ w: img.naturalWidth, h: img.naturalHeight });
    img.onerror = () => resolve(null);
    img.src = src;
  });
}

export async function exportPDF(
  filename: string,
  title: string,
  headers: string[],
  rows: (string | number)[][],
  subtitle?: string,
  options?: PdfBrandOptions,
) {
  const doc = new jsPDF({ orientation: "landscape" });
  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
  const brand = options?.brand ?? false;

  let cursorY = 10;
  const logo = options?.logoBase64;

  if (logo) {
    try {
      const fmt = detectImageFormat(logo);
      const size = await loadImageSize(logo);
      const MAX_W = 45;
      const MAX_H = 20;
      let logoW = MAX_W;
      let logoH = MAX_W;
      if (size && size.w > 0 && size.h > 0) {
        const ratio = size.h / size.w;
        logoW = MAX_W;
        logoH = logoW * ratio;
        if (logoH > MAX_H) {
          logoH = MAX_H;
          logoW = logoH / ratio;
        }
      } else {
        logoH = MAX_W * 0.4;
      }
      const logoX = (pageWidth - logoW) / 2;
      doc.addImage(logo, fmt, logoX, cursorY, logoW, logoH);
      cursorY += logoH + 6;
    } catch {
      // ignore broken image
    }
  }


  doc.setFontSize(13);
  doc.setFont("helvetica", "bold");
  if (brand) doc.setTextColor(BRAND.titleColor[0], BRAND.titleColor[1], BRAND.titleColor[2]);
  else doc.setTextColor(0);

  if (logo) {
    doc.text(title, pageWidth / 2, cursorY, { align: "center" });
    cursorY += 7;
  } else {
    doc.text(title, 14, cursorY + 3);
    cursorY += 8;
  }
  doc.setFont("helvetica", "normal");
  doc.setTextColor(0);


  if (subtitle) {
    doc.setFontSize(10);
    doc.setTextColor(100);
    const subY = cursorY + 2;
    if (logo) doc.text(subtitle, pageWidth / 2, subY, { align: "center", maxWidth: pageWidth - 20 });
    else doc.text(subtitle, 14, subY, { maxWidth: pageWidth - 20 });
    doc.setTextColor(0);
    cursorY = subY + 4;
  }

  const totalRowIndex = rows.length - 1;
  const isTotalRow = (idx: number) =>
    idx === totalRowIndex && rows[idx]?.[0] != null && String(rows[idx][0]).toUpperCase().startsWith("TOTAL");

  autoTable(doc, {
    head: [headers],
    body: rows.map((r) => r.map((c) => String(c ?? ""))),
    startY: cursorY + 2,
    margin: { bottom: 18, top: 12 },
    styles: brand
      ? {
          fontSize: 8,
          lineColor: BRAND.borderColor,
          lineWidth: 0.1,
          textColor: [40, 40, 40],
        }
      : { fontSize: 8 },
    headStyles: brand
      ? {
          fillColor: BRAND.headerFill,
          textColor: [255, 255, 255],
          fontStyle: "bold",
          halign: "center",
        }
      : { fillColor: [40, 40, 40] },
    alternateRowStyles: brand ? { fillColor: BRAND.altRowFill } : undefined,
    didParseCell: (data) => {
      if (!brand) return;
      if (data.section === "body" && isTotalRow(data.row.index)) {
        data.cell.styles.fillColor = BRAND.totalFill;
        data.cell.styles.textColor = [255, 255, 255];
        data.cell.styles.fontStyle = "bold";
      }
    },
    didDrawPage: () => {
      if (!brand) return;
      const y = pageHeight - 12;
      doc.setDrawColor(BRAND.borderColor[0], BRAND.borderColor[1], BRAND.borderColor[2]);
      doc.setLineWidth(0.3);
      doc.line(10, y, pageWidth - 10, y);
      doc.setFontSize(8);
      doc.setTextColor(BRAND.footerColor[0], BRAND.footerColor[1], BRAND.footerColor[2]);
      doc.text("Brazil Amortecedores", 10, y + 5);
      const now = new Date().toLocaleString("pt-BR");
      doc.text(`Gerado em ${now}`, pageWidth - 10, y + 5, { align: "right" });
      doc.setTextColor(0);
    },
  });
  doc.save(filename.endsWith(".pdf") ? filename : `${filename}.pdf`);
}
