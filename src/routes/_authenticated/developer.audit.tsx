import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useAuth } from "@/lib/auth-context";
import { listAuditLog, deleteAuditEntry, clearAuditLog } from "@/lib/api/audit.functions";
import { PageHeader } from "@/components/app/page-header";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Trash2, Eye, History, Filter, RefreshCw } from "lucide-react";
import { toast } from "sonner";
import { format } from "date-fns";

export const Route = createFileRoute("/_authenticated/developer/audit")({
  head: () => ({ meta: [{ title: "سجل العمليات — Audit Log" }] }),
  component: AuditPage,
});

const SENSITIVE_TABLES = [
  "sales_invoices", "sales_invoice_items", "expenses", "customer_payments", "supplier_payments",
  "payroll_runs", "payroll_items", "employees", "products", "customers", "suppliers",
  "journal_entries", "online_orders", "attendance", "leave_requests", "salary_advances",
  "penalties", "bonuses", "account_transfers", "stock_movements", "user_roles", "user_screen_permissions",
];

function AuditPage() {
  const { isDeveloper } = useAuth();
  const qc = useQueryClient();
  const listFn = useServerFn(listAuditLog);
  const delFn = useServerFn(deleteAuditEntry);
  const clearFn = useServerFn(clearAuditLog);

  const [table, setTable] = useState<string>("all");
  const [action, setAction] = useState<string>("all");
  const [from, setFrom] = useState<string>("");
  const [to, setTo] = useState<string>("");
  const [selected, setSelected] = useState<any>(null);

  const filters = {
    table: table === "all" ? undefined : table,
    action: action === "all" ? undefined : (action as any),
    from: from || undefined,
    to: to || undefined,
    limit: 200,
  };

  const { data, isLoading, refetch } = useQuery({
    queryKey: ["audit_log", filters],
    queryFn: () => listFn({ data: filters }),
    enabled: isDeveloper,
  });

  const delMut = useMutation({
    mutationFn: (id: string) => delFn({ data: { id } }),
    onSuccess: () => { toast.success("تم الحذف"); qc.invalidateQueries({ queryKey: ["audit_log"] }); },
    onError: (e: any) => toast.error(e?.message ?? "فشل الحذف"),
  });

  const clearMut = useMutation({
    mutationFn: () => clearFn({ data: {} }),
    onSuccess: () => { toast.success("تم مسح السجل"); qc.invalidateQueries({ queryKey: ["audit_log"] }); },
    onError: (e: any) => toast.error(e?.message ?? "فشل المسح"),
  });

  if (!isDeveloper) {
    return (
      <div className="p-6">
        <Card><CardContent className="p-8 text-center text-muted-foreground">هذه الصفحة للمطور فقط</CardContent></Card>
      </div>
    );
  }

  return (
    <div className="p-4 md:p-6 space-y-4">
      <PageHeader
        title="سجل العمليات"
        description="كل عمليات الإضافة والتعديل والحذف على الجداول الحساسة"
      />

      <Card>
        <CardContent className="p-4 grid grid-cols-1 md:grid-cols-6 gap-3">
          <Select value={table} onValueChange={setTable}>
            <SelectTrigger><SelectValue placeholder="الجدول" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">كل الجداول</SelectItem>
              {SENSITIVE_TABLES.map((t) => <SelectItem key={t} value={t}>{t}</SelectItem>)}
            </SelectContent>
          </Select>
          <Select value={action} onValueChange={setAction}>
            <SelectTrigger><SelectValue placeholder="نوع العملية" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">الكل</SelectItem>
              <SelectItem value="INSERT">إضافة</SelectItem>
              <SelectItem value="UPDATE">تعديل</SelectItem>
              <SelectItem value="DELETE">حذف</SelectItem>
            </SelectContent>
          </Select>
          <Input type="date" value={from} onChange={(e) => setFrom(e.target.value)} placeholder="من" />
          <Input type="date" value={to} onChange={(e) => setTo(e.target.value)} placeholder="إلى" />
          <Button variant="outline" onClick={() => refetch()} className="gap-2">
            <RefreshCw className="h-4 w-4" /> تحديث
          </Button>
          <Button
            variant="destructive"
            onClick={() => { if (confirm("هل تريد مسح كل السجل؟")) clearMut.mutate(); }}
            className="gap-2"
          >
            <Trash2 className="h-4 w-4" /> مسح الكل
          </Button>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-muted/50">
                <tr className="text-right">
                  <th className="p-3">التاريخ</th>
                  <th className="p-3">المستخدم</th>
                  <th className="p-3">الجدول</th>
                  <th className="p-3">العملية</th>
                  <th className="p-3">المعرّف</th>
                  <th className="p-3">الحقول المعدّلة</th>
                  <th className="p-3">إجراءات</th>
                </tr>
              </thead>
              <tbody>
                {isLoading && <tr><td colSpan={7} className="p-6 text-center text-muted-foreground">جارٍ التحميل...</td></tr>}
                {!isLoading && (data?.rows ?? []).length === 0 && (
                  <tr><td colSpan={7} className="p-6 text-center text-muted-foreground">لا توجد سجلات</td></tr>
                )}
                {(data?.rows ?? []).map((r: any) => (
                  <tr key={r.id} className="border-t hover:bg-muted/30">
                    <td className="p-3 whitespace-nowrap text-xs">{format(new Date(r.created_at), "yyyy-MM-dd HH:mm:ss")}</td>
                    <td className="p-3 text-xs">{r.user_email ?? r.user_id ?? "نظام"}</td>
                    <td className="p-3 font-mono text-xs">{r.table_name}</td>
                    <td className="p-3">
                      <Badge variant={r.action === "DELETE" ? "destructive" : r.action === "INSERT" ? "default" : "secondary"}>
                        {r.action === "INSERT" ? "إضافة" : r.action === "UPDATE" ? "تعديل" : "حذف"}
                      </Badge>
                    </td>
                    <td className="p-3 font-mono text-xs truncate max-w-[140px]">{r.record_id}</td>
                    <td className="p-3 text-xs">
                      {(r.changed_fields ?? []).slice(0, 4).map((f: string) => (
                        <Badge key={f} variant="outline" className="ml-1 text-[10px]">{f}</Badge>
                      ))}
                      {(r.changed_fields ?? []).length > 4 && <span className="text-muted-foreground">+{r.changed_fields.length - 4}</span>}
                    </td>
                    <td className="p-3 flex gap-1">
                      <Button size="icon" variant="ghost" onClick={() => setSelected(r)}><Eye className="h-4 w-4" /></Button>
                      <Button size="icon" variant="ghost" onClick={() => { if (confirm("حذف هذا السجل؟")) delMut.mutate(r.id); }}>
                        <Trash2 className="h-4 w-4 text-destructive" />
                      </Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>

      <Dialog open={!!selected} onOpenChange={(o) => !o && setSelected(null)}>
        <DialogContent className="max-w-3xl max-h-[80vh] overflow-auto">
          <DialogHeader><DialogTitle>تفاصيل العملية</DialogTitle></DialogHeader>
          {selected && (
            <div className="space-y-4 text-sm">
              <div className="grid grid-cols-2 gap-3">
                <div><div className="text-muted-foreground text-xs">المستخدم</div><div>{selected.user_email}</div></div>
                <div><div className="text-muted-foreground text-xs">التاريخ</div><div>{format(new Date(selected.created_at), "yyyy-MM-dd HH:mm:ss")}</div></div>
                <div><div className="text-muted-foreground text-xs">الجدول</div><div className="font-mono">{selected.table_name}</div></div>
                <div><div className="text-muted-foreground text-xs">العملية</div><div>{selected.action}</div></div>
              </div>
              {selected.old_data && (
                <div>
                  <div className="font-semibold mb-1">قبل:</div>
                  <pre className="bg-muted p-3 rounded text-xs overflow-auto max-h-60" dir="ltr">{JSON.stringify(selected.old_data, null, 2)}</pre>
                </div>
              )}
              {selected.new_data && (
                <div>
                  <div className="font-semibold mb-1">بعد:</div>
                  <pre className="bg-muted p-3 rounded text-xs overflow-auto max-h-60" dir="ltr">{JSON.stringify(selected.new_data, null, 2)}</pre>
                </div>
              )}
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}