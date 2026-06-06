import { createFileRoute } from "@tanstack/react-router";
import { useTranslation } from "react-i18next";
import { useMemo, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { supabase } from "@/integrations/supabase/client";
import { createSale } from "@/lib/api/sales.functions";
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
import { Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/sales")({
  head: () => ({ meta: [{ title: "Sales — ERP" }] }),
  component: Page,
});

type Invoice = {
  id: string; invoice_number: string; invoice_date: string;
  customer_id: string | null; total: number; paid: number;
  status: "draft" | "confirmed" | "paid" | "partial" | "cancelled";
};
type Product = { id: string; name_ar: string; name_en: string | null; sale_price: number; tax_rate: number };
type Item = { product_id: string; quantity: number; unit_price: number; discount: number; tax_rate: number };

function Page() {
  const { t, i18n } = useTranslation();
  const qc = useQueryClient();
  const createSaleFn = useServerFn(createSale);
  const [open, setOpen] = useState(false);

  const { data: invoices = [], isLoading } = useQuery({
    queryKey: ["sales_invoices"],
    queryFn: async () => {
      const { data, error } = await supabase.from("sales_invoices").select("*").order("invoice_date", { ascending: false }).limit(100);
      if (error) throw error;
      return data as Invoice[];
    },
  });

  const { data: customers = [] } = useQuery({
    queryKey: ["customers", "active"],
    queryFn: async () => (await supabase.from("customers").select("id,name").eq("is_active", true).order("name")).data ?? [],
  });

  const customerName = (id: string | null) => customers.find((c) => c.id === id)?.name ?? t("sales.walkin");

  // New invoice form state
  const [warehouseId, setWarehouseId] = useState<string>("");
  const [customerId, setCustomerId] = useState<string>("");
  const [items, setItems] = useState<Item[]>([]);
  const [paid, setPaid] = useState("0");
  const [notes, setNotes] = useState("");

  const { data: warehouses = [] } = useQuery({
    queryKey: ["warehouses", "active"],
    queryFn: async () => (await supabase.from("warehouses").select("id,name,is_default").eq("is_active", true).order("name")).data ?? [],
  });

  const { data: products = [] } = useQuery({
    queryKey: ["products", "active"],
    queryFn: async () => (await supabase.from("products").select("id,name_ar,name_en,sale_price,tax_rate").eq("is_active", true).order("name_ar")).data as Product[] ?? [],
  });

  const productLabel = (p: Product) => i18n.language === "en" && p.name_en ? p.name_en : p.name_ar;

  const totals = useMemo(() => {
    let subtotal = 0, disc = 0, tax = 0;
    for (const i of items) {
      const gross = i.quantity * i.unit_price;
      const net = gross - i.discount;
      subtotal += gross;
      disc += i.discount;
      tax += (net * i.tax_rate) / 100;
    }
    const total = subtotal - disc + tax;
    return { subtotal, disc, tax, total };
  }, [items]);

  const openNew = () => {
    const def = warehouses.find((w) => w.is_default) ?? warehouses[0];
    setWarehouseId(def?.id ?? "");
    setCustomerId("");
    setItems([]);
    setPaid("0");
    setNotes("");
    setOpen(true);
  };

  const addItem = () => setItems([...items, { product_id: "", quantity: 1, unit_price: 0, discount: 0, tax_rate: 0 }]);
  const updateItem = (idx: number, patch: Partial<Item>) => setItems(items.map((it, i) => i === idx ? { ...it, ...patch } : it));
  const removeItem = (idx: number) => setItems(items.filter((_, i) => i !== idx));
  const onProductPick = (idx: number, pid: string) => {
    const p = products.find((x) => x.id === pid);
    if (p) updateItem(idx, { product_id: pid, unit_price: Number(p.sale_price), tax_rate: Number(p.tax_rate) });
  };

  const submit = useMutation({
    mutationFn: async () => {
      if (!warehouseId) throw new Error(t("sales.selectWarehouse"));
      if (items.length === 0 || items.some((i) => !i.product_id || i.quantity <= 0)) throw new Error(t("sales.noItems"));
      return await createSaleFn({
        data: {
          customer_id: customerId || null,
          warehouse_id: warehouseId,
          items: items.map((i) => ({
            product_id: i.product_id, quantity: Number(i.quantity), unit_price: Number(i.unit_price),
            discount: Number(i.discount), tax_rate: Number(i.tax_rate),
          })),
          paid: Number(paid) || 0,
          notes: notes || null,
        },
      });
    },
    onSuccess: (res) => {
      toast.success(`${t("sales.invoice")} ${res.invoice_number}`);
      qc.invalidateQueries({ queryKey: ["sales_invoices"] });
      qc.invalidateQueries({ queryKey: ["inventory"] });
      setOpen(false);
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const fmt = (n: number) => n.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  const statusVariant: Record<Invoice["status"], "default" | "secondary" | "outline" | "destructive"> = {
    paid: "default", partial: "secondary", confirmed: "outline", draft: "outline", cancelled: "destructive",
  };

  return (
    <div className="p-6">
      <PageHeader title={t("sales.title")} actions={<Button onClick={openNew}><Plus className="h-4 w-4 me-2" />{t("sales.new")}</Button>} />
      <div className="rounded-md border bg-card overflow-x-auto">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>{t("sales.invoice_number")}</TableHead>
              <TableHead>{t("sales.date")}</TableHead>
              <TableHead>{t("sales.customer")}</TableHead>
              <TableHead className="text-end">{t("sales.total")}</TableHead>
              <TableHead className="text-end">{t("sales.paid")}</TableHead>
              <TableHead>{t("sales.status")}</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading ? (
              <TableRow><TableCell colSpan={6} className="text-center py-8 text-muted-foreground">{t("common.loading")}</TableCell></TableRow>
            ) : invoices.length === 0 ? (
              <TableRow><TableCell colSpan={6} className="text-center py-8 text-muted-foreground">{t("common.empty")}</TableCell></TableRow>
            ) : invoices.map((inv) => (
              <TableRow key={inv.id}>
                <TableCell className="font-mono font-medium">{inv.invoice_number}</TableCell>
                <TableCell className="text-muted-foreground">{new Date(inv.invoice_date).toLocaleString()}</TableCell>
                <TableCell>{customerName(inv.customer_id)}</TableCell>
                <TableCell className="text-end tabular-nums">{fmt(Number(inv.total))}</TableCell>
                <TableCell className="text-end tabular-nums">{fmt(Number(inv.paid))}</TableCell>
                <TableCell><Badge variant={statusVariant[inv.status]}>{t(`sales.statuses.${inv.status}`)}</Badge></TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{t("sales.new")}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <div>
                <Label>{t("sales.warehouse")} *</Label>
                <Select value={warehouseId} onValueChange={setWarehouseId}>
                  <SelectTrigger><SelectValue placeholder={t("sales.selectWarehouse")} /></SelectTrigger>
                  <SelectContent>{warehouses.map((w) => <SelectItem key={w.id} value={w.id}>{w.name}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <div>
                <Label>{t("sales.customer")}</Label>
                <Select value={customerId || "walkin"} onValueChange={(v) => setCustomerId(v === "walkin" ? "" : v)}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="walkin">{t("sales.walkin")}</SelectItem>
                    {customers.map((c) => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="rounded-md border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-1/3">{t("sales.product")}</TableHead>
                    <TableHead>{t("sales.qty")}</TableHead>
                    <TableHead>{t("sales.price")}</TableHead>
                    <TableHead>{t("sales.discount")}</TableHead>
                    <TableHead>{t("sales.tax")}</TableHead>
                    <TableHead className="text-end">{t("sales.lineTotal")}</TableHead>
                    <TableHead></TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {items.length === 0 ? (
                    <TableRow><TableCell colSpan={7} className="text-center py-4 text-muted-foreground text-sm">{t("sales.noItems")}</TableCell></TableRow>
                  ) : items.map((it, idx) => {
                    const lineTotal = (it.quantity * it.unit_price - it.discount) * (1 + it.tax_rate / 100);
                    return (
                      <TableRow key={idx}>
                        <TableCell>
                          <Select value={it.product_id} onValueChange={(v) => onProductPick(idx, v)}>
                            <SelectTrigger><SelectValue placeholder={t("sales.selectProduct")} /></SelectTrigger>
                            <SelectContent>{products.map((p) => <SelectItem key={p.id} value={p.id}>{productLabel(p)}</SelectItem>)}</SelectContent>
                          </Select>
                        </TableCell>
                        <TableCell><Input type="number" step="0.001" className="w-20" value={it.quantity} onChange={(e) => updateItem(idx, { quantity: Number(e.target.value) })} /></TableCell>
                        <TableCell><Input type="number" step="0.01" className="w-24" value={it.unit_price} onChange={(e) => updateItem(idx, { unit_price: Number(e.target.value) })} /></TableCell>
                        <TableCell><Input type="number" step="0.01" className="w-20" value={it.discount} onChange={(e) => updateItem(idx, { discount: Number(e.target.value) })} /></TableCell>
                        <TableCell><Input type="number" step="0.01" className="w-20" value={it.tax_rate} onChange={(e) => updateItem(idx, { tax_rate: Number(e.target.value) })} /></TableCell>
                        <TableCell className="text-end tabular-nums">{fmt(lineTotal)}</TableCell>
                        <TableCell><Button size="icon" variant="ghost" onClick={() => removeItem(idx)}><Trash2 className="h-4 w-4 text-destructive" /></Button></TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
              <div className="p-2 border-t">
                <Button variant="outline" size="sm" onClick={addItem}><Plus className="h-4 w-4 me-1" />{t("sales.addItem")}</Button>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <Label>{t("customers.notes")}</Label>
                <Input value={notes} onChange={(e) => setNotes(e.target.value)} />
                <div className="mt-3">
                  <Label>{t("sales.paid")}</Label>
                  <Input type="number" step="0.01" value={paid} onChange={(e) => setPaid(e.target.value)} />
                </div>
              </div>
              <div className="space-y-1 text-sm">
                <div className="flex justify-between"><span className="text-muted-foreground">{t("sales.subtotal")}</span><span className="tabular-nums">{fmt(totals.subtotal)}</span></div>
                <div className="flex justify-between"><span className="text-muted-foreground">{t("sales.discountTotal")}</span><span className="tabular-nums">−{fmt(totals.disc)}</span></div>
                <div className="flex justify-between"><span className="text-muted-foreground">{t("sales.taxTotal")}</span><span className="tabular-nums">{fmt(totals.tax)}</span></div>
                <div className="flex justify-between font-bold text-base border-t pt-2 mt-2"><span>{t("sales.total")}</span><span className="tabular-nums">{fmt(totals.total)}</span></div>
                <div className="flex justify-between text-muted-foreground"><span>{t("sales.due")}</span><span className="tabular-nums">{fmt(Math.max(0, totals.total - (Number(paid) || 0)))}</span></div>
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)}>{t("common.cancel")}</Button>
            <Button onClick={() => submit.mutate()} disabled={submit.isPending}>{t("sales.save")}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}