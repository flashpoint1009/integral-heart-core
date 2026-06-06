import { createFileRoute } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { listOnlineOrders, updateOnlineOrderStatus } from "@/lib/api/storefront.functions";
import { PageHeader } from "@/components/app/page-header";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/online-orders")({
  head: () => ({ meta: [{ title: "طلبات المتجر" }] }),
  component: Page,
});

const STATUS_LABELS: Record<string, string> = {
  pending: "قيد المراجعة", confirmed: "مؤكد", shipped: "قيد التوصيل",
  delivered: "تم التسليم", cancelled: "ملغي",
};
const STATUS_VARIANTS: Record<string, "default" | "secondary" | "destructive" | "outline"> = {
  pending: "secondary", confirmed: "default", shipped: "default",
  delivered: "default", cancelled: "destructive",
};

function Page() {
  const list = useServerFn(listOnlineOrders);
  const update = useServerFn(updateOnlineOrderStatus);
  const qc = useQueryClient();
  const { data } = useQuery({ queryKey: ["online_orders"], queryFn: () => list() });
  const m = useMutation({
    mutationFn: (v: { id: string; status: any }) => update({ data: v }),
    onSuccess: () => { toast.success("تم التحديث"); qc.invalidateQueries({ queryKey: ["online_orders"] }); },
  });
  const orders = data?.orders ?? [];
  return (
    <div className="p-4 md:p-6">
      <PageHeader title="طلبات المتجر الأونلاين" description="طلبات الدفع عند الاستلام" />
      <div className="space-y-3 mt-4">
        {orders.length === 0 && <p className="text-center text-muted-foreground py-12">لا توجد طلبات</p>}
        {orders.map((o: any) => (
          <Card key={o.id}>
            <CardContent className="p-4">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <div className="flex items-center gap-2">
                    <span className="font-mono font-bold">{o.order_number}</span>
                    <Badge variant={STATUS_VARIANTS[o.status]}>{STATUS_LABELS[o.status]}</Badge>
                  </div>
                  <div className="text-sm text-muted-foreground mt-1">
                    {new Date(o.created_at).toLocaleString("ar-EG")}
                  </div>
                  <div className="mt-2 text-sm space-y-1">
                    <div><strong>{o.customer_name}</strong> — {o.customer_phone}</div>
                    <div className="text-muted-foreground">{o.customer_address}</div>
                    {o.customer_notes && <div className="text-muted-foreground italic">{o.customer_notes}</div>}
                  </div>
                </div>
                <div className="text-end">
                  <div className="text-2xl font-bold text-primary">{Number(o.total).toFixed(2)} ج.م</div>
                  <Select value={o.status} onValueChange={(v) => m.mutate({ id: o.id, status: v })}>
                    <SelectTrigger className="w-40 mt-2"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {Object.entries(STATUS_LABELS).map(([k, v]) => (
                        <SelectItem key={k} value={k}>{v}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <div className="mt-3 border-t pt-3 space-y-1 text-sm">
                {(o.online_order_items ?? []).map((it: any) => (
                  <div key={it.id} className="flex justify-between">
                    <span>{it.product_name} × {it.qty}</span>
                    <span>{Number(it.total).toFixed(2)}</span>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}