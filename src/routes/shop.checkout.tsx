import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useMutation } from "@tanstack/react-query";
import { useState } from "react";
import { useCart } from "@/lib/shop-cart";
import { createOnlineOrder } from "@/lib/api/storefront.functions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent } from "@/components/ui/card";
import { Trash2, Plus, Minus, CheckCircle2, Truck } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/shop/checkout")({
  head: () => ({ meta: [{ title: "إتمام الطلب — الدفع عند الاستلام" }] }),
  component: Checkout,
});

function Checkout() {
  const { items, setQty, remove, clear, total } = useCart();
  const [form, setForm] = useState({ name: "", phone: "", address: "", notes: "" });
  const [success, setSuccess] = useState<{ order_number: string; total: number } | null>(null);
  const submit = useServerFn(createOnlineOrder);
  const m = useMutation({
    mutationFn: () => submit({ data: {
      customer_name: form.name, customer_phone: form.phone,
      customer_address: form.address, customer_notes: form.notes || undefined,
      items: items.map((i) => ({ product_id: i.product_id, qty: i.qty })),
    }}),
    onSuccess: (r) => { setSuccess({ order_number: r.order_number, total: r.total }); clear(); },
    onError: (e: any) => toast.error(e.message ?? "فشل إرسال الطلب"),
  });

  if (success) {
    return (
      <main className="mx-auto max-w-2xl px-4 py-16 text-center">
        <CheckCircle2 className="h-20 w-20 mx-auto text-success" />
        <h1 className="text-3xl font-bold mt-4">تم استلام طلبك!</h1>
        <p className="text-muted-foreground mt-2">رقم الطلب: <span className="font-mono font-bold">{success.order_number}</span></p>
        <p className="text-lg mt-2">الإجمالي: <span className="font-bold">{success.total.toFixed(2)} ج.م</span></p>
        <p className="text-sm text-muted-foreground mt-4">سنتواصل معك قريباً لتأكيد الطلب. الدفع عند الاستلام.</p>
        <Link to="/shop" className="inline-block mt-6 underline">العودة للمتجر</Link>
      </main>
    );
  }

  if (items.length === 0) {
    return (
      <main className="mx-auto max-w-2xl px-4 py-16 text-center">
        <h1 className="text-2xl font-bold">السلة فارغة</h1>
        <Link to="/shop" className="inline-block mt-6 text-primary underline">تابع التسوّق</Link>
      </main>
    );
  }

  return (
    <main className="mx-auto max-w-5xl px-4 py-6 grid md:grid-cols-3 gap-6">
      <section className="md:col-span-2 space-y-3">
        <h2 className="text-xl font-bold">السلة</h2>
        {items.map((it) => (
          <Card key={it.product_id}>
            <CardContent className="p-3 flex items-center gap-3">
              <div className="w-16 h-16 bg-muted rounded overflow-hidden shrink-0">
                {it.image && <img src={it.image} alt={it.name} className="w-full h-full object-cover" />}
              </div>
              <div className="flex-1 min-w-0">
                <div className="font-semibold truncate">{it.name}</div>
                <div className="text-sm text-primary">{it.price.toFixed(2)} ج.م</div>
              </div>
              <div className="flex items-center gap-1">
                <Button size="icon" variant="outline" onClick={() => setQty(it.product_id, it.qty - 1)}><Minus className="h-3 w-3" /></Button>
                <span className="w-8 text-center font-semibold">{it.qty}</span>
                <Button size="icon" variant="outline" onClick={() => setQty(it.product_id, it.qty + 1)}><Plus className="h-3 w-3" /></Button>
              </div>
              <Button size="icon" variant="ghost" onClick={() => remove(it.product_id)}><Trash2 className="h-4 w-4 text-destructive" /></Button>
            </CardContent>
          </Card>
        ))}
      </section>
      <section className="space-y-4">
        <Card>
          <CardContent className="p-4 space-y-3">
            <h3 className="font-bold">بيانات الاستلام</h3>
            <div><Label>الاسم</Label><Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} /></div>
            <div><Label>الهاتف</Label><Input value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} /></div>
            <div><Label>العنوان</Label><Textarea value={form.address} onChange={(e) => setForm({ ...form, address: e.target.value })} /></div>
            <div><Label>ملاحظات (اختياري)</Label><Textarea value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} /></div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 space-y-2">
            <div className="flex justify-between"><span>الإجمالي</span><span className="font-bold text-lg">{total.toFixed(2)} ج.م</span></div>
            <div className="flex items-center gap-2 text-sm text-muted-foreground bg-muted p-2 rounded">
              <Truck className="h-4 w-4" /> الدفع عند الاستلام
            </div>
            <Button className="w-full" size="lg"
              disabled={!form.name || !form.phone || !form.address || m.isPending}
              onClick={() => m.mutate()}>
              {m.isPending ? "جاري الإرسال..." : "تأكيد الطلب"}
            </Button>
          </CardContent>
        </Card>
      </section>
    </main>
  );
}