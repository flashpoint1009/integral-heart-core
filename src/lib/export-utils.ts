import * as XLSX from "xlsx";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";

export function exportToExcel(filename: string, sheets: Record<string, Array<Record<string, any>>>) {
  const wb = XLSX.utils.book_new();
  for (const [name, rows] of Object.entries(sheets)) {
    const ws = XLSX.utils.json_to_sheet(rows.length ? rows : [{ "—": "" }]);
    XLSX.utils.book_append_sheet(wb, ws, name.slice(0, 31));
  }
  XLSX.writeFile(wb, filename.endsWith(".xlsx") ? filename : `${filename}.xlsx`);
}

export function exportToPdf(opts: {
  filename: string;
  title: string;
  subtitle?: string;
  sections: Array<{ heading: string; headers: string[]; rows: (string | number)[][] }>;
}) {
  const doc = new jsPDF({ orientation: "portrait", unit: "pt", format: "a4" });
  const W = doc.internal.pageSize.getWidth();
  doc.setFontSize(16);
  doc.text(opts.title, W / 2, 36, { align: "center" });
  if (opts.subtitle) {
    doc.setFontSize(10);
    doc.setTextColor(120);
    doc.text(opts.subtitle, W / 2, 54, { align: "center" });
    doc.setTextColor(0);
  }
  let y = 72;
  for (const s of opts.sections) {
    doc.setFontSize(12);
    doc.text(s.heading, 40, y);
    autoTable(doc, {
      startY: y + 6,
      head: [s.headers],
      body: s.rows.length ? s.rows : [["—"]],
      styles: { fontSize: 9 },
      headStyles: { fillColor: [37, 99, 235] },
      margin: { left: 40, right: 40 },
    });
    // @ts-expect-error lastAutoTable injected by plugin
    y = (doc.lastAutoTable?.finalY ?? y + 40) + 24;
    if (y > doc.internal.pageSize.getHeight() - 80) { doc.addPage(); y = 60; }
  }
  doc.save(opts.filename.endsWith(".pdf") ? opts.filename : `${opts.filename}.pdf`);
}