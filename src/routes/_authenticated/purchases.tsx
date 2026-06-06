import { createFileRoute } from "@tanstack/react-router";
import { useTranslation } from "react-i18next";
import { useMemo, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { supabase } from "@/integrations/supabase/client";
import { createPurchase } from "@/lib/api/purchases.functions";
import { PageHeader } from "@/components/app/page-header";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Plus, Trash2, ShoppingBag, Package, TrendingDown } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/purchases")({
  head: () => ({ meta: [{ title: "Purchases — ERP" }] }),
  component: Page,
});

type Product = { id: string; name_ar: string; name_en: string | null; cost_price: number; sku: string | null };
type Item = { product_id: string; quantity: number; unit_cost: number };

function Page() {
  const { t, i18n } = useTranslation();
  const qc = useQueryClient();
  const createPurchaseFn = useServerFn(createPurchase);
  const [open, setOpen] = useState(false);
  const [warehouseId, setWarehouseId] = useState("");
  const [supplierId, setSupplierId] = useState("");
  const [notes, setNotes] = useState("");
  const [items, setItems] = useState<Item[]>([]);

  const { data: warehouses = [] } = useQuery({
    queryKey: ["warehouses", "active"],
    queryFn: async () => (await supabase.from("warehouses").select("id,name,is_default").eq("is_active", true).order("name")).data ?? [],
  });
  const { data: suppliers = [] } = useQuery({
    queryKey: ["suppliers", "active"],
    queryFn: async () => (await supabase.from("suppliers").select("id,name").eq("is_active", true).order("name")).data ?? [],
  });
  const { data: products = [] } = useQuery({
    queryKey: ["products", "active"],
    queryFn: async () => (await supabase.from("products").select("id,name_ar,name_en,cost_price,sku").eq("is_active", true).order("name_ar")).data as Product[] ?? [],
  });
  const { data: recent = [] } = useQuery({
    queryKey: ["recent_purchases"],
    queryFn: async () => {
      const { data } = await supabase
        .from("stock_movements")
        .select("id, created_at, quantity, unit_cost, notes, products(name_ar, name_en), warehouses(name)")
        .eq("movement_type", "purchase")
        .order("created_at", { ascending: false })
        .limit(50);
      return (data ?? []) as unknown as Array<{ id: string; created_at: string; quantity: number; unit_cost: number; notes: string | null; products: { name_ar: string; name_en: string | null } | null; warehouses: { name: string } | null }>;
    },
  });

  const productLabel = (p: Product) => i18n.language === "en" && p.name_en ? p.name_en : p.name_ar;
  const fmt = (n: number) => n.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  const total = useMemo(() => items.reduce((s, i) => s + i.quantity * i.unit_cost, 0), [items]);

  const openNew = () => {
    const def = warehouses.find((w) => w.is_default) ?? warehouses[0];
    setWarehouseId(def?.id ?? ""); setSupplierId(""); setNotes(""); setItems([]); setOpen(true);
  };
  const addItem = () => setItems([...items, { product_id: "", quantity: 1, unit_cost: 0 }]);
  const updateItem = (idx: number, patch: Partial<Item>) => setItems(items.map((it, i) => i === idx ? { ...it, ...patch } : it));
  const removeItem = (idx: number) => setItems(items.filter((_, i) => i !== idx));
  const onProductPick = (idx: number, pid: string) => {
    const p = products.find((x) => x.id === pid);
    if (p) updateItem(idx, { product_id: pid, unit_cost: Number(p.cost_price) });
  };

  const submit = useMutation({
    mutationFn: async () => {
      if (!warehouseId) throw new Error(t("sales.selectWarehouse"));
      if (items.length === 0 || items.some((i) => !i.product_id || i.quantity <= 0)) throw new Error(t("sales.noItems"));
      return await createPurchaseFn({
        data: {
          supplier_id: supplierId || null,
          warehouse_id: warehouseId,
          notes: notes || null,
          items: items.map((i) => ({ product_id: i.product_id, quantity: Number(i.quantity), unit_cost: Number(i.unit_cost) })),
        },
      });
    },
    onSuccess: () => {
      toast.success(t("common.saved"));
      qc.invalidateQueries({ queryKey: ["recent_purchases"] });
      qc.invalidateQueries({ queryKey: ["inventory"] });
      qc.invalidateQueries({ queryKey: ["suppliers"] });
      setOpen(false);
    },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <div className="p-6 space-y-6">
      <PageHeader
        title={t("purchases.title")}
        description={t("purchases.subtitle", "إدارة فواتير الشراء واستلام البضائع من الموردين")}
        actions={
          <Button onClick={openNew} className="rounded-xl shadow-md h-10">
            <Plus className="h-4 w-4 me-2" />{t("purchases.new")}
          </Button>
        }
      />

      <div className="grid gap-4 sm:grid-cols-3">
        {[
          { label: t("purchases.recent", "آخر العمليات"), value: recent.length.toString(), icon: ShoppingBag, bg: "bg-primary/10 text-primary" },
          { label: t("purchases.totalQty", "إجمالي الكميات"), value: recent.reduce((s, r) => s + Number(r.quantity), 0).toString(), icon: Package, bg: "bg-emerald-500/10 text-emerald-600" },
          { label: t("purchases.totalCost", "إجمالي التكلفة"), value: fmt(recent.reduce((s, r) => s + Number(r.quantity) * Number(r.unit_cost ?? 0), 0)), icon: TrendingDown, bg: "bg-amber-500/10 text-amber-600" },
        ].map((s) => (
          <Card key={s.label} className="border-border/60 shadow-sm">
            <CardContent className="p-5 flex items-center justify-between">
              <div className="space-y-1">
                <p className="text-xs text-muted-foreground font-medium uppercase tracking-wider">{s.label}</p>
                <p className="text-2xl font-bold tabular-nums">{s.value}</p>
              </div>
              <div className={`flex h-11 w-11 items-center justify-center rounded-2xl ${s.bg}`}>
                <s.icon className="h-5 w-5" />
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      <Card className="border-border/60 shadow-sm overflow-hidden rounded-2xl">
        <CardContent className="p-0">
          <div className="overflow-x-auto">
          <Table>
            <TableHeader className="bg-muted/30">
              <TableRow className="hover:bg-transparent">
                <TableHead>{t("sales.date")}</TableHead>
                <TableHead>{t("sales.product")}</TableHead>
                <TableHead>{t("movements.warehouse")}</TableHead>
                <TableHead className="text-end">{t("sales.qty")}</TableHead>
                <TableHead className="text-end">{t("products.cost_price")}</TableHead>
                <TableHead className="text-end">{t("sales.total")}</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {recent.length === 0 ? (
                <TableRow><TableCell colSpan={6} className="text-center py-12 text-muted-foreground">{t("common.empty")}</TableCell></TableRow>
              ) : recent.map((r) => (
                <TableRow key={r.id} className="hover:bg-muted/40 transition-colors">
                  <TableCell className="text-xs text-muted-foreground">{new Date(r.created_at).toLocaleString()}</TableCell>
                  <TableCell className="font-medium">{i18n.language === "en" && r.products?.name_en ? r.products.name_en : r.products?.name_ar ?? "—"}</TableCell>
                  <TableCell className="text-muted-foreground">{r.warehouses?.name ?? "—"}</TableCell>
                  <TableCell className="text-end tabular-nums">{Number(r.quantity)}</TableCell>
                  <TableCell className="text-end tabular-nums">{fmt(Number(r.unit_cost ?? 0))}</TableCell>
                  <TableCell className="text-end tabular-nums font-semibold text-primary">{fmt(Number(r.quantity) * Number(r.unit_cost ?? 0))}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
          </div>
        </CardContent>
      </Card>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
          <DialogHeader><DialogTitle className="flex items-center gap-2"><ShoppingBag className="h-4 w-4" />{t("purchases.new")}</DialogTitle></DialogHeader>
          <div className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <div>
                <Label>{t("purchases.warehouse")} *</Label>
                <Select value={warehouseId} onValueChange={setWarehouseId}>
                  <SelectTrigger><SelectValue placeholder={t("sales.selectWarehouse")} /></SelectTrigger>
                  <SelectContent>{warehouses.map((w) => <SelectItem key={w.id} value={w.id}>{w.name}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <div>
                <Label>{t("purchases.supplier")}</Label>
                <Select value={supplierId || "none"} onValueChange={(v) => setSupplierId(v === "none" ? "" : v)}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">{t("purchases.noSupplier")}</SelectItem>
                    {suppliers.map((s) => <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="rounded-md border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-1/2">{t("sales.product")}</TableHead>
                    <TableHead>{t("sales.qty")}</TableHead>
                    <TableHead>{t("products.cost_price")}</TableHead>
                    <TableHead className="text-end">{t("sales.lineTotal")}</TableHead>
                    <TableHead></TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {items.length === 0 ? (
                    <TableRow><TableCell colSpan={5} className="text-center py-4 text-muted-foreground text-sm">{t("sales.noItems")}</TableCell></TableRow>
                  ) : items.map((it, idx) => (
                    <TableRow key={idx}>
                      <TableCell>
                        <Select value={it.product_id} onValueChange={(v) => onProductPick(idx, v)}>
                          <SelectTrigger><SelectValue placeholder={t("sales.selectProduct")} /></SelectTrigger>
                          <SelectContent>{products.map((p) => <SelectItem key={p.id} value={p.id}>{productLabel(p)}</SelectItem>)}</SelectContent>
                        </Select>
                      </TableCell>
                      <TableCell><Input type="number" step="0.001" className="w-20" value={it.quantity} onChange={(e) => updateItem(idx, { quantity: Number(e.target.value) })} /></TableCell>
                      <TableCell><Input type="number" step="0.01" className="w-24" value={it.unit_cost} onChange={(e) => updateItem(idx, { unit_cost: Number(e.target.value) })} /></TableCell>
                      <TableCell className="text-end tabular-nums">{fmt(it.quantity * it.unit_cost)}</TableCell>
                      <TableCell><Button size="icon" variant="ghost" onClick={() => removeItem(idx)}><Trash2 className="h-4 w-4 text-destructive" /></Button></TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
              <div className="p-2 border-t flex items-center justify-between">
                <Button variant="outline" size="sm" onClick={addItem}><Plus className="h-4 w-4 me-1" />{t("sales.addItem")}</Button>
                <div className="text-sm font-bold tabular-nums">{t("sales.total")}: {fmt(total)}</div>
              </div>
            </div>

            <div>
              <Label>{t("customers.notes")}</Label>
              <Input value={notes} onChange={(e) => setNotes(e.target.value)} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)}>{t("common.cancel")}</Button>
            <Button onClick={() => submit.mutate()} disabled={submit.isPending}>{t("purchases.save")}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}