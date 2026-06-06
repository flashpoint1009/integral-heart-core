import { useRef, useState } from "react";
import * as XLSX from "xlsx";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "@/components/ui/dialog";
import { Upload, Download, FileSpreadsheet, CheckCircle2, AlertCircle, Loader2 } from "lucide-react";
import { toast } from "sonner";

export type ExcelColumn = { key: string; label: string; required?: boolean; example?: string };

export type ImportResult = { ok: number; failed: number; errors: string[] };

export function ExcelImportButton({
  label,
  title,
  description,
  columns,
  templateFileName,
  importRow,
  onDone,
}: {
  label: string;
  title: string;
  description?: string;
  columns: ExcelColumn[];
  templateFileName: string;
  importRow: (row: Record<string, any>, index: number) => Promise<void>;
  onDone?: () => void;
}) {
  const [open, setOpen] = useState(false);
  const [rows, setRows] = useState<Record<string, any>[]>([]);
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<ImportResult | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  const downloadTemplate = () => {
    const headers = columns.map((c) => c.label);
    const example = columns.map((c) => c.example ?? "");
    const ws = XLSX.utils.aoa_to_sheet([headers, example]);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Template");
    XLSX.writeFile(wb, templateFileName);
  };

  const onFile = async (file: File) => {
    setResult(null);
    const buf = await file.arrayBuffer();
    const wb = XLSX.read(buf);
    const ws = wb.Sheets[wb.SheetNames[0]];
    const json = XLSX.utils.sheet_to_json<Record<string, any>>(ws, { defval: "" });
    // Normalize: map by label → key
    const labelToKey = new Map(columns.map((c) => [c.label.trim().toLowerCase(), c.key]));
    const normalized = json.map((r) => {
      const out: Record<string, any> = {};
      for (const [k, v] of Object.entries(r)) {
        const key = labelToKey.get(String(k).trim().toLowerCase()) ?? k;
        out[key] = v;
      }
      return out;
    }).filter((r) => columns.some((c) => c.required ? String(r[c.key] ?? "").trim() !== "" : false) || Object.values(r).some((v) => String(v).trim() !== ""));
    setRows(normalized);
  };

  const runImport = async () => {
    setBusy(true);
    const errors: string[] = [];
    let ok = 0, failed = 0;
    for (let i = 0; i < rows.length; i++) {
      try {
        await importRow(rows[i], i);
        ok++;
      } catch (e: any) {
        failed++;
        errors.push(`صف ${i + 2}: ${e?.message ?? "خطأ"}`);
      }
    }
    setResult({ ok, failed, errors });
    setBusy(false);
    if (failed === 0) toast.success(`تم استيراد ${ok} صف`);
    else toast.warning(`نجح ${ok} • فشل ${failed}`);
    onDone?.();
  };

  const reset = () => { setRows([]); setResult(null); if (fileRef.current) fileRef.current.value = ""; };

  return (
    <>
      <Button variant="outline" onClick={() => setOpen(true)}>
        <Upload className="h-4 w-4 me-2" />{label}
      </Button>
      <Dialog open={open} onOpenChange={(v) => { setOpen(v); if (!v) reset(); }}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2"><FileSpreadsheet className="h-5 w-5" />{title}</DialogTitle>
            {description && <DialogDescription>{description}</DialogDescription>}
          </DialogHeader>

          <div className="space-y-3">
            <div className="flex flex-wrap items-center gap-2">
              <Button variant="outline" size="sm" onClick={downloadTemplate}>
                <Download className="h-4 w-4 me-2" />تحميل نموذج
              </Button>
              <input
                ref={fileRef}
                type="file"
                accept=".xlsx,.xls,.csv"
                className="text-sm"
                onChange={(e) => { const f = e.target.files?.[0]; if (f) onFile(f); }}
              />
            </div>

            <div className="rounded-md border bg-muted/40 p-3 text-xs space-y-1">
              <div className="font-semibold">الأعمدة المطلوبة:</div>
              <div className="flex flex-wrap gap-2">
                {columns.map((c) => (
                  <span key={c.key} className={`px-2 py-0.5 rounded ${c.required ? "bg-primary/10 text-primary" : "bg-muted-foreground/10 text-muted-foreground"}`}>
                    {c.label}{c.required ? " *" : ""}
                  </span>
                ))}
              </div>
            </div>

            {rows.length > 0 && !result && (
              <div className="rounded-md border max-h-64 overflow-auto">
                <table className="w-full text-xs">
                  <thead className="bg-muted sticky top-0">
                    <tr>{columns.map((c) => <th key={c.key} className="text-start px-2 py-1.5 font-semibold">{c.label}</th>)}</tr>
                  </thead>
                  <tbody>
                    {rows.slice(0, 50).map((r, i) => (
                      <tr key={i} className="border-t">
                        {columns.map((c) => <td key={c.key} className="px-2 py-1 truncate max-w-[160px]">{String(r[c.key] ?? "")}</td>)}
                      </tr>
                    ))}
                  </tbody>
                </table>
                {rows.length > 50 && <div className="text-center text-xs text-muted-foreground py-2">+{rows.length - 50} صف إضافي</div>}
              </div>
            )}

            {result && (
              <div className="rounded-md border p-3 space-y-2">
                <div className="flex items-center gap-3 text-sm">
                  <span className="flex items-center gap-1 text-emerald-600"><CheckCircle2 className="h-4 w-4" />نجح: {result.ok}</span>
                  <span className="flex items-center gap-1 text-rose-600"><AlertCircle className="h-4 w-4" />فشل: {result.failed}</span>
                </div>
                {result.errors.length > 0 && (
                  <ul className="text-xs text-muted-foreground space-y-1 max-h-32 overflow-auto">
                    {result.errors.slice(0, 20).map((e, i) => <li key={i}>• {e}</li>)}
                  </ul>
                )}
              </div>
            )}
          </div>

          <DialogFooter>
            <Button variant="ghost" onClick={() => setOpen(false)}>إغلاق</Button>
            <Button onClick={runImport} disabled={rows.length === 0 || busy}>
              {busy ? <Loader2 className="h-4 w-4 animate-spin me-2" /> : <Upload className="h-4 w-4 me-2" />}
              استيراد {rows.length > 0 ? `(${rows.length})` : ""}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}