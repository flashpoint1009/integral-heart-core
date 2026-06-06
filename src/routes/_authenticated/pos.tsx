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
import { Search, Trash2, Plus, Minus, ShoppingCart, Package, Receipt, Wallet } from "lucide-react";
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
    <div className="flex h-[calc(100vh-4rem)] bg-muted/40">
      {/* Products column */}
      <div className="flex-1 flex flex-col p-4 md:p-6 min-w-0">
        <form onSubmit={onScanSubmit} className="mb-4 flex gap-2">
          <div className="relative flex-1">
            <Search className="absolute start-4 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              autoFocus
              className="ps-11 h-12 text-base rounded-full bg-background border-transparent shadow-sm focus-visible:ring-2 focus-visible:ring-primary/30"
              placeholder={t("pos.scan")}
              value={query}
              onChange={(e) => setQuery(e.target.value)}
            />
          </div>
          <Select value={warehouseId} onValueChange={setWarehouseId}>
            <SelectTrigger className="w-[200px] h-12 rounded-full bg-background border-transparent shadow-sm">
              <SelectValue placeholder={t("sales.selectWarehouse")} />
            </SelectTrigger>
            <SelectContent>{warehouses.map((w) => <SelectItem key={w.id} value={w.id}>{w.name}</SelectItem>)}</SelectContent>
          </Select>
        </form>

        {products.length === 0 ? (
          <div className="flex-1 flex flex-col items-center justify-center text-muted-foreground gap-3">
            <div className="h-16 w-16 rounded-2xl bg-muted flex items-center justify-center">
              <Package className="h-7 w-7" />
            </div>
            <p className="text-sm">{t("pos.noProducts")}</p>
          </div>
        ) : (
          <div className="flex-1 overflow-y-auto pe-1">
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-3">
              {filtered.map((p) => {
                const inCart = !!cart[p.id];
                return (
                  <button
                    key={p.id}
                    onClick={() => addToCart(p)}
                    className={`group relative text-start rounded-2xl border bg-card p-4 transition-all active:scale-[0.97] hover:shadow-lg hover:-translate-y-0.5 hover:border-primary/40 ${
                      inCart ? "border-primary/60 ring-2 ring-primary/20" : "border-border/60"
                    }`}
                  >
                    <div className="flex h-14 w-14 items-center justify-center rounded-xl bg-gradient-to-br from-primary/10 to-primary/5 text-primary mb-3 group-hover:scale-110 transition-transform">
                      <Package className="h-6 w-6" />
                    </div>
                    <div className="font-semibold text-sm line-clamp-2 min-h-[2.5rem] leading-snug">{label(p)}</div>
                    {p.sku && <div className="text-[10px] text-muted-foreground font-mono mt-1 truncate">{p.sku}</div>}
                    <div className="mt-3 flex items-baseline justify-between">
                      <span className="text-primary font-bold tabular-nums text-base">{fmt(Number(p.sale_price))}</span>
                      {inCart && (
                        <span className="flex h-6 w-6 items-center justify-center rounded-full bg-primary text-primary-foreground text-[10px] font-bold tabular-nums">
                          {cart[p.id].qty}
                        </span>
                      )}
                    </div>
                  </button>
                );
              })}
            </div>
          </div>
        )}
      </div>

      {/* Cart panel */}
      <Card className="w-[400px] flex flex-col rounded-none border-y-0 border-e-0 border-s shadow-none bg-background">
        <div className="p-5 border-b flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary/10 text-primary">
              <ShoppingCart className="h-5 w-5" />
            </div>
            <div>
              <div className="font-bold text-base">{t("pos.cart")}</div>
              <div className="text-xs text-muted-foreground">
                {Object.keys(cart).length} {t("pos.items", "صنف")}
              </div>
            </div>
          </div>
          {Object.keys(cart).length > 0 && (
            <Button variant="ghost" size="sm" onClick={clear} className="rounded-full text-destructive hover:text-destructive hover:bg-destructive/10">
              <Trash2 className="h-4 w-4 me-1" />
              {t("pos.clear")}
            </Button>
          )}
        </div>

        <div className="flex-1 overflow-y-auto p-3">
          {Object.keys(cart).length === 0 ? (
            <div className="h-full flex flex-col items-center justify-center text-center text-sm text-muted-foreground p-6 gap-3">
              <div className="h-16 w-16 rounded-2xl bg-muted flex items-center justify-center">
                <Receipt className="h-7 w-7 opacity-50" />
              </div>
              <p>{t("pos.emptyCart")}</p>
            </div>
          ) : (
            <div className="space-y-2">
              {Object.values(cart).map(({ p, qty }) => (
                <div key={p.id} className="rounded-xl border border-border/60 p-3 bg-card hover:border-primary/30 transition-colors">
                  <div className="flex items-start justify-between gap-2">
                    <div className="text-sm font-semibold flex-1 line-clamp-2 leading-snug">{label(p)}</div>
                    <button onClick={() => setQty(p.id, 0)} className="text-muted-foreground hover:text-destructive transition-colors">
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  </div>
                  <div className="text-[11px] text-muted-foreground mt-1 tabular-nums">
                    {fmt(Number(p.sale_price))} × {qty}
                  </div>
                  <div className="mt-2 flex items-center justify-between">
                    <div className="flex items-center gap-1 rounded-full bg-muted/70 p-1">
                      <Button size="icon" variant="ghost" className="h-7 w-7 rounded-full hover:bg-background" onClick={() => setQty(p.id, qty - 1)}>
                        <Minus className="h-3 w-3" />
                      </Button>
                      <Input
                        type="number" min={0} value={qty}
                        onChange={(e) => setQty(p.id, Number(e.target.value))}
                        className="h-7 w-12 text-center tabular-nums border-0 bg-transparent focus-visible:ring-0 px-0 text-sm font-semibold"
                      />
                      <Button size="icon" variant="ghost" className="h-7 w-7 rounded-full hover:bg-background" onClick={() => setQty(p.id, qty + 1)}>
                        <Plus className="h-3 w-3" />
                      </Button>
                    </div>
                    <div className="text-sm font-bold tabular-nums text-primary">{fmt(qty * Number(p.sale_price))}</div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="p-5 border-t bg-muted/30 space-y-3 text-sm">
          <div className="space-y-1.5">
            <div className="flex justify-between text-muted-foreground"><span>{t("sales.subtotal")}</span><span className="tabular-nums">{fmt(totals.subtotal)}</span></div>
            <div className="flex justify-between text-muted-foreground"><span>{t("sales.taxTotal")}</span><span className="tabular-nums">{fmt(totals.tax)}</span></div>
          </div>
          <div
            className="flex justify-between items-center p-3 rounded-xl text-white shadow-sm"
            style={{ background: "var(--gradient-brand)" }}
          >
            <span className="text-sm font-medium opacity-90">{t("sales.total")}</span>
            <span className="tabular-nums text-xl font-bold">{fmt(totals.total)}</span>
          </div>
          <div className="space-y-1.5">
            <label className="text-xs text-muted-foreground flex items-center gap-1.5">
              <Wallet className="h-3.5 w-3.5" />
              {t("pos.amount")}
            </label>
            <Input type="number" step="0.01" value={paid} onChange={(e) => setPaid(e.target.value)} className="h-11 text-lg tabular-nums rounded-xl font-semibold" />
          </div>
          {change > 0 && (
            <div className="flex justify-between items-center p-2 rounded-lg bg-emerald-500/10 text-emerald-700 font-semibold">
              <span className="text-xs">{t("pos.change")}</span>
              <span className="tabular-nums">{fmt(change)}</span>
            </div>
          )}
          <Button
            className="w-full h-12 text-base rounded-xl font-semibold shadow-md"
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