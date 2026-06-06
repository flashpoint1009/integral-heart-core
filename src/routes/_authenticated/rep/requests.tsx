import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { listMyRequests, createLeaveRequest, createLatePermission, createAdvanceRequest } from "@/lib/api/requests.functions";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { CalendarDays, Clock, Wallet } from "lucide-react";

export const Route = createFileRoute("/_authenticated/rep/requests")({
  component: RequestsPage,
});

function StatusBadge({ s }: { s: string }) {
  const map: Record<string, string> = {
    pending: "bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-300",
    approved: "bg-emerald-100 text-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-300",
    rejected: "bg-rose-100 text-rose-800 dark:bg-rose-900/30 dark:text-rose-300",
    paid_off: "bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300",
  };
  const label: Record<string, string> = { pending: "قيد المراجعة", approved: "موافق عليه", rejected: "مرفوض", paid_off: "تم السداد" };
  return <span className={`text-[10px] px-2 py-0.5 rounded-full font-medium ${map[s] ?? ""}`}>{label[s] ?? s}</span>;
}

function RequestsPage() {
  const qc = useQueryClient();
  const list = useServerFn(listMyRequests);
  const { data, isLoading } = useQuery({ queryKey: ["my_requests"], queryFn: () => list() });

  const createLeave = useServerFn(createLeaveRequest);
  const createLate = useServerFn(createLatePermission);
  const createAdv = useServerFn(createAdvanceRequest);

  const today = new Date().toISOString().slice(0, 10);

  // Leave form
  const [lvType, setLvType] = useState<"annual"|"casual"|"sick"|"unpaid"|"other">("annual");
  const [lvFrom, setLvFrom] = useState(today);
  const [lvTo, setLvTo] = useState(today);
  const [lvReason, setLvReason] = useState("");

  // Late form
  const [ltDate, setLtDate] = useState(today);
  const [ltMin, setLtMin] = useState(30);
  const [ltReason, setLtReason] = useState("");

  // Advance form
  const [advAmount, setAdvAmount] = useState(0);
  const [advInst, setAdvInst] = useState(1);
  const [advReason, setAdvReason] = useState("");

  const refresh = () => qc.invalidateQueries({ queryKey: ["my_requests"] });

  const mLeave = useMutation({
    mutationFn: () => createLeave({ data: { leave_type: lvType, from_date: lvFrom, to_date: lvTo, reason: lvReason || undefined } }),
    onSuccess: () => { toast.success("تم إرسال طلب الإجازة"); setLvReason(""); refresh(); },
    onError: (e: any) => toast.error(e.message),
  });
  const mLate = useMutation({
    mutationFn: () => createLate({ data: { request_date: ltDate, late_minutes: ltMin, reason: ltReason || undefined } }),
    onSuccess: () => { toast.success("تم إرسال إذن التأخير"); setLtReason(""); refresh(); },
    onError: (e: any) => toast.error(e.message),
  });
  const mAdv = useMutation({
    mutationFn: () => createAdv({ data: { amount: Number(advAmount), installments: Number(advInst), reason: advReason || undefined } }),
    onSuccess: () => { toast.success("تم إرسال طلب السلفة"); setAdvAmount(0); setAdvInst(1); setAdvReason(""); refresh(); },
    onError: (e: any) => toast.error(e.message),
  });

  return (
    <div className="p-4 space-y-4">
      <div>
        <h1 className="text-xl font-bold">طلباتي</h1>
        <p className="text-xs text-muted-foreground">إجازات، تأخير، سلف</p>
      </div>

      <Tabs defaultValue="leave">
        <TabsList className="grid w-full grid-cols-3">
          <TabsTrigger value="leave"><CalendarDays className="h-4 w-4 me-1" />إجازة</TabsTrigger>
          <TabsTrigger value="late"><Clock className="h-4 w-4 me-1" />تأخير</TabsTrigger>
          <TabsTrigger value="advance"><Wallet className="h-4 w-4 me-1" />سلفة</TabsTrigger>
        </TabsList>

        <TabsContent value="leave" className="space-y-3">
          <Card><CardContent className="p-4 space-y-3">
            <div className="space-y-1">
              <Label>نوع الإجازة</Label>
              <Select value={lvType} onValueChange={(v) => setLvType(v as any)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="annual">سنوية</SelectItem>
                  <SelectItem value="casual">عارضة</SelectItem>
                  <SelectItem value="sick">مرضية</SelectItem>
                  <SelectItem value="unpaid">بدون راتب</SelectItem>
                  <SelectItem value="other">أخرى</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="grid grid-cols-2 gap-2">
              <div className="space-y-1"><Label>من</Label><Input type="date" value={lvFrom} onChange={(e) => setLvFrom(e.target.value)} /></div>
              <div className="space-y-1"><Label>إلى</Label><Input type="date" value={lvTo} onChange={(e) => setLvTo(e.target.value)} /></div>
            </div>
            <div className="space-y-1"><Label>السبب</Label><Textarea rows={2} value={lvReason} onChange={(e) => setLvReason(e.target.value)} /></div>
            <Button className="w-full" disabled={mLeave.isPending} onClick={() => mLeave.mutate()}>إرسال طلب الإجازة</Button>
          </CardContent></Card>
          <RequestList title="طلبات الإجازة" items={(data?.leaves ?? []).map((r: any) => ({ id: r.id, status: r.status, line1: `${r.leave_type} • ${r.days} يوم`, line2: `${r.from_date} → ${r.to_date}`, line3: r.reason }))} loading={isLoading} />
        </TabsContent>

        <TabsContent value="late" className="space-y-3">
          <Card><CardContent className="p-4 space-y-3">
            <div className="grid grid-cols-2 gap-2">
              <div className="space-y-1"><Label>التاريخ</Label><Input type="date" value={ltDate} onChange={(e) => setLtDate(e.target.value)} /></div>
              <div className="space-y-1"><Label>المدة (دقائق)</Label><Input type="number" min={1} max={480} value={ltMin} onChange={(e) => setLtMin(Number(e.target.value))} /></div>
            </div>
            <div className="space-y-1"><Label>السبب</Label><Textarea rows={2} value={ltReason} onChange={(e) => setLtReason(e.target.value)} /></div>
            <Button className="w-full" disabled={mLate.isPending} onClick={() => mLate.mutate()}>إرسال إذن التأخير</Button>
          </CardContent></Card>
          <RequestList title="أذونات التأخير" items={(data?.lates ?? []).map((r: any) => ({ id: r.id, status: r.status, line1: `${r.late_minutes} دقيقة`, line2: r.request_date, line3: r.reason }))} loading={isLoading} />
        </TabsContent>

        <TabsContent value="advance" className="space-y-3">
          <Card><CardContent className="p-4 space-y-3">
            <div className="grid grid-cols-2 gap-2">
              <div className="space-y-1"><Label>المبلغ</Label><Input type="number" min={0} value={advAmount} onChange={(e) => setAdvAmount(Number(e.target.value))} /></div>
              <div className="space-y-1"><Label>عدد الأقساط</Label><Input type="number" min={1} max={36} value={advInst} onChange={(e) => setAdvInst(Number(e.target.value))} /></div>
            </div>
            {advAmount > 0 && advInst > 0 && (
              <div className="text-xs text-muted-foreground">القسط الشهري: <span className="font-semibold text-foreground">{(advAmount / advInst).toFixed(2)}</span></div>
            )}
            <div className="space-y-1"><Label>السبب</Label><Textarea rows={2} value={advReason} onChange={(e) => setAdvReason(e.target.value)} /></div>
            <Button className="w-full" disabled={mAdv.isPending || advAmount <= 0} onClick={() => mAdv.mutate()}>إرسال طلب السلفة</Button>
          </CardContent></Card>
          <RequestList title="طلبات السلف" items={(data?.advances ?? []).map((r: any) => ({ id: r.id, status: r.status, line1: `${Number(r.amount).toFixed(2)} • ${r.installments} قسط`, line2: `قسط شهري: ${Number(r.monthly_deduction).toFixed(2)}`, line3: r.reason }))} loading={isLoading} />
        </TabsContent>
      </Tabs>
    </div>
  );
}

function RequestList({ title, items, loading }: { title: string; items: Array<{ id: string; status: string; line1: string; line2?: string; line3?: string | null }>; loading: boolean }) {
  return (
    <Card><CardContent className="p-4 space-y-2">
      <div className="text-sm font-semibold">{title}</div>
      {loading && <div className="text-xs text-muted-foreground">جارٍ التحميل…</div>}
      {!loading && items.length === 0 && <div className="text-xs text-muted-foreground">لا توجد طلبات بعد</div>}
      <ul className="space-y-2">
        {items.map((it) => (
          <li key={it.id} className="rounded-lg border p-3 text-sm">
            <div className="flex items-center justify-between">
              <span className="font-medium">{it.line1}</span>
              <StatusBadge s={it.status} />
            </div>
            {it.line2 && <div className="text-xs text-muted-foreground mt-0.5">{it.line2}</div>}
            {it.line3 && <div className="text-xs text-muted-foreground mt-0.5 line-clamp-2">{it.line3}</div>}
          </li>
        ))}
      </ul>
    </CardContent></Card>
  );
}