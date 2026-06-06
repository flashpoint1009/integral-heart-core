import { createFileRoute } from "@tanstack/react-router";
import { useTranslation } from "react-i18next";
import { useMemo, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth-context";
import { PageHeader } from "@/components/app/page-header";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from "@/components/ui/dialog";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { Search, Sliders } from "lucide-react";
import { toast } from "sonner";
import { ExcelImportButton } from "@/components/app/excel-import";

export const Route = createFileRoute("/_authenticated/inventory")({
  head: () => ({ meta: [{ title: "Inventory — ERP" }] }),
  component: Page,
});

type Product = { id: string; name_ar: string; name_en: string | null; sku: string | null; min_stock: number | null };
type Warehouse = { id: string; name: string };
type Inv = { id: string; product_id: string; warehouse_id: string; quantity: number };

function Page() {
  const { t, i18n } = useTranslation();
  const { user } = useAuth();
  const { hasRole } = useAuth();
  const canImport = hasRole("admin") || hasRole("manager") || hasRole("warehouse") || hasRole("accountant");
  const qc = useQueryClient();
  const [whFilter, setWhFilter] = useState<string>("all");
  const [query, setQuery] = useState("");
  const [adjustOpen, setAdjustOpen] = useState(false);
  const [target, setTarget] = useState<{ product: Product; warehouse: Warehouse; current: number } | null>(null);
  const [newQty, setNewQty] = useState("0");
  const [reason, setReason] = useState("");

  const { data: products = [] } = useQuery({
    queryKey: ["products"],
    queryFn: async () => {
      const { data, error } = await supabase.from("products").select("id,name_ar,name_en,sku,min_stock").eq("is_active", true).order("name_ar");
      if (error) throw error;
      return data as Product[];
    },
  });

  const { data: warehouses = [] } = useQuery({
    queryKey: ["warehouses"],
    queryFn: async () => {
      const { data, error } = await supabase.from("warehouses").select("id,name").eq("is_active", true).order("name");
      if (error) throw error;
      return data as Warehouse[];
    },
  });

  const { data: inventory = [], isLoading } = useQuery({
    queryKey: ["inventory"],
    queryFn: async () => {
      const { data, error } = await supabase.from("inventory").select("*");
      if (error) throw error;
      return data as Inv[];
    },
  });

  const qtyMap = useMemo(() => {
    const m = new Map<string, number>();
    for (const i of inventory) m.set(`${i.product_id}:${i.warehouse_id}`, Number(i.quantity));
    return m;
  }, [inventory]);

  const productName = (p: Product) => (i18n.language === "en" && p.name_en ? p.name_en : p.name_ar);

  const filteredProducts = useMemo(() => {
    const q = query.trim().toLowerCase();
    return products.filter((p) =>
      !q || p.name_ar.toLowerCase().includes(q) || (p.name_en ?? "").toLowerCase().includes(q) || (p.sku ?? "").toLowerCase().includes(q),
    );
  }, [products, query]);

  const shownWarehouses = whFilter === "all" ? warehouses : warehouses.filter((w) => w.id === whFilter);

  const adjust = useMutation({
    mutationFn: async () => {
      if (!target) return;
      const newQuantity = Number(newQty);
      if (Number.isNaN(newQuantity) || newQuantity < 0) throw new Error("invalid quantity");
      const diff = newQuantity - target.current;

      const { error: upErr } = await supabase
        .from("inventory")
        .upsert(
          { product_id: target.product.id, warehouse_id: target.warehouse.id, quantity: newQuantity },
          { onConflict: "product_id,warehouse_id" },
        );
      if (upErr) throw upErr;

      if (diff !== 0) {
        const { error: mvErr } = await supabase.from("stock_movements").insert({
          product_id: target.product.id,
          warehouse_id: target.warehouse.id,
          movement_type: "adjustment",
          quantity: diff,
          notes: reason || null,
          created_by: user?.id ?? null,
        });
        if (mvErr) throw mvErr;
      }
    },
    onSuccess: () => {
      toast.success(t("common.saved"));
      qc.invalidateQueries({ queryKey: ["inventory"] });
      setAdjustOpen(false);
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const openAdjust = (p: Product, w: Warehouse) => {
    const cur = qtyMap.get(`${p.id}:${w.id}`) ?? 0;
    setTarget({ product: p, warehouse: w, current: cur });
    setNewQty(String(cur));
    setReason("");
    setAdjustOpen(true);
  };

  return (
    <div className="p-6">
      <PageHeader title={t("inventory.title")} actions={canImport ? (
        <ExcelImportButton
          label="استيراد مخزون"
          title="استيراد مخزون من Excel"
          description="حدّد SKU للمنتج واسم المخزن والكمية. يتم استبدال الكمية الحالية."
          templateFileName="inventory-template.xlsx"
          columns={[
            { key: "sku", label: "SKU", required: true, example: "SKU-001" },
            { key: "warehouse", label: "المخزن", required: true, example: "المخزن الرئيسي" },
            { key: "quantity", label: "الكمية", required: true, example: "100" },
          ]}
          importRow={async (r) => {
            const sku = String(r.sku ?? "").trim();
            const whName = String(r.warehouse ?? "").trim();
            const qty = Number(r.quantity);
            if (!sku) throw new Error("SKU مطلوب");
            if (!whName) throw new Error("اسم المخزن مطلوب");
            if (Number.isNaN(qty) || qty < 0) throw new Error("كمية غير صحيحة");
            const p = products.find((x) => (x.sku ?? "").trim().toLowerCase() === sku.toLowerCase());
            if (!p) throw new Error(`لا يوجد منتج بـ SKU=${sku}`);
            const w = warehouses.find((x) => x.name.trim().toLowerCase() === whName.toLowerCase());
            if (!w) throw new Error(`لا يوجد مخزن باسم ${whName}`);
            const current = qtyMap.get(`${p.id}:${w.id}`) ?? 0;
            const { error: upErr } = await supabase.from("inventory").upsert(
              { product_id: p.id, warehouse_id: w.id, quantity: qty },
              { onConflict: "product_id,warehouse_id" },
            );
            if (upErr) throw new Error(upErr.message);
            const diff = qty - current;
            if (diff !== 0) {
              await supabase.from("stock_movements").insert({
                product_id: p.id, warehouse_id: w.id,
                movement_type: "adjustment", quantity: diff,
                notes: "Excel import", created_by: user?.id ?? null,
              });
            }
          }}
          onDone={() => qc.invalidateQueries({ queryKey: ["inventory"] })}
        />
      ) : undefined} />

      <div className="mb-4 flex flex-wrap gap-2 items-center">
        <div className="relative max-w-xs flex-1">
          <Search className="absolute start-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input className="ps-9 rounded-full shadow-sm focus-visible:ring-2 focus-visible:ring-primary/30" placeholder={t("common.search")} value={query} onChange={(e) => setQuery(e.target.value)} />
        </div>
        <Select value={whFilter} onValueChange={setWhFilter}>
          <SelectTrigger className="w-[200px]"><SelectValue placeholder={t("inventory.filterWarehouse")} /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">{t("common.all")}</SelectItem>
            {warehouses.map((w) => <SelectItem key={w.id} value={w.id}>{w.name}</SelectItem>)}
          </SelectContent>
        </Select>
      </div>

      {warehouses.length === 0 ? (
        <div className="rounded-md border bg-card p-8 text-center text-muted-foreground">
          {t("common.empty")} — {t("warehouses.add")}
        </div>
      ) : (
      <div className="rounded-md border bg-card overflow-x-auto">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>{t("inventory.product")}</TableHead>
              <TableHead>{t("products.sku")}</TableHead>
              {shownWarehouses.map((w) => (
                <TableHead key={w.id} className="text-end">{w.name}</TableHead>
              ))}
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading ? (
              <TableRow><TableCell colSpan={2 + shownWarehouses.length} className="text-center py-8 text-muted-foreground">{t("common.loading")}</TableCell></TableRow>
            ) : filteredProducts.length === 0 ? (
              <TableRow><TableCell colSpan={2 + shownWarehouses.length} className="text-center py-8 text-muted-foreground">{t("common.empty")}</TableCell></TableRow>
            ) : filteredProducts.map((p) => {
              const min = Number(p.min_stock ?? 0);
              return (
                <TableRow key={p.id} className="hover:bg-muted/40">
                  <TableCell className="font-semibold text-primary">{productName(p)}</TableCell>
                  <TableCell className="font-mono text-sm text-muted-foreground">{p.sku ?? "—"}</TableCell>
                  {shownWarehouses.map((w) => {
                    const q = qtyMap.get(`${p.id}:${w.id}`) ?? 0;
                    const low = min > 0 && q <= min;
                    return (
                      <TableCell key={w.id} className="text-end">
                        <button
                          onClick={() => openAdjust(p, w)}
                          className="inline-flex items-center gap-1.5 hover:text-primary transition-colors group"
                        >
                          <span className="tabular-nums font-medium">{q}</span>
                          {low && <Badge variant="destructive" className="h-5 px-1.5 text-[10px] rounded-full">{t("inventory.low")}</Badge>}
                          <Sliders className="h-3 w-3 opacity-0 group-hover:opacity-100" />
                        </button>
                      </TableCell>
                    );
                  })}
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </div>
      )}

      <Dialog open={adjustOpen} onOpenChange={setAdjustOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t("inventory.adjust")}</DialogTitle>
          </DialogHeader>
          {target && (
            <div className="space-y-3">
              <div className="rounded-md bg-muted p-3 text-sm">
                <div className="font-medium">{productName(target.product)}</div>
                <div className="text-muted-foreground text-xs mt-1">{target.warehouse.name}</div>
                <div className="text-muted-foreground text-xs mt-1">{t("inventory.quantity")}: <span className="tabular-nums font-mono">{target.current}</span></div>
              </div>
              <div>
                <Label>{t("inventory.new_quantity")}</Label>
                <Input type="number" step="0.001" value={newQty} onChange={(e) => setNewQty(e.target.value)} />
              </div>
              <div>
                <Label>{t("inventory.reason")}</Label>
                <Input value={reason} onChange={(e) => setReason(e.target.value)} />
              </div>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setAdjustOpen(false)}>{t("common.cancel")}</Button>
            <Button onClick={() => adjust.mutate()} disabled={adjust.isPending}>{t("common.save")}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}