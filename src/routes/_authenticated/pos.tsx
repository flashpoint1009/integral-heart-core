import { createFileRoute } from "@tanstack/react-router";
import { useTranslation } from "react-i18next";
import { useMemo, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { supabase } from "@/integrations/supabase/client";
import { createSale } from "@/lib/api/sales.functions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card } from "@/components/ui/card";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { Search, Trash2, Plus, Minus, ShoppingCart } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/pos")({
  head: () => ({ meta: [{ title: "POS — ERP" }] }),
  component: Page,
});

type Product = {
  id: string; name_ar: string; name_en: string | null; sku: string | null;
  barcode: string | null; sale_price: number; tax_rate: number;
};

function Page() {
  const { t, i18n } = useTranslation();
  const qc = useQueryClient();
  const createSaleFn = useServerFn(createSale);
  const [query, setQuery] = useState("");
  const [warehouseId, setWarehouseId] = useState<string>("");
  const [cart, setCart] = useState<Record<string, { p: Product; qty: number }>>({});
  const [paid, setPaid] = useState("0");

  const { data: products = [] } = useQuery({
    queryKey: ["pos_products"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("products")
        .select("id,name_ar,name_en,sku,barcode,sale_price,tax_rate")
        .eq("is_active", true).order("name_ar");
      if (error) throw error;
      return data as Product[];
    },
  });

  const { data: warehouses = [] } = useQuery({
    queryKey: ["warehouses", "active"],
    queryFn: async () => {
      const data = (await supabase.from("warehouses").select("id,name,is_default").eq("is_active", true).order("name")).data ?? [];
      if (!warehouseId) setWarehouseId((data.find((w) => w.is_default) ?? data[0])?.id ?? "");
      return data;
    },
  });

  const label = (p: Product) => i18n.language === "en" && p.name_en ? p.name_en : p.name_ar;

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return products.slice(0, 60);
    return products.filter((p) =>
      p.name_ar.toLowerCase().includes(q) ||
      (p.name_en ?? "").toLowerCase().includes(q) ||
      (p.sku ?? "").toLowerCase().includes(q) ||
      (p.barcode ?? "").toLowerCase().includes(q),
    );
  }, [products, query]);

  const addToCart = (p: Product) => {
    setCart((c) => {
      const ex = c[p.id];
      return { ...c, [p.id]: { p, qty: (ex?.qty ?? 0) + 1 } };
    });
  };
  const setQty = (id: string, qty: number) => {
    setCart((c) => {
      if (qty <= 0) { const { [id]: _, ...rest } = c; return rest; }
      return { ...c, [id]: { ...c[id], qty } };
    });
  };
  const clear = () => { setCart({}); setPaid("0"); };

  const onScanSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const q = query.trim();
    if (!q) return;
    const exact = products.find((p) => p.barcode === q || p.sku === q);
    if (exact) { addToCart(exact); setQuery(""); }
  };

  const totals = useMemo(() => {
    let subtotal = 0, tax = 0;
    Object.values(cart).forEach(({ p, qty }) => {
      const gross = qty * Number(p.sale_price);
      subtotal += gross;
      tax += (gross * Number(p.tax_rate)) / 100;
    });
    return { subtotal, tax, total: subtotal + tax };
  }, [cart]);

  const checkout = useMutation({
    mutationFn: async () => {
      if (!warehouseId) throw new Error(t("sales.selectWarehouse"));
      const items = Object.values(cart);
      if (items.length === 0) throw new Error(t("pos.emptyCart"));
      return await createSaleFn({
        data: {
          customer_id: null,
          warehouse_id: warehouseId,
          items: items.map(({ p, qty }) => ({
            product_id: p.id, quantity: qty, unit_price: Number(p.sale_price),
            discount: 0, tax_rate: Number(p.tax_rate),
          })),
          paid: Number(paid) || totals.total,
        },
      });
    },
    onSuccess: (res) => {
      toast.success(`${t("sales.invoice")} ${res.invoice_number}`);
      qc.invalidateQueries({ queryKey: ["sales_invoices"] });
      qc.invalidateQueries({ queryKey: ["inventory"] });
      clear();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const fmt = (n: number) => n.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  const paidNum = Number(paid) || 0;
  const change = Math.max(0, paidNum - totals.total);

  return (
    <div className="flex h-[calc(100vh-3.5rem)] bg-muted/30">
      <div className="flex-1 flex flex-col p-4 min-w-0">
        <form onSubmit={onScanSubmit} className="mb-3 flex gap-2">
          <div className="relative flex-1">
            <Search className="absolute start-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              autoFocus
              className="ps-9 h-11 text-base"
              placeholder={t("pos.scan")}
              value={query}
              onChange={(e) => setQuery(e.target.value)}
            />
          </div>
          <Select value={warehouseId} onValueChange={setWarehouseId}>
            <SelectTrigger className="w-[180px] h-11"><SelectValue placeholder={t("sales.selectWarehouse")} /></SelectTrigger>
            <SelectContent>{warehouses.map((w) => <SelectItem key={w.id} value={w.id}>{w.name}</SelectItem>)}</SelectContent>
          </Select>
        </form>
        {products.length === 0 ? (
          <div className="flex-1 flex items-center justify-center text-muted-foreground">{t("pos.noProducts")}</div>
        ) : (
          <div className="flex-1 overflow-y-auto">
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-3">
              {filtered.map((p) => (
                <button
                  key={p.id}
                  onClick={() => addToCart(p)}
                  className="text-start rounded-lg border bg-card p-3 hover:border-primary hover:shadow-md transition-all active:scale-[0.98]"
                >
                  <div className="font-medium text-sm line-clamp-2 min-h-[2.5rem]">{label(p)}</div>
                  {p.sku && <div className="text-[10px] text-muted-foreground font-mono mt-1">{p.sku}</div>}
                  <div className="mt-2 text-primary font-bold tabular-nums">{fmt(Number(p.sale_price))}</div>
                </button>
              ))}
            </div>
          </div>
        )}
      </div>

      <Card className="w-[380px] flex flex-col rounded-none border-y-0 border-e-0 shadow-none">
        <div className="p-4 border-b flex items-center justify-between">
          <div className="flex items-center gap-2 font-semibold">
            <ShoppingCart className="h-5 w-5 text-primary" />
            {t("pos.cart")}
          </div>
          {Object.keys(cart).length > 0 && (
            <Button variant="ghost" size="sm" onClick={clear}>{t("pos.clear")}</Button>
          )}
        </div>

        <div className="flex-1 overflow-y-auto p-2">
          {Object.keys(cart).length === 0 ? (
            <div className="h-full flex items-center justify-center text-center text-sm text-muted-foreground p-6">
              {t("pos.emptyCart")}
            </div>
          ) : (
            <div className="space-y-2">
              {Object.values(cart).map(({ p, qty }) => (
                <div key={p.id} className="rounded-md border p-2">
                  <div className="flex items-start justify-between gap-2">
                    <div className="text-sm font-medium flex-1 line-clamp-2">{label(p)}</div>
                    <button onClick={() => setQty(p.id, 0)}><Trash2 className="h-3.5 w-3.5 text-destructive" /></button>
                  </div>
                  <div className="mt-2 flex items-center justify-between">
                    <div className="flex items-center gap-1">
                      <Button size="icon" variant="outline" className="h-7 w-7" onClick={() => setQty(p.id, qty - 1)}><Minus className="h-3 w-3" /></Button>
                      <Input
                        type="number" min={0} value={qty}
                        onChange={(e) => setQty(p.id, Number(e.target.value))}
                        className="h-7 w-14 text-center tabular-nums"
                      />
                      <Button size="icon" variant="outline" className="h-7 w-7" onClick={() => setQty(p.id, qty + 1)}><Plus className="h-3 w-3" /></Button>
                    </div>
                    <div className="text-sm font-bold tabular-nums">{fmt(qty * Number(p.sale_price))}</div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="p-4 border-t space-y-2 text-sm">
          <div className="flex justify-between text-muted-foreground"><span>{t("sales.subtotal")}</span><span className="tabular-nums">{fmt(totals.subtotal)}</span></div>
          <div className="flex justify-between text-muted-foreground"><span>{t("sales.taxTotal")}</span><span className="tabular-nums">{fmt(totals.tax)}</span></div>
          <div className="flex justify-between font-bold text-lg pt-2 border-t"><span>{t("sales.total")}</span><span className="tabular-nums text-primary">{fmt(totals.total)}</span></div>
          <div className="pt-2">
            <label className="text-xs text-muted-foreground">{t("pos.amount")}</label>
            <Input type="number" step="0.01" value={paid} onChange={(e) => setPaid(e.target.value)} className="h-10 text-lg tabular-nums" />
          </div>
          {change > 0 && (
            <div className="flex justify-between text-success font-semibold"><span>{t("pos.change")}</span><span className="tabular-nums">{fmt(change)}</span></div>
          )}
          <Button
            className="w-full h-12 text-base mt-2"
            disabled={Object.keys(cart).length === 0 || checkout.isPending}
            onClick={() => checkout.mutate()}
          >
            {t("pos.complete")}
          </Button>
        </div>
      </Card>
    </div>
  );
}