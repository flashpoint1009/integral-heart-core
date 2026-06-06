import { createFileRoute } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { toast } from "sonner";
import { Download, FileJson, Upload, Database } from "lucide-react";
import {
  exportFullBackup, exportTableCsv, listBackupTables, restoreFromJson,
} from "@/lib/api/backup.functions";

export const Route = createFileRoute("/_authenticated/developer/backup")({
  component: BackupPage,
});

function download(name: string, content: string, mime: string) {
  const blob = new Blob([content], { type: mime });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url; a.download = name; a.click();
  URL.revokeObjectURL(url);
}

function BackupPage() {
  const listFn = useServerFn(listBackupTables);
  const exportFn = useServerFn(exportFullBackup);
  const csvFn = useServerFn(exportTableCsv);
  const restoreFn = useServerFn(restoreFromJson);

  const [busy, setBusy] = useState(false);
  const [table, setTable] = useState("");
  const [mode, setMode] = useState<"merge" | "replace">("merge");

  const { data: tablesData } = useQuery({
    queryKey: ["backup_tables"],
    queryFn: () => listFn(),
  });
  const tables = tablesData?.tables ?? [];

  const handleFull = async () => {
    setBusy(true);
    try {
      const res = await exportFn();
      const ts = new Date().toISOString().replace(/[:.]/g, "-");
      download(`backup-${ts}.json`, JSON.stringify(res, null, 2), "application/json");
      toast.success("تم تنزيل النسخة الاحتياطية");
    } catch (e: any) {
      toast.error(e.message ?? "فشل التصدير");
    } finally { setBusy(false); }
  };

  const handleCsv = async () => {
    if (!table) return;
    setBusy(true);
    try {
      const res = await csvFn({ data: { table } });
      if (!res.csv) { toast.info("الجدول فارغ"); return; }
      download(`${table}.csv`, res.csv, "text/csv;charset=utf-8");
      toast.success(`تم تصدير ${res.count} سجل`);
    } catch (e: any) {
      toast.error(e.message ?? "فشل التصدير");
    } finally { setBusy(false); }
  };

  const handleRestore = async (file: File) => {
    if (!confirm(`سيتم ${mode === "replace" ? "استبدال" : "دمج"} البيانات. متابعة؟`)) return;
    setBusy(true);
    try {
      const text = await file.text();
      const payload = JSON.parse(text);
      const res = await restoreFn({ data: { payload, mode } });
      const errs = res.results.filter((r) => r.error);
      toast.success(`تم الاستيراد: ${res.results.length} جدول${errs.length ? ` — ${errs.length} أخطاء` : ""}`);
      if (errs.length) console.warn("Restore errors:", errs);
    } catch (e: any) {
      toast.error(e.message ?? "فشل الاستيراد");
    } finally { setBusy(false); }
  };

  return (
    <div className="p-6 space-y-6 max-w-4xl">
      <header>
        <h1 className="text-2xl font-bold flex items-center gap-2"><Database className="h-6 w-6" /> النسخ الاحتياطي والاستعادة</h1>
        <p className="text-sm text-muted-foreground">تصدير واستيراد بيانات النظام بالكامل أو لكل جدول.</p>
      </header>

      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2"><FileJson className="h-5 w-5" /> نسخة كاملة (JSON)</CardTitle>
        </CardHeader>
        <CardContent>
          <Button onClick={handleFull} disabled={busy} className="gap-2">
            <Download className="h-4 w-4" /> تنزيل النسخة الكاملة
          </Button>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">تصدير جدول واحد (CSV)</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-wrap items-center gap-3">
          <Select value={table} onValueChange={setTable}>
            <SelectTrigger className="w-64"><SelectValue placeholder="اختر جدول" /></SelectTrigger>
            <SelectContent>
              {tables.map((t) => <SelectItem key={t} value={t}>{t}</SelectItem>)}
            </SelectContent>
          </Select>
          <Button onClick={handleCsv} disabled={busy || !table} variant="outline" className="gap-2">
            <Download className="h-4 w-4" /> تنزيل CSV
          </Button>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2"><Upload className="h-5 w-5" /> استعادة من JSON</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="flex items-center gap-3">
            <span className="text-sm">وضع الاستعادة:</span>
            <Select value={mode} onValueChange={(v: any) => setMode(v)}>
              <SelectTrigger className="w-48"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="merge">دمج (Upsert)</SelectItem>
                <SelectItem value="replace">استبدال كامل</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <input
            type="file"
            accept="application/json,.json"
            disabled={busy}
            onChange={(e) => { const f = e.target.files?.[0]; if (f) handleRestore(f); e.target.value = ""; }}
            className="block text-sm"
          />
          <p className="text-xs text-muted-foreground">
            تحذير: وضع "استبدال كامل" يحذف البيانات الحالية في كل جدول مذكور بالملف. استخدم بحذر.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}