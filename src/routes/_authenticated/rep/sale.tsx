import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useTranslation } from "react-i18next";
import { useMemo, useState } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { createSale } from "@/lib/api/sales.functions";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Card, CardContent } from "@/components/ui/card";
import { Plus, Minus, Trash2, Search, ShoppingCart, Printer } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/rep/sale")({
  component: RepSale,
});

type CartItem = { product_id: string; name: string; quantity: number; unit_price: number; tax_rate: number };

function RepSale() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const createSaleFn = useServerFn(createSale);
  const [customerId, setCustomerId] = useState<string>("");
  const [warehouseId, setWarehouseId] = useState<string>("");
  const [search, setSearch] = useState("");
  const [cart, setCart] = useState<CartItem[]>([]);
  const [paid, setPaid] = useState("0");

  const { data: customers = [] } = useQuery({
    queryKey: ["rep_sale_customers"],
    queryFn: async () => (await supabase.from("customers").select("id, name").eq("is_active", true).order("name")).data ?? [],
  });
  const { data: warehouses = [] } = useQuery({
    queryKey: ["rep_sale_warehouses"],
    queryFn: async () => {
      const { data } = await supabase.from("warehouses").select("id, name, is_default").eq("is_active", true);
      const list = data ?? [];
      const def = list.find((w) => w.is_default) ?? list[0];
      if (def && !warehouseId) setWarehouseId(def.id);
      return list;
    },
  });
  const { data: products = [] } = useQuery({
    queryKey: ["rep_sale_products", search],
    queryFn: async () => {
      let q = supabase.from("products").select("id, name_ar, sale_price, tax_rate").eq("is_active", true).limit(20);
      if (search.trim()) q = q.ilike("name_ar", `%${search}%`);
      return (await q).data ?? [];
    },
  });

  const add = (p: { id: string; name_ar: string; sale_price: number; tax_rate: number }) => {
    setCart((c) => {
      const ex = c.find((i) => i.product_id === p.id);
      if (ex) return c.map((i) => i.product_id === p.id ? { ...i, quantity: i.quantity + 1 } : i);
      return [...c, { product_id: p.id, name: p.name_ar, quantity: 1, unit_price: Number(p.sale_price), tax_rate: Number(p.tax_rate) }];
    });
  };
  const inc = (id: string, by: number) => setCart((c) => c.map((i) => i.product_id === id ? { ...i, quantity: Math.max(1, i.quantity + by) } : i));
  const rm = (id: string) => setCart((c) => c.filter((i) => i.product_id !== id));

  const totals = useMemo(() => {
    let sub = 0, tax = 0;
    for (const i of cart) {
      const net = i.quantity * i.unit_price;
      sub += net;
      tax += (net * i.tax_rate) / 100;
    }
    return { sub, tax, total: sub + tax };
  }, [cart]);

  const fmt = (n: number) => n.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });

  const save = useMutation({
    mutationFn: async () => {
      if (!warehouseId) throw new Error(t("sales.selectWarehouse"));
      if (cart.length === 0) throw new Error(t("sales.noItems"));
      // Get rep employee id
      const { data: { user } } = await supabase.auth.getUser();
      const { data: emp } = await supabase.from("employees").select("id").eq("user_id", user!.id).maybeSingle();
      return await createSaleFn({
        data: {
          customer_id: customerId || null,
          warehouse_id: warehouseId,
          paid: Number(paid) || 0,
          rep_id: emp?.id ?? null,
          items: cart.map((i) => ({ product_id: i.product_id, quantity: i.quantity, unit_price: i.unit_price, discount: 0, tax_rate: i.tax_rate })),
        },
      });
    },
    onSuccess: (res) => {
      toast.success(`${t("common.saved")} · ${res.invoice_number}`);
      setCart([]); setPaid("0");
      // Navigate to invoice preview via sales detail
      navigate({ to: "/sales", search: { detail: res.id } as any });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <div className="p-4 space-y-3">
      <h1 className="text-xl font-bold">{t("rep.quickSale")}</h1>

      <div className="grid grid-cols-2 gap-2">
        <Select value={customerId || "walkin"} onValueChange={(v) => setCustomerId(v === "walkin" ? "" : v)}>
          <SelectTrigger><SelectValue placeholder={t("sales.customer")} /></SelectTrigger>
          <SelectContent>
            <SelectItem value="walkin">{t("sales.walkin")}</SelectItem>
            {customers.map((c) => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}
          </SelectContent>
        </Select>
        <Select value={warehouseId} onValueChange={setWarehouseId}>
          <SelectTrigger><SelectValue placeholder={t("sales.warehouse")} /></SelectTrigger>
          <SelectContent>
            {warehouses.map((w) => <SelectItem key={w.id} value={w.id}>{w.name}</SelectItem>)}
          </SelectContent>
        </Select>
      </div>

      <div className="relative">
        <Search className="absolute start-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input className="ps-10 h-11 rounded-2xl" placeholder={t("rep.searchProduct")} value={search} onChange={(e) => setSearch(e.target.value)} />
      </div>

      {products.length > 0 && search && (
        <div className="rounded-xl border bg-card max-h-60 overflow-auto">
          {products.map((p) => (
            <button key={p.id} onClick={() => add(p)} className="w-full px-3 py-2.5 flex justify-between items-center text-sm hover:bg-accent border-b last:border-0">
              <span className="truncate text-start">{p.name_ar}</span>
              <span className="tabular-nums shrink-0 ms-2">{fmt(Number(p.sale_price))}</span>
            </button>
          ))}
        </div>
      )}

      <Card>
        <CardContent className="p-3 space-y-2">
          {cart.length === 0 ? (
            <div className="text-center text-xs text-muted-foreground py-6">{t("rep.cartEmpty")}</div>
          ) : cart.map((i) => (
            <div key={i.product_id} className="flex items-center gap-2">
              <div className="flex-1 min-w-0">
                <div className="text-sm font-medium truncate">{i.name}</div>
                <div className="text-[10px] text-muted-foreground">{fmt(i.unit_price)} × {i.quantity}</div>
              </div>
              <div className="flex items-center gap-1">
                <Button size="icon" variant="outline" className="h-7 w-7" onClick={() => inc(i.product_id, -1)}><Minus className="h-3 w-3" /></Button>
                <span className="w-6 text-center text-sm font-semibold">{i.quantity}</span>
                <Button size="icon" variant="outline" className="h-7 w-7" onClick={() => inc(i.product_id, +1)}><Plus className="h-3 w-3" /></Button>
                <Button size="icon" variant="ghost" className="h-7 w-7 text-destructive" onClick={() => rm(i.product_id)}><Trash2 className="h-3 w-3" /></Button>
              </div>
            </div>
          ))}
        </CardContent>
      </Card>

      <Card>
        <CardContent className="p-3 space-y-1.5 text-sm">
          <div className="flex justify-between"><span className="text-muted-foreground">{t("sales.subtotal")}</span><span className="tabular-nums">{fmt(totals.sub)}</span></div>
          <div className="flex justify-between"><span className="text-muted-foreground">{t("sales.taxTotal")}</span><span className="tabular-nums">{fmt(totals.tax)}</span></div>
          <div className="flex justify-between font-bold text-base border-t pt-1.5"><span>{t("sales.total")}</span><span className="tabular-nums">{fmt(totals.total)}</span></div>
          <div className="grid gap-1 pt-2"><Label className="text-xs">{t("sales.paid")}</Label><Input type="number" inputMode="decimal" value={paid} onChange={(e) => setPaid(e.target.value)} /></div>
        </CardContent>
      </Card>

      <Button size="lg" className="w-full h-14 rounded-2xl text-base" onClick={() => save.mutate()} disabled={save.isPending || cart.length === 0}>
        <ShoppingCart className="h-5 w-5 me-2" />{t("rep.saveAndPrint")}
      </Button>
    </div>
  );
}