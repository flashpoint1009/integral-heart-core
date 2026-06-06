import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { listPendingRequests, reviewRequest } from "@/lib/api/requests.functions";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Check, X, CalendarDays, Clock, Wallet } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/supervisor/requests")({
  component: SupervisorRequests,
});

function Status({ s }: { s: string }) {
  const map: Record<string, string> = {
    pending: "bg-amber-100 text-amber-800",
    approved: "bg-emerald-100 text-emerald-800",
    rejected: "bg-rose-100 text-rose-800",
    paid_off: "bg-blue-100 text-blue-800",
  };
  const label: Record<string, string> = { pending: "قيد المراجعة", approved: "موافق", rejected: "مرفوض", paid_off: "تم السداد" };
  return <span className={`text-[10px] px-2 py-0.5 rounded-full font-medium ${map[s] ?? ""}`}>{label[s] ?? s}</span>;
}

function SupervisorRequests() {
  const qc = useQueryClient();
  const list = useServerFn(listPendingRequests);
  const review = useServerFn(reviewRequest);
  const { data, isLoading } = useQuery({ queryKey: ["pending_requests"], queryFn: () => list() });

  const m = useMutation({
    mutationFn: (v: { kind: "leave"|"late"|"advance"; id: string; decision: "approved"|"rejected" }) =>
      review({ data: v }),
    onSuccess: () => { toast.success("تم تحديث الطلب"); qc.invalidateQueries({ queryKey: ["pending_requests"] }); },
    onError: (e: any) => toast.error(e.message),
  });

  const Row = ({ item, kind, primary, secondary }: { item: any; kind: "leave"|"late"|"advance"; primary: string; secondary?: string }) => (
    <li className="rounded-lg border p-3 flex items-center gap-3">
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <span className="font-medium text-sm truncate">{item.employees?.full_name ?? "—"}</span>
          <Status s={item.status} />
        </div>
        <div className="text-xs text-muted-foreground mt-0.5">{primary}</div>
        {secondary && <div className="text-[11px] text-muted-foreground">{secondary}</div>}
        {item.reason && <div className="text-[11px] text-muted-foreground mt-1 line-clamp-2">السبب: {item.reason}</div>}
      </div>
      {item.status === "pending" && (
        <div className="flex flex-col gap-1.5">
          <Button size="sm" variant="default" disabled={m.isPending} onClick={() => m.mutate({ kind, id: item.id, decision: "approved" })}>
            <Check className="h-3.5 w-3.5" />
          </Button>
          <Button size="sm" variant="outline" disabled={m.isPending} onClick={() => m.mutate({ kind, id: item.id, decision: "rejected" })}>
            <X className="h-3.5 w-3.5" />
          </Button>
        </div>
      )}
    </li>
  );

  const pendingCount = (arr: any[]) => arr.filter((r) => r.status === "pending").length;
  const lc = data ? pendingCount(data.leaves) : 0;
  const tc = data ? pendingCount(data.lates) : 0;
  const ac = data ? pendingCount(data.advances) : 0;

  return (
    <div className="space-y-4">
      <Tabs defaultValue="leaves">
        <TabsList>
          <TabsTrigger value="leaves"><CalendarDays className="h-4 w-4 me-1" />إجازات {lc > 0 && <span className="ms-1 text-[10px] bg-primary text-primary-foreground rounded-full px-1.5">{lc}</span>}</TabsTrigger>
          <TabsTrigger value="lates"><Clock className="h-4 w-4 me-1" />تأخير {tc > 0 && <span className="ms-1 text-[10px] bg-primary text-primary-foreground rounded-full px-1.5">{tc}</span>}</TabsTrigger>
          <TabsTrigger value="advances"><Wallet className="h-4 w-4 me-1" />سلف {ac > 0 && <span className="ms-1 text-[10px] bg-primary text-primary-foreground rounded-full px-1.5">{ac}</span>}</TabsTrigger>
        </TabsList>

        <TabsContent value="leaves">
          <Card><CardContent className="p-4">
            {isLoading && <div className="text-sm text-muted-foreground">جارٍ التحميل…</div>}
            <ul className="space-y-2">
              {(data?.leaves ?? []).map((r: any) => (
                <Row key={r.id} item={r} kind="leave" primary={`${r.leave_type} • ${r.days} يوم`} secondary={`${r.from_date} → ${r.to_date}`} />
              ))}
              {data && data.leaves.length === 0 && <div className="text-xs text-muted-foreground">لا توجد طلبات</div>}
            </ul>
          </CardContent></Card>
        </TabsContent>

        <TabsContent value="lates">
          <Card><CardContent className="p-4">
            <ul className="space-y-2">
              {(data?.lates ?? []).map((r: any) => (
                <Row key={r.id} item={r} kind="late" primary={`${r.late_minutes} دقيقة`} secondary={r.request_date} />
              ))}
              {data && data.lates.length === 0 && <div className="text-xs text-muted-foreground">لا توجد طلبات</div>}
            </ul>
          </CardContent></Card>
        </TabsContent>

        <TabsContent value="advances">
          <Card><CardContent className="p-4">
            <ul className="space-y-2">
              {(data?.advances ?? []).map((r: any) => (
                <Row key={r.id} item={r} kind="advance" primary={`${Number(r.amount).toFixed(2)} • ${r.installments} قسط`} secondary={`قسط شهري: ${Number(r.monthly_deduction).toFixed(2)}`} />
              ))}
              {data && data.advances.length === 0 && <div className="text-xs text-muted-foreground">لا توجد طلبات</div>}
            </ul>
          </CardContent></Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}